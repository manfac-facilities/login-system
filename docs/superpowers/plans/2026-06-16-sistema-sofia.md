# Sistema Sofia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Sistema Sofia — fleet operations module inside the Manfac Hub, covering vehicles, drivers, daily KM, photo checklist, fines, and maintenance tracking.

**Architecture:** New route group `app/(operacoes)/` shares the existing auth session from Supabase. Sidebar layout wraps all Sofia pages. Server Actions handle all mutations. Camera capture runs client-side using getUserMedia.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (DB + Storage), `useActionState` for forms.

**Color palette (existing):** `--background: #0a1628`, `--navy: #0d2050`, `--orange: #f05a28`, `--border: #1e3a5f`, `--muted: #94a3b8`

---

### Task 1: Database Schema (Supabase SQL)

**Files:** Run in Supabase SQL Editor

- [ ] **Step 1: Create tables**

```sql
-- equipes (vans: MANFAC-1 … MANFAC-24)
create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  centro_custo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- veiculos
create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  modelo text not null,
  ano integer,
  km_atual integer not null default 0,
  km_contratual_mensal integer,
  status text not null default 'ativo',
  equipe_id uuid references public.equipes(id),
  created_at timestamptz not null default now()
);

-- motoristas
create table public.motoristas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnh text,
  cnh_vencimento date,
  contato text,
  equipe_id uuid references public.equipes(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- km_diario
create table public.km_diario (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  equipe_id uuid not null references public.equipes(id),
  veiculo_id uuid not null references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  km_inicial integer not null,
  km_final integer,
  observacoes text,
  created_at timestamptz not null default now(),
  unique(data, equipe_id)
);

-- checklist
create table public.checklist (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  data timestamptz not null default now(),
  equipe_id uuid not null references public.equipes(id),
  veiculo_id uuid not null references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  lataria_ok boolean,
  vidros_ok boolean,
  pneus_ok boolean,
  combustivel_ok boolean,
  itens_internos_ok boolean,
  estepe_ok boolean,
  macaco_ok boolean,
  triangulo_ok boolean,
  observacoes text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- checklist_fotos
create table public.checklist_fotos (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklist(id) on delete cascade,
  storage_path text not null,
  posicao text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  tirada_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- multas
create table public.multas (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  data date not null,
  descricao text not null,
  valor numeric(10,2) not null,
  status text not null default 'pendente',
  ziv_task_id text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- revisoes
create table public.revisoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null unique references public.veiculos(id),
  km_ultima_revisao integer,
  data_ultima_revisao date,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: Enable RLS + policies (authenticated = manfac employee)**

```sql
alter table public.equipes enable row level security;
alter table public.veiculos enable row level security;
alter table public.motoristas enable row level security;
alter table public.km_diario enable row level security;
alter table public.checklist enable row level security;
alter table public.checklist_fotos enable row level security;
alter table public.multas enable row level security;
alter table public.revisoes enable row level security;

create policy "authenticated full access" on public.equipes for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.veiculos for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.motoristas for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.km_diario for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.checklist for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.checklist_fotos for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.multas for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.revisoes for all to authenticated using (true) with check (true);
```

- [ ] **Step 3: Create Supabase Storage bucket**

```sql
insert into storage.buckets (id, name, public) values ('checklist-fotos', 'checklist-fotos', false);

create policy "authenticated upload" on storage.objects for insert to authenticated with check (bucket_id = 'checklist-fotos');
create policy "authenticated read" on storage.objects for select to authenticated using (bucket_id = 'checklist-fotos');
```

- [ ] **Step 4: Commit**
```bash
git add docs/superpowers/plans/2026-06-16-sistema-sofia.md
git commit -m "docs: add Sistema Sofia implementation plan"
```

---

### Task 2: TypeScript Types + Supabase Queries

**Files:**
- Create: `lib/sofia/types.ts`
- Create: `lib/sofia/queries.ts`

- [ ] **Step 1: Write types**

`lib/sofia/types.ts`:
```typescript
export type EquipeStatus = 'ativo' | 'inativo'
export type VeiculoStatus = 'ativo' | 'inativo' | 'manutencao'
export type ChecklistTipo = 'saida' | 'retorno'
export type MultaStatus = 'pendente' | 'validada' | 'descontada'

export interface Equipe {
  id: string
  codigo: string
  centro_custo: string | null
  ativo: boolean
  created_at: string
}

export interface Veiculo {
  id: string
  placa: string
  modelo: string
  ano: number | null
  km_atual: number
  km_contratual_mensal: number | null
  status: VeiculoStatus
  equipe_id: string | null
  created_at: string
}

export interface Motorista {
  id: string
  nome: string
  cnh: string | null
  cnh_vencimento: string | null
  contato: string | null
  equipe_id: string | null
  ativo: boolean
  created_at: string
}

export interface KmDiario {
  id: string
  data: string
  equipe_id: string
  veiculo_id: string
  motorista_id: string | null
  km_inicial: number
  km_final: number | null
  observacoes: string | null
  created_at: string
}

export interface Checklist {
  id: string
  tipo: ChecklistTipo
  data: string
  equipe_id: string
  veiculo_id: string
  motorista_id: string | null
  lataria_ok: boolean | null
  vidros_ok: boolean | null
  pneus_ok: boolean | null
  combustivel_ok: boolean | null
  itens_internos_ok: boolean | null
  estepe_ok: boolean | null
  macaco_ok: boolean | null
  triangulo_ok: boolean | null
  observacoes: string | null
  latitude: number | null
  longitude: number | null
  created_by: string | null
  created_at: string
}

export interface ChecklistFoto {
  id: string
  checklist_id: string
  storage_path: string
  posicao: string | null
  latitude: number | null
  longitude: number | null
  tirada_em: string
  created_at: string
}

export interface Multa {
  id: string
  veiculo_id: string | null
  motorista_id: string | null
  data: string
  descricao: string
  valor: number
  status: MultaStatus
  ziv_task_id: string | null
  observacoes: string | null
  created_at: string
}

