import { acharDivergencias, agruparSemCentroCusto, ligacaoVigente, mascararCartao } from '../agrupar'

describe('acharDivergencias (D4)', () => {
  it('só lista código existente com valor diferente', () => {
    const r = acharDivergencias(
      [
        { codigo_transacao: 'A', valor: '10.00' },
        { codigo_transacao: 'B', valor: '20.00' },
        { codigo_transacao: 'C', valor: '30.50' },
      ],
      [
        { codigo_transacao: 'A', valor: 10 },
        { codigo_transacao: 'B', valor: 20.01 },
      ]
    )
    expect(r).toEqual([{ codigo: 'B', valorGravado: '20.01', valorArquivo: '20.00' }])
  })
})

describe('agruparSemCentroCusto', () => {
  it('soma em centavos, separa por motivo e ordena pelo maior valor', () => {
    const base = { plataforma: 'veloe', equipe_id: null }
    const g = agruparSemCentroCusto([
      { ...base, identificador: '1', data_uso: '2026-10-03', valor: 0.1, motivo_sem_centro_custo: 'sem_equipe' },
      { ...base, identificador: '1', data_uso: '2026-10-01', valor: 0.2, motivo_sem_centro_custo: 'sem_equipe' },
      { ...base, identificador: '2', data_uso: '2026-10-02', valor: 5, equipe_id: 'e', motivo_sem_centro_custo: 'sem_centro_custo' },
      { ...base, identificador: '3', data_uso: '2026-10-02', valor: 9, motivo_sem_centro_custo: null },
    ])
    expect(g).toHaveLength(2)
    expect(g[0]).toMatchObject({ identificador: '2', motivo: 'sem_centro_custo', totalCentavos: 500 })
    expect(g[1]).toMatchObject({ identificador: '1', gastos: 2, totalCentavos: 30, primeiraData: '2026-10-01', ultimaData: '2026-10-03' })
  })
})

describe('ligacaoVigente', () => {
  const l = (eq: string | null, d: string, c: string) => ({ plataforma: 'ticketlog', identificador: '1', equipe_id: eq, vigente_desde: d, criado_em: c })
  it('ignora vigência futura e desempata pela última registrada', () => {
    const h = [l('a', '2026-08-01', '1'), l('b', '2026-10-12', '2'), l('c', '2026-10-12', '3'), l('d', '2026-12-01', '4')]
    expect(ligacaoVigente(h, '2026-10-28')?.equipe_id).toBe('c')
    expect(ligacaoVigente(h, '2026-09-01')?.equipe_id).toBe('a')
    expect(ligacaoVigente(h, '2026-07-01')).toBeNull()
  })
  it('encerramento (equipe nula) vale a partir da data; religar depois volta a valer', () => {
    const h = [l('a', '2026-08-01', '1'), l(null, '2026-10-15', '2')]
    expect(ligacaoVigente(h, '2026-10-14')?.equipe_id).toBe('a')
    expect(ligacaoVigente(h, '2026-10-15')?.equipe_id).toBeNull()
    expect(ligacaoVigente([...h, l('b', '2026-10-18', '3')], '2026-10-20')?.equipe_id).toBe('b')
  })
})

describe('mascararCartao', () => {
  it('esconde o meio', () => {
    expect(mascararCartao('6037980012345678')).toBe('6037 **** 5678')
    expect(mascararCartao('1234')).toBe('1234')
  })
})
