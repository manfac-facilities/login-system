'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Restricao } from '../../_lib/last-planner'
import { diaIso, pedidoEntregue, prontaParaLiberar, rotuloPedido, textoDatasPedido, type PedidoDaRestricao } from '../../_lib/restricao-pedido'
import {
  ETAPA_ENTREGUE, diasUteisEntre, linkPedirMaterial, pedirAte, rotuloEtapa, solicitacaoVigente,
  type CompraDaRestricao, type PrazosCompras,
} from '../../_lib/material'
import { desfazerNaoPrecisaAction, ligarPedidoAction } from './_actions'

const btn = 'min-h-11 rounded-lg border border-[#dadad8] px-3 text-sm text-[#333336] hover:border-[#b94606] disabled:opacity-45'

/**
 * Restrição de Material ↔ pedido do Compras. A lista vem de `obras_restricao_pedidos`
 * (sem valores). Com o pedido entregue aparece o selo "Pronta para liberar" — quem libera é o
 * engenheiro, no quadro (nunca automático). `pedidos` null = a leitura do Compras falhou.
 */
export default function PedidoDaRestricaoBloco({
  obraId,
  restricao,
  pedidos,
}: {
  obraId: string
  restricao: Restricao
  pedidos: PedidoDaRestricao[] | null
}) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [escolha, setEscolha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  async function salvar(pedidoId: string | null) {
    setIndo(true)
    setErro(null)
    try {
      const r = await ligarPedidoAction(restricao.id, pedidoId)
      if (!r.ok) return setErro(r.erro)
      setAberto(false)
      router.refresh()
    } catch {
      setErro('Não deu certo. Confira a conexão e tente de novo.')
    } finally {
      setIndo(false)
    }
  }

  const p = restricao.pedido
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[#dadad8] bg-[#f6f6f5] p-2">
      {restricao.cmpPedidoId ? (
        <div className="flex flex-col gap-1 text-xs text-[#333336]">
          {p ? (
            <>
              <span className="font-semibold text-[#00345e]">{rotuloPedido(p)}</span>
              <span>{textoDatasPedido(p)}</span>
            </>
          ) : (
            <span className="text-[#5a7380]">Pedido ligado (datas indisponíveis agora)</span>
          )}
          {prontaParaLiberar(restricao) ? (
            <span className="self-start rounded-full border border-[#136c38] px-2 py-0.5 text-xs font-semibold text-[#136c38]">
              Pronta para liberar
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <a href={`/compras/solicitacoes/nova?obra=${obraId}`} target="_blank" rel="noopener noreferrer" className={btn + ' inline-flex items-center'}>
          Pedir material
        </a>
        {!aberto ? (
          <button type="button" className={btn} disabled={indo} onClick={() => setAberto(true)}>
            {restricao.cmpPedidoId ? 'Trocar pedido' : 'Ligar a um pedido do Compras'}
          </button>
        ) : null}
        {restricao.cmpPedidoId && !aberto ? (
          <button type="button" className={btn} disabled={indo} onClick={() => salvar(null)}>
            Desligar
          </button>
        ) : null}
      </div>
      {aberto ? (
        pedidos === null ? (
          <p role="alert" className="text-xs text-[#b23232]">Não deu para ler os pedidos do Compras agora.</p>
        ) : pedidos.length === 0 ? (
          <p className="text-xs text-[#5a7380]">Nenhum pedido do Compras nesta obra ainda.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <select
              aria-label="Pedido do Compras"
              value={escolha}
              onChange={(e) => setEscolha(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-[#dadad8] bg-white px-3 text-sm text-[#333336]"
            >
              <option value="">Escolha o pedido</option>
              {pedidos.map((x) => (
                <option key={x.pedidoId} value={x.pedidoId}>
                  {rotuloPedido(x)}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={indo || !escolha}
                onClick={() => salvar(escolha)}
                className="min-h-11 rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white disabled:opacity-45"
              >
                {indo ? 'salvando…' : 'Ligar'}
              </button>
              <button type="button" className={btn} onClick={() => setAberto(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )
      ) : null}
      {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
    </div>
  )
}

// ── Material antecipado (spec §5.3): trilha Restrição → Solicitação → Cotação → Pedido → Entrega ──

const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
type Marco = { estado: 'ok' | 'agora' | 'ruim' | 'futuro'; titulo: string; detalhe: string }
const COR_MARCO: Record<Marco['estado'], string> = {
  ok: 'border-(--obra-verde) text-(--obra-verde-texto)',
  agora: 'border-(--obra-orange) text-(--obra-orange-texto)',
  ruim: 'border-(--obra-vermelho) text-(--obra-vermelho-texto)',
  futuro: 'border-(--obra-border) text-(--obra-muted-texto)',
}
const pill = 'rounded-full border px-2 py-0.5 text-xs font-semibold'
const VERMELHO = 'border-(--obra-vermelho-texto) text-(--obra-vermelho-texto)'

/**
 * Onde a compra da restrição de material está, com as datas do Compras (sem valores). `compras`
 * null = leitura do Compras falhou: só "andamento indisponível agora" (nunca um estado inventado).
 * A solicitação ligada pela origem manda; sem ela vale o pedido ligado à mão (comportamento antigo).
 */
export function TrilhaMaterial({
  obraId,
  restricao: r,
  atividade,
  compras,
  hoje,
  prazos,
  selecionada = false,
}: {
  obraId: string
  restricao: Restricao
  atividade: { numero: number; nome: string; inicio: string }
  compras: CompraDaRestricao[] | null
  hoje: string
  prazos: PrazosCompras
  selecionada?: boolean
}) {
  const inicio = atividade.inicio
  const limite = pedirAte(inicio, prazos)
  const sol = compras ? solicitacaoVigente(compras) : undefined
  const entrega = `precisa estar na obra em ${dm(inicio)}`
  const marcos: Marco[] = [{ estado: 'ok', titulo: 'Restrição', detalhe: r.descricao }]
  let pronta = false
  let selo: { texto: string; cor: string } | null = null
  let acao: { rotulo: string; href: string } | null = null

  if (sol) {
    const enviada = sol.enviadoEm ? diaIso(sol.enviadoEm) : null
    marcos.push({
      estado: 'ok',
      titulo: `Solicitação #${sol.solicitacaoNumero}`,
      detalhe: enviada ? `enviada ${dm(enviada)}${enviada <= limite ? ' · no prazo' : ' · depois do pedir até'}` : '',
    })
    acao = { rotulo: 'Ver no Compras', href: `/compras/solicitacoes/${sol.solicitacaoNumero}` }
    if (ETAPA_ENTREGUE.includes(sol.etapa)) {
      pronta = true
      marcos.push(
        { estado: 'ok', titulo: 'Cotação', detalhe: 'concluída' },
        { estado: 'ok', titulo: 'Pedido', detalhe: sol.etapa === 'atendida_estoque' ? 'atendido pelo estoque' : 'concluído' },
        { estado: 'ok', titulo: 'Entrega', detalhe: 'entregue' },
      )
    } else if (sol.pedidos.length === 0) {
      const minima = sol.dataMinima
      const parada = !!minima && hoje > minima
      marcos.push(
        parada
          ? {
              estado: 'ruim',
              titulo: 'Cotação parada',
              detalhe: `data mínima do Compras era ${dm(minima)} · ${diasUteisEntre(minima, hoje, prazos.diasExpediente)} dia(s) útil(eis) além`,
            }
          : { estado: 'agora', titulo: rotuloEtapa(sol.etapa), detalhe: minima ? `data mínima ${dm(minima)}` : '' },
        { estado: 'futuro', titulo: 'Pedido', detalhe: '' },
        { estado: 'futuro', titulo: 'Entrega', detalhe: entrega },
      )
      if (parada) selo = { texto: 'Solicitação parada', cor: 'border-(--obra-yellow-texto) text-(--obra-yellow-texto)' }
    } else {
      const faltam = sol.pedidos.filter((x) => !x.entregue)
      marcos.push(
        { estado: 'ok', titulo: 'Cotação', detalhe: 'concluída' },
        { estado: 'ok', titulo: 'Pedido', detalhe: `${sol.pedidos.length} pedido(s)` },
      )
      if (faltam.length === 0) {
        pronta = true
        marcos.push({ estado: 'ok', titulo: 'Entrega', detalhe: 'entregue' })
      } else {
        const pior = faltam
          .map((x) => x.previsaoEntrega)
          .filter((x): x is string => !!x)
          .sort()
          .at(-1)
        if (!pior) marcos.push({ estado: 'agora', titulo: 'Entrega', detalhe: `sem previsão · ${entrega}` })
        else if (pior > inicio) {
          marcos.push({
            estado: 'ruim',
            titulo: `Previsão ${dm(pior)}`,
            detalhe: `${diasUteisEntre(inicio, pior, prazos.diasExpediente)} dia(s) útil(eis) depois do início (${dm(inicio)})`,
          })
          selo = { texto: 'Não chega a tempo', cor: VERMELHO }
        } else marcos.push({ estado: 'agora', titulo: `Previsão ${dm(pior)}`, detalhe: `antes do início (${dm(inicio)})` })
      }
    }
  } else if (r.cmpPedidoId) {
    const p = r.pedido
    pronta = prontaParaLiberar(r)
    marcos.push(
      { estado: 'ok', titulo: 'Pedido', detalhe: p ? rotuloPedido(p) : 'pedido ligado (datas indisponíveis agora)' },
      { estado: p && pedidoEntregue(p) ? 'ok' : 'agora', titulo: 'Entrega', detalhe: p ? textoDatasPedido(p) : '' },
    )
  } else if (compras === null) {
    marcos.push({ estado: 'futuro', titulo: 'Compra', detalhe: 'andamento indisponível agora' })
  } else {
    const vencido = limite <= hoje
    marcos.push(
      { estado: vencido ? 'ruim' : 'agora', titulo: `Pedir até ${dm(limite)}`, detalhe: 'nenhuma solicitação ainda' },
      { estado: 'futuro', titulo: 'Cotação', detalhe: '' },
      { estado: 'futuro', titulo: 'Pedido', detalhe: '' },
      { estado: 'futuro', titulo: 'Entrega', detalhe: entrega },
    )
    if (vencido) selo = { texto: limite === hoje ? 'Pedir hoje' : `Pedir: vencido em ${dm(limite)}`, cor: VERMELHO }
    acao = { rotulo: 'Pedir no Compras', href: linkPedirMaterial({ obraId, restricao: r, atividade }) }
  }
  if (r.situacao === 'liberada') pronta = false

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border bg-(--obra-surface) p-2 ${selecionada ? 'border-2 border-(--obra-orange-texto)' : 'border-(--obra-border)'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-(--obra-ink)">Material: {r.descricao}</span>
        {pronta ? <span className={`${pill} border-(--obra-verde-texto) text-(--obra-verde-texto)`}>Pronta para liberar</span> : null}
        {!pronta && selo ? <span className={`${pill} ${selo.cor}`}>{selo.texto}</span> : null}
      </div>
      <ol aria-label="Trilha da compra" className="grid gap-1 sm:auto-cols-fr sm:grid-flow-col">
        {marcos.map((m, i) => (
          <li key={i} className={`flex flex-col border-l-2 pl-2 text-xs sm:border-t-2 sm:border-l-0 sm:pt-1 sm:pl-0 ${COR_MARCO[m.estado]}`}>
            <b className="font-semibold">{m.titulo}</b>
            {m.detalhe ? <span className="obra-num text-(--obra-muted-texto)">{m.detalhe}</span> : null}
          </li>
        ))}
      </ol>
      {acao ? (
        // Compras é outra app: <a> comum em nova aba.
        <a href={acao.href} target="_blank" rel="noopener noreferrer" className={btn + ' inline-flex w-fit items-center bg-white'}>
          {acao.rotulo}
        </a>
      ) : null}
    </div>
  )
}

/** "Desfazer não precisa": a atividade volta ao "Vem aí". */
export function DesfazerNaoPrecisa({ obraId, numero }: { obraId: string; numero: number }) {
  const router = useRouter()
  const [indo, setIndo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  async function desfazer() {
    setIndo(true)
    setErro(null)
    try {
      const r = await desfazerNaoPrecisaAction(obraId, numero)
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    } catch {
      setErro('Não deu certo. Confira a conexão e tente de novo.')
    } finally {
      setIndo(false)
    }
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" className={btn} disabled={indo} onClick={desfazer}>
        Desfazer não precisa
      </button>
      {erro ? (
        <span role="alert" className="text-xs text-[#b23232]">
          {erro}
        </span>
      ) : null}
    </span>
  )
}
