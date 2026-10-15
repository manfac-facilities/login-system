# Divergências de OS: relatório do hub × controle de obras (15/10/2026)

Mensagem do João no chat, literal:

> Bom dia. Batendo o relatorio do hub e o controle de obras, foram encontradas algumas divergencias nas OS.

> OS no HUB e não no Field

Print anexado: `2026-10-15-divergencias-os-hub-x-field.jpg`. Transcrição da tabela do print (colunas OS | FIELD | LOCAL):

| OS | FIELD | LOCAL |
|---|---|---|
| 0626-014071 | #N/D | HUB |
| 1026-006374 | #N/D | HUB |
| 0726-018976 | #N/D | HUB |
| 1026-007524 | #N/D | HUB |
| 0926-014930 | #N/D | HUB |
| 0526-014042 | #N/D | HUB |
| 0726-019256 | #N/D | HUB |

## Mensagens seguintes do João (literal)

> OS nem no HUB e nem no Field

> OS no Field e não no HUB

> O feedback acabou, pode atuar

As duas mensagens acima vieram com um print anexado que é **o mesmo arquivo** do primeiro (md5 idêntico, 4d08250c…). As listas "nem no HUB nem no Field" e "no Field e não no HUB" não chegaram, e o João vai ser avisado.

## Diagnóstico da lista "OS no HUB e não no Field" (15/10, Claude; consultas só de leitura no banco e na API do Field)

As 7 existem no hub (`fonte = field`, com `field_id`) **e** no Field, ativas (`archived: false`) e no mesmo tipo de OS.

| OS no hub | `identifier` no Field | Campo "OS Cliente" no Field | Por que deu #N/D |
|---|---|---|---|
| 0526-014042 | 54 | 0526-014042 | número do hub vem do OS Cliente (troca de 13/10) |
| 0726-018976 | 822 | 0726-018976 | idem |
| 0726-019256 | 347 | 0726-019256 | idem |
| 0926-014930 | 266 | 0926-014930 | idem |
| 1026-006374 | 341 | 1026-006374 | idem |
| 1026-007524 | 766 | 1026-007524 | idem |
| 0626-014071 | 0626-014071 | (vazio) | número igual; a única atividade da OS está **arquivada** no Field (status pending, archived true) |

Causa raiz das 6 primeiras: comportamento pedido em 06/10 e no ar desde 13/10. O hub mostra o número do campo "OS Cliente" e o Field continua com o `identifier` curto. Um PROCV pelo número da OS não acha a obra. Não é falha de sincronização.
0626-014071: a OS existe com o mesmo número, mas a atividade foi arquivada no Field. Um relatório do Field por atividades não a mostra. No hub ela está em pendFat.

## Retorno do cliente à mensagem de explicação (literal, repassado pelo João)

> o ciente nao entendeu e disse, deovlve a planilha com as consideraçoes, fica mais facil do cliente enviar ao colaborador

Resposta: planilha `.xlsx` com as mesmas colunas do print (OS | FIELD | LOCAL) e as considerações por linha, em `docs/cliente/2026-10-15-divergencias-os-devolutiva.xlsx`.

## As outras duas listas (15/10, literal do João)

> Segue as 3 imagens

> não é só isso, tem 66 OS que diz que ta no field e nao ta no hub, precisa criar tbm os motivos dessas ai, da planilha toda com uma coluna ao lado informando o motivo

Três prints: `2026-10-15-divergencias-os-lista-b.jpg` (66 linhas), `2026-10-15-divergencias-os-lista-c.jpg` (9 linhas) e um terceiro igual à lista de 7 que já está acima (recorte novo, mesmo conteúdo). Pela fala do João, a lista B é "no Field e não no HUB" e a lista C é "nem no HUB e nem no Field".

### Lista B, transcrição (Coluna1 | Coluna2 | Coluna3 | Coluna4)

