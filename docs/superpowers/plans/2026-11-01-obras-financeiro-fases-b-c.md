# OBRAS — Financeiro Fases B e C (sem PEF) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** custo de obra (OBRAS e SPOT) nasce com obra/OS; a obra tem valor receita, organograma, medições ao cliente e locações; a aba Financeiro mostra avanço × liberado × faturado, pendências e margem.

**Spec:** `docs/superpowers/specs/2026-11-01-obras-financeiro-fases-b-c-design.md` (leia antes). Mockup: https://claude.ai/artifact/QfSkY6yZk2sW5WxsLCyiR4.

**Repos e worktrees (um por repo, branch `feat/obra-fin-bc`):**
- Hub: `C:\Users\jguil\claude\wt-obras-fin` (branch `feat/obras-financeiro-bc`, base origin/master).
- Financeiro: `C:\Users\jguil\claude\wt-fin-obra-bc` (base origin/main do repo `financeiro`).
- Compras: `C:\Users\jguil\claude\wt-cmp-locacao` (base origin/main do repo `compras`).
- Fornecedores: `C:\Users\jguil\claude\wt-frn-obra` (base origin/main do repo `fornecedores`).

## Global Constraints
- Leia o `AGENTS.md`/`CLAUDE.md`/`README` do repo em que trabalha antes de escrever código; regras de instalação de SQL de cada repo valem (Financeiro: `supabase/hub-install/NNN_*.sql`, teste `hub-install-safety`, sem FK para `obras_*`, escrita só por funções `fin_*` com service_role, sem `do`/`execute`).
- **Nenhum agente executa SQL de escrita.** SELECT de catálogo para conferir colunas é permitido (projeto `iyytcavcgukfjnjjrerx`). SQL escrito com Write/Edit, nunca heredoc sem aspas; procure `$` solto antes de commitar.
- Hub: SQL em `sdd-sql-obras-financeiro-bc.sql` + `docs/obras/2026-11-01-verificacao-obras-financeiro-bc.sql` (padrão das levas: seção 0 exige o SQL da Fase A **e** o do Financeiro aplicados; JWT simulado; `do $$`; t/f; termina com `RESUMO: n/N OK` + raise P0001 para rollback).
- Dinheiro em centavos inteiros; percentual com 2 casas; formatação BRL só na tela. Valores só para `obras_pode_ver_valores` (hub) / papel financeiro-diretor (Financeiro). Cliente nunca vê R$.
- Categorias fixas: lista exata do spec §2.6, casada por descrição normalizada (minúsculas, sem acento, espaços colapsados).
- Commits pt-BR com trailer `Co-Authored-By: <modelo> <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_016Ez3NvioE1ovgGcWcXyBNg`; `git add` por caminho; nunca commitar `AGENTS.md`. Push só da branch de feature; nunca no main/master.
- Hub: tema claro Manfac (`.obra-tema`, tokens `--obra-*`), toque ≥ 44px, sem emoji; `<a>` (não `<Link>`) para Compras/Financeiro/Fornecedores, `target="_blank" rel="noopener noreferrer"`.

## Review Focus
1. Solicitação com CC OBRAS/SPOT e categoria variável **sem obra** é recusada no servidor (não só na tela); categoria fixa ou CC de manutenção/ADM passa sem obra. Testes na Task 4.
2. Supervisor só vê e completa as **próprias** despesas de caixinha; vínculo de despesa de outro supervisor recusado. Teste na Task 4.
3. Medição ao cliente: soma das liberações de uma OS > 100% recusada; % ↔ valor consistentes ao centavo; só engenheiro da obra/admin grava. Testes nas Tasks 1 e 6.
4. Engenheiro de outra obra não pré-aprova medição de fornecedor; obra sem engenheiro pula a etapa. Teste na Task 3.
5. Aba Financeiro sem valor receita, sem avanço ou sem lançamentos: sem NaN/Infinity, textos "informe o valor receita" / "—". Teste na Task 7.

---

### Task 1: Financeiro — SQL de vínculos (repo financeiro)
Migração `0NN_fin_obra_vinculos.sql` (próximo número livre após o maior em `supabase/hub-install/`): `fin_obra_categorias_fixas` (semeada com a lista do §2.6), `fin_obra_vinculos` (ambiente, obra_id uuid sem FK, os text, origem `solicitacao|caixinha_despesa`, solicitacao_id → fin_solicitacoes, vex_despesa_id, percentual_centesimos, valor_centavos, criado_por/em, desfeito_em; soma por solicitação = 100%), `fin_fat_nota_medicoes` (nota_id → fin_fat_notas, medicao_id uuid sem FK, unique). Funções `fin_*` de gravação (service_role) e helper `fin_obra_exige(cc_descricao, categoria_descricao) returns boolean` (CC contém "OBRAS" ou "SPOT", categoria fora das fixas). RLS no padrão do repo. Testes do repo (incl. `hub-install-safety`) passam.
- [ ] SQL + testes; commit.

