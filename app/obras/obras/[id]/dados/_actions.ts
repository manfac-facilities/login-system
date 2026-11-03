'use server'

/**
 * Server Actions da aba Dados da obra (Fases B/C §2.1–2.2): valor receita por OS e organograma
 * do cliente. SÓ administrador (conferido aqui e de novo no banco: o organograma tem RLS + trigger de admin;
 * `obras_obra.valor` tem o trigger `obras_obra_valor_guarda`, erro OBRAS_VALOR). Sempre o cliente da SESSÃO
 * (nunca service role), para o trigger valer.
 * Os chips Portal/Diário/Semanal/Mensal NÃO têm action aqui: usam as das Configurações.
 * Sem `export type` aqui.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { centavosDeTexto, erroDoBanco } from '../../_lib/medicao'
import { reordenar, type Pessoa } from '../../_lib/organograma'
import type { PessoaEntrada, Resultado } from './_tipos'

const falha = (erro: string) => ({ ok: false as const, erro })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function autorizarAdmin(paginaId: string): Promise<{ supabase: SupabaseClient } | { ok: false; erro: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha('Não autenticado')
  if (!(await isAdmin(supabase, email))) return falha('Só administrador altera os dados da obra')
  if (!UUID.test(paginaId ?? '')) return falha('Obra não encontrada')
  return { supabase }
}

const rev = (paginaId: string) => {
  revalidatePath(`/obras/obras/${paginaId}/dados`)
  revalidatePath(`/obras/obras/${paginaId}/financeiro`)
}

/** Valor receita da OS (mãe ou aditivo da obra da página), em `obras_obra.valor` (REAIS). Vazio apaga. */
export async function salvarValorReceitaAction(paginaId: string, osId: string, texto: string): Promise<Resultado> {
  const auth = await autorizarAdmin(paginaId)
  if ('ok' in auth) return auth
  if (!UUID.test(osId ?? '')) return falha('OS não encontrada')
  const vazio = !String(texto ?? '').trim()
  const centavos = vazio ? null : centavosDeTexto(texto)
  if (!vazio && (centavos === null || centavos <= 0)) return falha('Valor receita inválido: use reais, como 437.772,41')
  if (centavos !== null && centavos > 99_999_999_999_99) return falha('Valor receita alto demais')

  const { data: os, error: eOs } = await auth.supabase
    .from('obras_obra')
    .select('id, obra_pai_id, modalidade, cancelado_em')
    .eq('id', osId)
    .maybeSingle()
  if (eOs) return falha('Não foi possível ler a OS. Tente de novo.')
  const o = os as { id: string; obra_pai_id: string | null; modalidade: string; cancelado_em?: string | null } | null
  if (!o || o.modalidade !== 'obra' || (o.id !== paginaId && o.obra_pai_id !== paginaId)) return falha('OS não encontrada nesta obra')
  if (o.cancelado_em && o.id !== paginaId) return falha('Esta OS foi cancelada: o valor receita não conta mais')

  const { error } = await auth.supabase.from('obras_obra').update({ valor: centavos === null ? null : centavos / 100 }).eq('id', osId)
  if (error) return falha(erroDoBanco(error, 'Não foi possível salvar o valor receita. Tente de novo.'))
  rev(paginaId)
  if (o.obra_pai_id) rev(o.obra_pai_id)
  return { ok: true }
}

