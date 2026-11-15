# Almoxarifado: plano (34 tasks) x código da branch `fase-1` (15/11/2026)

Levantamento só de leitura, por grep e leitura de arquivo (não por documento de estado).
Código: `C:\Users\joao-\almox`, branch `fase-1`, 126 arquivos de teste, 22 arquivos SQL em
`supabase/hub-install/` (001 a 023, sem o 019). Plano:
`C:\Users\joao-\almox-ref\compras\docs\superpowers\plans\2026-11-11-almoxarifado-sistema-completo.md`.
Não rodei `tsc`, testes nem build; "testes existem" significa que o arquivo existe e cobre o assunto.

## Resumo

| Status | Quantas | Tasks |
|---|---|---|
| FEITA | 13 | 1, 2, 3, 5, 6, 7, 10, 11, 12, 13, 14, 15, 20 |
| PARCIAL | 15 | 9, 17, 18, 19, 21, 22, 23, 25, 27, 28, 29, 30, 32, 33, 34 |
| NÃO FEITA | 3 | 24, 26, 31 |
| BLOQUEADA | 3 | 4 (só falta o SQL 004), 8 (V1), 16 (SQL 008 e e-mail) |

Regra de classificação: FEITA = código, testes e (quando existe) SQL aplicado e tela, sem nada
pendente. PARCIAL = existe código, mas falta algo construível (quase sempre a tela). BLOQUEADA =
o que falta é só ação externa (SQL a aplicar, teste no Omie, decisão). NÃO FEITA = não existe.
Várias PARCIAIS também têm bloqueio externo; está na coluna "O que falta".

**Fechamento em uma frase:** de 34 tasks, 13 estão fechadas e 3 só esperam uma ação externa;
**18 ainda têm construção pela frente** (15 parciais + 3 não feitas), e 1 script pequeno (T8).
O grosso é tela: o **servidor (regras, SQL, ações) está quase todo escrito, o que falta é a
interface do almoxarife e do técnico**, mais PDF/assinatura, as duas mudanças em outros
repositórios e a virada.

### O que falta construir, em números

- **Telas do almoxarife/técnico que não existem (18 grupos):** colaboradores (convite, WhatsApp,
  bloquear); separação (folha imprimível); retirada com assinatura (canvas + PIN); falhas no
  Omie; transferências; devoluções (almox) e `/t/devolver` (técnico); recebimentos (agenda,
  conferência, "falta entrada no Omie"); reposição; inventário (contar às cegas + ciclos);
  ajustes (aprovação em lote do admin); ferramentas; consertos; ficha do colaborador (almox) e
  `/t/ficha` (técnico); indicadores; tela inicial real (hoje diz "Em construção."); tela de
  "não retirados" e reagendar (trabalho novo, abaixo). O menu do app só tem 4 ícones
  (casa, estoque, configurações, aprovação).
- **PDF de verdade:** `pdf-lib` não está no `package.json`; `lib/pdf/requisicao.ts` e
  `termo.ts` só montam o conteúdo. Falta também o componente de traço da assinatura
  (`components/assinatura-traco.tsx` não existe).
- **Task 24** (requisição do Compras vira pedido): zero código.
- **Task 26** (mudanças no repositório do Compras): zero código; o checkout do Compras em
  `almox-ref` está no commit do desenho/plano e o último SQL lá é o 017.
- **Task 31** (desligamento e RH): zero código, nem o SQL 019.
- **Task 34** (virada): falta card no hub (`lib/sistemas.ts` do hub não cita almox),
  `docs/deploy-easypanel.md`, manual, cadastros e uma semana de acompanhamento.
- **Agendamento:** só o 004 (3 jobs de cópia) existe como SQL. Os jobs de avisos (15 min), fila
  do Omie (5 min), não retirado (diário), reposição (6h), inventário (diário), indicadores
  (mensal) e RH não têm SQL de agendamento escrito; só o exemplo do "não retirado" em
  comentário no `docs/validacoes.md`.
- **SQL em produção que falta aplicar (8 arquivos):** 004, 008, 013, 014, 015, 016, 020, 021.
  O 019 ainda nem foi escrito.

