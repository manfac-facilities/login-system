'use client'

/**
 * Intervalo próprio de revisão do veículo (spec 2026-11-03 §1.4). Montado na ficha do veículo,
 * só para gestor (a página decide; a action confere de novo).
 */
import { useActionState } from 'react'
import { fmtKm } from '@/lib/sofia/correcoes'
import { INTERVALO_REVISAO_KM_PADRAO } from '@/lib/sofia/revisaoPrevisao'
import { definirIntervaloRevisaoAction } from './_actions'

export default function IntervaloRevisao({ veiculoId, atual }: { veiculoId: string; atual: number | null }) {
  const [state, action, isPending] = useActionState(definirIntervaloRevisaoAction, {})
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="veiculo_id" value={veiculoId} />
      <label className="text-sm text-[#94a3b8]" htmlFor="intervalo_revisao_km">Intervalo entre revisões (km)</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="intervalo_revisao_km"
          name="intervalo_revisao_km"
          type="number"
          min={1000}
          max={100000}
          step={500}
          defaultValue={atual ?? ''}
          placeholder={`padrão: ${fmtKm(INTERVALO_REVISAO_KM_PADRAO)}`}
          className="w-40 rounded-lg border border-[#1e3a5f] bg-[#0f1f3d] px-3 py-2 text-sm text-white placeholder-[#4a6080] focus:border-[#f05a28] focus:outline-none"
        />
        <button type="submit" disabled={isPending} className="rounded-lg bg-[#f05a28] px-4 py-2 text-sm font-medium text-white hover:bg-[#d94e22] disabled:opacity-50">
          {isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      <span className="text-xs text-[#4a6080]">Vazio = padrão do sistema ({fmtKm(INTERVALO_REVISAO_KM_PADRAO)} km). Muda a previsão da próxima revisão deste carro.</span>
      {state.error && <span className="text-sm text-red-300">{state.error}</span>}
      {state.success && <span className="text-sm text-green-300">Intervalo salvo.</span>}
    </form>
  )
}
