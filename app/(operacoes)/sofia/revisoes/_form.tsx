'use client'
import { useActionState } from 'react'
import { registrarRevisaoAction } from './_actions'
import type { Veiculo } from '@/lib/sofia/types'

export default function RevisoesForm({ veiculos }: { veiculos: Veiculo[] }) {
  const [state, action, isPending] = useActionState(registrarRevisaoAction, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">
          Revisão registrada!
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Veículo *</label>
        <select
          name="veiculo_id"
          required
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="">Selecione</option>
          {veiculos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.placa} · {v.modelo}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">KM na última revisão *</label>
        <input
          name="km_ultima_revisao"
          type="number"
          required
          placeholder="Ex: 45000"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Data da revisão</label>
        <input
          name="data_ultima_revisao"
          type="date"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Observações</label>
        <textarea
          name="observacoes"
          rows={2}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Salvando...' : 'Registrar Revisão'}
      </button>
    </form>
  )
}
