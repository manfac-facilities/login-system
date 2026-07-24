import {
  isValidEnum,
  MULTA_STATUS,
  SINISTRO_STATUS,
  PENDENCIA_STATUS,
  AUTORIZACAO_STATUS,
  VEICULO_STATUS,
} from '../enums'

describe('isValidEnum (achado B-17)', () => {
  it('aceita valores dentro do enum', () => {
    expect(isValidEnum(MULTA_STATUS, 'descontada')).toBe(true)
    expect(isValidEnum(SINISTRO_STATUS, 'encerrado')).toBe(true)
    expect(isValidEnum(PENDENCIA_STATUS, 'concluida')).toBe(true)
    expect(isValidEnum(AUTORIZACAO_STATUS, 'autorizado')).toBe(true)
    expect(isValidEnum(VEICULO_STATUS, 'manutencao')).toBe(true)
  })

  it('rejeita valores fora do enum', () => {
    expect(isValidEnum(MULTA_STATUS, 'hackeado')).toBe(false)
    expect(isValidEnum(SINISTRO_STATUS, '')).toBe(false)
    expect(isValidEnum(PENDENCIA_STATUS, 'aberto')).toBe(false) // 'aberta', não 'aberto'
    expect(isValidEnum(AUTORIZACAO_STATUS, 'autorizado ')).toBe(false) // com espaço
  })
})
