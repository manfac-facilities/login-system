import { gerarNomeArquivo } from '../nomeArquivo'

describe('gerarNomeArquivo', () => {
  it('formats DPSP with zero-padded date and time in America/Sao_Paulo, regardless of server timezone', () => {
    const data = new Date('2026-06-30T17:32:00Z') // 14:32 BRT (UTC-3)
    expect(gerarNomeArquivo('DPSP', data)).toBe('DPSP-convertido-20260630-1432.xlsx')
  })

  it('formats D1000 and pads single-digit day/month/hour/minute', () => {
    const data = new Date('2026-01-05T12:07:00Z') // 09:07 BRT (UTC-3)
    expect(gerarNomeArquivo('D1000', data)).toBe('D1000-convertido-20260105-0907.xlsx')
  })
})
