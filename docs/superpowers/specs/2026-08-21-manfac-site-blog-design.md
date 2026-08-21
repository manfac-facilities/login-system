# Manfac Site v04 — Frente C: blog

**Data:** 2026-08-21
**Mockup:** https://claude.ai/code/artifact/2ac24f11-1f92-4345-a7f0-4682b6e0b1a4 — **aguardando aprovação do João**
**Escopo:** `/blog` e `/blog/[slug]` no `manfac-site`, mais o link recíproco nas 4 páginas de serviço, sitemap e `robots.txt`
**Fora de escopo:** frente D (tradução PT/EN/ES), auditoria de copy/SEO das páginas existentes, analytics

## Por que este blog existe

Palavras do João em 21/08: *"o blog tem objetivo de melhorar o seo do site, então ele deve
ser planejado com esse objetivo primário"*. Isso não é um enfeite de briefing — é o critério
de corte de todas as decisões abaixo. Item que não serve a **indexação**, **autoridade** ou
**link interno** precisa de outra justificativa forte para existir, e a maior parte não tem.

O site hoje tem 9 URLs. Um site desse tamanho não perde ranking por falta de conteúdo:
perde por não ter **nada apontando para as páginas que vendem**. As 4 páginas de serviço
recebem link do menu, do dropdown e do rodapé — sempre os mesmos links, sempre com o mesmo
texto-âncora, sempre do mesmo lugar. É o piso.

**O blog é a única máquina disponível de gerar links internos novos, com texto-âncora
variado, para as páginas de serviço.** Esse é o ganho. Tráfego de cauda longa vem depois e é
bônus. Toda a arquitetura abaixo é desenhada em torno disso, não em torno de "publicar
artigos".

### Decisões que o João já tomou e não se reabrem

| Decisão | Escolha | Consequência |
|---|---|---|
| Onde os posts moram | **Arquivos markdown no repositório** | Publicar = commit + push + Deploy no EasyPanel. Sem CMS, sem painel, sem banco, sem upload pelo navegador |
| Objetivo | **SEO em primeiro lugar** | Estrutura se justifica por indexação/autoridade/link interno |
| Referência de estrutura | `https://tols-energy.jdop2015.chatgpt.site/` | **Autoridade só sobre estrutura.** É protótipo de ChatGPT; a execução visual é a do site que já está no ar |
| Identidade visual | **A do site atual** | Mesmos tokens de `globals.css`, mesmo `Header`, mesmo `Footer`, mesma linguagem de `Reveal`/`BlueprintSection` |

O que foi herdado da referência: **rótulo de categoria + tempo de leitura em mono acima do
título**, capa 16:9, "Ler matéria" como chamada, Blog no menu e no rodapé. O que **não** foi
herdado: nada da execução visual dela.

## Estrutura de rotas

| Rota | O que é | Estático? |
|---|---|---|
| `/blog` | Listagem | Sim, prerenderizada |
| `/blog/[slug]` | Post | Sim, `generateStaticParams` + `dynamicParams = false` |

### Slug plano: sem data e sem categoria na URL

`/blog/custo-real-de-cada-emergencia`, não `/blog/2026/08/manutencao/...`.

- **Data na URL envelhece o post na hora.** Conteúdo técnico de manutenção predial é
  evergreen; um `/2026/` no caminho faz o próprio Google e o próprio leitor descontarem
  relevância a cada ano que passa, sem que uma linha do texto tenha mudado.
- **Categoria na URL congela a taxonomia.** No dia em que um post mudar de categoria — e vai
  mudar — a URL muda junto, e aí ou se quebra o link ou se mantém um redirect para sempre.
  Este app não tem hoje nenhuma infraestrutura de redirect, e criar uma para resolver um
  problema que o desenho pode evitar é trabalho inventado.

