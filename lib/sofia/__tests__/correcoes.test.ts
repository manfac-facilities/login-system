import {
  contextosCorrecaoKm,
  kmVeiculoDepois,
  erroCorrecaoKm,
  contextosCorrecaoAbastecimento,
  validarCorrecaoAbastecimento,
  valorOriginalKm,
  linhaHistoricoCorrecao,
  bannersCorrecaoKm,
  fmtKm,
  fmtLitros,
  fmtBrl,
} from '../correcoes'

const lancs = [
  { id: 'k1', veiculo_id: 'v1', data: '2000-01-01', km_atual: 1000 },
  { id: 'k3', veiculo_id: 'v1', data: '2000-01-03', km_atual: 2100 },
  { id: 'k2', veiculo_id: 'v1', data: '2000-01-02', km_atual: 1100 },
  { id: 'x1', veiculo_id: 'v2', data: '2000-01-02', km_atual: 5000 },
]

describe('formatação pt-BR', () => {
  it('km, litros e reais', () => {
    expect(fmtKm(47904)).toBe('47.904')
    expect(fmtLitros(3.8)).toBe('3,8')
    expect(fmtLitros(42.35)).toBe('42,35')
    expect(fmtBrl(22.8)).toBe('R$ 22,80')
  })
})

describe('contextosCorrecaoKm', () => {
  const ctx = contextosCorrecaoKm(lancs)

  it('primeiro lançamento: sem anterior', () => {
    expect(ctx.get('k1')).toEqual({
      anterior: null,
      seguinte: { data: '2000-01-02', km: 1100 },
      maxOutros: 2100,
    })
  })

  it('último lançamento: sem seguinte, maxOutros ignora ele mesmo', () => {
    expect(ctx.get('k3')).toEqual({
      anterior: { data: '2000-01-02', km: 1100 },
      seguinte: null,
      maxOutros: 1100,
    })
  })

  it('meio: vizinhos imediatos do mesmo veículo', () => {
    const c = ctx.get('k2')!
    expect(c.anterior).toEqual({ data: '2000-01-01', km: 1000 })
    expect(c.seguinte).toEqual({ data: '2000-01-03', km: 2100 })
  })

  it('veículo com um só lançamento: maxOutros null', () => {
    expect(ctx.get('x1')).toEqual({ anterior: null, seguinte: null, maxOutros: null })
  })
})

describe('kmVeiculoDepois', () => {
  const ctx = contextosCorrecaoKm(lancs)
  it('corrigir o máximo (2100 -> 1150) recalcula para 1150', () => {
    expect(kmVeiculoDepois(ctx.get('k3')!, 1150)).toBe(1150)
  })
  it('corrigir o meio mantém o máximo', () => {
    expect(kmVeiculoDepois(ctx.get('k2')!, 1050)).toBe(2100)
  })
  it('único lançamento: vira o novo valor', () => {
    expect(kmVeiculoDepois(ctx.get('x1')!, 4000)).toBe(4000)
  })
})

describe('erroCorrecaoKm', () => {
  const ctx = contextosCorrecaoKm(lancs).get('k2')!
  it('vazio', () => expect(erroCorrecaoKm(ctx, 1100, '')).toBe('Informe o KM correto.'))
  it('negativo', () => expect(erroCorrecaoKm(ctx, 1100, '-1')).toBe('Informe o KM correto.'))
  it('não inteiro', () =>
    expect(erroCorrecaoKm(ctx, 1100, '1050.5')).toBe('O KM precisa ser um número inteiro, sem vírgula ou ponto.'))
  it('abaixo do anterior', () =>
    expect(erroCorrecaoKm(ctx, 1100, '999')).toBe(
      'O KM não pode ser menor que o lançamento anterior: 1.000 km em 01/01/2000.'
    ))
  it('acima do seguinte', () =>
    expect(erroCorrecaoKm(ctx, 1100, '2101')).toBe(
      'O KM não pode ser maior que o lançamento seguinte: 2.100 km em 03/01/2000.'
    ))
  it('igual', () => expect(erroCorrecaoKm(ctx, 1100, '1100')).toBe('O valor é igual ao lançado. Nada a corrigir.'))
  it('limites são inclusivos', () => {
    expect(erroCorrecaoKm(ctx, 1100, '1000')).toBeNull()
    expect(erroCorrecaoKm(ctx, 1100, '2100')).toBeNull()
  })
})

