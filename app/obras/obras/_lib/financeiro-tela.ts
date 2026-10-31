/**
 * Aba Financeiro da obra (Fase A, spec §3): monta os 4 blocos (Resumo, Compras, Fornecedores,
 * Faturamento) a partir das linhas de `obras_fin_compras` / `obras_fin_fornecedores` /
 * `obras_fin_notas` (cliente da SESSÃO). Puro. Dinheiro em CENTAVOS inteiros; R$ só em `brl()`,
 * chamado na hora de renderizar.
 *
 * DINHEIRO (AGENTS.md): valor que não é número finito não vira 0 — o bloco inteiro cai em
 * `{ ok: false }` ("dados inconsistentes") e os outros blocos seguem de pé.
 * frn_* grava REAIS (colunas `_reais`): converte com Math.round(x * 100).
 */
import { consolidarFinanceiro, type CompraPedido, type Linha, type MedicaoFornecedor, type NotaObra, type ObraRef, type StatusMedicao } from './financeiro-obra'

type Row = Record<string, unknown>
/** ok:false sem motivo = dados inconsistentes; motivo 'leitura' = a consulta falhou. */
export type Bloco<T> = { ok: true; dados: T } | { ok: false; motivo?: 'leitura' }

/** Valor obrigatório: null/undefined/texto não numérico → NaN (consolidação e `exigir` rejeitam). */
const valor = (v: unknown): number => (v === null || v === undefined || v === '' ? NaN : Number(v))
const exigir = (v: number): number => {
  if (!Number.isFinite(v)) throw new Error('financeiro-tela: valor não numérico')
  return Math.round(v)
}
/** Reais (numeric do frn_*) → centavos. */
const reaisParaCentavos = (v: unknown): number => exigir(valor(v) * 100)
const txt = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))

function bloco<T>(f: () => T): Bloco<T> {
  try {
    return { ok: true, dados: f() }
  } catch {
    return { ok: false }
  }
}

const fmtBrl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
/** Centavos → "R$ 1.234,56". Só na renderização. */
export const brl = (centavos: number): string => fmtBrl.format(centavos / 100)
export const pctTexto = (p: number | null): string =>
  p === null ? '—' : `${p.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`

const SITUACAO_PEDIDO: Record<string, string> = {
  na_fila: 'Na fila', gravando: 'Gravando no Omie', emitido: 'Pedido emitido', falha: 'Falha no pedido',
}
const ENTREGA: Record<string, string> = {
  pendente: 'Pendente', confirmada: 'Entregue', divergencia: 'Divergência', resolvida: 'Entregue (resolvida)',
}
export const MEDICAO: Record<StatusMedicao, string> = {
  solicitada: 'Solicitada', aprovada: 'Aprovada', pagamento_solicitado: 'Pagamento solicitado', paga: 'Paga', devolvida: 'Devolvida',
}
const STATUS_MEDICAO = new Set(Object.keys(MEDICAO))
const NOTA: Record<string, string> = {
  rascunho: 'Rascunho', aprovada: 'Aprovada', os_criada: 'OS criada', faturando: 'Faturando', autorizada: 'Autorizada',
  rejeitada: 'Rejeitada', falha_conferir: 'Falha (conferir)', cancelada: 'Cancelada', enviada: 'Enviada',
}

export type ObraFin = { id: string; os: string | null; loja: string | null; paiId: string | null }

export type CompraTela = {
  chave: string
  os: string
  solicitacaoNumero: number | null
  descricao: string
  etapa: string | null
  fornecedor: string | null
  /** Pedido: total; sem pedido: estimado da solicitação. */
  valorCentavos: number | null
  valorEstimado: boolean
  previsao: string | null
  entrega: string | null
  entregaEm: string | null
  nf: string | null
  pagoEm: string | null
  status: string
  link: string | null
}

