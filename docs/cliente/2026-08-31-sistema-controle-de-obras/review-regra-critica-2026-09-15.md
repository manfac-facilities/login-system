# Code review — Regra de atenção / crítica (J4, seção E)

**Data:** 2026-09-15. **Revisor:** subagente independente (não escreveu nada do que está
sendo revisado). **Régua:** `superpowers:requesting-code-review`.

**Objeto:** branch `worktree-agent-ab4c29b5eb1b12b0b`, 5 commits sobre `master`
(`77c2145..5560921`), 10 arquivos, +1619/−45.

**Revisado contra:** `spec-regra-critica-2026-09-15.md`, `plano-regra-critica-2026-09-15.md`,
`feedback-14-mockup-j4-v01.md:31-34` (fala literal do cliente),
`j4-decisoes-2026-09-14.md:46` (decisão 5 revista), `decisoes-joao-2026-09-15.md`.

**Nada foi alterado, nada foi commitado, nada rodou contra banco ou produção.**

Tratados como **escopo, não achado**, conforme instrução do coordenador: a regra viver em
`_lib/tipos.ts`; a Task 5 (decisão 12) não executada e presente só como `it.todo`; a entrada
ser candidata permanente da âncora.

## Resumo

| Severidade | Quantidade |
|---|---|
| **Bloqueia o merge** | 1 |
| **Importante** | 5 |
| **Menor** | 8 |

**Há um bloqueador** — B1. Não é sobre a regra, que está correta: é sobre dois arquivos
editados contra uma proibição explícita do próprio plano, um deles sendo reescrito por outra
frente neste momento.

## O que está certo (verificado caso a caso, não presumido)

- **A fronteira "acima de" está certa nos quatro pontos.** `critico` usa `diasAlerta > 30`
  (`tipos.ts:500-506`) e `classeDias` usa `diasAlerta > 20` (`tipos.ts:615-620`), com `>` estrito.
  Refiz as contas dos testes à mão, com `H = 2026-09-14`: `2026-08-25` → 20 → `''`;
  `2026-08-24` → 21 → `atencao`; `2026-08-15` → 30 → `atencao`; `2026-08-14` → 31 →
  `critico`. Bate com a letra do cliente ("acima de 20… acima de 30") e com a spec §3.2.
- **O piso em 0 funciona e está isolado.** `Math.max(0, …)` em `tipos.ts:425`; o teste de data
  futura fixa `created_at: ''` de propósito, senão a entrada venceria a âncora antes de o piso
  entrar em jogo. Sem esse cuidado o teste não provaria nada — e ele tem o cuidado.
- **A âncora implementa a prioridade certa.** `ancoraDias` (`tipos.ts:472-487`) parte da
  entrada e deixa liberação e aprovação sobrescreverem com `<=`, nessa ordem, então em empate
  vence aprovação > liberação > entrada, como pedido.
- **`dataSP` está correta na virada do dia e na virada do mês.** Ela delega a `hojeISO`
  (`tipos.ts:36-45`), que usa `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` — a
  troca de mês e de ano é feita pelo formatador, não por aritmética, então não há caso de
  borda a errar. Conferido: `2026-09-15T01:30Z` → `2026-09-14` (testado);
  `2026-09-01T02:00Z` → `2026-08-31` (não testado, mas correto por construção).
- **A liberação só conta com nome**, como a action grava (`tipos.ts:478`), e `liberado_por` sem
  data não inventa data — spec A4 cumprida, com teste.
- **`dias` não mudou de significado.** Continua `diasDesde(o.aprovacao)` e continua alimentando
  `estourou` e o KPI de 60 dias, como a spec §3.3 e a ambiguidade A3 mandam.
- **A Task 5 está como o coordenador determinou:** um `it.todo` em `tipos.test.ts:492-500`, com
  o motivo do bloqueio escrito. `npm test` confirma `1 todo`. `encerrada` continua por etapa.
- **`npx tsc --noEmit` limpo. `npm test`: 758 passando, 1 todo.** As 7 suítes que falham são de
  `manfac-site/` (`Cannot find module '../../lib/content'`) — **pré-existentes, fora do diff**;
  `manfac-site` não faz parte do hub (`AGENTS.md`). Não atribuir a esta branch.

