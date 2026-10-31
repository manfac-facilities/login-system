/**
 * Sessão do portal do cliente (spec Leva 5 §3.1): token aleatório de 32 bytes no cookie,
 * só o HMAC no banco; 7 dias renovados no uso, teto de 30 dias desde a criação.
 * A sessão só vale enquanto o e-mail tiver acesso ativo em alguma obra — a cada leitura
 * o acesso é revalidado e, sem acesso, a sessão é revogada.
 * Território de autenticação: qualquer dúvida (erro de banco, formato, segredo) → null.
 */
import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashesIguais, hmacHex, segredoPortal } from './segredo'
import { obrasComAcessoAtivo } from './acesso'

export const COOKIE_SESSAO = 'portal_obra_sessao'
export const COOKIE_EMAIL = 'portal_obra_email'
export const SESSAO_DIAS = 7
export const SESSAO_TETO_DIAS = 30
/** Intervalo mínimo entre renovações gravadas (poupa escrita no banco a cada request). */
const RENOVAR_APOS_MS = 5 * 60_000
const DIA_MS = 24 * 60 * 60_000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>
export type LeitorCookies = { get(nome: string): { value: string } | undefined }
export type SessaoPortal = { email: string; obras: string[] }

export function opcoesCookiePortal(expira: Date) {
  return { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/portal-obra', expires: expira }
}

const tokenValido = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t)

/**
 * Cria a sessão e devolve o token (vai só para o cookie). O cookie expira no teto de
 * 30 dias; quem manda na validade de 7 dias renovável é o `expira_em` do banco.
 */
export async function criarSessao(admin: Admin, segredo: string, email: string, agora: Date): Promise<{ token: string; expiraCookie: Date }> {
  const token = randomBytes(32).toString('base64url')
  const { error } = await admin.from('obras_portal_sessao').insert({
    token_hash: hmacHex(segredo, 'sessao', token),
    email,
    criado_em: agora.toISOString(),
    expira_em: new Date(agora.getTime() + SESSAO_DIAS * DIA_MS).toISOString(),
    ultimo_uso: agora.toISOString(),
  })
  if (error) throw new Error('portal-obra: falha ao criar sessão')
  return { token, expiraCookie: new Date(agora.getTime() + SESSAO_TETO_DIAS * DIA_MS) }
}

async function revogar(admin: Admin, tokenHash: string, agora: Date): Promise<void> {
  await admin.from('obras_portal_sessao').update({ revogada_em: agora.toISOString() })
    .eq('token_hash', tokenHash).is('revogada_em', null)
}

export async function lerSessao(cookies: LeitorCookies, agora: Date = new Date()): Promise<SessaoPortal | null> {
  try {
    const token = cookies.get(COOKIE_SESSAO)?.value
    if (!tokenValido(token)) return null
    const segredo = segredoPortal()
    if (!segredo) return null
    const admin = createAdminClient()
    const hash = hmacHex(segredo, 'sessao', token)

    const { data, error } = await admin.from('obras_portal_sessao')
      .select('token_hash, email, criado_em, expira_em, ultimo_uso, revogada_em')
      .eq('token_hash', hash).maybeSingle()
    if (error || !data) return null
    const s = data as { token_hash: string; email: unknown; criado_em: string; expira_em: string; ultimo_uso: string | null; revogada_em: string | null }
    if (!hashesIguais(s.token_hash, hash)) return null
    if (s.revogada_em !== null && s.revogada_em !== undefined) return null
    if (typeof s.email !== 'string' || !s.email) return null

    const criado = Date.parse(s.criado_em)
    const expira = Date.parse(s.expira_em)
    const teto = criado + SESSAO_TETO_DIAS * DIA_MS
    const t = agora.getTime()
    if (!Number.isFinite(criado) || !Number.isFinite(expira)) return null
    if (t >= expira || t >= teto) return null

    // Revalida o acesso a cada leitura: sem acesso ativo, a sessão cai (e fica revogada).
    const obras = await obrasComAcessoAtivo(admin, s.email)
    if (obras.length === 0) {
      await revogar(admin, hash, agora)
      return null
    }

    const ultimo = s.ultimo_uso ? Date.parse(s.ultimo_uso) : NaN
    if (!Number.isFinite(ultimo) || t - ultimo >= RENOVAR_APOS_MS) {
      const novaExpira = Math.min(t + SESSAO_DIAS * DIA_MS, teto)
      // Falha na renovação não derruba a sessão: ela segue valendo até o expira_em atual.
      await admin.from('obras_portal_sessao')
        .update({ ultimo_uso: agora.toISOString(), expira_em: new Date(novaExpira).toISOString() })
        .eq('token_hash', hash).is('revogada_em', null)
    }
    return { email: s.email, obras }
  } catch {
    console.error('[portal-obra] erro ao ler sessão')
    return null
  }
}

/** Revoga a sessão do cookie (se houver). O cookie é apagado por quem chama. */
export async function encerrarSessao(cookies: LeitorCookies, agora: Date = new Date()): Promise<void> {
  try {
    const token = cookies.get(COOKIE_SESSAO)?.value
    if (!tokenValido(token)) return
    const segredo = segredoPortal()
    if (!segredo) return
    await revogar(createAdminClient(), hmacHex(segredo, 'sessao', token), agora)
  } catch {
    console.error('[portal-obra] erro ao encerrar sessão')
  }
}
