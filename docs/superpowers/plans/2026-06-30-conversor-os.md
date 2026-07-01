# Conversor de OS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Conversor OS module — upload a DPSP or D1000 spreadsheet, convert it to the Field Control import format, preview and download the result, and manage per-system access from an admin screen.

**Architecture:** Pure conversion logic lives in framework-free `lib/conversor-os/*` modules (parsing rows → mapping → dedupe/validation → output workbook), each independently unit-tested. A single Route Handler (`POST /api/conversor-os/processar`) wires those modules together for one request/response cycle — it receives the uploaded file, returns JSON with a preview, error list, and the converted file as base64. The browser is responsible for triggering the actual download and uploading the converted file to Supabase Storage (same client-side-upload pattern already used by `checklist-fotos`), then a Server Action persists the log row. Access control is centralized in `middleware.ts` using two small, independently-tested helpers: `isAdminEmail` (existing) and the new `hasSystemAccess`.

**Tech Stack:** Next.js 16.2.9 (App Router), React 19, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), `exceljs` (new dependency), Jest + Testing Library.

## Global Constraints

- Follow existing project conventions exactly: Server Actions in `_actions.ts` files with `'use server'`, private route files prefixed `_`, Supabase migrations as root-level `sdd-sql-*.sql` files (no `supabase/migrations/` — this project has no Supabase CLI set up), tests colocated in `__tests__/` folders, Jest via `npm test`.
- Admin = `isAdminEmail(email)` from `lib/auth/admins.ts` (existing allowlist). Do **not** introduce `user_metadata.is_admin` — confirmed with the user this diverges from the original spec draft on purpose.
- `SUPABASE_SERVICE_ROLE_KEY` must never be imported into any file reachable from a Client Component — only inside `'use server'` files that also gate on `isAdminEmail`.
- Color tokens for any new UI: background `#0d2050`/`#0a1628`/`#0f1f3d`, border `#1e3a5f`, accent `#f05a28`, muted text `#4a6080`/`#94a3b8` — match existing Sofia/dashboard styling.
- All UI copy in Portuguese (Brazil), matching the rest of the app.

## Prerequisites (manual, before Task 1)

These cannot be scripted from this repo and must be done once, by hand, before the feature works end-to-end (Tasks 1–10 will still pass their automated tests without them):

1. In the Supabase dashboard → Storage, create a **private** bucket named `conversor-os-arquivos`.
2. In the Supabase dashboard → Project Settings → API, copy the `service_role` key. Add it to `.env.local` (and to production env) as `SUPABASE_SERVICE_ROLE_KEY`. **Never commit this value or expose it via `NEXT_PUBLIC_*`.**
3. After Task 1 creates `sdd-sql-conversor-os.sql`, run its contents in the Supabase SQL Editor.

---

### Task 1: SQL migration + env example + `exceljs` dependency

**Files:**
- Create: `sdd-sql-conversor-os.sql`
- Modify: `.env.local.example`
- Modify: `package.json` (add `exceljs`)

**Interfaces:**
- Produces: tables `conversor_os_imports`, `hub_system_access` (consumed by Tasks 10, 13); `exceljs` package (consumed by Tasks 6, 9).

- [ ] **Step 1: Create the migration file**

```sql
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
```

- [ ] **Step 2: Add the service role key placeholder to the env example**

In `.env.local.example`, after the existing `NEXT_PUBLIC_SUPABASE_ANON_KEY` line, add:

