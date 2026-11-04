import {
  ARCA_LBL,
  STATUS_LBL,
  caminhoAnexoValido,
  cartoesCorretiva,
  diasParados,
  diasParadosNoMes,
  proximoStatus,
  validarAbertura,
  validarConclusao,
  type ManutencaoBase,
} from '../manutencoes'

const HOJE = '2026-11-03'
const m = (p: Partial<ManutencaoBase> = {}): ManutencaoBase => ({
  placa: 'ABC1D23', data_entrada: '2026-11-01', data_saida: null, custo: null,
  status: 'aguardando_orcamento', tirou_da_equipe: true, ...p,
})

describe('rótulos', () => {
  it('textos do mockup', () => {
    expect(STATUS_LBL.aguardando_aprovacao).toBe('Aguardando aprovação')
    expect(ARCA_LBL.motorista).toBe('Motorista (mau uso)')
  })
})

describe('proximoStatus', () => {
  it('orçamento → aprovação → conserto → (concluir)', () => {
    expect(proximoStatus('aguardando_orcamento')).toEqual({ para: 'aguardando_aprovacao', rotulo: 'Orçamento recebido: aguardando aprovação' })
    expect(proximoStatus('aguardando_aprovacao')).toEqual({ para: 'em_conserto', rotulo: 'Aprovado: carro em conserto' })
    expect(proximoStatus('em_conserto')).toBeNull()
    expect(proximoStatus('concluida')).toBeNull()
  })
})

describe('dias parados', () => {
  it('com saída: saída − entrada + 1', () => {
    expect(diasParados(m({ data_entrada: '2026-10-14', data_saida: '2026-10-16' }), HOJE)).toBe(3)
  })
  it('sem saída usa hoje', () => {
    expect(diasParados(m({ data_entrada: '2026-10-27' }), HOJE)).toBe(8)
  })
  it('no mês: só as que tiraram o carro, recortado ao mês, somado por placa', () => {
    const lista = [
      m({ placa: 'AAA', data_entrada: '2026-10-27' }), // aberta: 27..31 = 5
      m({ placa: 'BBB', data_entrada: '2026-09-28', data_saida: '2026-10-02' }), // 01..02 = 2
      m({ placa: 'BBB', data_entrada: '2026-10-10', data_saida: '2026-10-10' }), // 1 → BBB 3
      m({ placa: 'CCC', data_entrada: '2026-10-05', data_saida: '2026-10-08', tirou_da_equipe: false }),
      m({ placa: 'DDD', data_entrada: '2026-09-01', data_saida: '2026-09-05' }),
    ]
    expect(diasParadosNoMes(lista, '2026-10', HOJE)).toEqual([{ placa: 'AAA', dias: 5 }, { placa: 'BBB', dias: 3 }])
  })
  it('mês corrente vai só até hoje', () => {
    expect(diasParadosNoMes([m({ placa: 'AAA', data_entrada: '2026-10-30' })], '2026-11', HOJE)).toEqual([{ placa: 'AAA', dias: 3 }])
  })
})

describe('cartoesCorretiva', () => {
  it('em aberto, com carro parado, custo do mês e serviços com valor', () => {
    const lista = [
      m({ status: 'aguardando_aprovacao' }),
      m({ status: 'aguardando_orcamento', tirou_da_equipe: false, data_entrada: '2026-11-02', custo: 200 }),
      m({ status: 'concluida', data_entrada: '2026-11-01', data_saida: '2026-11-02', custo: 640.5 }),
      m({ status: 'concluida', data_entrada: '2026-10-05', data_saida: '2026-10-08', custo: 900 }),
    ]
    expect(cartoesCorretiva(lista, 1, HOJE)).toEqual({
      emAberto: 2, comCarroParado: 1, custoMes: 840.5, servicosComValor: 2, carrosParados: 1,
    })
  })
})

describe('validarAbertura', () => {
  const ok = { veiculo_id: 'v1', defeito: 'Embreagem', data_entrada: '2026-11-03', saida_prevista: '2026-11-06' }
  it('mensagens do mockup', () => {
    expect(validarAbertura({ ...ok, veiculo_id: '' })).toBe('Escolha o veículo.')
    expect(validarAbertura({ ...ok, defeito: '  ' })).toBe('Descreva o defeito.')
    expect(validarAbertura({ ...ok, data_entrada: '' })).toBe('Informe a data de entrada.')
    expect(validarAbertura({ ...ok, saida_prevista: '2026-11-01' })).toBe('A saída prevista não pode ser antes da entrada.')
    expect(validarAbertura({ ...ok, saida_prevista: '' })).toBeNull()
    expect(validarAbertura(ok)).toBeNull()
  })
})

describe('validarConclusao', () => {
  const ok = { data_saida: '2026-11-03', custo: '0', quem_arca: 'locadora' }
  it('mensagens', () => {
    expect(validarConclusao({ ...ok, data_saida: '' }, { data_entrada: '2026-11-01' })).toBe('Informe a saída real.')
    expect(validarConclusao({ ...ok, custo: '' }, { data_entrada: '2026-11-01' })).toBe('Informe o custo final (pode ser zero).')
    expect(validarConclusao({ ...ok, custo: '-1' }, { data_entrada: '2026-11-01' })).toBe('Informe o custo final (pode ser zero).')
    expect(validarConclusao({ ...ok, quem_arca: '' }, { data_entrada: '2026-11-01' })).toBe('Informe quem arca com o custo.')
    expect(validarConclusao({ ...ok, quem_arca: 'xyz' }, { data_entrada: '2026-11-01' })).toBe('Informe quem arca com o custo.')
    expect(validarConclusao({ ...ok, data_saida: '2026-10-30' }, { data_entrada: '2026-11-01' })).toBe('A saída real não pode ser antes da entrada.')
    expect(validarConclusao(ok, { data_entrada: '2026-11-01' })).toBeNull()
  })
})

describe('caminhoAnexoValido', () => {
  const id = '11111111-2222-4333-8444-555555555555'
  it('só manutencoes/<id>/<arquivo>', () => {
    expect(caminhoAnexoValido(id, `manutencoes/${id}/1730000000-nota.pdf`)).toBe(true)
    expect(caminhoAnexoValido(id, `manutencoes/outro/1730000000-nota.pdf`)).toBe(false)
    expect(caminhoAnexoValido(id, `manutencoes/${id}/../x/nota.pdf`)).toBe(false)
    expect(caminhoAnexoValido(id, `manutencoes/${id}/sub/nota.pdf`)).toBe(false)
    expect(caminhoAnexoValido(id, `manutencoes/${id}/`)).toBe(false)
    expect(caminhoAnexoValido(id, `documentos/${id}/nota.pdf`)).toBe(false)
    expect(caminhoAnexoValido('', `manutencoes//nota.pdf`)).toBe(false)
  })
})
