'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { registrarDescontoMultaAction, desfazerDescontoMultaAction } from './_actions'

type State = { error?: string; success?: boolean }

function Erro({ state }: { state: State }) {
  return state.error ? <p className="mt-1 text-xs text-red-400 text-left">{state.error}</p> : null
}

/**
 * Ações de MULTA na tela Descontos (spec 2026-11-03 §4.3). Avançar a multa é no
 * fluxo dela; aqui ficam só registrar o desconto (etapa "autorizado") e desfazer
 * (etapa "descontada"), pela RPC de etapas, com a recusa visível.
 */
export function DescontoMulta({
  id,
  etapa,
  valorDescontado,
  tipoDesconto,
}: {
  id: string
  etapa: string | null
  valorDescontado: number | null
  tipoDesconto: string
}) {
  const [estadoRegistrar, registrar, registrando] = useActionState(registrarDescontoMultaAction, {})
  const [estadoDesfazer, desfazer, desfazendo] = useActionState(desfazerDescontoMultaAction.bind(null, id), {})

  return (
    <div className="flex flex-col items-end gap-1">
      <Link href={`/sofia/multas/${id}`} className="text-xs text-[#4a6080] hover:text-[#94a3b8]">
        Abrir no fluxo da multa
      </Link>

      {etapa === 'descontada' && (
        <form action={desfazer}>
          <button
            type="submit"
            disabled={desfazendo}
            className="text-xs text-[#4a6080] hover:text-[#94a3b8] active:scale-95 transition-[color,transform] disabled:opacity-40"
          >
            desfazer desconto
          </button>
          <Erro state={estadoDesfazer} />
        </form>
      )}

      {etapa === 'autorizado' && (
        <details className="mt-1">
          <summary className="text-xs text-[#f05a28] cursor-pointer hover:underline">desconto</summary>
          <form
            action={registrar}
            className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-[#1e3a5f] bg-[#0a1628] text-left w-56"
          >
            <input type="hidden" name="id" value={id} />
            <input
              name="valor_descontado"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="Valor descontado"
              defaultValue={valorDescontado ?? ''}
              className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
            />
            <select
              name="tipo_desconto"
              defaultValue={tipoDesconto === 'total' ? 'total' : 'parcial'}
              className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
            >
              <option value="parcial">Parcial</option>
              <option value="total">Total</option>
            </select>
            <label className="flex flex-col gap-1 text-xs text-[#94a3b8]">
              Competência (mês do contracheque)
              <input
                name="competencia"
                type="month"
                required
                className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs [color-scheme:dark]"
              />
            </label>
            <button
              type="submit"
              disabled={registrando}
              className="py-1.5 rounded bg-[#f05a28] text-white text-xs font-medium hover:bg-[#d94e22] transition-colors active:scale-95 disabled:opacity-40"
            >
              {registrando ? 'Salvando...' : 'Salvar'}
            </button>
            <Erro state={estadoRegistrar} />
          </form>
        </details>
      )}
    </div>
  )
}
