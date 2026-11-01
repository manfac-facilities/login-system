'use server'

/**
 * Server Actions da planta de faseamento (Leva 6b §2, §3).
 *
 * Quem escreve fase, revisão e envio: o engenheiro da obra, o coordenador
 * (`coordenador_email`) ou administrador (`podeFasear`), conferido aqui antes
 * de tocar no banco. Sempre o cliente da SESSÃO, para valerem a RLS e os
 * triggers (OBRAS_FASEAMENTO: permissão, emitida imutável, um rascunho por
 * fase, revisão = max+1, congelamento da base/fase/trava na emissão; OBRAS_ENVIO:
 * só revisão emitida da mesma obra). O erro do banco vira mensagem em pt-BR.
 * Camadas, regras e carimbo passam pelos schemas da Task 2 antes de gravar.
 *
 * Sem `export type` aqui — tipos em `_tipos.ts`.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hojeISO } from '../../../_lib/tipos'
import { enviarEmail } from '../../_lib/enviar'
import { linkPortalObra } from '../../_lib/link-portal'
import { montarEmailFaseamento } from '../comunicacao/_email'
import { camadasSchema, carimboSchema, regrasSchema } from './_lib/camadas'
import { dataBR } from './_lib/trava'
import { podeFasear } from './_permissao'
import { carregarPrancha, renderizarPrancha, UUID } from './_pdf'
import { MAX_NOME_FASE, carimboPadrao } from './_regras'
import type { EntradaRevisao, Resultado } from './_tipos'

const SEM_PERMISSAO = 'Só o engenheiro da obra, o coordenador ou um administrador mexe na planta de faseamento'
const EMITIDA = 'Revisão emitida não muda. Use "Nova revisão" para alterar.'
const MAX_DESTINATARIOS = 40
/** Mesmos destinatários do relatório de fase (spec §2.3): tipos semanal ou mensal. */
const TIPOS_DESTINATARIO_FASE = ['semanal', 'mensal']

type Erro = { ok: false; erro: string }
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Lado = 'cliente' | 'interno'
type Contexto = { supabase: SupabaseClient; email: string; obra: Linha }

const falha = (erro: string): Erro => ({ ok: false, erro })
const maiuscula = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t)

/** Erro do banco → pt-BR. */
function erroFaseamento(acao: string, e: { message: string; code?: string; details?: string }): Erro {
  const m = `${e.message} ${e.details ?? ''}`
  for (const prefixo of ['OBRAS_FASEAMENTO_VINCULO:', 'OBRAS_FASEAMENTO:', 'OBRAS_ENVIO:']) {
    if (e.message.includes(prefixo)) {
      const t = e.message.split(prefixo)[1]?.trim() ?? ''
      if (/só o engenheiro/i.test(t)) return falha(SEM_PERMISSAO)
      if (/imutável/i.test(t)) return falha(EMITIDA)
      return falha(maiuscula(t) || `Não foi possível ${acao}.`)
    }
  }
  if (e.code === '42501' || m.includes('row-level security')) return falha(SEM_PERMISSAO)
  if (e.code === '23505') return falha('Esta fase já tem uma revisão em rascunho. Recarregue a página.')
  if (e.code === '23514') {
    if (m.includes('camadas')) return falha('Camadas inválidas: até 300, todas dentro da planta.')
    if (m.includes('regras')) return falha('Regras: até 12, cada uma com 1 a 200 caracteres.')
    if (m.includes('carimbo')) return falha('Carimbo inválido (até 300 caracteres por campo).')
    if (m.includes('nome')) return falha(`Dê um nome à fase (até ${MAX_NOME_FASE} caracteres).`)
    return falha('Dados inválidos.')
  }
  return falha(`Não foi possível ${acao}. Tente de novo em instantes.`)
}

