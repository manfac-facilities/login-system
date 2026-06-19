'use client'
import { useActionState } from 'react'
import { atualizarCentroCustoAction } from './_actions'

export default function CentroCustoForm({ veiculoId, atual }: { veiculoId: string; atual: string }) {
  const [state, action, isPending] = useActionState(atualizarCentroCustoAction, {})
  const hoje = new Date().toISOString().split('T')[0]

  return (
    <details>
      <summary className="text-xs text-[#f05a28] cursor-pointer hover:underline">Atualizar centro de custo</summary>
      <form action={action} className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-[#1e3a5f] bg-[#0a1628] text-left w-56">
        <input type="hidden" name="veiculo_id" value={veiculoId} />
        {state.error && <p className="text-red-300 text-xs">{state.error}</p>}
        {state.success && <p className="text-green-300 text-xs">Atualizado!</p>}
        <input
          name="centro_custo"
          defaultValue={atual}
          placeholder="Novo centro de custo"
          className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
        />
        <input
          name="vigente_desde"
          type="date"
          defaultValue={hoje}
          className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs [color-scheme:dark]"
        />
        <button type="submit" disabled={isPending} className="py-1.5 rounded bg-[#f05a28] text-white text-xs font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </details>
  )
}
