# Variáveis de ambiente e deploy — o detalhe

Extraído do `AGENTS.md` em 20/09/2026, quando aquele arquivo foi enxugado para caber no limite de
contexto recomendado. **Nada aqui foi reescrito** — é o mesmo conteúdo, que custou dias de
investigação para ser descoberto. O `AGENTS.md` mantém o resumo e aponta para cá.

## Onde o hub roda

- **EasyPanel.** Painel: `http://2.25.194.184:3000`; o app do hub é
  `/projects/manfac/app/manfac-login-system` (projeto `manfac`, app `manfac-login-system`).
  O botão de **Deploy** fica nessa página.
- **Não há acesso SSH funcional:** a chave `~/.ssh/manfac_vps` recebe `Permission denied (publickey)`.
- **Quem clica em Deploy é o João, não o Claude.** Abrir a URL pela extensão do Chrome cai na tela
  de login do EasyPanel — a sessão do João não chega nesse contexto, e digitar senha é proibido.
- **Em 20/09/2026 apareceu uma barreira nova:** o código de acesso ao EasyPanel passou a estar
  **com o cliente**. Até então a limitação era a disponibilidade do João; agora é credencial de
  terceiro, e o deploy depende de alguém de fora responder.
- **Não há webhook de auto-deploy:** push no `origin/master` não sobe nada sozinho.
- Produção: `https://hub.manfac.com.br`.

## Como confirmar que o build subiu

Não confie no painel nem em "já cliquei". Pegue os `/_next/static/chunks/*.js` de
`https://hub.manfac.com.br/login` e confira o `Last-Modified` de todos:

```bash
html=$(curl -s https://hub.manfac.com.br/login)
echo "$html" | grep -o '/_next/static/chunks/[a-zA-Z0-9._-]*\.js' | sort -u | head -10 | \
  while read c; do curl -sI "https://hub.manfac.com.br$c" | grep -i "^last-modified"; done
```

Todos têm que ter **o mesmo timestamp**, posterior ao push. Timestamps misturados significam cache
velho junto com build novo.

## O site institucional é OUTRO app no mesmo painel

Mesmo projeto `manfac`, app **`manfac-site`** — `/projects/manfac/app/manfac-site`. Domínios
`manfac.com.br`, `www.manfac.com.br` e `manfac-manfac-site.elv4p1.easypanel.host`, porta 3000.

**Deployar o site é clicar em Deploy nesse app, não no `manfac-login-system`.** Os dois vivem no
mesmo projeto e a confusão entre eles já custou uma investigação inteira em 09/08/2026. Para
confirmar o build do site, o mesmo truque, em `https://manfac.com.br`. Baseline do deploy
anterior: `Thu, 16 Jul 2026 20:54:57 GMT`.

## Arquivos de deploy desatualizados — não confie neles

`deploy/DEPLOY.md`, `deploy/ecosystem.config.js`, `.env.production` e os `deploy/nginx-*.conf`
descrevem uma infra antiga de VPS com PM2 + Nginx que **não é mais a que está no ar**.
O `dockerfile` da raiz builda o `manfac-site/`, **não** o hub.

## Variáveis de ambiente

| Variável | Onde é usada | Nota |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | tudo | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tudo | |
| `NEXT_PUBLIC_SITE_URL` | links de e-mail do Supabase Auth | |
| `SUPABASE_SERVICE_ROLE_KEY` | **só** `app/admin/_actions.ts` | Sem ela, `createAdminClient()` lança e `/admin/acessos` inteira cai com erro genérico de Server Component. Ausente no `.env.production` e no `DEPLOY.md`, que estão desatualizados |
| `FIELD_API_KEY` | `app/obras/sincronizar/_execucao.ts` | Header `X-Api-Key` do Field Control. **Segredo: só pelo painel**, nunca no `.env.production` versionado. Sem ela a tela não quebra — a action devolve erro dizendo que a chave falta |
| `OBRAS_CRON_SECRET` | `app/api/obras/sincronizar/route.ts` | Protege a rota chamada pelo `pg_cron`. Fica no Vault do Supabase e no Environment do EasyPanel; nunca em arquivo versionado |

Ao adicionar variável nova, atualize `.env.local.example` **e** esta tabela.

## De onde as variáveis realmente vêm (descoberto em 2026-08-10)

**O hub em produção lê o `.env.production` versionado no repositório**, não o painel do EasyPanel.
O Next.js carrega esse arquivo sozinho no build e no `next start`. Ele contém
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `NEXT_PUBLIC_SITE_URL` — e é por
isso que o hub funcionava mesmo com o painel mal configurado.

A `SUPABASE_SERVICE_ROLE_KEY` **não está nesse arquivo**, e nem pode estar: é segredo. Ela só
chega pelo painel. Consequência prática: **é a única variável cuja falha é invisível até alguém
abrir `/admin/acessos`.**

## A armadilha do campo Environment do EasyPanel

É uma caixa de texto livre onde cada variável precisa ser `NOME=valor` **na mesma linha**. Se o
nome estiver numa linha e o valor na seguinte, o painel não reconhece nada e o container sobe
**sem nenhuma variável**, silenciosamente, porque o `.env.production` cobre o resto.

Isso aconteceu **duas vezes**: em 09/08/2026 e de novo em 16/09/2026, quando cadastrar a
`FIELD_API_KEY` fez o Environment perder **todas** as variáveis.

> ⚠️ **Corolário perigoso:** arrumar o formato faz os valores do painel passarem a valer e
> **sobrescreverem** o `.env.production`. Confira os valores antes de corrigir o formato, ou você
> troca um bug por outro.

**Aparecer no painel não é o mesmo que chegar no processo.** Mudança em *Environment* só entra no
container num novo deploy. Confirme sempre pelo log do app, nunca pela tela do painel. O log é que
provou o problema de 09/08: `Error: SUPABASE_SERVICE_ROLE_KEY não está configurada no ambiente`,
`digest 1608214092`.

## DNS — leia `docs/infra/dns-manfac.md` antes de tocar em domínio

Resumo do que custou 2 dias de indisponibilidade em 18/08/2026: o domínio é registrado via
**Hostinger**, mas o DNS é servido pela **Locaweb** (`ns1/ns2/ns3.locaweb.com.br`) — a zona se
edita no painel da **Locaweb**. `@` e `hub` são registros **A** para `2.25.194.184`.

**Nunca troque os nameservers:** o e-mail `@manfac.com.br` está na Locaweb (MX + SPF) e cai junto,
com perda de mensagens.

**Antes de investigar "o hub caiu", isole DNS de aplicação:**

```bash
curl -sL --resolve hub.manfac.com.br:443:2.25.194.184 https://hub.manfac.com.br/ | grep -i "<title>"
```

Se o título aparecer, a aplicação está perfeita — o problema é DNS, não código nem deploy.
