import { textoDaTrava } from '../trava'

describe('textoDaTrava', () => {
  it('null quando não há snapshot', () => {
    expect(textoDaTrava(null, '2026-10-30')).toBeNull()
  })

  it('em andamento com bloqueadas (formato do mockup)', () => {
    const t = textoDaTrava(
      {
        atividade: { numero: 6, nome: 'Escoramento provisório', status: 'em_andamento' },
        bloqueadas: [11, 12, 13, 14, 21].map((n) => ({ numero: n, nome: `Demolição ${n}` })),
        liberada: false,
      },
      '2026-10-30',
    )
    expect(t).toBe(
      'Status na geração (30/10/2026): atividade nº 6 Escoramento provisório EM ANDAMENTO. Atividades nº 11–14 e 21 BLOQUEADAS.',
    )
  })

  it('liberada: texto neutro, sem BLOQUEADAS', () => {
    const t = textoDaTrava(
      { atividade: { numero: 6, nome: 'Escoramento provisório', status: 'concluido' }, bloqueadas: [], liberada: true },
      '2026-10-30T15:00:00Z',
    )
    expect(t).toBe('Status na geração (30/10/2026): atividade nº 6 Escoramento provisório CONCLUÍDO. Condição de liberação atendida.')
    expect(t).not.toMatch(/BLOQUEADAS/)
  })

  it('poucas bloqueadas listam nome; status desconhecido vira maiúsculas', () => {
    const t = textoDaTrava(
      { atividade: { numero: 2, nome: 'Viga', status: 'nao_iniciado' }, bloqueadas: [{ numero: 3, nome: 'Demolir forro' }], liberada: false },
      '2026-01-05',
    )
    expect(t).toContain('NÃO INICIADO')
    expect(t).toContain('Atividade nº 3 Demolir forro BLOQUEADA')
  })
})
