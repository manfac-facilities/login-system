-- ============================================================
-- Sofia: feedback cliente 2026-06-25
-- ============================================================

-- 1. km_diario: substituir km_inicial/km_final por km_atual
ALTER TABLE km_diario ADD COLUMN km_atual INTEGER;
UPDATE km_diario SET km_atual = COALESCE(km_final, km_inicial);
ALTER TABLE km_diario ALTER COLUMN km_atual SET NOT NULL;
ALTER TABLE km_diario DROP COLUMN km_inicial;
ALTER TABLE km_diario DROP COLUMN km_final;

-- 2. abastecimentos: litros passa a ser opcional
ALTER TABLE abastecimentos ALTER COLUMN litros DROP NOT NULL;