### Task 2: Compras — período da locação (repo compras)
Coluna nova em `cmp_solicitacoes` (ex.: `locacao_fim date`) obrigatória quando `tipo='locacao'` (check), migração no padrão do repo; formulário pede "até quando"; `?tipo=locacao` pré-seleciona o tipo junto com `?obra=`. Testes.
- [ ] SQL + tela + testes; commit.

### Task 3: Fornecedores — obra obrigatória e pré-aprovação (repo fornecedores)
Contrato: obra/OS obrigatória quando CC OBRAS/SPOT (servidor e tela). Medição: status novo de pré-aprovação do engenheiro (`obras_obra.engenheiro_email` da obra do contrato) antes da aprovação do Eduardo; sem engenheiro, pula; só esse e-mail (ou admin) pré-aprova. Payload da integração com o Financeiro inclui `obra_id` e `os`. Migração no padrão do repo. Testes.
- [ ] SQL + telas + testes; commit.

### Task 4: Financeiro — telas (repo financeiro) — depende da Task 1
Solicitação de pagamento: seletor Obra/OS (obras `modalidade='obra'` + OS SPOT não arquivadas, lidas de `obras_obra` com service role como `lib/faturamento/obras-pendentes.ts`), regra `fin_obra_exige`, rateio por % ou valor, servidor recusa. Caixinha: tela "Despesas sem obra" (supervisor = dono do relatório no VEX; conferir mapeamento VEX→e-mail em `fin_caixinha_pessoas`/`relatorios`). Faturamento: fila "medições aprovadas sem nota" (lê `obras_medicao_cliente`) e ligar nota ↔ medição. Rota `/api/integracoes/medicoes`: aceita `obra_id`/`os` e grava vínculo. Testes (Review Focus 1–2).
- [ ] telas + rotas + testes; commit.

### Task 5: Hub — SQL (login-system) — depende da Task 1 (tabelas) e 2 (coluna)
`sdd-sql-obras-financeiro-bc.sql`: `obras_cliente_pessoa` (obra_id, nome, cargo, email null, ordem, autoria; só admin grava); `obras_medicao_cliente` (obra_id = OS, numero por OS, periodo_inicio/fim, percentual_centesimos, valor_centavos, avanco_centesimos, situacao `enviada|aprovada|recusada`, enviada_em, aprovada_em, autoria forçada; grava engenheiro da obra (ou da mãe) ou admin; soma das não recusadas ≤ 100%); `obras_locacao_estado` (cmp_pedido_id unique, obra_id, devolvida_em, renovada_ate, autoria); funções de leitura `security definer` novas/estendidas: `obras_fin_vinculos(p_obra)` (pagamentos/rateio e caixinha via `fin_obra_vinculos`), `obras_fin_caixinha_sem_obra(p_obra)` (contagem), `obras_fin_locacoes(p_obra)` (pedidos tipo locação + período), `obras_fin_medicoes_fornecedor_atrasadas(p_obra)`; e `obras_fin_notas` passa a trazer `medicao_id`. Verificação com casos para cada guarda (Review Focus 3).
- [ ] SQL + verificação; commit.

### Task 6: Hub — Dados da obra, medições e locações (UI) — depende da Task 5
Aba **Dados da obra** (`app/obras/obras/[id]/dados/`): valor receita por OS (mãe + filhas, grava `obras_obra.valor`, só admin) e organograma com chips Portal/Diário/Semanal/Mensal que gravam em `obras_portal_acesso`/`obras_destinatario` (remover a lista duplicada das Configurações, mantendo as actions existentes como fonte). **Medições ao cliente** (`[id]/financeiro/medicoes/`): lista + formulário com % ⇄ valor. **Locações** (`[id]/financeiro/locacoes/`): lista + "Nova locação" (abre `/compras/solicitacoes/nova?obra=<id>&tipo=locacao` em nova aba) + marcar devolvida/renovada; aviso 5 dias úteis antes e no vencimento na faixa de alertas da obra. Testes.
- [ ] telas + actions + testes; commit.

### Task 7: Hub — aba Financeiro e margem — depende das Tasks 5–6
`_lib/financeiro-obra.ts` estendido (puro, TDD): receita esperada, liberado, faturado, percentuais sobre a receita, pendências em centavos, custo projetado = comprometido ÷ avanço (avanço 0 → null), margem projetada e realizada, custos por origem (compras, fornecedores, pagamentos/rateio, caixinha, locações) sem dupla contagem (pagamento gerado por medição de fornecedor conta uma vez só). Tela conforme mockup; alertas > 10 dias (medição cliente e fornecedor). Testes (Review Focus 5).
- [ ] TDD + tela; build; commit.

Ordem: T1 ‖ T2 ‖ T3 → T4 ‖ T5 → T6 → T7. Repos diferentes rodam em paralelo.
