'use client'
import { useActionState } from 'react'
import { atualizarEquipeVeiculoAction } from '@/app/(operacoes)/sofia/veiculos/_actions'
import type { Equipe } from '@/lib/sofia/types'

export default function EditarEquipeVeiculoForm({
  veiculoId,
  equipes,
  equipeAtualId,
}: {
  veiculoId: string
  equipes: Equipe[]
  equipeAtualId: string | null
}) {
  const [state, formAction, isPending] = useActionState(atualizarEquipeVeiculoAction, {})

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={veiculoId} />
      {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
      <div className="flex gap-2 items-end">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-[#94a3b8]">Equipe responsável</label>
          <select
            name="equipe_id"
            defaultValue={equipeAtualId ?? ''}
            className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
          >
            <option value="">Sem equipe vinculada</option>
            {equipes.filter((e) => e.ativo).map((e) => (
              <option key={e.id} value={e.id}>{e.codigo}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
