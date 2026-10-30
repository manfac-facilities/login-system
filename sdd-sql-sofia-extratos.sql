-- ============================================================
-- *** NÃO APLICADO *** (escrito em 28/10/2026, branch feat/frotas-extratos-backend)
-- Rodado só em Postgres local (PGlite, com stubs de auth/hub/financeiro): verificação 24/24 OK,
-- reaplicação 24/24 OK, teste 42/42 OK. Em produção, NUNCA RODOU.
-- Gestão de Frotas (Sofia) — Etapas 2 e 3: cadastros de cartão/tag/centro de
-- custo e envio de extratos Ticketlog/Veloe — 2026-10-28
-- Design: docs/superpowers/specs/2026-10-28-frotas-extratos-cadastros-design.md
-- Fonte literal: docs/cliente/2026-10-27-frotas-extratos-ticketlog-veloe.md
-- Decisões E1–E4 (João, 27/10) + ajuste do coordenador (28/10, a confirmar com
-- o João): ligação cartão/tag -> equipe também tem vigência (vigente_desde).
--
-- DEPENDÊNCIAS (a seção 0 ABORTA sem elas):
--   * sdd-sql-sofia-gestor-frotas.sql  (sofia_gestores, sofia_pode_gerir())
--   * Financeiro hub-install 001/002   (fin_papeis, financeiro_tem_papel(text))
--   * v04-seguranca                    (sofia_has_access(), equipes)
--
-- ORDEM: gestor-frotas (+teste) -> ESTE (verificação 24/24) ->
--        sdd-sql-sofia-extratos-teste.sql -> deploy do app.
-- Rodar como postgres (SQL Editor ou Management API com o PAT), projeto
-- iyytcavcgukfjnjjrerx. Idempotente: create ... if not exists, create or
-- replace, drop/create de policies, revoke/grant repetíveis.
--
-- O QUE CRIA
--   Tabelas (todas SÓ INSERÇÃO — ninguém do app altera nem apaga):
--     sofia_extrato_ligacoes     cartão Ticketlog / tag Veloe -> equipe, com vigente_desde
--     sofia_equipe_centro_custo  equipe -> centro de custo Omie (código, nome), com vigente_desde
--     sofia_extrato_envios       cada envio de arquivo (quem, quando, contagens)
--     sofia_extrato_linhas       transações; unique (plataforma, codigo_transacao)
--     sofia_extrato_saldos       saldo digitado a cada envio
--   View sofia_extrato_consumo (security_invoker): linha + equipe e centro de
--     custo RESOLVIDOS NA LEITURA (E2) e o motivo quando não resolve. É a que
--     as telas do Frotas usam (lista "sem centro de custo").
--   RPC sofia_registrar_extrato(...): grava envio + linhas (ON CONFLICT DO
--     NOTHING, nunca sobrescreve) + saldo numa transação.
--   Entrega ao financeiro (E4): views sofia_extrato_consumo_financeiro e
--     sofia_extrato_saldos_financeiro, sobre funções security definer
--     guardadas por sofia_extrato_pode_ler() (financeiro/diretor/gestor/admin).
--
-- RESOLUÇÃO (E2 + ajuste): para a data de uso da linha,
--   1. ligação vigente do cartão/tag = maior vigente_desde <= data_uso
--      (empate na mesma data: a registrada por último vale — correção é
--      linha nova, nunca update);
--   2. centro de custo vigente da equipe = mesma regra.
--   motivo_sem_centro_custo: 'sem_equipe' (1 falhou) | 'sem_centro_custo'
--   (2 falhou) | null (resolvido).
--
-- NOME DE MOTORISTA: não existe coluna para ele em lugar nenhum (decisão do
-- design: dado pessoal). CPF/CNPJ e matrícula também não.
--
-- Regras de negócio levantam errcode 'SOF01' (a Server Action mostra o texto);
-- a guarda de permissão levanta P0001 (texto não chega ao usuário).
-- Policies com nomes próprios — NÃO "sofia access" (o perf-rls-initplan conta
-- 18 policies com esse nome).
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS — aborta a transação se algo não estiver aplicado
-- ============================================================
do $$
declare
  v_txt text;
