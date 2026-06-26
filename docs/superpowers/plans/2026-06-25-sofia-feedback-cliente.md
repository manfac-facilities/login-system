# Sofia — Feedback Cliente: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar KM Diário (km_atual único + cascade equipe + resumo mensal/semanal), melhorar Abastecimento (cascade + litros opcional + histórico), adicionar soft-delete de veículos, upload de galeria no checklist com cascade equipe→veículo+motorista, corrigir troca de motorista e adicionar histórico de veículos no detalhe do motorista. Todos os deletes exigem que o usuário digite "gestão de frotas" para confirmar.

**Architecture:** Todas as mudanças são no módulo `/sofia` (Next.js App Router + Server Actions + Supabase). A maior mudança é de schema: `km_diario` perde `km_inicial`/`km_final` e ganha `km_atual`. Um componente `DeleteConfirmButton` reutilizável centraliza o padrão de confirmação por texto. As demais mudanças são incrementais nos formulários e ações existentes.

**Tech Stack:** Next.js 16 App Router, React 19 `useActionState`, Supabase (PostgreSQL), Tailwind v4, TypeScript

## Global Constraints

- Next.js 16 App Router — usar `'use server'` / `'use client'` diretivas
- `useActionState` para form state em Client Components
- Supabase client: `@/lib/supabase/server` para Server Actions/pages; `@/lib/supabase/client` para Client Components quando necessário
- Tailwind v4 — não usar `tailwind.config.js`
- TypeScript strict — sem `any` (exceções devem usar cast explícito com tipo local)
- TDD: escrever testes antes de implementar funções puras
- Commits frequentes após cada task
- **Todos os deletes** exigem que o usuário digite `"gestão de frotas"` em um input de confirmação antes do botão ficar habilitado

---

### Task 1: SQL Migration

**Files:**
- Create: `sdd-sql-feedback-cliente.sql`

**Interfaces:**
- Produces: schema atualizado no Supabase (projeto iyytcavcgukfjnjjrerx)
  - `km_diario.km_atual INTEGER NOT NULL` (substitui `km_inicial`/`km_final`)
  - `abastecimentos.litros` passa a ser nullable

- [ ] **Step 1: Criar o arquivo SQL**

Criar `sdd-sql-feedback-cliente.sql` na raiz do projeto:

```sql
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
```

- [ ] **Step 2: Executar no Supabase**

No dashboard do Supabase (projeto iyytcavcgukfjnjjrerx), abrir SQL Editor e executar o script. Confirmar que não há erros.

- [ ] **Step 3: Confirmar schema**

Verificar no Table Editor que:
- `km_diario` tem coluna `km_atual` (integer, not null) e **não** tem `km_inicial`/`km_final`
- `abastecimentos.litros` aceita NULL

- [ ] **Step 4: Commit**

```bash
git add sdd-sql-feedback-cliente.sql
git commit -m "feat: SQL migration — km_diario km_atual, abastecimentos litros nullable"
```

---

### Task 2: Types — atualizar KmDiario e Abastecimento

**Files:**
- Modify: `lib/sofia/types.ts`

**Interfaces:**
- Consumes: schema da Task 1
- Produces:
  - `KmDiario.km_atual: number` (sem `km_inicial`/`km_final`)
  - `KmDiarioComRelacoes extends KmDiario` (sem alteração estrutural, herda `km_atual`)
  - `Abastecimento.litros: number | null`

- [ ] **Step 1: Atualizar KmDiario e KmDiarioComRelacoes**

Em `lib/sofia/types.ts`, substituir as interfaces `KmDiario` e `KmDiarioComRelacoes`:

```ts
export interface KmDiario {
  id: string
  data: string
  equipe_id: string
  veiculo_id: string
  motorista_id: string | null
  km_atual: number
  observacoes: string | null
  created_at: string
}

export interface KmDiarioComRelacoes extends KmDiario {
  equipes: { codigo: string } | null
  veiculos: { placa: string } | null
  motoristas: { nome: string } | null
}
```

- [ ] **Step 2: Atualizar Abastecimento**

Substituir a interface `Abastecimento`:

```ts
export interface Abastecimento {
  id: string
  veiculo_id: string
  data: string
  litros: number | null
  valor: number
  km: number | null
  posto: string | null
  created_at: string
}
```

- [ ] **Step 3: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperar: pode haver erros em arquivos que referenciam `km_inicial`/`km_final` — anotar quais. Serão corrigidos nas tasks seguintes.

- [ ] **Step 4: Commit**

```bash
git add lib/sofia/types.ts
git commit -m "feat: update KmDiario (km_atual) and Abastecimento (litros nullable) types"
```

---

### Task 3: DeleteConfirmButton — componente reutilizável de confirmação

**Files:**
- Create: `components/sofia/DeleteConfirmButton.tsx`

**Interfaces:**
- Produces: `<DeleteConfirmButton action={serverAction} id={string} label={string} />`
  - Renderiza um botão que abre um inline-prompt pedindo para o usuário digitar `"gestão de frotas"`
  - Só habilita confirmar quando o texto bate exatamente
  - Ao confirmar, submete o formulário hidden com `id` para a `action` fornecida

- [ ] **Step 1: Criar o componente**

Criar `components/sofia/DeleteConfirmButton.tsx`:

```tsx
'use client'
import { useActionState, useState } from 'react'

interface Props {
  action: (prev: { error?: string; success?: boolean }, formData: FormData) => Promise<{ error?: string; success?: boolean }>
  id: string
  label?: string
}

const CONFIRMATION_PHRASE = 'gestão de frotas'

export default function DeleteConfirmButton({ action, id, label = '✕' }: Props) {
  const [state, formAction, isPending] = useActionState(action, {})
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')

  const matches = typed.trim().toLowerCase() === CONFIRMATION_PHRASE

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
        title="Excluir"
      >
        {isPending ? '...' : label}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-red-800 bg-red-950/40 min-w-[220px]">
      {state.error && (
        <p className="text-red-300 text-xs">{state.error}</p>
      )}
      <p className="text-red-300 text-xs">
        Digite <span className="font-mono font-bold">gestão de frotas</span> para confirmar:
      </p>
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="gestão de frotas"
        className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-red-800 text-white text-xs placeholder-red-900 focus:outline-none focus:border-red-500"
        autoFocus
      />
      <div className="flex gap-2">
        <form action={formAction} className="flex-1">
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={!matches || isPending}
            className="w-full py-1 rounded bg-red-700 text-white text-xs font-medium hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Excluindo...' : 'Confirmar exclusão'}
          </button>
        </form>
        <button
          type="button"
          onClick={() => { setConfirming(false); setTyped('') }}
          className="px-3 py-1 rounded border border-[#1e3a5f] text-[#94a3b8] text-xs hover:border-[#94a3b8] transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Esperar: 0 errors no novo arquivo.

- [ ] **Step 3: Commit**

```bash
git add components/sofia/DeleteConfirmButton.tsx
git commit -m "feat: DeleteConfirmButton — confirmação por texto 'gestão de frotas'"
```

---

### Task 4: Queries — novos helpers de histórico e validação

**Files:**
- Modify: `lib/sofia/queries.ts`
- Create: `lib/sofia/kmValidation.ts`
- Create: `lib/sofia/__tests__/kmValidation.test.ts`
- Create: `lib/sofia/__tests__/kmQueries.test.ts`

**Interfaces:**
- Produces:
  - `validateKmAtual(km: number): string | null` — validação de km_atual (pura, testável)
  - `getKmDiarioHistorico(): Promise<KmDiarioComRelacoes[]>` — todos os registros, desc
  - `getAbastecimentoHistorico(): Promise<(Abastecimento & { veiculos: { placa: string } | null })[]>`

- [ ] **Step 1: Escrever teste para validateKmAtual**

Criar `lib/sofia/__tests__/kmValidation.test.ts`:

```ts
import { validateKmAtual } from '../kmValidation'

