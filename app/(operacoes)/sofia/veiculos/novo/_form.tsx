'use client'
import { useActionState, useEffect } from 'react'
import { criarVeiculoAction } from '../_actions'
import { useRouter } from 'next/navigation'
import type { Equipe } from '@/lib/sofia/types'

export default function NovoVeiculoForm({ equipes }: { equipes: Equipe[] }) {
  const [state, action, isPending] = useActionState(criarVeiculoAction, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/veiculos')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Novo Veículo</h1>
      <p className="text-[#4a6080] text-sm mb-8">Cadastrar veículo na frota</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        {[
          { name: 'placa', label: 'Placa *', placeholder: 'ABC-1234', type: 'text', required: true },
          { name: 'modelo', label: 'Modelo *', placeholder: 'Ex: Fiat Ducato', type: 'text', required: true },
          { name: 'ano', label: 'Ano', placeholder: '2022', type: 'number', required: false },
          { name: 'km_atual', label: 'KM atual', placeholder: '0', type: 'number', required: false },
          { name: 'km_contratual_mensal', label: 'KM contratual/mês', placeholder: '3000', type: 'number', required: false },
        ].map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">{f.label}</label>
            <input
              name={f.name}
              placeholder={f.placeholder}
              required={f.required}
              type={f.type}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
            />
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Equipe responsável</label>
          <select
            name="equipe_id"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          >
            <option value="">Sem equipe vinculada</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Salvando...' : 'Cadastrar Veículo'}
          </button>
        </div>
      </form>
    </div>
  )
}
