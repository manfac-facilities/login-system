/**
 * Segredo do portal do cliente (HMAC-SHA256 dos códigos e dos tokens de sessão).
 * Território de autenticação: sem `PORTAL_OBRA_SEGREDO` (ou curto demais) o portal
 * falha FECHADO — não emite código nem sessão. Nunca logar o segredo, código ou token.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const TAMANHO_MINIMO = 32

export function segredoPortal(): string | null {
  const s = process.env.PORTAL_OBRA_SEGREDO?.trim() ?? ''
  if (s.length < TAMANHO_MINIMO) {
    console.error(`[portal-obra] PORTAL_OBRA_SEGREDO ausente ou com menos de ${TAMANHO_MINIMO} caracteres; portal recusando entrada`)
    return null
  }
  return s
}

/** HMAC em hex; o propósito separa o espaço dos códigos do espaço dos tokens. */
export function hmacHex(segredo: string, proposito: 'codigo' | 'sessao', valor: string): string {
  return createHmac('sha256', segredo).update(`${proposito}\n${valor}`).digest('hex')
}

/** Comparação em tempo constante de dois hashes hex. Qualquer coisa fora do formato → false. */
export function hashesIguais(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
}
