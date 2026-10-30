-- ============================================================
-- OBRAS — Leva 1 do cronograma (início fixo, dias restantes, clima por turno,
-- histórico de status). Spec: docs/superpowers/specs/2026-10-30-obras-leva1-cronograma-design.md §8 e §8.1.
--
-- O QUE FAZ
--   1. obras_atividade.inicio_fixo date null (versionada: o trigger de
--      imutabilidade da versão salva já cobre — ele olha a versão, não colunas).
--   2. obras_atividade_exec.dias_restantes numeric(6,1) null, check >= 0.
--      As guardas obras_atividade_exec_guarda / _trava / _autor NÃO enumeram
--      colunas (olham só quem escreve, status e percentual): a coluna nova
--      passa por elas sem mudança. Conferido na leitura de
--      sdd-sql-obras-modalidade-obra-2.sql seção 3d.
--   3. obras_rdo.clima_manha / clima_tarde (mesmo check de clima). A máquina de
--      estados obras_rdo_estado compara row(...) com as colunas LISTADAS, então
--      é recriada aqui com as duas colunas novas (RDO validado/enviado fica
--      imutável também nelas). Resto do corpo idêntico ao de
--      sdd-sql-obras-modalidade-obra.sql seção 3c.
--   4. obras_atividade_status_hist: histórico só-inserção do status/percentual/
--      dias restantes por atividade. RLS: select e insert com obras_has_access();
--      com JWT, trigger exige engenheiro da obra ou admin
--      (obras_engenheiro_ou_admin) e carimba registrado_por com o e-mail da
--      sessão. Sem update/delete (nenhuma policy, grants revogados).
--   5. Backfill (§8.1-1): uma linha por obras_rdo_avanco de RDO validado/enviado,
--      origem 'diario'. Idempotente.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-10-30-verificacao-obras-leva1.sql.
--
-- IDEMPOTENTE: add column if not exists, create or replace, drop policy/trigger/
-- constraint if exists, backfill com not exists.
--
-- ARMADILHAS DO .claude/rules/sql.md
--   (1) Guarda com NULL: usa obras_engenheiro_ou_admin(...) is not true.
--   (2) Trigger compartilhada: não há — uma função por tabela.
--
-- ROLLBACK (só depois de reverter o app):
--   drop table public.obras_atividade_status_hist;
--   alter table public.obras_atividade drop column inicio_fixo;
--   alter table public.obras_atividade_exec drop column dias_restantes;
--   alter table public.obras_rdo drop column clima_manha, drop column clima_tarde;
--   e recriar obras_rdo_estado a partir de sdd-sql-obras-modalidade-obra.sql 3c.
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos
-- ============================================================
do $$
begin
  if to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null then
    raise exception 'Pré-requisito ausente: obras_has_access()/obras_is_admin() (sdd-sql-obras-v0.sql). Nada foi alterado.';
  end if;
  if to_regprocedure('public.obras_engenheiro_ou_admin(uuid)') is null
     or to_regprocedure('public.obras_rdo_estado()') is null
     or to_regclass('public.obras_atividade') is null
     or to_regclass('public.obras_atividade_exec') is null
     or to_regclass('public.obras_rdo') is null
     or to_regclass('public.obras_rdo_avanco') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra.sql e -2 não estão aplicados. Nada foi alterado.';
  end if;
end $$;

-- ============================================================
-- 1. Colunas novas
-- ============================================================
alter table public.obras_atividade add column if not exists inicio_fixo date;

alter table public.obras_atividade_exec add column if not exists dias_restantes numeric(6,1);
alter table public.obras_atividade_exec drop constraint if exists obras_atividade_exec_dias_restantes_check;
alter table public.obras_atividade_exec add constraint obras_atividade_exec_dias_restantes_check
  check (dias_restantes >= 0);

alter table public.obras_rdo add column if not exists clima_manha text;
alter table public.obras_rdo add column if not exists clima_tarde text;
alter table public.obras_rdo drop constraint if exists obras_rdo_clima_manha_check;
alter table public.obras_rdo add constraint obras_rdo_clima_manha_check
  check (clima_manha in ('sol','nublado','chuva','impraticavel'));
alter table public.obras_rdo drop constraint if exists obras_rdo_clima_tarde_check;
alter table public.obras_rdo add constraint obras_rdo_clima_tarde_check
  check (clima_tarde in ('sol','nublado','chuva','impraticavel'));

