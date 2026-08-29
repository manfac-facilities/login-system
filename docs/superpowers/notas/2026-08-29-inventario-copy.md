# Inventário de copy — site institucional manfac.com.br

**Data:** 2026-08-29
**Escopo:** `manfac-site/` (app, components, lib). Ignora `node_modules`, `.next` e o resto do monorepo.
**Para que serve:** base para (1) o ajuste de copy que o cliente está cobrando e (2) uma eventual tradução PT/EN/ES.

## Como ler este documento

- Organizado **por rota**, na ordem em que o visitante lê a página.
- Todos os caminhos são relativos a `manfac-site/`.
- **Nenhum texto foi truncado.** O limite de 200 caracteres era permitido, mas todo texto do site cabe inteiro e quem for reescrever precisa do literal completo.
- `↵` marca uma quebra de linha forçada no JSX (`<br />`) — ela é decisão de layout e some se o texto for reescrito.
- `↺` marca texto **reaproveitado** de outra rota: já foi listado antes, aparece de novo para o visitante, mas é **uma única string** no código. Não conta duas vezes no resumo quantitativo.
- Coluna **grupo**: `(a)` copy centralizada em `lib/content.ts` / `lib/servicos.ts` · `(b)` hardcoded fora desses dois arquivos · `(c)` metadados de SEO.

---

# GLOBAL — aparece nas 8 rotas

## Metadados do layout raiz — `app/layout.tsx`

Estes valores valem para **todas** as rotas, exceto onde a página sobrescreve `title`/`description`.

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| `<title>` padrão | app/layout.tsx:19 | SEO | (c) | Manfac Engenharia — Obras, Reformas e Manutenção Predial para Grandes Operações |
| meta description padrão | app/layout.tsx:21 | SEO | (c) | A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras, reformas e manutenção predial para grandes operações, com visibilidade e controle em tempo real. |
| keyword 1 | app/layout.tsx:23 | SEO | (c) | manutenção predial |
| keyword 2 | app/layout.tsx:24 | SEO | (c) | facilities management |
| keyword 3 | app/layout.tsx:25 | SEO | (c) | obras corporativas |
| keyword 4 | app/layout.tsx:26 | SEO | (c) | reformas comerciais |
| keyword 5 | app/layout.tsx:27 | SEO | (c) | manutenção predial preventiva |
| keyword 6 | app/layout.tsx:28 | SEO | (c) | climatização HVAC |
| keyword 7 | app/layout.tsx:29 | SEO | (c) | engenharia predial Rio de Janeiro |
| og:title | app/layout.tsx:32 | SEO | (c) | Manfac Engenharia — Obras, Reformas e Manutenção Predial para Grandes Operações |
| og:description | app/layout.tsx:34 | SEO | (c) | Gestão e execução de obras, reformas e manutenção predial para grandes operações, com visibilidade e controle em tempo real. |
| og:siteName | app/layout.tsx:36 | SEO | (c) | Manfac Engenharia |
| og:image alt | app/layout.tsx:44 | SEO | (c) | Manfac Engenharia |
| twitter:title | app/layout.tsx:50 | SEO | (c) | Manfac Engenharia |
| twitter:description | app/layout.tsx:52 | SEO | (c) | Gestão e execução de obras, reformas e manutenção predial para grandes operações. |
| JSON-LD `name` | app/layout.tsx:60 | SEO | (c) | Manfac Engenharia |
| JSON-LD `description` | app/layout.tsx:64 | SEO | (c) | Empresa de Engenharia especializada na gestão e execução de obras, reformas e manutenção predial para grandes operações. |
| JSON-LD `email` | app/layout.tsx:71 | SEO | (c) | contato@manfac.com.br |

## Header — `components/Header.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Logo (alt) | components/Header.tsx:50 | alt | (b) | Manfac Engenharia |
| Menu | lib/content.ts:4 | menu | (a) | Início |
| Menu | lib/content.ts:5 | menu | (a) | Quem somos |
| Menu | lib/content.ts:6 | menu | (a) | Serviços |
| Menu | lib/content.ts:7 | menu | (a) | Resultados |
| Menu | lib/content.ts:8 | menu | (a) | Contato |
| Dropdown Serviços | components/Header.tsx:13 | menu | (b) | Obras e Reformas Corporativas |
| Dropdown Serviços | components/Header.tsx:14 | menu | (b) | Novas Construções |
| Dropdown Serviços | components/Header.tsx:15 | menu | (b) | Manutenção Predial |
| Dropdown Serviços | components/Header.tsx:16 | menu | (b) | Sistemas de Climatização (HVAC) |
| CTA do header | components/Header.tsx:139 | botão | (b) | Solicitar atendimento |
| Botão do menu mobile (aria-label) | components/Header.tsx:144 | acessibilidade | (b) | Abrir menu |

## Botão flutuante de WhatsApp — `components/WhatsAppFloat.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| aria-label | components/WhatsAppFloat.tsx:20 | acessibilidade | (b) | Falar no WhatsApp |
| Rótulo que expande no hover | components/WhatsAppFloat.tsx:27 | botão | (b) | Falar no WhatsApp |

## Rodapé — `components/Footer.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Logo (alt) | components/Footer.tsx:41 | alt | (b) | Manfac Engenharia |
| Tagline | components/Footer.tsx:10 | corpo | (b) | Engenharia, manutenção e facilities para operações que não podem parar. |
| CTA da marca | components/Footer.tsx:53 | botão | (b) | Falar agora |
| Título da coluna | components/Footer.tsx:59 | subtítulo | (b) | Serviços |
| Link | components/Footer.tsx:61 | botão | (b) | Todos os serviços |
| Lista de serviços (4 itens) | lib/servicos.ts:24,50,78,105 | menu | (a) | ↺ ver rota `/servicos` (campo `nome`) |
| Título da coluna | components/Footer.tsx:74 | subtítulo | (b) | Institucional |
| Link institucional | components/Footer.tsx:14 | menu | (b) | Início |
| Link institucional | components/Footer.tsx:15 | menu | (b) | Quem somos |
| Link institucional | components/Footer.tsx:16 | menu | (b) | Resultados |
| Link institucional | components/Footer.tsx:17 | menu | (b) | Contato |
| Título da coluna | components/Footer.tsx:84 | subtítulo | (b) | Contato |
| Telefone exibido | lib/whatsapp.ts:9 | corpo | (b) | (21) 98428-0058 |
| E-mail | components/Footer.tsx:94 | corpo | (b) | contato@manfac.com.br |
| Endereço | components/Footer.tsx:11 | corpo | (b) | Rio de Janeiro · RJ |
| Copyright | components/Footer.tsx:101 | corpo | (b) | © {ano corrente} Manfac Engenharia. Todos os direitos reservados. |
| Localização | components/Footer.tsx:102 | corpo | (b) | Rio de Janeiro · Brasil |

## Mensagem gerada para o WhatsApp — `lib/whatsapp.ts`

Texto que o visitante lê já dentro do WhatsApp, montado pelos CTAs e pelo formulário.

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| CTA direto (todos os botões de WhatsApp) | lib/whatsapp.ts:58 | corpo | (b) | Olá! Vim pelo site da Manfac ({origem}) e gostaria de solicitar atendimento. |
| Handoff do formulário — abertura | lib/whatsapp.ts:33 | corpo | (b) | Olá! Vim pelo site da Manfac. |
| Handoff — rótulo | lib/whatsapp.ts:34 | corpo | (b) | Tipo de demanda: |
| Handoff — rótulo | lib/whatsapp.ts:35 | corpo | (b) | Nome: |
| Handoff — rótulo | lib/whatsapp.ts:39 | corpo | (b) | Empresa: |
| Handoff — rótulo | lib/whatsapp.ts:40 | corpo | (b) | E-mail: |
| Handoff — rótulo | lib/whatsapp.ts:41 | corpo | (b) | Telefone: |
| Handoff — rótulo | lib/whatsapp.ts:42 | corpo | (b) | Localidade: |
| Handoff — rótulo | lib/whatsapp.ts:43 | corpo | (b) | Unidades: |
| Handoff — rótulo | lib/whatsapp.ts:44 | corpo | (b) | Resumo: |

---

# ROTA `/` — Home

**SEO:** `app/page.tsx` define **só** o canonical (linhas 15–19). Título e description são os do layout raiz (ver bloco GLOBAL).

## 1. Hero — `components/Hero.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/Hero.tsx:23 | subtítulo | (b) | Engenharia · Manutenção · Obras corporativas |
| H1 | components/Hero.tsx:29-31 | título | (b) | Engenharia, manutenção predial e obras corporativas ↵ para operações que não podem parar. |
| Subtítulo | components/Hero.tsx:37 | corpo | (b) | A Manfac atende empresas com múltiplas unidades, alto volume de demandas e necessidade de controle, padronização e visibilidade em campo — da manutenção recorrente às obras e reformas spot. |
| CTA primário | components/Hero.tsx:50 | botão | (b) | Solicitar atendimento |
| CTA secundário | components/Hero.tsx:56 | botão | (b) | Ver case de 400+ unidades |

