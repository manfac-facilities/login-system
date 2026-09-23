-- ============================================================
-- Hub — comunicado de atualizações (aviso no hub; o e-mail vem depois)
-- 2026-09-22
-- Decisões: docs/cliente/2026-09-22-audio-joao-comunicado-de-atualizacoes.md
-- ============================================================
-- O QUE ESTA MIGRATION FAZ
--   (1) cria public.hub_tem_acesso_sistema(p_slug text) — a MESMA regra de
--       lib/auth/systemAccess.ts (hasSystemAccess): administrador em
--       hub_user_roles entra sempre; os demais dependem de uma linha em
--       hub_system_access com has_access = true. É a versão por parâmetro de
--       obras_has_access()/sofia_has_access(), que fixam o slug no corpo —
--       aqui o slug vem da linha do comunicado, então não dá para reutilizar
--       aquelas duas;
--   (2) cria public.hub_comunicados — um comunicado por sistema (slug);
--   (3) cria public.hub_comunicados_lidos — quem já leu o quê.
--
-- QUEM ESCREVE: só a service role / PAT (ignora RLS). Não existe NENHUMA
-- policy de INSERT/UPDATE/DELETE em hub_comunicados, e os GRANTs de escrita
-- de anon e authenticated são revogados — a policy ausente e o privilégio
-- ausente são duas barreiras independentes. Mesmo motivo de
-- hub_system_access: até 10/08/2026 uma policy de escrita aberta deixava
-- qualquer usuário logado se conceder acesso pelo navegador.
--
-- QUEM LÊ: usuário autenticado com acesso ao slug do comunicado, e só
-- comunicado com publicado_em preenchido e já no passado. publicado_em NULL
-- é rascunho (o João aprova antes de publicar).
--
-- DE QUE ELA DEPENDE
--   hub_system_access (sdd-sql-conversor-os.sql) e hub_user_roles
--   (sdd-sql-admin-usuarios.sql), ambos aplicados. A seção 0 confere as
--   colunas usadas e ABORTA se faltar alguma.
--
-- AS DUAS ARMADILHAS DE PL/pgSQL (.claude/rules/sql.md):
--   1. Guarda que falha ABERTO com NULL: hub_tem_acesso_sistema é só
--      `exists(...) or exists(...)`, que devolve sempre true/false — com JWT
--      sem e-mail, com p_slug NULL, com usuário sem linha. Nenhum `in (lista)`,
--      nenhum `if not f()`. Mesmo assim o resultado é embrulhado em coalesce
--      nas policies, para que um refactor futuro da função não abra nada.
--   2. Trigger compartilhada: não se aplica, não há trigger.
--
-- ESTADO: NÃO APLICADO. Rodar à mão (SQL Editor ou Management API com o PAT),
-- projeto de produção iyytcavcgukfjnjjrerx — confirme o ref antes.
-- Depois de aplicar, rodar sdd-sql-hub-comunicados-teste-rls.sql (teste de
-- comportamento com JWT forjado, sempre com rollback).
--
-- IDEMPOTENTE: create table if not exists, create or replace function,
-- drop policy if exists antes de recriar, revoke/grant repetíveis.
-- LIMITE: `create table if not exists` não altera tabela já existente com
-- colunas diferentes — coluna nova vira `alter table ... add column if not
-- exists` aqui embaixo, nunca edição do create table.
--
-- COMO REVERTER (antes de o código que lê isso subir):
--   begin;
--   drop table if exists public.hub_comunicados_lidos;
--   drop table if exists public.hub_comunicados;
--   drop function if exists public.hub_tem_acesso_sistema(text);
--   commit;
--   Depois de comunicados reais publicados, o drop APAGA o histórico de
--   leitura — aí reverter é o deploy do código anterior, não este SQL.
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS — aborta se as tabelas de acesso não estiverem como o
-- código espera. PL/pgSQL e SQL com corpo só resolvem tabela na execução;
-- sem esta checagem a migration "passaria" e a policy quebraria no uso.
-- ============================================================
do $$
begin
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
                   and column_name = 'nivel')
  then
    raise exception 'hub_user_roles.nivel não existe — sdd-sql-admin-usuarios.sql PARTE 1 não aplicada';
  end if;