-- ============================================================
-- 2. Máquina de estados do RDO: row(...) passa a cobrir clima_manha/clima_tarde.
-- Corpo igual ao de sdd-sql-obras-modalidade-obra.sql 3c, só com as 2 colunas.
-- ============================================================
create or replace function public.obras_rdo_estado() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_eng   text;
begin
  if tg_op = 'INSERT' then
    if v_email is not null and (new.estado is distinct from 'rascunho'
        or new.validado_por is not null or new.validado_em is not null) then
      raise exception 'OBRAS_RDO_ESTADO: RDO novo nasce como rascunho' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.obra_id is distinct from old.obra_id or new.data is distinct from old.data then
    raise exception 'OBRAS_RDO_ESTADO: obra_id e data do RDO são imutáveis' using errcode = 'P0001';
  end if;

  if new.estado is distinct from old.estado
     and not ((old.estado = 'rascunho' and new.estado = 'validado')
           or (old.estado = 'validado' and new.estado = 'enviado')) then
    raise exception 'OBRAS_RDO_ESTADO: transição % -> % não permitida', old.estado, new.estado
      using errcode = 'P0001';
  end if;

  -- Toda mudança de estado (validar e enviar), numa sessão de usuário, é do
  -- engenheiro da obra ou de administrador.
  if v_email is not null and new.estado is distinct from old.estado then
    select o.engenheiro_email into v_eng from public.obras_obra o where o.id = new.obra_id;
    if not (public.obras_is_admin()
            or (v_eng is not null and v_email = lower(trim(v_eng)))) then
      raise exception 'OBRAS_RDO_ESTADO: só o engenheiro da obra ou administrador muda o estado do RDO'
        using errcode = '42501';
    end if;
  end if;

  if old.estado is distinct from 'rascunho' then
    if row(new.id, new.obra_id, new.data, new.sem_execucao, new.motivo_sem_execucao,
           new.efetivo, new.equipe_texto, new.clima, new.clima_manha, new.clima_tarde,
           new.programacao_amanha, new.registrado_por, new.validado_por, new.validado_em)
       is distinct from
       row(old.id, old.obra_id, old.data, old.sem_execucao, old.motivo_sem_execucao,
           old.efetivo, old.equipe_texto, old.clima, old.clima_manha, old.clima_tarde,
           old.programacao_amanha, old.registrado_por, old.validado_por, old.validado_em) then
      raise exception 'OBRAS_RDO_ESTADO: RDO % não pode ter o conteúdo alterado', old.estado
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- old.estado = 'rascunho'
  if new.estado = 'validado' then
    if v_email is not null then
      new.validado_por := v_email;
    end if;
    new.validado_em := now();
  elsif new.validado_por is distinct from old.validado_por
     or new.validado_em is distinct from old.validado_em then
    raise exception 'OBRAS_RDO_ESTADO: validado_por/validado_em só mudam na validação'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_rdo_estado() from public, anon, authenticated;

drop trigger if exists obras_rdo_estado on public.obras_rdo;
create trigger obras_rdo_estado before insert or update on public.obras_rdo
  for each row execute function public.obras_rdo_estado();

-- ============================================================
-- 3. Histórico de status por atividade (só inserção)
-- ============================================================
create table if not exists public.obras_atividade_status_hist (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  numero int not null,
  data_status date not null,
  percentual numeric(5,4) check (percentual between 0 and 1),
  dias_restantes numeric(6,1),
  status text not null
    check (status in ('nao_iniciado','em_andamento','concluido','bloqueado')),
  origem text not null check (origem in ('diario','status')),
  registrado_por text,
  registrado_em timestamptz not null default now()
);
create index if not exists obras_atividade_status_hist_obra_data_idx
  on public.obras_atividade_status_hist (obra_id, data_status);

alter table public.obras_atividade_status_hist enable row level security;

drop policy if exists "obras select" on public.obras_atividade_status_hist;
create policy "obras select" on public.obras_atividade_status_hist
  for select to authenticated using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_atividade_status_hist;
create policy "obras insert" on public.obras_atividade_status_hist
  for insert to authenticated with check ((select public.obras_has_access()));

revoke update, delete on public.obras_atividade_status_hist from anon, authenticated;

-- Guarda + autoria numa sessão de usuário (JWT com e-mail): só engenheiro da
-- obra ou admin insere; registrado_por := e-mail da sessão. Sem JWT passa
-- (service role, SQL Editor, backfill).
create or replace function public.obras_atividade_status_hist_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if v_email is null then
    return new;
  end if;
  if public.obras_engenheiro_ou_admin(new.obra_id) is not true then
    raise exception 'OBRAS_HISTORICO: só o engenheiro da obra ou administrador registra o histórico de status'
      using errcode = '42501';
  end if;
  new.registrado_por := v_email;
  return new;
end;
$$;
revoke execute on function public.obras_atividade_status_hist_guarda() from public, anon, authenticated;

drop trigger if exists obras_atividade_status_hist_guarda on public.obras_atividade_status_hist;
create trigger obras_atividade_status_hist_guarda
  before insert on public.obras_atividade_status_hist
  for each row execute function public.obras_atividade_status_hist_guarda();

