# GA4 + banner de consentimento LGPD no `manfac-site` — levantamento técnico

**Data:** 2026-08-29
**Escopo:** só leitura e análise. Nada foi instalado, nenhum código do site foi tocado.
**Alvo:** `manfac-site/` (site institucional, `manfac.com.br`), Next.js **16.2.9**, React 19.2.4.

> Toda afirmação abaixo tem o caminho do arquivo que a sustenta. Onde a doc desta versão
> do Next foi consultada, o caminho é dentro de `manfac-site/node_modules/next/dist/docs/`.
> Nada aqui vem de memória sobre "como o Next costuma ser".

---

## Resumo executivo (as três decisões)

| Item | Recomendação |
|---|---|
| Como carregar o GA4 | `next/script` próprio, **montado só depois do aceite** (opção A do item 3) — não o consent-mode "carrega sempre e nega" |
| Onde mora o Measurement ID | `NEXT_PUBLIC_GA_ID` em `manfac-site/.env.production`, versionado, numa linha só. **Não** no painel do EasyPanel |
| Banner é necessário hoje? | Não. O site **não seta nenhum cookie nem usa storage hoje**. O banner passa a existir só por causa do GA4 — e por isso pode ser simples: uma categoria, aceitar/recusar |

**Bloqueador que ninguém esperava:** o `Content-Security-Policy` em
`manfac-site/next.config.ts` **bloqueia o GA4 por completo**, em silêncio. Sem editar esse
header, nenhuma das duas abordagens funciona. Detalhe no item 5.

---

## 1. `@next/third-parties` — está instalado? Qual versão? Qual o risco?

### Não está instalado

- `manfac-site/package.json` — as dependências são: `@react-three/drei`, `@react-three/fiber`,
  `@supabase/supabase-js`, `lenis`, `next` (16.2.9), `react`, `react-dom`, `three`.
  Não há `@next/third-parties`.
- `manfac-site/node_modules/@next/` contém apenas `env`, `eslint-plugin-next` e
  `swc-win32-x64-msvc` — nenhum `third-parties`.

### O que a doc desta versão diz

`manfac-site/node_modules/next/dist/docs/01-app/02-guides/third-party-libraries.md`:

- Instalação recomendada pela própria doc: `npm install @next/third-parties@latest next@latest`.
- Frase literal da doc: *"`@next/third-parties` is currently an **experimental** library under
  active development. We recommend installing it with the **latest** or **canary** flags while
  we work on adding more third-party integrations."*
- O componente relevante é `<GoogleAnalytics gaId="G-XYZ" />`, importado de
  `@next/third-parties/google`, montado no root layout. Opções aceitas: `gaId` (obrigatória),
  `dataLayerName`, `nonce`.
- Comportamento de carga, na letra da doc: *"By default, it fetches the original scripts after
  hydration occurs on the page."*
- Há também `sendGAEvent('event', 'buttonClicked', { value: 'xyz' })` para eventos, que exige
  o `<GoogleAnalytics />` montado num layout/página pai.

### Qual versão casaria com o next 16.2.9

Consultado no registry (só leitura, sem instalar):

```
npm view @next/third-parties@16.2.9 peerDependencies
peerDependencies = {
  next: '^13.0.0 || ^14.0.0 || ^15.0.0 || ^16.0.0-beta.0',
  react: '^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0'
}
dependencies = { 'third-party-capital': '1.0.20' }
```

- **Existe uma `@next/third-parties@16.2.9` publicada** e ela casa com `next@16.2.9` e
  `react@19.2.4` do site. O pacote é versionado em lockstep com o Next.
- `dist-tags.latest` hoje é **16.3.3**. Ou seja, seguir a instrução literal da doc
  (`@latest next@latest`) **subiria o Next junto**, de 16.2.9 para 16.3.3 — mudança de minor
  do framework inteiro para ganhar analytics. Isso é o oposto de "sem quebrar nada".

### O que "experimental" significa **na prática aqui**

1. A doc manda instalar com `@latest`/`canary`, o que é incompatível com pinagem — e pinagem
   é o que este projeto precisa (o `dockerfile` da raiz roda `npm ci`, então o lockfile manda).
