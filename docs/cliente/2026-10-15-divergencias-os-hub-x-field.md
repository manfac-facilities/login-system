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
