/**
 * Leitura do mapa de obra (Leva 6): mapa, ambientes, pontos, vínculos
 * ambiente x atividade e fotos ligadas. Só lê; não grava.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { FotoMapa, PontoMapa, VinculoAmbienteAtividade } from './mapa'

export type ModoMapa = 'planta' | 'croqui' | 'ambientes'

export type MapaInfo = {
  modo: ModoMapa
  plantaPath: string | null
  plantaLargura: number | null
  plantaAltura: number | null
}

export type AmbienteMapa = {
  id: string
  nome: string
  areaM2: number | null
  /** Retângulo relativo 0-1; null no modo ambientes ou enquanto não desenhado. */
  x: number | null
  y: number | null
  w: number | null
  h: number | null
  ordem: number
}

export type MapaDaObra = {
  mapa: MapaInfo
  /** false = a obra nunca configurou o mapa (usa o padrão: modo ambientes, sem planta). */
  configurado: boolean
  ambientes: AmbienteMapa[]
  /** Todos os pontos (ativos e inativos), por número; `ativo` diz qual é qual. */
  pontos: PontoMapa[]
  vinculos: VinculoAmbienteAtividade[]
}

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const numOuNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v))
const MODOS: ModoMapa[] = ['planta', 'croqui', 'ambientes']

export const ambienteDe = (a: Linha): AmbienteMapa => ({
  id: a.id,
  nome: a.nome,
  areaM2: numOuNull(a.area_m2),
  x: numOuNull(a.x), y: numOuNull(a.y), w: numOuNull(a.w), h: numOuNull(a.h),
  ordem: Number(a.ordem ?? 0),
})

export const pontoDe = (p: Linha): PontoMapa => ({
  id: p.id,
  numero: Number(p.numero),
  nome: p.nome,
  ambienteId: p.ambiente_id,
  x: numOuNull(p.x),
  y: numOuNull(p.y),
  ativo: p.ativo !== false,
})

/** Parte pura: linhas do banco -> mapa. Ambientes por `ordem` (desempate pelo nome), pontos por `numero`. */
export function montarMapa(rows: {
  mapa: Linha | null
  ambientes: Linha[]
  pontos: Linha[]
  vinculos: Linha[]
}): MapaDaObra {
  const m = rows.mapa
  const ids = new Set(rows.ambientes.map((a) => a.id as string))
  return {
    configurado: !!m,
    mapa: {
      modo: m && MODOS.includes(m.modo) ? m.modo : 'ambientes',
      plantaPath: m?.planta_path ?? null,
      plantaLargura: numOuNull(m?.planta_largura),
      plantaAltura: numOuNull(m?.planta_altura),
    },
    ambientes: rows.ambientes
      .map(ambienteDe)
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR')),
    pontos: rows.pontos.map(pontoDe).sort((a, b) => a.numero - b.numero),
    // vínculo de ambiente que não veio na leitura (corrida) não entra
    vinculos: rows.vinculos
      .filter((v) => ids.has(v.ambiente_id))
      .map((v) => ({ ambienteId: v.ambiente_id as string, atividadeNumero: Number(v.atividade_numero) })),
  }
}

export async function lerMapa(
  supabase: SupabaseClient,
  obraId: string,
): Promise<{ ok: true; dados: MapaDaObra } | { ok: false; erro: string }> {
  const [mapaR, ambR, ptR] = await Promise.all([
    supabase.from('obras_mapa').select('*').eq('obra_id', obraId).maybeSingle(),
    supabase.from('obras_ambiente').select('*').eq('obra_id', obraId).order('ordem'),
    supabase.from('obras_ponto_foto').select('*').eq('obra_id', obraId).order('numero'),
  ])
  const falha = [mapaR, ambR, ptR].find((r) => r.error)
  if (falha) return { ok: false, erro: `Falha ao ler o mapa: ${falha.error!.message}` }
  const ambientes = (ambR.data ?? []) as Linha[]
  let vinculos: Linha[] = []
  if (ambientes.length) {
    const vR = await supabase
      .from('obras_ambiente_atividade').select('ambiente_id, atividade_numero')
      .in('ambiente_id', ambientes.map((a) => a.id))
    if (vR.error) return { ok: false, erro: `Falha ao ler o mapa: ${vR.error.message}` }
    vinculos = (vR.data ?? []) as Linha[]
  }
  return {
    ok: true,
    dados: montarMapa({
      mapa: (mapaR.data ?? null) as Linha | null,
      ambientes,
      pontos: (ptR.data ?? []) as Linha[],
      vinculos,
    }),
  }
}

/** Linha de `obras_rdo_foto` (com `obras_rdo` embutido) -> foto do mapa. */
export const fotoMapaDe = (f: Linha): FotoMapa => {
  const rdo = (Array.isArray(f.obras_rdo) ? f.obras_rdo[0] : f.obras_rdo) as Linha | null
  return {
    id: f.id,
    rdoId: f.rdo_id,
    path: f.path,
    legenda: f.legenda ?? null,
    ordem: Number(f.ordem ?? 0),
    data: rdo?.data ?? '',
    estado: rdo?.estado ?? '',
    ambienteId: f.ambiente_id ?? null,
    pontoId: f.ponto_id ?? null,
    atividadeNumero: numOuNull(f.atividade_numero),
  }
}

/**
 * Fotos da obra ligadas a ambiente ou ponto (ou só as do ponto), com a data e o
 * estado do RDO. Devolve TODOS os estados: o portal do cliente filtra
 * validado/enviado por conta própria (rascunho nunca vai ao cliente).
 */
export async function lerFotosDoMapa(
  supabase: SupabaseClient,
  obraId: string,
  opcoes: { pontoId?: string } = {},
): Promise<{ ok: true; fotos: FotoMapa[] } | { ok: false; erro: string }> {
  let q = supabase
    .from('obras_rdo_foto')
    .select('id, rdo_id, path, legenda, ordem, ambiente_id, ponto_id, atividade_numero, obras_rdo!inner(data, estado, obra_id)')
    .eq('obras_rdo.obra_id', obraId)
  q = opcoes.pontoId ? q.eq('ponto_id', opcoes.pontoId) : q.or('ambiente_id.not.is.null,ponto_id.not.is.null')
  const { data, error } = await q
  if (error) return { ok: false, erro: `Falha ao ler as fotos do mapa: ${error.message}` }
  return { ok: true, fotos: ((data ?? []) as Linha[]).map(fotoMapaDe) }
}
