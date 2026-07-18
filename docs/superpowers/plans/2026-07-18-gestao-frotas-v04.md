# Gestão de Frotas v04 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar os 3 pedidos de feedback do cliente (veículo na oficina + provisório, novos tipos de checklist, edição de equipe do veículo) e o achado B-05 da auditoria (chave errada em `km_diario`), conforme `docs/superpowers/specs/2026-07-18-gestao-frotas-v04-design.md`.

**Architecture:** Mudança de schema pequena (2 colunas em `veiculos`, `checklist.equipe_id` nullable, chave de unicidade corrigida em `km_diario`, índice único parcial impedindo a mesma equipe em 2 veículos ativos) + novas Server Actions em `veiculos/_actions.ts` + extensão do fluxo existente de `checklist/_actions.ts` + ajustes de formulário. Segue os padrões já estabelecidos no módulo (Server Actions `'use server'`, gate `isAdminEmail` em ações administrativas, `logAudit` para rastreabilidade, `revalidatePath` após escrita).

**Tech Stack:** Next.js 16 App Router, TypeScript, React 19, Supabase (Postgres), Jest.

## Global Constraints

- Toda ação administrativa nova segue o padrão já usado em `softDeleteVeiculoAction`/`desativarEquipeAction`: checar `isAdminEmail(user.email)` e devolver `{ error: '...' }` amigável se não for admin — nunca deixar a constraint do banco estourar sem tratamento.
- Toda escrita usa `logAudit(tabela, operacao, registroId, descricao)` de `lib/sofia/auditLog.ts`, igual ao resto do módulo.
- Mensagens de erro em português, direcionadas ao usuário final (não termos técnicos).
- `revalidatePath` cobrindo todas as rotas que mostram o dado alterado (`/sofia/veiculos`, `/sofia/veiculos/[id]`, `/sofia/equipes`, `/sofia/disponibilidade` quando relevante).
- Testes usam o mock chainable de `checklist/__tests__/_actions.troca.test.ts` como referência de padrão (`jest.mock('@/lib/supabase/server', ...)`).
- O SQL de migração é um arquivo standalone (`sdd-sql-v04.sql`) que o dono do projeto roda manualmente no Supabase Dashboard — não é executado neste plano, mas o código já assume o schema pós-migração.

---

### Task 1: Migração SQL

**Files:**
- Create: `sdd-sql-v04.sql`

**Interfaces:**
- Produces: colunas `veiculos.previsao_retorno_oficina` (date, nullable), `veiculos.substituto_id` (uuid, nullable, FK `veiculos.id`); `checklist.equipe_id` nullable; constraint única `km_diario(data, veiculo_id)` substituindo `km_diario(data, equipe_id)`; índice único parcial `veiculos_equipe_ativo_uniq` em `veiculos(equipe_id) where equipe_id is not null and status <> 'inativo'`.

- [ ] **Step 1: Escrever o arquivo de migração**

```sql
-- ============================================================
-- Gestão de Frotas v04 — 2026-07-18
-- Feedback do cliente: veículo na oficina + provisório, novos
-- tipos de checklist, vínculo equipe única por veículo.
-- Inclui achado B-05 da auditoria (chave errada em km_diario).
-- ============================================================

-- 1. Veículo na oficina + veículo substituto
alter table public.veiculos add column previsao_retorno_oficina date;
alter table public.veiculos add column substituto_id uuid references public.veiculos(id);

-- 2. 1 equipe ativa por vez (não pode a mesma equipe estar em 2
--    veículos não-inativos ao mesmo tempo — item 3 do feedback)
create unique index veiculos_equipe_ativo_uniq
  on public.veiculos(equipe_id)
  where equipe_id is not null and status <> 'inativo';

-- 3. Checklist: equipe_id passa a ser opcional (tipo 'recebimento'
--    pode não ter equipe ainda)
alter table public.checklist alter column equipe_id drop not null;

-- 4. km_diario: chave de unicidade correta (achado B-05 da auditoria).
--    O nome da constraint abaixo é o gerado por padrão pelo Postgres
--    para "unique(data, equipe_id)" declarado em sdd-sql-passo1.sql.
--    Se o DROP falhar por nome diferente, rodar primeiro:
--      select conname from pg_constraint
--      where conrelid = 'km_diario'::regclass and contype = 'u';
--    e usar o nome retornado no lugar de km_diario_data_equipe_id_key.
alter table public.km_diario drop constraint if exists km_diario_data_equipe_id_key;
alter table public.km_diario add constraint km_diario_data_veiculo_id_key unique (data, veiculo_id);
```

- [ ] **Step 2: Commit**

```bash
git add sdd-sql-v04.sql
git commit -m "docs: migração SQL v04 — oficina/substituto, equipe única por veículo, checklist.equipe_id nullable, chave km_diario"
```

---

### Task 2: Tipos (`lib/sofia/types.ts`)

**Files:**
- Modify: `lib/sofia/types.ts:2` (ChecklistTipo), `lib/sofia/types.ts:22-33` (Veiculo)

**Interfaces:**
- Produces: `ChecklistTipo = 'recebimento' | 'saida' | 'retorno' | 'devolucao' | 'troca' | 'finalizacao_contrato'`; `Veiculo.previsao_retorno_oficina: string | null`; `Veiculo.substituto_id: string | null`.

- [ ] **Step 1: Atualizar `ChecklistTipo`**

Em `lib/sofia/types.ts:2`, trocar:

```ts
export type ChecklistTipo = 'saida' | 'retorno' | 'troca'
```

por:

```ts
export type ChecklistTipo = 'recebimento' | 'saida' | 'retorno' | 'devolucao' | 'troca' | 'finalizacao_contrato'
```

- [ ] **Step 2: Atualizar a interface `Veiculo`**

Em `lib/sofia/types.ts:22-33`, trocar:

```ts
export interface Veiculo {
  id: string
  placa: string
  modelo: string
  ano: number | null
  km_atual: number
  km_contratual_mensal: number | null
  valor_locacao_mensal: number | null
  status: VeiculoStatus
  equipe_id: string | null
  created_at: string
}
```

