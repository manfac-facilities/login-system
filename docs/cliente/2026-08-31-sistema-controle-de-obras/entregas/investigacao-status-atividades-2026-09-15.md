# Investigação — onde mora o status confiável da OS (15/09/2026)

**Só leitura (GET).** Chave `FIELD_API_KEY` lida de `.env.local`, nunca impressa. Base: as
**185 OS "Atividade Spot"** e as **210 atividades** delas, lidas com o mesmo filtro e a
mesma paginação da sincronização (`app/obras/_lib/field/`). Feita para responder ao
`feedback-17` e ao `feedback-18`.

---

## 1. `statusClassification` — valores e contagem

`statusClassification` é um **objeto**, não um texto:

```
{ id, name, status, description, systemKey, isLocked, archived }
```

Os **cinco** valores que existem hoje nas 210 atividades:

| `description` (= `name`) | `.status` | atividades | `systemKey` | `archived` |
|---|---|---|---|---|
| Resolvido | `done` | 71 | null | false |
| Orçamento Aguardando Aprovação | `pending` | 7 | null | false |
| Falta de Tempo | `reported` | 3 | null | false |
| Fechar OS | `done` | 2 | null | false |
| Programado | `scheduled` | 1 | null | false |
| **(sem `statusClassification`)** | — | **126** | — | — |

**126 das 210 atividades não têm `statusClassification` nenhum** — e, olhando só a *última*
atividade de cada OS, **117 das 185 OS** ficariam sem resposta. Por isso ele **não serve
como campo principal do critério**.

## 2. Como ele se relaciona com o `status` cru

`statusClassification` é um **rótulo que a conta criou dentro de um estado técnico**, e
carrega esse estado em `statusClassification.status`. O cruzamento das 210 atividades:

| classificação | `status` cru | atividades |
|---|---|---|
| Resolvido [done] | done | 71 |
| — | done | 55 |
| — | pending | 46 |
| — | scheduled | 13 |
| — | reported | 10 |
| Orçamento Aguardando Aprovação [pending] | pending | 7 |
| Falta de Tempo [reported] | reported | 3 |
| Fechar OS [done] | done | 2 |
| Programado [scheduled] | scheduled | 1 |
| — | in-progress | 1 |
| — | on-route | 1 |

**Zero divergências** entre `statusClassification.status` e o `status` da atividade.

**O campo confiável é o `status`.** A própria API publica o enum fechado quando recusa um
valor inválido em `GET /orders/:id/tasks?q=status:"zzz"`:

```
422 parametersValidationErr — must be a valid status:
pending, scheduled, in-progress, done, canceled, reported, on-route, paused
```

`statusDescription` é o campo **poluído** (texto livre do técnico: "sem tempo para
executa", relatos inteiros). Não serve para regra. A coluna "Status da última atividade" do
Excel de 15/09 mistura os três, nesta ordem: `statusClassification.description` →
`statusDescription` → `status`.

## 3. Quantas OS entram pelo critério do feedback 18

Critério: **última atividade** (maior `position`, empate pela `updatedAt` mais recente) com
status **`pending` ou `scheduled`**.

| Status técnico da última atividade | OS | Entra? |
|---|---|---|
| done | 113 | não |
| pending | **49** | **sim** |
| scheduled | **14** | **sim** |
| reported | 7 | não |
| in-progress | 1 | não |
| on-route | 1 | não |
| **total** | **185** | **63 entram** |

**63, não 58.** O 58 do feedback 18 conta os rótulos literais do Excel (`pending` 45 +
`scheduled` 13). Pelo estado técnico entram também as **4 OS** rotuladas "Orçamento
Aguardando Aprovação" (tecnicamente `pending`) e a **1 OS** rotulada "Programado"
(tecnicamente `scheduled`).

Conferência contra o Excel de 185 OS (`os-field-atividade-spot-2026-09-15.xlsx` e
`triagem-suspeitas-2026-09-15.md`): os rótulos batem linha a linha —
Resolvido 58 + done 51 + Fechar OS 2 + "Foi feito atendimento" 1 + um texto livre 1 = **113
`done`**; pending 45 + Orçamento 4 = 49; scheduled 13 + Programado 1 = 14; reported 2 +
Falta de Tempo 3 + 2 textos livres = 7.

## 4. Dá para filtrar no servidor?

Sondagem direta na API (10 requisições, só GET). Baseline: `service_id:"..."` → 185.

| `q` testado | `totalCount` | Leitura |
|---|---|---|
| `service_id` (baseline) | 185 | — |
| `service_id + archived:"true"` | **0** | **o filtro É aplicado** |
| `service_id + archived:"false"` | **185** | idem — e prova que hoje não há nenhuma arquivada |
| `service_id + campo_que_nao_existe_xyz:"1"` | 185 | filtro desconhecido é **ignorado em silêncio** |
| `service_id + status:"done"` | 185 | ignorado |
| `service_id + status_classification:"Resolvido"` | 185 | ignorado |
| `service_id + task_status:"done"` | 185 | ignorado |
| `/orders/:id/tasks` sem filtro | 1 | — |
| `/orders/:id/tasks?q=status:"zzz"` | **422** | o endpoint **valida** e publica o enum |
| `/orders/:id/tasks?q=status:"done"` | 1 | **filtra de verdade** |

**Conclusões:**

1. **`archived` dá para filtrar na consulta de `/orders`** — é o jeito preferível e foi
   adotado (`service_id:"..." archived:"false"`). Não está na tabela de filtros da
   documentação; foi provado por medição.
2. **Status de atividade não dá para filtrar em `/orders`.** Os três campos plausíveis são
   ignorados **sem erro** — o modo de falha perigoso: devolveriam a lista inteira parecendo
   filtrada. Só o endpoint de atividades filtra status, e ele é **por OS**, o que não evita
   a chamada por OS.
3. Portanto a leitura da última atividade custa **1 requisição por OS** (185 hoje, ~3 min a
   1 req/s numa carga completa).

## 5. Onde o `archived` entra hoje

- A listagem que a sincronização usa **não excluía arquivada por si**: o `q` só levava
  `service_id`. A exclusão dependia de um `if` no nosso lado (`_sincronizacao.ts` pula
  `archived === true`), e a suposição "a listagem não traz arquivada" **nunca tinha sido
  provada**.
- Agora está provado que dá para pedir ao servidor, e a consulta passou a levar
  `archived:"false"`. O `if` do nosso lado **continua** como cinto e suspensório — se um dia
  o filtro do servidor for ignorado, o comportamento não muda.
- **Nenhuma das 185 OS de hoje está arquivada** (`archived:"true"` → 0). A OS 7777, que o
  cliente disse ter arquivado, continua `archived: false` — pendência já registrada em
  `relatorio-exportacao-2026-09-15.md` §3.
- **Atividade arquivada é outra coisa** e não entra no critério: 4 OS têm a última atividade
  com `archived: true` (duas em `done`, uma em `scheduled`, uma em `pending`). As duas
  últimas **entram** pelo critério de status — nenhum sinal de que arquivar a atividade
  signifique encerrar a OS.

## 6. Dados brutos

O JSON com as 185 OS, suas 210 atividades e todos os cruzamentos ficou no scratchpad da
sessão (`analise-status.json`, `sondas-filtro.json`) — fora do repositório, porque carrega
dado de cliente sem necessidade de versionar. Tudo que decide alguma coisa está nas tabelas
acima.
