-- ============================================================
-- *** NÃO APLICADO *** (escrito em 03/11/2026)
-- Sofia (Gestão de Frotas) — multa por etapa, avaria do checklist,
-- fotos imutáveis, storage restrito ao Sofia.
-- Spec: docs/superpowers/specs/2026-11-03-frotas-multa-fotos-checklist-design.md
-- Projeto iyytcavcgukfjnjjrerx — CONFIRME O REF ANTES DE APLICAR.
-- Depende de sdd-sql-sofia-gestor-frotas.sql (seção 0 aborta sem ele).
-- Território de exceção (autorização, dinheiro, RLS, dado de cliente):
-- revisão independente + autorização escrita do João citando este arquivo.
-- Depois: rodar sdd-sql-sofia-multa-avaria-teste.sql (rollback forçado).
-- SQL ANTES DO DEPLOY DO APP. App antigo depois deste SQL: Descontos/
-- Multas antigos falham ao mudar status direto (por desenho).
-- IDEMPOTENTE: if not exists / create or replace / drop ... if exists.
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS E DERIVA
-- ============================================================
do $$
declare
  v_src text;
begin
  if to_regprocedure('public.sofia_pode_gerir()') is null
     or to_regprocedure('public.sofia_is_admin()') is null
     or to_regprocedure('public.sofia_has_access()') is null then
    raise exception 'sofia_pode_gerir/sofia_is_admin/sofia_has_access ausentes — aplicar sdd-sql-sofia-gestor-frotas.sql antes';
  end if;

  if not exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgname = 'trg_bloquear_autorizacao_multas'
      and t.tgrelid = 'public.multas'::regclass
      and t.tgenabled <> 'D'
      and p.proname = 'sofia_bloquear_autorizacao_nao_admin') then
    raise exception 'trg_bloquear_autorizacao_multas ausente ou desabilitado — abortando';
  end if;

  select prosrc into v_src from pg_proc
  where oid = to_regprocedure('public.sofia_bloquear_autorizacao_nao_admin()');
  if position('sofia_pode_gerir() is not true' in v_src) = 0 then
    raise exception 'sofia_bloquear_autorizacao_nao_admin difere do esperado (guarda sofia_pode_gerir) — comparar antes';
  end if;

  if exists (select 1 from public.multas where autorizacao_status is null) then
    raise exception 'multas com autorizacao_status NULL — backfill de etapa não decide; corrigir antes';
  end if;

  if exists (select 1 from public.checklist_fotos
             where posicao is null
                or posicao not in ('Frente','Traseira','Lateral Esq.','Lateral Dir.','Interna')) then
    raise exception 'checklist_fotos com posicao desconhecida — backfill de tipo_foto não decide';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'multas'
               and column_name = 'etapa' and data_type <> 'text') then
    raise exception 'multas.etapa já existe com outro tipo — abortando';
  end if;

  if to_regclass('public.multa_etapas') is not null
     and (select string_agg(column_name, ',' order by column_name)
          from information_schema.columns
          where table_schema = 'public' and table_name = 'multa_etapas')
         is distinct from 'canal,dados,em_nome_de,etapa,etapa_anterior,feito_em,feito_por,id,multa_id,observacao' then
    raise exception 'multa_etapas já existe com colunas diferentes do arquivo — abortando';
  end if;

  if to_regclass('public.checklist_avarias') is not null
     and (select string_agg(column_name, ',' order by column_name)
          from information_schema.columns
          where table_schema = 'public' and table_name = 'checklist_avarias')
         is distinct from 'acao,avaria_origem_id,checklist_id,created_at,descricao,id,peca,reparada_em,reparada_por,status,tamanho' then
    raise exception 'checklist_avarias já existe com colunas diferentes do arquivo — abortando';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname in ('authenticated read checklist', 'authenticated upload checklist',
                           'authenticated read anexos', 'authenticated upload anexos')) <> 4 then
    raise exception 'policies de storage do Sofia diferentes do esperado (4) — abortando';
  end if;

  if exists (select 1 from pg_policies
             where schemaname = 'storage' and tablename = 'objects'
               and cmd in ('UPDATE', 'DELETE', 'ALL')
               and coalesce(qual, '') || coalesce(with_check, '') ~ '(checklist-fotos|sofia-anexos)') then
    raise exception 'existe policy UPDATE/DELETE/ALL nos buckets do Sofia — fotos não seriam imutáveis; abortando';
  end if;
end;
$$;

