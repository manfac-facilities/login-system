# Módulo Admin — gestão de contas e acessos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tirar o nível de acesso do código e levá-lo ao banco, dando ao administrador uma tela para convidar, remover, promover e liberar sistemas por pessoa — e fazer o hub mostrar a cada um apenas o que ele pode abrir.

**Architecture:** Uma tabela `hub_user_roles` vira a fonte de verdade do nível (`analista` | `administrador`), lida por `lib/auth/roles.ts` e escrita apenas pela service role dentro de Server Actions. `lib/auth/admins.ts` é deletado. A tela `/admin/acessos` ganha dois cards: contas e acessos por sistema. O dashboard passa a montar seus cards a partir do acesso real.

**Tech Stack:** Next.js 16.2.11 (App Router, Server Actions), `@supabase/supabase-js` ^2.108.1, TypeScript, Tailwind v4, Jest.

**Spec:** `docs/superpowers/specs/2026-08-07-admin-usuarios-design.md`
**Mockup aprovado:** https://claude.ai/code/artifact/b3f7e5aa-f259-4c14-ae2f-f75dfa93862b

## Global Constraints

- **Idioma:** toda a UI e todas as mensagens de erro em português do Brasil.
- **Tema:** fundo `#0a1628`, navy `#0d2050`, laranja `#f05a28`, texto secundário `#94a3b8`, bordas `#1e3a5f`, verde de toggle ligado `#22c55e`, toggle desligado `#0d2050`.
- **Convenções de arquivo:** Server Actions em `_actions.ts`, formulários em `_form.tsx`, tabelas em `_table.tsx`, prefixo `_` não vira rota, testes em `__tests__/` ao lado do código.
- **E-mails são sempre normalizados** com `.trim().toLowerCase()` antes de ir ao banco ou de ser comparados.
- **Níveis válidos:** exatamente `'analista'` e `'administrador'`. Nenhum outro valor.
- **Toda escrita** em `hub_user_roles` e `hub_system_access` usa a service role. Nenhuma escrita pelo client anônimo.
- **Todo invariante de segurança** é verificado na Server Action, não apenas na UI.
- **Migrations são manuais:** o SQL vira arquivo `sdd-sql-*.sql` na raiz, rodado à mão no SQL Editor do Supabase (projeto `iyytcavcgukfjnjjrerx`).
- **Datas exibidas** usam `Intl.DateTimeFormat('pt-BR')` com `timeZone: 'America/Sao_Paulo'`.
- Rodar `npm test` e `npm run lint` antes de cada commit.

## File Structure

**Criados:**

| Arquivo | Responsabilidade |
|---|---|
| `sdd-sql-admin-usuarios.sql` | Migração: tabela, RLS, seed, correção do RLS de `hub_system_access` |
| `lib/auth/roles.ts` | Ler o nível do banco. `getNivel`, `isAdmin`, tipo `Nivel` |
| `lib/auth/__tests__/roles.test.ts` | Testes de `roles.ts` |
| `lib/supabase/admin.ts` | Client com service role, com erro claro se a chave faltar |
| `lib/supabase/__tests__/admin.test.ts` | Testes do client admin |
| `app/admin/_dialogs.tsx` | Diálogos de convidar e remover |
| `app/admin/acessos/_contas.tsx` | Card "Conta": tabela, busca, filtro, menu de ações |
| `app/admin/acessos/__tests__/_contas.test.tsx` | Testes do card Conta |
| `app/(dashboard)/dashboard/__tests__/page.test.tsx` | Testes do dashboard por nível |

**Modificados:**

| Arquivo | Mudança |
|---|---|
| `lib/auth/systemAccess.ts` | Usa `isAdmin` de `roles.ts` |
| `lib/auth/requireAdmin.ts` | Usa `isAdmin` de `roles.ts` |
| `middleware.ts:98` | `isAdminEmail` → `await isAdmin` |
| `app/admin/_actions.ts` | Reescrito: 8 actions |
| `app/admin/acessos/page.tsx` | Passa a compor os dois cards |
| `app/admin/acessos/_table.tsx` | Vira o card "Funções"; admin sem toggles |
| `app/(dashboard)/dashboard/page.tsx` | Cards por acesso real |
| 9 arquivos de `app/(operacoes)/sofia/**` e `app/conversor-os/**` | `isAdminEmail` → `await isAdmin` |

**Deletados:** `lib/auth/admins.ts`, `lib/auth/__tests__/admins.test.ts`

---

### Task 1: Migração do banco

**Files:**
- Create: `sdd-sql-admin-usuarios.sql`

**Interfaces:**
- Consumes: nada
- Produces: tabela `hub_user_roles(id, user_email UNIQUE, nivel, granted_by, created_at, updated_at)`; políticas de leitura em `hub_user_roles` e `hub_system_access`

- [ ] **Step 1: Escrever o arquivo de migração**

```sql
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
```

- [ ] **Step 2: Verificação manual no Supabase**

Rodar o arquivo inteiro no SQL Editor e conferir com:

```sql
SELECT nivel, count(*) FROM hub_user_roles GROUP BY nivel;
SELECT * FROM hub_user_roles WHERE nivel = 'administrador';
```

Esperado: pelo menos 2 administradores (`jose.guilherme`, `jvictorco28`) e o restante como analista. **Se nenhum administrador aparecer, PARE** — deployar o código nesse estado deixa o hub sem administrador nenhum.

- [ ] **Step 3: Commit**

```bash
git add sdd-sql-admin-usuarios.sql
git commit -m "feat(admin): migração de hub_user_roles e correção do RLS de acessos"
```

---

### Task 2: `lib/auth/roles.ts`

**Files:**
- Create: `lib/auth/roles.ts`
- Test: `lib/auth/__tests__/roles.test.ts`

**Interfaces:**
- Consumes: tabela `hub_user_roles` da Task 1
- Produces:
  - `type Nivel = 'analista' | 'administrador'`
  - `getNivel(supabase: SupabaseClient<any,any,any>, email: string): Promise<Nivel | null>`
  - `isAdmin(supabase: SupabaseClient<any,any,any>, email: string): Promise<boolean>`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/auth/__tests__/roles.test.ts
import { getNivel, isAdmin } from '../roles'

function fakeSupabase(row: { nivel: string } | null) {
  const eq = jest.fn().mockReturnThis()
  const client = {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq,
      maybeSingle: jest.fn().mockResolvedValue({ data: row }),
    })),
    _eq: eq,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return client
}