## 2. Faixa de números — `components/Stats.tsx` + `lib/content.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| aria-label da seção | components/Stats.tsx:7 | acessibilidade | (b) | Manfac em números |
| Número 1 | lib/content.ts:12 | título | (a) | 400+ |
| Legenda 1 | lib/content.ts:12 | corpo | (a) | unidades sob gestão no RJ |
| Número 2 | lib/content.ts:13 | título | (a) | +1.000 |
| Legenda 2 | lib/content.ts:13 | corpo | (a) | ordens de serviço/mês |
| Número 3 | lib/content.ts:14 | título | (a) | 100% |
| Legenda 3 | lib/content.ts:14 | corpo | (a) | das demandas concluídas no mês |
| Número 4 | lib/content.ts:15 | título | (a) | +R$800 mil |
| Legenda 4 | lib/content.ts:15 | corpo | (a) | em obras e reformas/mês |

## 3. O problema que resolvemos — `components/home/Dores.tsx` + `lib/content.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/home/Dores.tsx:10 | subtítulo | (b) | O problema que resolvemos |
| H2 | components/home/Dores.tsx:13-14 | título | (b) | Para quem gerencia muitas unidades, cada fornecedor desalinhado vira custo, ruído e perda de controle. |
| Cabeçalho da tabela | components/home/Dores.tsx:22 | subtítulo | (b) | Sua dor hoje |
| Cabeçalho da tabela | components/home/Dores.tsx:25 | subtítulo | (b) | Como a Manfac responde |
| Dor 1 | lib/content.ts:27 | corpo | (a) | Muitos fornecedores |
| Resposta 1 | lib/content.ts:27 | corpo | (a) | Ponto único de responsabilidade e comunicação. |
| Dor 2 | lib/content.ts:28 | corpo | (a) | Falta de padrão |
| Resposta 2 | lib/content.ts:28 | corpo | (a) | Equipe própria treinada, rotina técnica e supervisão operacional. |
| Dor 3 | lib/content.ts:29 | corpo | (a) | Baixa visibilidade |
| Resposta 3 | lib/content.ts:29 | corpo | (a) | Relatórios, cronogramas, status recorrente e evidências em campo. |
| Dor 4 | lib/content.ts:30 | corpo | (a) | Chamados recorrentes |
| Resposta 4 | lib/content.ts:30 | corpo | (a) | Análise de causa, priorização e plano de redução de reincidência. |
| Dor 5 | lib/content.ts:31 | corpo | (a) | Dificuldade de cobrança |
| Resposta 5 | lib/content.ts:31 | corpo | (a) | Gestão ativa com responsável técnico e acompanhamento de ponta a ponta. |

## 4. Como funciona na prática — `components/home/ComoFunciona.tsx` + `lib/content.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/home/ComoFunciona.tsx:52 | subtítulo | (b) | Como funciona na prática |
| H2 | components/home/ComoFunciona.tsx:55 | título | (b) | A operação Manfac, do diagnóstico à melhoria contínua. |
| Passo 01 — número | lib/content.ts:36 | título | (a) | 01 |
| Passo 01 — título | lib/content.ts:36 | subtítulo | (a) | Mapeamento inicial |
| Passo 01 — descrição | lib/content.ts:36 | corpo | (a) | Unidades, histórico, volume, SLA, criticidade e prioridades. |
| Passo 02 — número | lib/content.ts:37 | título | (a) | 02 |
| Passo 02 — título | lib/content.ts:37 | subtítulo | (a) | Plano operacional |
| Passo 02 — descrição | lib/content.ts:37 | corpo | (a) | Equipe, rotina, fluxo de chamados, relatórios e indicadores. |
| Passo 03 — número | lib/content.ts:38 | título | (a) | 03 |
| Passo 03 — título | lib/content.ts:38 | subtítulo | (a) | Execução em campo |
| Passo 03 — descrição | lib/content.ts:38 | corpo | (a) | Técnicos, supervisão, materiais, fotos, evidências e qualidade. |
| Passo 04 — número | lib/content.ts:39 | título | (a) | 04 |
| Passo 04 — título | lib/content.ts:39 | subtítulo | (a) | Gestão e comunicação |
| Passo 04 — descrição | lib/content.ts:39 | corpo | (a) | Status recorrente, cronograma, dashboard, reuniões e pendências. |
| Passo 05 — número | lib/content.ts:40 | título | (a) | 05 |
| Passo 05 — título | lib/content.ts:40 | subtítulo | (a) | Melhoria contínua |
| Passo 05 — descrição | lib/content.ts:40 | corpo | (a) | Recorrências, redução de emergências e plano de evolução. |

## 5. Serviços (teaser) — `components/home/ServicosTeaser.tsx`

Todo o conteúdo desta seção é **hardcoded no componente**, não vem de `lib/servicos.ts`.

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/home/ServicosTeaser.tsx:158 | subtítulo | (b) | Serviços |
| H2 | components/home/ServicosTeaser.tsx:161 | título | (b) | Da manutenção recorrente às obras spot. Um único ponto de responsabilidade. |
| Card 1 — título | components/home/ServicosTeaser.tsx:124 | subtítulo | (b) | Obras e Reformas Corporativas |
| Card 1 — descrição | components/home/ServicosTeaser.tsx:126 | corpo | (b) | Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar sua operação. |
| Card 2 — título | components/home/ServicosTeaser.tsx:131 | subtítulo | (b) | Novas Construções |
| Card 2 — descrição | components/home/ServicosTeaser.tsx:133 | corpo | (b) | Do projeto à entrega das chaves com cronograma real, custo sob controle e comunicação recorrente em cada etapa. |
| Card 3 — título | components/home/ServicosTeaser.tsx:138 | subtítulo | (b) | Manutenção Predial Preventiva e Corretiva |
| Card 3 — descrição | components/home/ServicosTeaser.tsx:140 | corpo | (b) | Rotinas preventivas que eliminam emergências e mantêm seu prédio funcionando sem interrupções imprevistas. |
| Card 4 — título | components/home/ServicosTeaser.tsx:145 | subtítulo | (b) | Sistemas de Climatização (HVAC) |
| Card 4 — descrição | components/home/ServicosTeaser.tsx:147 | corpo | (b) | Climatização funcionando, energia dentro do orçamento e manutenção preventiva com técnicos especializados. |
| Botão de cada card (×4) | components/home/ServicosTeaser.tsx:184 | botão | (b) | Saiba mais |
| Link final | components/home/ServicosTeaser.tsx:200 | botão | (b) | Ver todos os serviços → |

## 6. Contrato recorrente vs. demanda spot — `components/home/RecorrenteSpot.tsx` + `lib/content.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Card recorrente — eyebrow | lib/content.ts:46 | subtítulo | (a) | Contrato recorrente |
| Card recorrente — título | lib/content.ts:47 | título | (a) | Sua operação, sob gestão contínua |
| Card recorrente — item 1 | lib/content.ts:49 | corpo | (a) | Manutenção preventiva, corretiva e emergencial |
| Card recorrente — item 2 | lib/content.ts:50 | corpo | (a) | SLA, equipe dedicada, rotina de chamados e relatórios |
| Card recorrente — item 3 | lib/content.ts:51 | corpo | (a) | Gestão mensal, redução de emergências e padronização |
| Card spot — eyebrow | lib/content.ts:55 | subtítulo | (a) | Demandas spot |
| Card spot — título | lib/content.ts:56 | título | (a) | Projetos pontuais, entrega técnica |
| Card spot — item 1 | lib/content.ts:58 | corpo | (a) | Reformas, adequações e obras pontuais |
| Card spot — item 2 | lib/content.ts:59 | corpo | (a) | Escopo fechado, cronograma e orçamento definidos |
| Card spot — item 3 | lib/content.ts:60 | corpo | (a) | Expansões, retrofit, obras em loja e melhorias estruturais |

## 7. Case (teaser) — `components/home/CaseTeaser.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Selo | components/home/CaseTeaser.tsx:62 | subtítulo | (b) | CASE DE SUCESSO |
| H2 | components/home/CaseTeaser.tsx:67 | título | (b) | 400+ unidades de um dos maiores varejistas farmacêuticos do Brasil, sob gestão Manfac. |
| Parágrafo 1 | components/home/CaseTeaser.tsx:72-75 | corpo | (b) | Como a Manfac reestruturou a engenharia de manutenção de mais de **400 unidades** de um dos maiores varejistas farmacêuticos do Brasil — R$ 16 bi/ano, **1.600+ lojas** no país. |
| Parágrafo 2 | components/home/CaseTeaser.tsx:80-81 | corpo | (b) | Uma operação fragmentada transformada em referência: +1.000 OS/mês com 100% das demandas concluídas mensalmente. |
| Foto (alt) | components/home/CaseTeaser.tsx:89 | alt | (b) | Equipe Manfac em operação |
| Métrica 1 — valor | components/home/CaseTeaser.tsx:7 | título | (b) | +1.000 |
| Métrica 1 — legenda | components/home/CaseTeaser.tsx:8 | corpo | (b) | ordens de serviço por mês |
| Métrica 2 — valor | components/home/CaseTeaser.tsx:19 | título | (b) | 100% |
| Métrica 2 — legenda | components/home/CaseTeaser.tsx:20 | corpo | (b) | das demandas concluídas mensalmente |
| Métrica 3 — valor | components/home/CaseTeaser.tsx:29 | título | (b) | 400+ |
| Métrica 3 — legenda | components/home/CaseTeaser.tsx:30 | corpo | (b) | unidades sob gestão da Manfac no RJ |
| Métrica 4 — valor | components/home/CaseTeaser.tsx:41 | título | (b) | +R$800 mil |
| Métrica 4 — legenda | components/home/CaseTeaser.tsx:42 | corpo | (b) | em obras e reformas por mês |
| CTA | components/home/CaseTeaser.tsx:120 | botão | (b) | Ver como estruturamos essa operação → |

