# Feedback 10 — e se uma OS for excluída no Field?

**Recebido em 10/09/2026, fim da noite**, pelo João, transmitindo fala do cliente e
acrescentando a preocupação dele próprio. É a primeira questão de design da integração
levantada pelo cliente, e ela chegou antes de a integração existir — o que é o momento
certo.

## Texto literal — o cliente

> amanha eu vou fazer esse ajuste no Field e vou subir todas as OS lá,TODAS elas , um
> ponto que deve prever é: abri uma OS errado no field como atividade spot, como o
> sistema vai se comportar se eu precisar excluir essa OS? eu excluo pelo field ou excluo
> pelo sistema?

## Texto literal — o João, na sequência

> se excluir no field = perder o historico do sistema (acho arriscado demais, se um fdp
> vai la no field e exclui fudeu ne)

## Duas informações que já temos, e que decidem boa parte disso

**1. O Field NÃO avisa quando uma OS é excluída.** O levantamento da API de 08/09
documenta a lista completa de eventos de webhook (~26 eventos) e registra, literalmente:
**não existe `order-deleted` nem `order-archived`**. Só existem `order-created` e
`order-updated`.

Consequência direta: **não há como o sistema "receber" uma exclusão.** Ele só descobriria
por ausência — a OS deixar de aparecer numa varredura. E ausência é um sinal fraco: ela
também acontece se a API falhar, se o filtro mudar, se a OS trocar de tipo, ou se a
paginação escorregar. **Apagar dado com base em ausência é apagar dado com base em
suposição.**

**2. O que o sistema guarda não existe no Field.** Diário do dia, fotos de evolução,
respostas de "andou / não andou", motivos de bloqueio, tarefas geradas por falta,
histórico de etapa com autor e data — nada disso tem contraparte no Field Control. Uma
exclusão em cascata vinda de lá destruiria o que **só existe aqui**, e por decisão de
alguém que não estava olhando para cá.

## Desenho recomendado — três regras

**Regra 1 — O sistema nunca apaga nada por causa do Field.**
Nenhuma exclusão, arquivamento ou sumiço na origem remove obra, diário ou foto. A
integração é de entrada de dados, não de comando de destruição.

**Regra 2 — OS que some do Field vira ALERTA, não exclusão.**
Quando uma obra que veio do Field deixa de aparecer na varredura, a obra é marcada como
*"não está mais no Field"* e sai do fluxo ativo do dia — mas continua inteira, com todo o
histórico, esperando um humano decidir. Se foi engano, some o alerta e ela volta; se foi
proposital, alguém descarta pelo sistema.

**Regra 3 — Descartar é ação do sistema, feita por gente, e é reversível.**
Existe "descartar obra" dentro do sistema: pede motivo, grava quem fez e quando, e a obra
sai das telas do dia a dia sem ser apagada do banco. É o equivalente a arquivar, não a
deletar. Responde à pergunta do cliente: **exclui pelo sistema.**

## O atalho que resolve o caso concreto dele sem excluir nada

O caso que o cliente descreveu é *"abri uma OS errada como Atividade Spot"*. Para isso
não é preciso excluir coisa nenhuma dos dois lados:

**Basta corrigir o tipo da OS no Field.** O sistema só puxa OS do tipo "Atividade Spot"
(filtro por `service_id`). Mudou o tipo, a OS deixa de bater no filtro e para de ser
sincronizada — sem excluir, sem perder a OS no Field, sem destruir histórico em lugar
nenhum. É a correção mais barata e a menos destrutiva.

Vale dizer isso ao cliente **antes** de ele começar a subir as OS amanhã: *"se errar o
tipo, corrija o tipo — não apague a OS."*

## Complemento da mesma noite — o Field arquiva, não exclui

O João, logo depois:

> se bem que no field nao exclui.. ele só arquiva, ai da pra desarquivar eu acho

