/**
 * GET /obras/obras/<id>/faseamento/<revisaoId>/pdf — prancha A3 da revisão
 * (Leva 6b §2.9). Emitida: base e fase congeladas na própria revisão; rascunho:
 * planta atual do mapa e marca RASCUNHO (`_pdf.ts`).
 *
 * Guarda falha fechada: sem sessão 401, sem acesso `obras` nem admin 403; id
 * fora do formato, obra de outra modalidade ou revisão de outra obra 404. Lido
 * pela sessão (RLS). Gerado na hora, sem cache.
 */
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { carregarPrancha, renderizarPrancha } from '../../_pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const texto = (status: number, corpo: string) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; revisaoId: string }> }) {
  const { id, revisaoId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return texto(401, 'Não autenticado')
  const permitido = (await isAdmin(supabase, email)) || (await hasSystemAccess(supabase, email, 'obras'))
  if (!permitido) return texto(403, 'Sem acesso ao Gestão de Obras')

  const r = await carregarPrancha(supabase, id, revisaoId)
  if (!r.ok) return texto(r.status, r.erro)

  let pdf: Buffer
  try {
    pdf = await renderizarPrancha(r.dados)
  } catch (e) {
    // O detalhe (pode trazer a URL assinada da planta) fica só no log do servidor.
    console.error('faseamento: falha ao gerar o PDF da revisão', revisaoId, e)
    return texto(500, 'Não foi possível gerar o PDF. Tente de novo.')
  }
  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${r.nomeArquivo}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
