# Sistema Sofia v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Sistema Sofia from the v1 operational draft (equipes, veículos, motoristas, KM, checklist, multas, revisões) into the full scope the client approved: ocorrências (sinistros), compliance (documentos, termos assinados), financeiro (abastecimento, custos, centro de custo histórico), gestão (disponibilidade da frota, pendências & plano de ação), histórico de responsabilidade de veículo, e checklist de troca entre equipes.

**Architecture:** Same route group `app/(operacoes)/sofia/*`, Server Actions for mutations, Supabase for DB + Storage. No production data exists yet in Supabase (v1 SQL was never run) — Task 1 writes the complete fresh schema in one shot, no migrations needed. A hard requirement from the client/João: **no nav item or list→detail link may ever point nowhere** — Task 3 adds an automated test that fails the build if a sidebar route has no corresponding page, and Task 16 re-verifies every link by hand before deploy.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase (DB + Storage), `useActionState` for forms, Jest + Testing Library for logic tests (existing pattern in `lib/auth/__tests__/`).

**Storage:** one new private bucket `sofia-anexos` for everything that isn't a checklist photo (sinistro fotos, documentos do veículo, notas fiscais de revisão, termos/autorizações assinadas), organized by folder prefix (`sinistros/`, `documentos/`, `revisoes/`, `motoristas/`).

---

### Task 1: Database Schema v2 (Supabase SQL)

**Files:** Run in Supabase SQL Editor (projeto `iyytcavcgukfjnjjrerx`)

- [ ] **Step 1: Run complete schema**

```sql
-- ============ TABELAS DA OPERAÇÃO (v1, sem mudança) ============

create table public.equipes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  centro_custo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text not null unique,
  modelo text not null,
  ano integer,
  km_atual integer not null default 0,
  km_contratual_mensal integer,
  valor_locacao_mensal numeric(10,2),
  status text not null default 'ativo', -- ativo | inativo | manutencao
  equipe_id uuid references public.equipes(id),
  created_at timestamptz not null default now()
);

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

-- ============ CHECKLIST (v2: + tipo troca, avaria, entrega, assinatura) ============

create table public.checklist (
  id uuid primary key default gen_random_uuid(),
  tipo text not null, -- saida | retorno | troca
  data timestamptz not null default now(),
  equipe_id uuid not null references public.equipes(id),
  veiculo_id uuid not null references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  equipe_destino_id uuid references public.equipes(id),
  motorista_destino_id uuid references public.motoristas(id),
  lataria_ok boolean,
  vidros_ok boolean,
  pneus_ok boolean,
  combustivel_ok boolean,
  itens_internos_ok boolean,
  estepe_ok boolean,
  macaco_ok boolean,
  triangulo_ok boolean,
  avaria_identificada boolean not null default false,
  avaria_descricao text,
  chave_entregue boolean,
  cartao_combustivel_entregue boolean,
  assinatura_motorista boolean not null default false,
  observacoes text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

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

-- ============ MULTAS (v2: + valor descontado / tipo desconto / autorização) ============

create table public.multas (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  data date not null,
  descricao text not null,
  valor numeric(10,2) not null,
  valor_descontado numeric(10,2),
  tipo_desconto text not null default 'nenhum', -- nenhum | parcial | total
  status text not null default 'pendente', -- pendente | validada | descontada
  autorizacao_assinada boolean not null default false,
  autorizacao_storage_path text,
  ziv_task_id text,
  observacoes text,
  created_at timestamptz not null default now()
);

-- ============ SINISTROS (novo) ============

create table public.sinistros (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid references public.veiculos(id),
  motorista_id uuid references public.motoristas(id),
  data date not null,
  tipo text not null default 'avaria', -- colisao | furto | avaria | outro
  descricao text not null,
  valor_dano numeric(10,2),
  valor_descontado numeric(10,2),
  tipo_desconto text not null default 'nenhum', -- nenhum | parcial | total
  autorizacao_assinada boolean not null default false,
  autorizacao_storage_path text,
  status text not null default 'aberto', -- aberto | em_tratativa | encerrado
  observacoes text,
  created_at timestamptz not null default now()
);

create table public.sinistro_fotos (
  id uuid primary key default gen_random_uuid(),
  sinistro_id uuid not null references public.sinistros(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ============ REVISÕES (v2: de singleton por veículo para histórico) ============

create table public.revisoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  tipo text not null default 'preventiva', -- preventiva | corretiva
  fornecedor text,
  valor numeric(10,2),
  nota_fiscal_storage_path text,
  data_realizada date,
  km_realizada integer,
  proxima_data date,
  proxima_km integer,
  status text not null default 'agendada', -- em_dia | agendada | atrasada
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ DOCUMENTOS DO VEÍCULO (novo) ============

create table public.documentos_veiculo (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  tipo text not null, -- seguro | licenciamento | ipva | outro
  numero text,
  vencimento date not null,
  storage_path text,
  created_at timestamptz not null default now()
);

-- ============ ABASTECIMENTOS (novo) ============

create table public.abastecimentos (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  data date not null default current_date,
  litros numeric(8,2) not null,
  valor numeric(10,2) not null,
  km integer,
  posto text,
  created_at timestamptz not null default now()
);

-- ============ DOCUMENTOS DO MOTORISTA (novo: termo de uso + autorizações) ============

create table public.motorista_documentos (
  id uuid primary key default gen_random_uuid(),
  motorista_id uuid not null references public.motoristas(id),
  tipo text not null, -- termo_uso | autorizacao_desconto
  assinado boolean not null default false,
  data_assinatura date,
  storage_path text,
  multa_id uuid references public.multas(id),
  sinistro_id uuid references public.sinistros(id),
  created_at timestamptz not null default now()
);

-- ============ HISTÓRICO DE RESPONSABILIDADE DO VEÍCULO (novo) ============

create table public.veiculo_responsabilidade_historico (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  equipe_id uuid references public.equipes(id),
  motorista_id uuid references public.motoristas(id),
  inicio date not null,
  fim date,
  origem_checklist_id uuid references public.checklist(id),
  created_at timestamptz not null default now()
);

-- ============ CENTRO DE CUSTO HISTÓRICO (novo, mensal por veículo) ============

create table public.centro_custo_historico (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references public.veiculos(id),
  centro_custo text not null,
  vigente_desde date not null,
  created_at timestamptz not null default now()
);

-- ============ PENDÊNCIAS & PLANO DE AÇÃO (novo, itens manuais) ============

create table public.pendencias (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  origem text not null default 'manual', -- manual | multa | sinistro | manutencao | documento | termo
  responsavel text,
  prazo date,
  proxima_acao text,
  status text not null default 'aberta', -- aberta | em_andamento | concluida
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 2: Enable RLS + policies (authenticated = manfac employee) on every table**

```sql
alter table public.equipes enable row level security;
alter table public.veiculos enable row level security;
alter table public.motoristas enable row level security;
alter table public.km_diario enable row level security;
alter table public.checklist enable row level security;
alter table public.checklist_fotos enable row level security;
alter table public.multas enable row level security;
alter table public.sinistros enable row level security;
alter table public.sinistro_fotos enable row level security;
alter table public.revisoes enable row level security;
alter table public.documentos_veiculo enable row level security;
alter table public.abastecimentos enable row level security;
alter table public.motorista_documentos enable row level security;
alter table public.veiculo_responsabilidade_historico enable row level security;
alter table public.centro_custo_historico enable row level security;
alter table public.pendencias enable row level security;

create policy "authenticated full access" on public.equipes for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.veiculos for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.motoristas for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.km_diario for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.checklist for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.checklist_fotos for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.multas for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.sinistros for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.sinistro_fotos for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.revisoes for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.documentos_veiculo for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.abastecimentos for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.motorista_documentos for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.veiculo_responsabilidade_historico for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.centro_custo_historico for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.pendencias for all to authenticated using (true) with check (true);
```

- [ ] **Step 3: Create Supabase Storage buckets**

```sql
insert into storage.buckets (id, name, public) values ('checklist-fotos', 'checklist-fotos', false);
insert into storage.buckets (id, name, public) values ('sofia-anexos', 'sofia-anexos', false);

create policy "authenticated upload checklist" on storage.objects for insert to authenticated with check (bucket_id = 'checklist-fotos');
create policy "authenticated read checklist" on storage.objects for select to authenticated using (bucket_id = 'checklist-fotos');
create policy "authenticated upload anexos" on storage.objects for insert to authenticated with check (bucket_id = 'sofia-anexos');
create policy "authenticated read anexos" on storage.objects for select to authenticated using (bucket_id = 'sofia-anexos');
```

- [ ] **Step 4: Commit**
```bash
git add docs/superpowers/plans/2026-06-17-sistema-sofia-v2.md
git commit -m "docs: add Sistema Sofia v2 implementation plan"
```

---

### Task 2: TypeScript Types + Queries v2

**Files:**
- Modify: `lib/sofia/types.ts`
- Modify: `lib/sofia/queries.ts`

- [ ] **Step 1: Replace the whole file**

`lib/sofia/types.ts` currently has `VeiculoStatus`, `ChecklistTipo`, `MultaStatus` and the old-shape `Equipe`, `Veiculo`, `Motorista`, `KmDiario`, `Checklist`, `ChecklistFoto`, `Multa`, `Revisao` interfaces (103 lines — the old `Revisao` has `km_ultima_revisao`/`data_ultima_revisao`, which no longer exist after Task 1). **Replace the entire file contents** with the version below — it keeps `VeiculoStatus`, `Equipe`, `Motorista`, `KmDiario` unchanged, rewrites `Veiculo`, `Checklist`, `Multa`, `Revisao`, and adds every new interface:

```typescript
export type VeiculoStatus = 'ativo' | 'inativo' | 'manutencao'
export type ChecklistTipo = 'saida' | 'retorno' | 'troca'
export type MultaStatus = 'pendente' | 'validada' | 'descontada'
export type TipoDesconto = 'nenhum' | 'parcial' | 'total'
export type SinistroTipo = 'colisao' | 'furto' | 'avaria' | 'outro'
export type SinistroStatus = 'aberto' | 'em_tratativa' | 'encerrado'
export type RevisaoTipo = 'preventiva' | 'corretiva'
export type RevisaoStatus = 'em_dia' | 'agendada' | 'atrasada'
export type DocumentoVeiculoTipo = 'seguro' | 'licenciamento' | 'ipva' | 'outro'
export type MotoristaDocumentoTipo = 'termo_uso' | 'autorizacao_desconto'
export type PendenciaOrigem = 'manual' | 'multa' | 'sinistro' | 'manutencao' | 'documento' | 'termo'
export type PendenciaStatus = 'aberta' | 'em_andamento' | 'concluida'

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
  valor_locacao_mensal: number | null
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
  equipe_destino_id: string | null
  motorista_destino_id: string | null
  lataria_ok: boolean | null
  vidros_ok: boolean | null
  pneus_ok: boolean | null
  combustivel_ok: boolean | null
  itens_internos_ok: boolean | null
  estepe_ok: boolean | null
  macaco_ok: boolean | null
  triangulo_ok: boolean | null
  avaria_identificada: boolean
  avaria_descricao: string | null
  chave_entregue: boolean | null
  cartao_combustivel_entregue: boolean | null
  assinatura_motorista: boolean
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
  valor_descontado: number | null
  tipo_desconto: TipoDesconto
  status: MultaStatus
  autorizacao_assinada: boolean
  autorizacao_storage_path: string | null
  ziv_task_id: string | null
  observacoes: string | null
  created_at: string
}

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
  observacoes: string | null
  created_at: string
}

export interface SinistroFoto {
  id: string
  sinistro_id: string
  storage_path: string
  created_at: string
}

export interface Revisao {
  id: string
  veiculo_id: string
  tipo: RevisaoTipo
  fornecedor: string | null
  valor: number | null
  nota_fiscal_storage_path: string | null
  data_realizada: string | null
  km_realizada: number | null
  proxima_data: string | null
  proxima_km: number | null
  status: RevisaoStatus
  observacoes: string | null
  created_at: string
  updated_at: string
}

export interface DocumentoVeiculo {
  id: string
  veiculo_id: string
  tipo: DocumentoVeiculoTipo
  numero: string | null
  vencimento: string
  storage_path: string | null
  created_at: string
}

