# Revisão independente das correções da F3 do RH (Ponto e fechamento)

Branch `rh-f3fix`, commit revisado `a8a97c5`. Base de comparação: `3ba1606`. Data: 07/11/2026.
Itens corrigidos: B1, B2, B4, B6, B7 e B8 de `docs/rh/2026-11-06-revisao-f3.md`.

## Veredito

**0 BLOQUEIOS.** As seis correções fazem o que dizem, e nada do que estava verde quebrou.

Fica um ponto para o coordenador saber, e ele não bloqueia:

- **B1 tem uma brecha de corrida, por fantasma (F1 abaixo).** O `for update` só trava as linhas de
  salário que já existem e estão visíveis quando o gatilho roda. Um salário **novo**, inserido e
  reservado enquanto a correção do total ainda não foi confirmada, passa. Reproduzi em Postgres real.
  A janela é a duração de uma única chamada `rh_registrar_conferencia_folha`, que leva milissegundos, e
  o valor do salário não sai do total. Por isso fica no backlog.

## O que rodou

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | Sem erro |
| `vitest run tests/ponto tests/pagamentos tests/hub-install/004* 011* tests/hub-install-safety.test.ts` | **658 de 658**, em 18 arquivos |
| O mesmo conjunto em `3ba1606` | 645 de 645. As correções somam 13 testes e nenhum some. Sai só uma asserção, a que cobrava a regra antiga ("total diferente depois do eSocial sempre recusa") |
| Postgres real (`embedded-postgres` 18.6, descartável no D:), 001 a 007 e 011, duas e três conexões | 9 corridas (C1 a C9), 5 testes de roteiro (R1 a R5) |
| Postgres real, relógio de Brasília simulado na virada de 30/11 para 01/12 | 6 casos (V1 a V6) |

`node_modules` copiado de `D:\rh-work\f3fix` com `robocopy` (o `package-lock.json` tem o mesmo SHA-256),
sem `npm ci` e sem `npx`. O `embedded-postgres` usado foi o que já estava instalado em
`D:\rh-work\pg\node_modules`. Não baixei nada. Nenhuma escrita em banco real, nenhum commit, nenhuma tela
logada, sem build.

## 1. B1: o total corrige até o primeiro salário enviado

### Corridas (Postgres real)

Cenário: competência com eSocial registrado e total de 1.000,00. Em todas as corridas, A abre a
transação e não confirma, e B roda na outra conexão.

| # | Corrida | B esperou A? | Desfecho |
|---|---|---|---|
| C1 | A corrige o total, B reserva a chave do salário | Sim | A grava o total novo, depois B reserva. O total foi corrigido **antes** do envio, que é o desenho |
| C2 | A reserva a chave, B corrige o total | Sim | B relê a linha já reservada e **recusa** com a mensagem nova. O total fica o antigo |
| C3 | A reserva e desfaz, B corrige o total | Sim | B grava o total novo, porque o salário voltou a ser rascunho |
| C4 | A corrige o total. Antes do commit, outra conexão **insere** um salário novo e o reserva | Não | **A reserva passa, e o total novo entra depois dela.** Ver F1 |
| C4b | O mesmo insert, com a chave estrangeira ligada | Não espera | O insert não bloqueia: `KEY SHARE` não conflita com o `NO KEY UPDATE` da competência |
| C5 | Dois totais diferentes | Sim | Serializa, vale o último. Sem salário enviado é o comportamento esperado |
| C6 | Corrigir o total contra `rh_nova_tentativa` | Sim | Sem deadlock. A tentativa 2 nasce depois |
| C7 | Corrigir o total contra `for update` na competência (o que `rh_registrar_esocial` faz) | Sim | Só serializa, sem deadlock |
| C8 | Tentativa 1 cancelada no Financeiro e tentativa 2 em rascunho | — | **Trava.** A linha antiga tem `chave_em_uso` e `financeiro_id`. Fecha mais do que precisa, mas falha fechado |
| C9 | FGTS, VR e VR adicional com a chave em uso, salário em rascunho | — | O total corrige. É o filtro por `salario` funcionando |

