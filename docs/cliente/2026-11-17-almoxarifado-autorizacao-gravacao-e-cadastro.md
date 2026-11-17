# Almoxarifado — autorização do João (17/11/2026)

Resposta do João no chat, em 17/11/2026, às três perguntas feitas ao fim do teste de transferência
(`docs/almox/2026-11-17-teste-transferencia-pelo-claude.md`). Texto literal:

> pode seguir

Perguntas a que responde, como foram feitas:

1. Posso ajustar o código da gravação no Omie (incluir o valor da movimentação)?
2. Cadastro a 6, a 7 e a 19 no Obras/Spot?
3. Sigo com o cadastro dos estoques e a primeira cópia de saldos?

## Execução (17/11/2026, banco `iyytcavcgukfjnjjrerx`)

- Antes, só leitura: o cadastro de 14–15/11 já estava no banco (BASE, DPSP, PROFARMA, 15 equipes,
  3 contratos, 857 saldos lidos em 14/11).
- Inserido, numa transação: `alx_estoques` (tipo `equipe`) e `alx_equipes` para **MANFAC 6**
  (local Omie 10170713432), **MANFAC 7** (10170713469) e **MANFAC 19** (10171990427), as três no
  contrato **Obras/Spot**, ativas.
- Cópia de saldos disparada na rota de produção (`/almox/api/tarefas/copia-estoque`, 202) às
  15:10 UTC: 898 saldos, todos relidos em 17/11 (MANFAC 6: 13, MANFAC 7: 14, MANFAC 19: 7).
- Fora, como o Jose pediu: MANFAC 4, 8, 10 e 21.
- **MANFAC 23 não cadastrada:** não existe no Frotas (`equipes`), então não há contrato de onde
  tirar. Pergunta ao Jose: qual contrato.
- Item 1 (valor na gravação do Omie): branch `omie-valor` do almox, commit `1b1fd68`, em revisão.
