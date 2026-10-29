-- ============================================================
-- Controle de Obras — modalidade OBRA (fase 1) — 2026-10-29
-- Spec: docs/superpowers/specs/2026-10-29-obras-modalidade-obra-design.md
-- Seed: docs/cliente/2026-10-29-sgo-especificacao-eduardo.md (§10.1, §10.5)
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar (AGENTS.md).
--
-- IDEMPOTENTE: add column if not exists, create table if not exists,
-- drop policy/trigger if exists antes de recriar, seed com on conflict do
-- nothing / guardas de estado. Rodar duas vezes não erra nem duplica linha.
-- (Limite conhecido: `create table if not exists` não altera tabela que já
-- exista com outra forma — ver sdd-sql-obras-historico.sql.)
--
-- O que faz:
--   1. obras_obra ganha modalidade ('spot' | 'obra'), data_base,
--      engenheiro_email, atividade_trava.
--   2. Tabelas novas: obras_feriado, obras_cronograma_versao, obras_atividade,
--      obras_atividade_exec, obras_rdo, obras_rdo_avanco, obras_rdo_foto,
--      obras_impedimento, obras_destinatario, obras_envio.
--   3. Triggers de imutabilidade: versão salva (salva_em não nulo) não muda,
--      nem as atividades dela.
--   4. RLS em todas as tabelas novas.
--   5. obras_historico aceita bloco 'Classificação' e campo 'modalidade'.
--   6. Seed: feriados, Macaé 3 (versão 1 rascunho + 28 atividades + execução),
--      classificação das obras grandes como 'obra' (+ histórico).
--
-- O bucket obras-fotos NÃO precisa de mudança: as policies de storage
-- (sdd-sql-obras-v0.sql, seção 7) só checam bucket_id + obras_has_access(),
-- não o formato do caminho — {obra_id}/rdo/{data}/{uuid}.jpg passa.
-- A sync do Field nunca grava `modalidade` (coluna fora do upsert).
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (aborta a transação se faltar algum)
-- ============================================================
do $$
begin
  if to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null then
    raise exception 'Pré-requisito ausente: obras_has_access()/obras_is_admin() (sdd-sql-obras-v0.sql).';
  end if;
  if to_regclass('public.obras_historico') is null then
    raise exception 'Pré-requisito ausente: obras_historico (sdd-sql-obras-historico.sql).';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.obras_historico'::regclass
                  and conname = 'obras_historico_campo_check')
     or not exists (select 1 from pg_constraint where conrelid = 'public.obras_historico'::regclass
                  and conname = 'obras_historico_bloco_check') then
    raise exception 'Pré-requisito ausente: checks de obras_historico (sdd-sql-obras-historico.sql).';
  end if;
end
$$;

-- ============================================================
-- 1. obras_obra — colunas novas
-- ============================================================
alter table public.obras_obra
  add column if not exists modalidade text not null default 'spot'
    check (modalidade in ('spot','obra'));
alter table public.obras_obra add column if not exists data_base date;
alter table public.obras_obra add column if not exists engenheiro_email text;
alter table public.obras_obra add column if not exists atividade_trava int;

create index if not exists obras_obra_modalidade_obra_idx
  on public.obras_obra (id) where modalidade = 'obra';

-- ============================================================
-- 2. Tabelas
-- ============================================================
create table if not exists public.obras_feriado (
  data date primary key,
  descricao text not null,
  abrangencia text not null
    check (abrangencia in ('nacional','estadual','municipal','facultativo'))
);

-- Versão 1 = base. salva_em nulo = rascunho editável; vigente = maior
-- numero com salva_em não nulo.
create table if not exists public.obras_cronograma_versao (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  numero int not null,
  motivo text,
  criada_por text not null,
  criada_em timestamptz not null default now(),
  salva_em timestamptz,
  salva_por text,
  unique (obra_id, numero)
);

create table if not exists public.obras_atividade (
  id uuid primary key default gen_random_uuid(),
  versao_id uuid not null references public.obras_cronograma_versao(id) on delete cascade,
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  numero int not null,
  frente text,
  etapa text,
  descricao text,
  saida_trava text,
  pred1 int,
  pred2 int,
  duracao int not null check (duracao >= 1),
  responsavel_funcao text,
  bloqueia_por_trava boolean not null default false,
  peso_valor numeric(14,2) not null default 0,
  unique (versao_id, numero)
);
create index if not exists obras_atividade_obra_idx on public.obras_atividade (obra_id);

