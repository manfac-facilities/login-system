/**
 * Leitura consolidada da OBRA (modalidade "obra"): camada de dados única das
 * telas e do e-mail. Só lê; não grava.
 * Vigente = maior `numero` com `salva_em`; rascunho = versão sem `salva_em`;
 * base = versão 1, se salva.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ObraRow } from '../../_lib/tipos'
import {
  atrasoPorResponsavel,
  calcularCronograma,
  diasDeImpacto,
  sinalDaObra,
  type AtividadeExec,
  type AtividadePlano,
  type ImpedimentoCalc,
  type ResultadoCronograma,
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
})

/** Linha de `obras_atividade_exec` → execução do motor. */
export const atividadeExecDe = (e: Linha): AtividadeExec => ({
  numero: e.numero,
  status: e.status as StatusAtividade,
  percentual: Number(e.percentual ?? 0),
  inicioReal: e.inicio_real ?? null,
  fimReal: e.fim_real ?? null,
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

/** Plano de uma versão, ordenado por número. */
export const planoDe = (linhas: Linha[], versaoId: string): AtividadePlano[] =>
  linhas
    .filter((a) => a.versao_id === versaoId)
    .map(atividadePlanoDe)
    .sort((a, b) => a.numero - b.numero)

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
  const [obraR, versR, execR, impR, ferR] = await Promise.all([
    supabase.from('obras_obra').select('*').eq('id', obraId).maybeSingle(),
    supabase.from('obras_cronograma_versao').select('id, numero, motivo, salva_em').eq('obra_id', obraId).order('numero'),
    supabase.from('obras_atividade_exec').select('*').eq('obra_id', obraId),
    supabase.from('obras_impedimento').select('*').eq('obra_id', obraId).order('aberto_em', { ascending: false }),
    supabase.from('obras_feriado').select('data'),
  ])
  const falha = [obraR, versR, execR, impR, ferR].find((r) => r.error)
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

  const feriados = new Set(((ferR.data ?? []) as Linha[]).map((f) => f.data as string))
  const exec: AtividadeExec[] = ((execR.data ?? []) as Linha[]).map(atividadeExecDe)
  const impedimentos = ((impR.data ?? []) as Linha[]).map(impedimentoRow)
  const imps = impedimentosCalcDe(impedimentos)

  const plano = usada ? planoDe(atividades, usada.id) : []
  const calcular = (p: AtividadePlano[]) =>
    calcularCronograma({
      plano: p, exec, dataBase: obra.data_base ?? hoje, hoje, feriados,
      atividadeTrava: obra.atividade_trava, impedimentos: imps,
    })

  const calc = usada ? calcular(plano) : null
  const terminoBase = baseL
    ? (baseL.id === usada?.id && calc ? calc : calcular(planoDe(atividades, baseL.id))).terminoPrevisto
    : null
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
    ok: true,
    dados: {
      obra,
      versaoBase: baseL ? versaoInfo(baseL) : null,
      versaoVigente: vigenteL ? versaoInfo(vigenteL) : null,
      rascunho: rascunhoL ? versaoInfo(rascunhoL) : null,
      plano, exec, impedimentos, feriados, calc, terminoBase, sinal, atraso,
    },
  }
}
