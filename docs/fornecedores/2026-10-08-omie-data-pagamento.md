# Omie: como obter a data real de pagamento de um título a pagar (pesquisa, 08/10/2026)

Somente leitura. Nenhuma chamada real ao Omie foi feita. Legenda: **FATO** = lido em código/documentação (com link); **INFERÊNCIA** = deduzido, não medido.

## 1. Como o Financeiro cria e lê títulos hoje (FATOS)

Repo: `manfac-facilities/financeiro` (clone no scratchpad), arquivos citados abaixo relativos a ele.

- **Criação:** `IncluirContaPagar` com `codigo_lancamento_integracao = HUBFIN-<nº da solicitação>`. O retorno traz `codigo_lancamento_omie`, gravado em `fin_solicitacoes.codigo_lancamento_omie` (bigint). Fontes: `lib/lancamento/titulo.ts:162-171`; `docs/deploy-easypanel.md:314-325`; levantamento em `docs/fornecedores/2026-10-08-levantamento-compras-financeiro.md` (B2, B3).
- **Antes de gravar** o Financeiro faz `ConsultarContaPagar` pelo código de integração; "não cadastrado" é tratado como "não achei" (`lib/omie/cliente.ts`, `MARCAS_SEM_REGISTROS`).
- **Leitura em lote:** `lib/programacao/sincronizar.ts:66` chama `ListarContasPagar` (via `listarTodos`/`paginar`, `lib/omie/paginar.ts`), com `registros_por_pagina: 500`, `apenas_importado_api: "N"`, a cada 15 min. O mapeador `lib/programacao/mapear.ts:3-7,84-92` **descarta tudo que não é ATRASADO / A VENCER / VENCE HOJE**. Ou seja, título pago nunca entra na cópia, e `OmieTituloBruto` não declara nenhum campo de data de pagamento.
- **Cliente HTTP** (`lib/omie/cliente.ts`): erro de negócio vem com HTTP 500 + `faultstring`; lista vazia vem como erro (`OmieSemRegistros`); obedece "aguarde N segundos"; espera máxima 60 s, acima disso desiste e deixa para a próxima rodada. Medido em produção em 25/09/2026: muita chamada seguida gera "API bloqueada por consumo indevido", chave inteira bloqueada ~5 min. Também medido em 06/10/2026: instabilidade em que `ListarContasPagar` devolvia "Dados do WebService não foram encontrados".
- **Também usado:** `ListarExtrato` (`financas/extrato`) por mês da conta corrente BTG; `MovimentoCopia` tem `origem` ("Conta Paga"...). Esse extrato já traz lançamentos realizados, mas **não** foi medido se carrega o código do título (INFERÊNCIA: o ponto de ligação seria `nCodLancamento`, que é lançamento de conta corrente, não o `codigo_lancamento_omie` do título; não dá para cruzar sem medir).

## 2. O que a documentação do Omie diz

### 2.1 `ListarContasPagar` — [documentação](https://app.omie.com.br/api/v1/financas/contapagar/) (FATOS)
- Filtros: `filtrar_por_status` aceita CANCELADO, PAGO, LIQUIDADO, EMABERTO, PAGTO_PARCIAL, VENCEHOJE, AVENCER, ATRASADO.
- Filtros de data: `filtrar_por_data_de` / `filtrar_por_data_ate` (dd/mm/aaaa) sobre inclusão e alteração, restringíveis com `filtrar_apenas_inclusao` / `filtrar_apenas_alteracao` (S/N). Também `filtrar_por_emissao_*`, `filtrar_por_registro_*`, `filtrar_cliente`, `filtrar_por_cpf_cnpj`.
- Paginação: `registros_por_pagina` com máximo **50** segundo a página. O código do Financeiro manda 500 (INFERÊNCIA: o Omie limita sozinho; não medido. Se limitar a 50, a sincronização de 15 min já faz mais páginas do que parece).
- Resposta: `conta_pagar_cadastro[]` com `status_titulo`; `info.dAlt` / `hAlt` (data/hora de alteração). **A documentação não lista campo de data de pagamento/baixa na resposta** (o objeto `pagamento.data` aparece só na inclusão/alteração).
- Conclusão: `ListarContasPagar` serve para saber **se** está PAGO/LIQUIDADO e quando o título foi **alterado** (`info.dAlt`), mas `dAlt` é data de alteração, não de pagamento (INFERÊNCIA: normalmente coincide com a baixa, mas qualquer edição a muda).

