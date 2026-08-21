# Manfac Site v04 — Frente C (blog) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar `/blog` e `/blog/[slug]` no `manfac-site`, com os posts em markdown no repositório, e — o ponto da frente — fazer cada post linkar a página de serviço correspondente e cada página de serviço linkar de volta os posts dela.

**Architecture:** Nenhum banco, nenhuma Server Action, nenhuma variável de ambiente nova. Os posts são arquivos em `content/blog/*.md`, lidos do disco **em tempo de build** por `lib/blog.ts`, que é a única camada que toca `node:fs`. As duas rotas são prerenderizadas (`generateStaticParams` + `dynamicParams = false`), então em produção o blog é HTML estático servido pelo `next start`. `Header` e `Footer` continuam sendo montados página a página, como no resto do site.

**Tech Stack:** Next 16.2.9 (custom, Turbopack), React 19.2.4, Tailwind v4, TypeScript, Vitest + Testing Library, `gray-matter` e `marked` (dependências novas).

## Global Constraints

- **Este Next não é o Next padrão.** Ler o guia relevante em `node_modules/next/dist/docs/` antes de escrever qualquer coisa que toque metadata, rota dinâmica, `generateStaticParams`, sitemap ou JSON-LD. Já conferidos e citados nas tasks: `02-guides/mdx.md`, `02-guides/json-ld.md`, `03-api-reference/04-functions/generate-metadata.md`, `03-api-reference/04-functions/generate-static-params.md`, `03-api-reference/03-file-conventions/01-metadata/sitemap.md`.
- **Quirk conhecido:** este Next descarta o espaço entre tag de fechamento e texto seguinte (`</strong> texto` vira `</strong>texto`). Usar `{' '}` explícito.
- Node 20 (`.nvmrc`). Toda a copy em **português do Brasil**.
- Paleta só via tokens de `app/globals.css`: `--ink #00345e`, `--orange #f85e0b`, `--orange-hover #d6520a`, `--muted #6e8894`, `--border #dadad8`, `--surface #f6f6f5`, `--background #ffffff`.
- Testes em `__tests__/` ao lado do código que testam. **`npm test` roda puro — não passar flags de pool** (a flakiness do Vitest no Windows foi resolvida em `vitest.config.mts`, commit `ef6ebee`). Para arquivo único: `npx vitest run <caminho>`.
- **`prefers-reduced-motion: reduce` continua desligando tudo.** Esta frente não introduz animação nova; só reusa `Reveal`.
- **`lib/blog.ts` importa `node:fs` — nunca pode ser importado por um Client Component.** Não há o pacote `server-only` no projeto; a proteção é convenção mais o comentário no topo do arquivo. Sintoma de violação: erro de bundling citando `fs` durante o `next build`.
- **A CSP do próprio site (`next.config.ts`) bloqueia imagem de fora do domínio.** Toda capa entra em `public/media/blog/`.
- **Não mexer em nada de `/contato`** (`app/contato/`, `components/ContactForm.tsx`, `lib/whatsapp.ts`): a frente B está em execução nesses arquivos.

## File Structure

| Arquivo | Responsabilidade | Ação |
|---|---|---|
| `content/blog/*.md` | os posts | Criar |
| `public/media/blog/` | capas + `og-padrao.jpg` | Criar |
| `lib/blog.ts` | ler, validar e renderizar os posts | Criar |
| `lib/blog-jsonld.ts` | montar `BlogPosting` e `BreadcrumbList` | Criar |
| `components/PostCard.tsx` | cartão da listagem, com fallback sem capa | Criar |
| `components/PostMeta.tsx` | linha mono categoria · tempo · data | Criar |
| `components/ConteudosRelacionados.tsx` | grade de posts, usada em 3 lugares | Criar |
| `components/ServicoRelacionado.tsx` | bloco de link do post para o serviço | Criar |
| `app/blog/page.tsx` | listagem, destaque, estado vazio | Criar |
| `app/blog/[slug]/page.tsx` | post, metadata e JSON-LD | Criar |
| `app/robots.ts` | anunciar o sitemap | Criar |
| `app/sitemap.ts` | somar `/blog` e os posts | Modificar |
| `components/ServicePage.tsx` | seção "Conteúdos sobre …" | Modificar |
| `lib/content.ts` | `NAV_ITEMS` ganha Blog | Modificar |
| `components/Footer.tsx` | Institucional ganha Blog | Modificar |
| `app/globals.css` | classes de tipografia do corpo do post | Modificar |
| `package.json` | `gray-matter`, `marked` | Modificar |

