'use server'

/**
 * Server Actions do plano da semana (Leva 3, Task 4). Fechar e avaliar: só o
 * engenheiro da obra ou admin (o banco confere de novo). A obra é lida do banco
 * pelo id da rota; o % realizado vem do exec no servidor, nunca do navegador.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../_lib/tipos'
import { CAUSA, type CausaRdo } from '../../_lib/causas'
import { avaliarItem, dataEnvioSemanal } from '../../_lib/last-planner'
import { feriadosDaObra, lerPlano } from '../../_lib/leitura'
import type { Resultado } from './_tipos'
import { segundaValida, semanaFechavel, type ItemAvaliacao, type ItemFechamento } from './_plano-tipos'

type Erro = { ok: false; erro: string }
const falha = (erro: string): Erro => ({ ok: false, erro })
const SO_ENGENHEIRO = 'Só o engenheiro responsável da obra ou um administrador faz isso'

async function autorizarEngenheiro(obraId: string): Promise<{ supabase: SupabaseClient; email: string; admin: boolean } | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha('Não autenticado')
  const admin = await isAdmin(supabase, email)
  if (!admin && !(await hasSystemAccess(supabase, email, 'obras'))) return falha('Sem acesso ao Gestão de Obras')
  const { data: obra, error } = await supabase.from('obras_obra').select('id, engenheiro_email').eq('id', obraId).maybeSingle()
  if (error) return falha('Não foi possível ler a obra.')
  if (!obra) return falha('Obra não encontrada')
  const eng = typeof obra.engenheiro_email === 'string' ? obra.engenheiro_email.trim().toLowerCase() : ''
  if (!admin && !(eng !== '' && eng === email)) return falha(SO_ENGENHEIRO)
  return { supabase, email, admin }
}

function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.code === '23505') return falha('Já existe plano fechado para esta semana.')
  if (e.code === '42501' || e.message.includes('row-level security')) return falha(SO_ENGENHEIRO)
  if (e.code === '23514') return falha('Dados inválidos: confira as metas e causas.')
  return falha(`Não foi possível ${acao}. Tente de novo em instantes.`)
}

const revalidar = (obraId: string) => {
  revalidatePath(`/obras/obras/${obraId}/lookahead`)
  revalidatePath(`/obras/obras/${obraId}`)
}

/** Números das atividades da versão vigente (última salva; sem salva, o rascunho). */
async function numerosVigentes(supabase: SupabaseClient, obraId: string): Promise<Set<number> | Erro> {
  const { data: vs, error } = await supabase.from('obras_cronograma_versao').select('id, numero, salva_em').eq('obra_id', obraId)
  if (error) return falha('Não foi possível ler o cronograma.')
  const versoes = ((vs ?? []) as { id: string; numero: number; salva_em: string | null }[]).slice().sort((a, b) => a.numero - b.numero)
  const salvas = versoes.filter((v) => v.salva_em)
  const vigente = salvas.length ? salvas[salvas.length - 1] : versoes.filter((v) => !v.salva_em).pop()
  if (!vigente) return falha('A obra ainda não tem cronograma')
  const { data, error: e2 } = await supabase.from('obras_atividade').select('numero').eq('versao_id', vigente.id)
  if (e2) return falha('Não foi possível ler as atividades.')
  return new Set(((data ?? []) as { numero: number }[]).map((a) => a.numero))
}

