/**
 * Lê do banco o que o relatório semanal precisa (Leva 3 §2.3): obra na data de
 * referência (a sexta, ou hoje se a semana não acabou), plano da semana e da
 * próxima, restrições, linha de `obras_semanal` e fotos dos diários validados
 * da semana. Rascunho: montado na hora. Validado/enviado: sai do conteúdo
 * congelado na validação (`obras_semanal.conteudo`: cliente, interno e os
 * caminhos das fotos), para o reenvio e o "Abrir PDF" serem o que foi validado.
 *
 * Quem chama já conferiu a sessão e o acesso. Leituras pelo cliente da sessão
 * (RLS vale); só o download das fotos usa a service role, restrito ao caminho
 * canônico desta obra (`<obra>/rdo/<data>/`).
 */
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { montarConteudoSemanal, type ConteudoSemanal, type Lado } from '../_lib/email-semanal'
import { diasDaSemana, segundaDaSemana, type PlanoSemana, type Restricao } from '../_lib/last-planner'
import { lerObraGrande, lerPlano, lerRestricoes, type ObraGrande } from '../_lib/leitura'
import { segundaValida, somarDias } from '../[id]/lookahead/_plano-tipos'
import { logoManfac, registrarFontes } from './base'
import { DocumentoSemanal, montarDadosPdfSemanal, type DadosPdfSemanal, type FotoSemanalPdf } from './semanal'

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export const MAX_FOTOS_SEMANAL = 8
export const MAX_BYTES_FOTO_SEMANAL = 1_500_000

export type EstadoSemanal = 'rascunho' | 'validado' | 'enviado'
/** Foto escolhida na validação; o arquivo é baixado de novo (write-once em /rdo/). */
export type FotoSemanalRef = { path: string; legenda: string | null; data: string }
/** O que fica gravado em `obras_semanal.conteudo` na validação (imutável depois). */
export type ConteudoCongelado = { cliente: ConteudoSemanal; interno: ConteudoSemanal; fotos: FotoSemanalRef[] }
export type SemanalRow = {
  id: string
  estado: EstadoSemanal
  observacoes: string | null
  conteudo: ConteudoCongelado | null
  validadoPor: string | null
  validadoEm: string | null
}

export type DadosSemanal = {
  og: ObraGrande
  segunda: string
  sexta: string
  ref: string
  hoje: string
  plano: PlanoSemana | null
  planoProximo: PlanoSemana | null
  restricoes: Restricao[]
  semanal: SemanalRow | null
}

type Falha = { ok: false; status: 404 | 500; erro: string }

/** Semana do relatório: segunda válida e não futura. Data de referência = min(sexta, hoje). */
export function semanaDoRelatorio(segunda: string, hoje: string): { ok: true; sexta: string; ref: string } | { ok: false; erro: string } {
  if (!segundaValida(segunda)) return { ok: false, erro: 'Semana inválida' }
  if (segunda > segundaDaSemana(hoje)) return { ok: false, erro: 'Esta semana ainda não começou' }
  const sexta = diasDaSemana(segunda)[4]
  return { ok: true, sexta, ref: sexta < hoje ? sexta : hoje }
}

function congeladoDe(v: unknown): ConteudoCongelado | null {
  const c = v as Partial<ConteudoCongelado> | null
  if (!c || typeof c !== 'object' || c.cliente?.lado !== 'cliente' || c.interno?.lado !== 'interno' || !Array.isArray(c.fotos)) return null
  return c as ConteudoCongelado
}

export const semanalRowDe = (s: Linha): SemanalRow => ({
  id: String(s.id),
  estado: s.estado,
  observacoes: s.observacoes ?? null,
  conteudo: congeladoDe(s.conteudo),
  validadoPor: s.validado_por ?? null,
  validadoEm: s.validado_em ?? null,
})

