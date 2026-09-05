/**
 * Testes do Diário do dia.
 *
 * O QUE ESTES TESTES PROTEGEM, e por que existem: a regra central do módulo é
 * que salvar o diário abre tarefa sozinho — e que a FOTO QUE NÃO VEIO abre uma
 * SEGUNDA tarefa, para a equipe da obra. É a única parte do sistema em que uma
 * ação do usuário dispara trabalho para outra pessoa sem ninguém digitar nada.
 * Se isso quebrar em silêncio, o sistema vira um formulário de registro.
 *
 * Supabase é 100% mockado (padrão de app/conversor-os/__tests__/_actions.test.ts).
 * A migration `sdd-sql-obras-v0.sql` ainda NÃO foi aplicada em produção — nenhum
 * teste daqui pode depender de banco.
 */

const getUserMock = jest.fn()
const upsertDiarioMock = jest.fn()
const deleteDiarioMock = jest.fn()
const selectTarefaMock = jest.fn()
const insertTarefaMock = jest.fn()
const deleteTarefaInMock = jest.fn()
const deleteTarefaEqMock = jest.fn()
const createSignedUrlMock = jest.fn()

type Qualquer = Record<string, unknown>

const estado: { obra: Qualquer | null; tarefas: Qualquer[] } = { obra: null, tarefas: [] }

/** Construtor de query encadeável e "thenable", como a do supabase-js. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function chain(resultado: any): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: any = {
    select: jest.fn(() => obj),
    eq: jest.fn(() => obj),
    in: jest.fn(() => obj),
    order: jest.fn(() => obj),
    limit: jest.fn(() => obj),
    maybeSingle: jest.fn(async () => resultado),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then: (ok: any, falha: any) => Promise.resolve(resultado).then(ok, falha),
  }
  return obj
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn((tabela: string) => {
      if (tabela === 'obras_obra') return chain({ data: estado.obra, error: null })
      if (tabela === 'obras_diario') {
        const c = chain({ error: null })
        c.upsert = upsertDiarioMock
        c.delete = jest.fn(() => {
          const d = chain({ error: null })
          d.eq = jest.fn(() => {
            deleteDiarioMock()
            return d
          })
          return d
        })
        return c
      }
      if (tabela === 'obras_tarefa') {
        const c = chain({ data: estado.tarefas, error: null })
        c.select = jest.fn(() => {
          selectTarefaMock()
          return c
        })
        c.insert = insertTarefaMock
        c.delete = jest.fn(() => {
          const d = chain({ error: null })
          d.in = deleteTarefaInMock
          d.eq = jest.fn(() => {
            deleteTarefaEqMock()
            return d
          })
          return d
        })
        return c
      }
      return chain({ data: [], error: null })
    }),
    storage: { from: jest.fn(() => ({ createSignedUrl: createSignedUrlMock })) },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))

import {
  salvarDiarioAction,
  desfazerDiarioAction,
  obterUrlFotoAction,
} from '../diario/_actions'
import { chaveDoUsuario } from '../diario/_pessoa'
import { hasSystemAccess } from '@/lib/auth/systemAccess'

/** 12:00 em São Paulo — antes das 18h, então o prazo é o próprio dia. */
const MEIO_DIA = new Date('2026-09-05T15:00:00Z')
/** 19:30 em São Paulo — depois das 18h, então o prazo vai para o dia seguinte. */
const NOITE = new Date('2026-09-05T22:30:00Z')
const HOJE = '2026-09-05'

const OBRA_EM_CAMPO = { id: 'obra-1', etapa: 'andamento', equipe: 'MANFAC-7', pcm: 'YURI' }
const OBRA_FORA_DE_CAMPO = { id: 'obra-2', etapa: 'levantamento', equipe: 'MANFAC-7', pcm: 'YURI' }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function tarefasInseridas(): any[] {
  return insertTarefaMock.mock.calls.flatMap((c) => c[0])
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers().setSystemTime(MEIO_DIA)
  estado.obra = { ...OBRA_EM_CAMPO }
  estado.tarefas = []
  getUserMock.mockResolvedValue({
    data: { user: { id: 'u1', email: 'yuri.nascimento@manfac.com.br' } },
  })
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  upsertDiarioMock.mockResolvedValue({ error: null })
  insertTarefaMock.mockResolvedValue({ error: null })
})

afterEach(() => {
  jest.useRealTimers()
})

