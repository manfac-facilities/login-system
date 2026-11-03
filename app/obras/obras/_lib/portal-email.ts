/**
 * E-mail de acesso à página do cliente (Leva 5): interno (@manfac.com.br e
 * subdomínios, com ou sem ponto final de FQDN) usa o hub, nunca o portal.
 * Espelha o check do banco (obras_portal_acesso_email_check).
 */
export const MSG_EMAIL_MANFAC = 'E-mail da Manfac entra pelo hub, não pela página do cliente'

export function emailInterno(email: string): boolean {
  const e = email.trim().toLowerCase().replace(/\.+$/, '')
  return e.endsWith('@manfac.com.br') || e.endsWith('.manfac.com.br')
}

/** Erro em português ou null; devolve o e-mail normalizado em `email`. */
export function validarEmailAcesso(bruto: unknown): { email: string; erro: null } | { email: null; erro: string } {
  const email = String(bruto ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[\x21-\x7e]+$/.test(email) || email.length > 254) {
    return { email: null, erro: 'E-mail inválido' }
  }
  if (emailInterno(email)) return { email: null, erro: MSG_EMAIL_MANFAC }
  return { email, erro: null }
}
