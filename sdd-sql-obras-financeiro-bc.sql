-- ============================================================
-- OBRAS — Financeiro da obra, Fases B e C (01/11/2026, sem PEF): organograma do
-- cliente, medições ao cliente, estado das locações e as leituras novas
-- (pagamentos/rateio e caixinha ligados à obra, caixinha sem obra, locações,
-- medições de fornecedor paradas) + obras_fin_notas com as medições ligadas.
-- Spec: docs/superpowers/specs/2026-11-01-obras-financeiro-fases-b-c-design.md §2, §3.
-- Plano: docs/superpowers/plans/2026-11-01-obras-financeiro-fases-b-c.md, Task 5.
--
-- TERRITÓRIO DE DINHEIRO + AUTORIZAÇÃO (AGENTS.md): toda dúvida falha FECHADA.
-- REGRA DE OURO (como na Fase A): nenhuma escrita, coluna, FK, trigger ou policy
-- em cmp_*, fin_*, frn_*. Só funções de LEITURA (security definer) do lado do hub.
--
-- O QUE FAZ
--   1. obras_engenheiro_ou_admin_mae(p_obra) -> boolean (nunca NULL): administrador
--      do Obras, OU (obras_has_access() E e-mail do JWT = engenheiro da obra OU da
--      obra mãe). É quem grava medição ao cliente e estado de locação.
--   2. obras_cliente_pessoa (organograma do cliente): obra, nome, cargo, e-mail
--      OPCIONAL (minúsculo/sem espaço; vazio vira NULL; único por obra quando
--      existe), ordem, autoria. Lê quem tem obras_has_access(); grava só
--      administrador (RLS + trigger; sem JWT/service role passa).
--   3. obras_medicao_cliente (medição/liberação do cliente por OS):
--      numero sequencial POR OS dado pelo banco (o informado é ignorado);
--      periodo_inicio/fim; percentual_centesimos (1..10000) e valor_centavos (> 0)
--      gravados como digitados (a tela calcula um do outro); avanco_centesimos
--      (0..10000, opcional); situacao enviada|aprovada|recusada; enviada_em,
--      aprovada_em; autoria forçada no INSERT e nunca reescrita no UPDATE.
--      Grava: obras_engenheiro_ou_admin_mae(obra). Lê: obras_pode_ver_valores(obra).
--      Apaga: só administrador (a nota do Financeiro aponta para a medição).
--      Medição LIGADA A NOTA (fin_fat_nota_medicoes, só leitura): ninguém (nem admin,
--      nem sem JWT) apaga, muda percentual/valor ou tira de 'aprovada' — desligar a
--      nota no Financeiro antes. Datas (BRT) não podem estar no futuro e a aprovação
--      não pode ser antes do envio.
--      Máquina de estados (com JWT de não administrador):
--        INSERT só como 'enviada';
--        enviada -> enviada | aprovada | recusada;
--        recusada -> recusada | enviada (reenviar: enviada_em = agora);
--        aprovada é FINAL (nada muda). Administrador e sem JWT: qualquer transição.
--      Soma do percentual das NÃO recusadas por OS <= 10000 (100%), conferida no
--      trigger com a linha da OS travada (FOR NO KEY UPDATE) — duas gravações
--      simultâneas na mesma OS ficam em fila; vale para qualquer role.
--   4. obras_locacao_estado (devolvida/renovada da locação): cmp_pedido_id ÚNICO
--      (SEM FK, como obras_restricao.cmp_pedido_id), obra_id, devolvida_em,
--      renovada_ate, autoria. O pedido tem de existir (produção), ser de LOCAÇÃO e
--      a solicitação dele ser desta obra e o pedido estar EMITIDO — vale para qualquer
--      role; renovada_ate > coalesce(locacao_fim, dia da entrega). Grava:
--      obras_engenheiro_ou_admin_mae(obra); lê: obras_has_access(); apaga: admin.
--   5. Leituras (security definer, search_path fixo, stable, EXECUTE para
--      authenticated e service_role, nunca anon/public; obra + filhas diretas;
--      só ambiente 'producao'; ZERO linhas sem permissão; service role sem JWT
--      recebe vazio):
--        obras_fin_vinculos(p_obra)               — pagamentos/rateio e caixinha
--                                                   ligados à obra (fin_obra_vinculos ativos)
--        obras_fin_caixinha_sem_obra(p_obra)      — UMA linha: quantidade e valor das
--                                                   despesas de caixinha que exigem obra
--                                                   e não têm vínculo (GLOBAL, não por obra;
--                                                   p_obra só decide a permissão)
--        obras_fin_locacoes(p_obra)               — pedidos de LOCAÇÃO emitidos + período +
--                                                   estado (linhas para obras_has_access();
--                                                   total_centavos só com obras_pode_ver_valores,
--                                                   NULL para os demais)
--        obras_fin_medicoes_fornecedor_atrasadas(p_obra) — medições de fornecedor
--                                                   aguardando aprovação há mais de 10 dias
--      obras_fin_notas(p_obra) é RECRIADA (drop + create: o retorno muda) com a
--      coluna nova medicao_ids uuid[] (fin_fat_nota_medicoes, só as medições da
--      MESMA obra da linha; '{}' sem medição). Continua uma linha por (nota, obra):
--      some parcela_centavos, nunca a nota inteira.
--      obras_fin_fornecedores(p_obra) é RECRIADA (drop + create): a obra da medição
--      passa a ser coalesce(frn_medicoes.obra_id, frn_contratos.obra_id) (contrato
--      GLOBAL entra pelas medições desta obra) + coluna contrato_da_obra; os valores
--      do contrato (valor_mo/mat, aditivos) vêm NULL quando o contrato não é desta
--      obra (global), para a tela não somar o contrato global inteiro na obra.
--      As medições de fornecedor (atrasadas) usam a mesma regra de obra.
--   6. obras_obra_valor_guarda (BEFORE UPDATE OF valor): obras_obra.valor é o
--      "valor receita" da OBRA (base da margem). Em obra da modalidade 'obra' (antes
--      ou depois da gravação), com JWT, só administrador do Obras muda o valor
--      (is not true = falha fechada). Sem JWT (service role, sync do Field) passa.
--      SPOT segue como hoje: a ficha SPOT deixa o usuário do Obras editar o valor.
--      A sync do Field não grava valor (só loja/cliente/descricao/fonte/field_id/os).
--
-- PRÉ-REQUISITO (a seção 0 confere):
--   * sdd-sql-obras-financeiro-a.sql aplicado (e tudo antes dele);
--   * Financeiro 044_fin_obra_vinculos.sql aplicado (fin_obra_vinculos,
--     fin_fat_nota_medicoes, fin_obra_categorias_fixas, fin_obra_exige);
--   * Compras 016_cmp_locacao_periodo.sql aplicado (cmp_solicitacoes.locacao_fim);
--   * Fornecedores 013_frn_obra_preaprovacao.sql aplicado (frn_medicoes.obra_id,
--     pre_aprovado_em): contrato GLOBAL não tem obra — a obra fica na medição.
--   Ordem: Fase A -> Financeiro 044 -> Compras 016 -> Fornecedores 013 -> este.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-11-01-verificacao-obras-financeiro-bc.sql.
--
-- IDEMPOTENTE: create table if not exists, create or replace, drop ... if exists.
--
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is not true`; as funções de
-- autorização devolvem coalesce(..., false); uma função de trigger por tabela.
--
-- ROLLBACK (só depois de reverter o app):
--   drop function public.obras_fin_vinculos(uuid), public.obras_fin_caixinha_sem_obra(uuid),
--                 public.obras_fin_locacoes(uuid), public.obras_fin_medicoes_fornecedor_atrasadas(uuid);
--   reaplicar as seções 3a, 3b e 3c de sdd-sql-obras-financeiro-a.sql (obras_fin_compras,
--     obras_fin_fornecedores e obras_fin_notas da Fase A) — antes: drop function
--     public.obras_fin_compras(uuid), public.obras_fin_notas(uuid), public.obras_fin_fornecedores(uuid);
--   drop table public.obras_locacao_estado, public.obras_medicao_cliente,
--              public.obras_cliente_pessoa;   -- apaga dados (exportar antes)
--   drop function public.obras_locacao_estado_guarda(), public.obras_medicao_cliente_guarda(),
--                 public.obras_cliente_pessoa_guarda(), public.obras_engenheiro_ou_admin_mae(uuid);
--   drop trigger obras_obra_valor_guarda on public.obras_obra;
--   drop function public.obras_obra_valor_guarda();
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (Fase A; Financeiro 044; Compras 016; colunas lidas)
-- ============================================================
do $$
declare
  v_col text;
  v_falta text := '';
begin
  if to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null
     or to_regprocedure('public.obras_pode_ver_valores(uuid)') is null
     or to_regprocedure('public.obras_fin_compras(uuid)') is null
     or to_regprocedure('public.obras_fin_fornecedores(uuid)') is null
     or to_regprocedure('public.obras_fin_notas(uuid)') is null
     or to_regprocedure('public.obras_restricao_pedido_guarda()') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'obra_pai_id')
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_restricao' and column_name = 'cmp_pedido_id') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-financeiro-a.sql (Fase A) não está aplicado. Nada foi alterado.';
  end if;
  if to_regclass('public.fin_obra_vinculos') is null
     or to_regclass('public.fin_fat_nota_medicoes') is null
     or to_regclass('public.fin_obra_categorias_fixas') is null
     or to_regprocedure('public.fin_obra_exige(text, text)') is null then
    raise exception 'Pré-requisito ausente: Financeiro 044_fin_obra_vinculos.sql não está aplicado (fin_obra_vinculos, fin_fat_nota_medicoes, fin_obra_categorias_fixas, fin_obra_exige). Nada foi alterado.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'cmp_solicitacoes' and column_name = 'locacao_fim') then
    raise exception 'Pré-requisito ausente: Compras 016_cmp_locacao_periodo.sql não está aplicado (cmp_solicitacoes.locacao_fim). Nada foi alterado.';
  end if;
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'frn_medicoes'
         and column_name in ('obra_id', 'pre_aprovado_em')) <> 2 then
    raise exception 'Pré-requisito ausente: Fornecedores 013_frn_obra_preaprovacao.sql não está aplicado (frn_medicoes.obra_id, pre_aprovado_em). Nada foi alterado.';
  end if;

  foreach v_col in array array[
    'obras_obra.id', 'obras_obra.os', 'obras_obra.engenheiro_email', 'obras_obra.obra_pai_id',
    'fin_obra_vinculos.id', 'fin_obra_vinculos.ambiente', 'fin_obra_vinculos.origem',
    'fin_obra_vinculos.solicitacao_id', 'fin_obra_vinculos.vex_despesa_id', 'fin_obra_vinculos.obra_id',
    'fin_obra_vinculos.os', 'fin_obra_vinculos.percentual_centesimos', 'fin_obra_vinculos.valor_centavos',
    'fin_obra_vinculos.criado_por_nome', 'fin_obra_vinculos.criado_em', 'fin_obra_vinculos.desfeito_em',
    'fin_fat_nota_medicoes.nota_id', 'fin_fat_nota_medicoes.medicao_id',
    'fin_solicitacoes.id', 'fin_solicitacoes.ambiente', 'fin_solicitacoes.numero', 'fin_solicitacoes.etapa',
    'fin_solicitacoes.tipo', 'fin_solicitacoes.fornecedor_razao_social', 'fin_solicitacoes.categoria_descricao',
    'fin_solicitacoes.descricao', 'fin_solicitacoes.valor_centavos', 'fin_solicitacoes.vencimento',
    'fin_solicitacoes.enviado_em', 'fin_solicitacoes.fornecedor_documento',
    'fin_pagamentos_omie.solicitacao_id', 'fin_pagamentos_omie.situacao', 'fin_pagamentos_omie.data_pagamento',
    'fin_pagamentos_omie.valor_pago_centavos',
    'fin_caixinha_despesas.ambiente', 'fin_caixinha_despesas.vex_id', 'fin_caixinha_despesas.relatorio_vex_id',
    'fin_caixinha_despesas.data', 'fin_caixinha_despesas.titulo', 'fin_caixinha_despesas.valor_centavos',
    'fin_caixinha_despesas.tipo_nome', 'fin_caixinha_despesas.centro_custo_nome',
    'fin_caixinha_relatorios.ambiente', 'fin_caixinha_relatorios.vex_id', 'fin_caixinha_relatorios.status',
    'fin_solicitacao_integracoes.ambiente', 'fin_solicitacao_integracoes.origem',
    'fin_solicitacao_integracoes.chave', 'fin_solicitacao_integracoes.solicitacao_id',
    'fin_solicitacao_rateio.solicitacao_id', 'fin_solicitacao_rateio.departamento_descricao',
    'fin_solicitacao_rateio.valor_centavos',
    'frn_medicoes.fin_solicitacao_id', 'frn_medicoes.id', 'frn_medicoes.numero', 'frn_medicoes.contrato_id',
    'frn_medicoes.item', 'frn_medicoes.descricao', 'frn_medicoes.competencia', 'frn_medicoes.valor',
    'frn_medicoes.status', 'frn_medicoes.solicitado_em', 'frn_medicoes.obra_id', 'frn_medicoes.pre_aprovado_em',
    'frn_medicoes.aprovado_em', 'frn_medicoes.vencimento', 'frn_medicoes.nf_numero', 'frn_medicoes.pago_em',
    'frn_medicoes.valor_pago', 'frn_medicoes.seq',
    'frn_contratos.id', 'frn_contratos.numero', 'frn_contratos.obra_id', 'frn_contratos.fornecedor_id',
    'frn_contratos.status', 'frn_contratos.classificacao', 'frn_contratos.escopo', 'frn_contratos.inicio',
    'frn_contratos.fim', 'frn_contratos.valor_mo', 'frn_contratos.valor_mat',
    'frn_aditivos.contrato_id', 'frn_aditivos.tipo', 'frn_aditivos.item', 'frn_aditivos.valor', 'frn_aditivos.status',
    'frn_fornecedores.id', 'frn_fornecedores.razao_social',
    'cmp_solicitacoes.id', 'cmp_solicitacoes.ambiente', 'cmp_solicitacoes.numero', 'cmp_solicitacoes.tipo',
    'cmp_solicitacoes.motivo', 'cmp_solicitacoes.obra_id', 'cmp_solicitacoes.prazo_necessario',
    'cmp_solicitacoes.locacao_fim',
    'cmp_pedidos.id', 'cmp_pedidos.solicitacao_id', 'cmp_pedidos.ambiente', 'cmp_pedidos.sequencia',
    'cmp_pedidos.mapa_fornecedor_id', 'cmp_pedidos.total_centavos', 'cmp_pedidos.situacao',
    'cmp_pedidos.omie_numero', 'cmp_pedidos.previsao_entrega', 'cmp_pedidos.entrega_situacao',
    'cmp_pedidos.entrega_em',
    'cmp_solicitacoes.etapa', 'cmp_solicitacoes.enviado_em', 'cmp_solicitacoes.valor_estimado_centavos',
    'cmp_pedidos.criado_em', 'cmp_pedidos.nf_numero', 'cmp_pedidos.nf_em', 'cmp_pedidos.pago_em',
    'cmp_pedidos.concluido_em',
    'cmp_mapa_fornecedores.id', 'cmp_mapa_fornecedores.razao_social', 'cmp_mapa_fornecedores.documento'
  ] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = split_part(v_col, '.', 1)
                      and column_name = split_part(v_col, '.', 2)) then
      v_falta := v_falta || ' ' || v_col;
    end if;
  end loop;
  if v_falta <> '' then
    raise exception 'Pré-requisito ausente: colunas não encontradas:%. Nada foi alterado.', v_falta;
  end if;
end $$;

-- ============================================================
-- 1. obras_engenheiro_ou_admin_mae(p_obra) — nunca NULL; falha fechada
-- ============================================================
create or replace function public.obras_engenheiro_ou_admin_mae(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with eu as (select nullif(lower(trim(auth.jwt() ->> 'email')), '') as email)
  select coalesce((
    select true
      from eu
      join public.obras_obra o on o.id = p_obra
      left join public.obras_obra m on m.id = o.obra_pai_id
     where eu.email is not null
       and (public.obras_is_admin() is true
            or (public.obras_has_access() is true
                and (eu.email = nullif(lower(trim(o.engenheiro_email)), '')
                     or eu.email = nullif(lower(trim(m.engenheiro_email)), ''))))
  ), false);
$$;
revoke execute on function public.obras_engenheiro_ou_admin_mae(uuid) from public, anon;
-- authenticated executa: as policies abaixo rodam como o usuário.
grant execute on function public.obras_engenheiro_ou_admin_mae(uuid) to authenticated, service_role;

-- ============================================================
-- 2. obras_cliente_pessoa (organograma do cliente; só administrador grava)
-- ============================================================
create table if not exists public.obras_cliente_pessoa (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  nome text not null,
  cargo text,
  email text,
  ordem int not null default 0,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz,
  constraint obras_cliente_pessoa_nome_check check (btrim(nome) <> '' and char_length(nome) <= 200),
  constraint obras_cliente_pessoa_cargo_check check (cargo is null or char_length(cargo) <= 200),
  -- Normalizado pelo trigger; o check confere (inclusive para a service role).
  constraint obras_cliente_pessoa_email_check check (
    email is null
    or (email = lower(btrim(email))
        and char_length(email) between 3 and 254
        and email ~ '^[\x21-\x7e]+$'
        and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
);
-- E-mail único por obra quando existe (vários sem e-mail podem conviver).
create unique index if not exists obras_cliente_pessoa_obra_email_key
  on public.obras_cliente_pessoa (obra_id, email) where email is not null;
create index if not exists obras_cliente_pessoa_obra_idx on public.obras_cliente_pessoa (obra_id, ordem);

create or replace function public.obras_cliente_pessoa_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  -- Com JWT: só administrador (a RLS já exige; aqui falha fechada de novo).
  -- A cascata da obra apagada passa: obra só é apagada por admin ou sem JWT.
  if v_email is not null and public.obras_is_admin() is not true then
    raise exception 'OBRAS_CLIENTE_PESSOA: só administrador altera o organograma do cliente'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;

  new.nome := btrim(new.nome);
  new.cargo := nullif(btrim(new.cargo), '');
  new.email := nullif(lower(btrim(new.email)), '');

  if tg_op = 'INSERT' then
    new.criado_por := v_email;
    new.criado_em := now();
    new.atualizado_por := null;
    new.atualizado_em := null;
    return new;
  end if;

  -- UPDATE: autoria nunca muda; id e obra são imutáveis.
  if new.id is distinct from old.id or new.obra_id is distinct from old.obra_id then
    raise exception 'OBRAS_CLIENTE_PESSOA: id e obra_id são imutáveis' using errcode = 'P0001';
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.atualizado_por := v_email;
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_cliente_pessoa_guarda() from public, anon, authenticated;

drop trigger if exists obras_cliente_pessoa_guarda on public.obras_cliente_pessoa;
create trigger obras_cliente_pessoa_guarda
  before insert or update or delete on public.obras_cliente_pessoa
  for each row execute function public.obras_cliente_pessoa_guarda();

alter table public.obras_cliente_pessoa enable row level security;
drop policy if exists "obras select" on public.obras_cliente_pessoa;
create policy "obras select" on public.obras_cliente_pessoa for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras admin insert" on public.obras_cliente_pessoa;
create policy "obras admin insert" on public.obras_cliente_pessoa for insert to authenticated
  with check ((select public.obras_is_admin()));
drop policy if exists "obras admin update" on public.obras_cliente_pessoa;
create policy "obras admin update" on public.obras_cliente_pessoa for update to authenticated
  using ((select public.obras_is_admin())) with check ((select public.obras_is_admin()));
drop policy if exists "obras admin delete" on public.obras_cliente_pessoa;
create policy "obras admin delete" on public.obras_cliente_pessoa for delete to authenticated
  using ((select public.obras_is_admin()));
revoke all on public.obras_cliente_pessoa from anon;
revoke truncate on public.obras_cliente_pessoa from authenticated;

-- ============================================================
-- 3. obras_medicao_cliente (medição/liberação do cliente por OS)
-- ============================================================
create table if not exists public.obras_medicao_cliente (
  id uuid primary key default gen_random_uuid(),
  -- RESTRICT: medição é registro de dinheiro e o Financeiro aponta para ela
  -- (fin_fat_nota_medicoes.medicao_id); OS com medição não se apaga.
  obra_id uuid not null references public.obras_obra(id) on delete restrict,
  numero int not null,
  periodo_inicio date not null,
  periodo_fim date not null,
  percentual_centesimos int not null,
  valor_centavos bigint not null,
  avanco_centesimos int,
  situacao text not null default 'enviada',
  enviada_em timestamptz not null default now(),
  aprovada_em timestamptz,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz,
  constraint obras_medicao_cliente_numero_key unique (obra_id, numero),
  constraint obras_medicao_cliente_numero_check check (numero >= 1),
  constraint obras_medicao_cliente_periodo_check check (periodo_fim >= periodo_inicio),
  constraint obras_medicao_cliente_percentual_check check (percentual_centesimos between 1 and 10000),
  constraint obras_medicao_cliente_valor_check check (valor_centavos > 0),
  constraint obras_medicao_cliente_avanco_check check (avanco_centesimos is null or avanco_centesimos between 0 and 10000),
  constraint obras_medicao_cliente_situacao_check check (situacao in ('enviada', 'aprovada', 'recusada')),
  constraint obras_medicao_cliente_aprovada_coerente check ((situacao = 'aprovada') = (aprovada_em is not null))
);
create index if not exists obras_medicao_cliente_obra_idx on public.obras_medicao_cliente (obra_id, situacao);

create or replace function public.obras_medicao_cliente_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_livre boolean;   -- administrador ou sem JWT (service role/postgres)
  v_soma bigint;
  v_checar_soma boolean;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  v_livre := v_email is null or public.obras_is_admin() is true;

  if tg_op = 'DELETE' then
    if v_livre is not true then
      raise exception 'OBRAS_MEDICAO_CLIENTE: só administrador apaga medição ao cliente'
        using errcode = '42501';
    end if;
    -- Nota ligada (Financeiro, sem FK): ninguém apaga, nem admin nem sem JWT.
    if exists (select 1 from public.fin_fat_nota_medicoes nm where nm.medicao_id = old.id) then
      raise exception 'OBRAS_MEDICAO_CLIENTE: medição com nota emitida não se apaga — desligue a nota no Financeiro antes'
        using errcode = '23503';
    end if;
    return old;
  end if;

  -- Com JWT: engenheiro da obra (ou da obra mãe) ou administrador.
  if v_email is not null and public.obras_engenheiro_ou_admin_mae(new.obra_id) is not true then
    raise exception 'OBRAS_MEDICAO_CLIENTE: só o engenheiro da obra (ou da obra mãe) ou administrador registra medição ao cliente'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.obra_id is distinct from old.obra_id then
      raise exception 'OBRAS_MEDICAO_CLIENTE: id e obra_id são imutáveis' using errcode = 'P0001';
    end if;
  end if;

  -- Trava a OS: numeração e soma das liberações em fila (FOR NO KEY UPDATE não
  -- briga com as FKs das outras tabelas que apontam para a obra).
  perform 1 from public.obras_obra o where o.id = new.obra_id for no key update;
  if not found then
    raise exception 'OBRAS_MEDICAO_CLIENTE: a obra não existe' using errcode = '23503';
  end if;

  if tg_op = 'INSERT' then
    if v_livre is not true and new.situacao is distinct from 'enviada' then
      raise exception 'OBRAS_MEDICAO_CLIENTE: a medição nasce como enviada'
        using errcode = '42501';
    end if;
    new.numero := coalesce((select max(m.numero) from public.obras_medicao_cliente m
                             where m.obra_id = new.obra_id), 0) + 1;
    new.criado_por := v_email;
    new.criado_em := now();
    new.atualizado_por := null;
    new.atualizado_em := null;
    new.enviada_em := coalesce(new.enviada_em, now());
    new.aprovada_em := case when new.situacao = 'aprovada' then coalesce(new.aprovada_em, now()) end;
    v_checar_soma := true;
  else
    -- Autoria e número nunca mudam.
    new.numero := old.numero;
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
    new.atualizado_por := v_email;
    new.atualizado_em := now();

    if v_livre is not true then
      if old.situacao = 'aprovada' then
        raise exception 'OBRAS_MEDICAO_CLIENTE: medição aprovada não muda (só administrador)'
          using errcode = '42501';
      end if;
      if old.situacao = 'recusada' and new.situacao = 'aprovada' then
        raise exception 'OBRAS_MEDICAO_CLIENTE: medição recusada volta para enviada antes de ser aprovada'
          using errcode = '42501';
      end if;
    end if;

    -- Nota ligada (qualquer role, inclusive admin): % e valor fixos, não sai de aprovada.
    if (new.percentual_centesimos is distinct from old.percentual_centesimos
        or new.valor_centavos is distinct from old.valor_centavos
        or (old.situacao = 'aprovada' and new.situacao is distinct from 'aprovada'))
       and exists (select 1 from public.fin_fat_nota_medicoes nm where nm.medicao_id = old.id) then
      raise exception 'OBRAS_MEDICAO_CLIENTE: medição com nota emitida: percentual, valor e aprovação não mudam — desligue a nota no Financeiro antes'
        using errcode = '23503';
    end if;

    -- Reenviar (recusada -> enviada): conta de novo a partir de agora.
    if old.situacao = 'recusada' and new.situacao = 'enviada'
       and new.enviada_em is not distinct from old.enviada_em then
      new.enviada_em := now();
    end if;
    if new.situacao = 'aprovada' then
      new.aprovada_em := case when old.situacao = 'aprovada' then coalesce(new.aprovada_em, old.aprovada_em)
                              else coalesce(new.aprovada_em, now()) end;
    else
      new.aprovada_em := null;
    end if;
    v_checar_soma := new.percentual_centesimos is distinct from old.percentual_centesimos
                     or new.situacao is distinct from old.situacao;
  end if;

  -- Datas pelo dia de Brasília: nada no futuro; aprovação não antes do envio.
  if (new.enviada_em at time zone 'America/Sao_Paulo')::date > v_hoje
     or (new.aprovada_em is not null and (new.aprovada_em at time zone 'America/Sao_Paulo')::date > v_hoje) then
    raise exception 'OBRAS_MEDICAO_CLIENTE: data de envio/aprovação no futuro' using errcode = '23514';
  end if;
  if new.aprovada_em is not null
     and (new.aprovada_em at time zone 'America/Sao_Paulo')::date < (new.enviada_em at time zone 'America/Sao_Paulo')::date then
    raise exception 'OBRAS_MEDICAO_CLIENTE: a aprovação não pode ser antes do envio' using errcode = '23514';
  end if;

  -- Soma das liberações NÃO recusadas da OS <= 100% (qualquer role).
  if v_checar_soma and new.situacao <> 'recusada' then
    select coalesce(sum(m.percentual_centesimos), 0) into v_soma
      from public.obras_medicao_cliente m
     where m.obra_id = new.obra_id
       and m.situacao <> 'recusada'
       and m.id is distinct from new.id;
    if v_soma + new.percentual_centesimos > 10000 then
      -- Na RAISE, % é marcador e %% é o sinal literal; o "%" dos números vai no parâmetro.
      raise exception 'OBRAS_MEDICAO_CLIENTE: a soma das liberações desta OS passaria de 100%% (já há %, esta tem %)',
        (v_soma / 100.0)::numeric(7, 2)::text || '%', (new.percentual_centesimos / 100.0)::numeric(7, 2)::text || '%'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_medicao_cliente_guarda() from public, anon, authenticated;

drop trigger if exists obras_medicao_cliente_guarda on public.obras_medicao_cliente;
create trigger obras_medicao_cliente_guarda
  before insert or update or delete on public.obras_medicao_cliente
  for each row execute function public.obras_medicao_cliente_guarda();

alter table public.obras_medicao_cliente enable row level security;
drop policy if exists "obras valores select" on public.obras_medicao_cliente;
create policy "obras valores select" on public.obras_medicao_cliente for select to authenticated
  using (public.obras_pode_ver_valores(obra_id));
drop policy if exists "obras engenheiro insert" on public.obras_medicao_cliente;
create policy "obras engenheiro insert" on public.obras_medicao_cliente for insert to authenticated
  with check (public.obras_engenheiro_ou_admin_mae(obra_id));
drop policy if exists "obras engenheiro update" on public.obras_medicao_cliente;
create policy "obras engenheiro update" on public.obras_medicao_cliente for update to authenticated
  using (public.obras_engenheiro_ou_admin_mae(obra_id))
  with check (public.obras_engenheiro_ou_admin_mae(obra_id));
drop policy if exists "obras admin delete" on public.obras_medicao_cliente;
create policy "obras admin delete" on public.obras_medicao_cliente for delete to authenticated
  using ((select public.obras_is_admin()));
revoke all on public.obras_medicao_cliente from anon;
revoke truncate on public.obras_medicao_cliente from authenticated;

-- ============================================================
-- 4. obras_locacao_estado (devolvida / renovada até)
-- ============================================================
create table if not exists public.obras_locacao_estado (
  id uuid primary key default gen_random_uuid(),
  -- SEM FK (como obras_restricao.cmp_pedido_id): FK criaria gatilho em cmp_pedidos.
  cmp_pedido_id uuid not null,
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  devolvida_em date,
  renovada_ate date,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz,
  constraint obras_locacao_estado_pedido_key unique (cmp_pedido_id)
);
create index if not exists obras_locacao_estado_obra_idx on public.obras_locacao_estado (obra_id);

create or replace function public.obras_locacao_estado_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_fim_atual date;
begin
  if tg_op = 'DELETE' then
    -- Cascata da obra apagada passa (obra só é apagada por admin ou sem JWT).
    if v_email is not null
       and exists (select 1 from public.obras_obra o where o.id = old.obra_id)
       and public.obras_is_admin() is not true then
      raise exception 'OBRAS_LOCACAO: só administrador apaga o estado da locação' using errcode = '42501';
    end if;
    return old;
  end if;

  if v_email is not null and public.obras_engenheiro_ou_admin_mae(new.obra_id) is not true then
    raise exception 'OBRAS_LOCACAO: só o engenheiro da obra (ou da obra mãe) ou administrador marca a locação'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- Qualquer role: o pedido existe, foi EMITIDO, é de LOCAÇÃO e a solicitação é desta obra.
    if not exists (
         select 1
           from public.cmp_pedidos p
           join public.cmp_solicitacoes s on s.id = p.solicitacao_id
          where p.id = new.cmp_pedido_id
            and p.ambiente = 'producao'
            and p.situacao = 'emitido'
            and s.ambiente = 'producao'
            and s.tipo = 'locacao'
            and s.obra_id = new.obra_id) then
      raise exception 'OBRAS_LOCACAO: o pedido não existe, não foi emitido, não é de locação ou não é desta obra'
        using errcode = '23514';
    end if;
  end if;

  -- renovada_ate depois do fim atual (locacao_fim do Compras, ou o dia da entrega).
  if new.renovada_ate is not null
     and (tg_op = 'INSERT' or new.renovada_ate is distinct from old.renovada_ate) then
    select coalesce(s.locacao_fim, (p.entrega_em at time zone 'America/Sao_Paulo')::date) into v_fim_atual
      from public.cmp_pedidos p
      join public.cmp_solicitacoes s on s.id = p.solicitacao_id
     where p.id = new.cmp_pedido_id;
    if v_fim_atual is not null and new.renovada_ate <= v_fim_atual then
      raise exception 'OBRAS_LOCACAO: renovada até tem de ser depois do fim atual da locação (%)', v_fim_atual
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.criado_por := v_email;
    new.criado_em := now();
    new.atualizado_por := null;
    new.atualizado_em := null;
    return new;
  end if;

  -- UPDATE: pedido e obra imutáveis (o vínculo foi conferido no INSERT); autoria fica.
  if new.id is distinct from old.id
     or new.cmp_pedido_id is distinct from old.cmp_pedido_id
     or new.obra_id is distinct from old.obra_id then
    raise exception 'OBRAS_LOCACAO: id, cmp_pedido_id e obra_id são imutáveis' using errcode = 'P0001';
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.atualizado_por := v_email;
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_locacao_estado_guarda() from public, anon, authenticated;

drop trigger if exists obras_locacao_estado_guarda on public.obras_locacao_estado;
create trigger obras_locacao_estado_guarda
  before insert or update or delete on public.obras_locacao_estado
  for each row execute function public.obras_locacao_estado_guarda();

alter table public.obras_locacao_estado enable row level security;
drop policy if exists "obras select" on public.obras_locacao_estado;
create policy "obras select" on public.obras_locacao_estado for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras engenheiro insert" on public.obras_locacao_estado;
create policy "obras engenheiro insert" on public.obras_locacao_estado for insert to authenticated
  with check (public.obras_engenheiro_ou_admin_mae(obra_id));
drop policy if exists "obras engenheiro update" on public.obras_locacao_estado;
create policy "obras engenheiro update" on public.obras_locacao_estado for update to authenticated
  using (public.obras_engenheiro_ou_admin_mae(obra_id))
  with check (public.obras_engenheiro_ou_admin_mae(obra_id));
drop policy if exists "obras admin delete" on public.obras_locacao_estado;
create policy "obras admin delete" on public.obras_locacao_estado for delete to authenticated
  using ((select public.obras_is_admin()));
revoke all on public.obras_locacao_estado from anon;
revoke truncate on public.obras_locacao_estado from authenticated;

-- ============================================================
-- 5. Leituras (obra + filhas diretas). Zero linhas sem permissão.
-- ============================================================

-- 5a. Pagamentos/rateio e caixinha ligados à obra (vínculos ATIVOS do Financeiro).
--     Uma linha por (vínculo). CENTAVOS:
--       valor_centavos           = CUSTO ATRIBUÍDO à obra, o que se soma:
--         * solicitação: os vínculos somam 100% do TOTAL da solicitação, mesmo
--           quando o rateio mistura CC de OBRAS/SPOT com outro (ex.: ADM). Então
--           atribuído = vínculo.valor_centavos × (soma do rateio cujo CC é de
--           OBRAS/SPOT — fin_obra_exige(cc, NULL), sem olhar categoria) ÷ total
--           da solicitação, arredondado ao centavo. Rateio todo OBRAS/SPOT (ou
--           solicitação sem linha de rateio) = valor do vínculo. O valor manda;
--           percentual_centesimos é só rótulo;
--         * caixinha: o valor ATUAL da despesa (a cópia do VEX pode ter mudado),
--           ou o do vínculo se a despesa sumiu da cópia;
--       vinculo_valor_centavos   = valor gravado no vínculo (bruto);
--       rateio_obras_centavos    = soma do rateio em CC de OBRAS/SPOT (NULL na
--                                  caixinha e na solicitação sem rateio);
--       solicitacao_valor_centavos = total da solicitação (todas as obras e CCs).
--     de_medicao_fornecedor = a solicitação veio da integração de medição do
--     Fornecedores (fin_solicitacao_integracoes, origem 'fornecedores_medicao',
--     gravada na MESMA transação da solicitação) ou o Fornecedores já gravou o
--     fin_solicitacao_id na medição. Essa solicitação já conta em
--     obras_fin_fornecedores: a consolidação NÃO soma as duas — a regra de exclusão
--     é esta coluna (Task 7). frn_medicao_id = a medição pela chave da integração
--     (tentativa 1: chave = id da medição) ou por frn_medicoes.fin_solicitacao_id
--     (tentativas 2+ usam chave derivada); pode vir NULL com a coluna true.
--     Todas as etapas vêm (recusada/cancelada inclusive): a tela decide o que conta.
--     fornecedor_documento = CPF/CNPJ do fornecedor da solicitação, só [0-9A-Z] (NULL
--     na caixinha): a tela casa com o documento do pedido do Compras da mesma família
--     (obras_fin_compras.fornecedor_documento) e trata o vínculo como PAGAMENTO do
--     pedido, não custo a mais (decisão M3 da revisão da Task 7).
--     O retorno mudou (fornecedor_documento) -> drop e create.
drop function if exists public.obras_fin_vinculos(uuid);
create function public.obras_fin_vinculos(p_obra uuid)
returns table (
  obra_id uuid,
  obra_os text,
  vinculo_id uuid,
  origem text,
  vinculo_os text,
  percentual_centesimos integer,
  valor_centavos bigint,
  vinculo_valor_centavos bigint,
  rateio_obras_centavos bigint,
  vinculo_criado_em timestamptz,
  vinculo_criado_por_nome text,
  solicitacao_id uuid,
  solicitacao_numero bigint,
  solicitacao_tipo text,
  solicitacao_etapa text,
  fornecedor_razao_social text,
  categoria_descricao text,
  solicitacao_descricao text,
  solicitacao_valor_centavos bigint,
  vencimento date,
  solicitacao_enviado_em timestamptz,
  pagamento_situacao text,
  pagamento_data date,
  pagamento_valor_pago_centavos bigint,
  frn_medicao_id uuid,
  de_medicao_fornecedor boolean,
  vex_despesa_id bigint,
  despesa_data date,
  despesa_titulo text,
  despesa_tipo_nome text,
  despesa_centro_custo_nome text,
  relatorio_status text,
  fornecedor_documento text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with alvo as (
    select o.id, o.os
      from public.obras_obra o
     where public.obras_pode_ver_valores(p_obra) is true
       and (o.id = p_obra or o.obra_pai_id = p_obra)
  )
  select a.id, a.os,
         v.id, v.origem, v.os, v.percentual_centesimos,
         case when v.origem = 'caixinha_despesa' then coalesce(d.valor_centavos, v.valor_centavos)
              when rt.obras_centavos is null then v.valor_centavos
              else round(v.valor_centavos::numeric * rt.obras_centavos / s.valor_centavos)::bigint end,
         v.valor_centavos, rt.obras_centavos, v.criado_em, v.criado_por_nome,
         s.id, s.numero, s.tipo, s.etapa, s.fornecedor_razao_social, s.categoria_descricao, s.descricao,
         s.valor_centavos, s.vencimento, s.enviado_em,
         po.situacao, po.data_pagamento, po.valor_pago_centavos,
         coalesce(mi.id, fm.id),
         (ig.solicitacao_id is not null or fm.id is not null),
         v.vex_despesa_id, d.data, d.titulo, d.tipo_nome, d.centro_custo_nome, r.status,
         nullif(upper(regexp_replace(coalesce(s.fornecedor_documento, ''), '[^0-9A-Za-z]', '', 'g')), '')
    from alvo a
    join public.fin_obra_vinculos v
      on v.obra_id = a.id and v.ambiente = 'producao' and v.desfeito_em is null
    left join public.fin_solicitacoes s
      on v.origem = 'solicitacao' and s.id = v.solicitacao_id
    left join public.fin_pagamentos_omie po
      on po.solicitacao_id = s.id
    -- NULL quando não há linha de rateio (count = 0): o vínculo vale inteiro.
    left join lateral (
      select case when count(*) = 0 then null
                  else coalesce(sum(r.valor_centavos) filter (
                         where public.fin_obra_exige(r.departamento_descricao, null) is true), 0)::bigint
             end as obras_centavos
        from public.fin_solicitacao_rateio r
       where s.id is not null and r.solicitacao_id = s.id
    ) rt on true
    left join lateral (
      select m.id from public.frn_medicoes m
       where s.id is not null and m.fin_solicitacao_id = s.id
       order by m.seq limit 1
    ) fm on true
    left join public.fin_solicitacao_integracoes ig
      on ig.solicitacao_id = s.id and ig.origem = 'fornecedores_medicao'
    left join public.frn_medicoes mi
      on mi.id::text = lower(ig.chave)
    left join public.fin_caixinha_despesas d
      on v.origem = 'caixinha_despesa' and d.ambiente = v.ambiente and d.vex_id = v.vex_despesa_id
    left join public.fin_caixinha_relatorios r
      on r.ambiente = d.ambiente and r.vex_id = d.relatorio_vex_id
   where v.origem = 'caixinha_despesa' or s.ambiente = 'producao'
   order by v.origem, coalesce(s.enviado_em, d.data::timestamptz, v.criado_em), v.id, a.os;
$$;
revoke execute on function public.obras_fin_vinculos(uuid) from public, anon;
grant execute on function public.obras_fin_vinculos(uuid) to authenticated, service_role;

-- 5b. Despesas de caixinha que EXIGEM obra (fin_obra_exige: CC de OBRAS/SPOT e
--     categoria variável) e não têm vínculo ativo — contagem GLOBAL (não por obra:
--     a despesa sem obra ainda não é de obra nenhuma). p_obra só decide a permissão
--     (obras_pode_ver_valores). Sempre UMA linha para quem pode; zero para os demais.
--     SÓ A QUANTIDADE (sem R$): o valor é da empresa toda, não da obra.
--     Todos os status do relatório entram (a fila do Financeiro é a mesma regra).
drop function if exists public.obras_fin_caixinha_sem_obra(uuid);
create function public.obras_fin_caixinha_sem_obra(p_obra uuid)
returns table (
  quantidade bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select count(*)
    from public.fin_caixinha_despesas d
   where d.ambiente = 'producao'
     and public.fin_obra_exige(d.centro_custo_nome, d.tipo_nome) is true
     and not exists (select 1 from public.fin_obra_vinculos v
                      where v.origem = 'caixinha_despesa'
                        and v.ambiente = d.ambiente
                        and v.vex_despesa_id = d.vex_id
                        and v.desfeito_em is null)
  having public.obras_pode_ver_valores(p_obra) is true;
$$;
revoke execute on function public.obras_fin_caixinha_sem_obra(uuid) from public, anon;
grant execute on function public.obras_fin_caixinha_sem_obra(uuid) to authenticated, service_role;

-- 5c. Locações: pedidos EMITIDOS de solicitação tipo 'locacao' da obra e filhas.
--     inicio = dia da entrega no Compras (BRT; NULL até entregar);
--     fim    = renovada_ate (se o engenheiro renovou) senão locacao_fim do Compras;
--     sem_periodo = fim NULL (locação recorrente nasce sem locacao_fim) -> tela
--     mostra "sem período" e não avisa vencimento.
--     estado = 'devolvida' (devolvida_em), 'renovada' (renovada_ate) ou 'ativa'.
--     Linhas para obras_has_access() (o aviso de vencimento é da obra toda);
--     total_centavos (CENTAVOS) só com obras_pode_ver_valores — NULL para os demais.
create or replace function public.obras_fin_locacoes(p_obra uuid)
returns table (
  obra_id uuid,
  obra_os text,
  pedido_id uuid,
  solicitacao_id uuid,
  solicitacao_numero bigint,
  solicitacao_motivo text,
  pedido_sequencia smallint,
  fornecedor_razao_social text,
  omie_numero text,
  total_centavos bigint,
  prazo_necessario date,
  previsao_entrega date,
  entrega_situacao text,
  entrega_em timestamptz,
  inicio date,
  locacao_fim date,
  fim date,
  sem_periodo boolean,
  estado text,
  estado_id uuid,
  devolvida_em date,
  renovada_ate date,
  estado_atualizado_por text,
  estado_atualizado_em timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with pode as (
    select public.obras_pode_ver_valores(p_obra) is true as valores
  ),
  alvo as (
    select o.id, o.os
      from public.obras_obra o
     where public.obras_has_access() is true
       and nullif(lower(trim(auth.jwt() ->> 'email')), '') is not null
       and (o.id = p_obra or o.obra_pai_id = p_obra)
  )
  select a.id, a.os,
         p.id, s.id, s.numero, s.motivo, p.sequencia, f.razao_social, p.omie_numero,
         case when pode.valores then p.total_centavos end,
         s.prazo_necessario, p.previsao_entrega, p.entrega_situacao, p.entrega_em,
         (p.entrega_em at time zone 'America/Sao_Paulo')::date,
         s.locacao_fim,
         coalesce(e.renovada_ate, s.locacao_fim),
         coalesce(e.renovada_ate, s.locacao_fim) is null,
         case when e.devolvida_em is not null then 'devolvida'
              when e.renovada_ate is not null then 'renovada'
              else 'ativa' end,
         e.id, e.devolvida_em, e.renovada_ate,
         coalesce(e.atualizado_por, e.criado_por), coalesce(e.atualizado_em, e.criado_em)
    from alvo a
    cross join pode
    join public.cmp_solicitacoes s
      on s.obra_id = a.id and s.ambiente = 'producao' and s.tipo = 'locacao'
    join public.cmp_pedidos p
      on p.solicitacao_id = s.id and p.ambiente = 'producao' and p.situacao = 'emitido'
    left join public.cmp_mapa_fornecedores f on f.id = p.mapa_fornecedor_id
    left join public.obras_locacao_estado e on e.cmp_pedido_id = p.id and e.obra_id = a.id
   order by coalesce(e.renovada_ate, s.locacao_fim) nulls last, s.numero, p.sequencia;
$$;
revoke execute on function public.obras_fin_locacoes(uuid) from public, anon;
grant execute on function public.obras_fin_locacoes(uuid) to authenticated, service_role;

-- 5d. Medições de FORNECEDOR aguardando aprovação há mais de 10 dias
--     da obra ou das filhas. Obra da medição = coalesce(frn_medicoes.obra_id,
--     frn_contratos.obra_id): contrato GLOBAL não tem obra, a obra é escolhida na
--     medição (Fornecedores 013); medição antiga de contrato específico tem obra_id
--     NULL e herda a do contrato. REAIS (numeric, como no Fornecedores): valor_reais.
--     dias_aguardando = dias (BRT) desde solicitado_em.
--     "Aguardando aprovação" = status 'solicitada' (a 013 NÃO criou status novo; a
--     pré-aprovação do engenheiro é o carimbo pre_aprovado_em dentro de 'solicitada').
--     aguardando = 'engenheiro' quando pre_aprovado_em é NULL e a obra da medição tem
--     engenheiro_email; senão 'eduardo' (pré-aprovada, ou obra sem engenheiro).
create or replace function public.obras_fin_medicoes_fornecedor_atrasadas(p_obra uuid)
returns table (
  obra_id uuid,
  obra_os text,
  medicao_id uuid,
  medicao_numero text,
  medicao_status text,
  contrato_id uuid,
  contrato_numero text,
  fornecedor_razao_social text,
  medicao_item text,
  medicao_descricao text,
  medicao_competencia date,
  valor_reais numeric,
  solicitado_em timestamptz,
  dias_aguardando integer,
  pre_aprovado_em timestamptz,
  aguardando text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with alvo as (
    select o.id, o.os, nullif(lower(trim(o.engenheiro_email)), '') as engenheiro
      from public.obras_obra o
     where public.obras_pode_ver_valores(p_obra) is true
       and (o.id = p_obra or o.obra_pai_id = p_obra)
  )
  select a.id, a.os,
         m.id, m.numero, m.status, c.id, c.numero, fo.razao_social,
         m.item, m.descricao, m.competencia, m.valor, m.solicitado_em,
         ((now() at time zone 'America/Sao_Paulo')::date - (m.solicitado_em at time zone 'America/Sao_Paulo')::date)::integer,
         m.pre_aprovado_em,
         case when m.pre_aprovado_em is null and a.engenheiro is not null then 'engenheiro' else 'eduardo' end
    from alvo a
    join public.frn_medicoes m on m.obra_id = a.id or m.obra_id is null
    join public.frn_contratos c on c.id = m.contrato_id
    join public.frn_fornecedores fo on fo.id = c.fornecedor_id
   where coalesce(m.obra_id, c.obra_id) = a.id
     and m.status = 'solicitada'
     and m.solicitado_em < now() - interval '10 days'
   order by m.solicitado_em, m.id;
$$;
revoke execute on function public.obras_fin_medicoes_fornecedor_atrasadas(uuid) from public, anon;
grant execute on function public.obras_fin_medicoes_fornecedor_atrasadas(uuid) to authenticated, service_role;

-- 5f. obras_fin_fornecedores: corpo da Fase A com a obra da MEDIÇÃO
--     (coalesce(frn_medicoes.obra_id, frn_contratos.obra_id)) — o retorno muda
--     (coluna contrato_da_obra) -> drop e create. Uma linha por (contrato, medição
--     desta obra); contrato DESTA obra sem medição sai uma vez com a medição nula;
--     contrato GLOBAL (ou de outra obra) só entra pelas medições desta obra.
--     contrato_da_obra = frn_contratos.obra_id é a obra da linha. Quando false,
--     valor_mo_reais, valor_mat_reais, aditivos_mo_reais e aditivos_mat_reais vêm
--     NULL: o valor do contrato global não é compromisso desta obra (só as medições).
--     REAIS (numeric, como no Fornecedores).
drop function if exists public.obras_fin_fornecedores(uuid);
create function public.obras_fin_fornecedores(p_obra uuid)
returns table (
  obra_id uuid,
  obra_os text,
  contrato_id uuid,
  contrato_numero text,
  contrato_status text,
  contrato_classificacao text,
  contrato_escopo text,
  fornecedor_razao_social text,
  contrato_inicio date,
  contrato_fim date,
  valor_mo_reais numeric,
  valor_mat_reais numeric,
  aditivos_mo_reais numeric,
  aditivos_mat_reais numeric,
  medicao_id uuid,
  medicao_numero text,
  medicao_item text,
  medicao_descricao text,
  medicao_competencia date,
  medicao_valor_reais numeric,
  medicao_status text,
  medicao_solicitado_em timestamptz,
  medicao_aprovado_em timestamptz,
  medicao_vencimento date,
  medicao_nf_numero text,
  medicao_pago_em date,
  medicao_valor_pago_reais numeric,
  contrato_da_obra boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with alvo as (
    select o.id, o.os
      from public.obras_obra o
     where public.obras_pode_ver_valores(p_obra) is true
       and (o.id = p_obra or o.obra_pai_id = p_obra)
  )
  select a.id, a.os,
         c.id, c.numero, c.status, c.classificacao, c.escopo, fo.razao_social,
         c.inicio, c.fim,
         case when c.obra_id = a.id then c.valor_mo end,
         case when c.obra_id = a.id then c.valor_mat end,
         case when c.obra_id = a.id then coalesce(ad.mo, 0) end,
         case when c.obra_id = a.id then coalesce(ad.mat, 0) end,
         m.id, m.numero, m.item, m.descricao, m.competencia, m.valor, m.status,
         m.solicitado_em, m.aprovado_em, m.vencimento, m.nf_numero, m.pago_em, m.valor_pago,
         coalesce(c.obra_id = a.id, false)
    from alvo a
    join public.frn_contratos c
      on c.obra_id = a.id
      or exists (select 1 from public.frn_medicoes mm where mm.contrato_id = c.id and mm.obra_id = a.id)
    join public.frn_fornecedores fo on fo.id = c.fornecedor_id
    left join lateral (
      select sum(x.valor) filter (where x.item = 'mo') as mo,
             sum(x.valor) filter (where x.item = 'mat') as mat
        from public.frn_aditivos x
       where x.contrato_id = c.id and x.tipo = 'valor' and x.status = 'aprovado'
    ) ad on true
    left join public.frn_medicoes m
      on m.contrato_id = c.id and coalesce(m.obra_id, c.obra_id) = a.id
   order by c.numero, m.seq;
$$;
revoke execute on function public.obras_fin_fornecedores(uuid) from public, anon;
grant execute on function public.obras_fin_fornecedores(uuid) to authenticated, service_role;

-- 5e. obras_fin_notas: corpo da Fase A + medicao_ids (o retorno muda -> drop e create).
--     medicao_ids = medições ao cliente ligadas à nota (fin_fat_nota_medicoes) que são
--     da MESMA obra da linha; '{}' sem medição. Continua uma linha por (nota, obra).
drop function if exists public.obras_fin_notas(uuid);
create function public.obras_fin_notas(p_obra uuid)
returns table (
  obra_id uuid,
  obra_os text,
  nota_id uuid,
  parcela_centavos bigint,
  parcela_os text,
  parcela_etapa text,
  parcela_forma text,
  nota_valor_total_centavos bigint,
  nota_valor_servico_centavos bigint,
  nota_situacao text,
  nfse_numero text,
  tomador_nome text,
  pedido text,
  nota_criado_em timestamptz,
  autorizada_em timestamptz,
  enviada_em timestamptz,
  obras_devolvidas_em timestamptz,
  medicao_ids uuid[]
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with alvo as (
    select o.id, o.os
      from public.obras_obra o
     where public.obras_pode_ver_valores(p_obra) is true
       and (o.id = p_obra or o.obra_pai_id = p_obra)
  )
  select a.id, a.os,
         n.id, nob.valor_centavos, nob.os, nob.etapa, nob.forma,
         n.valor_total_centavos, n.valor_servico_centavos, n.situacao, n.nfse_numero,
         n.tomador_nome, n.pedido, n.criado_em, n.autorizada_em, n.enviada_em, n.obras_devolvidas_em,
         coalesce((select array_agg(nm.medicao_id order by mc.numero)
                     from public.fin_fat_nota_medicoes nm
                     join public.obras_medicao_cliente mc on mc.id = nm.medicao_id
                    where nm.nota_id = n.id and mc.obra_id = a.id), '{}'::uuid[])
    from alvo a
    join public.fin_fat_nota_obras nob on nob.obra_id = a.id
    join public.fin_fat_notas n on n.id = nob.nota_id and n.ambiente = 'producao'
   order by n.criado_em, n.id, a.os;
$$;
revoke execute on function public.obras_fin_notas(uuid) from public, anon;
grant execute on function public.obras_fin_notas(uuid) to authenticated, service_role;

-- 5g. obras_fin_compras: corpo da Fase A + fornecedor_documento (no fim) — CPF/CNPJ
--     do fornecedor do mapa (cmp_mapa_fornecedores.documento), só [0-9A-Z], NULL sem
--     pedido/documento. Serve para casar o pagamento do Financeiro (obras_fin_vinculos)
--     com o pedido. O retorno muda -> drop e create; mesmos grants da Fase A.
drop function if exists public.obras_fin_compras(uuid);
create function public.obras_fin_compras(p_obra uuid)
returns table (
  obra_id uuid,
  obra_os text,
  solicitacao_id uuid,
  solicitacao_numero bigint,
  solicitacao_tipo text,
  solicitacao_etapa text,
  solicitacao_motivo text,
  prazo_necessario date,
  solicitacao_enviado_em timestamptz,
  valor_estimado_centavos bigint,
  pedido_id uuid,
  pedido_sequencia smallint,
  fornecedor_razao_social text,
  pedido_situacao text,
  omie_numero text,
  total_centavos bigint,
  pedido_criado_em timestamptz,
  previsao_entrega date,
  entrega_situacao text,
  entrega_em timestamptz,
  nf_numero text,
  nf_em timestamptz,
  pago_em timestamptz,
  concluido_em timestamptz,
  fornecedor_documento text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with alvo as (
    select o.id, o.os
      from public.obras_obra o
     where public.obras_pode_ver_valores(p_obra) is true
       and (o.id = p_obra or o.obra_pai_id = p_obra)
  )
  select a.id, a.os,
         s.id, s.numero, s.tipo, s.etapa, s.motivo, s.prazo_necessario, s.enviado_em, s.valor_estimado_centavos,
         p.id, p.sequencia, f.razao_social, p.situacao, p.omie_numero, p.total_centavos,
         p.criado_em, p.previsao_entrega, p.entrega_situacao, p.entrega_em, p.nf_numero, p.nf_em,
         p.pago_em, p.concluido_em,
         nullif(upper(regexp_replace(coalesce(f.documento, ''), '[^0-9A-Za-z]', '', 'g')), '')
    from alvo a
    join public.cmp_solicitacoes s on s.obra_id = a.id and s.ambiente = 'producao'
    left join public.cmp_pedidos p on p.solicitacao_id = s.id and p.ambiente = 'producao'
    left join public.cmp_mapa_fornecedores f on f.id = p.mapa_fornecedor_id
   order by s.numero, p.sequencia;
$$;
revoke execute on function public.obras_fin_compras(uuid) from public, anon;
grant execute on function public.obras_fin_compras(uuid) to authenticated, service_role;

-- ============================================================
-- 6. Valor receita da OBRA: só administrador (SPOT inalterado)
-- ============================================================
create or replace function public.obras_obra_valor_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.valor is distinct from old.valor
     and (new.modalidade = 'obra' or old.modalidade = 'obra')
     and nullif(lower(trim(auth.jwt() ->> 'email')), '') is not null
     and public.obras_is_admin() is not true then
    raise exception 'OBRAS_VALOR: só administrador altera o valor receita de obra da modalidade OBRA'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_obra_valor_guarda() from public, anon, authenticated;

drop trigger if exists obras_obra_valor_guarda on public.obras_obra;
create trigger obras_obra_valor_guarda
  before update of valor on public.obras_obra
  for each row execute function public.obras_obra_valor_guarda();

commit;

-- ============================================================
-- VERIFICAÇÃO (PASSO 2) — rodar depois do commit. Qualquer *** FALHOU *** = parar.
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado is not distinct from esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, '3 tabelas novas com RLS ligada', '3',
      (select count(*)::text from pg_class
        where relnamespace = 'public'::regnamespace and relrowsecurity
          and relname in ('obras_cliente_pessoa', 'obras_medicao_cliente', 'obras_locacao_estado'))),
  (2, 'policies: pessoa 4, medição 4, locação 4', '4|4|4',
      (select (select count(*) from pg_policies where schemaname = 'public' and tablename = 'obras_cliente_pessoa')::text
              || '|' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'obras_medicao_cliente')::text
              || '|' || (select count(*) from pg_policies where schemaname = 'public' and tablename = 'obras_locacao_estado')::text)),
  (3, 'pessoa: escrita só admin (insert/update/delete usam obras_is_admin)', '3',
      (select count(*)::text from pg_policies
        where schemaname = 'public' and tablename = 'obras_cliente_pessoa' and cmd in ('INSERT', 'UPDATE', 'DELETE')
          and coalesce(qual, with_check) like '%obras_is_admin()%'
          and coalesce(with_check, qual) like '%obras_is_admin()%')),
  (4, 'medição: select por obras_pode_ver_valores; insert/update por engenheiro_ou_admin_mae; delete admin', 'true|2|true',
      (select (select bool_and(qual like '%obras_pode_ver_valores(obra_id)%') from pg_policies
                where schemaname = 'public' and tablename = 'obras_medicao_cliente' and cmd = 'SELECT')::text
              || '|' || (select count(*) from pg_policies
                where schemaname = 'public' and tablename = 'obras_medicao_cliente' and cmd in ('INSERT', 'UPDATE')
                  and with_check like '%obras_engenheiro_ou_admin_mae(obra_id)%')::text
              || '|' || (select bool_and(qual like '%obras_is_admin()%') from pg_policies
                where schemaname = 'public' and tablename = 'obras_medicao_cliente' and cmd = 'DELETE')::text)),
  (5, '3 triggers de guarda ligados (before insert/update/delete)', '3',
      (select count(*)::text from pg_trigger
        where not tgisinternal and tgenabled = 'O'
          and (tgtype & 2) = 2 and (tgtype & 4) = 4 and (tgtype & 8) = 8 and (tgtype & 16) = 16
          and ((tgname = 'obras_cliente_pessoa_guarda' and tgrelid = 'public.obras_cliente_pessoa'::regclass)
            or (tgname = 'obras_medicao_cliente_guarda' and tgrelid = 'public.obras_medicao_cliente'::regclass)
            or (tgname = 'obras_locacao_estado_guarda' and tgrelid = 'public.obras_locacao_estado'::regclass)))),
  (6, 'guarda da medição: trava a OS, soma <= 10000 sem recusadas, aprovada final, is not true', 'true',
      (select (prosrc like '%for no key update%'
               and prosrc like '%> 10000%'
               and prosrc like '%m.situacao <> ''recusada''%'
               and prosrc like '%old.situacao = ''aprovada''%'
               and prosrc like '%obras_engenheiro_ou_admin_mae(new.obra_id) is not true%'
               and prosrc like '%new.criado_por := old.criado_por%'
               and prosrc not like '%and not public.%')::text
         from pg_proc where oid = 'public.obras_medicao_cliente_guarda()'::regprocedure)),
  (7, 'guarda da locação: pedido de locação da mesma obra; autoria fica no update', 'true',
      (select (prosrc like '%s.tipo = ''locacao''%'
               and prosrc like '%s.obra_id = new.obra_id%'
               and prosrc like '%new.criado_por := old.criado_por%')::text
         from pg_proc where oid = 'public.obras_locacao_estado_guarda()'::regprocedure)),
  (8, 'obras_engenheiro_ou_admin_mae: coalesce false, mãe, has_access', 'true',
      (select (prosrc like '%coalesce((%' and prosrc like '%), false)%'
               and prosrc like '%m.engenheiro_email%' and prosrc like '%obras_has_access() is true%')::text
         from pg_proc where oid = 'public.obras_engenheiro_ou_admin_mae(uuid)'::regprocedure)),
  (9, '7 funções (ajudante + 6 leituras): security definer, stable, search_path fixo', '7|7|7',
      (select count(*) filter (where p.prosecdef)::text || '|'
              || count(*) filter (where p.provolatile = 's')::text || '|'
              || count(*) filter (where p.proconfig @> array['search_path=pg_catalog, public'])::text
         from pg_proc p
        where p.oid in (to_regprocedure('public.obras_engenheiro_ou_admin_mae(uuid)'),
                        to_regprocedure('public.obras_fin_vinculos(uuid)'),
                        to_regprocedure('public.obras_fin_caixinha_sem_obra(uuid)'),
                        to_regprocedure('public.obras_fin_locacoes(uuid)'),
                        to_regprocedure('public.obras_fin_medicoes_fornecedor_atrasadas(uuid)'),
                        to_regprocedure('public.obras_fin_notas(uuid)'),
                        to_regprocedure('public.obras_fin_fornecedores(uuid)')))),
  (10, 'as 7: authenticated executa; anon e public não', '7|0|0',
      (select count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text || '|'
              || count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE'))::text || '|'
              || count(*) filter (where exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                               where a.grantee = 0 and a.privilege_type = 'EXECUTE'))::text
         from pg_proc p
        where p.oid in (to_regprocedure('public.obras_engenheiro_ou_admin_mae(uuid)'),
                        to_regprocedure('public.obras_fin_vinculos(uuid)'),
                        to_regprocedure('public.obras_fin_caixinha_sem_obra(uuid)'),
                        to_regprocedure('public.obras_fin_locacoes(uuid)'),
                        to_regprocedure('public.obras_fin_medicoes_fornecedor_atrasadas(uuid)'),
                        to_regprocedure('public.obras_fin_notas(uuid)'),
                        to_regprocedure('public.obras_fin_fornecedores(uuid)')))),
  (11, 'funções de trigger: authenticated e anon NÃO executam', '0',
      (select count(*)::text from pg_proc p
        where p.oid in (to_regprocedure('public.obras_cliente_pessoa_guarda()'),
                        to_regprocedure('public.obras_medicao_cliente_guarda()'),
                        to_regprocedure('public.obras_locacao_estado_guarda()'))
          and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
               or has_function_privilege('anon', p.oid, 'EXECUTE')))),
  (12, 'leituras de valor checam obras_pode_ver_valores (5) e filtram obra + filhas (6)', '5|6',
      (select (select count(*) from pg_proc
                where oid in (to_regprocedure('public.obras_fin_vinculos(uuid)'),
                              to_regprocedure('public.obras_fin_caixinha_sem_obra(uuid)'),
                              to_regprocedure('public.obras_fin_medicoes_fornecedor_atrasadas(uuid)'),
                              to_regprocedure('public.obras_fin_notas(uuid)'),
                              to_regprocedure('public.obras_fin_fornecedores(uuid)'))
                  and prosrc like '%obras_pode_ver_valores(p_obra) is true%')::text
              || '|' || (select count(*) from pg_proc
                where oid in (to_regprocedure('public.obras_fin_vinculos(uuid)'),
                              to_regprocedure('public.obras_fin_locacoes(uuid)'),
                              to_regprocedure('public.obras_fin_medicoes_fornecedor_atrasadas(uuid)'),
                              to_regprocedure('public.obras_fin_notas(uuid)'),
                              to_regprocedure('public.obras_fin_compras(uuid)'),
                              to_regprocedure('public.obras_fin_fornecedores(uuid)'))
                  and prosrc like '%o.id = p_obra or o.obra_pai_id = p_obra%')::text)),
  (13, 'obras_fin_notas devolve medicao_ids uuid[] e mantém obras_devolvidas_em', 'true',
      (select (pg_get_function_result(oid) like '%medicao_ids uuid[]%'
               and pg_get_function_result(oid) like '%obras_devolvidas_em timestamp with time zone%')::text
         from pg_proc where oid = 'public.obras_fin_notas(uuid)'::regprocedure)),
  (14, 'sem JWT (aqui, como postgres) as leituras vêm vazias', '0',
      (select ((select count(*) from public.obras_fin_vinculos((select id from public.obras_obra order by created_at limit 1)))
             + (select count(*) from public.obras_fin_caixinha_sem_obra((select id from public.obras_obra order by created_at limit 1)))
             + (select count(*) from public.obras_fin_locacoes((select id from public.obras_obra order by created_at limit 1)))
             + (select count(*) from public.obras_fin_medicoes_fornecedor_atrasadas((select id from public.obras_obra order by created_at limit 1)))
             + (select count(*) from public.obras_fin_notas((select id from public.obras_obra order by created_at limit 1)))
             + (select count(*) from public.obras_fin_fornecedores((select id from public.obras_obra order by created_at limit 1))))::text)),
  (15, 'nenhuma FK/trigger nova em cmp_*/fin_*/frn_* apontando para obras_*; locação sem FK para cmp_pedidos', '0|0',
      (select (select count(*) from pg_constraint c join pg_class t on t.oid = c.conrelid
                where c.contype = 'f' and t.relnamespace = 'public'::regnamespace
                  and (t.relname like 'cmp\_%' or t.relname like 'fin\_%' or t.relname like 'frn\_%')
                  and c.confrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace and relname like 'obras\_%'))::text
              || '|' || (select count(*) from pg_constraint
                where conrelid = 'public.obras_locacao_estado'::regclass and contype = 'f'
                  and confrelid <> 'public.obras_obra'::regclass)::text)),
  (16, 'medição: obra ON DELETE RESTRICT; numero único por OS; checks de % e valor', 'r|1|2',
      (select (select string_agg(confdeltype::text, ',') from pg_constraint
                where conrelid = 'public.obras_medicao_cliente'::regclass and contype = 'f')
              || '|' || (select count(*) from pg_constraint
                where conrelid = 'public.obras_medicao_cliente'::regclass and conname = 'obras_medicao_cliente_numero_key')::text
              || '|' || (select count(*) from pg_constraint
                where conrelid = 'public.obras_medicao_cliente'::regclass
                  and conname in ('obras_medicao_cliente_percentual_check', 'obras_medicao_cliente_valor_check'))::text)),
  (17, 'anon sem nenhum privilégio nas 3 tabelas', '0',
      (select count(*)::text
         from (values ('public.obras_cliente_pessoa'), ('public.obras_medicao_cliente'), ('public.obras_locacao_estado')) t(tab),
              (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(priv)
        where has_table_privilege('anon', t.tab, p.priv))),
  (18, 'índices únicos: e-mail por obra (parcial) e pedido da locação', '2',
      (select count(*)::text from pg_indexes
        where schemaname = 'public'
          and indexname in ('obras_cliente_pessoa_obra_email_key', 'obras_locacao_estado_pedido_key'))),
  (19, 'fornecedores e atrasadas: obra = coalesce(medição, contrato); contrato_da_obra; aguardando engenheiro/eduardo', 'true',
      (select (bool_and(prosrc like '%coalesce(m.obra_id, c.obra_id) = a.id%')
               and bool_or(pg_get_function_result(oid) like '%contrato_da_obra boolean%')
               and bool_or(prosrc like '%then ''engenheiro'' else ''eduardo''%'))::text
         from pg_proc where oid in (to_regprocedure('public.obras_fin_fornecedores(uuid)'),
                                    to_regprocedure('public.obras_fin_medicoes_fornecedor_atrasadas(uuid)')))),
  (20, 'vínculos: custo atribuído pela parte OBRAS/SPOT do rateio (fin_obra_exige(cc, null))', 'true',
      (select (prosrc like '%fin_obra_exige(r.departamento_descricao, null) is true%'
               and prosrc like '%round(v.valor_centavos::numeric * rt.obras_centavos / s.valor_centavos)%'
               and pg_get_function_result(oid) like '%rateio_obras_centavos bigint%')::text
         from pg_proc where oid = 'public.obras_fin_vinculos(uuid)'::regprocedure)),
  (21, 'authenticated sem TRUNCATE nas 3 tabelas', '0',
      (select count(*)::text
         from (values ('public.obras_cliente_pessoa'), ('public.obras_medicao_cliente'), ('public.obras_locacao_estado')) t(tab)
        where has_table_privilege('authenticated', t.tab, 'TRUNCATE'))),
  (22, 'medição trava com nota (fin_fat_nota_medicoes); vínculos marcam origem por fin_solicitacao_integracoes; caixinha sem R$', 'true',
      (select (p1.prosrc like '%fin_fat_nota_medicoes nm where nm.medicao_id = old.id%'
               and p2.prosrc like '%fin_solicitacao_integracoes ig%'
               and pg_get_function_result(p2.oid) like '%de_medicao_fornecedor boolean%'
               and pg_get_function_result(p3.oid) not like '%valor%')::text
         from pg_proc p1, pg_proc p2, pg_proc p3
        where p1.oid = 'public.obras_medicao_cliente_guarda()'::regprocedure
          and p2.oid = 'public.obras_fin_vinculos(uuid)'::regprocedure
          and p3.oid = 'public.obras_fin_caixinha_sem_obra(uuid)'::regprocedure)),
  (23, 'trigger obras_obra_valor_guarda ligado (before update of valor), só admin em OBRA, falha fechada', 'true',
      (select (count(*) = 1
               and bool_and(pg_get_triggerdef(t.oid) like '%BEFORE UPDATE OF valor ON public.obras_obra%')
               and bool_and(p.prosrc like '%obras_is_admin() is not true%')
               and bool_and(p.prosrc like '%modalidade = ''obra''%')
               and bool_and(not has_function_privilege('authenticated', p.oid, 'EXECUTE')))::text
         from pg_trigger t join pg_proc p on p.oid = t.tgfoid
        where t.tgname = 'obras_obra_valor_guarda' and t.tgrelid = 'public.obras_obra'::regclass
          and not t.tgisinternal and t.tgenabled = 'O')),
  (24, 'compras e vínculos trazem fornecedor_documento; compras definer, EXECUTE só authenticated/service_role', 'true',
      (select (bool_and(pg_get_function_result(oid) like '%fornecedor_documento text%')
               and bool_and(prosecdef)
               and bool_and(has_function_privilege('authenticated', oid, 'EXECUTE'))
               and bool_and(not has_function_privilege('anon', oid, 'EXECUTE')))::text
         from pg_proc where oid in (to_regprocedure('public.obras_fin_compras(uuid)'),
                                    to_regprocedure('public.obras_fin_vinculos(uuid)'))))
) as t(n, verificacao, esperado, encontrado)
order by n;
