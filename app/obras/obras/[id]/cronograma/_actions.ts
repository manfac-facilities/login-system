'use server'

/**
 * Server Actions do cronograma da OBRA: editar o rascunho, salvar a base/revisão,
 * criar revisão e atualizar a execução (spec §5.2 e §7.1).
 *
 * Quem pode: o engenheiro da obra (`obras_obra.engenheiro_email`, com acesso ao
 * sistema `obras`) ou administrador. Guarda falha fechada: obra sem engenheiro
 * só aceita admin. Os triggers do banco (OBRAS_VERSAO_SALVA, autoria) são a
 * segunda barreira; aqui a checagem vem antes e o erro do banco vira mensagem.
 *
 * Sem `export type` aqui — tipos em `_tipos.ts`.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import {
  CicloNasPredecessoras,
  calcularCronograma,
  podeIniciar,
  type AtividadeExec,
  type AtividadePlano,
  type StatusAtividade,
} from '../../_lib/cronograma'
import type { CamposExecucao, LinhaPlano, Resultado } from './_tipos'

const NAO_AUTENTICADO = 'Não autenticado'
const SEM_PERMISSAO = 'Só o engenheiro da obra ou um administrador altera o cronograma'
const VERSAO_SALVA = 'Versão salva não se altera — crie uma revisão'
const VERSAO_NAO_ENCONTRADA = 'Versão não encontrada'
const STATUS: StatusAtividade[] = ['nao_iniciado', 'em_andamento', 'concluido', 'bloqueado']

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Erro = { ok: false; erro: string }
type Contexto = { supabase: SupabaseClient; email: string; obra: Linha }

const falha = (erro: string): Erro => ({ ok: false, erro })

/** Traduz erro do banco; OBRAS_VERSAO_SALVA (trigger) vira a mensagem da tela. */
function erroBanco(acao: string, e: { message: string }): Erro {
  if (e.message.includes('OBRAS_VERSAO_SALVA')) return falha(VERSAO_SALVA)
  return falha(`Não foi possível ${acao}. Tente de novo em instantes. (${e.message})`)
}

async function autorizar(obraId: string): Promise<Contexto | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha(NAO_AUTENTICADO)

  const { data: obra, error } = await supabase
    .from('obras_obra')
    .select('id, modalidade, engenheiro_email, atividade_trava, data_base')
    .eq('id', obraId)
    .maybeSingle()
  if (error) return erroBanco('ler a obra', error)
  if (!obra || obra.modalidade !== 'obra') return falha('Obra não encontrada')

  if (await isAdmin(supabase, email)) return { supabase, email, obra }
  const engenheiro = (obra.engenheiro_email as string | null)?.trim().toLowerCase()
  if (engenheiro && engenheiro === email && (await hasSystemAccess(supabase, email, 'obras'))) {
    return { supabase, email, obra }
  }
  return falha(SEM_PERMISSAO)
}

function revalidar(obraId: string) {
  revalidatePath(`/obras/obras/${obraId}`, 'layout')
  revalidatePath('/obras/obras')
}

async function lerVersao(ctx: Contexto, versaoId: string): Promise<Linha | Erro> {
  const { data, error } = await ctx.supabase
    .from('obras_cronograma_versao')
    .select('id, obra_id, numero, salva_em')
    .eq('id', versaoId)
    .maybeSingle()
  if (error) return erroBanco('ler a versão', error)
  if (!data || data.obra_id !== ctx.obra.id) return falha(VERSAO_NAO_ENCONTRADA)
  return data
}

const ehErro = (x: unknown): x is Erro => !!x && (x as Erro).ok === false

const inteiroPositivo = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 1
const dataISO = (s: unknown) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'))

const planoDe = (linhas: Linha[]): AtividadePlano[] =>
  linhas.map((a) => ({
    numero: a.numero,
    etapa: a.etapa ?? '',
    descricao: a.descricao ?? '',
    pred1: a.pred1 ?? null,
    pred2: a.pred2 ?? null,
    duracao: a.duracao,
    bloqueiaPorTrava: !!a.bloqueia_por_trava,
    pesoValor: Number(a.peso_valor ?? 0),
  }))

