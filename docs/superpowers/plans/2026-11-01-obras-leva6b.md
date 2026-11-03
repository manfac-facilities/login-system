# OBRAS — Leva 6b (planta de faseamento) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** fases da obra com prancha A3 (camadas sobre a planta, regras, carimbo), revisões congeladas, PDF, envio registrado em Comunicação e leitura no portal.

**Spec:** `docs/superpowers/specs/2026-11-01-obras-leva6b-faseamento-design.md`. Mockup: https://claude.ai/artifact/BrpPaGa3saBmavP5drqDvv.

**Base:** worktree `C:\Users\jguil\claude\wt-obras-6b`, branch `feat/obras-leva6b-faseamento` (de origin/master c19d7ee). **Trabalhe só nesse diretório.** Outra branch (`feat/obras-leva6b-pdf`) mexe em `mapa/montar/`, `package.json` e `docs/DIVIDAS.md` em paralelo: não toque em `mapa/montar/`; em DIVIDAS/rules só acrescente no fim.

## Global Constraints
- Leia `AGENTS.md`, `.claude/rules/obras.md`, `.claude/rules/sql.md`; Next 16 (ler `node_modules/next/dist/docs/` para APIs que usar).
- SQL só em `sdd-sql-obras-leva6b.sql` + `docs/obras/2026-11-01-verificacao-obras-leva6b.sql` (padrão das levas: seção 0 exige leva6; JWT simulado; `do $$`; t/f; `RESUMO: n/N OK` + raise P0001 rollback; testar em PGlite local como as levas anteriores). **Nenhum agente executa SQL de escrita em produção**; SELECT de catálogo em `iyytcavcgukfjnjjrerx` permitido.
- Coordenadas relativas 0–1; PDF com `@react-pdf/renderer` (sem dependência nova).
- Tema claro Manfac (`.obra-tema`, `--obra-*`, `.obra-num`), toque ≥ 44px, sem emoji; cliente nunca vê rascunho.
- Commits pt-BR com trailer (`Co-Authored-By: <modelo> <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_016Ez3NvioE1ovgGcWcXyBNg`); `git add` por caminho; nunca commitar `AGENTS.md`; push só da branch. Identidade se faltar: `-c user.name="Jose Guilherme" -c user.email="jose.guilherme@manfac.com.br"`.

## Review Focus
1. Coordenador com `coordenador_email` NULL/vazio, ou e-mail diferente, não escreve fase/revisão (falha fechada). Teste na Task 1.
2. Revisão emitida não muda (camadas, regras, carimbo, status) e não volta a rascunho; envio `faseamento` só aponta revisão emitida da mesma obra. Teste na Task 1.
3. Portal: rascunho nunca aparece, nem pela rota de PDF com id adivinhado. Teste na Task 4.
4. Camadas inválidas (fora de 0–1, tipo desconhecido, > 300) recusadas na action e no banco. Testes nas Tasks 1–2.
5. Obra sem planta: editor e PDF funcionam em quadro branco com aviso. Teste na Task 3.

---

### Task 1: SQL
Conforme spec §3 (coluna, função, tabelas, guardas, RLS, envio), verificação cobrindo Review Focus 1, 2 e 4.
- [ ] SQL + verificação (PGlite) ; commit.

### Task 2: Regras puras + PDF
`app/obras/obras/[id]/faseamento/_lib/` (TDD): schema zod das camadas/regras/carimbo, `legendaDe(camadas)`, `textoDaTrava(snapshot)`, e o componente react-pdf da prancha A3 (planta à esquerda, coluna à direita com título, legenda, regras, status da trava, carimbo), com teste de render (texto presente) no padrão dos pdf-route existentes.
- [ ] TDD; commit.

### Task 3: Telas internas
`[id]/faseamento/` (lista de fases, editor de camadas SVG como no mockup — selecionar/mover/criar/apagar/ocultar —, aba Prancha com regras e carimbo, Emitir, Nova revisão, Gerar PDF, Enviar), rota PDF, permissão `_permissao.ts` igual ao banco (engenheiro/admin/coordenador), actions com guardas, item Faseamento na sidebar (só acrescentar), campo Coordenador em Dados da obra (só admin), envio `faseamento` na Comunicação (destinatários do tipo `fase`) e na linha do tempo. Testes de actions e componentes; build.
- [ ] telas + actions + testes; build; commit.

### Task 4: Portal do cliente
Seção Faseamento na aba Mapa do portal + rota de PDF do portal: só última revisão emitida por fase, filtrada pela sessão do portal como as outras páginas. Testes (Review Focus 3).
- [ ] tela + testes; build; commit.

Ordem: T1 ‖ T2 → T3 → T4.
