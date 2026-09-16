# Medição do critério final — 15/09/2026, noite

Contagem feita **contra o Field real**, só leitura (GET), com o mesmo filtro e a mesma
paginação da sincronização: serviço "Atividade Spot", `archived:"false"`, e a situação lida da
**última atividade** de cada OS (maior `position`, empate pela atualização mais recente).

## Resultado

| Situação da última atividade | OS | Entra? |
|---|---|---|
| `done` — concluída | 113 | não |
| `pending` — pendente | 49 | **sim** |
| `scheduled` — agendada | 14 | **sim** |
| `reported` — reportada | 7 | não |
| `in-progress` — em andamento | 1 | **sim** |
| `on-route` — a caminho | 1 | não |
| **Total** | **185** | |

**Entram 64 OS. Ficam de fora 121.**

## O que isso confirma

- **Nenhuma OS ficou sem situação.** O caso "sem situação legível" não apareceu em nenhuma das
  185 — o João já havia dito isso, e a medição confirma. O tratamento continua no código porque
  uma falha de leitura cai no mesmo caminho.
- **A conta prevista bateu exatamente**: 49 + 14 + 1 = 64, sem surpresa entre o cálculo sobre os
  dados extraídos mais cedo e a leitura nova.
- **As 3 OS de teste** ("TESTE SPOT", "teste4", "testeheleno") estavam entre as concluídas e as
  reportadas, então **não entram** — sem precisar de regra especial para nome com "teste".