export type MedicaoTela = { id: string; numero: string | null; item: string | null; competencia: string | null; status: string; valorCentavos: number; pagoEm: string | null }
export type ContratoTela = {
  id: string
  os: string
  numero: string | null
  status: string | null
  fornecedor: string | null
  escopo: string | null
  valorCentavos: number
  medidoCentavos: number
  saldoCentavos: number
  medicoes: MedicaoTela[]
}
export type NotaTela = {
  chave: string
  os: string
  numero: string | null
  tomador: string | null
  situacao: string
  parcelaCentavos: number | null
  totalCentavos: number | null
  emitidaEm: string | null
  contaNaReceita: boolean
}

export type Financeiro = {
  semLancamentos: boolean
  resumo: Bloco<{ porOS: (Linha & { papel: 'mae' | 'aditivo' | 'obra' })[]; total: Linha }>
  compras: Bloco<CompraTela[]>
  fornecedores: Bloco<ContratoTela[]>
  faturamento: Bloco<NotaTela[]>
}

const osDe = (o: ObraFin | undefined, row: Row) => txt(row.obra_os) ?? o?.os ?? '—'

/**
 * `obras`: a obra aberta e as filhas diretas (a obra aberta primeiro). Linhas de obra que não
 * está na lista são ignoradas.
 */
