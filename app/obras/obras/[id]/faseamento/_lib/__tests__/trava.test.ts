import { textoDaTrava, type TravaSnapshot } from '../trava'

const snap = (over: Partial<TravaSnapshot> = {}): TravaSnapshot => ({
  data: '2026-10-30',
  gerado_em: '2026-10-30T15:00:00Z',
  versao: 2,
  atividade: { numero: 6, descricao: 'Escoramento provisório', status: 'em_andamento', percentual: 0.4 },
  bloqueadas: [],
  ...over,
})

describe('textoDaTrava', () => {
  it('null quando não há snapshot', () => {
    expect(textoDaTrava(null)).toBeNull()
  })

  it('em andamento com bloqueadas (formato do mockup, data do snapshot)', () => {
    const t = textoDaTrava(snap({ bloqueadas: [11, 12, 13, 14, 21].map((n) => ({ numero: n, descricao: `Demolição ${n}`, status: 'bloqueado' })) }))
    expect(t).toBe(
      'Status na geração (30/10/2026): atividade nº 6 Escoramento provisório EM ANDAMENTO. Atividades nº 11–14 e 21 BLOQUEADAS.',
    )
  })

  it('liberada (atividade concluída): texto neutro, sem BLOQUEADAS', () => {
    const t = textoDaTrava(snap({ atividade: { numero: 6, descricao: 'Escoramento provisório', status: 'concluido', percentual: 1 }, bloqueadas: [{ numero: 11, descricao: 'x', status: 'nao_iniciado' }] }))
    expect(t).toBe('Status na geração (30/10/2026): atividade nº 6 Escoramento provisório CONCLUÍDA. Condição de liberação atendida.')
    expect(t).not.toMatch(/BLOQUEADAS/)
  })

  it('poucas bloqueadas listam a descrição; descrição nula some; rótulos dos status', () => {
    const t = textoDaTrava(snap({ atividade: { numero: 2, descricao: null, status: 'nao_iniciado' }, bloqueadas: [{ numero: 3, descricao: 'Demolir forro', status: 'bloqueado' }] }))
    expect(t).toContain('atividade nº 2 NÃO INICIADA')
    expect(t).toContain('Atividade nº 3 Demolir forro BLOQUEADA')
    expect(textoDaTrava(snap({ atividade: { numero: 2, descricao: 'V', status: 'bloqueado' } }))).toContain('V BLOQUEADA.')
  })
})
