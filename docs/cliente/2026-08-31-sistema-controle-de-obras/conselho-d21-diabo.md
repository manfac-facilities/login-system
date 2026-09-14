# Conselho: parecer do advogado do diabo

Lente: parti da hipótese de que o revisor exagerou e de que o coordenador repassou tudo sem
filtrar. Mantive um achado só quando o melhor argumento para dispensá-lo não resistiu ao
código em `6f5aa96` e ao contexto: 0 obras, 167 OS, botão manual, time pequeno.

Li o briefing, as três revisões, a J3 (as duas rodadas), o critério em `6f5aa96`, a spec da
D2.1 (`docs/onboarding-duda/02-FRENTES-DO-DUDA.md` §"Estado em 14/09"), a mensagem do Duda,
a pergunta 05 e os feedbacks 08 e 10. No código, li `_sincronizacao.ts`, `_actions.ts`,
`consulta-ordem.ts`, `cliente.ts`, `http.ts` e `tipos.ts`. Não rodei testes.

## Dois fatos que mudam a leitura do "ping-pong"

1. **As três rodadas couberam num único dia.** D2 às 11:50, ajustes às 13:00, D2.1 às 13:40,
   revisão às 13:54, J3 às 14:34. O custo em horas do Duda é moderado. O que desgasta é a
   **tendência**: 3 importantes + 9 menores, depois 1 + 4, depois 3 + 5. As rodadas não estão
   convergindo.