por:

```ts
export interface Veiculo {
  id: string
  placa: string
  modelo: string
  ano: number | null
  km_atual: number
  km_contratual_mensal: number | null
  valor_locacao_mensal: number | null
  status: VeiculoStatus
  equipe_id: string | null
  previsao_retorno_oficina: string | null
  substituto_id: string | null
  created_at: string
}
```

- [ ] **Step 3: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem novos erros relacionados a `Veiculo` ou `ChecklistTipo` (se algum arquivo construir um objeto `Veiculo` literal sem os 2 campos novos, vai aparecer aqui — nenhum caso conhecido hoje).

- [ ] **Step 4: Commit**

```bash
git add lib/sofia/types.ts
git commit -m "feat(sofia): novos tipos de checklist e campos de oficina/substituto em Veiculo"
```

---

### Task 3: Helper de validação de vínculo equipe↔veículo

**Files:**
- Create: `lib/sofia/veiculos.ts`
- Test: `lib/sofia/__tests__/veiculos.test.ts`

**Interfaces:**
- Produces: `validarVinculoEquipeUnico(supabase, equipeId: string, veiculoIdExcluir?: string): Promise<string | null>` — retorna mensagem de erro em português se a equipe já estiver vinculada a outro veículo não-inativo, ou `null` se estiver livre.
- Consumes: nenhuma interface de tasks anteriores (só o client Supabase já usado em todo o módulo).

- [ ] **Step 1: Escrever o teste**

```ts
// lib/sofia/__tests__/veiculos.test.ts
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'limit']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

import { validarVinculoEquipeUnico } from '../veiculos'

describe('validarVinculoEquipeUnico', () => {
  it('retorna null quando equipeId está vazio', async () => {
    const supabase = { from: jest.fn() } as never
    const result = await validarVinculoEquipeUnico(supabase, '')
    expect(result).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('retorna null quando nenhum veículo não-inativo tem essa equipe', async () => {
    const chain = makeChainable({ data: [] })
    const supabase = { from: jest.fn(() => chain) } as never
    const result = await validarVinculoEquipeUnico(supabase, 'equipe-1')
    expect(result).toBeNull()
  })

  it('retorna mensagem de erro com a placa quando a equipe já está vinculada', async () => {
    const chain = makeChainable({ data: [{ id: 'veiculo-2', placa: 'ABC-1234' }] })
    const supabase = { from: jest.fn(() => chain) } as never
    const result = await validarVinculoEquipeUnico(supabase, 'equipe-1')
    expect(result).toBe('Equipe já vinculada ao veículo ABC-1234')
  })

  it('exclui o próprio veículo da checagem quando veiculoIdExcluir é passado', async () => {
    const chain = makeChainable({ data: [] })
    const supabase = { from: jest.fn(() => chain) } as never
    const result = await validarVinculoEquipeUnico(supabase, 'equipe-1', 'veiculo-1')
    expect(result).toBeNull()
    expect(chain.neq).toHaveBeenCalledWith('id', 'veiculo-1')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest lib/sofia/__tests__/veiculos.test.ts`
Expected: FAIL — `Cannot find module '../veiculos'`

- [ ] **Step 3: Implementar o helper**

```ts
// lib/sofia/veiculos.ts
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Garante a regra "1 equipe por veículo não-inativo": uma equipe não pode
 * estar vinculada a mais de um veículo ativo/em manutenção ao mesmo tempo.
 * Espelha o índice único parcial `veiculos_equipe_ativo_uniq` do banco —
 * checar aqui devolve uma mensagem amigável em vez de deixar a constraint
 * do Postgres estourar sem tratamento.
 */
export async function validarVinculoEquipeUnico(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  equipeId: string,
  veiculoIdExcluir?: string
): Promise<string | null> {
  if (!equipeId) return null

  let query = supabase
    .from('veiculos')
    .select('id, placa')
    .eq('equipe_id', equipeId)
    .neq('status', 'inativo')
    .limit(1)

  if (veiculoIdExcluir) query = query.neq('id', veiculoIdExcluir)

  const { data } = await query

  if (data && (data as { id: string; placa: string }[]).length > 0) {
    return `Equipe já vinculada ao veículo ${(data as { id: string; placa: string }[])[0].placa}`
  }
  return null
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest lib/sofia/__tests__/veiculos.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/sofia/veiculos.ts lib/sofia/__tests__/veiculos.test.ts
git commit -m "feat(sofia): helper validarVinculoEquipeUnico"
```

---

### Task 4: Novas actions de veículo (oficina, substituto, edição de equipe)

**Files:**
- Modify: `app/(operacoes)/sofia/veiculos/_actions.ts`
- Test: `app/(operacoes)/sofia/veiculos/__tests__/_actions.test.ts` (novo)

**Interfaces:**
- Consumes: `validarVinculoEquipeUnico` (Task 3).
- Produces: `atualizarEquipeVeiculoAction(prev, formData): Promise<State>`, `enviarParaOficinaAction(prev, formData): Promise<State>`, `retornarDaOficinaAction(prev, formData): Promise<State>`, `definirSubstitutoAction(prev, formData): Promise<State>` — todas `State = { error?: string; success?: boolean }`, todas admin-only.

- [ ] **Step 1: Escrever os testes**

