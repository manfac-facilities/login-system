import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirVisao } from '../../../_lib/guarda'
import { lerMapaDoPortal, type MapaCliente } from '../../../_lib/mapa'
import MapaPortal from './_tela'

export const dynamic = 'force-dynamic'

/** Mapa da obra (Leva 6 §2.8): guarda → leitura só do lado cliente → tela. Obra sem mapa: 404 (a aba nem aparece). */
export default async function MapaObraPortal({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  const { og, visao } = await exigirVisao(obraId)
  let mapa: MapaCliente | null
  try {
    mapa = await lerMapaDoPortal(createAdminClient(), obraId, og, visao)
  } catch {
    return (
      <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-800">
        Não foi possível carregar o mapa agora. Tente novamente em alguns minutos.
      </p>
    )
  }
  if (!mapa) notFound()
  return <MapaPortal mapa={mapa} />
}