end;
$$;


-- ============================================================
-- 1. FUNÇÃO DE ACESSO POR SLUG
-- security definer: lê hub_user_roles e hub_system_access sem depender da
-- policy de leitura delas (hoje `using (true)`; se um dia ela apertar para
-- "só a própria linha", esta função continua certa).
-- ============================================================
create or replace function public.hub_tem_acesso_sistema(p_slug text)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select
    exists (
      select 1 from public.hub_user_roles
      where user_email = lower(trim(auth.jwt() ->> 'email'))
        and nivel = 'administrador'
    )
    or exists (
      select 1 from public.hub_system_access
      where user_email = lower(trim(auth.jwt() ->> 'email'))
        and system_slug = p_slug
        and has_access = true
    );
$$;

revoke all on function public.hub_tem_acesso_sistema(text) from public, anon;
grant execute on function public.hub_tem_acesso_sistema(text) to authenticated;


-- ============================================================
-- 2. hub_comunicados
-- `sistema` guarda o MESMO valor de hub_system_access.system_slug (text,
-- string livre — não há tabela de slugs para FK).
-- ============================================================
create table if not exists public.hub_comunicados (
  id            uuid primary key default gen_random_uuid(),
  sistema       text not null check (length(trim(sistema)) > 0),
  titulo        text not null check (length(trim(titulo)) > 0),
  corpo         text not null check (length(trim(corpo)) > 0),
  publicado_em  timestamptz,           -- NULL = rascunho, não aparece
  criado_em     timestamptz not null default now()
);

alter table public.hub_comunicados enable row level security;

-- Remove qualquer policy anterior da tabela (inclusive de nome diferente),
-- para que uma policy de escrita esquecida não sobreviva a uma reaplicação.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'hub_comunicados'
  loop
    execute format('drop policy %I on public.hub_comunicados', p.policyname);
  end loop;
end;
$$;

create policy "comunicados leitura" on public.hub_comunicados
  for select to authenticated
  using (
    publicado_em is not null
    and publicado_em <= now()
    and coalesce(public.hub_tem_acesso_sistema(sistema), false)
  );

-- Privilégios: o Supabase concede ALL a anon e authenticated em tabela nova
-- do schema public. Tira tudo e devolve só o SELECT de authenticated.
revoke all on table public.hub_comunicados from public, anon, authenticated;
grant select on table public.hub_comunicados to authenticated;
grant all on table public.hub_comunicados to service_role;


-- ============================================================
-- 3. hub_comunicados_lidos
-- ============================================================
create table if not exists public.hub_comunicados_lidos (
  comunicado_id uuid not null references public.hub_comunicados(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  lido_em       timestamptz not null default now(),
  primary key (comunicado_id, user_id)
);

-- A PK cobre busca por comunicado; a tela busca "o que EU já li".
create index if not exists hub_comunicados_lidos_user_idx
  on public.hub_comunicados_lidos (user_id);

alter table public.hub_comunicados_lidos enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'hub_comunicados_lidos'
  loop
    execute format('drop policy %I on public.hub_comunicados_lidos', p.policyname);
  end loop;
end;
$$;

-- auth.uid() NULL (sem JWT) -> `user_id = NULL` é NULL -> policy nega.
create policy "lidos leitura propria" on public.hub_comunicados_lidos
  for select to authenticated
  using (user_id = auth.uid());

-- O subselect em hub_comunicados já roda sob a RLS de quem insere (só enxerga
-- o que pode ler), mas as condições são repetidas explicitamente: se um dia
-- alguém alargar a policy de leitura de hub_comunicados, esta continua
-- exigindo publicado + acesso ao slug.
create policy "lidos insercao propria" on public.hub_comunicados_lidos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.hub_comunicados c
      where c.id = comunicado_id
        and c.publicado_em is not null
        and c.publicado_em <= now()
        and coalesce(public.hub_tem_acesso_sistema(c.sistema), false)
    )
  );

