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
import {
  consolidarMargem, type CompraPedido, type LinhaMargem, type MargemObra, type MedicaoCliente, type MedicaoFornecedor,
  type NotaObra, type ObraMargem, type StatusMedicao, type VinculoCusto,
} from './financeiro-obra'
import { avisoLocacao, textoAviso } from './locacao'

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

export type ObraFin = {
  id: string
  os: string | null
  loja: string | null
  paiId: string | null
  /** Valor receita (centavos); null/ausente = não informado (Fases B/C). */
  receitaCentavos?: number | null
  /** OS cancelada: fora da receita esperada. */
  cancelada?: boolean
}

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

export type Papel = 'mae' | 'aditivo' | 'obra'

/** Pílulas da tabela "Custos por origem". null = a leitura falhou (a tela avisa, não mostra 0). */
export type PendenciasOrigem = {
  comprasSemEntrega: number
  medicoesFornecedorAtrasadas: { quantidade: number; maisDias: number } | null
  caixinhaSemObra: number | null
  locacoes: { quantidade: number; primeira: string; urgente: boolean } | null
}

export type Financeiro = {
  semLancamentos: boolean
  resumo: Bloco<Omit<MargemObra, 'porOS'> & { porOS: (LinhaMargem & { papel: Papel })[]; notasSemParcela: number }>
  pendencias: PendenciasOrigem
  compras: Bloco<CompraTela[]>
  fornecedores: Bloco<ContratoTela[]>
  faturamento: Bloco<NotaTela[]>
}

const contaNaReceita = (r: Row) =>
  (String(r.nota_situacao ?? '') === 'autorizada' || String(r.nota_situacao ?? '') === 'enviada') && !r.obras_devolvidas_em

const osDe = (o: ObraFin | undefined, row: Row) => txt(row.obra_os) ?? o?.os ?? '—'

/**
 * `obras`: a obra aberta e as filhas diretas (a obra aberta primeiro). Linhas de obra que não
 * está na lista são ignoradas.
 */
export function montarFinanceiro(p: {
  obraId: string
  obras: ObraFin[]
  compras: Row[]
  fornecedores: Row[]
  notas: Row[]
  /** Fases B/C (opcionais; ausente = vazio). `obras_fin_vinculos`. */
  vinculos?: Row[]
  /** `obras_medicao_cliente` da família (liberado = aprovadas). */
  medicoesCliente?: Row[]
  /** Avanço físico 0–1 da obra aberta (calc.realizado); null = sem cronograma. */
  avanco?: number | null
  /** `obras_fin_medicoes_fornecedor_atrasadas`; null = leitura falhou. */
  medicoesFornecedorAtrasadas?: Row[] | null
  /** `obras_fin_caixinha_sem_obra.quantidade`; null = leitura falhou. */
  caixinhaSemObra?: number | null
  /** Locações (`itensDeLocacao`) para a pílula de vencimento; null = leitura falhou. */
  locacoes?: { item: string; fim: string | null; estado: string | null }[] | null
  hoje?: string
  feriados?: ReadonlySet<string>
}): Financeiro {
  const porId = new Map(p.obras.map((o) => [o.id, o]))
  const daObra = (r: Row) => porId.has(String(r.obra_id))
  const compras = p.compras.filter(daObra)
  const fornecedores = p.fornecedores.filter(daObra)
  const notas = p.notas.filter(daObra)
  const vinculos = (p.vinculos ?? []).filter(daObra)
  const medicoesCliente = (p.medicoesCliente ?? []).filter(daObra)

  const resumo = bloco(() => {
    const refs: ObraMargem[] = p.obras.map((o) => ({
      id: o.id, os: o.os ?? '—', paiId: o.paiId,
      receitaCentavos: o.receitaCentavos ?? null, cancelada: !!o.cancelada,
      // Avanço só se conhece da obra aberta (cronograma dela); aditivo fica "—".
      avanco: o.id === p.obraId ? (p.avanco ?? null) : null,
    }))
    const cp: CompraPedido[] = compras
      .filter((r) => r.pedido_id)
      .map((r) => ({
        obraId: String(r.obra_id),
        status: String(r.pedido_situacao ?? ''),
        total_centavos: valor(r.total_centavos),
        nf: txt(r.nf_numero),
        pago_em: txt(r.pago_em),
        cancelada: r.solicitacao_etapa === 'cancelada',
        locacao: r.solicitacao_tipo === 'locacao',
        fornecedorDocumento: txt(r.fornecedor_documento),
      }))
    const md: MedicaoFornecedor[] = fornecedores
      .filter((r) => r.medicao_id)
      .map((r) => {
        const status = String(r.medicao_status)
        if (!STATUS_MEDICAO.has(status)) throw new Error('financeiro-tela: status de medição desconhecido')
        return { obraId: String(r.obra_id), status: status as StatusMedicao, valorCentavos: Math.round(valor(r.medicao_valor_reais) * 100) }
      })
    // Parcela NULL no Financeiro: a nota fica fora da receita e o Resumo avisa (não derruba o bloco).
    const semParcela = (r: Row) => r.parcela_centavos === null || r.parcela_centavos === undefined || r.parcela_centavos === ''
    const notasSemParcela = notas.filter((r) => semParcela(r) && contaNaReceita(r)).length
    const nt: NotaObra[] = notas
      .filter((r) => !semParcela(r))
      .map((r) => ({
        obraId: String(r.obra_id),
        valor_centavos: valor(r.parcela_centavos),
        situacao: String(r.nota_situacao ?? ''),
        devolvidaEm: txt(r.obras_devolvidas_em),
      }))
    const opcional = (v: unknown) => (v === null || v === undefined ? null : valor(v))
    const vc: VinculoCusto[] = vinculos.map((r) => ({
      obraId: String(r.obra_id),
      origem: r.origem === 'caixinha_despesa' ? 'caixinha_despesa' : 'solicitacao',
      valorCentavos: valor(r.valor_centavos),
      deMedicaoFornecedor: r.de_medicao_fornecedor === true,
      etapa: txt(r.solicitacao_etapa),
      pagamentoSituacao: txt(r.pagamento_situacao),
      valorPagoCentavos: opcional(r.pagamento_valor_pago_centavos),
      solicitacaoValorCentavos: opcional(r.solicitacao_valor_centavos),
      relatorioStatus: txt(r.relatorio_status),
      fornecedorDocumento: txt(r.fornecedor_documento),
    }))
    const mc: MedicaoCliente[] = medicoesCliente.map((r) => ({ obraId: String(r.obra_id), situacao: String(r.situacao ?? ''), valorCentavos: valor(r.valor_centavos) }))
    const c = consolidarMargem({ compras: cp, fornecedores: md, notas: nt, vinculos: vc, medicoesCliente: mc, obras: refs, avanco: p.avanco ?? null })
    const temFilha = p.obras.some((o) => o.paiId === p.obraId)
    return {
      ...c,
      porOS: c.porOS.map((l) => ({
        ...l,
        papel: (l.obraId === p.obraId ? (temFilha ? 'mae' : 'obra') : 'aditivo') as Papel,
      })),
      notasSemParcela,
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
        contaNaReceita: parcela !== null && contaNaReceita(r),
      }
    }),
  )

  return {
    semLancamentos: compras.length === 0 && fornecedores.length === 0 && notas.length === 0 && vinculos.length === 0 && medicoesCliente.length === 0,
    resumo,
    pendencias: pendenciasOrigem(p, compras),
    compras: comprasB,
    fornecedores: fornecedoresB,
    faturamento: faturamentoB,
  }
}