**Deadlock.** Procurei a ordem inversa: alguém que trave uma linha de pagamento e depois peça a
competência num modo que conflite com `NO KEY UPDATE`. Nenhuma função faz isso:

- `rh_salvar_rascunho` e `rh_nova_tentativa` só pedem `KEY SHARE`, pela chave estrangeira do insert.
- `rh_reservar_envio`, `rh_registrar_envio` e `rh_registrar_leitura` não tocam a competência.

Cada RPC é uma transação. Não achei deadlock alcançável pela app.

**O salário enviado pode ficar com um total diferente do que valia quando saiu?** Pelos caminhos C1,
C2 e C3, não. Pelo fantasma (C4), sim.

### O filtro por `salario` cobre tudo o que sai do total?

Sim. `total_relatorio_centavos` só é lido em três lugares:

- `app/(modulo)/pagamentos/folha/page.tsx:46`, para mostrar o total na tela da Folha CLT.
- A conferência da folha, em `lib/pagamentos/actions.ts:122-123` e `:265`, que compara a soma das
  linhas de **salário** com o total.
- `rh_obter_competencia`, em `004:734`.

FGTS, consignado, VR, VT, ajuda de custo e PJ vêm de guia ou de cálculo próprio. Nenhum é derivado do
total: não há percentual sobre a folha no código (`grep` por `0.08`, `fgts.*total` e afins deu vazio).

### Achados

**F1. Salário novo inserido e reservado durante a correção do total escapa do `for update` (BACKLOG).**
- **Onde:** `011_rh_ponto.sql:331-340`.
- **Cenário (medido, C4):** a conexão A corrige o total de 1.000,00 para 1.500,00 e ainda não
  confirmou. A conexão B insere um salário que não existia e o reserva, sem esperar. A confirma.
  Resultado: um salário com a chave em uso e um total trocado depois dele.
- **Por que não é bloqueio:** a janela é uma única chamada RPC, de milissegundos. O caminho real exige
  que outra pessoa grave um rascunho novo e já o envie dentro dela. E o valor do salário não sai do
  total: o total é a régua da conferência, não a base de cálculo.
- **Correção, se quiser fechar:** num gatilho do 011 em `rh_pagamentos`, ao virar `chave_em_uso` de
  falso para verdadeiro em `tipo = 'salario'`, ler a competência com `for share`. Esse modo conflita com
  o `NO KEY UPDATE` da correção do total, então a reserva espera a correção terminar e sai depois, como
  em C1. O 004 não muda.

**F2. A tentativa antiga, recusada ou cancelada, ainda segura o total (BACKLOG, falha fechado).**
- **Onde:** `011:334`. O filtro olha todas as tentativas.
- **Cenário (C8):** o salário de uma pessoa foi recusado no Financeiro, abriu-se a tentativa 2, e o
  relatório certo tem outro total. Trava, e a tela manda falar com quem cuida do sistema.
- **Por que fica assim:** um salário recusado já saiu uma vez com aquele total, então travar é
  defensável. Só registrar.

## 2. Roteiros SQL em `docs/DIVIDAS.md`

| # | Teste | Resultado |
|---|---|---|
| R1 | Roteiro do total, com salário enviado | Grava o total. O gatilho volta a `O` (ligado). A auditoria guarda 1 linha com o antes |
| R2 | O mesmo roteiro com erro no `update` (total negativo) | A transação aborta, o `commit` vira rollback, e o gatilho continua `O` |
| R2b | Erro e conexão encerrada sem rollback | Gatilho `O` |
| R3 | Escrita aberta na tabela | `lock timeout` em cerca de 6,9 s, nada muda, gatilho `O` |
| R4 | Desfazer o eSocial: `delete` com `rh_esocial_imutavel` desligado, numa transação | Passa. A linha some, o gatilho fica `O`, a auditoria não registra nada e o total volta a mudar livre |

