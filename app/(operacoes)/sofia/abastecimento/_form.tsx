'use client'
import { useActionState, useState } from 'react'
import { lancarAbastecimentoAction } from './_actions'
import type { Equipe, Veiculo } from '@/lib/sofia/types'

interface Props {
  equipes: Equipe[]
  veiculos: Veiculo[]
}

export default function AbastecimentoForm({ equipes, veiculos }: Props) {
  const [state, action, isPending] = useActionState(lancarAbastecimentoAction, {})
  const [equipeId, setEquipeId] = useState('')
  const hoje = new Date().toISOString().split('T')[0]

  const veiculoDaEquipe = veiculos.find((v) => v.equipe_id === equipeId && v.status === 'ativo')

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
        <label className="text-sm text-[#94a3b8]">Equipe *</label>
        <select
          required
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="">Selecione a equipe</option>
          {equipes
            .filter((e) => e.ativo)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo}
              </option>
            ))}
        </select>
      </div>

      <input type="hidden" name="veiculo_id" value={veiculoDaEquipe?.id ?? ''} />

      {equipeId && (
        <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
          {veiculoDaEquipe ? (
            <p className="text-[#94a3b8]">
              Veículo: <span className="text-white font-mono">{veiculoDaEquipe.placa}</span>
              {' · '}{veiculoDaEquipe.modelo}
            </p>
          ) : (
            <p className="text-amber-400 text-xs">Nenhum veículo ativo vinculado a esta equipe</p>
          )}
        </div>
      )}

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
        disabled={isPending || !veiculoDaEquipe}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
      >
        {isPending ? 'Salvando...' : 'Registrar Abastecimento'}
      </button>
    </form>
  )
}
