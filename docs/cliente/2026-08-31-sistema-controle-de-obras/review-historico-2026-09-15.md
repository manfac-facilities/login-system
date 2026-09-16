# Code review — Histórico de alterações (Parte 1)

**Data:** 2026-09-15. **Revisor:** subagente independente (não escreveu nada do que está
sendo revisado). **Régua:** `superpowers:requesting-code-review`.

**Objeto:** branch `worktree-agent-aec15e14f7f4ed10e`, worktree
`.claude/worktrees/agent-aec15e14f7f4ed10e`, 6 commits sobre `master`
(`d4d09cf..1112b07`), 7 arquivos, +2416 linhas.

**Revisado contra:** `spec-historico-alteracoes-2026-09-15.md`,
`plano-historico-alteracoes-2026-09-15.md`, `j4-decisoes-2026-09-14.md` (decisões 6 e 7),
`AGENTS.md` (as duas armadilhas de PL/pgSQL, o padrão `obras_has_access()`, a regra de
guarda que não pode falhar aberto com NULL).

**Nada foi alterado, nada foi commitado, nada foi rodado contra banco ou produção.**

## Resumo

| Severidade | Quantidade |
|---|---|
| **Bloqueia o merge** | 1 |
| **Importante** | 4 |
| **Menor** | 10 |

**Há um bloqueador** — B1, abaixo. Não é um bug de digitação: é um contrato de perda
silenciosa de dados gravado dentro de uma migration que vai ser rodada à mão em produção,
e o único teste do caminho consagra justamente o payload quebrado. Depois de aplicada,
corrigir custa outra migration.

## O que está certo (verificado, não presumido)

Vale dizer antes, porque a maior parte do trabalho está correta e as perguntas centrais do
pedido têm resposta afirmativa:

- **A atomicidade prometida é real.** `obras_aplicar_alteracao` é uma função `plpgsql`
  chamada por um único `supabase.rpc(...)`; o `update` (`sdd-sql-obras-historico.sql:115`)
  e o `insert` (`:138`) rodam na mesma invocação, logo na mesma transação. Qualquer falha
  do insert (check constraint, not-null) desfaz o update junto. Não existe caminho em que
  um passa e o outro não: o update vem primeiro e, se não achar a obra, `raise` (`:133`)
  antes de qualquer insert.
- **A RLS está no padrão do módulo.** Leitura e escrita por `obras_has_access()`
  (`:78`, `:84`), idêntico às 5 tabelas de `sdd-sql-obras-v0.sql:346-369`. Sem policy de
  `update`/`delete` (`:88`), então o RLS nega por padrão — append-only pelo banco, não
  pela tela.
- **`security invoker` é a escolha certa, e por um motivo mais forte do que a spec diz.**
  Com `security definer`, a função rodaria como o dono (`postgres`), que é dono das
  tabelas e portanto **ignora RLS por completo** — a policy de insert que compara
  `quem` com `auth.jwt()` (`:85`) nunca seria avaliada, e a defesa em profundidade da
  spec §3 evaporaria. `invoker` mantém as duas escritas sob a RLS normal.
- **A trava de `quem` resiste a maiúscula, espaço e nulo.** Os dois lados usam a mesma
  expressão `lower(trim(auth.jwt() ->> 'email'))` — a policy (`:85`) e a variável da
  função (`:104`) —, então não têm como divergir. Nulo/vazio levanta `28000` antes de
  qualquer escrita (`:111-113`); e se por algum caminho chegasse ao insert, `quem = NULL`
  é NULL, que a policy trata como negado. **Falha fechado**, como o `AGENTS.md` exige.
- **As duas armadilhas de PL/pgSQL do `AGENTS.md` estão de fato evitadas**, e o cabeçalho
  da migration (`:13-17`) não está mentindo: `obras_has_access()` é `exists()`-based via
  `obras_is_admin() or exists(...)` (`sdd-sql-obras-v0.sql:317-332`), que nunca devolve
  NULL; e não há trigger nenhuma, muito menos compartilhada entre tabelas.
- **A fronteira foi respeitada, e isso é demonstrável.** Os blobs de
  `obra/[id]/_actions.ts`, `_ficha.tsx` e `_triagem.tsx` são **bit a bit idênticos** entre
  `master` e `HEAD` (`634685…`, `1e9aecc…`, `6e6762f…`). Os três existem em `master`, então
  a checagem não é vácua. Nenhum arquivo novo é importado por eles.
