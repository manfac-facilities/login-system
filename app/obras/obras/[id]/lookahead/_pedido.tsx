'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Restricao } from '../../_lib/last-planner'
import { prontaParaLiberar, rotuloPedido, textoDatasPedido, type PedidoDaRestricao } from '../../_lib/restricao-pedido'
import { ligarPedidoAction } from './_actions'

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
