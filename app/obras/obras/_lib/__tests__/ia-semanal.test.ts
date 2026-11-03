/**
 * @jest-environment node
 *
 * IA do semanal (SDK mockado): sem chave não chama; refusal vira mensagem
 * amigável; resposta cortada também; os parâmetros (modelo, effort) vão na chamada.
 */
const createMock = jest.fn()
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ responses: { create: (...a: unknown[]) => createMock(...a) } })),
}))

import { INSTRUCOES, iaDisponivel, sugerirObservacoes } from '../ia-semanal'

const ORIGINAL = process.env.OPENAI_API_KEY

beforeEach(() => {
  createMock.mockReset()
  process.env.OPENAI_API_KEY = 'sk-teste'
})
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.OPENAI_API_KEY
  else process.env.OPENAI_API_KEY = ORIGINAL
})

describe('sugerirObservacoes', () => {
  it('sem OPENAI_API_KEY: indisponível e não chama o SDK', async () => {
    delete process.env.OPENAI_API_KEY
    expect(iaDisponivel()).toBe(false)
    const r = await sugerirObservacoes('dados')
    expect(r.ok).toBe(false)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('devolve o texto e usa o modelo e effort low', async () => {
    createMock.mockResolvedValue({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '  A obra seguiu no ritmo.  ' }] }] })
    const r = await sugerirObservacoes('PPC 80%')
    expect(r).toEqual({ ok: true, texto: 'A obra seguiu no ritmo.' })
    const [args] = createMock.mock.calls[0]
    expect(args).toMatchObject({
      model: 'gpt-5.4-mini',
      max_output_tokens: 4000,
      reasoning: { effort: 'low' },
      instructions: INSTRUCOES,
    })
    expect(args.text).toBeUndefined()
    expect(args.input).toContain('PPC 80%')
  })

  it('refusal: mensagem amigável, sem ler o texto', async () => {
    createMock.mockResolvedValue({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'parcial' }, { type: 'refusal', refusal: 'não' }] }] })
    const r = await sugerirObservacoes('x')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/à mão/)
  })

  it('resposta cortada (incomplete): mensagem amigável', async () => {
    createMock.mockResolvedValue({ status: 'incomplete', output: [{ type: 'message', content: [{ type: 'output_text', text: 'A obra seg' }] }] })
    const r = await sugerirObservacoes('x')
    expect(r.ok).toBe(false)
  })

  it('OPENAI_MODEL troca o modelo', async () => {
    process.env.OPENAI_MODEL = 'outro-modelo'
    createMock.mockResolvedValue({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'ok' }] }] })
    await sugerirObservacoes('x')
    delete process.env.OPENAI_MODEL
    expect(createMock.mock.calls[0][0].model).toBe('outro-modelo')
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
