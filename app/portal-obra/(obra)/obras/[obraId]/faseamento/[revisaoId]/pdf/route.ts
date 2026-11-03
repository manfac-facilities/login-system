/**
 * GET /portal-obra/obras/<obraId>/faseamento/<revisaoId>/pdf — prancha A3 da revisão (Leva 6b).
 * Guarda falha fechada, como o PDF dos documentos: sem sessão → /portal-obra; obra fora da sessão,
 * obra que não é modalidade 'obra', revisão inexistente, de outra obra, em rascunho ou que NÃO é
 * a última emitida da fase → 404 com a mesma mensagem (não vaza se existe). Escolha: só a ÚLTIMA
 * emitida, a mesma que a seção mostra; revisão antiga não se abre por id adivinhado.
 * Planta e fase congeladas da revisão (`carregarPrancha` da emitida). Cliente admin, sem cache.
 */
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { lerSessao } from '@/lib/portal-obra/sessao'
import { createAdminClient } from '@/lib/supabase/admin'
import { carregarPrancha, renderizarPrancha } from '@/app/obras/obras/[id]/faseamento/_pdf'
import { caminhoPlantaValido } from '@/app/obras/obras/[id]/mapa/_regras'
import { obraLiberada } from '../../../../../_lib/guarda'
import { revisaoAbrivelNoPortal } from '../../../../../_lib/faseamento'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const texto = (status: number, corpo: string) =>
  new Response(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
const NAO_ENCONTRADO = 'Documento não encontrado'
const ERRO = 'Não foi possível gerar o PDF agora. Tente novamente em alguns minutos.'

/** Mesmo cliente, mas o storage nunca assina (a prancha sai sem planta). */
const semAssinatura = <T extends object>(admin: T): T =>
  new Proxy(admin, {
    get: (t, p, rc) => (p === 'storage' ? { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }) }) } : Reflect.get(t, p, rc)),
  })

export async function GET(req: NextRequest, { params }: { params: Promise<{ obraId: string; revisaoId: string }> }) {
  const { obraId, revisaoId } = await params
  const sessao = await lerSessao(req.cookies)
  // Location relativo: atrás do proxy, req.url traz o host interno.
  if (!sessao) return new Response(null, { status: 303, headers: { Location: '/portal-obra', 'Cache-Control': 'no-store' } })
  if (!obraLiberada(sessao, obraId)) return texto(404, NAO_ENCONTRADO)

  try {
    const admin = createAdminClient()
    const ok = await revisaoAbrivelNoPortal(admin, obraId, revisaoId)
    if (ok === 'erro') return texto(500, ERRO)
    if (!ok) return texto(404, NAO_ENCONTRADO)
    // Caminho de planta fora do padrão da obra: não assina, segue em quadro branco.
    const plantaOk = !ok.planta_path || caminhoPlantaValido(obraId, String(ok.planta_path))
    const cliente = (plantaOk ? admin : semAssinatura(admin)) as unknown as SupabaseClient
    const r = await carregarPrancha(cliente, obraId, revisaoId)
    if (!r.ok) return r.status === 500 ? texto(500, ERRO) : texto(404, NAO_ENCONTRADO)
    // Defesa em profundidade: o carregador também lê rascunho e confere a modalidade.
    if (r.revisao.status !== 'emitida' || r.obra.modalidade !== 'obra') return texto(404, NAO_ENCONTRADO)
    const pdf = await renderizarPrancha(r.dados)
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${r.nomeArquivo}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    console.error('[portal-obra] erro ao gerar PDF do faseamento')
    return texto(500, ERRO)
  }
}