const ENTREGUE = new Set(['confirmada', 'resolvida'])

function pendenciasOrigem(
  p: Pick<Parameters<typeof montarFinanceiro>[0], 'medicoesFornecedorAtrasadas' | 'caixinhaSemObra' | 'locacoes' | 'hoje' | 'feriados' | 'obras'>,
  compras: Row[],
): PendenciasOrigem {
  const ids = new Set(p.obras.map((o) => o.id))
  // Pedido emitido (fora locação) ainda não entregue; solicitação cancelada sem NF/pagamento não conta.
  const comprasSemEntrega = compras.filter(
    (r) => r.pedido_id && r.pedido_situacao === 'emitido' && r.solicitacao_tipo !== 'locacao' &&
      !(r.solicitacao_etapa === 'cancelada' && !r.nf_numero && !r.pago_em) && !ENTREGUE.has(String(r.entrega_situacao ?? '')),
  ).length
  const atrasadas = p.medicoesFornecedorAtrasadas === undefined ? [] : p.medicoesFornecedorAtrasadas
  const doFornecedor = atrasadas === null ? null : atrasadas.filter((r) => ids.has(String(r.obra_id)))
  const dias = (r: Row) => (Number.isFinite(Number(r.dias_aguardando)) ? Number(r.dias_aguardando) : 0)
  const avisos = p.locacoes === null
    ? null
    : (p.locacoes ?? [])
        .map((l) => ({ item: l.item, aviso: p.hoje ? avisoLocacao(l, p.hoje, p.feriados ?? new Set()) : null }))
        .filter((x): x is { item: string; aviso: NonNullable<typeof x.aviso> } => x.aviso !== null)
        .sort((a, b) => a.aviso.fim.localeCompare(b.aviso.fim))
  return {
    comprasSemEntrega,
    medicoesFornecedorAtrasadas: doFornecedor === null
      ? null
      : { quantidade: doFornecedor.length, maisDias: doFornecedor.reduce((m, r) => Math.max(m, dias(r)), 0) },
    caixinhaSemObra: p.caixinhaSemObra === undefined ? 0 : p.caixinhaSemObra,
    locacoes: avisos === null
      ? null
      : avisos.length
        ? { quantidade: avisos.length, primeira: `${avisos[0].item} ${textoAviso(avisos[0].aviso)}`, urgente: avisos.some((x) => x.aviso.tipo !== 'proxima') }
        : { quantidade: 0, primeira: '', urgente: false },
  }
}
