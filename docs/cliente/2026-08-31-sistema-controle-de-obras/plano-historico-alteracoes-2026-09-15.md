# Histórico de alterações da obra (Parte 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir, isoladamente do trabalho paralelo da J4, as quatro peças que tornam
o histórico de alteração da obra (seção D do mockup, aprovada) implementável depois: a
migration, a função pura de diff, a função de gravação atômica e o componente de
exibição — sem tocar `_actions.ts`, `_ficha.tsx` ou `_triagem.tsx`.

**Architecture:** Nova tabela `obras_historico` (append-only, RLS trava o autor no e-mail
autenticado). Uma RPC `security invoker` (`obras_aplicar_alteracao`) faz `update` da obra
e `insert` do histórico na mesma transação — nenhuma trigger, nenhuma lógica de negócio
em PL/pgSQL. O diff (o que mudou, com que rótulo) é uma função TypeScript pura e testada
em `app/obras/_lib/historico.ts`, chamada por quem grava (Parte 2, futura). O componente
`_historico.tsx` só renderiza linhas já buscadas — não faz sua própria query.

**Tech Stack:** Next.js (Server/Client Components), Supabase (Postgres 17, RLS, RPC
`plpgsql`), Jest + ts-jest, React Testing Library, Tailwind (classes hex literais do
módulo, sem `tailwind.config`).

**Spec:** `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-historico-alteracoes-2026-09-15.md`
— este plano implementa as seções 2, 3, 5, 6, 9 e 10 dela (Parte 1). As seções 4, 7, 8, 12
e 13 são contexto de decisão que os testes abaixo verificam na prática.

## Global Constraints

- `null` é o único sentinela de vazio nas colunas de `obras_obra`/`obras_historico`;
  nunca gravar `""` (convenção do módulo, `_actions.ts:27-31`).
- Nenhum arquivo criado ou editado nesta Parte 1 importa, é importado por, ou de outra
  forma referencia `app/obras/obra/[id]/_actions.ts`, `_ficha.tsx` ou `_triagem.tsx` —
  esses três estão sendo reescritos em paralelo pela J4.
- `quem` em `obras_historico` é sempre o e-mail autenticado, minúsculo e sem espaço
  (`lower(trim(auth.jwt() ->> 'email'))`), nunca um valor vindo do cliente/formulário —
  travado em dois lugares independentes: a RLS (`with check`) e a RPC (lê o JWT direto,
  ignora qualquer `quem` em `p_linhas`).
- `obras_historico` não tem policy de `update` nem `delete` — é imutável por construção
  do banco, não por convenção de tela.
- A migration segue o padrão de `sdd-sql-obras-v0.sql`: idempotente (`if not exists` /
  `create or replace`), dentro de `begin`/`commit`, cabeçalho documentando estado e
  citando as duas armadilhas de PL/pgSQL do `AGENTS.md` quando alguma função nova é
  criada.
- Testes de função pura (`historico.test.ts`) não mocam Supabase — mesmo padrão de
  `app/obras/__tests__/tipos.test.ts`. Testes de `gravarComHistorico` mocam só `.rpc(...)`,
  padrão de `app/obras/sincronizar/__tests__/_execucao.test.ts:7-25`.
- `npm test`, `npm run lint` e `npm run build` continuam passando depois de cada tarefa.

---

### Task 1: Migration `sdd-sql-obras-historico.sql`

**Files:**
- Create: `sdd-sql-obras-historico.sql` (raiz do repositório)

**Interfaces:**
- Consumes: `public.obras_has_access()` e `public.obras_is_admin()`, já criadas em
  `sdd-sql-obras-v0.sql` (não recriar, não duplicar — só usar).
- Produces: tabela `public.obras_historico` (colunas: `id`, `obra_id`, `bloco`, `campo`,
  `de`, `para`, `motivo`, `quem`, `created_at`) e função
  `public.obras_aplicar_alteracao(p_obra_id uuid, p_campos jsonb, p_linhas jsonb) returns
  public.obras_obra`, que as Tasks seguintes (e a Parte 2, depois) chamam por
  `supabase.rpc('obras_aplicar_alteracao', {...})`.

Esta tarefa não é TDD no sentido de Jest (é SQL rodado à mão, como todas as migrations
deste módulo) — o "teste que falha primeiro" aqui é a query de verificação rodando ANTES
da migration (deve devolver 0 linhas / erro de tabela inexistente) e DEPOIS (deve
devolver o esperado). Documentar os dois resultados é o que substitui o ciclo
vermelho/verde de um teste automatizado.

- [ ] **Step 1: Escrever o SQL de verificação PRÉ-migration e confirmar que falha**

Antes de escrever a migration, rode isto no SQL Editor do Supabase (projeto
`iyytcavcgukfjnjjrerx`) para confirmar o estado atual (a tabela e a função não existem
ainda):

```sql
select table_name from information_schema.tables
 where table_schema = 'public' and table_name = 'obras_historico';

select routine_name from information_schema.routines
 where routine_schema = 'public' and routine_name = 'obras_aplicar_alteracao';
```

Esperado: as duas queries devolvem **0 linhas**. Se a primeira já devolver uma linha, pare
e confira se alguém já rodou uma versão anterior deste arquivo antes de continuar — não
sobrescreva sem saber o que já existe.

- [ ] **Step 2: Escrever a migration completa**

Arquivo `sdd-sql-obras-historico.sql`, seguindo à risca a estrutura de
`sdd-sql-obras-v0.sql` (cabeçalho com estado, `begin`, seções numeradas, `commit`, seção
final "depois de rodar"). Conteúdo (adaptar comentários de cabeçalho ao padrão do
arquivo-irmão, mas manter estas peças):

