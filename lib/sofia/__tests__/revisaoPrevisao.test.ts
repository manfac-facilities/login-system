import {
  INTERVALO_REVISAO_KM_PADRAO,
  classificarCarro,
  classificarFrota,
  contarCartoes,
  intervaloDoVeiculo,
  mediaKmDia,
  proximaEfetiva,
  revisaoVigente,
  textoPendencia,
  type RevisaoPrev,
  type VeiculoPrev,
} from '../revisaoPrevisao'

const HOJE = '2026-11-03'

function rev(p: Partial<RevisaoPrev> = {}): RevisaoPrev {
  return {
    id: 'r1',
    veiculo_id: 'v1',
    tipo: 'preventiva',
    km_realizada: 30000,
    data_realizada: '2026-09-01',
    created_at: '2026-09-01T12:00:00Z',
    proxima_km: null,
    proxima_data: null,
    prever_proxima: true,
    ...p,
  }
}

function veic(p: Partial<VeiculoPrev> = {}): VeiculoPrev {
  return { id: 'v1', placa: 'ABC1D23', modelo: 'HB20', km_atual: 35000, status: 'ativo', intervalo_revisao_km: null, ...p }
}

describe('intervalo', () => {
  it('padrão 10.000 e intervalo próprio', () => {
    expect(INTERVALO_REVISAO_KM_PADRAO).toBe(10000)
    expect(intervaloDoVeiculo(veic())).toBe(10000)
    expect(intervaloDoVeiculo(veic({ intervalo_revisao_km: 15000 }))).toBe(15000)
  })
})

describe('revisaoVigente', () => {
  it('é a de maior KM, não a criada por último (importada antiga não vira vigente)', () => {
    const atual = rev({ id: 'a', km_realizada: 40000, created_at: '2026-09-01T00:00:00Z' })
    const importadaAntiga = rev({ id: 'b', km_realizada: 20000, created_at: '2026-11-02T00:00:00Z' })
    expect(revisaoVigente([importadaAntiga, atual])?.id).toBe('a')
  })
  it('KM nulo vai para o fim', () => {
    expect(revisaoVigente([rev({ id: 'n', km_realizada: null }), rev({ id: 'k', km_realizada: 100 })])?.id).toBe('k')
  })
  it('empate de KM: data mais recente, depois created_at', () => {
    const a = rev({ id: 'a', km_realizada: 30000, data_realizada: '2026-08-01' })
    const b = rev({ id: 'b', km_realizada: 30000, data_realizada: '2026-09-01' })
    expect(revisaoVigente([a, b])?.id).toBe('b')
    const c = rev({ id: 'c', km_realizada: 30000, data_realizada: '2026-09-01', created_at: '2026-09-02T00:00:00Z' })
    expect(revisaoVigente([b, c])?.id).toBe('c')
  })
  it('lista vazia → null', () => {
    expect(revisaoVigente([])).toBeNull()
  })
})

describe('proximaEfetiva', () => {
  it('sem proxima_km: km + intervalo, auto', () => {
    expect(proximaEfetiva(rev(), 10000)).toEqual({ km: 40000, auto: true })
  })
  it('intervalo próprio 15.000', () => {
    expect(proximaEfetiva(rev(), 15000)).toEqual({ km: 45000, auto: true })
  })
  it('proxima_km igual a km + intervalo continua auto', () => {
    expect(proximaEfetiva(rev({ proxima_km: 40000 }), 10000)).toEqual({ km: 40000, auto: true })
  })
  it('proxima_km manual diferente → auto = false', () => {
    expect(proximaEfetiva(rev({ proxima_km: 38000 }), 10000)).toEqual({ km: 38000, auto: false })
  })
  it('prever_proxima = false → nenhuma', () => {
    expect(proximaEfetiva(rev({ prever_proxima: false, proxima_km: 40000 }), 10000)).toEqual({ km: null, auto: false })
  })
})

describe('mediaKmDia', () => {
  it('um lançamento → null', () => {
    expect(mediaKmDia([{ data: '2026-11-01', km_atual: 100 }], HOJE)).toBeNull()
  })
  it('dois dias: (maior − menor) / dias entre o primeiro e o último', () => {
    expect(mediaKmDia([{ data: '2026-11-01', km_atual: 1000 }, { data: '2026-10-30', km_atual: 880 }], HOJE)).toBe(60)
  })
  it('ignora lançamentos de mais de 30 dias', () => {
    expect(mediaKmDia([{ data: '2026-09-01', km_atual: 0 }, { data: '2026-11-01', km_atual: 1000 }], HOJE)).toBeNull()
  })
  it('vários lançamentos no mesmo dia não contam como dois dias', () => {
    expect(mediaKmDia([{ data: '2026-11-01', km_atual: 100 }, { data: '2026-11-01', km_atual: 200 }], HOJE)).toBeNull()
  })
  it('sem variação → null', () => {
    expect(mediaKmDia([{ data: '2026-11-01', km_atual: 100 }, { data: '2026-11-02', km_atual: 100 }], HOJE)).toBeNull()
  })
})