```ts
// app/(operacoes)/sofia/veiculos/__tests__/_actions.test.ts
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'eq', 'neq', 'limit', 'is']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>
let currentUserEmail: string | null

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUserEmail ? { email: currentUserEmail } : null } })) },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import {
  atualizarEquipeVeiculoAction,
  enviarParaOficinaAction,
  retornarDaOficinaAction,
  definirSubstitutoAction,
} from '../_actions'

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe('actions de veículo — v04', () => {
  beforeEach(() => {
    currentUserEmail = 'jvictorco28@gmail.com' // admin (lib/auth/admins.ts)
    tableResults = {
      veiculos: { error: null },
      veiculo_responsabilidade_historico: { error: null },
    }
  })

  describe('atualizarEquipeVeiculoAction', () => {
    it('bloqueia usuário não-admin', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      const result = await atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: 'e1' }))
      expect(result.error).toBe('Apenas administradores podem editar a equipe do veículo')
    })

    it('bloqueia quando a equipe já está vinculada a outro veículo', async () => {
      tableResults.veiculos = { data: [{ id: 'v2', placa: 'XYZ-9999' }] }
      const result = await atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: 'e1' }))
      expect(result.error).toBe('Equipe já vinculada ao veículo XYZ-9999')
    })

    it('atualiza com sucesso quando a equipe está livre', async () => {
      const result = await atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: 'e1' }))
      expect(result).toEqual({ success: true })
    })

    it('permite desvincular (equipe_id vazio)', async () => {
      const result = await atualizarEquipeVeiculoAction({}, fd({ id: 'v1', equipe_id: '' }))
      expect(result).toEqual({ success: true })
    })
  })

  describe('enviarParaOficinaAction', () => {
    it('bloqueia usuário não-admin', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      const result = await enviarParaOficinaAction({}, fd({ id: 'v1', previsao_retorno_oficina: '2026-08-01' }))
      expect(result.error).toBe('Apenas administradores podem enviar veículo para oficina')
    })

    it('registra com sucesso', async () => {
      const result = await enviarParaOficinaAction({}, fd({ id: 'v1', previsao_retorno_oficina: '2026-08-01' }))
      expect(result).toEqual({ success: true })
    })
  })

  describe('retornarDaOficinaAction', () => {
    it('bloqueia usuário não-admin', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      const result = await retornarDaOficinaAction({}, fd({ id: 'v1' }))
      expect(result.error).toBe('Apenas administradores podem registrar retorno da oficina')
    })

    it('registra com sucesso', async () => {
      const result = await retornarDaOficinaAction({}, fd({ id: 'v1' }))
      expect(result).toEqual({ success: true })
    })
  })

  describe('definirSubstitutoAction', () => {
    it('bloqueia usuário não-admin', async () => {
      currentUserEmail = 'operador@manfac.com.br'
      const result = await definirSubstitutoAction({}, fd({ id: 'v1', substituto_id: 'v2' }))
      expect(result.error).toBe('Apenas administradores podem definir o veículo substituto')
    })

    it('registra com sucesso', async () => {
      const result = await definirSubstitutoAction({}, fd({ id: 'v1', substituto_id: 'v2' }))
      expect(result).toEqual({ success: true })
    })
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx jest app/\(operacoes\)/sofia/veiculos/__tests__/_actions.test.ts`
Expected: FAIL — as 4 funções novas não existem ainda.

- [ ] **Step 3: Implementar as actions**

Substituir o conteúdo de `app/(operacoes)/sofia/veiculos/_actions.ts` por:

```ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/sofia/auditLog'
import { isAdminEmail } from '@/lib/auth/admins'
import { validarVinculoEquipeUnico } from '@/lib/sofia/veiculos'

type State = { error?: string; success?: boolean }

export async function criarVeiculoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const placa = (formData.get('placa') as string).trim().toUpperCase()
  const modelo = (formData.get('modelo') as string).trim()
  const ano = formData.get('ano') ? Number(formData.get('ano')) : null
  const km_atual = Number(formData.get('km_atual') ?? 0)
  const km_contratual_mensal = formData.get('km_contratual_mensal')
    ? Number(formData.get('km_contratual_mensal'))
    : null
  const valor_locacao_mensal = formData.get('valor_locacao_mensal')
    ? Number(formData.get('valor_locacao_mensal'))
    : null
  const equipe_id = (formData.get('equipe_id') as string) || null

  if (!placa || !modelo) return { error: 'Placa e modelo são obrigatórios' }

  const supabase = await createClient()

  if (equipe_id) {
    const conflito = await validarVinculoEquipeUnico(supabase, equipe_id)
    if (conflito) return { error: conflito }
  }

  const { error } = await supabase
    .from('veiculos')
    .insert({ placa, modelo, ano, km_atual, km_contratual_mensal, equipe_id, valor_locacao_mensal })

  if (error) {
    if (error.code === '23505')
      return { error: `Veículo com placa ${placa} já existe` }
    return { error: 'Erro ao criar veículo' }
  }

  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/equipes')
  return { success: true }
}

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
  await logAudit('veiculos', 'desativou', id, 'Veículo desativado (soft-delete)')
  redirect('/sofia/veiculos')
}

export async function atualizarLocacaoVeiculoAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const valor_locacao_mensal = formData.get('valor_locacao_mensal')
    ? Number(formData.get('valor_locacao_mensal'))
    : null

  const supabase = await createClient()
  const { error } = await supabase
    .from('veiculos')
    .update({ valor_locacao_mensal })
    .eq('id', id)

  if (error) {
    console.error('atualizarLocacaoVeiculoAction:', error.message)
    throw new Error('Erro ao atualizar valor de locação')
  }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/custos')
}

export async function atualizarEquipeVeiculoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  const equipe_id = (formData.get('equipe_id') as string) || null
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem editar a equipe do veículo' }

  if (equipe_id) {
    const conflito = await validarVinculoEquipeUnico(supabase, equipe_id, id)
    if (conflito) return { error: conflito }
  }

  const { error } = await supabase.from('veiculos').update({ equipe_id }).eq('id', id)
  if (error) return { error: 'Erro ao atualizar equipe do veículo' }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/equipes')
  await logAudit('veiculos', 'atualizou', id, 'Equipe do veículo atualizada')
  return { success: true }
}

export async function enviarParaOficinaAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  const previsao_retorno_oficina = (formData.get('previsao_retorno_oficina') as string) || null
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem enviar veículo para oficina' }

  const hoje = new Date().toISOString().split('T')[0]
  await supabase
    .from('veiculo_responsabilidade_historico')
    .update({ fim: hoje })
    .eq('veiculo_id', id)
    .is('fim', null)

  const { error } = await supabase
    .from('veiculos')
    .update({ status: 'manutencao', equipe_id: null, previsao_retorno_oficina })
    .eq('id', id)

  if (error) return { error: 'Erro ao enviar veículo para oficina' }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/disponibilidade')
  await logAudit('veiculos', 'atualizou', id, 'Veículo enviado para oficina')
  return { success: true }
}

export async function retornarDaOficinaAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem registrar retorno da oficina' }

  const { error } = await supabase
    .from('veiculos')
    .update({ status: 'ativo', previsao_retorno_oficina: null, substituto_id: null })
    .eq('id', id)

  if (error) return { error: 'Erro ao registrar retorno da oficina' }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/disponibilidade')
  await logAudit('veiculos', 'atualizou', id, 'Veículo retornou da oficina')
  return { success: true }
}

export async function definirSubstitutoAction(
  _prev: State,
  formData: FormData
): Promise<State> {
  const id = formData.get('id') as string
  const substituto_id = (formData.get('substituto_id') as string) || null
  if (!id) return { error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem definir o veículo substituto' }

  const { error } = await supabase.from('veiculos').update({ substituto_id }).eq('id', id)
  if (error) return { error: 'Erro ao definir veículo substituto' }

  revalidatePath(`/sofia/veiculos/${id}`)
  revalidatePath('/sofia/veiculos')
  await logAudit('veiculos', 'atualizou', id, 'Veículo substituto definido')
  return { success: true }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx jest app/\(operacoes\)/sofia/veiculos/__tests__/_actions.test.ts`
