<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Contexto operacional — Hub Manfac

**Regra zero:** tudo abaixo é fato verificado. Não pergunte ao João nada que esteja
neste arquivo — leia aqui primeiro. Se um fato daqui estiver desatualizado, corrija o
arquivo no mesmo commit em que descobrir.

**Idioma:** responder sempre em português do Brasil.

## O que é este projeto

Um único app Next.js (`hub.manfac.com.br`) que hospeda três sistemas da Manfac
Facilities atrás de um login compartilhado:

| Sistema | Rota | Nome na UI | Observação |
|---|---|---|---|
| Sofia | `/sofia` | **Gestão de Frotas** | O código diz "sofia", o cliente diz "Gestão de Frotas" — são a mesma coisa |
| Conversor de OS | `/conversor-os` | Conversor OS | Converte planilhas de OS para o Field Control |
| Admin | `/admin/acessos` | Admin | Contas e acessos. O João chama de "módulo de login" |

**Apelidos que já causaram confusão.** O repositório é `manfac-facilities/login-system`
e o app no EasyPanel tem esse mesmo nome, herdado de quando o projeto era só a tela de
login — hoje ele é o hub inteiro. Então: "login-system" = o hub; "sistema/módulo de
login" na fala do João = a tela `/admin/acessos`, **não** a tela de entrada. E
`manfac-site` é outro app no EasyPanel, com deploy próprio — em 2026-08-09 ele foi
confundido com o hub ao conferir a data do último deploy, levando à conclusão errada de
que o hub não tinha deployado.

Outros diretórios da raiz que **não** fazem parte do hub: `manfac-site/` (site
institucional, deploy próprio via `dockerfile` da raiz), `sistema-os/` e
`material manfac/` (insumos, não código).

## Infra e deploy — leia antes de investigar qualquer bug de produção

- **O hub é deployado no EasyPanel.** Variáveis de ambiente e logs ficam no painel web
  do EasyPanel. Não há acesso SSH funcional: a chave `~/.ssh/manfac_vps` recebe
  `Permission denied (publickey)`.
- **Painel:** `http://2.25.194.184:3000`; o app do hub é
  `/projects/manfac/app/manfac-login-system` (projeto `manfac`, app
  `manfac-login-system`). O botão de **Deploy** fica nessa página.
- **Quem clica é o João, não o Claude.** Abrir a URL pela extensão do Chrome cai na tela
  de login do EasyPanel — a sessão do João não chega nesse contexto, e digitar senha é
  proibido. O fluxo que funciona: João clica em Deploy, Claude confirma o build por fora.
- **Como confirmar que o build subiu** (não confie no painel nem em "já cliquei"): pegar
  os `/_next/static/chunks/*.js` de `https://hub.manfac.com.br/login` e conferir o
  `Last-Modified` deles. Todos têm que ter o mesmo timestamp e ser posteriores ao push —
  timestamps misturados significam cache velho junto com build novo. **Não há webhook de
  auto-deploy:** push no `origin/master` não sobe nada sozinho.
- **Arquivos de deploy desatualizados — não confie neles:** `deploy/DEPLOY.md`,
  `deploy/ecosystem.config.js`, `.env.production` e os `deploy/nginx-*.conf` descrevem
  uma infra antiga de VPS com PM2 + Nginx que não é mais a que está no ar.
- O `dockerfile` da raiz builda o `manfac-site/`, **não** o hub.
- Produção: `https://hub.manfac.com.br`.

### DNS — leia `docs/infra/dns-manfac.md` antes de tocar em domínio

Resumo do que já custou 2 dias de indisponibilidade em 18/08/2026: o domínio é
registrado via **Hostinger**, mas o DNS é servido pela **Locaweb** (`ns1/ns2/ns3.locaweb.com.br`)
— a zona se edita no painel da **Locaweb**. `@` e `hub` são registros **A** para
`2.25.194.184`. **Nunca troque os nameservers:** o e-mail `@manfac.com.br` está na
Locaweb (MX + SPF) e cai junto, com perda de mensagens.

**Antes de investigar "o hub caiu", isole DNS de aplicação:**

```bash
curl -sL --resolve hub.manfac.com.br:443:2.25.194.184 https://hub.manfac.com.br/ | grep -i "<title>"
```

