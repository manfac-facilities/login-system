# Redesign do site institucional Manfac — Spec

## Contexto

O site (`manfac-site/`) foi deployado rápido na sexta 2026-06-19 pra não perder prazo. É uma landing page de página única (Next.js App Router, Tailwind v4) com scroll e seções por âncora: Header, Hero, Stats, QuemSomos, Problema, Abordagem, Servicos, Case, Diferencial, Time, Contato, Footer.

Dois problemas a resolver:
1. **Parece feito com IA** — layout genérico (hero centralizado, cards com borda fina translúcida, labels uppercase tracking-wide repetidos em toda seção, números 01-05), zero fotografia, paleta dark navy + um acento (padrão extremamente comum em sites gerados por IA).
2. **UX abaixo do padrão de mercado** — concorrentes reais do setor são todos multi-página; o nosso é scroll único.

## Pesquisa de concorrentes

Analisados: innovent.eng.br, alamoengenharia.com.br, manserv.com.br, araujoabreu.com.br, grupobrasanitas.com.br (todos do setor de engenharia/facilities/manutenção predial). `sblok.com.br` foi descartado como referência de segmento (é locadora de geradores, não factibilities) — mantemos dele só a ideia de prova social por logo de cliente, não o conteúdo/segmento.

**Padrões confirmados:**
- Todos os 5 são sites multi-página com rotas próprias (não scroll único)
- "X anos de mercado" é a prova social #1 em 100% dos sites (15 a 100 anos) — não é nosso argumento; vamos usar o case do cliente farmacêutico (R$16bi/ano, 400+ unidades RJ) como prova social principal
- 3 dos 5 usam o mesmo template WordPress/Elementor genérico — diferenciação real é não parecer template
- Nenhum usa 3D/WebGL/animação de scroll sofisticada — oportunidade de diferenciação visual
- Boas práticas de performance a copiar: dimensões explícitas + lazy loading em imagens, evitar vídeo de fundo não comprimido, usar pipeline de otimização de imagem (`next/image` já cobre isso)

## Decisões de design

### 1. Arquitetura de informação — site multi-página

Converter de página única para rotas reais no App Router:

| Rota | Conteúdo |
|---|---|
| `/` (Home) | Hero (3D) + Stats + Problema (na íntegra, é uma seção curta) + versões resumidas de Quem Somos / Serviços (cada uma com link "saiba mais" pra página própria) + teaser do Case + CTA de contato |
| `/quem-somos` | QuemSomos (expandido) + Abordagem (5 passos) + Diferencial + Time |
| `/servicos` | Os 4 serviços, cada um com mais detalhe |
| `/resultados` | Case completo + Stats |
| `/contato` | CTA de contato dedicado |

Header: nav muda de links de âncora (`#secao`) pra rotas reais, com indicador de página ativa no estilo de anotação técnica (linha fina + label), e menu hambúrguer no mobile. Footer permanece global.

### 2. Hero — modelo 3D "blueprint que se materializa"

- Construído proceduralmente em código (Three.js + React Three Fiber + drei) — uma massa arquitetônica abstrata feita de volumes geométricos simples, sem modelo externo `.glb` (zero dependência de asset/licenciamento, peso mínimo)
- Estado inicial: wireframe/contorno (linhas finas, sem preenchimento) — visual de planta/blueprint
- Conforme o usuário rola a página pelo hero, o material interpola de wireframe para sólido (cores da marca) — storytelling "do projeto pra execução"
- Interativo: reage sutilmente à posição do mouse (desktop); no mobile, rotação automática leve ou resposta a touch, sem exigir giroscópio
- **Performance:** componente carregado via `next/dynamic` (`ssr: false`) + `Suspense`, montado só depois que o conteúdo principal do hero (texto + CTA) já pintou na tela — nunca bloqueia LCP. Versão mobile com menos polígonos/sem post-processing; se a medição de performance pós-implementação mostrar que ainda pesa demais no mobile, cai pra uma versão pré-renderizada (vídeo/imagem) só nesse breakpoint.

### 3. Identidade visual — tema claro + linguagem "blueprint"

O cliente achou o navy atual (`#0a1628`) escuro demais — e essa cor nem é a da marca: é inventada. O manual de identidade oficial (`material manfac/logos/Arquivos Logo/Manual de Uso Identidade Visual.pdf`) define:

| Nome | Hex | Uso proposto |
|---|---|---|
| Berkeley Blue | `#00345e` | Texto principal, headings, banda escura ocasional (footer/CTA) |
| Orange Pantone | `#f85e0b` | Acento (CTA, labels, números de destaque) — substitui o `#f05a28` aproximado |
| Yellow Jonquil | `#f7cb15` | Destaque pontual, uso esparso |
| Timberwolf | `#dadad8` | Fundo claro / divisórias |
| Slate gray | `#6e8894` | Texto secundário/muted, linhas de grid |
| Jet | `#333336` | Texto de corpo alternativo se preto puro for forte demais |

Mudança de tema: **fundo predominantemente claro** (branco / Timberwolf) em vez de dark navy. Isso resolve a reclamação do cliente E ajuda a sair do clichê "dark mode + um acento" que é ele mesmo um padrão genérico de site feito rápido/com IA.

Linguagem "blueprint" adaptada ao tema claro: grid sutil de linhas finas (Slate gray) sobre fundo claro — como papel de desenho técnico real —, labels de seção como anotação (linha + número) em Berkeley Blue ou Orange, layout assimétrico no lugar do padrão atual de cards centralizados com borda translúcida.

### 4. Tipografia

- Inter como já está, mas com mais peso e tracking mais fechado nos títulos (mudança sutil, sem troca de fonte)
- IBM Plex Mono só nas anotações/labels pequenos (reforça o caráter técnico sem mudar a leitura do corpo)
- Self-hosted via `next/font` (sem request de Google Fonts em runtime)

### 5. Fotografia

Não há fotos reais disponíveis ainda. V1 não depende de fotografia (peso visual fica com o 3D + identidade gráfica), mas o layout das páginas Quem Somos, Resultados e Time reserva slots de imagem dimensionados, prontos para receber fotos reais sem redesenho quando o cliente fornecer.

### 6. Performance

- Next.js App Router multi-página → code-splitting automático por rota (hoje tudo carrega de uma vez numa página só)
- Bundle do 3D isolado via dynamic import client-only, montagem adiada
- Fontes self-hosted via `next/font`
- `next/image` já em uso — manter dimensões explícitas e lazy loading
- Meta: Core Web Vitals (LCP/CLS/INP) não pode regredir em relação ao site estático atual mesmo com o 3D — medir após implementação e ajustar (reduzir polígonos, remover sombras) se necessário

## Fora de escopo / pendências

- **Logo do cliente farmacêutico:** usar como prova social (visto no sblok) depende de aprovação do cliente — não assumir, tratar depois
- **Fotografia real:** layout pronto para receber, mas não bloqueia esta entrega
- Formulário de contato com backend — `Contato` continua como CTA `mailto:`, sem mudança de funcionalidade
- Páginas institucionais extras vistas em concorrentes (ESG, certificações, blog) — não solicitadas, não entram nesta rodada
- DNS de `hub.manfac.com.br` — item conhecido, não relacionado a este site

## Stack/dependências novas

- `three`, `@react-three/fiber`, `@react-three/drei` para o modelo 3D
- Sem novas dependências de fonte além do que `next/font` já resolve com Google Fonts (Inter, IBM Plex Mono) embutidas no build
