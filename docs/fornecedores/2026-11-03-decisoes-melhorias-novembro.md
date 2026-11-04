# Melhorias de novembro — decisões (03/11/2026)

Pedido literal: `docs/cliente/2026-11-03-melhorias-fornecedores.md`.

## Resposta do João, literal (03/11/2026, ~21:08)

> do gestao de fornecedores, tudo que recomendou eu aprovei

Antes disso, sobre a Roberta (literal): "os cadastros a mao apareçam para ela".
E sobre o prazo (literal): "eu quero que você rode esse projeto durante agora a madrugada. [...] eu quero esse
projeto entregue amanhã de manhã, no máximo."

## O que ficou aprovado (as recomendações da sessão 766cb1a3, 03/11 20:54)

1. **Preço por serviço no global.** Pergunta "Tem preço fixo por serviço? Sim/Não". Sim → tabela (serviço,
   unidade, preço). Não → linha de serviço variável, valor informado em cada medição. Condição de pagamento
   escolhida à parte, entre as normais. `SPOT_TABELA_FIXA` sai da lista para contratos novos; os que já usam
   continuam. No "Não", o global continua exigindo valor total estimado (teto) — recomendação aprovada.
2. **Vigência em meses.** Escolha entre "Data de fim" e "Duração em meses"; nos meses o sistema calcula o fim a
   partir do início; o documento mostra as duas informações.
3. **Resumo diário de pendências.** E-mail por dia útil às 8h a quem tem aprovação parada (Eduardo:
   contratações; José: condições de pagamento), com contratos e aditivos aguardando, dias parado e link. Sem
   pendência, não envia.
4. **Papel "consulta".** Vê todos os contratos e medições, não aprova nada. Roberta recebe. **Falta o e-mail
   dela** (o papel fica pronto; a concessão espera o e-mail).
   → João (literal): "no hub tem essa info". Consulta em produção (só leitura, 03/11): o único usuário do hub
   que bate é `robertha.barbosa@manfac.com.br` (papel `compras` no Compras, último login 26/10). Em
   `obras_pessoa` ela aparece como "Roberta Lima", área Compras, sem e-mail — tratado como a mesma pessoa.
5. **Tabela de contratos.** Coluna "Escopo" (curto, completo ao clicar) e filtro "Tipo de serviço" com seleção
   múltipla.
6. **Dia 25.** Lançamento de medição e envio de NF fechados do dia 26 ao fim do mês, com o aviso "a janela
   reabre no dia 1º". Pagamento segue a condição do contrato.
7. **Aprovação de condição de pagamento** mostra a condição por extenso: parcelas, prazos e valor em R$ de cada
   parcela, calculados para aquele contrato.
8. **Madrugada.** Mockup publicado primeiro; se o João não olhar, sigo com a minha leitura e ele barra de manhã.
   Código pronto, revisado e testado durante a noite. Banco em produção: só com autorização escrita na hora
   (a trava do auto mode exige); sem ela, fica pronto para aplicar de manhã e o João clica em Deploy.

## Pontos que estavam como dúvida sem recomendação — decididos agora por mim (o João pode vetar)

- **5. "Tipo de serviço" = a classificação que já existe** (Spot, Manutenção, Obra, Material, Emergencial),
  coluna `frn_contratos.classificacao`. "Pode selecionar mais de um" = o filtro aceita vários. Motivo: não exige
  cadastro novo nem schema; especialidade (elétrica, hidráulica) seria campo novo que o cliente não descreveu.
- **6. Emergencial fica liberado do bloqueio do dia 25.** Motivo: emergência não espera o mês virar; em 03/11 o
  cliente já precisou lançar algo "que tem que pagar hoje".
- **6. NF continua opcional.** Motivo: decisão do cliente de 08/10 ("a maioria nem tem NF"); o pedido de hoje
  fala da janela, não de obrigar NF.