export function montarFinanceiro(p: { obraId: string; obras: ObraFin[]; compras: Row[]; fornecedores: Row[]; notas: Row[] }): Financeiro {
  const porId = new Map(p.obras.map((o) => [o.id, o]))
  const daObra = (r: Row) => porId.has(String(r.obra_id))
  const compras = p.compras.filter(daObra)
  const fornecedores = p.fornecedores.filter(daObra)
  const notas = p.notas.filter(daObra)

  const resumo = bloco(() => {
    const refs: ObraRef[] = p.obras.map((o) => ({ id: o.id, os: o.os ?? '—', paiId: o.paiId }))
    const cp: CompraPedido[] = compras
      .filter((r) => r.pedido_id)
      .map((r) => ({
        obraId: String(r.obra_id),
        status: String(r.pedido_situacao ?? ''),
        total_centavos: valor(r.total_centavos),
        nf: txt(r.nf_numero),
        pago_em: txt(r.pago_em),
        cancelada: r.solicitacao_etapa === 'cancelada',
      }))
    const md: MedicaoFornecedor[] = fornecedores
      .filter((r) => r.medicao_id)
      .map((r) => {
        const status = String(r.medicao_status)
        if (!STATUS_MEDICAO.has(status)) throw new Error('financeiro-tela: status de medição desconhecido')
        return { obraId: String(r.obra_id), status: status as StatusMedicao, valorCentavos: Math.round(valor(r.medicao_valor_reais) * 100) }
      })
    const nt: NotaObra[] = notas.map((r) => ({
      obraId: String(r.obra_id),
      valor_centavos: valor(r.parcela_centavos),
      situacao: String(r.nota_situacao ?? ''),
      devolvidaEm: txt(r.obras_devolvidas_em),
    }))
    const c = consolidarFinanceiro({ compras: cp, fornecedores: md, notas: nt, obras: refs })
    const temFilha = p.obras.some((o) => o.paiId === p.obraId)
    return {
      porOS: c.porOS.map((l) => ({
        ...l,
        papel: (l.obraId === p.obraId ? (temFilha ? 'mae' : 'obra') : 'aditivo') as 'mae' | 'aditivo' | 'obra',
      })),
      total: c.total,
    }
  })

  const comprasB = bloco(() =>
    compras.map((r, i): CompraTela => {
      const temPedido = !!r.pedido_id
      const bruto = temPedido ? r.total_centavos : r.valor_estimado_centavos
      const v = bruto === null || bruto === undefined ? null : exigir(valor(bruto))
      const numero = r.solicitacao_numero === null || r.solicitacao_numero === undefined ? null : exigir(valor(r.solicitacao_numero))
      const etapa = txt(r.solicitacao_etapa)
      return {
        chave: `${r.solicitacao_id ?? i}:${r.pedido_id ?? '-'}`,
        os: osDe(porId.get(String(r.obra_id)), r),
        solicitacaoNumero: numero,
        descricao: txt(r.solicitacao_motivo) ?? txt(r.solicitacao_tipo) ?? 'Solicitação',
        etapa,
        fornecedor: txt(r.fornecedor_razao_social),
        valorCentavos: v,
        valorEstimado: !temPedido,
        previsao: txt(r.previsao_entrega) ?? (temPedido ? null : txt(r.prazo_necessario)),
        entrega: r.entrega_situacao ? (ENTREGA[String(r.entrega_situacao)] ?? String(r.entrega_situacao)) : null,
        entregaEm: txt(r.entrega_em),
        nf: txt(r.nf_numero),
        pagoEm: txt(r.pago_em),
        status: etapa === 'cancelada'
          ? 'Cancelada'
          : temPedido
            ? (SITUACAO_PEDIDO[String(r.pedido_situacao)] ?? String(r.pedido_situacao ?? '—'))
            : `Solicitação${etapa ? ` · ${etapa.replace(/_/g, ' ')}` : ''}`,
        link: numero !== null ? `/compras/solicitacoes/${numero}` : null,
      }
    }),
  )

  const fornecedoresB = bloco(() => {
    const contratos = new Map<string, ContratoTela>()
    for (const r of fornecedores) {
      const id = String(r.contrato_id)
      let c = contratos.get(id)
      if (!c) {
        // Valores do contrato repetem em cada linha de medição: lê uma vez só.
        const valorCentavos =
          reaisParaCentavos(r.valor_mo_reais ?? 0) + reaisParaCentavos(r.valor_mat_reais ?? 0) +
          reaisParaCentavos(r.aditivos_mo_reais ?? 0) + reaisParaCentavos(r.aditivos_mat_reais ?? 0)
        c = {
          id, os: osDe(porId.get(String(r.obra_id)), r), numero: txt(r.contrato_numero), status: txt(r.contrato_status),
          fornecedor: txt(r.fornecedor_razao_social), escopo: txt(r.contrato_escopo),
          valorCentavos, medidoCentavos: 0, saldoCentavos: valorCentavos, medicoes: [],
        }
        contratos.set(id, c)
      }
      if (!r.medicao_id) continue
      const status = String(r.medicao_status)
      if (!STATUS_MEDICAO.has(status)) throw new Error('financeiro-tela: status de medição desconhecido')
      const v = reaisParaCentavos(r.medicao_valor_reais)
      c.medicoes.push({
        id: String(r.medicao_id), numero: txt(r.medicao_numero), item: txt(r.medicao_item), competencia: txt(r.medicao_competencia),
        status: MEDICAO[status as StatusMedicao], valorCentavos: v, pagoEm: txt(r.medicao_pago_em),
      })
      // Saldo = contrato − medições aprovadas (ou além). Solicitada/devolvida não consomem.
      if (status === 'aprovada' || status === 'pagamento_solicitado' || status === 'paga') {
        c.medidoCentavos += v
        c.saldoCentavos = c.valorCentavos - c.medidoCentavos
      }
    }
    return [...contratos.values()]
  })

  const faturamentoB = bloco(() =>
    notas.map((r, i): NotaTela => {
      const parcela = r.parcela_centavos === null || r.parcela_centavos === undefined ? null : exigir(valor(r.parcela_centavos))
      const total = r.nota_valor_total_centavos === null || r.nota_valor_total_centavos === undefined ? null : exigir(valor(r.nota_valor_total_centavos))
      const situacao = String(r.nota_situacao ?? '')
      return {
        chave: `${r.nota_id ?? i}:${r.obra_id}`,
        os: osDe(porId.get(String(r.obra_id)), r),
        numero: txt(r.nfse_numero),
        tomador: txt(r.tomador_nome),
        situacao: (NOTA[situacao] ?? situacao) + (r.obras_devolvidas_em ? ' · devolvida' : ''),
        parcelaCentavos: parcela,
        totalCentavos: total,
        emitidaEm: txt(r.autorizada_em) ?? txt(r.nota_criado_em),
        contaNaReceita: (situacao === 'autorizada' || situacao === 'enviada') && !r.obras_devolvidas_em,
      }
    }),
  )

  return {
    semLancamentos: compras.length === 0 && fornecedores.length === 0 && notas.length === 0,
    resumo,
    compras: comprasB,
    fornecedores: fornecedoresB,
    faturamento: faturamentoB,
  }
}
