-- sdd-sql-track-b.sql
-- Track B da auditoria (achado U-02): descrição do problema por item de
-- checklist, quando o item é marcado "Problema" em vez de "OK".
-- Rodar manualmente no Supabase Dashboard (projeto iyytcavcgukfjnjjrerx)
-- ANTES do deploy do código desta spec.

alter table public.checklist
  add column if not exists itens_problemas jsonb not null default '{}';
