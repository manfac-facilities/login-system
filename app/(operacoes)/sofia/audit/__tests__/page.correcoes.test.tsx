import { renderToStaticMarkup } from 'react-dom/server'

type Chamada = { metodo: string; args: unknown[] }
let chamadas: Chamada[] = []
let resultado: { data: unknown; error: unknown } = { data: [], error: null }

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((tabela: string) => {
      chamadas.push({ metodo: 'from', args: [tabela] })
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'eq', 'in', 'order', 'limit']) {
        chain[m] = jest.fn((...args: unknown[]) => {
          chamadas.push({ metodo: m, args })
          return chain
        })
      }
      chain.then = (resolve: (v: unknown) => void) => resolve(resultado)
      return chain
    }),
  })),
}))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import AuditPage from '../page'

async function render(sp: Record<string, string>) {
  const el = await AuditPage({ searchParams: Promise.resolve(sp) })
  return renderToStaticMarkup(el)
}

beforeEach(() => {
  chamadas = []
  resultado = { data: [], error: null }
})

describe('Auditoria — aba Histórico de correções', () => {
  it('?ver=correcoes filtra operacao corrigiu e as 2 tabelas, mais recentes primeiro', async () => {
    await render({ ver: 'correcoes' })
    expect(chamadas).toContainEqual({ metodo: 'from', args: ['audit_log'] })
    expect(chamadas).toContainEqual({ metodo: 'eq', args: ['operacao', 'corrigiu'] })
    expect(chamadas).toContainEqual({ metodo: 'in', args: ['tabela', ['km_diario', 'abastecimentos']] })
    expect(chamadas).toContainEqual({ metodo: 'order', args: ['created_at', { ascending: false }] })
  })

  it('vazio mostra "Nenhuma correção feita até agora."', async () => {
    const html = await render({ ver: 'correcoes' })
    expect(html).toContain('Histórico de correções')
    expect(html).toContain('Nenhuma correção feita até agora.')
  })

  it('linha de correção de KM formatada', async () => {
    resultado = {
      data: [{
        id: 'l1', tabela: 'km_diario', registro_id: 'k', created_at: '2026-10-12T17:32:00Z', usuario_email: 'p@x',
        dados: {
          tipo: 'correcao_km', contexto: { equipe: 'MANFAC-03', placa: 'RTE-4F21', data: '2026-10-10' },
          antes: { km_atual: 47904 }, depois: { km_atual: 47409 }, km_veiculo: { antes: 47904, depois: 47409 },
          motivo: 'Digitou 9 no lugar de 4', autor: { email: 'p@x', nome: 'Patrícia Ramos', papel: 'administrador' },
        },
      }],
      error: null,
    }
    const html = await render({ ver: 'correcoes' })
    expect(html).toContain('Patrícia Ramos (administrador)')
    expect(html).toContain('KM diário · MANFAC-03 · RTE-4F21 · lançamento de 10/10')
    expect(html).toContain('47.904 km')
    expect(html).toContain('Digitou 9 no lugar de 4')
  })

  it('sem parâmetro mantém a consulta geral (sem filtro de operação)', async () => {
    const html = await render({})
    expect(html).toContain('Registro de atividades')
    expect(chamadas.some((c) => c.metodo === 'eq')).toBe(false)
    expect(chamadas).toContainEqual({ metodo: 'select', args: ['id, tabela, operacao, registro_id, descricao, created_at'] })
  })
})
