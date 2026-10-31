/**
 * GET /obras/obras/<id>/comunicacao/relatorio/<tipo>/<referencia>/pdf — PDF
 * (versão cliente) do relatório de período validado/enviado (Leva 4 §2.1:
 * mensal, fase, entrega).
 *
 * Guarda falha fechada: sem sessão 401, sem acesso `obras` nem admin 403; tipo
 * ou referência fora do formato estrito, obra de outra modalidade ou relatório
 * em rascunho 404. A obra é lida pela sessão (RLS). Gerado na hora, sem cache.
 */
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../../../../../_lib/tipos'
import { carregarPdfPeriodo, relatorioValido, renderizarPeriodo } from '../../../../../../_pdf/carregar-periodo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const texto = (status: number, corpo: string) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; tipo: string; referencia: string }> }) {
  const { id, tipo, referencia } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return texto(401, 'Não autenticado')
  const permitido = (await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras'))
  if (!permitido) return texto(403, 'Sem acesso ao Gestão de Obras')
  if (!relatorioValido(tipo, referencia)) return texto(404, 'Relatório inválido')

  const r = await carregarPdfPeriodo(supabase, id, tipo, referencia, hojeISO())
  if (!r.ok) return texto(r.status, r.erro)

  const pdf = await renderizarPeriodo(r.dados)
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${r.nomeArquivo}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