describe('contextosCorrecaoAbastecimento', () => {
  const abs = [
    { id: 'a1', veiculo_id: 'v1', data: '2026-10-01', created_at: '2026-10-01T10:00:00Z', litros: 40, valor: 240, km: 1000 },
    { id: 'a2', veiculo_id: 'v1', data: '2026-10-02', created_at: '2026-10-02T10:00:00Z', litros: 423, valor: 253.38, km: 1080 },
    { id: 'a3', veiculo_id: 'v1', data: '2026-10-03', created_at: '2026-10-03T10:00:00Z', litros: 38, valor: 230, km: null },
    { id: 'a4', veiculo_id: 'v1', data: '2026-10-04', created_at: '2026-10-04T10:00:00Z', litros: 35, valor: 210, km: 1200 },
    // mesmo dia de a4, criado depois: desempate por created_at
    { id: 'a0', veiculo_id: 'v1', data: '2026-10-04', created_at: '2026-10-04T18:00:00Z', litros: 10, valor: 60, km: 1250 },
    { id: 'b1', veiculo_id: 'v1', data: '2026-09-30', created_at: '2026-09-30T10:00:00Z', litros: 20, valor: 100, km: 900 },
  ]
  const ctx = contextosCorrecaoAbastecimento(abs)

  it('pula o vizinho sem KM', () => {
    expect(ctx.get('a2')!.seguinte).toEqual({ data: '2026-10-04', km: 1200 })
    expect(ctx.get('a4')!.anterior).toEqual({ data: '2026-10-02', km: 1080 })
  })

  it('desempata o mesmo dia por created_at', () => {
    expect(ctx.get('a4')!.seguinte).toEqual({ data: '2026-10-04', km: 1250 })
    expect(ctx.get('a0')!.anterior).toEqual({ data: '2026-10-04', km: 1200 })
    expect(ctx.get('a0')!.seguinte).toBeNull()
  })

  it('soma o consumo do mesmo veículo no mesmo mês', () => {
    const c = ctx.get('a2')!
    expect(c.mes).toBe('2026-10')
    expect(c.mesLitros).toBeCloseTo(40 + 423 + 38 + 35 + 10)
    expect(c.mesValor).toBeCloseTo(240 + 253.38 + 230 + 210 + 60)
    expect(ctx.get('b1')!.mesLitros).toBe(20)
  })
})

describe('validarCorrecaoAbastecimento', () => {
  const ctx = { anterior: { data: '2026-10-01', km: 1000 }, seguinte: { data: '2026-10-04', km: 1200 }, mes: '2026-10', mesLitros: 0, mesValor: 0 }
  const lanc = { litros: 423, valor: 253.38, km: 1080 }
  const v = (litros: string, valor: string, km: string) => validarCorrecaoAbastecimento(ctx, lanc, { litros, valor, km })

  it('mensagens do mockup', () => {
    expect(v('', '1', '')).toEqual({ erro: 'Informe os litros abastecidos.' })
    expect(v('-1', '1', '')).toEqual({ erro: 'Informe os litros abastecidos.' })
    expect(v('1', '', '')).toEqual({ erro: 'Informe o valor do abastecimento.' })
    expect(v('1', '1', '1.5')).toEqual({ erro: 'KM inválido.' })
    expect(v('42.3', '253.38', '990')).toEqual({
      erro: 'O KM não pode ser menor que o do abastecimento anterior: 1.000 km em 01/10/2026.',
    })
    expect(v('42.3', '253.38', '1201')).toEqual({
      erro: 'O KM não pode ser maior que o do abastecimento seguinte: 1.200 km em 04/10/2026.',
    })
    expect(v('423', '253.38', '1080')).toEqual({ erro: 'Nada foi alterado.' })
  })

  it('KM vazio vira null (apagar o KM é uma alteração)', () => {
    expect(v('423', '253.38', '')).toEqual({ valores: { litros: 423, valor: 253.38, km: null } })
  })

  it('B1: KM igual ao lançado não é comparado com vizinhos fora de ordem', () => {
    const foraDeOrdem = validarCorrecaoAbastecimento(
      { ...ctx, anterior: { data: '2026-10-01', km: 5000 } },
      lanc,
      { litros: '42.3', valor: '253.38', km: '1080' }
    )
    expect(foraDeOrdem).toEqual({ valores: { litros: 42.3, valor: 253.38, km: 1080 } })
  })
})

describe('valorOriginalKm', () => {
  const correcoes = [
    { registro_id: 'k3', created_at: '2026-10-12T15:00:00Z', dados: { antes: { km_atual: 1500 } } },
    { registro_id: 'k3', created_at: '2026-10-12T14:00:00Z', dados: { antes: { km_atual: 2100 } } },
    { registro_id: 'k9', created_at: '2026-10-12T14:00:00Z', dados: { antes: { km_atual: 10 } } },
  ]
  it('pega o antes da 1ª correção', () => expect(valorOriginalKm(correcoes, 'k3', 1150)).toBe(2100))
  it('null se voltou ao original', () => expect(valorOriginalKm(correcoes, 'k3', 2100)).toBeNull())
  it('null se nunca foi corrigido', () => expect(valorOriginalKm(correcoes, 'k1', 1000)).toBeNull())
})

