import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../_lib/tipos'
import ShellObra from '../_ui/shell'
import SimboloManfac from '../_ui/simbolo-manfac'
import { lerObraDaRequisicao } from './_obra-da-requisicao'

export const dynamic = 'force-dynamic'

/** Aviso de página inteira (sem shell) no tema claro. */
function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border border-(--obra-border) bg-(--obra-card) px-6 py-8 text-center">
        <SimboloManfac tamanho={40} />
        <p className="text-[15px] text-(--obra-text)">{children}</p>
        <Link
          href="/obras/obras"
          className="inline-flex min-h-11 items-center rounded-lg bg-(--obra-ink) px-4 text-sm font-medium text-white hover:bg-(--obra-ink-escuro)"
        >
          Ver todas as obras
        </Link>
      </div>
    </div>
  )
}

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
  if (!permitido) return <Aviso>Esta tela é de quem é responsável pelas obras</Aviso>

  const r = await lerObraDaRequisicao(id, hojeISO())
  if (!r.ok) return <Aviso>{r.erro}</Aviso>
  const { obra } = r.dados
  if (obra.modalidade !== 'obra') return <Aviso>Obra não encontrada ou não é da modalidade OBRA</Aviso>

  // Só o que o shell mostra vai para o cliente (nada de valor/custo no payload).
  const doShell = { id: obra.id, os: obra.os, loja: obra.loja, cliente: obra.cliente, descricao: obra.descricao }
  return (
    <ShellObra obra={doShell} sinal={r.dados.sinal} dadosAte={r.dados.dadosAte} versao={r.dados.versaoVigente}>
      {children}
    </ShellObra>
  )
}
