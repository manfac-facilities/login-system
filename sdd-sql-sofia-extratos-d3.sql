-- ============================================================
-- *** NÃO APLICADO *** (escrito em 29/10/2026, branch feat/frotas-d3-encerrar-ligacao)
-- Gestão de Frotas (Sofia) — D3: "encerrar ligação" de cartão Ticketlog / tag Veloe
-- Design: docs/superpowers/specs/2026-10-28-frotas-extratos-cadastros-design.md
-- (decisões do João sobre o mockup, item D3) e docs/DIVIDAS.md.
--
-- DESENHO: encerrar = INSERIR uma linha nova em sofia_extrato_ligacoes com
-- equipe_id NULL e vigente_desde = data do encerramento. A tabela continua
-- SÓ INSERÇÃO. A view sofia_extrato_consumo (sdd-sql-sofia-extratos.sql, já
-- aplicada) pega a última ligação vigente na data de uso e, com equipe_id
-- nulo, devolve motivo_sem_centro_custo = 'sem_equipe' — a view NÃO muda.
-- Religar = cadastro normal com equipe (linha nova com vigente_desde maior).
--
-- ÚNICA MUDANÇA DE SCHEMA: sofia_extrato_ligacoes.equipe_id deixa de ser
-- NOT NULL. Conferido: nenhuma constraint, policy (sofia_extrato_ler /
-- sofia_extrato_gravar não citam equipe_id), função ou view depende de ele
-- ser não nulo; a FK para equipes aceita NULL.
--
-- DEPENDE de sdd-sql-sofia-extratos.sql (a seção 0 ABORTA sem ele).
-- ORDEM: este (verificação 8/8; PGlite local: 8/8, reaplicação 8/8, teste 10/10) -> sdd-sql-sofia-extratos-d3-teste.sql -> deploy do app.
-- (O app novo grava equipe_id nulo: sem este SQL, "Encerrar" falha com erro de NOT NULL.)
-- Rodar como postgres, projeto iyytcavcgukfjnjjrerx. Idempotente.
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS — aborta a transação se algo não estiver aplicado
-- ============================================================
do $$
begin
  if to_regclass('public.sofia_extrato_ligacoes') is null then
    raise exception 'ABORTADO: public.sofia_extrato_ligacoes não existe — aplique sdd-sql-sofia-extratos.sql antes';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'sofia_extrato_ligacoes'
                   and column_name = 'equipe_id' and data_type = 'uuid') then
    raise exception 'ABORTADO: sofia_extrato_ligacoes.equipe_id (uuid) não existe';
  end if;
  if to_regclass('public.sofia_extrato_consumo') is null then
    raise exception 'ABORTADO: view sofia_extrato_consumo não existe — aplique sdd-sql-sofia-extratos.sql antes';
  end if;
  -- a view tem que tratar equipe nula como sem_equipe (é o que sustenta o D3)
  if position('equipe_id IS NULL' in pg_get_viewdef(to_regclass('public.sofia_extrato_consumo'))) = 0 then
    raise exception 'ABORTADO: sofia_extrato_consumo não trata equipe_id nulo como sem_equipe';
  end if;
end;
$$;

-- ============================================================
-- 1. equipe_id passa a aceitar NULL (= ligação encerrada)
-- ============================================================
alter table public.sofia_extrato_ligacoes alter column equipe_id drop not null;

comment on table public.sofia_extrato_ligacoes is
  'Cartão Ticketlog / tag Veloe -> equipe, com vigência. Só inserção: trocar de equipe, encerrar (equipe_id nulo) ou corrigir = linha nova. A placa NUNCA é chave (Ticketlog traz placa errada).';
comment on column public.sofia_extrato_ligacoes.equipe_id is
  'Equipe a partir de vigente_desde. NULL = ligação ENCERRADA nessa data (gastos dali em diante: sem_equipe).';

commit;


-- ============================================================
-- VERIFICAÇÃO (depois do commit) — uma linha por invariante.
-- 8 linhas. Qualquer "*** FALHOU ***" = parar, não deployar.
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'sofia_extrato_ligacoes.equipe_id aceita NULL', 'YES',
      (select is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'sofia_extrato_ligacoes' and column_name = 'equipe_id')),
  (2, 'FK equipe_id -> equipes continua (on delete restrict)', 'true',
      (select (count(*) = 1)::text from pg_constraint
       where conrelid = to_regclass('public.sofia_extrato_ligacoes') and contype = 'f'
         and confrelid = to_regclass('public.equipes') and confdeltype = 'r')),
  (3, 'as 5 tabelas continuam sem UPDATE/DELETE/TRUNCATE (authenticated e service_role)', 'false',
      (select bool_or(has_table_privilege(r, t, 'UPDATE') or has_table_privilege(r, t, 'DELETE') or has_table_privilege(r, t, 'TRUNCATE'))::text
       from unnest(array['authenticated','service_role']) r,
            unnest(array['public.sofia_extrato_ligacoes','public.sofia_equipe_centro_custo','public.sofia_extrato_envios',
                          'public.sofia_extrato_linhas','public.sofia_extrato_saldos']) t)),
  (4, 'policies das 5 tabelas inalteradas: ler(SELECT)+gravar(INSERT), 10 no total', '10',
      (select count(*)::text from pg_policies
       where schemaname = 'public'
         and tablename in ('sofia_extrato_ligacoes','sofia_equipe_centro_custo','sofia_extrato_envios','sofia_extrato_linhas','sofia_extrato_saldos')
         and ((policyname = 'sofia_extrato_ler' and cmd = 'SELECT') or (policyname = 'sofia_extrato_gravar' and cmd = 'INSERT')))),
  (5, 'policy gravar de ligacoes: sofia_pode_gerir() + carimbo = e-mail da sessão', 'true',
      (select (with_check like '%sofia_pode_gerir()%' and with_check like '%auth.jwt()%' and with_check like '%criado_por%')::text
       from pg_policies where schemaname = 'public' and tablename = 'sofia_extrato_ligacoes' and policyname = 'sofia_extrato_gravar')),
  (6, 'anon sem privilégio em sofia_extrato_ligacoes', 'false',
      (select has_table_privilege('anon', 'public.sofia_extrato_ligacoes', 'SELECT,INSERT,UPDATE,DELETE')::text)),
  (7, 'view sofia_extrato_consumo continua security_invoker e trata equipe nula', 'true',
      (select (coalesce('security_invoker=true' = any(c.reloptions), false)
               and position('equipe_id IS NULL' in pg_get_viewdef(c.oid)) > 0)::text
       from pg_class c where c.oid = to_regclass('public.sofia_extrato_consumo'))),
  (8, 'as 18 policies "sofia access" continuam 18', '18',
      (select count(*)::text from pg_policies where schemaname = 'public' and policyname = 'sofia access'))
) as t(n, verificacao, esperado, encontrado)
order by n;


-- ============================================================
-- ROLLBACK (comentado). Reverter o app ANTES. SÓ VOLTA se não houver linha
-- com equipe_id nulo: a tabela é só-inserção, então essas linhas não podem
-- ser apagadas — com elas, o "set not null" falha e o rollback não se aplica.
-- Conferir antes:  select count(*) from public.sofia_extrato_ligacoes where equipe_id is null;
-- ============================================================
-- begin;
-- alter table public.sofia_extrato_ligacoes alter column equipe_id set not null;
-- commit;
