-- Retenção dos históricos de execução que crescem sem limite (21/10/2026).
--
-- Contexto: alerta de Disk IO do Supabase (20/10/2026). O compute subiu de Nano
-- para Micro em 21/10; isto faz parte de "não precisar da Small": menos linhas
-- mortas nas tabelas que os jobs de 5 em 5 minutos tocam.
--
-- O que apaga, e por que é seguro (leitores conferidos no código e no banco em 21/10):
--
--   cron.job_run_details  > 14 dias
--     Só diagnóstico manual (ver .claude/rules/obras.md). Nenhuma tela, view ou
--     função lê. Tinha 47 mil linhas desde 14/08.
--
--   public.sync_runs  > 30 dias   (Cockpit / dash_field)
--     Leitores: v_sync_health (última rodada terminada por recurso + rodadas
--     presas DEPOIS dela), sync-locations.ts (último sucesso de locations),
--     export/conferencia (último sucesso). Nenhum lê histórico. Regra: só apaga
--     linha que tem uma rodada TERMINADA mais nova do mesmo recurso -- a última
--     terminada e tudo depois dela nunca saem, mesmo com o sync parado há meses.
--
--   public.obras_sync_execucao  > 30 dias   (Obras / hub)
--     Leitores: tela Sincronizar (10 mais recentes) e obras_iniciar_sync_execucao
--     (marca d'água = última com sucesso e marca não nula). Regra: nunca apaga
--     'rodando' nem a linha que carrega a marca d'água vigente.
--
-- NÃO mexe em extratos_cliente/extrato_chamados: os 30 dias foram pedido do
-- cliente em 09/10/2026 (conciliacao_limpar_extratos_antigos).
--
-- Job: 07:41 UTC (04:41 BRT). Minuto livre: não múltiplo de 5 (regra do sql.md)
-- e fora de :02/:17/:23/:37/:47, que outros jobs usam.
--
-- PRIMEIRA LIMPEZA de sync_runs (~31,5 mil linhas) NÃO pela função: sync_runs
-- está na publicação do Realtime e o SyncFreshnessBadge do Cockpit assina a
-- tabela com event "*" -- um DELETE em massa vira uma rajada de eventos por aba.
-- Por isso a seção 5 abaixo apaga em lotes de 500 por um job temporário de 30 em
-- 30 s, que se desagenda sozinho ao terminar. Depois disso a rotina diária apaga
-- ~900 linhas/dia, o que é aceitável. Revisão independente em 21/10/2026:
-- aprovado com ajustes (este minuto, os lotes e o revoke de service_role).

begin;

-- ============================================================
-- 0. Pré-requisitos: aborta se algo esperado não existir
-- ============================================================
do $$
begin
  if to_regclass('cron.job_run_details') is null
     or to_regclass('public.sync_runs') is null
     or to_regclass('public.obras_sync_execucao') is null then
    raise exception 'retencao-historicos: tabela esperada ausente';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'sync_runs'
                   and column_name in ('resource', 'started_at', 'finished_at')
                 having count(*) = 3) then
    raise exception 'retencao-historicos: sync_runs sem resource/started_at/finished_at';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'obras_sync_execucao'
                   and column_name in ('iniciada_em', 'finalizada_em', 'status', 'marca_dagua_nova')
                 having count(*) = 4) then
    raise exception 'retencao-historicos: obras_sync_execucao sem as colunas esperadas';
  end if;
  if exists (select 1 from pg_constraint
             where contype = 'f'
               and confrelid in ('public.sync_runs'::regclass, 'public.obras_sync_execucao'::regclass)) then
    raise exception 'retencao-historicos: alguém referencia sync_runs/obras_sync_execucao por FK; rever antes';
  end if;
end $$;


-- ============================================================
-- 1. Função
-- ============================================================
create or replace function public.hub_limpar_historicos_execucao()
returns jsonb
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_cron int;
  v_sync int;
  v_obras int;
begin
  delete from cron.job_run_details
  where start_time < now() - interval '14 days';
  get diagnostics v_cron = row_count;

  delete from public.sync_runs r
  where r.started_at < now() - interval '30 days'
    and exists (
      select 1 from public.sync_runs t
      where t.resource = r.resource
        and t.finished_at is not null
        and t.started_at > r.started_at
    );
  get diagnostics v_sync = row_count;

  delete from public.obras_sync_execucao e
  where e.iniciada_em < now() - interval '30 days'
    and e.status <> 'rodando'
    and e.id is distinct from (
      select m.id from public.obras_sync_execucao m
      where m.status = 'sucesso' and m.marca_dagua_nova is not null
      order by m.finalizada_em desc
      limit 1
    );
  get diagnostics v_obras = row_count;

  return jsonb_build_object('cron', v_cron, 'sync_runs', v_sync, 'obras_sync_execucao', v_obras);
