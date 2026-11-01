# Descoberta: integração "Financeiro da obra" x app Financeiro

Data: 2026-10-31. Somente leitura (arquivos do repo `C:\Users\jguil\claude\financeiro` + SQL de catálogo/contagem no projeto `iyytcavcgukfjnjjrerx`). Nada foi alterado.
Fonte literal: `docs/cliente/2026-10-31-obras-anotacoes-reuniao-validacao-leva1.md`, item 14.

## 0. Resumo executivo

- O Financeiro **não tem hoje nenhum conceito de obra/OS/projeto** em pagamentos, rateio e caixinha. O único eixo de "centro de custo" é o **departamento do Omie** (ex.: `10159908939 = DPSP - OBRAS`), que é o mesmo eixo que o Orçamento usa no realizado.
- Única ligação existente com obra: **faturamento (notas)**. `fin_fat_nota_obras` (nota_id, obra_id, os, loja, valor_centavos, etapa, forma) liga N obras a cada nota, sem FK para `obras_obra` (por regra do README). Relação nota x obra já é N:N (PK `nota_id, obra_id`).
- Para atribuir tudo a uma obra falta **uma etiqueta de obra** em: solicitação de pagamento (ou no rateio), despesa de caixinha, e títulos a receber/medições ao cliente. Sugestão de menor risco: tabelas de vínculo novas `fin_*` (aditivas, sem mexer nas existentes) + obra filha (`obras_obra` com `obra_pai_id`) no lado do hub.
- Os três eixos que José quer (receita, custo, orçado x realizado) já existem em fontes separadas; o trabalho é de **vínculo + visão**, não de novo motor.

## 1. Modelo de dados relevante (confirmado no banco vivo)

### 1.1 Pagamentos (contas a pagar)
- `fin_solicitacoes` (361 linhas): id, ambiente ('producao'/'teste'), numero, etapa, solicitante_*, fornecedor_* (codigo_omie, documento, razao_social), forma_pagamento, valor_centavos, vencimento, categoria_codigo/descricao, tipo_documento_*, numero_documento, descricao, rateio_modo, emergencial*, codigo_lancamento_omie, tipo, emissao, pagamento_data, baixa_situacao, baixa_codigo_omie, extrato_conta/extrato_fitid. **Sem coluna de obra, OS ou projeto.**
- `fin_solicitacao_rateio` (436): solicitacao_id, ordem, **departamento_codigo**, departamento_descricao, percentual_centesimos, valor_centavos. É aqui que o CC (departamento Omie) entra. Rateio por solicitação pode ter vários departamentos.
- `fin_solicitacao_integracoes` (migração 023): chave de idempotência (ambiente, origem, chave) -> solicitacao_id. Hoje `origem` só aceita `'fornecedores_medicao'` (CHECK).
- `fin_pagamentos_omie` (solicitacao_id, codigo_lancamento_omie, situacao, data_pagamento, valor_pago_centavos, status_omie): leitura do que o Omie efetivamente pagou (migração 024_fin_pagamentos_omie).
- `fin_eventos`, `fin_anexos`, `fin_lancamento_tarefas`, `fin_avisos`: linha do tempo, anexos, fila de lançamento no Omie, e-mails.
- Lançamento no Omie é feito pelo app (`lib/lancamento/executar.ts`); o Omie recebe categoria + departamento (rateio). Grep em `lib/` não achou uso de projeto Omie (`nCodProj`) — **o Omie tem o campo "projeto" no lançamento, mas o app não o usa**.