Expected: PASS (10 testes)

- [ ] **Step 5: Commit**

```bash
git add "app/(operacoes)/sofia/veiculos/_actions.ts" "app/(operacoes)/sofia/veiculos/__tests__/_actions.test.ts"
git commit -m "feat(sofia): actions de oficina, substituto e edição de equipe do veículo"
```

---

### Task 5: Validação do checklist para os novos tipos

**Files:**
- Modify: `app/(operacoes)/sofia/checklist/_validation.ts`
- Test: `app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts`

**Interfaces:**
- Produces: `ParsedChecklistInput.equipe_id: string | null` (era `string`); `validateChecklistInput` exige equipe só para `saida`/`retorno`/`devolucao`.

- [ ] **Step 1: Ler o teste existente pra entender o padrão**

Run: `cat "app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts"` — usar a estrutura de `describe`/`it` já existente como referência para os novos casos abaixo (não sobrescrever os testes atuais de `saida`/`retorno`/`troca`, só adicionar).

- [ ] **Step 2: Adicionar os novos casos de teste**

Adicionar ao final do `describe('validateChecklistInput', ...)` existente em `app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts`:

```ts
  it('não exige equipe para recebimento', () => {
    const input = baseInput({ tipo: 'recebimento', equipe_id: null, assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('não exige equipe para finalizacao_contrato', () => {
    const input = baseInput({ tipo: 'finalizacao_contrato', equipe_id: null, assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('exige equipe para devolucao', () => {
    const input = baseInput({ tipo: 'devolucao', equipe_id: null, assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBe('Equipe é obrigatória para este tipo de checklist')
  })

  it('aceita devolucao com equipe preenchida', () => {
    const input = baseInput({ tipo: 'devolucao', equipe_id: 'equipe-1', assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })

  it('não exige equipe de origem para troca (só equipe_destino_id)', () => {
    const input = baseInput({ tipo: 'troca', equipe_id: null, equipe_destino_id: 'equipe-2', assinatura_motorista: true })
    expect(validateChecklistInput(input)).toBeNull()
  })
```

Se o arquivo de teste não tiver um helper `baseInput(...)`, criar um no topo do arquivo (mesclando com defaults e overrides), inspecionando primeiro os testes já existentes para replicar exatamente os campos obrigatórios de `ParsedChecklistInput` (`tipo`, `equipe_id`, `veiculo_id`, `motorista_id`, `equipe_destino_id`, `motorista_destino_id`, `observacoes`, `latitude`, `longitude`, `avaria_identificada`, `avaria_descricao`, `chave_entregue`, `cartao_combustivel_entregue`, `assinatura_motorista`, `itens`) — usar `veiculo_id: 'veiculo-1'` como default pra não disparar o erro de veículo obrigatório nesses casos.

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npx jest "app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts"`
Expected: FAIL nos 5 casos novos (mensagem de erro ainda genérica "Tipo, equipe e veículo são obrigatórios" pro recebimento/finalização, e comportamento de troca ainda exige equipe_id).

- [ ] **Step 4: Implementar**

Em `app/(operacoes)/sofia/checklist/_validation.ts`, trocar a interface:

```ts
export interface ParsedChecklistInput {
  tipo: string
  equipe_id: string | null
  veiculo_id: string
  motorista_id: string | null
  equipe_destino_id: string | null
  motorista_destino_id: string | null
  observacoes: string | null
  latitude: number | null
  longitude: number | null
  avaria_identificada: boolean
  avaria_descricao: string | null
  chave_entregue: boolean
  cartao_combustivel_entregue: boolean
  assinatura_motorista: boolean
  itens: ChecklistItens
}
```

Na função `parseChecklistFormData`, trocar a linha:

```ts
  const equipe_id = (formData.get('equipe_id') as string | null) ?? ''
```

por:

```ts
  const equipe_id = (formData.get('equipe_id') as string | null) || null