O `slug` é o **nome do arquivo**, não um campo de frontmatter. Fonte única: renomear o
arquivo renomeia a URL, e isso aparece no diff do commit em vez de ficar escondido dentro
do YAML.

### Categoria: sim como metadado, não como rota

Esta é a decisão de estrutura mais importante da frente, e ela não é sobre taxonomia — é
sobre link interno.

**A categoria é fechada e igual ao catálogo de serviços.** Os únicos valores aceitos são os
4 slugs de `lib/servicos.ts`: `obras-e-reformas`, `novas-construcoes`, `manutencao-predial`,
`hvac`. Não é uma taxonomia nova; é a que já existe e que alguém já mantém por outro motivo.

O que isso compra, de graça e sem disciplina editorial:

1. O rótulo em mono no cartão e no post, como na referência.
2. **Um link automático de cada post para a página de serviço correspondente**, com o nome
   real do serviço como texto-âncora.
3. **O link de volta**: a página de serviço passa a listar os posts daquela categoria. Esta
   é a direção que efetivamente melhora ranking, porque a página de serviço é a que vende.

**Não existe rota `/blog/categoria/[x]` na v1.** Com menos de 10 posts, um arquivo de
categoria é uma página magra que compete com a própria `/blog` e não ranqueia para nada.
Gatilho registrado para não ser rediscutido: **só criar arquivo de categoria quando alguma
categoria passar de 6 posts.**

**Tags: não.** Tag é a taxonomia que todo mundo cria e ninguém mantém, e o arquivo de tag é
o gerador clássico de conteúdo magro. Se um dia fizer falta, entra; a ausência não custa
nada hoje.

## Markdown → HTML

### O que foi verificado antes de escolher

- `manfac-site/package.json` **não tem nenhuma biblioteca de markdown** — nem `marked`, nem
  `remark`, nem `@next/mdx`, nem transitiva. Qualquer caminho exige dependência nova.
- `node_modules/next/dist/docs/01-app/02-guides/mdx.md`, linha 622: **`@next/mdx` não
  suporta frontmatter**, e a própria doc manda somar `gray-matter` ou um plugin remark.
- Mesma doc, linhas 726–760: com **Turbopack** — que este projeto usa
  (`next.config.ts` define `turbopack.root`) — plugins de remark/rehype só podem ser
  passados por **nome em string**, e plugins com opções não serializáveis não funcionam.
- `next.config.ts` define uma CSP com `img-src 'self' data: blob:`. **Imagem hospedada fora
  do domínio é bloqueada pelo próprio site.** Isso decide a política de imagens mais abaixo.
- O `dockerfile` da raiz faz `COPY manfac-site/ .` — um diretório `content/` novo entra na
  imagem sem nenhuma alteração de build.

### Escolha: markdown puro lido do disco, não MDX

Posts em `manfac-site/content/blog/*.md`, lidos e convertidos em `lib/blog.ts`, no servidor,
em tempo de build.

**Por que não `@next/mdx`:** ele custa 4 pacotes (`@next/mdx`, `@mdx-js/loader`,
`@mdx-js/react`, `@types/mdx`), obriga a mexer em `pageExtensions`, exige um
`mdx-components.tsx` na raiz, **ainda assim não resolve frontmatter**, e restringe plugins
por causa do Turbopack. Em troca oferece JSX dentro do conteúdo — que, para um texto escrito
por quem faz marketing e revisado em pull request, é passivo e não ativo. E a listagem fica
pior: com MDX é preciso importar cada módulo para ler o metadado; com arquivo em disco é uma
leitura de diretório.

**Dependências novas — duas, e o porquê de cada uma:**

| Pacote | Para quê | Por que não dá para evitar |
|---|---|---|
| `gray-matter` | Separar o frontmatter YAML do corpo | Parser de YAML na mão erra em título com dois-pontos, aspas e acento. É o mesmo pacote que a doc do Next recomenda |
| `marked` | Markdown → HTML, síncrono, com renderer customizável | A alternativa é a cadeia `unified`+`remark`+`rehype`, que são 5+ pacotes e API assíncrona, para o mesmo resultado |