### 1.2 A receber / notas
- `fin_fat_notas` (35): id, lote_id, tomador_cnpj/nome, tomador_omie_codigo, valor_total_centavos, valor_servico_centavos, pedido, folhas[], chamados[], omie_os (código da OS de serviço no Omie), nfse_numero, situacao, omie_nfse_id, pdf_caminho, autorizada_em, enviada_em, obras_baixadas_em/devolvidas_em, obras_conferidas_*.
- `fin_fat_nota_obras` (13): nota_id, **obra_id (uuid = obras_obra.id, sem FK)**, os (texto), loja, valor_centavos, etapa, forma ('chamado'|'loja_valor'|'manual'). Índice por obra_id. RLS: só papel diretor/financeiro lê.
- `fin_fat_tipos` (tipo de faturamento): natureza ('mensal'|'spot'), omie_departamento, omie_categoria, omie_conta_corrente, codigo_obra, `cliente_obras`, regras fiscais. O departamento da receita é por **tipo**, não por obra.
- `fin_fat_lotes`, `fin_fat_envios`, `fin_fat_envio_notas`, `fin_fat_leituras`, `fin_fat_eventos`, `fin_fat_municipios`, `fin_fat_configuracao`.
- `fin_titulos_omie` (natureza 'R'/'P', cliente_codigo, categoria_codigo, numero_documento, valor, situacao) e `fin_titulos_historico` (inclui departamento_codigo): cópia de leitura do Omie, sem obra.
- Leitura de obras para faturamento: `lib/faturamento/obras-pendentes.ts` lê `obras_obra` (id, os, loja, valor, etapa='pendFat') com chave de serviço. Marcos de baixa: `lib/faturamento/entregar.ts`, `repositorio-entrega.ts`, `conferir.ts`, `liberadas.ts`; a nota autorizada baixa/devolve etapas das obras (`obras_baixadas_em`).
- **Não existe tabela de medição ao cliente** (nem receita contratada/saldo por obra) no Financeiro. Em `obras_obra` há `valor` (numeric) e os campos `fat_nfse`, `fat_pedido`, `fat_folhas`.

### 1.3 Caixinha (Vexpenses)
- `fin_caixinha_relatorios` (vex_id, usuario_vex_id, descricao, status, valor_centavos, aprovadores...), `fin_caixinha_despesas` (783): vex_id, relatorio_vex_id, data, titulo, valor_centavos, tipo_id/tipo_nome, **centro_custo_id, centro_custo_nome** (texto vindo do Vexpenses), comprovante_url, observacao. 6 centros de custo distintos hoje.
- `fin_caixinha_gastos` (cartão), `fin_caixinha_titulos` (títulos Omie por relatório: codigo_lancamento, categoria, sufixo, valor), `fin_caixinha_baixas`, `fin_caixinha_extrato*`, `fin_caixinha_recargas` (`fin_recargas`).
- **`fin_caixinha_cc_contrato`** (ambiente, centro_custo_id, contrato): mapeia CC do Vexpenses para "contrato" (texto livre) — tabela vazia hoje. É o gancho natural mais próximo de "obra", mas é CC->contrato, não despesa->obra. Worktree `financeiro-caixinha-etapa2` (migração 042, último commit 23/10 "fix(caixinha)...") já tem essa tabela em produção.
- Tudo da caixinha é só leitura na tela; escrita via funções com chave de serviço (migração 037/042).

### 1.4 Centro de custo / OS
- Centro de custo = **departamento Omie**, espelhado em `fin_catalogo_departamentos` (codigo, descricao). Vivo: `10159908939 DPSP - OBRAS`, `10158109996 DPSP - MANUTENÇÃO PREDIAL`, `10158110143 DPSP - SPOT MANUTENÇÃO`, `10212438558 BOTICARIO - OBRAS`, `10263668715 POPEYES - OBRAS`.
- OS: só como texto em `fin_fat_nota_obras.os` e `fin_fat_notas.omie_os` (OS do Omie, outra coisa). Não há OS em pagamentos.
- Hub: `obras_obra` tem `os` (texto), `cliente`, `loja`, `valor`, `modalidade` ('obra' = 4 linhas: PLK-NORTESHOP/ZAMP, 1026-014683 DP MACAE 3/DPSP, CDRJ-TELHADO/PROFARMA, TESTE-OBRA; 'spot' = 595), `data_base`, `engenheiro_email`. **Não tem centro de custo/departamento nem obra pai.**

## 2. Ganchos existentes com outros sistemas

