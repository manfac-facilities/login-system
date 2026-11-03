# Descoberta: integração Gestão de Fornecedores x Obras (medição de fornecedor por obra)

Data: 31/10/2026. Somente leitura (GitHub API + SQL de consulta no projeto `iyytcavcgukfjnjjrerx`). Nada foi alterado.

Fontes: repo `manfac-facilities/fornecedores` (lido via `gh api`, último push 14/10/2026), banco do hub, `docs/cliente/2026-10-07-gestao-de-fornecedores.md`, `2026-10-11-pedido-manual-e-fluxo-fornecedores.md`, `2026-10-12-*`, `2026-10-29-sgo-especificacao-eduardo.md`, `2026-10-31-obras-anotacoes-reuniao-validacao-leva1.md` (item 14), `docs/obras/roadmap-obras.md` (linha 21).

## 0. Alerta de entendimento (leia primeiro)

O alerta "medição > 10 dias em aprovação" do SGO (`2026-10-29-sgo-especificacao-eduardo.md` linhas ~200 e ~257) refere-se à **medição ao CLIENTE** (entidade `Medicao`: `aprovadorCliente`, `dataEnvio`, `dataAprovacao`, `nfNumero`, `valorNf`, `dataRecebimento`; `diasEmAprovacao = dataReferencia − dataEnvio`). É receita/faturamento, NÃO a medição de fornecedor. A medição de fornecedor (custo) é a do app Fornecedores. São dois objetos distintos que o item 14 junta no mesmo "módulo financeiro da obra". Confirmar com José se o alerta de 10 dias vale também para medições de fornecedor (hoje o Fornecedores não tem esse alerta; só a fila de aprovação com contador).

## 1. Estado do app

- Repo `manfac-facilities/fornecedores` ("Gestão de Fornecedores — contratação e medição de fornecedores", app do hub, em `hub.manfac.com.br/fornecedores`). Next.js, esqueleto do Compras, Dockerfile próprio, projeto próprio no EasyPanel (pedido do João em 07/10: "fora do login system ... deploy em um sistema e acabando em outros"). README está desatualizado ("ainda sem regras de negócio nem tabelas"); o código tem tudo.
- Construído: PRs #15/#16 (feat/melhorias, 14/10/2026) mergeados. Rotas em `app/(modulo)/`: `contratos` (lista, `novo`, `[numero]` ficha, `editar`, `documento`), `aprovacoes` (fluxo Eduardo -> José, José pode alterar condições), `medicoes` (`nova`, `aprovacao` fila, acompanhamento, `anexo/[id]`), `configuracoes/condicoes` e `configuracoes/modelo`. API: `app/api/tarefas/pagamentos/route.ts` (agendador de leitura do pagamento real) e `app/api/health`.
- Em produção? Indício forte de que sim (migrations `supabase/hub-install/001..012` aplicadas no banco: 13 tabelas `frn_*`, 57 funções `frn_*`, RLS ligada), mas uso é piloto: **1.227 fornecedores** (carga do Omie), **5 contratos** (3 aguardando, 2 aprovados; todos `global`, classificação spot/manutenção), **1 medição** (`solicitada`), 0 aditivos, 19 eventos, 2 papéis ativos. Não consegui confirmar deploy no EasyPanel (GitHub `deployments` = 0). Não verificado.
- Agendador de pagamentos: **não está ligado** (`007_frn_cron_pagamentos.sql` nasce desligado; `cron.job` não tem job `frn_*`; só `manutencao-lembretes-fornecedor`, outro assunto). `docs/DIVIDAS.md` lista também: concorrência real da trava de 100% **não testada em banco real** ("testar antes de liberar a medição"), anexos (NF) não vão ao Financeiro, estorno após paga não volta a medição.
- Dependência de deploy: PR financeiro#3 (etapa/vencimento no 200 da rota) tem de estar no ar antes do Fornecedores.

## 2. Modelo de dados (todas `public.frn_*`, mesmo banco do hub)

- `frn_fornecedores` (id, omie_codigo, documento, razao_social, nome_fantasia, cidade, uf, origem, homolog_cnpj_ok/banco_ok/certidoes_ok, homologado, homologado_por/em). Espelho do Omie. Existem ainda tabelas antigas `fornecedores`/`fornecedor_*` (login de fornecedor externo, outro assunto) e `cmp_catalogo_fornecedores`/`fin_catalogo_fornecedores`.
- `frn_contratos`: id, seq, numero (CT-0001), fornecedor_id, `tipo` (global/...), `classificacao` (spot, manutencao, **obra**, material, emergencial), **`obra_id uuid` (= `obras_obra.id`, SEM FK de propósito, "dúvida C1")**, `obra_rotulo` (foto do rótulo no salvamento), `cc_codigo`/`cc_nome` (departamento Omie), escopo, `valor_mo`, `valor_mat`, inicio/fim, `condicao_codigo`/`condicao_versao` (FK `frn_condicoes_versoes`), exceção de condição, status (rascunho/aguardando/aprovado/devolvido/encerrado/cancelado), carimbos de aprovação (`contratacao_aprovada_por/em` = Eduardo, `condicoes_aprovadas_por/em` = José), devolução, aceite final, encerramento, `parcelas_ajustadas`, `modelo_versao`.
  - Regras: contrato não global exige `obra_id` e `cc_codigo` (check em `003_frn_contratos.sql` linhas ~87-89); global não tem obra (R-02). Hoje 0 contratos com `obra_id`.