## Tabela por task

Evidência = arquivo principal em `C:\Users\joao-\almox`.

| Task | Fase | Status | Evidência | O que falta |
|---|---|---|---|---|
| 1 Repositório, porteiro, trava | 1 | FEITA | `proxy.ts`, `lib/auth/porteiro.ts`, `tests/porteiro.test.ts`, `tests/hub-install-safety.test.ts`, `tests/env.test.ts`, `Dockerfile`, `CLAUDE.md`; app no ar desde 14/11 | nada |
| 2 Acesso, papéis, configurações (001) | 1 | FEITA | `supabase/hub-install/001_*.sql` (aplicado), `lib/papeis/*`, `lib/configuracoes/*`, `app/(modulo)/papeis`, `app/(modulo)/configuracoes`, `tests/papeis-concessao.test.ts`, `tests/configuracoes-montar.test.ts` | nada de construção. Mockup das telas de Papéis e Configurações nunca foi aprovado (ver trabalho novo) |
| 3 Estoques, contratos, equipes (002) | 1 | FEITA | `002_alx_estrutura.sql` (aplicado), `lib/estrutura/*`, `app/(modulo)/configuracoes/estrutura`, `tests/estrutura-actions.test.ts` | nada de construção. Dados: cadastrar BASE, DPSP, PROFARMA e as 15 equipes (João autorizou em 14/11) |
| 4 Cópia do Omie (003, 004) | 1 | BLOQUEADA | `003_alx_copia_omie.sql` (aplicado), `lib/omie/{cliente,leitura,paginar}.ts`, `lib/copia/*`, `app/api/tarefas/{catalogo,copia-estoque,movimentos}`, `scripts/sondar-estoque.mjs`, V4 e V5 registrados em `docs/validacoes.md` (sondagem de 14/11); catálogo já copiado (26 estoques, 1.273 produtos) | SQL **004** (agendador) não aplicado: exige segredos `almox_producao_*` no cofre e autorização. Sem ele a cópia só roda chamando a rota à mão. Decisão pendente do `idAjuste` (ver trabalho novo) |
| 5 Busca instantânea | 1 | FEITA | `lib/busca/normalizar.ts`, `tests/busca-normalizar.test.ts` | nada |
| 6 Posição de estoque + "Em compra" | 1 | FEITA | `lib/estoque/{posicao,em-compra}.ts`, `app/(modulo)/estoque/*` (exporta CSV, `posicao.tsx`), `tests/estoque-posicao.test.ts`, `tests/estoque-em-compra.test.ts` | nada. Decisão pendente: aprovador vê a tela de Estoque? (hoje menu mostra e tela nega) |
| 7 Mínimos e alvo (005) | 1 | FEITA | `005_alx_minimos.sql` (aplicado), `lib/estoque/minimos.ts`, `app/(modulo)/estoque/minimos`, `tests/estoque-minimos*.test.ts` | nada. A tela ficou diferente do mockup 2B (ajuste pendente de mockup) |
| 8 Validação V1: o Field baixa no Omie? | 1 | BLOQUEADA | `docs/validacoes.md` não tem V1; `scripts/sondar-field-omie.mjs` não existe; `docs/almox/2026-11-12-baixa-field-omie.md` diz "NÃO VERIFICADO" | Rodar o script (só leitura) com a `FIELD_API_KEY` válida (está no EasyPanel/Cockpit) e o Omie; ou resolver pelo teste de 1 unidade que o Jose vai fazer. Script ainda a escrever (pequeno). Resultado decide se o gravador do Field (T18) é preciso |
| 9 Colaboradores e acesso do portal (006) | 2 | PARCIAL | `006_alx_colaboradores_portal.sql` (aplicado), `lib/colaboradores/{actions,queries,schemas}.ts` (criar, convite, bloquear), `lib/portal/{token,pin}.ts`, `lib/rh/leitura.ts`, `tests/colaboradores-actions.test.ts`, `tests/portal-{token,pin}.test.ts`, `tests/rh-leitura.test.ts` | **Tela `app/(modulo)/colaboradores` não existe**: cadastrar/buscar no RH, gerar convite, botões copiar e WhatsApp, bloquear/reemitir. Mockup 2A aguarda aprovação |
| 10 Portal: convite, PIN, sessão | 2 | FEITA | `app/t/convite/[token]`, `app/t/entrar`, `app/t/layout.tsx`, `app/t/api/{convite,entrar,sair}`, `lib/portal/{sessao,origem,rota,pin-fraco,csp}.ts`, `public/t/manifest.webmanifest`, 12 testes `tests/portal-*.test.ts` | nada de construção. Tela de entrar difere do mockup aprovado (duas etapas), registrado como erro de processo em 12/11. Decisões pendentes: PIN de 6 dígitos fixos e regra de suspensão |
| 11 Regras de retirada | 2 | FEITA | `lib/tempo/{data-civil,dias-uteis,retirada}.ts`, `tests/tempo-retirada.test.ts` (corte das 16h inclusivo e sábado: commit `fe5d14c`) | nada |
| 12 Pedidos no banco (007) | 2 | FEITA | `007_alx_pedidos.sql` (aplicado), `lib/pedidos/{regras,repositorio}.ts`, `tests/pedidos-sql.test.ts`, `tests/pedidos-regras.test.ts` | nada |
| 13 Disponível e marca do item | 2 | FEITA | `lib/estoque/disponivel.ts`, `tests/estoque-disponivel*.test.ts` | nada |
| 14 Portal: novo pedido, meus pedidos, alertas | 2 | FEITA | `app/t/novo`, `app/t/pedidos` (lista, detalhe, `faixa.tsx`), `app/t/api/pedidos/{catalogo,enviar,cancelar,obras,reagendar}`, `lib/pedidos/{tecnico,tecnico-servidor,carrinho,portal}.ts`, `lib/avisos/alertas-tecnico.ts`, `tests/pedidos-actions-tecnico.test.ts`, `tests/pedidos-rotas-tecnico.test.ts` | nada de construção (a tela de reagendar do técnico entra no trabalho novo). Nunca usado por técnico real |
| 15 Aprovação | 2 | FEITA | `lib/pedidos/{aprovacao,aprovacao-regras,aprovacao-servidor,actions-aprovador}.ts`, `app/(modulo)/pedidos` (fila e `[id]/detalhe.tsx` com incluir item, OS, recusar), `tests/pedidos-aprovacao*.test.ts`. Retirada vencida é empurrada na aprovação (`dcfae69`) | nada |
| 16 Avisos e lembretes (008) | 2 | BLOQUEADA | `008_alx_avisos.sql`, `lib/avisos/{avisar,canais,lembretes,mensagens,smtp}.ts`, `app/api/tarefas/avisos/route.ts`, `tests/avisos-*.test.ts`; `ENVIO_DE_EMAIL_LIGADO = false` em `lib/avisos/canais.ts` | SQL **008 não aplicado**; job `almox-*-avisos` sem SQL de agendamento; `ALX_SMTP_*` no EasyPanel (João decidiu usar as mesmas `SMTP_*` do Compras); aprovar remetente, destinatários e textos (`docs/almox/2026-11-12-proposta-textos-emails.md`); teste em `teste` com `ALX_SMTP_TESTE_PARA`; trocar a constante |
| 17 Separação | 2 | PARCIAL | `lib/pedidos/separacao.ts`, `lib/pedidos/actions-pos-aprovacao.ts` (`listaDoDiaAction`, `separarPedidoAction`), `022_*.sql` (aplicado), `tests/pedidos-separar-aviso.test.ts`, `tests/pedidos-pos-*.test.ts` | **Tela `app/(modulo)/pedidos/separacao` e folha imprimível não existem.** Mockup 2A aguarda aprovação |
| 18 Fila de gravação no Omie | 2 | PARCIAL | `009_alx_fila_omie.sql` (aplicado), `lib/omie/{codigos,movimentos}.ts`, `lib/fila/{tarefas,executar,gravador,rodar,actions}.ts`, `app/api/tarefas/omie/route.ts`, `tests/fila-*.test.ts`, `tests/omie-{codigos,movimentos}.test.ts`; `GRAVACAO_OMIE_VALIDADA = false` | (a) **Tela "Falhas no Omie"** (as actions `listarFalhasAction` e `tentarDeNovoAction` existem; a tela não); (b) **V2 e V3 não medidos** (10 itens em `docs/validacoes.md`; o teste de 1 unidade com o Jose é a condição) e ajustar `lib/omie/movimentos.ts` ao que for medido; (c) `scripts/sondar-ajuste.mjs` não existe; (d) gravador do Field (`lib/field/`) só se o V3 mandar; (e) SQL do job `almox-*-omie` (5 min). Enquanto isso, nada grava no Omie |
| 19 Retirada com assinatura e requisição | 2 | PARCIAL | `010_alx_assinaturas.sql` (aplicado), `lib/assinaturas/*`, `lib/pedidos/retirada.ts`, `registrarRetiradaAction`, `lib/pdf/requisicao.ts` (só conteúdo), `tests/assinaturas-*.test.ts`, `tests/pedidos-retirada.test.ts`, `tests/pdf-requisicao.test.ts` | **Tela de retirada** (`pedidos/[id]/retirada`), **componente de traço** (canvas), **biblioteca de PDF** (`pdf-lib` ausente do `package.json`; decisão pendente) e **pasta `almox-arquivos` do Storage** (nenhum SQL a cria). Teste real de 1 item no Omie depende de autorização do Jose |
| 20 Obra/Spot e OS múltiplas | 3 | FEITA | `lib/obras/leitura.ts` (`procurarObras`), `lib/pedidos/os.ts`, `lib/estoque/custo-obra.ts`, `tests/pedidos-os-distribuir.test.ts`, `tests/estoque-custo-obra.test.ts`, busca ligada no portal e na aprovação | nada. Tela do custo por OS: só a action (`custoPorOsAction`); entra com os indicadores |
| 21 Transferência entre estoques (011) | 3 | PARCIAL | `011_alx_transferencias.sql` (aplicado), `lib/transferencias/{regras,decidir,actions}.ts`, `tests/transferencias-decidir.test.ts`, `tests/transferencias-origens.test.ts` | **Tela `app/(modulo)/transferencias`** (fila, saldos de todos os estoques, escolha da origem). Aceitar só funciona pela chave de serviço enquanto `GRAVACAO_OMIE_VALIDADA = false` |
| 22 Devolução de sobra, não retirado, cancelamento (012) | 3 | PARCIAL | `012_alx_devolucoes.sql` (aplicado), `lib/devolucoes/*`, `lib/pedidos/nao-retirado.ts`, `app/api/tarefas/pedidos/route.ts`, `app/t/api/devolucoes/{pedir,itens,minhas,cancelar}`, `tests/devolucoes-regras.test.ts`, `tests/pedidos-nao-retirado-aviso.test.ts` | **Telas `app/t/devolver` e `app/(modulo)/devolucoes`** não existem (só as rotas de API do portal); **SQL do job de não retirado** não agendado; tela do almox para decidir cancelar/devolver (trabalho novo) |
| 23 Agenda de entregas e conferência (013) | 4 | PARCIAL | `013_alx_recebimentos.sql` (**não aplicado**), `lib/recebimentos/{agenda,conferencia,sem-entrada,actions}.ts`, `tests/recebimentos-*.test.ts` | **Telas `app/(modulo)/recebimentos`** (agenda, conferência com foto, "falta entrada no Omie"); **V6 não medido** (casamento do movimento `COM` com o pedido do Compras); aplicar 013; bucket `almox-arquivos` para a foto |
| 24 Requisição de estoque do Compras vira pedido | 4 | NÃO FEITA | não existe `lib/pedidos/de-compras.ts` nem `importarRequisicoes` (grep sem resultado) | Tudo. Precisa ler no Compras as colunas de requisição de estoque e `cmp_estoque_checagens`; `confirmarRetiradaHub`; job. Não depende de decisão do cliente |
| 25 Sugestão de reposição (014) | 4 | PARCIAL | `014_alx_reposicao.sql` (**não aplicado**), `lib/reposicao/{sugerir,gerar,actions}.ts`, `app/api/tarefas/reposicao/route.ts`, `tests/reposicao-*.test.ts` | **Tela `app/(modulo)/reposicao`**; aplicar 014; SQL do job diário das 6h; "enviar" só vira solicitação no Compras com a Task 26. Pergunta aberta: qual centro de custo paga a reposição do BASE |
| 26 Mudanças no repositório do Compras | 4 | NÃO FEITA | `almox-ref/compras` no commit do plano; `supabase/hub-install` do Compras termina no `017`; não há `018_cmp_integracao_almox.sql` nem `lib/integracao-almox` | Tudo, em outro repositório (`manfac-facilities/compras`): SQL 018, `aplicarConferenciasDoAlmox`, `solicitacaoAPartirDaSugestao`, ajuste do teste de segurança deles, deploy dos dois |
| 27 Inventário: ciclos, ondas, contagem às cegas (015) | 5 | PARCIAL | `015_alx_inventario.sql` (**não aplicado**), `lib/inventario/{ondas,ciclo,servico,actions,executar}.ts`, `app/api/tarefas/inventario/route.ts`, `tests/inventario-*.test.ts` | **Telas `app/(modulo)/inventario` e `inventario/contar`** (mobile); aplicar 015; SQL do job diário; contagem de ferramental não existe em `lib/inventario` (depende da T29) |
| 28 Motivos, aprovação do admin, ajuste no Omie (016) | 5 | PARCIAL | `016_alx_ajustes.sql` (**não aplicado**), `lib/inventario/ajustes.ts`, `criarMotivoAction`, `decidirAjustesAction`, `tests/inventario-ajustes.test.ts` | **Tela `app/(modulo)/ajustes`** (aprovação em lote, só admin: o João disse que a aprovação é do Jose); aplicar 016; o ajuste só grava no Omie quando a fila for ligada (V2, item 8: `SLD` absoluto ou delta) |
| 29 Ferramentas, conserto, importação (017) | 6 | PARCIAL | `017_alx_ferramentas.sql` (aplicado), `lib/carga/{ferramentas,importar,regras}.ts`, actions de baixa/conserto/importar, `tests/carga-ferramentas.test.ts`, `tests/carga-importar.test.ts` | **Telas `ferramentas` e `consertos`**. Decisão do João (12/11): ninguém importa pela tela; ele manda a planilha e a carga inicial é feita direto no banco, então a tela de importação pode ser dispensada, mas a carga inicial precisa ser feita (script/SQL) |
| 30 Entrega e devolução com termo; EPI/uniforme (018) | 6 | PARCIAL | `018_alx_cargas.sql` (aplicado), `lib/carga/{cargas,epi,termo-vigente,ficha-portal}.ts`, `lib/carga/actions.ts`, `lib/pdf/termo.ts` (só conteúdo), `tests/carga-*.test.ts`, `tests/pdf-termo.test.ts` | **Telas** `colaboradores/[id]/ficha` e `app/t/ficha`; PDF do termo (biblioteca ausente); saída de EPI/uniforme na fila do Omie está desligada por construção na ficha (`enfileirarSaida`); texto do termo precisa de revisão do RH |
| 31 Desligamento integrado ao RH | 6 | NÃO FEITA | não existe `019_*.sql`, `lib/rh/desligamentos.ts`, `lib/pdf/desligamento.ts` nem rota `tarefas/rh` | Tudo, incluindo a mudança no repositório do RH. Deixada de fora de propósito (regra de nunca citar saída de alguém) e o texto do termo/desconto está em aberto com o RH. V8 sem resposta. Precisa de decisão do João sobre como tratar o assunto |
| 32 Indicadores (020) | 7 | PARCIAL | `020_alx_indicadores.sql` (**não aplicado**), `lib/indicadores/{calculo,montar,foto,movimento}.ts` (`montar.ts` com 1.766 linhas), `app/api/tarefas/indicadores/route.ts`, `tests/indicadores-*.test.ts` | **Tela `app/(modulo)/indicadores`**; aplicar 020; SQL do job mensal; giro/consumo/parado saem "aproximado" até medir como a transferência aparece no movimento do Omie (`INTERPRETACAO_MEDIDA = false`); V9 (aplicação fora do contrato) sem dado. Pergunta aberta: quem vê os indicadores |
| 33 Tela inicial e lembrete da fase seguinte (021) | 7 | PARCIAL | `lib/inicio/resumo.ts`, `tests/inicio-resumo.test.ts`, `021_alx_pendencias_projeto.sql` (**não aplicado**) | `app/(modulo)/page.tsx` é um **placeholder** ("Em construção."): ligar o `resumoDoDia` por papel; aplicar 021 |
| 34 Colocar no ar para valer | virada | PARCIAL | App no ar em `hub.manfac.com.br/almox` desde 14/11; cópia do catálogo feita | Falta: card "Almoxarifado" no hub (`lib/sistemas.ts`), `docs/deploy-easypanel.md`, manual (`docs/cliente/manual-almox.md` + HTML/PDF), cadastros com o Jose (papéis, estrutura, mínimos, motivos, termo, feriados, mapa CC para estoque), carga das ferramentas, convites dos técnicos, desligar o e-mail de requisição no Compras (depende da T26), combinar o dia da virada, limpar dados de teste, uma semana de acompanhamento. Não verifiquei se `/almox-teste` existe |

