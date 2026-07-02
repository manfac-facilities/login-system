-- sdd-sql-conversor-os.sql
-- Conversor de OS: log de importações + controle de acesso por sistema

CREATE TABLE IF NOT EXISTS conversor_os_imports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  user_email text NOT NULL,
  cliente text NOT NULL CHECK (cliente IN ('DPSP', 'D1000')),
  filename text NOT NULL,
  storage_path text NOT NULL,
  total_rows integer NOT NULL,
  converted_rows integer NOT NULL,
  duplicates_removed integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversor_os_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON conversor_os_imports
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS hub_system_access (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  system_slug text NOT NULL,
  has_access boolean NOT NULL DEFAULT true,
  granted_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_email, system_slug)
);

ALTER TABLE hub_system_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON hub_system_access
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
