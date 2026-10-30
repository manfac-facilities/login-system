import { carregarBase } from '@/lib/sofia/bases/leitura'
import { filtrosDaUrl } from '@/lib/sofia/bases/filtro'
import BaseTabela from '../_base/BaseTabela'

export default async function MotoristasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const base = await carregarBase('mot')
  return (
    <BaseTabela
      base="mot"
      nome="Motoristas"
      linhas={base.linhas}
      filtrosIniciais={filtrosDaUrl('mot', params, base.hoje)}
      hoje={base.hoje}
      podeGerir={base.podeGerir}
      equipes={base.equipes}
      placas={base.placas}
      motoristas={base.motoristas}
      novoHref="/sofia/motoristas/novo"
      novoLabel="Cadastrar motorista"
      vazio="Nenhum motorista cadastrado ainda."
      placeholderBusca="Nome, CNH, telefone…"
    />
  )
}
