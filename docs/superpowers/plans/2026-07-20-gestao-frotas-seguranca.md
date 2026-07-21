# Gestão de Frotas — Pacote de Segurança Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os achados P0/P1 de segurança da auditoria (B-01, B-02, B-03, B-04, B-07): RLS aberta, log de auditoria quebrado, desconto salarial sem gate/validação, API fora do middleware, gates de admin inconsistentes — conforme `docs/superpowers/specs/2026-07-20-gestao-frotas-seguranca-design.md`.

**Architecture:** Uma migração SQL nova (função `sofia_has_access()`/`sofia_is_admin()`, 16 policies trocadas, triggers de defesa em profundidade) que o dono do projeto roda manualmente depois — mais um helper `requireAdmin()` centralizado aplicado em toda action hoje sem gate, unificação do log de auditoria em uma função só, e correção do middleware.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (Postgres RLS/triggers), Jest.

## Global Constraints

- `requireAdmin(supabase)` retorna `string | null` (mensagem de erro em português ou `null`); toda action que hoje não tem gate passa a chamar isso e checar antes de qualquer leitura/escrita sensível.
- Actions que usam o padrão `{ error }`/`State` retornam `{ error: msg }` quando `requireAdmin` falha; actions que usam `throw` (arquivo `descontos/_actions.ts`) fazem `throw new Error(msg)`.
- Não trocar gates que já existem (`isAdminEmail` inline) por `requireAdmin()` só por trocar — YAGNI, só onde não existe gate nenhum hoje.
- Toda função SQL/trigger nova espelha exatamente `ADMIN_EMAILS` (`lib/auth/admins.ts`) e a lógica de `hasSystemAccess()` (`lib/auth/systemAccess.ts`) — comentário no SQL avisando que precisa ficar sincronizado manualmente.
- Migração SQL é um arquivo standalone (`sdd-sql-v04-seguranca.sql`) que o humano roda manualmente — não é executada por este plano.

---

### Task 1: Migração SQL — RLS real, função de admin, triggers de defesa em profundidade

**Files:**
- Create: `sdd-sql-v04-seguranca.sql`

**Interfaces:**
- Produces: função `sofia_has_access()`, função `sofia_is_admin()`, 16 policies substituídas, 3 triggers (`multas`, `sinistros`, `km_excedido_desconto`), `audit_log.acao`/`dados` nullable.

- [ ] **Step 1: Escrever o arquivo de migração**

