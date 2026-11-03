/**
 * Material antecipado (spec 2026-11-03): "Vem aí", "pedir até" e avisos. Puro, sem I/O e sem
 * Date.now (recebe `hoje`). Os dados do Compras chegam por `obras_restricao_compras(p_obra)` e
 * `obras_compras_prazos()`, SEM valores.
 */
import type { AtividadeCalculada } from './cronograma'
import type { Restricao } from './last-planner'
import { diaBr, pedidoDeLinha, pedidoEntregue } from './restricao-pedido'

export type PrazosCompras = { diasExpediente: number[]; folga: number; entregaMaterial: number }

/** Padrão do Compras (`PADROES`) quando não há linha de configuração. */
export const PRAZOS_PADRAO_COMPRAS: PrazosCompras = { diasExpediente: [1, 2, 3, 4, 5], folga: 4, entregaMaterial: 5 }

const inteiroNaoNegativo = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const objeto = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** Cada campo ausente ou inválido cai no padrão daquele campo. */
export function prazosDeLinha(l: { prazos: unknown; expediente: unknown } | null): PrazosCompras {
  const prazos = objeto(l?.prazos)
  const dias = objeto(l?.expediente).dias
  const diasValidos =
    Array.isArray(dias) && dias.length > 0 && dias.every((d) => Number.isInteger(d) && d >= 1 && d <= 7) ? (dias as number[]) : null
  return {
    diasExpediente: diasValidos ?? PRAZOS_PADRAO_COMPRAS.diasExpediente,
    folga: inteiroNaoNegativo(prazos.folga_processo_dias) ? prazos.folga_processo_dias : PRAZOS_PADRAO_COMPRAS.folga,
    entregaMaterial: inteiroNaoNegativo(prazos.entrega_material_dias) ? prazos.entrega_material_dias : PRAZOS_PADRAO_COMPRAS.entregaMaterial,
  }
}

// --- datas civis (YYYY-MM-DD), mesma aritmética do Compras (lib/solicitacoes/prazos.ts) ---
function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
function diaIsoSemana(data: string): number {
  const d = new Date(`${data}T12:00:00Z`).getUTCDay()
  return d === 0 ? 7 : d
}
const ehExpediente = (data: string, dias: readonly number[]) => dias.length === 0 || dias.includes(diaIsoSemana(data))

/** Início − (folga + entrega) dias de expediente: o inverso exato de `somarDiasDeExpediente` do Compras. */
export function pedirAte(inicio: string, p: PrazosCompras): string {
  let d = inicio
  for (let i = 0; i < p.folga + p.entregaMaterial; i++) {
    d = somarDias(d, -1)
    for (let k = 0; k < 7 && !ehExpediente(d, p.diasExpediente); k++) d = somarDias(d, -1)
  }
  return d
}

/** Dias de expediente depois de `de` até `ate` (inclusive). */
function diasUteisEntre(de: string, ate: string, dias: readonly number[]): number {
  let n = 0
  for (let d = somarDias(de, 1); d <= ate; d = somarDias(d, 1)) if (ehExpediente(d, dias)) n++
  return n
}

const dm = (data: string) => diaBr(data).slice(0, 5)

// --- compras da restrição ---
export type CompraDaRestricao = {
  solicitacaoNumero: number
  etapa: string
  enviadoEm: string | null
  dataMinima: string | null
  pedidos: { previsaoEntrega: string | null; entregue: boolean }[]
}

const texto = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))

