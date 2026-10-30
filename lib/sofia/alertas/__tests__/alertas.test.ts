import { diaUtilAnterior, montarAlertas, type EntradaAlertas } from '../blocos'
import { assuntoDe, emailDe, nomeDoEmail } from '../email'
import { hojeBrasilia } from '../leitura'

// 30/10/2026 é sexta-feira.
const HOJE = '2026-10-30'

const vazia = (): EntradaAlertas => ({
  hoje: HOJE,
  veiculos: [],
  equipes: [],
  motoristas: [],
  revisoes: [],
  documentos: [],
  multas: [],
  sinistros: [],
  equipesComKmNoDiaUtilAnterior: [],
})

function cheia(): EntradaAlertas {
  return {
    ...vazia(),
    veiculos: [
      { id: 'v1', placa: 'KPF7N16', km_atual: 50500, status: 'ativo', equipe_id: 'q1', previsao_retorno_oficina: null },
      { id: 'v2', placa: 'RIO3D45', km_atual: 10000, status: 'ativo', equipe_id: 'q2', previsao_retorno_oficina: null },
      { id: 'v3', placa: 'RUA3B76', km_atual: 1, status: 'manutencao', equipe_id: null, previsao_retorno_oficina: '2026-10-27' },
      { id: 'v4', placa: 'ZZZ0000', km_atual: 1, status: 'inativo', equipe_id: 'q3', previsao_retorno_oficina: null },
    ],
    equipes: [
      { id: 'q1', codigo: 'EQ-01', ativo: true },
      { id: 'q2', codigo: 'EQ-02', ativo: true },
      { id: 'q3', codigo: 'EQ-03', ativo: true },
      { id: 'q4', codigo: 'EQ-04', ativo: false },
    ],
    motoristas: [
      { nome: 'Jefferson Alves', cnh_vencimento: '2026-10-20', equipe_id: 'q1', ativo: true },
      { nome: 'Marcos Rocha', cnh_vencimento: '2026-12-15', equipe_id: 'q2', ativo: true },
      { nome: 'Longe Demais', cnh_vencimento: '2027-12-15', equipe_id: null, ativo: true },
      { nome: 'Inativo', cnh_vencimento: '2026-01-01', equipe_id: null, ativo: false },
    ],
    revisoes: [
      // antiga (substituída) — não conta
      { veiculo_id: 'v1', tipo: 'preventiva', proxima_data: '2020-01-01', proxima_km: null, created_at: '2026-01-01' },
      { veiculo_id: 'v1', tipo: 'preventiva', proxima_data: null, proxima_km: 50000, created_at: '2026-09-01' },
      { veiculo_id: 'v2', tipo: 'preventiva', proxima_data: null, proxima_km: 10500, created_at: '2026-09-01' },
    ],
    documentos: [
      { veiculo_id: 'v1', tipo: 'ipva', vencimento: '2026-10-25' },
      { veiculo_id: 'v2', tipo: 'seguro', vencimento: '2026-11-09' },
      { veiculo_id: 'v2', tipo: 'licenciamento', vencimento: '2026-12-31' },
    ],
    multas: [
      { veiculo_id: 'v1', motorista_nome: 'Jefferson Alves', data: '2026-10-02', valor: 130.16, status: 'pendente' },
      { veiculo_id: 'v2', motorista_nome: null, data: '2026-09-01', valor: 10, status: 'descontada' },
    ],
    sinistros: [
      { veiculo_id: 'v2', data: '2026-10-10', tipo: 'colisao', status: 'em_tratativa' },
      { veiculo_id: 'v1', data: '2026-09-10', tipo: 'furto', status: 'encerrado' },
    ],
    equipesComKmNoDiaUtilAnterior: ['q1'],
  }
}

const bloco = (a: ReturnType<typeof montarAlertas>, chave: string) => a.blocos.find((b) => b.chave === chave)

describe('diaUtilAnterior', () => {
  it.each([
    ['2026-10-30', '2026-10-29'], // sexta → quinta
    ['2026-11-02', '2026-10-30'], // segunda → sexta
    ['2026-11-01', '2026-10-30'], // domingo → sexta
    ['2026-10-31', '2026-10-30'], // sábado → sexta
  ])('%s → %s', (hoje, esperado) => expect(diaUtilAnterior(hoje)).toBe(esperado))
})