```
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: Install `exceljs`**

Run: `npm install exceljs`
Expected: `package.json` `dependencies` now includes `"exceljs": "^4.x.x"`.

- [ ] **Step 4: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds (no code depends on the new table/dependency yet, so this just confirms nothing broke).

- [ ] **Step 5: Commit**

```bash
git add sdd-sql-conversor-os.sql .env.local.example package.json package-lock.json
git commit -m "feat(conversor-os): add SQL migration, env var placeholder, exceljs dependency"
```

> Reminder: run `sdd-sql-conversor-os.sql` in the Supabase SQL Editor now (see Prerequisites) — Tasks 10 and 13 assume the tables exist.

---

### Task 2: `lib/conversor-os/types.ts` + `lib/conversor-os/nomeArquivo.ts`

**Files:**
- Create: `lib/conversor-os/types.ts`
- Create: `lib/conversor-os/nomeArquivo.ts`
- Test: `lib/conversor-os/__tests__/nomeArquivo.test.ts`

**Interfaces:**
- Produces: `Cliente`, `ConversorRow`, `LinhaErro`, `ConversaoResultado` types (consumed by every other `lib/conversor-os/*` file and the route handler); `gerarNomeArquivo(cliente: Cliente, agora: Date): string`.

- [ ] **Step 1: Write the types file (no test needed — pure type declarations)**

```typescript
// lib/conversor-os/types.ts
export type Cliente = 'DPSP' | 'D1000'

export interface ConversorRow {
  identificador: string
  tipoOs: string
  documentoCliente: string
  nomeCliente: string
  nomeLocalizacao: string
  numeroSerie: string
  nomeColaborador: string
  colaboradoresSecundarios: string
  dataAgendamento: string
  horaAgendamento: string
  descricao: string
  descricaoTarefa: string
  etiquetas: string
}

export interface LinhaErro {
  linha: number
  motivo: string
}

export interface ConversaoResultado {
  linhasOrigem: number
  linhasConvertidas: number
  duplicadosRemovidos: number
  erros: LinhaErro[]
  rows: ConversorRow[]
}
```

- [ ] **Step 2: Write the failing test for `gerarNomeArquivo`**

```typescript
// lib/conversor-os/__tests__/nomeArquivo.test.ts
import { gerarNomeArquivo } from '../nomeArquivo'

describe('gerarNomeArquivo', () => {
  it('formats DPSP with zero-padded date and time', () => {
    const data = new Date(2026, 5, 30, 14, 32) // June 30 2026, 14:32 (month is 0-indexed)
    expect(gerarNomeArquivo('DPSP', data)).toBe('DPSP-convertido-20260630-1432.xlsx')
  })

  it('formats D1000 and pads single-digit day/month/hour/minute', () => {
    const data = new Date(2026, 0, 5, 9, 7) // Jan 5 2026, 09:07
    expect(gerarNomeArquivo('D1000', data)).toBe('D1000-convertido-20260105-0907.xlsx')
  })
})
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- lib/conversor-os/__tests__/nomeArquivo.test.ts`
Expected: FAIL — `Cannot find module '../nomeArquivo'`

- [ ] **Step 4: Implement**

```typescript
// lib/conversor-os/nomeArquivo.ts
import type { Cliente } from './types'

export function gerarNomeArquivo(cliente: Cliente, agora: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const data = `${agora.getFullYear()}${pad(agora.getMonth() + 1)}${pad(agora.getDate())}`
  const hora = `${pad(agora.getHours())}${pad(agora.getMinutes())}`
  return `${cliente}-convertido-${data}-${hora}.xlsx`
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm test -- lib/conversor-os/__tests__/nomeArquivo.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/conversor-os/types.ts lib/conversor-os/nomeArquivo.ts lib/conversor-os/__tests__/nomeArquivo.test.ts
git commit -m "feat(conversor-os): add shared types and output filename generator"
```

---

### Task 3: `lib/conversor-os/converter.ts` — generic conversion orchestrator

**Files:**
- Create: `lib/conversor-os/converter.ts`
- Test: `lib/conversor-os/__tests__/converter.test.ts`

**Interfaces:**
- Consumes: `ConversorRow`, `LinhaErro`, `ConversaoResultado` from `./types` (Task 2).
- Produces: `LinhaBruta` interface, `converterLinhas(linhas, mapear, filtrar?): ConversaoResultado` (consumed by Task 9's route handler, and by Tasks 4/5's own tests indirectly via fakes).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/conversor-os/__tests__/converter.test.ts
import { converterLinhas, type LinhaBruta } from '../converter'
import type { ConversorRow } from '../types'

function linha(numeroLinha: number, id: string): LinhaBruta {
  return { numeroLinha, valores: [id] }
}

function rowFixture(id: string): ConversorRow {
  return {
    identificador: id, tipoOs: 'Manutenção Corretiva', documentoCliente: '',
    nomeCliente: 'DPSP', nomeLocalizacao: 'Loja X', numeroSerie: '',
    nomeColaborador: '', colaboradoresSecundarios: '', dataAgendamento: '',
    horaAgendamento: '', descricao: 'desc', descricaoTarefa: '', etiquetas: '',
  }
}

describe('converterLinhas', () => {
  it('maps every row when the mapper always succeeds', () => {
    const linhas = [linha(5, 'A1'), linha(6, 'A2')]
    const resultado = converterLinhas(linhas, (valores) => ({ row: rowFixture(valores[0] as string) }))
    expect(resultado.linhasOrigem).toBe(2)
    expect(resultado.linhasConvertidas).toBe(2)
    expect(resultado.rows.map((r) => r.identificador)).toEqual(['A1', 'A2'])
    expect(resultado.erros).toEqual([])
    expect(resultado.duplicadosRemovidos).toBe(0)
  })

  it('collects errors with the original row number instead of dropping silently', () => {
    const linhas = [linha(5, 'A1'), linha(6, '')]
    const resultado = converterLinhas(linhas, (valores, numeroLinha) =>
      valores[0] ? { row: rowFixture(valores[0] as string) } : { erro: `linha ${numeroLinha}: falta identificador` }
    )
    expect(resultado.linhasConvertidas).toBe(1)
    expect(resultado.erros).toEqual([{ linha: 6, motivo: 'linha 6: falta identificador' }])
  })

  it('removes duplicates by identificador, keeping the first occurrence', () => {
    const linhas = [linha(5, 'A1'), linha(6, 'A1'), linha(7, 'A2')]
    const resultado = converterLinhas(linhas, (valores) => ({ row: rowFixture(valores[0] as string) }))
    expect(resultado.rows.map((r) => r.identificador)).toEqual(['A1', 'A2'])
    expect(resultado.duplicadosRemovidos).toBe(1)
    expect(resultado.linhasConvertidas).toBe(2)
  })

  it('applies the optional filter before mapping, and filtered rows are neither errors nor converted', () => {
    const linhas = [linha(5, 'KEEP'), linha(6, 'DROP')]
    const resultado = converterLinhas(
      linhas,
      (valores) => ({ row: rowFixture(valores[0] as string) }),
      (valores) => valores[0] === 'KEEP'
    )
    expect(resultado.linhasOrigem).toBe(2)
    expect(resultado.linhasConvertidas).toBe(1)
    expect(resultado.erros).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/conversor-os/__tests__/converter.test.ts`
Expected: FAIL — `Cannot find module '../converter'`

- [ ] **Step 3: Implement**

```typescript
// lib/conversor-os/converter.ts
import type { ConversaoResultado, ConversorRow, LinhaErro } from './types'

export interface LinhaBruta {
  numeroLinha: number
  valores: unknown[]
}

export type MapearLinha = (
  valores: unknown[],
  numeroLinha: number
) => { row: ConversorRow } | { erro: string }

export type FiltrarLinha = (valores: unknown[]) => boolean

export function converterLinhas(
  linhas: LinhaBruta[],
  mapear: MapearLinha,
  filtrar?: FiltrarLinha
): ConversaoResultado {
  const linhasOrigem = linhas.length
  const linhasFiltradas = filtrar ? linhas.filter((l) => filtrar(l.valores)) : linhas

  const erros: LinhaErro[] = []
  const vistos = new Set<string>()
  const rows: ConversorRow[] = []
  let duplicadosRemovidos = 0

  for (const linha of linhasFiltradas) {
    const resultado = mapear(linha.valores, linha.numeroLinha)
    if ('erro' in resultado) {
      erros.push({ linha: linha.numeroLinha, motivo: resultado.erro })
      continue
    }
    if (vistos.has(resultado.row.identificador)) {
      duplicadosRemovidos++
      continue
    }
    vistos.add(resultado.row.identificador)
    rows.push(resultado.row)
  }

  return { linhasOrigem, linhasConvertidas: rows.length, duplicadosRemovidos, erros, rows }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/conversor-os/__tests__/converter.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/conversor-os/converter.ts lib/conversor-os/__tests__/converter.test.ts
git commit -m "feat(conversor-os): add generic row conversion orchestrator (filter/map/dedupe)"
```

---

### Task 4: `lib/conversor-os/dpsp.ts` — DPSP row mapping

**Files:**
- Create: `lib/conversor-os/dpsp.ts`
- Test: `lib/conversor-os/__tests__/dpsp.test.ts`

**Interfaces:**
- Consumes: `ConversorRow` from `./types` (Task 2).
- Produces: `mapearLinhaDPSP(valores: unknown[], numeroLinha: number): { row: ConversorRow } | { erro: string }` (consumed by Task 9's route handler).

Column indices (0-based) for DPSP raw rows: `valores[0]` = Col A (Nº Chamado), `valores[5]` = Col F (Descrição), `valores[7]` = Col H (Sobrenome do Solicitante).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/conversor-os/__tests__/dpsp.test.ts
import { mapearLinhaDPSP } from '../dpsp'

function valoresValidos(overrides: Record<number, unknown> = {}): unknown[] {
  const v: unknown[] = []
  v[0] = 'CH-123' // Col A
  v[5] = 'Ar-condicionado não liga' // Col F
  v[7] = 'Silva' // Col H
  Object.assign(v, overrides)
  return v
}

describe('mapearLinhaDPSP', () => {
  it('maps a valid row to the Field Control shape', () => {
    const resultado = mapearLinhaDPSP(valoresValidos(), 5)
    expect(resultado).toEqual({
      row: {
        identificador: 'CH-123',
        tipoOs: 'Manutenção Corretiva',
        documentoCliente: '',
        nomeCliente: 'DPSP',
        nomeLocalizacao: 'Silva',
        numeroSerie: '',
        nomeColaborador: '',
        colaboradoresSecundarios: '',
        dataAgendamento: '',
        horaAgendamento: '',
        descricao: 'Ar-condicionado não liga',
        descricaoTarefa: '',
        etiquetas: '',
      },
    })
  })

  it('trims whitespace from mapped fields', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 0: '  CH-123  ', 7: '  Silva  ' }), 5)
    expect('row' in resultado && resultado.row.identificador).toBe('CH-123')
    expect('row' in resultado && resultado.row.nomeLocalizacao).toBe('Silva')
  })

  it('errors when Nº Chamado (Col A) is missing', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 0: '' }), 12)
    expect(resultado).toEqual({ erro: 'linha 12: falta Nº Chamado' })
  })

  it('errors when Sobrenome do Solicitante (Col H) is missing', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 7: '' }), 12)
    expect(resultado).toEqual({ erro: 'linha 12: falta Sobrenome do Solicitante' })
  })

  it('errors when Descrição (Col F) is missing', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 5: '' }), 12)
    expect(resultado).toEqual({ erro: 'linha 12: falta Descrição' })
  })

  it('treats a cell holding only whitespace as missing', () => {
    const resultado = mapearLinhaDPSP(valoresValidos({ 0: '   ' }), 12)
    expect(resultado).toEqual({ erro: 'linha 12: falta Nº Chamado' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/conversor-os/__tests__/dpsp.test.ts`
Expected: FAIL — `Cannot find module '../dpsp'`

- [ ] **Step 3: Implement**

```typescript
// lib/conversor-os/dpsp.ts
import type { ConversorRow } from './types'

export function mapearLinhaDPSP(
  valores: unknown[],
  numeroLinha: number
): { row: ConversorRow } | { erro: string } {
  const colA = String(valores[0] ?? '').trim()
  const colF = String(valores[5] ?? '').trim()
  const colH = String(valores[7] ?? '').trim()

  if (!colA) return { erro: `linha ${numeroLinha}: falta Nº Chamado` }
  if (!colH) return { erro: `linha ${numeroLinha}: falta Sobrenome do Solicitante` }
  if (!colF) return { erro: `linha ${numeroLinha}: falta Descrição` }

  return {
    row: {
      identificador: colA,
      tipoOs: 'Manutenção Corretiva',
      documentoCliente: '',
      nomeCliente: 'DPSP',
      nomeLocalizacao: colH,
      numeroSerie: '',
      nomeColaborador: '',
      colaboradoresSecundarios: '',
      dataAgendamento: '',
      horaAgendamento: '',
      descricao: colF,
      descricaoTarefa: '',
      etiquetas: '',
    },
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/conversor-os/__tests__/dpsp.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/conversor-os/dpsp.ts lib/conversor-os/__tests__/dpsp.test.ts
git commit -m "feat(conversor-os): add DPSP row mapper"
```

---

### Task 5: `lib/conversor-os/d1000.ts` — D1000 filter + row mapping

**Files:**
- Create: `lib/conversor-os/d1000.ts`
- Test: `lib/conversor-os/__tests__/d1000.test.ts`

**Interfaces:**
- Consumes: `ConversorRow` from `./types` (Task 2).
- Produces: `ABREVIACOES_BANDEIRA`, `abreviarLocalizacao(bandeira, loja): string | null`, `filtrarLinhaD1000(valores): boolean`, `mapearLinhaD1000(valores, numeroLinha): { row } | { erro }` (all consumed by Task 9's route handler).

Column indices (0-based) for D1000 raw rows: `valores[0]` = Col A (Codigo), `valores[1]` = Col B (Bandeira), `valores[2]` = Col C (Loja), `valores[3]` = Col D (Grupo Analista Atual), `valores[7]` = Col H (Descrição do Problema).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/conversor-os/__tests__/d1000.test.ts
import { abreviarLocalizacao, filtrarLinhaD1000, mapearLinhaD1000 } from '../d1000'

describe('abreviarLocalizacao', () => {
  it('abbreviates known bandeiras', () => {
    expect(abreviarLocalizacao('TAMOIO', '180')).toBe('TMO-180')
    expect(abreviarLocalizacao('DROGASMIL', '611')).toBe('DML-611')
    expect(abreviarLocalizacao('FARMALIFE', '624')).toBe('FML-624')
  })

  it('is case-insensitive on bandeira and trims whitespace', () => {
    expect(abreviarLocalizacao('  tamoio  ', ' 180 ')).toBe('TMO-180')
  })

  it('returns null for an unknown bandeira', () => {
    expect(abreviarLocalizacao('ROSARIO', '10')).toBeNull()
  })

  it('returns null when loja is empty', () => {
    expect(abreviarLocalizacao('TAMOIO', '')).toBeNull()
  })
})

describe('filtrarLinhaD1000', () => {
  function valores(grupoAnalista: string, bandeira: string): unknown[] {
    const v: unknown[] = []
    v[1] = bandeira
    v[3] = grupoAnalista
    return v
  }

  it('keeps rows where Grupo Analista contains MANFAC and bandeira is not ROSARIO', () => {
    expect(filtrarLinhaD1000(valores('EQUIPE MANFAC SP', 'TAMOIO'))).toBe(true)
  })

  it('drops rows where Grupo Analista does not contain MANFAC', () => {
    expect(filtrarLinhaD1000(valores('EQUIPE TERCEIROS', 'TAMOIO'))).toBe(false)
  })

  it('drops rows where bandeira is ROSARIO even if Grupo Analista contains MANFAC', () => {
    expect(filtrarLinhaD1000(valores('EQUIPE MANFAC SP', 'ROSARIO'))).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(filtrarLinhaD1000(valores('equipe manfac sp', 'tamoio'))).toBe(true)
    expect(filtrarLinhaD1000(valores('equipe manfac sp', 'rosario'))).toBe(false)
  })
})

describe('mapearLinhaD1000', () => {
  function valoresValidos(overrides: Record<number, unknown> = {}): unknown[] {
    const v: unknown[] = []
    v[0] = 'D-999' // Codigo
    v[1] = 'DROGASMIL' // Bandeira
    v[2] = '611' // Loja
    v[7] = 'Câmara fria com falha' // Descrição do Problema
    Object.assign(v, overrides)
    return v
  }

  it('maps a valid row to the Field Control shape', () => {
    const resultado = mapearLinhaD1000(valoresValidos(), 8)
    expect(resultado).toEqual({
      row: {
        identificador: 'D-999',
        tipoOs: 'Manutenção Corretiva',
        documentoCliente: '',
        nomeCliente: 'D1000',
        nomeLocalizacao: 'DML-611',
        numeroSerie: '',
        nomeColaborador: '',
        colaboradoresSecundarios: '',
        dataAgendamento: '',
        horaAgendamento: '',
        descricao: 'Câmara fria com falha',
        descricaoTarefa: '',
        etiquetas: '',
      },
    })
  })

  it('errors when Codigo is missing', () => {
    const resultado = mapearLinhaD1000(valoresValidos({ 0: '' }), 8)
    expect(resultado).toEqual({ erro: 'linha 8: falta Codigo' })
  })

  it('errors when bandeira is unknown (concatenation fails)', () => {
    const resultado = mapearLinhaD1000(valoresValidos({ 1: 'DESCONHECIDA' }), 8)
    expect(resultado).toEqual({
      erro: 'linha 8: bandeira ou loja inválida (DESCONHECIDA / 611)',
    })
  })

  it('errors when Descrição do Problema is missing', () => {
    const resultado = mapearLinhaD1000(valoresValidos({ 7: '' }), 8)
    expect(resultado).toEqual({ erro: 'linha 8: falta Descrição do Problema' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/conversor-os/__tests__/d1000.test.ts`
Expected: FAIL — `Cannot find module '../d1000'`

- [ ] **Step 3: Implement**

```typescript
// lib/conversor-os/d1000.ts
import type { ConversorRow } from './types'

export const ABREVIACOES_BANDEIRA: Record<string, string> = {
  TAMOIO: 'TMO',
  DROGASMIL: 'DML',
  FARMALIFE: 'FML',
}

export function abreviarLocalizacao(bandeira: string, loja: string): string | null {
  const abreviacao = ABREVIACOES_BANDEIRA[bandeira.trim().toUpperCase()]
  const lojaLimpa = loja.trim()
  if (!abreviacao || !lojaLimpa) return null
  return `${abreviacao}-${lojaLimpa}`
}

export function filtrarLinhaD1000(valores: unknown[]): boolean {
  const grupoAnalista = String(valores[3] ?? '').toUpperCase()
  const bandeira = String(valores[1] ?? '').toUpperCase()
  return grupoAnalista.includes('MANFAC') && bandeira !== 'ROSARIO'
}

export function mapearLinhaD1000(
  valores: unknown[],
  numeroLinha: number
): { row: ConversorRow } | { erro: string } {
  const colA = String(valores[0] ?? '').trim()
  const bandeira = String(valores[1] ?? '').trim()
  const loja = String(valores[2] ?? '').trim()
  const colH = String(valores[7] ?? '').trim()

  if (!colA) return { erro: `linha ${numeroLinha}: falta Codigo` }

  const localizacao = abreviarLocalizacao(bandeira, loja)
  if (!localizacao)
    return {
      erro: `linha ${numeroLinha}: bandeira ou loja inválida (${bandeira || '—'} / ${loja || '—'})`,
    }

  if (!colH) return { erro: `linha ${numeroLinha}: falta Descrição do Problema` }

  return {
    row: {
      identificador: colA,
      tipoOs: 'Manutenção Corretiva',
      documentoCliente: '',
      nomeCliente: 'D1000',
      nomeLocalizacao: localizacao,
      numeroSerie: '',
      nomeColaborador: '',
      colaboradoresSecundarios: '',
      dataAgendamento: '',
      horaAgendamento: '',
      descricao: colH,
      descricaoTarefa: '',
      etiquetas: '',
    },
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/conversor-os/__tests__/d1000.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/conversor-os/d1000.ts lib/conversor-os/__tests__/d1000.test.ts
git commit -m "feat(conversor-os): add D1000 filter, location abbreviation, and row mapper"
```

---

### Task 6: `lib/conversor-os/planilha.ts` — exceljs I/O layer

**Files:**
- Create: `lib/conversor-os/planilha.ts`
- Test: `lib/conversor-os/__tests__/planilha.test.ts`

**Interfaces:**
- Consumes: `ConversorRow` from `./types` (Task 2), `LinhaBruta` from `./converter` (Task 3), `exceljs`.
- Produces: `localizarAba(workbook, nomeExato): ExcelJS.Worksheet | null`, `localizarLinhaCabecalho(worksheet, coluna, textoBusca, maxLinhas?): number | null`, `extrairLinhasBrutas(worksheet, primeiraLinhaDados): LinhaBruta[]`, `gerarWorkbookFieldControl(rows: ConversorRow[]): ExcelJS.Workbook` (all consumed by Task 9's route handler).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/conversor-os/__tests__/planilha.test.ts
import ExcelJS from 'exceljs'
import {
  localizarAba,
  localizarLinhaCabecalho,
  extrairLinhasBrutas,
  gerarWorkbookFieldControl,
} from '../planilha'
import type { ConversorRow } from '../types'

describe('localizarAba', () => {
  it('finds a worksheet by exact (trimmed) name', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('CHAMADOS')
    expect(localizarAba(workbook, 'CHAMADOS')?.name).toBe('CHAMADOS')
  })

  it('returns null when no worksheet matches', () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('Outra Aba')
    expect(localizarAba(workbook, 'CHAMADOS')).toBeNull()
  })
})

describe('localizarLinhaCabecalho', () => {
  it('finds the row whose first column matches the search text', () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('DPSP')
    sheet.addRow(['Título da planilha'])
    sheet.addRow(['Cliente: DPSP'])
    sheet.addRow([])
    sheet.addRow(['Nº Chamado', 'Outra coluna'])
    expect(localizarLinhaCabecalho(sheet, 1, 'Nº Chamado')).toBe(4)
  })

  it('returns null when the header text is not found within maxLinhas', () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('DPSP')
    sheet.addRow(['algo irrelevante'])
    expect(localizarLinhaCabecalho(sheet, 1, 'Nº Chamado', 3)).toBeNull()
  })
})

describe('extrairLinhasBrutas', () => {
  it('extracts rows starting at the given row number, with correct numeroLinha', () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('CHAMADOS')
    sheet.addRow(['Codigo', 'Bandeira']) // row 1: header
    sheet.addRow(['D-1', 'TAMOIO']) // row 2
    sheet.addRow(['D-2', 'DROGASMIL']) // row 3
    const linhas = extrairLinhasBrutas(sheet, 2)
    expect(linhas).toEqual([
      { numeroLinha: 2, valores: expect.arrayContaining(['D-1', 'TAMOIO']) },
      { numeroLinha: 3, valores: expect.arrayContaining(['D-2', 'DROGASMIL']) },
    ])
  })
})

describe('gerarWorkbookFieldControl', () => {
  it('writes a header row plus one row per ConversorRow, in column order', async () => {
    const rows: ConversorRow[] = [
      {
        identificador: 'A1', tipoOs: 'Manutenção Corretiva', documentoCliente: '',
        nomeCliente: 'DPSP', nomeLocalizacao: 'Loja X', numeroSerie: '',
        nomeColaborador: '', colaboradoresSecundarios: '', dataAgendamento: '',
        horaAgendamento: '', descricao: 'desc', descricaoTarefa: '', etiquetas: '',
      },
    ]
    const workbook = gerarWorkbookFieldControl(rows)
    const sheet = workbook.worksheets[0]
    expect(sheet.getRow(1).getCell(1).value).toBe('Identificador')
    expect(sheet.getRow(2).getCell(1).value).toBe('A1')
    expect(sheet.getRow(2).getCell(4).value).toBe('DPSP')
    expect(sheet.getRow(2).getCell(11).value).toBe('desc')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/conversor-os/__tests__/planilha.test.ts`
Expected: FAIL — `Cannot find module '../planilha'`

- [ ] **Step 3: Implement**

```typescript
// lib/conversor-os/planilha.ts
import ExcelJS from 'exceljs'
import type { LinhaBruta } from './converter'
import type { ConversorRow } from './types'

export function localizarAba(workbook: ExcelJS.Workbook, nomeExato: string): ExcelJS.Worksheet | null {
  return workbook.worksheets.find((ws) => ws.name.trim() === nomeExato) ?? null
}

export function localizarLinhaCabecalho(
  worksheet: ExcelJS.Worksheet,
  coluna: number,
  textoBusca: string,
  maxLinhas = 10
): number | null {
  for (let i = 1; i <= maxLinhas; i++) {
    const valor = worksheet.getRow(i).getCell(coluna).value
    if (String(valor ?? '').trim() === textoBusca) return i
  }
  return null
}

export function extrairLinhasBrutas(
  worksheet: ExcelJS.Worksheet,
  primeiraLinhaDados: number
): LinhaBruta[] {
  const linhas: LinhaBruta[] = []
  worksheet.eachRow({ includeEmpty: false }, (row, numeroLinha) => {
    if (numeroLinha < primeiraLinhaDados) return
    const valores: unknown[] = []
    for (let col = 1; col <= 13; col++) valores[col - 1] = row.getCell(col).value
    linhas.push({ numeroLinha, valores })
  })
  return linhas
}

const CABECALHO_FIELD_CONTROL = [
  'Identificador', 'Tipo de OS', 'Documento do cliente', 'Nome do cliente',
  'Nome da localização', 'Número de série', 'Nome do colaborador',
  'Colaboradores secundários', 'Data de agendamento', 'Hora de agendamento',
  'Descrição', 'Descrição da tarefa', 'Etiquetas',
]

export function gerarWorkbookFieldControl(rows: ConversorRow[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('OS')
  sheet.addRow(CABECALHO_FIELD_CONTROL)
  for (const row of rows) {
    sheet.addRow([
      row.identificador, row.tipoOs, row.documentoCliente, row.nomeCliente,
      row.nomeLocalizacao, row.numeroSerie, row.nomeColaborador,
      row.colaboradoresSecundarios, row.dataAgendamento, row.horaAgendamento,
      row.descricao, row.descricaoTarefa, row.etiquetas,
    ])
  }
  return workbook
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/conversor-os/__tests__/planilha.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/conversor-os/planilha.ts lib/conversor-os/__tests__/planilha.test.ts
git commit -m "feat(conversor-os): add exceljs I/O layer (sheet lookup, header search, row extraction, output workbook)"
```

---

### Task 7: `lib/auth/systemAccess.ts` — per-system access check

**Files:**
- Create: `lib/auth/systemAccess.ts`
- Test: `lib/auth/__tests__/systemAccess.test.ts`

**Interfaces:**
- Consumes: `isAdminEmail` from `./admins` (existing).
- Produces: `hasSystemAccess(supabase, email, systemSlug): Promise<boolean>` (consumed by Task 8's middleware and Task 10's Server Actions).

- [ ] **Step 1: Write the failing tests**

```typescript
// lib/auth/__tests__/systemAccess.test.ts
import { hasSystemAccess } from '../systemAccess'

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
  it('returns true for an admin without querying the table', async () => {
    const supabase = fakeSupabase(null)
    const result = await hasSystemAccess(supabase, 'jvictorco28@gmail.com', 'conversor-os')
    expect(result).toBe(true)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns true for a non-admin with has_access = true', async () => {
    const supabase = fakeSupabase({ has_access: true })
    const result = await hasSystemAccess(supabase, 'usuario@manfac.com.br', 'conversor-os')
    expect(result).toBe(true)
  })

  it('returns false for a non-admin with has_access = false', async () => {
    const supabase = fakeSupabase({ has_access: false })
    const result = await hasSystemAccess(supabase, 'usuario@manfac.com.br', 'conversor-os')
    expect(result).toBe(false)
  })

  it('returns false for a non-admin with no row at all', async () => {
    const supabase = fakeSupabase(null)
    const result = await hasSystemAccess(supabase, 'usuario@manfac.com.br', 'conversor-os')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- lib/auth/__tests__/systemAccess.test.ts`
Expected: FAIL — `Cannot find module '../systemAccess'`

- [ ] **Step 3: Implement**

```typescript
// lib/auth/systemAccess.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { isAdminEmail } from './admins'

export async function hasSystemAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  email: string,
  systemSlug: string
): Promise<boolean> {
  if (isAdminEmail(email)) return true

  const { data } = await supabase
    .from('hub_system_access')
    .select('has_access')
    .eq('user_email', email.trim().toLowerCase())
    .eq('system_slug', systemSlug)
    .maybeSingle()

  return data?.has_access === true
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- lib/auth/__tests__/systemAccess.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth/systemAccess.ts lib/auth/__tests__/systemAccess.test.ts
git commit -m "feat(auth): add hasSystemAccess helper for per-system access control"
```

---

### Task 8: `middleware.ts` — protect `/conversor-os`, `/admin`, and the processing API

**Files:**
- Modify: `middleware.ts`

**Interfaces:**
- Consumes: `hasSystemAccess` from `lib/auth/systemAccess` (Task 7), `isAdminEmail` from `lib/auth/admins` (existing).

No unit test precedent exists for `middleware.ts` in this codebase (verified: no `middleware*.test.*` file). Keep the logic here thin — it only calls already-tested helpers — and verify manually via the dev server in Task 11/14 once the pages exist.

- [ ] **Step 1: Modify `middleware.ts`**

Replace the whole file with:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isManfacEmail } from '@/lib/auth/domain'
import { isAdminEmail } from '@/lib/auth/admins'
import { hasSystemAccess } from '@/lib/auth/systemAccess'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ''

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isConversorOsApi = pathname.startsWith('/api/conversor-os')
  const isConversorOsPage = pathname.startsWith('/conversor-os')
  const isAdminPage = pathname.startsWith('/admin')
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/sofia') ||
    isConversorOsPage ||
    isAdminPage ||
    isConversorOsApi
  // /reset-password não entra em isAuthPage: usuários autenticados precisam
  // acessá-la durante o fluxo de redefinição de senha via link de e-mail.
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/forgot-password')

  if (isProtected) {
    if (!user) {
      if (isConversorOsApi) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (!isManfacEmail(user.email ?? '')) {
      await supabase.auth.signOut()
      if (isConversorOsApi) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
      const url = new URL('/login', request.url)
      url.searchParams.set('error', 'unauthorized')
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
      })
      return redirectResponse
    }
    if (isConversorOsPage || isConversorOsApi) {
      const acesso = await hasSystemAccess(supabase, user.email ?? '', 'conversor-os')
      if (!acesso) {
        if (isConversorOsApi) return NextResponse.json({ error: 'Sem acesso ao Conversor OS' }, { status: 403 })
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    if (isAdminPage && !isAdminEmail(user.email ?? '')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  if (isAuthPage && user && isManfacEmail(user.email ?? '')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/sofia/:path*',
    '/conversor-os/:path*',
    '/admin/:path*',
    '/api/conversor-os/:path*',
    '/login',
    '/signup',
    '/signup/verify',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
  ],
}
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(conversor-os): protect /conversor-os, /admin, and the processing API in middleware"
```

---

### Task 9: `POST /api/conversor-os/processar` — Route Handler

**Files:**
- Create: `app/api/conversor-os/processar/route.ts`
- Test: `app/api/conversor-os/processar/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `converterLinhas` (Task 3), `mapearLinhaDPSP` (Task 4), `filtrarLinhaD1000`/`mapearLinhaD1000` (Task 5), `localizarAba`/`localizarLinhaCabecalho`/`extrairLinhasBrutas`/`gerarWorkbookFieldControl` (Task 6), `gerarNomeArquivo` (Task 2), `Cliente` type (Task 2).
- Produces: `POST` handler returning JSON `{ cliente, filename, linhasOrigem, linhasConvertidas, duplicadosRemovidos, erros, preview, arquivoBase64 }` on success, or `{ error }` with a 4xx status on failure (consumed by Task 11's `_form.tsx`).

- [ ] **Step 1: Write the failing test**

This test builds real in-memory `.xlsx` files with `exceljs` (no mocking of `exceljs` itself — it's a deterministic, in-memory library, not an external service) and posts them through the handler as a `FormData`/`File`. Route Handlers run in the Node runtime, not jsdom (the project's default `testEnvironment`), and jsdom's `FormData`/`File`/`Request` support is unreliable — force this one test file onto the Node test environment with a docblock pragma on the first line.

```typescript
/**
 * @jest-environment node
 */