export async function salvarLinhaRascunhoAction(
  obraId: string,
  versaoId: string,
  linha: LinhaPlano,
): Promise<Resultado> {
  const ctx = await autorizar(obraId)
  if (ehErro(ctx)) return ctx
  const versao = await lerVersao(ctx, versaoId)
  if (ehErro(versao)) return versao
  if (versao.salva_em) return falha(VERSAO_SALVA)

  if (!inteiroPositivo(linha.duracao)) return falha('Duração deve ser um número inteiro de dias úteis, a partir de 1')
  const descricao = (linha.descricao ?? '').trim()
  if (!descricao) return falha('Informe a descrição da atividade')
  const etapa = (linha.etapa ?? '').trim()

  const { data: atividades, error } = await ctx.supabase
    .from('obras_atividade')
    .select('*')
    .eq('versao_id', versaoId)
  if (error) return erroBanco('ler o cronograma', error)
  const linhas = (atividades ?? []) as Linha[]
  if (!linhas.some((a) => a.numero === linha.numero)) return falha(`Atividade ${linha.numero} não existe neste cronograma`)

  for (const p of [linha.pred1, linha.pred2]) {
    if (p === null) continue
    if (!inteiroPositivo(p)) return falha('Predecessora inválida')
    if (p === linha.numero) return falha('Uma atividade não pode ser predecessora dela mesma')
    if (!linhas.some((a) => a.numero === p)) return falha(`Predecessora ${p} não existe neste cronograma`)
  }

  const campos = {
    etapa: etapa || null,
    descricao,
    pred1: linha.pred1,
    pred2: linha.pred2,
    duracao: linha.duracao,
    bloqueia_por_trava: !!linha.bloqueiaPorTrava,
  }
  const plano = planoDe(linhas.map((a) => (a.numero === linha.numero ? { ...a, ...campos } : a)))
  try {
    calcularCronograma({
      plano, exec: [], dataBase: ctx.obra.data_base ?? '2026-01-01', hoje: ctx.obra.data_base ?? '2026-01-01',
      feriados: new Set(), atividadeTrava: null, impedimentos: [],
    })
  } catch (e) {
    if (e instanceof CicloNasPredecessoras) return falha(e.message)
    throw e
  }

  const { data: gravadas, error: errUpd } = await ctx.supabase
    .from('obras_atividade')
    .update(campos)
    .eq('versao_id', versaoId)
    .eq('numero', linha.numero)
    .select('id')
  if (errUpd) return erroBanco('salvar a atividade', errUpd)
  if (!gravadas?.length) return falha('Não foi possível salvar a atividade. Recarregue a página.')

  revalidar(obraId)
  return { ok: true }
}

export async function salvarVersaoAction(
  obraId: string,
  versaoId: string,
  motivo: string | null,
): Promise<Resultado> {
  const ctx = await autorizar(obraId)
  if (ehErro(ctx)) return ctx
  const versao = await lerVersao(ctx, versaoId)
  if (ehErro(versao)) return versao
  if (versao.salva_em) return falha('Esta versão já foi salva')

  const m = (motivo ?? '').trim() || null
  if (versao.numero > 1 && !m) return falha('Informe o motivo da revisão')

  const campos: Linha = { salva_em: new Date().toISOString(), salva_por: ctx.email }
  if (m) campos.motivo = m
  // `.is('salva_em', null)`: se outra aba salvou antes, nada é gravado.
  const { data, error } = await ctx.supabase
    .from('obras_cronograma_versao')
    .update(campos)
    .eq('id', versaoId)
    .is('salva_em', null)
    .select('id')
  if (error) return erroBanco('salvar a versão', error)
  if (!data?.length) return falha('Esta versão já foi salva')

  revalidar(obraId)
  return { ok: true }
}

const COLUNAS_COPIADAS = [
  'numero', 'frente', 'etapa', 'descricao', 'saida_trava', 'pred1', 'pred2',
  'duracao', 'responsavel_funcao', 'bloqueia_por_trava', 'peso_valor',
] as const

export async function criarRevisaoAction(obraId: string): Promise<Resultado & { versaoId?: string }> {
  const ctx = await autorizar(obraId)
  if (ehErro(ctx)) return ctx

  const { data: versoes, error } = await ctx.supabase
    .from('obras_cronograma_versao')
    .select('id, numero, salva_em')
    .eq('obra_id', obraId)
    .order('numero')
  if (error) return erroBanco('ler as versões', error)
  const lista = ((versoes ?? []) as Linha[]).slice().sort((a, b) => a.numero - b.numero)
  const salvas = lista.filter((v) => v.salva_em)
  const vigente = salvas[salvas.length - 1]
  if (!vigente) return falha('Salve a base antes de criar uma revisão')

  // Versão não tem delete (RLS). Se uma cópia anterior falhou no meio e deixou
  // um rascunho vazio, ele é reaproveitado em vez de travar a obra.
  let destino: Linha | undefined = lista.find((v) => !v.salva_em)
  if (destino) {
    const { data: ja, error: e } = await ctx.supabase
      .from('obras_atividade')
      .select('id')
      .eq('versao_id', destino.id)
    if (e) return erroBanco('ler o rascunho', e)
    if (ja?.length) return falha(`Já existe uma revisão em rascunho (v${destino.numero}) — salve-a antes de criar outra`)
  }

  const { data: origem, error: errOrig } = await ctx.supabase
    .from('obras_atividade')
    .select('*')
    .eq('versao_id', vigente.id)
  if (errOrig) return erroBanco('ler a versão vigente', errOrig)

  if (!destino) {
    const { data: nova, error: errNova } = await ctx.supabase
      .from('obras_cronograma_versao')
      .insert({ obra_id: obraId, numero: vigente.numero + 1, criada_por: ctx.email })
      .select('id, numero')
      .single()
    if (errNova) return erroBanco('criar a revisão', errNova)
    destino = nova as Linha
  }

  const copias = ((origem ?? []) as Linha[]).map((a) => {
    const c: Linha = { versao_id: destino!.id, obra_id: obraId }
    for (const k of COLUNAS_COPIADAS) c[k] = a[k] ?? null
    return c
  })
  if (copias.length) {
    const { error: errCopia } = await ctx.supabase.from('obras_atividade').insert(copias)
    if (errCopia) return erroBanco('copiar as atividades para a revisão', errCopia)
  }

  revalidar(obraId)
  return { ok: true, versaoId: destino.id as string }
}

