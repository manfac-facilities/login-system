# Multas + Descontos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved spec `docs/superpowers/specs/2026-06-24-multas-descontos-design.md` — new `data_recebimento`/`tipo_infracao` fields on Multas, a centralized Descontos screen for both Multas and Sinistros, bulk select/delete on Multas restricted to admins, and an `audit_log` table covering creation/deletion of multas.

**Architecture:** Schema migration first (Task 1, manual). Then shared building blocks — types, the fixed infraction list, the admin-email check (Task 2). Then the Multas creation flow rework with audit logging (Task 3). Then the new Descontos module absorbs all desconto-mutation actions out of Multas/Sinistros, with the entity pages simplified to read-only indicators (Task 4). Then Multas gets bulk-select + admin-only delete via a server/client component split (Task 5). Final regression pass (Task 6).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (`@supabase/ssr`), Jest.

## Global Constraints

- Repo `manfac-facilities/login-system`, branch `master`. Module lives under `app/(operacoes)/sofia/`.
- Server actions follow the existing project convention: `'use server'` files named `_actions.ts`; `useActionState`-bound actions return `State = { error?: string; success?: boolean }`; `.bind(null, ...)`-bound or directly-invoked actions are `Promise<void>` / throw on error.
- `isAdminEmail` lives in `lib/auth/admins.ts`, hardcoded list of exactly 3 e-mails (per spec section 6) — no configurable roles.
- Exclusion is a hard delete with no undo; the only record of the deleted row is the `audit_log` snapshot (per spec, "Fora de escopo").
- Audit logging in this frente covers only `criacao` and `exclusao` of `multas` — no `UPDATE` logging (per spec, "Fora de escopo").
- Task 1 (SQL migration) is run manually by the user/controller in the Supabase SQL Editor (project `iyytcavcgukfjnjjrerx`) — do **not** delegate this task to a subagent, and do not run it via an automated migration tool. Confirm completion before starting Task 2.
- No new query helper is added to `lib/sofia/queries.ts` for Descontos — the new `descontos/page.tsx` queries `multas`/`sinistros` directly, matching `multas/page.tsx`'s existing direct-query style.

---

### Task 1: SQL migration

**Files:**
- Create: `sdd-sql-passo4.sql` (kept as a record in the repo root, matching the existing `sdd-sql-passo1.sql`/`passo2.sql`/`passo3.sql` convention)

**Interfaces:**
- Consumes: existing `multas`, `sinistros`, `motorista_documentos` tables (`sdd-sql-passo3.sql`).
- Produces: `multas.data_recebimento` (date, nullable), `multas.tipo_infracao` (text, nullable), `multas.descricao` (now nullable), `sinistros.status_desconto` (text, not null, default `'pendente'`), new table `public.audit_log` (`id`, `tabela`, `registro_id`, `acao`, `dados`, `usuario_email`, `created_at`), `motorista_documentos_multa_id_fkey` redefined with `ON DELETE SET NULL`. All later tasks' code assumes these exist.

- [ ] **Step 1: Write the migration SQL**

```sql
-- sdd-sql-passo4.sql
-- Multas + Descontos: novos campos, audit_log, ajuste de FK

alter table public.multas
  add column data_recebimento date,
  add column tipo_infracao text,
  alter column descricao drop not null;

alter table public.sinistros
  add column status_desconto text not null default 'pendente';

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('criacao', 'exclusao')),
  dados jsonb not null,
  usuario_email text,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
create policy "authenticated full access" on public.audit_log
  for all to authenticated using (true) with check (true);

alter table public.motorista_documentos
  drop constraint motorista_documentos_multa_id_fkey,
  add constraint motorista_documentos_multa_id_fkey
    foreign key (multa_id) references public.multas(id) on delete set null;
```

- [ ] **Step 2: Run it in the Supabase SQL Editor**

Open the SQL Editor for project `iyytcavcgukfjnjjrerx` and run the contents of `sdd-sql-passo4.sql` in full.

- [ ] **Step 3: Verify**

Run this confirmation query in the same SQL Editor:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'multas' and column_name in ('data_recebimento', 'tipo_infracao', 'descricao')
union all
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'sinistros' and column_name = 'status_desconto';
```

Expected: 4 rows — `data_recebimento` (date, YES), `tipo_infracao` (text, YES), `descricao` (text, YES — now nullable), `status_desconto` (text, NO).

Also confirm `audit_log` exists: `select * from public.audit_log limit 1;` should return an empty result with no error.

- [ ] **Step 4: Commit**

```bash
git add sdd-sql-passo4.sql
git commit -m "feat: add multas/sinistros desconto fields, audit_log table, FK fix"
```

---

### Task 2: Shared building blocks — types, infraction list, admin check

**Files:**
- Modify: `lib/sofia/types.ts`
- Create: `lib/sofia/multas.ts`
- Create: `lib/auth/admins.ts`
- Test: `lib/auth/__tests__/admins.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Multa.data_recebimento: string | null`, `Multa.tipo_infracao: string | null`, `Sinistro.status_desconto: MultaStatus`, `AuditAcao = 'criacao' | 'exclusao'`, `AuditLog` interface, `TIPOS_INFRACAO: readonly string[]` from `lib/sofia/multas.ts`, `isAdminEmail(email: string): boolean` from `lib/auth/admins.ts`. Tasks 3, 4, 5 import all of these.

- [ ] **Step 1: Write the failing test for `isAdminEmail`**

```ts
// lib/auth/__tests__/admins.test.ts
import { isAdminEmail } from '../admins'