// app/api/conversor-os/processar/__tests__/route.test.ts
import ExcelJS from 'exceljs'
import { POST } from '../route'

async function bufferParaFile(workbook: ExcelJS.Workbook, filename: string): Promise<File> {
  const buffer = await workbook.xlsx.writeBuffer()
  return new File([buffer], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

function buildDpspWorkbook(): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Extrato do CICLO OS Corretiva+Prev - JG')
  sheet.addRow(['Relatório DPSP'])
  sheet.addRow(['Gerado em 30/06/2026'])
  sheet.addRow([])
  sheet.addRow(['Nº Chamado', 'B', 'C', 'D', 'E', 'Descrição', 'G', 'Sobrenome do Solicitante'])
  sheet.addRow(['CH-1', '', '', '', '', 'Ar-condicionado com falha', '', 'Silva'])
  sheet.addRow(['CH-1', '', '', '', '', 'duplicado', '', 'Silva']) // duplicate identificador
  sheet.addRow(['', '', '', '', '', 'sem chamado', '', 'Souza']) // invalid: missing Col A
  return workbook
}

async function postFormData(cliente: string, workbook: ExcelJS.Workbook) {
  const formData = new FormData()
  formData.set('cliente', cliente)
  formData.set('arquivo', await bufferParaFile(workbook, 'planilha.xlsx'))
  const request = new Request('http://localhost/api/conversor-os/processar', {
    method: 'POST',
    body: formData,
  })
  return POST(request)
}

describe('POST /api/conversor-os/processar', () => {
  it('converts a valid DPSP file and returns summary, preview, errors, and base64 output', async () => {
    const response = await postFormData('DPSP', buildDpspWorkbook())
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.cliente).toBe('DPSP')
    expect(body.filename).toMatch(/^DPSP-convertido-\d{8}-\d{4}\.xlsx$/)
    expect(body.linhasOrigem).toBe(3)
    expect(body.linhasConvertidas).toBe(1)
    expect(body.duplicadosRemovidos).toBe(1)
    expect(body.erros).toEqual([{ linha: 7, motivo: 'linha 7: falta Nº Chamado' }])
    expect(body.preview[0].identificador).toBe('CH-1')
    expect(typeof body.arquivoBase64).toBe('string')
    expect(body.arquivoBase64.length).toBeGreaterThan(0)
  })

  it('returns 422 when the expected DPSP sheet is missing (wrong cliente selected)', async () => {
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('CHAMADOS') // this is the D1000 sheet name, not DPSP's
    const response = await postFormData('DPSP', workbook)
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error).toMatch(/Aba .* não encontrada/)
  })

  it('applies D1000 filters (MANFAC + not ROSARIO) before mapping', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('CHAMADOS')
    sheet.addRow(['Codigo', 'Bandeira', 'Loja', 'Grupo Analista Atual', 'E', 'F', 'G', 'Descrição do Problema'])
    sheet.addRow(['D-1', 'TAMOIO', '180', 'EQUIPE MANFAC SP', '', '', '', 'Falha no ar'])
    sheet.addRow(['D-2', 'ROSARIO', '10', 'EQUIPE MANFAC SP', '', '', '', 'Outro problema'])
    sheet.addRow(['D-3', 'DROGASMIL', '611', 'EQUIPE TERCEIROS', '', '', '', 'Mais um'])
    const response = await postFormData('D1000', workbook)
    const body = await response.json()
    expect(body.linhasConvertidas).toBe(1)
    expect(body.preview[0].nomeLocalizacao).toBe('TMO-180')
  })

  it('returns 400 for an invalid cliente value', async () => {
    const response = await postFormData('OUTRO', buildDpspWorkbook())
    expect(response.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- app/api/conversor-os/processar/__tests__/route.test.ts`
Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement**

```typescript
// app/api/conversor-os/processar/route.ts
import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import {
  localizarAba,
  localizarLinhaCabecalho,
  extrairLinhasBrutas,
  gerarWorkbookFieldControl,
} from '@/lib/conversor-os/planilha'
import { converterLinhas } from '@/lib/conversor-os/converter'
import { mapearLinhaDPSP } from '@/lib/conversor-os/dpsp'
import { filtrarLinhaD1000, mapearLinhaD1000 } from '@/lib/conversor-os/d1000'
import { gerarNomeArquivo } from '@/lib/conversor-os/nomeArquivo'
import type { Cliente, ConversaoResultado } from '@/lib/conversor-os/types'

function processarDPSP(workbook: ExcelJS.Workbook): ConversaoResultado | { erroEstrutura: string } {
  const aba = localizarAba(workbook, 'Extrato do CICLO OS Corretiva+Prev - JG')
  if (!aba)
    return {
      erroEstrutura:
        'Aba "Extrato do CICLO OS Corretiva+Prev - JG" não encontrada — confira se selecionou o cliente certo',
    }
  const linhaCabecalho = localizarLinhaCabecalho(aba, 1, 'Nº Chamado')
  if (!linhaCabecalho)
    return { erroEstrutura: 'Coluna "Nº Chamado" não encontrada — confira se selecionou o cliente certo' }
  const linhas = extrairLinhasBrutas(aba, linhaCabecalho + 1)
  return converterLinhas(linhas, mapearLinhaDPSP)
}

function processarD1000(workbook: ExcelJS.Workbook): ConversaoResultado | { erroEstrutura: string } {
  const aba = localizarAba(workbook, 'CHAMADOS')
  if (!aba)
    return { erroEstrutura: 'Aba "CHAMADOS" não encontrada — confira se selecionou o cliente certo' }
  const linhas = extrairLinhasBrutas(aba, 2)
  return converterLinhas(linhas, mapearLinhaD1000, filtrarLinhaD1000)
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const cliente = formData.get('cliente') as string | null
  const arquivo = formData.get('arquivo') as File | null

  if (cliente !== 'DPSP' && cliente !== 'D1000')
    return NextResponse.json({ error: 'Cliente inválido' }, { status: 400 })
  if (!arquivo) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })

  const buffer = Buffer.from(await arquivo.arrayBuffer())
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(buffer)
  } catch {
    return NextResponse.json({ error: 'Não foi possível ler o arquivo .xlsx' }, { status: 422 })
  }

  const clienteTipado = cliente as Cliente
  const resultado = clienteTipado === 'DPSP' ? processarDPSP(workbook) : processarD1000(workbook)

  if ('erroEstrutura' in resultado)
    return NextResponse.json({ error: resultado.erroEstrutura }, { status: 422 })

  const workbookSaida = gerarWorkbookFieldControl(resultado.rows)
  const bufferSaida = await workbookSaida.xlsx.writeBuffer()
  const filename = gerarNomeArquivo(clienteTipado, new Date())

  return NextResponse.json({
    cliente: clienteTipado,
    filename,
    linhasOrigem: resultado.linhasOrigem,
    linhasConvertidas: resultado.linhasConvertidas,
    duplicadosRemovidos: resultado.duplicadosRemovidos,
    erros: resultado.erros,
    preview: resultado.rows.slice(0, 20),
    arquivoBase64: Buffer.from(bufferSaida).toString('base64'),
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- app/api/conversor-os/processar/__tests__/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/conversor-os/processar/route.ts "app/api/conversor-os/processar/__tests__/route.test.ts"
git commit -m "feat(conversor-os): add POST /api/conversor-os/processar route handler"
```

---

### Task 10: `app/conversor-os/_actions.ts` — log + signed download URL Server Actions

**Files:**
- Create: `app/conversor-os/_actions.ts`
- Test: `app/conversor-os/__tests__/_actions.test.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/server` (existing), `hasSystemAccess` from `lib/auth/systemAccess` (Task 7).
- Produces: `registrarImportacaoAction(input): Promise<{ error?: string; success?: boolean }>`, `obterUrlDownloadAction(storagePath): Promise<{ url: string } | { error: string }>` (both consumed by Task 11's `_form.tsx` and Task 12's historico page).

Storage bucket name is the literal `'conversor-os-arquivos'` (created manually per Prerequisites).

- [ ] **Step 1: Write the failing tests**

```typescript
// app/conversor-os/__tests__/_actions.test.ts
const getUserMock = jest.fn()
const insertMock = jest.fn()
const createSignedUrlMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({ insert: insertMock })),
    storage: { from: jest.fn(() => ({ createSignedUrl: createSignedUrlMock })) },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

jest.mock('@/lib/auth/systemAccess', () => ({ hasSystemAccess: jest.fn() }))

import { registrarImportacaoAction, obterUrlDownloadAction } from '../_actions'
import { hasSystemAccess } from '@/lib/auth/systemAccess'

const inputFixture = {
  cliente: 'DPSP' as const,
  filename: 'DPSP-convertido-20260630-1432.xlsx',
  storagePath: 'DPSP/DPSP-convertido-20260630-1432.xlsx',
  linhasOrigem: 5,
  linhasConvertidas: 4,
  duplicadosRemovidos: 1,
  erros: [],
}

describe('registrarImportacaoAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'usuario@manfac.com.br' } } })
  })

  it('rejects when the user has no system access', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const result = await registrarImportacaoAction(inputFixture)
    expect(result).toEqual({ error: 'Sem acesso ao Conversor OS' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('inserts a log row and returns success when access is granted', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
    insertMock.mockResolvedValue({ error: null })
    const result = await registrarImportacaoAction(inputFixture)
    expect(result).toEqual({ success: true })
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_email: 'usuario@manfac.com.br',
        cliente: 'DPSP',
        storage_path: inputFixture.storagePath,
        total_rows: 5,
        converted_rows: 4,
        duplicates_removed: 1,
      })
    )
  })

  it('surfaces an error instead of silently swallowing a failed insert', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
    insertMock.mockResolvedValue({ error: { message: 'RLS denied' } })
    const result = await registrarImportacaoAction(inputFixture)
    expect(result).toEqual({ error: 'Erro ao registrar importação' })
  })
})

