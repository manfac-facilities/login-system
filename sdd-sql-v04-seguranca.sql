-- ============================================================
-- Gestão de Frotas — Pacote de Segurança — 2026-07-20 (atualizado 2026-07-23)
-- Achados da auditoria: B-01 (RLS aberta), B-02 (audit log
-- quebrado), B-03 (desconto sem gate), B-07 (gates inconsistentes)
-- + achados do /security-review no diff final: RLS/triggers cobrindo
-- os demais admin-only gates (equipes.ativo, veiculos.valor_locacao_mensal,
-- centro_custo_historico, delete de abastecimentos/km_diario) e delete
-- de multas/sinistros/km_excedido_desconto, que antes só eram bloqueados
-- na camada da aplicação e ficavam contornáveis via Supabase direto.
-- ============================================================
-- ESTADO: APLICADO EM PRODUÇÃO em 2026-08-10 (iyytcavcgukfjnjjrerx, migration
-- `v04_seguranca_rls_sofia`). Verificado depois de aplicar: as 2 funções
-- existem, as 18 tabelas do Sofia trocaram "authenticated full access" por
-- "sofia access" (0 policies abertas restantes), os 8 triggers existem e
-- audit_log.acao/dados ficaram nullable.
--
-- Teste funcional feito com request.jwt.claims forjado, por identidade:
--   administrador           -> is_admin true,  has_access true
--   analista sem acesso     -> is_admin false, has_access false
--   JWT sem claim de e-mail -> false (NÃO null — o fail-open descrito na
--                              Lição 2 do Track C não se aplica a esta versão,
--                              que usa exists() em vez de "in (lista)")
--
-- Pré-flight que rodou antes: as 18 tabelas existiam, todas com RLS ligada e
-- todas com exatamente uma policy chamada "authenticated full access" — ou
-- seja, os DROPs por nome cobriram 100% delas, nenhuma sobrou aberta por ter
-- nome diferente. Não havia nenhum trigger de usuário no schema public.
--
-- LIMITAÇÃO CONHECIDA: os triggers são security definer e disparam para
-- QUALQUER role, inclusive service_role e postgres (SQL Editor / MCP), onde
-- auth.jwt() é NULL e sofia_is_admin() devolve false. Editar à mão pelo
-- Dashboard as colunas guardadas (autorizacao/desconto de multas e sinistros,
-- equipes.ativo, veiculos.valor_locacao_mensal, insert em
-- centro_custo_historico, delete em abastecimentos/km_diario) vai falhar com
-- "Apenas administradores...". Contorno: alter table ... disable trigger,
-- corrigir, reabilitar. Foi decidido não abrir exceção para service_role.
--
-- REESCRITO EM 2026-08-09: as funções liam uma lista fixa de três e-mails,
-- copiada do antigo lib/auth/admins.ts. Esse arquivo não existe mais — o
-- nível de acesso agora mora em hub_user_roles e é editado pela tela
-- /admin/acessos. Rodar a versão antiga deste script congelaria no banco
-- uma lista de admins divergente do app: promoções feitas pela tela não
-- valeriam no Postgres, e quem foi removido da lista continuaria admin.
--
-- As funções abaixo passam a ler as MESMAS tabelas que o app
-- (lib/auth/roles.ts e lib/auth/systemAccess.ts), então não há mais nada
-- para sincronizar à mão.
-- ============================================================

-- 1. Função de admin (espelha isAdmin de lib/auth/roles.ts).
--    Vem antes de sofia_has_access porque esta a chama, e o Postgres
--    valida o corpo da função no momento da criação.
create or replace function public.sofia_is_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select exists (
    select 1 from public.hub_user_roles
    where user_email = lower(trim(auth.jwt() ->> 'email'))
      and nivel = 'administrador'
  );
$$;

