# SPOT — Financeiro da OS e faturamento parcial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ficha de cada SPOT mostra custos, faturamento e margem da OS para todos com acesso ao Gestão de Obras, com os 4 botões de pedir, locações e faturamento parcial (várias NFs por OS SPOT).

**Architecture:** Dois repositórios. **Hub** (`login-system`, worktree `C:\Users\jguil\claude\wt-spot-fin`, branch `feat/obras-spot-financeiro`): SQL novo libera valores para SPOT, analista marca locação, tabela de notas fora do sistema, e `obras_marcar_faturada`/`obras_desmarcar_faturada` passam a somar notas no SPOT; a ficha ganha o bloco "Financeiro da OS" reaproveitando `montarFinanceiro` e as RPCs `obras_fin_*`. **Financeiro** (worktree novo `C:\Users\jguil\claude\wt-fin-spot-parcial`, branch `feat/spot-faturamento-parcial` a partir de `origin/main` `02b0ba0` — o `main` local está 6 commits atrás e não tem o 044): migração 045 abre a 2ª nota para OS SPOT com saldo; fila, casamento e tela trabalham com **saldo**; a nota com várias obras pede a parte de cada uma. Compras e Fornecedores **não mudam** (conferido: `lerObra` e `frn_listar_obras` não filtram modalidade; `?tipo=locacao` e pré-aprovação que pula sem engenheiro já estão em `origin/main`).

**Tech Stack:** Next.js (ler `node_modules/next/dist/docs/` antes de código novo), Supabase Postgres, Tailwind v4; hub com Jest + Testing Library; Financeiro com Vitest + PGlite (`tests/hub-install-pglite.test.ts`).

**Spec:** `docs/superpowers/specs/2026-11-01-obras-spot-financeiro-design.md` (ler inteiro antes de qualquer task).

## Global Constraints

- Responder/escrever em português do Brasil; textos de tela exatamente como nesta spec/plano.
- Dinheiro em **centavos inteiros** (`bigint`/`number` inteiro); `obras_obra.valor` é numeric em **reais** → centavos com `Math.round(valor*100)` (TS) / `round(valor*100)::bigint` (SQL).
- Faturamento parcial **só `modalidade = 'spot'`**; OBRAS mantêm o comportamento atual em todo lugar.
- Guardas de autorização/RLS falham **fechado**: `is not true` / `coalesce(..., false)`, nunca `NULL` deixando passar (AGENTS.md, exceções 1–5).
- Hub SQL: arquivo `sdd-sql-*.sql` na raiz, `begin;…commit;`, seção 0 com pré-requisito que aborta, bloco de verificação pós-commit (`OK`/`*** FALHOU ***`), arquivo de teste com rollback em `docs/obras/`. **Nenhum agente aplica SQL em produção** — o José aplica.
- Financeiro SQL: `supabase/hub-install/045_*.sql`; sem `do`, sem `execute` dinâmico; escrita/DDL só em `fin_*`; `security definer` com `set search_path = public, pg_temp` e `set row_security = off`; pode **ler** `obras_obra`/`obras_nota_externa`, não chamar funções `obras_*`; `fin_fat_*` só `service_role`. Depois de aplicado: `npm run types` e commit de `types/supabase.ts`.
- `<a>` (não `<Link>`) para Compras/Financeiro/Fornecedores, `target="_blank" rel="noopener"`.
- Ficha SPOT é tema escuro com hex fixo (`#0a1628`, `#0d2050`, `#1e3a5f`, `#e8eef7`, `#94a3b8`, `#f05a28`), primitivos de `app/obras/_ui/primitivos`; **não** usar `--obra-*`.
- `'use server'` só exporta funções async; **nunca `export type` em `_actions.ts`** (armadilha 1 de `.claude/rules/obras.md`).
- Ordem de deploy: hub SQL → Financeiro 045 → app Financeiro → app hub → script MACAÉ 2.

## Review Focus

