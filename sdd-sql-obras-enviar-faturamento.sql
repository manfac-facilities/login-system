-- ============================================================
-- Controle de Obras — "Enviar para faturamento" na ficha da obra — 2026-10-22
-- Spec: financeiro/docs/superpowers/specs/ (faturamento liberado pela operação)
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor, projeto iyytcavcgukfjnjjrerx.
--
-- O que faz:
--   1. Quatro colunas de rastro em obras_obra: fat_enviado_em, fat_enviado_por,
--      fat_enviado_obs, fat_enviado_etapa_anterior (nulas por padrão).
--   2. obras_enviar_para_faturamento(p_obra_id, p_obs): o usuário logado do Controle de
--      Obras manda a obra para "Pendente faturamento" (pendFat) e grava a data de
--      liberação (marco_liberou_fat = hoje em São Paulo). Recusa obra cancelada, faturada,
--      já enviada, sem cliente e de cliente que libera por e-mail (DPSP / D1000).
--   3. obras_devolver_faturamento(p_obra_id, p_motivo, p_quem): o Financeiro (chave de
--      serviço, sem usuário logado) devolve a obra para a etapa em que estava, com motivo.
--      Devolve { analista, os, loja } para o aviso por e-mail.
--   4. Gatilho obras_obra_cancelar_envio_faturamento: se a etapa mudar para qualquer coisa
--      diferente de pendFat (por qualquer caminho: ficha, planilha, nota faturada), zera
--      fat_enviado_*. NÃO mexe em marco_liberou_fat (obra faturada mantém a data de
--      liberação) e NÃO grava histórico.
--
-- NÃO mexe em obras_aplicar_alteracao: as colunas novas não passam por ela.
--
-- Segurança: tudo `security invoker`. O enviar depende da RLS "obras access" e confere
-- obras_has_access() e o e-mail do JWT (como obras_aplicar_alteracao). O devolver só
-- executa com service_role.
--
-- IDEMPOTENTE: add column if not exists, create or replace function, drop trigger if exists.
-- Rollback: drop trigger obras_obra_cancelar_envio_faturamento on public.obras_obra;
--           drop function public.obras_obra_cancelar_envio_faturamento();
--           drop function public.obras_enviar_para_faturamento(uuid, text);
--           drop function public.obras_devolver_faturamento(uuid, text, text);
--           alter table public.obras_obra drop column fat_enviado_em, drop column fat_enviado_por,
--             drop column fat_enviado_obs, drop column fat_enviado_etapa_anterior;
-- ============================================================

-- 0. Pré-requisitos (aborta se faltar)
do $$
declare
  v_def text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'cliente') then
    raise exception 'pré-requisito: aplicar sdd-sql-obras-cliente.sql antes';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'marco_liberou_fat') then
    raise exception 'pré-requisito: aplicar sdd-sql-obras-v0.sql antes';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'obras_historico' and column_name = 'seq') then
    raise exception 'pré-requisito: aplicar sdd-sql-obras-historico.sql antes';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'obras_has_access') then
    raise exception 'pré-requisito: função obras_has_access() não existe';
  end if;

  -- Os CHECKs do histórico já têm que aceitar o que as funções gravam.
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.obras_historico'::regclass and conname = 'obras_historico_campo_check';
  if v_def is null or v_def not like '%''etapa''%' or v_def not like '%''marco_liberou_fat''%' then
    raise exception 'pré-requisito: obras_historico_campo_check não aceita etapa/marco_liberou_fat';
  end if;
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.obras_historico'::regclass and conname = 'obras_historico_bloco_check';
  if v_def is null or v_def not like '%''Esteira''%' then
    raise exception 'pré-requisito: obras_historico_bloco_check não aceita Esteira';
  end if;
end $$;

begin;

-- 1. Rastro do envio. Só as funções abaixo (e o gatilho) escrevem aqui.
alter table public.obras_obra add column if not exists fat_enviado_em timestamptz;
alter table public.obras_obra add column if not exists fat_enviado_por text;
alter table public.obras_obra add column if not exists fat_enviado_obs text;
alter table public.obras_obra add column if not exists fat_enviado_etapa_anterior text;