2. A API pode mudar entre minors sem semver-major (é o que "under active development" compra).
   A superfície usada seria minúscula (`<GoogleAnalytics gaId>`), então a exposição é baixa —
   mas atualizar o Next passa a exigir atualizar este pacote junto.
3. Traz uma dependência transitiva nova: `third-party-capital@1.0.20`, que é quem carrega o
   template do script do Google. Uma dependência a mais no `npm ci` do build de produção.

### Recomendação do item 1

**Não instalar `@next/third-parties`. Usar `next/script`, que já vem no Next.**

Motivos, em ordem de peso:

1. **Controle de ordem.** Com consent gate, a ordem exata das chamadas `gtag()` importa
   (`js` → `consent default` → `config`). O componente pronto não expõe esse ponto de
   inserção; `next/script` expõe, porque o inline é seu.
2. **Zero dependência nova**, zero pressão para subir o Next.
3. O que se perde é pequeno: `next/script` já entrega a mesma estratégia de carga
   (`afterInteractive` é o **default** — `node_modules/next/dist/docs/01-app/03-api-reference/02-components/script.md:63`),
   que é exatamente o que o `<GoogleAnalytics>` faz por baixo.

Se por algum motivo o João preferir o pacote oficial: instalar **`@next/third-parties@16.2.9`
exato** (não `@latest`), e nunca junto de `next@latest`.

---

## 2. Onde o componente entraria no layout

`manfac-site/app/layout.tsx` — arquivo inteiro lido. Estrutura atual (linhas 79–99):

```
<html lang="pt-BR">
  <head>
    <script type="application/ld+json" …/>   ← linhas 82–85, JSON-LD
  </head>
  <body className={…}>                        ← linha 87
    <SmoothScroll />                          ← linha 88
    {children}                                ← linha 89
    <WhatsAppFloat />                         ← linha 95
  </body>
</html>
```

Fatos que importam:

- O layout é **Server Component** — não há `'use client'` no topo do arquivo. Logo o banner e
  o gate de consentimento precisam ser client components próprios, como já são
  `manfac-site/components/SmoothScroll.tsx` (`'use client'` na linha 1) e `WhatsAppFloat`.
- O comentário nas linhas 90–94 do próprio `layout.tsx` explica por que o flutuante ficou aqui:
  *"Header e Footer neste projeto são importados página a página, e repetir o flutuante em 7
  arquivos seria erro esperando acontecer."* **A mesma lógica vale para o banner e para o GA.**

### Ponto exato de inserção

Dentro de `<body>`, **depois de `<WhatsAppFloat />` (linha 95)**, dois irmãos novos:

```tsx
<WhatsAppFloat />
<ConsentBanner />   {/* client component, novo */}
<Analytics />        {/* client component, novo — monta o GA só se consentido */}
```

Por que ali e não no `<head>`:

- O JSON-LD no `<head>` (linhas 82–85) é conteúdo de SEO renderizado no servidor; misturar
  analytics ali obrigaria `strategy="beforeInteractive"`, e
  `.../02-components/script.md:69` diz que esses scripts são *"injected into the initial HTML
  from the server, downloaded before any Next.js module"* — ou seja, **dispara antes de qualquer
  chance de checar consentimento**. É exatamente o que não se quer.
- O banner é o último elemento do `<body>` porque precisa ficar por cima de tudo (z-index) e
  não pode empurrar layout. Mesmo lugar do flutuante do WhatsApp, que já resolveu esse problema.

### O que muda no HTML servido

- **Com `afterInteractive` (o default): nada muda no HTML inicial.**
  `.../02-components/script.md:165` — *"Scripts that use the `afterInteractive` strategy are
  injected into the HTML client-side and will load after some (or all) hydration occurs."*
  A tag `<script src="https://www.googletagmanager.com/gtag/js?id=G-…">` não aparece no
  `view-source`; ela é inserida pelo cliente.
- **Com `beforeInteractive`, mudaria** — e mais: `.../02-components/script.md:156` diz que esses
  scripts *"will always be injected inside the `head` of the HTML document regardless of where
  it's placed"*. Não usar.