**Ordem das tasks:** a base de dados primeiro, porque tudo depende dela; o que altera o site inteiro (menu, rodapé, sitemap, robots) por último, onde é barato reverter sem perder o resto. A Task 1 sozinha não muda nada no ar — é a única com risco zero de regressão.

---

### Task 1: `lib/blog.ts` — ler, validar e renderizar os posts

**Files:**
- Modify: `manfac-site/package.json`
- Create: `manfac-site/lib/blog.ts`
- Create: `manfac-site/content/blog/.gitkeep`
- Test: `manfac-site/lib/__tests__/blog.test.ts`
- Fixtures: `manfac-site/lib/__tests__/fixtures/blog/*.md`

**Interfaces:**
- Consumes: `SERVICOS_DATA`, `getServico` de `@/lib/servicos`
- Produces, de `@/lib/blog`:
  - `type Post = { slug, titulo, resumo, data, categoria, capa?, capaAlt?, atualizado?, servicos, autor, rascunho, corpoHtml, minutos }`
  - `type PostResumo = Omit<Post, 'corpoHtml'>`
  - `getAllPosts(): PostResumo[]` — publicados, mais recentes primeiro
  - `getPost(slug: string): Post | null`
  - `getPostsPorServico(servicoSlug: string, limite?: number): PostResumo[]`
  - `parsePost(raw: string, nomeArquivo: string): Post` — exportada **para o teste poder rodar sem tocar o disco**
  - `renderMarkdown(md: string): string`
  - `tempoDeLeitura(texto: string): number`

- [ ] **Step 1: Instalar as duas dependências**

Run: `cd manfac-site && npm install gray-matter marked`

> Só estas duas. `@next/mdx` foi descartado na spec: não resolve frontmatter (doc do Next, `02-guides/mdx.md:622`), custa 4 pacotes e restringe plugins sob Turbopack (mesma doc, linhas 726–760).

- [ ] **Step 2: Escrever os testes que falham**

Criar `manfac-site/lib/__tests__/blog.test.ts` cobrindo, no mínimo:

```ts
import { parsePost, renderMarkdown, tempoDeLeitura } from '../blog'

const valido = `---
titulo: Custo real de cada emergência
resumo: Toda emergência cobra duas contas, e a segunda quase nunca é medida pela operação.
data: 2026-08-21
categoria: manutencao-predial
---