describe('obterUrlDownloadAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({ data: { user: { id: 'u1', email: 'usuario@manfac.com.br' } } })
  })

  it('returns a signed url when access is granted and storage succeeds', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(true)
    createSignedUrlMock.mockResolvedValue({ data: { signedUrl: 'https://signed.example/file.xlsx' }, error: null })
    const result = await obterUrlDownloadAction('DPSP/foo.xlsx')
    expect(result).toEqual({ url: 'https://signed.example/file.xlsx' })
  })

  it('rejects when the user has no system access', async () => {
    ;(hasSystemAccess as jest.Mock).mockResolvedValue(false)
    const result = await obterUrlDownloadAction('DPSP/foo.xlsx')
    expect(result).toEqual({ error: 'Sem acesso ao Conversor OS' })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- app/conversor-os/__tests__/_actions.test.ts`
Expected: FAIL — `Cannot find module '../_actions'`

- [ ] **Step 3: Implement**

```typescript
// app/conversor-os/_actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { hasSystemAccess } from '@/lib/auth/systemAccess'
import type { Cliente, LinhaErro } from '@/lib/conversor-os/types'

type State = { error?: string; success?: boolean }

export interface RegistrarImportacaoInput {
  cliente: Cliente
  filename: string
  storagePath: string
  linhasOrigem: number
  linhasConvertidas: number
  duplicadosRemovidos: number
  erros: LinhaErro[]
}

export async function registrarImportacaoAction(input: RegistrarImportacaoInput): Promise<State> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }
  if (!(await hasSystemAccess(supabase, user.email, 'conversor-os')))
    return { error: 'Sem acesso ao Conversor OS' }

  const { error } = await supabase.from('conversor_os_imports').insert({
    user_id: user.id,
    user_email: user.email,
    cliente: input.cliente,
    filename: input.filename,
    storage_path: input.storagePath,
    total_rows: input.linhasOrigem,
    converted_rows: input.linhasConvertidas,
    duplicates_removed: input.duplicadosRemovidos,
    errors: input.erros,
    imported_at: new Date().toISOString(),
  })
  if (error) return { error: 'Erro ao registrar importação' }

  revalidatePath('/conversor-os/historico')
  return { success: true }
}

