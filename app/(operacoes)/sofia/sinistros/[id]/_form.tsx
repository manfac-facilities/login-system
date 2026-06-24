'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { atualizarTratativaSinistroAction } from '../_actions'
import type { Sinistro } from '@/lib/sofia/types'

export default function TratativaForm({ sinistro }: { sinistro: Sinistro }) {
  const [state, action, isPending] = useActionState(atualizarTratativaSinistroAction, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.refresh()
  }, [state.success, router])

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={sinistro.id} />

      {state.error && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Status</label>
        <select
          name="status"
          defaultValue={sinistro.status}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="aberto">Aberto</option>
          <option value="em_tratativa">Em tratativa</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors w-fit px-6"
      >
        {isPending ? 'Salvando...' : 'Salvar tratativa'}
      </button>
    </form>
  )
}
