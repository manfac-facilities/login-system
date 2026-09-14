# D2 — Critério de ausência de uma OS no Field Control

## Regra operacional

Uma obra só recebe o alerta **"não está mais no Field"** depois de ficar ausente em
**duas varreduras completas, consecutivas e bem-sucedidas** do tipo de OS integrado.
A primeira ausência guarda apenas uma suspeita; a segunda confirma e torna o alerta
visível. Nenhuma dessas etapas apaga, arquiva ou esconde a obra.

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
