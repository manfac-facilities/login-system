'use server'

/**
 * Server Actions de comunicação e configuração da OBRA (Task 10).
 *
 * Só administrador escreve (o banco é a segunda barreira: RLS + trigger 42501).
 * Sem `export type` aqui — tipos em `_tipos.ts`.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import {
  ABRANGENCIAS_FERIADO,
  TIPOS_ENVIO,
  type ConfigObra,
  type DestinatarioEntrada,
  type FeriadoEntrada,
  type PesoAvanco,
  type Resultado,
} from './_tipos'

type Erro = { ok: false; erro: string }
const falha = (erro: string): Erro => ({ ok: false, erro })
const ISO = /^\d{4}-\d{2}-\d{2}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function autorizarAdmin(): Promise<{ supabase: SupabaseClient } | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha('Não autenticado')
  if (await isAdmin(supabase, email)) return { supabase }
  return falha('Só administrador altera a comunicação e a configuração da obra')
}

function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.code === '23505') return falha('Este e-mail já está cadastrado nesta obra')
  if (e.code === '42501' || e.message.includes('row-level security')) return falha('Você não tem permissão para isso.')
  if (e.code === '23514') return falha('Dados inválidos: confira lado e tipos de envio.')
  return falha(`Não foi possível ${acao}. Tente de novo em instantes.`)
}

const texto = (s: string | null | undefined) => (s ?? '').trim() || null

export async function salvarDestinatarioAction(obraId: string, d: DestinatarioEntrada): Promise<Resultado> {
  const auth = await autorizarAdmin()
  if ('ok' in auth) return auth
  const { supabase } = auth

  const email = (d.email ?? '').trim().toLowerCase()
  if (!EMAIL.test(email)) return falha('E-mail inválido')
  if (d.lado !== 'cliente' && d.lado !== 'interno') return falha('Diga se é do cliente ou interno')
  const validos: readonly string[] = TIPOS_ENVIO.map((t) => t.valor)
  const tipos = [...new Set(d.tipos ?? [])]
  if (!tipos.length) return falha('Escolha ao menos um tipo de envio')
  if (tipos.some((t) => !validos.includes(t))) return falha('Tipo de envio inválido')

  const linha = {
    obra_id: obraId,
    email,
    nome: texto(d.nome),
    funcao: texto(d.funcao),
    lado: d.lado,
    tipos,
    ativo: d.ativo === true,
  }
  const { error } = d.id
    ? await supabase.from('obras_destinatario').update(linha).eq('id', d.id).eq('obra_id', obraId)
    : await supabase.from('obras_destinatario').insert(linha)
  if (error) return erroBanco('salvar o destinatário', error)

  revalidatePath(`/obras/obras/${obraId}/configuracoes`)
  return { ok: true }
}

export async function salvarConfigObraAction(obraId: string, c: ConfigObra): Promise<Resultado> {
  const auth = await autorizarAdmin()
  if ('ok' in auth) return auth
  const { supabase } = auth

  const engenheiro = texto(c.engenheiroEmail)?.toLowerCase() ?? null
  if (engenheiro) {
    if (!EMAIL.test(engenheiro)) return falha('E-mail do engenheiro inválido')
    const temAcesso = (await hasSystemAccess(supabase, engenheiro, 'obras')) || (await isAdmin(supabase, engenheiro))
    if (!temAcesso) return falha('O engenheiro precisa ter acesso ao Gestão de Obras')
  }
  if (c.dataBase !== null && !ISO.test(c.dataBase)) return falha('Data-base inválida')
  if (c.atividadeTrava !== null && !(Number.isInteger(c.atividadeTrava) && c.atividadeTrava > 0)) {
    return falha('Atividade-trava inválida')
  }

  const { data: obra, error: eObra } = await supabase
    .from('obras_obra')
    .select('id, modalidade, data_base')
    .eq('id', obraId)
    .maybeSingle()
  if (eObra) return erroBanco('ler a obra', eObra)
  if (!obra || obra.modalidade !== 'obra') return falha('Obra não encontrada')

  if (c.dataBase !== (obra.data_base ?? null)) {
    const { data: v1, error: eV } = await supabase
      .from('obras_cronograma_versao')
      .select('salva_em')
      .eq('obra_id', obraId)
      .eq('numero', 1)
      .maybeSingle()
    if (eV) return erroBanco('ler o cronograma', eV)
    if (v1?.salva_em) return falha('A base já foi salva — a data-base não muda')
  }

  const { error } = await supabase
    .from('obras_obra')
    .update({ engenheiro_email: engenheiro, data_base: c.dataBase, atividade_trava: c.atividadeTrava })
    .eq('id', obraId)
  if (error) return erroBanco('salvar a configuração', error)

  revalidatePath(`/obras/obras/${obraId}/configuracoes`)
  revalidatePath(`/obras/obras/${obraId}`)
  return { ok: true }
}

export async function salvarPesoAvancoAction(obraId: string, peso: PesoAvanco): Promise<Resultado> {
  const auth = await autorizarAdmin()
  if ('ok' in auth) return auth
  const { supabase } = auth
  if (peso !== null && peso !== 'valor' && peso !== 'duracao') return falha('Critério de peso inválido')

  const { data: obra, error: eObra } = await supabase
    .from('obras_obra')
    .select('id, modalidade')
    .eq('id', obraId)
    .maybeSingle()
  if (eObra) return erroBanco('ler a obra', eObra)
  if (!obra || obra.modalidade !== 'obra') return falha('Obra não encontrada')

  const { error } = await supabase.from('obras_obra').update({ peso_avanco: peso }).eq('id', obraId)
  if (error) return erroBanco('salvar o peso do avanço', error)

  revalidatePath(`/obras/obras/${obraId}/configuracoes`)
  revalidatePath(`/obras/obras/${obraId}`)
  return { ok: true }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * "Esta obra é aditivo de…" (OS filha). Só admin. Um nível só e sem ciclo: a mãe é modalidade
 * obra e não é aditivo de outra; obra com aditivos não vira aditivo. O trigger da guarda de
 * parâmetros confere tudo de novo (OBRAS_OBRA_PAI).
 */