2. **Boa parte dos achados da 2ª e da 3ª rodada nasceu de decisões do próprio revisor ou do
   coordenador**, e não de erro do Duda:
   - O **disjuntor** foi a sugestão (c) do revisor no I1 da D2. Dele saíram N1, N2 e N4.
   - O **intervalo de 24h** foi a sugestão do M1. Dele saiu o N3.
   - A spec da D2.1, escrita pelo coordenador, mandava literalmente **"antiga arquivada ou
     inexistente → herda"** e **"inconclusiva → tenta na próxima execução"**. O Duda
     implementou isso à risca. O I3 (404) e o I2 (mensagem "tentada novamente") da revisão da
     D2.1 criticam, portanto, **a spec**, não a execução.
   - A causa foi a spec sair **antes** da verificação da API. Três chamadas só de leitura
     (a 2ª rodada da J3, feita às 14:34) teriam eliminado o I2 e o I3 e simplificado o I1
     antes de o Duda escrever uma linha. É a regra do CLAUDE.md global ("não dispare
     subagente antes de a decisão que molda o trabalho estar tomada") aplicada a um
     desenvolvedor humano.

---

## A. Classificação

Probabilidade estimada **na operação real**: manual hoje, D3 a cada 15 min depois, 167 OS e
0 obras. Uma observação vale para toda a tabela: **a herança não pode acontecer na 1ª
carga**, porque com 0 obras não existe conflito de número. Todo risco de herança começa da
2ª sincronização em diante.

| Item | Probabilidade real | Impacto / reversível? | Custo de corrigir | Categoria |
|---|---|---|---|---|
| **D2.1-I1** obra híbrida (antiga presente na varredura) | **Muito baixa depois do item 1.** O cenário exige renumerar a antiga, criar a nova com o número velho **e** o GET responder "arquivada" para uma OS que a listagem acabou de dar como ativa. Sem o 404, só uma corrida de segundos faz isso. Existe uma variante que o revisor não viu: antiga **arquivada e renumerada**, listagem que inclui arquivadas, nova com o número velho. Ela produz a híbrida mesmo com a API correta | Alto: junta históricos de lojas diferentes. Não aparece em lugar nenhum persistido. Desfazer exige SQL à mão | Nenhum código próprio se o filtro do item 4 entrar (ver B). Guarda explícita: ~3 linhas. Precisa de 1 teste de renumeração | **ANTES DA 1ª CARGA** (na prática, antes da 2ª sincronização). Cumprido pelo filtro + item 1; manter só o teste |
| **D2.1-I2** `archived` não provado; motivo descartado | A parte factual **caiu**: a J3 provou `archived` booleano no `GET /orders/:id`. A resposta "sem archived" virou teórica. "Inconclusiva" agora só sai de 5xx, 429, rede ou 404/422, e para esses casos "tentaremos na próxima" é verdade | Baixo: mensagem imprecisa, sem efeito em dado | Repassar `motivo` ao relatório: 1 linha | **BACKLOG** (a linha pode ir de brinde) |
| **D2.1-I3** 404 junta históricos sem prova | Baixa, mas o achado foi **valioso**. A J3 mostrou 422 onde se esperava 404, e o próprio cliente disse que no Field se arquiva (1B). O ramo 404 só dispararia por motivo errado: proxy, permissão ou OS realmente apagada, que o cliente diz não existir | Alto e silencioso, mesmo tipo de dano do I1 | Apagar 3 linhas e ajustar 1 teste | **ANTES DA 1ª CARGA** |
| **Pedido 1** herança só com `archived === true` | Igual ao I3 | Igual ao I3 | Trivial | **ANTES DA 1ª CARGA**. Correto e sem excesso |
| **Pedido 2** `archived` na `OsNormalizada`, com ramos "listada false → conflito" e "listada true → herda sem consultar" | Levar o campo é necessário. O ramo **"listada `archived:true` → herda sem consultar" é excesso e abre buraco** (ver B) | O ramo novo pode recriar a híbrida e depende da ordem da listagem | Simplificável para um filtro de 1 linha | **ANTES DA 1ª CARGA** só o filtro. O ramo "herda sem consultar" é **DESCARTAR** |
| **Pedido 3** motivo em duas categorias ("passageira" × "decisão manual") | A categoria "resposta sem archived" praticamente deixou de existir depois da J3 | Cosmético | Pequeno, mas cria classificação e testes para um caso morto | **DESCARTAR** a divisão. Repassar o texto do `motivo` basta (I2) |
| **Pedido 4** OS listada com `archived:true` não conta como presente | **Não dá para saber; trate como 50%.** Não se sabe se a listagem inclui arquivadas | **É o item mais importante da rodada, por um motivo que ninguém escreveu.** Sem filtro, uma OS arquivada que venha na listagem **vira obra na 1ª carga**. O sistema nunca apaga, então essa obra lixo só sai por SQL. O pente fino do cliente vai justamente "excluir" (arquivar) OS erradas antes da carga. O filtro também faz o alerta da D2 funcionar do mesmo jeito, com ou sem arquivadas na listagem | 1 linha de filtro + 1 teste | **ANTES DA 1ª CARGA** |
| **M1** sem teto de consultas por execução | Muito baixa: exige o cliente apagar e recriar o lote inteiro depois da 1ª carga | Lentidão (~3 min) e relatório poluído. Nada é gravado errado | Pequeno | **BACKLOG** (lembrar na D3) |
| **M2** consulta desperdiçada para OS repetida | Rara | 1 req/s à toa | Pequeno | **DESCARTAR** |
| **M3** disjuntor não pega página perdida em base de 500+ | Nula hoje (167). A 2ª varredura 20h depois já protege | Alertas falsos, que se limpam sozinhos | — | **DESCARTAR** (o próprio revisor escreveu "não é defeito hoje") |
| **M4** página extra com total múltiplo de 100 | Baixa, e o autor já justificou (ver C) | Falha segura e visível | — | **DESCARTAR**. Reabrir é repetir item encerrado |
| **M5** retrato do banco envelhece durante as consultas | Nula com botão manual. Na D3, é o problema geral de duas execuções simultâneas | Update sobre dado velho | Resolve com trava de execução única na D3 | **BACKLOG** (vira requisito da D3, não da D2.1) |

**Contagem:** 0 BLOQUEIA MERGE · 5 ANTES DA 1ª CARGA · 3 BACKLOG · 4 DESCARTAR.

Sobre "bloqueia merge": neste projeto o merge vira deploy no mesmo dia. O portão que
importa de verdade é **o primeiro clique em "Puxar do Field" com a chave em produção**, e
esse portão já está escrito no ESTADO ("Não apertar"). Nada da D2.1 corrompe dado enquanto
ninguém clica. Por isso nenhum item bloqueia o merge.

---

## B. O pedido atual cabe numa rodada?

**Sim, se for simplificado. Como está escrito, tem um excesso e um buraco.**

**O buraco está no item 2.** A regra "antigo veio listado com `archived:true` → herda sem
consultar" colide com o código que já existe:

- **Com a antiga arquivada e renumerada** (antiga@300 arquivada, nova@100), duas coisas
  acontecem na mesma varredura. A nova herda a obra A. A antiga ainda passa pelo caminho
  `peloId` (`_sincronizacao.ts`, bloco `if (peloId && numeroAnterior !== numero)`) e grava
  `os='300'` em A. O resultado é **a mesma obra híbrida que o I1 queria impedir**, agora
  sem nenhuma resposta errada da API. A frase "não é tratada como presente-e-ativa" do item
  4 não diz se a arquivada ainda percorre esse caminho, e ele continua aberto.
- **Com o mesmo número** (antiga@100 arquivada, nova@100), o resultado depende de quem vem
  primeiro na listagem (`sort=id`). Se a antiga vier antes, `numerosTratados` já contém o
  100 e a nova cai em "veio repetida na mesma varredura". **A herança nunca acontece**, e o
  motivo exibido é enganoso.

**A forma mais simples de cumprir a resposta 2B** substitui os itens 2 e 4 por uma regra:

> **Descartar da varredura, logo na entrada, toda OS com `archived === true`.** Para o
> sistema, OS arquivada é OS que não está no Field.

Com esse filtro, o fluxo que já existe faz o resto sem ramo novo:

- a antiga arquivada fica ausente;
- a nova com o mesmo número dá conflito, a consulta vai ao `GET /orders/:id`, e a herança só
  acontece com `archived === true` (item 1);
- se a antiga aparece na listagem filtrada, ela está ativa, e o GET responde "ativa" (a guarda
  explícita do I1 vira opcional e só economiza uma chamada);
- OS arquivada nunca vira obra na 1ª carga;
- OS arquivada que já é obra passa por suspeita e depois alerta, que é a regra 2 do
  feedback 10;
- OS restaurada no Field reaparece e limpa o alerta.

O comportamento fica **idêntico com ou sem arquivadas na listagem**, e isso elimina a maior
incógnita que sobrou da J3 sem precisar prová-la.

**O pedido mínimo para o Duda, uma rodada:**

1. Levar `archived` do item da listagem até a entrada do plano e filtrar `archived === true`.
2. Herança só com `GET` devolvendo `archived === true`. 404 e qualquer outra resposta não
   herdam.
3. Repassar o `motivo` da consulta ao texto de "ignoradas", sem criar categorias.
4. Três testes:
   - arquivada listada não vira obra nem conta como presente;
   - antiga arquivada e renumerada na mesma varredura → uma herança só, sem update duplo;
   - antiga ativa na listagem → sem herança.

Isso é cerca de 1h de trabalho e não abre caminho novo. Pedir mais do que isso (ramo "herda
sem consultar", duas categorias de motivo, herança só em varredura completa, persistir o
`field_id` antigo) é custo sem dano provável que o justifique hoje.

**Desvio que precisa ser decidido pelo João, não pelo Duda:** o filtro faz com que o Field
arquivar OS concluídas **como rotina** gere alerta para toda obra encerrada. Isso é
política de exibição (pergunta aberta 1 do capítulo), não defeito, e o N1 já impede que
esses alertas desliguem a detecção.

**Fora do escopo, e não verifiquei:** a listagem filtra só por `service_id`, sem estado da
OS. O feedback 08 fala em corte "por estado da OS (em aberto)". Se OS concluídas ainda vêm
na listagem, elas também viram obra na 1ª carga. Vale confirmar antes da carga que essa
decisão existe em algum lugar.

---

## C. O N5 do Duda

**A decisão dele está certa**, e o revisor não deveria ter reaberto o assunto (M4 da D2.1).

- A alternativa seria parar quando `ordens.length === totalCount`. Isso devolve ao
  `totalCount` o poder de encerrar a leitura, e foi exatamente esse o defeito I1 da D2: uma
  contagem velha vira prova falsa de ausência.
- O custo de manter é 1 requisição a mais só quando o total for múltiplo exato de 100.
- O pior caso (API responder 4xx em `offset = total`) é falha segura e visível: nada é
  gravado.
- Na D3, a leitura incremental quase sempre traz menos de 100 itens.

Se um dia a sincronização falhar com um total redondo, o lugar a olhar está anotado. Até
lá, o assunto está encerrado.

O ponto de processo é este: **o autor deu um argumento técnico correto para não mudar, e a
revisão seguinte repetiu o achado.** Isso ensina ao desenvolvedor que justificar não
adianta.

---

## D. Calibração

### O que foi valioso de verdade

| Achado | Por quê |
|---|---|
| **D2-I1 (a+b)**: parar só em página curta; `items` ausente é erro | Um `totalCount` velho ou um `{}` com status 200 teriam acendido alerta em massa, em tudo. A correção era barata e ficou certa |
| **D2-I2**: conflito de identidade sem saída | Não era bug: era **uma pergunta de negócio que ninguém tinha feito**. Gerou a pergunta 05 e a resposta 2B, que contrariou a recomendação. É o tipo de achado que mais vale |
| **Adendo-N1**: alertas acumulados desligam a detecção | Defeito real e de alta probabilidade: sem fluxo de descarte, os alertas só acumulam. Mas ele nasceu de uma sugestão do próprio revisor |
| **D2.1-I3**: 404 junta históricos | É o único caminho de dano silencioso e difícil de desfazer. A J3 confirmou a suspeita |
| **D2.1**, a pergunta que levou à 2ª rodada da J3 | Transformou três suposições em fatos em 40 minutos. Deveria ter vindo **antes** da spec |

### O que foi rigor excessivo

| Achado | Por que era excesso |
|---|---|
| **D2-I1 (c)**: o disjuntor | Com (a), (b) e a exigência de duas varreduras, ele era cinto sobre suspensório, e custou três achados na rodada seguinte |
| **D2-I3**: `=== null` com coluna `undefined` | Com 0 obras e a regra "migration antes do deploy" já no AGENTS.md, era no máximo **menor**. Barato, mas não "importante" |
| **Adendo N2, N4 e N5(b)** | N2 trata base pequena, mas a 1ª carga entra com 167. N4 é um aviso cosmético. N5(b) supõe uma API que ignora `offset`, cenário especulativo |
| **D2.1 M2, M3, M4, M5** e boa parte das "lacunas de teste" | Cenários de base de 500+, de concorrência que só existirá na D3, ou repetição de item já encerrado |
| **D2-M4 a M9** | O próprio revisor não pediu. Poderiam ter ido direto para um arquivo de backlog, em vez de ocupar o relatório |

**Onde o coordenador falhou**, que é o outro lado da pergunta do João:

- Repassou o pedido sem cortar o M4 reaberto.
- Escreveu a spec da D2.1 com "inexistente herda" antes da J3.
- No pedido atual, adicionou um ramo ("herda sem consultar") que complica em vez de
  simplificar.

O revisor aponta e o coordenador filtra. Quando o filtro não corta nada, o desenvolvedor
recebe o relatório inteiro como obrigação.

### Régua de severidade proposta

1. **BLOQUEIA:** apaga, mistura ou corrompe dado de forma que só SQL desfaz, **e** tem
   caminho plausível na operação real nos próximos 30 dias. As duas condições são
   obrigatórias.
2. **ANTES DO 1º USO COM DADO:** o mesmo dano, só que atrás de um portão manual que ainda
   não foi aberto (chave, botão, migration). Vai para um checklist do portão e não segura o
   merge.
3. **NÃO BLOQUEIA:** dano visível e que se desfaz sozinho (alerta falso que a próxima
   varredura limpa, mensagem imprecisa, requisição a mais, lentidão), cenário que depende de
   escala ou concorrência que ainda não existe, e estilo. Vai para `BACKLOG.md` com uma
   linha, **fora** do pedido ao desenvolvedor.
4. **O revisor se cala quando:**
   - o achado exige três ou mais condições improváveis ao mesmo tempo;
   - o autor já deu um argumento técnico correto para não mudar;
   - o achado critica algo que a spec mandou fazer (esse vai para o coordenador, não para o
     desenvolvedor);
   - o achado depende de um fato externo que três chamadas de leitura resolvem. Nesse caso,
     o revisor pede a verificação e não o código.
5. **O revisor não sugere mecanismo novo** (disjuntor, tolerância, teto) num achado que não
   bloqueia. Descreve o risco e deixa o desenho com o autor. Sugestão de mecanismo gera a
   próxima rodada.

### Processo contra o ping-pong

- **Fato antes de spec.** Toda incógnita de API ou de cliente que muda o desenho é
  verificada antes de a frente ir para o Duda. Custa minutos; esquecer custou uma rodada
  inteira.
- **Uma revisão completa e uma re-revisão fechada.** A 2ª passada confere **só** a lista
  que saiu da 1ª. Achado novo na 2ª passada só entra se for BLOQUEIA; o resto vai para o
  backlog. Não existe 3ª rodada sobre a mesma frente.
- **O pedido ao desenvolvedor tem teto.** No máximo cinco itens, só das categorias 1 e 2,
  cada um com o teste que prova. O coordenador corta antes de enviar e registra o corte, com
  o motivo, junto do relatório.
- **Timebox.** Se a correção de uma revisão passar de metade do tempo estimado da frente
  (D2.1 estava em 1–3h), o coordenador para e reavalia o escopo com o João, em vez de pedir
  mais uma rodada.
- **Separar os destinatários.** "Isto é da spec" vai para o coordenador. "Isto é pergunta
  de negócio" vai para o João. Só "isto é do código" vai para o Duda.
