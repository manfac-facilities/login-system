'use client'

import { useActionState, useEffect, useRef } from 'react'
import { enviarMensagemAction, type EstadoMensagem } from './_actions'

export function FormMensagem({ obraId }: { obraId: string }) {
  const [estado, acao, pendente] = useActionState(enviarMensagemAction.bind(null, obraId), {} as EstadoMensagem)
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (estado.ok) ref.current?.reset()
  }, [estado])
  return (
    <form ref={ref} action={acao} className="mt-4 flex flex-col gap-3">
      {estado.erro ? <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-800">{estado.erro}</p> : null}
      {estado.ok ? <p role="status" className="text-[15px] text-(--obra-verde-texto)">Mensagem enviada.</p> : null}
      <label htmlFor="texto" className="text-[15px] font-semibold text-(--obra-ink)">Escreva para a engenharia da Manfac</label>
      <textarea id="texto" name="texto" required maxLength={4000} rows={4}
        className="min-h-[96px] w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-[16px] text-slate-900 focus:border-[#f05a28] focus:ring-1 focus:ring-[#f05a28] focus:outline-none" />
      <button type="submit" disabled={pendente}
        className="min-h-[44px] self-start rounded-lg bg-[#c2410c] px-6 py-3 font-semibold text-white hover:bg-[#9a3412] disabled:opacity-60">
        {pendente ? 'Enviando…' : 'Enviar mensagem'}
      </button>
    </form>
  )
}
