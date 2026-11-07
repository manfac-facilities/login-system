# RH: spec dos módulos restantes (06/11/2026)

**Fontes:** `docs/cliente/2026-11-05-rh-atividades-rh-dp.md`, `docs/cliente/2026-11-05-rh-direcao-do-joao.md`,
`docs/cliente/2026-11-06-rh-feedback-mockup-modulos.md`, `docs/rh/2026-11-05-proposta-fases-e-decisoes.md`,
`docs/rh/2026-11-05-impacto-respostas-do-cliente.md`, `docs/rh/descoberta-integracoes-2026-11-05.md`.
Desenho vigente: `docs/rh/mockups/2026-11-06-rh-modulos.html`. Código lido: repositório `rh`, branch `rh-modulos` (`ae64ed3`).
Plano: `docs/superpowers/plans/2026-11-06-rh-modulos.md`.

**Situação da aprovação:** o João mandou seguir sem esperar o cliente. O mockup refeito é o desenho vigente, e as 10 suposições dele
valem até serem vetadas. As decisões marcadas **[S]** são do autor desta spec, tomadas sem perguntar, e ficam abertas a veto.

**Regra de reconciliação:** o código real manda no que já existe, o mockup manda no que é novo. As divergências estão na seção 3.

---

## 1. Objetivo e forma do produto

