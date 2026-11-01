/**
 * Link "Ver a obra completa" dos e-mails do LADO CLIENTE (Leva 5 §3.2): leva à
 * página do cliente (`/portal-obra`). A base é a mesma configuração pública que
 * o hub já usa (`NEXT_PUBLIC_SITE_URL`); sem ela, o e-mail sai sem o link.
 * A versão interna nunca recebe o link.
 */
import { esc } from './conteudo-valido'

export function linkPortalObra(base: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string | null {
  const b = (base ?? '').trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s/]+/i.test(b)) return null
  return `${b}/portal-obra`
}

/** Só devolve o link para o lado cliente. */
export const linkDoLado = (lado: 'cliente' | 'interno', link: string | null | undefined): string | null =>
  lado === 'cliente' && link ? link : null

export const ROTULO_LINK_OBRA = 'Ver a obra completa'

/** Linha de tabela de e-mail com o botão (antes do rodapé). Vazia sem link. */
export const htmlLinkObra = (link: string | null | undefined): string =>
  link
    ? `<tr><td style="padding:12px 20px;border-top:1px solid #e2e8f0"><a href="${esc(link)}" style="display:inline-block;background:#f05a28;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:6px">${ROTULO_LINK_OBRA}</a></td></tr>\n`
    : ''

/** Linhas de texto plano (começa com linha em branco). Vazio sem link. */
export const textoLinkObra = (link: string | null | undefined): string[] =>
  link ? ['', `${ROTULO_LINK_OBRA}: ${link}`] : []