/** Linhas de `obras_restricao_compras` → por restricao_id, pedidos agrupados por solicitação. */
export function comprasDeLinhas(linhas: Record<string, unknown>[]): Map<string, CompraDaRestricao[]> {
  const porRestricao = new Map<string, Map<string, CompraDaRestricao>>()
  for (const l of linhas) {
    const rid = String(l.restricao_id)
    const sid = String(l.solicitacao_id)
    const sols = porRestricao.get(rid) ?? new Map<string, CompraDaRestricao>()
    porRestricao.set(rid, sols)
    let c = sols.get(sid)
    if (!c) {
      c = {
        solicitacaoNumero: Number(l.solicitacao_numero),
        etapa: String(l.etapa),
        enviadoEm: texto(l.enviado_em),
        dataMinima: texto(l.data_minima),
        pedidos: [],
      }
      sols.set(sid, c)
    }
    if (l.pedido_id !== null && l.pedido_id !== undefined) {
      const p = pedidoDeLinha(l)
      c.pedidos.push({ previsaoEntrega: p.previsaoEntrega, entregue: pedidoEntregue(p) })
    }
  }
  return new Map([...porRestricao].map(([rid, sols]) => [rid, [...sols.values()]]))
}

// --- lista "Vem aí" ---
const JANELA_DIAS = 28
const inicioDe = (a: AtividadeCalculada) => a.inicioProjetado || a.inicioPrevisto

export type ItemVemAi = { numero: number; nome: string; inicio: string; pedirAte: string }

export function listaVemAi(p: {
  atividades: AtividadeCalculada[]
  restricoes: Restricao[]
  naoPrecisa: ReadonlySet<number>
  hoje: string
  prazos: PrazosCompras
}): ItemVemAi[] {
  const limite = somarDias(p.hoje, JANELA_DIAS)
  const comMaterial = new Set(p.restricoes.filter((r) => r.tipo === 'material').map((r) => r.atividadeNumero))
  return p.atividades
    .filter((a) => a.status === 'nao_iniciado' && inicioDe(a) <= limite && !p.naoPrecisa.has(a.numero) && !comMaterial.has(a.numero))
    .map((a) => ({ numero: a.numero, nome: a.descricao, inicio: inicioDe(a), pedirAte: pedirAte(inicioDe(a), p.prazos) }))
    .sort((x, y) => x.pedirAte.localeCompare(y.pedirAte) || x.numero - y.numero)
}

// --- avisos ---
export type AvisoMaterial = {
  tipo: 'sem_resposta' | 'pedir' | 'nao_chega' | 'parada'
  nivel: 'vermelho' | 'amarelo'
  atividade: number
  inicio: string
  titulo: string
  cadeia: string[]
  destino: 'diario' | 'compras' | 'lookahead'
  restricaoId: string | null
}

const ETAPA_TERMINADA_SEM_SUCESSO = ['cancelada', 'recusada']
const ETAPA_ENTREGUE = ['atendida_estoque', 'concluida']
const rotuloEtapa = (e: string) => (e === 'cotacao' ? 'cotação' : e.replace(/_/g, ' '))

