# Revisão do mockup J4 (`mockup-j4.html`) — 14/09/2026

Só leitura. Linhas se referem ao `mockup-j4.html` do scratchpad. Conferido contra
`j4-decisoes-2026-09-14.md`, `j4-conciliacao-2026-09-14.md`, `artifact.d.ts`/`claude.d.ts`
e o código (`app/obras/_lib/tipos.ts`, `obra/[id]/_ficha.tsx`).

---

## PRECISA CORRIGIR ANTES DE PUBLICAR

1. **A FONTE serializa o DOM vivo, e o contrato proíbe (l. 308).** `document.documentElement.outerHTML`
   pega o `<head>` com o que o visualizador injetou (scripts do runtime). Cada salvamento
   republica esses scripts, e a versão seguinte recebe mais uma injeção por cima. O
   `artifact.d.ts` diz, na doc de `publish(html)`: *"Do not serialize the live DOM
   (`document.documentElement.outerHTML` contains viewer-session state and injected runtime
   scripts)"*. Os mockups anteriores do projeto já evitavam isso (`mockup-obras.html:2342-2362`,
   com `style[data-pagina]`/`script[data-pagina]`).
   **Correção:** marcar o `<style>` (l. 2) e o `<script>` (l. 306) com `data-pagina` e, na
   l. 308, montar a FONTE à mão: doctype, `<html lang="pt-BR">`, meta charset/viewport,
   `<title>`, `style[data-pagina]`, `</head><body>` e `document.querySelector('.pagina').outerHTML`
   (capturada nesse ponto, a `.pagina` ainda está intacta e já contém o bloco JSON e o próprio
   script), fechando com `</body></html>`. O `documento()` (l. 999-1006) continua igual.
   Teste real com **dois** ciclos: salvar, reabrir, salvar de novo, reabrir. Um ciclo só não
   mostra a injeção duplicada.

