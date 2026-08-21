# Frente B — captura de lead em `/contato` (manfac-site)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fazer o formulário de `/contato` gravar o lead no Supabase antes de abrir o WhatsApp, em duas etapas onde a primeira é obrigatória e já garante o contato, com consentimento LGPD.

**Architecture:** o formulário vira Client Component de duas etapas chamando Server Actions. A validação mora num módulo puro (`lib/leads.ts`), separada do acesso ao banco, para ser testável sem Supabase. As Actions usam **service role** — o navegador nunca fala com o banco. A etapa 1 insere e devolve o `id`; a etapa 2 faz `update` nesse `id`.

**Tech Stack:** Next 16.2.9 (custom), React 19.2.4, Tailwind v4, TypeScript, Vitest + Testing Library, `@supabase/supabase-js` (dependência nova no `manfac-site`).

**Spec:** `docs/superpowers/specs/2026-08-21-site-leads-e-crm-terreno-design.md`

## Global Constraints

- **Este Next não é o Next padrão.** Ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever Server Action, `'use server'` ou qualquer coisa de formulário. Heed deprecation notices.
- **Quirk conhecido:** este Next descarta o espaço entre tag de fechamento e texto seguinte (`</strong> texto` vira `</strong>texto`). Usar `{' '}` explícito.
- Toda a copy em **português do Brasil**. Node 20 (`.nvmrc`).
- Paleta só via tokens de `app/globals.css`: `--ink #00345e`, `--orange #f85e0b`, `--orange-hover #d6520a`, `--muted #6e8894`, `--border #dadad8`, `--surface #f6f6f5`, `--background #ffffff`.
- Testes em `__tests__/` ao lado do código. **`npm test` roda puro — não passar flags de pool** (o flake de worker foi resolvido em `vitest.config.mts` com thread única).
- **Os 3 boxes de "qual é sua demanda" não mudam.** Guard-rail do João, repetido mais de uma vez.
- Número do WhatsApp: só via `WHATSAPP_COMERCIAL` / `WHATSAPP_COMERCIAL_DISPLAY` em `lib/whatsapp.ts`. Nunca hardcodar.
- Texto do consentimento, exato: **"Autorizo a Manfac Engenharia a usar meus dados de contato para responder a esta solicitação."**
- Nenhum segredo em arquivo versionado. A `SUPABASE_SERVICE_ROLE_KEY` só existe no painel do EasyPanel.

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `sdd-sql-site-leads.sql` (raiz do repo) | tabela, índice e RLS fechada | Criar |
| `manfac-site/.env.production` | `SUPABASE_URL` (não é segredo) | Criar |
| `manfac-site/lib/leads.ts` | tipos + validação pura das duas etapas | Criar |
| `manfac-site/lib/supabase/admin.ts` | `createAdminClient()` com service role | Criar |
| `manfac-site/app/contato/_actions.ts` | `registrarLeadAction`, `completarLeadAction` | Criar |
| `manfac-site/lib/whatsapp.ts` | `empresa` e `localidade` viram opcionais | Modificar |
| `manfac-site/components/ContactForm.tsx` | duas etapas, consentimento, honeypot | Modificar |
| `manfac-site/components/ContatoInfo.tsx` | bloco de canais ao lado do formulário | Criar |
| `manfac-site/components/MapaPlaceholder.tsx` | bloco do mapa, provisório e visível | Criar |
| `manfac-site/app/contato/page.tsx` | formulário + info ao lado, mapa embaixo | Modificar |

**Ordem das tasks:** o que é puro primeiro, o que depende de rede por último. A Task 2 (validação) não precisa de banco nem de segredo, então roda e é revisada mesmo que o João ainda não tenha aplicado o SQL.

---

### Task 1: SQL da tabela

**Files:**
- Create: `sdd-sql-site-leads.sql`

**Interfaces:**
- Consumes: nada
- Produces: tabela `site_leads` no projeto `iyytcavcgukfjnjjrerx`

Sem teste automatizado: migration é aplicada à mão no SQL Editor, e este projeto não tem CLI de migration. A verificação é o Step 3.

- [ ] **Step 1: Escrever o arquivo**

Criar `sdd-sql-site-leads.sql` na raiz do repositório:

```sql
-- Captura de leads do site institucional (manfac.com.br).
-- Aplicar à mão no SQL Editor do projeto iyytcavcgukfjnjjrerx (produção).
-- Idempotente: pode ser reaplicado sem estragar nada.

create table if not exists public.site_leads (
  id            uuid primary key default gen_random_uuid(),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz,
  path          text not null,
  nome          text not null,
  email         text not null,
  telefone      text not null,
  consentimento boolean not null,
  consentido_em timestamptz not null,
  empresa       text,
  cargo         text,
  localidade    text,
  unidades      text,
  resumo        text,
  etapa2_em     timestamptz
);

comment on table public.site_leads is
  'Registro de captura do formulário de /contato. Imutável do ponto de vista do CRM: o CRM cria tabelas crm_* referenciando site_leads.id em vez de alterar esta.';

-- Única ordenação que a tela de leitura usa.
create index if not exists site_leads_criado_em_desc on public.site_leads (criado_em desc);

-- RLS ligada e NENHUMA policy: nem anon nem authenticated leem ou escrevem.
-- Todo acesso passa por service role, dentro de Server Action ou Server Component.
-- Mesmo padrão de hub_user_roles e hub_system_access depois do fechamento de 10/08.
alter table public.site_leads enable row level security;
```

- [ ] **Step 2: Confirmar o projeto antes de rodar**

O João roda no SQL Editor. **Conferir no topo da tela que o projeto é `iyytcavcgukfjnjjrerx`** — é o de produção, e é fácil rodar no lugar errado.

- [ ] **Step 3: Verificar que aplicou**

No SQL Editor:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'site_leads'
order by ordinal_position;

select relrowsecurity from pg_class where relname = 'site_leads';
```

Expected: 15 colunas na ordem acima, e `relrowsecurity = true`.

- [ ] **Step 4: Commit**

```bash
git add sdd-sql-site-leads.sql
git commit -m "feat(db): tabela site_leads para captura do formulario do site"
```

---

### Task 2: Validação pura

**Files:**
- Create: `manfac-site/lib/leads.ts`
- Test: `manfac-site/lib/__tests__/leads.test.ts`

**Interfaces:**
- Consumes: `DemandPath` de `@/lib/whatsapp`
- Produces:
  - `type LeadEtapa1 = { path: DemandPath; nome: string; email: string; telefone: string; consentimento: boolean }`
  - `type LeadEtapa2 = { empresa?: string; cargo?: string; localidade?: string; unidades?: string; resumo?: string }`
  - `type Validacao = { ok: true } | { ok: false; erro: string }`
  - `validarEtapa1(d: LeadEtapa1): Validacao`
  - `TEXTO_CONSENTIMENTO: string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `manfac-site/lib/__tests__/leads.test.ts`:

```ts
import { validarEtapa1, TEXTO_CONSENTIMENTO } from '../leads'

const valido = {
  path: 'Obra ou reforma' as const,
  nome: 'Maria Souza',
  email: 'maria@empresa.com.br',
  telefone: '(21) 99999-0000',
  consentimento: true,
}

describe('validarEtapa1', () => {
  it('aceita um lead completo', () => {
    expect(validarEtapa1(valido)).toEqual({ ok: true })
  })

  it('rejeita sem consentimento — é o que dá sentido ao checkbox', () => {
    const r = validarEtapa1({ ...valido, consentimento: false })
    expect(r.ok).toBe(false)
  })

  it('rejeita nome vazio ou só espaços', () => {
    expect(validarEtapa1({ ...valido, nome: '   ' }).ok).toBe(false)
  })

  it('rejeita e-mail sem formato plausível', () => {
    expect(validarEtapa1({ ...valido, email: 'maria@' }).ok).toBe(false)
    expect(validarEtapa1({ ...valido, email: 'maria.empresa.com' }).ok).toBe(false)
  })

  it('rejeita telefone com poucos dígitos', () => {
    expect(validarEtapa1({ ...valido, telefone: '9999' }).ok).toBe(false)
  })

  it('aceita telefone com qualquer pontuação, contando só dígitos', () => {
    expect(validarEtapa1({ ...valido, telefone: '+55 21 9 9999-0000' }).ok).toBe(true)
  })

  it('devolve mensagem em português quando falha', () => {
    const r = validarEtapa1({ ...valido, consentimento: false })
    if (r.ok) throw new Error('deveria ter falhado')
    expect(r.erro.length).toBeGreaterThan(10)
  })

  it('expõe o texto de consentimento aprovado', () => {
    expect(TEXTO_CONSENTIMENTO).toContain('Autorizo a Manfac Engenharia')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run lib/__tests__/leads.test.ts`
