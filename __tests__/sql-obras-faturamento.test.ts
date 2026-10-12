// __tests__/sql-obras-faturamento.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'sdd-sql-obras-faturamento.sql'), 'utf8')
const semComentarios = sql.replace(/--[^\n]*/g, ' ')

describe('sdd-sql-obras-faturamento.sql', () => {
  it('cria as três colunas de rastro, idempotente', () => {
    for (const c of ['fat_nfse', 'fat_pedido', 'fat_folhas']) {
      expect(semComentarios).toMatch(new RegExp(`add column if not exists ${c} text`, 'i'))
    }
  })

  it('as duas funções são invoker e só a service_role executa', () => {
    for (const f of ['obras_marcar_faturada', 'obras_desmarcar_faturada']) {
      expect(semComentarios).toMatch(new RegExp(`create or replace function public\\.${f}\\(`, 'i'))
      expect(semComentarios).toMatch(new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\) from public, anon, authenticated`, 'i'))
      expect(semComentarios).toMatch(new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role`, 'i'))
    }
    expect(semComentarios).not.toMatch(/security definer/i)
    expect((semComentarios.match(/security invoker/gi) ?? []).length).toBe(2)
  })

  it('só escreve em obras_obra e obras_historico', () => {
    const escritas = [...semComentarios.matchAll(/\b(?:update|insert\s+into|delete\s+from)\s+(public\.\w+)/gi)].map((m) => m[1].toLowerCase())
    expect(new Set(escritas)).toEqual(new Set(['public.obras_obra', 'public.obras_historico']))
  })

  it('tem seção 0, transação e verificação', () => {
    expect(semComentarios).toMatch(/\bbegin;/i)
    expect(semComentarios).toMatch(/\bcommit;/i)
    expect(sql).toMatch(/\*\*\* FALHOU \*\*\*/)
  })
})
