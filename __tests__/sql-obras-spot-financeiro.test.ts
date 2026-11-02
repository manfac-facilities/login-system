// __tests__/sql-obras-spot-financeiro.test.ts
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const arquivo = join(process.cwd(), 'sdd-sql-obras-spot-financeiro.sql')
const sql = existsSync(arquivo) ? readFileSync(arquivo, 'utf8') : ''
const semComentarios = sql.replace(/--[^\n]*/g, ' ')

/** Corpo de `create or replace function public.<nome>(` até o `$$;` que a fecha. */
function corpo(nome: string): string {
  const m = semComentarios.match(new RegExp(`create or replace function public\\.${nome}\\([\\s\\S]*?\\$\\$;`, 'i'))
  return m ? m[0] : ''
}

describe('sdd-sql-obras-spot-financeiro.sql', () => {
  it('o arquivo existe', () => {
    expect(existsSync(arquivo)).toBe(true)
  })

  it('tem seção 0 que exige obras_fin_notas e obras_locacao_estado, transação e verificação', () => {
    // seção 0 = o do $$ antes da primeira função
    const secao0 = semComentarios.slice(0, Math.max(0, semComentarios.search(/create or replace function/i)))
    expect(secao0).toMatch(/do \$\$/i)
    expect(secao0).toMatch(/raise exception/i)
    expect(secao0).toMatch(/obras_fin_notas/)
    expect(secao0).toMatch(/obras_locacao_estado/)
    expect(semComentarios).toMatch(/\bbegin;/i)
    expect(semComentarios).toMatch(/\bcommit;/i)
    expect(sql).toMatch(/\*\*\* FALHOU \*\*\*/)
  })

  it('obras_pode_ver_valores libera o SPOT só dentro do bloco que exige e-mail e acesso ao Obras', () => {
    const f = corpo('obras_pode_ver_valores')
    expect(f).toMatch(/eu\.email is not null/i)
    expect(f).toMatch(/obras_has_access\(\) is true/i)
    // o SPOT vem DEPOIS das duas exigências (mesmo where)
    const iAcesso = f.search(/obras_has_access\(\) is true/i)
    const iSpot = f.search(/o\.modalidade = 'spot'/i)
    expect(iSpot).toBeGreaterThan(iAcesso)
    expect(f).toMatch(/coalesce\(/i)
  })

  it('obras_pode_marcar_locacao guarda o gatilho e as duas policies de obras_locacao_estado', () => {
    expect(corpo('obras_pode_marcar_locacao')).toMatch(/obras_engenheiro_ou_admin_mae\(p_obra\)/i)
    expect(corpo('obras_locacao_estado_guarda')).toMatch(/obras_pode_marcar_locacao\(new\.obra_id\) is not true/i)
    expect(corpo('obras_locacao_estado_guarda')).not.toMatch(/obras_engenheiro_ou_admin_mae/i)
    expect(semComentarios).toMatch(/create policy "obras engenheiro insert" on public\.obras_locacao_estado[^;]*obras_pode_marcar_locacao\(obra_id\)/i)
    const upd = semComentarios.match(/create policy "obras engenheiro update" on public\.obras_locacao_estado[^;]*;/i)?.[0] ?? ''
    expect((upd.match(/obras_pode_marcar_locacao\(obra_id\)/gi) ?? []).length).toBe(2)
  })

  it('obras_pode_marcar_locacao no SPOT: e-mail no JWT, acesso ao Obras e obra SPOT; nunca NULL; sem guarda por analista', () => {
    const f = corpo('obras_pode_marcar_locacao')
    expect(f).toMatch(/security definer/i)
    expect(f).toMatch(/set search_path/i)
    expect(f).toMatch(/coalesce\(/i)
    expect(f).toMatch(/'email'\)\), ''\) is not null/i)
    expect(f).toMatch(/obras_has_access\(\) is true/i)
    expect(f).toMatch(/o\.modalidade = 'spot'/i)
    // pcm e obras_pessoa.email são editáveis por qualquer usuário do Obras: não servem de guarda
    expect(semComentarios).not.toMatch(/obras_analista_spot/i)
    expect(f).not.toMatch(/obras_pessoa/i)
    expect(corpo('obras_locacao_estado_guarda')).toMatch(/quem tem acesso ao Obras \(no SPOT\)/)
  })

  it('cria obras_nota_externa com RLS: leitura por valores, escrita só admin, sem update', () => {
    expect(semComentarios).toMatch(/create table if not exists public\.obras_nota_externa/i)
    expect(semComentarios).toMatch(/valor_centavos bigint not null check \(valor_centavos > 0\)/i)
    expect(semComentarios).toMatch(/unique \(obra_id, nfse\)/i)
    expect(semComentarios).toMatch(/alter table public\.obras_nota_externa enable row level security/i)
    expect(semComentarios).toMatch(/on public\.obras_nota_externa for select to authenticated\s+using \(public\.obras_pode_ver_valores\(obra_id\)\)/i)
    expect(semComentarios).not.toMatch(/on public\.obras_nota_externa for update/i)
    expect(semComentarios).toMatch(/revoke all on public\.obras_nota_externa from anon/i)
  })

  it('obras_marcar_faturada devolve parciais e soma pelo faturado do SPOT', () => {
    const f = corpo('obras_marcar_faturada')
    expect(f).toMatch(/'parciais'/)
    expect(f).toMatch(/obras_spot_faturado_centavos\(/)
    expect(f).toMatch(/round\(v_antes\.valor \* 100\)/i)
    expect(f).toMatch(/'faturamento parcial'/)
  })

  it('obras_spot_faturado_centavos conta só notas vivas de produção e as notas externas', () => {
    const f = corpo('obras_spot_faturado_centavos')
    expect(f).toMatch(/security definer/i)
    expect(f).toMatch(/ambiente = 'producao'/)
    expect(f).toMatch(/situacao in \('autorizada', 'enviada'\)/)
    expect(f).toMatch(/obras_devolvidas_em is null/)
    expect(f).toMatch(/obras_nota_externa/)
    expect(f).toMatch(/sum\(coalesce\(nob\.valor_centavos, n\.valor_total_centavos\)\)/)
  })

  it('marcar/desmarcar/faturado não são concedidos a authenticated nem anon', () => {
    for (const fn of ['obras_marcar_faturada', 'obras_desmarcar_faturada', 'obras_spot_faturado_centavos']) {
      const grants = [...semComentarios.matchAll(new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to ([^;]*);`, 'gi'))]
      expect(grants.length).toBeGreaterThan(0)
      for (const g of grants) expect(g[1].trim().toLowerCase()).toBe('service_role')
      expect(semComentarios).toMatch(new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated`, 'i'))
    }
  })
})
