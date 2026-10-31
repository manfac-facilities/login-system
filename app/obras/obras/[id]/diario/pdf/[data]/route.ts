/**
 * GET /obras/obras/<id>/diario/pdf/<AAAA-MM-DD> — PDF (versão cliente) do
 * diário validado/enviado daquele dia. Spec Leva 2 §3.3 e §6.1-5.
 *
 * Guarda falha fechada: sem sessão 401, sem acesso `obras` nem admin 403;
 * RDO inexistente ou em rascunho 404. Gerado na hora, sem cache.
 */
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { registrarFontes } from '../../../../_pdf/base'
import { carregarPdfRdo } from '../../../../_pdf/carregar-rdo'
import { DocumentoRdo } from '../../../../_pdf/rdo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const texto = (status: number, corpo: string) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; data: string }> }) {
  const { id, data } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return texto(401, 'Não autenticado')
  const permitido = (await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras'))
  if (!permitido) return texto(403, 'Sem acesso ao Gestão de Obras')

  const r = await carregarPdfRdo(supabase, id, data)
  if (!r.ok) return texto(r.status, r.erro)

  registrarFontes()
  const pdf = await renderToBuffer(createElement(DocumentoRdo, { d: r.dados }) as Parameters<typeof renderToBuffer>[0])
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${r.nomeArquivo}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
