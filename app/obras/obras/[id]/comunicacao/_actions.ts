'use server'

/**
 * Server Actions da aba Comunicação (Leva 2 §3.1, §3.5, §6.1-3/4).
 *
 * - Registro manual (reunião/ligação/visita/outro): qualquer usuário com
 *   acesso `obras` (ou admin) cria. Editar/apagar: autor até 24 h após criado
 *   ou admin — conferido aqui e de novo no banco (trigger obras_registro_guarda).
 * - Enviar ata e comunicação imediata: só o engenheiro da obra ou admin (a
 *   guarda de `obras_envio` no banco exige o mesmo).
 *
 * Guarda falha fechada. Sem `export type` aqui — tipos em `_tipos.ts`.
 */

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { isAdmin } from '@/lib/auth/roles'
import { hojeISO } from '../../../_lib/tipos'
import { lerObraGrande } from '../../_lib/leitura'
import { codigosDeAtividades } from '../../_lib/cronograma'
import { enviarEmail } from '../../_lib/enviar'
import { carregarPdfAta, renderizarAta } from '../../_pdf/carregar-ata'
import { montarEmailAta, montarEmailImediata, vinculoImediata, type EmailSimples } from './_email'
import { podeEditar, validarImediata, validarRegistro } from './_regras'
import type { Ata, ImediataEntrada, RegistroEntrada, Resultado } from './_tipos'

const NAO_AUTENTICADO = 'Não autenticado'
const SEM_ACESSO = 'Sem acesso ao Gestão de Obras'
const SO_ENGENHEIRO = 'Só o engenheiro responsável da obra ou um administrador envia comunicação'
const FORA_DA_JANELA = 'Só o autor, até 24 h depois de registrar, ou um administrador altera ou apaga o registro'
const NAO_ENCONTRADO = 'Registro não encontrado'
const MAX_DESTINATARIOS = 40

type Erro = { ok: false; erro: string }
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Sessao = { supabase: SupabaseClient; email: string; admin: boolean }

const falha = (erro: string): Erro => ({ ok: false, erro })

async function autorizar(): Promise<Sessao | Erro> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha(NAO_AUTENTICADO)
  const admin = await isAdmin(supabase, email)
  if (admin || (await hasSystemAccess(supabase, email, 'obras'))) return { supabase, email, admin }
  return falha(SEM_ACESSO)
}

function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.message.includes('OBRAS_REGISTRO')) return falha(FORA_DA_JANELA)
  if (e.code === '42501' || e.message.includes('row-level security')) return falha(SEM_ACESSO)
  return falha(`Não foi possível ${acao}. Tente de novo em instantes. (${e.message})`)
}

const revalidar = (obraId: string) => revalidatePath(`/obras/obras/${obraId}/comunicacao`)

const ehEngenheiroOuAdmin = (s: Sessao, engenheiroEmail: string | null | undefined) =>
  s.admin || (!!engenheiroEmail && engenheiroEmail.trim().toLowerCase() === s.email)

async function obraDaModalidade(supabase: SupabaseClient, obraId: string): Promise<{ obra: Linha } | Erro> {
  const { data, error } = await supabase
    .from('obras_obra')
    .select('id, modalidade, engenheiro_email')
    .eq('id', obraId)
    .maybeSingle()
  if (error) return erroBanco('ler a obra', error)
  if (!data || (data as Linha).modalidade !== 'obra') return falha('Obra não encontrada')
  return { obra: data as Linha }
}

const colunasRegistro = (v: { tipo: string; data: string; participantes: string | null; texto: string | null; ata: Ata | null }) => ({
  tipo: v.tipo,
  data: v.data,
  participantes: v.participantes,
  texto: v.texto,
  ata: v.ata,
})

export async function criarRegistroAction(obraId: string, entrada: RegistroEntrada): Promise<Resultado & { id?: string }> {
  const s = await autorizar()
  if ('ok' in s) return s
  const v = validarRegistro(entrada, hojeISO())
  if (!v.ok) return v
  const obra = await obraDaModalidade(s.supabase, obraId)
  if ('ok' in obra) return obra
  // criado_por/criado_em: o trigger grava pelo JWT.
  const { data, error } = await s.supabase
    .from('obras_registro')
    .insert({ obra_id: obraId, ...colunasRegistro(v.valor) })
    .select('id')
    .single()
  if (error) return erroBanco('registrar', error)
  revalidar(obraId)
  return { ok: true, id: String((data as Linha).id) }
}

/** Lê o registro desta obra e confere a janela de edição (autor ≤ 24 h ou admin). */
async function registroEditavel(s: Sessao, obraId: string, registroId: string): Promise<{ registro: Linha } | Erro> {
  const { data, error } = await s.supabase
    .from('obras_registro')
    .select('id, obra_id, tipo, criado_por, criado_em')
    .eq('id', registroId)
    .eq('obra_id', obraId)
    .maybeSingle()
  if (error) return erroBanco('ler o registro', error)
  if (!data) return falha(NAO_ENCONTRADO)
  const r = data as Linha
  if (!podeEditar({ criadoPor: r.criado_por ?? null, criadoEm: String(r.criado_em) }, s.email, s.admin)) {
    return falha(FORA_DA_JANELA)
  }
  return { registro: r }
}

