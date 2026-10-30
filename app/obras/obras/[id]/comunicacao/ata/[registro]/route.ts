/**
 * GET /obras/obras/<id>/comunicacao/ata/<registro> — PDF da ata de reunião
 * (Leva 2 §3.1, "Baixar PDF"). Guarda falha fechada: sem sessão 401, sem acesso
 * `obras` nem admin 403; registro que não é reunião desta obra 404. Gerado na
 * hora, sem cache.
 */
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { carregarPdfAta, renderizarAta } from '../../../../_pdf/carregar-ata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const texto = (status: number, corpo: string) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; registro: string }> }) {
  const { id, registro } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return texto(401, 'Não autenticado')
  const permitido = (await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras'))
  if (!permitido) return texto(403, 'Sem acesso ao Gestão de Obras')

  const r = await carregarPdfAta(supabase, id, registro)
  if (!r.ok) return texto(r.status, r.erro)

  const pdf = await renderizarAta(r.dados)
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${r.nomeArquivo}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