| Sistema | Direção | Como | Arquivo |
|---|---|---|---|
| Gestão de Fornecedores (medição de fornecedor aprovada) | entra no Financeiro | `POST /api/integracoes/medicoes` com `Authorization: Bearer FORNECEDORES_INTEGRACAO_SECRET`; corpo `{medicao:{id,numero}, solicitanteEmail, solicitacao}`; idempotente por `fin_solicitacao_integracoes` | `app/api/integracoes/medicoes/route.ts`, `lib/integracoes/medicoes.ts`, `supabase/hub-install/023_fin_integracao_medicoes.sql` |
| Controle de Obras | Financeiro lê | `obras_obra` via chave de serviço (somente leitura); Financeiro escreve marcos/baixa de etapa na obra ao autorizar nota (funções do faturamento) | `lib/faturamento/obras-pendentes.ts`, `entregar.ts` |
| Orçamento | Orçamento lê o Financeiro | Orçamento lê `fin_catalogo_departamentos`/`fin_catalogo_fornecedores` (SELECT permitido, regra 4 do CLAUDE.md dele) e puxa realizado do **Omie** (job `orcamento-realizado`, tabelas `orc_realizado`, `orc_realizado_titulos`: mes, departamento_codigo, categoria_codigo, centavos). Não lê `fin_solicitacoes`. | `../orcamento/CLAUDE.md` |
| Compras | nenhum direto | Compras cria pedido no Omie; proibido escrever em `fin_*`/`obras_*`; Financeiro não referencia Compras | `../compras/CLAUDE.md` |
| Omie | Financeiro escreve/lê | Título a pagar com departamento (rateio) e categoria; baixa; leitura de movimentos/títulos; vez compartilhada `fin_omie_vez` | `lib/omie/*`, `lib/lancamento/*` |
| Vexpenses | lê | cópia de relatórios/despesas/gastos | `lib/vexpenses/*`, `lib/caixinha/*` |

Observação: o PEF no Orçamento é `orc_pefs` (departamento_codigo, nome, tipo, cliente, iss_aliquota, contrato_inicio/fim) com receitas em `orc_dir_receitas` (pef_id, categoria_codigo, valor_unit_centavos, quantidades jsonb) — **um departamento já pode ter vários PEFs** (a coluna é por PEF, não unique por departamento até onde o esquema mostra; confirmar com o Orçamento). Isso casa com "PEF por obra alimentando o CC DPSP-OBRAS".

## 3. Papéis / RLS

- `fin_papeis` (user_email, papel in ('financeiro','diretor'), ativo, concedido_por...). Funções `financeiro_tem_papel(text)`, `financeiro_is_admin()`, `financeiro_current_email()`. Admin do hub vê tudo.
- RLS ligada em todas as `fin_*`, nunca `force`; `revoke all from anon, authenticated` e `grant select` só do necessário. Policies via `(select public.financeiro_...())`.
  - `fin_fat_*` (inclui `fin_fat_nota_obras`): SELECT para diretor ou financeiro.
  - `fin_solicitacoes`: solicitante vê as suas, financeiro/diretor/admin veem todas. `fin_solicitacao_rateio`: visível se a solicitação for visível.
  - `fin_caixinha_despesas`: diretor/financeiro, ou aprovador do relatório (`fin_caixinha_meu_vex_id`).
- **Escrita nunca pelo cliente logado**: só funções `fin_*` com `service_role`, depois de o servidor conferir sessão. App só abre com liberação no hub.
- Regras de instalação (README + `tests/hub-install-safety.test.ts`): SQL novo em `supabase/hub-install/NNN_*.sql` (próximo número 044; 043 já é `fin_recargas`), aplicado à mão pelo José; FK só para `public.fin_*`; escrita só em `fin_*`; corpo de função não chama função de outro módulo; `do`/`execute` dinâmico proibidos. **Portanto o Financeiro não pode ter FK para `obras_obra`** (já é o caso de `obra_id`).
- Quem na obra deve ver custo/margem (engenheiro, PCM) não tem papel no Financeiro: precisaria de leitura restrita por obra (ver questão aberta).

## 4. O que falta para atribuir tudo a uma obra (e a OS filha)

