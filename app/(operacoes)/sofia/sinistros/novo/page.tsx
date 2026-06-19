import { getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import NovoSinistroForm from './_form'

export default async function NovoSinistroPage() {
  const [veiculos, motoristas] = await Promise.all([getVeiculos(), getMotoristas()])
  return <NovoSinistroForm veiculos={veiculos} motoristas={motoristas} />
}
