# Spec — Site Manfac v03 (entrega final)

**Data:** 2026-07-14
**Contexto comercial:** entrega final do contrato do site (libera os R$ 1,5k restantes dos R$ 3k acordados). Origem: feedback do cliente José Guilherme, formalizado no relatório `manfac-site/Relatorio_Avaliacao_Site_Manfac.docx` (julho/2026), mais dois pedidos diretos do usuário (botão Início e fotos reais).
**Referência visual aprovada:** mockup em https://claude.ai/code/artifact/40fd1f09-00be-4e89-8b46-9e5ede917b13 (versão "mockup-v1", gerada logo após o feedback do cliente). Onde o mockup e o site atual divergirem em estilo, **o mockup manda**; os tokens de cor (`--ink`, `--orange`, etc.) e as fontes (Inter + IBM Plex Mono) continuam os mesmos.

## Escopo

Tudo do relatório (prioridades alta, média e baixa/SEO) + itens do usuário. Detalhado abaixo em 9 frentes.

### 1. Navegação — item "Início"

- `NAV_ITEMS` em `manfac-site/lib/content.ts` ganha `{ href: '/', label: 'Início' }` como primeiro item.
- Aparece no menu desktop, menu mobile e (se houver lista de links no footer) no footer.
- Estado ativo: "Início" só marca ativo em `pathname === '/'` (o `startsWith(item.href + '/')` do Header marcaria em toda rota — precisa de caso especial para `/`).
- Dropdown "Serviços" do Header passa a apontar para as rotas novas (`/servicos/...`) em vez de âncoras (`/servicos#...`).

### 2. Correção do Counter (indicadores zerados — ponto crítico do relatório)

Bug atual: `Counter.tsx` renderiza `0` no SSR e só anima até o valor final com JS + IntersectionObserver. JS lento/falho ou print rápido = "0+", "+R$0 mil", "0%" na tela.

Correção (inverter a lógica):
- SSR e estado inicial renderizam **o valor final** (`400+`, `+R$800 mil`...).
- Ao hidratar **e** entrar na viewport **e** sem `prefers-reduced-motion`, aí sim zera e anima até o valor final (enfeite progressivo).
- Sem JS, com JS lento, com reduced-motion, em qualquer cenário: valor final visível. É impossível existir `0` estático na tela.
- Vale para todos os usos: página Resultados, Stats da home e qualquer contador novo.

### 3. Home — nova estrutura (seção 7 do relatório, na ordem exata)

1. **Hero** — mantém o vídeo drone (`/media/hero.mp4`). Copy nova:
   - Eyebrow: "Engenharia · Manutenção · Obras corporativas"
   - H1: "Engenharia, manutenção predial e obras corporativas para operações que não podem parar."
   - Sub: "A Manfac atende empresas com múltiplas unidades, alto volume de demandas e necessidade de controle, padronização e visibilidade em campo — da manutenção recorrente às obras e reformas spot."
   - CTAs: "Falar com especialista" (→ /contato) e "Ver case de 400+ unidades" (→ /resultados)
2. **Provas rápidas** — os 4 STATS logo após a primeira dobra, banda escura (`--ink`) como no mockup, com Counter corrigido.
3. **Dores do cliente** — tabela dor → resposta (5 linhas, copy da tabela 2.2-B do relatório): muitos fornecedores / falta de padrão / baixa visibilidade / chamados recorrentes / dificuldade de cobrança.
4. **Como funciona na prática** — 5 passos em cards numerados (mapeamento inicial → plano operacional → execução em campo → gestão e comunicação → melhoria contínua), copy da seção 3.2-D do relatório. **Cada passo com ícone SVG customizado animado** (pedido do usuário).
5. **Soluções** — grid dos 4 serviços linkando para as páginas novas + bloco duplo "Contrato recorrente" (card escuro) vs. "Demandas spot" (card claro), copy da seção 4.3. **Cards de serviço mantêm os ícones SVG animados existentes; os dois cards recorrente/spot ganham ícone animado próprio** (pedido do usuário).
6. **Case teaser** — título "400+ unidades de um dos maiores varejistas farmacêuticos do Brasil, sob gestão Manfac." + foto + CTA "Ver como estruturamos essa operação" (→ /resultados).
7. **Diferenciais** — pills: equipe própria treinada / gestão ativa com responsável técnico / relatórios e evidências em campo / ponto focal único / capacidade de escala comprovada. **Cada pill/item com ícone animado** (pedido do usuário).