```sql
-- ============================================================
-- Controle de Obras — histórico de alterações (J4, seção D) — 2026-09-15
-- Migration da spec-historico-alteracoes-2026-09-15.md
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar (AGENTS.md).
--
-- IDEMPOTENTE por construção: create table if not exists, create or replace
-- function, drop policy if exists antes de recriar.
--
-- Esta migration NÃO cria nenhuma trigger — ver spec §5 para por quê. A única
-- função nova, obras_aplicar_alteracao, roda "security invoker" (não
-- definer): ela herda a RLS de obras_obra e obras_historico, não eleva
-- privilégio. As duas armadilhas de PL/pgSQL do AGENTS.md não se aplicam
-- aqui: (1) não há guarda de autorização que possa devolver NULL —
-- obras_has_access() já é exists()-based, e o e-mail nulo é checado à parte;
-- (2) não há trigger compartilhada entre tabelas.
-- ============================================================

begin;

-- ============================================================
-- 1. TABELA
-- ============================================================
create table if not exists public.obras_historico (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  bloco text not null,
  campo text not null,
  de text,
  para text,
  motivo text,
  quem text not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.obras_historico'::regclass
      and conname = 'obras_historico_bloco_check'
  ) then
    alter table public.obras_historico
      add constraint obras_historico_bloco_check
      check (bloco in ('Triagem','Autorização','Identificação','Cronograma','Esteira'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.obras_historico'::regclass
      and conname = 'obras_historico_campo_check'
  ) then
    alter table public.obras_historico
      add constraint obras_historico_campo_check
      check (campo in (
        'pcm','equipe','prioridade','inicio_plan','duracao',
        'liberado_por','liberado_em','os_aprovada_em',
        'tipo','valor','origem','analista_cliente','mau_uso',
        'etapa','marco_exec_fim','marco_fechou_os',
        'marco_liberou_fat','marco_faturou'
      ));
  end if;
end
$$;

create index if not exists obras_historico_obra_idx
  on public.obras_historico (obra_id, created_at desc);

-- ============================================================
-- 2. RLS
-- ============================================================
alter table public.obras_historico enable row level security;

drop policy if exists "obras historico leitura" on public.obras_historico;
create policy "obras historico leitura" on public.obras_historico
  for select to authenticated
  using (public.obras_has_access());

drop policy if exists "obras historico escrita" on public.obras_historico;
create policy "obras historico escrita" on public.obras_historico
  for insert to authenticated
  with check (
    public.obras_has_access()
    and quem = lower(trim(auth.jwt() ->> 'email'))
  );

-- Sem policy de update nem delete, de propósito: histórico é apend-only.

-- ============================================================
-- 3. RPC — update de obras_obra + insert de obras_historico, atômico
-- ============================================================
create or replace function public.obras_aplicar_alteracao(
  p_obra_id uuid,
  p_campos jsonb,
  p_linhas jsonb
)
returns public.obras_obra
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_quem   text := lower(trim(auth.jwt() ->> 'email'));
  v_quando timestamptz := clock_timestamp();
  v_obra   public.obras_obra;
begin
  if not public.obras_has_access() then
    raise exception 'Sem acesso ao Controle de Obras' using errcode = '42501';
  end if;
  if v_quem is null or v_quem = '' then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  update public.obras_obra o set (
    pcm, equipe, prioridade, inicio_plan, duracao,
    liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
    tipo, valor, origem, analista_cliente, mau_uso,
    etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
    marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou
  ) = (
    select
      pcm, equipe, prioridade, inicio_plan, duracao,
      liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
      tipo, valor, origem, analista_cliente, mau_uso,
      etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
      marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou
    from jsonb_populate_record(o, coalesce(p_campos, '{}'::jsonb))
  )
  where o.id = p_obra_id
  returning * into v_obra;

  if not found then
    raise exception 'Obra não encontrada ou sem permissão' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_linhas, '[]'::jsonb)) > 0 then
    insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
    select p_obra_id, x.bloco, x.campo, x.de, x.para, x.motivo, v_quem, v_quando
    from jsonb_to_recordset(p_linhas) as x(bloco text, campo text, de text, para text, motivo text);
  end if;

  return v_obra;
end;
$$;

revoke execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) to authenticated;

commit;

-- ============================================================
-- 4. DEPOIS DE RODAR — SQL de verificação (padrão RUNBOOK-ir-ao-ar.md)
-- ============================================================
-- (a) tabela, índice e as 2 policies existem:
--
-- select table_name from information_schema.tables
--  where table_schema = 'public' and table_name = 'obras_historico';
-- select policyname from pg_policies
--  where schemaname = 'public' and tablename = 'obras_historico';
--   -- espera 2 linhas: "obras historico leitura", "obras historico escrita"
--
-- (b) a função existe e está travada de public/anon:
--
-- select routine_name from information_schema.routines
--  where routine_schema = 'public' and routine_name = 'obras_aplicar_alteracao';
-- select grantee, privilege_type from information_schema.role_routine_grants
--  where routine_name = 'obras_aplicar_alteracao';
--   -- espera só "authenticated" com EXECUTE
--
-- (c) ponta a ponta, rodando COMO POSTGRES (SQL Editor/MCP): confirma que
-- SEM JWT a função recusa por "Não autenticado" (v_quem nulo), não por erro
-- de sintaxe — prova que a guarda funciona:
--
-- select public.obras_aplicar_alteracao(
--   (select id from public.obras_obra limit 1),
--   '{}'::jsonb, '[]'::jsonb
-- );
--   -- espera erro 28000 "Não autenticado" (rodando sem JWT, auth.jwt() é null)
-- ============================================================
```