export async function editarRegistroAction(obraId: string, registroId: string, entrada: RegistroEntrada): Promise<Resultado> {
  const s = await autorizar()
  if ('ok' in s) return s
  const e = await registroEditavel(s, obraId, registroId)
  if ('ok' in e) return e
  if (e.registro.tipo === 'imediata') return falha('Comunicação imediata já foi enviada e não se edita')
  const v = validarRegistro(entrada, hojeISO())
  if (!v.ok) return v
  const { data, error } = await s.supabase
    .from('obras_registro')
    .update(colunasRegistro(v.valor))
    .eq('id', registroId)
    .eq('obra_id', obraId)
    .select('id')
    .maybeSingle()
  if (error) return erroBanco('salvar o registro', error)
  if (!data) return falha(NAO_ENCONTRADO)
  revalidar(obraId)
  return { ok: true }
}

export async function apagarRegistroAction(obraId: string, registroId: string): Promise<Resultado> {
  const s = await autorizar()
  if ('ok' in s) return s
  const e = await registroEditavel(s, obraId, registroId)
  if ('ok' in e) return e
  const { data, error } = await s.supabase
    .from('obras_registro')
    .delete()
    .eq('id', registroId)
    .eq('obra_id', obraId)
    .select('id')
  if (error) return erroBanco('apagar o registro', error)
  if (!((data as Linha[] | null) ?? []).length) return falha(NAO_ENCONTRADO)
  revalidar(obraId)
  return { ok: true }
}

type Lado = 'cliente' | 'interno'

/**
 * Um e-mail por destinatário, agrupado por lado; um `obras_envio` por lado
 * (destinatarios = quem recebeu; detalhe = quem falhou). enviado_por: trigger.
 */
async function enviarPorLado(p: {
  supabase: SupabaseClient
  obraId: string
  tipo: 'ata' | 'imediata'
  referencia: string
  registroId: string
  para: Record<Lado, string[]>
  mensagem: (lado: Lado) => EmailSimples
  anexos: { nome: string; conteudo: Buffer }[]
}): Promise<Resultado & { enviados?: number }> {
  let enviados = 0
  const problemas: string[] = []
  for (const lado of ['cliente', 'interno'] as const) {
    const para = p.para[lado]
    if (!para.length) continue
    const r = await enviarEmail({ para, ...p.mensagem(lado), anexos: p.anexos })
    enviados += r.aceitos.length
    const detalhe = r.falhas.length ? `Falhou: ${r.falhas.map((f) => `${f.para} (${f.erro})`).join(', ')}` : null
    if (detalhe) problemas.push(`${lado} — ${detalhe}`)
    const { error } = await p.supabase.from('obras_envio').insert({
      obra_id: p.obraId,
      tipo: p.tipo,
      referencia: p.referencia,
      registro_id: p.registroId,
      lado,
      destinatarios: r.aceitos,
      resultado: r.falhas.length ? 'falha' : 'ok',
      detalhe,
    })
    if (error) problemas.push(`registro do envio (${lado}) falhou: ${error.message}`)
  }
  if (enviados === 0) return falha(`O e-mail não saiu: ${problemas.join(' · ') || 'nenhum destinatário'}`)
  if (problemas.length) return { ok: false, erro: `Enviado a ${enviados} destinatário(s), mas: ${problemas.join(' · ')}`, enviados }
  return { ok: true, enviados }
}

const normal = (e: string) => e.trim().toLowerCase()

/**
 * Envia a ata (PDF anexo) aos destinatários escolhidos — só entre os
 * cadastrados e ativos da obra. Registra em `obras_envio` tipo `ata`.
 */
