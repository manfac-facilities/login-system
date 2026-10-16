-- ============================================================
-- Gestão de Obras — AGENDAR E TIRAR DO DIÁRIO — 2026-10-16
-- Spec:  docs/superpowers/specs/2026-10-16-obras-agendar-tirar-do-diario-design.md
-- Plano: docs/superpowers/plans/2026-10-16-obras-agendar-tirar-do-diario.md
-- Mockup: docs/obras/mockups/mockup-pausa-diario.html (8 suposições, seguidas como escritas)
-- ============================================================
-- ESTADO: NÃO APLICADO. Projeto de produção iyytcavcgukfjnjjrerx (confirme o
-- ref antes — AGENTS.md). Aplicar ANTES do deploy do código do agendamento.
-- O código que está no ar hoje continua funcionando com esta migration
-- aplicada: as colunas novas nascem vazias, nenhuma obra fica agendada até
-- alguém usar o botão novo, e a RPC só GANHA colunas aceitas (nenhuma sai).
--
-- O QUE MUDA
--   1. Cinco colunas novas em obras_obra (todas nullable, sem default):
--        diario_agendado_ate     date         dia em que a obra VOLTA ao diário
--        diario_agendado_oque    text         "O que vai acontecer?" (até 80)
--        diario_agendado_motivo  text         um dos 3 motivos ou "Outro: <texto>"
--        diario_agendado_por     text         e-mail de quem agendou
--        diario_agendado_em      timestamptz  quando agendou
--   2. CHECK obras_obra_agendamento_diario_coerente: ou as cinco vazias, ou as
--      cinco preenchidas, com motivo da lista, textos não vazios e a data entre
--      o dia seguinte ao agendamento e 30 dias depois (em horário de Brasília).
--   3. obras_historico aceita o bloco 'Agendamento' e o campo 'diario_agendado_ate'.
--   4. RPC obras_aplicar_alteracao aceita as cinco colunas novas.
--   RLS: NÃO muda. obras_obra continua com a policy única "obras access"
--   (for all, using/with check (select obras_has_access())), conferida em
--   produção em 16/10/2026. A regra "só o PCM da obra ou o admin agenda" fica
--   na Server Action, como a regra de pcm do diário (ver spec §6.3).
--
-- COMO RODAR — em QUATRO passos separados (o SQL Editor só mostra o resultado
-- da última instrução, e a PARTE 3 termina em erro de propósito):
--   PASSO 0  a consulta de catálogo logo abaixo (só leitura);
--   PASSO 1  do `begin;` da PARTE 1 até o `commit;`;
--   PASSO 2  a consulta de verificação da PARTE 2 — qualquer *** FALHOU *** =
--            parar e não deployar;
--   PASSO 3  o teste de comportamento da PARTE 3 (rollback forçado, não grava
--            nada). A mensagem de erro final é o relatório: "RESUMO: 12/12 OK".
--            Sem a linha "RESUMO" na mensagem = FALHOU (erro diferente do esperado).
--
-- IDEMPOTENTE: add column if not exists, drop constraint if exists antes de
-- recriar, create or replace function. Reaplicar o arquivo inteiro é seguro
-- (a seção 0 reconhece a RPC já estendida).
--
-- ARMADILHAS DO .claude/rules/sql.md
--   (1) Guarda que falha ABERTA com NULL: não há guarda de autorização nova (a
--       RPC mantém a sua, exists()-based). O CHECK de coerência é envolvido em
--       coalesce(..., false) e cada comparação vem com `is not null` antes —
--       CHECK trata NULL como aprovado.
--   (2) Trigger compartilhada: não se aplica — nenhuma trigger nova.
--
-- A RPC É SUBSTITUÍDA INTEIRA. A seção 0 compara o md5 do corpo em produção com
-- o da versão de sdd-sql-obras-cancelamento.sql (aeb70b0d0d9df777d2ca803e22c469ce,
-- medido em produção em 16/10/2026 e igual ao do arquivo). Se alguém tiver
-- mudado a RPC por outro caminho, a migration ABORTA em vez de apagar a mudança.
--
-- ROLLBACK (só se nenhuma obra estiver agendada; confira antes com
--   select count(*) from public.obras_obra where diario_agendado_ate is not null; -> 0
--   e reverta ANTES o código que lê/grava as colunas):
--   begin;
--   -- 1) restaurar a RPC: rodar a seção 6 de sdd-sql-obras-cancelamento.sql
--   --    (ORDEM OBRIGATÓRIA: a RPC desta migration cita as colunas novas; dropar
--   --    as colunas antes quebra a RPC inteira — ficha, remarcação e cancelamento).
--   alter table public.obras_obra drop constraint if exists obras_obra_agendamento_diario_coerente;
--   -- 2) histórico: só se não houver linha com o bloco/campo novos
--   --    (select count(*) from public.obras_historico where bloco = 'Agendamento'; -> 0)
--   alter table public.obras_historico drop constraint obras_historico_bloco_check;
--   alter table public.obras_historico add constraint obras_historico_bloco_check
--     check (bloco in ('Triagem','Autorização','Identificação','Cronograma','Esteira','Cancelamento'));
--   alter table public.obras_historico drop constraint obras_historico_campo_check;
--   alter table public.obras_historico add constraint obras_historico_campo_check
--     check (campo in ('pcm','equipe','prioridade','inicio_plan','duracao',
--       'liberado_por','liberado_em','os_aprovada_em','tipo','valor','origem',
--       'analista_cliente','mau_uso','etapa','marco_exec_fim','marco_relatorio',
--       'marco_fechou_os','marco_liberou_fat','marco_faturou'));
--   -- 3) as colunas podem ficar (vazias, não atrapalham) ou sair com
--   -- alter table public.obras_obra drop column if exists diario_agendado_ate,
--   --   drop column if exists diario_agendado_oque, drop column if exists diario_agendado_motivo,
--   --   drop column if exists diario_agendado_por, drop column if exists diario_agendado_em;
--   commit;
-- ============================================================


