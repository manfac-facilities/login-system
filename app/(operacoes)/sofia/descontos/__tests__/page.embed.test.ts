/**
 * Trava contra regressão (revisão 2026-11-03, BLOQUEANTE-D1).
 *
 * Depois de sdd-sql-sofia-multa-avaria.sql, `multas` tem 2 FKs para `motoristas`
 * (motorista_id e motorista_condutor_id). Um embed `motoristas(...)` sem `!coluna`
 * a partir de `multas` vira PGRST201, a página faz `(multas ?? [])` e as multas
 * somem da tela Descontos sem aviso.
 */
import fs from 'fs'
import path from 'path'

const PAGINA = path.resolve(__dirname, '..', 'page.tsx')

describe('descontos/page.tsx — embed de motoristas a partir de multas', () => {
  const fonte = fs.readFileSync(PAGINA, 'utf8')
  const selecoesDeMultas = [...fonte.matchAll(/from\('multas'\)\s*\.select\(\s*'([^']*)'/g)].map((m) => m[1])

  it('existe a leitura de multas', () => {
    expect(selecoesDeMultas.length).toBeGreaterThan(0)
  })

  it.each(selecoesDeMultas.map((s) => [s]))('"%s" nomeia a FK de motoristas', (selecao) => {
    expect(selecao).not.toMatch(/motoristas\(/)
    expect(selecao).toMatch(/motoristas!motorista_id\(/)
  })
})
