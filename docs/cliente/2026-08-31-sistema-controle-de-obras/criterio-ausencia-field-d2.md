# D2 — Critério de ausência de uma OS no Field Control

## Regra operacional

Uma obra só recebe o alerta **"não está mais no Field"** depois de ficar ausente em
**duas varreduras completas, consecutivas e bem-sucedidas** do tipo de OS integrado,
separadas por cerca de um dia. A primeira ausência guarda apenas uma suspeita; uma nova
varredura completa depois de pelo menos **20 horas** confirma e torna o alerta visível.
A tolerância evita que pequenas diferenças na duração da leitura empurrem o aviso diário
para 48 horas; a espera de aproximadamente 24 horas foi aprovada pelo cliente em
14/09/2026. Nenhuma dessas etapas apaga, arquiva ou esconde a obra.

A identidade usada nessa comparação é o `idField`, persistido como `field_id`. O número
da OS não é uma identidade estável: ele pode ser corrigido no Field. Quando o mesmo
`field_id` reaparece com outro número, a obra existente recebe o número novo e o relatório
explicita **"número da OS alterado"**; não se cria outra obra e não se abre suspeita de
ausência para a anterior.

## Quando uma varredura pode provar ausência

Uma varredura só pode avançar uma suspeita ou confirmar um alerta quando todas estas
condições forem verdadeiras:

1. ela foi pedida explicitamente como **completa**, sem marca d'água nem filtro
   incremental (`desde`);
2. a consulta usou o tipo de OS configurado para a integração;
3. todas as páginas do Field foram recebidas e normalizadas sem erro de rede, HTTP ou
   paginação;
4. a leitura das obras existentes no banco também terminou por inteiro antes de qualquer
   marcação de ausência.

Se qualquer leitura falhar, a execução para sem marcar suspeita ou ausência. Falha não é
evidência. Uma varredura incremental nunca marca ausência, mesmo quando termina com
sucesso, porque por definição ela omite quase todas as OS que não mudaram.

Mesmo depois de uma leitura tecnicamente completa, um disjuntor impede ausência em
massa: se já existem obras do Field no banco e a API devolver zero OS, ou se as ausências
ainda não alertadas ultrapassarem o maior valor entre **3 obras** e **20%** das obras
conhecidas do Field, nenhuma nova suspeita ou confirmação é gravada e o relatório avisa
que a varredura foi considerada suspeita. Ausências já confirmadas não entram no
numerador e não desligam a detecção futura. `totalCount` não encerra paginação, pois pode
estar defasado; somente uma página menor que o limite prova o fim. Uma resposta de
`/orders` sem a lista `items`, ou uma página cheia repetida, é erro de leitura, nunca
lista vazia nem continuação válida.

## OS reaberta com o mesmo número

Quando chega um `field_id` novo usando um número que já pertence a uma obra vinculada a
outro `field_id`, a sincronização procura primeiro o `field_id` antigo na própria
varredura. Se ele veio na listagem, não consulta e não herda: o caso fica como conflito
visível. Só consulta a ordem antiga diretamente no Field quando o identificador anterior
não veio na listagem:

- se `archived === true`, a obra mantém todo o histórico,
  recebe o `field_id` novo, limpa suspeita e alerta, e o relatório registra **"OS
  reaberta: histórico herdado"**;
- se `archived === false`, as duas são uma duplicidade e o conflito continua
  visível, sem herança;
- em qualquer outra resposta — 404, 422, campo ausente ou falha — não há herança, e o
  motivo da consulta é levado ao relatório como veio.

Uma OS com `archived === true` na listagem é filtrada na entrada: não cria obra, não conta
como presença, não limpa alerta e não atualiza a obra. Ainda não está provado se o filtro
por tipo do Field inclui arquivadas; a regra é segura nos dois comportamentos.

Troca de números entre duas obras permanece conflito. Na dúvida, o sistema nunca junta
históricos.

## Quais obras entram na comparação

Somente uma obra com `fonte = 'field'` participa da detecção de ausência. `fonte` nula
significa procedência desconhecida e, por segurança, nunca é marcada. Quando uma obra
legada é reencontrada pelo número da OS, a sincronização grava `field_id` e `fonte =
'field'` se esses campos ainda estiverem vazios.

## Reaparecimento

Encontrar novamente o mesmo `field_id` é evidência positiva e limpa tanto a suspeita
quanto o alerta, inclusive numa leitura incremental válida. O relatório informa quantos
alertas foram removidos. A obra continua visível em todos os momentos.

## Pontos de negócio ainda abertos

Até o cliente responder às perguntas registradas no levantamento, o comportamento fica
isolado e conservador:

- a obra alertada continua nas telas e recebe uma etiqueta na Base;
- descarte, permissão para descartar e reativação depois de descarte não pertencem à D2;
- nenhuma resposta futura exige mudar o critério técnico de ausência acima, apenas a
  política de exibição ou o fluxo humano posterior.

No caso concreto de uma OS aberta por engano como **Atividade Spot**, a orientação de
processo é corrigir o tipo no Field em vez de excluir. A D2 ainda produzirá o alerta, sem
destruir o histórico do hub.
