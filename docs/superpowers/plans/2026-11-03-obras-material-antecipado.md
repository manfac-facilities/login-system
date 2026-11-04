# OBRAS — Material antecipado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o Obras pergunta a quem acompanha o campo se as próximas atividades precisam de material, o pedido no Compras nasce ligado à restrição e o sistema avisa (painel, Lookahead, e-mail diário interno) quando o prazo de pedir chega ou a compra não chega a tempo.

**Architecture:** regras puras em `app/obras/obras/_lib/material.ts` (TDD) alimentadas por duas leituras novas do banco (prazos do Compras e solicitações ligadas por origem). O Compras ganha a coluna `cmp_solicitacoes.obras_restricao_id` (sem FK, com guarda) e aceita a origem pelo link. Telas reaproveitam o que existe: passo novo no diário, coluna e trilha no Lookahead, `calcularAlertas` e o e-mail diário interno.

**Tech Stack:** Next 16 (App Router, Server Actions), Supabase/Postgres (SQL manual + verificação em PGlite), Jest + Testing Library, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-11-03-obras-material-antecipado-design.md` (ler inteira antes de qualquer task). Mockup: https://claude.ai/artifact/9r58kQdteAMDQigyTufX3f

## Global Constraints
- Ler `AGENTS.md`, `.claude/rules/obras.md`, `.claude/rules/sql.md`; para API do Next, `node_modules/next/dist/docs/`.
- Hub: worktree `C:\Users\jguil\claude\wt-obras-material`, branch `feat/obras-material-antecipado`. Compras: criar worktree `C:\Users\jguil\claude\wt-cmp-material` de `origin/main` do repo `C:\Users\jguil\claude\compras`, branch `feat/obras-restricao-origem`; seguir o `AGENTS.md`/`CLAUDE.md` do Compras.
- **Nenhum agente executa SQL de escrita em produção** (`iyytcavcgukfjnjjrerx`); SELECT de catálogo permitido. SQL só em arquivo.
- Janela = 28 dias; "pedir até" = início − (`folga_processo_dias` + `entrega_material_dias`) dias de expediente do Compras; padrões quando faltar linha: `PADROES` do Compras (`expediente.dias [1,2,3,4,5]`, `folga_processo_dias 4`, `entrega_material_dias 5`). Produção hoje: 3 + 2.
- Cliente nunca vê material/compra; nenhum R$ nas leituras novas. Tema `.obra-tema`, `.obra-num`, toque ≥ 44px, sem emoji.
- Commits pt-BR, `git add` por caminho, trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nunca commitar `AGENTS.md`; push só das branches da feature.

## Review Focus
1. Guarda do Compras: `obras_restricao_id` de outra obra, de tipo ≠ material, inexistente, ou alteração depois de gravada → recusa (Task 2, SQL e teste).
2. Trava do hub: apagar ou trocar o tipo de restrição com solicitação ativa (etapa ∉ cancelada/recusada) → recusa com "Cancele lá antes"; com só canceladas/recusadas → permite (Task 1).
3. Leitura do Compras que falha (`null`) → nenhum aviso de compra e nenhum "parada"/"não chega" falso; lista "Vem aí" continua (Task 3 e Task 5, teste do painel).
4. Atividade de início já passado e `nao_iniciado` entra na lista e nos avisos; concluída ou em andamento nunca (Task 3).
5. Lado cliente do e-mail diário nunca contém "Materiais" nem texto de restrição (Task 5).

---

### Task 1: SQL do hub

**Files:**
- Create: `sdd-sql-obras-material.sql`
- Create: `docs/obras/2026-11-03-verificacao-obras-material.sql`

**Interfaces:**
- Produces (banco):
  - tabela `obras_material_resposta(id uuid pk, obra_id uuid not null → obras_obra on delete cascade, atividade_numero int not null check > 0, criado_por text, criado_em timestamptz)`, `unique(obra_id, atividade_numero)`; trigger força `criado_por` = e-mail do JWT e `criado_em = now()`; RLS select/insert/delete `obras_has_access()`, sem update.
  - `obras_compras_prazos() returns table(prazos jsonb, expediente jsonb)` — security definer, `search_path = pg_catalog, public`, `valor` da linha de maior `vigente_desde` de cada chave em `cmp_configuracoes`; zero linhas sem `obras_has_access()`.
  - `obras_restricao_compras(p_obra uuid) returns table(restricao_id uuid, solicitacao_id uuid, solicitacao_numero bigint, etapa text, enviado_em timestamptz, data_minima date, prazo_necessario date, pedido_id uuid, pedido_sequencia smallint, fornecedor_razao_social text, pedido_situacao text, previsao_entrega date, entrega_situacao text, entrega_em timestamptz)` — mesmo acesso e mesmo `ambiente='producao'` de `obras_restricao_pedidos`; join `obras_restricao r on r.id = s.obras_restricao_id and r.obra_id = p_obra` (id órfão some); left join pedidos. Sem valores.
  - trigger `obras_restricao_compra_ativa_guarda` (before delete; before update of `tipo` quando muda): se existe `cmp_solicitacoes` com `obras_restricao_id = old.id` e `etapa not in ('cancelada','recusada')` → `raise exception 'OBRAS_MATERIAL: Esta restrição tem a solicitação #% no Compras. Cancele lá antes.'` com `errcode 'P0001'`.
- **Dependência de ordem:** a coluna `cmp_solicitacoes.obras_restricao_id` vem do SQL 017 do Compras (Task 2). A função e o trigger referenciam a coluna: a seção 0 do arquivo **exige** que a coluna exista e aborta se faltar. Deploy: Compras 017 → este arquivo (atualizar a ordem no §7 da spec e nas regras na Task 6).

- [ ] **Step 1:** Escrever a verificação primeiro (padrão de `docs/obras/2026-11-01-verificacao-obras-leva6b.sql`: seção 0 pré-requisitos, JWT simulado, `do $$`, `RESUMO: n/N OK`, `raise P0001` + rollback). Casos mínimos: resposta duplicada recusada; usuário sem acesso Obras não lê `obras_compras_prazos` nem `obras_restricao_compras`; leitura devolve solicitação ligada com pedido e sem pedido; id órfão não aparece; apagar restrição com solicitação em cotação → erro com o número; trocar tipo idem; com só solicitação cancelada → apaga.
- [ ] **Step 2:** Rodar no PGlite local (como as levas anteriores; o stub precisa criar `cmp_configuracoes`, `cmp_solicitacoes` com a coluna nova e `cmp_pedidos`). Esperado: falha (objetos não existem).
- [ ] **Step 3:** Escrever `sdd-sql-obras-material.sql` (idempotente; revoke de `public, anon`; grant a `authenticated`).
- [ ] **Step 4:** Rodar de novo. Esperado: `RESUMO: N/N OK`.
- [ ] **Step 5:** Commit `feat(obras-sql): material antecipado — resposta, prazos do Compras, compras por restrição e trava`.

### Task 2: Compras — origem da solicitação

**Files (repo compras, worktree `wt-cmp-material`):**
- Create: `supabase/hub-install/017_cmp_obras_restricao.sql`
- Modify: `app/(modulo)/solicitacoes/nova/page.tsx` (searchParams), `nova-solicitacao-form.tsx` (faixa de origem + prazo inicial + texto inicial), `lib/solicitacoes/preparar.ts` e `lib/solicitacoes/actions.ts` (gravar `obras_restricao_id`)
- Test: ao lado dos testes existentes de `lib/solicitacoes/` e `tests/hub-install-safety.test.ts` (deve passar sem exceção nova)

**Interfaces:**
- Produces: `cmp_solicitacoes.obras_restricao_id uuid null` (sem FK) + índice; trigger de guarda (insert, e update quando a coluna muda): restrição existe, `tipo='material'`, `obra_id` igual ao da solicitação; senão `raise exception`; uma vez não nula, não muda.
- Link aceito: `?obra=<uuid>&tipo=material&prazo=AAAA-MM-DD&restricao=<uuid>&atividade=<int>&nome=<texto>&inicio=AAAA-MM-DD&material=<texto>`. `prazo` inválido ou no passado = ignora; `restricao` que não for da obra (checar com o cliente de serviço antes de exibir) = ignora e mostra "A restrição do link não é desta obra; a solicitação segue sem ligação."; `nome`/`material` cortados em 200/500 caracteres, exibidos como texto.

- [ ] **Step 1:** Testes de `preparar` (falham): com `restricaoId` válido o payload leva `obras_restricao_id`; sem obra, `restricaoId` é descartado; `prazoInicial` do link preenche `prazoNecessario`.
- [ ] **Step 2:** Implementar 017 + leitura dos parâmetros + faixa "Pedido para a restrição da atividade N · <nome> · começa dd/mm/aaaa. O Obras vai acompanhar esta solicitação." + gravação.
- [ ] **Step 3:** `npm test` e `npm run build` do Compras verdes; `tests/hub-install-safety.test.ts` passa.
- [ ] **Step 4:** Commit `feat(solicitacao): origem na restrição de material do Obras (017)`.

### Task 3: Regras puras do material (TDD)

**Files:**
- Create: `app/obras/obras/_lib/material.ts`
- Test: `app/obras/obras/_lib/__tests__/material.test.ts`

**Interfaces:**
- Consumes: `AtividadeCalculada` (`_lib/cronograma.ts`), `Restricao` (`_lib/last-planner.ts`).
- Produces:
  ```ts
  export type PrazosCompras = { diasExpediente: number[]; folga: number; entregaMaterial: number }
  export const PRAZOS_PADRAO_COMPRAS: PrazosCompras // { diasExpediente: [1,2,3,4,5], folga: 4, entregaMaterial: 5 }
  export function prazosDeLinha(l: { prazos: unknown; expediente: unknown } | null): PrazosCompras // campo ausente/inválido → padrão daquele campo
  export function pedirAte(inicio: string, p: PrazosCompras): string
  export type CompraDaRestricao = { solicitacaoNumero: number; etapa: string; enviadoEm: string | null; dataMinima: string | null; pedidos: { previsaoEntrega: string | null; entregue: boolean }[] }
  export function comprasDeLinhas(linhas: Record<string, unknown>[]): Map<string, CompraDaRestricao[]> // por restricao_id; agrupa pedidos por solicitação; entregue = mesma regra de pedidoEntregue
  export type ItemVemAi = { numero: number; nome: string; inicio: string; pedirAte: string }
  export function listaVemAi(p: { atividades: AtividadeCalculada[]; restricoes: Restricao[]; naoPrecisa: ReadonlySet<number>; hoje: string; prazos: PrazosCompras }): ItemVemAi[]
  export type AvisoMaterial = { tipo: 'sem_resposta' | 'pedir' | 'nao_chega' | 'parada'; nivel: 'vermelho' | 'amarelo'; atividade: number; inicio: string; titulo: string; cadeia: string[]; destino: 'diario' | 'compras' | 'lookahead'; restricaoId: string | null }
  export function avisosMaterial(p: { atividades: AtividadeCalculada[]; restricoes: Restricao[]; naoPrecisa: ReadonlySet<number>; compras: Map<string, CompraDaRestricao[]> | null; hoje: string; prazos: PrazosCompras }): AvisoMaterial[]
  export function linkPedirMaterial(p: { obraId: string; restricao: Restricao; atividade: { numero: number; nome: string; inicio: string } }): string
  ```

- [ ] **Step 1: testes que falham**, com os valores da spec:
  - `pedirAte('2026-11-10', {diasExpediente:[1,2,3,4,5], folga:3, entregaMaterial:2})` → `'2026-11-03'`; `('2026-11-06', …)` → `'2026-10-30'`; com `PRAZOS_PADRAO_COMPRAS` e `'2026-11-10'` → `'2026-10-28'`.
  - Propriedade: para os inícios acima, somar N dias de expediente a `pedirAte` (mesma aritmética de `somarDiasDeExpediente` do Compras) devolve o início.
  - `prazosDeLinha(null)` = padrão; `prazosDeLinha({prazos:{folga_processo_dias:3, entrega_material_dias:2}, expediente:null})` = `{[1..5], 3, 2}`; valor negativo/não inteiro → padrão do campo.
  - `listaVemAi` (hoje `2026-11-03`): entra atividade `nao_iniciado` com início `2026-11-10` e `2026-10-30` (passado); fica fora: início `2026-12-02` (> 28 dias), status `em_andamento`, `concluido`, número em `naoPrecisa`, atividade com restrição `material` (mesmo liberada). Ordem por `pedirAte`.
  - `avisosMaterial` (prazos 3+2, hoje `2026-11-03`), um caso por linha da tabela §4.5:
    - sem resposta, início `2026-11-10` → `sem_resposta`/`vermelho` ("vence hoje"); início `2026-11-24` → nenhum aviso.
    - restrição material sem compra, início `2026-11-17` → `pedir`/`amarelo` com título `"Pedir até 10/11: <descricao>"`; início `2026-11-10` → `vermelho` `"Pedir hoje: <descricao>"`.
    - compra com pedido previsão `2026-11-11`, início `2026-11-06`, não entregue → `nao_chega`/`vermelho`, título `"Material chega 3 dia(s) útil(eis) depois do início"`.
    - solicitação etapa `cotacao` sem pedido, `dataMinima '2026-10-30'` → `parada`/`amarelo`; `dataMinima '2026-11-09'` → nada.
    - etapa `atendida_estoque` ou `concluida` → nada; todas `cancelada`/`recusada` → volta a `pedir`.
    - dois pedidos, um entregue e outro com previsão depois do início → `nao_chega`.
    - restrição `liberada` → nada. `compras: null` → só `sem_resposta`/`pedir` (nunca `nao_chega`/`parada`), e restrição com `cmpPedidoId` (ligação antiga) não vira `pedir`.
    - ordem: vermelhos antes, depois `inicio`.
  - `linkPedirMaterial` → `/compras/solicitacoes/nova?obra=…&tipo=material&prazo=<inicio>&restricao=…&atividade=…&nome=…&inicio=…&material=…` com `encodeURIComponent`.
- [ ] **Step 2:** `npx jest app/obras/obras/_lib/__tests__/material.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `material.ts` (puro, sem I/O).
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Commit `feat(obras): regras do material antecipado (pedir até, lista e avisos)`.

