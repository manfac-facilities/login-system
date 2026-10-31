/**
 * @jest-environment node
 */
const mockJar = { set: jest.fn(), get: jest.fn() }
const mockPedir = jest.fn()
const mockVerificar = jest.fn()
const mockEncerrar = jest.fn()

jest.mock('next/headers', () => ({
  cookies: async () => mockJar,
  headers: async () => ({ get: (n: string) => (n === 'x-forwarded-for' ? '200.9.9.9, 10.0.0.1' : null) }),
}))
jest.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`) } }))
jest.mock('@/lib/portal-obra/codigo', () => ({
  pedirCodigo: (...a: unknown[]) => mockPedir(...a),
  verificarCodigo: (...a: unknown[]) => mockVerificar(...a),
}))
jest.mock('@/lib/portal-obra/sessao', () => ({
  ...jest.requireActual('@/lib/portal-obra/sessao'),
  encerrarSessao: (...a: unknown[]) => mockEncerrar(...a),
}))

import { NextRequest } from 'next/server'
import { pedirCodigoAction, verificarCodigoAction } from '../(entrada)/_actions'
import { POST } from '../sair/route'

const form = (o: Record<string, string>) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.append(k, v)); return f }
const flagsSeguras = { httpOnly: true, secure: true, sameSite: 'lax', path: '/portal-obra' }

beforeEach(() => { jest.clearAllMocks() })

it('pedir código: IP do primeiro salto, e-mail normalizado, cookie do e-mail com flags seguras, vai para o código', async () => {
  mockPedir.mockResolvedValue({ ok: true, mensagem: 'x' })
  await expect(pedirCodigoAction({}, form({ email: ' A@B.com ' }))).rejects.toThrow('REDIRECT:/portal-obra/codigo')
  expect(mockPedir).toHaveBeenCalledWith('a@b.com', '200.9.9.9')
  expect(mockJar.set).toHaveBeenCalledWith('portal_obra_email', 'a@b.com', expect.objectContaining(flagsSeguras))
})

it('pedir código sem segredo: devolve a mensagem genérica e não grava cookie', async () => {
  mockPedir.mockResolvedValue({ ok: false, mensagem: 'indisponível' })
  expect(await pedirCodigoAction({}, form({ email: 'a@b.com' }))).toEqual({ erro: 'indisponível' })
  expect(mockJar.set).not.toHaveBeenCalled()
})

it('código certo: cookie de sessão httpOnly/secure/lax/path /portal-obra e redireciona para /portal-obra/obras', async () => {
  const exp = new Date('2026-12-01T00:00:00Z')
  mockJar.get.mockReturnValue({ value: 'a@b.com' })
  mockVerificar.mockResolvedValue({ ok: true, token: 'T'.repeat(43), expiraCookie: exp })
  await expect(verificarCodigoAction({}, form({ codigo: '123456' }))).rejects.toThrow('REDIRECT:/portal-obra/obras')
  expect(mockVerificar).toHaveBeenCalledWith('a@b.com', '123456')
  expect(mockJar.set).toHaveBeenCalledWith('portal_obra_sessao', 'T'.repeat(43), { ...flagsSeguras, expires: exp })
})

it('código errado: mensagem e nenhum cookie de sessão', async () => {
  mockJar.get.mockReturnValue({ value: 'a@b.com' })
  mockVerificar.mockResolvedValue({ ok: false, mensagem: 'inválido' })
  expect(await verificarCodigoAction({}, form({ codigo: '000000' }))).toEqual({ erro: 'inválido' })
  expect(mockJar.set).not.toHaveBeenCalled()
})

it('sair (POST): revoga, apaga o cookie no path /portal-obra e volta para a entrada (303)', async () => {
  const req = new NextRequest('http://localhost/portal-obra/sair', { method: 'POST', headers: { cookie: 'portal_obra_sessao=abc' } })
  const res = await POST(req)
  expect(mockEncerrar).toHaveBeenCalledTimes(1)
  expect(mockEncerrar.mock.calls[0][0].get('portal_obra_sessao')?.value).toBe('abc')
  expect(res.status).toBe(303)
  expect(res.headers.get('location')).toBe('/portal-obra')
  const sc = res.headers.get('set-cookie') ?? ''
  expect(sc).toMatch(/portal_obra_sessao=;/)
  expect(sc).toMatch(/Path=\/portal-obra/)
  expect(sc).toMatch(/Max-Age=0/)
  expect(sc).toMatch(/HttpOnly/)
  expect(sc).toMatch(/Secure/)
  expect(sc).toMatch(/SameSite=lax/i)
})