1. **Nota que passa do valor** (soma > valor da OS): OS vira Faturado e a ficha mostra "Faturado acima do valor da OS em R$ X" — teste na Task 2 e na Task 1 (verificação SQL).
2. **Nota cancelada depois de a OS fechar a soma**: OS volta para Pendente faturamento e a NFS-e sai de `fat_nfse` — Task 1.
3. **SPOT com `valor` nulo**: comportamento antigo (1ª nota fatura); ficha mostra "—" na margem e no %, sem dividir por zero — Tasks 1 e 2.
4. **Nota com várias obras cujas partes não somam o total**: trava na tela e recusa na aprovação — Tasks 7 e 8.
5. **Usuário sem acesso ao Obras / OBRAS sem papel**: `obras_pode_ver_valores` continua false para modalidade `obra` sem papel, e false para quem não tem acesso ao Obras mesmo em SPOT — Task 1.

---

## Parte A — Hub (`C:\Users\jguil\claude\wt-spot-fin`)

### Task 1: SQL do hub — valores no SPOT, locação pelo analista, notas externas, faturamento parcial

**Files:**
- Create: `sdd-sql-obras-spot-financeiro.sql`
- Create: `docs/obras/2026-11-01-verificacao-obras-spot-financeiro.sql` (casos com `begin; … rollback;`, padrão de `docs/obras/2026-11-01-verificacao-obras-financeiro-bc.sql`)
- Create: `__tests__/sql-obras-spot-financeiro.test.ts` (asserts de texto, padrão de `__tests__/sql-obras-faturamento.test.ts`)

**Interfaces:**
- Produces (SQL):
  - `obras_pode_ver_valores(p_obra uuid) returns boolean` — mesma assinatura; acrescenta `or o.modalidade = 'spot'` **dentro** do bloco que já exige e-mail e `obras_has_access() is true`.
  - `obras_analista_spot(p_obra uuid) returns boolean` — security definer, stable, nunca NULL: true se `obras_is_admin()`, ou `obras_has_access()` e obra `modalidade='spot'` e e-mail do JWT = `lower(trim(obras_pessoa.email))` da pessoa com `chave = obras_obra.pcm`.
  - `obras_pode_marcar_locacao(p_obra uuid) returns boolean` = `obras_engenheiro_ou_admin_mae(p_obra) or obras_analista_spot(p_obra)`, coalesce false. Substitui `obras_engenheiro_ou_admin_mae` no gatilho `obras_locacao_estado_guarda` e nas policies `"obras engenheiro insert"`/`"obras engenheiro update"` de `obras_locacao_estado` (recriar policies com o mesmo nome; mensagem do gatilho: `'OBRAS_LOCACAO: só o engenheiro da obra, o analista do SPOT ou administrador marca a locação'`).
  - Tabela `obras_nota_externa` (NF emitida fora do módulo de faturamento): `id uuid pk default gen_random_uuid()`, `obra_id uuid not null references obras_obra(id) on delete cascade`, `nfse text not null`, `emitida_em date not null`, `valor_centavos bigint not null check (valor_centavos > 0)`, `pedido text`, `obs text`, `criado_por text not null`, `criado_em timestamptz not null default now()`, `unique (obra_id, nfse)`. RLS: select `obras_pode_ver_valores(obra_id)`; insert/delete só `obras_is_admin()`; sem update; `revoke all from anon`.
  - `obras_spot_faturado_centavos(p_obra uuid) returns bigint` — security definer, só `service_role` e uso interno: soma `fin_fat_nota_obras.valor_centavos` das notas `ambiente='producao'`, `situacao in ('autorizada','enviada')`, `obras_devolvidas_em is null` (mesma regra de `contaNaReceita` em `app/obras/obras/_lib/financeiro-tela.ts:134`) + soma de `obras_nota_externa.valor_centavos`.
  - `obras_marcar_faturada(...)` — mesma assinatura; para obra `modalidade='spot'` com `valor` não nulo em `pendFat`: acrescenta `btrim(p_nfse)` a `fat_nfse` (lista `"735, 812"`, sem repetir); se `obras_spot_faturado_centavos ≥ round(valor*100)` faz a transição atual para `faturado`; senão fica em `pendFat`, grava `obras_historico` (bloco `'Esteira'`, campo `'faturamento parcial'`, para = `'R$ a de R$ b'`) e devolve a obra em `parciais`. Retorno passa a `{marcadas, puladas, parciais: [{id, faturado_centavos, falta_centavos}]}` (sempre com a chave `parciais`). OBRAS e SPOT sem valor: caminho atual.
  - `obras_desmarcar_faturada(...)` — mesma assinatura; para SPOT: tira a NFS-e da lista de `fat_nfse` (aceita a NFS-e em qualquer posição da lista, não só igualdade); se estava `faturado` e o faturado recalculado < valor, volta a `pendFat` como hoje; se estava `pendFat`, só atualiza a lista e grava histórico. OBRAS: caminho atual.

