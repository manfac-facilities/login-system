# Dívidas da ficha (A1, A13, B5, B7) — Plano de implementação

> **Para agentes:** use `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans`, tarefa por tarefa. Checkbox (`- [ ]`) por passo.
> **TDD em toda tarefa:** teste primeiro, roda e **falha pelo motivo certo**; depois o código; teste
> passa; commit.

**Spec:** `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-dividas-ficha-2026-09-23.md`. Regra,
texto de tela e `arquivo:linha` vêm de lá. Se a spec e o código divergirem, **pare e pergunte**.

**Pré-requisitos para começar:**
1. `feat/cancelamento-obra` mergeada no master. A branch desta entrega sai do master **depois** do
   merge (os `arquivo:linha` da spec são dessa base; confira com `git log` antes da T1).
2. O João aprovou os três textos do §0 da spec e a régua de ano do §4.4. Sem isso, **não disparar**
   T4 nem T6 (são as que escrevem texto de tela); T1, T2 e T3 podem andar.

**Sem SQL.** Nenhuma tarefa aplica SQL nem acessa o banco. Supabase mockado nos testes.

**Stack:** Next.js (ler `node_modules/next/dist/docs/` antes de mexer em Server Action), Jest
(next/jest, SWC — **não checa tipo**: `npx tsc --noEmit` depois de cada tarefa), React Testing Library
+ `userEvent`.

## Restrições globais

- **`_actions.ts` é `'use server'`: só exporta funções `async`.** Nenhum `export type`/`export const`
  novo lá (armadilha 1 de `.claude/rules/obras.md`). Mensagens novas = `const` **não exportada** no
  topo do arquivo, como `CANCELADA_SO_LEITURA` (`_actions.ts:63`).
- Toda recusa **antes** de qualquer escrita. Uma gravação = **uma** chamada de RPC.
- Menor mudança. Nada de tratamento de erro além do que a spec lista. Borda nova → anote para a T7,
  não trate.
- Caminhos com `[id]` no jest: regex com `.id.` (ex.:
  `npx jest "app/obras/obra/.id./__tests__/_actions.test"`).
- Depois de cada tarefa: teste da tarefa verde, testes antigos do mesmo arquivo verdes,
  `npx tsc --noEmit` sem erro novo.
- Um commit por tarefa, `fix(obras): ...` / `test(obras): ...`, terminando com
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. **Não pushar.**

## Paralelismo

Critério: duas tarefas só andam juntas se não tocam o mesmo arquivo (código **nem** teste). As quatro
dívidas passam por `_actions.ts`, então o servidor é uma fila (T2 → T3 → T4 → T5), com a parte pura
e a tela ao lado.

| Onda | Tarefas (paralelas dentro da onda) | Depende de |
|---|---|---|
| 1 | **T1** (versão do bloco, pura), **T2** (A13) | — |
| 2 | **T3** (B5), **T6** (A1 tela) | T3 ← T2 (`_actions.ts`); T6 ← T1 |
| 3 | **T4** (B7) | T4 ← T3 (`_actions.ts`), T2 (`ficha.test.ts`) |
| 4 | **T5** (A1 servidor) | T5 ← T4 (`_actions.ts`), T3 (`ficha-editavel.test.ts`), T1, **T6** (o tipo da prop `salvar` precisa aceitar o 3º argumento antes de a action exigi-lo, senão o `tsc` quebra) |
| 5 | **T7** (docs), depois **T8** (revisão independente) | todas |
| 6 | **T9** (teste manual em produção) | deploy, feito pelo João |

| Tarefa | Arquivos |
|---|---|
| T1 | `app/obras/_lib/ficha-campos.ts`, `app/obras/__tests__/ficha-campos.test.ts` |
| T2 | `app/obras/obra/[id]/_actions.ts`, `app/obras/obra/[id]/__tests__/_actions.test.ts`, `app/obras/__tests__/ficha.test.ts` |
| T3 | `app/obras/obra/[id]/_actions.ts`, `app/obras/__tests__/ficha-editavel.test.ts` |
| T4 | `app/obras/obra/[id]/_actions.ts`, `app/obras/__tests__/ficha.test.ts` |
| T5 | `app/obras/obra/[id]/_actions.ts`, `app/obras/__tests__/ficha-editavel.test.ts` |
| T6 | `_bloco-autorizacao.tsx`, `_bloco-identificacao.tsx`, `_bloco-cronograma.tsx`, `_ficha.tsx` (todos em `app/obras/obra/[id]/`), `app/obras/obra/[id]/__tests__/_blocos-editaveis.test.tsx` |
| T7 | `docs/DIVIDAS.md`, `.claude/rules/obras.md` (seção "Estado") |