### Task 4: Leituras e actions do hub

**Files:**
- Modify: `app/obras/obras/_lib/leitura.ts` (leituras novas ao lado de `lerPedidosDaObra`/`obras_restricao_pedidos`, linha ~366)
- Modify: `app/obras/obras/[id]/lookahead/_actions.ts` (actions novas; reaproveitar `autorizar`, `criarRestricaoAction`)
- Test: `app/obras/obras/[id]/lookahead/__tests__/` (padrão dos testes de actions existentes)

**Interfaces:**
- Consumes: Task 1 (banco), Task 3 (`prazosDeLinha`, `comprasDeLinhas`, `pedirAte`).
- Produces:
  ```ts
  // leitura.ts — sempre com o cliente da SESSÃO
  export async function lerPrazosCompras(supabase): Promise<PrazosCompras>          // erro → PRAZOS_PADRAO_COMPRAS (nunca lança)
  export async function lerComprasDasRestricoes(supabase, obraId: string): Promise<Map<string, CompraDaRestricao[]> | null> // erro → null
  export async function lerNaoPrecisa(supabase, obraId: string): Promise<Set<number> | null> // erro → null (tela trata como vazio, sem lista falsa? ver Step 1)
  // _actions.ts
  export async function responderNaoPrecisaAction(obraId: string, atividadeNumero: number): Promise<Resultado>
  export async function desfazerNaoPrecisaAction(obraId: string, atividadeNumero: number): Promise<Resultado>
  export async function responderPrecisaAction(obraId: string, atividadeNumero: number, material: string): Promise<Resultado & { id?: string }>
  ```
  `responderPrecisaAction`: trim, obrigatório, ≤ 500 → chama `criarRestricaoAction(obraId, { atividadeNumero, tipo: 'material', descricao: material, responsavel: 'manfac', prazo: pedirAte(inicio, prazos) })`, com `inicio` da atividade na versão vigente lida no servidor (nunca do cliente). Erro do trigger da Task 1 (`OBRAS_MATERIAL:`) chega ao usuário com o texto depois do prefixo nas actions de apagar/editar restrição existentes.

