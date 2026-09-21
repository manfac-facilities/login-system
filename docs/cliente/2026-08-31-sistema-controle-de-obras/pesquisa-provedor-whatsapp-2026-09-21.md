# Pesquisa — provedor de WhatsApp para o agente cobrador (camada 3)

Pesquisa feita em 21/09/2026, sem código, para responder a decisão pendente registrada em
`levantamento-camadas-3-4-2026-09-21.md` (seção 5-6) e em `decisoes-para-ir-ao-ar.md:77-88`, e
seguindo a decisão do João de 21/09 (`2026-09-21-decisoes-camadas-3-e-4.md`, item 1): "Em
paralelo, levantar o provedor da camada 3, sem código."

Escopo do uso: mensagens de cobrança "até o fim do dia" para pessoas **internas da Manfac**
(Roberta/Compras, Yuri) e para **equipes e prestadores**, todos números brasileiros, dezenas de
mensagens/dia no máximo. Manfac é pessoa jurídica com CNPJ.

---

## 0. O que já existe no código — confirmado por grep

Busquei `whatsapp`, `wa.me`, `z-api`, `evolution`, `twilio`, `gupshup`, `360dialog`, `baileys`,
`wppconnect` (case-insensitive) em `app/` e `lib/`, fora de `manfac-site/`.

**Não existe nenhuma integração de envio.** Os únicos dois hits reais no módulo obras são
comentários, não código funcional:

- `app/obras/tarefas/_actions.ts:9` — "NA v1 essa volta chega pelo WhatsApp, sozinha. Na v0
  alguém marca aqui." Confirma que a resposta da Roberta precisa **voltar e ser gravada no
  sistema** — não é um aviso de mão única.
- `app/obras/diario/page.tsx:174` — texto de tela de erro pedindo para o analista avisar o
  suporte "pelo WhatsApp" (link `wa.me` manual, sem API).

`manfac-site/lib/whatsapp.ts` gera só um link `wa.me/...` para o formulário de contato do site
institucional — outro app, sem relação com o Controle de Obras.

**Conclusão: parte-se do zero.** Nenhum provedor, credencial, template ou webhook existe hoje.

---

## 1. A pergunta que decide o caminho: precisa RECEBER resposta?

Sim, confirmado em `feedback-04-agente-cobrador.md`, citação literal do cliente e leitura minha:

> "me responda aqui até o final do dia" — cliente, repassado 01/09/2026.
>
> "A resposta fecha o ciclo. O que a Roberta responder volta para a obra: ou resolve a falta, ou
> vira um prazo novo. **Sem isso o agente é só um alarme com educação.**" — `feedback-04:35-37`.

Isso elimina qualquer opção de mão única (ex.: só WhatsApp Business App manual, ou um serviço de
disparo sem webhook). As três famílias de provedores abaixo recebem resposta por **webhook** —
isso não é diferencial entre elas, é pré-requisito comum. A diferença está em confiabilidade,
prazo de implantação e risco.

---

## 2. Tabela comparativa

