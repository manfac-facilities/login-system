# Investigação: botões "Solicitar compra" e "Solicitar medição" na ficha da obra (15/10/2026)

Somente leitura. Nada foi alterado, commitado ou escrito no banco.
Clones lidos (scratchpad, `gh repo clone`): `repos/compras` (HEAD d8c459d) e `repos/fornecedores` (HEAD 9db2c40).
Caminhos abaixo: `C:` = hub (`login-system`); `CMP:` = repo compras; `FRN:` = repo fornecedores.

Origem do pedido: `docs/cliente/2026-10-14-reuniao-jose-guilherme.md:464-472` (literal: "esse botão ele tem que só chamar o
outro sistema ... E aí abre um pop-up ali na tela o cara preenche as informações") e
`docs/cliente/2026-10-14-reuniao-jose-guilherme-resumo.md:49-52` (só vale para obras a partir de uma data de corte, "porque obra antiga não tem contrato").

## Resumo executivo

- **Compras já está pronto para o botão.** `/compras/solicitacoes/nova?obra=<uuid>` existe e pré-preenche a obra. **Mudança necessária no Compras: nenhuma.**
- **Medição não tem pré-preenchimento por obra.** Medição depende de **contrato aprovado**; o vínculo com obra é do **contrato** (`frn_contratos.obra_id`), não da medição. A tela aceita só `?contrato=CT-NNNN`. Para o botão da ficha ser útil, falta uma consulta "contratos aprovados desta obra" (mudança pequena, no Fornecedores ou no hub).
- **Pop-up em iframe: inviável sem mexer em headers dos apps** (os três mandam `X-Frame-Options: DENY` + `frame-ancestors 'none'`). Recomendação: **nova aba** (`<a target="_blank">`) com query string.
- **Data de corte:** `obras_obra.created_at` existe (`timestamptz not null default now()`) e serve, com a ressalva de que as obras antigas foram importadas (a data de criação pode ser a da importação, não a da obra) - ver item 5.

---

## 1. Compras: criar solicitação de compra

### Verificado
- **Rota/página:** `CMP:app/(modulo)/solicitacoes/nova/page.tsx` (basePath `/compras`, ver `CMP:Dockerfile:18`, `CMP:next.config.ts:76-80`). URL final: `/compras/solicitacoes/nova`.
- **Pré-preenchimento por query string: JÁ EXISTE.** `page.tsx:14` ("`?obra=<id>`: o botão futuro na ficha da obra abre daqui já com a obra (spec 7.1)"), `page.tsx:18,22` lê `searchParams.obra`, `page.tsx:26-35` chama `lerObra()` e passa `obraInicial` ao formulário; o form inicializa `useState(obraInicial)` (`nova-solicitacao-form.tsx:62`) e `obraId: obraInicial?.id` (`:73`).
  - Obra inexistente, cancelada ou não-uuid: o form abre sem obra e mostra aviso (`page.tsx:32-34`; `CMP:lib/obras/leitura.ts:32-41`).
  - A spec do Compras previa exatamente isso: `CMP:docs/superpowers/specs/2026-10-05-compras-design.md:65` e `:618` ("Botão 'Solicitar material' na ficha da obra (no `login-system`; só aponta para `?obra=`)").
- **Escrita:** Server Action `enviarSolicitacaoAction` em `CMP:lib/solicitacoes/actions.ts:20-` (`requireSessao()` na linha 23, valida com zod, relê a obra no servidor com chave de serviço e cria a solicitação por RPC no SQL `CMP:supabase/hub-install/007_cmp_solicitacoes.sql:276`).
- **Campos obrigatórios** (`CMP:lib/solicitacoes/schemas.ts:20-91`): `tipo`; `ccCodigo` (centro de custo, min 1); `motivo` (10 a 2000 letras); `prazoNecessario` (data); `recebimento` (`base|obra|retirada`); `itens` (1 a 50; item de catálogo exige produto, item novo exige descrição >=3 e unidade; quantidade válida). Condicionais: `enderecoEntrega` >= 10 caracteres se `recebimento = obra` (`:47-53`); `valorEstimado` se informado precisa ser válido. Justificativa de urgência é conferida em `prepararEnvio` (`CMP:lib/solicitacoes/preparar.ts`, não lido por inteiro).
- **Campo de obra/OS:** sim, **opcional**. Colunas `obra_id uuid`, `obra_os`, `obra_loja`, `obra_descricao` em `cmp_solicitacoes` (`CMP:supabase/hub-install/007_cmp_solicitacoes.sql:39-42`), com check `(obra_id is null) = (obra_os is null)` (`:66`) e índice `:80`. O servidor grava foto de OS/loja/descrição lida de `obras_obra` (`CMP:lib/obras/leitura.ts:29-41`, só obras com `cancelado_em is null`).
- **Centro de custo:** campo próprio e obrigatório (`ccCodigo`, departamentos do Omie). **A obra NÃO preenche o centro de custo**; a pessoa escolhe.
- **Busca de obra no próprio form:** `CMP:app/(modulo)/solicitacoes/nova/campo-obra.tsx` + `CMP:lib/obras/busca.ts` (busca por OS, loja ou descrição; Server Action com `requireSessao`).

### Inferência
- Se o botão abrir `/compras/solicitacoes/nova?obra=<obras_obra.id>`, a pessoa só preenche o restante. Para "o cara preenche as informações" isso basta.
- Pré-preencher centro de custo ou endereço de entrega a partir da obra exigiria mudança nova; **não foi pedido** e não existe coluna de CC em `obras_obra`.

### Menor mudança
- **No Compras: nenhuma.** No hub: um `<a href="/compras/solicitacoes/nova?obra=${obra.id}">` (o hub usa `<a>` normal para apps separadas, AGENTS.md; ver `C:app/(dashboard)/dashboard/page.tsx:87-106`).

---

## 2. Fornecedores: medição

### Verificado
- **Rota/página:** `FRN:app/(modulo)/medicoes/nova/page.tsx` -> `/fornecedores/medicoes/nova?contrato=CT-NNNN`.
  - Query string aceita: **somente `contrato`** (`page.tsx:17,20`), formato `^CT-\d{4,}$` (`:29`). Sem parâmetro de obra, OS ou fornecedor.
  - Sem `contrato`, mostra um `<select>` de **contratos aprovados** (`:52-65`, lista de `listarContratosAprovados`, `FRN:app/(modulo)/medicoes/_dados.ts:30-47`; rótulo = `CT · fornecedor · obra_rotulo` ou "Global").
- **De que depende a medição:** de **contrato com `status = 'aprovado'`**. `carregarContexto` devolve `null` se não aprovado (`_dados.ts`, logo após o `select`); a RPC recusa com "Só contrato aprovado recebe medição." (`FRN:supabase/hub-install/005_frn_funcoes.sql:957`). `frn_medicoes.contrato_id` é `not null references frn_contratos` (`004_frn_medicoes.sql:43`). Não existe medição sem contrato.
- **Vínculo com obra/OS: existe só no CONTRATO.**
  - `frn_contratos.obra_id uuid` ("obras_obra.id, sem FK de propósito (C1)") e `obra_rotulo` (foto do rótulo) - `FRN:supabase/hub-install/003_frn_contratos.sql:8-9,39-40`.
  - Tipo `especifico`: `obra_id` obrigatório fora do rascunho (`:88`). Tipo `global`: `obra_id` **tem de ser nulo** (`frn_ct_global`, `:79-80`; texto da UI `contratos/novo/_form.tsx:247`: "Contrato global não tem obra vinculada"; cartão de aprovação `aprovacoes/_cartao.tsx:459` "Contrato global - sem obra"). **É daí que vem a anotação "contrato global sem obra".**
  - A **medição não tem coluna de obra/OS** (`004_frn_medicoes.sql:39-74`); herda do contrato. Não há UNIQUE em `obra_id`: **uma obra pode ter vários contratos**, e um contrato é de um fornecedor.
  - O criador do contrato escolhe a obra num `<select>` (`contratos/novo/_form.tsx:286-297`) alimentado por `frn_listar_obras()` = `obras_obra` com `etapa not in ('faturado','cancelado')` (`005_frn_funcoes.sql:689-702`). **A página de contrato novo não lê `?obra=`** (grep em `contratos/novo/page.tsx` não retorna nada).
- **Campos obrigatórios** (`pendenciasDaMedicao`, `FRN:app/(modulo)/medicoes/_logica.ts:252-285`): item (mo/mat); descrição (3-500) se modo material/serviço; data do serviço (serviço/tabela); serviço+quantidade (tabela); ao menos um atendimento (consolidado); valor (ou %); aceite operacional quando exigido; anexo de evidência (mo) ou comprovante de entrega (mat); forma de pagamento (+ código, ou chave PIX no catálogo); categoria; tipo de documento; centro de custo. NF é opcional (`004_frn_medicoes.sql:59`). Competência é calculada (corte no dia 25, `FRN:lib/regras/competencia.ts`), não digitada. Essa "data de corte" é do dia 25 do mês e **não tem relação** com o corte de obras antigas.
- **Pré-preenchimento hoje:** só o contrato (`?contrato=CT-NNNN`).

### Inferência
- "Solicitar medição" a partir da ficha da obra **não é um clique só**: é preciso saber **qual contrato** da obra. Cenários: 0 contratos aprovados (botão deve avisar/desabilitar - é o caso das obras antigas que o José citou), 1 (abre direto `?contrato=CT-...`), vários (escolher).
- Menor mudança sugerida (decisão a tomar antes; só leitura, sem schema novo):
  - **Opção A (hub resolve):** a ficha consulta `frn_contratos` (`obra_id = :id and status = 'aprovado'`) e monta o link `?contrato=CT-NNNN`. Exige que o hub leia tabela `frn_*`; a RLS de `frn_contratos` só mostra contratos do dono ou de quem tem papel (`003:183-187`), então a leitura teria de ser com chave de serviço (decisão de arquitetura, mexe na fronteira entre apps).
  - **Opção B (Fornecedores resolve, preferida por manter a fronteira):** aceitar `?obra=<uuid>` em `medicoes/nova/page.tsx` e filtrar `listarContratosAprovados` por `obra_id` (um `.eq("obra_id", ...)`; se houver exatamente um, já abrir o contexto). Estimativa: cerca de 10-15 linhas em um arquivo + teste (estimativa minha, não medida). O repo é separado e o João determinou que o deploy de Fornecedores não pode atualizar outro sistema (AGENTS.md), compatível.
- Na Opção B o botão pode ficar sempre visível: sem contrato aprovado, a tela já responde com o estado vazio existente ("Nenhum contrato aprovado para medir", `page.tsx:73-76`).

---

## 3. "Pop-up": iframe/modal ou nova aba?

### Verificado
Os três apps mandam bloqueio de enquadramento:
- Hub: `C:next.config.ts:15-16` `X-Frame-Options: DENY` e `:39` CSP `frame-ancestors 'none'` (CSP **enforçado**).
- Compras: `CMP:next.config.ts:50` `X-Frame-Options: DENY`; `:43` `frame-ancestors 'none'` dentro de `Content-Security-Policy-Report-Only` (`:62`). `frame-ancestors` em Report-Only não bloqueia, mas o `X-Frame-Options: DENY` basta para bloquear.
- Fornecedores: `FRN:next.config.ts:43` `X-Frame-Options: DENY`; `:36` `frame-ancestors 'none'` (Report-Only, `:55`); `basePath: "/fornecedores"` (`:65`).
- Middleware/proxy: o `C:middleware.ts` só trata `/sofia`, `/crm`, `/obras`, `/admin`, `/dashboard` (`:49-60`); Compras e Fornecedores não entram nele (regra do AGENTS.md). Os `proxy.ts` deles só fazem porteiro de sessão (`CMP:proxy.ts`, `FRN:lib/auth/porteiro.ts`), não alteram cabeçalhos de frame. No mesmo domínio, os cookies de sessão do Supabase são compartilhados (por isso o `requireSessao()` deles funciona).

### Para um iframe funcionar seria preciso (inferência a partir do código)
1. Hub como pai: o CSP dele tem `default-src 'self'` e nenhum `frame-src`; iframe same-origin cai em `default-src 'self'` e seria permitido, então o hub não precisa mudar para ser pai.
2. Compras e Fornecedores: trocar `X-Frame-Options: DENY` por `SAMEORIGIN` e `frame-ancestors 'none'` por `'self'` - **em cada repo**, com deploy separado (sem webhook de auto-deploy, AGENTS.md). Reduz a defesa contra clickjacking (risco baixo se for só same-origin).
3. Dentro do iframe a página traz o **shell completo** do app (menu lateral, cabeçalho: `CMP:components/app/app-shell.tsx`, `FRN:components/app/app-shell.tsx`), não um formulário "limpo"; ficaria feio num pop-up sem uma rota "embed" nova.
4. Ao concluir, o redirect acontece dentro do iframe; o pai não é avisado (precisaria de `postMessage`).

### Recomendação
**Nova aba** (`<a href="..." target="_blank" rel="noopener">`) com query string. Motivos: zero mudança nos headers/deploys dos outros dois apps; o Compras já suporta `?obra=`; é o jeito mais barato de cumprir "só chama o outro sistema". O custo é que não é literalmente um "pop-up": a pessoa vai para outra aba (a ficha continua aberta). Se o cliente fizer questão de modal de verdade, é uma frente à parte: ajustar headers nos dois repos, rota de formulário sem shell e `postMessage` - não é "só botão". Alternativa barata ao "pop-up" literal: `window.open` com janela pequena, que também não exige mexer em header, mas continua mostrando a tela completa do outro app.

---

## 4. Autorização

### Verificado
- **Compras:** qualquer pessoa logada no hub cria solicitação. `CMP:lib/auth/porteiro.ts:5-9` ("qualquer pessoa logada no hub entra como solicitante; papel é decidido nas páginas e no banco"), `decideGate` só exige sessão e e-mail (`:74-81`); `enviarSolicitacaoAction` usa só `requireSessao()` (`CMP:lib/solicitacoes/actions.ts:23`). Papéis (compras, almoxarifado, gestor, diretor, admin) servem para operar a solicitação depois. Compras **não tem slug** no hub (AGENTS.md).
- **Fornecedores - entrar na tela:** mesmo porteiro (qualquer logado com e-mail; `FRN:lib/auth/porteiro.ts:6-8`). Também sem slug.
- **Fornecedores - criar medição:** `requireSessao()` na Server Action (`FRN:app/(modulo)/medicoes/_actions.ts:165`) e, no banco, `frn_solicitar_medicao` exige `frn__pode_operar(contrato, ator)` = **ser o criador do contrato (`criado_por`) OU ter algum papel ativo em `frn_papeis`** (`005_frn_funcoes.sql:75-84` e `:955-956`; senão erro "Contrato não encontrado."). A RLS de `frn_contratos` também restringe a lista ao dono ou a quem "vê tudo" (`003:183-187`); admin do hub só lê, não opera (`FRN:lib/auth/papeis.ts:5`).
- **Usuário com acesso a Obras (`hasSystemAccess(..., 'obras')`, `C:app/obras/obra/[id]/page.tsx:109`) consegue?**
  - **Compras: sim**, desde que logado (não depende do slug `obras`).
  - **Medição: só se for o dono do contrato daquela obra ou tiver papel em `frn_papeis`.** Acesso a Obras **não basta**. Quem abre a ficha mas não criou o contrato verá "Contrato não encontrado" ou lista vazia.

### Inferência
- A pessoa de Obras que clica "Solicitar medição" é, na prática, quem acompanha a obra; se o contrato foi criado por outro (ex.: José), ela não consegue medir. É preciso combinar com o cliente quem solicita medição (dono do contrato vs. responsável da obra). Mudar isso é **autorização** (território de exceção do AGENTS.md) e mexe em função SQL do Fornecedores: **não fazer sem decisão do João**.
- No hub, o botão só aparece para quem já passou do `hasSystemAccess(... 'obras')` da ficha.

---

## 5. `obras_*`: coluna que ligue obra a contrato ou sirva de "data de corte"

### Verificado
- **Ligação obra -> contrato em `obras_*`: NÃO existe.** `ObraRow` (`C:app/obras/_lib/tipos.ts:294-365`) e `obras_obra` (`C:sdd-sql-obras-v0.sql:60-130` + alters em `sdd-sql-obras-cliente.sql`, `-fonte`, `-field-reconciliacao`, `-cancelamento`, `-faturamento`) não têm coluna de contrato. O vínculo é **no sentido contrário**: `frn_contratos.obra_id -> obras_obra.id`, sem FK de propósito (`FRN:003_frn_contratos.sql:8-9,39`). Para saber se a obra tem contrato é preciso consultar `frn_contratos`.
- **Datas em `obras_obra`** candidatas a corte:
  - `created_at timestamptz not null default now()` (`sdd-sql-obras-v0.sql:120`; `ObraRow.created_at`, `tipos.ts:348`) - criação do registro. **Candidata mais simples**, existe em toda obra.
  - `liberado_em date` / `liberado_por` (`v0.sql:81-82`; `tipos.ts:317-318`) - quando a obra foi liberada; nula se não liberada.
  - `aprovacao`, `inicio_plan`, `inicio_real` (cronograma), `desde_etapa`, `marco_*` (`tipos.ts:325-337`).
  - `fonte`, `origem`, `field_id`, `criado_por` (`tipos.ts:303-306,347`): `fonte` distingue a origem (importação vs. Field), útil para separar o legado, mas não é data.
- **Pegadinha:** não verifiquei no banco se as obras antigas foram importadas com `created_at` = data da importação. Nesse caso `created_at` não distingue "obra antiga" de "obra nova" no dia da importação, mas distingue tudo criado depois dela, que é o "a partir do dia tal".

### Inferência / recomendação para a regra de corte
- Regra mais simples e sem schema: mostrar os botões se `created_at >= DATA_DE_CORTE` (constante no código ou configurável), **e/ou** pela existência de contrato aprovado (a Opção B do item 2 resolve o caso "obra antiga sem contrato" sozinha: sem contrato, a tela de medição fica vazia com mensagem).
- Para **Compras** o José falou de corte só para medição/contratação ("solicitar medição e solicitar contratação não adianta botar isso nas obras antigas", `reuniao-jose-guilherme.md:468`); não há razão técnica para limitar "Solicitar compra" por data (Compras aceita qualquer obra não cancelada).
- A data de corte exata ("a partir do dia tal") é **decisão em aberto** do cliente/João. Coluna nova em `obras_obra` = alterar schema: parar e perguntar (AGENTS.md).

---

## Não verificado
- Não testei em navegador/produção se o iframe é bloqueado (conclusão pelo código dos três `next.config`; não consultei a configuração do proxy do EasyPanel, que em tese poderia sobrescrever cabeçalhos).
- Não consultei o banco: `created_at` real das obras antigas e existência de contratos aprovados com `obra_id` preenchido.
- `CMP:lib/solicitacoes/preparar.ts` foi lido só por referência (regras finais de urgência).