/** `og` opcional: a página passa a leitura já memorizada quando a referência é hoje. */
export async function lerDadosSemanal(
  supabase: SupabaseClient,
  obraId: string,
  segunda: string,
  hoje: string,
  og?: ObraGrande,
): Promise<{ ok: true; dados: DadosSemanal } | Falha> {
  const s = semanaDoRelatorio(segunda, hoje)
  if (!s.ok) return { ok: false, status: 404, erro: s.erro }
  let obra = og
  if (!obra) {
    const lida = await lerObraGrande(supabase, obraId, s.ref)
    if (!lida.ok) return { ok: false, status: 404, erro: lida.erro }
    obra = lida.dados
  }
  if (obra.obra.modalidade !== 'obra') return { ok: false, status: 404, erro: 'Obra não encontrada' }

  const [pR, pxR, rR, sR] = await Promise.all([
    lerPlano(supabase, obraId, segunda),
    lerPlano(supabase, obraId, somarDias(segunda, 7)),
    lerRestricoes(supabase, obraId),
    supabase.from('obras_semanal').select('*').eq('obra_id', obraId).eq('semana_inicio', segunda).maybeSingle(),
  ])
  if (!pR.ok || !pxR.ok || !rR.ok || sR.error) return { ok: false, status: 500, erro: 'Não deu para ler os dados da semana' }
  return {
    ok: true,
    dados: {
      og: obra, segunda, sexta: s.sexta, ref: s.ref, hoje,
      plano: pR.plano, planoProximo: pxR.plano, restricoes: rR.restricoes,
      semanal: sR.data ? semanalRowDe(sR.data as Linha) : null,
    },
  }
}

/** Validado/enviado com conteúdo congelado: o congelado. Rascunho: montado agora dos dados lidos. */
export const conteudoSemanalDe = (d: DadosSemanal, lado: Lado): ConteudoSemanal =>
  (d.semanal && d.semanal.estado !== 'rascunho' && d.semanal.conteudo?.[lado]) ||
  montarConteudoSemanal({
    lado, obra: d.og, segunda: d.segunda, ref: d.ref, hoje: d.hoje,
    plano: d.plano, planoProximo: d.planoProximo, restricoes: d.restricoes, observacoes: d.semanal?.observacoes ?? null,
  })

/** JPEG ou PNG pelo cabeçalho; outro formato o react-pdf não desenha. */
function formatoDe(b: Buffer): FotoSemanalPdf['formato'] | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b.length > 8 && b.readUInt32BE(0) === 0x89504e47) return 'png'
  return null
}

/** Até 8 fotos dos diários validados/enviados da semana (só os caminhos; o download é em `baixarFotosSemanal`). */
export async function escolherFotosDaSemana(supabase: SupabaseClient, obraId: string, segunda: string): Promise<FotoSemanalRef[]> {
  const sexta = diasDaSemana(segunda)[4]
  const { data: rdos, error } = await supabase
    .from('obras_rdo')
    .select('id, data, estado')
    .eq('obra_id', obraId)
    .gte('data', segunda)
    .lte('data', sexta)
  const validos = ((rdos ?? []) as Linha[]).filter((r) => r.estado === 'validado' || r.estado === 'enviado')
  if (error || !validos.length) return []
  const dataDe = new Map(validos.map((r) => [String(r.id), String(r.data)]))
  const { data: linhas, error: errF } = await supabase
    .from('obras_rdo_foto')
    .select('*')
    .in('rdo_id', [...dataDe.keys()])
    .order('ordem')
  if (errF) return []
  return ((linhas ?? []) as Linha[])
    .filter((f) => dataDe.has(String(f.rdo_id)))
    .sort((a, b) => dataDe.get(String(a.rdo_id))!.localeCompare(dataDe.get(String(b.rdo_id))!) || Number(a.ordem ?? 0) - Number(b.ordem ?? 0))
    .slice(0, MAX_FOTOS_SEMANAL)
    .map((f) => ({ path: String(f.path ?? ''), legenda: (f.legenda as string | null) ?? null, data: dataDe.get(String(f.rdo_id))! }))
}