describe('bannersCorrecaoKm — nada de texto livre da URL', () => {
  const veiculos = [{ id: 'v1', placa: 'PLW-3E07', km_atual: 48230 }]

  it('id de veículo + código: textos constantes com placa e KM do banco', () => {
    expect(bannersCorrecaoKm({ corrigido: 'v1', aviso: 'registro' }, veiculos)).toEqual({
      sucesso: 'KM corrigido. O KM atual do PLW-3E07 agora é 48.230 km. A correção foi para o histórico.',
      aviso: 'Este mês tem registro de KM excedido para o PLW-3E07. A correção não altera esse registro — confira em Descontos.',
    })
    expect(bannersCorrecaoKm({ corrigido: 'v1', aviso: 'falha' }, veiculos)?.aviso).toBe(
      'Não foi possível conferir se este mês tem registro de KM excedido para o PLW-3E07. Confira em Descontos.'
    )
  })

  it('id inexistente ou texto forjado: não mostra nada', () => {
    expect(bannersCorrecaoKm({ corrigido: 'Seu desconto foi aprovado' }, veiculos)).toBeNull()
    expect(bannersCorrecaoKm({}, veiculos)).toBeNull()
  })

  it('aviso desconhecido é ignorado', () => {
    expect(bannersCorrecaoKm({ corrigido: 'v1', aviso: 'Desconto de R$ 900 aprovado' }, veiculos)?.aviso).toBeNull()
  })
})

describe('linhaHistoricoCorrecao', () => {
  it('KM diário com recálculo do veículo', () => {
    const l = linhaHistoricoCorrecao({
      registro_id: 'k',
      created_at: '2026-10-12T17:32:00Z', // 14:32 em Brasília
      usuario_email: 'patricia@manfac.com.br',
      dados: {
        tipo: 'correcao_km',
        contexto: { equipe: 'MANFAC-03', placa: 'RTE-4F21', data: '2026-10-10' },
        antes: { km_atual: 47904 },
        depois: { km_atual: 47409 },
        km_veiculo: { antes: 47904, depois: 47409 },
        motivo: 'Digitou 9 no lugar de 4',
        autor: { email: 'patricia@manfac.com.br', nome: 'Patrícia Ramos', papel: 'administrador' },
      },
    })
    expect(l).toEqual({
      quando: '12/10/2026 14:32',
      quem: 'Patrícia Ramos (administrador)',
      email: 'patricia@manfac.com.br',
      oque: 'KM diário · MANFAC-03 · RTE-4F21 · lançamento de 10/10',
      kmVeiculo: 'KM atual do veículo recalculado: 47.904 → 47.409 km',
      antes: '47.904 km',
      depois: '47.409 km',
      motivo: 'Digitou 9 no lugar de 4',
    })
  })

  it('KM do meio: sem linha de recálculo', () => {
    const l = linhaHistoricoCorrecao({
      registro_id: 'k', created_at: '2026-10-12T17:32:00Z',
      dados: { tipo: 'correcao_km', contexto: {}, antes: { km_atual: 1 }, depois: { km_atual: 2 }, km_veiculo: { antes: 9, depois: 9 }, autor: {} },
    })
    expect(l.kmVeiculo).toBeNull()
  })

  it('abastecimento: só os campos mudados, motivo nulo vira —, nome cai para e-mail', () => {
    const l = linhaHistoricoCorrecao({
      registro_id: 'a', created_at: '2026-10-06T12:10:00Z',
      dados: {
        tipo: 'correcao_abastecimento',
        contexto: { placa: 'SGU-2C93', data: '2026-10-05' },
        antes: { litros: 3.8, valor: 22.8, km: 1080 },
        depois: { litros: 38, valor: 228, km: null },
        motivo: null,
        autor: { email: 'igor@manfac.com.br', nome: null, papel: 'gestor de frotas' },
      },
    })
    expect(l.quem).toBe('igor@manfac.com.br (gestor de frotas)')
    expect(l.oque).toBe('Abastecimento · SGU-2C93 · 05/10')
    expect(l.antes).toBe('3,8 L · R$ 22,80 · 1.080 km')
    expect(l.depois).toBe('38,0 L · R$ 228,00 · — km')
    expect(l.motivo).toBe('—')
  })
})