Texto do post.
`

describe('parsePost', () => {
  it('usa o nome do arquivo como slug', () => {
    expect(parsePost(valido, 'custo-real.md').slug).toBe('custo-real')
  })

  it('quebra citando o arquivo e o campo quando falta obrigatório', () => {
    const semResumo = valido.replace(/^resumo:.*$/m, '')
    expect(() => parsePost(semResumo, 'custo-real.md')).toThrow(/custo-real\.md.*resumo/s)
  })

  it('recusa categoria fora do catálogo de serviços', () => {
    const errada = valido.replace('manutencao-predial', 'dicas-gerais')
    expect(() => parsePost(errada, 'x.md')).toThrow(/categoria/)
  })

  it('recusa capa sem capaAlt', () => { /* ... */ })
  it('recusa <script> no corpo', () => { /* ... */ })
  it('assume "Equipe Manfac" quando não há autor', () => { /* ... */ })
  it('atualizado ausente cai para data', () => { /* ... */ })
})

describe('renderMarkdown', () => {
  it('rebaixa h1 do corpo para h2', () => {
    expect(renderMarkdown('# Título')).toContain('<h2')
    expect(renderMarkdown('# Título')).not.toContain('<h1')
  })

  it('dá id slugificado aos headings', () => {
    expect(renderMarkdown('## Como medir sem instalar nada')).toContain('id="como-medir-sem-instalar-nada"')
  })

  it('marca link externo com target e rel', () => {
    const html = renderMarkdown('[abnt](https://abnt.org.br)')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('target="_blank"')
  })

  it('deixa link interno sem target', () => {
    expect(renderMarkdown('[serviço](/servicos/hvac)')).not.toContain('target=')
  })

  it('recusa imagem sem alt', () => {
    expect(() => renderMarkdown('![](/media/blog/x.jpg)')).toThrow(/alt/)
  })
})

describe('tempoDeLeitura', () => {
  it('arredonda para cima a 200 palavras por minuto', () => {
    expect(tempoDeLeitura('palavra '.repeat(410))).toBe(3)
  })

  it('nunca devolve zero', () => {
    expect(tempoDeLeitura('duas palavras')).toBe(1)
  })
})
```

Somar um teste de `getAllPosts()` sobre as fixtures em `lib/__tests__/fixtures/blog/`, cobrindo **ordenação por data desc** e **rascunho fora da lista**. `getAllPosts` precisa aceitar um diretório por parâmetro opcional (default `content/blog`) para isso ser testável.

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run lib/__tests__/blog.test.ts`
Expected: FAIL — módulo `../blog` não existe

- [ ] **Step 4: Implementar `lib/blog.ts`**

Esqueleto obrigatório no topo do arquivo:

```ts
// Lê os posts do disco EM TEMPO DE BUILD. Importa node:fs — nunca importar este
// módulo de um Client Component; o next build quebra citando `fs` sem explicar.
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { marked } from 'marked'
import { SERVICOS_DATA } from '@/lib/servicos'

const OBRIGATORIOS = ['titulo', 'resumo', 'data', 'categoria'] as const
const CATEGORIAS = SERVICOS_DATA.map((s) => s.slug)
const PROIBIDO = /<script|<iframe|\son[a-z]+\s*=/i
const PALAVRAS_POR_MINUTO = 200
```

Regras que os testes acima cobrem e que **não podem ser suavizadas na implementação**:
validação lança `Error` com nome do arquivo e campo; `categoria` tem que estar em
`CATEGORIAS`; `capa` sem `capaAlt` lança; `PROIBIDO` no corpo lança; `resumo` fora de
120–160 caracteres só emite `console.warn`.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd manfac-site && npx vitest run lib/__tests__/blog.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add manfac-site/package.json manfac-site/package-lock.json manfac-site/lib/blog.ts manfac-site/lib/__tests__ manfac-site/content
git commit -m "feat(manfac-site): leitura e validacao dos posts de blog em markdown"
```

---

### Task 2: JSON-LD como função pura

**Files:**
- Create: `manfac-site/lib/blog-jsonld.ts`
- Test: `manfac-site/lib/__tests__/blog-jsonld.test.ts`

**Interfaces:**
- Consumes: `Post` de `@/lib/blog`, `SITE_URL` de `@/lib/site`, `getServico` de `@/lib/servicos`
- Produces:
  - `buildPostJsonLd(post: Post): Record<string, unknown>` — nó `BlogPosting`
  - `buildBreadcrumbJsonLd(post: Post): Record<string, unknown>` — nó `BreadcrumbList`

- [ ] **Step 1: Escrever os testes que falham**

