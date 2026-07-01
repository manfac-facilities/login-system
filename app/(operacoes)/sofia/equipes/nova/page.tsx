'use client'
import { useActionState, useEffect } from 'react'
import { criarEquipeAction } from '../_actions'
import { useRouter } from 'next/navigation'

export default function NovaEquipePage() {
  const [state, action, isPending] = useActionState(criarEquipeAction, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/equipes')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Nova Equipe</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        Cadastrar equipe de campo (ex: MANFAC-25)
      </p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Código da equipe *</label>
          <input
            name="codigo"
            placeholder="MANFAC-25"
            required
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Centro de custo</label>
          <input
            name="centro_custo"
            placeholder="Ex: CCUSTO-001"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
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
            {isPending ? 'Salvando...' : 'Criar Equipe'}
          </button>
        </div>
      </form>
    </div>
  )
}