-- ============================================================
-- PASSO 0 — CONSULTA DE CATÁLOGO (só leitura). Rodar ANTES da PARTE 1.
-- ============================================================
-- select 'rpc_md5' as item, md5(prosrc) as valor from pg_proc
--  where oid = to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)')
-- union all
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--  where conrelid = 'public.obras_historico'::regclass and contype = 'c'
-- union all
-- select 'policy ' || policyname || ' ' || cmd, coalesce(qual, '') || ' | ' || coalesce(with_check, '')
--   from pg_policies where schemaname = 'public' and tablename = 'obras_obra'
-- union all
-- select 'coluna ja existe', column_name from information_schema.columns
--  where table_schema = 'public' and table_name = 'obras_obra' and column_name like 'diario_agendado%';
--
--   Esperado na PRIMEIRA aplicação (medido em 16/10/2026):
--     rpc_md5 | aeb70b0d0d9df777d2ca803e22c469ce
--     obras_historico_bloco_check | ... 'Esteira', 'Cancelamento' (6 blocos)
--     obras_historico_campo_check | ... 19 campos, terminando em 'marco_faturou'
--     policy obras access ALL | ( SELECT obras_has_access() ...) | ( SELECT obras_has_access() ...)
--     nenhuma linha "coluna ja existe"
-- ============================================================


-- ============================================================
-- PARTE 1 — MIGRATION
-- ============================================================
begin;

-- ------------------------------------------------------------
-- 0. Pré-requisitos. Aborta a transação inteira, sem alterar nada.
-- ------------------------------------------------------------
do $$
declare
  v_src text;
