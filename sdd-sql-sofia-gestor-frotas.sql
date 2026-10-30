-- ============================================================
-- *** NÃO APLICADO *** (escrito em 26/10/2026, branch feat/frotas-gestor)
-- Gestão de Frotas (Sofia) — papel "gestor de frotas" — 2026-10-26
-- Spec: docs/frotas/2026-10-26-spec-gestor-frotas.md
-- Revisão (prevalece): docs/frotas/2026-10-26-revisao-spec-gestor-frotas.md
-- Decisão: docs/frotas/2026-10-26-decisoes-joao.md (D2)
-- ============================================================
-- O QUE FAZ
--   (1) cria public.sofia_gestores (quem é gestor de frotas). Sem policy,
--       sem grant para anon/authenticated: escrita e leitura só postgres /
--       service role. Mesmo motivo de hub_system_access (incidente de
--       10/08/2026: policy de escrita aberta = autopromoção pelo navegador).
--   (2) cria public.sofia_pode_gerir(): admin do hub OU (linha em
--       sofia_gestores E hub_system_access sofia/has_access=true). Sempre
--       true/false, nunca NULL.
--   (3) reescreve sofia_bloquear_autorizacao_nao_admin() e
--       sofia_bloquear_escrita_nao_admin() (os 8 triggers continuam os
--       mesmos) trocando "if not sofia_is_admin()" por
--       "if sofia_pode_gerir() is not true".
--   (4) reescreve excluir_multas_em_massa(uuid[]) com a mesma troca.
--
-- O QUE NÃO FAZ: não toca hub_user_roles, hub_system_access, as 18 policies
-- "sofia access", sofia_is_admin(), sofia_has_access(), lancar_km_atomico,
-- atribuir_responsabilidade_veiculo, nem nada de Obras/CRM/Admin.
--
-- INERTE ATÉ A PRIMEIRA LINHA EM sofia_gestores: para admin e não-gestor o
-- resultado é idêntico ao de hoje.
--
-- LIMITAÇÃO MANTIDA: os triggers continuam barrando postgres/service_role
-- (auth.jwt() NULL => sofia_pode_gerir() false). Contorno documentado em
-- .claude/rules/sql.md (disable trigger / corrigir / enable).
--
-- ESTADO: NÃO APLICADO. Projeto iyytcavcgukfjnjjrerx — confirme o ref.
-- Depois de aplicar: rodar sdd-sql-sofia-gestor-frotas-teste.sql.
-- IDEMPOTENTE: create table if not exists, create or replace, drop de
-- policies em laço, revoke/grant repetíveis. A seção 0 aceita tanto o
-- estado antigo (sofia_is_admin) quanto o já migrado (sofia_pode_gerir).
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS E DERIVA — aborta se produção não estiver como os
--    arquivos dizem. Trocar o corpo de uma função que já divergiu do
--    arquivo apagaria a divergência em silêncio.
-- ============================================================
do $$
declare
  v_src text;
  v_n   int;