-- 2. Função de acesso ao sistema "sofia" (espelha hasSystemAccess:
--    administrador entra sempre; os demais dependem de hub_system_access)
create or replace function public.sofia_has_access()
returns boolean
language sql
security definer
stable
set search_path = public, pg_catalog
as $$
  select
    public.sofia_is_admin()
    or exists (
      select 1 from public.hub_system_access
      where user_email = lower(trim(auth.jwt() ->> 'email'))
        and system_slug = 'sofia'
        and has_access = true
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
    elsif TG_OP = 'DELETE' then
      -- Achado da security review (Vuln 2): sem isto, RLS sozinha permitia
      -- que um usuário não-admin apagasse multa/sinistro/km_excedido via
      -- chamada direta ao Supabase, contornando excluirMultaAction/
      -- excluirSinistroAction (ambas admin-gated na app).
      if TG_TABLE_NAME in ('multas', 'sinistros', 'km_excedido_desconto') then
        raise exception 'Apenas administradores podem excluir este registro';
      end if;
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_autorizacao_multas on public.multas;
create trigger trg_bloquear_autorizacao_multas
  before insert or update or delete on public.multas
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

drop trigger if exists trg_bloquear_autorizacao_sinistros on public.sinistros;
create trigger trg_bloquear_autorizacao_sinistros
  before insert or update or delete on public.sinistros
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

drop trigger if exists trg_bloquear_autorizacao_km_excedido on public.km_excedido_desconto;
create trigger trg_bloquear_autorizacao_km_excedido
  before insert or update or delete on public.km_excedido_desconto
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

-- 6. Trigger de defesa em profundidade — demais escritas admin-only sem
--    tabela de autorização dedicada (achado da security review: Vuln 1).
--    Sem isto, RLS (sofia_has_access()) sozinha permitia que qualquer
--    usuário com acesso ao sofia (não só admin) fizesse via Supabase direto
--    o que toggleEquipeAction/atualizarLocacaoVeiculoAction/
--    atualizarCentroCustoAction/deletarAbastecimentoAction/deletarKmAction
--    já bloqueiam na camada da aplicação.
create or replace function public.sofia_bloquear_escrita_nao_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if not public.sofia_is_admin() then
    if TG_OP = 'UPDATE' then
      if TG_TABLE_NAME = 'equipes' and new.ativo is distinct from old.ativo then
        raise exception 'Apenas administradores podem ativar/desativar equipes';
      end if;
      if TG_TABLE_NAME = 'veiculos' and new.valor_locacao_mensal is distinct from old.valor_locacao_mensal then
        raise exception 'Apenas administradores podem alterar o valor de locação do veículo';
      end if;
    elsif TG_OP = 'INSERT' then
      if TG_TABLE_NAME = 'centro_custo_historico' then
        raise exception 'Apenas administradores podem atualizar o centro de custo';
      end if;
    elsif TG_OP = 'DELETE' then
      if TG_TABLE_NAME = 'abastecimentos' then
        raise exception 'Apenas administradores podem excluir abastecimentos';
      end if;
      if TG_TABLE_NAME = 'km_diario' then
        raise exception 'Apenas administradores podem excluir lançamentos de KM';
      end if;
    end if;
  end if;
  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_escrita_equipes on public.equipes;
create trigger trg_bloquear_escrita_equipes
  before update on public.equipes
  for each row execute function public.sofia_bloquear_escrita_nao_admin();

drop trigger if exists trg_bloquear_escrita_veiculos on public.veiculos;
create trigger trg_bloquear_escrita_veiculos
  before update on public.veiculos
  for each row execute function public.sofia_bloquear_escrita_nao_admin();

drop trigger if exists trg_bloquear_escrita_centro_custo on public.centro_custo_historico;
create trigger trg_bloquear_escrita_centro_custo
  before insert on public.centro_custo_historico
  for each row execute function public.sofia_bloquear_escrita_nao_admin();

drop trigger if exists trg_bloquear_escrita_abastecimentos on public.abastecimentos;
create trigger trg_bloquear_escrita_abastecimentos
  before delete on public.abastecimentos
  for each row execute function public.sofia_bloquear_escrita_nao_admin();

drop trigger if exists trg_bloquear_escrita_km_diario on public.km_diario;
create trigger trg_bloquear_escrita_km_diario
  before delete on public.km_diario
  for each row execute function public.sofia_bloquear_escrita_nao_admin();

-- 7. audit_log: colunas do formato antigo (registrarAuditoria) deixam de
--    ser obrigatórias — a partir de agora só o formato de logAudit é usado
alter table public.audit_log alter column acao drop not null;
alter table public.audit_log alter column dados drop not null;
