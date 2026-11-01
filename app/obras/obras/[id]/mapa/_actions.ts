'use server'

/**
 * Server Actions do mapa da obra (Leva 6, spec §2 e §3).
 *
 * Quem escreve mapa, ambientes, pontos e atividades do ambiente: o engenheiro
 * da obra ou administrador (`podeMontarMapa`), conferido aqui antes de tocar no
 * banco. O banco é a segunda barreira (triggers OBRAS_MAPA / OBRAS_MAPA_VINCULO,
 * checks de coordenada, FK que recusa apagar ambiente com foto); o erro dele
 * vira mensagem em pt-BR.
 *
 * Sem `export type` aqui — tipos em `_tipos.ts`.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { podeMontarMapa } from './_permissao'
import { caminhoPlantaValido, normalizarPosicao, normalizarRetangulo } from './_regras'
import type { DadosAmbiente, DadosPonto, Resultado } from './_tipos'

const SEM_PERMISSAO = 'Só o engenheiro da obra ou um administrador monta o mapa'
const MODOS = ['planta', 'croqui', 'ambientes'] as const

type Erro = { ok: false; erro: string }
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Contexto = { supabase: SupabaseClient; obraId: string }

const falha = (erro: string): Erro => ({ ok: false, erro })
const texto = (s: string | null | undefined) => (s ?? '').trim()

/** Erro do banco → pt-BR. */
function erroMapa(acao: string, e: { message: string; code?: string; details?: string }): Erro {
  const m = `${e.message} ${e.details ?? ''}`
  if (m.includes('OBRAS_MAPA_VINCULO:')) {
    const t = e.message.split('OBRAS_MAPA_VINCULO:')[1]?.trim() ?? ''
    return falha(t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Vínculo inválido')
  }
  if (m.includes('OBRAS_MAPA') || e.code === '42501' || m.includes('row-level security')) return falha(SEM_PERMISSAO)
  if (e.code === '23503') {
    if (m.includes('obras_rdo_foto')) {
      return falha('Este ambiente tem fotos no diário e não pode ser apagado. Desative os pontos dele em vez de apagar.')
    }
    if (m.includes('obras_impedimento')) return falha('Este ambiente tem impedimento marcado e não pode ser apagado.')
    return falha('Referência inválida (obra, ambiente ou ponto não existe mais).')
  }
  if (e.code === '23514') {
    if (m.includes('retangulo')) return falha('O retângulo precisa ficar dentro do quadro.')
    if (m.includes('nome')) return falha('Dê um nome (até 120 caracteres).')
    if (m.includes('area')) return falha('Área precisa ser maior que zero.')
    if (m.includes('posicao')) return falha('O ponto precisa ficar dentro do quadro.')
    if (m.includes('planta')) return falha('Planta inválida.')
    return falha('Dados inválidos.')
  }
  return falha(`Não foi possível ${acao}. Tente de novo em instantes.`)
}

/** Sessão + obra da modalidade OBRA + engenheiro/admin. Falha fechada. */
async function autorizar(obraId: string): Promise<Contexto | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha('Não autenticado')
  if (typeof obraId !== 'string' || !obraId) return falha('Obra não encontrada')
  const { data: obra, error } = await supabase
    .from('obras_obra')
    .select('id, modalidade, engenheiro_email')
    .eq('id', obraId)
    .maybeSingle()
  if (error) return erroMapa('ler a obra', error)
  if (!obra || obra.modalidade !== 'obra') return falha('Obra não encontrada')
  if (!(await podeMontarMapa(supabase, email, obra.engenheiro_email as string | null))) return falha(SEM_PERMISSAO)
  return { supabase, obraId }
}

/** Autoriza pela obra dona da linha (ambiente ou ponto). */
async function autorizarPor(tabela: 'obras_ambiente' | 'obras_ponto_foto', id: string): Promise<(Contexto & { linha: Linha }) | Erro> {
  const supabase = await createClient()
  const { data, error } = await supabase.from(tabela).select('*').eq('id', id).maybeSingle()
  if (error) return erroMapa('ler o mapa', error)
  if (!data) return falha(tabela === 'obras_ambiente' ? 'Ambiente não encontrado' : 'Ponto não encontrado')
  const ctx = await autorizar((data as Linha).obra_id as string)
  if ('ok' in ctx) return ctx
  return { ...ctx, linha: data as Linha }
}

function revalidar(obraId: string) {
  revalidatePath(`/obras/obras/${obraId}/mapa`, 'layout')
  revalidatePath(`/obras/obras/${obraId}/diario`)
}

function validarNome(nome: string): string | Erro {
  const n = texto(nome)
  if (!n) return falha('Dê um nome')
  if (n.length > 120) return falha('Nome com até 120 caracteres')
  return n
}

function validarArea(a: number | null | undefined): number | null | Erro {
  if (a === null || a === undefined) return null
  if (!(typeof a === 'number' && Number.isFinite(a) && a > 0 && a < 1e9)) return falha('Área precisa ser maior que zero')
  return Math.round(a * 100) / 100
}

