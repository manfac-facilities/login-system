# Adendo à revisão da D2 — re-revisão do commit 2c9a0cf

Escopo: `git diff 3adbbfb 2c9a0cf -- app/` e o critério atualizado. O merge `db030d4` é só
docs. Só leitura, sem checkout, sem banco, **testes não executados** (análise por leitura).
I2 fora de escopo, por decisão do coordenador.

Linhas referem-se a `2c9a0cf`.

## Veredito: APROVAR COM RESSALVAS — corrigir N1 antes do merge

I1, I3, M1 e M3 estão fechados. A correção do I1 trouxe um defeito novo no disjuntor (N1):
alertas legítimos acumulados entram na conta dos 20% e, quando passam desse limite,
**desligam a detecção de ausência para sempre**. A correção é pequena (um filtro e um
teste) e deveria entrar antes do merge. O resto é menor e pode ir como follow-up.

Contagem de achados novos: **0 bloqueadores · 1 importante · 4 menores**.

---

## Situação dos achados anteriores

| Achado | Situação | Onde |
|---|---|---|
| **I1** — varredura "completa" aceita leitura parcial/vazia | **Fechado** (disjuntor com defeito novo, ver N1) | `_lib/field/cliente.ts:193-197` (sem `items` lança), `:206` (só página curta encerra, `totalCount` removido); `sincronizar/_sincronizacao.ts:259-266` (zero OS / >20% não marcam e avisam); `_actions.ts` repassa `avisos`; `_painel.tsx` mostra "Atenção" |
| **I3** — `!== null` acendia alerta com coluna `undefined` | **Fechado** | `base/_regras.ts:123-127` (`temAlertaDeAusenciaField` exige string não vazia), usado em `_regras.ts:171` e `:195`, `_etiquetas.tsx:44`, `_kanban.tsx:45`, `_table.tsx:88` e `:151`. O grep por `field_ausente_(em\|desde) [!=]== null` em `app/` não acha nada. O plano também passou a usar `texto()` (`_sincronizacao.ts:236-237`, `:270`, `:272`) |
| **M1** — confirmação sem intervalo mínimo | **Fechado** (ressalva de jitter, ver N3) | `_sincronizacao.ts:80` (`INTERVALO_MINIMO_PARA_ALERTA_MS` = 24h), `:284-298`; o critério registra a resposta 4A do cliente |
| **M3** — flag desacoplada do `desde` | **Fechado** | `_actions.ts:90` (`opcoesDaVarredura` é o objeto passado ao cliente), `:102` (`varreduraCompleta: opcoesDaVarredura.desde === undefined`). A D3 só consegue ligar o incremental pelo mesmo objeto que desliga a ausência |

---

## Respostas às verificações pedidas

### 1. Paginação sem `totalCount`

- **Laço infinito:** não existe. O laço só termina por página curta ou por
  `offset > offsetMaximo` (`cliente.ts:208-214`, teto de 200000). Se a API ignorar o
  `offset` e devolver sempre a mesma página cheia, o laço segue até o teto: 2000
  requisições a 1 req/s, cerca de 33 minutos. A Server Action deve estourar o tempo antes
  disso, mas sem dano, porque nada é gravado antes de a leitura terminar. Ver N5.
- **Base grande (>200100 OS):** lança erro. A chamada está dentro do `try` em
  `_actions.ts:92-96`, que devolve `{ error }` **antes** de ler o banco e de planejar.
  **Nenhuma ausência é marcada.** O teste `cliente.test.ts:242` cobre o lançamento, e o
  teste de action "Field falha" confirma que nada é lido nem gravado.
- **Custo novo:** quando o total é múltiplo de 100, há uma requisição a mais, em
  `offset = total`. Seguro se a API responder `items: []` e não verificado contra a API real
  (ver N5).

### 2. Disjuntor

- **Base do cálculo** (`_sincronizacao.ts:253-257`): denominador = obras com
  `fonte='field'` e `field_id` não vazio, **inclusive as já alertadas**. Numerador = todas
  essas que não apareceram, **inclusive as já alertadas**. Esse é o defeito N1.
