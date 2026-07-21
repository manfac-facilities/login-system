import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdminEmail } from './admins'

export async function requireAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email)) {
    return 'Apenas administradores podem executar esta ação'
  }
  return null
}
