import { carregarPainelRevisoes } from '@/lib/sofia/revisaoLeitura'
import Painel, { FILTROS_PAINEL, type FiltroPainel } from './_painel'

export default async function RevisoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const sit = Array.isArray(params.sit) ? params.sit[0] : params.sit
  const filtro: FiltroPainel = FILTROS_PAINEL.includes(sit as FiltroPainel) ? (sit as FiltroPainel) : ''
  const painel = await carregarPainelRevisoes()
  return <Painel painel={painel} filtro={filtro} />
}