// ---------------------------------------------------------------------------
// Mapa (modo e planta)
// ---------------------------------------------------------------------------

export async function salvarModoAction(obraId: string, modo: string): Promise<Resultado> {
  const ctx = await autorizar(obraId)
  if ('ok' in ctx) return ctx
  if (!(MODOS as readonly string[]).includes(modo)) return falha('Modo inválido')
  if (modo === 'planta') {
    const { data, error } = await ctx.supabase.from('obras_mapa').select('planta_path').eq('obra_id', obraId).maybeSingle()
    if (error) return erroMapa('ler o mapa', error)
    if (!data?.planta_path) return falha('Envie a imagem da planta para usar o modo planta')
  }
  const { error } = await ctx.supabase.from('obras_mapa').upsert({ obra_id: obraId, modo }, { onConflict: 'obra_id' })
  if (error) return erroMapa('salvar o modo do mapa', error)
  revalidar(obraId)
  return { ok: true }
}

/** Registra a planta já enviada ao bucket (caminho canônico) e passa o mapa para o modo planta. */
export async function salvarPlantaAction(obraId: string, path: string, largura: number, altura: number): Promise<Resultado> {
  const ctx = await autorizar(obraId)
  if ('ok' in ctx) return ctx
  if (typeof path !== 'string' || !caminhoPlantaValido(obraId, path)) return falha('Caminho da planta inválido')
  const dim = (v: number) => Number.isInteger(v) && v > 0 && v < 100000
  if (!dim(largura) || !dim(altura)) return falha('Não deu para ler o tamanho da imagem')
  const { error } = await ctx.supabase.from('obras_mapa').upsert(
    { obra_id: obraId, modo: 'planta', planta_path: path, planta_largura: largura, planta_altura: altura },
    { onConflict: 'obra_id' },
  )
  if (error) return erroMapa('salvar a planta', error)
  revalidar(obraId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Ambientes
// ---------------------------------------------------------------------------

export async function criarAmbienteAction(obraId: string, a: DadosAmbiente): Promise<Resultado & { id?: string }> {
  const ctx = await autorizar(obraId)
  if ('ok' in ctx) return ctx
  const nome = validarNome(a?.nome)
  if (typeof nome !== 'string') return nome
  const area = validarArea(a.areaM2)
  if (area !== null && typeof area === 'object') return area
  const ret = a.retangulo ? normalizarRetangulo(a.retangulo) : null
  if (a.retangulo && !ret) return falha('Retângulo inválido')

  const { data: atuais, error: eO } = await ctx.supabase.from('obras_ambiente').select('ordem').eq('obra_id', obraId)
  if (eO) return erroMapa('ler os ambientes', eO)
  const ordem = ((atuais ?? []) as Linha[]).reduce((m, x) => Math.max(m, Number(x.ordem ?? 0)), 0) + 1

  const { data, error } = await ctx.supabase
    .from('obras_ambiente')
    .insert({ obra_id: obraId, nome, area_m2: area, x: ret?.x ?? null, y: ret?.y ?? null, w: ret?.w ?? null, h: ret?.h ?? null, ordem })
    .select('id')
    .single()
  if (error || !data) return erroMapa('criar o ambiente', error ?? { message: 'sem retorno' })
  revalidar(obraId)
  return { ok: true, id: (data as Linha).id as string }
}

/** Atualiza só o que veio: nome, área e/ou retângulo (`retangulo: null` tira o desenho). */
export async function atualizarAmbienteAction(ambienteId: string, a: Partial<DadosAmbiente>): Promise<Resultado> {
  const ctx = await autorizarPor('obras_ambiente', ambienteId)
  if ('ok' in ctx) return ctx
  const patch: Linha = {}
  if (a.nome !== undefined) {
    const nome = validarNome(a.nome)
    if (typeof nome !== 'string') return nome
    patch.nome = nome
  }
  if (a.areaM2 !== undefined) {
    const area = validarArea(a.areaM2)
    if (area !== null && typeof area === 'object') return area
    patch.area_m2 = area
  }
  if (a.retangulo !== undefined) {
    const ret = a.retangulo ? normalizarRetangulo(a.retangulo) : null
    if (a.retangulo && !ret) return falha('Retângulo inválido')
    Object.assign(patch, { x: ret?.x ?? null, y: ret?.y ?? null, w: ret?.w ?? null, h: ret?.h ?? null })
  }
  if (!Object.keys(patch).length) return { ok: true }
  const { data, error } = await ctx.supabase.from('obras_ambiente').update(patch).eq('id', ambienteId).select('id')
  if (error) return erroMapa('salvar o ambiente', error)
  if (!data?.length) return falha(SEM_PERMISSAO)
  revalidar(ctx.obraId)
  return { ok: true }
}

/** Apaga o ambiente (pontos e ligações caem em cascata). Com foto ligada o banco recusa. */
export async function apagarAmbienteAction(ambienteId: string): Promise<Resultado> {
  const ctx = await autorizarPor('obras_ambiente', ambienteId)
  if ('ok' in ctx) return ctx
  const { data, error } = await ctx.supabase.from('obras_ambiente').delete().eq('id', ambienteId).select('id')
  if (error) return erroMapa('apagar o ambiente', error)
  if (!data?.length) return falha(SEM_PERMISSAO)
  revalidar(ctx.obraId)
  return { ok: true }
}

/** Troca as atividades ligadas ao ambiente pelo conjunto marcado (pelo número da atividade). */
export async function definirAtividadesAction(ambienteId: string, numeros: number[]): Promise<Resultado> {
  const ctx = await autorizarPor('obras_ambiente', ambienteId)
  if ('ok' in ctx) return ctx
  if (!Array.isArray(numeros) || !numeros.every((n) => Number.isInteger(n) && n >= 1)) return falha('Atividade inválida')
  const quero = new Set(numeros)

  const { data: atuais, error: eL } = await ctx.supabase
    .from('obras_ambiente_atividade')
    .select('atividade_numero')
    .eq('ambiente_id', ambienteId)
  if (eL) return erroMapa('ler as atividades do ambiente', eL)
  const tem = new Set(((atuais ?? []) as Linha[]).map((l) => Number(l.atividade_numero)))
  const sair = [...tem].filter((n) => !quero.has(n))
  const entrar = [...quero].filter((n) => !tem.has(n))

  if (sair.length) {
    const { error } = await ctx.supabase
      .from('obras_ambiente_atividade')
      .delete()
      .eq('ambiente_id', ambienteId)
      .in('atividade_numero', sair)
    if (error) return erroMapa('tirar atividades do ambiente', error)
  }
  if (entrar.length) {
    const { error } = await ctx.supabase
      .from('obras_ambiente_atividade')
      .insert(entrar.map((n) => ({ ambiente_id: ambienteId, atividade_numero: n })))
    if (error) return erroMapa('ligar atividades ao ambiente', error)
  }
  revalidar(ctx.obraId)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Pontos de foto
// ---------------------------------------------------------------------------

/** Cria o ponto; o número sequencial é atribuído pelo banco. */
export async function criarPontoAction(obraId: string, p: DadosPonto): Promise<Resultado & { id?: string; numero?: number }> {
  const ctx = await autorizar(obraId)
  if ('ok' in ctx) return ctx
  const nome = validarNome(p?.nome)
  if (typeof nome !== 'string') return nome
  if (typeof p.ambienteId !== 'string' || !p.ambienteId) return falha('Escolha o ambiente do ponto')
  const pos = normalizarPosicao(p.x, p.y)
  const { data, error } = await ctx.supabase
    .from('obras_ponto_foto')
    .insert({ obra_id: obraId, nome, ambiente_id: p.ambienteId, x: pos?.x ?? null, y: pos?.y ?? null })
    .select('id, numero')
    .single()
  if (error || !data) return erroMapa('criar o ponto', error ?? { message: 'sem retorno' })
  revalidar(obraId)
  return { ok: true, id: (data as Linha).id as string, numero: Number((data as Linha).numero) }
}

/** Atualiza nome, ambiente e/ou posição (`x: null, y: null` tira do desenho). */
export async function atualizarPontoAction(pontoId: string, p: Partial<DadosPonto>): Promise<Resultado> {
  const ctx = await autorizarPor('obras_ponto_foto', pontoId)
  if ('ok' in ctx) return ctx
  const patch: Linha = {}
  if (p.nome !== undefined) {
    const nome = validarNome(p.nome)
    if (typeof nome !== 'string') return nome
    patch.nome = nome
  }
  if (p.ambienteId !== undefined) {
    if (typeof p.ambienteId !== 'string' || !p.ambienteId) return falha('Escolha o ambiente do ponto')
    patch.ambiente_id = p.ambienteId
  }
  if (p.x !== undefined || p.y !== undefined) {
    const pos = normalizarPosicao(p.x, p.y)
    patch.x = pos?.x ?? null
    patch.y = pos?.y ?? null
  }
  if (!Object.keys(patch).length) return { ok: true }
  const { data, error } = await ctx.supabase.from('obras_ponto_foto').update(patch).eq('id', pontoId).select('id')
  if (error) return erroMapa('salvar o ponto', error)
  if (!data?.length) return falha(SEM_PERMISSAO)
  revalidar(ctx.obraId)
  return { ok: true }
}

/** Desativa (ou reativa) o ponto: some da ronda, mas as fotos e a linha do tempo ficam. */
export async function definirPontoAtivoAction(pontoId: string, ativo: boolean): Promise<Resultado> {
  const ctx = await autorizarPor('obras_ponto_foto', pontoId)
  if ('ok' in ctx) return ctx
  const { data, error } = await ctx.supabase
    .from('obras_ponto_foto')
    .update({ ativo: ativo === true })
    .eq('id', pontoId)
    .select('id')
  if (error) return erroMapa(ativo ? 'reativar o ponto' : 'desativar o ponto', error)
  if (!data?.length) return falha(SEM_PERMISSAO)
  revalidar(ctx.obraId)
  return { ok: true }
}
