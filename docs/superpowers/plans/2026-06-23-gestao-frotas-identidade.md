# Gestão de Frotas — Identidade & Navegação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the fleet-ops module's display text from "Sofia" to "Gestão de Frotas", fix the navy-on-navy logo on the Hub header, add a way to navigate back to the Hub from inside the module, and fix a CNH-expiry classification bug found while investigating the client's usability complaint.

**Architecture:** Five independent, file-scoped changes inside the existing `manfac-facilities/login-system` Next.js App Router app. No new routes, no schema changes, no new dependencies.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, Jest + jest-environment-jsdom, Supabase.

## Global Constraints

- This is a **display-only** rename. Routes (`/sofia/*`), folder names (`components/sofia`, `lib/sofia`), and internal identifiers (`SofiaPage`) do NOT change.
- Abbreviation for "Gestão de Frotas" where the full name doesn't fit: **"GF"**.
- `components/ui/Logo.tsx`'s default behavior (navy logo, used on all `(auth)` screens) must not change — only an explicit opt-in `variant="white"` changes the asset.
- Creating the `hub.manfac.com.br` subdomain is out of scope for this plan (separate work, later today).
- Follow the existing test convention in this codebase: pure logic in `lib/sofia/*.ts` gets Jest unit tests; presentational `page.tsx` / `Sidebar.tsx` / `Logo.tsx` changes are verified manually in the browser (there are zero React-rendering tests anywhere in `app/(operacoes)/sofia` or `components/sofia` today — don't introduce a new pattern for this work).

---

### Task 1: Fix CNH classification boundaries

**Files:**
- Modify: `lib/sofia/motoristas.ts`
- Test: `lib/sofia/__tests__/motoristas.test.ts`

**Interfaces:**
- Produces: `ClasseCnh` type widens from `'sem_cnh' | 'vencidas' | 'atencao' | 'regulares'` to `'sem_cnh' | 'vencidas' | 'urgente' | 'atencao' | 'regulares'`. `classificarCnh(vencimento: string | null, hoje?: Date): ClasseCnh` keeps the same signature. Task 2 consumes both.

- [ ] **Step 1: Update the test file (failing test)**

Replace `lib/sofia/__tests__/motoristas.test.ts` with:

```ts
import { classificarCnh, cnhStatus } from '../motoristas'

describe('classificarCnh', () => {
  const hoje = new Date('2026-06-17T00:00:00Z')

  it('classifies a missing CNH date as sem_cnh', () => {
    expect(classificarCnh(null, hoje)).toBe('sem_cnh')
  })

  it('classifies a past due date as vencidas', () => {
    expect(classificarCnh('2026-01-01', hoje)).toBe('vencidas')
  })

  it('classifies a date within 30 days as urgente', () => {
    expect(classificarCnh('2026-06-25', hoje)).toBe('urgente')
  })

  it('classifies a date exactly 30 days out as urgente', () => {
    expect(classificarCnh('2026-07-17', hoje)).toBe('urgente')
  })

  it('classifies a date exactly 31 days out as atencao', () => {
    expect(classificarCnh('2026-07-18', hoje)).toBe('atencao')
  })

  it('classifies a date between 31 and 60 days out as atencao', () => {
    expect(classificarCnh('2026-08-01', hoje)).toBe('atencao')
  })

  it('classifies a date more than 60 days out as regulares', () => {
    expect(classificarCnh('2027-01-01', hoje)).toBe('regulares')
  })
})

describe('cnhStatus', () => {
  it('labels a missing CNH date', () => {
    expect(cnhStatus(null).label).toBe('Sem CNH')
  })

  it('labels an expired CNH as VENCIDA', () => {
    expect(cnhStatus('2020-01-01').label).toBe('VENCIDA')
  })
})
```

- [ ] **Step 2: Run the tests to verify the new/changed ones fail**

Run: `npx jest lib/sofia/__tests__/motoristas.test.ts`
Expected: FAIL — `classifies a date within 30 days as urgente` and `classifies a date exactly 30 days out as urgente` fail because `classificarCnh` still returns `'vencidas'` for those inputs.

- [ ] **Step 3: Fix `classificarCnh`**

In `lib/sofia/motoristas.ts`, replace the type and function:

```ts
export type ClasseCnh = 'sem_cnh' | 'vencidas' | 'urgente' | 'atencao' | 'regulares'

export function classificarCnh(vencimento: string | null, hoje: Date = new Date()): ClasseCnh {
  if (!vencimento) return 'sem_cnh'
  const dias = Math.ceil((new Date(vencimento).getTime() - hoje.getTime()) / 86400000)
  if (dias < 0) return 'vencidas'
  if (dias <= 30) return 'urgente'
  if (dias <= 60) return 'atencao'
  return 'regulares'
}
```

`cnhStatus` (below it in the same file) is unchanged — it already labels correctly.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest lib/sofia/__tests__/motoristas.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/sofia/motoristas.ts lib/sofia/__tests__/motoristas.test.ts
git commit -m "fix(sofia): split CNH urgente (0-30d) from vencidas (already expired)"
```

---

### Task 2: Rewire Motoristas page to use the corrected categories

**Files:**
- Modify: `app/(operacoes)/sofia/motoristas/page.tsx`

**Interfaces:**
- Consumes: `ClasseCnh` (now includes `'urgente'`) and `classificarCnh` from Task 1.

- [ ] **Step 1: Add the "Vence em 30 dias" filter pill**

In `app/(operacoes)/sofia/motoristas/page.tsx`, find:

```tsx
const filtroPills: { value: ClasseCnh | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  { value: 'vencidas', label: 'Vencidas' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'regulares', label: 'Regulares' },
]
```

Replace with:

```tsx
const filtroPills: { value: ClasseCnh | undefined; label: string }[] = [
  { value: undefined, label: 'Todos' },
  { value: 'vencidas', label: 'Vencidas' },
  { value: 'urgente', label: 'Vence em 30 dias' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'regulares', label: 'Regulares' },
]
```

- [ ] **Step 2: Replace the `atencao` KPI variable with `urgente`**

Find:

```tsx
  const ativos = motoristas.filter((m) => m.ativo)
  const vencidas = ativos.filter((m) => classificarCnh(m.cnh_vencimento) === 'vencidas')
  const atencao = ativos.filter((m) => classificarCnh(m.cnh_vencimento) === 'atencao')
```

Replace with:

```tsx
  const ativos = motoristas.filter((m) => m.ativo)
  const vencidas = ativos.filter((m) => classificarCnh(m.cnh_vencimento) === 'vencidas')
  const urgente = ativos.filter((m) => classificarCnh(m.cnh_vencimento) === 'urgente')
```

- [ ] **Step 3: Wire the third StatCard to `urgente`**

Find:

```tsx
        <StatCard label="Vencem em 30 dias" value={atencao.length} sub="Agendar renovações" />
```

Replace with:

```tsx
        <StatCard label="Vencem em 30 dias" value={urgente.length} sub="Agendar renovações" />
```

- [ ] **Step 4: Lint and type-check**

Run: `npx eslint "app/(operacoes)/sofia/motoristas/page.tsx" && npx tsc --noEmit`
Expected: no errors (the eslint run confirms `atencao` isn't referenced anywhere else in the file — if it were still declared but unused, `@typescript-eslint/no-unused-vars` would fail it; `tsc` confirms no type errors).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/sofia/motoristas` in a browser logged into the app.
Confirm:
- "CNHs Vencidas" card shows only drivers whose CNH date is in the past
- "Vencem em 30 dias" card shows drivers with 0-30 days left (not 31-60)
- Filter pills row now shows: Todos · Vencidas · Vence em 30 dias · Atenção · Regulares, and clicking each filters the list correctly

- [ ] **Step 6: Commit**

```bash
git add "app/(operacoes)/sofia/motoristas/page.tsx"
git commit -m "fix(sofia): rewire motoristas KPIs/filters to corrected CNH categories"
```

---

### Task 3: Add a white logo variant and use it on the Hub header

**Files:**
- Modify: `components/ui/Logo.tsx`
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Produces: `Logo` gains an optional `variant?: 'navy' | 'white'` prop, default `'navy'` (no behavior change for any existing caller that doesn't pass it).

- [ ] **Step 1: Add the `variant` prop to `Logo`**

Replace `components/ui/Logo.tsx` with:

```tsx
import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  variant?: 'navy' | 'white'
  priority?: boolean
}

const sizes = {
  sm: { width: 120, height: 36 },
  md: { width: 160, height: 48 },
  lg: { width: 200, height: 60 },
}

const sources = {
  navy: '/logo.png',
  white: '/logo-white.png',
}

export default function Logo({ size = 'md', variant = 'navy', priority = false }: LogoProps) {
  const { width, height } = sizes[size]
  return (
    <Image
      src={sources[variant]}
      alt="Manfac Facilities"
      width={width}
      height={height}
      priority={priority}
    />
  )
}
```

- [ ] **Step 2: Use the white variant on the Hub dashboard header**

In `app/(dashboard)/dashboard/page.tsx`, find:

```tsx
          <Logo size="sm" />
```

Replace with:

```tsx
          <Logo size="sm" variant="white" />
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/dashboard` in a browser logged into the app, and separately `http://localhost:3000/login`.
Confirm:
- `/dashboard` header (navy background): logo's arch + "manfac" wordmark are now white and legible; "engenharia" stays orange
- `/login` (light background): logo is unchanged — navy arch + navy "manfac" wordmark, orange "engenharia"

- [ ] **Step 5: Commit**

```bash
git add components/ui/Logo.tsx "app/(dashboard)/dashboard/page.tsx"
git commit -m "fix(hub): add white logo variant, fix illegible navy-on-navy header logo"
```

---

### Task 4: Rename "Sofia" to "Gestão de Frotas" / "GF"

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `components/sofia/Sidebar.tsx`

**Interfaces:** None — text-only change, no exported signatures affected.

- [ ] **Step 1: Rename the Hub card title**

In `app/(dashboard)/dashboard/page.tsx`, find:

```tsx
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Sistema Sofia
              </p>
```

Replace with:

```tsx
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Gestão de Frotas
              </p>
```

- [ ] **Step 2: Rename the mobile top bar title in Sidebar**

In `components/sofia/Sidebar.tsx`, find (inside the `md:hidden` top bar):

```tsx
        <span className="text-white font-bold text-lg">Sofia</span>
```

Replace with:

```tsx
        <span className="text-white font-bold text-lg">GF</span>
```

- [ ] **Step 3: Rename the desktop sidebar header title**

In the same file, find (inside the `<aside>` header row):

```tsx
          <span className="text-white font-bold text-lg">Sofia</span>
```

Replace with:

```tsx
          <span className="text-white font-bold text-lg">Gestão de Frotas</span>
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/dashboard` — confirm the card now says "Gestão de Frotas". Open `http://localhost:3000/sofia` at desktop width (≥768px) — confirm the sidebar header says "Gestão de Frotas". Resize to mobile width (<768px) — confirm the top bar says "GF".

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx" components/sofia/Sidebar.tsx
git commit -m "fix(sofia): rename display text from Sofia to Gestão de Frotas / GF"
```

---

### Task 5: Add a "Voltar ao Hub" link in the Sidebar

**Files:**
- Modify: `components/sofia/Sidebar.tsx`

**Interfaces:** None.

- [ ] **Step 1: Add the link to the mobile top bar**

Find (the block produced by Task 4 Step 2):

```tsx
      <div className="no-print md:hidden w-full flex items-center justify-between bg-[#0d2050] border-b border-[#1e3a5f] px-4 py-3 sticky top-0 z-30">
        <span className="text-white font-bold text-lg">GF</span>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8]"
        >
```

Replace with:

```tsx
      <div className="no-print md:hidden w-full flex items-center justify-between bg-[#0d2050] border-b border-[#1e3a5f] px-4 py-3 sticky top-0 z-30">
        <div className="flex flex-col">
          <span className="text-white font-bold text-lg leading-tight">GF</span>
          <Link href="/dashboard" className="text-[#94a3b8] text-xs hover:text-white transition-colors">
            ← Voltar ao Hub
          </Link>
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="p-2 rounded-lg border border-[#1e3a5f] text-[#94a3b8]"
        >
```

- [ ] **Step 2: Add the link to the desktop sidebar header**

Find (the block produced by Task 4 Step 3):

```tsx
        <div className="flex items-center justify-between mb-6 px-2">
          <span className="text-white font-bold text-lg">Gestão de Frotas</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden text-[#94a3b8] text-xl leading-none"
          >
            ×
          </button>
        </div>
```

Replace with:

```tsx
        <div className="flex items-center justify-between mb-6 px-2">
          <div className="flex flex-col">
            <span className="text-white font-bold text-lg leading-tight">Gestão de Frotas</span>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="text-[#94a3b8] text-xs hover:text-white transition-colors"
            >
              ← Voltar ao Hub
            </Link>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="md:hidden text-[#94a3b8] text-xl leading-none"
          >
            ×
          </button>
        </div>
```

`Link` is already imported in this file (`import Link from 'next/link'` at the top) — no new import needed.

- [ ] **Step 3: Run the existing Sidebar test to confirm nothing broke**

Run: `npx jest components/sofia/__tests__/Sidebar.test.ts`
Expected: PASS — this test only inspects the exported `navSections`/`detailRoutes` data, which this task doesn't touch.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `http://localhost:3000/sofia`.
At desktop width: confirm "← Voltar ao Hub" appears under "Gestão de Frotas" in the sidebar and clicking it navigates to `/dashboard`.
At mobile width: open the hamburger menu, confirm "← Voltar ao Hub" appears under "GF" in the top bar, and separately confirm it also appears inside the opened drawer under "Gestão de Frotas"; clicking it navigates to `/dashboard` and closes the drawer.

- [ ] **Step 5: Commit**

```bash
git add components/sofia/Sidebar.tsx
git commit -m "feat(sofia): add Voltar ao Hub link to sidebar"
```

---

### Task 6: Full regression pass

**Files:** None modified — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: PASS — all suites green, including the Task 1 and Task 5 changes alongside every pre-existing test in `lib/sofia`, `app/(operacoes)/sofia/**`, and `components/sofia`.

- [ ] **Step 2: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual browser pass on both breakpoints**

Run: `npm run dev`. With the browser logged in, visit in order: `/login` (logo unchanged), `/dashboard` (white logo legible, card says "Gestão de Frotas"), `/sofia` desktop width (sidebar says "Gestão de Frotas", "← Voltar ao Hub" present and working), `/sofia` mobile width (top bar says "GF", "← Voltar ao Hub" present and working, hamburger drawer still opens/closes), `/sofia/motoristas` (KPI cards and filter pills match Task 2's verification checklist).

No code changes expected from this task — it exists to catch any interaction between Tasks 1-5 before moving to the next usability front (Multas + Descontos).
