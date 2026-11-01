'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { textoAviso, type AvisoLocacao } from '../../../_lib/locacao'
import { textoDeCentavos } from '../../../_lib/medicao'
import { marcarDevolvidaAction, renovarLocacaoAction } from './_actions'
import type { Locacao } from './_tipos'

const th = 'px-3 py-2 text-left text-[12px] font-semibold uppercase tracking-[0.04em] text-(--obra-muted-texto) whitespace-nowrap'
const td = 'px-3 py-2 align-top text-[14px] text-(--obra-text)'
const campo = 'obra-num min-h-11 rounded-lg border border-(--obra-border) bg-white px-3 text-base text-(--obra-text)'
const botao = 'min-h-11 rounded-lg border border-(--obra-border) bg-white px-3 text-sm text-(--obra-ink) hover:border-(--obra-orange-texto) disabled:opacity-45'
const dia = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—')

export type LocacaoTela = Locacao & { aviso: AvisoLocacao | null; pode: boolean }

function Situacao({ l }: { l: LocacaoTela }) {
  const base = 'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold'
  if (l.estado === 'devolvida') return <span className={base + ' bg-(--obra-surface) text-(--obra-muted-texto)'}>devolvida {l.devolvidaEm ? dia(l.devolvidaEm).slice(0, 5) : ''}</span>
  if (l.aviso?.tipo === 'vencida' || l.aviso?.tipo === 'hoje') return <span className={base + ' bg-[#fdeeee] text-(--obra-vermelho-texto)'}>{textoAviso(l.aviso)}</span>
  if (l.aviso) return <span className={base + ' bg-[#fdf6d8] text-(--obra-yellow-texto)'}>{textoAviso(l.aviso)}</span>
  if (!l.inicio) return <span className={base + ' bg-(--obra-surface) text-(--obra-muted-texto)'}>aguardando entrega</span>
  if (l.semPeriodo) return <span className={base + ' bg-(--obra-surface) text-(--obra-muted-texto)'}>sem período</span>
  return <span className={base + ' bg-[#e7f5ec] text-(--obra-verde-texto)'}>{l.estado === 'renovada' ? 'renovada · em uso' : 'em uso'}</span>
}

function Acoes({ obraId, l, hoje }: { obraId: string; l: LocacaoTela; hoje: string }) {
  const router = useRouter()
  const [modo, setModo] = useState<'devolver' | 'renovar' | null>(null)
  const [data, setData] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  if (!l.pode || l.estado === 'devolvida') return null

  async function confirmar() {
    setIndo(true)
    setErro(null)
    const r = modo === 'devolver' ? await marcarDevolvidaAction(obraId, l.pedidoId, data) : await renovarLocacaoAction(obraId, l.pedidoId, data)
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    setModo(null)
    router.refresh()
  }

  if (!modo) {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={botao} onClick={() => { setModo('devolver'); setData(hoje) }}>
          Marcar devolvida
        </button>
        <button type="button" className={botao} onClick={() => { setModo('renovar'); setData('') }}>
          Renovar
        </button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1 text-[13px] text-(--obra-muted-texto)">
        {modo === 'devolver' ? 'Devolvida em' : 'Renovada até'}
        <input type="date" className={campo} value={data} max={modo === 'devolver' ? hoje : undefined} min={modo === 'renovar' && l.fim ? l.fim : undefined} onChange={(e) => setData(e.target.value)} />
      </label>
      <div className="flex gap-1.5">
        <button type="button" disabled={indo || !data} onClick={confirmar} className="min-h-11 rounded-lg bg-(--obra-orange-texto) px-3 text-sm font-semibold text-white disabled:opacity-45">
          {indo ? 'salvando…' : 'Confirmar'}
        </button>
        <button type="button" className={botao} onClick={() => setModo(null)}>
          Cancelar
        </button>
      </div>
      {erro ? <p role="alert" className="text-xs text-(--obra-vermelho-texto)">{erro}</p> : null}
    </div>
  )
}

export default function ListaLocacoes({ obraId, locacoes, valores, hoje, varias }: { obraId: string; locacoes: LocacaoTela[]; valores: boolean; hoje: string; varias: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-(--obra-ink)">Locações da obra</h2>
          <p className="text-[13px] text-(--obra-muted-texto)">
            Aviso 5 dias úteis antes do fim e no dia do vencimento, para o engenheiro decidir: devolver ou renovar.
          </p>
        </div>
        {/* Compras é outra app: <a> comum em nova aba, nunca next/link. */}
        <a
          href={`/compras/solicitacoes/nova?obra=${obraId}&tipo=locacao`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-lg bg-(--obra-orange-texto) px-4 text-sm font-semibold text-white"
        >
          + Nova locação ↗
        </a>
      </div>
      <div className="rounded-r-lg border-l-4 border-(--obra-ink) bg-[#eef2fb] px-3 py-2 text-[14px] text-(--obra-text)">
        <b>Nova locação abre o Compras em nova aba</b>, já com a obra e o tipo Locação. Quando o pedido é emitido, a locação aparece aqui sozinha; o início vem da entrega no Compras e o fim vem do período informado na solicitação.
      </div>
      <section aria-label="Lista de locações" className="rounded-xl border border-(--obra-border) bg-(--obra-card) p-4">
        {locacoes.length === 0 ? (
          <p className="text-sm text-(--obra-muted-texto)">Nenhuma locação com pedido emitido nesta obra.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-(--obra-border)">
                  <th className={th}>Item</th>
                  <th className={th}>Fornecedor</th>
                  <th className={th}>Início</th>
                  <th className={th}>Fim</th>
                  {valores ? <th className={th + ' text-right'}>Valor</th> : null}
                  <th className={th}>Situação</th>
                  <th className={th}><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {locacoes.map((l) => (
                  <tr key={l.pedidoId} className="border-b border-(--obra-border)">
                    <td className={td}>
                      <span className="block">{l.item}</span>
                      <span className="block text-[12px] text-(--obra-muted-texto)">
                        {l.solicitacaoNumero !== null ? `Solicitação nº ${l.solicitacaoNumero}` : ''}
                        {varias && l.os ? ` · OS ${l.os}` : ''}
                      </span>
                    </td>
                    <td className={td}>{l.fornecedor ?? '—'}</td>
                    <td className={td + ' obra-num whitespace-nowrap'}>{dia(l.inicio)}</td>
                    <td className={td + ' obra-num whitespace-nowrap'}>
                      {dia(l.fim)}
                      {l.renovadaAte ? <span className="block text-[12px] text-(--obra-muted-texto)">renovada</span> : null}
                    </td>
                    {valores ? <td className={td + ' obra-num text-right whitespace-nowrap'}>{l.totalCentavos === null ? '—' : textoDeCentavos(l.totalCentavos)}</td> : null}
                    <td className={td}><Situacao l={l} /></td>
                    <td className={td}><Acoes obraId={obraId} l={l} hoje={hoje} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {valores ? <p className="mt-2 text-[13px] text-(--obra-muted-texto)">O valor entra em &quot;Custos por origem · Locações&quot;. O pagamento continua pelo Financeiro, com a obra preenchida.</p> : null}
      </section>
    </div>
  )
}
