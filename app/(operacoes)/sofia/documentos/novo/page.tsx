import { getVeiculos } from '@/lib/sofia/queries'
import NovoDocumentoForm from './_form'

export default async function NovoDocumentoPage() {
  const veiculos = await getVeiculos()
  return <NovoDocumentoForm veiculos={veiculos} />
}
