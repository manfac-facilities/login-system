'use server'

/**
 * Server Actions dos relatórios de período (Leva 4 §2.1: mensal, fase,
 * entrega). Tudo só para o engenheiro da obra ou administrador (o trigger
 * OBRAS_RELATORIO e a guarda de `obras_envio` no banco exigem o mesmo). Guarda
 * falha fechada; tipo e referência conferidos com regex estrita; a obra é
 * relida do banco pela sessão (RLS) — o id do navegador só escolhe qual.
 *
 * - Salvar rascunho: observações, highlights automáticos DESMARCADOS (os ids do
 *   período que o navegador não mandou como marcados) e o highlight livre; só em rascunho e só com o
 *   relatório disponível (fase: etapa concluída; entrega: obra concluída).
 * - Sugerir com IA: só devolve o texto para o campo; não grava nem envia.
 * - Validar e enviar: mensal só a partir da data da agenda (último dia útil do
 *   mês, feriados da obra); valida o que está SALVO, congela cliente/interno/fotos em
 *   `obras_relatorio.conteudo` e manda a versão cliente aos destinatários do
 *   cliente e a interna aos internos (PDF cliente anexo). Mensal → tipo
 *   `mensal`; fase e entrega → `semanal` OU `mensal`. Um `obras_envio` por lado
 *   (tipo do relatório, `relatorio_id`, `referencia` = data do envio);
 *   `enviado` quando o cliente recebeu. Já validado → só a quem falta.
 *
 * Sem `export type` aqui — tipos em `_tipos.ts`.
 */

import { revalidatePath } from 'next/cache'
import { hojeISO } from '../../../../../../_lib/tipos'
import { montarEmailPeriodo, resumoPeriodoParaIa } from '../../../../../_lib/email-periodo'
import { autorizarEngenheiroDaObra } from '../../../../../_lib/autorizar-relatorio'
import { enviarEmail } from '../../../../../_lib/enviar'
import { SEM_IA, iaDisponivel, instrucoesPeriodo, sugerirObservacoes } from '../../../../../_lib/ia-semanal'
import {
  congelarPeriodo,
  conteudoPeriodoDe,
  dadosPdfPeriodo,
  lerDadosPeriodo,
  relatorioRowDe,
  relatorioValido,
  renderizarPeriodo,
  validacaoLiberadaEm,
} from '../../../../../_pdf/carregar-periodo'
import { MAX_HIGHLIGHT_LIVRE, MAX_OBSERVACOES, type EntradaRascunho, type Resultado, type ResultadoEnvio, type ResultadoIa } from './_tipos'

const SO_ENGENHEIRO = 'Só o engenheiro responsável da obra ou um administrador mexe no relatório'
const JA_VALIDADO = 'Relatório já validado — o conteúdo não muda mais'
const SEM_RASCUNHO = 'Salve o rascunho antes de validar'
const INVALIDO = 'Relatório inválido'
const VALIDADO_MAS = 'Relatório validado, mas o e-mail não saiu'

type Erro = { ok: false; erro: string }
type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Lado = 'cliente' | 'interno'

const falha = (erro: string): Erro => ({ ok: false, erro })

function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.code === '42501' || e.message.includes('row-level security')) return falha(SO_ENGENHEIRO)
  if (e.message.includes('OBRAS_RELATORIO')) return falha(JA_VALIDADO)
  if (e.code === '23505') return falha('Outra pessoa criou este relatório agora. Recarregue a página.')
  return falha(`Não foi possível ${acao}. Tente de novo em instantes. (${e.message})`)
}

/** Sessão + acesso obras/admin + obra OBRA lida pela sessão + engenheiro da obra ou admin (`autorizar-relatorio.ts`). */
const autorizar = (obraId: string) => autorizarEngenheiroDaObra(obraId, { soEngenheiro: SO_ENGENHEIRO, erroBanco })

const revalidar = (obraId: string, tipo: string, referencia: string) => {
  revalidatePath(`/obras/obras/${obraId}/comunicacao/relatorio/${tipo}/${referencia}`)
  revalidatePath(`/obras/obras/${obraId}/comunicacao`)
}