begin
  if to_regclass('public.obras_obra') is null or to_regclass('public.obras_historico') is null then
    raise exception 'Pré-requisito ausente: rode sdd-sql-obras-v0.sql e sdd-sql-obras-historico.sql antes deste arquivo.';
  end if;

  if to_regprocedure('public.obras_aplicar_alteracao(uuid, jsonb, jsonb)') is null then
    raise exception 'Pré-requisito ausente: public.obras_aplicar_alteracao(uuid, jsonb, jsonb) (sdd-sql-obras-historico.sql).';
  end if;

  -- A RPC nova cita as colunas do cancelamento; sem elas ela não compila.
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'obras_obra'
        and column_name in ('cancelado_por','cancelado_obs','cancelado_em',
                            'cancelado_quem','cancelado_etapa_anterior')) <> 5 then
    raise exception 'Pré-requisito ausente: as 5 colunas cancelado_* (sdd-sql-obras-cancelamento.sql).';
  end if;

  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.obras_historico'::regclass
                   and conname = 'obras_historico_bloco_check') then
    raise exception 'Pré-requisito ausente: obras_historico_bloco_check (sdd-sql-obras-historico.sql).';
  end if;

  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.obras_historico'::regclass
                   and conname = 'obras_historico_campo_check') then
    raise exception 'Pré-requisito ausente: obras_historico_campo_check (sdd-sql-obras-historico.sql).';
  end if;

  -- O CHECK de bloco tem de ser o do cancelamento (ou já o desta migration):
  -- recriá-lo a partir de uma versão diferente apagaria um bloco em uso.
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.obras_historico'::regclass
                   and conname = 'obras_historico_bloco_check'
                   and pg_get_constraintdef(oid) ilike '%''Cancelamento''%') then
    raise exception 'obras_historico_bloco_check não aceita ''Cancelamento'': o banco não está no estado esperado. Rode o PASSO 0 e confira. Nada foi alterado.';
  end if;

  select prosrc into v_src from pg_proc
  where oid = to_regprocedure('public.obras_aplicar_alteracao(uuid, jsonb, jsonb)');
  if md5(v_src) <> 'aeb70b0d0d9df777d2ca803e22c469ce' and v_src not like '%diario_agendado_ate%' then
    raise exception 'A RPC obras_aplicar_alteracao em produção não é a de sdd-sql-obras-cancelamento.sql (md5 %). Esta migration a substituiria inteira e apagaria a mudança. Confira antes. Nada foi alterado.', md5(v_src);
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 1. As cinco colunas do agendamento.
-- ------------------------------------------------------------
alter table public.obras_obra
  add column if not exists diario_agendado_ate date,
  add column if not exists diario_agendado_oque text,
  add column if not exists diario_agendado_motivo text,
  add column if not exists diario_agendado_por text,
  add column if not exists diario_agendado_em timestamptz;

comment on column public.obras_obra.diario_agendado_ate is
  'Agendar e tirar do diário: dia em que a obra VOLTA ao diário. Fora da fila enquanto hoje (Brasília) < esta data. Vazio = sem agendamento.';

-- ------------------------------------------------------------
-- 2. Coerência: as cinco juntas, motivo da lista, data entre amanhã e +30
--    dias contados do dia (Brasília) em que foi agendado. Os textos dos
--    motivos são os do mockup e têm de bater com MOTIVOS_AGENDAMENTO em
--    app/obras/_lib/agendamento.ts.
-- ------------------------------------------------------------
alter table public.obras_obra drop constraint if exists obras_obra_agendamento_diario_coerente;
alter table public.obras_obra add constraint obras_obra_agendamento_diario_coerente check (
  coalesce(
    (diario_agendado_ate is null
       and diario_agendado_oque is null
       and diario_agendado_motivo is null
       and diario_agendado_por is null
       and diario_agendado_em is null)
    or
    (diario_agendado_ate is not null
       and diario_agendado_em is not null
       and diario_agendado_ate >  (diario_agendado_em at time zone 'America/Sao_Paulo')::date
       and diario_agendado_ate <= (diario_agendado_em at time zone 'America/Sao_Paulo')::date + 30
       and diario_agendado_oque is not null
       and btrim(diario_agendado_oque) <> ''
       and char_length(diario_agendado_oque) <= 80
       and diario_agendado_por is not null
       and btrim(diario_agendado_por) <> ''
       and diario_agendado_motivo is not null
       and (diario_agendado_motivo in ('Aguardando levantamento de material',
                                       'Aguardando material',
                                       'Aguardando cliente / liberação da loja')
            or (left(diario_agendado_motivo, 7) = 'Outro: '
                and char_length(btrim(substr(diario_agendado_motivo, 8))) between 1 and 100)))
  , false)
);

-- ------------------------------------------------------------
-- 3. Histórico: bloco e campo novos. Recriados a partir das listas atuais
--    (conferidas em produção em 16/10/2026), acrescentando só o item novo.
-- ------------------------------------------------------------
alter table public.obras_historico drop constraint obras_historico_bloco_check;
alter table public.obras_historico add constraint obras_historico_bloco_check
  check (bloco in ('Triagem','Autorização','Identificação','Cronograma','Esteira','Cancelamento','Agendamento'));