begin
  if to_regclass('public.sofia_gestores') is null then
    raise exception 'ABORTADO: public.sofia_gestores não existe — aplique sdd-sql-sofia-gestor-frotas.sql antes';
  end if;
  if to_regprocedure('public.sofia_pode_gerir()') is null then
    raise exception 'ABORTADO: public.sofia_pode_gerir() não existe — aplique sdd-sql-sofia-gestor-frotas.sql antes';
  end if;
  -- sofia_pode_gerir tem que ser a do arquivo (security definer, coalesce)
  select prosrc into v_txt from pg_proc where oid = to_regprocedure('public.sofia_pode_gerir()');
  if position('coalesce' in v_txt) = 0 or position('sofia_gestores' in v_txt) = 0
     or (select prosecdef from pg_proc where oid = to_regprocedure('public.sofia_pode_gerir()')) is not true then
    raise exception 'ABORTADO: sofia_pode_gerir() em produção difere de sdd-sql-sofia-gestor-frotas.sql';
  end if;
  if to_regprocedure('public.sofia_has_access()') is null then
    raise exception 'ABORTADO: public.sofia_has_access() não existe (sdd-sql-v04-seguranca.sql)';
  end if;
  if to_regprocedure('public.financeiro_tem_papel(text)') is null or to_regclass('public.fin_papeis') is null then
    raise exception 'ABORTADO: financeiro_tem_papel(text)/fin_papeis não existem (financeiro hub-install 002)';
  end if;
  if (select prosecdef from pg_proc where oid = to_regprocedure('public.financeiro_tem_papel(text)')) is not true then
    raise exception 'ABORTADO: financeiro_tem_papel(text) não é security definer — comparar com financeiro 002 antes';
  end if;
  -- os dois papéis que usamos ainda são os do CHECK do financeiro
  select pg_get_constraintdef(oid) into v_txt from pg_constraint
  where conrelid = to_regclass('public.fin_papeis') and conname = 'fin_papeis_papel_valido';
  if v_txt is null or position('''financeiro''' in v_txt) = 0 or position('''diretor''' in v_txt) = 0 then
    raise exception 'ABORTADO: fin_papeis_papel_valido não tem financeiro/diretor (achado: %)', coalesce(v_txt, '(nenhum)');
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'equipes'
                   and column_name = 'id' and data_type = 'uuid') then
    raise exception 'ABORTADO: public.equipes.id (uuid) não existe';
  end if;
  -- tabela pré-existente com o mesmo nome e outro formato passaria calada
  -- pelo "if not exists": exige que, se existir, tenha as colunas do arquivo
  if to_regclass('public.sofia_extrato_linhas') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'sofia_extrato_linhas'
                       and column_name = 'valor' and numeric_precision = 12 and numeric_scale = 2) then
    raise exception 'ABORTADO: sofia_extrato_linhas já existe com formato diferente do arquivo';
  end if;
end;
$$;


-- ============================================================
-- 1. TABELAS
-- ============================================================

-- 1.1 cartão (Ticketlog, NUMERO CARTAO) / tag (Veloe, VeloeTag) -> equipe
create table if not exists public.sofia_extrato_ligacoes (
  id            uuid primary key default gen_random_uuid(),
  plataforma    text not null
    constraint sofia_extrato_ligacoes_plataforma check (plataforma in ('ticketlog', 'veloe')),
  identificador text not null
    constraint sofia_extrato_ligacoes_identificador check (identificador = btrim(identificador) and identificador <> ''),
  equipe_id     uuid not null references public.equipes(id) on delete restrict,
  vigente_desde date not null,
  -- quem gravou vem do JWT; a policy exige que bata com a sessão
  criado_por    text not null default lower(btrim(auth.jwt() ->> 'email')),
  -- clock_timestamp: desempate de duas linhas na mesma vigente_desde
  criado_em     timestamptz not null default clock_timestamp()
);
create index if not exists sofia_extrato_ligacoes_busca
  on public.sofia_extrato_ligacoes (plataforma, identificador, vigente_desde desc, criado_em desc);

comment on table public.sofia_extrato_ligacoes is
  'Cartão Ticketlog / tag Veloe -> equipe, com vigência. Só inserção: trocar de equipe ou corrigir = linha nova. A placa NUNCA é chave (Ticketlog traz placa errada).';

-- 1.2 equipe -> centro de custo do Omie
create table if not exists public.sofia_equipe_centro_custo (
  id            uuid primary key default gen_random_uuid(),
  equipe_id     uuid not null references public.equipes(id) on delete restrict,
  codigo        text not null
    constraint sofia_equipe_cc_codigo check (codigo = btrim(codigo) and codigo <> ''),
  nome          text not null
    constraint sofia_equipe_cc_nome check (nome = btrim(nome) and nome <> ''),
  vigente_desde date not null,
  criado_por    text not null default lower(btrim(auth.jwt() ->> 'email')),
  criado_em     timestamptz not null default clock_timestamp()
);
create index if not exists sofia_equipe_cc_busca
  on public.sofia_equipe_centro_custo (equipe_id, vigente_desde desc, criado_em desc);

