# OBRAS — Leva 1b (ajustes da reunião de 31/10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Gabriel consegue montar e salvar a base de Macaé 3 amanhã (editar estrutura do cronograma, tabela × Gantt, datas na revisão) e o diário fica sem os atritos apontados na reunião.

**Architecture:** mesmas telas da Leva 1 (`app/obras/obras/[id]/cronograma`, `[id]/diario`, `[id]/impedimentos`, `_lib/*`); um SQL pequeno para ordem das atividades/etapas.

**Tech Stack:** Next 16, React 19, Tailwind v4 (tema Manfac claro), supabase-js, Jest.

**Spec / fonte:** pedido literal `docs/cliente/2026-10-31-obras-anotacoes-reuniao-validacao-leva1.md` (itens 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12) + respostas do José no chat (31/10): "pra amanha basta conseguir editar e salvar" (criar obra do zero, item 15 completo, fica depois); itens 5, 13, 14 fora desta leva. Specs anteriores: `docs/superpowers/specs/2026-10-30-obras-leva1-cronograma-design.md`.

## Global Constraints
- Branch `feat/obras-leva1b` a partir do master. Commits pt-BR com trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_016Ez3NvioE1ovgGcWcXyBNg`; `git add` por caminho, nunca `-A`.
- SQL só em arquivo novo `sdd-sql-obras-leva1b.sql` (idempotente, seção 0, verificação; testes de erro esperado em `do $$…exception…$$`). **Nenhum agente executa SQL.** SQLs anteriores aplicados não se editam.
- `exec` (`obras_atividade_exec`) e histórico são ligados por `(obra_id, numero)`: **o `numero` de uma atividade nunca muda** depois de criado (é a identidade). Ordem de exibição e código "etapa.posição" vêm de colunas de ordem, não do `numero`.
- Versão salva é imutável (banco já garante); edição de estrutura só em rascunho (base v1 antes de salvar, ou revisão).
- Guardas: engenheiro da obra ou admin; falha fechada. Tema Manfac, toque ≥44px, sem emoji, contraste 4.5:1.

## Review Focus
1. Reordenar/renomear etapa ou adicionar atividade numa revisão não pode quebrar o vínculo com o % já executado (exec por `numero`). Teste na Task 3.
2. Criar revisão deve abrir/editar o rascunho novo, não a versão anterior travada. Teste na Task 2.
3. "Validar e enviar" com alterações não salvas no rascunho envia exatamente o que está na tela. Teste na Task 4.
4. Atividade incluída à mão no diário (antecipada) vale como avanço normal (trava respeitada). Teste na Task 4.
5. Excluir atividade com sucessoras ou com avanço executado é recusado com mensagem clara. Teste na Task 3.

---

### Task 1: SQL — ordem de etapas e atividades
**Files:** Create `sdd-sql-obras-leva1b.sql`, `docs/obras/2026-10-31-verificacao-obras-leva1b.sql`.
- `obras_atividade.ordem int` (posição global de exibição dentro da versão) e `obras_atividade.etapa_ordem int` (posição da etapa). Backfill: `ordem = numero`; `etapa_ordem` = posição da etapa pela primeira aparição (menor `numero`) dentro de cada versão. Backfill só em versões em rascunho e salvas? → **todas** (só metadado de exibição; o trigger de imutabilidade bloqueia UPDATE em versão salva com JWT/sem JWT? ele bloqueia sempre — então o backfill desabilita o trigger `obras_atividade_imutavel` só durante o UPDATE de backfill, dentro da transação, e reabilita; documentar no arquivo; verificação confere que o trigger voltou habilitado).
- `obras_rdo.sem_impedimento boolean not null default false` (item 7 do diário); recriar `obras_rdo_estado()` incluindo a coluna no `row()` de conteúdo imutável (partir da definição atual de produção em `sdd-sql-obras-leva1.sql`, só acrescentando a coluna).
- `criarRevisao` copiará `ordem`/`etapa_ordem` (código, Task 3).
- [ ] Escrever SQL + verificação; commit.

### Task 2: Datas não gravam na revisão (debug)
**Files:** `app/obras/obras/[id]/cronograma/*` (page.tsx, _tela.tsx, _barra-ferramentas.tsx, _actions.ts).
- Evidência no banco (31/10): OBRA TESTE v2–v4 salvas sem nenhuma alteração de data/duração (todas 134 dias, 0 início fixo); Macaé v1 rascunho tem 1 início fixo gravado → editar na base funciona, na revisão não. Hipótese do controlador: após "Nova revisão" a tela segue com `?v=<anterior>` (versão travada) ou não navega para o rascunho. Usar superpowers:systematic-debugging; corrigir a causa; após criar revisão, a tela vai para o rascunho e mostra aviso claro "Editando v5 (rascunho)".
- [ ] Teste que falha reproduzindo; correção; teste passa; commit.

### Task 3: Estrutura do cronograma + visão Tabela
**Files:** `cronograma/_actions.ts`, `_tipos.ts`, `_arvore.tsx`, new `_tabela-edicao.tsx`, `_barra-ferramentas.tsx`, `_tela.tsx`, `_lib/leitura.ts` (ler `ordem`/`etapa_ordem`, ordenar por elas), `_lib/cronograma.ts` só se a ordenação precisar; tests.
- Actions (rascunho, engenheiro/admin): `adicionarEtapaAction(obraId, versaoId, nome)` (vazia até ter atividade: cria junto a 1ª atividade "Nova atividade"); `renomearEtapaAction(obraId, versaoId, nomeAtual, nomeNovo)`; `moverEtapaAction(obraId, versaoId, nome, direcao: 'cima'|'baixo')`; `adicionarAtividadeAction(obraId, versaoId, etapa, dados: { descricao, duracao, pred1, pred2, inicioFixo? })` → `numero = max(numero da obra em todas as versões)+1`, `ordem` no fim da etapa, cria `obras_atividade_exec` 'nao_iniciado' se não existir; `moverAtividadeAction(obraId, versaoId, numero, direcao)` (dentro da etapa) e mudar de etapa via edição do campo etapa; `excluirAtividadeAction(obraId, versaoId, numero)` — recusa se alguma atividade da versão a tem como predecessora (`'A atividade 7 depende dela'`) ou se exec tem % > 0/status ≠ nao_iniciado; `criarRevisaoAction` copia `ordem`/`etapa_ordem`.
- Código exibido "etapa.posição" (ex.: 1.2) calculado na leitura; predecessora escolhida numa lista "1.2 – Pontos de acompanhamento…" (grava o `numero`).
- UI: na árvore em rascunho — botão "+ Etapa", por etapa "Renomear", "↑/↓", "+ Atividade"; por atividade "↑/↓", "Excluir". Arrastar com o mouse é opcional (só se ficar simples; senão ↑/↓ — registrar).
- **Visão Tabela** (alternador Tabela | Gantt na barra; padrão Tabela quando a versão é rascunho): grade com código, etapa, atividade, dias úteis, início, fim, pred. 1, pred. 2 (lista), trava; edição célula a célula com Tab/Enter; usa as mesmas actions (`salvarLinhaRascunhoAction`, `definirInicioAction`, `definirFimAction`).
- [ ] Testes: renomear/mover etapa mantém `numero` e exec; adicionar atividade gera numero novo e exec; excluir com sucessora recusa; revisão copia ordem. TDD; commit.

### Task 4: Diário — atritos da reunião
**Files:** `app/obras/obras/[id]/diario/*`, `[id]/impedimentos/_actions.ts`, `_lib/email-diario.ts`; tests.
- (6/11) No passo "O que andou": botão "Incluir outra atividade" abre a lista de todas as atividades da versão vigente (agrupadas por etapa, busca por texto), exceto concluídas; a incluída entra com `de` = % atual; trava respeitada.
- (7) Passo Impedimentos: opção "Sem impedimentos hoje" que marca o passo como completo (check verde); registrar impedimento desmarca. Persistir no RDO (coluna? → **sem SQL**: guardar como flag no estado do formulário e considerar o passo completo quando há impedimento registrado no dia OU o flag marcado; o flag vai no rascunho — usar campo existente se houver; senão incluir `sem_impedimento boolean` no SQL da Task 1 e no `row()` da máquina de estados — ruling do controlador: incluir no SQL da Task 1).
- (8) Trocar a data do diário navega sozinho (onChange), sem botão "Ir".
- (9) Encerrar impedimento: a data de encerramento padrão = data do diário/hoje e a validação compara com `aberto_em` corretamente (investigar: provável comparação de string/timezone ou uso da data errada); mensagem clara.
- (10) "Validar e enviar" salva antes o estado atual do formulário (mesma action do rascunho) e só então valida/envia; nunca envia dados velhos.
- (12) Atividade marcada como "não andou" (com causa) aparece no e-mail (bloco "Não avançou hoje" com causa e responsável, lado cliente sem causas internas Manfac detalhadas).
- [ ] TDD por item; commit por item.