- **Base pequena:** o limite é `> 20%`.
  - Até 4 obras do Field, nenhuma ausência é registrada: 1 de 4 já dá 25%.
  - De 5 a 9 obras, cabe 1 ausência por varredura.
  - Com 10 obras, cabem 2.

  Cenário: nas primeiras semanas, com 3 obras do Field, o cliente exclui a OS aberta errada
  e o sistema só avisa "varredura suspeita", sem nunca marcar. Não destrói nada e o aviso
  aparece, mas a mensagem culpa a varredura, não a obra. Como o cliente vai subir "TODAS"
  as OS de uma vez (feedback 10), a janela de base pequena deve ser curta. **É aceitável,
  mas um piso absoluto resolve de graça** (ver N2).
- **A limpeza por reaparecimento não é bloqueada.** A limpeza acontece no laço principal e
  vai para `atualizar` (`:236-249`). O disjuntor só envolve `reconciliarAusencias`
  (`:259-300`). Está correto, mas não há teste combinando disjuntor disparado com
  reaparecimento.

### 3. M1 e o jitter das 24h

- **Referência de tempo:** o `agora` é `new Date().toISOString()` no servidor do app,
  calculado em `_actions.ts:103`, **depois** de terminar a leitura do Field e a do banco.
  A suspeita guarda esse mesmo instante da execução anterior. Logo, a comparação é "fim da
  leitura atual − fim da leitura anterior ≥ 24h exatas" (`_sincronizacao.ts:289`).
- **O escorregão existe** (N3). Com uma varredura completa por dia no mesmo horário, a
  confirmação vira 24h ou 48h conforme a duração da leitura. Ver o cenário em N3.

### 4. Os testes novos exercitam o caminho?

Todos falhariam com a lógica de `3adbbfb`:

- `cliente.test.ts` "totalCount defasado": `rotasCom(ordens, 200)` fixa `totalCount: 200`
  com 250 ordens. A lógica antiga pararia em 200 itens e 2 chamadas; o teste exige 250 e 3.
- "corpo sem items": antes resolvia `[]`; agora exige `rejects`.
- `base.test.ts` "coluna undefined": com `=== null`, `undefined` não seria filtrado e
  voltaria 1 item; o teste exige 0.
- `_sincronizacao.test.ts` "antes de 24 horas": suspeita às 11:59:59 com `agora` às
  12:00:00. A lógica antiga alertaria; o teste exige nada.
- "zero OS" e ">20%" (plano e action): a lógica antiga marcaria suspeitas; os testes exigem
  nenhuma e o aviso.
- Os testes antigos de suspeita e alerta foram ajustados para 1 ausente em 6 (16,7%), para
  não disparar o disjuntor. O teste de confirmação usa exatamente 24h, o que também prova o
  limite `>=`.

**Lacunas:**
- obras já alertadas entrando na conta (N1);
- limite de exatamente 20% (1 de 5);
- disjuntor disparado junto com reaparecimento que limpa alerta;
- Field vazio com base vazia (N4);
- as etiquetas, a tabela e o kanban não são testados diretamente. Aceitável, porque todos
  usam o helper testado.

M3 não é testável sem injeção, porque `opcoesDaVarredura` é constante local. É aceitável:
a garantia vem da estrutura do código.

---

## Achados novos

### IMPORTANTE

**N1 — Alertas já confirmados contam no disjuntor e, acumulados, desligam a detecção para sempre**
`app/obras/sincronizar/_sincronizacao.ts:253-257` e `:263`.

`ausentes` inclui obras com `field_ausente_em` já preenchido, que o laço de marcação pula
(`:270`). Como o descarte ainda não existe (é a frente seguinte), alerta legítimo só
acumula: a obra continua `fonte='field'`, com `field_id`, e ausente em toda varredura.

Cenário: 40 obras do Field e, ao longo das semanas, 8 OS excluídas de verdade, já
alertadas (20%, ainda passa). Uma nona OS é excluída: a conta dá 9/40 = 22,5% e o
disjuntor dispara. **A nona nunca vira nem suspeita**, e toda varredura dali em diante
mostra "Varredura suspeita… Nenhuma ausência foi registrada". A detecção fica desligada
até alguém mexer no banco à mão. O mesmo vale se OS concluídas saírem da listagem do Field
ao serem arquivadas, o que o feedback 10 deixa em aberto: as obras encerradas empurram a
proporção até disparar.