- `frn_medicoes`: id, seq, numero (MD-xxxx), `contrato_id` (RESTRICT), `item` (mo/mat), `modo` (valor/percentual), descricao, data_servico, tabela_preco_id, quantidade, `valor`, `percentual`, condicao (codigo/versao), excecao_dias, `competencia`, `aceite_operacional`, nf_numero, forma_pagamento, codigo_pagamento, pix_chave, `categoria_*`, `tipo_documento_*`, **`cc_codigo`/`cc_nome`**, vencimento, `status` (solicitada, aprovada, pagamento_solicitado, paga, devolvida), solicitado_por/em, aprovado_por/em, devolvido_*, **`fin_ref` (FIN-xxxx), `fin_solicitacao_id` (uuid -> `fin_solicitacoes.id`, sem FK)**, `fin_tentativa`, `fin_ultimo_erro`, **`pago_em`, `valor_pago`** (data real vinda do Omie).
- Outras: `frn_aditivos` (valor/condição, mesmo fluxo Eduardo->José), `frn_tabela_precos`, `frn_atendimentos` (contrato consolidado), `frn_anexos` (contrato/medição, storage), `frn_eventos` (linha do tempo imutável, `dados jsonb`), `frn_avisos` (e-mails), `frn_condicoes` + `frn_condicoes_versoes`, `frn_modelos_contrato`, `frn_papeis`.
- Trava de 100% por item (mo e mat independentes) em `frn_solicitar_medicao` (`for update`), espelhada em `lib/regras/saldo.ts` (`totalItem`, `medidoItem`, `travarMedicao`). Saldo = total (base + aditivos aprovados) − medido − em aberto. Status que consomem saldo: solicitada, aprovada, pagamento_solicitado, paga.
- Medição não tem campo de etapa/atividade/% físico: o `percentual` é % do VALOR do contrato, não avanço físico.

## 3. Papéis e RLS

- `frn_papeis(user_email, papel, ativo)`; papéis: `aprovador_contratacao` (Eduardo), `aprovador_financeiro` (José), `configurador`; admin do hub = só leitura (`frn_sou_admin()`). Hoje: 1 aprovador_contratacao + 1 aprovador_financeiro. Concessão é por SQL (sem tela). Leitura em `lib/auth/papeis.ts`.
- RLS ligada nas 13 tabelas, **só política SELECT** (nenhuma de escrita: toda escrita passa por funções `frn_*` SECURITY DEFINER / service role). `frn_contratos_select`: `criado_por = frn_email() OR frn_vejo_tudo()`. Medições, aditivos, anexos, eventos, tabela_preços herdam por `EXISTS` no contrato. `frn_avisos` = `false`. Cadastros (`frn_fornecedores`, `frn_condicoes`, modelos) lidos por qualquer logado.
- Implicação: um módulo Obras que queira ler `frn_medicoes` com o cliente de sessão só enxergará o que `frn_vejo_tudo()` permitir; leitura agregada deve ser por função `SECURITY DEFINER` própria ou service role no servidor (padrão já usado pelo Obras para outras leituras). Conferir quem satisfaz `frn_vejo_tudo` (não li a definição).

## 4. Ganchos com Financeiro, Compras e hub

