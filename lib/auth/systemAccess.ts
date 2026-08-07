import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdmin } from './roles'

export async function hasSystemAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string,
  systemSlug: string
): Promise<boolean> {
  if (await isAdmin(supabase, email)) return true

  const { data } = await supabase
    .from('hub_system_access')
    .select('has_access')
    .eq('user_email', email.trim().toLowerCase())
    .eq('system_slug', systemSlug)
    .maybeSingle()

  return data?.has_access === true
}