- [ ] **Step 1:** Testes que falham: duplicado (`23505`) em "não precisa" vira sucesso idempotente; material vazio → "Diga qual é o material."; > 500 → "Descreva o material em até 500 caracteres."; atividade fora da versão vigente → mesma mensagem de hoje; prazo gravado = `pedirAte` calculado no servidor; apagar restrição recebendo erro `OBRAS_MATERIAL: Esta restrição tem a solicitação #401 no Compras. Cancele lá antes.` → `{ ok:false, erro: 'Esta restrição tem a solicitação #401 no Compras. Cancele lá antes.' }`. `lerNaoPrecisa` com erro → `null`, e a tela (Task 5) **não** mostra a lista "Vem aí" nesse caso (mostra "Não deu para carregar as respostas agora."), para não perguntar de novo o que já foi respondido.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `feat(obras): leituras e respostas do material antecipado`.

### Task 5: Telas, alertas e e-mail

**Files:**
- Create: `app/obras/obras/[id]/diario/_vem-ai.tsx`
- Modify: `app/obras/obras/[id]/diario/_passos.tsx` (passo "Vem aí" antes de "Enviar", opcional), `app/obras/obras/[id]/diario/page.tsx` (dados)
- Modify: `app/obras/obras/[id]/lookahead/page.tsx` + `_pedido.tsx` (coluna material/pedir até; trilha Restrição → Solicitação → Cotação → Pedido → Entrega; "Pedir no Compras" via `linkPedirMaterial`; "Desfazer não precisa")
- Modify: `app/obras/obras/_lib/alertas.ts` (novo `id: 'material'` em `Alerta`, parâmetro opcional `material?: AvisoMaterial[] | null`), `app/obras/obras/[id]/page.tsx` (passa os avisos)
- Modify: `app/obras/obras/_lib/email-diario.ts` (`montarEmailDiario` recebe `materiais?: AvisoMaterial[]`; seção "Materiais" só com `lado === 'interno'` e lista não vazia), `app/obras/obras/[id]/diario/_actions.ts` (calcula e passa no envio interno)
- Test: `__tests__` de cada pasta, no padrão existente

