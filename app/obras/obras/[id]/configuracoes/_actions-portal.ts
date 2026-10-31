'use server'

/**
 * Server Actions da página do cliente (Leva 5 §3.1): acesso por e-mail (SÓ
 * administrador) e documentos da obra (engenheiro da obra ou administrador).
 *
 * Tudo grava com o cliente de SESSÃO (nunca o admin): a RLS, os triggers de
 * guarda e a autoria forçada (criado_por vem do JWT) valem. Sem `export type`
 * nem export não-async aqui — o arquivo é `use server`.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import {
  BUCKET_DOCS,
  VALIDADE_URL_DOC_S,
  nomeSaneado,
  pastaValida,
  pathDocValido,
  validarArquivoDoc,
} from '../../_lib/documentos'
import { emailInterno, validarEmailAcesso } from '../../_lib/portal-email'
import type { DocumentoEntrada, Resultado } from './_tipos-portal'

type Erro = { ok: false; erro: string }
const falha = (erro: string): Erro => ({ ok: false, erro })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function sessao(): Promise<{ supabase: SupabaseClient; email: string; admin: boolean } | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha('Não autenticado')
  return { supabase, email, admin: await isAdmin(supabase, email) }
}

async function autorizarAdmin() {
  const s = await sessao()
  if ('ok' in s) return s
  if (!s.admin) return falha('Só administrador altera o acesso à página do cliente')
  return s
}

/** Engenheiro responsável da obra ou administrador (falha fechada). */
async function autorizarDocumentos(obraId: string) {
  const s = await sessao()
  if ('ok' in s) return s
  if (!UUID.test(obraId ?? '')) return falha('Obra não encontrada')
  if (s.admin) return s
  const { data, error } = await s.supabase.from('obras_obra').select('engenheiro_email').eq('id', obraId).maybeSingle()
  if (error) return falha('Não foi possível conferir a obra. Tente de novo.')
  const eng = String((data as { engenheiro_email?: string | null } | null)?.engenheiro_email ?? '').trim().toLowerCase()
  if (!eng || eng !== s.email) return falha('Só o engenheiro responsável da obra ou um administrador mexe nos documentos')
  return s
}

function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.code === '23505') return falha('Este e-mail já tem acesso a esta obra')
  if (e.code === '42501' || e.message.includes('row-level security')) return falha('Você não tem permissão para isso.')
  if (e.code === '23514') return falha('Dados inválidos.')
  return falha(`Não foi possível ${acao}. Tente de novo em instantes.`)
}

const rev = (obraId: string) => {
  revalidatePath(`/obras/obras/${obraId}/configuracoes`)
  revalidatePath(`/obras/obras/${obraId}/comunicacao`)
}

// ---------------------------------------------------------------- acesso

export async function adicionarAcessoAction(obraId: string, entrada: { email: string; nome?: string | null }): Promise<Resultado> {
  const s = await autorizarAdmin()
  if ('ok' in s) return s
  const v = validarEmailAcesso(entrada?.email)
  if (v.erro !== null) return falha(v.erro)
  const nome = String(entrada?.nome ?? '').trim() || null
  const { error } = await s.supabase.from('obras_portal_acesso').insert({ obra_id: obraId, email: v.email, nome, ativo: true })
  if (error) return erroBanco('dar o acesso', error)
  rev(obraId)
  return { ok: true }
}

export async function alternarAcessoAction(obraId: string, acessoId: string, ativo: boolean): Promise<Resultado> {
  const s = await autorizarAdmin()
  if ('ok' in s) return s
  const { error } = await s.supabase.from('obras_portal_acesso').update({ ativo: ativo === true }).eq('id', acessoId).eq('obra_id', obraId)
  if (error) return erroBanco('alterar o acesso', error)
  rev(obraId)
  return { ok: true }
}

export async function removerAcessoAction(obraId: string, acessoId: string): Promise<Resultado> {
  const s = await autorizarAdmin()
  if ('ok' in s) return s
  const { error } = await s.supabase.from('obras_portal_acesso').delete().eq('id', acessoId).eq('obra_id', obraId)
  if (error) return erroBanco('remover o acesso', error)
  rev(obraId)
  return { ok: true }
}

