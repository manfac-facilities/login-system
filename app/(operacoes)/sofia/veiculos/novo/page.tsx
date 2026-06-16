import { getEquipes } from '@/lib/sofia/queries'
import NovoVeiculoForm from './_form'

export default async function NovoVeiculoPage() {
  const equipes = await getEquipes()
  return <NovoVeiculoForm equipes={equipes} />
}
