import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdmin } from './roles'

export async function hasSystemAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string,
  systemSlug: string
): Promise<boolean> {
  // Nível e acesso ao sistema não dependem um do outro: vão juntos. Administrador
  // continua abrindo tudo; o resultado da consulta de acesso só vale para os demais.
  const [admin, acesso] = await Promise.allSettled([
    isAdmin(supabase, email),
    (async () => {
      const { data } = await supabase
        .from('hub_system_access')
        .select('has_access')
        .eq('user_email', email.trim().toLowerCase())
        .eq('system_slug', systemSlug)
        .maybeSingle()
      return data?.has_access === true
    })(),
  ])

  // Mesmas falhas de antes: se a leitura do nível quebra, quebra; se a de acesso
  // quebra e a pessoa não é admin, quebra (nunca vira "tem acesso").
  if (admin.status === 'rejected') throw admin.reason
  if (admin.value) return true
  if (acesso.status === 'rejected') throw acesso.reason
  return acesso.value
}

/**
 * Slugs dos sistemas que o e-mail pode abrir, numa consulta só (usado pelo
 * dashboard no lugar de uma hasSystemAccess por card). Mesma regra de
 * hasSystemAccess para quem NÃO é admin: só `has_access === true` conta; erro
 * de consulta ou ausência de linha = nenhum slug (falha FECHADO). O chamador
 * trata o administrador à parte.
 */
export async function systemSlugsComAcesso(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string
): Promise<Set<string>> {
  const { data } = await supabase
    .from('hub_system_access')
    .select('system_slug, has_access')
    .eq('user_email', email.trim().toLowerCase())

  const slugs = new Set<string>()
  for (const linha of (data ?? []) as { system_slug: string; has_access: boolean | null }[]) {
    if (linha.has_access === true) slugs.add(linha.system_slug)
  }
  return slugs
}