Se o título aparecer, a aplicação está perfeita — o problema é DNS, não código nem deploy.

### Variáveis de ambiente

| Variável | Onde é usada | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | tudo | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tudo | |
| `NEXT_PUBLIC_SITE_URL` | links de e-mail do Supabase Auth | |
| `SUPABASE_SERVICE_ROLE_KEY` | **só** `app/admin/_actions.ts` | **NÃO estava chegando no processo em 2026-08-09**, apesar de aparecer no painel. Ver aviso abaixo. Sem ela, `createAdminClient()` lança e a página `/admin/acessos` inteira cai com erro genérico de Server Component. Ausente em `.env.production` e no `DEPLOY.md`, que estão desatualizados. |

> **Aviso — a anotação anterior era falsa.** Até 2026-08-09 este arquivo dizia que a
> `SUPABASE_SERVICE_ROLE_KEY` estava configurada no EasyPanel e mandava não investigar
> por essa via. O log do container provou o contrário:
> `Error: SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente`, `digest 1608214092`.
> **Aparecer no painel não é o mesmo que chegar no processo:** mudança em *Environment*
> só entra no container num novo deploy, e o campo é `CHAVE=valor` numa linha só — a
> chave é longa e quebra de linha ao colar a invalida silenciosamente. Confirme sempre
> pelo log do app, nunca pela tela do painel.

Ao adicionar uma variável nova, atualize `.env.local.example` **e** esta tabela.

### De onde as variáveis realmente vêm (descoberto em 2026-08-10)

**O hub em produção lê o `.env.production` versionado no repositório**, não o painel do
EasyPanel. O Next.js carrega esse arquivo sozinho no build e no `next start`. Ele contém
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SITE_URL`
(esta já com `https://hub.manfac.com.br`) — e é por isso que o hub funcionava mesmo com
o painel mal configurado.

A `SUPABASE_SERVICE_ROLE_KEY` **não está nesse arquivo**, e nem pode estar: é segredo.
Ela só chega pelo painel. Consequência prática: **ela é a única variável cuja falha é
invisível até alguém abrir `/admin/acessos`.**

**Armadilha do campo Environment do EasyPanel:** é uma caixa de texto livre onde cada
variável precisa ser `NOME=valor` **na mesma linha**. Se estiver com o nome numa linha e
o valor na seguinte, o painel não reconhece nada e o container sobe sem nenhuma variável
— silenciosamente, porque o `.env.production` cobre o resto. Foi exatamente o que
aconteceu. Corolário perigoso: **arrumar o formato faz os valores do painel passarem a
valer e sobrescreverem o `.env.production`** — confira os valores antes de corrigir o
formato, ou você troca um bug por outro.

## Banco de dados (Supabase)

- **Projeto de produção: `iyytcavcgukfjnjjrerx`** (org `wqgsiumpnccxqmnqhpin`, nome
  "jose.guilherme@manfac.com.br's Project", us-east-1, Postgres 17). É o ref que está em
  `.env.production` e `.env.local.example`. **Confirme sempre o ref antes de escrever.**
- **MCP do Supabase:** o consentimento OAuth deixa escolher a quais projetos o app tem
  acesso, e é fácil conceder sem incluir o projeto certo. Sintoma: `list_organizations`
  responde, mas `list_projects` volta `{"projects":[]}` e qualquer chamada ao ref dá
  `You do not have permission to perform this action`. Correção: revogar o grant em
  Dashboard → perfil → OAuth Apps e reconectar marcando o projeto. **Teste de sanidade:
  `list_projects` tem que listar `iyytcavcgukfjnjjrerx` antes de qualquer escrita.**
- **Migrations são manuais.** Cada mudança de schema vira um arquivo `sdd-sql-*.sql` na
  raiz que alguém roda à mão no SQL Editor do Supabase. Não existe CLI de migration.
  (O MCP também aplica, via `apply_migration`.)
- Consequência: código mergeado ≠ schema aplicado. Antes de concluir que um bug é de
  código, verifique se o SQL correspondente já rodou em produção.