**Se isso se confirmar, é uma notícia boa e reforça o desenho acima**, não o contradiz. O
levantamento de 08/09 registra o campo `archived` no recurso de tipo de OS (`/services`);
para ordens de serviço a documentação não foi conclusiva — **está na lista de "o que não
deu para descobrir"**. É uma das primeiras coisas a verificar com a chave real.

Se o Field arquiva em vez de apagar, a OS continua existindo lá e o "sumiço" que o sistema
enxerga é só ela sair do filtro. Isso torna a Regra 2 ainda mais claramente certa:
**tratar como alerta, nunca como exclusão** — porque do outro lado nada foi destruído.

## A lista de eventos de webhook, literal, como o João mandou

Recebida em 10/09. **Ela bate exatamente com o levantamento de 08/09** — o que é uma
confirmação independente de que aquele documento está correto.

```
Criação de um formulário — Um formulário foi criado
Atualização de um formulário — Um formulário teve seu conteúdo atualizado
Criação de um anexo — Um anexo foi criado
Atualização de um anexo — Um anexo teve seu conteúdo atualizado
Exclusão de um anexo — Um anexo foi excluído
Criação de uma ordem de serviço — Uma ordem de serviço foi criada
Atualização de uma ordem de serviço — Uma ordem de serviço teve seu conteúdo atualizado
Criação de uma atividade — Uma atividade foi criada
Atualização de uma atividade — Uma atividade teve seu conteúdo atualizado
Atividade iniciada pelo colaborador — Uma atividade teve seu status alterado para 'Em andamento'
Impedimento da realização de alguma atividade — Uma atividade teve seu status alterado para 'Impedida'
Atividade concluída com sucesso — Uma atividade teve seu status alterado para 'Concluída'
Avaliação de uma atividade — Uma atividade teve sua avaliação alterada
Rota de uma atividade iniciada — Uma atividade teve seu status alterado para 'Em rota'
Criação de um comentário — Um comentário foi criado
Criação de um novo colaborador — Um novo colaborador foi criado
Solicitação de serviço aceita — Uma solicitação de serviço foi aceita
Solicitação de serviço cancelada — Uma solicitação de serviço foi cancelada
Criação de uma solicitação de serviço — Uma solicitação de serviço foi criada
Criação de um orçamento — Um orçamento foi criado
Orçamento cancelado — Um orçamento foi cancelado
Orçamento atualizado — Um orçamento foi atualizado
Orçamento aprovado — Um orçamento foi aprovado
Orçamento recusado — Um orçamento foi recusado
Veículo criado — Um veículo foi criado
Veículo atualizado — Um veículo foi atualizado
```

**O que essa lista prova, e o que ela prova é pela ausência:**

- **Não existe evento de exclusão de OS.** Existe "Exclusão de um anexo" — ou seja, o
  Field emite evento de exclusão quando quer. Para ordem de serviço, ele não emite. A
  ausência é deliberada, não esquecimento.
- **Não existe evento de cancelamento de OS.** Há "Solicitação de serviço cancelada" e
  "Orçamento cancelado" — mas *solicitação de serviço* (ticket) e *orçamento* são outros
  recursos. **O cancelamento de uma OS chega como `order-updated`**, e o sistema precisa
  descobrir o cancelamento lendo o conteúdo da OS, não o nome do evento.
- **Há uma mina de ouro não pedida:** os eventos de **atividade** (`Em andamento`,
  `Impedida`, `Concluída`, `Em rota`) são exatamente o sinal de campo que o Diário hoje
  depende de alguém digitar. Não entra na v1 e não deve entrar agora — mas anotar, porque
  muda o produto: o sistema poderia saber que a equipe chegou na loja sem ninguém
  responder nada.

## O que ainda precisa ser decidido, e é do cliente

- Uma obra marcada como "não está mais no Field" deve **sumir das telas** do dia a dia
  automaticamente, ou ficar visível com o alerta até alguém tratar?
- **Quem pode descartar** uma obra no sistema: qualquer analista, ou só administrador?
- Se a OS **reaparecer** no Field depois de descartada, ela volta sozinha ou precisa de
  reativação manual?