/** Sessão + obra da modalidade OBRA + engenheiro/coordenador/admin. Falha fechada. */
async function autorizar(obraId: string): Promise<Contexto | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha('Não autenticado')
  if (typeof obraId !== 'string' || !UUID.test(obraId)) return falha('Obra não encontrada')
  const { data: obra, error } = await supabase
    .from('obras_obra')
    .select('id, os, loja, descricao, cliente, modalidade, engenheiro_email, coordenador_email, atividade_trava')
    .eq('id', obraId)
    .maybeSingle()
  if (error) return erroFaseamento('ler a obra', error)
  if (!obra || (obra as Linha).modalidade !== 'obra') return falha('Obra não encontrada')
  if (!(await podeFasear(supabase, email, obra as Linha))) return falha(SEM_PERMISSAO)
  return { supabase, email, obra: obra as Linha }
}

/** Autoriza pela obra dona da linha (fase ou revisão). */
async function autorizarPor(tabela: 'obras_fase' | 'obras_fase_revisao', id: string): Promise<(Contexto & { linha: Linha }) | Erro> {
  if (typeof id !== 'string' || !UUID.test(id)) return falha(tabela === 'obras_fase' ? 'Fase não encontrada' : 'Revisão não encontrada')
  const supabase = await createClient()
  const { data, error } = await supabase.from(tabela).select('*').eq('id', id).maybeSingle()
  if (error) return erroFaseamento('ler o faseamento', error)
  if (!data) return falha(tabela === 'obras_fase' ? 'Fase não encontrada' : 'Revisão não encontrada')
  const ctx = await autorizar((data as Linha).obra_id as string)
  if ('ok' in ctx) return ctx
  return { ...ctx, linha: data as Linha }
}

function revalidar(obraId: string) {
  revalidatePath(`/obras/obras/${obraId}/faseamento`)
}

// ---------------------------------------------------------------------------
// Fase
// ---------------------------------------------------------------------------

/** Cria a fase (número atribuído pelo banco) e a R0 em rascunho, com o carimbo padrão. */
export async function criarFaseAction(obraId: string, nome: string): Promise<Resultado & { faseId?: string }> {
  const ctx = await autorizar(obraId)
  if ('ok' in ctx) return ctx
  const n = (typeof nome === 'string' ? nome : '').replace(/\s+/g, ' ').trim()
  if (!n) return falha('Dê um nome à fase')
  if (n.length > MAX_NOME_FASE) return falha(`Nome da fase com até ${MAX_NOME_FASE} caracteres`)

  const { data: atuais, error: eO } = await ctx.supabase.from('obras_fase').select('ordem').eq('obra_id', obraId)
  if (eO) return erroFaseamento('ler as fases', eO)
  const ordem = ((atuais ?? []) as Linha[]).reduce((m, x) => Math.max(m, Number(x.ordem ?? 0)), 0) + 1

  const { data: fase, error } = await ctx.supabase.from('obras_fase').insert({ obra_id: obraId, nome: n, ordem }).select('id, numero').single()
  if (error || !fase) return erroFaseamento('criar a fase', error ?? { message: 'sem retorno' })
  const f = fase as Linha
  const { error: eR } = await ctx.supabase.from('obras_fase_revisao').insert({
    fase_id: f.id,
    obra_id: obraId,
    camadas: [],
    regras: [],
    carimbo: carimboPadrao({ numero: Number(f.numero), cliente: ctx.obra.cliente }),
    usa_trava: false,
  })
  if (eR) return erroFaseamento('criar a revisão R0', eR)
  revalidar(obraId)
  return { ok: true, faseId: String(f.id) }
}

// ---------------------------------------------------------------------------
// Revisão
// ---------------------------------------------------------------------------

