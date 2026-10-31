'use server'

/**
 * Server Actions do relatório semanal (Leva 3 §2.3). Tudo só para o engenheiro
 * da obra ou administrador (o trigger OBRAS_SEMANAL e a guarda de
 * `obras_envio` no banco exigem o mesmo). Guarda falha fechada; a obra é
 * relida do banco pela sessão (RLS) — o id do navegador só escolhe qual.
 *
 * - Salvar observações: só em rascunho (cria o rascunho se não existir).
 * - Sugerir com IA: só devolve o texto para o campo na tela; não grava nem envia.
 * - Validar e enviar: valida o que está SALVO, manda a versão cliente aos
 *   destinatários `semanal` do cliente e a interna aos internos (PDF cliente
 *   anexo), um `obras_envio` tipo `semanal` por lado; `enviado` quando o
 *   cliente recebeu. Já validado → manda só a quem ainda não recebeu.
 *
 * Sem `export type` aqui — tipos em `_tipos.ts`.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../../_lib/tipos'
import { montarEmailSemanal, resumoParaIa } from '../../../_lib/email-semanal'
import { enviarEmail } from '../../../_lib/enviar'
import { SEM_IA, iaDisponivel, sugerirObservacoes } from '../../../_lib/ia-semanal'
import {
  conteudoSemanalDe,
  dadosPdfSemanal,
  lerDadosSemanal,
  renderizarSemanal,
  semanaDoRelatorio,
} from '../../../_pdf/carregar-semanal'
import { MAX_OBSERVACOES, type Resultado, type ResultadoEnvio, type ResultadoIa } from './_tipos'

const NAO_AUTENTICADO = 'Não autenticado'
const SEM_ACESSO = 'Sem acesso ao Gestão de Obras'
const SO_ENGENHEIRO = 'Só o engenheiro responsável da obra ou um administrador mexe no relatório semanal'
const JA_VALIDADO = 'Relatório semanal já validado — as observações não mudam mais'
const SEM_RASCUNHO = 'Salve as observações antes de validar'
const SEM_DESTINATARIO_CLIENTE =
  'Nenhum destinatário do cliente com o tipo Semanal em Configurações da obra (peça a um administrador)'
const VALIDADO_MAS = 'Relatório validado, mas o e-mail não saiu'

type Erro = { ok: false; erro: string }
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Lado = 'cliente' | 'interno'

const falha = (erro: string): Erro => ({ ok: false, erro })

function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.code === '42501' || e.message.includes('row-level security')) return falha(SO_ENGENHEIRO)
  if (e.message.includes('OBRAS_SEMANAL')) return falha(JA_VALIDADO)
  if (e.code === '23505') return falha('Outra pessoa criou o relatório desta semana agora. Recarregue a página.')
  return falha(`Não foi possível ${acao}. Tente de novo em instantes. (${e.message})`)
}

/** Sessão + acesso obras/admin + obra OBRA lida pela sessão + engenheiro da obra ou admin. */
async function autorizar(obraId: string): Promise<{ supabase: SupabaseClient; obraId: string } | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha(NAO_AUTENTICADO)
  const admin = await isAdmin(supabase, email)
  if (!admin && !(await hasSystemAccess(supabase, email, 'obras'))) return falha(SEM_ACESSO)
  const { data, error } = await supabase
    .from('obras_obra')
    .select('id, modalidade, engenheiro_email')
    .eq('id', obraId)
    .maybeSingle()
  if (error) return erroBanco('ler a obra', error)
  const obra = data as Linha | null
  if (!obra || obra.modalidade !== 'obra') return falha('Obra não encontrada')
  const engenheiro = String(obra.engenheiro_email ?? '').trim().toLowerCase()
  if (!admin && !(engenheiro !== '' && engenheiro === email)) return falha(SO_ENGENHEIRO)
  return { supabase, obraId: String(obra.id) }
}

const revalidar = (obraId: string) => {
  revalidatePath(`/obras/obras/${obraId}/comunicacao/semanal`)
  revalidatePath(`/obras/obras/${obraId}/comunicacao`)
}