O RH deixa de ser cadastro mais pagamentos e cobre as 18 áreas do documento do cliente. O cliente reprovou a forma de rotina ("tem que ter
módulo, carinha de sistema"), portanto:

- Cada módulo tem a mesma cara: indicadores, busca, filtros, tabela, página do registro.
- Etapas são detalhe dentro do registro, numa aba ou painel "Andamento". Nunca são a tela de entrada.
- A ficha da pessoa junta tudo o que existe sobre ela, em abas.
- O sistema funciona em celular, tablet, notebook e monitor largo. Conferir os quatro faz parte do pronto de cada tela.

## 2. Suposições do mockup (valem até veto)

| # | Suposição | Consequência nesta spec |
|---|---|---|
| 1 | O gestor não entra no sistema | Ele responde por e-mail; o RH registra a resposta. Nenhum papel `gestor`. `gestor_id` é só referência |
| 2 | Senha de portão fica fora | A Agenda só lembra. A obrigação `senhas_portao` não aceita observação, e nenhuma coluna guarda senha |
| 3 | Contrato PJ mora no RH | `rh_contratos_pj`. Nada lê `frn_*` |
| 4 | Ponto vem de relatório exportado | Sem API do VR Ponto. O arquivo é anexado e os lançamentos são digitados ou colados |
| 5 | Patrimônio mora no RH | `rh_patrimonio_*`. Compras segue com estoque e compra |
| 6 | WhatsApp é manual | Só copiar texto. Nenhuma chamada externa |
| 7 | E-mail corporativo precisa estar no cadastro | A coluna já existe desde o 004 (D5). Falta preencher: tela de preenchimento em lote em F1 |
| 8 | Seguro e Celular exigem ajustes no Financeiro | Seção 12 |
| 9 | Currículo é guardado por 12 meses depois do fim da vaga | Constante única `RETENCAO_CURRICULO_MESES = 12`. A remoção é feita por uma pessoa (seção 6, Recrutamento) |
| 10 | Arquivo de atestado só abre para Controladoria/RH | Vale também para CID e ASO. Classe `saude` (seção 8) |

## 3. Divergências entre mockup e código

| # | Mockup | Código real | Decisão |
|---|---|---|---|
| D1 | Barra lateral, barra inferior no celular, busca geral | Cabeçalho com abas em `app/(modulo)/layout.tsx`, largura `max-w-6xl` | Troca de moldura é a primeira tarefa (F0). Vale a moldura do mockup, com o tema do `globals.css` |
| D2 | Início é a raiz, Pessoas é um módulo | `/` é a lista de colaboradores e `/[id]` é a ficha | `/` vira Início, a lista vai para `/pessoas`, a ficha para `/pessoas/[id]`. `/[id]` redireciona, para não quebrar link salvo |
| D3 | Situações "Pago pelo Financeiro", indicador "Pagos", competência "Paga pelo Financeiro" | A porta não informa pagamento; a tela mostra até "Lançada" (`lib/pagamentos/rotulos.ts`, `CLAUDE.md` 06/11) | **Código manda.** O indicador vira "Lançados no Financeiro" e nada diz "pago" |
| D4 | Ficha mostra chave PIX; obrigação "atualizar planilha de chaves PIX" | O RH não guarda chave; só tipo e final lidos do catálogo | **Código manda.** A ficha mostra tipo e final a `rh` e `diretoria`. A obrigação 17.3 vira "Conferir quem está sem chave PIX no Omie", com link para `/pagamentos/ligar` |
| D5 | Suposição 7 diz que o e-mail não existe no cadastro | `rh_colaboradores.email` existe desde o 004, com campo no formulário. `rh_listar_colaboradores` não o devolve | Nova leitura `rh_listar_pessoas` devolve e-mail, gestor e equipe. A lista velha fica para não mudar assinatura |
| D6 | Vínculo só CLT ou PJ | `tipo_contratacao`: `clt, pj, estagio, extra, socio` | **Código manda.** Filtro com os cinco rótulos. Regras de CLT e PJ testam o valor exato |
| D7 | Situação "Férias" e "Afastamento" no cadastro | `status`: `ativo, desligado, afastado` | `status` não ganha valor. "Em férias" é derivado do gozo em curso, só na tela. "Afastado" é o valor existente |
| D8 | Gestor e equipe na pessoa | Colunas não existem | Aditivo: `gestor_id` e `equipe` no 006 |
| D9 | Centro de custo único na admissão e na vaga | Rateio por vigência, percentual, por código de departamento do Omie | **Código manda.** Admissão e alteração usam `EditorRateio`; a vaga guarda só o código de departamento sugerido |
| D10 | Um pagamento agregado "Salários CLT" com composição | Uma solicitação por pessoa, agrupada em `GRUPOS` | **Código manda.** A linha da tabela é o grupo; "Composição" lista as linhas reais de `rh_pagamentos` |
| D11 | VR para todo CLT, "Boleto no dia 10", FGTS como 8% do salário, consignado fixo | `recebe_vr`, ausências digitadas, valor da cobrança manda, forma QR, chave ou boleto, guia vem do relatório | **Código manda.** Benefícios lê `recebe_vr` e `/pagamentos/vr`. Nenhum cálculo do mockup vai para o produto |
| D12 | VT e ajuda como solicitação mensal com valor | `ajuda_tipo`, `ajuda_centavos`, `ajuda_forma` na ficha, recorrentes | A solicitação vira registro de acompanhamento e não muda cadastro. Mudar o valor recorrente é uma alteração. O pagamento continua lendo a ficha |
| D13 | Contrato com valor próprio; "Não emite hoje" fixo no texto | PJ é pago por `salario_centavos`; existe `emite_nota` | O contrato **não** tem coluna de valor: mostra `salario_centavos`. Aditivo de valor abre uma alteração. A tela lê `emite_nota` |
| D14 | Veículo "vem da Frotas", item só leitura | Regra 4 do `CLAUDE.md`: só pode ler dois catálogos do Financeiro e `hub_user_roles`. `motoristas` não tem CPF | **Regra manda.** Nenhuma leitura da Frotas e nenhum item tipo Veículo. 2.7.3 é decisão na admissão, com texto "pedir à Frotas" |
| D15 | Mockup supõe que só a movimentação muda cadastro, mas mantém "Novo colaborador" | Hoje `/novo`, `/importar`, formulário e editor de rateio da ficha gravam direto | Seção 5. Tudo isso sai da interface em F1 e uma trava no banco garante |
| D16 | Anexos simulados | O 004 não guarda arquivo (repassa ao Financeiro) e o teste de segurança proíbe criar pasta por SQL | Seção 8 |
| D17 | E-mails simulados | Sem SMTP nem `nodemailer` no RH; Financeiro e Compras têm | Seção 11 |
| D18 | Tokens de cor próprios | Paleta da marca e tema em `app/globals.css`, com `next-themes` | **Código manda.** O mockup define só o layout |
| D19 | Sem Papéis, sem Sair, sem visão de admin | `/papeis` para admin, botão Sair, admin consulta sem valor | **Código manda.** Papéis e Sair ficam no pé da lateral e no menu |
| D20 | "Exame de encerramento", "Encerramento de vínculo" | Formulário e rótulo dizem "Desligamento" e "Desligado" | Rótulos mudam para "Fim do vínculo" e "Vínculo encerrado". O valor e a coluna no banco continuam |
| D21 | Divergências de ponto aparecem prontas, sem entrada de dados | Sem API, ninguém as criaria | Acrescenta "Novo lançamento" e "Colar lista" ao Ponto |
| D22 | Competência com situações livres | `rh_competencias.situacao`: `aberta, fechada` | **Código manda.** A situação de tela deriva da competência e de suas solicitações |
| D23 | CPF obrigatório no candidato | LGPD: quem não for aprovado não precisa ter CPF guardado | **[S]** Opcional no candidato, obrigatório ao aprovar |
| D24 | `Termo gerado` sem conteúdo | Não há modelo jurídico | **[S]** Página de impressão com texto curto, e o assinado volta por anexo. O texto precisa de leitura da empresa (seção 15) |
| D25 | O pedido fala em CHECK do Financeiro para `seguro` e `celular` | O 047 só altera o CHECK de `origem`. `tipo` é lista em TypeScript (`TIPOS_RH`, `LISTA_PERMITIDA`). O CHECK de `tipo` e de `forma` está em `rh_pagamentos`, no RH | No Financeiro muda só código, sem migration. O CHECK muda no RH, no 015 |

---

## 4. Decisões sobre os pontos reprovados

### 4.1 "Marcar como feito" genérico

O botão genérico sai. Todo passo é de um destes tipos, gravado em `rh_etapas.exige`:

| `exige` | O que a tela pede | Exemplo |
|---|---|---|
| `auto` | Nada. O sistema marca quando o fato acontece; não há botão | 2.1, 9.2, 13.7 |
| `data` | Data | 2.13 |
| `texto` | Texto curto, em geral o número do chamado da contabilidade | 2.4 |
| `arquivo` | Ao menos um anexo ligado ao passo | 2.3, 14.7 |
| `escolha` | Uma opção de uma lista | 2.6 |
| `modulo` | Link para o módulo responsável, com registro depois de conferir | 2.11, 11.5 |
| `confirmacao` | Botão com o verbo do passo ("Registrar envio"). Grava quem e quando | 2.8 |

"Não se aplica" só existe em passo `opcional`, com motivo escrito. Um teste de texto proíbe a expressão "Marcar como feito" nas telas de registro.
A obrigação da Agenda usa "Registrar".

**Passos que pedem dado real.** Os não listados são `confirmacao`.

| Modelo | Passos |
|---|---|
| Admissão | `auto`: 2.1, 2.7 (os 9 recursos decididos), 2.15. `arquivo`: 2.3, 2.6.3 (classe `saude`). `texto`: 2.4. `escolha`: 2.6 (precisa ou não; "não" marca 2.6.1 a 2.6.5 como não se aplica). `data`: 2.6.1, 2.13. `modulo`: 2.5 e 2.5.1 (Benefícios), 2.11 e 2.17 (Patrimônio), 2.16 (Comunicação), 2.18 (Seguro) |
| Alteração | `auto`: 9.1 (ao abrir), 9.2 (aprovação), 9.3, 9.4, 9.7. `texto`: 9.5 |
| Encerramento | `auto`: 11.1, 5.3, 6.2. `texto`: 11.2, 11.3. `modulo`: 11.4 (Ponto), 11.5 (Exames), 13.3 (Seguro), 10.10 (Contratos), 10.11 (Patrimônio). `arquivo`: 11.8 |
| Férias | `auto`: 8.5, 8.12, 8.14. `texto`: 8.6 (resposta do gestor), 8.7. `arquivo`: 8.9, 8.10. `modulo`: 8.13 (Ponto) |
| Exame | `data`: 14.5. `arquivo`: 14.7 (classe `saude`), 14.11 (só PJ). `auto`: 14.10 (exige nova validade) |
| Contrato | `arquivo`: 10.5, 10.7 |
| Fechamento | `texto`: 3.10 |
| Competência | `auto`: 6.1, 6.2, 6.11. `modulo`: 6.3, 6.4, 6.5. `arquivo`: 6.8. `texto`: 6.6, 6.7, 6.9 |
| Atestado | `arquivo`: 7.1 (classe `saude`). `auto`: 7.3. `modulo`: 7.8, 7.9 |
| Seguro | `auto`: 13.4 (ao baixar a planilha), 13.7 (ao criar a solicitação) |
| Celular | `auto`: 18.8 |
| VR | `auto`: 15.3, 15.7. `modulo`: 15.4. `texto`: 15.6 |
| VT e ajuda | `auto`: 16.1, 16.5. `texto`: 16.2. `modulo`: 16.3, 16.4 |
| Campanha | `texto`: 12.1.1. `auto`: 12.1.2. `arquivo`: 12.1.3 |
| Comunicado | `auto`: 12.2.1, 12.2.3. `texto`: 12.2.2 |
| Evento | `auto`: 12.3.1 a 12.3.6, conforme os campos preenchidos |
| Vaga | `auto`: 1.1, 1.2. `texto`: 1.3 (canais) |
| Candidato | `arquivo`: 1.4. `data`: 1.6, 1.11. `texto`: 1.9, 1.12. `auto`: 1.13 |

**Passo `modulo` nunca se marca sozinho.** Isso evita acoplar tabelas de módulos que nascem em frentes diferentes. O que o outro módulo sabe aparece ao lado, como
informação, vindo do registro da seção 7.5.

### 4.2 "Novo colaborador" e "Nova admissão"

**Uma porta só: "Nova admissão".** `/novo` redireciona para `/movimentacoes/nova-admissao`.

- O cadastro de hoje tem uma coisa boa: a busca no catálogo do Omie preenche nome, CPF e fornecedor. `BuscaFornecedor` passa para o formulário de admissão.
- O caso que justificava a segunda porta, "já trabalha aqui", vira a opção **"Já está trabalhando"** no mesmo formulário: aceita início no passado, usa o modelo curto
  (2.1 e 2.15) e conclui na mesma tela. O registro fica como admissão, com trilha.
- Por quê: duas portas gravariam a mesma coisa por dois caminhos, e o cadastro direto escaparia da regra de que só a movimentação muda o cadastro.

**CPF que já existe:** ativo ou afastado recusa, com link para a ficha. Com vínculo encerrado, a admissão vira **readmissão**, usa a mesma linha (CPF é único) e pede
confirmação escrita na tela. A data de admissão antiga fica na auditoria. Ver risco na seção 16.

### 4.3 Alteração sem aprovação

**Regra: alteração material sem aprovação registrada não conclui.** A trava está no banco (`RH_GUARD`), não só na tela, e o botão fica desabilitado com o motivo à vista.

| Muda | Material? | Vigência |
|---|---|---|
| Salário, valor de VT ou ajuda, `recebe_vr`, `emite_nota` | Sim | Dia 1 |
| Rateio | Sim | Dia 1 (regra 11) |
| Cargo, vínculo, situação (ativo e afastado), CPF | Sim | Qualquer dia |
| Encerramento de vínculo | Sim | Data do fim |
| E-mail, equipe, gestor, grafia do nome | Não | Imediata, conclui sem aprovação |

Aprovação é `aprovado_por` (texto, porque o gestor não tem conta), `aprovado_em` (não pode ser futura) e observação. O aprovador não pode ser a própria pessoa da alteração
(nome normalizado igual recusa). **[S]** Comprovante anexo é opcional. A admissão não exige aprovação, porque nasce de vaga aprovada ou dos dados confirmados em 2.1.

### 4.4 Tablet com lateral em ícones

Faixa de 641 a 1099 px:

- Cada item tem `aria-label` com o nome, e o contador entra nele: "Ponto, 3 pendências". O mockup escondia o contador nessa faixa; aqui ele vira um ponto colorido.
- Dica visível ao passar o mouse e ao focar pelo teclado (`title` não aparece no toque nem no foco).
- O primeiro botão da lateral, "Módulos", abre o menu com nomes e contadores. É o jeito de ver os nomes no toque.
- Rótulos dos grupos ficam só no menu.

### 4.5 Fim de vínculo fora do modelo

O processo real existe: **tipo `encerramento` de `rh_movimentacoes`, iniciado só pela ficha**, botão "Encerramento de vínculo" em ações secundárias, para `rh`.

- Módulo Admissões e alterações ganha a aba "Encerramentos" sem botão "Novo"; o vazio explica que começa pela ficha. "Modelos" continua existindo.
- Passos do modelo `t-enc` do mockup, incluindo 13.3, 5.3, 6.2, 10.10, 10.11 e 10.12. Em PJ, 11.2 a 11.5 nascem como não se aplica. Em CLT, 10.10 a 10.12 idem.
- **Ao concluir:** `status = 'desligado'` (valor já existente, CHECK do 002, linha 38) e `desligamento` = data do fim. Data futura fica `agendada` e aplica no dia. O status na tela diz "Vínculo encerrado".
- **Antes de concluir, a tela lista o que está em aberto** com a pessoa: itens de patrimônio, contrato vigente, relação de segurados, banco de horas diferente de zero. Havendo
  algo, exige motivo escrito de 10 ou mais caracteres, gravado em `pendencias_no_fim`. Não bloqueia, porque o fim do vínculo tem data legal; nada fica em silêncio.
- **Depois:** 5.3 sai sozinho (a Relação de ativos filtra por `status`); 6.2 aparece na competência do mês como "Reunir os dados de encerramentos"; 13.3 aparece em Seguro como exclusão a pedir;
  10.10 é "Dar baixa" em Contratos; 10.11 aparece em Patrimônio como devolução pendente.
- **Acessos (11.7, 10.12):** o RH não escreve em `hub_system_access` e não pode lê-la. O passo prepara o texto para o admin do hub, e a tela avisa se a pessoa tem papel ativo em `rh_papeis`.
  **[S]** Não revoga sozinho; a revogação segue em `/papeis`.

### 4.6 Lista de Pessoas perdendo coluna

A causa está em o mockup decidir colunas pela largura da janela, sem contar o painel lateral: a 1600 px sobram cerca de 890 px para a tabela, e `overflow-x` esconde o e-mail.

**Regra: a tabela nunca rola nem corta na horizontal.**

1. Colunas têm prioridade e largura declaradas, e a visibilidade é por **container query**, medindo a área real da tabela.
2. Painel lateral de lista só aparece com a área de conteúdo em 1560 px ou mais (janela de cerca de 1900 px). Abaixo disso, ele fica escondido, e o conteúdo está na Agenda.
3. O que não cabe sai por prioridade, de forma declarada, e sempre está na página do registro. E-mail tem prioridade 2 na lista de Pessoas, CPF e início 3.
4. Teste puro, por tabela: em cada faixa de largura, a soma das colunas visíveis cabe na faixa (`conferirLarguras`).

---

## 5. A regra de ouro: só a movimentação muda o cadastro

**Concluir uma movimentação é a única operação que muda dado de pessoa.** Isso é território de borda do `AGENTS.md` do hub.

### O que sai da interface em F1

| Hoje | Depois |
|---|---|
| `/novo` | Redireciona para Nova admissão |
| `/importar` e `importarColaboradores` | Saem; a rota redireciona para `/pessoas`. `rh_importar` fica no banco, sem chamador, e a trava a recusa |
| Formulário editável da ficha, `salvarColaborador` | A ficha só exibe; "Nova alteração" leva ao formulário |
| `EditorRateio` na ficha, `salvarRateio` | Editor passa para o formulário da alteração |
| Preencher e-mails dos 50 | `/pessoas/emails`: uma movimentação concluída por pessoa, só onde está vazio |

**Exceção mantida, por ser código existente:** `rh_ligar_fornecedores_por_cpf` e `rh_ligar_fornecedor_pj` gravam `fornecedor_omie_codigo`, com motivo e auditoria. É ligação a catálogo, e a trava não a cobre.

### A trava no banco

Gatilho `rh_colaboradores_so_por_movimentacao` (`before insert or update`) e `rh_rateios_so_por_movimentacao` (`before insert or update or delete`): se mudar `cpf, nome, cargo, tipo_contratacao,
admissao, desligamento, status, salario_centavos, email, emite_nota, recebe_vr, ajuda_tipo, ajuda_centavos, ajuda_forma, gestor_id, equipe` ou qualquer linha de rateio, e
`current_setting('rh.via_movimentacao', true)` não for `'1'`, levanta `RH_GUARD: isso só muda por uma alteração`.

Só as funções do 006 ligam a marca, com `set_config(..., true)`, válida até o fim da transação. O PostgREST não permite duas instruções na mesma transação, então ninguém a liga por fora.

### Função `rh_concluir_movimentacao(p_autor, p_id, p_atualizado_em)`

**Transacional:** uma função, uma transação. **Idempotente:** já `concluida` ou `agendada` devolve o resultado anterior com `ja_concluida = true` e não grava nada, mesmo com carimbo velho.
**Auditada:** `rh_auditar` grava antes e depois, com `rh.autor` e `rh.motivo = 'movimentação <id>'`, mais uma linha em `rh_historico`.

Ordem, tudo com `RH_GUARD` e nada parcial:

1. `rh_autor_rh(p_autor)`, depois `select ... for update` na movimentação e, havendo colaborador, na linha dele.
2. Carimbo `atualizado_em` igual ao da tela.
3. Passos obrigatórios todos `feita` ou `nao_aplica`.
4. Aprovação, se material (4.3).
5. **Comparação com a foto:** para cada campo em `dados`, o valor atual do cadastro tem de ser igual a `de`. Diferente: "o cadastro mudou desde que esta alteração foi aberta; confira e abra de novo". Nunca sobrescreve.
6. Validação: salário em centavos inteiros, rateio com soma 100,00 e vigência no dia 1, centro de custo existente, CPF válido e sem repetir.
7. `vigencia` depois de hoje (Brasília): `situacao = 'agendada'`. Senão, aplica agora e `situacao = 'concluida'`.

**Aplicar:** `rh_aplicar_movimentacao` faz `update` direto, sem `rh_salvar_colaborador`, porque o agendador não tem autor com papel. Grava `rh.autor` com quem concluiu. Na admissão, faz o `insert`, ou o `update` da readmissão,
e grava o rateio inicial. `recebe_vr` segue a regra existente: CLT recebe, salvo marcação.

### Vigência futura

`salario_centavos` é sempre o valor vigente, porque o Orçamento o lê. Portanto o valor só muda na data.

- Agendador `rh-aplicar-vigencias` (`5 3 * * *`, 00:05 em Brasília) chama `rh_aplicar_vigencias()`, que passa por cada `agendada` vencida numa transação curta.
- Se a comparação com a foto falhar, a linha fica `agendada`, com `erro_aplicacao`. Não sobrescreve.
- **Se o agendador parar, ninguém fica sem saber:** Início mostra "N alterações vencidas sem aplicar", com botão "Aplicar agora" para `rh`.
- `agendada` pode ser cancelada com motivo. Depois de aplicada, corrige-se com outra alteração.
- O rateio também aplica na vigência (**[S]**), para o cancelamento ser limpo. Efeito na seção 16.

### O que não muda

`status` e `tipo_contratacao` sem valor novo. `salario_centavos` sempre o vigente, nunca o líquido. Nenhuma coluna lida pelo Orçamento é renomeada. A conclusão **não escreve em tabela de outro módulo do RH**: férias, seguro, patrimônio e
os demais derivam suas pendências de `rh_movimentacoes` e de `rh_colaboradores`.

---

## 6. Escopo por módulo

Todo módulo tem indicadores, busca, filtros, tabela, página do registro, estados de carregando, vazio e erro, e os quatro comportamentos da seção 9.

### Início (`/`), F1
**Entra:** saudação com o nome da sessão; 8 indicadores (ativos CLT, ativos PJ, férias, exames, contratos, admissões, vagas, devoluções); "Precisa de você" (até 7, por prazo); "Próximos dias" (até 7); atalhos de módulos; alerta de alteração não aplicada. Cada dado vem do módulo pelo registro da seção 7.5.
**Fica de fora:** gráfico, painel configurável. Módulo não ligado não aparece nem conta.

### Pessoas (`/pessoas`), F1
**Entra:** lista com filtros de vínculo, centro de custo, situação, sem e-mail; aba "Relação de ativos do mês" (5.1, 5.2, 17.1, 17.2); ficha com abas Dados, Férias, Exames, Ponto, Benefícios, Pagamentos, Patrimônio, Documentos, Histórico; preenchimento de e-mails em lote; ações Nova alteração e Encerramento de vínculo.
**Fica de fora:** foto da pessoa, portal do colaborador, salário com histórico próprio (a movimentação é o histórico; ver Dívidas). Na ficha de PJ, Férias e Ponto dizem que não se aplicam.

### Admissões e alterações (`/movimentacoes`), F1
**Entra:** áreas 2, 9 e 11 mais 13.3, 5.3, 6.2, 10.10 a 10.12; abas Admissões, Alterações, Encerramentos, Modelos; os 9 recursos decididos por registro; concluir com "o que acontece" e "o que não muda", como no mockup.
**Fica de fora:** criar conta e acesso no hub (só texto para o admin), cálculo de rescisão (é da contabilidade), geração de contrato de trabalho.

### Agenda (`/agenda`), F1
**Entra:** visão de mês e de lista, filtro por módulo, lembretes, "Obrigações do mês" (17.1 a 17.6 e o prazo do dia 25), "Conferir e salvar versão", com foto imutável sem valor e sem CPF.
**Fica de fora:** sincronizar com Google Agenda, avisos automáticos por data.

### Férias (`/ferias`), F2
**Entra:** área 8; períodos com aquisitivo, limite e saldo; faixas de vencimento; solicitação com início e dias (de 5 a 30, cabendo no saldo, sem data passada); "Avisar gestor"; gozos parciais.
**Geração:** `rh_gerar_periodos_ferias` cria, para CLT ativo com admissão, só o último período completo e o aberto (**[S]**). Criar o passado inteiro mostraria falsos vencidos. Saldo nasce com `saldo_conferido = false` e a etiqueta "Saldo a conferir" até o RH confirmar.
**Fica de fora:** cálculo de valor de férias, regra legal de fracionamento além do mockup (ver Dívidas), assinatura eletrônica.

### Exames (`/exames`), F2
**Entra:** área 14; vencimentos por faixa; tipos periódico, admissional, retorno, mudança, encerramento; pedido mensal ao SESMT (obrigação `sesmt_aso`); arquivo classe `saude`; ao arquivar, exige nova validade.
**Fica de fora:** integração com clínica ou SESMT.

### Contratos PJ (`/contratos`), F2
**Entra:** área 10; vigência; aditivo de vigência (grava aqui); aditivo de valor (abre alteração de salário com aprovação e liga pelo `movimentacao_id`); aviso ao gestor; "Dar baixa" (10.10).
**Fica de fora:** gerador de contrato, ler `frn_*`, leitura automática da nota (já decidido no spec de pagamentos).

### Ponto (`/ponto`), F3
**Entra:** áreas 3, 4 e 7; abas Por período, Por pessoa, Banco de horas, Atestados, Fechamento; relatório do VR Ponto anexado; "Novo lançamento" e "Colar lista" com colunas fixas; comparação gestor, ponto e escala; marcações; conferências semanais; atestados; fechamento de 25 a 24 ligado à competência.
**Divergência:** aberta se gestor, ponto e escala diferem, ou se os acionamentos diferem. "Registrar a decisão" fecha, com horas no formato `01:30`.
**Atestado tipo afastamento** não muda `status` sozinho: a tela oferece "Abrir alteração de situação".
**Fica de fora:** API do VR Ponto, cruzamento com o Cockpit, leitura automática do relatório (não vi um arquivo real).

### Folha e pagamentos (`/pagamentos`), F0 e F3
**Em F0:** só muda a moldura; rotas iguais. **Em F3:** tabela de competências e registro da competência com abas Pagamentos, Andamento (área 6), Documentos, Histórico.
**Fica de fora:** tudo do spec de pagamentos segue como está. **6.13 (contracheque):** só registro; nada é enviado, porque não lemos os PDFs (**[S]**). **6.12:** registro com arquivo; o passo não leva nome de pessoa, e sim "diretoria".

### Benefícios (`/beneficios`), F6
**Entra:** áreas 15 e 16; elegíveis por `recebe_vr`; registro do crédito do mês, ligado à competência; pedidos de alteração no VR (15.2); solicitações de VT e ajuda (D12); sugestão de ausências para `/pagamentos/vr`, vinda de férias e atestados pelo registro de módulos (o RH confirma; nada é preenchido em silêncio; módulo ainda não ligado apenas não contribui).
**Fica de fora:** API do VR.

### Seguro de vida e Celular (`/pagamentos/seguro`, `/pagamentos/celular`), F6
**Seguro:** área 13; relação de segurados; inclusões e exclusões a pedir, derivadas das movimentações; planilha CSV gerada para o RH enviar à seguradora até o dia 25 (só `rh`; registra o download); pendências; boleto com valor e código; solicitação ao Financeiro com rateio pelos segurados.
**Celular:** 18.8; linhas, responsáveis, valor por linha; linha sem responsável bloqueia; rateio pelo responsável.
**Fica de fora:** envio à seguradora, leitura do boleto.

### Patrimônio (`/patrimonio`), F4
**Entra:** área 18 menos 18.8; itens com código `PAT-0001`; tipos Notebook, Celular, Ferramentas, Crachá, Uniforme, Outro; entrega, devolução, transferência, localização, baixa; termos com página de impressão e anexo do assinado; devolução pendente.
**Fica de fora:** veículo (D14), estoque e compra (Compras), depreciação.

### Recrutamento (`/recrutamento`), F5
**Entra:** área 1; vagas; quadro de candidatos por etapa (Triagem, Entrevista RH, Gestor, Decisão); "Aprovar e criar a admissão" em transação (`rh_aprovar_candidato`), sem redigitar; "Não seguir" com motivo; mensagem de resultado por copiar.
**Remoção de currículos:** indicador "N currículos a apagar" e botão "Apagar agora" para `rh`. `rh_apagar_curriculos_vencidos` marca, apaga dados do candidato e devolve os caminhos; o servidor remove da pasta. Por uma pessoa, e não por agendador, porque apagar dado é território de borda e SQL não pode apagar de `storage.objects`.
**Fica de fora:** portal do candidato, divulgação automática, agenda de entrevistas integrada.

### Comunicação (`/comunicacao`), F5
**Entra:** área 12; campanhas, comunicados, eventos; artes como anexo; "Copiar texto para o WhatsApp"; envio por e-mail a quem tem e-mail, em lotes de 5, com `rh_avisos` por destinatário e chave única, e reenvio só para quem falhou; orçamento do evento só para `rh` e `diretoria`.
**Fica de fora:** WhatsApp automático, ponte com comunicados do hub, gráfica.

---

## 7. Banco de dados

Todas as migrations seguem as regras do `CLAUDE.md` do RH: `NNN_rh_*.sql`, tabelas e funções `rh_*`, RLS ligada (nunca `force`), `revoke all ... from anon, authenticated`, `security definer` com `set search_path = public, pg_temp` e `set row_security = off`, chave estrangeira só para `public.rh_*`,
trava `RH_GUARD:`, `lock_timeout` logo depois do `begin`, nada escrito fora de `rh_*`, verificação por invariantes no fim. **Sem policy em nenhuma tabela nova, como no 004:** logado não lê tabela; só funções.

**Padrão de função:** leitura por `rh_*` definer, confere `rh_pode_ver()` e decide a máscara, `grant` a `authenticated`. Escrita com `p_autor`, começa por `rh_autor_rh`, `grant` só a `service_role`. Toda tabela nova com `id uuid`, `criado_*`, `atualizado_*`, `rh_auditar`.

### 005_rh_modulos_base.sql (F0)

| Tabela | Colunas |
|---|---|
| `rh_etapas` | `registro_tipo` (texto `^[a-z_]+$`, sem lista fechada, para frentes paralelas), `registro_id uuid`, `ordem`, `atividade` ("2.6.1"), `titulo`, `grupo`, `quem`, `opcional`, `exige`, `destino`, `situacao` (`pendente, feita, nao_aplica`), `motivo`, `dados jsonb`, `feita_em`, `feita_por`. Único por tipo, registro e atividade |
| `rh_arquivos` | `registro_tipo`, `registro_id`, `etapa_id` (FK), `classe` (`geral, saude, curriculo`), `caminho` único, `nome_original`, `mime`, `tamanho`, `hash`, `criado_*`, `removido_em`, `removido_por`, `motivo_remocao` |
| `rh_historico` | `registro_tipo`, `registro_id`, `colaborador_id` (FK, nulo), `texto`, `sensivel`, `por`, `em`. Imutável. CHECK recusa padrão de CPF no texto. Regra: texto nunca leva valor, CID nem CPF |
| `rh_avisos` | `registro_tipo`, `registro_id`, `chave` única, `canal` (`email, manual`), `para`, `assunto`, `situacao` (`reservado, enviado, falhou, sem_configuracao, registrado_manual`), `erro_codigo`, `por`, `em` |

Funções: `rh_ve_saude()` (só papel `rh`), `rh_etapas_criar(p_autor, p_tipo, p_id, p_etapas)` (idempotente), `rh_etapa_registrar(p_autor, p_id, p_situacao, p_dados, p_motivo)` (valida `exige`; `auto` só por funções internas), `rh_etapas_listar(p_tipo, p_id)`, `rh_historico_gravar` (interna), `rh_historico_listar(p_tipo, p_id)`, `rh_historico_da_pessoa(p_id)`, `rh_arquivo_registrar`, `rh_arquivos_listar(p_tipo, p_id)`, `rh_arquivo_caminho(p_id)`, `rh_arquivo_marcar_removido`, `rh_aviso_reservar`, `rh_aviso_concluir`.

### 006_rh_pessoas_movimentacoes.sql (F1)

`rh_colaboradores`: `gestor_id uuid references rh_colaboradores(id)`, `equipe text`, com máximo de 80 caracteres.

`rh_movimentacoes`: `tipo` (`admissao, alteracao, encerramento`), `situacao` (`aberta, agendada, concluida, cancelada`), `colaborador_id` (FK, nulo só em admissão nova), `nome`, `cpf` (só admissão, 11 dígitos), `vigencia date`, `resumo` (sem valor: "Salário e rateio"), `de jsonb` (foto), `dados jsonb` (o novo), `ja_trabalhando boolean`, `recursos jsonb` (9 decisões), `origem_candidato_id uuid` (sem FK; o candidato nasce em 013), `aprovado_por`, `aprovado_em`, `aprovacao_obs`, `pendencias_no_fim jsonb`, `motivo_conclusao`, `concluida_em`, `concluida_por`, `aplicada_em`, `erro_aplicacao`, `cancelada_em`, `cancelada_por`, `motivo_cancelamento`, `criado_*`, `atualizado_*`.

Índices únicos parciais: admissão aberta por CPF; encerramento `aberta` ou `agendada` por colaborador. Gatilho `rh_movimentacao_travar`: depois de concluída, `dados`, `de` e `vigencia` não mudam. Máscara: `rh_movimentacao_no_json` tira `salario_centavos` e `ajuda_centavos` de `de` e `dados` para quem não vê salário.

Funções de escrita: `rh_abrir_admissao`, `rh_abrir_alteracao`, `rh_abrir_encerramento`, `rh_atualizar_movimentacao`, `rh_registrar_aprovacao`, `rh_concluir_movimentacao`, `rh_cancelar_movimentacao`, `rh_aplicar_movimentacao` (interna), `rh_aplicar_vigencias(p_hoje date default null)` (só `service_role`; o parâmetro existe para o teste), `rh_preencher_emails(p_autor, p_linhas)` (só onde está vazio, recusa e-mail repetido).
Leitura: `rh_listar_pessoas(p_busca, p_departamento, p_status, p_vinculo, p_sem_email)`, `rh_relacao_ativos(p_mes)`, `rh_listar_movimentacoes(p_tipo)`, `rh_obter_movimentacao(p_id)`, `rh_buscar_pessoas(p_texto)`, `rh_contar_movimentacoes()`.

Mais `select cron.schedule('rh-aplicar-vigencias', '5 3 * * *', $$ select public.rh_aplicar_vigencias() $$);`.

**Rótulos das abas da ficha** vivem em `lib/pessoas/abas.ts`. Nada no banco.

### 007_rh_agenda.sql (F1)

| Tabela | Colunas |
|---|---|
| `rh_lembretes` | `data`, `texto`, `feito_em`, `criado_*` |
| `rh_obrigacoes_feitas` | `mes`, `codigo`, `feito_em`, `feito_por`, `observacao`. Único por mês e código. CHECK: `senhas_portao` com `observacao` nula. A lista de obrigações é código (`lib/agenda/obrigacoes.ts`), sem geração mensal no banco |
| `rh_controles_versoes` | `mes`, `numero`, `foto jsonb` (sem valor e sem CPF), `observacao`, `por`, `em`. Imutável |

Funções: `rh_salvar_lembrete`, `rh_lembrete_feito`, `rh_registrar_obrigacao`, `rh_salvar_versao`, `rh_listar_lembretes(p_mes)`, `rh_listar_obrigacoes(p_mes)`, `rh_listar_versoes(p_mes)`.

### 008_rh_ferias.sql (F2)

`rh_ferias_periodos`: `colaborador_id` (FK), `aquisitivo_inicio`, `aquisitivo_fim`, `limite`, `direito_dias` (padrão 30), `saldo_conferido`. Único por colaborador e início.
`rh_ferias_gozos`: `periodo_id` (FK), `inicio`, `dias` (de 5 a 30), `situacao` (`solicitada, em_andamento, concluida, cancelada`). Saldo = direito menos gozos não cancelados, sempre calculado.
Funções: `rh_gerar_periodos_ferias`, `rh_conferir_saldo_ferias`, `rh_registrar_gozo`, `rh_cancelar_gozo`, `rh_listar_ferias`, `rh_obter_ferias(p_id)`, `rh_em_ferias(p_data)`, `rh_contar_ferias`, `rh_agenda_ferias(p_de, p_ate)`.

### 009_rh_exames.sql (F2)

`rh_exames`: `colaborador_id` (FK), `tipo`, `vencimento`, `clinica`, `agendado_para`, `situacao` (`aberto, arquivado`), `movimentacao_id` (FK, nulo).
Funções: `rh_salvar_exame`, `rh_arquivar_exame(p_autor, p_id, p_nova_validade)`, `rh_listar_exames`, `rh_obter_exame`, `rh_contar_exames`, `rh_agenda_exames`.

### 010_rh_contratos_pj.sql (F2)

`rh_contratos_pj`: `colaborador_id` (FK), `inicio`, `vencimento`, `situacao` (`vigente, encerrado`), `encerrado_em`. Sem coluna de valor (D13). Único parcial: um `vigente` por pessoa. CHECK vencimento depois do início.
`rh_contrato_aditivos`: `contrato_id` (FK), `tipo` (`vigencia, valor`), `de_data`, `para_data`, `movimentacao_id` (FK), `por`, `em`.
Funções: `rh_salvar_contrato` (só `tipo_contratacao = 'pj'`), `rh_aditivo_vigencia`, `rh_aditivo_valor` (abre a alteração), `rh_baixar_contrato`, `rh_listar_contratos`, `rh_obter_contrato`, `rh_contar_contratos`, `rh_agenda_contratos`.

### 011_rh_ponto.sql (F3)

| Tabela | Colunas |
|---|---|
| `rh_ponto_lancamentos` | `colaborador_id`, `data`, `tipo` (`hora_extra, plantao, compensacao`), `hora_inicio`, `hora_fim`, `gestor_minutos`, `ponto_minutos`, `escala_minutos`, `acionamentos_gestor`, `acionamentos_ponto`, `resolvido`, `decisao_minutos`, `decisao_obs`. Único por pessoa, data e tipo |
| `rh_ponto_marcacoes` | `colaborador_id`, `data`, `problema` (`ausente, inconsistente`), `situacao` (`aberta, justificativa_pedida, ajuste_pedido, resolvida`) |
| `rh_banco_horas_movimentos` | `colaborador_id`, `data`, `minutos` (com sinal), `descricao`, `lancamento_id` (FK, único parcial). Só cresce: corrige-se com outro movimento |
| `rh_atestados` | `colaborador_id`, `tipo` (`atestado, afastamento, justificativa`), `inicio`, `dias`, `cid` |
| `rh_ponto_fechamentos` | `periodo_inicio` (dia 25, único), `periodo_fim` (dia 24), `mes_competencia` (dia 1). 25/10 a 24/11 é novembro, como em `D.fec` |
| `rh_ponto_conferencias` | `semana` (segunda-feira), `tipo` (`horas, banco`), `por`, `em`. Único |

Funções: `rh_salvar_lancamento`, `rh_colar_lancamentos` (linha inválida recusa o lote inteiro), `rh_resolver_divergencia`, `rh_salvar_marcacao`, `rh_situacao_marcacao`, `rh_movimento_banco`, `rh_salvar_atestado`, `rh_abrir_fechamento`, `rh_conferencia_semanal`, `rh_listar_lancamentos(p_inicio, p_fim)`, `rh_listar_marcacoes`, `rh_saldos_banco`, `rh_extrato_banco(p_id)`, `rh_listar_atestados`, `rh_obter_atestado`, `rh_listar_fechamentos`, `rh_listar_competencias`, `rh_contar_ponto`, `rh_agenda_ponto`.

**Atestado:** `rh_listar_atestados` e `rh_obter_atestado` devolvem `cid` só a `rh`, dias e datas a `diretoria`, e nada a admin. A auditoria guarda o `cid`, mas `rh_auditoria` não tem leitura nova.

### 012_rh_patrimonio.sql (F4)

`rh_patrimonio_itens`: `codigo` único, `descricao`, `tipo`, `serie`, `responsavel_id` (FK), `localizacao`, `situacao` (`disponivel, em_uso, devolucao_pendente, baixado`), `devolver_ate`. CHECK: `em_uso` exige responsável; `disponivel` proíbe.
`rh_patrimonio_termos`: `codigo` único, `item_id` (FK), `tipo` (`entrega, devolucao`), `colaborador_id` (FK), `situacao` (`aguardando, assinado`).
Código sem sequência: a função trava e calcula o próximo. Funções: `rh_salvar_item`, `rh_entregar_item`, `rh_devolver_item`, `rh_transferir_item`, `rh_localizar_item`, `rh_baixar_item`, `rh_pedir_devolucao`, `rh_termo_assinado` (exige arquivo), `rh_listar_itens`, `rh_obter_item`, `rh_listar_termos`, `rh_buscar_itens`, `rh_contar_patrimonio`, `rh_agenda_patrimonio`.

### 013_rh_recrutamento.sql (F5)

`rh_vagas`: `cargo`, `requisitos`, `tipo_contratacao` (mesma lista do cadastro), `remuneracao_centavos`, `departamento_omie_codigo`, `previsao_inicio`, `gestor_id` (FK), `canais`, `situacao` (`aberta, preenchida, cancelada`), `encerrada_em`.
`rh_candidatos`: `vaga_id` (FK), `nome`, `cpf` (nulo), `email`, `recebido_em`, `decisao` (`aprovado, nao_seguiu`), `motivo`, `movimentacao_id` (FK), `dados_apagados_em`.
Funções: `rh_salvar_vaga`, `rh_salvar_candidato`, `rh_aprovar_candidato`, `rh_nao_seguir`, `rh_apagar_curriculos_vencidos`, `rh_listar_vagas`, `rh_obter_vaga`, `rh_listar_candidatos`, `rh_obter_candidato`, `rh_buscar_recrutamento`, `rh_contar_recrutamento`.

### 014_rh_comunicacao.sql (F5)

`rh_campanhas`: `nome`, `inicio`, `texto`. `rh_comunicados`: `titulo`, `data`, `texto`, `enviado_em`. `rh_eventos_internos`: `nome`, `orcamento_centavos`, `data`, `hora`, `comes`, `local`.
Funções: salvar e listar de cada um, `rh_obter_*`, `rh_buscar_comunicacao`, `rh_contar_comunicacao`, `rh_agenda_comunicacao`.

### 015_rh_beneficios_seguro_celular.sql (F6)

| Tabela | Colunas |
|---|---|
| `rh_vr_pedidos` | `colaborador_id`, `tipo` (`inclusao, alteracao, exclusao`), `situacao`, `criado_*` |
| `rh_beneficio_solicitacoes` | `colaborador_id`, `tipo` (`vt, ajuda_custo`), `valor_centavos`, `mes`, `pagamento_id` (FK, nulo) |
| `rh_seguro_segurados` | `colaborador_id`, `desde`, `ate`. Único parcial: um aberto por pessoa |
| `rh_seguro_meses` | `mes` único, `premio_centavos` (nulo), `pagamento_id` (FK) |
| `rh_seguro_pendencias` | `mes`, `texto`, `resolvida_em`, `resolvida_por` |
| `rh_celular_linhas` | `numero` único, `responsavel_id` (FK, nulo), `ativa` |
| `rh_celular_contas` | `mes` único, `pagamento_id` (FK) |
| `rh_celular_conta_linhas` | `conta_id`, `linha_id`, `valor_centavos`. Único |

**`rh_pagamentos`, aditivo:** troca os CHECKs `rh_pagamentos_tipo_valido`, `rh_pagamentos_forma_valida` (`seguro` e `celular` com `pix_qrcode` ou `boleto`), `rh_pagamentos_colaborador_coerente` (colaborador nulo) e `rh_pagamento_padroes_tipo_valido`. `create or replace` de `rh_salvar_rascunho` e `rh_nova_tentativa`, porque o alvo da chave hoje cairia em `credito` para tipo novo (004, linhas 1060 e 1319). `rh_preparacao_pagamentos` não muda.

Valores só para `rh` e `diretoria`; admin vê sem valor.

### Testes de banco, em qualquer migration

- `tests/hub-install-pglite.test.ts` passa a aplicar só até o 004: ele prova o estado até ali, e o 006 mudaria o que os testes dele gravam direto.
- `tests/hub-install-safety.test.ts` continua verde sem afrouxar nenhuma regra. Tipo de comando novo pede caso que acusa e caso que não acusa.
- Teste por migration em `tests/hub-install/NNN-*.test.ts`, em PGlite, com o ajudante `tests/apoio/banco.ts`.
- `tests/hub-install/contrato-orcamento.test.ts` roda as leituras nomeadas do Orçamento depois de todas as migrations e prova: colunas lidas existem; CHECK de `status` e `tipo_contratacao` iguais; alteração futura não muda `salario_centavos` antes da data e muda na data.

---

## 7.5 Padrão de módulo (a abstração permitida)

Há mais de três usos reais, portanto vale abstrair só isto:

**Componentes em `components/modulo/`:** `Casca`, `MenuLateral`, `BarraInferior`, `BuscaGeral`, `CabecalhoPagina`, `Indicadores`, `BarraFiltros`, `TabelaResponsiva`, `PaginaRegistro`, `Painel`, `Andamento`, `ProximoPasso`, `PainelDocumentos`, `PainelHistorico`, `Dialogo` (`<dialog>` nativo; folha inferior no celular), `Etiqueta`, `Estados` (vazio e erro).

**Registro em `lib/modulos/registro.ts`, uma linha por módulo:**

```ts
export type Modulo = {
  id: string; rota: string; rotulo: string; icone: LucideIcon; grupo?: string;
  ligado: boolean;
  contador?: () => Promise<number>;
  pendencias?: () => Promise<Pendencia[]>;      // "Precisa de você"
  agenda?: (de: string, ate: string) => Promise<ItemAgenda[]>;
  busca?: (texto: string) => Promise<ResultadoBusca[]>;
  indicadorInicio?: () => Promise<Indicador | null>;
  abertoComPessoa?: (id: string) => Promise<ItemEmAberto[]>; // encerramento e ficha
  situacaoPessoas?: () => Promise<Map<string, string>>;      // "Em férias"
  ausenciasNoMes?: (mes: string) => Promise<Map<string, number>>; // sugestão do VR
};
```

Cada fonte roda isolada (`Promise.allSettled`). Se uma falha, a tela mostra o resto e diz qual módulo não carregou. Módulo com `ligado: false` não aparece. Nome do domínio igual ao do banco.

**Não entra no padrão:** formulários e regras de cada módulo. Eles ficam no módulo.

---

## 8. Dado sensível e arquivos

### Quem vê o quê

| Dado | `rh` | `diretoria` | Admin do hub sem papel | Sem papel |
|---|---|---|---|---|
| Salário, valor de VT, ajuda, PJ, vaga, evento, pagamento | Vê | Vê | Nulo | `/sem-acesso` |
| CPF de colaborador e candidato | Inteiro | Mascarado | Mascarado | — |
| Chave PIX | Só tipo e final, do catálogo. Nunca a chave | Idem | Nulo | — |
| Atestado: dias e datas | Vê | Vê | Não vê | — |
| Atestado: CID e arquivo; ASO: arquivo | Vê | **Nunca** | Nunca | — |
| Currículo | Vê | Vê | Nunca | — |
| Documentos `geral` | Vê | Vê | Nunca | — |
| Texto de histórico `sensivel` | Vê | Nunca | Nunca | — |

**Regra de tela:** quem não vê não recebe. A máscara é da função no banco, nunca de CSS.

### Onde os arquivos ficam

**O 004 não tem padrão de guardar arquivo:** ele só repassa ao Financeiro. Por isso **proponho o padrão de Financeiro, Compras e Fornecedores, com uma diferença**:

- Pasta privada `rh-arquivos`, sem policy em `storage.objects`: só a chave de serviço entra, e só o servidor sobe e gera link.
- **Diferença:** esses módulos criam a pasta por SQL (`insert into storage.buckets`). A regra 4 do RH e o teste de segurança proíbem escrever fora de `rh_*`. **Não afrouxo a trava:** a pasta é criada no painel do Supabase, uma vez, com `public = false`, limite de 10 MB e tipos PDF, JPG, PNG. Antes de cada subida, o servidor confere com `getBucket` que a pasta segue privada; se não, recusa.
- Caminho `AAAA/<uuid>.<ext>`, sem nome de pessoa. O nome original fica em `rh_arquivos`.
- Conteúdo conferido pelos primeiros bytes (reaproveita `conteudoPermitido` e `TAMANHO_MAXIMO_ANEXO`). O `bodySizeLimit` de 11 MB já existe em `next.config.ts`.

**Abrir:** `abrirArquivo(id)` chama `requireSessao`; `rh_arquivo_caminho(p_id)`, com a sessão da pessoa, devolve o caminho só se a classe permitir, e nada para quem não pode; só então a chave de serviço cria link de 60 segundos. Sem registro em log do nome nem do caminho.

**Subir:** o caminho sobe primeiro, depois `rh_arquivo_registrar`. Se o registro falhar, remove o objeto. Se remover falhar, grava em log só o id.
**Apagar:** marca `removido_em` antes, depois remove da pasta; falha fica visível para refazer.

**WhatsApp:** só texto em área de transferência. **Senha de portão:** nenhum campo. **API do VR Ponto:** nenhuma chamada.

---

## 9. Moldura responsiva

Quatro faixas, com nomes no `globals.css` (`--breakpoint-tab: 40.0625rem`, `--breakpoint-note: 68.75rem`, `--breakpoint-larga: 100rem`):

| | Celular até 640 | Tablet 641 a 1099 | Notebook 1100 a 1599 | Monitor 1600+ |
|---|---|---|---|---|
| Navegação | Barra inferior: Início, Pessoas, Agenda, Menu | Lateral de 68 px em ícones, botão "Módulos" (4.4) | Lateral de 252 px com grupos e contadores | Lateral de 272 px |
| Topo | Barra da marca: menu, título, busca abre diálogo, avatar | Busca, avatar | Busca, nome e papel | Busca, nome e papel |
| Tabela | Cartões | Colunas de prioridade 1 e 2 | Até prioridade 3 | Todas |
| Indicadores | 2 por linha | 4 por linha | Automático, Início em 4 | Início em 8 |
| Registro | Uma coluna; o painel "lado" desce | Uma coluna | Lado de 320 px | Lado de 400 px |
| Início | Uma coluna | 2 colunas | 2 colunas, atalhos embaixo | 3 colunas |
| Agenda | Lista como padrão | Mês | Mês com textos | Mês com textos altos |
| Abas | Grade de 3 | Linha | Linha | Linha |
| Diálogo | Folha inferior, até 92% da altura | Central | Central | Central |
| Alvo de toque | 44 px; campos com 16 px | 44 px | Mouse | Mouse |

**Tabela responsiva:** colunas com prioridade e largura em arquivo puro `lib/<modulo>/colunas.ts`. Abaixo de 600 px de área, cartões; acima, tabela. Medidas por container query, nunca por largura de janela (4.6). Linha inteira clicável, com o primeiro campo como link de verdade.

**Abas de registro** não podem criar rolagem horizontal de página: as abas quebram em grade no celular.

**Critério de pronto de toda tela**, nas larguras 390×844, 820×1180, 1366×768 e 1920×1080:

1. `document.documentElement.scrollWidth <= clientWidth`.
2. Nenhuma tabela com rolagem interna horizontal.
3. Todas as ações do papel `rh` alcançáveis.
4. Nome acessível em todo botão de ícone; foco visível; ordem de teclado coerente.
5. Estados de carregando, vazio, erro e sem acesso.

**Como conferir sem tocar no banco:** rota `/vitrine/<tela>`, só em desenvolvimento, com dados fictícios e Supabase inalcançável (tarefa F0.6 do plano). Telas reais, depois de publicadas, são conferidas pelo João ou pelo coordenador; a regra "não afirme sem ter visto publicada" continua.

---

## 10. Rotas e papéis por tela

Todas chamam `requireSessao`. `rh` edita e todos os demais só leem. Botões de ação não são renderizados para quem não edita, e a ação no servidor recusa de novo (`podeEditarColaboradores`).

| Rota | Tela | `diretoria` | Admin sem papel | Frente |
|---|---|---|---|---|
| `/` | Início | Lê | Sem valor | F1 |
| `/pessoas`, `?vista=relacao` | Lista e relação | Lê, CPF mascarado | Sem salário | F1 |
| `/pessoas/[id]`, `?aba=` | Ficha | Lê | Sem valor, sem atestado | F1 |
| `/pessoas/emails` | Preencher e-mails | Sem acesso | Sem acesso | F1 |
| `/[id]`, `/novo`, `/importar` | Redirecionam | — | — | F1 |
| `/movimentacoes`, `?vista=` | Lista | Lê | Sem valor | F1 |
| `/movimentacoes/nova-admissao` | Formulário | Sem acesso | Sem acesso | F1 |
| `/movimentacoes/nova-alteracao?pessoa=` | Formulário | Sem acesso | Sem acesso | F1 |
| `/movimentacoes/[id]`, `?aba=` | Registro | Lê | Sem valor | F1 |
| `/agenda`, `?vista=&mes=&modulo=` | Agenda | Lê | Lê sem valor | F1 |
| `/ferias`, `/ferias/[id]` | Férias | Lê | Lê | F2 |
| `/exames`, `/exames/[id]` | Exames | Lê, sem arquivo | Sem arquivo | F2 |
| `/contratos`, `/contratos/[id]` | Contratos PJ | Lê | Sem valor | F2 |
| `/ponto`, `?vista=` | Ponto | Lê | Sem atestado | F3 |
| `/ponto/lancamentos/[id]` | Conferência | Lê | Lê | F3 |
| `/ponto/atestados/[id]` | Atestado | Só dias e datas | Sem acesso | F3 |
| `/ponto/fechamentos/[id]` | Fechamento | Lê | Lê | F3 |
| `/pagamentos`, `/pagamentos/*` | Rotas de hoje | Como hoje | Como hoje | F0, F3 |
| `/pagamentos/seguro`, `/pagamentos/celular` | Novos | Lê | Sem valor | F6 |
| `/beneficios`, `?vista=` | Benefícios | Lê | Sem valor | F6 |
| `/beneficios/vr/[mes]`, `/beneficios/solicitacoes/[id]` | Registros | Lê | Sem valor | F6 |
| `/patrimonio`, `?vista=`, `/patrimonio/[id]` | Patrimônio | Lê | Lê | F4 |
| `/patrimonio/termos/[id]/imprimir` | Termo | Sem acesso | Sem acesso | F4 |
| `/recrutamento`, `?vista=` | Vagas e candidatos | Lê, CPF mascarado | Sem valor, sem CPF | F5 |
| `/recrutamento/vagas/[id]`, `/recrutamento/candidatos/[id]` | Registros | Lê | Sem valor, sem CPF | F5 |
| `/comunicacao`, `?vista=` | Comunicação | Lê | Sem orçamento | F5 |
| `/comunicacao/campanhas/[id]`, `/comunicados/[id]`, `/eventos/[id]` | Registros | Lê | Sem orçamento | F5 |
| `/papeis` | Papéis | Sem acesso | Só admin | Existe |
| `/sem-acesso` | Sem acesso | — | — | Existe |

**Formulários em página, não em diálogo, onde há mais de 5 campos** (admissão, alteração, vaga). O mockup usa diálogo em todos; no celular, formulário longo em folha inferior perde o que foi digitado com um toque fora. Decisão **[S]**.

---

## 11. Variáveis de ambiente novas

**O RH não tem SMTP hoje:** `lib/env.ts` só conhece Supabase e porta do Financeiro, e `package.json` não tem `nodemailer`. Copia-se o módulo do Compras (`lib/avisos/configuracao.ts`, `smtp.ts`), lido na hora do uso, fora de `envServidor()`, para uma variável errada nunca derrubar o app.

| Variável | Valor | Obrigatória? |
|---|---|---|
| `SMTP_HOST` | `email-ssl.com.br` (o de Financeiro e Compras) | Opcional |
| `SMTP_PORTA` | `465` | Opcional |
| `SMTP_USUARIO` | Caixa do RH (**[S]** `rh@manfac.com.br`, a criar se não existir) | Opcional |
| `SMTP_SENHA` | Segredo | Opcional |
| `SMTP_REMETENTE` | `RH Manfac <rh@manfac.com.br>`. Tem de ser o endereço da caixa (erro `EENVELOPE 453` já medido no Financeiro) | Opcional |
| `RH_VITRINE` | `1` só em desenvolvimento | Nunca em produção |

**Enquanto faltarem as `SMTP_*`:**

- "Avisar gestor", "Pedir correção" e comunicado por e-mail abrem a prévia com a nota "O envio por e-mail ainda não está ligado", botões "Copiar texto" e "Abrir no meu e-mail" (`mailto:`), e "Registrar aviso", que grava `canal = 'manual'`.
- Nada finge ter enviado: o histórico diz "Aviso registrado à mão".
- Com as variáveis: envia, grava `enviado` ou `falhou` com o código do erro, sem texto do servidor. Falhou: botão "Tentar de novo" com a mesma chave.

**Corpo de e-mail nunca leva** salário, CID, CPF nem valor. Teste por modelo. **Contracheque:** não envia nesta rodada; não depende das variáveis.

Sem variável nova para a pasta: o nome é constante. `FINANCEIRO_URL` e `RH_INTEGRACAO_SECRET` já existem.

---

## 12. Integrações

| Com | Quem lê o quê | Sentido | Se o outro estiver fora |
|---|---|---|---|
| **Orçamento** | Orçamento lê `rh_colaboradores` e `rh_colaborador_rateios` por funções próprias, colunas nomeadas | Orçamento lê o RH | Nada muda. Se o app RH cair, o Orçamento segue lendo o banco. Teste de contrato protege |
| **Financeiro, catálogo** | RH lê `fin_catalogo_fornecedores`, `fin_catalogo_departamentos` | RH lê | É o mesmo banco. App parado só deixa o catálogo defasado |
| **Financeiro, porta** | RH cria solicitação por HTTP, relê por `chave` | RH escreve por contrato | `erro`; "Enviar de novo" usa a mesma chave. Sem segredo: nada é enviado |
| **Omie** | Nunca | — | — |
| **Hub** | RH lê `hub_user_roles`. Acessos: só texto para o admin | RH lê | Sem hub não há login, e o RH fica fora |
| **Frotas** | Nada (D14). 2.7.3 e o desconto 6.6 são digitados | — | Não afeta |
| **Compras** | Link comum para `/compras` | Nenhum dado | Link fora do ar; RH segue |
| **Cockpit, Obras, Fornecedores** | Nada | — | Não afeta |
| **VR Ponto** | Relatório exportado pelo RH, só anexado | Manual | Não afeta |
| **Contabilidade, seguradora, clínica, SESMT** | Texto, arquivo e número de chamado, pelo canal de hoje | Manual | Não afeta |
| **E-mail (Locaweb)** | RH envia, se configurado | RH escreve | Registra `falhou`; texto para copiar |
| **Supabase Storage** | Servidor RH | RH escreve e lê | Tela diz que não abriu; dado do registro continua |
| **pg_cron** | Banco chama `rh_aplicar_vigencias` | Interno | Alerta no Início; botão "Aplicar agora" |

**Pergunta de integração registrada para depois:** ligar motorista da Frotas ao colaborador daria o desconto 6.6 sem redigitar e o veículo na ficha, mas pede mudar a regra 4 e a Frotas. Fica em Dívidas.

---

## 13. O que depende de terceiros

| Quem | O quê | Se não fizer |
|---|---|---|
| **Repositório Financeiro** (nós, por decisão do João) | `TIPOS_RH` e `LISTA_PERMITIDA` em `lib/integracoes/rh-pagamentos.ts`: `seguro` categoria `2.03.13`, `celular` categoria `2.04.05`, formas `pix_qrcode` e `boleto`. Teste de cada linha. **Sem migration** (D25) | Porta devolve 422. Seguro e celular ficam só na conferência; o resto do RH funciona |
| **Bloqueio de duplicidade** | **[S]** `seguro`: duro (um boleto por mês; pega lançamento à mão). `celular`: só chave e etiqueta (pode haver mais de uma conta) | — |
| **José, categorias** | Incluir `Telefonia` em `fin_obra_categorias_fixas`. `Seguro de Vida` já está (044). Vale também o que já estava pedido: Salários, FGTS, Vale Transporte, Transporte Urbano | Rateio com centro de custo de OBRAS ou SPOT cria a solicitação como `pendente` em "Sem obra". Não recusa |
| **João** | Autorizar SQL, pasta, deploys e caixa de e-mail (plano, por frente) | Frente pronta sem publicar |
| **Empresa** | Ler o texto do termo de patrimônio; dizer o saldo inicial de férias; confirmar 12 meses de currículo | Página de termo com o texto provisório; "Saldo a conferir" na tela |

---

## 14. Ordem de publicação

Regra de sempre: SQL antes do deploy que o usa; um arquivo por vez; `npm run types` e commit depois de cada aplicação; conferir `v_sync_health` (README do hub-install). Sem webhook: alguém clica Deploy.

1. **Pré-requisito só de F6:** a porta do Financeiro aceitar o segredo (hoje responde 401, conforme a memória de 06/11) e o teste de fumaça dos pagamentos ter rodado.
2. **F0:** `005`; criar pasta `rh-arquivos`; `SMTP_*` no Environment do EasyPanel, se a caixa existir; deploy do RH. Moldura nova no ar, com só Pessoas e Pagamentos ligados.
3. **F1:** avisar o RH do intervalo; `006`; `007`; deploy imediato. **Entre o 006 e o deploy, o formulário antigo recebe a mensagem da trava**, ou seja, falha fechado, sem perda. Depois: preencher e-mails.
4. **F2, F3, F4, F5**, em qualquer ordem entre si, cada uma com sua migration e seu deploy. Nenhuma depende da outra no banco.
5. **F6, nesta ordem:** deploy do Financeiro; conferir chunks; `015`; deploy do RH; teste de fumaça com descrição `TESTE - APAGAR`, valor simbólico, avisando o Financeiro antes e cancelando logo (a porta não tem guarda contra o Omie, e o teste dispara e-mail).
6. **Atualizar** `CLAUDE.md` do RH, README do hub-install e memória.

**Reversão:** tudo é aditivo. App antigo com banco novo: lê normalmente e só a edição direta recebe a trava.

---

## 15. O que não pude verificar

- **Financeiro depois do merge.** O clone tem `origin/rh-pagamentos` (`82e45fa`), não o merge `cfcefb2`. A lista de tipos e o CHECK foram lidos nessa branch. Confirmar no `main` antes de F6.
- **Códigos de categoria.** `2.03.13 Seguro de Vida` e `2.04.05 Telefonia` vêm de comentários em `orcamento/supabase/dados/2026-10-19-classificacao-dre.sql`. Não consultei o catálogo de produção, e "Telefonia" ser a categoria da conta de celular é inferência. Confirmar com José ou em `fin_catalogo_*` antes de F6.
- **Como seguro e celular são lançados hoje** (forma). Permiti QR e boleto por analogia com VR.
- **Produção:** quantos e-mails estão preenchidos; se o job do `pg_cron` roda sob o RH como roda sob o Financeiro; se a pasta `rh-arquivos` já existe; estado real do 004.
- **Se a caixa `rh@manfac.com.br` existe** e se a Locaweb aguenta lotes de 5 com 50 destinatários (no Financeiro há registro de `EMESSAGE 451` intermitente).
- **Arquivos reais nunca vistos:** relatório do VR Ponto, contracheque e demais PDFs da folha, planilha da seguradora, termo de patrimônio. Formatos de colar e de CSV são suposição minha.
- **Regra de férias e de saldo.** Não verifiquei a CLT nem a prática da Manfac além do mockup. Não é parecer.
- **PJ em CPF:** alerta do impacto segue sem resposta, e a spec só o reproduz.
- **Mockup:** li código e CSS; **não abri em navegador**. A conta dos 890 px em 1600 é aritmética do CSS; o corte foi relatado por quem construiu. Não rodei testes, `tsc` nem `build`.
- **Orçamento:** por busca nos clones, nenhuma leitura com `select *` de `rh_colaboradores`. Não é prova sobre o banco de produção.
- **Vitrine:** não testei `next dev` com Supabase inalcançável nesta máquina, que já teve limite de memória.

---

## Exigências do coordenador na revisão desta spec

1. **Vitrine falha fechado:** só abre com `NODE_ENV !== 'production'` **e** `RH_VITRINE=1`, as duas condições. Teste prova que, em produção, ela não abre mesmo com `RH_VITRINE=1`, e que nenhuma outra rota muda de decisão no porteiro.
2. **Antes de ligar a trava:** F1 lista toda função e gatilho do 002, 003 e 004 que grava em `rh_colaboradores` ou nos rateios, e um teste prova que cada uma segue funcionando ou está na lista de "sai". Em particular, as funções de pagamentos não podem começar a falhar.
3. **A trava e o fim da importação ficam em aberto para o João até o aplicar do 006.** O código é construído como está na seção 5, mas nada é aplicado sem a autorização dele.

## 16. Dívidas e riscos aceitos

**Riscos, por tamanho:**

1. **A trava no banco é a decisão de maior impacto.** Ela muda o dia a dia do RH: até corrigir uma grafia passa por uma alteração, ainda que curta. Mitigação: alteração não material conclui na mesma tela. Se o RH reclamar, o afrouxamento é retirar colunas da lista do gatilho, não a trava.
2. **Fim de vínculo real** exige cuidado de vocabulário: `feedback-nunca-citar-demissao` vale para material ao cliente, e aqui a tela existe. Por isso só "Encerramento de vínculo" e um teste de texto.
3. **Readmissão reescreve `admissao` e limpa `desligamento`.** O headcount do Orçamento usa essas datas, então a conta de meses antigos, se recalculada, pode mudar. A tela avisa. Solução de verdade seria vínculo como tabela própria, fora do escopo.
4. **Rateio futuro só entra na vigência.** Preparar pagamento de um mês antes do dia 1 usaria o rateio anterior, assim como planejar um ciclo futuro no Orçamento. Raro; o agendado aparece na ficha.

**Dívidas, deixadas de propósito:**

- Salário com tabela de vigências; hoje o histórico é a movimentação, e reprocessar mês antigo segue usando o que foi copiado em `rh_pagamentos`.
- `rh_importar` e `rh_salvar_colaborador` ficam no banco; a importação fica sem chamador. Remover quando não houver dúvida.
- Ligar motorista da Frotas ao colaborador. Veículo na ficha.
- Leitura automática de relatório de ponto, PDF da folha, nota do PJ.
- Regra legal de fracionamento de férias; aviso automático por data; envio de contracheque.
- `rh_auditoria` guarda `cid` em claro, sem leitura. Avaliar remover a coluna do `to_jsonb` no gatilho de `rh_atestados`.
- Revogar papel de RH automaticamente no fim do vínculo.
- Contadores da lateral só atualizam ao recarregar, porque o layout não renderiza de novo a cada navegação.
