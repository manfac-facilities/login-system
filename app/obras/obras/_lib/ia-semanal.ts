/**
 * Rascunho das "observações da engenharia" com IA — semanal (Leva 3 §2.3) e
 * relatórios de período (Leva 4 §2.1: mensal, fase, entrega). Opcional: sem
 * `OPENAI_API_KEY` no servidor o botão não aparece e a action recusa.
 * Recebe SÓ o resumo do lado cliente (`resumoParaIa` / `resumoPeriodoParaIa`);
 * o texto volta para o campo e o engenheiro revisa — nada é salvo nem enviado aqui.
 */
import OpenAI from 'openai'

export const iaDisponivel = () => !!process.env.OPENAI_API_KEY?.trim()

/** Modelo escolhido pelo José em 01/11/2026; `OPENAI_MODEL` troca sem deploy de código. */
export const modeloIa = () => process.env.OPENAI_MODEL?.trim() || 'gpt-5.4-mini'

/**
 * Uma chamada à Responses API da OpenAI, compartilhada com `ia-situacao.ts`.
 * `max_output_tokens` inclui o raciocínio do modelo, por isso a folga. Recusa
 * (parte `refusal`) volta como `recusa`; resposta cortada ou sem texto, como
 * `vazio`; erro de rede sobe para quem chamou.
 */
export async function pedirAoModelo(p: {
  instrucoes: string
  entrada: string
  esquema?: { nome: string; schema: Record<string, unknown> }
}): Promise<{ tipo: 'texto'; texto: string } | { tipo: 'recusa' } | { tipo: 'vazio' }> {
  const r = await new OpenAI().responses.create({
    model: modeloIa(),
    max_output_tokens: 4000,
    reasoning: { effort: 'low' },
    instructions: p.instrucoes,
    input: p.entrada,
    ...(p.esquema ? { text: { format: { type: 'json_schema' as const, name: p.esquema.nome, schema: p.esquema.schema, strict: true } } } : {}),
  })
  const partes = r.output.flatMap((o) => (o.type === 'message' ? o.content : []))
  if (partes.some((c) => c.type === 'refusal')) return { tipo: 'recusa' }
  if (r.status !== 'completed') return { tipo: 'vazio' }
  const texto = partes
    .flatMap((c) => (c.type === 'output_text' ? [c.text] : []))
    .join('\n')
    .trim()
  return texto ? { tipo: 'texto', texto } : { tipo: 'vazio' }
}

export const SEM_IA = 'Sugestão com IA indisponível neste servidor'
const RECUSOU = 'A IA não quis escrever um texto para estes dados. Escreva as observações à mão.'
const FALHOU = 'Não deu para falar com a IA agora. Tente de novo em instantes ou escreva à mão.'

const REGRAS = `Nunca mencione valores, dinheiro, custos ou R$. Nunca cite áreas, equipes ou problemas internos da Manfac; quando a causa for da Manfac, diga apenas "Manfac".
Não use títulos, listas, markdown nem emoji. Responda só com o texto das observações.`

export const INSTRUCOES = `Você escreve as "observações da engenharia" do relatório semanal de uma obra que a Manfac Facilities envia ao coordenador do cliente.
Escreva em português do Brasil, de 1 a 3 parágrafos curtos, em tom profissional e objetivo, como o engenheiro responsável.
Use só os dados fornecidos. Comente os desvios de avanço e de prazo, os gargalos da semana (itens não cumpridos, impedimentos, decisões pendentes do cliente) e as ações de recuperação para a próxima semana.
${REGRAS}`

const NOME_PERIODO = { mensal: 'relatório mensal', fase: 'relatório de fase (conclusão de uma etapa)', entrega: 'relatório de entrega' } as const

/** Instruções do relatório de período: mesmas regras do semanal (sem R$, sem área interna). */
export const instrucoesPeriodo = (tipo: keyof typeof NOME_PERIODO) => `Você escreve as "observações da engenharia" do ${NOME_PERIODO[tipo]} de uma obra que a Manfac Facilities envia ao coordenador do cliente.
Escreva em português do Brasil, de 1 a 3 parágrafos curtos, em tom profissional e objetivo, como o engenheiro responsável.
Use só os dados fornecidos. Comente o avanço e o prazo no período, os marcos e destaques, os gargalos (impedimentos, decisões pendentes do cliente) e os próximos passos.
${REGRAS}`

export async function sugerirObservacoes(
  resumo: string,
  alvo: { instrucoes: string; dados: string } = { instrucoes: INSTRUCOES, dados: 'Dados da semana' },
): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  if (!iaDisponivel()) return { ok: false, erro: SEM_IA }
  try {
    const r = await pedirAoModelo({ instrucoes: alvo.instrucoes, entrada: `${alvo.dados}:\n\n${resumo}` })
    if (r.tipo === 'recusa') return { ok: false, erro: RECUSOU }
    if (r.tipo === 'vazio') return { ok: false, erro: FALHOU }
    return { ok: true, texto: r.texto }
  } catch (e) {
    console.warn(`[ia-semanal] ${e instanceof Error ? e.message : 'erro'}`)
    return { ok: false, erro: FALHOU }
  }
}
