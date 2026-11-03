import { calcularAlertas } from '../alertas'
import { avisoLocacao, diasUteisAte, textoAviso } from '../locacao'

const SEM: ReadonlySet<string> = new Set()
// 2026-11-02 (seg) Finados, 2026-11-20 (sex) Consciência Negra
const FERIADOS: ReadonlySet<string> = new Set(['2026-11-02', '2026-11-20'])

describe('diasUteisAte', () => {
  it('conta dias úteis depois de hoje até o fim, pulando fim de semana e feriado', () => {
    // hoje sex 30/10; fim sex 06/11: seg 02 é feriado → 03,04,05,06 = 4
    expect(diasUteisAte('2026-10-30', '2026-11-06', FERIADOS)).toBe(4)
    expect(diasUteisAte('2026-10-30', '2026-11-06', SEM)).toBe(5)
    expect(diasUteisAte('2026-11-06', '2026-11-06', SEM)).toBe(0)
  })
})

describe('avisoLocacao: 5 dias úteis antes e no vencimento', () => {
  it('com o feriado, fim a 6 dias corridos úteis vira aviso (calendário da obra conta)', () => {
    // hoje qui 29/10; fim sex 06/11: 30,03,04,05,06 = 5 dias úteis (02 feriado) → avisa
    expect(avisoLocacao({ fim: '2026-11-06', estado: 'ativa' }, '2026-10-29', FERIADOS)).toEqual({ tipo: 'proxima', fim: '2026-11-06', diasUteis: 5 })
    // sem o feriado são 6 → ainda não avisa
    expect(avisoLocacao({ fim: '2026-11-06', estado: 'ativa' }, '2026-10-29', SEM)).toBeNull()
  })
  it('no dia e depois do vencimento', () => {
    expect(avisoLocacao({ fim: '2026-11-06', estado: 'renovada' }, '2026-11-06', SEM)).toEqual({ tipo: 'hoje', fim: '2026-11-06' })
    expect(avisoLocacao({ fim: '2026-11-06', estado: 'ativa' }, '2026-11-09', SEM)).toEqual({ tipo: 'vencida', fim: '2026-11-06' })
  })
  it('devolvida ou sem período: nada', () => {
    expect(avisoLocacao({ fim: '2026-11-06', estado: 'devolvida' }, '2026-11-06', SEM)).toBeNull()
    expect(avisoLocacao({ fim: null, estado: 'ativa' }, '2026-11-06', SEM)).toBeNull()
  })
  it('textos', () => {
    expect(textoAviso({ tipo: 'proxima', fim: '2026-11-06', diasUteis: 4 })).toBe('vence em 4 dias úteis (06/11)')
    expect(textoAviso({ tipo: 'proxima', fim: '2026-11-06', diasUteis: 1 })).toBe('vence em 1 dia útil (06/11)')
    expect(textoAviso({ tipo: 'hoje', fim: '2026-11-06' })).toBe('vence hoje')
    expect(textoAviso({ tipo: 'vencida', fim: '2026-11-06' })).toBe('venceu em 06/11')
  })
})

describe('faixa de alertas da obra: locações', () => {
  const base = { obraId: 'o1', hoje: '2026-11-03', calc: null, agenda: null, restricoes: [] }
  it('uma locação vencendo → alerta de atenção com link para Locações', () => {
    const a = calcularAlertas({ ...base, feriados: FERIADOS, locacoes: [{ item: 'Andaime', fim: '2026-11-06', estado: 'ativa' }, { item: 'Container', fim: '2026-12-31', estado: 'ativa' }] })
    expect(a).toEqual([
      {
        id: 'locacao', tom: 'atencao',
        texto: 'Locação: Andaime vence em 3 dias úteis (06/11) — devolver ou renovar',
        acao: { rotulo: 'Ver locações', href: '/obras/obras/o1/financeiro/locacoes' },
      },
    ])
  })
  it('vencida/hoje → negativo; várias → contagem com a primeira', () => {
    const a = calcularAlertas({ ...base, locacoes: [{ item: 'Andaime', fim: '2026-11-05', estado: 'ativa' }, { item: 'Betoneira', fim: '2026-11-03', estado: 'ativa' }] })
    expect(a[0]).toMatchObject({ id: 'locacao', tom: 'negativo', texto: '2 locações vencendo, a primeira: Betoneira vence hoje' })
  })
  it('leitura que falhou (null) ou devolvida → sem alerta', () => {
    expect(calcularAlertas({ ...base, locacoes: null })).toEqual([])
    expect(calcularAlertas({ ...base, locacoes: [{ item: 'X', fim: '2026-11-03', estado: 'devolvida' }] })).toEqual([])
  })
})