```sql
-- ============================================================
-- Gestão de Frotas — Pacote de Segurança — 2026-07-20
-- Achados da auditoria: B-01 (RLS aberta), B-02 (audit log
-- quebrado), B-03 (desconto sem gate), B-07 (gates inconsistentes)
-- ============================================================
-- IMPORTANTE: as funções abaixo replicam ADMIN_EMAILS
-- (lib/auth/admins.ts) e a lógica de hasSystemAccess()
-- (lib/auth/systemAccess.ts) diretamente em SQL. Se a lista de
-- admins ou o slug 'sofia' mudarem no código, atualizar aqui
-- também — não há sincronização automática entre os dois lados.
-- ============================================================

-- 1. Função de acesso ao sistema "sofia" (espelha hasSystemAccess)
create or replace function public.sofia_has_access()
returns boolean
language sql
security definer
stable
as $$
  select
    (auth.jwt() ->> 'email') in (
      'ewerton.silva@manfac.com.br',
      'jose.guilherme@manfac.com.br',
      'jvictorco28@gmail.com'
    )
    or exists (
      select 1 from public.hub_system_access
      where user_email = lower(trim(auth.jwt() ->> 'email'))
        and system_slug = 'sofia'
        and has_access = true
    );
$$;

-- 2. Função de admin (espelha ADMIN_EMAILS)
create or replace function public.sofia_is_admin()
returns boolean
language sql
security definer
stable
as $$
  select (auth.jwt() ->> 'email') in (
    'ewerton.silva@manfac.com.br',
    'jose.guilherme@manfac.com.br',
    'jvictorco28@gmail.com'
  );
$$;

-- 3. Substituir as 16 policies "using(true)" por "using(sofia_has_access())"
drop policy if exists "authenticated full access" on public.equipes;
create policy "sofia access" on public.equipes for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.veiculos;
create policy "sofia access" on public.veiculos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.motoristas;
create policy "sofia access" on public.motoristas for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.km_diario;
create policy "sofia access" on public.km_diario for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.checklist;
create policy "sofia access" on public.checklist for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.checklist_fotos;
create policy "sofia access" on public.checklist_fotos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.multas;
create policy "sofia access" on public.multas for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.sinistros;
create policy "sofia access" on public.sinistros for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.sinistro_fotos;
create policy "sofia access" on public.sinistro_fotos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.revisoes;
create policy "sofia access" on public.revisoes for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.documentos_veiculo;
create policy "sofia access" on public.documentos_veiculo for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.abastecimentos;
create policy "sofia access" on public.abastecimentos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.motorista_documentos;
create policy "sofia access" on public.motorista_documentos for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.veiculo_responsabilidade_historico;
create policy "sofia access" on public.veiculo_responsabilidade_historico for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.centro_custo_historico;
create policy "sofia access" on public.centro_custo_historico for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.pendencias;
create policy "sofia access" on public.pendencias for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

drop policy if exists "authenticated full access" on public.audit_log;
create policy "sofia access" on public.audit_log for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

-- 4. km_excedido_desconto (tabela criada na migração de autorização, sem
--    policy nomeada "authenticated full access" — confirmar nome real
--    antes de rodar; se o drop abaixo falhar, rodar primeiro:
--    select policyname from pg_policies where tablename = 'km_excedido_desconto';
drop policy if exists "authenticated full access" on public.km_excedido_desconto;
create policy "sofia access" on public.km_excedido_desconto for all to authenticated using (sofia_has_access()) with check (sofia_has_access());

-- 5. Trigger de defesa em profundidade — colunas de autorização/desconto
--    só podem mudar via admin, mesmo que a RLS geral permita a linha
create or replace function public.sofia_bloquear_autorizacao_nao_admin()
returns trigger
language plpgsql
security definer
as $$
begin
  if not public.sofia_is_admin() then
    if TG_TABLE_NAME = 'multas' and (
      new.autorizacao_status is distinct from old.autorizacao_status
      or new.valor_descontado is distinct from old.valor_descontado
      or new.status is distinct from old.status
    ) then
      raise exception 'Apenas administradores podem alterar autorização/desconto de multas';
    end if;
    if TG_TABLE_NAME = 'sinistros' and (
      new.autorizacao_status is distinct from old.autorizacao_status
      or new.valor_descontado is distinct from old.valor_descontado
      or new.status_desconto is distinct from old.status_desconto
    ) then
      raise exception 'Apenas administradores podem alterar autorização/desconto de sinistros';
    end if;
    if TG_TABLE_NAME = 'km_excedido_desconto' and (
      new.autorizacao_status is distinct from old.autorizacao_status
    ) then
      raise exception 'Apenas administradores podem alterar autorização de KM excedido';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_autorizacao_multas on public.multas;
create trigger trg_bloquear_autorizacao_multas
  before update on public.multas
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

drop trigger if exists trg_bloquear_autorizacao_sinistros on public.sinistros;
create trigger trg_bloquear_autorizacao_sinistros
  before update on public.sinistros
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

drop trigger if exists trg_bloquear_autorizacao_km_excedido on public.km_excedido_desconto;
create trigger trg_bloquear_autorizacao_km_excedido
  before update on public.km_excedido_desconto
  for each row execute function public.sofia_bloquear_autorizacao_nao_admin();

-- 6. audit_log: colunas do formato antigo (registrarAuditoria) deixam de
--    ser obrigatórias — a partir de agora só o formato de logAudit é usado
alter table public.audit_log alter column acao drop not null;
alter table public.audit_log alter column dados drop not null;
```

- [ ] **Step 2: Commit**

```bash
git add sdd-sql-v04-seguranca.sql
git commit -m "docs: migração SQL do pacote de segurança — RLS real, admin function, triggers"
```

---

### Task 2: Helper `requireAdmin()`

**Files:**
- Create: `lib/auth/requireAdmin.ts`
- Test: `lib/auth/__tests__/requireAdmin.test.ts`

**Interfaces:**
- Produces: `requireAdmin(supabase: SupabaseClient<any,any,any>): Promise<string | null>` — `null` se admin, mensagem em português se não.

- [ ] **Step 1: Escrever o teste**

