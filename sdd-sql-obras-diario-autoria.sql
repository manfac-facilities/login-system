-- ============================================================
-- Gestão de Obras — autoria da resposta do diário — 2026-10-27
-- ============================================================
-- ESTADO: NÃO APLICADO. Escrito em 27/10/2026 para o coordenador aplicar.
-- Spec: docs/superpowers/specs/2026-10-27-obras-diario-para-todos-design.md (§1, decisão D2)
--
-- O QUE FAZ: acrescenta duas colunas em `obras_diario`, ambas nullable e sem
-- default:
--   registrado_por_email text         — e-mail de quem salvou a resposta
--   atualizado_em        timestamptz  — quando a resposta foi salva pela última vez
-- `salvarDiarioAction` grava as duas a cada upsert: corrigir a resposta
-- sobrescreve, vale quem salvou por último. Respostas antigas ficam NULL e a
-- tela não mostra rótulo nelas.
--
-- ORDEM OBRIGATÓRIA: esta migration ANTES do deploy do código. O código novo
-- grava as colunas no upsert; sem elas, salvar o diário falha. Com as colunas
-- e o código antigo, nada quebra (elas só ficam vazias).
--
-- SEM ÍNDICE, SEM GRANT NOVO. RLS: nada muda. obras_diario tem uma única
-- policy de LINHA, "obras access" (sdd-sql-obras-v0.sql §6), e as colunas
-- novas herdam o mesmo acesso. As verificações 5 a 7 confirmam no banco.
--
-- ROLLBACK (só DEPOIS de reverter o deploy do código que grava as colunas):
--   alter table public.obras_diario drop column if exists registrado_por_email;
--   alter table public.obras_diario drop column if exists atualizado_em;
--
-- IDEMPOTENTE: add column if not exists. Reaplicar é seguro.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Pré-requisito. Aborta a transação inteira, sem alterar nada.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.obras_diario') is null then
    raise exception 'Pré-requisito ausente: public.obras_diario. Rode sdd-sql-obras-v0.sql antes deste arquivo.';
  end if;

  -- Se alguma coluna já existir com outro tipo, parar: o código grava texto e timestamptz.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'obras_diario'
      and (
        (column_name = 'registrado_por_email' and data_type <> 'text')
        or (column_name = 'atualizado_em' and data_type <> 'timestamp with time zone')
      )
  ) then
    raise exception 'obras_diario.registrado_por_email/atualizado_em já existe com outro tipo. Investigar antes de seguir.';
  end if;
end
$$;

-- ------------------------------------------------------------
-- 1. As colunas.
-- ------------------------------------------------------------
alter table public.obras_diario
  add column if not exists registrado_por_email text;

alter table public.obras_diario
  add column if not exists atualizado_em timestamptz;

comment on column public.obras_diario.registrado_por_email is
  'E-mail de quem salvou a resposta por último (salvarDiarioAction). NULL = resposta anterior a 27/10/2026.';

comment on column public.obras_diario.atualizado_em is
  'Quando a resposta foi salva pela última vez (salvarDiarioAction). NULL = resposta anterior a 27/10/2026.';

commit;


-- ============================================================
-- PARTE 2 — VERIFICAÇÃO. Rodar DEPOIS do commit, sozinha.
-- Uma linha por invariante. Qualquer *** FALHOU *** = parar e não deployar.
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'registrado_por_email existe e é text', 'text',
      (select data_type::text from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_diario' and column_name = 'registrado_por_email')),
  (2, 'registrado_por_email é nullable e sem default', 'YES|',
      (select is_nullable || '|' || coalesce(column_default, '') from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_diario' and column_name = 'registrado_por_email')),
  (3, 'atualizado_em existe e é timestamptz', 'timestamp with time zone',
      (select data_type::text from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_diario' and column_name = 'atualizado_em')),
  (4, 'atualizado_em é nullable e sem default', 'YES|',
      (select is_nullable || '|' || coalesce(column_default, '') from information_schema.columns
       where table_schema = 'public' and table_name = 'obras_diario' and column_name = 'atualizado_em')),
  (5, 'RLS de obras_diario continua ligada', 'true',
      (select relrowsecurity::text from pg_class where oid = 'public.obras_diario'::regclass)),
  (6, 'obras_diario continua com UMA policy, "obras access"', '1|obras access',
      (select count(*)::text || '|' || coalesce(string_agg(policyname::text, ','), '') from pg_policies
       where schemaname = 'public' and tablename = 'obras_diario')),
  (7, 'nenhum GRANT só de coluna em obras_diario para anon/authenticated', '0',
      (select count(*)::text from information_schema.column_privileges cp
       where cp.table_schema = 'public' and cp.table_name = 'obras_diario'
         and cp.grantee in ('anon', 'authenticated')
         and not exists (
           select 1 from information_schema.table_privileges tp
           where tp.table_schema = cp.table_schema and tp.table_name = cp.table_name
             and tp.grantee = cp.grantee and tp.privilege_type = cp.privilege_type
         )))
) as t(n, verificacao, esperado, encontrado)
order by n;
