# Baixa do Field no Omie: o Field dá baixa no estoque da equipe? (15/11/2026)

Autorização: `docs/cliente/2026-11-12-almoxarifado-respostas-jose-omie-field.md`. Só leitura em tudo (Field: GET; Omie: `ListarAjusteEstoque`; Supabase: SELECT). Nenhuma chave foi impressa ou gravada.

## Veredito: SIM, para as equipes que apareceram na amostra (9 de 15 equipes)

Quando o técnico aplica material numa OS no Field, aparece no local de estoque da equipe no Omie uma **saída por ajuste (origem AJU) marcada `imp_api = S`**, ou seja, criada por API e não digitada no Omie. Mesmo produto, mesma quantidade, mesma equipe, no mesmo dia da OS na maioria dos casos.

Evidências que sustentam "é o Field e não uma pessoa nem o app do Almoxarifado":

1. **Todas** as saídas (SAI) lançadas nos locais das equipes desde 22/10 têm `imp_api = S`: 184 delas, e só 1 saída manual (`imp_api = N`), que está fora dos locais de equipe. Ninguém digita saída de equipe à mão.
2. O app do Almoxarifado ainda não gravou nada no Omie: `alx_tarefas_omie` está vazia em produção. A origem não é ele.
3. O Field tem os locais de estoque das equipes ligados ao Omie: `GET /storages` devolve "MANFAC N" com `external.id` igual ao código do local no Omie (criados em 16/07/2026), e cada produto do Field tem `external.id` igual ao código do produto no Omie. É exatamente a ligação que a baixa automática precisa.
4. Casamento exato na amostra: 82 linhas de material (OS concluídas ou reportadas de 22/10 a 13/11), 76 com a saída correspondente no Omie (93%). As 6 sem par estão explicadas abaixo.

## Método

- Field: 1.200 OS criadas desde 15/10 (varredura por `created_at`, ordenada por id, portanto uma fatia arbitrária), das quais 73 têm `productsTotalValue > 0`. Para cada uma: `/orders/:id/products` (produto, quantidade), `/orders/:id/tasks` (data de conclusão e técnico `MANFAC-N`), `/products/:id` (`external.id` = código do produto no Omie).
- Equipe: o técnico do Field se chama `MANFAC-N` e corresponde ao local "MANFAC N" (`public.alx_estoques`).
- Omie: `estoque/ajuste` `ListarAjusteEstoque`, 8 páginas finais (703 ajustes, de 22/10 a 13/11, sem filtro de data porque os nomes de parâmetro de data são recusados; só `pagina` e `registros_por_pagina` valem). Casei local + produto + SAI + quantidade, janela de -2 a +10 dias da conclusão. Conferi também contra a cópia `public.alx_movimentos` (que só mostra AJU, sem distinguir API).
- `ListarMovimentoEstoque` e `alx_movimentos` mostram só `AJU / Movimento Manual de Estoque` para tudo: **não dá para ver a origem API por ali**. A prova está no `imp_api` do `ListarAjusteEstoque`.

## Amostra (até 4 linhas por equipe; todas as 82 linhas foram avaliadas)

