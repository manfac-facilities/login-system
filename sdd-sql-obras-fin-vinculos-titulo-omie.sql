-- sdd-sql-obras-fin-vinculos-titulo-omie.sql
-- Aba Financeiro da obra: custo lançado DIRETO no contas a pagar do Omie (sem solicitação no hub)
-- e ligado a uma obra/OS pelo Financeiro passa a contar na obra.
--
-- Contexto: o Financeiro (repositório financeiro, 053_fin_obra_titulo_omie.sql, aplicado em
-- 19/11/2026) criou a origem 'titulo_omie' em fin_obra_vinculos, com o retrato do título nas
-- colunas titulo_*. Até aqui obras_fin_vinculos(p_obra) só devolvia vínculo de solicitação e de
-- caixinha: o título ficava gravado e não aparecia na obra.
--
-- O RETORNO NÃO MUDA (mesmas colunas, tipos e ordem): create or replace basta, sem drop, e o
-- TypeScript do Obras não muda. A linha de título vem com a "cara" de uma solicitação lançada:
--   solicitacao_etapa = 'lancada'                    -> custo realizado = valor
--   pagamento_situacao = 'pago' se titulo_pago_em    -> custo pago = valor
--   pagamento_data = titulo_pago_em, pagamento_valor_pago_centavos = valor
--   fornecedor/categoria/descrição/vencimento/CPF-CNPJ = retrato titulo_*
--   solicitacao_id/numero/tipo/enviado_em = NULL (não há solicitação)
-- financeiro-tela.ts já trata origem diferente de 'caixinha_despesa' como 'solicitacao', e o custo
-- entra em "Pagamentos / rateio no Financeiro", inclusive no casamento com pedido do Compras pelo
-- CPF/CNPJ (fornecedor_documento + pagamento_data).
-- Diferenças em relação ao corpo anterior: as linhas marcadas com  -- titulo_omie.
--
-- APLICADO em produção em 19/11/2026, a pedido do José (sem passar pelo João): verificação 5/5 OK e a
-- obra DP PENHA 2 conferida lendo como o José (6 solicitações + 1 título, nada mais mudou).
-- Primeiro uso: título 10305237327 (diferença do PIX à Brasrio, R$ 1.419,09) na OS 1126-010490 · DP PENHA 2.
-- Nada aqui cria ou remove extensão, mexe em auth.users ou dá permissão ampla.

begin;

-- ---------------------------------------------------------------------------
-- 0. Pré-requisito: o 053 do Financeiro aplicado (colunas do retrato do título)
-- ---------------------------------------------------------------------------
do $$
begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'fin_obra_vinculos'
         and column_name in ('codigo_lancamento_omie', 'titulo_fornecedor_razao_social',
                             'titulo_fornecedor_documento', 'titulo_categoria_descricao',
                             'titulo_descricao', 'titulo_vencimento', 'titulo_pago_em')) <> 7 then
    raise exception 'pré-requisito: aplique antes o 053_fin_obra_titulo_omie.sql do Financeiro';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. obras_fin_vinculos com a origem titulo_omie
-- ---------------------------------------------------------------------------
create or replace function public.obras_fin_vinculos(p_obra uuid)
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
              when v.origem = 'titulo_omie' then v.valor_centavos                                   -- titulo_omie
              when rt.obras_centavos is null then v.valor_centavos
              else round(v.valor_centavos::numeric * rt.obras_centavos / s.valor_centavos)::bigint end,
         v.valor_centavos, rt.obras_centavos, v.criado_em, v.criado_por_nome,
         s.id, s.numero, s.tipo,
         case when v.origem = 'titulo_omie' then 'lancada' else s.etapa end,                        -- titulo_omie
         coalesce(s.fornecedor_razao_social, v.titulo_fornecedor_razao_social),                     -- titulo_omie
         coalesce(s.categoria_descricao, v.titulo_categoria_descricao),                             -- titulo_omie
         coalesce(s.descricao, v.titulo_descricao),                                                 -- titulo_omie
         case when v.origem = 'titulo_omie' then v.valor_centavos else s.valor_centavos end,         -- titulo_omie
         coalesce(s.vencimento, v.titulo_vencimento),                                               -- titulo_omie
         s.enviado_em,
         case when v.origem = 'titulo_omie'                                                         -- titulo_omie
              then case when v.titulo_pago_em is not null then 'pago' end                           -- titulo_omie
              else po.situacao end,                                                                 -- titulo_omie
         case when v.origem = 'titulo_omie' then v.titulo_pago_em else po.data_pagamento end,       -- titulo_omie
         case when v.origem = 'titulo_omie'                                                         -- titulo_omie
              then case when v.titulo_pago_em is not null then v.valor_centavos end                 -- titulo_omie
              else po.valor_pago_centavos end,                                                      -- titulo_omie
         coalesce(mi.id, fm.id),
         (ig.solicitacao_id is not null or fm.id is not null),
         v.vex_despesa_id, d.data, d.titulo, d.tipo_nome, d.centro_custo_nome, r.status,
         nullif(upper(regexp_replace(coalesce(s.fornecedor_documento, v.titulo_fornecedor_documento, ''), -- titulo_omie
                                     '[^0-9A-Za-z]', '', 'g')), '')
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
   where v.origem in ('caixinha_despesa', 'titulo_omie') or s.ambiente = 'producao'                 -- titulo_omie
   order by v.origem, coalesce(s.enviado_em, d.data::timestamptz, v.titulo_pago_em::timestamptz,    -- titulo_omie
                               v.criado_em), v.id, a.os;
$$;

-- Grants iguais aos de antes (create or replace mantém; repetidos por garantia).
revoke execute on function public.obras_fin_vinculos(uuid) from public, anon;
grant execute on function public.obras_fin_vinculos(uuid) to authenticated, service_role;

commit;

-- ---------------------------------------------------------------------------
-- Verificação (depois do commit): uma linha por invariante, OK ou *** FALHOU ***
-- ---------------------------------------------------------------------------
select 'retorno com 33 colunas, a última fornecedor_documento' as invariante,
       case when (select pg_get_function_result('public.obras_fin_vinculos(uuid)'::regprocedure))
                 like 'TABLE(obra_id uuid, obra_os text, %, fornecedor_documento text)'
             and (select array_length(proallargtypes, 1) from pg_proc
                   where oid = 'public.obras_fin_vinculos(uuid)'::regprocedure) = 34
            then 'OK' else '*** FALHOU ***' end as resultado
union all
select 'security definer, stable, search_path fixo',
       case when p.prosecdef and p.provolatile = 's'
             and array_to_string(p.proconfig, ',') like 'search_path=%'
            then 'OK' else '*** FALHOU ***' end
  from pg_proc p where p.oid = 'public.obras_fin_vinculos(uuid)'::regprocedure
union all
select 'anon não executa',
       case when not has_function_privilege('anon', 'public.obras_fin_vinculos(uuid)', 'execute')
            then 'OK' else '*** FALHOU ***' end
union all
select 'authenticated executa',
       case when has_function_privilege('authenticated', 'public.obras_fin_vinculos(uuid)', 'execute')
            then 'OK' else '*** FALHOU ***' end
union all
select 'corpo trata titulo_omie',
       case when pg_get_functiondef('public.obras_fin_vinculos(uuid)'::regprocedure) like '%titulo_omie%'
            then 'OK' else '*** FALHOU ***' end;