- [ ] **Step 3: Rodar a migration no SQL Editor do Supabase (projeto `iyytcavcgukfjnjjrerx`)**

Confirmar o ref na URL do dashboard antes de colar, como o `AGENTS.md` manda.

- [ ] **Step 4: Rodar o SQL de verificação (seção 4 do arquivo) e confirmar os três resultados**

(a) 1 tabela + 2 policies; (b) 1 função, 1 grant só para `authenticated`; (c) o erro
`28000` acontece rodando sem JWT — é a prova de que a guarda "não autenticado" funciona
de verdade, não só na leitura do código.

- [ ] **Step 5: Atualizar o cabeçalho do arquivo com "ESTADO: APLICADO em [data], por [quem/como]" e os resultados da verificação, e commitar**

```bash
git add sdd-sql-obras-historico.sql
git commit -m "feat(obras): migration da tabela obras_historico e da RPC obras_aplicar_alteracao"
```

---

### Task 2: Tipos e dicionário de rótulos — `app/obras/_lib/historico.ts` (parte 1/2)

**Files:**
- Create: `app/obras/_lib/historico.ts`
- Create: `app/obras/__tests__/historico.test.ts`

**Interfaces:**
- Consumes: `br`, `moeda`, `nomeEtapa` de `app/obras/_lib/tipos.ts` (reaproveitar
  formatação existente, não duplicar).
- Produces: `BlocoHistorico`, `CampoHistorico`, `LinhaHistoricoNova`, `LinhaHistorico`,
  `ROTULO_CAMPO` (dicionário `Record<CampoHistorico, string>`) — usados pela Task 3
  (`linhasDeAlteracao`) e pela Task 5 (`_historico.tsx`).

- [ ] **Step 1: Escrever o teste do dicionário de rótulos (falha primeiro)**

```ts
// app/obras/__tests__/historico.test.ts (início do arquivo — as próximas tasks acrescentam mais describe())
import { ROTULO_CAMPO, type CampoHistorico } from '../_lib/historico'

describe('ROTULO_CAMPO', () => {
  it('tem um rótulo para cada CampoHistorico, sem string vazia', () => {
    const campos: CampoHistorico[] = [
      'pcm', 'equipe', 'prioridade', 'inicio_plan', 'duracao',
      'liberado_por', 'liberado_em', 'os_aprovada_em',
      'tipo', 'valor', 'origem', 'analista_cliente', 'mau_uso',
      'etapa',
      'marco_exec_fim', 'marco_relatorio', 'marco_fechou_os',
      'marco_liberou_fat', 'marco_faturou',
    ]
    for (const c of campos) {
      expect(ROTULO_CAMPO[c]).toBeTruthy()
    }
  })

  it('usa os rótulos exatos da spec (amostra)', () => {
    expect(ROTULO_CAMPO.pcm).toBe('Responsável da obra')
    expect(ROTULO_CAMPO.liberado_por).toBe('Liberado por')
    expect(ROTULO_CAMPO.os_aprovada_em).toBe('OS aprovada em')
    expect(ROTULO_CAMPO.etapa).toBe('Etapa')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha (módulo não existe ainda)**

Run: `npm test -- historico.test.ts`
Expected: FAIL — `Cannot find module '../_lib/historico'`

- [ ] **Step 3: Criar `app/obras/_lib/historico.ts` com os tipos e o dicionário**

```ts
/**
 * Histórico de alterações da obra — J4, seção D do mockup (aprovada).
 * Ver docs/cliente/2026-08-31-sistema-controle-de-obras/spec-historico-alteracoes-2026-09-15.md
 *
 * Convenção deste arquivo: `campo` grava uma CHAVE ESTÁVEL (nunca o texto de
 * tela) — o rótulo se traduz na leitura, via ROTULO_CAMPO, do mesmo jeito que
 * `nomeEtapa()` traduz `etapa` em tipos.ts. Se o rótulo mudar (ex.: a decisão
 * 8 ainda pendente do cliente sobre o nome de marco_liberou_fat), as linhas
 * já gravadas continuam corretas sem backfill.
 */

import { br, moeda, nomeEtapa, type Etapa } from './tipos'

export type BlocoHistorico =
  | 'Triagem'
  | 'Autorização'
  | 'Identificação'
  | 'Cronograma'
  | 'Esteira'

export type CampoHistorico =
  | 'pcm'
  | 'equipe'
  | 'prioridade'
  | 'inicio_plan'
  | 'duracao'
  | 'liberado_por'
  | 'liberado_em'
  | 'os_aprovada_em'
  | 'tipo'
  | 'valor'
  | 'origem'
  | 'analista_cliente'
  | 'mau_uso'
  | 'etapa'
  | 'marco_exec_fim'
  | 'marco_relatorio'
  | 'marco_fechou_os'
  | 'marco_liberou_fat'
  | 'marco_faturou'

/** Rótulo de tela para cada campo rastreado. Ver spec §7. */
export const ROTULO_CAMPO: Record<CampoHistorico, string> = {
  pcm: 'Responsável da obra',
  equipe: 'Equipe / prestador',
  prioridade: 'Prioridade',
  inicio_plan: 'Início planejado',
  duracao: 'Duração em dias',
  liberado_por: 'Liberado por',
  liberado_em: 'Data da liberação',
  os_aprovada_em: 'OS aprovada em',
  tipo: 'Tipo',
  valor: 'Valor',
  origem: 'Origem',
  analista_cliente: 'Analista do cliente',
  mau_uso: 'Classificação',
  etapa: 'Etapa',
  marco_exec_fim: 'Data de fim da execução em campo',
  marco_relatorio: 'Data do relatório de entrega',
  marco_fechou_os: 'Data de fechamento da OS',
  marco_liberou_fat: 'Data do faturamento liberado',
  marco_faturou: 'Data de faturamento',
}

