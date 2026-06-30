'use client'
import { useActionState, useState } from 'react'

interface Props {
  action: (prev: { error?: string; success?: boolean }, formData: FormData) => Promise<{ error?: string; success?: boolean }>
  id: string
  label?: string
}

const CONFIRMATION_PHRASE = 'gestão de frotas'

export default function DeleteConfirmButton({ action, id, label = '✕' }: Props) {
  const [state, formAction, isPending] = useActionState(action, {})
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')

  const matches = typed.trim().toLowerCase() === CONFIRMATION_PHRASE

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors active:scale-95 transition-transform"
        title="Excluir"
      >
        {isPending ? '...' : label}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-red-800 bg-red-950/40 min-w-[220px]">
      {state.error && (
        <p className="text-red-300 text-xs">{state.error}</p>
      )}
      <p className="text-red-300 text-xs">
        Digite <span className="font-mono font-bold">gestão de frotas</span> para confirmar:
      </p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="gestão de frotas"
        className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-red-800 text-white text-xs placeholder-red-900 focus:outline-none focus:border-red-500"
        autoFocus
      />
      <div className="flex gap-2">
        <form action={formAction} className="flex-1">
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={!matches || isPending}
            className="w-full py-1 rounded bg-red-700 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
          >
            {isPending ? 'Excluindo...' : 'Confirmar exclusão'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setConfirming(false); setTyped('') }}
          className="px-3 py-1 rounded border border-[#1e3a5f] text-[#94a3b8] text-xs hover:border-[#94a3b8] transition-colors active:scale-95 transition-transform"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
