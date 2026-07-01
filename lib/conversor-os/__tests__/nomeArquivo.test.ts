import { gerarNomeArquivo } from '../nomeArquivo'

describe('gerarNomeArquivo', () => {
  it('formats DPSP with zero-padded date and time', () => {
    const data = new Date(2026, 5, 30, 14, 32) // June 30 2026, 14:32 (month is 0-indexed)
    expect(gerarNomeArquivo('DPSP', data)).toBe('DPSP-convertido-20260630-1432.xlsx')
  })

  it('formats D1000 and pads single-digit day/month/hour/minute', () => {
    const data = new Date(2026, 0, 5, 9, 7) // Jan 5 2026, 09:07
    expect(gerarNomeArquivo('D1000', data)).toBe('D1000-convertido-20260105-0907.xlsx')
  })
})
