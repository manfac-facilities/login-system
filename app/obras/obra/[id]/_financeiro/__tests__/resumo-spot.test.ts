import { resumoSpot, type NotaExterna } from '../resumo-spot'
import type { NotaTela } from '../../../../obras/_lib/financeiro-tela'

const custo = { comprometido: 11238000, realizado: 10493000, pago: 9620000 }
const nota = (parcela: number, conta = true, situacao = 'autorizada'): NotaTela => ({
  chave: 'k' + parcela, os: 'OS', numero: '1', tomador: null, situacao,
  parcelaCentavos: parcela, totalCentavos: parcela, emitidaEm: null, contaNaReceita: conta,
})
const base = { valorCentavos: 15641232 as number | null, etapa: 'execucao', fatNfse: null as string | null, notas: [] as NotaTela[], externas: [] as NotaExterna[], custo }

describe('resumoSpot', () => {
  it('MACAÉ 2 com nota externa', () => {
    const r = resumoSpot({ ...base, externas: [{ nfse: '1', emitidaEm: '2026-01-01', valorCentavos: 14077109 }] })
    expect(r.faturadoCentavos).toBe(14077109)
    expect(r.faturadoPct).toBe(90)
    expect(r.faltaCentavos).toBe(1564123)
    expect(r.margemPrevistaCentavos).toBe(4403232)
    expect(r.margemPrevistaPct).toBe(28.2)
    expect(r.margemRealizadaCentavos).toBe(3584109)
    expect(r.foraDoSistema).toBe(false)
    expect(r.notas).toBe(1)
  })
  it('legada: faturada com fatNfse e sem notas', () => {
    const r = resumoSpot({ ...base, etapa: 'faturado', fatNfse: '1481' })
    expect(r.faturadoCentavos).toBe(r.valorCentavos)
    expect(r.foraDoSistema).toBe(true)
    expect(r.notas).toBe(0)
  })
  it('faturada sem fatNfse e sem notas', () => {
    const r = resumoSpot({ ...base, etapa: 'faturado' })
    expect(r.faturadoCentavos).toBe(0)
    expect(r.foraDoSistema).toBe(false)
  })
  it('nota cancelada não soma', () => {
    const r = resumoSpot({ ...base, notas: [nota(5000, false, 'cancelada'), nota(1000)] })
    expect(r.faturadoCentavos).toBe(1000)
    expect(r.notas).toBe(1)
  })
  it('acima do valor', () => {
    const r = resumoSpot({ ...base, valorCentavos: 100000, notas: [nota(60000), nota(50000)] })
    expect(r.acimaDoValorCentavos).toBe(10000)
    expect(r.faltaCentavos).toBe(0)
  })
  it('sem valor', () => {
    const r = resumoSpot({ ...base, valorCentavos: null, notas: [nota(1000)] })
    expect(r.faturadoPct).toBeNull()
    expect(r.faltaCentavos).toBeNull()
    expect(r.margemPrevistaCentavos).toBeNull()
    expect(r.margemPrevistaPct).toBeNull()
    expect(r.acimaDoValorCentavos).toBeNull()
  })
  it('margem realizada pct nula com faturado 0', () => {
    expect(resumoSpot(base).margemRealizadaPct).toBeNull()
  })
})