revoke all on table public.hub_comunicados_lidos from public, anon, authenticated;
grant select, insert on table public.hub_comunicados_lidos to authenticated;
grant all on table public.hub_comunicados_lidos to service_role;

commit;


-- ============================================================
-- 4. VERIFICAÇÃO — rodar DEPOIS do commit. Uma linha por invariante.
-- Qualquer *** FALHOU *** = parar e não deployar.
-- (O SQL Editor mostra só o resultado da última instrução; por isso é uma
-- consulta só.)
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'RLS ligada em hub_comunicados', 'true',
      (select relrowsecurity::text from pg_class where oid = to_regclass('public.hub_comunicados'))),
  (2, 'RLS ligada em hub_comunicados_lidos', 'true',
      (select relrowsecurity::text from pg_class where oid = to_regclass('public.hub_comunicados_lidos'))),
  (3, 'hub_comunicados: policies (cmd:roles)', 'SELECT:{authenticated}',
      (select coalesce(string_agg(cmd || ':' || roles::text, ', ' order by cmd), '(nenhuma)')
       from pg_policies where schemaname = 'public' and tablename = 'hub_comunicados')),
  (4, 'hub_comunicados_lidos: policies (cmd:roles)', 'INSERT:{authenticated}, SELECT:{authenticated}',
      (select coalesce(string_agg(cmd || ':' || roles::text, ', ' order by cmd), '(nenhuma)')
       from pg_policies where schemaname = 'public' and tablename = 'hub_comunicados_lidos')),
  (5, 'nenhuma policy UPDATE/DELETE/ALL nas duas tabelas', '0',
      (select count(*)::text from pg_policies
       where schemaname = 'public'
         and tablename in ('hub_comunicados', 'hub_comunicados_lidos')
         and cmd in ('UPDATE', 'DELETE', 'ALL'))),
  (6, 'anon: nenhum privilégio nas duas tabelas', 'false',
      (select (has_table_privilege('anon', 'public.hub_comunicados', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('anon', 'public.hub_comunicados_lidos', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::text)),
  (7, 'authenticated em hub_comunicados: só SELECT', 'true',
      (select (has_table_privilege('authenticated', 'public.hub_comunicados', 'SELECT')
            and not has_table_privilege('authenticated', 'public.hub_comunicados', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::text)),
  (8, 'authenticated em hub_comunicados_lidos: só SELECT e INSERT', 'true',
      (select (has_table_privilege('authenticated', 'public.hub_comunicados_lidos', 'SELECT')
            and has_table_privilege('authenticated', 'public.hub_comunicados_lidos', 'INSERT')
            and not has_table_privilege('authenticated', 'public.hub_comunicados_lidos', 'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::text)),
  (9, 'hub_tem_acesso_sistema é security definer', 'true',
      (select prosecdef::text from pg_proc
       where oid = to_regprocedure('public.hub_tem_acesso_sistema(text)'))),
  (10, 'hub_tem_acesso_sistema: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.hub_tem_acesso_sistema(text)', 'EXECUTE')
            and not has_function_privilege('anon', 'public.hub_tem_acesso_sistema(text)', 'EXECUTE'))::text)),
  (11, 'hub_tem_acesso_sistema sem JWT devolve false (não NULL)', 'false',
      (select public.hub_tem_acesso_sistema('obras')::text)),
  (12, 'FK lidos -> comunicados com ON DELETE CASCADE', 'c',
      (select confdeltype::text from pg_constraint
       where conrelid = to_regclass('public.hub_comunicados_lidos')
         and confrelid = to_regclass('public.hub_comunicados') and contype = 'f'))
) as t(n, verificacao, esperado, encontrado)
order by n;


-- ------------------------------------------------------------
-- Detalhe, se alguma linha acima der FALHOU: lista completa das policies.
-- ------------------------------------------------------------
-- select tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('hub_comunicados', 'hub_comunicados_lidos')
-- order by tablename, policyname;