### O corpo vira string de HTML, e isso tem duas consequências

O `marked` devolve HTML como string, inserida com `dangerouslySetInnerHTML`. Duas
consequências que precisam estar escritas:

1. **Não dá para usar `next/image` no corpo do post.** Componente React não existe dentro de
   uma string de HTML. Imagem no meio do texto vira `<img loading="lazy" decoding="async">`
   dentro de um `<figure>`, sem otimização automática. **Quem publica é responsável por
   commitar a imagem já dimensionada** (≤1600px de largura, JPEG qualidade ~80). Está aqui
   por escrito porque é exatamente o tipo de detalhe que vira bug de Lighthouse seis meses
   depois, sem ninguém entender por quê.
2. **O limite de confiança é o pull request.** A CSP do site permite `'unsafe-inline'` em
   script, então HTML bruto malicioso dentro de um post rodaria. Como defesa proporcional —
   e porque o risco real aqui é engano, não ataque — **o parser recusa o post e quebra o
   build** se o corpo contiver `<script`, `<iframe` ou atributo `on...=`. Post de blog da
   Manfac não precisa de nenhum dos três.

Ajustes no renderer, todos com motivo:

- **`# H1` no corpo é rebaixado para `h2`.** O `h1` da página é o `titulo`; dois `h1` é erro
  de SEO clássico e barato de evitar na origem em vez de cobrar do autor.
- **Todo heading ganha `id` slugificado**, para link direto a seção. O
  `scroll-padding-top: 6rem` que já existe em `globals.css` faz a âncora parar abaixo da
  pílula do header — não precisa de nada novo.
- **Link externo ganha `target="_blank" rel="noopener noreferrer"`.** Link interno continua
  `<a>` simples: não dá para virar `next/link` dentro de uma string, e navegação cheia numa
  página de conteúdo é aceitável.

## Frontmatter

```yaml
---
titulo: Manutenção preventiva ou corretiva: como calcular o custo real de cada emergência
resumo: Toda emergência cobra duas contas — a do reparo e a da operação parada. A segunda quase nunca é medida.
data: 2026-08-21
categoria: manutencao-predial
capa: /media/blog/custo-emergencia.jpg
capaAlt: Técnico de manutenção diante de um quadro elétrico aberto
atualizado: 2026-09-02
servicos: [hvac]
autor: Equipe Manfac
rascunho: false
---
```

| Campo | Obrigatório | Para que serve |
|---|---|---|
| `titulo` | **sim** | `h1`, base do `<title>`, `headline` do JSON-LD |
| `resumo` | **sim** | `description`, resumo do cartão, `description` do JSON-LD |
| `data` | **sim** | ordenação, `datePublished`, `lastModified` do sitemap |
| `categoria` | **sim** | um dos 4 slugs de serviço; gera o link para a página de serviço |
| `capaAlt` | **sim se houver `capa`** | acessibilidade e leitura de imagem pelo buscador |
| `capa` | não | imagem de capa e `og:image` |
| `atualizado` | não | `dateModified`; quando ausente, cai para `data` |
| `servicos` | não | serviços **adicionais** a linkar além da categoria |
| `autor` | não | default `Equipe Manfac` |
| `rascunho` | não | `true` esconde de listagem, sitemap e `generateStaticParams` |

**Tempo de leitura não é campo.** É calculado do corpo a 200 palavras/minuto, mínimo de
1 minuto. Número derivado que um humano mantém é número que fica errado.

### O que acontece quando falta um campo: o build quebra

Falha alta e imediata, com o nome do arquivo e o campo faltando na mensagem.