alter table public.obras_historico drop constraint obras_historico_campo_check;
alter table public.obras_historico add constraint obras_historico_campo_check
  check (campo in (
    'pcm','equipe','prioridade','inicio_plan','duracao',
    'liberado_por','liberado_em','os_aprovada_em',
    'tipo','valor','origem','analista_cliente','mau_uso',
    'etapa','marco_exec_fim','marco_relatorio','marco_fechou_os',
    'marco_liberou_fat','marco_faturou',
    'diario_agendado_ate'
  ));

-- ------------------------------------------------------------
-- 4. RPC obras_aplicar_alteracao — IDÊNTICA à da seção 6 de
--    sdd-sql-obras-cancelamento.sql, com as cinco colunas do agendamento
--    acrescentadas no FIM das três listas: v_colunas_validas, o `set (...)` e o
--    `select`. Não escreva os nomes das colunas novas em comentário DENTRO do
--    corpo: a verificação 7 conta as ocorrências.
-- ------------------------------------------------------------
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
    'diario_agendado_ate','diario_agendado_oque','diario_agendado_motivo','diario_agendado_por','diario_agendado_em'
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
    diario_agendado_ate, diario_agendado_oque, diario_agendado_motivo, diario_agendado_por, diario_agendado_em
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
      diario_agendado_ate, diario_agendado_oque, diario_agendado_motivo, diario_agendado_por, diario_agendado_em
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
$$;

revoke execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) to authenticated;

commit;


