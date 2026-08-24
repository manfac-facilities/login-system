# Hub — módulo `/crm` com a lista de leads (modo leitura)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** dar ao comercial da Manfac uma tela no hub que lista os leads capturados pelo site, com controle de acesso próprio, enquanto o CRM de verdade não existe.

**Architecture:** módulo novo no hub seguindo o molde dos três que já existem — slug em `lib/sistemas.ts`, rota no `matcher` do `middleware.ts`, card no dashboard, página em Server Component lendo `site_leads` com service role. **Somente leitura:** nenhuma Server Action, nenhuma escrita, nada que possa corromper a captura.

**Tech Stack:** Next 16.2.9 (custom), React 19.2.4, Tailwind v4, TypeScript, Jest (o hub usa `npm test` → jest, diferente do `manfac-site`, que usa Vitest), `@supabase/supabase-js` (já instalado no hub).

**Spec:** `docs/superpowers/specs/2026-08-21-site-leads-e-crm-terreno-design.md`

## Global Constraints

- **Este Next não é o Next padrão.** Ler `node_modules/next/dist/docs/` antes de escrever Server Component, metadata ou middleware.
- **Pré-requisito duro:** a tabela `site_leads` precisa estar aplicada em produção (`sdd-sql-site-leads.sql`, Task 1 do plano da frente B). Sem ela a página lança.
- Tema do hub — **não é o do site**: fundo `#0a1628`, navy `#0d2050`, laranja `#f05a28`, texto secundário `#94a3b8`, bordas `#1e3a5f`.
- Toda a copy em **português do Brasil**. Node 20.
- Route groups do hub: `(auth)`, `(dashboard)`, `(operacoes)`. Server Actions em `_actions.ts`, formulários em `_form.tsx`, tabelas em `_table.tsx`. Prefixo `_` não vira rota.
- **`site_leads` é registro de captura, imutável.** Este módulo não escreve nela. Status, responsável e notas são do CRM, que cria tabelas `crm_*` referenciando `site_leads.id`.
- A leitura usa `createAdminClient()` de `lib/supabase/admin.ts`, que depende da `SUPABASE_SERVICE_ROLE_KEY` — a mesma que sumiu do processo em 09/08. Se `/admin/acessos` abre, a chave está chegando.

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `lib/sistemas.ts` | registro de módulos do hub | Modificar |
| `middleware.ts` | `matcher` ganha `/crm/:path*` | Modificar |
| `app/(dashboard)/dashboard/page.tsx` | card do módulo | Modificar |
| `lib/leads/formato.ts` | formatação de data, telefone e rótulo de completude | Criar |
| `app/crm/page.tsx` | Server Component: busca e monta a tela | Criar |
| `app/crm/_table.tsx` | apresentação da lista | Criar |

---

### Task 1: Registrar o módulo e fechar a rota

**Files:**
- Modify: `lib/sistemas.ts`
- Modify: `middleware.ts` (bloco `config.matcher`)
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Test: `__tests__/sistemas.test.ts` (criar se não existir)

**Interfaces:**
- Consumes: `hasSystemAccess` de `@/lib/auth/systemAccess`, `isAdmin` de `@/lib/auth/roles`
- Produces: slug `'crm'` disponível para `hub_system_access` e para a `/admin/acessos`

**Por que esta task vem primeiro:** o `middleware.ts` é a fronteira real de autorização, não a UI. Criar a página antes de fechar a rota publica dado pessoal de cliente na internet.