## 8. Por que a Manfac — `components/home/Diferenciais.tsx` + `lib/content.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/home/Diferenciais.tsx:40 | subtítulo | (b) | Por que a Manfac |
| H2 | components/home/Diferenciais.tsx:43 | título | (b) | Equipe própria. Ponto único de responsabilidade. |
| Pílula 1 | lib/content.ts:67 | corpo | (a) | Equipe própria treinada |
| Pílula 2 | lib/content.ts:68 | corpo | (a) | Gestão ativa com responsável técnico |
| Pílula 3 | lib/content.ts:69 | corpo | (a) | Relatórios e evidências em campo |
| Pílula 4 | lib/content.ts:70 | corpo | (a) | Ponto focal único |
| Pílula 5 | lib/content.ts:71 | corpo | (a) | Capacidade de escala comprovada |

## 9. CTA final — `components/Contato.tsx`

Bloco reaproveitado em `/`, `/quem-somos`, `/servicos`, `/servicos/[slug]` e `/resultados`.

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Selo | components/Contato.tsx:9 | subtítulo | (b) | ENTRE EM CONTATO |
| H2 | components/Contato.tsx:14-16 | título | (b) | Vamos entender ↵ sua operação? |
| Parágrafo | components/Contato.tsx:21-22 | corpo | (b) | Conte como funciona sua operação hoje — unidades, volume de demandas e principais dores. Retornamos com uma leitura técnica. |
| CTA | components/Contato.tsx:30 | botão | (b) | AGENDAR CONVERSA TÉCNICA |

---

# ROTA `/quem-somos`

## SEO — `app/quem-somos/page.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| `<title>` | app/quem-somos/page.tsx:13 | SEO | (c) | Quem somos — Manfac Engenharia |
| meta description | app/quem-somos/page.tsx:15 | SEO | (c) | A Manfac é uma empresa de Engenharia especializada na gestão e execução de obras, reformas e manutenção predial para grandes operações. |

## 1. Hero + Missão — `components/QuemSomos.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Foto do hero (alt) | components/QuemSomos.tsx:15 | alt | (b) | Grande obra de engenharia Manfac |
| Eyebrow | components/QuemSomos.tsx:30 | subtítulo | (b) | Quem somos |
| H1 | components/QuemSomos.tsx:35-37 | título | (b) | Engenharia que vai ↵ além da obra. |
| Subtítulo | components/QuemSomos.tsx:42 | corpo | (b) | Gestão integrada, execução técnica e visibilidade contínua para operações de grande escala. |
| Rótulo da seção | components/QuemSomos.tsx:50 | subtítulo | (b) | Nossa missão |
| H2 | components/QuemSomos.tsx:54-55 | título | (b) | Especialistas na gestão e execução de obras, reformas e manutenção predial para grandes operações. |
| Parágrafo 1 | components/QuemSomos.tsx:58-61 | corpo | (b) | A Manfac é uma empresa de engenharia especializada em manutenção predial, obras e reformas corporativas para grandes operações. Atuamos com equipe própria, gestão ativa e visibilidade em campo para empresas que precisam de previsibilidade, padrão técnico e resposta rápida em múltiplas unidades. |
| Parágrafo 2 | components/QuemSomos.tsx:64-66 | corpo | (b) | Enquanto o mercado divide engenharia em contratos isolados, a Manfac entrega um modelo único: do diagnóstico à conclusão, com um time que conhece cada detalhe da sua demanda. |
| Parágrafo 3 | components/QuemSomos.tsx:69-70 | corpo | (b) | Nosso compromisso é que cada cliente tenha mais controle, mais clareza e mais confiança na execução — com responsabilidade total do início ao fim. |
| Pilar 1 — título | lib/content.ts:76 | subtítulo | (a) | Gestão ativa, não reativa |
| Pilar 1 — descrição | lib/content.ts:78 | corpo | (a) | Cada obra e chamado fazem parte de um plano maior. Acompanhamos de perto, ajustamos quando necessário e respondemos por tudo. |
| Pilar 2 — título | lib/content.ts:81 | subtítulo | (a) | Você sabe o que acontece antes de precisar perguntar |
| Pilar 2 — descrição | lib/content.ts:83 | corpo | (a) | Relatórios claros, cronogramas atualizados e comunicação recorrente — para reduzir desvios e antecipar decisões. |

## 2. Nossa abordagem — `components/Abordagem.tsx` + `lib/content.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Rótulo da seção | components/Abordagem.tsx:8 | subtítulo | (b) | Nossa abordagem |
| Foto (alt) | components/Abordagem.tsx:16 | alt | (b) | Equipe Manfac planejando execução de obra |
| H2 | components/Abordagem.tsx:27 | título | (b) | Do diagnóstico à entrega — ↵ sem buracos no meio do caminho. |
| Parágrafo | components/Abordagem.tsx:30-31 | corpo | (b) | Cada etapa tem dono, prazo e responsável. Você acompanha tudo do início ao fim, com controle de cronograma, custos e comunicação recorrente. |
| Passo 01 — número | lib/content.ts:88 | título | (a) | 01 |
| Passo 01 — título | lib/content.ts:88 | subtítulo | (a) | Diagnóstico e priorização |
| Passo 02 — número | lib/content.ts:89 | título | (a) | 02 |
| Passo 02 — título | lib/content.ts:89 | subtítulo | (a) | Estruturação da operação |
| Passo 03 — número | lib/content.ts:90 | título | (a) | 03 |
| Passo 03 — título | lib/content.ts:90 | subtítulo | (a) | Execução com alto padrão técnico |
| Passo 04 — número | lib/content.ts:91 | título | (a) | 04 |
| Passo 04 — título | lib/content.ts:91 | subtítulo | (a) | Comunicação e visibilidade contínua |
| Passo 05 — número | lib/content.ts:92 | título | (a) | 05 |
| Passo 05 — título | lib/content.ts:92 | subtítulo | (a) | Evolução constante da operação |
| Banner 1 | lib/content.ts:95 | corpo | (a) | Simples na execução |
| Banner 2 | lib/content.ts:95 | corpo | (a) | Forte na gestão |
| Banner 3 | lib/content.ts:95 | corpo | (a) | Consistente no resultado |

## 3. Diferenciais — `components/Diferencial.tsx` + `lib/content.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Rótulo da seção | components/Diferencial.tsx:53 | subtítulo | (b) | Diferenciais |
| H2 | components/Diferencial.tsx:56 | título | (b) | Por que gestores de grandes operações escolhem a Manfac. |
| Card 1 — título | lib/content.ts:128 | subtítulo | (a) | Gestão ativa e estruturada |
| Card 1 — descrição | components/Diferencial.tsx:44 | corpo | (b) | Não deixamos a operação rodar sozinha. Acompanhamos, ajustamos e garantimos o resultado. |
| Card 2 — título | lib/content.ts:129 | subtítulo | (a) | Transparência total |
| Card 2 — descrição | components/Diferencial.tsx:45 | corpo | (b) | Nada fica escondido. Prazos, custos e andamento são reportados com clareza e recorrência. |
| Card 3 — título | lib/content.ts:130 | subtítulo | (a) | Comunicação clara e recorrente |
| Card 3 — descrição | components/Diferencial.tsx:46 | corpo | (b) | Canal direto com o responsável técnico em cada etapa — sem ruído, com comunicação recorrente sobre cronograma e custos. |
| Card 4 — título | lib/content.ts:131 | subtítulo | (a) | Uso de tecnologia e dados |
| Card 4 — descrição | components/Diferencial.tsx:47 | corpo | (b) | Dados e sistemas para tomar decisões mais rápidas e com menos erros no campo. |
| Card 5 — título | lib/content.ts:132 | subtítulo | (a) | Proatividade na resolução de problemas |
| Card 5 — descrição | components/Diferencial.tsx:48 | corpo | (b) | Antecipamos problemas antes que virem crise. Agimos, não reagimos. |
| Citação | components/Diferencial.tsx:81 | corpo | (b) | "Não escondemos problemas. Assumimos, tratamos e evoluímos continuamente." |

## 4. Nossa cultura — `components/Time.tsx` + `lib/content.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Rótulo da seção | components/Time.tsx:8 | subtítulo | (b) | Nossa cultura |
| H2 | components/Time.tsx:14 | título | (b) | Uma equipe que trata sua operação como se fosse dela. |
| Parágrafo | components/Time.tsx:17-19 | corpo | (b) | A Manfac é formada por profissionais que entendem que resultado não é discurso — é consistência ao longo do tempo. Proximidade com o cliente e comunicação direta em cada etapa da operação. |
| Eyebrow da lista | components/Time.tsx:26 | subtítulo | (b) | Impacto que geramos |
| Impacto 1 | lib/content.ts:136 | corpo | (a) | Prazo e custo sob controle, com comunicação recorrente |
| Impacto 2 | lib/content.ts:137 | corpo | (a) | Todo chamado com registro, prazo e responsável definidos |
| Impacto 3 | lib/content.ts:138 | corpo | (a) | Visibilidade sem precisar pedir |
| Impacto 4 | lib/content.ts:139 | corpo | (a) | Menos emergências, mais planejamento |
| Impacto 5 | lib/content.ts:140 | corpo | (a) | Decisões baseadas em dados reais |
| Foto (alt) | components/Time.tsx:50 | alt | (b) | Equipe Manfac em campo |
| Card sobre a foto — eyebrow | components/Time.tsx:57 | subtítulo | (b) | Manfac em campo |
| Card sobre a foto — frase | components/Time.tsx:60 | corpo | (b) | Presença ativa. Comunicação direta. Entrega garantida. |

