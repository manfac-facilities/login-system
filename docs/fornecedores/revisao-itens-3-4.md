# Revisão adversarial: itens 3 e 4 (data de pagamento + reenvio)

Data: 09/10/2026. Revisão somente leitura. Ninguém fez push, comentou em PR, aplicou SQL ou chamou o Omie.

| PR | Head revisado | CI (`verificar`) |
|---|---|---|
| fornecedores#1 `feat/data-pagamento` → main | `319607e` | pass (run 37887932246, SHA confere) |
| fornecedores#2 `feat/reenvio` → `feat/data-pagamento` | `a735db8` | pass (run 37890658402, SHA confere) |
| financeiro#3 `integracao/reenvio` → `integracao/data-pagamento` | `ac973b9` | pass (run 37888820891, SHA confere) |

Clones: `D:\fornecedores-work\rev3-fornecedores`, `D:\fornecedores-work\rev3-financeiro`. A bateria local não foi rodada; o resultado de testes vem do CI.

Régua: só é BLOQUEANTE o dano alcançável a dado ou dinheiro, ou um acesso indevido, com cenário concreto e arquivo:linha.

## Veredito

- **fornecedores#1: APROVADO.** Nenhum bloqueante.
- **fornecedores#2: APROVADO.** Nenhum bloqueante.
- **financeiro#3: APROVADO.** Nenhum bloqueante.

## 1. Duas solicitações vivas para a mesma medição

Nenhum caminho encontrado. Cenários conferidos:

- **Resposta perdida ou timeout, e "tentar de novo".** A chave da tentativa 1 é o próprio `medicao.id` (`lib/integracoes/financeiro.ts:137-151`). Repetir cai no 200 idempotente do Financeiro (`lib/integracoes/medicoes.ts:125-126` do financeiro). Quando a corrida acontece dentro do `gravar` (`repetida`), a rota relê o que ficou gravado (`medicoes.ts:175-180`).
- **Reenvio com o registro perdido.** Cenário: a tentativa 2 é criada no Financeiro, mas `frn_registrar_solicitacao_fin` falha. O `fin_tentativa` continua 1 e a recusa da tentativa 1 continua registrada, então o botão manda a tentativa 2 de novo. A chave é determinística (SHA-1 v5 de `"<id>#2"`), cai no 200 e devolve a mesma solicitação. Não existe caminho para uma tentativa 3 sem uma tentativa 2 registrada e recusada.
- **Dois cliques de reenvio ao mesmo tempo.** Os dois mandam a mesma tentativa n+1, com a mesma chave. Do lado do banco, `for update` mais `p_tentativa = fin_tentativa + 1` (`005_frn_funcoes.sql`, 6.4) mais o índice único `frn_eventos_fin_criada_uq` (`004_frn_medicoes.sql`) seguram a corrida.
- **"Tentar de novo" (tentativa 1) correndo com um reenvio.** A chave 1 devolve a solicitação antiga, já recusada, e nada é criado. O registro é recusado por "Reenvio fora de ordem".
- **Recusa registrada errada.** `frn_registrar_recusa_fin` exige `status = pagamento_solicitado` e `fin_solicitacao_id` igual ao atual, com `is distinct from` e checagem de NULL, então falha fechado. Do lado do cron, `consultarEtapa` confere que o id devolvido é o gravado (`lib/pagamentos/repositorio.ts:280-289`). No Financeiro, `recusada` e `cancelada` são finais (`lib/solicitacoes/etapas.ts:41`): nenhuma ação tira a solicitação dessas etapas. `devolvida` não libera o reenvio.
- **Reenvio na tela** (`_actions.ts:396-431`): só é aceito com `pagamento_solicitado` e com o evento de recusa da tentativa atual. O banco confere de novo no registro.

## 2. A consulta da rota do Financeiro (corpo só com `medicao`)

