# Vulnerabilidades do repositório `manfac-facilities/rh` (07/11/2026)

Análise somente leitura. Fonte: `gh api repos/manfac-facilities/rh/dependabot/alerts` (13 abertos), clone raso da `main` (aad6530) e conferência da `rh-modulos` (3ba1606). Nada foi alterado no repositório nem no GitHub.

## 1. Alertas abertos

13 alertas = 7 avisos distintos. Os do Next aparecem em dobro (um por `package.json`, outro por `package-lock.json`).

| # | Sev. | Pacote | Instalada | Corrigida | Relação | Escopo no manifesto | Aviso |
|---|---|---|---|---|---|---|---|
| 11, 12 | crítica | next | 16.3.8 | 16.4.1 | direta | produção | RCE sem autenticação na Image Optimization API (via `sharp`) |
| 15, 16 | crítica | next | 16.3.8 | 16.4.1 | direta | produção | RCE em funções `use cache` que devolvem typed arrays |
| 13, 14 | alta | next | 16.3.8 | 16.4.1 | direta | produção | DoS em App Router com Server Actions |
| 20 | alta | systeminformation | 5.33.15 | 5.33.16 | transitiva (shadcn > @dotenvx/dotenvx) | produção no manifesto | Injeção de comando no Windows em `services()` |
| 10 | alta | body-parser | 2.3.0 | 2.4.0 | transitiva (shadcn > @modelcontextprotocol/sdk > express) | produção no manifesto | DoS por bytes após corpo comprimido |
| 2 | alta | braces | 3.0.3 | nenhuma | transitiva (shadcn > fast-glob > micromatch) | produção no manifesto | **Aviso retirado pelo GitHub** ("não explorável na prática") |
| 9, 17 | média | fast-uri | 3.1.8 | 3.1.9 | transitiva (ajv) | produção no manifesto | Confusão de host / spoofing de esquema |
| 18, 19 | baixa | fast-uri | 3.1.8 | 3.1.9 | transitiva (ajv) | produção no manifesto | Normalização de URI |

Lock idêntico na `rh-modulos`: next 16.3.8, systeminformation 5.33.15, fast-uri 3.1.8, body-parser 2.3.0, braces 3.0.3. O diagnóstico vale para as duas.

Ponto central: **tudo que não é Next entra pelo pacote `shadcn`**, que está em `dependencies` mas é uma CLI. O app só o usa em `app/globals.css` (`@import "shadcn/tailwind.css"`), resolvido em tempo de build. Nenhum arquivo de `app/`, `lib/` ou `components/` o importa em execução.

## 2. Afeta a produção?

Contexto verificado no código: Next `16.3.8` fixo, `output: "standalone"`, Server Actions em uso (`lib/*/actions.ts`, limite de corpo 11 MB), `proxy.ts`, `images.remotePatterns` apontando para o storage do Supabase.

- **Next, DoS em Server Actions (alta): AFETA.** O app usa Server Actions. O aviso diz que não há contorno, só atualização. É a única que atinge o app de verdade.
- **Next, RCE na otimização de imagem (crítica): risco real provavelmente baixo, mas corrigir.** O defeito está na biblioteca `sharp` (Linux glibc). O `package-lock.json` **já resolve `sharp` 0.35.5**, a versão que o aviso indica como contorno. O código não usa `next/image` nem `.svg`, mas o endpoint `/_next/image` existe por haver `images` configurado. Não verifiquei a imagem em produção, só o lock.
- **Next, RCE em `use cache` (crítica): NÃO AFETA hoje.** Busca por `use cache` e `cacheComponents` em `app/`, `lib/` e `next.config.ts`: nenhum resultado. O aviso exige função `use cache` que devolva typed arrays. Corrigir mesmo assim, pois o aviso manda atualizar mesmo sem usar.
- **systeminformation, body-parser, fast-uri, braces: NÃO AFETAM a produção.** Todos vêm do `shadcn` (CLI de desenvolvimento). Com `output: "standalone"` só o que o servidor importa é empacotado, e o `shadcn` não é importado. Ainda: systeminformation é falha só de Windows (produção é Linux); body-parser/express são do servidor MCP da CLI; fast-uri vem do `ajv` da CLI; braces é aviso retirado.
- `npm audit --omit=dev` (após `npm ci --ignore-scripts`) acusou 10 vulnerabilidades (1 crítica, 2 altas, 5 moderadas, 2 baixas), nas mesmas árvores, mais `deepmerge` e `minimatch` (também via `shadcn`/`ts-morph`), que o GitHub não listou. Mesma conclusão: só o `next` é de execução.

**Resumo: 1 aviso afeta de verdade (Next, DoS em Server Actions); 1 crítica (imagem) provavelmente já mitigada pelo `sharp` 0.35.5 do lock; o restante (cerca de 7 dos 13 alertas) é ferramenta de build.**

## 3. Menor correção

1. **Subir o Next para a última 16.4.x (mínimo 16.4.1; `npm audit` sugere 16.4.5).** Versão menor dentro da linha 16, sem salto de major. Resolve os 6 alertas do Next. O Dependabot já abriu o ramo `dependabot/npm_and_yarn/next-16.4.1`. O `package.json` fixa a versão exata (`"next": "16.3.8"`), então o ajuste é trocar esse número. O que pode quebrar: comportamento entre minors do 16 (cache, Server Actions, `proxy.ts`). Rodar `npm test`, `npm run build` e teste de fumaça de login e de uma Server Action de pagamento antes do Deploy. Não há auto-deploy: após o merge é preciso clicar em Deploy e conferir o `Last-Modified` dos chunks.
2. **Mover `shadcn` para `devDependencies`.** Tira da árvore de produção os transitivos (systeminformation, body-parser, fast-uri, braces, deepmerge, minimatch) e zera o ruído de `--omit=dev`. Risco: nenhum em execução; confirmar que o `@import "shadcn/tailwind.css"` continua resolvendo no build.
3. **Alternativa sem mexer no `shadcn`:** atualizar systeminformation (5.33.16), fast-uri (3.1.9) e body-parser (2.4.0), todos dentro do range, ou mesclar os ramos Dependabot existentes (`systeminformation-5.33.19`, `fast-uri-3.1.9`, `body-parser-2.4.0`). O alerta de `braces` não tem versão corrigida e deve ser dispensado como retirado.
4. **Não usar `npm audit fix --force`:** instalaria `shadcn@1.0.0` (quebra) e o Next fora do range.

Recomendação mínima: **itens 1 e 2 num só PR.** Fecha os alertas, exceto `braces`.

## Pendência de verificação

Não confirmei a versão de `sharp` na imagem de produção (só o lock). Se o Dockerfile instalar sem respeitar o lock, o argumento da mitigação cai e o Next sobe com prioridade.
