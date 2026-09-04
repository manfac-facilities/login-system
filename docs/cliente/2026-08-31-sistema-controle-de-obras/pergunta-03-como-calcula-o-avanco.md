# Pergunta 03 — "como calcula esse avanço %?"

**Quem perguntou:** o cliente, no `.docx` de feedback do mockup v01, item 03.
**Situação:** **sem resposta até 03/09/2026.** Encontrada ao versionar o `.docx`, que
estava solto na raiz do repositório. Ele circulou a barra de avanço num print e
perguntou. Nunca respondemos — e o mockup continua mostrando "Avanço 20%".

Isso precisa voltar para ele. É pergunta dele para nós, não instrução.

## O que a planilha realmente faz hoje

A coluna se chama **Avanço físico** e é **digitada à mão**. Não há fórmula, não há
cálculo, não há nada derivado de data, marco ou medição. Alguém olha a obra e escreve
um número.

E aí está o problema que provavelmente motivou a pergunta: **a escala está misturada.**

| Linha | Obra | Valor na célula | Lido como |
|---|---|---|---|
| L8 | DP BARRA DE SAO JOAO | `0.9` | 90% |
| L12 | DP NILOPOLIS 5 | `0.5` | 50% |
| L10 | DP PRACA DO O | `0.2` | 20% |
| L18 | DP PETROPOLIS 6 | `1` | 100% |
| **L17** | **DP PETROPOLIS 5** | **`95`** | **9500%** |

A coluna é percentual guardado como fração — `0.9` é noventa por cento. Só que em pelo
menos uma linha alguém digitou `95` querendo dizer 95%. Numa planilha isso passa
despercebido; num sistema com barra de progresso, vira uma barra estourada.

**Conclusão honesta para dar ao cliente:** hoje esse número não é calculado por
ninguém. É um palpite de quem está tocando a obra, escrito num campo sem regra — e a
prova de que não tem regra é que a própria planilha tem duas escalas convivendo.

## As três saídas, e a que eu recomendo

**A) Declarado por quem está na obra, com escala única e evidência.** ✅ recomendada
O responsável (ou a equipe, respondendo ao agente) diz o avanço no diário do dia, em
passos de 10%. O sistema impede 95 quando a escala é 0–100. E — isto é o que muda o
jogo — **a foto daquele dia fica colada ao número**. O avanço deixa de ser palpite
solto e passa a ser palpite com prova ao lado, revisável por quem olhar depois.

Por que esta: é o que a operação já faz, só que com trilho. Não inventa processo novo,
não exige dado que ninguém tem, e ganha credibilidade justamente pela peça que já foi
decidida (a foto diária, decisão L).

**B) Calculado por tempo decorrido** — dias corridos ÷ duração planejada.
Automático e sem trabalho nenhum, e **mente descaradamente**: obra parada há duas
semanas por falta de material continuaria "avançando" na tela. Justamente o contrário
do que este sistema existe para mostrar. Não recomendo.

**C) Calculado por etapas concluídas** — a obra tem um plano de etapas e cada uma
fechada empurra a barra. É o mais correto conceitualmente e o mais caro: exige que
alguém monte um plano de etapas por obra, e hoje isso não existe em lugar nenhum.
Fica como evolução futura, não como v1.

## O que perguntar ao cliente

> "Hoje o avanço é digitado à mão, sem regra — tanto que a planilha tem `0.9` numa
> linha e `95` em outra querendo dizer a mesma coisa. Nossa proposta é o responsável
> declarar o avanço no diário, em passos de 10%, com a foto do dia registrada junto
> como evidência. Serve? Ou você prefere que o avanço saia de etapas concluídas — o
> que é mais preciso, mas exige montar um plano de etapas para cada obra?"