## 5. CTA final

↺ `components/Contato.tsx` — ver rota `/`.

---

# ROTA `/servicos`

## SEO — `app/servicos/page.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| `<title>` | app/servicos/page.tsx:9 | SEO | (c) | Serviços — Manfac Engenharia |
| meta description | app/servicos/page.tsx:11 | SEO | (c) | Obras e reformas corporativas, novas construções, manutenção predial preventiva e corretiva e sistemas de climatização (HVAC) — tudo com equipe técnica própria. |

## 1. Hero — `components/Servicos.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Foto (alt) | components/Servicos.tsx:20 | alt | (b) | Skyline urbano com guindastes de construção |
| Eyebrow | components/Servicos.tsx:30 | subtítulo | (b) | Serviços |
| H1 | components/Servicos.tsx:33-35 | título | (b) | Tudo que sua infraestrutura precisa. ↵ Uma equipe. Um único ponto de responsabilidade. |
| Subtítulo | components/Servicos.tsx:38-39 | corpo | (b) | Obras, reformas, novas construções, manutenção predial e climatização — com equipe técnica própria e responsabilidade total do início ao fim. |
| Chip 1 | lib/servicos.ts:24 | botão | (a) | Obras e Reformas Corporativas |
| Chip 2 | lib/servicos.ts:50 | botão | (a) | Novas Construções |
| Chip 3 | lib/servicos.ts:78 | botão | (a) | Manutenção Predial Preventiva e Corretiva |
| Chip 4 | lib/servicos.ts:105 | botão | (a) | Sistemas de Climatização (HVAC) |

## 2. Cards de resumo — `components/Servicos.tsx` + `lib/servicos.ts`

O título de cada card é o mesmo `nome` dos chips acima (↺).

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Card 1 — resumo | lib/servicos.ts:26 | corpo | (a) | Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar a operação do cliente. |
| Card 2 — resumo | lib/servicos.ts:52 | corpo | (a) | Gestão completa de novas construções: do planejamento à entrega, com equipe técnica própria em campo, cronograma real e comunicação recorrente. |
| Card 3 — resumo | lib/servicos.ts:80 | corpo | (a) | Menos emergências, mais previsibilidade — equipe técnica própria, rotina de chamados e relatório mensal de cada demanda. |
| Card 4 — resumo | lib/servicos.ts:107 | corpo | (a) | Instalação, manutenção e gestão de sistemas HVAC com plano preventivo dedicado e técnicos especializados. |
| Link de cada card (×4) | components/Servicos.tsx:78 | botão | (b) | Conhecer o serviço |

## 3. CTA final

↺ `components/Contato.tsx` — ver rota `/`.

---

# ROTA `/servicos/[slug]` — template

As 4 subpáginas usam o mesmo template (`components/ServicePage.tsx`). Os rótulos abaixo são fixos; o conteúdo variável vem de `lib/servicos.ts` e está listado logo depois, um slug por bloco.

## Rótulos fixos do template — `components/ServicePage.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow do hero (prefixo) | components/ServicePage.tsx:35 | subtítulo | (b) | Serviços · {nome do serviço} |
| CTA do hero | components/ServicePage.tsx:48 | botão | (b) | Solicitar proposta técnica |
| Rótulo | components/ServicePage.tsx:59 | subtítulo | (b) | Para quem é |
| Rótulo | components/ServicePage.tsx:61 | subtítulo | (b) | Dores que resolve |
| Rótulo | components/ServicePage.tsx:65 | subtítulo | (b) | Escopo |
| Rótulo | components/ServicePage.tsx:84 | subtítulo | (b) | Como executamos |
| Rótulo | components/ServicePage.tsx:115 | subtítulo | (b) | Como contratar |
| Rótulo do card escuro | components/ServicePage.tsx:121 | subtítulo | (b) | Contrato recorrente |
| Rótulo do card claro | components/ServicePage.tsx:127 | subtítulo | (b) | Demanda spot |
| CTA final | components/Contato.tsx | — | (b) | ↺ ver rota `/` |

## `/servicos/obras-e-reformas`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| `<title>` | lib/servicos.ts:45 | SEO | (c) | Obras e Reformas Corporativas — Manfac Engenharia |
| meta description | lib/servicos.ts:46 | SEO | (c) | Obras e reformas corporativas com escopo fechado, cronograma, equipe própria e acompanhamento de ponta a ponta, sem paralisar sua operação. |
| Nome (eyebrow) | lib/servicos.ts:24 | subtítulo | (a) | ↺ Obras e Reformas Corporativas |
| H1 | lib/servicos.ts:25 | título | (a) | Obras e reformas corporativas com escopo, cronograma, equipe própria e acompanhamento de ponta a ponta. |
| Subtítulo do hero | lib/servicos.ts:26 | corpo | (a) | ↺ ver `/servicos` (campo `sub`) |
| Foto (alt) | lib/servicos.ts:44 | alt | (a) | Obra corporativa em execução com estrutura e andaimes |
| Para quem é | lib/servicos.ts:27 | corpo | (a) | Empresas com unidades corporativas, redes de varejo, escritórios, galpões e hospitais que precisam reformar, adequar ou expandir sem interromper a operação. |
| Dores que resolve | lib/servicos.ts:28 | corpo | (a) | Obra atrasada sem explicação · custo que estoura sem aviso · operação paralisada durante a execução · vários responsáveis e nenhum dono do resultado. |
| Escopo 1 | lib/servicos.ts:30 | corpo | (a) | Reformas de layout, fachada e adequação civil |
| Escopo 2 | lib/servicos.ts:31 | corpo | (a) | Expansão de unidades e retrofit predial |
| Escopo 3 | lib/servicos.ts:32 | corpo | (a) | Cumprimento de normas técnicas e exigências legais |
| Escopo 4 | lib/servicos.ts:33 | corpo | (a) | Relatório semanal de andamento — sem precisar pedir |
| Escopo 5 | lib/servicos.ts:34 | corpo | (a) | Um ponto de contato responsável do início à entrega |
| Como executamos | lib/servicos.ts:36 | corpo | (a) | Planejamento com escopo fechado, cronograma real e orçamento definido; execução com equipe própria e supervisão técnica; comunicação recorrente com registro fotográfico até a entrega. |
| Indicador 1 — valor | lib/servicos.ts:38 | título | (a) | +R$800 mil |
| Indicador 1 — legenda | lib/servicos.ts:38 | corpo | (a) | em obras e reformas por mês |
| Indicador 2 — valor | lib/servicos.ts:39 | título | (a) | 400+ |
| Indicador 2 — legenda | lib/servicos.ts:39 | corpo | (a) | unidades atendidas no RJ |
| Contrato recorrente | lib/servicos.ts:41 | corpo | (a) | Pequenas adequações e reparos contínuos podem entrar na rotina do contrato mensal de manutenção. |
| Demanda spot | lib/servicos.ts:42 | corpo | (a) | Reformas, expansões e adequações maiores viram proposta técnica avulsa, com escopo, cronograma e orçamento fechados. |

## `/servicos/novas-construcoes`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| `<title>` | lib/servicos.ts:73 | SEO | (c) | Novas Construções — Manfac Engenharia |
| meta description | lib/servicos.ts:74 | SEO | (c) | Gestão e execução de novas construções do planejamento à entrega das chaves, com equipe própria, cronograma real e custo sob controle. |
| Nome (eyebrow) | lib/servicos.ts:50 | subtítulo | (a) | ↺ Novas Construções |
| H1 | lib/servicos.ts:51 | título | (a) | Do zero à entrega das chaves — prazo e custo sob controle. |
| Subtítulo do hero | lib/servicos.ts:52 | corpo | (a) | ↺ ver `/servicos` (campo `sub`) |
| Foto (alt) | lib/servicos.ts:70 | alt | (a) | Equipe de construção trabalhando em estrutura de edifício |
| Foto secundária (alt) | lib/servicos.ts:72 | alt | (a) | Fachada de edifício comercial moderno entregue |
| Para quem é | lib/servicos.ts:53 | corpo | (a) | Empresas que precisam construir novas unidades, centros de distribuição ou instalações corporativas com um único responsável técnico do projeto à entrega. |
| Dores que resolve | lib/servicos.ts:54 | corpo | (a) | Projetos que mudam de mão no meio do caminho · orçamento sem dono · cronograma que ninguém audita · entrega sem documentação. |
| Escopo 1 | lib/servicos.ts:56 | corpo | (a) | Gestão completa do projeto de engenharia |
| Escopo 2 | lib/servicos.ts:57 | corpo | (a) | Equipe técnica própria com gestão centralizada |
| Escopo 3 | lib/servicos.ts:58 | corpo | (a) | Controle rigoroso de cronograma e custo |
| Escopo 4 | lib/servicos.ts:59 | corpo | (a) | Visibilidade do andamento em tempo real |
| Escopo 5 | lib/servicos.ts:60 | corpo | (a) | Entrega com documentação e comissionamento |
| Como executamos | lib/servicos.ts:62 | corpo | (a) | Planejamento executivo com marcos de entrega; execução com equipe própria e supervisão de engenharia; reuniões de status, cronograma atualizado e evidências de campo em cada fase. |
| Indicador 1 — valor | lib/servicos.ts:64 | título | (a) | +R$800 mil |
| Indicador 1 — legenda | lib/servicos.ts:64 | corpo | (a) | em obras executadas por mês |
| Indicador 2 — valor | lib/servicos.ts:65 | título | (a) | 100% |
| Indicador 2 — legenda | lib/servicos.ts:65 | corpo | (a) | das demandas concluídas no mês |
| Contrato recorrente | lib/servicos.ts:67 | corpo | (a) | Após a entrega, a manutenção preventiva da nova unidade pode entrar direto no contrato mensal. |
| Demanda spot | lib/servicos.ts:68 | corpo | (a) | A construção em si é sempre um projeto spot: escopo fechado, cronograma, orçamento e entrega técnica documentada. |

