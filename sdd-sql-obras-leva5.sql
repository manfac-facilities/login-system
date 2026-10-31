-- ============================================================
-- OBRAS — Leva 5 (página do cliente, 31/10/2026): acesso do cliente por
-- e-mail + código, sessões do portal, documentos da obra e mensagens.
-- Spec: docs/superpowers/specs/2026-10-31-obras-leva5-pagina-do-cliente-design.md §3.1 e §5.
-- Plano: docs/superpowers/plans/2026-10-31-obras-leva5.md, Task 1.
--
-- TERRITÓRIO DE AUTENTICAÇÃO/RLS (AGENTS.md): toda dúvida falha FECHADA.
--
-- O QUE FAZ
--   1. obras_portal_acesso: quem (e-mail de cliente) vê qual obra no portal.
--      E-mail gravado lower(trim) (trigger normaliza; check confere), nunca
--      @manfac.com.br nem subdomínio (interno usa o hub). unique(obra_id, email).
--      criado_por (e-mail do JWT) e criado_em forçados no INSERT; no UPDATE
--      ficam os antigos; obra_id e email imutáveis. RLS: select/insert/
--      update/delete SÓ administrador (obras_is_admin()); o trigger repete a
--      guarda (com JWT e não admin = erro).
--   2. obras_portal_codigo e obras_portal_sessao: RLS ligada SEM NENHUMA
--      policy (as existentes são apagadas a cada aplicação) e revoke all de
--      anon/authenticated. Só a service role (servidor) lê e grava. Hash do
--      código/token com ao menos 32 caracteres (nunca o código cru).
--   3. obras_documento: pasta fixa (projetos|laudos|art|layout|termos|outros),
--      path no bucket obras-docs = '<obra_id>/<uuid>-<nome saneado>'
--      (nome saneado = [A-Za-z0-9._-], 1..200), validado por trigger com ou
--      sem JWT. criado_por/criado_em forçados no INSERT. Com JWT, INSERT e
--      DELETE só engenheiro da obra ou admin (trigger); sem policy de UPDATE
--      (e revoke update de authenticated); obra_id, path, criado_* imutáveis.
--      RLS: select/insert/delete com obras_has_access().
--   4. Bucket PRIVADO obras-docs (public = false, forçado também se já existir)
--      e policies em storage.objects: upload e delete só engenheiro/admin da
--      obra do prefixo (função obras_docs_pode_escrever(name)), leitura com
--      obras_has_access() (o hub; o portal usa URL assinada curta gerada no
--      servidor com service role). Sem policy de update: objeto não é
--      sobrescrito nem movido.
--   5. obras_mensagem: autor_tipo cliente|manfac, autor_email, texto 1..4000
--      (não só espaços), criado_em forçado = now(). Sem UPDATE e sem DELETE
--      para NINGUÉM (trigger, inclusive service role; só a cascata da obra
--      apagada passa). Com JWT (hub): só autor_tipo 'manfac', autor_email =
--      e-mail do JWT (forçado). Sem JWT (servidor do portal): autor_tipo
--      'cliente' exige acesso ATIVO desse e-mail a essa obra.
--      RLS: select obras_has_access(); insert com autor_tipo 'manfac' e
--      autor_email = JWT.
--   Código do portal NÃO entra em obras_envio (não é comunicação da obra).
--
-- PRÉ-REQUISITO: sdd-sql-obras-leva4.sql aplicado (a seção 0 confere).
-- Ordem: leva2 -> leva3 -> leva4 -> leva5.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-10-31-verificacao-obras-leva5.sql.
--
-- IDEMPOTENTE: create ... if not exists, create or replace, drop ... if exists.
--
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is not true` (sem NULL
-- aberto); uma função de trigger por tabela, sem campo de outra tabela.
--
-- ROLLBACK (só depois de reverter o app):
--   drop policy if exists "obras docs upload" on storage.objects;
--   drop policy if exists "obras docs read" on storage.objects;
--   drop policy if exists "obras docs delete" on storage.objects;
--   drop function public.obras_docs_pode_escrever(text);
--   (bucket obras-docs: esvaziar pela API do Storage antes de apagar)
--   drop table public.obras_mensagem, public.obras_documento,
--              public.obras_portal_sessao, public.obras_portal_codigo,
--              public.obras_portal_acesso;  -- apaga dados (exportar antes)
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (Leva 4 e anteriores)
-- ============================================================
do $$
begin
  if to_regclass('public.obras_obra') is null
     or to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null
     or to_regprocedure('public.obras_engenheiro_ou_admin(uuid)') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra.sql e -2 não estão aplicados. Nada foi alterado.';
  end if;
  if to_regclass('public.obras_registro') is null
     or to_regclass('public.obras_semanal') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva2.sql / leva3.sql não estão aplicados. Nada foi alterado.';
  end if;
  if to_regclass('public.obras_relatorio') is null
     or to_regprocedure('public.obras_relatorio_estado()') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_envio' and column_name = 'relatorio_id')
     or not exists (select 1 from pg_constraint
                     where conrelid = 'public.obras_envio'::regclass and conname = 'obras_envio_relatorio_obrigatorio') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva4.sql não está aplicado. Nada foi alterado.';
  end if;
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception 'Pré-requisito ausente: schema storage (buckets/objects). Nada foi alterado.';
  end if;
  -- Bucket obras-docs, se já existir, tem de ser privado (a seção 4 força
  -- public = false; isto só avisa que alguém o criou público à mão).
  if exists (select 1 from storage.buckets where id = 'obras-docs' and public) then
    raise notice 'Bucket obras-docs existia PÚBLICO; será tornado privado.';
  end if;
end $$;

-- ============================================================
-- 1. obras_portal_acesso (só administrador)
-- ============================================================
create table if not exists public.obras_portal_acesso (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  email text not null,
  nome text,
  ativo boolean not null default true,
  criado_por text,
  criado_em timestamptz not null default now(),
  -- Normalizado pelo trigger; o check confere (inclusive para a service role).
  -- Interno (@manfac.com.br e subdomínios) usa o hub, nunca o portal.
  constraint obras_portal_acesso_email_check check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 254
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    and email not like '%@manfac.com.br'
    and email not like '%.manfac.com.br'),
  constraint obras_portal_acesso_obra_email_key unique (obra_id, email)
);
create index if not exists obras_portal_acesso_email_idx on public.obras_portal_acesso (email) where ativo;

create or replace function public.obras_portal_acesso_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  -- Com JWT: só administrador (a RLS já exige; aqui falha fechada de novo).
  -- Cascata da obra apagada passa (a obra já não existe).
  if v_email is not null and public.obras_is_admin() is not true then
    if tg_op = 'DELETE' and not exists (select 1 from public.obras_obra o where o.id = old.obra_id) then
      return old;
    end if;
    raise exception 'OBRAS_PORTAL_ACESSO: só administrador altera o acesso à página do cliente'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;

  new.email := lower(btrim(new.email));

  if tg_op = 'INSERT' then
    if v_email is not null then
      new.criado_por := v_email;
    end if;
    new.criado_em := now();
    return new;
  end if;

  -- UPDATE: autoria fica; obra e e-mail não mudam (apagar e cadastrar de novo).
  if new.obra_id is distinct from old.obra_id or new.email is distinct from old.email then
    raise exception 'OBRAS_PORTAL_ACESSO: obra_id e email são imutáveis' using errcode = 'P0001';
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  return new;
end;
$$;
revoke execute on function public.obras_portal_acesso_guarda() from public, anon, authenticated;

drop trigger if exists obras_portal_acesso_guarda on public.obras_portal_acesso;
create trigger obras_portal_acesso_guarda
  before insert or update or delete on public.obras_portal_acesso
  for each row execute function public.obras_portal_acesso_guarda();

alter table public.obras_portal_acesso enable row level security;
-- Remove qualquer policy fora das 4 abaixo (falha fechada na reaplicação).
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'obras_portal_acesso'
              and policyname not in ('obras admin select','obras admin insert','obras admin update','obras admin delete')
  loop
    execute format('drop policy %I on public.obras_portal_acesso', p.policyname);
  end loop;
end $$;
drop policy if exists "obras admin select" on public.obras_portal_acesso;
create policy "obras admin select" on public.obras_portal_acesso for select to authenticated
  using ((select public.obras_is_admin()));
drop policy if exists "obras admin insert" on public.obras_portal_acesso;
create policy "obras admin insert" on public.obras_portal_acesso for insert to authenticated
  with check ((select public.obras_is_admin()));
drop policy if exists "obras admin update" on public.obras_portal_acesso;
create policy "obras admin update" on public.obras_portal_acesso for update to authenticated
  using ((select public.obras_is_admin())) with check ((select public.obras_is_admin()));
drop policy if exists "obras admin delete" on public.obras_portal_acesso;
create policy "obras admin delete" on public.obras_portal_acesso for delete to authenticated
  using ((select public.obras_is_admin()));
revoke all on public.obras_portal_acesso from anon;

-- ============================================================
-- 2. obras_portal_codigo e obras_portal_sessao (só service role)
-- ============================================================
create table if not exists public.obras_portal_codigo (
  id uuid primary key default gen_random_uuid(),
  email text not null
    constraint obras_portal_codigo_email_check check (email = lower(btrim(email)) and email <> ''),
  -- HMAC-SHA256 com PORTAL_OBRA_SEGREDO (nunca o código de 6 dígitos cru).
  codigo_hash text not null
    constraint obras_portal_codigo_hash_check check (char_length(codigo_hash) >= 32),
  expira_em timestamptz not null,
  tentativas int not null default 0
    constraint obras_portal_codigo_tentativas_check check (tentativas >= 0),
  usado_em timestamptz,
  criado_em timestamptz not null default now(),
  ip text,
  constraint obras_portal_codigo_expira_check check (expira_em > criado_em)
);
-- Limites por hora (5 por e-mail, 20 por IP) e busca do código vigente.
create index if not exists obras_portal_codigo_email_idx on public.obras_portal_codigo (email, criado_em desc);
create index if not exists obras_portal_codigo_ip_idx on public.obras_portal_codigo (ip, criado_em desc);

create table if not exists public.obras_portal_sessao (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null
    constraint obras_portal_sessao_hash_check check (char_length(token_hash) >= 32),
  email text not null
    constraint obras_portal_sessao_email_check check (email = lower(btrim(email)) and email <> ''),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  ultimo_uso timestamptz,
  revogada_em timestamptz,
  constraint obras_portal_sessao_token_hash_key unique (token_hash),
  constraint obras_portal_sessao_expira_check check (expira_em > criado_em)
);
create index if not exists obras_portal_sessao_email_idx on public.obras_portal_sessao (email);

alter table public.obras_portal_codigo enable row level security;
alter table public.obras_portal_sessao enable row level security;
-- NENHUMA policy: apaga qualquer uma que exista (inclusive criada à mão).
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
            where schemaname = 'public' and tablename in ('obras_portal_codigo','obras_portal_sessao')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;
revoke all on public.obras_portal_codigo from public, anon, authenticated;
revoke all on public.obras_portal_sessao from public, anon, authenticated;
grant select, insert, update, delete on public.obras_portal_codigo to service_role;
grant select, insert, update, delete on public.obras_portal_sessao to service_role;

-- ============================================================
-- 3. obras_documento (path validado; engenheiro/admin escreve)
-- ============================================================
create table if not exists public.obras_documento (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  pasta text not null
    constraint obras_documento_pasta_check
    check (pasta in ('projetos','laudos','art','layout','termos','outros')),
  nome text not null
    constraint obras_documento_nome_check check (char_length(btrim(nome)) between 1 and 255),
  -- '<obra_id>/<uuid>-<nome saneado>' no bucket obras-docs (trigger confere).
  path text not null,
  tamanho bigint
    constraint obras_documento_tamanho_check check (tamanho is null or tamanho >= 0),
  tipo text,
  criado_por text,
  criado_em timestamptz not null default now(),
  constraint obras_documento_path_key unique (path)
);
create index if not exists obras_documento_obra_idx on public.obras_documento (obra_id, pasta, criado_em desc);

create or replace function public.obras_documento_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'DELETE' then
    -- Com JWT só engenheiro/admin (cascata da obra apagada passa).
    if v_email is not null
       and exists (select 1 from public.obras_obra o where o.id = old.obra_id)
       and public.obras_engenheiro_ou_admin(old.obra_id) is not true then
      raise exception 'OBRAS_DOCUMENTO: só o engenheiro da obra ou administrador altera os documentos'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if v_email is not null
     and (public.obras_engenheiro_ou_admin(new.obra_id) is not true
          or (tg_op = 'UPDATE' and public.obras_engenheiro_ou_admin(old.obra_id) is not true)) then
    raise exception 'OBRAS_DOCUMENTO: só o engenheiro da obra ou administrador altera os documentos'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.obra_id is distinct from old.obra_id or new.path is distinct from old.path
       or new.criado_por is distinct from old.criado_por or new.criado_em is distinct from old.criado_em then
      raise exception 'OBRAS_DOCUMENTO: obra_id, path, criado_por e criado_em são imutáveis'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- INSERT. Estrutural (vale sem JWT): o caminho é o da própria obra.
  if new.obra_id is null
     or new.path is null
     or new.path !~ ('^' || new.obra_id::text
                     || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]{1,200}$') then
    raise exception 'OBRAS_DOCUMENTO_CAMINHO: documento fora do caminho {obra_id}/{uuid}-{nome saneado}'
      using errcode = '23514';
  end if;
  if v_email is not null then
    new.criado_por := v_email;
  end if;
  new.criado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_documento_guarda() from public, anon, authenticated;

drop trigger if exists obras_documento_guarda on public.obras_documento;
create trigger obras_documento_guarda
  before insert or update or delete on public.obras_documento
  for each row execute function public.obras_documento_guarda();

alter table public.obras_documento enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'obras_documento'
              and policyname not in ('obras select','obras insert','obras delete')
  loop
    execute format('drop policy %I on public.obras_documento', p.policyname);
  end loop;
end $$;
drop policy if exists "obras select" on public.obras_documento;
create policy "obras select" on public.obras_documento for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_documento;
create policy "obras insert" on public.obras_documento for insert to authenticated
  with check ((select public.obras_has_access()));
drop policy if exists "obras delete" on public.obras_documento;
create policy "obras delete" on public.obras_documento for delete to authenticated
  using ((select public.obras_has_access()));
revoke all on public.obras_documento from anon;
revoke update on public.obras_documento from authenticated;

-- ============================================================
-- 4. Bucket privado obras-docs + policies de storage
-- ============================================================
insert into storage.buckets (id, name, public)
values ('obras-docs', 'obras-docs', false)
on conflict (id) do update set public = false;

-- true/false (nunca NULL): nome '<obra_id existente>/<uuid>-<nome saneado>'
-- e sessão = engenheiro dessa obra ou administrador. security definer para
-- chamar obras_engenheiro_ou_admin (fechada para authenticated) e ler a obra
-- por cima da RLS. O CASE garante que o ::uuid só roda com o formato certo.
create or replace function public.obras_docs_pode_escrever(p_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare v_obra uuid;
begin
  if p_name is null
     or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]{1,200}$' then
    return false;
  end if;
  v_obra := split_part(p_name, '/', 1)::uuid;
  if not exists (select 1 from public.obras_obra o where o.id = v_obra) then
    return false;
  end if;
  return coalesce(public.obras_engenheiro_ou_admin(v_obra), false);
end;
$$;
revoke execute on function public.obras_docs_pode_escrever(text) from public, anon;
grant execute on function public.obras_docs_pode_escrever(text) to authenticated;

drop policy if exists "obras docs upload" on storage.objects;
create policy "obras docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'obras-docs' and (select public.obras_has_access())
              and public.obras_docs_pode_escrever(name) is true);

-- Leitura no hub (lista/URL assinada pela sessão; o delete da API também
-- precisa enxergar o objeto). Portal: URL assinada curta pela service role.
drop policy if exists "obras docs read" on storage.objects;
create policy "obras docs read" on storage.objects for select to authenticated
  using (bucket_id = 'obras-docs' and (select public.obras_has_access()));

drop policy if exists "obras docs delete" on storage.objects;
create policy "obras docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'obras-docs' and (select public.obras_has_access())
         and public.obras_docs_pode_escrever(name) is true);
-- Sem "obras docs update": documento não é sobrescrito nem movido.
drop policy if exists "obras docs update" on storage.objects;

-- ============================================================
-- 5. obras_mensagem (registro: sem update/delete)
-- ============================================================
create table if not exists public.obras_mensagem (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  autor_tipo text not null
    constraint obras_mensagem_autor_tipo_check check (autor_tipo in ('cliente','manfac')),
  autor_email text not null
    constraint obras_mensagem_autor_email_check check (autor_email = lower(btrim(autor_email)) and autor_email <> ''),
  texto text not null
    constraint obras_mensagem_texto_check check (char_length(texto) between 1 and 4000 and btrim(texto) <> ''),
  criado_em timestamptz not null default now()
);
create index if not exists obras_mensagem_obra_idx on public.obras_mensagem (obra_id, criado_em);

create or replace function public.obras_mensagem_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'UPDATE' then
    raise exception 'OBRAS_MENSAGEM: mensagem é registro, não pode ser alterada' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    -- Só a cascata da obra apagada passa (vale para qualquer role).
    if exists (select 1 from public.obras_obra o where o.id = old.obra_id) then
      raise exception 'OBRAS_MENSAGEM: mensagem é registro, não pode ser apagada' using errcode = '42501';
    end if;
    return old;
  end if;

  -- INSERT
  new.criado_em := now();
  if v_email is not null then
    -- Hub: só a Manfac escreve, e o autor é quem está logado.
    if new.autor_tipo is distinct from 'manfac' then
      raise exception 'OBRAS_MENSAGEM: pelo hub só se grava mensagem da Manfac' using errcode = '42501';
    end if;
    new.autor_email := v_email;
    return new;
  end if;

  -- Sem JWT (servidor do portal / service role): mensagem do cliente só de
  -- e-mail com acesso ATIVO a esta obra.
  new.autor_email := lower(btrim(new.autor_email));
  if new.autor_tipo = 'cliente'
     and not exists (select 1 from public.obras_portal_acesso a
                      where a.obra_id = new.obra_id and a.email = new.autor_email and a.ativo) then
    raise exception 'OBRAS_MENSAGEM: e-mail sem acesso ativo a esta obra' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_mensagem_guarda() from public, anon, authenticated;

drop trigger if exists obras_mensagem_guarda on public.obras_mensagem;
create trigger obras_mensagem_guarda
  before insert or update or delete on public.obras_mensagem
  for each row execute function public.obras_mensagem_guarda();

alter table public.obras_mensagem enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'obras_mensagem'
              and policyname not in ('obras select','obras insert')
  loop
    execute format('drop policy %I on public.obras_mensagem', p.policyname);
  end loop;
end $$;
drop policy if exists "obras select" on public.obras_mensagem;
create policy "obras select" on public.obras_mensagem for select to authenticated
  using ((select public.obras_has_access()));
-- O BEFORE trigger já forçou autor_email = JWT; a policy confere de novo.
drop policy if exists "obras insert" on public.obras_mensagem;
create policy "obras insert" on public.obras_mensagem for insert to authenticated
  with check ((select public.obras_has_access())
              and autor_tipo = 'manfac'
              and autor_email = (select nullif(lower(trim(auth.jwt() ->> 'email')), '')));
revoke all on public.obras_mensagem from anon;
revoke update, delete, truncate on public.obras_mensagem from authenticated;

commit;

-- ============================================================
-- VERIFICAÇÃO (PASSO 2) — rodar depois do commit. Qualquer *** FALHOU *** = parar.
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado is not distinct from esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'RLS ligada nas 5 tabelas novas', '5',
      (select count(*)::text from pg_class
        where oid in (to_regclass('public.obras_portal_acesso'), to_regclass('public.obras_portal_codigo'),
                      to_regclass('public.obras_portal_sessao'), to_regclass('public.obras_documento'),
                      to_regclass('public.obras_mensagem'))
          and relrowsecurity)),
  (2, 'obras_portal_codigo e obras_portal_sessao: NENHUMA policy', '0',
      (select count(*)::text from pg_policies where schemaname = 'public'
         and tablename in ('obras_portal_codigo','obras_portal_sessao'))),
  (3, 'codigo/sessao: nenhum privilégio para anon nem authenticated', 'false',
      (select (has_table_privilege('authenticated', 'public.obras_portal_codigo', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('anon', 'public.obras_portal_codigo', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('authenticated', 'public.obras_portal_sessao', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            or has_table_privilege('anon', 'public.obras_portal_sessao', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::text)),
  (4, 'codigo/sessao: service_role lê e grava', 'true',
      (select (has_table_privilege('service_role', 'public.obras_portal_codigo', 'SELECT')
           and has_table_privilege('service_role', 'public.obras_portal_codigo', 'INSERT')
           and has_table_privilege('service_role', 'public.obras_portal_codigo', 'UPDATE')
           and has_table_privilege('service_role', 'public.obras_portal_sessao', 'SELECT')
           and has_table_privilege('service_role', 'public.obras_portal_sessao', 'INSERT')
           and has_table_privilege('service_role', 'public.obras_portal_sessao', 'UPDATE'))::text)),
  (5, 'colunas de obras_portal_codigo e obras_portal_sessao', '8|7',
      (select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'obras_portal_codigo'
                 and column_name in ('id','email','codigo_hash','expira_em','tentativas','usado_em','criado_em','ip'))::text
              || '|' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'obras_portal_sessao'
                 and column_name in ('id','token_hash','email','criado_em','expira_em','ultimo_uso','revogada_em'))::text)),
  (6, 'token_hash único', '1',
      (select count(*)::text from pg_constraint where conrelid = 'public.obras_portal_sessao'::regclass
         and contype = 'u' and conname = 'obras_portal_sessao_token_hash_key')),
  (7, 'obras_portal_acesso: exatamente 4 policies, todas com obras_is_admin e sem obras_has_access', '4|4|0',
      (select count(*)::text || '|'
              || count(*) filter (where coalesce(qual, '') || coalesce(with_check, '') like '%obras_is_admin%')::text || '|'
              || count(*) filter (where coalesce(qual, '') || coalesce(with_check, '') like '%obras_has_access%')::text
         from pg_policies where schemaname = 'public' and tablename = 'obras_portal_acesso')),
  (8, 'obras_portal_acesso: check do e-mail recusa manfac.com.br e exige lower/trim', 'true',
      (select (pg_get_constraintdef(oid) like '%@manfac.com.br%' and pg_get_constraintdef(oid) like '%.manfac.com.br%'
               and pg_get_constraintdef(oid) like '%lower(btrim(email))%')::text
         from pg_constraint where conrelid = 'public.obras_portal_acesso'::regclass and conname = 'obras_portal_acesso_email_check')),
  (9, 'obras_portal_acesso: único (obra_id, email)', '1',
      (select count(*)::text from pg_constraint where conrelid = 'public.obras_portal_acesso'::regclass
         and contype = 'u' and conname = 'obras_portal_acesso_obra_email_key')),
  (10, 'triggers de guarda ligados (insert/update/delete) nas 3 tabelas', '3',
      (select count(*)::text from pg_trigger
        where not tgisinternal and tgenabled = 'O'
          and (tgtype & 4) = 4 and (tgtype & 8) = 8 and (tgtype & 16) = 16
          and ((tgname = 'obras_portal_acesso_guarda' and tgrelid = 'public.obras_portal_acesso'::regclass)
            or (tgname = 'obras_documento_guarda' and tgrelid = 'public.obras_documento'::regclass)
            or (tgname = 'obras_mensagem_guarda' and tgrelid = 'public.obras_mensagem'::regclass)))),
  (11, 'funções de trigger: definer, fechadas para authenticated e anon', '3|false',
      (select count(*) filter (where p.prosecdef)::text || '|'
              || bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')
                         or has_function_privilege('anon', p.oid, 'EXECUTE'))::text
         from pg_proc p
        where p.oid in (to_regprocedure('public.obras_portal_acesso_guarda()'),
                        to_regprocedure('public.obras_documento_guarda()'),
                        to_regprocedure('public.obras_mensagem_guarda()')))),
  (12, 'obras_documento: policies = delete, insert, select (sem update)', 'obras delete,obras insert,obras select',
      (select string_agg(policyname, ',' order by policyname) from pg_policies
        where schemaname = 'public' and tablename = 'obras_documento')),
  (13, 'obras_documento: 6 pastas fixas', 'true',
      (select (pg_get_constraintdef(oid) like '%''projetos''%' and pg_get_constraintdef(oid) like '%''laudos''%'
               and pg_get_constraintdef(oid) like '%''art''%' and pg_get_constraintdef(oid) like '%''layout''%'
               and pg_get_constraintdef(oid) like '%''termos''%' and pg_get_constraintdef(oid) like '%''outros''%')::text
         from pg_constraint where conrelid = 'public.obras_documento'::regclass and conname = 'obras_documento_pasta_check')),
  (14, 'obras_documento_guarda valida o caminho e usa engenheiro/admin', 'true',
      (select (prosrc like '%OBRAS_DOCUMENTO_CAMINHO%' and prosrc like '%obras_engenheiro_ou_admin(new.obra_id)%'
               and prosrc like '%new.criado_por := v_email%')::text
         from pg_proc where oid = 'public.obras_documento_guarda()'::regprocedure)),
  (15, 'obras_mensagem: policies = insert, select (sem update/delete)', 'obras insert,obras select',
      (select string_agg(policyname, ',' order by policyname) from pg_policies
        where schemaname = 'public' and tablename = 'obras_mensagem')),
  (16, 'obras_mensagem insert: autor_tipo manfac e autor_email = JWT', 'true',
      (select (with_check like '%manfac%' and with_check like '%autor_email%' and with_check like '%jwt%'
               and with_check like '%obras_has_access%')::text
         from pg_policies where schemaname = 'public' and tablename = 'obras_mensagem' and policyname = 'obras insert')),
  (17, 'obras_mensagem: texto 1..4000', 'true',
      (select (pg_get_constraintdef(oid) like '%4000%')::text
         from pg_constraint where conrelid = 'public.obras_mensagem'::regclass and conname = 'obras_mensagem_texto_check')),
  (18, 'obras_mensagem_guarda bloqueia UPDATE e DELETE', 'true',
      (select (prosrc like '%não pode ser alterada%' and prosrc like '%não pode ser apagada%'
               and prosrc like '%new.autor_email := v_email%' and prosrc like '%new.criado_em := now()%')::text
         from pg_proc where oid = 'public.obras_mensagem_guarda()'::regprocedure)),
  (19, 'authenticated sem update/delete em obras_mensagem e sem update em obras_documento', 'false',
      (select (has_table_privilege('authenticated', 'public.obras_mensagem', 'UPDATE,DELETE')
            or has_table_privilege('authenticated', 'public.obras_documento', 'UPDATE'))::text)),
  (20, 'anon sem privilégio nas 5 tabelas', 'false',
      (select (has_table_privilege('anon', 'public.obras_portal_acesso', 'SELECT,INSERT,UPDATE,DELETE')
            or has_table_privilege('anon', 'public.obras_documento', 'SELECT,INSERT,UPDATE,DELETE')
            or has_table_privilege('anon', 'public.obras_mensagem', 'SELECT,INSERT,UPDATE,DELETE')
            or has_table_privilege('anon', 'public.obras_portal_codigo', 'SELECT,INSERT,UPDATE,DELETE')
            or has_table_privilege('anon', 'public.obras_portal_sessao', 'SELECT,INSERT,UPDATE,DELETE'))::text)),
  (21, 'bucket obras-docs existe e é privado', 'false',
      (select public::text from storage.buckets where id = 'obras-docs')),
  (22, 'storage: policies obras docs = delete, read, upload (sem update)', 'obras docs delete,obras docs read,obras docs upload',
      (select string_agg(policyname, ',' order by policyname) from pg_policies
        where schemaname = 'storage' and tablename = 'objects' and policyname like 'obras docs%')),
  (23, 'storage: upload e delete exigem obras_docs_pode_escrever', '2',
      (select count(*)::text from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname in ('obras docs upload','obras docs delete')
          and coalesce(qual, with_check) like '%obras_docs_pode_escrever%'
          and coalesce(qual, with_check) like '%obras-docs%')),
  (24, 'obras_docs_pode_escrever: definer, authenticated executa, anon não', 'true|true|false',
      (select p.prosecdef::text || '|' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
              || '|' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
         from pg_proc p where p.oid = to_regprocedure('public.obras_docs_pode_escrever(text)'))),
  (25, 'obras_engenheiro_ou_admin continua fechada para authenticated', 'false',
      (select has_function_privilege('authenticated', 'public.obras_engenheiro_ou_admin(uuid)', 'EXECUTE')::text)),
  (26, 'obras fotos (storage) intactas: 4 policies', '4',
      (select count(*)::text from pg_policies where schemaname = 'storage' and tablename = 'objects'
         and policyname in ('obras fotos upload','obras fotos read','obras fotos update','obras fotos delete'))),
  (27, 'Leva 4 intacta: obras_relatorio_estado e relatorio_obrigatorio', 'true',
      (select ((select prosrc like '%validar exige o conteudo%' from pg_proc
                 where oid = 'public.obras_relatorio_estado()'::regprocedure)
               and exists (select 1 from pg_constraint where conrelid = 'public.obras_envio'::regclass
                            and conname = 'obras_envio_relatorio_obrigatorio'))::text)),
  (28, 'colunas de obras_documento, obras_mensagem e obras_portal_acesso', '9|6|7',
      (select (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'obras_documento'
                 and column_name in ('id','obra_id','pasta','nome','path','tamanho','tipo','criado_por','criado_em'))::text
              || '|' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'obras_mensagem'
                 and column_name in ('id','obra_id','autor_tipo','autor_email','texto','criado_em'))::text
              || '|' || (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'obras_portal_acesso'
                 and column_name in ('id','obra_id','email','nome','ativo','criado_por','criado_em'))::text)),
  (29, 'obras_envio_tipo_check sem tipo do portal', 'false',
      (select (pg_get_constraintdef(oid) like '%portal%')::text
         from pg_constraint where conrelid = 'public.obras_envio'::regclass and conname = 'obras_envio_tipo_check'))
) as t(n, verificacao, esperado, encontrado)
order by n;
