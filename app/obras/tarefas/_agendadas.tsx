'use client'

/**
 * Seção "Agendadas" de Tarefas — obras que o analista tirou do diário até a data
 * de um levantamento (spec 16/10/2026 §4.4). Fica ACIMA da lista de tarefas, que
 * não muda. No dia marcado a obra já voltou ao diário sozinha; aqui só sobra o
 * "Marcar como feito", que limpa o agendamento.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { agendadaForaDoDiario, ddmm, nomeDeQuemAgendou } from '../_lib/agendamento'
import type { ObraRow } from '../_lib/tipos'
import { Box, BoxB, BoxH, EstadoVazio, Pill } from '../_ui/primitivos'
import { encerrarAgendamentoAction } from '../diario/_actions'

export type ObraAgendada = Pick<
  ObraRow,
  | 'id'
  | 'os'
  | 'loja'
  | 'pcm'
  | 'etapa'
  | 'diario_agendado_ate'
  | 'diario_agendado_oque'
  | 'diario_agendado_motivo'
  | 'diario_agendado_por'
>

function minuscula(s: string | null | undefined): string {
  const t = s ?? ''
  return t.charAt(0).toLowerCase() + t.slice(1)
}

export default function Agendadas({
  obras,
  pessoasPorEmail,
  hoje,
}: {
  obras: ObraAgendada[]
  pessoasPorEmail: { email: string; nome: string }[]
  hoje: string
}) {
  const ordenadas = [...obras].sort((a, b) => (a.diario_agendado_ate ?? '').localeCompare(b.diario_agendado_ate ?? ''))
  const fora = ordenadas.filter((o) => agendadaForaDoDiario(o, hoje)).length

  return (
    <Box>
      <BoxH
        extra={`${fora} ${fora === 1 ? 'obra fora' : 'obras fora'} do diário`}
      >
        <>
          Agendadas <Pill cor="#f05a28">novo</Pill>
        </>
      </BoxH>
      <BoxB className="flex flex-col gap-2.5">
        <p className="m-0 text-[12px] text-[#94a3b8]">
          Obras que saíram do diário até a data do levantamento. No dia marcado elas voltam sozinhas.
        </p>
        {ordenadas.length === 0 ? (
          <EstadoVazio>
            Nenhuma obra agendada. Quando alguém tirar uma obra do diário por causa de um levantamento, ela aparece
            aqui.
          </EstadoVazio>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {ordenadas.map((o) => (
              <Linha key={o.id} obra={o} pessoasPorEmail={pessoasPorEmail} hoje={hoje} />
            ))}
          </ul>
        )}
      </BoxB>
    </Box>
  )
}

function Linha({
  obra,
  pessoasPorEmail,
  hoje,
}: {
  obra: ObraAgendada
  pessoasPorEmail: { email: string; nome: string }[]
  hoje: string
}) {
  const router = useRouter()
  const [pendente, iniciar] = useTransition()
  const [erro, setErro] = useState<string | null>(null)

  const ate = obra.diario_agendado_ate!
  const voltou = !agendadaForaDoDiario(obra, hoje)
  const dono = nomeDeQuemAgendou(obra.diario_agendado_por ?? '', pessoasPorEmail)
  const loja = obra.loja ?? 'Obra sem loja'
  const os = obra.os ?? '—'
  const motivo = obra.diario_agendado_motivo ?? ''

  function feito() {
    setErro(null)
    iniciar(async () => {
      const r = await encerrarAgendamentoAction(obra.id, 'feito')
      if (r.error) {
        setErro(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <li className="rounded-md border border-[#1e3a5f] bg-[#0a1628] px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-[#e8eef7]">
          {voltou ? `Hoje: ${minuscula(obra.diario_agendado_oque)} na ${loja}` : obra.diario_agendado_oque}
        </span>
        {voltou ? null : <span className="text-sm font-semibold text-[#f05a28]">{ddmm(ate)}</span>}
      </div>
      <p className="m-0 mt-0.5 text-[12px] text-[#94a3b8]">
        {voltou
          ? `OS ${os} · dono ${dono} · motivo: ${motivo}`
          : `${loja} · OS ${os} · dono ${dono} · motivo: ${motivo}`}
      </p>
      {voltou ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[12px] text-[#35c98a]">
            {ate === hoje ? 'A obra já voltou ao diário.' : `A obra já voltou ao diário desde ${ddmm(ate)}.`}
          </span>
          <button
            type="button"
            disabled={pendente}
            onClick={feito}
            className="min-h-9 rounded-md border border-[#1e3a5f] px-2.5 py-1.5 text-[12px] text-[#e8eef7] hover:border-[#f05a28] disabled:opacity-45"
          >
            {pendente ? 'salvando…' : 'Marcar como feito'}
          </button>
        </div>
      ) : null}
      {erro ? <p className="m-0 mt-1 text-[12px] text-[#ff4d6d]">{erro}</p> : null}
    </li>
  )
}