## `/servicos/manutencao-predial`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| `<title>` | lib/servicos.ts:100 | SEO | (c) | Manutenção Predial para Redes e Grandes Operações — Manfac Engenharia |
| meta description | lib/servicos.ts:101 | SEO | (c) | Manutenção predial preventiva e corretiva com SLA, equipe técnica própria e visibilidade mensal dos chamados para redes e grandes operações. |
| Nome (eyebrow) | lib/servicos.ts:78 | subtítulo | (a) | ↺ Manutenção Predial Preventiva e Corretiva |
| H1 | lib/servicos.ts:79 | título | (a) | Manutenção predial para redes e grandes operações, com SLA, equipe técnica e visibilidade mensal dos chamados. |
| Subtítulo do hero | lib/servicos.ts:80 | corpo | (a) | ↺ ver `/servicos` (campo `sub`) |
| Foto (alt) | lib/servicos.ts:99 | alt | (a) | Técnico de manutenção uniformizado trabalhando em campo |
| Para quem é | lib/servicos.ts:81 | corpo | (a) | Redes varejistas, operações corporativas e ambientes críticos com múltiplas unidades que precisam de previsibilidade, padrão técnico e um único responsável pela manutenção. |
| Dores que resolve | lib/servicos.ts:82 | corpo | (a) | Emergências recorrentes · fornecedores sem padrão · falta de visibilidade sobre chamados · custo imprevisível mês a mês. |
| Escopo 1 | lib/servicos.ts:84 | corpo | (a) | Plano de manutenção preventiva customizado |
| Escopo 2 | lib/servicos.ts:85 | corpo | (a) | Atendimento corretivo com SLA definido em contrato |
| Escopo 3 | lib/servicos.ts:86 | corpo | (a) | Cobertura de elétrica, hidráulica, civil e pequenos reparos |
| Escopo 4 | lib/servicos.ts:87 | corpo | (a) | Registro fotográfico e evidência por chamado |
| Escopo 5 | lib/servicos.ts:88 | corpo | (a) | Relatório mensal de demandas e status de cada chamado |
| Como executamos | lib/servicos.ts:90 | corpo | (a) | Mapeamento das unidades e histórico; rotina preventiva programada; corretiva com SLA e priorização por criticidade; relatório mensal com análise de recorrência para reduzir emergências. |
| Indicador 1 — valor | lib/servicos.ts:92 | título | (a) | +1.000 |
| Indicador 1 — legenda | lib/servicos.ts:92 | corpo | (a) | ordens de serviço por mês |
| Indicador 2 — valor | lib/servicos.ts:93 | título | (a) | 100% |
| Indicador 2 — legenda | lib/servicos.ts:93 | corpo | (a) | das demandas concluídas no mês |
| Indicador 3 — valor | lib/servicos.ts:94 | título | (a) | 400+ |
| Indicador 3 — legenda | lib/servicos.ts:94 | corpo | (a) | unidades sob gestão no RJ |
| Contrato recorrente | lib/servicos.ts:96 | corpo | (a) | É o coração do contrato mensal: preventiva, corretiva e emergencial com SLA, equipe e relatórios. |
| Demanda spot | lib/servicos.ts:97 | corpo | (a) | Intervenções fora do escopo contratual — trocas de grande porte, adequações — viram proposta técnica específica. |

## `/servicos/hvac`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| `<title>` | lib/servicos.ts:126 | SEO | (c) | Sistemas de Climatização HVAC — Manfac Engenharia |
| meta description | lib/servicos.ts:127 | SEO | (c) | Instalação, manutenção e gestão de sistemas de climatização HVAC com plano preventivo dedicado, técnicos especializados e SLA garantido. |
| Nome (eyebrow) | lib/servicos.ts:105 | subtítulo | (a) | ↺ Sistemas de Climatização (HVAC) |
| H1 | lib/servicos.ts:106 | título | (a) | Climatização funcionando. Energia dentro do orçamento. |
| Subtítulo do hero | lib/servicos.ts:107 | corpo | (a) | ↺ ver `/servicos` (campo `sub`) |
| Foto (alt) | lib/servicos.ts:125 | alt | (a) | Equipamentos de climatização em casa de máquinas |
| Para quem é | lib/servicos.ts:108 | corpo | (a) | Operações onde climatização parada significa perda direta: lojas, escritórios, ambientes técnicos e áreas de atendimento ao público. |
| Dores que resolve | lib/servicos.ts:109 | corpo | (a) | Sistema parado em horário de pico · conta de energia fora do controle · manutenção só quando quebra · fornecedor sem especialização. |
| Escopo 1 | lib/servicos.ts:111 | corpo | (a) | Instalação de sistemas split, VRF e centrais de ar |
| Escopo 2 | lib/servicos.ts:112 | corpo | (a) | Manutenção preventiva com periodicidade definida |
| Escopo 3 | lib/servicos.ts:113 | corpo | (a) | Higienização e limpeza técnica |
| Escopo 4 | lib/servicos.ts:114 | corpo | (a) | Monitoramento de performance e consumo |
| Escopo 5 | lib/servicos.ts:115 | corpo | (a) | Atendimento de urgência com SLA garantido |
| Como executamos | lib/servicos.ts:117 | corpo | (a) | Diagnóstico do parque instalado; plano preventivo com periodicidade por equipamento; execução por técnicos especializados com registro por visita; acompanhamento de consumo e performance. |
| Indicador 1 — valor | lib/servicos.ts:119 | título | (a) | 400+ |
| Indicador 1 — legenda | lib/servicos.ts:119 | corpo | (a) | unidades atendidas no RJ |
| Indicador 2 — valor | lib/servicos.ts:120 | título | (a) | 100% |
| Indicador 2 — legenda | lib/servicos.ts:120 | corpo | (a) | das demandas concluídas no mês |
| Contrato recorrente | lib/servicos.ts:122 | corpo | (a) | Plano preventivo de HVAC entra no contrato mensal com periodicidade e SLA definidos. |
| Demanda spot | lib/servicos.ts:123 | corpo | (a) | Instalações novas, substituição de equipamentos e retrofits de climatização viram proposta técnica avulsa. |

---

# ROTA `/resultados`

## SEO — `app/resultados/page.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| `<title>` | app/resultados/page.tsx:9 | SEO | (c) | Resultados — Manfac Engenharia |
| meta description | app/resultados/page.tsx:11 | SEO | (c) | Como a Manfac estruturou a gestão de 400+ unidades no Rio de Janeiro para um dos maiores varejistas farmacêuticos do Brasil — transformando 7 anos de operação fragmentada em referência de excelência. |

## 1. Hero — `components/Resultados.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Foto (alt) | components/Resultados.tsx:21 | alt | (b) | Vista aérea de cidade com múltiplos edifícios comerciais |
| Eyebrow | components/Resultados.tsx:31 | subtítulo | (b) | Case de Sucesso |
| H1 | components/Resultados.tsx:34-36 | título | (b) | Gestão que transforma escala ↵ em resultado. |
| Subtítulo | components/Resultados.tsx:39-40 | corpo | (b) | 400+ unidades. Mais de 1.000 ordens de serviço por mês. 7 anos de operação fragmentada transformados em referência de excelência no Estado do Rio de Janeiro. |
| Stat 1 — valor | components/Resultados.tsx:46 | título | (b) | R$16 bi |
| Stat 1 — legenda | components/Resultados.tsx:46 | corpo | (b) | faturamento anual do cliente |
| Stat 2 — valor | components/Resultados.tsx:47 | título | (b) | 1.600+ |
| Stat 2 — legenda | components/Resultados.tsx:47 | corpo | (b) | unidades no Brasil |
| Stat 3 — valor | components/Resultados.tsx:48 | título | (b) | 400+ |
| Stat 3 — legenda | components/Resultados.tsx:48 | corpo | (b) | unidades no RJ sob gestão Manfac |

