# Spec — "Pendente faturamento" separado na Base (leitura B) — 28/09/2026

Decisão: `docs/cliente/2026-09-28-escolha-pendente-faturamento.md` (cliente escolheu B).
Levantamento de código: `brief-mockup-pendente-faturamento-2026-09-24.md` (mesma pasta), seção B.
Mockup aprovado: `mockup-pendente-faturamento-2026-09-24.html`, seção B, estado "Depois"
(funções `kpis('B')` ~linha 412 e filtro ~linha 441/456).

## O que muda (só `app/obras/base/`)

1. **Filtro "Etapa da obra"** (`_regras.ts`, `opcoesEtapa`): a opção solta
   `{ v: '__esteira', t: 'Executadas, ainda na esteira' }` vira duas, nesta ordem, logo após "Todas":
   - `__fechamento` → "Executadas, ainda no fechamento" — obras da fase `fechamento`, não encerradas
     (etapas `relatorio`, `aprovarOS`, `fecharOS`).
   - `__pendfat` → "Pendente faturamento (aguardando pedido de compra)" — obras com `etapa === 'pendFat'`.
   A chave `__esteira` sai. Se algum lugar lê o filtro da URL/estado com `__esteira`, trate como
   `todas` (não quebrar link salvo) — conferir por grep se isso existe; se não existir, nada a fazer.
2. **Cartões do topo** (`_regras.ts`, `kpisDaBase`): o cartão "executadas, ainda na esteira · a mais
   parada há N dias" vira dois, no mesmo lugar da lista:
   - "executadas, ainda no fechamento · a mais parada há N dias", cor WARN `#f4b73f`, contando
     fase `fechamento` não encerrada; N = maior `paradaEtapa` do grupo.
   - "pendente faturamento · a mais parada há N dias", cor ACCENT `#f05a28`, contando `etapa === 'pendFat'`.
   A regra "indicadores olham sempre a base inteira" continua.
3. **Grid** (`page.tsx`): passam a ser 9 cartões; ajustar `xl:grid-cols-8` para que não sobre um
   cartão sozinho numa linha em telas largas (ex.: `xl:grid-cols-9`). Mobile/sm inalterado.
4. **Testes**: atualizar `app/obras/__tests__/base.test.ts` (linhas ~119-127, 237, 469-470 no levantamento)
   e cobrir: filtro `__fechamento` não inclui `pendFat` nem encerradas; `__pendfat` só `pendFat`;
   os dois cartões com contagem e "mais parada" corretos; soma dos dois = antigo grupo.

## Fora do escopo

Kanban, ficha, etiquetas, schema, `tipos.ts` — nada muda. Nenhum texto "ainda na esteira" deve
sobrar em `app/obras/base/` (conferir por grep, incluindo comentários que descrevam a regra).

## Critério de pronto

`npx jest app/obras` verde; `npx tsc --noEmit` sem erro novo; `npm run lint` sem erro novo nos
arquivos tocados; grep de "ainda na esteira" em `app/` vazio.
