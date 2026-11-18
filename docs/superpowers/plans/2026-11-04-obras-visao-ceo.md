# Visão do CEO (Gestão de Obras) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma tela só leitura, para administrador, com todas as obras da modalidade OBRA (andamento, travas e quem destrava, sinais do cliente, dinheiro), piores primeiro, abrindo cada obra em detalhe.

**Architecture:** Regras em funções puras (`_lib/carteira.ts`), uma leitura que junta por obra o que o módulo já lê (`_lib/carteira-leitura.ts`), e a página `app/obras/obras/visao-ceo/` (server) + `_tela.tsx` (client: filtros e abrir obra). O dinheiro sai do **mesmo** caminho da aba Financeiro, extraído da página dela para `_lib/financeiro-ler.ts`.

**Tech Stack:** Next (ler `node_modules/next/dist/docs/` antes de código), React server components, Supabase (cliente da SESSÃO), Tailwind v4, Jest.

**Spec:** `docs/superpowers/specs/2026-11-04-obras-visao-ceo-design.md` (leia inteiro, inclusive §6b). Mockup: https://claude.ai/artifact/Vi2gx5o5XFE4ep6bBCAP7P

## Global Constraints

- Sem mudança de schema. Precisou de SQL → pare e pergunte ao José.
- Toda leitura com o cliente da **sessão** (`createClient` de `@/lib/supabase/server`); as `obras_fin_*` devolvem vazio com service role.
- Tema claro do módulo: tokens `--obra-*`, números em `.obra-num`, pílulas de `_ui/pilula-situacao.tsx` (`PilulaSinal`, `ESTILO_SITUACAO`). Texto laranja só `--obra-orange-texto`. Cor nunca é o único sinal.
- Responsável: `cliente` → "Cliente" (com `.obra-hachura`), `manfac` → "Manfac", `terceiro` e `clima` → "Terceiros".
- Datas em BRT com `hojeISO()` (`app/obras/_lib/tipos.ts`); dias úteis com `diasUteisEntre(a, b, feriados)` (`_lib/calendario.ts`) e os feriados da obra (`ObraGrande.feriados`).
- Valores em centavos inteiros; formatar com `brl` de `_lib/financeiro-tela.ts`.
- Textos fixos da spec: "Nada pedindo sua atenção hoje.", "Nada travando", "Sem sinais ruins", "Sem cronograma", "Sem plano da semana", "Nenhuma restrição aberta", "Orçado × realizado: ainda sem orçado", "Sem permissão para ver valores", "Não foi possível ler os valores", "Valor da obra não informado", "faturado acima do valor", "Abrir a obra →".
- Nunca escrever `export type` em arquivo `'use server'` (`.claude/rules/obras.md`, armadilha 1).

## Review Focus

1. **Leitura que falha não pode virar "tudo bem".** Mensagens, agenda ou Financeiro com erro → sinal `indisponivel` / dinheiro `{ok:false}`; nunca "respondidas", "em dia" ou R$ 0. (Testes na Task 2 e na Task 3.)
2. **Obra sem cronograma** (`calc` null, cronograma não salvo): estado "Sem cronograma", sem etapas, sem "parada", fora das contas de atraso; nunca quebra a tela. (Task 2.)
3. **Obra com aditivo** (OS filha): uma linha só, dinheiro da mãe + filhas não canceladas; a filha não aparece sozinha. (Task 3.)
4. **Não admin** abrindo a URL direto, ou erro ao conferir admin → recusa, sem ler nada. (Task 4.)
5. **Obra concluída ainda faturando / sem valor**: continua na tela (grupo "Faturando"); sai só com execução 100% **e** a faturar = 0 com valor informado. (Task 2.)

---

### Task 1: Extrair a leitura do Financeiro da obra

**Files:**
- Create: `app/obras/obras/_lib/financeiro-ler.ts`
- Modify: `app/obras/obras/[id]/financeiro/page.tsx:40-97` (passa a chamar a função; os `<Aviso>` ficam na página)
- Test: `app/obras/obras/_lib/__tests__/financeiro-ler.test.ts`; o existente `app/obras/obras/[id]/financeiro/__tests__/page.test.tsx` tem de continuar passando sem mudar asserção.

