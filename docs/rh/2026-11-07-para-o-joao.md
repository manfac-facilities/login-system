# RH: o que é do João na manhã de 08/11

Atualizado pela sessão de coordenação. O estado de cada frente fica no fim.

## Ações manuais

1. **Porta do Financeiro (401).** No EasyPanel, app `financeiro`, aba Environment: conferir a linha `RH_INTEGRACAO_SECRET=` igual à do arquivo local `C:\Users\joao-\.manfac-rh-integracao-secret`, salvar e clicar em Deploy. No app do RH, conferir `FINANCEIRO_URL=https://hub.manfac.com.br`. Sem isso, nenhum pagamento sai do RH.
2. **Pedir ao RH os 50 e-mails.** Todos os colaboradores estão sem e-mail; sem ele ninguém recebe aviso.

## Autorizações (escrever no chat)

3. Aplicar em produção as migrations do RH `005` a `015` e criar a pasta privada `rh-arquivos`.
4. Juntar `rh-modulos` na `main` do RH e `fin-seguro-celular` na `main` do Financeiro, e depois o Deploy dos dois.
5. Teste de fumaça com `TESTE - APAGAR`, valor simbólico, cancelado logo depois, com aviso prévio ao Financeiro.

## Decisões abertas

- Categorias do Omie para seguro (`2.03.13`) e celular (`2.04.05`): confirmar com o José.
- Existência da caixa `rh@manfac.com.br`, para os avisos por e-mail.
- Tolerância do boleto do VR (hoje R$ 10,00) e Transporte Urbano como despesa fixa.

## Estado das frentes (atualizado 07/11, noite)

Todas as frentes foram revisadas, sem bloqueio, e juntadas em `rh-modulos` (`d3c64db`): tsc, 2182 testes, 15 migrations do zero, lint e build verdes. Revisão final do conjunto em andamento (`docs/rh/2026-11-07-revisao-final.md`).

| Item | Situação |
|---|---|
| RH `rh-modulos` | Junção pronta; aguardando revisão final |
| Financeiro `fin-seguro-celular` | Revisado, 0 bloqueios |
| Next 16.4.5 `rh-next-16-4` | Pronto, mas sobre a `main` antiga; **não autorizado**. Recomendo refazer sobre a `main` nova depois do merge |
| Produção hoje | Só 001 a 004 do RH; nenhuma pasta `rh-*` no storage (consultado 07/11) |
| Categorias Omie | `2.03.13` = "Seguro de Vida", `2.04.05` = "Telefonia", ativas no catálogo de produção (consultado 07/11) |

Autorizado pelo João em 07/11 (`docs/cliente/2026-11-07-rh-autorizacao-producao.md`): migrations 005 a 015, pasta `rh-arquivos`, merges de `rh-modulos` e `fin-seguro-celular`. Executo só se a revisão final não tiver bloqueio. **O Deploy dos dois apps fica com o João**, primeiro o Financeiro (com o `RH_INTEGRACAO_SECRET` corrigido), depois o RH.

## Decisões pequenas que deixei reversíveis

- Cancelar férias no dia do início gasta 1 dia (tirar o `+ 1` em `rh_cancelar_gozo` se a regra for outra).
- Reserva de e-mail presa 15 min libera reenvio (pode chegar duas vezes, em vez de nunca).
- Admissão cancelada volta o candidato a "sem decisão".
- E-mail do gestor de contrato visível ao admin sem papel (igual à lista de Pessoas).
- Seguro sem prêmio informado não confere o valor do boleto.
- Número completo da linha de celular visível ao admin sem papel (dá para mascarar).
- Funcionário CLT afastado continua ganhando períodos de férias.
