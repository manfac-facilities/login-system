-- sdd-sql-audit-log.sql
-- Extends the existing audit_log table (created in sdd-sql-passo4.sql)
-- to support the logAudit interface used in Tasks 5-8 Server Actions.
-- Run AFTER sdd-sql-passo4.sql has already been applied.

-- 1. Make registro_id nullable and change type to text
--    (was uuid NOT NULL; logAudit may receive null or non-uuid strings)
ALTER TABLE public.audit_log
  ALTER COLUMN registro_id DROP NOT NULL;

ALTER TABLE public.audit_log
  ALTER COLUMN registro_id TYPE text USING registro_id::text;

-- 2. Drop the old acao check constraint so new values (criou, excluiu, desativou…) are accepted
ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_acao_check;

-- 3. Add columns used by logAudit (IF NOT EXISTS for idempotency)
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS operacao text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES auth.users(id);

-- RLS is already enabled and the "authenticated full access" policy already covers INSERT/SELECT.
-- No further RLS changes needed.