Expected: FAIL — módulo `../leads` não encontrado

- [ ] **Step 3: Implementar**

Criar `manfac-site/lib/leads.ts`:

```ts
import type { DemandPath } from './whatsapp'

/**
 * Texto do consentimento LGPD, aprovado pelo João em 21/08/2026.
 *
 * Curto de propósito: cada promessa a mais aqui vira obrigação que a empresa
 * tem de cumprir. Alterar só com aprovação dele.
 */
export const TEXTO_CONSENTIMENTO =
  'Autorizo a Manfac Engenharia a usar meus dados de contato para responder a esta solicitação.'

export type LeadEtapa1 = {
  path: DemandPath
  nome: string
  email: string
  telefone: string
  consentimento: boolean
}

export type LeadEtapa2 = {
  empresa?: string
  cargo?: string
  localidade?: string
  unidades?: string
  resumo?: string
}

export type Validacao = { ok: true } | { ok: false; erro: string }

// Não é RFC 5322 e nem tenta ser: e-mail só se prova enviando. O que se barra
// aqui é erro de digitação óbvio, não endereço inexistente.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validarEtapa1(d: LeadEtapa1): Validacao {
  if (!d.nome?.trim()) {
    return { ok: false, erro: 'Informe seu nome.' }
  }
  if (!EMAIL.test(d.email?.trim() ?? '')) {
    return { ok: false, erro: 'Informe um e-mail válido.' }
  }
  // Só dígitos: o visitante escreve com parênteses, espaço, traço ou +55.
  const digitos = (d.telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) {
    return { ok: false, erro: 'Informe um telefone com DDD.' }
  }
  if (d.consentimento !== true) {
    return { ok: false, erro: 'É preciso autorizar o uso dos seus dados para continuar.' }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd manfac-site && npx vitest run lib/__tests__/leads.test.ts`
Expected: PASS — 8 testes

- [ ] **Step 5: Commit**

```bash
git add manfac-site/lib/leads.ts manfac-site/lib/__tests__/leads.test.ts
git commit -m "feat(manfac-site): validacao pura das duas etapas do lead"
```

---

### Task 3: Mensagem de WhatsApp com campos opcionais

**Files:**
- Modify: `manfac-site/lib/whatsapp.ts:8-33`
- Test: `manfac-site/lib/__tests__/whatsapp.test.ts`

**Interfaces:**
- Consumes: nada novo
- Produces: `ContactFormData` com `empresa` e `localidade` opcionais; `buildWhatsAppMessage` omitindo linha ausente

**Por que esta task existe:** hoje `empresa` e `localidade` são obrigatórios no tipo e no formulário. No modelo de duas etapas eles migram para a etapa 2, que é **opcional** — então a mensagem precisa ser montada sem eles. Os 5 testes existentes continuam válidos e não podem quebrar.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao fim de `manfac-site/lib/__tests__/whatsapp.test.ts`:

```ts
describe('buildWhatsAppMessage com etapa 2 ausente', () => {
  const base = {
    path: 'Avaliação técnica' as const,
    nome: 'João Vitor',
    email: 'joao@empresa.com.br',
    telefone: '21999990000',
  }

  it('monta a mensagem sem empresa e sem localidade', () => {
    const msg = buildWhatsAppMessage(base)
    expect(msg).toContain('João Vitor')
    expect(msg).not.toContain('Empresa:')
    expect(msg).not.toContain('Localidade:')
  })

  it('inclui as linhas quando os campos vêm', () => {
    const msg = buildWhatsAppMessage({ ...base, empresa: 'Rede X', localidade: 'RJ' })
    expect(msg).toContain('Empresa: Rede X')
    expect(msg).toContain('Localidade: RJ')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run lib/__tests__/whatsapp.test.ts`
Expected: FAIL de tipo em `tsc` e/ou linha `Empresa: undefined` na mensagem

- [ ] **Step 3: Implementar**