export async function atualizarExecucaoAction(
  obraId: string,
  numero: number,
  campos: CamposExecucao,
): Promise<Resultado> {
  const ctx = await autorizar(obraId)
  if (ehErro(ctx)) return ctx

  if (campos.status !== undefined && !STATUS.includes(campos.status)) return falha('Status inválido')
  if (campos.percentual !== undefined) {
    const p = campos.percentual
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
      return falha('Percentual deve estar entre 0% e 100%')
    }
  }
  for (const d of [campos.inicioReal, campos.fimReal]) {
    if (d !== undefined && d !== null && !dataISO(d)) return falha('Data inválida')
  }

  // Plano que vale para a execução: a vigente; sem base salva, o rascunho.
  const { data: versoes, error: errV } = await ctx.supabase
    .from('obras_cronograma_versao')
    .select('id, numero, salva_em')
    .eq('obra_id', obraId)
    .order('numero')
  if (errV) return erroBanco('ler as versões', errV)
  const lista = ((versoes ?? []) as Linha[]).slice().sort((a, b) => a.numero - b.numero)
  const salvas = lista.filter((v) => v.salva_em)
  const usada = salvas[salvas.length - 1] ?? lista.filter((v) => !v.salva_em).pop()
  if (!usada) return falha('Esta obra ainda não tem cronograma')

  const [atR, exR] = await Promise.all([
    ctx.supabase.from('obras_atividade').select('*').eq('versao_id', usada.id),
    ctx.supabase.from('obras_atividade_exec').select('*').eq('obra_id', obraId),
  ])
  if (atR.error) return erroBanco('ler o cronograma', atR.error)
  if (exR.error) return erroBanco('ler a execução', exR.error)
  const plano = planoDe((atR.data ?? []) as Linha[])
  if (!plano.some((a) => a.numero === numero)) return falha(`Atividade ${numero} não existe no cronograma`)

  const exec: AtividadeExec[] = ((exR.data ?? []) as Linha[]).map((e) => ({
    numero: e.numero,
    status: e.status,
    percentual: Number(e.percentual ?? 0),
    inicioReal: e.inicio_real ?? null,
    fimReal: e.fim_real ?? null,
  }))
  const atual = exec.find((e) => e.numero === numero) ?? {
    numero, status: 'nao_iniciado' as StatusAtividade, percentual: 0, inicioReal: null, fimReal: null,
  }
  const novo: AtividadeExec = {
    numero,
    status: campos.status ?? atual.status,
    percentual: campos.percentual ?? atual.percentual,
    inicioReal: campos.inicioReal !== undefined ? campos.inicioReal : atual.inicioReal,
    fimReal: campos.fimReal !== undefined ? campos.fimReal : atual.fimReal,
  }
  if (novo.status === 'concluido') {
    novo.percentual = 1
    if (!novo.fimReal) return falha('Informe o fim real para concluir a atividade')
  }
  if (novo.inicioReal && novo.fimReal && novo.fimReal < novo.inicioReal) {
    return falha('O fim real não pode ser antes do início real')
  }

  if (novo.status === 'em_andamento' || novo.status === 'concluido' || novo.percentual > 0) {
    const pode = podeIniciar(numero, plano, exec, ctx.obra.atividade_trava ?? null)
    if (!pode.ok) return falha(pode.motivo)
  }

  const { error } = await ctx.supabase.from('obras_atividade_exec').upsert(
    {
      obra_id: obraId,
      numero,
      status: novo.status,
      percentual: novo.percentual,
      inicio_real: novo.inicioReal,
      fim_real: novo.fimReal,
      atualizado_em: new Date().toISOString(),
      atualizado_por: ctx.email,
    },
    { onConflict: 'obra_id,numero' },
  )
  if (error) return erroBanco('atualizar a execução', error)

  revalidar(obraId)
  return { ok: true }
}