**Por que quebrar e não degradar:** um post sem `resumo` renderiza perfeitamente e sobe sem
meta description — dano de SEO invisível, que é justamente o que este blog existe para
evitar. Já um build quebrado é visto em segundos, por quem acabou de escrever o post,
enquanto ainda tem o contexto na cabeça. Sobre o custo do lado ruim: um typo bloqueia o
deploy do site inteiro. É aceitável **porque publicar já passa por commit e deploy manual** —
o build já é o portão. Não seria aceitável num CMS com publicação instantânea.

O que **não** quebra o build: campo desconhecido no frontmatter (ignorado, para o arquivo
poder carregar anotação editorial), e `resumo` fora da faixa de 120–160 caracteres, que
apenas emite aviso no console do build.

O que **também** quebra: `categoria` fora da lista dos 4 serviços (erro de digitação vira
post órfão, sem link para serviço nenhum — o oposto do objetivo da frente), `capa` sem
`capaAlt`, imagem no corpo sem texto alternativo, e o HTML proibido descrito acima.

## Metadata por post

`generateMetadata` em `app/blog/[slug]/page.tsx`, seguindo exatamente o padrão que
`app/servicos/[slug]/page.tsx` já usa — inclusive canonical absoluta montada com `SITE_URL`.

| Campo | Valor |
|---|---|
| `title` | `{titulo} — Manfac Engenharia` |
| `description` | `resumo` |
| `alternates.canonical` | `${SITE_URL}/blog/${slug}` |
| `openGraph.type` | `article` |
| `openGraph.publishedTime` / `modifiedTime` | `data` / `atualizado ?? data` |
| `openGraph.authors` | `[autor]` |
| `openGraph.images` | `capa` absoluta, ou o fallback |
| `twitter` | `summary_large_image` com a mesma imagem |

