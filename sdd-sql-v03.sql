-- sdd-sql-v03.sql
-- Ajustes v03: motorista_id em revisoes + km_excedido em pendencias

-- 1. revisoes: coluna motorista
ALTER TABLE revisoes ADD COLUMN IF NOT EXISTS motorista_id uuid REFERENCES motoristas(id);

-- 2. pendencias: adicionar km_excedido ao check constraint
ALTER TABLE pendencias DROP CONSTRAINT IF EXISTS pendencias_origem_check;
ALTER TABLE pendencias ADD CONSTRAINT pendencias_origem_check
  CHECK (origem IN ('manual','multa','sinistro','manutencao','documento','termo','km_excedido'));
