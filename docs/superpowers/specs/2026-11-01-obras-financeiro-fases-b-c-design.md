# OBRAS — Financeiro da obra, Fases B e C (sem PEF)

**Data:** 01/11/2026 · **Fontes (literal):** `docs/cliente/2026-11-01-obras-financeiro-fase-b-c-respostas.md`; proposta `docs/obras/proposta-integracao-financeiro-compras-fornecedores.md`; levantamentos `docs/obras/descoberta-integracao-{financeiro,compras,fornecedores}.md`. **Mockup aprovado:** https://claude.ai/artifact/QfSkY6yZk2sW5WxsLCyiR4 (versão 2; José: "pode seguir assim"). **Base:** Fase A no ar (spec `2026-10-31-obras-financeiro-fase-a-design.md`).

## 1. Intenção
Todo custo de obra (OBRAS e SPOT) nasce ligado a uma obra/OS, a obra sabe quanto vai receber e quanto o cliente já liberou, e a aba Financeiro mostra margem e pendência de faturamento. **Orçamento/PEF ficam para uma etapa final** (José: "não vamos fazer nada de orçamento e PEF por enquanto ... vamos fazer só a margem").

## 2. Decisões do José
1. **Valor receita** (não "valor vendido") por OS, digitado (admin) numa aba **Dados da obra**; sem valor, a aba Financeiro pede o valor no lugar da receita esperada e da margem. Aditivo (OS filha) tem o seu; a mãe soma.
2. **Organograma do cliente** na aba Dados da obra: nome, cargo, e-mail **opcional**. Serve também de cadastro de e-mails do cliente (destinatários dos envios e acesso ao portal saem daqui). Sem hierarquia por ora.
3. **Faturamento DPSP:** o cliente libera geralmente no fim, às vezes há liberações parciais negociadas → mostrar **% avanço × % liberado × % faturado**; pendências "liberado e não faturado" e "avanço à frente do liberado".
4. **Medição ao cliente:** o engenheiro registra na obra (período, % **ou** valor — um calcula o outro sobre o valor receita da OS —, situação enviada/aprovada/recusada); o Financeiro emite N notas e liga à medição. Alerta > 10 dias em aprovação, também para medição de fornecedor.
5. **Obra/OS obrigatória daqui pra frente** quando o centro de custo é de **OBRAS** ou de **SPOT** e a categoria **não é custo fixo** — em pagamentos/rateio e caixinha (Financeiro) e contratos (Fornecedores); o Compras já pede obra. Vale para as obras SPOT (custos associados à OS SPOT). Histórico: só Macaé 3 ligado à mão.
6. **Categorias fixas (dispensam obra):** Remuneração PJ, Prêmios e Bonificações, Aluguel de Veículos, Combustível, Abastecimento, Manutenção de Veículos, Multas, Multas de Trânsito, Seguro de Vida, Vale Refeição, ASOs e Exames Admissionais, Comissões, **Estacionamento**. As demais (Material/Material Aplicado, Mão de Obra Terceirizada, Serviços de Terceiros, Locação de Equipamentos, Máquinas e Equipamentos, Ferramentas, Taxa de ART, Hospedagem, Alimentação…) exigem obra. *Chamada minha:* a lista fica numa tabela de configuração do Financeiro (editável por financeiro/diretor), casada por descrição normalizada da categoria do Omie e do tipo do VEX.
7. **Caixinha:** despesa do VEX em CC SPOT/OBRAS com categoria variável e sem obra entra numa fila; **quem completa é o supervisor da despesa** (a pessoa dona do relatório no VEX).
8. **Medição de fornecedor:** pré-aprovação do engenheiro da obra antes do Eduardo; atividade opcional. Sem engenheiro (SPOT), segue direto para o Eduardo.
9. **Locação:** "Nova locação" abre o Compras em nova aba com a obra e o tipo Locação; o Compras passa a pedir o **período** quando o tipo é locação; a locação aparece na obra quando o pedido é emitido (início = entrega do Compras, fim = período); aviso 5 dias úteis antes e no vencimento; o engenheiro marca devolvida ou renovada até…
10. **Restrição de material não fecha sozinha** (já na Fase A). **Projeto do Omie e folha própria: fora.**

