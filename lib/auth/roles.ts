import type { SupabaseClient } from '@supabase/supabase-js'

export type Nivel = 'analista' | 'administrador'

const NIVEIS: readonly string[] = ['analista', 'administrador']

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function getNivel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string
): Promise<Nivel | null> {
  const alvo = normalizarEmail(email)
  if (!alvo) return null

  const { data } = await supabase
    .from('hub_user_roles')
    .select('nivel')
    .eq('user_email', alvo)
    .maybeSingle()

  const nivel = data?.nivel
  return NIVEIS.includes(nivel) ? (nivel as Nivel) : null
}

export async function isAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string
): Promise<boolean> {
  return (await getNivel(supabase, email)) === 'administrador'
}