export async function obterUrlDownloadAction(
  storagePath: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }
  if (!(await hasSystemAccess(supabase, user.email, 'conversor-os')))
    return { error: 'Sem acesso ao Conversor OS' }

  const { data, error } = await supabase.storage
    .from('conversor-os-arquivos')
    .createSignedUrl(storagePath, 60)
  if (error || !data) return { error: 'Erro ao gerar link de download' }
  return { url: data.signedUrl }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- app/conversor-os/__tests__/_actions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/conversor-os/_actions.ts app/conversor-os/__tests__/_actions.test.ts
git commit -m "feat(conversor-os): add Server Actions to log imports and issue signed download URLs"
```

---

### Task 11: `/conversor-os` page — upload, preview, download, cancel

**Files:**
- Create: `app/conversor-os/layout.tsx`
- Create: `app/conversor-os/page.tsx`
- Create: `app/conversor-os/_form.tsx`

**Interfaces:**
- Consumes: `registrarImportacaoAction` from `./_actions` (Task 10), `createClient` from `lib/supabase/client` (existing).

No automated test — this codebase has no precedent for testing `_form.tsx`/`page.tsx` files (verified: `nova/_form.tsx` and similar have no test files). Verify manually per Step 3.

- [ ] **Step 1: Implement the layout**

```tsx
// app/conversor-os/layout.tsx
import Link from 'next/link'

