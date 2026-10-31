/**
 * @jest-environment node
 *
 * Situação para o cliente (Leva 5 §7, Task 6): composição pela IA (SDK
 * mockado) com os parâmetros do semanal e saída JSON validada estritamente;
 * sem chave → rascunho simples; resposta interna nunca entra no prompt;
 * validação do que vai ser publicado e do formato congelado.
 */
const createMock = jest.fn()
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ beta: { messages: { create: (...a: unknown[]) => createMock(...a) } } })),
}))

import { ESQUEMA_SITUACAO, INSTRUCOES_SITUACAO, comporSituacao, entradaDaIa, numerosDoCliente } from '../ia-situacao'
import { nomeDoEmail, situacaoParaCliente, situacaoRelatorioValida, situacaoRowDe, validarSituacao } from '../situacao'
import { pontosAExplicar, respostasParaCliente } from '../analista'
import { imp, obraGrandePdf } from '../../_pdf/__tests__/fixtures/rdo'

const ORIGINAL = process.env.ANTHROPIC_API_KEY
beforeEach(() => {
  createMock.mockReset()
  process.env.ANTHROPIC_API_KEY = 'sk-teste'
})
afterAll(() => {
  if (ORIGINAL === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = ORIGINAL
})

const BOA = {
  explicacao: 'O atraso é de responsabilidade da Manfac: o drywall levou mais tempo que o planejado. Reforçamos a equipe desde 23/11.',
  acoes: [{ oque: 'Segunda equipe de drywall', quando: 'desde 23/11', efeito: 'recupera cerca de 2 dias úteis' }],
}
const resposta = (texto: string, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text: texto }] })
const entrada = { loja: 'DP Macaé 3', numeros: ['Avanço realizado: 52%; previsto até hoje: 58% (6 p.p. abaixo do previsto).'], respostas: [{ fato: 'Avanço abaixo.', resposta: 'Segunda equipe desde 23/11' }] }

describe('comporSituacao', () => {
  it('usa o modelo e os parâmetros do semanal + saída estruturada; devolve a situação validada', async () => {
    createMock.mockResolvedValue(resposta(JSON.stringify(BOA)))
    const r = await comporSituacao(entrada)
    expect(r).toEqual({ ok: true, situacao: BOA, origem: 'ia' })
    const [args] = createMock.mock.calls[0]
    expect(args).toMatchObject({
      model: 'claude-opus-5-5',
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_SITUACAO } },
      system: INSTRUCOES_SITUACAO,
    })
    expect(INSTRUCOES_SITUACAO).toContain('responsabilidade da Manfac')
    expect(INSTRUCOES_SITUACAO).toMatch(/R\$/)
    expect(args.messages[0].content).toContain('Segunda equipe desde 23/11')
  })

  it.each([
    ['não é JSON', 'O atraso é da Manfac.'],
    ['campo a mais', JSON.stringify({ ...BOA, extra: 1 })],
    ['6 ações', JSON.stringify({ ...BOA, acoes: Array.from({ length: 6 }, () => BOA.acoes[0]) })],
    ['ação sem efeito', JSON.stringify({ ...BOA, acoes: [{ oque: 'x', quando: 'y', efeito: '' }] })],
    ['ação com campo a mais', JSON.stringify({ ...BOA, acoes: [{ ...BOA.acoes[0], area: 'suprimentos' }] })],
    ['R$ na explicação', JSON.stringify({ ...BOA, explicacao: 'Gastamos R$ 3 mil a mais com a equipe.' })],
    ['explicação longa demais', JSON.stringify({ ...BOA, explicacao: 'Frase. '.repeat(200) })],
    ['explicação vazia', JSON.stringify({ ...BOA, explicacao: '  ' })],
    ['muitas frases', JSON.stringify({ ...BOA, explicacao: 'Um. Dois. Três. Quatro. Cinco. Seis.' })],
  ])('rejeita saída inválida da IA (%s)', async (_n, texto) => {
    createMock.mockResolvedValue(resposta(texto))
    const r = await comporSituacao(entrada)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/fora do formato/)
  })

  it('recusa: mensagem amigável', async () => {
    createMock.mockResolvedValue(resposta(JSON.stringify(BOA), 'refusal'))
    const r = await comporSituacao(entrada)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/à mão/)
  })

  it('erro de rede: mensagem amigável', async () => {
    createMock.mockRejectedValue(new Error('ECONNRESET'))
    const r = await comporSituacao(entrada)
    expect(r).toEqual({ ok: false, erro: expect.stringMatching(/Tente de novo/) })
  })

  it('sem ANTHROPIC_API_KEY: rascunho simples com as respostas, sem chamar o SDK', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const r = await comporSituacao({ ...entrada, respostas: [{ fato: 'f', resposta: 'Segunda equipe desde 23/11' }, { fato: 'g', resposta: 'Material chega dia 01/12.' }] })
    expect(createMock).not.toHaveBeenCalled()
    expect(r).toEqual({
      ok: true,
      origem: 'simples',
      situacao: { explicacao: `${entrada.numeros[0]} Segunda equipe desde 23/11. Material chega dia 01/12.`, acoes: [] },
    })
  })
})

