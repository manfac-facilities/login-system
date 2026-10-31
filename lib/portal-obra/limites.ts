/**
 * Limites do portal (spec Leva 5 §3.1). Contagem sobre `obras_portal_codigo`;
 * erro de leitura conta como "fora do limite" (falha fechada).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export const CODIGO_VALIDADE_MIN = 10
export const CODIGO_MAX_TENTATIVAS = 5
export const CODIGOS_POR_HORA_EMAIL = 5
export const CODIGOS_POR_HORA_IP = 20

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

/** IP do cliente: primeiro salto do x-forwarded-for (Traefik do EasyPanel), senão x-real-ip. */
export function ipDoCliente(h: { get(nome: string): string | null }): string {
  const primeiro = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim()
  const ip = primeiro || h.get('x-real-ip')?.trim() || 'desconhecido'
  return ip.slice(0, 64)
}

async function contarDesde(admin: Admin, coluna: 'email' | 'ip', valor: string, desde: string): Promise<number | null> {
  const { count, error } = await admin
    .from('obras_portal_codigo')
    .select('*', { count: 'exact', head: true })
    .eq(coluna, valor)
    .gte('criado_em', desde)
  if (error || typeof count !== 'number') return null
  return count
}

/** true só quando as duas contagens leram e estão abaixo do teto. */
export async function dentroDosLimites(admin: Admin, email: string, ip: string, agora: Date): Promise<boolean> {
  const desde = new Date(agora.getTime() - 60 * 60_000).toISOString()
  const [porEmail, porIp] = await Promise.all([
    contarDesde(admin, 'email', email, desde),
    contarDesde(admin, 'ip', ip, desde),
  ])
  if (porEmail === null || porIp === null) return false
  return porEmail < CODIGOS_POR_HORA_EMAIL && porIp < CODIGOS_POR_HORA_IP
}
