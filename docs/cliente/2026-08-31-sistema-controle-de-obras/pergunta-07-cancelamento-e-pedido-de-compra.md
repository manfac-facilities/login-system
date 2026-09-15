# Pergunta 07 — cancelamento de obra e pedido de compra

**Escrita em 14/09/2026**, para o João enviar ao cliente. Junta as perguntas em aberto de
dois feedbacks:

- `feedback-11-cancelamento-de-obra.md`, seção "Perguntas em aberto" (3 perguntas);
- `feedback-09-estados-do-fim-da-esteira.md`, seção "O que precisa ser respondido" — das 4,
  **3 vão ao cliente**; a primeira ("é fala do cliente ou definição do João?") é do João.

Travam: o **cancelamento de obra** (Duda, a partir de 23/09 no cronograma) e o **pedido de
compra** (depois do cancelamento). Também definem o nome do fim da esteira no mockup da J4.

**Estado:** aguardando envio. A resposta entra literal no fim deste arquivo.

---

## Texto para enviar (literal)

Oi! Mais 6 perguntas rápidas para fechar duas partes do sistema: cancelamento de obra e pedido de compra. Pode responder só com número e letra (ex.: 1A, 2B...).

*CANCELAMENTO*
O sistema vai ter a opção de cancelar uma obra, com o motivo "Cancelado pelo Cliente" ou "Cancelado pela Manfac". Obra cancelada sai do diário e das cobranças, mas nada é apagado e dá para desfazer.

*1. Quem pode cancelar uma obra no sistema?*
A) Qualquer pessoa da equipe que usa o sistema
B) Só os administradores

*2. Se o cliente cancelar uma obra que a Manfac já executou (serviço feito), o que o sistema deve fazer?*
A) Tratar como cancelada normalmente
B) Não cancelar: a obra segue até faturar o que já foi feito
C) Depende do caso, vamos conversar

*3. Quando uma OS é cancelada, o que acontece com ela no Field?*
A) É arquivada
B) Continua ativa, só muda o status ou o tipo
C) Ninguém mexe no Field, só se avisa a Manfac

*PEDIDO DE COMPRA*

*4. Depois que a OS é aprovada, a Manfac só pode faturar quando o cliente manda o pedido de compra?*
A) Sim, sempre precisa do pedido de compra
B) Quase sempre, mas às vezes fatura sem ele
C) Não, o pedido de compra não é o que libera o faturamento

*5. Vocês querem registrar o pedido de compra no sistema?*
A) Sim, o número e a data em que chegou
B) Só a data em que chegou
C) Não precisa registrar

*6. Quando a obra está pronta mas o cliente ainda não aprovou a OS, como a equipe chama essa situação?*
A) "Pendente aprovação da OS"
B) "Pendente fechamento"
C) Outro nome: ____

---

## Para o João — o que cada resposta muda (não enviar)

| # | O que muda |
|---|---|
| 1 | Quem vê o botão "Cancelar obra". **A** segue a linha do feedback 12 ("qualquer um cadastra"). **B** exige trava por papel — e a trava precisa estar também no banco, não só na tela (a RLS de `obras_*` hoje deixa qualquer usuário com acesso escrever tudo) |
| 2 | **A** é o cancelamento simples. **B** faz "cancelada depois de executada" virar outra saída (encerrar sem cobrança diária, mas faturável) — aumenta o escopo do Duda. **C** trava o cancelamento até a conversa |
| 3 | **A** permite que a sincronização detecte o cancelamento sozinha (a D2.1 já filtra OS arquivada e ela vira "não está mais no Field"). **B/C** exigem marcar à mão no sistema |
| 4 | **A** torna o pedido de compra pré-requisito para faturar. **B** vira campo opcional. **C** tira o pedido de compra do escopo |
| 5 | Define as colunas: número + data, só data, ou nenhuma. Com **C**, a tarefa "pedido de compra" do cronograma some |
| 6 | Nome da etapa `aprovarOS` na tela (e no mockup da J4). **A** renomeia; **B** mantém; **C** usa o nome dito |

---

## Resposta — 14/09/2026 (literal, colada pelo João no chat)

> 1A
> 2B
> 3B - status muda pra cancelado e talvez deja arquivada no futuro
> 4A
> 5A
> 6C - Executado - pendente aprovação os (isso é grave pq é dinheiro parado e que depende do cliente)

Em texto corrido:

1. **A** — qualquer pessoa da equipe com acesso pode cancelar.
2. **B** — obra já executada **não é cancelada**: segue até faturar o que foi feito.
3. **B** — no Field, a OS cancelada **continua ativa com status "cancelado"**; talvez seja arquivada no futuro.
4. **A** — o faturamento **sempre** precisa do pedido de compra.
5. **A** — registrar **número e data** em que o pedido de compra chegou.
6. **C** — o nome é **"Executado - pendente aprovação OS"**, com a ressalva: *"isso é grave pq é dinheiro parado e que depende do cliente"*.

### O que isso muda (leitura do Claude, 14/09)

| # | Consequência |
|---|---|
| 1 | Sem trava por papel no cancelamento — mesma linha do "qualquer um preenche" |
| 2 | "Cancelar" só existe **antes** de a execução em campo ser concluída. Depois disso a obra segue a esteira até faturar. O cancelamento fica **menor** que o estimado (6–10 h), não maior |
| 3 | **A sincronização não detecta o cancelamento sozinha:** a D2.1 só reage a `archived`, e a OS cancelada continua ativa. E a J3 não encontrou campo de status na ordem (`/orders` traz `archived`, não `status`) — o "status cancelado" pode estar em outro recurso (atividade/tarefa da OS). **Cancelar no sistema fica manual** até isso ser verificado. Liga-se ao feedback 13 (OS duplicadas quando o status muda) |
| 4 | Pedido de compra é **pré-requisito** para concluir "Pendente faturamento" |
| 5 | Duas colunas novas: número e data do pedido de compra |
| 6 | Renomear a etapa `aprovarOS` para **"Executado - pendente aprovação OS"** em todas as telas. E ela é **dinheiro parado que depende do cliente** — pede destaque próprio nos alertas, não só um nome |

**Pergunta só para o João, do feedback 09:** o texto "Obra concluída - OK / Pendente aprovação
da OS / OU / Pendente faturamento (OS aprovada e cliente ainda não enviou o pedido de compra)",
de 10/09, é fala do cliente ou definição sua?