> ⚠️ **Correção de 2026-08-24 — a versão original deste plano estava errada e teria vazado dados.**
> Ela mandava apenas acrescentar a rota ao `matcher`. **Isso não protege nada.** O `matcher`
> decide só **em quais rotas o middleware roda**; quem bloqueia é o `isProtected` mais a
> checagem de acesso dentro da função. Com apenas a entrada no `matcher`, `isProtected`
> seria `false` para `/crm`, o middleware pularia o bloco inteiro e a página renderizaria
> com **service role** — que ignora RLS — para **qualquer visitante, inclusive não
> autenticado**. Não seria "aberta para a Manfac inteira": seria pública na internet.
> O implementador percebeu e corrigiu por conta própria; a revisão confirmou traçando o
> caminho no código. **Rota nova protegida = entrada no `matcher` + `isXPage` em
> `isProtected` + checagem de acesso**, seguindo o padrão de `isSofiaPage` e
> `isConversorOsPage`. E, por defesa em profundidade, a página também checa antes de
> instanciar o client de service role.

- [ ] **Step 1: Escrever o teste que falha**

Criar `__tests__/sistemas.test.ts`:

```ts
import { SISTEMAS } from '@/lib/sistemas'
import { config } from '@/middleware'

describe('registro de sistemas', () => {
  it('inclui o CRM com slug e label', () => {
    const crm = SISTEMAS.find((s) => s.slug === 'crm')
    expect(crm).toBeDefined()
    expect(crm?.label).toBe('CRM')
  })

  it('toda rota de sistema está protegida pelo matcher', () => {
    // Slug fora do matcher = rota aberta. Este teste é a rede contra isso.
    for (const s of SISTEMAS) {
      const esperado = `/${s.slug}/:path*`
      const temRota = config.matcher.some((m) => m === esperado || m === `/${s.slug}`)
      expect(temRota).toBe(true)
    }
  })
})
```

> O slug `dashboard-manutencao` já existe em `SISTEMAS` e **não** está no `matcher`. Este teste vai acusar isso também. **Não silencie o teste:** reporte como DONE_WITH_CONCERNS — é um módulo de outra pessoa e corrigi-lo aqui seria mexer fora do escopo desta task.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- __tests__/sistemas.test.ts`
Expected: FAIL — não há slug `crm`

- [ ] **Step 3: Registrar o sistema**

Em `lib/sistemas.ts`, acrescentar ao array `SISTEMAS`:

```ts
  { slug: 'crm', label: 'CRM' },
```

- [ ] **Step 4: Proteger a rota**

Em `middleware.ts`, **três** mudanças — as três são necessárias, e só a primeira estava na versão original deste plano:

1. Acrescentar `'/crm/:path*',` ao `matcher`, logo depois de `'/conversor-os/:path*',`. Isso faz o middleware **rodar** na rota; não a protege.
2. Acrescentar `isCrmPage` ao cálculo de `isProtected`. **Sem isto a rota não é protegida por nada** — o middleware roda e passa direto.
3. Acrescentar o bloco de checagem, no mesmo formato de `isSofiaPage` e `isConversorOsPage`: se `hasSystemAccess(supabase, email, 'crm')` for falso, `redirect('/dashboard')`. Sem ramo de `403 JSON`, porque não existe `/api/crm` no `matcher`.

O `matcher` `'/crm/:path*'` cobre `/crm` sem sufixo — o grupo de segmentos é opcional na regex gerada, e a doc deste Next confirma que `*` é "zero ou mais".

- [ ] **Step 5: Colocar o card no dashboard**

Em `app/(dashboard)/dashboard/page.tsx`, acrescentar `hasSystemAccess(supabase, user.email ?? '', 'crm')` ao `Promise.all` existente, capturando em `podeCrm`, incluir `podeCrm` no cálculo de `semNada`, e renderizar o card no mesmo padrão visual dos outros três, com destino `/crm`, título **"CRM"** e descrição **"Leads que chegaram pelo formulário do site."**

- [ ] **Step 6: Rodar tudo**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: limpo, exceto a falha esperada de `dashboard-manutencao` no teste do matcher — reportar, não silenciar

- [ ] **Step 7: Commit**

```bash
git add lib/sistemas.ts middleware.ts "app/(dashboard)/dashboard/page.tsx" __tests__/sistemas.test.ts
git commit -m "feat(hub): registra o modulo CRM e fecha a rota no middleware"
```

---

### Task 2: Formatação da lista

**Files:**
- Create: `lib/leads/formato.ts`
- Test: `lib/leads/__tests__/formato.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `type Lead` — espelha as 15 colunas de `site_leads`
  - `formatarData(iso: string): string` — `21/08/2026 14:32`
  - `linkWhatsApp(telefone: string): string` — `https://wa.me/55…` só com dígitos
  - `estaCompleto(lead: Pick<Lead, 'etapa2_em'>): boolean`

