-- ============================================================
-- Gestão de Frotas — Pacote de Segurança — 2026-07-20
-- Achados da auditoria: B-01 (RLS aberta), B-02 (audit log
-- quebrado), B-03 (desconto sem gate), B-07 (gates inconsistentes)
-- ============================================================
-- IMPORTANTE: as funções abaixo replicam ADMIN_EMAILS
-- (lib/auth/admins.ts) e a lógica de hasSystemAccess()
-- (lib/auth/systemAccess.ts) diretamente em SQL. Se a lista de
-- admins ou o slug 'sofia' mudarem no código, atualizar aqui
-- também — não há sincronização automática entre os dois lados.
-- ============================================================

-- 1. Função de acesso ao sistema "sofia" (espelha hasSystemAccess)
create or replace function public.sofia_has_access()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select
    lower(trim(auth.jwt() ->> 'email')) in (
      'ewerton.silva@manfac.com.br',
      'jose.guilherme@manfac.com.br',
      'jvictorco28@gmail.com'
    )
    or exists (
      select 1 from public.hub_system_access
      where user_email = lower(trim(auth.jwt() ->> 'email'))
        and system_slug = 'sofia'
        and has_access = true
    );
$$;

-- 2. Função de admin (espelha ADMIN_EMAILS)
create or replace function public.sofia_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select lower(trim(auth.jwt() ->> 'email')) in (
    'ewerton.silva@manfac.com.br',
    'jose.guilherme@manfac.com.br',
    'jvictorco28@gmail.com'
  );
$$;

-- 3. Substituir as 16 policies "using(true)" por "using(sofia_has_access())"
drop policy if exists "authenticated full access" on public.equipes;
drop policy if exists "sofia access" on public.equipes;
create policy "sofia access" on public.equipes for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.veiculos;
drop policy if exists "sofia access" on public.veiculos;
create policy "sofia access" on public.veiculos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.motoristas;
drop policy if exists "sofia access" on public.motoristas;
create policy "sofia access" on public.motoristas for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.km_diario;
drop policy if exists "sofia access" on public.km_diario;
create policy "sofia access" on public.km_diario for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.checklist;
drop policy if exists "sofia access" on public.checklist;
create policy "sofia access" on public.checklist for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.checklist_fotos;
drop policy if exists "sofia access" on public.checklist_fotos;
create policy "sofia access" on public.checklist_fotos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.multas;
drop policy if exists "sofia access" on public.multas;
create policy "sofia access" on public.multas for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.sinistros;
drop policy if exists "sofia access" on public.sinistros;
create policy "sofia access" on public.sinistros for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.sinistro_fotos;
drop policy if exists "sofia access" on public.sinistro_fotos;
create policy "sofia access" on public.sinistro_fotos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.revisoes;
drop policy if exists "sofia access" on public.revisoes;
create policy "sofia access" on public.revisoes for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.documentos_veiculo;
drop policy if exists "sofia access" on public.documentos_veiculo;
create policy "sofia access" on public.documentos_veiculo for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.abastecimentos;
drop policy if exists "sofia access" on public.abastecimentos;
create policy "sofia access" on public.abastecimentos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.motorista_documentos;
drop policy if exists "sofia access" on public.motorista_documentos;
create policy "sofia access" on public.motorista_documentos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.veiculo_responsabilidade_historico;
drop policy if exists "sofia access" on public.veiculo_responsabilidade_historico;
create policy "sofia access" on public.veiculo_responsabilidade_historico for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.centro_custo_historico;
drop policy if exists "sofia access" on public.centro_custo_historico;
create policy "sofia access" on public.centro_custo_historico for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.pendencias;
drop policy if exists "sofia access" on public.pendencias;
create policy "sofia access" on public.pendencias for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.audit_log;
drop policy if exists "sofia access" on public.audit_log;
create policy "sofia access" on public.audit_log for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

-- 4. km_excedido_desconto (tabela criada na migração de autorização, sem
--    policy nomeada "authenticated full access" — confirmar nome real
--    antes de rodar; se o drop abaixo falhar, rodar primeiro:
--    select policyname from pg_policies where tablename = 'km_excedido_desconto';
drop policy if exists "authenticated full access" on public.km_excedido_desconto;
drop policy if exists "sofia access" on public.km_excedido_desconto;
create policy "sofia access" on public.km_excedido_desconto for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

-- 5. Trigger de defesa em profundidade — colunas de autorização/desconto
--    só podem mudar via admin, mesmo que a RLS geral permita a linha
create or replace function public.sofia_bloquear_autorizacao_nao_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.sofia_is_admin() then
    if TG_OP = 'UPDATE' then
      if TG_TABLE_NAME = 'multas' and (
        new.autorizacao_status is distinct from old.autorizacao_status
        or new.valor_descontado is distinct from old.valor_descontado
        or new.status is distinct from old.status
      ) then
        raise exception 'Apenas administradores podem alterar autorização/desconto de multas';
      end if;
      if TG_TABLE_NAME = 'sinistros' and (
        new.autorizacao_status is distinct from old.autorizacao_status
        or new.valor_descontado is distinct from old.valor_descontado
        or new.status_desconto is distinct from old.status_desconto
      ) then
        raise exception 'Apenas administradores podem alterar autorização/desconto de sinistros';
      end if;
      if TG_TABLE_NAME = 'km_excedido_desconto' and (
        new.autorizacao_status is distinct from old.autorizacao_status
      ) then
        raise exception 'Apenas administradores podem alterar autorização de KM excedido';
      end if;
    elsif TG_OP = 'INSERT' then
      if TG_TABLE_NAME = 'multas' and (
        new.autorizacao_status is distinct from 'sem_solicitacao'
        or new.valor_descontado is not null
        or new.status is distinct from 'pendente'
      ) then
        raise exception 'Apenas administradores podem inserir multas com autorização/desconto já definidos';
      end if;
      if TG_TABLE_NAME = 'sinistros' and (
        new.autorizacao_status is distinct from 'sem_solicitacao'
        or new.valor_descontado is not null
        or new.status_desconto is distinct from 'pendente'
      ) then
        raise exception 'Apenas administradores podem inserir sinistros com autorização/desconto já definidos';
      end if;
      if TG_TABLE_NAME = 'km_excedido_desconto' and (
        new.autorizacao_status is distinct from 'sem_solicitacao'
      ) then
        raise exception 'Apenas administradores podem inserir KM excedido com autorização já definida';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_autorizacao_multas on public.multas;
create trigger trg_bloquear_autorizacao_multas
  before insert or update on public.multas
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

drop trigger if exists trg_bloquear_autorizacao_sinistros on public.sinistros;
create trigger trg_bloquear_autorizacao_sinistros
  before insert or update on public.sinistros
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

drop trigger if exists trg_bloquear_autorizacao_km_excedido on public.km_excedido_desconto;
create trigger trg_bloquear_autorizacao_km_excedido
  before insert or update on public.km_excedido_desconto
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

-- 6. audit_log: colunas do formato antigo (registrarAuditoria) deixam de
--    ser obrigatórias — a partir de agora só o formato de logAudit é usado
alter table public.audit_log alter column acao drop not null;
alter table public.audit_log alter column dados drop not null;
