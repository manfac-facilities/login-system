import { getEquipes } from '@/lib/sofia/queries'
import FormMotorista from './_form'
import { criarMotoristaAction } from '../_actions'

export default async function NovoMotoristaPage() {
  const equipes = await getEquipes()
  return <FormMotorista equipes={equipes} action={criarMotoristaAction} />
}