/** Grava camadas, regras, carimbo e a opção da trava no rascunho (validados antes). */
export async function salvarRascunhoAction(revisaoId: string, entrada: EntradaRevisao): Promise<Resultado> {
  const x = (entrada ?? {}) as Partial<EntradaRevisao>
  const camadas = camadasSchema.safeParse(x.camadas)
  if (!camadas.success) return falha(`Camadas inválidas: ${camadas.error.message}`)
  const regras = regrasSchema.safeParse(x.regras)
  if (!regras.success) return falha(`Regras inválidas: ${regras.error.message}`)
  const carimbo = carimboSchema.safeParse(x.carimbo)
  if (!carimbo.success) return falha(`Carimbo inválido: ${carimbo.error.message}`)
  if (typeof x.usaTrava !== 'boolean') return falha('Opção da trava inválida')

  const ctx = await autorizarPor('obras_fase_revisao', revisaoId)
  if ('ok' in ctx) return ctx
  if (ctx.linha.status !== 'rascunho') return falha(EMITIDA)
  if (x.usaTrava && ctx.obra.atividade_trava == null) {
    return falha('A obra não tem atividade-trava definida: desligue a trava ou peça ao administrador para defini-la em Dados da obra')
  }
  const { data, error } = await ctx.supabase
    .from('obras_fase_revisao')
    .update({ camadas: camadas.data, regras: regras.data, carimbo: carimbo.data, usa_trava: x.usaTrava })
    .eq('id', revisaoId)
    .eq('status', 'rascunho')
    .select('id')
  if (error) return erroFaseamento('salvar o rascunho', error)
  if (!data?.length) return falha(EMITIDA)
  revalidar(String(ctx.obra.id))
  return { ok: true }
}

/** Emite a revisão (rpc): o banco congela camadas, regras, carimbo, base, fase e o retrato da trava. */
export async function emitirRevisaoAction(revisaoId: string): Promise<Resultado> {
  const ctx = await autorizarPor('obras_fase_revisao', revisaoId)
  if ('ok' in ctx) return ctx
  if (ctx.linha.status !== 'rascunho') return falha('Esta revisão já foi emitida')
  const { error } = await ctx.supabase.rpc('obras_emitir_fase_revisao', { p_revisao: revisaoId })
  if (error) return erroFaseamento('emitir a revisão', error)
  revalidar(String(ctx.obra.id))
  return { ok: true }
}

/** Nova revisão em rascunho, copiando a última emitida da fase (número = max+1 no banco). */
export async function novaRevisaoAction(faseId: string): Promise<Resultado & { revisaoId?: string }> {
  const ctx = await autorizarPor('obras_fase', faseId)
  if ('ok' in ctx) return ctx
  const { data: ultimas, error: eL } = await ctx.supabase
    .from('obras_fase_revisao')
    .select('id, revisao, status, camadas, regras, carimbo, usa_trava')
    .eq('fase_id', faseId)
    .order('revisao', { ascending: false })
  if (eL) return erroFaseamento('ler as revisões', eL)
  const revs = (ultimas ?? []) as Linha[]
  if (revs.some((r) => r.status === 'rascunho')) return falha('Esta fase já tem uma revisão em rascunho')
  const base = revs.find((r) => r.status === 'emitida')
  if (!base) return falha('Ainda não há revisão emitida para copiar')
  const { data, error } = await ctx.supabase
    .from('obras_fase_revisao')
    .insert({
      fase_id: faseId,
      obra_id: ctx.obra.id,
      camadas: base.camadas ?? [],
      regras: base.regras ?? [],
      carimbo: base.carimbo ?? {},
      usa_trava: base.usa_trava === true,
    })
    .select('id')
    .single()
  if (error || !data) return erroFaseamento('criar a nova revisão', error ?? { message: 'sem retorno' })
  revalidar(String(ctx.obra.id))
  return { ok: true, revisaoId: String((data as Linha).id) }
}

// ---------------------------------------------------------------------------
// Envio ao cliente
// ---------------------------------------------------------------------------

/**
 * Envia a prancha (PDF anexo) da revisão EMITIDA aos destinatários ativos do
 * relatório de fase (tipos semanal/mensal): versão cliente e interna. Um
 * `obras_envio` por lado, tipo `faseamento`, com `fase_revisao_id`.
 */
