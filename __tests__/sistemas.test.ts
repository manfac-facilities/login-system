/**
 * @jest-environment node
 */
// middleware.ts importa `next/server`, que depende do global `Request` do
// Node (Fetch API). O ambiente padrão do projeto é jsdom, que não expõe esse
// global — daí este arquivo rodar isolado em ambiente node.
import { SISTEMAS } from '@/lib/sistemas'
import { config } from '@/middleware'

describe('registro de sistemas', () => {
  it('inclui o CRM com slug e label', () => {
    const crm = SISTEMAS.find((s) => s.slug === 'crm')
    expect(crm).toBeDefined()
    expect(crm?.label).toBe('CRM')
  })

  it('toda rota de sistema está protegida pelo matcher', () => {
    // Slug fora do matcher = rota aberta. Este teste é a rede contra isso.
    for (const s of SISTEMAS) {
      const esperado = `/${s.slug}/:path*`
      const temRota = config.matcher.some((m) => m === esperado || m === `/${s.slug}`)
      expect(temRota).toBe(true)
    }
  })
})