-- Execução é da obra, não da versão.
create table if not exists public.obras_atividade_exec (
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  numero int not null,
  status text not null default 'nao_iniciado'
    check (status in ('nao_iniciado','em_andamento','concluido','bloqueado')),
  percentual numeric(5,4) not null default 0 check (percentual between 0 and 1),
  inicio_real date,
  fim_real date,
  atualizado_em timestamptz,
  atualizado_por text,
  primary key (obra_id, numero)
);

create table if not exists public.obras_rdo (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  data date not null,
  estado text not null default 'rascunho'
    check (estado in ('rascunho','validado','enviado')),
  sem_execucao boolean not null default false,
  motivo_sem_execucao text,
  efetivo int,
  equipe_texto text,
  clima text check (clima in ('sol','nublado','chuva','impraticavel')),
  programacao_amanha text,
  registrado_por text,
  atualizado_em timestamptz,
  validado_por text,
  validado_em timestamptz,
  unique (obra_id, data)
);

create table if not exists public.obras_rdo_avanco (
  rdo_id uuid not null references public.obras_rdo(id) on delete cascade,
  numero int not null,
  de numeric(5,4) check (de between 0 and 1),
  para numeric(5,4) check (para between 0 and 1),
  concluida boolean not null default false,
  causa text check (causa in ('cliente','material','equipe','clima','projeto','outro')),
  primary key (rdo_id, numero)
);

create table if not exists public.obras_rdo_foto (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid not null references public.obras_rdo(id) on delete cascade,
  path text not null,
  legenda text,
  ordem int
);
create index if not exists obras_rdo_foto_rdo_idx on public.obras_rdo_foto (rdo_id);

create table if not exists public.obras_impedimento (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  categoria text not null check (categoria in ('impedimento','orientacao')),
  tipo text,
  responsavel text check (responsavel in ('cliente','manfac','terceiro','clima')),
  atividade_numero int,
  descricao text not null,
  pessoa_cliente text,
  foto_path text,
  trava_atividade boolean not null default false,
  impacto_dias numeric(5,1),
  exibir_ao_cliente boolean not null,
  aberto_em date not null,
  encerrado_em date,
  rdo_id uuid references public.obras_rdo(id) on delete set null,
  orientacao_id uuid references public.obras_impedimento(id) on delete set null,
  criado_por text,
  criado_em timestamptz not null default now(),
  constraint obras_impedimento_responsavel_obrig
    check (categoria <> 'impedimento' or responsavel is not null)
);
create index if not exists obras_impedimento_obra_idx
  on public.obras_impedimento (obra_id, aberto_em desc);

create table if not exists public.obras_destinatario (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  email text not null,
  nome text,
  funcao text,
  lado text check (lado in ('cliente','interno')),
  tipos text[] not null
    check (tipos <@ array['diario','semanal','mensal','imediato']::text[]),
  ativo boolean not null default true
);
-- unique com expressão: só índice, não constraint de tabela.
create unique index if not exists obras_destinatario_obra_email_uniq
  on public.obras_destinatario (obra_id, lower(email));

create table if not exists public.obras_envio (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  tipo text,
  referencia date,
  rdo_id uuid references public.obras_rdo(id) on delete set null,
  lado text,
  enviado_por text,
  enviado_em timestamptz not null default now(),
  destinatarios text[],
  resultado text check (resultado in ('ok','falha')),
  detalhe text
);
create index if not exists obras_envio_obra_idx on public.obras_envio (obra_id, enviado_em desc);

-- ============================================================
-- 3. Imutabilidade da versão salva
-- security definer + search_path fixo: a checagem lê a versão por cima da
-- RLS, para nunca falhar aberto se o chamador não enxergar a linha.
-- ============================================================
create or replace function public.obras_atividade_imutavel()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ids uuid[];
begin
  if tg_op = 'INSERT' then
    v_ids := array[new.versao_id];
  elsif tg_op = 'DELETE' then
    v_ids := array[old.versao_id];
  else
    v_ids := array[old.versao_id, new.versao_id];
  end if;

  if exists (
    select 1 from public.obras_cronograma_versao v
    where v.id = any(v_ids) and v.salva_em is not null
  ) then
    raise exception 'OBRAS_VERSAO_SALVA: versão de cronograma já salva não pode ser alterada'
      using errcode = 'P0001';
  end if;

  -- obra_id da atividade tem que ser o da versão dela.
  if tg_op <> 'DELETE' then
    if new.obra_id is distinct from
       (select v.obra_id from public.obras_cronograma_versao v where v.id = new.versao_id) then
      raise exception 'obras_atividade.obra_id difere do obra_id da versão'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_atividade_imutavel() from public, anon, authenticated;

