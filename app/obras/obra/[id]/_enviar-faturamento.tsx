'use client'

/**
 * Enviar para faturamento — botão e janela na ficha (Ciclo de vida).
 *
 * Só para clientes que NÃO liberam por e-mail (DPSP/D1000 não passam por aqui).
 * O `Dialogo` fecha em qualquer botão, então "Enviando…" e o erro ficam fora
 * dele, como em `_cancelar-obra.tsx`. A action entra por PROP, com o tipo
 * mínimo declarado aqui (armadilha 1 de `.claude/rules/obras.md`).
 */

import { useState, useTransition } from 'react'
import Dialogo, { type BotaoDialogo } from '../../_ui/dialogo'
import { Botao } from '../../_ui/primitivos'
import { podeEnviarParaFaturamento } from '../../_lib/faturamento-liberado'
import type { Obra } from '../../_lib/tipos'

type Enviar = (obraId: string, observacao: string | null) => Promise<{ error?: string; success?: boolean }>

function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export default function EnviarParaFaturamento({ obra, enviar }: { obra: Obra; enviar: Enviar }) {
  const [aberto, setAberto] = useState(false)
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pendente, iniciar] = useTransition()

  if (obra.fat_enviado_em) {
    return (
      <div className="px-4 pb-3 text-[12px] text-[#94a3b8]">
        <p>
          Enviada para faturamento em {dataBR(obra.fat_enviado_em)}
          {obra.fat_enviado_por ? ` por ${obra.fat_enviado_por}` : ''}
        </p>
        {obra.fat_enviado_obs ? <p className="mt-0.5 text-[#64748b]">{obra.fat_enviado_obs}</p> : null}
      </div>
    )
  }

  if (!podeEnviarParaFaturamento(obra)) return null

  function confirmar() {
    setErro(null)
    iniciar(async () => {
      const r = await enviar(obra.id, obs.trim() === '' ? null : obs.trim())
      if (r.error) setErro(r.error)
    })
  }

  const botoes: BotaoDialogo[] = [
    { id: 'd-enviar-fat-cancelar', texto: 'Cancelar', ghost: true },
    { id: 'd-enviar-fat-confirmar', texto: 'Enviar', onClick: confirmar },
  ]

  return (
    <div className="px-4 pb-3">
      <Botao type="button" tipo="secundario" disabled={pendente} onClick={() => setAberto(true)}>
        {pendente ? 'Enviando…' : 'Enviar para faturamento'}
      </Botao>

      {erro && !pendente ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-[#ff4d6d66] bg-[#ff4d6d14] px-3 py-2 text-[12px] text-[#cbd5e1]"
        >
          {erro}
        </div>
      ) : null}

      <Dialogo aberto={aberto} titulo="Enviar para faturamento" botoes={botoes} onFechar={() => setAberto(false)}>
        <div className="flex flex-col gap-3">
          <p className="text-[12.5px] text-[#94a3b8]">
            A obra vai para Pendente faturamento e o financeiro é avisado na fila dele.
          </p>
          <div className="flex flex-col gap-1">
            <label htmlFor={`obs-enviar-fat-${obra.id}`} className="text-[12px] font-semibold text-[#e8eef7]">
              Observação (opcional)
            </label>
            <textarea
              id={`obs-enviar-fat-${obra.id}`}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-[#1e3a5f] bg-[#0a1628] px-2 py-2 text-sm text-[#e8eef7] outline-none focus:border-[#f05a28]"
            />
          </div>
        </div>
      </Dialogo>
    </div>
  )
}
