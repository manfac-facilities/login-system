'use client'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Equipe } from '@/lib/sofia/types'

type State = { error?: string; success?: boolean }

interface Props {
  equipes: Equipe[]
  action: (prev: State, form: FormData) => Promise<State>
}

export default function FormMotorista({ equipes, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/motoristas')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Novo Motorista</h1>
      <p className="text-[#4a6080] text-sm mb-8">Cadastrar líder / motorista de equipe</p>

      <form action={formAction} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Nome completo *</label>
          <input
            name="nome"
            required
            placeholder="Ex: João Silva"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Número da CNH</label>
          <input
            name="cnh"
            placeholder="00000000000"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Vencimento da CNH</label>
          <input
            name="cnh_vencimento"
            type="date"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Contato (WhatsApp)</label>
          <input
            name="contato"
            placeholder="(11) 99999-9999"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Equipe</label>
          <select
            name="equipe_id"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          >
            <option value="">Sem equipe</option>
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
            {isPending ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
