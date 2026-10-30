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
  duracaoPorFim,
  podeIniciar,
  type AtividadeExec,
  type AtividadePlano,
  type StatusAtividade,
} from '../../_lib/cronograma'
import { atividadeExecDe, atividadePlanoDe } from '../../_lib/leitura'
import type { CamposExecucao, LinhaPlano, LinhaStatus, Resultado } from './_tipos'

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

const planoDe = (linhas: Linha[]): AtividadePlano[] => linhas.map(atividadePlanoDe)

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

/** Rascunho da versão + suas atividades; recusa versão salva e atividade inexistente. */
async function lerRascunho(
  obraId: string,
  versaoId: string,
  numero: number,
): Promise<{ ctx: Contexto; linhas: Linha[] } | Erro> {
  const ctx = await autorizar(obraId)
  if (ehErro(ctx)) return ctx
  const versao = await lerVersao(ctx, versaoId)
  if (ehErro(versao)) return versao
  if (versao.salva_em) return falha(VERSAO_SALVA)
  const { data, error } = await ctx.supabase.from('obras_atividade').select('*').eq('versao_id', versaoId)
  if (error) return erroBanco('ler o cronograma', error)
  const linhas = (data ?? []) as Linha[]
  if (!linhas.some((a) => a.numero === numero)) return falha(`Atividade ${numero} não existe neste cronograma`)
  return { ctx, linhas }
}

async function gravarAtividade(ctx: Contexto, obraId: string, versaoId: string, numero: number, campos: Linha) {
  const { data, error } = await ctx.supabase
    .from('obras_atividade')
    .update(campos)
    .eq('versao_id', versaoId)
    .eq('numero', numero)
    .select('id')
  if (error) return erroBanco('salvar a atividade', error)
  if (!data?.length) return falha('Não foi possível salvar a atividade. Recarregue a página.')
  revalidar(obraId)
  return { ok: true as const }
}

/**
 * Início digitado na árvore → `inicio_fixo` da atividade nesta versão (spec §5).
 * `null` = "Seguir predecessoras". Data em folga é aceita: o motor leva ao
 * próximo dia útil e a árvore avisa.
 */
export async function definirInicioAction(
  obraId: string,
  versaoId: string,
  numero: number,
  inicio: string | null,
): Promise<Resultado> {
  if (inicio !== null && !dataISO(inicio)) return falha('Data inválida')
  const r = await lerRascunho(obraId, versaoId, numero)
  if (ehErro(r)) return r
  return gravarAtividade(r.ctx, obraId, versaoId, numero, { inicio_fixo: inicio })
}

/**
 * Fim digitado na árvore → grava só a `duracao` (dias úteis do início calculado
 * até o fim, mín. 1). O início calculado já é o `inicio_fixo` (no próximo dia
 * útil) quando há um, ou o que as predecessoras dão (spec §8.1 item 4).
 */