- [ ] **Step 1:** Escrever `__tests__/sql-obras-spot-financeiro.test.ts`: o arquivo existe; contém `modalidade = 'spot'` dentro de `obras_pode_ver_valores`; `obras_pode_marcar_locacao` aparece no gatilho e nas duas policies; `create table public.obras_nota_externa`; `parciais` em `obras_marcar_faturada`; seção 0 com `raise exception` exigindo `obras_fin_notas` e `obras_locacao_estado`; `begin;` e `commit;`; nenhum `grant` de `obras_marcar_faturada`/`obras_desmarcar_faturada`/`obras_spot_faturado_centavos` a `authenticated`.
- [ ] **Step 2:** `npx jest __tests__/sql-obras-spot-financeiro.test.ts` → FAIL (arquivo não existe).
- [ ] **Step 3:** Escrever o SQL. Partir das definições atuais: `sdd-sql-obras-financeiro-a.sql:243` (pode_ver_valores), `sdd-sql-obras-financeiro-bc.sql:216` (engenheiro_ou_admin_mae), `:537-632` (gatilho e policies de locação), `sdd-sql-obras-faturamento.sql:45` e `:125` (marcar/desmarcar — manter os grants só a `service_role`).
- [ ] **Step 4:** `npx jest __tests__/sql-obras-spot-financeiro.test.ts` → PASS.
- [ ] **Step 5:** Escrever a verificação com rollback, um caso por linha `OK`/`*** FALHOU ***`, cobrindo no mínimo (JWT simulado com `set_config('request.jwt.claims', …)`): SPOT visível a usuário só com acesso ao Obras; OBRAS **não** visível ao mesmo usuário; sem acesso ao Obras → false; analista (via `obras_pessoa.email`) marca locação de SPOT; analista de outra OS é recusado; admin marca; nota parcial deixa SPOT em `pendFat` e em `parciais`; 2ª nota que fecha a soma leva a `faturado`; soma acima do valor leva a `faturado`; desmarcar a nota que fechou volta a `pendFat` e tira a NFS-e da lista; SPOT sem valor fatura na 1ª nota; OBRAS fatura na 1ª nota como antes; nota externa entra na soma; não-admin não insere em `obras_nota_externa`.
- [ ] **Step 6:** Commit: `git add sdd-sql-obras-spot-financeiro.sql docs/obras/2026-11-01-verificacao-obras-spot-financeiro.sql __tests__/sql-obras-spot-financeiro.test.ts && git commit -m "feat(obras-sql): SPOT vê valores, analista marca locação, notas externas e faturamento parcial"`

### Task 2: Resumo financeiro do SPOT (função pura)

**Files:**
- Create: `app/obras/obra/[id]/_financeiro/resumo-spot.ts`
- Test: `app/obras/obra/[id]/_financeiro/__tests__/resumo-spot.test.ts`

