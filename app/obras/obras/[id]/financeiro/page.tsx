import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../_lib/tipos'
import { lerFinanceiroDaObra } from '../../_lib/financeiro-ler'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import TelaFinanceiro from './_tela'
import SubnavFinanceiro from './_subnav'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function Aviso({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-(--obra-border) bg-(--obra-card) px-6 py-10 text-center text-[15px] text-(--obra-muted-texto)">
      {children}
    </div>
  )
}

/**
 * Aba Financeiro da obra (Fase A + Fases B/C: receita esperada, liberado, margem, custos por origem). Valores só para `obras_pode_ver_valores` (engenheiro da obra
 * ou da mãe, admin do Obras, financeiro/diretor). TODAS as funções são chamadas com o cliente da
 * SESSÃO — com o admin (service role) elas devolvem vazio, sem erro.
 */
export default async function FinanceiroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const permitido = !!email && ((await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <Aviso>Esta tela é de quem é responsável pelas obras</Aviso>
  if (!UUID.test(id)) return <Aviso>Obra não encontrada</Aviso>

  const hoje = hojeISO()
  const r = await lerFinanceiroDaObra(supabase, id, await lerObraDaRequisicao(id, hoje), hoje)
  if (!r.ok) {
    if (r.motivo === 'sem_permissao') return <Aviso>Os valores desta obra são só para o engenheiro da obra, a administração e o Financeiro.</Aviso>
    if (r.motivo === 'leitura') return <Aviso>Não deu para ler a obra agora. Recarregue em instantes.</Aviso>
    return <Aviso>Obra não encontrada</Aviso>
  }
  const { fin, obras } = r

  return (
    <div className="flex flex-col gap-5">
      <SubnavFinanceiro obraId={id} atual="resumo" valores />
      <TelaFinanceiro fin={fin} obras={obras} obraId={id} lidoEm={new Date().toISOString()} />
    </div>
  )
}