| | Cloud API direta (Meta) | BSP oficial (Twilio / 360dialog / Gupshup / Zenvia / Take Blip) | Não oficial (Z-API / Evolution-Baileys / WPPConnect) |
|---|---|---|---|
| **O que exige** | Business Manager verificado, número dedicado (não pode já estar em uso no app comum/Business App), display name aprovado, template aprovado | Igual à Cloud API (é a mesma API por trás), + conta no BSP | Só um número de WhatsApp comum + QR Code escaneado |
| **Prazo até 1º envio real** | Verificação de empresa: 2 a 10 dias úteis; integração de engenharia direto sem parceiro: **2 a 6 semanas** (dev próprio, sem suporte) | Setup do BSP: 24-48h depois da verificação da empresa pronta; verificação da empresa continua sendo o gargalo (mesmos 2-10 dias úteis) | Horas — só escanear o QR Code |
| **Custo fixo mensal** | Nenhum da Meta; custo é engenharia própria | Twilio: sem mensalidade fixa, paga por mensagem; 360dialog: a partir de ~US$49-59/mês; Zenvia/Take Blip: pacotes cotados, R$200-1.200/mês típico no mercado | Z-API: ~R$55-100/mês por instância (mensagens "ilimitadas"); Evolution API self-hosted: custo de servidor (baixo) mas exige alguém mantendo |
| **Custo variável (Brasil, categoria utility — a que se aplica aqui)** | ~R$0,03-0,05 por mensagem fora da janela de 24h; **grátis dentro da janela de 24h de atendimento** desde 01/07/2025; 1.000 conversas grátis/mês | Meta cobra o mesmo valor-base; BSP soma taxa própria (Twilio: +US$0,005/mensagem) ou markup (Take Blip: 20-40% sobre a tarifa Meta, segundo uma fonte) | Sem tarifa por mensagem da Meta (não passa pela Meta) |
| **Risco de banimento do número** | Baixo — é o canal oficial | Baixo — é o canal oficial, com parceiro cuidando do cumprimento das regras | **Alto e crescente em 2026** — múltiplas fontes relatam onda de banimentos de conexões via QR Code em jan/2026; risco é do protocolo (engenharia reversa do WhatsApp Web), não da marca do produto |
| **Recebe resposta (webhook)** | Sim | Sim | Sim |
| **O que um banimento significa aqui** | N/A | N/A | Sistema de cobrança da operação para de enviar e receber **sem aviso prévio**, número pode ser perdido de forma irreversível — para um fluxo que roda "até o fim do dia" todo dia útil, isso é falha operacional recorrente, não incidente isolado |

Fontes com data em cada linha estão na seção 6.

---

## 3. WhatsApp Cloud API oficial da Meta, direto

- **Exigências**: Business Manager verificado (documentos: CNPJ/registro, endereço, domínio),
  número de telefone dedicado (não pode ser o mesmo já cadastrado no WhatsApp Business App comum
  da Manfac, se houver), display name aprovado pela Meta, política de privacidade publicada,
  template aprovado para toda mensagem que a empresa inicia. *(Meta for Developers / múltiplas
  fontes secundárias, 2026 — ver seção 6)*
- **Tempo de aprovação**: verificação de negócio "2 a 5 dias úteis, até 14 dias se documentação
  incompleta" segundo uma fonte; outra fala em "1 a 3 dias úteis" ou "2 a 10 dias úteis". **Não
  há uma fonte primária da Meta com um número único e confiável** — a faixa real depende de
  quão limpa está a documentação da Manfac. Trate como **1 a 2 semanas** de reserva no
  cronograma, não como certeza.
