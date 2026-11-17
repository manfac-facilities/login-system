# Conferência do teste de transferência do Jose — Omie x Field (17/11/2026)

Item: ENGATE FLEXIVEL PVC 1/2" 40CM (PRD00041, idProd Omie 10167627467).
Locais: DPSP (Omie 10167614709) e MANFAC 2 (Omie 10170713215).
Relato do Jose: `docs/cliente/2026-11-16-almoxarifado-teste-transferencia-omie-field.md`.
Consultas só de leitura (Omie `ListarMovimentoEstoque` de 16 a 17/11; Field `GET /storages/{id}/products`).

## Omie — dois ajustes em 16/11

| idAjuste | DPSP | MANFAC 2 | Saldo depois |
|---|---|---|---|
| 10304230219 | −2 (saída) | +2 (entrada) | DPSP 24, MANFAC 2 = 2 |
| 10304237492 | +2 (entrada) | −2 (saída) | DPSP 26, MANFAC 2 = 0 |

Os dois vêm como `codOrigem AJU` / "Movimento Manual de Estoque": pelo movimento não dá para saber
qual veio do Field.

## Field — saldo atual

| Local | Quantidade | Atualizado em (UTC) |
|---|---|---|
| Base Almox - DPSP | 26 | 2026-11-16 18:40:14 |
| MANFAC 2 | **2** | 2026-11-16 18:39:10 |

## Leitura

- **Os dois sistemas discordam em 2 unidades na MANFAC 2**: Omie 0, Field 2. O DPSP bate (26).
- A API do Field não mostrou histórico de movimento nos endereços tentados (todos 404). A sondagem
  parou num 429 (limite de chamadas); a chave é a mesma da sincronização do Gestão de Obras.
- Sem saber a direção exata da transferência feita no Field, não dá para afirmar qual passo se
  perdeu. Falta o Jose dizer de onde para onde foi a do Field, ou mandar print do histórico dela.
