# OBRAS — Financeiro da obra, Fase A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** a obra enxerga compras, fornecedores e faturamento (comprometido/realizado/pago, margem por OS), pede material, liga restrição a pedido e tem OS filha.

**Spec:** `docs/superpowers/specs/2026-10-31-obras-financeiro-fase-a-design.md`.

**Base:** worktree `C:\Users\jguil\claude\wt-obras-fin`, branch `feat/obras-financeiro-a` (a partir de `feat/obras-leva5` em 7fa4f68). **Trabalhe só nesse diretório.**

## Global Constraints
- Commits pt-BR com trailer (`Co-Authored-By: <modelo> <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_016Ez3NvioE1ovgGcWcXyBNg`); `git add` por caminho; nunca commitar `AGENTS.md`.
- SQL só em `sdd-sql-obras-financeiro-a.sql` + `docs/obras/2026-10-31-verificacao-obras-financeiro-a.sql` (padrão das levas: seção 0 exige leva5; JWT simulado; `do $$`; t/f; RESUMO). Write/Edit, nunca heredoc sem aspas. **Nenhum agente executa SQL de escrita; SELECT de catálogo para conferir colunas é permitido.**
- **Nenhuma mudança** em repositórios Compras/Financeiro/Fornecedores nem em tabelas `cmp_*`/`fin_*`/`frn_*`.
- Dinheiro em centavos inteiros onde a fonte usa centavos; formatação BRL só na tela. Valores só para `obras_pode_ver_valores`.
- Tema Manfac claro, toque ≥44px, sem emoji.

## Review Focus
1. Engenheiro de outra obra, supervisor ou usuário sem papel → funções devolvem vazio e a aba não aparece. Teste na Task 1/3.
2. Obra mãe soma as filhas sem contar duas vezes uma NF rateada entre mãe e filha. Teste na Task 2.
3. Obra sem nenhum dado financeiro → aba mostra "sem lançamentos" sem NaN. Teste na Task 2/3.
4. Restrição ligada a pedido de outra obra é recusada. Teste na Task 1/3.
5. Lista de pedidos para vincular não traz valor. Teste na Task 1.

---

### Task 1: SQL
Conforme spec §5 (conferir colunas reais de `cmp_solicitacoes`, `cmp_pedidos`, `frn_contratos`, `frn_medicoes`, `fin_fat_notas`, `fin_fat_nota_obras`, `fin_papeis` no banco e nos levantamentos).
- [ ] SQL + verificação; commit.

### Task 2: Consolidação (puro)
**Files:** `app/obras/obras/_lib/financeiro-obra.ts` + testes. `consolidarFinanceiro({ compras, fornecedores, notas, obras: {id, os, paiId}[] }) → { porOS: Linha[], total: Linha }` com `Linha = { os, receitaRealizada, custoComprometido, custoRealizado, custoPago, margemRealizada, margemPct|null }` em centavos; regras: comprometido = pedido emitido + medição aprovada (ou além); realizado = NF de compra / medição com pagamento solicitado; pago = pago_em / medição paga; receita = parcela da NF da obra.
- [ ] TDD (Review Focus 2–3); commit.

### Task 3: Telas
**Files:** `app/obras/obras/[id]/financeiro/` (page com Resumo, Compras, Fornecedores, Faturamento), `_ui/shell.tsx` (item só para quem pode ver), botão Pedir material (obra + restrição Material em `[id]/lookahead`), vínculo restrição↔pedido (actions + selo "Pronta para liberar"; textos de portal/semanal usam as datas do pedido quando houver), Configurações: obra mãe (admin).
- [ ] Testes; build; commit.

Ordem: T1 ‖ T2 → T3.
