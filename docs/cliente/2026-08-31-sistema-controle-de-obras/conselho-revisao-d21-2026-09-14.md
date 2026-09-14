# Conselho sobre a revisão da D2/D2.1 — a revisão ficou rigorosa demais?

**14/09/2026.** Pedido do João, literal: *"percebo que começou os micro ajustes que me
parecem meio edge cases [...] vale trocar uma ideia com a IA que está revisando e aprovando
pra ver se ela não está muito rigorosa, pq senão fica esse ping pong de micro ajuste que
muitas vezes é besteira. [...] rode o code reviewer e llm council pra entender o que
realmente é necessário e se esse ponto do Duda é factível"*.

Não existe skill "llm council"; foi montado com três agentes independentes lendo o mesmo
briefing, cada um com uma lente, mais o `/code-review` em nível **low** sobre a branch,
sem contexto das rodadas anteriores, como régua de comparação. Pareceres completos:
`conselho-d21-ops.md`, `conselho-d21-dados.md`, `conselho-d21-diabo.md`.

## Resposta curta

**Sim, a revisão passou do ponto — e parte do excesso é do coordenador, não do revisor.**
Dos achados das três rodadas, poucos evitaram dano provável; vários eram cenário raro,
mensagem imprecisa ou rediscussão de decisão já justificada. Dois vieram de sugestões do
próprio revisor (disjuntor, janela de 24h), e um veio da spec do coordenador ("inexistente
herda", escrita antes de a API ser provada). O coordenador repassou tudo ao Duda sem
filtrar por probabilidade real.

**Mas o último pedido ao Duda também estava errado num ponto de verdade** — e dois membros
chegaram nele sozinhos (ver "O que muda no pedido").

## Onde os quatro convergiram

| Item | Ops | Dados | Diabo | `/code-review` low | Consolidado |
|---|---|---|---|---|---|
| **404 não autoriza herança** | bloqueia | bloqueia | antes da carga | — | **Fazer agora** (é uma linha) |
| **I1 — OS antiga presente na mesma varredura** | bloqueia | antes da carga | antes da carga | **único achado** | **Fazer agora** |
| Motivo da consulta chega ao relatório | antes da carga | backlog (troca de texto) | descartar categorias | — | **Repassar o motivo, sem criar categorias** |
| "Listada com `archived:true` herda sem consultar" (item 2/4 do pedido) | antes da carga | **abre buraco** | **abre buraco** | — | **Retirado** — ver abaixo |
| **N5 — página extra quando total é múltiplo de 100** | Duda certo | Duda certo | Duda certo | — | **Fechado. Não reabrir** |
| M1, M3, M5 | misto | backlog | backlog/descartar | — | Backlog, fora do pedido |
| M2, M4 | descartar | descartar | descartar | — | Descartar |

## O que muda no pedido ao Duda

O pedido enviado dizia: *"se o field_id antigo veio na listagem com `archived: true` →
herda sem consultar"*. **Dois membros apontaram, independentemente, que isso abre buraco:**
depende da ordem da listagem, reabre a obra híbrida quando a antiga arquivada foi
renumerada, e esconde um achado que ninguém tinha escrito:

> **Se a listagem trouxer OS arquivadas, elas viram obra já na primeira carga — e o sistema
> nunca apaga.** (conselheiro "diabo", confirmado pela lente de dados)

**Forma mais simples, e que fecha isso:**

1. **Filtro na entrada:** OS com `archived === true` na listagem **não cria obra e não conta
   como presente**. Arquivar no Field passa a ser "sumiu" para a regra da D2 — que é
   exatamente o que o cliente descreveu (1B).
2. **Herança só quando `GET /orders/:id` devolve `archived === true`.** 404, 422, campo
   ausente ou falha → não herda.
3. **Se o `field_id` antigo veio na varredura** (e, pelo filtro, não arquivado) → não
   consulta, não herda, conflito visível.
4. **O motivo da consulta chega ao relatório como veio**, sem inventar categorias.
5. Três testes: arquivada na listagem não vira obra; antiga presente na varredura não herda;
   herança só com `archived === true`.

Estimativa dos membros: cerca de 1 hora. **Depois disso, merge sem nova rodada**, salvo
bloqueador pela régua abaixo.

**Proposto por um membro e deixado em backlog:** herdar só se a loja for a mesma. Protege
contra número reaproveitado para outra loja, mas é mecanismo novo, o cliente descreveu a
reabertura como a mesma obra, e a régua diz que o revisor não propõe mecanismo novo.
Volta se aparecer um caso real.

## A régua — vale para as próximas revisões deste projeto

1. **Bloqueia merge** só um cenário **alcançável, escrito passo a passo**, que **mistura,
   sobrescreve ou apaga dado sem aviso** (o tipo que só SQL desfaz) ou **dispara alerta em
   massa** — sem precisar que a API se contradiga.
2. **Antes da 1ª carga real:** o que só dói com dado de verdade. Pode mergear antes.
3. **Todo o resto vai para backlog em arquivo e NÃO vai ao desenvolvedor** nesta rodada.
4. **Dúvida sobre a API se resolve com uma chamada de leitura**, não pedindo código para os
   dois cenários.
5. **O revisor se cala** quando o autor já justificou a escolha, quando a crítica é à própria
   spec (aí é conversa com o João), e quando a sugestão é mecanismo novo.
6. **Uma rodada por entrega, com lista fechada.** A re-revisão confere só a lista; achado
   novo só entra se bater no item 1.
7. **O coordenador filtra antes de repassar** — achado de revisor não é pedido ao
   desenvolvedor até passar pela régua.

## Retrospecto: o que valeu e o que foi excesso

**Valeu (evitou dano provável):** leitura parcial/vazia do Field valendo como varredura
completa (alerta em massa) — D2, I1; alertas acumulados desligando o disjuntor para sempre
— N1; herança com a antiga presente na mesma varredura — D2.1, I1; 404 juntando históricos
sem prova — D2.1, I3; e o achado novo deste conselho, OS arquivada virando obra.

**Foi excesso:** a etiqueta com `undefined` antes da migration (o coordenador controla essa
ordem); reabrir o N5; piso de base pequena, tolerância das 24h e aviso com base vazia como
pedido de rodada (eram backlog); categorias de mensagem; a série M.