- **Isso já mordeu uma vez.** Em 2026-08-09 o `master` tinha um mês de código não
  deployado que dependia de `sdd-sql-v04.sql` e `sdd-sql-track-b.sql`, nenhum dos dois
  aplicado. Subir naquele estado quebraria a criação de checklist e a tela de veículos.
  Ambos foram aplicados na data. **Antes de qualquer deploy, confira coluna por coluna
  no banco** — o arquivo estar no repo não significa nada.

### Estado das migrations em produção (verificado em 2026-08-09)

| Arquivo | Estado |
|---|---|
| `passo1`–`passo4`, `v03`, `audit-log`, `autorizacao`, `feedback-cliente`, `conversor-os` | aplicados |
| `v04` | aplicado por inteiro; o índice `veiculos_equipe_ativo_uniq` entrou em 2026-08-10 |
| `track-b` | aplicado |
| `admin-usuarios` PARTE 1 | aplicado |
| `admin-usuarios` PARTE 2 | aplicada em 2026-08-10, após o deploy |
| `v04-seguranca` | **aplicado em 2026-08-10** (migration `v04_seguranca_rls_sofia`), na versão que lê `hub_user_roles` |

Com o `v04-seguranca` aplicado, as 18 tabelas do Sofia deixaram de ter a policy
`authenticated full access` e passaram a `sofia access` (`using (sofia_has_access())`).
**Consequência operacional:** os triggers `trg_bloquear_*` são `security definer` e
disparam para qualquer role, inclusive `service_role`/`postgres` — pelo SQL Editor ou
pelo MCP, `auth.jwt()` é NULL e `sofia_is_admin()` é false. Editar à mão as colunas
guardadas (autorização/desconto de multas e sinistros, `equipes.ativo`,
`veiculos.valor_locacao_mensal`, insert em `centro_custo_historico`, delete em
`abastecimentos`/`km_diario`) falha com "Apenas administradores...". Contorno:
`alter table ... disable trigger`, corrigir, reabilitar.

**Duas armadilhas de PL/pgSQL que já morderam aqui — confira nos SQLs futuros:**

1. **Trigger compartilhada por tabelas de colunas diferentes.**
   `if TG_TABLE_NAME = 'equipes' and new.ativo is distinct from old.ativo` é UMA
   expressão SQL: `new.ativo` é resolvido contra o registro real quando ela executa, e
   o `and` **não** protege. Numa tabela sem a coluna, levanta `42703 record "new" has
   no field`. O teste de tabela tem que ser um `if` externo, com o campo aninhado
   dentro. Esse bug passou por dois code reviews e um `/security-review` sem ser visto
   e só apareceu na primeira escrita real — SQL só é verificado de verdade rodando.
2. **Guarda de autorização falha ABERTO com NULL.** `if not minha_funcao() then raise`
   não dispara se a função devolver NULL (`NULL in (...)` é NULL). RLS não expõe isso
   porque policy trata NULL como negado. Toda função de autorização daqui tem que
   devolver `true`/`false` — `exists(...)` já garante; `in (lista)` precisa de
   `coalesce(..., false)`.
- Tabela de controle de acesso: `hub_system_access` (`user_email`, `system_slug`,
  `has_access`, `granted_by`), criada em `sdd-sql-conversor-os.sql`.
- Tabela de nível: `hub_user_roles` (`user_email` UNIQUE, `nivel` em
  `analista`|`administrador`, `granted_by`). **Criada e semeada em produção em
  2026-08-07** (migration `admin_usuarios_hub_user_roles`). RLS: só `authenticated read`
  (SELECT). **Nenhuma policy de escrita — escrita só pela service role.**
- O seed de `hub_user_roles` foi um retrato único dos usuários de então. **Não é
  automático:** usuário criado direto no painel do Supabase não ganha linha e fica sem
  nível. Até a tela de convite existir, inserir a linha à mão.

### `sdd-sql-admin-usuarios.sql` é aplicado em DUAS PARTES

- **PARTE 1** (tabela + RLS + seed): **já aplicada** em 2026-08-07.
- **PARTE 2** (troca da policy de `hub_system_access`): **PENDENTE, não rodar ainda.**
  Ela dropa `authenticated full access`, que hoje é a **única** policy da tabela e da
  qual o `alternarAcessoAction` em produção depende para escrever (ele usa o client do
  usuário, não a service role). Rodar antes do deploy quebra o toggle de
  `/admin/acessos` com "Erro ao atualizar acesso". Só rodar **depois** do deploy do
  código com `alternarAcessoAction` via service role.