export async function salvarRascunhoRelatorioAction(
  obraId: string,
  tipo: string,
  referencia: string,
  entrada: EntradaRascunho,
): Promise<Resultado> {
  const a = await autorizar(obraId)
  if ('ok' in a) return a
  if (!relatorioValido(tipo, referencia)) return falha(INVALIDO)
  const x = (entrada ?? {}) as Partial<EntradaRascunho>
  const observacoes = (typeof x.observacoes === 'string' ? x.observacoes : '').trim()
  const livre = (typeof x.livre === 'string' ? x.livre : '').trim()
  if (observacoes.length > MAX_OBSERVACOES) return falha(`Observações longas demais (até ${MAX_OBSERVACOES.toLocaleString('pt-BR')} caracteres)`)
  if (livre.length > MAX_HIGHLIGHT_LIVRE) return falha(`Destaque livre longo demais (até ${MAX_HIGHLIGHT_LIVRE} caracteres)`)
  if (!Array.isArray(x.marcados) || !x.marcados.every((m) => typeof m === 'string')) return falha('Seleção de destaques inválida')

  const l = await lerDadosPeriodo(a.supabase, a.obraId, tipo, referencia, hojeISO())
  if (!l.ok) return falha(l.erro)
  const d = l.dados
  if (d.relatorio && d.relatorio.estado !== 'rascunho') return falha(JA_VALIDADO)
  // Grava os automáticos do período que NÃO vieram marcados: id inventado pelo navegador não entra,
  // e destaque que surgir depois (mês corrente) nasce marcado.
  const marcados = new Set(x.marcados)
  const highlights = { desmarcados: d.automaticos.map((h) => h.id).filter((id) => !marcados.has(id)), livre: livre || null }
  const campos = { observacoes: observacoes || null, highlights, periodo_inicio: d.inicio, periodo_fim: d.fim }

  if (d.relatorio) {
    const { data, error } = await a.supabase
      .from('obras_relatorio')
      .update(campos)
      .eq('id', d.relatorio.id)
      .eq('obra_id', a.obraId)
      .eq('estado', 'rascunho')
      .select('id')
      .maybeSingle()
    if (error) return erroBanco('salvar o rascunho', error)
    if (!data) return falha(JA_VALIDADO)
  } else {
    const { error } = await a.supabase.from('obras_relatorio').insert({ obra_id: a.obraId, tipo, referencia, ...campos })
    if (error) return erroBanco('salvar o rascunho', error)
  }
  revalidar(a.obraId, tipo, referencia)
  return { ok: true }
}

/** Rascunho das observações com IA, a partir SÓ do conteúdo do cliente (com o que está salvo). Não grava. */
export async function sugerirObservacoesRelatorioIaAction(obraId: string, tipo: string, referencia: string): Promise<ResultadoIa> {
  const a = await autorizar(obraId)
  if ('ok' in a) return a
  if (!relatorioValido(tipo, referencia)) return falha(INVALIDO)
  if (!iaDisponivel()) return falha(SEM_IA)
  const l = await lerDadosPeriodo(a.supabase, a.obraId, tipo, referencia, hojeISO())
  if (!l.ok) return falha(l.erro)
  return sugerirObservacoes(resumoPeriodoParaIa(conteudoPeriodoDe(l.dados, 'cliente')), {
    instrucoes: instrucoesPeriodo(tipo),
    dados: 'Dados do período',
  })
}

