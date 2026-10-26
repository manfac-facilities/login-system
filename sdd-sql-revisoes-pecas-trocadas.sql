-- sdd-sql-revisoes-pecas-trocadas.sql
-- Gestão de Frotas (B6): campo de texto livre "peças trocadas" na revisão.
--
-- *** NÃO APLICADO. *** Escrito em 26/10/2026 (branch fix/frotas-rodada2-suporte).
-- Só aplicar DEPOIS de o mockup da tela de detalhe/formulário da revisão ser aprovado pelo João
-- (decisão B6 em docs/frotas/2026-10-26-decisoes-joao.md). Código mergeado != schema aplicado:
-- ao aplicar, atualizar a tabela de migrations em .claude/rules/sql.md no mesmo commit.
--
-- Conferido no repositório: `revisoes` tem apenas a policy "sofia access" (for all,
-- sofia_has_access(), sdd-sql-v04-seguranca.sql:123-125) e NENHUM trigger (os triggers
-- sofia_bloquear_* cobrem multas, sinistros, km_excedido_desconto, equipes, veiculos,
-- centro_custo_historico, abastecimentos e km_diario). Policy é por linha, não por coluna, e não há
-- GRANT por coluna em revisoes: a coluna nova herda o acesso sem nenhuma mudança.
--
-- Idempotente: reaplicar é seguro. Rollback (só depois de reverter o código que lê a coluna):
--   alter table public.revisoes drop column if exists pecas_trocadas;

begin;

-- 0. Pré-requisito: a tabela e a policy de acesso do Sofia existem.
do $$
begin
  if to_regclass('public.revisoes') is null then
    raise exception 'public.revisoes não existe: aplicar sdd-sql-passo1.sql antes';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'revisoes' and policyname = 'sofia access'
  ) then
    raise exception 'policy "sofia access" ausente em revisoes: aplicar sdd-sql-v04-seguranca.sql antes';
  end if;
end $$;

-- 1. Coluna nova, nullable, sem default.
alter table public.revisoes add column if not exists pecas_trocadas text;

commit;

-- Verificação (uma linha por invariante; qualquer *** FALHOU *** = parar)
select 'coluna pecas_trocadas text nullable' as invariante,
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'revisoes'
      and column_name = 'pecas_trocadas' and data_type = 'text' and is_nullable = 'YES'
  ) then 'OK' else '*** FALHOU ***' end as resultado
union all
select 'RLS ligada em revisoes',
  case when (select relrowsecurity from pg_class where oid = 'public.revisoes'::regclass)
    then 'OK' else '*** FALHOU ***' end
union all
select 'policy "sofia access" continua a única em revisoes',
  case when (select count(*) from pg_policies where schemaname = 'public' and tablename = 'revisoes') = 1
        and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'revisoes' and policyname = 'sofia access')
    then 'OK' else '*** FALHOU ***' end
union all
select 'revisoes continua sem trigger de usuário',
  case when not exists (
    select 1 from pg_trigger where tgrelid = 'public.revisoes'::regclass and not tgisinternal
  ) then 'OK' else '*** FALHOU ***' end;
