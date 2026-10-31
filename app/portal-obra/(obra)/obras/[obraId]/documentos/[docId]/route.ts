/**
 * GET /portal-obra/obras/<obraId>/documentos/<docId> — baixa um documento da obra (Leva 5 §3.2).
 * Sem sessão → /portal-obra; obra fora da sessão, documento de outra obra ou inexistente → 404
 * (mesma mensagem). Redireciona para URL assinada de 60 s com disposição de download.
 */
import type { NextRequest } from 'next/server'
import { lerSessao } from '@/lib/portal-obra/sessao'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKET_DOCS, VALIDADE_URL_DOC_S, pathDocValido } from '@/app/obras/obras/_lib/documentos'
import { obraLiberada } from '../../../../_lib/guarda'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const texto = (status: number, corpo: string) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
const NAO_ENCONTRADO = 'Documento não encontrado'
const ERRO = 'Não foi possível abrir o documento agora. Tente novamente em alguns minutos.'

export async function GET(req: NextRequest, { params }: { params: Promise<{ obraId: string; docId: string }> }) {
  const { obraId, docId } = await params
  const sessao = await lerSessao(req.cookies)
  if (!sessao) return new Response(null, { status: 303, headers: { Location: '/portal-obra', 'Cache-Control': 'no-store' } })
  if (!obraLiberada(sessao, obraId) || !UUID.test(docId)) return texto(404, NAO_ENCONTRADO)

  try {
    const admin = createAdminClient()
    const { data: obra } = await admin.from('obras_obra').select('modalidade').eq('id', obraId).maybeSingle()
    if ((obra as { modalidade?: string } | null)?.modalidade !== 'obra') return texto(404, NAO_ENCONTRADO)
    const { data, error } = await admin.from('obras_documento').select('path, nome').eq('id', docId).eq('obra_id', obraId).maybeSingle()
    if (error) return texto(500, ERRO)
    const doc = data as { path: string; nome: string } | null
    if (!doc || !pathDocValido(obraId, doc.path)) return texto(404, NAO_ENCONTRADO)
    const { data: url, error: eU } = await admin.storage.from(BUCKET_DOCS).createSignedUrl(doc.path, VALIDADE_URL_DOC_S, { download: doc.nome })
    if (eU || !url?.signedUrl) return texto(500, ERRO)
    return new Response(null, { status: 303, headers: { Location: url.signedUrl, 'Cache-Control': 'no-store' } })
  } catch {
    console.error('[portal-obra] erro ao abrir documento')
    return texto(500, ERRO)
  }
}