```ts
it('é um BlogPosting, não um Article', () => {
  expect(buildPostJsonLd(post)['@type']).toBe('BlogPosting')
})

it('corta a headline em 110 caracteres', () => {
  const longo = { ...post, titulo: 'a'.repeat(200) }
  expect((buildPostJsonLd(longo).headline as string).length).toBeLessThanOrEqual(110)
})

it('dateModified cai para a data de publicação quando não há atualizado', () => {
  expect(buildPostJsonLd(post).dateModified).toBe(post.data)
})

it('mainEntityOfPage aponta para a canonical absoluta', () => {
  const node = buildPostJsonLd(post) as any
  expect(node.mainEntityOfPage['@id']).toBe(`${SITE_URL}/blog/${post.slug}`)
})

it('image cai para a OG padrão quando o post não tem capa', () => { /* ... */ })
it('articleSection traz o nome do serviço, não o slug', () => { /* ... */ })

it('a trilha tem 3 níveis na ordem Início, Blog, post', () => {
  const itens = (buildBreadcrumbJsonLd(post) as any).itemListElement
  expect(itens.map((i: any) => i.position)).toEqual([1, 2, 3])
  expect(itens[1].name).toBe('Blog')
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run lib/__tests__/blog-jsonld.test.ts`
Expected: FAIL

- [ ] **Step 3: Implementar**

