-- ============================================================
-- Controle de Obras — CANCELAMENTO DE OBRA — 2026-09-23
-- Spec:  docs/cliente/2026-08-31-sistema-controle-de-obras/spec-cancelamento-obra-2026-09-23.md
-- Plano: docs/cliente/2026-08-31-sistema-controle-de-obras/plano-cancelamento-obra-2026-09-23.md
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão, projeto de produção iyytcavcgukfjnjjrerx
-- (confirme o ref antes — AGENTS.md). Aplicar ANTES do deploy do código do
-- cancelamento. O código que está no ar hoje continua funcionando com esta
-- migration aplicada: nenhuma obra fica cancelada até alguém usar o botão novo,
-- e a RPC só GANHA colunas aceitas (nenhuma sai).
--
-- O QUE MUDA
--   1. obras_obra.etapa passa a aceitar 'cancelado'.
--   2. Cinco colunas novas em obras_obra: cancelado_por, cancelado_obs,
--      cancelado_em, cancelado_quem, cancelado_etapa_anterior.
--   3. CHECK obras_obra_cancelamento_coerente: obra cancelada TEM quem, quando,
--      por quem (cliente/manfac) e uma etapa anterior de antes do fim da execução
--      (resposta 2B do cliente); obra não cancelada tem as cinco colunas vazias.
--   4. Trigger obras_obra_transicao_cancelamento: a etapa anterior gravada é a
--      etapa em que a obra ESTAVA; desfazer só volta para essa etapa; enquanto
--      cancelada, os dados do cancelamento não mudam.
--   5. obras_historico aceita o bloco 'Cancelamento'.
--   6. RPC obras_aplicar_alteracao aceita as cinco colunas novas.
--
-- COMO RODAR — em TRÊS passos separados (o SQL Editor só mostra o resultado da
-- última instrução, e a PARTE 3 termina em erro de propósito):
--   PASSO 0  a consulta de catálogo logo abaixo (só leitura);
--   PASSO 1  do `begin;` da PARTE 1 até o `commit;`;
--   PASSO 2  a consulta de verificação da PARTE 2 — qualquer *** FALHOU *** =
--            parar e não deployar;
--   PASSO 3  o teste de comportamento da PARTE 3 (rollback forçado, não grava
--            nada). A mensagem de erro final é o relatório: "RESUMO: 11/11 OK".
--            Sem a linha "RESUMO" na mensagem = FALHOU (erro diferente do esperado).
--
-- IDEMPOTENTE: drop constraint/trigger if exists antes de recriar, add column if
-- not exists, create or replace function. Reaplicar o arquivo inteiro é seguro.
--
-- ARMADILHAS DO .claude/rules/sql.md
--   (1) Guarda que falha ABERTA com NULL: não há guarda de autorização nova (a
--       RPC mantém a sua, exists()-based). O CHECK de coerência é envolvido em
--       coalesce(..., false) e cada `in (...)` vem com `is not null` antes —
--       CHECK trata NULL como aprovado, e sem isso uma obra 'cancelado' com
--       cancelado_por NULL passaria.
--   (2) Trigger compartilhada: não se aplica — a trigger é só de obras_obra.
--
-- ROLLBACK (só se nenhuma obra tiver sido cancelada ainda; confira antes com
--   select count(*) from public.obras_obra where etapa = 'cancelado'; -> 0
--   select count(*) from public.obras_historico where bloco = 'Cancelamento'; -> 0):
--   begin;
--   drop trigger if exists obras_obra_transicao_cancelamento on public.obras_obra;
--   drop function if exists public.obras_obra_transicao_cancelamento();
--   alter table public.obras_obra drop constraint if exists obras_obra_cancelamento_coerente;
--   alter table public.obras_obra drop constraint obras_obra_etapa_check;
--   alter table public.obras_obra add constraint obras_obra_etapa_check
--     check (etapa in ('definir','levantamento','andamento','paralisado',
--                      'relatorio','aprovarOS','fecharOS','pendFat','faturado'));
--   alter table public.obras_historico drop constraint obras_historico_bloco_check;
--   alter table public.obras_historico add constraint obras_historico_bloco_check
--     check (bloco in ('Triagem','Autorização','Identificação','Cronograma','Esteira'));
--   -- ORDEM OBRIGATÓRIA: restaurar a RPC (seção 3 de sdd-sql-obras-historico.sql)
--   -- ANTES de dropar as colunas — a RPC nova cita cancelado_*, e sem elas a RPC
--   -- quebra inteira (ficha e remarcação param).
--   -- As cinco colunas podem ficar (vazias, não atrapalham) ou sair com
--   -- alter table public.obras_obra drop column if exists cancelado_por, ... ;
--   commit;
-- ============================================================


