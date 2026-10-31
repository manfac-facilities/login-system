-- ============================================================
-- OBRAS — Financeiro da obra, Fase A (31/10/2026): a obra enxerga Compras,
-- Fornecedores e Faturamento; restrição ligada a pedido; OS filha (aditivo).
-- Spec: docs/superpowers/specs/2026-10-31-obras-financeiro-fase-a-design.md §1, §2, §5.
-- Plano: docs/superpowers/plans/2026-10-31-obras-financeiro-fase-a.md, Task 1.
--
-- TERRITÓRIO DE DINHEIRO + AUTORIZAÇÃO (AGENTS.md): toda dúvida falha FECHADA.
-- REGRA DE OURO (spec §2): nenhuma escrita, coluna, FK, trigger ou policy em
-- cmp_*, fin_*, frn_*. Só funções de LEITURA criadas aqui, no lado do hub.
--
-- O QUE FAZ
--   1. obras_obra.obra_pai_id uuid null -> obras_obra(id) ON DELETE RESTRICT
--      (obra mãe com aditivo não se apaga) + check obra_pai_id <> id.
--      obras_obra_parametros_guarda recriada (corpo da Leva 2 + obra_pai_id):
--      com JWT, só administrador grava/altera obra_pai_id; com ou sem JWT
--      (inclusive service role): um nível só (a mãe não é filha; quem tem
--      filha não vira filha), sem ciclo, mãe e filha modalidade 'obra', e
--      obra com filha não deixa de ser 'obra'. A mãe é travada (FOR UPDATE)
--      para duas gravações simultâneas não montarem dois níveis.
--   2. obras_pode_ver_valores(p_obra) -> boolean (nunca NULL). TRUE só se:
--      há e-mail no JWT, a obra existe, obras_has_access() é true E
--      (administrador do Obras OU engenheiro da obra OU engenheiro da obra mãe
--       OU papel ATIVO 'financeiro'/'diretor' em fin_papeis para o e-mail).
--      Supervisor, usuário comum do Obras, cliente e anon: false.
--      Financeiro/diretor TAMBÉM precisam de obras_has_access() de propósito:
--      eles abrem a obra dentro da Gestão de Obras (decisão do controlador).
--   3. Leituras (security definer, search_path fixo, stable, EXECUTE para
--      authenticated e service_role, nunca anon/public; service role não tem
--      JWT, então recebe vazio — falha fechada: o app TEM de chamar com o
--      cliente da sessão, nunca com o admin; devolvem ZERO linhas se obras_pode_ver_valores = false):
--      DE PROPÓSITO vão além da RLS do Compras/Fornecedores para esse público:
--      o engenheiro da obra vê as compras e contratos da obra (motivo,
--      fornecedor, valores) — decisão 1.1 do José. Sem documento (CPF/CNPJ)
--      do fornecedor nem CNPJ do tomador (minimização).
--      obras_fin_compras(p_obra), obras_fin_fornecedores(p_obra),
--      obras_fin_notas(p_obra) — da obra e das filhas diretas
--      (obra_pai_id = p_obra), com obra_id/obra_os da OS de origem.
--      Só ambiente 'producao'. Valores exatamente como gravados na origem:
--        *_centavos = bigint em CENTAVOS (cmp_*, fin_fat_*);
--        *_reais    = numeric em REAIS (frn_* grava reais, não centavos).
--   4. obras_restricao.cmp_pedido_id uuid null (SEM FK: FK criaria gatilho de
--      integridade em cmp_pedidos e travaria o apagar do Compras) + trigger
--      obras_restricao_pedido_guarda: (insert ou update of cmp_pedido_id, obra_id), o pedido
--      tem de existir e a solicitação dele ter obra_id = obra da restrição
--      (ambiente produção). Vale para qualquer role.
--      obras_restricao_pedidos(p_obra): pedidos da obra (só ela, não filhas)
--      SEM NENHUMA coluna de valor, para quem tem obras_has_access().
--
-- PRÉ-REQUISITO: sdd-sql-obras-leva5.sql aplicado (a seção 0 confere) e as
-- tabelas do Compras, Fornecedores e Financeiro (faturamento) com as colunas lidas.
-- Ordem: leva2 -> leva3 -> leva4 -> leva5 -> este.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-10-31-verificacao-obras-financeiro-a.sql.
--
-- IDEMPOTENTE: add column if not exists, create or replace, drop ... if exists.
--
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is not true` (sem NULL
-- aberto); a função de autorização devolve coalesce(..., false); uma função
-- de trigger por tabela, sem campo de outra tabela.
--
-- ROLLBACK (só depois de reverter o app):
--   drop function public.obras_fin_compras(uuid), public.obras_fin_fornecedores(uuid),
--                 public.obras_fin_notas(uuid), public.obras_restricao_pedidos(uuid),
--                 public.obras_pode_ver_valores(uuid);
--   drop trigger obras_restricao_pedido_guarda on public.obras_restricao;
--   drop function public.obras_restricao_pedido_guarda();
--   alter table public.obras_restricao drop column cmp_pedido_id;   -- perde os vínculos
--   reaplicar a seção 3 de sdd-sql-obras-leva2.sql (guarda sem obra_pai_id);
--   alter table public.obras_obra drop column obra_pai_id;          -- perde as ligações mãe/filha
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (Leva 5 e anteriores; colunas lidas de cmp/frn/fin)
-- ============================================================
do $$
declare
  v_col text;
  v_falta text := '';
begin
  if to_regclass('public.obras_obra') is null
     or to_regclass('public.obras_restricao') is null
     or to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null
     or to_regprocedure('public.obras_obra_parametros_guarda()') is null
     or to_regprocedure('public.obras_restricao_guarda()') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'peso_avanco') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra*, leva2 e leva3 não estão aplicados. Nada foi alterado.';
  end if;
  if to_regclass('public.obras_relatorio') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva4.sql não está aplicado. Nada foi alterado.';
  end if;
  if to_regclass('public.obras_portal_acesso') is null
     or to_regclass('public.obras_documento') is null
     or to_regclass('public.obras_mensagem') is null
     or to_regclass('public.obras_situacao_cliente') is null
     or to_regprocedure('public.obras_obra_delete_guarda()') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva5.sql não está aplicado. Nada foi alterado.';
  end if;

  foreach v_col in array array[
    'cmp_solicitacoes.id', 'cmp_solicitacoes.ambiente', 'cmp_solicitacoes.numero', 'cmp_solicitacoes.etapa',
    'cmp_solicitacoes.tipo', 'cmp_solicitacoes.motivo', 'cmp_solicitacoes.obra_id', 'cmp_solicitacoes.prazo_necessario',
    'cmp_solicitacoes.enviado_em', 'cmp_solicitacoes.valor_estimado_centavos',
    'cmp_pedidos.id', 'cmp_pedidos.solicitacao_id', 'cmp_pedidos.ambiente', 'cmp_pedidos.sequencia',
    'cmp_pedidos.mapa_fornecedor_id', 'cmp_pedidos.total_centavos', 'cmp_pedidos.situacao', 'cmp_pedidos.omie_numero',
    'cmp_pedidos.criado_em', 'cmp_pedidos.previsao_entrega', 'cmp_pedidos.entrega_situacao', 'cmp_pedidos.entrega_em',
    'cmp_pedidos.nf_numero', 'cmp_pedidos.nf_em', 'cmp_pedidos.pago_em', 'cmp_pedidos.concluido_em',
    'cmp_mapa_fornecedores.id', 'cmp_mapa_fornecedores.razao_social',
    'frn_contratos.id', 'frn_contratos.numero', 'frn_contratos.fornecedor_id', 'frn_contratos.obra_id',
    'frn_contratos.status', 'frn_contratos.classificacao', 'frn_contratos.escopo', 'frn_contratos.inicio',
    'frn_contratos.fim', 'frn_contratos.valor_mo', 'frn_contratos.valor_mat',
    'frn_aditivos.contrato_id', 'frn_aditivos.tipo', 'frn_aditivos.item', 'frn_aditivos.valor', 'frn_aditivos.status',
    'frn_fornecedores.id', 'frn_fornecedores.razao_social',
    'frn_medicoes.id', 'frn_medicoes.numero', 'frn_medicoes.contrato_id', 'frn_medicoes.item', 'frn_medicoes.descricao',
    'frn_medicoes.competencia', 'frn_medicoes.valor', 'frn_medicoes.status', 'frn_medicoes.solicitado_em',
    'frn_medicoes.aprovado_em', 'frn_medicoes.vencimento', 'frn_medicoes.nf_numero', 'frn_medicoes.pago_em',
    'frn_medicoes.valor_pago', 'frn_medicoes.seq',
    'fin_fat_notas.id', 'fin_fat_notas.ambiente', 'fin_fat_notas.valor_total_centavos',
    'fin_fat_notas.valor_servico_centavos', 'fin_fat_notas.situacao', 'fin_fat_notas.nfse_numero',
    'fin_fat_notas.tomador_nome', 'fin_fat_notas.pedido', 'fin_fat_notas.criado_em',
    'fin_fat_notas.autorizada_em', 'fin_fat_notas.enviada_em', 'fin_fat_notas.obras_devolvidas_em',
    'fin_fat_nota_obras.nota_id', 'fin_fat_nota_obras.obra_id', 'fin_fat_nota_obras.os',
    'fin_fat_nota_obras.valor_centavos', 'fin_fat_nota_obras.etapa', 'fin_fat_nota_obras.forma',
    'fin_papeis.user_email', 'fin_papeis.papel', 'fin_papeis.ativo', 'fin_papeis.revogado_em'
  ] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public'
                      and table_name = split_part(v_col, '.', 1)
                      and column_name = split_part(v_col, '.', 2)) then
      v_falta := v_falta || ' ' || v_col;
    end if;
  end loop;
  if v_falta <> '' then
    raise exception 'Pré-requisito ausente: colunas de Compras/Fornecedores/Financeiro não encontradas:%. Nada foi alterado.', v_falta;
  end if;
end $$;

-- ============================================================
-- 1. obras_obra.obra_pai_id (OS filha = aditivo) + guarda de parâmetros
--    (corpo de sdd-sql-obras-leva2.sql seção 3, com obra_pai_id a mais)
-- ============================================================
alter table public.obras_obra
  add column if not exists obra_pai_id uuid references public.obras_obra(id) on delete restrict;
alter table public.obras_obra drop constraint if exists obras_obra_pai_nao_e_ela;
alter table public.obras_obra add constraint obras_obra_pai_nao_e_ela check (obra_pai_id is distinct from id);
create index if not exists obras_obra_pai_idx on public.obras_obra (obra_pai_id) where obra_pai_id is not null;

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
            or new.data_base is not null
            or new.atividade_trava is not null
            or new.peso_avanco is not null
            or new.obra_pai_id is not null
            or new.modalidade is distinct from 'spot')
       and public.obras_is_admin() is not true then
      raise exception 'OBRAS_PARAMETROS: só administrador cria obra com modalidade, data base, engenheiro, atividade-trava, critério de peso ou obra mãe'
        using errcode = '42501';
    end if;
    v_checar_pai := new.obra_pai_id is not null;
  else
    if v_email is not null
       and (new.modalidade is distinct from old.modalidade
            or new.data_base is distinct from old.data_base
            or new.engenheiro_email is distinct from old.engenheiro_email
            or new.atividade_trava is distinct from old.atividade_trava
            or new.peso_avanco is distinct from old.peso_avanco
            or new.obra_pai_id is distinct from old.obra_pai_id)
       and public.obras_is_admin() is not true then
      raise exception 'OBRAS_PARAMETROS: só administrador altera modalidade, data base, engenheiro, atividade-trava, critério de peso e obra mãe'
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
  before insert or update of modalidade, data_base, engenheiro_email, atividade_trava, peso_avanco, obra_pai_id
  on public.obras_obra
  for each row execute function public.obras_obra_parametros_guarda();

-- ============================================================
-- 2. obras_pode_ver_valores(p_obra) — nunca NULL; falha fechada
-- ============================================================
create or replace function public.obras_pode_ver_valores(p_obra uuid)
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
       and public.obras_has_access() is true
       and (public.obras_is_admin() is true
            or eu.email = nullif(lower(trim(o.engenheiro_email)), '')
            or eu.email = nullif(lower(trim(m.engenheiro_email)), '')
            or exists (select 1 from public.fin_papeis f
                        where f.ativo is true
                          and f.revogado_em is null
                          and f.papel in ('financeiro', 'diretor')
                          and lower(trim(f.user_email)) = eu.email))
  ), false);
$$;
revoke execute on function public.obras_pode_ver_valores(uuid) from public, anon;
grant execute on function public.obras_pode_ver_valores(uuid) to authenticated, service_role;

-- ============================================================
-- 3. Leituras de valores (obra + filhas diretas). Zero linhas sem permissão.
-- ============================================================

-- 3a. Compras: uma linha por (solicitação, pedido); solicitação sem pedido
--     sai uma vez com as colunas do pedido nulas.
--     Centavos: valor_estimado_centavos, total_centavos (bigint, como no Compras).
create or replace function public.obras_fin_compras(p_obra uuid)
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
  concluido_em timestamptz
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
         p.pago_em, p.concluido_em
    from alvo a
    join public.cmp_solicitacoes s on s.obra_id = a.id and s.ambiente = 'producao'
    left join public.cmp_pedidos p on p.solicitacao_id = s.id and p.ambiente = 'producao'
    left join public.cmp_mapa_fornecedores f on f.id = p.mapa_fornecedor_id
   order by s.numero, p.sequencia;
$$;
revoke execute on function public.obras_fin_compras(uuid) from public, anon;
grant execute on function public.obras_fin_compras(uuid) to authenticated, service_role;

-- 3b. Fornecedores: uma linha por (contrato, medição); contrato sem medição
--     sai uma vez com as colunas da medição nulas. Todos os status de
--     contrato e de medição vêm (a tela/consolidação decide o que conta).
--     REAIS (numeric, como no Fornecedores): valor_mo_reais, valor_mat_reais,
--     aditivos_mo_reais, aditivos_mat_reais (soma dos aditivos de valor
--     APROVADOS, 0 sem aditivo), medicao_valor_reais, medicao_valor_pago_reais.
create or replace function public.obras_fin_fornecedores(p_obra uuid)
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
  medicao_valor_pago_reais numeric
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
         c.inicio, c.fim, c.valor_mo, c.valor_mat,
         coalesce(ad.mo, 0), coalesce(ad.mat, 0),
         m.id, m.numero, m.item, m.descricao, m.competencia, m.valor, m.status,
         m.solicitado_em, m.aprovado_em, m.vencimento, m.nf_numero, m.pago_em, m.valor_pago
    from alvo a
    join public.frn_contratos c on c.obra_id = a.id
    join public.frn_fornecedores fo on fo.id = c.fornecedor_id
    left join lateral (
      select sum(x.valor) filter (where x.item = 'mo') as mo,
             sum(x.valor) filter (where x.item = 'mat') as mat
        from public.frn_aditivos x
       where x.contrato_id = c.id and x.tipo = 'valor' and x.status = 'aprovado'
    ) ad on true
    left join public.frn_medicoes m on m.contrato_id = c.id
   order by c.numero, m.seq;
$$;
revoke execute on function public.obras_fin_fornecedores(uuid) from public, anon;
grant execute on function public.obras_fin_fornecedores(uuid) to authenticated, service_role;

-- 3c. Notas ao cliente: uma linha por (nota, obra) — a PARCELA da obra.
--     A mesma nota rateada entre mãe e filha sai em duas linhas, uma por
--     obra: some parcela_centavos, NUNCA nota_valor_total_centavos.
--     Centavos: parcela_centavos (pode ser NULL na origem),
--     nota_valor_total_centavos, nota_valor_servico_centavos.
--     obras_devolvidas_em: não nulo = a nota devolveu as obras (a receita não conta).
create or replace function public.obras_fin_notas(p_obra uuid)
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
  obras_devolvidas_em timestamptz
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
         n.tomador_nome, n.pedido, n.criado_em, n.autorizada_em, n.enviada_em, n.obras_devolvidas_em
    from alvo a
    join public.fin_fat_nota_obras nob on nob.obra_id = a.id
    join public.fin_fat_notas n on n.id = nob.nota_id and n.ambiente = 'producao'
   order by n.criado_em, n.id, a.os;
$$;
revoke execute on function public.obras_fin_notas(uuid) from public, anon;
grant execute on function public.obras_fin_notas(uuid) to authenticated, service_role;

-- ============================================================
-- 4. Restrição <-> pedido do Compras
-- ============================================================
alter table public.obras_restricao add column if not exists cmp_pedido_id uuid;

-- Roda depois de obras_restricao_guarda (ordem alfabética), que já fixa
-- obra_id no UPDATE. Definer: lê cmp_* acima da RLS do Compras.
create or replace function public.obras_restricao_pedido_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_checar boolean;
begin
  if new.cmp_pedido_id is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    v_checar := true;
  else
    v_checar := new.cmp_pedido_id is distinct from old.cmp_pedido_id
                or new.obra_id is distinct from old.obra_id;
  end if;
  if v_checar and not exists (
       select 1
         from public.cmp_pedidos p
         join public.cmp_solicitacoes s on s.id = p.solicitacao_id
        where p.id = new.cmp_pedido_id
          and p.ambiente = 'producao'
          and s.ambiente = 'producao'
          and s.obra_id = new.obra_id) then
    raise exception 'OBRAS_RESTRICAO_PEDIDO: o pedido não existe ou não é desta obra'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_restricao_pedido_guarda() from public, anon, authenticated;

drop trigger if exists obras_restricao_pedido_guarda on public.obras_restricao;
create trigger obras_restricao_pedido_guarda
  before insert or update of cmp_pedido_id, obra_id on public.obras_restricao
  for each row execute function public.obras_restricao_pedido_guarda();

-- Pedidos da obra para vincular — SEM NENHUM VALOR (nem total, nem estimado,
-- nem frete). Só p_obra (o vínculo exige a mesma obra). Gate: obras_has_access() ou
-- service_role (o portal do cliente lê com o cliente admin, sem e-mail; auth.role() vem
-- do claim assinado). Só esta função: as obras_fin_* continuam vazias sem e-mail.
create or replace function public.obras_restricao_pedidos(p_obra uuid)
returns table (
  pedido_id uuid,
  solicitacao_id uuid,
  solicitacao_numero bigint,
  solicitacao_tipo text,
  solicitacao_etapa text,
  solicitacao_motivo text,
  pedido_sequencia smallint,
  fornecedor_razao_social text,
  pedido_situacao text,
  omie_numero text,
  pedido_criado_em timestamptz,
  previsao_entrega date,
  entrega_situacao text,
  entrega_em timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select p.id, s.id, s.numero, s.tipo, s.etapa, s.motivo, p.sequencia, f.razao_social,
         p.situacao, p.omie_numero, p.criado_em, p.previsao_entrega, p.entrega_situacao, p.entrega_em
    from public.cmp_solicitacoes s
    join public.cmp_pedidos p on p.solicitacao_id = s.id and p.ambiente = 'producao'
    left join public.cmp_mapa_fornecedores f on f.id = p.mapa_fornecedor_id
   where (public.obras_has_access() is true or coalesce(auth.role(), '') = 'service_role')
     and p_obra is not null
     and s.obra_id = p_obra
     and s.ambiente = 'producao'
   order by s.numero, p.sequencia;
$$;
revoke execute on function public.obras_restricao_pedidos(uuid) from public, anon;
grant execute on function public.obras_restricao_pedidos(uuid) to authenticated, service_role;

commit;

-- ============================================================
-- VERIFICAÇÃO (PASSO 2) — rodar depois do commit. Qualquer *** FALHOU *** = parar.
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado is not distinct from esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'obras_obra.obra_pai_id uuid nullable', 'uuid|YES',
      (select data_type || '|' || is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'obra_pai_id')),
  (2, 'FK obra_pai_id -> obras_obra ON DELETE RESTRICT (uma) + check pai <> ela', '1|r|1',
      (select (select count(*) from pg_constraint c
                 where c.conrelid = 'public.obras_obra'::regclass and c.contype = 'f'
                   and c.confrelid = 'public.obras_obra'::regclass
                   and c.conkey = array[(select attnum from pg_attribute
                                          where attrelid = 'public.obras_obra'::regclass and attname = 'obra_pai_id')])::text
              || '|' || (select string_agg(c.confdeltype::text, ',') from pg_constraint c
                 where c.conrelid = 'public.obras_obra'::regclass and c.contype = 'f'
                   and c.confrelid = 'public.obras_obra'::regclass)
              || '|' || (select count(*) from pg_constraint
                 where conrelid = 'public.obras_obra'::regclass and conname = 'obras_obra_pai_nao_e_ela')::text)),
  (3, 'trigger obras_obra_parametros_guarda ligado e inclui obra_pai_id', 'true',
      (select (count(*) = 1 and bool_and(pg_get_triggerdef(oid) like '%obra_pai_id%'))::text from pg_trigger
        where tgname = 'obras_obra_parametros_guarda' and tgrelid = 'public.obras_obra'::regclass
          and not tgisinternal and tgenabled = 'O')),
  (4, 'guarda de parâmetros: obra_pai_id só admin, um nível, modalidade obra, trava a mãe', 'true',
      (select (prosrc like '%new.obra_pai_id is distinct from old.obra_pai_id%'
               and prosrc like '%obras_is_admin() is not true%'
               and prosrc like '%um nível só%'
               and prosrc like '%for update%'
               and prosrc like '%não pode deixar de ser OBRA%'
               and prosrc not like '%and not public.obras_is_admin()%')::text
         from pg_proc where oid = 'public.obras_obra_parametros_guarda()'::regprocedure)),
  (5, 'obras_restricao.cmp_pedido_id uuid nullable, SEM FK', 'uuid|YES|0',
      (select (select data_type || '|' || is_nullable from information_schema.columns
                 where table_schema = 'public' and table_name = 'obras_restricao' and column_name = 'cmp_pedido_id')
              || '|' || (select count(*) from pg_constraint
                 where conrelid = 'public.obras_restricao'::regclass and contype = 'f'
                   and confrelid <> 'public.obras_obra'::regclass)::text)),
  (6, 'trigger obras_restricao_pedido_guarda ligado (before insert/update)', '1',
      (select count(*)::text from pg_trigger
        where tgname = 'obras_restricao_pedido_guarda' and tgrelid = 'public.obras_restricao'::regclass
          and not tgisinternal and tgenabled = 'O'
          and (tgtype & 2) = 2 and (tgtype & 4) = 4 and (tgtype & 16) = 16)),
  (7, '5 funções novas: security definer, stable, search_path = pg_catalog, public', '5|5|5',
      (select count(*) filter (where p.prosecdef)::text || '|'
              || count(*) filter (where p.provolatile = 's')::text || '|'
              || count(*) filter (where p.proconfig @> array['search_path=pg_catalog, public'])::text
         from pg_proc p
        where p.oid in (to_regprocedure('public.obras_pode_ver_valores(uuid)'),
                        to_regprocedure('public.obras_fin_compras(uuid)'),
                        to_regprocedure('public.obras_fin_fornecedores(uuid)'),
                        to_regprocedure('public.obras_fin_notas(uuid)'),
                        to_regprocedure('public.obras_restricao_pedidos(uuid)')))),
  (8, 'as 5: authenticated executa; anon e public não', '5|0|0',
      (select count(*) filter (where has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text || '|'
              || count(*) filter (where has_function_privilege('anon', p.oid, 'EXECUTE'))::text || '|'
              || count(*) filter (where exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                                               where a.grantee = 0 and a.privilege_type = 'EXECUTE'))::text
         from pg_proc p
        where p.oid in (to_regprocedure('public.obras_pode_ver_valores(uuid)'),
                        to_regprocedure('public.obras_fin_compras(uuid)'),
                        to_regprocedure('public.obras_fin_fornecedores(uuid)'),
                        to_regprocedure('public.obras_fin_notas(uuid)'),
                        to_regprocedure('public.obras_restricao_pedidos(uuid)')))),
  (9, 'funções de trigger: authenticated e anon NÃO executam; pedido_guarda é definer', 'false|true',
      (select (has_function_privilege('authenticated', 'public.obras_obra_parametros_guarda()', 'EXECUTE')
            or has_function_privilege('anon', 'public.obras_obra_parametros_guarda()', 'EXECUTE')
            or has_function_privilege('authenticated', 'public.obras_restricao_pedido_guarda()', 'EXECUTE')
            or has_function_privilege('anon', 'public.obras_restricao_pedido_guarda()', 'EXECUTE'))::text
              || '|' || (select prosecdef::text from pg_proc where oid = 'public.obras_restricao_pedido_guarda()'::regprocedure))),
  (10, 'obras_restricao_pedidos: nenhuma coluna de valor/centavos/total/frete', '0',
      (select count(*)::text
         from pg_proc p, unnest(p.proargnames) as a(nome)
        where p.oid = 'public.obras_restricao_pedidos(uuid)'::regprocedure
          and (a.nome like '%valor%' or a.nome like '%centavos%' or a.nome like '%total%'
               or a.nome like '%frete%' or a.nome like '%reais%'))),
  (11, 'leituras de valor checam obras_pode_ver_valores e filtram obra + filhas', '3',
      (select count(*)::text from pg_proc
        where oid in (to_regprocedure('public.obras_fin_compras(uuid)'),
                      to_regprocedure('public.obras_fin_fornecedores(uuid)'),
                      to_regprocedure('public.obras_fin_notas(uuid)'))
          and prosrc like '%obras_pode_ver_valores(p_obra) is true%'
          and prosrc like '%o.id = p_obra or o.obra_pai_id = p_obra%')),
  (12, 'obras_pode_ver_valores: coalesce(..., false), obras_has_access, papéis financeiro/diretor ativos', 'true',
      (select (prosrc like '%coalesce((%' and prosrc like '%), false)%'
               and prosrc like '%obras_has_access() is true%'
               and prosrc like '%''financeiro'', ''diretor''%'
               and prosrc like '%f.ativo is true%')::text
         from pg_proc where oid = 'public.obras_pode_ver_valores(uuid)'::regprocedure)),
  (13, 'sem JWT (aqui, como postgres) obras_pode_ver_valores = false e as leituras vêm vazias', 'false|0',
      (select public.obras_pode_ver_valores((select id from public.obras_obra order by created_at limit 1))::text
              || '|' || ((select count(*) from public.obras_fin_compras((select id from public.obras_obra order by created_at limit 1)))
                       + (select count(*) from public.obras_fin_fornecedores((select id from public.obras_obra order by created_at limit 1)))
                       + (select count(*) from public.obras_fin_notas((select id from public.obras_obra order by created_at limit 1))))::text)),
  (14, 'nenhuma FK/trigger nova em cmp_*/fin_*/frn_* apontando para obras_*', '0',
      (select count(*)::text from pg_constraint c join pg_class t on t.oid = c.conrelid
        where c.contype = 'f' and t.relnamespace = 'public'::regnamespace
          and (t.relname like 'cmp\_%' or t.relname like 'fin\_%' or t.relname like 'frn\_%')
          and c.confrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace and relname like 'obras\_%'))),
  (15, 'leituras sem documento/CNPJ; notas devolvem obras_devolvidas_em', '0|1',
      (select (select count(*) from pg_proc p, unnest(p.proargnames) as a(nome)
                where p.oid in (to_regprocedure('public.obras_fin_compras(uuid)'),
                                to_regprocedure('public.obras_fin_fornecedores(uuid)'),
                                to_regprocedure('public.obras_fin_notas(uuid)'),
                                to_regprocedure('public.obras_restricao_pedidos(uuid)'))
                  and (a.nome like '%documento%' or a.nome like '%cnpj%' or a.nome like '%cpf%'))::text
              || '|' || (select count(*) from pg_proc p, unnest(p.proargnames) as a(nome)
                where p.oid = to_regprocedure('public.obras_fin_notas(uuid)') and a.nome = 'obras_devolvidas_em')::text)),
  (16, 'trigger obras_restricao_pedido_guarda só em update of cmp_pedido_id, obra_id', 'true',
      (select (pg_get_triggerdef(oid) like '%UPDATE OF cmp_pedido_id, obra_id%')::text from pg_trigger
        where tgname = 'obras_restricao_pedido_guarda' and tgrelid = 'public.obras_restricao'::regclass))
) as t(n, verificacao, esperado, encontrado)
order by n;
