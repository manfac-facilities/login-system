import { carregarBase } from '@/lib/sofia/bases/leitura'
import { filtrosDaUrl } from '@/lib/sofia/bases/filtro'
import BaseTabela from '../_base/BaseTabela'

/** Base de Documentos (mockup 2026-11-03, 3.4): seguro, licenciamento e IPVA numa lista só, com Exportar. */
export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const base = await carregarBase('doc')
  return (
    <BaseTabela
      base="doc"
      nome="Documentos"
      subtitulo="seguro, licenciamento e IPVA de todos os carros; clique em Vencimento para ordenar"
      linhas={base.linhas}
      filtrosIniciais={filtrosDaUrl('doc', params, base.hoje)}
      hoje={base.hoje}
      podeGerir={base.podeGerir}
      equipes={base.equipes}
      placas={base.placas}
      motoristas={base.motoristas}
      novoHref="/sofia/documentos/novo"
      novoLabel="Cadastrar documento"
      vazio="Nenhum documento cadastrado ainda."
      placeholderBusca="Placa, número, tipo…"
    />
  )
}
