import { CLIENTES_QUE_LIBERAM_POR_EMAIL, podeEnviarParaFaturamento } from '../_lib/faturamento-liberado'

const base = { etapa: 'andamento', cliente: 'PROFARMA', cancelado_em: null, fat_enviado_em: null } as const

describe('podeEnviarParaFaturamento', () => {
  it.each(['andamento', 'fecharOS', 'pendFat'] as const)('true para cliente comum em %s', (etapa) => {
    expect(podeEnviarParaFaturamento({ ...base, etapa })).toBe(true)
  })

  it('lista os clientes que liberam por e-mail', () => {
    expect(CLIENTES_QUE_LIBERAM_POR_EMAIL).toEqual(['DPSP', 'D1000'])
  })

  it.each(['DPSP', ' dpsp ', 'D1000', null])('false para cliente %p', (cliente) => {
    expect(podeEnviarParaFaturamento({ ...base, cliente })).toBe(false)
  })

  it('false para obra faturada', () => {
    expect(podeEnviarParaFaturamento({ ...base, etapa: 'faturado' })).toBe(false)
  })

  it('false para obra cancelada', () => {
    expect(podeEnviarParaFaturamento({ ...base, cancelado_em: '2026-10-01T10:00:00Z' })).toBe(false)
  })

  it('false para obra já enviada', () => {
    expect(podeEnviarParaFaturamento({ ...base, fat_enviado_em: '2026-10-01T10:00:00Z' })).toBe(false)
  })
})