- **O banner em si** é markup real. Como a decisão de consentimento vive no navegador, o
  servidor não sabe se deve renderizar o banner. Duas saídas: renderizar sempre e esconder via
  efeito (pisca), ou renderizar só após montar no cliente (não pisca, mas o banner aparece um
  frame depois). Esta versão do Next tem guia dedicado:
  `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`.
  **Recomendação:** renderizar só no cliente (o banner não tem valor de SEO nenhum), aceitando
  o frame de atraso.
- A `Metadata` (linhas 17–55) e o JSON-LD **não são afetados** por nada disso.

---

## 3. Consent Mode — como o GA4 não dispara antes do aceite

### As duas saídas, com o custo de cada uma

**(a) Montar o componente do GA4 só depois do aceite**

O `<Analytics />` renderiza `null` enquanto não há consentimento; ao aceitar, passa a
renderizar os `<Script>`. Nenhum byte sai para `googletagmanager.com` antes do clique.

- Ganho: conformidade trivial de demonstrar. Não há requisição, não há IP transmitido, não há
  o que explicar num pedido do titular ou numa auditoria. E, com o CSP atual (item 5), enquanto
  ninguém aceitar não há sequer requisição bloqueada aparecendo no console.
- Custo real: perde-se a medição de quem **não** aceita — que é justamente o que a LGPD quer
  que se perca. Perde-se também a "modelagem de conversão" do Google (o Consent Mode v2
  estima o que não pôde medir); só faz diferença se houver Ads.
- Custo pequeno e contornável: no momento em que o usuário aceita, o `gtag.js` carrega e
  dispara o `page_view` daquela página automaticamente. Ou seja, quem aceita **é** medido a
  partir do aceite. Não se perde a sessão inteira, só o intervalo até o clique.

**(b) Carregar sempre + `gtag('consent','default',{ analytics_storage:'denied', … })`**

- Ganho: continuidade de medição (pings sem cookie), modelagem de conversão, e um `update`
  para `granted` que não exige recarregar nada.
- Custo: **o `gtag.js` é baixado e executado para todo visitante, e envia pings ao Google
  mesmo com tudo negado** (é o desenho do cookieless ping). Isso transmite IP e user-agent
  para um operador nos EUA antes de qualquer manifestação do titular. Sob a LGPD isso é
  tratamento de dado pessoal, e a base legal aqui seria consentimento — que ainda não existe
  naquele instante. Defensável com legítimo interesse? Talvez, com esforço. Barato de
  defender? Não.
- Custo secundário: ~90 KB de terceiro no caminho de todo mundo, inclusive de quem vai recusar.
- Custo terceiro, específico deste site: exige afrouxar o CSP **permanentemente** para o
  Google, já que o header é estático (item 5).

### Recomendação do item 3: **(a), montar só depois do aceite**

Por quê, para **este** site especificamente:

1. **Não há Ads.** Nenhum pixel, nenhuma tag de remarketing, nenhum `gtag`/`fbq` no código —
   verificado no item 6. O único ganho concreto de (b) sobre (a) é modelagem para mídia paga,
   e não há mídia paga instrumentada aqui.
2. **Site institucional B2B de tráfego baixo.** A perda estatística de (a) não muda nenhuma
   decisão de negócio. O que o João vai olhar é "quantas visitas, de onde, quantas foram para
   /contato" — e isso (a) entrega inteiro para quem aceita.
3. **A pergunta do enunciado era "sem disparar analytics antes do aceite".** (b) *dispara*
   analytics antes do aceite — só dispara sem cookie. (a) é a única que cumpre o pedido ao pé
   da letra.
4. **Menos código para errar.** (b) depende de a ordem `consent default` → `config` estar certa
   em todo carregamento, inclusive em navegação client-side; um erro de ordem aqui é silencioso
   e só aparece numa auditoria. (a) não tem ordem para errar: ou o script existe, ou não existe.

**Quando eu mudaria de ideia:** no dia em que entrar Google Ads com conversões. Aí (b) com
`default denied` + `url_passthrough` passa a ter contrapartida real, e o custo jurídico deixa de
ser gratuito. Hoje é custo puro.

