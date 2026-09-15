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
