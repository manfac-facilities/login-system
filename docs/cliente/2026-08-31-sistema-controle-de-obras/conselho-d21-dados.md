# Conselho — lente de integridade de dados

Só leitura: `git show 6f5aa96:...`, relatórios e J3. Testes não executados. Linhas referem-se a `6f5aa96`.

## A régua que usei

- **Tipo 1:** mistura, perde ou corrompe dado sem aviso e de forma difícil de desfazer. Exemplos: juntar históricos de lojas diferentes, sobrescrever uma identidade sem rastro, alerta em massa falso. **Só o tipo 1 segura merge.**
- **Tipo 2:** mensagem imprecisa, requisição a mais, atraso, conflito que aparece em "ignoradas". É reversível e se corrige quando aparece.

## Três fatos do código que mudam a leitura dos achados

1. **Diário, tarefas e remarcações apontam para o uuid da obra, não para `field_id` nem para `os`** (`sdd-sql-obras-v0.sql`: `obra_id uuid references obras_obra(id)`).
   - "Herdar" é só trocar o `field_id` da linha (`_sincronizacao.ts:291`). Nenhum registro de diário muda de lugar.
   - O dano da herança errada é **atribuir a obra à OS errada**, não embaralhar registros.
   - Esse dano fica difícil de desfazer por dois motivos:
     - o `field_id` anterior é sobrescrito e só aparece no relatório da action, que não é persistido;
     - lançamentos feitos depois da herança ficam indistinguíveis dos anteriores.
   - A herança também não troca `loja` (regra "só preenche vazio"). Se a OS nova for de outra loja, a obra fica com a loja antiga, sem aviso.
2. **`archived` vem booleano no `GET /orders/:id`** (J3, segunda rodada).
   - O ramo "resposta sem archived" (`consulta-ordem.ts:31-34`) passou a ser praticamente inalcançável.
   - O que sobra de inconclusivo é falha passageira (rede, 5xx, 429 esgotado).
3. **O 422 do id inventado não vira herança.** `ErroDeParametroInvalido extends ErroDaApiField` com status 422, e só o `404` herda (`consulta-ordem.ts:36`). O caminho que ainda junta sem prova positiva é **só o 404**.

## Os cenários de tipo 1 são alcançáveis?

**(a) Fusão entre lojas diferentes ("obra híbrida" do I1).**

- O cenário: OS antiga renumerada e **ainda ativa**, OS nova com o número antigo, as duas na mesma varredura.
- Com o código atual, só dá herança se o `GET` da antiga responder 404 ou `archived:true` para uma OS que acabou de vir ativa na listagem. Ou seja, a API precisa se contradizer, ou o 404 precisa ser espúrio.
- Com o item 1 do pedido (404 não herda), resta só a contradição da API. **Na prática, fica inalcançável.**

**(b) Oscilação na mesma obra.** Alcançável, mas é tipo 2. Precisa de duas condições que ninguém provou:

- a listagem inclui OS arquivadas;
- o usuário renomeia a antiga (ex.: `100` → `100-X`) antes de arquivar, para liberar o número.

Passo a passo:

1. **1ª execução.**
   - `ord-antiga/100-X` casa pelo `field_id` e gera o update `os='100-X'` (`:294`).
   - `ord-nova/100` casa pelo número no retrato antigo, o `GET` responde `archived:true` e sai a herança `field_id='ord-nova'`.
   - São duas entradas em `atualizar` para a mesma linha (`:319`), e as duas passam. A obra fica com `field_id=ord-nova` e `os=100-X`.
2. **2ª execução.** `ord-antiga/100-X` perde o `peloId`, casa pelo número, o `GET` responde `arquivada` e a herança volta para `ord-antiga`. Em paralelo, `ord-nova` renumera a obra para `100`.
3. **Dali em diante**, a obra alterna a cada execução.

Por que é tipo 2 e não tipo 1:

- É sempre a mesma obra e a mesma loja: é o caso de reabertura do 2B.
- Nada é apagado.
- Tudo aparece no relatório.

Por que ainda importa: com a D3 rodando a cada 15 minutos, ninguém lê o relatório, e o `field_id` passa o dia oscilando.

**(c) Herança com número reaproveitado para outra loja**, com a antiga legitimamente arquivada. É o tipo 1 que **sobra depois do pedido atual**.

- O item 1 exige `archived === true`, mas não compara a loja. OS concluída e arquivada é o ciclo normal.
- Se alguém digitar à mão um número já usado para outra loja, a obra herda.
- Probabilidade baixa, e não verificada: não sei se o Field gera `identifier` sequencial ou se permite reusar o número de uma arquivada.
- **Nenhum dos três relatórios nem o pedido atual cobre isso.**

**(d) Item 4 aplicado às cegas pode gerar alerta em massa.** Se a listagem inclui arquivadas e o código passar a tratar `archived:true` como "não presente":