**Interfaces:**
- Consumes: `NotaTela` (`app/obras/obras/_lib/financeiro-tela.ts:103`), `Custo` (`app/obras/obras/_lib/financeiro-obra.ts:180`).
- Produces:
  ```ts
  export type NotaExterna = { nfse: string; emitidaEm: string; valorCentavos: number }
  export type ResumoSpot = {
    valorCentavos: number | null
    faturadoCentavos: number
    faturadoPct: number | null        // 0–100+, 1 casa; null sem valor
    faltaCentavos: number | null      // max(0, valor − faturado); null sem valor
    acimaDoValorCentavos: number | null // faturado − valor quando > 0, senão null
    notas: number                     // notas que contam + externas
    foraDoSistema: boolean
    custo: Custo
    margemPrevistaCentavos: number | null   // valor − custo.comprometido
    margemPrevistaPct: number | null        // sobre o valor
    margemRealizadaCentavos: number          // faturado − custo.realizado
    margemRealizadaPct: number | null        // sobre o faturado; null se faturado = 0
  }
  export function resumoSpot(p: { valorCentavos: number | null; etapa: string; fatNfse: string | null;
    notas: NotaTela[]; externas: NotaExterna[]; custo: Custo }): ResumoSpot
  ```
  Faturado = soma de `parcelaCentavos` das `notas` com `contaNaReceita` + soma das `externas`. **Exceção legada:** se esse total é 0, `etapa === 'faturado'` e `fatNfse` não vazio → faturado = `valorCentavos` e `foraDoSistema = true`. Faturada sem `fatNfse` → faturado 0.

- [ ] **Step 1:** Testes (valores exatos):
  - MACAÉ 2 depois do acerto: valor 15641232, externa 14077109, sem notas, custo `{comprometido: 11238000, realizado: 10493000, pago: 9620000}` → `faturadoCentavos 14077109`, `faturadoPct 90`, `faltaCentavos 1564123`, `margemPrevistaCentavos 4403232`, `margemPrevistaPct 28.2`, `margemRealizadaCentavos 3584109`, `foraDoSistema false`.
  - Legada: etapa `'faturado'`, `fatNfse '1481'`, sem notas → `faturadoCentavos === valorCentavos`, `foraDoSistema true`.
  - Faturada sem `fatNfse` e sem notas → `faturadoCentavos 0`, `foraDoSistema false`.
  - Nota `situacao 'cancelada'` (`contaNaReceita false`) não soma.
  - Acima: valor 100000, notas somando 110000 → `acimaDoValorCentavos 10000`, `faltaCentavos 0`.
  - Sem valor → `faturadoPct null`, `faltaCentavos null`, `margemPrevistaCentavos null`, `margemPrevistaPct null`.
- [ ] **Step 2:** `npx jest "app/obras/obra/\[id\]/_financeiro/__tests__/resumo-spot.test.ts"` → FAIL.
- [ ] **Step 3:** Implementar `resumoSpot` (percentuais com 1 casa, `Math.round(x*10)/10`).
- [ ] **Step 4:** Rodar de novo → PASS.
- [ ] **Step 5:** Commit `feat(obras): resumo financeiro do SPOT (faturado, falta, margens)`.

### Task 3: Leitura do financeiro do SPOT

**Files:**
- Create: `app/obras/obra/[id]/_financeiro/dados.ts`
- Test: `app/obras/obra/[id]/_financeiro/__tests__/dados.test.ts` (fixture `app/obras/obras/_lib/__tests__/fixtures/supabase-falso.ts`)

**Interfaces:**
- Consumes: `montarFinanceiro` e `Financeiro` (`app/obras/obras/_lib/financeiro-tela.ts:143,125`), `montarLocacoes`/`Locacao` (`app/obras/obras/[id]/financeiro/locacoes/_tipos.ts`), `itensDeLocacao`, `resumoSpot` (Task 2).
- Produces:
  ```ts
  export type FinanceiroSpot =
    | { ok: true; lidoEm: string; fin: Financeiro; resumo: ResumoSpot; locacoes: Locacao[]; externas: NotaExterna[] }
    | { ok: false; motivo: 'sem-permissao' | 'leitura' }
  export async function lerFinanceiroSpot(supabase: SupabaseClient,
    obra: { id: string; valor: number | null; etapa: string; fat_nfse: string | null }, hoje: string): Promise<FinanceiroSpot>
  ```
  Mesma sequência de `app/obras/obras/[id]/financeiro/page.tsx` (cliente da **sessão**, nunca o admin): `rpc('obras_pode_ver_valores')` precisa ser `true` (senão `sem-permissao`); `Promise.all` de `obras_fin_compras`, `obras_fin_fornecedores`, `obras_fin_notas`, `obras_fin_vinculos`, `obras_fin_caixinha_sem_obra`, `obras_fin_locacoes`, `obras_fin_medicoes_fornecedor_atrasadas` e `from('obras_nota_externa').select('nfse, emitida_em, valor_centavos').eq('obra_id', id)`; sem medições ao cliente, `avanco: null`. Qualquer erro → `{ ok:false, motivo:'leitura' }`. `custo` do resumo = totais comprometido/realizado/pago de `fin.resumo` (ler o tipo `Linha` em `financeiro-obra.ts` para os nomes exatos).