- O script é idempotente: reaplicar o arquivo inteiro depois do deploy é seguro.

## Autenticação e autorização

- Só e-mails `@manfac.com.br` entram (`lib/auth/domain.ts`), com exceção do e-mail do
  dono.
- Admins vêm do **banco**, tabela `hub_user_roles`, lida por `lib/auth/roles.ts`
  (`getNivel`, `isAdmin`). Promover/rebaixar é feito na tela `/admin/acessos`, sem
  deploy. `lib/auth/admins.ts` e o `isAdminEmail` **não existem mais** — se você
  encontrar referência a eles em algum lugar, é resíduo desatualizado.
- **Toda escrita** em `hub_user_roles` e `hub_system_access` passa pela service role
  (`lib/supabase/admin.ts`), dentro de Server Actions em `app/admin/_actions.ts`. Não há
  policy de escrita nessas tabelas: o client do navegador não consegue se autopromover.
- Invariantes garantidos nas Server Actions, não só na UI: ninguém altera o próprio
  nível, ninguém se remove, e o último administrador não pode ser rebaixado nem
  removido. A checagem do último admin é um read-then-write, então duas remoções
  realmente simultâneas ainda passariam — risco conhecido e aceito, ver o plano.
- **`sdd-sql-v04-seguranca.sql` foi reescrito para ler `hub_user_roles`** e aplicado em
  produção em 2026-08-10: `sofia_is_admin()` e `sofia_has_access()` existem e as tabelas
  do Sofia estão com `sofia access`. A versão antiga trazia uma lista fixa de três
  e-mails que hoje contradiria o banco — não rode nenhuma cópia antiga desse arquivo.
- `sdd-sql-track-c-integridade.sql` também está aplicado (2026-08-10): as functions
  `lancar_km_atomico`, `atribuir_responsabilidade_veiculo` e `excluir_multas_em_massa`
  são `security definer`, guardadas por `sofia_has_access()`/`sofia_is_admin()` com
  `is not true`, e com `execute` revogado de `public`/`anon`.
- Acesso por sistema: `lib/auth/systemAccess.ts` → `hasSystemAccess()`. Admin sempre
  passa. Aplicado no `middleware.ts`, que é a fronteira real de autorização.
- **RLS de `hub_system_access`: fechada em 2026-08-10.** Até essa data a policy era
  `authenticated full access` (`ALL`, `with_check = true`), e qualquer usuário logado
  podia se conceder acesso a um sistema pelo client do navegador, contornando as Server
  Actions. Hoje `hub_system_access` e `hub_user_roles` têm **apenas** `authenticated
  read` (SELECT): escrita só pela service role.
- O `middleware.ts` roda em todas as rotas do `matcher` no fim do arquivo. Rota nova
  protegida = adicionar ao `matcher`, senão fica aberta.

## Convenções de código

- Route groups: `(auth)`, `(dashboard)`, `(operacoes)`.
- Server Actions ficam em `_actions.ts` ao lado da página; formulários em `_form.tsx`;
  tabelas em `_table.tsx`. Prefixo `_` = não vira rota.
- Testes em `__tests__/` ao lado do código que testam.
- Tema: fundo `#0a1628`, navy `#0d2050`, laranja `#f05a28`, texto secundário `#94a3b8`,
  bordas `#1e3a5f`. Tailwind v4.

## Comandos

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm test         # jest
npm run lint     # eslint
```

Node 20 (`.nvmrc`).

## Processo de trabalho com o João

Nunca pular etapas: **brainstorming → mockup visual aprovado → spec → plano → código →
code review → deploy.** Mockup antes de escrever spec ou código, sempre.

- Bug reportado → usar `superpowers:systematic-debugging` (causa raiz antes de fix).
- Feature nova → usar `superpowers:brainstorming` antes de planejar.
- Perguntas ao João: só quando a resposta muda o que será feito, e nunca sobre fatos
  que estão neste arquivo. Antes de perguntar, verifique aqui e na memória do projeto.
- Nunca colar segredos (service role key, senhas) no chat ou em arquivo versionado.
