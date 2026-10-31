/**
 * GET /obras/obras/<id>/comunicacao/semanal/pdf/<segunda> — PDF (versão
 * cliente) do relatório semanal validado/enviado daquela semana (Leva 3 §2.3).
 *
 * Guarda falha fechada: sem sessão 401, sem acesso `obras` nem admin 403;
 * semana inválida, obra de outra modalidade ou semanal em rascunho 404.
 * Gerado na hora, sem cache.
 */
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../../../../_lib/tipos'
import { carregarPdfSemanal, renderizarSemanal } from '../../../../../_pdf/carregar-semanal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const texto = (status: number, corpo: string) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; segunda: string }> }) {
  const { id, segunda } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return texto(401, 'Não autenticado')
  const permitido = (await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras'))
  if (!permitido) return texto(403, 'Sem acesso ao Gestão de Obras')

  const r = await carregarPdfSemanal(supabase, id, segunda, hojeISO())
  if (!r.ok) return texto(r.status, r.erro)

  const pdf = await renderizarSemanal(r.dados)
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${r.nomeArquivo}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