describe('classificarCarro', () => {
  const km = (d: string, k: number) => ({ data: d, km_atual: k })

  it('sem revisão → sembase', () => {
    expect(classificarCarro(veic(), [], [], HOJE).s).toBe('sembase')
  })
  it('corretiva vigente com prever_proxima=false → semprev', () => {
    const c = classificarCarro(veic(), [rev({ tipo: 'corretiva', prever_proxima: false, km_realizada: 34000 }), rev({ id: 'x', km_realizada: 30000 })], [], HOJE)
    expect(c.s).toBe('semprev')
    expect(c.vigente?.tipo).toBe('corretiva')
  })
  it('sem KM e sem próxima data → semprev', () => {
    expect(classificarCarro(veic(), [rev({ km_realizada: null })], [], HOJE).s).toBe('semprev')
  })
  it('atrasada na igualdade (km atual = próxima)', () => {
    const c = classificarCarro(veic({ km_atual: 40000 }), [rev()], [], HOJE)
    expect(c.s).toBe('atrasada')
    expect(c.passou).toBe(0)
    expect(c.proxima).toBe(40000)
  })
  it('atrasada por data passada', () => {
    const c = classificarCarro(veic(), [rev({ proxima_data: '2026-11-02' })], [], HOJE)
    expect(c.s).toBe('atrasada')
    expect(c.porData).toBe(true)
    expect(c.passou).toBeNull()
  })
  it('breve com 1.000 exatos', () => {
    const c = classificarCarro(veic({ km_atual: 39000 }), [rev()], [], HOJE)
    expect(c.s).toBe('breve')
    expect(c.falta).toBe(1000)
  })
  it('em dia com 1.001', () => {
    expect(classificarCarro(veic({ km_atual: 38999 }), [rev()], [], HOJE).s).toBe('dia')
  })
  it('dias = ceil(falta / média) e quando em AAAA-MM-DD', () => {
    const c = classificarCarro(veic({ km_atual: 35000 }), [rev()], [km('2026-10-31', 34880), km('2026-11-02', 35000)], HOJE)
    expect(c.media).toBe(60)
    expect(c.falta).toBe(5000)
    expect(c.dias).toBe(84) // 5000/60 = 83,3 → 84
    expect(c.quando).toBe('2027-01-26')
  })
  it('sem média: sem dias nem quando', () => {
    const c = classificarCarro(veic(), [rev()], [], HOJE)
    expect(c.media).toBeNull()
    expect(c.dias).toBeNull()
    expect(c.quando).toBeNull()
  })
  it('intervalo próprio desloca a próxima', () => {
    const c = classificarCarro(veic({ km_atual: 41000, intervalo_revisao_km: 15000 }), [rev()], [], HOJE)
    expect(c.proxima).toBe(45000)
    expect(c.s).toBe('dia')
    expect(c.auto).toBe(true)
  })
})

describe('classificarFrota e cartões', () => {
  const vs = [
    veic({ id: 'a', placa: 'AAA', km_atual: 41000 }), // atrasada
    veic({ id: 'b', placa: 'BBB', km_atual: 39500 }), // breve 500
    veic({ id: 'c', placa: 'CCC', km_atual: 39200 }), // breve 800
    veic({ id: 'd', placa: 'DDD', km_atual: 37000 }), // dia 3000, média 120 → 25 dias
    veic({ id: 'e', placa: 'EEE', km_atual: 31000 }), // dia 9000 sem média
    veic({ id: 'f', placa: 'FFF' }), // sem base
    veic({ id: 'g', placa: 'GGG', status: 'inativo' }), // fora
    veic({ id: 'h', placa: 'HHH', status: 'manutencao', km_atual: 30500 }), // semprev
  ]
  const revs = [
    rev({ id: 'ra', veiculo_id: 'a' }), rev({ id: 'rb', veiculo_id: 'b' }), rev({ id: 'rc', veiculo_id: 'c' }),
    rev({ id: 'rd', veiculo_id: 'd' }), rev({ id: 're', veiculo_id: 'e' }),
    rev({ id: 'rh', veiculo_id: 'h', tipo: 'corretiva', prever_proxima: false }),
    rev({ id: 'rg', veiculo_id: 'g' }),
  ]
  const lanc = [
    { veiculo_id: 'd', data: '2026-11-01', km_atual: 36880 },
    { veiculo_id: 'd', data: '2026-11-02', km_atual: 37000 },
  ]

  it('um por veículo não inativo, do mais urgente ao menos, e por falta', () => {
    const lista = classificarFrota(vs, revs, lanc, HOJE)
    expect(lista.map((x) => x.veiculo.placa)).toEqual(['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'HHH', 'FFF'])
    expect(lista.map((x) => x.s)).toEqual(['atrasada', 'breve', 'breve', 'dia', 'dia', 'semprev', 'sembase'])
  })

  it('contarCartoes: d30 só conta "dia" com dias ≤ 30', () => {
    const lista = classificarFrota(vs, revs, lanc, HOJE)
    expect(contarCartoes(lista)).toEqual({ atrasada: 1, breve: 2, d30: 1, sp: 2 })
  })
})

describe('textoPendencia', () => {
  it('atrasada por KM', () => {
    const c = classificarCarro(veic({ km_atual: 41200 }), [rev()], [], HOJE)
    expect(textoPendencia({ ...c, veiculo: veic() })).toEqual({
      titulo: 'Revisão — ABC1D23 (HB20)',
      detalhe: 'passou 1.200 km do previsto (40.000)',
    })
  })
  it('vence em breve com média', () => {
    const c = classificarCarro(veic({ km_atual: 39400 }), [rev()], [{ data: '2026-11-01', km_atual: 39280 }, { data: '2026-11-02', km_atual: 39400 }], HOJE)
    expect(textoPendencia({ ...c, veiculo: veic() }).detalhe).toBe('faltam 600 km para 40.000 · chega em ~5 dias')
  })
  it('vence em breve sem média', () => {
    const c = classificarCarro(veic({ km_atual: 39400 }), [rev()], [], HOJE)
    expect(textoPendencia({ ...c, veiculo: veic() }).detalhe).toBe('faltam 600 km para 40.000')
  })
  it('atrasada só por data', () => {
    const c = classificarCarro(veic(), [rev({ proxima_data: '2026-10-20' })], [], HOJE)
    expect(textoPendencia({ ...c, veiculo: veic() }).detalhe).toBe('a data prevista (20/10/2026) já passou')
  })
})
