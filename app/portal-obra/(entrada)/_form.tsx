'use client'

import { useActionState } from 'react'
import { pedirCodigoAction, verificarCodigoAction } from './_actions'

const campo = 'w-full min-h-[44px] px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:border-[#f05a28] focus:ring-1 focus:ring-[#f05a28]'
const botao = 'w-full min-h-[44px] px-4 py-3 rounded-lg bg-[#c2410c] text-white font-semibold hover:bg-[#9a3412] disabled:opacity-60'

function Erro({ texto }: { texto?: string }) {
  if (!texto) return null
  return <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{texto}</p>
}

export function FormEmail() {
  const [estado, acao, pendente] = useActionState(pedirCodigoAction, {})
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Erro texto={estado.erro} />
      <label htmlFor="email" className="text-sm font-medium text-slate-700">E-mail cadastrado</label>
      <input id="email" name="email" type="email" required autoComplete="email" inputMode="email" className={campo} placeholder="voce@empresa.com.br" />
      <button type="submit" disabled={pendente} className={botao}>{pendente ? 'Enviando…' : 'Receber código'}</button>
    </form>
  )
}

export function FormCodigo() {
  const [estado, acao, pendente] = useActionState(verificarCodigoAction, {})
  return (
    <form action={acao} className="flex flex-col gap-4">
      <Erro texto={estado.erro} />
      <label htmlFor="codigo" className="text-sm font-medium text-slate-700">Código de 6 dígitos</label>
      <input id="codigo" name="codigo" required inputMode="numeric" autoComplete="one-time-code" maxLength={7}
        className={`${campo} text-center text-2xl tracking-[0.4em]`} />
      <button type="submit" disabled={pendente} className={botao}>{pendente ? 'Conferindo…' : 'Entrar'}</button>
    </form>
  )
}