export interface Abastecimento {
  id: string
  veiculo_id: string
  data: string
  litros: number
  valor: number
  km: number | null
  posto: string | null
  created_at: string
}

export interface MotoristaDocumento {
  id: string
  motorista_id: string
  tipo: MotoristaDocumentoTipo
  assinado: boolean
  data_assinatura: string | null
  storage_path: string | null
  multa_id: string | null
  sinistro_id: string | null
  created_at: string
}

export interface VeiculoResponsabilidadeHistorico {
  id: string
  veiculo_id: string
  equipe_id: string | null
  motorista_id: string | null
  inicio: string
  fim: string | null
  origem_checklist_id: string | null
  created_at: string
}

export interface CentroCustoHistorico {
  id: string
  veiculo_id: string
  centro_custo: string
  vigente_desde: string
  created_at: string
}

export interface Pendencia {
  id: string
  descricao: string
  origem: PendenciaOrigem
  responsavel: string | null
  prazo: string | null
  proxima_acao: string | null
  status: PendenciaStatus
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Replace the whole file**

`lib/sofia/queries.ts` currently exports `getEquipes`, `getVeiculos`, `getMotoristas`, `getMotoristasComCnhVencendo`, `getKmHoje`, `getMultasPendentes`, and `getRevisoesProximas` (67 lines). **`getRevisoesProximas` must be dropped** — it queries `.order('km_ultima_revisao')`, a column that no longer exists after Task 1's restructure, and Task 4's dashboard uses `getRevisoesAtrasadas()` instead. **Replace the entire file contents** with the version below — it keeps the six functions above unchanged and adds every new query function:

```typescript
import { createClient } from '@/lib/supabase/server'
import type {
  Equipe, Veiculo, Motorista, KmDiario, Multa,
  Sinistro, Revisao, DocumentoVeiculo, Abastecimento,
  MotoristaDocumento, VeiculoResponsabilidadeHistorico, CentroCustoHistorico, Pendencia,
} from './types'

export async function getEquipes(): Promise<Equipe[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('equipes').select('*').order('codigo')
  return data ?? []
}

export async function getVeiculos(): Promise<Veiculo[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('veiculos').select('*').order('placa')
  return data ?? []
}

export async function getMotoristas(): Promise<Motorista[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('motoristas').select('*').order('nome')
  return data ?? []
}

export async function getMotoristasComCnhVencendo(): Promise<Motorista[]> {
  const supabase = await createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const em60dias = new Date()
  em60dias.setDate(em60dias.getDate() + 60)
  const limite = em60dias.toISOString().split('T')[0]
  const { data } = await supabase
    .from('motoristas')
    .select('*')
    .lte('cnh_vencimento', limite)
    .gte('cnh_vencimento', hoje)
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
    .select('*')
    .eq('status', 'pendente')
    .order('data', { ascending: false })
  return data ?? []
}

export async function getSinistros(): Promise<Sinistro[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sinistros')
    .select('*, veiculos(placa), motoristas(nome)')
    .order('data', { ascending: false })
  return data ?? []
}

export async function getSinistrosAbertos(): Promise<Sinistro[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sinistros')
    .select('*')
    .neq('status', 'encerrado')
  return data ?? []
}

export async function getRevisoes(veiculoId?: string): Promise<Revisao[]> {
  const supabase = await createClient()
  let query = supabase
    .from('revisoes')
    .select('*, veiculos(placa, modelo)')
    .order('data_realizada', { ascending: false })
  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  const { data } = await query
  return data ?? []
}

export async function getRevisoesAtrasadas(): Promise<Revisao[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('revisoes').select('*').eq('status', 'atrasada')
  return data ?? []
}

export async function getDocumentosVeiculo(veiculoId?: string): Promise<DocumentoVeiculo[]> {
  const supabase = await createClient()
  let query = supabase.from('documentos_veiculo').select('*, veiculos(placa)').order('vencimento')
  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  const { data } = await query
  return data ?? []
}

export async function getDocumentosVencendo(diasLimite = 30): Promise<DocumentoVeiculo[]> {
  const supabase = await createClient()
  const limite = new Date()
  limite.setDate(limite.getDate() + diasLimite)
  const { data } = await supabase
    .from('documentos_veiculo')
    .select('*, veiculos(placa)')
    .lte('vencimento', limite.toISOString().split('T')[0])
  return data ?? []
}

export async function getAbastecimentos(veiculoId?: string): Promise<Abastecimento[]> {
  const supabase = await createClient()
  let query = supabase.from('abastecimentos').select('*, veiculos(placa)').order('data', { ascending: false })
  if (veiculoId) query = query.eq('veiculo_id', veiculoId)
  const { data } = await query
  return data ?? []
}

export async function getMotoristaDocumentos(motoristaId: string): Promise<MotoristaDocumento[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('motorista_documentos')
    .select('*')
    .eq('motorista_id', motoristaId)
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getResponsabilidadeHistorico(veiculoId: string): Promise<VeiculoResponsabilidadeHistorico[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('veiculo_responsabilidade_historico')
    .select('*, equipes(codigo), motoristas(nome)')
    .eq('veiculo_id', veiculoId)
    .order('inicio', { ascending: false })
  return data ?? []
}

export async function getCentroCustoHistorico(veiculoId: string): Promise<CentroCustoHistorico[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('centro_custo_historico')
    .select('*')
    .eq('veiculo_id', veiculoId)
    .order('vigente_desde', { ascending: false })
  return data ?? []
}

export async function getPendenciasManuais(): Promise<Pendencia[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('pendencias')
    .select('*')
    .order('prazo', { ascending: true })
  return data ?? []
}
```

- [ ] **Step 3: Commit**
```bash
git add lib/sofia/
git commit -m "feat(sofia): extend types and queries for v2 modules"
```

---

### Task 3: Navigation Integrity Test + Sidebar v2

**Why this task exists:** João was explicit — a nav item or list→detail link that goes nowhere "não pode acontecer de maneira nenhuma com nosso sistema." This test makes that a build-breaking failure instead of a manual-QA hope.

**Files:**
- Modify: `components/sofia/Sidebar.tsx`
- Create: `components/sofia/__tests__/Sidebar.test.ts`

- [ ] **Step 1: Write the failing test**

`components/sofia/__tests__/Sidebar.test.ts`:
```typescript
import fs from 'fs'
import path from 'path'
import { navSections, detailRoutes } from '../Sidebar'

function pagePath(href: string) {
  return path.join(process.cwd(), 'app', '(operacoes)', href, 'page.tsx')
}

describe('Sidebar navigation integrity', () => {
  const allItems = navSections.flatMap((s) => s.items)

  it('defines at least one nav section', () => {
    expect(navSections.length).toBeGreaterThan(0)
  })

  it.each(allItems.map((item) => [item.label, item.href]))(
    'nav item "%s" (%s) resolves to an existing page.tsx',
    (_label, href) => {
      expect(fs.existsSync(pagePath(href as string))).toBe(true)
    }
  )

  it.each(detailRoutes.map((r) => [r.label, r.href]))(
    'detail route "%s" (%s) resolves to an existing page.tsx',
    (_label, href) => {
      expect(fs.existsSync(pagePath(href as string))).toBe(true)
    }
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Sidebar.test.ts`
Expected: FAIL — `Cannot find module '../Sidebar'` (it doesn't export `navSections`/`detailRoutes` yet) and/or missing page files.

- [ ] **Step 3: Rewrite Sidebar with grouped nav + exported route manifest**

`components/sofia/Sidebar.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Logo from '@/components/ui/Logo'

export const navSections = [
  {
    label: 'Operação',
    items: [
      { href: '/sofia', label: 'Visão Geral', icon: '◈' },
      { href: '/sofia/equipes', label: 'Equipes', icon: '🚐' },
      { href: '/sofia/veiculos', label: 'Veículos', icon: '🚗' },
      { href: '/sofia/motoristas', label: 'Motoristas', icon: '👤' },
      { href: '/sofia/km', label: 'KM Diário', icon: '📍' },
      { href: '/sofia/checklist', label: 'Checklist', icon: '✓' },
    ],
  },
  {
    label: 'Ocorrências',
    items: [
      { href: '/sofia/multas', label: 'Multas', icon: '⚠' },
      { href: '/sofia/sinistros', label: 'Sinistros', icon: '💥' },
    ],
  },
  {
    label: 'Manutenção & Documentos',
    items: [
      { href: '/sofia/revisoes', label: 'Revisões', icon: '🔧' },
      { href: '/sofia/documentos', label: 'Documentos', icon: '📄' },
      { href: '/sofia/abastecimento', label: 'Abastecimento', icon: '⛽' },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { href: '/sofia/custos', label: 'Custos', icon: '💰' },
      { href: '/sofia/disponibilidade', label: 'Disponibilidade', icon: '📊' },
      { href: '/sofia/pendencias', label: 'Pendências', icon: '📋' },
    ],
  },
]

// Dynamic routes the sidebar doesn't link to directly (reached via list rows),
// but that must exist — checked by the same integrity test.
export const detailRoutes = [
  { href: '/sofia/veiculos/[id]', label: 'Veículo · Detalhe' },
  { href: '/sofia/motoristas/[id]', label: 'Motorista · Detalhe' },
  { href: '/sofia/sinistros/[id]', label: 'Sinistro · Tratativa' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-[#0d2050] border-r border-[#1e3a5f] min-h-screen overflow-y-auto">
      <div className="px-4 py-5 border-b border-[#1e3a5f]">
        <Logo size="sm" />
        <p className="text-xs text-[#4a6080] mt-1 font-medium tracking-wide uppercase">Sofia</p>
      </div>
      <nav className="flex-1 px-2 py-4 flex flex-col gap-4">
        {navSections.map((section) => (
          <div key={section.label} className="flex flex-col gap-0.5">
            <p className="px-3 text-[10px] text-[#4a6080] uppercase tracking-wider font-semibold mb-1">
              {section.label}
            </p>
            {section.items.map((item) => {
              const isActive = item.href === '/sofia' ? pathname === '/sofia' : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? 'bg-[#f05a28] text-white font-medium' : 'text-[#94a3b8] hover:text-white hover:bg-[#1e3a5f]'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
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

- [ ] **Step 4: Run test again — still expected to fail**

Run: `npm test -- Sidebar.test.ts`
Expected: FAIL on every route that doesn't have a `page.tsx` yet (everything except `/sofia`, `/sofia/equipes`, `/sofia/veiculos`, `/sofia/motoristas`, `/sofia/km`, `/sofia/checklist`, `/sofia/multas`, `/sofia/revisoes`). This is correct — each subsequent task makes one more of these pass. Task 16 is green across the board.

- [ ] **Step 5: Commit**
```bash
git add components/sofia/Sidebar.tsx components/sofia/__tests__/Sidebar.test.ts
git commit -m "test(sofia): add nav integrity test, regroup sidebar for v2 modules"
```

---

### Task 4: Dashboard v2 (novo KPIs)

**Files:** Modify `app/(operacoes)/sofia/page.tsx`

The current file is 134 lines. Apply these five exact replacements:

- [ ] **Step 1a: Add new query imports**

Replace:
```typescript
import StatCard from '@/components/sofia/StatCard'
import AlertBanner from '@/components/sofia/AlertBanner'
import Link from 'next/link'
import {
  getEquipes,
  getVeiculos,
  getMotoristas,
  getMotoristasComCnhVencendo,
  getMultasPendentes,
} from '@/lib/sofia/queries'
```
With:
```typescript
import StatCard from '@/components/sofia/StatCard'
import AlertBanner from '@/components/sofia/AlertBanner'
import Link from 'next/link'
import {
  getEquipes,
  getVeiculos,
  getMotoristas,
  getMotoristasComCnhVencendo,
  getMultasPendentes,
  getSinistrosAbertos,
  getDocumentosVencendo,
  getRevisoesAtrasadas,
  getPendenciasManuais,
} from '@/lib/sofia/queries'
```

- [ ] **Step 1b: Fetch the new data and compute the new KPIs**

Replace:
```typescript
  const [equipes, veiculos, motoristas, cnhVencendo, multasPendentes] =
    await Promise.all([
      getEquipes(),
      getVeiculos(),
      getMotoristas(),
      getMotoristasComCnhVencendo(),
      getMultasPendentes(),
    ])

  const veiculosAtivos = veiculos.filter((v) => v.status === 'ativo').length
  const multasPendentesTotal = multasPendentes.reduce(
    (sum, m) => sum + m.valor,
    0
  )
```
With:
```typescript
  const [equipes, veiculos, motoristas, cnhVencendo, multasPendentes, sinistrosAbertos, documentosVencendo, revisoesAtrasadas, pendencias] =
    await Promise.all([
      getEquipes(),
      getVeiculos(),
      getMotoristas(),
      getMotoristasComCnhVencendo(),
      getMultasPendentes(),
      getSinistrosAbertos(),
      getDocumentosVencendo(),
      getRevisoesAtrasadas(),
      getPendenciasManuais(),
    ])

  const veiculosAtivos = veiculos.filter((v) => v.status === 'ativo').length
  const multasPendentesTotal = multasPendentes.reduce(
    (sum, m) => sum + m.valor,
    0
  )
  const disponibilidadePct = veiculos.length ? Math.round((veiculosAtivos / veiculos.length) * 100) : 0
  const pendenciasCriticas = pendencias.filter((p) => p.status !== 'concluida').length
```

- [ ] **Step 1c: Add the manutenção atrasada banner after the CNH alerts**

Replace:
```typescript
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
```
With:
```typescript
      )}

      {revisoesAtrasadas.length > 0 && (
        <div className="mb-6">
          <AlertBanner type="error" message={`${revisoesAtrasadas.length} manutenção(ões) atrasada(s) — veja em Revisões`} />
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
```

- [ ] **Step 1d: Add 4 new StatCards after "Multas pendentes"**

Replace:
```typescript
        <StatCard
          label="Multas pendentes"
          value={`R$ ${multasPendentesTotal.toFixed(2)}`}
          sub={`${multasPendentes.length} multa${multasPendentes.length !== 1 ? 's' : ''}`}
          accent={multasPendentes.length > 0}
        />
      </div>
```
With:
```typescript
        <StatCard
          label="Multas pendentes"
          value={`R$ ${multasPendentesTotal.toFixed(2)}`}
          sub={`${multasPendentes.length} multa${multasPendentes.length !== 1 ? 's' : ''}`}
          accent={multasPendentes.length > 0}
        />
        <StatCard
          label="Disponibilidade"
          value={`${disponibilidadePct}%`}
          sub={`${veiculosAtivos} de ${veiculos.length} disponíveis`}
        />
        <StatCard
          label="Sinistros abertos"
          value={sinistrosAbertos.length}
          accent={sinistrosAbertos.length > 0}
        />
        <StatCard
          label="Documentos vencendo"
          value={documentosVencendo.length}
          sub="próximos 30 dias"
          accent={documentosVencendo.length > 0}
        />
        <StatCard
          label="Pendências críticas"
          value={pendenciasCriticas}
          accent={pendenciasCriticas > 0}
        />
      </div>
```

- [ ] **Step 1e: Add 2 quick-action tiles after "Revisões"**

Replace:
```typescript
          {
            href: '/sofia/revisoes',
            label: 'Revisões',
            desc: 'Controle de manutenção preventiva',
            icon: '🔧',
          },
        ].map((item) => (
```
With:
```typescript
          {
            href: '/sofia/revisoes',
            label: 'Revisões',
            desc: 'Controle de manutenção preventiva',
            icon: '🔧',
          },
          {
            href: '/sofia/sinistros/novo',
            label: 'Registrar Sinistro',
            desc: 'Batida, furto ou avaria',
            icon: '💥',
          },
          {
            href: '/sofia/pendencias',
            label: 'Pendências & Plano de Ação',
            desc: 'O que está aberto e quem é o dono',
            icon: '📋',
          },
        ].map((item) => (
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, open `/sofia`, confirm the 4 new KPI cards and the new banner render without runtime errors.

- [ ] **Step 3: Commit**
```bash
git add app/\(operacoes\)/sofia/page.tsx
git commit -m "feat(sofia): add v2 KPIs to dashboard"
```

---

### Task 5: Checklist v2 (tipo Troca, avaria, entrega, assinatura)

**Files:**
- Modify: `app/(operacoes)/sofia/checklist/_actions.ts`
- Modify: `app/(operacoes)/sofia/checklist/novo/_form.tsx`

- [ ] **Step 1: Extend the Server Action to handle `tipo: 'troca'`**

In `app/(operacoes)/sofia/checklist/_actions.ts`, replace `criarChecklistAction` with:
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
  const equipe_destino_id = (formData.get('equipe_destino_id') as string) || null
  const motorista_destino_id = (formData.get('motorista_destino_id') as string) || null
  const observacoes = (formData.get('observacoes') as string).trim() || null
  const latitude = formData.get('latitude') ? Number(formData.get('latitude')) : null
  const longitude = formData.get('longitude') ? Number(formData.get('longitude')) : null
  const avaria_identificada = formData.get('avaria_identificada') === 'true'
  const avaria_descricao = (formData.get('avaria_descricao') as string)?.trim() || null
  const chave_entregue = formData.get('chave_entregue') === 'true'
  const cartao_combustivel_entregue = formData.get('cartao_combustivel_entregue') === 'true'
  const assinatura_motorista = formData.get('assinatura_motorista') === 'true'

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
  if (tipo === 'troca' && !equipe_destino_id) return { error: 'Equipe de destino é obrigatória numa troca' }
  if (!assinatura_motorista) return { error: 'Confirmação do motorista é obrigatória' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('checklist')
    .insert({
      tipo, equipe_id, veiculo_id, motorista_id, equipe_destino_id, motorista_destino_id,
      observacoes, latitude, longitude, created_by: user?.id,
      avaria_identificada, avaria_descricao, chave_entregue, cartao_combustivel_entregue, assinatura_motorista,
      ...itens,
    })
    .select('id')
    .single()

  if (error) return { error: 'Erro ao salvar checklist' }

  if (tipo === 'troca') {
    const hoje = new Date().toISOString().split('T')[0]
    await supabase
      .from('veiculo_responsabilidade_historico')
      .update({ fim: hoje })
      .eq('veiculo_id', veiculo_id)
      .is('fim', null)

    await supabase.from('veiculo_responsabilidade_historico').insert({
      veiculo_id,
      equipe_id: equipe_destino_id,
      motorista_id: motorista_destino_id,
      inicio: hoje,
      origem_checklist_id: data.id,
    })

    await supabase.from('veiculos').update({ equipe_id: equipe_destino_id }).eq('id', veiculo_id)
  }

  revalidatePath('/sofia/checklist')
  revalidatePath('/sofia/veiculos')
  return { success: true, checklistId: data.id }
}

export async function uploadFotoAction(checklistId: string, storagePath: string, posicao: string, lat: number | null, lng: number | null) {
  const supabase = await createClient()
  await supabase.from('checklist_fotos').insert({
    checklist_id: checklistId, storage_path: storagePath, posicao, latitude: lat, longitude: lng,
  })
  revalidatePath('/sofia/checklist')
}
```

- [ ] **Step 2: Add tipo "Troca" + new fields to the form**

In `app/(operacoes)/sofia/checklist/novo/_form.tsx`, the `tipo` select is currently uncontrolled (no `value`/`onChange`), so there's no way to conditionally show the destino fields. Make it controlled first.

Replace:
```tsx
  const [state, action, isPending] = useActionState(criarChecklistAction, {})
  const router = useRouter()
  const [itens, setItens] = useState<Record<string, boolean>>({})
```
With:
```tsx
  const [state, action, isPending] = useActionState(criarChecklistAction, {})
  const router = useRouter()
  const [tipo, setTipo] = useState('')
  const [itens, setItens] = useState<Record<string, boolean>>({})
```

Replace:
```tsx
            <select
              name="tipo"
              required
              className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
            >
              <option value="">Selecione</option>
              <option value="saida">Saída</option>
              <option value="retorno">Retorno</option>
            </select>
```
With:
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

Insert a new block right after the Veículo/Motorista `grid grid-cols-2 gap-3` block and before the `<div>` that starts "Itens de Verificação" (i.e. right after the closing `</div>` of the Veículo/Motorista grid):
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
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[#94a3b8]">Motorista de destino</label>
              <select
                name="motorista_destino_id"
                className="px-3 py-2.5 rounded-lg bg-[#0a1628] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
              >
                <option value="">Selecione</option>
                {motoristas
                  .filter((m) => m.ativo)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}
```

Insert a second new block right after the Fotos `<div>` block and before the Observações `flex flex-col gap-1.5` block:
```tsx
        <div className="flex items-center gap-2">
          <input type="checkbox" name="chave_entregue" value="true" id="chave" className="accent-[#f05a28]" />
          <label htmlFor="chave" className="text-sm text-[#94a3b8]">Chave entregue</label>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" name="cartao_combustivel_entregue" value="true" id="cartao" className="accent-[#f05a28]" />
          <label htmlFor="cartao" className="text-sm text-[#94a3b8]">Cartão combustível entregue</label>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Avaria identificada?</label>
          <select
            name="avaria_identificada"
            defaultValue="false"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          >
            <option value="false">Não</option>
            <option value="true">Sim</option>
          </select>
          <textarea
            name="avaria_descricao"
            rows={2}
            placeholder="Descreva a avaria (se houver)"
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-[#1e3a5f]">
          <input type="checkbox" name="assinatura_motorista" value="true" id="assinatura" required className="accent-[#f05a28]" />
          <label htmlFor="assinatura" className="text-sm text-[#94a3b8]">
            Motorista confirma recebimento/devolução nas condições descritas *
          </label>
        </div>
```

- [ ] **Step 3: Verify manually**

Run dev server, open `/sofia/checklist/novo`, select tipo "Troca", confirm equipe/motorista destino fields appear and the form submits, and confirm `/sofia/veiculos/[id]` (once Task 6 exists) would show the new responsabilidade row.

- [ ] **Step 4: Commit**
```bash
git add app/\(operacoes\)/sofia/checklist/
git commit -m "feat(sofia): add troca checklist type, avaria, entrega and assinatura fields"
```

---

### Task 6: Veículo · Detalhe (timeline de responsabilidade + custo)

**Files:**
- Create: `app/(operacoes)/sofia/veiculos/[id]/page.tsx`
- Modify: `app/(operacoes)/sofia/veiculos/page.tsx` (link rows to detail)

- [ ] **Step 1: Detail page**

`app/(operacoes)/sofia/veiculos/[id]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { getResponsabilidadeHistorico, getCentroCustoHistorico } from '@/lib/sofia/queries'
import { notFound } from 'next/navigation'

export default async function VeiculoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: veiculo }, historico, centroCusto] = await Promise.all([
    supabase.from('veiculos').select('*, equipes(codigo)').eq('id', id).single(),
    getResponsabilidadeHistorico(id),
    getCentroCustoHistorico(id),
  ])

  if (!veiculo) notFound()

  const [{ data: multas }, { data: sinistros }, { data: revisoes }, { data: abastecimentos }] = await Promise.all([
    supabase.from('multas').select('valor, valor_descontado').eq('veiculo_id', id),
    supabase.from('sinistros').select('valor_dano').eq('veiculo_id', id),
    supabase.from('revisoes').select('valor').eq('veiculo_id', id),
    supabase.from('abastecimentos').select('valor').eq('veiculo_id', id),
  ])

  const somaMultas = (multas ?? []).reduce((s, m) => s + (m.valor ?? 0), 0)
  const somaSinistros = (sinistros ?? []).reduce((s, sn) => s + (sn.valor_dano ?? 0), 0)
  const somaRevisoes = (revisoes ?? []).reduce((s, r) => s + (r.valor ?? 0), 0)
  const somaAbastecimento = (abastecimentos ?? []).reduce((s, a) => s + (a.valor ?? 0), 0)
  const locacao = veiculo.valor_locacao_mensal ?? 0
  const totalAcumulado = somaMultas + somaSinistros + somaRevisoes + somaAbastecimento + locacao

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white font-mono">{veiculo.placa}</h1>
        <p className="text-[#4a6080] text-sm mt-1">{veiculo.modelo}{veiculo.ano ? ` · ${veiculo.ano}` : ''}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Responsável atual</h2>
          <div className="p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050] mb-6">
            <p className="text-white font-medium">{veiculo.equipes?.codigo ?? 'Sem equipe vinculada'}</p>
            <p className="text-[#4a6080] text-xs mt-1">Centro de custo vigente: {centroCusto[0]?.centro_custo ?? '—'}</p>
          </div>

          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Histórico de responsabilidade</h2>
          <div className="flex flex-col gap-3 border-l-2 border-[#1e3a5f] pl-4">
            {historico.length === 0 && <p className="text-[#4a6080] text-sm">Sem histórico de troca ainda.</p>}
            {historico.map((h: any) => (
              <div key={h.id} className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#f05a28]" />
                <p className="text-white text-sm">{h.equipes?.codigo ?? '—'} {h.motoristas?.nome ? `· ${h.motoristas.nome}` : ''}</p>
                <p className="text-[#4a6080] text-xs">
                  {new Date(h.inicio).toLocaleDateString('pt-BR')} → {h.fim ? new Date(h.fim).toLocaleDateString('pt-BR') : 'atual'}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Custo acumulado</h2>
          <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
            {[
              ['Locação (mensal)', locacao],
              ['Manutenção', somaRevisoes],
              ['Multas', somaMultas],
              ['Sinistros', somaSinistros],
              ['Abastecimento', somaAbastecimento],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between px-4 py-3 border-b border-[#1e3a5f] last:border-0">
                <span className="text-[#94a3b8] text-sm">{label}</span>
                <span className="text-white text-sm">R$ {(value as number).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 bg-[#0d2050]">
              <span className="text-white text-sm font-medium">Total</span>
              <span className="text-[#f05a28] text-sm font-bold">R$ {totalAcumulado.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Link list rows to detail**

`Link` is already imported in `app/(operacoes)/sofia/veiculos/page.tsx`. Replace the placa cell:
```tsx
                  <td className="px-4 py-3 text-white font-medium font-mono">{v.placa}</td>
```
With:
```tsx
                  <td className="px-4 py-3 text-white font-medium font-mono">
                    <Link href={`/sofia/veiculos/${v.id}`} className="hover:text-[#f05a28] transition-colors">
                      {v.placa}
                    </Link>
                  </td>
```

- [ ] **Step 3: Run nav integrity test**

Run: `npm test -- Sidebar.test.ts`
Expected: the `/sofia/veiculos/[id]` line now PASSES.

- [ ] **Step 4: Commit**
```bash
git add app/\(operacoes\)/sofia/veiculos/
git commit -m "feat(sofia): add veiculo detail page with responsibility timeline and cost rollup"
```

---

### Task 7: Motorista · Detalhe (termos & autorizações)

**Files:**
- Create: `app/(operacoes)/sofia/motoristas/[id]/page.tsx`
- Create: `app/(operacoes)/sofia/motoristas/[id]/_actions.ts`
- Modify: `app/(operacoes)/sofia/motoristas/page.tsx` (link rows to detail)

- [ ] **Step 1: Server actions for documento toggling**

`app/(operacoes)/sofia/motoristas/[id]/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function marcarTermoAssinadoAction(motoristaId: string, assinado: boolean) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('motorista_documentos')
    .select('id')
    .eq('motorista_id', motoristaId)
    .eq('tipo', 'termo_uso')
    .maybeSingle()

  const hoje = new Date().toISOString().split('T')[0]
  if (existing) {
    await supabase.from('motorista_documentos').update({ assinado, data_assinatura: assinado ? hoje : null }).eq('id', existing.id)
  } else {
    await supabase.from('motorista_documentos').insert({ motorista_id: motoristaId, tipo: 'termo_uso', assinado, data_assinatura: assinado ? hoje : null })
  }
  revalidatePath(`/sofia/motoristas/${motoristaId}`)
}
```

- [ ] **Step 2: Detail page**

`app/(operacoes)/sofia/motoristas/[id]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { getMotoristaDocumentos } from '@/lib/sofia/queries'
import { notFound } from 'next/navigation'
import { marcarTermoAssinadoAction } from './_actions'

export default async function MotoristaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: motorista }, documentos] = await Promise.all([
    supabase.from('motoristas').select('*, equipes(codigo)').eq('id', id).single(),
    getMotoristaDocumentos(id),
  ])

  if (!motorista) notFound()

  const termo = documentos.find(d => d.tipo === 'termo_uso')
  const autorizacoes = documentos.filter(d => d.tipo === 'autorizacao_desconto')

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{motorista.nome}</h1>
        <p className="text-[#4a6080] text-sm mt-1">CNH {motorista.cnh ?? '—'} · {motorista.equipes?.codigo ?? 'sem equipe'}</p>
      </div>

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Documentos assinados</h2>

      <div className="flex items-center justify-between p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050] mb-4">
        <div>
          <p className="text-white text-sm font-medium">Termo de Uso de Veículo</p>
          {termo?.assinado && <p className="text-[#4a6080] text-xs mt-1">Assinado em {new Date(termo.data_assinatura!).toLocaleDateString('pt-BR')}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${termo?.assinado ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
            {termo?.assinado ? 'Assinado' : 'Pendente'}
          </span>
          <form action={marcarTermoAssinadoAction.bind(null, id, !termo?.assinado)}>
            <button type="submit" className="text-xs text-[#f05a28] hover:underline">
              {termo?.assinado ? 'Marcar como pendente' : 'Marcar como assinado'}
            </button>
          </form>
        </div>
      </div>

      <h3 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3 mt-6">Autorizações de desconto</h3>
      {autorizacoes.length === 0 ? (
        <p className="text-[#4a6080] text-sm">Nenhuma autorização registrada ainda — gerada ao validar uma multa ou sinistro.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {autorizacoes.map(a => (
            <div key={a.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
              <span className="text-[#94a3b8] text-sm">{a.multa_id ? 'Multa' : 'Sinistro'} · {a.data_assinatura ? new Date(a.data_assinatura).toLocaleDateString('pt-BR') : '—'}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${a.assinado ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                {a.assinado ? 'Assinada' : 'Pendente'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Link list rows to detail**

`Link` is already imported in `app/(operacoes)/sofia/motoristas/page.tsx`. Replace the nome cell:
```tsx
                  <td className="px-4 py-3 text-white font-medium">{m.nome}</td>
```
With:
```tsx
                  <td className="px-4 py-3 text-white font-medium">
                    <Link href={`/sofia/motoristas/${m.id}`} className="hover:text-[#f05a28] transition-colors">
                      {m.nome}
                    </Link>
                  </td>
```

- [ ] **Step 4: Run nav integrity test, then commit**

Run: `npm test -- Sidebar.test.ts` — `/sofia/motoristas/[id]` line now PASSES.

```bash
git add app/\(operacoes\)/sofia/motoristas/
git commit -m "feat(sofia): add motorista detail page with termo de uso and autorizacoes"
```

---

### Task 8: Multas v2 (valor descontado / tipo de desconto / autorização)

**Files:**
- Modify: `app/(operacoes)/sofia/multas/_actions.ts`
- Modify: `app/(operacoes)/sofia/multas/page.tsx`

- [ ] **Step 1: Extend the Server Action**

Replace `atualizarStatusMultaAction` in `app/(operacoes)/sofia/multas/_actions.ts` and add a new action:
```typescript
export async function atualizarStatusMultaAction(id: string, status: string) {
  const supabase = await createClient()
  await supabase.from('multas').update({ status }).eq('id', id)
  revalidatePath('/sofia/multas')
}

export async function registrarDescontoMultaAction(formData: FormData): Promise<void> {
  const id = formData.get('id') as string
  const valor_descontado = Number(formData.get('valor_descontado'))
  const tipo_desconto = formData.get('tipo_desconto') as string
  const autorizacao_assinada = formData.get('autorizacao_assinada') === 'true'

  const supabase = await createClient()
  await supabase
    .from('multas')
    .update({ valor_descontado, tipo_desconto, autorizacao_assinada, status: 'descontada' })
    .eq('id', id)

  revalidatePath('/sofia/multas')
}
```

`registrarDescontoMultaAction` takes only `formData` (no `_prev`) because it's wired as a plain `<form action={...}>` directly in the server-rendered list page below — not through `useActionState` (that hook needs a client component, and a full edit page is out of scope for v2). This matches the existing `atualizarStatusMultaAction` pattern already in this file.

- [ ] **Step 2: Show desconto info + an inline tratativa form in the list**

Replace the whole `app/(operacoes)/sofia/multas/page.tsx` table body `<tr>` and header `<tr>` with the version below (adds a "Desconto" column and a disclosure-based inline form per row; everything else in the file — imports, `statusStyle`, `proximoStatus`, the page wrapper, `totalPendente` — stays the same):

Replace:
```tsx
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
```
With:
```tsx
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Desconto</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
```

Replace:
```tsx
                <td className="px-4 py-3 text-white text-right font-medium">
                  R$ {Number(m.valor).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[m.status]}`}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {proximoStatus[m.status] && (
                    <form
                      action={atualizarStatusMultaAction.bind(
                        null,
                        m.id,
                        proximoStatus[m.status]
                      )}
                    >
                      <button
                        type="submit"
                        className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors"
                      >
                        → {proximoStatus[m.status]}
                      </button>
                    </form>
                  )}
                </td>
```
With:
```tsx
                <td className="px-4 py-3 text-white text-right font-medium">
                  R$ {Number(m.valor).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-[#94a3b8] text-sm">
                  {m.tipo_desconto === 'nenhum' ? '—' : `${m.tipo_desconto === 'total' ? 'Total' : 'Parcial'} · R$ ${Number(m.valor_descontado ?? 0).toFixed(2)}`}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[m.status]}`}
                  >
                    {m.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {proximoStatus[m.status] && (
                    <form
                      action={atualizarStatusMultaAction.bind(
                        null,
                        m.id,
                        proximoStatus[m.status]
                      )}
                    >
                      <button
                        type="submit"
                        className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors"
                      >
                        → {proximoStatus[m.status]}
                      </button>
                    </form>
                  )}
                  <details className="mt-1">
                    <summary className="text-xs text-[#f05a28] cursor-pointer hover:underline">desconto</summary>
                    <form action={registrarDescontoMultaAction} className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-[#1e3a5f] bg-[#0a1628] text-left w-56">
                      <input type="hidden" name="id" value={m.id} />
                      <input
                        name="valor_descontado"
                        type="number"
                        step="0.01"
                        placeholder="Valor descontado"
                        defaultValue={m.valor_descontado ?? ''}
                        className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
                      />
                      <select name="tipo_desconto" defaultValue={m.tipo_desconto} className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs">
                        <option value="nenhum">Nenhum</option>
                        <option value="parcial">Parcial</option>
                        <option value="total">Total</option>
                      </select>
                      <label className="flex items-center gap-2 text-xs text-[#94a3b8]">
                        <input type="checkbox" name="autorizacao_assinada" value="true" defaultChecked={m.autorizacao_assinada} className="accent-[#f05a28]" />
                        Autorização assinada
                      </label>
                      <button type="submit" className="py-1.5 rounded bg-[#f05a28] text-white text-xs font-medium hover:bg-[#d94e22] transition-colors">
                        Salvar
                      </button>
                    </form>
                  </details>
                </td>
```

Add `registrarDescontoMultaAction` to the import from `'./_actions'` at the top of the file.

And split the existing single "total pendente" header stat into two: "Pendente de validação" (`status === 'pendente'`) and "Validada, não descontada" (`status === 'validada'`), keeping the same markup style already in the page header.

- [ ] **Step 3: Verify manually, then commit**

```bash
git add app/\(operacoes\)/sofia/multas/
git commit -m "feat(sofia): add desconto total/parcial tracking to multas"
```

---

### Task 9: Sinistros (novo módulo)

**Files:**
- Create: `app/(operacoes)/sofia/sinistros/page.tsx`
- Create: `app/(operacoes)/sofia/sinistros/novo/page.tsx`
- Create: `app/(operacoes)/sofia/sinistros/novo/_form.tsx`
- Create: `app/(operacoes)/sofia/sinistros/[id]/page.tsx`
- Create: `app/(operacoes)/sofia/sinistros/[id]/_form.tsx`
- Create: `app/(operacoes)/sofia/sinistros/_actions.ts`

- [ ] **Step 1: Server Actions**

`app/(operacoes)/sofia/sinistros/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean; sinistroId?: string }

export async function criarSinistroAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = (formData.get('veiculo_id') as string) || null
  const motorista_id = (formData.get('motorista_id') as string) || null
  const data = formData.get('data') as string
  const tipo = formData.get('tipo') as string
  const descricao = (formData.get('descricao') as string).trim()
  const valor_dano = formData.get('valor_dano') ? Number(formData.get('valor_dano')) : null
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!data || !tipo || !descricao) return { error: 'Data, tipo e descrição são obrigatórios' }

  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('sinistros')
    .insert({ veiculo_id, motorista_id, data, tipo, descricao, valor_dano })
    .select('id')
    .single()

  if (error) return { error: 'Erro ao registrar sinistro' }
  revalidatePath('/sofia/sinistros')
  return { success: true, sinistroId: row.id }
}

export async function uploadFotoSinistroAction(sinistroId: string, storagePath: string) {
  const supabase = await createClient()
  await supabase.from('sinistro_fotos').insert({ sinistro_id: sinistroId, storage_path: storagePath })
  revalidatePath('/sofia/sinistros')
}

export async function atualizarTratativaSinistroAction(_prev: State, formData: FormData): Promise<State> {
  const id = formData.get('id') as string
  const valor_descontado = formData.get('valor_descontado') ? Number(formData.get('valor_descontado')) : null
  const tipo_desconto = formData.get('tipo_desconto') as string
  const autorizacao_assinada = formData.get('autorizacao_assinada') === 'true'
  const status = formData.get('status') as string

  const supabase = await createClient()
  const { error } = await supabase
    .from('sinistros')
    .update({ valor_descontado, tipo_desconto, autorizacao_assinada, status })
    .eq('id', id)

  if (error) return { error: 'Erro ao atualizar tratativa' }
  revalidatePath('/sofia/sinistros')
  return { success: true }
}
```

- [ ] **Step 2: List page**

`app/(operacoes)/sofia/sinistros/page.tsx`:
```tsx
import { getSinistros } from '@/lib/sofia/queries'
import Link from 'next/link'

const statusStyle: Record<string, string> = {
  aberto: 'bg-red-900 text-red-300',
  em_tratativa: 'bg-amber-900 text-amber-300',
  encerrado: 'bg-green-900 text-green-300',
}

const statusLabel: Record<string, string> = {
  aberto: 'Aberto',
  em_tratativa: 'Em tratativa',
  encerrado: 'Encerrado',
}

const tipoLabel: Record<string, string> = {
  colisao: 'Colisão',
  furto: 'Furto',
  avaria: 'Avaria',
  outro: 'Outro',
}

export default async function SinistrosPage() {
  const sinistros = await getSinistros()

  const totalAberto = sinistros
    .filter((s: any) => s.status !== 'encerrado')
    .reduce((sum: number, s: any) => sum + Number(s.valor_dano ?? 0), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Sinistros</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            R$ {totalAberto.toFixed(2)} em sinistros abertos
          </p>
        </div>
        <Link
          href="/sofia/sinistros/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Registrar Sinistro
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Data</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Motorista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor do dano</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Desconto</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {sinistros.map((s: any) => (
              <tr key={s.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3 text-[#94a3b8]">{new Date(s.data).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3 text-[#94a3b8] font-mono">{s.veiculos?.placa ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{s.motoristas?.nome ?? '—'}</td>
                <td className="px-4 py-3 text-white">{tipoLabel[s.tipo]}</td>
                <td className="px-4 py-3 text-white text-right font-medium">
                  R$ {Number(s.valor_dano ?? 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-[#94a3b8] text-sm">
                  {s.tipo_desconto === 'nenhum' ? '—' : `${s.tipo_desconto === 'total' ? 'Total' : 'Parcial'} · R$ ${Number(s.valor_descontado ?? 0).toFixed(2)}`}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/sofia/sinistros/${s.id}`}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[s.status]} hover:opacity-80 transition-opacity`}
                  >
                    {statusLabel[s.status]}
                  </Link>
                </td>
              </tr>
            ))}
            {sinistros.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum sinistro registrado.
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

- [ ] **Step 3: Form page (reusing CameraCapture for damage photos)**

`app/(operacoes)/sofia/sinistros/novo/page.tsx`:
```tsx
import { getVeiculos, getMotoristas } from '@/lib/sofia/queries'
import NovoSinistroForm from './_form'

export default async function NovoSinistroPage() {
  const [veiculos, motoristas] = await Promise.all([getVeiculos(), getMotoristas()])
  return <NovoSinistroForm veiculos={veiculos} motoristas={motoristas} />
}
```

`app/(operacoes)/sofia/sinistros/novo/_form.tsx` (mirrors `checklist/novo/_form.tsx`'s use of `CameraCapture`, uploading to the `sofia-anexos` bucket instead of `checklist-fotos`):
```tsx
'use client'
import { useActionState, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { criarSinistroAction, uploadFotoSinistroAction } from '../_actions'
import CameraCapture from '@/components/sofia/CameraCapture'
import { createClient } from '@/lib/supabase/client'
import type { Veiculo, Motorista } from '@/lib/sofia/types'

interface CapturedPhoto {
  blob: Blob
  posicao: string
}

export default function NovoSinistroForm({
  veiculos,
  motoristas,
}: {
  veiculos: Veiculo[]
  motoristas: Motorista[]
}) {
  const [state, action, isPending] = useActionState(criarSinistroAction, {})
  const router = useRouter()
  const [fotos, setFotos] = useState<CapturedPhoto[]>([])
  const [uploading, setUploading] = useState(false)

  const handleCapture = useCallback((blob: Blob, posicao: string) => {
    setFotos((prev) => [...prev.filter((f) => f.posicao !== posicao), { blob, posicao }])
  }, [])

  useEffect(() => {
    if (!state.success || !state.sinistroId) return
    if (fotos.length === 0) {
      router.push('/sofia/sinistros')
      return
    }
    setUploading(true)
    const supabase = createClient()
    Promise.all(
      fotos.map(async (foto, i) => {
        const path = `sinistros/${state.sinistroId}/${i}-${Date.now()}.jpg`
        await supabase.storage.from('sofia-anexos').upload(path, foto.blob, { contentType: 'image/jpeg' })
        await uploadFotoSinistroAction(state.sinistroId!, path)
      })
    ).then(() => {
      setUploading(false)
      router.push('/sofia/sinistros')
    })
  }, [state.success, state.sinistroId, fotos, router])

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar Sinistro</h1>
      <p className="text-[#4a6080] text-sm mb-8">Batida, furto ou avaria — com fotos do dano</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Veículo</label>
            <select name="veiculo_id" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
              <option value="">Selecione</option>
              {veiculos.map((v) => (
                <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Motorista</label>
            <select name="motorista_id" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
              <option value="">Selecione</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Data *</label>
            <input name="data" type="date" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Tipo *</label>
            <select name="tipo" required defaultValue="avaria" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
              <option value="colisao">Colisão</option>
              <option value="furto">Furto</option>
              <option value="avaria">Avaria</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Descrição *</label>
          <textarea name="descricao" required rows={3} placeholder="O que aconteceu" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor estimado do dano (R$)</label>
          <input name="valor_dano" type="number" step="0.01" placeholder="0.00" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div>
          <p className="text-sm text-[#94a3b8] mb-3">Fotos do dano <span className="text-[#4a6080]">(câmera ao vivo)</span></p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CameraCapture posicao="Dano 1" onCapture={handleCapture} />
            <CameraCapture posicao="Dano 2" onCapture={handleCapture} />
          </div>
          {fotos.length > 0 && (
            <p className="text-xs text-green-400 mt-2">{fotos.length} foto{fotos.length > 1 ? 's' : ''} capturada{fotos.length > 1 ? 's' : ''}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea name="observacoes" rows={2} className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending || uploading} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
            {uploading ? 'Enviando fotos...' : isPending ? 'Salvando...' : 'Registrar Sinistro'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Detail page (tratativa)**

`app/(operacoes)/sofia/sinistros/[id]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import TratativaForm from './_form'

export default async function SinistroDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: sinistro }, { data: fotos }] = await Promise.all([
    supabase.from('sinistros').select('*, veiculos(placa, modelo), motoristas(nome)').eq('id', id).single(),
    supabase.from('sinistro_fotos').select('*').eq('sinistro_id', id),
  ])

  if (!sinistro) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{sinistro.veiculos?.placa ?? 'Sem veículo'}</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          {new Date(sinistro.data).toLocaleDateString('pt-BR')} · {sinistro.motoristas?.nome ?? 'sem motorista'}
        </p>
      </div>

      <p className="text-white text-sm mb-6">{sinistro.descricao}</p>

      {(fotos ?? []).length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Fotos</h2>
          <p className="text-[#4a6080] text-xs">{(fotos ?? []).length} foto(s) anexada(s)</p>
        </div>
      )}

      <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Tratativa</h2>
      <TratativaForm sinistro={sinistro} />
    </div>
  )
}
```

`app/(operacoes)/sofia/sinistros/[id]/_form.tsx`:
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

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor descontado (R$)</label>
          <input
            name="valor_descontado"
            type="number"
            step="0.01"
            defaultValue={sinistro.valor_descontado ?? ''}
            className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Tipo de desconto</label>
          <select name="tipo_desconto" defaultValue={sinistro.tipo_desconto} className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="nenhum">Nenhum</option>
            <option value="parcial">Parcial</option>
            <option value="total">Total</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" name="autorizacao_assinada" value="true" id="autorizacao" defaultChecked={sinistro.autorizacao_assinada} className="accent-[#f05a28]" />
        <label htmlFor="autorizacao" className="text-sm text-[#94a3b8]">Autorização de desconto assinada</label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Status</label>
        <select name="status" defaultValue={sinistro.status} className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
          <option value="aberto">Aberto</option>
          <option value="em_tratativa">Em tratativa</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </div>

      <button type="submit" disabled={isPending} className="py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors w-fit px-6">
        {isPending ? 'Salvando...' : 'Salvar tratativa'}
      </button>
    </form>
  )
}
```

- [ ] **Step 5: Run nav integrity test, then commit**

Run: `npm test -- Sidebar.test.ts` — `/sofia/sinistros` and `/sofia/sinistros/[id]` lines now PASS.

```bash
git add app/\(operacoes\)/sofia/sinistros/
git commit -m "feat(sofia): add sinistros module (list, create, tratativa)"
```

---

### Task 10: Revisões v2 (histórico preventiva/corretiva)

**Files:**
- Rewrite: `app/(operacoes)/sofia/revisoes/page.tsx`
- Create: `app/(operacoes)/sofia/revisoes/nova/page.tsx`
- Create: `app/(operacoes)/sofia/revisoes/nova/_form.tsx`
- Create: `app/(operacoes)/sofia/revisoes/_actions.ts`

- [ ] **Step 1: Server Actions**

`app/(operacoes)/sofia/revisoes/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarRevisaoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const tipo = formData.get('tipo') as string
  const fornecedor = (formData.get('fornecedor') as string).trim() || null
  const valor = formData.get('valor') ? Number(formData.get('valor')) : null
  const data_realizada = (formData.get('data_realizada') as string) || null
  const km_realizada = formData.get('km_realizada') ? Number(formData.get('km_realizada')) : null
  const proxima_data = (formData.get('proxima_data') as string) || null
  const proxima_km = formData.get('proxima_km') ? Number(formData.get('proxima_km')) : null
  const observacoes = (formData.get('observacoes') as string).trim() || null

  if (!veiculo_id || !tipo) return { error: 'Veículo e tipo são obrigatórios' }

  const status = proxima_data && new Date(proxima_data) < new Date() ? 'atrasada' : proxima_data ? 'agendada' : 'em_dia'

  const supabase = await createClient()
  const { error } = await supabase.from('revisoes').insert({
    veiculo_id, tipo, fornecedor, valor, data_realizada, km_realizada, proxima_data, proxima_km, status, observacoes,
  })

  if (error) return { error: 'Erro ao registrar revisão' }
  revalidatePath('/sofia/revisoes')
  return { success: true }
}
```

- [ ] **Step 2: List page (histórico)**

`app/(operacoes)/sofia/revisoes/page.tsx`:
```tsx
import { getRevisoes, getRevisoesAtrasadas } from '@/lib/sofia/queries'
import Link from 'next/link'

const statusStyle: Record<string, string> = {
  em_dia: 'bg-green-900 text-green-300',
  agendada: 'bg-blue-900 text-blue-300',
  atrasada: 'bg-red-900 text-red-300',
}

const statusLabel: Record<string, string> = {
  em_dia: 'Em dia',
  agendada: 'Agendada',
  atrasada: 'Atrasada',
}

const tipoLabel: Record<string, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
}

export default async function RevisoesPage() {
  const [revisoes, atrasadas] = await Promise.all([getRevisoes(), getRevisoesAtrasadas()])

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Revisões</h1>
          <p className="text-[#4a6080] text-sm mt-1">
            {atrasadas.length} manutenção{atrasadas.length !== 1 ? 'ões' : ''} atrasada{atrasadas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/sofia/revisoes/nova"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Registrar Revisão
        </Link>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Veículo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Fornecedor</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Valor</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Realizada em</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Próxima prevista</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(revisoes as any[]).map((r) => (
              <tr key={r.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3 text-white font-medium font-mono">{r.veiculos?.placa ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{tipoLabel[r.tipo]}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{r.fornecedor ?? '—'}</td>
                <td className="px-4 py-3 text-white text-right font-medium">
                  {r.valor != null ? `R$ ${Number(r.valor).toFixed(2)}` : '—'}
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">
                  {r.data_realizada ? new Date(r.data_realizada).toLocaleDateString('pt-BR') : '—'}
                </td>
                <td className="px-4 py-3 text-[#94a3b8]">
                  {r.proxima_data
                    ? new Date(r.proxima_data).toLocaleDateString('pt-BR')
                    : r.proxima_km ? `${r.proxima_km.toLocaleString('pt-BR')} km` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[r.status]}`}>
                    {statusLabel[r.status]}
                  </span>
                </td>
              </tr>
            ))}
            {(revisoes as any[]).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhuma revisão registrada.
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

- [ ] **Step 3: Form page**

`app/(operacoes)/sofia/revisoes/nova/page.tsx`:
```tsx
import { getVeiculos } from '@/lib/sofia/queries'
import NovaRevisaoForm from './_form'

export default async function NovaRevisaoPage() {
  const veiculos = await getVeiculos()
  return <NovaRevisaoForm veiculos={veiculos} />
}
```

`app/(operacoes)/sofia/revisoes/nova/_form.tsx`:
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { criarRevisaoAction } from '../_actions'
import type { Veiculo } from '@/lib/sofia/types'

export default function NovaRevisaoForm({ veiculos }: { veiculos: Veiculo[] }) {
  const [state, action, isPending] = useActionState(criarRevisaoAction, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/revisoes')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Registrar Revisão</h1>
      <p className="text-[#4a6080] text-sm mb-8">Manutenção preventiva ou corretiva</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Veículo *</label>
          <select name="veiculo_id" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="">Selecione</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Tipo *</label>
          <select name="tipo" required defaultValue="preventiva" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="preventiva">Preventiva</option>
            <option value="corretiva">Corretiva</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Fornecedor</label>
          <input name="fornecedor" placeholder="Nome da oficina/fornecedor" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Valor (R$)</label>
          <input name="valor" type="number" step="0.01" placeholder="0.00" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Data realizada</label>
            <input name="data_realizada" type="date" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">KM realizada</label>
            <input name="km_realizada" type="number" placeholder="0" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Próxima data prevista</label>
            <input name="proxima_data" type="date" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[#94a3b8]">Próxima KM prevista</label>
            <input name="proxima_km" type="number" placeholder="0" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Observações</label>
          <textarea name="observacoes" rows={2} className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm resize-none" />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
            {isPending ? 'Salvando...' : 'Registrar Revisão'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run nav integrity test, then commit**

Run: `npm test -- Sidebar.test.ts` — `/sofia/revisoes` already existed and still passes; confirm no regression.

```bash
git add app/\(operacoes\)/sofia/revisoes/
git commit -m "feat(sofia): rebuild revisoes as a history (preventiva/corretiva) instead of one row per vehicle"
```

---

### Task 11: Documentos do Veículo (novo módulo)

**Files:**
- Create: `app/(operacoes)/sofia/documentos/page.tsx`
- Create: `app/(operacoes)/sofia/documentos/novo/page.tsx`
- Create: `app/(operacoes)/sofia/documentos/novo/_form.tsx`
- Create: `app/(operacoes)/sofia/documentos/_actions.ts`

- [ ] **Step 1: Server Action**

`app/(operacoes)/sofia/documentos/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarDocumentoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const tipo = formData.get('tipo') as string
  const numero = (formData.get('numero') as string).trim() || null
  const vencimento = formData.get('vencimento') as string

  if (!veiculo_id || !tipo || !vencimento) return { error: 'Veículo, tipo e vencimento são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase.from('documentos_veiculo').insert({ veiculo_id, tipo, numero, vencimento })

  if (error) return { error: 'Erro ao registrar documento' }
  revalidatePath('/sofia/documentos')
  return { success: true }
}
```

- [ ] **Step 2: List page**

`app/(operacoes)/sofia/documentos/page.tsx`:
```tsx
import { getDocumentosVeiculo } from '@/lib/sofia/queries'
import Link from 'next/link'

const statusStyle: Record<string, string> = {
  valido: 'bg-green-900 text-green-300',
  vence_30d: 'bg-amber-900 text-amber-300',
  vencido: 'bg-red-900 text-red-300',
}

const statusLabel: Record<string, string> = {
  valido: 'Válido',
  vence_30d: 'Vence em 30d',
  vencido: 'Vencido',
}

const tipoLabel: Record<string, string> = {
  seguro: 'Seguro',
  licenciamento: 'Licenciamento (CRLV)',
  ipva: 'IPVA',
  outro: 'Outro',
}

function computeStatus(vencimento: string): 'valido' | 'vence_30d' | 'vencido' {
  const diffDias = (new Date(vencimento).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (diffDias < 0) return 'vencido'
  if (diffDias <= 30) return 'vence_30d'
  return 'valido'
}

export default async function DocumentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const documentos = await getDocumentosVeiculo()
  const comStatus = documentos.map((d) => ({ ...d, statusCalc: computeStatus(d.vencimento) }))
  const filtrados = status ? comStatus.filter((d) => d.statusCalc === status) : comStatus

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Documentos</h1>
          <p className="text-[#4a6080] text-sm mt-1">Seguro, licenciamento e IPVA por veículo</p>
        </div>
        <Link
          href="/sofia/documentos/novo"
          className="px-4 py-2 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] transition-colors"
        >
          + Adicionar Documento
        </Link>
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { value: undefined, label: 'Todos' },
          { value: 'valido', label: 'Válido' },
          { value: 'vence_30d', label: 'Vence em 30d' },
          { value: 'vencido', label: 'Vencido' },
        ].map((opt) => (
          <Link
            key={opt.label}
            href={opt.value ? `/sofia/documentos?status=${opt.value}` : '/sofia/documentos'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              status === opt.value ? 'border-[#f05a28] text-[#f05a28]' : 'border-[#1e3a5f] text-[#94a3b8] hover:border-[#94a3b8]'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Número/Apólice</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Vencimento</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((d: any) => (
              <tr key={d.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3 text-white font-medium font-mono">{d.veiculos?.placa ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{tipoLabel[d.tipo]}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{d.numero ?? '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{new Date(d.vencimento).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[d.statusCalc]}`}>
                    {statusLabel[d.statusCalc]}
                  </span>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[#4a6080]">
                  Nenhum documento encontrado.
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

- [ ] **Step 3: Form page**

`app/(operacoes)/sofia/documentos/novo/page.tsx`:
```tsx
import { getVeiculos } from '@/lib/sofia/queries'
import NovoDocumentoForm from './_form'

export default async function NovoDocumentoPage() {
  const veiculos = await getVeiculos()
  return <NovoDocumentoForm veiculos={veiculos} />
}
```

`app/(operacoes)/sofia/documentos/novo/_form.tsx`:
```tsx
'use client'
import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { criarDocumentoAction } from '../_actions'
import type { Veiculo } from '@/lib/sofia/types'

export default function NovoDocumentoForm({ veiculos }: { veiculos: Veiculo[] }) {
  const [state, action, isPending] = useActionState(criarDocumentoAction, {})
  const router = useRouter()

  useEffect(() => {
    if (state.success) router.push('/sofia/documentos')
  }, [state.success, router])

  return (
    <div className="p-8 max-w-md">
      <h1 className="text-2xl font-bold text-white mb-2">Adicionar Documento</h1>
      <p className="text-[#4a6080] text-sm mb-8">Seguro, licenciamento, IPVA ou outro</p>

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="px-4 py-3 rounded-lg border border-red-600 bg-red-950 text-red-300 text-sm">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Veículo *</label>
          <select name="veiculo_id" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="">Selecione</option>
            {veiculos.map((v) => (
              <option key={v.id} value={v.id}>{v.placa} · {v.modelo}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Tipo *</label>
          <select name="tipo" required defaultValue="seguro" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm">
            <option value="seguro">Seguro</option>
            <option value="licenciamento">Licenciamento (CRLV)</option>
            <option value="ipva">IPVA</option>
            <option value="outro">Outro</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Número/Apólice</label>
          <input name="numero" placeholder="Número do documento" className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white placeholder-[#4a6080] focus:outline-none focus:border-[#f05a28] text-sm" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Vencimento *</label>
          <input name="vencimento" type="date" required className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm [color-scheme:dark]" />
        </div>

        <div className="flex gap-3 mt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 rounded-lg border border-[#1e3a5f] text-[#94a3b8] text-sm hover:border-[#94a3b8] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
            {isPending ? 'Salvando...' : 'Adicionar Documento'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run nav integrity test, then commit**

```bash
git add app/\(operacoes\)/sofia/documentos/
git commit -m "feat(sofia): add documentos module (seguro/licenciamento tracking)"
```

---

### Task 12: Abastecimento (novo módulo)

**Files:**
- Create: `app/(operacoes)/sofia/abastecimento/page.tsx`
- Create: `app/(operacoes)/sofia/abastecimento/_form.tsx`
- Create: `app/(operacoes)/sofia/abastecimento/_actions.ts`

- [ ] **Step 1: Server Action**

`app/(operacoes)/sofia/abastecimento/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function lancarAbastecimentoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const data = (formData.get('data') as string) || new Date().toISOString().split('T')[0]
  const litros = Number(formData.get('litros'))
  const valor = Number(formData.get('valor'))
  const km = formData.get('km') ? Number(formData.get('km')) : null
  const posto = (formData.get('posto') as string).trim() || null

  if (!veiculo_id || !litros || !valor) return { error: 'Veículo, litros e valor são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase.from('abastecimentos').insert({ veiculo_id, data, litros, valor, km, posto })

  if (error) return { error: 'Erro ao registrar abastecimento' }
  revalidatePath('/sofia/abastecimento')
  return { success: true }
}
```

- [ ] **Step 2: Split page — lançamento + relatório do mês**

`app/(operacoes)/sofia/abastecimento/page.tsx` (split layout like `km/page.tsx`; computes R$/km and Km/litro by joining with `km_diario` for the month — comparação com mês anterior fica fora do v2 por prazo, é só mês corrente):
```tsx
import { createClient } from '@/lib/supabase/server'
import { getVeiculos, getAbastecimentos } from '@/lib/sofia/queries'
import AbastecimentoForm from './_form'

export default async function AbastecimentoPage() {
  const [veiculos, abastecimentos] = await Promise.all([getVeiculos(), getAbastecimentos()])

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: kmMes } = await supabase
    .from('km_diario')
    .select('veiculo_id, km_inicial, km_final')
    .gte('data', inicioMes)

  const kmPorVeiculo = new Map<string, number>()
  for (const k of kmMes ?? []) {
    if (k.km_final == null) continue
    kmPorVeiculo.set(k.veiculo_id, (kmPorVeiculo.get(k.veiculo_id) ?? 0) + (k.km_final - k.km_inicial))
  }

  const doMes = (abastecimentos as any[]).filter((a) => a.data >= inicioMes)
  const porVeiculo = new Map<string, { placa: string; litros: number; valor: number }>()
  for (const a of doMes) {
    const atual = porVeiculo.get(a.veiculo_id) ?? { placa: a.veiculos?.placa ?? '—', litros: 0, valor: 0 }
    atual.litros += Number(a.litros)
    atual.valor += Number(a.valor)
    porVeiculo.set(a.veiculo_id, atual)
  }

  const relatorio = Array.from(porVeiculo.entries()).map(([veiculoId, r]) => {
    const km = kmPorVeiculo.get(veiculoId) ?? 0
    return {
      ...r,
      valorPorKm: km > 0 ? r.valor / km : null,
      kmPorLitro: r.litros > 0 ? km / r.litros : null,
    }
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Abastecimento</h1>
        <p className="text-[#4a6080] text-sm mt-1">Lançamento manual + consumo do mês</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <AbastecimentoForm veiculos={veiculos} />

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">
            Consumo do mês
          </h2>
          {relatorio.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum abastecimento lançado neste mês.</p>
          ) : (
            <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
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
                      <td className="px-4 py-3 text-[#94a3b8] text-right">{r.litros.toFixed(1)}</td>
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
    </div>
  )
}
```

`app/(operacoes)/sofia/abastecimento/_form.tsx` (same `useActionState` + inline success-banner pattern as `km/_form.tsx` — no redirect, since this is a split page, not a separate "novo" route):
```tsx
'use client'
import { useActionState } from 'react'
import { lancarAbastecimentoAction } from './_actions'
import type { Veiculo } from '@/lib/sofia/types'

export default function AbastecimentoForm({ veiculos }: { veiculos: Veiculo[] }) {
  const [state, action, isPending] = useActionState(lancarAbastecimentoAction, {})
  const hoje = new Date().toISOString().split('T')[0]

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
        <label className="text-sm text-[#94a3b8]">Veículo *</label>
        <select
          name="veiculo_id"
          required
          className="px-3 py-2.5 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white focus:outline-none focus:border-[#f05a28] text-sm"
        >
          <option value="">Selecione o veículo</option>
          {veiculos
            .filter((v) => v.status === 'ativo')
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa} · {v.modelo}
              </option>
            ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[#94a3b8]">Litros *</label>
          <input
            name="litros"
            type="number"
            step="0.01"
            required
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
        disabled={isPending}
        className="py-3 rounded-lg bg-[#f05a28] text-white font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Salvando...' : 'Registrar Abastecimento'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Run nav integrity test, then commit**

```bash
git add app/\(operacoes\)/sofia/abastecimento/
git commit -m "feat(sofia): add abastecimento module (lancamento + relatorio mensal)"
```

---

### Task 13: Custos (novo módulo + atualização de centro de custo)

**Files:**
- Create: `app/(operacoes)/sofia/custos/page.tsx`
- Create: `app/(operacoes)/sofia/custos/_form.tsx`
- Create: `app/(operacoes)/sofia/custos/_actions.ts`

- [ ] **Step 1: Server Action — atualizar centro de custo (gera histórico, não sobrescreve)**

`app/(operacoes)/sofia/custos/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function atualizarCentroCustoAction(_prev: State, formData: FormData): Promise<State> {
  const veiculo_id = formData.get('veiculo_id') as string
  const centro_custo = (formData.get('centro_custo') as string).trim()
  const vigente_desde = (formData.get('vigente_desde') as string) || new Date().toISOString().split('T')[0]

  if (!veiculo_id || !centro_custo) return { error: 'Veículo e centro de custo são obrigatórios' }

  const supabase = await createClient()
  const { error } = await supabase.from('centro_custo_historico').insert({ veiculo_id, centro_custo, vigente_desde })

  if (error) return { error: 'Erro ao atualizar centro de custo' }
  revalidatePath('/sofia/custos')
  return { success: true }
}
```

- [ ] **Step 2: Page — tabela consolidada por veículo, mês corrente**

`app/(operacoes)/sofia/custos/_form.tsx` (client component, embedded per-row in the server table below — `atualizarCentroCustoAction` needs `useActionState`, which requires `'use client'`):
```tsx
'use client'
import { useActionState } from 'react'
import { atualizarCentroCustoAction } from './_actions'

export default function CentroCustoForm({ veiculoId, atual }: { veiculoId: string; atual: string }) {
  const [state, action, isPending] = useActionState(atualizarCentroCustoAction, {})
  const hoje = new Date().toISOString().split('T')[0]

  return (
    <details>
      <summary className="text-xs text-[#f05a28] cursor-pointer hover:underline">Atualizar centro de custo</summary>
      <form action={action} className="flex flex-col gap-2 mt-2 p-3 rounded-lg border border-[#1e3a5f] bg-[#0a1628] text-left w-56">
        <input type="hidden" name="veiculo_id" value={veiculoId} />
        {state.error && <p className="text-red-300 text-xs">{state.error}</p>}
        {state.success && <p className="text-green-300 text-xs">Atualizado!</p>}
        <input
          name="centro_custo"
          defaultValue={atual}
          placeholder="Novo centro de custo"
          className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs"
        />
        <input
          name="vigente_desde"
          type="date"
          defaultValue={hoje}
          className="px-2 py-1.5 rounded bg-[#0f1f3d] border border-[#1e3a5f] text-white text-xs [color-scheme:dark]"
        />
        <button type="submit" disabled={isPending} className="py-1.5 rounded bg-[#f05a28] text-white text-xs font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
          {isPending ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </details>
  )
}
```

`app/(operacoes)/sofia/custos/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { getVeiculos, getCentroCustoHistorico } from '@/lib/sofia/queries'
import CentroCustoForm from './_form'

export default async function CustosPage() {
  const veiculos = await getVeiculos()
  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]

  const supabase = await createClient()

  const linhas = await Promise.all(
    veiculos.map(async (v) => {
      const [{ data: multas }, { data: sinistros }, { data: revisoes }, { data: abastecimentos }, centroCusto] = await Promise.all([
        supabase.from('multas').select('valor').eq('veiculo_id', v.id).gte('data', inicioMes),
        supabase.from('sinistros').select('valor_dano').eq('veiculo_id', v.id).gte('data', inicioMes),
        supabase.from('revisoes').select('valor').eq('veiculo_id', v.id).gte('data_realizada', inicioMes),
        supabase.from('abastecimentos').select('valor').eq('veiculo_id', v.id).gte('data', inicioMes),
        getCentroCustoHistorico(v.id),
      ])

      const somaMultas = (multas ?? []).reduce((s, m) => s + Number(m.valor ?? 0), 0)
      const somaSinistros = (sinistros ?? []).reduce((s, x) => s + Number(x.valor_dano ?? 0), 0)
      const somaRevisoes = (revisoes ?? []).reduce((s, r) => s + Number(r.valor ?? 0), 0)
      const somaAbastecimento = (abastecimentos ?? []).reduce((s, a) => s + Number(a.valor ?? 0), 0)
      const locacao = v.valor_locacao_mensal ?? 0
      const total = locacao + somaRevisoes + somaMultas + somaSinistros + somaAbastecimento

      return {
        veiculo: v,
        centroCusto: centroCusto[0]?.centro_custo ?? '',
        locacao,
        manutencao: somaRevisoes,
        multas: somaMultas,
        sinistros: somaSinistros,
        abastecimento: somaAbastecimento,
        total,
      }
    })
  )

  const totalGeral = linhas.reduce(
    (acc, l) => ({
      locacao: acc.locacao + l.locacao,
      manutencao: acc.manutencao + l.manutencao,
      multas: acc.multas + l.multas,
      sinistros: acc.sinistros + l.sinistros,
      abastecimento: acc.abastecimento + l.abastecimento,
      total: acc.total + l.total,
    }),
    { locacao: 0, manutencao: 0, multas: 0, sinistros: 0, abastecimento: 0, total: 0 }
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Custos</h1>
        <p className="text-[#4a6080] text-sm mt-1">
          Consolidado do mês — {hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="rounded-xl border border-[#1e3a5f] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Placa</th>
              <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Centro de custo</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Locação</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Manutenção</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Multas</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Sinistros</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Abastecimento</th>
              <th className="text-right px-4 py-3 text-[#4a6080] font-medium">Total</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.veiculo.id} className="border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors">
                <td className="px-4 py-3 text-white font-medium font-mono">{l.veiculo.placa}</td>
                <td className="px-4 py-3 text-[#94a3b8]">{l.centroCusto || '—'}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.locacao.toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.manutencao.toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.multas.toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.sinistros.toFixed(2)}</td>
                <td className="px-4 py-3 text-[#94a3b8] text-right">R$ {l.abastecimento.toFixed(2)}</td>
                <td className="px-4 py-3 text-white text-right font-medium">R$ {l.total.toFixed(2)}</td>
                <td className="px-4 py-3 text-right">
                  <CentroCustoForm veiculoId={l.veiculo.id} atual={l.centroCusto} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-[#0d2050] font-medium">
              <td className="px-4 py-3 text-white" colSpan={2}>Total geral</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.locacao.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.manutencao.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.multas.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.sinistros.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.abastecimento.toFixed(2)}</td>
              <td className="px-4 py-3 text-white text-right">R$ {totalGeral.total.toFixed(2)}</td>
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run nav integrity test, then commit**

```bash
git add app/\(operacoes\)/sofia/custos/
git commit -m "feat(sofia): add custos module with monthly cost rollup and centro de custo history"
```

---

### Task 14: Disponibilidade da Frota (novo módulo)

**Files:** Create `app/(operacoes)/sofia/disponibilidade/page.tsx`

- [ ] **Step 1: Painel de disponibilidade**

`app/(operacoes)/sofia/disponibilidade/page.tsx` — server component usando `getVeiculos()`. Calcula `disponiveis = veiculos.filter(v => v.status === 'ativo')`, `parados = veiculos.filter(v => v.status !== 'ativo')`. Renderiza:
- Card grande com percentual (`disponiveis.length / veiculos.length`)
- Lista de `parados` com motivo (`status === 'manutencao' ? 'Em manutenção' : 'Inativo'`)

```tsx
import { getVeiculos } from '@/lib/sofia/queries'

export default async function DisponibilidadePage() {
  const veiculos = await getVeiculos()
  const disponiveis = veiculos.filter(v => v.status === 'ativo')
  const parados = veiculos.filter(v => v.status !== 'ativo')
  const pct = veiculos.length ? Math.round((disponiveis.length / veiculos.length) * 100) : 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Disponibilidade da Frota</h1>
        <p className="text-[#4a6080] text-sm mt-1">{disponiveis.length} de {veiculos.length} veículos disponíveis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="rounded-xl border border-[#1e3a5f] bg-[#0d2050] p-8 flex flex-col items-center justify-center">
          <p className="text-5xl font-bold text-[#f05a28]">{pct}%</p>
          <p className="text-[#4a6080] text-sm mt-2">disponibilidade</p>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Veículos parados</h2>
          {parados.length === 0 ? (
            <p className="text-[#4a6080] text-sm">Nenhum veículo parado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {parados.map(v => (
                <div key={v.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-[#1e3a5f] bg-[#0d2050]">
                  <span className="text-white text-sm font-mono">{v.placa}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-900 text-amber-300">
                    {v.status === 'manutencao' ? 'Em manutenção' : 'Inativo'}
                  </span>
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

- [ ] **Step 2: Run nav integrity test, then commit**

```bash
git add app/\(operacoes\)/sofia/disponibilidade/
git commit -m "feat(sofia): add disponibilidade da frota panel"
```

---

### Task 15: Pendências & Plano de Ação (novo módulo)

**Files:**
- Create: `app/(operacoes)/sofia/pendencias/page.tsx`
- Create: `app/(operacoes)/sofia/pendencias/_actions.ts`
- Create: `app/(operacoes)/sofia/pendencias/_form.tsx`
- Create: `lib/sofia/pendencias.ts`

- [ ] **Step 1: Pure aggregation logic (TDD)**

Write the failing test first — `lib/sofia/__tests__/pendencias.test.ts`:
```typescript
import { mapAutomaticPendencias } from '../pendencias'

describe('mapAutomaticPendencias', () => {
  it('flags a multa pendente without signed authorization', () => {
    const result = mapAutomaticPendencias({
      multas: [{ id: '1', status: 'pendente', autorizacao_assinada: false, data: '2026-06-01', descricao: 'Excesso de velocidade' }],
      sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [],
    })
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ origem: 'multa', descricao: expect.stringContaining('Excesso de velocidade') })
  })

  it('returns nothing when there is nothing pending', () => {
    const result = mapAutomaticPendencias({
      multas: [], sinistros: [], revisoesAtrasadas: [], documentosVencendo: [], termosNaoAssinados: [],
    })
    expect(result).toEqual([])
  })
})
```

Run: `npm test -- pendencias.test.ts` — expect FAIL (`mapAutomaticPendencias` not defined / module not found).

- [ ] **Step 2: Implement the pure function**

`lib/sofia/pendencias.ts`:
```typescript
interface AutomaticInputs {
  multas: { id: string; status: string; autorizacao_assinada: boolean; data: string; descricao: string }[]
  sinistros: { id: string; status: string; data: string; descricao: string }[]
  revisoesAtrasadas: { id: string; proxima_data: string | null }[]
  documentosVencendo: { id: string; tipo: string; vencimento: string }[]
  termosNaoAssinados: { id: string; nome: string }[]
}

export interface PendenciaAutomatica {
  descricao: string
  origem: 'multa' | 'sinistro' | 'manutencao' | 'documento' | 'termo'
  prazo: string | null
}

export function mapAutomaticPendencias(inputs: AutomaticInputs): PendenciaAutomatica[] {
  const result: PendenciaAutomatica[] = []

  for (const m of inputs.multas) {
    if (m.status !== 'descontada' && !m.autorizacao_assinada) {
      result.push({ descricao: `Multa sem tratativa: ${m.descricao}`, origem: 'multa', prazo: m.data })
    }
  }
  for (const s of inputs.sinistros) {
    if (s.status !== 'encerrado') {
      result.push({ descricao: `Sinistro sem encerramento: ${s.descricao}`, origem: 'sinistro', prazo: s.data })
    }
  }
  for (const r of inputs.revisoesAtrasadas) {
    result.push({ descricao: 'Manutenção atrasada', origem: 'manutencao', prazo: r.proxima_data })
  }
  for (const d of inputs.documentosVencendo) {
    result.push({ descricao: `Documento (${d.tipo}) vencendo`, origem: 'documento', prazo: d.vencimento })
  }
  for (const t of inputs.termosNaoAssinados) {
    result.push({ descricao: `Termo de uso não assinado: ${t.nome}`, origem: 'termo', prazo: null })
  }

  return result
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npm test -- pendencias.test.ts`
Expected: PASS

- [ ] **Step 4: Server Action for manual items**

`app/(operacoes)/sofia/pendencias/_actions.ts`:
```typescript
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type State = { error?: string; success?: boolean }

export async function criarPendenciaAction(_prev: State, formData: FormData): Promise<State> {
  const descricao = (formData.get('descricao') as string).trim()
  const responsavel = (formData.get('responsavel') as string).trim() || null
  const prazo = (formData.get('prazo') as string) || null
  const proxima_acao = (formData.get('proxima_acao') as string).trim() || null

  if (!descricao) return { error: 'Descrição é obrigatória' }

  const supabase = await createClient()
  const { error } = await supabase.from('pendencias').insert({ descricao, responsavel, prazo, proxima_acao, origem: 'manual' })

  if (error) return { error: 'Erro ao criar pendência' }
  revalidatePath('/sofia/pendencias')
  return { success: true }
}

export async function atualizarStatusPendenciaAction(id: string, status: string) {
  const supabase = await createClient()
  await supabase.from('pendencias').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/sofia/pendencias')
}
```

- [ ] **Step 5: Page wiring automatic + manual pendências**

`app/(operacoes)/sofia/pendencias/_form.tsx` (same inline-success pattern as `km/_form.tsx` — stays on the page, no redirect):
```tsx
'use client'
import { useActionState } from 'react'
import { criarPendenciaAction } from './_actions'

export default function PendenciaForm() {
  const [state, action, isPending] = useActionState(criarPendenciaAction, {})

  return (
    <form action={action} className="flex flex-col gap-3 p-4 rounded-xl border border-[#1e3a5f] bg-[#0d2050]">
      {state.error && (
        <div className="px-3 py-2 rounded-lg border border-red-600 bg-red-950 text-red-300 text-xs">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="px-3 py-2 rounded-lg border border-green-600 bg-green-950 text-green-300 text-xs">
          Pendência adicionada!
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Descrição *</label>
        <textarea name="descricao" required rows={2} className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm resize-none focus:outline-none focus:border-[#f05a28]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Responsável</label>
        <input name="responsavel" className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Prazo</label>
        <input name="prazo" type="date" className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28] [color-scheme:dark]" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[#94a3b8]">Próxima ação</label>
        <input name="proxima_acao" className="px-3 py-2 rounded-lg bg-[#0f1f3d] border border-[#1e3a5f] text-white text-sm focus:outline-none focus:border-[#f05a28]" />
      </div>

      <button type="submit" disabled={isPending} className="py-2.5 rounded-lg bg-[#f05a28] text-white text-sm font-medium hover:bg-[#d94e22] disabled:opacity-50 transition-colors">
        {isPending ? 'Salvando...' : '+ Adicionar item'}
      </button>
    </form>
  )
}
```

`app/(operacoes)/sofia/pendencias/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import {
  getMultasPendentes,
  getSinistrosAbertos,
  getRevisoesAtrasadas,
  getDocumentosVencendo,
  getMotoristas,
  getPendenciasManuais,
} from '@/lib/sofia/queries'
import { mapAutomaticPendencias } from '@/lib/sofia/pendencias'
import { atualizarStatusPendenciaAction } from './_actions'
import PendenciaForm from './_form'

const statusStyle: Record<string, string> = {
  aberta: 'bg-red-900 text-red-300',
  em_andamento: 'bg-amber-900 text-amber-300',
  concluida: 'bg-green-900 text-green-300',
}

const statusLabel: Record<string, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
}

const proximoStatus: Record<string, string> = {
  aberta: 'em_andamento',
  em_andamento: 'concluida',
}

const origemLabel: Record<string, string> = {
  manual: 'Manual',
  multa: 'Multa',
  sinistro: 'Sinistro',
  manutencao: 'Manutenção',
  documento: 'Documento',
  termo: 'Termo de uso',
}

export default async function PendenciasPage() {
  const supabase = await createClient()

  const [multas, sinistros, revisoesAtrasadas, documentosVencendo, motoristas, manuais, { data: termosAssinados }] =
    await Promise.all([
      getMultasPendentes(),
      getSinistrosAbertos(),
      getRevisoesAtrasadas(),
      getDocumentosVencendo(),
      getMotoristas(),
      getPendenciasManuais(),
      supabase.from('motorista_documentos').select('motorista_id').eq('tipo', 'termo_uso').eq('assinado', true),
    ])

  const idsComTermo = new Set((termosAssinados ?? []).map((t) => t.motorista_id))
  const termosNaoAssinados = motoristas.filter((m) => m.ativo && !idsComTermo.has(m.id))

  const automaticas = mapAutomaticPendencias({
    multas: multas.map((m) => ({ id: m.id, status: m.status, autorizacao_assinada: m.autorizacao_assinada, data: m.data, descricao: m.descricao })),
    sinistros: sinistros.map((s) => ({ id: s.id, status: s.status, data: s.data, descricao: s.descricao })),
    revisoesAtrasadas: revisoesAtrasadas.map((r) => ({ id: r.id, proxima_data: r.proxima_data })),
    documentosVencendo: documentosVencendo.map((d) => ({ id: d.id, tipo: d.tipo, vencimento: d.vencimento })),
    termosNaoAssinados: termosNaoAssinados.map((m) => ({ id: m.id, nome: m.nome })),
  })

  type Linha = { id: string | null; descricao: string; origem: string; responsavel: string | null; prazo: string | null; proxima_acao: string | null; status: string }

  const todas: Linha[] = [
    ...automaticas.map((a): Linha => ({ id: null, descricao: a.descricao, origem: a.origem, responsavel: null, prazo: a.prazo, proxima_acao: null, status: 'aberta' })),
    ...manuais.map((p): Linha => ({ id: p.id, descricao: p.descricao, origem: p.origem, responsavel: p.responsavel, prazo: p.prazo, proxima_acao: p.proxima_acao, status: p.status })),
  ].sort((a, b) => {
    if (!a.prazo) return 1
    if (!b.prazo) return -1
    return a.prazo.localeCompare(b.prazo)
  })

  const hoje = new Date().toISOString().split('T')[0]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Pendências & Plano de Ação</h1>
          <p className="text-[#4a6080] text-sm mt-1">{todas.length} pendência{todas.length !== 1 ? 's' : ''} no total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-xl border border-[#1e3a5f] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a5f] bg-[#0d2050]">
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Descrição</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Origem</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Responsável</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Prazo</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Próxima ação</th>
                <th className="text-left px-4 py-3 text-[#4a6080] font-medium">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {todas.map((p, i) => {
                const atrasada = !!p.prazo && p.prazo < hoje && p.status !== 'concluida'
                return (
                  <tr key={p.id ?? `auto-${i}`} className={`border-b border-[#1e3a5f] hover:bg-[#0d2050] transition-colors ${atrasada ? 'bg-red-950/40' : ''}`}>
                    <td className="px-4 py-3 text-white">{p.descricao}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{origemLabel[p.origem]}</td>
                    <td className="px-4 py-3 text-[#94a3b8]">{p.responsavel ?? '—'}</td>
                    <td className={`px-4 py-3 ${atrasada ? 'text-red-300' : 'text-[#94a3b8]'}`}>
                      {p.prazo ? new Date(p.prazo).toLocaleDateString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#94a3b8]">{p.proxima_acao ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle[p.status]}`}>
                        {statusLabel[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.id && proximoStatus[p.status] && (
                        <form action={atualizarStatusPendenciaAction.bind(null, p.id, proximoStatus[p.status])}>
                          <button type="submit" className="text-xs text-[#4a6080] hover:text-[#94a3b8] transition-colors">
                            → {statusLabel[proximoStatus[p.status]]}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                )
              })}
              {todas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#4a6080]">
                    Nenhuma pendência registrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#4a6080] uppercase tracking-wider mb-3">Adicionar item manual</h2>
          <PendenciaForm />
        </div>
      </div>
    </div>
  )
}
```

Automatic pendências (sem `id`) não recebem o botão de avançar status — elas são derivadas de outro módulo (multa, sinistro, manutenção, documento, termo) e se resolvem agindo na origem (ex: marcar a multa como descontada), não nesta tela.

- [ ] **Step 6: Run nav integrity test, then commit**

```bash
git add app/\(operacoes\)/sofia/pendencias/ lib/sofia/pendencias.ts lib/sofia/__tests__/pendencias.test.ts
git commit -m "feat(sofia): add pendencias & plano de acao module with automatic aggregation"
```

---

### Task 16: Auditoria final de navegação + QA manual

**Files:** None created — verification only.

- [ ] **Step 1: Run the full nav integrity test suite**

Run: `npm test -- Sidebar.test.ts`
Expected: PASS — every nav item and every detail route resolves to a real `page.tsx`. If anything fails here, it means a task above was skipped or a route was renamed inconsistently — fix before proceeding, this is the non-negotiable check João asked for.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all suites pass (auth domain tests, Sidebar integrity test, pendencias logic test).

- [ ] **Step 3: Manual click-through (start dev server, click every link by hand)**

Run: `npm run dev`, then as a logged-in user click, in order: Dashboard → every sidebar item in all 4 groups → on Veículos, open one row → on Motoristas, open one row → on Sinistros, open one row (the `/sofia/sinistros/[id]` tratativa page) → on Dashboard, click every quick-action tile. Confirm each one renders the right screen with no console error and no 404.

- [ ] **Step 4: Type check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix(sofia): resolve navigation gaps found in final audit"
```