export async function definirFimAction(
  obraId: string,
  versaoId: string,
  numero: number,
  fim: string,
): Promise<Resultado> {
  if (!dataISO(fim)) return falha('Data inválida')
  const r = await lerRascunho(obraId, versaoId, numero)
  if (ehErro(r)) return r
  const { ctx, linhas } = r

  const { data: fer, error: errF } = await ctx.supabase.from('obras_feriado').select('data')
  if (errF) return erroBanco('ler os feriados', errF)
  const feriados = new Set(((fer ?? []) as Linha[]).map((f) => f.data as string))

  const dataBase = ctx.obra.data_base ?? fim
  let duracao: number
  try {
    const calc = calcularCronograma({
      plano: planoDe(linhas), exec: [], dataBase, hoje: dataBase, feriados, atividadeTrava: null, impedimentos: [],
    })
    const inicio = calc.atividades.find((a) => a.numero === numero)!.inicioPrevisto
    duracao = duracaoPorFim(inicio, fim, feriados)
  } catch (e) {
    if (e instanceof CicloNasPredecessoras) return falha(e.message)
    if (e instanceof Error && e.message.startsWith('Fim antes do início')) return falha(e.message)
    throw e
  }
  return gravarAtividade(ctx, obraId, versaoId, numero, { duracao })
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
  // Sem data-base a leitura usa "hoje" e a base desliza todo dia; depois de salva, não dá para corrigir.
  if (versao.numero === 1 && !ctx.obra.data_base) {
    return falha('Defina a data-base na aba Comunicação antes de salvar a base')
  }

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
  'duracao', 'responsavel_funcao', 'bloqueia_por_trava', 'peso_valor', 'inicio_fixo',
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

/** Plano que vale para a execução (a vigente; sem base salva, o rascunho) + execução atual. */
async function lerPlanoEExec(
  ctx: Contexto,
  obraId: string,
): Promise<{ plano: AtividadePlano[]; exec: AtividadeExec[] } | Erro> {
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
  return {
    plano: planoDe((atR.data ?? []) as Linha[]),
    exec: ((exR.data ?? []) as Linha[]).map(atividadeExecDe),
  }
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

  const lidos = await lerPlanoEExec(ctx, obraId)
  if (ehErro(lidos)) return lidos
  const { plano, exec } = lidos
  if (!plano.some((a) => a.numero === numero)) return falha(`Atividade ${numero} não existe no cronograma`)

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

/**
 * Atualizar status em lote (spec Leva 1 §5 A5). Mesmas regras do diário:
 * % nunca regride (max com o atual), concluída fica concluída, trava respeitada
 * (a trava concluída neste lote libera as dependentes). `inicio_real` = data de
 * status quando sai de 0% sem data; `fim_real` = data de status ao concluir.
 * Grava `dias_restantes` e uma linha em `obras_atividade_status_hist`
 * (origem 'status') por atividade que de fato mudou.
 */
export async function atualizarStatusAction(
  obraId: string,
  dataStatus: string,
  linhas: LinhaStatus[],
): Promise<Resultado & { aplicadas?: number }> {
  const ctx = await autorizar(obraId)
  if (ehErro(ctx)) return ctx
  if (!dataISO(dataStatus)) return falha('Data de status inválida')
  if (!Array.isArray(linhas)) return falha('Nada para atualizar')

  for (const l of linhas) {
    if (!inteiroPositivo(l.numero)) return falha('Atividade inválida')
    const p = l.percentual
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
      return falha(`Atividade ${l.numero}: percentual deve estar entre 0% e 100%`)
    }
    const d = l.diasRestantes
    if (d !== null && (typeof d !== 'number' || !Number.isFinite(d) || d < 0 || d > 99999)) {
      return falha(`Atividade ${l.numero}: dias restantes deve ser um número a partir de 0`)
    }
    for (const x of [l.inicioReal, l.fimReal]) {
      if (x !== undefined && x !== null && !dataISO(x)) return falha(`Atividade ${l.numero}: data inválida`)
    }
  }

  const lidos = await lerPlanoEExec(ctx, obraId)
  if (ehErro(lidos)) return lidos
  const { plano, exec } = lidos
  const trava = (ctx.obra.atividade_trava ?? null) as number | null

  const execDe = (n: number): AtividadeExec =>
    exec.find((e) => e.numero === n) ?? { numero: n, status: 'nao_iniciado', percentual: 0, inicioReal: null, fimReal: null }
  // A trava concluída neste mesmo lote libera as que dependem dela.
  const concluidasAgora = new Set(linhas.filter((l) => l.concluir).map((l) => l.numero))
  const execParaTrava = exec.map((e) => (concluidasAgora.has(e.numero) ? { ...e, status: 'concluido' as const } : e))
  if (trava !== null && concluidasAgora.has(trava) && !exec.some((e) => e.numero === trava)) {
    execParaTrava.push({ numero: trava, status: 'concluido', percentual: 1, inicioReal: null, fimReal: null })
  }

  const agora = new Date().toISOString()
  const gravar: Linha[] = []
  for (const l of linhas) {
    if (!plano.some((a) => a.numero === l.numero)) return falha(`Atividade ${l.numero} não existe no cronograma`)
    const atual = execDe(l.numero)
    if (atual.status === 'concluido') continue

    const percentual = l.concluir ? 1 : Math.max(atual.percentual, l.percentual)
    let status: StatusAtividade = atual.status
    if (l.concluir) status = 'concluido'
    else if (percentual > 0 && atual.status === 'nao_iniciado') status = 'em_andamento'
    let inicioReal = l.inicioReal !== undefined ? l.inicioReal : atual.inicioReal
    if (!inicioReal && percentual > 0) inicioReal = dataStatus
    const fimReal = l.concluir ? (l.fimReal || dataStatus) : atual.fimReal
    const diasRestantes = l.concluir ? 0 : l.diasRestantes

    const mudou =
      status !== atual.status ||
      percentual !== atual.percentual ||
      inicioReal !== atual.inicioReal ||
      fimReal !== atual.fimReal ||
      diasRestantes !== (atual.diasRestantes ?? null)
    if (!mudou) continue

    if (inicioReal && fimReal && fimReal < inicioReal) {
      return falha(`Atividade ${l.numero}: o fim real não pode ser antes do início real`)
    }
    if (percentual > 0 || status === 'em_andamento' || status === 'concluido') {
      const pode = podeIniciar(l.numero, plano, execParaTrava, trava)
      if (!pode.ok) return falha(`Atividade ${l.numero}: ${pode.motivo.charAt(0).toLowerCase()}${pode.motivo.slice(1)}`)
    }
    gravar.push({
      obra_id: obraId,
      numero: l.numero,
      status,
      percentual,
      inicio_real: inicioReal,
      fim_real: fimReal,
      dias_restantes: diasRestantes,
      atualizado_em: agora,
      atualizado_por: ctx.email,
    })
  }
  if (!gravar.length) return { ok: true, aplicadas: 0 }

  const { error } = await ctx.supabase.from('obras_atividade_exec').upsert(gravar, { onConflict: 'obra_id,numero' })
  if (error) return erroBanco('atualizar o status', error)
  // registrado_por: o trigger carimba com o e-mail da sessão.
  const { error: errH } = await ctx.supabase.from('obras_atividade_status_hist').insert(
    gravar.map((g) => ({
      obra_id: obraId,
      numero: g.numero,
      data_status: dataStatus,
      percentual: g.percentual,
      dias_restantes: g.dias_restantes,
      status: g.status,
      origem: 'status',
    })),
  )
  if (errH) return erroBanco('gravar o histórico do status', errH)

  revalidar(obraId)
  return { ok: true, aplicadas: gravar.length }
}
