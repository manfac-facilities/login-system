# Almoxarifado — prontidão para o piloto (avaliação de 18/11/2026, noite)

Levantamento feito só com leitura: código em `C:\Users\joao-\almox` (branch `fase-1`, HEAD `c859c7a`),
banco de produção `iyytcavcgukfjnjjrerx` (só SELECT) e GET em páginas públicas de
`hub.manfac.com.br/almox`. Nada foi alterado, aplicado ou gravado. Não rodei `tsc`, testes nem build.
As telas de **Retirada com assinatura** e **Falhas no Omie** estão sendo feitas em outros worktrees e
não foram avaliadas (contei que vão existir).

**Versão no ar:** os chunks de `/almox` têm `Last-Modified: 18/11/2026 00:10 UTC` (17/11, 21:10 em
Brasília), depois do merge da Separação (`18913fe`, 17/11 18:12). Então Colaboradores e Separação
estão no ar; o último commit (`c859c7a`) só mexe em documentação.

**Fato que pesa sobre tudo:** o fluxo **nunca rodou em produção**. Em produção não existe nenhum
papel, colaborador, convite, acesso com PIN, sessão de portal, pedido nem tarefa do Omie (todas as
tabelas vazias). Em `alx_eventos` só existem 42 `cadastro_criado` (o cadastro da estrutura).
`/almox-teste` não está no ar (GET devolve 307 para o login do hub).

## O fluxo, passo a passo

