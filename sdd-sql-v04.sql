-- ============================================================
-- Gestão de Frotas v04 — 2026-07-18
-- Feedback do cliente: veículo na oficina + provisório, novos
-- tipos de checklist, vínculo equipe única por veículo.
-- Inclui achado B-05 da auditoria (chave errada em km_diario).
--
-- IMPORTANTE: esta migração precisa rodar ANTES do deploy do
-- código deste branch — o app assume o schema pós-migração e
-- falha com erros genéricos se for deployado antes de rodar isto.
-- ============================================================

-- 1. Veículo na oficina + veículo substituto
alter table public.veiculos add column previsao_retorno_oficina date;
alter table public.veiculos add column substituto_id uuid references public.veiculos(id);

-- 2. 1 equipe ativa por vez (não pode a mesma equipe estar em 2
--    veículos não-inativos ao mesmo tempo — item 3 do feedback)

-- Rode ANTES do índice abaixo; precisa retornar 0 linhas:
select equipe_id, count(*) from public.veiculos
where equipe_id is not null and status <> 'inativo'
group by equipe_id having count(*) > 1;

create unique index veiculos_equipe_ativo_uniq
  on public.veiculos(equipe_id)
  where equipe_id is not null and status <> 'inativo';

-- 3. Checklist: equipe_id passa a ser opcional (tipo 'recebimento'
--    pode não ter equipe ainda)
alter table public.checklist alter column equipe_id drop not null;

-- 4. km_diario: chave de unicidade correta (achado B-05 da auditoria).
--    O nome da constraint abaixo é o gerado por padrão pelo Postgres
--    para "unique(data, equipe_id)" declarado em sdd-sql-passo1.sql.
--    Se o DROP falhar por nome diferente, rodar primeiro:
--      select conname from pg_constraint
--      where conrelid = 'km_diario'::regclass and contype = 'u';
--    e usar o nome retornado no lugar de km_diario_data_equipe_id_key.
alter table public.km_diario drop constraint if exists km_diario_data_equipe_id_key;

-- Rode ANTES da constraint abaixo; precisa retornar 0 linhas:
select data, veiculo_id, count(*) from public.km_diario
group by data, veiculo_id having count(*) > 1;

alter table public.km_diario add constraint km_diario_data_veiculo_id_key unique (data, veiculo_id);