drop trigger if exists obras_atividade_imutavel on public.obras_atividade;
create trigger obras_atividade_imutavel
  before insert or update or delete on public.obras_atividade
  for each row execute function public.obras_atividade_imutavel();

create or replace function public.obras_versao_imutavel()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.salva_em is not null then
    if tg_op = 'DELETE' then
      raise exception 'OBRAS_VERSAO_SALVA: versão de cronograma já salva não pode ser apagada'
        using errcode = 'P0001';
    end if;
    if row(new.*) is distinct from row(old.*) then
      raise exception 'OBRAS_VERSAO_SALVA: versão de cronograma já salva não pode ser alterada'
        using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'UPDATE' and (new.obra_id is distinct from old.obra_id
                           or new.numero is distinct from old.numero) then
    raise exception 'obras_cronograma_versao: obra_id e numero são imutáveis'
      using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_versao_imutavel() from public, anon, authenticated;

drop trigger if exists obras_versao_imutavel on public.obras_cronograma_versao;
create trigger obras_versao_imutavel
  before update or delete on public.obras_cronograma_versao
  for each row execute function public.obras_versao_imutavel();

-- ============================================================
-- 3b. Autoria não falsificável. Numa sessão de usuário (JWT com e-mail), as
-- colunas de autoria são sobrescritas com o e-mail da sessão. Sem JWT
-- (service role, SQL Editor, seed) o valor informado fica. Uma função por
-- tabela (sem trigger compartilhada — sql.md, armadilha 2).
-- ============================================================
create or replace function public.obras_envio_autor() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if v_email is not null then new.enviado_por := v_email; end if;
  return new;
end;
$$;

create or replace function public.obras_rdo_autor() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if v_email is not null then
    if tg_op = 'INSERT' then
      new.registrado_por := v_email;
    else
      new.registrado_por := old.registrado_por;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.obras_impedimento_autor() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if v_email is not null then
    if tg_op = 'INSERT' then new.criado_por := v_email; else new.criado_por := old.criado_por; end if;
  end if;
  return new;
end;
$$;

create or replace function public.obras_versao_autor() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if v_email is not null then
    if tg_op = 'INSERT' then
      new.criada_por := v_email;
      if new.salva_em is not null then new.salva_por := v_email; end if;
    else
      new.criada_por := old.criada_por;
      if new.salva_em is not null and (old.salva_em is null
                                       or new.salva_por is distinct from old.salva_por) then
        new.salva_por := v_email;
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.obras_atividade_exec_autor() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if v_email is not null then new.atualizado_por := v_email; end if;
  return new;
end;
$$;

revoke execute on function public.obras_envio_autor(), public.obras_rdo_autor(),
  public.obras_impedimento_autor(), public.obras_versao_autor(),
  public.obras_atividade_exec_autor() from public, anon, authenticated;

drop trigger if exists obras_envio_autor on public.obras_envio;
create trigger obras_envio_autor before insert or update on public.obras_envio
  for each row execute function public.obras_envio_autor();
drop trigger if exists obras_rdo_autor on public.obras_rdo;
create trigger obras_rdo_autor before insert or update on public.obras_rdo
  for each row execute function public.obras_rdo_autor();
drop trigger if exists obras_impedimento_autor on public.obras_impedimento;
create trigger obras_impedimento_autor before insert or update on public.obras_impedimento
  for each row execute function public.obras_impedimento_autor();
drop trigger if exists obras_versao_autor on public.obras_cronograma_versao;
create trigger obras_versao_autor before insert or update on public.obras_cronograma_versao
  for each row execute function public.obras_versao_autor();
drop trigger if exists obras_atividade_exec_autor on public.obras_atividade_exec;
create trigger obras_atividade_exec_autor before insert or update on public.obras_atividade_exec
  for each row execute function public.obras_atividade_exec_autor();