comment on table public.sofia_equipe_centro_custo is
  'Equipe -> centro de custo do Omie, com vigência (E3). Só inserção. Não substitui centro_custo_historico (por veículo, tela Custos) nem equipes.centro_custo.';

-- 1.3 envios
create table if not exists public.sofia_extrato_envios (
  id                uuid primary key default gen_random_uuid(),
  plataforma        text not null
    constraint sofia_extrato_envios_plataforma check (plataforma in ('ticketlog', 'veloe')),
  arquivo_nome      text not null
    constraint sofia_extrato_envios_arquivo check (btrim(arquivo_nome) <> ''),
  enviado_por       text not null default lower(btrim(auth.jwt() ->> 'email')),
  enviado_em        timestamptz not null default now(),
  linhas_arquivo    integer not null constraint sofia_extrato_envios_n check (linhas_arquivo > 0),
  linhas_novas      integer not null check (linhas_novas >= 0),
  linhas_existentes integer not null check (linhas_existentes >= 0),
  sem_centro_custo  integer not null check (sem_centro_custo >= 0),
  periodo_inicio    date not null,
  periodo_fim       date not null,
  constraint sofia_extrato_envios_soma check (linhas_novas + linhas_existentes = linhas_arquivo),
  constraint sofia_extrato_envios_periodo check (periodo_inicio <= periodo_fim)
);

-- 1.4 linhas de extrato. Equipe e centro de custo NÃO são gravados (E2).
create table if not exists public.sofia_extrato_linhas (
  id               uuid primary key default gen_random_uuid(),
  plataforma       text not null
    constraint sofia_extrato_linhas_plataforma check (plataforma in ('ticketlog', 'veloe')),
  codigo_transacao text not null
    constraint sofia_extrato_linhas_codigo check (codigo_transacao = btrim(codigo_transacao) and codigo_transacao <> ''),
  data_uso         date not null,   -- Ticketlog DATA TRANSACAO / Veloe Data de Utilizacao (nunca a de processamento)
  hora_uso         time,            -- Ticketlog DATA TRANSACAO / Veloe Hora de Untrada (sic)
  identificador    text not null    -- NUMERO CARTAO / VeloeTag
    constraint sofia_extrato_linhas_identificador check (identificador = btrim(identificador) and identificador <> ''),
  placa            text,            -- só Veloe, só informação
  valor            numeric(12,2) not null
    constraint sofia_extrato_linhas_valor check (valor >= 0),
  servico          text,            -- Ticketlog SERVICO / Veloe Tipo de Transacao
  tipo_movimento   text,            -- Veloe Tipo do Movimento
  litros           numeric(12,3),
  valor_litro      numeric(12,4),
  hodometro        numeric(14,1),
  estabelecimento  text,
  cidade           text,
  -- FK adiada: a RPC grava as linhas antes do envio para contar as novas
  envio_id         uuid not null references public.sofia_extrato_envios(id)
                     on delete restrict deferrable initially deferred,
  recebido_em      timestamptz not null default now(),
  constraint sofia_extrato_linhas_unica unique (plataforma, codigo_transacao)
);
create index if not exists sofia_extrato_linhas_identificador_data
  on public.sofia_extrato_linhas (plataforma, identificador, data_uso);
create index if not exists sofia_extrato_linhas_envio on public.sofia_extrato_linhas (envio_id);

comment on table public.sofia_extrato_linhas is
  'Transações Ticketlog/Veloe. Só inserção, ON CONFLICT DO NOTHING: linha já gravada nunca é sobrescrita. Sem nome de motorista, CPF ou matrícula. Centro de custo resolvido na leitura (view sofia_extrato_consumo).';

-- 1.5 saldos digitados
create table if not exists public.sofia_extrato_saldos (
  id            uuid primary key default gen_random_uuid(),
  plataforma    text not null
    constraint sofia_extrato_saldos_plataforma check (plataforma in ('ticketlog', 'veloe')),
  valor         numeric(12,2) not null constraint sofia_extrato_saldos_valor check (valor >= 0),
  informado_por text not null default lower(btrim(auth.jwt() ->> 'email')),
  informado_em  timestamptz not null default now(),
  envio_id      uuid not null references public.sofia_extrato_envios(id) on delete restrict
);


-- ============================================================
-- 2. RLS e privilégios
--    Leitura das tabelas: acesso ao Sofia. Escrita: só INSERT, só quem pode
--    gerir frotas (admin ou gestor), carimbo = e-mail da sessão.
--    UPDATE/DELETE: nenhuma policy E nenhum privilégio (duas barreiras).
-- ============================================================
do $$
declare
  v_tab text;
  v_col text;
  v_pol record;