- **A implementação corrigiu um erro do plano.** A lista de `campo` do plano
  (`plano-…:Task 1, Step 2`) omitia `marco_relatorio` — 18 chaves. A migration entregue tem
  as 19 (`:56-62`), batendo com `CampoHistorico` (`historico.ts:22-41`), com `ROTULO_CAMPO`
  (`:44-64`) e com a spec §6. Quem implementou conferiu contra a spec, não só contra o plano.
- **`npx tsc --noEmit` limpo. `npx jest` nos dois arquivos novos: 2 suítes, 19 testes,
  todos passando.**
- **Falhas de teste pré-existentes, não desta branch:** `npm test` mostra 7 suítes falhando
  em `manfac-site/components/__tests__/` (`Cannot find module '../../lib/content'`).
  `manfac-site` não faz parte do hub (`AGENTS.md`), o diff não toca nenhum arquivo lá, e os
  747 testes que rodam passam. Não atribuir a esta branch.

---

## Bloqueia o merge

### B1 — A RPC descarta em silêncio toda coluna fora da lista estática, e o teste consagra exatamente esse caso

**Arquivo:** `sdd-sql-obras-historico.sql:115-129` (lista do `set`) e `:128`
(`jsonb_populate_record`)
**Reforçado por:** `app/obras/__tests__/historico.test.ts:153-164`

**O problema.** O `update` usa uma lista de colunas **estática** de 25 nomes. As colunas de
`obras_obra` que ficaram **de fora** são: `bloqueio`, `pendencia`, `pend_resp`,
`pend_prazo`, `prox_acao`, `inicio_real`, `fim_real`, `nao_andou_seguidos`,
`bloqueada_dias` (além das do Field, que são só leitura por decisão 9, e dos metadados).

`jsonb_populate_record(o, p_campos)` até preenche `bloqueio` no *record* intermediário —
`bloqueio` é coluna de `obras_obra` —, mas como `bloqueio` não está na lista do `set`, o
valor **nunca é atribuído à tabela**. O Postgres não reclama: não há erro, não há aviso, e
a RPC devolve a obra com `return v_obra` (`:143`), ou seja, **sucesso**. A Server Action
recebe `{ data }`, mostra "salvo", e o campo não mudou.

**Como se prova que é problema, em três passos:**

1. **A spec manda substituir o update direto.** §5, literal: "`gravarComHistorico`
   **substitui** o `.update(...)` direto que `_actions.ts` faz hoje — não se soma a ele."
2. **O update de hoje grava três dessas colunas.** `liberarObraAction`
   (`app/obras/obra/[id]/_actions.ts:143-159`) grava `pendencia`, `pend_resp` e
   `prox_acao` (`:156-158`) junto com os cinco campos da Triagem. Quando a Parte 2 trocar
   esse `.update()` pela RPC, como a spec manda, **os três param de ser gravados** e nada
   acusa: sem erro, sem teste vermelho, sem linha de histórico (esses campos não são
   rastreados, por decisão da spec §6 — o que mascara o sumiço ainda mais).
3. **Quem implementou acreditava que dava para passar qualquer coluna.** O teste
   `historico.test.ts:153-164` — o único que exercita o caminho "nada rastreado mudou, mas
   o update precisa acontecer" — usa literalmente `campos: { bloqueio: 'Clima' }`.
   `bloqueio` está fora da lista. O teste passa porque o `supabase` é um mock
   (`jest.fn()`), e o mock não tem como saber o que a função SQL faria. **O teste verde
   está ensinando ao autor da Parte 2 um uso que em produção perde o dado.**

Note a assimetria que torna isso perigoso: a spec §6 decidiu deliberadamente que esses
campos ficam **fora do histórico**. Ficar fora do *histórico* e ficar fora do *update* são
coisas diferentes, e a lista estática confundiu as duas.

**Por que bloqueia, e não é "Importante".** A migration ainda não foi aplicada — este é o
momento mais barato possível para corrigir. Depois de rodada à mão em produção, mudar a
lista exige outra migration (`create or replace function`) e outra janela de verificação.
E o teste, do jeito que está, propaga o erro para a Parte 2 em vez de pegá-lo.

**O que precisa ser decidido (não estou prescrevendo a correção):** ou a lista do `set`
passa a cobrir todas as colunas que o módulo escreve por tela, ou a função passa a
**recusar** chave desconhecida em `p_campos` em vez de ignorá-la (falhar alto, já que a
transação é atômica mesmo), ou fica registrado explicitamente na spec que a RPC só atende
os campos rastreados e que `liberarObraAction` continua com um segundo update — o que
custa a atomicidade que a seção D promete. As três são decisões de produto/arquitetura,
não de código.

