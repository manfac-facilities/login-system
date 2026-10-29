'use server'

/**
 * Server Actions do diário de obra (RDO) da modalidade OBRA — spec §5.3.
 *
 * Quem preenche: qualquer usuário com acesso `obras` (ou administrador). Guarda
 * falha fechada. Só mexe em rascunho: validar/enviar é da Task 9b, e aplicar o
 * avanço em `obras_atividade_exec` acontece na validação, não aqui.
 *
 * O banco é a segunda barreira (trigger OBRAS_RDO_ESTADO: conteúdo fora de
 * rascunho é imutável; RLS de avanço/foto: só com o RDO pai em rascunho). A
 * checagem vem antes aqui, e o erro do banco vira mensagem em pt-BR.
 *
 * Sem `export type` aqui — tipos em `_tipos.ts`.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../_lib/tipos'
import { lerObraGrande } from '../../_lib/leitura'
import { podeIniciar } from '../../_lib/cronograma'
import type { AvancoRdo, CausaNaoAndou, Clima, RascunhoRdo, Resultado } from './_tipos'

const NAO_AUTENTICADO = 'Não autenticado'
const SEM_ACESSO = 'Sem acesso ao Gestão de Obras'
const SEM_BASE = 'Sem cronograma — o diário começa quando a base for salva'
const JA_VALIDADO = 'Diário já validado'
const JA_ENVIADO = 'Diário já enviado'
const RDO_NAO_ENCONTRADO = 'Diário não encontrado'
const CLIMAS: Clima[] = ['sol', 'nublado', 'chuva', 'impraticavel']
const CAUSAS: CausaNaoAndou[] = ['cliente', 'material', 'equipe', 'clima', 'projeto', 'outro']
const ISO = /^\d{4}-\d{2}-\d{2}$/

type Erro = { ok: false; erro: string }
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const falha = (erro: string): Erro => ({ ok: false, erro })

/** RDO que saiu de rascunho no meio do caminho: trigger ou RLS recusam. */
function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.message.includes('OBRAS_RDO_ESTADO') || e.code === '42501' || e.message.includes('row-level security')) {
    return falha(JA_VALIDADO)
  }
  if (e.code === '23505') return falha('Outra pessoa salvou o diário deste dia agora. Recarregue a página.')
  return falha(`Não foi possível ${acao}. Tente de novo em instantes. (${e.message})`)
}

async function autorizar(): Promise<{ supabase: SupabaseClient } | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha(NAO_AUTENTICADO)
  if ((await hasSystemAccess(supabase, email, 'obras')) || (await isAdmin(supabase, email))) return { supabase }
  return falha(SEM_ACESSO)
}

const estadoTravado = (estado: unknown): Erro | null =>
  estado === 'rascunho' ? null : falha(estado === 'enviado' ? JA_ENVIADO : JA_VALIDADO)

const texto = (s: string | null | undefined): string | null => {
  const t = (s ?? '').trim()
  return t ? t : null
}

const fracao = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 1
const arred = (x: number) => Math.round(x * 10000) / 10000

function revalidar(obraId: string) {
  revalidatePath(`/obras/obras/${obraId}/diario`)
}

