/**
 * Leitura consolidada da OBRA (modalidade "obra"): camada de dados única das
 * telas e do e-mail. Só lê; não grava.
 * Vigente = maior `numero` com `salva_em`; rascunho = versão sem `salva_em`;
 * base = versão 1, se salva.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ObraRow } from '../../_lib/tipos'
import type { PontoHist } from './curvas'
import {
  atrasoPorResponsavel,
  calcularCronograma,
  diasDeImpacto,
  resumirEtapas,
  sinalDaObra,
  type AtividadeExec,
  type AtividadePlano,
  type ImpedimentoCalc,
  type ResultadoCronograma,
  type ResumoEtapa,
  type Responsavel,
  type Sinal,
  type StatusAtividade,
} from './cronograma'

export type VersaoInfo = { id: string; numero: number; salvaEm: string | null; motivo: string | null }

export type ImpedimentoRow = {
  id: string
  obraId: string
  categoria: 'impedimento' | 'orientacao'
  tipo: string | null
  responsavel: Responsavel | null
  atividadeNumero: number | null
  descricao: string
  pessoaCliente: string | null
  fotoPath: string | null
  travaAtividade: boolean
  impactoDias: number | null
  exibirAoCliente: boolean
  abertoEm: string
  encerradoEm: string | null
  rdoId: string | null
  orientacaoId: string | null
  criadoPor: string | null
  criadoEm: string
}

export type ObraGrande = {
  obra: ObraRow
  versaoBase: VersaoInfo | null
  versaoVigente: VersaoInfo | null
  rascunho: VersaoInfo | null
  plano: AtividadePlano[]
  exec: AtividadeExec[]
  impedimentos: ImpedimentoRow[]
  feriados: Set<string>
  calc: ResultadoCronograma | null
  /** Cálculo da base (v1 salva); null enquanto a v1 não foi salva. */
  calcBase: ResultadoCronograma | null
  /** Linhas-resumo por etapa do cálculo vigente (vazio sem cronograma). */
  etapas: ResumoEtapa[]
  /** Histórico de % por atividade (diário e atualização de status). */
  hist: PontoHist[]
  /** Maior data do histórico ou, sem histórico, o último RDO validado; null se nada. */
  dadosAte: string | null
  terminoBase: string | null
  sinal: Sinal | null
  atraso: ReturnType<typeof atrasoPorResponsavel> | null
}

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const versaoInfo = (v: Linha): VersaoInfo => ({
  id: v.id, numero: v.numero, salvaEm: v.salva_em ?? null, motivo: v.motivo ?? null,
})

/** Linha de `obras_atividade` → plano do motor. */
export const atividadePlanoDe = (a: Linha): AtividadePlano => ({
  numero: a.numero,
  etapa: a.etapa ?? '',
  descricao: a.descricao ?? '',
  pred1: a.pred1 ?? null,
  pred2: a.pred2 ?? null,
  duracao: a.duracao,
  bloqueiaPorTrava: !!a.bloqueia_por_trava,
  pesoValor: Number(a.peso_valor ?? 0),
  inicioFixo: a.inicio_fixo ?? null,
})

/** Linha de `obras_atividade_exec` → execução do motor. */
export const atividadeExecDe = (e: Linha): AtividadeExec => ({
  numero: e.numero,
  status: e.status as StatusAtividade,
  percentual: Number(e.percentual ?? 0),
  inicioReal: e.inicio_real ?? null,
  fimReal: e.fim_real ?? null,
  diasRestantes: e.dias_restantes === null || e.dias_restantes === undefined ? null : Number(e.dias_restantes),
})

/** Impedimentos (já convertidos) → entrada do motor; orientação e sem responsável ficam de fora. */
export const impedimentosCalcDe = (impedimentos: ImpedimentoRow[]): ImpedimentoCalc[] =>
  impedimentos
    .filter((i) => i.categoria === 'impedimento' && i.responsavel)
    .map((i) => ({
      atividadeNumero: i.atividadeNumero,
      responsavel: i.responsavel as Responsavel,
      travaAtividade: i.travaAtividade,
      abertoEm: i.abertoEm,
      encerradoEm: i.encerradoEm,
      impactoDias: i.impactoDias,
    }))

/**
 * Ordem de EXIBIÇÃO das linhas de `obras_atividade` (Leva 1b): etapa por
 * `etapa_ordem` (a menor do grupo), atividade por `ordem`, desempate por
 * `numero`. Coluna nula (linha antiga) cai no `numero`; etapa sem nenhuma
 * `etapa_ordem` vai depois das numeradas, pela primeira aparição. A etapa
 * fica contígua — `resumirEtapas` agrupa na ordem de aparição.
 */
