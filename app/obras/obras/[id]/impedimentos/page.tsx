import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { EstadoVazio } from '../../../_ui/primitivos'
import { hojeISO } from '../../../_lib/tipos'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import FormImpedimento from './_form'
import ListaImpedimentos from './_lista'
import { RESPONSAVEIS } from './_tipos'

export const dynamic = 'force-dynamic'

export default async function ImpedimentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ resp?: string }>
}) {
  const { id } = await params
  const { resp } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const permitido =
    !!email && ((await hasSystemAccess(supabase, email, 'obras')) || (await isAdmin(supabase, email)))
  if (!permitido) return <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>

  const hoje = hojeISO()
  const r = await lerObraDaRequisicao(id, hoje)
  if (!r.ok) return <EstadoVazio>{r.erro}</EstadoVazio>
  const { plano, impedimentos, feriados } = r.dados

  const filtro = RESPONSAVEIS.find((x) => x.valor === resp)?.valor ?? null
  const itens = impedimentos
    .filter((i) => !filtro || i.responsavel === filtro)
    .sort((a, b) => b.abertoEm.localeCompare(a.abertoEm))
  const orientacoes = impedimentos.filter((i) => i.categoria === 'orientacao')
  const base = `/obras/obras/${id}/impedimentos`
  const chip = (ativo: boolean) =>
    `flex min-h-11 items-center rounded-full border px-3 text-sm ${
      ativo ? 'border-[#b94606] bg-[#b94606] font-semibold text-white' : 'border-[#dadad8] text-[#333336]'
    }`

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-[#00345e]">Impedimentos</h2>
        <nav aria-label="Filtrar por responsável" className="flex flex-wrap gap-2">
          <Link href={base} className={chip(!filtro)}>Todos</Link>
          {RESPONSAVEIS.map((x) => (
            <Link key={x.valor} href={`${base}?resp=${x.valor}`} className={chip(filtro === x.valor)}>{x.rotulo}</Link>
          ))}
        </nav>
        <ListaImpedimentos itens={itens} hoje={hoje} feriados={feriados} />
        {orientacoes.length ? (
          <>
            <h3 className="mt-2 text-sm font-semibold text-[#5a7380]">Orientações do cliente</h3>
            <ul className="flex flex-col gap-2">
              {orientacoes.map((o) => (
                <li key={o.id} className="rounded-xl border border-[#dadad8] p-3 text-sm text-[#333336]">
                  <span className="text-xs text-[#5a7380]">
                    {o.abertoEm.slice(8, 10)}/{o.abertoEm.slice(5, 7)}
                    {o.pessoaCliente ? ` · ${o.pessoaCliente}` : ''}
                  </span>
                  <p>{o.descricao}</p>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-[#5a7380]">Registrar</h3>
        <FormImpedimento
          obraId={id}
          atividades={plano.map((p) => ({ numero: p.numero, descricao: p.descricao }))}
          orientacoes={orientacoes.map((o) => ({ id: o.id, descricao: o.descricao, abertoEm: o.abertoEm }))}
        />
      </section>
    </div>
  )
}