2. **O salvamento recarrega a página no meio da digitação e perde o texto (l. 972-975,
   993-996, 1008-1029).** O `publish(html)` recarrega também a própria visão ("After a
   successful publish this view reloads too"). O jeito natural de revisar é marcar "Ajustar"
   e já escrever o porquê. Só que 1,5 s depois do rádio a página publica e recarrega com o
   João ainda digitando. O que ele digitou depois do instantâneo some, e a l. 1020 ainda
   apaga o backup do `localStorage`.
   **Correção:** (a) em `publicar()`, se `document.activeElement` for um `.fb-in`, reagendar
   em vez de publicar (o `blur` já agenda); (b) na l. 1020, só remover o `localStorage` se
   `JSON.stringify(REV)` for igual ao que foi publicado (guardar o instantâneo antes do
   `await`); (c) guardar `scrollY` no `sessionStorage` antes do `publish` e restaurar no
   carregamento, como em `mockup-obras.html:2367-2376`. Sem isso, cada rádio marcado joga o
   João para o topo da página.

3. **Um rascunho restaurado some calado quando a seção já tem algo publicado (l. 965).** Só
   se restaura do `localStorage` quando a seção publicada está totalmente vazia. Depois de um
   `conflict`, ou de um sucesso com edição posterior, o comentário mais novo é descartado se
   aquela seção já tinha um voto salvo. O `sessionStorage` gravado na l. 1016 nunca é lido.
   **Correção:** restaurar quando o `local[s]` for **diferente** do publicado, com o status
   "rascunho deste navegador, ainda não salvo", e ler (ou remover) o `sessionStorage` da l. 1016.

4. **O título do "sem acesso" contradiz o "qualquer um" (l. 335).** "Esta tela é de quem é
   responsável pelas obras" sugere trava por papel, e está marcado como texto novo.
   **Correção:** "Sua conta não tem acesso ao Controle de Obras", mantendo o corpo.

5. **O texto do relatório promete uma integração que não existe (l. 784).** "Enquanto o Field
   não devolver o fechamento da OS" dá a entender que isso vai acontecer. A conciliação
   (contradição 4) registra que **não foi verificado** que a API exponha o fechamento.
   **Correção:** "O sistema não lê o fechamento no Field: esta etapa é concluída aqui, pelo
   botão, quando o relatório de entrega estiver pronto."

6. **O histórico não traz exemplo do que o diálogo promete (l. 825 × `HIST`, l. 528-542).** O
   "Concluir esta etapa" diz "Fica no histórico com o seu nome", mas a seção D não tem nenhuma
   linha de marco concluído ou de data corrigida, e o `salvar-data` (l. 857-861) não grava
   linha. Sem isso, não dá para julgar como aparece o registro dos marcos (decisão 6 × 3).
   **Correção:** incluir em `HIST` uma linha "Esteira · Etapa concluída: Em andamento → Relatório
   de entrega · data de fim da execução em campo = 18/08/2026" e outra de "data corrigida".

---

## LEVAR AO JOÃO COMO DECISÃO

1. **Crítica: a aprovação que chega zera a contagem. Contradiz a intenção da decisão 5.
   Sim, é problema do desenho, não do mockup.** A decisão 5 existe para que obra liberada sem OS
   não suma do alarme. O cliente diz que a aprovação sai *"três meses depois"*. Com "aprovação
   primeiro", essa aprovação tardia leva a obra de 104 para 0 dias no dia em que chega: a obra
   some do alarme exatamente no caso para o qual a regra foi mudada. O mesmo acontece com a
   liberação registrada tarde, porque a action grava **hoje** quando não há data
   (`_actions.ts:152`).
   **Recomendação: contar da data mais antiga entre aprovação e liberação; sem nenhuma das
   duas, da entrada.** Por quê:
   - para obra que só tem aprovação, dá exatamente a regra de hoje (preserva o que foi aprovado);
   - uma data nova nunca faz a contagem cair;
   - resolve também o caso de aprovação anterior a uma liberação registrada depois, que "da
     liberação quando existir" subestimaria.

   **Resíduo a dizer ao João:** obra sem nenhuma das duas, contando da entrada (exemplo 3,
   75 dias), ainda cai para 0 se a primeira autorização chegar com data de hoje. Fechar isso
   exige pôr a entrada no mínimo também, e isso muda a contagem de toda obra com aprovação.
   Não recomendo.
   **Consequência para o mockup:** reescrever a regra (l. 264-272, 338-342), o simulador
   (l. 920) e a nota (l. 279). O item do diálogo "vai de N dias para 0 dias desde a aprovação"
   (l. 819) deixa de ser verdade.
   Obs.: a mudança de âncora afeta também o `estourou()` (âmbar, `tipos.ts:445-449`), não só os
   100/60 dias que a seção E cita.
   Obs. 2: a entrada é a data da sincronização. Obra antiga que entrar no pente fino sem
   aprovação e sem liberação registradas só vira crítica 100 dias depois da sincronização,
   seja qual for a regra escolhida.

2. **"Concluir Pendente fechamento" grava OS aprovada com data de hoje. É coerente, mas a data
   deveria ser perguntada.** É coerente com a decisão 4: `marco_os_aprov` é o marco que encerra
   `aprovarOS`, é o mesmo controle da ficha, e a liberação não é tocada, então liberada ≠
   aprovada fica respeitado. O problema é a **data**. A aprovação acontece no sistema do cliente
   e costuma ser vista aqui dias depois. "Hoje" vira a data de `aprovacao`, que alimenta a âncora
   da crítica e a defasagem liberação × aprovação que o cliente diz cobrar. "Corrigir depois"
   (decisão 3) é um passo que ninguém faz.
   **Recomendação:** só neste passo, o diálogo de concluir traz o campo "OS aprovada em
   [data]", já preenchido com hoje e editável. Continua sendo o botão da decisão 3; muda só que
   a data fica visível antes de gravar.

3. **O "OS aprovada em" preenchido na ficha não mexe na etapa (lacuna nova).** Se alguém
   preenche a data no bloco Autorização (seção B) com a obra em Pendente fechamento, o
   `marco_os_aprov` ganha data. A esteira desenha o passo como **feito** (`_ficha.tsx:177-187`),
   mas a etapa continua `aprovarOS`: é justamente a contradição entre esteira e etapa que a
   decisão 3 quis eliminar. O mockup não mostra esse caso, e salvar o bloco Autorização não
   declara consequência nenhuma: nem a mudança da contagem, nem a saída de "Sem OS aprovada".
   **Recomendação:** ao salvar a aprovação com a obra em `aprovarOS`, avançar para Fechar OS com
   um diálogo que declare isso, reaproveitando o texto do concluir.

4. **Faturado: a ambiguidade é real, e o problema maior está um passo antes.** No código,
   `encerrada = etapa === 'faturado'` (`tipos.ts:361-363`). Pelo mockup (l. 821), concluir
   "Pendente faturamento", que é o **cliente liberar** o faturamento ou o pedido de compra, já
   põe a obra em Faturado: ela sai de todos os alertas **antes** de a Manfac faturar. O botão
   do passo Faturado (l. 814, 822) grava `marco_faturou` numa obra que já constava encerrada,
   então esse registro não muda nada na tela. Isso contradiz a Decisão G ("o financeiro vai no
   faturado") e o "a obra não vira dinheiro" da l. 773.
   **Recomendação:** Faturado passa a ser a vez do Financeiro, ainda em aberto e ainda em
   "Executadas, ainda na esteira". A obra só fica **encerrada** quando `marco_faturou` tiver
   data, e o botão desse passo é o que encerra. Isso muda `encerrada()`, então é decisão de
   produto. Depende também da resposta do feedback 09 sobre pedido de compra (seção F).

5. **(Menor) O "Salvar dados" da Triagem não salva a liberação (l. 430, 481-488).** O cliente
   diz que a liberação vem **por telefone, antes da obra**. Quem recebe o OK antes de ter
   equipe não tem como gravar o "Liberado por" sem liberar e perde o que digitou. É o mesmo
   argumento que justificou o "Salvar dados" na decisão 2.
   **Recomendação:** o "Salvar dados" grava tudo o que estiver preenchido (dados da obra,
   liberação e os obrigatórios já escolhidos), sem liberar.

---

## VERIFICADO OK

- **Decisão 1:** "Editar" por bloco, com Salvar e Cancelar próprios. A ordem Autorização →
  Identificação → Cronograma confere com `_ficha.tsx:479/537/581`.
- **Decisão 2:** 5 obrigatórios mais a liberação; bloco opcional "Dados da obra" (tipo, valor,
  origem, analista do cliente, aprovação) com "Salvar dados" separado de "Liberar".
- **Decisão 3:** "Concluir esta etapa" no passo atual, em dois passos; data corrigível; passo
  pulado aparece como "sem data registrada"; o seletor não carimba data.
- **Decisão 4:** um controle só, "OS aprovada em", na Triagem, na ficha e na correção da data
  do passo `aprovarOS` (l. 859).
- **Decisão 5:** implementada como foi escrita (l. 338-342), e o próprio mockup expõe o efeito
  colateral. A correção da regra está em "Levar ao João", item 1.
- **Decisão 6:** histórico por campo (antigo, novo, quem, quando), com filtro por bloco e
  motivo só na remarcação.
- **Decisão 7:** mudar o início pede motivo obrigatório (Salvar desabilitado sem ele); a duração
  muda livre; a remarcação aparece no bloco Remarcações e no histórico.
- **Decisão 8:** nomes atuais do código, com a pendência explicada na seção F.
- **Decisão 9:** número da OS, loja e descrição só leitura, com "vem do Field" e o porquê.
- **Textos da conciliação corrigidos:** entrada no lugar da aprovação (l. 416); só 3 campos do
  Field (l. 418-422); "qualquer pessoa" (l. 416); seletor → Histórico (l. 803).
- **Estados:** A–D têm os 5 alternáveis. Vazio (dados em branco, ou `estado-vazio` tracejado na
  seção D) e erro (caixa vermelha com "nada foi salvo") são visivelmente diferentes.
- **Diálogos:** Liberar e Concluir declaram a consequência inteira (etapa, dono, filas, âncora
  dos dias, sem cobertura, correção posterior). Nenhum é "tem certeza?".
- **Dados de exemplo:** inventados e plausíveis. As contas da seção E conferem com hoje =
  14/09 (109, 104 e 75 dias).
- **Feedback:** rádio Aprovado/Ajustar/Refazer e comentário `contenteditable` embaixo de cada
  seção A–F; estado em `<script type="application/json" id="revisao-estado">`; nada publica no
  carregamento (só em `change` do rádio ou `blur` com texto alterado); debounce de 1,5 s; `null`
  de `claude.use` tratado (l. 990); `conflict` e os códigos de só leitura tratados; `</`
  escapado (l. 1005).
  Opcional: escapar todo `<` como `\u003c`, para cobrir `<!--` digitado.
- **400 px:** `.grid2`/`.exemplos` viram 1 coluna em 860 px; `.fgrid`, `.hist li` e
  `.passo .quando` empilham em 560 px; não há tabela; `dd` com `overflow-wrap:anywhere`; o
  diálogo usa `calc(100% - 32px)`; gutter de 16 px. Nada estoura na leitura do CSS.
- **Menor, não bloqueia:** o estado "Erro ao salvar" da seção A mostra só o erro de "Salvar
  dados", não o conflito do Liberar ("já foi liberada por outra pessoa").
