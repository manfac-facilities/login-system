import { createAdminClient } from '@/lib/supabase/admin'
import { exigirObra } from '../../../_lib/guarda'
import { lerDocumentosEnviados } from '../../../_lib/ler'
import { Bloco, ListaDocumentos, Vazio } from '../../../_ui/blocos'

export const dynamic = 'force-dynamic'

/** Diários e relatórios (Leva 5 §3.2): só o que foi enviado ao cliente, com "Abrir PDF" (o mesmo PDF do e-mail). */
export default async function RelatoriosPortal({ params }: { params: Promise<{ obraId: string }> }) {
  const { obraId } = await params
  const { og } = await exigirObra(obraId)
  const raiz = `/portal-obra/obras/${obraId}`
  const r = await lerDocumentosEnviados(createAdminClient(), obraId, og)
  if (!r.ok) {
    return (
      <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[15px] text-red-800">
        Não foi possível carregar os documentos agora. Tente novamente em alguns minutos.
      </p>
    )
  }
  const relatorios = r.documentos.filter((d) => d.grupo === 'relatorio')
  const diarios = r.documentos.filter((d) => d.grupo === 'diario')
  const atas = r.documentos.filter((d) => d.grupo === 'ata')
  if (!r.documentos.length) {
    return (
      <Bloco titulo="Diários e relatórios" id="b-docs">
        <Vazio>Nenhum diário ou relatório foi enviado ainda.</Vazio>
      </Bloco>
    )
  }
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {relatorios.length ? (
        <Bloco titulo="Relatórios" id="b-relatorios">
          <ListaDocumentos docs={relatorios} raiz={raiz} />
        </Bloco>
      ) : null}
      {diarios.length ? (
        <Bloco titulo="Diários de obra" id="b-diarios">
          <ListaDocumentos docs={diarios} raiz={raiz} />
        </Bloco>
      ) : null}
      {atas.length ? (
        <Bloco titulo="Atas de reunião" id="b-atas">
          <ListaDocumentos docs={atas} raiz={raiz} />
        </Bloco>
      ) : null}
    </div>
  )
}
