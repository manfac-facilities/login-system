-- ============================================================
-- Gestão de Obras — modalidade OBRA (fase 1), correções do review final — 2026-10-29
-- Review: .superpowers/sdd/2026-10-29-obras-modalidade-obra-fase1/final-review.md (C1, I1, I2)
-- Depende de: sdd-sql-obras-modalidade-obra.sql (JÁ APLICADO; este arquivo não o altera)
-- Teste de comportamento: docs/obras/2026-10-29-verificacao-modalidade-obra-2.sql
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar (AGENTS.md).
--
-- O QUE MUDA
--   C1. RPC obras_aplicar_alteracao aceita a coluna `modalidade` (no FIM das
--       três listas: v_colunas_validas, `set (...)` e `select`). Sem isso o
--       "Tornar OBRA"/"Voltar para SPOT" da ficha falha sempre com
--       22023 coluna desconhecida. Resto da RPC IDÊNTICO ao de
--       sdd-sql-obras-agendamento-diario.sql (security invoker, search_path
--       pg_catalog, public). A guarda obras_obra_parametros_guarda continua
--       limitando a mudança de modalidade a administrador.
--   I1. Bucket obras-fotos: objeto com `/rdo/` no nome
--         - não pode ser atualizado (sobrescrito/movido) por usuário;
--         - só pode ser apagado se nenhuma obras_rdo_foto com esse path
--           pertencer a RDO fora de rascunho (validado/enviado).
--       Fotos fora de /rdo/ (diário SPOT, impedimento) seguem como estavam:
--       update permitido, delete sem policy (negado).
--   I2. Cronograma e execução, numa sessão de usuário (JWT com e-mail):
--         - obras_cronograma_versao, obras_atividade (insert/update/delete) e
--           obras_atividade_exec (insert/update): só o engenheiro da obra
--           (obras_obra.engenheiro_email) ou administrador;
--         - versão nasce rascunho (salva_em nulo) e com numero = max + 1;
--         - salvar a versão (salva_em nulo -> não nulo) exige >= 1 atividade
--           e, na v1, obras_obra.data_base preenchida;
--         - execução: atividade com bloqueia_por_trava (na versão vigente —
--           maior numero salvo — ou, sem nenhuma salva, no rascunho) não
--           avança (em_andamento/concluido/percentual > 0) enquanto a
--           atividade-trava da obra não está 'concluido' em
--           obras_atividade_exec -> OBRAS_TRAVA.
--       Sem JWT (service role, seed, SQL Editor) tudo passa, como nos
--       triggers de sdd-sql-obras-modalidade-obra.sql.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim do arquivo — qualquer
--            *** FALHOU *** = parar e não deployar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-10-29-verificacao-modalidade-obra-2.sql.
--
-- IDEMPOTENTE: create or replace function, drop trigger/policy if exists antes
-- de recriar. A RPC só é recriada se ainda não cita `modalidade` (seção 1).
--
-- ARMADILHAS DO .claude/rules/sql.md
--   (1) Guarda que falha ABERTA com NULL: a checagem de engenheiro/admin é a
--       função obras_engenheiro_ou_admin(), que devolve coalesce(..., false);
--       os triggers usam `is not true`.
--   (2) Trigger compartilhada: não há — uma função por tabela.
--
-- ROLLBACK (não apaga dado):
--   begin;
--   drop trigger if exists obras_versao_guarda on public.obras_cronograma_versao;
--   drop trigger if exists obras_atividade_guarda on public.obras_atividade;
--   drop trigger if exists obras_atividade_exec_guarda on public.obras_atividade_exec;
--   drop trigger if exists obras_atividade_exec_trava on public.obras_atividade_exec;
--   drop policy if exists "obras fotos delete" on storage.objects;
--   alter policy "obras fotos update" on storage.objects
--     using (((bucket_id = 'obras-fotos'::text) AND (select obras_has_access())))
--     with check (((bucket_id = 'obras-fotos'::text) AND (select obras_has_access())));
--   -- RPC: rodar a seção 4 de sdd-sql-obras-agendamento-diario.sql (só depois
--   -- de reverter o código que grava modalidade pela ficha).
--   commit;
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (aborta a transação se faltar algum)
-- ============================================================
do $$
declare
  v_def text;
