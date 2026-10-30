/** Tipos e regras puras do lookahead e do quadro de restrições (fora do 'use server'). */
import type { Restricao } from '../../_lib/last-planner'

export type Resultado = { ok: true } | { ok: false; erro: string }

export type TipoRestricao = Restricao['tipo']
export type ResponsavelRestricao = Restricao['responsavel']
export type SituacaoRestricao = Restricao['situacao']

export const TIPOS_RESTRICAO: { valor: TipoRestricao; rotulo: string }[] = [
  { valor: 'acesso', rotulo: 'Acesso/área' },
  { valor: 'material', rotulo: 'Material' },
  { valor: 'mao_de_obra', rotulo: 'Mão de obra' },
  { valor: 'projeto', rotulo: 'Projeto/informação' },
  { valor: 'decisao_cliente', rotulo: 'Decisão do cliente' },
  { valor: 'equipamento', rotulo: 'Equipamento' },
  { valor: 'outro', rotulo: 'Outro' },
]

export const RESPONSAVEIS_RESTRICAO: { valor: ResponsavelRestricao; rotulo: string }[] = [
  { valor: 'cliente', rotulo: 'Cliente' },
  { valor: 'manfac', rotulo: 'Manfac' },
  { valor: 'terceiro', rotulo: 'Terceiro' },
]

export const SITUACOES: { valor: SituacaoRestricao; rotulo: string }[] = [
  { valor: 'identificada', rotulo: 'Identificada' },
  { valor: 'em_tratativa', rotulo: 'Em tratativa' },
  { valor: 'liberada', rotulo: 'Liberada' },
]

export const rotuloTipo = (t: string) => TIPOS_RESTRICAO.find((x) => x.valor === t)?.rotulo ?? t
export const rotuloResponsavelRestricao = (r: string) => RESPONSAVEIS_RESTRICAO.find((x) => x.valor === r)?.rotulo ?? r

/** Vizinha da situação no quadro: +1 avança, -1 volta; null nas pontas. */
export function vizinha(s: SituacaoRestricao, passo: 1 | -1): SituacaoRestricao | null {
  const i = SITUACOES.findIndex((x) => x.valor === s)
  return SITUACOES[i + passo]?.valor ?? null
}

export type FiltroQuadro = { responsavel?: ResponsavelRestricao | null; atrasadas?: boolean; hoje: string }

/** Agrupa nas 3 colunas do quadro; atrasada = prazo vencido e ainda não liberada. */
export function agruparQuadro(restricoes: Restricao[], f: FiltroQuadro): Record<SituacaoRestricao, Restricao[]> {
  const out: Record<SituacaoRestricao, Restricao[]> = { identificada: [], em_tratativa: [], liberada: [] }
  for (const r of restricoes) {
    if (f.responsavel && r.responsavel !== f.responsavel) continue
    if (f.atrasadas && !(r.situacao !== 'liberada' && r.prazo !== null && r.prazo < f.hoje)) continue
    out[r.situacao].push(r)
  }
  const chave = (r: Restricao) => r.prazo ?? '9999-12-31'
  for (const k of Object.keys(out) as SituacaoRestricao[]) out[k].sort((a, b) => chave(a).localeCompare(chave(b)))
  return out
}

export type NovaRestricao = {
  atividadeNumero: number
  tipo: string
  descricao: string
  responsavel: string
  prazo: string | null
}
