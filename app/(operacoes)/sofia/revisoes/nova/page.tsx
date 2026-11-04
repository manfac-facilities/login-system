import { getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import { mediasKmDia } from '@/lib/sofia/revisaoLeitura'
import { hojeSP } from '@/lib/sofia/bases/leitura'
import NovaRevisaoForm from './_form'

export default async function NovaRevisaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const veiculo = Array.isArray(params.veiculo) ? params.veiculo[0] : params.veiculo
  const [veiculos, motoristas, medias] = await Promise.all([getVeiculos(), getMotoristas(), mediasKmDia()])
  // ?veiculo= só pré-seleciona se for um id da lista (nada da URL é renderizado como texto)
  const inicial = veiculos.some((v) => v.id === veiculo) ? (veiculo as string) : ''
  return <NovaRevisaoForm veiculos={veiculos} motoristas={motoristas} medias={medias} veiculoInicial={inicial} hoje={hojeSP()} />
}