```

E trocar `validateChecklistInput` por:

```ts
export function validateChecklistInput(input: ParsedChecklistInput): string | null {
  if (!input.tipo || !input.veiculo_id) {
    return 'Tipo e veículo são obrigatórios'
  }
  const exigeEquipe = ['saida', 'retorno', 'devolucao'].includes(input.tipo)
  if (exigeEquipe && !input.equipe_id) {
    return 'Equipe é obrigatória para este tipo de checklist'
  }
  if (input.tipo === 'troca' && !input.equipe_destino_id) {
    return 'Equipe de destino é obrigatória numa troca'
  }
  if (!input.assinatura_motorista) {
    return 'Confirmação do motorista é obrigatória'
  }
  return null
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx jest "app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts"`
Expected: PASS (todos, incluindo os já existentes de `saida`/`retorno`/`troca`)

- [ ] **Step 6: Commit**

```bash
git add "app/(operacoes)/sofia/checklist/_validation.ts" "app/(operacoes)/sofia/checklist/__tests__/_validation.test.ts"
git commit -m "feat(sofia): validação do checklist para recebimento/devolucao/finalizacao_contrato"
```

---

### Task 6: Efeitos colaterais dos novos tipos de checklist

**Files:**
- Modify: `app/(operacoes)/sofia/checklist/_actions.ts`
- Test: `app/(operacoes)/sofia/checklist/__tests__/_actions.devolucao-finalizacao.test.ts` (novo)
- Modify (verificar, não deve quebrar): `app/(operacoes)/sofia/checklist/__tests__/_actions.troca.test.ts`

**Interfaces:**
- Consumes: `parseChecklistFormData`, `validateChecklistInput` (Task 5).
- Produces: `criarChecklistAction` passa a tratar `devolucao` (zera `veiculos.equipe_id`) e `finalizacao_contrato` (`veiculos.status='inativo'`, `equipe_id=null`); generaliza o bloco antigo de `troca` para também cobrir `recebimento` com `equipe_destino_id` preenchido.

- [ ] **Step 1: Escrever o teste dos novos tipos**

```ts
// app/(operacoes)/sofia/checklist/__tests__/_actions.devolucao-finalizacao.test.ts
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['update', 'insert', 'select', 'eq', 'is', 'single']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
    auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })) },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { criarChecklistAction } from '../_actions'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    veiculo_id: 'veiculo-1',
    equipe_id: '',
    equipe_destino_id: '',
    motorista_destino_id: '',
    motorista_id: '',
    observacoes: '',
    assinatura_motorista: 'true',
  }
  for (const [k, v] of Object.entries({ ...defaults, ...fields })) fd.set(k, v)
  return fd
}