begin
  if to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null then
    raise exception 'Pré-requisito ausente: obras_has_access()/obras_is_admin() (sdd-sql-obras-v0.sql). Nada foi alterado.';
  end if;

  if to_regclass('public.obras_cronograma_versao') is null
     or to_regclass('public.obras_atividade') is null
     or to_regclass('public.obras_atividade_exec') is null
     or to_regclass('public.obras_rdo') is null
     or to_regclass('public.obras_rdo_foto') is null
     or (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'obras_obra'
            and column_name in ('modalidade','data_base','engenheiro_email','atividade_trava')) <> 4 then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra.sql não está aplicado. Nada foi alterado.';
  end if;

  if to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)') is null then
    raise exception 'Pré-requisito ausente: public.obras_aplicar_alteracao(uuid, jsonb, jsonb). Nada foi alterado.';
  end if;

  -- A RPC é substituída INTEIRA. Só com a versão conhecida (agendamento-diario,
  -- md5 de pg_get_functiondef medido em produção em 29/10/2026) ou se ela já
  -- aceita modalidade (reaplicação: a seção 1 não mexe nela).
  v_def := pg_get_functiondef('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'::regprocedure);
  if position('modalidade' in v_def) = 0
     and md5(v_def) <> '2e26a7d4662f7e3c4d1298c163702bcf' then
    raise exception 'A RPC obras_aplicar_alteracao em produção não é a de sdd-sql-obras-agendamento-diario.sql (md5 de pg_get_functiondef = %). Esta migration a substituiria inteira e apagaria a mudança. Confira antes. Nada foi alterado.', md5(v_def);
  end if;

  if (select count(*) from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname in ('obras fotos upload','obras fotos read','obras fotos update')) <> 3 then
    raise exception 'Pré-requisito ausente: policies "obras fotos upload/read/update" em storage.objects (sdd-sql-obras-v0.sql, seção 7). Nada foi alterado.';
  end if;
end
$$;

-- ============================================================
-- 1. C1 — RPC obras_aplicar_alteracao aceita `modalidade`.
--    IDÊNTICA à da seção 4 de sdd-sql-obras-agendamento-diario.sql, com
--    `modalidade` acrescentada no FIM das três listas. Não escreva o nome da
--    coluna em comentário DENTRO do corpo: a verificação 1 conta as ocorrências.
--    Se a RPC já cita a coluna (reaplicação), nada é feito.
-- ============================================================
do $do$
begin
  if position('modalidade' in pg_get_functiondef('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'::regprocedure)) > 0 then
    raise notice 'obras_aplicar_alteracao já aceita modalidade — mantida como está.';
    return;
  end if;

  execute $fn$
create or replace function public.obras_aplicar_alteracao(
  p_obra_id uuid,
  p_campos jsonb,
  p_linhas jsonb
)
returns public.obras_obra
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_quem   text := lower(trim(auth.jwt() ->> 'email'));
  v_quando timestamptz := now();
  v_obra   public.obras_obra;
  v_chave  text;
  v_colunas_validas text[] := array[
    'pcm','equipe','prioridade','inicio_plan','duracao',
    'liberado_por','liberado_em','aprovacao','os_aprovada','marco_os_aprov',
    'tipo','valor','origem','analista_cliente','mau_uso',
    'etapa','desde_etapa','etapa_por','etapa_em','atualizacao',
    'marco_exec_fim','marco_relatorio','marco_fechou_os','marco_liberou_fat','marco_faturou',
    'bloqueio','pendencia','pend_resp','pend_prazo','prox_acao',
    'inicio_real','fim_real','nao_andou_seguidos','bloqueada_dias',
    'cancelado_por','cancelado_obs','cancelado_em','cancelado_quem','cancelado_etapa_anterior',
    'diario_agendado_ate','diario_agendado_oque','diario_agendado_motivo','diario_agendado_por','diario_agendado_em',
    'modalidade'
  ];
