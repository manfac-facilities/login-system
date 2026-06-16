import { getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import NovaMultaForm from './_form'

export default async function NovaMultaPage() {
  const [veiculos, motoristas] = await Promise.all([getVeiculos(), getMotoristas()])
  return <NovaMultaForm veiculos={veiculos} motoristas={motoristas} />
}