---

## Importante

### I1 — `timestamptz` renderizado sem fuso, contra o padrão que o próprio módulo já tem

**Arquivo:** `app/obras/obra/[id]/_historico.tsx:59`

```tsx
<span>{new Date(l.created_at).toLocaleString('pt-BR')}</span>
```

**O problema.** `toLocaleString` sem `timeZone` usa o fuso de quem executa. `_historico.tsx`
é Client Component (`:1`), mas o Next.js **renderiza Client Components no servidor também**
— e o container roda em UTC. O HTML do servidor sai com uma hora, o navegador (BRT) hidrata
com outra: divergência de hidratação no React e, no primeiro paint, a hora errada em 3 horas.

**Como se prova que é problema:**

- `app/obras/_lib/tipos.ts:26-32` documenta exatamente esta armadilha, com nome e motivo:
  "o hub roda em UTC, e das 21h em diante o dia UTC já virou enquanto no Brasil não". A
  constante `FUSO` existe por causa disso.
- O módulo **já tem o precedente certo para este mesmo problema**:
  `app/obras/sincronizar/_historico.tsx:23` formata um `timestamptz` com
  `timeZone: 'America/Sao_Paulo'` explícito. O componente novo é o único lugar de
  `app/obras/` que formata data-hora sem fuso.
- Nenhum teste cobre o carimbo de tempo: `_historico.test.tsx` passa `created_at` nas
  fixtures (`:21`, `:25`, `:44`) e nunca faz asserção sobre a hora exibida. Trocar o
  formatador não quebra nada.

O histórico existe para responder "quem mudou e **quando**". Uma hora que muda sozinha
entre o servidor e o navegador é exatamente o dado que não pode estar errado aqui.

### I2 — `campos` e `linhas` não são amarrados: dá para mudar um campo rastreado sem gerar histórico

**Arquivo:** `app/obras/_lib/historico.ts:144-156`, `sdd-sql-obras-historico.sql:137`

**O problema.** `gravarComHistorico` recebe `campos` (colunas cruas) e `linhas` (diff de
domínio) como dois parâmetros independentes, e a RPC não cruza um com o outro: o insert só
acontece `if jsonb_array_length(...) > 0` (`:137`). Uma chamada com
`campos: { inicio_plan: '2026-10-01' }` e `linhas: []` atualiza a data no banco e **não
grava nenhuma linha de histórico**, sem erro nenhum.

Isso também é a resposta à pergunta "a trava do motivo obrigatório tem como ser furada?" —
tem, por três caminhos, do mais grave para o menos:

1. **Pelo `campos`, sem passar pelo diff.** O acima: a data muda, zero histórico, zero
   motivo, zero erro. A função pura nem é chamada.
2. **Omitindo a flag.** A trava em `historico.ts:123` só dispara com
   `opts.exigirMotivoRemarcacao === true`. Sem a flag, `inicio_plan` muda e a linha é
   gravada com `motivo: null`. Isto é sancionado pela spec §8 (a trava de produto fica na
   Server Action), então não é bug — mas é bom estar escrito que a única trava de
   Parte 1 é uma flag que o chamador escolhe passar.
3. **Motivo só de espaços** é barrado pelo `.trim()` do guard (`:124`) — este caminho está
   fechado.

**Como se prova:** o teste `historico.test.ts:153-164` é literalmente uma chamada bem
sucedida com `linhas: []` e um payload de coluna. O mecanismo está exercitado e aprovado
no teste; só não é o `inicio_plan` no exemplo.

A spec registra isto como Risco 1 e sugere uma mitigação — "um teste de integração (ou grep
de CI) que falhe se `_actions.ts` tiver uma chamada a `.from('obras_obra').update(` fora de
`gravarComHistorico`" — que **não foi implementada** e não vira task no plano. Marco como
Importante, não bloqueador, porque a spec conscientemente delega à Parte 2; mas quem
receber a Parte 2 precisa saber que herda isto sem nenhuma rede.

### I3 — Cinco testes que passariam com a regra removida

Esta é a categoria que o pedido chamou de "teste que não testa". Todos verificados lendo o
teste e a regra correspondente:

**(a) `app/obras/__tests__/historico.test.ts:49-57`** — o nome do teste é "formata data,
moeda, booleano **e etapa**", e a entrada muda `etapa: 'levantamento' → 'andamento'`, mas
**não existe nenhuma asserção sobre `etapa`**. Só `valor` e `mau_uso` são checados, com
`toContainEqual`, que não verifica o tamanho do array. Se `formatarValor` parasse de
formatar `etapa`, ou se `etapa` deixasse de gerar linha, o teste continuaria verde.

**(b) `app/obras/__tests__/historico.test.ts:73-76`** — a formatação `` `${v} dias` ``
(`historico.ts:92`) não tem **nenhuma** asserção. O único teste que menciona `duracao` é o
de valores numericamente iguais, que devolve `[]`. Trocar `` `${v} dias` `` por
`String(v)` não quebra teste algum.

**(c) `app/obras/obra/[id]/__tests__/_historico.test.tsx:6-14`** — a regra
`entrada.fonte === 'field' ? ' · Field' : ''` (`_historico.tsx:78`) só é testada no ramo
verdadeiro. Não há caso com `fonte: null`. Trocar a condição por `' · Field'` fixo passa
em todos os testes — e aí toda obra criada à mão apareceria como vinda do Field.

**(d) `_historico.test.tsx`** — a regra "a linha de Entrada só aparece com o filtro Todos"
(`_historico.tsx:75`) não tem teste nenhum. Remover o `filtro === 'Todos' ?` não quebra
nada. É um comportamento que a spec §10 especifica literalmente ("sempre aparece por
último, e só quando o filtro é 'Todos'").

**(e) `app/obras/__tests__/historico.test.ts:5-17` e `:19-24`** — o primeiro teste só checa
`toBeTruthy()` dos 19 rótulos; o segundo checa 4 deles. **15 rótulos podem estar errados
sem quebrar teste**, incluindo os que a spec §6 fixa palavra por palavra ("Data de fim da
execução em campo", "Data do faturamento liberado"). O arquivo `historico.ts:6-9` diz que
rótulo é traduzido na leitura justamente para poder mudar sem backfill — o que torna o
dicionário o único lugar onde um erro de rótulo é invisível.

### I4 — A regra "`''` e `null` são a mesma coisa" não tem teste, e é ela que impede linha falsa

**Arquivo:** `app/obras/_lib/historico.ts:101-102`

O código está **correto**: `iguais` normaliza `''` e `undefined` para `null` antes de
comparar, então `null → ''` não gera linha, e `'' → null` também não. Respondendo
diretamente à pergunta do pedido: **não, `null` virando vazio não gera linha falsa hoje.**

O problema é que essa normalização não tem teste. O teste mais próximo
(`historico.test.ts:44-47`) cobre campo **ausente**, que é `undefined`, não `''`.

Isso importa mais do que parece porque `''` é exatamente o que um formulário HTML manda
quando o usuário limpa um campo: `_actions.ts:28-31` tem a função `nulo()` justamente para
converter `''` em `null` antes de gravar, e a Parte 2 vai montar o `depois` a partir de
`FormData`. Se essa linha regredir, o sintoma não é um erro — é o histórico ganhando uma
linha "Liberado por: — → —" toda vez que alguém salva um bloco sem mexer em nada. Ruído que
destrói a utilidade da tela, sem nenhum teste vermelho.

---

## Menor

### M1 — `formatarValor` pode gravar a string `'—'` no banco, quebrando a convenção de vazio
`app/obras/_lib/historico.ts:95` chama `br(String(v))`, e `br` (`_lib/tipos.ts:94-99`)
devolve o literal `'—'` quando a data não tem 3 partes. O comentário da spec §2 é explícito:
"`null` = campo estava/ficou vazio, exibido como '—'. Nunca `''`". Uma data malformada vira
o **texto** `'—'` gravado na coluna, indistinguível na tela de um vazio de verdade, mas
diferente no banco — e permanente, porque a tabela não tem update.

### M2 — `moeda(Number(v))` grava `"R$ NaN"` para valor não numérico
`app/obras/_lib/historico.ts:91`. `Number('abc')` é `NaN`, e `moeda` (`_lib/tipos.ts:102-107`)
só trata `null`/`undefined` — `NaN.toLocaleString('pt-BR', …)` devolve `"NaN"`. Vai para o
banco como `"R$ NaN"`.

### M3 — O motivo é validado com `trim()` mas gravado sem
`app/obras/_lib/historico.ts:124` valida `(opts.motivoRemarcacao ?? '').trim()`; `:137`
grava `opts?.motivoRemarcacao ?? null`, o valor cru. Um motivo digitado como `"  adiou  "`
entra no histórico com os espaços.

### M4 — `clock_timestamp()` diverge do default `now()` da própria coluna
`sdd-sql-obras-historico.sql:105` usa `clock_timestamp()`; o default da coluna (`:34`) é
`now()`. Como é capturado uma vez por chamada, o requisito da spec §7 ("as duas linhas da
mesma chamada com o mesmo `created_at`") **está cumprido**. Mas `clock_timestamp()` avança
dentro da transação e `now()` não: duas linhas gravadas por caminhos diferentes ficam em
bases de tempo levemente diferentes, sem motivo.

### M5 — Empate de `created_at` deixa a ordem de exibição indefinida
O índice (`sdd-sql-obras-historico.sql:67-68`) e a leitura prevista pela spec §11 ordenam
só por `created_at desc`. Como todas as linhas de uma chamada compartilham `v_quando`
(`:105`), as duas linhas de "concluir etapa" (etapa + marco) empatam e o Postgres pode
devolvê-las em qualquer ordem, mudando de render para render. Falta um desempate (`id`,
ou a ordem de inserção).

### M6 — A combinação `bloco` × `campo` não é validada em lugar nenhum
Os dois check constraints (`sdd-sql-obras-historico.sql:46` e `:56-62`) são independentes, e
`linhasDeAlteracao` aceita qualquer `bloco` para qualquer `campo`. Um
`{ bloco: 'Triagem', campo: 'marco_faturou' }` entra no banco, embora a tabela da spec §6
defina quais pares existem. O tipo `BlocoHistorico` também não restringe por campo.

### M7 — O log é append-only, mas não é "só pela RPC"
A policy de insert (`sdd-sql-obras-historico.sql:81-86`) exige apenas `obras_has_access()`
e `quem` igual ao próprio e-mail. Qualquer usuário com acesso ao módulo pode inserir linhas
direto em `/rest/v1/obras_historico` — em nome próprio, mas com `de`/`para`/`created_at`
livres e sem nenhuma alteração correspondente na obra. A spec §3 previu a defesa contra
forjar **autor**, que funciona; vale ficar registrado que forjar **conteúdo** continua
possível para quem tem acesso.

### M8 — O contador do cabeçalho não bate com a lista quando há filtro
`app/obras/obra/[id]/_historico.tsx:32` mostra `String(linhas.length)` (o total), enquanto
a lista renderiza `filtradas` (`:28`). Com um chip ativo, o número no cabeçalho contradiz o
que está na tela.

### M9 — O texto do estado vazio assume Field mesmo quando a fonte não é Field
`app/obras/obra/[id]/_historico.tsx:53`: "Nenhuma alteração desde a entrada pelo Field",
fixo — enquanto o rodapé logo abaixo (`:78`) trata `fonte !== 'field'` condicionalmente. Uma
obra cadastrada à mão mostra um texto que afirma algo falso sobre a própria origem.

### M10 — Rótulo ausente renderiza `undefined` na tela
`app/obras/obra/[id]/_historico.tsx:64` faz `ROTULO_CAMPO[l.campo]` sem fallback. Hoje é
inalcançável (o check constraint garante que `campo` está na lista), mas a spec §6 define
como caminho de evolução exatamente "(1) `alter table … add constraint …`; (2) uma entrada
nova no dicionário" — dois passos, em dois lugares, sem nada que force o segundo. Se o
dicionário ficar para trás, a tela escreve `undefined:` em vez de falhar visivelmente.
`nomeEtapa` (`_lib/tipos.ts:655-657`), o precedente que o próprio arquivo cita, tem
fallback (`?? etapa`).

---

## Verificações rodadas

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | limpo, sem saída |
| `npx jest` nos 2 arquivos novos | 2 suítes, 19 testes, todos passando |
| `npm test` (completo) | 747 testes passando; 7 suítes de `manfac-site/` falham por módulo não resolvido — **pré-existente, fora do diff** |
| `git diff master...HEAD` nos 3 arquivos restritos | vazio; blobs idênticos entre `master` e `HEAD` |

Nada foi executado contra banco ou produção. A RPC não foi testada de verdade — como a
própria spec §13.5 registra, ela só é verificável rodando contra o Postgres, e a seção 4 da
migration traz o SQL de verificação para esse momento. **O B1 acima é justamente o tipo de
defeito que a leitura pega e o teste com mock não pega** — vale reler essa seção de
verificação depois de decidir o que fazer com a lista de colunas.