begin
  for v_tab, v_col in
    select * from (values
      ('sofia_extrato_ligacoes',    'criado_por'),
      ('sofia_equipe_centro_custo', 'criado_por'),
      ('sofia_extrato_envios',      'enviado_por'),
      ('sofia_extrato_linhas',      null),
      ('sofia_extrato_saldos',      'informado_por')
    ) as t(tab, col)
  loop
    execute format('alter table public.%I enable row level security', v_tab);
    for v_pol in select policyname from pg_policies where schemaname = 'public' and tablename = v_tab loop
      execute format('drop policy %I on public.%I', v_pol.policyname, v_tab);
    end loop;

    execute format(
      'create policy sofia_extrato_ler on public.%I for select to authenticated using ((select public.sofia_has_access()))',
      v_tab);
    if v_col is null then
      execute format(
        'create policy sofia_extrato_gravar on public.%I for insert to authenticated with check ((select public.sofia_pode_gerir()))',
        v_tab);
    else
      execute format(
        'create policy sofia_extrato_gravar on public.%I for insert to authenticated with check ((select public.sofia_pode_gerir()) and %I = (select lower(btrim(auth.jwt() ->> ''email''))))',
        v_tab, v_col);
    end if;

    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', v_tab);
    execute format('grant select, insert on table public.%I to authenticated', v_tab);
    execute format('grant select on table public.%I to service_role', v_tab);
  end loop;
end;
$$;


-- ============================================================
-- 3. VIEW sofia_extrato_consumo — resolução na leitura (E2)
--    security_invoker: a RLS das tabelas (acesso ao Sofia) vale para quem lê.
-- ============================================================
create or replace view public.sofia_extrato_consumo
with (security_invoker = true) as
select
  l.id,
  l.plataforma,
  l.codigo_transacao,
  l.data_uso,
  l.hora_uso,
  l.identificador,
  l.placa,
  l.valor,
  l.servico,
  l.tipo_movimento,
  l.litros,
  l.valor_litro,
  l.hodometro,
  l.estabelecimento,
  l.cidade,
  l.envio_id,
  l.recebido_em,
  lg.equipe_id,
  e.codigo  as equipe_codigo,
  cc.codigo as centro_custo_codigo,
  cc.nome   as centro_custo_nome,
  case
    when lg.equipe_id is null then 'sem_equipe'
    when cc.codigo is null    then 'sem_centro_custo'
  end as motivo_sem_centro_custo
from public.sofia_extrato_linhas l
left join lateral (
  select g.equipe_id
  from public.sofia_extrato_ligacoes g
  where g.plataforma = l.plataforma
    and g.identificador = l.identificador
    and g.vigente_desde <= l.data_uso
  order by g.vigente_desde desc, g.criado_em desc, g.id desc
  limit 1
) lg on true
left join public.equipes e on e.id = lg.equipe_id
left join lateral (
  select c.codigo, c.nome
  from public.sofia_equipe_centro_custo c
  where c.equipe_id = lg.equipe_id
    and c.vigente_desde <= l.data_uso
  order by c.vigente_desde desc, c.criado_em desc, c.id desc
  limit 1
) cc on true;

revoke all on table public.sofia_extrato_consumo from public, anon, authenticated, service_role;
grant select on table public.sofia_extrato_consumo to authenticated, service_role;


