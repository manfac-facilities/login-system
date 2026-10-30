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
import { atividadeExecDe, atividadePlanoDe, ordenarAtividades } from '../../_lib/leitura'
import { hojeISO } from '../../../_lib/tipos'
import type { Direcao, EdicaoLinha, LinhaStatus, NovaAtividade, Resultado, ResultadoNumero } from './_tipos'

const NAO_AUTENTICADO = 'Não autenticado'
const SEM_PERMISSAO = 'Só o engenheiro da obra ou um administrador altera o cronograma'
const VERSAO_SALVA = 'Versão salva não se altera — crie uma revisão'
const VERSAO_NAO_ENCONTRADA = 'Versão não encontrada'
const SEM_BASE = 'Sem cronograma — o status começa quando a base for salva'

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

/** Testa o plano no motor; ciclo vira mensagem. */
function cicloNoPlano(ctx: Contexto, linhas: Linha[]): Erro | null {
  try {
    calcularCronograma({
      plano: planoDe(linhas), exec: [], dataBase: ctx.obra.data_base ?? '2026-01-01', hoje: ctx.obra.data_base ?? '2026-01-01',
      feriados: new Set(), atividadeTrava: null, impedimentos: [],
    })
    return null
  } catch (e) {
    if (e instanceof CicloNasPredecessoras) return falha(e.message)
    throw e
  }
}

/** Predecessoras: inteiros existentes na versão, nunca a própria atividade. */
function erroPredecessoras(linhas: Linha[], numero: number | null, preds: (number | null | undefined)[]): Erro | null {
  for (const p of preds) {
    if (p === null || p === undefined) continue
    if (!inteiroPositivo(p)) return falha('Predecessora inválida')
    if (p === numero) return falha('Uma atividade não pode ser predecessora dela mesma')
    if (!linhas.some((a) => a.numero === p)) return falha(`Predecessora ${p} não existe neste cronograma`)
  }
  return null
}

const nomeEtapa = (a: Linha) => ((a.etapa as string | null) ?? '').trim()
const maior = (xs: unknown[]) => xs.reduce<number>((m, x) => (typeof x === 'number' && x > m ? x : m), 0)

/** Etapas da versão na ordem de exibição. */
const etapasDe = (linhas: Linha[]) => [...new Set(ordenarAtividades(linhas).map(nomeEtapa))]

/** `etapa_ordem`/`ordem` para pôr uma atividade no fim da etapa `etapa` (existente ou nova). */
function posicaoNoFim(linhas: Linha[], etapa: string): { etapa_ordem: number; ordem: number } {
  const ordenadas = ordenarAtividades(linhas)
  const ordem = maior(ordenadas.map((a) => a.ordem ?? a.numero)) + 1
  const idx = etapasDe(linhas).indexOf(etapa)
  // Etapa existente: a posição dela (1-based na exibição) já vale como etapa_ordem se todas forem
  // numeradas; usa a etapa_ordem gravada do grupo e, sem nenhuma, a posição.
  if (idx >= 0) {
    const doGrupo = ordenadas.filter((a) => nomeEtapa(a) === etapa).map((a) => a.etapa_ordem)
    const eo = doGrupo.find((x) => typeof x === 'number') as number | undefined
    return { etapa_ordem: eo ?? idx + 1, ordem }
  }
  return { etapa_ordem: Math.max(maior(linhas.map((a) => a.etapa_ordem)), etapasDe(linhas).length) + 1, ordem }
}

const mesmaEtapa = (a: string, b: string) => a.toLocaleLowerCase('pt-BR') === b.toLocaleLowerCase('pt-BR')

/**
 * Edita uma linha do rascunho. Só os campos presentes em `linha` são gravados
 * (a tabela salva célula a célula; duas edições seguidas não se sobrescrevem).
 * Trocar a etapa leva a atividade para o fim da etapa de destino.
 */