export async function validarEEnviarRelatorioAction(obraId: string, tipo: string, referencia: string): Promise<ResultadoEnvio> {
  const a = await autorizar(obraId)
  if ('ok' in a) return a
  if (!relatorioValido(tipo, referencia)) return falha(INVALIDO)
  const { supabase } = a
  const hoje = hojeISO()

  // Lido do banco: o rascunho é o SALVO, nunca o do navegador. Já validado: vem o congelado.
  const l = await lerDadosPeriodo(supabase, a.obraId, tipo, referencia, hoje)
  if (!l.ok) return falha(l.erro)
  const d = l.dados
  if (!d.relatorio) return falha(SEM_RASCUNHO)
  const id = d.relatorio.id
  let estado = d.relatorio.estado

  const tiposDest = tipo === 'mensal' ? ['mensal'] : ['semanal', 'mensal']
  const { data: dest, error: errD } = await supabase
    .from('obras_destinatario')
    .select('email, lado, tipos')
    .eq('obra_id', a.obraId)
    .eq('ativo', true)
    .overlaps('tipos', tiposDest)
  if (errD) return erroBanco('ler os destinatários', errD)
  const doLado = (lado: Lado) => [
    ...new Set(
      ((dest ?? []) as Linha[])
        .filter((x) => x.lado === lado && ((x.tipos ?? []) as string[]).some((t) => tiposDest.includes(t)))
        .map((x) => String(x.email ?? '').trim())
        .filter(Boolean),
    ),
  ]
  const cadastrados = { cliente: doLado('cliente'), interno: doLado('interno') }
  if (!cadastrados.cliente.length) {
    return falha(
      `Nenhum destinatário do cliente com o tipo ${tipo === 'mensal' ? 'Mensal' : 'Semanal ou Mensal'} em Configurações da obra (peça a um administrador)`,
    )
  }

  const liberaEm = validacaoLiberadaEm(d.og, tipo, referencia)
  if (estado === 'rascunho' && liberaEm && hoje < liberaEm) {
    return falha(`O relatório mensal só pode ser validado a partir de ${liberaEm.slice(8, 10)}/${liberaEm.slice(5, 7)}/${liberaEm.slice(0, 4)} (último dia útil do mês)`)
  }

  if (estado === 'rascunho') {
    // Congela o conteúdo validado (cliente, interno, fotos): reenvio e "Abrir PDF" saem dele.
    // validado_por/validado_em: o trigger OBRAS_RELATORIO grava (e-mail da sessão, now()).
    const conteudo = await congelarPeriodo(supabase, d)
    const { data, error } = await supabase
      .from('obras_relatorio')
      .update({ estado: 'validado', conteudo, periodo_inicio: d.inicio, periodo_fim: d.fim })
      .eq('id', id)
      .eq('obra_id', a.obraId)
      .eq('estado', 'rascunho')
      .select('*')
      .maybeSingle()
    if (error) return erroBanco('validar o relatório', error)
    if (!data) return falha(JA_VALIDADO)
    estado = 'validado'
    d.relatorio = { ...relatorioRowDe(data as Linha, tipo, referencia), conteudo }
    revalidar(a.obraId, tipo, referencia)
  }

  const { data: envL, error: errE } = await supabase.from('obras_envio').select('lado, destinatarios').eq('relatorio_id', id)
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
      .from('obras_relatorio')
      .update({ estado: 'enviado' })
      .eq('id', id)
      .eq('obra_id', a.obraId)
      .eq('estado', 'validado')
    return error ? `não deu para marcar o relatório como enviado (${error.message})` : null
  }
  if (!pendentes.cliente.length && !pendentes.interno.length) {
    if (estado === 'validado' && jaRecebeu('cliente').size > 0) {
      const e = await marcarEnviado()
      if (e) return falha(`${VALIDADO_MAS}: ${e}`)
      revalidar(a.obraId, tipo, referencia)
    }
    return { ok: true, enviados: 0 }
  }

  let pdf: Buffer
  let nomeArquivo: string
  let fotos: number
  try {
    const p = await dadosPdfPeriodo(supabase, d)
    pdf = await renderizarPeriodo(p.dados)
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
    const msg = montarEmailPeriodo(conteudoPeriodoDe(d, lado), { fotos })
    const r = await enviarEmail({ para, ...msg, anexos: [{ nome: nomeArquivo, conteudo: pdf }] })
    enviados += r.aceitos.length
    if (lado === 'cliente' && r.aceitos.length) clienteRecebeu = true
    const detalhe = r.falhas.length ? `Falhou: ${r.falhas.map((f) => `${f.para} (${f.erro})`).join(', ')}` : null
    if (detalhe) problemas.push(`${lado} — ${detalhe}`)
    // enviado_por vem do JWT (trigger obras_envio_autor). referencia (date) = dia do envio; o vínculo é relatorio_id.
    const { error } = await supabase.from('obras_envio').insert({
      obra_id: a.obraId,
      tipo,
      referencia: hoje,
      relatorio_id: id,
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
  revalidar(a.obraId, tipo, referencia)

  if (enviados === 0) return falha(`${VALIDADO_MAS}: ${problemas.join(' · ')}`)
  if (problemas.length) return { ok: false, erro: `Enviado a ${enviados} destinatário(s), mas: ${problemas.join(' · ')}`, enviados }
  return { ok: true, enviados }
}