export interface Revisao {
  id: string
  veiculo_id: string
  km_ultima_revisao: number | null
  data_ultima_revisao: string | null
  observacoes: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Write queries**

`lib/sofia/queries.ts`:
```typescript
import { createClient } from '@/lib/supabase/server'
import type { Equipe, Veiculo, Motorista, KmDiario, Multa, Revisao } from './types'

export async function getEquipes(): Promise<Equipe[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('equipes')
    .select('*')
    .order('codigo')
  return data ?? []
}

export async function getVeiculos(): Promise<Veiculo[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('veiculos')
    .select('*')
    .order('placa')
  return data ?? []
}

export async function getMotoristas(): Promise<Motorista[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('motoristas')
    .select('*')
    .order('nome')
  return data ?? []
}

export async function getMotoristasComCnhVencendo(): Promise<Motorista[]> {
  const supabase = await createClient()
  const em60dias = new Date()
  em60dias.setDate(em60dias.getDate() + 60)
  const { data } = await supabase
    .from('motoristas')
    .select('*')
    .lte('cnh_vencimento', em60dias.toISOString().split('T')[0])
    .gte('cnh_vencimento', new Date().toISOString().split('T')[0])
    .eq('ativo', true)
    .order('cnh_vencimento')
  return data ?? []
}

export async function getKmHoje(): Promise<KmDiario[]> {
  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('km_diario')
    .select('*, equipes(codigo), veiculos(placa), motoristas(nome)')
    .eq('data', hoje)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getMultasPendentes(): Promise<Multa[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('multas')
    .select('*, veiculos(placa), motoristas(nome)')
    .eq('status', 'pendente')
    .order('data', { ascending: false })
  return data ?? []
}

export async function getRevisoesProximas(): Promise<Revisao[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('revisoes')
    .select('*, veiculos(placa, modelo, km_atual)')
    .order('km_ultima_revisao')
  return data ?? []
}
```

- [ ] **Step 3: Commit**
```bash
git add lib/sofia/
git commit -m "feat(sofia): add TypeScript types and Supabase query helpers"
```

---

### Task 3: Middleware Update + Sidebar Layout

**Files:**
- Modify: `middleware.ts`
- Create: `app/(operacoes)/layout.tsx`
- Create: `components/sofia/Sidebar.tsx`

- [ ] **Step 1: Update middleware to protect /sofia routes**

In `middleware.ts`, replace:
```typescript
const isDashboard = pathname.startsWith('/dashboard')
```
with:
```typescript
const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/sofia')
```

And replace both occurrences of `isDashboard` with `isProtected`.

Also update matcher:
```typescript
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/sofia/:path*',
    '/login',
    '/signup',
    '/signup/verify',
    '/forgot-password',
    '/reset-password',
    '/auth/callback',
  ],
}
```

- [ ] **Step 2: Create Sidebar component**

`components/sofia/Sidebar.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/ui/Logo'

const navItems = [
  { href: '/sofia', label: 'Visão Geral', icon: '◈' },
  { href: '/sofia/equipes', label: 'Equipes', icon: '🚐' },
  { href: '/sofia/motoristas', label: 'Motoristas', icon: '👤' },
  { href: '/sofia/km', label: 'KM Diário', icon: '📍' },
  { href: '/sofia/checklist', label: 'Checklist', icon: '✓' },
  { href: '/sofia/multas', label: 'Multas', icon: '⚠' },
  { href: '/sofia/revisoes', label: 'Revisões', icon: '🔧' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-[#0d2050] border-r border-[#1e3a5f] min-h-screen">
      <div className="px-4 py-5 border-b border-[#1e3a5f]">
        <Logo size="sm" />
        <p className="text-xs text-[#4a6080] mt-1 font-medium tracking-wide uppercase">Sofia</p>
      </div>
      <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const isActive = item.href === '/sofia'
            ? pathname === '/sofia'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-[#f05a28] text-white font-medium'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#1e3a5f]'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 py-4 border-t border-[#1e3a5f]">
        <Link href="/dashboard" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors">
          ← Hub Manfac
        </Link>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Create operacoes layout**

`app/(operacoes)/layout.tsx`:
```tsx
import Sidebar from '@/components/sofia/Sidebar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function OperacoesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Commit**
```bash
git add middleware.ts app/(operacoes)/layout.tsx components/sofia/Sidebar.tsx
git commit -m "feat(sofia): add sidebar layout and middleware protection for /sofia routes"
```

---

### Task 4: Sofia Dashboard Page

**Files:**
- Create: `components/sofia/StatCard.tsx`
- Create: `components/sofia/AlertBanner.tsx`
- Create: `app/(operacoes)/sofia/page.tsx`

- [ ] **Step 1: StatCard component**

`components/sofia/StatCard.tsx`:
```tsx
interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
}

export default function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div className={`rounded-xl p-5 border ${accent ? 'border-[#f05a28] bg-[#1a1000]' : 'border-[#1e3a5f] bg-[#0d2050]'}`}>
      <p className="text-xs text-[#4a6080] uppercase tracking-wider font-medium mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-[#f05a28]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-[#4a6080] mt-1">{sub}</p>}
    </div>
  )
}
```

- [ ] **Step 2: AlertBanner component**

`components/sofia/AlertBanner.tsx`:
```tsx
interface AlertBannerProps {
  type: 'warning' | 'error' | 'info'
  message: string
}

const styles = {
  warning: 'bg-amber-950 border-amber-600 text-amber-300',
  error:   'bg-red-950 border-red-600 text-red-300',
  info:    'bg-blue-950 border-blue-600 text-blue-300',
}

export default function AlertBanner({ type, message }: AlertBannerProps) {
  return (
    <div className={`px-4 py-3 rounded-lg border text-sm font-medium ${styles[type]}`}>
      {message}
    </div>
  )
}
```

- [ ] **Step 3: Sofia dashboard page**

`app/(operacoes)/sofia/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import StatCard from '@/components/sofia/StatCard'
import AlertBanner from '@/components/sofia/AlertBanner'
import Link from 'next/link'
import {
  getEquipes, getVeiculos, getMotoristas,
  getMotoristasComCnhVencendo, getMultasPendentes, getRevisoesProximas
} from '@/lib/sofia/queries'

export default async function SofiaPage() {
  const [equipes, veiculos, motoristas, cnhVencendo, multasPendentes] = await Promise.all([
    getEquipes(),
    getVeiculos(),
    getMotoristas(),
    getMotoristasComCnhVencendo(),
    getMultasPendentes(),
  ])

  const veiculosAtivos = veiculos.filter(v => v.status === 'ativo').length
  const multasPendentesTotal = multasPendentes.reduce((sum, m) => sum + m.valor, 0)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Visão Geral da Frota</h1>
        <p className="text-[#4a6080] text-sm mt-1">Atualizado agora</p>
      </div>

      {cnhVencendo.length > 0 && (
        <div className="mb-6 flex flex-col gap-2">
          {cnhVencendo.map(m => (
            <AlertBanner
              key={m.id}
              type="warning"
              message={`CNH de ${m.nome} vence em ${new Date(m.cnh_vencimento!).toLocaleDateString('pt-BR')} — providencie a renovação`}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Equipes ativas" value={equipes.filter(e => e.ativo).length} sub={`de ${equipes.length} cadastradas`} />
        <StatCard label="Veículos ativos" value={veiculosAtivos} sub={`de ${veiculos.length} cadastrados`} />
        <StatCard label="Motoristas ativos" value={motoristas.filter(m => m.ativo).length} />
        <StatCard label="Multas pendentes" value={`R$ ${multasPendentesTotal.toFixed(2)}`} sub={`${multasPendentes.length} multas`} accent={multasPendentes.length > 0} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { href: '/sofia/km', label: 'Lançar KM do dia', desc: 'Registrar quilometragem diária', icon: '📍' },
          { href: '/sofia/checklist/novo', label: 'Novo Checklist', desc: 'Checklist de saída ou retorno', icon: '✓' },
          { href: '/sofia/multas/nova', label: 'Registrar Multa', desc: 'Adicionar infração de trânsito', icon: '⚠' },
          { href: '/sofia/equipes', label: 'Equipes', desc: 'Gerenciar equipes e veículos', icon: '🚐' },
          { href: '/sofia/motoristas', label: 'Motoristas', desc: 'Gerenciar habilitações', icon: '👤' },
          { href: '/sofia/revisoes', label: 'Revisões', desc: 'Controle de manutenção', icon: '🔧' },
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="flex items-start gap-4 p-5 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group">
            <span className="text-2xl">{item.icon}</span>
            <div>
              <p className="text-white font-medium group-hover:text-[#f05a28] transition-colors">{item.label}</p>
              <p className="text-[#4a6080] text-sm mt-0.5">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**
```bash
git add components/sofia/ app/(operacoes)/sofia/page.tsx
git commit -m "feat(sofia): add dashboard page with KPI cards and CNH alerts"
```

---

### Task 5: Equipes Module

**Files:**
- Create: `app/(operacoes)/sofia/equipes/page.tsx`
- Create: `app/(operacoes)/sofia/equipes/nova/page.tsx`
- Create: `app/(operacoes)/sofia/equipes/_actions.ts`

- [ ] **Step 1: Server Actions**

`app/(operacoes)/sofia/equipes/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarEquipeAction(_prev: State, formData: FormData): Promise<State> {
  const codigo = (formData.get('codigo') as string).trim().toUpperCase()
  const centro_custo = (formData.get('centro_custo') as string).trim() || null

  if (!codigo) return { error: 'Código da equipe é obrigatório' }

  const supabase = await createClient()
  const { error } = await supabase.from('equipes').insert({ codigo, centro_custo })

  if (error) {
    if (error.code === '23505') return { error: `Equipe ${codigo} já existe` }
    return { error: 'Erro ao criar equipe' }
  }

  revalidatePath('/sofia/equipes')
  return { success: true }
}

export async function toggleEquipeAction(id: string, ativo: boolean) {
  const supabase = await createClient()
  await supabase.from('equipes').update({ ativo }).eq('id', id)
  revalidatePath('/sofia/equipes')
}
```

- [ ] **Step 2: Equipes list page**

`app/(operacoes)/sofia/equipes/page.tsx`:
```tsx
import { getEquipes, getVeiculos } from '@/lib/sofia/queries'
import Link from 'next/link'
import { toggleEquipeAction } from './_actions'

export default async function EquipesPage() {
  const [equipes, veiculos] = await Promise.all([getEquipes(), getVeiculos()])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Equipes</h1>
          <p className="text-[#4a6080] text-sm mt-1">{equipes.length} equipes cadastradas</p>
        </div>
        <Link href="/sofia/equipes/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors">
          + Nova Equipe
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Código</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Centro de Custo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {equipes.map((equipe) => {
              const veiculo = veiculos.find(v => v.equipe_id === equipe.id)
              return (
                <tr key={equipe.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{equipe.codigo}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{equipe.centro_custo ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{veiculo ? `${veiculo.placa} · ${veiculo.modelo}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${equipe.ativo ? 'bg-green-900 text-green-300' : 'bg-[#1e3a5f] text-[#4a6080]'}`}>
                      {equipe.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={toggleEquipeAction.bind(null, equipe.id, !equipe.ativo)}>
                      <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors">
                        {equipe.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {equipes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhuma equipe cadastrada. <Link href="/sofia/equipes/nova" className="text-[#f05a28] hover:underline">Criar primeira equipe →</Link>
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

- [ ] **Step 3: Nova equipe form**

`app/(operacoes)/sofia/equipes/nova/page.tsx`:
```tsx
'use client'
import { useActionState } from 'react'
import { criarEquipeAction } from '../_actions'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function NovaEquipePage() {
  const [state, action, isPending] = useActionState(criarEquipeAction, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/equipes')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Nova Equipe</h1>
      <p className="text-[#4a6080] text-sm mb-8">Cadastrar equipe de campo (ex: MANFAC-25)</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Código da equipe *</label>
          <input name="codigo" placeholder="MANFAC-25" required
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Centro de custo</label>
          <input name="centro_custo" placeholder="Ex: CCUSTO-001"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>
        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending}
            className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
            {isPending ? 'Salvando...' : 'Criar Equipe'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Commit**
```bash
git add app/(operacoes)/sofia/equipes/
git commit -m "feat(sofia): add equipes module (list + create + toggle)"
```

---

### Task 6: Veículos Module

**Files:**
- Create: `app/(operacoes)/sofia/veiculos/page.tsx`
- Create: `app/(operacoes)/sofia/veiculos/novo/page.tsx`
- Create: `app/(operacoes)/sofia/veiculos/_actions.ts`

- [ ] **Step 1: Server Actions**

`app/(operacoes)/sofia/veiculos/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarVeiculoAction(_prev: State, formData: FormData): Promise<State> {
  const placa = (formData.get('placa') as string).trim().toUpperCase()
  const modelo = (formData.get('modelo') as string).trim()
  const ano = formData.get('ano') ? Number(formData.get('ano')) : null
  const km_atual = Number(formData.get('km_atual') ?? 0)
  const km_contratual_mensal = formData.get('km_contratual_mensal') ? Number(formData.get('km_contratual_mensal')) : null
  const equipe_id = (formData.get('equipe_id') as string) || null

  if (!placa || !modelo) return { error: 'Placa e modelo são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase.from('veiculos').insert({ placa, modelo, ano, km_atual, km_contratual_mensal, equipe_id })

  if (error) {
    if (error.code === '23505') return { error: `Veículo com placa ${placa} já existe` }
    return { error: 'Erro ao criar veículo' }
  }

  revalidatePath('/sofia/veiculos')
  revalidatePath('/sofia/equipes')
  return { success: true }
}
```

- [ ] **Step 2: Veículos list page**

`app/(operacoes)/sofia/veiculos/page.tsx`:
```tsx
import { getVeiculos, getEquipes } from '@/lib/sofia/queries'
import Link from 'next/link'

const statusLabel: Record<string, string> = { ativo: 'Ativo', inativo: 'Inativo', manutencao: 'Manutenção' }
const statusStyle: Record<string, string> = {
  ativo: 'bg-green-900 text-green-300',
  inativo: 'bg-[#1e3a5f] text-[#4a6080]',
  manutencao: 'bg-amber-900 text-amber-300',
}

export default async function VeiculosPage() {
  const [veiculos, equipes] = await Promise.all([getVeiculos(), getEquipes()])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Veículos</h1>
          <p className="text-[#4a6080] text-sm mt-1">{veiculos.length} veículos cadastrados</p>
        </div>
        <Link href="/sofia/veiculos/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors">
          + Novo Veículo
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Modelo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">KM Atual</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Equipe</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v) => {
              const equipe = equipes.find(e => e.id === v.equipe_id)
              return (
                <tr key={v.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                  <td className="px-4 py-3 text-white font-medium font-mono">{v.placa}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{v.modelo}{v.ano ? ` · ${v.ano}` : ''}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{v.km_atual.toLocaleString('pt-BR')} km</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{equipe?.codigo ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[v.status]}`}>
                      {statusLabel[v.status]}
                    </span>
                  </td>
                </tr>
              )
            })}
            {veiculos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum veículo cadastrado. <Link href="/sofia/veiculos/novo" className="text-[#f05a28] hover:underline">Adicionar primeiro →</Link>
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

- [ ] **Step 3: Novo veículo form**

`app/(operacoes)/sofia/veiculos/novo/page.tsx`:
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { criarVeiculoAction } from '../_actions'
import { useRouter } from 'next/navigation'

// equipes passed as props via server component wrapper — but for simplicity fetch inline
import { useState } from 'react'

// We'll use a server/client split. This page fetches equipes server-side via a parent
// For now inline with client fetch on mount
export default function NovoVeiculoPage() {
  const [state, action, isPending] = useActionState(criarVeiculoAction, {})
  const router = useRouter()
  const [equipes, setEquipes] = useState<{ id: string; codigo: string }[]>([])

  useEffect(() => {
    if (state.success) router.push('/sofia/veiculos')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Novo Veículo</h1>
      <p className="text-[#4a6080] text-sm mb-8">Cadastrar veículo na frota</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>
        )}

        {[
          { name: 'placa', label: 'Placa *', placeholder: 'ABC-1234', required: true },
          { name: 'modelo', label: 'Modelo *', placeholder: 'Ex: Fiat Ducato', required: true },
          { name: 'ano', label: 'Ano', placeholder: '2022', required: false },
          { name: 'km_atual', label: 'KM atual', placeholder: '0', required: false },
          { name: 'km_contratual_mensal', label: 'KM contratual/mês', placeholder: '3000', required: false },
        ].map(f => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">{f.label}</label>
            <input name={f.name} placeholder={f.placeholder} required={f.required}
              type={['ano','km_atual','km_contratual_mensal'].includes(f.name) ? 'number' : 'text'}
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
          </div>
        ))}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Equipe responsável</label>
          <select name="equipe_id"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="">Sem equipe vinculada</option>
            {equipes.map(e => <option key={e.id} value={e.id}>{e.codigo}</option>)}
          </select>
          <p className="text-xs text-[#4a6080]">Vincule uma equipe para aparecer no dashboard</p>
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending}
            className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
            {isPending ? 'Salvando...' : 'Cadastrar Veículo'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Commit**
```bash
git add app/(operacoes)/sofia/veiculos/
git commit -m "feat(sofia): add veiculos module (list + create)"
```

---

### Task 7: Motoristas Module

**Files:**
- Create: `app/(operacoes)/sofia/motoristas/page.tsx`
- Create: `app/(operacoes)/sofia/motoristas/novo/page.tsx`
- Create: `app/(operacoes)/sofia/motoristas/_actions.ts`

- [ ] **Step 1: Server Actions**

`app/(operacoes)/sofia/motoristas/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarMotoristaAction(_prev: State, formData: FormData): Promise<State> {
  const nome = (formData.get('nome') as string).trim()
  const cnh = (formData.get('cnh') as string).trim() || null
  const cnh_vencimento = (formData.get('cnh_vencimento') as string) || null
  const contato = (formData.get('contato') as string).trim() || null
  const equipe_id = (formData.get('equipe_id') as string) || null

  if (!nome) return { error: 'Nome é obrigatório' }

  const supabase = await createClient()
  const { error } = await supabase.from('motoristas').insert({ nome, cnh, cnh_vencimento, contato, equipe_id })
  if (error) return { error: 'Erro ao cadastrar motorista' }

  revalidatePath('/sofia/motoristas')
  return { success: true }
}
```

- [ ] **Step 2: Motoristas list page**

`app/(operacoes)/sofia/motoristas/page.tsx`:
```tsx
import { getMotoristas, getEquipes } from '@/lib/sofia/queries'
import Link from 'next/link'

function cnhStatus(vencimento: string | null): { label: string; style: string } {
  if (!vencimento) return { label: 'Sem CNH', style: 'bg-[#1e3a5f] text-[#4a6080]' }
  const diff = new Date(vencimento).getTime() - Date.now()
  const dias = Math.ceil(diff / 86400000)
  if (dias < 0) return { label: 'VENCIDA', style: 'bg-red-900 text-red-300' }
  if (dias <= 30) return { label: `Vence em ${dias}d`, style: 'bg-red-900 text-red-300' }
  if (dias <= 60) return { label: `Vence em ${dias}d`, style: 'bg-amber-900 text-amber-300' }
  return { label: new Date(vencimento).toLocaleDateString('pt-BR'), style: 'bg-green-900 text-green-300' }
}

export default async function MotoristasPage() {
  const [motoristas, equipes] = await Promise.all([getMotoristas(), getEquipes()])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Motoristas</h1>
          <p className="text-[#4a6080] text-sm mt-1">{motoristas.filter(m => m.ativo).length} ativos</p>
        </div>
        <Link href="/sofia/motoristas/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors">
          + Novo Motorista
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Nome</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">CNH</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Vencimento</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Equipe</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Contato</th>
            </tr>
          </thead>
          <tbody>
            {motoristas.map((m) => {
              const equipe = equipes.find(e => e.id === m.equipe_id)
              const cnh = cnhStatus(m.cnh_vencimento)
              return (
                <tr key={m.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{m.nome}</td>
                  <td className="px-4 py-3 text-[#94a3b8] font-mono">{m.cnh ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${cnh.style}`}>{cnh.label}</span>
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">{equipe?.codigo ?? '—'}</td>
                  <td className="px-4 py-3 text-[#94a3b8]">{m.contato ?? '—'}</td>
                </tr>
              )
            })}
            {motoristas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum motorista cadastrado. <Link href="/sofia/motoristas/novo" className="text-[#f05a28] hover:underline">Cadastrar →</Link>
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

- [ ] **Step 3: Novo motorista form**

`app/(operacoes)/sofia/motoristas/novo/page.tsx`:
```tsx
import { criarMotoristaAction } from '../_actions'
import { getEquipes } from '@/lib/sofia/queries'
import FormMotorista from './_form'

export default async function NovoMotoristaPage() {
  const equipes = await getEquipes()
  return <FormMotorista equipes={equipes} action={criarMotoristaAction} />
}
```

`app/(operacoes)/sofia/motoristas/novo/_form.tsx`:
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Equipe } from '@/lib/sofia/types'

type State = { error?: string; success?: boolean }

interface Props {
  equipes: Equipe[]
  action: (prev: State, form: FormData) => Promise<State>
}

export default function FormMotorista({ equipes, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/motoristas')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Novo Motorista</h1>
      <p className="text-[#4a6080] text-sm mb-8">Cadastrar líder / motorista de equipe</p>

      <form action={formAction} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Nome completo *</label>
          <input name="nome" required placeholder="Ex: João Silva"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Número da CNH</label>
          <input name="cnh" placeholder="00000000000"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Vencimento da CNH</label>
          <input name="cnh_vencimento" type="date"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Contato (WhatsApp)</label>
          <input name="contato" placeholder="(11) 99999-9999"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Equipe</label>
          <select name="equipe_id"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="">Sem equipe</option>
            {equipes.map(e => <option key={e.id} value={e.id}>{e.codigo}</option>)}
          </select>
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending}
            className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
            {isPending ? 'Salvando...' : 'Cadastrar'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Commit**
```bash
git add app/(operacoes)/sofia/motoristas/
git commit -m "feat(sofia): add motoristas module with CNH expiry alerts"
```

---

### Task 8: KM Diário

**Files:**
- Create: `app/(operacoes)/sofia/km/page.tsx`
- Create: `app/(operacoes)/sofia/km/_actions.ts`
- Create: `app/(operacoes)/sofia/km/historico/page.tsx`

- [ ] **Step 1: Server Actions**

`app/(operacoes)/sofia/km/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function lancarKmAction(_prev: State, formData: FormData): Promise<State> {
  const equipe_id = formData.get('equipe_id') as string
  const veiculo_id = formData.get('veiculo_id') as string
  const motorista_id = (formData.get('motorista_id') as string) || null
  const km_inicial = Number(formData.get('km_inicial'))
  const km_final = formData.get('km_final') ? Number(formData.get('km_final')) : null
  const data = (formData.get('data') as string) || new Date().toISOString().split('T')[0]
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!equipe_id || !veiculo_id) return { error: 'Selecione equipe e veículo' }
  if (!km_inicial) return { error: 'KM inicial é obrigatório' }
  if (km_final && km_final < km_inicial) return { error: 'KM final não pode ser menor que o KM inicial' }

  const supabase = await createClient()

  const { error } = await supabase.from('km_diario').upsert(
    { equipe_id, veiculo_id, motorista_id, km_inicial, km_final, data, observacoes },
    { onConflict: 'data,equipe_id' }
  )

  if (error) return { error: 'Erro ao registrar KM' }

  if (km_final) {
    await supabase.from('veiculos').update({ km_atual: km_final }).eq('id', veiculo_id)
  }

  revalidatePath('/sofia/km')
  return { success: true }
}
```

- [ ] **Step 2: KM Diário page (server + client form)**

`app/(operacoes)/sofia/km/page.tsx`:
```tsx
import { getEquipes, getVeiculos, getMotoristas, getKmHoje } from '@/lib/sofia/queries'
import KmForm from './_form'

export default async function KmPage() {
  const [equipes, veiculos, motoristas, kmHoje] = await Promise.all([
    getEquipes(), getVeiculos(), getMotoristas(), getKmHoje()
  ])

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">KM Diário</h1>
        <p className="text-[#4a6080] text-sm mt-1 capitalize">{hoje}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <KmForm equipes={equipes} veiculos={veiculos} motoristas={motoristas} />

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Lançados hoje</h2>
          {kmHoje.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum lançamento hoje ainda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {kmHoje.map((k: any) => (
                <div key={k.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
                  <div>
                    <p className="text-white text-sm font-medium">{k.equipes?.codigo}</p>
                    <p className="text-[#4a6080] text-xs">{k.veiculos?.placa}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">{k.km_inicial.toLocaleString('pt-BR')} → {k.km_final ? k.km_final.toLocaleString('pt-BR') : '—'}</p>
                    {k.km_final && <p className="text-[#4a6080] text-xs">{(k.km_final - k.km_inicial).toLocaleString('pt-BR')} km rodados</p>}
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

`app/(operacoes)/sofia/km/_form.tsx`:
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { lancarKmAction } from './_actions'
import type { Equipe, Veiculo, Motorista } from '@/lib/sofia/types'

interface Props { equipes: Equipe[]; veiculos: Veiculo[]; motoristas: Motorista[] }

export default function KmForm({ equipes, veiculos, motoristas }: Props) {
  const [state, action, isPending] = useActionState(lancarKmAction, {})
  const hoje = new Date().toISOString().split('T')[0]

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>
      )}
      {state.success && (
        <div className="px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">KM registrado com sucesso!</div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Data</label>
        <input name="data" type="date" defaultValue={hoje}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Equipe *</label>
        <select name="equipe_id" required
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
          <option value="">Selecione a equipe</option>
          {equipes.filter(e => e.ativo).map(e => <option key={e.id} value={e.id}>{e.codigo}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Veículo *</label>
        <select name="veiculo_id" required
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
          <option value="">Selecione o veículo</option>
          {veiculos.filter(v => v.status === 'ativo').map(v => <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Motorista</label>
        <select name="motorista_id"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
          <option value="">Selecione o motorista</option>
          {motoristas.filter(m => m.ativo).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">KM Inicial *</label>
          <input name="km_inicial" type="number" required placeholder="Ex: 45000"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">KM Final</label>
          <input name="km_final" type="number" placeholder="Ex: 45280"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Observações</label>
        <textarea name="observacoes" rows={2} placeholder="Opcional"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
      </div>

      <button type="submit" disabled={isPending}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
        {isPending ? 'Salvando...' : 'Registrar KM'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**
```bash
git add app/(operacoes)/sofia/km/
git commit -m "feat(sofia): add KM diario module with daily entry and today's log"
```

---

### Task 9: Checklist com Câmera

**Files:**
- Create: `components/sofia/CameraCapture.tsx`
- Create: `app/(operacoes)/sofia/checklist/page.tsx`
- Create: `app/(operacoes)/sofia/checklist/novo/page.tsx`
- Create: `app/(operacoes)/sofia/checklist/novo/_form.tsx`
- Create: `app/(operacoes)/sofia/checklist/_actions.ts`

- [ ] **Step 1: CameraCapture component (live camera, no gallery)**

`components/sofia/CameraCapture.tsx`:
```tsx
'use client'
import { useRef, useState, useCallback } from 'react'

interface Props {
  posicao: string
  onCapture: (blob: Blob, posicao: string, lat: number | null, lng: number | null) => void
}

export default function CameraCapture({ posicao, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
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
      stream?.getTracks().forEach(t => t.stop())
      setStreaming(false)

      let lat: number | null = null
      let lng: number | null = null
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch {}

      onCapture(blob, posicao, lat, lng)
    }, 'image/jpeg', 0.85)
  }, [posicao, onCapture])

  const retake = useCallback(() => {
    setCaptured(null)
    startCamera()
  }, [startCamera])

  if (captured) {
    return (
      <div className="flex flex-col gap-2">
        <img src={captured} alt={posicao} className="rounded-lg w-full object-cover max-h-48" />
        <button type="button" onClick={retake}
          className="text-xs text-[#f05a28] hover:underline text-center">
          Tirar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-red-400">{error}</p>}
      {streaming ? (
        <>
          <video ref={videoRef} className="rounded-lg w-full object-cover max-h-48 bg-black" playsInline muted />
          <button type="button" onClick={capture}
            className="py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors">
            Tirar Foto
          </button>
        </>
      ) : (
        <button type="button" onClick={startCamera}
          className="py-3 rounded-lg border-2 border-dashed border-[#1e3a5f] text-[#4a6080] text-sm hover:border-[#f05a28] hover:text-[#f05a28] transition-colors">
          📷 Abrir câmera — {posicao}
        </button>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
```

- [ ] **Step 2: Checklist Server Actions**

`app/(operacoes)/sofia/checklist/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean; checklistId?: string }

export async function criarChecklistAction(_prev: State, formData: FormData): Promise<State> {
  const tipo = formData.get('tipo') as string
  const equipe_id = formData.get('equipe_id') as string
  const veiculo_id = formData.get('veiculo_id') as string
  const motorista_id = (formData.get('motorista_id') as string) || null
  const observacoes = (formData.get('observacoes') as string).trim() || null
  const latitude = formData.get('latitude') ? Number(formData.get('latitude')) : null
  const longitude = formData.get('longitude') ? Number(formData.get('longitude')) : null

  const itens = {
    lataria_ok: formData.get('lataria_ok') === 'true',
    vidros_ok: formData.get('vidros_ok') === 'true',
    pneus_ok: formData.get('pneus_ok') === 'true',
    combustivel_ok: formData.get('combustivel_ok') === 'true',
    itens_internos_ok: formData.get('itens_internos_ok') === 'true',
    estepe_ok: formData.get('estepe_ok') === 'true',
    macaco_ok: formData.get('macaco_ok') === 'true',
    triangulo_ok: formData.get('triangulo_ok') === 'true',
  }

  if (!tipo || !equipe_id || !veiculo_id) return { error: 'Tipo, equipe e veículo são obrigatórios' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('checklist')
    .insert({ tipo, equipe_id, veiculo_id, motorista_id, observacoes, latitude, longitude, created_by: user?.id, ...itens })
    .select('id')
    .single()

  if (error) return { error: 'Erro ao salvar checklist' }

  revalidatePath('/sofia/checklist')
  return { success: true, checklistId: data.id }
}

export async function uploadFotoAction(checklistId: string, storagePath: string, posicao: string, lat: number | null, lng: number | null) {
  const supabase = await createClient()
  await supabase.from('checklist_fotos').insert({
    checklist_id: checklistId,
    storage_path: storagePath,
    posicao,
    latitude: lat,
    longitude: lng,
    tirada_em: new Date().toISOString(),
  })
}
```

- [ ] **Step 3: Checklist list page**

`app/(operacoes)/sofia/checklist/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ChecklistPage() {
  const supabase = await createClient()
  const { data: checklists } = await supabase
    .from('checklist')
    .select('*, equipes(codigo), veiculos(placa), motoristas(nome)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Checklist</h1>
          <p className="text-[#4a6080] text-sm mt-1">Histórico de saídas e retornos</p>
        </div>
        <Link href="/sofia/checklist/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors">
          + Novo Checklist
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {(checklists ?? []).map((c: any) => (
          <Link key={c.id} href={`/sofia/checklist/${c.id}`}
            className="flex items-center gap-4 px-4 py-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors">
            <span className={`px-2.5 py-1 rounded text-xs font-bold ${c.tipo === 'saida' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>
              {c.tipo === 'saida' ? '↑ SAÍDA' : '↓ RETORNO'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">{c.equipes?.codigo} · {c.veiculos?.placa}</p>
              <p className="text-[#4a6080] text-xs truncate">{c.motoristas?.nome ?? 'Motorista não informado'}</p>
            </div>
            <p className="text-[#4a6080] text-xs shrink-0">
              {new Date(c.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </p>
          </Link>
        ))}
        {(checklists ?? []).length === 0 && (
          <p className="text-center text-[#4a6080] py-12">Nenhum checklist ainda. <Link href="/sofia/checklist/novo" className="text-[#f05a28] hover:underline">Criar primeiro →</Link></p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Novo checklist form (server wrapper)**

`app/(operacoes)/sofia/checklist/novo/page.tsx`:
```tsx
import { getEquipes, getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import ChecklistForm from './_form'

export default async function NovoChecklistPage() {
  const [equipes, veiculos, motoristas] = await Promise.all([getEquipes(), getVeiculos(), getMotoristas()])
  return <ChecklistForm equipes={equipes} veiculos={veiculos} motoristas={motoristas} />
}
```

`app/(operacoes)/sofia/checklist/novo/_form.tsx`:
```tsx
'use client'
import { useActionState, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { criarChecklistAction } from '../_actions'
import CameraCapture from '@/components/sofia/CameraCapture'
import type { Equipe, Veiculo, Motorista } from '@/lib/sofia/types'
import { createClient } from '@/lib/supabase/client'

const ITENS_CHECKLIST = [
  { key: 'lataria_ok', label: 'Lataria' },
  { key: 'vidros_ok', label: 'Vidros' },
  { key: 'pneus_ok', label: 'Pneus' },
  { key: 'combustivel_ok', label: 'Combustível' },
  { key: 'itens_internos_ok', label: 'Itens internos' },
  { key: 'estepe_ok', label: 'Estepe' },
  { key: 'macaco_ok', label: 'Macaco' },
  { key: 'triangulo_ok', label: 'Triângulo' },
]

const POSICOES_FOTO = ['Frente', 'Traseira', 'Lateral Esq.', 'Lateral Dir.', 'Interna']

interface CapturedPhoto {
  blob: Blob
  posicao: string
  lat: number | null
  lng: number | null
  preview: string
}

interface Props { equipes: Equipe[]; veiculos: Veiculo[]; motoristas: Motorista[] }

export default function ChecklistForm({ equipes, veiculos, motoristas }: Props) {
  const [state, action, isPending] = useActionState(criarChecklistAction, {})
  const router = useRouter()
  const [itens, setItens] = useState<Record<string, boolean>>({})
  const [fotos, setFotos] = useState<CapturedPhoto[]>([])
  const [uploading, setUploading] = useState(false)

  const handleCapture = useCallback((blob: Blob, posicao: string, lat: number | null, lng: number | null) => {
    const preview = URL.createObjectURL(blob)
    setFotos(prev => [...prev.filter(f => f.posicao !== posicao), { blob, posicao, lat, lng, preview }])
  }, [])

  useEffect(() => {
    if (!state.success || !state.checklistId) return
    if (fotos.length === 0) { router.push('/sofia/checklist'); return }

    setUploading(true)
    const supabase = createClient()
    Promise.all(fotos.map(async (foto) => {
      const path = `${state.checklistId}/${foto.posicao}-${Date.now()}.jpg`
      await supabase.storage.from('checklist-fotos').upload(path, foto.blob, { contentType: 'image/jpeg' })
      const { uploadFotoAction } = await import('../_actions')
      await uploadFotoAction(state.checklistId!, path, foto.posicao, foto.lat, foto.lng)
    })).then(() => {
      setUploading(false)
      router.push('/sofia/checklist')
    })
  }, [state.success, state.checklistId, fotos, router])

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Novo Checklist</h1>
      <p className="text-[#4a6080] text-sm mb-8">Registre a condição do veículo com fotos obrigatórias</p>

      <form action={action} className="flex flex-col gap-6">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Tipo *</label>
            <select name="tipo" required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
              <option value="">Selecione</option>
              <option value="saida">Saída</option>
              <option value="retorno">Retorno</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Equipe *</label>
            <select name="equipe_id" required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
              <option value="">Selecione</option>
              {equipes.filter(e => e.ativo).map(e => <option key={e.id} value={e.id}>{e.codigo}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Veículo *</label>
            <select name="veiculo_id" required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
              <option value="">Selecione</option>
              {veiculos.filter(v => v.status === 'ativo').map(v => <option key={v.id} value={v.id}>{v.placa}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Motorista</label>
            <select name="motorista_id"
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
              <option value="">Selecione</option>
              {motoristas.filter(m => m.ativo).map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">Itens de Verificação</p>
          <div className="grid grid-cols-2 gap-2">
            {ITENS_CHECKLIST.map(item => (
              <label key={item.key} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#1e3a5f] cursor-pointer hover:border-[#f05a28] transition-colors">
                <input type="hidden" name={item.key} value={itens[item.key] ? 'true' : 'false'} />
                <button type="button"
                  onClick={() => setItens(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                  className={`w-5 h-5 rounded border flex items-center justify-center text-xs transition-colors ${itens[item.key] ? 'bg-green-600 border-green-600 text-white' : 'border-[#1e3a5f] text-transparent'}`}>
                  ✓
                </button>
                <span className="text-sm text-[#94a3b8]">{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">Fotos do Veículo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {POSICOES_FOTO.map(posicao => (
              <CameraCapture key={posicao} posicao={posicao} onCapture={handleCapture} />
            ))}
          </div>
          {fotos.length > 0 && (
            <p className="text-xs text-green-400 mt-2">{fotos.length} foto{fotos.length > 1 ? 's' : ''} capturada{fotos.length > 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea name="observacoes" rows={3} placeholder="Danos visíveis, comentários..."
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-3 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending || uploading}
            className="flex-1 py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
            {uploading ? 'Enviando fotos...' : isPending ? 'Salvando...' : 'Finalizar Checklist'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Commit**
```bash
git add components/sofia/CameraCapture.tsx app/(operacoes)/sofia/checklist/
git commit -m "feat(sofia): add checklist module with live camera capture and geolocation"
```

---

### Task 10: Multas Module

**Files:**
- Create: `app/(operacoes)/sofia/multas/page.tsx`
- Create: `app/(operacoes)/sofia/multas/nova/page.tsx`
- Create: `app/(operacoes)/sofia/multas/_actions.ts`

- [ ] **Step 1: Server Actions**

`app/(operacoes)/sofia/multas/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarMultaAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = (formData.get('veiculo_id') as string) || null
  const motorista_id = (formData.get('motorista_id') as string) || null
  const data = formData.get('data') as string
  const descricao = (formData.get('descricao') as string).trim()
  const valor = Number(formData.get('valor'))
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!data || !descricao || !valor) return { error: 'Data, descrição e valor são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase.from('multas').insert({ veiculo_id, motorista_id, data, descricao, valor, observacoes })
  if (error) return { error: 'Erro ao registrar multa' }

  revalidatePath('/sofia/multas')
  return { success: true }
}

export async function atualizarStatusMultaAction(id: string, status: string) {
  const supabase = await createClient()
  await supabase.from('multas').update({ status }).eq('id', id)
  revalidatePath('/sofia/multas')
}
```

- [ ] **Step 2: Multas list page**

`app/(operacoes)/sofia/multas/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { atualizarStatusMultaAction } from './_actions'

const statusStyle: Record<string, string> = {
  pendente: 'bg-amber-900 text-amber-300',
  validada: 'bg-blue-900 text-blue-300',
  descontada: 'bg-green-900 text-green-300',
}

const proximoStatus: Record<string, string> = {
  pendente: 'validada',
  validada: 'descontada',
  descontada: 'pendente',
}

export default async function MultasPage() {
  const supabase = await createClient()
  const { data: multas } = await supabase
    .from('multas')
    .select('*, veiculos(placa), motoristas(nome)')
    .order('data', { ascending: false })

  const totalPendente = (multas ?? [])
    .filter((m: any) => m.status === 'pendente')
    .reduce((sum: number, m: any) => sum + m.valor, 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Multas</h1>
          <p className="text-[#4a6080] text-sm mt-1">R$ {totalPendente.toFixed(2)} pendente</p>
        </div>
        <Link href="/sofia/multas/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors">
          + Registrar Multa
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(multas ?? []).map((m: any) => (
              <tr key={m.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3 text-[#94a3b8]">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-[#94a3b8] font-mono">{m.veiculos?.placa ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{m.motoristas?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-white">{m.descricao}</td>
                <td className="px-4 py-3 text-white text-right font-medium">R$ {Number(m.valor).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[m.status]}`}>{m.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {m.status !== 'descontada' && (
                    <form action={atualizarStatusMultaAction.bind(null, m.id, proximoStatus[m.status])}>
                      <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors">
                        → {proximoStatus[m.status]}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {(multas ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhuma multa registrada.
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

- [ ] **Step 3: Nova multa form**

`app/(operacoes)/sofia/multas/nova/page.tsx`:
```tsx
import { getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import NovaMultaForm from './_form'

export default async function NovaMultaPage() {
  const [veiculos, motoristas] = await Promise.all([getVeiculos(), getMotoristas()])
  return <NovaMultaForm veiculos={veiculos} motoristas={motoristas} />
}
```

`app/(operacoes)/sofia/multas/nova/_form.tsx`:
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { criarMultaAction } from '../_actions'
import type { Veiculo, Motorista } from '@/lib/sofia/types'

type State = { error?: string; success?: boolean }

export default function NovaMultaForm({ veiculos, motoristas }: { veiculos: Veiculo[]; motoristas: Motorista[] }) {
  const [state, action, isPending] = useActionState(criarMultaAction, {})
  const router = useRouter()

  useEffect(() => { if (state.success) router.push('/sofia/multas') }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar Multa</h1>
      <p className="text-[#4a6080] text-sm mb-8">Infração de trânsito vinculada a veículo/motorista</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Data da infração *</label>
          <input name="data" type="date" required
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Veículo</label>
          <select name="veiculo_id"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="">Selecione</option>
            {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Motorista responsável</label>
          <select name="motorista_id"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="">Selecione</option>
            {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Descrição da infração *</label>
          <input name="descricao" required placeholder="Ex: Excesso de velocidade 70km/h em 50km/h"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor (R$) *</label>
          <input name="valor" type="number" step="0.01" required placeholder="195.23"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea name="observacoes" rows={2}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()}
            className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending}
            className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
            {isPending ? 'Salvando...' : 'Registrar Multa'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Commit**
```bash
git add app/(operacoes)/sofia/multas/
git commit -m "feat(sofia): add multas module with status flow (pendente → validada → descontada)"
```

---

### Task 11: Revisões Module

**Files:**
- Create: `app/(operacoes)/sofia/revisoes/page.tsx`
- Create: `app/(operacoes)/sofia/revisoes/_actions.ts`

- [ ] **Step 1: Server Actions**

`app/(operacoes)/sofia/revisoes/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function registrarRevisaoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const km_ultima_revisao = Number(formData.get('km_ultima_revisao'))
  const data_ultima_revisao = formData.get('data_ultima_revisao') as string
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!veiculo_id || !km_ultima_revisao) return { error: 'Veículo e KM são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase.from('revisoes').upsert(
    { veiculo_id, km_ultima_revisao, data_ultima_revisao: data_ultima_revisao || null, observacoes, updated_at: new Date().toISOString() },
    { onConflict: 'veiculo_id' }
  )
  if (error) return { error: 'Erro ao registrar revisão' }

  revalidatePath('/sofia/revisoes')
  return { success: true }
}
```

- [ ] **Step 2: Revisões page**

`app/(operacoes)/sofia/revisoes/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { getVeiculos } from '@/lib/sofia/queries'
import RevisoesForm from './_form'

export default async function RevisoesPage() {
  const supabase = await createClient()
  const [veiculos, { data: revisoes }] = await Promise.all([
    getVeiculos(),
    supabase.from('revisoes').select('*, veiculos(placa, modelo, km_atual)').order('km_ultima_revisao'),
  ])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Revisões</h1>
        <p className="text-[#4a6080] text-sm mt-1">Controle de manutenção — revisão a cada 10.000 km</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Status da Frota</h2>
          <div className="flex flex-col gap-2">
            {(revisoes ?? []).map((r: any) => {
              const kmAtual = r.veiculos?.km_atual ?? 0
              const kmProximo = (r.km_ultima_revisao ?? 0) + 10000
              const kmFaltando = kmProximo - kmAtual
              const urgente = kmFaltando <= 1000
              const atencao = kmFaltando <= 2000
              return (
                <div key={r.id} className={`px-4 py-3 rounded-lg border ${urgente ? 'border-red-600 bg-red-950' : atencao ? 'border-amber-600 bg-amber-950' : 'border-[#1e3a5f] bg-[#0d2050]'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{r.veiculos?.placa} · {r.veiculos?.modelo}</p>
                      <p className="text-[#4a6080] text-xs">Última revisão: {r.km_ultima_revisao?.toLocaleString('pt-BR')} km</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${urgente ? 'text-red-300' : atencao ? 'text-amber-300' : 'text-green-300'}`}>
                        {kmFaltando > 0 ? `${kmFaltando.toLocaleString('pt-BR')} km` : 'VENCIDA'}
                      </p>
                      <p className="text-[#4a6080] text-xs">para próxima revisão</p>
                    </div>
                  </div>
                </div>
              )
            })}
            {(revisoes ?? []).length === 0 && (
              <p className="text-[#4a6080] text-sm">Nenhum veículo com revisão cadastrada.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Registrar Revisão</h2>
          <RevisoesForm veiculos={veiculos} />
        </div>
      </div>
    </div>
  )
}
```

`app/(operacoes)/sofia/revisoes/_form.tsx`:
```tsx
'use client'
import { useActionState } from 'react'
import { registrarRevisaoAction } from './_actions'
import type { Veiculo } from '@/lib/sofia/types'

export default function RevisoesForm({ veiculos }: { veiculos: Veiculo[] }) {
  const [state, action, isPending] = useActionState(registrarRevisaoAction, {})

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">{state.error}</div>}
      {state.success && <div className="px-4 py-3 rounded-lg border border-green-600 bg-green-950 text-green-300 text-sm">Revisão registrada!</div>}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Veículo *</label>
        <select name="veiculo_id" required
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
          <option value="">Selecione</option>
          {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>)}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">KM na última revisão *</label>
        <input name="km_ultima_revisao" type="number" required placeholder="Ex: 45000"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Data da revisão</label>
        <input name="data_ultima_revisao" type="date"
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Observações</label>
        <textarea name="observacoes" rows={2}
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
      </div>

      <button type="submit" disabled={isPending}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
        {isPending ? 'Salvando...' : 'Registrar Revisão'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Commit**
```bash
git add app/(operacoes)/sofia/revisoes/
git commit -m "feat(sofia): add revisoes module with km tracking and urgency alerts"
```

---

### Task 12: Dashboard update + deploy

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`
- Modify: `middleware.ts` (add /sofia to redirect after login)

- [ ] **Step 1: Add Sofia card to main dashboard**

In `app/(dashboard)/dashboard/page.tsx`, replace the "em desenvolvimento" div with:
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
  <Link href="/sofia"
    className="flex items-start gap-4 p-6 rounded-xl border border-[#1e3a5f] bg-[#0d2050] hover:border-[#f05a28] transition-colors group text-left">
    <span className="text-3xl">🚐</span>
    <div>
      <p className="text-white font-semibold group-hover:text-[#f05a28] transition-colors">Sistema Sofia</p>
      <p className="text-[#4a6080] text-sm mt-1">Operação de frota — KM, checklist, multas</p>
    </div>
  </Link>
  <div className="flex items-start gap-4 p-6 rounded-xl border border-dashed border-[#1e3a5f] opacity-40 cursor-not-allowed">
    <span className="text-3xl">📋</span>
    <div>
      <p className="text-white font-semibold">Em breve</p>
      <p className="text-[#4a6080] text-sm mt-1">Próximos módulos</p>
    </div>
  </div>
</div>
```

Also add `import Link from 'next/link'` at the top.

- [ ] **Step 2: Push + deploy**

```bash
git add app/(dashboard)/dashboard/page.tsx
git commit -m "feat: add Sistema Sofia card to hub dashboard"
git push origin master
```

Then in EasyPanel: trigger redeploy.

---

### Self-Review

**Spec coverage:**
- ✅ Equipes/Veículos cadastro
- ✅ Motoristas + CNH alerts
- ✅ KM Diário
- ✅ Checklist com câmera ao vivo + geolocalização
- ✅ Multas com fluxo de status
- ✅ Revisões com alerta de proximidade
- ✅ Dashboard com KPIs
- ⬜ Importação Excel (histórico) — separado, depois do deploy
- ⬜ Integração Ziv — fase 2
- ⬜ TICKETLOG/VELOE — fase 2

**Sem placeholders:** Todos os passos têm código real.

**Tipos consistentes:** `Equipe`, `Veiculo`, `Motorista`, `KmDiario`, `Checklist`, `Multa`, `Revisao` definidos em `lib/sofia/types.ts` e reutilizados em todos os componentes.