export async function salvarLinhaRascunhoAction(
  obraId: string,
  versaoId: string,
  linha: EdicaoLinha,
): Promise<Resultado> {
  const r = await lerRascunho(obraId, versaoId, linha.numero)
  if (ehErro(r)) return r
  const { ctx, linhas } = r
  const atual = linhas.find((a) => a.numero === linha.numero)!

  const campos: Linha = {}
  if (linha.duracao !== undefined) {
    if (!inteiroPositivo(linha.duracao)) return falha('Duração deve ser um número inteiro de dias úteis, a partir de 1')
    campos.duracao = linha.duracao
  }
  if (linha.descricao !== undefined) {
    const descricao = (linha.descricao ?? '').trim()
    if (!descricao) return falha('Informe a descrição da atividade')
    campos.descricao = descricao
  }
  if (linha.pred1 !== undefined) campos.pred1 = linha.pred1
  if (linha.pred2 !== undefined) campos.pred2 = linha.pred2
  const erroP = erroPredecessoras(linhas, linha.numero, [linha.pred1, linha.pred2])
  if (erroP) return erroP
  if (linha.bloqueiaPorTrava !== undefined) campos.bloqueia_por_trava = !!linha.bloqueiaPorTrava
  if (linha.etapa !== undefined) {
    const etapa = (linha.etapa ?? '').trim()
    campos.etapa = etapa || null
    if (etapa !== nomeEtapa(atual)) {
      Object.assign(campos, posicaoNoFim(linhas.filter((a) => a.numero !== linha.numero), etapa))
    }
  }
  if (!Object.keys(campos).length) return { ok: true }

  const ciclo = cicloNoPlano(ctx, linhas.map((a) => (a.numero === linha.numero ? { ...a, ...campos } : a)))
  if (ciclo) return ciclo
  return gravarAtividade(ctx, obraId, versaoId, linha.numero, campos)
}

/** Rascunho da versão + suas atividades; recusa versão salva. */
async function lerVersaoRascunho(obraId: string, versaoId: string): Promise<{ ctx: Contexto; linhas: Linha[] } | Erro> {
  const ctx = await autorizar(obraId)
  if (ehErro(ctx)) return ctx
  const versao = await lerVersao(ctx, versaoId)
  if (ehErro(versao)) return versao
  if (versao.salva_em) return falha(VERSAO_SALVA)
  const { data, error } = await ctx.supabase.from('obras_atividade').select('*').eq('versao_id', versaoId)
  if (error) return erroBanco('ler o cronograma', error)
  return { ctx, linhas: (data ?? []) as Linha[] }
}

/**
 * Próximo `numero` da obra: maior de TODAS as versões e da execução + 1.
 * `numero` é a identidade ligada ao exec/histórico — nunca é reaproveitado.
 */
async function proximoNumero(ctx: Contexto, obraId: string): Promise<number | Erro> {
  const [at, ex] = await Promise.all([
    ctx.supabase.from('obras_atividade').select('numero').eq('obra_id', obraId),
    ctx.supabase.from('obras_atividade_exec').select('numero').eq('obra_id', obraId),
  ])
  if (at.error) return erroBanco('ler o cronograma', at.error)
  if (ex.error) return erroBanco('ler a execução', ex.error)
  return maior([...((at.data ?? []) as Linha[]), ...((ex.data ?? []) as Linha[])].map((a) => a.numero)) + 1
}