-- ============================================================
-- 1. MULTAS: colunas novas (sem default em etapa até o backfill)
-- ============================================================
alter table public.multas
  add column if not exists etapa text,
  add column if not exists locadora text,
  add column if not exists auto_infracao text,
  add column if not exists orgao_autuador text,
  add column if not exists pontos integer,
  add column if not exists prazo_indicacao date,
  add column if not exists motorista_condutor_id uuid references public.motoristas(id),
  add column if not exists indicado_em date,
  add column if not exists protocolo_indicacao text,
  add column if not exists boleto_lancado_em date,
  add column if not exists pago_em_dobro boolean not null default false,
  add column if not exists responsavel_dobro text,
  add column if not exists desconto_competencia date;

-- Backfill só das colunas novas, ANTES da trigger nova existir.
-- (trg_bloquear_autorizacao_multas não barra: status/autorização/valor não mudam.)
update public.multas set etapa = case
    when status = 'descontada' then 'descontada'
    when autorizacao_status = 'autorizado' then 'autorizado'
    when autorizacao_status = 'solicitado' then 'solicitado'
    when status = 'validada' then 'validada'
    else 'registrada'
  end
where etapa is null;

update public.multas set prazo_indicacao = data_recebimento + 30
where prazo_indicacao is null and data_recebimento is not null;

alter table public.multas alter column etapa set default 'registrada';
alter table public.multas alter column etapa set not null;

alter table public.multas drop constraint if exists multas_etapa_check;
alter table public.multas add constraint multas_etapa_check check (etapa in
  ('registrada','condutor','termo','indicado','validada','contestada','cobrada','solicitado','autorizado','descontada'));
alter table public.multas drop constraint if exists multas_pontos_check;
alter table public.multas add constraint multas_pontos_check check (pontos is null or pontos >= 0);
alter table public.multas drop constraint if exists multas_dobro_coerente;
alter table public.multas add constraint multas_dobro_coerente check (
  (pago_em_dobro and responsavel_dobro in ('empresa','motorista'))
  or (not pago_em_dobro and responsavel_dobro is null));
alter table public.multas drop constraint if exists multas_competencia_dia1;
alter table public.multas add constraint multas_competencia_dia1 check (
  desconto_competencia is null or extract(day from desconto_competencia) = 1);

-- ============================================================
-- 2. FUNÇÕES PURAS DA ETAPA
-- ============================================================
create or replace function public.sofia_multa_etapa_ordem(p text)
returns int language sql immutable set search_path = pg_catalog as $$
  select case p
    when 'registrada' then 0 when 'condutor' then 1 when 'termo' then 2 when 'indicado' then 3
    when 'validada' then 4 when 'contestada' then 4 when 'cobrada' then 5 when 'solicitado' then 6
    when 'autorizado' then 7 when 'descontada' then 8 end
$$;

