/**
 * GET /obras/obras/<id>/apresentacao/pdf?periodo=…&blocos=…&fotos=… — PDF
 * paisagem da apresentação ao cliente (Leva 4 §2.4), mesmo conteúdo da tela
 * cheia. Sempre versão cliente; não grava nada.
 *
 * Guarda falha fechada: sem sessão 401, sem acesso `obras` nem admin 403;
 * período inválido 400; obra inexistente/de outra modalidade 404. A obra vem
 * da leitura pela sessão (RLS) e as fotos pedidas são re-resolvidas contra as
 * desta obra no período. Gerado na hora, sem cache.
 */
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../../_lib/tipos'
import { lerParams } from '../../../_lib/apresentacao'
import { carregarPdfApresentacao, renderizarApresentacao } from '../../../_pdf/carregar-apresentacao'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const texto = (status: number, corpo: string) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return texto(401, 'Não autenticado')
  const permitido = (await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras'))
  if (!permitido) return texto(403, 'Sem acesso ao Gestão de Obras')

  const r = await carregarPdfApresentacao(supabase, id, hojeISO(), lerParams(new URL(req.url).searchParams))
  if (!r.ok) return texto(r.status, r.erro)

  const pdf = await renderizarApresentacao(r.dados)
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${r.nomeArquivo}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
