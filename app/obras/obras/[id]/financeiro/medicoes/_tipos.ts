/** Medições ao cliente (Fases B/C §2.4): tipos e montagem da lista. Puro. */
import { diasDesde, LIMITE_DIAS_AGUARDANDO } from '../../../_lib/medicao'

export type Resultado = { ok: true } | { ok: false; erro: string }

export type Situacao = 'enviada' | 'aprovada' | 'recusada'

export type MedicaoEntrada = {
  /** Sem id = nova. */
  id?: string
  osId: string
  inicio: string
  fim: string
  percentualCentesimos: number
  valorCentavos: number
}

export type OsMedicao = {
  id: string
  os: string | null
  papel: 'mae' | 'aditivo' | 'obra'
  /** Valor receita em centavos; null = não informado (o % não se calcula). */
  receitaCentavos: number | null
  /** OS cancelada (cancelado_em): fora do seletor. */
  cancelada?: boolean
  /** Esta pessoa grava medição nesta OS (engenheiro da OS/mãe ou admin). */
  podeGravar: boolean
  /** Avanço físico de hoje (centésimos), quando a página conhece; null = "—". */
  avancoCentesimos: number | null
}

export type MedicaoLinha = {
  id: string
  osId: string
  os: string | null
  numero: number
  inicio: string
  fim: string
  percentualCentesimos: number
  valorCentavos: number
  avancoCentesimos: number | null
  situacao: Situacao
  enviadaEm: string
  aprovadaEm: string | null
  /** Números das notas (NFS-e) ligadas no Financeiro; vazio = sem nota. */
  notas: string[]
  /** Dias desde o envio (só quando enviada). */
  diasAguardando: number | null
  /** Enviada há mais de 10 dias. */
  atrasada: boolean
}

const n = (v: unknown) => Math.round(Number(v))
const txt = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))

/** Linhas de `obras_medicao_cliente` + `obras_fin_notas` (medicao_ids) → lista da tela. */
export function montarMedicoes(p: {
  linhas: Record<string, unknown>[]
  notas: Record<string, unknown>[]
  osPorId: Map<string, string | null>
  hoje: string
}): MedicaoLinha[] {
  const notasPorMedicao = new Map<string, string[]>()
  for (const nt of p.notas) {
    const ids = Array.isArray(nt.medicao_ids) ? (nt.medicao_ids as unknown[]) : []
    const numero = txt(nt.nfse_numero) ?? 'sem número'
    for (const id of ids) {
      const lista = notasPorMedicao.get(String(id)) ?? []
      if (!lista.includes(numero)) lista.push(numero)
      notasPorMedicao.set(String(id), lista)
    }
  }
  return p.linhas
    .map((r): MedicaoLinha => {
      const situacao = String(r.situacao) as Situacao
      const enviadaEm = String(r.enviada_em)
      const dias = situacao === 'enviada' ? diasDesde(enviadaEm, p.hoje) : null
      return {
        id: String(r.id),
        osId: String(r.obra_id),
        os: p.osPorId.get(String(r.obra_id)) ?? null,
        numero: n(r.numero),
        inicio: String(r.periodo_inicio),
        fim: String(r.periodo_fim),
        percentualCentesimos: n(r.percentual_centesimos),
        valorCentavos: n(r.valor_centavos),
        avancoCentesimos: r.avanco_centesimos === null || r.avanco_centesimos === undefined ? null : n(r.avanco_centesimos),
        situacao,
        enviadaEm,
        aprovadaEm: txt(r.aprovada_em),
        notas: notasPorMedicao.get(String(r.id)) ?? [],
        diasAguardando: dias,
        atrasada: dias !== null && dias > LIMITE_DIAS_AGUARDANDO,
      }
    })
    .sort((a, b) => (a.os ?? '').localeCompare(b.os ?? '') || a.numero - b.numero)
}
