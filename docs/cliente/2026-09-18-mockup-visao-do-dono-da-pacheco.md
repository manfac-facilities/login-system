# Pedido do cliente — mockup de visão para o dono da Drogaria Pacheco

Recebido pelo João e colado no chat em **18/09/2026**. Contexto dado por ele: o cliente tem
**reunião hoje com o dono da Drogaria Pacheco** e pediu um mockup para dar visibilidade da
operação ao dono da empresa.

Texto literal do cliente, sem edição:

> Crie um mock up de como eu apresentaria a informação pro cliente sem demonstrar a operação
> interna da manfac, Quando a obra começar enviar e-mail, quando acabar enviar e-mail,
> Estrutura mock up de obra para o dono da Pacheco
>
> Ele precisa de um mock up pra ver obras, manutenção, cronograma Uma visão de agente de ia que
> dispara as informações pra ele (ele tem que olhar uma página que ele vai ter a informação da
> op em tempo real)

## O que muda em relação a tudo o que foi feito até aqui

Todas as telas do Controle de Obras feitas até 18/09 são **internas da Manfac** — Triagem,
ficha, esteira, diário, prazos. Este pedido é a **primeira tela voltada para fora**: quem lê é
o cliente do cliente, o dono da rede de farmácias.

Consequência direta, e é o coração do pedido: **"sem demonstrar a operação interna da
Manfac"** — o que aparece é o que interessa ao dono da rede (a obra da loja dele está em pé?
quando termina?), não como a Manfac se organiza para entregar.

## Decisões do João, 18/09/2026 — antes de desenhar

| Pergunta | Decisão |
|---|---|
| Mostra obra atrasada e remarcação? | **Não. Só avanço e conclusão.** |
| Que dados entram? | **Lojas reais, números ilustrativos** (DP LEBLON 6, DP LEBLON 2, DP PECHINCHA 4, DP BARRA DA TIJUCA 8) |
| O que o agente de IA faz? | **Avisa e resume:** e-mail no início e no fim da obra, e um resumo na página. Sem campo de perguntar/responder |
| Manutenção? | **Seção desenhada, dados de exemplo** — vem do Cockpit de Manutenção Predial, outro sistema, não integrado |
| Interface | Feita com a skill de UI/UX, **para leigo**: dono de rede de farmácia, não gestor de obra |

### A recomendação que foi contrariada, e o que se fez com ela

O Claude recomendou **mostrar o atraso com o motivo**: a maioria dos atrasos em obra de loja é
causada pelo próprio cliente (loja não liberou acesso), e esconder faz o dono descobrir pelo
gerente da loja — aí a página perde a confiança dele de vez. O João decidiu o contrário.

**Mitigação aplicada, que respeita a decisão sem mentir:** a página usa **fato em vez de
julgamento**. Escreve "em execução desde 12 de setembro", não "atrasada" nem "no prazo". Obra
parada continua aparecendo, com a data ficando velha à vista de quem lê — o dono tira a própria
conclusão, e a página nunca é pega mentindo.

### A regra de conteúdo, que é o coração do pedido

Não aparece em lugar nenhum: equipe, prestador, funcionário, analista, custo, valor, orçamento,
motivo de atraso, prazo interno, SLA, etapa da esteira interna, número de OS, jargão de sistema.
Na dúvida, é interno e sai.