export async function enviarFaseamentoAction(revisaoId: string): Promise<Resultado & { enviados?: number }> {
  const ctx = await autorizarPor('obras_fase_revisao', revisaoId)
  if ('ok' in ctx) return ctx
  if (ctx.linha.status !== 'emitida') return falha('Emita a revisão antes de enviar ao cliente')
  const obraId = String(ctx.obra.id)

  const { data: dest, error: errD } = await ctx.supabase
    .from('obras_destinatario')
    .select('email, lado, tipos')
    .eq('obra_id', obraId)
    .eq('ativo', true)
    .overlaps('tipos', TIPOS_DESTINATARIO_FASE)
  if (errD) return erroFaseamento('ler os destinatários', errD)
  const doLado = (lado: Lado) => [
    ...new Set(
      ((dest ?? []) as Linha[])
        .filter((d) => d.lado === lado && ((d.tipos ?? []) as string[]).some((t) => TIPOS_DESTINATARIO_FASE.includes(t)))
        .map((d) => String(d.email ?? '').trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
  const para: Record<Lado, string[]> = { cliente: doLado('cliente'), interno: doLado('interno') }
  if (!para.cliente.length) {
    return falha('Nenhum destinatário do cliente com o tipo Semanal ou Mensal em Configurações da obra (peça a um administrador)')
  }
  if (para.cliente.length + para.interno.length > MAX_DESTINATARIOS) return falha(`No máximo ${MAX_DESTINATARIOS} destinatários`)

  const c = await carregarPrancha(ctx.supabase, obraId, revisaoId)
  if (!c.ok) return falha(c.erro)
  let pdf: Buffer
  try {
    pdf = await renderizarPrancha(c.dados)
  } catch (e) {
    return falha(`Não deu para gerar o PDF da prancha (${e instanceof Error ? e.message : 'erro'})`)
  }

  const hoje = hojeISO()
  const fase = `Fase ${c.dados.fase.numero} · ${c.dados.fase.nome}`
  let enviados = 0
  const problemas: string[] = []
  for (const lado of ['cliente', 'interno'] as const) {
    if (!para[lado].length) continue
    const msg = montarEmailFaseamento({
      lado,
      loja: c.dados.obra.nome,
      fase,
      revisao: c.dados.revisao.revisao,
      data: dataBR(String(c.dados.revisao.emitidaEm)),
      regras: c.dados.regras,
      enviadoPor: ctx.email,
      linkObra: linkPortalObra(),
    })
    const r = await enviarEmail({ para: para[lado], ...msg, anexos: [{ nome: c.nomeArquivo, conteudo: pdf }] })
    enviados += r.aceitos.length
    const detalhe = r.falhas.length ? `Falhou: ${r.falhas.map((f) => `${f.para} (${f.erro})`).join(', ')}` : null
    if (detalhe) problemas.push(`${lado} — ${detalhe}`)
    // enviado_por vem do JWT (trigger obras_envio_autor); o banco confere revisão emitida da mesma obra.
    const { error } = await ctx.supabase.from('obras_envio').insert({
      obra_id: obraId,
      tipo: 'faseamento',
      referencia: hoje,
      fase_revisao_id: revisaoId,
      lado,
      destinatarios: r.aceitos,
      resultado: r.falhas.length ? 'falha' : 'ok',
      detalhe,
    })
    if (error) problemas.push(`registro do envio (${lado}) falhou: ${erroFaseamento('registrar o envio', error).erro}`)
  }
  revalidar(obraId)
  revalidatePath(`/obras/obras/${obraId}/comunicacao`)
  if (enviados === 0) return falha(`O e-mail não saiu: ${problemas.join(' · ') || 'nenhum destinatário'}`)
  if (problemas.length) return { ok: false, erro: `Enviado a ${enviados} destinatário(s), mas: ${problemas.join(' · ')}`, enviados }
  return { ok: true, enviados }
}
