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
| Admin | `/admin/acessos` | Admin | Liga/desliga acesso de cada e-mail a cada sistema |

Outros diretórios da raiz que **não** fazem parte do hub: `manfac-site/` (site
institucional, deploy próprio via `dockerfile` da raiz), `sistema-os/` e
`material manfac/` (insumos, não código).

## Infra e deploy — leia antes de investigar qualquer bug de produção

- **O hub é deployado no EasyPanel.** Variáveis de ambiente e logs ficam no painel web
  do EasyPanel. Não há acesso SSH funcional: a chave `~/.ssh/manfac_vps` recebe
  `Permission denied (publickey)`.
- **Arquivos de deploy desatualizados — não confie neles:** `deploy/DEPLOY.md`,
  `deploy/ecosystem.config.js`, `.env.production` e os `deploy/nginx-*.conf` descrevem
  uma infra antiga de VPS com PM2 + Nginx que não é mais a que está no ar.
- O `dockerfile` da raiz builda o `manfac-site/`, **não** o hub.
- Produção: `https://hub.manfac.com.br`.

### Variáveis de ambiente

| Variável | Onde é usada | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | tudo | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tudo | |
| `NEXT_PUBLIC_SITE_URL` | links de e-mail do Supabase Auth | |
| `SUPABASE_SERVICE_ROLE_KEY` | **só** `app/admin/_actions.ts` | **Configurada no EasyPanel** (confirmado por João em 2026-08-07) — não investigue erro do Admin por essa via. Se faltar, `createClient(url, '')` **lança exceção** e derruba a página inteira com erro 500. Ausente em `.env.production` e no `DEPLOY.md`, que estão desatualizados. |

Ao adicionar uma variável nova, atualize `.env.local.example` **e** esta tabela.

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
| `v04` | aplicado, **exceto** o índice `veiculos_equipe_ativo_uniq` — ver o cabeçalho do arquivo |
| `track-b` | aplicado |
| `admin-usuarios` PARTE 1 | aplicado |
| `admin-usuarios` PARTE 2 | pendente, **só depois do deploy** |
| `v04-seguranca` | **nunca aplicado** — reescrito em 2026-08-09 para ler `hub_user_roles` |
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
- **`sdd-sql-v04-seguranca.sql` foi reescrito para ler `hub_user_roles`** e nunca foi
  aplicado em produção (confirmado em 2026-08-09: `sofia_is_admin()` e
  `sofia_has_access()` não existem no banco e as tabelas do Sofia seguem com
  `authenticated full access`). A versão antiga trazia uma lista fixa de três e-mails
  que hoje contradiria o banco — não rode nenhuma cópia antiga desse arquivo.
- Acesso por sistema: `lib/auth/systemAccess.ts` → `hasSystemAccess()`. Admin sempre
  passa. Aplicado no `middleware.ts`, que é a fronteira real de autorização.
- **Falha de RLS aberta hoje em produção:** `hub_system_access` tem a policy
  `authenticated full access` (`ALL`, `with_check = true`), então qualquer usuário
  logado pode escrever nela pelo client do navegador e se conceder acesso a um sistema,
  contornando as Server Actions. Não dá para virar admin por essa via. Fechada pela
  PARTE 2 do `sdd-sql-admin-usuarios.sql`, que depende do deploy — ver seção do banco.
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