export function avisosMaterial(p: {
  atividades: AtividadeCalculada[]
  restricoes: Restricao[]
  naoPrecisa: ReadonlySet<number>
  compras: Map<string, CompraDaRestricao[]> | null
  hoje: string
  prazos: PrazosCompras
}): AvisoMaterial[] {
  const avisos: AvisoMaterial[] = []
  const materiais = p.restricoes.filter((r) => r.tipo === 'material')
  const comMaterial = new Set(materiais.map((r) => r.atividadeNumero))
  const limite = somarDias(p.hoje, JANELA_DIAS)

  for (const a of p.atividades) {
    if (a.status !== 'nao_iniciado') continue
    const inicio = inicioDe(a)
    const pedirEm = pedirAte(inicio, p.prazos)
    const comeca = `Atividade ${a.numero} começa ${diaBr(inicio)}`

    // Sem resposta
    if (inicio <= limite && !p.naoPrecisa.has(a.numero) && !comMaterial.has(a.numero) && pedirEm <= p.hoje) {
      avisos.push({
        tipo: 'sem_resposta',
        nivel: 'vermelho',
        atividade: a.numero,
        inicio,
        titulo:
          pedirEm === p.hoje
            ? 'Ninguém respondeu e o prazo para pedir vence hoje'
            : `Ninguém respondeu e o prazo para pedir venceu em ${dm(pedirEm)}`,
        cadeia: [comeca, 'Material sem resposta'],
        destino: 'diario',
        restricaoId: null,
      })
    }

    for (const r of materiais) {
      if (r.atividadeNumero !== a.numero || r.situacao === 'liberada') continue
      const base = { atividade: a.numero, inicio, restricaoId: r.id }
      const pedir = (): AvisoMaterial => {
        const vencido = pedirEm <= p.hoje
        return {
          ...base,
          tipo: 'pedir',
          nivel: vencido ? 'vermelho' : 'amarelo',
          titulo: vencido
            ? pedirEm === p.hoje
              ? `Pedir hoje: ${r.descricao}`
              : `Pedir, vencido em ${dm(pedirEm)}: ${r.descricao}`
            : `Pedir até ${dm(pedirEm)}: ${r.descricao}`,
          cadeia: [comeca, r.descricao, 'Ainda sem solicitação no Compras'],
          destino: 'compras',
        }
      }

      if (p.compras === null) {
        // Sem leitura do Compras: só o que não depende dela. Ligação antiga (pedido manual) não é "sem pedido".
        if (!r.cmpPedidoId) avisos.push(pedir())
        continue
      }

      const vivas = (p.compras.get(r.id) ?? [])
        .filter((c) => !ETAPA_TERMINADA_SEM_SUCESSO.includes(c.etapa))
        .sort((x, y) => (y.enviadoEm ?? '').localeCompare(x.enviadoEm ?? '') || y.solicitacaoNumero - x.solicitacaoNumero)
      const sol = vivas[0]

      // Pedido manual antigo vale quando não há solicitação ligada pela origem.
      const pedidos = sol ? sol.pedidos : r.pedido ? [{ previsaoEntrega: r.pedido.previsaoEntrega, entregue: pedidoEntregue(r.pedido) }] : []
      if (!sol && !r.pedido) {
        if (!r.cmpPedidoId) avisos.push(pedir())
        continue
      }
      if (sol && ETAPA_ENTREGUE.includes(sol.etapa)) continue

      if (pedidos.length > 0) {
        const atrasadas = pedidos.filter((x) => !x.entregue && x.previsaoEntrega && x.previsaoEntrega > inicio)
        if (atrasadas.length > 0) {
          const pior = atrasadas.map((x) => x.previsaoEntrega!).sort().at(-1)!
          const n = diasUteisEntre(inicio, pior, p.prazos.diasExpediente)
          avisos.push({
            ...base,
            tipo: 'nao_chega',
            nivel: 'vermelho',
            titulo: `Material chega ${n} dia(s) útil(eis) depois do início`,
            cadeia: [comeca, r.descricao, `${sol ? `Solicitação #${sol.solicitacaoNumero}` : 'Pedido ligado'}: previsão ${diaBr(pior)}`],
            destino: 'lookahead',
          })
        }
        continue
      }

      if (sol && sol.dataMinima && p.hoje > sol.dataMinima) {
        avisos.push({
          ...base,
          tipo: 'parada',
          nivel: 'amarelo',
          titulo: `Solicitação #${sol.solicitacaoNumero} parada em ${rotuloEtapa(sol.etapa)}`,
          cadeia: [comeca, r.descricao, `Solicitação #${sol.solicitacaoNumero} em ${rotuloEtapa(sol.etapa)}, data mínima ${diaBr(sol.dataMinima)}`],
          destino: 'lookahead',
        })
      }
    }
  }

  return avisos.sort((x, y) => (x.nivel === y.nivel ? 0 : x.nivel === 'vermelho' ? -1 : 1) || x.inicio.localeCompare(y.inicio) || x.atividade - y.atividade)
}

export function linkPedirMaterial(p: { obraId: string; restricao: Restricao; atividade: { numero: number; nome: string; inicio: string } }): string {
  const e = encodeURIComponent
  return (
    `/compras/solicitacoes/nova?obra=${e(p.obraId)}&tipo=material&prazo=${e(p.atividade.inicio)}` +
    `&restricao=${e(p.restricao.id)}&atividade=${p.atividade.numero}&nome=${e(p.atividade.nome)}` +
    `&inicio=${e(p.atividade.inicio)}&material=${e(p.restricao.descricao)}`
  )
}