export default function ConversorOsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <header className="border-b border-[#1e3a5f] bg-[#0d2050] px-6 py-4">
        <Link href="/dashboard" className="text-[#94a3b8] text-sm hover:text-white transition-colors">
          ← Voltar ao Hub
        </Link>
      </header>
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Implement the page and form**

```tsx
// app/conversor-os/page.tsx
import ConversorForm from './_form'

export default function ConversorOsPage() {
  return <ConversorForm />
}
```

```tsx
// app/conversor-os/_form.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { registrarImportacaoAction } from './_actions'
import type { Cliente, ConversorRow, LinhaErro } from '@/lib/conversor-os/types'

interface ResultadoConversao {
  cliente: Cliente
  filename: string
  linhasOrigem: number
  linhasConvertidas: number
  duplicadosRemovidos: number
  erros: LinhaErro[]
  preview: ConversorRow[]
  arquivoBase64: string
}

function base64ParaBlob(base64: string): Blob {
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export default function ConversorForm() {
  const [cliente, setCliente] = useState<Cliente | ''>('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [convertendo, setConvertendo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoConversao | null>(null)
  const [salvo, setSalvo] = useState(false)

  async function handleConverter() {
    if (!cliente || !arquivo) return
    setConvertendo(true)
    setErro(null)
    try {
      const formData = new FormData()
      formData.set('cliente', cliente)
      formData.set('arquivo', arquivo)
      const response = await fetch('/api/conversor-os/processar', { method: 'POST', body: formData })
      const body = await response.json()
      if (!response.ok) {
        setErro(body.error ?? 'Erro ao converter a planilha')
        return
      }
      setResultado(body)
    } catch {
      setErro('Erro de rede ao converter a planilha')
    } finally {
      setConvertendo(false)
    }
  }

  function handleCancelar() {
    setResultado(null)
    setArquivo(null)
    setErro(null)
    setSalvo(false)
  }

  async function handleBaixar() {
    if (!resultado) return
    setSalvando(true)
    setErro(null)
    try {
      const blob = base64ParaBlob(resultado.arquivoBase64)

      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = resultado.filename
      link.click()
      URL.revokeObjectURL(link.href)

      const storagePath = `${resultado.cliente}/${resultado.filename}`
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('conversor-os-arquivos')
        .upload(storagePath, blob, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      if (uploadError) {
        setErro('Arquivo baixado, mas não foi possível salvar no histórico.')
        return
      }

      const logResult = await registrarImportacaoAction({
        cliente: resultado.cliente,
        filename: resultado.filename,
        storagePath,
        linhasOrigem: resultado.linhasOrigem,
        linhasConvertidas: resultado.linhasConvertidas,
        duplicadosRemovidos: resultado.duplicadosRemovidos,
        erros: resultado.erros,
      })
      if ('error' in logResult && logResult.error) {
        setErro('Arquivo baixado, mas não foi possível salvar no histórico.')
        return
      }
      setSalvo(true)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Conversor de OS</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        Converte planilhas de OS do cliente para o formato de importação do Field Control
      </p>

      {erro && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm mb-4">
          {erro}
        </div>
      )}

      {!resultado && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Cliente *</label>
            <select
              value={cliente}
              onChange={(e) => setCliente(e.target.value as Cliente)}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm max-w-xs"
            >
              <option value="">Selecione</option>
              <option value="DPSP">DPSP</option>
              <option value="D1000">D1000</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Planilha (.xlsx) *</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="text-sm text-[#94a3b8]"
            />
          </div>

          <button
            type="button"
            disabled={!cliente || !arquivo || convertendo}
            onClick={handleConverter}
            className="self-start px-6 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
          >
            {convertendo ? 'Convertendo...' : 'Converter'}
          </button>
        </div>
      )}

      {resultado && !salvo && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f]">
              <p className="text-[#4a6080] text-xs">Linhas na origem</p>
              <p className="text-white text-lg font-semibold">{resultado.linhasOrigem}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f]">
              <p className="text-[#4a6080] text-xs">Convertidas</p>
              <p className="text-white text-lg font-semibold">{resultado.linhasConvertidas}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f]">
              <p className="text-[#4a6080] text-xs">Com erro</p>
              <p className="text-white text-lg font-semibold">{resultado.erros.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-[#0d2050] border border-[#1e3a5f]">
              <p className="text-[#4a6080] text-xs">Duplicados removidos</p>
              <p className="text-white text-lg font-semibold">{resultado.duplicadosRemovidos}</p>
            </div>
          </div>

          {resultado.erros.length > 0 && (
            <details className="text-sm text-amber-400">
              <summary className="cursor-pointer">Ver linhas excluídas por erro</summary>
              <ul className="mt-2 flex flex-col gap-1 text-[#94a3b8]">
                {resultado.erros.map((e) => (
                  <li key={e.linha}>{e.motivo}</li>
                ))}
              </ul>
            </details>
          )}

          <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#0d2050] text-[#94a3b8]">
                <tr>
                  <th className="px-3 py-2">Identificador</th>
                  <th className="px-3 py-2">Nome da localização</th>
                  <th className="px-3 py-2">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {resultado.preview.map((row) => (
                  <tr key={row.identificador} className="border-t border-[#1e3a5f] text-white">
                    <td className="px-3 py-2">{row.identificador}</td>
                    <td className="px-3 py-2">{row.nomeLocalizacao}</td>
                    <td className="px-3 py-2">{row.descricao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancelar}
              disabled={salvando}
              className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors active:scale-95 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleBaixar}
              disabled={salvando}
              className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors active:scale-95"
            >
              {salvando ? 'Salvando...' : 'Baixar arquivo'}
            </button>
          </div>
        </div>
      )}

      {salvo && (
        <div className="flex flex-col gap-4">
          <div className="px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">
            Arquivo baixado e registrado no histórico.
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancelar}
              className="px-6 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors active:scale-95"
            >
              Converter outra planilha
            </button>
            <Link
              href="/conversor-os/historico"
              className="px-6 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors active:scale-95"
            >
              Ver histórico
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, sign in with a `@manfac.com.br` account that has a `hub_system_access` row for `conversor-os` (or an admin email), visit `/conversor-os`, select "DPSP", upload `sistema-os/CLIENTE-DPSP_Relatório_Chamados_30-06-2026_12866.xlsx`, click Converter, confirm the summary/preview appear, click "Baixar arquivo", confirm the file downloads and a success message appears. Repeat with D1000 and `sistema-os/CLIENTE-D1000.xlsx`.

- [ ] **Step 4: Commit**

```bash
git add app/conversor-os/layout.tsx app/conversor-os/page.tsx app/conversor-os/_form.tsx
git commit -m "feat(conversor-os): add upload/preview/download page"
```

---

### Task 12: `/conversor-os/historico` page

**Files:**
- Create: `app/conversor-os/historico/page.tsx`
- Create: `app/conversor-os/historico/_table.tsx`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/server` (existing), `isAdminEmail` from `lib/auth/admins` (existing), `obterUrlDownloadAction` from `../_actions` (Task 10).

