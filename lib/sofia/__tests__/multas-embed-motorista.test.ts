/**
 * `multas` tem duas FKs para `motoristas` (motorista_id e motorista_condutor_id, sdd-sql-sofia-multa-avaria.sql).
 * Um select a partir de `multas` com `motoristas(...)` sem `!coluna` vira erro PGRST201 no PostgREST e a
 * lista some da tela em silêncio. Toda leitura de multas que embute motorista tem de dizer qual FK usa.
 */
import fs from 'fs'
import path from 'path'

function arquivos(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '__tests__' ? [] : arquivos(p)
    return /\.(ts|tsx)$/.test(e.name) ? [p] : []
  })
}

describe('select a partir de multas embute motoristas com a FK explícita', () => {
  const raiz = process.cwd()
  const todos = ['app', 'lib', 'components'].flatMap((d) => arquivos(path.join(raiz, d)))

  it('acha os arquivos', () => expect(todos.length).toBeGreaterThan(50))

  it('nenhum motoristas( sem !motorista_id/!motorista_condutor_id depois de from("multas")', () => {
    const ruins: string[] = []
    for (const f of todos) {
      const s = fs.readFileSync(f, 'utf8')
      const re = /from\(\s*['"]multas['"]\s*\)\s*\.select\(\s*(['"`])([\s\S]*?)\1/g
      for (let m = re.exec(s); m; m = re.exec(s)) {
        if (/(^|[\s,(])motoristas\s*\(/.test(m[2])) ruins.push(`${path.relative(raiz, f)}: ${m[2]}`)
      }
    }
    expect(ruins).toEqual([])
  })
})