export async function salvarRascunhoAction(
  obraId: string,
  data: string,
  corpo: RascunhoRdo,
): Promise<Resultado & { rdoId?: string }> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth
  if (!ISO.test(data)) return falha('Data inválida')

  // Validação do corpo (entrada do navegador: não confiável).
  const semExecucao = corpo.semExecucao === true
  const motivo = texto(corpo.motivoSemExecucao)
  if (semExecucao && !motivo) return falha('Diga o motivo de não ter tido execução hoje')
  if (corpo.clima !== null && !CLIMAS.includes(corpo.clima)) return falha('Clima inválido')
  const efetivo = semExecucao ? null : corpo.efetivo
  if (efetivo !== null && !(Number.isInteger(efetivo) && efetivo >= 0 && efetivo <= 9999)) {
    return falha('Efetivo precisa ser um número inteiro de pessoas')
  }

  const lida = await lerObraGrande(supabase, obraId, hojeISO())
  if (!lida.ok) return lida
  const { obra, versaoBase, plano, exec } = lida.dados
  if (obra.modalidade !== 'obra') return falha('Obra não encontrada')
  if (!versaoBase?.salvaEm) return falha(SEM_BASE)

  const avancos: AvancoRdo[] = []
  if (!semExecucao) {
    const vistos = new Set<number>()
    for (const a of corpo.avancos ?? []) {
      if (!plano.some((p) => p.numero === a.numero) || vistos.has(a.numero)) {
        return falha(`Atividade ${a.numero} não está no cronograma`)
      }
      vistos.add(a.numero)
      if (!fracao(a.para)) return falha(`Atividade ${a.numero}: percentual precisa estar entre 0 e 100%`)
      if (a.causa !== null && !CAUSAS.includes(a.causa)) return falha(`Atividade ${a.numero}: causa inválida`)
      const de = arred(exec.find((e) => e.numero === a.numero)?.percentual ?? 0)
      const concluida = a.concluida === true
      const para = concluida ? 1 : arred(a.para)
      if (para > de || concluida) {
        const trava = podeIniciar(a.numero, plano, exec, obra.atividade_trava ?? null)
        if (!trava.ok) return falha(`Atividade ${a.numero}: ${trava.motivo.charAt(0).toLowerCase()}${trava.motivo.slice(1)}`)
      }
      if (para < de && !a.causa) return falha(`Atividade ${a.numero}: o percentual caiu — diga por quê`)
      avancos.push({ numero: a.numero, de, para, concluida, causa: a.causa })
    }
  }

  const campos = {
    sem_execucao: semExecucao,
    motivo_sem_execucao: semExecucao ? motivo : null,
    efetivo,
    equipe_texto: semExecucao ? null : texto(corpo.equipeTexto),
    clima: corpo.clima,
    programacao_amanha: texto(corpo.programacaoAmanha),
    atualizado_em: new Date().toISOString(),
  }

  const { data: existente, error: errL } = await supabase
    .from('obras_rdo')
    .select('id, estado')
    .eq('obra_id', obraId)
    .eq('data', data)
    .maybeSingle()
  if (errL) return erroBanco('ler o diário', errL)

  let rdoId: string
  if (existente) {
    const travado = estadoTravado(existente.estado)
    if (travado) return travado
    rdoId = existente.id as string
    const { error } = await supabase.from('obras_rdo').update(campos).eq('id', rdoId)
    if (error) return erroBanco('salvar o diário', error)
  } else {
    // Estado não vai no insert: o banco cria como rascunho.
    const { data: novo, error } = await supabase
      .from('obras_rdo')
      .insert({ obra_id: obraId, data, ...campos })
      .select('id')
      .single()
    if (error || !novo) return erroBanco('criar o diário', error ?? { message: 'sem retorno' })
    rdoId = (novo as Linha).id as string
  }

  // Substitui as linhas de avanço sem janela de perda: grava as novas primeiro,
  // depois tira as que saíram da lista.
  if (avancos.length) {
    const { error } = await supabase
      .from('obras_rdo_avanco')
      .upsert(avancos.map((a) => ({ rdo_id: rdoId, ...a })), { onConflict: 'rdo_id,numero' })
    if (error) return erroBanco('salvar o avanço', error)
  }
  let apagar = supabase.from('obras_rdo_avanco').delete().eq('rdo_id', rdoId)
  if (avancos.length) apagar = apagar.not('numero', 'in', `(${avancos.map((a) => a.numero).join(',')})`)
  const { error: errD } = await apagar
  if (errD) return erroBanco('salvar o avanço', errD)

  revalidar(obraId)
  return { ok: true, rdoId }
}

async function lerRdo(supabase: SupabaseClient, rdoId: string): Promise<Linha | Erro> {
  const { data, error } = await supabase
    .from('obras_rdo')
    .select('id, obra_id, data, estado')
    .eq('id', rdoId)
    .maybeSingle()
  if (error) return erroBanco('ler o diário', error)
  if (!data) return falha(RDO_NAO_ENCONTRADO)
  return data as Linha
}

export async function registrarFotoAction(
  rdoId: string,
  path: string,
  legenda: string | null,
): Promise<Resultado & { fotoId?: string }> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth

  const rdo = await lerRdo(supabase, rdoId)
  if ('ok' in rdo) return rdo as Erro
  const travado = estadoTravado(rdo.estado)
  if (travado) return travado

  const prefixo = `${rdo.obra_id}/rdo/${String(rdo.data).slice(0, 10)}/`
  const nome = path.startsWith(prefixo) ? path.slice(prefixo.length) : ''
  if (!/^[0-9a-f-]{36}\.jpg$/i.test(nome)) return falha('Caminho de foto inválido')

  const { data: atuais, error: errO } = await supabase.from('obras_rdo_foto').select('ordem').eq('rdo_id', rdoId)
  if (errO) return erroBanco('ler as fotos', errO)
  const ordem = ((atuais ?? []) as Linha[]).reduce((m, f) => Math.max(m, Number(f.ordem ?? 0)), 0) + 1

  const { data: nova, error } = await supabase
    .from('obras_rdo_foto')
    .insert({ rdo_id: rdoId, path, legenda: texto(legenda), ordem })
    .select('id')
    .single()
  if (error || !nova) return erroBanco('registrar a foto', error ?? { message: 'sem retorno' })

  revalidar(rdo.obra_id as string)
  return { ok: true, fotoId: (nova as Linha).id as string }
}

/**
 * Tira a foto do diário. O arquivo fica no bucket: não há policy de delete em
 * `obras-fotos` (dívida registrada no relatório da Task 8).
 */
export async function removerFotoAction(fotoId: string): Promise<Resultado> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth

  const { data: foto, error: errF } = await supabase
    .from('obras_rdo_foto')
    .select('id, rdo_id')
    .eq('id', fotoId)
    .maybeSingle()
  if (errF) return erroBanco('ler a foto', errF)
  if (!foto) return falha('Foto não encontrada')

  const rdo = await lerRdo(supabase, (foto as Linha).rdo_id as string)
  if ('ok' in rdo) return rdo as Erro
  const travado = estadoTravado(rdo.estado)
  if (travado) return travado

  const { data: apagadas, error } = await supabase.from('obras_rdo_foto').delete().eq('id', fotoId).select('id')
  if (error) return erroBanco('tirar a foto', error)
  if (!apagadas?.length) return falha(JA_VALIDADO) // RLS barrou em silêncio: o RDO saiu de rascunho.

  revalidar(rdo.obra_id as string)
  return { ok: true }
}
