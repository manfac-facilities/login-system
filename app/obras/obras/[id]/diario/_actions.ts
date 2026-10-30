'use server'

/**
 * Server Actions do diário de obra (RDO) da modalidade OBRA — spec §5.3.
 *
 * Quem preenche: qualquer usuário com acesso `obras` (ou administrador). Guarda
 * falha fechada. O rascunho só mexe no RDO; aplicar o avanço em
 * `obras_atividade_exec` acontece na validação (`validarEEnviarAction`, só o
 * engenheiro da obra ou admin).
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
import { diasUteisEntre } from '../../_lib/calendario'
import { montarEmailDiario, type RdoCompleto } from '../../_lib/email-diario'
import { enviarEmail } from '../../_lib/enviar'
import { createAdminClient } from '@/lib/supabase/admin'
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
  for (const c of [corpo.clima, corpo.climaManha, corpo.climaTarde]) {
    if (c != null && !CLIMAS.includes(c)) return falha('Clima inválido')
  }
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
    clima: corpo.clima ?? null,
    clima_manha: corpo.climaManha ?? null,
    clima_tarde: corpo.climaTarde ?? null,
    programacao_amanha: texto(corpo.programacaoAmanha),
    sem_impedimento: corpo.semImpedimento === true,
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
 * Tira a foto do diário (rascunho) e apaga o arquivo do bucket `obras-fotos` (com a sessão do usuário).
 * Falha ao apagar o arquivo (inclusive "não encontrado") não desfaz a remoção.
 */