1. Na primeira carga, as arquivadas viram obras, porque o pedido não diz se inserem ou não.
2. Na execução seguinte, todas contam como ausentes.
3. O disjuntor dispara. Como elas continuam ausentes, **dispara para sempre**, e a detecção fica desligada com um aviso permanente.

Sem o disjuntor, seria o alerta em massa que faz a equipe desconfiar do sistema. **É o item do pedido com mais chance de abrir buraco novo.**

## A — Classificação

| Item | Categoria | Probabilidade real (167 OS, botão manual) | Impacto / reversível? | Custo |
|---|---|---|---|---|
| **I3 D2.1** — 404 herda sem prova | **BLOQUEIA MERGE** | Baixa: exige OS apagada de verdade, que o cliente disse não existir (1B), ou 404 de proxy | **Tipo 1.** Atribui histórico sem evidência, e o `field_id` anterior se perde | 1 linha + ajustar o teste |
| **P1** — herança só com `archived===true` | **BLOQUEIA MERGE** | Mesma correção de I3 | Fecha o único caminho de junção sem prova | 1 linha |
| **I1 D2.1** — herança com a antiga na mesma varredura | **ANTES DA 1ª CARGA REAL**, na forma simples | Lojas diferentes: inalcançável com P1. Oscilação: exige listagem com arquivadas + renomear antes de arquivar, fato não provado | Tipo 2: oscila, visível, sem perda | Guarda de ~5 linhas + 1 teste (ver B) |
| **P2** — `archived` na `OsNormalizada`, três ramos | **ANTES DA 1ª CARGA REAL**, simplificado | Como I1 | Os ramos extras só otimizam um GET ou criam um segundo caminho de herança que dispensa o GET | Pedido: médio. Forma simples: baixo |
| **P4** — listada com `archived:true` não é presente | **ANTES DA 1ª CARGA REAL**, como **verificação, não código** | Depende de a listagem incluir arquivadas: desconhecido e decisivo | Feito às cegas pode gerar (d). Sem ele, arquivada listada não recebe alerta (tipo 2) | Verificar: minutos. Codar certo depende da decisão de inserir arquivada |
| **I2 D2.1** — motivo descartado, "tentada novamente" | **BACKLOG** | O ramo "sem archived" ficou inalcançável pela J3; o que sobra é falha passageira, e "tentaremos na próxima" é verdade | Tipo 2: mensagem | Trocar o texto de `:261` para algo neutro basta |
| **P3** — motivo até o relatório, com duas mensagens | **BACKLOG** | Idem | Idem | Baixo, mas não compra segurança |
| **M1** — sem teto de consultas | **BACKLOG** | Exige apagar e recriar em lote. Com P1, a arquivada herda na 1ª execução e não repete | Tipo 2: lentidão | Baixo |
| **M2** — consulta desperdiçada | **DESCARTAR** | Rara | 1 req/s à toa | — |
| **M3** — disjuntor em base grande | **BACKLOG** | Só a partir de ~500 obras | Protegido pela 2ª varredura 20h depois | — |
| **M4** — página extra (múltiplo de 100) | **DESCARTAR** como código | ~1% das execuções | Se a API der 4xx, a falha é segura e visível | Pôr `offset=total` na mesma chamada de verificação de P4 |
| **M5** — retrato do banco envelhece | **BACKLOG**, obrigatório **antes da D3** | Com o botão manual, ~0. Com cron + botão, real | Tipo 2 hoje | Trava de execução única na D3 |

**Propostas minhas, fora da contagem:**

- **Guarda de loja na herança (cenário c).** Só herdar se a `loja` normalizada da OS nova for igual à da obra; se forem diferentes, conflito visível. Classifico como **ANTES DA 1ª CARGA REAL**. É a única proteção direta contra o tipo 1 que sobra, e custa ~3 linhas + 1 teste.
- **Persistir a herança.** Guardar `field_id` anterior e data, em coluna ou no log de auditoria. Classifico como **antes da D3**: é o que torna reversível uma herança errada quando ninguém mais lê o relatório.

## B — O pedido atual é factível numa rodada?

**Factível, sim:** é código de decisão pura com teste unitário, na casa de 60–100 linhas. **Mas está superdimensionado**, e o item 4 abre buraco. O pedido codifica os dois mundos (a listagem inclui ou não as arquivadas) antes de alguém saber em qual deles estamos.

**Forma mais simples de cumprir o 2B sem risco de tipo 1:**

1. **P1 como está:** 404 não herda. **Isto e só isto bloqueia o merge.**
2. **Guarda estrutural no lugar de P2:** se o `field_id` antigo aparece em `doField` nesta varredura, com qualquer `archived`, não herda. Vira conflito visível "a OS antiga ainda aparece no Field".
   - Mata a oscilação (b) e o update duplo na mesma linha.
   - Não precisa levar `archived` para a `OsNormalizada`.
   - Um teste cobre: renumeração + OS nova na mesma varredura → nenhuma herança e uma entrada só por obra.
