-- ============================================================
-- *** NÃO APLICADO *** (escrito em 03/11/2026, branch feat/frotas-manutencao)
-- Gestão de Frotas (Sofia) — terceira bateria, frente "Manutenção e bases"
-- Design: docs/superpowers/specs/2026-11-03-frotas-manutencao-e-bases-design.md
-- Schema aprovado pelo João em 03/11/2026: docs/frotas/2026-11-03-decisoes-terceira-bateria.md
--
-- O QUE MUDA
--   1. revisoes.prever_proxima boolean not null default true. Na PRIMEIRA aplicação,
--      as revisões tipo 'corretiva' existentes viram false (03/11: 20 linhas, nenhuma
--      com proxima_km/proxima_data). Reaplicar não mexe de novo.
--   2. revisoes.origem text not null default 'manual' ('manual' | 'importacao').
--   3. veiculos.intervalo_revisao_km integer, opcional (1.000 a 100.000).
--   4. Tabela nova public.manutencoes (corretiva). RLS: ler = sofia_has_access();
--      inserir = sofia_pode_gerir() + carimbo criado_por = e-mail do JWT;
--      atualizar = sofia_pode_gerir(), com grant de UPDATE só por coluna (veiculo_id,
--      criado_por, tirou_da_equipe, data_entrada e created_at congelados).
--      SEM DELETE (nem policy nem grant).
--   5. Funções SECURITY INVOKER sofia_abrir_manutencao / sofia_concluir_manutencao,
--      guardadas por sofia_pode_gerir() is not true, auditoria em audit_log.dados
--      na mesma transação (padrão das F1–F3).
-- NÃO MUDA: as 18 policies "sofia access", os triggers sofia_bloquear_*,
--   nenhuma função existente.
-- DEPENDE de sdd-sql-sofia-gestor-frotas.sql (aplicado 28/10). A seção 0 aborta sem ele.
-- ORDEM: este (verificação 22/22) -> sdd-sql-sofia-manutencao-teste.sql (30/30)
--   -> deploy do app. (O app novo lê prever_proxima/origem/intervalo_revisao_km e
--   chama as RPCs: sem este SQL, Revisões e Manutenção quebram.)
-- Rodar como postgres, projeto iyytcavcgukfjnjjrerx. Idempotente.
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS — aborta a transação se algo não estiver aplicado
-- ============================================================
do $$
begin
  if to_regprocedure('public.sofia_pode_gerir()') is null then
    raise exception 'ABORTADO: public.sofia_pode_gerir() não existe — aplique sdd-sql-sofia-gestor-frotas.sql antes';
  end if;
  if to_regprocedure('public.sofia_has_access()') is null or to_regprocedure('public.sofia_is_admin()') is null then
    raise exception 'ABORTADO: sofia_has_access()/sofia_is_admin() não existem';
  end if;
  if to_regclass('public.revisoes') is null or to_regclass('public.veiculos') is null
     or to_regclass('public.equipes') is null
     or to_regclass('public.veiculo_responsabilidade_historico') is null then
    raise exception 'ABORTADO: tabelas do Sofia (revisoes/veiculos/equipes/veiculo_responsabilidade_historico) ausentes';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'audit_log' and column_name = 'dados') then
    raise exception 'ABORTADO: audit_log.dados não existe';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'veiculos' and column_name = 'previsao_retorno_oficina') then
    raise exception 'ABORTADO: veiculos.previsao_retorno_oficina não existe';
  end if;
  if to_regclass('public.manutencoes') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'manutencoes' and column_name = 'tirou_da_equipe') then
    raise exception 'ABORTADO: já existe public.manutencoes com outro formato — conferir antes de seguir';
  end if;
end;
$$;

-- ============================================================
-- 1. revisoes.prever_proxima (+ corretivas existentes = false, só na criação)
-- ============================================================
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'revisoes' and column_name = 'prever_proxima') then
    alter table public.revisoes add column prever_proxima boolean not null default true;
    update public.revisoes set prever_proxima = false where tipo = 'corretiva';
  end if;
end;
$$;
comment on column public.revisoes.prever_proxima is
  'false = não prever a próxima revisão por KM (corretiva, ou "Não prever" no formulário). O carro sai dos alertas por KM até a próxima revisão.';

-- ============================================================
-- 2. revisoes.origem
-- ============================================================
alter table public.revisoes add column if not exists origem text not null default 'manual';
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.revisoes'::regclass and conname = 'revisoes_origem_check') then
    alter table public.revisoes add constraint revisoes_origem_check check (origem in ('manual', 'importacao'));
  end if;