| # | Passo | Situação | Prova |
|---|---|---|---|
| 1 | Almoxarife cadastra o técnico e gera o convite | **FUNCIONA** no código, nunca foi usado | Tela `app/(modulo)/colaboradores` no ar. Só admin do hub ou almoxarife (`lib/colaboradores/actions.ts:42-45`). O link sai como `https://hub.manfac.com.br/almox/t/convite/<token>` (`actions.ts:151-158`; `NEXT_PUBLIC_APP_URL` fixado no `Dockerfile:20`). Com celular válido (10 ou 11 dígitos), aparece o botão **WhatsApp** (`wa.me/55…`, com a mensagem pronta, em `lib/colaboradores/convite-texto.ts`); sem celular, só dá para copiar o link. Vale 7 dias (padrão `convite_dias`). A equipe é opcional no cadastro, mas sem ela o técnico não consegue pedir (`lib/pedidos/portal.ts:30-32`) |
| 2 | Técnico abre o convite no celular, sem conta do hub, cria o PIN e entra | **FUNCIONA** (as páginas); **NÃO DÁ PARA SABER** (o envio do PIN) | GET sem login: `/almox/t/entrar` 200, `/almox/t/convite/abc` 200, `/almox/t/novo` 200; `/almox` 307 para o login do hub. Quem deixa passar é o `proxy.ts` do almox (`isPortalDoTecnico`, `lib/auth/porteiro.ts`); o `middleware.ts` do hub não entra no caminho. O POST que cria o PIN (`app/t/api/convite`) não foi testado, porque POST estava fora do escopo. A origem é conferida contra `NEXT_PUBLIC_APP_URL`, e cabeçalho `Sec-Fetch-Site` ausente é aceito (`lib/portal/origem.ts:50-54`); celular antigo não deve ser barrado |
| 3 | Técnico monta o pedido e envia | **FUNCIONA** no código, com ressalvas | `lib/pedidos/tecnico-servidor.ts`. O catálogo **não é o estoque da equipe**: é o estoque do **contrato** (para a MANFAC 3, a DPSP, com 62 itens ativos com saldo), mais asterisco para o que existe na BASE ou na PROFARMA (`lib/pedidos/portal.ts:72-95`). Item sem saldo é recusado (`lib/pedidos/tecnico.ts:238`). Os saldos são de **17/11, 15:10 UTC** (cópia manual) e não se atualizam sozinhos (passo 6). A busca de OS (Obra/Spot) lê `obras_obra` |
| 4 | Aprovador recebe e aprova | **QUEBRA** | `alx_papeis` está **vazio** em produção. O admin do hub **não aprova** por ser admin: `almox_aprova_contrato` só aceita `gestor` ou `aprovador` daquele contrato (`supabase/hub-install/001_alx_acesso_papeis_config.sql:174-198`, que diz "Admin não aprova pedido por ser admin"; mesma regra em `lib/auth/permissoes.ts`, `podeAprovar`). Sem ninguém com o papel, todo pedido fica parado em pendente. **Aviso:** o SQL 008 não está aplicado (a tabela `alx_avisos` e as funções `alx_avisos_registrar/pegar/confirmar_trava/resultado/app_marcar` não existem) e `ENVIO_DE_EMAIL_LIGADO = false`. O aprovador **não fica sabendo** de pedido novo: o item "Aprovação" do menu não tem contador (`lib/moldura.ts:25-29`, `contador: null`) e a tela inicial diz só "Em construção." (`app/(modulo)/page.tsx`). Isso não derruba nada, porque o aviso nunca lança (`lib/avisos/avisar.ts:424-454`) |
| 5a | Almoxarife separa | **FUNCIONA** no código | Tela `app/(modulo)/pedidos/separacao` no ar, só para admin do hub ou almoxarife (`separacao/page.tsx:18-25`). Mostra a lista do dia de retirada |
| 5b | Retirada com assinatura | (em construção, não avaliada) | Depende da pasta `almox-arquivos`, que **não existe** (`storage.buckets` sem nenhum `almox%`) e é usada em `lib/assinaturas/guardador-supabase.ts:10`. O SQL 024 está na frente da Retirada; o João autorizou em 18/11 |
| 5c | Fila do Omie grava a transferência | **QUEBRA** | `GRAVACAO_OMIE_VALIDADA = false` (`lib/omie/movimentos.ts:25`). Com isso, toda tarefa vira `falha` com a mensagem "gravação no Omie ainda não validada" (`lib/fila/gravador.ts:146`, `lib/fila/executar.ts`, `semGravar`). O João autorizou ligar no início do piloto. Ver também o item 3 dos bloqueios de código (consulta por código não medida) |
| 6 | A fila roda sozinha? A cópia Omie→almox roda? | **QUEBRA** | `select … from cron.job where jobname like 'almox%' or command ilike '%almox%'` volta **vazio**: não há nenhum job. Para a fila do Omie **não existe nem o SQL** do agendamento: o único `cron.schedule` do repositório é o do 004, com três jobs de cópia. Nenhuma ação de tela chama `rodarFilaOmie`; só a rota `app/api/tarefas/omie/route.ts:18`, feita para o agendador. A cópia também não roda sozinha: o 004 não está aplicado e o cofre **não tem** nenhum segredo `almox%` (`vault.secrets`). Últimas cópias em `alx_sincronizacoes`: saldos 17/11 15:10 UTC, produtos e locais 14/11, movimentos 14/11. A fila **não depende** do 008 nem do 004: precisa de um job próprio, com o segredo dele. O `ALX_CRON_SECRET` existe no EasyPanel, porque a rota de cópia respondeu 202 e copiou em 17/11 (`docs/cliente/2026-11-17-almoxarifado-autorizacao-gravacao-e-cadastro.md`) |
| 7 | Dados mínimos | **PARCIAL** | Detalhe abaixo |

### Passo 7 — dados em produção (consultados em 18/11)

- **Estrutura: OK.** 21 estoques, 3 contratos e 18 equipes, todos ativos.
  - MANFAC 3: contrato DPSP, local Omie 10170713238, 36 itens com saldo. Pede da DPSP (local
    10167614709, 62 itens ativos com saldo).
  - MANFAC 6: contrato Obras/Spot, local Omie 10170713432, só 12 itens com saldo. Pede da BASE
    (local 10152414293, 100 itens com saldo).
  - `field_storage_external_id` está vazio em todas as equipes. O piloto não usa esse campo; o almox
    não grava no Field.
  - `centro_custo` está vazio nos contratos. Também não é usado no caminho do piloto (só na
    reposição).
