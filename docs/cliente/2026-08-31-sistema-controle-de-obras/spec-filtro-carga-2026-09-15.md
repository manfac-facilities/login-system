# Spec — o filtro de entrada da sincronização com o Field (15/09/2026)

**Origem:** `feedback-17-criterio-da-primeira-carga.md` (critério por exclusão) e, logo
depois, `feedback-18-pendente-agendado-e-os-novas.md`, que **estreitou** a regra para uma
lista de inclusão. Vale o feedback 18. A decisão do João sobre "só as OS novas abertas"
está registrada lá: são **as que estão abertas hoje**, sem recorte por data de abertura.

**Fatos medidos em 15/09 na API real (só GET), base das decisões abaixo:**
`entregas/investigacao-status-atividades-2026-09-15.md`.

---

## 1. A regra

Uma OS do tipo **Atividade Spot** entra no Controle de Obras quando o **status técnico da
última atividade dela** é um destes dois:

| Estado aceito | Valor na API | Como o cliente chama |
|---|---|---|
| pendente | `pending` | pendente |
| agendado | `scheduled` | agendado |

Qualquer outro estado **não entra**. A OS arquivada no Field também não entra — e agora
isso é filtrado **no servidor**, com `archived:"false"` dentro do `q` (ver §4).

### O campo usado, e por que não é o `statusClassification`

- **O campo confiável é `status`**, o enum técnico da atividade. A própria API o documenta
  ao recusar um valor inválido: `must be a valid status: pending, scheduled, in-progress,
  done, canceled, reported, on-route, paused`. São os oito valores possíveis, fechados.
- **`statusClassification` NÃO resolve sozinho**: ele só existe em **84 das 210**
  atividades das 185 OS (126 vêm sem nenhum). Em **117 das 185 OS** a última atividade não
  tem classificação. Um critério baseado nele deixaria a maioria das OS sem resposta.
- **`statusClassification` nunca contradiz o `status`**: ele é um rótulo que a conta do
  cliente criou *dentro* de um estado técnico, e carrega o próprio estado em
  `statusClassification.status`. Nas 210 atividades houve **zero divergência**. Os cinco
  rótulos existentes hoje e o estado de cada um:

  | `statusClassification.description` | `.status` | atividades |
  |---|---|---|
  | Resolvido | `done` | 71 |
  | Orçamento Aguardando Aprovação | `pending` | 7 |
  | Falta de Tempo | `reported` | 3 |
  | Fechar OS | `done` | 2 |
  | Programado | `scheduled` | 1 |

