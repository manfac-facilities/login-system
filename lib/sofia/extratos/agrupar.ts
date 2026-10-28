/**
 * Funções puras das telas de extratos (Etapas 2 e 3): comparar o reenvio com o
 * que já está gravado (D4), agrupar o "sem centro de custo" e achar a ligação
 * vigente. Sem acesso a banco.
 */

export type Divergencia = {
  codigo: string
  valorGravado: string
  valorArquivo: string
}

const centavos = (v: string | number) => Math.round(Number(v) * 100)

/**
 * D4: transações do arquivo cujo código já existe com valor diferente. Nada é
 * sobrescrito (a RPC ignora a linha); isto só mostra o que ficou diferente.
 */
export function acharDivergencias(
  arquivo: { codigo_transacao: string; valor: string }[],
  gravadas: { codigo_transacao: string; valor: string | number }[]
): Divergencia[] {
  const porCodigo = new Map(gravadas.map((g) => [g.codigo_transacao, g.valor]))
  const out: Divergencia[] = []
  for (const l of arquivo) {
    const g = porCodigo.get(l.codigo_transacao)
    if (g !== undefined && centavos(g) !== centavos(l.valor)) {
      out.push({ codigo: l.codigo_transacao, valorGravado: Number(g).toFixed(2), valorArquivo: Number(l.valor).toFixed(2) })
    }
  }
  return out
}

export type LinhaSemCC = {
  plataforma: string
  identificador: string
  data_uso: string
  valor: number | string
  equipe_id: string | null
  motivo_sem_centro_custo: string | null
}

export type GrupoSemCC = {
  plataforma: string
  identificador: string
  motivo: 'sem_equipe' | 'sem_centro_custo'
  equipeId: string | null
  gastos: number
  /** centavos, para não somar float */
  totalCentavos: number
  primeiraData: string
  ultimaData: string
}

/** Um grupo por (plataforma, cartão/tag, motivo), do maior valor para o menor. */
export function agruparSemCentroCusto(linhas: LinhaSemCC[]): GrupoSemCC[] {
  const mapa = new Map<string, GrupoSemCC>()
  for (const l of linhas) {
    const motivo = l.motivo_sem_centro_custo
    if (motivo !== 'sem_equipe' && motivo !== 'sem_centro_custo') continue
    const chave = `${l.plataforma}|${l.identificador}|${motivo}|${l.equipe_id ?? ''}`
    const g = mapa.get(chave) ?? {
      plataforma: l.plataforma,
      identificador: l.identificador,
      motivo,
      equipeId: l.equipe_id,
      gastos: 0,
      totalCentavos: 0,
      primeiraData: l.data_uso,
      ultimaData: l.data_uso,
    }
    g.gastos += 1
    g.totalCentavos += centavos(l.valor)
    if (l.data_uso < g.primeiraData) g.primeiraData = l.data_uso
    if (l.data_uso > g.ultimaData) g.ultimaData = l.data_uso
    mapa.set(chave, g)
  }
  return [...mapa.values()].sort((a, b) => b.totalCentavos - a.totalCentavos)
}

export type Ligacao = {
  plataforma: string
  identificador: string
  equipe_id: string
  vigente_desde: string
  criado_em: string
}

/** Ligação mais recente por (plataforma, identificador) até `hoje`: mesma regra da view (vigente_desde, depois criado_em). */
export function ligacaoVigente(historico: Ligacao[], hoje: string): Ligacao | null {
  let r: Ligacao | null = null
  for (const l of historico) {
    if (l.vigente_desde > hoje) continue
    if (!r || l.vigente_desde > r.vigente_desde || (l.vigente_desde === r.vigente_desde && l.criado_em > r.criado_em)) r = l
  }
  return r
}

/** Cartão: 4 primeiros + 4 últimos; o resto fica oculto. */
export function mascararCartao(n: string): string {
  return n.length > 8 ? `${n.slice(0, 4)} **** ${n.slice(-4)}` : n
}

export const brl = (v: number | string) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const dataBR = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