end;
$$;
comment on column public.revisoes.origem is 'manual = formulário; importacao = planilha (importarRevisoesAction).';

-- ============================================================
-- 3. veiculos.intervalo_revisao_km
-- ============================================================
alter table public.veiculos add column if not exists intervalo_revisao_km integer;
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.veiculos'::regclass and conname = 'veiculos_intervalo_revisao_km_check') then
    alter table public.veiculos add constraint veiculos_intervalo_revisao_km_check
      check (intervalo_revisao_km is null or intervalo_revisao_km between 1000 and 100000);
  end if;
end;
$$;
comment on column public.veiculos.intervalo_revisao_km is
  'Intervalo próprio entre revisões (km). NULL = padrão do sistema (10.000 km, constante no código).';

-- ============================================================
-- 4. Tabela manutencoes (manutenção corretiva)
-- ============================================================
create table if not exists public.manutencoes (
  id                 uuid primary key default gen_random_uuid(),
  veiculo_id         uuid not null references public.veiculos(id),
  defeito            text not null,
  oficina            text,
  data_entrada       date not null,
  saida_prevista     date,
  data_saida         date,
  custo              numeric(10,2),
  quem_arca          text,
  status             text not null default 'aguardando_orcamento',
  tirou_da_equipe    boolean not null default true,
  anexo_storage_path text,
  observacoes        text,
  criado_por         text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint manutencoes_defeito_check check (btrim(defeito) <> ''),
  constraint manutencoes_status_check
    check (status in ('aguardando_orcamento', 'aguardando_aprovacao', 'em_conserto', 'concluida')),
  constraint manutencoes_quem_arca_check
    check (quem_arca is null or quem_arca in ('locadora', 'empresa', 'motorista')),
  constraint manutencoes_custo_check check (custo is null or custo >= 0),
  constraint manutencoes_saida_prevista_check check (saida_prevista is null or saida_prevista >= data_entrada),
  constraint manutencoes_data_saida_check check (data_saida is null or data_saida >= data_entrada),
  constraint manutencoes_conclusao_coerente check (
    (status = 'concluida' and data_saida is not null and custo is not null and quem_arca is not null)
    or (status <> 'concluida' and data_saida is null)
  )
);

create index if not exists manutencoes_veiculo_idx on public.manutencoes (veiculo_id);
create index if not exists manutencoes_abertas_idx on public.manutencoes (veiculo_id) where status <> 'concluida';

comment on table public.manutencoes is
  'Manutenção corretiva (conserto que não é revisão). Escrita só por gestor de frotas/admin (RLS + RPCs sofia_abrir_manutencao/sofia_concluir_manutencao). Sem DELETE.';
comment on column public.manutencoes.tirou_da_equipe is
  'true = ao abrir, o veículo foi para "manutencao" e saiu da equipe (igual ao Enviar para oficina). Conta nos dias parados.';
comment on column public.manutencoes.criado_por is 'E-mail (minúsculo) do JWT de quem abriu; a policy de INSERT exige que seja o da sessão.';

alter table public.manutencoes enable row level security;

drop policy if exists manutencoes_ler on public.manutencoes;
create policy manutencoes_ler on public.manutencoes
  for select to authenticated
  using ((select public.sofia_has_access()));

drop policy if exists manutencoes_inserir on public.manutencoes;
create policy manutencoes_inserir on public.manutencoes
  for insert to authenticated
  with check ((select public.sofia_pode_gerir())
              and criado_por = lower(btrim((select auth.jwt()) ->> 'email')));

drop policy if exists manutencoes_atualizar on public.manutencoes;
create policy manutencoes_atualizar on public.manutencoes
  for update to authenticated
  using ((select public.sofia_pode_gerir()))
  with check ((select public.sofia_pode_gerir()));

revoke all on public.manutencoes from anon;
revoke all on public.manutencoes from authenticated;
grant select, insert on public.manutencoes to authenticated;
-- UPDATE só nas colunas que mudam depois da abertura (revisão N1, 03/11): veiculo_id,
-- criado_por, tirou_da_equipe, data_entrada e created_at ficam congelados.
revoke update on public.manutencoes from authenticated;
grant update (status, data_saida, custo, quem_arca, oficina, saida_prevista, observacoes, anexo_storage_path, updated_at)
  on public.manutencoes to authenticated;