describe('entrada da IA', () => {
  it('números do lado cliente + só respostas não internas (ponto oculto e interno ficam fora)', () => {
    const og = obraGrandePdf()
    og.calc = { ...og.calc!, desvioPP: -6, realizado: 0.52, previsto: 0.58, terminoProjetado: '2026-12-28' }
    og.terminoBase = '2026-12-18'
    og.atraso = { total: 6, cliente: 0, manfac: 6, terceiro: 0, clima: 0 }
    og.impedimentos = [imp({ id: 'oc', responsavel: 'manfac', descricao: 'Pedreiro faltou sem avisar', exibirAoCliente: false, abertoEm: '2026-11-02', travaAtividade: false })]
    const pontos = pontosAExplicar({ og, hoje: '2026-11-16', restricoes: [], planos: [], ultimaPublicada: null })
    const salva = (chave: string, resposta: string, interno = false) => ({
      chave, resposta, interno, aberta: false, impressao: pontos.find((p) => p.chave === chave)!.impressao, respondidaPor: 'e', respondidaEm: 'x',
    })
    const respostas = respostasParaCliente(pontos, [
      salva('desvio:obra', 'Reforçamos a equipe.'),
      salva('entrega:obra', 'O fornecedor do setor de compras atrasou', true),
      salva('impedimento:oc', 'Pedreiro faltou de novo'),
    ])
    const txt = entradaDaIa({ loja: 'DP Macaé 3', numeros: numerosDoCliente(og, '2026-11-16'), respostas })
    expect(txt).toContain('Reforçamos a equipe.')
    expect(txt).not.toContain('setor de compras')
    expect(txt).not.toContain('Pedreiro')
    expect(txt).toContain('Entrega prevista: 28/12/2026; na base: 18/12/2026.')
    expect(txt).not.toMatch(/R\$|98765|123456/)
  })
})

describe('validarSituacao (publicar)', () => {
  it('aceita ação só com o "o quê", normaliza espaços; recusa R$ e campo desconhecido', () => {
    expect(validarSituacao({ explicacao: '  Texto.  ', acoes: [{ oque: ' Equipe extra ', quando: '', efeito: '' }] }, 'publicar')).toEqual({
      ok: true, situacao: { explicacao: 'Texto.', acoes: [{ oque: 'Equipe extra', quando: '', efeito: '' }] },
    })
    expect(validarSituacao({ explicacao: 'Custa R$ 10', acoes: [] }, 'publicar').ok).toBe(false)
    expect(validarSituacao({ explicacao: 'x', acoes: [{ oque: '', quando: 'a', efeito: 'b' }] }, 'publicar').ok).toBe(false)
    expect(validarSituacao({ explicacao: 'x', acoes: [], numeros: {} }, 'publicar').ok).toBe(false)
    expect(validarSituacao({ explicacao: 'x'.repeat(1201), acoes: [] }, 'publicar').ok).toBe(false)
  })
})

describe('situação publicada → cliente', () => {
  const linha = { versao: 3, explicacao: 'Texto.', acoes: [{ oque: 'a', quando: 'b', efeito: 'c' }], numeros: { atraso: { manfac: 4 } }, publicada_por: 'jose.guilherme@manfac.com.br', publicada_em: '2026-11-17T01:30:00Z' }

  it('data no fuso de Brasília e nome sem e-mail', () => {
    const s = situacaoRowDe(linha)!
    expect(s.numeros.atraso).toEqual({ cliente: 0, manfac: 4, terceiro: 0, clima: 0 })
    const c = situacaoParaCliente(s)
    expect(c).toEqual({ explicacao: 'Texto.', acoes: linha.acoes, atualizadoEm: '16/11/2026', por: 'Jose Guilherme' })
    expect(JSON.stringify(c)).not.toContain('@')
    expect(situacaoRelatorioValida(c)).toBe(true)
    expect(situacaoRelatorioValida({ ...c, email: 'x@y' })).toBe(false)
    expect(situacaoRelatorioValida({ ...c, explicacao: 'R$ 3' })).toBe(false)
  })

  it('linha com formato inválido não aparece', () => {
    expect(situacaoRowDe({ ...linha, acoes: 'texto' })).toBeNull()
    expect(nomeDoEmail('123@x')).toBe('Engenharia Manfac')
  })
})
