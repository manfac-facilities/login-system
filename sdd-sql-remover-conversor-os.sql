-- sdd-sql-remover-conversor-os.sql
-- Remove o Conversor de OS do banco. Decisão do cliente na reunião de 14/10/2026
-- (docs/cliente/2026-10-14-reuniao-jose-guilherme-resumo.md, linha 23); opção "apagar tudo"
-- escolhida e autorizada pelo João no mesmo dia.
--
-- ESTADO MEDIDO EM PRODUÇÃO EM 14/10/2026, antes de escrever este arquivo:
--   conversor_os_imports: 1 linha (importação de teste de 01/07/2026)
--   hub_system_access com system_slug='conversor-os': 3 linhas, todas has_access=false
--   bucket conversor-os-arquivos: 1 objeto (7 KB)
--   nenhuma FK nem view depende de conversor_os_imports
--
-- ORDEM DE APLICAÇÃO:
--   1. Deploy do código que tira o Conversor do hub (senão /conversor-os quebra no ar).
--   2. Apagar o objeto e o bucket conversor-os-arquivos pela Storage API (service role).
--      SQL não consegue: storage.objects e storage.buckets têm o trigger protect_delete.
--      A seção 0 aborta se o bucket ainda existir.
--   3. Rodar este arquivo.
--
-- NÃO TOCA em hub_system_access como tabela: ela nasceu em sdd-sql-conversor-os.sql, mas é o
-- controle de acesso do hub inteiro. Só saem as linhas do slug conversor-os.
--
-- IRREVERSÍVEL. Não há rollback: os dados apagados eram 1 teste e 3 acessos desligados.

begin;

-- ============================================================
-- 0. Pré-requisitos — aborta se algo não estiver como medido
-- ============================================================
do $$
begin
  if exists (select 1 from storage.buckets where id = 'conversor-os-arquivos') then
    raise exception 'bucket conversor-os-arquivos ainda existe: apague pela Storage API antes (passo 2)';
  end if;

  if exists (select 1 from pg_constraint
             where confrelid = to_regclass('public.conversor_os_imports')) then
    raise exception 'há FK apontando para conversor_os_imports; pare e investigue';
  end if;

  if exists (select 1 from public.hub_system_access
             where system_slug = 'conversor-os' and has_access is not false) then
    raise exception 'há acesso LIGADO ao conversor-os; o estado mudou desde 14/10, pare e confira';
  end if;
end $$;

-- ============================================================
-- 1. Policy do bucket em storage.objects (bucket já não existe)
-- ============================================================
drop policy if exists "authenticated full access conversor-os-arquivos" on storage.objects;

-- ============================================================
-- 2. Tabela de log de importações (leva junto a policy aberta)
-- ============================================================
drop table if exists public.conversor_os_imports;

-- ============================================================
-- 3. Linhas de acesso do slug
-- ============================================================
delete from public.hub_system_access where system_slug = 'conversor-os';

commit;

-- ============================================================
-- Verificação — toda linha tem que dar OK
-- ============================================================
select 'tabela conversor_os_imports removida' as invariante,
       case when to_regclass('public.conversor_os_imports') is null then 'OK' else '*** FALHOU ***' end as resultado
union all
select 'nenhum acesso conversor-os',
       case when not exists (select 1 from public.hub_system_access where system_slug = 'conversor-os') then 'OK' else '*** FALHOU ***' end
union all
select 'bucket conversor-os-arquivos removido',
       case when not exists (select 1 from storage.buckets where id = 'conversor-os-arquivos') then 'OK' else '*** FALHOU ***' end
union all
select 'nenhuma policy citando conversor',
       case when not exists (select 1 from pg_policies
                             where tablename = 'conversor_os_imports'
                                or qual ilike '%conversor%' or with_check ilike '%conversor%') then 'OK' else '*** FALHOU ***' end
union all
select 'hub_system_access intacta (outros slugs presentes)',
       case when exists (select 1 from public.hub_system_access where system_slug <> 'conversor-os') then 'OK' else '*** FALHOU ***' end;
