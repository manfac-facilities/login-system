-- sdd-sql-track-b.sql
-- Track B da auditoria (achado U-02): descrição do problema por item de
-- checklist, quando o item é marcado "Problema" em vez de "OK".
-- Rodar manualmente no Supabase Dashboard (projeto iyytcavcgukfjnjjrerx)
-- ANTES do deploy do código desta spec.
--
-- ESTADO EM 2026-08-09: APLICADA em produção via migration
-- `track_b_checklist_itens_problemas`. Até essa data a coluna não existia,
-- e o código de criar checklist (que já estava em master desde 28/07)
-- teria falhado com "Erro ao salvar checklist" se tivesse ido ao ar.

alter table public.checklist
  add column if not exists itens_problemas jsonb not null default '{}';