begin
  if not public.obras_has_access() then
    raise exception 'Sem acesso ao Controle de Obras' using errcode = '42501';
  end if;
  if v_quem is null or v_quem = '' then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  for v_chave in select jsonb_object_keys(coalesce(p_campos, '{}'::jsonb)) loop
    if not (v_chave = any(v_colunas_validas)) then
      raise exception 'obras_aplicar_alteracao: coluna desconhecida em p_campos: %', v_chave
        using errcode = '22023';
    end if;
  end loop;

  update public.obras_obra o set (
    pcm, equipe, prioridade, inicio_plan, duracao,
    liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
    tipo, valor, origem, analista_cliente, mau_uso,
    etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
    marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou,
    bloqueio, pendencia, pend_resp, pend_prazo, prox_acao,
    inicio_real, fim_real, nao_andou_seguidos, bloqueada_dias,
    cancelado_por, cancelado_obs, cancelado_em, cancelado_quem, cancelado_etapa_anterior,
    diario_agendado_ate, diario_agendado_oque, diario_agendado_motivo, diario_agendado_por, diario_agendado_em,
    modalidade
  ) = (
    select
      pcm, equipe, prioridade, inicio_plan, duracao,
      liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
      tipo, valor, origem, analista_cliente, mau_uso,
      etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
      marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou,
      bloqueio, pendencia, pend_resp, pend_prazo, prox_acao,
      inicio_real, fim_real, nao_andou_seguidos, bloqueada_dias,
      cancelado_por, cancelado_obs, cancelado_em, cancelado_quem, cancelado_etapa_anterior,
      diario_agendado_ate, diario_agendado_oque, diario_agendado_motivo, diario_agendado_por, diario_agendado_em,
      modalidade
    from jsonb_populate_record(o, coalesce(p_campos, '{}'::jsonb))
  )
  where o.id = p_obra_id
  returning * into v_obra;

  if not found then
    raise exception 'Obra não encontrada ou sem permissão' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_linhas, '[]'::jsonb)) > 0 then
    insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
    select p_obra_id, x.bloco, x.campo, x.de, x.para, x.motivo, v_quem, v_quando
    from jsonb_to_recordset(p_linhas) as x(bloco text, campo text, de text, para text, motivo text);
  end if;

  return v_obra;
end;
$$
$fn$;
end
$do$;

revoke execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) to authenticated;

-- ============================================================
-- 2. I1 — fotos do RDO não são sobrescritas nem apagadas depois da validação.
--    Caminho da foto do RDO: {obra_id}/rdo/{data}/{uuid}.jpg (= obras_rdo_foto.path).
--    obras_foto_rdo_congelada: security definer para ler obras_rdo_foto /
--    obras_rdo por cima da RLS (a guarda nunca falha aberta por não enxergar
--    a linha). exists() devolve sempre true/false.
-- ============================================================
create or replace function public.obras_foto_rdo_congelada(p_path text)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.obras_rdo_foto f
      join public.obras_rdo r on r.id = f.rdo_id
     where f.path = p_path
       and r.estado <> 'rascunho'
  );
$$;
revoke execute on function public.obras_foto_rdo_congelada(text) from public, anon;
grant execute on function public.obras_foto_rdo_congelada(text) to authenticated;

-- Update (upsert/move): continua para as fotos do diário SPOT e de
-- impedimento; nunca para /rdo/ (o upload do RDO usa nome único, sem upsert).
drop policy if exists "obras fotos update" on storage.objects;
create policy "obras fotos update" on storage.objects for update to authenticated
  using (bucket_id = 'obras-fotos' and (select public.obras_has_access())
         and name not like '%/rdo/%')
  with check (bucket_id = 'obras-fotos' and (select public.obras_has_access())
              and name not like '%/rdo/%');

-- Delete: só foto de RDO ainda não validado. Fora de /rdo/ continua sem
-- policy de delete (negado), como antes.
drop policy if exists "obras fotos delete" on storage.objects;
create policy "obras fotos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'obras-fotos' and (select public.obras_has_access())
         and name like '%/rdo/%'
         and public.obras_foto_rdo_congelada(name) is not true);

