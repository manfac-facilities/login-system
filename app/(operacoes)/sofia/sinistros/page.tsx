import { carregarBase } from '@/lib/sofia/bases/leitura'
import { filtrosDaUrl } from '@/lib/sofia/bases/filtro'
import { fmtBrl } from '@/lib/sofia/correcoes'
import type { SinLinha } from '@/lib/sofia/bases/tipos'
import SinistrosTabela from './_tabela'
import { createClient } from '@/lib/supabase/server'
import { ehAdminSofia } from '@/lib/sofia/multaPermissoes'

/** Base de Sinistros (mockup 2026-11-03, 3.3): a tabela substitui a lista; autorização e exclusão como antes. */
export default async function SinistrosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const [base, ehAdmin] = await Promise.all([carregarBase('sin'), createClient().then((s) => ehAdminSofia(s))])
  const linhas = base.linhas as SinLinha[]
  const totalAberto = linhas.filter((s) => s.sit !== 'encerrado').reduce((soma, s) => soma + (s.dano ?? 0), 0)
  return (
    <SinistrosTabela
      linhas={linhas}
      filtrosIniciais={filtrosDaUrl('sin', params, base.hoje)}
      hoje={base.hoje}
      podeGerir={base.podeGerir}
      ehAdmin={ehAdmin}
      equipes={base.equipes}
      placas={base.placas}
      motoristas={base.motoristas}
      subtitulo={`${fmtBrl(totalAberto)} em sinistros abertos`}
    />
  )
}