begin
  -- tabelas de acesso
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'hub_system_access'
                   and column_name = 'system_slug' and data_type = 'text')
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'hub_system_access'
                      and column_name = 'user_email' and data_type = 'text')
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'hub_system_access'
                      and column_name = 'has_access' and data_type = 'boolean')
  then
    raise exception 'hub_system_access sem user_email/system_slug(text)/has_access(boolean) — abortando';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'hub_user_roles'
                   and column_name = 'nivel') then
    raise exception 'hub_user_roles.nivel não existe — abortando';
  end if;

  -- funções que esta migration usa ou reescreve
  if to_regprocedure('public.sofia_is_admin()') is null
     or to_regprocedure('public.sofia_has_access()') is null
     or to_regprocedure('public.sofia_bloquear_autorizacao_nao_admin()') is null
     or to_regprocedure('public.sofia_bloquear_escrita_nao_admin()') is null
     or to_regprocedure('public.excluir_multas_em_massa(uuid[])') is null
  then
    raise exception 'funções do v04-seguranca/track-c ausentes — abortando';
  end if;

  -- os 8 triggers, cada um na tabela certa, ligado à função certa e HABILITADO
  -- (pega trigger esquecido desabilitado pelo contorno do SQL Editor)
  select count(*) into v_n
  from (values
    ('trg_bloquear_autorizacao_multas',      'public.multas',                 'sofia_bloquear_autorizacao_nao_admin'),
    ('trg_bloquear_autorizacao_sinistros',   'public.sinistros',              'sofia_bloquear_autorizacao_nao_admin'),
    ('trg_bloquear_autorizacao_km_excedido', 'public.km_excedido_desconto',   'sofia_bloquear_autorizacao_nao_admin'),
    ('trg_bloquear_escrita_equipes',         'public.equipes',                'sofia_bloquear_escrita_nao_admin'),
    ('trg_bloquear_escrita_veiculos',        'public.veiculos',               'sofia_bloquear_escrita_nao_admin'),
    ('trg_bloquear_escrita_centro_custo',    'public.centro_custo_historico', 'sofia_bloquear_escrita_nao_admin'),
    ('trg_bloquear_escrita_abastecimentos',  'public.abastecimentos',         'sofia_bloquear_escrita_nao_admin'),
    ('trg_bloquear_escrita_km_diario',       'public.km_diario',              'sofia_bloquear_escrita_nao_admin')
  ) as e(tg, tab, fn)
  join pg_trigger t on t.tgname = e.tg and t.tgrelid = to_regclass(e.tab) and not t.tgisinternal
                   and t.tgenabled <> 'D'
  join pg_proc p on p.oid = t.tgfoid and p.proname = e.fn;
  if v_n <> 8 then
    raise exception 'esperados 8 triggers trg_bloquear_* habilitados e ligados às funções certas, achados % — abortando', v_n;
  end if;

  -- deriva dos corpos: mesma guarda (antiga ou nova) e mesmo número de raise
  select prosrc into v_src from pg_proc where oid = to_regprocedure('public.sofia_bloquear_autorizacao_nao_admin()');
  if v_src !~ '(sofia_is_admin|sofia_pode_gerir)\(\)'
     or (length(v_src) - length(replace(v_src, 'raise exception', ''))) / length('raise exception') <> 7
     or position('status_desconto' in v_src) = 0
     or position('km_excedido_desconto' in v_src) = 0
  then
    raise exception 'sofia_bloquear_autorizacao_nao_admin em produção difere do arquivo (esperado 7 raise) — comparar antes de aplicar';
  end if;

  select prosrc into v_src from pg_proc where oid = to_regprocedure('public.sofia_bloquear_escrita_nao_admin()');
  if v_src !~ '(sofia_is_admin|sofia_pode_gerir)\(\)'
     or (length(v_src) - length(replace(v_src, 'raise exception', ''))) / length('raise exception') <> 5
     or position('valor_locacao_mensal' in v_src) = 0
     or position('centro_custo_historico' in v_src) = 0
  then
    raise exception 'sofia_bloquear_escrita_nao_admin em produção difere do arquivo (esperado 5 raise) — comparar antes de aplicar';
  end if;

  select prosrc into v_src from pg_proc where oid = to_regprocedure('public.excluir_multas_em_massa(uuid[])');
  if v_src !~ '(sofia_is_admin|sofia_pode_gerir)\(\) is not true'
     or position('auth.uid()' in v_src) = 0
  then
    raise exception 'excluir_multas_em_massa em produção difere do arquivo — comparar antes de aplicar';
  end if;

  -- sofia_gestores pré-existente com outro formato: "create table if not
  -- exists" passaria calado e a função leria uma tabela diferente da desenhada
  if to_regclass('public.sofia_gestores') is not null then
    if (select string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' order by column_name)
        from information_schema.columns
        where table_schema = 'public' and table_name = 'sofia_gestores')
       is distinct from
       'created_at:timestamp with time zone:NO,granted_by:text:NO,user_email:text:NO'
    then
      raise exception 'sofia_gestores já existe com colunas diferentes do arquivo — abortando';
    end if;
    if (select string_agg(a.attname, ',' order by a.attname)
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
        where c.conrelid = to_regclass('public.sofia_gestores') and c.contype = 'p')
       is distinct from 'user_email'
    then
      raise exception 'sofia_gestores já existe com PK diferente de (user_email) — abortando';
    end if;
  end if;