-- ============================================================
-- 3. I2 — cronograma e execução só pelo engenheiro da obra ou administrador.
--    Mesmo padrão de obras_rdo_estado: security definer lendo
--    obras_obra.engenheiro_email por cima da RLS; só numa sessão de usuário
--    (JWT com e-mail). Sem JWT (service role, seed, SQL Editor) passa.
--    Compõe com os triggers existentes (nomes em ordem alfabética de disparo):
--      versão:    obras_versao_autor -> obras_versao_guarda -> obras_versao_imutavel
--      atividade: obras_atividade_guarda -> obras_atividade_imutavel
--      execução:  obras_atividade_exec_autor -> obras_atividade_exec_guarda (BEFORE)
--                 obras_atividade_exec_trava (AFTER — ver 3d)
-- ============================================================

-- 3a. true/false (nunca NULL): admin, ou e-mail da sessão = engenheiro da obra.
create or replace function public.obras_engenheiro_ou_admin(p_obra_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select public.obras_is_admin()
      or coalesce(
           (select nullif(lower(trim(o.engenheiro_email)), '')
              from public.obras_obra o where o.id = p_obra_id)
           = nullif(lower(trim(auth.jwt() ->> 'email')), ''),
           false);
$$;
revoke execute on function public.obras_engenheiro_ou_admin(uuid) from public, anon, authenticated;

-- 3b. Versão do cronograma.
create or replace function public.obras_versao_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_prox  int;
begin
  if v_email is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if public.obras_engenheiro_ou_admin(old.obra_id) is not true then
      raise exception 'OBRAS_CRONOGRAMA: só o engenheiro da obra ou administrador altera o cronograma'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if public.obras_engenheiro_ou_admin(new.obra_id) is not true
     or (tg_op = 'UPDATE' and public.obras_engenheiro_ou_admin(old.obra_id) is not true) then
    raise exception 'OBRAS_CRONOGRAMA: só o engenheiro da obra ou administrador altera o cronograma'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.salva_em is not null then
      raise exception 'OBRAS_VERSAO: versão nova nasce como rascunho (salva_em vazio)'
        using errcode = 'P0001';
    end if;
    select coalesce(max(v.numero), 0) + 1 into v_prox
      from public.obras_cronograma_versao v where v.obra_id = new.obra_id;
    if new.numero is distinct from v_prox then
      raise exception 'OBRAS_VERSAO: a versão nova desta obra tem de ser a v%', v_prox
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- UPDATE: salvar (salva_em vazio -> preenchido).
  if old.salva_em is null and new.salva_em is not null then
    if not exists (select 1 from public.obras_atividade a where a.versao_id = new.id) then
      raise exception 'OBRAS_VERSAO: versão sem atividades não pode ser salva'
        using errcode = 'P0001';
    end if;
    if new.numero = 1
       and (select o.data_base from public.obras_obra o where o.id = new.obra_id) is null then
      raise exception 'OBRAS_VERSAO: defina a data-base da obra antes de salvar a base'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_versao_guarda() from public, anon, authenticated;

drop trigger if exists obras_versao_guarda on public.obras_cronograma_versao;
create trigger obras_versao_guarda
  before insert or update or delete on public.obras_cronograma_versao
  for each row execute function public.obras_versao_guarda();

-- 3c. Atividades do cronograma.
create or replace function public.obras_atividade_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if nullif(lower(trim(auth.jwt() ->> 'email')), '') is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if public.obras_engenheiro_ou_admin(old.obra_id) is not true then
      raise exception 'OBRAS_CRONOGRAMA: só o engenheiro da obra ou administrador altera o cronograma'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if public.obras_engenheiro_ou_admin(new.obra_id) is not true
     or (tg_op = 'UPDATE' and public.obras_engenheiro_ou_admin(old.obra_id) is not true) then
    raise exception 'OBRAS_CRONOGRAMA: só o engenheiro da obra ou administrador altera o cronograma'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_atividade_guarda() from public, anon, authenticated;

drop trigger if exists obras_atividade_guarda on public.obras_atividade;
create trigger obras_atividade_guarda
  before insert or update or delete on public.obras_atividade
  for each row execute function public.obras_atividade_guarda();

-- 3d. Execução: quem pode (BEFORE) e a atividade-trava (AFTER).
create or replace function public.obras_atividade_exec_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if nullif(lower(trim(auth.jwt() ->> 'email')), '') is null then
    return new;
  end if;
  if public.obras_engenheiro_ou_admin(new.obra_id) is not true
     or (tg_op = 'UPDATE' and public.obras_engenheiro_ou_admin(old.obra_id) is not true) then
    raise exception 'OBRAS_EXECUCAO: só o engenheiro da obra ou administrador atualiza a execução'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_atividade_exec_guarda() from public, anon, authenticated;

drop trigger if exists obras_atividade_exec_guarda on public.obras_atividade_exec;
create trigger obras_atividade_exec_guarda
  before insert or update on public.obras_atividade_exec
  for each row execute function public.obras_atividade_exec_guarda();

-- AFTER de propósito: o diário validado grava várias atividades num upsert só,
-- e a trava concluída nesse mesmo upsert libera as que dependem dela. Um AFTER
-- ROW dispara no fim do comando e enxerga todas as linhas dele; um BEFORE
-- dependeria da ordem das linhas.
-- "Avançar" = a linha nova está em_andamento/concluido ou com percentual > 0
-- E (é INSERT, ou o status mudou, ou o percentual subiu). Editar só datas de
-- uma atividade que já estava andando não é barrado.
create or replace function public.obras_atividade_exec_trava() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_trava     int;
  v_versao    uuid;
  v_bloqueia  boolean;
  v_status    text;
begin
  if nullif(lower(trim(auth.jwt() ->> 'email')), '') is null then
    return null;
  end if;

  if not (new.status in ('em_andamento','concluido') or new.percentual > 0) then
    return null;
  end if;
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status and new.percentual <= old.percentual then
      return null;
    end if;
  end if;

  select o.atividade_trava into v_trava from public.obras_obra o where o.id = new.obra_id;
  if v_trava is null or v_trava = new.numero then
    return null;
  end if;

  -- Versão que vale para a execução: a vigente (maior numero salvo); sem
  -- nenhuma salva, o rascunho de maior numero (igual a atualizarExecucaoAction).
  select v.id into v_versao
    from public.obras_cronograma_versao v
   where v.obra_id = new.obra_id
   order by (v.salva_em is not null) desc, v.numero desc
   limit 1;

  select a.bloqueia_por_trava into v_bloqueia
    from public.obras_atividade a
   where a.versao_id = v_versao and a.numero = new.numero;
  if v_bloqueia is not true then
    return null;
  end if;

  select e.status into v_status
    from public.obras_atividade_exec e
   where e.obra_id = new.obra_id and e.numero = v_trava;
  if v_status is distinct from 'concluido' then
    raise exception 'OBRAS_TRAVA: a atividade % só avança depois da atividade-trava % concluída', new.numero, v_trava
      using errcode = 'P0001';
  end if;
  return null;
end;
$$;
revoke execute on function public.obras_atividade_exec_trava() from public, anon, authenticated;

drop trigger if exists obras_atividade_exec_trava on public.obras_atividade_exec;
create trigger obras_atividade_exec_trava
  after insert or update on public.obras_atividade_exec
  for each row execute function public.obras_atividade_exec_trava();

commit;

-- ============================================================
-- VERIFICAÇÃO (rodar depois do commit; qualquer FALHOU = parar e não deployar)
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado is not distinct from esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'RPC cita modalidade 3 vezes (whitelist, set, select)', '3',
      (select count(*)::text
         from regexp_matches(pg_get_functiondef('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'::regprocedure),
                             '\mmodalidade\M', 'g'))),
  (2, 'RPC continua citando as colunas do agendamento (5 x 3)', '15',
      (select count(*)::text
         from regexp_matches(pg_get_functiondef('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'::regprocedure),
                             'diario_agendado_(ate|oque|motivo|por|em)\M', 'g'))),
  (3, 'RPC continua recusando coluna desconhecida', 'true',
      (select (prosrc ilike '%coluna desconhecida em p_campos%')::text from pg_proc
        where oid = 'public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'::regprocedure)),
  (4, 'RPC continua security invoker com search_path pg_catalog, public', 'false|search_path=pg_catalog, public',
      (select prosecdef::text || '|' || array_to_string(proconfig, ',') from pg_proc
        where oid = 'public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'::regprocedure)),
  (5, 'RPC: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.obras_aplicar_alteracao(uuid,jsonb,jsonb)', 'EXECUTE')
           and not has_function_privilege('anon', 'public.obras_aplicar_alteracao(uuid,jsonb,jsonb)', 'EXECUTE'))::text)),
  (6, 'storage: policies obras fotos = delete, read, update, upload', 'obras fotos delete,obras fotos read,obras fotos update,obras fotos upload',
      (select string_agg(policyname, ',' order by policyname) from pg_policies
        where schemaname = 'storage' and tablename = 'objects' and policyname like 'obras fotos%')),
  (7, 'storage: update barra /rdo/ no using e no with check', 'true',
      (select (qual like '%/rdo/%' and with_check like '%/rdo/%')::text from pg_policies
        where schemaname = 'storage' and tablename = 'objects' and policyname = 'obras fotos update')),
  (8, 'storage: delete só /rdo/ e consulta obras_foto_rdo_congelada', 'DELETE|true',
      (select cmd || '|' || (qual like '%/rdo/%' and qual like '%obras_foto_rdo_congelada%')::text from pg_policies
        where schemaname = 'storage' and tablename = 'objects' and policyname = 'obras fotos delete')),
  (9, 'storage: read e upload inalteradas (sem /rdo/)', 'true',
      (select (bool_and(coalesce(qual, '') || coalesce(with_check, '') not like '%/rdo/%') and count(*) = 2)::text
         from pg_policies
        where schemaname = 'storage' and tablename = 'objects' and policyname in ('obras fotos read','obras fotos upload'))),
  (10, '4 triggers novos existem e estão ligados', '4',
      (select count(*)::text from pg_trigger
        where tgname in ('obras_versao_guarda','obras_atividade_guarda','obras_atividade_exec_guarda','obras_atividade_exec_trava')
          and not tgisinternal and tgenabled = 'O')),
  (11, 'triggers anteriores continuam (9)', '9',
      (select count(*)::text from pg_trigger
        where tgname in ('obras_atividade_imutavel','obras_versao_imutavel','obras_envio_autor',
              'obras_rdo_autor','obras_impedimento_autor','obras_versao_autor','obras_atividade_exec_autor',
              'obras_rdo_estado','obras_obra_parametros_guarda')
          and not tgisinternal)),
  (12, 'funções novas são security definer (6)', '6',
      (select count(*)::text from pg_proc
        where pronamespace = 'public'::regnamespace and prosecdef
          and proname in ('obras_foto_rdo_congelada','obras_engenheiro_ou_admin','obras_versao_guarda',
                          'obras_atividade_guarda','obras_atividade_exec_guarda','obras_atividade_exec_trava'))),
  (13, 'obras_foto_rdo_congelada: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.obras_foto_rdo_congelada(text)', 'EXECUTE')
           and not has_function_privilege('anon', 'public.obras_foto_rdo_congelada(text)', 'EXECUTE'))::text)),
  (14, 'obras_engenheiro_ou_admin fechada para authenticated e anon', 'false',
      (select (has_function_privilege('authenticated', 'public.obras_engenheiro_ou_admin(uuid)', 'EXECUTE')
            or has_function_privilege('anon', 'public.obras_engenheiro_ou_admin(uuid)', 'EXECUTE'))::text)),
  (15, 'nenhuma foto de RDO validado/enviado aponta fora de /rdo/ (premissa do I1)', '0',
      (select count(*)::text from public.obras_rdo_foto f join public.obras_rdo r on r.id = f.rdo_id
        where r.estado <> 'rascunho' and f.path not like '%/rdo/%'))
) as t(n, verificacao, esperado, encontrado)
order by n;
