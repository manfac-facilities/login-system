# Feedback 13 — as OS estão duplicadas no Field

**Recebido em 14/09/2026, noite**, pelo João, no chat, logo depois da pergunta 07 ser
escrita e enquanto a pergunta 06 (liberar a primeira carga) aguardava envio/resposta.
Não foi dito se é fala do cliente ou constatação do João. **Registrado literal antes de
qualquer interpretação.**

## Texto literal

> 1- Essas 167 os estao duplicadas, quando atuaiza o status da os é criada uma nova no
> field, temos que ver uma forma de cada os ser apenas uma e a atualizaçao dela atualiza o
> sistema

## O que isso contradiz no que foi construído

Tudo o que a integração faz hoje supõe que **uma obra = uma OS no Field**, identificada
pelo `field_id` (o `id` da ordem, imutável):

- a sincronização cria uma obra por OS e casa pelo `field_id` (D2);
- OS que some da listagem vira suspeita e, 24 h depois, alerta de "não está mais no
  Field" (D2);
- OS nova com o **mesmo número** de uma obra existente só herda o histórico se a antiga
  estiver **arquivada** (D2.1);
- a J3 contou **167 OS "Atividade Spot"** — número que foi usado no cronograma e na
  pergunta 06 como "as obras".

Se cada mudança de status **cria uma OS nova**, então (a confirmar com dado):

1. a primeira carga criaria **uma obra por versão** da mesma obra — base inflada e
   duplicada, e o sistema nunca apaga;
2. a identidade estável não seria o `id` da ordem; seria preciso achar o que liga as
   versões (mesmo número? campo `external`? `ticket`? loja + descrição?);
3. a OS antiga continuaria ativa ou seria arquivada? Se continua ativa, a D2.1 trataria
   como **conflito**; se é arquivada, a D2.1 já trataria como **herança** — mas só se o
   número for o mesmo.

## Estado

Nenhuma carga foi feita (0 obras no banco; jobs do `pg_cron` não criados; "Puxar do Field"
não foi apertado). **A primeira carga fica suspensa até isto estar entendido.**

Próximo passo: medir no dado real (chamadas só de leitura, saída agregada, sem dado de
cliente) quantas das 167 são versões da mesma obra, e o que as liga.

---

## Medição no dado real — 14/09/2026, noite

Duas rodadas de chamadas só de leitura à API, autorizadas pelo João ("vamos ter que
investigar o denominador comum"). Saída agregada; nenhum dado de cliente copiado para cá.

**Ordens de serviço (`/orders`, tipo "Atividade Spot"):**

| Medida | Resultado |
|---|---|
| Total listado | **175** (eram 167 na J3 de manhã) |
| Arquivadas | 0 |
| Número da OS (`identifier`) repetido | **nenhum** — 175 números distintos |
| Mesma loja + mesma descrição | 2 pares (4 OS), números diferentes, ambas ativas; num dos pares as duas criadas no mesmo instante — cara de cadastro em dobro, não de "versão" |
| `external` / `ticket` | não diferenciam (um valor único para todas / nulo) |
| Campo de status na OS | **não existe** |

**Onde o status mora: nas atividades da OS** (`GET /orders/:id/tasks`, 200). Cada atividade
tem `status`, `statusDescription` e `statusClassification`. Nas primeiras 100 OS:

| Atividades por OS | Nº de OS |
|---|---|
| 1 | 88 |
| 2 | 10 |
| 3 | 1 |
| 4 | 1 |

Status encontrados: `done`, `pending`, `scheduled`, `reported`. **Nenhum "cancelado"** na
amostra — o cancelamento pode estar em `statusClassification` (motivo), não confirmado.

### Leitura

O dado **não mostra OS duplicadas**. O mais provável é que "quando atualiza o status da OS é
criada uma nova" seja **uma atividade nova dentro da mesma OS** (12 de 100 OS têm mais de
uma). Se isso se confirmar:

- **uma obra continua sendo uma OS** — a sincronização (D1–D3) não duplica, e a primeira
  carga não precisa esperar por isto;
- o que falta é **ler as atividades** para o sistema saber o status real da obra (e,
  talvez, o cancelamento) — frente nova, fora do que existe hoje.

Confirmação pedida ao cliente na `pergunta-08-como-o-field-registra-status.md`, com exemplos
reais.