export function ordenarAtividades<T extends Linha>(linhas: T[]): T[] {
  const chave = (a: Linha) => (a.etapa ?? '') as string
  const pos = new Map<string, [number, number]>()
  for (const a of linhas) {
    const eo = typeof a.etapa_ordem === 'number' ? a.etapa_ordem : Infinity
    const p = pos.get(chave(a))
    pos.set(chave(a), p ? [Math.min(p[0], eo), Math.min(p[1], a.numero)] : [eo, a.numero])
  }
  const ordem = (a: Linha) => (typeof a.ordem === 'number' ? a.ordem : a.numero) as number
  const cmp = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1)
  return [...linhas].sort((a, b) => {
    const pa = pos.get(chave(a))!
    const pb = pos.get(chave(b))!
    return cmp(pa[0], pb[0]) || cmp(pa[1], pb[1]) || cmp(ordem(a), ordem(b)) || cmp(a.numero, b.numero)
  })
}

/** Plano de uma versão, na ordem de exibição (`ordenarAtividades`). */
export const planoDe = (linhas: Linha[], versaoId: string): AtividadePlano[] =>
  ordenarAtividades(linhas.filter((a) => a.versao_id === versaoId)).map(atividadePlanoDe)

export const impedimentoRow = (i: Linha): ImpedimentoRow => ({
  id: i.id,
  obraId: i.obra_id,
  categoria: i.categoria,
  tipo: i.tipo ?? null,
  responsavel: i.responsavel ?? null,
  atividadeNumero: i.atividade_numero ?? null,
  descricao: i.descricao,
  pessoaCliente: i.pessoa_cliente ?? null,
  fotoPath: i.foto_path ?? null,
  travaAtividade: !!i.trava_atividade,
  impactoDias: i.impacto_dias === null || i.impacto_dias === undefined ? null : Number(i.impacto_dias),
  exibirAoCliente: !!i.exibir_ao_cliente,
  abertoEm: i.aberto_em,
  encerradoEm: i.encerrado_em ?? null,
  rdoId: i.rdo_id ?? null,
  orientacaoId: i.orientacao_id ?? null,
  criadoPor: i.criado_por ?? null,
  criadoEm: i.criado_em,
})

export async function lerObraGrande(
  supabase: SupabaseClient,
  obraId: string,
  hoje: string,
): Promise<{ ok: true; dados: ObraGrande } | { ok: false; erro: string }> {
  const [obraR, versR, execR, impR, ferR, histR] = await Promise.all([
    supabase.from('obras_obra').select('*').eq('id', obraId).maybeSingle(),
    supabase.from('obras_cronograma_versao').select('id, numero, motivo, salva_em').eq('obra_id', obraId).order('numero'),
    supabase.from('obras_atividade_exec').select('*').eq('obra_id', obraId),
    supabase.from('obras_impedimento').select('*').eq('obra_id', obraId).order('aberto_em', { ascending: false }),
    supabase.from('obras_feriado').select('data'),
    supabase.from('obras_atividade_status_hist').select('numero, data_status, percentual, dias_restantes, registrado_em').eq('obra_id', obraId),
  ])
  const falha = [obraR, versR, execR, impR, ferR, histR].find((r) => r.error)
  if (falha) return { ok: false, erro: `Falha ao ler a obra: ${falha.error!.message}` }
  if (!obraR.data) return { ok: false, erro: 'Obra não encontrada' }

  const obra = obraR.data as ObraRow
  const versoes = ((versR.data ?? []) as Linha[]).slice().sort((a, b) => a.numero - b.numero)
  const salvas = versoes.filter((v) => v.salva_em)
  const vigenteL = salvas.length ? salvas[salvas.length - 1] : null
  const baseL = salvas.find((v) => v.numero === 1) ?? null
  const rascunhoL = versoes.filter((v) => !v.salva_em).pop() ?? null

  const usada = vigenteL ?? rascunhoL
  const ids = [...new Set([usada?.id, baseL?.id].filter((x): x is string => !!x))]
  let atividades: Linha[] = []
  if (ids.length) {
    const atR = await supabase.from('obras_atividade').select('*').in('versao_id', ids)
    if (atR.error) return { ok: false, erro: `Falha ao ler a obra: ${atR.error.message}` }
    atividades = (atR.data ?? []) as Linha[]
  }

  const hist: PontoHist[] = ((histR.data ?? []) as Linha[]).map((h) => ({
    numero: h.numero,
    dataStatus: h.data_status,
    percentual: Number(h.percentual ?? 0),
    diasRestantes: h.dias_restantes === null || h.dias_restantes === undefined ? null : Number(h.dias_restantes),
    registradoEm: h.registrado_em ?? '',
  }))
  let dadosAte: string | null = hist.reduce<string | null>(
    (m, h) => (m === null || h.dataStatus > m ? h.dataStatus : m), null,
  )
  if (dadosAte === null) {
    const rdoR = await supabase
      .from('obras_rdo').select('validado_em').eq('obra_id', obraId)
      .not('validado_em', 'is', null).order('validado_em', { ascending: false }).limit(1)
    if (rdoR.error) return { ok: false, erro: `Falha ao ler a obra: ${rdoR.error.message}` }
    const v = ((rdoR.data ?? []) as Linha[])[0]?.validado_em as string | undefined
    dadosAte = v ? v.slice(0, 10) : null
  }

  return {
    ok: true,
    dados: montarObraGrande({
      obra,
      vigente: vigenteL ? versaoInfo(vigenteL) : null,
      base: baseL ? versaoInfo(baseL) : null,
      rascunho: rascunhoL ? versaoInfo(rascunhoL) : null,
      planoUsado: usada ? planoDe(atividades, usada.id) : [],
      planoBase: baseL && baseL.id !== usada?.id ? planoDe(atividades, baseL.id) : null,
      exec: ((execR.data ?? []) as Linha[]).map(atividadeExecDe),
      impedimentos: ((impR.data ?? []) as Linha[]).map(impedimentoRow),
      feriados: new Set(((ferR.data ?? []) as Linha[]).map((f) => f.data as string)),
      hist,
      dadosAte,
      hoje,
    }),
  }
}

