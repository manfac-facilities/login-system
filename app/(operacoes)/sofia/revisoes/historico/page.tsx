import { carregarBase } from '@/lib/sofia/bases/leitura'
import { filtrosDaUrl } from '@/lib/sofia/bases/filtro'
import BaseTabela from '../../_base/BaseTabela'

export default async function HistoricoRevisoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const base = await carregarBase('rev')
  return (
    <BaseTabela
      base="rev"
      nome="Histórico de revisões"
      subtitulo="uma linha por revisão feita; a situação aparece só na mais recente de cada carro"
      linhas={base.linhas}
      filtrosIniciais={filtrosDaUrl('rev', params, base.hoje)}
      hoje={base.hoje}
      podeGerir={base.podeGerir}
      equipes={base.equipes}
      placas={base.placas}
      motoristas={base.motoristas}
      novoHref="/sofia/revisoes/nova"
      novoLabel="Registrar revisão"
      vazio="Nenhuma revisão registrada ainda."
      placeholderBusca="Placa, oficina, peças, texto…"
    />
  )
}
