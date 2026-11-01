/**
 * Mensagens e documentos do portal do cliente (Leva 5 §3.2). Cliente admin, sempre
 * filtrado pelo id de obra que a guarda já autorizou. A mensagem do cliente é gravada
 * pelo servidor: autor_tipo 'cliente' e autor_email = e-mail da SESSÃO (nunca do form).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>

export const MENSAGEM_MAX = 4000
export const MENSAGENS_POR_HORA = 30
const HORA_MS = 60 * 60_000

export type MensagemPortal = { id: string; autor: 'cliente' | 'manfac'; texto: string; criadoEm: string }
export type DocumentoPortal = { id: string; pasta: string; nome: string; tamanho: number | null; criadoEm: string }
export type ResultadoMensagem = { ok: true } | { ok: false; erro: string }

export async function lerMensagensPortal(admin: Admin, obraId: string): Promise<MensagemPortal[]> {
  const { data, error } = await admin.from('obras_mensagem').select('id, autor_tipo, texto, criado_em')
    .eq('obra_id', obraId).order('criado_em', { ascending: false }).limit(200)
  if (error) throw new Error('portal-obra: falha ao ler mensagens')
  // Mais antigas primeiro: a conversa termina na mensagem mais nova.
  return ((data ?? []) as Record<string, unknown>[]).reverse().map((m) => ({
    id: String(m.id),
    autor: m.autor_tipo === 'manfac' ? 'manfac' : 'cliente',
    texto: String(m.texto ?? ''),
    criadoEm: String(m.criado_em),
  }))
}

export async function lerDocumentosPortal(admin: Admin, obraId: string): Promise<DocumentoPortal[]> {
  const { data, error } = await admin.from('obras_documento').select('id, pasta, nome, tamanho, criado_em')
    .eq('obra_id', obraId).order('criado_em', { ascending: false })
  if (error) throw new Error('portal-obra: falha ao ler documentos')
  return ((data ?? []) as Record<string, unknown>[]).map((d) => ({
    id: String(d.id),
    pasta: String(d.pasta),
    nome: String(d.nome),
    tamanho: d.tamanho == null ? null : Number(d.tamanho),
    criadoEm: String(d.criado_em),
  }))
}

/**
 * Valida (trim, 1..4000) e aplica o limite de 30/h por e-mail contando no banco, depois grava.
 * Contar-e-gravar não é atômico: rajadas simultâneas podem passar de 30 por poucas unidades.
 */
export async function gravarMensagemCliente(
  admin: Admin,
  p: { email: string; obraId: string; texto: unknown; agora?: Date },
): Promise<ResultadoMensagem> {
  const t = typeof p.texto === 'string' ? p.texto.trim() : ''
  if (!t) return { ok: false, erro: 'Escreva a mensagem.' }
  if (t.length > MENSAGEM_MAX) return { ok: false, erro: `A mensagem passa de ${MENSAGEM_MAX} caracteres.` }
  const email = p.email.trim().toLowerCase()
  const desde = new Date((p.agora ?? new Date()).getTime() - HORA_MS).toISOString()
  const { count, error: eC } = await admin.from('obras_mensagem').select('id', { count: 'exact', head: true })
    .eq('autor_tipo', 'cliente').eq('autor_email', email).gte('criado_em', desde)
  if (eC) return { ok: false, erro: 'Não foi possível enviar agora. Tente de novo em instantes.' }
  if ((count ?? 0) >= MENSAGENS_POR_HORA) {
    return { ok: false, erro: 'Muitas mensagens em pouco tempo. Aguarde um pouco e tente de novo.' }
  }
  const { error } = await admin.from('obras_mensagem').insert({ obra_id: p.obraId, autor_tipo: 'cliente', autor_email: email, texto: t })
  if (error) return { ok: false, erro: 'Não foi possível enviar agora. Tente de novo em instantes.' }
  return { ok: true }
}
