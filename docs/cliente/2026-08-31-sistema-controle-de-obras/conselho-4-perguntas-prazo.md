# Conselho — as 4 perguntas pela lente do caminho crítico até 21/09

**Membro:** prazo / caminho crítico. **Escrito em 15/09/2026, noite.** Só leitura; fontes citadas.

## O caminho crítico, de trás para a frente

21/09 é **segunda-feira** (14/09 era segunda, `cronograma-2026-09-14.html:159`). "Pronto até 21/09" = J4 no ar
e uma obra real preenchida na segunda de manhã. Contas de trás para a frente, com as horas do próprio cronograma:

| Quando | O que precisa acontecer | Fonte |
|---|---|---|
| 21/09 seg, manhã | João completa uma obra real na ficha nova | cronograma, linha 21/09 |
| 18/09 sex (ou fim de semana) | **deploy da J4** — o cronograma o punha em 21/09; tem de vir 1–3 dias para a esquerda | cronograma, linha 21/09 |
| 18/09 sex | revisão independente + ajustes + merge (ajustes estavam em 21/09) | cronograma, 18 e 21/09 |
| 17–18/09 | código da J4, 5–8 h | cronograma, 18/09 |
| 17/09 qui, manhã | plano, 1 h | cronograma, 17/09 |
| 16/09 qua, noite | spec, 1 h — só depois do mockup aprovado | cronograma, 16/09 |
| 16/09 qua, dia | cliente responde a v02 pelo WhatsApp (respondeu a v01 na mesma noite) | feedback 14 |
| **16/09 qua, manhã** | **v02 publicada** — última hora em que qualquer resposta que molde o mockup ainda cabe | esta conta |

**Folga: zero.** O cronograma de 14/09 já fechava a J4 em 21/09 com deploy e ajustes nesse mesmo dia; o resto do
sistema ia até 28/09. Cada rodada extra de mockup custa meio dia (cronograma, "O que pode empurrar") — e meio dia
aqui já cai no fim de semana. Duas coisas fora das 4 perguntas pesam mais que elas no prazo: (1) a primeira carga
espera o cliente conferir o Excel das 175 OS (feedback 16, item 7C) — sem ela não há "obra real" em 21/09; (2) os
7 marcos ("Concluir esta etapa", seção C) são frente separada, 21–22/09, deploy 22/09 — não cabem no corte.

## As 4 perguntas