export async function salvarObservacoesSemanalAction(obraId: string, segunda: string, observacoes: string): Promise<Resultado> {
  const a = await autorizar(obraId)
  if ('ok' in a) return a
  const s = semanaDoRelatorio(String(segunda), hojeISO())
  if (!s.ok) return falha(s.erro)
  const texto = (typeof observacoes === 'string' ? observacoes : '').trim()
  if (texto.length > MAX_OBSERVACOES) return falha(`Observações longas demais (até ${MAX_OBSERVACOES.toLocaleString('pt-BR')} caracteres)`)

  const { data: atual, error: errA } = await a.supabase
    .from('obras_semanal')
    .select('id, estado')
    .eq('obra_id', a.obraId)
    .eq('semana_inicio', segunda)
    .maybeSingle()
  if (errA) return erroBanco('ler o relatório', errA)
  if (atual) {
    if ((atual as Linha).estado !== 'rascunho') return falha(JA_VALIDADO)
    const { data, error } = await a.supabase
      .from('obras_semanal')
      .update({ observacoes: texto || null })
      .eq('id', (atual as Linha).id)
      .eq('obra_id', a.obraId)
      .eq('estado', 'rascunho')
      .select('id')
      .maybeSingle()
    if (error) return erroBanco('salvar as observações', error)
    if (!data) return falha(JA_VALIDADO)
  } else {
    const { error } = await a.supabase
      .from('obras_semanal')
      .insert({ obra_id: a.obraId, semana_inicio: segunda, observacoes: texto || null })
    if (error) return erroBanco('salvar as observações', error)
  }
  revalidar(a.obraId)
  return { ok: true }
}

/** Rascunho das observações com IA, a partir SÓ do conteúdo do cliente. Não grava. */
export async function sugerirObservacoesIaAction(obraId: string, segunda: string): Promise<ResultadoIa> {
  const a = await autorizar(obraId)
  if ('ok' in a) return a
  if (!iaDisponivel()) return falha(SEM_IA)
  const l = await lerDadosSemanal(a.supabase, a.obraId, String(segunda), hojeISO())
  if (!l.ok) return falha(l.erro)
  return sugerirObservacoes(resumoParaIa(conteudoSemanalDe(l.dados, 'cliente')))
}

