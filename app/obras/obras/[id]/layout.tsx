import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../_ui/primitivos'
import AbasObra from '../_ui/abas-obra'

export const dynamic = 'force-dynamic'

export default async function ObraLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const permitido =
    !!user?.email &&
    ((await hasSystemAccess(supabase, user.email, 'obras')) || (await isAdmin(supabase, user.email)))
  if (!permitido) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>
      </div>
    )
  }

  const { data: obra } = await supabase
    .from('obras_obra')
    .select('loja, os, cliente, modalidade')
    .eq('id', id)
    .maybeSingle()

  if (!obra || obra.modalidade !== 'obra') {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EstadoVazio>Obra não encontrada ou não é da modalidade OBRA</EstadoVazio>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header>
        <h1 className="text-xl font-semibold text-[#e8eef7]">{obra.loja ?? 'Obra'}</h1>
        <p className="mt-0.5 text-xs text-[#94a3b8]">
          OS {obra.os ?? '—'} · {obra.cliente ?? 'Cliente não informado'}
        </p>
      </header>
      <AbasObra obraId={id} />
      {children}
    </div>
  )
}