describe('isAdminEmail', () => {
  it('accepts an email in the admin list', () => {
    expect(isAdminEmail('ewerton.silva@manfac.com.br')).toBe(true)
  })

  it('accepts the owner exception email', () => {
    expect(isAdminEmail('jvictorco28@gmail.com')).toBe(true)
  })

  it('rejects an email not in the admin list', () => {
    expect(isAdminEmail('outro.usuario@manfac.com.br')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isAdminEmail('EWERTON.SILVA@MANFAC.COM.BR')).toBe(true)
  })

  it('trims surrounding whitespace', () => {
    expect(isAdminEmail('  jose.guilherme@manfac.com.br  ')).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(isAdminEmail('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/auth/__tests__/admins.test.ts`
Expected: FAIL — `Cannot find module '../admins'`

- [ ] **Step 3: Implement `lib/auth/admins.ts`**

```ts
// lib/auth/admins.ts
const ADMIN_EMAILS = [
  'ewerton.silva@manfac.com.br',
  'jose.guilherme@manfac.com.br',
  'jvictorco28@gmail.com',
]

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/auth/__tests__/admins.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Add `TIPOS_INFRACAO`**

```ts
// lib/sofia/multas.ts
export const TIPOS_INFRACAO = [
  'Excesso de velocidade',
  'Avanço de sinal vermelho',
  'Estacionamento irregular',
  'Uso de celular ao dirigir',
  'Não uso de cinto de segurança',
  'Ultrapassagem proibida',
  'Embriaguez ao volante',
  'Trafegar na contramão',
  'Não respeitar faixa de pedestre',
  'Estacionamento em vaga reservada sem credencial',
  'CNH vencida ou ausente',
  'Documento do veículo vencido',
  'Falta de pagamento de pedágio/tag',
] as const
```

- [ ] **Step 6: Add the new `Multa`/`Sinistro` fields and `AuditLog` type**

In `lib/sofia/types.ts`, replace the existing `Multa` interface (currently lines 110-125) with (adds `data_recebimento` and `tipo_infracao` after `data`; changes `descricao` to nullable; every other field unchanged):

```ts
export interface Multa {
  id: string
  veiculo_id: string | null
  motorista_id: string | null
  data: string
  data_recebimento: string | null
  tipo_infracao: string | null
  descricao: string | null
  valor: number
  valor_descontado: number | null
  tipo_desconto: TipoDesconto
  status: MultaStatus
  autorizacao_assinada: boolean
  autorizacao_storage_path: string | null
  ziv_task_id: string | null
  observacoes: string | null
  created_at: string
}
```

Replace the existing `Sinistro` interface (currently lines 127-142) with (adds `status_desconto` after `status`; every other field unchanged):

```ts
export interface Sinistro {
  id: string
  veiculo_id: string | null
  motorista_id: string | null
  data: string
  tipo: SinistroTipo
  descricao: string
  valor_dano: number | null
  valor_descontado: number | null
  tipo_desconto: TipoDesconto
  autorizacao_assinada: boolean
  autorizacao_storage_path: string | null
  status: SinistroStatus
  status_desconto: MultaStatus
  observacoes: string | null
  created_at: string
}
```

At the end of `lib/sofia/types.ts`, add:

```ts
export type AuditAcao = 'criacao' | 'exclusao'

export interface AuditLog {
  id: string
  tabela: string
  registro_id: string
  acao: AuditAcao
  dados: Record<string, unknown>
  usuario_email: string | null
  created_at: string
}
```

- [ ] **Step 7: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors (any pre-existing errors are out of scope for this task).

- [ ] **Step 8: Commit**

```bash
git add lib/auth/admins.ts lib/auth/__tests__/admins.test.ts lib/sofia/multas.ts lib/sofia/types.ts
git commit -m "feat: add admin-email check, infraction list, and desconto/audit types"
```

---

### Task 3: Rework Multa creation — new fields + audit log

**Files:**
- Create: `lib/sofia/auditLog.ts`
- Test: `lib/sofia/__tests__/auditLog.test.ts`
- Modify: `app/(operacoes)/sofia/multas/_actions.ts`
- Modify: `app/(operacoes)/sofia/multas/nova/_form.tsx`
- Modify: `app/(operacoes)/sofia/multas/page.tsx`
- Modify: `app/(operacoes)/sofia/multas/__tests__/_actions.test.ts`

**Interfaces:**
- Consumes: `AuditAcao`/`AuditLog` types and `TIPOS_INFRACAO` from Task 2.
- Produces: `registrarAuditoria(supabase, params): Promise<void>` from `lib/sofia/auditLog.ts` — consumed directly by Task 5's delete actions. `criarMultaAction` keeps its existing signature (`State, FormData) => Promise<State>`); `atualizarStatusMultaAction`/`registrarDescontoMultaAction` remain in this file for now (Task 4 moves them out).

- [ ] **Step 1: Write the failing test for `registrarAuditoria`**

```ts
// lib/sofia/__tests__/auditLog.test.ts
import { registrarAuditoria } from '../auditLog'

describe('registrarAuditoria', () => {
  it('inserts a row with the given fields', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: null })
    const supabase = { from: jest.fn(() => ({ insert: insertMock })) } as unknown as Parameters<
      typeof registrarAuditoria
    >[0]

    await registrarAuditoria(supabase, {
      tabela: 'multas',
      registro_id: 'multa-1',
      acao: 'criacao',
      dados: { id: 'multa-1', valor: 100 },
      usuario_email: 'joao@manfac.com.br',
    })

    expect(supabase.from).toHaveBeenCalledWith('audit_log')
    expect(insertMock).toHaveBeenCalledWith({
      tabela: 'multas',
      registro_id: 'multa-1',
      acao: 'criacao',
      dados: { id: 'multa-1', valor: 100 },
      usuario_email: 'joao@manfac.com.br',
    })
  })

  it('throws when the insert fails', async () => {
    const insertMock = jest.fn().mockResolvedValue({ error: new Error('db error') })
    const supabase = { from: jest.fn(() => ({ insert: insertMock })) } as unknown as Parameters<
      typeof registrarAuditoria
    >[0]

    await expect(
      registrarAuditoria(supabase, {
        tabela: 'multas',
        registro_id: 'multa-1',
        acao: 'exclusao',
        dados: {},
        usuario_email: null,
      })
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/sofia/__tests__/auditLog.test.ts`
Expected: FAIL — `Cannot find module '../auditLog'`

- [ ] **Step 3: Implement `lib/sofia/auditLog.ts`**

```ts
// lib/sofia/auditLog.ts
import { createClient } from '@/lib/supabase/server'
import type { AuditAcao } from './types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export interface RegistrarAuditoriaParams {
  tabela: string
  registro_id: string
  acao: AuditAcao
  dados: Record<string, unknown>
  usuario_email: string | null
}

export async function registrarAuditoria(
  supabase: SupabaseServerClient,
  params: RegistrarAuditoriaParams
): Promise<void> {
  const { error } = await supabase.from('audit_log').insert(params)
  if (error) throw error
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/sofia/__tests__/auditLog.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: Write the failing test for the reworked `criarMultaAction`**

Replace the full contents of `app/(operacoes)/sofia/multas/__tests__/_actions.test.ts` with:

```ts
// app/(operacoes)/sofia/multas/__tests__/_actions.test.ts
const getUserMock = jest.fn()
const auditInsertMock = jest.fn()
const multaInsertMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn((table: string) => {
      if (table === 'audit_log') return { insert: auditInsertMock }
      return {
        insert: jest.fn(() => ({ select: jest.fn(() => ({ single: multaInsertMock })) })),
      }
    }),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { criarMultaAction } from '../_actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    veiculo_id: '',
    motorista_id: '',
    data: '2026-06-01',
    data_recebimento: '2026-06-05',
    tipo_infracao: 'Excesso de velocidade',
    tipo_infracao_outra: '',
    descricao: '',
    valor: '195.23',
    observacoes: '',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const ADMIN_EMAIL = 'jvictorco28@gmail.com'

describe('criarMultaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    multaInsertMock.mockReset()
    multaInsertMock.mockResolvedValue({ data: { id: 'multa-1', valor: 195.23 }, error: null })
  })

  it('accepts a multa with valor 0 instead of rejecting it as missing (falsy-zero regression)', async () => {
    const result = await criarMultaAction({}, buildFormData({ valor: '0' }))

    expect(result).toEqual({ success: true })
  })

  it('still rejects when valor is left blank', async () => {
    const result = await criarMultaAction({}, buildFormData({ valor: '' }))

    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('rejects when tipo_infracao is missing', async () => {
    const result = await criarMultaAction({}, buildFormData({ tipo_infracao: '' }))

    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('rejects when data_recebimento is missing', async () => {
    const result = await criarMultaAction({}, buildFormData({ data_recebimento: '' }))

    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('uses the "Outra" free-text value when tipo_infracao is "outra"', async () => {
    const result = await criarMultaAction(
      {},
      buildFormData({ tipo_infracao: 'outra', tipo_infracao_outra: 'Transporte irregular de carga' })
    )

    expect(result).toEqual({ success: true })
  })

  it('registers a normal multa and logs creation in audit_log', async () => {
    const result = await criarMultaAction({}, buildFormData())

    expect(result).toEqual({ success: true })
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', acao: 'criacao' })
    )
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest app/\(operacoes\)/sofia/multas/__tests__/_actions.test.ts`
Expected: FAIL — `criarMultaAction` rejects the new required fields / doesn't call `auditInsertMock` yet (current implementation has no `tipo_infracao`/`data_recebimento` validation and no audit log call).

- [ ] **Step 7: Rework `criarMultaAction` in `app/(operacoes)/sofia/multas/_actions.ts`**

Replace the existing `criarMultaAction` function with:

```ts
export async function criarMultaAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = (formData.get('veiculo_id') as string) || null
  const motorista_id = (formData.get('motorista_id') as string) || null
  const data = formData.get('data') as string
  const data_recebimento = (formData.get('data_recebimento') as string) || ''
  const tipoInfracaoSelect = ((formData.get('tipo_infracao') as string) ?? '').trim()
  const tipoInfracaoOutra = ((formData.get('tipo_infracao_outra') as string) ?? '').trim()
  const tipo_infracao = tipoInfracaoSelect === 'outra' ? tipoInfracaoOutra : tipoInfracaoSelect
  const descricao = ((formData.get('descricao') as string) ?? '').trim() || null
  const valorRaw = formData.get('valor') as string
  const valor = Number(valorRaw)
  const observacoes = ((formData.get('observacoes') as string) ?? '').trim() || null

  if (!data || !data_recebimento || !tipo_infracao || valorRaw === '' || Number.isNaN(valor))
    return { error: 'Data, data de recebimento, tipo de infração e valor são obrigatórios' }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('multas')
    .insert({ veiculo_id, motorista_id, data, data_recebimento, tipo_infracao, descricao, valor, observacoes })
    .select()
    .single()

  if (error) return { error: 'Erro ao registrar multa' }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await registrarAuditoria(supabase, {
    tabela: 'multas',
    registro_id: row.id,
    acao: 'criacao',
    dados: row,
    usuario_email: user?.email ?? null,
  })

  revalidatePath('/sofia/multas')
  return { success: true }
}
```

Add the import at the top of the file (alongside the existing `createClient`/`revalidatePath` imports):

```ts
import { registrarAuditoria } from '@/lib/sofia/auditLog'
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest app/\(operacoes\)/sofia/multas/__tests__/_actions.test.ts`
Expected: PASS (6/6)

- [ ] **Step 9: Rework `app/(operacoes)/sofia/multas/nova/_form.tsx`**

Replace the file's full contents with:

```tsx
'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { criarMultaAction } from '../_actions'
import { TIPOS_INFRACAO } from '@/lib/sofia/multas'
import type { Veiculo, Motorista } from '@/lib/sofia/types'

export default function NovaMultaForm({
  veiculos,
  motoristas,
}: {
  veiculos: Veiculo[]
  motoristas: Motorista[]
}) {
  const [state, action, isPending] = useActionState(criarMultaAction, {})
  const [tipoInfracao, setTipoInfracao] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/multas')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar Multa</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        Infração de trânsito vinculada a veículo/motorista
      </p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Data da infração *</label>
            <input
              name="data"
              type="date"
              required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Data de recebimento *</label>
            <input
              name="data_recebimento"
              type="date"
              required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Veículo</label>
          <select
            name="veiculo_id"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          >
            <option value="">Selecione</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} · {v.modelo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Motorista responsável</label>
          <select
            name="motorista_id"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          >
            <option value="">Selecione</option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Tipo de infração *</label>
          <select
            name="tipo_infracao"
            required
            value={tipoInfracao}
            onChange={(e) => setTipoInfracao(e.target.value)}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          >
            <option value="">Selecione</option>
            {TIPOS_INFRACAO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
            <option value="outra">Outra</option>
          </select>
        </div>

        {tipoInfracao === 'outra' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Especifique a infração *</label>
            <input
              name="tipo_infracao_outra"
              required
              placeholder="Ex: Transporte de carga sem autorização"
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Detalhes adicionais</label>
          <textarea
            name="descricao"
            rows={2}
            placeholder="Ex: Excesso de velocidade 70km/h em 50km/h"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor (R$) *</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            required
            placeholder="195.23"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea
            name="observacoes"
            rows={2}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
          />
        </div>

        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Salvando...' : 'Registrar Multa'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 10: Add the two read-only columns to `app/(operacoes)/sofia/multas/page.tsx`**

The current `<thead>` row (lines 63-70) is:

```tsx
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
<th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Desconto</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
<th className="px-4 py-3"></th>
```

Replace it with (adds "Data de recebimento" after "Data", and "Tipo de infração" before "Descrição"):

```tsx
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data de recebimento</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo de infração</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
<th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Desconto</th>
<th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
<th className="px-4 py-3"></th>
```

The current `<tbody>` row's first 4 cells (lines 79-86) are:

```tsx
<td className="px-4 py-3 text-[#94a3b8]">
  {new Date(m.data).toLocaleDateString('pt-BR')}
</td>
<td className="px-4 py-3 text-[#94a3b8] font-mono">
  {m.veiculos?.placa ?? '—'}
</td>
<td className="px-4 py-3 text-[#94a3b8]">{m.motoristas?.nome ?? '—'}</td>
<td className="px-4 py-3 text-white">{m.descricao}</td>
```

Replace them with:

```tsx
<td className="px-4 py-3 text-[#94a3b8]">
  {new Date(m.data).toLocaleDateString('pt-BR')}
</td>
<td className="px-4 py-3 text-[#94a3b8]">
  {m.data_recebimento ? new Date(m.data_recebimento).toLocaleDateString('pt-BR') : '—'}
</td>
<td className="px-4 py-3 text-[#94a3b8] font-mono">
  {m.veiculos?.placa ?? '—'}
</td>
<td className="px-4 py-3 text-[#94a3b8]">{m.motoristas?.nome ?? '—'}</td>
<td className="px-4 py-3 text-white">{m.tipo_infracao ?? '—'}</td>
<td className="px-4 py-3 text-white">{m.descricao ?? '—'}</td>
```

(`descricao` is now nullable per Task 1's migration, hence the `?? '—'` fallback added here too.)

Update the empty-state row (line 148) from `colSpan={8}` to `colSpan={10}` (8 existing columns + 2 new ones):

```tsx
<td colSpan={10} className="px-4 py-12 text-center text-[#4a6080]">
```

- [ ] **Step 11: Run the full test suite and type-check**

Run: `npx jest && npx tsc --noEmit`
Expected: all tests pass, no new type errors.

- [ ] **Step 12: Commit**

```bash
git add lib/sofia/auditLog.ts lib/sofia/__tests__/auditLog.test.ts app/\(operacoes\)/sofia/multas/_actions.ts app/\(operacoes\)/sofia/multas/nova/_form.tsx app/\(operacoes\)/sofia/multas/page.tsx app/\(operacoes\)/sofia/multas/__tests__/_actions.test.ts
git commit -m "feat: capture tipo_infracao/data_recebimento on multa creation, log to audit_log"
```

---

### Task 4: Centralize Descontos — new module, simplify Multas/Sinistros

**Files:**
- Create: `app/(operacoes)/sofia/descontos/_actions.ts`
- Create: `app/(operacoes)/sofia/descontos/page.tsx`
- Test: `app/(operacoes)/sofia/descontos/__tests__/_actions.test.ts`
- Modify: `app/(operacoes)/sofia/multas/_actions.ts` (remove `atualizarStatusMultaAction`, `registrarDescontoMultaAction`)
- Modify: `app/(operacoes)/sofia/multas/page.tsx` (remove the embedded desconto form/status-advance button)
- Modify: `app/(operacoes)/sofia/sinistros/_actions.ts` (slim `atualizarTratativaSinistroAction`)
- Modify: `app/(operacoes)/sofia/sinistros/[id]/_form.tsx` (remove desconto fields from `TratativaForm`)
- Test: `app/(operacoes)/sofia/sinistros/__tests__/_actions.test.ts` (new file)
- Modify: `components/sofia/Sidebar.tsx` (add nav item)

**Interfaces:**
- Consumes: `Multa`, `Sinistro`, `MultaStatus` types from `lib/sofia/types.ts` (Task 2).
- Produces: `atualizarStatusMultaAction(id: string, status: string): Promise<void>`, `registrarDescontoMultaAction(formData: FormData): Promise<void>`, `desfazerDescontoMultaAction(id: string): Promise<void>`, `atualizarStatusDescontoSinistroAction(id: string, status: string): Promise<void>`, `registrarDescontoSinistroAction(formData: FormData): Promise<void>`, `desfazerDescontoSinistroAction(id: string): Promise<void>` — all from `app/(operacoes)/sofia/descontos/_actions.ts`. Task 5 does not consume any of these (it only adds bulk-send/delete to Multas).

- [ ] **Step 1: Write the failing test for the Descontos actions**

```ts
// app/(operacoes)/sofia/descontos/__tests__/_actions.test.ts
const updateMock = jest.fn()
const eqMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      update: updateMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import {
  atualizarStatusMultaAction,
  registrarDescontoMultaAction,
  desfazerDescontoMultaAction,
  atualizarStatusDescontoSinistroAction,
  registrarDescontoSinistroAction,
  desfazerDescontoSinistroAction,
} from '../_actions'

function buildDescontoFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    id: 'registro-1',
    valor_descontado: '100.00',
    tipo_desconto: 'parcial',
    autorizacao_assinada: 'true',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('descontos actions', () => {
  beforeEach(() => {
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
    updateMock.mockReset()
    updateMock.mockReturnValue({ eq: eqMock })
  })

  it('atualizarStatusMultaAction updates the multa status', async () => {
    await atualizarStatusMultaAction('multa-1', 'validada')
    expect(updateMock).toHaveBeenCalledWith({ status: 'validada' })
    expect(eqMock).toHaveBeenCalledWith('id', 'multa-1')
  })

  it('registrarDescontoMultaAction sets status to descontada', async () => {
    await registrarDescontoMultaAction(buildDescontoFormData())
    expect(updateMock).toHaveBeenCalledWith({
      valor_descontado: 100,
      tipo_desconto: 'parcial',
      autorizacao_assinada: true,
      status: 'descontada',
    })
  })

  it('desfazerDescontoMultaAction reverts status to validada', async () => {
    await desfazerDescontoMultaAction('multa-1')
    expect(updateMock).toHaveBeenCalledWith({ status: 'validada' })
  })

  it('atualizarStatusDescontoSinistroAction updates status_desconto', async () => {
    await atualizarStatusDescontoSinistroAction('sinistro-1', 'validada')
    expect(updateMock).toHaveBeenCalledWith({ status_desconto: 'validada' })
    expect(eqMock).toHaveBeenCalledWith('id', 'sinistro-1')
  })

  it('registrarDescontoSinistroAction sets status_desconto to descontada', async () => {
    await registrarDescontoSinistroAction(buildDescontoFormData({ id: 'sinistro-1' }))
    expect(updateMock).toHaveBeenCalledWith({
      valor_descontado: 100,
      tipo_desconto: 'parcial',
      autorizacao_assinada: true,
      status_desconto: 'descontada',
    })
  })

  it('desfazerDescontoSinistroAction reverts status_desconto to validada', async () => {
    await desfazerDescontoSinistroAction('sinistro-1')
    expect(updateMock).toHaveBeenCalledWith({ status_desconto: 'validada' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/\(operacoes\)/sofia/descontos/__tests__/_actions.test.ts`
Expected: FAIL — `Cannot find module '../_actions'`

- [ ] **Step 3: Implement `app/(operacoes)/sofia/descontos/_actions.ts`**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function parseDescontoFormData(formData: FormData) {
  const id = formData.get('id') as string
  const valor_descontado = Number(formData.get('valor_descontado'))
  const tipo_desconto = formData.get('tipo_desconto') as string
  const autorizacao_assinada = formData.get('autorizacao_assinada') === 'true'
  return { id, valor_descontado, tipo_desconto, autorizacao_assinada }
}

export async function atualizarStatusMultaAction(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('multas').update({ status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function registrarDescontoMultaAction(formData: FormData): Promise<void> {
  const { id, valor_descontado, tipo_desconto, autorizacao_assinada } = parseDescontoFormData(formData)

  const supabase = await createClient()
  const { error } = await supabase
    .from('multas')
    .update({ valor_descontado, tipo_desconto, autorizacao_assinada, status: 'descontada' })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function desfazerDescontoMultaAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('multas').update({ status: 'validada' }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function atualizarStatusDescontoSinistroAction(id: string, status: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('sinistros').update({ status_desconto: status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}

export async function registrarDescontoSinistroAction(formData: FormData): Promise<void> {
  const { id, valor_descontado, tipo_desconto, autorizacao_assinada } = parseDescontoFormData(formData)

  const supabase = await createClient()
  const { error } = await supabase
    .from('sinistros')
    .update({ valor_descontado, tipo_desconto, autorizacao_assinada, status_desconto: 'descontada' })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}

export async function desfazerDescontoSinistroAction(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('sinistros').update({ status_desconto: 'validada' }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/\(operacoes\)/sofia/descontos/__tests__/_actions.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Implement `app/(operacoes)/sofia/descontos/page.tsx`**

```tsx
import { createClient } from '@/lib/supabase/server'
import type { Multa, Sinistro } from '@/lib/sofia/types'
import {
  atualizarStatusMultaAction,
  registrarDescontoMultaAction,
  desfazerDescontoMultaAction,
  atualizarStatusDescontoSinistroAction,
  registrarDescontoSinistroAction,
  desfazerDescontoSinistroAction,
} from './_actions'

type LinhaDesconto = {
  origem: 'multa' | 'sinistro'
  id: string
  data: string
  veiculoPlaca: string | null
  motoristaNome: string | null
  valor: number
  status: string
  valor_descontado: number | null
  tipo_desconto: string
  autorizacao_assinada: boolean
}

const statusStyle: Record<string, string> = {
  pendente: 'bg-amber-900 text-amber-300',
  validada: 'bg-blue-900 text-blue-300',
  descontada: 'bg-green-900 text-green-300',
}

const proximoStatus: Record<string, string> = {
  pendente: 'validada',
  validada: 'descontada',
}

export default async function DescontosPage() {
  const supabase = await createClient()

  const [{ data: multas }, { data: sinistros }] = await Promise.all([
    supabase.from('multas').select('*, veiculos(placa), motoristas(nome)').order('data', { ascending: false }),
    supabase.from('sinistros').select('*, veiculos(placa), motoristas(nome)').order('data', { ascending: false }),
  ])

  const linhasMultas: LinhaDesconto[] = (multas ?? []).map(
    (m: Multa & { veiculos: { placa: string } | null; motoristas: { nome: string } | null }) => ({
      origem: 'multa',
      id: m.id,
      data: m.data,
      veiculoPlaca: m.veiculos?.placa ?? null,
      motoristaNome: m.motoristas?.nome ?? null,
      valor: m.valor,
      status: m.status,
      valor_descontado: m.valor_descontado,
      tipo_desconto: m.tipo_desconto,
      autorizacao_assinada: m.autorizacao_assinada,
    })
  )

  const linhasSinistros: LinhaDesconto[] = (sinistros ?? []).map(
    (s: Sinistro & { veiculos: { placa: string } | null; motoristas: { nome: string } | null }) => ({
      origem: 'sinistro',
      id: s.id,
      data: s.data,
      veiculoPlaca: s.veiculos?.placa ?? null,
      motoristaNome: s.motoristas?.nome ?? null,
      valor: s.valor_dano ?? 0,
      status: s.status_desconto,
      valor_descontado: s.valor_descontado,
      tipo_desconto: s.tipo_desconto,
      autorizacao_assinada: s.autorizacao_assinada,
    })
  )

  const linhas = [...linhasMultas, ...linhasSinistros].sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  )

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-8">Descontos</h1>

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Origem</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const avancarAction =
                l.origem === 'multa' ? atualizarStatusMultaAction : atualizarStatusDescontoSinistroAction
              const registrarAction =
                l.origem === 'multa' ? registrarDescontoMultaAction : registrarDescontoSinistroAction
              const desfazerAction =
                l.origem === 'multa' ? desfazerDescontoMultaAction : desfazerDescontoSinistroAction

              return (
                <tr key={`${l.origem}-${l.id}`} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-[#1e3a5f] text-[#94a3b8]">
                      {l.origem === 'multa' ? 'Multa' : 'Sinistro'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">{new Date(l.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono">{l.veiculoPlaca ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{l.motoristaNome ?? '—'}</td>
                  <td className="px-4 py-3 text-white text-right font-medium">R$ {Number(l.valor).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[l.status]}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {proximoStatus[l.status] && (
                      <form action={avancarAction.bind(null, l.id, proximoStatus[l.status])}>
                        <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors">
                          → {proximoStatus[l.status]}
                        </button>
                      </form>
                    )}
                    {l.status === 'descontada' && (
                      <form action={desfazerAction.bind(null, l.id)} className="mt-1">
                        <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors">
                          desfazer desconto
                        </button>
                      </form>
                    )}
                    {l.status === 'validada' && (
                      <details className="mt-1">
                        <summary className="text-xs text-[#f05a28] cursor-pointer hover:underline">desconto</summary>
                        <form
                          action={registrarAction}
                          className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-[#1e3a5f] bg-[#0a1628] text-left w-56"
                        >
                          <input type="hidden" name="id" value={l.id} />
                          <input
                            name="valor_descontado"
                            type="number"
                            step="0.01"
                            placeholder="Valor descontado"
                            defaultValue={l.valor_descontado ?? ''}
                            className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
                          />
                          <select
                            name="tipo_desconto"
                            defaultValue={l.tipo_desconto}
                            className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
                          >
                            <option value="nenhum">Nenhum</option>
                            <option value="parcial">Parcial</option>
                            <option value="total">Total</option>
                          </select>
                          <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                            <input
                              type="checkbox"
                              name="autorizacao_assinada"
                              value="true"
                              defaultChecked={l.autorizacao_assinada}
                              className="accent-[#f05a28]"
                            />
                            Autorização assinada
                          </label>
                          <button
                            type="submit"
                            className="py-1.5 rounded bg-[#f05a28] text-white text-xs font-medium hover:bg-[#d94e22] transition-colors"
                          >
                            Salvar
                          </button>
                        </form>
                      </details>
                    )}
                  </td>
                </tr>
              )
            })}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum lançamento de multa ou sinistro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Remove the moved actions from `app/(operacoes)/sofia/multas/_actions.ts`**

Delete the `atualizarStatusMultaAction` and `registrarDescontoMultaAction` function definitions from this file (they now live exclusively in `app/(operacoes)/sofia/descontos/_actions.ts`). Keep `criarMultaAction` as reworked in Task 3.

- [ ] **Step 7: Remove the embedded desconto UI from `app/(operacoes)/sofia/multas/page.tsx`**

Remove the `import { atualizarStatusMultaAction, registrarDescontoMultaAction } from './_actions'` line. Remove the `<form action={atualizarStatusMultaAction.bind(...)}>` block (the "→ status" button) and the `<details>...</details>` block (the embedded desconto form) from the last `<td>` of each row — that `<td>` becomes empty (`<td className="px-4 py-3"></td>`); Task 5 repopulates it with the per-row delete action.

- [ ] **Step 8: Slim `atualizarTratativaSinistroAction` in `app/(operacoes)/sofia/sinistros/_actions.ts`**

Replace the existing `atualizarTratativaSinistroAction` function with:

```ts
export async function atualizarTratativaSinistroAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  const status = formData.get('status') as string

  const supabase = await createClient()
  const { error } = await supabase.from('sinistros').update({ status }).eq('id', id)

  if (error) return { error: 'Erro ao atualizar tratativa' }
  revalidatePath('/sofia/sinistros')
  return { success: true }
}
```

Leave every other function in this file (`criarSinistroAction`, `uploadFotoSinistroAction`) untouched.

- [ ] **Step 9: Write the failing test for the slimmed action**

```ts
// app/(operacoes)/sofia/sinistros/__tests__/_actions.test.ts
const updateMock = jest.fn()
const eqMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn(() => ({
      update: updateMock,
    })),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { atualizarTratativaSinistroAction } from '../_actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    id: 'sinistro-1',
    status: 'em_tratativa',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('atualizarTratativaSinistroAction', () => {
  beforeEach(() => {
    eqMock.mockReset()
    eqMock.mockResolvedValue({ error: null })
    updateMock.mockReset()
    updateMock.mockReturnValue({ eq: eqMock })
  })

  it('updates only the case status, not the desconto fields', async () => {
    const result = await atualizarTratativaSinistroAction({}, buildFormData())

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith({ status: 'em_tratativa' })
  })
})
```

- [ ] **Step 10: Run test to verify it fails, then passes**

Run: `npx jest app/\(operacoes\)/sofia/sinistros/__tests__/_actions.test.ts`
Expected first: FAIL (file/module exists already since Step 8 already changed `_actions.ts`, but if run before Step 8 it would fail on the old payload shape). Since Step 8 precedes this step, run it now — expected: PASS (1/1).

- [ ] **Step 11: Remove desconto fields from `TratativaForm` in `app/(operacoes)/sofia/sinistros/[id]/_form.tsx`**

Replace the file's full contents with:

```tsx
'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { atualizarTratativaSinistroAction } from '../_actions'
import type { Sinistro } from '@/lib/sofia/types'

export default function TratativaForm({ sinistro }: { sinistro: Sinistro }) {
  const [state, action, isPending] = useActionState(atualizarTratativaSinistroAction, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.refresh()
  }, [state.success, router])

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={sinistro.id} />

      {state.error && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Status</label>
        <select
          name="status"
          defaultValue={sinistro.status}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="aberto">Aberto</option>
          <option value="em_tratativa">Em tratativa</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors w-fit px-6"
      >
        {isPending ? 'Salvando...' : 'Salvar tratativa'}
      </button>
    </form>
  )
}
```

- [ ] **Step 12: Add the Descontos nav item to `components/sofia/Sidebar.tsx`**

In the `'Ocorrências'` section's `items` array, add a new entry after `'Sinistros'`:

```ts
{
  title: 'Ocorrências',
  items: [
    { label: 'Multas', href: '/sofia/multas' },
    { label: 'Sinistros', href: '/sofia/sinistros' },
    { label: 'Descontos', href: '/sofia/descontos' },
  ],
},
```

- [ ] **Step 13: Run the full test suite and type-check**

Run: `npx jest && npx tsc --noEmit`
Expected: all tests pass, no new type errors.

- [ ] **Step 14: Commit**

```bash
git add app/\(operacoes\)/sofia/descontos app/\(operacoes\)/sofia/multas/_actions.ts app/\(operacoes\)/sofia/multas/page.tsx app/\(operacoes\)/sofia/sinistros/_actions.ts app/\(operacoes\)/sofia/sinistros/__tests__/_actions.test.ts app/\(operacoes\)/sofia/sinistros/\[id\]/_form.tsx components/sofia/Sidebar.tsx
git commit -m "feat: centralize desconto flow in a new Descontos screen, simplify Multas/Sinistros"
```

---

### Task 5: Multas bulk-select, bulk send-to-desconto, admin-only delete

**Files:**
- Create: `app/(operacoes)/sofia/multas/_table.tsx`
- Modify: `app/(operacoes)/sofia/multas/page.tsx` (split into thin server page + `_table.tsx`)
- Modify: `app/(operacoes)/sofia/multas/_actions.ts` (add `enviarParaDescontoEmMassaAction`, `excluirMultaAction`, `excluirMultasEmMassaAction`)
- Modify: `app/(operacoes)/sofia/multas/__tests__/_actions.test.ts`

**Interfaces:**
- Consumes: `isAdminEmail` from `lib/auth/admins.ts` (Task 2), `registrarAuditoria` from `lib/sofia/auditLog.ts` (Task 3).
- Produces: `enviarParaDescontoEmMassaAction(ids: string[]): Promise<void>`, `excluirMultaAction(id: string): Promise<void>`, `excluirMultasEmMassaAction(ids: string[]): Promise<void>` — consumed by `_table.tsx`'s bulk toolbar and per-row delete button.

- [ ] **Step 1: Write the failing tests for the new actions**

Replace the full contents of `app/(operacoes)/sofia/multas/__tests__/_actions.test.ts` with:

```ts
const getUserMock = jest.fn()
const auditInsertMock = jest.fn()
const multaInsertMock = jest.fn()
const multaSelectSingleMock = jest.fn()
const multaSelectInMock = jest.fn()
const multaUpdateInEqMock = jest.fn()
const multaDeleteEqMock = jest.fn()
const multaDeleteInMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn((table: string) => {
      if (table === 'audit_log') return { insert: auditInsertMock }
      return {
        insert: jest.fn(() => ({ select: jest.fn(() => ({ single: multaInsertMock })) })),
        select: jest.fn(() => ({
          eq: jest.fn(() => ({ single: multaSelectSingleMock })),
          in: multaSelectInMock,
        })),
        update: jest.fn(() => ({
          in: jest.fn(() => ({ eq: multaUpdateInEqMock })),
        })),
        delete: jest.fn(() => ({
          eq: multaDeleteEqMock,
          in: multaDeleteInMock,
        })),
      }
    }),
  })),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import {
  criarMultaAction,
  enviarParaDescontoEmMassaAction,
  excluirMultaAction,
  excluirMultasEmMassaAction,
} from '../_actions'

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData()
  const fields = {
    veiculo_id: '',
    motorista_id: '',
    data: '2026-06-01',
    data_recebimento: '2026-06-05',
    tipo_infracao: 'Excesso de velocidade',
    tipo_infracao_outra: '',
    descricao: '',
    valor: '195.23',
    observacoes: '',
    ...overrides,
  }
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const ADMIN_EMAIL = 'jvictorco28@gmail.com'
const NON_ADMIN_EMAIL = 'outro.usuario@manfac.com.br'

describe('criarMultaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    multaInsertMock.mockReset()
    multaInsertMock.mockResolvedValue({ data: { id: 'multa-1', valor: 195.23 }, error: null })
  })

  it('accepts a multa with valor 0 instead of rejecting it as missing (falsy-zero regression)', async () => {
    const result = await criarMultaAction({}, buildFormData({ valor: '0' }))
    expect(result).toEqual({ success: true })
  })

  it('still rejects when valor is left blank', async () => {
    const result = await criarMultaAction({}, buildFormData({ valor: '' }))
    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('rejects when tipo_infracao is missing', async () => {
    const result = await criarMultaAction({}, buildFormData({ tipo_infracao: '' }))
    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('rejects when data_recebimento is missing', async () => {
    const result = await criarMultaAction({}, buildFormData({ data_recebimento: '' }))
    expect(result.error).toBeTruthy()
    expect(multaInsertMock).not.toHaveBeenCalled()
  })

  it('uses the "Outra" free-text value when tipo_infracao is "outra"', async () => {
    const result = await criarMultaAction(
      {},
      buildFormData({ tipo_infracao: 'outra', tipo_infracao_outra: 'Transporte irregular de carga' })
    )
    expect(result).toEqual({ success: true })
  })

  it('registers a normal multa and logs creation in audit_log', async () => {
    const result = await criarMultaAction({}, buildFormData())
    expect(result).toEqual({ success: true })
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', acao: 'criacao' })
    )
  })
})

describe('enviarParaDescontoEmMassaAction', () => {
  beforeEach(() => {
    multaUpdateInEqMock.mockReset()
    multaUpdateInEqMock.mockResolvedValue({ error: null })
  })

  it('moves only pending multas to validada', async () => {
    await enviarParaDescontoEmMassaAction(['multa-1', 'multa-2'])
    expect(multaUpdateInEqMock).toHaveBeenCalledWith('status', 'pendente')
  })
})

describe('excluirMultaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    multaSelectSingleMock.mockReset()
    multaSelectSingleMock.mockResolvedValue({ data: { id: 'multa-1', valor: 100 }, error: null })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    multaDeleteEqMock.mockReset()
    multaDeleteEqMock.mockResolvedValue({ error: null })
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    await expect(excluirMultaAction('multa-1')).rejects.toThrow()
    expect(multaDeleteEqMock).not.toHaveBeenCalled()
  })

  it('logs the deleted row to audit_log before deleting, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    await excluirMultaAction('multa-1')
    expect(auditInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ tabela: 'multas', registro_id: 'multa-1', acao: 'exclusao' })
    )
    expect(multaDeleteEqMock).toHaveBeenCalledWith('id', 'multa-1')
  })
})

describe('excluirMultasEmMassaAction', () => {
  beforeEach(() => {
    getUserMock.mockReset()
    multaSelectInMock.mockReset()
    multaSelectInMock.mockResolvedValue({ data: [{ id: 'multa-1' }, { id: 'multa-2' }], error: null })
    auditInsertMock.mockReset()
    auditInsertMock.mockResolvedValue({ error: null })
    multaDeleteInMock.mockReset()
    multaDeleteInMock.mockResolvedValue({ error: null })
  })

  it('blocks a non-admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: NON_ADMIN_EMAIL } } })
    await expect(excluirMultasEmMassaAction(['multa-1', 'multa-2'])).rejects.toThrow()
    expect(multaDeleteInMock).not.toHaveBeenCalled()
  })

  it('logs every deleted row to audit_log, for an admin user', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } })
    await excluirMultasEmMassaAction(['multa-1', 'multa-2'])
    expect(auditInsertMock).toHaveBeenCalledTimes(2)
    expect(multaDeleteInMock).toHaveBeenCalledWith('id', ['multa-1', 'multa-2'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest app/\(operacoes\)/sofia/multas/__tests__/_actions.test.ts`
Expected: FAIL — `enviarParaDescontoEmMassaAction`, `excluirMultaAction`, `excluirMultasEmMassaAction` are not exported yet.

- [ ] **Step 3: Add the three new actions to `app/(operacoes)/sofia/multas/_actions.ts`**

Add the import (alongside the existing imports):

```ts
import { isAdminEmail } from '@/lib/auth/admins'
```

Append these three functions to the file:

```ts
export async function enviarParaDescontoEmMassaAction(ids: string[]) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('multas')
    .update({ status: 'validada' })
    .in('id', ids)
    .eq('status', 'pendente')
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function excluirMultaAction(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    throw new Error('Apenas administradores podem excluir multas')

  const { data: multa } = await supabase.from('multas').select('*').eq('id', id).single()
  if (!multa) throw new Error('Multa não encontrada')

  await registrarAuditoria(supabase, {
    tabela: 'multas',
    registro_id: id,
    acao: 'exclusao',
    dados: multa,
    usuario_email: user.email,
  })

  const { error } = await supabase.from('multas').delete().eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
}

export async function excluirMultasEmMassaAction(ids: string[]) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    throw new Error('Apenas administradores podem excluir multas')

  const { data: multas } = await supabase.from('multas').select('*').in('id', ids)

  for (const multa of multas ?? []) {
    await registrarAuditoria(supabase, {
      tabela: 'multas',
      registro_id: multa.id,
      acao: 'exclusao',
      dados: multa,
      usuario_email: user.email,
    })
  }

  const { error } = await supabase.from('multas').delete().in('id', ids)
  if (error) throw error
  revalidatePath('/sofia/multas')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest app/\(operacoes\)/sofia/multas/__tests__/_actions.test.ts`
Expected: PASS (12/12)

- [ ] **Step 5: Split `page.tsx` into a thin server component + `_table.tsx` client component**

Replace the full contents of `app/(operacoes)/sofia/multas/page.tsx` with:

```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { isAdminEmail } from '@/lib/auth/admins'
import MultasTable from './_table'
import type { Multa } from '@/lib/sofia/types'

export type MultaComRelacoes = Multa & {
  veiculos: { placa: string } | null
  motoristas: { nome: string } | null
}

export default async function MultasPage() {
  const supabase = await createClient()
  const [{ data: multas }, { data: userData }] = await Promise.all([
    supabase.from('multas').select('*, veiculos(placa), motoristas(nome)').order('data', { ascending: false }),
    supabase.auth.getUser(),
  ])

  const isAdmin = isAdminEmail(userData.user?.email ?? '')

  const totalPendente = (multas ?? [])
    .filter((m: MultaComRelacoes) => m.status === 'pendente')
    .reduce((sum: number, m: MultaComRelacoes) => sum + Number(m.valor), 0)

  const totalValidada = (multas ?? [])
    .filter((m: MultaComRelacoes) => m.status === 'validada')
    .reduce((sum: number, m: MultaComRelacoes) => sum + Number(m.valor), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Multas</h1>
          <div className="flex gap-6 mt-2">
            <p className="text-[#4a6080] text-sm">R$ {totalPendente.toFixed(2)} pendente de validação</p>
            <p className="text-[#4a6080] text-sm">R$ {totalValidada.toFixed(2)} validada, não descontada</p>
          </div>
        </div>
        <Link
          href="/sofia/multas/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Registrar Multa
        </Link>
      </div>

      <MultasTable multas={multas ?? []} isAdmin={isAdmin} />
    </div>
  )
}
```

Create `app/(operacoes)/sofia/multas/_table.tsx`:

```tsx
'use client'

import { useState } from 'react'
import {
  enviarParaDescontoEmMassaAction,
  excluirMultaAction,
  excluirMultasEmMassaAction,
} from './_actions'
import type { MultaComRelacoes } from './page'

const statusStyle: Record<string, string> = {
  pendente: 'bg-amber-900 text-amber-300',
  validada: 'bg-blue-900 text-blue-300',
  descontada: 'bg-green-900 text-green-300',
}

export default function MultasTable({
  multas,
  isAdmin,
}: {
  multas: MultaComRelacoes[]
  isAdmin: boolean
}) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())

  function toggleUma(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTodas() {
    setSelecionadas((prev) => (prev.size === multas.length ? new Set() : new Set(multas.map((m) => m.id))))
  }

  async function handleEnviarParaDesconto() {
    await enviarParaDescontoEmMassaAction(Array.from(selecionadas))
    setSelecionadas(new Set())
  }

  async function handleExcluirSelecionadas() {
    if (!window.confirm(`Excluir ${selecionadas.size} multa(s) selecionada(s)? Essa ação não pode ser desfeita.`))
      return
    await excluirMultasEmMassaAction(Array.from(selecionadas))
    setSelecionadas(new Set())
  }

  async function handleExcluirUma(id: string) {
    if (!window.confirm('Excluir esta multa? Essa ação não pode ser desfeita.')) return
    await excluirMultaAction(id)
  }

  return (
    <>
      {selecionadas.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
          <span className="text-sm text-[#94a3b8]">{selecionadas.size} selecionada(s)</span>
          <button
            onClick={handleEnviarParaDesconto}
            className="text-sm text-[#f05a28] hover:underline"
          >
            Enviar para desconto
          </button>
          {isAdmin && (
            <button onClick={handleExcluirSelecionadas} className="text-sm text-red-400 hover:underline">
              Excluir selecionadas
            </button>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selecionadas.size === multas.length && multas.length > 0}
                  onChange={toggleTodas}
                  className="accent-[#f05a28]"
                />
              </th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data de recebimento</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo de infração</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Desconto</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {multas.map((m) => (
              <tr key={m.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selecionadas.has(m.id)}
                    onChange={() => toggleUma(m.id)}
                    className="accent-[#f05a28]"
                  />
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-[#94a3b8]">
                  {m.data_recebimento ? new Date(m.data_recebimento).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3 text-[#94a3b8] font-mono">{m.veiculos?.placa ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{m.motoristas?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-white">{m.tipo_infracao ?? '—'}</td>
                <td className="px-4 py-3 text-white">{m.descricao ?? '—'}</td>
                <td className="px-4 py-3 text-white text-right font-medium">R$ {Number(m.valor).toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-sm">
                  {m.tipo_desconto === 'nenhum'
                    ? '—'
                    : `${m.tipo_desconto === 'total' ? 'Total' : 'Parcial'} · R$ ${Number(m.valor_descontado ?? 0).toFixed(2)}`}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[m.status]}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {isAdmin && (
                    <button
                      onClick={() => handleExcluirUma(m.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {multas.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhuma multa registrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
```

- [ ] **Step 6: Run the full test suite, type-check, and build**

Run: `npx jest && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add app/\(operacoes\)/sofia/multas/_actions.ts app/\(operacoes\)/sofia/multas/page.tsx app/\(operacoes\)/sofia/multas/_table.tsx app/\(operacoes\)/sofia/multas/__tests__/_actions.test.ts
git commit -m "feat: bulk select/send-to-desconto on Multas, admin-only delete with audit log"
```

---

### Task 6: Final regression pass

**Files:**
- None created or modified — verification only.

**Interfaces:**
- Consumes: every interface produced by Tasks 1-5.
- Produces: nothing new; confirms the branch is ready for review/deploy.

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: all suites pass, including `lib/auth/__tests__/admins.test.ts`, `lib/sofia/__tests__/auditLog.test.ts`, `app/(operacoes)/sofia/multas/__tests__/_actions.test.ts`, `app/(operacoes)/sofia/descontos/__tests__/_actions.test.ts`, `app/(operacoes)/sofia/sinistros/__tests__/_actions.test.ts`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds with no errors, `/sofia/descontos` listed among the generated routes.

- [ ] **Step 4: Manual smoke check against spec section 7**

With the dev server running, confirm by hand:
- Registering a multa requires `tipo_infracao` and `data_recebimento`, accepts "Outra" with free text, and the new row shows up in `audit_log`.
- `/sofia/multas` shows the two new columns, has no embedded desconto form, and (logged in as an admin e-mail from `lib/auth/admins.ts`) shows bulk-select checkboxes and "Excluir" per row.
- `/sofia/descontos` lists both multas and sinistros, and advancing/registering/undoing a desconto on either origin updates the correct table.
- `/sofia/sinistros/[id]` tratativa form only has the `status` field.

- [ ] **Step 5: Commit (if the smoke check surfaced fixes)**

If Step 4 required any fixes, commit them now with a message describing the fix. If no fixes were needed, this task has no commit — Task 5's commit is the last one for this plan.
