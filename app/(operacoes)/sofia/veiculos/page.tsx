import { carregarBase } from '@/lib/sofia/bases/leitura'
import { filtrosDaUrl } from '@/lib/sofia/bases/filtro'
import BaseTabela from '../_base/BaseTabela'

export default async function VeiculosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const base = await carregarBase('veic')
  return (
    <BaseTabela
      base="veic"
      nome="Veículos"
      linhas={base.linhas}
      filtrosIniciais={filtrosDaUrl('veic', params, base.hoje)}
      hoje={base.hoje}
      podeGerir={base.podeGerir}
      equipes={base.equipes}
      placas={base.placas}
      motoristas={base.motoristas}
      novoHref="/sofia/veiculos/novo"
      novoLabel="Cadastrar veículo"
      vazio="Nenhum veículo cadastrado ainda."
      placeholderBusca="Placa, modelo, motorista…"
    />
  )
}