## 2. O Cliente — `components/Resultados.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/Resultados.tsx:66 | subtítulo | (b) | O Cliente |
| H2 | components/Resultados.tsx:69 | título | (b) | Um dos maiores varejistas farmacêuticos do Brasil confiou à Manfac a gestão de 400+ unidades no Rio de Janeiro. |
| Parágrafo | components/Resultados.tsx:72-74 | corpo | (b) | Com faturamento de R$16 bilhões/ano e mais de 1.600 unidades espalhadas pelo país, este cliente opera em escala onde cada falha técnica tem custo direto de imagem e receita. A exigência é alta — e a Manfac foi escolhida para cumprir. |
| Rótulo do card | components/Resultados.tsx:80 | subtítulo | (b) | Escala da operação |
| Item 1 — valor | components/Resultados.tsx:83 | título | (b) | R$16 bi |
| Item 1 — legenda | components/Resultados.tsx:83 | corpo | (b) | em faturamento anual |
| Item 2 — valor | components/Resultados.tsx:84 | título | (b) | 1.600+ |
| Item 2 — legenda | components/Resultados.tsx:84 | corpo | (b) | unidades no Brasil |
| Item 3 — valor | components/Resultados.tsx:85 | título | (b) | 400+ |
| Item 3 — legenda | components/Resultados.tsx:85 | corpo | (b) | unidades no RJ sob gestão Manfac |
| Item 4 — valor | components/Resultados.tsx:86 | título | (b) | 7 anos |
| Item 4 — legenda | components/Resultados.tsx:86 | corpo | (b) | de operação fragmentada antes da Manfac |

## 3. O Desafio — `components/Resultados.tsx` + `lib/content.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/Resultados.tsx:108 | subtítulo | (b) | O Desafio |
| H2 | components/Resultados.tsx:111 | título | (b) | Uma operação fragmentada que precisava de estrutura — e ganhou. |
| Parágrafo | components/Resultados.tsx:114-117 | corpo | (b) | Quando a Manfac assumiu, a operação estava fragmentada entre múltiplos fornecedores sem padronização de processos, comunicação centralizada ou rastreabilidade. O cliente não sabia o que estava acontecendo nas suas unidades — e o custo disso aparecia toda semana em forma de emergência, retrabalho e insatisfação. |
| Rótulo da lista | components/Resultados.tsx:122 | subtítulo | (b) | O que encontramos ao chegar |
| Problema 1 | lib/content.ts:19 | corpo | (a) | Falta de visibilidade sobre o andamento das demandas |
| Problema 2 | lib/content.ts:20 | corpo | (a) | Dificuldade de controle de prazos e custos |
| Problema 3 | lib/content.ts:21 | corpo | (a) | Comunicação descentralizada |
| Problema 4 | lib/content.ts:22 | corpo | (a) | Atuação reativa e sem padronização |

## 4. A Solução — `components/Resultados.tsx`

Os 5 passos numerados são os mesmos de `/quem-somos` (`PASSOS`, ↺). As descrições abaixo são exclusivas desta página.

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/Resultados.tsx:144 | subtítulo | (b) | A Solução |
| H2 | components/Resultados.tsx:147 | título | (b) | Como a Manfac virou referência em 18 meses. |
| Parágrafo | components/Resultados.tsx:150-152 | corpo | (b) | Estruturamos a operação do zero: diagnóstico completo, equipe técnica dedicada, rotinas de controle e comunicação diária — até a operação estar funcionando de forma previsível e escalável. |
| Foto (alt) | components/Resultados.tsx:161 | alt | (b) | Equipe Manfac em reunião de planejamento estratégico |
| Detalhe do passo 01 | components/Resultados.tsx:7 | corpo | (b) | Levantamento completo das unidades, demandas represadas e fornecedores ativos. |
| Detalhe do passo 02 | components/Resultados.tsx:8 | corpo | (b) | Criação de equipe técnica dedicada, padrões de execução e fluxos de comunicação. |
| Detalhe do passo 03 | components/Resultados.tsx:9 | corpo | (b) | Execução das demandas com registro, prazo e responsável definidos para cada chamado. |
| Detalhe do passo 04 | components/Resultados.tsx:10 | corpo | (b) | Relatórios semanais, dashboard ao vivo e ponto de contato único para o cliente. |
| Detalhe do passo 05 | components/Resultados.tsx:11 | corpo | (b) | Análise mensal de indicadores para reduzir emergências e antecipar melhorias. |

## 5. Os Números — `components/Resultados.tsx` + `lib/content.ts`

Os quatro números são `STATS` (↺ ver rota `/`).

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/Resultados.tsx:192 | subtítulo | (b) | Resultado |
| H2 | components/Resultados.tsx:195 | título | (b) | Os números falam por si. |

## 6. Destaque — `components/Resultados.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Citação | components/Resultados.tsx:231-232 | corpo | (b) | "A Manfac não só resolveu os problemas técnicos — estruturou uma operação que o cliente nunca havia tido: previsível, rastreável e escalável." |
| Assinatura | components/Resultados.tsx:237 | subtítulo | (b) | Resultado da parceria após 18 meses de operação |

## 7. CTA final

↺ `components/Contato.tsx` — ver rota `/`.

---

# ROTA `/contato`

Única rota sem o bloco `Contato` e **sem nenhuma copy vinda dos arquivos centrais**.

## SEO — `app/contato/page.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| `<title>` | app/contato/page.tsx:10 | SEO | (c) | Contato — Manfac Engenharia |
| meta description | app/contato/page.tsx:12 | SEO | (c) | Agende uma conversa técnica com a Manfac: manutenção predial recorrente, obras e reformas corporativas ou avaliação técnica da sua operação. |

## 1. Cabeçalho do formulário — `components/ContactForm.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Eyebrow | components/ContactForm.tsx:135 | subtítulo | (b) | Contato |
| H1 | components/ContactForm.tsx:137 | título | (b) | Qual é a sua demanda? |
| Subtítulo | components/ContactForm.tsx:140 | corpo | (b) | Escolha o caminho — leva menos de 1 minuto e sua mensagem já chega qualificada. |
| aria-label do grupo | components/ContactForm.tsx:143 | acessibilidade | (b) | Tipo de demanda |

## 2. Escolha do caminho — `components/ContactForm.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Box 1 — título | components/ContactForm.tsx:10 | subtítulo | (b) | Manutenção recorrente |
| Box 1 — descrição | components/ContactForm.tsx:11 | corpo | (b) | Contrato mensal com SLA, equipe, rotina de chamados e relatórios para suas unidades. |
| Box 2 — título | components/ContactForm.tsx:14 | subtítulo | (b) | Obra ou reforma |
| Box 2 — descrição | components/ContactForm.tsx:15 | corpo | (b) | Projeto pontual com escopo fechado, cronograma, orçamento e entrega técnica. |
| Box 3 — título | components/ContactForm.tsx:18 | subtítulo | (b) | Avaliação técnica |
| Box 3 — descrição | components/ContactForm.tsx:19 | corpo | (b) | Leitura técnica da sua operação atual para identificar riscos e oportunidades. |

## 3. Etapa 1 do formulário — `components/ContactForm.tsx` + `lib/leads.ts`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Label | components/ContactForm.tsx:188 | formulário | (b) | Nome |
| Placeholder | components/ContactForm.tsx:194 | formulário | (b) | Seu nome |
| Label | components/ContactForm.tsx:202 | formulário | (b) | E-mail corporativo |
| Placeholder | components/ContactForm.tsx:209 | formulário | (b) | nome@empresa.com.br |
| Label | components/ContactForm.tsx:217 | formulário | (b) | Telefone / WhatsApp |
| Placeholder | components/ContactForm.tsx:224 | formulário | (b) | (21) 9 9999-9999 |
| Consentimento LGPD | lib/leads.ts:10 | formulário | (b) | Autorizo a Manfac Engenharia a usar meus dados de contato para responder a esta solicitação. |
| Link de emergência (erro de infra) | components/ContactForm.tsx:261 | botão | (b) | Falar no WhatsApp agora |
| Botão — estado de envio | components/ContactForm.tsx:272 | botão | (b) | Enviando… |
| Botão — estado normal | components/ContactForm.tsx:272 | botão | (b) | Continuar |
| Nota abaixo do botão | components/ContactForm.tsx:275-276 | corpo | (b) | * Campos obrigatórios · Resposta em até 1 dia útil |