-- ============================================================
-- PARTE 2 — VERIFICAÇÃO. Rodar DEPOIS do commit, sozinha.
-- Uma linha por invariante. Qualquer *** FALHOU *** = parar e não deployar.
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'as 5 colunas do agendamento existem', '5',
      (select count(*)::text from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_obra'
         and column_name in ('diario_agendado_ate','diario_agendado_oque','diario_agendado_motivo',
                             'diario_agendado_por','diario_agendado_em'))),
  (2, 'diario_agendado_ate é date', 'date',
      (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'diario_agendado_ate')),
  (3, 'diario_agendado_em é timestamptz', 'timestamp with time zone',
      (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'diario_agendado_em')),
  (4, 'CHECK de coerência existe e está validado', 'true',
      (select convalidated::text from pg_constraint
       where conrelid = 'public.obras_obra'::regclass
         and conname = 'obras_obra_agendamento_diario_coerente')),
  (5, 'histórico aceita o bloco Agendamento e mantém Cancelamento', 'true',
      (select (pg_get_constraintdef(oid) ilike '%''Agendamento''%'
               and pg_get_constraintdef(oid) ilike '%''Cancelamento''%')::text
       from pg_constraint
       where conrelid = 'public.obras_historico'::regclass and conname = 'obras_historico_bloco_check')),
  (6, 'histórico aceita o campo diario_agendado_ate e mantém marco_faturou', 'true',
      (select (pg_get_constraintdef(oid) ilike '%''diario_agendado_ate''%'
               and pg_get_constraintdef(oid) ilike '%''marco_faturou''%')::text
       from pg_constraint
       where conrelid = 'public.obras_historico'::regclass and conname = 'obras_historico_campo_check')),
  (7, 'RPC cita as 5 colunas novas nas 3 listas', '15',
      (select count(*)::text
       from pg_proc p,
            regexp_matches(p.prosrc, 'diario_agendado_(ate|oque|motivo|por|em)\M', 'g')
       where p.oid = to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'))),
  (8, 'RPC continua citando as 5 colunas do cancelamento nas 3 listas', '15',
      (select count(*)::text
       from pg_proc p,
            regexp_matches(p.prosrc, 'cancelado_(por|obs|em|quem|etapa_anterior)\M', 'g')
       where p.oid = to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'))),
  (9, 'RPC continua recusando coluna desconhecida (B1)', 'true',
      (select (prosrc ilike '%coluna desconhecida em p_campos%')::text from pg_proc
       where oid = to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'))),
  (10, 'RPC continua security invoker', 'false',
      (select prosecdef::text from pg_proc
       where oid = to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'))),
  (11, 'RPC: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.obras_aplicar_alteracao(uuid,jsonb,jsonb)', 'EXECUTE')
            and not has_function_privilege('anon', 'public.obras_aplicar_alteracao(uuid,jsonb,jsonb)', 'EXECUTE'))::text)),
  (12, 'RLS de obras_obra inalterada: ligada e só a policy "obras access"', 'true|obras access',
      (select (select relrowsecurity::text from pg_class where oid = 'public.obras_obra'::regclass)
              || '|' || string_agg(policyname, ',')
       from pg_policies where schemaname = 'public' and tablename = 'obras_obra')),
  (13, 'nenhuma obra agendada logo após aplicar', '0',
      (select count(*)::text from public.obras_obra where diario_agendado_ate is not null))
) as t(n, verificacao, esperado, encontrado)
order by n;


-- ============================================================
-- PARTE 3 — TESTE DE COMPORTAMENTO (não grava nada). Rodar sozinho, como
-- postgres, DEPOIS da PARTE 2 dar 13/13 OK.
--
-- Cria dois usuários (um com acesso a obras, outro sem), uma obra de mentira
-- DENTRO da transação, troca para `role authenticated` com
-- `request.jwt.claims` forjado (como o PostgREST faz) e prova cada regra. O
-- bloco TERMINA EM ERRO DE PROPÓSITO: o `raise` final é o relatório e a
-- garantia de rollback (mesmo padrão de sdd-sql-obras-cancelamento.sql).
-- Leitura: a mensagem termina em
--   "RESUMO: 12/12 OK"            -> passou
--   "RESUMO: ... *** FALHOU ***"  -> não deployar
-- Nada toca obra real: a fixture tem loja '__TESTE_AGENDAMENTO'.
-- ============================================================
begin;

do $$
declare
  uid     constant uuid := '00000000-0000-4000-a000-0000000000d1';
  mail    constant text := '__teste_agendamento@manfac.com.br';
  uid2    constant uuid := '00000000-0000-4000-a000-0000000000d2';
  mail2   constant text := '__teste_agendamento_sem_acesso@manfac.com.br';
  o1      constant uuid := '00000000-0000-4000-b000-0000000000d1';
  v_hoje  date := (now() at time zone 'America/Sao_Paulo')::date;
  r       text[] := '{}';
  n_ok    int := 0;
  n_total int := 0;
  v_txt   text;
  v_int   int;
  ag      jsonb;
  limpa   jsonb := jsonb_build_object(
            'diario_agendado_ate', null, 'diario_agendado_oque', null, 'diario_agendado_motivo', null,
            'diario_agendado_por', null, 'diario_agendado_em', null);
begin
  -- ---------- FIXTURES (como postgres, acima da RLS) ----------
  insert into auth.users (id, email, aud, role) values
    (uid,  mail,  'authenticated', 'authenticated'),
    (uid2, mail2, 'authenticated', 'authenticated');

  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
  values (mail, 'obras', true, 'teste-agendamento');

  insert into public.obras_obra (id, loja, os, etapa, desde_etapa, pcm)
  values (o1, '__TESTE_AGENDAMENTO', 'T-AG-1', 'levantamento', '2026-10-01', 'YURI');

  ag := jsonb_build_object(
    'diario_agendado_ate', v_hoje + 7,
    'diario_agendado_oque', 'Levantamento de material',
    'diario_agendado_motivo', 'Aguardando material',
    'diario_agendado_por', mail,
    'diario_agendado_em', now());

  -- ---------- como usuário COM acesso ----------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);

  -- (a) agendar pela RPC grava as 5 colunas e UMA linha de histórico 'Agendamento'
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag,
      jsonb_build_array(jsonb_build_object('bloco', 'Agendamento', 'campo', 'diario_agendado_ate',
        'de', null, 'para', to_char(v_hoje + 7, 'DD/MM/YYYY'),
        'motivo', 'Levantamento de material — Aguardando material')));
    select diario_agendado_ate::text || '|' || diario_agendado_motivo || '|' || diario_agendado_por || '|' || etapa
      into v_txt from public.obras_obra where id = o1;
    select count(*) into v_int from public.obras_historico where obra_id = o1 and bloco = 'Agendamento';
    if v_txt = (v_hoje + 7)::text || '|Aguardando material|' || mail || '|levantamento' and v_int = 1 then
      n_ok := n_ok + 1; r := r || '(a) agendar pela RPC: OK'::text;
    else
      r := r || format('(a) agendar pela RPC: *** FALHOU *** (%s, %s linhas)', v_txt, v_int)::text;
    end if;
  exception when others then
    r := r || ('(a) agendar pela RPC: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (b) data a 31 dias é recusada
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag || jsonb_build_object('diario_agendado_ate', v_hoje + 31), '[]'::jsonb);
    r := r || '(b) data a 31 dias: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(b) data a 31 dias: OK (recusado)'::text;
  end;

  -- (c) data a 30 dias é aceita (limite incluído)
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag || jsonb_build_object('diario_agendado_ate', v_hoje + 30), '[]'::jsonb);
    n_ok := n_ok + 1; r := r || '(c) data a 30 dias: OK (aceito)'::text;
  exception when others then
    r := r || ('(c) data a 30 dias: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (d) data de hoje (volta hoje = não sai do diário) é recusada
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag || jsonb_build_object('diario_agendado_ate', v_hoje), '[]'::jsonb);
    r := r || '(d) data de hoje: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(d) data de hoje: OK (recusado)'::text;
  end;

  -- (e) motivo fora da lista é recusado
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag || jsonb_build_object('diario_agendado_motivo', 'Clima'), '[]'::jsonb);
    r := r || '(e) motivo fora da lista: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(e) motivo fora da lista: OK (recusado)'::text;
  end;

  -- (f) "Outro: <texto>" é aceito
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag || jsonb_build_object('diario_agendado_motivo', 'Outro: loja em inventário'), '[]'::jsonb);
    n_ok := n_ok + 1; r := r || '(f) motivo Outro com texto: OK (aceito)'::text;
  exception when others then
    r := r || ('(f) motivo Outro com texto: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g) "Outro: " sem texto é recusado
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag || jsonb_build_object('diario_agendado_motivo', 'Outro:   '), '[]'::jsonb);
    r := r || '(g) motivo Outro vazio: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(g) motivo Outro vazio: OK (recusado)'::text;
  end;

  -- (h) agendamento pela metade (sem data, resto preenchido) é recusado
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag || jsonb_build_object('diario_agendado_ate', null), '[]'::jsonb);
    r := r || '(h) agendamento pela metade: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(h) agendamento pela metade: OK (recusado)'::text;
  end;

  -- (i) "O que vai acontecer" vazio é recusado
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag || jsonb_build_object('diario_agendado_oque', '  '), '[]'::jsonb);
    r := r || '(i) o que vai acontecer vazio: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(i) o que vai acontecer vazio: OK (recusado)'::text;
  end;

  -- (j) limpar as 5 colunas (Marcar como feito / Trazer de volta) grava a 2ª linha de histórico
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, limpa,
      jsonb_build_array(jsonb_build_object('bloco', 'Agendamento', 'campo', 'diario_agendado_ate',
        'de', to_char(v_hoje + 7, 'DD/MM/YYYY'), 'para', null, 'motivo', 'Marcado como feito')));
    select count(*) into v_int from public.obras_obra
     where id = o1 and diario_agendado_ate is null and diario_agendado_oque is null
       and diario_agendado_motivo is null and diario_agendado_por is null and diario_agendado_em is null;
    select v_int::text || '|' || count(*)::text into v_txt
      from public.obras_historico where obra_id = o1 and bloco = 'Agendamento';
    if v_txt = '1|2' then
      n_ok := n_ok + 1; r := r || '(j) limpar o agendamento pela RPC: OK'::text;
    else
      r := r || format('(j) limpar o agendamento pela RPC: *** FALHOU *** (%s)', v_txt)::text;
    end if;
  exception when others then
    r := r || ('(j) limpar o agendamento pela RPC: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (k) a RPC continua recusando coluna desconhecida (B1)
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, '{"coluna_que_nao_existe": "x"}'::jsonb, '[]'::jsonb);
    r := r || '(k) coluna desconhecida na RPC: *** FALHOU *** (passou)'::text;
  exception when sqlstate '22023' then
    n_ok := n_ok + 1; r := r || '(k) coluna desconhecida na RPC: OK (recusado)'::text;
  end;

  -- ---------- como usuário SEM acesso a obras ----------
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid2, 'email', mail2, 'role', 'authenticated')::text, true);

  -- (l) sem acesso, a RPC levanta 42501 e não grava
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o1, ag, '[]'::jsonb);
    r := r || '(l) agendar sem acesso: *** FALHOU *** (passou)'::text;
  exception when sqlstate '42501' then
    n_ok := n_ok + 1; r := r || '(l) agendar sem acesso: OK (recusado)'::text;
  end;

  -- ---------- RELATÓRIO + ROLLBACK FORÇADO ----------
  raise exception E'TESTE agendamento do diário (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;