3. **Guarda de loja** (proposta acima), no lugar dos ramos extras de P2. Protege contra o tipo 1 real, coisa que os ramos de P2 não fazem.
4. **P3 vira troca de texto** em `:261` ("não foi possível confirmar agora; se persistir, precisa de decisão manual").
5. **P4 sai da rodada.** Antes: uma chamada só de leitura, no molde da J3, que conta `archived:true` entre as 167 da listagem e testa `offset=total`.
   - **Se aparecer alguma arquivada**, a listagem inclui arquivadas. Aí o João decide se arquivada vira obra na 1ª carga, e só então se coda P2/P4.
   - **Se não aparecer nenhuma**, fica inconclusivo. A guarda do passo 2 continua correta nos dois mundos: no pior caso, o 2B vira conflito visível em vez de herança, e esse é o lado seguro.

**Resultado:** merge com o passo 1 (ou 1 + 2, se o Duda já estiver com a mão na massa), e os passos 3–5 antes da primeira carga.

**Onde discordo:**

- **Do coordenador:** o item 4 não deve ir para a rodada atual, e o item 2 troca uma guarda simples e agnóstica por três ramos que dependem de um fato não provado.
- **Do revisor:** I1 foi apresentado como "fusão de duas OS ativas numa obra híbrida". Com a API respondendo o que provadamente responde (`archived:false` para ativa), isso não acontece. O risco real é oscilação, tipo 2.

## C — N5 do Duda

**A decisão do Duda está certa.**

- Evitar a página extra exige parar pelo `totalCount`. Isso reabre o I1 da D2, a leitura parcial valendo como varredura completa, que é tipo 1: gera suspeitas falsas em lote.
- O custo de manter é uma requisição a mais em ~1% das execuções, a 1 req/s.
- Se a API responder 4xx em `offset=total`, a execução falha sem gravar nada, e o erro fica visível.
- Basta incluir `offset=total` na próxima chamada de verificação. Não precisa de código agora.

## D — Calibração

**Valiosos de verdade (evitaram dano provável):**

- **D2 I1:** página sem `items` ou `totalCount` velho viraria suspeita em massa. É o achado mais importante das três rodadas.
- **Adendo N1:** alertas acumulados desligariam a detecção para sempre, em silêncio.
- **D2 M1:** confirmar a ausência no clique seguinte geraria alerta falso.
- **D2 I3:** coluna `undefined` acenderia alerta em toda a base. Pouco dano com 0 obras, mas custou uma linha e evitou o erro de ordem de deploy que já mordeu em 09/08.
- **D2.1 I3:** o 404 herdando é o único caminho de junção sem prova, e a correção é de 1 linha.
- **D2 I2:** gerou a pergunta ao cliente. Valeu como pergunta de negócio, não como correção.

**Úteis, mas não deviam segurar nada:** N2, N3, N4, D2 M3.

**Rigor excessivo:**

- **D2.1 I1** do jeito que foi escrito: tipo 2 apresentado como fusão.
- **D2.1 I2** depois da J3: o ramo ficou inalcançável.
- **N5 / M4:** repetido em duas rodadas.
- **D2.1 M1, M2, M5** e **D2 M4–M9**: corretos, mas são backlog e não deviam voltar ao Duda como pedido.

**O mecanismo do ping-pong:**

- O revisor marcou "0 bloqueadores" nas três rodadas, mas os "importantes" foram tratados como condição de merge.
- Cada re-revisão abriu achados novos em vez de só conferir os pedidos.

### Régua de severidade proposta

1. **Bloqueia merge:** cenário de tipo 1 alcançável no código atual, escrito passo a passo, que não exija a API se contradizer nem duas falhas independentes. Casos: juntar histórico, sobrescrever identidade sem rastro, alerta ou suspeita em massa.
2. **Antes da 1ª carga / da D3:** o que depende de um fato não provado da API. A ação é **verificar com uma chamada de leitura**, não codar os dois mundos.
3. **Backlog, direto num arquivo e sem voltar ao autor:** mensagem imprecisa, requisição a mais, lentidão, conflito que aparece em "ignoradas", problema que só existe com 10x a escala atual.
4. **Todo achado traz** a probabilidade na escala real (167 OS, botão manual) e se é reversível. Sem isso, não entra no pedido.
5. **A re-revisão só confere os bloqueadores pedidos.** Achado novo menor vai para o backlog, não para outra rodada.
6. **O revisor se cala** quando já existe falha segura cobrindo o caso: disjuntor, erro que aborta antes de gravar, conflito visível.
