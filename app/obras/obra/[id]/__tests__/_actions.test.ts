/**
 * Testes de `mudarEtapaAction` — os marcos da esteira, decisões do João de
 * 21/09 (`docs/cliente/2026-09-21-decisoes-marcos-da-esteira.md`).
 *
 * O defeito: `marco_exec_fim`, `marco_relatorio`, `marco_fechou_os`,
 * `marco_liberou_fat` e `marco_faturou` são LIDOS pela ficha (`_ficha.tsx`,
 * `MARCO_DE` e `Esteira`) mas nenhum código os grava — `mudarEtapaAction` é a
 * única ação que muda etapa e só tocava `etapa`/`desde_etapa`/`atualizacao`.
 *
 * Mesmo padrão de `app/obras/__tests__/ficha-editavel.test.ts`:
 * Supabase, `next/cache` e `lib/auth/systemAccess` mockados;
 * `app/obras/_lib/historico.ts` roda de VERDADE — a trava de
 * `gravarComHistorico` lança se `p_campos` trouxer uma coluna rastreada sem
 * a linha de histórico correspondente, e é isso que prova que os marcos e o
 * histórico saem coerentes entre si.
 */

const getUserMock = jest.fn()
const rpcMock = jest.fn()
const updateMock = jest.fn()
const eqUpdateMock = jest.fn()

let obraAtual: Record<string, unknown> | null = null

const fromMock = jest.fn((tabela: string) => {
  if (tabela === 'obras_obra') {
    const alvo: Record<string, unknown> = {}
    alvo.select = jest.fn(() => alvo)
    alvo.eq = jest.fn(() => alvo)
    alvo.maybeSingle = jest.fn(async () => ({ data: obraAtual, error: null }))
    alvo.update = updateMock
    return alvo
  }
  throw new Error(`tabela inesperada no mock: ${tabela}`)
})

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
    rpc: rpcMock,
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))

import { revalidatePath } from 'next/cache'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import { hojeISO, type ObraRow } from '../../../_lib/tipos'
import { corrigirDataFechamentoAction, mudarEtapaAction } from '../_actions'

const HOJE = hojeISO()
const EMAIL = 'yuri@manfac.com.br'

/** Obra "em branco": todos os marcos nascem `null`. */
function obra(over: Partial<ObraRow> = {}): Record<string, unknown> {
  return {
    id: 'o1',
    etapa: 'andamento',
    pcm: 'YURI',
    equipe: 'MANFAC-7',
    os_aprovada: false,
    aprovacao: null,
    marco_os_aprov: null,
    marco_exec_fim: null,
    marco_relatorio: null,
    marco_fechou_os: null,
    marco_liberou_fat: null,
    marco_faturou: null,
    ...over,
  }
}

/** `p_campos` da última chamada de `rpc('obras_aplicar_alteracao', ...)`. */
function camposMarco(): Record<string, unknown> | undefined {
  const chamada = rpcMock.mock.calls.at(-1)
  return (chamada?.[1] as { p_campos: Record<string, unknown> } | undefined)?.p_campos
}

function linhasMarco(): { campo: string; de: string | null; para: string | null }[] {
  const chamada = rpcMock.mock.calls.at(-1)
  return (
    (chamada?.[1] as { p_linhas: { campo: string; de: string | null; para: string | null }[] } | undefined)
      ?.p_linhas ?? []
  )
}

/** O objeto passado ao `.update(...)` de `obras_obra` (troca de etapa). */
function objetoDoUpdate(): Record<string, unknown> {
  return updateMock.mock.calls.at(-1)?.[0] as Record<string, unknown>
}

function encadearUpdate(resultado: { error: unknown } = { error: null }) {
  const alvo: Record<string, unknown> = { ...resultado }
  alvo.eq = eqUpdateMock.mockReturnValue(alvo)
  alvo.then = (r: (v: unknown) => unknown) => Promise.resolve(resultado).then(r)
  updateMock.mockReturnValue(alvo)
}

beforeEach(() => {
  jest.clearAllMocks()
  getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: EMAIL } } })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  obraAtual = obra()
  rpcMock.mockResolvedValue({ data: obra(), error: null })
  encadearUpdate()
})