```ts
// lib/auth/__tests__/requireAdmin.test.ts
import { requireAdmin } from '../requireAdmin'

function makeSupabase(email: string | null) {
  return {
    auth: {
      getUser: jest.fn(async () => ({ data: { user: email ? { email } : null } })),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

describe('requireAdmin', () => {
  it('retorna null para um e-mail admin', async () => {
    const result = await requireAdmin(makeSupabase('jvictorco28@gmail.com'))
    expect(result).toBeNull()
  })

  it('retorna mensagem de erro para um e-mail não-admin', async () => {
    const result = await requireAdmin(makeSupabase('operador@manfac.com.br'))
    expect(result).toBe('Apenas administradores podem executar esta ação')
  })

  it('retorna mensagem de erro quando não há usuário autenticado', async () => {
    const result = await requireAdmin(makeSupabase(null))
    expect(result).toBe('Apenas administradores podem executar esta ação')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx jest lib/auth/__tests__/requireAdmin.test.ts`
Expected: FAIL — `Cannot find module '../requireAdmin'`

- [ ] **Step 3: Implementar**

```ts
// lib/auth/requireAdmin.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdminEmail } from './admins'

export async function requireAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email)) {
    return 'Apenas administradores podem executar esta ação'
  }
  return null
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx jest lib/auth/__tests__/requireAdmin.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/requireAdmin.ts lib/auth/__tests__/requireAdmin.test.ts
git commit -m "feat(auth): helper requireAdmin"
```

---

### Task 3: Gate + validação de valor em `descontos/_actions.ts`

**Files:**
- Modify: `app/(operacoes)/sofia/descontos/_actions.ts`
- Test: `app/(operacoes)/sofia/descontos/__tests__/_actions.test.ts` (novo)

**Interfaces:**
- Consumes: `requireAdmin` (Task 2).
- Produces: todas as 6 funções do arquivo passam a chamar `requireAdmin()` primeiro; `registrarDescontoMultaAction`/`registrarDescontoSinistroAction` validam `valor_descontado` contra o valor original antes de gravar.

- [ ] **Step 1: Escrever os testes**

```ts
// app/(operacoes)/sofia/descontos/__tests__/_actions.test.ts
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'update', 'eq', 'single']
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
  registrarDescontoMultaAction,
  registrarDescontoSinistroAction,
  desfazerDescontoMultaAction,
  atualizarStatusMultaAction,
} from '../_actions'

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

describe('descontos/_actions — gate de admin e validação de valor', () => {
  beforeEach(() => {
    currentUserEmail = 'jvictorco28@gmail.com'
    tableResults = {
      multas: { data: { valor: 500 }, error: null },
      sinistros: { data: { valor_dano: 1000 }, error: null },
    }
  })

  it('registrarDescontoMultaAction rejeita usuário não-admin', async () => {
    currentUserEmail = 'operador@manfac.com.br'
    await expect(
      registrarDescontoMultaAction(fd({ id: 'm1', valor_descontado: '100', tipo_desconto: 'parcial', autorizacao_assinada: 'true' }))
    ).rejects.toThrow('Apenas administradores podem executar esta ação')
  })

  it('registrarDescontoMultaAction rejeita valor maior que o original', async () => {
    await expect(
      registrarDescontoMultaAction(fd({ id: 'm1', valor_descontado: '600', tipo_desconto: 'total', autorizacao_assinada: 'true' }))
    ).rejects.toThrow('Valor do desconto não pode ser maior que o valor original')
  })

  it('registrarDescontoMultaAction rejeita valor negativo', async () => {
    await expect(
      registrarDescontoMultaAction(fd({ id: 'm1', valor_descontado: '-50', tipo_desconto: 'parcial', autorizacao_assinada: 'true' }))
    ).rejects.toThrow('Valor do desconto inválido')
  })

  it('registrarDescontoMultaAction aceita valor válido', async () => {
    await expect(
      registrarDescontoMultaAction(fd({ id: 'm1', valor_descontado: '200', tipo_desconto: 'parcial', autorizacao_assinada: 'true' }))
    ).resolves.toBeUndefined()
  })

  it('registrarDescontoSinistroAction rejeita valor maior que o dano original', async () => {
    await expect(
      registrarDescontoSinistroAction(fd({ id: 's1', valor_descontado: '2000', tipo_desconto: 'total', autorizacao_assinada: 'true' }))
    ).rejects.toThrow('Valor do desconto não pode ser maior que o valor original')
  })

  it('desfazerDescontoMultaAction rejeita usuário não-admin', async () => {
    currentUserEmail = 'operador@manfac.com.br'
    await expect(desfazerDescontoMultaAction('m1')).rejects.toThrow('Apenas administradores podem executar esta ação')
  })

  it('atualizarStatusMultaAction rejeita usuário não-admin', async () => {
    currentUserEmail = 'operador@manfac.com.br'
    await expect(atualizarStatusMultaAction('m1', 'validada')).rejects.toThrow('Apenas administradores podem executar esta ação')
  })
})
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx jest "app/(operacoes)/sofia/descontos/__tests__/_actions.test.ts"`
Expected: FAIL — nenhuma das funções checa admin nem valida valor hoje.