| Fluxo | Hoje | Falta |
|---|---|---|
| Pagamento a fornecedor (compras/serviços) | só departamento no rateio | obra por solicitação (ou por linha de rateio, se a mesma NF atende duas obras); origem Compras não passa nada |
| Medição de fornecedor | payload tem só medicao.id/numero | campo obra/OS no corpo e na solicitação; hoje a Gestão de Fornecedores tem o escopo, mas não manda a obra |
| Caixinha | CC textual do Vexpenses; `cc_contrato` vazio | despesa -> obra (por despesa; um relatório mistura obras). Mapa CC->obra só resolve se cada obra tiver CC próprio no Vexpenses |
| Nota emitida | `fin_fat_nota_obras` (N obras por nota) | funciona; falta nota que cubra só parte de uma obra (medição parcial) com vínculo à **OS filha** e a "medição" como entidade |
| Recebimento (título a receber) | `fin_titulos_omie` natureza R sem obra | ligar título/baixa da nota ao `nota_id` -> obra (já há `codigo_integracao`, `omie_os`, `omie_nfse_id` na nota) |
| Medição ao cliente | inexistente | entidade medição (obra, número, período, valor, aprovada em, nota gerada) |
| Aditivo / OS filha | inexistente | `obras_obra.obra_pai_id` (hub) + receita por OS; nota aponta para a OS filha em `fin_fat_nota_obras.obra_id` (já aceita qualquer obra_id) |
| Orçado | `orc_*` por departamento | PEF por obra (um PEF com `obra_id` ou tabela de ponte) e rollup para o departamento |
| Realizado no Orçamento | Omie por departamento | nenhum problema: custos/receitas lançados no CC DPSP-OBRAS continuam entrando; a visão por obra é paralela |

Ponto crítico: o realizado do Orçamento vem do **Omie**, não do `fin_*`. A atribuição por obra vive só no hub (nossas tabelas); o Omie continua sem saber de obra, a menos que se use o campo Projeto do Omie (ver 5.4).

## 5. Proposta mínima e de baixo risco

### 5.1 Quem é dono de quê
- **Hub / Controle de Obras**: cadastro da obra, OS, obra pai/filha (aditivo), cliente, valor contratado, engenheiro; tela "Financeiro da obra" (visão consolidada).
- **Financeiro**: livro de vínculos "lançamento -> obra" e entidade medição ao cliente; é dono dos dados de pagamento, nota e caixinha.
- **Orçamento**: PEF por obra e rollup no CC; recebe apenas leitura de valores previstos.
- **Compras**: passa a mandar `obra_id` no pedido (campo próprio `cmp_*`), sem escrever em `fin_*`.

### 5.2 Mudanças de dados (todas aditivas, nenhuma altera tabela existente)
1. `fin_obra_vinculos` (migração 044): `id uuid pk`, `ambiente`, `obra_id uuid` (sem FK), `tipo text check in ('solicitacao','caixinha_despesa','titulo_receber','medicao')`, `solicitacao_id uuid null references fin_solicitacoes`, `vex_despesa_id bigint null`, `titulo_codigo_omie bigint null`, `valor_centavos bigint`, `criado_por_*`, `criado_em`, `desfeito_em`. Permite repartir uma NF em 2+ obras (valor por vínculo). Alternativa mais simples para 1ª fase: coluna `obra_id uuid null` em `fin_solicitacoes` e `fin_caixinha_despesas` (ALTER aditivo, nullable, sem default) — menor para consultar, porém `fin_caixinha_despesas` é reescrita pelo upsert de cópia (`042`, `fin_caixinha_*`), então a coluna ficaria fora do upsert; **tabela de vínculo é mais segura**.
2. `fin_obra_medicoes`: obra_id, os_id (filha), numero, periodo, valor_centavos, situacao, nota_id null references `fin_fat_notas`. Medições ao cliente e vínculo com a nota (N notas por obra já suportado por `fin_fat_nota_obras`).
3. Hub: `obras_obra.obra_pai_id uuid null` (migração do próprio hub, `sdd-sql-obras-...`), e opcional `departamento_codigo` (para saber o CC; por enquanto DPSP - OBRAS é compartilhado).
4. Opcional, fase posterior: usar o campo **Projeto do Omie** como etiqueta de obra nos lançamentos (cria/lê `nCodProj`); isso permitiria conciliar com o Omie e puxar realizado por obra no Orçamento. Exige autorização de escrita no Omie de produção (regra 4) e mudança em `lib/lancamento/*`. Não recomendo na 1ª fase.