**Interfaces:**
- Produces:
```ts
export type LeituraFinanceiro =
  | { ok: true; fin: Financeiro; obras: ObraFin[] }
  | { ok: false; motivo: 'sem_permissao' | 'nao_encontrada' | 'leitura' }
export async function lerFinanceiroDaObra(
  supabase: SupabaseClient,
  obraId: string,
  og: { ok: true; dados: ObraGrande } | { ok: false; erro: string },
  hoje: string,
): Promise<LeituraFinanceiro>
```
Corpo = exatamente o que hoje está entre o `rpc('obras_pode_ver_valores')` e o `return` da página (permissão falha fechada, leitura de `obras_obra` mãe+filhas, as 8 leituras, `montarFinanceiro`, os `fin.x = leitura` de erro), recebendo `og` em vez de chamar `lerObraDaRequisicao`. `pode !== true` → `sem_permissao`; erro ao ler `obras_obra` → `leitura`; obra ausente → `nao_encontrada`.

- [ ] **Step 1:** Teste `financeiro-ler.test.ts` com supabase fake (mesmo estilo do `page.test.tsx`): `pode` = `false` → `{ok:false, motivo:'sem_permissao'}` e nenhuma `obras_fin_*` chamada; `pode` erro → `sem_permissao`; `obras_fin_notas` com erro → `ok:true` e `fin.faturamento` = `{ok:false, motivo:'leitura'}` e `fin.resumo.ok === false`.
- [ ] **Step 2:** `npx jest app/obras/obras/_lib/__tests__/financeiro-ler.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Criar a função movendo o código; a página chama `lerFinanceiroDaObra(supabase, id, await lerObraDaRequisicao(id, hoje), hoje)` e mapeia `motivo` para os mesmos textos de hoje.
- [ ] **Step 4:** `npx jest app/obras/obras/_lib/__tests__/financeiro-ler.test.ts "app/obras/obras/\[id\]/financeiro"` → PASS (todos).
- [ ] **Step 5:** Commit `refactor(obras): leitura do Financeiro da obra vira função reutilizável`.

---

### Task 2: Regras da carteira (funções puras)

**Files:**
- Create: `app/obras/obras/_lib/carteira.ts`
- Test: `app/obras/obras/_lib/__tests__/carteira.test.ts`

**Interfaces:**
- Consumes: `ResultadoCronograma`, `AtividadeCalculada`, `Sinal` (`_lib/cronograma.ts`); `PontoHist` (`_lib/curvas.ts`); `Restricao`, `PlanoSemana` (`_lib/last-planner.ts`); `ImpedimentoRow` (`_lib/leitura.ts`); `ItemAgenda` (`_lib/agenda.ts`); `SituacaoExibida` (`_ui/pilula-situacao.tsx` — mover o tipo para `_lib` se o import de `_ui` em `_lib` quebrar o padrão); `LeituraFinanceiro` (Task 1); `diasUteisEntre`.
- Produces (tipos e funções usados nas Tasks 3 e 4):
```ts
export type Quem = 'cliente' | 'manfac' | 'terceiros'
export type Trava = { origem: 'restricao' | 'impedimento'; descricao: string; tipo: string; quem: Quem; desde: string; prazo: string | null; vencida: boolean }
export type Estado =
  | { tipo: 'sem_cronograma' } | { tipo: 'faturando' } | { tipo: 'parada'; diasUteis: number }
  | { tipo: 'frente_parada' } | { tipo: 'comecou'; em: string } | { tipo: 'andando'; comAtraso: boolean }
export type SinalCliente = { chave: 'entrega' | 'pendencias' | 'mensagens' | 'semanal'; tom: 'ruim' | 'atencao' | 'ok' | 'indisponivel'; texto: string; curto: string | null }
export type EtapaCarteira = { nome: string; realizado: number; previsto: number; situacao: SituacaoExibida }
export type DinheiroCarteira =
  | { ok: true; valor: number | null; faturado: number; aFaturar: number | null; acimaDoValor: boolean; notas: number; custoRealizado: number; custoComprometido: number; margemPct: number | null }
  | { ok: false; motivo: 'sem_permissao' | 'leitura' }
