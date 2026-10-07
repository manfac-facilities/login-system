-- ============================================================
-- Performance de RLS — embrulhar chamadas em (select ...) — Pacote 2 — 2026-10-06
-- Achado 2 de docs/performance/2026-10-06-revisao-banco.md
-- ============================================================
-- ESTADO: NÃO APLICADO. Escrito em 06/10/2026 para o coordenador aplicar.
-- Projeto de produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar.
--
-- O QUE FAZ: troca, em 32 policies (11 de obras_*, 3 de storage.objects/obras-fotos,
-- 18 "sofia access"), a chamada nua obras_has_access() /
-- obras_is_admin() / sofia_has_access() por (select f()), e auth.jwt() por
-- (select auth.jwt()). Com o (select ...) o Postgres avalia a função UMA vez
-- por consulta (InitPlan) em vez de uma vez por linha. As funções são STABLE,
-- SECURITY DEFINER e SEM argumento, então o resultado lógico é idêntico.
--
-- NÃO MUDA: nome, comando (cmd), roles, permissive/restrictive, nem nenhuma
-- parte da expressão além do embrulho. Por isso ALTER POLICY (não drop/create):
-- não existe janela sem policy, e o que não é citado fica como está.
-- Comparações com coluna da linha (quem = ..., criado_por, bucket_id)
-- ficam FORA do (select ...), de propósito.
--
-- NÃO TOCADO (já embrulhado ou fora do escopo): policies de CRM, Compras e
-- Financeiro (já usam select); hub_system_access / hub_user_roles (using true,
-- sem função); policies do Cockpit/dashboard (dashboard_manutencao_has_access()
-- nu em clients, locations, work_orders, technicians etc. — app separada);
-- hub_comunicados* e user_client_access (auth.uid() nu, baixo volume) — ver
-- docs/performance/2026-10-06-pacote2-roteiro.md.
--
-- RISCO DE OWNERSHIP: storage.objects pertence a supabase_storage_admin e o
-- postgres NÃO é membro dele (medido em 06/10/2026). A obras-v0 seção 7 criou
-- policies ali sem erro, mas se o ALTER POLICY da seção 2 falhar, o envelope
-- begin/commit desfaz TUDO e o banco fica intocado.
--
-- IDEMPOTENTE: o texto de cada ALTER POLICY é fixo (não é calculado a partir
-- do estado atual), então reaplicar só reescreve o mesmo texto. A seção 0
-- exige exatamente o número de policies lido em 06/10/2026.
--
-- Aplicar: PARTE 1 (begin..commit) e depois PARTE 2 (verificação), em runs
-- separados.
-- ============================================================

begin;

-- SEÇÃO 0 — pré-requisito: as funções existem e continuam STABLE, sem
-- argumento. Se alguém tiver mudado isso, o embrulho deixa de ser neutro.
do $$
begin
  if (select count(*) from pg_proc
       where pronamespace = 'public'::regnamespace
         and proname in ('obras_has_access', 'obras_is_admin', 'sofia_has_access')
         and provolatile = 's' and pronargs = 0) <> 3 then
    raise exception 'obras_has_access/obras_is_admin/sofia_has_access ausentes ou nao-STABLE: nao aplicar';
  end if;
  if (select count(*) from pg_policies
       where (schemaname = 'public' and tablename like 'obras\_%') or (schemaname = 'public' and policyname = 'sofia access')
          or (schemaname = 'storage' and policyname like 'obras fotos%')) <> 32 then
    raise exception 'numero de policies diferente de 32: o banco mudou desde a leitura de 06/10/2026, reler pg_policies';
  end if;
end $$;


-- ============================================================
-- 1. obras_* (11)
-- ============================================================

-- public.obras_diario / "obras access" (ALL)
alter policy "obras access" on public.obras_diario
  using ((select obras_has_access()))
  with check ((select obras_has_access()));

-- public.obras_historico / "obras historico escrita" (INSERT)
alter policy "obras historico escrita" on public.obras_historico
  with check (((select obras_has_access()) AND (quem = lower(TRIM(BOTH FROM ((select auth.jwt()) ->> 'email'::text))))));

-- public.obras_historico / "obras historico leitura" (SELECT)
alter policy "obras historico leitura" on public.obras_historico
  using ((select obras_has_access()));