describe('validateKmAtual', () => {
  it('returns error for NaN input', () => {
    expect(validateKmAtual(NaN)).toBe('KM atual é obrigatório')
  })

  it('returns null for valid positive number', () => {
    expect(validateKmAtual(29216)).toBeNull()
  })

  it('returns null for zero (new vehicle)', () => {
    expect(validateKmAtual(0)).toBeNull()
  })

  it('returns error for negative', () => {
    expect(validateKmAtual(-1)).toBe('KM atual não pode ser negativo')
  })
})
```

- [ ] **Step 2: Rodar para verificar que falha**

```bash
npx jest lib/sofia/__tests__/kmValidation.test.ts --no-coverage
```

Esperar: FAIL — `Cannot find module '../kmValidation'`

- [ ] **Step 3: Criar lib/sofia/kmValidation.ts**

```ts
export function validateKmAtual(km: number): string | null {
  if (km === null || km === undefined || Number.isNaN(km)) return 'KM atual é obrigatório'
  if (km < 0) return 'KM atual não pode ser negativo'
  return null
}
```

- [ ] **Step 4: Rodar teste de validação**

```bash
npx jest lib/sofia/__tests__/kmValidation.test.ts --no-coverage
```

Esperar: PASS (4 testes)

- [ ] **Step 5: Escrever teste para getKmDiarioHistorico**

Criar `lib/sofia/__tests__/kmQueries.test.ts`:

```ts
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'order', 'lte', 'gte', 'single', 'is', 'delete']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let fromMock: jest.Mock

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: (...args: unknown[]) => fromMock(...args),
  })),
}))

import { getKmDiarioHistorico } from '../queries'

describe('getKmDiarioHistorico', () => {
  it('orders by data descending', async () => {
    const chain = makeChainable({ data: [] })
    fromMock = jest.fn(() => chain)

    await getKmDiarioHistorico()

    expect(chain.order).toHaveBeenCalledWith('data', { ascending: false })
  })
})
```

- [ ] **Step 6: Rodar para verificar que falha**

```bash
npx jest lib/sofia/__tests__/kmQueries.test.ts --no-coverage
```

Esperar: FAIL — `getKmDiarioHistorico is not a function`

- [ ] **Step 7: Adicionar funções em queries.ts**

Adicionar ao final de `lib/sofia/queries.ts`:

```ts
export async function getKmDiarioHistorico(): Promise<KmDiarioComRelacoes[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('km_diario')
    .select('*, equipes(codigo), veiculos(placa), motoristas(nome)')
    .order('data', { ascending: false })
  return data ?? []
}

export async function getAbastecimentoHistorico(): Promise<
  (Abastecimento & { veiculos: { placa: string } | null })[]
> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('abastecimentos')
    .select('*, veiculos(placa)')
    .order('data', { ascending: false })
  return (data ?? []) as (Abastecimento & { veiculos: { placa: string } | null })[]
}
```

- [ ] **Step 8: Adicionar helper de resumo mensal de KM**

Adicionar também em `lib/sofia/queries.ts`:

```ts
export interface KmResumoMensal {
  mes: string          // "2026-06"
  equipe_codigo: string
  veiculo_placa: string
  km_inicio: number    // km_atual da 1ª entrada do mês
  km_fim: number       // km_atual da última entrada do mês
  km_rodados: number   // km_fim - km_inicio
}

export async function getKmResumoMensal(): Promise<KmResumoMensal[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('km_diario')
    .select('data, km_atual, equipes(codigo), veiculos(placa)')
    .order('data', { ascending: true })

  if (!data) return []

  type Row = { data: string; km_atual: number; equipes: { codigo: string } | null; veiculos: { placa: string } | null }
  const rows = data as Row[]

  // Group by (veiculo_placa, mes)
  const groups = new Map<string, { km_inicio: number; km_fim: number; equipe_codigo: string; veiculo_placa: string; mes: string }>()

  for (const row of rows) {
    const mes = row.data.slice(0, 7) // "YYYY-MM"
    const placa = row.veiculos?.placa ?? '—'
    const key = `${placa}::${mes}`
    const existing = groups.get(key)
    if (!existing) {
      groups.set(key, {
        mes,
        equipe_codigo: row.equipes?.codigo ?? '—',
        veiculo_placa: placa,
        km_inicio: row.km_atual,
        km_fim: row.km_atual,
      })
    } else {
      // rows are ordered ascending: last update = km_fim
      existing.km_fim = row.km_atual
    }
  }

  return Array.from(groups.values())
    .map((g) => ({ ...g, km_rodados: g.km_fim - g.km_inicio }))
    .sort((a, b) => b.mes.localeCompare(a.mes)) // mais recente primeiro
}
```

- [ ] **Step 8: Rodar todos os testes**

```bash
npx jest --no-coverage
```

Esperar: todos passando.

- [ ] **Step 9: Commit**

```bash
git add lib/sofia/kmValidation.ts lib/sofia/queries.ts lib/sofia/__tests__/kmValidation.test.ts lib/sofia/__tests__/kmQueries.test.ts
git commit -m "feat: kmValidation, getKmDiarioHistorico, getAbastecimentoHistorico"
```

---

### Task 5: KM Diário — refactor completo

**Files:**
- Modify: `app/(operacoes)/sofia/km/_validation.ts`
- Modify: `app/(operacoes)/sofia/km/_actions.ts`
- Modify: `app/(operacoes)/sofia/km/_form.tsx`
- Modify: `app/(operacoes)/sofia/km/page.tsx`

**Interfaces:**
- Consumes: `validateKmAtual` (Task 4), `getKmDiarioHistorico` (Task 4), `DeleteConfirmButton` (Task 3), `getEquipes/getVeiculos/getMotoristas`
- Produces:
  - Form com cascade equipe → veículo+motorista auto-preenchidos
  - Exibe km_atual do veículo como referência
  - Valida server-side que km_atual >= veiculos.km_atual
  - Atualiza veiculos.km_atual após lançamento
  - Histórico completo com DeleteConfirmButton por linha

- [ ] **Step 1: Atualizar _validation.ts**

Substituir o conteúdo de `app/(operacoes)/sofia/km/_validation.ts`:

```ts
export { validateKmAtual } from '@/lib/sofia/kmValidation'
```

- [ ] **Step 2: Atualizar _actions.ts**

Substituir o conteúdo de `app/(operacoes)/sofia/km/_actions.ts`:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { validateKmAtual } from './_validation'

type State = { error?: string; success?: boolean }

export async function lancarKmAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const equipe_id = formData.get('equipe_id') as string
  const veiculo_id = formData.get('veiculo_id') as string
  const motorista_id = (formData.get('motorista_id') as string) || null
  const km_atual = Number(formData.get('km_atual'))
  const data =
    (formData.get('data') as string) || new Date().toISOString().split('T')[0]
  const observacoes = ((formData.get('observacoes') as string) ?? '').trim() || null

  if (!equipe_id || !veiculo_id) return { error: 'Selecione a equipe' }
  const validationError = validateKmAtual(km_atual)
  if (validationError) return { error: validationError }

  const supabase = await createClient()

  const { data: veiculo } = await supabase
    .from('veiculos')
    .select('km_atual')
    .eq('id', veiculo_id)
    .single()

  if (veiculo && km_atual < veiculo.km_atual) {
    return {
      error: `KM não pode ser menor que a última KM registrada (${veiculo.km_atual.toLocaleString('pt-BR')} km)`,
    }
  }

  const { error } = await supabase.from('km_diario').upsert(
    { equipe_id, veiculo_id, motorista_id, km_atual, data, observacoes },
    { onConflict: 'data,equipe_id' }
  )

  if (error) return { error: 'Erro ao registrar KM' }

  await supabase.from('veiculos').update({ km_atual }).eq('id', veiculo_id)

  revalidatePath('/sofia/km')
  revalidatePath('/sofia/veiculos')
  return { success: true }
}

export async function deletarKmAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('km_diario').delete().eq('id', id)

  if (error) return { error: 'Erro ao excluir lançamento' }

  revalidatePath('/sofia/km')
  return { success: true }
}
```

