import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { montarFinanceiro, type ObraFin } from '../../_lib/financeiro-tela'
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
 * Aba Financeiro da obra (Fase A). Valores só para `obras_pode_ver_valores` (engenheiro da obra
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

  const [obrasR, cR, fR, nR] = await Promise.all([
    supabase.from('obras_obra').select('id, os, loja, obra_pai_id').or(`id.eq.${id},obra_pai_id.eq.${id}`),
    supabase.rpc('obras_fin_compras', { p_obra: id }),
    supabase.rpc('obras_fin_fornecedores', { p_obra: id }),
    supabase.rpc('obras_fin_notas', { p_obra: id }),
  ])
  if (obrasR.error) return <Aviso>Não deu para ler a obra agora. Recarregue em instantes.</Aviso>
  const linhas = (obrasR.data ?? []) as { id: string; os: string | null; loja: string | null; obra_pai_id: string | null }[]
  const obras: ObraFin[] = linhas
    .map((o) => ({ id: o.id, os: o.os, loja: o.loja, paiId: o.obra_pai_id }))
    .sort((a, b) => (a.id === id ? -1 : b.id === id ? 1 : (a.os ?? '').localeCompare(b.os ?? '')))
  if (!obras.some((o) => o.id === id)) return <Aviso>Obra não encontrada</Aviso>

  const fin = montarFinanceiro({
    obraId: id,
    obras,
    compras: (cR.error ? [] : (cR.data ?? [])) as Record<string, unknown>[],
    fornecedores: (fR.error ? [] : (fR.data ?? [])) as Record<string, unknown>[],
    notas: (nR.error ? [] : (nR.data ?? [])) as Record<string, unknown>[],
  })
  // Leitura que falhou não vira "sem lançamentos": o bloco e o resumo avisam.
  const leitura = { ok: false as const, motivo: 'leitura' as const }
  if (cR.error) fin.compras = leitura
  if (fR.error) fin.fornecedores = leitura
  if (nR.error) fin.faturamento = leitura
  if (cR.error || fR.error || nR.error) {
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