- **Financeiro (principal)**: decisão do João (08/10, "A, conecta com o Financeiro"). Medição aprovada -> `lib/integracoes/financeiro.ts` chama `POST {FINANCEIRO_URL}/financeiro/api/integracoes/medicoes` (segredo `FORNECEDORES_INTEGRACAO_SECRET`), idempotente por `medicao.id` (tentativa n>=2 gera UUID v5 novo), falha fechada. Cria `fin_solicitacoes` (e rateio por departamento = `cc_codigo`), que segue o fluxo normal até o Omie. Grava `fin_ref`/`fin_solicitacao_id`. Data real de pagamento: `lib/pagamentos/sincronizar.ts` lê `fin_pagamentos_por_solicitacao` (024 do Financeiro) e chama `frn_registrar_pagamento` (status `paga`, `pago_em`, `valor_pago`). Recusa no Financeiro vira evento e libera "Reenviar". Ambos dependem do agendador, hoje desligado.
- **Obras**: único gancho existente é `obra_id` no contrato + funções `frn_listar_obras()` (lista `obras_obra` com etapa fora de faturado/cancelado, rótulo `os · loja · descricao`) e `frn__obra_rotulo()`. O Fornecedores **lê** Obras e nunca escreve nela. Nota: `frn_listar_obras` não filtra `modalidade`, então hoje lista também as ~595 OS spot; para obra deveria filtrar `modalidade='obra'` (4 obras).
- **Compras**: nenhum gancho. O app é copiado do Compras só no esqueleto (stack, porteiro de sessão). `cmp_*` não é referenciado por `frn_*`.
- **Hub**: sessão pelo cookie do hub (porteiro `lib/auth/porteiro.ts`, `proxy.ts`), menu próprio, `HUB_URL`. E-mails por `lib/avisos/*` (SMTP próprio).
- **Orçamento/PEF**: nenhum gancho. `orc_passivo_pagamentos` existe mas não é do Fornecedores.

## 5. O que falta para ligar medição a UMA obra (e a etapas/atividades)

Já existe: `frn_contratos.obra_id` + `obra_rotulo`; medição herda a obra pelo contrato (`frn_medicoes.contrato_id -> frn_contratos.obra_id`); `cc_codigo` na medição.

Falta:
1. **Contratos de obra ainda não existem na prática** (0 com `obra_id`; todos globais). Falta cadastrar os contratos dos fornecedores de DP Macaé 3 com `classificacao='obra'` e `obra_id` = id de Macaé 3.
2. **Sem FK** `obra_id -> obras_obra` (decisão C1). Integridade só por convenção; obra apagada/cancelada deixa `obra_id` órfão (o rótulo congelado ameniza). Para custo por obra, join por `obra_id` funciona, mas sem garantia.
3. **Centro de custo vs obra**: o CC do contrato é o departamento do Omie (ex.: "DPSP - OBRAS", compartilhado por várias obras, ver item 14). Logo o CC NÃO identifica a obra; só `obra_id` identifica. Qualquer relatório "custo da obra" tem de usar `obra_id` e não `cc_codigo`. Pagamentos que não passarem pelo Fornecedores (Compras/Financeiro/caixinha) precisarão de seu próprio vínculo à obra (fora desta descoberta).
4. **Vínculo com atividade/etapa**: inexistente. `frn_medicoes` não tem `atividade_numero`/`etapa`; `obras_atividade` (id, obra_id, numero, frente, etapa, `peso_valor`, ...) e `obras_atividade_exec` (obra_id, numero, status, `percentual`) estão do lado Obras. Para % físico medido x pago é preciso uma tabela de vínculo (medição x atividade(s), com % ou peso), ou ao menos `atividade_numero` opcional. Nota: o cronograma base de Macaé 3 ainda é rascunho (v1) e mudanças de numeração/ordem de etapas estão sendo pedidas (itens 1 e 2 da reunião), então ancorar em `numero` de atividade hoje é frágil; `obras_atividade.id` é por versão (`versao_id`).
5. **Orçado x realizado**: nenhum item de orçamento no Obras ainda (SGO prevê `itemOrcamentoId`; roadmap trata como "Projeto à parte · Financeiro da obra"). Falta a dimensão "item do orçamento" no contrato/medição para comparar com o PEF/REV/LPU.
6. **Alertas de prazo**: o Fornecedores não calcula dias em aprovação (só `solicitado_em`, `aprovado_em` existem; dá para derivar). Não há tarefa/notificação por tempo parado (e-mails só por etapa do contrato).
7. **Papéis**: aprovação de medição é do Eduardo/"aprovador_contratacao" (`frn__pode_operar`/`frn_aprovar_medicao`); engenheiro da obra (`obras_obra.engenheiro_email`, ex. Gabriel) não tem papel no Fornecedores. Quem pode ver medições de uma obra no módulo Obras também não está definido.
8. Pendências técnicas do próprio app antes de uso real: agendador desligado, teste de concorrência, anexos não vão ao Financeiro.

## 6. Proposta mínima e de baixo risco

Princípio: **o Obras só LÊ; o Fornecedores continua dono dos dados e do fluxo.** Nada de deploy do hub exigir deploy do Fornecedores ou vice-versa (pedido de 07/10).

