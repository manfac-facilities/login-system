import { getEquipes, getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import ChecklistForm from './_form'

export default async function NovoChecklistPage() {
  const [equipes, veiculos, motoristas] = await Promise.all([
    getEquipes(),
    getVeiculos(),
    getMotoristas(),
  ])
  return <ChecklistForm equipes={equipes} veiculos={veiculos} motoristas={motoristas} />
}
