import { createAdminClient } from '@/lib/supabase/admin'
import { PASTAS } from '@/app/obras/obras/_lib/documentos'
import { exigirObra } from '../../../_lib/guarda'
import { lerDocumentosPortal } from '../../../_lib/mensagens'
import { Bloco, Vazio } from '../../../_ui/blocos'

export const dynamic = 'force-dynamic'

const data = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso))
function tamanhoLegivel(b: number | null): string {
  if (b == null) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Documentos (Leva 5 §3.2): pastas fixas; o download passa pela rota que confere sessão e obra. */
export default async function DocumentosPortal({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  await exigirObra(obraId)
  const docs = await lerDocumentosPortal(createAdminClient(), obraId)
  return (
    <Bloco titulo="Documentos" id="b-documentos">
      {docs.length === 0 ? (
        <Vazio>Os projetos, laudos, ART, layout e termos da obra vão ficar disponíveis aqui.</Vazio>
      ) : (
        <div className="flex flex-col gap-5">
          {PASTAS.map((p) => {
            const lista = docs.filter((d) => d.pasta === p.valor)
            if (!lista.length) return null
            return (
              <section key={p.valor} aria-label={p.rotulo}>
                <h3 className="text-[16px] font-bold text-(--obra-ink)">{p.rotulo}</h3>
                <ul className="mt-2 divide-y divide-(--obra-border)">
                  {lista.map((d) => (
                    <li key={d.id}>
                      <a href={`/portal-obra/obras/${obraId}/documentos/${d.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 py-2 text-[15px] text-(--obra-ink) hover:underline">
                        <span className="min-w-0 font-medium break-words">{d.nome}</span>
                        <span className="text-[13px] text-(--obra-muted-texto)">{[tamanhoLegivel(d.tamanho), data(d.criadoEm)].filter(Boolean).join(' · ')}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Bloco>
  )
}
