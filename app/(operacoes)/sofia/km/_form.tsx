'use client'
import { useActionState, useState } from 'react'
import { lancarKmAction } from './_actions'
import type { Equipe, Veiculo, Motorista } from '@/lib/sofia/types'

interface Props {
  equipes: Equipe[]
  veiculos: Veiculo[]
  motoristas: Motorista[]
}

export default function KmForm({ equipes, veiculos, motoristas }: Props) {
  const [state, action, isPending] = useActionState(lancarKmAction, {})
  const [equipeId, setEquipeId] = useState('')
  const hoje = new Date().toISOString().split('T')[0]

  const veiculoDaEquipe = veiculos.find((v) => v.equipe_id === equipeId && v.status === 'ativo')
  const motoristaDaEquipe = motoristas.find((m) => m.equipe_id === equipeId && m.ativo)

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
      <input type="hidden" name="motorista_id" value={motoristaDaEquipe?.id ?? ''} />

      {equipeId && (
        <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
          {veiculoDaEquipe ? (
            <>
              <p className="text-[#94a3b8]">
                Veículo: <span className="text-white font-mono">{veiculoDaEquipe.placa}</span>
                {' · '}{veiculoDaEquipe.modelo}
              </p>
              <p className="text-[#4a6080] text-xs mt-0.5">
                Última KM: <span className="text-amber-400 font-mono">{veiculoDaEquipe.km_atual.toLocaleString('pt-BR')} km</span>
              </p>
            </>
          ) : (
            <p className="text-amber-400 text-xs">Nenhum veículo ativo vinculado a esta equipe</p>
          )}
          {motoristaDaEquipe && (
            <p className="text-[#94a3b8] text-xs mt-1">
              Motorista: <span className="text-white">{motoristaDaEquipe.nome}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">KM Atual *</label>
        <input
          name="km_atual"
          type="number"
          required
          placeholder={
            veiculoDaEquipe
              ? `Última: ${veiculoDaEquipe.km_atual.toLocaleString('pt-BR')}`
              : 'Ex: 29216'
          }
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
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
        disabled={isPending || !veiculoDaEquipe}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
      >
        {isPending ? 'Salvando...' : 'Registrar KM'}
      </button>
    </form>
  )
}
