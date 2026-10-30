'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { encerrarImpedimentoAction } from './_actions'

/** `data` já vem resolvida (`dataEncerramento`): data do diário ou hoje, nunca antes da abertura. */
export default function BotaoEncerrar({ id, data, hoje }: { id: string; data: string; hoje: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  async function encerrar() {
    setIndo(true)
    setErro(null)
    try {
      const r = await encerrarImpedimentoAction(id, data)
      if (!r.ok) return setErro(r.erro)
      router.refresh()
    } catch {
      setErro('Não deu para encerrar. Confira a conexão e tente de novo.')
    } finally {
      setIndo(false)
    }
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={indo}
        onClick={encerrar}
        className="min-h-11 rounded-lg border border-[#dadad8] px-3 text-sm text-[#333336] hover:border-[#b94606] disabled:opacity-45"
      >
        {indo ? 'encerrando…' : data === hoje ? 'Encerrar hoje' : `Encerrar em ${data.slice(8, 10)}/${data.slice(5, 7)}`}
      </button>
      {erro ? <span role="alert" className="text-xs text-[#b23232]">{erro}</span> : null}
    </span>
  )
}