-- 2. Enviar para faturamento (usuário logado do Controle de Obras).
create or replace function public.obras_enviar_para_faturamento(p_obra_id uuid, p_obs text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_quem   text := lower(trim(auth.jwt() ->> 'email'));
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_quando timestamptz := now();
  v_obs    text := left(nullif(btrim(p_obs), ''), 500);
  v_antes  public.obras_obra;
  v_motivo text;
begin
  if not public.obras_has_access() then
    raise exception 'Sem acesso ao Controle de Obras' using errcode = '42501';
  end if;
  if v_quem is null or v_quem = '' then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  select * into v_antes from public.obras_obra o where o.id = p_obra_id for update;
  if not found then
    raise exception 'obra não encontrada' using errcode = 'P0002';
  end if;
  if v_antes.etapa = 'cancelado' then
    raise exception 'obra cancelada' using errcode = '22023';
  end if;
  if v_antes.etapa = 'faturado' then
    raise exception 'obra já faturada' using errcode = '22023';
  end if;
  if v_antes.fat_enviado_em is not null or v_antes.etapa = 'pendFat' then
    raise exception 'obra já enviada para faturamento' using errcode = '22023';
  end if;
  if nullif(btrim(v_antes.cliente), '') is null then
    raise exception 'obra sem cliente' using errcode = '22023';
  end if;
  if upper(btrim(v_antes.cliente)) in ('DPSP', 'D1000') then
    raise exception 'cliente libera por e-mail' using errcode = '22023';
  end if;

  v_motivo := 'Enviada para faturamento' || coalesce(': ' || v_obs, '');

  update public.obras_obra o set
    etapa = 'pendFat',
    desde_etapa = v_hoje,
    atualizacao = v_hoje,
    etapa_por = v_quem,
    etapa_em = v_quando,
    marco_liberou_fat = v_hoje,
    fat_enviado_em = v_quando,
    fat_enviado_por = v_quem,
    fat_enviado_obs = v_obs,
    fat_enviado_etapa_anterior = v_antes.etapa
  where o.id = p_obra_id;

  -- Histórico no formato de app/obras/_lib/historico.ts: etapa pelo nome de tela,
  -- datas dd/mm/aaaa, uma linha por campo que mudou.
  insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
  select p_obra_id, 'Esteira', x.campo, x.de, x.para, v_motivo, v_quem, v_quando
    from (values
      ('etapa',
        case v_antes.etapa
          when 'definir' then 'Aguardando definição'
          when 'levantamento' then 'Levantamento'
          when 'andamento' then 'Em andamento'
          when 'paralisado' then 'Paralisado'
          when 'relatorio' then 'Relatório de entrega'
          when 'aprovarOS' then 'Executado - pendente aprovação OS'
          when 'fecharOS' then 'Fechar OS'
          else v_antes.etapa
        end,
        'Pendente faturamento'),
      ('marco_liberou_fat', to_char(v_antes.marco_liberou_fat, 'DD/MM/YYYY'), to_char(v_hoje, 'DD/MM/YYYY'))
    ) as x(campo, de, para)
   where x.de is distinct from x.para;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.obras_enviar_para_faturamento(uuid, text) from public, anon;
grant execute on function public.obras_enviar_para_faturamento(uuid, text) to authenticated;

-- 3. Devolver (Financeiro recusa o envio). Sem usuário logado: chave de serviço.
create or replace function public.obras_devolver_faturamento(p_obra_id uuid, p_motivo text, p_quem text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_quem   text := nullif(btrim(p_quem), '');
  v_motivo text := left(nullif(btrim(p_motivo), ''), 500);
  v_hoje   date := (now() at time zone 'America/Sao_Paulo')::date;
  v_quando timestamptz := now();
  v_antes  public.obras_obra;
  v_volta  text;
begin
  if v_quem is null then
    raise exception 'obras_devolver_faturamento: quem é obrigatório' using errcode = '22023';
  end if;
  if v_motivo is null then
    raise exception 'informe o motivo' using errcode = '22023';
  end if;

  select * into v_antes from public.obras_obra o where o.id = p_obra_id for update;
  if not found or v_antes.fat_enviado_em is null or v_antes.etapa is distinct from 'pendFat' then
    raise exception 'obra não está na fila do faturamento' using errcode = '22023';
  end if;

  v_volta := coalesce(v_antes.fat_enviado_etapa_anterior, 'fecharOS');

  update public.obras_obra o set
    etapa = v_volta,
    desde_etapa = v_hoje,
    atualizacao = v_hoje,
    etapa_por = v_quem,
    etapa_em = v_quando,
    marco_liberou_fat = null,
    fat_enviado_em = null,
    fat_enviado_por = null,
    fat_enviado_obs = null,
    fat_enviado_etapa_anterior = null
  where o.id = p_obra_id;

  insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
  select p_obra_id, 'Esteira', x.campo, x.de, x.para, 'Devolvida pelo financeiro: ' || v_motivo, v_quem, v_quando
    from (values
      ('etapa', 'Pendente faturamento',
        case v_volta
          when 'definir' then 'Aguardando definição'
          when 'levantamento' then 'Levantamento'
          when 'andamento' then 'Em andamento'
          when 'paralisado' then 'Paralisado'
          when 'relatorio' then 'Relatório de entrega'
          when 'aprovarOS' then 'Executado - pendente aprovação OS'
          when 'fecharOS' then 'Fechar OS'
          else v_volta
        end),
      ('marco_liberou_fat', to_char(v_antes.marco_liberou_fat, 'DD/MM/YYYY'), null)
    ) as x(campo, de, para)
   where x.de is distinct from x.para;

  return jsonb_build_object('analista', v_antes.fat_enviado_por, 'os', v_antes.os, 'loja', v_antes.loja);
end;
$$;

revoke execute on function public.obras_devolver_faturamento(uuid, text, text) from public, anon, authenticated;
grant execute on function public.obras_devolver_faturamento(uuid, text, text) to service_role;

-- 4. Gatilho: troca de etapa por qualquer caminho cancela o envio pendente.
-- Só zera as colunas fat_enviado_*; não toca na data de liberação e não grava histórico.
create or replace function public.obras_obra_cancelar_envio_faturamento()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if new.etapa is distinct from old.etapa and new.etapa <> 'pendFat' then
    new.fat_enviado_em := null;
    new.fat_enviado_por := null;
    new.fat_enviado_obs := null;
    new.fat_enviado_etapa_anterior := null;
  end if;
  return new;
end;
$$;

drop trigger if exists obras_obra_cancelar_envio_faturamento on public.obras_obra;
create trigger obras_obra_cancelar_envio_faturamento
  before update of etapa on public.obras_obra
  for each row execute function public.obras_obra_cancelar_envio_faturamento();

commit;

-- ============================================================
-- VERIFICAÇÃO (rodar junto; qualquer *** FALHOU *** = não deployar)
-- ============================================================
select item, case when ok then 'OK' else '*** FALHOU ***' end as resultado from (values
  (1, 'colunas fat_enviado_* (4)', (select count(*) from information_schema.columns where table_schema='public' and table_name='obras_obra' and column_name in ('fat_enviado_em','fat_enviado_por','fat_enviado_obs','fat_enviado_etapa_anterior')) = 4),
  (2, 'enviar existe e é invoker', exists (select 1 from pg_proc where proname='obras_enviar_para_faturamento' and not prosecdef)),
  (3, 'devolver existe e é invoker', exists (select 1 from pg_proc where proname='obras_devolver_faturamento' and not prosecdef)),
  (4, 'authenticated executa enviar', has_function_privilege('authenticated', 'public.obras_enviar_para_faturamento(uuid, text)', 'execute')),
  (5, 'anon não executa enviar', not has_function_privilege('anon', 'public.obras_enviar_para_faturamento(uuid, text)', 'execute')),
  (6, 'authenticated não executa devolver', not has_function_privilege('authenticated', 'public.obras_devolver_faturamento(uuid, text, text)', 'execute')),
  (7, 'anon não executa devolver', not has_function_privilege('anon', 'public.obras_devolver_faturamento(uuid, text, text)', 'execute')),
  (8, 'service_role executa devolver', has_function_privilege('service_role', 'public.obras_devolver_faturamento(uuid, text, text)', 'execute')),
  (9, 'gatilho existe', exists (select 1 from pg_trigger where tgname='obras_obra_cancelar_envio_faturamento' and tgrelid='public.obras_obra'::regclass and not tgisinternal)),
  (10, 'nenhuma obra com envio pendente fora de pendFat', not exists (select 1 from public.obras_obra where fat_enviado_em is not null and etapa <> 'pendFat'))
) as v(item, nome, ok) order by item;
