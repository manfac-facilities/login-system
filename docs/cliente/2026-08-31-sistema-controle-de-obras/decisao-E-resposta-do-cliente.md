# Decisão E — resposta do cliente

Recebida pelo João em 01/09/2026, antes de a pergunta chegar a ser enviada.

## Resposta literal

> já que a estrutura estava para falar do dia, o analisa deve preenher o sistema
> as 18h, ele deve receber uma notificção para isso, e os adms do hub recebem
> notificaçao também, caso o analista não tenha prenchido em até 1h deppois
> dizendo quem nao preencheu

## O que fica decidido

**O horário do ciclo diário passa de 9h para 18h.** Às 18h o dia de trabalho
acabou, então a pergunta "a obra andou hoje?" volta a fazer sentido — e a tela
volta a falar do dia corrente, não do dia anterior.

Isso dissolve a decisão E em vez de responder a uma das três opções que eu tinha
proposto: ele não escolheu entre olhar para trás e olhar para frente, mudou o
horário para que a pergunta original voltasse a fechar. **A decisão E sai do
`.txt` do cliente — resta só a B.**

## O que passa a existir

1. **Às 18h:** o analista recebe uma notificação para preencher o diário.
2. **Às 19h (1 hora depois):** se ele não preencheu, os **administradores do hub**
   recebem uma notificação **dizendo quem não preencheu**.

A cobrança que a decisão C tinha tirado da tela (a trava do 3º "não andou")
reaparece aqui, num lugar melhor: em vez de travar o analista no meio do
trabalho, o sistema avisa a diretoria quando o registro não aconteceu. O
alvo deixa de ser a obra parada e passa a ser o silêncio.

## Suposição que estou fazendo — CONFIRMAR com o cliente

Na resposta anterior ele disse que o agente de IA perguntaria aos analistas
**às 9h da manhã**. Agora define o preenchimento **às 18h**. Estou tratando 18h
como o novo horário do ciclo, substituindo as 9h — inclusive para a segunda etapa
com o agente de IA. Se a intenção for manter os dois momentos (agente de manhã e
preenchimento no fim do dia), o desenho muda e precisa ser dito.

## Quem são os "admins do hub"

O hub já tem esse conceito: tabela `hub_user_roles`, nível `administrador`, lido
por `lib/auth/roles.ts`. Não é preciso inventar um papel novo — a notificação vai
para quem já é administrador do hub.