export async function removerFotoAction(fotoId: string): Promise<Resultado> {
  const auth = await autorizar()
  if ('ok' in auth) return auth
  const { supabase } = auth

  const { data: foto, error: errF } = await supabase
    .from('obras_rdo_foto')
    .select('id, rdo_id, path')
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

  // Sessão do usuário (não service role): a policy de delete do bucket vale. Só caminho do próprio RDO.
  const caminho = (foto as Linha).path as string | null
  const prefixo = `${rdo.obra_id}/rdo/${String(rdo.data).slice(0, 10)}/`
  if (caminho && caminho.startsWith(prefixo) && !caminho.split('/').includes('..')) {
    try {
      const { error: errS } = await supabase.storage.from('obras-fotos').remove([caminho])
      if (errS && !/not.?found/i.test(errS.message)) console.warn(`[diario-obra] arquivo ${caminho} ficou no bucket: ${errS.message}`)
    } catch (e) {
      console.warn(`[diario-obra] arquivo ${caminho} ficou no bucket: ${e instanceof Error ? e.message : e}`)
    }
  }

  revalidar(rdo.obra_id as string)
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Validar e enviar (Task 9b, spec §5.3 "Validar e enviar", §5.4, §5.5, §7.2)
// ---------------------------------------------------------------------------

const SO_ENGENHEIRO = 'Só o engenheiro responsável da obra ou um administrador valida o diário'
const SEM_DESTINATARIO_CLIENTE = 'Cadastre os destinatários em Configurações da obra (peça a um administrador)'
const VALIDADO_MAS = 'Diário validado, mas o e-mail não saiu'
const MAX_FOTOS = 6
/** Sem biblioteca de imagem no projeto: foto acima disso fica fora do e-mail. */
const MAX_BYTES_FOTO = 1_500_000

/**
 * 1. só o engenheiro da obra (com acesso `obras`) ou admin;
 * 2. RDO do dia em rascunho → aplica o avanço em `obras_atividade_exec` (nunca
 *    para trás) e valida. RDO validado/enviado → só manda a quem ainda não recebeu;
 * 3. até 6 fotos por CID (baixadas com a service role);
 * 4. um e-mail por destinatário ativo com tipo `diario`, por lado;
 * 5. um `obras_envio` por lado (destinatarios = quem recebeu; detalhe = quem
 *    falhou); RDO `enviado` quando o lado cliente teve ao menos um sucesso.
 * Sem destinatário do cliente: valida e não envia nada.
 */
export async function validarEEnviarAction(
  obraId: string,
  data: string,
): Promise<Resultado & { enviados?: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user?.email?.trim().toLowerCase()
  if (!email) return falha(NAO_AUTENTICADO)
  const admin = await isAdmin(supabase, email)
  if (!admin && !(await hasSystemAccess(supabase, email, 'obras'))) return falha(SEM_ACESSO)
  if (!ISO.test(data)) return falha('Data inválida')

  const lida = await lerObraGrande(supabase, obraId, data)
  if (!lida.ok) return lida
  const { obra, versaoBase, plano, exec } = lida.dados
  if (obra.modalidade !== 'obra') return falha('Obra não encontrada')
  const engenheiro = obra.engenheiro_email?.trim().toLowerCase() ?? ''
  if (!admin && !(engenheiro !== '' && engenheiro === email)) return falha(SO_ENGENHEIRO)
  if (!versaoBase?.salvaEm) return falha(SEM_BASE)

  const { data: rdoL, error: errR } = await supabase
    .from('obras_rdo')
    .select('*')
    .eq('obra_id', obraId)
    .eq('data', data)
    .maybeSingle()
  if (errR) return erroBanco('ler o diário', errR)
  if (!rdoL) return falha(RDO_NAO_ENCONTRADO)
  const rdo = rdoL as Linha
  let estado = rdo.estado as string

  const [avR, foR] = await Promise.all([
    supabase.from('obras_rdo_avanco').select('*').eq('rdo_id', rdo.id),
    supabase.from('obras_rdo_foto').select('*').eq('rdo_id', rdo.id).order('ordem'),
  ])
  if (avR.error) return erroBanco('ler o avanço', avR.error)
  if (foR.error) return erroBanco('ler as fotos', foR.error)
  const avancos = ((avR.data ?? []) as Linha[]).map((a) => ({
    numero: Number(a.numero),
    de: Number(a.de ?? 0),
    para: Number(a.para ?? 0),
    concluida: !!a.concluida,
    causa: CAUSAS.includes(a.causa) ? (a.causa as CausaNaoAndou) : null,
  }))

  let validadoPor = (rdo.validado_por as string | null) ?? email
  let validadoEm = (rdo.validado_em as string | null) ?? new Date().toISOString()

  if (estado === 'rascunho') {
    // Aplica o diário na execução (spec §7.2) ANTES de validar: se falhar no
    // meio, o RDO segue rascunho e repetir reaplica os mesmos valores.
    // Nunca para trás (ruling do controlador): percentual = max(atual, para);
    // atividade já concluída fica concluída. O rastro é obras_rdo_avanco +
    // atualizado_por/em da execução (sem linha em obras_historico).
    const agora = new Date().toISOString()
    const execDe = (n: number) => exec.find((e) => e.numero === n)
    // A trava concluída neste mesmo diário libera as que dependem dela.
    const concluidasHoje = new Set(rdo.sem_execucao ? [] : avancos.filter((a) => a.concluida).map((a) => a.numero))
    const execParaTrava = exec.map((e) => (concluidasHoje.has(e.numero) ? { ...e, status: 'concluido' as const } : e))
    if (obra.atividade_trava !== null && concluidasHoje.has(obra.atividade_trava) && !execDe(obra.atividade_trava)) {
      execParaTrava.push({ numero: obra.atividade_trava, status: 'concluido', percentual: 1, inicioReal: null, fimReal: null })
    }
    const linhas: Linha[] = []
    for (const a of rdo.sem_execucao ? [] : avancos) {
      const atual = execDe(a.numero)
      if (atual?.status === 'concluido') continue
      const antes = atual?.percentual ?? 0
      const percentual = a.concluida ? 1 : Math.max(antes, a.para)
      if (!a.concluida && percentual === antes) continue
      const trava = podeIniciar(a.numero, plano, execParaTrava, obra.atividade_trava ?? null)
      if (!trava.ok) return falha(`Atividade ${a.numero}: ${trava.motivo.charAt(0).toLowerCase()}${trava.motivo.slice(1)}`)
      let status: string
      if (a.concluida) status = 'concluido'
      else if (atual?.status === 'bloqueado') status = 'bloqueado'
      else status = 'em_andamento'
      linhas.push({
        obra_id: obraId,
        numero: a.numero,
        status,
        percentual,
        inicio_real: atual?.inicioReal ?? data,
        fim_real: a.concluida ? (atual?.fimReal ?? data) : (atual?.fimReal ?? null),
        // Dias restantes informados antes não podem seguir mandando na projeção.
        dias_restantes: null,
        atualizado_em: agora,
      })
    }
    if (linhas.length) {
      // Histórico para as curvas (Leva 1): uma linha por atividade aplicada, na data do RDO.
      // Grava ANTES do exec: se falhar, o exec não muda e repetir grava os dois
      // (uma duplicata no retry tem a mesma data e %, e a curva a absorve).
      const { error: errH } = await supabase.from('obras_atividade_status_hist').insert(
        linhas.map((l) => ({
          obra_id: obraId,
          numero: l.numero,
          data_status: data,
          percentual: l.percentual,
          dias_restantes: null,
          status: l.status,
          origem: 'diario',
        })),
      )
      if (errH) return erroBanco('gravar o histórico do avanço', errH)
      const { error } = await supabase.from('obras_atividade_exec').upsert(linhas, { onConflict: 'obra_id,numero' })
      if (error) return erroBanco('aplicar o avanço no cronograma', error)
    }

    // validado_por/validado_em: o trigger OBRAS_RDO_ESTADO grava (e-mail da sessão, now()).
    const { data: validado, error: errV } = await supabase
      .from('obras_rdo')
      .update({ estado: 'validado', atualizado_em: agora })
      .eq('id', rdo.id)
      .eq('estado', 'rascunho')
      .select('validado_por, validado_em')
      .maybeSingle()
    if (errV) return errV.code === '42501' ? falha(SO_ENGENHEIRO) : erroBanco('validar o diário', errV)
    if (!validado) return falha(JA_VALIDADO) // outra pessoa validou no meio do caminho
    estado = 'validado'
    validadoPor = ((validado as Linha).validado_por as string | null) ?? email
    validadoEm = ((validado as Linha).validado_em as string | null) ?? agora
    revalidar(obraId)
  }

  const [destR, envR] = await Promise.all([
    supabase
      .from('obras_destinatario')
      .select('email, lado')
      .eq('obra_id', obraId)
      .eq('ativo', true)
      .contains('tipos', ['diario']),
    supabase.from('obras_envio').select('lado, destinatarios').eq('rdo_id', rdo.id),
  ])
  if (destR.error) return falha(`${VALIDADO_MAS}: não deu para ler os destinatários (${destR.error.message})`)
  if (envR.error) return falha(`${VALIDADO_MAS}: não deu para ler os envios anteriores (${envR.error.message})`)
  // Quem já recebeu este diário (destinatarios de obras_envio = só os aceitos).
  const jaRecebeu = (lado: string) =>
    new Set(
      ((envR.data ?? []) as Linha[])
        .filter((e) => e.lado === lado)
        .flatMap((e) => ((e.destinatarios ?? []) as string[]).map((x) => x.trim().toLowerCase())),
    )
  const doLado = (lado: string) =>
    ((destR.data ?? []) as Linha[])
      .filter((d) => d.lado === lado)
      .map((d) => String(d.email ?? '').trim())
      .filter(Boolean)
  const cadastrados = { cliente: doLado('cliente'), interno: doLado('interno') }
  if (!cadastrados.cliente.length) return falha(SEM_DESTINATARIO_CLIENTE)
  const pendentes = {
    cliente: cadastrados.cliente.filter((x) => !jaRecebeu('cliente').has(x.toLowerCase())),
    interno: cadastrados.interno.filter((x) => !jaRecebeu('interno').has(x.toLowerCase())),
  }
  if (!pendentes.cliente.length && !pendentes.interno.length) {
    // Tudo já entregue, mas o RDO ficou em 'validado' (ex.: envio do cliente ok e RDO não atualizado): fecha.
    if (estado === 'validado' && jaRecebeu('cliente').size > 0) {
      const { error } = await supabase
        .from('obras_rdo')
        .update({ estado: 'enviado', atualizado_em: new Date().toISOString() })
        .eq('id', rdo.id)
        .eq('estado', 'validado')
      if (error) return falha(`${VALIDADO_MAS}: não deu para marcar o diário como enviado (${error.message})`)
      revalidar(obraId)
    }
    return { ok: true, enviados: 0 }
  }

  // Leitura de novo: o e-mail mostra o cronograma já com o avanço do dia.
  const relida = await lerObraGrande(supabase, obraId, data)
  if (!relida.ok) return falha(`${VALIDADO_MAS}: ${relida.erro}`)

  // Fotos por CID (URL assinada expira; spec §5.4). Admin só para baixar do bucket.
  const linhasFoto = ((foR.data ?? []) as Linha[]).slice(0, MAX_FOTOS)
  const anexos: { cid: string; nome: string; conteudo: Buffer }[] = []
  const fotosCid: { cid: string; legenda: string | null }[] = []
  let fotosOmitidas = 0
  if (linhasFoto.length) {
    const bucket = createAdminClient().storage.from('obras-fotos')
    for (const [i, f] of linhasFoto.entries()) {
      const { data: blob, error } = await bucket.download(String(f.path))
      const conteudo = blob && !error ? Buffer.from(await blob.arrayBuffer()) : null
      if (!conteudo || conteudo.length > MAX_BYTES_FOTO) {
        console.warn(`[diario-obra] foto omitida ${f.path}: ${error?.message ?? `${conteudo?.length ?? 0} bytes`}`)
        fotosOmitidas++
        continue
      }
      const cid = `foto${i + 1}.${rdo.id}@manfac`
      anexos.push({ cid, nome: `foto-${i + 1}.jpg`, conteudo })
      fotosCid.push({ cid, legenda: (f.legenda as string | null) ?? null })
    }
  }

  const rdoCompleto: RdoCompleto = {
    id: String(rdo.id),
    data,
    semExecucao: !!rdo.sem_execucao,
    motivoSemExecucao: (rdo.motivo_sem_execucao as string | null) ?? null,
    programacaoAmanha: (rdo.programacao_amanha as string | null) ?? null,
    clima: (rdo.clima as RdoCompleto['clima']) ?? null,
    climaManha: (rdo.clima_manha as RdoCompleto['clima']) ?? null,
    climaTarde: (rdo.clima_tarde as RdoCompleto['clima']) ?? null,
    avancos,
  }
  const diaN = diasUteisEntre(obra.data_base ?? data, data, relida.dados.feriados)

  let enviados = 0
  let clienteRecebeu = false
  const falhas: string[] = []
  const erros: string[] = []
  for (const lado of ['cliente', 'interno'] as const) {
    const para = pendentes[lado]
    if (!para.length) continue
    const msg = montarEmailDiario({
      lado, obra: relida.dados, rdo: rdoCompleto, validadoPor, validadoEm, diaN, fotosCid, fotosOmitidas,
    })
    const r = await enviarEmail({ para, ...msg, anexos })
    enviados += r.aceitos.length
    if (lado === 'cliente' && r.aceitos.length) clienteRecebeu = true
    const detalhe = r.falhas.length ? `Falhou: ${r.falhas.map((f) => `${f.para} (${f.erro})`).join(', ')}` : null
    if (detalhe) falhas.push(`${lado} — ${detalhe}`)
    // enviado_por vem do JWT (trigger obras_envio_autor).
    const { error } = await supabase.from('obras_envio').insert({
      obra_id: obraId,
      tipo: 'diario',
      referencia: data,
      rdo_id: rdo.id,
      lado,
      destinatarios: r.aceitos,
      resultado: r.falhas.length ? 'falha' : 'ok',
      detalhe,
    })
    if (error) erros.push(`registro do envio (${lado}) falhou: ${error.message}`)
  }

  if (clienteRecebeu && estado === 'validado') {
    const { error } = await supabase
      .from('obras_rdo')
      .update({ estado: 'enviado', atualizado_em: new Date().toISOString() })
      .eq('id', rdo.id)
      .eq('estado', 'validado')
    if (error) erros.push(`não deu para marcar o diário como enviado (${error.message})`)
  }
  revalidar(obraId)

  const problemas = [...falhas, ...erros]
  if (enviados === 0) return falha(`${VALIDADO_MAS}: ${problemas.join(' · ')}`)
  if (problemas.length) {
    return { ok: false, erro: `Enviado a ${enviados} destinatário(s), mas: ${problemas.join(' · ')}`, enviados }
  }
  return { ok: true, enviados }
}