| OS | Equipe | Produto | Qtd | Conclusão no Field | Achado no Omie | Data no Omie | Origem / imp_api | Atraso (dias) |
|---|---|---|---|---|---|---|---|---|
| 1026-012803 | MANFAC 1 | PRD00373 REFLETOR / PROJETOR LED 100W 6 | 1 | 2026-10-23 | sim | 23/10/2026 | AJU / S (motivo INV) | 0 |
| 1126-009042 | MANFAC 1 | PRD00229 ASSENTO SANITARIO PVC BRANCO | 1 | 2026-11-04 | sim | 04/11/2026 | AJU / S (motivo INV) | 0 |
| 0926-000922 | MANFAC 1 | PRD00034 LAMPADA LED TUBULAR 9W 6500K G | 1 | 2026-10-22 | não | - | - | - |
| 1126-008384 | MANFAC 1 | PRD00033 LAMPADA LED TUBULAR 18W 6500K | 1 | 2026-11-03 | sim | 03/11/2026 | AJU / S (motivo INV) | 0 |
| 1026-013649 | MANFAC 3 | PRD00221 FECHADURA P/ PORTA DE MADEIRA | 1 | 2026-10-25 | sim | 25/10/2026 | AJU / S (motivo INV) | 0 |
| 1026-012015 | MANFAC 3 | PRD00373 REFLETOR / PROJETOR LED 100W 6 | 4 | 2026-10-25 | sim | 25/10/2026 | AJU / S (motivo INV) | 0 |
| 1026-014320 | MANFAC 3 | PRD00033 LAMPADA LED TUBULAR 18W 6500K | 4 | 2026-10-27 | sim | 27/10/2026 | AJU / S (motivo INV) | 0 |
| 1126-008927 | MANFAC 5 | PRD00232 KIT REPARO DE CAIXA ACOPLADA | 1 | 2026-11-05 | sim | 05/11/2026 | AJU / S (motivo INV) | 0 |
| 1026-012394 | MANFAC 5 | PRD00097 BOBINA DE MOLA DE 4,5 | 2 | 2026-10-23 | sim | 23/10/2026 | AJU / S (motivo INV) | 0 |
| 1126-010550 | MANFAC 5 | PRD00373 REFLETOR / PROJETOR LED 100W 6 | 1 | 2026-11-11 | sim | 11/11/2026 | AJU / S (motivo INV) | 0 |
| 1126-009184 | MANFAC 5 | PRD00028 FONTE CHAVEADA COLMEIA 12V 30A | 1 | 2026-11-05 | sim | 05/11/2026 | AJU / S (motivo INV) | 0 |
| 3307353 | MANFAC 12 | PRD00232 KIT REPARO DE CAIXA ACOPLADA | 1 | 2026-11-10 | sim | 10/11/2026 | AJU / S (motivo INV) | 0 |
| 3295744 | MANFAC 12 | PRD00662 CORREDIÇA  TELESCÓPICA 25 MM | 1 | 2026-10-29 | sim | 29/10/2026 | AJU / S (motivo INV) | 0 |
| 3297527 | MANFAC 12 | PRD00476 INATIVAR HJ - LUM LED EMB RED | 2 | 2026-11-04 | não | - | - | - |
| 3275428 | MANFAC 12 | PRD00022 FITA ANTIDERRAPANTE PRETA 50MM | 1 | 2026-10-22 | não | - | - | - |
| 1126-000778 | MANFAC 13 | PRD00480 GESSO ESTRUTURAL | 12 | 2026-11-03 | não | - | - | - |
| 1126-000778 | MANFAC 13 | 00804 TINTA ACRILICA FOSCA GELO 18L | 10 | 2026-11-03 | sim | 03/11/2026 | AJU / S (motivo INV) | 0 |
| 1126-000778 | MANFAC 13 | PRD00033 LAMPADA LED TUBULAR 18W 6500K | 20 | 2026-11-03 | sim | 03/11/2026 | AJU / S (motivo INV) | 0 |
| 1126-000778 | MANFAC 13 | PRD00133 CADEADO DE CHÃO | 5 | 2026-11-03 | sim | 03/11/2026 | AJU / S (motivo INV) | 0 |
| 3281321 | MANFAC 15 | PRD00035 LAMPADA LED PAR30 11W 2700K E2 | 5 | 2026-10-29 | sim | 29/10/2026 | AJU / S (motivo INV) | 0 |
| 3281321 | MANFAC 15 | PRD00033 LAMPADA LED TUBULAR 18W 6500K | 25 | 2026-10-29 | sim | 29/10/2026 | AJU / S (motivo INV) | 0 |
| 172 | MANFAC 15 | PRD00024 FITA ISOLANTE PRETA 18MM X 20M | 2 | 2026-11-03 | sim | 03/11/2026 | AJU / S (motivo INV) | 0 |
| 172 | MANFAC 15 | PRD00033 LAMPADA LED TUBULAR 18W 6500K | 10 | 2026-11-03 | sim | 03/11/2026 | AJU / S (motivo INV) | 0 |
| 1026-015932 | MANFAC 17 | PRD00028 FONTE CHAVEADA COLMEIA 12V 30A | 1 | 2026-11-03 | sim | 03/11/2026 | AJU / S (motivo INV) | 0 |
| 3285288 | MANFAC 18 | PRD00257 CORREDIÇA TELESCÓPICA 35MM | 1 | 2026-10-29 | sim | 29/10/2026 | AJU / S (motivo INV) | 0 |
| 628 | MANFAC 18 | PRD00036 LUMINARIA LED EMBUTIR REDONDA | 4 | 2026-11-10 | sim | 10/11/2026 | AJU / S (motivo INV) | 0 |
| 3298474 | MANFAC 18 | PRD00036 LUMINARIA LED EMBUTIR REDONDA | 8 | 2026-11-05 | sim | 05/11/2026 | AJU / S (motivo INV) | 0 |
| 3265864 | MANFAC 18 | PRD00033 LAMPADA LED TUBULAR 18W 6500K | 44 | 2026-10-27 | sim | 27/10/2026 | AJU / S (motivo INV) | 0 |
| 3293681 | MANFAC 22 | PRD00031 LAMPADA LED BULBO 9W 6500K E27 | 2 | 2026-10-29 | sim | 28/10/2026 | AJU / S (motivo INV) | -1 |
| 3292039 | MANFAC 22 | PRD00031 LAMPADA LED BULBO 9W 6500K E27 | 7 | 2026-10-28 | sim | 27/10/2026 | AJU / S (motivo INV) | -1 |
| 3324036 | MANFAC 22 | PRD00034 LAMPADA LED TUBULAR 9W 6500K G | 4 | 2026-11-13 | sim | 13/11/2026 | AJU / S (motivo INV) | 0 |
| 3302051 | MANFAC 22 | PRD00028 FONTE CHAVEADA COLMEIA 12V 30A | 1 | 2026-11-03 | sim | 03/11/2026 | AJU / S (motivo INV) | 0 |

