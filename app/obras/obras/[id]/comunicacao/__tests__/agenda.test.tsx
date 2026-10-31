import { render, screen, within } from '@testing-library/react'
import Agenda, { SITUACAO, nomeDoItem, porMes, tipoAgendaDe } from '../_agenda'
import type { ItemAgenda } from '../../../_lib/agenda'

const it_ = (tipo: ItemAgenda['tipo'], referencia: string, dataPrevista: string, situacao: ItemAgenda['situacao'], dataReal: string | null = null): ItemAgenda => ({
  tipo, referencia, dataPrevista, dataReal, situacao,
})
const agenda: ItemAgenda[] = [
  it_('diario', '2026-10-27', '2026-10-27', 'no_prazo', '2026-10-27'),
  it_('diario', '2026-10-28', '2026-10-28', 'atrasado'),
  it_('semanal', '2026-10-26', '2026-10-30', 'enviar_hoje'),
  it_('fase', '3', '2026-11-10', 'programado'),
  it_('mensal', '2026-10', '2026-10-30', 'com_atraso', '2026-11-02'),
]
const props = { obraId: 'o1', fases: new Map([['3', 'Alvenaria']]), hrefTipo: (t: string) => `/x?tipo=${t}` }

describe('aba Agenda', () => {
  it('chips de situação têm o texto exigido', () => {
    expect(Object.values(SITUACAO).map((s) => s.rotulo)).toEqual(['Enviado no prazo', 'Enviado com atraso', 'ATRASADO', 'ENVIAR HOJE', 'Antes do sistema', 'Programado'])
  })

  it('agrupa por mês, mostra chips e links dos rascunhos', () => {
    render(<Agenda {...props} agenda={agenda} tipo="todos" />)
    const out = screen.getByRole('region', { name: 'outubro de 2026' })
    expect(within(out).getByText('ATRASADO')).toBeTruthy()
    expect(within(out).getByText('ENVIAR HOJE')).toBeTruthy()
    expect(within(out).getByText('Enviado no prazo')).toBeTruthy()
    expect(within(out).getByText('Enviado com atraso')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'novembro de 2026' })).toBeTruthy()
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/obras/obras/o1/diario?data=2026-10-28')
    expect(hrefs).toContain('/obras/obras/o1/comunicacao/semanal?semana=2026-10-26')
    expect(hrefs).toContain('/obras/obras/o1/comunicacao/relatorio/fase/3')
    expect(hrefs).toContain('/obras/obras/o1/comunicacao/relatorio/mensal/2026-10')
  })

  it('filtra por tipo; fase mostra o nome da etapa, nunca o numero', () => {
    render(<Agenda {...props} agenda={agenda} tipo="fase" />)
    expect(screen.getByText('Relatório de fase — Alvenaria')).toBeTruthy()
    expect(screen.queryByText(/Diário de/)).toBeNull()
  })

  it('agenda indisponível (null) mostra aviso, sem quebrar', () => {
    render(<Agenda {...props} agenda={null} tipo="todos" />)
    expect(screen.getByText(/Não foi possível carregar a agenda/)).toBeTruthy()
  })

  it('helpers', () => {
    expect(tipoAgendaDe('xx')).toBe('todos')
    expect(tipoAgendaDe('mensal')).toBe('mensal')
    expect(nomeDoItem(it_('fase', '9', '2026-11-01', 'programado'), new Map())).toBe('Relatório de fase — etapa fora do cronograma vigente')
    expect(porMes(agenda).map((g) => g.mes)).toEqual(['2026-10', '2026-11'])
  })
})