export type Mensagem = { autorTipo: 'cliente' | 'manfac'; criadoEm: string }
export type Diario = { data: string; texto: string }
export type Semana = { planejadas: number; cumpridas: number; ppc: number | null; causas: string } | null
export type ObraCarteira = {
  id: string; os: string | null; loja: string | null; engenheiro: string | null
  sinal: Sinal | null; estado: Estado; realizado: number | null; previsto: number | null
  terminoBase: string | null; terminoProjetado: string | null; desvioDiasUteis: number | null
  travas: Trava[]; travaPrincipal: Trava | null; sinais: SinalCliente[]
  etapas: EtapaCarteira[]; semana: Semana; diarios: Diario[]; dinheiro: DinheiroCarteira
}
export type FiltroCarteira = 'todas' | 'risco' | 'cliente' | 'manfac' | 'terceiros' | 'no_prazo' | 'faturando'
export type Excecao = { obraId: string; obra: string; texto: string; quem: Quem | null; gravidade: number }

export function ultimoAvanco(hist: PontoHist[]): string | null
export function estadoDaObra(p: { calc: ResultadoCronograma | null; sinal: Sinal | null; hist: PontoHist[]; impedimentosAbertos: number; dataBase: string | null; hoje: string; feriados: ReadonlySet<string> }): Estado
export function travasDaObra(restricoes: Restricao[], impedimentos: ImpedimentoRow[], hoje: string): Trava[]
export function travaPrincipal(travas: Trava[]): Trava | null
export function etapasDaCarteira(calc: ResultadoCronograma | null): EtapaCarteira[]
export function semanaDe(planos: PlanoSemana[], hoje: string): Semana
export function sinaisDoCliente(p: { terminoBase: string | null; terminoProjetado: string | null; desvioDiasUteis: number | null; restricoes: Restricao[] | null; mensagens: Mensagem[] | null; agenda: ItemAgenda[] | null; hoje: string; feriados: ReadonlySet<string> }): SinalCliente[]
export function dinheiroDaCarteira(l: LeituraFinanceiro): DinheiroCarteira
export function ficaNaCarteira(o: Pick<ObraCarteira, 'estado' | 'dinheiro'>): boolean
export function grupoDe(o: Pick<ObraCarteira, 'sinal' | 'estado'>): 0 | 1 | 2 | 3 | 4
export function ordenarCarteira(obras: ObraCarteira[]): ObraCarteira[]
export function filtrarCarteira(obras: ObraCarteira[], f: FiltroCarteira): ObraCarteira[]
export function contarTravas(obras: ObraCarteira[]): Record<Quem, { travas: number; obras: number }>
export function excecoesDoDia(obras: ObraCarteira[]): Excecao[]
export function resumoCarteira(obras: ObraCarteira[]): { porSinal: Record<'vermelho' | 'amarelo' | 'verde' | 'sem', number>; faturando: number; faturado: number; aFaturar: number; valor: number; custoRealizado: number; foraDasSomas: number }
```

Regras que os testes fixam (o resto o implementador decide):
- `ultimoAvanco`: por atividade, em ordem de `dataStatus`, uma linha conta como avanço quando `percentual` > o anterior daquela atividade (a primeira conta se > 0). Devolve a maior data de avanço. Linha só de `diasRestantes` sem subir % **não** conta.
- `estadoDaObra`, nesta ordem: `calc` null → `sem_cronograma`; todas as atividades `situacao === 'concluida'` → `faturando`; `diasUteisEntre(ultimoAvanco ?? dataBase, hoje)` ≥ 3 → `parada`; `impedimentosAbertos > 0` → `frente_parada`; `dataBase` e `diasUteisEntre(dataBase, hoje) < 10` → `comecou`; senão `andando` com `comAtraso = sinal !== 'verde'`.
- `travasDaObra`: restrição com `situacao !== 'liberada'` (desde = `criadoEm`, `vencida = prazo !== null && prazo < hoje`); impedimento com `categoria === 'impedimento'` e `encerradoEm === null` (desde = `abertoEm`, prazo null, vencida false). `orientacao` nunca entra.
- `travaPrincipal`: restrição vencida de menor prazo; senão impedimento de menor `desde`; senão restrição de prazo mais próximo (prazo null por último); vazio → null.
- `etapasDaCarteira`: agrupa `calc.atividades` por `etapa` na ordem em que aparecem; `realizado`/`previsto` = média de `percentual`/`percentualPrevisto` ponderada por `peso` (peso total 0 → média simples); `situacao` = a pior das atividades pela ordem `aguardando_cliente` > `atrasada` > `travada` > `inicio_atrasado` > `em_andamento` > `nao_iniciada`, e `concluida` só se todas concluídas (use `situacaoExibida`).
- `semanaDe`: o plano mais recente com `semanaInicio <= hoje`; `planejadas` = itens, `cumpridas` = `cumprido === true`, `ppc` = `ppc(itens)` (`last-planner.ts`), `causas` = `causasNaoCumpridas` em texto ("3 por cliente, 1 por material"); sem plano → null.
- `sinaisDoCliente` devolve sempre as 4 chaves, nesta ordem: entrega (desvio > 0 → `ruim` se ≥ 5 d.u., senão `atencao`, texto "entrega mudou de dd/mm para dd/mm"; sem desvio → `ok` "entrega mantida em dd/mm"; sem base → `ok` "sem data base"); pendências (`restricoes === null` → `indisponivel` "não foi possível ler as pendências"; restrições abertas `responsavel === 'cliente'`: 0 → ok; alguma vencida ou a mais antiga com ≥ 5 d.u. → `ruim`; senão `atencao`; texto "N pendências com o cliente, a mais antiga há X dias úteis"); mensagens (`null` → `indisponivel` "não foi possível ler as mensagens"; última é `cliente` e `diasUteisEntre(dia BRT de criadoEm, hoje) > 1` → `ruim` "N mensagens do cliente sem resposta desde dd/mm" (N = mensagens do cliente depois da última da Manfac); senão `ok`); semanal (`null` → `indisponivel`; algum item `tipo === 'semanal'` com `situacao === 'atrasado'` → `atencao` "relatório semanal de dd/mm não foi enviado"; senão `ok` com o último `dataReal`). `curto` só para `ruim`/`atencao`/`indisponivel`.
- `dinheiroDaCarteira`: `ok:false` mantém o motivo (`nao_encontrada` vira `leitura`); `fin.resumo.ok === false` → `{ok:false, motivo:'leitura'}`. Com resumo: `valor = total.receitaEsperada`, `faturado = total.receitaRealizada`, `custoRealizado/custoComprometido` do total, `margemPct = total.margemPct`, `notas` = linhas de `fin.faturamento` (0 se bloco falhou), `aFaturar = valor === null ? null : max(0, valor − faturado)`, `acimaDoValor = valor !== null && faturado > valor`.
- `ficaNaCarteira`: false só se `estado.tipo === 'faturando'` **e** `dinheiro.ok` **e** `valor !== null` **e** `aFaturar === 0`.
- `grupoDe`: faturando 4; sem cronograma 3; vermelho 0; amarelo 1; verde 2. `ordenarCarteira`: grupo, depois `parada.diasUteis` desc (não parada = 0), depois `desvioDiasUteis` desc, depois `loja`.
- `filtrarCarteira`: `risco` = grupo 0 ou 1; `cliente`/`manfac`/`terceiros` = alguma trava com esse `quem`; `no_prazo` = grupo 2; `faturando` = grupo 4.
- `excecoesDoDia`: por obra, uma exceção para cada: sinal vermelho (gravidade 0), parada (1), cada trava vencida (2), sinal `mensagens` ruim (3), sinal `semanal` atenção (4); ordenado por gravidade e loja. Texto diz o fato e quem destrava (ex.: "parada há 6 dias úteis; trava: Aprovação do projeto luminotécnico (Cliente)").
- `resumoCarteira`: somas só das obras com `dinheiro.ok`; `foraDasSomas` = as outras.

- [ ] **Step 1:** Escrever `carteira.test.ts` com um caso por regra acima, mais: `sinaisDoCliente` com `mensagens: null` e `agenda: null` → os dois `indisponivel` (nunca `ok`); `estadoDaObra` com `calc: null` → `sem_cronograma` mesmo com hist; `ficaNaCarteira` com faturando + `dinheiro.ok:false` → true, faturando + `valor: null` → true, faturando + `aFaturar: 0` → false; `dinheiroDaCarteira` com faturado > valor → `aFaturar: 0, acimaDoValor: true`.
- [ ] **Step 2:** `npx jest app/obras/obras/_lib/__tests__/carteira.test.ts` → FAIL.
- [ ] **Step 3:** Implementar `carteira.ts`.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Commit `feat(obras): regras da Visão do CEO (carteira)`.

---

### Task 3: Leitura da carteira

**Files:**
- Create: `app/obras/obras/_lib/carteira-leitura.ts`
- Test: `app/obras/obras/_lib/__tests__/carteira-leitura.test.ts`

**Interfaces:**
- Consumes: `lerObraGrande`, `lerRestricoes`, `lerPlanos` (`_lib/leitura.ts`); `lerAgenda` (`_lib/envios-agenda.ts`); `lerFinanceiroDaObra` (Task 1); tudo da Task 2.
- Produces:
```ts
export type LinhaUniverso = { id: string; os: string | null; loja: string | null; modalidade: string; etapa: string | null; cancelado_em: string | null; obra_pai_id: string | null; engenheiro_email: string | null }
export function obrasDoUniverso(rows: LinhaUniverso[]): LinhaUniverso[]   // modalidade 'obra', etapa !== 'cancelado', cancelado_em null, obra_pai_id null
export async function lerCarteira(supabase: SupabaseClient, hoje: string): Promise<{ ok: true; obras: ObraCarteira[] } | { ok: false }>
```
`lerCarteira`: lê `obras_obra` (colunas de `LinhaUniverso`) com `.eq('modalidade','obra')`; erro → `{ok:false}`. Para cada obra do universo, em paralelo (`Promise.all` por obra e entre obras): `lerObraGrande`, `lerRestricoes`, `lerPlanos`, os 3 últimos `obras_rdo` com `estado in ('validado','enviado')` ordenados por `data` desc (+ `obras_rdo_avanco` desses rdos para listar as atividades que avançaram), `obras_mensagem` (`autor_tipo, criado_em`, últimas 50 por `criado_em` desc), `lerAgenda` (só com `og.ok`), `lerFinanceiroDaObra(supabase, id, og, hoje)`. Monta `ObraCarteira` com as funções da Task 2; `desvioDiasUteis` = `diasUteisEntre(terminoBase, calc.terminoProjetado, feriados)` quando os dois existem (negativo vira 0). Texto do diário: `sem_execucao` → "Sem execução: <motivo>"; senão "Equipe de <efetivo>." + descrições das atividades que avançaram (até 3, depois "e mais N"). Falha de uma leitura afeta só o pedaço dela (restrições com erro → `travas: []` **e** sinal `pendencias` `indisponivel`; mensagens com erro → `null`; agenda falha → `null`). `lerObraGrande` com erro → a obra entra com `estado: sem_cronograma`, `sinal: null`. Filtra com `ficaNaCarteira` e devolve `ordenarCarteira(...)`.
- [ ] **Step 1:** Teste de `obrasDoUniverso`: exclui `modalidade: 'spot'`, `etapa: 'cancelado'`, `cancelado_em` preenchido e `obra_pai_id` preenchido; mantém a mãe. Teste de `lerCarteira` com supabase fake de 1 obra: `obras_mensagem` com erro → sinal `mensagens` `indisponivel`; `obras_pode_ver_valores` false → `dinheiro` `{ok:false, motivo:'sem_permissao'}`; obra com uma OS filha → `obras.length === 1`.
- [ ] **Step 2:** `npx jest app/obras/obras/_lib/__tests__/carteira-leitura.test.ts` → FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Mesmo comando → PASS.
- [ ] **Step 5:** Commit `feat(obras): leitura da carteira para a Visão do CEO`.

---

### Task 4: Página, guarda e tela

**Files:**
- Create: `app/obras/obras/visao-ceo/page.tsx` (server), `app/obras/obras/visao-ceo/_tela.tsx` (`'use client'`), `app/obras/obras/visao-ceo/_permissao.ts`
- Modify: `app/obras/obras/page.tsx` (link "Visão do CEO" no cabeçalho, só quando `isAdmin`)
- Test: `app/obras/obras/visao-ceo/__tests__/permissao.test.ts`, `app/obras/obras/visao-ceo/__tests__/tela.test.tsx`

**Interfaces:**
- Consumes: `lerCarteira` (Task 3); `contarTravas`, `excecoesDoDia`, `resumoCarteira`, `filtrarCarteira`, tipos (Task 2).
- Produces:
```ts
// _permissao.ts
export async function podeVerVisaoCeo(supabase: SupabaseClient): Promise<boolean> // getUser → email; isAdmin(supabase, email); qualquer erro/exceção/sem email → false
// _tela.tsx
export default function TelaVisaoCeo(p: { obras: ObraCarteira[]; hoje: string; lidoEm: string }): JSX.Element
```
Página: `export const dynamic = 'force-dynamic'`; `podeVerVisaoCeo` false → o mesmo aviso das telas restritas ("Esta tela é da administração") **sem** chamar `lerCarteira`; `lerCarteira` `{ok:false}` → "Não deu para ler as obras agora. Recarregue em instantes."; senão `<TelaVisaoCeo>`. Tela segue o mockup: 4 quadros do topo (o de "Gasto × orçado" com "N de M obras ainda sem orçado. A comparação aparece quando o orçado da obra existir."), "Precisa da sua atenção hoje", filtros com contagem (os 7 de `FiltroCarteira`, rótulos: Todas · Atrasadas e atenção · Esperando o cliente · Esperando a Manfac · Esperando terceiros · No prazo · Faturando), linhas `<button aria-expanded>` que abrem o detalhe (Andamento por etapa, Esta semana, Últimos diários, O que está travando, Sinais da relação com o cliente, Dinheiro da obra com o bloco amarelo "Orçado × realizado: ainda sem orçado"), e `<Link href={`/obras/obras/${id}`}>Abrir a obra →</Link>`. Clicar num quadro "Quem está segurando" aplica o filtro; clicar numa exceção abre aquela obra e volta o filtro para "Todas". Estado `faturando` mostra `PilulaSinal`-like "Concluída" e "Execução concluída · faltam R$ X a faturar". Celular: colunas empilham (≤ 1060 px duas colunas, ≤ 560 px uma).

- [ ] **Step 1:** `permissao.test.ts`: admin → true; não admin → false; `getUser` sem usuário → false; `isAdmin` lança → false.
- [ ] **Step 2:** `tela.test.tsx` (Testing Library, como `financeiro/__tests__/page.test.tsx`): com 2 obras (uma vermelha com trava do cliente, uma verde), a vermelha vem primeiro; clicar "Esperando o cliente" deixa só ela; clicar na linha mostra "Andamento por etapa" e "Orçado × realizado: ainda sem orçado"; `dinheiro {ok:false, motivo:'sem_permissao'}` mostra "Sem permissão para ver valores" e nenhum "R$ 0"; lista sem exceções mostra "Nada pedindo sua atenção hoje.".
- [ ] **Step 3:** `npx jest app/obras/obras/visao-ceo` → FAIL.
- [ ] **Step 4:** Implementar `_permissao.ts`, `page.tsx`, `_tela.tsx` e o link na lista.
- [ ] **Step 5:** `npx jest app/obras/obras/visao-ceo` → PASS; `npm run lint` sem erro novo; `npx tsc --noEmit` sem erro.
- [ ] **Step 6:** Commit `feat(obras): tela Visão do CEO`.

---

### Task 5: Fechamento — documentação e conferência com dados reais

**Files:**
- Modify: `docs/DIVIDAS.md` (nova seção 04/11/2026: a lista `/obras/obras` mostra canceladas e aditivos como cartões; a Visão do CEO não), `.claude/rules/obras.md` (seção "Visão do CEO": onde fica, quem vê, que o dinheiro reusa `lerFinanceiroDaObra`), `docs/obras/roadmap-obras.md` (A12 em andamento/no ar conforme o estado).

- [ ] **Step 1:** `npm test 2>&1 | tail -30` → só as 7 suítes do `manfac-site/` falham (AGENTS.md).
- [ ] **Step 2:** `npm run build` → sucesso.
- [ ] **Step 3:** Conferência: `npm run dev`, logado como admin, abrir `/obras/obras/visao-ceo` e, para cada obra listada, comparar realizado/previsto/entrega com o painel da obra e faturado/custo/margem com a aba Financeiro dela. Anotar o resultado no commit. Sem acesso a dados reais nesta máquina → dizer isso ao José, não declarar conferido.
- [ ] **Step 4:** Commit `docs(obras): Visão do CEO nas regras, dívidas e roadmap`.
