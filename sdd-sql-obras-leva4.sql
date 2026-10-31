-- ============================================================
-- OBRAS — Leva 4 (apresentação, relatórios mensal/fase/entrega, agenda,
-- 31/10/2026): relatórios de período e o vínculo do envio com eles.
-- Spec: docs/superpowers/specs/2026-10-31-obras-leva4-apresentacao-relatorios-design.md §4.
-- Plano: docs/superpowers/plans/2026-10-31-obras-leva4.md, Task 1.
--
-- O QUE FAZ
--   1. obras_relatorio (tabela nova): relatório de período de tipo
--      mensal | fase | entrega, um por (obra_id, tipo, referencia).
--      referencia validada por tipo (check obras_relatorio_referencia_check):
--        mensal  -> 'AAAA-MM' (mês 01..12);
--        fase    -> ordem da etapa, inteiro sem zero à esquerda ('0', '1', '12');
--        entrega -> o texto 'entrega'.
--      periodo_inicio <= periodo_fim (check obras_relatorio_periodo_check).
--      Máquina de estados IGUAL à do obras_semanal (Leva 3), trigger
--      obras_relatorio_estado: rascunho -> validado -> enviado, sem voltar;
--      validar exige conteudo (objeto json) congelado, que é nulo em rascunho;
--      depois de validado nada do conteúdo muda (observacoes, highlights,
--      conteudo, período, validado_por/em); validado_por = e-mail do JWT e
--      validado_em = now() carimbados na validação (não falsificáveis);
--      obra_id, tipo e referencia nunca mudam. Escrita com JWT só engenheiro
--      da obra ou administrador; DELETE só em rascunho (policy).
--      highlights jsonb: livre (o app define a forma), editável só em rascunho.
--   2. obras_envio: tipo aceita também 'mensal', 'fase' e 'entrega' (check
--      recriado mantendo diario/ata/imediata/semanal) + coluna relatorio_id
--      uuid null -> obras_relatorio (on delete set null; o obras_envio_autor
--      da Leva 2 preserva enviado_por nesse UPDATE). Trigger
--      obras_envio_vinculo_obra recriado: registro_id, semanal_id e
--      relatorio_id só podem apontar para linha da MESMA obra do envio, e
--      relatorio_id só com envio do MESMO tipo do relatório (a agenda casa o
--      envio por tipo + referência).
--
-- Sem JWT (service role, SQL Editor) as guardas de AUTORIZAÇÃO passam, como
-- nas levas anteriores. As regras ESTRUTURAIS valem sempre: máquina de
-- estados, conteúdo congelado, referencia por tipo, período, vínculo do envio.
--
-- PRÉ-REQUISITO: sdd-sql-obras-leva3.sql aplicado (a seção 0 confere), que
-- por sua vez exige a Leva 2. Ordem: leva2 -> leva3 -> leva4.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-10-31-verificacao-obras-leva4.sql.
--
-- IDEMPOTENTE: create ... if not exists, create or replace, drop ... if exists.
--
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is not true` (sem NULL
-- aberto); uma função de trigger por tabela, sem campo de outra tabela.
--
-- ROLLBACK (só depois de reverter o app):
--   recriar obras_envio_vinculo_obra com o corpo da Leva 3 (sem relatorio_id)
--     e o trigger "before insert or update of obra_id, registro_id, semanal_id";
--   alter table public.obras_envio drop column relatorio_id;
--   recriar obras_envio_tipo_check sem mensal/fase/entrega (só sem envio desses tipos);
--   drop table public.obras_relatorio;  -- apaga dados (exportar antes)
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (Leva 3 e anteriores)
-- ============================================================
do $$
begin
  if to_regclass('public.obras_obra') is null
     or to_regclass('public.obras_envio') is null
     or to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null
     or to_regprocedure('public.obras_engenheiro_ou_admin(uuid)') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra.sql e -2 não estão aplicados. Nada foi alterado.';
  end if;
  if to_regclass('public.obras_registro') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_envio' and column_name = 'registro_id')
     or to_regprocedure('public.obras_envio_autor()') is null
     or not exists (select 1 from pg_proc
                     where oid = 'public.obras_envio_autor()'::regprocedure
                       and prosrc like '%new.enviado_por := old.enviado_por%') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva2.sql não está aplicado. Nada foi alterado.';
  end if;
  if to_regclass('public.obras_semanal') is null
     or to_regprocedure('public.obras_semanal_estado()') is null
     or to_regprocedure('public.obras_envio_vinculo_obra()') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_semanal' and column_name = 'conteudo')
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_envio' and column_name = 'semanal_id')
     or not exists (select 1 from pg_constraint
                     where conrelid = 'public.obras_envio'::regclass and conname = 'obras_envio_tipo_check'
                       and pg_get_constraintdef(oid) like '%''semanal''%') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva3.sql não está aplicado. Nada foi alterado.';
  end if;
  if exists (select 1 from public.obras_envio
              where tipo is not null
                and tipo not in ('diario','ata','imediata','semanal','mensal','fase','entrega')) then
    raise exception 'obras_envio tem tipo fora de diario/ata/imediata/semanal/mensal/fase/entrega; ajustar a lista do check antes. Nada foi alterado.';
  end if;
end $$;

-- ============================================================
-- 1. obras_relatorio (máquina de estados do obras_semanal)
-- ============================================================
create table if not exists public.obras_relatorio (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  tipo text not null
    constraint obras_relatorio_tipo_check check (tipo in ('mensal','fase','entrega')),
  referencia text not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  estado text not null default 'rascunho'
    constraint obras_relatorio_estado_check check (estado in ('rascunho','validado','enviado')),
  observacoes text,
  highlights jsonb,
  -- Conteúdo congelado na validação ({cliente, interno} montado pelo app):
  -- null em rascunho, obrigatório ao validar, imutável depois (trigger).
  conteudo jsonb,
  validado_por text,
  validado_em timestamptz,
  constraint obras_relatorio_referencia_check check (
       (tipo = 'mensal'  and referencia ~ '^\d{4}-(0[1-9]|1[0-2])$')
    or (tipo = 'fase'    and referencia ~ '^(0|[1-9]\d*)$')
    or (tipo = 'entrega' and referencia = 'entrega')),
  constraint obras_relatorio_periodo_check check (periodo_inicio <= periodo_fim),
  constraint obras_relatorio_obra_tipo_referencia_key unique (obra_id, tipo, referencia)
);

create or replace function public.obras_relatorio_estado() returns trigger
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
      raise exception 'OBRAS_RELATORIO: só o engenheiro da obra ou administrador altera o relatório'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if v_email is not null
     and (public.obras_engenheiro_ou_admin(new.obra_id) is not true
          or (tg_op = 'UPDATE' and public.obras_engenheiro_ou_admin(old.obra_id) is not true)) then
    raise exception 'OBRAS_RELATORIO: só o engenheiro da obra ou administrador altera o relatório'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if v_email is not null and (new.estado is distinct from 'rascunho'
        or new.validado_por is not null or new.validado_em is not null) then
      raise exception 'OBRAS_RELATORIO: relatório novo nasce como rascunho' using errcode = 'P0001';
    end if;
    -- Estrutural (vale sem JWT): conteúdo congelado só existe fora do rascunho, e lá é obrigatório.
    if (new.estado = 'rascunho') is distinct from (new.conteudo is null) then
      raise exception 'OBRAS_RELATORIO: conteudo é nulo em rascunho e obrigatório quando validado'
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.obra_id is distinct from old.obra_id or new.tipo is distinct from old.tipo
     or new.referencia is distinct from old.referencia then
    raise exception 'OBRAS_RELATORIO: obra_id, tipo e referencia são imutáveis' using errcode = 'P0001';
  end if;

  if new.estado is distinct from old.estado
     and not ((old.estado = 'rascunho' and new.estado = 'validado')
           or (old.estado = 'validado' and new.estado = 'enviado')) then
    raise exception 'OBRAS_RELATORIO: transição % -> % não permitida', old.estado, new.estado
      using errcode = 'P0001';
  end if;

  if old.estado is distinct from 'rascunho' then
    if row(new.id, new.obra_id, new.tipo, new.referencia, new.periodo_inicio, new.periodo_fim,
           new.observacoes, new.highlights, new.conteudo, new.validado_por, new.validado_em)
       is distinct from
       row(old.id, old.obra_id, old.tipo, old.referencia, old.periodo_inicio, old.periodo_fim,
           old.observacoes, old.highlights, old.conteudo, old.validado_por, old.validado_em) then
      raise exception 'OBRAS_RELATORIO: relatório % não pode ter o conteúdo alterado', old.estado
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- old.estado = 'rascunho'
  if new.estado = 'validado' then
    if new.conteudo is null or jsonb_typeof(new.conteudo) is distinct from 'object' then
      raise exception 'OBRAS_RELATORIO: validar exige o conteudo congelado (objeto json)'
        using errcode = 'P0001';
    end if;
    if v_email is not null then
      new.validado_por := v_email;
    end if;
    new.validado_em := now();
  elsif new.validado_por is distinct from old.validado_por
     or new.validado_em is distinct from old.validado_em then
    raise exception 'OBRAS_RELATORIO: validado_por/validado_em só mudam na validação'
      using errcode = 'P0001';
  elsif new.conteudo is not null then
    raise exception 'OBRAS_RELATORIO: conteudo é nulo em rascunho e obrigatório quando validado'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_relatorio_estado() from public, anon, authenticated;

drop trigger if exists obras_relatorio_estado on public.obras_relatorio;
create trigger obras_relatorio_estado
  before insert or update or delete on public.obras_relatorio
  for each row execute function public.obras_relatorio_estado();

alter table public.obras_relatorio enable row level security;
drop policy if exists "obras select" on public.obras_relatorio;
create policy "obras select" on public.obras_relatorio for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_relatorio;
create policy "obras insert" on public.obras_relatorio for insert to authenticated
  with check ((select public.obras_has_access()));
drop policy if exists "obras update" on public.obras_relatorio;
create policy "obras update" on public.obras_relatorio for update to authenticated
  using ((select public.obras_has_access())) with check ((select public.obras_has_access()));
drop policy if exists "obras delete" on public.obras_relatorio;
create policy "obras delete" on public.obras_relatorio for delete to authenticated
  using ((select public.obras_has_access()) and estado = 'rascunho');

-- ============================================================
-- 2. obras_envio: tipos mensal/fase/entrega e relatorio_id
-- ============================================================
alter table public.obras_envio
  add column if not exists relatorio_id uuid references public.obras_relatorio(id) on delete set null;

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
  add constraint obras_envio_tipo_check
  check (tipo is null or tipo in ('diario','ata','imediata','semanal','mensal','fase','entrega'));

-- Vínculo do envio: registro_id (Leva 2), semanal_id (Leva 3) e relatorio_id
-- têm de ser da MESMA obra do envio; relatorio_id só com envio do MESMO tipo
-- do relatório. Falha fechada: linha referenciada não achada também recusa (a
-- FK já garante que existe). security definer só para ler por cima da RLS.
create or replace function public.obras_envio_vinculo_obra() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_obra uuid;
  v_tipo text;
begin
  if new.registro_id is not null
     and (select r.obra_id from public.obras_registro r where r.id = new.registro_id)
         is distinct from new.obra_id then
    raise exception 'OBRAS_ENVIO: registro_id é de outra obra' using errcode = '23514';
  end if;
  if new.semanal_id is not null
     and (select s.obra_id from public.obras_semanal s where s.id = new.semanal_id)
         is distinct from new.obra_id then
    raise exception 'OBRAS_ENVIO: semanal_id é de outra obra' using errcode = '23514';
  end if;
  if new.relatorio_id is not null then
    select r.obra_id, r.tipo into v_obra, v_tipo from public.obras_relatorio r where r.id = new.relatorio_id;
    if v_obra is distinct from new.obra_id then
      raise exception 'OBRAS_ENVIO: relatorio_id é de outra obra' using errcode = '23514';
    end if;
    if v_tipo is distinct from new.tipo then
      raise exception 'OBRAS_ENVIO: relatorio_id é de outro tipo de relatório' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_envio_vinculo_obra() from public, anon, authenticated;

drop trigger if exists obras_envio_vinculo_obra on public.obras_envio;
create trigger obras_envio_vinculo_obra
  before insert or update of obra_id, tipo, registro_id, semanal_id, relatorio_id on public.obras_envio
  for each row execute function public.obras_envio_vinculo_obra();

commit;

-- ============================================================
-- VERIFICAÇÃO (PASSO 2) — rodar depois do commit. Qualquer *** FALHOU *** = parar.
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'RLS ligada em obras_relatorio', 'true',
      (select relrowsecurity::text from pg_class where oid = to_regclass('public.obras_relatorio'))),
  (2, 'colunas de obras_relatorio', '12',
      (select count(*)::text from information_schema.columns where table_schema = 'public' and table_name = 'obras_relatorio'
         and column_name in ('id','obra_id','tipo','referencia','periodo_inicio','periodo_fim','estado','observacoes',
                             'highlights','conteudo','validado_por','validado_em'))),
  (3, 'obras_relatorio: 4 policies obras com obras_has_access', '4',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_relatorio'
         and policyname in ('obras select','obras insert','obras update','obras delete')
         and coalesce(qual, with_check) like '%obras_has_access%')),
  (4, 'obras_relatorio: delete só em rascunho', 'true',
      (select (qual like '%rascunho%' and qual like '%obras_has_access%')::text from pg_policies
        where schemaname = 'public' and tablename = 'obras_relatorio' and cmd = 'DELETE')),
  (5, 'trigger obras_relatorio_estado ligado (insert/update/delete)', '1',
      (select count(*)::text from pg_trigger
        where not tgisinternal and tgenabled = 'O'
          and (tgtype & 4) = 4 and (tgtype & 8) = 8 and (tgtype & 16) = 16
          and tgname = 'obras_relatorio_estado' and tgrelid = 'public.obras_relatorio'::regclass)),
  (6, 'obras_relatorio_estado: definer, fechada para authenticated e anon', 'true|false',
      (select p.prosecdef::text || '|' || (has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                          or has_function_privilege('anon', p.oid, 'EXECUTE'))::text
         from pg_proc p where p.oid = to_regprocedure('public.obras_relatorio_estado()'))),
  (7, 'tipo do relatório: mensal, fase, entrega', 'true',
      (select (pg_get_constraintdef(oid) like '%''mensal''%' and pg_get_constraintdef(oid) like '%''fase''%'
               and pg_get_constraintdef(oid) like '%''entrega''%')::text
         from pg_constraint where conrelid = 'public.obras_relatorio'::regclass and conname = 'obras_relatorio_tipo_check')),
  (8, 'checks de referencia por tipo e de período existem', '2',
      (select count(*)::text from pg_constraint where conrelid = 'public.obras_relatorio'::regclass
         and conname in ('obras_relatorio_referencia_check','obras_relatorio_periodo_check'))),
  (9, 'único (obra_id, tipo, referencia)', '1',
      (select count(*)::text from pg_constraint where conrelid = 'public.obras_relatorio'::regclass
         and contype = 'u' and conname = 'obras_relatorio_obra_tipo_referencia_key')),
  (10, 'obras_relatorio.conteudo e highlights (jsonb) congelados pelo trigger', 'jsonb|jsonb|true',
      (select (select data_type from information_schema.columns where table_schema = 'public'
                 and table_name = 'obras_relatorio' and column_name = 'conteudo')
              || '|' || (select data_type from information_schema.columns where table_schema = 'public'
                 and table_name = 'obras_relatorio' and column_name = 'highlights')
              || '|' || (select (prosrc like '%old.conteudo%' and prosrc like '%old.highlights%'
                                 and prosrc like '%old.observacoes%' and prosrc like '%validar exige o conteudo%')::text
                           from pg_proc where oid = 'public.obras_relatorio_estado()'::regprocedure))),
  (11, 'obras_envio_tipo_check aceita os 7 tipos', 'true',
      (select (pg_get_constraintdef(oid) like '%''diario''%' and pg_get_constraintdef(oid) like '%''ata''%'
               and pg_get_constraintdef(oid) like '%''imediata''%' and pg_get_constraintdef(oid) like '%''semanal''%'
               and pg_get_constraintdef(oid) like '%''mensal''%' and pg_get_constraintdef(oid) like '%''fase''%'
               and pg_get_constraintdef(oid) like '%''entrega''%')::text
         from pg_constraint where conrelid = 'public.obras_envio'::regclass and conname = 'obras_envio_tipo_check')),
  (12, 'obras_envio tem um só check sobre tipo', '1',
      (select count(*)::text from pg_constraint where conrelid = 'public.obras_envio'::regclass
         and contype = 'c' and pg_get_constraintdef(oid) ~ '\mtipo\M')),
  (13, 'obras_envio.relatorio_id existe (uuid), FK on delete set null', 'uuid|n',
      (select (select data_type from information_schema.columns where table_schema = 'public'
                 and table_name = 'obras_envio' and column_name = 'relatorio_id')
              || '|' || (select confdeltype::text from pg_constraint where conrelid = 'public.obras_envio'::regclass
                           and contype = 'f' and confrelid = 'public.obras_relatorio'::regclass))),
  (14, 'obras_envio segue só com select e insert', '2',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_envio')),
  (15, 'obras_envio_autor (Leva 2) intacto: UPDATE mantém old.enviado_por', 'true',
      (select (prosrc like '%new.enviado_por := old.enviado_por%')::text
         from pg_proc where oid = 'public.obras_envio_autor()'::regprocedure)),
  (16, 'obras_envio_vinculo_obra confere registro, semanal e relatório (obra e tipo)', 'true',
      (select (prosrc like '%registro_id é de outra obra%' and prosrc like '%semanal_id é de outra obra%'
               and prosrc like '%relatorio_id é de outra obra%' and prosrc like '%outro tipo de relatório%')::text
         from pg_proc where oid = 'public.obras_envio_vinculo_obra()'::regprocedure)),
  (17, 'trigger obras_envio_vinculo_obra ligado, função fechada para authenticated/anon', '1|false',
      (select (select count(*) from pg_trigger where tgname = 'obras_envio_vinculo_obra'
                 and tgrelid = 'public.obras_envio'::regclass and not tgisinternal and tgenabled = 'O')::text
              || '|' || (has_function_privilege('authenticated', 'public.obras_envio_vinculo_obra()', 'EXECUTE')
                      or has_function_privilege('anon', 'public.obras_envio_vinculo_obra()', 'EXECUTE'))::text)),
  (18, 'obras_semanal_estado (Leva 3) intacto', 'true',
      (select (prosrc like '%validar exige o conteudo%')::text
         from pg_proc where oid = 'public.obras_semanal_estado()'::regprocedure))
) as t(n, verificacao, esperado, encontrado)
order by n;
