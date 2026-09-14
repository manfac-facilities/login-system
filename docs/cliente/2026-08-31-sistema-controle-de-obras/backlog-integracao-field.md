# Backlog — integração com o Field (fora do pedido ao desenvolvedor)

Criado em 14/09/2026, pela régua do conselho (`conselho-revisao-d21-2026-09-14.md`): o que
**não bloqueia merge nem a primeira carga** vem para cá e **não volta ao desenvolvedor** até
a dor aparecer ou alguém decidir priorizar. Cada item diz de onde veio e o que o faria
subir de prioridade.

| # | Item | Origem | Sobe de prioridade se… |
|---|---|---|---|
| 1 | **Herdar só se a loja for a mesma** — protege contra número de OS reaproveitado em outra loja | conselheiro de dados, 14/09 | aparecer um caso real de número reaproveitado no Field |
| 2 | **Aviso "varredura suspeita" se repete** a cada varredura quando o cliente arquiva mais de 20% com a base já cheia; a detecção de ausência fica parada até alguém agir | conferência da D2.1 (`conferencia-d21-2026-09-14.md`) | o cliente fizer arquivamento em lote com a base cheia |
| 3 | **A listagem com filtro `service_id` inclui OS arquivadas?** Com o filtro da D2.1 o código fica certo nos dois casos; a resposta só muda se a ausência ou o `archived` é o sinal principal | J3, segunda rodada | houver uma OS arquivada de verdade para testar (uma chamada de leitura) |
| 4 | **O que `GET /orders/:id` devolve para id bem formado e inexistente** — hoje não importa: 404 não herda | J3, segunda rodada | alguém propuser usar "inexistente" como sinal |
| 5 | **`field_id` antigo sobrescrito na herança sem registro persistente** | revisão D2.1, I3 | entra naturalmente na D3, na linha de `obras_sync_execucao` — conferir quando a D3 chegar |
| 6 | **Antiga presente na varredura e já arquivada** vira conflito, sem herança (saída conservadora) | conferência da D2.1 | o conflito aparecer com frequência no relatório |
| 7 | Menores das revisões: M1, M3, M5 da D2.1 e o restante da série M | `review-d21-2026-09-14.md`, `review-d2-2026-09-14.md` | um deles causar incidente |

**Fechados, não reabrir:** N5 (página extra quando o total é múltiplo de 100 — o autor está
certo, evitá-la devolve ao `totalCount` o poder de encerrar a leitura); M2 e M4 (descartados
pelo conselho).
