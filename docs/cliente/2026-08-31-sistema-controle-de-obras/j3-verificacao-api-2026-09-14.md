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

## O que continua sem prova

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
