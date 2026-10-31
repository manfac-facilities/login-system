import { exigirObra } from '../../../_lib/guarda'
import { Bloco, Vazio } from '../../../_ui/blocos'

export const dynamic = 'force-dynamic'

/** Documentos (Leva 5 §3.2): provisório — a Task 5 da Leva 5 substitui por esta aba de verdade. */
export default async function DocumentosPortal({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  await exigirObra(obraId)
  return (
    <Bloco titulo="Documentos" id="b-documentos">
      <Vazio>Os projetos, laudos, ART, layout e termos da obra vão ficar disponíveis aqui.</Vazio>
    </Bloco>
  )
}
