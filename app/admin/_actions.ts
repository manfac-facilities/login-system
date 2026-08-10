'use server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin, normalizarEmail, type Nivel } from '@/lib/auth/roles'
import { isManfacEmail } from '@/lib/auth/domain'
import { revalidatePath } from 'next/cache'

const PER_PAGE = 100
const NIVEIS_VALIDOS: Nivel[] = ['analista', 'administrador']

export interface UsuarioHub {
  id: string
  email: string
  nome: string | null
  nivel: Nivel | null
  ultimoAcesso: string | null
  convitePendente: boolean
}

const ERRO_CONFIG =
  'Configuração do servidor incompleta: a SUPABASE_SERVICE_ROLE_KEY não está disponível. Avise quem cuida do deploy.'

// `createAdminClient` lança quando falta variável de ambiente. Deixar a exceção
// subir derruba a página inteira com a mensagem genérica de Server Component, que
// não diz o que fazer. Aqui ela vira um erro exibível na faixa vermelha.
function clienteAdmin():
  | { admin: ReturnType<typeof createAdminClient> }
  | { error: string } {
  try {
    return { admin: createAdminClient() }
  } catch {
    return { error: ERRO_CONFIG }
  }
}

async function exigirAdmin(mensagem: string): Promise<{ email: string } | { error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !(await isAdmin(supabase, user.email))) return { error: mensagem }
  return { email: normalizarEmail(user.email) }
}

export async function listarUsuariosAction(): Promise<UsuarioHub[] | { error: string }> {
  const quem = await exigirAdmin('Apenas administradores podem ver esta página')
  if ('error' in quem) return quem

  const c = clienteAdmin()
  if ('error' in c) return c
  const admin = c.admin

  const todos = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) return { error: 'Erro ao listar usuários' }
    const lote = data?.users ?? []
    todos.push(...lote)
    if (lote.length < PER_PAGE) break
  }

  const { data: papeis } = await admin.from('hub_user_roles').select('user_email, nivel')
  const porEmail = new Map<string, Nivel>()
  for (const p of papeis ?? []) porEmail.set(normalizarEmail(p.user_email), p.nivel as Nivel)

  return todos
    .filter((u): u is typeof u & { email: string } => !!u.email)
    .map((u) => ({
      id: u.id,
      email: u.email,
      nome: (u.user_metadata?.full_name as string | undefined)?.trim() || null,
      nivel: porEmail.get(normalizarEmail(u.email)) ?? null,
      ultimoAcesso: u.last_sign_in_at ?? null,
      convitePendente: !u.confirmed_at,
    }))
    .sort((a, b) => a.email.localeCompare(b.email))
}

async function contarAdministradores(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await admin
    .from('hub_user_roles')
    .select('user_email', { count: 'exact', head: true })
    .eq('nivel', 'administrador')
  return count ?? 0
}

async function nivelDe(
  admin: ReturnType<typeof createAdminClient>,
  alvo: string
): Promise<Nivel | null> {
  const { data } = await admin
    .from('hub_user_roles')
    .select('nivel')
    .eq('user_email', alvo)
    .maybeSingle()
  return (data?.nivel as Nivel | undefined) ?? null
}

export async function alterarNivelAction(
  email: string,
  nivel: Nivel
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem alterar níveis')
  if ('error' in quem) return quem

  const alvo = normalizarEmail(email)
  if (alvo === quem.email) return { error: 'Você não pode alterar o seu próprio nível' }
  if (!NIVEIS_VALIDOS.includes(nivel)) return { error: 'Nível inválido' }

  const c = clienteAdmin()
  if ('error' in c) return c
  const admin = c.admin

  // Rebaixar o último administrador deixaria o hub sem ninguém capaz de
  // reverter a mudança.
  if (nivel === 'analista') {
    const atual = await nivelDe(admin, alvo)
    if (atual === 'administrador' && (await contarAdministradores(admin)) <= 1) {
      return { error: 'O hub precisa de pelo menos um administrador' }
    }
  }

  const { error } = await admin.from('hub_user_roles').upsert(
    { user_email: alvo, nivel, granted_by: quem.email, updated_at: new Date().toISOString() },
    { onConflict: 'user_email' }
  )
  if (error) return { error: 'Erro ao alterar o nível' }

  revalidatePath('/admin/acessos')
  return { success: true }
}

// Chamada depois que a conta já foi apagada, então não há como desfazer.
// Uma linha órfã aqui devolveria os acessos antigos num reconvite, e por isso
// vira erro visível em vez de sumir em silêncio.
async function apagarLinhasDoUsuario(
  admin: ReturnType<typeof createAdminClient>,
  alvo: string
): Promise<string | null> {
  const { error: erroNivel } = await admin.from('hub_user_roles').delete().eq('user_email', alvo)
  const { error: erroAcessos } = await admin
    .from('hub_system_access')
    .delete()
    .eq('user_email', alvo)

  if (erroNivel || erroAcessos) {
    return 'Conta apagada, mas sobraram registros de nível ou de acesso. Remova-os no Supabase antes de convidar esse e-mail de novo.'
  }
  return null
}

