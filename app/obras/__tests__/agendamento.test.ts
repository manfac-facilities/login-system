import {
  naFilaDoDiario,
  agendadaForaDoDiario,
  agendamentoVoltou,
  somarDiasISO,
  limitesAgendamento,
  validarAgendamento,
  nomeDeQuemAgendou,
  textoAgendadas,
  type EntradaAgendamento,
} from '../_lib/agendamento'
import type { Etapa } from '../_lib/tipos'

const obra = (etapa: Etapa, ate: string | null = null) => ({ etapa, diario_agendado_ate: ate })

describe('regra da fila do diário', () => {
  const hoje = '2026-10-15'

  it('etapas do diário sem agendamento estão na fila; as outras não', () => {
    for (const e of ['levantamento', 'andamento', 'paralisado'] as Etapa[]) {
      expect(naFilaDoDiario(obra(e), hoje)).toBe(true)
    }
    for (const e of ['definir', 'relatorio', 'cancelado'] as Etapa[]) {
      expect(naFilaDoDiario(obra(e), hoje)).toBe(false)
    }
  })

  it('agendada para o futuro está fora da fila', () => {
    const o = obra('andamento', '2026-10-22')
    expect(agendadaForaDoDiario(o, hoje)).toBe(true)
    expect(naFilaDoDiario(o, hoje)).toBe(false)
    expect(agendamentoVoltou(o, hoje)).toBe(false)
  })

  it('no dia marcado a obra já voltou', () => {
    const o = obra('andamento', '2026-10-22')
    expect(naFilaDoDiario(o, '2026-10-22')).toBe(true)
    expect(agendadaForaDoDiario(o, '2026-10-22')).toBe(false)
    expect(agendamentoVoltou(o, '2026-10-22')).toBe(true)
  })

  it('depois do dia continua voltada', () => {
    expect(agendamentoVoltou(obra('andamento', '2026-10-22'), '2026-10-25')).toBe(true)
  })

  it('agendada fora das etapas do diário não conta em nada', () => {
    const o = obra('relatorio', '2026-10-22')
    expect(naFilaDoDiario(o, hoje)).toBe(false)
    expect(agendadaForaDoDiario(o, hoje)).toBe(false)
    expect(agendamentoVoltou(o, hoje)).toBe(false)
  })
})

describe('datas', () => {
  it('somarDiasISO atravessa o fim do mês', () => {
    expect(somarDiasISO('2026-10-31', 1)).toBe('2026-11-01')
  })
  it('limitesAgendamento', () => {
    expect(limitesAgendamento('2026-10-15')).toEqual({ min: '2026-10-16', max: '2026-11-14' })
  })
})

describe('validarAgendamento', () => {
  const hoje = '2026-10-15'
  const ok: EntradaAgendamento = {
    obraId: 'o1',
    oque: 'Levantamento de material',
    motivo: 'Aguardando material',
    outro: '',
    ate: '2026-10-22',
  }
  const erro = (e: Partial<EntradaAgendamento>) => {
    const r = validarAgendamento({ ...ok, ...e }, hoje)
    return 'error' in r ? r.error : null
  }

  it('aceita a entrada válida', () => {
    expect(validarAgendamento(ok, hoje)).toEqual({
      campos: { ate: '2026-10-22', oque: 'Levantamento de material', motivo: 'Aguardando material' },
    })
  })
  it('mensagens', () => {
    expect(erro({ oque: '  ' })).toBe('Diga o que vai acontecer.')
    expect(erro({ motivo: '' })).toBe('Escolha o motivo da parada.')
    expect(erro({ motivo: 'Qualquer coisa' })).toBe('Escolha o motivo da parada.')
    expect(erro({ motivo: 'Outro', outro: ' ' })).toBe('Escreva o motivo.')
    const data = 'Escolha uma data entre amanhã e 30 dias.'
    expect(erro({ ate: hoje })).toBe(data)
    expect(erro({ ate: '2026-11-15' })).toBe(data)
    expect(erro({ ate: 'lixo' })).toBe(data)
    expect(erro({ ate: '' })).toBe(data)
  })
  it('limites de tamanho e de data', () => {
    expect(erro({ oque: 'a'.repeat(81) })).not.toBeNull()
    expect(erro({ oque: 'a'.repeat(80) })).toBeNull()
    expect(erro({ motivo: 'Outro', outro: 'a'.repeat(101) })).not.toBeNull()
    expect(erro({ ate: '2026-11-14' })).toBeNull()
  })
  it('monta Outro e faz trim', () => {
    const r = validarAgendamento({ ...ok, oque: ' Visita técnica ', motivo: 'Outro', outro: '  loja fechada ' }, hoje)
    expect(r).toEqual({ campos: { ate: '2026-10-22', oque: 'Visita técnica', motivo: 'Outro: loja fechada' } })
  })
})

describe('nomeDeQuemAgendou', () => {
  it('usa o cadastro, ou o e-mail', () => {
    expect(nomeDeQuemAgendou('yuri.moreira@manfac.com.br', [])).toBe('Yuri')
    expect(
      nomeDeQuemAgendou('yuri.moreira@manfac.com.br', [{ email: 'yuri.moreira@manfac.com.br', nome: 'Yuri Moreira' }])
    ).toBe('Yuri')
    expect(nomeDeQuemAgendou('joao@manfac.com.br', [])).toBe('Joao')
  })
})

describe('textoAgendadas', () => {
  it('singular e plural', () => {
    expect(textoAgendadas(1)).toBe('1 agendada')
    expect(textoAgendadas(3)).toBe('3 agendadas')
  })
})