/** Uma linha ainda não gravada — o formato que a RPC espera em `p_linhas`. */
export type LinhaHistoricoNova = {
  bloco: BlocoHistorico
  campo: CampoHistorico
  de: string | null
  para: string | null
  motivo?: string | null
}

/** Uma linha já gravada, lida de volta do banco. */
export type LinhaHistorico = LinhaHistoricoNova & {
  id: string
  obra_id: string
  quem: string
  created_at: string
}
```

- [ ] **Step 4: Rodar e confirmar que os testes do Step 1 passam**

Run: `npm test -- historico.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Commit**

```bash
git add app/obras/_lib/historico.ts app/obras/__tests__/historico.test.ts
git commit -m "feat(obras): tipos e dicionário de rótulos do histórico de alterações"
```

---

### Task 3: `linhasDeAlteracao` — a função pura de diff

**Files:**
- Modify: `app/obras/_lib/historico.ts`
- Modify: `app/obras/__tests__/historico.test.ts`

**Interfaces:**
- Consumes: `BlocoHistorico`, `CampoHistorico`, `LinhaHistoricoNova`, `ROTULO_CAMPO`,
  `br`, `moeda`, `nomeEtapa` (Task 2).
- Produces: `linhasDeAlteracao(antes, depois, bloco, opts?)` — consumida pela Parte 2
  (fora deste plano) e testada exaustivamente aqui.

`antes`/`depois` recebem os campos já no "valor de domínio" (`os_aprovada_em` é uma
string de data ou `null`, não as 3 colunas cruas — quem chama resolve isso antes; ver
spec §8). Tipo de entrada: `Partial<Record<CampoHistorico, string | number | boolean |
null>>`.

- [ ] **Step 1: Teste — nenhuma mudança devolve array vazio**

```ts
import { linhasDeAlteracao } from '../_lib/historico'

describe('linhasDeAlteracao', () => {
  it('sem mudanças, devolve array vazio', () => {
    const r = linhasDeAlteracao({ pcm: 'YURI' }, { pcm: 'YURI' }, 'Cronograma')
    expect(r).toEqual([])
  })
})
```

Run: `npm test -- historico.test.ts` → FAIL (`linhasDeAlteracao` não existe).

- [ ] **Step 2: Implementação mínima — função que sempre devolve `[]`**

```ts
export function linhasDeAlteracao(
  antes: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  depois: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  bloco: BlocoHistorico,
  opts?: { motivoRemarcacao?: string | null; exigirMotivoRemarcacao?: boolean }
): LinhaHistoricoNova[] {
  return []
}
```

Run: `npm test -- historico.test.ts` → PASS (1 teste, o resto ainda não escrito).

- [ ] **Step 3: Teste — um campo de texto simples mudou**

```ts
  it('um campo de texto mudou: uma linha, sem motivo', () => {
    const r = linhasDeAlteracao(
      { prioridade: 'Normal' },
      { prioridade: 'Urgente' },
      'Cronograma'
    )
    expect(r).toEqual([
      { bloco: 'Cronograma', campo: 'prioridade', de: 'Normal', para: 'Urgente', motivo: null },
    ])
  })

  it('campo ausente em depois não conta como mudança', () => {
    const r = linhasDeAlteracao({ pcm: 'YURI', equipe: 'MANFAC-7' }, { pcm: 'YURI' }, 'Cronograma')
    expect(r).toEqual([])
  })
```

Run: FAIL (função ainda devolve `[]` sempre).

- [ ] **Step 4: Implementação — diff genérico sobre texto, com formatação por campo**

```ts
const CAMPOS_DATA: ReadonlySet<CampoHistorico> = new Set([
  'inicio_plan', 'liberado_em', 'os_aprovada_em',
  'marco_exec_fim', 'marco_relatorio', 'marco_fechou_os',
  'marco_liberou_fat', 'marco_faturou',
])

function formatarValor(campo: CampoHistorico, v: string | number | boolean | null): string | null {
  if (v === null || v === undefined || v === '') return null
  if (campo === 'valor') return moeda(Number(v))
  if (campo === 'duracao') return `${v} dias`
  if (campo === 'mau_uso') return v ? 'Mau uso' : 'normal'
  if (campo === 'etapa') return nomeEtapa(v as Etapa)
  if (CAMPOS_DATA.has(campo)) return br(String(v))
  return String(v)
}

/** Compara valor "cru" (não formatado) para decidir se algo realmente mudou. */
function iguais(a: string | number | boolean | null | undefined, b: string | number | boolean | null | undefined): boolean {
  const na = a === undefined || a === '' ? null : a
  const nb = b === undefined || b === '' ? null : b
  if (na === null && nb === null) return true
  if (na === null || nb === null) return false
  // números: comparação numérica, evita ruído de string "100" vs 100 ou "100.0" vs "100"
  if (typeof na === 'number' || typeof nb === 'number') return Number(na) === Number(nb)
  return String(na) === String(nb)
}

export function linhasDeAlteracao(
  antes: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  depois: Partial<Record<CampoHistorico, string | number | boolean | null>>,
  bloco: BlocoHistorico,
  opts?: { motivoRemarcacao?: string | null; exigirMotivoRemarcacao?: boolean }
): LinhaHistoricoNova[] {
  const linhas: LinhaHistoricoNova[] = []

  for (const campo of Object.keys(depois) as CampoHistorico[]) {
    const antigo = antes[campo] ?? null
    const novo = depois[campo] ?? null
    if (iguais(antigo, novo)) continue

    if (campo === 'inicio_plan' && opts?.exigirMotivoRemarcacao) {
      const motivo = (opts.motivoRemarcacao ?? '').trim()
      if (!motivo) {
        throw new Error(
          'linhasDeAlteracao: início mudou com exigirMotivoRemarcacao=true e sem motivoRemarcacao — quem chamou esqueceu de validar antes.'
        )
      }
    }

    linhas.push({
      bloco,
      campo,
      de: formatarValor(campo, antigo),
      para: formatarValor(campo, novo),
      motivo: campo === 'inicio_plan' ? (opts?.motivoRemarcacao ?? null) : null,
    })
  }

  return linhas
}
```