end;
$$;


-- ============================================================
-- 1. TABELA sofia_gestores
-- ============================================================
create table if not exists public.sofia_gestores (
  user_email text primary key
    constraint sofia_gestores_email_normalizado
      check (user_email = lower(trim(user_email)) and user_email <> ''),
  granted_by text not null,
  created_at timestamptz not null default now()
);

comment on table public.sofia_gestores is
  'Gestor de frotas: pode, só no Sofia, o que o administrador do hub pode. Vale só com hub_system_access sofia/has_access=true. Escrita só postgres/service role — NUNCA criar policy de escrita (incidente 10/08/2026).';

alter table public.sofia_gestores enable row level security;

-- nenhuma policy: dropa qualquer uma que exista (criada à mão, reaplicação)
do $$
declare v_pol record;
begin
  for v_pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'sofia_gestores'
  loop
    execute format('drop policy %I on public.sofia_gestores', v_pol.policyname);
  end loop;
end;
$$;

-- segunda barreira, independente da RLS: sem privilégio de tabela
revoke all on table public.sofia_gestores from public, anon, authenticated;

-- service role (app/admin/_actions.ts apagarLinhasDoUsuario) precisa apagar a
-- linha na remoção de usuário. O default privileges do Supabase já concede;
-- explícito para não depender disso (verificação #18).
grant select, insert, delete on table public.sofia_gestores to service_role;


-- ============================================================
-- 2. FUNÇÃO sofia_pode_gerir()
-- ============================================================
create or replace function public.sofia_pode_gerir()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select coalesce(
    public.sofia_is_admin()
    or (
      exists (
        select 1 from public.sofia_gestores g
        where g.user_email = lower(trim(auth.jwt() ->> 'email'))
      )
      and exists (
        select 1 from public.hub_system_access a
        where a.user_email = lower(trim(auth.jwt() ->> 'email'))
          and a.system_slug = 'sofia'
          and a.has_access = true
      )
    ),
    false
  );
$$;

revoke all on function public.sofia_pode_gerir() from public, anon;
grant execute on function public.sofia_pode_gerir() to authenticated;


-- ============================================================
-- 3. TRIGGER: autorização/desconto (multas, sinistros, km_excedido_desconto)
--    "admin" no nome = "pode gerir frotas" desde 2026-10-26.
--    IF EXTERNO por tabela: não juntar TG_TABLE_NAME e new.campo num "and"
--    (42703 record "new" has no field — .claude/rules/sql.md).
-- ============================================================
create or replace function public.sofia_bloquear_autorizacao_nao_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.sofia_pode_gerir() is not true then
    if TG_OP = 'UPDATE' then
      if TG_TABLE_NAME = 'multas' then
        if new.autorizacao_status is distinct from old.autorizacao_status
          or new.valor_descontado is distinct from old.valor_descontado
          or new.status is distinct from old.status
        then
          raise exception 'Apenas administradores ou gestores de frotas podem alterar autorização/desconto de multas';
        end if;
      elsif TG_TABLE_NAME = 'sinistros' then
        if new.autorizacao_status is distinct from old.autorizacao_status
          or new.valor_descontado is distinct from old.valor_descontado
          or new.status_desconto is distinct from old.status_desconto
        then
          raise exception 'Apenas administradores ou gestores de frotas podem alterar autorização/desconto de sinistros';
        end if;
      elsif TG_TABLE_NAME = 'km_excedido_desconto' then
        if new.autorizacao_status is distinct from old.autorizacao_status then
          raise exception 'Apenas administradores ou gestores de frotas podem alterar autorização de KM excedido';
        end if;
      end if;
    elsif TG_OP = 'INSERT' then
      if TG_TABLE_NAME = 'multas' then
        if new.autorizacao_status is distinct from 'sem_solicitacao'
          or new.valor_descontado is not null
          or new.status is distinct from 'pendente'
        then
          raise exception 'Apenas administradores ou gestores de frotas podem inserir multas com autorização/desconto já definidos';
        end if;
      elsif TG_TABLE_NAME = 'sinistros' then
        if new.autorizacao_status is distinct from 'sem_solicitacao'
          or new.valor_descontado is not null
          or new.status_desconto is distinct from 'pendente'
        then
          raise exception 'Apenas administradores ou gestores de frotas podem inserir sinistros com autorização/desconto já definidos';
        end if;
      elsif TG_TABLE_NAME = 'km_excedido_desconto' then
        if new.autorizacao_status is distinct from 'sem_solicitacao' then
          raise exception 'Apenas administradores ou gestores de frotas podem inserir KM excedido com autorização já definida';
        end if;
      end if;
    elsif TG_OP = 'DELETE' then
      if TG_TABLE_NAME in ('multas', 'sinistros', 'km_excedido_desconto') then
        raise exception 'Apenas administradores ou gestores de frotas podem excluir este registro';
      end if;
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


-- ============================================================
-- 4. TRIGGER: demais escritas restritas (equipes.ativo,
--    veiculos.valor_locacao_mensal, insert centro_custo_historico,
--    delete abastecimentos/km_diario)
-- ============================================================
create or replace function public.sofia_bloquear_escrita_nao_admin()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if public.sofia_pode_gerir() is not true then
    if TG_OP = 'UPDATE' then
      if TG_TABLE_NAME = 'equipes' then
        if new.ativo is distinct from old.ativo then
          raise exception 'Apenas administradores ou gestores de frotas podem ativar/desativar equipes';
        end if;
      elsif TG_TABLE_NAME = 'veiculos' then
        if new.valor_locacao_mensal is distinct from old.valor_locacao_mensal then
          raise exception 'Apenas administradores ou gestores de frotas podem alterar o valor de locação do veículo';
        end if;
      end if;
    elsif TG_OP = 'INSERT' then
      if TG_TABLE_NAME = 'centro_custo_historico' then
        raise exception 'Apenas administradores ou gestores de frotas podem atualizar o centro de custo';
      end if;
    elsif TG_OP = 'DELETE' then
      if TG_TABLE_NAME = 'abastecimentos' then
        raise exception 'Apenas administradores ou gestores de frotas podem excluir abastecimentos';
      end if;
      if TG_TABLE_NAME = 'km_diario' then
        raise exception 'Apenas administradores ou gestores de frotas podem excluir lançamentos de KM';
      end if;
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;


-- ============================================================
-- 5. RPC excluir_multas_em_massa — mesma assinatura, guarda nova.
--    security definer ignora RLS: a guarda é a ÚNICA proteção.
-- ============================================================
create or replace function public.excluir_multas_em_massa(
  p_ids uuid[]
)
returns setof public.multas
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_multa record;
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem excluir multas';
  end if;

  for v_multa in
    delete from public.multas where id = any(p_ids) returning *
  loop
    insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id)
    values (
      'multas', 'excluiu', v_multa.id::text,
      'Multa excluída em massa — ' || coalesce(v_multa.tipo_infracao, v_multa.descricao, v_multa.id::text),
      auth.uid()
    );
    return next v_multa;
  end loop;