describe('montarAlertas', () => {
  it('sem nada: zero blocos', () => {
    const a = montarAlertas(vazia())
    expect(a.total).toBe(0)
    expect(a.blocos).toEqual([])
  })

  it('revisões: só a mais recente conta; atrasada por KM, chegando a 1.000 km', () => {
    const a = montarAlertas(cheia())
    const atr = bloco(a, 'revisoes_atrasadas')!
    expect(atr.itens).toHaveLength(1)
    expect(atr.itens[0].rotulo).toBe('KPF7N16')
    expect(atr.itens[0].detalhe).toContain('por KM')
    expect(atr.itens[0].detalhe).toContain('500 km')
    expect(atr.itens[0].detalhe).toContain('EQ-01')
    const breve = bloco(a, 'revisoes_chegando')!
    expect(breve.itens.map((i) => i.rotulo)).toEqual(['RIO3D45'])
    expect(breve.itens[0].detalhe).toContain('faltam 500 km')
  })

  it('revisão atrasada por data mostra dias de atraso', () => {
    const e = cheia()
    e.revisoes = [{ veiculo_id: 'v1', tipo: 'x', proxima_data: '2026-10-20', proxima_km: null, created_at: '2026-09-01' }]
    const it = bloco(montarAlertas(e), 'revisoes_atrasadas')!.itens[0]
    expect(it.detalhe).toContain('por data')
    expect(it.detalhe).toContain('20/10/2026')
    expect(it.detalhe).toContain('10 dias')
  })

  it('documentos: vencido e vencendo em 30 dias; fora da janela não entra', () => {
    const itens = bloco(montarAlertas(cheia()), 'documentos')!.itens
    expect(itens.map((i) => [i.rotulo, i.vencido])).toEqual([
      ['KPF7N16', true],
      ['RIO3D45', false],
    ])
    expect(itens[0].detalhe).toContain('venceu em 25/10/2026')
    expect(itens[1].detalhe).toContain('(10 dias)')
  })

  it('CNH: vencida e vencendo aparecem; inativo e distante não', () => {
    const itens = bloco(montarAlertas(cheia()), 'cnh')!.itens
    expect(itens.map((i) => i.rotulo)).toEqual(['Jefferson Alves', 'Marcos Rocha'])
    expect(itens[0].vencido).toBe(true)
    expect(itens[1].vencido).toBe(false)
  })

  it('multas sem tratativa e sinistros abertos ignoram descontada/encerrado', () => {
    const a = montarAlertas(cheia())
    expect(bloco(a, 'multas')!.itens).toHaveLength(1)
    expect(bloco(a, 'multas')!.itens[0].detalhe).toContain('Jefferson Alves')
    expect(bloco(a, 'sinistros')!.itens).toHaveLength(1)
    expect(bloco(a, 'sinistros')!.itens[0].rotulo).toBe('RIO3D45')
  })

  it('equipes sem KM: só ativa, com carro não inativo, que não lançou no dia útil anterior', () => {
    const itens = bloco(montarAlertas(cheia()), 'equipes_sem_km')!.itens
    // q1 lançou; q3 só tem carro inativo; q4 inativa
    expect(itens.map((i) => i.rotulo)).toEqual(['EQ-02'])
    expect(itens[0].detalhe).toContain('RIO3D45')
    expect(itens[0].detalhe).toContain('Marcos Rocha')
  })

  it('volta da oficina atrasada só com previsão passada', () => {
    const a = montarAlertas(cheia())
    expect(bloco(a, 'oficina')!.itens[0].detalhe).toContain('3 dias')
    const e = cheia()
    e.veiculos[2].previsao_retorno_oficina = null
    expect(bloco(montarAlertas(e), 'oficina')).toBeUndefined()
  })

  it('segunda-feira cobra a sexta', () => {
    const e = { ...cheia(), hoje: '2026-11-02' }
    expect(montarAlertas(e).diaUtilAnterior).toBe('2026-10-30')
    expect(bloco(montarAlertas(e), 'equipes_sem_km')!.titulo).toContain('sex 30/10')
  })
})

describe('email', () => {
  it('assunto com pendências', () => {
    const a = montarAlertas(cheia())
    expect(assuntoDe({ tipo: 'com', alertas: a })).toMatch(/^Frotas · sex 30\/10 · 1 revisão atrasada, 1 equipe sem KM e mais \d+ itens$/)
  })

  it('assunto nada pendente e falha', () => {
    expect(assuntoDe({ tipo: 'nada', hoje: HOJE })).toBe('Frotas · sex 30/10 · nada pendente hoje')
    expect(assuntoDe({ tipo: 'falha', hoje: HOJE })).toBe('Frotas · sex 30/10 · não conseguimos montar o resumo de hoje')
  })

  it('html com pendências: saudação, blocos, links para o hub e escape', () => {
    const e = cheia()
    e.motoristas[0].nome = '<script>x</script>'
    const m = emailDe({ tipo: 'com', alertas: montarAlertas(e) }, 'igor.silva@manfac.com.br')
    expect(m.html).toContain('Bom dia, Igor.')
    expect(m.html).toContain('Revisões atrasadas')
    expect(m.html).toContain('Abrir no hub →')
    expect(m.html).toContain('https://hub.manfac.com.br/sofia/revisoes')
    expect(m.html).not.toContain('<script>')
    expect(m.texto).toContain('REVISÕES ATRASADAS (1)')
    expect(m.texto).toContain('https://hub.manfac.com.br/sofia/revisoes')
  })

  it('nada pendente é curto; falha avisa que não significa "tudo em dia"', () => {
    const nada = emailDe({ tipo: 'nada', hoje: HOJE }, 'igor@manfac.com.br')
    expect(nada.html).toContain('está tudo em dia')
    expect(nada.html).not.toContain('Abrir no hub →')
    const falha = emailDe({ tipo: 'falha', hoje: HOJE }, 'igor@manfac.com.br')
    expect(falha.html).toContain('Isso não quer dizer que está tudo em dia')
    expect(falha.html).toContain('https://hub.manfac.com.br/sofia')
  })

  it('nomeDoEmail', () => {
    expect(nomeDoEmail('igor.silva@x.com')).toBe('Igor')
    expect(nomeDoEmail('a@x.com')).toBeNull()
  })
})

describe('hojeBrasilia', () => {
  it('usa o fuso de Brasília (02:00 UTC ainda é o dia anterior)', () => {
    expect(hojeBrasilia(new Date('2026-10-31T02:00:00Z'))).toBe('2026-10-30')
    expect(hojeBrasilia(new Date('2026-10-30T10:00:00Z'))).toBe('2026-10-30')
  })
})