/** Atalho: dá acesso a quem já é destinatário ativo do lado cliente (pula @manfac e quem já tem). */
export async function trazerDestinatariosClienteAction(obraId: string): Promise<Resultado & { adicionados?: number }> {
  const s = await autorizarAdmin()
  if ('ok' in s) return s
  const [dR, aR] = await Promise.all([
    s.supabase.from('obras_destinatario').select('email, nome').eq('obra_id', obraId).eq('lado', 'cliente').eq('ativo', true),
    s.supabase.from('obras_portal_acesso').select('email').eq('obra_id', obraId),
  ])
  if (dR.error) return erroBanco('ler os destinatários', dR.error)
  if (aR.error) return erroBanco('ler os acessos', aR.error)
  const jaTem = new Set(((aR.data ?? []) as { email: string }[]).map((a) => a.email.trim().toLowerCase()))
  const novos = new Map<string, string | null>()
  for (const d of (dR.data ?? []) as { email: string; nome: string | null }[]) {
    const v = validarEmailAcesso(d.email)
    if (v.erro !== null || emailInterno(v.email) || jaTem.has(v.email)) continue
    novos.set(v.email, d.nome ?? null)
  }
  let adicionados = 0
  for (const [email, nome] of novos) {
    const { error } = await s.supabase.from('obras_portal_acesso').insert({ obra_id: obraId, email, nome, ativo: true })
    if (error) return erroBanco('dar o acesso', error)
    adicionados++
  }
  rev(obraId)
  return { ok: true, adicionados }
}

// ------------------------------------------------------------ documentos

/**
 * Registra o documento DEPOIS de o navegador subir o arquivo para `obras-docs`
 * (mesma ordem das fotos do diário). Se o registro for recusado, o objeto é removido.
 */
export async function registrarDocumentoAction(obraId: string, d: DocumentoEntrada): Promise<Resultado> {
  const s = await autorizarDocumentos(obraId)
  if ('ok' in s) return s
  const limpar = async () => {
    if (typeof d?.path === 'string' && pathDocValido(obraId, d.path)) {
      await s.supabase.storage.from(BUCKET_DOCS).remove([d.path])
    }
  }
  if (!pastaValida(d?.pasta)) {
    await limpar()
    return falha('Pasta inválida')
  }
  const nome = nomeSaneado(String(d.nome ?? ''))
  const invalido = validarArquivoDoc({ nome, tamanho: Number(d.tamanho) })
  if (invalido) {
    await limpar()
    return falha(invalido)
  }
  if (!pathDocValido(obraId, d.path)) return falha('Caminho do arquivo inválido')
  const { error } = await s.supabase.from('obras_documento').insert({
    obra_id: obraId,
    pasta: d.pasta,
    nome,
    path: d.path,
    tamanho: Number(d.tamanho),
    tipo: String(d.tipo ?? '').slice(0, 100) || null,
  })
  if (error) {
    await limpar()
    return erroBanco('registrar o documento', error)
  }
  rev(obraId)
  return { ok: true }
}

/** Apaga o objeto do bucket e, só então, a linha (se o objeto não sai, a linha fica para nova tentativa). */
export async function apagarDocumentoAction(obraId: string, docId: string): Promise<Resultado> {
  const s = await autorizarDocumentos(obraId)
  if ('ok' in s) return s
  const { data, error } = await s.supabase.from('obras_documento').select('id, path').eq('id', docId).eq('obra_id', obraId).maybeSingle()
  if (error) return erroBanco('ler o documento', error)
  const doc = data as { id: string; path: string } | null
  if (!doc) return falha('Documento não encontrado')
  const { error: eS } = await s.supabase.storage.from(BUCKET_DOCS).remove([doc.path])
  if (eS) return falha('Não foi possível apagar o arquivo. Tente de novo.')
  const { error: eD } = await s.supabase.from('obras_documento').delete().eq('id', docId).eq('obra_id', obraId)
  if (eD) return erroBanco('apagar o documento', eD)
  rev(obraId)
  return { ok: true }
}

/** Link de download de 60 s (a RLS do storage confere o acesso ao Obras). */
export async function urlDocumentoAction(obraId: string, docId: string): Promise<Resultado & { url?: string }> {
  const s = await sessao()
  if ('ok' in s) return s
  const { data, error } = await s.supabase.from('obras_documento').select('path, nome').eq('id', docId).eq('obra_id', obraId).maybeSingle()
  if (error) return erroBanco('ler o documento', error)
  const doc = data as { path: string; nome: string } | null
  if (!doc) return falha('Documento não encontrado')
  const { data: url, error: eU } = await s.supabase.storage
    .from(BUCKET_DOCS)
    .createSignedUrl(doc.path, VALIDADE_URL_DOC_S, { download: doc.nome })
  if (eU || !url?.signedUrl) return falha('Não foi possível gerar o link. Tente de novo.')
  return { ok: true, url: url.signedUrl }
}