/** Baixa as fotos escolhidas, só do caminho canônico desta obra (`<obra>/rdo/<data>/`). */
export async function baixarFotosSemanal(obraId: string, refs: FotoSemanalRef[]): Promise<{ fotos: FotoSemanalPdf[]; omitidas: number }> {
  const fotos: FotoSemanalPdf[] = []
  let omitidas = 0
  if (!refs.length) return { fotos, omitidas }
  const bucket = createAdminClient().storage.from('obras-fotos')
  for (const { path, legenda, data } of refs.slice(0, MAX_FOTOS_SEMANAL)) {
    const valido = path.startsWith(`${obraId}/rdo/${data}/`) && !path.split('/').includes('..')
    const { data: blob, error: e } = valido ? await bucket.download(path) : { data: null, error: null }
    const dados = blob && !e ? Buffer.from(await blob.arrayBuffer()) : null
    const formato = dados && dados.length <= MAX_BYTES_FOTO_SEMANAL ? formatoDe(dados) : null
    if (!dados || !formato) {
      console.warn(`[pdf-semanal] foto omitida ${path}: ${e?.message ?? `${dados?.length ?? 0} bytes`}`)
      omitidas++
      continue
    }
    fotos.push({ dados, formato, legenda, data })
  }
  return { fotos, omitidas }
}

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'obra'

/** Dados do PDF (lado cliente) a partir da leitura da semana. */
export async function dadosPdfSemanal(
  supabase: SupabaseClient,
  d: DadosSemanal,
  agora: Date = new Date(),
): Promise<{ dados: DadosPdfSemanal; nomeArquivo: string }> {
  const refs = (d.semanal?.estado !== 'rascunho' && d.semanal?.conteudo?.fotos) || (await escolherFotosDaSemana(supabase, d.og.obra.id, d.segunda))
  const { fotos, omitidas } = await baixarFotosSemanal(d.og.obra.id, refs)
  const conteudo = conteudoSemanalDe(d, 'cliente')
  const dados = montarDadosPdfSemanal({
    conteudo,
    os: d.og.obra.os ?? null,
    cliente: d.og.obra.cliente ?? null,
    engenheiro: d.og.obra.engenheiro_email ?? null,
    validadoEm: d.semanal?.validadoEm ?? null,
    fotos,
    fotosOmitidas: omitidas,
    geradoEm: agora.toISOString(),
    logo: logoManfac(),
  })
  return { dados, nomeArquivo: `semanal-${slug(conteudo.loja)}-${d.segunda}.pdf` }
}

/** Conteúdo a congelar na validação (`d` lido em rascunho): as duas versões e as fotos escolhidas agora. */
export async function congelarSemanal(supabase: SupabaseClient, d: DadosSemanal): Promise<ConteudoCongelado> {
  return {
    cliente: conteudoSemanalDe(d, 'cliente'),
    interno: conteudoSemanalDe(d, 'interno'),
    fotos: await escolherFotosDaSemana(supabase, d.og.obra.id, d.segunda),
  }
}

/** PDF de um semanal validado/enviado (rascunho nunca vira PDF). */
export async function carregarPdfSemanal(
  supabase: SupabaseClient,
  obraId: string,
  segunda: string,
  hoje: string,
  agora: Date = new Date(),
): Promise<{ ok: true; dados: DadosPdfSemanal; nomeArquivo: string } | Falha> {
  const l = await lerDadosSemanal(supabase, obraId, segunda, hoje)
  if (!l.ok) return l
  const e = l.dados.semanal?.estado
  if (e !== 'validado' && e !== 'enviado') return { ok: false, status: 404, erro: 'Relatório semanal não validado' }
  return { ok: true, ...(await dadosPdfSemanal(supabase, l.dados, agora)) }
}

export async function renderizarSemanal(d: DadosPdfSemanal): Promise<Buffer> {
  registrarFontes()
  return renderToBuffer(createElement(DocumentoSemanal, { d }) as Parameters<typeof renderToBuffer>[0])
}