No automated test — same rationale as Task 11.

- [ ] **Step 1: Implement the page (Server Component, fetches its own data)**

```tsx
// app/conversor-os/historico/page.tsx
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/auth/admins'
import HistoricoTable from './_table'

export default async function HistoricoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const admin = isAdminEmail(user?.email ?? '')
  let query = supabase
    .from('conversor_os_imports')
    .select('id, cliente, filename, storage_path, user_email, total_rows, converted_rows, duplicates_removed, imported_at')
    .order('imported_at', { ascending: false })
  if (!admin) query = query.eq('user_email', user?.email ?? '')

  const { data } = await query

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Histórico de Importações</h1>
      <p className="text-[#4a6080] text-sm mb-8">
        {admin ? 'Todas as conversões realizadas no hub' : 'Suas conversões'}
      </p>
      <HistoricoTable importacoes={data ?? []} mostrarUsuario={admin} />
    </div>
  )
}
```

```tsx
// app/conversor-os/historico/_table.tsx
'use client'

import { useState } from 'react'
import { obterUrlDownloadAction } from '../_actions'

interface Importacao {
  id: string
  cliente: string
  filename: string
  storage_path: string
  user_email: string
  total_rows: number
  converted_rows: number
  duplicates_removed: number
  imported_at: string
}

export default function HistoricoTable({
  importacoes,
  mostrarUsuario,
}: {
  importacoes: Importacao[]
  mostrarUsuario: boolean
}) {
  const [baixandoId, setBaixandoId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleBaixarNovamente(importacao: Importacao) {
    setBaixandoId(importacao.id)
    setErro(null)
    const result = await obterUrlDownloadAction(importacao.storage_path)
    setBaixandoId(null)
    if ('error' in result) {
      setErro(result.error)
      return
    }
    window.open(result.url, '_blank')
  }

  if (importacoes.length === 0) {
    return <p className="text-[#4a6080] text-sm">Nenhuma importação registrada ainda.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {erro}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#0d2050] text-[#94a3b8]">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Cliente</th>
              {mostrarUsuario && <th className="px-3 py-2">Usuário</th>}
              <th className="px-3 py-2">Convertidas</th>
              <th className="px-3 py-2">Duplicados</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {importacoes.map((importacao) => (
              <tr key={importacao.id} className="border-t border-[#1e3a5f] text-white">
                <td className="px-3 py-2">{new Date(importacao.imported_at).toLocaleString('pt-BR')}</td>
                <td className="px-3 py-2">{importacao.cliente}</td>
                {mostrarUsuario && <td className="px-3 py-2">{importacao.user_email}</td>}
                <td className="px-3 py-2">
                  {importacao.converted_rows} / {importacao.total_rows}
                </td>
                <td className="px-3 py-2">{importacao.duplicates_removed}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleBaixarNovamente(importacao)}
                    disabled={baixandoId === importacao.id}
                    className="text-[#f05a28] hover:underline disabled:opacity-50"
                  >
                    {baixandoId === importacao.id ? 'Gerando link...' : 'Baixar novamente'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/conversor-os/historico` after completing Task 11's manual test, confirm the row appears with correct counts, click "Baixar novamente", confirm the file opens/downloads.

- [ ] **Step 3: Commit**

```bash
git add app/conversor-os/historico/page.tsx app/conversor-os/historico/_table.tsx
git commit -m "feat(conversor-os): add import history page with re-download"
```

---

### Task 13: `app/admin/_actions.ts` — list users + toggle access

**Files:**
- Create: `app/admin/_actions.ts`
- Test: `app/admin/__tests__/_actions.test.ts`