-- ============================================================
-- 4. Backfill (§8.1-1): avanços dos RDOs validados/enviados. Idempotente.
-- ============================================================
insert into public.obras_atividade_status_hist
  (obra_id, numero, data_status, percentual, dias_restantes, status, origem, registrado_por)
select r.obra_id, a.numero, r.data, a.para, null,
       case when a.concluida then 'concluido' else 'em_andamento' end,
       'diario', r.validado_por
  from public.obras_rdo_avanco a
  join public.obras_rdo r on r.id = a.rdo_id
 where r.estado in ('validado','enviado')
   and not exists (
     select 1 from public.obras_atividade_status_hist h
      where h.obra_id = r.obra_id and h.numero = a.numero
        and h.data_status = r.data and h.origem = 'diario');

commit;

-- ============================================================
-- VERIFICAÇÃO (PASSO 2) — rodar depois do commit. Qualquer *** FALHOU *** = parar.
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'colunas novas existem (inicio_fixo, dias_restantes, clima_manha, clima_tarde)', '4',
      (select count(*)::text from information_schema.columns where table_schema = 'public'
        and ((table_name = 'obras_atividade' and column_name = 'inicio_fixo')
          or (table_name = 'obras_atividade_exec' and column_name = 'dias_restantes')
          or (table_name = 'obras_rdo' and column_name in ('clima_manha','clima_tarde'))))),
  (2, 'dias_restantes é numeric(6,1)', 'numeric|6|1',
      (select data_type || '|' || numeric_precision || '|' || numeric_scale from information_schema.columns
        where table_schema = 'public' and table_name = 'obras_atividade_exec' and column_name = 'dias_restantes')),
  (3, 'checks novos existem (dias_restantes, clima_manha, clima_tarde)', '3',
      (select count(*)::text from pg_constraint where conname in
        ('obras_atividade_exec_dias_restantes_check','obras_rdo_clima_manha_check','obras_rdo_clima_tarde_check'))),
  (4, 'tabela de histórico com RLS ligada', 'true',
      (select relrowsecurity::text from pg_class where oid = 'public.obras_atividade_status_hist'::regclass)),
  (5, 'policies do histórico: só select e insert', 'INSERT,SELECT',
      (select string_agg(cmd, ',' order by cmd) from pg_policies
        where schemaname = 'public' and tablename = 'obras_atividade_status_hist')),
  (6, 'authenticated não tem update/delete no histórico', 'false',
      (select (has_table_privilege('authenticated', 'public.obras_atividade_status_hist', 'UPDATE')
            or has_table_privilege('authenticated', 'public.obras_atividade_status_hist', 'DELETE'))::text)),
  (7, 'trigger de guarda do histórico presente e ligado', '1',
      (select count(*)::text from pg_trigger where tgname = 'obras_atividade_status_hist_guarda'
         and not tgisinternal and tgenabled = 'O')),
  (8, 'função de guarda fechada para authenticated e anon', 'false',
      (select (has_function_privilege('authenticated', 'public.obras_atividade_status_hist_guarda()', 'EXECUTE')
            or has_function_privilege('anon', 'public.obras_atividade_status_hist_guarda()', 'EXECUTE'))::text)),
  (9, 'obras_rdo_estado cobre clima_manha e clima_tarde (new e old)', 'true',
      (select (prosrc like '%new.clima_manha, new.clima_tarde%' and prosrc like '%old.clima_manha, old.clima_tarde%')::text
         from pg_proc where oid = 'public.obras_rdo_estado()'::regprocedure)),
  (10, 'trigger obras_rdo_estado ligado', '1',
      (select count(*)::text from pg_trigger where tgname = 'obras_rdo_estado' and not tgisinternal and tgenabled = 'O')),
  (11, 'guardas de execução continuam (guarda, trava, autor)', '3',
      (select count(*)::text from pg_trigger where tgname in
        ('obras_atividade_exec_guarda','obras_atividade_exec_trava','obras_atividade_exec_autor')
         and not tgisinternal and tgenabled = 'O')),
  (12, 'backfill: avanços de RDO validado/enviado sem linha no histórico', '0',
      (select count(*)::text from public.obras_rdo_avanco a join public.obras_rdo r on r.id = a.rdo_id
        where r.estado in ('validado','enviado')
          and not exists (select 1 from public.obras_atividade_status_hist h
                           where h.obra_id = r.obra_id and h.numero = a.numero
                             and h.data_status = r.data and h.origem = 'diario'))),
  (13, 'backfill: linhas origem diario >= avanços validados/enviados', 'true',
      (select ((select count(*) from public.obras_atividade_status_hist where origem = 'diario') >=
               (select count(*) from public.obras_rdo_avanco a join public.obras_rdo r on r.id = a.rdo_id
                 where r.estado in ('validado','enviado')))::text))
) as t(n, verificacao, esperado, encontrado)
order by n;
