'use server'

/**
 * Actions do quadro "Analista da obra" (Leva 5 §7, Task 6). Só engenheiro da
 * obra ou administrador (`autorizarEngenheiroDaObra`, falha fechada); grava com
 * o cliente de SESSÃO (RLS, triggers e autoria forçada valem). Os pontos são
 * recalculados aqui: pergunta, contexto e impressão vêm do servidor, nunca do
 * navegador. Ponto de dado oculto ao cliente grava a resposta como interna.
 * Sem `export type` nem export não-async (arquivo `use server`).
 */
import { revalidatePath } from 'next/cache'
import { hojeISO } from '../../_lib/tipos'
import { respostasParaCliente } from '../_lib/analista'
import { autorizarEngenheiroDaObra } from '../_lib/autorizar-relatorio'
import { comporSituacao, numerosDoCliente } from '../_lib/ia-situacao'
import { numerosAtuais, validarSituacao, type SituacaoTexto } from '../_lib/situacao'
import { lerAnaliseDaObra } from './_analista-dados'

type Erro = { ok: false; erro: string }
const falha = (erro: string): Erro => ({ ok: false, erro })

const SO_ENGENHEIRO = 'Só o engenheiro responsável da obra ou um administrador responde ao analista e publica a situação'
const MAX_RESPOSTA = 2000

function erroBanco(acao: string, e: { message: string; code?: string }): Erro {
  if (e.code === '42501' || e.message.includes('row-level security')) return falha(SO_ENGENHEIRO)
  if (e.code === '23514' || e.message.includes('OBRAS_SITUACAO_ACOES')) return falha('Dados inválidos.')
  return falha(`Não foi possível ${acao}. Tente de novo em instantes.`)
}

const autorizar = (obraId: string) => autorizarEngenheiroDaObra(String(obraId ?? ''), { soEngenheiro: SO_ENGENHEIRO, erroBanco })

const revalidar = (obraId: string) => {
  revalidatePath(`/obras/obras/${obraId}`)
  revalidatePath(`/portal-obra/obras/${obraId}`)
}

export async function responderPerguntaAction(
  obraId: string,
  chave: string,
  resposta: string,
  interno: boolean,
): Promise<{ ok: true } | Erro> {
  const a = await autorizar(obraId)
  if ('ok' in a) return a
  const texto = (typeof resposta === 'string' ? resposta : '').trim()
  if (!texto) return falha('Escreva a resposta')
  if (texto.length > MAX_RESPOSTA) return falha(`Resposta longa demais (até ${MAX_RESPOSTA.toLocaleString('pt-BR')} caracteres)`)
  const l = await lerAnaliseDaObra(a.supabase, a.obraId, hojeISO())
  if (!l.ok) return falha(l.erro)
  const ponto = l.analise.pontos.find((p) => p.chave === chave)
  if (!ponto) return falha('Esta pergunta não está mais aberta. Recarregue a página.')
  const { error } = await a.supabase.from('obras_situacao_pergunta').upsert(
    {
      obra_id: a.obraId,
      chave: ponto.chave,
      pergunta: ponto.pergunta,
      contexto: { ...ponto.contexto, impressao: ponto.impressao },
      resposta: texto,
      interno: interno === true || ponto.soInterno,
      aberta: false,
    },
    { onConflict: 'obra_id,chave' },
  )
  if (error) return erroBanco('salvar a resposta', error)
  revalidar(a.obraId)
  return { ok: true }
}

/** Rascunho da situação (IA ou simples). Não grava: o engenheiro revisa e publica. */
export async function montarSituacaoAction(obraId: string): Promise<{ ok: true; situacao: SituacaoTexto; origem: 'ia' | 'simples' } | Erro> {
  const a = await autorizar(obraId)
  if ('ok' in a) return a
  const hoje = hojeISO()
  const l = await lerAnaliseDaObra(a.supabase, a.obraId, hoje)
  if (!l.ok) return falha(l.erro)
  const { og, pontos, salvas } = l.analise
  const o = og.obra
  return comporSituacao({
    loja: o.loja?.trim() || o.descricao?.trim() || o.os || 'Obra',
    numeros: numerosDoCliente(og, hoje),
    respostas: respostasParaCliente(pontos, salvas),
  })
}

/** Publica uma nova versão (imutável). Validação estrita antes de gravar. */
export async function publicarSituacaoAction(obraId: string, entrada: unknown): Promise<{ ok: true } | Erro> {
  const a = await autorizar(obraId)
  if ('ok' in a) return a
  const e = (typeof entrada === 'object' && entrada !== null ? entrada : {}) as Record<string, unknown>
  // Linha de ação totalmente vazia no formulário não conta.
  const acoes = Array.isArray(e.acoes)
    ? e.acoes.filter((x) => !(typeof x === 'object' && x !== null && ['oque', 'quando', 'efeito'].every((k) => !String((x as Record<string, unknown>)[k] ?? '').trim())))
    : e.acoes
  const v = validarSituacao({ explicacao: e.explicacao, acoes }, 'publicar')
  if (!v.ok) return falha(v.erro)
  const l = await lerAnaliseDaObra(a.supabase, a.obraId, hojeISO())
  if (!l.ok) return falha(l.erro)
  // versao e publicada_por/em: o trigger força (max+1, JWT, now()).
  const { error } = await a.supabase.from('obras_situacao_cliente').insert({
    obra_id: a.obraId,
    versao: (l.analise.publicada?.versao ?? 0) + 1,
    explicacao: v.situacao.explicacao,
    acoes: v.situacao.acoes,
    numeros: numerosAtuais(l.analise.og),
  })
  if (error) return erroBanco('publicar a situação', error)
  revalidar(a.obraId)
  return { ok: true }
}