| Coluna1 | Coluna2 | Coluna3 | Coluna4 |
|---|---|---|---|
| 0126-015288 | 0126-015288 | PENDENTE FATURAMENTO | CLIENTE |
| 0226-009618 | 0226-009618 | PENDENTE FATURAMENTO | CLIENTE |
| 0326-009215 | 0326-009215 | PENDENTE FATURAMENTO | CLIENTE |
| 0326-009444 | 0326-009444 | PENDENTE FATURAMENTO | CLIENTE |
| 0326-010522 | 0326-010522 | PENDENTE FATURAMENTO | CLIENTE |
| 0326-012374 | 0326-012374 | PENDENTE FATURAMENTO | CLIENTE |
| 0326-012395 | 0326-012395 | PENDENTE FATURAMENTO | CLIENTE |
| 0326-018781 | 0326-018781 | PENDENTE FATURAMENTO | CLIENTE |
| 0426-012516 | 0426-012516 | PENDENTE FATURAMENTO | CLIENTE |
| 0426-016925 | 0426-016925 | PENDENTE FATURAMENTO | CLIENTE |
| 0426-016931 | 0426-016931 | PENDENTE FATURAMENTO | CLIENTE |
| 0426-017866 | 0426-017866 | PENDENTE FATURAMENTO | CLIENTE |
| 0526-008051 | 0526-008051 | PENDENTE FATURAMENTO | CLIENTE |
| 0526-013041 | 0526-013041 | PENDENTE FATURAMENTO | CLIENTE |
| 0526-013810 | 0526-013810 | PENDENTE FATURAMENTO | CLIENTE |
| 0526-016397 | 0526-016397 | PENDENTE FATURAMENTO | CLIENTE |
| 0526-016495 | 0526-016495 | PENDENTE FATURAMENTO | CLIENTE |
| 0526-017199 | 0526-017199 | PENDENTE FATURAMENTO | CLIENTE |
| 0526-018908 | 0526-018908 | PENDENTE FATURAMENTO | CLIENTE |
| 0526-019340 | 0526-019340 | PENDENTE FATURAMENTO | CLIENTE |
| 0526-019250 | 0526-019250 | PENDENTE FATURAMENTO | CLIENTE |
| 0626-004129 | 0626-004129 | PENDENTE FATURAMENTO | CLIENTE |
| 0626-004183 | 0626-004183 | PENDENTE FATURAMENTO | CLIENTE |
| 0626-004592 | 0626-004592 | PENDENTE FATURAMENTO | CLIENTE |
| 0626-005012 | 0626-005012 | PENDENTE FATURAMENTO | CLIENTE |
| 0626-005068 | 0626-005068 | PENDENTE FATURAMENTO | CLIENTE |
| 0626-005488 | 0626-005488 | PENDENTE FATURAMENTO | CLIENTE |
| 0626-005880 | 0626-005880 | PENDENTE FATURAMENTO | CLIENTE |
| 0626-006632 | 0626-006632 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-009420 | 0726-009420 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-010838 | 0726-010838 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-011532 | 0726-011532 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-012445 | 0726-012445 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-013344 | 0726-013344 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-015135 | 0726-015135 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-018016 | 0726-018016 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-018751 | 0726-018751 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-009288 | 0726-009288 | FECHAR OS | CLIENTE |
| 0826-006388 | 0826-006388 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-019011 | 0726-019011 | PENDENTE FATURAMENTO | CLIENTE |
| 0826-005453 | 0826-005453 | FECHAR OS | CLIENTE |
| 0826-007642 | 0826-007642 | PENDENTE FATURAMENTO | CLIENTE |
| 0926-011139 | 0926-011139 | EXECUTADO - APROVAR OS | CLIENTE |
| 0826-009182 | 0826-009182 | EXECUTADO - APROVAR OS | CLIENTE |
| 0826-007943 | 0826-007943 | EXECUTADO - APROVAR OS | CLIENTE |
| 0826-006948 | 0826-006948 | EXECUTADO - APROVAR OS | CLIENTE |
| 0826-011936 | 0826-011936 | PENDENTE FATURAMENTO | CLIENTE |
| 0826-007936 | 0826-007936 | PENDENTE FATURAMENTO | CLIENTE |
| 0826-008257 | 0826-008257 | EXECUTAR | CLIENTE |
| SEM OS | SEM OS | EXECUTAR - APROVAR OS | CLIENTE |
| 0926-011149 | 0926-011149 | PENDENTE FATURAMENTO | CLIENTE |
| 1125-010536 | 1125-010536 | PENDENTE FATURAMENTO | CLIENTE |
| 1125-015968 | 1125-015968 | PENDENTE FATURAMENTO | CLIENTE |
| 1125-016234 | 1125-016234 | PENDENTE FATURAMENTO | CLIENTE |
| 1125-016236 | 1125-016236 | PENDENTE FATURAMENTO | CLIENTE |
| 0826-009507 | 0826-009507 | PENDENTE FATURAMENTO | CLIENTE |
| 0926-010483 | 0926-010483 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-017852 | 0726-017852 | FECHAR OS | CLIENTE |
| 0926-010003 | 0926-010003 | EXECUTADO - APROVAR OS | CLIENTE |
| 0926-009636 | 0926-009636 | EXECUTADO - APROVAR OS | CLIENTE |
| 0826-004429 | 0826-004429 | PENDENTE FATURAMENTO | CLIENTE |
| 0726-009714 | 0726-009714 | FECHAR OS | CLIENTE |
| 0926-015838 | 0926-015838 | EXECUTADO - APROVAR OS | CLIENTE |
| 1026-006815 | 1026-006815 | EXECUTADO - APROVAR OS | CLIENTE |
| 1026-005832 | 1026-005832 | EXECUTADO - APROVAR OS | CLIENTE |
| 1026-005925 | 1026-005925 | EXECUTADO - APROVAR OS | CLIENTE |

### Lista C, transcrição (Coluna1 | Coluna2 | Coluna3 | Coluna4)

| Coluna1 | Coluna2 | Coluna3 | Coluna4 |
|---|---|---|---|
| 0526-019295 | #N/D | FECHAR OS | CLIENTE |
| 0626-003845 | #N/D | FECHAR OS | CLIENTE |
| 0726-017988 | #N/D | EXECUTADO - APROVAR OS | CLIENTE |
| 0726-018834 | #N/D | EXECUTADO - APROVAR OS | CLIENTE |
| 0726-018624 | #N/D | EXECUTADO - APROVAR OS | CLIENTE |
| 0726-017515 | #N/D | EXECUTADO - APROVAR OS | CLIENTE |
| 0726-018710 | #N/D | EXECUTADO - APROVAR OS | CLIENTE |
| 0726-017712 | #N/D | EXECUTADO - APROVAR OS | CLIENTE |
| 0726-018684 | #N/D | EXECUTADO - APROVAR OS | CLIENTE |

> foi o que o cliente falou da planilah que enviamos
