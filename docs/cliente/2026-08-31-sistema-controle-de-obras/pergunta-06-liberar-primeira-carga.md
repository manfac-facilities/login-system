# Pergunta 06 — o que falta do cliente no Field para a primeira carga

**Escrita em 14/09/2026**, para o João enviar ao cliente. A integração está pronta e no ar
(D1, D2, D2.1); a chave funciona; o Field tinha **167 OS "Atividade Spot"** em 14/09. O
sistema **ainda não puxou nada**, de propósito: a primeira carga espera o pente fino do
cliente, e ela não tem volta fácil — o sistema nunca apaga obra por causa do Field.

**Estado:** aguardando envio. A resposta entra literal no fim deste arquivo.

---

## Texto para enviar (literal)

Oi! O Controle de Obras já está ligado no Field e pronto para puxar as obras. Antes de puxar, preciso de 3 confirmações suas, porque o que entrar no sistema vira obra de verdade (com diário e cobrança da equipe):

*1. O pente fino no Field terminou?*
A) Sim, pode puxar
B) Ainda não, te aviso quando terminar

*2. Hoje existem 175 OS do tipo "Atividade Spot" no Field. Todas elas são obras que a equipe precisa acompanhar no sistema?*
A) Sim, as 175 são obras ativas
B) Não, algumas já terminaram ou não são obra — vou arquivar ou mudar o tipo delas no Field antes
C) Não sei o número certo, vou conferir

Importante: o sistema puxa toda OS "Atividade Spot" que não estiver arquivada. OS que não é obra para acompanhar precisa ser arquivada ou ter o tipo trocado no Field antes da carga.

*3. Pode arquivar 1 OS de teste no Field e me mandar o número dela?*
Serve só para confirmarmos como o sistema enxerga OS arquivada. Depois pode desarquivar.
A) Sim, arquivei a OS nº ____
B) Prefiro não

---

## Para o João — o que cada resposta muda (não enviar)

| # | O que muda |
|---|---|
| 1 | **A** libera a primeira carga ("Puxar do Field" em produção). **B** mantém tudo parado |
| 2 | **A** confirma o universo. **B/C**: não puxar até ele confirmar — obra errada que entra não sai sozinha. Se o número mudar muito depois do ajuste, conferir de novo antes de puxar |
| 3 | Fecha o item 3 do `backlog-integracao-field.md`: uma chamada de leitura mostra se a listagem inclui OS arquivadas. Não bloqueia a carga — o filtro da D2.1 cobre os dois casos |