**Sugestão:** contar no numerador só as ausências novas ou em andamento
(`!texto(obra.field_ausente_em)`), e usar no denominador as obras do Field não alertadas
(ou todas, desde que o numerador exclua as alertadas). Teste: 10 obras, 3 já alertadas e
ausentes, 1 nova ausente → a suspeita da nova é gravada.

### MENOR

**N2 — Sem piso absoluto, uma base pequena nunca registra ausência**
`_sincronizacao.ts:263`. Cenário na verificação 2: com até 4 obras do Field, 1 exclusão
legítima dispara o disjuntor. A mensagem chama de "suspeita" uma varredura correta.
Sugestão: disparar só quando `ausentesNovas > Math.max(PISO, 20% × base)`, com `PISO` em
torno de 3. Uma exclusão isolada numa base pequena não é "em massa".

**N3 — O intervalo de 24h exatas escorrega um ciclo inteiro com cadência diária**
`_actions.ts:103` e `_sincronizacao.ts:289`. Cenário, com a D3 rodando a completa às 03:00
todo dia e a estratégia de loja fazendo algumas dezenas de requisições a 1 req/s:
- Dia 1: a leitura termina às 03:01:20, e a suspeita fica com esse horário.
- Dia 2: a leitura termina às 03:01:10 → 23h59m50s < 24h → não confirma.
- Dia 3: às 03:01 confirma. O aviso chega em cerca de 48h, e não nas "cerca de 24 horas"
  que o cliente aprovou (4A).

Basta a leitura do dia seguinte ser alguns segundos mais rápida, ou o agendador disparar
alguns segundos antes. Com a execução manual de hoje, o efeito é pequeno. Com a D3 diária,
acontece em cerca de metade dos dias. Sugestão: margem de tolerância (ex.: confirmar com
≥ 20h ou 23h, mantendo o texto "cerca de 24 horas"), ou carimbar e comparar o **início**
da varredura e ainda assim manter uma margem.

**N4 — Aviso de "varredura suspeita" com base e Field legitimamente vazios**
`_sincronizacao.ts:259`. O teste é só `doField.length === 0`. Com 0 obras do Field no
banco (produção hoje) e 0 OS Spot no Field, o relatório diz "Varredura suspeita: o Field
devolveu 0 OS", um alarme sem objeto que ensina o operador a ignorar o aviso. Sugestão:
`doField.length === 0 && obrasDoField.length > 0`.

**N5 — Paginação: página extra quando o total é múltiplo de 100, e página repetida só é detectada no teto**
`cliente.ts:206-214`. (a) Com 200 OS, a 3ª chamada vai com `offset=200`. Se a API real
responder 4xx a um `offset` igual ou maior que o total, em vez de `items: []`, a
sincronização falha sempre que o total for múltiplo de 100. É uma falha segura, sem
marcação, mas persistente. Conferir com a chave real. (b) Se a API ignorar o `offset`, a
leitura gasta cerca de 33 minutos até o erro de teto. Sugestão: lançar cedo quando a
página vier idêntica à anterior (mesmo primeiro `id`).

---

## Verificado e está correto (novo)

- Erro de página sem `items`, de teto de offset ou de HTTP interrompe antes da leitura do
  banco e de qualquer escrita. Nenhuma ausência é marcada (`_actions.ts:92-96`).
- O disjuntor bloqueia suspeita **e** confirmação na mesma execução, e não bloqueia
  insert, update de campos vazios, renumeração nem limpeza de alerta.
- A suspeita nunca é regravada por uma varredura dentro das 24h (`:272-282`), e o relógio
  não "reinicia".
- `Date.parse` aceita o formato ISO com offset que o PostgREST devolve para `timestamptz`.
  Se falhar, a obra fica em suspeita e nunca é confirmada, o que é o lado conservador.
- `avisos` é sempre um array no plano e no relatório, e o painel não quebra com lista vazia.
- O critério (`criterio-ausencia-field-d2.md`) foi atualizado para descrever exatamente o
  que o código faz: 24h, disjuntor, `totalCount` e `items`.
- Nenhum `delete` foi introduzido.