O `openGraph` precisa ser declarado por inteiro na página: quando a página declara
`openGraph`, ele **substitui** o do `app/layout.tsx` em vez de mesclar campo a campo — se
`images` for omitido, o post herda o `logo.png` do layout raiz. Conferido em
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`.

**Sem capa:** `og:image` cai para um único `/media/blog/og-padrao.jpg` (1200×630, fundo
`--ink`, marca). Preview de link sem imagem tem clique muito pior, e este é o único
consumidor que não tem como se virar sem o arquivo.

**OG dinâmica com `next/og`** — gerar a imagem com o título escrito por cima — é tentadora e
não custa dependência, mas fica **fora do escopo**: acrescenta carregamento de fonte em
tempo de build, que é uma classe de falha nova para resolver um problema que uma imagem
estática resolve. Fica registrado como candidato de fase 2.

Na listagem: `title: 'Blog — Manutenção Predial, Obras e HVAC | Manfac Engenharia'`,
canonical `${SITE_URL}/blog`, `openGraph.type: 'website'`.

## JSON-LD

Dois blocos, os dois em `app/blog/[slug]/page.tsx`.

**`BlogPosting`**, não `Article`. Google trata os dois igual, e `BlogPosting` é honesto sobre
o que a página é. Campos: `headline` (o `titulo`, cortado em 110 caracteres — acima disso o
Google descarta o campo inteiro), `description`, `image` absoluta, `datePublished`,
`dateModified`, `author` (`Organization` Manfac Engenharia, ou `Person` quando o frontmatter
nomear alguém), `publisher` com `logo`, `mainEntityOfPage` apontando para a canonical,
`inLanguage: 'pt-BR'`, `articleSection` com o nome do serviço.

**`BreadcrumbList`** — Início › Blog › título. É o que faz o resultado no Google aparecer com
a trilha em vez da URL crua. Ganho pequeno, custo quase zero, e a trilha **também aparece na
tela**: markup de breadcrumb sem breadcrumb visível é a versão que o Google desconta.

**Como injetar, neste Next:** `<script type="application/ld+json">` nativo dentro do JSX da
página, com `JSON.stringify(jsonLd).replace(/</g, '\\u003c')`. É literalmente o que
`node_modules/next/dist/docs/01-app/02-guides/json-ld.md` manda fazer nesta versão — inclusive
o escape, e inclusive a observação de que `next/script` é a ferramenta errada aqui porque
JSON-LD não é código executável. **Não vai no `layout.tsx`**: o layout raiz já injeta o nó
`GeneralContractor` global, e os dois convivem como scripts separados sem conflito.

Os objetos são montados por funções puras em `lib/blog-jsonld.ts`, para poderem ser testadas
sem renderizar página nenhuma.

## Sitemap e robots

`app/sitemap.ts` hoje tem 9 URLs e um `LAST_CONTENT_UPDATE = new Date('2026-07-15')` fixo
para todas.

- As rotas estáticas continuam como estão, com a data fixa.
- **Cada post entra com a própria data** (`atualizado ?? data`). `lastmod` idêntico em todas
  as URLs é o padrão que ensina o buscador a ignorar o campo; data real é o que faz ele valer.
- Prioridades: home 1, páginas atuais 0.8, `/blog` 0.7, posts 0.6.
- `changeFrequency`: `/blog` semanal, posts anual. Post evergreen declarado como semanal é
  mentira que o crawler confere e descarta.
- **Rascunhos não entram.** Mesma função que alimenta `generateStaticParams`, para não haver
  chance de o sitemap anunciar URL que não existe.
- **`/blog` só entra no sitemap quando houver pelo menos um post.**

**`app/robots.ts` não existe hoje, e `public/robots.txt` também não.** Consequência: o
sitemap está no ar em `/sitemap.xml` mas **não é anunciado a ninguém**. Entra nesta frente,
com `allow: '/'` e `sitemap: ${SITE_URL}/sitemap.xml`. É a correção de SEO mais barata do
projeto inteiro, e ela só passou despercebida até agora porque sem blog o sitemap tinha
pouco a anunciar.

## Link interno — o núcleo da frente

Três mecanismos. Os dois primeiros são **automáticos**, e isso é a decisão, não um detalhe:
link interno que depende de alguém lembrar de fazer é link interno que não existe em seis
meses.

**1 · Post → página de serviço.** Todo post termina com um bloco "Serviço relacionado"
apontando para `/servicos/{categoria}`, com o nome real do serviço como texto-âncora, mais
os slugs opcionais de `servicos`. Nome descritivo é o que transfere relevância; "clique aqui"
não transfere nada.

**2 · Página de serviço → posts.** `ServicePage.tsx` ganha, logo antes do `<Contato />`, uma
seção "Conteúdos sobre {nome do serviço}" com até 3 posts daquela categoria, mais recentes
primeiro. **Não renderiza nada quando não há post** — seção vazia numa página no ar é pior
que seção nenhuma. Esta é a direção que melhora ranking de verdade: a página de serviço é a
que converte, e ela passa a receber link novo, com âncora nova, a cada publicação.

**3 · Links no corpo.** Escritos à mão pelo autor. A convenção editorial é: **todo post cita
ao menos uma página de serviço no meio do texto**, não só no bloco do fim. Convenção, não
validação automática — validar isso exigiria adivinhar intenção.

Ainda: **"Leia também"** com até 3 posts, mesma categoria primeiro e depois os mais recentes,
oculto enquanto houver menos de 2 posts publicados.

### Onde o blog aparece na navegação

- **Menu:** `NAV_ITEMS` em `lib/content.ts`, **entre `Resultados` e `Contato`**. Contato
  continua sendo o último item, que é onde o olho procura o caminho de conversão. Passa de
  5 para 6 itens.
  > **Risco a verificar no navegador, não no código:** a pílula do header comporta logo +
  > 6 itens + CTA "Solicitar atendimento". Em largura de notebook (~1024–1280px) isso pode
  > apertar. Se apertar, reduzir o `gap-8` do `<nav>` para `gap-6` **antes** de mexer em
  > qualquer outra coisa — a pílula e a opacidade de 70% foram aprovadas no mockup da frente
  > A e não se mexe nelas.
- **Rodapé:** coluna "Institucional", que a spec da frente A já deixou reservada com a nota
  *"Blog entra na frente C"*.

## Imagens

- **Ficam em `public/media/blog/`**, commitadas com o post. Mesmo lugar do resto da mídia do
  site.
- **Não existe a opção de linkar imagem de fora.** A CSP do próprio site
  (`img-src 'self' data: blob:`) bloqueia. Vale registrar porque é contraintuitivo e é a
  primeira coisa que alguém tenta fazer ao publicar depressa.
- Capa na listagem e no topo do post: `next/image` com `fill` + `sizes`, proporção 16:9.
- **Post sem capa:** o cartão cai num ladrilho com o `.blueprint-grid` que o site já usa,
  fundo `--surface`, com o nome da categoria em mono. Zero arquivo novo, dentro da
  identidade, e visivelmente diferente de imagem quebrada. **Foto genérica de banco de
  imagens foi descartada de propósito**: além de já estar indexada em mil sites, ensina o
  leitor que a imagem não quer dizer nada. Na página do post, sem capa o topo simplesmente
  não tem imagem — `h1` e resumo seguram sozinhos.
- Imagem no meio do texto: `<figure>` + `<img loading="lazy">`, sem otimização automática,
  pelo motivo já explicado. Sem alt, o build quebra.

## Estado vazio e paginação

**O blog vai nascer com zero post**, e o link para ele estará no menu de todas as páginas.

- **`/blog` com zero posts responde 200** com uma tela de verdade: promessa editorial, os 4
  serviços como saída e a banda de contato. 404 ali seria um link quebrado em todas as
  páginas do site.
- **Enquanto estiver vazia, ela sai do sitemap e recebe `robots: { index: false }`.** Página
  vazia indexada é sinal de qualidade contra o domínio inteiro. As duas coisas são calculadas
  da contagem de posts, então viram sozinhas quando o primeiro post entrar — sem ninguém
  precisar lembrar.
- **1 ou 2 posts:** só o destaque em largura cheia, sem a grade de 3 — um cartão solitário
  numa grade de três colunas parece defeito.
- **3 ou mais:** destaque + grade.

**Paginação: não existe na v1.** Arquivo paginado divide autoridade e cria páginas magras;
com menos de 12 posts, uma página só é mais rápida de rastrear e melhor de usar. Gatilho e
mecanismo já decididos para não virar discussão depois: **a partir de 12 posts**, criar
`/blog/pagina/[n]`, cada página com canonical apontando para **si mesma** — canonicalizar a
página 2 para a página 1 desindexa exatamente os posts que só a página 2 linka.

## Acessibilidade e movimento

- Um único link por cartão, envolvendo o título, com área clicável estendida por
  pseudo-elemento. O rótulo de categoria é texto, não link — link dentro de link é erro de
  árvore de acessibilidade e divide o sinal de âncora entre dois destinos.
- `<article>` para o post, `<time dateTime>` para as datas, trilha dentro de
  `<nav aria-label="Trilha">`.
- Um `h1` por página, garantido no renderer.
- `Reveal` nos cartões da listagem e nos blocos do post. **O corpo do texto não recebe
  `Reveal`**: animar parágrafo de artigo atrapalha quem está lendo, que é a única pessoa que
  importa nessa tela.
- `prefers-reduced-motion` já está coberto pelo `Reveal` e pelo bloco em `globals.css`.
  Nenhuma animação nova é introduzida nesta frente.
- Contraste: `--muted` em texto pequeno sem modificador de opacidade. A revisão da frente A
  já pegou uma regressão de contraste exatamente por opacidade aplicada sobre `--muted`.

## Testes

Vitest + Testing Library, em `__tests__/` ao lado do código. **`npm test` roda puro — não
passar flags de pool** (resolvido em 20/08, commit `ef6ebee`); para arquivo único,
`npx vitest run <caminho>`.

| Arquivo | O que cobre |
|---|---|
| `lib/__tests__/blog.test.ts` | slug vem do nome do arquivo; campo obrigatório faltando lança com o nome do arquivo na mensagem; `categoria` fora da lista lança; `capa` sem `capaAlt` lança; `<script>` no corpo lança; rascunho fora da listagem; ordenação por data desc; tempo de leitura; `h1` rebaixado; `id` em heading; `rel` em link externo |
| `lib/__tests__/blog-jsonld.test.ts` | `@type` é `BlogPosting`; `headline` cortado em 110; `dateModified` cai para `data`; `mainEntityOfPage` bate com a canonical; `BreadcrumbList` com 3 níveis na ordem certa |
| `components/__tests__/PostCard.test.tsx` | href do slug; categoria e tempo de leitura visíveis; ladrilho de fallback quando não há capa; um único link no cartão |
| `components/__tests__/ConteudosRelacionados.test.tsx` | filtra por categoria e por `servicos`; não renderiza nada com lista vazia; no máximo 3 |
| `app/__tests__/sitemap.test.ts` | as 9 URLs atuais continuam lá; cada post publicado entra; rascunho não entra; `/blog` ausente com zero posts |
| `components/__tests__/Header.test.tsx` (existente) | somar: `/blog` presente, e a contagem de itens sobe para 6 |
| `components/__tests__/Footer.test.tsx` (existente) | somar: `/blog` na coluna Institucional |

**As `page.tsx` não são testadas por render.** São Server Components assíncronos e a
Testing Library não os renderiza. Por isso toda a lógica que valeria testar vive em
`lib/blog.ts`, `lib/blog-jsonld.ts` e nos componentes de apresentação — isso é o desenho, não
uma limitação sofrida.

## Publicação e deploy

Publicar um post é: criar o `.md` em `content/blog/`, commitar a capa junto, push, e **o João
clicar em Deploy no app `manfac-site` do EasyPanel** — não no `manfac-login-system`. Confirmar
o build comparando o `Last-Modified` dos `/_next/static/chunks/*.js` de `https://manfac.com.br`.
Não há webhook: push sozinho não sobe nada.

O `dockerfile` da raiz já copia o diretório inteiro do `manfac-site`, então `content/` entra
na imagem **sem nenhuma alteração de build**.

## Decisões pendentes do João

| Pendência | Bloqueia | Recomendação |
|---|---|---|
| Autoria dos posts | JSON-LD `author`, assinatura | **"Equipe Manfac"** — não cria dependência de pessoa e não envelhece |
| Quem escreve e com que frequência | nada agora; define quando entra paginação e filtro | — |
| Origem das fotos | capa dos posts | **Fotos próprias de obra** — a CSP proíbe hotlink, e foto de banco já está indexada em mil sites |
| Posição de "Blog" no menu | `lib/content.ts` | **Entre Resultados e Contato** |
| Os 3 primeiros temas | o blog nascer com conteúdo em vez de nascer vazio | — |

Todas estão no mockup como campos de escolha, embaixo da seção correspondente.

## Fora de escopo, com o porquê

- **Arquivo por categoria** — página magra com menos de 6 posts na categoria.
- **Paginação** — desnecessária abaixo de 12 posts; mecanismo já decidido acima.
- **Índice de seções (sumário) no post** — só se justifica acima de ~1200 palavras; entra
  quando os posts passarem disso.
- **Busca no blog** — 6 posts se leem por inteiro mais rápido do que se busca.
- **RSS / newsletter** — não serve a indexação, que é o critério desta frente.
- **OG dinâmica com `next/og`** — candidata de fase 2, motivo acima.
- **Comentários** — moderação recorrente e superfície de spam, sem ganho de SEO.
