# Teste de baixa de material em OS pelo Field, feito pelo Claude (17/11/2026)

Pedido: `docs/cliente/2026-11-17-almoxarifado-jose-pede-teste-baixa-field.md` (Jose pediu o teste;
João mandou usar uma OS de teste criada por nós). Foi usada a OS de teste que já existia,
**"TESTE HUB API 2809"** (criada pela API em 28/09, loja DPSP Matriz, atividade arquivada, sem
material). Item: ENGATE FLEXIVEL PVC 1/2" 40CM (PRD00041). Quantidade: 1. Estoque: MANFAC 3
(Omie 10170713238). Scripts fora do repositório (pasta de rascunho da sessão, `teste-transf/`).

API usada: `POST /orders/{id}/products-v2` e `DELETE /orders/{id}/products-v2/{productId}`.
**A documentação do Field está errada no formato do POST:** ela põe `quantity` e `storage` dentro de
`product`; o servidor recusa (422 "@.quantity is missing") e só aceita
`{ product: { id }, quantity, storage: { id, description } }`. A primeira tentativa (formato da
documentação) não gravou nada.

## Linha do tempo (horário de Brasília)

| Hora | O que foi feito | Field M3 | Omie M3 |
|---|---|---|---|
| 15:30 | antes | 3 | 3 |
| 15:30 | engate adicionado à OS pela API (201, valor R$ 3,50) | 2 | 3 |
| 15:32–15:40 | 5 leituras | 2 | 3 |
| ~15:42 | o Field **volta** para 3 (a sincronização do Omie sobrescreve a baixa) | 3 | 3 |
| 15:42–16:03 | leituras de 2 em 2 min | 3 | 3 |
| 16:03 | material removido da OS pela API (204) — o Field devolve +1 | 4 | 3 |
| 16:05–16:19 | leituras de 2 em 2 min | 4 | 3 |
| 16:21 | conferência final: OS sem material | 3 | 3 |

O script de acompanhamento foi interrompido às 16:19 por falta de memória na máquina (não por erro);
a conferência das 16:21 foi feita à parte.

## Conclusões

1. **Material aplicado em OS pela API do Field não chega ao Omie** (33 min sem baixa). E, como na
   transferência, o que só o Field registrou é **desfeito** na sincronização seguinte vinda do Omie
   (~12 min depois). A devolução pela API também não chega ao Omie e também foi desfeita.
2. Isso **não contradiz** a conferência de 15/11 (`docs/almox/2026-11-15-baixa-field-omie.md`):
   o material que o **técnico** lança pelo aplicativo do Field chegou ao Omie em 76 de 82 casos
   (93%), com saída `imp_api = S`. O caminho do app gera a baixa no Omie; o da API pública não.
   Mesmo padrão da transferência (tela do Field chega ao Omie; API do Field não).
3. Para o almox nada muda: ele **não grava no Field**, grava só no Omie. A baixa do técnico continua
   saindo pelo app do Field, como já acontece.
4. Estado final igual ao inicial: MANFAC 3 com 3 engates nos dois sistemas, OS de teste sem material.