- [ ] **Step 3: Implementar**

Substituir o conteúdo de `app/(operacoes)/sofia/descontos/_actions.ts` por:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/requireAdmin'

function parseDescontoFormData(formData: FormData) {
  const id = formData.get('id') as string
  const valor_descontado = Number(formData.get('valor_descontado'))
  const tipo_desconto = formData.get('tipo_desconto') as string
  const autorizacao_assinada = formData.get('autorizacao_assinada') === 'true'
  return { id, valor_descontado, tipo_desconto, autorizacao_assinada }
}

export async function atualizarStatusMultaAction(id: string, status: string) {
  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  const { error } = await supabase.from('multas').update({ status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function registrarDescontoMultaAction(formData: FormData): Promise<void> {
  const { id, valor_descontado, tipo_desconto, autorizacao_assinada } = parseDescontoFormData(formData)

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  if (Number.isNaN(valor_descontado) || valor_descontado < 0) {
    throw new Error('Valor do desconto inválido')
  }

  const { data: multa } = await supabase.from('multas').select('valor').eq('id', id).single()
  if (multa && valor_descontado > (multa as { valor: number }).valor) {
    throw new Error('Valor do desconto não pode ser maior que o valor original')
  }

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
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  const { error } = await supabase.from('multas').update({ status: 'validada' }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/multas')
  revalidatePath('/sofia/descontos')
}

export async function atualizarStatusDescontoSinistroAction(id: string, status: string) {
  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  const { error } = await supabase.from('sinistros').update({ status_desconto: status }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}

export async function registrarDescontoSinistroAction(formData: FormData): Promise<void> {
  const { id, valor_descontado, tipo_desconto, autorizacao_assinada } = parseDescontoFormData(formData)

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  if (Number.isNaN(valor_descontado) || valor_descontado < 0) {
    throw new Error('Valor do desconto inválido')
  }

  const { data: sinistro } = await supabase.from('sinistros').select('valor_dano').eq('id', id).single()
  if (sinistro && (sinistro as { valor_dano: number | null }).valor_dano != null && valor_descontado > (sinistro as { valor_dano: number }).valor_dano) {
    throw new Error('Valor do desconto não pode ser maior que o valor original')
  }

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
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

  const { error } = await supabase.from('sinistros').update({ status_desconto: 'validada' }).eq('id', id)
  if (error) throw error
  revalidatePath('/sofia/sinistros')
  revalidatePath('/sofia/descontos')
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx jest "app/(operacoes)/sofia/descontos/__tests__/_actions.test.ts"`
Expected: PASS (7 testes)

- [ ] **Step 5: Commit**

```bash
git add "app/(operacoes)/sofia/descontos/_actions.ts" "app/(operacoes)/sofia/descontos/__tests__/_actions.test.ts"
git commit -m "feat(sofia): gate de admin e validação de valor em descontos/_actions.ts"
```

---

### Task 4: Gate de admin — cluster de autorização financeira fora de `descontos/`

**Files:**
- Modify: `app/(operacoes)/sofia/multas/_actions.ts:50-60` (`enviarParaDescontoEmMassaAction`)
- Modify: `app/(operacoes)/sofia/sinistros/_actions.ts:6-20` (`atualizarAutorizacaoSinistroAction`)
- Modify: `app/(operacoes)/sofia/km/_actions.ts:142-184` (`upsertKmExcedidoStatusAction`, `atualizarAutorizacaoKmExcedidoAction`)
- Modify: `app/(operacoes)/sofia/multas/_actions.ts:113-127` (`atualizarAutorizacaoMultaAction`)
- Test: adicionar casos aos arquivos de teste existentes de cada um (`app/(operacoes)/sofia/multas/__tests__/_actions.test.ts`, criar `app/(operacoes)/sofia/sinistros/__tests__/_actions.test.ts` e `app/(operacoes)/sofia/km/__tests__/_actions.autorizacao.test.ts` se não existirem testes prévios pra essas funções — verificar antes de criar arquivo novo)

**Interfaces:**
- Consumes: `requireAdmin` (Task 2).

- [ ] **Step 1: Verificar testes existentes**

Rodar `find "app/(operacoes)/sofia/multas/__tests__" "app/(operacoes)/sofia/sinistros/__tests__" "app/(operacoes)/sofia/km/__tests__" -type f` pra ver quais arquivos de teste já existem antes de decidir se cria novo arquivo ou adiciona caso num existente.

- [ ] **Step 2: Escrever/estender os testes**

Para cada uma das 4 funções abaixo, adicionar um teste "rejeita usuário não-admin" seguindo o padrão já usado no restante do módulo (mock de `createClient` com `auth.getUser` retornando um e-mail não-admin, assert de erro/throw). Funções que retornam `Promise<void>` e hoje não têm tratamento de erro (`upsertKmExcedidoStatusAction`, `atualizarAutorizacaoKmExcedidoAction`, `atualizarAutorizacaoMultaAction`, `atualizarAutorizacaoSinistroAction` todas retornam `void` sem lançar) precisam continuar retornando `void`, mas agora simplesmente não executam a escrita quando `requireAdmin` falha — teste deve confirmar que a tabela mockada NÃO recebe a chamada de update/upsert quando o usuário não é admin.

Exemplo de caso pra `atualizarAutorizacaoMultaAction` (adaptar o mesmo padrão pras outras 3):
```ts
it('não atualiza quando o usuário não é admin', async () => {
  currentUserEmail = 'operador@manfac.com.br'
  const fd = new FormData()
  fd.set('status', 'autorizado')
  await atualizarAutorizacaoMultaAction('m1', fd)
  expect(updateMock).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run os arquivos de teste tocados nesta task.
Expected: FAIL — nenhuma das 4 funções checa admin hoje.

- [ ] **Step 4: Implementar**

Em cada uma das 4 funções, adicionar logo após `const supabase = await createClient()`:

```ts
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return
```

(as 4 funções já retornam `void`/`Promise<void>` sem parâmetro de erro pro caller — um `return` silencioso após a checagem é consistente com o formato atual; **não mudar a assinatura de retorno dessas funções nesta task**, isso é escopo de uma limpeza de API maior que não está nesta spec). Adicionar o import `import { requireAdmin } from '@/lib/auth/requireAdmin'` no topo de cada um dos 3 arquivos tocados (`multas/_actions.ts`, `sinistros/_actions.ts`, `km/_actions.ts`).

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run os arquivos de teste tocados nesta task, mais a suíte completa dos 3 diretórios (`npx jest "app/(operacoes)/sofia/multas" "app/(operacoes)/sofia/sinistros" "app/(operacoes)/sofia/km"`) pra garantir que nada quebrou.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(operacoes)/sofia/multas" "app/(operacoes)/sofia/sinistros" "app/(operacoes)/sofia/km"
git commit -m "feat(sofia): gate de admin no cluster de autorização financeira (multas/sinistros/km)"
```

---

### Task 5: Gate de admin — ações destrutivas/financeiras sem proteção

**Files:**
- Modify: `app/(operacoes)/sofia/abastecimento/_actions.ts:41-56` (`deletarAbastecimentoAction`)
- Modify: `app/(operacoes)/sofia/km/_actions.ts:125-140` (`deletarKmAction`)
- Modify: `app/(operacoes)/sofia/equipes/_actions.ts:31-35` (`toggleEquipeAction`)
- Modify: `app/(operacoes)/sofia/veiculos/_actions.ts:71-90` (`atualizarLocacaoVeiculoAction`)
- Modify: `app/(operacoes)/sofia/custos/_actions.ts:7-20` (`atualizarCentroCustoAction`)
- Test: adicionar casos aos testes existentes de cada arquivo (verificar quais já existem antes de criar novo).

**Interfaces:**
- Consumes: `requireAdmin` (Task 2).

- [ ] **Step 1: Verificar testes existentes**

Mesma checagem da Task 4 Step 1, pros diretórios `abastecimento`, `km` (já tem `__tests__` de outra task), `equipes`, `veiculos`, `custos`.

- [ ] **Step 2: Escrever/estender os testes**

Um caso "rejeita usuário não-admin" por função, seguindo o padrão de `State`/`throw` de cada arquivo:
- `deletarAbastecimentoAction`/`atualizarCentroCustoAction`: retornam `State`, teste espera `{ error: 'Apenas administradores podem executar esta ação' }`.
- `deletarKmAction`: mesmo padrão `State`.
- `toggleEquipeAction`: hoje retorna `Promise<void>`, sem `State` — segue o mesmo formato da Task 4 (checa e retorna silenciosamente).
- `atualizarLocacaoVeiculoAction`: hoje `Promise<void>` que faz `throw new Error(...)` em caso de falha do Supabase — o gate de admin deve seguir esse mesmo padrão de `throw`, não `return` silencioso (é o único desse grupo que já lança erro pro caller tratar).

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Expected: FAIL nas 5 funções.

- [ ] **Step 4: Implementar**

`deletarAbastecimentoAction`, `atualizarCentroCustoAction`, `deletarKmAction` (padrão `State`):
```ts
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return { error: erroAdmin }
```
(inserir logo após `const supabase = await createClient()` em cada uma, com o import de `requireAdmin` adicionado no topo do arquivo.)

`toggleEquipeAction` (padrão `void` silencioso, igual Task 4):
```ts
export async function toggleEquipeAction(id: string, ativo: boolean) {
  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) return
  await supabase.from('equipes').update({ ativo }).eq('id', id)
  revalidatePath('/sofia/equipes')
}
```

`atualizarLocacaoVeiculoAction` (padrão `throw`):
```ts
export async function atualizarLocacaoVeiculoAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const valor_locacao_mensal = formData.get('valor_locacao_mensal')
    ? Number(formData.get('valor_locacao_mensal'))
    : null

  const supabase = await createClient()
  const erroAdmin = await requireAdmin(supabase)
  if (erroAdmin) throw new Error(erroAdmin)

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
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx jest "app/(operacoes)/sofia/abastecimento" "app/(operacoes)/sofia/km" "app/(operacoes)/sofia/equipes" "app/(operacoes)/sofia/veiculos" "app/(operacoes)/sofia/custos"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(operacoes)/sofia/abastecimento" "app/(operacoes)/sofia/km" "app/(operacoes)/sofia/equipes" "app/(operacoes)/sofia/veiculos" "app/(operacoes)/sofia/custos"
git commit -m "feat(sofia): gate de admin em ações destrutivas/financeiras sem proteção (achado B-07)"
```

---

### Task 6: Rota de API fora do middleware (achado B-04)

**Files:**
- Modify: `middleware.ts:107-121` (config.matcher)
- Modify: `app/api/sofia/veiculo-motorista/route.ts`
- Test: `app/api/sofia/__tests__/veiculo-motorista.route.test.ts` (novo, se não houver teste pra essa rota ainda — verificar antes)

**Interfaces:**
- Produces: `/api/sofia/:path*` no matcher; route handler checa sessão + `hasSystemAccess` antes de qualquer query.

- [ ] **Step 1: Verificar se já existe teste pra essa rota**

Run: `find "app/api/sofia" -iname "*test*"`

- [ ] **Step 2: Escrever o teste**

```ts
// app/api/sofia/__tests__/veiculo-motorista.route.test.ts
type TableResult = { data?: unknown; error?: unknown }

function makeChainable(result: TableResult) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'is', 'maybeSingle']
  for (const m of methods) {
    chain[m] = jest.fn(() => chain)
  }
  chain.then = (resolve: (v: TableResult) => void) => resolve(result)
  return chain
}

let currentUserEmail: string | null
let hasAccessResult: boolean

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: jest.fn(() => makeChainable({ data: null })),
    auth: { getUser: jest.fn(async () => ({ data: { user: currentUserEmail ? { email: currentUserEmail } : null } })) },
  })),
}))