- [ ] **Step 5: Rodar e confirmar que os 4 testes passam**

Run: `npm test -- historico.test.ts` → PASS

- [ ] **Step 6: Teste — vários campos do mesmo bloco, formatação de data/moeda/booleano/etapa**

```ts
  it('formata data, moeda, booleano e etapa', () => {
    const r = linhasDeAlteracao(
      { valor: 4380, mau_uso: false, etapa: 'levantamento' },
      { valor: 5200.5, mau_uso: true, etapa: 'andamento' },
      'Identificação'
    )
    expect(r).toContainEqual({ bloco: 'Identificação', campo: 'valor', de: 'R$ 4.380,00', para: 'R$ 5.200,50', motivo: null })
    expect(r).toContainEqual({ bloco: 'Identificação', campo: 'mau_uso', de: 'normal', para: 'Mau uso', motivo: null })
  })

  it('formata data em DD/MM/AAAA', () => {
    const r = linhasDeAlteracao({ liberado_em: null }, { liberado_em: '2026-09-10' }, 'Autorização')
    expect(r).toEqual([
      { bloco: 'Autorização', campo: 'liberado_em', de: null, para: '10/09/2026', motivo: null },
    ])
  })

  it('null vira null em de/para (o componente exibe "—")', () => {
    const r = linhasDeAlteracao({ liberado_por: 'JUAN' }, { liberado_por: null }, 'Autorização')
    expect(r).toEqual([
      { bloco: 'Autorização', campo: 'liberado_por', de: 'JUAN', para: null, motivo: null },
    ])
  })

  it('mesmo valor numérico em tipos diferentes (number vs string) não gera linha', () => {
    const r = linhasDeAlteracao({ duracao: 6 }, { duracao: '6' }, 'Cronograma')
    expect(r).toEqual([])
  })
```

Run: FAIL/PASS conforme o caso — confirme que `mau_uso`/`etapa`/`valor` passam com a
implementação do Step 4; se algum falhar, ajuste `formatarValor`/`iguais` até os 4 novos
testes (mais os anteriores) passarem juntos.

- [ ] **Step 7: Rodar a suíte inteira e confirmar verde**

Run: `npm test -- historico.test.ts` → PASS (8 testes até aqui)

- [ ] **Step 8: Teste — remarcação: motivo obrigatório quando exigido, opcional quando não**

```ts
  it('inicio_plan mudou com exigirMotivoRemarcacao=true e motivo preenchido: uma linha com motivo', () => {
    const r = linhasDeAlteracao(
      { inicio_plan: '2026-09-10' },
      { inicio_plan: '2026-09-16' },
      'Cronograma',
      { exigirMotivoRemarcacao: true, motivoRemarcacao: 'Loja pediu para adiar por causa da reforma do estacionamento' }
    )
    expect(r).toEqual([
      {
        bloco: 'Cronograma',
        campo: 'inicio_plan',
        de: '10/09/2026',
        para: '16/09/2026',
        motivo: 'Loja pediu para adiar por causa da reforma do estacionamento',
      },
    ])
  })

  it('inicio_plan mudou com exigirMotivoRemarcacao=true e SEM motivo: lança', () => {
    expect(() =>
      linhasDeAlteracao(
        { inicio_plan: '2026-09-10' },
        { inicio_plan: '2026-09-16' },
        'Cronograma',
        { exigirMotivoRemarcacao: true }
      )
    ).toThrow(/motivoRemarcacao/)
  })

  it('inicio_plan mudou SEM exigirMotivoRemarcacao (Triagem, obra ainda não liberada): sem motivo, sem erro', () => {
    const r = linhasDeAlteracao(
      { inicio_plan: null },
      { inicio_plan: '2026-09-16' },
      'Triagem'
    )
    expect(r).toEqual([
      { bloco: 'Triagem', campo: 'inicio_plan', de: null, para: '16/09/2026', motivo: null },
    ])
  })
```

Run: `npm test -- historico.test.ts` → PASS (11 testes)

- [ ] **Step 9: Teste — mudança de etapa + marco na mesma chamada (concluir etapa)**

```ts
  it('concluir etapa: etapa e o marco do passo mudam juntos, na mesma chamada', () => {
    const r = linhasDeAlteracao(
      { etapa: 'relatorio', marco_relatorio: null },
      { etapa: 'aprovarOS', marco_relatorio: '2026-08-21' },
      'Esteira'
    )
    expect(r).toHaveLength(2)
    expect(r).toContainEqual({ bloco: 'Esteira', campo: 'etapa', de: 'Relatório de entrega', para: 'Pendente fechamento', motivo: null })
    expect(r).toContainEqual({ bloco: 'Esteira', campo: 'marco_relatorio', de: null, para: '21/08/2026', motivo: null })
  })
```