---

## Bloqueia o merge

### B1 — Dois arquivos editados contra a proibição explícita do plano, um deles em reescrita por outra frente

**Arquivos:** `app/obras/obra/[id]/_ficha.tsx:289-300` e `app/obras/diario/_cartao.tsx:228`
(commit `02defb4`)

**O problema.** O plano, em Global Constraints, é literal:

> **Não tocar:** `app/obras/obra/[id]/_actions.ts`, `_triagem.tsx`, `_ficha.tsx` (outra frente
> mexe em paralelo), `app/obras/diario/*`, `app/obras/_ui/*`.

E a spec §6 ("O que NÃO entra") repete: "Textos de `_ficha.tsx`, `_triagem.tsx` e
`diario/_cartao.tsx`". O commit `02defb4` edita exatamente dois desses: troca `obra.dias` por
`obra.diasAlerta` e o texto "dias desde a aprovação" por "dias em aberto" nos dois.

**Como se prova que é problema:**

1. **A spec sabia que `_ficha.tsx` está em reescrita.** §5, linha 172, classifica
   `obra/[id]/_ficha.tsx:249-334` como "**ARQUIVO EM PARALELO**, sinalizar à outra frente" — o
   verbo é *sinalizar*, não *editar*. A frente da J4 está reescrevendo esse arquivo (seção C,
   nomes de etapa, blocos editáveis). Estas 4 linhas vão colidir com essa reescrita, e o lado
   que perder o merge perde silenciosamente — ninguém relê um conflito resolvido por
   "aceitar o meu".
2. **`_ficha.tsx` é o mesmo arquivo que a frente do histórico declarou intocável.** Na Parte 1
   do histórico (branch `worktree-agent-aec15e14f7f4ed10e`, revisada hoje) `_ficha.tsx` está
   com o blob `1e9aecc…`, idêntico ao de `master`, e a fronteira foi respeitada de propósito.
   Esta branch move o mesmo arquivo para `d8611bb…`. Duas frentes com regras opostas sobre o
   mesmo arquivo é exatamente a situação que a instrução queria evitar.
3. **O escopo que o coordenador autorizou nesta rodada foi outro.** A autorização dada foi "a
   regra vive em `_lib/tipos.ts`, não em `base/`" — que cobre `tipos.ts`, e só. `_ficha.tsx` e
   `diario/` não foram mencionados em nenhum momento.
4. **A edição está incompleta de qualquer forma** — ver I1: o título da mesma caixa continua
   dizendo "Obra aprovada em —". Ou seja, o custo da violação foi pago sem que o benefício
   (coerência da tela) fosse inteiro.

**O que precisa ser decidido (não estou prescrevendo).** Ou o coordenador abençoa
explicitamente estas duas edições e avisa a frente da J4 antes do merge, ou os dois arquivos
saem da branch e viram um item para quem estiver reescrevendo `_ficha.tsx`. O que não dá é
mergear uma edição não autorizada num arquivo que outra pessoa está reescrevendo agora.