- **Templates — utility vs marketing**: a mensagem da Roberta ("Yuri falou que falta material,
  veja com ele e responda até o fim do dia") é uma notificação transacional amarrada a uma ação
  registrada no sistema (a falta do diário) — isso a qualifica como **utility**, não marketing.
  Diferença prática: template utility é **grátis quando enviado dentro de uma janela de
  atendimento de 24h aberta** (ex.: a pessoa já respondeu algo no dia) e cobrado fora dela a
  ~R$0,03-0,05; marketing é sempre cobrado, a ~R$0,31-0,38. Confirmado pela documentação oficial
  da Meta via WebFetch em 21/09/2026 (`developers.facebook.com/docs/whatsapp/pricing`).
- **Janela de 24h**: confirmado — quando a pessoa responde, abre-se uma janela de 24h em que
  texto livre (sem template) é gratuito e sem restrição. Só a primeira mensagem do dia, se fora
  dessa janela, precisa de template aprovado. Isso bate exatamente com o que o cliente já havia
  entendido e está registrado em `feedback-04:43-46`.
- **Preço no Brasil em 2026**: por mensagem/categoria (não mais por conversa de 24h desde
  01/07/2025) — utility ~R$0,03-0,05, marketing ~R$0,31-0,38, autenticação ~R$0,03-0,19 (fontes
  variam nesta última). A partir de 01/07/2026, Meta passou a faturar direto em Reais para contas
  elegíveis no Brasil. **Não consegui confirmar um valor único e oficial** — blogs de terceiros
  divergem entre si (uma fonte cita R$0,04-0,05 utility, outra R$0,21); a fonte mais próxima do
  oficial (Meta for Developers, via WebFetch) confirma o modelo (grátis dentro da janela, cobrado
  fora) mas não lista a tabela de preços em Reais na página consultada. Para dezenas de
  mensagens/dia, mesmo no teto mais caro citado, o custo mensal fica na casa de poucas dezenas de
  reais — **irrelevante para a decisão**, o que pesa é prazo e risco, não preço por mensagem.

## 4. BSPs oficiais com presença no Brasil

BSP = revendedor/parceiro oficial da própria Cloud API da Meta — não é um caminho alternativo
tecnicamente, é a mesma API com uma camada de conta e suporte em cima.

- **O que aceleram**: cuidam do registro do número junto à Meta, aceleram (mas não pulam) a
  verificação de negócio, dão painel de gestão de templates e, em alguns casos, SDK pronto. O
  ganho de prazo é mais no atrito de configuração (24-48h deles) do que na verificação de negócio
  em si (gargalo que continua sendo da Meta).
- **Twilio**: sem mensalidade fixa nos planos vistos; cobra por mensagem (Meta + US$0,005 da
  Twilio); documentação extensa em Node.js/Next.js, útil dado o stack do hub. Boas notícias
  regulatórias: Brasil passou a ter faturamento em BRL para contas elegíveis a partir de
  01/07/2026 (fonte: Twilio Help Center, 2026).
- **360dialog**: parceiro oficial Meta, focado em ser "leve" — a partir de ~US$49-59/mês, sem
  markup nas tarifas da Meta segundo o próprio site. Foco declarado em preço simples, o que
  combina com "dezenas de mensagens/dia".
- **Gupshup / Zenvia / Take Blip / Blip**: mais voltados a operações de atendimento maiores
  (contact center, chatbot builder). Mensalidade típica de mercado citada por fontes de terceiros:
  R$200-1.200/mês — **acima do necessário** para o volume da camada 3. Take Blip citado com
  markup de 20-40% sobre a tarifa-base da Meta.

## 5. Não oficiais — Z-API, Evolution API/Baileys, WPPConnect

- **Como funcionam**: conectam a um número comum de WhatsApp via escaneamento de QR Code,
  reimplementando o protocolo do WhatsApp Web (engenharia reversa) — Baileys é a biblioteca por
  trás de várias dessas ferramentas, incluindo a Evolution API em modo não-oficial.
- **Prazo de setup**: o mais rápido dos três caminhos — horas, não dias.
- **Custo**: também o mais barato — Z-API na faixa de R$55-100/mês por instância (mensagens
  "ilimitadas", tarifa fixa); Evolution API self-hosted é essencialmente custo de servidor.
- **Risco de banimento**: **este é o ponto que decide contra essa família aqui.** Múltiplas
  fontes de 2026 (incluindo a própria documentação da Z-API, que reconhece o risco) relatam uma
  onda de banimentos de conexões via QR Code a partir de janeiro de 2026, e uma fonte descreve o
  fator de risco central como "quantidade de destinatários únicos que o número tenta alcançar em
  pouco tempo" — exatamente o padrão de um cobrador que manda mensagem para várias pessoas
  diferentes (Roberta, Yuri, equipes, prestadores) todos os dias.
- **O que isso significa para um sistema de cobrança da operação**: se o número for banido, o
  agente cobrador para de enviar e de receber **sem aviso**, no meio de uma rotina diária que o
  dono já está tratando como substituta de um processo manual (e de uma pessoa que está sendo
  dispensada, conforme a transcrição de 31/08). Não é uma degradação suave — é uma parada. Para
  um recado avulso ou teste, o risco seria aceitável; para o canal que carrega uma cobrança
  operacional diária, não é uma boa base a se construir em cima, ainda que o AGENTS.md não liste
  esse módulo entre as cinco exceções de tratamento obrigatório de borda (RLS, acessos, escrita
  destrutiva, autenticação, dinheiro) — a lógica que fundamenta aquelas exceções (falha
  silenciosa é o erro) se aplica igual aqui, mesmo sem estar escrita literalmente na lista.

---

## 6. Recomendação

**Caminho oficial via BSP leve (360dialog ou Twilio), não a Cloud API direta sem parceiro, e não
o caminho não oficial.**

Por quê:

1. **O volume não paga o custo do caminho não oficial.** Dezenas de mensagens/dia geram um custo
   mensal irrisório em qualquer caminho oficial (poucas dezenas de reais, mesmo no cenário mais
   caro encontrado) — a economia do não oficial (R$50-100/mês vs praticamente grátis) não
   compensa o risco de parada sem aviso num fluxo que a Manfac já está tratando como substituto
   de um processo humano.
2. **BSP em vez de Cloud API 100% direta economiza tempo de engenharia**, não tempo de
   verificação — a verificação de negócio na Meta (o gargalo real, 1-2 semanas de reserva) é
   igual nos dois. Mas construir a integração "na unha" direto com a Cloud API sem parceiro foi
   estimado por uma fonte em 2-6 semanas de trabalho de engenharia; com um BSP como 360dialog ou
   Twilio, a parte de código fica limitada a chamar a API REST do parceiro e tratar o webhook —
   trabalho de poucos dias, não semanas, dado que o hub já tem rota de API e já usa
   `pg_cron`/`pg_net` para outros jobs agendados (mesmo padrão de infraestrutura serve para o
   agendador de cobrança da camada 3).
3. **Entre os BSPs, 360dialog tem o menor atrito para este caso**: mensalidade fixa baixa
   (~US$49-59), sem chat platform embutida que a Manfac não precisa (a interface de resposta é o
   próprio Controle de Obras, não um painel de atendimento). Twilio é alternativa igualmente
   válida se preferir por causa da documentação em Node.js — mas cobra por mensagem em cima da
   tarifa da Meta (marginal no volume aqui, mas sem teto fixo).
4. Zenvia/Gupshup/Take Blip ficam **descartados por escopo**: são vendidos para operação de
   atendimento em volume, com mensalidade 4-20x mais alta do que o necessário para "dezenas de
   mensagens/dia" de cobrança interna.

## 7. O que o João precisa providenciar

- **CNPJ da Manfac** e documentos de verificação de negócio no Meta Business Manager (registro,
  endereço, comprovante — igual ao que qualquer verificação de empresa exige).
- **Um número de telefone dedicado** para o agente cobrador — não pode ser o número já usado no
  WhatsApp Business App comum da Manfac, se houver um em uso hoje. Confirmar se existe conflito.
- **Acesso/criação do Meta Business Manager** da Manfac (se ainda não existir um formal).
- **Cartão para faturamento** — tanto a Meta quanto o BSP escolhido cobram por cartão/fatura.
- **Decisão entre 360dialog e Twilio** (ou outro, se preferir) — a pesquisa recomenda 360dialog,
  mas ambos atendem; a escolha final não muda o prazo de forma relevante.
- Fora do escopo desta pesquisa, mas bloqueando o mesmo agente: **telefone de Roberta, Yuri,
  equipes e prestadores não está cadastrado em lugar nenhum do sistema** (confirmado em
  `levantamento-camadas-3-4-2026-09-21.md`, seção 5) — precisa ser levantado em paralelo, é
  "trabalho de operação do João" segundo o próprio material já lido, sem prazo definido.

## 8. Prazo realista até o primeiro envio real

Contando a partir da decisão de qual BSP usar:

- **Dias 1-2**: João providencia CNPJ/documentos, decide o número dedicado, cria/confirma o
  Business Manager, cadastra cartão. Em paralelo, abre conta no BSP escolhido.
- **Dias 1-10 (em paralelo com o item acima, é o gargalo real)**: verificação de negócio pela
  Meta. Faixa encontrada nas fontes é ampla (2 a 10 dias úteis) e **não há garantia** — pode
  estender se a documentação tiver algum problema.
- **Em paralelo, dias 3-7**: desenvolvimento do envio (chamar API do BSP) e do webhook de
  recepção de resposta, gravando a resposta na tarefa (`obras_tarefa`) — trabalho de poucos dias
  dado que reusa a infraestrutura de tarefas já existente (`app/obras/tarefas/_actions.ts`,
  `abrirTarefas` em `app/obras/diario/_actions.ts:140-206`) e o padrão de agendamento via
  `pg_cron`/`pg_net` já em produção para outros jobs.
- **Depois da verificação**: criação e aprovação do primeiro template utility — normalmente
  rápida (minutos a 24h segundo as fontes), mas pode haver rejeição e retrabalho se o texto não
  bater com as regras de categoria da Meta.

**Estimativa: 2 a 3 semanas até o primeiro envio real**, assumindo que o João age rápido nos
itens que dependem dele (documentos, número, cartão) e que a verificação de negócio não emperra.
Pode esticar para 4 semanas se a verificação tiver problema de documentação — isso é comum o
suficiente nas fontes para não prometer 2 semanas como certeza. **Isso não cabe no prazo de
28/09** — bate com a decisão do João de 21/09 de priorizar a camada 4 até lá e tratar a camada 3
como frente paralela sem prazo fixo.

Cadastro de telefones das equipes/prestadores corre em paralelo e não é gargalo do provedor —
mas sem ele o agente não tem para quem mandar mensagem além de Roberta e Yuri.

---

## 9. Fontes (URL e data de acesso/publicação onde disponível)

Todas as buscas e fetches abaixo foram feitos em 21/09/2026. Os preços/prazos vêm majoritariamente
de blogs de terceiros otimizados para SEO sobre WhatsApp Business API em 2026 — não achei uma
tabela de preços oficial da Meta para o Brasil em Reais dentro do escopo desta pesquisa. Trate os
números de preço como **faixa aproximada**, confirmar no fechamento do provedor escolhido.

- Meta for Developers, página de pricing (`developers.facebook.com/docs/whatsapp/pricing`) —
  única fonte quase-primária consultada via WebFetch em 21/09/2026; confirma o modelo (cobrança
  por template entregue desde 01/07/2025, categorias utility/marketing/authentication, grátis
  dentro da janela de 24h para utility, faturamento em BRL para Brasil a partir de 01/07/2026).
  Não trouxe tabela de preço em Reais na página consultada.
- Chatarmin, "WhatsApp Business API Integration 2026" — requisitos e prazos de verificação.
- Blueticks blog, "2026 Readiness Checklist" e "WhatsApp API Pricing 2026" — categorias e faixas
  de preço.
- Zaple.ai, "Meta Business Verification for WhatsApp API | 2026 Fix Guide" — prazo de verificação.
- wiichat.com.br, nicechat.com.br, geekacademy.site, nimochat.com.br, socialhub.pro — tabelas de
  preço por categoria no Brasil em 2026 (convergem em ordem de grandeza, divergem em centavos).
- 360dialog.com/pricing e blog — mensalidade a partir de US$49-59/mês.
- Twilio Help Center, "Notice: Changes to WhatsApp's Pricing (October 2026)" e
  twilio.com/en-us/whatsapp/pricing — tarifa adicional de US$0,005/mensagem, faturamento em BRL a
  partir de 01/07/2026, mudança de cobrança de mensagens de serviço a partir de 01/10/2026.
- messagecentral.com blog, "Best WhatsApp Business API Providers in Brazil 2026" — comparação
  Twilio/Zenvia/Take Blip/Gupshup, faixa de mensalidade de BSPs (R$200-1.200/mês) e markup do Take
  Blip (20-40%).
- z-api.io/blog e developer.z-api.io/tips/blockednumbernew — preço (R$55-100/mês) e reconhecimento
  próprio do risco de bloqueio.
- blog.cubosuite.com.br, "Meta banindo WhatsApp não-oficial em 2026" e ararahq.com/blog — onda de
  banimentos relatada a partir de janeiro de 2026, fator de risco ligado a destinatários únicos.
- Railway.com e GitHub evolution-foundation/evolution-api — arquitetura e requisitos de
  infraestrutura do self-host (Postgres, Redis, volume persistente).