`author` é `Organization` "Manfac Engenharia" quando `autor` é o default; vira `Person`
quando o frontmatter nomeia alguém. `publisher` sempre `Organization` com `logo`.
`inLanguage: 'pt-BR'`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd manfac-site && npx vitest run lib/__tests__/blog-jsonld.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add manfac-site/lib/blog-jsonld.ts manfac-site/lib/__tests__/blog-jsonld.test.ts
git commit -m "feat(manfac-site): dados estruturados BlogPosting e BreadcrumbList"
```

---

### Task 3: Componentes de apresentação

**Files:**
- Create: `manfac-site/components/PostMeta.tsx`
- Create: `manfac-site/components/PostCard.tsx`
- Create: `manfac-site/components/ConteudosRelacionados.tsx`
- Create: `manfac-site/components/ServicoRelacionado.tsx`
- Test: `manfac-site/components/__tests__/PostCard.test.tsx`
- Test: `manfac-site/components/__tests__/ConteudosRelacionados.test.tsx`

**Interfaces:**
- Consumes: `PostResumo` de `@/lib/blog`, `getServico` de `@/lib/servicos`, `Reveal`
- Produces:
  - `PostMeta({ post, className? })`
  - `PostCard({ post, destaque? })` — `destaque` usa o layout de duas colunas
  - `ConteudosRelacionados({ posts, titulo, eyebrow, verTodos? })` — **devolve `null` com lista vazia**
  - `ServicoRelacionado({ slugs })` — bloco de fim de post

- [ ] **Step 1: Escrever os testes que falham**

```ts
describe('PostCard', () => {
  it('linka o post pelo slug', () => {
    const { container } = render(<PostCard post={post} />)
    expect(container.querySelector(`a[href="/blog/${post.slug}"]`)).not.toBeNull()
  })

  it('mostra categoria e tempo de leitura', () => {
    render(<PostCard post={post} />)
    expect(screen.getByText(/Manutenção Predial/)).toBeTruthy()
    expect(screen.getByText(/6 min/)).toBeTruthy()
  })

  it('sem capa, cai no ladrilho de planta baixa em vez de imagem quebrada', () => {
    const { container } = render(<PostCard post={{ ...post, capa: undefined }} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.blueprint-grid')).not.toBeNull()
  })

  it('tem um único link, para não duplicar a âncora', () => {
    const { container } = render(<PostCard post={post} />)
    expect(container.querySelectorAll('a').length).toBe(1)
  })
})

describe('ConteudosRelacionados', () => {
  it('não renderiza nada com lista vazia', () => {
    const { container } = render(<ConteudosRelacionados posts={[]} titulo="x" eyebrow="y" />)
    expect(container.firstChild).toBeNull()
  })

  it('mostra no máximo 3', () => { /* ... */ })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run components/__tests__/PostCard.test.tsx components/__tests__/ConteudosRelacionados.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar os quatro componentes**

Conforme o mockup aprovado. Detalhes que vêm do mockup e não podem ser inventados de novo:

- linha mono `CATEGORIA · N MIN DE LEITURA · DD MMM AAAA`, categoria em `--orange`, resto em `--muted`;
- capa em `next/image` com `fill` + `sizes`, proporção 16:9, cantos `rounded-xl`;
- fallback sem capa: `div` com `blueprint-grid`, fundo `--surface`, nome da categoria em mono;
- link único envolvendo o título, com `after:absolute after:inset-0` para estender a área clicável, e `focus-visible` visível;
- `<time dateTime={post.data}>` na data.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd manfac-site && npx vitest run components/__tests__`
Expected: PASS, sem quebrar os testes já existentes de `Header`/`Footer`/`WhatsAppFloat`

- [ ] **Step 5: Commit**

```bash
git add manfac-site/components/PostMeta.tsx manfac-site/components/PostCard.tsx manfac-site/components/ConteudosRelacionados.tsx manfac-site/components/ServicoRelacionado.tsx manfac-site/components/__tests__
git commit -m "feat(manfac-site): componentes de cartao e blocos relacionados do blog"
```

---

### Task 4: `/blog` — listagem e estado vazio

**Files:**
- Create: `manfac-site/app/blog/page.tsx`
- Modify: `manfac-site/app/globals.css`

**Interfaces:**
- Consumes: `getAllPosts` de `@/lib/blog`, `PostCard`, `Header`, `Footer`, `Contato`, `Reveal`
- Produces: rota `/blog`

- [ ] **Step 1: Montar a página**

Server Component. Estrutura, na ordem: `Header` → hero com `blueprint-grid` sobre `--surface`
(eyebrow "Blog · Manfac Engenharia", `h1` "Manutenção predial, obras e climatização na
prática", subtítulo) → destaque → grade → `Contato` → `Footer`.

Três estados, decididos na spec:

```tsx
const posts = getAllPosts()
// 0        → estado vazio, com os 4 serviços como saída
// 1 ou 2   → só o destaque, sem grade (cartão solitário em grade de 3 parece defeito)
// 3+       → destaque + grade dos demais
```

- [ ] **Step 2: Metadata, com o `noindex` condicional**

```tsx
export async function generateMetadata(): Promise<Metadata> {
  const vazio = getAllPosts().length === 0
  return {
    title: 'Blog — Manutenção Predial, Obras e HVAC | Manfac Engenharia',
    description: '...',
    alternates: { canonical: `${SITE_URL}/blog` },
    robots: vazio ? { index: false, follow: true } : undefined,
    openGraph: { /* type: 'website', url, siteName, locale, images */ },
  }
}
```

> O `robots` condicional é o que impede uma página vazia de ser indexada, e ele vira sozinho
> quando o primeiro post entra. Não transformar isso em constante manual.

- [ ] **Step 3: Tipografia do corpo em `globals.css`**

Acrescentar um bloco `.post-prose` com `h2`, `p`, `ul/li`, `a`, `blockquote`, `figure` e
`figcaption`, usando só os tokens existentes. Vai ser consumido pela Task 5. Largura de
leitura ~68ch, `h2` em `--ink`, link em `--orange` com sublinhado e `text-underline-offset`.

- [ ] **Step 4: Verificar**

Run: `cd manfac-site && npx tsc --noEmit && npm run build`
Expected: build limpo, `/blog` listada como estática

- [ ] **Step 5: Commit**

```bash
git add manfac-site/app/blog/page.tsx manfac-site/app/globals.css
git commit -m "feat(manfac-site): listagem do blog com destaque e estado vazio"
```

---

### Task 5: `/blog/[slug]` — a página do post

**Files:**
- Create: `manfac-site/app/blog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getPost`, `getAllPosts`, `getPostsPorServico` de `@/lib/blog`; `buildPostJsonLd`, `buildBreadcrumbJsonLd`; `ServicoRelacionado`; `ConteudosRelacionados`
- Produces: rota `/blog/[slug]`

- [ ] **Step 1: Rota, params e prerender**

Espelhar `app/servicos/[slug]/page.tsx`, que já está certo para esta versão do Next —
`params` é **Promise** e precisa de `await` (remoção do acesso síncrono é breaking change da
v16, `02-guides/upgrading/version-16.md:294`):

```tsx
export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }))
}

