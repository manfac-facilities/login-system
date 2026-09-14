# J3 — as incógnitas da API do Field, provadas com a chave real

**Rodado em 14/09/2026** pelo Claude, com autorização do João, via
`node scripts/verificar-field.mjs` (script local, não versionado; só leitura; a chave nunca
é impressa). Chave lida do `.env.local` da raiz, 56 caracteres, sem espaço nem aspas.

## Resultado

| Pergunta | Chamada | Resposta |
|---|---|---|
| a) A chave autentica? | `GET /services?q=name:"Atividade Spot"` | **2xx — válida.** O tipo "Atividade Spot" foi resolvido |
| b) O `q` com dois filtros é aceito? | `GET /orders?q=service_id:"…" updated_at>=:2024-02-01&limit=1` | **2xx — aceito** (igualdade entre aspas + operador sem aspas, espaço como `%20`) |
| c) `sort=id` é ordenação válida? | `GET /orders?q=service_id:"…"&limit=3&sort=id` | **2xx — aceito** |
| d) `updated_at>=` aceita timestamp completo? | `GET /orders?q=service_id:"…" updated_at>=:2025-09-14T16:19:34.656Z&limit=1` | **2xx — aceita** data pura e ISO completo |

**Total de OS "Atividade Spot" no Field em 14/09: 167.** O banco de produção tinha 0 obras.
A amostra de 3 OS que o script imprime (descrição mascarada, endereço da loja) confirmou
que `os`, `loja`, `idField` e `atualizadoEm` vêm preenchidos — não foi copiada para cá por
ser dado de cliente.

## Segunda rodada, mesmo dia — `archived` e o 404 (revisão da D2.1)

Autorizada pelo João. Três chamadas só de leitura; saída restrita a nomes de campo, status e
o valor de `archived` — nenhum dado de cliente nem a chave.

| Chamada | Resultado |
|---|---|
| `GET /orders?limit=1&sort=id` | 200. Item da **listagem** tem `archived` **booleano** (`false` no item lido) |
| `GET /orders/:id` de OS existente | 200. **`archived` booleano** presente (`false`). Campos: `address, archived, createdAt, createdBy, customer, deadlineContract, description, external, id, identifier, link, location, metadata, productsTotalValue, service, servicesTotalValue, ticket, totalValue, updatedAt` |
| `GET /orders/:id` com id inventado | **422**, não 404 — corpo `{ code: "uriValidationErr", errors }`. O id inventado não tinha o formato válido; **o que a API devolve para id bem formado e inexistente continua sem prova** |

**Consequências para a D2.1:**

1. **`archived: true` é evidência positiva e existe** — a herança pode se apoiar nele.
2. **404 não autoriza herança.** O cliente disse que no Field se arquiva, não se apaga (1B),
   e o comportamento real do 404 não foi provado. Herança só com `archived === true`;
   qualquer outra resposta é caso para decisão manual. Isso fecha o achado I3.
3. **Como `archived` vem também na listagem**, "a OS antiga apareceu na varredura" não
   significa "está ativa" — só significa isso se ela veio com `archived: false`. A correção
   do I1 precisa olhar o campo, o que exige levar `archived` para a `OsNormalizada`.

## O que continua sem prova

**A listagem com filtro `service_id` inclui OS arquivadas?** O item lido veio com
`archived: false`, então não dá para saber. Se incluir, uma OS arquivada **nunca fica
ausente** e o alerta da D2 nunca dispara por ausência — mas o próprio `archived: true` da
listagem vira sinal direto, melhor que inferir por sumiço. Se não incluir, a ausência
continua sendo o sinal. Testar exige uma OS arquivada de verdade.

**Texto original desta seção (primeira rodada):**

**Se OS arquivada continua listada em `/orders`.** O cliente respondeu em 14/09 que excluir
no Field arquiva e dá para recuperar (`pergunta-05`, resposta 1B). Se a API listar a
arquivada junto com as ativas, ela nunca "some", e o alerta da D2 nunca dispara — seria
preciso ler um campo de arquivamento em vez de inferir por ausência. **O script não testa
isso**; precisa de uma OS arquivada de verdade (pedir ao cliente para arquivar uma OS de
teste, ou achar uma já arquivada).

## Consequências

- D3: usar timestamp ISO completo no `desde`. A margem de 10 min continua.
- D2.1: a consulta da OS antiga (`GET /orders/:id`) para decidir herança depende da mesma
  pergunta em aberto — por isso fica isolada numa função.
- A camada `_lib/field/` funcionou como construída: nenhuma mudança necessária para as
  quatro perguntas.