export async function fecharPlanoAction(obraId: string, semana: string, itens: ItemFechamento[]): Promise<Resultado> {
  const auth = await autorizarEngenheiro(obraId)
  if ('ok' in auth) return auth
  const { supabase } = auth
  const segunda = segundaValida(semana)
  if (!segunda) return falha('Semana inválida')
  if (!semanaFechavel(segunda, hojeISO())) return falha('Só dá para fechar o plano da semana atual ou da próxima.')
  if (!Array.isArray(itens) || itens.length === 0) return falha('Marque ao menos uma atividade para o plano')
  const vistos = new Set<number>()
  for (const i of itens) {
    if (!(Number.isInteger(i?.numero) && i.numero > 0)) return falha('Atividade inválida')
    if (vistos.has(i.numero)) return falha('Atividade repetida no plano')
    vistos.add(i.numero)
    if (!(typeof i.meta === 'number' && Number.isFinite(i.meta) && i.meta > 0 && i.meta <= 1)) {
      return falha('A meta de cada atividade deve ficar entre 1% e 100%')
    }
  }
  const nums = await numerosVigentes(supabase, obraId)
  if (!(nums instanceof Set)) return nums
  if (itens.some((i) => !nums.has(i.numero))) return falha('Atividade não encontrada no cronograma vigente')

  const ex = await lerPlano(supabase, obraId, segunda)
  if (!ex.ok) return falha('Não foi possível ler o plano da semana.')
  if (ex.plano) return falha('Já existe plano fechado para esta semana.')

  const { error } = await supabase.rpc('obras_fechar_plano', {
    p_obra: obraId,
    p_semana: segunda,
    p_itens: itens.map((i) => ({ numero: i.numero, meta_percentual: i.meta })),
  })
  if (error) return erroBanco('fechar o plano', error)
  revalidar(obraId)
  return { ok: true }
}

export async function avaliarPlanoAction(obraId: string, semana: string, avaliacoes: ItemAvaliacao[]): Promise<Resultado> {
  const auth = await autorizarEngenheiro(obraId)
  if ('ok' in auth) return auth
  const { supabase, admin } = auth
  const segunda = segundaValida(semana)
  if (!segunda) return falha('Semana inválida')
  if (!Array.isArray(avaliacoes) || avaliacoes.length === 0) return falha('Nada para avaliar')

  const fer = await feriadosDaObra(supabase, obraId)
  if (!fer.ok) return falha('Não foi possível ler os feriados.')
  const liberaEm = dataEnvioSemanal(segunda, fer.feriados)
  if (hojeISO() < liberaEm) return falha('A avaliação abre na data de envio do semanal (a partir desta data).')

  const pl = await lerPlano(supabase, obraId, segunda)
  if (!pl.ok) return falha('Não foi possível ler o plano da semana.')
  if (!pl.plano) return falha('Não há plano fechado para esta semana')
  const plano = pl.plano

  const { data: ex, error: eExec } = await supabase
    .from('obras_atividade_exec')
    .select('numero, status, percentual')
    .eq('obra_id', obraId)
  if (eExec) return falha('Não foi possível ler a execução.')
  const exec = new Map(
    ((ex ?? []) as { numero: number; status: string; percentual: number | null }[]).map((e) => [
      e.numero,
      e.status === 'concluido' ? 1 : Math.min(1, Math.max(0, Number(e.percentual ?? 0))),
    ]),
  )

  const vistos = new Set<number>()
  const gravar: { numero: number; final: number; cumprido: boolean; causa: CausaRdo | null }[] = []
  for (const a of avaliacoes) {
    if (vistos.has(a.numero)) return falha('Atividade repetida')
    vistos.add(a.numero)
    const item = plano.itens.find((i) => i.numero === a.numero)
    if (!item) return falha('Atividade fora do plano da semana')
    if (item.avaliadoEm && !admin) return falha('Este item já foi avaliado; só administrador reavalia.')
    const final = exec.get(a.numero) ?? 0
    const cumprido = avaliarItem(item.metaPercentual, final)
    if (cumprido) {
      gravar.push({ numero: a.numero, final, cumprido, causa: null })
      continue
    }
    if (!a.causa || !(a.causa in CAUSA)) return falha('Diga a causa de cada item não cumprido')
    gravar.push({ numero: a.numero, final, cumprido, causa: a.causa as CausaRdo })
  }

  for (const g of gravar) {
    const { error } = await supabase
      .from('obras_plano_item')
      .update({ percentual_final: g.final, cumprido: g.cumprido, causa: g.causa })
      .eq('plano_id', plano.id)
      .eq('numero', g.numero)
    if (error) return erroBanco('salvar a avaliação', error)
  }
  revalidar(obraId)
  return { ok: true }
}