- **Catálogo:** 1.273 produtos, 946 ativos.
- **Papéis: nenhum.** `alx_papeis` está vazio. Os três admins do hub entram no módulo: jose.guilherme,
  jvictorco28 e eduardo.maia (`hub_user_roles`, nível `administrador`). Nenhum dos três aprova.
- **Colaboradores: nenhum** (`alx_colaboradores` vazio).
- **Configurações: nenhuma linha** em `alx_configuracoes`, então valem os padrões
  (`lib/configuracoes/definicoes.ts:114-140`): retirada de segunda a sexta até 10:00, corte às
  16:00, antecedência de 1 dia útil (2 depois do corte) e **feriados vazios**.

## O que BLOQUEIA o piloto

### (a) Código ou SQL a fazer

1. **Não existe agendamento da fila do Omie.**
   - O que mostra: `cron.job` não tem nenhum `almox-%`; não há `cron.schedule` para
     `/api/tarefas/omie` em `supabase/hub-install/`; `rodarFilaOmie` só é chamado em
     `app/api/tarefas/omie/route.ts:18`.
   - O que fazer: escrever um SQL novo (`025_alx_agendador_fila.sql`, no molde do 004) com um job
     `almox-producao-omie` e os segredos no cofre.
   - Sem isso, mesmo com a gravação ligada, o que foi retirado nunca chega ao Omie. A saída
     provisória é alguém chamar a rota à mão com o segredo depois de cada retirada.
2. **A gravação está desligada:** `lib/omie/movimentos.ts:25`, `GRAVACAO_OMIE_VALIDADA = false`.
   Trocar para `true` exige commit e Deploy. Já está autorizado para o início do piloto.
3. **A consulta por código no Omie nunca foi medida. Pode impedir qualquer gravação.**
   - O primeiro passo de toda tarefa é `ConsultarAjusteEstoque` com `{ cod_int_ajuste }`
     (`lib/fila/executar.ts:234`; `lib/omie/movimentos.ts:52-57` e `134-136`). O próprio código
     anota "sem evidência de que aceite `cod_int_ajuste`".
   - Se a chamada não existir, ou se a resposta de "não achei" não trouxer uma das marcas de
     `lib/omie/cliente.ts:83` ("nao existem registros", "no existen registros", "nao cadastrado"),
     a tarefa nunca grava. Ela volta para pendente e, na última tentativa, vira falha.
   - Não duplica nada, mas o piloto ficaria sem baixa no Omie.
   - Medir com uma leitura: o `CLAUDE.md` do almox, regra 4, diz que leitura do Omie de produção é
     livre. Se não funcionar, trocar por uma varredura do `ListarAjusteEstoque`.
   - Status: **NÃO DÁ PARA SABER** sem chamar o Omie, e eu não chamei.
4. **A pasta `almox-arquivos` não existe** (`storage.buckets`). Sem ela a assinatura da retirada não
   é guardada (`lib/assinaturas/guardador-supabase.ts:10`). Faz parte da frente da Retirada (SQL 024).

### (b) Decisão ou dado que só o João ou o Jose podem dar

1. **Quem aprova.** Sem isso, nenhum pedido passa do passo 4.
   - Para a MANFAC 3, precisa de um `aprovador` com contrato **DPSP**, ou de alguém com papel
     `gestor`. Para a MANFAC 6, de um `aprovador` com contrato **Obras/Spot**.
   - A pessoa precisa ter conta no hub: `concederPapelAction` recusa e-mail sem conta
     (`lib/papeis/actions.ts:38-49`).
   - Um admin concede pela tela `/almox/papeis`, sem SQL.
   - Se o próprio Jose for aprovar, ele também precisa do papel, porque admin não aprova.
2. **Quem é o almoxarife** que cadastra, separa e entrega.
   - Se for um dos três admins do hub, já funciona.
   - Se for outra pessoa, precisa do papel `almoxarife` e do link direto
     `hub.manfac.com.br/almox`: o card do hub só aparece para admin
     (`app/(dashboard)/dashboard/page.tsx:167`, `{admin && …}`).