describe('salvarDiarioAction — autorização e a única trava', () => {
  it('recusa quem não tem acesso ao módulo, sem gravar nada', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Não faltou',
      motivo: null,
      obs: null,
      fotoPath: null,
    })
    expect(r).toEqual({ error: 'Sem acesso ao Controle de Obras' })
    expect(upsertDiarioMock).not.toHaveBeenCalled()
  })

  it('barra "não andou" sem motivo — e é a ÚNICA trava que existe', async () => {
    const r = await salvarDiarioAction({
      obraId: 'obra-1',
      andou: false,
      item: 'Não faltou',
      motivo: '  ',
      obs: null,
      fotoPath: null,
    })
    expect(r).toEqual({ error: 'Diga por que não andou.' })
    expect(upsertDiarioMock).not.toHaveBeenCalled()
  })

  it('não trava por falta de item, de observação nem de foto (decisão C)', async () => {
    const r = await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Não faltou',
      motivo: null,
      obs: null,
      fotoPath: null,
    })
    expect(r).toEqual({ success: true })
  })

  it('grava um registro por obra por dia — salvar de novo é upsert, não erro', async () => {
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: false,
      item: 'Material',
      motivo: 'Falta de material',
      obs: 'faltou massa',
      fotoPath: 'obra-1/2026-09-05.jpg',
    })
    expect(upsertDiarioMock).toHaveBeenCalledWith(
      expect.objectContaining({
        obra_id: 'obra-1',
        data: HOJE,
        andou: false,
        motivo: 'Falta de material',
        item: 'Material',
        obs: 'faltou massa',
        foto_path: 'obra-1/2026-09-05.jpg',
        registrado_por: 'u1',
      }),
      { onConflict: 'obra_id,data' }
    )
  })

  it('devolve mensagem amigável quando o banco recusa, sem lançar', async () => {
    upsertDiarioMock.mockResolvedValue({ error: { message: 'RLS denied' } })
    const r = await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Não faltou',
      motivo: null,
      obs: null,
      fotoPath: null,
    })
    expect(r).toEqual({ error: 'Erro ao salvar o diário' })
    expect(insertTarefaMock).not.toHaveBeenCalled()
  })
})

describe('a falta vira tarefa — a regra central do módulo', () => {
  it('não abre tarefa nenhuma quando não faltou nada e a foto veio', async () => {
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Não faltou',
      motivo: null,
      obs: null,
      fotoPath: 'obra-1/2026-09-05.jpg',
    })
    expect(insertTarefaMock).not.toHaveBeenCalled()
  })

  it('Material vai para Compras (Roberta), com prazo no próprio dia', async () => {
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Material',
      motivo: null,
      obs: 'faltou massa',
      fotoPath: 'obra-1/2026-09-05.jpg',
    })
    const tarefas = tarefasInseridas()
    expect(tarefas).toHaveLength(1)
    expect(tarefas[0]).toEqual(
      expect.objectContaining({
        obra_id: 'obra-1',
        item: 'Material',
        dono: 'ROBERTA',
        aberta: HOJE,
        prazo: HOJE,
        situacao: 'aberta',
        registrou: 'YURI',
        // `resumo` só é escrito quando a pessoa cobrada responde.
        resumo: null,
      })
    )
  })

  it.each([
    ['Ferramenta', 'YURI'],
    ['Equipe', 'YURI'],
    ['Documento / ART', 'YURI'],
    ['Outro', 'YURI'],
  ])('%s vai para %s (ROTA_FALTA)', async (item, dono) => {
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item,
      motivo: null,
      obs: null,
      fotoPath: 'obra-1/2026-09-05.jpg',
    })
    expect(tarefasInseridas()[0]).toEqual(expect.objectContaining({ item, dono }))
  })

  it('FOTO QUE NÃO VEIO abre uma SEGUNDA tarefa, para a equipe da obra', async () => {
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Material',
      motivo: null,
      obs: 'faltou massa',
      fotoPath: null,
    })
    const tarefas = tarefasInseridas()
    expect(tarefas).toHaveLength(2)
    expect(tarefas.map((t) => t.item)).toEqual(['Material', 'Foto'])
    expect(tarefas[0].dono).toBe('ROBERTA')
    // MANFAC-7 → EQ_MANFAC7, via chaveDaEquipe. A cobrança da foto é a única
    // que sai da Manfac e vai para a ponta.
    expect(tarefas[1].dono).toBe('EQ_MANFAC7')
    expect(tarefas[1].prazo).toBe(HOJE)
  })

  it('a foto sozinha basta: obra em campo sem falta e sem foto abre a tarefa de foto', async () => {
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Não faltou',
      motivo: null,
      obs: null,
      fotoPath: null,
    })
    const tarefas = tarefasInseridas()
    expect(tarefas).toHaveLength(1)
    expect(tarefas[0]).toEqual(expect.objectContaining({ item: 'Foto', dono: 'EQ_MANFAC7' }))
  })

  it('obra FORA de campo não cobra foto — só obra em campo tem o que fotografar', async () => {
    estado.obra = { ...OBRA_FORA_DE_CAMPO }
    await salvarDiarioAction({
      obraId: 'obra-2',
      andou: true,
      item: 'Não faltou',
      motivo: null,
      obs: null,
      fotoPath: null,
    })
    expect(insertTarefaMock).not.toHaveBeenCalled()
  })

  it('depois das 18h o prazo vai para o dia seguinte, senão a tarefa nasce vencida', async () => {
    jest.setSystemTime(NOITE)
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Material',
      motivo: null,
      obs: null,
      fotoPath: 'obra-1/2026-09-05.jpg',
    })
    expect(tarefasInseridas()[0]).toEqual(
      expect.objectContaining({ aberta: HOJE, prazo: '2026-09-06' })
    )
  })

  it('nenhuma tarefa nasce com situacao "vencida" — vencida é sempre calculada', async () => {
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: false,
      item: 'Material',
      motivo: 'Falta de material',
      obs: null,
      fotoPath: null,
    })
    for (const t of tarefasInseridas()) expect(t.situacao).toBe('aberta')
  })
})