end $$;

revoke all on function public.hub_limpar_historicos_execucao() from public, anon, authenticated, service_role;


-- ============================================================
-- 2. Job diário (cron.schedule com nome já existente só atualiza)
-- ============================================================
select cron.schedule(
  'hub-limpar-historicos-execucao',
  '41 7 * * *',
  $$select public.hub_limpar_historicos_execucao()$$
);

commit;


-- ============================================================
-- 3. Verificação (rodar depois do commit; tudo tem que dar OK)
-- ============================================================
with v(item, ok) as (
  select 'job agendado e ativo',
         exists (select 1 from cron.job where jobname = 'hub-limpar-historicos-execucao'
                 and schedule = '41 7 * * *' and active)
  union all select 'service_role sem execute',
         not has_function_privilege('service_role', 'public.hub_limpar_historicos_execucao()', 'execute')
  union all select 'anon sem execute',
         not has_function_privilege('anon', 'public.hub_limpar_historicos_execucao()', 'execute')
  union all select 'authenticated sem execute',
         not has_function_privilege('authenticated', 'public.hub_limpar_historicos_execucao()', 'execute')
  union all select 'função não é security definer',
         not (select prosecdef from pg_proc where oid = 'public.hub_limpar_historicos_execucao()'::regprocedure)
)
select item, case when ok then 'OK' else '*** FALHOU ***' end as resultado from v;


-- ============================================================
-- 4. Verificação depois da 1ª execução (rodar após chamar a função uma vez)
-- ============================================================
-- with v(item, ok) as (
--   select 'v_sync_health: todo recurso ainda tem rodada terminada',
--          not exists (select 1 from public.v_sync_health where finished_at is null)
--   union all select 'locations: último sucesso preservado',
--          exists (select 1 from public.sync_runs where resource = 'locations' and success)
--   union all select 'obras: marca d''água preservada',
--          exists (select 1 from public.obras_sync_execucao where status = 'sucesso' and marca_dagua_nova is not null)
--   union all select 'obras: tela Sincronizar ainda tem 10 execuções',
--          (select count(*) from public.obras_sync_execucao) >= 10
--   union all select 'cron: nada com mais de 14 dias',
--          not exists (select 1 from cron.job_run_details where start_time < now() - interval '14 days')
-- ) select item, case when ok then 'OK' else '*** FALHOU ***' end as resultado from v;


-- ============================================================
-- 5. Primeira limpeza (rodar UMA vez, depois do commit)
-- ============================================================
-- cron.job_run_details e obras_sync_execucao não estão no Realtime: saem de uma vez.
-- delete from cron.job_run_details where start_time < now() - interval '14 days';
-- delete from public.obras_sync_execucao e
-- where e.iniciada_em < now() - interval '30 days' and e.status <> 'rodando'
--   and e.id is distinct from (select m.id from public.obras_sync_execucao m
--     where m.status = 'sucesso' and m.marca_dagua_nova is not null
--     order by m.finalizada_em desc limit 1);
--
-- sync_runs: job temporário, 500 linhas a cada 30 s; desagenda a si mesmo quando zera.
-- select cron.schedule('hub-limpeza-inicial-sync-runs', '30 seconds', $job$
--   with alvo as (
--     select r.id from public.sync_runs r
--     where r.started_at < now() - interval '30 days'
--       and exists (select 1 from public.sync_runs t
--                   where t.resource = r.resource and t.finished_at is not null
--                     and t.started_at > r.started_at)
--     order by r.started_at limit 500
--   ), apagadas as (
--     delete from public.sync_runs s using alvo where s.id = alvo.id returning 1
--   )
--   select case when (select count(*) from apagadas) = 0
--               then cron.unschedule('hub-limpeza-inicial-sync-runs') end
-- $job$);


-- ============================================================
-- Rollback (não devolve as linhas apagadas; só para de apagar)
-- ============================================================
-- select cron.unschedule('hub-limpar-historicos-execucao');
-- select cron.unschedule('hub-limpeza-inicial-sync-runs');  -- se ainda existir
-- drop function if exists public.hub_limpar_historicos_execucao();
