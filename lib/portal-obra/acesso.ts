/**
 * Quem pode entrar no portal: e-mail cadastrado e ativo em `obras_portal_acesso`.
 * Leitura só pelo cliente admin (as tabelas do portal não têm policy para anon/authenticated).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Resposta única ao pedir código — nunca revela se o e-mail está cadastrado. */
export const MENSAGEM_UNIFORME = 'Se o e-mail estiver cadastrado, enviamos um código.'
/** Qualquer falha ao conferir o código (errado, expirado, usado, esgotado, sem acesso). */
export const MENSAGEM_CODIGO_INVALIDO = 'Código inválido ou expirado. Peça um novo código.'
/** Portal sem segredo configurado (falha fechada) ou banco indisponível antes de qualquer decisão por e-mail. */
export const MENSAGEM_INDISPONIVEL = 'A entrada está indisponível no momento. Tente novamente mais tarde.'

/** trim() do JS tira todo espaço Unicode (tab, quebra de linha, NBSP, BOM); depois minúsculas. */
export function normalizarEmail(e: unknown): string {
  return typeof e === 'string' ? e.trim().toLowerCase() : ''
}

/** Formato mínimo de e-mail, até 254 caracteres (acima disso recusa, não trunca), fora do domínio Manfac. */
export function emailAceito(email: string): boolean {
  if (!email || email.length > 254) return false
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false
  const dominio = email.slice(email.lastIndexOf('@') + 1)
  return dominio !== 'manfac.com.br' && !dominio.endsWith('.manfac.com.br')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

/** Ids das obras em que o e-mail tem acesso ativo. Erro de leitura LANÇA (quem chama nega). */
export async function obrasComAcessoAtivo(admin: Admin, email: string): Promise<string[]> {
  if (!emailAceito(email)) return []
  const { data, error } = await admin
    .from('obras_portal_acesso')
    .select('obra_id, ativo')
    .eq('email', email)
    .eq('ativo', true)
  if (error) throw new Error('portal-obra: falha ao ler acesso')
  const ids = ((data ?? []) as { obra_id: unknown; ativo: unknown }[])
    .filter((r) => r.ativo === true && typeof r.obra_id === 'string')
    .map((r) => r.obra_id as string)
  return [...new Set(ids)]
}