Modelos sugeridos: T1–T6 **sonnet** (mecânicas, spec fechada); T8 **opus** (revisão em território de
dado de cliente); T7 **haiku**.

---

## T1 — `versaoDoBloco` (A1, parte pura)

**Arquivos:** `app/obras/_lib/ficha-campos.ts`, `app/obras/__tests__/ficha-campos.test.ts`.
**Spec:** §5.3.

- [ ] **Teste primeiro**, em `ficha-campos.test.ts`, `describe('versaoDoBloco')`:
  - mesma linha → mesma string, para os três blocos;
  - mudar **uma** coluna do bloco muda a versão — um caso por coluna da tabela do §5.3 (13 casos,
    `it.each`);
  - mudar coluna de **fora** do bloco não muda: para Autorização, `equipe`, `etapa`, `pendencia`,
    `nao_andou_seguidos`, `updated_at`; para Cronograma, `origem`, `aprovacao`;
  - `undefined` e `null` na mesma coluna dão a mesma versão;
  - `valor: 18450` ≠ `valor: 18450.5`; `mau_uso: false` ≠ `mau_uso: true`;
  - `versaoDoBloco(derivar(linha, HOJE), b) === versaoDoBloco(linha, b)` para os três blocos (importar
    `derivar` de `../_lib/tipos`).
- [ ] Rodar `npx jest app/obras/__tests__/ficha-campos.test` → falha (função não existe).
- [ ] Implementar em `ficha-campos.ts`, perto dos tipos de rascunho (seção 3): tipo
  `BlocoVersionado = 'Autorização' | 'Identificação' | 'Cronograma'`, mapa bloco → colunas, e
  `export function versaoDoBloco(obra: Partial<ObraRow>, bloco: BlocoVersionado): string` =
  `JSON.stringify(colunas.map((c) => obra[c] ?? null))`. Import de tipo de `./tipos`. Comentário
  curto dizendo **por que não `updated_at`** (spec §5.2).
- [ ] Teste verde; `npx tsc --noEmit`.
- [ ] Commit: `feat(obras): versao por bloco da ficha para detectar edicao concorrente (A1)`.

## T2 — A13: troca de etapa numa chamada só

**Arquivos:** `_actions.ts`, `__tests__/_actions.test.ts` (em `obra/[id]`), `app/obras/__tests__/ficha.test.ts`.
**Spec:** §2.

- [ ] **Testes primeiro.** Em `obra/[id]/__tests__/_actions.test.ts`:
  - troca `andamento → relatorio`: `updateMock` **não** chamado; `rpcMock` chamado **uma** vez com
    `obras_aplicar_alteracao`; `p_campos` tem `etapa: 'relatorio'`, `desde_etapa: HOJE`,
    `atualizacao: HOJE`, `etapa_por: EMAIL`, `etapa_em` (string), `marco_exec_fim: HOJE`;
    `p_linhas[0]` = `{ bloco: 'Esteira', campo: 'etapa', de: 'Em andamento', para: 'Relatório de entrega' }`,
    seguida das linhas dos marcos;
  - trocar para a **mesma** etapa com marcos coerentes: `p_campos` **sem** `etapa`, com
    `desde_etapa: HOJE`; `p_linhas` vazio; sucesso;
  - trocar para a mesma etapa com marcos incoerentes: reconcilia na mesma chamada, sem linha de etapa;
  - erro da RPC → `{ error: 'Erro ao mudar a etapa da obra' }`; a mensagem
    `'A etapa mudou, mas houve erro…'` não existe mais em lugar nenhum (buscar no arquivo);
  - Fechar OS → Pendente faturamento com data: `desde_etapa` e `marco_fechou_os` = a data, **na mesma
    chamada**.
  - **Reescrever** os testes que leem `objetoDoUpdate()` / `updateMock` para ler `camposMarco()`
    (renomear para `camposDaChamada()` se ajudar). O teste "erro do update da etapa… sem tentar gravar
    marcos" (`:305`) vira "erro da RPC não grava nada".
  - Em `app/obras/__tests__/ficha.test.ts` (`describe('mudarEtapaAction')`, `:90-151`): acrescentar
    `rpc` ao mock do cliente; "grava a etapa e RECOMEÇA o contador" passa a olhar o `p_campos` da RPC;
    **apagar** "sobrevive à ausência das colunas de autoria" (o refazer sai); "banco recusa" passa a
    simular erro da RPC.
