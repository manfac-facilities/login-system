/**
 * @jest-environment node
 *
 * Review Focus 3 (Leva 5): obra de outro cliente pela URL → 404 sem ler nada
 * da obra (nem o nome); sem sessão → /portal-obra.
 */
const mockSessao = jest.fn()
const mockLerObra = jest.fn()

jest.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
jest.mock('next/navigation', () => ({
  redirect: (u: string) => { throw new Error(`REDIRECT:${u}`) },
  notFound: () => { throw new Error('NOT_FOUND') },
}))
jest.mock('@/lib/portal-obra/sessao', () => ({ lerSessao: (...a: unknown[]) => mockSessao(...a) }))
jest.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ admin: true }) }))
jest.mock('@/app/obras/obras/_lib/leitura', () => ({
  ...jest.requireActual('@/app/obras/obras/_lib/leitura'),
  lerObraGrande: (...a: unknown[]) => mockLerObra(...a),
}))

import { exigirObra, exigirSessao, obraLiberada } from '../(obra)/_lib/guarda'

const MINHA = '11111111-1111-4111-8111-111111111111'
const ALHEIA = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  jest.clearAllMocks()
  mockSessao.mockResolvedValue({ email: 'cliente@loja.com.br', obras: [MINHA] })
  mockLerObra.mockResolvedValue({ ok: true, dados: { obra: { id: MINHA, modalidade: 'obra', loja: 'DP Macaé 3' } } })
})

it('sem sessão: vai para a entrada do portal', async () => {
  mockSessao.mockResolvedValue(null)
  await expect(exigirSessao()).rejects.toThrow('REDIRECT:/portal-obra')
  await expect(exigirObra(MINHA)).rejects.toThrow('REDIRECT:/portal-obra')
  expect(mockLerObra).not.toHaveBeenCalled()
})

it('obra de outro cliente: 404 antes de qualquer leitura da obra', async () => {
  await expect(exigirObra(ALHEIA)).rejects.toThrow('NOT_FOUND')
  expect(mockLerObra).not.toHaveBeenCalled()
})

it('id fora do formato (ou em outra caixa) também é 404 sem leitura', async () => {
  for (const id of ['../x', MINHA.toUpperCase().replace('4111', '4112'), '', `${MINHA} `]) {
    await expect(exigirObra(id)).rejects.toThrow('NOT_FOUND')
  }
  expect(mockLerObra).not.toHaveBeenCalled()
  expect(obraLiberada({ email: 'a@b.com', obras: [MINHA] }, undefined)).toBe(false)
})

it('obra liberada: lê com o cliente admin e o id autorizado', async () => {
  const r = await exigirObra(MINHA)
  expect(r.og.obra.id).toBe(MINHA)
  expect(mockLerObra).toHaveBeenCalledWith({ admin: true }, MINHA, expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
})

it('obra liberada mas SPOT ou apagada: 404; erro de banco não vira 404 silencioso', async () => {
  mockLerObra.mockResolvedValueOnce({ ok: true, dados: { obra: { id: MINHA, modalidade: 'spot' } } })
  await expect(exigirObra(MINHA)).rejects.toThrow('NOT_FOUND')
  mockLerObra.mockResolvedValueOnce({ ok: false, erro: 'Obra não encontrada' })
  await expect(exigirObra(MINHA)).rejects.toThrow('NOT_FOUND')
  mockLerObra.mockResolvedValueOnce({ ok: false, erro: 'Falha ao ler a obra: timeout' })
  await expect(exigirObra(MINHA)).rejects.toThrow('portal-obra: falha ao ler a obra')
})
