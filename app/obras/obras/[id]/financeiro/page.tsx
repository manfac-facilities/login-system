import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../_lib/tipos'
import { montarFinanceiro, type ObraFin } from '../../_lib/financeiro-tela'
import { receitaEmCentavos } from '../../_lib/medicao'
import { lerObraDaRequisicao } from '../_obra-da-requisicao'
import { itensDeLocacao } from './locacoes/_tipos'
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

  // Falha fechada: erro, null ou qualquer coisa diferente de true → sem valores.
  const { data: pode, error: ePode } = await supabase.rpc('obras_pode_ver_valores', { p_obra: id })
  if (ePode || pode !== true) {
    return <Aviso>Os valores desta obra são só para o engenheiro da obra, a administração e o Financeiro.</Aviso>
  }

  const obrasR = await supabase.from('obras_obra').select('id, os, loja, obra_pai_id, valor, cancelado_em').or(`id.eq.${id},obra_pai_id.eq.${id}`)
  if (obrasR.error) return <Aviso>Não deu para ler a obra agora. Recarregue em instantes.</Aviso>
  type O = { id: string; os: string | null; loja: string | null; obra_pai_id: string | null; valor: unknown; cancelado_em: string | null }
  const obras: ObraFin[] = ((obrasR.data ?? []) as O[])
    .map((o) => ({ id: o.id, os: o.os, loja: o.loja, paiId: o.obra_pai_id, receitaCentavos: receitaEmCentavos(o.valor), cancelada: !!o.cancelado_em }))
    .sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : (a.os ?? '').localeCompare(b.os ?? '')))
  if (!obras.some((o) => o.id === id)) return <Aviso>Obra não encontrada</Aviso>

  const hoje = hojeISO()
  const [cR, fR, nR, vR, mR, cxR, lR, atR, og] = await Promise.all([
    supabase.rpc('obras_fin_compras', { p_obra: id }),
    supabase.rpc('obras_fin_fornecedores', { p_obra: id }),
    supabase.rpc('obras_fin_notas', { p_obra: id }),
    supabase.rpc('obras_fin_vinculos', { p_obra: id }),
    supabase.from('obras_medicao_cliente').select('obra_id, situacao, valor_centavos').in('obra_id', obras.map((o) => o.id)),
    supabase.rpc('obras_fin_caixinha_sem_obra', { p_obra: id }),
    supabase.rpc('obras_fin_locacoes', { p_obra: id }),
    supabase.rpc('obras_fin_medicoes_fornecedor_atrasadas', { p_obra: id }),
    lerObraDaRequisicao(id, hoje),
  ])
  const rows = (r: { data: unknown; error: unknown }) => (r.error ? [] : ((r.data ?? []) as Record<string, unknown>[]))
  const realizado = og.ok ? og.dados.calc?.realizado : undefined
  const qtdCaixinha = cxR.error ? null : Number((rows(cxR)[0] ?? {}).quantidade ?? 0)

  const fin = montarFinanceiro({
    obraId: id,
    obras,
    compras: rows(cR),
    fornecedores: rows(fR),
    notas: rows(nR),
    vinculos: rows(vR),
    medicoesCliente: rows(mR),
    // Sem cronograma (ou leitura falhou): sem avanço → custo/margem projetados "—".
    avanco: realizado !== undefined && realizado !== null && Number.isFinite(realizado) ? realizado : null,
    medicoesFornecedorAtrasadas: atR.error ? null : rows(atR),
    caixinhaSemObra: qtdCaixinha !== null && Number.isFinite(qtdCaixinha) ? qtdCaixinha : null,
    locacoes: lR.error ? null : itensDeLocacao(rows(lR)),
    hoje,
    feriados: og.ok ? og.dados.feriados : undefined,
  })
  // Leitura que falhou não vira "sem lançamentos": o bloco e o resumo avisam (falha fechada).
  const leitura = { ok: false as const, motivo: 'leitura' as const }
  if (cR.error) fin.compras = leitura
  if (fR.error) fin.fornecedores = leitura
  if (nR.error) fin.faturamento = leitura
  if (cR.error || fR.error || nR.error || vR.error || mR.error) {
    fin.resumo = leitura
    fin.semLancamentos = false
  }

  return (
    <div className="flex flex-col gap-5">
      <SubnavFinanceiro obraId={id} atual="resumo" valores />
      <TelaFinanceiro fin={fin} obras={obras} obraId={id} lidoEm={new Date().toISOString()} />
    </div>
  )
}
