/**
 * Rascunho das "observações da engenharia" do semanal com IA (Leva 3 §2.3).
 * Opcional: sem `ANTHROPIC_API_KEY` no servidor o botão não aparece e a
 * action recusa. Recebe SÓ o resumo do lado cliente (`resumoParaIa`); o texto
 * volta para o campo e o engenheiro revisa — nada é salvo nem enviado aqui.
 */
import Anthropic from '@anthropic-ai/sdk'

export const iaDisponivel = () => !!process.env.ANTHROPIC_API_KEY?.trim()

export const SEM_IA = 'Sugestão com IA indisponível neste servidor'
const RECUSOU = 'A IA não quis escrever um texto para estes dados. Escreva as observações à mão.'
const FALHOU = 'Não deu para falar com a IA agora. Tente de novo em instantes ou escreva à mão.'

export const INSTRUCOES = `Você escreve as "observações da engenharia" do relatório semanal de uma obra que a Manfac Facilities envia ao coordenador do cliente.
Escreva em português do Brasil, de 1 a 3 parágrafos curtos, em tom profissional e objetivo, como o engenheiro responsável.
Use só os dados fornecidos. Comente os desvios de avanço e de prazo, os gargalos da semana (itens não cumpridos, impedimentos, decisões pendentes do cliente) e as ações de recuperação para a próxima semana.
Nunca mencione valores, dinheiro, custos ou R$. Nunca cite áreas, equipes ou problemas internos da Manfac; quando a causa for da Manfac, diga apenas "Manfac".
Não use títulos, listas, markdown nem emoji. Responda só com o texto das observações.`

export async function sugerirObservacoes(resumo: string): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  if (!iaDisponivel()) return { ok: false, erro: SEM_IA }
  try {
    const client = new Anthropic()
    const r = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1200, // ~5 mil caracteres: cabe em MAX_OBSERVACOES
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: INSTRUCOES,
      messages: [{ role: 'user', content: `Dados da semana:\n\n${resumo}` }],
    })
    if (r.stop_reason === 'refusal') return { ok: false, erro: RECUSOU }
    const texto = r.content
      .flatMap((b) => (b.type === 'text' ? [b.text] : []))
      .join('\n')
      .trim()
    if (!texto) return { ok: false, erro: FALHOU }
    return { ok: true, texto }
  } catch (e) {
    console.warn(`[ia-semanal] ${e instanceof Error ? e.message : 'erro'}`)
    return { ok: false, erro: FALHOU }
  }
}
