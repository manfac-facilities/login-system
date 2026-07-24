'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarMultaAction } from '../_actions'
import { TIPOS_INFRACAO } from '@/lib/sofia/multas'
import { useVeiculoMotoristaCascade } from '@/lib/sofia/useVeiculoMotoristaCascade'
import type { Veiculo, Motorista } from '@/lib/sofia/types'

export default function NovaMultaForm({
  veiculos,
  motoristas,
}: {
  veiculos: Veiculo[]
  motoristas: Motorista[]
}) {
  const [state, action, isPending] = useActionState(criarMultaAction, {})
  const [tipoInfracao, setTipoInfracao] = useState('')
  const { veiculoId, motoristaId, onVeiculoChange, onMotoristaChange } = useVeiculoMotoristaCascade()
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/multas')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar Multa</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        Infração de trânsito vinculada a veículo/motorista
      </p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Data da infração *</label>
            <input
              name="data"
              type="date"
              required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Data de recebimento *</label>
            <input
              name="data_recebimento"
              type="date"
              required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Veículo</label>
          <select
            name="veiculo_id"
            value={veiculoId}
            onChange={(e) => onVeiculoChange(e.target.value)}
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
          <label className="text-sm text-[#94a3b8]">Motorista responsável</label>
          <select
            name="motorista_id"
            value={motoristaId}
            onChange={(e) => onMotoristaChange(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          >
            <option value="">Selecione</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Tipo de infração *</label>
          <select
            name="tipo_infracao"
            required
            value={tipoInfracao}
            onChange={(e) => setTipoInfracao(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          >
            <option value="">Selecione</option>
            {TIPOS_INFRACAO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="outra">Outra</option>
          </select>
        </div>

        {tipoInfracao === 'outra' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Especifique a infração *</label>
            <input
              name="tipo_infracao_outra"
              required
              placeholder="Ex: Transporte de carga sem autorização"
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Detalhes adicionais</label>
          <textarea
            name="descricao"
            rows={2}
            placeholder="Ex: Excesso de velocidade 70km/h em 50km/h"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor (R$) *</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            required
            placeholder="195.23"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea
            name="observacoes"
            rows={2}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
          />
        </div>

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] active:scale-95 transition-[border-color,transform]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
          >
            {isPending ? 'Salvando...' : 'Registrar Multa'}
          </button>
        </div>
      </form>
    </div>
  )
}