-- public.obras_motivo_remarcacao / "obras motivo cadastro" (INSERT)
alter policy "obras motivo cadastro" on public.obras_motivo_remarcacao
  with check (((select obras_has_access()) AND (criado_por IS NOT NULL) AND (lower(btrim(criado_por)) = lower(btrim(((select auth.jwt()) ->> 'email'::text))))));

-- public.obras_motivo_remarcacao / "obras motivo leitura" (SELECT)
alter policy "obras motivo leitura" on public.obras_motivo_remarcacao
  using ((select obras_has_access()));

-- public.obras_obra / "obras access" (ALL)
alter policy "obras access" on public.obras_obra
  using ((select obras_has_access()))
  with check ((select obras_has_access()));

-- public.obras_pessoa / "obras access" (ALL)
alter policy "obras access" on public.obras_pessoa
  using ((select obras_has_access()))
  with check ((select obras_has_access()));

-- public.obras_remarcacao / "obras remarcacao insercao" (INSERT)
alter policy "obras remarcacao insercao" on public.obras_remarcacao
  with check (((select obras_has_access()) AND (registrado_por IS NOT NULL) AND (lower(btrim(registrado_por)) = lower(btrim(((select auth.jwt()) ->> 'email'::text))))));

-- public.obras_remarcacao / "obras remarcacao leitura" (SELECT)
alter policy "obras remarcacao leitura" on public.obras_remarcacao
  using ((select obras_has_access()));

-- public.obras_sync_execucao / "obras sync admin" (ALL)
alter policy "obras sync admin" on public.obras_sync_execucao
  using ((select obras_is_admin()))
  with check ((select obras_is_admin()));

-- public.obras_tarefa / "obras access" (ALL)
alter policy "obras access" on public.obras_tarefa
  using ((select obras_has_access()))
  with check ((select obras_has_access()));

-- ============================================================
-- 2. storage.objects, bucket obras-fotos (3)
-- ============================================================

-- storage.objects / "obras fotos read" (SELECT)
alter policy "obras fotos read" on storage.objects
  using (((bucket_id = 'obras-fotos'::text) AND (select obras_has_access())));

-- storage.objects / "obras fotos update" (UPDATE)
alter policy "obras fotos update" on storage.objects
  using (((bucket_id = 'obras-fotos'::text) AND (select obras_has_access())))
  with check (((bucket_id = 'obras-fotos'::text) AND (select obras_has_access())));

-- storage.objects / "obras fotos upload" (INSERT)
alter policy "obras fotos upload" on storage.objects
  with check (((bucket_id = 'obras-fotos'::text) AND (select obras_has_access())));

-- ============================================================
-- 3. Sofia "sofia access" (18)
-- ============================================================

-- public.abastecimentos / "sofia access" (ALL)
alter policy "sofia access" on public.abastecimentos
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.audit_log / "sofia access" (ALL)
alter policy "sofia access" on public.audit_log
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.centro_custo_historico / "sofia access" (ALL)
alter policy "sofia access" on public.centro_custo_historico
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.checklist / "sofia access" (ALL)
alter policy "sofia access" on public.checklist
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.checklist_fotos / "sofia access" (ALL)
alter policy "sofia access" on public.checklist_fotos
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.documentos_veiculo / "sofia access" (ALL)
alter policy "sofia access" on public.documentos_veiculo
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.equipes / "sofia access" (ALL)
alter policy "sofia access" on public.equipes
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.km_diario / "sofia access" (ALL)
alter policy "sofia access" on public.km_diario
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.km_excedido_desconto / "sofia access" (ALL)
alter policy "sofia access" on public.km_excedido_desconto
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.motorista_documentos / "sofia access" (ALL)
alter policy "sofia access" on public.motorista_documentos
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.motoristas / "sofia access" (ALL)
alter policy "sofia access" on public.motoristas
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.multas / "sofia access" (ALL)
alter policy "sofia access" on public.multas
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.pendencias / "sofia access" (ALL)
alter policy "sofia access" on public.pendencias
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.revisoes / "sofia access" (ALL)
alter policy "sofia access" on public.revisoes
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.sinistro_fotos / "sofia access" (ALL)
alter policy "sofia access" on public.sinistro_fotos
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.sinistros / "sofia access" (ALL)
alter policy "sofia access" on public.sinistros
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.veiculo_responsabilidade_historico / "sofia access" (ALL)
alter policy "sofia access" on public.veiculo_responsabilidade_historico
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