- [ ] **Step 1:** Testes: sem permissão → `sem-permissao` e nenhuma outra RPC chamada; erro numa RPC → `leitura`; caminho feliz com uma nota autorizada e uma externa monta `resumo.faturadoCentavos` = soma; `@/lib/supabase/admin` mockado para lançar.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(obras): leitura do financeiro da OS SPOT`.

### Task 4: Locação no SPOT — marcar devolvida / renovar

**Files:**
- Create: `app/obras/obra/[id]/_financeiro/_actions.ts` (`'use server'`)
- Test: `app/obras/obra/[id]/_financeiro/__tests__/actions.test.ts` (padrão de `app/obras/obras/[id]/financeiro/locacoes/__tests__/actions.test.ts`)

**Interfaces:**
- Produces: `marcarDevolvidaSpotAction(obraId: string, pedidoId: string, data: string): Promise<{ok:true}|{ok:false; erro:string}>` e `renovarLocacaoSpotAction(obraId: string, pedidoId: string, ate: string): Promise<…mesmo…>`.
  Mesmas validações de `locacoes/_actions.ts` (data ISO; devolução não futura nem antes do início; renovação > `fim ?? inicio`; nada sobre locação devolvida); acha a locação por `rpc obras_fin_locacoes(p_obra: obraId)` + `montarLocacoes`; exige obra `modalidade='spot'`; **a autorização é do banco** (Task 1) — o erro `42501` vira `'Só o analista desta OS ou um administrador marca a locação.'`; grava `upsert` em `obras_locacao_estado` com `onConflict: 'cmp_pedido_id'`; `revalidatePath('/obras/obra/' + obraId)`.

- [ ] **Step 1:** Testes: devolução futura recusada; renovação antes do fim recusada; obra `modalidade 'obra'` recusada; erro 42501 do banco vira a mensagem acima; caminho feliz grava `devolvida_em`/`renovada_ate` e revalida o caminho da ficha.
- [ ] **Step 2–4:** FAIL → implementar → PASS. Rodar também `npx jest __tests__/use-server-exports-async.test.ts` → PASS.
- [ ] **Step 5:** Commit `feat(obras): analista marca locação do SPOT como devolvida ou renovada`.

### Task 5: Bloco "Financeiro da OS" e botões na ficha

**Files:**
- Create: `app/obras/obra/[id]/_financeiro/bloco.tsx` (`'use client'` só pelas sub-abas e botões de locação)
- Modify: `app/obras/obra/[id]/_ficha.tsx` (props; quadro "Pedir a partir desta obra" linhas 606-621; bloco novo logo depois de `BlocoCronograma`, ~linha 833)
- Modify: `app/obras/obra/[id]/page.tsx` (chama `lerFinanceiroSpot` quando `obra.modalidade === 'spot'` e passa `financeiro` à `Ficha`)
- Test: `app/obras/obra/[id]/_financeiro/__tests__/bloco.test.tsx`; ajustar `app/obras/obra/[id]/__tests__/_ficha.test.tsx`

**Interfaces:**
- Consumes: `FinanceiroSpot` (Task 3), actions (Task 4), `brl` (`financeiro-tela.ts:41`).
- Produces: `export default function BlocoFinanceiroSpot({ obraId, dados, hoje }: { obraId: string; dados: FinanceiroSpot; hoje: string })`; prop nova `financeiro?: FinanceiroSpot` na `Ficha`.

Conteúdo (mockup aprovado https://claude.ai/artifact/SqeXWVr9ua5ZVKi4THu77G):
- Título do quadro passa a "Pedir a partir desta OS"; 4 links `<a target="_blank" rel="noopener">`: **Pedir material** (`/compras/solicitacoes/nova?obra=<id>`, laranja), **Pedir pagamento** (`/financeiro/solicitacoes/nova?obra=<id>`), **Pedir medição** (`/fornecedores/medicoes/nova?obra=<id>`), **Nova locação** (`/compras/solicitacoes/nova?obra=<id>&tipo=locacao`); texto "Cada botão abre o outro sistema em nova aba, já com esta OS."; continua escondido em OS cancelada.
- Bloco "Financeiro da OS" com "Dados até <lidoEm>"; 4 totais: **Valor da OS**, **Faturado** (`% · N nota(s) · falta R$ X`), **Custo comprometido** (`realizado … · pago …`), **Margem prevista** (`%` e R$). Avisos: `foraDoSistema` → "Nota fora do sistema: faturado considerado pelo valor da OS."; `acimaDoValorCentavos` → "Faturado acima do valor da OS em R$ X".
- Sub-abas: Resumo · Compras · Fornecedores · Pagamentos e caixinha · Locações · Faturamento (conteúdo como no mockup; linhas de Compras com "abrir no Compras ↗"). Locações com botões "Devolvida" e "Renovar até…" (input date) chamando as actions e `router.refresh()`; aviso de vencimento via `avisoLocacao`/`textoAviso` (`app/obras/obras/_lib/locacao.ts`).
- `dados.ok === false` → `'leitura'`: "Não foi possível ler o financeiro agora." ; `'sem-permissao'`: bloco não aparece.

- [ ] **Step 1:** Testes do bloco: os 4 hrefs exatos; totais formatados com MACAÉ 2 (`R$ 156.412,32`, `90%`, `falta R$ 15.641,23`); aviso "Nota fora do sistema"; trocar para a sub-aba Faturamento mostra "NFS-e 735"; clique em "Devolvida" chama `marcarDevolvidaSpotAction` com `(obraId, pedidoId, hoje)`; `sem-permissao` não renderiza o bloco. Na ficha: OS cancelada não mostra o quadro de pedir.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** `npm run lint` e `npx tsc --noEmit` sem erros novos; `npm test` com as 106 suítes do hub verdes (as 7 do `manfac-site` falham por resolução de módulo e não contam).
- [ ] **Step 6:** Ver no navegador: `npm run dev`, abrir `/obras/obra/<id de SPOT>` logado; conferir bloco, sub-abas e botões em largura de celular.
- [ ] **Step 7:** Commit `feat(obras): Financeiro da OS e botões de pedir na ficha do SPOT`.

## Parte B — Financeiro (`C:\Users\jguil\claude\wt-fin-spot-parcial`)

Antes da Task 6: `git -C C:\Users\jguil\claude\financeiro fetch origin && git -C C:\Users\jguil\claude\financeiro worktree add -b feat/spot-faturamento-parcial ..\wt-fin-spot-parcial origin/main`; `npm ci`; ler `CLAUDE.md` e `supabase/hub-install/README.md` do repo.

### Task 6: Migração 045 — 2ª nota para OS SPOT com saldo e soma das partes

**Files:**
- Create: `supabase/hub-install/045_fin_fat_spot_parcial.sql`
- Modify: `tests/stubs/supabase-minimo.sql` (stub de `obras_obra` com `id, os, loja, valor numeric, etapa, modalidade, fat_enviado_em, cancelado_em` se faltar; stub de `obras_nota_externa(obra_id uuid, valor_centavos bigint)`)
- Test: `tests/fat-spot-parcial-sql.test.ts` (PGlite, padrão de `tests/hub-install-pglite.test.ts`)

**Interfaces:**
- Produces (SQL):
  - `fin_fat_saldo_spot(p_obra uuid, p_ignorar_nota uuid default null) returns bigint` — null quando a obra não é SPOT ou não tem valor; senão `round(valor*100) − Σ fin_fat_nota_obras.valor_centavos` das notas com `situacao <> 'cancelada'` (rascunho conta, para não abrir dois rascunhos do mesmo saldo), excluindo `p_ignorar_nota`, `− Σ obras_nota_externa.valor_centavos`.
  - `fin_fat_obra_livre(p_obra uuid, p_ignorar_nota uuid) returns boolean` — true se não há outra nota viva (regra atual) **ou** `fin_fat_saldo_spot(p_obra, p_ignorar_nota) > 0`.
  - `create or replace` de `fin_fat_conferir_e_congelar` (cópia da versão do `036`) trocando o laço da linha 38-46 por `fin_fat_obra_livre(o.obra_id, p_nota.id) is not true`, e acrescentando: nota com mais de uma obra → `Σ valor_centavos das obras = valor_total_centavos`, senão `raise exception 'FIN_GUARD: a soma das partes das obras (R$ %) é diferente do valor da nota (R$ %)'`; parte nula ou ≤ 0 → `'FIN_GUARD: informe a parte de cada obra na nota'`.
  - `create or replace` de `fin_fat_salvar_nota` (cópia do `041`) trocando a recusa 73-81 por `fin_fat_obra_livre(obra, null) is not true` (mantém o advisory lock).

- [ ] **Step 1:** Testes PGlite: SPOT valor 1000,00 com nota viva de 900,00 → 2ª nota de 100,00 aprova; SPOT já quitado → recusa "já está em outra nota"; OBRAS com nota viva → recusa (como hoje); nota de duas obras com partes 300+600 e total 1000 → recusa com a mensagem de soma; externa de 900,00 conta no saldo; `tests/hub-install-safety.test.ts` continua verde (sem `do`/`execute`).
- [ ] **Step 2–4:** FAIL → implementar → PASS (`npm run test`).
- [ ] **Step 5:** Commit `feat(faturamento-sql): 2ª nota para OS SPOT com saldo e soma das partes (045)`.

### Task 7: Saldo na fila, no casamento e na busca

**Files:**
- Create: `lib/faturamento/saldo-spot.ts`
- Modify: `lib/faturamento/liberadas.ts` (`COLUNAS` + `modalidade`; `comNotaViva` deixa passar SPOT com saldo > 0; `ObraLiberada.valorCentavos` = saldo), `lib/faturamento/obras-pendentes.ts` (`valorCentavos` = saldo para SPOT), `lib/faturamento/actions.ts` (`buscarObrasAction` ~602 e faturar da fila ~1004-1039: `valor_total_centavos` e `valor_centavos` = saldo), `lib/faturamento/montar-notas.ts` (nota com uma obra: `valor_centavos = valorTotalCentavos` da nota; várias: saldo como padrão), `lib/faturamento/leitura.ts:~227` (`obrasEmOutraNota` ignora SPOT com saldo > 0)
- Test: `tests/faturamento-saldo-spot.test.ts`, ajustar `tests/faturamento-liberadas.test.ts`, testes de `montar-notas`

**Interfaces:**
- Produces: `export async function saldosSpot(db: ClienteServico, obras: { id: string; modalidade: string | null; valorCentavos: number | null }[]): Promise<Map<string, number>>` — só chaves das SPOT com valor; mesma conta de `fin_fat_saldo_spot` (lê `fin_fat_nota_obras` com `fin_fat_notas!inner(situacao)` ≠ `cancelada` e `obras_nota_externa`), em lotes de 200 como `comNotaViva`.

- [ ] **Step 1:** Testes: SPOT 156.412,32 com externa 140.771,09 aparece na fila com `valorCentavos 1564123`; SPOT quitado sai da fila; OBRAS com nota viva sai (como hoje); casamento loja+valor acha a SPOT pelo **saldo**; nota de uma obra grava `valor_centavos` = total da nota.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** Commit `feat(faturamento): fila e casamento pelo saldo da OS SPOT`.

### Task 8: Parte de cada obra na nota e retorno "parciais" na entrega

**Files:**
- Modify: `components/faturamento/nota-form.tsx` (com 2+ obras, campo "Parte desta obra (R$)" por obra, padrão = saldo/valor; linha "Soma das partes: R$ X de R$ Y" em vermelho quando difere)
- Modify: `lib/faturamento/actions.ts` (`obraSchema` ~544 aceita `valor_centavos` informado; mapeamento ~656)
- Modify: `lib/faturamento/conferir.ts` (alerta `soma_partes`, nível `trava`, texto `a soma das partes das obras (R$ X) é diferente do valor da nota (R$ Y)`; `obra_em_outra_nota` respeita o saldo)
- Modify: `lib/faturamento/entregar.ts:32` (`ResultadoObras` ganha `parciais: { id: string; faturado_centavos: number; falta_centavos: number }[]`), `lib/faturamento/repositorio-entrega.ts:25-28` (schema com `parciais` default `[]`, para conviver com o SQL antigo), `lib/faturamento/tela-envio.ts:33-70` (parcial não conta em `obrasForaDeFaturado`; rótulo `"faturado parcial — falta R$ Y"`)
- Test: testes existentes de `conferir`, `faturamento-repositorio-entrega`, `tela-envio`, + `tests/nota-form-partes.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`parciais` no retorno de `obras_marcar_faturada`), Task 7 (`saldosSpot`).