- [ ] **Step 1: Escrever os testes que falham**

Criar `lib/leads/__tests__/formato.test.ts`:

```ts
import { formatarData, linkWhatsApp, estaCompleto } from '../formato'

describe('formatarData', () => {
  it('formata em pt-BR com hora', () => {
    expect(formatarData('2026-08-21T17:32:00.000Z')).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)
  })
})

describe('linkWhatsApp', () => {
  it('tira a pontuação do telefone', () => {
    expect(linkWhatsApp('(21) 99999-0000')).toBe('https://wa.me/5521999990000')
  })

  it('não duplica o 55 quando já vem no número', () => {
    expect(linkWhatsApp('+55 21 99999-0000')).toBe('https://wa.me/5521999990000')
  })
})

describe('estaCompleto', () => {
  it('lead com etapa 2 é completo', () => {
    expect(estaCompleto({ etapa2_em: '2026-08-21T17:32:00.000Z' })).toBe(true)
  })

  it('lead sem etapa 2 é parcial — é o que hoje se perde', () => {
    expect(estaCompleto({ etapa2_em: null })).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- lib/leads/__tests__/formato.test.ts`
Expected: FAIL — módulo não encontrado

- [ ] **Step 3: Implementar**

Criar `lib/leads/formato.ts`:

```ts
export type Lead = {
  id: string
  criado_em: string
  atualizado_em: string | null
  path: string
  nome: string
  email: string
  telefone: string
  consentimento: boolean
  consentido_em: string
  empresa: string | null
  cargo: string | null
  localidade: string | null
  unidades: string | null
  resumo: string | null
  etapa2_em: string | null
}

export function formatarData(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
    .format(new Date(iso))
    .replace(',', '')
}

export function linkWhatsApp(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '')
  // O visitante escreve com ou sem o código do país; o wa.me só aceita com.
  const comPais = digitos.startsWith('55') ? digitos : `55${digitos}`
  return `https://wa.me/${comPais}`
}

