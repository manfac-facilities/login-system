# Obra × Financeiro × Compras × Fornecedores — proposta de integração (31/10/2026)

Base: levantamentos só de leitura em `descoberta-integracao-financeiro.md`, `descoberta-integracao-compras.md`, `descoberta-integracao-fornecedores.md` (mesma pasta). Pedido: item 14 da reunião de 31/10 (`docs/cliente/2026-10-31-obras-anotacoes-reuniao-validacao-leva1.md`).

## O que já existe (e muda o tamanho do trabalho)
- **Compras** já guarda a obra na solicitação (`cmp_solicitacoes.obra_id`, 27 de 57 com obra) e já tem "nova solicitação já com a obra" (`/compras/solicitacoes/nova?obra=<id>`). Pedido tem `previsao_entrega` e `entrega_em`.
- **Financeiro** já liga **nota fiscal → N obras** no faturamento (`fin_fat_nota_obras`). Pagamentos, rateio e caixinha só têm o centro de custo (DPSP - OBRAS = um para várias obras).
- **Gestão de Fornecedores** tem contrato com `obra_id` (nenhum preenchido ainda), medições com aprovação Eduardo → José, e a medição aprovada vira pagamento no Financeiro.
- Ninguém tem: medição **ao cliente**, OS filha (aditivo), locações, PEF por obra.

## Regra de ouro
Cada sistema continua dono do seu dado e do seu deploy (Fornecedores: "deploy não atualiza outro sistema"). A obra **lê** por funções de leitura dedicadas; mudanças nos outros sistemas são só **acréscimos** (coluna/tabela nova), nunca alteração do que já roda.

## Fases
**A — a obra enxerga (sem mexer nos outros sistemas)**
- Aba **Financeiro** na obra (só quem pode ver valores): compras da obra (solicitação → pedido → entrega, valor), contratos e medições de fornecedores (contratado, medido, pago, em aprovação), notas faturadas ao cliente. Leitura por funções `security definer` no banco, filtradas pela obra.
- Botão **Pedir material** na obra e na restrição de Material → abre o Compras já com a obra.
- Restrição de Material ligada a um pedido: previsto = previsão do pedido; quando o Compras marca entregue, a restrição mostra "pronta para liberar".
- `obras_obra.obra_pai_id` (aditivo como OS filha).

**B — tudo nasce com obra (acréscimos nos outros sistemas)**
- Obra obrigatória nos lançamentos do CC DPSP - OBRAS: solicitação/rateio de pagamento e caixinha no Financeiro, contratos no Fornecedores (o Compras já tem).
- **Medição ao cliente** (nova, no Financeiro ou na obra): período, % medido, valor, aprovação do cliente, notas geradas; alerta de mais de 10 dias em aprovação.
- **Locações** da obra com vencimento e alerta.

**C — resultado da obra**
- **PEF por obra** e orçado × realizado; margem por obra (mãe + filhas); o Orçamento consolida no PEF do CC DPSP - OBRAS.

## Perguntas (juntadas dos três levantamentos, sem repetição) — com a minha recomendação
1. **Quem vê valores (custo, receita, margem) na obra?** Recomendo: engenheiro da obra, admin, financeiro e diretor; supervisor e cliente nunca.
2. **Aditivo:** sempre OS filha? O custo e a receita do aditivo ficam na filha e somam na mãe? Recomendo: sim — margem por OS e total da obra.
3. **Quando conta:** custo pelo pedido emitido/medição aprovada (comprometido) e pelo pago? Receita pela medição aprovada, NF emitida ou recebida? Recomendo: mostrar **comprometido, realizado (NF/aprovado) e pago**; margem pelo realizado.
4. **Dividir entre obras:** uma NF, despesa de caixinha ou contrato pode ser rateado entre obras? Recomendo: sim, por valor ou %, padrão 100% numa obra.
5. **Obra obrigatória** em tudo que cair no CC DPSP - OBRAS a partir de agora? E o histórico? Recomendo: obrigatória daqui pra frente; histórico vinculado à mão só de Macaé 3.
6. **Medição ao cliente:** quem registra e quantas notas ela gera? O alerta "> 10 dias em aprovação" vale também para fornecedor? Recomendo: engenheiro registra, financeiro emite N notas; alerta para as duas.
7. **Medição de fornecedor:** o engenheiro da obra pré-aprova antes do Eduardo? Ligada a atividade? Recomendo: pré-aprovação do engenheiro; atividade opcional.
8. **PEF:** nasce na obra (a partir da LPU/REV) e o Orçamento consolida? Recomendo: sim.
9. **Restrição de material** fecha sozinha quando o Compras marca entregue? Recomendo: não — sugere, o engenheiro confirma.
10. **Locação:** quando avisar? Recomendo: 5 dias úteis antes do fim e ao vencer.
11. **Projeto do Omie:** pode passar a usar? Recomendo: não agora (exige escrita no Omie de produção).
12. **Folha própria** (equipe Manfac) entra no custo da obra? Recomendo: fora por enquanto.

Com as respostas 1–4 já dá para começar a **Fase A**; 5–12 moldam B e C.
