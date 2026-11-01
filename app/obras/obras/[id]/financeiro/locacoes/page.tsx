import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../../_lib/tipos'
import { avisoLocacao } from '../../../_lib/locacao'
import { lerObraDaRequisicao } from '../../_obra-da-requisicao'
import SubnavFinanceiro from '../_subnav'
import ListaLocacoes from './_lista'
import { montarLocacoes } from './_tipos'

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
 * Locações da obra (Fases B/C §2.9): todo usuário do Obras vê a lista; valor só para quem vê
 * valores (a função já devolve NULL aos demais). Marca devolvida/renovada o engenheiro da OS
 * (ou da mãe) ou o admin. Aviso 5 dias úteis antes do fim pelo calendário da obra.
 */
export default async function LocacoesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase() ?? ''
  const admin = !!email && (await isAdmin(supabase, email))
  const permitido = !!email && (admin || (await hasSystemAccess(supabase, email, 'obras')))
  if (!permitido) return <Aviso>Esta tela é de quem é responsável pelas obras</Aviso>
  if (!UUID.test(id)) return <Aviso>Obra não encontrada</Aviso>

  const hoje = hojeISO()
  const [podeR, locR, obrasR, og] = await Promise.all([
    supabase.rpc('obras_pode_ver_valores', { p_obra: id }),
    supabase.rpc('obras_fin_locacoes', { p_obra: id }),
    supabase.from('obras_obra').select('id, obra_pai_id, engenheiro_email').or(`id.eq.${id},obra_pai_id.eq.${id}`),
    lerObraDaRequisicao(id, hoje),
  ])
  const valores = !podeR.error && podeR.data === true
  if (locR.error) {
    return (
      <div className="flex flex-col gap-5">
        <SubnavFinanceiro obraId={id} atual="locacoes" valores={valores} />
        <Aviso>Não deu para ler as locações agora. Recarregue em instantes.</Aviso>
      </div>
    )
  }

  // Quem marca: engenheiro da OS ou da mãe, ou admin (a action e o banco conferem de novo).
  type O = { id: string; obra_pai_id: string | null; engenheiro_email: string | null }
  const familia = (obrasR.error ? [] : (obrasR.data ?? [])) as O[]
  const atual = familia.find((o) => o.id === id)
  let engMaeDaPagina = ''
  if (atual?.obra_pai_id) {
    const { data } = await supabase.from('obras_obra').select('engenheiro_email').eq('id', atual.obra_pai_id).maybeSingle()
    engMaeDaPagina = String((data as { engenheiro_email: string | null } | null)?.engenheiro_email ?? '').trim().toLowerCase()
  }
  const eng = (e: string | null | undefined) => (e ?? '').trim().toLowerCase()
  const podePorObra = new Map(
    familia.map((o) => [o.id, admin || (!!email && (eng(o.engenheiro_email) === email || (o.id === id ? engMaeDaPagina : eng(atual?.engenheiro_email)) === email))]),
  )

  const feriados = og.ok ? og.dados.feriados : new Set<string>()
  const locacoes = montarLocacoes((locR.data ?? []) as Record<string, unknown>[]).map((l) => ({
    ...l,
    // Valor só para quem vê valores (a função já zera; aqui é a segunda barreira).
    totalCentavos: valores ? l.totalCentavos : null,
    aviso: avisoLocacao(l, hoje, feriados),
    pode: podePorObra.get(l.obraId) === true,
  }))

  return (
    <div className="flex flex-col gap-5">
      <SubnavFinanceiro obraId={id} atual="locacoes" valores={valores} />
      <ListaLocacoes obraId={id} locacoes={locacoes} valores={valores} hoje={hoje} varias={familia.length > 1} />
    </div>
  )
}
