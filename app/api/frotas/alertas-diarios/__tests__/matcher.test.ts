/**
 * @jest-environment node
 */
// A rota é chamada pelo pg_cron só com Bearer: se o middleware a pegasse, exigiria sessão e devolveria 401.
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }))

import { config } from '../../../../../middleware'

// Mesma semântica do Next para os formatos usados no matcher (`/x/:path*` e `/x`).
function casa(padrao: string, caminho: string): boolean {
  if (!padrao.endsWith('/:path*')) return caminho === padrao
  const base = padrao.slice(0, -'/:path*'.length)
  return caminho === base || caminho.startsWith(`${base}/`)
}

describe('middleware.config.matcher', () => {
  it('não casa com o caminho da rota do cron', () => {
    expect(config.matcher.filter((p) => casa(p, '/api/frotas/alertas-diarios'))).toEqual([])
  })

  it('o prefixo antigo estava no matcher (prova que o teste enxerga o problema)', () => {
    expect(config.matcher.some((p) => casa(p, '/api/sofia/alertas-diarios'))).toBe(true)
  })
})
