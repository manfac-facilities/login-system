import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com service role. Só pode ser usado em Server Action — nunca em
 * componente de cliente, nunca em rota pública sem validação.
 *
 * A URL vem do .env.production versionado; a chave só existe no painel do
 * EasyPanel. Se a chave não chegar no processo, isto lança na primeira
 * chamada, e é assim mesmo: falhar alto na hora é melhor que gravar nada em
 * silêncio.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): SupabaseClient<any, any, any> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('SUPABASE_URL não está configurada no ambiente')

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente')

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