async function acharUsuarioPorEmail(
  admin: ReturnType<typeof createAdminClient>,
  alvo: string
): Promise<{ id: string; confirmed_at: string | null } | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) return null
    const lote = data?.users ?? []
    const achado = lote.find((u) => u.email && normalizarEmail(u.email) === alvo)
    if (achado) return { id: achado.id, confirmed_at: achado.confirmed_at ?? null }
    if (lote.length < PER_PAGE) return null
  }
}

export async function removerUsuarioAction(
  email: string
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem remover usuários')
  if ('error' in quem) return quem

  const alvo = normalizarEmail(email)
  if (alvo === quem.email) return { error: 'Você não pode remover a si mesmo' }

  const c = clienteAdmin()
  if ('error' in c) return c
  const admin = c.admin

  if ((await nivelDe(admin, alvo)) === 'administrador' && (await contarAdministradores(admin)) <= 1) {
    return { error: 'O hub precisa de pelo menos um administrador' }
  }

  const usuario = await acharUsuarioPorEmail(admin, alvo)
  if (!usuario) return { error: 'Usuário não encontrado' }

  // A conta primeiro: se falhar, nada mais é apagado.
  const { error } = await admin.auth.admin.deleteUser(usuario.id)
  if (error) return { error: 'Erro ao remover o usuário' }

  const sobrou = await apagarLinhasDoUsuario(admin, alvo)

  revalidatePath('/admin/acessos')
  return sobrou ? { error: sobrou } : { success: true }
}

export async function convidarUsuarioAction(
  email: string,
  nivel: Nivel,
  sistemas: string[]
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem convidar usuários')
  if ('error' in quem) return quem

  const alvo = normalizarEmail(email)
  if (!isManfacEmail(alvo)) return { error: 'Só é possível convidar e-mails @manfac.com.br' }
  if (!NIVEIS_VALIDOS.includes(nivel)) return { error: 'Nível inválido' }

  const c = clienteAdmin()
  if ('error' in c) return c
  const admin = c.admin

  const { error: erroConvite } = await admin.auth.admin.inviteUserByEmail(alvo)
  if (erroConvite) {
    return { error: 'Erro ao enviar o convite. O e-mail já pode estar cadastrado.' }
  }

  // O convite já saiu. Se as gravações abaixo falharem, a pessoa entra sem
  // nível e sem acesso — quem convidou precisa saber disso.
  const { error: erroNivel } = await admin.from('hub_user_roles').upsert(
    { user_email: alvo, nivel, granted_by: quem.email, updated_at: new Date().toISOString() },
    { onConflict: 'user_email' }
  )
  if (erroNivel) {
    revalidatePath('/admin/acessos')
    return { error: 'Convite enviado, mas não foi possível gravar o nível. Ajuste na lista.' }
  }

  if (sistemas.length > 0) {
    const { error: erroAcessos } = await admin.from('hub_system_access').upsert(
      sistemas.map((slug) => ({
        user_email: alvo,
        system_slug: slug,
        has_access: true,
        granted_by: quem.email,
      })),
      { onConflict: 'user_email,system_slug' }
    )
    if (erroAcessos) {
      revalidatePath('/admin/acessos')
      return { error: 'Convite enviado, mas não foi possível liberar os sistemas. Ajuste na lista.' }
    }
  }

  revalidatePath('/admin/acessos')
  return { success: true }
}

export async function reenviarConviteAction(
  email: string
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem reenviar convites')
  if ('error' in quem) return quem

  const c = clienteAdmin()
  if ('error' in c) return c

  const alvo = normalizarEmail(email)
  const { error } = await c.admin.auth.admin.inviteUserByEmail(alvo)
  if (error) return { error: 'Erro ao reenviar o convite' }
  return { success: true }
}

export async function cancelarConviteAction(
  email: string
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem cancelar convites')
  if ('error' in quem) return quem

  const alvo = normalizarEmail(email)
  const c = clienteAdmin()
  if ('error' in c) return c
  const admin = c.admin

  const usuario = await acharUsuarioPorEmail(admin, alvo)
  if (!usuario) return { error: 'Usuário não encontrado' }
  if (usuario.confirmed_at) {
    return { error: 'Esse usuário já confirmou o cadastro. Use "Remover do hub".' }
  }

  const { error } = await admin.auth.admin.deleteUser(usuario.id)
  if (error) return { error: 'Erro ao cancelar o convite' }

  const sobrou = await apagarLinhasDoUsuario(admin, alvo)

  revalidatePath('/admin/acessos')
  return sobrou ? { error: sobrou } : { success: true }
}

export async function enviarResetSenhaAction(
  email: string
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem enviar redefinição de senha')
  if ('error' in quem) return quem

  const supabase = await createServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(normalizarEmail(email), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
  })
  if (error) return { error: 'Erro ao enviar o e-mail de redefinição' }
  return { success: true }
}

export async function alternarAcessoAction(
  userEmail: string,
  systemSlug: string,
  hasAccess: boolean
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem alterar acessos')
  if ('error' in quem) return quem

  const c = clienteAdmin()
  if ('error' in c) return c

  const { error } = await c.admin
    .from('hub_system_access')
    .upsert(
      {
        user_email: normalizarEmail(userEmail),
        system_slug: systemSlug,
        has_access: hasAccess,
        granted_by: quem.email,
      },
      { onConflict: 'user_email,system_slug' }
    )
  if (error) return { error: 'Erro ao atualizar acesso' }

  revalidatePath('/admin/acessos')
  return { success: true }
}
