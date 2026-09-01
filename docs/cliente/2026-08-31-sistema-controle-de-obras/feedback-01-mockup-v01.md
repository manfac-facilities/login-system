# Feedback do cliente — mockup v01

Artifact: https://claude.ai/code/artifact/258d0a1e-a44a-4d6f-9463-6990f85923be
Recebido pelo João em 01/09/2026. Cliente: José Guilherme.

## Retorno literal

> o cliente amou a v01 do mock up, até agora pontuou: ao inves de colocar como
> "PCM responsavel", coloca só como responsavel da obra, Faltam algumas
> definições na base de obras Tipo, a obra vai vir do field sem responsavel
> definido, ai vai precisar definir alguem

**"até agora" — o retorno não está fechado.** Podem vir mais pontos.

## Ponto 1 — rótulo

"PCM responsável" passa a ser **"Responsável da obra"** em toda a interface.
Trocar em todos os lugares: cabeçalho da tela, coluna da tabela, filtro, card do
Kanban, ficha da obra.

## Ponto 2 — a obra chega do Field sem responsável

Não é só um campo vazio: é um **estado do processo** que o mockup não previa. A
obra entra na base pelo Field, crua, e alguém precisa completá-la antes de ela
poder entrar no diário do dia.

Isso confere com a planilha real, onde `Equipe / prestador` aparece literalmente
como **"DEFINIR"** em 4 das 19 obras ativas, e onde 3 obras estão sem valor e
várias sem data de início. Ou seja: obra incompleta já é um estado real hoje,
só que hoje não tem dono nem prazo — fica no limbo da planilha.

O que costuma faltar quando a obra chega (verificado na planilha):

| Campo | Situação na entrada |
|---|---|
| Responsável da obra | vazio — é o que o cliente apontou |
| Equipe / prestador | "DEFINIR" |
| Início planejado e duração | vazios em várias |
| Prioridade (Normal / Urgente) | às vezes vazia |
| Valor | vazio em 3 das 19 |

## Decisão que isso abre e ainda não está tomada

**Quem completa a obra que chega crua do Field?** O cliente não disse. Vai virar
DECISÃO D, numerada dentro do próprio mockup, no mesmo formato que já funcionou
com ele nas decisões A, B e C.

Ligação com a reunião: no minuto 18 ele descreve um checklist antes de começar a
obra — *"pra eu começar a obra dia 17, tenho que ter o material, tem que ter a
equipe"*. A tela de triagem da obra nova é onde esse checklist nasce.
