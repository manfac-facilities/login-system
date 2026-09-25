# Estado da frente — Sistema de Controle de Obras (COP)

## ▶ Retomar aqui — 24/09/2026

**Prazo:** entrega final ao cliente em **28/09/2026, segunda**. Dias úteis restantes: 25/09 e 28/09.

### No ar

| O quê | Quando | Evidência |
|---|---|---|
| Ajustes da ficha (nome da etapa, data de fechamento da OS, equipe em texto livre) + faixa "Novidade" | Deploy 23/09 19:38 UTC, master `2b7d2fa` | `.claude/rules/obras.md`, seção "Estado em 23/09/2026" |
| Cancelamento de obra (merge `fed48eb`) + dívidas A1/A13/B5/B7 da ficha (merge `29b526e`) | Deploy 24/09 14:03 UTC, master `3f08943` | Conferido pelo `Last-Modified` dos chunks (fato confirmado pelo coordenador); `.claude/rules/obras.md` |
| Migration `obras-cancelamento` (etapa `cancelado`, colunas `cancelado_*`, trigger, RPC) | Aplicada em produção 23/09, 11/11 + teste 11/11 `OK` | `.claude/rules/sql.md`, tabela de migrations |
| Comunicado 01 (ajustes da ficha) | Publicado na faixa 23/09 19:52 UTC | `docs/cliente/2026-09-23-comunicado-01-ajustes-da-ficha.md` |

### Pronto, esperando algo

