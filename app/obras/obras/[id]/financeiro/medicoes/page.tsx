import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../../_lib/tipos'
import { receitaEmCentavos } from '../../../_lib/medicao'
import { lerObraDaRequisicao } from '../../_obra-da-requisicao'
import SubnavFinanceiro from '../_subnav'
import TelaMedicoes from './_tela'
import { montarMedicoes, type OsMedicao } from './_tipos'

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
 * Medições ao cliente (Fases B/C §2.4). Leitura só para `obras_pode_ver_valores` (a RLS da
 * tabela é a mesma); grava o engenheiro da OS ou da mãe, ou o admin. Cliente da SESSÃO sempre.
 */
export default async function MedicoesPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: pode, error: ePode } = await supabase.rpc('obras_pode_ver_valores', { p_obra: id })
  if (ePode || pode !== true) {
    return <Aviso>As medições ao cliente são só para o engenheiro da obra, a administração e o Financeiro.</Aviso>
  }

  type O = { id: string; os: string | null; obra_pai_id: string | null; engenheiro_email: string | null; valor: unknown }
  const { data: obrasD, error: eObras } = await supabase
    .from('obras_obra')
    .select('id, os, obra_pai_id, engenheiro_email, valor')
    .or(`id.eq.${id},obra_pai_id.eq.${id}`)
  if (eObras) return <Aviso>Não deu para ler a obra agora. Recarregue em instantes.</Aviso>
  const familia = (obrasD ?? []) as O[]
  const atual = familia.find((o) => o.id === id)
  if (!atual) return <Aviso>Obra não encontrada</Aviso>

  const hoje = hojeISO()
  const [maeR, medR, notasR, og] = await Promise.all([
    atual.obra_pai_id
      ? supabase.from('obras_obra').select('engenheiro_email').eq('id', atual.obra_pai_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('obras_medicao_cliente')
      .select('id, obra_id, numero, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos, avanco_centesimos, situacao, enviada_em, aprovada_em')
      .in('obra_id', familia.map((o) => o.id)),
    supabase.rpc('obras_fin_notas', { p_obra: id }),
    lerObraDaRequisicao(id, hoje),
  ])
  if (medR.error) return <Aviso>Não deu para ler as medições agora. Recarregue em instantes.</Aviso>

  const eng = (e: string | null | undefined) => (e ?? '').trim().toLowerCase()
  const engMaeDaPagina = eng((maeR.data as { engenheiro_email: string | null } | null)?.engenheiro_email)
  const temAditivos = familia.some((o) => o.obra_pai_id === id)
  const realizado = og.ok ? og.dados.calc?.realizado : undefined
  const oss: OsMedicao[] = familia
    .sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : (a.os ?? '').localeCompare(b.os ?? '')))
    .map((o) => {
      const engMae = o.id === id ? engMaeDaPagina : eng(atual.engenheiro_email)
      return {
        id: o.id,
        os: o.os,
        papel: o.id === id ? (temAditivos ? 'mae' : atual.obra_pai_id ? 'aditivo' : 'obra') : 'aditivo',
        receitaCentavos: receitaEmCentavos(o.valor),
        podeGravar: admin || (!!email && (eng(o.engenheiro_email) === email || engMae === email)),
        avancoCentesimos: o.id === id && realizado !== undefined && Number.isFinite(realizado) ? Math.round(realizado * 100) : null,
      }
    })

  const medicoes = montarMedicoes({
    linhas: (medR.data ?? []) as Record<string, unknown>[],
    notas: notasR.error ? [] : ((notasR.data ?? []) as Record<string, unknown>[]),
    osPorId: new Map(familia.map((o) => [o.id, o.os])),
    hoje,
  })

  return (
    <div className="flex flex-col gap-5">
      <SubnavFinanceiro obraId={id} atual="medicoes" valores />
      <TelaMedicoes obraId={id} oss={oss} medicoes={medicoes} admin={admin} notasOk={!notasR.error} />
    </div>
  )
}