Em `manfac-site/lib/whatsapp.ts`, trocar `empresa: string` por `empresa?: string` e `localidade: string` por `localidade?: string` no tipo `ContactFormData`, e substituir o corpo de `buildWhatsAppMessage` por:

```ts
export function buildWhatsAppMessage(d: ContactFormData): string {
  const linhas = [
    'Olá! Vim pelo site da Manfac.',
    `Tipo de demanda: ${d.path}`,
    `Nome: ${d.nome}${d.cargo ? ` (${d.cargo})` : ''}`,
  ]
  // A etapa 2 é opcional: cada campo dela só vira linha se existir. Mensagem
  // com "Empresa: undefined" é pior que mensagem curta.
  if (d.empresa) linhas.push(`Empresa: ${d.empresa}`)
  linhas.push(`E-mail: ${d.email}`)
  linhas.push(`Telefone: ${d.telefone}`)
  if (d.localidade) linhas.push(`Localidade: ${d.localidade}`)
  if (d.path === 'Manutenção recorrente' && d.unidades) linhas.push(`Unidades: ${d.unidades}`)
  if (d.resumo) linhas.push(`Resumo: ${d.resumo}`)
  return linhas.join('\n')
}
```

- [ ] **Step 4: Rodar a suíte inteira**

Run: `cd manfac-site && npx vitest run && npx tsc --noEmit`
Expected: tudo passando, incluindo os 5 testes antigos de `whatsapp`

- [ ] **Step 5: Commit**

```bash
git add manfac-site/lib/whatsapp.ts manfac-site/lib/__tests__/whatsapp.test.ts
git commit -m "feat(manfac-site): mensagem de whatsapp monta sem os campos da etapa 2"
```

---

### Task 4: Cliente Supabase e Server Actions

**Files:**
- Create: `manfac-site/lib/supabase/admin.ts`
- Create: `manfac-site/app/contato/_actions.ts`
- Create: `manfac-site/.env.production`
- Modify: `manfac-site/package.json` (dependência)
- Test: `manfac-site/app/contato/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `validarEtapa1`, `LeadEtapa1`, `LeadEtapa2` (Task 2)
- Produces:
  - `createAdminClient(): SupabaseClient`
  - `registrarLeadAction(dados: LeadEtapa1 & { armadilha?: string }): Promise<{ ok: true; id: string } | { ok: false; erro: string }>`
  - `completarLeadAction(id: string, dados: LeadEtapa2): Promise<{ ok: boolean }>`

- [ ] **Step 1: Instalar a dependência**

Run: `cd manfac-site && npm install @supabase/supabase-js`
Expected: instala sem erro de peer dependency com React 19

- [ ] **Step 2: Criar o `.env.production`**

Criar `manfac-site/.env.production`:

```
SUPABASE_URL=https://iyytcavcgukfjnjjrerx.supabase.co
```

> **A URL não é segredo e vai versionada de propósito** — é o mesmo que o hub já faz. Isso deixa **uma única** variável para o João colar no painel do EasyPanel (a service role key), reduzindo a chance de repetir o erro de 09/08, quando a quebra de linha ao colar invalidou tudo silenciosamente. **A chave nunca entra neste arquivo.**

- [ ] **Step 3: Escrever os testes que falham**

Criar `manfac-site/app/contato/__tests__/actions.test.ts`:

```tsx
import { registrarLeadAction, completarLeadAction } from '../_actions'

const insert = vi.fn()
const update = vi.fn()
const eq = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (linha: unknown) => {
        insert(linha)
        return {
          select: () => ({
            single: async () => ({ data: { id: 'lead-1' }, error: null }),
          }),
        }
      },
      update: (campos: unknown) => {
        update(campos)
        return {
          eq: async (col: string, val: string) => {
            eq(col, val)
            return { error: null }
          },
        }
      },
    }),
  }),
}))

const valido = {
  path: 'Obra ou reforma' as const,
  nome: 'Maria Souza',
  email: 'maria@empresa.com.br',
  telefone: '(21) 99999-0000',
  consentimento: true,
}