export async function enviarAtaAction(
  obraId: string,
  registroId: string,
  emails: string[],
): Promise<Resultado & { enviados?: number }> {
  const s = await autorizar()
  if ('ok' in s) return s
  const escolhidos = [...new Set((Array.isArray(emails) ? emails : []).map((e) => normal(String(e))).filter(Boolean))]
  if (!escolhidos.length) return falha('Escolha ao menos um destinatário')
  if (escolhidos.length > MAX_DESTINATARIOS) return falha(`No máximo ${MAX_DESTINATARIOS} destinatários`)

  const c = await carregarPdfAta(s.supabase, obraId, registroId)
  if (!c.ok) return falha(c.erro)
  if (!ehEngenheiroOuAdmin(s, c.obra.engenheiro_email)) return falha(SO_ENGENHEIRO)

  const { data: dest, error } = await s.supabase
    .from('obras_destinatario')
    .select('email, lado')
    .eq('obra_id', obraId)
    .eq('ativo', true)
  if (error) return erroBanco('ler os destinatários', error)
  const cadastro = new Map(((dest ?? []) as Linha[]).map((d) => [normal(String(d.email ?? '')), d.lado as Lado]))
  const fora = escolhidos.filter((e) => !cadastro.has(e))
  if (fora.length) return falha(`Fora do cadastro de destinatários da obra: ${fora.join(', ')}`)
  const para: Record<Lado, string[]> = {
    cliente: escolhidos.filter((e) => cadastro.get(e) === 'cliente'),
    interno: escolhidos.filter((e) => cadastro.get(e) === 'interno'),
  }

  const r = c.registro
  const ataBanco = (r.ata ?? {}) as Partial<Ata>
  const ata: Ata = {
    pauta: String(ataBanco.pauta ?? ''),
    decisoes: Array.isArray(ataBanco.decisoes) ? ataBanco.decisoes : [],
    pendencias: Array.isArray(ataBanco.pendencias) ? ataBanco.pendencias : [],
  }
  const loja = String(c.obra.loja ?? c.obra.descricao ?? c.obra.os ?? 'Obra').trim() || 'Obra'
  const msg = montarEmailAta({
    loja,
    data: String(r.data),
    participantes: r.participantes ?? null,
    texto: r.texto ?? null,
    ata,
    enviadoPor: s.email,
  })
  let pdf: Buffer
  try {
    pdf = await renderizarAta(c.dados)
  } catch (e) {
    return falha(`Não deu para gerar o PDF da ata (${e instanceof Error ? e.message : 'erro'})`)
  }
  const res = await enviarPorLado({
    supabase: s.supabase,
    obraId,
    tipo: 'ata',
    referencia: String(r.data),
    registroId,
    para,
    mensagem: () => msg,
    anexos: [{ nome: c.nomeArquivo, conteudo: pdf }],
  })
  revalidar(obraId)
  return res
}

/**
 * Comunicação imediata (§3.5): registra (tipo `imediata`) e envia aos
 * destinatários ativos com tipo `imediato` — versão cliente e versão interna.
 */
export async function enviarImediataAction(
  obraId: string,
  entrada: ImediataEntrada,
): Promise<Resultado & { enviados?: number }> {
  const s = await autorizar()
  if ('ok' in s) return s
  const v = validarImediata(entrada)
  if (!v.ok) return v
  const hoje = hojeISO()
  const lida = await lerObraGrande(s.supabase, obraId, hoje)
  if (!lida.ok) return falha(lida.erro)
  const og = lida.dados
  if (og.obra.modalidade !== 'obra') return falha('Obra não encontrada')
  if (!ehEngenheiroOuAdmin(s, og.obra.engenheiro_email)) return falha(SO_ENGENHEIRO)

  const { impedimentoId, atividadeNumero } = v.valor
  const impedimento = impedimentoId ? (og.impedimentos.find((i) => i.id === impedimentoId) ?? null) : null
  if (impedimentoId && !impedimento) return falha('Impedimento não encontrado nesta obra')
  const ativ = atividadeNumero !== null ? (og.plano.find((a) => a.numero === atividadeNumero) ?? null) : null
  if (atividadeNumero !== null && !ativ) return falha('Atividade não encontrada no cronograma desta obra')

  const { data: dest, error: errD } = await s.supabase
    .from('obras_destinatario')
    .select('email, lado')
    .eq('obra_id', obraId)
    .eq('ativo', true)
    .contains('tipos', ['imediato'])
  if (errD) return erroBanco('ler os destinatários', errD)
  const doLado = (lado: Lado) =>
    ((dest ?? []) as Linha[]).filter((d) => d.lado === lado).map((d) => String(d.email ?? '').trim()).filter(Boolean)
  const para = { cliente: doLado('cliente'), interno: doLado('interno') }
  if (!para.cliente.length && !para.interno.length) {
    return falha('Nenhum destinatário com o tipo Imediato cadastrado em Configurações da obra (peça a um administrador)')
  }

  const { data: reg, error: errR } = await s.supabase
    .from('obras_registro')
    .insert({
      obra_id: obraId,
      tipo: 'imediata',
      data: hoje,
      texto: v.valor.texto,
      // Sem coluna própria para o assunto: vai no jsonb do registro.
      ata: { assunto: v.valor.assunto },
      nivel: v.valor.nivel,
      impedimento_id: impedimento?.id ?? null,
      atividade_numero: ativ?.numero ?? null,
    })
    .select('id')
    .single()
  if (errR) return erroBanco('registrar a comunicação', errR)

  const loja = og.obra.loja?.trim() || og.obra.descricao?.trim() || og.obra.os || 'Obra'
  const atividade = ativ
    ? { codigo: codigosDeAtividades(og.calc?.atividades ?? [], og.feriados).get(ativ.numero) ?? null, descricao: ativ.descricao }
    : null
  const res = await enviarPorLado({
    supabase: s.supabase,
    obraId,
    tipo: 'imediata',
    referencia: hoje,
    registroId: String((reg as Linha).id),
    para,
    mensagem: (lado) =>
      montarEmailImediata({
        lado,
        loja,
        data: hoje,
        assunto: v.valor.assunto,
        texto: v.valor.texto,
        nivel: v.valor.nivel,
        vinculo: vinculoImediata({ lado, impedimento, atividade }),
        enviadoPor: s.email,
      }),
    anexos: [],
  })
  revalidar(obraId)
  return res
}