/** Insere a atividade e a execução 'nao_iniciado' dela (numero novo: o exec não existe). */
async function inserirAtividade(ctx: Contexto, obraId: string, versaoId: string, nova: Linha): Promise<ResultadoNumero> {
  const numero = await proximoNumero(ctx, obraId)
  if (ehErro(numero)) return numero
  const { error } = await ctx.supabase
    .from('obras_atividade')
    .insert({
      versao_id: versaoId, obra_id: obraId, numero, frente: null, saida_trava: null, responsavel_funcao: null,
      bloqueia_por_trava: false, peso_valor: 0, inicio_fixo: null, pred1: null, pred2: null, ...nova,
    })
  if (error) return erroBanco('criar a atividade', error)
  const { error: errE } = await ctx.supabase
    .from('obras_atividade_exec')
    .insert({ obra_id: obraId, numero, status: 'nao_iniciado', percentual: 0 })
  // Sem a linha de exec o motor trata como não iniciada; a atividade já está gravada.
  if (errE) return erroBanco('criar a execução da atividade', errE)
  revalidar(obraId)
  return { ok: true, numero }
}

/** Etapa nova no fim; nasce com a 1ª atividade "Nova atividade" (etapa só existe pelas atividades). */
export async function adicionarEtapaAction(obraId: string, versaoId: string, nome: string): Promise<ResultadoNumero> {
  const r = await lerVersaoRascunho(obraId, versaoId)
  if (ehErro(r)) return r
  const etapa = (nome ?? '').trim()
  if (!etapa) return falha('Informe o nome da etapa')
  if (etapasDe(r.linhas).some((e) => mesmaEtapa(e, etapa))) return falha(`Já existe a etapa “${etapa}” neste cronograma`)
  return inserirAtividade(r.ctx, obraId, versaoId, {
    etapa, descricao: 'Nova atividade', duracao: 1, ...posicaoNoFim(r.linhas, etapa),
  })
}

/** Filtra pela etapa (vazia = null no banco). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const daEtapa = (q: any, etapa: string) => (etapa ? q.eq('etapa', etapa) : q.is('etapa', null))

export async function renomearEtapaAction(
  obraId: string,
  versaoId: string,
  nomeAtual: string,
  nomeNovo: string,
): Promise<Resultado> {
  const r = await lerVersaoRascunho(obraId, versaoId)
  if (ehErro(r)) return r
  const atual = (nomeAtual ?? '').trim()
  const novo = (nomeNovo ?? '').trim()
  if (!novo) return falha('Informe o nome da etapa')
  if (novo === atual) return { ok: true }
  const etapas = etapasDe(r.linhas)
  if (!etapas.includes(atual)) return falha('Etapa não encontrada. Recarregue a página.')
  if (etapas.some((e) => e !== atual && mesmaEtapa(e, novo))) return falha(`Já existe a etapa “${novo}” neste cronograma`)

  const { data, error } = await daEtapa(
    r.ctx.supabase.from('obras_atividade').update({ etapa: novo }).eq('versao_id', versaoId),
    atual,
  ).select('id')
  if (error) return erroBanco('renomear a etapa', error)
  if (!data?.length) return falha('Não foi possível renomear a etapa. Recarregue a página.')
  revalidar(obraId)
  return { ok: true }
}

/** Grava várias atualizações de ordem (por `numero`); só as que mudam. */
async function gravarOrdens(ctx: Contexto, versaoId: string, mudancas: { numero: number; campos: Linha }[]) {
  const rs = await Promise.all(
    mudancas.map((m) =>
      ctx.supabase.from('obras_atividade').update(m.campos).eq('versao_id', versaoId).eq('numero', m.numero).select('id'),
    ),
  )
  const e = rs.find((x) => x.error)
  return e ? erroBanco('mudar a ordem', e.error!) : null
}

export async function moverEtapaAction(
  obraId: string,
  versaoId: string,
  nome: string,
  direcao: Direcao,
): Promise<Resultado> {
  const r = await lerVersaoRascunho(obraId, versaoId)
  if (ehErro(r)) return r
  const etapas = etapasDe(r.linhas)
  const i = etapas.indexOf((nome ?? '').trim())
  if (i < 0) return falha('Etapa não encontrada. Recarregue a página.')
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (j < 0 || j >= etapas.length) return { ok: true }
  ;[etapas[i], etapas[j]] = [etapas[j], etapas[i]]

  // etapa_ordem = posição (1..N) de cada etapa; grava só as atividades cuja posição mudou.
  const pos = new Map(etapas.map((e, k) => [e, k + 1]))
  const mudancas = r.linhas
    .filter((a) => a.etapa_ordem !== pos.get(nomeEtapa(a)))
    .map((a) => ({ numero: a.numero as number, campos: { etapa_ordem: pos.get(nomeEtapa(a))! } }))
  const erro = await gravarOrdens(r.ctx, versaoId, mudancas)
  if (erro) return erro
  revalidar(obraId)
  return { ok: true }
}

