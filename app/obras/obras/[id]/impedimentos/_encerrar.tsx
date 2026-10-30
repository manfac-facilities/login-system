'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { encerrarImpedimentoAction } from './_actions'

export default function BotaoEncerrar({ id, hoje }: { id: string; hoje: string }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [indo, setIndo] = useState(false)
  async function encerrar() {
    setIndo(true)
    setErro(null)
    const r = await encerrarImpedimentoAction(id, hoje)
    setIndo(false)
    if (!r.ok) return setErro(r.erro)
    router.refresh()
  }
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={indo}
        onClick={encerrar}
        className="min-h-11 rounded-lg border border-[#1e3a5f] px-3 text-sm text-[#e8eef7] hover:border-[#f05a28] disabled:opacity-45"
      >
        {indo ? 'encerrando…' : 'Encerrar hoje'}
      </button>
      {erro ? <span role="alert" className="text-xs text-[#ff4d6d]">{erro}</span> : null}
    </span>
  )
}