### 5.3 Caminhos de leitura
- Visão da obra = função/RPC `fin_obra_resumo(obra_id)` (security definer, `row_security = off`, só para service_role) que soma: receita (medições/notas via `fin_fat_nota_obras` + `fin_fat_notas`), custo (vínculos de solicitação + `fin_pagamentos_omie` para pago x lançado; caixinha via vínculo), com filtro `ambiente='producao'`. O app do hub chama via API do Financeiro (não dá para o hub ler `fin_*` direto: RLS exige papel). Alternativa: endpoint `GET /api/integracoes/obras/:id/financeiro` com segredo (mesmo padrão de `/api/integracoes/medicoes`), devolvendo JSON.
- Orçado x realizado: PEF da obra lido do Orçamento (via endpoint ou leitura `orc_*` permitida só para select); realizado da obra = custos/receitas vinculados (fonte `fin_*`), não o realizado do Omie por departamento.
- Margem = receita realizada - custo realizado por obra; margem projetada = PEF - (custo comprometido).

### 5.4 Escritas
- Vínculo criado na origem: tela de solicitação ganha seletor de obra (lista `obras_obra where modalidade='obra'`), medição de fornecedor e Compras passam `obra_id`; caixinha: o aprovador/financeiro vincula despesa a obra numa tela de conciliação (ou mapeia CC->obra quando 1:1).
- Gravação só por funções `fin_*` com service_role (padrão do repo).

### 5.5 Risco de migração em produção
- Baixo: tabelas novas, sem tocar nas existentes, sem backfill obrigatório. Aplicar à mão (044+) pelo José, só o arquivo novo, depois `npm run types` e commit. Teste de segurança `hub-install-safety` precisa passar (sem FK para `obras_*`, sem escrita em outro módulo).
- Atenção: worktrees `financeiro-caixinha-etapa2` (migração 042, terminou 23/10), `financeiro-1b-rascunho`, `financeiro-etapa2`, `financeiro-programacao`, `financeiro-regularizar` estão em andamento/rascunho; o master recente já tem 043. Numerar a nova migração depois do maior número aplicado e evitar editar `lib/caixinha/*` até a etapa 2 fechar para não conflitar.
- Backfill: só as notas já existentes (13 linhas em `fin_fat_nota_obras`) têm obra; o resto é "sem obra" e entra no vínculo manualmente. Macaé 3 piloto: começar só com ela.

## 6. Perguntas em aberto para o José

1. Aditivo: sempre cria nova OS no cliente (filha) ou às vezes fica na mesma OS? Quando é a mesma OS, o valor adicional aparece só como acréscimo de receita?
2. O CC "DPSP - OBRAS" continua único para todas as obras da DPSP, ou cada obra terá seu CC/departamento no Omie? (Se for um só, só o vínculo no hub separa as obras.)
3. Posso usar o campo Projeto do Omie como etiqueta de obra? (Exige autorização de escrita no Omie de produção e mudança no lançamento.)
4. Uma mesma NF/caixinha pode ser dividida entre obras? Em que nível a Manfac lançaria (por NF, por item)?
5. Medição ao cliente: quem registra (engenheiro, Financeiro), tem aprovação do cliente (DPSP) com documento/pedido, e uma medição gera uma ou várias NFs? Fica em Controle de Obras ou no Financeiro?
6. Recebimento: considerar "receita" a medição aprovada, a nota emitida ou o dinheiro recebido? O mesmo para custo: lançado, aprovado ou pago?
7. Caixinha: cada equipe/relatório trabalha numa obra por vez? Dá para obrigar o centro de custo Vexpenses = obra, ou a despesa precisa ser rateada depois?
8. Orçado: o PEF da obra é feito no módulo Orçamento (e sobe para o PEF do CC) ou nasce na obra e só é lido pelo Orçamento? Qual categoria de receita/custo usar (serviço, material, subcontrato)?
9. Quem pode ver custo e margem da obra (só diretor/financeiro, ou também engenheiro/PCM da obra)? Isso muda a RLS.
10. Obras já faturadas/pagas antes do vínculo (histórico): importar retroativamente para Macaé 3 ou começar do zero a partir da data de corte?
11. Custo de mão de obra própria (folha rateada pelo RH) entra no custo da obra? Hoje vem por `rh_colaborador_rateios` no Orçamento, não no Financeiro.
