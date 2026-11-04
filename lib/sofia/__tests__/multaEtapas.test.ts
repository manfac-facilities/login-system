import {
  ETAPAS_MULTA,
  ORDEM_STEPPER,
  acaoPara,
  autorizacaoDaEtapa,
  classePrazo,
  ehEtapaMulta,
  ordemEtapa,
  podeTransicionar,
  prazoPadrao,
  proximasAcoes,
  statusDaEtapa,
  type MultaEtapa,
} from '../multaEtapas'

const GESTOR = { podeGerir: true, ehAdmin: false }
const ADMIN = { podeGerir: true, ehAdmin: true }
const COMUM = { podeGerir: false, ehAdmin: false }

describe('derivação status/autorização (espelho das funções SQL da spec §2.1)', () => {
  it.each<[MultaEtapa, number, string, string]>([
    ['registrada', 0, 'pendente', 'sem_solicitacao'],
    ['condutor', 1, 'pendente', 'sem_solicitacao'],
    ['termo', 2, 'pendente', 'sem_solicitacao'],
    ['indicado', 3, 'pendente', 'sem_solicitacao'],
    ['validada', 4, 'validada', 'sem_solicitacao'],
    ['contestada', 4, 'pendente', 'sem_solicitacao'],
    ['cobrada', 5, 'validada', 'sem_solicitacao'],
    ['solicitado', 6, 'validada', 'solicitado'],
    ['autorizado', 7, 'validada', 'autorizado'],
    ['descontada', 8, 'descontada', 'autorizado'],
  ])('%s → ordem %i, status %s, autorização %s', (etapa, ordem, status, autoriz) => {
    expect(ordemEtapa(etapa)).toBe(ordem)
    expect(statusDaEtapa(etapa)).toBe(status)
    expect(autorizacaoDaEtapa(etapa)).toBe(autoriz)
  })

  it('tem as 10 etapas, cada uma com rótulo, ator e textos', () => {
    expect(ETAPAS_MULTA).toHaveLength(10)
    for (const e of ETAPAS_MULTA) {
      expect(e.rotulo).toBeTruthy()
      expect(e.ator).toBeTruthy()
      expect(e.hoje).toBeTruthy()
      expect(e.novo).toBeTruthy()
    }
  })

  it('o stepper tem as 9 etapas do caminho normal (contestada fora)', () => {
    expect(ORDEM_STEPPER).toHaveLength(9)
    expect(ORDEM_STEPPER).not.toContain('contestada')
  })

  it('ehEtapaMulta só aceita as 10 chaves', () => {
    expect(ehEtapaMulta('autorizado')).toBe(true)
    expect(ehEtapaMulta('pendente')).toBe(false)
    expect(ehEtapaMulta(null)).toBe(false)
  })
})

describe('transições (espelho da trigger trg_multas_etapa)', () => {
  it('avançar e pular para frente é permitido', () => {
    expect(podeTransicionar('registrada', 'condutor')).toBe(true)
    expect(podeTransicionar('registrada', 'indicado')).toBe(true)
    expect(podeTransicionar('validada', 'solicitado')).toBe(true)
  })
  it('ninguém chega a autorizado sem passar por solicitado', () => {
    expect(podeTransicionar('cobrada', 'autorizado')).toBe(false)
    expect(podeTransicionar('registrada', 'autorizado')).toBe(false)
    expect(podeTransicionar('solicitado', 'autorizado')).toBe(true)
  })
  it('descontada só a partir de autorizado', () => {
    expect(podeTransicionar('solicitado', 'descontada')).toBe(false)
    expect(podeTransicionar('cobrada', 'descontada')).toBe(false)
    expect(podeTransicionar('autorizado', 'descontada')).toBe(true)
  })
  it('contestada só antes de validada, e é final', () => {
    for (const de of ['registrada', 'condutor', 'termo', 'indicado'] as MultaEtapa[])
      expect(podeTransicionar(de, 'contestada')).toBe(true)
    expect(podeTransicionar('validada', 'contestada')).toBe(false)
    expect(podeTransicionar('cobrada', 'contestada')).toBe(false)
    expect(podeTransicionar('contestada', 'validada')).toBe(false)
    expect(podeTransicionar('contestada', 'registrada')).toBe(false)
  })
  it('voltar só nos 3 casos', () => {
    expect(podeTransicionar('autorizado', 'solicitado')).toBe(true)
    expect(podeTransicionar('solicitado', 'cobrada')).toBe(true)
    expect(podeTransicionar('descontada', 'autorizado')).toBe(true)
    expect(podeTransicionar('solicitado', 'validada')).toBe(false)
    expect(podeTransicionar('indicado', 'termo')).toBe(false)
    expect(podeTransicionar('autorizado', 'cobrada')).toBe(false)
    expect(podeTransicionar('descontada', 'solicitado')).toBe(false)
  })
  it('repetir a etapa atual não é transição (RPC recusa)', () => {
    expect(podeTransicionar('indicado', 'indicado')).toBe(false)
    expect(podeTransicionar('autorizado', 'autorizado')).toBe(false)
  })
})

