import { carregarBase } from '@/lib/sofia/bases/leitura'
import { filtrosDaUrl } from '@/lib/sofia/bases/filtro'
import { fmtBrl } from '@/lib/sofia/correcoes'
import { ordemEtapa } from '@/lib/sofia/multaEtapas'
import type { MultaLinha } from '@/lib/sofia/bases/tipos'
import MultasTable from './_table'

/**
 * Base de Multas (motor lib/sofia/bases, BaseTabela base="multa"). A tratativa continua no fluxo de
 * etapas de /sofia/multas/[id]; aqui ficam a lista, os filtros, o Excel, a exclusão (unitária e em massa).
 */
export default async function MultasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const base = await carregarBase('multa')
  const linhas = base.linhas as MultaLinha[]
  const soma = (f: (m: MultaLinha) => boolean) => linhas.filter(f).reduce((s, m) => s + m.valor, 0)

  // "a fazer" = ainda com o Frotas (registrada até cobrada); "em desconto" = solicitado/autorizado
  const totalAFazer = soma((m) => m.sit !== 'contestada' && ordemEtapa(m.sit) <= ordemEtapa('cobrada'))
  const totalEmDesconto = soma((m) => m.sit === 'solicitado' || m.sit === 'autorizado')

  return (
    <MultasTable
      linhas={linhas}
      filtrosIniciais={filtrosDaUrl('multa', params, base.hoje)}
      hoje={base.hoje}
      podeGerir={base.podeGerir}
      equipes={base.equipes}
      placas={base.placas}
      motoristas={base.motoristas}
      subtitulo={`${fmtBrl(totalAFazer)} a fazer · ${fmtBrl(totalEmDesconto)} em desconto`}
    />
  )
}
