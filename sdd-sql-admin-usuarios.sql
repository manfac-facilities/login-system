-- sdd-sql-admin-usuarios.sql
-- Rodar no SQL Editor do Supabase, projeto iyytcavcgukfjnjjrerx.
-- ORDEM OBRIGATÓRIA: rodar ANTES de deployar o código desta entrega.

CREATE TABLE IF NOT EXISTS hub_user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL UNIQUE,
  nivel text NOT NULL CHECK (nivel IN ('analista', 'administrador')),
  granted_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hub_user_roles_email_idx ON hub_user_roles (user_email);

ALTER TABLE hub_user_roles ENABLE ROW LEVEL SECURITY;

-- Leitura para qualquer autenticado: o middleware consulta a cada request.
-- NENHUMA policy de INSERT/UPDATE/DELETE. Escrita só pela service role,
-- que ignora RLS. Isso impede um usuario de se auto-promover pelo client.
DROP POLICY IF EXISTS "authenticated read" ON hub_user_roles;
CREATE POLICY "authenticated read" ON hub_user_roles
  FOR SELECT TO authenticated USING (true);

-- Seed: administradores atuais primeiro.
INSERT INTO hub_user_roles (user_email, nivel, granted_by) VALUES
  ('jose.guilherme@manfac.com.br', 'administrador', 'migracao'),
  ('jvictorco28@gmail.com',        'administrador', 'migracao')
ON CONFLICT (user_email) DO NOTHING;

-- Todo o resto vira analista. O ON CONFLICT protege os admins acima.
INSERT INTO hub_user_roles (user_email, nivel, granted_by)
SELECT lower(trim(email)), 'analista', 'migracao'
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_email) DO NOTHING;

-- Correção do RLS permissivo de hub_system_access.
-- A policy antiga permitia que qualquer autenticado se concedesse acesso
-- a qualquer sistema pelo client, contornando as Server Actions.
DROP POLICY IF EXISTS "authenticated full access" ON hub_system_access;
DROP POLICY IF EXISTS "authenticated read" ON hub_system_access;
CREATE POLICY "authenticated read" ON hub_system_access
  FOR SELECT TO authenticated USING (true);
