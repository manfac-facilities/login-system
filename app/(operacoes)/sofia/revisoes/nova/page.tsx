import { getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import NovaRevisaoForm from './_form'

export default async function NovaRevisaoPage() {
  const [veiculos, motoristas] = await Promise.all([getVeiculos(), getMotoristas()])
  return <NovaRevisaoForm veiculos={veiculos} motoristas={motoristas} />
}