-- ============================================================
-- PASSO 0 — CONSULTA DE CATÁLOGO (só leitura). Rodar ANTES da PARTE 1.
-- ============================================================
-- (a) O nome real do CHECK de etapa. Ele foi criado INLINE em
--     sdd-sql-obras-v0.sql:84-86, então o nome foi dado pelo Postgres.
--
-- select conname, pg_get_constraintdef(oid) as definicao
-- from pg_constraint
-- where conrelid = 'public.obras_obra'::regclass
--   and contype = 'c'
--   and pg_get_constraintdef(oid) ilike '%etapa%'
-- order by conname;
--
--   Esperado na PRIMEIRA aplicação: exatamente 1 linha,
--     obras_obra_etapa_check | CHECK ((etapa = ANY (ARRAY['definir'::text, ...,'faturado'::text])))
--   Se o nome for OUTRO: não aplique. Troque `obras_obra_etapa_check` pelo nome
--   real na seção 0 e na seção 1 deste arquivo (o add pode manter o nome novo).
--   Numa reaplicação aparecem 2 linhas (o de etapa, já com 'cancelado', e
--   obras_obra_cancelamento_coerente) — é o esperado.
--
-- (b) A RPC em produção é a de sdd-sql-obras-historico.sql (a seção 6 abaixo
--     a SUBSTITUI inteira; se alguém a tiver mudado à mão, a mudança se perde):
--
-- select pg_get_functiondef('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'::regprocedure);
--
--   Esperado: a lista v_colunas_validas com 34 colunas, terminando em
--   'bloqueada_dias', igual a sdd-sql-obras-historico.sql:177-184.
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
  v_outros text;
begin
  if to_regclass('public.obras_obra') is null or to_regclass('public.obras_historico') is null then
    raise exception 'Pré-requisito ausente: rode sdd-sql-obras-v0.sql e sdd-sql-obras-historico.sql antes deste arquivo.';
  end if;

  if to_regprocedure('public.obras_aplicar_alteracao(uuid, jsonb, jsonb)') is null then
    raise exception 'Pré-requisito ausente: public.obras_aplicar_alteracao(uuid, jsonb, jsonb). Rode sdd-sql-obras-historico.sql antes.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'etapa_por'
  ) then
    raise exception 'Pré-requisito ausente: coluna obras_obra.etapa_por (sdd-sql-obras-v0.sql).';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.obras_obra'::regclass
      and conname = 'obras_obra_etapa_check'
      and contype = 'c'
  ) then
    raise exception 'O CHECK de etapa de obras_obra não se chama obras_obra_etapa_check. Rode a consulta do PASSO 0 (a), ajuste o nome neste arquivo e aplique de novo. Nada foi alterado.';
  end if;

  -- Outro CHECK que também restrinja etapa (nome diferente, criado à mão)
  -- faria o 'cancelado' continuar recusado depois desta migration "passar".
  select string_agg(conname, ', ') into v_outros
  from pg_constraint
  where conrelid = 'public.obras_obra'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%''definir''%'
    and conname not in ('obras_obra_etapa_check', 'obras_obra_cancelamento_coerente');
  if v_outros is not null then
    raise exception 'Há outro CHECK que restringe etapa em obras_obra (%). Confira no PASSO 0 antes de aplicar. Nada foi alterado.', v_outros;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.obras_historico'::regclass
      and conname = 'obras_historico_bloco_check'
  ) then
    raise exception 'Pré-requisito ausente: obras_historico_bloco_check (sdd-sql-obras-historico.sql).';
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 1. Etapa 'cancelado'. Nome confirmado pelo PASSO 0 (a).
-- ------------------------------------------------------------
alter table public.obras_obra drop constraint obras_obra_etapa_check;
alter table public.obras_obra add constraint obras_obra_etapa_check
  check (etapa in ('definir','levantamento','andamento','paralisado',
                   'relatorio','aprovarOS','fecharOS','pendFat','faturado',
                   'cancelado'));

