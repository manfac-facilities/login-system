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

- **Migrations são manuais.** Cada mudança de schema vira um arquivo `sdd-sql-*.sql` na
  raiz que alguém roda à mão no SQL Editor do Supabase. Não existe CLI de migration.
- Consequência: código mergeado ≠ schema aplicado. Antes de concluir que um bug é de
  código, verifique se o SQL correspondente já rodou em produção.
- Tabela de controle de acesso: `hub_system_access` (`user_email`, `system_slug`,
  `has_access`, `granted_by`), criada em `sdd-sql-conversor-os.sql`.

## Autenticação e autorização

- Só e-mails `@manfac.com.br` entram (`lib/auth/domain.ts`), com exceção do e-mail do
  dono.
- Admins são uma **lista fixa no código**: `lib/auth/admins.ts`. Mudar admin = mudar
  código + deploy.
- Acesso por sistema: `lib/auth/systemAccess.ts` → `hasSystemAccess()`. Admin sempre
  passa. Aplicado no `middleware.ts`, que é a fronteira real de autorização.
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