**Ícones animados (pedido do usuário):** seguir o padrão que o site já tem — SVGs customizados nas cores da marca com a animação `icon-float` (ou animação SVG sutil equivalente, ex. engrenagem girando devagar, linha de pulso), sempre desligados sob `prefers-reduced-motion` (regra já existe em `globals.css`). Nada de biblioteca externa de ícones/Lottie; tudo SVG inline como hoje.
8. **CTA final** — "Vamos entender sua operação?" + botão "Agendar conversa técnica" (→ /contato).

Componentes atuais da home (QuemSomosTeaser etc.) que não têm lugar nessa ordem saem da home (arquivos podem permanecer para uso futuro; nada de código morto importado).

### 4. Página Resultados

- Counters corrigidos (frente 2).
- Suavizar crítica a fornecedores: "7 anos com fornecedores sem padrão. Isso tinha que mudar." → "Uma operação fragmentada que precisava de estrutura — e ganhou." (ajustar frases vizinhas no mesmo tom factual; a menção neutra a "operação fragmentada" pode ficar).
- Dados identificáveis do cliente (R$16 bi, 1.600 lojas, varejo farmacêutico): **mantidos** — decisão do usuário; autorização será confirmada com o cliente por fora.

### 5. Contato — qualificação em 2 etapas → WhatsApp

- **Etapa 1:** 3 cards de caminho — "Manutenção recorrente" / "Obra ou reforma" / "Avaliação técnica".
- **Etapa 2:** formulário — Nome*, Empresa*, E-mail corporativo*, Telefone/WhatsApp*, Cargo (opcional), Localidade das unidades*, Nº de unidades (select, só no caminho recorrente), Resumo da demanda (textarea opcional).
- **Envio:** monta mensagem estruturada (mesmo formato do mockup) e abre `https://wa.me/<NUMERO>?text=...` em nova aba. Número em constante única (ex.: `WHATSAPP_COMERCIAL` em `lib/site.ts` ou `lib/content.ts`) com valor placeholder claro (`'5521999999999' // TODO: número comercial do cliente`) — troca em 1 linha quando o cliente passar.
- Labels sempre visíveis (não usar placeholder como label), validação inline, botão "Agendar conversa técnica", microcopy "Abre no seu WhatsApp · Resposta em até 1 dia útil · Prefere e-mail? contato@manfac.com.br".
- Client component; sem backend, sem coleta de dados no servidor (nada muda em LGPD — dado só transita pro WhatsApp do visitante).
- O componente CTA `Contato.tsx` (usado nas outras páginas) continua existindo, apontando pra /contato com copy executiva.

### 6. Quatro páginas de serviço + hub

Rotas novas: `/servicos/obras-e-reformas`, `/servicos/novas-construcoes`, `/servicos/manutencao-predial`, `/servicos/hvac`.

Template por página (dados centralizados em `lib/content.ts` ou `lib/servicos.ts`, uma page por rota):
- Hero: eyebrow "Serviços · <nome>" + headline específica (usar 8.3/8.4 do relatório para manutenção e obras) + CTA "Solicitar proposta técnica".
- Seções: para quem é / dores que resolve / escopo / como executamos / indicadores da operação (números reais) / contrato vs. spot (quando entra no mensal, quando vira proposta avulsa) / CTA final.
- Foto própria por página.
- Metadata (`title`, `description`, OpenGraph) por página; todas entram no `sitemap.ts`.