- [ ] Rodar os dois arquivos → falham pelo motivo certo (ainda há `update`).
- [ ] Implementar em `mudarEtapaAction` (`_actions.ts:399-446`) conforme spec §2.2. Remover
  `colunaInexistente` e o comentário acima dela (`:237-252`). Reescrever o comentário longo de
  `:420-430` e o trecho de `calcularMarcosDaEsteira` (`:292-298`) que falam de "escrita SEPARADA" —
  dizer que a troca é atômica desde 23/09 (A13) e que o cálculo por estado final continua valendo para
  qualquer estado herdado.
- [ ] Verde nos dois arquivos + `npx jest "app/obras/obra/.id./__tests__/_etapa"` (o "Tentar de novo"
  não pode quebrar); `npx tsc --noEmit`.
- [ ] Commit: `fix(obras): troca de etapa grava etapa e marcos numa transacao so (A13, A16)`.

## T3 — B5: auto-avanço da Autorização carimba os marcos

**Arquivos:** `_actions.ts`, `app/obras/__tests__/ficha-editavel.test.ts`. **Spec:** §3.
**Depende de:** T2 (mesmo arquivo).

- [ ] **Testes primeiro**, no `describe('salvarAutorizacaoAction')` (`:257`):
  - obra em `aprovarOS`, sem aprovação, `marco_exec_fim` e `marco_relatorio` nulos, ganhando
    aprovação: **uma** chamada de RPC; `p_campos` tem `etapa: 'fecharOS'`, `marco_exec_fim: HOJE`,
    `marco_relatorio: HOJE`, e o trio da aprovação; `p_linhas` tem as linhas `Autorização` (incl.
    `etapa`) **seguidas** de duas linhas `Esteira` (`marco_exec_fim`, `marco_relatorio`); resultado
    `{ success: true, avancou: true }`;
  - mesma obra com os dois marcos já preenchidos: nenhum marco em `p_campos`, nenhuma linha `Esteira`
    (datas nunca sobrescritas);
  - obra em `aprovarOS` com `marco_fechou_os` preenchido (estado incoerente): vira `null` com linha
    `Esteira`;
  - **sem** avanço (só corrigir a data de uma obra já aprovada, ou obra em outra etapa): nenhum marco,
    nenhuma linha `Esteira` — igual a hoje;
  - `marco_os_aprov` continua vindo só pelo trio (conferir que não aparece linha `marco_os_aprov`).
- [ ] Rodar → falham (marcos ausentes).
- [ ] Implementar no bloco `if (avancou)` de `salvarAutorizacaoAction` (`_actions.ts:779-798`)
  conforme spec §3.3, reusando `calcularMarcosDaEsteira` sem mudar a assinatura dela. Atualizar o
  comentário de `PASSOS_MARCO` (`:266-273`) se ele disser que só `mudarEtapaAction` carimba.
- [ ] Verde no arquivo inteiro; `npx tsc --noEmit`.
- [ ] Commit: `fix(obras): avanco automatico da autorizacao carimba os marcos da esteira (B5)`.

## T4 — B7: datas da liberação validadas no servidor

**Arquivos:** `_actions.ts`, `app/obras/__tests__/ficha.test.ts`. **Spec:** §4.
**Depende de:** T3 (`_actions.ts`), T2 (`ficha.test.ts`), texto do §4.3 aprovado.

- [ ] **Testes primeiro**, no `describe('liberarObraAction')` (`ficha.test.ts:152`), todos sem
  `update` chamado:
  - `inicio: '2026-02-31'` → `{ error: 'Data de início inválida. Confira o dia, o mês e o ano.' }`;
  - `inicio: '20266-01-01'` e `inicio: '0226-09-01'` → a mesma mensagem;
  - `libEm: '2026-13-01'` (com `libPor`) → `{ error: 'Data inválida.' }`;
  - `libEm` preenchida sem `libPor` → a mensagem "Tem data da liberação sem nome…" de `validarAutorizacao`;
  - `aprovadaEm: '2026-02-30'` → `'Data inválida.'`;
  - `duracao: '12abc'` → a mensagem de duração;
  - regressão: prioridade inválida e duração 0/181 continuam com as mensagens de hoje; liberação
    válida continua gravando igual (o teste de sucesso que já existe);
  - origem fora de `ORIGENS` **continua aceita** (a liberação não valida origem — spec §4.2).
