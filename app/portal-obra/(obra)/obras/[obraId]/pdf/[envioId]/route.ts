/**
 * GET /portal-obra/obras/<obraId>/pdf/<envioId> — PDF (versão cliente) de um
 * documento enviado ao cliente (Leva 5 §3.2). Guarda falha fechada:
 * sem sessão → /portal-obra; obra fora da sessão, envio que não é do lado
 * cliente desta obra, documento em rascunho/desfeito → 404 com a mesma
 * mensagem (nada da obra vaza). Gerado na hora, sem cache.
 */
import type { NextRequest } from 'next/server'
import { lerSessao } from '@/lib/portal-obra/sessao'
import { createAdminClient } from '@/lib/supabase/admin'
import { lerObraGrande } from '@/app/obras/obras/_lib/leitura'
import { hojeISO } from '@/app/obras/_lib/tipos'
import { obraLiberada } from '../../../../_lib/guarda'
import { pdfDoEnvio } from '../../../../_lib/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const texto = (status: number, corpo: string) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
const NAO_ENCONTRADO = 'Documento não encontrado'
const ERRO = 'Não foi possível gerar o PDF agora. Tente novamente em alguns minutos.'

export async function GET(req: NextRequest, { params }: { params: Promise<{ obraId: string; envioId: string }> }) {
  const { obraId, envioId } = await params
  const sessao = await lerSessao(req.cookies)
  // Location relativo: atrás do proxy, req.url traz o host interno.
  if (!sessao) return new Response(null, { status: 303, headers: { Location: '/portal-obra', 'Cache-Control': 'no-store' } })
  if (!obraLiberada(sessao, obraId)) return texto(404, NAO_ENCONTRADO)

  try {
    const admin = createAdminClient()
    const hoje = hojeISO()
    const lida = await lerObraGrande(admin, obraId, hoje)
    // Obra apagada ou SPOT → 404; erro de banco → 500 (como em `exigirObra`).
    if (!lida.ok) return lida.erro === 'Obra não encontrada' ? texto(404, NAO_ENCONTRADO) : texto(500, ERRO)
    if (lida.dados.obra.modalidade !== 'obra') return texto(404, NAO_ENCONTRADO)
    const r = await pdfDoEnvio(admin, obraId, lida.dados, envioId, hoje)
    if (!r.ok) return r.status === 404 ? texto(404, NAO_ENCONTRADO) : texto(500, ERRO)
    return new Response(new Uint8Array(r.pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${r.nomeArquivo}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    console.error('[portal-obra] erro ao gerar PDF')
    return texto(500, ERRO)
  }
}