-- ------------------------------------------------------------
-- 2. As cinco colunas do cancelamento.
--    cancelado_por            'cliente' | 'manfac' — o motivo estruturado pedido
--                             pelo cliente em 10/09 (feedback 11). Opção fechada,
--                             nunca texto livre, para dar para contar.
--    cancelado_obs            o "o que aconteceu", opcional (decisão de 23/09).
--    cancelado_em             quando foi cancelada.
--    cancelado_quem           e-mail de quem registrou (como etapa_por).
--    cancelado_etapa_anterior para o "Desfazer" devolver a obra à etapa exata.
-- ------------------------------------------------------------
alter table public.obras_obra
  add column if not exists cancelado_por text,
  add column if not exists cancelado_obs text,
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_quem text,
  add column if not exists cancelado_etapa_anterior text;

-- ------------------------------------------------------------
-- 3. Coerência: cancelada <=> tem os dados do cancelamento.
--    A etapa anterior é sempre de ANTES do fim da execução em campo: a resposta
--    2B do cliente (14/09) é que obra executada não se cancela.
--    Toda linha existente passa: nenhuma está cancelada, e as colunas acabaram
--    de nascer vazias.
-- ------------------------------------------------------------
alter table public.obras_obra drop constraint if exists obras_obra_cancelamento_coerente;
alter table public.obras_obra add constraint obras_obra_cancelamento_coerente check (
  coalesce(
    (etapa = 'cancelado'
       and cancelado_por is not null
       and cancelado_por in ('cliente', 'manfac')
       and cancelado_em is not null
       and cancelado_quem is not null
       and btrim(cancelado_quem) <> ''
       and cancelado_etapa_anterior is not null
       and cancelado_etapa_anterior in ('definir', 'levantamento', 'andamento', 'paralisado'))
    or
    (etapa <> 'cancelado'
       and cancelado_por is null
       and cancelado_obs is null
       and cancelado_em is null
       and cancelado_quem is null
       and cancelado_etapa_anterior is null),
    false
  )
);

-- ------------------------------------------------------------
-- 4. Transições. O CHECK acima olha UMA linha; ele não sabe em que etapa a obra
--    estava antes do update. Sem esta trigger, um cancelamento podia gravar
--    "estava em andamento" numa obra que estava em Relatório de entrega (e
--    furar o 2B), e um desfazer podia devolver a obra para qualquer etapa.
--    Ela também fecha a corrida entre ler a obra no servidor e gravar: se outra
--    pessoa mudou a etapa nesse meio-tempo, a gravação é recusada inteira.
--    security invoker (padrão): não eleva privilégio.
-- ------------------------------------------------------------
create or replace function public.obras_obra_transicao_cancelamento()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if old.etapa is distinct from 'cancelado' and new.etapa = 'cancelado' then
    if new.cancelado_etapa_anterior is distinct from old.etapa then
      raise exception 'Cancelamento incoerente: a obra está em "%", e o cancelamento registra "%".',
        old.etapa, coalesce(new.cancelado_etapa_anterior, '(vazio)')
        using errcode = '23514';
    end if;
  elsif old.etapa = 'cancelado' and new.etapa is distinct from 'cancelado' then
    if new.etapa is distinct from old.cancelado_etapa_anterior then
      raise exception 'Desfazer o cancelamento devolve a obra para "%", não para "%".',
        old.cancelado_etapa_anterior, new.etapa
        using errcode = '23514';
    end if;
  elsif old.etapa = 'cancelado' and new.etapa = 'cancelado' then
    if (new.cancelado_por, new.cancelado_obs, new.cancelado_em,
        new.cancelado_quem, new.cancelado_etapa_anterior)
       is distinct from
       (old.cancelado_por, old.cancelado_obs, old.cancelado_em,
        old.cancelado_quem, old.cancelado_etapa_anterior) then
      raise exception 'Obra já cancelada: os dados do cancelamento não mudam. Desfaça o cancelamento primeiro.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists obras_obra_transicao_cancelamento on public.obras_obra;
create trigger obras_obra_transicao_cancelamento
  before update of etapa, cancelado_por, cancelado_obs, cancelado_em,
                   cancelado_quem, cancelado_etapa_anterior
  on public.obras_obra
  for each row
  execute function public.obras_obra_transicao_cancelamento();

