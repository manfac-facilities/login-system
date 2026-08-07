'use server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin, normalizarEmail, type Nivel } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'

const PER_PAGE = 100

export interface UsuarioHub {
  id: string
  email: string
  nome: string | null
  nivel: Nivel | null
  ultimoAcesso: string | null
  convitePendente: boolean
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

  const admin = createAdminClient()

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

export async function alternarAcessoAction(
  userEmail: string,
  systemSlug: string,
  hasAccess: boolean
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !(await isAdmin(supabase, user.email)))
    return { error: 'Apenas administradores podem alterar acessos' }

  const { error } = await supabase.from('hub_system_access').upsert(
    {
      user_email: userEmail,
      system_slug: systemSlug,
      has_access: hasAccess,
      granted_by: user.email,
    },
    { onConflict: 'user_email,system_slug' }
  )
  if (error) return { error: 'Erro ao atualizar acesso' }

  revalidatePath('/admin/acessos')
  return { success: true }
}