## Trabalho NOVO (não estava no plano)

Surgiu das respostas do Jose e do João entre 12 e 14/11. Status = situação hoje.

| # | Trabalho | Origem | Situação |
|---|---|---|---|
| N1 | **Tela do almox para pedido "não retirado"**: ver os não retirados e decidir entre cancelar e devolver ao técnico para reagendar | Jose, 12/11, B4 | Servidor FEITO (`devolverParaReagendarAction`, `cancelarPedidoHubAction`, `lib/pedidos/nao-retirado.ts`, 022 aplicado, aviso `pedido_nao_retirado` no 008). **Tela não existe** (a lib diz "sem tela: falta mockup"). Job diário não agendado |
| N2 | **Reagendar pelo técnico, só depois de o almox devolver**: tela no portal | Jose, 12/11, B4 | Regra e rota FEITAS (`app/t/api/pedidos/reagendar`, `lib/pedidos/reagendar*.ts`, `tests/pedidos-pos-*.test.ts`). **Nenhuma tela em `app/t` usa reagendar**; falta o botão e o fluxo |
| N3 | **Falta na prateleira**: item sai do pedido, pedido segue, almox é alertado para acertar o estoque físico | Jose, 12/11, B5 | Servidor FEITO (`faltou` + `motivo_faltou` no 022; aviso `falta_na_prateleira` no 008; commit `52b303c`). Depende do 008 aplicado e do e-mail ligado para o alerta sair. **Sem tela própria** de faltas (o acerto passa por contagem e ajuste, T27/T28, ainda sem tela) |
| N4 | **Aprovação sem escolher nova data: o sistema empurra sozinho** | Jose, 12/11, B3 | FEITO (commit `dcfae69`), com teste |
| N5 | **Sábado não é dia de retirada; aprovou às 16:00 em ponto vale para o dia seguinte** | Jose, 12/11, B1/B2 | FEITO (commit `fe5d14c`), com teste |
| N6 | **Trava de obra encerrada/faturada** | Jose, 12/11, B6: "não precisa.. deixa so pra agora em diante" | **Não existe trava, e foi decidido assim**: o código não trava pela etapa da obra, só recusa obra cancelada ou sem OS, com teste (`cf489dd`). A frase "deixa só pra agora em diante" é ambígua (pode ser "só vale daqui para frente"); a pergunta foi tirada da mensagem de 14/11 ao Jose. Se a leitura do João for outra, é regra nova |
| N7 | **Reconhecer no Omie o movimento que o próprio almox gravou**: a sondagem de 14/11 mostrou que o movimento não traz `cImpApi` nem `cCodIntAjuste` | Sondagem 14/11 | **Decisão pendente.** Recomendação registrada: nova coluna `omie_id_ajuste` em `alx_movimentos` casando com `alx_tarefas_omie.omie_id` (`idAjuste`). Exige **SQL novo** (autorização), mudança em `lib/omie/leitura.ts`/cópia e confirmação no V2 de que o id devolvido na gravação é o mesmo `idAjuste`. Sem isso, a conciliação da fila e a separação "baixa do Field x manual" ficam sem dado. `alx_movimentos.imp_api` e `.cod_int` ficam sempre nulos |
| N8 | **Cadastro dos estoques e primeira cópia de saldos** | João "pode", 14/11 | Dado, não código: gravar BASE, DPSP, PROFARMA e 15 equipes (sem dúvida) e rodar `copia-estoque`. Pendentes do Jose: MANFAC 6, 7 e 19 ("Spot DPSP": contrato DPSP ou Obras/Spot?), MANFAC 4, 8, 10, 21 (inativas no Frotas, estoque existe), MANFAC 23 (sem produto) |
| N9 | **E-mail pela mesma credencial SMTP do Compras (Locaweb)** | João, 14/11 | Configuração: copiar as `SMTP_*` do Compras/hub para `ALX_SMTP_*` no EasyPanel. Falta ainda aprovar textos e destinatários (T16) |
| N10 | **Decisões abertas de 12/11 que mudam código** | `docs/validacoes.md` | Bloquear novo pedido com cópia velha (hoje só avisa); aprovador ver Estoque; PIN de 6 dígitos fixos e regra de suspensão; biblioteca de PDF; pasta `almox-arquivos` (SQL em produção); quem vê indicadores; centro de custo da reposição do BASE |
| N11 | **Ajuste de telas sem mockup aprovado** | `resumo-da-madrugada` | Papéis, Configurações, Estrutura e Mínimos foram construídas sem mockup aprovado; Mínimos difere do mockup 2B. Entram na próxima rodada de mockup; podem gerar retrabalho |
| N12 | **Backlog da revisão de 14/11 (6 itens, nenhum bloqueador)** | `docs/validacoes.md` | Ex.: "falta entrada no Omie" deve ignorar `CAN`; `idMov` repetido derruba a gravação do local; comentário velho em `lib/estoque/movimentos.ts` |
| N13 | **SQL de agendamento dos demais jobs** | Plano espalhava isso por task | Escrever e aplicar os `cron.schedule` de avisos, Omie, não retirado, reposição, inventário, indicadores (hoje só o 004 existe) |
| N14 | **Carga inicial de ferramentas direto no banco** | João, 12/11, C3 | Substitui a tela de importação; o João manda a planilha. Falta receber o material |
| N15 | **Registro de material do cliente** | regra do projeto | Os pedidos de 14/11 (e-mail do almox e relatório de Obras) já estão em `docs/cliente/2026-11-14-joao-email-almox-e-relatorio-obras.md`. O relatório diário do painel de Obras parar de ir ao João é do app do hub (`OBRAS_RELATORIO_SEM_ENVIO`), não do almox |

## Dependências externas que travam o fechamento (em ordem do que destrava mais)

1. Teste de 1 unidade com o Jose (Omie e Field): fecha V1, V2 e V3, e é o que permite ligar
   `GRAVACAO_OMIE_VALIDADA` (sem isso transferência, retirada, ajuste e EPI não gravam no Omie).
2. Aprovação dos mockups 2A e 2B pelo Jose: destrava as ~18 telas.
3. Autorização do João para aplicar os SQL 004, 008, 013, 014, 015, 016, 020, 021 (e o futuro
   024+ da coluna do `idAjuste` e do bucket de arquivos).
4. Papéis criados pelo Jose (almoxarife, gestor, aprovador): sem papel ninguém entra.
5. Decisões do João listadas em N10; e sobre T31.
6. Medir V6 (movimento `COM`) e V9 (OS no movimento).