export const dynamicParams = false
```

> `dynamicParams = false` faz `/blog/qualquer-coisa` dar 404 determinístico. Sem isso o
> `next start` tentaria renderizar em runtime um post que não existe em disco.

- [ ] **Step 2: `generateMetadata`**

Campos exatamente como na spec. **Declarar `openGraph` inteiro**, incluindo `images`: quando
a página declara `openGraph`, ele substitui o do `app/layout.tsx` em vez de mesclar, e um
post sem `images` herdaria o `logo.png` do layout raiz.

- [ ] **Step 3: JSON-LD, do jeito que esta versão do Next manda**

`<script type="application/ld+json">` nativo dentro do JSX da página — **não** `next/script`,
**não** no `layout.tsx` — com o escape que a doc exige (`02-guides/json-ld.md`):

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
/>
```

Dois scripts: `buildPostJsonLd` e `buildBreadcrumbJsonLd`.

- [ ] **Step 4: Montar a página**

`Header` → trilha visível em `<nav aria-label="Trilha">` → cabeçalho (`PostMeta`, `h1`,
resumo como lead, assinatura) → capa (omitida quando não há) → `<article className="post-prose"
dangerouslySetInnerHTML={{ __html: post.corpoHtml }} />` → `ServicoRelacionado` →
`Contato` → `ConteudosRelacionados` ("Leia também", oculto com menos de 2 posts publicados)
→ `Footer`.

> A trilha aparece **na tela**, não só no JSON-LD: breadcrumb marcado e invisível é a versão
> que o Google desconta.

- [ ] **Step 5: Criar um post de verdade para poder verificar**

Sem nenhum arquivo em `content/blog/`, `generateStaticParams` devolve `[]` e não há o que
conferir. Criar **um** post real (tema a confirmar com o João — ver pendências no fim) com
capa em `public/media/blog/`, mais o `og-padrao.jpg` 1200×630.

- [ ] **Step 6: Verificar**

Run: `cd manfac-site && npx tsc --noEmit && npm run build`
Expected: build limpo, `/blog/<slug>` listada como estática