describe('salvar de novo não duplica tarefa', () => {
  it('não reabre a tarefa que já existe para o mesmo item no mesmo dia', async () => {
    estado.tarefas = [{ id: 't1', item: 'Material', situacao: 'aberta' }]
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Material',
      motivo: null,
      obs: null,
      fotoPath: 'obra-1/2026-09-05.jpg',
    })
    expect(insertTarefaMock).not.toHaveBeenCalled()
    expect(deleteTarefaInMock).not.toHaveBeenCalled()
  })

  it('apaga a tarefa aberta que a correção da resposta tornou órfã', async () => {
    estado.tarefas = [{ id: 't1', item: 'Material', situacao: 'aberta' }]
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Não faltou',
      motivo: null,
      obs: null,
      fotoPath: 'obra-1/2026-09-05.jpg',
    })
    expect(deleteTarefaInMock).toHaveBeenCalledWith('id', ['t1'])
  })

  it('não apaga tarefa já respondida — apagar seria apagar o trabalho de alguém', async () => {
    estado.tarefas = [{ id: 't1', item: 'Material', situacao: 'respondida' }]
    await salvarDiarioAction({
      obraId: 'obra-1',
      andou: true,
      item: 'Não faltou',
      motivo: null,
      obs: null,
      fotoPath: 'obra-1/2026-09-05.jpg',
    })
    expect(deleteTarefaInMock).not.toHaveBeenCalled()
  })
})

describe('desfazerDiarioAction', () => {
  it('recusa quem não tem acesso', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await desfazerDiarioAction('obra-1')
    expect(r).toEqual({ error: 'Sem acesso ao Controle de Obras' })
    expect(deleteDiarioMock).not.toHaveBeenCalled()
  })

  it('apaga o registro de hoje e as tarefas ainda abertas que ele gerou', async () => {
    const r = await desfazerDiarioAction('obra-1')
    expect(r).toEqual({ success: true })
    expect(deleteDiarioMock).toHaveBeenCalled()
    expect(deleteTarefaEqMock).toHaveBeenCalled()
  })
})

describe('obterUrlFotoAction', () => {
  it('recusa quem não tem acesso, sem assinar URL nenhuma', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const r = await obterUrlFotoAction('obra-1/2026-09-05.jpg')
    expect(r).toEqual({ error: 'Sem acesso ao Controle de Obras' })
    expect(createSignedUrlMock).not.toHaveBeenCalled()
  })

  it('devolve URL assinada e curta para o bucket privado', async () => {
    createSignedUrlMock.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/foto.jpg' },
      error: null,
    })
    const r = await obterUrlFotoAction('obra-1/2026-09-05.jpg')
    expect(r).toEqual({ url: 'https://signed.example/foto.jpg' })
    expect(createSignedUrlMock).toHaveBeenCalledWith('obra-1/2026-09-05.jpg', 60)
  })
})

describe('chaveDoUsuario — a ponte entre a conta do hub e a pessoa da planilha', () => {
  it.each([
    ['yuri.nascimento@manfac.com.br', 'YURI'],
    ['amanda@manfac.com.br', 'AMANDA'],
    ['luana-prado@manfac.com.br', 'LUANA'],
    ['joão.silva@manfac.com.br', 'JOAO'],
    ['', ''],
    [null, ''],
  ])('%s → %s', (email, esperado) => {
    expect(chaveDoUsuario(email)).toBe(esperado)
  })
})
