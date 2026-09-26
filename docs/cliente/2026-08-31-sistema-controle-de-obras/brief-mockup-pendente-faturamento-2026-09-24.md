# Brief — mockup "pendente faturamento na esteira" (24/09/2026)

Mockup: `mockup-pendente-faturamento-2026-09-24.html` (mesma pasta). Não publicado — quem publica
é a sessão principal.

## O pedido

Literal do cliente, 22/09 (`docs/cliente/2026-09-22-feedback-esteira-e-equipes.md`):

> trocar o stuatos ainda na esteira para pendente faturamento

Adiado pelo João em 22/09 (decisão 4) e retomado em 24/09 (decisão 7): mockup primeiro, mostrando
as leituras possíveis para o cliente escolher.

## Levantamento no código (master em 24/09)

**Onde "ainda na esteira" aparece — só na Base, em dois lugares:**

- Filtro "Etapa da obra", primeira opção solta: `app/obras/base/_regras.ts:150`
  (`{ v: '__esteira', t: 'Executadas, ainda na esteira' }`). A regra do filtro está em `:193-194`
  (`posCampo(o) && !encerrada(o)`).
- Cartão (KPI) do topo: `app/obras/base/_regras.ts:360-361` (conta e "mais parada") e `:377-382`
  (rótulo `executadas, ainda na esteira · a mais parada há N dias`). Renderizado em
  `app/obras/base/page.tsx:55-59`.
- Não aparece na ficha, no Kanban nem nas etiquetas (`grep` em `app/` só acha `_regras.ts` e os
  testes `app/obras/__tests__/base.test.ts:119-127, 237, 469-470`).

**O que o grupo junta:** `posCampo` = fase `fechamento` ou `faturamento`
(`app/obras/_lib/tipos.ts:481-484`), menos `encerrada` (faturado/cancelado, `:487-489`). Ou seja,
as quatro etapas `relatorio`, `aprovarOS`, `fecharOS`, `pendFat` (`tipos.ts:172-175`).

**O que o cliente vê hoje para uma obra que concluiu Fechar OS (etapa `pendFat`):**

- Catálogo: `pendFat` = "Pendente faturamento", fase `faturamento`, dono "Cliente DPSP"
  (`tipos.ts:175`). Fases: `tipos.ts:148-153`.
- Base, tabela: pílula "Pendente faturamento" na coluna "Etapa da obra" (`base/_table.tsx:106,178`
  via `EtiquetaEtapa`, `base/_etiquetas.tsx`), cor `#f4b73f` (`_regras.ts:49`). Mas cai no filtro
  e no cartão "Executadas, ainda na esteira".
- Kanban: agrupa por FASE (`base/_kanban.tsx:89`); `pendFat` fica na coluna **Faturamento**,
  sob o subtítulo "Pendente faturamento" (`:106-121`) — já separada da coluna Fechamento.
- Ficha: a esteira (`app/obras/obra/[id]/_ficha.tsx:287-341`, `ESTEIRA` em `tipos.ts:192`) desenha
  Fechar OS como "feito" com a data de fechamento e "corrigir data" (`:354-361`) e Pendente
  faturamento como "a obra está aqui". "Etapa atual" mostra a pílula "Pendente faturamento"
  (`:655-657`). Marco: `marco_liberou_fat` (`_ficha.tsx:94`).
- A passagem Fechar OS → Pendente faturamento é pelo seletor "Mudar a etapa desta obra"
  (`obra/[id]/_etapa.tsx:48`, com a data de fechamento `:103-133` e a mensagem `:163-166`).
  Não há passagem automática nem botão "Concluir Fechar OS".

## As leituras

| | Leitura | Situação |
|---|---|---|
| **A** | Trocar o nome "Executadas, ainda na esteira" (cartão e filtro) por "Pendente faturamento" — mesmas 8 obras | plausível |
| **B** | `pendFat` sai do grupo "ainda na esteira": cartão e filtro próprios "Pendente faturamento"; o resto vira "Executadas, ainda no fechamento" | plausível |
| **C** | Na ficha, ao concluir Fechar OS, a obra passa a mostrar "Pendente faturamento" | **já é assim hoje** — mostrada no mockup como demonstração, sem mudança |

Descartada por já ser assim: "Pendente faturamento ganhar coluna própria no Kanban" — a coluna
Faturamento já a separa do Fechamento.

### A — renomear

- Arquivos: `app/obras/base/_regras.ts:150` e `:380-381` (dois textos); testes
  `app/obras/__tests__/base.test.ts:119, 127, 237`.
- Schema: não.
- Estimativa: ~30 min com testes.
- Custo escondido: o nome "Pendente faturamento" passa a nomear o grupo (8) e a etapa (3) — duas
  opções homônimas no filtro com contagens diferentes, e obra em Fechar OS contada como "pendente
  faturamento". O mockup mostra isso e sugere "Executadas, a faturar" se o cliente escolher A.

### B — separar

- Arquivos: `app/obras/base/_regras.ts` — `opcoesEtapa` (`:139-151`, duas opções soltas),
  `filtrar` (`:193-194`, `__esteira` passa a ser fase fechamento + novo `__pendfat`, ou reusar a
  chave `pendFat` que já existe no grupo Faturamento), `kpisDaBase` (`:358-382`, um cartão vira
  dois); `base/page.tsx:55` só se o grid de 8 cartões (`xl:grid-cols-8`) precisar de ajuste para 9;
  testes `base.test.ts:119-127, 237, 469-470`.
- Schema: não.
- Estimativa: ~1h30 a 2h com testes (mudança pura em função testada, ~30 linhas).
- Kanban e ficha: sem mudança.

### C — já no ar

- Nenhum arquivo. Se o cliente responder C com "queria um botão direto", aí é frente nova
  (`_etapa.tsx`), não este pedido.

## Recomendação (para o João, não está na página do cliente)

**B**, se o cliente confirmar A ou B sem preferência forte. Motivo: A cria dois "Pendente
faturamento" com números diferentes na mesma tela, e a regra do projeto é que nome de etapa é
vocabulário de trabalho; B dá ao cliente exatamente o número que o feedback 09 descreve como
"dinheiro parado que depende do cliente" (esperando o pedido de compra), separado do que ainda
depende da Manfac, sem tocar no Kanban nem no schema. Se o cliente escolher A, fazer A com o nome
"Executadas, a faturar" para não colidir com a etapa.

## Verificação do mockup

Playwright a 375px: `scrollWidth` 360 (sem rolagem horizontal da página; tabela e Kanban rolam
dentro da própria caixa), sem erro de console além do favicon do servidor local; alternâncias
A/B antes-depois, filtros, Tabela/Kanban e a demonstração da seção C (troca de etapa com data,
mensagem de sucesso, volta ao "antes") conferidas por script.