/** ↑/↓ dentro da etapa (para outra etapa: troca o campo Etapa da linha). */
export async function moverAtividadeAction(
  obraId: string,
  versaoId: string,
  numero: number,
  direcao: Direcao,
): Promise<Resultado> {
  const r = await lerRascunho(obraId, versaoId, numero)
  if (ehErro(r)) return r
  const etapa = nomeEtapa(r.linhas.find((a) => a.numero === numero)!)
  const grupo = ordenarAtividades(r.linhas).filter((a) => nomeEtapa(a) === etapa)
  const i = grupo.findIndex((a) => a.numero === numero)
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (j < 0 || j >= grupo.length) return { ok: true }

  const efetiva = (a: Linha) => (typeof a.ordem === 'number' ? a.ordem : (a.numero as number))
  const valores = grupo.map(efetiva).sort((x, y) => x - y)
  const distintos = new Set(valores).size === valores.length
  const nova = grupo.slice()
  ;[nova[i], nova[j]] = [nova[j], nova[i]]
  // Reaproveita os valores de ordem do grupo (só as duas trocam); com repetidos, renumera a etapa.
  const mudancas = nova
    .map((a, k) => ({ a, ordem: distintos ? valores[k] : valores[0] + k }))
    .filter(({ a, ordem }) => a.ordem !== ordem)
    .map(({ a, ordem }) => ({ numero: a.numero as number, campos: { ordem } }))
  const erro = await gravarOrdens(r.ctx, versaoId, mudancas)
  if (erro) return erro
  revalidar(obraId)
  return { ok: true }
}

export async function adicionarAtividadeAction(
  obraId: string,
  versaoId: string,
  etapa: string,
  dados: NovaAtividade,
): Promise<ResultadoNumero> {
  const r = await lerVersaoRascunho(obraId, versaoId)
  if (ehErro(r)) return r
  const descricao = (dados.descricao ?? '').trim()
  if (!descricao) return falha('Informe a descrição da atividade')
  if (!inteiroPositivo(dados.duracao)) return falha('Duração deve ser um número inteiro de dias úteis, a partir de 1')
  const erroP = erroPredecessoras(r.linhas, null, [dados.pred1, dados.pred2])
  if (erroP) return erroP
  const inicioFixo = dados.inicioFixo ?? null
  if (inicioFixo !== null && !dataISO(inicioFixo)) return falha('Data inválida')
  const nome = (etapa ?? '').trim()
  return inserirAtividade(r.ctx, obraId, versaoId, {
    etapa: nome || null, descricao, duracao: dados.duracao, pred1: dados.pred1, pred2: dados.pred2,
    inicio_fixo: inicioFixo, ...posicaoNoFim(r.linhas, nome),
  })
}

/**
 * Exclui a atividade do rascunho. Recusa se alguma atividade da versão a tem
 * como predecessora, se é a atividade-trava ou se a execução já andou. A linha
 * de execução (sem avanço) fica: não há delete nela, e o `numero` não é reaproveitado.
 */