## 4. Etapa 2 do formulário — `components/ContactForm.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Label | components/ContactForm.tsx:286 | formulário | (b) | Empresa |
| Sufixo de campo opcional (×5) | components/ContactForm.tsx:286 | formulário | (b) | (opcional) |
| Placeholder | components/ContactForm.tsx:291 | formulário | (b) | Nome da empresa |
| Label | components/ContactForm.tsx:299 | formulário | (b) | Cargo |
| Placeholder | components/ContactForm.tsx:304 | formulário | (b) | Ex.: Gerente de Facilities |
| Label | components/ContactForm.tsx:312 | formulário | (b) | Localidade das unidades |
| Placeholder | components/ContactForm.tsx:317 | formulário | (b) | Ex.: RJ capital e Baixada |
| Label (só em "Manutenção recorrente") | components/ContactForm.tsx:326 | formulário | (b) | Nº de unidades |
| Opção padrão do select | components/ContactForm.tsx:335 | formulário | (b) | Selecione… |
| Opção | components/ContactForm.tsx:336 | formulário | (b) | 1 a 10 |
| Opção | components/ContactForm.tsx:337 | formulário | (b) | 11 a 50 |
| Opção | components/ContactForm.tsx:338 | formulário | (b) | 51 a 200 |
| Opção | components/ContactForm.tsx:339 | formulário | (b) | 200+ |
| Label | components/ContactForm.tsx:345 | formulário | (b) | Resumo da demanda |
| Placeholder | components/ContactForm.tsx:351 | formulário | (b) | Ex.: rede com 30 lojas, manutenção fragmentada em 4 fornecedores… |
| Link de fallback (popup bloqueado) | components/ContactForm.tsx:372 | botão | (b) | Abrir WhatsApp |
| Botão primário | components/ContactForm.tsx:385 | botão | (b) | Enviar e falar no WhatsApp |
| Botão secundário | components/ContactForm.tsx:393 | botão | (b) | Pular e falar agora |
| Nota abaixo dos botões | components/ContactForm.tsx:396 | corpo | (b) | Abre no seu WhatsApp · Resposta em até 1 dia útil |
| Nota de troca de demanda | components/ContactForm.tsx:405-415 | corpo | (b) | Para trocar o tipo de demanda, fale com a gente no WhatsApp. |

## 5. Mensagens de erro — `lib/leads.ts`, `app/contato/_actions.ts`, `components/ContactForm.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Validação — caminho | lib/leads.ts:42 | erro | (b) | Escolha um tipo de demanda válido. |
| Validação — nome vazio | lib/leads.ts:45 | erro | (b) | Informe seu nome. |
| Validação — nome longo | lib/leads.ts:48 | erro | (b) | Nome muito longo. |
| Validação — e-mail | lib/leads.ts:52 | erro | (b) | Informe um e-mail válido. |
| Validação — e-mail longo | lib/leads.ts:55 | erro | (b) | E-mail muito longo. |
| Validação — telefone longo | lib/leads.ts:59 | erro | (b) | Telefone muito longo. |
| Validação — telefone sem DDD | lib/leads.ts:64 | erro | (b) | Informe um telefone com DDD. |
| Validação — consentimento | lib/leads.ts:67 | erro | (b) | É preciso autorizar o uso dos seus dados para continuar. |
| Validação — campo longo (etapa 2) | lib/leads.ts:82 | erro | (b) | Campo "{nome do campo}" muito longo. |
| Validação — resumo longo | lib/leads.ts:86 | erro | (b) | Resumo muito longo. |
| Falha de infraestrutura (servidor) | app/contato/_actions.ts:14 | erro | (b) | Não conseguimos registrar agora. Fale com a gente no WhatsApp. |
| Falha de infraestrutura (cliente) | components/ContactForm.tsx:91 | erro | (b) | Não conseguimos registrar agora. Fale com a gente no WhatsApp. |
| Popup do WhatsApp bloqueado | components/ContactForm.tsx:124 | erro | (b) | Não conseguimos abrir o WhatsApp automaticamente. Toque no link abaixo. |

## 6. Cartão de canais diretos — `components/ContatoInfo.tsx`

| Seção | Arquivo:linha | Tipo | Grupo | Texto atual |
|---|---|---|---|---|
| Título | components/ContatoInfo.tsx:15 | subtítulo | (b) | Prefere falar direto? |
| Telefone | lib/whatsapp.ts:9 | corpo | (b) | ↺ (21) 98428-0058 |
| E-mail | components/ContatoInfo.tsx:36 | corpo | (b) | ↺ contato@manfac.com.br |

---

# Resumo quantitativo

Contagem de **strings únicas** (texto reaproveitado, marcado com `↺`, conta uma vez só, na rota onde aparece primeiro). Números apurados por script sobre as tabelas acima; a contagem de palavras ignora tokens sem letra nem dígito.

## Por rota

| Rota | Strings | Palavras | (a) central | (b) hardcoded | (c) SEO |
|---|---:|---:|---:|---:|---:|
| **GLOBAL** (layout + header + rodapé + botão flutuante + mensagem do WhatsApp) | 58 | 225 | 5 | 35 | 18 |
| `/` (home) | 92 | 519 | 48 | 44 | 0 |
| `/quem-somos` | 57 | 470 | 27 | 28 | 2 |
| `/servicos` | 15 | 148 | 8 | 5 | 2 |
| `/servicos/[slug]` (4 páginas + template) | 84 | 762 | 67 | 9 | 8 |
| `/resultados` | 45 | 398 | 4 | 39 | 2 |
| `/contato` | 57 | 284 | 0 | 55 | 2 |
| **TOTAL** | **408** | **2.806** | **159** | **215** | **34** |

Detalhe das 4 subpáginas de serviço (dentro das 84 acima): `obras-e-reformas` 16 strings de conteúdo + 2 de SEO; `novas-construcoes` 17 + 2; `manutencao-predial` 18 + 2; `hvac` 16 + 2; mais 9 rótulos fixos do template.

## Por grupo

| Grupo | Strings | % | Onde vive |
|---|---:|---:|---|
| (a) Copy centralizada | 159 | 39% | `lib/content.ts` (84 strings em uso) e `lib/servicos.ts` (75) |
| (b) Hardcoded em componente | 215 | 53% | 23 arquivos (ver "Custo de mexer") |
| (c) Metadados de SEO | 34 | 8% | `app/layout.tsx` (18), `lib/servicos.ts` (8), 4 `page.tsx` (2 cada) |

`lib/content.ts` tem 100 strings ao todo; 16 delas (`SERVICOS` e `RESULTADOS`) não aparecem em nenhuma rota — ver achados 8 e 9. `lib/servicos.ts` tem 83 (75 de conteúdo + 8 de SEO), todas em uso.

## Dependência de arquivo central vs. hardcoded, por rota

| Rota | Depende de arquivo central? | Observação |
|---|---|---|
| `/` | Sim, parcialmente | 5 das 9 seções leem `lib/content.ts`; Hero, ServicosTeaser, CaseTeaser e o CTA final são 100% hardcoded |
| `/quem-somos` | Sim | 4 seções leem `lib/content.ts`, mas todos os títulos, parágrafos e as 5 descrições de diferencial são hardcoded |
| `/servicos` | Sim, majoritariamente | 8 de 13 strings vêm de `lib/servicos.ts` |
| `/servicos/[slug]` ×4 | **Sim, quase por inteiro** | 67 de 84 strings em `lib/servicos.ts`; só 9 rótulos fixos no componente |
| `/resultados` | Quase não | 4 de 45 strings (`PROBLEMAS`); todo o resto está dentro de `components/Resultados.tsx` |
| `/contato` | **Não** | 0 strings centralizadas; tudo em `ContactForm.tsx`, `ContatoInfo.tsx`, `lib/leads.ts` e `_actions.ts` |

**Resumo:** 4 rotas (as subpáginas de serviço) mudam quase só editando `lib/servicos.ts`. 3 rotas (`/`, `/quem-somos`, `/servicos`) são mistas. 2 rotas (`/resultados`, `/contato`) exigem mexer em componente para praticamente qualquer ajuste.

---

# Custo de mexer

## Barato — trocar texto sem abrir componente

- **`lib/servicos.ts`** (83 strings: 75 de conteúdo + 8 de SEO): controla as 4 subpáginas de serviço por inteiro, os chips e cards de `/servicos`, a lista de serviços do rodapé e os `<title>`/description dessas 4 rotas. É o arquivo de maior alavancagem do site: uma edição aqui muda 4 páginas mais rodapé mais SEO.
- **`lib/content.ts`** (84 strings em uso, de 100): menu do header, faixa de números (usada em `/` e `/resultados`), tabela de dores, "como funciona", recorrente vs. spot, pílulas da home, pilares, passos, banners, diferenciais e lista de impacto de `/quem-somos`, e os 4 problemas de `/resultados`.
- **`lib/leads.ts`** (1 string de consentimento + 10 mensagens de erro) e **`lib/whatsapp.ts`** (telefone exibido + 10 fragmentos da mensagem enviada): não são arquivos de copy por design, mas mexer neles não exige tocar em JSX.

## Caro — exige editar componente

23 arquivos concentram as 215 strings hardcoded. Em ordem de volume (contagem por script sobre as tabelas deste documento; não inclui as ocorrências marcadas `↺`):