"Atraso" = data do ajuste no Omie menos data de conclusão da tarefa no Field (UTC). Negativo = o ajuste foi lançado no dia anterior à conclusão.

## Resultado agregado (82 linhas, 22/10 a 13/11)

| Equipe | Linhas | Com saída `imp_api = S` |
|---|---|---|
| MANFAC 1 | 20 | 19 |
| MANFAC 12 | 19 | 16 |
| MANFAC 22 | 10 | 10 |
| MANFAC 13 | 9 | 8 |
| MANFAC 18 | 8 | 8 |
| MANFAC 5 | 7 | 7 |
| MANFAC 15 | 5 | 4 |
| MANFAC 3 | 3 | 3 |
| MANFAC 17 | 1 | 1 |

## Atraso típico

O Omie só guarda a **data** do ajuste, sem hora, então não dá para medir minutos. Em dias: **mesmo dia em 63 de 76 (83%)**; 10 casos com o ajuste no dia **anterior** à conclusão (o material é aplicado e a baixa sai antes de o técnico fechar a tarefa); 3 casos com +1 dia. Nenhum atraso medido acima de 1 dia nos casamentos mais próximos. Na prática: a baixa sai no dia da aplicação.

## As linhas sem par (6 de 82)

- **3 de 22/10** (OS 0926-000922, 3275428, 3272219): o ajuste existe no Omie em 21 ou 22/10 (confirmado em `alx_movimentos`), mas a página de ajustes lida começa em 22/10, então falta cobertura do dia anterior. Provavelmente casam; não provado como `imp_api = S`.
- **2 linhas de GESSO ESTRUTURAL** (PRD00480; OS 3278616 e 1126-000778, equipes 15 e 13): não existe nenhuma saída desse produto no local da equipe. Possível causa: produto sem controle de estoque ou fora do local. Não investigado.
- **1 linha "INATIVAR HJ - LUM LED EMB RED SL"** (PRD00476; OS 3297527, equipe 12): produto marcado para inativar, sem saída. Idem.

## Vale para todas as equipes?

Não provado para todas. Apareceram na amostra as equipes 1, 3, 5, 12, 13, 15, 17, 18 e 22, todas com baixa automática. **Sem OS com material na amostra: 2, 9, 11, 20, 24 e 25** (e 4, 6, 7, 8, 10, 19, 21, 23 existem no Field mas não estão no Almoxarifado). A ligação (`/storages` com `external.id`) existe para todos os locais "MANFAC N", o que sugere que vale para todas, mas isso é inferência.

## O que ficou sem verificar

- Equipes 2, 9, 11, 20, 24 e 25 (sem OS com material na fatia amostrada).
- A fatia de OS foi arbitrária (1.200 de 9.501 no total); não foi uma varredura completa. OS anteriores a 15/10 não foram vistas.
- Cobertura do `ListarAjusteEstoque` só de 22/10 em diante (8 páginas de 70).
- Hora exata da baixa (o Omie só dá data); atraso em minutos desconhecido.
- Se o Field **estorna** no Omie quando o técnico remove ou corrige o material, ou quando a OS é cancelada.
- Se a baixa é do Field mesmo ou de uma integração intermediária (o Field é quem tem as ligações `external.id`, mas não vi o cabeçalho de quem chamou o Omie).
- Os 2 produtos sem saída (gesso, produto a inativar).
- Dado de apoio: `GET /storages/:id/products` no Field mostra o saldo do Field por equipe; não comparei com `alx_saldos` (seria o teste de divergência).