export function estaCompleto(lead: Pick<Lead, 'etapa2_em'>): boolean {
  return lead.etapa2_em !== null
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm test -- lib/leads/__tests__/formato.test.ts`
Expected: PASS — 5 testes

- [ ] **Step 5: Commit**

```bash
git add lib/leads/formato.ts lib/leads/__tests__/formato.test.ts
git commit -m "feat(hub): formatacao da lista de leads"
```

---

### Task 3: A tela

**Files:**
- Create: `app/crm/page.tsx`
- Create: `app/crm/_table.tsx`
- Test: `app/crm/__tests__/table.test.tsx`

**Interfaces:**
- Consumes: `Lead`, `formatarData`, `linkWhatsApp`, `estaCompleto` (Task 2); `createAdminClient` de `@/lib/supabase/admin`
- Produces: nada

- [ ] **Step 1: Escrever o teste que falha**

Criar `app/crm/__tests__/table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import LeadsTable from '../_table'
import type { Lead } from '@/lib/leads/formato'

const base: Lead = {
  id: '1', criado_em: '2026-08-21T17:32:00.000Z', atualizado_em: null,
  path: 'Obra ou reforma', nome: 'Maria Souza', email: 'maria@empresa.com.br',
  telefone: '(21) 99999-0000', consentimento: true, consentido_em: '2026-08-21T17:32:00.000Z',
  empresa: null, cargo: null, localidade: null, unidades: null, resumo: null, etapa2_em: null,
}

describe('LeadsTable', () => {
  it('mostra estado vazio quando não há lead', () => {
    render(<LeadsTable leads={[]} />)
    expect(screen.getByText(/nenhum lead/i)).toBeTruthy()
  })

  it('distingue lead parcial de completo', () => {
    render(<LeadsTable leads={[base, { ...base, id: '2', etapa2_em: '2026-08-21T17:40:00.000Z', empresa: 'Rede X' }]} />)
    expect(screen.getByText(/parcial/i)).toBeTruthy()
    expect(screen.getByText(/completo/i)).toBeTruthy()
  })

  it('telefone e e-mail são clicáveis — o próximo passo é sempre contatar', () => {
    const { container } = render(<LeadsTable leads={[base]} />)
    expect(container.querySelector('a[href*="wa.me"]')).not.toBeNull()
    expect(container.querySelector('a[href^="mailto:"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm test -- app/crm/__tests__/table.test.tsx`
Expected: FAIL — módulo `../_table` não encontrado

- [ ] **Step 3: Escrever a tabela**

Criar `app/crm/_table.tsx` — componente de apresentação puro, sem `'use client'` (não tem estado nem evento), recebendo `{ leads: Lead[] }`.

Estado vazio, quando `leads.length === 0`:

```tsx
<p className="text-[#94a3b8]">
  Nenhum lead chegou ainda. Assim que alguém preencher o formulário do site, ele aparece aqui.
</p>
```

> Estado vazio explícito, e não uma tabela de zero linhas: tabela vazia se confunde com erro de carregamento, e a diferença importa para quem está esperando lead.

Cada lead: data (`formatarData`), `path`, nome, telefone como link `linkWhatsApp` (com `target="_blank"` e `rel="noopener noreferrer"`), e-mail como `mailto:`, e — quando `estaCompleto` — empresa, localidade e resumo. Etiqueta **"Parcial"** ou **"Completo"**, com a parcial em destaque discreto: é o lead que hoje se perderia, e quem atende precisa saber que tem menos contexto antes de ligar.

- [ ] **Step 4: Escrever a página**

Criar `app/crm/page.tsx` como Server Component:

```tsx
import { createAdminClient } from '@/lib/supabase/admin'
import LeadsTable from './_table'
import type { Lead } from '@/lib/leads/formato'

export const dynamic = 'force-dynamic'

export default async function CrmPage() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('site_leads')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(200)

  if (error) {
    console.error('[crm] falha ao ler site_leads:', error.message)
  }

  return (
    <main className="min-h-screen bg-[#0a1628] px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-white">Leads do site</h1>
        <p className="mt-1 text-sm text-[#94a3b8]">
          Quem preencheu o formulário em manfac.com.br, do mais recente para o mais antigo.
        </p>
        <div className="mt-8">
          <LeadsTable leads={(data ?? []) as Lead[]} />
        </div>
      </div>
    </main>
  )
}
```

> `force-dynamic` porque lead novo tem que aparecer na hora; página estática mostraria a lista do build. O `limit(200)` é teto de segurança — paginação entra quando o volume pedir, e o CRM provavelmente resolve isso antes.

- [ ] **Step 5: Rodar tudo**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: limpo

- [ ] **Step 6: Commit**

```bash
git add app/crm/page.tsx app/crm/_table.tsx app/crm/__tests__/table.test.tsx
git commit -m "feat(hub): tela de leads do site em modo leitura"
```

---

## Encerramento

1. **Code review** — `superpowers:requesting-code-review`, range da Task 1 até a Task 3.
2. **Antes de considerar entregue, com o João:**
   - conferir que `sdd-sql-site-leads.sql` já rodou (senão a página lança);
   - abrir `/admin/acessos` e conceder o sistema **CRM** a quem for do comercial — admin já entra sem concessão;
   - deploy do app **`manfac-login-system`** (o hub), não o `manfac-site`.
3. **Teste de fumaça:** entrar com uma conta **não-admin e sem acesso** ao CRM e confirmar que `/crm` redireciona. Autorização que nunca foi testada negando não foi testada.
