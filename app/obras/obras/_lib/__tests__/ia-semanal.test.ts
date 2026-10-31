/**
 * @jest-environment node
 *
 * IA do semanal (SDK mockado): sem chave não chama; refusal vira mensagem
 * amigável; os parâmetros pedidos (modelo, effort, fallback) vão na chamada.
 */
const createMock = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ beta: { messages: { create: (...a: unknown[]) => createMock(...a) } } })),
}))

import { INSTRUCOES, iaDisponivel, sugerirObservacoes } from '../ia-semanal'

const ORIGINAL = process.env.ANTHROPIC_API_KEY

beforeEach(() => {
  createMock.mockReset()
  process.env.ANTHROPIC_API_KEY = 'sk-teste'
})
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = ORIGINAL
})

describe('sugerirObservacoes', () => {
  it('sem ANTHROPIC_API_KEY: indisponível e não chama o SDK', async () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(iaDisponivel()).toBe(false)
    const r = await sugerirObservacoes('dados')
    expect(r.ok).toBe(false)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('devolve o texto e usa modelo, effort low e fallback default', async () => {
    createMock.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: '  A obra seguiu no ritmo.  ' }] })
    const r = await sugerirObservacoes('PPC 80%')
    expect(r).toEqual({ ok: true, texto: 'A obra seguiu no ritmo.' })
    const [args] = createMock.mock.calls[0]
    expect(args).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 1200,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: INSTRUCOES,
    })
    expect(args.messages[0].content).toContain('PPC 80%')
  })

  it('refusal: mensagem amigável, sem ler o texto', async () => {
    createMock.mockResolvedValue({ stop_reason: 'refusal', content: [{ type: 'text', text: 'parcial' }] })
    const r = await sugerirObservacoes('x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/à mão/)
  })

  it('erro de rede: mensagem amigável', async () => {
    createMock.mockRejectedValue(new Error('ECONNRESET'))
    const r = await sugerirObservacoes('x')
    expect(r.ok).toBe(false)
  })

  it('instruções proíbem dinheiro e área interna', () => {
    expect(INSTRUCOES).toMatch(/R\$/)
    expect(INSTRUCOES).toMatch(/internos da Manfac/)
  })
})