Run: `npm test -- historico.test.ts` → PASS (12 testes). Se `nomeEtapa('relatorio')` ou
`nomeEtapa('aprovarOS')` não devolverem exatamente esses textos, ajuste o teste para o
texto real de `ETAPAS` em `tipos.ts` — não o dicionário deste arquivo.

- [ ] **Step 10: Commit**

```bash
git add app/obras/_lib/historico.ts app/obras/__tests__/historico.test.ts
git commit -m "feat(obras): linhasDeAlteracao — diff puro do histórico, com testes"
```

---

### Task 4: `gravarComHistorico` — a função que chama a RPC

**Files:**
- Modify: `app/obras/_lib/historico.ts`
- Modify: `app/obras/__tests__/historico.test.ts`

**Interfaces:**
- Consumes: `LinhaHistoricoNova` (Task 2), um `SupabaseClient` com `.rpc(...)` (mesma
  forma usada por `app/obras/sincronizar/_execucao.ts`).
- Produces: `gravarComHistorico(supabase, params)` — é o que a Parte 2 vai chamar em
  vez do `.update()` direto.

- [ ] **Step 1: Teste — chama a RPC com os parâmetros certos e devolve `{ data }` no sucesso**

```ts
describe('gravarComHistorico', () => {
  it('chama obras_aplicar_alteracao com obraId, campos e linhas, e devolve a obra atualizada', async () => {
    const obraAtualizada = { id: 'o1', pcm: 'YURI' }
    const rpc = jest.fn().mockResolvedValue({ data: obraAtualizada, error: null })
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    const linhas: LinhaHistoricoNova[] = [
      { bloco: 'Cronograma', campo: 'pcm', de: null, para: 'YURI', motivo: null },
    ]
    const r = await gravarComHistorico(supabase, {
      obraId: 'o1',
      campos: { pcm: 'YURI' },
      linhas,
    })

    expect(rpc).toHaveBeenCalledWith('obras_aplicar_alteracao', {
      p_obra_id: 'o1',
      p_campos: { pcm: 'YURI' },
      p_linhas: linhas,
    })
    expect(r).toEqual({ data: obraAtualizada })
  })

  it('sem linhas (nada rastreado mudou), ainda chama a RPC com p_linhas vazio — o update precisa acontecer', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: { id: 'o1' }, error: null })
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    await gravarComHistorico(supabase, { obraId: 'o1', campos: { bloqueio: 'Clima' }, linhas: [] })

    expect(rpc).toHaveBeenCalledWith('obras_aplicar_alteracao', {
      p_obra_id: 'o1',
      p_campos: { bloqueio: 'Clima' },
      p_linhas: [],
    })
  })

  it('erro da RPC vira { error } em português, nunca lança', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: 'Sem acesso ao Controle de Obras' } })
    const supabase = { rpc } as unknown as Parameters<typeof gravarComHistorico>[0]

    const r = await gravarComHistorico(supabase, { obraId: 'o1', campos: {}, linhas: [] })

    expect(r).toEqual({ error: 'Erro ao salvar a alteração da obra' })
  })
})
```

Run: `npm test -- historico.test.ts` → FAIL (`gravarComHistorico` não existe / import quebra).

- [ ] **Step 2: Implementar `gravarComHistorico`**

```ts
// no topo do arquivo, ao lado dos outros imports:
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ObraRow } from './tipos'

// ... (depois de linhasDeAlteracao)

export async function gravarComHistorico(
  supabase: SupabaseClient,
  params: { obraId: string; campos: Record<string, unknown>; linhas: LinhaHistoricoNova[] }
): Promise<{ data?: ObraRow; error?: string }> {
  const { data, error } = await supabase.rpc('obras_aplicar_alteracao', {
    p_obra_id: params.obraId,
    p_campos: params.campos,
    p_linhas: params.linhas,
  })

  if (error) return { error: 'Erro ao salvar a alteração da obra' }
  return { data: data as ObraRow }
}
```

Confira o import de `SupabaseClient` contra o que `_actions.ts`/`_execucao.ts` já usam
neste projeto (`@supabase/supabase-js` ou o tipo re-exportado por `lib/supabase/server.ts`
— usar o mesmo caminho que o resto do módulo usa, para não divergir).

- [ ] **Step 3: Rodar e confirmar que os 3 testes passam**

Run: `npm test -- historico.test.ts` → PASS (15 testes)

- [ ] **Step 4: Rodar a suíte completa do módulo, garantir que nada quebrou**

Run: `npm test -- app/obras`
Expected: todos os testes existentes de `app/obras/__tests__/*` continuam passando —
este arquivo é aditivo, não deveria afetar nenhum outro.

- [ ] **Step 5: Rodar lint e build**

Run: `npm run lint && npm run build`
Expected: sem erro novo atribuível a `historico.ts`.

- [ ] **Step 6: Commit**

```bash
git add app/obras/_lib/historico.ts app/obras/__tests__/historico.test.ts
git commit -m "feat(obras): gravarComHistorico — chamada atômica à RPC obras_aplicar_alteracao"
```

---

### Task 5: Componente de exibição `_historico.tsx`

**Files:**
- Create: `app/obras/obra/[id]/_historico.tsx`
- Create: `app/obras/obra/[id]/__tests__/_historico.test.tsx`

**Interfaces:**
- Consumes: `LinhaHistorico`, `BlocoHistorico`, `ROTULO_CAMPO` (Task 2/3), `br` de
  `_lib/tipos.ts`, `Box`/`BoxH`/`BoxB`/`EstadoVazio` de `_ui/primitivos.tsx` (reaproveitar,
  não recriar o visual das outras telas do módulo).
