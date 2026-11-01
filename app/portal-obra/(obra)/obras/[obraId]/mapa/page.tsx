import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirVisao } from '../../../_lib/guarda'
import { lerMapaDoPortal, type MapaCliente } from '../../../_lib/mapa'
import { lerFaseamentoDoPortal, type FaseCliente } from '../../../_lib/faseamento'
import MapaPortal from './_tela'
import SecaoFaseamento from './_faseamento'

export const dynamic = 'force-dynamic'

const Erro = ({ children }: { children: string }) => (
  <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-800">
    {children}
  </p>
)

/**
 * Aba Mapa: guarda → mapa (só lado cliente) + seção Faseamento (só emitidas). Sem ambiente e sem
 * faseamento emitido: 404 (a aba nem aparece). Só faseamento: a página mostra só a seção.
 */
export default async function MapaObraPortal({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  const { og, visao } = await exigirVisao(obraId)
  const admin = createAdminClient()
  let mapa: MapaCliente | null
  let fases: FaseCliente[] = []
  let erroFases = false
  try {
    mapa = await lerMapaDoPortal(admin, obraId, og, visao)
  } catch {
    return <Erro>Não foi possível carregar o mapa agora. Tente novamente em alguns minutos.</Erro>
  }
  try {
    fases = await lerFaseamentoDoPortal(admin, obraId)
  } catch {
    erroFases = true
  }
  if (!mapa && !fases.length && !erroFases) notFound()
  return (
    <div className="flex flex-col gap-8">
      {mapa ? <MapaPortal mapa={mapa} /> : null}
      {erroFases ? <Erro>Não foi possível carregar o faseamento agora. Tente novamente em alguns minutos.</Erro> : null}
      <SecaoFaseamento fases={fases} raiz={`/portal-obra/obras/${obraId}`} />
    </div>
  )
}