- **Não cria nada.** Com chave desconhecida, `corpoSchema` falha e a rota devolve 400 antes de qualquer escrita (`medicoes.ts:128-130`).
- **Não vaza dado de outra solicitação.** A busca filtra por `ambiente`, pela origem fixa `fornecedores_medicao` e pela chave (`repositorio.ts`, `lerSolicitacaoDaIntegracao`). Quem chama já tem o segredo da integração.
- **Não contorna validação.** O 200 para uma chave existente já existia antes desta mudança. O PR só acrescenta etapa, vencimento e motivo.
- **Rota antiga no ar** (financeiro#3 não publicado): o 200 sem `etapa`/`vencimento` vira `resposta_inesperada` em `lerSolicitacao` (`financeiro.ts:219-233`). Falha fechado.

## 3. Medição marcada como paga sem ter sido

- **Casamento do pagamento.** Os pagamentos são lidos pelo `fin_solicitacao_id` atual, e `frn_registrar_pagamento` casa pelo `fin_ref` da mesma linha.
- **Tentativa antiga paga depois do reenvio.** Não acontece: uma solicitação recusada ou cancelada nunca chega a `lancando`/`lancada` no Financeiro.
- **Corrida entre o cron e um reenvio.** O `fin_ref` antigo deixa de existir, e o registro falha com "não pertence".
- **Parcial e estorno.** Viram apenas eventos e não mudam o status (`frn_registrar_ocorrencia_pagamento` exige a solicitação atual).

## 4. Porteiro

- **O que passa sem sessão.** Só POST, sem `next-action`, com prefixo `/api/tarefas/` (`lib/auth/porteiro.ts:68-74`). A única rota com esse prefixo é `pagamentos`.
- **Segredo vazio ou curto.** É recusado: `autorizarAgendador` exige pelo menos 32 caracteres e compara em tempo constante (`lib/auth/agendador.ts`).
- **Cron 007.** Está comentado e não agenda nada.

## 5. SQL de 004 e 005

- **Grants.** As duas funções novas e a nova assinatura de `frn_registrar_solicitacao_fin` têm `security definer`, `search_path` fixo, `revoke` de public/anon/authenticated e `grant` só para service_role. O `drop` da assinatura antiga vem antes.
- **Verificações genéricas do 005.** As checagens de search_path e de quem executa o quê cobrem as funções novas.
- **CHECK `frn_md_fin_coerente`.** Amarra `fin_ref`, `fin_criada_em`, `fin_solicitacao_id` e `fin_tentativa`: é tudo NULL ou nada NULL.
- **Guarda com NULL.** Em `pagamento_solicitado` com `fin_tentativa` NULL, a checagem da recusa não acha nada e o reenvio é recusado. Falha fechado.

## Observações (não bloqueiam, vão para backlog)

1. **`004` usa `create table if not exists`.** Num banco onde uma versão anterior do 004 já foi aplicada, as colunas `fin_solicitacao_id`/`fin_tentativa`, o CHECK novo e os tipos novos de evento não entram. A verificação "18 campos" acusaria FALHOU, então o resultado é coerente. Isso só importa se existir homologação com o 004 antigo; em produção nada foi aplicado.
2. **O reenvio pode partir de quem abriu a medição, e não só do Eduardo** (`_actions.ts:410`), mesmo quando o Financeiro recusou como `duplicado`/`indevido`. Não há dano direto, porque o Financeiro precisa validar de novo. Mas é uma decisão de negócio que vale confirmar com o João.
3. **Estorno depois de `paga` não é visto pelo cron**, que só lê `pagamento_solicitado`. A medição continua `paga`. É dado desatualizado, sem movimento de dinheiro.
4. **Passagem do porteiro e formulário sem JS.** Uma Server Action também pode ser disparada por um formulário multipart sem JS, sem o cabeçalho `next-action`. Mesmo assim, toda action chama `requireSessao()` primeiro, então não há bypass. É o mesmo padrão do Compras e do Financeiro.
5. **`motivo` do cancelamento** vem de `fin_eventos.comentario`. No cancelamento o comentário pode ser vazio, e o motivo vai como `null`. A recusa exige um comentário de pelo menos 5 caracteres.
