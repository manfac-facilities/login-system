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

## Estado das frentes

| Frente | Branch | Situação |
|---|---|---|
| Início, Pessoas, Movimentações, Agenda | `rh-modulos` | Pronto e revisado |
| Ponto e fechamento | `rh-modulos` (junto em `3ba1606`) | Pronto, revisado; correções em `rh-f3fix` |
| Férias e Exames | `rh-f2` | Em construção |
| Contratos PJ | `rh-f2c` | Em construção |
| Patrimônio | `rh-f4` | Em construção |
| Recrutamento e Comunicação | `rh-f5` | Em construção |
| Benefícios, seguro e celular | `rh-f6` e Financeiro `fin-seguro-celular` | Em construção |