/**
 * Parte pura da leitura: com as linhas já convertidas, calcula vigente, base,
 * sinal e atraso. Separada para a prévia visual (sem banco) usar o mesmo cálculo.
 * `planoBase` = plano da v1 quando ela não é a versão usada; null = mesma versão.
 */
/**
 * Âncora dos dias restantes (spec §5 A5): para cada atividade com `diasRestantes`
 * no exec, a `data_status` da linha mais recente do histórico com dias restantes
 * informados e igual ao valor atual. Sem essa linha, fica sem âncora (motor usa hoje).
 */
export function ancorarDiasRestantes(exec: AtividadeExec[], hist: PontoHist[]): AtividadeExec[] {
  const ultima = new Map<number, PontoHist>()
  for (const h of hist) {
    if (h.diasRestantes === null || h.diasRestantes === undefined) continue
    const m = ultima.get(h.numero)
    const chave = (x: PontoHist) => `${x.dataStatus}|${x.registradoEm ?? ''}`
    if (!m || chave(h) > chave(m)) ultima.set(h.numero, h)
  }
  return exec.map((e) => {
    if (e.diasRestantes === null || e.diasRestantes === undefined) return e
    const h = ultima.get(e.numero)
    return { ...e, diasRestantesEm: h && h.diasRestantes === e.diasRestantes ? h.dataStatus : null }
  })
}

export function montarObraGrande(p: {
  obra: ObraRow
  vigente: VersaoInfo | null
  base: VersaoInfo | null
  rascunho: VersaoInfo | null
  planoUsado: AtividadePlano[]
  planoBase: AtividadePlano[] | null
  exec: AtividadeExec[]
  impedimentos: ImpedimentoRow[]
  feriados: Set<string>
  hist: PontoHist[]
  dadosAte: string | null
  hoje: string
}): ObraGrande {
  const { obra, impedimentos, feriados, hist, dadosAte, hoje } = p
  const exec = ancorarDiasRestantes(p.exec, hist)
  const imps = impedimentosCalcDe(impedimentos)
  const usada = p.vigente ?? p.rascunho
  const plano = usada ? p.planoUsado : []
  const calcular = (pl: AtividadePlano[]) =>
    calcularCronograma({
      plano: pl, exec, dataBase: obra.data_base ?? hoje, hoje, feriados,
      atividadeTrava: obra.atividade_trava, impedimentos: imps,
    })

  const calc = usada ? calcular(plano) : null
  const calcBase = p.base
    ? (p.base.id === usada?.id && calc ? calc : calcular(p.planoBase ?? []))
    : null
  const terminoBase = calcBase?.terminoPrevisto ?? null
  const sinal = calc
    ? sinalDaObra({
        desvioPP: calc.desvioPP,
        terminoProjetado: calc.terminoProjetado,
        terminoBase,
        impedimentoClienteAberto: impedimentos.some(
          (i) => i.categoria === 'impedimento' && i.responsavel === 'cliente' && !i.encerradoEm,
        ),
      })
    : null
  const atraso = calc && terminoBase
    ? atrasoPorResponsavel({
        terminoBase, terminoProjetado: calc.terminoProjetado,
        impacto: diasDeImpacto(imps, hoje, feriados), feriados,
      })
    : null

  return {
    obra,
    versaoBase: p.base,
    versaoVigente: p.vigente,
    rascunho: p.rascunho,
    plano, exec, impedimentos, feriados, calc, calcBase, hist, dadosAte,
    etapas: calc ? resumirEtapas(calc.atividades, feriados) : [],
    terminoBase, sinal, atraso,
  }
}
