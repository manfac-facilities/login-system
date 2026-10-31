/** Mapeamento dos envios para a agenda (Leva 4 §2.2): só cliente com destinatário aceito; referência por tipo. */
import { agendaDaObra } from '../agenda'
import { enviosDaAgenda, type EnvioBruto } from '../envios-agenda'

const e = (over: Partial<EnvioBruto>): EnvioBruto => ({
  tipo: 'diario', referencia: '2026-10-28', lado: 'cliente', destinatarios: ['c@cli.com'],
  enviadoEm: '2026-10-28T20:00:00Z', semanalId: null, relatorioId: null, ...over,
})
const semanais = new Map([['s1', '2026-10-26']])
const relatorios = new Map([['r1', '2026-10'], ['r2', '3'], ['r3', 'entrega']])

describe('enviosDaAgenda', () => {
  it('diário usa a referência (date) do envio', () => {
    expect(enviosDaAgenda([e({})], semanais, relatorios)).toEqual([{ tipo: 'diario', referencia: '2026-10-28', enviadoEm: '2026-10-28T20:00:00Z' }])
  })

  it('semanal usa a semana_inicio via semanal_id, não a data do envio', () => {
    const r = enviosDaAgenda([e({ tipo: 'semanal', referencia: '2026-10-30', semanalId: 's1' })], semanais, relatorios)
    expect(r.map((x) => [x.tipo, x.referencia])).toEqual([['semanal', '2026-10-26']])
  })

  it('mensal, fase e entrega usam a referência do relatório via relatorio_id', () => {
    const r = enviosDaAgenda(
      [
        e({ tipo: 'mensal', referencia: '2026-10-30', relatorioId: 'r1' }),
        e({ tipo: 'fase', referencia: '2026-11-03', relatorioId: 'r2' }),
        e({ tipo: 'entrega', referencia: '2026-12-01', relatorioId: 'r3' }),
      ],
      semanais,
      relatorios,
    )
    expect(r.map((x) => [x.tipo, x.referencia])).toEqual([['mensal', '2026-10'], ['fase', '3'], ['entrega', 'entrega']])
  })

  it('só conta envio ao cliente com destinatário aceito', () => {
    const r = enviosDaAgenda(
      [e({ lado: 'interno' }), e({ destinatarios: [] }), e({ destinatarios: null }), e({ lado: null })],
      semanais,
      relatorios,
    )
    expect(r).toEqual([])
  })

  it('vínculo ausente/desconhecido e tipos fora da agenda são ignorados', () => {
    const r = enviosDaAgenda(
      [e({ tipo: 'semanal', semanalId: null }), e({ tipo: 'mensal', relatorioId: 'zz' }), e({ tipo: 'ata' }), e({ tipo: 'imediata' }), e({ tipo: null })],
      semanais,
      relatorios,
    )
    expect(r).toEqual([])
  })

  it('integração com a agenda: envio mapeado marca o item como enviado', () => {
    const envios = enviosDaAgenda([e({ tipo: 'mensal', relatorioId: 'r1', enviadoEm: '2026-10-30T15:00:00Z' })], semanais, relatorios)
    const a = agendaDaObra({
      dataBase: '2026-10-05', terminoProjetado: '2026-10-30', obraConcluida: false, etapas: [], feriados: new Set(), envios, hojeIso: '2026-10-31',
    })
    expect(a.find((i) => i.tipo === 'mensal')).toMatchObject({ referencia: '2026-10', situacao: 'no_prazo', dataReal: '2026-10-30' })
  })
})
