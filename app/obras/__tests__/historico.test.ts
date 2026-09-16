import { ROTULO_CAMPO, type CampoHistorico } from '../_lib/historico'
import { linhasDeAlteracao, gravarComHistorico, type LinhaHistoricoNova } from '../_lib/historico'

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

  it('bate exatamente com a tabela de rótulos da spec §6 (todos os 19, não só amostra)', () => {
    expect(ROTULO_CAMPO).toEqual({
      pcm: 'Responsável da obra',
      equipe: 'Equipe / prestador',
      prioridade: 'Prioridade',
      inicio_plan: 'Início planejado',
      duracao: 'Duração em dias',
      liberado_por: 'Liberado por',
      liberado_em: 'Data da liberação',
      os_aprovada_em: 'OS aprovada em',
      tipo: 'Tipo',
      valor: 'Valor',
      origem: 'Origem',
      analista_cliente: 'Analista do cliente',
      mau_uso: 'Classificação',
      etapa: 'Etapa',
      marco_exec_fim: 'Data de fim da execução em campo',
      marco_relatorio: 'Data do relatório de entrega',
      marco_fechou_os: 'Data de fechamento da OS',
      marco_liberou_fat: 'Data do faturamento liberado',
      marco_faturou: 'Data de faturamento',
    })
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
    expect(r).toHaveLength(3)
    expect(r).toContainEqual({ bloco: 'Identificação', campo: 'valor', de: 'R$ 4.380,00', para: 'R$ 5.200,50', motivo: null })
    expect(r).toContainEqual({ bloco: 'Identificação', campo: 'mau_uso', de: 'normal', para: 'Mau uso', motivo: null })
    expect(r).toContainEqual({ bloco: 'Identificação', campo: 'etapa', de: 'Levantamento', para: 'Em andamento', motivo: null })
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

  it('formata duracao como "N dias"', () => {
    const r = linhasDeAlteracao({ duracao: 5 }, { duracao: 10 }, 'Cronograma')
    expect(r).toEqual([
      { bloco: 'Cronograma', campo: 'duracao', de: '5 dias', para: '10 dias', motivo: null },
    ])
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

  it("'' equivale a null: não gera linha (nem null→'' nem ''→null)", () => {
    expect(linhasDeAlteracao({ liberado_por: null }, { liberado_por: '' }, 'Autorização')).toEqual([])
    expect(linhasDeAlteracao({ liberado_por: '' }, { liberado_por: null }, 'Autorização')).toEqual([])
  })

  it('motivo é gravado já sem espaços nas pontas (M3)', () => {
    const r = linhasDeAlteracao(
      { inicio_plan: '2026-09-10' },
      { inicio_plan: '2026-09-16' },
      'Cronograma',
      { exigirMotivoRemarcacao: true, motivoRemarcacao: '   Loja pediu para adiar   ' }
    )
    expect(r[0].motivo).toBe('Loja pediu para adiar')
  })
})

describe('gravarComHistorico', () => {
  it('chama obras_aplicar_alteracao com obraId, campos e linhas, e devolve a obra atualizada', async () => {
    const obraAtualizada = { id: 'o1', pcm: 'YURI' }
    const rpc = jest.fn().mockResolvedValue({ data: obraAtualizada, error: null })
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    const linhas: LinhaHistoricoNova[] = [
      { bloco: 'Cronograma', campo: 'pcm', de: null, para: 'YURI', motivo: null },
    ]
    const r = await gravarComHistorico(supabase, {
      obraId: 'o1',
      campos: { pcm: 'YURI' },
      linhas,
    })

    expect(rpc).toHaveBeenCalledWith('obras_aplicar_alteracao', {
      p_obra_id: 'o1',
      p_campos: { pcm: 'YURI' },
      p_linhas: linhas,
    })
    expect(r).toEqual({ data: obraAtualizada })
  })

  // `bloqueio` NÃO é um CampoHistorico rastreado (não entra em
  // CampoHistorico/COLUNA_PARA_CAMPO), mas É uma coluna válida do UPDATE da
  // RPC desde a correção do B1 (ver sdd-sql-obras-historico.sql) — por isso
  // esta chamada é válida e não deve lançar pela trava do I2.
  it('sem linhas (nada rastreado mudou), ainda chama a RPC com p_linhas vazio — o update precisa acontecer', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: { id: 'o1' }, error: null })
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    await gravarComHistorico(supabase, { obraId: 'o1', campos: { bloqueio: 'Clima' }, linhas: [] })

    expect(rpc).toHaveBeenCalledWith('obras_aplicar_alteracao', {
      p_obra_id: 'o1',
      p_campos: { bloqueio: 'Clima' },
      p_linhas: [],
    })
  })

  it('erro da RPC vira { error } em português, nunca lança', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'Sem acesso ao Controle de Obras' } })
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    const r = await gravarComHistorico(supabase, { obraId: 'o1', campos: {}, linhas: [] })

    expect(r).toEqual({ error: 'Erro ao salvar a alteração da obra' })
  })

  it('erro de coluna desconhecida devolvido pela RPC (B1) também vira { error } genérico, nunca lança', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'obras_aplicar_alteracao: coluna desconhecida em p_campos: campo_que_nao_existe' },
    })
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    const r = await gravarComHistorico(supabase, {
      obraId: 'o1',
      campos: { campo_que_nao_existe: 'x' },
      linhas: [],
    })

    expect(r).toEqual({ error: 'Erro ao salvar a alteração da obra' })
  })

  it('lança se um campo rastreado muda em campos sem linha correspondente (I2)', async () => {
    const rpc = jest.fn()
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    await expect(
      gravarComHistorico(supabase, { obraId: 'o1', campos: { inicio_plan: '2026-10-01' }, linhas: [] })
    ).rejects.toThrow(/inicio_plan/)

    expect(rpc).not.toHaveBeenCalled()
  })

  it('aprovacao mudando sem a linha os_aprovada_em correspondente também é pego (aprovacao mapeia para os_aprovada_em)', async () => {
    const rpc = jest.fn()
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    await expect(
      gravarComHistorico(supabase, { obraId: 'o1', campos: { aprovacao: '2026-09-10' }, linhas: [] })
    ).rejects.toThrow(/os_aprovada_em/)
  })

  it('aprovacao mudando COM a linha os_aprovada_em correspondente: não lança, chama a RPC', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: { id: 'o1' }, error: null })
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]
    const linhas: LinhaHistoricoNova[] = [
      { bloco: 'Autorização', campo: 'os_aprovada_em', de: null, para: '10/09/2026', motivo: null },
    ]

    const r = await gravarComHistorico(supabase, { obraId: 'o1', campos: { aprovacao: '2026-09-10' }, linhas })

    expect(r).toEqual({ data: { id: 'o1' } })
  })

  // Reconferência 2026-09-15 (I2): os_aprovada e marco_os_aprov são
  // satélites de aprovacao (spec §7) e por isso também precisam mapear
  // para os_aprovada_em — sem isso um payload que mandasse só um dos dois
  // (sem aprovacao) escapava da trava por completo.
  it('os_aprovada sozinho (sem aprovacao) sem a linha correspondente também é pego', async () => {
    const rpc = jest.fn()
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    await expect(
      gravarComHistorico(supabase, { obraId: 'o1', campos: { os_aprovada: true }, linhas: [] })
    ).rejects.toThrow(/os_aprovada_em/)

    expect(rpc).not.toHaveBeenCalled()
  })

  it('marco_os_aprov sozinho (sem aprovacao) sem a linha correspondente também é pego', async () => {
    const rpc = jest.fn()
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    await expect(
      gravarComHistorico(supabase, { obraId: 'o1', campos: { marco_os_aprov: '2026-09-10' }, linhas: [] })
    ).rejects.toThrow(/os_aprovada_em/)
  })

  it('aprovacao + os_aprovada + marco_os_aprov juntos, COM a linha os_aprovada_em: não lança, e a mensagem não duplicaria o nome do campo se lançasse', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: { id: 'o1' }, error: null })
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]
    const linhas: LinhaHistoricoNova[] = [
      { bloco: 'Autorização', campo: 'os_aprovada_em', de: null, para: '10/09/2026', motivo: null },
    ]

    const r = await gravarComHistorico(supabase, {
      obraId: 'o1',
      campos: { aprovacao: '2026-09-10', os_aprovada: true, marco_os_aprov: '2026-09-10' },
      linhas,
    })

    expect(r).toEqual({ data: { id: 'o1' } })
  })

  it('a mensagem de erro descreve presença em "campos", não "mudança" — não presume que o campo mudou', async () => {
    const rpc = jest.fn()
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    await expect(
      gravarComHistorico(supabase, { obraId: 'o1', campos: { inicio_plan: '2026-10-01' }, linhas: [] })
    ).rejects.toThrow(/presente.*em "campos".*não mudou/i)
  })
})
