'use client'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { criarDocumentoAction } from '../_actions'
import type { Veiculo } from '@/lib/sofia/types'

export default function NovoDocumentoForm({ veiculos }: { veiculos: Veiculo[] }) {
  const [state, action, isPending] = useActionState(criarDocumentoAction, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/documentos')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Adicionar Documento</h1>
      <p className="text-[#4a6080] text-sm mb-8">Seguro, licenciamento, IPVA ou outro</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Veículo *</label>
          <select name="veiculo_id" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="">Selecione</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Tipo *</label>
          <select name="tipo" required defaultValue="seguro" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="seguro">Seguro</option>
            <option value="licenciamento">Licenciamento (CRLV)</option>
            <option value="ipva">IPVA</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Número/Apólice</label>
          <input name="numero" placeholder="Número do documento" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Vencimento *</label>
          <input name="vencimento" type="date" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
            {isPending ? 'Salvando...' : 'Adicionar Documento'}
          </button>
        </div>
      </form>
    </div>
  )
}