- [ ] **Step 1:** Testes: conferir trava com partes 300+600 em nota de 1000; repositório aceita resposta sem `parciais` e com `parciais`; tela-envio mostra "faturado parcial — falta R$ 156,41" e não "fora de Faturado" para a obra parcial; form com 2 obras mostra os campos de parte e a soma.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5:** `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build` verdes (CLAUDE.md do repo).
- [ ] **Step 6:** Commit `feat(faturamento): parte de cada obra na nota e faturado parcial na entrega`.

## Parte C — Dados e documentação (hub)

### Task 9: Script do acerto da MACAÉ 2

**Files:**
- Create: `docs/obras/2026-11-01-macae2-nf735.sql`

Um bloco transacional com pré-condição (`os = '0426-012516' and etapa = 'pendFat' and valor = 15641.23`, senão `raise exception`), exigindo `obras_nota_externa` existente: `update obras_obra set valor = 156412.32`; `insert obras_nota_externa (obra_id, nfse '735', emitida_em '2026-05-20', valor_centavos 14077109, pedido '4500728137', obs 'NF anterior ao módulo de faturamento', criado_por 'carga (Claude, a pedido do Jose Guilherme)')`; linha em `obras_historico` (bloco `'Identificação'`, `valor`, de `R$ 15.641,23` para `R$ 156.412,32`, motivo citando a NF 735). Rodapé com a conferência esperada (`etapa pendFat`, faturado 140.771,09, falta 15.641,23). **Não aplicar** — o José roda depois do deploy.

- [ ] **Step 1:** Escrever o script. **Step 2:** Ensaiar só com `begin … rollback` se o José autorizar acesso de leitura/ensaio; senão deixar o ensaio para ele. **Step 3:** Commit `docs(obras): script do acerto da MACAÉ 2 com a NF 735`.

### Task 10: Regras e dívidas

**Files:**
- Modify: `.claude/rules/obras.md` (seção "Financeiro da OS no SPOT": onde fica, regra de quem vê, faturamento parcial só SPOT, `obras_nota_externa`, ordem de deploy, SQL não aplicado)
- Modify: `.claude/rules/sql.md` (entrada do `sdd-sql-obras-spot-financeiro.sql`, NÃO aplicado)
- Modify: `docs/DIVIDAS.md` (analista sem e-mail em `obras_pessoa` → só admin marca a locação; faturamento parcial das OBRAS fora; visão consolidada no painel)

- [ ] **Step 1:** Editar. **Step 2:** Commit `docs(obras): regras e dívidas do financeiro do SPOT`.
