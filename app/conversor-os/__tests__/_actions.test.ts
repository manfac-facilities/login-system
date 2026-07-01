const getUserMock = jest.fn()
const insertMock = jest.fn()
const createSignedUrlMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({ insert: insertMock })),
    storage: { from: jest.fn(() => ({ createSignedUrl: createSignedUrlMock })) },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))

import { registrarImportacaoAction, obterUrlDownloadAction } from '../_actions'
import { hasSystemAccess } from '@/lib/auth/systemAccess'

const inputFixture = {
  cliente: 'DPSP' as const,
  filename: 'DPSP-convertido-20260630-1432.xlsx',
  storagePath: 'DPSP/DPSP-convertido-20260630-1432.xlsx',
  linhasOrigem: 5,
  linhasConvertidas: 4,
  duplicadosRemovidos: 1,
  erros: [],
}

describe('registrarImportacaoAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'usuario@manfac.com.br' } } })
  })

  it('rejects when the user has no system access', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const result = await registrarImportacaoAction(inputFixture)
    expect(result).toEqual({ error: 'Sem acesso ao Conversor OS' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('inserts a log row and returns success when access is granted', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
    insertMock.mockResolvedValue({ error: null })
    const result = await registrarImportacaoAction(inputFixture)
    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_email: 'usuario@manfac.com.br',
        cliente: 'DPSP',
        storage_path: inputFixture.storagePath,
        total_rows: 5,
        converted_rows: 4,
        duplicates_removed: 1,
      })
    )
  })

  it('surfaces an error instead of silently swallowing a failed insert', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
    insertMock.mockResolvedValue({ error: { message: 'RLS denied' } })
    const result = await registrarImportacaoAction(inputFixture)
    expect(result).toEqual({ error: 'Erro ao registrar importação' })
  })
})

describe('obterUrlDownloadAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'usuario@manfac.com.br' } } })
  })

  it('returns a signed url when access is granted and storage succeeds', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed.example/file.xlsx' }, error: null })
    const result = await obterUrlDownloadAction('DPSP/foo.xlsx')
    expect(result).toEqual({ url: 'https://signed.example/file.xlsx' })
  })

  it('rejects when the user has no system access', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const result = await obterUrlDownloadAction('DPSP/foo.xlsx')
    expect(result).toEqual({ error: 'Sem acesso ao Conversor OS' })
  })
})