export async function salvarPessoaAction(paginaId: string, p: PessoaEntrada): Promise<Resultado> {
  const auth = await autorizarAdmin(paginaId)
  if ('ok' in auth) return auth
  const nome = String(p?.nome ?? '').trim()
  if (!nome) return falha('Informe o nome')
  if (nome.length > 200) return falha('Nome longo demais')
  const cargo = String(p?.cargo ?? '').trim() || null
  if (cargo && cargo.length > 200) return falha('Cargo longo demais')
  const email = String(p?.email ?? '').trim().toLowerCase() || null
  if (email && !EMAIL.test(email)) return falha('E-mail inválido')

  const linha = { nome, cargo, email }
  if (p.id) {
    if (!UUID.test(p.id)) return falha('Pessoa não encontrada')
    const { data, error } = await auth.supabase.from('obras_cliente_pessoa').update(linha).eq('id', p.id).eq('obra_id', paginaId).select('id')
    if (error) return falha(error.code === '23505' ? 'Este e-mail já está no organograma desta obra' : erroDoBanco(error, 'Não foi possível salvar a pessoa. Tente de novo.'))
    if (!data || (data as unknown[]).length === 0) return falha('Pessoa não encontrada')
  } else {
    const { data: ult, error: eU } = await auth.supabase
      .from('obras_cliente_pessoa')
      .select('ordem')
      .eq('obra_id', paginaId)
      .order('ordem', { ascending: false })
      .limit(1)
    if (eU) return falha('Não foi possível ler o organograma. Tente de novo.')
    const ordem = ((ult ?? []) as { ordem: number }[]).length ? Number((ult as { ordem: number }[])[0].ordem) + 1 : 0
    const { error } = await auth.supabase.from('obras_cliente_pessoa').insert({ ...linha, obra_id: paginaId, ordem })
    if (error) return falha(error.code === '23505' ? 'Este e-mail já está no organograma desta obra' : erroDoBanco(error, 'Não foi possível adicionar a pessoa. Tente de novo.'))
  }
  rev(paginaId)
  return { ok: true }
}

/**
 * Tira a pessoa do organograma. Envios e acesso ao portal desse e-mail NÃO são apagados:
 * passam a aparecer em "sem cadastro no organograma" (nada some em silêncio).
 */
export async function removerPessoaAction(paginaId: string, pessoaId: string): Promise<Resultado> {
  const auth = await autorizarAdmin(paginaId)
  if ('ok' in auth) return auth
  if (!UUID.test(pessoaId ?? '')) return falha('Pessoa não encontrada')
  const { error } = await auth.supabase.from('obras_cliente_pessoa').delete().eq('id', pessoaId).eq('obra_id', paginaId)
  if (error) return falha(erroDoBanco(error, 'Não foi possível remover a pessoa. Tente de novo.'))
  rev(paginaId)
  return { ok: true }
}

export async function moverPessoaAction(paginaId: string, pessoaId: string, direcao: 'cima' | 'baixo'): Promise<Resultado> {
  const auth = await autorizarAdmin(paginaId)
  if ('ok' in auth) return auth
  if (direcao !== 'cima' && direcao !== 'baixo') return falha('Direção inválida')
  const { data, error } = await auth.supabase
    .from('obras_cliente_pessoa')
    .select('id, nome, cargo, email, ordem')
    .eq('obra_id', paginaId)
    .order('ordem')
    .order('criado_em')
  if (error) return falha('Não foi possível ler o organograma. Tente de novo.')
  const mudancas = reordenar((data ?? []) as Pessoa[], pessoaId, direcao)
  for (const m of mudancas) {
    const { error: eM } = await auth.supabase.from('obras_cliente_pessoa').update({ ordem: m.ordem }).eq('id', m.id).eq('obra_id', paginaId)
    if (eM) return falha(erroDoBanco(eM, 'Não foi possível reordenar. Tente de novo.'))
  }
  rev(paginaId)
  return { ok: true }
}

/**
 * Coordenador da obra (Leva 6b §2.1): e-mail que, com o engenheiro e o admin, edita/emite/envia a planta
 * de faseamento. Grava direto em `obras_obra.coordenador_email` (não passa pelo `obras_aplicar_alteracao`);
 * o trigger `obras_obra_parametros_guarda` exige admin de novo (OBRAS_PARAMETROS). Vazio apaga.
 */
export async function salvarCoordenadorAction(paginaId: string, email: string): Promise<Resultado> {
  const auth = await autorizarAdmin(paginaId)
  if ('ok' in auth) return auth
  const e = String(email ?? '').trim().toLowerCase() || null
  if (e && (!EMAIL.test(e) || e.length > 254)) return falha('E-mail inválido')
  const { data, error } = await auth.supabase.from('obras_obra').update({ coordenador_email: e }).eq('id', paginaId).eq('modalidade', 'obra').select('id')
  if (error) {
    if (String(error.message ?? '').includes('OBRAS_PARAMETROS')) return falha('Só administrador altera os dados da obra')
    return falha(erroDoBanco(error, 'Não foi possível salvar o coordenador. Tente de novo.'))
  }
  if (!data || (data as unknown[]).length === 0) return falha('Obra não encontrada')
  rev(paginaId)
  revalidatePath(`/obras/obras/${paginaId}/faseamento`)
  return { ok: true }
}