-- ============================================================
-- 4. RPC sofia_registrar_extrato — envio + linhas + saldo, tudo ou nada.
--    SECURITY INVOKER: as policies da seção 2 valem; a guarda só antecipa a
--    negação com mensagem. p_linhas = array jsonb já lido pelo app
--    (lib/sofia/extratos/), valores decimais como texto ("69.99").
-- ============================================================
create or replace function public.sofia_registrar_extrato(
  p_plataforma text,
  p_arquivo    text,
  p_saldo      numeric,
  p_linhas     jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_envio   uuid := gen_random_uuid();
  v_total   int;
  v_dist    int;
  v_novas   int;
  v_sem     int;
  v_ini     date;
  v_fim     date;
  v_txt     text;
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem enviar extratos';
  end if;

  if p_plataforma is null or p_plataforma not in ('ticketlog', 'veloe') then
    raise exception 'Plataforma inválida.' using errcode = 'SOF01';
  end if;
  if p_arquivo is null or btrim(p_arquivo) = '' then
    raise exception 'Nome do arquivo ausente.' using errcode = 'SOF01';
  end if;
  if p_saldo is null or p_saldo < 0 or p_saldo <> round(p_saldo, 2) or p_saldo >= 1e10 then
    raise exception 'Saldo inválido: informe o valor que a plataforma mostra, com até 2 casas.' using errcode = 'SOF01';
  end if;
  if p_linhas is null or jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then
    raise exception 'O arquivo não tem nenhuma transação.' using errcode = 'SOF01';
  end if;
  if jsonb_array_length(p_linhas) > 20000 then
    raise exception 'Arquivo grande demais (mais de 20.000 transações). Envie por período menor.' using errcode = 'SOF01';
  end if;

  -- Sem tabela temporária (authenticated pode não ter TEMP): cada comando
  -- relê o jsonb com jsonb_to_recordset. Textos já chegam aparados do app;
  -- o btrim aqui é segunda barreira (os CHECKs exigem valor aparado).
  select count(*), count(distinct btrim(x.codigo_transacao)), min(x.data_uso), max(x.data_uso)
    into v_total, v_dist, v_ini, v_fim
  from jsonb_to_recordset(p_linhas) as x(codigo_transacao text, data_uso date);

  -- validações de dinheiro e de chave: falha o arquivo inteiro, nada gravado
  select coalesce(x.codigo_transacao, '(vazio)') into v_txt
  from jsonb_to_recordset(p_linhas) as x(codigo_transacao text, data_uso date, identificador text, valor numeric)
  where x.codigo_transacao is null or btrim(x.codigo_transacao) = '' or x.data_uso is null
     or x.identificador is null or btrim(x.identificador) = '' or x.valor is null
  limit 1;
  if found then
    raise exception 'Transação sem código, data, cartão/tag ou valor (código %).', v_txt using errcode = 'SOF01';
  end if;
  if v_dist <> v_total then
    raise exception 'O arquivo repete código de transação.' using errcode = 'SOF01';
  end if;
  select x.codigo_transacao into v_txt
  from jsonb_to_recordset(p_linhas) as x(codigo_transacao text, valor numeric)
  where x.valor < 0 or x.valor <> round(x.valor, 2) or x.valor >= 1e10
  limit 1;
  if found then
    raise exception 'Valor inválido na transação % (negativo ou com mais de 2 casas).', v_txt using errcode = 'SOF01';
  end if;

  insert into public.sofia_extrato_linhas (
    plataforma, codigo_transacao, data_uso, hora_uso, identificador, placa, valor,
    servico, tipo_movimento, litros, valor_litro, hodometro, estabelecimento, cidade, envio_id
  )
  select p_plataforma, btrim(x.codigo_transacao), x.data_uso, x.hora_uso, btrim(x.identificador),
         nullif(btrim(x.placa), ''), x.valor, nullif(btrim(x.servico), ''), nullif(btrim(x.tipo_movimento), ''),
         x.litros, x.valor_litro, x.hodometro,
         nullif(btrim(x.estabelecimento), ''), nullif(btrim(x.cidade), ''), v_envio
  from jsonb_to_recordset(p_linhas) as x(
    codigo_transacao text, data_uso date, hora_uso time, identificador text,
    placa text, valor numeric, servico text, tipo_movimento text,
    litros numeric, valor_litro numeric, hodometro numeric,
    estabelecimento text, cidade text
  )
  on conflict (plataforma, codigo_transacao) do nothing;
  get diagnostics v_novas = row_count;

  -- "sem centro de custo" conta as transações DESTE arquivo pelo que está
  -- gravado (as já existentes contam com o dado da primeira gravação)
  select count(*) into v_sem
  from public.sofia_extrato_consumo c
  where c.plataforma = p_plataforma
    and c.motivo_sem_centro_custo is not null
    and c.codigo_transacao in (
      select btrim(x.codigo_transacao) from jsonb_to_recordset(p_linhas) as x(codigo_transacao text));

  insert into public.sofia_extrato_envios (
    id, plataforma, arquivo_nome, linhas_arquivo, linhas_novas, linhas_existentes,
    sem_centro_custo, periodo_inicio, periodo_fim
  ) values (
    v_envio, p_plataforma, btrim(p_arquivo), v_total, v_novas, v_total - v_novas, v_sem, v_ini, v_fim
  );

  insert into public.sofia_extrato_saldos (plataforma, valor, envio_id)
  values (p_plataforma, p_saldo, v_envio);

  return jsonb_build_object(
    'envio_id', v_envio,
    'linhas', v_total,
    'novas', v_novas,
    'existentes', v_total - v_novas,
    'sem_centro_custo', v_sem,
    'periodo_inicio', v_ini,
    'periodo_fim', v_fim
  );
end;
$$;

revoke all on function public.sofia_registrar_extrato(text, text, numeric, jsonb) from public, anon;
grant execute on function public.sofia_registrar_extrato(text, text, numeric, jsonb) to authenticated;


-- ============================================================
-- 5. ENTREGA AO FINANCEIRO (E4)
--    Quem lê: papel ativo financeiro/diretor no módulo Financeiro, ou quem
--    pode gerir frotas (admin/gestor). Sempre true/false, nunca NULL.
--    As views passam por funções SECURITY DEFINER porque o financeiro não
--    tem acesso ao Sofia (a RLS das tabelas o barraria). A guarda é a única
--    proteção dentro delas: quem não pode recebe ZERO linhas.
-- ============================================================
create or replace function public.sofia_extrato_pode_ler()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select coalesce(
    public.sofia_pode_gerir()
    or public.financeiro_tem_papel('financeiro')
    or public.financeiro_tem_papel('diretor'),
    false
  );
$$;

revoke all on function public.sofia_extrato_pode_ler() from public, anon;
grant execute on function public.sofia_extrato_pode_ler() to authenticated;

create or replace function public.sofia_extrato_consumo_ler()
returns table (
  plataforma              text,
  codigo_transacao        text,
  data_uso                date,
  hora_uso                time,
  valor                   numeric(12,2),
  servico                 text,
  equipe_codigo           text,
  centro_custo_codigo     text,
  centro_custo_nome       text,
  motivo_sem_centro_custo text,
  recebido_em             timestamptz
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select c.plataforma, c.codigo_transacao, c.data_uso, c.hora_uso, c.valor, c.servico,
         c.equipe_codigo, c.centro_custo_codigo, c.centro_custo_nome,
         c.motivo_sem_centro_custo, c.recebido_em
  from public.sofia_extrato_consumo c
  where public.sofia_extrato_pode_ler() is true;
$$;

create or replace function public.sofia_extrato_saldos_ler()
returns table (
  plataforma    text,
  valor         numeric(12,2),
  informado_em  timestamptz,
  informado_por text
)
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select s.plataforma, s.valor, s.informado_em, s.informado_por
  from public.sofia_extrato_saldos s
  where public.sofia_extrato_pode_ler() is true;
$$;

revoke all on function public.sofia_extrato_consumo_ler() from public, anon;
revoke all on function public.sofia_extrato_saldos_ler()  from public, anon;
grant execute on function public.sofia_extrato_consumo_ler() to authenticated;
grant execute on function public.sofia_extrato_saldos_ler()  to authenticated;

create or replace view public.sofia_extrato_consumo_financeiro
with (security_invoker = true) as
select * from public.sofia_extrato_consumo_ler();

create or replace view public.sofia_extrato_saldos_financeiro
with (security_invoker = true) as
select * from public.sofia_extrato_saldos_ler();

comment on view public.sofia_extrato_consumo_financeiro is
  'Entrega ao Financeiro (E4): consumo por transação com centro de custo resolvido na data de uso (vazio quando não resolve). Sem nome de motorista. Leitura: papel financeiro/diretor, gestor de frotas, admin.';
comment on view public.sofia_extrato_saldos_financeiro is
  'Entrega ao Financeiro (E4): saldos digitados a cada envio. Leitura: papel financeiro/diretor, gestor de frotas, admin.';

revoke all on table public.sofia_extrato_consumo_financeiro from public, anon, authenticated, service_role;
revoke all on table public.sofia_extrato_saldos_financeiro  from public, anon, authenticated, service_role;
grant select on table public.sofia_extrato_consumo_financeiro to authenticated;
grant select on table public.sofia_extrato_saldos_financeiro  to authenticated;

commit;


-- ============================================================
-- VERIFICAÇÃO (depois do commit) — uma linha por invariante.
-- 24 linhas. Qualquer "*** FALHOU ***" = parar, não deployar.
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'as 5 tabelas existem com RLS ligada', '5',
      (select count(*)::text from pg_class
       where oid in (to_regclass('public.sofia_extrato_ligacoes'), to_regclass('public.sofia_equipe_centro_custo'),
                     to_regclass('public.sofia_extrato_envios'), to_regclass('public.sofia_extrato_linhas'),
                     to_regclass('public.sofia_extrato_saldos'))
         and relrowsecurity)),
  (2, 'policies: exatamente ler(SELECT)+gravar(INSERT) em cada uma das 5', '10',
      (select count(*)::text from pg_policies
       where schemaname = 'public'
         and tablename in ('sofia_extrato_ligacoes','sofia_equipe_centro_custo','sofia_extrato_envios','sofia_extrato_linhas','sofia_extrato_saldos')
         and ((policyname = 'sofia_extrato_ler' and cmd = 'SELECT') or (policyname = 'sofia_extrato_gravar' and cmd = 'INSERT')))),
  (3, 'nenhuma outra policy nas 5 tabelas', '10',
      (select count(*)::text from pg_policies
       where schemaname = 'public'
         and tablename in ('sofia_extrato_ligacoes','sofia_equipe_centro_custo','sofia_extrato_envios','sofia_extrato_linhas','sofia_extrato_saldos'))),
  (4, 'policy gravar usa sofia_pode_gerir em todas', '5',
      (select count(*)::text from pg_policies
       where schemaname = 'public' and policyname = 'sofia_extrato_gravar'
         and with_check like '%sofia_pode_gerir()%'
         and tablename in ('sofia_extrato_ligacoes','sofia_equipe_centro_custo','sofia_extrato_envios','sofia_extrato_linhas','sofia_extrato_saldos'))),
  (5, 'policy gravar exige carimbo = e-mail da sessão nas 4 com autor', '4',
      (select count(*)::text from pg_policies
       where schemaname = 'public' and policyname = 'sofia_extrato_gravar' and with_check like '%auth.jwt()%'
         and tablename in ('sofia_extrato_ligacoes','sofia_equipe_centro_custo','sofia_extrato_envios','sofia_extrato_saldos'))),
  (6, 'authenticated sem UPDATE/DELETE/TRUNCATE nas 5', 'false',
      (select bool_or(has_table_privilege('authenticated', t, 'UPDATE')
                   or has_table_privilege('authenticated', t, 'DELETE')
                   or has_table_privilege('authenticated', t, 'TRUNCATE'))::text
       from unnest(array['public.sofia_extrato_ligacoes','public.sofia_equipe_centro_custo','public.sofia_extrato_envios',
                         'public.sofia_extrato_linhas','public.sofia_extrato_saldos']) t)),
  (7, 'service_role sem UPDATE/DELETE/TRUNCATE nas 5', 'false',
      (select bool_or(has_table_privilege('service_role', t, 'UPDATE')
                   or has_table_privilege('service_role', t, 'DELETE')
                   or has_table_privilege('service_role', t, 'TRUNCATE'))::text
       from unnest(array['public.sofia_extrato_ligacoes','public.sofia_equipe_centro_custo','public.sofia_extrato_envios',
                         'public.sofia_extrato_linhas','public.sofia_extrato_saldos']) t)),
  (8, 'anon sem nenhum privilégio nas 5 tabelas e 3 views', 'false',
      (select bool_or(has_table_privilege('anon', t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))::text
       from unnest(array['public.sofia_extrato_ligacoes','public.sofia_equipe_centro_custo','public.sofia_extrato_envios',
                         'public.sofia_extrato_linhas','public.sofia_extrato_saldos','public.sofia_extrato_consumo',
                         'public.sofia_extrato_consumo_financeiro','public.sofia_extrato_saldos_financeiro']) t)),
  (9, 'sofia_extrato_linhas: unique (plataforma, codigo_transacao)', 'codigo_transacao,plataforma',
      (select string_agg(a.attname, ',' order by a.attname)
       from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
       where c.conrelid = to_regclass('public.sofia_extrato_linhas') and c.conname = 'sofia_extrato_linhas_unica' and c.contype = 'u')),
  (10, 'valores em numeric(12,2): linhas.valor e saldos.valor', '2',
      (select count(*)::text from information_schema.columns
       where table_schema = 'public' and column_name = 'valor' and data_type = 'numeric'
         and numeric_precision = 12 and numeric_scale = 2
         and table_name in ('sofia_extrato_linhas', 'sofia_extrato_saldos'))),
  (11, 'linhas NÃO grava equipe nem centro de custo (E2)', '0',
      (select count(*)::text from information_schema.columns
       where table_schema = 'public' and table_name = 'sofia_extrato_linhas'
         and (column_name like '%equipe%' or column_name like '%centro%'))),
  (12, 'nenhuma coluna de motorista/CPF/matrícula nas 5 tabelas e 3 views', '0',
      (select count(*)::text from information_schema.columns
       where table_schema = 'public'
         and table_name in ('sofia_extrato_ligacoes','sofia_equipe_centro_custo','sofia_extrato_envios','sofia_extrato_linhas',
                            'sofia_extrato_saldos','sofia_extrato_consumo','sofia_extrato_consumo_financeiro','sofia_extrato_saldos_financeiro')
         and column_name ~* '(motorista|condutor|cpf|cnpj|matricula|responsavel)')),
  (13, 'envio_id das linhas: FK adiável', 'true',
      (select (condeferrable and condeferred)::text from pg_constraint
       where conrelid = to_regclass('public.sofia_extrato_linhas') and contype = 'f'
         and confrelid = to_regclass('public.sofia_extrato_envios'))),
  (14, 'sofia_extrato_consumo é security_invoker', 'true',
      (select (coalesce('security_invoker=true' = any(reloptions), false))::text
       from pg_class where oid = to_regclass('public.sofia_extrato_consumo'))),
  (15, 'views do financeiro são security_invoker', '2',
      (select count(*)::text from pg_class
       where oid in (to_regclass('public.sofia_extrato_consumo_financeiro'), to_regclass('public.sofia_extrato_saldos_financeiro'))
         and 'security_invoker=true' = any(reloptions))),
  (16, 'view do financeiro: colunas exatas (sem motorista)', 'centro_custo_codigo,centro_custo_nome,codigo_transacao,data_uso,equipe_codigo,hora_uso,motivo_sem_centro_custo,plataforma,recebido_em,servico,valor',
      (select string_agg(column_name, ',' order by column_name) from information_schema.columns
       where table_schema = 'public' and table_name = 'sofia_extrato_consumo_financeiro')),
  (17, 'view de saldos: colunas exatas', 'informado_em,informado_por,plataforma,valor',
      (select string_agg(column_name, ',' order by column_name) from information_schema.columns
       where table_schema = 'public' and table_name = 'sofia_extrato_saldos_financeiro')),
  (18, 'sofia_extrato_pode_ler/consumo_ler/saldos_ler: security definer com search_path fixo', '3',
      (select count(*)::text from pg_proc
       where oid in (to_regprocedure('public.sofia_extrato_pode_ler()'), to_regprocedure('public.sofia_extrato_consumo_ler()'),
                     to_regprocedure('public.sofia_extrato_saldos_ler()'))
         and prosecdef and 'search_path=pg_catalog, public' = any(proconfig))),
  (19, 'sofia_extrato_pode_ler sem JWT devolve false (não NULL)', 'false',
      (select coalesce(public.sofia_extrato_pode_ler()::text, 'NULL'))),
  (20, 'funções de leitura filtram por "sofia_extrato_pode_ler() is true"', '2',
      (select count(*)::text from pg_proc
       where oid in (to_regprocedure('public.sofia_extrato_consumo_ler()'), to_regprocedure('public.sofia_extrato_saldos_ler()'))
         and position('sofia_extrato_pode_ler() is true' in prosrc) > 0)),
  (21, 'sofia_registrar_extrato: security INVOKER, guarda is not true, ON CONFLICT DO NOTHING', 'true',
      (select (not prosecdef
               and position('sofia_pode_gerir() is not true' in prosrc) > 0
               and position('do nothing' in prosrc) > 0
               and position('do update' in prosrc) = 0)::text
       from pg_proc where oid = to_regprocedure('public.sofia_registrar_extrato(text, text, numeric, jsonb)'))),
  (22, 'as 4 funções novas: authenticated executa, anon não', '4',
      (select count(*)::text from unnest(array[
         'public.sofia_registrar_extrato(text, text, numeric, jsonb)', 'public.sofia_extrato_pode_ler()',
         'public.sofia_extrato_consumo_ler()', 'public.sofia_extrato_saldos_ler()']) f
       where has_function_privilege('authenticated', f, 'EXECUTE') and not has_function_privilege('anon', f, 'EXECUTE'))),
  (23, 'sem JWT a view do financeiro devolve 0 linhas', '0',
      (select count(*)::text from public.sofia_extrato_consumo_financeiro)),
  (24, 'as 18 policies "sofia access" continuam 18 (nenhuma criada aqui)', '18',
      (select count(*)::text from pg_policies where schemaname = 'public' and policyname = 'sofia access'))
) as t(n, verificacao, esperado, encontrado)
order by n;


-- ============================================================
-- ROLLBACK (comentado). Reverter o app ANTES. Apaga os extratos enviados —
-- antes, exporte: select * from public.sofia_extrato_linhas; (e as outras 4)
-- ============================================================
-- begin;
-- drop view if exists public.sofia_extrato_consumo_financeiro;
-- drop view if exists public.sofia_extrato_saldos_financeiro;
-- drop function if exists public.sofia_extrato_consumo_ler();
-- drop function if exists public.sofia_extrato_saldos_ler();
-- drop function if exists public.sofia_extrato_pode_ler();
-- drop function if exists public.sofia_registrar_extrato(text, text, numeric, jsonb);
-- drop view if exists public.sofia_extrato_consumo;
-- drop table if exists public.sofia_extrato_saldos;
-- drop table if exists public.sofia_extrato_linhas;
-- drop table if exists public.sofia_extrato_envios;
-- drop table if exists public.sofia_equipe_centro_custo;
-- drop table if exists public.sofia_extrato_ligacoes;
-- commit;