export async function excluirAtividadeAction(obraId: string, versaoId: string, numero: number): Promise<Resultado> {
  const r = await lerRascunho(obraId, versaoId, numero)
  if (ehErro(r)) return r
  const { ctx, linhas } = r
  const sucessora = ordenarAtividades(linhas).find((a) => a.numero !== numero && (a.pred1 === numero || a.pred2 === numero))
  if (sucessora) {
    return falha(`A atividade ${sucessora.numero} (${sucessora.descricao}) depende dela — tire a predecessora antes de excluir`)
  }
  if (ctx.obra.atividade_trava === numero) {
    return falha(`A atividade ${numero} é a atividade-trava da obra — não pode ser excluída`)
  }
  const { data: ex, error: errE } = await ctx.supabase
    .from('obras_atividade_exec')
    .select('status, percentual')
    .eq('obra_id', obraId)
    .eq('numero', numero)
  if (errE) return erroBanco('ler a execução', errE)
  if (((ex ?? []) as Linha[]).some((e) => Number(e.percentual ?? 0) > 0 || e.status !== 'nao_iniciado')) {
    return falha(`A atividade ${numero} já tem avanço registrado — não pode ser excluída`)
  }

  const { data, error } = await ctx.supabase
    .from('obras_atividade')
    .delete()
    .eq('versao_id', versaoId)
    .eq('numero', numero)
    .select('id')
  if (error) return erroBanco('excluir a atividade', error)
  if (!data?.length) return falha('Não foi possível excluir a atividade. Recarregue a página.')
  revalidar(obraId)
  return { ok: true }
}

/** Item 15: OBRA sem cronograma → cria a v1 em rascunho, vazia (depois: + Etapa, + Atividade). */
export async function criarCronogramaAction(obraId: string): Promise<Resultado> {
  const ctx = await autorizar(obraId)
  if (ehErro(ctx)) return ctx
  const { data: versoes, error } = await ctx.supabase
    .from('obras_cronograma_versao')
    .select('id')
    .eq('obra_id', obraId)
  if (error) return erroBanco('ler as versões', error)
  if (versoes?.length) return falha('Esta OBRA já tem cronograma')
  const { error: errI } = await ctx.supabase
    .from('obras_cronograma_versao')
    .insert({ obra_id: obraId, numero: 1, criada_por: ctx.email })
    .select('id')
  if (errI) return erroBanco('criar o cronograma', errI)
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
  'duracao', 'responsavel_funcao', 'bloqueia_por_trava', 'peso_valor', 'inicio_fixo', 'ordem', 'etapa_ordem',
] as const

export async function criarRevisaoAction(
  obraId: string,
): Promise<Resultado & { versaoId?: string; numero?: number }> {
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
  // A tela navega para `?v=<numero>`: sem isso ela seguia na versão do `?v=` anterior (salva, só leitura).
  return { ok: true, versaoId: destino.id as string, numero: destino.numero as number }
}

/** Plano que vale para a execução (a vigente; sem base salva, recusa) + execução atual. */
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
  // Como o diário: status só contra uma base salva (o rascunho da v1 ainda vai mudar).
  const usada = salvas[salvas.length - 1]
  if (!usada) return falha(SEM_BASE)

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

/**
 * Atualizar status em lote (spec Leva 1 §5 A5). Mesmas regras do diário:
 * % nunca regride (max com o atual), concluída fica concluída, trava respeitada
 * (a trava concluída neste lote libera as dependentes). `inicio_real` = data de
 * status quando sai de 0% sem data; `fim_real` = data de status ao concluir
 * (e `dias_restantes` volta a null). Data de status futura é recusada.
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
  if (dataStatus > hojeISO()) return falha('A data de status não pode ser futura')
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
    const diasRestantes = l.concluir ? null : l.diasRestantes

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

  // Histórico antes do exec: se o histórico falhar, o exec não muda e o retry grava os dois.
  // Uma duplicata no retry (mesma data e %) não altera a curva.
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
  const { error } = await ctx.supabase.from('obras_atividade_exec').upsert(gravar, { onConflict: 'obra_id,numero' })
  if (error) return erroBanco('atualizar o status', error)

  revalidar(obraId)
  return { ok: true, aplicadas: gravar.length }
}