**Nota de justiça:** o *conteúdo* das edições está certo, e o item 5 da sua pergunta ("sobrou
algum lugar mostrando `dias` antigo com texto de 'desde a aprovação'?") sugere que você quer
essa coerência. O defeito é de processo e de sequenciamento, não de julgamento técnico.

---

## Importante

### I1 — A correção de `_ficha.tsx` ficou pela metade: o título ainda diz "Obra aprovada em —"

**Arquivo:** `app/obras/obra/[id]/_ficha.tsx:294`

```tsx
Obra aprovada em {br(obra.aprovacao)} e ainda não concluída.
```

A caixa vermelha aparece quando `critico(obra) && obra.duracao` (`:285`). Com a regra nova,
`critico` pode ser verdadeiro **sem nenhuma aprovação** — é o caso 7 e o caso 10 da spec §4
(obra que conta da entrada ou da liberação). Nesse caso `br(null)` devolve `'—'`
(`tipos.ts:107-111`) e a tela escreve, em vermelho e em negrito: **"Obra aprovada em — e ainda
não concluída."**

**Como se prova:** a spec §5, linha 172, previu exatamente este defeito e listou os três
pontos: `:289` (número vazio), `:298` ("contados  dias desde a aprovação") e `:300` ("0
vezes"). A branch corrigiu `:289`, `:298` e `:300` — e deixou `:294`, que é o **título**, o
texto de maior destaque da caixa. O mesmo diagnóstico que guiou a correção apontava para esta
linha.

Antes da mudança o defeito era coerente (todos os números vinham de `aprovacao`, e sem
aprovação a caixa nem aparecia, porque `critico` exigia `dias !== null`). Agora a caixa
aparece para obra sem aprovação e afirma uma aprovação que não existe.

### I2 — A Triagem passou a mostrar dois números contraditórios na mesma tela

**Arquivos:** `app/obras/obra/[id]/_triagem.tsx:136` (selo) e `:147` (texto)

O selo no cabeçalho é `<BadgeDias obra={obra} />`, que agora mostra `diasAlerta` e a âncora.
Onze linhas abaixo, o parágrafo diz:

```tsx
esperando há <b>{obra.dias ?? 0} dias</b>
```

que continua sendo `dias` (desde a aprovação). Numa obra vinda do Field — sem `aprovacao`,
que é o caso normal da Triagem — `dias` é `null`, então o texto diz "**esperando há 0 dias**"
enquanto o selo logo acima diz "**75 dias desde a entrada**".

**Como se prova que a branch causou isto:** antes da mudança, `BadgeDias` também mostrava
`obra.dias` (`base/_etiquetas.tsx` em `master`). Os dois diziam 0 — errado, mas **coerente**. A
spec §5, linha 175, classificou o `:147` como "erro pré-existente" e o deixou de fora; o que
ela não registrou é que mexer no selo transforma um erro escondido em **contradição visível**,
lado a lado, na tela que o cliente vai usar para triar obra nova.

`_triagem.tsx` está na lista "Não tocar", então a branch fez certo em não editar — o achado é
que a consequência não foi levada ao coordenador.

### I3 — O diário ordena por um número e exibe outro

**Arquivos:** `app/obras/diario/_cartoes.tsx:64` (ordenação) e `_cartao.tsx:228` (exibição)

`_cartoes.tsx:64` ordena a fila do dia por `(b.dias ?? 0) - (a.dias ?? 0)` — desde a
aprovação. O cartão, depois do commit `02defb4`, mostra `obra.diasAlerta` com o rótulo "dias
em aberto".

Resultado: a lista aparece fora de ordem para quem lê. Uma obra com 108 dias em aberto (sem
aprovação, `dias = null` → 0) vai para o **fim** da fila, abaixo de uma obra com 30 dias em
aberto que tem aprovação antiga. O usuário vê "108 dias em aberto" no rodapé da lista e "30
dias em aberto" no topo.

A spec §5, linha 171, diz que `_cartoes.tsx:64` "não muda" — decisão legítima enquanto o
cartão também mostrasse `dias`. Ao mudar o cartão (a violação de B1), a branch quebrou o par.
Ou os dois mudam, ou nenhum.

### I4 — A spec ensina a regra velha em §3.1 e §4, e a nova só em §1

**Arquivo:** `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-regra-critica-2026-09-15.md`

A spec se contradiz internamente:

- **§1, linha 16** (decisão do João, 15/09): "a **entrada** vira candidata à âncora **sempre**,
  não só quando faltam aprovação e liberação — vale para obras cujas datas já existiam".
- **§3.1, regra 5**: "**Sem nenhuma das duas**, conta da **entrada**" — entrada como *fallback*.
- **§4, tabela de casos**: calculada inteira com a entrada como fallback. Os casos **1, 2, 5,
  10, 11 e 12** dão resultado diferente sob a regra implementada. O caso 1, o emblemático
  "104 dias", vira **108 dias desde a entrada** (entrada 2026-05-29 é anterior à liberação
  2026-06-02) — e é isso que o teste `etiquetas.test.tsx:60-74` afirma.

A implementação escolheu §1 (a decisão mais recente), e escolheu **certo**. O problema é o
documento: quem abrir esta spec amanhã para escrever a v02 do mockup, o SLA 1 ou a Parte 2 vai
ler §3.1 e a tabela §4, que são a regra que não está no código. A contradição C1, que §7
registra como aberta, já foi resolvida pela decisão do João — e continua listada como aberta.

### I5 — A consequência de produto da âncora permanente não está escrita em lugar nenhum

Esta é a resposta ao seu item 3, desenvolvida abaixo na seção própria. Em resumo: a
implementação está **certa**, mas a regra que ela implementa deixou de ser a que o cliente
descreveu, e ninguém registrou isso. No regime normal de operação a contagem passa a ser
"dias desde que a obra entrou no sistema", e aprovação e liberação viram quase irrelevantes.
Isso precisa voltar ao João — não ao código.

---

## Resposta ao item 3 — a entrada vencendo datas que já existiam é legítima, não exagero

**Veredito: é consequência legítima da decisão do João, e a implementação fez o mínimo que a
decisão exige. Não é exagero do implementador.** Mas a decisão tem um efeito que ninguém
escreveu, e ele é grande.

**Por que é legítima.** A decisão do João é "registrar uma data nunca derruba a contagem".
Suponha a entrada como *fallback*, como diz §3.1:

- Obra entra no sistema em **29/05**. Não tem aprovação nem liberação. Em 14/09 ela conta da
  entrada: **108 dias**, crítica.
- Alguém registra a liberação, com data **02/06**. A âncora deixa de ser a entrada e passa a
  ser a liberação: **104 dias**.
- **A contagem caiu 4 dias porque alguém preencheu um campo.** É exatamente o que a decisão
  proíbe.

Para impedir isso sem uma trilha de auditoria de "quando a coluna foi preenchida" — que não
existe, e que a tabela de histórico da outra frente ainda não grava —, a única regra sem
estado possível é "a mais antiga das três, sempre". É o que `ancoraDias` faz
(`tipos.ts:484-486`). Não há versão mais contida que continue honrando a decisão: qualquer
regra que use a entrada só às vezes reintroduz o degrau. A spec §1, linha 16, inclusive
antecipa isto por escrito — "vale para obras cujas datas já existiam, não só para data
registrada depois".

**Por que ainda assim precisa voltar ao João.** O cliente, no feedback 14, disse:

> "a sinalização de atenção fica acima de 20 dias **da data de aprovação da OS ou liberação**,
> a que for menor"

O cliente nomeou **duas** datas. A entrada não está na frase dele — ela entrou pelo mockup,
como saída para a obra que não tem nenhuma das duas. Com a entrada como candidata permanente,
o regime normal de operação inverte:

> Obra sincronizada do Field hoje. É liberada daqui a 40 dias e a OS é aprovada daqui a 60.
> No dia da liberação ela já está **crítica há 10 dias**, contando da entrada — antes de
> existir qualquer aprovação ou liberação para contar.

Como o fluxo normal é entrar pelo Field **primeiro** e ser aprovada/liberada **depois**, a
entrada será a data mais antiga na **maioria** das obras. Na prática a regra do cliente ("dias
desde a aprovação ou liberação") vira "dias desde que a obra apareceu no sistema", e os dois
campos que ele nomeou deixam de decidir quase sempre.

Agrava dois pontos já registrados e não resolvidos:

- **`created_at` não é a entrada da obra, é a hora do `insert`** (spec §2 e §8). Para a carga
  inicial do Field, *todas* as obras nascem com `created_at` = o dia da carga, então a régua
  do primeiro mês mede a carga, não a obra.
- **O cliente nunca viu este número.** Ele avaliou o mockup com 100/60 e a entrada como
  fallback, e respondeu "aqui só muda o critério de tempo". Ele não julgou "conta da entrada
  sempre".

**Recomendação explícita:** manter o código como está — ele cumpre a decisão — e levar ao João
uma pergunta só: *"a contagem deve começar quando a obra entra no sistema, mesmo antes de
qualquer aprovação ou liberação?"*. Se a resposta for não, a saída que preserva as duas
exigências é gravar a data em que a autorização foi registrada (a tabela de histórico da outra
frente serve) e usar a entrada só até a primeira autorização existir — aí a contagem nunca
cai **e** a régua volta a ser a do cliente. Isso é decisão de produto, não refatoração.

---

## Resposta ao item 4 — as quatro mudanças de número, uma a uma

Refiz cada conta à mão, com as fixtures reais (`tipos.test.ts` tem `created_at:
'2026-08-31T00:00:00Z'` → entrada **2026-08-30** em SP; `base.test.ts` tem
`'2026-08-20T00:00:00Z'` → **2026-08-19**).

**Nenhuma das quatro foi acomodada para ficar verde.** Detalhe:

1. **`critico`: 99/100 → 30/31** (`tipos.test.ts:241-244`). Acompanha a regra: o limiar mudou
   de `>= 100` para `> 30`. Confere: `2026-08-15` → 30 → `false`; `2026-08-14` → 31 → `true`.
2. **`classeDias`: 60/100 → 20/21/30/31** (`tipos.test.ts:474-479`). Acompanha a regra. O teste
   ganhou `duracao: null` com o comentário certo: com a `duracao: 7` da fixture, `estourou()`
   pintaria âmbar a partir de 29 dias e mascararia a fronteira dos 20. Isso é **isolar a
   variável**, não acomodar — sem isso o teste dos 21 dias passaria pelo motivo errado.
3. **`ordenar`: `[91, 16, 2]` — o número não mudou** (`base.test.ts:250-260`), só a propriedade
   lida (`dias` → `diasAlerta`) e a fixture, que ganhou `created_at: '2026-08-30T00:00:00Z'`.
   Sem isso, a entrada (2026-08-19) venceria a âncora em uma das três obras e o resultado
   viraria `[91, 16, 12]`. O ajuste **preserva** o que o teste se propõe a verificar (a
   ordenação), e a perda de cobertura foi compensada com um teste novo — `'ordena pela âncora,
   não pela aprovação'` (`base.test.ts:264-271`), que eu recalculei: `liberadaAntes` ancora na liberação
   (91 dias) e `soAprovada` na aprovação (16), então a ordenação por âncora é genuinamente
   exercitada. Legítimo.
4. **`COLS`: "Dias desde a aprovação" → "Dias em aberto"** (`base.test.ts:335`). Não é número;
   acompanha `_regras.ts:237` e a decisão provisória da spec A5.

**O teste que eu mais desconfiei — e que passou no escrutínio:** `'estourou continua pintando
de âmbar com poucos dias'` (`tipos.test.ts:481-484`). Ele não fixa `created_at`, então a
entrada (2026-08-30) **vence** a aprovação (2026-09-01) e `diasAlerta` é **15**, não os 13 que
o comentário do teste sugere. Mas a conclusão se sustenta: 15 não passa de 20, então o âmbar
só pode ter vindo de `estourou()` (13 dias > `duracao * 4` = 12). Se `estourou` saísse de
`classeDias`, o teste ficaria vermelho. **Ele prova o que promete** — o comentário é que está
impreciso (M6).

---

## Resposta ao item 2 — o desempate muda algo visível?

**Muda só o texto do selo, nunca o número nem a cor.** Em empate as datas são iguais por
definição, então `diasAlerta` é idêntico e `classeDias` também; o que muda é
`sufixoDias` (`_regras.ts:290-293`) escrever "dias desde a **aprovação**" em vez de "desde a
**liberação**". Coberto por `tipos.test.ts` (`'mesma data nas duas: fica com a aprovação'`).
A prioridade implementada — aprovação > liberação > entrada — é a que você especificou, e cai
fora naturalmente da ordem das três atribuições em `tipos.ts:481-485`.

---

## Menor

### M1 — O Kanban ordena por `dias` e exibe `diasAlerta`
`app/obras/base/_kanban.tsx:110-111` ordena por `paradaEtapa ?? dias`, enquanto os cartões
mostram `BadgeDias` (agora `diasAlerta`). Mesma classe de I3, mas dentro do perímetro
autorizado e declarado "não muda" pela spec §5:168 — fica como dívida consciente.

### M2 — O KPI "a mais antiga há N dias" continua dizendo 0 para obra do Field
`app/obras/base/_regras.ts:322`: `aDefinir.reduce((m, o) => Math.max(m, o.dias ?? 0), 0)`. Obra
em `definir` vinda do Field não tem `aprovacao`, então entra como 0 e o painel anuncia "a mais
antiga há 0 dias". A spec §5:163 declarou "não muda" — mas agora existe o número certo
(`diasAlerta`), e o painel é justamente onde a obra esquecida deveria aparecer.

### M3 — O comentário do piso cita a spec ao contrário
`app/obras/_lib/tipos.ts:346-351` diz "Piso em 0 (spec A10)". A spec, em §7/A10, diz o oposto:
"Data futura (erro de digitação) · Contagem negativa · **Não trata (igual a hoje)**". O piso
veio de decisão sua, não da spec. O comentário manda o próximo leitor a um parágrafo que diz
outra coisa.

### M4 — `dataSP` não tem teste de virada de mês nem de ano
`tipos.test.ts:645-650` cobre a virada do **dia** (01h30 UTC → dia anterior em SP) em três
formatos. Não há caso de `2026-09-01T02:00Z` → `2026-08-31` nem de virada de ano. O código está
correto por delegar a `Intl` (por isso não é achado maior), mas é a conversão de que a regra
inteira depende.

### M5 — `ancoraDias` valida com `msDe` e compara como string
`tipos.ts:475-478` aceita a data se `msDe(...) !== null` e depois guarda e compara a **string
crua** (`lib <= melhor.data`, `:485-486`). `msDe` (`tipos.ts:60-68`) só exige 3 partes numéricas
finitas, então `'2026-8-1'` (sem zero à esquerda) ou `'2026-13-45'` passam na validação e
comparam errado lexicograficamente. Inalcançável vindo de uma coluna `date` do Postgres —
registrado porque a função é exportada e aceita qualquer `Pick`.

### M6 — O comentário do teste de `estourou` cita o número errado
`tipos.test.ts:482`: "duracao 3 → estoura acima de 12 dias desde a aprovação; 13 dias < 20". O
número que decide a comparação com 20 é `diasAlerta` = **15** (a entrada da fixture vence a
aprovação), não 13. A conclusão do teste continua válida; o comentário leva o leitor a conferir
a conta errada.

### M7 — O comentário do `entradaTardia` não é exato
`base.test.ts:252-255` diz "created_at depois de todas as aprovações". `'2026-08-30T00:00:00Z'`
vira **2026-08-29** em São Paulo, que **empata** com a aprovação `2026-08-29` de uma das três
obras — ali quem decide é o desempate (aprovação vence), não a ordem das datas. O resultado é o
mesmo; a explicação é que não descreve o mecanismo.

### M8 — A Triagem afirma que a obra entrou pelo Field na data de aprovação
`app/obras/obra/[id]/_triagem.tsx:146`: "Ela entrou pelo Field em **{br(obra.aprovacao)}**".
Erro pré-existente, já listado nas contradições da conciliação de 14/09 ("Triagem diz 'entrou
pelo Field em {data de aprovação}' → a OS chega sem essa data; usar a data de entrada"). Cito
aqui porque esta branch **criou o dado que corrige isso**: `ancora.de === 'entrada'` com
`ancora.data` é exatamente a data que a frase quer. Fica anotado para quem reescrever o
arquivo.

---

## Verificações rodadas

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | limpo, sem saída |
| `npm test` | 758 passando, **1 todo** (a Task 5, como determinado); 7 suítes de `manfac-site/` falhando por módulo não resolvido — **pré-existente, fora do diff** |
| Conferência manual das fronteiras 20/21/30/31 e do piso 0 | bate com a spec §3.2 e com a fala do cliente |
| Recálculo à mão dos 4 testes com número alterado | nenhum acomodado; ver item 4 |
| `git diff master...HEAD --stat` | 10 arquivos; 2 deles (`_ficha.tsx`, `diario/_cartao.tsx`) fora do perímetro — ver B1 |
