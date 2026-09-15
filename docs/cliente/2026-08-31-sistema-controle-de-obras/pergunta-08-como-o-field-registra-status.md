# Pergunta 08 — como o Field registra a mudança de status e o cancelamento

**Escrita em 14/09/2026, revista na mesma noite** depois da medição no dado real
(`feedback-13-os-duplicadas-no-field.md`, seção "Medição"). A medição mostrou que **nenhum
número de OS se repete** e que o status fica nas **atividades dentro da OS** — 12 de 100 OS
têm mais de uma atividade. A pergunta agora serve para **confirmar** que a "OS nova" que a
equipe vê é uma **atividade nova** na mesma OS, e para achar onde o cancelamento aparece.
**Os exemplos são o que mais adianta**: com números reais, uma leitura na API responde por fato.

**Estado:** aguardando envio. A resposta entra literal no fim deste arquivo.

---

## Texto para enviar (literal)

Oi! Olhei as OS no Field e vi que nenhum número de OS se repete. Então preciso confirmar com você como a mudança de status aparece, para o sistema juntar tudo certo em uma obra só. São 3 perguntas e 2 exemplos:

*1. Quando o status de uma obra muda (por exemplo, a equipe volta outro dia, ou a obra passa para executado), o que aparece de novo no Field?*
A) Uma atividade nova dentro da mesma OS (o número da OS continua o mesmo)
B) Uma OS nova, com outro número
C) Nada novo: a mesma atividade só muda de status
D) Não sei

*2. Quando alguém cancela uma obra, o que muda no Field?*
A) A atividade fica com status de cancelada
B) A atividade é finalizada com um motivo de "cancelado"
C) A OS é arquivada
D) Outro jeito: ____

*3. Uma mesma obra pode ter mais de uma OS aberta ao mesmo tempo?*
A) Não, é sempre uma OS por obra
B) Sim, às vezes (por exemplo, quando abrem de novo por engano)
C) Sim, é normal

*Exemplos (é o que mais ajuda):*
4. O número de *uma OS* de uma obra que teve o status mudado mais de uma vez.
5. O número de *uma OS* de uma obra que foi cancelada.

---

## Para o João — o que cada resposta muda (não enviar)

| # | O que muda |
|---|---|
| 1 | **A** confirma a medição: uma obra = uma OS, a sincronização não duplica e a primeira carga pode seguir; falta só uma frente nova para ler as atividades e mostrar o status real. **B** contradiz o dado (nenhum número se repete) — aí os exemplos decidem. **C** = cada obra tem uma atividade só; as 12 com mais de uma são exceção |
| 2 | **A/B** = o sistema consegue detectar o cancelamento lendo as atividades (a confirmar no exemplo 5). **C** = a D2.1 já trata. **D** = cancelamento manual no sistema |
| 3 | **A** = os 2 pares de mesma loja + descrição encontrados são cadastro em dobro, para limpar no Field. **B/C** = precisa de regra para juntar OS diferentes da mesma obra |
| 4 e 5 | Uma leitura de `/orders/:id/tasks` desses números mostra exatamente o que muda — responde 1 e 2 por fato |
