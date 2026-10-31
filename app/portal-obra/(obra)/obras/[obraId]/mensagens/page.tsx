import { exigirObra } from '../../../_lib/guarda'
import { Bloco, Vazio } from '../../../_ui/blocos'

export const dynamic = 'force-dynamic'

/** Mensagens (Leva 5 §3.2): provisório — a Task 5 da Leva 5 substitui por esta aba de verdade. */
export default async function MensagensPortal({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  await exigirObra(obraId)
  return (
    <Bloco titulo="Mensagens" id="b-mensagens">
      <Vazio>Em breve vocês vão poder conversar com a engenharia da Manfac por aqui.</Vazio>
    </Bloco>
  )
}