- [ ] Rodar → falham (servidor aceita).
- [ ] Implementar em `liberarObraAction` (`_actions.ts:654-658`) conforme spec §4.2–4.3: importar
  `validarCronograma`; substituir as duas linhas de prioridade/duração pela chamada; mapear só o erro
  de `inicio` para a mensagem aprovada; checar `libEm`/`aprovadaEm` com `validarAutorizacao` usando
  só essas duas chaves. Constante `INICIO_INVALIDO` não exportada.
- [ ] Verde; `npx tsc --noEmit`.
- [ ] Commit: `fix(obras): liberacao da triagem valida as datas no servidor (B7)`.

## T5 — A1: servidor recusa edição concorrente

**Arquivos:** `_actions.ts`, `app/obras/__tests__/ficha-editavel.test.ts`. **Spec:** §5.3–5.4.
**Depende de:** T1, T3, T4, T6; texto do §5.4 aprovado.

- [ ] **Testes primeiro**, em `ficha-editavel.test.ts`:
  - helper `versao(obra, bloco)` = `versaoDoBloco(...)` da obra do mock; **todas** as chamadas
    existentes de `salvarAutorizacaoAction`/`salvarIdentificacaoAction`/`salvarCronogramaAction`
    passam a mandar a versão da obra do mock como 3º argumento (são ~46; os testes antigos têm que
    continuar verdes sem mudar o que afirmam);
  - para cada um dos três blocos: versão igual → grava; versão de outra linha (uma coluna do bloco
    diferente) → `{ error: 'Outra pessoa alterou esta obra enquanto você editava. Recarregue a página para ver o que foi gravado e refaça a sua alteração.' }`
    e `rpcMock` **não** chamado; versão `undefined` → a mesma recusa;
  - mudança só em coluna de fora do bloco (ex.: obra do banco com `pendencia`/`equipe` diferente, na
    Autorização) → grava;
  - Cronograma com remarcação e versão errada: recusa **antes** de ler `obras_motivo_remarcacao` e
    antes de `obras_remarcar_inicio`;
  - obra cancelada com versão errada → a mensagem de cancelada (a recusa de cancelada vem primeiro);
  - R1 (acesso) continua primeiro: sem acesso e versão errada → `'Sem acesso ao Controle de Obras'`.
- [ ] Rodar → falham.
- [ ] Implementar: `const CONFLITO_EDICAO = '…'` (texto aprovado) no topo; 3º parâmetro
  `versao: string` nas três actions; a checagem logo depois de `if (cancelada(obra))`
  (`_actions.ts:767`, `:822`, `:887`). Importar `versaoDoBloco`.
- [ ] Verde em `ficha-editavel.test.ts` e nos testes de tela (`_blocos-editaveis`, `_ficha`);
  `npx tsc --noEmit` — agora o `_ficha.tsx` da T6 tem que casar com a assinatura nova.
- [ ] Commit: `fix(obras): blocos da ficha recusam gravacao sobre edicao de outra pessoa (A1)`.

## T6 — A1: blocos capturam e devolvem a versão

**Arquivos:** `_bloco-autorizacao.tsx`, `_bloco-identificacao.tsx`, `_bloco-cronograma.tsx`,
`_ficha.tsx`, `__tests__/_blocos-editaveis.test.tsx` (todos em `app/obras/obra/[id]/`).
**Spec:** §5.3 passos 1–2. **Depende de:** T1.

- [ ] **Testes primeiro**, em `_blocos-editaveis.test.tsx`, para cada bloco:
  - render com `versao="v1"`, clicar **Editar**, mudar um campo, **Salvar** → `salvar` chamado com
    `(obraId, rascunho, 'v1')`;
  - render com `versao="v1"`, **Editar**, `rerender` com `versao="v2"` (página revalidada durante a
    edição), **Salvar** → ainda `'v1'`;
  - Cancelar, `rerender` com `'v2'`, **Editar** de novo, **Salvar** → `'v2'`;
  - Cronograma: o caminho que passa pela janela de remarcação também manda a versão capturada;
  - erro devolvido por `salvar` aparece na caixa de erro e o bloco continua em edição (regressão R21,
    com a mensagem de conflito como exemplo).
  - Ajustar os renders existentes para passar `versao` (prop obrigatória).