jest.mock('@/lib/auth/systemAccess', () => ({
  hasSystemAccess: jest.fn(async () => hasAccessResult),
}))

import { GET } from '../veiculo-motorista/route'

describe('GET /api/sofia/veiculo-motorista', () => {
  beforeEach(() => {
    currentUserEmail = 'operador@manfac.com.br'
    hasAccessResult = true
  })

  it('retorna 401 sem usuário autenticado', async () => {
    currentUserEmail = null
    const res = await GET(new Request('http://localhost/api/sofia/veiculo-motorista?veiculo_id=v1'))
    expect(res.status).toBe(401)
  })

  it('retorna 403 quando o usuário não tem acesso ao sistema sofia', async () => {
    hasAccessResult = false
    const res = await GET(new Request('http://localhost/api/sofia/veiculo-motorista?veiculo_id=v1'))
    expect(res.status).toBe(403)
  })

  it('retorna 200 quando o usuário tem acesso', async () => {
    const res = await GET(new Request('http://localhost/api/sofia/veiculo-motorista?veiculo_id=v1'))
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx jest "app/api/sofia/__tests__/veiculo-motorista.route.test.ts"`
Expected: FAIL — a rota hoje responde 200 mesmo sem sessão/acesso.

- [ ] **Step 4: Implementar**

Em `middleware.ts`, no array `config.matcher` (linhas 107-121), adicionar `'/api/sofia/:path*'` junto com `'/api/conversor-os/:path*'`.

Em `app/api/sofia/veiculo-motorista/route.ts`, adicionar a checagem no topo de `GET`:

```ts
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { hasSystemAccess } from '@/lib/auth/systemAccess'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const veiculo_id = searchParams.get('veiculo_id')
  const equipe_id = searchParams.get('equipe_id')
  const motorista_id = searchParams.get('motorista_id')

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const acesso = await hasSystemAccess(supabase, user.email, 'sofia')
  if (!acesso) return NextResponse.json({ error: 'Sem acesso ao sistema' }, { status: 403 })

  if (veiculo_id) {
    // ... resto do handler idêntico ao atual, sem mudanças além do bloco acima
```

(o restante do corpo da função, a partir do `if (veiculo_id) { ... }` até o fechamento, permanece exatamente igual ao arquivo atual — só o bloco de checagem de auth/acesso é inserido antes.)

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx jest "app/api/sofia/__tests__/veiculo-motorista.route.test.ts"`
Expected: PASS (3 testes)

- [ ] **Step 6: Commit**

```bash
git add middleware.ts "app/api/sofia/veiculo-motorista/route.ts" "app/api/sofia/__tests__/veiculo-motorista.route.test.ts"
git commit -m "fix(sofia): API de veículo-motorista protegida pelo middleware e checagem direta (achado B-04)"
```

---

### Task 7: Unificar o log de auditoria (achado B-02)

**Files:**
- Modify: `lib/sofia/auditLog.ts` (remover `registrarAuditoria`, manter só `logAudit`)
- Modify: `app/(operacoes)/sofia/multas/_actions.ts` (migrar os 2 call sites de `registrarAuditoria` para `logAudit`)
- Modify: `app/(operacoes)/sofia/audit/page.tsx` (remover o filtro `.not('operacao','is',null)`)
- Test: `lib/sofia/__tests__/auditLog.test.ts` (atualizar/criar — verificar se já existe e o que cobre antes de reescrever)

**Interfaces:**
- Consumes: nada de tasks anteriores.
- Produces: `logAudit` é a única função exportada de `lib/sofia/auditLog.ts`.

- [ ] **Step 1: Ler o teste existente**

Run: `cat lib/sofia/__tests__/auditLog.test.ts` — entender o que já é testado antes de decidir o que muda.

- [ ] **Step 2: Ajustar/escrever os testes**

Remover (ou adaptar) qualquer teste que exercite `registrarAuditoria` — ela deixa de existir. Adicionar, se não existir, um teste confirmando que `logAudit` grava com o formato `{ tabela, operacao, registro_id, descricao, usuario_id }` (sem `acao`/`dados`).

- [ ] **Step 3: Rodar os testes e confirmar o estado esperado antes da mudança**

Run: `npx jest lib/sofia/__tests__/auditLog.test.ts "app/(operacoes)/sofia/multas"`
Expected: os testes que dependem de `registrarAuditoria` devem falhar depois que a função for removida — confirmar isso ao rodar após o Step 4, não antes (esta é uma mudança de remoção/consolidação, não TDD clássico de feature nova).

- [ ] **Step 4: Implementar**

`lib/sofia/auditLog.ts` — substituir o arquivo inteiro por:

```ts
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
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from('audit_log').insert({
      tabela,
      operacao,
      registro_id: registroId,
      descricao,
      usuario_id: user?.id ?? null,
    })
    if (error) console.error('logAudit falhou:', error)
  } catch (error) {
    console.error('logAudit falhou:', error)
  }
}
```

Em `app/(operacoes)/sofia/multas/_actions.ts`:
- Trocar o import `import { registrarAuditoria } from '@/lib/sofia/auditLog'` por `import { logAudit } from '@/lib/sofia/auditLog'`.
- Em `criarMultaAction`, trocar o bloco:
```ts
  await registrarAuditoria(supabase, {
    tabela: 'multas',
    registro_id: row.id,
    acao: 'criacao',
    dados: row,
    usuario_email: user?.email ?? null,
  })
```
por:
```ts
  await logAudit('multas', 'criou', row.id, `Multa registrada — ${tipo_infracao} (${data})`)
```
- Em `excluirMultaAction`, trocar:
```ts
  await registrarAuditoria(supabase, {
    tabela: 'multas',
    registro_id: id,
    acao: 'exclusao',
    dados: multa,
    usuario_email: user.email,
  })
```
por:
```ts
  await logAudit('multas', 'excluiu', id, `Multa excluída — ${multa.tipo_infracao ?? multa.descricao ?? id}`)
```
- Em `excluirMultasEmMassaAction`, trocar o loop:
```ts
  for (const multa of multas ?? []) {
    await registrarAuditoria(supabase, {
      tabela: 'multas',
      registro_id: multa.id,
      acao: 'exclusao',
      dados: multa,
      usuario_email: user.email,
    })
  }
```
por:
```ts
  for (const multa of multas ?? []) {
    await logAudit('multas', 'excluiu', multa.id, `Multa excluída em massa — ${multa.tipo_infracao ?? multa.descricao ?? multa.id}`)
  }
```

Em `app/(operacoes)/sofia/audit/page.tsx`, remover a linha `.not('operacao', 'is', null)` da query.

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx jest lib/sofia/__tests__/auditLog.test.ts "app/(operacoes)/sofia/multas"`
Expected: PASS — nenhuma referência a `registrarAuditoria` sobrando (rodar `grep -rn "registrarAuditoria" app lib` pra confirmar zero ocorrências fora deste plano).

- [ ] **Step 6: Rodar o typecheck**

Run: `npx tsc --noEmit`
Expected: limpo.

- [ ] **Step 7: Commit**

```bash
git add lib/sofia/auditLog.ts "app/(operacoes)/sofia/multas/_actions.ts" "app/(operacoes)/sofia/audit/page.tsx" lib/sofia/__tests__/auditLog.test.ts
git commit -m "fix(sofia): unifica log de auditoria numa função só (achado B-02)"
```

---

### Task 8: Verificação final

- [ ] **Step 1: Suíte completa**

Run: `npx jest`
Expected: todos os testes passam, incluindo o bug de abastecimento que deve ter sido corrigido num pacote paralelo (se ainda não foi, é o único fail esperado, documentado).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "app/(operacoes)/sofia" lib components/sofia`
Expected: limpo.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: limpo.

- [ ] **Step 4: Checklist manual pro João rodar depois de aplicar o SQL no Supabase**

Escrever em `docs/superpowers/plans/2026-07-20-checklist-pos-migracao-seguranca.md`:
```markdown
# Checklist pós-migração de segurança

Depois de rodar `sdd-sql-v04-seguranca.sql` no Supabase e fazer deploy do código:

1. Logar como usuário SEM acesso ao sistema "sofia" no Hub — confirmar que `/sofia/*` redireciona pro dashboard.
2. Logar como usuário COM acesso mas SEM ser admin — confirmar que autorizar/registrar desconto de multa dá erro "Apenas administradores...".
3. Logar como admin — confirmar que autorizar desconto continua funcionando normalmente.
4. Abrir `/sofia/audit` — confirmar que aparecem entradas recentes (criação/exclusão de multa, etc.).
5. Testar o DevTools: com usuário sem acesso ao sofia, tentar `supabase.from('multas').select('*')` no console — deve retornar vazio/erro (RLS bloqueando).
```

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/plans/2026-07-20-checklist-pos-migracao-seguranca.md
git commit -m "docs: checklist de verificação pós-migração de segurança"
```