| Arquivo | Strings hardcoded | O que controla |
|---|---:|---|
| `components/ContactForm.tsx` | 42 | Todo o formulário de `/contato` (rótulos, placeholders, botões, notas, 2 mensagens de erro) |
| `components/Resultados.tsx` | 39 | Página `/resultados` inteira, menos os 4 problemas |
| `components/Footer.tsx` | 15 | Rodapé de todas as rotas — inclui tagline e endereço provisórios |
| `components/home/CaseTeaser.tsx` | 14 | Bloco de case da home, com as 4 métricas duplicadas |
| `components/home/ServicosTeaser.tsx` | 12 | Cards de serviço da home (títulos e descrições próprios) |
| `lib/whatsapp.ts` | 11 | Texto das mensagens de WhatsApp |
| `lib/leads.ts` | 11 | Consentimento LGPD + 10 mensagens de validação |
| `components/QuemSomos.tsx` | 9 | Hero e bloco de missão de `/quem-somos` |
| `components/ServicePage.tsx` | 9 | Rótulos fixos das 4 subpáginas de serviço |
| `components/Diferencial.tsx` | 8 | Descrições dos 5 diferenciais + citação |
| `components/Header.tsx` | 7 | Dropdown de serviços, CTA e alt do logo |
| `components/Time.tsx` | 7 | Seção "Nossa cultura" |
| `components/Hero.tsx` | 5 | Hero da home |
| `components/Servicos.tsx` | 5 | Hero de `/servicos` |
| `components/home/Dores.tsx` | 4 | Cabeçalho e colunas da tabela de dores |
| `components/Contato.tsx` | 4 | CTA final de 5 rotas |
| `components/Abordagem.tsx` | 4 | Cabeçalho da seção "Nossa abordagem" |
| `components/WhatsAppFloat.tsx` | 2 | Botão flutuante |
| `components/home/ComoFunciona.tsx` | 2 | Cabeçalho da seção |
| `components/home/Diferenciais.tsx` | 2 | Cabeçalho da seção |
| `components/Stats.tsx` | 1 | aria-label da faixa de números |
| `components/ContatoInfo.tsx` | 1 | Título do cartão de canais diretos |
| `app/contato/_actions.ts` | 1 | Mensagem de falha de infraestrutura |

## SEO

Os `<title>` e descriptions vivem em 3 lugares: `app/layout.tsx` (padrão + Open Graph + Twitter + JSON-LD, 18 strings), `lib/servicos.ts` (`metaTitle`/`metaDescription`, 2 por serviço = 8) e os 4 `page.tsx` de `/quem-somos`, `/servicos`, `/resultados` e `/contato` (2 cada). A home não tem nenhum: herda o layout.

## Nota para tradução PT/EN/ES

Hoje não existe camada de i18n. O caminho mais barato seria mover as 215 strings do grupo (b) para `lib/content.ts` **antes** de traduzir — traduzir no estado atual significa manter 23 arquivos em 3 idiomas. Vale também notar que `lang="pt-BR"` está fixo em `app/layout.tsx:80`.

---

# Achados

Só fatos observados na leitura do código. Nenhum juízo de estilo, nenhuma reescrita.

## 1. Os mesmos 4 números aparecem com 3 redações diferentes de legenda

`lib/content.ts:12-15` (`STATS`, usado em `/` e `/resultados`), `lib/content.ts:121-124` (`RESULTADOS`) e `components/home/CaseTeaser.tsx:7-42` (`METRICAS`) carregam os mesmos valores com legendas divergentes:

| Valor | `STATS` (content.ts:12-15) | `METRICAS` (CaseTeaser.tsx:8,20,30,42) |
|---|---|---|
| +1.000 | ordens de serviço/mês | ordens de serviço por mês |
| 100% | das demandas concluídas no mês | das demandas concluídas mensalmente |
| 400+ | unidades sob gestão no RJ | unidades sob gestão da Manfac no RJ |
| +R$800 mil | em obras e reformas/mês | em obras e reformas por mês |

O visitante da home lê as duas versões **na mesma página** — `Stats` (topo) e `CaseTeaser` (meio). Ajustar a legenda em um lugar não ajusta no outro.

## 2. "1.600+ lojas" vs. "1.600+ unidades" para o mesmo cliente

`components/home/CaseTeaser.tsx:75` diz "**1.600+ lojas** no país". `components/Resultados.tsx:47` e `:84` dizem "1.600+ **unidades** no Brasil", e `components/Resultados.tsx:72` diz "mais de 1.600 **unidades** espalhadas pelo país".

## 3. Faturamento do cliente escrito de 3 formas

`components/home/CaseTeaser.tsx:74`: "R$ 16 bi/ano" (com espaço não-quebrável). `components/Resultados.tsx:46` e `:83`: "R$16 bi" (sem espaço). `components/Resultados.tsx:72`: "R$16 bilhões/ano". Some-se `+R$800 mil` em `lib/content.ts:15` e `lib/servicos.ts:38,64`, também sem espaço após o `R$`.

## 4. A home tem duas listas de "diferenciais" com conteúdo diferente

`lib/content.ts:66-72` (`DIFERENCIAIS_HOME`, seção "Por que a Manfac" da home) e `lib/content.ts:127-133` (`DIFERENCIAIS`, seção "Diferenciais" de `/quem-somos`) são listas distintas de 5 itens cada, com sobreposição parcial ("Gestão ativa com responsável técnico" vs. "Gestão ativa e estruturada").

## 5. A tagline do rodapé contradiz o H1 da home

`components/Footer.tsx:10`: "Engenharia, manutenção e **facilities** para operações que não podem parar."
`components/Hero.tsx:29-31`: "Engenharia, manutenção **predial e obras corporativas** para operações que não podem parar."

Mesma estrutura de frase, promessa diferente. **E a tagline é texto provisório**: o comentário em `components/Footer.tsx:7-9` diz "TODO: dados do cliente — o João ainda não passou a tagline nem o endereço". O mesmo vale para o endereço `Rio de Janeiro · RJ` (`components/Footer.tsx:11`). Ambos estão no ar.

## 6. O nome do serviço muda entre o menu e o resto do site

`components/Header.tsx:15` chama de "**Manutenção Predial**". `lib/servicos.ts:78` — usado no rodapé, nos chips de `/servicos`, nos cards e no eyebrow da própria página — chama de "**Manutenção Predial Preventiva e Corretiva**". `components/home/ServicosTeaser.tsx:138` usa a versão longa. O dropdown do header é a única exceção.

## 7. Os cards de serviço da home não leem `lib/servicos.ts`

`components/home/ServicosTeaser.tsx:120-149` reescreve as 4 descrições em vez de importar `SERVICOS_DATA`. As frases quase batem, mas divergem:
- Teaser (`:126`): "…gestão próxima — sem paralisar **sua** operação."
- Fonte (`lib/servicos.ts:26`): "…gestão próxima — sem paralisar **a operação do cliente**."

As outras três também são reescritas, não cópias.

## 8. `lib/content.ts:97-118` (`SERVICOS`) é código morto — 8 strings que ninguém lê

Nenhum arquivo importa `SERVICOS`. São 4 títulos + 4 descrições de serviço que **não aparecem em nenhuma rota** e que divergem tanto de `lib/servicos.ts` quanto de `ServicosTeaser`. Quem for ajustar copy corre o risco real de editar esse bloco achando que está mexendo na página de serviços.

## 9. Outros 5 componentes órfãos, com copy que não vai ao ar

Não são importados por nenhuma rota: `components/home/QuemSomosTeaser.tsx`, `components/Problema.tsx`, `components/Case.tsx`, `components/MapaPlaceholder.tsx` e `components/Hero3D.tsx`. `Case.tsx` é o único consumidor de `RESULTADOS` (`lib/content.ts:120-125`) — ou seja, esse bloco de 8 strings também está fora do ar. `MapaPlaceholder.tsx:13` foi tirado de `/contato` em 26/08 por decisão registrada em `app/contato/page.tsx:32-41`, e o texto "Endereço a confirmar — o mapa entra assim que a Manfac informar o endereço." continua no repositório.

## 10. A home não tem `<title>` nem description próprios

`app/page.tsx:15-19` define só o `canonical`. A home herda o título do layout (`app/layout.tsx:19`), com 79 caracteres — acima do que o Google costuma exibir inteiro.

## 11. Todas as rotas, menos as de serviço, compartilham o mesmo Open Graph

Só `app/servicos/[slug]/page.tsx:24-32` define `openGraph` próprio. `/quem-somos`, `/servicos`, `/resultados` e `/contato` sobrescrevem `title`/`description`, mas **não** o bloco `openGraph` do layout — logo, compartilhado ao WhatsApp ou LinkedIn, as 5 páginas aparecem com o mesmo título e a mesma descrição de `app/layout.tsx:32,34`.

## 12. Mensagem de erro duplicada em dois arquivos

"Não conseguimos registrar agora. Fale com a gente no WhatsApp." existe literalmente em `app/contato/_actions.ts:14` e em `components/ContactForm.tsx:91`. Alterar uma sem a outra faz o visitante ver textos diferentes conforme onde a falha ocorre.

## 13. Os links institucionais do rodapé duplicam o menu do header

`components/Footer.tsx:13-18` repete literalmente 4 dos 5 rótulos de `lib/content.ts:3-9` em vez de importá-los. Renomear "Quem somos" no menu não renomeia no rodapé.

## 14. `18 meses` aparece sem base declarada em nenhuma outra parte do site

`components/Resultados.tsx:147` ("Como a Manfac virou referência em 18 meses.") e `:237` ("Resultado da parceria após 18 meses de operação"). A meta description da mesma rota (`app/resultados/page.tsx:11`) fala em "7 anos de operação fragmentada" e não menciona os 18 meses; o hero (`:39-40`) também só cita os 7 anos. Não é contradição aritmética — são períodos diferentes —, mas os dois números convivem na mesma página sem que o texto relacione um ao outro.

## 15. Aspas retas em duas citações

`components/Diferencial.tsx:81` e `components/Resultados.tsx:231` usam `"` reto em vez de aspas tipográficas. É o único desvio tipográfico consistente que encontrei; o resto do site usa `—`, `·` e `…` corretamente.
