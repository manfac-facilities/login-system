-- ============================================================
-- Performance de RLS — embrulhar chamadas em (select ...) — Pacote 2 — 2026-10-06
-- ROLLBACK: restaura o texto ORIGINAL das policies (copiado de pg_policies em 06/10/2026)
-- ============================================================
-- ESTADO: NÃO APLICADO. Escrito em 06/10/2026 para o coordenador aplicar.
-- Projeto de produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar.
--
-- Reaplica o texto original: chamada nua a obras_has_access() / obras_is_admin()
-- / sofia_has_access() / auth.jwt(). Mesmo resultado lógico, só volta a ser
-- avaliada por linha. Seguro rodar a qualquer momento depois da migration.
-- ============================================================

begin;


-- ============================================================
-- 1. obras_* (11)
-- ============================================================

-- public.obras_diario / "obras access" (ALL)
alter policy "obras access" on public.obras_diario
  using (obras_has_access())
  with check (obras_has_access());

-- public.obras_historico / "obras historico escrita" (INSERT)
alter policy "obras historico escrita" on public.obras_historico
  with check ((obras_has_access() AND (quem = lower(TRIM(BOTH FROM (auth.jwt() ->> 'email'::text))))));

-- public.obras_historico / "obras historico leitura" (SELECT)
alter policy "obras historico leitura" on public.obras_historico
  using (obras_has_access());

-- public.obras_motivo_remarcacao / "obras motivo cadastro" (INSERT)
alter policy "obras motivo cadastro" on public.obras_motivo_remarcacao
  with check ((obras_has_access() AND (criado_por IS NOT NULL) AND (lower(btrim(criado_por)) = lower(btrim((auth.jwt() ->> 'email'::text))))));

-- public.obras_motivo_remarcacao / "obras motivo leitura" (SELECT)
alter policy "obras motivo leitura" on public.obras_motivo_remarcacao
  using (obras_has_access());

-- public.obras_obra / "obras access" (ALL)
alter policy "obras access" on public.obras_obra
  using (obras_has_access())
  with check (obras_has_access());

-- public.obras_pessoa / "obras access" (ALL)
alter policy "obras access" on public.obras_pessoa
  using (obras_has_access())
  with check (obras_has_access());

-- public.obras_remarcacao / "obras remarcacao insercao" (INSERT)
alter policy "obras remarcacao insercao" on public.obras_remarcacao
  with check ((obras_has_access() AND (registrado_por IS NOT NULL) AND (lower(btrim(registrado_por)) = lower(btrim((auth.jwt() ->> 'email'::text))))));

-- public.obras_remarcacao / "obras remarcacao leitura" (SELECT)
alter policy "obras remarcacao leitura" on public.obras_remarcacao
  using (obras_has_access());

-- public.obras_sync_execucao / "obras sync admin" (ALL)
alter policy "obras sync admin" on public.obras_sync_execucao
  using (obras_is_admin())
  with check (obras_is_admin());

-- public.obras_tarefa / "obras access" (ALL)
alter policy "obras access" on public.obras_tarefa
  using (obras_has_access())
  with check (obras_has_access());

-- ============================================================
-- 2. storage.objects, bucket obras-fotos (3)
-- ============================================================

-- storage.objects / "obras fotos read" (SELECT)
alter policy "obras fotos read" on storage.objects
  using (((bucket_id = 'obras-fotos'::text) AND obras_has_access()));

-- storage.objects / "obras fotos update" (UPDATE)
alter policy "obras fotos update" on storage.objects
  using (((bucket_id = 'obras-fotos'::text) AND obras_has_access()))
  with check (((bucket_id = 'obras-fotos'::text) AND obras_has_access()));

-- storage.objects / "obras fotos upload" (INSERT)
alter policy "obras fotos upload" on storage.objects
  with check (((bucket_id = 'obras-fotos'::text) AND obras_has_access()));

-- ============================================================
-- 3. Sofia "sofia access" (18)
-- ============================================================

-- public.abastecimentos / "sofia access" (ALL)
alter policy "sofia access" on public.abastecimentos
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.audit_log / "sofia access" (ALL)
alter policy "sofia access" on public.audit_log
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.centro_custo_historico / "sofia access" (ALL)
alter policy "sofia access" on public.centro_custo_historico
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.checklist / "sofia access" (ALL)
alter policy "sofia access" on public.checklist
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.checklist_fotos / "sofia access" (ALL)
alter policy "sofia access" on public.checklist_fotos
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.documentos_veiculo / "sofia access" (ALL)
alter policy "sofia access" on public.documentos_veiculo
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.equipes / "sofia access" (ALL)
alter policy "sofia access" on public.equipes
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.km_diario / "sofia access" (ALL)
alter policy "sofia access" on public.km_diario
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.km_excedido_desconto / "sofia access" (ALL)
alter policy "sofia access" on public.km_excedido_desconto
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.motorista_documentos / "sofia access" (ALL)
alter policy "sofia access" on public.motorista_documentos
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.motoristas / "sofia access" (ALL)
alter policy "sofia access" on public.motoristas
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.multas / "sofia access" (ALL)
alter policy "sofia access" on public.multas
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.pendencias / "sofia access" (ALL)
alter policy "sofia access" on public.pendencias
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.revisoes / "sofia access" (ALL)
alter policy "sofia access" on public.revisoes
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.sinistro_fotos / "sofia access" (ALL)
alter policy "sofia access" on public.sinistro_fotos
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.sinistros / "sofia access" (ALL)
alter policy "sofia access" on public.sinistros
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.veiculo_responsabilidade_historico / "sofia access" (ALL)
alter policy "sofia access" on public.veiculo_responsabilidade_historico
  using (sofia_has_access())
  with check (sofia_has_access());

-- public.veiculos / "sofia access" (ALL)
alter policy "sofia access" on public.veiculos
  using (sofia_has_access())
  with check (sofia_has_access());

commit;
