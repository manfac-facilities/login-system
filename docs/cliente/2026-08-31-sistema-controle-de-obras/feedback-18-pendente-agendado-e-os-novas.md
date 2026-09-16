# Feedback 18 — pendente ou agendado, pela última atividade, e só as OS novas

**Recebido em 15/09/2026, noite**, colado pelo João no chat do Claude Code, logo depois do
feedback 17. **Registrado literal antes de qualquer interpretação.**

## Texto literal

> o cliente falou: o sistema tem que puxar a os assim que ela for aberta, com status de pendente
> ou agendado - voce deve sempre puar a última atividade da os, no momento só puxar as os novas
> abertas

## Leitura

Três regras, e a terceira é ambígua:

1. **A OS entra assim que é aberta**, com status **pendente** ou **agendado**. O critério do
   feedback 17 ("não arquivada, nem resolvida/concluída") fica mais estreito: em vez de excluir
   os estados finais, agora se **inclui apenas dois estados**.
2. **O status vem sempre da última atividade da OS.** Confirma o que a medição de 14/09 já
   indicava e o que o código faz.
3. **"no momento só puxar as os novas abertas"** — é a parte ambígua. Duas leituras:
   - **(a) Só o que for aberto de agora em diante.** A primeira carga traz **zero** obras, e o
     sistema vai se enchendo conforme o Field receber OS nova.
   - **(b) As que estão abertas hoje**, ou seja, as que estão em pendente ou agendado neste
     momento: **58 OS** pelos números de 15/09 (45 pendentes + 13 agendadas).

## Números de 15/09 pelo critério novo

| Status da última atividade | OS | Entra? |
|---|---|---|
| pending | 45 | sim |
| scheduled | 13 | sim |
| Resolvido | 58 | não |
| done | 51 | não |
| Fechar OS, Foi feito atendimento, Programado, on-route, in-progress, reported, Orçamento Aguardando Aprovação, texto livre | 18 | **não**, pelo critério literal — nenhum deles é "pendente" nem "agendado" |

**58 OS pela leitura (b); 0 pela leitura (a).**

## O que isso derruba do que estava em pé

- A pergunta sobre "Fechar OS" e "Foi feito atendimento" (feedback 17) **perde o sentido**: pelo
  critério novo, nenhum dos dois entra, porque a regra virou lista de inclusão.
- Os 18 registros da última linha da tabela incluem estados que parecem obra viva — "on-route"
  (a caminho), "in-progress" (em andamento) e "Orçamento Aguardando Aprovação". **Pelo critério
  literal, eles ficam de fora.** Vale perguntar ao cliente, porque obra em andamento fora do
  sistema é exatamente o que o projeto quer evitar.

## Decisão do João — 15/09/2026, noite

A ambiguidade da regra 3 foi resolvida: **"as que estão abertas hoje"**, ou seja, entram agora as
OS cuja última atividade está em pendente ou agendado — **58 pelos números de 15/09**. Não há
recorte por data de abertura.

O porquê apresentado junto: com a leitura (a), a carga traria zero obras e o Yuri abriria o
sistema em 21/09 sem nada para tocar, o que derruba o teste do cliente e o prazo dele.