**Nota de implementação (não implementar agora):** guardar a decisão numa chave versionada
(`manfac-consent-v1`), para poder invalidar consentimentos antigos se um dia o escopo mudar.

---

## 4. Onde o Measurement ID deve morar

### Fatos verificados

- `manfac-site/.env.production`, conteúdo integral, uma linha:
  `SUPABASE_URL=https://iyytcavcgukfjnjjrerx.supabase.co`
- `manfac-site/.gitignore` ignora `.env*` mas tem `!.env.production` — versionado de propósito.
- `git ls-files | grep env` confirma: `.env.local.example`, `.env.production` (do hub),
  `manfac-site/.env.production`. **Está no repositório.**
- `dockerfile` da **raiz** (é quem builda o site — confirmado):
  ```
  COPY manfac-site/package.json manfac-site/package-lock.json ./
  RUN npm ci
  COPY manfac-site/ .
  RUN npm run build
  CMD ["npm", "run", "start"]
  ```
  O `COPY manfac-site/ .` leva o `.env.production` para dentro da imagem, e o Next o carrega
  sozinho no `next build` e no `next start`.

### O ID do GA4 é segredo?

**Não, e não há como torná-lo secreto.** O `G-XXXXXXXXXX` viaja na URL do script
(`gtag/js?id=G-…`) para o navegador de todo visitante. Além disso,
`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md:158` explica o mecanismo:
qualquer variável `NEXT_PUBLIC_` é *"inlined, at build time, into the js bundle that is delivered
to the client"*. Não existe versão "escondida" de um Measurement ID.

### Recomendação do item 4

**`NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX` em `manfac-site/.env.production`, versionado, numa linha só.**

Motivos:

