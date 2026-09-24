'use client'

/**
 * O selo da obra cancelada e o "Desfazer cancelamento"
 * (spec-cancelamento-obra-2026-09-23 §6.3, mockup aprovado em 23/09, seção 3).
 *
 * Mesmo contrato da faixa de cancelar (`_cancelar-obra.tsx`): o `Dialogo` fecha
 * ao clicar e só depois roda a ação, então "Desfazendo…" e o erro aparecem no
 * selo. Sucesso = a rota revalida e a ficha volta à etapa anterior (ou à
 * Triagem). A action entra por prop, com o tipo declarado aqui.
 */

import { useState, useTransition } from 'react'
import Dialogo, { type BotaoDialogo } from '../../_ui/dialogo'
import { Botao } from '../../_ui/primitivos'
import { FUSO, nomeEtapa, rotuloCancelado, type CanceladoPor, type EtapaCiclo } from '../../_lib/tipos'

type DesfazerCancelamento = (obraId: string) => Promise<{ error?: string; success?: boolean }>

/** `timestamptz` → `DD/MM/AAAA` e `HH:MM`, no dia e na hora de São Paulo. */
function dataHoraSP(ts: string): { data: string; hora: string } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ts))
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? ''
  return { data: `${p('day')}/${p('month')}/${p('year')}`, hora: `${p('hour')}:${p('minute')}` }
}

export default function SeloCancelada({
  obraId,
  loja,
  os,
  por,
  obs,
  em,
  quem,
  etapaAnterior,
  responsavel,
  desfazer,
}: {
  obraId: string
  loja: string | null
  os: string | null
  por: CanceladoPor
  obs: string | null
  /** `cancelado_em`, timestamptz. */
  em: string
  /** `cancelado_quem`, o e-mail. */
  quem: string
  etapaAnterior: EtapaCiclo
  /** `obra.pcm`, para o texto "entra de novo no diário de …". */
  responsavel: string | null
  desfazer: DesfazerCancelamento
}) {
  const [aberto, setAberto] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  const { data, hora } = dataHoraSP(em)
  const anterior = nomeEtapa(etapaAnterior)
  const pelo = por === 'cliente' ? 'pelo Cliente' : 'pela Manfac'

  function confirmar() {
    setErro(null)
    iniciar(async () => {
      const r = await desfazer(obraId)
      if (r.error) setErro(r.error)
    })
  }

  const botoes: BotaoDialogo[] = [
    { id: 'd-desfazer-manter', texto: 'Manter cancelada', ghost: true },
    { id: 'd-desfazer-confirmar', texto: 'Desfazer cancelamento', onClick: confirmar },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3.5 rounded-lg border border-[#475569] border-l-4 border-l-[#94a3b8] bg-[#94a3b814] px-3.5 py-3">
      <span className="flex-none rounded-md border-[1.5px] border-dashed border-[#94a3b8] px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#cbd5e1]">
        Cancelada
      </span>
      <div className="min-w-[220px] flex-1 text-[12.5px] text-[#94a3b8]">
        <div className="mb-0.5 text-[14px] font-semibold text-[#e8eef7]">{rotuloCancelado(por)}</div>
        em{' '}
        <b className="text-[#e8eef7]">
          {data} às {hora}
        </b>{' '}
        por <b className="text-[#e8eef7]">{quem}</b> · estava em <b className="text-[#e8eef7]">{anterior}</b>
        {obs ? <div className="mt-1 italic">&quot;{obs}&quot;</div> : null}
        {erro && !pendente ? (
          <p role="alert" className="mt-1.5 text-xs font-semibold text-[#ff4d6d]">
            {erro}
          </p>
        ) : null}
      </div>
      <Botao type="button" tipo="secundario" disabled={pendente} onClick={() => setAberto(true)}>
        {pendente ? 'Desfazendo…' : 'Desfazer cancelamento'}
      </Botao>

      <Dialogo aberto={aberto} titulo="Desfazer o cancelamento?" botoes={botoes} onFechar={() => setAberto(false)}>
        <div className="flex flex-col gap-2">
          <p className="text-[12px] text-[#64748b]">
            {loja ?? '—'} · OS {os ?? '—'}
          </p>
          <p>
            A obra volta para <b className="text-[#e8eef7]">{anterior}</b>
            {etapaAnterior === 'definir'
              ? ' e abre de novo na Triagem.'
              : `, entra de novo no diário ${responsavel ? `de ${responsavel}` : 'do responsável'} e as tarefas abertas dela voltam a cobrar.`}
          </p>
          <p>
            O cancelamento {pelo} de {data} <b className="text-[#e8eef7]">continua no histórico</b>, junto com este
            desfazer.
          </p>
        </div>
      </Dialogo>
    </div>
  )
}