-- ------------------------------------------------------------
-- 5. Histórico: bloco novo. O campo continua 'etapa' (já aceito pelo
--    obras_historico_campo_check); quem cancelou e a observação vão na coluna
--    `motivo` da linha.
-- ------------------------------------------------------------
alter table public.obras_historico drop constraint obras_historico_bloco_check;
alter table public.obras_historico add constraint obras_historico_bloco_check
  check (bloco in ('Triagem','Autorização','Identificação','Cronograma','Esteira','Cancelamento'));

-- ------------------------------------------------------------
-- 6. RPC obras_aplicar_alteracao — IDÊNTICA à de sdd-sql-obras-historico.sql
--    (seção 3; os comentários longos estão lá), com as cinco colunas do
--    cancelamento acrescentadas no FIM das três listas: v_colunas_validas, o
--    `set (...)` e o `select`. Sem isso a RPC recusa a chave (B1: raise, não
--    silêncio). Não escreva os nomes das colunas novas em comentário DENTRO do
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
    'cancelado_por','cancelado_obs','cancelado_em','cancelado_quem','cancelado_etapa_anterior'
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
    cancelado_por, cancelado_obs, cancelado_em, cancelado_quem, cancelado_etapa_anterior
  ) = (
    select
      pcm, equipe, prioridade, inicio_plan, duracao,
      liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
      tipo, valor, origem, analista_cliente, mau_uso,
      etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
      marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou,
      bloqueio, pendencia, pend_resp, pend_prazo, prox_acao,
      inicio_real, fim_real, nao_andou_seguidos, bloqueada_dias,
      cancelado_por, cancelado_obs, cancelado_em, cancelado_quem, cancelado_etapa_anterior
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
  (1, 'CHECK de etapa aceita cancelado', 'true',
      (select (pg_get_constraintdef(oid) ilike '%''cancelado''%')::text
       from pg_constraint
       where conrelid = 'public.obras_obra'::regclass and conname = 'obras_obra_etapa_check')),
  (2, 'só UM check restringe etapa (fora o de coerência)', '1',
      (select count(*)::text from pg_constraint
       where conrelid = 'public.obras_obra'::regclass and contype = 'c'
         and pg_get_constraintdef(oid) ilike '%''definir''%'
         and conname <> 'obras_obra_cancelamento_coerente')),
  (3, 'as 5 colunas do cancelamento existem', '5',
      (select count(*)::text from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_obra'
         and column_name in ('cancelado_por','cancelado_obs','cancelado_em',
                             'cancelado_quem','cancelado_etapa_anterior'))),
  (4, 'cancelado_em é timestamptz', 'timestamp with time zone',
      (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_obra'
         and column_name = 'cancelado_em')),
  (5, 'CHECK de coerência existe e está validado', 'true',
      (select convalidated::text from pg_constraint
       where conrelid = 'public.obras_obra'::regclass
         and conname = 'obras_obra_cancelamento_coerente')),
  (6, 'trigger de transição existe e está ligada', 'O',
      (select tgenabled::text from pg_trigger
       where tgrelid = 'public.obras_obra'::regclass
         and tgname = 'obras_obra_transicao_cancelamento' and not tgisinternal)),
  (7, 'RPC cita as 5 colunas novas nas 3 listas', '15',
      (select count(*)::text
       from pg_proc p,
            regexp_matches(p.prosrc, 'cancelado_(por|obs|em|quem|etapa_anterior)\M', 'g')
       where p.oid = to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'))),
  (8, 'RPC continua recusando coluna desconhecida (B1)', 'true',
      (select (prosrc ilike '%coluna desconhecida em p_campos%')::text from pg_proc
       where oid = to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'))),
  (9, 'RPC continua security invoker', 'false',
      (select prosecdef::text from pg_proc
       where oid = to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'))),
  (10, 'RPC: authenticated executa, anon não', 'true',
      (select (has_function_privilege('authenticated', 'public.obras_aplicar_alteracao(uuid,jsonb,jsonb)', 'EXECUTE')
            and not has_function_privilege('anon', 'public.obras_aplicar_alteracao(uuid,jsonb,jsonb)', 'EXECUTE'))::text)),
  (11, 'histórico aceita o bloco Cancelamento', 'true',
      (select (pg_get_constraintdef(oid) ilike '%''Cancelamento''%')::text
       from pg_constraint
       where conrelid = 'public.obras_historico'::regclass
         and conname = 'obras_historico_bloco_check'))
) as t(n, verificacao, esperado, encontrado)
order by n;


-- ============================================================
-- PARTE 3 — TESTE DE COMPORTAMENTO (não grava nada). Rodar sozinho, como
-- postgres, DEPOIS da PARTE 2 dar 11/11 OK.
--
-- Cria usuário, acesso e três obras de mentira DENTRO da transação, troca para
-- `role authenticated` com `request.jwt.claims` forjado (como o PostgREST faz)
-- e prova cada regra. O bloco TERMINA EM ERRO DE PROPÓSITO: o `raise` final é
-- o relatório e a garantia de rollback (mesmo padrão de
-- sdd-sql-hub-comunicados-teste-rls.sql). Leitura: a mensagem termina em
--   "RESUMO: 11/11 OK"            -> passou
--   "RESUMO: ... *** FALHOU ***"  -> não deployar
-- Nada toca obra real: as fixtures têm loja '__TESTE_CANCELAMENTO'.
-- ============================================================
begin;

do $$
declare
  uid     constant uuid := '00000000-0000-4000-a000-0000000000c1';
  mail    constant text := '__teste_cancelamento@manfac.com.br';
  o_and   constant uuid := '00000000-0000-4000-b000-0000000000a1'; -- em andamento
  o_rel   constant uuid := '00000000-0000-4000-b000-0000000000a2'; -- relatório (pós-campo)
  o_lev   constant uuid := '00000000-0000-4000-b000-0000000000a3'; -- levantamento
  r       text[] := '{}';
  n_ok    int := 0;
  n_total int := 0;
  v_txt   text;
  v_int   int;
  canc_cliente jsonb;
begin
  -- ---------- FIXTURES (como postgres, acima da RLS) ----------
  insert into auth.users (id, email, aud, role)
  values (uid, mail, 'authenticated', 'authenticated');

  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
  values (mail, 'obras', true, 'teste-cancelamento');

  insert into public.obras_obra (id, loja, os, etapa, desde_etapa) values
    (o_and, '__TESTE_CANCELAMENTO', 'T-1', 'andamento',    '2026-09-01'),
    (o_rel, '__TESTE_CANCELAMENTO', 'T-2', 'relatorio',    '2026-09-01'),
    (o_lev, '__TESTE_CANCELAMENTO', 'T-3', 'levantamento', '2026-09-01');

  canc_cliente := jsonb_build_object(
    'etapa', 'cancelado', 'cancelado_por', 'cliente', 'cancelado_obs', 'teste',
    'cancelado_em', now(), 'cancelado_quem', mail, 'cancelado_etapa_anterior', 'andamento',
    'etapa_por', mail, 'etapa_em', now());

  -- ---------- como usuário COM acesso ----------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);

  -- (a) cancelar pela RPC grava a etapa e UMA linha de histórico 'Cancelamento'
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o_and, canc_cliente,
      jsonb_build_array(jsonb_build_object('bloco', 'Cancelamento', 'campo', 'etapa',
        'de', 'Em andamento', 'para', 'Cancelada', 'motivo', 'Cancelado pelo Cliente — teste')));
    select etapa into v_txt from public.obras_obra where id = o_and;
    select count(*) into v_int from public.obras_historico where obra_id = o_and and bloco = 'Cancelamento';
    if v_txt = 'cancelado' and v_int = 1 then
      n_ok := n_ok + 1; r := r || '(a) cancelar pela RPC: OK'::text;
    else
      r := r || format('(a) cancelar pela RPC: *** FALHOU *** (etapa %s, %s linhas)', v_txt, v_int)::text;
    end if;
  exception when others then
    r := r || ('(a) cancelar pela RPC: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (b) cancelar não mexe no contador de dias da etapa
  n_total := n_total + 1;
  select desde_etapa::text into v_txt from public.obras_obra where id = o_and;
  if v_txt = '2026-09-01' then
    n_ok := n_ok + 1; r := r || '(b) desde_etapa intacto ao cancelar: OK'::text;
  else
    r := r || format('(b) desde_etapa intacto ao cancelar: *** FALHOU *** (%s)', v_txt)::text;
  end if;

  -- (c) obra cancelada não muda de etapa por update direto (sem desfazer)
  n_total := n_total + 1;
  begin
    update public.obras_obra set etapa = 'relatorio' where id = o_and;
    r := r || '(c) trocar etapa de obra cancelada: *** FALHOU *** (update passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(c) trocar etapa de obra cancelada: OK (recusado)'::text;
  end;

  -- (d) desfazer para etapa diferente da anterior é recusado, mesmo limpando tudo
  n_total := n_total + 1;
  begin
    update public.obras_obra set etapa = 'levantamento', cancelado_por = null, cancelado_obs = null,
      cancelado_em = null, cancelado_quem = null, cancelado_etapa_anterior = null
    where id = o_and;
    r := r || '(d) desfazer para a etapa errada: *** FALHOU *** (update passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(d) desfazer para a etapa errada: OK (recusado)'::text;
  end;

  -- (e) enquanto cancelada, os dados do cancelamento não mudam
  n_total := n_total + 1;
  begin
    update public.obras_obra set cancelado_por = 'manfac' where id = o_and;
    r := r || '(e) trocar quem cancelou: *** FALHOU *** (update passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(e) trocar quem cancelou: OK (recusado)'::text;
  end;

  -- (f) 2B: obra pós-campo não cancela, dizendo a verdade sobre a etapa
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o_rel,
      canc_cliente || jsonb_build_object('cancelado_etapa_anterior', 'relatorio'), '[]'::jsonb);
    r := r || '(f) cancelar obra em Relatório: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(f) cancelar obra em Relatório: OK (recusado)'::text;
  end;

  -- (g) 2B: nem mentindo a etapa anterior
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o_rel, canc_cliente, '[]'::jsonb);
    r := r || '(g) cancelar Relatório dizendo "andamento": *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(g) cancelar Relatório dizendo "andamento": OK (recusado)'::text;
  end;

  -- (h) sem quem cancelou (NULL) não cancela — a armadilha do NULL no CHECK
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o_lev,
      canc_cliente || jsonb_build_object('cancelado_por', null,
                                         'cancelado_etapa_anterior', 'levantamento'), '[]'::jsonb);
    r := r || '(h) cancelar sem cancelado_por: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(h) cancelar sem cancelado_por: OK (recusado)'::text;
  end;

  -- (i) desfazer pela RPC volta à etapa exata, limpa as 5 colunas, mantém desde_etapa
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o_and,
      jsonb_build_object('etapa', 'andamento', 'cancelado_por', null, 'cancelado_obs', null,
        'cancelado_em', null, 'cancelado_quem', null, 'cancelado_etapa_anterior', null,
        'etapa_por', mail, 'etapa_em', now()),
      jsonb_build_array(jsonb_build_object('bloco', 'Cancelamento', 'campo', 'etapa',
        'de', 'Cancelada', 'para', 'Em andamento', 'motivo', 'Cancelamento desfeito')));
    select etapa || '|' || coalesce(cancelado_por, '-') || '|' || desde_etapa::text into v_txt
    from public.obras_obra where id = o_and;
    select count(*) into v_int from public.obras_historico where obra_id = o_and and bloco = 'Cancelamento';
    if v_txt = 'andamento|-|2026-09-01' and v_int = 2 then
      n_ok := n_ok + 1; r := r || '(i) desfazer pela RPC: OK'::text;
    else
      r := r || format('(i) desfazer pela RPC: *** FALHOU *** (%s, %s linhas)', v_txt, v_int)::text;
    end if;
  exception when others then
    r := r || ('(i) desfazer pela RPC: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (j) o CHECK de bloco continua fechado para o que não é da lista
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o_lev, '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('bloco', 'Xyz', 'campo', 'etapa', 'de', 'a', 'para', 'b')));
    r := r || '(j) bloco fora da lista no histórico: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(j) bloco fora da lista no histórico: OK (recusado)'::text;
  end;

  -- (k) a RPC continua recusando coluna desconhecida (B1)
  n_total := n_total + 1;
  begin
    perform public.obras_aplicar_alteracao(o_lev, '{"coluna_que_nao_existe": "x"}'::jsonb, '[]'::jsonb);
    r := r || '(k) coluna desconhecida na RPC: *** FALHOU *** (passou)'::text;
  exception when sqlstate '22023' then
    n_ok := n_ok + 1; r := r || '(k) coluna desconhecida na RPC: OK (recusado)'::text;
  end;

  -- ---------- RELATÓRIO + ROLLBACK FORÇADO ----------
  raise exception E'TESTE cancelamento de obra (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;
