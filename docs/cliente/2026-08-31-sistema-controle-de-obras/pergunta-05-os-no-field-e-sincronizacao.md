# Pergunta 05 — como o sistema deve reagir ao que acontece no Field

**Escrita em 14/09/2026**, para o João enviar ao cliente. Nasceu da revisão da D2 (achado
I2, OS recriada com o mesmo número) e das perguntas do Duda sobre a D3 (frequência da
sincronização). Só entrou aqui o que é decisão de negócio; limites técnicos — como a trava
contra ausência em massa — ficam com o João.

**Estado:** aguardando envio. Quando a resposta chegar, ela entra literal no fim deste
arquivo antes de virar decisão.

---

## Texto para enviar (literal)

Oi! Estamos ligando o Controle de Obras direto no Field, e preciso de 4 respostas rápidas suas. Pode responder só com o número e a letra (ex.: 1A, 2B...).

*1. Quando vocês excluem uma OS no Field, o que acontece com ela?*
A) Some de vez, não dá para recuperar
B) Fica arquivada e dá para recuperar depois
C) Não sei

*2. Se alguém abrir uma OS errada no Field, apagar e abrir de novo com o MESMO número, o que o sistema deve fazer?*
A) Tratar como obra nova, começando do zero. A antiga fica marcada no sistema para alguém da Manfac decidir o que fazer com ela (nada é apagado)
B) Juntar as duas: a nova herda tudo o que já foi registrado na antiga (diário, fotos, histórico)
C) Isso não acontece aqui: o Field não deixa repetir número

*3. Depois que uma OS nova é aberta no Field, em quanto tempo ela precisa aparecer no sistema?*
A) Em até 15 minutos
B) Em até 1 hora
C) Uma vez por dia está bom
E isso vale só em horário comercial ou também à noite e no fim de semana?

*4. Quando uma OS some do Field, o sistema marca a obra com o aviso "Não está mais no Field". Para não dar alarme falso (por exemplo, numa falha momentânea do Field), ele só coloca o aviso depois de conferir duas vezes, com um dia de intervalo. Ou seja: o aviso aparece cerca de 24 horas depois. Está bom assim?*
A) Sim, 24 horas está bom
B) Não, precisa avisar mais rápido, mesmo com risco de alarme falso de vez em quando

Em todos os casos, o sistema nunca apaga obra, diário ou foto por causa do Field.

---

## Para o João — o que cada resposta muda (não enviar)

| # | O que muda | Recomendação |
|---|---|---|
| 1 | Se o Field só arquiva, a OS "sumida" pode voltar, e o reaparecimento limpar o alerta (que a D2 já faz) passa a ser o caso comum, não o raro | — é fato, não escolha |
| 2 | Decide o achado I2 da revisão da D2. Hoje o conflito fica ignorado para sempre | **A.** Juntar pelo número é exatamente o erro que o `field_id` existe para evitar — um número reaproveitado para outra loja herdaria diário e fotos da obra errada. Se vier B, vale conversar antes de construir |
| 2C | Se o Field não deixa repetir número, o I2 cai para caso raríssimo | — |
| 3 | Frequência do agendador da D3 e janela de horário | 15 min em horário comercial é barato (rate limit 1 req/s, incremental lê pouco) |
| 4 | Frequência da varredura completa: a D2 exige duas completas seguidas | **A.** Mais rápido exige completa várias vezes ao dia e aumenta alarme falso |
