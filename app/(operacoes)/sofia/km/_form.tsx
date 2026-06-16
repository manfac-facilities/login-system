'use client'
import { useActionState } from 'react'
import { lancarKmAction } from './_actions'
import type { Equipe, Veiculo, Motorista } from '@/lib/sofia/types'

interface Props {
  equipes: Equipe[]
  veiculos: Veiculo[]
  motoristas: Motorista[]
}

export default function KmForm({ equipes, veiculos, motoristas }: Props) {
  const [state, action, isPending] = useActionState(lancarKmAction, {})
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
          KM registrado com sucesso!
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
          name="equipe_id"
          required
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

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Motorista</label>
        <select
          name="motorista_id"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="">Selecione o motorista</option>
          {motoristas
            .filter((m) => m.ativo)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">KM Inicial *</label>
          <input
            name="km_inicial"
            type="number"
            required
            placeholder="Ex: 45000"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">KM Final</label>
          <input
            name="km_final"
            type="number"
            placeholder="Ex: 45280"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Observações</label>
        <textarea
          name="observacoes"
          rows={2}
          placeholder="Opcional"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Salvando...' : 'Registrar KM'}
      </button>
    </form>
  )
}
