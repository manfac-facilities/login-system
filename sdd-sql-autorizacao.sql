-- sdd-sql-autorizacao.sql
-- Rastreamento de status de solicitação de desconto em multas, sinistros e KM excedido

-- 1. multas: adicionar status de autorização
ALTER TABLE multas
  ADD COLUMN IF NOT EXISTS autorizacao_status text DEFAULT 'sem_solicitacao'
    CHECK (autorizacao_status IN ('sem_solicitacao', 'solicitado', 'autorizado')),
  ADD COLUMN IF NOT EXISTS autorizacao_solicitado_em timestamptz;

-- Sincronizar registros já autorizados
UPDATE multas
  SET autorizacao_status = 'autorizado'
  WHERE autorizacao_assinada = true AND autorizacao_status = 'sem_solicitacao';

-- 2. sinistros: mesmo padrão
ALTER TABLE sinistros
  ADD COLUMN IF NOT EXISTS autorizacao_status text DEFAULT 'sem_solicitacao'
    CHECK (autorizacao_status IN ('sem_solicitacao', 'solicitado', 'autorizado')),
  ADD COLUMN IF NOT EXISTS autorizacao_solicitado_em timestamptz;

UPDATE sinistros
  SET autorizacao_status = 'autorizado'
  WHERE autorizacao_assinada = true AND autorizacao_status = 'sem_solicitacao';

-- 3. tabela de KM excedido por mês/veículo
CREATE TABLE IF NOT EXISTS km_excedido_desconto (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  veiculo_id uuid REFERENCES veiculos(id) NOT NULL,
  motorista_id uuid REFERENCES motoristas(id),
  mes date NOT NULL,                     -- primeiro dia do mês, ex: 2026-06-01
  km_contratual integer NOT NULL,
  km_realizado integer NOT NULL,
  autorizacao_status text DEFAULT 'sem_solicitacao'
    CHECK (autorizacao_status IN ('sem_solicitacao', 'solicitado', 'autorizado')),
  autorizacao_solicitado_em timestamptz,
  observacoes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(veiculo_id, mes)
);

ALTER TABLE km_excedido_desconto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON km_excedido_desconto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