1. **Não é segredo** — nada a proteger, e o diff do commit vira o registro de quando o ID entrou.
2. **Evita a armadilha do painel do EasyPanel.** O campo *Environment* é caixa de texto livre e
   exige `NOME=valor` na mesma linha; nome numa linha e valor na seguinte faz o container subir
   **sem nenhuma variável**, em silêncio (documentado em `AGENTS.md`, seção "De onde as variáveis
   realmente vêm"). Já custou uma investigação inteira neste projeto. Não repetir por uma
   variável que não precisa estar lá.
3. **O painel não daria flexibilidade nenhuma aqui.** `environment-variables.md:166`:
   *"After being built, your app will no longer respond to changes to these environment
   variables… all `NEXT_PUBLIC_` variables will be frozen with the value evaluated at build
   time"*. Como o EasyPanel exige deploy novo para uma variável entrar **e** `NEXT_PUBLIC_`
   congela no build, o painel não oferece nada que o arquivo não ofereça — só oferece um jeito
   novo de errar.
4. Roda igual em `npm run dev` local, sem ninguém precisar copiar valor de painel.

**Precauções:**

- Ler sempre `process.env.NEXT_PUBLIC_GA_ID` **literal** no código. Nada de
  `const k = 'NEXT_PUBLIC_GA_ID'; process.env[k]` — `environment-variables.md:186` mostra que a
  substituição é textual e o acesso dinâmico não é inlinado.
- **Não** mover `SUPABASE_SERVICE_ROLE_KEY` para esse arquivo. Ela é segredo, é lida em
  `manfac-site/lib/supabase/admin.ts` (`process.env.SUPABASE_SERVICE_ROLE_KEY`) e continua
  vindo só do painel.
- Consequência aceita: **desligar o GA exige um deploy.** Não há como desligar por variável de
  runtime com `NEXT_PUBLIC_`. Para este site isso é aceitável — o "desligar" de verdade que
  importa é o do usuário, no banner, e esse é instantâneo.

---

## 5. Lenis, 3D e pageview em navegação client-side

### Lenis — sem conflito

`manfac-site/components/SmoothScroll.tsx`, arquivo inteiro lido:

- Só faz `new Lenis({ duration: 1.1, smoothWheel: true, autoRaf: true })` num `useEffect`, com
  `lenis.destroy()` no cleanup, e desiste cedo se `prefers-reduced-motion: reduce`.
- **Não toca em `history`, não intercepta cliques, não mexe em `scrollRestoration`.** Não há
  superfície de conflito com o `gtag`.
- O único acoplamento previsto está no próprio comentário do arquivo (linhas 15–21): iframes
  (o futuro mapa da `/contato`) exigiriam importar `lenis/dist/lenis.css`. GA4 não usa iframe
  visível — irrelevante aqui.

### 3D — **não está no bundle** (achado colateral)

- `grep -rn "Hero3D\|@react-three\|from 'three'"` em `manfac-site/{app,components,lib}` retorna
  **apenas o próprio `components/Hero3D.tsx`**. Nenhuma página ou componente o importa.
- `manfac-site/components/Hero.tsx` (linhas 6–17) usa um `<video src="/media/hero.mp4" autoPlay
  muted loop playsInline preload="auto">`, não o Canvas 3D.
- Ou seja: `three`, `@react-three/fiber` e `@react-three/drei` estão em `package.json` mas
  **não chegam ao navegador** — `Hero3D.tsx` é código órfão.
- **Conclusão de peso:** "GA4 somado ao 3D" não é um problema real hoje. E o vídeo do hero com
  `preload="auto"` domina o orçamento de rede em ordens de grandeza acima do `gtag.js`. Com a
  opção (a), o GA nem entra no primeiro carregamento.
- Vale reportar ao João à parte: ou o `Hero3D` volta a ser usado, ou as três dependências
  saem do `package.json` e o `npm ci` do build fica bem mais rápido.

### Pageview em navegação client-side

- O site **é** SPA na navegação: `manfac-site/components/Header.tsx:4` importa `Link` de
  `next/link` e usa `usePathname()`; as rotas são `/`, `/quem-somos`, `/servicos`,
  `/servicos/[slug]`, `/resultados`, `/contato`.
- A doc desta versão trata disso explicitamente —
  `01-app/02-guides/third-party-libraries.md`, seção *"Tracking Pageviews"*:
  *"Google Analytics automatically tracks pageviews when the browser history state changes.
  This means that client-side navigations between Next.js routes will send pageview data
  without any configuration."* Com a ressalva: é preciso que **Enhanced Measurement** esteja
  ligado e o checkbox *"Page changes based on browser history events"* marcado no painel do GA4.
- A mesma seção alerta: se alguém decidir mandar pageview manual, tem que **desligar** a medição
  automática, senão os dados duplicam.
- **Recomendação:** não escrever código de pageview. Ligar Enhanced Measurement no painel do
  GA4 e conferir no DebugView navegando entre `/` e `/servicos`. É configuração, não código.
- Esta versão oferece ainda `instrumentation-client.ts` com `onRouterTransitionStart(url,
  navigationType)` (`01-app/03-api-reference/03-file-conventions/instrumentation-client.md`),
  que seria o lugar canônico para pageview manual. **Não usar aqui**, por dois motivos: seria a
  duplicação que a doc alerta, e o arquivo roda *antes da hidratação do React* — ou seja, antes
  de qualquer chance de checar consentimento.

### O bloqueador de verdade: **CSP**

`manfac-site/next.config.ts` aplica em `source: '/(.*)'` um `Content-Security-Policy` com:

```
default-src 'self'
script-src 'self' 'unsafe-inline'         (+ 'unsafe-eval' só em dev)
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com
img-src 'self' data: blob:
frame-ancestors 'none'
```

Consequência, ponto a ponto:

1. `script-src` **não** inclui `https://www.googletagmanager.com` → o `gtag/js` é **bloqueado**.
2. Não há diretiva `connect-src`, então ela herda `default-src 'self'` → mesmo que o script
   carregasse, o hit para `https://www.google-analytics.com/g/collect` seria **bloqueado**.
3. `img-src 'self' data: blob:` → o fallback de pixel do GA também seria **bloqueado**.

**GA4 não vai funcionar neste site sem editar `next.config.ts`.** E o modo como falha é o pior
possível: nada quebra visualmente, o site continua perfeito, só não chega dado nenhum no GA4 —
e o erro só aparece no console do navegador. É o cenário clássico de "instalei, esperei uma
semana, não veio nada".

Mínimo necessário na edição (pré-requisito da implementação, **não feito aqui**):

- `script-src`: acrescentar `https://www.googletagmanager.com`
- `connect-src`: criar a diretiva — `'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com`
- `img-src`: acrescentar `https://www.google-analytics.com https://www.googletagmanager.com`

Observação honesta: como o header é **estático**, essa permissão vale para todo visitante o
tempo todo, inclusive para quem recusou. Isso não vaza dado (o script só é montado após o
aceite, na opção (a)), mas enfraquece a política em papel. A alternativa — CSP dinâmico com
nonce via `proxy.ts` (`01-app/02-guides/content-security-policy.md`; nesta versão o antigo
middleware chama-se **proxy**) — não compensa: o site **não tem** `proxy.ts` nem `middleware.ts`
hoje (`ls manfac-site/proxy.* manfac-site/middleware.*` → não existe), e criar um só para isto
tornaria toda a renderização dinâmica. **Recomendação: ampliar o header estático.**

---

## 6. Estado atual de cookies e storage

### Busca feita

```
grep -rniE "cookie|localStorage|sessionStorage|indexedDB" \
  manfac-site/{app,components,lib} e configs da raiz do site
  (excluindo node_modules e .next)
```

**Resultado: 0 ocorrências.** Nenhum arquivo casa.

### Corroboração por outros caminhos

- **Nada seta cookie no servidor:** não existe `proxy.ts` nem `middleware.ts` em `manfac-site/`.
- **Sem sessão de auth no navegador:** o formulário de contato usa Server Action
  (`manfac-site/app/contato/_actions.ts`) gravando via service role em
  `manfac-site/lib/supabase/admin.ts` — cliente criado com
  `auth: { autoRefreshToken: false, persistSession: false }`. Nenhum token no navegador.
- **Fontes não geram request a terceiro:** `manfac-site/app/layout.tsx:2` usa
  `next/font/google`, que auto-hospeda no build. O CSP até permite `fonts.gstatic.com`, mas na
  prática não é usado.
- **Nenhum pixel de terceiro:** não há `gtag`, `fbq`, `hotjar`, `clarity` ou similar no código.

### O que isso significa para o banner

**O site hoje não seta um único cookie próprio e não usa storage nenhum.** Logo:

1. **O banner não é necessário hoje.** Ele passa a ser necessário *exclusivamente* por causa
   do GA4. Não há passivo prévio a regularizar.
2. **Ele pode ser simples.** Uma única finalidade ("estatísticas de uso"), uma única categoria,
   dois botões — *Aceitar* e *Recusar*, com peso visual equivalente (botão de recusa escondido
   ou em cinza fraco é justamente o que a ANPD trata como consentimento viciado). Nada de tela
   de preferências por categoria: não há categorias.
3. **Guardar a preferência em `localStorage`, não em cookie.** Recomendação explícita. Assim o
   site continua verdadeiramente "sem cookies próprios" — a afirmação fica literal, não
   aproximada. Um cookie de consentimento também seria legítimo (estritamente necessário,
   dispensa consentimento), mas ele viaja em toda request de asset e obriga a explicar "usamos
   um cookie para lembrar que você não quer cookies". `localStorage` evita as duas coisas.
   Chave sugerida: `manfac-consent-v1` (versionada, para invalidar em massa se o escopo mudar).
4. **Falta uma página de política de privacidade.** As rotas existentes são `/`, `/quem-somos`,
   `/resultados`, `/servicos`, `/servicos/[slug]`, `/contato` (`manfac-site/app/`, mais
   `app/sitemap.ts`). Não há `/privacidade`. O banner precisa linkar para algum lugar, e a
   LGPD exige informar finalidade e como revogar. **Isso é decisão e conteúdo do João** — não
   é decisão técnica, e não deve ser inventado por mim.

---

## Riscos e o que pode dar errado

Em ordem de probabilidade × dano.

1. **CSP bloqueia tudo em silêncio e ninguém percebe por semanas.** (alto × alto)
   `manfac-site/next.config.ts` não permite `googletagmanager.com` nem `google-analytics.com`
   em `script-src`/`connect-src`/`img-src`. O site continua funcionando perfeitamente; só não
   chega dado. **Mitigação:** editar o CSP na mesma PR do GA4 e validar em produção abrindo o
   console + DebugView do GA4 — nunca dar por concluído sem ver um evento chegar.

2. **Deploy no app errado do EasyPanel.** (médio × alto)
   `AGENTS.md` registra que isso já custou uma investigação inteira em 09/08. O site é o app
   **`manfac-site`** (`/projects/manfac/app/manfac-site`), não o `manfac-login-system`.
   **Mitigação:** confirmar o build comparando o `Last-Modified` dos
   `https://manfac.com.br/_next/static/chunks/*.js`.

3. **Esquecer que `NEXT_PUBLIC_` congela no build.** (médio × médio)
   Trocar o ID no `.env.production` sem rebuildar não muda nada; o valor antigo continua
   inlinado no bundle (`environment-variables.md:166`). **Mitigação:** tratar troca de ID como
   deploy, não como configuração.

4. **Banner piscando no primeiro paint.** (médio × baixo)
   O HTML é servido igual para todos e o consentimento só é conhecido no cliente. Renderizar o
   banner no servidor faz ele aparecer e sumir para quem já aceitou. **Mitigação:** renderizar
   o banner só após montar no cliente; guia desta versão em
   `01-app/02-guides/preventing-flash-before-hydration.md`.

5. **Pageview duplicado ou ausente na navegação SPA.** (médio × médio)
   Se alguém implementar pageview manual "por garantia" com o Enhanced Measurement ligado,
   os números dobram — e um número dobrado é pior que número nenhum, porque parece certo.
   **Mitigação:** não escrever código de pageview; ligar Enhanced Measurement no painel e
   validar navegando entre duas rotas no DebugView.

6. **Consentimento coletado sem base para sustentá-lo.** (médio × alto, jurídico)
   Banner sem página de privacidade, ou com botão de recusa visualmente inferior ao de aceite,
   é consentimento viciado — pior que não ter GA. **Mitigação:** publicar `/privacidade` antes
   ou junto do banner; botões com o mesmo peso visual; revogação acessível depois do aceite
   (um link no rodapé que reabre o banner).

7. **`@next/third-parties` puxando upgrade do Next.** (baixo × alto)
   Só se a recomendação do item 1 for ignorada e alguém rodar o comando literal da doc
   (`@next/third-parties@latest next@latest`) — hoje isso subiria o Next de 16.2.9 para 16.3.3.
   **Mitigação:** não instalar o pacote; se instalar, pinar `16.2.9` exato.

8. **`three`/`@react-three` continuarem no `package.json` sem uso.** (alto × baixo)
   Não é risco do GA4, é dívida achada de passagem: `Hero3D.tsx` é órfão e as três dependências
   pesam no `npm ci` de todo build de produção sem entregar nada. Decisão do João.

9. **Segredo indo parar no arquivo versionado.** (baixo × altíssimo)
   `manfac-site/.env.production` é versionado por desenho (`!.env.production` no `.gitignore`).
   Convidativo para "colocar as variáveis todas ali". **Mitigação:** o ID do GA4 pode ir;
   `SUPABASE_SERVICE_ROLE_KEY` **nunca**, e nenhuma outra chave privada.

10. **Lenis + banner fixo em mobile.** (baixo × baixo)
    Não é conflito de scroll (`SmoothScroll.tsx` não intercepta nada), mas o banner ocupa a
    base da tela onde já vive o `WhatsAppFloat` (`app/layout.tsx:95`). **Mitigação:** mockup
    mobile antes do código, com os dois na tela ao mesmo tempo.

---

## O que este documento NÃO decide

Fica para o João, porque muda o que será construído:

- Se vai existir uma página `/privacidade` e qual o texto dela.
- Se o banner bloqueia a página (modal) ou é uma barra discreta no rodapé.
- Se o GA4 é o objetivo final ou se o alvo é GTM (o container abre a porta para outros pixels
  depois, ao custo de mais uma camada e um CSP mais largo).
