'use client'
import { useActionState } from 'react'
import { definirAcaoAvariaAction, marcarAvariaReparadaAction } from '../../_actions'

type State = { error?: string; success?: boolean }

const CAMPO =
  'px-2 py-1.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm [color-scheme:dark] disabled:opacity-50'
const MOTIVO = 'Só gestor de frotas ou administrador.'

export function BaixaAvaria({ id, hoje, podeGerir }: { id: string; hoje: string; podeGerir: boolean }) {
  const [state, action, pendente] = useActionState(
    (_p: State, fd: FormData) => marcarAvariaReparadaAction(id, (fd.get('data') as string) ?? ''),
    {}
  )
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="data" type="date" defaultValue={hoje} max={hoje} disabled={!podeGerir} className={CAMPO} />
      <button
        type="submit"
        disabled={!podeGerir || pendente}
        className="px-3 py-1.5 rounded-lg border border-[#1e3a5f] text-sm text-[#94a3b8] hover:border-[#94a3b8] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Marcar como reparada
      </button>
      {!podeGerir && <span className="text-xs text-red-400">{MOTIVO}</span>}
      {state.error && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  )
}

export function AcaoAvaria({ id, acao, podeGerir }: { id: string; acao: string | null; podeGerir: boolean }) {
  const [state, action, pendente] = useActionState(
    (_p: State, fd: FormData) => definirAcaoAvariaAction(id, (fd.get('acao') as string) ?? ''),
    {}
  )
  if (!podeGerir) return null
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <select name="acao" defaultValue={acao ?? ''} className={CAMPO}>
        <option value="">Reparo ou troca?</option>
        <option value="reparo">Reparo</option>
        <option value="troca">Troca</option>
      </select>
      <button
        type="submit"
        disabled={pendente}
        className="px-3 py-1.5 rounded-lg border border-[#1e3a5f] text-sm text-[#94a3b8] hover:border-[#94a3b8] disabled:opacity-40"
      >
        Salvar
      </button>
      {state.error && <span className="text-xs text-red-400">{state.error}</span>}
    </form>
  )
}
