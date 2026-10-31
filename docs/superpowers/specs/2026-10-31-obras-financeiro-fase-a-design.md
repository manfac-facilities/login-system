# OBRAS — Financeiro da obra, Fase A: a obra enxerga Compras, Fornecedores e Faturamento

**Data:** 31/10/2026 · **Fontes:** proposta `docs/obras/proposta-integracao-financeiro-compras-fornecedores.md` (Fase A) e os três levantamentos `docs/obras/descoberta-integracao-{financeiro,compras,fornecedores}.md`; item 14 da reunião (`docs/cliente/2026-10-31-obras-anotacoes-reuniao-validacao-leva1.md`); José, 31/10: "pode seguir o recomendado" (perguntas 1–4). **Base:** `feat/obras-leva5` (não mergeada); branch `feat/obras-financeiro-a` em worktree `../wt-obras-fin`.

## 1. Decisões do José (recomendado aprovado)
1. **Quem vê valores na obra:** engenheiro da obra, admin do Obras, papéis **financeiro** e **diretor** do Financeiro. Supervisor e cliente nunca.
2. **Aditivo = OS filha:** obra filha ligada à mãe; custo e receita ficam na filha e somam na mãe; margem por OS e total.
3. **Três colunas:** comprometido (pedido emitido / medição de fornecedor aprovada), realizado (NF), pago; margem pelo realizado.
4. **Rateio entre obras:** permitido por valor ou % (padrão 100% numa obra). Nesta fase só a NF ao cliente já suporta (`fin_fat_nota_obras`); compras e contratos continuam 1 obra (rateio deles é Fase B).

## 2. Regra de ouro
Compras, Financeiro e Fornecedores **não mudam nesta fase** (nem código nem tabelas). O hub lê por **funções de leitura `security definer`** criadas no SQL do hub, que conferem a permissão do §1.1 e filtram pela obra (e filhas). Nenhuma escrita em `cmp_*`, `fin_*`, `frn_*`.

## 3. O que entra
- **Aba Financeiro** na obra (item da sidebar só para quem vê valores): 
  - **Resumo:** receita (NFs ligadas à obra), custo comprometido / realizado / pago (compras + fornecedores), margem realizada (R$ e %), por OS (mãe e cada filha) e total.
  - **Compras:** solicitações da obra → pedido (fornecedor, valor, previsão, entrega, NF, pago) com status do Compras; link "abrir no Compras".
  - **Fornecedores:** contratos da obra, medições (solicitada, aprovada, pagamento solicitado, paga), saldo do contrato.
  - **Faturamento:** NFs ao cliente com a parcela desta obra.
  - Valores sempre com a data "dados até" e de onde vieram. Sem dado → bloco some.
- **Pedir material:** botão na obra (Configurações/Comunicação ou topo) e na restrição de Material do Lookahead → `/compras/solicitacoes/nova?obra=<id>` (já existe no Compras). Qualquer usuário do Obras vê esse botão (pedir não mostra valores).
- **Restrição ↔ pedido:** na restrição de Material, "ligar a um pedido do Compras" (lista os pedidos da obra **sem valores**); com o vínculo, a restrição mostra "previsto <previsão do pedido> · entregue <data>" e, quando o Compras marca entregue, o selo **"Pronta para liberar"** (o engenheiro confirma; não fecha sozinha — recomendação 9). O texto do portal/semanal "previsto X, entregue Y" passa a usar essas datas quando houver vínculo.
- **OS filha:** em Configurações (admin), "Esta obra é aditivo de…" (escolhe a obra mãe, modalidade obra; um nível só; sem ciclo). A mãe lista as filhas.

## 4. Fora (Fases B/C)
Obra obrigatória nos lançamentos, rateio de compras/contratos, medição ao cliente, locações, PEF por obra, Projeto do Omie, folha própria.

## 5. Dados (`sdd-sql-obras-financeiro-a.sql`)
- `obras_obra.obra_pai_id uuid null references obras_obra(id)` — só admin (incluir na guarda de parâmetros), um nível, sem ciclo, mãe e filha modalidade obra.
- `obras_pode_ver_valores(p_obra uuid) returns boolean` — security definer; admin Obras OU engenheiro da obra (ou da mãe) OU papel financeiro/diretor em `fin_papeis` para o e-mail do JWT; falha fechada.
- Funções de leitura (security definer, `search_path` fixo, executáveis por `authenticated`, retornam vazio sem permissão): `obras_fin_compras(p_obra)`, `obras_fin_fornecedores(p_obra)`, `obras_fin_notas(p_obra)` — da obra e filhas, com a coluna da OS de origem.
- `obras_restricao.cmp_pedido_id uuid null` + função `obras_restricao_pedidos(p_obra)` que lista pedidos da obra **sem valores** para quem tem acesso ao Obras.
- Colunas reais de `cmp_*`, `fin_*`, `frn_*`: as dos levantamentos (conferir no banco antes de escrever).

## 6. Restrições
AGENTS.md (dinheiro, RLS e autorização são exceções: tratar bordas); SQL só em arquivo, nenhum agente executa SQL; tema Manfac; valores em R$ só na aba Financeiro e só para quem pode ver; cliente nunca vê nada disso.