- [ ] Rodar → falham.
- [ ] Implementar: prop `versao: string` em cada bloco; `const [versaoLida, setVersaoLida] = useState(versao)`;
  `setVersaoLida(versao)` dentro de `editar()`; `salvar(obraId, dados, versaoLida)`. Tipos
  `SalvarAutorizacao`/`SalvarIdentificacao`/`SalvarCronograma` ganham `versao: string` como 3º
  parâmetro. Em `_ficha.tsx` (`:750-803`), `versao={versaoDoBloco(obra, '<bloco>')}` nos três.
  **Não** mexer em `_bloco-editavel.tsx` (a caixa de erro já tem o texto certo).
- [ ] Verde; `npx jest "app/obras/obra/.id./__tests__/_ficha"`; `npx tsc --noEmit` (passa antes da
  T5: função com menos parâmetros é atribuível ao tipo com mais).
- [ ] Commit: `feat(obras): blocos da ficha devolvem a versao lida ao salvar (A1)`.

## T7 — Documentação

**Arquivos:** `docs/DIVIDAS.md`, `.claude/rules/obras.md`.

- [ ] `DIVIDAS.md`: marcar **A1, A13, A16, B5, B7** como `✅ Corrigido em <data>` no padrão da B1
  (texto antigo riscado, correção com commit). Na A13, registrar que a premissa "exigiria estender a
  RPC" estava errada (spec §0).
- [ ] Acrescentar as 5 linhas do §7 da spec (próximos números livres: **A31–A35**), no formato da
  tabela (A): o que, onde, quando, por que, consequência.
- [ ] Anotar as bordas que os executores das T1–T6 tiverem mandado para cá.
- [ ] `.claude/rules/obras.md`, "Estado": uma linha dizendo que a troca de etapa passou a ser atômica
  e a ficha detecta edição concorrente (sem data de deploy — quem deploya atualiza).
- [ ] Commit: `docs(obras): dividas A1, A13, A16, B5, B7 fechadas; bordas novas registradas`.

## T8 — Revisão independente

Agente **diferente** dos que implementaram, `superpowers:requesting-code-review`, contra a spec.
Foco: nenhuma escrita antes de recusa; uma chamada de RPC por gravação; `etapa` nunca em `p_campos`
sem linha; nenhum `export` não-async em `_actions.ts`; versão capturada no Editar. Régua: bloqueia só
dano de dado alcançável; o resto vai para `DIVIDAS.md`.

- [ ] `npm test` (as 7 suítes do `manfac-site/` falham por resolução de módulo e não contam),
  `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## T9 — Teste manual em produção (depois do deploy, com o João)

Obra de teste, dois navegadores logados com pessoas diferentes.

- [ ] **A1:** os dois abrem **Editar** no Cronograma; A salva; B salva → B vê a mensagem aprovada,
  nada gravado, o Histórico mostra só a gravação de A. Repetir com A na Autorização e B na
  Identificação → **as duas gravam** (blocos diferentes não conflitam).
- [ ] **A13:** trocar a etapa pelo seletor → Histórico mostra "Esteira · Etapa: A → B" e os marcos
  na mesma hora.
- [ ] **B5:** obra em "Executado - pendente aprovação OS" → preencher "OS aprovada em" → vai para
  Fechar OS, marcos anteriores com data.
- [ ] **B7:** Triagem com Data de início `31/02` (se o navegador deixar) ou ano de 5 dígitos →
  mensagem aprovada, obra continua em Aguardando definição.

---

## Estimativa

| Tarefa | Horas |
|---|---|
| T1 | 0,5 |
| T2 | 1,5 |
| T3 | 1 |
| T4 | 1 |
| T5 | 1,5 |
| T6 | 1,5 |
| T7 + T8 | 1,5 |
| T9 | 0,5 |
| **Total** | **~9 h** de agente (dentro das 8–12 h da divisão de 23/09), em ~4 h de relógio com as ondas |