**Interfaces:**
- Consumes: `createClient` from `lib/supabase/server` (existing), `createClient` (aliased) from `@supabase/supabase-js`, `isAdminEmail` from `lib/auth/admins` (existing).
- Produces: `UsuarioHub` interface, `listarUsuariosAction(): Promise<UsuarioHub[] | { error: string }>`, `alternarAcessoAction(userEmail, systemSlug, hasAccess): Promise<{ error?: string; success?: boolean }>` (both consumed by Task 14's `acessos/page.tsx` and `_table.tsx`).

- [ ] **Step 1: Write the failing tests**

```typescript
// app/admin/__tests__/_actions.test.ts
const getUserMock = jest.fn()
const upsertMock = jest.fn()
const listUsersMock = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    auth: { getUser: getUserMock },
    from: jest.fn(() => ({ upsert: upsertMock })),
  })),
}))

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: { admin: { listUsers: listUsersMock } },
  })),
}))

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { listarUsuariosAction, alternarAcessoAction } from '../_actions'

describe('listarUsuariosAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects non-admins', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'usuario@manfac.com.br' } } })
    const result = await listarUsuariosAction()
    expect(result).toEqual({ error: 'Apenas administradores podem ver esta página' })
    expect(listUsersMock).not.toHaveBeenCalled()
  })

  it('returns a sorted list of users for an admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'jvictorco28@gmail.com' } } })
    listUsersMock.mockResolvedValue({
      data: {
        users: [
          { id: '2', email: 'zeca@manfac.com.br' },
          { id: '1', email: 'ana@manfac.com.br' },
        ],
      },
      error: null,
    })
    const result = await listarUsuariosAction()
    expect(result).toEqual([
      { id: '1', email: 'ana@manfac.com.br' },
      { id: '2', email: 'zeca@manfac.com.br' },
    ])
  })
})

describe('alternarAcessoAction', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('rejects non-admins', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'usuario@manfac.com.br' } } })
    const result = await alternarAcessoAction('outro@manfac.com.br', 'conversor-os', true)
    expect(result).toEqual({ error: 'Apenas administradores podem alterar acessos' })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('upserts access for an admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'jvictorco28@gmail.com' } } })
    upsertMock.mockResolvedValue({ error: null })
    const result = await alternarAcessoAction('outro@manfac.com.br', 'conversor-os', true)
    expect(result).toEqual({ success: true })
    expect(upsertMock).toHaveBeenCalledWith(
      {
        user_email: 'outro@manfac.com.br',
        system_slug: 'conversor-os',
        has_access: true,
        granted_by: 'jvictorco28@gmail.com',
      },
      { onConflict: 'user_email,system_slug' }
    )
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- app/admin/__tests__/_actions.test.ts`
Expected: FAIL — `Cannot find module '../_actions'`

- [ ] **Step 3: Implement**

```typescript
// app/admin/_actions.ts
'use server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/auth/admins'
import { revalidatePath } from 'next/cache'

export interface UsuarioHub {
  id: string
  email: string
}

export async function listarUsuariosAction(): Promise<UsuarioHub[] | { error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem ver esta página' }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await adminClient.auth.admin.listUsers()
  if (error) return { error: 'Erro ao listar usuários' }

  return data.users
    .filter((u): u is typeof u & { email: string } => !!u.email)
    .map((u) => ({ id: u.id, email: u.email }))
    .sort((a, b) => a.email.localeCompare(b.email))
}

export async function alternarAcessoAction(
  userEmail: string,
  systemSlug: string,
  hasAccess: boolean
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email || !isAdminEmail(user.email))
    return { error: 'Apenas administradores podem alterar acessos' }

  const { error } = await supabase.from('hub_system_access').upsert(
    {
      user_email: userEmail,
      system_slug: systemSlug,
      has_access: hasAccess,
      granted_by: user.email,
    },
    { onConflict: 'user_email,system_slug' }
  )
  if (error) return { error: 'Erro ao atualizar acesso' }

  revalidatePath('/admin/acessos')
  return { success: true }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- app/admin/__tests__/_actions.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/admin/_actions.ts app/admin/__tests__/_actions.test.ts
git commit -m "feat(admin): add Server Actions to list hub users and toggle system access"
```

---

### Task 14: `/admin/acessos` page

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/acessos/page.tsx`
- Create: `app/admin/acessos/_table.tsx`

**Interfaces:**
- Consumes: `listarUsuariosAction`, `alternarAcessoAction`, `UsuarioHub` from `../_actions` (Task 13), `createClient` from `lib/supabase/server` (existing).

No automated test — same rationale as Task 11. `/admin` is already gated by `isAdminEmail` in `middleware.ts` (Task 8), so a non-admin never reaches this page.

- [ ] **Step 1: Implement the layout**

```tsx
// app/admin/layout.tsx
import Link from 'next/link'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <header className="border-b border-[#1e3a5f] bg-[#0d2050] px-6 py-4">
        <Link href="/dashboard" className="text-[#94a3b8] text-sm hover:text-white transition-colors">
          ← Voltar ao Hub
        </Link>
      </header>
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Implement the page and table**

```tsx
// app/admin/acessos/page.tsx
import { createClient } from '@/lib/supabase/server'
import { listarUsuariosAction } from '../_actions'
import AcessosTable from './_table'

const SISTEMAS = [{ slug: 'conversor-os', label: 'Conversor OS' }]

export default async function AcessosPage() {
  const usuarios = await listarUsuariosAction()
  if ('error' in usuarios) {
    return <div className="p-8 text-red-300 text-sm">{usuarios.error}</div>
  }

  const supabase = await createClient()
  const { data: acessos } = await supabase
    .from('hub_system_access')
    .select('user_email, system_slug, has_access')

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Gestão de Acessos</h1>
      <p className="text-[#4a6080] text-sm mb-8">Controle quais usuários acessam cada sistema do hub</p>
      <AcessosTable usuarios={usuarios} sistemas={SISTEMAS} acessos={acessos ?? []} />
    </div>
  )
}
```

```tsx
// app/admin/acessos/_table.tsx
'use client'

import { useState } from 'react'
import { alternarAcessoAction } from '../_actions'
import type { UsuarioHub } from '../_actions'

interface Acesso {
  user_email: string
  system_slug: string
  has_access: boolean
}

export default function AcessosTable({
  usuarios,
  sistemas,
  acessos,
}: {
  usuarios: UsuarioHub[]
  sistemas: { slug: string; label: string }[]
  acessos: Acesso[]
}) {
  const [estado, setEstado] = useState<Record<string, boolean>>(() => {
    const inicial: Record<string, boolean> = {}
    for (const acesso of acessos) inicial[`${acesso.user_email}:${acesso.system_slug}`] = acesso.has_access
    return inicial
  })
  const [salvando, setSalvando] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function handleToggle(email: string, slug: string) {
    const chave = `${email}:${slug}`
    const novoValor = !estado[chave]
    setSalvando(chave)
    setErro(null)
    const result = await alternarAcessoAction(email, slug, novoValor)
    setSalvando(null)
    if ('error' in result && result.error) {
      setErro(result.error)
      return
    }
    setEstado((prev) => ({ ...prev, [chave]: novoValor }))
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
          {erro}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#0d2050] text-[#94a3b8]">
            <tr>
              <th className="px-3 py-2">Usuário</th>
              {sistemas.map((sistema) => (
                <th key={sistema.slug} className="px-3 py-2">{sistema.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="border-t border-[#1e3a5f] text-white">
                <td className="px-3 py-2">{usuario.email}</td>
                {sistemas.map((sistema) => {
                  const chave = `${usuario.email}:${sistema.slug}`
                  const ligado = !!estado[chave]
                  return (
                    <td key={sistema.slug} className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(usuario.email, sistema.slug)}
                        disabled={salvando === chave}
                        className={`w-11 h-6 rounded-full transition-colors relative disabled:opacity-50 ${
                          ligado ? 'bg-[#f05a28]' : 'bg-[#1e3a5f]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                            ligado ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, sign in as an admin email, visit `/admin/acessos`, confirm the user list loads, toggle "Conversor OS" on for a non-admin test user, sign in as that user and confirm `/conversor-os` is now reachable (was redirected to `/dashboard` before the toggle).

- [ ] **Step 4: Commit**

```bash
git add app/admin/layout.tsx app/admin/acessos/page.tsx app/admin/acessos/_table.tsx
git commit -m "feat(admin): add /admin/acessos page for per-system access toggles"
```

---

### Task 15: Dashboard — add Conversor OS and Admin cards

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `isAdminEmail` from `lib/auth/admins` (existing).

No automated test — no precedent for testing `dashboard/page.tsx`.

- [ ] **Step 1: Modify the card grid**

Replace the `<div className="flex items-start gap-4 p-6 rounded-xl border border-dashed ...">` "Em breve" placeholder block with a real Conversor OS card, and add an admin-only card. Also add the `isAdminEmail` import and compute `admin` from the already-fetched `user`:

```tsx
// app/(dashboard)/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logoutAction } from './actions'
import Logo from '@/components/ui/Logo'
import Link from 'next/link'
import { isAdminEmail } from '@/lib/auth/admins'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const fullName = user.user_metadata?.full_name as string | undefined
  const firstName = fullName?.trim().split(/\s+/)[0] ?? 'Colaborador'
  const admin = isAdminEmail(user.email ?? '')

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <header className="border-b border-[#1e3a5f] bg-[#0d2050]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#94a3b8]">{user.email}</span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-[#94a3b8] hover:text-white transition-colors px-3 py-1.5 rounded border border-[#1e3a5f] hover:border-[#f05a28]"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white mb-3">
            Olá, {firstName}!
          </h1>
          <p className="text-[#94a3b8] text-lg">
            Bem-vindo ao Hub Manfac Facilities.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Link
            href="/sofia"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">🚐</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Gestão de Frotas
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Operação de frota — KM, checklist, multas
              </p>
            </div>
          </Link>
          <Link
            href="/conversor-os"
            className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
          >
            <span className="text-3xl">📋</span>
            <div>
              <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                Conversor OS
              </p>
              <p className="text-[#4a6080] text-sm mt-1">
                Converte planilhas de OS para o Field Control
              </p>
            </div>
          </Link>
          {admin && (
            <Link
              href="/admin/acessos"
              className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group"
            >
              <span className="text-3xl">🔑</span>
              <div>
                <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">
                  Admin
                </p>
                <p className="text-[#4a6080] text-sm mt-1">
                  Gestão de acessos aos sistemas do hub
                </p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/dashboard` as a non-admin: confirm the Conversor OS card appears and the Admin card does not. Sign in as an admin: confirm both appear and both links navigate correctly.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat(dashboard): add Conversor OS card and admin-only Admin card"
```

---

## Post-implementation

Run the full suite once more before calling the plan done:

```bash
npm test
npm run build
```

Then run `/code-review` on the branch before deploy, per the project's standard process (spec → plan → código → code review → deploy).
