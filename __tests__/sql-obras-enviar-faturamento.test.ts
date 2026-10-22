// __tests__/sql-obras-enviar-faturamento.test.ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'sdd-sql-obras-enviar-faturamento.sql'), 'utf8')
const semComentarios = sql.replace(/--[^\n]*/g, ' ')

// Corpo de uma função: do "create or replace function public.<nome>(" até o "$$;" que a fecha.
function corpo(nome: string): string {
  const i = semComentarios.search(new RegExp(`create or replace function public\\.${nome}\\(`, 'i'))
  expect(i).toBeGreaterThanOrEqual(0)
  const resto = semComentarios.slice(i)
  const fim = resto.indexOf('$$;', resto.indexOf('$$') + 2)
  return resto.slice(0, fim + 3)
}

describe('sdd-sql-obras-enviar-faturamento.sql', () => {
  it('adiciona as quatro colunas fat_enviado_* com add column if not exists', () => {
    expect(semComentarios).toMatch(/add column if not exists fat_enviado_em timestamptz/i)
    for (const c of ['fat_enviado_por', 'fat_enviado_obs', 'fat_enviado_etapa_anterior']) {
      expect(semComentarios).toMatch(new RegExp(`add column if not exists ${c} text`, 'i'))
    }
  })

  it('enviar: invoker, exige obras_has_access() e e-mail do JWT, recusa cancelada, faturado, já enviada, DPSP/D1000 e cliente nulo', () => {
    const f = corpo('obras_enviar_para_faturamento')
    expect(f).toMatch(/\(p_obra_id uuid, p_obs text\)/i)
    expect(f).toMatch(/returns jsonb/i)
    expect(f).toMatch(/security invoker/i)
    expect(f).not.toMatch(/security definer/i)
    expect(f).toMatch(/not public\.obras_has_access\(\)/i)
    expect(f).toMatch(/auth\.jwt\(\) ->> 'email'/i)
    expect(f).toMatch(/obra cancelada/)
    expect(f).toMatch(/obra já faturada/)
    expect(f).toMatch(/obra já enviada para faturamento/)
    expect(f).toMatch(/upper\(btrim\(\w+\.cliente\)\) in \('DPSP', 'D1000'\)/i)
    expect(f).toMatch(/cliente libera por e-mail/)
    expect(f).toMatch(/obra sem cliente/)
    expect(semComentarios).toMatch(/grant execute on function public\.obras_enviar_para_faturamento\(uuid, text\) to authenticated/i)
  })

  it("enviar: grava pendFat, marco de hoje (São Paulo), fat_enviado_*, etapa_por/em, desde_etapa, atualizacao e duas linhas de histórico", () => {
    const f = corpo('obras_enviar_para_faturamento')
    expect(f).toMatch(/etapa = 'pendFat'/i)
    expect(f).toMatch(/\(now\(\) at time zone 'America\/Sao_Paulo'\)::date/i)
    expect(f).toMatch(/marco_liberou_fat = v_hoje/i)
    expect(f).toMatch(/desde_etapa = v_hoje/i)
    expect(f).toMatch(/atualizacao = v_hoje/i)
    expect(f).toMatch(/etapa_por = v_quem/i)
    expect(f).toMatch(/etapa_em = v_quando/i)
    for (const c of ['fat_enviado_em', 'fat_enviado_por', 'fat_enviado_obs', 'fat_enviado_etapa_anterior']) {
      expect(f).toMatch(new RegExp(`${c} =`, 'i'))
    }
    expect(f).toMatch(/insert into public\.obras_historico/i)
    expect(f).toMatch(/'Esteira'/)
    expect(f).toMatch(/\('etapa',/)
    expect(f).toMatch(/\('marco_liberou_fat',/)
    expect(f).toMatch(/'Enviada para faturamento'/)
    expect(f).toMatch(/left\(nullif\(btrim\(p_obs\), ''\), 500\)/i)
  })

  it('devolver: só service_role, recusa sem envio ou fora de pendFat, motivo obrigatório, volta à etapa anterior e limpa', () => {
    const f = corpo('obras_devolver_faturamento')
    expect(f).toMatch(/\(p_obra_id uuid, p_motivo text, p_quem text\)/i)
    expect(f).toMatch(/security invoker/i)
    expect(semComentarios).toMatch(/revoke execute on function public\.obras_devolver_faturamento\(uuid, text, text\) from public, anon, authenticated/i)
    expect(semComentarios).toMatch(/grant execute on function public\.obras_devolver_faturamento\(uuid, text, text\) to service_role/i)
    expect(semComentarios).not.toMatch(/grant execute on function public\.obras_devolver_faturamento[^;]*authenticated;/i)
    expect(f).toMatch(/fat_enviado_em is null/i)
    expect(f).toMatch(/etapa is distinct from 'pendFat'/i)
    expect(f).toMatch(/obra não está na fila do faturamento/)
    expect(f).toMatch(/informe o motivo/)
    expect(f).toMatch(/v_volta := coalesce\(v_antes\.fat_enviado_etapa_anterior/i)
    expect(f).toMatch(/etapa = v_volta/i)
    expect(f).toMatch(/marco_liberou_fat = null/i)
    for (const c of ['fat_enviado_em', 'fat_enviado_por', 'fat_enviado_obs', 'fat_enviado_etapa_anterior']) {
      expect(f).toMatch(new RegExp(`${c} = null`, 'i'))
    }
    expect(f).toMatch(/desde_etapa = v_hoje/i)
    expect(f).toMatch(/etapa_por = v_quem/i)
    expect(f).toMatch(/'Devolvida pelo financeiro: '/)
    expect(f).toMatch(/insert into public\.obras_historico/i)
    expect(f).toMatch(/'analista'/)
    expect(f).toMatch(/'os'/)
    expect(f).toMatch(/'loja'/)
  })

  it('gatilho: limpa fat_enviado_* quando a etapa muda para algo diferente de pendFat, sem histórico e sem tocar no marco', () => {
    expect(semComentarios).toMatch(/create trigger obras_obra_cancelar_envio_faturamento\s+before update of etapa on public\.obras_obra/i)
    const f = corpo('obras_obra_cancelar_envio_faturamento')
    expect(f).toMatch(/new\.etapa is distinct from old\.etapa and new\.etapa <> 'pendFat'/i)
    for (const c of ['fat_enviado_em', 'fat_enviado_por', 'fat_enviado_obs', 'fat_enviado_etapa_anterior']) {
      expect(f).toMatch(new RegExp(`new\.${c} := null`, 'i'))
    }
    expect(f).not.toMatch(/marco_liberou_fat/i)
    expect(f).not.toMatch(/obras_historico/i)
  })

  it('só escreve em obras_obra e obras_historico, sem security definer', () => {
    const escritas = [...semComentarios.matchAll(/\b(?:update|insert\s+into|delete\s+from)\s+(public\.\w+)/gi)].map((m) => m[1].toLowerCase())
    expect(new Set(escritas)).toEqual(new Set(['public.obras_obra', 'public.obras_historico']))
    expect(semComentarios).not.toMatch(/security definer/i)
  })

  it('tem seção 0, transação e verificação pós-commit com OK/*** FALHOU ***', () => {
    expect(semComentarios).toMatch(/obras_has_access/)
    expect(semComentarios).toMatch(/obras_historico_campo_check/)
    expect(semComentarios).toMatch(/\bbegin;/i)
    expect(semComentarios).toMatch(/\bcommit;/i)
    expect(sql).toMatch(/\*\*\* FALHOU \*\*\*/)
    expect(sql).toMatch(/'OK'/)
    expect(sql.indexOf('commit;')).toBeLessThan(sql.indexOf('*** FALHOU ***'))
  })
})