`/servicos` vira **hub**: hero atual + cards resumidos linkando para cada página. Âncoras antigas (`/servicos#obras-reformas` etc.) redirecionam para as rotas novas (redirects no `next.config.ts` não suportam `#hash` na origem — o hub manter os `id`s nas âncoras dos cards já resolve links antigos, já que `#hash` não chega ao servidor; validar comportamento e garantir que nenhum link interno continue usando âncora).

### 7. Copy global calibrada

Substituições em todo o site (grep por cada termo):
| Sai | Entra |
|---|---|
| Solicitar diagnóstico gratuito | Agendar conversa técnica (contato) / Falar com especialista (home/header) / Solicitar proposta técnica (serviços) |
| "qualquer escala de reforma" | "reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima" |
| "Zero intermediário" | "Ponto único de responsabilidade, com gestão técnica centralizada" |
| "sem surpresas no final do mês" / "nenhuma surpresa no final do mês" | "controle de cronograma, custos e comunicação recorrente para reduzir desvios e antecipar decisões" |
| "Zero chamado sem resposta" | "Todo chamado com registro, prazo e responsável definidos" |
| "sem subempreiteiros" | avaliar: manter só se factual; senão "equipe técnica própria com gestão centralizada" |

- Posicionamento institucional (8.1 do relatório) entra no Quem Somos (bloco de abertura) e como base da metadata description.
- Header CTA: "Fale com a gente" → "Falar com especialista".

### 8. Fotos reais de obra (gratuitas, alta resolução)

- Fonte: Unsplash/Pexels (licenças permitem uso comercial sem atribuição obrigatória; registrar URL de origem de cada foto num comentário ou `docs/` para rastreabilidade).
- Temas: canteiro/obra corporativa, técnico de manutenção em campo (uniforme/EPI), equipe em obra, HVAC/casa de máquinas, fachada comercial.
- Substituem as imagens genéricas atuais onde fizer sentido e ilustram as 4 páginas novas de serviço.
- Baixar em alta resolução, otimizar (dimensão máx. ~2000px, qualidade ajustada) e servir via `next/image` como as atuais em `public/media/`.

### 9. SEO/meta

- `sitemap.ts` atualizado com as 4 rotas novas.
- Metadata específica por página de serviço.
- JSON-LD existente no layout permanece; avaliar `Service` schema nas páginas de serviço (bônus, não bloqueante).

## Fora do escopo (fica pronto pra receber, não entra nesta entrega)

- Número real do WhatsApp comercial (placeholder em constante única).
- Prints de dashboards/relatórios reais, antes/depois, depoimentos, história/liderança da empresa, certificações (dependem de material do cliente).
- GA4 + banner de consentimento LGPD (decisão do usuário: os dois juntos, em momento futuro).
- Deploy: código pronto e pushed; redeploy manual no EasyPanel (painel → projeto manfac → app manfac-site → Deploy) como de costume.

## Critérios de aceite

1. `/resultados` e home nunca exibem indicador zerado — testável desabilitando JS: valores finais visíveis.
2. Menu tem "Início" como primeiro item em desktop e mobile; marca ativo só na home.
3. Home segue a ordem exata da seção 7 do relatório.
4. Formulário de contato: 3 caminhos, campos conforme frente 5, gera URL `wa.me` correta com mensagem estruturada e URL-encoded.
5. As 4 rotas de serviço respondem 200, têm metadata própria e constam no sitemap.
6. `grep -ri "diagnóstico gratuito" manfac-site/` (e demais termos da frente 7) não retorna nada em código de produção.
7. Nenhuma referência a "Sofia", segredos ou dados de outros sistemas do monorepo vaza pro site.
8. Build de produção (`npm run build`) passa sem erros; páginas visualmente conferidas contra o mockup.
