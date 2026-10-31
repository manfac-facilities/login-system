import { createAdminClient } from '@/lib/supabase/admin'
import { exigirObra } from '../../../_lib/guarda'
import { lerMensagensPortal } from '../../../_lib/mensagens'
import { Bloco, Vazio } from '../../../_ui/blocos'
import { FormMensagem } from './_form'

export const dynamic = 'force-dynamic'

const quando = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

/** Mensagens (Leva 5 §3.2): conversa com a engenharia; o texto é sempre texto puro (React escapa). */
export default async function MensagensPortal({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  await exigirObra(obraId)
  const mensagens = await lerMensagensPortal(createAdminClient(), obraId)
  return (
    <Bloco titulo="Mensagens" id="b-mensagens">
      {mensagens.length === 0 ? (
        <Vazio>Nenhuma mensagem ainda. Escreva abaixo para falar com a engenharia da Manfac.</Vazio>
      ) : (
        <ol className="flex flex-col gap-3">
          {mensagens.map((m) => (
            <li key={m.id} className={`max-w-[85ch] rounded-xl border p-3 ${m.autor === 'manfac' ? 'border-(--obra-border) bg-slate-50' : 'self-end border-[#f3c3a8] bg-[#fdeee6]'}`}>
              <p className="text-[13px] font-semibold text-(--obra-muted-texto)">{m.autor === 'manfac' ? 'Manfac' : 'Vocês'} · {quando(m.criadoEm)}</p>
              <p className="mt-1 text-[15px] break-words whitespace-pre-wrap text-(--obra-ink)">{m.texto}</p>
            </li>
          ))}
        </ol>
      )}
      <FormMensagem obraId={obraId} />
    </Bloco>
  )
}
