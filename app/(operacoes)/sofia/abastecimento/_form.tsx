'use client'
import { useActionState } from 'react'
import { lancarAbastecimentoAction } from './_actions'
import type { Veiculo } from '@/lib/sofia/types'

export default function AbastecimentoForm({ veiculos }: { veiculos: Veiculo[] }) {
  const [state, action, isPending] = useActionState(lancarAbastecimentoAction, {})
  const hoje = new Date().toISOString().split('T')[0]

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">
          Abastecimento registrado com sucesso!
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Data</label>
        <input
          name="data"
          type="date"
          defaultValue={hoje}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Veículo *</label>
        <select
          name="veiculo_id"
          required
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="">Selecione o veículo</option>
          {veiculos
            .filter((v) => v.status === 'ativo')
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} · {v.modelo}
              </option>
            ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Litros *</label>
          <input
            name="litros"
            type="number"
            step="0.01"
            required
            placeholder="Ex: 45.5"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor (R$) *</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">KM no momento</label>
        <input
          name="km"
          type="number"
          placeholder="Ex: 45280"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Posto</label>
        <input
          name="posto"
          placeholder="Nome do posto"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Salvando...' : 'Registrar Abastecimento'}
      </button>
    </form>
  )
}