describe('criarChecklistAction — devolucao', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { data: { id: 'checklist-1' }, error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('zera a equipe do veículo e fecha o histórico ao devolver', async () => {
    const result = await criarChecklistAction({}, buildFormData({ tipo: 'devolucao', equipe_id: 'equipe-1' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-1' })
  })

  it('surfaces erro se falhar ao zerar a equipe do veículo', async () => {
    tableResults.veiculos = { error: { message: 'falhou' } }
    const result = await criarChecklistAction({}, buildFormData({ tipo: 'devolucao', equipe_id: 'equipe-1' }))
    expect(result.error).toBeTruthy()
  })
})

describe('criarChecklistAction — finalizacao_contrato', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { data: { id: 'checklist-2' }, error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('inativa o veículo ao finalizar contrato', async () => {
    const result = await criarChecklistAction({}, buildFormData({ tipo: 'finalizacao_contrato' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-2' })
  })
})

describe('criarChecklistAction — recebimento com atribuição de equipe', () => {
  beforeEach(() => {
    tableResults = {
      checklist: { data: { id: 'checklist-3' }, error: null },
      veiculo_responsabilidade_historico: { error: null },
      veiculos: { error: null },
    }
  })

  it('atribui a equipe quando equipe_destino_id vem preenchido', async () => {
    const result = await criarChecklistAction(
      {},
      buildFormData({ tipo: 'recebimento', equipe_destino_id: 'equipe-2' })
    )
    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
  })

  it('não mexe em equipe/histórico quando equipe_destino_id vem vazio', async () => {
    const result = await criarChecklistAction({}, buildFormData({ tipo: 'recebimento' }))
    expect(result).toEqual({ success: true, checklistId: 'checklist-3' })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest "app/(operacoes)/sofia/checklist/__tests__/_actions.devolucao-finalizacao.test.ts"`
Expected: FAIL — `criarChecklistAction` ainda não trata `devolucao`/`finalizacao_contrato`/`recebimento` (hoje só grava o checklist puro, sem side effect — o teste de `finalizacao_contrato`/`devolucao` ainda passaria no insert simples, mas o de `recebimento com equipe_destino_id` não vai gerar as chamadas extras esperadas implicitamente pelo mock — rodar mesmo assim pra confirmar a baseline antes da Step 3).

- [ ] **Step 3: Implementar os novos ramos em `criarChecklistAction`**

Em `app/(operacoes)/sofia/checklist/_actions.ts`, trocar o bloco:

```ts
  if (tipo === 'troca') {
    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: insereError } = await supabase.from('veiculo_responsabilidade_historico').insert({
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

    await logAudit('veiculo_responsabilidade_historico', 'criou', null, `Troca de responsável: veículo ${veiculo_id} → equipe ${equipe_destino_id}`)
  }
```

por:

```ts
  const atribuiEquipe = tipo === 'troca' || (tipo === 'recebimento' && !!equipe_destino_id)

  if (atribuiEquipe) {
    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: insereError } = await supabase.from('veiculo_responsabilidade_historico').insert({
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
          'Checklist salvo, mas a atribuição de equipe não foi totalmente registrada. Contate o suporte.',
        checklistId: data.id,
      }
    }

    await logAudit('veiculo_responsabilidade_historico', 'criou', null, `Atribuição de equipe: veículo ${veiculo_id} → equipe ${equipe_destino_id}`)
  } else if (tipo === 'devolucao') {
    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: veiculoError } = await supabase
      .from('veiculos')
      .update({ equipe_id: null })
      .eq('id', veiculo_id)

    if (fechaError || veiculoError) {
      return {
        error: 'Checklist salvo, mas a devolução não foi totalmente registrada. Contate o suporte.',
        checklistId: data.id,
      }
    }

    await logAudit('veiculos', 'atualizou', veiculo_id, `Devolução registrada — veículo ${veiculo_id} sem equipe`)
  } else if (tipo === 'finalizacao_contrato') {
    const hoje = new Date().toISOString().split('T')[0]
    const { error: fechaError } = await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    const { error: veiculoError } = await supabase
      .from('veiculos')
      .update({ status: 'inativo', equipe_id: null })
      .eq('id', veiculo_id)

    if (fechaError || veiculoError) {
      return {
        error: 'Checklist salvo, mas a finalização de contrato não foi totalmente registrada. Contate o suporte.',
        checklistId: data.id,
      }
    }

    await logAudit('veiculos', 'desativou', veiculo_id, `Finalização de contrato registrada via checklist — veículo ${veiculo_id}`)
  }
```

Também trocar, no `insert` de criação do checklist, a linha `equipe_id,` (que já recebe o valor correto de `equipe_id | null` vindo do input parseado na Task 5 — nenhuma mudança de código necessária ali além do que a Task 5 já fez).

- [ ] **Step 4: Rodar os testes novos e o de troca existente**

Run: `npx jest "app/(operacoes)/sofia/checklist/__tests__/_actions"`
Expected: PASS em todos (o teste de troca existente continua passando porque `tipo === 'troca'` ainda entra no mesmo ramo `atribuiEquipe`, com o mesmo comportamento).

- [ ] **Step 5: Commit**

```bash
git add "app/(operacoes)/sofia/checklist/_actions.ts" "app/(operacoes)/sofia/checklist/__tests__/_actions.devolucao-finalizacao.test.ts"
git commit -m "feat(sofia): efeitos colaterais de devolucao, finalizacao_contrato e recebimento no checklist"
```

---

### Task 7: `km_diario` — corrigir chave de conflito (achado B-05)

**Files:**
- Modify: `app/(operacoes)/sofia/km/_actions.ts:104-107`
- Test: `app/(operacoes)/sofia/km/__tests__/_actions.test.ts` (novo)

**Interfaces:**
- Produces: `lancarKmAction` usa `onConflict: 'data,veiculo_id'` em vez de `'data,equipe_id'`.

- [ ] **Step 1: Escrever o teste**

```ts
// app/(operacoes)/sofia/km/__tests__/_actions.test.ts
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'upsert', 'eq', 'gte', 'lt', 'order', 'single', 'maybeSingle']
  for (const m of methods) {
    chain[m] = jest.fn((...args: unknown[]) => {
      if (m === 'upsert') lastUpsertArgs = args
      return chain
    })
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let tableResults: Record<string, TableResult>
let lastUpsertArgs: unknown[] = []

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn((table: string) => makeChainable(tableResults[table])),
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/sofia/auditLog', () => ({ logAudit: jest.fn() }))

import { lancarKmAction } from '../_actions'

function buildFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

describe('lancarKmAction — chave de conflito', () => {
  beforeEach(() => {
    lastUpsertArgs = []
    tableResults = {
      veiculos: { data: { km_atual: 1000 }, error: null },
      km_diario: { error: null },
    }
  })

  it('usa onConflict "data,veiculo_id" em vez de "data,equipe_id"', async () => {
    await lancarKmAction(
      {},
      buildFormData({ equipe_id: 'equipe-1', veiculo_id: 'veiculo-1', km_atual: '1500', data: '2026-07-18' })
    )
    expect(lastUpsertArgs[1]).toEqual({ onConflict: 'data,veiculo_id' })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest "app/(operacoes)/sofia/km/__tests__/_actions.test.ts"`
Expected: FAIL — `lastUpsertArgs[1]` é `{ onConflict: 'data,equipe_id' }`, não `'data,veiculo_id'`.

- [ ] **Step 3: Implementar**

Em `app/(operacoes)/sofia/km/_actions.ts:104-107`, trocar:

```ts
  const { error } = await supabase.from('km_diario').upsert(
    { equipe_id, veiculo_id, motorista_id, km_atual, data, observacoes },
    { onConflict: 'data,equipe_id' }
  )
```

por:

```ts
  const { error } = await supabase.from('km_diario').upsert(
    { equipe_id, veiculo_id, motorista_id, km_atual, data, observacoes },
    { onConflict: 'data,veiculo_id' }
  )
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest "app/(operacoes)/sofia/km/__tests__/_actions.test.ts"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(operacoes)/sofia/km/_actions.ts" "app/(operacoes)/sofia/km/__tests__/_actions.test.ts"
git commit -m "fix(sofia): km_diario usa chave de conflito por veículo (achado B-05 da auditoria)"
```

---

### Task 8: Formulário de checklist — seletor de veículo explícito e novos tipos

**Files:**
- Modify: `app/(operacoes)/sofia/checklist/novo/_form.tsx`

**Interfaces:**
- Consumes: `ChecklistTipo` (Task 2), validação server-side já ajustada (Task 5).
- Sem teste automatizado — este componente não tem cobertura de testes hoje (padrão do módulo: forms são verificados manualmente). Verificação manual no final do plano (Task 10).

- [ ] **Step 1: Adicionar as novas opções de tipo**

Em `app/(operacoes)/sofia/checklist/novo/_form.tsx`, trocar o bloco do `<select name="tipo">`:

```tsx
            <select
              name="tipo"
              required
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              <option value="saida">Saída</option>
              <option value="retorno">Retorno</option>
              <option value="troca">Troca de Responsável</option>
            </select>
```

por:

```tsx
            <select
              name="tipo"
              required
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              <option value="recebimento">Recebimento (retirada da locadora)</option>
              <option value="saida">Saída</option>
              <option value="retorno">Retorno</option>
              <option value="devolucao">Devolução (fica na empresa)</option>
              <option value="troca">Troca de Responsável</option>
              <option value="finalizacao_contrato">Finalização de Contrato</option>
            </select>
```

- [ ] **Step 2: Seletor de veículo explícito para tipos que não derivam da equipe**

Adicionar estado logo abaixo de `const [equipeId, setEquipeId] = useState('')`:

```tsx
  const [veiculoIdManual, setVeiculoIdManual] = useState('')
  const veiculoExplicito = tipo === 'troca' || tipo === 'recebimento' || tipo === 'finalizacao_contrato'
  const exigeEquipe = tipo === 'saida' || tipo === 'retorno' || tipo === 'devolucao'
```

Trocar o campo "Equipe" (select `name="equipe_id"`) pra usar `required={exigeEquipe}` em vez de `required` fixo, e o label pra refletir quando é opcional:

```tsx
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">{exigeEquipe ? 'Equipe *' : 'Equipe (opcional)'}</label>
            <select
              name="equipe_id"
              required={exigeEquipe}
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
```

Trocar o bloco dos hidden inputs + card informativo:

```tsx
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

por:

```tsx
        {veiculoExplicito ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Veículo *</label>
            <select
              name="veiculo_id"
              required
              value={veiculoIdManual}
              onChange={(e) => setVeiculoIdManual(e.target.value)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              {veiculos
                .filter((v) => v.status !== 'inativo')
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.placa} · {v.modelo}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="veiculo_id" value={veiculoDaEquipe?.id ?? ''} />
        )}
        <input type="hidden" name="motorista_id" value={motoristaDaEquipe?.id ?? ''} />

        {/* Card informativo com veículo e motorista da equipe (fluxo equipe-first) */}
        {!veiculoExplicito && equipeId && (
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

        {/* Card informativo com o veículo selecionado manualmente (fluxo veículo explícito) */}
        {veiculoExplicito && veiculoIdManual && (() => {
          const v = veiculos.find((vv) => vv.id === veiculoIdManual)
          if (!v) return null
          return (
            <div className="px-3 py-2.5 rounded-lg bg-[#0d2050] border border-[#1e3a5f] text-sm">
              <p className="text-[#94a3b8]">
                Veículo: <span className="text-white font-mono">{v.placa}</span>{' · '}{v.modelo}
              </p>
              <p className="text-[#4a6080] text-xs mt-0.5">
                Última KM: <span className="text-amber-400 font-mono">{v.km_atual.toLocaleString('pt-BR')} km</span>
              </p>
            </div>
          )
        })()}
```

- [ ] **Step 3: Reaproveitar o bloco de "equipe de destino" para `recebimento`**

Trocar:

```tsx
        {tipo === 'troca' && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[#f05a28]/40 bg-[#0f1f3d]">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#94a3b8]">Equipe de destino *</label>
              <select
                name="equipe_destino_id"
                required
                className="px-3 py-2.5 rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
              >
```

por:

```tsx
        {(tipo === 'troca' || tipo === 'recebimento') && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[#f05a28]/40 bg-[#0f1f3d]">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#94a3b8]">
                {tipo === 'troca' ? 'Equipe de destino *' : 'Equipe de destino (opcional)'}
              </label>
              <select
                name="equipe_destino_id"
                required={tipo === 'troca'}
                className="px-3 py-2.5 rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
              >
```

(o restante do bloco — options de equipes, campo de motorista de destino — não muda.)

- [ ] **Step 4: Rodar o typecheck e o lint**

Run: `npx tsc --noEmit && npx eslint "app/(operacoes)/sofia/checklist/novo/_form.tsx"`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add "app/(operacoes)/sofia/checklist/novo/_form.tsx"
git commit -m "feat(sofia): seletor de veículo explícito e novos tipos no formulário de checklist"
```

---

### Task 9: Tela de detalhe do veículo — oficina, substituto e edição de equipe

**Files:**
- Create: `components/sofia/EditarEquipeVeiculoForm.tsx`
- Create: `components/sofia/OficinaForm.tsx`
- Modify: `app/(operacoes)/sofia/veiculos/[id]/page.tsx`

**Interfaces:**
- Consumes: `atualizarEquipeVeiculoAction`, `enviarParaOficinaAction`, `retornarDaOficinaAction`, `definirSubstitutoAction` (Task 4).
- Sem teste automatizado — mesmo padrão dos outros componentes visuais do módulo. Verificação manual (Task 10).

- [ ] **Step 1: Componente client de edição de equipe**

```tsx
// components/sofia/EditarEquipeVeiculoForm.tsx
'use client'
import { useActionState } from 'react'
import { atualizarEquipeVeiculoAction } from '@/app/(operacoes)/sofia/veiculos/_actions'
import type { Equipe } from '@/lib/sofia/types'

export default function EditarEquipeVeiculoForm({
  veiculoId,
  equipes,
  equipeAtualId,
}: {
  veiculoId: string
  equipes: Equipe[]
  equipeAtualId: string | null
}) {
  const [state, formAction, isPending] = useActionState(atualizarEquipeVeiculoAction, {})

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={veiculoId} />
      {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
      <div className="flex gap-2 items-end">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-[#94a3b8]">Equipe responsável</label>
          <select
            name="equipe_id"
            defaultValue={equipeAtualId ?? ''}
            className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
          >
            <option value="">Sem equipe vinculada</option>
            {equipes.filter((e) => e.ativo).map((e) => (
              <option key={e.id} value={e.id}>{e.codigo}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
        >
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Componente client de oficina (enviar / retornar / definir substituto)**

```tsx
// components/sofia/OficinaForm.tsx
'use client'
import { useActionState } from 'react'
import {
  enviarParaOficinaAction,
  retornarDaOficinaAction,
  definirSubstitutoAction,
} from '@/app/(operacoes)/sofia/veiculos/_actions'
import type { Veiculo } from '@/lib/sofia/types'

export default function OficinaForm({
  veiculo,
  veiculosDisponiveis,
}: {
  veiculo: Veiculo
  veiculosDisponiveis: Veiculo[]
}) {
  const [enviarState, enviarAction, enviarPending] = useActionState(enviarParaOficinaAction, {})
  const [retornarState, retornarAction, retornarPending] = useActionState(retornarDaOficinaAction, {})
  const [substitutoState, substitutoAction, substitutoPending] = useActionState(definirSubstitutoAction, {})

  if (veiculo.status !== 'manutencao') {
    return (
      <form action={enviarAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={veiculo.id} />
        {enviarState.error && <p className="text-red-400 text-xs">{enviarState.error}</p>}
        <div className="flex gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[#94a3b8]">Previsão de retorno</label>
            <input
              type="date"
              name="previsao_retorno_oficina"
              className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
            />
          </div>
          <button
            type="submit"
            disabled={enviarPending}
            className="px-3 py-2 rounded-lg border border-amber-700 text-amber-400 text-sm font-medium hover:bg-amber-950/40 disabled:opacity-50 transition-colors active:scale-95"
          >
            {enviarPending ? 'Enviando...' : 'Enviar para oficina'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-amber-400 text-sm">
        Em manutenção{veiculo.previsao_retorno_oficina
          ? ` — previsão de retorno em ${new Date(`${veiculo.previsao_retorno_oficina}T12:00:00`).toLocaleDateString('pt-BR')}`
          : ''}
      </p>

      <form action={substitutoAction} className="flex gap-2 items-end">
        <input type="hidden" name="id" value={veiculo.id} />
        {substitutoState.error && <p className="text-red-400 text-xs">{substitutoState.error}</p>}
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs text-[#94a3b8]">Veículo substituto</label>
          <select
            name="substituto_id"
            defaultValue={veiculo.substituto_id ?? ''}
            className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]"
          >
            <option value="">Nenhum</option>
            {veiculosDisponiveis.map((v) => (
              <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={substitutoPending}
          className="px-3 py-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] disabled:opacity-50 transition-colors active:scale-95"
        >
          {substitutoPending ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      <form action={retornarAction}>
        <input type="hidden" name="id" value={veiculo.id} />
        {retornarState.error && <p className="text-red-400 text-xs">{retornarState.error}</p>}
        <button
          type="submit"
          disabled={retornarPending}
          className="px-3 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors active:scale-95"
        >
          {retornarPending ? 'Registrando...' : 'Retornar da oficina'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Integrar na página de detalhe**

Em `app/(operacoes)/sofia/veiculos/[id]/page.tsx`, adicionar os imports:

```ts
import { getEquipes, getVeiculos } from '@/lib/sofia/queries'
import EditarEquipeVeiculoForm from '@/components/sofia/EditarEquipeVeiculoForm'
import OficinaForm from '@/components/sofia/OficinaForm'
```

Trocar o `Promise.all` inicial:

```ts
  const [{ data: veiculo }, historico, centroCusto] = await Promise.all([
    supabase.from('veiculos').select('*, equipes(codigo)').eq('id', id).single(),
    getResponsabilidadeHistorico(id),
    getCentroCustoHistorico(id),
  ])
```

por:

```ts
  const [{ data: veiculo }, historico, centroCusto, equipes, todosVeiculos] = await Promise.all([
    supabase.from('veiculos').select('*, equipes(codigo)').eq('id', id).single(),
    getResponsabilidadeHistorico(id),
    getCentroCustoHistorico(id),
    getEquipes(),
    getVeiculos(),
  ])
```

E logo após o `if (!veiculo) notFound()`, calcular as informações de cobertura:

```ts
  const cobrindoEste = todosVeiculos.find((v) => v.substituto_id === veiculo.id)
  const cobertoPor = veiculo.substituto_id
    ? todosVeiculos.find((v) => v.id === veiculo.substituto_id)
    : null
  const veiculosParaSubstituir = todosVeiculos.filter(
    (v) => v.id !== veiculo.id && v.status === 'ativo' && !v.equipe_id
  )
```

Adicionar, logo abaixo do bloco `<h2>Responsável atual</h2>` + card existente (mesma coluna esquerda), o form de edição de equipe:

```tsx
          <div className="mb-6">
            <EditarEquipeVeiculoForm veiculoId={veiculo.id} equipes={equipes} equipeAtualId={veiculo.equipe_id} />
          </div>
```

Adicionar uma nova seção "Oficina" (por exemplo logo antes de "Locação mensal"):

```tsx
      <div className="mt-6">
        <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Oficina</h2>
        <div className="p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050]">
          <OficinaForm veiculo={veiculo} veiculosDisponiveis={veiculosParaSubstituir} />
          {cobertoPor && (
            <p className="text-[#4a6080] text-xs mt-3">Coberto atualmente por: <span className="text-white font-mono">{cobertoPor.placa}</span></p>
          )}
          {cobrindoEste && (
            <p className="text-[#4a6080] text-xs mt-3">Este veículo está cobrindo: <span className="text-white font-mono">{cobrindoEste.placa}</span></p>
          )}
        </div>
      </div>
```

- [ ] **Step 4: Destacar o histórico de responsabilidade (item "descoberta" do feedback)**

Trocar o título:

```tsx
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Histórico de responsabilidade</h2>
```

por:

```tsx
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">📋 Histórico de responsabilidade (uso completo deste veículo)</h2>
```

- [ ] **Step 5: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add components/sofia/EditarEquipeVeiculoForm.tsx components/sofia/OficinaForm.tsx "app/(operacoes)/sofia/veiculos/[id]/page.tsx"
git commit -m "feat(sofia): tela de detalhe do veículo — edição de equipe, oficina e substituto"
```

---

### Task 10: Verificação final

- [ ] **Step 1: Rodar a suíte completa**

Run: `npx jest`
Expected: todos os testes passam (incluindo os pré-existentes não tocados neste plano — exceto o bug pré-existente já conhecido em `abastecimento/__tests__/_actions.test.ts`, que é uma pendência separada, não deste plano).

- [ ] **Step 2: Typecheck e lint do projeto inteiro**

Run: `npx tsc --noEmit && npx eslint app/\(operacoes\)/sofia lib/sofia components/sofia`
Expected: sem erros.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build limpo, sem erros.

- [ ] **Step 4: Verificação manual no navegador (checklist)**

Com `npm run dev` rodando e logado como admin:
1. `/sofia/checklist/novo` — selecionar tipo "Recebimento", confirmar que o campo Equipe fica opcional e aparece um seletor de veículo.
2. Selecionar tipo "Troca de Responsável", confirmar que aparece o seletor de veículo (não mais o card auto-derivado da equipe).
3. `/sofia/veiculos/[id]` de um veículo ativo — usar "Enviar para oficina", confirmar que o status muda para "Manutenção" na listagem e que a equipe some do card "Responsável atual".
4. Na mesma tela, com o veículo em manutenção, testar "Salvar" veículo substituto e depois "Retornar da oficina".
5. Tentar vincular, via `EditarEquipeVeiculoForm`, uma equipe que já está em outro veículo ativo — confirmar que aparece a mensagem de erro em vez de gravar.

- [ ] **Step 5: Commit final (se houver ajustes da verificação manual)**

```bash
git add -A
git commit -m "chore(sofia): ajustes pós-verificação manual da v04"
```