describe('acaoPara / proximasAcoes (quem pode)', () => {
  it('gestor não autoriza: ação aparece desabilitada com o motivo', () => {
    const a = acaoPara('solicitado', 'autorizado', GESTOR)!
    expect(a.permitida).toBe(false)
    expect(a.motivo).toBe('Só administrador pode.')
  })
  it('gestor não revoga', () => {
    const a = acaoPara('autorizado', 'solicitado', GESTOR)!
    expect(a.rotulo).toBe('Revogar autorização')
    expect(a.permitida).toBe(false)
  })
  it('admin autoriza e revoga', () => {
    expect(acaoPara('solicitado', 'autorizado', ADMIN)!.permitida).toBe(true)
    expect(acaoPara('autorizado', 'solicitado', ADMIN)!.permitida).toBe(true)
  })
  it('comum não registra nenhuma etapa', () => {
    const a = acaoPara('registrada', 'condutor', COMUM)!
    expect(a.permitida).toBe(false)
    expect(a.motivo).toBe('Só gestor de frotas ou administrador.')
  })
  it('transição proibida → null', () => {
    expect(acaoPara('cobrada', 'descontada', ADMIN)).toBeNull()
  })
  it('a partir de solicitado: autorizar + cancelar solicitação', () => {
    const acoes = proximasAcoes('solicitado', GESTOR)
    expect(acoes.map((a) => a.destino)).toEqual(['autorizado', 'cobrada'])
    expect(acoes.find((a) => a.destino === 'cobrada')!.rotulo).toBe('Cancelar solicitação')
    expect(acoes.find((a) => a.destino === 'cobrada')!.permitida).toBe(true)
  })
  it('a partir de autorizado: registrar desconto + revogar', () => {
    expect(proximasAcoes('autorizado', ADMIN).map((a) => a.destino)).toEqual(['descontada', 'solicitado'])
  })
  it('a partir de descontada: só desfazer', () => {
    const acoes = proximasAcoes('descontada', GESTOR)
    expect(acoes.map((a) => [a.destino, a.rotulo])).toEqual([['autorizado', 'Desfazer desconto']])
  })
  it('antes de validada: próxima + contestar', () => {
    expect(proximasAcoes('indicado', GESTOR).map((a) => a.destino)).toEqual(['validada', 'contestada'])
  })
  it('contestada: nenhuma ação', () => {
    expect(proximasAcoes('contestada', ADMIN)).toEqual([])
  })
})

describe('classePrazo', () => {
  const HOJE = '2026-11-03'
  it.each([
    ['2026-11-02', 'vencido', -1, 'prazo vencido: paga em dobro'],
    ['2026-11-03', 'urgente', 0, 'vence em 0 d'],
    ['2026-11-08', 'urgente', 5, 'vence em 5 d'],
    ['2026-11-09', 'atencao', 6, 'vence em 6 d'],
    ['2026-11-13', 'atencao', 10, 'vence em 10 d'],
    ['2026-11-14', 'normal', 11, 'vence em 11 d'],
  ])('prazo %s → %s', (prazo, tipo, dias, texto) => {
    expect(classePrazo(prazo, 'termo', HOJE)).toEqual({ tipo, dias, texto })
  })
  it('a partir de indicado vira "indicado", mesmo com prazo vencido', () => {
    for (const e of ['indicado', 'validada', 'cobrada', 'solicitado', 'autorizado', 'descontada'] as MultaEtapa[])
      expect(classePrazo('2026-01-01', e, HOJE)).toEqual({ tipo: 'indicado', dias: null, texto: 'indicado' })
  })
  it('sem prazo antes da indicação → null; contestada → null', () => {
    expect(classePrazo(null, 'registrada', HOJE)).toBeNull()
    expect(classePrazo('2026-11-02', 'contestada', HOJE)).toBeNull()
  })
})

describe('prazoPadrao (+30 dias, data pura)', () => {
  it.each([
    ['2026-11-03', '2026-12-03'],
    ['2026-01-31', '2026-03-02'],
    ['2026-12-15', '2027-01-14'],
    ['2028-02-01', '2028-03-02'],
  ])('%s → %s', (d, esperado) => {
    expect(prazoPadrao(d)).toBe(esperado)
  })
  it('entrada inválida → null', () => {
    expect(prazoPadrao('')).toBeNull()
    expect(prazoPadrao('03/11/2026')).toBeNull()
  })
})