### 2.2 `ListarMovimentos` em `financas/mf` — [documentação](https://app.omie.com.br/api/v1/financas/mf/) (FATOS)
- Filtros: `dDtPagtoDe` / `dDtPagtoAte` (intervalo da data de pagamento), `dDtAltDe` / `dDtAltAte` (alteração), `cStatus`, `cNatureza` (P ou R), `nCodTitulo`, `cCodIntTitulo`.
- Paginação: `nPagina`, `nRegPorPagina` (máx. **50**); resposta com `nTotPaginas`, `nTotRegistros`.
- Resposta: `movimentos[].detalhes` com `cStatus`, **`dDtPagamento`**, `nCodBaixa`, `dDtCredito`, `cNatureza`, `nCodTitulo`, `cCodIntTitulo`; `resumo.nValPago` (valor pago).
- Exemplo de resposta de terceiro com `dDtPagamento` ("10/08/2020") e `nCodTitulo` em `detalhes`: [Workana](https://www.workana.com/job/omie-api) (fonte fraca, só indicativa).
- Este é o método que traz a data de pagamento por título.

### 2.3 Não verificado
- `financas/pesquisartitulos` e `financas/contacorrentelancamentos`: não consegui abrir a documentação dentro desta pesquisa. Não os recomendo sem medir. **INFERÊNCIA:** não são necessários, `ListarMovimentos` já cobre.
- Se `dDtPagamento` vem vazio para título parcialmente pago, ou como lista de baixas (uma por `nCodBaixa`) quando há mais de uma: não documentado. Tratar como possibilidade (INFERÊNCIA).
- Formato exato da data (INFERÊNCIA: dd/mm/aaaa, como o resto da API; o levantamento já registrava que não foi medido).

### 2.4 Limites — [Limites de consumo da API do Omie](https://ajuda.omie.com.br/pt-BR/articles/8112984-limites-de-consumo-da-api-do-omie) e [Tratando os erros de API](https://ajuda.omie.com.br/pt-BR/articles/8001888-tratando-os-erros-de-api) (FATOS, via busca)
- 960 req/min por IP; 240 req/min por IP + App Key + método; 4 simultâneas por IP + App Key + método. Excedeu: "Too many requests".
- Consulta repetida ao **mesmo ID em menos de 60 s** devolve "consumo redundante" (só a primeira traz dados).
- Os dois artigos divergem na redação de "simultâneas"; conferir na fonte oficial antes de depender do número.
- Somado ao bloqueio de ~5 min medido pelo Financeiro: a chave é **compartilhada** (Financeiro, Compras e agora Fornecedores usam a mesma), então o consumo do novo job soma ao dos agendadores de 15 min.

## 3. Desenho mínimo recomendado (INFERÊNCIA, a validar com 1 leitura medida)

**Chamada:** `financas/mf` → `ListarMovimentos` com `cNatureza = "P"`, `dDtPagtoDe/Ate` = janela dos últimos N dias (por exemplo hoje-3 até hoje), paginando a 50. Cruza localmente por `nCodTitulo` = `fin_solicitacoes.codigo_lancamento_omie` (ou por `cCodIntTitulo` = `HUBFIN-<nº>`). Uma chamada traz todos os pagos no período, de todos os fornecedores, e não uma consulta por título.

**Por que não consultar título a título (`ConsultarContaPagar`/`ListarMovimentos` com `nCodTitulo`):** N chamadas por rodada, cada uma sujeita ao bloqueio de 60 s por ID e à cota de 240/min. Só serve como plano B pontual.

**Frequência:** 1 vez por dia, de madrugada, mais um botão "atualizar agora" opcional. O cliente pediu data real, não tempo real. Janela com sobreposição (3 a 7 dias) para absorver falha de uma rodada; é idempotente (grava só se ainda vazio ou se mudou).

**Chamadas por execução:** 1 + páginas. Com 50 por página, algumas dezenas de pagamentos/dia dão 1 a 3 chamadas; mesmo 500 pagamentos na janela dão 10. Sequencial, nunca paralelo (o Financeiro já faz assim, `sincronizar.ts`). Em "consumo indevido" abortar a rodada e esperar a seguinte, como o cliente atual já faz.

**Alternativa sem `ListarMovimentos`:** `ListarContasPagar` com `filtrar_por_status = PAGO` (e `LIQUIDADO`), `filtrar_por_data_de/ate` + `filtrar_apenas_alteracao = "S"`. Dá o "foi pago" e `info.dAlt`, mas não a data de pagamento documentada. Serve só como aproximação.

**Onde gravar:**
- Recomendo **no Financeiro**, em uma tabela/coluna nova própria (ex.: `fin_pagamentos_omie` com `codigo_lancamento_omie`, `data_pagamento`, `valor_pago_centavos`, `lido_em`), por três razões: ele já fala com o Omie, já tem o agendador e o cliente com tratamento de limite; é dono de `fin_*`; e guardar a data junto da solicitação serve a todos os consumidores. É mudança de schema em território de dinheiro: exige decisão do João, spec e aplicação manual da migration (regras do AGENTS.md).
- O **Fornecedores** só lê (view/consulta por `solicitacao_id` ou `codigo_lancamento_omie`) e guarda, no máximo, uma cópia derivada na própria medição. Evita duas rotinas disputando a mesma chave do Omie. (Isto é coerente com a recomendação do levantamento, B4: "o Financeiro que já fala com o Omie".)
- Alternativa: o Fornecedores rodar o job. Contras: terceiro consumidor da mesma chave, cliente HTTP duplicado, e viola o princípio de não escrever em `fin_*`.

**Riscos:**
1. Limite compartilhado: um job a mais derruba os agendadores de 15 min (bloqueio ~5 min da chave inteira). Mitigar com horário fora do pico, janela pequena, sequencial.
2. Campo `dDtPagamento` e baixa parcial/múltipla não medidos (pode vir mais de uma baixa por título; decidir regra: última data, ou só quando status = PAGO/LIQUIDADO).
3. Estorno de baixa: a data some ou muda; a rotina precisa sobrescrever, não só preencher vazios (INFERÊNCIA).
4. Título editado/cancelado depois de lançado no Omie fora do Hub: `cCodIntTitulo` pode não existir; casar por `nCodTitulo` primeiro.
5. Instabilidade do Omie já vista ("Dados do WebService não foram encontrados"): resposta vazia não pode apagar data já gravada (mesma defesa de `motivoParaDesconfiar` na programação).

**Antes de implementar (1 leitura, com autorização do Jose Guilherme, sem escrever no Omie):** rodar `ListarMovimentos` com `nCodTitulo = 10275553282` (o título de teste HUBFIN já criado, `docs/deploy-easypanel.md:314`) e conferir nomes, formato da data e comportamento quando o título ainda não foi pago.