-- public.veiculos / "sofia access" (ALL)
alter policy "sofia access" on public.veiculos
  using ((select sofia_has_access()))
  with check ((select sofia_has_access()));

commit;

-- ============================================================
-- PARTE 2 — VERIFICAÇÃO. Rodar DEPOIS do commit, sozinha (só leitura).
-- Uma linha por invariante: OK ou *** FALHOU ***. Qualquer FALHOU = parar e
-- rodar o ROLLBACK (sdd-sql-perf-rls-initplan-ROLLBACK.sql).
-- ============================================================
with esperado(sch, tab, pol, cmd, perm, roles) as (
  values
    ('public', 'abastecimentos', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'audit_log', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'centro_custo_historico', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'checklist', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'checklist_fotos', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'documentos_veiculo', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'equipes', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'km_diario', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'km_excedido_desconto', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'motorista_documentos', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'motoristas', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'multas', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_diario', 'obras access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_historico', 'obras historico escrita', 'INSERT', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_historico', 'obras historico leitura', 'SELECT', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_motivo_remarcacao', 'obras motivo cadastro', 'INSERT', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_motivo_remarcacao', 'obras motivo leitura', 'SELECT', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_obra', 'obras access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_pessoa', 'obras access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_remarcacao', 'obras remarcacao insercao', 'INSERT', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_remarcacao', 'obras remarcacao leitura', 'SELECT', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_sync_execucao', 'obras sync admin', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'obras_tarefa', 'obras access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'pendencias', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'revisoes', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'sinistro_fotos', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'sinistros', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'veiculo_responsabilidade_historico', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('public', 'veiculos', 'sofia access', 'ALL', 'PERMISSIVE', '{authenticated}'),
    ('storage', 'objects', 'obras fotos read', 'SELECT', 'PERMISSIVE', '{authenticated}'),
    ('storage', 'objects', 'obras fotos update', 'UPDATE', 'PERMISSIVE', '{authenticated}'),
    ('storage', 'objects', 'obras fotos upload', 'INSERT', 'PERMISSIVE', '{authenticated}')
), atual as (
  select p.schemaname sch, p.tablename tab, p.policyname pol, p.cmd, p.permissive perm, p.roles::text roles,
         p.qual, p.with_check
    from pg_policies p
), j as (
  select e.*, a.qual, a.with_check, (a.pol is not null) existe
    from esperado e
    left join atual a on (a.sch, a.tab, a.pol, a.cmd, a.perm, a.roles) = (e.sch, e.tab, e.pol, e.cmd, e.perm, e.roles)
)
select n as "#", verificacao, esperado, encontrado,
       case when esperado = encontrado then 'OK' else '*** FALHOU ***' end as resultado
from (
  select 1 as n, 'policies cobertas existem com o mesmo nome/cmd/permissive/roles' as verificacao,
         '32' as esperado, count(*) filter (where existe)::text as encontrado from j
  union all
  select 2, 'nenhuma chamada nua restante (função de acesso ou auth.jwt() fora de select)',
         '0', count(*)::text
    from j where existe and (coalesce(qual,'') ~ '(?<!SELECT )(obras_has_access|obras_is_admin|sofia_has_access)\(\)'
                          or coalesce(with_check,'') ~ '(?<!SELECT )(obras_has_access|obras_is_admin|sofia_has_access)\(\)'
                          or coalesce(qual,'') ~ '(?<!SELECT )auth\.jwt\(\)'
                          or coalesce(with_check,'') ~ '(?<!SELECT )auth\.jwt\(\)')
  union all
  select 3, 'toda policy coberta agora tem (SELECT função()) no texto',
         '32', count(*)::text
    from j where existe and (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ~ 'SELECT (obras_has_access|obras_is_admin|sofia_has_access)\(\)'
  union all
  select 4, 'obras_obra "obras access" continua ALL, authenticated, PERMISSIVE', '1',
         count(*)::text from pg_policies
    where tablename = 'obras_obra' and policyname = 'obras access' and cmd = 'ALL' and roles = '{authenticated}' and permissive = 'PERMISSIVE'
  union all
  select 5, 'total de policies em public.obras_* + sofia access + obras fotos inalterado', '32',
         count(*)::text from pg_policies
    where (schemaname = 'public' and tablename like 'obras\_%') or (schemaname = 'public' and policyname = 'sofia access')
       or (schemaname = 'storage' and policyname like 'obras fotos%')
) t
order by n;