end;
$$;

revoke execute on function public.excluir_multas_em_massa(uuid[]) from public, anon;
grant execute on function public.excluir_multas_em_massa(uuid[]) to authenticated;

commit;


-- ============================================================
-- VERIFICAÇÃO (depois do commit) — uma linha por invariante.
-- 18 linhas. Qualquer "*** FALHOU ***" = parar, não deployar.
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'sofia_gestores existe com RLS ligada', 'true',
      (select relrowsecurity::text from pg_class where oid = to_regclass('public.sofia_gestores'))),
  (2, 'sofia_gestores: nenhuma policy', '0',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'sofia_gestores')),
  (3, 'anon e authenticated sem NENHUM privilégio em sofia_gestores', 'false',
      (select (has_table_privilege('anon', 'public.sofia_gestores', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('authenticated', 'public.sofia_gestores', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::text)),
  (4, 'sofia_gestores: colunas', 'created_at,granted_by,user_email',
      (select string_agg(column_name, ',' order by column_name) from information_schema.columns
       where table_schema = 'public' and table_name = 'sofia_gestores')),
  (5, 'sofia_gestores: CHECK de e-mail normalizado existe', '1',
      (select count(*)::text from pg_constraint
       where conrelid = to_regclass('public.sofia_gestores') and conname = 'sofia_gestores_email_normalizado')),
  (6, 'sofia_pode_gerir é security definer', 'true',
      (select prosecdef::text from pg_proc where oid = to_regprocedure('public.sofia_pode_gerir()'))),
  (7, 'sofia_pode_gerir com search_path fixo', 'true',
      (select ('search_path=pg_catalog, public' = any(proconfig))::text
       from pg_proc where oid = to_regprocedure('public.sofia_pode_gerir()'))),
  (8, 'sofia_pode_gerir: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.sofia_pode_gerir()', 'EXECUTE')
            and not has_function_privilege('anon', 'public.sofia_pode_gerir()', 'EXECUTE'))::text)),
  (9, 'sofia_pode_gerir sem JWT devolve false (não NULL)', 'false',
      (select coalesce(public.sofia_pode_gerir()::text, 'NULL'))),
  (10, 'trigger autorizacao usa sofia_pode_gerir() is not true e não sofia_is_admin', 'true',
      (select (position('sofia_pode_gerir() is not true' in prosrc) > 0
            and position('sofia_is_admin' in prosrc) = 0)::text
       from pg_proc where oid = to_regprocedure('public.sofia_bloquear_autorizacao_nao_admin()'))),
  (11, 'trigger escrita usa sofia_pode_gerir() is not true e não sofia_is_admin', 'true',
      (select (position('sofia_pode_gerir() is not true' in prosrc) > 0
            and position('sofia_is_admin' in prosrc) = 0)::text
       from pg_proc where oid = to_regprocedure('public.sofia_bloquear_escrita_nao_admin()'))),
  (12, 'excluir_multas_em_massa usa sofia_pode_gerir() is not true', 'true',
      (select (position('sofia_pode_gerir() is not true' in prosrc) > 0
            and position('sofia_is_admin' in prosrc) = 0)::text
       from pg_proc where oid = to_regprocedure('public.excluir_multas_em_massa(uuid[])'))),
  (13, 'excluir_multas_em_massa: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.excluir_multas_em_massa(uuid[])', 'EXECUTE')
            and not has_function_privilege('anon', 'public.excluir_multas_em_massa(uuid[])', 'EXECUTE'))::text)),
  (14, 'os 8 triggers trg_bloquear_* (lista exata) continuam habilitados e ligados às funções certas', '8',
      (select count(*)::text
       from (values
         ('trg_bloquear_autorizacao_multas',      'public.multas',                 'sofia_bloquear_autorizacao_nao_admin'),
         ('trg_bloquear_autorizacao_sinistros',   'public.sinistros',              'sofia_bloquear_autorizacao_nao_admin'),
         ('trg_bloquear_autorizacao_km_excedido', 'public.km_excedido_desconto',   'sofia_bloquear_autorizacao_nao_admin'),
         ('trg_bloquear_escrita_equipes',         'public.equipes',                'sofia_bloquear_escrita_nao_admin'),
         ('trg_bloquear_escrita_veiculos',        'public.veiculos',               'sofia_bloquear_escrita_nao_admin'),
         ('trg_bloquear_escrita_centro_custo',    'public.centro_custo_historico', 'sofia_bloquear_escrita_nao_admin'),
         ('trg_bloquear_escrita_abastecimentos',  'public.abastecimentos',         'sofia_bloquear_escrita_nao_admin'),
         ('trg_bloquear_escrita_km_diario',       'public.km_diario',              'sofia_bloquear_escrita_nao_admin')
       ) as e(tg, tab, fn)
       join pg_trigger t on t.tgname = e.tg and t.tgrelid = to_regclass(e.tab) and not t.tgisinternal
                        and t.tgenabled <> 'D'
       join pg_proc p on p.oid = t.tgfoid and p.proname = e.fn)),
  (15, 'hub_system_access: policies inalteradas (só SELECT)', 'SELECT:{authenticated}',
      (select coalesce(string_agg(cmd || ':' || roles::text, ', ' order by cmd), '(nenhuma)')
       from pg_policies where schemaname = 'public' and tablename = 'hub_system_access')),
  (16, 'hub_user_roles: policies inalteradas (só SELECT)', 'SELECT:{authenticated}',
      (select coalesce(string_agg(cmd || ':' || roles::text, ', ' order by cmd), '(nenhuma)')
       from pg_policies where schemaname = 'public' and tablename = 'hub_user_roles')),
  (17, 'sofia_has_access não foi tocada (não cita sofia_pode_gerir)', 'true',
      (select (position('sofia_pode_gerir' in prosrc) = 0)::text
       from pg_proc where oid = to_regprocedure('public.sofia_has_access()'))),
  -- has_table_privilege com lista devolve true se QUALQUER um existir;
  -- aqui exigimos os três, então uma chamada por privilégio.
  (18, 'service_role tem SELECT, INSERT e DELETE em sofia_gestores', 'true',
      (select (has_table_privilege('service_role', 'public.sofia_gestores', 'SELECT')
            and has_table_privilege('service_role', 'public.sofia_gestores', 'INSERT')
            and has_table_privilege('service_role', 'public.sofia_gestores', 'DELETE'))::text))
) as t(n, verificacao, esperado, encontrado)
order by n;


