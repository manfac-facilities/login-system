'use server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/auth/admins'
import { revalidatePath } from 'next/cache'

export interface UsuarioHub {
  id: string
  email: string
}

export async function listarUsuariosAction(): Promise<UsuarioHub[] | { error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem ver esta página' }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await adminClient.auth.admin.listUsers()
  if (error) return { error: 'Erro ao listar usuários' }

  return data.users
    .filter((u): u is typeof u & { email: string } => !!u.email)
    .map((u) => ({ id: u.id, email: u.email }))
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
  if (!user?.email || !isAdminEmail(user.email))
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
