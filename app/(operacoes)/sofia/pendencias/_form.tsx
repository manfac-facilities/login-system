'use client'
import { useActionState } from 'react'
import { criarPendenciaAction } from './_actions'

export default function PendenciaForm() {
  const [state, action, isPending] = useActionState(criarPendenciaAction, {})

  return (
    <form action={action} className="flex flex-col gap-3 p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050]">
      {state.error && (
        <div className="px-3 py-2 rounded-lg border border-red-600 bg-red-950 text-red-300 text-xs">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="px-3 py-2 rounded-lg border border-green-600 bg-green-950 text-green-300 text-xs">
          Pendência adicionada!
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Descrição *</label>
        <textarea name="descricao" required rows={2} className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm resize-none focus:outline-none focus:border-[#f05a28]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Responsável</label>
        <input name="responsavel" className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Prazo</label>
        <input name="prazo" type="date" className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28] [color-scheme:dark]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Próxima ação</label>
        <input name="proxima_acao" className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]" />
      </div>

      <button type="submit" disabled={isPending} className="py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95">
        {isPending ? 'Salvando...' : '+ Adicionar item'}
      </button>
    </form>
  )
}