- Produces: `<Historico linhas={...} entrada={...} />` — não é importado por ninguém
  ainda nesta Parte 1 (a Parte 2 conecta em `page.tsx`, fora deste plano).

Este componente **não** importa `_actions.ts`, `_ficha.tsx` nem `_triagem.tsx` — só
`_lib/historico.ts`, `_lib/tipos.ts` e `_ui/primitivos.tsx`, que já existem e não fazem
parte da reescrita da J4.

- [ ] **Step 1: Teste — estado vazio (obra sem nenhuma linha de histórico)**

```tsx
// app/obras/obra/[id]/__tests__/_historico.test.tsx
import { render, screen } from '@testing-library/react'
import Historico from '../_historico'

describe('Historico', () => {
  it('sem linhas, mostra o estado vazio e ainda assim a linha de entrada', () => {
    render(<Historico linhas={[]} entrada={{ data: '2026-09-09', fonte: 'field' }} />)
    expect(screen.getByText(/nenhuma alteração/i)).toBeInTheDocument()
    expect(screen.getByText(/09\/09\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/field/i)).toBeInTheDocument()
  })
})
```

Run: `npm test -- _historico.test.tsx` → FAIL (`_historico.tsx` não existe).

- [ ] **Step 2: Implementação mínima — estado vazio + linha de entrada**

```tsx
'use client'

/**
 * Histórico de alterações da obra — J4, seção D (aprovada).
 * Só exibe: não busca nada sozinho. Quem monta a página busca as linhas em
 * `obras_historico` e a data/fonte de entrada da obra, e passa como props.
 * Ver spec §4 para por que a linha "Entrada" é sintética, não uma linha real
 * de `obras_historico` (a sincronização do Field nunca grava histórico).
 */

import { useState } from 'react'
import { br } from '../../_lib/tipos'
import { ROTULO_CAMPO, type BlocoHistorico, type LinhaHistorico } from '../../_lib/historico'
import { Box, BoxB, BoxH, EstadoVazio } from '../../_ui/primitivos'

const FILTROS: ('Todos' | BlocoHistorico)[] = [
  'Todos', 'Triagem', 'Autorização', 'Identificação', 'Cronograma', 'Esteira',
]

export default function Historico({
  linhas,
  entrada,
}: {
  linhas: LinhaHistorico[]
  entrada: { data: string; fonte: string | null }
}) {
  const [filtro, setFiltro] = useState<'Todos' | BlocoHistorico>('Todos')
  const filtradas = linhas.filter((l) => filtro === 'Todos' || l.bloco === filtro)

  return (
    <Box>
      <BoxH extra={String(linhas.length)}>Histórico de alterações</BoxH>
      <BoxB className="flex flex-col gap-2.5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por bloco">
          {FILTROS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtro === f}
              onClick={() => setFiltro(f)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                filtro === f
                  ? 'border-[#f05a28] bg-[#f05a28]/15 text-[#f05a28]'
                  : 'border-[#1e3a5f] text-[#94a3b8]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {filtradas.length === 0 ? (
          <EstadoVazio>Nenhuma alteração desde a entrada pelo Field.</EstadoVazio>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtradas.map((l) => (
              <li key={l.id} className="border-b border-[#1e3a5f] pb-2 text-xs last:border-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#94a3b8]">
                  <span>{new Date(l.created_at).toLocaleString('pt-BR')}</span>
                  <span>{l.quem}</span>
                  <span className="rounded border border-[#1e3a5f] px-1.5 py-px">{l.bloco}</span>
                </div>
                <div className="mt-0.5 text-[#e8eef7]">
                  {ROTULO_CAMPO[l.campo]}: <span className="text-[#64748b]">{l.de ?? '—'}</span> →{' '}
                  <b>{l.para ?? '—'}</b>
                </div>
                {l.motivo ? (
                  <div className="mt-0.5 text-[#f4b73f]">Motivo: {l.motivo}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {filtro === 'Todos' ? (
          <p className="border-t border-[#1e3a5f] pt-2 text-[11px] text-[#64748b]">
            {br(entrada.data)}
            {entrada.fonte === 'field' ? ' · Field' : ''} — Obra criada pela sincronização,
            com Nº OS, loja e chamado.
          </p>
        ) : null}
      </BoxB>
    </Box>
  )
}
```

- [ ] **Step 3: Rodar e confirmar que o teste do Step 1 passa**

Run: `npm test -- _historico.test.tsx` → PASS

- [ ] **Step 4: Teste — lista com linhas, filtro por bloco**

```tsx
  it('mostra as linhas e filtra por bloco ao clicar no chip', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Autorização' as const, campo: 'liberado_por' as const,
        de: null, para: 'JUAN', motivo: null, quem: 'amanda@manfac.com.br', created_at: '2026-07-02T14:30:00Z',
      },
      {
        id: '2', obra_id: 'o1', bloco: 'Cronograma' as const, campo: 'prioridade' as const,
        de: 'Normal', para: 'Urgente', motivo: null, quem: 'yuri@manfac.com.br', created_at: '2026-08-01T09:00:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)

    expect(screen.getByText(/Liberado por/)).toBeInTheDocument()
    expect(screen.getByText(/Prioridade/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Autorização' }))

    expect(screen.getByText(/Liberado por/)).toBeInTheDocument()
    expect(screen.queryByText(/^Prioridade/)).not.toBeInTheDocument()
  })

  it('mostra o motivo só quando a linha tem motivo (remarcação)', () => {
    const linhas = [
      {
        id: '1', obra_id: 'o1', bloco: 'Cronograma' as const, campo: 'inicio_plan' as const,
        de: '10/09/2026', para: '16/09/2026', motivo: 'Loja pediu para adiar',
        quem: 'yuri@manfac.com.br', created_at: '2026-09-14T10:00:00Z',
      },
    ]
    render(<Historico linhas={linhas} entrada={{ data: '2026-06-30', fonte: 'field' }} />)
    expect(screen.getByText(/Motivo: Loja pediu para adiar/)).toBeInTheDocument()
  })
```

