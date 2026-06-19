import { getVeiculos } from '@/lib/sofia/queries'
import NovaRevisaoForm from './_form'

export default async function NovaRevisaoPage() {
  const veiculos = await getVeiculos()
  return <NovaRevisaoForm veiculos={veiculos} />
}