create or replace function public.sofia_multa_status_da_etapa(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case
    when p in ('registrada','condutor','termo','indicado','contestada') then 'pendente'
    when p = 'descontada' then 'descontada'
    else 'validada' end
$$;

create or replace function public.sofia_multa_autorizacao_da_etapa(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case
    when p = 'solicitado' then 'solicitado'
    when p in ('autorizado','descontada') then 'autorizado'
    else 'sem_solicitacao' end
$$;

-- ============================================================
-- 3. TRIGGER DA ETAPA (autorização + dinheiro)
-- ============================================================
create or replace function public.sofia_multas_etapa_guarda()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gerir boolean := public.sofia_pode_gerir();
  v_admin boolean := public.sofia_is_admin();
  v_old int;
  v_new int;
begin
  if TG_OP = 'INSERT' then
    if new.etapa is distinct from 'registrada' then
      raise exception 'Multa nova sempre começa na etapa "registrada"';
    end if;
    if new.status is distinct from 'pendente'
       or new.autorizacao_status is distinct from 'sem_solicitacao' then
      raise exception 'Status e autorização da multa são derivados da etapa';
    end if;
    if new.motorista_condutor_id is not null or new.indicado_em is not null
       or new.protocolo_indicacao is not null or new.boleto_lancado_em is not null
       or new.pago_em_dobro is distinct from false or new.responsavel_dobro is not null
       or new.desconto_competencia is not null or new.valor_descontado is not null
       or new.tipo_desconto is distinct from 'nenhum'
       or new.autorizacao_solicitado_em is not null then
      raise exception 'Multa nova não pode nascer com dados de etapas posteriores';
    end if;
    return new;
  end if;

  -- ---------- UPDATE sem mudar a etapa ----------
  if new.etapa is not distinct from old.etapa then
    if new.status is distinct from old.status
       or new.autorizacao_status is distinct from old.autorizacao_status then
      raise exception 'Status e autorização da multa são derivados da etapa: registre a etapa';
    end if;
    if new.valor_descontado is distinct from old.valor_descontado
       or new.tipo_desconto is distinct from old.tipo_desconto
       or new.desconto_competencia is distinct from old.desconto_competencia then
      raise exception 'O desconto só muda ao registrar ou desfazer o desconto';
    end if;
    if (new.prazo_indicacao, new.motorista_condutor_id, new.motorista_id, new.indicado_em,
        new.protocolo_indicacao, new.boleto_lancado_em, new.pago_em_dobro, new.responsavel_dobro,
        new.autorizacao_storage_path, new.autorizacao_assinada, new.autorizacao_solicitado_em)
       is distinct from
       (old.prazo_indicacao, old.motorista_condutor_id, old.motorista_id, old.indicado_em,
        old.protocolo_indicacao, old.boleto_lancado_em, old.pago_em_dobro, old.responsavel_dobro,
        old.autorizacao_storage_path, old.autorizacao_assinada, old.autorizacao_solicitado_em)
       and v_gerir is not true then
      raise exception 'Apenas administradores ou gestores de frotas podem alterar o processo da multa';
    end if;
    return new;
  end if;

  -- ---------- UPDATE mudando a etapa ----------
  if v_gerir is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem avançar a etapa da multa';
  end if;

  v_old := public.sofia_multa_etapa_ordem(old.etapa);
  v_new := public.sofia_multa_etapa_ordem(new.etapa);

  if new.etapa = 'autorizado' and old.etapa = 'solicitado' then
    if v_admin is not true then
      raise exception 'Só o administrador autoriza desconto de multa';
    end if;
  elsif new.etapa = 'solicitado' and old.etapa = 'autorizado' then
    if v_admin is not true then
      raise exception 'Só o administrador revoga a autorização de desconto';
    end if;
  elsif new.etapa = 'autorizado' and old.etapa = 'descontada' then
    if new.valor_descontado is not null or new.desconto_competencia is not null
       or new.tipo_desconto is distinct from 'nenhum' then
      raise exception 'Ao desfazer o desconto, valor, tipo e competência voltam a vazio';
    end if;
  elsif new.etapa = 'autorizado' then
    raise exception 'Desconto só pode ser autorizado depois de solicitado';
  elsif new.etapa = 'descontada' then
    if old.etapa is distinct from 'autorizado' then
      raise exception 'Desconto só pode ser registrado depois de autorizado pelo administrador';
    end if;
    if new.valor_descontado is null or new.valor_descontado < 0 or new.valor_descontado > new.valor then
      raise exception 'Valor descontado inválido (entre 0 e o valor da multa)';
    end if;
    if new.tipo_desconto not in ('total','parcial') or new.desconto_competencia is null then
      raise exception 'Informe o tipo de desconto e a competência';
    end if;
  elsif new.etapa = 'cobrada' and old.etapa = 'solicitado' then
    null; -- cancelar solicitação
  elsif new.etapa = 'contestada' then
    if old.etapa not in ('registrada','condutor','termo','indicado') then
      raise exception 'A multa só pode ser contestada antes da validação';
    end if;
  elsif old.etapa in ('contestada','autorizado','descontada') then
    raise exception 'Transição de etapa não permitida: % → %', old.etapa, new.etapa;
  elsif v_new is null or v_old is null or v_new <= v_old then
    raise exception 'A etapa da multa só avança: % → % não é permitido', old.etapa, new.etapa;
  end if;

  -- o trio do desconto só muda entrando ou saindo de "descontada"
  if new.etapa <> 'descontada' and old.etapa <> 'descontada'
     and (new.valor_descontado is distinct from old.valor_descontado
          or new.tipo_desconto is distinct from old.tipo_desconto
          or new.desconto_competencia is distinct from old.desconto_competencia) then
    raise exception 'O desconto só muda ao registrar ou desfazer o desconto';
  end if;

  new.status := public.sofia_multa_status_da_etapa(new.etapa);
  new.autorizacao_status := public.sofia_multa_autorizacao_da_etapa(new.etapa);
  return new;
end;
$$;

drop trigger if exists trg_multas_etapa on public.multas;
create trigger trg_multas_etapa
  before insert or update on public.multas
  for each row execute function public.sofia_multas_etapa_guarda();

-- ============================================================
-- 4. multa_etapas (só inserção)
-- ============================================================
create table if not exists public.multa_etapas (
  id uuid primary key default gen_random_uuid(),
  multa_id uuid not null references public.multas(id) on delete cascade,
  etapa text not null constraint multa_etapas_etapa_check check (etapa in
    ('registrada','condutor','termo','indicado','validada','contestada','cobrada','solicitado','autorizado','descontada')),
  etapa_anterior text,
  feito_em timestamptz not null default now(),
  feito_por text not null constraint multa_etapas_feito_por_normalizado
    check (feito_por = lower(trim(feito_por)) and feito_por <> ''),
  em_nome_de text,
  canal text constraint multa_etapas_canal_check
    check (canal is null or canal in ('email','whatsapp','telefone','presencial')),
  observacao text,
  dados jsonb not null default '{}'::jsonb
);
create index if not exists multa_etapas_multa_idx on public.multa_etapas (multa_id, feito_em);

alter table public.multa_etapas enable row level security;
drop policy if exists multa_etapas_ler on public.multa_etapas;
create policy multa_etapas_ler on public.multa_etapas
  for select to authenticated using ((select public.sofia_has_access()));
drop policy if exists multa_etapas_gravar on public.multa_etapas;
create policy multa_etapas_gravar on public.multa_etapas
  for insert to authenticated
  with check ((select public.sofia_pode_gerir())
              and feito_por = lower(trim((select auth.jwt()) ->> 'email')));
revoke all on public.multa_etapas from anon;
revoke update, delete, truncate on public.multa_etapas from authenticated;

-- ============================================================
-- 5. RPC sofia_multa_registrar_etapa (security INVOKER)
-- ============================================================
create or replace function public.sofia_multa_registrar_etapa(
  p_multa_id uuid, p_etapa text, p_dados jsonb default '{}'::jsonb)
returns text
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_m       public.multas%rowtype;
  v_email   text := lower(trim(auth.jwt() ->> 'email'));
  v_em_nome text := nullif(trim(coalesce(p_dados ->> 'em_nome_de', '')), '');
  v_canal   text := nullif(trim(coalesce(p_dados ->> 'canal', '')), '');
  v_obs     text := nullif(trim(coalesce(p_dados ->> 'observacao', '')), '');
  v_dados   jsonb := coalesce(p_dados, '{}'::jsonb);
  v_path    text;
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem registrar etapas de multa';
  end if;
  if v_email is null or v_email = '' then
    raise exception 'Sessão sem e-mail';
  end if;

  select * into v_m from public.multas where id = p_multa_id for update;
  if not found then
    raise exception 'Multa não encontrada';
  end if;

  if (p_etapa = 'autorizado' and v_m.etapa = 'solicitado')
     or (p_etapa = 'solicitado' and v_m.etapa = 'autorizado') then
    if public.sofia_is_admin() is not true then
      raise exception 'Só o administrador autoriza ou revoga desconto de multa';
    end if;
  end if;

  case p_etapa
    when 'condutor' then
      if nullif(v_dados ->> 'motorista_id', '') is null then
        raise exception 'Informe o condutor';
      end if;
      v_dados := v_dados || jsonb_build_object('motorista_anterior', v_m.motorista_id);
      update public.multas
         set etapa = 'condutor',
             motorista_condutor_id = (v_dados ->> 'motorista_id')::uuid,
             motorista_id = (v_dados ->> 'motorista_id')::uuid
       where id = p_multa_id;
    when 'termo' then
      v_path := nullif(v_dados ->> 'storage_path', '');
      if v_path is null or v_path not like 'multas/' || p_multa_id::text || '/%' then
        raise exception 'Anexe o termo assinado';
      end if;
      update public.multas
         set etapa = 'termo', autorizacao_storage_path = v_path, autorizacao_assinada = true
       where id = p_multa_id;
    when 'indicado' then
      if nullif(v_dados ->> 'indicado_em', '') is null then
        raise exception 'Informe a data da indicação';
      end if;
      update public.multas
         set etapa = 'indicado',
             indicado_em = (v_dados ->> 'indicado_em')::date,
             protocolo_indicacao = nullif(trim(coalesce(v_dados ->> 'protocolo', '')), '')
       where id = p_multa_id;
    when 'validada' then
      if v_em_nome is null or v_canal is null then
        raise exception 'Informe em nome de quem e por qual canal';
      end if;
      update public.multas set etapa = 'validada' where id = p_multa_id;
    when 'contestada' then
      if v_em_nome is null or v_canal is null or v_obs is null then
        raise exception 'Informe em nome de quem, o canal e o motivo da contestação';
      end if;
      update public.multas set etapa = 'contestada' where id = p_multa_id;
    when 'cobrada' then
      if v_m.etapa = 'solicitado' then
        update public.multas set etapa = 'cobrada', autorizacao_solicitado_em = null where id = p_multa_id;
      else
        if nullif(v_dados ->> 'boleto_lancado_em', '') is null then
          raise exception 'Informe a data em que o boleto foi lançado';
        end if;
        update public.multas
           set etapa = 'cobrada', boleto_lancado_em = (v_dados ->> 'boleto_lancado_em')::date
         where id = p_multa_id;
      end if;
    when 'solicitado' then
      update public.multas
         set etapa = 'solicitado',
             autorizacao_solicitado_em = case when v_m.etapa = 'autorizado'
                                              then v_m.autorizacao_solicitado_em else now() end
       where id = p_multa_id;
    when 'autorizado' then
      if v_m.etapa = 'descontada' then
        update public.multas
           set etapa = 'autorizado', valor_descontado = null, tipo_desconto = 'nenhum',
               desconto_competencia = null
         where id = p_multa_id;
      else
        update public.multas set etapa = 'autorizado' where id = p_multa_id;
      end if;
    when 'descontada' then
      if nullif(v_dados ->> 'valor_descontado', '') is null
         or nullif(v_dados ->> 'tipo_desconto', '') is null
         or nullif(v_dados ->> 'competencia', '') is null then
        raise exception 'Informe valor, tipo de desconto e competência';
      end if;
      update public.multas
         set etapa = 'descontada',
             valor_descontado = (v_dados ->> 'valor_descontado')::numeric,
             tipo_desconto = v_dados ->> 'tipo_desconto',
             desconto_competencia = date_trunc('month', (v_dados ->> 'competencia')::date)::date
       where id = p_multa_id;
    else
      raise exception 'Etapa desconhecida: %', p_etapa;
  end case;

  insert into public.multa_etapas (multa_id, etapa, etapa_anterior, feito_por, em_nome_de, canal, observacao, dados)
  values (p_multa_id, p_etapa, v_m.etapa, v_email, v_em_nome, v_canal, v_obs, v_dados);

  return p_etapa;
end;
$$;

revoke all on function public.sofia_multa_registrar_etapa(uuid, text, jsonb) from public, anon;
grant execute on function public.sofia_multa_registrar_etapa(uuid, text, jsonb) to authenticated;

-- ============================================================
-- 6. checklist_avarias
-- ============================================================
create table if not exists public.checklist_avarias (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklist(id),
  peca text not null constraint checklist_avarias_peca_nao_vazia check (btrim(peca) <> ''),
  tamanho text not null constraint checklist_avarias_tamanho_check check (tamanho in ('pequena','media','grande')),
  acao text constraint checklist_avarias_acao_check check (acao is null or acao in ('reparo','troca')),
  descricao text,
  status text not null default 'aberta' constraint checklist_avarias_status_check check (status in ('aberta','reparada')),
  reparada_em timestamptz,
  reparada_por text,
  avaria_origem_id uuid references public.checklist_avarias(id),
  created_at timestamptz not null default now(),
  constraint checklist_avarias_reparo_coerente check (
    (status = 'aberta' and reparada_em is null and reparada_por is null)
    or (status = 'reparada' and reparada_em is not null and reparada_por is not null))
);
create index if not exists checklist_avarias_checklist_idx on public.checklist_avarias (checklist_id);

alter table public.checklist_avarias enable row level security;
drop policy if exists checklist_avarias_ler on public.checklist_avarias;
create policy checklist_avarias_ler on public.checklist_avarias
  for select to authenticated using ((select public.sofia_has_access()));
drop policy if exists checklist_avarias_inserir on public.checklist_avarias;
create policy checklist_avarias_inserir on public.checklist_avarias
  for insert to authenticated with check ((select public.sofia_has_access()));
drop policy if exists checklist_avarias_baixa on public.checklist_avarias;
create policy checklist_avarias_baixa on public.checklist_avarias
  for update to authenticated
  using ((select public.sofia_pode_gerir())) with check ((select public.sofia_pode_gerir()));
revoke all on public.checklist_avarias from anon;
revoke delete, truncate on public.checklist_avarias from authenticated;

create or replace function public.sofia_checklist_avarias_guarda()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Avaria registrada não pode ser apagada';
  end if;
  if TG_OP = 'INSERT' then
    if new.status is distinct from 'aberta' then
      raise exception 'Avaria nova sempre nasce aberta';
    end if;
    return new;
  end if;
  -- UPDATE
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem alterar uma avaria';
  end if;
  if (new.checklist_id, new.peca, new.tamanho, new.descricao, new.avaria_origem_id, new.created_at)
     is distinct from
     (old.checklist_id, old.peca, old.tamanho, old.descricao, old.avaria_origem_id, old.created_at) then
    raise exception 'Da avaria só mudam reparo/troca e a baixa';
  end if;
  if old.status = 'reparada' and new.status is distinct from 'reparada' then
    raise exception 'Avaria reparada não volta a aberta';
  end if;
  if old.status = 'aberta' and new.status = 'reparada' then
    new.reparada_por := lower(trim(auth.jwt() ->> 'email'));
    new.reparada_em := coalesce(new.reparada_em, now());
    if new.reparada_por is null or new.reparada_por = '' then
      raise exception 'Sessão sem e-mail';
    end if;
    if new.reparada_em > now() then
      raise exception 'Data do reparo no futuro';
    end if;
  elsif new.reparada_em is distinct from old.reparada_em
        or new.reparada_por is distinct from old.reparada_por then
    raise exception 'Baixa da avaria não pode ser alterada';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_checklist_avarias_guarda on public.checklist_avarias;
create trigger trg_checklist_avarias_guarda
  before insert or update or delete on public.checklist_avarias
  for each row execute function public.sofia_checklist_avarias_guarda();

-- ============================================================
-- 7. checklist_fotos: avaria_id + tipo_foto (backfill ANTES da trigger)
-- ============================================================
alter table public.checklist_fotos
  add column if not exists avaria_id uuid references public.checklist_avarias(id),
  add column if not exists tipo_foto text;

update public.checklist_fotos
   set tipo_foto = case when posicao = 'Interna' then 'interna' else 'obrigatoria' end
 where tipo_foto is null;

alter table public.checklist_fotos alter column tipo_foto set default 'obrigatoria';
alter table public.checklist_fotos alter column tipo_foto set not null;
alter table public.checklist_fotos drop constraint if exists checklist_fotos_tipo_check;
alter table public.checklist_fotos add constraint checklist_fotos_tipo_check
  check (tipo_foto in ('obrigatoria','interna','extra','avaria_peca','avaria_dano'));
alter table public.checklist_fotos drop constraint if exists checklist_fotos_avaria_coerente;
alter table public.checklist_fotos add constraint checklist_fotos_avaria_coerente
  check ((tipo_foto in ('avaria_peca','avaria_dano')) = (avaria_id is not null));

create index if not exists checklist_veiculo_data_idx on public.checklist (veiculo_id, data desc);

-- ============================================================
-- 8. FOTOS IMUTÁVEIS (qualquer role, inclusive cascata)
-- ============================================================
create or replace function public.sofia_fotos_imutaveis()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if TG_OP in ('UPDATE', 'DELETE') then
    raise exception 'Foto salva é prova e não pode ser alterada nem apagada';
  end if;
  -- INSERT
  if TG_TABLE_NAME = 'checklist_fotos' then
    if new.avaria_id is not null then
      if not exists (select 1 from public.checklist_avarias a
                     where a.id = new.avaria_id and a.checklist_id = new.checklist_id) then
        raise exception 'A avaria da foto não pertence a este checklist';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fotos_imutaveis on public.checklist_fotos;
create trigger trg_fotos_imutaveis
  before insert or update or delete on public.checklist_fotos
  for each row execute function public.sofia_fotos_imutaveis();
drop trigger if exists trg_fotos_imutaveis on public.sinistro_fotos;
create trigger trg_fotos_imutaveis
  before update or delete on public.sinistro_fotos
  for each row execute function public.sofia_fotos_imutaveis();

revoke update, delete, truncate on public.checklist_fotos from anon, authenticated;
revoke update, delete, truncate on public.sinistro_fotos from anon, authenticated;

-- ============================================================
-- 9. STORAGE: leitura e upload só para quem tem o Sofia
-- ============================================================
alter policy "authenticated read checklist" on storage.objects
  using (bucket_id = 'checklist-fotos' and (select public.sofia_has_access()));
alter policy "authenticated upload checklist" on storage.objects
  with check (bucket_id = 'checklist-fotos' and (select public.sofia_has_access()));
alter policy "authenticated read anexos" on storage.objects
  using (bucket_id = 'sofia-anexos' and (select public.sofia_has_access()));
alter policy "authenticated upload anexos" on storage.objects
  with check (bucket_id = 'sofia-anexos' and (select public.sofia_has_access()));

commit;

-- ============================================================
-- VERIFICAÇÃO (rodar depois do commit; qualquer FALHOU = parar, não deployar)
-- ============================================================
select * from (values
  ('v01 multas.etapa not null + default registrada',
   (select case when is_nullable = 'NO' and column_default like '%registrada%' then 'OK' else '*** FALHOU ***' end
      from information_schema.columns where table_schema='public' and table_name='multas' and column_name='etapa')),
  ('v02 13 colunas novas em multas',
   (select case when count(*) = 13 then 'OK' else '*** FALHOU *** ' || count(*) end
      from information_schema.columns where table_schema='public' and table_name='multas'
       and column_name in ('etapa','locadora','auto_infracao','orgao_autuador','pontos','prazo_indicacao',
         'motorista_condutor_id','indicado_em','protocolo_indicacao','boleto_lancado_em','pago_em_dobro',
         'responsavel_dobro','desconto_competencia'))),
  ('v03 nenhuma multa sem etapa',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU *** ' || count(*) end from public.multas where etapa is null)),
  ('v04 AVISO legado: status/autorização ≠ derivado (esperado 2 em 03/11)',
   (select 'AVISO ' || count(*) from public.multas
     where status is distinct from public.sofia_multa_status_da_etapa(etapa)
        or autorizacao_status is distinct from public.sofia_multa_autorizacao_da_etapa(etapa))),
  ('v05 trg_multas_etapa habilitado e ligado',
   (select case when count(*) = 1 then 'OK' else '*** FALHOU ***' end from pg_trigger t join pg_proc p on p.oid=t.tgfoid
     where t.tgname='trg_multas_etapa' and t.tgrelid='public.multas'::regclass and t.tgenabled <> 'D'
       and p.proname='sofia_multas_etapa_guarda')),
  ('v06 trg_bloquear_autorizacao_multas intacto e habilitado',
   (select case when count(*) = 1 then 'OK' else '*** FALHOU ***' end from pg_trigger
     where tgname='trg_bloquear_autorizacao_multas' and tgrelid='public.multas'::regclass and tgenabled <> 'D')),
  ('v07 guarda da trigger usa is not true (nunca "if not")',
   (select case when prosrc like '%v_gerir is not true%' and prosrc like '%v_admin is not true%'
                 and prosrc not like '%if not v_%' then 'OK' else '*** FALHOU ***' end
      from pg_proc where oid = to_regprocedure('public.sofia_multas_etapa_guarda()'))),
  ('v08 RPC security invoker + guardas is not true',
   (select case when not prosecdef and prosrc like '%sofia_pode_gerir() is not true%'
                 and prosrc like '%sofia_is_admin() is not true%' then 'OK' else '*** FALHOU ***' end
      from pg_proc where oid = to_regprocedure('public.sofia_multa_registrar_etapa(uuid,text,jsonb)'))),
  ('v09 RPC sem execute para anon',
   (select case when not has_function_privilege('anon','public.sofia_multa_registrar_etapa(uuid,text,jsonb)','execute')
                 and has_function_privilege('authenticated','public.sofia_multa_registrar_etapa(uuid,text,jsonb)','execute')
            then 'OK' else '*** FALHOU ***' end)),
  ('v10 multa_etapas: RLS on, 2 policies (select/insert)',
   (select case when (select relrowsecurity from pg_class where oid='public.multa_etapas'::regclass)
                 and count(*) = 2 and bool_and(cmd in ('SELECT','INSERT')) then 'OK' else '*** FALHOU ***' end
      from pg_policies where schemaname='public' and tablename='multa_etapas')),
  ('v11 multa_etapas sem UPDATE/DELETE para authenticated e nada para anon',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU *** ' || string_agg(grantee||':'||privilege_type, ',') end
      from information_schema.role_table_grants where table_schema='public' and table_name='multa_etapas'
       and ((grantee='authenticated' and privilege_type in ('UPDATE','DELETE','TRUNCATE')) or grantee='anon'))),
  ('v12 checklist_avarias: RLS on, 3 policies, trigger habilitado',
   (select case when (select relrowsecurity from pg_class where oid='public.checklist_avarias'::regclass)
                 and (select count(*) from pg_policies where schemaname='public' and tablename='checklist_avarias') = 3
                 and exists (select 1 from pg_trigger where tgname='trg_checklist_avarias_guarda'
                             and tgrelid='public.checklist_avarias'::regclass and tgenabled <> 'D')
            then 'OK' else '*** FALHOU ***' end)),
  ('v13 checklist_avarias sem DELETE para authenticated e nada para anon',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU ***' end
      from information_schema.role_table_grants where table_schema='public' and table_name='checklist_avarias'
       and ((grantee='authenticated' and privilege_type in ('DELETE','TRUNCATE')) or grantee='anon'))),
  ('v14 checklist_fotos.tipo_foto preenchido (backfill)',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU ***' end from public.checklist_fotos where tipo_foto is null)),
  ('v15 trg_fotos_imutaveis nas 2 tabelas, habilitado',
   (select case when count(*) = 2 then 'OK' else '*** FALHOU *** ' || count(*) end from pg_trigger
     where tgname='trg_fotos_imutaveis' and tgenabled <> 'D'
       and tgrelid in ('public.checklist_fotos'::regclass, 'public.sinistro_fotos'::regclass))),
  ('v16 fotos sem UPDATE/DELETE para anon/authenticated',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU *** ' || string_agg(table_name||'.'||grantee||':'||privilege_type, ',') end
      from information_schema.role_table_grants where table_schema='public'
       and table_name in ('checklist_fotos','sinistro_fotos') and grantee in ('anon','authenticated')
       and privilege_type in ('UPDATE','DELETE','TRUNCATE'))),
  ('v17 storage: 4 policies do Sofia exigem sofia_has_access',
   (select case when count(*) = 4 then 'OK' else '*** FALHOU *** ' || count(*) end from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname in ('authenticated read checklist','authenticated upload checklist',
                          'authenticated read anexos','authenticated upload anexos')
       and coalesce(qual,'') || coalesce(with_check,'') like '%sofia_has_access%')),
  ('v18 storage: nenhuma policy UPDATE/DELETE/ALL nos buckets do Sofia',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU ***' end from pg_policies
     where schemaname='storage' and tablename='objects' and cmd in ('UPDATE','DELETE','ALL')
       and coalesce(qual,'') || coalesce(with_check,'') ~ '(checklist-fotos|sofia-anexos)')),
  ('v19 índice checklist (veiculo_id, data desc)',
   (select case when count(*) = 1 then 'OK' else '*** FALHOU ***' end from pg_indexes
     where schemaname='public' and indexname='checklist_veiculo_data_idx')),
  ('v20 policies sofia access das 5 tabelas inalteradas',
   (select case when count(*) = 5 then 'OK' else '*** FALHOU *** ' || count(*) end from pg_policies
     where schemaname='public' and policyname='sofia access'
       and tablename in ('multas','checklist','checklist_fotos','sinistros','sinistro_fotos')))
) as v(invariante, resultado);
-- Esperado: 19 linhas OK + v04 "AVISO 2" (ou o número medido na hora — anotar).

-- ============================================================
-- ROLLBACK (só depois de reverter o app; NÃO apaga dado de multa)
-- ============================================================
-- begin;
-- alter policy "authenticated read checklist"   on storage.objects using (bucket_id = 'checklist-fotos');
-- alter policy "authenticated upload checklist" on storage.objects with check (bucket_id = 'checklist-fotos');
-- alter policy "authenticated read anexos"      on storage.objects using (bucket_id = 'sofia-anexos');
-- alter policy "authenticated upload anexos"    on storage.objects with check (bucket_id = 'sofia-anexos');
-- drop trigger if exists trg_fotos_imutaveis on public.checklist_fotos;
-- drop trigger if exists trg_fotos_imutaveis on public.sinistro_fotos;
-- drop function if exists public.sofia_fotos_imutaveis();
-- grant update, delete on public.checklist_fotos, public.sinistro_fotos to authenticated;
-- drop trigger if exists trg_multas_etapa on public.multas;
-- drop function if exists public.sofia_multas_etapa_guarda();
-- drop function if exists public.sofia_multa_registrar_etapa(uuid, text, jsonb);
-- -- colunas, multa_etapas e checklist_avarias FICAM (guardam o que foi registrado); dropar só com export antes.
-- commit;
