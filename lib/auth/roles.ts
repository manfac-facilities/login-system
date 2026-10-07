import { cache } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Nivel = 'analista' | 'administrador'

const NIVEIS: readonly string[] = ['analista', 'administrador']

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

// Dentro de UMA renderização/requisição, a mesma pergunta (mesmo client, mesmo
// e-mail) é feita uma vez só. A chave é a identidade do client: cada requisição
// cria o seu, então nada vaza entre requisições nem entre usuários, e uma
// leitura com outro client (ex.: depois de uma escrita) continua indo ao banco.
// Fora de renderização (middleware, testes) o cache() não memoriza nada.
const lerNivel = cache(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (supabase: SupabaseClient<any, any, any>, alvo: string): Promise<Nivel | null> => {
    const { data } = await supabase
      .from('hub_user_roles')
      .select('nivel')
      .eq('user_email', alvo)
      .maybeSingle()

    const nivel = data?.nivel
    return NIVEIS.includes(nivel) ? (nivel as Nivel) : null
  }
)

export async function getNivel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string
): Promise<Nivel | null> {
  const alvo = normalizarEmail(email)
  if (!alvo) return null

  return lerNivel(supabase, alvo)
}

export async function isAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string
): Promise<boolean> {
  return (await getNivel(supabase, email)) === 'administrador'
}
