/**
 * Monta e renderiza a prancha A3 de uma revisão (Leva 6b §2.9), só no servidor.
 * Usado pela rota `faseamento/[revisaoId]/pdf` e pelo envio ao cliente.
 *
 * - Emitida: base (planta_path/largura/altura) e fase (fase_nome/fase_numero)
 *   da PRÓPRIA revisão, congeladas na emissão; data = emitida_em; trava = o
 *   retrato `trava_snapshot`.
 * - Rascunho: planta atual do mapa e nome atual da fase; sem data (a prancha
 *   sai com a marca RASCUNHO).
 * - Planta por URL assinada curta, gerada aqui com o cliente da sessão (igual ao mapa).
 *
 * Não confere permissão: quem chama já conferiu a sessão; as leituras são pela
 * sessão (RLS `obras_has_access`).
 */
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { registrarFontes } from '../../_pdf/base'
import { camadasSchema, regrasSchema } from './_lib/camadas'
import { PranchaFaseamento, type DadosPrancha } from './_lib/prancha-pdf'
import { textoDaTrava, type TravaSnapshot } from './_lib/trava'
import { carimboDe } from './_regras'

export const VALIDADE_URL_S = 600
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const TRAVA_NO_RASCUNHO = 'Regra de trava ligada: o status da atividade-trava é gravado na emissão.'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type PranchaCarregada =
  | { ok: true; dados: DadosPrancha; nomeArquivo: string; revisao: Linha; obra: Linha }
  | { ok: false; status: number; erro: string }

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40) || 'obra'

/** URL assinada curta da planta (ou null: quadro branco). */
export async function assinarPlanta(supabase: SupabaseClient, path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  const { data } = await supabase.storage.from('obras-fotos').createSignedUrl(path, VALIDADE_URL_S)
  return data?.signedUrl ?? null
}

export async function carregarPrancha(supabase: SupabaseClient, obraId: string, revisaoId: string): Promise<PranchaCarregada> {
  if (!UUID.test(obraId ?? '') || !UUID.test(revisaoId ?? '')) return { ok: false, status: 404, erro: 'Revisão não encontrada' }
  const [oR, rR] = await Promise.all([
    supabase.from('obras_obra').select('id, os, loja, descricao, cliente, modalidade').eq('id', obraId).maybeSingle(),
    supabase.from('obras_fase_revisao').select('*').eq('id', revisaoId).eq('obra_id', obraId).maybeSingle(),
  ])
  if (oR.error || rR.error) return { ok: false, status: 500, erro: 'Não deu para ler a revisão. Tente de novo.' }
  const obra = oR.data as Linha | null
  const rev = rR.data as Linha | null
  if (!obra || obra.modalidade !== 'obra' || !rev) return { ok: false, status: 404, erro: 'Revisão não encontrada' }

  const emitida = rev.status === 'emitida'
  let fase: { numero: number; nome: string }
  let base: { path: string | null; largura: number | null; altura: number | null }
  if (emitida) {
    fase = { numero: Number(rev.fase_numero), nome: String(rev.fase_nome ?? '') }
    base = { path: rev.planta_path ?? null, largura: rev.planta_largura ?? null, altura: rev.planta_altura ?? null }
  } else {
    const [fR, mR] = await Promise.all([
      supabase.from('obras_fase').select('numero, nome').eq('id', rev.fase_id).maybeSingle(),
      supabase.from('obras_mapa').select('planta_path, planta_largura, planta_altura').eq('obra_id', obraId).maybeSingle(),
    ])
    if (fR.error || !fR.data) return { ok: false, status: 404, erro: 'Fase não encontrada' }
    fase = { numero: Number((fR.data as Linha).numero), nome: String((fR.data as Linha).nome) }
    // Mapa ilegível (leva6 ausente) = obra sem planta: quadro branco.
    const m = (mR.error ? null : mR.data) as Linha | null
    base = { path: m?.planta_path ?? null, largura: m?.planta_largura ?? null, altura: m?.planta_altura ?? null }
  }

  const plantaUrl = await assinarPlanta(supabase, base.path)
  const temDim = !!(base.largura && base.altura)
  const camadas = camadasSchema.safeParse(rev.camadas)
  const regras = regrasSchema.safeParse(rev.regras ?? [])
  const nomeObra = String(obra.loja ?? obra.descricao ?? obra.os ?? 'Obra').trim() || 'Obra'

  const dados: DadosPrancha = {
    obra: { nome: nomeObra, os: String(obra.os ?? '—') },
    fase,
    revisao: { revisao: Number(rev.revisao), emitidaEm: emitida ? String(rev.emitida_em) : null },
    camadas: camadas.success ? camadas.data : [],
    regras: regras.success ? regras.data : [],
    carimbo: carimboDe(rev.carimbo, fase.numero, obra.cliente),
    travaTexto: emitida ? textoDaTrava((rev.trava_snapshot ?? null) as TravaSnapshot | null) : rev.usa_trava ? TRAVA_NO_RASCUNHO : null,
    plantaUrl: plantaUrl && temDim ? plantaUrl : null,
    planta: plantaUrl && temDim ? { largura: Number(base.largura), altura: Number(base.altura) } : null,
  }
  const nomeArquivo = `faseamento-${slug(nomeObra)}-fase${fase.numero}-R${dados.revisao.revisao}${emitida ? '' : '-rascunho'}.pdf`
  return { ok: true, dados, nomeArquivo, revisao: rev, obra }
}

export async function renderizarPrancha(d: DadosPrancha): Promise<Buffer> {
  registrarFontes()
  return renderToBuffer(createElement(PranchaFaseamento, d) as unknown as Parameters<typeof renderToBuffer>[0])
}