## 3. O que entra
### Hub (login-system)
- **Aba Dados da obra** (item da sidebar; edita só admin; valores só para `obras_pode_ver_valores`): valor receita por OS (mãe + filhas, grava em `obras_obra.valor`); organograma (`obras_cliente_pessoa`: obra, nome, cargo, e-mail opcional, ordem). Chips por pessoa com e-mail: Portal, Diário, Semanal, Mensal — gravam nas tabelas que já mandam (`obras_portal_acesso`, `obras_destinatario`); a lista antiga de destinatários/acesso some das Configurações e passa a ser esta.
- **Medições ao cliente** (sub-tela do Financeiro da obra; registra engenheiro da obra ou admin): `obras_medicao_cliente` (obra/OS, número sequencial por OS, período, percentual, valor em centavos, avanço físico na data, situação `enviada|aprovada|recusada`, datas, autoria). Valor/percentual: um calcula o outro (2 casas, arredondamento ao centavo, soma das liberações ≤ 100% da OS).
- **Locações** (sub-tela): lista pedidos do Compras da obra com `tipo = 'locacao'` emitidos, período vindo do Compras; `obras_locacao_estado` (pedido, devolvida_em, renovada_ate, autoria). Aviso na faixa de alertas/agenda da obra.
- **Aba Financeiro** (evolui a Fase A): receita esperada (soma do valor receita), liberado (soma das medições aprovadas), faturado (Fase A), barras avanço × liberado × faturado, as duas pendências em R$, margem projetada (*chamada minha, aprovada no mockup:* custo projetado = comprometido ÷ avanço físico; sem avanço → "—") e margem realizada; custos por origem: Compras, Fornecedores, **Pagamentos/rateio**, **Caixinha**, **Locações**; contagem de despesas de caixinha sem obra no CC. Alertas: medição ao cliente e de fornecedor > 10 dias em aprovação.
- Leitura de `fin_*`/`cmp_*`/`frn_*` como na Fase A: funções `security definer` no SQL do hub, chamadas com o cliente da sessão, conferindo `obras_pode_ver_valores`.

### Financeiro (repo `financeiro`)
- Migração nova `supabase/hub-install/0NN_fin_obra_vinculos.sql` (próximo número livre): `fin_obra_categorias_fixas` (descrição normalizada); `fin_obra_vinculos` (ambiente, obra_id sem FK, OS texto, origem `solicitacao|caixinha_despesa`, solicitacao_id → `fin_solicitacoes` ou vex_despesa_id, valor/percentual, autoria, desfeito_em) — tabela de vínculo porque o upsert da cópia do VEX reescreve `fin_caixinha_despesas`; `fin_fat_nota_medicoes` (nota_id → `fin_fat_notas`, medicao_id sem FK). Regras do repo: sem FK para `obras_*`, escrita só por funções `fin_*` com service_role, sem `do`/`execute`.
- **Solicitação de pagamento:** seletor Obra/OS (obras `modalidade='obra'` e OS SPOT ativas) obrigatório pela regra do §2.5/6, padrão 100% numa obra, divisão por % ou valor; servidor recusa sem obra quando obrigatória.
- **Caixinha → "Despesas sem obra":** fila por supervisor (só as próprias; financeiro/diretor veem todas); escolher obra/OS grava vínculo.
- **Faturamento:** fila "medições aprovadas sem nota" (lê `obras_medicao_cliente`); ao emitir/ligar nota, grava `fin_fat_nota_medicoes`.
- **Integração de medição do Fornecedores:** aceita `obra_id`/OS no corpo e grava o vínculo da solicitação criada.

### Compras (repo `compras`)
- Tipo **Locação**: solicitação pede período (data fim ou dias); guarda em coluna `cmp_*` nova; abrir `/compras/solicitacoes/nova?obra=<id>&tipo=locacao` já seleciona o tipo.

### Gestão de Fornecedores (repo `fornecedores`)
- Contrato: obra/OS obrigatória quando o CC é OBRAS ou SPOT.
- Medição: etapa nova **pré-aprovação do engenheiro da obra** (`obras_obra.engenheiro_email`) antes do Eduardo; sem engenheiro, pula. Envia `obra_id` na integração com o Financeiro. Deploy dela não atualiza nenhum outro sistema.

## 4. Fora
PEF/orçado × realizado e consolidação no Orçamento (etapa final), Projeto do Omie, folha própria, hierarquia do organograma, backfill além de Macaé 3.

## 5. Restrições
AGENTS.md de cada repo (dinheiro, RLS e autorização são exceção: tratar borda); SQL só em arquivo, aplicado pelo José; nenhum agente escreve em produção; centavos inteiros; cliente nunca vê R$; valores só para quem pode ver; cada repo com deploy próprio; worktrees de caixinha em andamento no Financeiro — não mexer em `lib/caixinha/*` além do necessário para a fila nova.

## 6. O que fica com o construtor
Nomes de colunas reais (conferir por SELECT de catálogo), identificação do "supervisor da despesa" a partir de `fin_caixinha_relatorios`/`fin_caixinha_pessoas`, formato da tela de rateio do Financeiro, lugar exato do aviso de locação.