| # | Pergunta | Relevante? | Bloqueia o quê | Última data que cabe | Sem resposta até lá | Segue com suposição? | Quem responde | Custo se errar |
|---|---|---|---|---|---|---|---|---|
| 1 | O que o funcionário faz | **Sim — mas já está respondida.** Transcrição de 31/08 (`transcricao-reuniao-2026-08-31.md:139, 419, 495, 525`): ele atualiza a planilha com as obras aprovadas, monta o cronograma com a operação, atualiza status e pendências com outras áreas, senta com o responsável (Yuri) ou liga para atualizar. João em 525: "não vai ser mais o rapazinho que vai preencher essa planilha" | O **corte** de 21/09: o que entra primeiro. Não bloqueia a v02 | 16/09 (antes de o código começar 17/09) | O prazo **não anda**; o risco é construir a coisa certa na ordem errada. Como a resposta já existe, o risco é nulo | Sim: a suposição é a transcrição. Só falta confirmar se ele também monta os números da reunião semanal (feedback 14, F) | Ninguém agora. Uma linha ao cliente sobre a reunião semanal, sem esperar resposta | Baixo: se ele também faz a reunião semanal, o SLA 1 sobe de prioridade; nada do que se constrói fica errado |
| 2 | Motivos iniciais de remarcação | **Sim, mas não agora** | Um dropdown na seção B. Não bloqueia spec nem código: é dado, não regra | Nenhuma para o João. Para o cliente: a revisão da v02 (16/09) | Zero dia. A lista sugerida entra na v02 como suposição declarada; o cliente corrige ali ou depois, no uso | Sim. Lista fixa em código + "Outro" com texto livre. **"Cadastrar novo motivo" (tela + tabela) sai do corte** — é migration e CRUD que não cabem em 17–18/09 | Cliente, pela v02. Não é pergunta para o João | Quase zero: `obras_remarcacao.motivo` já é texto livre (`tipos.ts:321`); trocar a lista é editar uma constante |
| 3 | SLA 2 conta até quando | **Sim, mas não agora** | A regra do SLA 2 (F). **Nada da J4 de 21/09**: o SLA 2 nasce de `marco_fechou_os` (`tipos.ts:255`), que só passa a existir com os marcos (deploy 22/09). Em 21/09 ele mostraria "sem data" em 100% das obras, respondido ou não | 22/09 (deploy dos marcos). Para o mockup: 16/09 manhã, como suposição declarada | Zero dia em 21/09. Depois: o SLA 2 vira a rodada seguinte, com os marcos | Sim. Suposição coerente com o fluxo (feedback 02 item 04; pergunta 07, 4A): conta do fechamento da OS no sistema do cliente até o **pedido de compra chegar** — é o "dinheiro parado que depende do cliente". Obs.: a sugestão dada ("até Fechar OS") contradiz o início que o cliente descreveu (dias *desde* o fechamento) | Cliente, pela v02 — é o indicador da reunião semanal dele | Baixo: é derivado, nunca gravado (convenção `tipos.ts:14-18`); mudar o fim é trocar uma função, sem migration |
| 4 | Metas 20/30 dos SLAs | **Não** (para o João) | Duas constantes. A regra da obra crítica já usa >20/>30 por fala do cliente (feedback 14, E) e a spec dela já roda | Nenhuma | Zero dia | Sim: 20/30, iguais aos da crítica, **fixos em código**. "Editável no sistema" é tela de configuração + tabela — sai do corte | Cliente, na v02, se quiser números diferentes | Trivial: dois números numa constante |

**Seções B e F no "pronto de 21/09":** **B entra, F sai.** B (ficha com blocos editáveis, remarcação com motivo) é
o núcleo do que o funcionário fazia — é a J4. F como o cliente redefiniu (dois SLAs) é **escopo novo de 14/09 à
noite**: a seção F da v01 era "Pendente do cliente" (nomes), não SLA (`mockup-j4-v01.html:281-297`). SLA 2 depende
dos marcos (22/09). SLA 1 é o único que quase vem de graça — `diasSemOS()` já existe (`tipos.ts:498-504`) e conta da
liberação sem OS aprovada; falta só pintar 20/30 na ficha. Entra em 21/09 **só** se couber em menos de 1 h dentro da
J4; senão, os dois SLAs vão para a rodada dos marcos (22–23/09), e o mockup v02 diz isso em seção própria.

## Pergunta que falta (mais importante que as 4)

**Quantas obras, e quais, o cliente precisa ver preenchidas em 21/09 — e quem preenche entre a carga e segunda?**
A carga traz 175 OS com 3 campos cada (`ESTADO.md`, 11/09). O cronograma prevê **uma** obra preenchida em 21/09,
pelo João. Se "o sistema substitui o funcionário" significa a planilha inteira migrada, isso é trabalho de
preenchimento humano (AMANDA, YURI — sem conta no hub ainda), não de código, e precisa começar antes do deploy.
Resposta muda o corte e o fim de semana; nenhuma das 4 muda.

## Recomendação (3 linhas)

1. **Ao João, hoje:** nada das 4. Só decidir o corte: J4 (A+B+C sem botão de marcos+D+E) deploy até 18/09; SLAs, cadastro de motivo e metas editáveis ficam para 22–23/09.
2. **Ao cliente, hoje, junto com o Excel:** "quais obras precisam estar preenchidas em 21/09 e quem preenche?" e, em uma linha, se o funcionário também monta os números da reunião semanal.
3. **Assumir e declarar na v02 (publicar até 16/09 de manhã):** lista de 6 motivos + "Outro"; SLA 1 = dias desde a liberação sem OS aprovada; SLA 2 = do fechamento da OS até o pedido de compra; 20/30 fixos.