-- ============================================================
-- 3c. Máquina de estados do RDO (obras_rdo).
--   rascunho -> validado -> enviado; sem volta, sem pulo.
--   Fora de rascunho o conteúdo é imutável (só estado -> enviado e
--   atualizado_em mudam).
--   rascunho -> validado, numa sessão de usuário: só o engenheiro da obra
--   (obras_obra.engenheiro_email) ou administrador; validado_por := e-mail
--   da sessão e validado_em := now(). Sem JWT (service role) o validado_por
--   informado fica, validado_em := now() também.
--   validado_por/validado_em não mudam fora dessa transição.
--   Em INSERT, sessão de usuário só cria rascunho limpo.
-- security definer: lê engenheiro_email por cima da RLS (guarda fecha).
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
           new.efetivo, new.equipe_texto, new.clima, new.programacao_amanha,
           new.registrado_por, new.validado_por, new.validado_em)
       is distinct from
       row(old.id, old.obra_id, old.data, old.sem_execucao, old.motivo_sem_execucao,
           old.efetivo, old.equipe_texto, old.clima, old.programacao_amanha,
           old.registrado_por, old.validado_por, old.validado_em) then
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
-- 3d. Colunas de parâmetro da modalidade OBRA em obras_obra: a policy
-- "obras access" deixa qualquer usuário com acesso atualizar a linha, então
-- estas 4 colunas (engenheiro_email decide quem valida o RDO) só mudam por
-- administrador numa sessão de usuário (INSERT: usuário comum só cria SPOT
-- sem os parâmetros). Sem JWT (service role: sync do
-- Field, seed, SQL Editor) passa. O trigger só dispara quando uma dessas
-- colunas está no SET, então ficha/sync/RPC não são afetados.
-- ============================================================
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
            or new.modalidade is distinct from 'spot')
       and not public.obras_is_admin() then
      raise exception 'OBRAS_PARAMETROS: só administrador cria obra com modalidade, data base, engenheiro ou atividade-trava'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if nullif(lower(trim(auth.jwt() ->> 'email')), '') is not null
     and (new.modalidade is distinct from old.modalidade
          or new.data_base is distinct from old.data_base
          or new.engenheiro_email is distinct from old.engenheiro_email
          or new.atividade_trava is distinct from old.atividade_trava)
     and not public.obras_is_admin() then
    raise exception 'OBRAS_PARAMETROS: só administrador altera modalidade, data base, engenheiro e atividade-trava'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_obra_parametros_guarda() from public, anon, authenticated;

drop trigger if exists obras_obra_parametros_guarda on public.obras_obra;
create trigger obras_obra_parametros_guarda
  before insert or update of modalidade, data_base, engenheiro_email, atividade_trava on public.obras_obra
  for each row execute function public.obras_obra_parametros_guarda();

-- ============================================================
-- 4. RLS
-- ============================================================
-- select/insert/update com obras_has_access() nas tabelas operacionais.
do $$
declare
  t text;
