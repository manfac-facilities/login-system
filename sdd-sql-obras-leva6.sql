-- ============================================================
-- OBRAS — Leva 6 (mapa da obra e fotos por ponto, 01/11/2026).
-- Spec: docs/superpowers/specs/2026-11-01-obras-leva6-mapa-fotos-design.md §2–3.
-- Plano: docs/superpowers/plans/2026-11-01-obras-leva6.md, Task 1.
-- Teste de comportamento: docs/obras/2026-11-01-verificacao-obras-leva6.sql.
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar (AGENTS.md).
--
-- TERRITÓRIO DE RLS (AGENTS.md): toda dúvida falha FECHADA.
--
-- O QUE FAZ
--   1. obras_mapa (uma linha por obra, pk obra_id): modo planta|croqui|ambientes,
--      planta_path (null ou '<obra_id>/mapa/<uuid>.(jpg|jpeg|png|webp)', check
--      obras_mapa_planta_path_check), planta_largura/altura em px (as duas nulas
--      ou as duas > 0). Trocar de modo não apaga nada.
--   2. obras_ambiente: nome, area_m2 (null ou > 0), retângulo x, y, w, h em
--      coordenadas relativas 0–1 (os quatro nulos — ambiente sem desenho, modo
--      ambientes — ou os quatro preenchidos com x,y >= 0, w,h > 0, x+w <= 1,
--      y+h <= 1; check obras_ambiente_retangulo_check), ordem.
--   3. obras_ponto_foto: numero sequencial por obra ATRIBUÍDO NO BANCO no INSERT
--      (max + 1 sob trava por obra; o valor enviado é ignorado; unique(obra_id,
--      numero)), nome, ambiente_id (obrigatório, da MESMA obra), x, y 0–1 (os
--      dois nulos ou os dois preenchidos), ativo. Ponto com foto não se apaga
--      (FK das fotos) — desativa-se (ativo = false); e não troca de ambiente.
--   4. obras_ambiente_atividade (ambiente_id, atividade_numero) pk composta:
--      ligação N:N pelo NÚMERO da atividade (estável entre versões).
--   Mapa, ambientes, pontos e ligações (1–4), numa sessão de usuário (JWT com
--   e-mail): INSERT/UPDATE/DELETE só engenheiro da obra ou administrador
--   (obras_engenheiro_ou_admin, guarda `is not true` no trigger; sem JWT —
--   service role, SQL Editor — passa). obra_id imutável. Autoria: criado_por
--   (e-mail do JWT) e criado_em = now() forçados no INSERT; no UPDATE voltam aos
--   antigos, atualizado_por = JWT e atualizado_em = now(). RLS: select/insert/
--   update/delete com obras_has_access() (o trigger faz o resto); anon sem nada.
--   5. obras_rdo_foto ganha ambiente_id, ponto_id, atividade_numero (nulos nas
--      fotos antigas). Trigger obras_rdo_foto_vinculo (com ou sem JWT):
--      ambiente e ponto têm de ser da obra do RDO; ponto com ambiente informado
--      tem de ser daquele ambiente (foto só com ponto herda o ambiente dele); foto de RDO já validado/enviado não troca
--      esses vínculos (nem pela service role). A imutabilidade de hoje (policies
--      "obras update"/"obras delete" de obras_rdo_foto só no rascunho) fica
--      INTACTA — não havia trigger de imutabilidade da foto, este é novo e só
--      soma. Qualquer usuário com acesso ao Obras (o supervisor) continua
--      inserindo foto e marca ambiente/ponto/atividade.
--   6. obras_impedimento ganha ambiente_id (null). Trigger
--      obras_impedimento_ambiente: ambiente da mesma obra do impedimento.
--   FKs para obras_ambiente / obras_ponto_foto vindas das fotos e do impedimento
--   são NO ACTION: apagar ambiente ou ponto com foto/impedimento é recusado.
--   A checagem NO ACTION roda no fim de CADA delete (inclusive de cada delete
--   em cascata, que é uma consulta aninhada), não no fim do comando externo.
--   Apagar a obra passa porque os RI triggers de obras_obra disparam em ordem
--   alfabética de nome, e os de obras_rdo (leva as fotos) e obras_impedimento
--   ordenam antes dos de obras_ambiente/obras_ponto_foto (verificação 20). Se
--   uma daquelas FKs for recriada, apagar obra com foto/impedimento ligado a
--   ambiente passa a dar 23503 (fail-closed; só admin apaga obra).
--   Ponto e ligação caem em cascata com o ambiente (se nenhum ponto tiver foto).
--   7. Storage (bucket obras-fotos): caminho '<obra>/mapa/...' só pelo
--      engenheiro da obra ou administrador, e só no formato canônico
--      ^<uuid>/mapa/<uuid>\.(jpg|jpeg|png|webp)$ (função
--      obras_mapa_pode_escrever(name)). "obras fotos upload" e "obras fotos
--      update" são recriadas com o texto de produção (conferido em 01/11/2026)
--      + a condição de /mapa/; update nunca em /mapa/ (planta não é
--      sobrescrita nem movida; planta nova = uuid novo). Leitura e delete
--      inalterados (read = obras_has_access; delete só /rdo/ não congelado).
--
-- PRÉ-REQUISITO: sdd-sql-obras-leva5.sql aplicado (a seção 0 confere).
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-11-01-verificacao-obras-leva6.sql.
--
-- IDEMPOTENTE: create ... if not exists, add column if not exists, create or
-- replace, drop trigger/policy/constraint if exists antes de recriar.
--
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is not true` (sem NULL
-- aberto); uma função de trigger por tabela, sem campo de outra tabela.
--
-- ROLLBACK (só depois de reverter o app):
--   begin;
--   drop policy if exists "obras fotos upload" on storage.objects;
--   create policy "obras fotos upload" on storage.objects for insert to authenticated
--     with check ((bucket_id = 'obras-fotos'::text) AND (select public.obras_has_access()));
--   drop policy if exists "obras fotos update" on storage.objects;
--   create policy "obras fotos update" on storage.objects for update to authenticated
--     using (bucket_id = 'obras-fotos' and (select public.obras_has_access())
--            and name not like '%/rdo/%' and public.obras_foto_rdo_congelada(name) is not true)
--     with check (bucket_id = 'obras-fotos' and (select public.obras_has_access())
--                 and name not like '%/rdo/%' and public.obras_foto_rdo_congelada(name) is not true);
--   drop function public.obras_mapa_pode_escrever(text);
--   drop trigger obras_rdo_foto_vinculo on public.obras_rdo_foto;
--   drop trigger obras_impedimento_ambiente on public.obras_impedimento;
--   drop function public.obras_rdo_foto_vinculo(), public.obras_impedimento_ambiente();
--   alter table public.obras_rdo_foto drop column ambiente_id, drop column ponto_id, drop column atividade_numero;
--   alter table public.obras_impedimento drop column ambiente_id;
--   drop table public.obras_ambiente_atividade, public.obras_ponto_foto,
--              public.obras_ambiente, public.obras_mapa;  -- apaga o mapa (exportar antes)
--   drop function public.obras_mapa_guarda(), public.obras_ambiente_guarda(),
--                 public.obras_ponto_foto_guarda(), public.obras_ambiente_atividade_guarda();
--   commit;
--   (objetos '<obra>/mapa/...' no bucket: apagar pela API do Storage)
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (Leva 5 e anteriores)
-- ============================================================
do $$
begin
  if to_regclass('public.obras_obra') is null
     or to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null
     or to_regprocedure('public.obras_engenheiro_ou_admin(uuid)') is null
     or to_regprocedure('public.obras_foto_rdo_congelada(text)') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra.sql e -2 não estão aplicados. Nada foi alterado.';
  end if;
  if to_regclass('public.obras_rdo') is null
     or to_regclass('public.obras_rdo_foto') is null
     or to_regclass('public.obras_impedimento') is null
     or not exists (select 1 from pg_trigger where tgname = 'obras_rdo_foto_caminho' and not tgisinternal)
     or not exists (select 1 from pg_trigger where tgname = 'obras_impedimento_foto_caminho' and not tgisinternal) then
    raise exception 'Pré-requisito ausente: obras_rdo/obras_rdo_foto/obras_impedimento e os triggers de caminho (modalidade-obra-2). Nada foi alterado.';
  end if;
  if to_regclass('public.obras_portal_acesso') is null
     or to_regclass('public.obras_documento') is null
     or to_regclass('public.obras_situacao_cliente') is null
     or to_regprocedure('public.obras_docs_pode_escrever(text)') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva5.sql não está aplicado (obras_portal_acesso, obras_documento, obras_situacao_cliente, obras_docs_pode_escrever). Nada foi alterado.';
  end if;
  if (select count(*) from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname in ('obras fotos upload','obras fotos read','obras fotos update','obras fotos delete')) <> 4 then
    raise exception 'Pré-requisito ausente: policies "obras fotos upload/read/update/delete" em storage.objects (obras-v0 + modalidade-obra-2). Nada foi alterado.';
  end if;
end $$;

-- ============================================================
-- 1. obras_mapa
-- ============================================================
create table if not exists public.obras_mapa (
  obra_id uuid primary key references public.obras_obra(id) on delete cascade,
  modo text not null default 'ambientes',
  planta_path text,
  planta_largura int,
  planta_altura int,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz
);

alter table public.obras_mapa drop constraint if exists obras_mapa_modo_check;
alter table public.obras_mapa add constraint obras_mapa_modo_check
  check (modo in ('planta','croqui','ambientes'));
alter table public.obras_mapa drop constraint if exists obras_mapa_planta_path_check;
alter table public.obras_mapa add constraint obras_mapa_planta_path_check
  check (planta_path is null
         or planta_path ~ ('^' || obra_id::text
                           || '/mapa/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'));
alter table public.obras_mapa drop constraint if exists obras_mapa_planta_dimensoes_check;
alter table public.obras_mapa add constraint obras_mapa_planta_dimensoes_check
  check ((planta_largura is null and planta_altura is null)
         or (planta_largura is not null and planta_altura is not null
             and planta_largura > 0 and planta_altura > 0));

create or replace function public.obras_mapa_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'DELETE' then
    if v_email is not null and public.obras_engenheiro_ou_admin(old.obra_id) is not true then
      raise exception 'OBRAS_MAPA: só o engenheiro da obra ou administrador altera o mapa'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if v_email is not null
     and (public.obras_engenheiro_ou_admin(new.obra_id) is not true
          or (tg_op = 'UPDATE' and public.obras_engenheiro_ou_admin(old.obra_id) is not true)) then
    raise exception 'OBRAS_MAPA: só o engenheiro da obra ou administrador altera o mapa'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if v_email is not null then
      new.criado_por := v_email;
    end if;
    new.criado_em := now();
    new.atualizado_por := null;
    new.atualizado_em := null;
    return new;
  end if;

  -- UPDATE
  if new.obra_id is distinct from old.obra_id then
    raise exception 'OBRAS_MAPA: obra_id é imutável' using errcode = 'P0001';
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.atualizado_por := coalesce(v_email, new.atualizado_por);
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_mapa_guarda() from public, anon, authenticated;

drop trigger if exists obras_mapa_guarda on public.obras_mapa;
create trigger obras_mapa_guarda
  before insert or update or delete on public.obras_mapa
  for each row execute function public.obras_mapa_guarda();

-- ============================================================
-- 2. obras_ambiente
-- ============================================================
create table if not exists public.obras_ambiente (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  nome text not null,
  area_m2 numeric(12,2),
  x numeric,
  y numeric,
  w numeric,
  h numeric,
  ordem int not null default 0,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz
);
create index if not exists obras_ambiente_obra_idx on public.obras_ambiente (obra_id, ordem);

alter table public.obras_ambiente drop constraint if exists obras_ambiente_nome_check;
alter table public.obras_ambiente add constraint obras_ambiente_nome_check
  check (char_length(nome) between 1 and 120 and nome ~ '\S');
alter table public.obras_ambiente drop constraint if exists obras_ambiente_area_check;
alter table public.obras_ambiente add constraint obras_ambiente_area_check
  check (area_m2 is null or area_m2 > 0);
alter table public.obras_ambiente drop constraint if exists obras_ambiente_retangulo_check;
alter table public.obras_ambiente add constraint obras_ambiente_retangulo_check
  check ((x is null and y is null and w is null and h is null)
         or (x is not null and y is not null and w is not null and h is not null
             and x >= 0 and y >= 0 and w > 0 and h > 0
             and x + w <= 1 and y + h <= 1));

create or replace function public.obras_ambiente_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'DELETE' then
    if v_email is not null and public.obras_engenheiro_ou_admin(old.obra_id) is not true then
      raise exception 'OBRAS_MAPA: só o engenheiro da obra ou administrador altera os ambientes'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if v_email is not null
     and (public.obras_engenheiro_ou_admin(new.obra_id) is not true
          or (tg_op = 'UPDATE' and public.obras_engenheiro_ou_admin(old.obra_id) is not true)) then
    raise exception 'OBRAS_MAPA: só o engenheiro da obra ou administrador altera os ambientes'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if v_email is not null then
      new.criado_por := v_email;
    end if;
    new.criado_em := now();
    new.atualizado_por := null;
    new.atualizado_em := null;
    return new;
  end if;

  -- UPDATE
  if new.obra_id is distinct from old.obra_id then
    raise exception 'OBRAS_MAPA: obra_id do ambiente é imutável' using errcode = 'P0001';
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.atualizado_por := coalesce(v_email, new.atualizado_por);
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_ambiente_guarda() from public, anon, authenticated;

drop trigger if exists obras_ambiente_guarda on public.obras_ambiente;
create trigger obras_ambiente_guarda
  before insert or update or delete on public.obras_ambiente
  for each row execute function public.obras_ambiente_guarda();

-- ============================================================
-- 3. obras_ponto_foto
-- ============================================================
create table if not exists public.obras_ponto_foto (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  numero int not null,
  nome text not null,
  ambiente_id uuid not null references public.obras_ambiente(id) on delete cascade,
  x numeric,
  y numeric,
  ativo boolean not null default true,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz,
  constraint obras_ponto_foto_obra_numero_key unique (obra_id, numero)
);
create index if not exists obras_ponto_foto_ambiente_idx on public.obras_ponto_foto (ambiente_id);

alter table public.obras_ponto_foto drop constraint if exists obras_ponto_foto_nome_check;
alter table public.obras_ponto_foto add constraint obras_ponto_foto_nome_check
  check (char_length(nome) between 1 and 120 and nome ~ '\S');
alter table public.obras_ponto_foto drop constraint if exists obras_ponto_foto_numero_check;
alter table public.obras_ponto_foto add constraint obras_ponto_foto_numero_check
  check (numero >= 1);
alter table public.obras_ponto_foto drop constraint if exists obras_ponto_foto_posicao_check;
alter table public.obras_ponto_foto add constraint obras_ponto_foto_posicao_check
  check ((x is null and y is null)
         or (x is not null and y is not null and x between 0 and 1 and y between 0 and 1));

create or replace function public.obras_ponto_foto_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'DELETE' then
    if v_email is not null and public.obras_engenheiro_ou_admin(old.obra_id) is not true then
      raise exception 'OBRAS_MAPA: só o engenheiro da obra ou administrador altera os pontos de foto'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if v_email is not null
     and (public.obras_engenheiro_ou_admin(new.obra_id) is not true
          or (tg_op = 'UPDATE' and public.obras_engenheiro_ou_admin(old.obra_id) is not true)) then
    raise exception 'OBRAS_MAPA: só o engenheiro da obra ou administrador altera os pontos de foto'
      using errcode = '42501';
  end if;

  -- Estrutural (com ou sem JWT): o ambiente é da mesma obra.
  if not exists (select 1 from public.obras_ambiente a
                  where a.id = new.ambiente_id and a.obra_id = new.obra_id) then
    raise exception 'OBRAS_MAPA_VINCULO: o ambiente do ponto não é desta obra' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if new.obra_id is distinct from old.obra_id or new.numero is distinct from old.numero then
      raise exception 'OBRAS_MAPA: obra_id e numero do ponto são imutáveis' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'INSERT' then
    -- Número atribuído pelo banco: max + 1 da obra, sob trava por obra.
    perform pg_advisory_xact_lock(hashtextextended('obras_ponto_foto:' || new.obra_id::text, 0));
    select coalesce(max(p.numero), 0) + 1 into new.numero
      from public.obras_ponto_foto p where p.obra_id = new.obra_id;
    if v_email is not null then
      new.criado_por := v_email;
    end if;
    new.criado_em := now();
    new.atualizado_por := null;
    new.atualizado_em := null;
    return new;
  end if;

  -- UPDATE: ponto com foto não muda de ambiente (as fotos antigas ficariam
  -- num ambiente e o ponto em outro).
  if new.ambiente_id is distinct from old.ambiente_id
     and exists (select 1 from public.obras_rdo_foto f where f.ponto_id = old.id) then
    raise exception 'OBRAS_MAPA_VINCULO: ponto com foto não muda de ambiente (desative e crie outro)'
      using errcode = 'P0001';
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.atualizado_por := coalesce(v_email, new.atualizado_por);
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_ponto_foto_guarda() from public, anon, authenticated;

drop trigger if exists obras_ponto_foto_guarda on public.obras_ponto_foto;
create trigger obras_ponto_foto_guarda
  before insert or update or delete on public.obras_ponto_foto
  for each row execute function public.obras_ponto_foto_guarda();

-- ============================================================
-- 4. obras_ambiente_atividade (ligação pelo número da atividade)
-- ============================================================
create table if not exists public.obras_ambiente_atividade (
  ambiente_id uuid not null references public.obras_ambiente(id) on delete cascade,
  atividade_numero int not null,
  primary key (ambiente_id, atividade_numero)
);
create index if not exists obras_ambiente_atividade_numero_idx
  on public.obras_ambiente_atividade (atividade_numero);

alter table public.obras_ambiente_atividade drop constraint if exists obras_ambiente_atividade_numero_check;
alter table public.obras_ambiente_atividade add constraint obras_ambiente_atividade_numero_check
  check (atividade_numero >= 1);

-- Sem UPDATE (só insere e apaga; o trigger recusa UPDATE para todos).
create or replace function public.obras_ambiente_atividade_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_obra  uuid;
begin
  if tg_op = 'UPDATE' then
    raise exception 'OBRAS_MAPA: ligação ambiente × atividade não se altera (apague e crie)'
      using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    select a.obra_id into v_obra from public.obras_ambiente a where a.id = old.ambiente_id;
    -- Cascata do ambiente/obra apagados: o ambiente já não existe, passa (o
    -- DELETE do ambiente já passou pela guarda dele).
    if v_email is not null and v_obra is not null
       and public.obras_engenheiro_ou_admin(v_obra) is not true then
      raise exception 'OBRAS_MAPA: só o engenheiro da obra ou administrador altera as atividades do ambiente'
        using errcode = '42501';
    end if;
    return old;
  end if;

  -- INSERT
  select a.obra_id into v_obra from public.obras_ambiente a where a.id = new.ambiente_id;
  if v_email is not null
     and (v_obra is null or public.obras_engenheiro_ou_admin(v_obra) is not true) then
    raise exception 'OBRAS_MAPA: só o engenheiro da obra ou administrador altera as atividades do ambiente'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_ambiente_atividade_guarda() from public, anon, authenticated;

drop trigger if exists obras_ambiente_atividade_guarda on public.obras_ambiente_atividade;
create trigger obras_ambiente_atividade_guarda
  before insert or update or delete on public.obras_ambiente_atividade
  for each row execute function public.obras_ambiente_atividade_guarda();

-- ============================================================
-- RLS das tabelas 1–4: leitura e escrita com obras_has_access(); quem pode
-- escrever (engenheiro/admin) é o trigger. Policies estranhas são apagadas.
-- ============================================================
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['obras_mapa','obras_ambiente','obras_ponto_foto','obras_ambiente_atividade'] loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies
              where schemaname = 'public' and tablename = t
                and policyname not in ('obras select','obras insert','obras update','obras delete')
    loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;
    execute format('drop policy if exists "obras select" on public.%I', t);
    execute format('create policy "obras select" on public.%I for select to authenticated using ((select public.obras_has_access()))', t);
    execute format('drop policy if exists "obras insert" on public.%I', t);
    execute format('create policy "obras insert" on public.%I for insert to authenticated with check ((select public.obras_has_access()))', t);
    execute format('drop policy if exists "obras delete" on public.%I', t);
    execute format('create policy "obras delete" on public.%I for delete to authenticated using ((select public.obras_has_access()))', t);
    if t = 'obras_ambiente_atividade' then
      execute format('drop policy if exists "obras update" on public.%I', t);
      execute format('revoke update on public.%I from authenticated', t);
    else
      execute format('drop policy if exists "obras update" on public.%I', t);
      execute format('create policy "obras update" on public.%I for update to authenticated using ((select public.obras_has_access())) with check ((select public.obras_has_access()))', t);
    end if;
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ============================================================
-- 5. obras_rdo_foto: vínculos com ambiente, ponto e atividade
-- ============================================================
alter table public.obras_rdo_foto
  add column if not exists ambiente_id uuid,
  add column if not exists ponto_id uuid,
  add column if not exists atividade_numero int;

-- NO ACTION (conferido no fim de cada delete, inclusive dos aninhados da cascata):
-- ambiente/ponto com foto não se apaga. A cascata da obra passa pela ordem dos RI
-- triggers de obras_obra (ver cabeçalho e verificação 20).
alter table public.obras_rdo_foto drop constraint if exists obras_rdo_foto_ambiente_id_fkey;
alter table public.obras_rdo_foto add constraint obras_rdo_foto_ambiente_id_fkey
  foreign key (ambiente_id) references public.obras_ambiente(id) on delete no action;
alter table public.obras_rdo_foto drop constraint if exists obras_rdo_foto_ponto_id_fkey;
alter table public.obras_rdo_foto add constraint obras_rdo_foto_ponto_id_fkey
  foreign key (ponto_id) references public.obras_ponto_foto(id) on delete no action;
alter table public.obras_rdo_foto drop constraint if exists obras_rdo_foto_atividade_numero_check;
alter table public.obras_rdo_foto add constraint obras_rdo_foto_atividade_numero_check
  check (atividade_numero is null or atividade_numero >= 1);
create index if not exists obras_rdo_foto_ambiente_idx on public.obras_rdo_foto (ambiente_id) where ambiente_id is not null;
create index if not exists obras_rdo_foto_ponto_idx on public.obras_rdo_foto (ponto_id) where ponto_id is not null;

-- Com ou sem JWT. security definer: lê RDO, ambiente e ponto por cima da RLS
-- (a guarda nunca passa por não enxergar a linha).
create or replace function public.obras_rdo_foto_vinculo() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_obra        uuid;
  v_estado_old  text;
  v_ponto_amb   uuid;
begin
  if tg_op = 'UPDATE' then
    if new.ambiente_id is not distinct from old.ambiente_id
       and new.ponto_id is not distinct from old.ponto_id
       and new.atividade_numero is not distinct from old.atividade_numero
       and new.rdo_id is not distinct from old.rdo_id then
      return new;
    end if;
    -- Foto congelada: RDO validado/enviado não troca vínculos (nem service role).
    select r.estado into v_estado_old from public.obras_rdo r where r.id = old.rdo_id;
    if v_estado_old is distinct from 'rascunho' then
      raise exception 'OBRAS_FOTO_CONGELADA: foto de RDO % não muda ambiente, ponto nem atividade',
        coalesce(v_estado_old, 'inexistente')
        using errcode = 'P0001';
    end if;
  end if;

  if new.ambiente_id is null and new.ponto_id is null then
    return new;
  end if;

  select r.obra_id into v_obra from public.obras_rdo r where r.id = new.rdo_id;

  if new.ambiente_id is not null
     and not exists (select 1 from public.obras_ambiente a
                      where a.id = new.ambiente_id and a.obra_id = v_obra) then
    raise exception 'OBRAS_MAPA_VINCULO: o ambiente da foto não é da obra do RDO' using errcode = '23514';
  end if;

  if new.ponto_id is not null then
    select p.ambiente_id into v_ponto_amb from public.obras_ponto_foto p
     where p.id = new.ponto_id and p.obra_id = v_obra;
    if v_ponto_amb is null then
      raise exception 'OBRAS_MAPA_VINCULO: o ponto da foto não é da obra do RDO' using errcode = '23514';
    end if;
    if new.ambiente_id is not null and new.ambiente_id is distinct from v_ponto_amb then
      raise exception 'OBRAS_MAPA_VINCULO: o ponto da foto não é do ambiente informado' using errcode = '23514';
    end if;
    -- Foto só com ponto herda o ambiente do ponto (já validado acima).
    new.ambiente_id := coalesce(new.ambiente_id, v_ponto_amb);
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_rdo_foto_vinculo() from public, anon, authenticated;

drop trigger if exists obras_rdo_foto_vinculo on public.obras_rdo_foto;
create trigger obras_rdo_foto_vinculo
  before insert or update on public.obras_rdo_foto
  for each row execute function public.obras_rdo_foto_vinculo();

-- ============================================================
-- 6. obras_impedimento.ambiente_id
-- ============================================================
alter table public.obras_impedimento add column if not exists ambiente_id uuid;
alter table public.obras_impedimento drop constraint if exists obras_impedimento_ambiente_id_fkey;
alter table public.obras_impedimento add constraint obras_impedimento_ambiente_id_fkey
  foreign key (ambiente_id) references public.obras_ambiente(id) on delete no action;
create index if not exists obras_impedimento_ambiente_idx on public.obras_impedimento (ambiente_id) where ambiente_id is not null;

create or replace function public.obras_impedimento_ambiente() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.ambiente_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if new.ambiente_id is not distinct from old.ambiente_id and new.obra_id is not distinct from old.obra_id then
      return new;
    end if;
  end if;
  if not exists (select 1 from public.obras_ambiente a
                  where a.id = new.ambiente_id and a.obra_id = new.obra_id) then
    raise exception 'OBRAS_MAPA_VINCULO: o ambiente do impedimento não é desta obra' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_impedimento_ambiente() from public, anon, authenticated;

drop trigger if exists obras_impedimento_ambiente on public.obras_impedimento;
create trigger obras_impedimento_ambiente
  before insert or update on public.obras_impedimento
  for each row execute function public.obras_impedimento_ambiente();

-- ============================================================
-- 7. Storage: planta em '<obra>/mapa/<uuid>.(jpg|jpeg|png|webp)' no bucket
--    obras-fotos, só engenheiro da obra ou administrador.
-- ============================================================
-- true/false (nunca NULL). security definer para chamar obras_engenheiro_ou_admin
-- (fechada para authenticated) e ler a obra por cima da RLS. O ::uuid só roda
-- depois do formato conferido.
create or replace function public.obras_mapa_pode_escrever(p_name text)
returns boolean
language plpgsql
security definer
stable
set search_path = pg_catalog, public
as $$
declare v_obra uuid;
begin
  if p_name is null
     or p_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/mapa/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;
  v_obra := split_part(p_name, '/', 1)::uuid;
  if not exists (select 1 from public.obras_obra o where o.id = v_obra) then
    return false;
  end if;
  return coalesce(public.obras_engenheiro_ou_admin(v_obra), false);
end;
$$;
revoke execute on function public.obras_mapa_pode_escrever(text) from public, anon;
grant execute on function public.obras_mapa_pode_escrever(text) to authenticated;

-- Upload: igual ao de produção + nome com /mapa/ só no formato canônico e pelo
-- engenheiro/admin daquela obra.
drop policy if exists "obras fotos upload" on storage.objects;
create policy "obras fotos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'obras-fotos' and (select public.obras_has_access())
              and (name not ilike '%/mapa/%' or public.obras_mapa_pode_escrever(name) is true));

-- Update: igual ao de produção (modalidade-obra-2) + nunca em /mapa/ (nem de
-- origem nem de destino): a planta não é sobrescrita nem movida.
drop policy if exists "obras fotos update" on storage.objects;
create policy "obras fotos update" on storage.objects for update to authenticated
  using (bucket_id = 'obras-fotos' and (select public.obras_has_access())
         and name not like '%/rdo/%'
         and name not ilike '%/mapa/%'
         and public.obras_foto_rdo_congelada(name) is not true)
  with check (bucket_id = 'obras-fotos' and (select public.obras_has_access())
              and name not like '%/rdo/%'
              and name not ilike '%/mapa/%'
              and public.obras_foto_rdo_congelada(name) is not true);
-- "obras fotos read" e "obras fotos delete" NÃO mudam.

commit;

-- ============================================================
-- VERIFICAÇÃO (rodar depois do commit; qualquer FALHOU = parar e não deployar)
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado is not distinct from esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'tabelas novas existem (4)', '4',
      (select count(*)::text from pg_class
        where relnamespace = 'public'::regnamespace and relkind = 'r'
          and relname in ('obras_mapa','obras_ambiente','obras_ponto_foto','obras_ambiente_atividade'))),
  (2, 'RLS ligada nas 4 tabelas', '4',
      (select count(*)::text from pg_class
        where relnamespace = 'public'::regnamespace and relrowsecurity
          and relname in ('obras_mapa','obras_ambiente','obras_ponto_foto','obras_ambiente_atividade'))),
  (3, 'policies das 4 tabelas (4+4+4+3, todas com obras_has_access)', '15|true',
      (select count(*)::text || '|' || bool_and(coalesce(qual, '') || coalesce(with_check, '') like '%obras_has_access%')::text
         from pg_policies where schemaname = 'public'
          and tablename in ('obras_mapa','obras_ambiente','obras_ponto_foto','obras_ambiente_atividade'))),
  (4, 'anon sem privilégio nas 4 tabelas', 'false',
      (select bool_or(has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))::text
         from unnest(array['obras_mapa','obras_ambiente','obras_ponto_foto','obras_ambiente_atividade']) t)),
  (5, 'authenticated não faz UPDATE em obras_ambiente_atividade', 'false',
      (select has_table_privilege('authenticated', 'public.obras_ambiente_atividade', 'UPDATE')::text)),
  (6, 'colunas novas em obras_rdo_foto (3) e obras_impedimento (1)', '4',
      (select count(*)::text from information_schema.columns
        where table_schema = 'public'
          and ((table_name = 'obras_rdo_foto' and column_name in ('ambiente_id','ponto_id','atividade_numero'))
            or (table_name = 'obras_impedimento' and column_name = 'ambiente_id')))),
  (7, 'checks de coordenada/caminho/modo existem (7)', '7',
      (select count(*)::text from pg_constraint
        where conname in ('obras_mapa_modo_check','obras_mapa_planta_path_check','obras_mapa_planta_dimensoes_check',
                          'obras_ambiente_retangulo_check','obras_ambiente_area_check',
                          'obras_ponto_foto_posicao_check','obras_ponto_foto_numero_check'))),
  (8, 'FKs das fotos/impedimento para ambiente/ponto são NO ACTION (3)', 'a,a,a',
      (select string_agg(confdeltype::text, ',' order by conname) from pg_constraint
        where conname in ('obras_rdo_foto_ambiente_id_fkey','obras_rdo_foto_ponto_id_fkey','obras_impedimento_ambiente_id_fkey'))),
  (9, 'unique (obra_id, numero) do ponto', '1',
      (select count(*)::text from pg_constraint where conname = 'obras_ponto_foto_obra_numero_key' and contype = 'u')),
  (10, 'triggers novos existem e estão ligados (6)', '6',
      (select count(*)::text from pg_trigger
        where tgname in ('obras_mapa_guarda','obras_ambiente_guarda','obras_ponto_foto_guarda',
                         'obras_ambiente_atividade_guarda','obras_rdo_foto_vinculo','obras_impedimento_ambiente')
          and not tgisinternal and tgenabled = 'O')),
  (11, 'triggers anteriores de foto/impedimento continuam ligados (3)', '3',
      (select count(*)::text from pg_trigger
        where tgname in ('obras_rdo_foto_caminho','obras_impedimento_foto_caminho','obras_impedimento_autor')
          and not tgisinternal and tgenabled = 'O')),
  (12, 'funções novas security definer (7)', '7',
      (select count(*)::text from pg_proc
        where pronamespace = 'public'::regnamespace and prosecdef
          and proname in ('obras_mapa_guarda','obras_ambiente_guarda','obras_ponto_foto_guarda',
                          'obras_ambiente_atividade_guarda','obras_rdo_foto_vinculo','obras_impedimento_ambiente',
                          'obras_mapa_pode_escrever'))),
  (13, 'funções de trigger fechadas para authenticated e anon', 'false',
      (select bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('anon', p.oid, 'EXECUTE'))::text
         from pg_proc p where p.pronamespace = 'public'::regnamespace
          and p.proname in ('obras_mapa_guarda','obras_ambiente_guarda','obras_ponto_foto_guarda',
                            'obras_ambiente_atividade_guarda','obras_rdo_foto_vinculo','obras_impedimento_ambiente'))),
  (14, 'obras_mapa_pode_escrever: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.obras_mapa_pode_escrever(text)', 'EXECUTE')
           and not has_function_privilege('anon', 'public.obras_mapa_pode_escrever(text)', 'EXECUTE'))::text)),
  (15, 'storage: policies obras fotos = delete, read, update, upload', 'obras fotos delete,obras fotos read,obras fotos update,obras fotos upload',
      (select string_agg(policyname, ',' order by policyname) from pg_policies
        where schemaname = 'storage' and tablename = 'objects' and policyname like 'obras fotos%')),
  (16, 'storage: upload exige obras_mapa_pode_escrever para /mapa/', 'INSERT|true',
      (select cmd || '|' || (with_check like '%/mapa/%' and with_check like '%obras_mapa_pode_escrever%'
                             and with_check like '%obras_has_access%' and with_check like '%obras-fotos%')::text
         from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'obras fotos upload')),
  (17, 'storage: update barra /rdo/, /mapa/ e foto congelada no using e no with check', 'true',
      (select (qual like '%/rdo/%' and with_check like '%/rdo/%'
               and qual like '%/mapa/%' and with_check like '%/mapa/%'
               and qual like '%obras_foto_rdo_congelada%' and with_check like '%obras_foto_rdo_congelada%')::text
         from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'obras fotos update')),
  (18, 'storage: read e delete inalterados (sem /mapa/)', 'true',
      (select (bool_and(coalesce(qual, '') || coalesce(with_check, '') not like '%/mapa/%') and count(*) = 2)::text
         from pg_policies where schemaname = 'storage' and tablename = 'objects'
          and policyname in ('obras fotos read','obras fotos delete'))),
  (19, 'policies de obras_rdo_foto inalteradas (insert/update/delete só no rascunho)', '3',
      (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_rdo_foto'
          and policyname in ('obras insert','obras update','obras delete')
          and coalesce(qual, '') || coalesce(with_check, '') like '%rascunho%')),
  (20, 'cascata da obra: RI de obras_rdo/obras_impedimento disparam antes dos de ambiente/ponto', 'true',
      (select (max(t.tgname) filter (where c.conname in ('obras_rdo_obra_id_fkey','obras_impedimento_obra_id_fkey'))
             < min(t.tgname) filter (where c.conname in ('obras_ambiente_obra_id_fkey','obras_ponto_foto_obra_id_fkey')))::text
         from pg_trigger t join pg_constraint c on c.oid = t.tgconstraint
        where t.tgrelid = 'public.obras_obra'::regclass))
) as t(n, verificacao, esperado, encontrado)
order by n;
