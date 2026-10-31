/**
 * Composição da "Situação para o cliente" (Leva 5 §7, Task 6). O analista
 * (`analista.ts`) pergunta; aqui o agente compõe, a partir SÓ de:
 *   - números do lado cliente (`numerosDoCliente`: avanço, entrega, quebra do
 *     atraso com oculto que não é da Manfac em "outros fatores");
 *   - respostas do engenheiro NÃO internas (`respostasParaCliente`), cada uma
 *     com o fato em versão cliente.
 * Mesmo modelo e parâmetros da IA do semanal (`ia-semanal.ts`): claude-opus-5-5,
 * effort low, fallback do servidor; saída estruturada JSON validada por
 * `validarSituacao(…, 'ia')` antes de voltar ao formulário. Recusa ou saída
 * inválida → mensagem amigável. Sem `ANTHROPIC_API_KEY`: rascunho simples
 * juntando as respostas. Nada é salvo aqui: o engenheiro revisa e publica.
 */
import Anthropic from '@anthropic-ai/sdk'
import { dataBr, pct, quebraDoAtraso, textoDesvio } from './email-diario'
import { iaDisponivel } from './ia-semanal'
import type { ObraGrande } from './leitura'
import { LIMITES_SITUACAO, validarSituacao, type SituacaoTexto } from './situacao'

export { iaDisponivel }

const RECUSOU = 'A IA não quis escrever a situação para estes dados. Escreva à mão.'
const FALHOU = 'Não deu para falar com a IA agora. Tente de novo em instantes ou escreva à mão.'
const INVALIDA = 'A IA devolveu um texto fora do formato. Tente de novo ou escreva à mão.'

export const INSTRUCOES_SITUACAO = `Você é o agente que escreve a "Situação para o cliente" de uma obra da Manfac Facilities. O texto aparece na página da obra que o cliente acompanha e nos relatórios enviados a ele.
Use só os números e as respostas do engenheiro fornecidos. Não invente fatos, datas nem números.
Escreva em português do Brasil, em tom profissional, direto e transparente, como neste exemplo: "O atraso é de responsabilidade da Manfac: o porcelanato do salão chegou 6 dias úteis depois da data combinada com o nosso fornecedor, e o assentamento começou tarde. Já colocamos uma segunda frente aos sábados para recuperar parte desse tempo."
"explicacao": de 2 a 4 frases. Quando o atraso ou o problema for da Manfac, diga claramente que é "responsabilidade da Manfac". Explique o motivo sem citar áreas, setores ou equipes internas da Manfac (compras, suprimentos, RH, nomes de pessoas). Quando depender do cliente, diga com respeito o que depende dele.
"acoes": até 5 ações de recuperação que constem nas respostas, cada uma com "oque" (o que está sendo feito), "quando" (data ou prazo) e "efeito" (efeito esperado, por exemplo "recupera cerca de 2 dias úteis"). Sem ação nas respostas, devolva a lista vazia.
Nunca mencione valores, dinheiro, custos ou R$. Não use markdown nem emoji.`

/** Esquema da saída estruturada (a validação estrita vem depois, em `validarSituacao`). */
export const ESQUEMA_SITUACAO = {
  type: 'object',
  properties: {
    explicacao: { type: 'string' },
    acoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { oque: { type: 'string' }, quando: { type: 'string' }, efeito: { type: 'string' } },
        required: ['oque', 'quando', 'efeito'],
        additionalProperties: false,
      },
    },
  },
  required: ['explicacao', 'acoes'],
  additionalProperties: false,
} as const

export type RespostaCliente = { fato: string; resposta: string }

/** Números do lado cliente, em frases curtas (o mesmo vocabulário dos e-mails). */
export function numerosDoCliente(og: ObraGrande, hoje: string): string[] {
  const c = og.calc
  if (!c) return ['Cronograma ainda não publicado.']
  const quebra = og.terminoBase ? quebraDoAtraso('cliente', og, hoje) : ''
  return [
    `Avanço realizado: ${pct(c.realizado)}; previsto até hoje: ${pct(c.previsto)} (${textoDesvio(c.desvioPP)}).`,
    `Entrega prevista: ${dataBr(c.terminoProjetado)}${og.terminoBase ? `; na base: ${dataBr(og.terminoBase)}` : ''}.`,
    quebra ? `Atraso da entrega por responsável: ${quebra}.` : 'Sem atraso da entrega em relação à base.',
  ]
}

/** Entrada do agente: só números do cliente + respostas não internas. */
export function entradaDaIa(p: { loja: string; numeros: string[]; respostas: RespostaCliente[] }): string {
  return [
    `Obra: ${p.loja}`,
    '',
    'NÚMEROS DA OBRA',
    ...p.numeros.map((n) => `- ${n}`),
    '',
    'PONTOS EXPLICADOS PELO ENGENHEIRO',
    ...(p.respostas.length ? p.respostas.flatMap((r) => [`- Ponto: ${r.fato}`, `  Resposta: ${r.resposta}`]) : ['- Nenhum ponto respondido.']),
  ].join('\n')
}

const comPonto = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`)

/** Sem chave de IA: junta os números principais e as respostas, para o engenheiro revisar. */
export function rascunhoSimples(p: { numeros: string[]; respostas: RespostaCliente[] }): SituacaoTexto {
  const partes = [p.numeros[0], ...p.respostas.map((r) => comPonto(r.resposta.trim()))].filter(Boolean)
  let explicacao = partes.join(' ')
  if (explicacao.length > LIMITES_SITUACAO.explicacao) explicacao = `${explicacao.slice(0, LIMITES_SITUACAO.explicacao - 1).trimEnd()}…`
  return { explicacao, acoes: [] }
}

export async function comporSituacao(p: {
  loja: string
  numeros: string[]
  respostas: RespostaCliente[]
}): Promise<{ ok: true; situacao: SituacaoTexto; origem: 'ia' | 'simples' } | { ok: false; erro: string }> {
  if (!iaDisponivel()) return { ok: true, situacao: rascunhoSimples(p), origem: 'simples' }
  try {
    const client = new Anthropic()
    const r = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1500,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_SITUACAO as unknown as Record<string, unknown> } },
      system: INSTRUCOES_SITUACAO,
      messages: [{ role: 'user', content: entradaDaIa(p) }],
    })
    if (r.stop_reason === 'refusal') return { ok: false, erro: RECUSOU }
    const texto = r.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('')
      .trim()
    let json: unknown
    try {
      json = JSON.parse(texto)
    } catch {
      return { ok: false, erro: INVALIDA }
    }
    const v = validarSituacao(json, 'ia')
    if (!v.ok) return { ok: false, erro: INVALIDA }
    return { ok: true, situacao: v.situacao, origem: 'ia' }
  } catch (e) {
    console.warn(`[ia-situacao] ${e instanceof Error ? e.message : 'erro'}`)
    return { ok: false, erro: FALHOU }
  }
}