export async function salvarObraMaeAction(obraId: string, maeId: string | null): Promise<Resultado> {
  const auth = await autorizarAdmin()
  if ('ok' in auth) return auth
  const { supabase } = auth
  if (maeId !== null && !UUID.test(maeId)) return falha('Obra mãe inválida')
  if (maeId === obraId) return falha('A obra não pode ser aditivo de si mesma')

  const { data: obra, error: eObra } = await supabase.from('obras_obra').select('id, modalidade').eq('id', obraId).maybeSingle()
  if (eObra) return erroBanco('ler a obra', eObra)
  if (!obra || obra.modalidade !== 'obra') return falha('Obra não encontrada')

  if (maeId !== null) {
    const { data: mae, error: eMae } = await supabase
      .from('obras_obra')
      .select('id, modalidade, obra_pai_id')
      .eq('id', maeId)
      .maybeSingle()
    if (eMae) return erroBanco('ler a obra mãe', eMae)
    if (!mae) return falha('Obra mãe não encontrada')
    if (mae.modalidade !== 'obra') return falha('A obra mãe tem de ser da modalidade OBRA')
    if (mae.obra_pai_id) return falha('A obra escolhida já é aditivo de outra (um nível só)')
    const { data: filhas, error: eF } = await supabase.from('obras_obra').select('id').eq('obra_pai_id', obraId)
    if (eF) return erroBanco('ler os aditivos', eF)
    if ((filhas ?? []).length) return falha('Esta obra tem aditivos; não pode ser aditivo de outra (um nível só)')
  }

  const { error } = await supabase.from('obras_obra').update({ obra_pai_id: maeId }).eq('id', obraId)
  if (error) {
    const m = /OBRAS_OBRA_PAI: (.+)/.exec(error.message ?? '')
    if (m) return falha(m[1].charAt(0).toUpperCase() + m[1].slice(1))
    return erroBanco('salvar a obra mãe', error)
  }
  revalidatePath(`/obras/obras/${obraId}/configuracoes`)
  if (maeId) revalidatePath(`/obras/obras/${maeId}/configuracoes`)
  return { ok: true }
}

const dataValida = (s: string) => {
  if (!ISO.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export async function adicionarFeriadoObraAction(obraId: string, f: FeriadoEntrada): Promise<Resultado> {
  const auth = await autorizarAdmin()
  if ('ok' in auth) return auth
  const { supabase } = auth

  if (!dataValida(f.data ?? '')) return falha('Data inválida')
  const descricao = texto(f.descricao)
  if (!descricao) return falha('Descreva o feriado')
  const validas: readonly string[] = ABRANGENCIAS_FERIADO.map((a) => a.valor)
  if (!validas.includes(f.abrangencia)) return falha('Abrangência inválida')

  const { data: obra, error: eObra } = await supabase
    .from('obras_obra')
    .select('id, modalidade')
    .eq('id', obraId)
    .maybeSingle()
  if (eObra) return erroBanco('ler a obra', eObra)
  if (!obra || obra.modalidade !== 'obra') return falha('Obra não encontrada')

  const { data: ja, error: eJa } = await supabase
    .from('obras_feriado')
    .select('data')
    .eq('obra_id', obraId)
    .eq('data', f.data)
    .maybeSingle()
  if (eJa) return erroBanco('conferir os feriados', eJa)
  if (ja) return falha('Esta data já é feriado desta obra')

  const { error } = await supabase
    .from('obras_feriado')
    .insert({ obra_id: obraId, data: f.data, descricao, abrangencia: f.abrangencia })
  if (error) {
    if (error.code === '23505') return falha('Esta data já é feriado desta obra')
    return erroBanco('salvar o feriado', error)
  }

  revalidatePath(`/obras/obras/${obraId}/configuracoes`)
  revalidatePath(`/obras/obras/${obraId}`)
  return { ok: true }
}

/** Remove só feriado da própria obra — o global nunca sai por aqui. */
export async function removerFeriadoObraAction(obraId: string, data: string): Promise<Resultado> {
  const auth = await autorizarAdmin()
  if ('ok' in auth) return auth
  const { supabase } = auth
  if (!dataValida(data ?? '')) return falha('Data inválida')

  const { error } = await supabase.from('obras_feriado').delete().eq('obra_id', obraId).eq('data', data)
  if (error) return erroBanco('remover o feriado', error)

  revalidatePath(`/obras/obras/${obraId}/configuracoes`)
  revalidatePath(`/obras/obras/${obraId}`)
  return { ok: true }
}
