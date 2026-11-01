'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { responderMensagemAction } from './_mensagens'

/** Resposta da Manfac ao cliente (engenheiro/admin). O texto vai como texto puro. */
export default function ResponderForm({ obraId }: { obraId: string }) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)

  async function enviar() {
    setIndo(true)
    setErro(null)
    const r = await responderMensagemAction(obraId, texto)
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    setTexto('')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        aria-label="Resposta ao cliente"
        rows={4}
        maxLength={4000}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        className="rounded-lg border border-[#dadad8] bg-[#ffffff] px-3 py-2 text-base text-[#333336]"
      />
      {erro ? <p role="alert" className="text-xs text-[#b23232]">{erro}</p> : null}
      <button
        type="button"
        disabled={indo || !texto.trim()}
        onClick={enviar}
        className="min-h-11 self-start rounded-lg bg-[#b94606] px-4 text-sm font-semibold text-white disabled:opacity-45"
      >
        {indo ? 'enviando…' : 'Responder ao cliente'}
      </button>
    </div>
  )
}
