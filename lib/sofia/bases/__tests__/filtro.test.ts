import { descreverFiltros, filtrarLinhas, filtrosDaUrl, ordenarLinhas, paginar } from '../filtro'
import { FILTROS_VAZIOS, type AbastLinha, type MotLinha, type VeicLinha } from '../tipos'

const ab = (o: Partial<AbastLinha>): AbastLinha => ({
  id: 'x', data: '2026-10-10', placa: 'AAA1A11', modelo: 'Uno', equipe: 'EQ-A', motorista: 'João', litros: 10, valor: 60,
  preco: 6, km: 100, posto: 'Shell', criado: '2026-10-10T10:00:00Z', corrigido: false, contexto: null, ...o,
})
const mot = (o: Partial<MotLinha>): MotLinha => ({
  id: 'x', nome: 'Ana', equipe: null, cnh: '1', cnhVenc: '2027-01-01', cnhClasse: 'em_dia', cnhDias: 100, contato: null, ativo: true, ...o,
})
const ve = (o: Partial<VeicLinha>): VeicLinha => ({
  id: 'x', placa: 'AAA1A11', modelo: 'Uno', ano: 2022, sit: 'uso', equipe: 'EQ-A', motorista: null, km: 1, kmMes: null,
  franquia: null, locacao: null, retorno: null, substituto: null, historico: [], ultimosKm: [], ultimosAbast: [], ...o,
})

describe('filtrarLinhas', () => {
  const rows = [
    ab({ id: '1', data: '2026-09-30', placa: 'AAA1A11' }),
    ab({ id: '2', data: '2026-10-05', placa: 'BBB2B22', equipe: 'EQ-B', posto: 'Ipiranga' }),
    ab({ id: '3', data: '2026-10-20', placa: 'BBB2B22', motorista: 'José' }),
  ]
  it('período inclusivo', () => {
    const r = filtrarLinhas('abast', rows, { ...FILTROS_VAZIOS, de: '2026-10-05', ate: '2026-10-20' })
    expect(r.map((x) => x.id)).toEqual(['2', '3'])
  })
  it('placa, equipe e motorista exatos', () => {
    expect(filtrarLinhas('abast', rows, { ...FILTROS_VAZIOS, placa: 'BBB2B22', equipe: 'EQ-B' }).map((x) => x.id)).toEqual(['2'])
    expect(filtrarLinhas('abast', rows, { ...FILTROS_VAZIOS, motorista: 'José' }).map((x) => x.id)).toEqual(['3'])
  })
  it('busca sem acento e sem caixa', () => {
    expect(filtrarLinhas('abast', rows, { ...FILTROS_VAZIOS, q: 'jose' }).map((x) => x.id)).toEqual(['3'])
    expect(filtrarLinhas('abast', rows, { ...FILTROS_VAZIOS, q: 'IPIRANGA' }).map((x) => x.id)).toEqual(['2'])
  })
  it('motoristas: situação e CNH', () => {
    const m = [mot({ id: 'a', cnhClasse: 'vencida' }), mot({ id: 'b', cnhClasse: 'vencendo', ativo: false }), mot({ id: 'c' })]
    expect(filtrarLinhas('mot', m, { ...FILTROS_VAZIOS, cnh: 'alerta' }).map((x) => x.id)).toEqual(['a', 'b'])
    expect(filtrarLinhas('mot', m, { ...FILTROS_VAZIOS, cnh: 'vencendo' }).map((x) => x.id)).toEqual(['b'])
    expect(filtrarLinhas('mot', m, { ...FILTROS_VAZIOS, situacao: 'inativo' }).map((x) => x.id)).toEqual(['b'])
  })
  it('veículos: situação', () => {
    const v = [ve({ id: 'a', sit: 'oficina' }), ve({ id: 'b' })]
    expect(filtrarLinhas('veic', v, { ...FILTROS_VAZIOS, sit: 'oficina' }).map((x) => x.id)).toEqual(['a'])
  })
})

describe('ordenarLinhas', () => {
  const rows = [ab({ id: '1', valor: 30, posto: null }), ab({ id: '2', valor: 10, posto: 'b' }), ab({ id: '3', valor: 20, posto: 'a' })]
  it('numérico asc/desc', () => {
    expect(ordenarLinhas('abast', rows, { k: 'valor', dir: 1 }).map((x) => x.id)).toEqual(['2', '3', '1'])
    expect(ordenarLinhas('abast', rows, { k: 'valor', dir: -1 }).map((x) => x.id)).toEqual(['1', '3', '2'])
  })
  it('vazio vai ao fim nas duas direções', () => {
    expect(ordenarLinhas('abast', rows, { k: 'posto', dir: 1 }).map((x) => x.id)).toEqual(['3', '2', '1'])
    expect(ordenarLinhas('abast', rows, { k: 'posto', dir: -1 }).map((x) => x.id)).toEqual(['2', '3', '1'])
  })
  it('sem ordem ou coluna desconhecida mantém', () => {
    expect(ordenarLinhas('abast', rows, null)).toBe(rows)
    expect(ordenarLinhas('abast', rows, { k: 'nada', dir: 1 })).toBe(rows)
  })
})

describe('paginar', () => {
  const rows = Array.from({ length: 45 }, (_, i) => i)
  it('20 por página', () => {
    expect(paginar(rows, 1)).toMatchObject({ totalPaginas: 3, de: 1, ate: 20 })
    expect(paginar(rows, 3)).toMatchObject({ de: 41, ate: 45, itens: [40, 41, 42, 43, 44] })
  })
  it('página fora do intervalo é ajustada; vazio é 0', () => {
    expect(paginar(rows, 99).pagina).toBe(3)
    expect(paginar([], 1)).toMatchObject({ de: 0, ate: 0, totalPaginas: 1 })
  })
})

describe('filtrosDaUrl', () => {
  it('sem parâmetros: mês corrente em abast/km, nada nas demais', () => {
    expect(filtrosDaUrl('abast', {}, '2026-10-30')).toMatchObject({ de: '2026-10-01', ate: '2026-10-30' })
    expect(filtrosDaUrl('km', {}, '2026-10-30').de).toBe('2026-10-01')
    expect(filtrosDaUrl('mot', {}, '2026-10-30')).toEqual(FILTROS_VAZIOS)
  })
  it('com parâmetro, de/ate ausentes não limitam', () => {
    expect(filtrosDaUrl('abast', { placa: 'ABC1D23' }, '2026-10-30')).toMatchObject({ placa: 'ABC1D23', de: '', ate: '' })
  })
  it('de/ate válidos passam; inválidos caem', () => {
    expect(filtrosDaUrl('km', { de: '2026-09-01', ate: 'lixo' }, '2026-10-30')).toMatchObject({ de: '2026-09-01', ate: '' })
  })
  it('valores fora da lista são ignorados; status legado vira sit', () => {
    expect(filtrosDaUrl('mot', { cnh: 'x', situacao: 'y' }, '2026-10-30')).toMatchObject({ cnh: '', situacao: '' })
    expect(filtrosDaUrl('veic', { status: 'manutencao' }, '2026-10-30').sit).toBe('oficina')
    expect(filtrosDaUrl('veic', { sit: 'livre' }, '2026-10-30').sit).toBe('livre')
  })
  it('descreve', () => {
    expect(descreverFiltros('mot', FILTROS_VAZIOS)).toBe('sem filtro (tudo)')
    expect(descreverFiltros('abast', { ...FILTROS_VAZIOS, de: '2026-10-01', placa: 'X' })).toBe('período 01/10/2026 a hoje · placa X')
  })
})