- **Busca por loja ou OS na Base** — pedido do João 24/09, mockup aprovado ("busca aprovada, pode
  codar"), spec `spec-busca-base-2026-09-24.md`, merge `a82e3aa` no master e no GitHub. Revisão
  independente aprovou sem bloqueante (backlog em A37). **Falta o deploy.**

- **Comunicado 02 (cancelamento) + guia do cancelamento** — texto e código prontos (`e025ce4`).
  Falta o OK da equipe pelo roteiro de teste antes de publicar.
- **E-mail dos comunicados** — código existe, roda em modo simulação. Falta Resend + DNS
  (Locaweb) + chave, trabalho do João.
- **"Pendente faturamento na esteira"** — mockup com as 3 leituras do pedido (A renomear / B
  grupo próprio / C já é assim hoje na ficha) publicado:
  https://claude.ai/artifact/TSpFGfSj1Ez9caMEoSmEjc. Recomendação do coordenador: **B** — separa
  o cartão/filtro "Pendente faturamento" do resto de "ainda na esteira", sem mexer no Kanban (que
  já separa por coluna). Aguardando o cliente escolher.
- **Roteiro de teste da equipe** (cancelamento + ajustes da ficha), publicado 24/09:
  https://claude.ai/artifact/VULi23tvCDBd6xs73Njyzb. Aguardando retorno pelo WhatsApp.
- **Pergunta 03 do cliente** ("como calcula o avanço %?") — texto pronto desde 31/08, **adiada
  pelo João em 24/09** ("não é relevante agora") — `docs/DIVIDAS.md`, item B2.

### Em andamento

- **Duda — D5** (validar o operacional ponta a ponta): em curso com uma OS de teste real do
  Field, identificador **"TESTE D5"** (loja "DPSP Matriz" no hub), criada a pedido do João —
  decisão dele foi usar OS de teste, não obra real, porque o roteiro cria diário/tarefa/foto
  antes de desfazer. Entrou no hub pela sincronização incremental em ~2,5 min (18:20:07 UTC).
  No fim, a OS será cancelada no hub pela Manfac, com observação "OS de teste da D5".
  (`docs/onboarding-duda/entregas/2026-09-24-D5-pergunta-obra-de-teste-duda.md`)
  **24/09, fim do dia:** roteiro operacional passou sem falha
  (`docs/onboarding-duda/entregas/2026-09-24-D5-resultado-mensagem-do-duda.md`). Limpeza
  conferida no banco pelo coordenador: TESTE D5 `cancelado`/`manfac`, obs "OS de teste da D5",
  0 diários, 1 tarefa (Material/Roberta) `respondida` preservada. Commit citado por ele
  (`1e6cfd9`) **não está no GitHub**. Faltam 3 dos 10 itens: ausência em duas varreduras
  completas, tela de sincronização, foto em "Evolução em fotos". Nenhuma foto de diário existe
  ainda em produção — a primeira foto real da equipe será a primeira a aparecer na ficha.
- **Duda — D6** (mockup do dashboard de saúde da operação): próxima frente dele, ainda sem
  mockup. **Não está travada por RLS** (conferido em produção 24/09): a policy
  `"obras sync admin"` de `obras_sync_execucao` **já** deixa admin ler (`obras_is_admin()`). Se a
  tela for para admin, nada muda no banco. Só vira mudança de policy se o mockup mostrar a saúde
  da sincronização para quem **não** é admin — aí é decisão do João, depois do mockup.
- **Duda — D7** (dívidas da área dele: A14, A15, teste instável de `_blocos-editaveis.test.tsx`).

### Esperando decisão/retorno

- **Do cliente:** roteiro de teste do cancelamento e da ficha (link acima); escolha entre as
  leituras A/B/C do "pendente faturamento"; visão do dono da Pacheco (mockup de 18/09, parado,
  fora da divisão de 23/09 por decisão do João).
- **Do João:** publicar o comunicado 02 depois do OK da equipe.

### Fora da divisão de trabalho por decisão do João (23/09)

Visão do dono da Pacheco, agentes de cobrança por WhatsApp, manutenção real do Cockpit —
nenhum dos três entra no trabalho até 28/09.

### Próximos passos

1. Equipe testar o roteiro publicado e o João repassar o retorno pelo WhatsApp.
2. Cliente escolher a leitura do "pendente faturamento" (A/B/C).
3. D6 segue sem esperar RLS (policy atual já atende tela de admin; ver "Em andamento").
4. Publicar o comunicado 02 após o OK da equipe.
5. Duda seguir D5 → D6 (mockup) → D7.
6. Resend + DNS para o e-mail dos comunicados sair de verdade (João).

### Dívidas fechadas em 24/09 (revisão sem bloqueante)

A1, A13, A16, B5, B7 — ver `.claude/rules/obras.md` e `review-dividas-ficha-2026-09-24.md`.
Bordas novas registradas em A31–A36 (`docs/DIVIDAS.md`), nenhuma bloqueante.

### Links desta seção

- Mockup "pendente faturamento": https://claude.ai/artifact/TSpFGfSj1Ez9caMEoSmEjc
- Roteiro de teste (cancelamento + ficha): https://claude.ai/artifact/VULi23tvCDBd6xs73Njyzb

---

## ▶ Retomar aqui — 20/09/2026, tarde (histórico)

**Prazo:** operando **amanhã, 21/09**. Projeto final em 28/09. **19/09 passou sem commit e sem
deploy** — como 17/09 já havia passado.

**Foco decidido pelo João hoje:** pôr a **ficha editável** no ar. O resto espera.

### ✅ O BANCO JÁ ESTÁ PRONTO. Falta só o deploy, e ele está travado fora daqui

**As duas migrations foram aplicadas em produção hoje, 20/09**, pela Management API, e
verificadas:

| Migration | Verificação |
|---|---|
| `sdd-sql-obras-historico.sql` | tabela `obras_historico`, RPC `obras_aplicar_alteracao`, RLS ligada — 4/4 OK |
| `sdd-sql-obras-motivos-remarcacao.sql` | **18 linhas, todas `OK`** |

Depois delas: 8 tabelas `obras_*`, **6 motivos de fábrica**, **77 obras** (eram 64 em 16/09 — o
sync trouxe 13), 0 linhas no histórico (esperado, o código que grava ainda não subiu).

> **Migration sem deploy não quebra nada.** As duas só acrescentam objetos; o código no ar não
> os usa. A ficha segue só leitura, como antes. Não há estado pela metade esperando ninguém.

**⛔ O deploy está bloqueado por credencial que não é nossa:** o código de acesso ao EasyPanel
está **com o cliente**, e o João só consegue clicar em Deploy quando ele mandar. Isso é novo —
até aqui a barreira do deploy era disponibilidade do João, não credencial de terceiro.
**Se o código não chegar hoje, o prazo de 21/09 não se cumpre**, porque nenhum código de 18/09
entra sem esse clique.

### ✅ A colisão do cron das 06:05 foi corrigida hoje

`obras-field-completa` saiu de `5 6 * * *` para **`2 6 * * *`**, por `cron.alter_job`. Confirmado
no `cron.job` depois da mudança.

**E o estrago era maior do que esta página registrava.** A anotação de 18/09 dizia "roda uns
dias sim, outros não". O banco desmente — `obras_sync_execucao` por dia:

| Dia | Completas | Incrementais |
|---|---|---|
| 16/09 | 4 | 246 |
| 17/09 | **0** | 288 |
| 18/09 | **0** | 288 |
| 19/09 | **0** | 288 |
| 20/09 | **0** | 285 |

**A varredura completa não rodava desde 16/09 — quatro dias seguidos.** A incremental vencia a
corrida pela trava todo dia, de forma consistente, não aleatória. Como ela é a única que detecta
OS arquivada ou sumida no Field, o sistema passou quatro dias cego para remoção.
**Conferir amanhã depois das 06:02 que a completa voltou a aparecer** em `obras_sync_execucao`.

### Acessos, medidos hoje

`hub_system_access` com slug `obras`: **4 e-mails** — gabriel.lima, gabriel.vidal, luana.silva,
yuri.moreira. Confirma a correção feita hoje no `AGENTS.md`.

⚠️ **Nenhum desses 4 tem linha em `hub_user_roles`.** A tabela só tem 4 pessoas: eduardo.maia,
jose.guilherme e jvictorco28 (administradores) e igor.jesus (analista). Falta confirmar se os 4
têm conta em `auth.users` — sem conta não entram, por mais que o slug esteja liberado.

### O que foi medido hoje, e não deduzido

| O quê | Estado em 20/09 |
|---|---|
| Código | `master` = `origin/master`, HEAD `891a132`, árvore limpa |
| Produção | Build de **16/09 16:23:42 GMT** — todos os chunks no mesmo timestamp |
| Migrations da ficha | `sdd-sql-obras-historico.sql` e `sdd-sql-obras-motivos-remarcacao.sql` **não aplicadas** |
| Chave da Supabase (PAT) | **ainda 401** — `C:\Users\joao-\.supabase-pat` segue expirada desde 18/09 |
| Suíte | 82 suites do hub verdes, **1015 testes, 0 falhas** |

**Consequência direta: nada do trabalho de 18/09 está no ar.** Os quatro commits da ficha
editável, a remarcação e o fix da queda de rede no Salvar (`d5b6ce3`) estão pushados e parados.

### ⚠️ As 7 suites que "falham" não são do hub

`npm test` na raiz devolve `7 failed`. Todas em `manfac-site/` — o site institucional, que tem
`node_modules` próprio e deploy próprio, e que o `jest.config.ts` da raiz varre sem querer
(`testPathIgnorePatterns` só ignora `node_modules/` e `.claude/worktrees/`). O erro é
`Cannot find module` na resolução dos imports, não asserção quebrada.

**Não perca tempo investigando isso ao retomar:** é ruído de configuração, pré-existente, sem
relação com obras. O número que importa é o das outras 82 suites.

### O caminho crítico, na ordem que não se inverte

1. **João:** gerar PAT novo em Dashboard → Account → Access Tokens e gravar com
   `Set-Content -NoNewline C:\Users\joao-\.supabase-pat 'sbp_...'`, **por um PowerShell dele**.
2. **Claude:** aplicar as duas migrations na ordem e conferir as 18 linhas `OK`.
3. **João:** clicar em Deploy no `manfac-login-system`.
4. **Claude:** confirmar o build pelos timestamps dos chunks + teste de fumaça (passo 5 do
   `RUNBOOK-ficha-editavel-2026-09-18.md`).

Deploy sem as migrations quebra a gravação da ficha; migration sem deploy não quebra nada.

### Correção do AGENTS.md feita hoje

O `AGENTS.md` afirmava que **ninguém** tinha o slug `obras` liberado e que o Yuri não tinha
conta. Era o retrato de 16/09. A medição de 18/09 registrada abaixo mostra **4 e-mails com o
slug** — gabriel.lima, gabriel.vidal, luana.silva e yuri.moreira. Corrigido no mesmo commit.
Reconfirmar no banco quando a chave voltar.

## ▶ Retomar aqui — 18/09/2026, manhã

**Prazo:** operando na **segunda, 21/09** (o cliente dispensa quem faz o controle hoje);
projeto final em **28/09**. Restam 18 e 19/09 úteis. **17/09 passou sem commit e sem deploy.**

**Corte de escopo decidido pelo João em 18/09:** entra primeiro a **ficha editável + a
remarcação**. O histórico de alterações (Parte 2) sai desta entrega.

**Verificado em produção hoje (18/09):**
- Build no ar: 16/09 16:23 GMT. Nenhum commit novo desde `6272343`.
- 64 obras, loja com o nome certo ("DP LEBLON 6"), 0 falhas de sincronização nas últimas 24h.
- 4 e-mails com o slug `obras` liberado: gabriel.lima, gabriel.vidal, luana.silva, yuri.moreira.

### ⚠️ A varredura diária é perdida quando colide com a de 5 minutos

Os dois jobs disparam no mesmo minuto às 06:05 UTC (`*/5 * * * *` e `5 6 * * *`). Quem chega
primeiro toma a trava `obras_sync_execucao_uma_rodando`; o outro recebe **409
`ja_estava_rodando`** (`app/api/obras/sincronizar/route.ts:56`) e **morre em silêncio** — não
grava linha em `obras_sync_execucao` nem erro em lugar nenhum.

Medido: em **16/09** a completa venceu e rodou às 06:05:00.98; em **17/09** a incremental
venceu (06:05:00.69) e **a completa do dia não existiu**. O `cron.job_run_details` diz
`succeeded` nos dois casos, porque para o `pg_cron` a chamada HTTP foi feita — o sinal real é
a linha em `obras_sync_execucao`.

**Por que importa:** a completa é a **única** que detecta OS arquivada ou sumida no Field.
Do jeito que está, ela roda uns dias sim, outros não, sem aviso.

**Correção proposta (pendente da chave da Supabase voltar):** mover a completa para um minuto
fora do ciclo de 5 — `select cron.alter_job((select jobid from cron.job where jobname =
'obras-field-completa'), schedule => '2 6 * * *');`. Se a completa ainda estiver rodando às
06:05, a incremental daquele horário é recusada e não se perde nada: a seguinte lê tudo desde
a última marca d'água.


### ✅ 18/09, fim do dia — a ficha editável está pronta no código

Quatro commits, todos com a suíte verde: **25 suites, 598 testes, 0 falhas**, `tsc` 0,
`eslint` 0, `npm run build` passando. **Nada disso está em produção** — falta aplicar duas
migrations e deployar. O passo a passo está em `RUNBOOK-ficha-editavel-2026-09-18.md`.

O que entrou: os três blocos editáveis (Autorização, Identificação, Cronograma) com Editar /
Salvar / Cancelar próprios, a remarcação com motivo obrigatório vindo do banco, o bloco
"Dados da obra" na Triagem, seis Server Actions e a migration dos motivos.

**Três defeitos achados por revisão independente, não por teste:**

1. **O teste da guarda de autorização não discriminava nada.** Em JS `!x` já barra `null` e
   `undefined`, então testar esses dois é enfeite; o que discrimina é o truthy que não é
   `true`. Com a tabela refeita, mutar `!== true` para `!` derruba 10 testes — antes, zero.
2. **A RPC contradizia o app sobre apagar a data de início.** O app trata como remarcação (com
   teste); o SQL recusava com `22023`. Corrigido no SQL, que era o lado errado: a data
   combinada deixar de valer é exatamente o que a remarcação registra.
3. **A Triagem mostrava a coluna errada duas vezes.** "Entrou pelo Field em {aprovacao}" e o
   número de dias ao lado vinham da MESMA coluna errada. Corrigir só a data teria deixado
   metade do bug: assim que a ficha gravasse `aprovacao`, a tela contaria dias desde a
   aprovação da OS chamando isso de entrada.

**Degradação silenciosa tratada:** sem a migration aplicada a lista de motivos volta vazia, o
botão de remarcar nunca habilita e ninguém descobre por quê. Agora a janela diz.

**Mockup v03 em linguagem leiga publicado e entregue ao João para enviar ao cliente:**
https://claude.ai/artifact/4saEUo8PkDGSsBZUizuNXg — revisado por agente independente, que
pegou um filtro chamado "Esperando começar" listando obra já executada.

**Fica para depois, por decisão de escopo:** a tela do histórico, os dois contadores de prazo
e a migração de `liberarObraAction` para o caminho do histórico (a liberação não aparece lá).

### ⚠️ A chave da Supabase (PAT) expirou

`C:\Users\joao-\.supabase-pat` (criada em 10/09) passou a responder **401** em 18/09 —
funcionava em 17/09. Sem ela não há leitura nem escrita no banco de produção pela Management
API: nem a correção do cron acima, nem migration nova. O João gera outra em Dashboard →
Account → Access Tokens e grava no mesmo arquivo, por um PowerShell dele — **nunca pelo `!` do
chat**, que traz o valor para o contexto.

### Em andamento agora

- **Mockup v03 em linguagem leiga** (`mockup-j4-v03.html`): o v02 tem vocabulário nosso
  ("SLA 1", "esteira", "triagem", "suposições", "mockup", "diálogo"). Alvo aprovado pelo João:
  trocar os termos e **manter** os blocos "O que você respondeu / O que mudou". Quem envia ao
  cliente é o João, pelo WhatsApp.
- **Spec da ficha editável + remarcação** (`spec-ficha-editavel-2026-09-18.md`).

## ▶ Retomar aqui — 16/09/2026, madrugada

> ## ✅ 03:11 — A PRIMEIRA CARGA ENTROU. O sistema deixou de estar vazio.
>
> Execucao `cf98d8d3-5455-4e53-ac6b-6864f20a7f0a`, disparada pela rota protegida no build de
> 03:07:13 GMT. Duracao: 3 minutos e 8 segundos.
>
> | | |
> |---|---|
> | OS lidas no Field | 185 |
> | **Obras criadas** | **64** |
> | Ignoradas pelo criterio | 121 |
> | Erro | nenhum |
> | No banco | **64 obras, todas em "aguardando definicao"** |
>
> Bateu exatamente com a medicao feita antes (49 pendentes + 14 agendadas + 1 em andamento).
>
> **As tres causas que atrasaram isso em um dia, todas encontradas com prova:**
> 1. `export type` num arquivo `use server` derrubava a tela inteira (`ReferenceError`).
>    Corrigido em `e26d7ce`; teste de regressao em `4071df1` varre os 26 arquivos do hub.
> 2. A `FIELD_API_KEY` nunca chegou ao container desde 14/09.
> 3. Ao cadastra-la, o Environment do EasyPanel perdeu **todas** as variaveis — a armadilha do
>    `NOME=valor` numa linha so, ja documentada em 09/08. Resolvido no deploy de 03:07.
>
> **Sincronizacao automatica LIGADA em 16/09, 03:2x** (`sdd-sql-obras-cron-jobs.sql`, aplicado).
> Pedido do cliente: OS nova no Field tem que aparecer no sistema em 5 minutos ou menos.
> - `obras-field-incremental` — `*/5 * * * *`, le so o que mudou desde a ultima marca d'agua.
> - `obras-field-completa` — `5 6 * * *`, unica que detecta OS arquivada ou sumida; custa ~3 min.
> - O segredo `OBRAS_CRON_SECRET` **nao existia no Vault** e foi criado agora. Sem ele os jobs
>   chamariam a rota sem autorizacao e falhariam em silencio a cada 5 minutos.
> - A trava `obras_sync_execucao_uma_rodando` impede sobreposicao: passada longa nao empilha.
> - **PROVADO ponta a ponta as 03:25 de 16/09:** o `cron.job_run_details` registra o disparo do
>   job as 03:25:00 (`succeeded`); `net._http_response` mostra a rota devolvendo **202** com a
>   execucao `ddc2dccb`; e `obras_sync_execucao` tem a linha `tipo: incremental, origem:
>   agendada, status: sucesso` as 03:25:01 — leu 3 OS mudadas desde a marca d'agua, 1
>   inalterada e **2 ignoradas pelo criterio**. Ou seja, o filtro do cliente vale tambem na
>   varredura automatica.
> - ⚠️ **Armadilha ao verificar isto no futuro:** a rota marca `origem = 'agendada'` para
>   QUALQUER chamada autenticada pelo segredo, inclusive as manuais feitas por nos. O sinal
>   inequivoco de que o agendamento rodou e `tipo = 'incremental'`, ou o proprio
>   `cron.job_run_details` — nao a coluna `origem`.

> **Conferido no banco depois da carga (16/09, 03:15):**
> - As obras entraram integras: numero da OS, loja com endereco completo, descricao real, etapa
>   `definir`, `fonte: field`. Nenhuma tem `aprovacao` — esperado, o Field nao manda essa data.
> - **Ninguem tem o slug `obras` liberado** (`hub_system_access`: 0 linhas). Os **3
>   administradores** ja entram sem liberacao, porque `hasSystemAccess` passa direto para admin.
> - 12 contas no hub. **A Amanda tem conta; o Yuri NAO tem.** Sem conta, ele nao entra, e sem o
>   slug liberado os analistas nao veem o modulo mesmo com conta.
>
> **Proximo passo:** criar a conta do Yuri e liberar o acesso da equipe em `/admin/acessos` e conferir se
> Yuri e Amanda tem conta no hub — sem isso eles nao veem as 64 obras. Depois, a J4 (ficha
> editavel e remarcacao), com o mockup v02 ja publicado esperando aprovacao.
>
> **Aviso para quem for usar a tela:** aba aberta antes do deploy da erro de referencia
> (`Server Reference ID did not match`). Recarregar com Ctrl+Shift+R resolve.

> **03:00 — o Environment do EasyPanel perdeu TODAS as variaveis. E a armadilha ja
> documentada no AGENTS.md, acontecendo de novo.**
>
> Sequencia dos fatos, medidos:
> - 02:48 e 02:55: a rota do cron **autenticou** (o `OBRAS_CRON_SECRET` chegava) e a execucao
>   falhou so pela `FIELD_API_KEY` ausente.
> - O Joao cadastrou a `FIELD_API_KEY` no Environment e deployou (build 03:00:37 GMT).
> - 03:01: a mesma rota passou a responder **`OBRAS_CRON_SECRET nao configurado`** — ou seja,
>   a variavel que funcionava **sumiu**.
>
> **Causa, conforme o AGENTS.md ja registrava desde 09/08:** o campo Environment e uma caixa
> de texto livre onde cada variavel precisa ser `NOME=valor` **na mesma linha**. Uma linha
> malformada faz o painel **nao reconhecer nenhuma**, e o container sobe sem variavel alguma,
> em silencio. A chave do Field provavelmente entrou quebrada em duas linhas e levou o
> segredo do cron junto.
>
> **Correcao:** abrir o Environment do app `manfac-login-system` e deixar CADA variavel numa
> linha unica, sem quebra — `OBRAS_CRON_SECRET=...` e `FIELD_API_KEY=...`. Salvar e deployar.
> **Verificacao objetiva, sem clicar em nada:** `POST /api/obras/sincronizar` sem segredo deve
> responder **401** (segredo presente). Se responder 503 com a mensagem de nao configurado, as
> variaveis continuam sem chegar.

> **02:55 — o deploy NAO resolveu. A FIELD_API_KEY continua sem chegar ao container.**
> Segunda execucao (`44d3038a`), ja no build de 02:53:36 GMT, falhou com a mesma mensagem:
> `FIELD_API_KEY nao esta configurada no servidor`. Banco segue com **0 obras**.
>
> **O que isso prova, e vale nao reinvestigar:**
> - O codigo esta certo e a rota funciona: ela autenticou pelo segredo e executou (HTTP 202).
> - O `OBRAS_CRON_SECRET` **chega** ao processo — logo o Environment do EasyPanel entrega
>   variaveis normalmente. O problema e especifico da linha da `FIELD_API_KEY`.
> - A mensagem so aparece quando a variavel chega **vazia ou ausente**
>   (`_execucao.ts`: `(process.env.FIELD_API_KEY ?? '').trim()`), entao nao e caso de aspas
>   ou espaco no valor: e ausencia mesmo.
>
> **Proximo passo (so o Joao consegue):** no EasyPanel, app `manfac-login-system`, aba
> Environment, conferir se a linha `FIELD_API_KEY=valor` existe de fato, numa linha so;
> salvar e deployar. Conferir tambem se nao foi cadastrada por engano no app `manfac-site`,
> que vive no mesmo projeto e ja causou confusao em 09/08.

> **02:48 — a carga rodou e falhou por configuracao, nao por codigo.** Disparada pela rota
> protegida (`execucaoId 83f34bdc-6e58-4331-9102-2f1e4600438c`, HTTP 202). A linha de execucao
> gravou: `status: falhou`, `erro: "Nao deu para puxar as OS do Field Control. FIELD_API_KEY
> nao esta configurada no servidor"`. O segredo do cron chega ao processo (a rota autenticou),
> **a FIELD_API_KEY nao**. Ela foi posta no EasyPanel em 14/09 e nunca foi verificada dentro do
> container. Correcao: conferir a linha `FIELD_API_KEY=valor` no Environment, numa linha so, e
> **deployar de novo** — mudanca de Environment so entra no container em novo deploy.
>
> **A tela do botao tambem estava quebrada, por outra causa, achada pelo log:** `export type`
> num arquivo `use server` (`ReferenceError: EstadoSincronizacao is not defined`, digest
> 3846726126). Corrigido em `e26d7ce`, ja enviado ao GitHub — o proximo deploy leva junto.
> Testes e tsc nunca pegariam isso: em teste os tipos somem direito.

**O filtro de entrada está NO AR.** Build de 16/09 02:22:51 GMT, 10 chunks no mesmo
timestamp, com os 47 commits do dia (`181ddfd`). A carga passa a trazer só a OS cuja
**última atividade** esteja em **pendente, agendada ou em andamento** — critério final do
cliente (`feedback-20`), com "status" na fala dele significando a **situação** do Field.

**Medido contra o Field real em 15/09 à noite** (`entregas/medicao-criterio-final-2026-09-15.md`):
das 185 OS não arquivadas, **64 entram** (49 pendentes, 14 agendadas, 1 em andamento) e
121 ficam de fora (113 concluídas, 7 reportadas, 1 a caminho). Nenhuma OS sem situação.

**O que falta, na ordem:**

1. O João clicar em **Puxar do Field** em `/obras/sincronizar`, com Ctrl+Shift+R antes. A
   tela leva ~3 minutos: uma consulta por OS, no ritmo de 1 por segundo que a API impõe.
2. **O erro de 15/09 segue sem causa raiz.** O botão respondeu "Não deu para falar com o
   servidor" em menos de 10s. A mensagem é nossa (`_painel.tsx:30`) e só aparece quando a
   chamada falha como requisição. Hipóteses e o que procurar no log estão em
   `investigacao-erro-puxar-field-2026-09-15.md`. Falta a evidência do log do EasyPanel.
3. Depois da carga: conferir quantas obras entraram e liberar o acesso da equipe.

**Mergeadas e no ar hoje:** regra de atenção/crítica (20/30 dias, âncora na data mais antiga
entre entrada, liberação e aprovação) e o histórico de alterações Parte 1. **A migration
`sdd-sql-obras-historico.sql` NÃO foi aplicada** — o histórico só liga na Parte 2, com a J4.

**Mockup J4 v02 publicado** (SUY9Cd59ud9rAD63oFUCqC) e **guia de teste do cliente**
(Ec61mjo7kXf65CRx7QjGbN). Nenhum dos dois foi enviado ao cliente ainda.

**Decisão de processo de 15/09:** acabaram as perguntas ao cliente. O que estiver ambíguo vai
para o João, em linguagem leiga, e ele decide.

Os blocos estão em ordem do mais recente para o mais antigo; do "fim de 14/09" para baixo é o
histórico de 05/09 em diante, mantido como estava.

## ▶ Retomar aqui — fim de 14/09/2026

**No ar:** D1, D2, D2.1 e D3 (build de 15/09 01:08 GMT). **0 obras.** Nada foi puxado do Field.

**Na ordem:**

## ▶ Retomar aqui — 15/09/2026, noite

**Prazo novo:** o cliente quer o sistema **operando em 21/09**, quando dispensa o funcionário
que faz o controle hoje (`feedback-15`). As tarefas dele estão em
`transcricao-reuniao-2026-08-31.md:139-143`. Corte fechado pelo João em 15/09: até **18/09** a
ficha editável, a remarcação, o histórico e a nova regra da crítica; **21–22/09** o botão
"Concluir esta etapa"; **22–23/09** os SLAs, que não calculam antes dos marcos.

**O que trava tudo:** a primeira carga **ainda não foi feita**. O João clica em "Puxar do
Field" em `/obras/sincronizar`. São **185 OS** hoje (eram 175 em 14/09), com a lista literal em
`entregas/os-field-atividade-spot-2026-09-15.xlsx` — a primeira lista salva do Field. Dentro
dela há 3 OS de teste ("TESTE SPOT", "teste4", "testeheleno") e a **OS 7777 aparece com
`archived: false`**, ou seja, o arquivamento que o cliente disse ter feito não pegou.

**Respostas do cliente (feedback 16):** status muda como atividade nova na mesma OS; cancelar
muda o status da atividade; uma OS por obra; pente fino terminado. Não respondeu os dois
exemplos de OS.

**Decisões do João em 15/09** (`decisoes-joao-2026-09-15.md`): etapa "Executado - pendente
aprovação OS"; "Relatório de entrega" continua; SLA 2 conta até a obra ser **faturada**,
amarelo acima de 15 e vermelho acima de 30; motivos de remarcação usam o vocabulário do
`BLOQUEIOS` do Diário; **registrar uma data nunca derruba a contagem** da obra crítica, nem
quando a data nova é a liberação (a âncora inclui a entrada).

**Feito em 15/09:**

| | |
|---|---|
| Guia de teste do cliente | publicado: https://claude.ai/artifact/Ec61mjo7kXf65CRx7QjGbN — 11 testes (T1–T11), pré-requisitos, limites e o que falta. Base: `status-testavel-2026-09-15.md` |
| Conselho das 4 perguntas | 4 pareceres (`conselho-4-perguntas-*.md`). Veredito: só o fim do SLA 2 tinha peso; a pergunta sobre o funcionário já estava respondida na transcrição de 31/08 |
| Regra da crítica | spec + plano + implementação na worktree `worktree-agent-ab4c29b5eb1b12b0b`. **Achado: os limiares reais eram 100 (crítica) e 60 (atenção), contando só de `aprovacao`** — os 20/30 do cliente são mudança de regra. Task 5 (decisão 12) bloqueada até alguém gravar `marco_faturou` |
| Histórico de alterações | spec + plano + Parte 1 na worktree `worktree-agent-aec15e14f7f4ed10e`: migration `sdd-sql-obras-historico.sql` (**não aplicada**), `_lib/historico.ts`, `_historico.tsx`. Parte 2 (ligar nas actions) espera a J4 |
| Mockup J4 v02 | `mockup-j4-v02.html`, com A–F ajustadas, a seção F de SLAs nova e uma seção de suposições declaradas. Falta publicar |

**Nenhuma das duas worktrees foi mergeada nem deployada.** Migration do histórico não aplicada.

> **15/09, manhã — item 1 resolvido.** `POST /api/obras/sincronizar` sem segredo responde
> **401**; build de 15/09 01:43:03 GMT, 10 chunks no mesmo timestamp. **Novo fato:** o cliente
> pressionou por prazo e disse que em **21/09** vai dispensar um funcionário "por causa do
> sistema" (`feedback-15-prazo-21-09-funcionario.md`) — o cronograma de 14/09 prevê **28/09**.

1. ~~**`OBRAS_CRON_SECRET` não chegou ao processo.**~~ Resolvido em 15/09 (acima). A rota `POST /api/obras/sincronizar`
   responde **503** com e sem o Bearer — o código só devolve 503 quando a variável está vazia
   (`route.ts:26-28`). O João pôs no EasyPanel e deployou. Conferir a linha no Environment
   (`NOME=valor` na mesma linha, salva) e deployar de novo. Sucesso = **401** sem o segredo.
2. **Mockup da J4 v01 revisado pelo cliente** (`feedback-14-mockup-j4-v01.md`): **D aprovada**;
   A, B, C, E e F para ajustar. Antes da v02, fechar com o João: (a) nome da etapa —
   "Pendente aprovação da OS pelo cliente" × "Executado - pendente aprovação OS" (pergunta 07);
   (b) "Relatório de entrega" continua ou sai; (c) motivos iniciais de remarcação; (d) SLA 2
   conta até quando, e prazos-alvo dos dois SLAs. Já claro: origem no bloco de autorização;
   texto sem DPSP; atenção > 20 dias e crítico > 30; SLA 1 = dias desde a liberação sem OS
   aprovada; SLAs são pilar da reunião semanal. **Feedback de mockup só por WhatsApp.**
3. **Enviar a pergunta 08** (`pergunta-08-como-o-field-registra-status.md`). A medição de
   14/09 mostrou **175 OS, nenhum número repetido** e o status nas **atividades** da OS
   (`/orders/:id/tasks`) — o "duplicado" do feedback 13 é, provavelmente, atividade nova.
4. Com a 08 confirmando: **pergunta 06** (primeira carga) com **175** OS; depois Vault +
   jobs do `pg_cron` (completa em `5 6 * * *`) e a D4.

**Sem dono:** dois jobs `pg_cron` fora deste repo (`field-sync-every-5-min`,
`financeiro-producao-catalogo`) e as Edge Functions `sync`, `probe-field`, `field-probe`.

## 14/09/2026 — D1 e D2 no ar, D3 decidida, J3 provada

| | |
|---|---|
| Deploy | ✅ build de **14/09 16:53:22 GMT**, 10 chunks no mesmo timestamp. Contém D1 e D2 (último commit de código: merge `b1ef5e9`) |
| Migrations | `obras-fonte` (D1) e `obras-field-reconciliacao` (D2) aplicadas e verificadas em 14/09 |
| Banco | **0 obras**, de propósito |
| `FIELD_API_KEY` | posta no Environment do EasyPanel pelo João antes do deploy. **Não verificado que chegou ao processo** — a tela `/obras/sincronizar` só acusa a falta ao clicar, e clicar grava as 167 OS |
| J3 | provada com a chave local — `j3-verificacao-api-2026-09-14.md`. Aberto: se OS arquivada segue listada e se `GET /orders/:id` traz `archived` |
| D2.1 | ✅ **mergeada** (`03e2a83`, código `3edba98`), 337/337 aqui. Forma simplificada pelo conselho (`conselho-revisao-d21-2026-09-14.md`); conferência de lista fechada sem bloqueador. **Deployada**: build de 14/09 19:36:54 GMT, 10 chunks no mesmo timestamp. Sem migration nova |
| D3 | ✅ **mergeada** (`06aefd9`, código `972945b`), 344/344 aqui; conferência de lista fechada sem bloqueador (`conferencia-d3-2026-09-14.md`). **Não deployada.** Migration `sdd-sql-obras-sync-execucao.sql` aplicada **só até a função da trava** — os dois `cron.schedule` **não foram criados de propósito**: a primeira incremental é a primeira carga das 167 OS e espera a pergunta 06. Segredo gerado em `C:\Users\joao-\.obras-cron-secret` (fora do repo); falta pôr no EasyPanel e, depois da liberação do cliente, no Vault |
| Backlog | `backlog-integracao-field.md` — o que ficou fora pela régua de revisão |

⚠️ **Não apertar "Puxar do Field" em produção**: com a chave no ar, grava as 167 OS. A primeira carga espera o pente fino do cliente e a D2.1.

## 11/09/2026, manhã — a divisão de trabalho foi refeita

**A divisão de 10/09 durou 24 horas.** Duas das frentes que ela atribuía já estavam
entregues quando o dia começou: a F1 (cliente da API do Field) foi executada na própria
noite de 10/09, e a 1c (sincronização) na madrugada de 11/09. O Duda não chegou a começar
— não há branch, PR nem commit do `daduu27`.

**O que redesenhou a divisão** não foi isso, e sim um fato da integração: **a API do Field
traz três campos** (`os`, `loja`, `descricao`). As outras ~30 colunas de `obras_obra`
chegam vazias. Com a planilha fora, a base nasce inteira do Field e nasce incompleta por
construção — o que promove a tela de completar a obra a única porta de entrada de dado
real, e mantém de pé o risco central: sem `aprovacao`, **nenhuma obra vira crítica**.

A divisão nova, com o porquê de cada escolha, está em `divisao-trabalho-joao-duda.md`:
**João** fica com a chave da API (J1), o deploy (J2), provar as incógnitas da API (J3) e
completar a obra (J4, que absorveu a antiga F3); **Duda** vira dono do ciclo de vida da OS
— marcar a origem (D1), a OS que sumiu do Field (D2), a sincronização recorrente (D3) e o
smoke test contra o banco real (D4). As frentes do Duda vivem inteiras em
`app/obras/sincronizar/` e `app/obras/_lib/field/`, sem cruzar com o J4.

**Decisão ainda pendente do João:** o mecanismo da sincronização recorrente (D3). A frente
não começa antes dela.

**Pendência de processo:** o link do artifact está fixado na versão antiga. Republicar não
basta — o pin de compartilhamento precisa ser movido, ou o Duda abre o link e vê a divisão
velha.

## 11/09/2026, madrugada — fechamento da sessão

**O sistema saiu do papel: está no ar, vazio, esperando a primeira OS.** O que a sessão da
noite de 10/09 entregou, tudo verificado por medição:

| | |
|---|---|
| Migration | ✅ aplicada e verificada em produção |
| Push | ✅ 82 commits — e a `Mainsis` virou admin, então **o push deixou de depender do João** |
| Deploy | ✅ build de 10/09 23h38, 10 chunks no mesmo timestamp |
| `/obras` | ✅ responde (307 → login), card 🏗️ no dashboard |
| Obras no banco | **0** — por decisão, não por falha |
| Frente F1 (cliente da API do Field) | ✅ construída, revisada e pushada |
| Frente 1c (sincronização → banco) | ✅ construída e revisada; **falta a chave para provar** |

**Guia publicado para a equipe**, explicando por que a tela vazia não é defeito e o que
cada pendência custa: https://claude.ai/code/artifact/09355e86-fc26-4f4c-873a-e40aadcf98fc

### O que trava a manhã de 11/09, em ordem

1. **A chave da API do Field — validada localmente em 14/09, ainda fora da produção.** A J3
   rodou com ela e passou (`j3-verificacao-api-2026-09-14.md`: autentica, `q`, `sort=id` e
   timestamp completo; 167 OS "Atividade Spot" no Field). Ela ainda precisa ir
   para o `.env.local` da raiz como `FIELD_API_KEY=valor` (para testar — ignorado pelo git;
   é de onde `scripts/verificar-field.mjs` lê. Em 14/09 já havia ali um valor de 56
   caracteres, gravado em 11/09, ainda não validado contra o Field) **e** para o EasyPanel como
   `FIELD_API_KEY=valor` numa linha só (para produção). Sem ela a sincronização não roda
   nem é testada — e três incógnitas da API seguem abertas: se o servidor aceita a
   codificação do `q`, se `sort=id` é campo válido, e se `updated_at>=` aceita timestamp
   completo ou só data. **Qualquer uma delas custa meia hora no pior momento: durante o
   cadastro.**
2. **Deploy da sincronização.** O código está no `master`; a tela `/obras/sincronizar` só
   existe em produção depois de um novo Deploy no EasyPanel.
3. **A tela de completar a obra (1a) não existe** — e o cliente respondeu o que faltava
   para construí-la (feedback 12). Enquanto ela não existir, toda OS sincronizada entra
   sem `aprovacao` e **nunca vira crítica**.

### Dívida de processo assumida nesta sessão

A tela `/obras/sincronizar` foi construída **sem mockup aprovado antes**, por causa do
prazo do cliente. Ela segue o padrão da `/obras/importar`, que já estava aprovada e no ar.
**Foi decisão do Claude, comunicada ao João, e não deve virar precedente** — a regra do
projeto continua sendo mockup antes de código.

---

## 10/09/2026, fim da noite — três decisões do João que mudam o caminho

**1. A planilha NÃO será importada.** Decisão do João, seguindo o cliente: *"o cliente vai
fazer pelo field control [...] ele vai ver o que tem no field e o que tem na planilha para
atualizar o field e puxarmos de lá"*. O **passo 4 do runbook sai do caminho crítico** — a
base do sistema nasce do Field, depois do pente fino de 11/09. A planilha volta a ser o
que sempre foi: o retrato de onde a operação está hoje, insumo do saneamento que o cliente
faz, não carga do sistema.

> **Consequência que vale antecipar:** o parser de importação (`_lib/importacao.ts`, 
> `/obras/importar`) continua construído, testado e no ar, mas **deixa de ter uso
> previsto**. Antes de considerá-lo morto, lembrar que ele é o único caminho de carga em
> massa que existe — se a integração com o Field atrasar, ele é o plano B.

**2. Contas de AMANDA e YURI ficam para depois.** Com a base vindo do Field, não há o que
elas vejam hoje. Os **passos 5 e 6 do runbook saem da fila desta noite** — voltam quando
houver obra no sistema.

**3. O acesso do Duda ao GitHub foi concedido.** Usuário: **`daduu27`**, papel `Write`,
convite criado em 10/09 às 22:59 UTC. ⚠️ **O convite estava PENDENTE de aceite** na
verificação — enquanto ele não aceitar pelo e-mail do GitHub, o push dele falha com 403.
Colaboradores do repositório hoje: `Josemanfac` (admin), `Mainsis` (admin), `daduu27`
(write, pendente).

**Estado do caminho crítico depois disso:** ir ao ar está **concluído** no que dependia de
infraestrutura — migration, push, deploy e módulo no hub. O que resta do runbook (passos
4, 5 e 6) foi adiado por decisão, não por bloqueio. **A frente ativa passa a ser a
integração com o Field.**

---

## 10/09/2026, noite — a migration ENTROU em produção

**O módulo tocou um Supabase real pela primeira vez.** A frase "nada foi testado contra
Supabase real", que abria este arquivo desde 05/09, deixou de valer para o schema.

**O que mudou de fato:**

| | Antes | Agora |
|---|---|---|
| Migration `sdd-sql-obras-v0.sql` | não aplicada em banco nenhum | ✅ **aplicada e verificada** em `iyytcavcgukfjnjjrerx` |
| Bucket `obras-fotos` + policies de storage | não existiam | ✅ criados pela própria migration, **sem** o erro de ownership previsto |
| Acesso do Claude ao banco | nenhum | ✅ Management API com PAT em `C:\Users\joao-\.supabase-pat` (fora do repo) |
| Produção (`/obras`) | 404 | 404 — **inalterado**, o deploy não subiu |
| `master` vs `origin` | 80 commits à frente | 81 commits à frente, **push ainda negado** |

Verificado no banco: 5 tabelas `obras_*` com RLS ligado, 5 policies `obras access`, 3
policies de storage, e `obras_has_access()` = `obras_is_admin()` **ou** linha em
`hub_system_access`. As duas funções usam `exists(...)` — devolvem `true`/`false`, não
NULL. Administrador do hub entra em `/obras` sem linha de acesso nenhuma.

**A decisão de esperar o cliente foi revista pelo João nesta noite:** ele mandou pôr no ar
e liberar o acesso da equipe. A resposta do cliente veio **por áudio** e ele vai enviar a
transcrição — que entra literal em `docs/cliente/` antes de virar decisão, como sempre.

**Dois bloqueios reais, os dois fora do alcance do Claude:**

1. **O push.** `Mainsis` segue com `{"push": false}`. A correção é dar `Admin`/`Write` a
   essa conta em https://github.com/manfac-facilities/login-system/settings/access — a
   mesma tela onde o Duda recebe `Write`. Esse mesmo bloqueio já custou o deploy de 07/09,
   08/09 e 10/09; enquanto ele existir, todo deploy depende do João estar disponível.
2. **Faltam contas no hub.** Cruzando o dump da planilha com `auth.users`: **AMANDA (64
   obras) e YURI (15 obras) não têm login**. São 79 das 82 obras. Liberar o acesso da
   equipe sem convidá-las não tem efeito. `ROBERTA`, que o runbook mandava amarrar, **não
   existe na planilha**; quem existe e faltava na lista é `GABRIEL` e `EDUARDO` (1 obra
   cada). O `RUNBOOK-ir-ao-ar.md` foi corrigido no mesmo commit.

**O auto mode barra escrita em produção e push**, pedindo autorização do João a cada
ação — `[Production Deploy]` e `[Sensitive-Source Provenance]`. Não confundir com falha de
token ou de rede.

---

## 10/09/2026 — entra o Duda, e a espera é pela resposta do cliente

**Decisão do João no fim do dia: o sistema NÃO vai ao ar antes de o cliente responder
as duas perguntas.** Ele retoma o trabalho em 11/09.

> ⚠️ **Nota técnica para quem retomar:** as duas perguntas bloqueiam *liberar o acesso à
> equipe* (passo 5 do runbook), não os passos 1–4. Nesta versão as obras vêm da planilha,
> **e a planilha traz `tipo`, `valor` e `aprovacao`** — o buraco dos campos nulos só
> aparece quando a obra vier do Field. Rodar a migration e deployar sem liberar o slug
> `obras` seria seguro e resolveria o maior risco desconhecido do projeto (nada jamais
> tocou um Supabase real). Ficou como recomendação registrada, não como pendência.

**Estado verificado hoje, por medição e não por memória:**

| | |
|---|---|
| Testes de `app/obras` | **204/204 passando** |
| Build, `tsc`, `eslint` | limpos |
| Migration | **não aplicada em banco nenhum** |
| Produção | build de **26/08**; `/obras` devolve **404** |
| Git | `master` local **80 commits** à frente do `origin` |
| Push | segue negado — `gh api` devolve `{"push": false}` para `Mainsis` |

**Entra um colaborador: o Duda**, fornecedor do João (não da Mainsis, neste projeto).
**Escopo dele: apenas o Controle de Obras**, como teste da parceria. A divisão está em
[`divisao-trabalho-joao-duda.md`](divisao-trabalho-joao-duda.md) e o pacote que a
inteligência dele carrega, em `docs/onboarding-duda/`.

**Dois achados de código que mudam a v1**, os dois verificados por leitura e `grep`:

1. **Quatro colunas nunca são escritas por lugar nenhum** — `os_aprovada`,
   `marco_exec_fim`, `marco_relatorio`, `marco_os_aprov` só existem como campo de tipo em
   `_lib/tipos.ts:222,238-240`. A esteira de etapas lê `marco_exec_fim` para decidir se
   "Execução em campo" está feita: fica congelada para sempre.
2. **A Triagem desaparece quando a obra sai de `definir`** (`page.tsx:103`) — é mais grave
   do que o bloco de 08/09 registrou. Não é só que o bloco "O que veio do Field" é somente
   leitura: é que **depois da triagem não existe tela nenhuma** onde digitar os cinco
   campos que o Field não traz. Nunca mais.

**Uma estimativa deste arquivo estava errada e foi corrigida:** a decisão L ("foto de
evolução por dia na linha do tempo — **tela na v1**") foi lida como pendência, mas **a
foto diária está construída na v0**: `diario/_foto.tsx` com redução antes do upload,
`foto_path`, signed URL de 60 s (`diario/_actions.ts:257`), bloco "Evolução em fotos"
(`_ficha.tsx:627`) e o aviso de dia sem foto (`_ficha.tsx:702`), mais bucket e policies na
migration. **Antes de construir qualquer coisa desta frente, confirme por `grep` que ela
não existe.**

**Duas páginas publicadas hoje:**

- **Perguntas ao cliente** — https://claude.ai/code/artifact/3c47f0d5-586f-4a72-8b21-b3d4a9929825
  Enviada ao cliente em 10/09. Junta a pergunta nova (onde preencher os campos) com a
  **pergunta 03**, feita em 31/08 e nunca respondida. É a resposta destas duas que o
  projeto está esperando.
- **Frentes João × Duda** — https://claude.ai/code/artifact/03377e53-2156-4ae1-8257-4e844e28fc54
  Com os três `.md` de onboarding embutidos para copiar.

**Acessos definidos (ainda não executados):** Supabase — José `Owner`, João
`Administrator`, Duda `Developer` (o único papel que roda SQL e escreve sem poder apagar
projeto). GitHub — José `Owner` da organização, `Mainsis` `Admin` no repositório, Duda
`Write`. Verificado na documentação: "Developer" e "Administrator" **não existem** no
GitHub; os papéis são `Read`/`Triage`/`Write`/`Maintain`/`Admin`, e `Owner` é da
organização, não do repositório.

---

## 08/09/2026 — a obra vem sempre do Field, e a API existe

**Mudança de escopo, vinda do cliente hoje** (literal em
`feedback-07-obra-vem-sempre-do-field.md`):

> O que o sistema vai puxar do Field: Numero da OS, Localização da Loja, Descrição do
> chamado, Todo o restante das informações vamos ter que preencher manualmente

Mais: só as OS com **tipo "Atividade Spot"**, e **o João já tem a chave da API do Field
e a documentação** (https://developers.fieldcontrol.com.br/).

**O "cadastro manual de obra" sai do escopo — nunca foi requisito.** O que houve foi um
mal-entendido de uma palavra, e vale registrar para não voltar: **"manual" no que o
cliente disse é o PREENCHIMENTO DOS CAMPOS, não a CRIAÇÃO da obra.** A obra sempre nasce
no Field; o que é feito à mão é completar os campos que o Field não traz.
`decisoes-para-ir-ao-ar.md` chegou a registrar o oposto ("o cadastro manual é o modo
degradado permanente, e precisa ser tão bom quanto o automático") — está revogado.

**Consequência de código, e é a que importa:** o Field entrega só **três** campos (OS,
loja, descrição). Todo o resto — `tipo`, `valor`, `analista_cliente`, `origem` e,
criticamente, **`aprovacao`** — passa a ser preenchido à mão. Só que hoje **a Triagem
mostra exatamente esse bloco como SOMENTE LEITURA** (`_triagem.tsx:160-180`), porque
assumia que esses dados vinham da planilha. Sem tela onde digitá-los, eles ficam nulos
para sempre — e `aprovacao` nula significa que a obra **nunca vira crítica** e afunda
para o fim da base, que é justamente o mecanismo que originou o projeto (a obra parada
123 dias). **A v1 precisa tornar esse bloco editável na Triagem.** O levantamento que
prova isso está em `inventario-campos-obra.md`.

Duas decisões que isso reabre e que são do cliente, não nossas: a **decisão N** (a base
vem da planilha porque não havia credencial da API) perdeu a premissa; e é preciso
definir o que acontece com as 187 obras que já vieram da planilha quando a sincronização
com o Field entrar.

---

## 08/09/2026 — manhã do treinamento

**O passo a passo de ir ao ar virou documento executável:
[`RUNBOOK-ir-ao-ar.md`](RUNBOOK-ir-ao-ar.md)**, com o SQL de verificação de cada passo
pronto para colar. Ele substitui a lista solta do bloco de 07/09.

**Um bloqueador do treinamento foi encontrado e corrigido hoje:** o slug `obras` não
estava em `lib/sistemas.ts`, a fonte única que alimenta a tela `/admin/acessos` e o
diálogo de convite. O dashboard, o `middleware.ts` e a migration já conheciam `obras`;
só a lista da tela de administração ficou para trás. **Consequência, se ninguém tivesse
visto:** a coluna "Controle de Obras" não apareceria em `/admin/acessos` e não haveria
como liberar o acesso da equipe pela tela — no dia do treinamento. Corrigido; **a
correção só vale depois do deploy**, e é por isso que o passo 5 do runbook vem depois do
passo 3.

**Correção de fato do bloco de 07/09:** criar o bucket `obras-fotos` **não** é passo
manual — a própria migration o cria, com as policies de storage, na seção 4 de
`sdd-sql-obras-v0.sql` (linhas 269-381). A lista de 07/09 abaixo dizia o contrário.

Higiene do repositório no mesmo dia: o `.docx` de feedback que estava solto na raiz desde
31/08 era cópia idêntica (mesmo md5) da que já está em `originais/` e foi removido;
`sistema-os/` foi para o `.gitignore`; o `.mcp.json` foi versionado.

## 07/09/2026 — véspera do treinamento

**Feito neste dia, tudo commitado no `master` local:**

- O branch `copy-aprovada-cliente` virou `master` por fast-forward (69 commits). **O push
  falhou:** a conta do GitHub configurada nesta máquina (`Mainsis`) tem só permissão de
  leitura em `manfac-facilities/login-system` (`gh api` confirma
  `{"push": false}`). Nada saiu daqui — o push é do João.
- **Dois defeitos corrigidos** (commit `3bfc6b3`), os dois só apareceriam no uso real:
  1. `nao_andou_seguidos` e `bloqueada_dias` eram lidos em seis lugares e **nunca
     escritos** — nasciam 0 e ficavam parados. O alerta de "3 dias sem andar", que é o
     mecanismo da decisão C/F, nunca dispararia. Agora são recalculados do histórico do
     diário a cada resposta e a cada desfazer, e o `bloqueio` da obra passa a vir do
     motivo do último registro.
  2. Reimportar a planilha **apagava o que foi digitado no app** (a aba Pipeline manda
     `null` em pcm, equipe, bloqueio e pendência, e o update era cru; status em branco
     ainda devolvia a obra para `definir`). Era o achado deixado em aberto no review de
     05/09. `camposParaAtualizar` resolve: `null` nunca sobrescreve, `etapa` e `mau_uso`
     não se reescrevem.
- **Manual de uso escrito e publicado** — frente E da spec, pedido explícito do cliente no
  feedback 06. Fonte em `manual-uso-v0.md`, página em `manual-uso-v0.html`, artifact em
  https://claude.ai/code/artifact/6ac2cb5a-055e-4812-931a-afad7b3dc8e4 (tem folha de
  impressão embutida: Ctrl+P no navegador gera o PDF).
- 204 testes passando, `tsc`, `eslint` e `npm run build` limpos.

**Uma lacuna encontrada ao escrever o manual, contra a spec §1:**

> A outra lacuna listada aqui em 07/09 era "cadastro manual de obra não existe".
> **Ela deixou de ser lacuna em 08/09: nunca foi requisito.** Ver o bloco de 08/09 no
> topo deste arquivo e `feedback-07-obra-vem-sempre-do-field.md`.

- A ficha diz que "Relatório de entrega" é deduzido do Field automaticamente
  (`_ficha.tsx:213-220`), o que não existe na v0. O manual avisa que essa etapa é movida
  à mão. O texto da tela continua prometendo o que não entrega — corrigir na v1.

**O caminho crítico continua sendo manual e é do João:** rodar
`sdd-sql-obras-v0.sql`, criar o bucket `obras-fotos`, dar push, deployar, importar a
planilha, cadastrar os e-mails em `obras_pessoa` e liberar o slug `obras` em
`/admin/acessos`. Nada disso o Claude consegue fazer sozinho — o MCP do Supabase pede
autorização OAuth e o GitHub recusa o push.

---

Atualizado em 05/09/2026, fim do dia.

## O QUE JÁ ESTÁ CONSTRUÍDO

**A v0 de treinamento está codificada e commitada** no branch `copy-aprovada-cliente`,
nos commits `9405c18` a `adf562e`. Build de produção compila; 189 testes de `app/obras`
passando; `tsc` e `eslint` limpos no módulo.

| Rota | O que é | Frente |
|---|---|---|
| `/obras/base` | Base de obras: tabela + Kanban por fase, 4 filtros, ordenação | B |
| `/obras/obra/[id]` | Ficha da obra + Triagem (quando `etapa = definir`) | B |
| `/obras/diario` | Diário do dia, forma cartões | C |
| `/obras/tarefas` | Tarefas que as faltas geraram | C |
| `/obras/importar` | Carga da planilha, com relatório do descartado | D + sessão principal |

**Nada foi testado contra Supabase real** — a migration não rodou em banco nenhum. Toda a
cobertura é de unidade com mock. O primeiro contato com o banco de verdade vai revelar
coisa; é por isso que rodar o SQL cedo importa.

### Três lacunas que o código encontrou e que a spec não previa

1. **Autoria da troca de etapa** — não havia onde gravar quem mudou a etapa e quando.
   `etapa_por` e `etapa_em` entraram na migration (`812109b`).
2. **Nada ligava a conta do hub à pessoa da planilha.** `obras_obra.pcm` é texto (YURI) e
   quem entra no hub entra por e-mail. Sem isso, cada analista veria o diário VAZIO no
   treinamento. `obras_pessoa` ganhou coluna `email` e `resolverChave` consulta o cadastro
   antes de adivinhar pelo e-mail (`45325d8`). **Os e-mails reais ainda precisam ser
   cadastrados.**
3. **A frente D caiu por limite de gasto da conta**, não por erro. Deixou o parser pronto;
   a tela de importação foi escrita na sessão principal.

## Onde estamos


**MOCKUP v03 APROVADO PELO CLIENTE em 05/09/2026.** O João comunicou a aprovação; o
cliente pontuou algumas coisas "para termos atenção", enviadas por **áudio**. O João
está transcrevendo e vai mandar o texto.

**Aguardando o texto dos áudios** — ele vira `feedback-06-audios-aprovacao.md` nesta
pasta, literal, antes de qualquer interpretação. Só depois disso a spec começa: os
pontos de atenção podem mexer no escopo da v1, e spec escrita antes deles nasce contra
suposição.

O retorno **não veio pelos campos da página nem por comentário no artifact** (conferido
em 05/09: nenhuma thread). Veio por áudio, fora da ferramenta — mais uma evidência de
que o canal confiável é o cliente falando com o João, não a página.

**Artifact da v03 (link novo, para o cliente):**
https://claude.ai/code/artifact/63b26e3e-5e69-45db-b242-c00955e0d202

Publicado como artifact **novo**, de propósito: republicar sobre o link da v02 faria o
cliente continuar vendo a versão antiga até alguém mover a versão compartilhada à mão.
Link novo abre direto na v03.

> ⚠️ **O canal de retorno da página não foi confirmado por teste completo.** Os campos
> aparecem (sinal de que a capability `artifact` foi concedida), e cliques funcionam,
> mas a extensão do Chrome não consegue digitar dentro do iframe do artifact — o teste
> de "digitar, recarregar, conferir" ficou pela metade. Confirmar com uma digitação
> humana antes de confiar nele. O canal que nunca falhou continua sendo o cliente colar
> o retorno no chat.

> ⚠️ **Quem publica o artifact é a sessão principal, nunca um subagente.** Artifact
> publicado por subagente aceita digitação e não salva nada — o canal de retorno só
> existe para a sessão interativa.

> ⚠️ O link compartilhado fica **fixado** na versão compartilhada. Republicar não
> atualiza o que o cliente vê — é preciso mover a versão compartilhada no menu da
> própria página. Isso já causou confusão uma vez.

Artifact da v02: https://claude.ai/code/artifact/258d0a1e-a44a-4d6f-9463-6990f85923be

## Mockup reenviado ao cliente em 05/09

O João mandou o mockup ao cliente de novo em 05/09, depois da aprovação. Provável
motivo: dar à equipe que será treinada na terça a chance de ver a tela antes.

**Consequência de escopo, e é a que importa:** feedback que chegar agora concorre com
uma construção de três dias. O mockup já foi aprovado (feedback 06) — retorno novo entra
como backlog da v1, NÃO como escopo da v0, salvo se apontar algo que impeça o
treinamento de acontecer. Quem decide isso é o João, mas o default é esse.

## Processo — onde estamos na régua

```
brainstorming → mockup v02 ✅ → mockup v03 APROVADO ✅ → pontos de atenção do cliente ⬅ AQUI → spec → plano → código → review → deploy
```

## O que entrou na v03 (feedback 05, recebido em 03/09)

| Decisão | O que é |
|---|---|
| **I** | "Liberado por" + data de liberação, separados da aprovação da OS. Nasce o estado **sem cobertura** — obra executando sem OS e sem ninguém que tenha liberado |
| **J** | Mau uso vira **classificação**, sai de dentro do status e volta para o funil normal |
| **K** | Relatório **deduzido** do Field; "Cobrar aprovação da OS" vira **Pendente fechamento** |
| **L** | Foto de evolução por dia na linha do tempo. **Tela na v1, agente de WhatsApp depois** |

## Decisões do cliente — situação

| # | Assunto | Situação |
|---|---|---|
| 01 | Quem preenche o diário | Opção D — tela como fonte da verdade |
| A | Tabela ou Kanban | as duas |
| B | Formato do diário | as duas |
| C | Travar no 3º "não andou" | sem trava; motivo obrigatório |
| D | Quem define a obra que chega | o Yuri, e ele direciona |
| E | O que perguntar às 9h | dissolvida — ciclo às 18h |
| F | Falta repetida | o aviso não escala, só atualiza |
| G | Quem marca "faturado" | **fechada** — financeiro |
| H | Porte da obra | descartada |
| I | Liberado por + data | fechada — na v03 |
| J | Mau uso como etiqueta | fechada — na v03 |
| K | Relatório derivado | fechada — na v03 |
| L | Foto diária | fechada — tela na v1, agente depois |

## Perguntas em aberto COM O CLIENTE

- **Pergunta 03 — "como calcula esse avanço %?"** Ele perguntou no `.docx` de 31/08 e
  **nunca foi respondida**. Ver `pergunta-03-como-calcula-o-avanco.md`. Hoje o avanço é
  digitado à mão sem regra — a planilha tem `0.9` numa linha e `95` em outra querendo
  dizer a mesma coisa. Proposta: declarado no diário em passos de 10%, com a foto do dia
  como evidência.

## Pendências

- [x] Revisão independente da v03 e publicação do artifact (feita da sessão principal)
- [x] ~~Confirmar se os campos de retorno da página salvam~~ — dispensado na prática: o
      cliente respondeu por áudio ao João. O canal da página nunca foi usado por ele
- [x] **Receber e versionar a transcrição dos áudios de aprovação** (`feedback-06`)
- [x] Manual de uso (frente E) — escrito, publicado e versionado em 07/09
- [ ] Responder a pergunta 03 ao cliente — o texto pronto está em
      `pergunta-03-como-calcula-o-avanco.md`, no fim. Falta só o João mandar
- [ ] **Cadastro de telefone das equipes / prestadores** — trabalho de operação do João.
      Trava o agente de WhatsApp, não trava a v1
- [ ] Campo de liberação na tela de Triagem — citado nas decisões, não estava no brief
- [ ] Link da planilha viva, que o José ficou de mandar por e-mail
- [ ] Só então: spec → plano → código

## Ordem de construção definida pelo cliente na reunião

1. Base de obras (entrada via Field) ⬅ camada 1
2. Dia a dia das obras / diário ⬅ camada 2, é o coração
3. Agente de IA cobrador ⬅ camada 3
4. Dashboard e apresentação para reunião ⬅ camada 4

Zeev fica em **standby**, decisão dele (minuto 38 da reunião).

## Arquivos desta pasta

| Arquivo | O que é |
|---|---|
| `originais/` | Os arquivos como o cliente mandou, incluindo o `.docx` de feedback e suas imagens |
| `transcricao-reuniao-2026-08-31.md` | Transcrição literal da reunião |
| `planilha-dpsp-rev02-dump.txt` | A planilha inteira, célula a célula |
| `feedback-01-docx-cliente-literal.md` | O `.docx` do cliente em texto — fonte da v02 |
| `feedback-01` … `feedback-05` | Os retornos, literais e traduzidos |
| `decisoes-para-ir-ao-ar.md` | As decisões A–H |
| `feedback-05-leitura-e-decisoes.md` | As decisões I–L |
| `pergunta-03-como-calcula-o-avanco.md` | Pergunta do cliente ainda sem resposta |
| `brief-mockup-v03.md` | A especificação da v03 |
| `mockup-obras.html` | **A v03** |
| `mockup-v02-BACKUP-antes-do-feedback-05.html` | A v02 aprovada — baseline |
| `mockup-01-v05-BACKUP-aprovado.html` | Backup anterior |
| `mockup-01-v01-publicada.html` | A v01, recuperada do artifact |