- **`statusDescription` é lixo para regra**: é texto livre digitado pelo técnico ("sem
  tempo para executa", relatos de campo inteiros). Não entra no critério, em lugar nenhum.

### Qual é "a última atividade"

A de **maior `position`**; empate desfeito pela `updatedAt` mais recente. É a mesma regra
que gerou a coluna de status do Excel de 15/09, e a amostra real mostra `items` já
ordenados por `position` crescente. 21 das 185 OS têm mais de uma atividade.

---

## 2. Quantas OS entram

**63 OS**, pelos números de 15/09 — não 58.

A diferença de 5 não é erro de contagem: é o `statusClassification` aparecendo no lugar do
status técnico na coluna do Excel. Quem contou 58 somou os rótulos literais
`pending` (45) + `scheduled` (13). Mas:

- **4 OS** com o rótulo **"Orçamento Aguardando Aprovação"** são tecnicamente `pending`;
- **1 OS** com o rótulo **"Programado"** é tecnicamente `scheduled`.

45 + 4 = **49 pendentes**; 13 + 1 = **14 agendadas**; total **63**.

Ficam de fora 122 OS: 113 com a última atividade em `done`, 7 em `reported`, 1 em
`in-progress`, 1 em `on-route`.

---

## 3. O que acontece com a OS que **vira** resolvida depois de entrar

**Nada.** O sistema **nunca apaga uma obra por causa do Field** — regra fechada em 10/09.
O critério desta spec vale **para entrada**, não para remoção:

- obra que já está no banco **não é apagada, não é alterada e não é marcada como ausente**
  por ter saído do filtro;
- quando a OS volta na varredura com a última atividade em `done`, ela é tratada como
  **presente no Field** (não é ausência) e simplesmente **ignorada com motivo** — nenhuma
  escrita;
- como consequência, a obra segue no Controle de Obras até alguém encerrá-la **por dentro
  do sistema**, que é onde o fluxo de fim de esteira vive.

Isso também vale ao contrário: OS que hoje está em `done` e amanhã ganha uma atividade
nova em `pending` **entra** na varredura seguinte, sem nada de especial.

---

## 4. Onde o filtro roda

| Camada | O que faz |
|---|---|
| Query da API (`/orders`) | `service_id:"<Atividade Spot>" archived:"false"` — o `archived` é aceito **no servidor** (provado: `archived:"true"` devolve `totalCount` 0 e `archived:"false"` devolve 185, enquanto um campo inventado devolve 185, ou seja, filtro desconhecido é ignorado em silêncio) |
| Leitura da última atividade | `GET /orders/:id/tasks` por OS — **uma requisição por OS**. Não há como filtrar status de atividade na consulta de `/orders`: `status`, `status_classification` e `task_status` no `q` de `/orders` são **ignorados em silêncio** (devolvem as mesmas 185) |
| Decisão (`planejarSincronizacao`) | Aplica a lista de estados aceitos e devolve a OS excluída em `ignoradas`, com motivo |

**Custo:** a varredura completa passa de ~2 requisições para ~187, no ritmo documentado de
1 req/s — cerca de **3 minutos** de tela. A incremental só lê as OS que mudaram desde a
última marca d'água, então custa proporcional ao movimento do dia.

**O filtro vale nos dois tipos de varredura** — completa e incremental —, porque mora na
decisão, que é a mesma para o botão e para o `pg_cron`.

---

## 5. Onde mudar quando o cliente mudar de ideia

Um arquivo só: **`app/obras/sincronizar/_criterio-de-entrada.ts`**. Ele tem a lista dos
estados aceitos com o nome de cada um em português, e a tradução de cada estado recusado
para o motivo que aparece na tela. Mudar o critério é editar essa lista — não há `if` de
status espalhado pelo resto do código.

---

## 6. O que aparece na tela

A OS recusada entra na tabela **"O que ficou de fora"** do relatório de sincronização, no
mesmo padrão das exclusões que já existem (nº da OS, id no Field, motivo). Motivo, por
extenso: `OS com a última atividade concluída (done) — só entram pendente e agendado`.

Com os números de hoje isso significa **122 linhas** na tabela de ignoradas na primeira
carga. É muito, e é de propósito: o cliente precisa enxergar o que o filtro tirou.

---

## 7. Ambiguidades — não resolvidas aqui, para o cliente decidir

1. **58 ou 63?** A regra literal é "pendente ou agendado". Pelo estado técnico são **63**.
   Se o cliente quiser que "Orçamento Aguardando Aprovação" (4 OS) e "Programado" (1 OS)
   sejam lidos pelo rótulo e não pelo estado, o número vira 58 (ou 59). *Implementado
   como 63* — pelo estado técnico, que é o campo confiável.
2. **Os estados do meio ficam de fora e isso incomoda:** `in-progress` (1 OS, em
   andamento), `on-route` (1 OS, a caminho) e `reported` (7 OS, entre elas as 3 de "Falta
   de Tempo"). Pelo critério literal nenhum entra — obra em andamento fora do sistema é o
   oposto do que o projeto quer. Pergunta aberta ao cliente.
3. **"Fechar OS" e "Foi feito atendimento" contam como concluídas?** A pergunta do feedback
   17 **perdeu o efeito prático**: as duas são tecnicamente `done` e, na lista de inclusão,
   ficariam de fora de qualquer jeito. Fica registrada porque volta a importar se um dia o
   critério voltar a ser por exclusão.
4. **`canceled` e `paused` existem no enum da API mas não aparecem em nenhuma das 210
   atividades de hoje.** Nenhum dos dois entra pelo critério atual. Se o cliente passar a
   usar "cancelado", o sistema já o trata como recusado — mas não há nada que faça a obra
   já cadastrada virar cancelada, porque o sistema nunca apaga por causa do Field.
5. **Falha ao ler as atividades de uma OS** não derruba a varredura inteira: aquela OS é
   ignorada com o motivo da falha. Uma OS ignorada por falha nunca vira obra, e nunca
   altera obra existente.