3. **Qual equipe, e quem são os técnicos dela** (nome e celular, para o WhatsApp).
   - `alx_colaboradores` está vazio. O cadastro é feito pela tela, por um admin ou almoxarife.
   - **Recomendo a MANFAC 3.** O único movimento já medido no Omie é a transferência DPSP → MANFAC 3
     (`docs/validacoes.md:588-627`).
   - Na MANFAC 6, que é Obras/Spot, todo pedido com destino Obra/Spot vira saída (`SAI`,
     `lib/pedidos/retirada.ts:211-218`), tipo que **nunca foi medido** no Omie. Ela também tem
     pouco saldo (12 itens).
4. **Feriado de 20/11 não cadastrado.**
   - Com os feriados vazios, um pedido aprovado na quinta, 19/11, antes das 16h, ganha retirada
     padrão na **sexta, 20/11**, que é feriado nacional (Consciência Negra).
   - O que fazer: cadastrar `2026-11-20` em Configurações (só admin) antes do primeiro pedido.
   - Vale combinar a expectativa. Pela regra de 1 dia útil de antecedência, o primeiro pedido de
     quinta só é retirado na **segunda, 23/11**, a não ser que seja marcado como emergencial, com
     motivo.
5. **Autorizar o SQL do agendador da fila** (item a1) e criar o segredo no cofre. Pelo 004, quem
   cria os segredos à mão é o Jose.
   - Junto, decidir se aplica também o **004** (cópia de saldos a cada 10 minutos), que exige três
     segredos `almox_producao_*`.
   - Sem o 004, os saldos mostrados ao técnico ficam congelados em 17/11. Não é perigoso: a fila
     relê o saldo no Omie antes de gravar (`lib/fila/executar.ts:240-250`) e a falta na prateleira
     é tratada na separação. Mas o técnico vai ver "disponível" errado.
   - Mínimo: disparar a cópia à mão na manhã do piloto.
6. **Como o aprovador fica sabendo de um pedido novo.** E-mail desligado, SQL 008 não aplicado, sem
   contador na tela. A decisão prática é avisar pelo WhatsApp e combinar que ele olhe
   `/almox/pedidos`. A outra opção é autorizar o 008 e ligar o e-mail, o que exige
   `ALX_SMTP_*` no EasyPanel e textos aprovados.
7. **Ensaio antes dos técnicos.** Nada desse fluxo rodou em produção. Recomendo um ensaio com um
   colaborador de teste (convite → PIN → pedido → aprovação → separação), com a gravação no Omie
   ainda desligada. O ensaio grava dados de verdade no banco (pedido e colaborador de teste, que
   depois são cancelados ou bloqueados), por isso depende do ok do João.

## O que não bloqueia, mas é para acompanhar no primeiro dia

- **Limite de tentativas por IP** (60 a cada 5 minutos) usa o último `X-Forwarded-For`. Depois dos
  primeiros acessos, rodar `select ip, count(*) from public.alx_sessoes group by ip`. Se todos os IPs
  forem o mesmo IP privado, todo mundo divide o limite (`docs/validacoes.md:636-649`). Com uma
  equipe, não deve travar.
- **Diálogo de Colaboradores** mostra "Ninguém com esse nome entre os ativos do RH" antes de digitar
  (bug conhecido, só visual).
- **Texto da Separação** diz "Você acompanha a separação pelo e-mail de OK", mas o e-mail está
  desligado (`separacao/page.tsx:25`).
- **Pedido não retirado** não é tratado sozinho: `app/api/tarefas/pedidos` não tem job.
- **Não verificado:** o envio do PIN (POST do convite), a tela de aprovação lendo o pedido com a
  sessão de quem aprova e as variáveis `OMIE_*` no EasyPanel. Estas últimas provavelmente existem,
  porque a cópia de 17/11 leu o Omie pela rota de produção.
