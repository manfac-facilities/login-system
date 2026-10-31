/**
 * Limites do portal (spec Leva 5 §3.1). Os limites por hora (5 códigos por e-mail,
 * 20 por IP) são aplicados atomicamente na função SQL `obras_portal_emitir_codigo`.
 */

export const CODIGO_VALIDADE_MIN = 10
export const CODIGO_MAX_TENTATIVAS = 5

/**
 * IP do cliente: ÚLTIMO salto do x-forwarded-for — o que o Traefik do EasyPanel acrescenta com
 * o par real da conexão (os anteriores vêm do cliente e são forjáveis). Senão x-real-ip.
 * Sem nenhum dos dois → null (quem chama decide o balde; nunca um balde global).
 */
export function ipDoCliente(h: { get(nome: string): string | null }): string | null {
  const ultimo = (h.get('x-forwarded-for') ?? '').split(',').map((p) => p.trim()).filter(Boolean).pop()
  const ip = ultimo || h.get('x-real-ip')?.trim() || ''
  return ip ? ip.slice(0, 64) : null
}