-- ============================================================
-- 5a. sofia_abrir_manutencao — cria a manutenção e, se pedido, tira o carro da equipe
--     (mesmo efeito de enviarParaOficinaAction), tudo numa transação.
-- ============================================================
create or replace function public.sofia_abrir_manutencao(
  p_veiculo_id      uuid,
  p_defeito         text,
  p_oficina         text,
  p_data_entrada    date,
  p_saida_prevista  date,
  p_custo           numeric,
  p_quem_arca       text,
  p_status          text,
  p_tirar_da_equipe boolean,
  p_observacoes     text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_email   text := lower(btrim(auth.jwt() ->> 'email'));
  v_defeito text := nullif(btrim(p_defeito), '');
  v_status  text := coalesce(p_status, 'aguardando_orcamento');
  v_tirou   boolean := coalesce(p_tirar_da_equipe, true);
  v_veic    record;
  v_equipe  text;
  v_id      uuid;
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem registrar manutenção corretiva';
  end if;

  if v_defeito is null then
    raise exception 'Descreva o defeito.' using errcode = 'SOF01';
  end if;
  if p_data_entrada is null then
    raise exception 'Informe a data de entrada.' using errcode = 'SOF01';
  end if;
  if p_saida_prevista is not null and p_saida_prevista < p_data_entrada then
    raise exception 'A saída prevista não pode ser antes da entrada.' using errcode = 'SOF01';
  end if;
  if v_status not in ('aguardando_orcamento', 'aguardando_aprovacao', 'em_conserto') then
    raise exception 'Status inválido para abrir a manutenção.' using errcode = 'SOF01';
  end if;
  if p_quem_arca is not null and p_quem_arca not in ('locadora', 'empresa', 'motorista') then
    raise exception 'Quem arca inválido.' using errcode = 'SOF01';
  end if;
  if p_custo is not null and p_custo < 0 then
    raise exception 'O custo não pode ser negativo.' using errcode = 'SOF01';
  end if;

  -- 1º veículo (mesma ordem de trava de lancar_km_atomico / corrigir_km_atomico).
  select v.id, v.placa, v.status, v.equipe_id into v_veic
  from public.veiculos v
  where v.id = p_veiculo_id
  for update;
  if not found then
    raise exception 'Veículo não encontrado.' using errcode = 'SOF01';
  end if;
  if v_veic.status = 'inativo' then
    raise exception 'Veículo desativado: reative antes de registrar a manutenção.' using errcode = 'SOF01';
  end if;

  insert into public.manutencoes
    (veiculo_id, defeito, oficina, data_entrada, saida_prevista, custo, quem_arca, status,
     tirou_da_equipe, observacoes, criado_por)
  values
    (p_veiculo_id, v_defeito, nullif(btrim(p_oficina), ''), p_data_entrada, p_saida_prevista, p_custo,
     p_quem_arca, v_status, v_tirou, nullif(btrim(p_observacoes), ''), v_email)
  returning id into v_id;

  if v_tirou then
    select e.codigo into v_equipe from public.equipes e where e.id = v_veic.equipe_id;
    -- igual a enviarParaOficinaAction: fecha o histórico aberto e tira a equipe
    update public.veiculo_responsabilidade_historico
       set fim = current_date
     where veiculo_id = p_veiculo_id and fim is null;
    update public.veiculos
       set status = 'manutencao',
           equipe_id = null,
           previsao_retorno_oficina = coalesce(p_saida_prevista, p_data_entrada)
     where id = p_veiculo_id;
  end if;

  insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id, usuario_email, dados)
  values (
    'manutencoes', 'criou', v_id::text,
    format('Manutenção corretiva aberta — %s: %s%s', v_veic.placa, v_defeito,
           case when v_tirou then ' (carro saiu da equipe)' else '' end),
    auth.uid(),
    v_email,
    jsonb_build_object(
      'tipo', 'manutencao_aberta',
      'contexto', jsonb_build_object('placa', v_veic.placa, 'veiculo_id', p_veiculo_id,
                                     'equipe_que_saiu', case when v_tirou then v_equipe end),
      'depois', jsonb_build_object('status', v_status, 'data_entrada', p_data_entrada,
                                   'saida_prevista', p_saida_prevista, 'custo', p_custo,
                                   'quem_arca', p_quem_arca, 'tirou_da_equipe', v_tirou),
      'veiculo', jsonb_build_object('status_antes', v_veic.status,
                                    'status_depois', case when v_tirou then 'manutencao' else v_veic.status end),
      'autor', jsonb_build_object(
        'email', v_email,
        'nome', nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
        'papel', case when public.sofia_is_admin() then 'administrador' else 'gestor de frotas' end)
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'placa', v_veic.placa,
    'equipe_que_saiu', case when v_tirou then v_equipe end,
    'veiculo_status', case when v_tirou then 'manutencao' else v_veic.status end
  );
end;
$$;

-- ============================================================
-- 5b. sofia_concluir_manutencao — fecha com saída real, custo e quem arca; devolve o
--     carro a 'ativo' (igual a retornarDaOficinaAction) se ele tinha saído da equipe e
--     não há outra manutenção aberta que também o tirou.
-- ============================================================
create or replace function public.sofia_concluir_manutencao(
  p_id         uuid,
  p_data_saida date,
  p_custo      numeric,
  p_quem_arca  text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_email   text := lower(btrim(auth.jwt() ->> 'email'));
  v_veiculo uuid;
  v_veic    record;
  v_m       record;
  v_voltou  boolean := false;
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem concluir manutenção corretiva';
  end if;

  if p_data_saida is null then
    raise exception 'Informe a saída real.' using errcode = 'SOF01';
  end if;
  if p_custo is null or p_custo < 0 then
    raise exception 'Informe o custo final (pode ser zero).' using errcode = 'SOF01';
  end if;
  if p_quem_arca is null or p_quem_arca not in ('locadora', 'empresa', 'motorista') then
    raise exception 'Informe quem arca com o custo.' using errcode = 'SOF01';
  end if;

  -- Leitura sem trava só para saber o veículo; conferida de novo depois da trava.
  select m.veiculo_id into v_veiculo from public.manutencoes m where m.id = p_id;
  if not found then
    raise exception 'Manutenção não encontrada.' using errcode = 'SOF01';
  end if;

  -- 1º veículo, 2º manutenção.
  select v.id, v.placa, v.status into v_veic
  from public.veiculos v where v.id = v_veiculo
  for update;

  select * into v_m from public.manutencoes m where m.id = p_id for update;
  if v_m.veiculo_id is distinct from v_veiculo then
    raise exception 'Os dados mudaram enquanto você editava. Recarregue a página e tente de novo.' using errcode = 'SOF01';
  end if;
  if v_m.status = 'concluida' then
    raise exception 'Esta manutenção já foi concluída.' using errcode = 'SOF01';
  end if;
  if p_data_saida < v_m.data_entrada then
    raise exception 'A saída real não pode ser antes da entrada.' using errcode = 'SOF01';
  end if;

  update public.manutencoes
     set status = 'concluida', data_saida = p_data_saida, custo = p_custo,
         quem_arca = p_quem_arca, updated_at = now()
   where id = p_id;

  if v_m.tirou_da_equipe and v_veic.status = 'manutencao'
     and not exists (select 1 from public.manutencoes o
                     where o.veiculo_id = v_veiculo and o.id <> p_id
                       and o.status <> 'concluida' and o.tirou_da_equipe) then
    update public.veiculos
       set status = 'ativo', previsao_retorno_oficina = null, substituto_id = null
     where id = v_veiculo;
    v_voltou := true;
  end if;

  insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id, usuario_email, dados)
  values (
    'manutencoes', 'atualizou', p_id::text,
    format('Manutenção corretiva concluída — %s: saída %s, R$ %s%s', v_veic.placa,
           to_char(p_data_saida, 'DD/MM/YYYY'), p_custo,
           case when v_voltou then ' (veículo voltou a Ativo)' else '' end),
    auth.uid(),
    v_email,
    jsonb_build_object(
      'tipo', 'manutencao_concluida',
      'contexto', jsonb_build_object('placa', v_veic.placa, 'veiculo_id', v_veiculo),
      'antes', jsonb_build_object('status', v_m.status, 'custo', v_m.custo, 'quem_arca', v_m.quem_arca),
      'depois', jsonb_build_object('status', 'concluida', 'data_saida', p_data_saida,
                                   'custo', p_custo, 'quem_arca', p_quem_arca),
      'veiculo', jsonb_build_object('voltou_ativo', v_voltou),
      'autor', jsonb_build_object(
        'email', v_email,
        'nome', nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
        'papel', case when public.sofia_is_admin() then 'administrador' else 'gestor de frotas' end)
    )
  );

  return jsonb_build_object('placa', v_veic.placa, 'voltou_ativo', v_voltou);
end;
$$;

revoke all on function public.sofia_abrir_manutencao(uuid, text, text, date, date, numeric, text, text, boolean, text) from public, anon;
revoke all on function public.sofia_concluir_manutencao(uuid, date, numeric, text) from public, anon;
grant execute on function public.sofia_abrir_manutencao(uuid, text, text, date, date, numeric, text, text, boolean, text) to authenticated;
grant execute on function public.sofia_concluir_manutencao(uuid, date, numeric, text) to authenticated;

commit;


-- ============================================================
-- VERIFICAÇÃO (depois do commit) — uma linha por invariante.
-- 22 linhas. Qualquer "*** FALHOU ***" = parar, não deployar.
-- (4, 5 e 6 valem logo depois da 1ª aplicação; depois que o app gravar, podem divergir.)
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'revisoes.prever_proxima boolean NOT NULL default true', 'boolean|NO|true',
      (select data_type || '|' || is_nullable || '|' || column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'revisoes' and column_name = 'prever_proxima')),
  (2, 'revisoes.origem text NOT NULL default manual', 'text|NO|''manual''::text',
      (select data_type || '|' || is_nullable || '|' || column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'revisoes' and column_name = 'origem')),
  (3, 'CHECK revisoes_origem_check existe', 'true',
      (select (count(*) = 1)::text from pg_constraint
       where conrelid = 'public.revisoes'::regclass and conname = 'revisoes_origem_check')),
  (4, 'nenhuma corretiva com prever_proxima = true', '0',
      (select count(*)::text from public.revisoes where tipo = 'corretiva' and prever_proxima)),
  (5, 'nenhuma preventiva com prever_proxima = false', '0',
      (select count(*)::text from public.revisoes where tipo <> 'corretiva' and not prever_proxima)),
  (6, 'todas as revisões existentes com origem manual', '0',
      (select count(*)::text from public.revisoes where origem <> 'manual')),
  (7, 'veiculos.intervalo_revisao_km integer, aceita NULL', 'integer|YES',
      (select data_type || '|' || is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'veiculos' and column_name = 'intervalo_revisao_km')),
  (8, 'CHECK veiculos_intervalo_revisao_km_check existe', 'true',
      (select (count(*) = 1)::text from pg_constraint
       where conrelid = 'public.veiculos'::regclass and conname = 'veiculos_intervalo_revisao_km_check')),
  (9, 'manutencoes com RLS ligada', 'true',
      (select relrowsecurity::text from pg_class where oid = to_regclass('public.manutencoes'))),
  (10, 'policies de manutencoes: exatamente ler/inserir/atualizar (sem DELETE/ALL)',
       'manutencoes_atualizar:UPDATE,manutencoes_inserir:INSERT,manutencoes_ler:SELECT',
      (select string_agg(policyname || ':' || cmd, ',' order by policyname) from pg_policies
       where schemaname = 'public' and tablename = 'manutencoes')),
  (11, 'policy ler usa sofia_has_access()', 'true',
      (select (qual like '%sofia_has_access()%')::text from pg_policies
       where schemaname = 'public' and tablename = 'manutencoes' and policyname = 'manutencoes_ler')),
  (12, 'policy inserir: sofia_pode_gerir() + carimbo criado_por = e-mail do JWT', 'true',
      (select (with_check like '%sofia_pode_gerir()%' and with_check like '%criado_por%'
               and with_check like '%auth.jwt()%')::text from pg_policies
       where schemaname = 'public' and tablename = 'manutencoes' and policyname = 'manutencoes_inserir')),
  (13, 'policy atualizar: sofia_pode_gerir() no using e no with check', 'true',
      (select (qual like '%sofia_pode_gerir()%' and with_check like '%sofia_pode_gerir()%')::text from pg_policies
       where schemaname = 'public' and tablename = 'manutencoes' and policyname = 'manutencoes_atualizar')),
  (14, 'anon sem privilégio em manutencoes', 'false',
      (select has_table_privilege('anon', 'public.manutencoes', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')::text)),
  (15, 'authenticated: SELECT/INSERT sim; UPDATE só por coluna (status sim, veiculo_id/criado_por não); DELETE/TRUNCATE não', 'true',
      (select (has_table_privilege('authenticated', 'public.manutencoes', 'SELECT')
               and has_table_privilege('authenticated', 'public.manutencoes', 'INSERT')
               and not has_table_privilege('authenticated', 'public.manutencoes', 'UPDATE')
               and has_column_privilege('authenticated', 'public.manutencoes', 'status', 'UPDATE')
               and has_column_privilege('authenticated', 'public.manutencoes', 'anexo_storage_path', 'UPDATE')
               and not has_column_privilege('authenticated', 'public.manutencoes', 'veiculo_id', 'UPDATE')
               and not has_column_privilege('authenticated', 'public.manutencoes', 'criado_por', 'UPDATE')
               and not has_column_privilege('authenticated', 'public.manutencoes', 'tirou_da_equipe', 'UPDATE')
               and not has_table_privilege('authenticated', 'public.manutencoes', 'DELETE')
               and not has_table_privilege('authenticated', 'public.manutencoes', 'TRUNCATE'))::text)),
  (16, '7 CHECKs em manutencoes', '7',
      (select count(*)::text from pg_constraint
       where conrelid = to_regclass('public.manutencoes') and contype = 'c')),
  (17, 'FK manutencoes.veiculo_id -> veiculos', 'true',
      (select (count(*) = 1)::text from pg_constraint
       where conrelid = to_regclass('public.manutencoes') and contype = 'f'
         and confrelid = 'public.veiculos'::regclass)),
  (18, 'as 2 funções são SECURITY INVOKER com search_path fixo', '2',
      (select count(*)::text from pg_proc
       where oid in (to_regprocedure('public.sofia_abrir_manutencao(uuid,text,text,date,date,numeric,text,text,boolean,text)'),
                     to_regprocedure('public.sofia_concluir_manutencao(uuid,date,numeric,text)'))
         and not prosecdef
         and exists (select 1 from unnest(proconfig) c where c like 'search_path=%'))),
  (19, 'as 2 funções guardadas por sofia_pode_gerir() is not true', '2',
      (select count(*)::text from pg_proc
       where oid in (to_regprocedure('public.sofia_abrir_manutencao(uuid,text,text,date,date,numeric,text,text,boolean,text)'),
                     to_regprocedure('public.sofia_concluir_manutencao(uuid,date,numeric,text)'))
         and position('sofia_pode_gerir() is not true' in prosrc) > 0)),
  (20, 'execute: anon não, authenticated sim (as 2)', 'true',
      (select (not has_function_privilege('anon', 'public.sofia_abrir_manutencao(uuid,text,text,date,date,numeric,text,text,boolean,text)', 'EXECUTE')
               and not has_function_privilege('anon', 'public.sofia_concluir_manutencao(uuid,date,numeric,text)', 'EXECUTE')
               and has_function_privilege('authenticated', 'public.sofia_abrir_manutencao(uuid,text,text,date,date,numeric,text,text,boolean,text)', 'EXECUTE')
               and has_function_privilege('authenticated', 'public.sofia_concluir_manutencao(uuid,date,numeric,text)', 'EXECUTE'))::text)),
  (21, 'as 18 policies "sofia access" continuam 18', '18',
      (select count(*)::text from pg_policies where schemaname = 'public' and policyname = 'sofia access')),
  (22, 'trigger trg_bloquear_escrita_veiculos continua em veiculos', 'true',
      (select (count(*) = 1)::text from pg_trigger
       where tgrelid = 'public.veiculos'::regclass and tgname = 'trg_bloquear_escrita_veiculos' and not tgisinternal))
) as t(n, verificacao, esperado, encontrado)
order by n;


-- ============================================================
-- ROLLBACK (comentado). Reverter o app ANTES. Apaga as manutenções registradas —
-- exportar a base "Manutenção corretiva" antes. As colunas de revisoes/veiculos
-- podem ficar (o app antigo não as lê).
-- ============================================================
-- begin;
-- drop function if exists public.sofia_concluir_manutencao(uuid, date, numeric, text);
-- drop function if exists public.sofia_abrir_manutencao(uuid, text, text, date, date, numeric, text, text, boolean, text);
-- drop table if exists public.manutencoes;
-- alter table public.veiculos drop constraint if exists veiculos_intervalo_revisao_km_check;
-- alter table public.veiculos drop column if exists intervalo_revisao_km;
-- alter table public.revisoes drop constraint if exists revisoes_origem_check;
-- alter table public.revisoes drop column if exists origem;
-- alter table public.revisoes drop column if exists prever_proxima;
-- commit;
