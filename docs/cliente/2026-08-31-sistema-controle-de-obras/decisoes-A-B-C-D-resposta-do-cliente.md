# Decisões A, B, C e D — respostas do cliente

Recebidas pelo João em 01/09/2026, sobre o mockup v02. O cliente aprovou o
mockup e pediu alterações.

## Resposta literal

> a- pode manter as duas opções, o ciente gostou assim.
> b- nao entendi a pergunta,
> c-nao, deixe ficar marcando nao andou todo dia e o motivo,
> d- no primeiro momento o analista (yuri), num segundo momento vai ser um
> agente de ia que vai fazer as perguntaspara os analistas todo dia as 9h da
> manha

## A — RESOLVIDA: manter tabela E Kanban

Não é escolher uma. As duas ficam, com o seletor. Ele gostou de poder trocar.

## B — NÃO ENTENDIDA: precisa ser reformulada

A pergunta original ("responder uma obra por vez ou uma linha por obra numa lista
única?") não comunicou. **Decisão de trabalho:** em vez de reescrever em texto,
construir as duas formas no mockup com um seletor, do mesmo jeito que funcionou
na A. Ele decide vendo, não imaginando.

## C — RESOLVIDA: sem trava. Registrar e seguir

O cliente **recusou** a trava de escalada no 3º "não andou" seguido. A obra pode
ficar marcada como "não andou" todo dia, desde que **com o motivo**.

**Trade-off que ele aceitou, dito na cara:** era a trava que forçava alguém a
virar dono do problema — o mecanismo exato que faltou nos 123 dias do Bairro de
Fátima. Sem ela, o sistema passa a *registrar* o problema todo dia em vez de
*forçar* uma ação. O registro diário já é muito melhor que hoje (hoje não existe
registro nenhum), e a cobrança migra para o agente de IA e para o dashboard.
Decisão dele, comunicada e seguida.

O motivo continua obrigatório: "não andou" sem motivo não salva.

## D — RESOLVIDA, e trouxe informação nova

**Quem completa a obra crua do Field:** o analista — o Yuri. Não é fila aberta
sem dono, como eu havia adotado como padrão.

**Segunda etapa, com horário definido:** um agente de IA faz as perguntas para os
analistas **todo dia às 9h da manhã**. Isso confirma a decisão 01 (opção D) e
acrescenta o horário, que não existia antes.

## Conflito que a resposta D revelou — vira DECISÃO E

Se o agente pergunta **às 9h da manhã**, a pergunta "a obra **andou hoje**?" não
fecha: às 9h o dia de trabalho mal começou. Ou o analista responde sobre o dia
anterior, ou responde uma previsão do dia que começa. São telas diferentes:

- **Olhando para trás:** "a obra andou ontem? faltou algo? por que parou?" — é o
  registro do que foi produzido, que é o que o cliente pediu na reunião (minuto 37).
- **Olhando para frente:** "a obra vai andar hoje? tem material e equipe?" — pega
  a falta de material *antes* de o dia ser perdido, que é a dor do minuto 48.

As duas são defensáveis e resolvem problemas diferentes. Não dá para adivinhar:
vira DECISÃO E, na tela e no `.txt` para ele responder.