Fase A (só leitura, sem migration em `frn_*` nem em `obras_*`):
- No hub (login-system), criar uma função/view de leitura agregada por obra, p.ex. `obras_custo_fornecedores(p_obra uuid)`: por contrato de `obra_id = p_obra`, retornar fornecedor, contrato, total (frn_total), medido, pago (status `paga`), em aprovação (`solicitada`), saldo, e lista de medições com `solicitado_em`/`aprovado_em`/`pago_em`. Padrão `SECURITY DEFINER`, `search_path` fixo, `GRANT` só a `authenticated`, sem tocar tabelas existentes. Aba "Fornecedores/Custos" na ficha da obra apenas exibe.
- Alerta "medição de fornecedor parada > N dias" calculado nessa leitura (hoje - `solicitado_em` para `solicitada`), configurável; mostrar no Diário/Tarefas do Obras sem escrever no Fornecedores.
- Só depende de existirem contratos com `obra_id`. Rodar com Macaé 3 como piloto (modalidade 'obra', 4 obras hoje).

Fase B (pequena, dentro do Fornecedores, deploy próprio):
- Filtrar `frn_listar_obras()` para `modalidade='obra'` (ou aceitar spot só para classificação spot) e tornar `obra_id` obrigatório em contrato classificado `obra` (já é). Migration pequena e reversível (padrão `hub-install/0NN_*.sql` + rollback).
- Opcional: coluna `atividade_numero int null` (ou tabela `frn_medicao_atividades(medicao_id, obra_id, atividade_numero, pct)`) para % físico. Só depois que o cronograma base de Macaé 3 estiver estável.

Fase C (depois, junto do "Financeiro da obra"): item de orçamento no contrato/medição, orçado x realizado, margem, ligação com PEF por obra. Aqui entra decisão sobre FK.

Riscos de migration:
- Banco único compartilhado: qualquer `ALTER` em `frn_*` afeta o app Fornecedores em produção; manter mudanças aditivas (colunas nullable, funções novas), nunca renomear colunas que o app mapeia em `aprovacoes/_lib/linhas.ts` e `medicoes/_dados.ts` (tipos escritos à mão, `lib/tipos-db.ts`).
- RLS só de SELECT: nova leitura precisa de função `SECURITY DEFINER` (cuidado com vazamento: medições são visíveis só a criador/`frn_vejo_tudo`).
- Não adicionar FK de `frn_contratos.obra_id` para `obras_obra` sem decisão (RESTRICT travaria exclusão/cancelamento de obras; SET NULL perderia histórico).
- Ordem de deploy já frágil (financeiro#3 antes). Não acoplar.
- Dados reais ainda são poucos (1 medição de teste); não há legado a migrar, o que reduz risco agora e piora depois: decidir o modelo antes de haver volume.

## 7. Perguntas de negócio para o José

1. O alerta "medição > 10 dias em aprovação" é só da medição ao cliente (receita) ou também da medição de fornecedor? Qual o prazo para fornecedor?
2. Todo fornecedor de obra passa a ter contrato no Fornecedores (classificação "obra") com `obra_id`? E os de Macaé 3 já existentes (contratados fora do sistema) entram retroativamente?
3. Um contrato de fornecedor pode atender mais de uma obra? (Hoje: uma obra por contrato, ou global sem obra. Global para obras seria proibido pela regra R-02.)
4. Aditivo de obra com OS filha: o custo do fornecedor do aditivo vai para a OS filha ou para a obra-mãe? (impacta qual `obra_id`.)
5. Medição de fornecedor deve referenciar atividade/etapa do cronograma? Uma medição pode cobrir várias atividades? O % físico mede avanço de cronograma ou só pago x contratado?
6. Quem aprova medição de fornecedor da obra: continua o Eduardo, ou o engenheiro da obra (Gabriel) pré-aprova (validação do avanço físico) antes do Eduardo?
7. Quem no Obras pode ver custos de fornecedor? A visão do cliente nunca mostra custo (SGO), confirmar que fica só na visão MANFAC.
8. Custo da obra = medição aprovada, solicitada ao Financeiro, ou paga (data real do Omie)? Para orçado x realizado, qual regime (competência `competencia`, vencimento ou pagamento)?
9. Compras e caixinha da obra: como identificar a obra nesses lançamentos (hoje só departamento/CC)? Fora do escopo do Fornecedores, mas define o "custo total".
10. Posso ligar o agendador de pagamento (007) e testar a trava de 100% em banco real antes de usar medições de Macaé 3?

## 8. Não verificado

- Se o app está de fato no ar no EasyPanel e com qual commit.
- Definição de `frn_vejo_tudo()`/`frn_ve_tudo()` (quem vê todos os contratos).
- Conteúdo das funções `frn_solicitar_medicao`/`frn_aprovar_medicao` além dos nomes e do que `lib/regras/saldo.ts` documenta.
- Lado Financeiro da rota (`financeiro/lib/integracoes/medicoes.ts`) e do repositório `compras`: não lidos.
