/**
 * Painel gerencial — `/obras/painel`.
 *
 * Spec: docs/cliente/2026-08-31-sistema-controle-de-obras/spec-painel-gerencial-2026-09-29.md
 *
 * Server Component: lê o banco com o cliente Supabase do usuário (RLS dele),
 * monta o painel inteiro em `montarPainel` (função pura, testada) e entrega o
 * resultado pronto à tela. Cliente, mês e comparação chegam pela URL.
 *
 * A leitura das quatro tabelas (paginada, com `select('*')` nas obras de
 * propósito) vive em `_leitura.ts`, compartilhada com o relatório por e-mail.
 */

import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../_lib/tipos'
import { EstadoVazio } from '../_ui/primitivos'
import { MESES_LONGOS, montarPainel, somaMeses, type Comparacao } from './_calculos'
import { lerEntradaDoPainel } from './_leitura'
import PainelGerencial from './_painel'

export const dynamic = 'force-dynamic'

type Props = { searchParams: Promise<{ cliente?: string; mes?: string; cmp?: string }> }

export default async function PainelPage({ searchParams }: Props) {
  const params = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email ?? ''
  const permitido =
    !!email && ((await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EstadoVazio>Esta tela é de quem é responsável pelas obras</EstadoVazio>
      </div>
    )
  }

  const entrada = await lerEntradaDoPainel(supabase)
  if (!entrada.ok) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <EstadoVazio>
          Não deu para carregar o painel gerencial. Recarregue a página em alguns instantes.
        </EstadoVazio>
      </div>
    )
  }

  const hoje = hojeISO()
  const mesAtual = hoje.slice(0, 7)
  // O seletor oferece os 12 meses até o atual — os mesmos do histórico.
  const meses = Array.from({ length: 12 }, (_, i) => {
    const v = somaMeses(mesAtual, -i)
    const nome = `${MESES_LONGOS[Number(v.slice(5, 7)) - 1]} ${v.slice(0, 4)}${i === 0 ? ' (atual)' : ''}`
    return { v, nome }
  })
  const mes = meses.some((m) => m.v === params.mes) ? params.mes! : mesAtual
  const cmp: Comparacao = params.cmp === 'yoy' ? 'yoy' : 'prev'

  const painel = montarPainel(
    { obras: entrada.obras, diario: entrada.diario, tarefas: entrada.tarefas, remarcacoes: entrada.remarcacoes, hoje },
    { cliente: params.cliente || null, mes, cmp }
  )

  return <PainelGerencial painel={painel} meses={meses} />
}
