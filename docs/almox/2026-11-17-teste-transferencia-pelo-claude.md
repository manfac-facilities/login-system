# Teste de transferência pelas APIs do Omie e do Field, feito pelo Claude (17/11/2026)

Pedido do Jose: `docs/cliente/2026-11-17-almoxarifado-jose-pede-teste-pelo-claude.md`.
Item: ENGATE FLEXIVEL PVC 1/2" 40CM (PRD00041; Omie idProd 10167627467). Quantidade: 1.
Locais: DPSP (Omie 10167614709) e MANFAC 3 (Omie 10170713238). O external id do depósito no Field
é o código do local no Omie, e o external id do produto no Field é o idProd do Omie.
Saldo antes do teste, igual nos dois sistemas: DPSP 26 e MANFAC 3 com 3. Saldo depois: o mesmo.
Scripts (fora do repositório): pasta de rascunho da sessão, `teste-transf/`.

## Linha do tempo (UTC)

| Hora | O que foi feito | Field (DPSP / M3) | Omie (DPSP / M3) |
|---|---|---|---|
| 13:53 | Omie `IncluirAjusteEstoque` TRF **sem `valor`** → recusado: "O Valor informado deve ser diferente de zero." | 26 / 3 | 26 / 3 |
| 13:54 | **A.** Omie TRF DPSP→M3 com `valor` = CMC → `id_ajuste` 10304672193 | 26 / 3 | 25 / 4 (ListarPosEstoque lido no mesmo segundo ainda mostrou 26/3) |
| ~14:00 (entre +316 s e +378 s) | Field recebe a sincronização ("Sincronização Omie (saldo=4, anterior=3)") | 25 / 4 | 25 / 4 |
| 14:00–14:07 | 4 leituras: sem duplicar | 25 / 4 | 25 / 4 |
| 14:07 | **B.** Field `POST /storages-movements-v2/transfers` M3→DPSP → 201 | 26 / 3 | 25 / 4 |
| 14:07–14:35 | Omie lido de 1 em 1 a de 2 em 2 min: **nunca recebeu** | 26 / 3 | 25 / 4 |
| 14:35 | Acerto: Omie TRF M3→DPSP → `id_ajuste` 10304740058 | 26 / 3 | 26 / 3 |
| 14:37–14:39 | O Field **volta** para o saldo antigo do Omie (a transferência B é sobrescrita) | 25 / 4 | 26 / 3 |
| ~14:41 | Field recebe o acerto | 26 / 3 | 26 / 3 |

## Conclusões

1. **Omie → Field funciona pela API**, com atraso de ~5 a 6 minutos. O Field copia o **saldo** do
   Omie (a descrição traz "saldo=X, anterior=Y"), não soma movimento.
2. **Field → Omie pela API não funcionou** (28 min sem chegar), enquanto a transferência feita pela
   **tela** do Field em 16/11 chegou ao Omie quase na hora. E o que foi gravado só no Field é
   **apagado** na próxima sincronização vinda do Omie (14:37).
3. Portanto o almox **grava no Omie, e só no Omie**. O Field acompanha sozinho. Isso inverte a
   recomendação de 16/11 ("gravar só pelo Field"), que se baseava no relato e não em teste.
4. Ajuste confirmado no formato de `lib/omie/movimentos.ts`: `codigo_local_estoque` = origem,
   `codigo_local_estoque_destino` = destino, `tipo` TRF, `motivo` TRF, `origem` AJU, `id_prod`,
   `quan` funcionam. **`valor` é obrigatório** (usado o CMC). A resposta traz `id_ajuste`, que é o
   mesmo `idAjuste` do `ListarMovimentoEstoque` (10304672193 nos dois) — isso responde a parte do
   N7 sobre casar a gravação com o movimento.
5. A diferença de 2 unidades na MANFAC 2 (teste do Jose, 16/11) continua: Field 2, Omie 0.
   O acerto depende de o Jose dizer onde os engates estão fisicamente.
6. Em aberto: por que a transferência pela tela do Field chega ao Omie e a pela API não. Não é
   preciso para o almox, já que ele grava no Omie.
