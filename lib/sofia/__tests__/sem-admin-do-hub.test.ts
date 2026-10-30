/**
 * Trava contra regressão (spec docs/frotas/2026-10-26-spec-gestor-frotas.md, T5).
 *
 * Dentro do Sofia, "pode gerir frotas" é perguntado ao banco por
 * lib/sofia/permissoes.ts (RPC sofia_pode_gerir), a mesma função dos triggers.
 * Se um arquivo do Sofia voltar a importar requireAdmin/isAdmin do hub, o
 * gestor de frotas perde a ação em silêncio (app nega, banco deixaria).
 * Varre TODO .ts/.tsx do Sofia, não só _actions.ts/page.tsx.
 */
import fs from 'fs'
import path from 'path'

const RAIZ = path.resolve(__dirname, '..', '..', '..')
const PASTAS = [
  path.join(RAIZ, 'app', '(operacoes)', 'sofia'),
  path.join(RAIZ, 'components', 'sofia'),
  path.join(RAIZ, 'lib', 'sofia'),
]

function listar(dir: string): string[] {
  const saida: string[] = []
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, entrada.name)
    if (entrada.isDirectory()) {
      if (entrada.name === '__tests__' || entrada.name === 'node_modules') continue
      saida.push(...listar(completo))
    } else if (/\.(ts|tsx)$/.test(entrada.name)) {
      saida.push(completo)
    }
  }
  return saida
}

// Qualquer especificador de módulo (import/export from, import(), require)
// que aponte para o nível do hub — com alias @/ ou caminho relativo.
const PROIBIDO = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"][^'"]*lib\/auth\/(?:requireAdmin|roles)['"]/

describe('Sofia não usa o nível de admin do hub', () => {
  const arquivos = PASTAS.flatMap(listar)

  it('a varredura encontra os arquivos do Sofia (não passa no vazio)', () => {
    expect(arquivos.length).toBeGreaterThan(50)
    expect(arquivos.some((a) => a.endsWith(path.join('multas', '_actions.ts')))).toBe(true)
    expect(arquivos.some((a) => a.endsWith(path.join('multas', '_table.tsx')))).toBe(true)
  })

  it('nenhum .ts/.tsx do Sofia importa @/lib/auth/requireAdmin ou @/lib/auth/roles', () => {
    const ofensores = arquivos
      .filter((a) => PROIBIDO.test(fs.readFileSync(a, 'utf8')))
      .map((a) => path.relative(RAIZ, a))
    expect(ofensores).toEqual([])
  })

  it('o padrão pega as formas de import que já existiram', () => {
    expect(PROIBIDO.test("import { isAdmin } from '@/lib/auth/roles'")).toBe(true)
    expect(PROIBIDO.test("import { requireAdmin } from '@/lib/auth/requireAdmin'")).toBe(true)
    expect(PROIBIDO.test('import { isAdmin } from "../../../../lib/auth/roles"')).toBe(true)
    expect(PROIBIDO.test("const m = await import('@/lib/auth/roles')")).toBe(true)
    expect(PROIBIDO.test("import { podeGerirFrotas } from '@/lib/sofia/permissoes'")).toBe(false)
  })
})
