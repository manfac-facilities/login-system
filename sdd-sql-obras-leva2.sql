-- ============================================================
-- OBRAS — Leva 2 (uso do dia a dia, 31/10/2026): registros de relacionamento
-- (reunião/ligação/visita/imediata), envio de ata e imediata, critério de
-- peso do avanço e feriados por obra.
-- Spec: docs/superpowers/specs/2026-10-31-obras-leva2-uso-dia-a-dia-design.md §6/§6.1.
--
-- O QUE FAZ
--   1. obras_registro (tabela nova) + RLS "obras *" (obras_has_access()) +
--      trigger: autoria (criado_por = e-mail do JWT, não falsificável),
--      editado_em, e UPDATE/DELETE só pelo autor até 24 h após criado_em ou
--      por administrador (sem JWT passa).
--   2. obras_envio: tipo aceita 'diario' (o que o app grava hoje), 'ata' e
--      'imediata' (check obras_envio_tipo_check; qualquer check antigo sobre
--      tipo é substituído) + coluna registro_id uuid null -> obras_registro
--      (on delete set null).
--   3. obras_obra.peso_avanco text check in ('valor','duracao'), nulo =
--      automático. obras_obra_parametros_guarda recriada a partir de
--      sdd-sql-obras-modalidade-obra.sql seção 3d (a -2 não a alterou), só
--      acrescentando peso_avanco; o trigger passa a disparar também no SET dessa coluna.
--   4. obras_feriado.obra_id (nulo = global). A PK (data) cai e entra o índice
--      único (coalesce(obra_id, '0000...'), data). RLS de escrita segue só admin.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-10-31-verificacao-obras-leva2.sql.
--
-- IDEMPOTENTE: create ... if not exists, create or replace, drop ... if exists.
--
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is not true` (sem NULL
-- aberto); uma função de trigger por tabela, sem campo de outra tabela.
--
-- ROLLBACK (só depois de reverter o app):
--   drop table public.obras_registro;  -- apaga os registros (exportar antes)
--   alter table public.obras_envio drop constraint obras_envio_tipo_check, drop column registro_id;
--   alter table public.obras_obra drop column peso_avanco;  (e recriar a guarda sem a coluna)
--   alter table public.obras_feriado drop column obra_id;   (só sem feriado de obra) e recriar a PK (data)
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos
-- ============================================================
do $$
begin
  if to_regclass('public.obras_obra') is null
     or to_regclass('public.obras_feriado') is null
     or to_regclass('public.obras_envio') is null
     or to_regclass('public.obras_impedimento') is null
     or to_regprocedure('public.obras_obra_parametros_guarda()') is null
     or to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra.sql e -2 não estão aplicados. Nada foi alterado.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'obras_atividade' and column_name = 'ordem') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva1b.sql não está aplicado. Nada foi alterado.';
  end if;
  if exists (select 1 from public.obras_envio
              where tipo is not null and tipo not in ('diario','ata','imediata')) then
    raise exception 'obras_envio tem tipo fora de diario/ata/imediata; ajustar a lista do check antes. Nada foi alterado.';
  end if;
end $$;

-- ============================================================
-- 1. obras_registro
-- ============================================================
create table if not exists public.obras_registro (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  tipo text not null check (tipo in ('reuniao','ligacao','visita','outro','imediata')),
  data date not null default current_date,
  participantes text,
  texto text,
  ata jsonb,
  nivel text check (nivel in ('atencao','urgente')),
  impedimento_id uuid references public.obras_impedimento(id) on delete set null,
  atividade_numero int,
  criado_por text,
  criado_em timestamptz not null default now(),
  editado_em timestamptz
);
create index if not exists obras_registro_obra_idx on public.obras_registro (obra_id, data desc, criado_em desc);

-- Autoria e janela de edição. Com JWT: criado_por/criado_em/obra_id não mudam
-- e UPDATE/DELETE exigem (autor e < 24 h) ou administrador. Sem JWT passa.
create or replace function public.obras_registro_guarda() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'INSERT' then
    if v_email is not null then new.criado_por := v_email; end if;
    return new;
  end if;

  if v_email is not null
     and public.obras_is_admin() is not true
     and not (old.criado_por is not distinct from v_email
              and now() - old.criado_em < interval '24 hours') then
    raise exception 'OBRAS_REGISTRO: só o autor, até 24 h depois de criado, ou administrador altera/apaga o registro'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;

  if v_email is not null then
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    new.obra_id := old.obra_id;
  end if;
  new.editado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_registro_guarda() from public, anon, authenticated;

drop trigger if exists obras_registro_guarda on public.obras_registro;
create trigger obras_registro_guarda
  before insert or update or delete on public.obras_registro
  for each row execute function public.obras_registro_guarda();

alter table public.obras_registro enable row level security;
drop policy if exists "obras select" on public.obras_registro;
create policy "obras select" on public.obras_registro for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_registro;
create policy "obras insert" on public.obras_registro for insert to authenticated
  with check ((select public.obras_has_access()));
drop policy if exists "obras update" on public.obras_registro;
create policy "obras update" on public.obras_registro for update to authenticated
  using ((select public.obras_has_access())) with check ((select public.obras_has_access()));
drop policy if exists "obras delete" on public.obras_registro;
create policy "obras delete" on public.obras_registro for delete to authenticated
  using ((select public.obras_has_access()));

-- ============================================================
-- 2. obras_envio: tipos ata/imediata e registro_id
-- ============================================================
alter table public.obras_envio
  add column if not exists registro_id uuid references public.obras_registro(id) on delete set null;

do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.obras_envio'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ~ '\mtipo\M'
  loop
    execute format('alter table public.obras_envio drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.obras_envio
  add constraint obras_envio_tipo_check check (tipo is null or tipo in ('diario','ata','imediata'));

-- ============================================================
-- 3. obras_obra.peso_avanco + guarda de parâmetros (corpo de
-- sdd-sql-obras-modalidade-obra.sql 3d, só com peso_avanco a mais)
-- ============================================================
alter table public.obras_obra add column if not exists peso_avanco text
  check (peso_avanco in ('valor','duracao'));

create or replace function public.obras_obra_parametros_guarda() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  -- INSERT com JWT de usuário comum: nasce como SPOT, sem os parâmetros.
  if tg_op = 'INSERT' then
    if nullif(lower(trim(auth.jwt() ->> 'email')), '') is not null
       and (new.engenheiro_email is not null
            or new.data_base is not null
            or new.atividade_trava is not null
            or new.peso_avanco is not null
            or new.modalidade is distinct from 'spot')
       and not public.obras_is_admin() then
      raise exception 'OBRAS_PARAMETROS: só administrador cria obra com modalidade, data base, engenheiro, atividade-trava ou critério de peso'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if nullif(lower(trim(auth.jwt() ->> 'email')), '') is not null
     and (new.modalidade is distinct from old.modalidade
          or new.data_base is distinct from old.data_base
          or new.engenheiro_email is distinct from old.engenheiro_email
          or new.atividade_trava is distinct from old.atividade_trava
          or new.peso_avanco is distinct from old.peso_avanco)
     and not public.obras_is_admin() then
    raise exception 'OBRAS_PARAMETROS: só administrador altera modalidade, data base, engenheiro, atividade-trava e critério de peso'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_obra_parametros_guarda() from public, anon, authenticated;

drop trigger if exists obras_obra_parametros_guarda on public.obras_obra;
create trigger obras_obra_parametros_guarda
  before insert or update of modalidade, data_base, engenheiro_email, atividade_trava, peso_avanco on public.obras_obra
  for each row execute function public.obras_obra_parametros_guarda();

-- ============================================================
-- 4. obras_feriado.obra_id (nulo = global)
-- ============================================================
alter table public.obras_feriado
  add column if not exists obra_id uuid references public.obras_obra(id) on delete cascade;
alter table public.obras_feriado drop constraint if exists obras_feriado_pkey;
create unique index if not exists obras_feriado_obra_data_uniq
  on public.obras_feriado ((coalesce(obra_id, '00000000-0000-0000-0000-000000000000'::uuid)), data);

commit;

-- ============================================================
-- VERIFICAÇÃO (PASSO 2) — rodar depois do commit. Qualquer *** FALHOU *** = parar.
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'obras_registro existe com RLS ligada', 'true',
      (select coalesce((select relrowsecurity::text from pg_class where oid = to_regclass('public.obras_registro')), 'false'))),
  (2, 'obras_registro tem as 4 policies obras', '4',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_registro'
         and policyname in ('obras select','obras insert','obras update','obras delete'))),
  (3, 'colunas de obras_registro', '13',
      (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'obras_registro'
         and column_name in ('id','obra_id','tipo','data','participantes','texto','ata','nivel','impedimento_id',
                             'atividade_numero','criado_por','criado_em','editado_em'))),
  (4, 'trigger obras_registro_guarda ligado (insert/update/delete)', '1',
      (select count(*)::text from pg_trigger where tgname = 'obras_registro_guarda'
         and tgrelid = 'public.obras_registro'::regclass and not tgisinternal and tgenabled = 'O'
         and (tgtype & 4) = 4 and (tgtype & 8) = 8 and (tgtype & 16) = 16)),
  (5, 'obras_registro_guarda fechada para authenticated e anon', 'false',
      (select (has_function_privilege('authenticated', 'public.obras_registro_guarda()', 'EXECUTE')
            or has_function_privilege('anon', 'public.obras_registro_guarda()', 'EXECUTE'))::text)),
  (6, 'obras_envio.registro_id existe (uuid)', 'uuid',
      (select data_type from information_schema.columns where table_schema = 'public'
         and table_name = 'obras_envio' and column_name = 'registro_id')),
  (7, 'obras_envio_tipo_check aceita diario, ata e imediata', 'true',
      (select (pg_get_constraintdef(oid) like '%''ata''%' and pg_get_constraintdef(oid) like '%''imediata''%'
               and pg_get_constraintdef(oid) like '%''diario''%')::text
         from pg_constraint where conrelid = 'public.obras_envio'::regclass and conname = 'obras_envio_tipo_check')),
  (8, 'obras_envio tem um só check sobre tipo', '1',
      (select count(*)::text from pg_constraint where conrelid = 'public.obras_envio'::regclass
         and contype = 'c' and pg_get_constraintdef(oid) ~ '\mtipo\M')),
  (9, 'obras_envio segue só com select e insert', '2',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_envio')),
  (10, 'peso_avanco existe (text, nullable)', 'text|YES',
      (select data_type || '|' || is_nullable from information_schema.columns where table_schema = 'public'
         and table_name = 'obras_obra' and column_name = 'peso_avanco')),
  (11, 'check de peso_avanco', 'true',
      (select (pg_get_constraintdef(oid) like '%valor%' and pg_get_constraintdef(oid) like '%duracao%')::text
         from pg_constraint where conrelid = 'public.obras_obra'::regclass and contype = 'c'
          and pg_get_constraintdef(oid) like '%peso_avanco%' limit 1)),
  (12, 'guarda de parâmetros cobre peso_avanco e mantém as 4 colunas', 'true',
      (select (prosrc like '%new.peso_avanco is distinct from old.peso_avanco%'
               and prosrc like '%new.modalidade is distinct from old.modalidade%'
               and prosrc like '%new.data_base is distinct from old.data_base%'
               and prosrc like '%new.engenheiro_email is distinct from old.engenheiro_email%'
               and prosrc like '%new.atividade_trava is distinct from old.atividade_trava%')::text
         from pg_proc where oid = 'public.obras_obra_parametros_guarda()'::regprocedure)),
  (13, 'trigger de parâmetros dispara no SET de peso_avanco', 'true',
      (select (pg_get_triggerdef(oid) like '%peso_avanco%')::text from pg_trigger
        where tgname = 'obras_obra_parametros_guarda' and tgrelid = 'public.obras_obra'::regclass and not tgisinternal)),
  (14, 'guarda de parâmetros fechada para authenticated e anon', 'false',
      (select (has_function_privilege('authenticated', 'public.obras_obra_parametros_guarda()', 'EXECUTE')
            or has_function_privilege('anon', 'public.obras_obra_parametros_guarda()', 'EXECUTE'))::text)),
  (15, 'obras_feriado.obra_id existe (uuid, nullable)', 'uuid|YES',
      (select data_type || '|' || is_nullable from information_schema.columns where table_schema = 'public'
         and table_name = 'obras_feriado' and column_name = 'obra_id')),
  (16, 'obras_feriado sem PK; índice único (obra, data) com coalesce', 'true',
      (select ((select count(*) from pg_constraint where conrelid = 'public.obras_feriado'::regclass and contype = 'p') = 0
               and exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'obras_feriado_obra_data_uniq'
                            and indexdef like '%UNIQUE%' and indexdef like '%COALESCE%'))::text)),
  (17, 'feriados globais preservados (>= 10)', 'true',
      (select (count(*) >= 10)::text from public.obras_feriado where obra_id is null)),
  (18, 'obras_feriado: escrita segue só admin (insert/update/delete usam obras_is_admin)', '3',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_feriado'
         and cmd in ('INSERT','UPDATE','DELETE') and coalesce(qual, with_check) like '%obras_is_admin%'))
) as t(n, verificacao, esperado, encontrado)
order by n;
