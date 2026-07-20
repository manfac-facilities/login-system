'use client'
import { useActionState } from 'react'
import {
  enviarParaOficinaAction,
  retornarDaOficinaAction,
  definirSubstitutoAction,
} from '@/app/(operacoes)/sofia/veiculos/_actions'
import type { Veiculo } from '@/lib/sofia/types'

export default function OficinaForm({
  veiculo,
  veiculosDisponiveis,
}: {
  veiculo: Veiculo
  veiculosDisponiveis: Veiculo[]
}) {
  const [enviarState, enviarAction, enviarPending] = useActionState(enviarParaOficinaAction, {})
  const [retornarState, retornarAction, retornarPending] = useActionState(retornarDaOficinaAction, {})
  const [substitutoState, substitutoAction, substitutoPending] = useActionState(definirSubstitutoAction, {})

  if (veiculo.status !== 'manutencao') {
    return (
      <form action={enviarAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={veiculo.id} />
        {enviarState.error && <p className="text-red-400 text-xs">{enviarState.error}</p>}
        <div className="flex gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#94a3b8]">Previsão de retorno</label>
            <input
              type="date"
              name="previsao_retorno_oficina"
              className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
            />
          </div>
          <button
            type="submit"
            disabled={enviarPending}
            className="px-3 py-2 rounded-lg border border-amber-700 text-amber-400 text-sm font-medium hover:bg-amber-950/40 disabled:opacity-50 transition-colors active:scale-95"
          >
            {enviarPending ? 'Enviando...' : 'Enviar para oficina'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-amber-400 text-sm">
        Em manutenção{veiculo.previsao_retorno_oficina
          ? ` — previsão de retorno em ${new Date(`${veiculo.previsao_retorno_oficina}T12:00:00`).toLocaleDateString('pt-BR')}`
          : ''}
      </p>

      <form action={substitutoAction} className="flex gap-2 items-end">
        <input type="hidden" name="id" value={veiculo.id} />
        {substitutoState.error && <p className="text-red-400 text-xs">{substitutoState.error}</p>}
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-[#94a3b8]">Veículo substituto</label>
          <select
            name="substituto_id"
            defaultValue={veiculo.substituto_id ?? ''}
            className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
          >
            <option value="">Nenhum</option>
            {veiculosDisponiveis.map((v) => (
              <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={substitutoPending}
          className="px-3 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] disabled:opacity-50 transition-colors active:scale-95"
        >
          {substitutoPending ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      <form action={retornarAction}>
        <input type="hidden" name="id" value={veiculo.id} />
        {retornarState.error && <p className="text-red-400 text-xs">{retornarState.error}</p>}
        <button
          type="submit"
          disabled={retornarPending}
          className="px-3 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors active:scale-95"
        >
          {retornarPending ? 'Registrando...' : 'Retornar da oficina'}
        </button>
      </form>
    </div>
  )
}