describe('registrarLeadAction', () => {
  beforeEach(() => {
    insert.mockClear()
    update.mockClear()
    eq.mockClear()
  })

  it('grava e devolve o id', async () => {
    const r = await registrarLeadAction(valido)
    expect(r).toEqual({ ok: true, id: 'lead-1' })
    expect(insert).toHaveBeenCalledTimes(1)
  })

  it('carimba consentido_em junto com o consentimento', async () => {
    await registrarLeadAction(valido)
    const linha = insert.mock.calls[0][0] as Record<string, unknown>
    expect(linha.consentimento).toBe(true)
    expect(typeof linha.consentido_em).toBe('string')
  })

  it('rejeita sem consentimento e NÃO grava', async () => {
    const r = await registrarLeadAction({ ...valido, consentimento: false })
    expect(r.ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejeita e-mail malformado e NÃO grava', async () => {
    const r = await registrarLeadAction({ ...valido, email: 'maria@' })
    expect(r.ok).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('armadilha preenchida: responde sucesso e não grava', async () => {
    const r = await registrarLeadAction({ ...valido, armadilha: 'http://spam' })
    expect(r.ok).toBe(true)
    expect(insert).not.toHaveBeenCalled()
  })
})

describe('completarLeadAction', () => {
  beforeEach(() => {
    insert.mockClear()
    update.mockClear()
    eq.mockClear()
  })

  it('atualiza a linha existente e nunca insere', async () => {
    const r = await completarLeadAction('lead-1', { empresa: 'Rede X' })
    expect(r.ok).toBe(true)
    expect(update).toHaveBeenCalledTimes(1)
    expect(insert).not.toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('id', 'lead-1')
  })

  it('carimba etapa2_em', async () => {
    await completarLeadAction('lead-1', { resumo: 'algo' })
    const campos = update.mock.calls[0][0] as Record<string, unknown>
    expect(typeof campos.etapa2_em).toBe('string')
  })

  it('ignora chamada sem id', async () => {
    const r = await completarLeadAction('', { empresa: 'X' })
    expect(r.ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run app/contato/__tests__/actions.test.ts`
Expected: FAIL — módulo `../_actions` não encontrado

- [ ] **Step 5: Criar o cliente**

Criar `manfac-site/lib/supabase/admin.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com service role. Só pode ser usado em Server Action — nunca em
 * componente de cliente, nunca em rota pública sem validação.
 *
 * A URL vem do .env.production versionado; a chave só existe no painel do
 * EasyPanel. Se a chave não chegar no processo, isto lança na primeira
 * chamada, e é assim mesmo: falhar alto na hora é melhor que gravar nada em
 * silêncio.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createAdminClient(): SupabaseClient<any, any, any> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) throw new Error('SUPABASE_URL não está configurada no ambiente')

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente')

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
```

- [ ] **Step 6: Escrever as Server Actions**

Criar `manfac-site/app/contato/_actions.ts`:

```ts
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { validarEtapa1, type LeadEtapa1, type LeadEtapa2 } from '@/lib/leads'

type ResultadoEtapa1 = { ok: true; id: string } | { ok: false; erro: string }

export async function registrarLeadAction(
  dados: LeadEtapa1 & { armadilha?: string }
): Promise<ResultadoEtapa1> {
  // Campo-armadilha: invisível para gente, irresistível para robô. Responder
  // sucesso sem gravar é de propósito — robô que recebe erro tenta de novo.
  if (dados.armadilha) return { ok: true, id: '' }

  const v = validarEtapa1(dados)
  if (!v.ok) return { ok: false, erro: v.erro }

  const agora = new Date().toISOString()
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('site_leads')
    .insert({
      path: dados.path,
      nome: dados.nome.trim(),
      email: dados.email.trim().toLowerCase(),
      telefone: dados.telefone.trim(),
      consentimento: true,
      consentido_em: agora,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[site_leads] falha ao gravar etapa 1:', error?.message)
    return { ok: false, erro: 'Não conseguimos registrar agora. Fale com a gente no WhatsApp.' }
  }

  return { ok: true, id: data.id as string }
}

export async function completarLeadAction(
  id: string,
  dados: LeadEtapa2
): Promise<{ ok: boolean }> {
  // Sem id não há o que atualizar — e inserir aqui criaria lead duplicado,
  // que é exatamente o que a indexação por id existe para evitar.
  if (!id) return { ok: false }

  const agora = new Date().toISOString()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('site_leads')
    .update({
      empresa: dados.empresa?.trim() || null,
      cargo: dados.cargo?.trim() || null,
      localidade: dados.localidade?.trim() || null,
      unidades: dados.unidades?.trim() || null,
      resumo: dados.resumo?.trim() || null,
      etapa2_em: agora,
      atualizado_em: agora,
    })
    .eq('id', id)

  if (error) {
    console.error('[site_leads] falha ao completar etapa 2:', error.message)
    return { ok: false }
  }
  return { ok: true }
}
```

- [ ] **Step 7: Rodar os testes**

Run: `cd manfac-site && npx vitest run app/contato/__tests__/actions.test.ts`
Expected: PASS — 8 testes

Run: `cd manfac-site && npx tsc --noEmit`
Expected: limpo

- [ ] **Step 8: Commit**

```bash
git add manfac-site/package.json manfac-site/package-lock.json manfac-site/.env.production manfac-site/lib/supabase/admin.ts manfac-site/app/contato/_actions.ts manfac-site/app/contato/__tests__/actions.test.ts
git commit -m "feat(manfac-site): server actions gravando o lead com service role"
```

---

### Task 5: Formulário em duas etapas

**Files:**
- Modify: `manfac-site/components/ContactForm.tsx`
- Test: `manfac-site/components/__tests__/ContactForm.test.tsx`

**Interfaces:**
- Consumes: `registrarLeadAction`, `completarLeadAction` (Task 4), `TEXTO_CONSENTIMENTO` (Task 2), `buildWhatsAppUrl` (Task 3)
- Produces: nada consumido por outras tasks

**Estados do componente:** `path` (já existe) → `etapa` (`1 | 2`) → `leadId` → `erro` → `enviando`.

- [ ] **Step 1: Ler o teste que já existe**

Run: `cd manfac-site && cat components/__tests__/ContactForm.test.tsx`

O arquivo testa o formulário de uma etapa só. **Os casos que verificam campos hoje obrigatórios (`empresa`, `localidade`) precisam migrar para a etapa 2** — não apagar sem ler.

- [ ] **Step 2: Escrever os testes novos**

Acrescentar em `manfac-site/components/__tests__/ContactForm.test.tsx`:

```tsx
vi.mock('@/app/contato/_actions', () => ({
  registrarLeadAction: vi.fn(async () => ({ ok: true, id: 'lead-1' })),
  completarLeadAction: vi.fn(async () => ({ ok: true })),
}))

import { registrarLeadAction, completarLeadAction } from '@/app/contato/_actions'
import userEvent from '@testing-library/user-event'

async function preencherEtapa1(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Obra ou reforma'))
  await user.type(screen.getByLabelText(/Nome/), 'Maria Souza')
  await user.type(screen.getByLabelText(/E-mail/), 'maria@empresa.com.br')
  await user.type(screen.getByLabelText(/Telefone/), '21999990000')
  await user.click(screen.getByRole('checkbox'))
}

describe('ContactForm em duas etapas', () => {
  it('a etapa 1 grava o lead antes de qualquer WhatsApp', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(registrarLeadAction).toHaveBeenCalledTimes(1)
  })

  it('o checkbox de consentimento não vem pré-marcado', () => {
    render(<ContactForm />)
    fireEvent.click(screen.getByText('Obra ou reforma'))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })

  it('a etapa 2 tem saída explícita para quem não quer preencher', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(await screen.findByRole('button', { name: /pular/i })).toBeTruthy()
  })

  it('a etapa 2 indexa ao mesmo lead, nunca cria outro', async () => {
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.type(await screen.findByLabelText(/Empresa/), 'Rede X')
    await user.click(screen.getByRole('button', { name: /enviar/i }))
    expect(completarLeadAction).toHaveBeenCalledWith('lead-1', expect.objectContaining({ empresa: 'Rede X' }))
    expect(registrarLeadAction).toHaveBeenCalledTimes(1)
  })

  it('mostra erro da action sem perder o que foi digitado', async () => {
    ;(registrarLeadAction as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      erro: 'É preciso autorizar o uso dos seus dados para continuar.',
    })
    const user = userEvent.setup()
    render(<ContactForm />)
    await preencherEtapa1(user)
    await user.click(screen.getByRole('button', { name: /continuar/i }))
    expect(await screen.findByText(/autorizar o uso dos seus dados/i)).toBeTruthy()
    expect((screen.getByLabelText(/Nome/) as HTMLInputElement).value).toBe('Maria Souza')
  })
})
```

> Se `@testing-library/user-event` não estiver instalado, instalar como devDependency nesta task: `npm install -D @testing-library/user-event`.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run components/__tests__/ContactForm.test.tsx`
Expected: FAIL — não existe botão "Continuar" nem checkbox

- [ ] **Step 4: Implementar a etapa 1**

Em `ContactForm.tsx`, manter os 3 boxes **exatamente como estão** e trocar o `<form>` único por dois blocos condicionados a `etapa`.

Etapa 1 — campos `nome`, `email`, `telefone`, o checkbox e a armadilha:

```tsx
{/*
  Campo-armadilha: fora da tela, sem tab, invisível para leitor de tela.
  Gente nunca preenche; robô que varre o DOM preenche quase sempre.
*/}
<input
  type="text"
  name="armadilha"
  tabIndex={-1}
  autoComplete="off"
  aria-hidden="true"
  className="absolute left-[-9999px] h-0 w-0 opacity-0"
  value={armadilha}
  onChange={(e) => setArmadilha(e.target.value)}
/>

<label className="flex items-start gap-2.5 text-left md:col-span-2">
  <input
    type="checkbox"
    checked={consentimento}
    onChange={(e) => setConsentimento(e.target.checked)}
    className="mt-0.5 h-4 w-4 flex-none accent-[var(--orange)]"
  />
  <span className="text-[13px] leading-relaxed text-[var(--muted)]">
    {TEXTO_CONSENTIMENTO}
  </span>
</label>
```

O submit da etapa 1 chama `registrarLeadAction`, guarda o `id` e vai para a etapa 2:

```tsx
async function enviarEtapa1(ev: React.FormEvent<HTMLFormElement>) {
  ev.preventDefault()
  if (!path || enviando) return
  setEnviando(true)
  setErro(null)
  const r = await registrarLeadAction({ path, nome, email, telefone, consentimento, armadilha })
  setEnviando(false)
  if (!r.ok) {
    setErro(r.erro)
    return
  }
  setLeadId(r.id)
  setEtapa(2)
}
```

> **O lead está garantido aqui.** Nada de abrir WhatsApp nesta etapa.

- [ ] **Step 5: Implementar a etapa 2**

Campos `empresa`, `cargo`, `localidade`, `unidades` (só em "Manutenção recorrente") e `resumo` — **todos opcionais**, sem asterisco. Dois botões:

```tsx
async function concluir(comContexto: boolean) {
  if (comContexto && leadId) {
    await completarLeadAction(leadId, { empresa, cargo, localidade, unidades, resumo })
  }
  const url = buildWhatsAppUrl({
    path: path!,
    nome, email, telefone,
    ...(comContexto ? { empresa, cargo, localidade, unidades, resumo } : {}),
  })
  window.open(url, '_blank', 'noopener,noreferrer')
}
```

- Botão primário: **"Enviar e falar no WhatsApp"** → `concluir(true)`
- Botão secundário (borda, sem `btn-pump`): **"Pular e falar agora"** → `concluir(false)`

> Sem a segunda saída, quem não quer preencher fecha a aba — e a etapa opcional vira obrigatória na prática, perdendo o lead que este desenho existe para salvar.

- [ ] **Step 6: Rodar os testes**

Run: `cd manfac-site && npx vitest run`
Expected: toda a suíte passando

Run: `cd manfac-site && npx tsc --noEmit && npm run build`
Expected: limpo

- [ ] **Step 7: Commit**

```bash
git add manfac-site/components/ContactForm.tsx manfac-site/components/__tests__/ContactForm.test.tsx manfac-site/package.json manfac-site/package-lock.json
git commit -m "feat(manfac-site): formulario em duas etapas com consentimento e lead garantido na etapa 1"
```

---

### Task 6: Bloco de contato e mapa provisório

**Files:**
- Create: `manfac-site/components/ContatoInfo.tsx`
- Create: `manfac-site/components/MapaPlaceholder.tsx`
- Modify: `manfac-site/app/contato/page.tsx`
- Test: `manfac-site/components/__tests__/ContatoInfo.test.tsx`

**Interfaces:**
- Consumes: `buildDirectWhatsAppUrl`, `WHATSAPP_COMERCIAL_DISPLAY` (já existem), `WhatsAppIcon`
- Produces: `ContatoInfo`, `MapaPlaceholder` — componentes default, sem props

- [ ] **Step 1: Escrever o teste que falha**

Criar `manfac-site/components/__tests__/ContatoInfo.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import ContatoInfo from '../ContatoInfo'
import { WHATSAPP_COMERCIAL_DISPLAY } from '@/lib/whatsapp'

describe('ContatoInfo', () => {
  it('mostra WhatsApp e e-mail como canais diretos', () => {
    const { container } = render(<ContatoInfo />)
    expect(screen.getByText(WHATSAPP_COMERCIAL_DISPLAY)).toBeTruthy()
    expect(container.querySelector('a[href^="mailto:"]')).not.toBeNull()
  })

  it('o link de WhatsApp abre em nova aba com rel seguro', () => {
    const { container } = render(<ContatoInfo />)
    const wa = container.querySelector('a[href*="wa.me"]')
    expect(wa?.getAttribute('target')).toBe('_blank')
    expect(wa?.getAttribute('rel')).toContain('noopener')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run components/__tests__/ContatoInfo.test.tsx`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Criar os dois componentes**

`ContatoInfo.tsx`: cartão com fundo `var(--surface)`, borda `var(--border)`, listando WhatsApp (link `buildDirectWhatsAppUrl('Página de contato')` com ícone) e e-mail `contato@manfac.com.br`. Instagram e telefone fixo **não entram** — o cliente ainda não confirmou se existem.

`MapaPlaceholder.tsx`: bloco de largura total, altura equivalente à do mapa futuro (`h-72 md:h-96`), fundo `var(--surface)` com borda tracejada, e o texto:

```tsx
<p className="text-sm text-[var(--muted)]">
  Endereço a confirmar — o mapa entra assim que a Manfac informar o endereço.
</p>
```

> **Visivelmente provisório é requisito, não descuido.** Mapa apontando para endereço aproximado manda cliente para o lugar errado; um bloco assumidamente vazio, não.

- [ ] **Step 4: Montar a página**

Em `app/contato/page.tsx`, dentro do `<main className="pt-20">`: grid `md:grid-cols-[1.6fr_1fr]` com `<ContactForm />` à esquerda e `<ContatoInfo />` à direita; `<MapaPlaceholder />` embaixo, fora do grid, largura total.

- [ ] **Step 5: Rodar tudo**

Run: `cd manfac-site && npx vitest run && npx tsc --noEmit && npm run build`
Expected: limpo

- [ ] **Step 6: Verificar visualmente**

Run: `cd manfac-site && npm run dev`

Conferir em janela estreita e larga: os 3 boxes intocados; etapa 1 → etapa 2 sem salto de layout; o checkbox não vem marcado; o bloco de contato ao lado no desktop e embaixo no mobile; o mapa provisório legível como provisório.

- [ ] **Step 7: Commit**

```bash
git add manfac-site/components/ContatoInfo.tsx manfac-site/components/MapaPlaceholder.tsx manfac-site/components/__tests__/ContatoInfo.test.tsx manfac-site/app/contato/page.tsx
git commit -m "feat(manfac-site): bloco de contato ao lado do formulario e mapa provisorio"
```

---

## Encerramento

1. **Code review** — `superpowers:requesting-code-review`, range da Task 1 até a Task 6.
2. **Antes do deploy, com o João:**
   - rodar o `sdd-sql-site-leads.sql` (Task 1) e conferir as 15 colunas;
   - pôr `SUPABASE_SERVICE_ROLE_KEY=<valor>` no *Environment* do app **`manfac-site`** do EasyPanel, **numa linha só**;
   - confirmar **pelo log do container**, não pela tela do painel.
3. **Teste de fumaça em produção, obrigatório:** preencher a etapa 1 com dados reais e conferir no Supabase que a linha existe, com `consentimento = true` e `consentido_em` preenchido. Depois preencher a etapa 2 e conferir que **atualizou a mesma linha** em vez de criar outra.
4. **Se a etapa 1 falhar em produção**, o sintoma será a mensagem genérica de erro — a causa quase certa é a chave não ter chegado no processo. Conferir o log antes de mexer em código.

A tela `/crm` de leitura no hub tem plano próprio: `docs/superpowers/plans/2026-08-21-hub-crm-leads.md`.