Run: `npm test -- _historico.test.tsx` → confirme que passam; se o filtro não esconder a
linha certa, revise o `filter` no componente (não o teste) — o comportamento esperado é o
do mockup: um bloco por vez, `Todos` mostra tudo.

- [ ] **Step 5: Rodar a suíte inteira do módulo e o build**

Run: `npm test -- app/obras && npm run lint && npm run build`
Expected: tudo verde. `_historico.tsx` não é importado por nenhuma página ainda — isso é
esperado (Parte 2 conecta depois) e não deve gerar erro de lint por "não usado" (é
`export default`, não uma variável solta).

- [ ] **Step 6: Commit**

```bash
git add app/obras/obra/\[id\]/_historico.tsx app/obras/obra/\[id\]/__tests__/_historico.test.tsx
git commit -m "feat(obras): componente de exibição do histórico de alterações (_historico.tsx)"
```

---

### Task 6: Verificação final da Parte 1 contra a spec

**Files:** nenhum arquivo novo — esta tarefa é revisão, não código.

- [ ] **Step 1: Conferir que nenhum arquivo tocado nas Tasks 1–5 aparece no `git diff` de `_actions.ts`, `_ficha.tsx` ou `_triagem.tsx`**

```bash
git diff --stat HEAD~6..HEAD -- 'app/obras/obra/[id]/_actions.ts' 'app/obras/obra/[id]/_ficha.tsx' 'app/obras/obra/[id]/_triagem.tsx'
```

Expected: saída vazia. Se algo aparecer, é um vazamento da Parte 1 para os arquivos
restritos — investigar antes de prosseguir.

- [ ] **Step 2: Conferir a lista de entregáveis da spec §11 (Parte 1) contra o que existe**

- `sdd-sql-obras-historico.sql` — aplicado e verificado (Task 1).
- `app/obras/_lib/historico.ts` — `BlocoHistorico`, `CampoHistorico`, `ROTULO_CAMPO`,
  `LinhaHistoricoNova`, `LinhaHistorico`, `linhasDeAlteracao`, `gravarComHistorico`
  (Tasks 2–4).
- `app/obras/__tests__/historico.test.ts` — cobre diff puro e a chamada à RPC (Tasks 2–4).
- `app/obras/obra/[id]/_historico.tsx` — componente de exibição (Task 5).
- `app/obras/obra/[id]/__tests__/_historico.test.tsx` — cobre render/filtro (Task 5).

- [ ] **Step 3: Atualizar `AGENTS.md`, seção "Estado das migrations em produção", com a linha de `obras-historico`**

Seguir o formato das linhas existentes (`obras-fonte`, `obras-field-reconciliacao`):
estado, data, quem aplicou, o que a migration criou. Só depois de a Task 1 estar
realmente aplicada em produção (não antes).

```bash
git add AGENTS.md
git commit -m "docs: registra obras-historico no estado de migrations do AGENTS.md"
```

---

## Self-review contra a spec

- **§2 (tabela)** → Task 1.
- **§3 (RLS)** → Task 1, Step 2 (policies) + Step 4 (verificação em produção).
- **§4 (sincronização não grava)** → cumprido por construção: nenhuma task deste plano
  toca `_sincronizacao.ts`/`_execucao.ts`, e a linha "Entrada" do componente (Task 5) é
  sintética, não lida de `obras_historico`.
- **§5 (TS + RPC atômica, não trigger)** → Task 1 (RPC) + Tasks 3–4 (TS).
- **§6 (campos rastreados)** → Task 2 (`ROTULO_CAMPO`) + Task 1 (`check` constraint) —
  as duas listas precisam ficar idênticas; se alguém editar uma sem a outra, o teste do
  Step 1 da Task 2 não pega isso sozinho (é só TS) — a migration (`check`) é quem
  recusaria em produção uma chave fora da lista. Vale um lembrete na revisão de código.
- **§7 (OS aprovada em)** → Task 3, Step 8 cobre o formato geral; o caso específico "duas
  linhas na mesma chamada da esteira" está no Step 9 (etapa + marco), que é o mesmo
  mecanismo que cobriria etapa + os_aprovada_em juntos — não escrevi um teste dedicado
  exatamente a `etapa` + `os_aprovada_em` juntos porque o Step 9 já prova que múltiplas
  chaves em `depois` geram múltiplas linhas independentes; adicionar esse teste específico
  é opcional, não bloqueia a Parte 1.
- **§8 (remarcação, motivo obrigatório)** → Task 3, Step 8.
- **§9 (interface das 3 peças)** → Tasks 2–4.
- **§10 (componente)** → Task 5.
- **§11 (divisão Parte 1/2)** → Task 6, Step 1 é o guardião automático dessa fronteira.
- **§12/§13 (ambiguidades e riscos)** → não geram task (são para quem escrever a Parte 2
  decidir/mitigar), citados aqui só para rastreabilidade.

## Execution Handoff

Plano salvo em
`docs/cliente/2026-08-31-sistema-controle-de-obras/plano-historico-alteracoes-2026-09-15.md`.
Duas opções de execução:

1. **Subagent-Driven (recomendado)** — um subagente por task, revisão entre tasks.
2. **Execução inline** — executar as tasks nesta sessão com `superpowers:executing-plans`,
   em lote, com checkpoints.