describe('getNivel', () => {
  it('returns administrador when the row says so', async () => {
    const result = await getNivel(fakeSupabase({ nivel: 'administrador' }), 'a@manfac.com.br')
    expect(result).toBe('administrador')
  })

  it('returns analista when the row says so', async () => {
    const result = await getNivel(fakeSupabase({ nivel: 'analista' }), 'a@manfac.com.br')
    expect(result).toBe('analista')
  })

  it('returns null when there is no row', async () => {
    const result = await getNivel(fakeSupabase(null), 'ninguem@manfac.com.br')
    expect(result).toBeNull()
  })

  it('returns null for an empty email without querying', async () => {
    const supabase = fakeSupabase({ nivel: 'administrador' })
    const result = await getNivel(supabase, '')
    expect(result).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('normalizes case and surrounding whitespace', async () => {
    const supabase = fakeSupabase({ nivel: 'administrador' })
    await getNivel(supabase, '  JOSE.GUILHERME@MANFAC.COM.BR  ')
    expect(supabase._eq).toHaveBeenCalledWith('user_email', 'jose.guilherme@manfac.com.br')
  })

  it('returns null for an unknown nivel value in the database', async () => {
    const result = await getNivel(fakeSupabase({ nivel: 'superusuario' }), 'a@manfac.com.br')
    expect(result).toBeNull()
  })
})

describe('isAdmin', () => {
  it('is true only for administrador', async () => {
    expect(await isAdmin(fakeSupabase({ nivel: 'administrador' }), 'a@manfac.com.br')).toBe(true)
    expect(await isAdmin(fakeSupabase({ nivel: 'analista' }), 'a@manfac.com.br')).toBe(false)
    expect(await isAdmin(fakeSupabase(null), 'a@manfac.com.br')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest lib/auth/__tests__/roles.test.ts`
Expected: FAIL — `Cannot find module '../roles'`

- [ ] **Step 3: Implementar**

```ts
// lib/auth/roles.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type Nivel = 'analista' | 'administrador'

const NIVEIS: readonly string[] = ['analista', 'administrador']

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function getNivel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string
): Promise<Nivel | null> {
  const alvo = normalizarEmail(email)
  if (!alvo) return null

  const { data } = await supabase
    .from('hub_user_roles')
    .select('nivel')
    .eq('user_email', alvo)
    .maybeSingle()

  const nivel = data?.nivel
  return NIVEIS.includes(nivel) ? (nivel as Nivel) : null
}

export async function isAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string
): Promise<boolean> {
  return (await getNivel(supabase, email)) === 'administrador'
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest lib/auth/__tests__/roles.test.ts`
Expected: PASS, 7 testes

- [ ] **Step 5: Commit**

```bash
git add lib/auth/roles.ts lib/auth/__tests__/roles.test.ts
git commit -m "feat(auth): lê o nível de acesso de hub_user_roles"
```

---

### Task 3: `systemAccess` e `requireAdmin` passam a usar `roles`

**Files:**
- Modify: `lib/auth/systemAccess.ts:2,10`
- Modify: `lib/auth/requireAdmin.ts:2,11`
- Test: `lib/auth/__tests__/systemAccess.test.ts` (reescrever)

**Interfaces:**
- Consumes: `isAdmin` da Task 2
- Produces: assinaturas inalteradas — `hasSystemAccess(supabase, email, slug)` e `requireAdmin(supabase)`

- [ ] **Step 1: Reescrever o teste de systemAccess**

O teste atual assume a lista fixa. Passa a mockar `roles`:

```ts
// lib/auth/__tests__/systemAccess.test.ts
jest.mock('../roles', () => ({ isAdmin: jest.fn() }))

import { hasSystemAccess } from '../systemAccess'
import { isAdmin } from '../roles'

function fakeSupabase(row: { has_access: boolean } | null) {
  return {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: row }),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('hasSystemAccess', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns true for an admin without querying the table', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(true)
    const supabase = fakeSupabase(null)
    expect(await hasSystemAccess(supabase, 'chefe@manfac.com.br', 'sofia')).toBe(true)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns true for a non-admin with has_access = true', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    expect(await hasSystemAccess(fakeSupabase({ has_access: true }), 'a@manfac.com.br', 'sofia')).toBe(true)
  })

  it('returns false for a non-admin with has_access = false', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    expect(await hasSystemAccess(fakeSupabase({ has_access: false }), 'a@manfac.com.br', 'sofia')).toBe(false)
  })

  it('returns false for a non-admin with no row at all', async () => {
    ;(isAdmin as jest.Mock).mockResolvedValue(false)
    expect(await hasSystemAccess(fakeSupabase(null), 'a@manfac.com.br', 'sofia')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest lib/auth/__tests__/systemAccess.test.ts`
Expected: FAIL — `Cannot find module '../roles'` no `jest.mock`

- [ ] **Step 3: Trocar as duas importações**

Em `lib/auth/systemAccess.ts`, trocar a linha 2 e a linha 10:

```ts
import { isAdmin } from './roles'
// ...
export async function hasSystemAccess(supabase, email, systemSlug): Promise<boolean> {
  if (await isAdmin(supabase, email)) return true
  // resto inalterado
}
```

Em `lib/auth/requireAdmin.ts`:

```ts
import { isAdmin } from './roles'
// ...
  if (!user?.email || !(await isAdmin(supabase, user.email))) {
    return 'Apenas administradores podem executar esta ação'
  }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest lib/auth`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/auth/systemAccess.ts lib/auth/requireAdmin.ts lib/auth/__tests__/systemAccess.test.ts
git commit -m "refactor(auth): systemAccess e requireAdmin usam o nível do banco"
```

---

### Task 4: Converter os call sites restantes e deletar `admins.ts`

**Files:**
- Modify: `middleware.ts:4,98`
- Modify: `app/(dashboard)/dashboard/page.tsx:6,18`
- Modify: `app/conversor-os/_actions.ts:5,58`
- Modify: `app/conversor-os/historico/page.tsx:2,11`
- Modify: `app/admin/_actions.ts:4,17,42`
- Modify: `app/(operacoes)/sofia/veiculos/_actions.ts:6,108,138,176,205`
- Modify: `app/(operacoes)/sofia/multas/_actions.ts:5,64,82`
- Modify: `app/(operacoes)/sofia/multas/page.tsx:3,19`
- Modify: `app/(operacoes)/sofia/motoristas/_actions.ts:4,42`
- Modify: `app/(operacoes)/sofia/revisoes/_actions.ts:4,43`
- Modify: `app/(operacoes)/sofia/sinistros/_actions.ts:4,91`
- Modify: `app/(operacoes)/sofia/checklist/_actions.ts:6,193`
- Modify: `app/(operacoes)/sofia/equipes/_actions.ts:4,51`
- Delete: `lib/auth/admins.ts`, `lib/auth/__tests__/admins.test.ts`

**Interfaces:**
- Consumes: `isAdmin` da Task 2
- Produces: nenhum símbolo novo. Após esta task, `isAdminEmail` não existe mais no projeto.

- [ ] **Step 1: Trocar cada ocorrência**

Em todos os arquivos, a troca é mecânica. Cada um destes já está dentro de função `async` e já tem um client Supabase em escopo:

```ts
// import
- import { isAdminEmail } from '@/lib/auth/admins'
+ import { isAdmin } from '@/lib/auth/roles'

// uso em Server Action
- if (!user?.email || !isAdminEmail(user.email))
+ if (!user?.email || !(await isAdmin(supabase, user.email)))

// uso em Server Component
- const admin = isAdminEmail(user.email ?? '')
+ const admin = await isAdmin(supabase, user.email ?? '')
```

Em `app/(operacoes)/sofia/multas/page.tsx:19` a variável do client chama-se `supabase` e o usuário vem de `userData.user` — o resultado fica `await isAdmin(supabase, userData.user?.email ?? '')`.

Em `middleware.ts:98`, dentro do bloco que já é `async`:

```ts
if (isAdminPage && !(await isAdmin(supabase, user.email ?? ''))) {
  return NextResponse.redirect(new URL('/dashboard', request.url))
}
```

- [ ] **Step 2: Deletar a lista fixa**

```bash
git rm lib/auth/admins.ts lib/auth/__tests__/admins.test.ts
```

- [ ] **Step 3: Confirmar que não sobrou nenhuma referência**

Run: `npx tsc --noEmit`
Expected: sem erros. Qualquer `isAdminEmail` esquecido aparece aqui como erro de módulo inexistente.

- [ ] **Step 4: Rodar toda a suite**

Run: `npm test`
Expected: PASS. O teste `app/admin/__tests__/_actions.test.ts` vai falhar porque ainda mocka a lista fixa — **isso é esperado e será corrigido na Task 6**. Se for o único a falhar, seguir.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(auth): remove a lista fixa de administradores do código"
```

---

### Task 5: Client com service role

**Files:**
- Create: `lib/supabase/admin.ts`
- Test: `lib/supabase/__tests__/admin.test.ts`

**Interfaces:**
- Consumes: env `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_URL`
- Produces: `createAdminClient(): SupabaseClient` — lança `Error` com mensagem clara se faltar configuração

- [ ] **Step 1: Escrever os testes que falham**

```ts
// lib/supabase/__tests__/admin.test.ts
const createClientMock = jest.fn(() => ({ marker: 'admin-client' }))
jest.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))

import { createAdminClient } from '../admin'

const ORIGINAL = process.env

describe('createAdminClient', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...ORIGINAL }
  })
  afterAll(() => {
    process.env = ORIGINAL
  })

  it('throws a clear error when the service role key is missing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(() => createAdminClient()).toThrow('SUPABASE_SERVICE_ROLE_KEY')
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('throws a clear error when the url is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave'
    expect(() => createAdminClient()).toThrow('SUPABASE_URL')
  })

  it('builds the client with session persistence disabled', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'chave'
    createAdminClient()
    expect(createClientMock).toHaveBeenCalledWith('https://x.supabase.co', 'chave', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest lib/supabase/__tests__/admin.test.ts`
Expected: FAIL — `Cannot find module '../admin'`

- [ ] **Step 3: Implementar**

```ts
// lib/supabase/admin.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): SupabaseClient<any, any, any> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('SUPABASE_URL não está configurada no ambiente')
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente')
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest lib/supabase/__tests__/admin.test.ts`
Expected: PASS, 3 testes

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/admin.ts lib/supabase/__tests__/admin.test.ts
git commit -m "feat(supabase): client de service role com erro explícito de configuração"
```

---

### Task 6: `listarUsuariosAction` com nível, nome, último acesso e paginação

**Files:**
- Modify: `app/admin/_actions.ts`
- Test: `app/admin/__tests__/_actions.test.ts` (reescrever o describe de listagem)

**Interfaces:**
- Consumes: `createAdminClient` (Task 5), `isAdmin` (Task 2)
- Produces:

```ts
export interface UsuarioHub {
  id: string
  email: string
  nome: string | null
  nivel: Nivel | null
  ultimoAcesso: string | null   // ISO 8601
  convitePendente: boolean
}
export async function listarUsuariosAction(): Promise<UsuarioHub[] | { error: string }>
```

- [ ] **Step 1: Escrever os testes que falham**

```ts
// app/admin/__tests__/_actions.test.ts
const getUserMock = jest.fn()
const listUsersMock = jest.fn()
const isAdminMock = jest.fn()
const rolesSelectMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({ auth: { getUser: getUserMock } })),
}))
jest.mock('@/lib/supabase/admin', () => ({
  createAdminClient: jest.fn(() => ({
    auth: { admin: { listUsers: listUsersMock } },
    from: jest.fn(() => ({ select: rolesSelectMock })),
  })),
}))
jest.mock('@/lib/auth/roles', () => ({ isAdmin: isAdminMock }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { listarUsuariosAction } from '../_actions'

describe('listarUsuariosAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
    rolesSelectMock.mockResolvedValue({
      data: [{ user_email: 'ana@manfac.com.br', nivel: 'analista' }],
      error: null,
    })
  })

  it('rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    const result = await listarUsuariosAction()
    expect(result).toEqual({ error: 'Apenas administradores podem ver esta página' })
    expect(listUsersMock).not.toHaveBeenCalled()
  })

  it('merges nivel, nome and last sign in, sorted by email', async () => {
    listUsersMock.mockResolvedValueOnce({
      data: {
        users: [
          {
            id: '2',
            email: 'zeca@manfac.com.br',
            user_metadata: {},
            last_sign_in_at: null,
            confirmed_at: null,
          },
          {
            id: '1',
            email: 'ana@manfac.com.br',
            user_metadata: { full_name: 'Ana Souza' },
            last_sign_in_at: '2026-07-03T13:52:00Z',
            confirmed_at: '2026-06-01T10:00:00Z',
          },
        ],
      },
      error: null,
    })
    const result = await listarUsuariosAction()
    expect(result).toEqual([
      {
        id: '1',
        email: 'ana@manfac.com.br',
        nome: 'Ana Souza',
        nivel: 'analista',
        ultimoAcesso: '2026-07-03T13:52:00Z',
        convitePendente: false,
      },
      {
        id: '2',
        email: 'zeca@manfac.com.br',
        nome: null,
        nivel: null,
        ultimoAcesso: null,
        convitePendente: true,
      },
    ])
  })

  it('pages until a short page comes back, so it does not stop at 50', async () => {
    const cheia = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      email: `u${String(i).padStart(3, '0')}@manfac.com.br`,
      user_metadata: {},
      last_sign_in_at: null,
      confirmed_at: '2026-01-01T00:00:00Z',
    }))
    listUsersMock
      .mockResolvedValueOnce({ data: { users: cheia }, error: null })
      .mockResolvedValueOnce({ data: { users: [] }, error: null })

    const result = await listarUsuariosAction()
    expect(Array.isArray(result) && result).toHaveLength(100)
    expect(listUsersMock).toHaveBeenCalledTimes(2)
    expect(listUsersMock).toHaveBeenNthCalledWith(1, { page: 1, perPage: 100 })
    expect(listUsersMock).toHaveBeenNthCalledWith(2, { page: 2, perPage: 100 })
  })

  it('returns an error when listUsers fails', async () => {
    listUsersMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    expect(await listarUsuariosAction()).toEqual({ error: 'Erro ao listar usuários' })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/admin`
Expected: FAIL

- [ ] **Step 3: Implementar**

```ts
// app/admin/_actions.ts — topo do arquivo
'use server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin, normalizarEmail, type Nivel } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'

const PER_PAGE = 100

export interface UsuarioHub {
  id: string
  email: string
  nome: string | null
  nivel: Nivel | null
  ultimoAcesso: string | null
  convitePendente: boolean
}

async function exigirAdmin(mensagem: string): Promise<{ email: string } | { error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !(await isAdmin(supabase, user.email))) return { error: mensagem }
  return { email: normalizarEmail(user.email) }
}

export async function listarUsuariosAction(): Promise<UsuarioHub[] | { error: string }> {
  const quem = await exigirAdmin('Apenas administradores podem ver esta página')
  if ('error' in quem) return quem

  const admin = createAdminClient()

  const todos = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) return { error: 'Erro ao listar usuários' }
    const lote = data?.users ?? []
    todos.push(...lote)
    if (lote.length < PER_PAGE) break
  }

  const { data: papeis } = await admin.from('hub_user_roles').select('user_email, nivel')
  const porEmail = new Map<string, Nivel>()
  for (const p of papeis ?? []) porEmail.set(p.user_email, p.nivel as Nivel)

  return todos
    .filter((u): u is typeof u & { email: string } => !!u.email)
    .map((u) => ({
      id: u.id,
      email: u.email,
      nome: (u.user_metadata?.full_name as string | undefined)?.trim() || null,
      nivel: porEmail.get(normalizarEmail(u.email)) ?? null,
      ultimoAcesso: u.last_sign_in_at ?? null,
      convitePendente: !u.confirmed_at,
    }))
    .sort((a, b) => a.email.localeCompare(b.email))
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/admin`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/_actions.ts app/admin/__tests__/_actions.test.ts
git commit -m "feat(admin): listagem com nível, nome, último acesso e paginação real"
```

---

### Task 7: `alterarNivelAction` com os invariantes

**Files:**
- Modify: `app/admin/_actions.ts`
- Test: `app/admin/__tests__/_actions.test.ts`

**Interfaces:**
- Consumes: `exigirAdmin`, `createAdminClient`
- Produces: `alterarNivelAction(email: string, nivel: Nivel): Promise<{ error?: string; success?: boolean }>`

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe('alterarNivelAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
  })

  it('rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await alterarNivelAction('ana@manfac.com.br', 'administrador')).toEqual({
      error: 'Apenas administradores podem alterar níveis',
    })
  })

  it('refuses to change your own level', async () => {
    expect(await alterarNivelAction('CHEFE@manfac.com.br', 'analista')).toEqual({
      error: 'Você não pode alterar o seu próprio nível',
    })
  })

  it('refuses an invalid level', async () => {
    // @ts-expect-error teste de valor inválido em runtime
    expect(await alterarNivelAction('ana@manfac.com.br', 'chefão')).toEqual({
      error: 'Nível inválido',
    })
  })

  it('refuses to demote the last administrator', async () => {
    contarAdminsMock.mockResolvedValue(1)
    nivelAtualMock.mockResolvedValue('administrador')
    expect(await alterarNivelAction('outro@manfac.com.br', 'analista')).toEqual({
      error: 'O hub precisa de pelo menos um administrador',
    })
  })

  it('upserts the new level for an admin', async () => {
    contarAdminsMock.mockResolvedValue(3)
    nivelAtualMock.mockResolvedValue('analista')
    upsertMock.mockResolvedValue({ error: null })
    expect(await alterarNivelAction('Ana@Manfac.com.br', 'administrador')).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_email: 'ana@manfac.com.br',
        nivel: 'administrador',
        granted_by: 'chefe@manfac.com.br',
      }),
      { onConflict: 'user_email' }
    )
  })
})
```

Adicionar ao bloco de mocks do topo do arquivo os mocks auxiliares:

```ts
const upsertMock = jest.fn()
const contarAdminsMock = jest.fn()
const nivelAtualMock = jest.fn()
```

e fazer o mock de `createAdminClient` devolver `from` capaz de servir `select`, `upsert` e `delete` conforme a tabela pedida.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/admin`
Expected: FAIL — `alterarNivelAction is not a function`

- [ ] **Step 3: Implementar**

```ts
const NIVEIS_VALIDOS: Nivel[] = ['analista', 'administrador']

async function contarAdministradores(admin: ReturnType<typeof createAdminClient>): Promise<number> {
  const { count } = await admin
    .from('hub_user_roles')
    .select('user_email', { count: 'exact', head: true })
    .eq('nivel', 'administrador')
  return count ?? 0
}

export async function alterarNivelAction(
  email: string,
  nivel: Nivel
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem alterar níveis')
  if ('error' in quem) return quem

  const alvo = normalizarEmail(email)
  if (alvo === quem.email) return { error: 'Você não pode alterar o seu próprio nível' }
  if (!NIVEIS_VALIDOS.includes(nivel)) return { error: 'Nível inválido' }

  const admin = createAdminClient()

  if (nivel === 'analista') {
    const { data: atual } = await admin
      .from('hub_user_roles')
      .select('nivel')
      .eq('user_email', alvo)
      .maybeSingle()
    if (atual?.nivel === 'administrador' && (await contarAdministradores(admin)) <= 1) {
      return { error: 'O hub precisa de pelo menos um administrador' }
    }
  }

  const { error } = await admin.from('hub_user_roles').upsert(
    { user_email: alvo, nivel, granted_by: quem.email, updated_at: new Date().toISOString() },
    { onConflict: 'user_email' }
  )
  if (error) return { error: 'Erro ao alterar o nível' }

  revalidatePath('/admin/acessos')
  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/admin`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/_actions.ts app/admin/__tests__/_actions.test.ts
git commit -m "feat(admin): promover e rebaixar com proteção do último administrador"
```

---

### Task 8: `removerUsuarioAction`

**Files:**
- Modify: `app/admin/_actions.ts`
- Test: `app/admin/__tests__/_actions.test.ts`

**Interfaces:**
- Consumes: `exigirAdmin`, `createAdminClient`, `contarAdministradores`
- Produces: `removerUsuarioAction(email: string): Promise<{ error?: string; success?: boolean }>`

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe('removerUsuarioAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
  })

  it('rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await removerUsuarioAction('ana@manfac.com.br')).toEqual({
      error: 'Apenas administradores podem remover usuários',
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('refuses to remove yourself', async () => {
    expect(await removerUsuarioAction('CHEFE@manfac.com.br')).toEqual({
      error: 'Você não pode remover a si mesmo',
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('refuses to remove the last administrator', async () => {
    nivelAtualMock.mockResolvedValue('administrador')
    contarAdminsMock.mockResolvedValue(1)
    expect(await removerUsuarioAction('outro@manfac.com.br')).toEqual({
      error: 'O hub precisa de pelo menos um administrador',
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('refuses when the user does not exist', async () => {
    listUsersMock.mockResolvedValueOnce({ data: { users: [] }, error: null })
    expect(await removerUsuarioAction('fantasma@manfac.com.br')).toEqual({
      error: 'Usuário não encontrado',
    })
  })

  it('does not delete rows when deleting the account fails', async () => {
    nivelAtualMock.mockResolvedValue('analista')
    deleteUserMock.mockResolvedValue({ error: { message: 'boom' } })
    expect(await removerUsuarioAction('ana@manfac.com.br')).toEqual({
      error: 'Erro ao remover o usuário',
    })
    expect(deleteRowsMock).not.toHaveBeenCalled()
  })

  it('deletes the account, the role and the system access', async () => {
    nivelAtualMock.mockResolvedValue('analista')
    deleteUserMock.mockResolvedValue({ error: null })
    expect(await removerUsuarioAction('Ana@Manfac.com.br')).toEqual({ success: true })
    expect(deleteUserMock).toHaveBeenCalledWith('id-da-ana')
    expect(tabelasApagadas).toEqual(['hub_user_roles', 'hub_system_access'])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/admin`
Expected: FAIL — `removerUsuarioAction is not a function`

- [ ] **Step 3: Implementar**

```ts
async function acharUsuarioPorEmail(
  admin: ReturnType<typeof createAdminClient>,
  alvo: string
): Promise<{ id: string } | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) return null
    const lote = data?.users ?? []
    const achado = lote.find((u) => u.email && normalizarEmail(u.email) === alvo)
    if (achado) return { id: achado.id }
    if (lote.length < PER_PAGE) return null
  }
}

export async function removerUsuarioAction(
  email: string
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem remover usuários')
  if ('error' in quem) return quem

  const alvo = normalizarEmail(email)
  if (alvo === quem.email) return { error: 'Você não pode remover a si mesmo' }

  const admin = createAdminClient()

  const { data: atual } = await admin
    .from('hub_user_roles')
    .select('nivel')
    .eq('user_email', alvo)
    .maybeSingle()
  if (atual?.nivel === 'administrador' && (await contarAdministradores(admin)) <= 1) {
    return { error: 'O hub precisa de pelo menos um administrador' }
  }

  const usuario = await acharUsuarioPorEmail(admin, alvo)
  if (!usuario) return { error: 'Usuário não encontrado' }

  // A conta primeiro: se falhar, nada mais é apagado.
  const { error } = await admin.auth.admin.deleteUser(usuario.id)
  if (error) return { error: 'Erro ao remover o usuário' }

  await admin.from('hub_user_roles').delete().eq('user_email', alvo)
  await admin.from('hub_system_access').delete().eq('user_email', alvo)

  revalidatePath('/admin/acessos')
  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/admin`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/_actions.ts app/admin/__tests__/_actions.test.ts
git commit -m "feat(admin): remover usuário apagando conta, nível e acessos"
```

---

### Task 9: `convidarUsuarioAction`

**Files:**
- Modify: `app/admin/_actions.ts`
- Test: `app/admin/__tests__/_actions.test.ts`

**Interfaces:**
- Consumes: `exigirAdmin`, `createAdminClient`, `isManfacEmail` de `@/lib/auth/domain`
- Produces: `convidarUsuarioAction(email: string, nivel: Nivel, sistemas: string[]): Promise<{ error?: string; success?: boolean }>`

- [ ] **Step 1: Escrever os testes que falham**

```ts
jest.mock('@/lib/auth/domain', () => ({ isManfacEmail: jest.fn(() => true) }))
import { isManfacEmail } from '@/lib/auth/domain'

describe('convidarUsuarioAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
    ;(isManfacEmail as jest.Mock).mockReturnValue(true)
  })

  it('rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await convidarUsuarioAction('nova@manfac.com.br', 'analista', [])).toEqual({
      error: 'Apenas administradores podem convidar usuários',
    })
    expect(inviteMock).not.toHaveBeenCalled()
  })

  it('refuses an email outside the allowed domain before calling the API', async () => {
    ;(isManfacEmail as jest.Mock).mockReturnValue(false)
    expect(await convidarUsuarioAction('alguem@gmail.com', 'analista', [])).toEqual({
      error: 'Só é possível convidar e-mails @manfac.com.br',
    })
    expect(inviteMock).not.toHaveBeenCalled()
  })

  it('refuses an invalid level', async () => {
    // @ts-expect-error valor inválido em runtime
    expect(await convidarUsuarioAction('nova@manfac.com.br', 'dono', [])).toEqual({
      error: 'Nível inválido',
    })
  })

  it('invites, records the level and grants the chosen systems', async () => {
    inviteMock.mockResolvedValue({ data: { user: { id: 'novo' } }, error: null })
    upsertMock.mockResolvedValue({ error: null })

    expect(
      await convidarUsuarioAction('Nova@Manfac.com.br', 'analista', ['conversor-os'])
    ).toEqual({ success: true })

    expect(inviteMock).toHaveBeenCalledWith('nova@manfac.com.br')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_email: 'nova@manfac.com.br', nivel: 'analista' }),
      { onConflict: 'user_email' }
    )
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_email: 'nova@manfac.com.br',
          system_slug: 'conversor-os',
          has_access: true,
        }),
      ]),
      { onConflict: 'user_email,system_slug' }
    )
  })

  it('reports a clear error when the invite fails', async () => {
    inviteMock.mockResolvedValue({ data: null, error: { message: 'já existe' } })
    expect(await convidarUsuarioAction('nova@manfac.com.br', 'analista', [])).toEqual({
      error: 'Erro ao enviar o convite. O e-mail já pode estar cadastrado.',
    })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/admin`
Expected: FAIL — `convidarUsuarioAction is not a function`

- [ ] **Step 3: Implementar**

```ts
import { isManfacEmail } from '@/lib/auth/domain'

export async function convidarUsuarioAction(
  email: string,
  nivel: Nivel,
  sistemas: string[]
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem convidar usuários')
  if ('error' in quem) return quem

  const alvo = normalizarEmail(email)
  if (!isManfacEmail(alvo)) return { error: 'Só é possível convidar e-mails @manfac.com.br' }
  if (!NIVEIS_VALIDOS.includes(nivel)) return { error: 'Nível inválido' }

  const admin = createAdminClient()

  const { error: erroConvite } = await admin.auth.admin.inviteUserByEmail(alvo)
  if (erroConvite) {
    return { error: 'Erro ao enviar o convite. O e-mail já pode estar cadastrado.' }
  }

  await admin.from('hub_user_roles').upsert(
    { user_email: alvo, nivel, granted_by: quem.email, updated_at: new Date().toISOString() },
    { onConflict: 'user_email' }
  )

  if (sistemas.length > 0) {
    await admin.from('hub_system_access').upsert(
      sistemas.map((slug) => ({
        user_email: alvo,
        system_slug: slug,
        has_access: true,
        granted_by: quem.email,
      })),
      { onConflict: 'user_email,system_slug' }
    )
  }

  revalidatePath('/admin/acessos')
  return { success: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/admin`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/_actions.ts app/admin/__tests__/_actions.test.ts
git commit -m "feat(admin): convidar usuário definindo nível e sistemas"
```

---

### Task 10: Actions de convite e senha, e `alternarAcessoAction` com service role

**Files:**
- Modify: `app/admin/_actions.ts`
- Test: `app/admin/__tests__/_actions.test.ts`

**Interfaces:**
- Produces:
  - `reenviarConviteAction(email: string): Promise<{ error?: string; success?: boolean }>`
  - `cancelarConviteAction(email: string): Promise<{ error?: string; success?: boolean }>`
  - `enviarResetSenhaAction(email: string): Promise<{ error?: string; success?: boolean }>`
  - `alternarAcessoAction(userEmail: string, systemSlug: string, hasAccess: boolean)` — assinatura preservada, agora escrevendo com service role

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe('ações de convite e senha', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { email: 'chefe@manfac.com.br' } } })
    isAdminMock.mockResolvedValue(true)
  })

  it('reenviarConviteAction rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await reenviarConviteAction('nova@manfac.com.br')).toEqual({
      error: 'Apenas administradores podem reenviar convites',
    })
  })

  it('reenviarConviteAction invites again', async () => {
    inviteMock.mockResolvedValue({ data: { user: { id: 'x' } }, error: null })
    expect(await reenviarConviteAction('Nova@Manfac.com.br')).toEqual({ success: true })
    expect(inviteMock).toHaveBeenCalledWith('nova@manfac.com.br')
  })

  it('cancelarConviteAction refuses to cancel a confirmed account', async () => {
    listUsersMock.mockResolvedValueOnce({
      data: { users: [{ id: '1', email: 'ana@manfac.com.br', confirmed_at: '2026-01-01' }] },
      error: null,
    })
    expect(await cancelarConviteAction('ana@manfac.com.br')).toEqual({
      error: 'Esse usuário já confirmou o cadastro. Use "Remover do hub".',
    })
    expect(deleteUserMock).not.toHaveBeenCalled()
  })

  it('enviarResetSenhaAction rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await enviarResetSenhaAction('ana@manfac.com.br')).toEqual({
      error: 'Apenas administradores podem enviar redefinição de senha',
    })
  })

  it('alternarAcessoAction rejects non-admins', async () => {
    isAdminMock.mockResolvedValue(false)
    expect(await alternarAcessoAction('ana@manfac.com.br', 'sofia', true)).toEqual({
      error: 'Apenas administradores podem alterar acessos',
    })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('alternarAcessoAction writes with the admin client and normalizes the email', async () => {
    upsertMock.mockResolvedValue({ error: null })
    expect(await alternarAcessoAction('Ana@Manfac.com.br', 'sofia', true)).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_email: 'ana@manfac.com.br',
        system_slug: 'sofia',
        has_access: true,
        granted_by: 'chefe@manfac.com.br',
      },
      { onConflict: 'user_email,system_slug' }
    )
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/admin`
Expected: FAIL

- [ ] **Step 3: Implementar**

```ts
export async function reenviarConviteAction(email: string) {
  const quem = await exigirAdmin('Apenas administradores podem reenviar convites')
  if ('error' in quem) return quem

  const alvo = normalizarEmail(email)
  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(alvo)
  if (error) return { error: 'Erro ao reenviar o convite' }
  return { success: true }
}

export async function cancelarConviteAction(email: string) {
  const quem = await exigirAdmin('Apenas administradores podem cancelar convites')
  if ('error' in quem) return quem

  const alvo = normalizarEmail(email)
  const admin = createAdminClient()

  const usuario = await acharUsuarioPorEmailCompleto(admin, alvo)
  if (!usuario) return { error: 'Usuário não encontrado' }
  if (usuario.confirmed_at) {
    return { error: 'Esse usuário já confirmou o cadastro. Use "Remover do hub".' }
  }

  const { error } = await admin.auth.admin.deleteUser(usuario.id)
  if (error) return { error: 'Erro ao cancelar o convite' }

  await admin.from('hub_user_roles').delete().eq('user_email', alvo)
  await admin.from('hub_system_access').delete().eq('user_email', alvo)

  revalidatePath('/admin/acessos')
  return { success: true }
}

export async function enviarResetSenhaAction(email: string) {
  const quem = await exigirAdmin('Apenas administradores podem enviar redefinição de senha')
  if ('error' in quem) return quem

  const supabase = await createServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(normalizarEmail(email), {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
  })
  if (error) return { error: 'Erro ao enviar o e-mail de redefinição' }
  return { success: true }
}

export async function alternarAcessoAction(
  userEmail: string,
  systemSlug: string,
  hasAccess: boolean
): Promise<{ error?: string; success?: boolean }> {
  const quem = await exigirAdmin('Apenas administradores podem alterar acessos')
  if ('error' in quem) return quem

  const { error } = await createAdminClient().from('hub_system_access').upsert(
    {
      user_email: normalizarEmail(userEmail),
      system_slug: systemSlug,
      has_access: hasAccess,
      granted_by: quem.email,
    },
    { onConflict: 'user_email,system_slug' }
  )
  if (error) return { error: 'Erro ao atualizar acesso' }

  revalidatePath('/admin/acessos')
  return { success: true }
}
```

`acharUsuarioPorEmailCompleto` é a variação de `acharUsuarioPorEmail` (Task 8) que devolve `{ id, confirmed_at }` em vez de só `{ id }`. Refatorar `acharUsuarioPorEmail` para devolver o objeto completo e ajustar a chamada da Task 8.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/admin && npx tsc --noEmit`
Expected: PASS, sem erros de tipo

- [ ] **Step 5: Commit**

```bash
git add app/admin/_actions.ts app/admin/__tests__/_actions.test.ts
git commit -m "feat(admin): reenviar/cancelar convite, redefinir senha e acesso via service role"
```

---

### Task 11: Card "Conta"

**Files:**
- Create: `app/admin/acessos/_contas.tsx`
- Test: `app/admin/acessos/__tests__/_contas.test.tsx`

**Interfaces:**
- Consumes: `UsuarioHub` e as actions das Tasks 6–10
- Produces: `<ContasCard usuarios={UsuarioHub[]} emailAtual={string} />`

- [ ] **Step 1: Escrever os testes que falham**

```tsx
// app/admin/acessos/__tests__/_contas.test.tsx
import { render, screen } from '@testing-library/react'
import ContasCard from '../_contas'

jest.mock('../../_actions', () => ({
  alterarNivelAction: jest.fn(),
  removerUsuarioAction: jest.fn(),
  reenviarConviteAction: jest.fn(),
  cancelarConviteAction: jest.fn(),
  enviarResetSenhaAction: jest.fn(),
  convidarUsuarioAction: jest.fn(),
}))

const usuarios = [
  {
    id: '1',
    email: 'ana@manfac.com.br',
    nome: 'Ana Souza',
    nivel: 'analista' as const,
    ultimoAcesso: '2026-07-03T13:52:00Z',
    convitePendente: false,
  },
  {
    id: '2',
    email: 'suporte@manfac.com.br',
    nome: null,
    nivel: 'analista' as const,
    ultimoAcesso: null,
    convitePendente: true,
  },
]

describe('ContasCard', () => {
  it('shows the name above the email', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="chefe@manfac.com.br" />)
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('ana@manfac.com.br')).toBeInTheDocument()
  })

  it('shows the pending invite chip instead of a date', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="chefe@manfac.com.br" />)
    expect(screen.getByText('Convite pendente')).toBeInTheDocument()
  })

  it('formats the last access in pt-BR', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="chefe@manfac.com.br" />)
    expect(screen.getByText(/3 de julho de 2026/)).toBeInTheDocument()
  })

  it('marks your own row and disables its actions', () => {
    render(<ContasCard usuarios={usuarios} emailAtual="ana@manfac.com.br" />)
    expect(screen.getByText('você')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/admin/acessos`
Expected: FAIL — módulo `../_contas` não existe

- [ ] **Step 3: Implementar o componente**

`'use client'`. Estado local para busca e filtro de nível. Estrutura, seguindo o mockup aprovado:

- Cabeçalho: título "Conta", texto "Por motivos de segurança, os links de convite expiram após 24 horas." e botão laranja "Adicionar novo usuário".
- Controles: input de busca (`placeholder="Pesquisar usuários..."`) e `<select>` de nível com as opções Todos / Analista / Administrador.
- Filtro em memória: `usuarios.filter(u => (u.nome ?? '').toLowerCase().includes(busca) || u.email.includes(busca))`, mais o filtro de nível.
- Tabela com as colunas Nome, Nível, Ativo pela última vez e a coluna do menu.
- Data via `new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })`.
- Pill de nível: administrador em laranja, analista em cinza-azulado.
- Menu `⋮`: promover/rebaixar, redefinir senha, remover. Para `convitePendente`, apenas reenviar e cancelar. Quando `u.email === emailAtual`, os itens de nível e remoção ficam `disabled` com a explicação "Você não pode rebaixar nem remover a si mesmo."
- Cada ação chama a Server Action correspondente e exibe o `error` retornado numa faixa vermelha acima da tabela.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/admin/acessos`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/acessos/_contas.tsx app/admin/acessos/__tests__/_contas.test.tsx
git commit -m "feat(admin): card de contas com busca, filtro e ações por usuário"
```

---

### Task 12: Diálogos de convidar e remover

**Files:**
- Create: `app/admin/_dialogs.tsx`
- Modify: `app/admin/acessos/_contas.tsx` (passa a usar os diálogos)

**Interfaces:**
- Produces:
  - `<ConvidarDialog aberto onFechar sistemas={{slug,label}[]} />`
  - `<RemoverDialog aberto onFechar usuario={{email, nome}} />`

- [ ] **Step 1: Escrever os testes que falham**

```tsx
it('keeps the remove button disabled until "deletar" is typed', async () => {
  render(<RemoverDialog aberto usuario={{ email: 'ana@manfac.com.br', nome: 'Ana' }} onFechar={jest.fn()} />)
  const botao = screen.getByRole('button', { name: /remover do hub/i })
  expect(botao).toBeDisabled()

  await userEvent.type(screen.getByLabelText(/digite/i), 'deletar')
  expect(botao).toBeEnabled()
})

it('does not enable the button for a different word', async () => {
  render(<RemoverDialog aberto usuario={{ email: 'ana@manfac.com.br', nome: 'Ana' }} onFechar={jest.fn()} />)
  await userEvent.type(screen.getByLabelText(/digite/i), 'apagar')
  expect(screen.getByRole('button', { name: /remover do hub/i })).toBeDisabled()
})

it('offers both levels in the invite dialog', () => {
  render(<ConvidarDialog aberto sistemas={[{ slug: 'sofia', label: 'Gestão de Frotas' }]} onFechar={jest.fn()} />)
  expect(screen.getByRole('option', { name: 'Analista' })).toBeInTheDocument()
  expect(screen.getByRole('option', { name: 'Administrador' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/admin`
Expected: FAIL

- [ ] **Step 3: Implementar**

`ConvidarDialog`: campo de e-mail, `<select>` de nível com as duas opções, um toggle por sistema, botões Cancelar e "Enviar convite". Ao enviar, chama `convidarUsuarioAction(email, nivel, sistemasLigados)`.

`RemoverDialog`: texto explicando que a conta será apagada e que o histórico registrado nos sistemas é preservado; campo de confirmação cujo `label` é "Digite deletar para confirmar"; botão "Remover do hub" habilitado apenas quando `valor.trim().toLowerCase() === 'deletar'`. Ao confirmar, chama `removerUsuarioAction(email)`.

Ambos respeitam o tema e fecham via `onFechar`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/admin`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/_dialogs.tsx app/admin/acessos/_contas.tsx
git commit -m "feat(admin): diálogos de convite e de remoção com confirmação por palavra"
```

---

### Task 13: Card "Funções"

**Files:**
- Modify: `app/admin/acessos/_table.tsx`
- Modify: `app/admin/acessos/page.tsx`

**Interfaces:**
- Consumes: `UsuarioHub` (Task 6), `alternarAcessoAction` (Task 10)
- Produces: `<AcessosTable usuarios={UsuarioHub[]} sistemas={{slug,label}[]} acessos={Acesso[]} />`

- [ ] **Step 1: Escrever o teste que falha**

```tsx
it('shows the full-access label instead of toggles for administrators', () => {
  render(
    <AcessosTable
      usuarios={[{ id: '1', email: 'chefe@manfac.com.br', nome: null, nivel: 'administrador', ultimoAcesso: null, convitePendente: false }]}
      sistemas={[{ slug: 'sofia', label: 'Gestão de Frotas' }]}
      acessos={[]}
    />
  )
  expect(screen.getByText(/administrador acessa todos os sistemas/i)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Gestão de Frotas/ })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/admin/acessos`
Expected: FAIL

- [ ] **Step 3: Implementar**

Reescrever `_table.tsx` da grade atual para uma lista de linhas — uma por usuário — como no mockup: nome e e-mail à esquerda, toggles à direita. Quando `usuario.nivel === 'administrador'`, no lugar dos toggles vai o texto "Administrador acessa todos os sistemas" com ícone de cadeado. Manter o comportamento otimista já existente (estado local, `salvando`, faixa de erro).

Em `page.tsx`, compor os dois cards:

```tsx
export default async function AcessosPage() {
  const usuarios = await listarUsuariosAction()
  if ('error' in usuarios) return <div className="p-8 text-red-300 text-sm">{usuarios.error}</div>

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: acessos } = await supabase
    .from('hub_system_access')
    .select('user_email, system_slug, has_access')

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-white">Usuários</h1>
      <ContasCard usuarios={usuarios} emailAtual={user?.email ?? ''} />
      <AcessosTable usuarios={usuarios} sistemas={SISTEMAS} acessos={acessos ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest app/admin && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/admin/acessos/_table.tsx app/admin/acessos/page.tsx
git commit -m "feat(admin): card de funções por usuário, sem toggles para administrador"
```

---

### Task 14: Dashboard por nível

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Test: `app/(dashboard)/dashboard/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `isAdmin` (Task 2), `hasSystemAccess` (Task 3)
- Produces: nenhum símbolo novo

- [ ] **Step 1: Escrever os testes que falham**

```tsx
jest.mock('@/lib/auth/roles', () => ({ isAdmin: jest.fn() }))
jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))

it('shows all three cards for an administrator', async () => {
  ;(isAdmin as jest.Mock).mockResolvedValue(true)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
  render(await DashboardPage())
  expect(screen.getByText('Gestão de Frotas')).toBeInTheDocument()
  expect(screen.getByText('Conversor OS')).toBeInTheDocument()
  expect(screen.getByText('Admin')).toBeInTheDocument()
})

it('hides systems the analyst cannot open', async () => {
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockImplementation(async (_c, _e, slug) => slug === 'conversor-os')
  render(await DashboardPage())
  expect(screen.queryByText('Gestão de Frotas')).not.toBeInTheDocument()
  expect(screen.getByText('Conversor OS')).toBeInTheDocument()
  expect(screen.queryByText('Admin')).not.toBeInTheDocument()
})

it('explains itself when the user has no system at all', async () => {
  ;(isAdmin as jest.Mock).mockResolvedValue(false)
  ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
  render(await DashboardPage())
  expect(screen.getByText(/nenhum sistema liberado/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest app/\(dashboard\)`
Expected: FAIL

- [ ] **Step 3: Implementar**

```tsx
const admin = await isAdmin(supabase, user.email ?? '')
const podeFrotas = await hasSystemAccess(supabase, user.email ?? '', 'sofia')
const podeConversor = await hasSystemAccess(supabase, user.email ?? '', 'conversor-os')
const semNada = !podeFrotas && !podeConversor && !admin
```

Envolver cada `<Link>` na condição correspondente (`{podeFrotas && ...}`, `{podeConversor && ...}`, `{admin && ...}`) e, quando `semNada`, renderizar no lugar da grade:

```tsx
<p className="text-[#94a3b8] text-center">
  Você ainda não tem nenhum sistema liberado. Fale com um administrador do hub.
</p>
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test`
Expected: PASS, suite inteira verde

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx" "app/(dashboard)/dashboard/__tests__/page.test.tsx"
git commit -m "feat(hub): dashboard mostra apenas os sistemas que a pessoa pode abrir"
```

---

### Task 15: Verificação final e deploy

**Files:** nenhum novo

- [ ] **Step 1: Suite completa e build**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```
Expected: tudo verde. Não seguir com nada vermelho.

- [ ] **Step 2: Conferir que a lista fixa sumiu**

```bash
grep -rn "isAdminEmail\|lib/auth/admins" app lib middleware.ts
```
Expected: nenhum resultado.

- [ ] **Step 3: Confirmar que o SQL da Task 1 já rodou**

No SQL Editor do Supabase:

```sql
SELECT nivel, count(*) FROM hub_user_roles GROUP BY nivel;
```

Expected: pelo menos um `administrador`. **Se a tabela não existir ou vier sem administrador, PARE e rode a Task 1 antes de deployar** — o hub subiria sem administrador nenhum e ninguém conseguiria abrir `/admin/acessos` para consertar.

- [ ] **Step 4: Push e deploy**

```bash
git push origin master
```

Acompanhar o build no EasyPanel. Há histórico de lag entre push e build — conferir o timestamp em Deployments antes de concluir que algo não funcionou.

- [ ] **Step 5: Verificação em produção**

Logado como administrador em `https://hub.manfac.com.br`:

1. `/admin` redireciona para `/admin/acessos`
2. A lista mostra nome, nível e último acesso
3. A busca e o filtro por nível funcionam
4. Promover e rebaixar alguém funciona; tentar em si mesmo aparece bloqueado
5. Convidar um e-mail de teste `@manfac.com.br` dispara o e-mail
6. Remover só habilita depois de digitar `deletar`
7. Os toggles do card Funções continuam salvando
8. O dashboard de um analista mostra apenas os sistemas dele

---

## Self-Review

**Cobertura da spec:**

| Requisito da spec | Task |
|---|---|
| Tabela `hub_user_roles` + RLS restritiva | 1 |
| Correção do RLS de `hub_system_access` | 1 |
| Migração dos administradores atuais | 1 |
| `lib/auth/roles.ts` | 2 |
| `systemAccess` e `requireAdmin` pelo banco | 3 |
| Os 20 call sites + deletar `admins.ts` | 4 |
| Client de service role com erro claro | 5 |
| Listagem com nome, nível, último acesso, convite | 6 |
| Fim do teto de 50 usuários | 6 |
| Promover/rebaixar + invariantes | 7 |
| Remover + invariantes + limpeza de linhas | 8 |
| Convidar com nível e sistemas + guarda de domínio | 9 |
| Reenviar/cancelar convite, redefinir senha | 10 |
| `alternarAcessoAction` com service role | 10 |
| Card Conta: busca, filtro, menu de ações | 11 |
| Diálogos com dropdown de nível e palavra `deletar` | 12 |
| Card Funções por usuário, admin sem toggles | 13 |
| Dashboard por acesso real | 14 |
| Ordem obrigatória SQL antes do deploy | 1, 15 |

Sem lacunas.

**Consistência de tipos:** `Nivel` é definido na Task 2 e usado nas Tasks 6–13. `UsuarioHub` é definido na Task 6 e consumido nas Tasks 11 e 13. `createAdminClient` é definido na Task 5 e usado nas Tasks 6–10. `normalizarEmail` é exportado na Task 2 e usado nas Tasks 6–10. `acharUsuarioPorEmail` é criado na Task 8 e refatorado na Task 10 para devolver `confirmed_at` — a Task 10 diz isso explicitamente.

**Riscos conhecidos:** a Task 4 deixa `app/admin/__tests__/_actions.test.ts` vermelho de propósito até a Task 6. Isso está escrito no passo correspondente para não parecer regressão.