describe('mudarEtapaAction — acesso e etapa inválida (inalterado)', () => {
  it('recusa quem não tem acesso, sem tocar no banco', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await mudarEtapaAction('o1', 'relatorio')
    expect(r).toEqual({ error: 'Sem acesso ao Controle de Obras' })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('recusa etapa fora do enum', async () => {
    const r = await mudarEtapaAction('o1', 'etapa-que-nao-existe')
    expect(r).toEqual({ error: 'Etapa inválida' })
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('mudarEtapaAction — avançar carimba os marcos anteriores', () => {
  it('avanço simples (paralisado → relatorio): só marco_exec_fim é carimbado', async () => {
    obraAtual = obra({ etapa: 'paralisado' })
    const r = await mudarEtapaAction('o1', 'relatorio')
    expect(r).toEqual({ success: true })
    expect(objetoDoUpdate()).toMatchObject({ etapa: 'relatorio' })
    // marco_relatorio é o marco do PRÓPRIO passo que a obra está entrando —
    // fica null (o passo é 'atual', não 'feito') até a obra sair dele.
    expect(camposMarco()).toEqual({ marco_exec_fim: HOJE })
  })

  it('avanço pulando passos (andamento → pendFat): carimba tudo que é anterior', async () => {
    obraAtual = obra({ etapa: 'andamento' })
    const r = await mudarEtapaAction('o1', 'pendFat')
    expect(r).toEqual({ success: true })
    expect(camposMarco()).toEqual({
      marco_exec_fim: HOJE,
      marco_relatorio: HOJE,
      marco_fechou_os: HOJE,
    })
    // pendFat é a etapa nova — o próprio marco dela não é carimbado.
    expect(camposMarco()).not.toHaveProperty('marco_liberou_fat')
  })

  it('entrada em faturado: além dos anteriores, marco_faturou também recebe hoje (etapa terminal)', async () => {
    obraAtual = obra({ etapa: 'pendFat' })
    const r = await mudarEtapaAction('o1', 'faturado')
    expect(r).toEqual({ success: true })
    expect(camposMarco()).toEqual({
      marco_exec_fim: HOJE,
      marco_relatorio: HOJE,
      marco_fechou_os: HOJE,
      marco_liberou_fat: HOJE,
      marco_faturou: HOJE,
    })
  })

  it('marco que já tem data nunca é sobrescrito', async () => {
    obraAtual = obra({
      etapa: 'relatorio',
      marco_exec_fim: '2026-08-20',
      marco_relatorio: '2026-08-25',
    })
    const r = await mudarEtapaAction('o1', 'aprovarOS')
    expect(r).toEqual({ success: true })
    // Nada mudou nos marcos rastreados (marco_relatorio já anterior a
    // aprovarOS e já preenchido; marco_exec_fim já preenchido) — não há
    // linha de histórico, então a RPC de marcos nem é chamada.
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('mudarEtapaAction — voltar apaga os marcos com histórico', () => {
  it('faturado → pendFat: apaga marco_liberou_fat e marco_faturou, registrando o valor antigo', async () => {
    obraAtual = obra({
      etapa: 'faturado',
      marco_exec_fim: '2026-08-20',
      marco_relatorio: '2026-08-22',
      marco_fechou_os: '2026-08-24',
      marco_liberou_fat: '2026-08-26',
      marco_faturou: '2026-08-28',
    })
    const r = await mudarEtapaAction('o1', 'pendFat')
    expect(r).toEqual({ success: true })
    expect(camposMarco()).toEqual({ marco_liberou_fat: null, marco_faturou: null })
    // Passos ANTES de pendFat na esteira não são tocados.
    expect(camposMarco()).not.toHaveProperty('marco_relatorio')
    expect(camposMarco()).not.toHaveProperty('marco_fechou_os')
    // marco_exec_fim continua — pendFat ainda é pós-campo.
    expect(camposMarco()).not.toHaveProperty('marco_exec_fim')

    const linhas = linhasMarco()
    const liberouFat = linhas.find((l) => l.campo === 'marco_liberou_fat')
    const faturou = linhas.find((l) => l.campo === 'marco_faturou')
    expect(liberouFat).toMatchObject({ de: '26/08/2026', para: null })
    expect(faturou).toMatchObject({ de: '28/08/2026', para: null })
  })

  it('voltar para etapa de campo também apaga marco_exec_fim', async () => {
    obraAtual = obra({
      etapa: 'fecharOS',
      marco_exec_fim: '2026-08-20',
      marco_relatorio: '2026-08-22',
    })
    const r = await mudarEtapaAction('o1', 'andamento')
    expect(r).toEqual({ success: true })
    expect(camposMarco()).toEqual({ marco_exec_fim: null, marco_relatorio: null })
  })
})

describe('mudarEtapaAction — reconcilia pelo ESTADO FINAL, não pela direção (revisão de 21/09)', () => {
  // Motivo: se a chamada de marcos falhar depois do update da etapa (ex.:
  // numa VOLTA), a obra fica com a etapa nova mas os marcos ainda refletem
  // a etapa antiga — um estado INCONSISTENTE. Antes desta correção, o
  // cálculo comparava índice antigo × novo: um AVANÇO só carimbava `null`,
  // nunca apagava marco de passo futuro que tivesse sobrado; e etapa igual
  // à atual nem entrava no `if`/`else if`, então nunca reconciliava nada.
  // Calcular pelo estado final (índice da NOVA etapa contra cada marco,
  // sem olhar a etapa antiga) corrige os dois: qualquer troca — inclusive
  // "trocar" para a mesma etapa — deixa os marcos coerentes com onde a
  // obra está agora.
  it('andamento com TODOS os marcos preenchidos (inconsistente) → mudarEtapa para relatorio apaga fecharOS/pendFat/faturou/relatorio e mantém exec_fim', async () => {
    obraAtual = obra({
      etapa: 'andamento',
      marco_exec_fim: '2026-08-01',
      marco_relatorio: '2026-08-02',
      marco_fechou_os: '2026-08-03',
      marco_liberou_fat: '2026-08-04',
      marco_faturou: '2026-08-05',
    })
    const r = await mudarEtapaAction('o1', 'relatorio')
    expect(r).toEqual({ success: true })
    expect(camposMarco()).toEqual({
      marco_relatorio: null,
      marco_fechou_os: null,
      marco_liberou_fat: null,
      marco_faturou: null,
    })
    // marco_exec_fim é mantido: relatorio é pós-campo e o marco já tinha data.
    expect(camposMarco()).not.toHaveProperty('marco_exec_fim')
  })

  it('trocar para a MESMA etapa (andamento) com estado inconsistente reconcilia — nada fica de fora', async () => {
    obraAtual = obra({
      etapa: 'andamento',
      marco_exec_fim: '2026-08-01',
      marco_relatorio: '2026-08-02',
      marco_fechou_os: '2026-08-03',
      marco_liberou_fat: '2026-08-04',
      marco_faturou: '2026-08-05',
    })
    const r = await mudarEtapaAction('o1', 'andamento')
    expect(r).toEqual({ success: true })
    // andamento é pré-campo: nenhum marco deveria ter data, nem exec_fim.
    expect(camposMarco()).toEqual({
      marco_exec_fim: null,
      marco_relatorio: null,
      marco_fechou_os: null,
      marco_liberou_fat: null,
      marco_faturou: null,
    })
  })
})

describe('mudarEtapaAction — marco_os_aprov nunca é tocado', () => {
  it('avançar pulando aprovarOS não grava marco_os_aprov', async () => {
    obraAtual = obra({ etapa: 'andamento' })
    await mudarEtapaAction('o1', 'faturado')
    expect(camposMarco()).not.toHaveProperty('marco_os_aprov')
    expect(objetoDoUpdate()).not.toHaveProperty('marco_os_aprov')
  })

  it('voltar por cima de aprovarOS não apaga marco_os_aprov', async () => {
    obraAtual = obra({
      etapa: 'faturado',
      marco_os_aprov: '2026-08-15',
      os_aprovada: true,
      marco_fechou_os: '2026-08-24',
      marco_liberou_fat: '2026-08-26',
      marco_faturou: '2026-08-28',
    })
    await mudarEtapaAction('o1', 'aprovarOS')
    expect(camposMarco()).not.toHaveProperty('marco_os_aprov')
  })
})

describe('mudarEtapaAction — erros da leitura do estado atual e do update', () => {
  it('obra não encontrada não vira exceção nem toca marcos', async () => {
    obraAtual = null
    const r = await mudarEtapaAction('o1', 'relatorio')
    expect(r).toEqual({ error: 'Obra não encontrada' })
    expect(updateMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('erro do update da etapa vira mensagem em português, sem tentar gravar marcos', async () => {
    obraAtual = obra({ etapa: 'andamento' })
    encadearUpdate({ error: { code: '42501', message: 'RLS' } })
    const r = await mudarEtapaAction('o1', 'relatorio')
    expect(r).toEqual({ error: 'Erro ao mudar a etapa da obra' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})

describe('mudarEtapaAction — revalidação (inalterada)', () => {
  it('sucesso revalida a ficha e a base mesmo quando marcos mudam', async () => {
    obraAtual = obra({ etapa: 'andamento' })
    await mudarEtapaAction('o1', 'relatorio')
    expect(revalidatePath).toHaveBeenCalledWith('/obras/obra/o1')
    expect(revalidatePath).toHaveBeenCalledWith('/obras/base')
  })
})

function diasAtras(n: number): string {
  const d = new Date(`${HOJE}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}
const br = (iso: string) => iso.split('-').reverse().join('/')

describe('mudarEtapaAction — data de fechamento da OS (ajuste 2, 23/09)', () => {
  const emFecharOS = () =>
    obra({
      etapa: 'fecharOS',
      marco_exec_fim: diasAtras(10),
      marco_relatorio: diasAtras(6),
      aprovacao: diasAtras(5),
    })

  it('Fechar OS → Pendente faturamento grava a data informada no marco, com histórico, e em desde_etapa', async () => {
    obraAtual = emFecharOS()
    const r = await mudarEtapaAction('o1', 'pendFat', diasAtras(2))
    expect(r).toEqual({ success: true })
    expect(camposMarco()).toMatchObject({ marco_fechou_os: diasAtras(2) })
    expect(linhasMarco()).toContainEqual(
      expect.objectContaining({ campo: 'marco_fechou_os', de: null, para: br(diasAtras(2)) })
    )
    expect(objetoDoUpdate()).toMatchObject({ etapa: 'pendFat', desde_etapa: diasAtras(2) })
  })

  it('sem data, continua carimbando hoje (comportamento anterior)', async () => {
    obraAtual = emFecharOS()
    await mudarEtapaAction('o1', 'pendFat')
    expect(camposMarco()).toMatchObject({ marco_fechou_os: HOJE })
    expect(objetoDoUpdate()).toMatchObject({ desde_etapa: HOJE })
  })

  it('data futura é recusada ANTES de qualquer escrita', async () => {
    obraAtual = emFecharOS()
    const r = await mudarEtapaAction('o1', 'pendFat', diasAtras(-1))
    expect(r).toEqual({ error: 'A data não pode ser posterior a hoje.' })
    expect(updateMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('data anterior à aprovação é recusada ANTES de qualquer escrita', async () => {
    obraAtual = emFecharOS()
    const r = await mudarEtapaAction('o1', 'pendFat', diasAtras(6))
    expect(r.error).toMatch(/^A data não pode ser anterior à aprovação da OS/)
    expect(updateMock).not.toHaveBeenCalled()
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('data numa troca que não conclui Fechar OS é recusada', async () => {
    obraAtual = obra({ etapa: 'andamento' })
    const r = await mudarEtapaAction('o1', 'relatorio', HOJE)
    expect(r).toEqual({ error: 'A data de fechamento da OS só vale ao concluir Fechar OS.' })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('data com o marco já gravado é recusada (quem corrige é "corrigir data")', async () => {
    obraAtual = obra({ etapa: 'pendFat', marco_fechou_os: diasAtras(3), marco_relatorio: diasAtras(6) })
    const r = await mudarEtapaAction('o1', 'faturado', diasAtras(1))
    expect(r.error).toBe('A data de fechamento da OS só vale ao concluir Fechar OS.')
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('"Tentar de novo" depois de falha parcial: obra já em pendFat sem marco aceita a data', async () => {
    obraAtual = obra({
      etapa: 'pendFat',
      marco_exec_fim: diasAtras(10),
      marco_relatorio: diasAtras(6),
      marco_fechou_os: null,
    })
    const r = await mudarEtapaAction('o1', 'pendFat', diasAtras(2))
    expect(r).toEqual({ success: true })
    expect(camposMarco()).toMatchObject({ marco_fechou_os: diasAtras(2) })
  })

  it('Fechar OS → Faturado com data: marco recebe a data, desde_etapa continua hoje', async () => {
    obraAtual = emFecharOS()
    await mudarEtapaAction('o1', 'faturado', diasAtras(2))
    expect(camposMarco()).toMatchObject({ marco_fechou_os: diasAtras(2) })
    expect(objetoDoUpdate()).toMatchObject({ desde_etapa: HOJE })
  })
})

describe('corrigirDataFechamentoAction (ajuste 2, 23/09)', () => {
  const concluida = (over: Partial<ObraRow> = {}) =>
    obra({
      etapa: 'pendFat',
      marco_relatorio: diasAtras(8),
      aprovacao: diasAtras(7),
      marco_fechou_os: diasAtras(3),
      desde_etapa: diasAtras(3),
      ...over,
    })

  it('sem sessão não grava', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } })
    expect(await corrigirDataFechamentoAction('o1', diasAtras(4))).toEqual({ error: 'Não autenticado' })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('sem acesso ao módulo não grava', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    expect(await corrigirDataFechamentoAction('o1', diasAtras(4))).toEqual({
      error: 'Sem acesso ao Controle de Obras',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('obra que ainda não concluiu Fechar OS não é corrigida', async () => {
    obraAtual = obra({ etapa: 'fecharOS', marco_fechou_os: null })
    expect(await corrigirDataFechamentoAction('o1', diasAtras(1))).toEqual({
      error: 'Fechar OS ainda não foi concluído nesta obra.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('corrige com histórico de → para e leva desde_etapa junto quando a espera começou nessa data', async () => {
    obraAtual = concluida()
    expect(await corrigirDataFechamentoAction('o1', diasAtras(5))).toEqual({ success: true })
    expect(camposMarco()).toEqual({ marco_fechou_os: diasAtras(5), desde_etapa: diasAtras(5) })
    expect(linhasMarco()).toEqual([
      expect.objectContaining({ campo: 'marco_fechou_os', de: br(diasAtras(3)), para: br(diasAtras(5)) }),
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/obras/obra/o1')
    expect(revalidatePath).toHaveBeenCalledWith('/obras/base')
  })
  it('não toca desde_etapa quando a obra já saiu da espera (faturado) ou a espera começou em outro dia', async () => {
    obraAtual = concluida({ etapa: 'faturado', desde_etapa: diasAtras(1) })
    await corrigirDataFechamentoAction('o1', diasAtras(5))
    expect(camposMarco()).toEqual({ marco_fechou_os: diasAtras(5) })
    obraAtual = concluida({ desde_etapa: diasAtras(1) })
    await corrigirDataFechamentoAction('o1', diasAtras(5))
    expect(camposMarco()).toEqual({ marco_fechou_os: diasAtras(5) })
  })
  it('recusa futuro e anterior à aprovação, sem gravar', async () => {
    obraAtual = concluida()
    expect((await corrigirDataFechamentoAction('o1', diasAtras(-1))).error).toBe(
      'A data não pode ser posterior a hoje.'
    )
    expect((await corrigirDataFechamentoAction('o1', diasAtras(8))).error).toMatch(
      /^A data não pode ser anterior à aprovação da OS/
    )
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('mesma data: sucesso sem chamar a RPC', async () => {
    obraAtual = concluida()
    expect(await corrigirDataFechamentoAction('o1', diasAtras(3))).toEqual({ success: true })
    expect(rpcMock).not.toHaveBeenCalled()
  })
  it('erro da RPC vira mensagem, não exceção', async () => {
    obraAtual = concluida()
    rpcMock.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect(await corrigirDataFechamentoAction('o1', diasAtras(5))).toEqual({
      error: 'Erro ao corrigir a data de fechamento da OS',
    })
  })
})