**Correto e seguro?** Sim. `alter table ... disable trigger` é transacional no Postgres. Ele pega
`SHARE ROW EXCLUSIVE`, que barra as escritas de outras conexões até o `commit`. Se falha no meio, o
rollback desfaz o desligamento. O gatilho nunca fica desligado (medido em R2, R2b e R3).

**BACKLOG nos roteiros:**

- **F3. Autor da auditoria.** O roteiro do total grava a auditoria com `por = 'sistema'`: `rh_auditar`
  lê `rh.autor`, e o roteiro não o define. Acrescentar depois do `begin`:
  `select set_config('rh.autor', '<e-mail de quem autorizou>', true), set_config('rh.motivo', '<motivo>', true);`.
- **F4. A conferência prometida não está no SQL.** O comentário diz "Conferir antes: ... pagamentos de
  salário com chave em uso", mas o `select` só traz a competência. Acrescentar
  `select chave, chave_em_uso, financeiro_id, valor_centavos from public.rh_pagamentos where competencia_id = <id> and tipo = 'salario';`.
- **F5. Desfazer o eSocial não tem SQL escrito**, só "o mesmo desenho". O que testei (R4) funciona.
  Mas ele não desfaz os passos marcados por `rh_competencia_atualizar_auto`, nem a linha
  "Folha enviada ao eSocial: não reabre" do histórico, nem as correções já registradas para a
  competência seguinte. Escrever o SQL e listar isso no roteiro.

## 3. B6: mês futuro recusado, em Brasília, na virada

`rh_registrar_esocial` (`011:982-985`) compara com `rh_hoje()`, que é
`now() at time zone 'America/Sao_Paulo'` (006). Medi com o relógio simulado:

| # | Instante | Pedido | Resultado |
|---|---|---|---|
| V1 | 01/12 02:30 UTC (30/11 em Brasília) | dezembro | Recusa: "ainda não chegou" |
| V2 | o mesmo | `p_mes` = 15/12 | Recusa |
| V3 | o mesmo | novembro, envio em 30/11 | Passa a regra do mês e para nos passos 6.6 a 6.8 |
| V4 | o mesmo | novembro, envio em 01/12 | Recusa: data futura |
| V5 | o mesmo | janeiro do ano seguinte | Recusa |
| V6 | 01/12 03:00 UTC (01/12 em Brasília) | dezembro | Passa a regra do mês e para nos passos |

**A recusa vem antes de gravar qualquer coisa, e repetir o envio de um mês já registrado continua sem
efeito.** A tela (`competencia-registro.tsx:273`) usa a mesma regra: compara `mes` com
`emBrasiliaHoje().slice(0, 7)`. O texto de confirmação agora diz que o registro e a data só se desfazem
por SQL. Os dois têm teste de tela.

## 4. B7: homônimo fora do ponto

- **Nunca casa sozinho.** `lib/ponto/colar.ts:96-104`: `sozinho = iguais.length === 1 && !homonimoFora`.
  Com um único candidato ativo e um homônimo encerrado ou PJ, `colaborador_id` fica nulo e `candidatos`
  traz só o ativo. `loteCerto` recusa até alguém escolher, e `resolverEscolhas` só aceita id entre os
  candidatos. Há teste, inclusive para esse caso de um candidato só.
- **Na releitura do servidor.** `colarLancamentos` (`lib/ponto/actions.ts:75-82`) busca
  `listarPessoasDoPonto()` de novo e passa `foraDoPonto` do servidor. A prévia do navegador não vale.
  O teste da ação cobre: sem escolha recusa, com escolha grava.