- [ ] **Step 3: Atualizar _form.tsx**

Substituir o conteúdo de `app/(operacoes)/sofia/km/_form.tsx`:

```tsx
'use client'
import { useActionState, useState } from 'react'
import { lancarKmAction } from './_actions'
import type { Equipe, Veiculo, Motorista } from '@/lib/sofia/types'

interface Props {
  equipes: Equipe[]
  veiculos: Veiculo[]
  motoristas: Motorista[]
}

export default function KmForm({ equipes, veiculos, motoristas }: Props) {
  const [state, action, isPending] = useActionState(lancarKmAction, {})
  const [equipeId, setEquipeId] = useState('')
  const hoje = new Date().toISOString().split('T')[0]

  const veiculoDaEquipe = veiculos.find((v) => v.equipe_id === equipeId && v.status === 'ativo')
  const motoristaDaEquipe = motoristas.find((m) => m.equipe_id === equipeId && m.ativo)

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">
          KM registrado com sucesso!
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Data</label>
        <input
          name="data"
          type="date"
          defaultValue={hoje}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Equipe *</label>
        <select
          name="equipe_id"
          required
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="">Selecione a equipe</option>
          {equipes
            .filter((e) => e.ativo)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo}
              </option>
            ))}
        </select>
      </div>

      <input type="hidden" name="veiculo_id" value={veiculoDaEquipe?.id ?? ''} />
      <input type="hidden" name="motorista_id" value={motoristaDaEquipe?.id ?? ''} />

      {equipeId && (
        <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
          {veiculoDaEquipe ? (
            <>
              <p className="text-[#94a3b8]">
                Veículo: <span className="text-white font-mono">{veiculoDaEquipe.placa}</span>
                {' · '}{veiculoDaEquipe.modelo}
              </p>
              <p className="text-[#4a6080] text-xs mt-0.5">
                Última KM: <span className="text-amber-400 font-mono">{veiculoDaEquipe.km_atual.toLocaleString('pt-BR')} km</span>
              </p>
            </>
          ) : (
            <p className="text-amber-400 text-xs">Nenhum veículo ativo vinculado a esta equipe</p>
          )}
          {motoristaDaEquipe && (
            <p className="text-[#94a3b8] text-xs mt-1">
              Motorista: <span className="text-white">{motoristaDaEquipe.nome}</span>
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">KM Atual *</label>
        <input
          name="km_atual"
          type="number"
          required
          placeholder={
            veiculoDaEquipe
              ? `Última: ${veiculoDaEquipe.km_atual.toLocaleString('pt-BR')}`
              : 'Ex: 29216'
          }
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Observações</label>
        <textarea
          name="observacoes"
          rows={2}
          placeholder="Opcional"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || !veiculoDaEquipe}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Salvando...' : 'Registrar KM'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Atualizar page.tsx**

Substituir o conteúdo de `app/(operacoes)/sofia/km/page.tsx`:

```tsx
import { getEquipes, getVeiculos, getMotoristas, getKmDiarioHistorico, getKmResumoMensal } from '@/lib/sofia/queries'
import KmForm from './_form'
import { deletarKmAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'

export default async function KmPage() {
  const [equipes, veiculos, motoristas, historico, resumoMensal] = await Promise.all([
    getEquipes(),
    getVeiculos(),
    getMotoristas(),
    getKmDiarioHistorico(),
    getKmResumoMensal(),
  ])

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">KM Diário</h1>
        <p className="text-[#4a6080] text-sm mt-1 capitalize">{hoje}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <KmForm equipes={equipes} veiculos={veiculos} motoristas={motoristas} />

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Histórico de lançamentos
          </h2>
          {historico.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum lançamento ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {historico.map((k) => (
                <div
                  key={k.id}
                  className="flex items-start justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050] gap-3"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{k.equipes?.codigo}</p>
                    <p className="text-[#4a6080] text-xs font-mono">{k.veiculos?.placa}</p>
                    <p className="text-[#4a6080] text-xs">
                      {new Date(k.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <p className="text-white text-sm font-mono">
                        {k.km_atual.toLocaleString('pt-BR')} km
                      </p>
                      {k.motoristas?.nome && (
                        <p className="text-[#4a6080] text-xs">{k.motoristas.nome}</p>
                      )}
                    </div>
                    <DeleteConfirmButton action={deletarKmAction} id={k.id} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

Adicionar também, após a seção de "Histórico de lançamentos" no return, a seção de resumo mensal:

```tsx
      {resumoMensal.length > 0 && (
        <div className="mt-10 col-span-full">
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Resumo por mês
          </h2>
          <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Mês</th>
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Equipe</th>
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">KM início</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">KM fim</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Rodados</th>
                </tr>
              </thead>
              <tbody>
                {resumoMensal.map((r) => (
                  <tr
                    key={`${r.veiculo_placa}::${r.mes}`}
                    className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors"
                  >
                    <td className="px-4 py-3 text-[#94a3b8]">
                      {new Date(r.mes + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8]">{r.equipe_codigo}</td>
                    <td className="px-4 py-3 text-white font-mono">{r.veiculo_placa}</td>
                    <td className="px-4 py-3 text-[#94a3b8] text-right font-mono">
                      {r.km_inicio.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8] text-right font-mono">
                      {r.km_fim.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-white text-right font-mono font-medium">
                      {r.km_rodados.toLocaleString('pt-BR')} km
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[#4a6080] text-xs mt-2">
            KM rodados = última leitura do mês − primeira leitura do mês por veículo.
          </p>
        </div>
      )}
```

O resumo fica fora do grid de 2 colunas, em largura total, após o histórico. Ajustar o wrapper do grid para `<div className="grid grid-cols-1 lg:grid-cols-2 gap-10">` e colocar o resumo mensal em `<div className="col-span-full mt-10">` ou simplesmente após o fechamento do grid div.

- [ ] **Step 5: Build**

```bash
npx next build
```

Esperar: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/(operacoes)/sofia/km/
git commit -m "feat: KM Diário — cascade equipe, km_atual, validação, histórico e resumo mensal"
```

---

### Task 6: Abastecimento — cascade equipe, litros opcional, histórico com delete

**Files:**
- Modify: `app/(operacoes)/sofia/abastecimento/_form.tsx`
- Modify: `app/(operacoes)/sofia/abastecimento/_actions.ts`
- Modify: `app/(operacoes)/sofia/abastecimento/page.tsx`

**Interfaces:**
- Consumes: `getEquipes`, `getVeiculos`, `getAbastecimentoHistorico` (Task 4), `DeleteConfirmButton` (Task 3)
- Produces: form com cascade equipe→veículo; litros opcional; histórico completo com delete; cálculo de km do mês corrigido para usar km_atual

- [ ] **Step 1: Atualizar _actions.ts**

Verificar se `app/(operacoes)/sofia/abastecimento/_actions.ts` existe. Se não, criar. Substituir o conteúdo:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function lancarAbastecimentoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const valor = Number(formData.get('valor'))
  const litrosRaw = formData.get('litros') as string
  const litros = litrosRaw ? Number(litrosRaw) : null
  const km = formData.get('km') ? Number(formData.get('km')) : null
  const posto = ((formData.get('posto') as string) ?? '').trim() || null
  const data =
    (formData.get('data') as string) || new Date().toISOString().split('T')[0]

  if (!veiculo_id) return { error: 'Selecione a equipe para identificar o veículo' }
  if (!valor || Number.isNaN(valor) || valor <= 0) return { error: 'Informe o valor do abastecimento' }

  const supabase = await createClient()
  const { error } = await supabase.from('abastecimentos').insert({
    veiculo_id,
    data,
    litros,
    valor,
    km,
    posto,
  })

  if (error) return { error: 'Erro ao registrar abastecimento' }

  revalidatePath('/sofia/abastecimento')
  return { success: true }
}

export async function deletarAbastecimentoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase.from('abastecimentos').delete().eq('id', id)

  if (error) return { error: 'Erro ao excluir abastecimento' }

  revalidatePath('/sofia/abastecimento')
  return { success: true }
}
```

- [ ] **Step 2: Atualizar _form.tsx**

Substituir o conteúdo de `app/(operacoes)/sofia/abastecimento/_form.tsx`:

```tsx
'use client'
import { useActionState, useState } from 'react'
import { lancarAbastecimentoAction } from './_actions'
import type { Equipe, Veiculo } from '@/lib/sofia/types'

interface Props {
  equipes: Equipe[]
  veiculos: Veiculo[]
}

export default function AbastecimentoForm({ equipes, veiculos }: Props) {
  const [state, action, isPending] = useActionState(lancarAbastecimentoAction, {})
  const [equipeId, setEquipeId] = useState('')
  const hoje = new Date().toISOString().split('T')[0]

  const veiculoDaEquipe = veiculos.find((v) => v.equipe_id === equipeId && v.status === 'ativo')

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">
          Abastecimento registrado com sucesso!
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Data</label>
        <input
          name="data"
          type="date"
          defaultValue={hoje}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Equipe *</label>
        <select
          required
          value={equipeId}
          onChange={(e) => setEquipeId(e.target.value)}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="">Selecione a equipe</option>
          {equipes
            .filter((e) => e.ativo)
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.codigo}
              </option>
            ))}
        </select>
      </div>

      <input type="hidden" name="veiculo_id" value={veiculoDaEquipe?.id ?? ''} />

      {equipeId && (
        <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
          {veiculoDaEquipe ? (
            <p className="text-[#94a3b8]">
              Veículo: <span className="text-white font-mono">{veiculoDaEquipe.placa}</span>
              {' · '}{veiculoDaEquipe.modelo}
            </p>
          ) : (
            <p className="text-amber-400 text-xs">Nenhum veículo ativo vinculado a esta equipe</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Litros</label>
          <input
            name="litros"
            type="number"
            step="0.01"
            placeholder="Ex: 45.5"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor (R$) *</label>
          <input
            name="valor"
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">KM no momento</label>
        <input
          name="km"
          type="number"
          placeholder="Ex: 45280"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Posto</label>
        <input
          name="posto"
          placeholder="Nome do posto"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending || !veiculoDaEquipe}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Salvando...' : 'Registrar Abastecimento'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Atualizar page.tsx**

Substituir o conteúdo de `app/(operacoes)/sofia/abastecimento/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getVeiculos, getEquipes, getAbastecimentoHistorico } from '@/lib/sofia/queries'
import type { Abastecimento } from '@/lib/sofia/types'
import AbastecimentoForm from './_form'
import { deletarAbastecimentoAction } from './_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'

type AbastecimentoComVeiculo = Abastecimento & { veiculos: { placa: string } | null }

export default async function AbastecimentoPage() {
  const [veiculos, equipes, historico] = await Promise.all([
    getVeiculos(),
    getEquipes(),
    getAbastecimentoHistorico(),
  ])

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: kmMes } = await supabase
    .from('km_diario')
    .select('veiculo_id, km_atual')
    .gte('data', inicioMes)

  // km rodados no mês = MAX(km_atual) - MIN(km_atual) por veículo
  const kmRangePorVeiculo = new Map<string, { min: number; max: number }>()
  for (const k of kmMes ?? []) {
    const curr = kmRangePorVeiculo.get(k.veiculo_id)
    if (!curr) {
      kmRangePorVeiculo.set(k.veiculo_id, { min: k.km_atual, max: k.km_atual })
    } else {
      kmRangePorVeiculo.set(k.veiculo_id, {
        min: Math.min(curr.min, k.km_atual),
        max: Math.max(curr.max, k.km_atual),
      })
    }
  }

  const doMes = (historico as AbastecimentoComVeiculo[]).filter((a) => a.data >= inicioMes)
  const porVeiculo = new Map<string, { placa: string; litros: number; valor: number }>()
  for (const a of doMes) {
    const atual = porVeiculo.get(a.veiculo_id) ?? {
      placa: a.veiculos?.placa ?? '—',
      litros: 0,
      valor: 0,
    }
    atual.litros += Number(a.litros ?? 0)
    atual.valor += Number(a.valor)
    porVeiculo.set(a.veiculo_id, atual)
  }

  const relatorio = Array.from(porVeiculo.entries()).map(([veiculoId, r]) => {
    const range = kmRangePorVeiculo.get(veiculoId)
    const km = range ? range.max - range.min : 0
    return {
      ...r,
      valorPorKm: km > 0 ? r.valor / km : null,
      kmPorLitro: r.litros > 0 && km > 0 ? km / r.litros : null,
    }
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Abastecimento</h1>
        <p className="text-[#4a6080] text-sm mt-1">Lançamento manual + consumo do mês</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
        <AbastecimentoForm veiculos={veiculos} equipes={equipes} />

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Consumo do mês
          </h2>
          {relatorio.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum abastecimento lançado neste mês.</p>
          ) : (
            <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                    <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Litros</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">R$/km</th>
                    <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Km/litro</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorio.map((r) => (
                    <tr key={r.placa} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                      <td className="px-4 py-3 text-white font-mono">{r.placa}</td>
                      <td className="px-4 py-3 text-[#94a3b8] text-right">{r.litros > 0 ? r.litros.toFixed(1) : '—'}</td>
                      <td className="px-4 py-3 text-white text-right font-medium">R$ {r.valor.toFixed(2)}</td>
                      <td className="px-4 py-3 text-[#94a3b8] text-right">{r.valorPorKm != null ? `R$ ${r.valorPorKm.toFixed(2)}` : '—'}</td>
                      <td className="px-4 py-3 text-[#94a3b8] text-right">{r.kmPorLitro != null ? r.kmPorLitro.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
          Histórico de lançamentos
        </h2>
        {historico.length === 0 ? (
          <p className="text-[#4a6080] text-sm">Nenhum abastecimento registrado ainda.</p>
        ) : (
          <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
                  <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Litros</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
                  <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Posto</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(historico as AbastecimentoComVeiculo[]).map((a) => (
                  <tr key={a.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                    <td className="px-4 py-3 text-[#94a3b8]">
                      {new Date(a.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-white font-mono">{a.veiculos?.placa ?? '—'}</td>
                    <td className="px-4 py-3 text-[#94a3b8] text-right">
                      {a.litros != null ? Number(a.litros).toFixed(1) : '—'}
                    </td>
                    <td className="px-4 py-3 text-white text-right font-medium">
                      R$ {Number(a.valor).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8] text-right">{a.posto ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <DeleteConfirmButton action={deletarAbastecimentoAction} id={a.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Build**

```bash
npx next build
```

Esperar: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/(operacoes)/sofia/abastecimento/
git commit -m "feat: Abastecimento — cascade equipe, litros opcional, histórico com delete"
```

---

### Task 7: Veículos — soft-delete com confirmação

**Files:**
- Create: `app/(operacoes)/sofia/veiculos/_actions.ts`
- Modify: `app/(operacoes)/sofia/veiculos/[id]/page.tsx`

**Interfaces:**
- Consumes: `DeleteConfirmButton` (Task 3)
- Produces: `softDeleteVeiculoAction` que seta `status = 'inativo'`; botão no detalhe do veículo; ao desativar, redireciona para `/sofia/veiculos`

- [ ] **Step 1: Criar _actions.ts**

Criar `app/(operacoes)/sofia/veiculos/_actions.ts`:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

type State = { error?: string; success?: boolean }

export async function softDeleteVeiculoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('veiculos')
    .update({ status: 'inativo' })
    .eq('id', id)

  if (error) return { error: 'Erro ao desativar veículo' }

  revalidatePath('/sofia/veiculos')
  redirect('/sofia/veiculos')
}
```

- [ ] **Step 2: Atualizar [id]/page.tsx**

Em `app/(operacoes)/sofia/veiculos/[id]/page.tsx`, adicionar o import e a seção de delete.

Adicionar ao topo dos imports:

```tsx
import { softDeleteVeiculoAction } from '../_actions'
import DeleteConfirmButton from '@/components/sofia/DeleteConfirmButton'
```

Adicionar ao final do return, após o grid de custos, dentro do `<div className="p-8">`:

```tsx
{veiculo.status !== 'inativo' && (
  <div className="mt-8 pt-6 border-t border-[#1e3a5f]">
    <p className="text-[#4a6080] text-xs mb-3">
      Desativar remove o veículo dos formulários. O histórico é preservado.
    </p>
    <DeleteConfirmButton
      action={softDeleteVeiculoAction}
      id={veiculo.id}
      label="Desativar veículo"
    />
  </div>
)}
```

- [ ] **Step 3: Build**

```bash
npx next build
```

Esperar: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/(operacoes)/sofia/veiculos/_actions.ts app/(operacoes)/sofia/veiculos/[id]/page.tsx
git commit -m "feat: Veículos — soft-delete com confirmação por texto"
```

---

### Task 8: Checklist — cascade equipe, upload de galeria + corrigir troca de motorista

**Files:**
- Modify: `components/sofia/CameraCapture.tsx`
- Modify: `app/(operacoes)/sofia/checklist/_actions.ts`
- Modify: `app/(operacoes)/sofia/checklist/novo/_form.tsx`

**Interfaces:**
- Consumes: prop `onCapture(blob, posicao, lat, lng)` existente no CameraCapture; `Equipe`, `Veiculo`, `Motorista` types
- Produces:
  - Form: selecionar equipe → veículo e motorista pré-preenchidos (hidden inputs, info card exibido)
  - Botão "ou escolher da galeria" em cada posição de foto
  - `criarChecklistAction`: na troca, também faz `UPDATE motoristas SET equipe_id = equipe_destino_id WHERE id = motorista_destino_id`

- [ ] **Step 1: Adicionar cascade equipe→veículo+motorista no form do checklist**

Em `app/(operacoes)/sofia/checklist/novo/_form.tsx`, adicionar `useState` para `equipeId` e transformar os selects de veículo e motorista em campos auto-preenchidos pelo cadastro da equipe, exatamente como no KmForm.

Localizar as props do componente `ChecklistForm`:

```tsx
interface Props {
  equipes: Equipe[]
  veiculos: Veiculo[]
  motoristas: Motorista[]
}
```

Adicionar estado no corpo do componente (junto aos outros `useState` existentes):

```tsx
const [equipeId, setEquipeId] = useState('')
const veiculoDaEquipe = veiculos.find((v) => v.equipe_id === equipeId && v.status === 'ativo')
const motoristaDaEquipe = motoristas.find((m) => m.equipe_id === equipeId && m.ativo)
```

Substituir o select de equipe para capturar `onChange` e o select de veículo/motorista por hidden inputs + card informativo:

```tsx
{/* Select de equipe — disparador da cascade */}
<div className="flex flex-col gap-1.5">
  <label className="text-sm text-[#94a3b8]">Equipe *</label>
  <select
    name="equipe_id"
    required
    value={equipeId}
    onChange={(e) => setEquipeId(e.target.value)}
    className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
  >
    <option value="">Selecione</option>
    {equipes
      .filter((e) => e.ativo)
      .map((e) => (
        <option key={e.id} value={e.id}>
          {e.codigo}
        </option>
      ))}
  </select>
</div>

{/* Hidden inputs preenchidos pela equipe selecionada */}
<input type="hidden" name="veiculo_id" value={veiculoDaEquipe?.id ?? ''} />
<input type="hidden" name="motorista_id" value={motoristaDaEquipe?.id ?? ''} />

{/* Card informativo com veículo e motorista da equipe */}
{equipeId && (
  <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
    {veiculoDaEquipe ? (
      <>
        <p className="text-[#94a3b8]">
          Veículo: <span className="text-white font-mono">{veiculoDaEquipe.placa}</span>
          {' · '}{veiculoDaEquipe.modelo}
        </p>
        <p className="text-[#4a6080] text-xs mt-0.5">
          Última KM: <span className="text-amber-400 font-mono">{veiculoDaEquipe.km_atual.toLocaleString('pt-BR')} km</span>
        </p>
      </>
    ) : (
      <p className="text-amber-400 text-xs">Nenhum veículo ativo vinculado a esta equipe</p>
    )}
    {motoristaDaEquipe && (
      <p className="text-[#94a3b8] text-xs mt-1">
        Motorista: <span className="text-white">{motoristaDaEquipe.nome}</span>
      </p>
    )}
  </div>
)}
```

Remover os selects antigos de veículo e motorista que eram independentes (substituídos pelos hidden inputs acima).

- [ ] **Step 2: Atualizar CameraCapture.tsx**

Substituir o conteúdo de `components/sofia/CameraCapture.tsx`:

```tsx
'use client'
import { useRef, useState, useCallback } from 'react'

interface Props {
  posicao: string
  onCapture: (
    blob: Blob,
    posicao: string,
    lat: number | null,
    lng: number | null
  ) => void
}

export default function CameraCapture({ posicao, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [streaming, setStreaming] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setStreaming(true)
      }
    } catch {
      setError('Câmera não disponível. Verifique as permissões.')
    }
  }, [])

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      const dataUrl = canvas.toDataURL('image/jpeg')
      setCaptured(dataUrl)

      const stream = video.srcObject as MediaStream
      stream?.getTracks().forEach((t) => t.stop())
      setStreaming(false)

      let lat: number | null = null
      let lng: number | null = null
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch (geoError) {
        console.warn('Não foi possível obter localização para a foto:', geoError)
      }

      onCapture(blob, posicao, lat, lng)
    }, 'image/jpeg', 0.85)
  }, [posicao, onCapture])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = (ev) => setCaptured(ev.target?.result as string)
      reader.readAsDataURL(file)
      onCapture(file, posicao, null, null)
    },
    [posicao, onCapture]
  )

  const retake = useCallback(() => {
    setCaptured(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    startCamera()
  }, [startCamera])

  if (captured) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative">
          <img
            src={captured}
            alt={posicao}
            className="rounded-lg w-full object-cover max-h-40"
          />
          <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
            {posicao}
          </span>
        </div>
        <button
          type="button"
          onClick={retake}
          className="text-xs text-[#f05a28] hover:underline text-center"
        >
          Alterar foto
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {streaming ? (
        <>
          <div className="relative">
            <video
              ref={videoRef}
              className="rounded-lg w-full object-cover max-h-40 bg-black"
              playsInline
              muted
            />
            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">
              {posicao}
            </span>
          </div>
          <button
            type="button"
            onClick={capture}
            className="py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
          >
            Tirar Foto
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={startCamera}
            className="py-3 rounded-lg border-2 border-dashed border-[#1e3a5f] text-[#4a6080] text-sm hover:border-[#f05a28] hover:text-[#f05a28] transition-colors"
          >
            📷 {posicao}
          </button>
          <label className="text-center text-xs text-[#4a6080] hover:text-[#f05a28] cursor-pointer transition-colors">
            ou escolher da galeria
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
```

- [ ] **Step 2: Corrigir troca em _actions.ts do checklist**

Em `app/(operacoes)/sofia/checklist/_actions.ts`, substituir o bloco `if (tipo === 'troca')`:

```ts
if (tipo === 'troca') {
  const hoje = new Date().toISOString().split('T')[0]

  const { error: fechaError } = await supabase
    .from('veiculo_responsabilidade_historico')
    .update({ fim: hoje })
    .eq('veiculo_id', veiculo_id)
    .is('fim', null)

  const { error: insereError } = await supabase
    .from('veiculo_responsabilidade_historico')
    .insert({
      veiculo_id,
      equipe_id: equipe_destino_id,
      motorista_id: motorista_destino_id,
      inicio: hoje,
      origem_checklist_id: data.id,
    })

  const { error: veiculoError } = await supabase
    .from('veiculos')
    .update({ equipe_id: equipe_destino_id })
    .eq('id', veiculo_id)

  const motoristaError = motorista_destino_id
    ? (
        await supabase
          .from('motoristas')
          .update({ equipe_id: equipe_destino_id })
          .eq('id', motorista_destino_id)
      ).error
    : null

  if (fechaError || insereError || veiculoError || motoristaError) {
    return {
      error:
        'Checklist salvo, mas a troca de responsável não foi totalmente registrada. Contate o suporte.',
      checklistId: data.id,
    }
  }
}
```

- [ ] **Step 3: Build**

```bash
npx next build
```

Esperar: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/sofia/CameraCapture.tsx app/(operacoes)/sofia/checklist/_actions.ts
git commit -m "feat: Checklist — upload de galeria; fix troca atualiza motoristas.equipe_id"
```

---

### Task 9: Motorista — histórico de veículos no detalhe

**Files:**
- Modify: `app/(operacoes)/sofia/motoristas/[id]/page.tsx`

**Interfaces:**
- Consumes: `veiculo_responsabilidade_historico` filtrado por `motorista_id`, com join em `veiculos(placa, modelo)` e `equipes(codigo)`
- Produces: seção "Histórico de veículos" após autorizações de desconto

- [ ] **Step 1: Atualizar motoristas/[id]/page.tsx**

Substituir o conteúdo de `app/(operacoes)/sofia/motoristas/[id]/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { getMotoristaDocumentos } from '@/lib/sofia/queries'
import { notFound } from 'next/navigation'
import { marcarTermoAssinadoAction } from './_actions'

type HistoricoVeiculo = {
  id: string
  inicio: string
  fim: string | null
  created_at: string
  veiculos: { placa: string; modelo: string } | null
  equipes: { codigo: string } | null
}

export default async function MotoristaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: motorista, error }, documentos, { data: historicoVeiculos }] = await Promise.all([
    supabase.from('motoristas').select('*, equipes(codigo)').eq('id', id).single(),
    getMotoristaDocumentos(id),
    supabase
      .from('veiculo_responsabilidade_historico')
      .select('id, inicio, fim, created_at, veiculos(placa, modelo), equipes(codigo)')
      .eq('motorista_id', id)
      .order('inicio', { ascending: false }),
  ])

  if (error) throw error
  if (!motorista) notFound()

  const termo = documentos.find((d) => d.tipo === 'termo_uso')
  const autorizacoes = documentos.filter((d) => d.tipo === 'autorizacao_desconto')
  const historico = (historicoVeiculos ?? []) as HistoricoVeiculo[]

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{motorista.nome}</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          CNH {motorista.cnh ?? '—'} · {motorista.equipes?.codigo ?? 'sem equipe'}
        </p>
      </div>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
        Documentos assinados
      </h2>

      <div className="flex items-center justify-between p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050] mb-4">
        <div>
          <p className="text-white text-sm font-medium">Termo de Uso de Veículo</p>
          {termo?.assinado && (
            <p className="text-[#4a6080] text-xs mt-1">
              Assinado em {new Date(termo.data_assinatura!).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              termo?.assinado ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
            }`}
          >
            {termo?.assinado ? 'Assinado' : 'Pendente'}
          </span>
          <form action={marcarTermoAssinadoAction.bind(null, id, !termo?.assinado)}>
            <button type="submit" className="text-xs text-[#f05a28] hover:underline">
              {termo?.assinado ? 'Marcar como pendente' : 'Marcar como assinado'}
            </button>
          </form>
        </div>
      </div>

      <h3 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3 mt-6">
        Autorizações de desconto
      </h3>
      {autorizacoes.length === 0 ? (
        <p className="text-[#4a6080] text-sm">
          Nenhuma autorização registrada ainda — gerada ao validar uma multa ou sinistro.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {autorizacoes.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]"
            >
              <span className="text-[#94a3b8] text-sm">
                {a.multa_id ? 'Multa' : 'Sinistro'} ·{' '}
                {a.data_assinatura
                  ? new Date(a.data_assinatura).toLocaleDateString('pt-BR')
                  : '—'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  a.assinado ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                }`}
              >
                {a.assinado ? 'Assinada' : 'Pendente'}
              </span>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3 mt-8">
        Histórico de veículos
      </h3>
      {historico.length === 0 ? (
        <p className="text-[#4a6080] text-sm">Nenhuma troca de veículo registrada ainda.</p>
      ) : (
        <div className="flex flex-col gap-3 border-l-2 border-[#1e3a5f] pl-4">
          {historico.map((h) => (
            <div key={h.id} className="relative">
              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#f05a28]" />
              <p className="text-white text-sm font-mono">{h.veiculos?.placa ?? '—'}</p>
              <p className="text-[#94a3b8] text-xs">{h.veiculos?.modelo ?? ''}</p>
              <p className="text-[#4a6080] text-xs">{h.equipes?.codigo ?? '—'}</p>
              <p className="text-[#4a6080] text-xs">
                {new Date(h.inicio).toLocaleDateString('pt-BR')} →{' '}
                {h.fim ? new Date(h.fim).toLocaleDateString('pt-BR') : 'atual'}
              </p>
              <p className="text-[#4a6080] text-xs">
                Registrado em {new Date(h.created_at).toLocaleString('pt-BR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Build + testes**

```bash
npx tsc --noEmit && npx jest --no-coverage && npx next build
```

Esperar: 0 errors, todos os testes passando.

- [ ] **Step 3: Commit**

```bash
git add app/(operacoes)/sofia/motoristas/[id]/page.tsx
git commit -m "feat: Motorista detalhe — histórico de veículos dirigidos"
```

---

### Task 10: Audit Log — registro de todas as operações

**Files:**
- Create: `sdd-sql-audit-log.sql`
- Create: `lib/sofia/auditLog.ts`
- Modify: `app/(operacoes)/sofia/km/_actions.ts`
- Modify: `app/(operacoes)/sofia/abastecimento/_actions.ts`
- Modify: `app/(operacoes)/sofia/veiculos/_actions.ts`
- Modify: `app/(operacoes)/sofia/checklist/_actions.ts`
- Create: `app/(operacoes)/sofia/audit/page.tsx`

**Interfaces:**
- Produces:
  - `logAudit(tabela, operacao, registroId, descricao): Promise<void>` — chamado em todos os Server Actions após operação bem-sucedida
  - Página `/sofia/audit` com tabela paginada do log (data/hora, badge de operação, tabela, descrição)

- [ ] **Step 1: Criar tabela audit_log no Supabase**

Criar `sdd-sql-audit-log.sql`:

```sql
CREATE TABLE audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tabela text NOT NULL,
  operacao text NOT NULL,
  registro_id text,
  descricao text NOT NULL,
  usuario_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- Apenas usuários autenticados podem ler; inserção via service role ou RLS permissiva
CREATE POLICY "authenticated read" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
```

Executar no Supabase SQL Editor (projeto iyytcavcgukfjnjjrerx). Confirmar que a tabela aparece no Table Editor.

- [ ] **Step 2: Criar lib/sofia/auditLog.ts**

```ts
'use server'
import { createClient } from '@/lib/supabase/server'

type Operacao = 'criou' | 'atualizou' | 'excluiu' | 'desativou'

export async function logAudit(
  tabela: string,
  operacao: Operacao,
  registroId: string | null,
  descricao: string
): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_log').insert({
      tabela,
      operacao,
      registro_id: registroId,
      descricao,
      usuario_id: user?.id ?? null,
    })
  } catch {
    // falha no audit não deve quebrar a operação principal
  }
}
```

- [ ] **Step 3: Adicionar audit em km/_actions.ts**

Ao topo dos imports, adicionar:
```ts
import { logAudit } from '@/lib/sofia/auditLog'
```

Em `lancarKmAction`, após `revalidatePath('/sofia/km')`, adicionar:
```ts
await logAudit('km_diario', 'criou', null, `KM ${km_atual} km lançado — equipe ${equipe_id} (${data})`)
```

Em `deletarKmAction`, após `revalidatePath('/sofia/km')`, adicionar:
```ts
await logAudit('km_diario', 'excluiu', id, 'Lançamento de KM excluído')
```

- [ ] **Step 4: Adicionar audit em abastecimento/_actions.ts**

Ao topo dos imports, adicionar:
```ts
import { logAudit } from '@/lib/sofia/auditLog'
```

Em `lancarAbastecimentoAction`, após `revalidatePath('/sofia/abastecimento')`, adicionar:
```ts
await logAudit('abastecimentos', 'criou', null, `Abastecimento R$ ${valor.toFixed(2)} — veículo ${veiculo_id} (${data})`)
```

Em `deletarAbastecimentoAction`, após `revalidatePath('/sofia/abastecimento')`, adicionar:
```ts
await logAudit('abastecimentos', 'excluiu', id, 'Abastecimento excluído')
```

- [ ] **Step 5: Adicionar audit em veiculos/_actions.ts**

Ao topo dos imports, adicionar:
```ts
import { logAudit } from '@/lib/sofia/auditLog'
```

Em `softDeleteVeiculoAction`, antes do `redirect(...)`, adicionar:
```ts
await logAudit('veiculos', 'desativou', id, 'Veículo desativado (soft-delete)')
```

- [ ] **Step 6: Adicionar audit em checklist/_actions.ts**

Ao topo dos imports, adicionar:
```ts
import { logAudit } from '@/lib/sofia/auditLog'
```

Após o insert do checklist ter sucesso (antes do `if (tipo === 'troca')`), adicionar:
```ts
await logAudit('checklists', 'criou', data.id, `Checklist tipo '${tipo}' criado — veículo ${veiculo_id}`)
```

Dentro do bloco `if (tipo === 'troca')`, após o update de veículo e motorista, adicionar:
```ts
await logAudit('veiculo_responsabilidade_historico', 'criou', null, `Troca de responsável: veículo ${veiculo_id} → equipe ${equipe_destino_id}`)
```

- [ ] **Step 7: Criar página /sofia/audit**

Criar `app/(operacoes)/sofia/audit/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'

type LogEntry = {
  id: string
  tabela: string
  operacao: string
  registro_id: string | null
  descricao: string
  created_at: string
}

const BADGE: Record<string, string> = {
  criou: 'bg-green-900 text-green-300',
  atualizou: 'bg-blue-900 text-blue-300',
  excluiu: 'bg-red-900 text-red-300',
  desativou: 'bg-amber-900 text-amber-300',
}

export default async function AuditPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('audit_log')
    .select('id, tabela, operacao, registro_id, descricao, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  const entries = (data ?? []) as LogEntry[]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Registro de atividades</h1>
        <p className="text-[#4a6080] text-sm mt-1">Últimas 200 operações no sistema</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-[#4a6080] text-sm">Nenhuma atividade registrada ainda.</p>
      ) : (
        <div className="rounded-xl border border-[#1e3a5f] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data/Hora</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Operação</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tabela</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors"
                >
                  <td className="px-4 py-3 text-[#4a6080] whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        BADGE[e.operacao] ?? 'bg-[#1e3a5f] text-[#94a3b8]'
                      }`}
                    >
                      {e.operacao}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">{e.tabela}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{e.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Build**

```bash
npx next build
```

Esperar: 0 errors.

- [ ] **Step 9: Commit**

```bash
git add sdd-sql-audit-log.sql lib/sofia/auditLog.ts app/(operacoes)/sofia/audit/ app/(operacoes)/sofia/km/_actions.ts app/(operacoes)/sofia/abastecimento/_actions.ts app/(operacoes)/sofia/veiculos/_actions.ts app/(operacoes)/sofia/checklist/_actions.ts
git commit -m "feat: audit log — registro de todas as operações do sistema"
```

---

### Task 11: Push e deploy

- [ ] **Step 1: Push para GitHub**

```bash
git push origin master
```

- [ ] **Step 2: Verificar deploy no EasyPanel**

Abrir EasyPanel → Deployments, confirmar novo build disparado. Aguardar conclusão (timestamp posterior ao push).

- [ ] **Step 3: Testar manualmente**

Acessar o sistema e verificar:
- **KM Diário:** selecionar equipe → veículo e motorista aparecem; "Última KM: X km" mostrada; lançar KM menor → erro; lançar corretamente → km_atual do veículo atualizado; histórico aparece; clicar ✕ → pede "gestão de frotas" → excluir
- **Abastecimento:** selecionar equipe → veículo aparece; litros opcional; histórico com delete por confirmação
- **Veículo detalhe:** botão "Desativar veículo" → pede "gestão de frotas" → desativa; veículo some dos dropdowns de KM e Abastecimento
- **Checklist:** botão "ou escolher da galeria" aparece abaixo de cada câmera; cascade equipe → veículo+motorista funciona
- **Motorista detalhe:** seção "Histórico de veículos" aparece com data e hora da troca
- **Audit:** acessar `/sofia/audit` → lista de todas as operações com data/hora, badge de operação e descrição

---

## Self-Review

**Spec coverage:**

| Requisito | Task |
|---|---|
| Excluir veículos (soft-delete) | Task 7 |
| KM: equipe → veículo+motorista auto | Task 5 |
| KM: atualiza km_atual no cadastro | Task 5 (_actions) |
| KM: histórico + delete | Task 5 (page) |
| KM: bloqueio se km menor | Task 5 (_actions, validação server-side) |
| KM: só km_atual (não inicial/final) | Tasks 1, 2, 5 |
| Abastecimento: equipe → veículo auto | Task 6 |
| Abastecimento: litros opcional | Tasks 1, 6 |
| Abastecimento: histórico + delete | Task 6 |
| Checklist: upload galeria | Task 8 |
| **Checklist: cascade equipe→veículo+motorista** | Task 8 |
| Motorista: troca atualiza equipe_id | Task 8 |
| Motorista: histórico de veículos | Task 9 |
| **Todos os deletes: confirmação "gestão de frotas"** | Tasks 3, 5, 6, 7 |
| **KM: resumo por mês (km início / km fim / rodados)** | Tasks 4, 5 |
| **Troca motorista: data e hora no histórico** | Task 9 (created_at) |
| **Abastecimento: campos equipe + valor** | Task 6 (cascade equipe, valor obrigatório) |
| **Audit log: registro de todas as operações** | Task 10 |

**Placeholder scan:** nenhum TBD/TODO.

**Type consistency:** `km_atual: number` definido na Task 2, usado nas Tasks 4, 5. `Abastecimento.litros: number | null` definido na Task 2, respeitado nas Tasks 4, 6. `DeleteConfirmButton` com assinatura `action`, `id`, `label` usada identicamente nas Tasks 5, 6, 7. `KmResumoMensal` definido e retornado por `getKmResumoMensal()` na Task 4, consumido na Task 5. `logAudit(tabela, operacao, registroId, descricao)` definido na Task 10, chamado nas Tasks 5, 6, 7, 8.
