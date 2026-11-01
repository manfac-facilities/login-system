-- ============================================================
-- OBRAS — Leva 6b (planta de faseamento, 01/11/2026).
-- Spec: docs/superpowers/specs/2026-11-01-obras-leva6b-faseamento-design.md §2–3.
-- Plano: docs/superpowers/plans/2026-11-01-obras-leva6b.md, Task 1.
-- Teste de comportamento: docs/obras/2026-11-01-verificacao-obras-leva6b.sql.
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar (AGENTS.md).
--
-- TERRITÓRIO DE RLS E AUTORIZAÇÃO (AGENTS.md): toda dúvida falha FECHADA.
--
-- O QUE FAZ
--   1. obras_obra.coordenador_email (text null). Entra na guarda "só admin"
--      obras_obra_parametros_guarda (recriada a partir do corpo de produção
--      conferido em 01/11/2026 = financeiro-a, + coordenador_email no INSERT,
--      no UPDATE e na lista de colunas do trigger).
--   2. obras_pode_fasear(p_obra uuid) boolean — security definer, NUNCA NULL,
--      revogada de public/anon/authenticated: obras_engenheiro_ou_admin(obra)
--      OU e-mail do JWT = coordenador_email da obra (lower/trim; NULL ou vazio
--      de qualquer lado nunca passa).
--   3. obras_fase (id, obra_id, numero, nome, ordem, autoria): numero por obra
--      ATRIBUÍDO NO BANCO (max + 1 sob trava; o enviado é ignorado; unique
--      (obra_id, numero)); obra_id e numero imutáveis. Fase com revisão emitida
--      não se apaga (só na cascata da obra).
--   4. obras_fase_revisao (id, fase_id, obra_id, revisao, status, camadas,
--      regras, carimbo, usa_trava, trava_snapshot, emitida_em/por, autoria):
--      - obra_id coerente com a fase (FK composta (fase_id, obra_id) ->
--        obras_fase(id, obra_id); se vier nulo, o trigger copia o da fase);
--      - revisao = max + 1 da fase, atribuída no banco (0, 1, 2 …);
--      - nasce SEMPRE rascunho (status, trava_snapshot e emitida_* enviados
--        são ignorados); só uma rascunho por fase (índice único parcial
--        obras_fase_revisao_um_rascunho + mensagem clara no trigger);
--      - rascunho -> emitida: o TRIGGER grava emitida_em = now(), emitida_por
--        = e-mail do JWT e, se usa_trava, o trava_snapshot lido do cronograma
--        vigente (o cliente não consegue forjar nenhum dos três). Obra sem
--        atividade_trava com usa_trava = true: emissão recusada;
--      - na emissão o trigger também CONGELA a base da prancha e a fase:
--        planta_path / planta_largura / planta_altura copiados de obras_mapa
--        (obra sem mapa ou sem planta: as três NULL = quadro branco) e
--        fase_nome / fase_numero copiados de obras_fase. No rascunho as cinco
--        ficam NULL (o enviado é ignorado; check obras_fase_revisao_emissao_check).
--        A imagem antiga da planta continua no bucket quando o mapa troca de
--        planta (nenhum código apaga '<obra>/mapa/…'; a policy de delete só
--        alcança '/rdo/'), então o caminho congelado continua válido;
--      - emitida é IMUTÁVEL (qualquer UPDATE recusado, com ou sem JWT) e não
--        volta a rascunho; não se apaga (só na cascata da fase/obra);
--      - camadas: check obras_fase_revisao_camadas_check
--        (obras_fase_camadas_validas + pg_column_size <= 256 KiB): array,
--        <= 300 itens, cada item objeto com t conhecido e geometria do grupo
--        com coordenadas 0–1 (formato no comentário da função); regras: <= 12
--        textos de 1–200 caracteres; carimbo: objeto, <= 20 chaves de <= 40
--        caracteres, valores texto <= 300 ou null, <= 8 KiB. Validadores sem
--        execute para anon/public (authenticated e service_role mantêm).
--      rpc obras_emitir_fase_revisao(p_revisao uuid) (security invoker, para
--      authenticated): faz o UPDATE para emitida e devolve a linha.
--   Fase e revisão, numa sessão de usuário (JWT com e-mail): INSERT/UPDATE/
--   DELETE só com obras_pode_fasear (trigger security definer, guarda `is not
--   true`; sem JWT — service role, cron — passa). RLS: select/insert/update/
--   delete para authenticated com obras_has_access() (leitura = acesso
--   obras, como as outras obras_*; a escrita é filtrada pelo trigger, porque
--   obras_pode_fasear é fechada para authenticated e não pode ir na policy).
--   Autoria: criado_por (JWT) e criado_em = now() forçados no INSERT; no
--   UPDATE voltam aos antigos, atualizado_por = JWT, atualizado_em = now().
--   anon sem nada.
--   5. obras_envio: tipo 'faseamento' + coluna fase_revisao_id (FK ON DELETE
--      CASCADE — a revisão emitida só sai na cascata da obra, junto com o
--      envio; assim a cascata não depende da ordem dos gatilhos de RI;
--      índice obras_envio_fase_revisao_idx); check
--      obras_envio_faseamento_obrigatorio (tipo faseamento exige
--      fase_revisao_id). obras_envio_vinculo_obra recriado (corpo de produção
--      + fase_revisao_id: mesma obra do envio, revisão EMITIDA e envio do tipo
--      faseamento; trigger também dispara em UPDATE OF fase_revisao_id).
--      obras_envio_guarda recriado: envio do tipo faseamento aceita
--      obras_pode_fasear (o coordenador envia — spec §2.1); os demais tipos
--      continuam só engenheiro/admin, idêntico a produção.
--
-- PRÉ-REQUISITO: sdd-sql-obras-leva6.sql aplicado (a seção 0 confere).
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-11-01-verificacao-obras-leva6b.sql.
--
-- IDEMPOTENTE: create ... if not exists, add column if not exists, create or
-- replace, drop trigger/policy/constraint if exists antes de recriar.
--
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is not true` (sem NULL
-- aberto); uma função de trigger por tabela, sem campo de outra tabela.
--
-- ROLLBACK: bloco comentado no FIM deste arquivo, com os corpos de produção
-- (catálogo 01/11/2026) das funções recriadas. Só depois de reverter o app;
-- apaga o faseamento — exportar antes.
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (Leva 6 e anteriores)
-- ============================================================
do $$
begin
  if to_regclass('public.obras_obra') is null
     or to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null
     or to_regprocedure('public.obras_engenheiro_ou_admin(uuid)') is null
     or to_regprocedure('public.obras_obra_parametros_guarda()') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_obra'
                       and column_name in ('modalidade','data_base','engenheiro_email','atividade_trava',
                                           'peso_avanco','obra_pai_id')
                     having count(*) = 6) then
    raise exception 'Pré-requisito ausente: obras_obra com modalidade/data_base/engenheiro_email/atividade_trava/peso_avanco/obra_pai_id e obras_obra_parametros_guarda (modalidade-obra, leva2, financeiro-a). Nada foi alterado.';
  end if;
  if to_regclass('public.obras_cronograma_versao') is null
     or to_regclass('public.obras_atividade') is null
     or to_regclass('public.obras_atividade_exec') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_atividade'
                       and column_name = 'bloqueia_por_trava') then
    raise exception 'Pré-requisito ausente: cronograma da OBRA (obras_cronograma_versao/obras_atividade/obras_atividade_exec). Nada foi alterado.';
  end if;
  if to_regclass('public.obras_envio') is null
     or to_regclass('public.obras_relatorio') is null
     or to_regprocedure('public.obras_envio_vinculo_obra()') is null
     or to_regprocedure('public.obras_envio_guarda()') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_envio' and column_name = 'relatorio_id')
     or not exists (select 1 from pg_constraint
                     where conrelid = 'public.obras_envio'::regclass and conname = 'obras_envio_tipo_check') then
    raise exception 'Pré-requisito ausente: obras_envio com relatorio_id, obras_envio_tipo_check, obras_envio_vinculo_obra e obras_envio_guarda (leva2–leva4). Nada foi alterado.';
  end if;
  if to_regclass('public.obras_mapa') is null
     or to_regclass('public.obras_ponto_foto') is null
     or to_regprocedure('public.obras_mapa_pode_escrever(text)') is null
     or (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'obras_mapa'
            and column_name in ('planta_path','planta_largura','planta_altura')) <> 3 then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva6.sql não está aplicado (obras_mapa com planta_path/largura/altura, obras_ponto_foto, obras_mapa_pode_escrever). Nada foi alterado.';
  end if;
end $$;

-- ============================================================
-- 1. obras_obra.coordenador_email + guarda "só admin"
-- ============================================================
alter table public.obras_obra add column if not exists coordenador_email text;

-- Corpo de produção (conferido por catálogo em 01/11/2026, igual ao de
-- sdd-sql-obras-financeiro-a.sql) + coordenador_email.
create or replace function public.obras_obra_parametros_guarda() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_checar_pai boolean;
  v_pai_modalidade text;
  v_pai_pai uuid;
begin
  -- INSERT com JWT de usuário comum: nasce como SPOT, sem os parâmetros.
  if tg_op = 'INSERT' then
    if v_email is not null
       and (new.engenheiro_email is not null
            or new.coordenador_email is not null
            or new.data_base is not null
            or new.atividade_trava is not null
            or new.peso_avanco is not null
            or new.obra_pai_id is not null
            or new.modalidade is distinct from 'spot')
       and public.obras_is_admin() is not true then
      raise exception 'OBRAS_PARAMETROS: só administrador cria obra com modalidade, data base, engenheiro, coordenador, atividade-trava, critério de peso ou obra mãe'
        using errcode = '42501';
    end if;
    v_checar_pai := new.obra_pai_id is not null;
  else
    if v_email is not null
       and (new.modalidade is distinct from old.modalidade
            or new.data_base is distinct from old.data_base
            or new.engenheiro_email is distinct from old.engenheiro_email
            or new.coordenador_email is distinct from old.coordenador_email
            or new.atividade_trava is distinct from old.atividade_trava
            or new.peso_avanco is distinct from old.peso_avanco
            or new.obra_pai_id is distinct from old.obra_pai_id)
       and public.obras_is_admin() is not true then
      raise exception 'OBRAS_PARAMETROS: só administrador altera modalidade, data base, engenheiro, coordenador, atividade-trava, critério de peso e obra mãe'
        using errcode = '42501';
    end if;
    v_checar_pai := new.obra_pai_id is distinct from old.obra_pai_id
                    or new.modalidade is distinct from old.modalidade;
  end if;

  -- Estrutura mãe/filha: vale com ou sem JWT (inclusive service role).
  if v_checar_pai then
    if new.obra_pai_id is not null then
      if new.obra_pai_id = new.id then
        raise exception 'OBRAS_OBRA_PAI: a obra não pode ser aditivo de si mesma' using errcode = '23514';
      end if;
      if new.modalidade is distinct from 'obra' then
        raise exception 'OBRAS_OBRA_PAI: só obra da modalidade OBRA pode ser aditivo' using errcode = '23514';
      end if;
      -- Trava a mãe: duas gravações simultâneas não montam dois níveis.
      select o.modalidade, o.obra_pai_id into v_pai_modalidade, v_pai_pai
        from public.obras_obra o where o.id = new.obra_pai_id
        for update;
      if not found then
        raise exception 'OBRAS_OBRA_PAI: a obra mãe não existe' using errcode = '23503';
      end if;
      if v_pai_modalidade is distinct from 'obra' then
        raise exception 'OBRAS_OBRA_PAI: a obra mãe tem de ser da modalidade OBRA' using errcode = '23514';
      end if;
      if v_pai_pai is not null then
        raise exception 'OBRAS_OBRA_PAI: a obra mãe já é aditivo de outra (um nível só)' using errcode = '23514';
      end if;
    end if;
    if tg_op = 'UPDATE' then
      if exists (select 1 from public.obras_obra f where f.obra_pai_id = new.id) then
        if new.obra_pai_id is not null then
          raise exception 'OBRAS_OBRA_PAI: esta obra tem aditivos e não pode virar aditivo (um nível só)' using errcode = '23514';
        end if;
        if new.modalidade is distinct from 'obra' then
          raise exception 'OBRAS_OBRA_PAI: esta obra tem aditivos e não pode deixar de ser OBRA' using errcode = '23514';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_obra_parametros_guarda() from public, anon, authenticated;

drop trigger if exists obras_obra_parametros_guarda on public.obras_obra;
create trigger obras_obra_parametros_guarda
  before insert or update of modalidade, data_base, engenheiro_email, coordenador_email,
                             atividade_trava, peso_avanco, obra_pai_id
  on public.obras_obra
  for each row execute function public.obras_obra_parametros_guarda();

-- ============================================================
-- 2. obras_pode_fasear — true/false, nunca NULL (falha fechada)
-- ============================================================
create or replace function public.obras_pode_fasear(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(public.obras_engenheiro_ou_admin(p_obra), false)
      or coalesce(
           (select nullif(lower(trim(o.coordenador_email)), '')
              from public.obras_obra o where o.id = p_obra)
           = nullif(lower(trim(auth.jwt() ->> 'email')), ''),
           false);
$$;
revoke execute on function public.obras_pode_fasear(uuid) from public, anon, authenticated;

-- ============================================================
-- 3. Validação do conteúdo (funções puras usadas em CHECK)
-- ============================================================
-- jsonb número entre 0 e 1 (nunca NULL).
create or replace function public.obras_fase_num01(p jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case when jsonb_typeof(p) = 'number'
              then coalesce((p #>> '{}')::numeric between 0 and 1, false)
              else false end;
$$;

-- Formato das camadas (coordenadas relativas 0–1 à planta):
--   [{ "t": <tipo>, <geometria>, "rot"?: texto <= 120 | null, "oculta"?: bool,
--      "id"?: qualquer }, …]   no máximo 300 itens
--   zonas  (zona_obra, zona_salao, zona_atend, zona_uso, restrita):
--          "r": [x, y, w, h]  — x, y, w, h em 0–1, w > 0, h > 0,
--                               x + w <= 1 e y + h <= 1 (tolerância 1e-6)
--   linhas (drywall, balcao) e fluxos (fluxo_cli, fluxo_obra):
--          "p": [[x, y], …]   — 2 a 500 pontos, cada coordenada em 0–1
--   portas (porta_obra, porta_exist) e ícones (extintor, emerg):
--          "at": [x, y]       — cada coordenada em 0–1
-- Outras chaves são ignoradas. Nunca devolve NULL.
create or replace function public.obras_fase_camadas_validas(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  e jsonb;
  q jsonb;
  g text;
  n int;
begin
  if p is null or jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) > 300 then
    return false;
  end if;
  for e in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(e) is distinct from 'object' then
      return false;
    end if;
    if jsonb_typeof(e -> 't') is distinct from 'string' then
      return false;
    end if;
    g := case e ->> 't'
           when 'zona_obra' then 'zona' when 'zona_salao' then 'zona' when 'zona_atend' then 'zona'
           when 'zona_uso' then 'zona' when 'restrita' then 'zona'
           when 'drywall' then 'linha' when 'balcao' then 'linha'
           when 'fluxo_cli' then 'linha' when 'fluxo_obra' then 'linha'
           when 'porta_obra' then 'ponto' when 'porta_exist' then 'ponto'
           when 'extintor' then 'ponto' when 'emerg' then 'ponto'
         end;
    if g is null then
      return false;
    end if;
    if e ? 'rot' and jsonb_typeof(e -> 'rot') <> 'null'
       and (jsonb_typeof(e -> 'rot') <> 'string' or char_length(e ->> 'rot') > 120) then
      return false;
    end if;
    if e ? 'oculta' and jsonb_typeof(e -> 'oculta') <> 'boolean' then
      return false;
    end if;

    -- IFs aninhados: nenhum cast/jsonb_array_length roda antes do tipo conferido.
    if g = 'zona' then
      q := e -> 'r';
      if jsonb_typeof(q) is distinct from 'array' then
        return false;
      end if;
      if jsonb_array_length(q) <> 4 then
        return false;
      end if;
      if not (public.obras_fase_num01(q -> 0) and public.obras_fase_num01(q -> 1)
              and public.obras_fase_num01(q -> 2) and public.obras_fase_num01(q -> 3)) then
        return false;
      end if;
      if not ((q ->> 2)::numeric > 0 and (q ->> 3)::numeric > 0
              and (q ->> 0)::numeric + (q ->> 2)::numeric <= 1.000001
              and (q ->> 1)::numeric + (q ->> 3)::numeric <= 1.000001) then
        return false;
      end if;
    elsif g = 'linha' then
      q := e -> 'p';
      if jsonb_typeof(q) is distinct from 'array' then
        return false;
      end if;
      n := jsonb_array_length(q);
      if n < 2 or n > 500 then
        return false;
      end if;
      if exists (select 1 from jsonb_array_elements(q) pt
                  where case when jsonb_typeof(pt.value) is distinct from 'array' then true
                             when jsonb_array_length(pt.value) <> 2 then true
                             else not (public.obras_fase_num01(pt.value -> 0)
                                       and public.obras_fase_num01(pt.value -> 1)) end) then
        return false;
      end if;
    else
      q := e -> 'at';
      if jsonb_typeof(q) is distinct from 'array' then
        return false;
      end if;
      if jsonb_array_length(q) <> 2 then
        return false;
      end if;
      if not (public.obras_fase_num01(q -> 0) and public.obras_fase_num01(q -> 1)) then
        return false;
      end if;
    end if;
  end loop;
  return true;
end;
$$;

-- Regras impressas: até 12, cada uma 1–200 caracteres com algo além de espaço.
create or replace function public.obras_fase_regras_validas(p text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
    p is not null
    and coalesce(cardinality(p), 0) <= 12
    and coalesce(array_ndims(p), 1) = 1
    and not exists (select 1 from unnest(p) r
                     where r is null or char_length(r) > 200 or r !~ '\S'),
    false);
$$;

-- Carimbo: objeto com até 20 chaves de até 40 caracteres; cada valor texto
-- <= 300 ou null; no máximo 8 KiB (pg_column_size).
create or replace function public.obras_fase_carimbo_valido(p jsonb)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select coalesce(
    jsonb_typeof(p) = 'object'
    and pg_column_size(p) <= 8192
    and (select count(*) from jsonb_object_keys(p)) <= 20
    and not exists (select 1 from jsonb_each(p) kv
                     where char_length(kv.key) > 40
                        or jsonb_typeof(kv.value) not in ('string','null')
                        or char_length(kv.value #>> '{}') > 300),
    false);
$$;

-- Validadores: fora do alcance de anon (/rpc); authenticated e service_role
-- precisam, porque o CHECK roda com o privilégio de quem grava.
revoke execute on function public.obras_fase_num01(jsonb) from public, anon;
revoke execute on function public.obras_fase_camadas_validas(jsonb) from public, anon;
revoke execute on function public.obras_fase_regras_validas(text[]) from public, anon;
revoke execute on function public.obras_fase_carimbo_valido(jsonb) from public, anon;
grant execute on function public.obras_fase_num01(jsonb) to authenticated, service_role;
grant execute on function public.obras_fase_camadas_validas(jsonb) to authenticated, service_role;
grant execute on function public.obras_fase_regras_validas(text[]) to authenticated, service_role;
grant execute on function public.obras_fase_carimbo_valido(jsonb) to authenticated, service_role;

-- ============================================================
-- 4. obras_fase
-- ============================================================
create table if not exists public.obras_fase (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  numero int not null,
  nome text not null,
  ordem int not null default 0,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz,
  constraint obras_fase_obra_numero_key unique (obra_id, numero),
  constraint obras_fase_id_obra_key unique (id, obra_id)
);
create index if not exists obras_fase_obra_idx on public.obras_fase (obra_id, ordem);

alter table public.obras_fase drop constraint if exists obras_fase_nome_check;
alter table public.obras_fase add constraint obras_fase_nome_check
  check (char_length(nome) between 1 and 120 and nome ~ '\S');
alter table public.obras_fase drop constraint if exists obras_fase_numero_check;
alter table public.obras_fase add constraint obras_fase_numero_check check (numero >= 1);

create or replace function public.obras_fase_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if tg_op = 'DELETE' then
    if v_email is not null and public.obras_pode_fasear(old.obra_id) is not true then
      raise exception 'OBRAS_FASEAMENTO: só o engenheiro da obra, o coordenador ou administrador altera as fases'
        using errcode = '42501';
    end if;
    -- Com ou sem JWT: fase com revisão emitida não se apaga (a não ser na
    -- cascata da obra, quando a obra já não existe).
    if exists (select 1 from public.obras_obra o where o.id = old.obra_id)
       and exists (select 1 from public.obras_fase_revisao r
                    where r.fase_id = old.id and r.status = 'emitida') then
      raise exception 'OBRAS_FASEAMENTO: fase com revisão emitida não se apaga'
        using errcode = 'P0001';
    end if;
    return old;
  end if;

  if v_email is not null
     and (public.obras_pode_fasear(new.obra_id) is not true
          or (tg_op = 'UPDATE' and public.obras_pode_fasear(old.obra_id) is not true)) then
    raise exception 'OBRAS_FASEAMENTO: só o engenheiro da obra, o coordenador ou administrador altera as fases'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- Número atribuído pelo banco: max + 1 da obra, sob trava por obra.
    perform pg_advisory_xact_lock(hashtextextended('obras_fase:' || new.obra_id::text, 0));
    select coalesce(max(f.numero), 0) + 1 into new.numero
      from public.obras_fase f where f.obra_id = new.obra_id;
    if v_email is not null then
      new.criado_por := v_email;
    end if;
    new.criado_em := now();
    new.atualizado_por := null;
    new.atualizado_em := null;
    return new;
  end if;

  -- UPDATE
  if new.obra_id is distinct from old.obra_id or new.numero is distinct from old.numero then
    raise exception 'OBRAS_FASEAMENTO: obra_id e numero da fase são imutáveis' using errcode = 'P0001';
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.atualizado_por := coalesce(v_email, new.atualizado_por);
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_fase_guarda() from public, anon, authenticated;

-- ============================================================
-- 5. obras_fase_revisao
-- ============================================================
create table if not exists public.obras_fase_revisao (
  id uuid primary key default gen_random_uuid(),
  fase_id uuid not null,
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  revisao int not null,
  status text not null default 'rascunho',
  camadas jsonb not null default '[]'::jsonb,
  regras text[] not null default '{}'::text[],
  carimbo jsonb not null default '{}'::jsonb,
  usa_trava boolean not null default false,
  trava_snapshot jsonb,
  emitida_em timestamptz,
  emitida_por text,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz,
  constraint obras_fase_revisao_fase_obra_fkey foreign key (fase_id, obra_id)
    references public.obras_fase(id, obra_id) on delete cascade,
  constraint obras_fase_revisao_fase_revisao_key unique (fase_id, revisao)
);
-- Congelados na emissão (I1/M6): a base da prancha (planta do mapa) e o nome/
-- número da fase. NULL no rascunho; o trigger copia quando vira emitida.
alter table public.obras_fase_revisao
  add column if not exists planta_path text,
  add column if not exists planta_largura int,
  add column if not exists planta_altura int,
  add column if not exists fase_nome text,
  add column if not exists fase_numero int;
create index if not exists obras_fase_revisao_obra_idx on public.obras_fase_revisao (obra_id);
-- Só uma revisão em rascunho por fase.
create unique index if not exists obras_fase_revisao_um_rascunho
  on public.obras_fase_revisao (fase_id) where status = 'rascunho';

alter table public.obras_fase_revisao drop constraint if exists obras_fase_revisao_status_check;
alter table public.obras_fase_revisao add constraint obras_fase_revisao_status_check
  check (status in ('rascunho','emitida'));
alter table public.obras_fase_revisao drop constraint if exists obras_fase_revisao_revisao_check;
alter table public.obras_fase_revisao add constraint obras_fase_revisao_revisao_check
  check (revisao >= 0);
alter table public.obras_fase_revisao drop constraint if exists obras_fase_revisao_camadas_check;
alter table public.obras_fase_revisao add constraint obras_fase_revisao_camadas_check
  check (public.obras_fase_camadas_validas(camadas) and pg_column_size(camadas) <= 262144);
alter table public.obras_fase_revisao drop constraint if exists obras_fase_revisao_regras_check;
alter table public.obras_fase_revisao add constraint obras_fase_revisao_regras_check
  check (public.obras_fase_regras_validas(regras));
alter table public.obras_fase_revisao drop constraint if exists obras_fase_revisao_carimbo_check;
alter table public.obras_fase_revisao add constraint obras_fase_revisao_carimbo_check
  check (public.obras_fase_carimbo_valido(carimbo));
-- Rascunho não tem nada de emissão (data, autor, retrato, planta, fase).
-- Emitida tem data, nome e número da fase; retrato só com trava; planta
-- ausente (quadro branco: as três nulas) ou caminho com dimensões nulas
-- juntas ou positivas juntas (mesma regra de obras_mapa).
alter table public.obras_fase_revisao drop constraint if exists obras_fase_revisao_emissao_check;
alter table public.obras_fase_revisao add constraint obras_fase_revisao_emissao_check
  check ((status = 'rascunho' and emitida_em is null and emitida_por is null and trava_snapshot is null
          and planta_path is null and planta_largura is null and planta_altura is null
          and fase_nome is null and fase_numero is null)
         or (status = 'emitida' and emitida_em is not null
             and (usa_trava = (trava_snapshot is not null))
             and fase_nome is not null and fase_numero is not null
             and ((planta_path is null and planta_largura is null and planta_altura is null)
                  or (planta_path is not null
                      and ((planta_largura is null and planta_altura is null)
                           or (planta_largura > 0 and planta_altura > 0))))));

create or replace function public.obras_fase_revisao_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email      text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_fase_obra  uuid;
  v_trava      int;
  v_versao     uuid;
  v_versao_num int;
begin
  if tg_op = 'DELETE' then
    if v_email is not null and public.obras_pode_fasear(old.obra_id) is not true then
      raise exception 'OBRAS_FASEAMENTO: só o engenheiro da obra, o coordenador ou administrador altera as revisões'
        using errcode = '42501';
    end if;
    -- Com ou sem JWT: emitida não se apaga, a não ser na cascata da fase/obra
    -- (a fase ou a obra já não existe; a guarda da fase só deixa apagar fase
    -- com emitida na cascata da obra). As duas condições: na cascata da obra
    -- a revisão pode sair pela FK da obra antes da fase.
    if old.status = 'emitida'
       and exists (select 1 from public.obras_fase f where f.id = old.fase_id)
       and exists (select 1 from public.obras_obra o where o.id = old.obra_id) then
      raise exception 'OBRAS_FASEAMENTO: revisão emitida não se apaga' using errcode = 'P0001';
    end if;
    return old;
  end if;

  -- Com ou sem JWT: emitida é imutável e não volta a rascunho.
  if tg_op = 'UPDATE' and old.status = 'emitida' then
    raise exception 'OBRAS_FASEAMENTO: revisão emitida é imutável' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' and new.obra_id is null then
    select f.obra_id into new.obra_id from public.obras_fase f where f.id = new.fase_id;
  end if;

  if v_email is not null
     and (public.obras_pode_fasear(new.obra_id) is not true
          or (tg_op = 'UPDATE' and public.obras_pode_fasear(old.obra_id) is not true)) then
    raise exception 'OBRAS_FASEAMENTO: só o engenheiro da obra, o coordenador ou administrador altera as revisões'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    select f.obra_id into v_fase_obra from public.obras_fase f where f.id = new.fase_id;
    if v_fase_obra is null or v_fase_obra is distinct from new.obra_id then
      raise exception 'OBRAS_FASEAMENTO_VINCULO: a fase não é desta obra' using errcode = '23514';
    end if;
    -- Número da revisão atribuído pelo banco: max + 1 da fase (0 na primeira),
    -- sob trava por fase.
    perform pg_advisory_xact_lock(hashtextextended('obras_fase_revisao:' || new.fase_id::text, 0));
    if exists (select 1 from public.obras_fase_revisao r
                where r.fase_id = new.fase_id and r.status = 'rascunho') then
      raise exception 'OBRAS_FASEAMENTO: esta fase já tem uma revisão em rascunho' using errcode = '23505';
    end if;
    select coalesce(max(r.revisao) + 1, 0) into new.revisao
      from public.obras_fase_revisao r where r.fase_id = new.fase_id;
    -- Nasce sempre rascunho: a emissão é um UPDATE (obras_emitir_fase_revisao).
    new.status := 'rascunho';
    new.trava_snapshot := null;
    new.emitida_em := null;
    new.emitida_por := null;
    new.planta_path := null;
    new.planta_largura := null;
    new.planta_altura := null;
    new.fase_nome := null;
    new.fase_numero := null;
    if v_email is not null then
      new.criado_por := v_email;
    end if;
    new.criado_em := now();
    new.atualizado_por := null;
    new.atualizado_em := null;
    return new;
  end if;

  -- UPDATE de um rascunho
  if new.fase_id is distinct from old.fase_id
     or new.obra_id is distinct from old.obra_id
     or new.revisao is distinct from old.revisao then
    raise exception 'OBRAS_FASEAMENTO: fase, obra e número da revisão são imutáveis' using errcode = 'P0001';
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.atualizado_por := coalesce(v_email, new.atualizado_por);
  new.atualizado_em := now();

  if new.status = 'emitida' then
    -- Emissão: data, autor, retrato da trava, base (planta) e fase vêm do
    -- banco, nunca do cliente.
    new.emitida_em := now();
    new.emitida_por := coalesce(v_email, new.emitida_por);
    select f.nome, f.numero into new.fase_nome, new.fase_numero
      from public.obras_fase f where f.id = new.fase_id;
    -- Obra sem mapa ou sem planta: as três nulas (quadro branco). Dimensões
    -- só junto com o caminho.
    new.planta_path := null;
    new.planta_largura := null;
    new.planta_altura := null;
    select m.planta_path,
           case when m.planta_path is not null then m.planta_largura end,
           case when m.planta_path is not null then m.planta_altura end
      into new.planta_path, new.planta_largura, new.planta_altura
      from public.obras_mapa m where m.obra_id = new.obra_id;
    if new.usa_trava then
      select o.atividade_trava into v_trava from public.obras_obra o where o.id = new.obra_id;
      if v_trava is null then
        raise exception 'OBRAS_FASEAMENTO: a obra não tem atividade-trava definida; desligue a regra de trava ou defina a atividade em Dados da obra'
          using errcode = '23514';
      end if;
      -- Versão vigente: a de maior número salva; sem nenhuma salva, o
      -- rascunho de maior número (igual a obras_atividade_exec_trava).
      select v.id, v.numero into v_versao, v_versao_num
        from public.obras_cronograma_versao v
       where v.obra_id = new.obra_id
       order by (v.salva_em is not null) desc, v.numero desc
       limit 1;
      new.trava_snapshot := jsonb_build_object(
        'data', to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'),
        'gerado_em', now(),
        'versao', v_versao_num,
        'atividade', (
          select jsonb_build_object('numero', v_trava,
                                    'descricao', a.descricao,
                                    'status', coalesce(e.status, 'nao_iniciado'),
                                    'percentual', coalesce(e.percentual, 0))
            from (select 1) um
            left join public.obras_atividade a on a.versao_id = v_versao and a.numero = v_trava
            left join public.obras_atividade_exec e on e.obra_id = new.obra_id and e.numero = v_trava),
        'bloqueadas', coalesce((
          select jsonb_agg(jsonb_build_object('numero', a.numero,
                                              'descricao', a.descricao,
                                              'status', coalesce(e.status, 'nao_iniciado'))
                           order by a.numero)
            from public.obras_atividade a
            left join public.obras_atividade_exec e on e.obra_id = new.obra_id and e.numero = a.numero
           where a.versao_id = v_versao and a.bloqueia_por_trava and a.numero <> v_trava), '[]'::jsonb));
    else
      new.trava_snapshot := null;
    end if;
  else
    -- Continua rascunho: nada de emissão.
    new.status := 'rascunho';
    new.trava_snapshot := null;
    new.emitida_em := null;
    new.emitida_por := null;
    new.planta_path := null;
    new.planta_largura := null;
    new.planta_altura := null;
    new.fase_nome := null;
    new.fase_numero := null;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_fase_revisao_guarda() from public, anon, authenticated;

-- Triggers depois das duas tabelas (a guarda da fase lê obras_fase_revisao).
drop trigger if exists obras_fase_guarda on public.obras_fase;
create trigger obras_fase_guarda
  before insert or update or delete on public.obras_fase
  for each row execute function public.obras_fase_guarda();

drop trigger if exists obras_fase_revisao_guarda on public.obras_fase_revisao;
create trigger obras_fase_revisao_guarda
  before insert or update or delete on public.obras_fase_revisao
  for each row execute function public.obras_fase_revisao_guarda();

-- Emissão pela sessão do usuário: security invoker (RLS + trigger valem).
create or replace function public.obras_emitir_fase_revisao(p_revisao uuid)
returns public.obras_fase_revisao
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare v public.obras_fase_revisao;
begin
  update public.obras_fase_revisao
     set status = 'emitida'
   where id = p_revisao and status = 'rascunho'
  returning * into v;
  if v.id is null then
    raise exception 'OBRAS_FASEAMENTO: revisão não encontrada ou já emitida' using errcode = 'P0002';
  end if;
  return v;
end;
$$;
revoke execute on function public.obras_emitir_fase_revisao(uuid) from public, anon;
grant execute on function public.obras_emitir_fase_revisao(uuid) to authenticated;

-- ============================================================
-- RLS de obras_fase e obras_fase_revisao: leitura e escrita com
-- obras_has_access(); quem pode escrever (obras_pode_fasear) é o trigger.
-- Policies estranhas são apagadas.
-- ============================================================
do $$
declare
  t text;
  p record;
begin
  foreach t in array array['obras_fase','obras_fase_revisao'] loop
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
    execute format('drop policy if exists "obras update" on public.%I', t);
    execute format('create policy "obras update" on public.%I for update to authenticated using ((select public.obras_has_access())) with check ((select public.obras_has_access()))', t);
    execute format('drop policy if exists "obras delete" on public.%I', t);
    execute format('create policy "obras delete" on public.%I for delete to authenticated using ((select public.obras_has_access()))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ============================================================
-- 6. obras_envio: tipo faseamento + fase_revisao_id
-- ============================================================
-- FK ON DELETE CASCADE (M4): o envio só aponta revisão emitida, e emitida só
-- sai na cascata da obra — quando o envio também sai. Assim a cascata não
-- depende da ordem dos gatilhos de RI de obras_obra.
alter table public.obras_envio
  add column if not exists fase_revisao_id uuid;
alter table public.obras_envio drop constraint if exists obras_envio_fase_revisao_id_fkey;
alter table public.obras_envio add constraint obras_envio_fase_revisao_id_fkey
  foreign key (fase_revisao_id) references public.obras_fase_revisao(id) on delete cascade;
create index if not exists obras_envio_fase_revisao_idx on public.obras_envio (fase_revisao_id)
  where fase_revisao_id is not null;

-- Os checks que mencionam tipo são recriados (padrão da Leva 4).
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
  check (tipo is null or tipo in ('diario','ata','imediata','semanal','mensal','fase','entrega','faseamento'));
alter table public.obras_envio
  add constraint obras_envio_relatorio_obrigatorio
  check (tipo is null or tipo not in ('mensal','fase','entrega') or relatorio_id is not null);
alter table public.obras_envio
  add constraint obras_envio_faseamento_obrigatorio
  check (tipo is null or tipo <> 'faseamento' or fase_revisao_id is not null);

-- Corpo de produção (conferido por catálogo em 01/11/2026 = Leva 4) +
-- fase_revisao_id: mesma obra, revisão emitida, envio do tipo faseamento.
create or replace function public.obras_envio_vinculo_obra() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_obra   uuid;
  v_tipo   text;
  v_status text;
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
  if new.fase_revisao_id is not null then
    select r.obra_id, r.status into v_obra, v_status
      from public.obras_fase_revisao r where r.id = new.fase_revisao_id;
    if v_obra is distinct from new.obra_id then
      raise exception 'OBRAS_ENVIO: fase_revisao_id é de outra obra' using errcode = '23514';
    end if;
    if v_status is distinct from 'emitida' then
      raise exception 'OBRAS_ENVIO: fase_revisao_id não é revisão emitida' using errcode = '23514';
    end if;
    if new.tipo is distinct from 'faseamento' then
      raise exception 'OBRAS_ENVIO: fase_revisao_id só em envio do tipo faseamento' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_envio_vinculo_obra() from public, anon, authenticated;

drop trigger if exists obras_envio_vinculo_obra on public.obras_envio;
create trigger obras_envio_vinculo_obra
  before insert or update of obra_id, tipo, registro_id, semanal_id, relatorio_id, fase_revisao_id
  on public.obras_envio
  for each row execute function public.obras_envio_vinculo_obra();

-- Corpo de produção (conferido em 01/11/2026) + faseamento aceita o
-- coordenador. Trigger obras_envio_guarda (BEFORE INSERT) não muda.
create or replace function public.obras_envio_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if nullif(lower(trim(auth.jwt() ->> 'email')), '') is null then
    return new;
  end if;
  if new.tipo = 'faseamento' then
    if public.obras_pode_fasear(new.obra_id) is not true then
      raise exception 'OBRAS_ENVIO: só o engenheiro da obra, o coordenador ou administrador registra envio do faseamento'
        using errcode = '42501';
    end if;
    return new;
  end if;
  if public.obras_engenheiro_ou_admin(new.obra_id) is not true then
    raise exception 'OBRAS_ENVIO: só o engenheiro da obra ou administrador registra envio'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_envio_guarda() from public, anon, authenticated;

commit;

-- ============================================================
-- VERIFICAÇÃO (rodar depois do commit; qualquer FALHOU = parar e não deployar)
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado is not distinct from esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'obras_obra.coordenador_email existe (text, nullable)', 'text|YES',
      (select data_type || '|' || is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'coordenador_email')),
  (2, 'parametros_guarda cobre coordenador_email (função e lista do trigger)', 'true|true',
      (select (prosrc like '%new.coordenador_email is distinct from old.coordenador_email%'
               and prosrc like '%new.coordenador_email is not null%'
               and prosrc like '%new.obra_pai_id is distinct from old.obra_pai_id%')::text
         from pg_proc where oid = 'public.obras_obra_parametros_guarda()'::regprocedure)
      || '|' ||
      (select (pg_get_triggerdef(oid) like '%coordenador_email%' and pg_get_triggerdef(oid) like '%obra_pai_id%')::text
         from pg_trigger where tgname = 'obras_obra_parametros_guarda' and tgrelid = 'public.obras_obra'::regclass)),
  (3, 'obras_pode_fasear: definer, fechada para public/anon/authenticated', 'true|false',
      (select prosecdef::text from pg_proc where oid = 'public.obras_pode_fasear(uuid)'::regprocedure)
      || '|' ||
      (select (has_function_privilege('authenticated', 'public.obras_pode_fasear(uuid)', 'EXECUTE')
            or has_function_privilege('anon', 'public.obras_pode_fasear(uuid)', 'EXECUTE'))::text)),
  (4, 'tabelas novas existem com RLS (2)', '2',
      (select count(*)::text from pg_class
        where relnamespace = 'public'::regnamespace and relkind = 'r' and relrowsecurity
          and relname in ('obras_fase','obras_fase_revisao'))),
  (5, 'policies das 2 tabelas (4+4, todas com obras_has_access)', '8|true',
      (select count(*)::text || '|' || bool_and(coalesce(qual, '') || coalesce(with_check, '') like '%obras_has_access%')::text
         from pg_policies where schemaname = 'public' and tablename in ('obras_fase','obras_fase_revisao'))),
  (6, 'anon sem privilégio nas 2 tabelas', 'false',
      (select bool_or(has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE'))::text
         from unnest(array['obras_fase','obras_fase_revisao']) t)),
  (7, 'checks da revisão (status, revisao, camadas, regras, carimbo, emissao) e da fase (nome, numero)', '8',
      (select count(*)::text from pg_constraint
        where conname in ('obras_fase_revisao_status_check','obras_fase_revisao_revisao_check',
                          'obras_fase_revisao_camadas_check','obras_fase_revisao_regras_check',
                          'obras_fase_revisao_carimbo_check','obras_fase_revisao_emissao_check',
                          'obras_fase_nome_check','obras_fase_numero_check'))),
  (8, 'unique (obra_id, numero) da fase, (fase_id, revisao) e um rascunho por fase', '3',
      (select ((select count(*) from pg_constraint where conname in ('obras_fase_obra_numero_key','obras_fase_revisao_fase_revisao_key') and contype = 'u')
             + (select count(*) from pg_indexes where indexname = 'obras_fase_revisao_um_rascunho'
                                                 and indexdef like '%UNIQUE%' and indexdef like '%rascunho%'))::text)),
  (9, 'revisão presa à fase da mesma obra (FK composta cascade)', 'c',
      (select confdeltype::text from pg_constraint where conname = 'obras_fase_revisao_fase_obra_fkey' and contype = 'f')),
  (10, 'triggers novos ligados (2) e parametros/envio ligados (3)', '2|3',
      (select count(*)::text from pg_trigger where tgname in ('obras_fase_guarda','obras_fase_revisao_guarda')
          and not tgisinternal and tgenabled = 'O')
      || '|' ||
      (select count(*)::text from pg_trigger where tgname in ('obras_obra_parametros_guarda','obras_envio_vinculo_obra','obras_envio_guarda')
          and not tgisinternal and tgenabled = 'O')),
  (11, 'funções de trigger definer e fechadas para authenticated/anon', '4|false',
      (select count(*)::text || '|' || bool_or(has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                             or has_function_privilege('anon', p.oid, 'EXECUTE'))::text
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef
          and p.proname in ('obras_fase_guarda','obras_fase_revisao_guarda','obras_envio_vinculo_obra','obras_envio_guarda'))),
  (12, 'rpc obras_emitir_fase_revisao: invoker, authenticated executa, anon não', 'false|true|false',
      (select prosecdef::text from pg_proc where oid = 'public.obras_emitir_fase_revisao(uuid)'::regprocedure)
      || '|' || has_function_privilege('authenticated', 'public.obras_emitir_fase_revisao(uuid)', 'EXECUTE')::text
      || '|' || has_function_privilege('anon', 'public.obras_emitir_fase_revisao(uuid)', 'EXECUTE')::text),
  (13, 'obras_envio_tipo_check aceita os 8 tipos (com faseamento)', 'true',
      (select (pg_get_constraintdef(oid) like '%faseamento%' and pg_get_constraintdef(oid) like '%entrega%'
               and pg_get_constraintdef(oid) like '%diario%')::text
         from pg_constraint where conrelid = 'public.obras_envio'::regclass and conname = 'obras_envio_tipo_check')),
  (14, 'obras_envio: checks sobre tipo = faseamento_obrigatorio, relatorio_obrigatorio, tipo_check',
       'obras_envio_faseamento_obrigatorio,obras_envio_relatorio_obrigatorio,obras_envio_tipo_check',
      (select string_agg(conname, ',' order by conname) from pg_constraint
        where conrelid = 'public.obras_envio'::regclass and contype = 'c'
          and pg_get_constraintdef(oid) ~ '\mtipo\M')),
  (15, 'obras_envio.fase_revisao_id (uuid) com uma FK ON DELETE CASCADE para obras_fase_revisao', 'uuid|c',
      (select data_type from information_schema.columns
        where table_schema = 'public' and table_name = 'obras_envio' and column_name = 'fase_revisao_id')
      || '|' ||
      (select string_agg(confdeltype::text, ',') from pg_constraint
        where conrelid = 'public.obras_envio'::regclass and contype = 'f'
          and confrelid = 'public.obras_fase_revisao'::regclass)),
  (16, 'vinculo_obra confere fase_revisao_id (obra, emitida, tipo) e mantém relatório; trigger inclui a coluna', 'true|true',
      (select (prosrc like '%fase_revisao_id é de outra obra%' and prosrc like '%não é revisão emitida%'
               and prosrc like '%relatorio_id é de outro tipo de relatório%' and prosrc like '%semanal_id é de outra obra%')::text
         from pg_proc where oid = 'public.obras_envio_vinculo_obra()'::regprocedure)
      || '|' ||
      (select (pg_get_triggerdef(oid) like '%fase_revisao_id%' and pg_get_triggerdef(oid) like '%relatorio_id%')::text
         from pg_trigger where tgname = 'obras_envio_vinculo_obra')),
  (17, 'envio_guarda: faseamento com obras_pode_fasear, demais com obras_engenheiro_ou_admin', 'true',
      (select (prosrc like '%obras_pode_fasear%' and prosrc like '%obras_engenheiro_ou_admin(new.obra_id) is not true%')::text
         from pg_proc where oid = 'public.obras_envio_guarda()'::regprocedure)),
  (18, 'validadores de conteúdo existem e são imutáveis (4)', '4',
      (select count(*)::text from pg_proc
        where pronamespace = 'public'::regnamespace and provolatile = 'i'
          and proname in ('obras_fase_num01','obras_fase_camadas_validas','obras_fase_regras_validas','obras_fase_carimbo_valido'))),
  (19, 'validador de camadas: válido t, fora de 0–1 f, tipo desconhecido f, 301 itens f, não-array f', 't|f|f|f|f',
      (select concat_ws('|',
         case when public.obras_fase_camadas_validas('[{"t":"zona_obra","r":[0.1,0.1,0.5,0.4]},{"t":"drywall","p":[[0,0],[1,1]]},{"t":"extintor","at":[0.5,0.5]}]') then 't' else 'f' end,
         case when public.obras_fase_camadas_validas('[{"t":"extintor","at":[1.2,0.5]}]') then 't' else 'f' end,
         case when public.obras_fase_camadas_validas('[{"t":"piscina","at":[0.5,0.5]}]') then 't' else 'f' end,
         case when public.obras_fase_camadas_validas((select jsonb_agg('{"t":"emerg","at":[0.5,0.5]}'::jsonb) from generate_series(1, 301))) then 't' else 'f' end,
         case when public.obras_fase_camadas_validas('{"t":"emerg"}') then 't' else 'f' end))),
  (20, 'colunas congeladas na emissão em obras_fase_revisao (5)', 'fase_nome:text|fase_numero:integer|planta_altura:integer|planta_largura:integer|planta_path:text',
      (select string_agg(column_name || ':' || data_type, '|' order by column_name) from information_schema.columns
        where table_schema = 'public' and table_name = 'obras_fase_revisao'
          and column_name in ('planta_path','planta_largura','planta_altura','fase_nome','fase_numero'))),
  (21, 'validador de regras: 12×200 t, 13 itens f, 201 caracteres f, só espaço f, NULL dentro f', 't|f|f|f|f',
      (select concat_ws('|',
         case when public.obras_fase_regras_validas((select array_agg(repeat('a', 200)) from generate_series(1, 12))) then 't' else 'f' end,
         case when public.obras_fase_regras_validas((select array_agg('r'::text) from generate_series(1, 13))) then 't' else 'f' end,
         case when public.obras_fase_regras_validas(array[repeat('a', 201)]) then 't' else 'f' end,
         case when public.obras_fase_regras_validas(array['   ']) then 't' else 'f' end,
         case when public.obras_fase_regras_validas(array['ok', null]) then 't' else 'f' end))),
  (22, 'validadores: anon não executa; authenticated e service_role executam', 'false|true|true',
      (select bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))::text
              || '|' || bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text
              || '|' || bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE'))::text
         from pg_proc p where p.pronamespace = 'public'::regnamespace
          and p.proname in ('obras_fase_num01','obras_fase_camadas_validas','obras_fase_regras_validas','obras_fase_carimbo_valido'))),
  (23, 'limites de tamanho: camadas <= 256 KiB no check; carimbo com chave <= 40 e <= 8 KiB', 'true|t|f|f',
      (select (pg_get_constraintdef(oid) like '%pg_column_size(camadas) <= 262144%')::text
         from pg_constraint where conname = 'obras_fase_revisao_camadas_check')
      || '|' || (case when public.obras_fase_carimbo_valido(jsonb_build_object(repeat('k', 40), 'v')) then 't' else 'f' end)
      || '|' || (case when public.obras_fase_carimbo_valido(jsonb_build_object(repeat('k', 41), 'v')) then 't' else 'f' end)
      || '|' || (case when public.obras_fase_carimbo_valido((select jsonb_object_agg('c' || g, repeat('é', 300)) from generate_series(1, 20) g)) then 't' else 'f' end))
) as t(n, verificacao, esperado, encontrado)
order by n;

-- ============================================================
-- ROLLBACK (comentado; descomente e rode inteiro só se for desfazer)
-- ============================================================
-- -- ROLLBACK da Leva 6b — rodar só depois de reverter o app. APAGA o faseamento
-- -- (fases, revisões e envios do tipo faseamento): exportar antes.
-- -- Corpos das funções = produção ANTES da Leva 6b (catálogo de 01/11/2026).
--
-- begin;
--
-- -- 1. obras_envio: volta ao estado da Leva 4.
-- delete from public.obras_envio where tipo = 'faseamento';
-- drop trigger if exists obras_envio_vinculo_obra on public.obras_envio;
--
-- CREATE OR REPLACE FUNCTION public.obras_envio_vinculo_obra()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'pg_catalog', 'public'
-- AS $function$
-- declare
--   v_obra uuid;
--   v_tipo text;
-- begin
--   if new.registro_id is not null
--      and (select r.obra_id from public.obras_registro r where r.id = new.registro_id)
--          is distinct from new.obra_id then
--     raise exception 'OBRAS_ENVIO: registro_id é de outra obra' using errcode = '23514';
--   end if;
--   if new.semanal_id is not null
--      and (select s.obra_id from public.obras_semanal s where s.id = new.semanal_id)
--          is distinct from new.obra_id then
--     raise exception 'OBRAS_ENVIO: semanal_id é de outra obra' using errcode = '23514';
--   end if;
--   if new.relatorio_id is not null then
--     select r.obra_id, r.tipo into v_obra, v_tipo from public.obras_relatorio r where r.id = new.relatorio_id;
--     if v_obra is distinct from new.obra_id then
--       raise exception 'OBRAS_ENVIO: relatorio_id é de outra obra' using errcode = '23514';
--     end if;
--     if v_tipo is distinct from new.tipo then
--       raise exception 'OBRAS_ENVIO: relatorio_id é de outro tipo de relatório' using errcode = '23514';
--     end if;
--   end if;
--   return new;
-- end;
-- $function$;
-- revoke execute on function public.obras_envio_vinculo_obra() from public, anon, authenticated;
-- create trigger obras_envio_vinculo_obra
--   before insert or update of obra_id, tipo, registro_id, semanal_id, relatorio_id on public.obras_envio
--   for each row execute function public.obras_envio_vinculo_obra();
--
-- CREATE OR REPLACE FUNCTION public.obras_envio_guarda()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'pg_catalog', 'public'
-- AS $function$
-- begin
--   if nullif(lower(trim(auth.jwt() ->> 'email')), '') is null then
--     return new;
--   end if;
--   if public.obras_engenheiro_ou_admin(new.obra_id) is not true then
--     raise exception 'OBRAS_ENVIO: só o engenheiro da obra ou administrador registra envio'
--       using errcode = '42501';
--   end if;
--   return new;
-- end;
-- $function$;
-- revoke execute on function public.obras_envio_guarda() from public, anon, authenticated;
--
-- alter table public.obras_envio drop constraint if exists obras_envio_faseamento_obrigatorio;
-- alter table public.obras_envio drop constraint if exists obras_envio_tipo_check;
-- alter table public.obras_envio add constraint obras_envio_tipo_check
--   check (tipo is null or tipo in ('diario','ata','imediata','semanal','mensal','fase','entrega'));
-- alter table public.obras_envio drop column if exists fase_revisao_id;  -- leva FK e índice
--
-- -- 2. Fases e revisões.
-- drop function if exists public.obras_emitir_fase_revisao(uuid);
-- drop table if exists public.obras_fase_revisao, public.obras_fase;
-- drop function if exists public.obras_fase_guarda(), public.obras_fase_revisao_guarda(),
--   public.obras_fase_camadas_validas(jsonb), public.obras_fase_regras_validas(text[]),
--   public.obras_fase_carimbo_valido(jsonb), public.obras_fase_num01(jsonb),
--   public.obras_pode_fasear(uuid);
--
-- -- 3. obras_obra: guarda e trigger sem coordenador_email, depois a coluna.
-- CREATE OR REPLACE FUNCTION public.obras_obra_parametros_guarda()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SET search_path TO 'pg_catalog', 'public'
-- AS $function$
-- declare
--   v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
--   v_checar_pai boolean;
--   v_pai_modalidade text;
--   v_pai_pai uuid;
-- begin
--   -- INSERT com JWT de usuário comum: nasce como SPOT, sem os parâmetros.
--   if tg_op = 'INSERT' then
--     if v_email is not null
--        and (new.engenheiro_email is not null
--             or new.data_base is not null
--             or new.atividade_trava is not null
--             or new.peso_avanco is not null
--             or new.obra_pai_id is not null
--             or new.modalidade is distinct from 'spot')
--        and public.obras_is_admin() is not true then
--       raise exception 'OBRAS_PARAMETROS: só administrador cria obra com modalidade, data base, engenheiro, atividade-trava, critério de peso ou obra mãe'
--         using errcode = '42501';
--     end if;
--     v_checar_pai := new.obra_pai_id is not null;
--   else
--     if v_email is not null
--        and (new.modalidade is distinct from old.modalidade
--             or new.data_base is distinct from old.data_base
--             or new.engenheiro_email is distinct from old.engenheiro_email
--             or new.atividade_trava is distinct from old.atividade_trava
--             or new.peso_avanco is distinct from old.peso_avanco
--             or new.obra_pai_id is distinct from old.obra_pai_id)
--        and public.obras_is_admin() is not true then
--       raise exception 'OBRAS_PARAMETROS: só administrador altera modalidade, data base, engenheiro, atividade-trava, critério de peso e obra mãe'
--         using errcode = '42501';
--     end if;
--     v_checar_pai := new.obra_pai_id is distinct from old.obra_pai_id
--                     or new.modalidade is distinct from old.modalidade;
--   end if;
--
--   -- Estrutura mãe/filha: vale com ou sem JWT (inclusive service role).
--   if v_checar_pai then
--     if new.obra_pai_id is not null then
--       if new.obra_pai_id = new.id then
--         raise exception 'OBRAS_OBRA_PAI: a obra não pode ser aditivo de si mesma' using errcode = '23514';
--       end if;
--       if new.modalidade is distinct from 'obra' then
--         raise exception 'OBRAS_OBRA_PAI: só obra da modalidade OBRA pode ser aditivo' using errcode = '23514';
--       end if;
--       -- Trava a mãe: duas gravações simultâneas não montam dois níveis.
--       select o.modalidade, o.obra_pai_id into v_pai_modalidade, v_pai_pai
--         from public.obras_obra o where o.id = new.obra_pai_id
--         for update;
--       if not found then
--         raise exception 'OBRAS_OBRA_PAI: a obra mãe não existe' using errcode = '23503';
--       end if;
--       if v_pai_modalidade is distinct from 'obra' then
--         raise exception 'OBRAS_OBRA_PAI: a obra mãe tem de ser da modalidade OBRA' using errcode = '23514';
--       end if;
--       if v_pai_pai is not null then
--         raise exception 'OBRAS_OBRA_PAI: a obra mãe já é aditivo de outra (um nível só)' using errcode = '23514';
--       end if;
--     end if;
--     if tg_op = 'UPDATE' then
--       if exists (select 1 from public.obras_obra f where f.obra_pai_id = new.id) then
--         if new.obra_pai_id is not null then
--           raise exception 'OBRAS_OBRA_PAI: esta obra tem aditivos e não pode virar aditivo (um nível só)' using errcode = '23514';
--         end if;
--         if new.modalidade is distinct from 'obra' then
--           raise exception 'OBRAS_OBRA_PAI: esta obra tem aditivos e não pode deixar de ser OBRA' using errcode = '23514';
--         end if;
--       end if;
--     end if;
--   end if;
--   return new;
-- end;
-- $function$;
-- revoke execute on function public.obras_obra_parametros_guarda() from public, anon, authenticated;
-- drop trigger if exists obras_obra_parametros_guarda on public.obras_obra;
-- create trigger obras_obra_parametros_guarda
--   before insert or update of modalidade, data_base, engenheiro_email, atividade_trava, peso_avanco, obra_pai_id
--   on public.obras_obra
--   for each row execute function public.obras_obra_parametros_guarda();
-- alter table public.obras_obra drop column if exists coordenador_email;
--
-- commit;