export async function validarEEnviarSemanalAction(obraId: string, segunda: string): Promise<ResultadoEnvio> {
  const a = await autorizar(obraId)
  if ('ok' in a) return a
  const { supabase } = a
  const hoje = hojeISO()
  const s = semanaDoRelatorio(String(segunda), hoje)
  if (!s.ok) return falha(s.erro)

  const { data: rowL, error: errS } = await supabase
    .from('obras_semanal')
    .select('*')
    .eq('obra_id', a.obraId)
    .eq('semana_inicio', segunda)
    .maybeSingle()
  if (errS) return erroBanco('ler o relatório', errS)
  if (!rowL) return falha(SEM_RASCUNHO)
  const row = rowL as Linha
  let estado = String(row.estado)

  const { data: dest, error: errD } = await supabase
    .from('obras_destinatario')
    .select('email, lado')
    .eq('obra_id', a.obraId)
    .eq('ativo', true)
    .contains('tipos', ['semanal'])
  if (errD) return erroBanco('ler os destinatários', errD)
  const doLado = (lado: Lado) =>
    ((dest ?? []) as Linha[]).filter((d) => d.lado === lado).map((d) => String(d.email ?? '').trim()).filter(Boolean)
  const cadastrados = { cliente: doLado('cliente'), interno: doLado('interno') }
  if (!cadastrados.cliente.length) return falha(SEM_DESTINATARIO_CLIENTE)

  if (estado === 'rascunho') {
    // validado_por/validado_em: o trigger OBRAS_SEMANAL grava (e-mail da sessão, now()).
    const { data, error } = await supabase
      .from('obras_semanal')
      .update({ estado: 'validado' })
      .eq('id', row.id)
      .eq('obra_id', a.obraId)
      .eq('estado', 'rascunho')
      .select('id')
      .maybeSingle()
    if (error) return erroBanco('validar o relatório', error)
    if (!data) return falha(JA_VALIDADO)
    estado = 'validado'
    revalidar(a.obraId)
  }

  const { data: envL, error: errE } = await supabase.from('obras_envio').select('lado, destinatarios').eq('semanal_id', row.id)
  if (errE) return falha(`${VALIDADO_MAS}: não deu para ler os envios anteriores (${errE.message})`)
  const jaRecebeu = (lado: Lado) =>
    new Set(
      ((envL ?? []) as Linha[])
        .filter((e) => e.lado === lado)
        .flatMap((e) => ((e.destinatarios ?? []) as string[]).map((x) => x.trim().toLowerCase())),
    )
  const pendentes = {
    cliente: cadastrados.cliente.filter((x) => !jaRecebeu('cliente').has(x.toLowerCase())),
    interno: cadastrados.interno.filter((x) => !jaRecebeu('interno').has(x.toLowerCase())),
  }
  const marcarEnviado = async () => {
    const { error } = await supabase
      .from('obras_semanal')
      .update({ estado: 'enviado' })
      .eq('id', row.id)
      .eq('obra_id', a.obraId)
      .eq('estado', 'validado')
    return error ? `não deu para marcar o relatório como enviado (${error.message})` : null
  }
  if (!pendentes.cliente.length && !pendentes.interno.length) {
    if (estado === 'validado' && jaRecebeu('cliente').size > 0) {
      const e = await marcarEnviado()
      if (e) return falha(`${VALIDADO_MAS}: ${e}`)
      revalidar(a.obraId)
    }
    return { ok: true, enviados: 0 }
  }

  // Conteúdo relido do banco: as observações enviadas são as validadas, nunca as do navegador.
  const l = await lerDadosSemanal(supabase, a.obraId, String(segunda), hoje)
  if (!l.ok) return falha(`${VALIDADO_MAS}: ${l.erro}`)
  let pdf: Buffer
  let nomeArquivo: string
  let fotos: number
  try {
    const p = await dadosPdfSemanal(supabase, l.dados)
    pdf = await renderizarSemanal(p.dados)
    nomeArquivo = p.nomeArquivo
    fotos = p.dados.fotos.length
  } catch (e) {
    return falha(`${VALIDADO_MAS}: não deu para gerar o PDF (${e instanceof Error ? e.message : 'erro'})`)
  }

  let enviados = 0
  let clienteRecebeu = false
  const problemas: string[] = []
  for (const lado of ['cliente', 'interno'] as const) {
    const para = pendentes[lado]
    if (!para.length) continue
    const msg = montarEmailSemanal(conteudoSemanalDe(l.dados, lado), { fotos })
    const r = await enviarEmail({ para, ...msg, anexos: [{ nome: nomeArquivo, conteudo: pdf }] })
    enviados += r.aceitos.length
    if (lado === 'cliente' && r.aceitos.length) clienteRecebeu = true
    const detalhe = r.falhas.length ? `Falhou: ${r.falhas.map((f) => `${f.para} (${f.erro})`).join(', ')}` : null
    if (detalhe) problemas.push(`${lado} — ${detalhe}`)
    // enviado_por vem do JWT (trigger obras_envio_autor).
    const { error } = await supabase.from('obras_envio').insert({
      obra_id: a.obraId,
      tipo: 'semanal',
      referencia: segunda,
      semanal_id: row.id,
      lado,
      destinatarios: r.aceitos,
      resultado: r.falhas.length ? 'falha' : 'ok',
      detalhe,
    })
    if (error) problemas.push(`registro do envio (${lado}) falhou: ${error.message}`)
  }
  if (clienteRecebeu && estado === 'validado') {
    const e = await marcarEnviado()
    if (e) problemas.push(e)
  }
  revalidar(a.obraId)

  if (enviados === 0) return falha(`${VALIDADO_MAS}: ${problemas.join(' · ')}`)
  if (problemas.length) return { ok: false, erro: `Enviado a ${enviados} destinatário(s), mas: ${problemas.join(' · ')}`, enviados }
  return { ok: true, enviados }
}
