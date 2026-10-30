-- ============================================================
-- OBRAS — Leva 3 (Last Planner + relatório semanal, 31/10/2026): restrições
-- do lookahead, plano da semana (PPC) e relatório semanal.
-- Spec: docs/superpowers/specs/2026-10-31-obras-leva3-last-planner-semanal-design.md §4.
-- Plano: docs/superpowers/plans/2026-10-31-obras-leva3.md, Task 1.
--
-- O QUE FAZ
--   1. obras_restricao (tabela nova) + RLS "obras *" (obras_has_access()) +
--      trigger obras_restricao_guarda: no INSERT com JWT criado_por = e-mail da
--      sessão e criado_em = now() (não falsificáveis); no UPDATE a autoria
--      (criado_por/criado_em) e obra_id nunca mudam, atualizado_por = e-mail do
--      JWT e atualizado_em = now(); liberada_em = now() ao ENTRAR em 'liberada',
--      mantido enquanto segue liberada, limpo ao sair. DELETE com JWT só pelo
--      autor ou administrador.
--   2. obras_plano_semana + obras_plano_item. O plano nasce FECHADO, numa
--      chamada só: obras_fechar_plano(obra, semana, itens jsonb) (security
--      invoker) grava o plano e os itens; recusa se já há plano na semana.
--      Itens só entram durante essa chamada (marca local da transação
--      obras.fechando_plano = id do plano, conferida pelo trigger) e só saem
--      junto com o plano (cascata). Plano: UPDATE proibido; DELETE com JWT só
--      administrador. Item: numero/meta/plano imutáveis; avaliação
--      (percentual_final, cumprido, causa) uma vez só pelo engenheiro da obra
--      ou administrador (avaliado_em/avaliado_por carimbados); reavaliar só
--      administrador. Escrita com JWT exige obras_engenheiro_ou_admin(obra).
--   3. obras_semanal: máquina de estados igual à do RDO (rascunho -> validado
--      -> enviado, sem voltar; conteúdo imutável depois de validado;
--      validado_por/validado_em carimbados na validação). Escrita com JWT só
--      engenheiro da obra ou administrador; DELETE só em rascunho.
--   4. obras_envio: tipo aceita também 'semanal' (check recriado a partir da
--      Leva 2) + coluna semanal_id uuid null -> obras_semanal (on delete set
--      null; o obras_envio_autor da Leva 2 preserva enviado_por nesse UPDATE).
--
-- Sem JWT (service role, SQL Editor) as guardas de AUTORIZAÇÃO passam, como
-- nas levas anteriores. As regras ESTRUTURAIS valem sempre: plano não muda,
-- item só nasce/morre com o plano, numero/meta do item imutáveis, máquina de
-- estados do semanal.
--
-- PRÉ-REQUISITO: sdd-sql-obras-leva2.sql aplicado (a seção 0 confere).
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-10-31-verificacao-obras-leva3.sql.
--
-- IDEMPOTENTE: create ... if not exists, create or replace, drop ... if exists.
--
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is not true` (sem NULL
-- aberto); uma função de trigger por tabela, sem campo de outra tabela.
--
-- ROLLBACK (só depois de reverter o app):
--   alter table public.obras_envio drop column semanal_id;
--   recriar obras_envio_tipo_check sem 'semanal' (só sem envio 'semanal');
--   drop function public.obras_fechar_plano(uuid, date, jsonb);
--   drop table public.obras_plano_item, public.obras_plano_semana,
--              public.obras_semanal, public.obras_restricao;  -- apaga dados (exportar antes)
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (Leva 2 e anteriores)
-- ============================================================
do $$
begin
  if to_regclass('public.obras_obra') is null
     or to_regclass('public.obras_envio') is null
     or to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null
     or to_regprocedure('public.obras_engenheiro_ou_admin(uuid)') is null
     or to_regprocedure('public.obras_rdo_estado()') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra.sql e -2 não estão aplicados. Nada foi alterado.';
  end if;
  if to_regclass('public.obras_registro') is null
     or to_regprocedure('public.obras_registro_guarda()') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_envio' and column_name = 'registro_id')
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'peso_avanco')
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_feriado' and column_name = 'obra_id')
     or not exists (select 1 from pg_constraint
                     where conrelid = 'public.obras_envio'::regclass and conname = 'obras_envio_tipo_check'
                       and pg_get_constraintdef(oid) like '%''imediata''%')
     or not exists (select 1 from pg_proc
                     where oid = 'public.obras_envio_autor()'::regprocedure
                       and prosrc like '%new.enviado_por := old.enviado_por%') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva2.sql não está aplicado. Nada foi alterado.';
  end if;
  if exists (select 1 from public.obras_envio
              where tipo is not null and tipo not in ('diario','ata','imediata','semanal')) then
    raise exception 'obras_envio tem tipo fora de diario/ata/imediata/semanal; ajustar a lista do check antes. Nada foi alterado.';
  end if;
end $$;

-- ============================================================
-- 1. obras_restricao
-- ============================================================
create table if not exists public.obras_restricao (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  atividade_numero int not null,
  tipo text not null
    check (tipo in ('acesso','material','mao_de_obra','projeto','decisao_cliente','equipamento','outro')),
  descricao text not null,
  responsavel text not null check (responsavel in ('cliente','manfac','terceiro')),
  prazo date,
  situacao text not null default 'identificada'
    check (situacao in ('identificada','em_tratativa','liberada')),
  liberada_em timestamptz,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz
);
create index if not exists obras_restricao_obra_idx on public.obras_restricao (obra_id, situacao);

create or replace function public.obras_restricao_guarda() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'INSERT' then
    if v_email is not null then
      new.criado_por := v_email;
      new.criado_em := now();
    end if;
    new.atualizado_por := null;
    new.atualizado_em := null;
    new.liberada_em := case when new.situacao = 'liberada' then now() end;
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- Cascata da obra apagada: a obra já não existe, passa.
    if v_email is not null
       and exists (select 1 from public.obras_obra o where o.id = old.obra_id)
       and public.obras_is_admin() is not true
       and old.criado_por is distinct from v_email then
      raise exception 'OBRAS_RESTRICAO: só o autor ou administrador apaga a restrição'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- UPDATE: autoria e obra nunca mudam.
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.obra_id := old.obra_id;
  new.atualizado_por := coalesce(v_email, new.atualizado_por);
  new.atualizado_em := now();
  if new.situacao = 'liberada' then
    new.liberada_em := case when old.situacao = 'liberada' then old.liberada_em else now() end;
  else
    new.liberada_em := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_restricao_guarda() from public, anon, authenticated;

drop trigger if exists obras_restricao_guarda on public.obras_restricao;
create trigger obras_restricao_guarda
  before insert or update or delete on public.obras_restricao
  for each row execute function public.obras_restricao_guarda();

alter table public.obras_restricao enable row level security;
drop policy if exists "obras select" on public.obras_restricao;
create policy "obras select" on public.obras_restricao for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_restricao;
create policy "obras insert" on public.obras_restricao for insert to authenticated
  with check ((select public.obras_has_access()));
drop policy if exists "obras update" on public.obras_restricao;
create policy "obras update" on public.obras_restricao for update to authenticated
  using ((select public.obras_has_access())) with check ((select public.obras_has_access()));
drop policy if exists "obras delete" on public.obras_restricao;
create policy "obras delete" on public.obras_restricao for delete to authenticated
  using ((select public.obras_has_access()));

-- ============================================================
-- 2. obras_plano_semana + obras_plano_item + obras_fechar_plano
-- ============================================================
create table if not exists public.obras_plano_semana (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  semana_inicio date not null
    constraint obras_plano_semana_segunda check (extract(isodow from semana_inicio) = 1),
  fechado_em timestamptz not null default now(),
  fechado_por text,
  unique (obra_id, semana_inicio)
);

create table if not exists public.obras_plano_item (
  id uuid primary key default gen_random_uuid(),
  plano_id uuid not null references public.obras_plano_semana(id) on delete cascade,
  numero int not null,
  meta_percentual numeric(5,4) not null check (meta_percentual between 0 and 1),
  percentual_final numeric(5,4) check (percentual_final between 0 and 1),
  cumprido boolean,
  causa text check (causa in ('cliente','material','equipe','clima','projeto','outro')),
  avaliado_em timestamptz,
  avaliado_por text,
  unique (plano_id, numero)
);

-- 2a. Plano: nasce fechado (fechado_por/fechado_em forçados), nunca muda.
-- security definer: obras_engenheiro_ou_admin() não é executável por authenticated.
create or replace function public.obras_plano_semana_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'INSERT' then
    if v_email is not null then
      if public.obras_engenheiro_ou_admin(new.obra_id) is not true then
        raise exception 'OBRAS_PLANO: só o engenheiro da obra ou administrador fecha o plano da semana'
          using errcode = '42501';
      end if;
      new.fechado_por := v_email;
      new.fechado_em := now();
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'OBRAS_PLANO: plano fechado não muda' using errcode = 'P0001';
  end if;

  -- DELETE: com JWT só administrador (cascata da obra apagada passa).
  if v_email is not null
     and exists (select 1 from public.obras_obra o where o.id = old.obra_id)
     and public.obras_is_admin() is not true then
    raise exception 'OBRAS_PLANO: só administrador apaga plano fechado' using errcode = '42501';
  end if;
  return old;
end;
$$;
revoke execute on function public.obras_plano_semana_guarda() from public, anon, authenticated;

drop trigger if exists obras_plano_semana_guarda on public.obras_plano_semana;
create trigger obras_plano_semana_guarda
  before insert or update or delete on public.obras_plano_semana
  for each row execute function public.obras_plano_semana_guarda();

-- 2b. Item: só nasce dentro de obras_fechar_plano; só sai com o plano;
-- numero/meta imutáveis; avaliação uma vez (admin reavalia).
create or replace function public.obras_plano_item_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_obra  uuid;
begin
  if tg_op = 'DELETE' then
    -- Só em cascata do plano (o plano já não existe quando a cascata roda).
    if exists (select 1 from public.obras_plano_semana p where p.id = old.plano_id) then
      raise exception 'OBRAS_PLANO_ITEM: item de plano fechado não é apagado' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if current_setting('obras.fechando_plano', true) is distinct from new.plano_id::text then
      raise exception 'OBRAS_PLANO_ITEM: itens só entram ao fechar o plano (obras_fechar_plano)'
        using errcode = 'P0001';
    end if;
    if v_email is not null then
      select p.obra_id into v_obra from public.obras_plano_semana p where p.id = new.plano_id;
      if public.obras_engenheiro_ou_admin(v_obra) is not true then
        raise exception 'OBRAS_PLANO: só o engenheiro da obra ou administrador fecha o plano da semana'
          using errcode = '42501';
      end if;
    end if;
    if new.percentual_final is not null or new.cumprido is not null or new.causa is not null then
      raise exception 'OBRAS_PLANO_ITEM: item nasce sem avaliação' using errcode = 'P0001';
    end if;
    new.avaliado_em := null;
    new.avaliado_por := null;
    return new;
  end if;

  -- UPDATE
  if new.id is distinct from old.id or new.plano_id is distinct from old.plano_id
     or new.numero is distinct from old.numero
     or new.meta_percentual is distinct from old.meta_percentual then
    raise exception 'OBRAS_PLANO_ITEM: plano fechado — só a avaliação do item muda' using errcode = 'P0001';
  end if;

  if row(new.percentual_final, new.cumprido, new.causa)
     is not distinct from row(old.percentual_final, old.cumprido, old.causa) then
    -- Nada de avaliação mudou: carimbo não é editável à mão.
    new.avaliado_em := old.avaliado_em;
    new.avaliado_por := old.avaliado_por;
    return new;
  end if;

  if v_email is not null then
    select p.obra_id into v_obra from public.obras_plano_semana p where p.id = new.plano_id;
    if public.obras_engenheiro_ou_admin(v_obra) is not true then
      raise exception 'OBRAS_PLANO_ITEM: só o engenheiro da obra ou administrador avalia o plano'
        using errcode = '42501';
    end if;
    if old.avaliado_em is not null and public.obras_is_admin() is not true then
      raise exception 'OBRAS_PLANO_ITEM: item já avaliado; só administrador reavalia'
        using errcode = '42501';
    end if;
    new.avaliado_por := v_email;
    new.avaliado_em := now();
  else
    new.avaliado_em := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_plano_item_guarda() from public, anon, authenticated;

drop trigger if exists obras_plano_item_guarda on public.obras_plano_item;
create trigger obras_plano_item_guarda
  before insert or update or delete on public.obras_plano_item
  for each row execute function public.obras_plano_item_guarda();

-- RLS. Plano: sem policy de UPDATE. Item: sem policy de DELETE (a cascata
-- do plano não passa pela RLS).
alter table public.obras_plano_semana enable row level security;
drop policy if exists "obras select" on public.obras_plano_semana;
create policy "obras select" on public.obras_plano_semana for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_plano_semana;
create policy "obras insert" on public.obras_plano_semana for insert to authenticated
  with check ((select public.obras_has_access()));
drop policy if exists "obras delete" on public.obras_plano_semana;
create policy "obras delete" on public.obras_plano_semana for delete to authenticated
  using ((select public.obras_has_access()));

alter table public.obras_plano_item enable row level security;
drop policy if exists "obras select" on public.obras_plano_item;
create policy "obras select" on public.obras_plano_item for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_plano_item;
create policy "obras insert" on public.obras_plano_item for insert to authenticated
  with check ((select public.obras_has_access()));
drop policy if exists "obras update" on public.obras_plano_item;
create policy "obras update" on public.obras_plano_item for update to authenticated
  using ((select public.obras_has_access())) with check ((select public.obras_has_access()));

-- 2c. Fecha o plano da semana: plano + itens numa chamada só.
-- p_itens = [{"numero": 3, "meta_percentual": 0.5}, ...] (array; vazio = plano sem itens).
-- security invoker: RLS e triggers valem para quem chama.
create or replace function public.obras_fechar_plano(p_obra uuid, p_semana date, p_itens jsonb)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare v_id uuid;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'OBRAS_PLANO: itens do plano têm de ser uma lista' using errcode = '22023';
  end if;
  if exists (select 1 from public.obras_plano_semana p
              where p.obra_id = p_obra and p.semana_inicio = p_semana) then
    raise exception 'OBRAS_PLANO: já existe plano fechado para esta semana' using errcode = 'P0001';
  end if;

  insert into public.obras_plano_semana (obra_id, semana_inicio)
  values (p_obra, p_semana)
  returning id into v_id;

  perform set_config('obras.fechando_plano', v_id::text, true);
  insert into public.obras_plano_item (plano_id, numero, meta_percentual)
  select v_id, x.numero, x.meta_percentual
    from jsonb_to_recordset(p_itens) as x(numero int, meta_percentual numeric);
  perform set_config('obras.fechando_plano', '', true);

  return v_id;
end;
$$;
revoke execute on function public.obras_fechar_plano(uuid, date, jsonb) from public, anon;
grant execute on function public.obras_fechar_plano(uuid, date, jsonb) to authenticated;

-- ============================================================
-- 3. obras_semanal (máquina de estados do RDO)
-- ============================================================
create table if not exists public.obras_semanal (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  semana_inicio date not null
    constraint obras_semanal_segunda check (extract(isodow from semana_inicio) = 1),
  estado text not null default 'rascunho'
    check (estado in ('rascunho','validado','enviado')),
  observacoes text,
  validado_por text,
  validado_em timestamptz,
  unique (obra_id, semana_inicio)
);

create or replace function public.obras_semanal_estado() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'DELETE' then
    -- Com JWT só engenheiro/admin (cascata da obra apagada passa). Só rascunho: policy.
    if v_email is not null
       and exists (select 1 from public.obras_obra o where o.id = old.obra_id)
       and public.obras_engenheiro_ou_admin(old.obra_id) is not true then
      raise exception 'OBRAS_SEMANAL: só o engenheiro da obra ou administrador altera o relatório semanal'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if v_email is not null
     and (public.obras_engenheiro_ou_admin(new.obra_id) is not true
          or (tg_op = 'UPDATE' and public.obras_engenheiro_ou_admin(old.obra_id) is not true)) then
    raise exception 'OBRAS_SEMANAL: só o engenheiro da obra ou administrador altera o relatório semanal'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if v_email is not null and (new.estado is distinct from 'rascunho'
        or new.validado_por is not null or new.validado_em is not null) then
      raise exception 'OBRAS_SEMANAL: relatório novo nasce como rascunho' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.obra_id is distinct from old.obra_id or new.semana_inicio is distinct from old.semana_inicio then
    raise exception 'OBRAS_SEMANAL: obra_id e semana_inicio são imutáveis' using errcode = 'P0001';
  end if;

  if new.estado is distinct from old.estado
     and not ((old.estado = 'rascunho' and new.estado = 'validado')
           or (old.estado = 'validado' and new.estado = 'enviado')) then
    raise exception 'OBRAS_SEMANAL: transição % -> % não permitida', old.estado, new.estado
      using errcode = 'P0001';
  end if;

  if old.estado is distinct from 'rascunho' then
    if row(new.id, new.obra_id, new.semana_inicio, new.observacoes, new.validado_por, new.validado_em)
       is distinct from
       row(old.id, old.obra_id, old.semana_inicio, old.observacoes, old.validado_por, old.validado_em) then
      raise exception 'OBRAS_SEMANAL: relatório % não pode ter o conteúdo alterado', old.estado
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
    raise exception 'OBRAS_SEMANAL: validado_por/validado_em só mudam na validação'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_semanal_estado() from public, anon, authenticated;

drop trigger if exists obras_semanal_estado on public.obras_semanal;
create trigger obras_semanal_estado
  before insert or update or delete on public.obras_semanal
  for each row execute function public.obras_semanal_estado();

alter table public.obras_semanal enable row level security;
drop policy if exists "obras select" on public.obras_semanal;
create policy "obras select" on public.obras_semanal for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_semanal;
create policy "obras insert" on public.obras_semanal for insert to authenticated
  with check ((select public.obras_has_access()));
drop policy if exists "obras update" on public.obras_semanal;
create policy "obras update" on public.obras_semanal for update to authenticated
  using ((select public.obras_has_access())) with check ((select public.obras_has_access()));
drop policy if exists "obras delete" on public.obras_semanal;
create policy "obras delete" on public.obras_semanal for delete to authenticated
  using ((select public.obras_has_access()) and estado = 'rascunho');

-- ============================================================
-- 4. obras_envio: tipo 'semanal' e semanal_id
-- ============================================================
alter table public.obras_envio
  add column if not exists semanal_id uuid references public.obras_semanal(id) on delete set null;

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
  add constraint obras_envio_tipo_check check (tipo is null or tipo in ('diario','ata','imediata','semanal'));

commit;

-- ============================================================
-- VERIFICAÇÃO (PASSO 2) — rodar depois do commit. Qualquer *** FALHOU *** = parar.
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'RLS ligada nas 4 tabelas novas', '4',
      (select count(*)::text from pg_class
        where oid in (to_regclass('public.obras_restricao'), to_regclass('public.obras_plano_semana'),
                      to_regclass('public.obras_plano_item'), to_regclass('public.obras_semanal'))
          and relrowsecurity)),
  (2, 'colunas de obras_restricao', '13',
      (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'obras_restricao'
         and column_name in ('id','obra_id','atividade_numero','tipo','descricao','responsavel','prazo','situacao',
                             'liberada_em','criado_por','criado_em','atualizado_por','atualizado_em'))),
  (3, 'obras_restricao: 4 policies obras com obras_has_access', '4',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_restricao'
         and policyname in ('obras select','obras insert','obras update','obras delete')
         and coalesce(qual, with_check) like '%obras_has_access%')),
  (4, 'obras_plano_semana: select/insert/delete, sem update', 'DELETE,INSERT,SELECT',
      (select string_agg(cmd, ',' order by cmd) from pg_policies where schemaname = 'public' and tablename = 'obras_plano_semana')),
  (5, 'obras_plano_item: select/insert/update, sem delete', 'INSERT,SELECT,UPDATE',
      (select string_agg(cmd, ',' order by cmd) from pg_policies where schemaname = 'public' and tablename = 'obras_plano_item')),
  (6, 'obras_semanal: delete só em rascunho', 'true',
      (select (qual like '%rascunho%' and qual like '%obras_has_access%')::text from pg_policies
        where schemaname = 'public' and tablename = 'obras_semanal' and cmd = 'DELETE')),
  (7, 'triggers ligados (insert/update/delete) nas 4 tabelas', '4',
      (select count(*)::text from pg_trigger
        where not tgisinternal and tgenabled = 'O'
          and (tgtype & 4) = 4 and (tgtype & 8) = 8 and (tgtype & 16) = 16
          and ((tgname = 'obras_restricao_guarda' and tgrelid = 'public.obras_restricao'::regclass)
            or (tgname = 'obras_plano_semana_guarda' and tgrelid = 'public.obras_plano_semana'::regclass)
            or (tgname = 'obras_plano_item_guarda' and tgrelid = 'public.obras_plano_item'::regclass)
            or (tgname = 'obras_semanal_estado' and tgrelid = 'public.obras_semanal'::regclass)))),
  (8, 'funções de trigger fechadas para authenticated e anon', 'false',
      (select bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')
                   or has_function_privilege('anon', p.oid, 'EXECUTE'))::text
         from pg_proc p where p.pronamespace = 'public'::regnamespace
          and p.proname in ('obras_restricao_guarda','obras_plano_semana_guarda','obras_plano_item_guarda','obras_semanal_estado'))),
  (9, 'obras_fechar_plano: invoker, authenticated executa, anon não', 'false|true|false',
      (select p.prosecdef::text || '|' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
              || '|' || has_function_privilege('anon', p.oid, 'EXECUTE')::text
         from pg_proc p where p.oid = to_regprocedure('public.obras_fechar_plano(uuid,date,jsonb)'))),
  (10, 'semana_inicio só segunda (plano e semanal)', '2',
      (select count(*)::text from pg_constraint
        where conname in ('obras_plano_semana_segunda','obras_semanal_segunda') and pg_get_constraintdef(oid) like '%isodow%')),
  (11, 'únicos (obra, semana) e (plano, numero)', '3',
      (select count(*)::text from pg_constraint where contype = 'u'
        and conrelid in ('public.obras_plano_semana'::regclass, 'public.obras_plano_item'::regclass, 'public.obras_semanal'::regclass))),
  (12, 'causa do item = CausaRdo', 'true',
      (select (pg_get_constraintdef(oid) like '%cliente%' and pg_get_constraintdef(oid) like '%material%'
               and pg_get_constraintdef(oid) like '%equipe%' and pg_get_constraintdef(oid) like '%clima%'
               and pg_get_constraintdef(oid) like '%projeto%' and pg_get_constraintdef(oid) like '%outro%')::text
         from pg_constraint where conrelid = 'public.obras_plano_item'::regclass and contype = 'c'
          and pg_get_constraintdef(oid) like '%causa%' limit 1)),
  (13, 'obras_envio_tipo_check aceita diario, ata, imediata e semanal', 'true',
      (select (pg_get_constraintdef(oid) like '%''diario''%' and pg_get_constraintdef(oid) like '%''ata''%'
               and pg_get_constraintdef(oid) like '%''imediata''%' and pg_get_constraintdef(oid) like '%''semanal''%')::text
         from pg_constraint where conrelid = 'public.obras_envio'::regclass and conname = 'obras_envio_tipo_check')),
  (14, 'obras_envio tem um só check sobre tipo', '1',
      (select count(*)::text from pg_constraint where conrelid = 'public.obras_envio'::regclass
         and contype = 'c' and pg_get_constraintdef(oid) ~ '\mtipo\M')),
  (15, 'obras_envio.semanal_id existe (uuid)', 'uuid',
      (select data_type from information_schema.columns where table_schema = 'public'
         and table_name = 'obras_envio' and column_name = 'semanal_id')),
  (16, 'obras_envio segue só com select e insert', '2',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_envio')),
  (17, 'obras_envio_autor (Leva 2) intacto: UPDATE mantém old.enviado_por', 'true',
      (select (prosrc like '%new.enviado_por := old.enviado_por%')::text
         from pg_proc where oid = 'public.obras_envio_autor()'::regprocedure))
) as t(n, verificacao, esperado, encontrado)
order by n;
