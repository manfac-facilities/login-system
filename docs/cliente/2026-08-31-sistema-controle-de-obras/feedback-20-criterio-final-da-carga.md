# Feedback 20 — o critério final da carga

**Recebido em 15/09/2026, noite**, colado pelo João no chat do Claude Code. **É a palavra final do
cliente sobre o que entra no sistema** — registrado literal antes de qualquer interpretação.

## Texto literal

> ele falou pela ultima vez: fala pra ele puxar as atividades spot com status pendente, agendado,
> em andamento

## A regra

Entram as **atividades Spot** cuja classificação seja **pendente**, **agendado** ou **em
andamento**. Tudo o mais fica de fora.

Comparado ao feedback 18, ele acrescentou **em andamento**. Isso resolve sozinho a dúvida que eu
ia levar a ele sobre obra que já está acontecendo: ela entra.

## Como esta regra fecha as pontas soltas

| Ponta solta | Como fica |
|---|---|
| "Fechar OS", "Foi feito atendimento", "Falta de Tempo" e os textos livres | Não são classificação. O que decide é a classificação da última atividade, seja qual for o texto |
| "a caminho" (`on-route`), "reportado", "Orçamento Aguardando Aprovação" | Ficam de fora, por não estarem na lista. Se aparecer obra viva presa nesses estados, a correção é acrescentar o valor à lista, num lugar só |
| As 3 OS de teste | Não recebem tratamento especial. Se a classificação delas estiver na lista, entram e a gente remove do banco depois |
| OS 7777 e o campo "arquivado" | Não vira pergunta ao cliente. O filtro de classificação já exclui o que não interessa |

## Decisão de processo tomada junto (João, 15/09)

**Acabaram as perguntas ao cliente.** O que ficar ambíguo é decidido aqui, com os dados que já
temos, registrado e feito de forma barata de reverter. O próximo contato com o cliente é o sistema
funcionando com as obras dele dentro.