- **`foraDoPonto` não vaza:** é só o nome (`lib/ponto/pessoas.ts:20`), sem cargo, id, CPF ou situação.
  Só vai ao navegador em `/ponto/colar`, que entrega o formulário apenas a quem tem `rh`
  (`podeEditarColaboradores` = `temPapel(sessao, "rh")`). `novo-lancamento` e `novo-atestado` chamam a
  mesma função mas não repassam o campo. `rh_listar_pessoas` não tem `limit`, então a lista vem
  completa.
- **BACKLOG F6:** a revisão sugeriu também mostrar o cargo da pessoa casada sozinha na prévia. Não foi
  feito, e é só conforto.

## 5. B2 e B4

**B2: um erro na leitura nova não esconde mais os cartões.** Em `app/(modulo)/pagamentos/page.tsx:106-111`,
com `erro`, `obterFolhaSituacao` devolve `folha: null`. A página mostra o aviso
"Não deu para carregar o andamento da competência agora" e, abaixo dele, `AbaPagamentos` (cartões,
pendências e "Abrir competência"). Some só a barra de abas, que precisa de `folha`. O caso "app nova
sem 011" cai aqui. A falha de `AbaPagamentos` em si (leituras do 004) continua com o erro de sempre.

**B4: nenhuma chamada nova à porta do Financeiro.** `TabelaCompetencias` agora renderiza
`<ReleituraAoAbrir mes={mesAtual} />`. É o mesmo componente da `Moldura`, que chama a mesma ação
`relerSituacoes(mes)`, e a mesma releitura que a entrada de `/pagamentos` fazia antes da F3. Só `rh` e
`diretoria` releem: os outros recebem `atualizados: 0`.

**BACKLOG F7 (só desenvolvimento):** a vitrine (`app/vitrine/_telas-ponto.tsx:354`) também renderiza
`TabelaCompetencias`. Agora ela dispara `relerSituacoes`, que chama `requireSessao()`, e sem sessão
isso dá `redirect`. Por leitura, a tela "competências" da vitrine deve ir para o login ao abrir. Não
rodei a vitrine para confirmar. Ela só abre com `RH_VITRINE=1` em desenvolvimento, então não afeta
produção. Correção: uma prop para desligar a releitura na vitrine.

## 6. B8 e regressão

**B8:** a prévia (`components/ponto/form-colar.tsx:55-65`) mostra as nove colunas gravadas por
`paraGravar`, mais a pessoa no título da linha: data, tipo, início, fim, gestor, ponto, escala e os
dois acionamentos. Zero aparece como 0, nulo como "—". Tem teste de tela.

**Regressão:** o mesmo conjunto de testes passa na base (645) e na branch (658). O diff toca só os 14
arquivos das correções, e as rotas `folha`, `guias`, `vr`, `vt`, `pj` e `ligar` não mudaram. O 011
muda só o corpo de `rh_competencia_nao_reabre` e a guarda nova de `rh_registrar_esocial`: sem tabela
nova, sem grant novo, e as duas mantêm `security definer`, `search_path` e `row_security = off`.
Nenhuma palavra de demissão nos textos novos.

## O que não consegui verificar

- **Versão do Postgres de produção:** as corridas foram em 18.6. A semântica de `for update` e de
  `KEY SHARE` contra `NO KEY UPDATE` em READ COMMITTED é a mesma desde a 9.3, mas não testei na versão
  do Supabase.
- **Vitrine (F7)** e as telas logadas: só leitura de código e testes de tela.
- **O roteiro no editor SQL do Supabase:** testei mandando o script inteiro numa consulta pelo `pg`,
  que é como o editor envia. O editor em si eu não testei.

## Limpeza

Ao fim, removi o clone `D:\rh-work\rev-f3fix` e a pasta `D:\rh-work\pg-revf3fix` (scripts e dados
descartáveis). Nenhum Postgres ficou rodando. `D:\rh-work\f3fix` e `D:\rh-work\pg` não foram
alterados. Sem commit deste relatório.