Conferir no navegador (servidor de dev já de pé): a trilha, o `h1` único, o bloco de serviço
relacionado, e o JSON-LD colado no [Rich Results Test](https://search.google.com/test/rich-results).

- [ ] **Step 7: Commit**

```bash
git add manfac-site/app/blog manfac-site/content/blog manfac-site/public/media/blog
git commit -m "feat(manfac-site): pagina do post com metadata, JSON-LD e trilha"
```

---

### Task 6: O link de volta nas páginas de serviço

**Files:**
- Modify: `manfac-site/components/ServicePage.tsx`
- Test: `manfac-site/components/__tests__/ServicePage.test.tsx`

**Interfaces:**
- Consumes: `getPostsPorServico(servico.slug, 3)`, `ConteudosRelacionados`
- Produces: seção "Conteúdos sobre {nome}" nas 4 páginas de serviço

> **Esta é a task que justifica a frente inteira.** Sem ela, o blog é conteúdo solto; com
> ela, cada publicação empurra autoridade para a página que vende.

- [ ] **Step 1: Escrever o teste que falha**

```ts
it('lista os conteúdos do serviço logo antes do bloco de contato', () => {
  const { container } = render(<ServicePage servico={servicoFake} posts={[postFake]} />)
  expect(container.querySelector(`a[href="/blog/${postFake.slug}"]`)).not.toBeNull()
})

it('não renderiza a seção quando não há post da categoria', () => {
  render(<ServicePage servico={servicoFake} posts={[]} />)
  expect(screen.queryByText(/Conteúdos sobre/)).toBeNull()
})
```

> **Decisão de interface:** `ServicePage` recebe `posts` por prop, vindos da rota, em vez de
> chamar `getPostsPorServico` por dentro. `ServicePage` é um componente de apresentação e
> renderizado nos testes com Testing Library; se ele mesmo lesse o disco, o teste passaria a
> depender de `content/blog` e quebraria a cada post novo.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd manfac-site && npx vitest run components/__tests__/ServicePage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implementar**

`ServicePage` ganha `posts?: PostResumo[]` e renderiza `<ConteudosRelacionados>` logo antes
de `<Contato />`. `app/servicos/[slug]/page.tsx` passa `getPostsPorServico(slug, 3)`.

> `getPostsPorServico` casa por `categoria` **e** pelo array `servicos`, para um post poder
> alimentar mais de uma página de serviço sem mudar de categoria.

- [ ] **Step 4: Verificar**

Run: `cd manfac-site && npx vitest run && npx tsc --noEmit && npm run build`
Expected: tudo passando, build limpo

- [ ] **Step 5: Commit**

```bash
git add manfac-site/components/ServicePage.tsx manfac-site/app/servicos manfac-site/components/__tests__/ServicePage.test.tsx
git commit -m "feat(manfac-site): paginas de servico listam os conteudos da categoria"
```

---

### Task 7: Menu, rodapé, sitemap e robots

**Files:**
- Modify: `manfac-site/lib/content.ts`
- Modify: `manfac-site/components/Footer.tsx`
- Modify: `manfac-site/app/sitemap.ts`
- Create: `manfac-site/app/robots.ts`
- Test: `manfac-site/app/__tests__/sitemap.test.ts`
- Test: `manfac-site/components/__tests__/Header.test.tsx` (existente)
- Test: `manfac-site/components/__tests__/Footer.test.tsx` (existente)

**Interfaces:**
- Consumes: `getAllPosts`
- Produces: `/blog` no menu e no rodapé; `/blog` e os posts no `sitemap.xml`; `/robots.txt`

- [ ] **Step 1: Escrever os testes que falham**

```ts
// app/__tests__/sitemap.test.ts
it('mantém as 9 URLs que já existiam', () => { /* home, quem-somos, servicos, 4 slugs, resultados, contato */ })
it('inclui cada post publicado', () => { /* ... */ })
it('não inclui rascunho', () => { /* ... */ })
it('usa a data do post como lastModified, não a data global', () => { /* ... */ })
```

E, nos testes existentes:

```ts
// Header.test.tsx
it('leva ao blog', () => {
  const { container } = render(<Header />)
  expect(container.querySelector('a[href="/blog"]')).not.toBeNull()
})
// e atualizar o teste dos 5 itens de navegação para 6

// Footer.test.tsx — somar '/blog' à lista de hrefs institucionais já assertada
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `cd manfac-site && npx vitest run app/__tests__/sitemap.test.ts components/__tests__/Header.test.tsx components/__tests__/Footer.test.tsx`
Expected: FAIL

- [ ] **Step 3: `NAV_ITEMS` e rodapé**

Em `lib/content.ts`, inserir `{ href: '/blog', label: 'Blog' }` **entre Resultados e
Contato**. Em `Footer.tsx`, acrescentar o mesmo item ao array `INSTITUCIONAL`, entre
Resultados e Contato.

> `isNavActive` já trata prefixo (`lib/nav.ts`), então `/blog/qualquer-post` acende o item
> Blog sem alteração nenhuma.

- [ ] **Step 4: Sitemap**

Manter as rotas fixas com `LAST_CONTENT_UPDATE` e **acrescentar** `/blog` (só quando houver
post) e um item por post com `lastModified: new Date(post.atualizado ?? post.data)`,
`changeFrequency: 'yearly'`, `priority: 0.6`.

- [ ] **Step 5: `app/robots.ts`**

```ts
import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

> Hoje **não existe** `app/robots.ts` nem `public/robots.txt`: o `sitemap.xml` está no ar e
> não é anunciado a ninguém. Correção de SEO mais barata do projeto, e ela só cabe aqui
> porque é o blog que faz o sitemap ter o que anunciar.

- [ ] **Step 6: Verificar**

Run: `cd manfac-site && npx vitest run && npx tsc --noEmit && npm run build`
Expected: tudo passando

**Conferir no navegador, não só no código:** com 6 itens, a pílula do header aperta em
larguras de notebook (~1024–1280px)? Se apertar, reduzir o `gap-8` do `<nav>` desktop para
`gap-6`. **Não mexer na opacidade de 70% nem no formato da pílula** — foram aprovados no
mockup da frente A.

- [ ] **Step 7: Commit**

```bash
git add manfac-site/lib/content.ts manfac-site/components/Footer.tsx manfac-site/app/sitemap.ts manfac-site/app/robots.ts manfac-site/app/__tests__ manfac-site/components/__tests__
git commit -m "feat(manfac-site): blog no menu e no rodape, sitemap com os posts e robots.txt"
```

---

### Task 8: Verificação de ponta a ponta

**Files:** nenhum, salvo correções que aparecerem.

- [ ] **Step 1: Suíte e build**

Run: `cd manfac-site && npm run lint && npx tsc --noEmit && npx vitest run && npm run build`
Expected: tudo limpo

- [ ] **Step 2: Checar a saída do build**

`/blog` e cada `/blog/<slug>` têm que aparecer como **estáticas** na tabela do `next build`.
Rota marcada como dinâmica significa que algo virou request-time por engano — investigar
antes de seguir.

- [ ] **Step 3: Navegador**

Com o servidor de dev já de pé, conferir e **medir**, não olhar:

| O que | Como |
|---|---|
| Folga entre a pílula e o conteúdo em `/blog` e `/blog/<slug>` | `getBoundingClientRect`, viewport a 360px — a frente A registra 46–54px nas outras rotas |
| Menu de 6 itens não quebra a pílula | reduzir a janela até 1024px |
| Trilha, `h1` único, bloco de serviço relacionado | inspecionar o DOM |
| `/sitemap.xml` e `/robots.txt` | abrir as duas URLs |
| Bloco "Conteúdos sobre …" | abrir a página de serviço da categoria do post e a de outra categoria (tem que sumir) |
| Nenhum erro novo no console | ignorar o aviso de hidratação `data-lt-installed`, que vem de extensão do navegador |

- [ ] **Step 4: Dados estruturados**

Colar a URL do post no [Rich Results Test](https://search.google.com/test/rich-results):
`BlogPosting` e `BreadcrumbList` válidos, sem erro.

- [ ] **Step 5: Code review**

Usar `superpowers:requesting-code-review`.

---

## Encerramento da frente C

1. **Push** — pedir autorização ao João antes; push é ação separada do commit.
2. **Deploy** — o João clica Deploy no app **`manfac-site`** do EasyPanel
   (`/projects/manfac/app/manfac-site`), **não** no `manfac-login-system`. Confirmar o build
   comparando o `Last-Modified` dos `/_next/static/chunks/*.js` de `https://manfac.com.br`:
   todos com o mesmo timestamp, posterior ao push.
3. **Depois do deploy:** enviar o `sitemap.xml` no Google Search Console. Sem isso o ganho
   demora semanas a aparecer.
4. **Registrar no `AGENTS.md`** que publicar post é commit + Deploy manual, e que
   `content/blog/` é conteúdo, não código.

## Pendências que não são de código

Nenhuma bloqueia as tasks 1–7; a Task 5 precisa de **um** post para poder verificar, e ele
pode nascer provisório.

| Pendência | Bloqueia | Recomendação já registrada na spec |
|---|---|---|
| Autoria dos posts | valor de `autor` e `author` do JSON-LD | "Equipe Manfac" |
| Os 3 primeiros temas | o blog nascer com conteúdo | — |
| Origem das fotos de capa | `public/media/blog/` | fotos próprias de obra; a CSP proíbe hotlink |
| `og-padrao.jpg` 1200×630 | preview de link de post sem capa | fundo `--ink` com a marca |
| Ritmo de publicação | nada agora; define quando entram paginação e arquivo de categoria | — |