-- ============================================================
-- ROLLBACK (comentado). Ordem importa: restaurar os 3 corpos ANTES de dropar
-- sofia_pode_gerir — plpgsql não registra dependência, então o drop passaria
-- e os triggers quebrariam no primeiro uso. Antes, anote quem era gestor:
--   select * from public.sofia_gestores;
-- Reverter o app (deploy anterior) ANTES deste rollback: o app novo chama
-- sofia_pode_gerir por RPC e, sem ela, nega tudo até para admin.
-- NÃO reaplicar sdd-sql-v04-seguranca.sql inteiro para "voltar": ele recria
-- as 18 policies sem o (select ...) do perf-rls-initplan.
-- ============================================================
-- begin;
--
-- create or replace function public.sofia_bloquear_autorizacao_nao_admin()
-- returns trigger language plpgsql security definer
-- set search_path = pg_catalog, public
-- as $$
-- begin
--   if not public.sofia_is_admin() then
--     if TG_OP = 'UPDATE' then
--       if TG_TABLE_NAME = 'multas' then
--         if new.autorizacao_status is distinct from old.autorizacao_status
--           or new.valor_descontado is distinct from old.valor_descontado
--           or new.status is distinct from old.status
--         then
--           raise exception 'Apenas administradores podem alterar autorização/desconto de multas';
--         end if;
--       elsif TG_TABLE_NAME = 'sinistros' then
--         if new.autorizacao_status is distinct from old.autorizacao_status
--           or new.valor_descontado is distinct from old.valor_descontado
--           or new.status_desconto is distinct from old.status_desconto
--         then
--           raise exception 'Apenas administradores podem alterar autorização/desconto de sinistros';
--         end if;
--       elsif TG_TABLE_NAME = 'km_excedido_desconto' then
--         if new.autorizacao_status is distinct from old.autorizacao_status then
--           raise exception 'Apenas administradores podem alterar autorização de KM excedido';
--         end if;
--       end if;
--     elsif TG_OP = 'INSERT' then
--       if TG_TABLE_NAME = 'multas' then
--         if new.autorizacao_status is distinct from 'sem_solicitacao'
--           or new.valor_descontado is not null
--           or new.status is distinct from 'pendente'
--         then
--           raise exception 'Apenas administradores podem inserir multas com autorização/desconto já definidos';
--         end if;
--       elsif TG_TABLE_NAME = 'sinistros' then
--         if new.autorizacao_status is distinct from 'sem_solicitacao'
--           or new.valor_descontado is not null
--           or new.status_desconto is distinct from 'pendente'
--         then
--           raise exception 'Apenas administradores podem inserir sinistros com autorização/desconto já definidos';
--         end if;
--       elsif TG_TABLE_NAME = 'km_excedido_desconto' then
--         if new.autorizacao_status is distinct from 'sem_solicitacao' then
--           raise exception 'Apenas administradores podem inserir KM excedido com autorização já definida';
--         end if;
--       end if;
--     elsif TG_OP = 'DELETE' then
--       if TG_TABLE_NAME in ('multas', 'sinistros', 'km_excedido_desconto') then
--         raise exception 'Apenas administradores podem excluir este registro';
--       end if;
--     end if;
--   end if;
--   if TG_OP = 'DELETE' then
--     return old;
--   end if;
--   return new;
-- end;
-- $$;
--
-- create or replace function public.sofia_bloquear_escrita_nao_admin()
-- returns trigger language plpgsql security definer
-- set search_path = pg_catalog, public
-- as $$
-- begin
--   if not public.sofia_is_admin() then
--     if TG_OP = 'UPDATE' then
--       if TG_TABLE_NAME = 'equipes' then
--         if new.ativo is distinct from old.ativo then
--           raise exception 'Apenas administradores podem ativar/desativar equipes';
--         end if;
--       elsif TG_TABLE_NAME = 'veiculos' then
--         if new.valor_locacao_mensal is distinct from old.valor_locacao_mensal then
--           raise exception 'Apenas administradores podem alterar o valor de locação do veículo';
--         end if;
--       end if;
--     elsif TG_OP = 'INSERT' then
--       if TG_TABLE_NAME = 'centro_custo_historico' then
--         raise exception 'Apenas administradores podem atualizar o centro de custo';
--       end if;
--     elsif TG_OP = 'DELETE' then
--       if TG_TABLE_NAME = 'abastecimentos' then
--         raise exception 'Apenas administradores podem excluir abastecimentos';
--       end if;
--       if TG_TABLE_NAME = 'km_diario' then
--         raise exception 'Apenas administradores podem excluir lançamentos de KM';
--       end if;
--     end if;
--   end if;
--   if TG_OP = 'DELETE' then
--     return old;
--   end if;
--   return new;
-- end;
-- $$;
--
-- create or replace function public.excluir_multas_em_massa(p_ids uuid[])
-- returns setof public.multas language plpgsql security definer
-- set search_path = pg_catalog, public
-- as $$
-- declare
--   v_multa record;
-- begin
--   if public.sofia_is_admin() is not true then
--     raise exception 'Apenas administradores podem excluir multas';
--   end if;
--   for v_multa in
--     delete from public.multas where id = any(p_ids) returning *
--   loop
--     insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id)
--     values (
--       'multas', 'excluiu', v_multa.id::text,
--       'Multa excluída em massa — ' || coalesce(v_multa.tipo_infracao, v_multa.descricao, v_multa.id::text),
--       auth.uid()
--     );
--     return next v_multa;
--   end loop;
-- end;
-- $$;
-- revoke execute on function public.excluir_multas_em_massa(uuid[]) from public, anon;
-- grant execute on function public.excluir_multas_em_massa(uuid[]) to authenticated;
--
-- drop function if exists public.sofia_pode_gerir();
-- drop table if exists public.sofia_gestores;
--
-- commit;