begin
  foreach t in array array[
    'obras_cronograma_versao','obras_atividade',
    'obras_atividade_exec','obras_rdo','obras_impedimento'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "obras select" on public.%I', t);
    execute format('create policy "obras select" on public.%I for select to authenticated using ((select public.obras_has_access()))', t);

    execute format('drop policy if exists "obras insert" on public.%I', t);
    execute format('create policy "obras insert" on public.%I for insert to authenticated with check ((select public.obras_has_access()))', t);

    execute format('drop policy if exists "obras update" on public.%I', t);
    execute format('create policy "obras update" on public.%I for update to authenticated using ((select public.obras_has_access())) with check ((select public.obras_has_access()))', t);
  end loop;
end
$$;

-- Delete de atividade (o trigger barra versão salva). Impedimento, versão
-- e envio não têm delete.
-- Delete de RDO: só rascunho (avanço e foto saem junto, em cascata).
drop policy if exists "obras delete" on public.obras_rdo;
create policy "obras delete" on public.obras_rdo for delete to authenticated
  using ((select public.obras_has_access()) and estado = 'rascunho');
drop policy if exists "obras delete" on public.obras_atividade;
create policy "obras delete" on public.obras_atividade for delete to authenticated
  using ((select public.obras_has_access()));
-- Avanço e foto do RDO: só mexe enquanto o RDO pai é rascunho.
do $$
declare
  t text;
begin
  foreach t in array array['obras_rdo_avanco','obras_rdo_foto'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "obras select" on public.%I', t);
    execute format('create policy "obras select" on public.%I for select to authenticated using ((select public.obras_has_access()))', t);
    execute format('drop policy if exists "obras insert" on public.%I', t);
    execute format('create policy "obras insert" on public.%I for insert to authenticated with check ((select public.obras_has_access()) and exists (select 1 from public.obras_rdo r where r.id = rdo_id and r.estado = ''rascunho''))', t);
    execute format('drop policy if exists "obras update" on public.%I', t);
    execute format('create policy "obras update" on public.%I for update to authenticated using ((select public.obras_has_access()) and exists (select 1 from public.obras_rdo r where r.id = rdo_id and r.estado = ''rascunho'')) with check ((select public.obras_has_access()) and exists (select 1 from public.obras_rdo r where r.id = rdo_id and r.estado = ''rascunho''))', t);
    execute format('drop policy if exists "obras delete" on public.%I', t);
    execute format('create policy "obras delete" on public.%I for delete to authenticated using ((select public.obras_has_access()) and exists (select 1 from public.obras_rdo r where r.id = rdo_id and r.estado = ''rascunho''))', t);
  end loop;
end
$$;

-- Feriado: leitura com acesso; escrita só administrador.
alter table public.obras_feriado enable row level security;
drop policy if exists "obras select" on public.obras_feriado;
create policy "obras select" on public.obras_feriado for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_feriado;
create policy "obras insert" on public.obras_feriado for insert to authenticated
  with check ((select public.obras_is_admin()));
drop policy if exists "obras update" on public.obras_feriado;
create policy "obras update" on public.obras_feriado for update to authenticated
  using ((select public.obras_is_admin())) with check ((select public.obras_is_admin()));
drop policy if exists "obras delete" on public.obras_feriado;
create policy "obras delete" on public.obras_feriado for delete to authenticated
  using ((select public.obras_is_admin()));

-- Destinatário: leitura com acesso; escrita só administrador
-- (obras_is_admin() = exists em hub_user_roles, nivel 'administrador').
alter table public.obras_destinatario enable row level security;
drop policy if exists "obras select" on public.obras_destinatario;
create policy "obras select" on public.obras_destinatario for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_destinatario;
create policy "obras insert" on public.obras_destinatario for insert to authenticated
  with check ((select public.obras_is_admin()));
drop policy if exists "obras update" on public.obras_destinatario;
create policy "obras update" on public.obras_destinatario for update to authenticated
  using ((select public.obras_is_admin())) with check ((select public.obras_is_admin()));
drop policy if exists "obras delete" on public.obras_destinatario;
create policy "obras delete" on public.obras_destinatario for delete to authenticated
  using ((select public.obras_is_admin()));

-- Envio: só select e insert (log imutável).
alter table public.obras_envio enable row level security;
drop policy if exists "obras select" on public.obras_envio;
create policy "obras select" on public.obras_envio for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_envio;
create policy "obras insert" on public.obras_envio for insert to authenticated
  with check ((select public.obras_has_access()));

-- ============================================================
-- 5. obras_historico — aceitar o bloco/campo da classificação
-- Listas = estado atual (historico + cancelamento + agendamento-diario) mais
-- 'Classificação' / 'modalidade'.
-- ============================================================
alter table public.obras_historico drop constraint if exists obras_historico_bloco_check;
alter table public.obras_historico add constraint obras_historico_bloco_check
  check (bloco in ('Triagem','Autorização','Identificação','Cronograma','Esteira',
                   'Cancelamento','Agendamento','Classificação'));

alter table public.obras_historico drop constraint if exists obras_historico_campo_check;
alter table public.obras_historico add constraint obras_historico_campo_check
  check (campo in (
    'pcm','equipe','prioridade','inicio_plan','duracao',
    'liberado_por','liberado_em','os_aprovada_em',
    'tipo','valor','origem','analista_cliente','mau_uso',
    'etapa','marco_exec_fim','marco_relatorio','marco_fechou_os',
    'marco_liberou_fat','marco_faturou',
    'diario_agendado_ate',
    'modalidade'
  ));

-- ============================================================
-- 6. SEED
-- ============================================================

-- 6.1 Feriados (§10.5 do Eduardo)
insert into public.obras_feriado (data, descricao, abrangencia) values
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-11-20', 'Consciência Negra', 'nacional'),
  ('2026-12-25', 'Natal', 'nacional'),
  ('2027-01-01', 'Confraternização Universal', 'nacional'),
  ('2027-02-08', 'Carnaval (ponto facultativo)', 'facultativo'),
  ('2027-02-09', 'Carnaval (ponto facultativo)', 'facultativo'),
  ('2027-03-26', 'Sexta-feira Santa', 'nacional'),
  ('2027-04-21', 'Tiradentes', 'nacional'),
  ('2027-04-23', 'São Jorge (estadual RJ)', 'estadual')
on conflict (data) do nothing;

-- 6.2 Macaé 3 — parâmetros (só preenche o que ainda está vazio)
update public.obras_obra
   set modalidade = 'obra'
 where id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c'
   and os = '1026-014683'
   and modalidade = 'spot'
   and not exists (select 1 from public.obras_historico h
                    where h.obra_id = obras_obra.id and h.bloco = 'Classificação');

update public.obras_obra
   set data_base = coalesce(data_base, date '2026-10-26'),
       atividade_trava = coalesce(atividade_trava, 6)
 where id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c';

-- 6.3 Macaé 3 — versão 1 (rascunho)
insert into public.obras_cronograma_versao (obra_id, numero, motivo, criada_por)
select o.id, 1, 'Base do cronograma (seed)', 'seed'
  from public.obras_obra o
 where o.id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c'
on conflict (obra_id, numero) do nothing;

-- 6.4 Macaé 3 — as 28 atividades (§10.1) + peso_valor (§10.2).
-- Só insere se a versão 1 ainda é rascunho (versão salva = trigger barraria).
-- (n, frente, etapa, descrição, saída/trava, pred1, pred2, dias úteis, peso)
insert into public.obras_atividade
  (versao_id, obra_id, numero, frente, etapa, descricao, saida_trava,
   pred1, pred2, duracao, bloqueia_por_trava, peso_valor)
select v.id, v.obra_id, a.n, a.frente, a.etapa, a.descricao, a.saida,
       a.p1, a.p2, a.dias, a.n in (11,12,13,14,21), a.peso
  from public.obras_cronograma_versao v
  cross join (values
    (1,  'Estrutural', '1 – Mobilização e isolamento', 'Reunião de partida no local: identificar P1–P4, treliça e faixa de piso afetada', 'Mapa de frentes validado pelo RT', null::int, null::int, 1, 6650.00::numeric),
    (2,  'Estrutural', '1 – Mobilização e isolamento', 'Pontos de acompanhamento fotográfico, relatório "antes da obra" e marcos de nível', 'Registro-base para medição e comparação', 1, null, 2, 4500.00),
    (3,  'Estrutural', '1 – Mobilização e isolamento', 'Instalar divisória de fechamento da área', 'Área isolada e sinalizada', 1, null, 2, 17869.20),
    (4,  'Estrutural', '1 – Mobilização e isolamento', 'Remover produtos, virar o balcão e mudar o mobiliário da área afetada', 'Frente de trabalho livre', 3, null, 3, 5851.00),
    (5,  'Estrutural', '1 – Mobilização e isolamento', 'Aliviar a carga do mezanino (retirar estoque do depósito)', 'Mezanino descarregado', 3, null, 1, 0.00),
    (6,  'Estrutural', '2 – Estabilização', 'Escoramento provisório sob a treliça (P2/P3 e vão P3–P4); macaco só para encunhar', 'PARCIAL – falta a viga principal. Libera demolições. Manter até o nº 15', 5, null, 3, 15200.00),
    (7,  'Estrutural', '3 – Investigação e projeto', 'Levantamento topográfico de níveis e medição dos m² da faixa afetada', 'Croqui com m² e cotas', 6, null, 2, 11500.00),
    (8,  'Estrutural', '3 – Investigação e projeto', 'Estudo de solo: SPT e poço de inspeção com abertura localizada do piso', 'Laudo de sondagem', 6, null, 5, 38000.00),
    (9,  'Estrutural', '3 – Investigação e projeto', 'Projeto estrutural de reforço (treliça, apoios e fundações) + ART', 'Projeto executivo aprovado', 8, 7, 10, 16293.44),
    (10, 'Estrutural', '3 – Investigação e projeto', 'Fechar quantitativos e revisar o orçamento da Fase 2', 'Escopo e valor aprovados pela DPSP', 9, null, 5, 0.00),
    (11, 'Estrutural', '4 – Desmobilização e demolição', 'Abertura de porta com retirada de vidro (logística de entulho e materiais)', 'Acesso liberado', 10, null, 1, 2100.00),
    (12, 'Estrutural', '4 – Desmobilização e demolição', 'Descarte de gôndolas e geladeira', 'Termo de baixa de patrimônio DPSP', 10, null, 2, 1729.00),
    (13, 'Estrutural', '4 – Desmobilização e demolição', 'Desmobilização do banheiro', 'Banheiro liberado para obra', 10, null, 2, 438.68),
    (14, 'Estrutural', '4 – Desmobilização e demolição', 'Demolição do piso (revestimento, contrapiso e laje) + descarte com CTR', 'Solo exposto na área delimitada', 12, 13, 5, 23415.86),
    (15, 'Estrutural', '5 – Reforço e reconstrução', 'Reforço das fundações de P2/P3 e da treliça, conforme projeto', 'Estrutura reforçada e conferida pelo RT', 14, null, 10, 49000.00),
    (16, 'Estrutural', '5 – Reforço e reconstrução', 'Remoção do solo inadequado, base de brita e compactação em camadas (máx. 20 cm)', 'Base aprovada', 14, null, 5, 19500.00),
    (17, 'Estrutural', '5 – Reforço e reconstrução', 'Nova laje de piso armada com nível final (inclui cura)', 'Laje curada e nivelada', 16, 15, 10, 9426.00),
    (18, 'Estrutural', '5 – Reforço e reconstrução', 'Piso do banheiro e revestimento do salão', 'Piso entregue', 17, null, 8, 28000.00),
    (19, 'Estrutural', '6 – Acabamentos e entrega', 'Recuperação do mezanino: drywall, piso cerâmico, copa e WCs', 'Mezanino recuperado', 15, null, 8, 20000.00),
    (20, 'Estrutural', '6 – Acabamentos e entrega', 'Retirada do escoramento, conferência final de níveis, limpeza e liberação', 'Loja liberada; relatório "depois"', 18, 27, 3, 13656.00),
    (21, 'Reforma light', 'R – Reforma light', 'Demolição de forro (250 m²) e drywall (100 m²)', 'Somente após nº 6 concluído', 6, null, 4, 2122.50),
    (22, 'Reforma light', 'R – Reforma light', 'Infraestrutura elétrica, rede, iluminação e ativações', 'Circuitos testados', 21, null, 10, 38254.25),
    (23, 'Reforma light', 'R – Reforma light', 'Ar-condicionado: retirada, reinstalação de splits e drenos', 'Equipamentos operando', 21, null, 5, 22042.60),
    (24, 'Reforma light', 'R – Reforma light', 'Drywall novo (190 m²) com reforço em MDF', 'No mezanino, só após nº 15', 22, null, 6, 24917.60),
    (25, 'Reforma light', 'R – Reforma light', 'Forro mineral (250 m²) e abertura de luminárias', 'Forro fechado', 24, 23, 6, 35648.08),
    (26, 'Reforma light', 'R – Reforma light', 'Portas, molas, grelhas, guia de porta de enrolar e fechadura', 'Esquadrias instaladas', 24, null, 4, 14246.20),
    (27, 'Reforma light', 'R – Reforma light', 'Pintura (fundo, massa e acabamento)', 'Pintura concluída', 25, 19, 6, 13620.00),
    (28, 'Reforma light', 'R – Reforma light', 'Fachada: fixação de vidros e pintura', 'Fachada entregue', 11, null, 3, 3792.00)
  ) as a(n, frente, etapa, descricao, saida, p1, p2, dias, peso)
 where v.obra_id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c'
   and v.numero = 1
   and v.salva_em is null
on conflict (versao_id, numero) do nothing;

-- 6.5 Macaé 3 — execução (nº 6 em andamento, resto não iniciado)
insert into public.obras_atividade_exec (obra_id, numero, status)
select o.id, g.n, case when g.n = 6 then 'em_andamento' else 'nao_iniciado' end
  from public.obras_obra o
  cross join generate_series(1, 28) as g(n)
 where o.id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c'
on conflict (obra_id, numero) do nothing;

-- 6.6 Classificação das obras grandes como 'obra' (aprovada pelo José em
-- 29/10). 0426-012516 (DP MACAE 2) fica SPOT. Macaé 3 já foi reclassificada
-- em 6.2 — o histórico dela entra aqui junto com as demais.
with alvo as (
  update public.obras_obra
     set modalidade = 'obra'
   where os in ('PLK-NORTESHOP', 'CDRJ-TELHADO')
     and modalidade = 'spot'
  returning id
)
insert into public.obras_historico (obra_id, bloco, campo, de, para, quem)
select id, 'Classificação', 'modalidade', 'spot', 'obra', 'seed' from alvo;

-- Macaé 3: histórico uma única vez (idempotente pela existência da linha).
insert into public.obras_historico (obra_id, bloco, campo, de, para, quem)
select o.id, 'Classificação', 'modalidade', 'spot', 'obra', 'seed'
  from public.obras_obra o
 where o.id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c'
   and o.modalidade = 'obra'
   and not exists (select 1 from public.obras_historico h
                    where h.obra_id = o.id and h.bloco = 'Classificação');

commit;

-- ============================================================
-- VERIFICAÇÃO (rodar depois do commit; qualquer FALHOU = parar e não deployar)
-- ============================================================
select n, verificacao,
       case when ok then 'OK' else '*** FALHOU ***' end as resultado
from (
  select 1 as n, 'obras_obra tem as 4 colunas novas' as verificacao,
         (select count(*) = 4 from information_schema.columns
           where table_schema='public' and table_name='obras_obra'
             and column_name in ('modalidade','data_base','engenheiro_email','atividade_trava')) as ok
  union all select 2, '10 tabelas novas com RLS ligada',
         (select count(*) = 10 from pg_class c join pg_namespace s on s.oid=c.relnamespace
           where s.nspname='public' and c.relrowsecurity
             and c.relname in ('obras_feriado','obras_cronograma_versao','obras_atividade',
               'obras_atividade_exec','obras_rdo','obras_rdo_avanco','obras_rdo_foto',
               'obras_impedimento','obras_destinatario','obras_envio'))
  union all select 3, 'obras_envio so tem select e insert',
         (select count(*) = 2 from pg_policies where schemaname='public' and tablename='obras_envio'
            and cmd in ('SELECT','INSERT'))
  union all select 4, '10 feriados',
         (select count(*) = 10 from public.obras_feriado)
  union all select 5, 'Macae 3: 28 atividades na versao 1',
         (select count(*) = 28 from public.obras_atividade a
            join public.obras_cronograma_versao v on v.id = a.versao_id
           where v.obra_id='a6271663-d342-4669-8c32-f9dd97e8aa7c' and v.numero = 1)
  union all select 6, 'Macae 3: soma de peso_valor = 437772.41',
         (select coalesce(sum(peso_valor),0) = 437772.41 from public.obras_atividade
           where obra_id='a6271663-d342-4669-8c32-f9dd97e8aa7c')
  union all select 7, 'Macae 3: 28 linhas de execucao, nº 6 em andamento',
         (select count(*) = 28 and count(*) filter (where status='em_andamento') = 1
            from public.obras_atividade_exec where obra_id='a6271663-d342-4669-8c32-f9dd97e8aa7c')
  union all select 8, '5 atividades com bloqueia_por_trava',
         (select count(*) = 5 from public.obras_atividade
           where obra_id='a6271663-d342-4669-8c32-f9dd97e8aa7c' and bloqueia_por_trava)
  union all select 9, 'obras classificadas como obra: Macae 3, NORTESHOP, CDRJ-TELHADO',
         (select count(*) = 3 from public.obras_obra
           where modalidade='obra'
             and (id='a6271663-d342-4669-8c32-f9dd97e8aa7c' or os in ('PLK-NORTESHOP','CDRJ-TELHADO')))
  union all select 10, 'triggers de imutabilidade existem',
         (select count(*) = 9 from pg_trigger
           where tgname in ('obras_atividade_imutavel','obras_versao_imutavel','obras_envio_autor',
             'obras_rdo_autor','obras_impedimento_autor','obras_versao_autor','obras_atividade_exec_autor','obras_rdo_estado','obras_obra_parametros_guarda')
             and not tgisinternal)
) t
order by n;
