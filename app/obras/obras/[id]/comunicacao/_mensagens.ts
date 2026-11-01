'use server'

/**
 * Resposta da Manfac às mensagens do cliente (Leva 5 §3.2). Grava com o cliente
 * de SESSÃO: o banco força autor_tipo 'manfac' e autor_email = e-mail do JWT, e
 * mensagem não se edita nem se apaga. Só engenheiro da obra ou administrador.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarEmail } from '../../_lib/enviar'
import { linkPortalObra } from '../../_lib/link-portal'
import { montarEmailNovaMensagem } from './_email'
import type { Resultado } from './_tipos'

const falha = (erro: string): Resultado => ({ ok: false, erro })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function responderMensagemAction(obraId: string, texto: string): Promise<Resultado> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha('Não autenticado')
  if (!UUID.test(obraId ?? '')) return falha('Obra não encontrada')

  const t = typeof texto === 'string' ? texto.trim() : ''
  if (!t) return falha('Escreva a resposta')
  if (t.length > 4000) return falha('A resposta passa de 4000 caracteres')

  if (!(await isAdmin(supabase, email))) {
    const { data, error } = await supabase.from('obras_obra').select('engenheiro_email').eq('id', obraId).maybeSingle()
    const eng = String((data as { engenheiro_email?: string | null } | null)?.engenheiro_email ?? '').trim().toLowerCase()
    if (error || !eng || eng !== email) return falha('Só o engenheiro responsável da obra ou um administrador responde ao cliente')
  }

  const { error } = await supabase.from('obras_mensagem').insert({ obra_id: obraId, autor_tipo: 'manfac', autor_email: email, texto: t })
  if (error) {
    if (error.code === '42501' || error.message.includes('row-level security')) return falha('Você não tem permissão para isso.')
    return falha('Não foi possível enviar a resposta. Tente de novo em instantes.')
  }
  revalidatePath(`/obras/obras/${obraId}/comunicacao`)
  await avisarCliente(supabase, obraId)
  return { ok: true }
}

/**
 * Avisa por e-mail os acessos ATIVOS da página do cliente (sem o texto da
 * mensagem). Falha aqui nunca derruba a resposta, que já foi gravada. Não vai
 * para obras_envio: nenhum tipo do check cobre aviso do portal. A leitura dos
 * acessos usa o cliente admin porque a RLS de obras_portal_acesso é só admin
 * (o engenheiro responde mas não lê a lista); a autorização acima já foi feita.
 */
async function avisarCliente(supabase: Awaited<ReturnType<typeof createClient>>, obraId: string) {
  try {
    const link = linkPortalObra()
    if (!link) return
    const { data: acessos } = await createAdminClient()
      .from('obras_portal_acesso')
      .select('email')
      .eq('obra_id', obraId)
      .eq('ativo', true)
    const para = [...new Set(((acessos ?? []) as { email: string }[]).map((a) => a.email))]
    if (!para.length) return
    const { data: obra } = await supabase.from('obras_obra').select('loja, descricao, os').eq('id', obraId).maybeSingle()
    const o = (obra ?? {}) as { loja?: string | null; descricao?: string | null; os?: string | null }
    const loja = String(o.loja ?? o.descricao ?? o.os ?? 'Obra').trim() || 'Obra'
    const msg = montarEmailNovaMensagem({ loja, linkObra: link })
    await enviarEmail({ para, ...msg, anexos: [] })
  } catch {
    // aviso é cortesia; a resposta já está gravada
  }
}
