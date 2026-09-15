import { ROTULO_CAMPO, type CampoHistorico } from '../_lib/historico'
import { linhasDeAlteracao } from '../_lib/historico'

describe('ROTULO_CAMPO', () => {
  it('tem um rótulo para cada CampoHistorico, sem string vazia', () => {
    const campos: CampoHistorico[] = [
      'pcm', 'equipe', 'prioridade', 'inicio_plan', 'duracao',
      'liberado_por', 'liberado_em', 'os_aprovada_em',
      'tipo', 'valor', 'origem', 'analista_cliente', 'mau_uso',
      'etapa',
      'marco_exec_fim', 'marco_relatorio', 'marco_fechou_os',
      'marco_liberou_fat', 'marco_faturou',
    ]
    for (const c of campos) {
      expect(ROTULO_CAMPO[c]).toBeTruthy()
    }
  })

  it('usa os rótulos exatos da spec (amostra)', () => {
    expect(ROTULO_CAMPO.pcm).toBe('Responsável da obra')
    expect(ROTULO_CAMPO.liberado_por).toBe('Liberado por')
    expect(ROTULO_CAMPO.os_aprovada_em).toBe('OS aprovada em')
    expect(ROTULO_CAMPO.etapa).toBe('Etapa')
  })
})

describe('linhasDeAlteracao', () => {
  it('sem mudanças, devolve array vazio', () => {
    const r = linhasDeAlteracao({ pcm: 'YURI' }, { pcm: 'YURI' }, 'Cronograma')
    expect(r).toEqual([])
  })

  it('um campo de texto mudou: uma linha, sem motivo', () => {
    const r = linhasDeAlteracao(
      { prioridade: 'Normal' },
      { prioridade: 'Urgente' },
      'Cronograma'
    )
    expect(r).toEqual([
      { bloco: 'Cronograma', campo: 'prioridade', de: 'Normal', para: 'Urgente', motivo: null },
    ])
  })

  it('campo ausente em depois não conta como mudança', () => {
    const r = linhasDeAlteracao({ pcm: 'YURI', equipe: 'MANFAC-7' }, { pcm: 'YURI' }, 'Cronograma')
    expect(r).toEqual([])
  })

  it('formata data, moeda, booleano e etapa', () => {
    const r = linhasDeAlteracao(
      { valor: 4380, mau_uso: false, etapa: 'levantamento' },
      { valor: 5200.5, mau_uso: true, etapa: 'andamento' },
      'Identificação'
    )
    expect(r).toContainEqual({ bloco: 'Identificação', campo: 'valor', de: 'R$ 4.380,00', para: 'R$ 5.200,50', motivo: null })
    expect(r).toContainEqual({ bloco: 'Identificação', campo: 'mau_uso', de: 'normal', para: 'Mau uso', motivo: null })
  })

  it('formata data em DD/MM/AAAA', () => {
    const r = linhasDeAlteracao({ liberado_em: null }, { liberado_em: '2026-09-10' }, 'Autorização')
    expect(r).toEqual([
      { bloco: 'Autorização', campo: 'liberado_em', de: null, para: '10/09/2026', motivo: null },
    ])
  })

  it('null vira null em de/para (o componente exibe "—")', () => {
    const r = linhasDeAlteracao({ liberado_por: 'JUAN' }, { liberado_por: null }, 'Autorização')
    expect(r).toEqual([
      { bloco: 'Autorização', campo: 'liberado_por', de: 'JUAN', para: null, motivo: null },
    ])
  })

  it('mesmo valor numérico em tipos diferentes (number vs string) não gera linha', () => {
    const r = linhasDeAlteracao({ duracao: 6 }, { duracao: '6' }, 'Cronograma')
    expect(r).toEqual([])
  })

  it('inicio_plan mudou com exigirMotivoRemarcacao=true e motivo preenchido: uma linha com motivo', () => {
    const r = linhasDeAlteracao(
      { inicio_plan: '2026-09-10' },
      { inicio_plan: '2026-09-16' },
      'Cronograma',
      { exigirMotivoRemarcacao: true, motivoRemarcacao: 'Loja pediu para adiar por causa da reforma do estacionamento' }
    )
    expect(r).toEqual([
      {
        bloco: 'Cronograma',
        campo: 'inicio_plan',
        de: '10/09/2026',
        para: '16/09/2026',
        motivo: 'Loja pediu para adiar por causa da reforma do estacionamento',
      },
    ])
  })

  it('inicio_plan mudou com exigirMotivoRemarcacao=true e SEM motivo: lança', () => {
    expect(() =>
      linhasDeAlteracao(
        { inicio_plan: '2026-09-10' },
        { inicio_plan: '2026-09-16' },
        'Cronograma',
        { exigirMotivoRemarcacao: true }
      )
    ).toThrow(/motivoRemarcacao/)
  })

  it('inicio_plan mudou SEM exigirMotivoRemarcacao (Triagem, obra ainda não liberada): sem motivo, sem erro', () => {
    const r = linhasDeAlteracao(
      { inicio_plan: null },
      { inicio_plan: '2026-09-16' },
      'Triagem'
    )
    expect(r).toEqual([
      { bloco: 'Triagem', campo: 'inicio_plan', de: null, para: '16/09/2026', motivo: null },
    ])
  })

  it('concluir etapa: etapa e o marco do passo mudam juntos, na mesma chamada', () => {
    const r = linhasDeAlteracao(
      { etapa: 'relatorio', marco_relatorio: null },
      { etapa: 'aprovarOS', marco_relatorio: '2026-08-21' },
      'Esteira'
    )
    expect(r).toHaveLength(2)
    expect(r).toContainEqual({ bloco: 'Esteira', campo: 'etapa', de: 'Relatório de entrega', para: 'Pendente fechamento', motivo: null })
    expect(r).toContainEqual({ bloco: 'Esteira', campo: 'marco_relatorio', de: null, para: '21/08/2026', motivo: null })
  })
})
