-- ============================================================
-- Controle de Obras — coluna "cliente" na obra — 2026-09-29
-- ============================================================
-- ESTADO: NÃO APLICADO. Escrito em 29/09/2026 para o coordenador aplicar.
-- Spec: docs/cliente/2026-08-31-sistema-controle-de-obras/spec-cliente-da-obra-2026-09-29.md
--
-- O QUE FAZ: acrescenta `obras_obra.cliente text` (nullable, sem default).
-- Quem preenche é a sincronização com o Field (nome de GET /customers/:id,
-- ex.: "DPSP", "D1000"): na obra nova, e na obra existente quando a coluna
-- está vazia. NULL = "a sync ainda não preencheu".
--
-- ORDEM OBRIGATÓRIA: esta migration ANTES do deploy do código. O código novo
-- lê e grava `cliente`; sem a coluna, a sync quebra. Com a coluna e o código
-- antigo, nada quebra (a coluna só fica vazia).
--
-- SEM ÍNDICE, de propósito: a Base inteira tem ~200 linhas e o filtro é feito
-- no navegador (app/obras/base/_visao.tsx). Índice aqui só custaria escrita.
--
-- RLS: nada muda. obras_obra tem uma única policy de LINHA, "obras access"
-- (for all to authenticated, using/with check obras_has_access()), criada em
-- sdd-sql-obras-v0.sql §6. Não há GRANT por coluna em obras_obra, então a
-- coluna nova herda exatamente o mesmo acesso das outras. As verificações
-- 4, 5 e 6 abaixo confirmam isso no banco.
--
-- Rollback: alter table public.obras_obra drop column if exists cliente;
-- (antes, reverter o deploy do código que grava a coluna).
--
-- IDEMPOTENTE: add column if not exists. Reaplicar é seguro.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Pré-requisito. Aborta a transação inteira, sem alterar nada.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.obras_obra') is null then
    raise exception 'Pré-requisito ausente: public.obras_obra. Rode sdd-sql-obras-v0.sql antes deste arquivo.';
  end if;

  -- Se a coluna já existir com outro tipo, parar: o código grava texto.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'obras_obra'
      and column_name = 'cliente' and data_type <> 'text'
  ) then
    raise exception 'obras_obra.cliente já existe com tipo diferente de text. Investigar antes de seguir.';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 1. A coluna.
-- ------------------------------------------------------------
alter table public.obras_obra
  add column if not exists cliente text;

comment on column public.obras_obra.cliente is
  'Nome do cliente dono da OS no Field Control (GET /customers/:id). Preenchido pela sincronização; NULL = ainda não preenchido.';

commit;


-- ============================================================
-- PARTE 2 — VERIFICAÇÃO. Rodar DEPOIS do commit, sozinha.
-- Uma linha por invariante. Qualquer *** FALHOU *** = parar e não deployar.
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'coluna obras_obra.cliente existe', '1',
      (select count(*)::text from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'cliente')),
  (2, 'cliente é text', 'text',
      (select data_type::text from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'cliente')),
  (3, 'cliente é nullable e sem default', 'YES|',
      (select is_nullable || '|' || coalesce(column_default, '') from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'cliente')),
  (4, 'RLS de obras_obra continua ligada', 'true',
      (select relrowsecurity::text from pg_class where oid = 'public.obras_obra'::regclass)),
  (5, 'obras_obra continua com UMA policy, "obras access"', '1|obras access',
      (select count(*)::text || '|' || coalesce(string_agg(policyname::text, ','), '') from pg_policies
       where schemaname = 'public' and tablename = 'obras_obra')),
  (6, 'nenhum GRANT só de coluna em obras_obra para anon/authenticated', '0',
      (select count(*)::text from information_schema.column_privileges cp
       where cp.table_schema = 'public' and cp.table_name = 'obras_obra'
         and cp.grantee in ('anon', 'authenticated')
         and not exists (
           select 1 from information_schema.table_privileges tp
           where tp.table_schema = cp.table_schema and tp.table_name = cp.table_name
             and tp.grantee = cp.grantee and tp.privilege_type = cp.privilege_type
         )))
) as t(n, verificacao, esperado, encontrado)
order by n;