**Interfaces:**
- Consumes: Tasks 3 e 4.
- Produces: nada para tasks seguintes.

- [ ] **Step 1:** Testes que falham:
  - `_vem-ai`: renderiza "Vem aí: precisa de material?", item com "Começa 10/11 · Pedir até 03/11" e selo "Pedir hoje"; "Não precisa" chama a action e o item some; "Precisa" abre "Qual material?" e Salvar vazio mostra erro; depois de salvar aparece "Pedir no Compras" com o href de `linkPedirMaterial`; lista vazia → "Tudo respondido nas próximas 4 semanas."; `naoPrecisa === null` → "Não deu para carregar as respostas agora." e nenhum botão.
  - diário: o envio continua possível sem responder o "Vem aí".
  - `calcularAlertas`: com `material` contendo um `nao_chega` gera alerta `id 'material'`, `tom 'negativo'`, texto com a cadeia unida por " ← ", ação "Ver restrição" → `/obras/obras/<id>/lookahead?restricao=<restricaoId>`; `material: null` → nenhum alerta de material.
  - `montarEmailDiario`: `lado 'interno'` com avisos → html e texto contêm "Materiais" e o título do aviso; `lado 'cliente'` com os mesmos avisos → não contêm "Materiais" nem a descrição do material; interno sem avisos → sem a seção.
  - Lookahead: restrição com compra parada mostra "Cotação parada" e "data mínima do Compras era 30/10"; trilha com pedido entregue mostra "Pronta para liberar" (comportamento atual preservado).
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar seguindo o mockup. **Step 4:** Rodar → PASS.
- [ ] **Step 5:** `npm run build` verde; `npx jest app/obras app/portal-obra lib` verde.
- [ ] **Step 6:** Commit `feat(obras): pergunta de material no diário, trilha no Lookahead e avisos no painel e no e-mail interno`.

### Task 6: Documentação

**Files:**
- Modify: `.claude/rules/obras.md` (seção "Material antecipado": onde fica, regras, ordem de deploy Compras 017 → `sdd-sql-obras-material.sql` → app do Compras → hub), `.claude/rules/sql.md` (linha do arquivo novo), `docs/DIVIDAS.md` (o que ficou de fora; teste manual no celular pendente), `docs/obras/roadmap-obras.md` (estado em 03/11: levas 1–6b e financeiro no ar; material antecipado em construção; próximos: visão do CEO, papéis do SGO), (a ordem do §7 da spec já foi corrigida no plano).
- [ ] **Step 1:** Editar (só acrescentar nas seções de outras branches). **Step 2:** Commit `docs(obras): regras, dívidas e roadmap do material antecipado`.

Ordem: T1 ‖ T2 ‖ T3 → T4 → T5 → T6. Depois: revisão final da branch (hub + Compras), push das duas branches, e o José aplica o SQL na ordem do §7.
