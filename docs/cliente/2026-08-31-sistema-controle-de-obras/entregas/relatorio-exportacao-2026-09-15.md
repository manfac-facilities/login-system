# Relatório — exportação das OS "Atividade Spot" do Field (15/09/2026)

**Gerado por:** `scripts/exportar-os-field.mjs`, rodado às 15/09/2026 (duas rodadas, a
segunda só para corrigir a ordenação — ver "Anomalias e decisões" abaixo). Só leitura na
API do Field; a chave (`FIELD_API_KEY`, de `.env.local`) nunca foi impressa nem gravada.

**Entrega:** `docs/cliente/2026-08-31-sistema-controle-de-obras/entregas/os-field-atividade-spot-2026-09-15.xlsx`

---

## 1. Total de OS e comparação com as 175

| Medição | Quando | Total |
|---|---|---|
| J3 (`j3-verificacao-api-2026-09-14.md`) | 14/09, manhã | 167 |
| Medição do feedback 13 (`feedback-13-os-duplicadas-no-field.md`) | 14/09, noite | **175** |
| Esta exportação | 15/09 | **185** |

**O total subiu de 175 para 185 (+10) desde a noite de 14/09.** Isso é esperado: o Field
recebe OS novas continuamente (o mesmo salto já tinha acontecido de 167→175 num único
dia). **Não dá para listar quais 10 OS entraram ou saíram**, porque nenhuma das duas
medições anteriores guardou a lista literal dos números — só a contagem agregada, de
propósito (`feedback-13-os-duplicadas-no-field.md`, "saída agregada; nenhum dado de
cliente copiado para cá"). A partir de agora, **este Excel é a primeira lista literal
salva** — qualquer medição futura pode ser diferenciada contra ele, número por número.

Nenhuma das 185 OS trazidas veio com `archived: true` na listagem (script teria impresso
um aviso "ATENÇÃO" se tivesse vindo — não imprimiu). Isso é coerente com o que a medição
de 14/09 já tinha visto (0 arquivadas em 175) e com o resultado da OS 7777 abaixo.

## 2. O filtro usado — é exatamente o da primeira carga

A primeira carga é do tipo `'completa'`. O filtro, a paginação e a resolução de loja
reproduzidos são os mesmos da sincronização real, ponto a ponto:

| O quê | Onde no código | O que faz |
|---|---|---|
| Tipo de OS | `app/obras/_lib/field/cliente.ts:130` | `nomeDoTipoDeOs ?? 'Atividade Spot'` |
| Filtro da query | `app/obras/_lib/field/cliente.ts:178` | `filtros = [{ campo: 'service_id', valor: serviceId }]` — **só isso**, nenhum filtro de `archived` |
| Sem filtro de `updated_at` | `app/obras/_lib/field/cliente.ts:179-182` combinado com `app/obras/sincronizar/_execucao.ts:140` | `updated_at>=` só entra quando `opcoes.desde` existe, e `execucao.desde` só existe quando `tipo === 'incremental'` — a primeira carga é `'completa'`, então este filtro nunca entra |
| Ordenação e paginação | `app/obras/_lib/field/cliente.ts:131-133` e `189-226` | `sort=id`, `limit=100` por página, offset incremental, com a mesma detecção de página repetida e o mesmo teto de offset (200000) |
| Loja | `app/obras/_lib/field/cliente.ts:148` (`estrategiaDeLoja ?? 'endereco'`) e `app/obras/_lib/field/loja.ts:51-59` | `textoDoEndereco(ordem.address)` — o endereço embutido na OS, não o nome da "Localização" (essa decisão do cliente continua em aberto) |
| Chamada real na sincronização | `app/obras/sincronizar/_execucao.ts:190` | `criarClienteField({ chaveApi })`, sem nenhuma outra opção — confirma que todos os padrões acima (tipo, ordenação, paginação, estratégia de loja) são os mesmos que a primeira carga vai usar |

**Conclusão sobre o critério: "não arquivada" NÃO é um filtro explícito da API.** A
sincronização não manda nenhum `archived` no `q` — ela lista tudo do tipo "Atividade
Spot" e confia que a listagem não traz arquivadas. Isso nunca foi provado com uma OS
arquivada de verdade até este teste (ver §3) — e o resultado da 7777 deixa essa suposição
em aberto, não confirmada.

**O que este script fez A MAIS que a sincronização, e por quê:** a sincronização usa
`cliente.listarOsNormalizadas()`, cujo formato de saída (`OsNormalizada`) descarta
`createdAt` — ele nunca é gravado no banco. Para poder preencher a coluna 7 do Excel
("Data de criação"), o script lê `/orders` diretamente com o mesmo filtro/paginação
(função `listarOrdensCru` em `scripts/exportar-os-field.mjs`), sem passar pela
normalização — o dado é o mesmo que a sincronização já recebe da API, só não descartado.
Nenhum outro critério foi inventado.

## 3. OS 7777 — resultado

| Verificação | Resultado |
|---|---|
| Aparece na listagem com o filtro da sincronização (`service_id="Atividade Spot"`)? | **SIM** — está entre as 185 |
| `archived` na listagem | **`false`** |
| Encontrada por `identifier` (sem filtro de tipo)? | **SIM**, 1 resultado único; `service.id` bate com o de "Atividade Spot" |
| `GET /orders/:id` — campos devolvidos | `id, link, archived, identifier, description, productsTotalValue, servicesTotalValue, totalValue, deadlineContract, createdAt, updatedAt, metadata, createdBy, external, customer, service, address, ticket, location` |
| `GET /orders/:id` — valor de `archived` | **`false`** (booleano) |

**Achado importante: a OS 7777, que o cliente disse ter arquivado como teste
(`feedback-16`, item 8), veio com `archived: false` tanto na listagem quanto no
detalhe.** Isso contradiz a premissa do teste. Três hipóteses, nenhuma confirmada por
esta leitura (só leitura, sem como investigar mais fundo sem o cliente):

1. o arquivamento não foi de fato salvo no Field (falha na ação, ou em outra OS);
2. "arquivar" na UI do Field não é o que popula o campo `archived` desta API (pode ser
   outro estado, ou o campo só muda em outro fluxo);
3. atraso de propagação entre a ação no painel e a API — pouco provável, já que o
   `updatedAt` da OS não mostra uma atualização recente compatível com a resposta
   `8A` ("já tinha te enviado", ou seja, o arquivamento é anterior a 14/09).

**Consequência prática: continua sem prova se `archived: true` realmente aparece na
resposta da API para uma OS de fato arquivada, e se a listagem por `service_id` exclui
arquivadas.** A pergunta que a J3 deixou em aberto ("A listagem inclui OS arquivadas?")
segue em aberto — o teste da 7777 não respondeu porque ela não veio arquivada. Recomendo
perguntar ao cliente se ele confirma ter arquivado a 7777 especificamente (não outra OS
parecida) e, se sim, pedir para arquivar de novo agora e reler na sequência.

## 4. Colunas que ficaram vazias por falta de dado da API

**Nenhuma.** Nas 185 linhas, todas as colunas obrigatórias vieram preenchidas: loja (via
`address`), status da última atividade, data da última atividade, quantidade de
atividades (mínimo 1) e data de criação da OS. As colunas 8 e 9 (S/N e Observação) estão
vazias de propósito, para o cliente preencher.

## 5. Anomalias e decisões tomadas na leitura dos dados

- **Nenhuma OS sem atividade, sem loja ou sem data de criação** — dado limpo nas 185
  linhas, ao contrário do que a tarefa cogitava como possível.
- **A coluna "Status da última atividade" mistura três formatos**, porque a API mistura:
  quando a atividade tem `statusClassification` (o rótulo padronizado do Field, ex.
  "Resolvido", "Programado", "Fechar OS", "Orçamento Aguardando Aprovação"), o script usa
  essa descrição; quando não tem, cai para `statusDescription` (texto livre digitado pelo
  técnico, já visto com frases inteiras tipo relato de campo) e, por último, para o
  `status` técnico cru (`done`, `pending`, `scheduled`, `reported`, `on-route`,
  `in-progress`). Isso é fiel ao dado da API, não um bug — mas o cliente pode estranhar
  ver frase de técnico numa coluna de "status"; vale avisar antes de ele conferir.
- **"Última atividade" foi definida como a de maior `position`** dentro da OS (empate
  desfeito pela `updatedAt` mais recente) — não há documentação pública para este
  endpoint (`/orders/:id/tasks`); a amostra real confirmou que os `items` já vêm
  ordenados por `position` crescente.
- **"Data da última atividade" prioriza `completedAt` → `startedAt` →
  `scheduling.date` → `updatedAt` → `createdAt`**, nessa ordem — a primeira que existir.
  É uma escolha razoável, não um fato documentado.
- **A ordenação por nº da OS não é puramente numérica.** Boa parte dos `identifier` reais
  é alfanumérica (`"0126-013004"`, `"VISA108"`, `"TESTE SPOT"`, `"teste4"` etc.), não só
  dígitos. A primeira versão do script usava um comparador que trocava entre número e
  texto par a par, o que quebra a transitividade e pode bagunçar a ordem geral —
  encontrado e corrigido antes da entrega final: a versão publicada usa um único
  `Intl.Collator` com `numeric: true`, verificado sem nenhuma quebra de ordem nas 185
  linhas.
- **Pausa entre chamadas: não foram usados os ~200ms sugeridos.** O script reaproveita o
  mesmo limitador de 1 req/s que a sincronização usa (`_lib/field/limitador.ts` e
  `http.ts`, com novo tentativa em 429) — 200ms violaria o limite documentado (1 req/s) e
  geraria 429 em cadeia com 370 chamadas (185 OS × ~2: listagem de atividades). O
  resultado é o mesmo requisito (sequencial, com espera, com novo tentativa em 429), só
  que com o número de espera que a própria API documenta, em vez de um valor arbitrário
  menor que ela.
- **Existem OS de teste/rascunho na base** (`"TESTE SPOT"`, `"teste4"`,
  `"testeheleno"`, `"SEM OS'S TMO226"`), pelo `identifier`. Não foram eu quem decidiu
  isso é obra real — é exatamente a pergunta que o Excel devolve ao cliente na coluna 8.

## 6. O que não deu para reproduzir fora do app

Nada. O filtro, a query, a ordenação e a paginação de `/orders` foram reproduzidos
chamando as mesmas funções da camada `app/obras/_lib/field/` (`resolverIdDoTipoDeOs`,
`montarQ`, `textoDoEndereco`, as mesmas constantes `TAMANHO_MAXIMO_DA_PAGINA` e
`OFFSET_MAXIMO`) — não uma reimplementação paralela. A única diferença de código é ler
`/orders` sem passar pela normalização de `OsNormalizada` (para não perder `createdAt`),
o que não muda nem o filtro nem o resultado, só o que é repassado para a planilha.
