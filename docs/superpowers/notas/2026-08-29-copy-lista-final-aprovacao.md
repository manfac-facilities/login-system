# Lista final de alterações de copy — para aprovação

**Data:** 2026-08-29
**Entrada:** as quatro notas de triagem dos lotes A–D
(`2026-08-29-triagem-copy-lote-a-global-home.md`, `-lote-b-quemsomos-servicos.md`,
`-lote-c-paginas-servico.md`, `-lote-d-resultados-contato.md`), itens 1 a 66 da lista mestra de
`docs/cliente/2026-08-29-auditoria-copy-seo-cro.md` (linha 2054 em diante).
**Nada foi implementado.** Nenhum arquivo de `manfac-site/` foi tocado nesta rodada.

## O filtro aplicado

Só entrou o que é **troca pura de texto**: substituir uma string literal que já existe por outra
string, sem criar campo, prop, componente, seção ou rota, sem mexer em estrutura de dados,
validação, URL ou fluxo, sem SEO e sem CRO.

Três regras de corte que decidiram os casos de fronteira, declaradas aqui para poderem ser
auditadas:

1. **Modelo de operação.** Item cujo texto atual **ou** novo afirma ou retira "equipe própria",
   "núcleo técnico próprio", "parceiros/terceiros/fornecedores/especialistas complementares" fica
   fora — depende da decisão do cliente sobre equipe própria x parceiros. Menções neutras
   ("equipe técnica", "técnicos especializados", "equipe dedicada") **não** acionam este corte,
   porque não afirmam nem negam internalização.
2. **`nome` de serviço não é só texto.** O campo `nome` de `lib/servicos.ts` alimenta
   `buildDirectWhatsAppUrl(servico.nome)` em `components/ServicePage.tsx:42`, e essa origem entra
   **dentro da mensagem enviada ao WhatsApp** (`lib/whatsapp.ts:58`). Renomear serviço é mudança
   de fluxo, não de copy.
3. **Verificação literal.** Cada texto atual abaixo foi lido no arquivo, na linha indicada, e
   conferido quanto a ocorrências repetidas e ao sentido do texto vizinho.

## Verificação executada

Todos os 26 textos atuais da tabela abaixo existem **literalmente** no código, na linha citada.
Nenhum item aprovado ficou como "não localizado". A única string aprovada que aparece em mais de
um arquivo é a do item 1 — está na seção "Ocorrências duplicadas".

---

## Alterações aprovadas para implementação

| # | arquivo:linha | Texto ATUAL (literal) | Texto NOVO (literal) | Página onde aparece |
|---|---|---|---|---|
| 1 | `manfac-site/lib/content.ts:7` | `  { href: '/resultados', label: 'Resultados' },` | `  { href: '/resultados', label: 'Case de sucesso' },` | Menu do topo, em todas as páginas |
| 11 | `manfac-site/lib/content.ts:39` | `Status recorrente, cronograma, dashboard, reuniões e pendências.` | `Status recorrente, cronograma, painéis e relatórios na ferramenta acordada com o cliente, reuniões de acompanhamento e tratativa de pendências.` | Home `/`, seção "Como funciona na prática", passo 04 |
| 15 | `manfac-site/lib/content.ts:50` | `SLA, equipe dedicada, rotina de chamados e relatórios` | `SLA, modelo de equipe definido conforme a operação, rotina de chamados, priorização por criticidade e relatórios gerenciais.` | Home `/`, card "Contrato recorrente" |
| 24 | `manfac-site/lib/content.ts:78` | `Cada obra e chamado fazem parte de um plano maior. Acompanhamos de perto, ajustamos quando necessário e respondemos por tudo.` | `Acompanhamos indicadores, antecipamos desvios e coordenamos a tratativa de cada demanda dentro do escopo e das responsabilidades acordadas.` | `/quem-somos`, pilar "Gestão ativa, não reativa" |
| 37 | `manfac-site/lib/servicos.ts:42` | `Reformas, expansões e adequações maiores viram proposta técnica avulsa, com escopo, cronograma e orçamento fechados.` | `Demandas de maior porte são contratadas por proposta específica, com escopo, premissas, cronograma, orçamento e processo de alteração formalizados.` | `/servicos/obras-e-reformas`, card "Demanda spot" |
| 38 | `manfac-site/lib/servicos.ts:51` | `Do zero à entrega das chaves — prazo e custo sob controle.` | `Construção de unidades corporativas e comerciais, do planejamento à entrega técnica.` | `/servicos/novas-construcoes`, H1 do hero |
| 43 | `manfac-site/lib/servicos.ts:68` | `A construção em si é sempre um projeto spot: escopo fechado, cronograma, orçamento e entrega técnica documentada.` | `A implantação é contratada por projeto ou programa de expansão, com escopo, marcos, orçamento e responsabilidades formalizados.` | `/servicos/novas-construcoes`, card "Demanda spot" |
| 48 | `manfac-site/lib/servicos.ts:96` | `É o coração do contrato mensal: preventiva, corretiva e emergencial com SLA, equipe e relatórios.` | `Contrato: atividades e limites definidos para preventiva, corretiva e emergencial.` | `/servicos/manutencao-predial`, card "Contrato recorrente" |
| 48 | `manfac-site/lib/servicos.ts:97` | `Intervenções fora do escopo contratual — trocas de grande porte, adequações — viram proposta técnica específica.` | `Spot: melhorias, ampliações, sinistros, danos de terceiros, mau uso, condições preexistentes ou serviços que excedam os limites do contrato, mediante proposta e aprovação.` | `/servicos/manutencao-predial`, card "Demanda spot" |
| 51 | `manfac-site/lib/servicos.ts:107` | `Instalação, manutenção e gestão de sistemas HVAC com plano preventivo dedicado e técnicos especializados.` | `Instalação e manutenção preventiva e corretiva de sistemas split, VRF/VRV e centrais, com plano por equipamento, registro de visitas e documentação definida no contrato.` | `/servicos/hvac`, subtítulo do hero |
| 25 | `manfac-site/components/Abordagem.tsx:27` | `Do diagnóstico à entrega —<br />sem buracos no meio do caminho.` | `Do diagnóstico à entrega, sem lacunas entre planejamento, execução, comunicação e controle.` | `/quem-somos`, H2 da seção "Nossa abordagem" |
| 63 | `manfac-site/components/ContactForm.tsx:140` | `Escolha o caminho — leva menos de 1 minuto e sua mensagem já chega qualificada.` | `Escolha o tipo de demanda para direcionarmos seu contato ao responsável técnico adequado.` | `/contato`, parágrafo de abertura (acima dos três boxes, fora do container deles) |
| 19 | `manfac-site/components/Contato.tsx:21-22` | `Conte como funciona sua operação hoje — unidades, volume de demandas e principais dores. Retornamos com uma leitura técnica.` | `Conte número de unidades, regiões, volume de demandas e principais desafios. Direcionamos o contato ao responsável técnico adequado e alinhamos os próximos passos.` | Bloco de CTA final, em 8 rotas: `/`, `/quem-somos`, `/servicos`, `/resultados` e as 4 `/servicos/[slug]` |
| 1 | `manfac-site/components/Footer.tsx:16` | `  { href: '/resultados', label: 'Resultados' },` | `  { href: '/resultados', label: 'Case de sucesso' },` | Rodapé, coluna institucional, em todas as páginas |
| 7 | `manfac-site/components/Hero.tsx:37` | `A Manfac atende empresas com múltiplas unidades, alto volume de demandas e necessidade de controle, padronização e visibilidade em campo — da manutenção recorrente às obras e reformas spot.` | `A Manfac integra manutenção predial, obras e reformas para redes e empresas com múltiplas unidades, com SLA definido, gestão ativa, evidências de campo e um único ponto de responsabilidade.` | Home `/`, subheadline do hero |
| 20 | `manfac-site/components/QuemSomos.tsx:35-37` | `Engenharia que vai<br />além da obra.` | `Engenharia e gestão para operações com múltiplas unidades.` | `/quem-somos`, H1 do hero |
| 23 | `manfac-site/components/QuemSomos.tsx:64-66` | `Enquanto o mercado divide engenharia em contratos isolados, a Manfac entrega um modelo único: do diagnóstico à conclusão, com um time que conhece cada detalhe da sua demanda.` | `Enquanto muitos contratos fragmentam manutenção, obras e comunicação, a Manfac integra planejamento, execução e acompanhamento sob uma gestão central, com responsabilidades definidas por escopo.` | `/quem-somos`, 2º parágrafo do bloco institucional |
| 57 | `manfac-site/components/Resultados.tsx:34-36` | `Gestão que transforma escala<br />em resultado.` | `Como estruturamos a manutenção predial de 400+ unidades no Rio de Janeiro.` | `/resultados`, H1 do hero |
| 57 | `manfac-site/components/Resultados.tsx:39-40` | `400+ unidades. Mais de 1.000 ordens de serviço por mês. 7 anos de operação fragmentada transformados em referência de excelência no Estado do Rio de Janeiro.` | `Um case de padronização, controle e visibilidade para uma operação com mais de 1.000 ordens de serviço por mês.` | `/resultados`, texto de apoio do hero |
| 59 | `manfac-site/components/Resultados.tsx:113-118` | `Quando a Manfac assumiu, a operação estava fragmentada entre múltiplos fornecedores sem padronização de processos, comunicação centralizada ou rastreabilidade. O cliente não sabia o que estava acontecendo nas suas unidades — e o custo disso aparecia toda semana em forma de emergência, retrabalho e insatisfação.` | `Antes da reestruturação, a operação enfrentava desafios comuns a ambientes com múltiplos fornecedores: baixa padronização, comunicação descentralizada e rastreabilidade limitada dos chamados.` | `/resultados`, parágrafo da seção "O Desafio" |
| 28 | `manfac-site/components/Servicos.tsx:33-35` | `Tudo que sua infraestrutura precisa.<br />Uma equipe. Um único ponto de responsabilidade.` | `Manutenção predial, obras, reformas e HVAC sob uma única gestão.` | `/servicos`, H1 do hero |
| 27 | `manfac-site/components/Time.tsx:14` | `Uma equipe que trata sua operação como se fosse dela.` | `Uma equipe orientada por responsabilidade, registro e resposta.` | `/quem-somos`, H2 da seção "Nossa cultura" |
| 27 | `manfac-site/components/Time.tsx:60` | `Presença ativa. Comunicação direta. Entrega garantida.` | `Presença ativa, comunicação direta e entrega acompanhada por evidências.` | `/quem-somos`, card sobre a foto ("Manfac em campo") |
| 12 | `manfac-site/components/home/ServicosTeaser.tsx:126` | `Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar sua operação.` | `Reformas corporativas de diferentes portes, com planejamento, supervisão e gestão próxima para reduzir interferências e preservar a continuidade sempre que tecnicamente viável.` | Home `/`, card "Obras e Reformas Corporativas" |
| 13 | `manfac-site/components/home/ServicosTeaser.tsx:140` | `Rotinas preventivas que eliminam emergências e mantêm seu prédio funcionando sem interrupções imprevistas.` | `Rotinas preventivas que reduzem emergências, reincidências e paradas não planejadas, mantendo mais previsibilidade para a operação.` | Home `/`, card "Manutenção Predial Preventiva e Corretiva" |
| 14 | `manfac-site/components/home/ServicosTeaser.tsx:147` | `Climatização funcionando, energia dentro do orçamento e manutenção preventiva com técnicos especializados.` | `Climatização corporativa com manutenção planejada, acompanhamento de desempenho e foco em eficiência energética.` | Home `/`, card "Sistemas de Climatização (HVAC)" |

**26 alterações, 22 itens da auditoria.** Três itens entram só pela metade — 37, 38 e 43 — e a
metade que ficou de fora está registrada na seção seguinte.

### Observações sobre itens aprovados (não mudam o texto, mas o cliente precisa saber)

- **Item 15** — o texto proposto termina com ponto final; os outros dois bullets da mesma lista
  (`lib/content.ts:49` e `:51`) não têm. Transcrito como a auditoria escreveu, sem ajuste. Decidir
  na aprovação se cai o ponto.
- **Item 48** — os prefixos `Contrato:` e `Spot:` do texto proposto repetem os rótulos que o
  componente já imprime acima de cada card ("Contrato recorrente" e "Demanda spot", em
  `components/ServicePage.tsx:121` e `:127`). Transcrito literal; decidir na aprovação se os
  prefixos caem. A lista de exclusões ("sinistros, danos de terceiros, mau uso, condições
  preexistentes") precisa bater com o contrato real — a triagem do lote C não conseguiu ler o
  documento citado como [I2] na auditoria.
- **Item 23** — o parágrafo seguinte, `components/QuemSomos.tsx:69-70`, continua dizendo
  "responsabilidade total do início ao fim", que é justamente o absoluto que o texto novo abandona
  ("responsabilidades definidas por escopo"). A auditoria não propôs texto para esse parágrafo.
  A troca é uma melhora, mas a página fica com as duas afirmações no ar.
- **Item 38** — aprovado só o H1. A Home continua com o card "Novas Construções" prometendo
  "Do projeto à entrega das chaves com cronograma real, custo sob controle"
  (`components/home/ServicosTeaser.tsx:131,133`); a auditoria não escreveu texto novo para esse
  card, então a promessa antiga sobrevive na Home.
- **Item 57** — o H1 novo cita "400+ unidades", número que o item 61 quer publicar só com
  metodologia. Não é dado novo: já está no ar em nove pontos do site. A pendência de metodologia
  continua aberta no item 61, que está bloqueado.
- **Item 12** — depois da troca, `lib/servicos.ts:26` continua com a promessa gêmea "sem paralisar
  a operação do cliente" em `/servicos` e `/servicos/obras-e-reformas`. Não é a mesma string (item
  33, bloqueado), então não sai junto.
- **Itens 20, 25, 28 e 57** — o texto atual é quebrado por um `<br />` no meio do JSX. O texto novo
  é uma frase única: a implementação remove a tag junto com a troca. É a única marcação tocada em
  toda a lista.
- **Item 63** — o parágrafo fica **fora** do container dos três boxes de demanda
  (`role="group" aria-label="Tipo de demanda"`, `ContactForm.tsx:143`), então a troca não esbarra
  na decisão do João de 20/08 de congelar os boxes.

---

## Rejeitados pelo filtro

| # | Motivo | Categoria |
|---|---|---|
| 2 | Renomear o serviço HVAC exige trocar `nome` em `lib/servicos.ts:105`, que alimenta `buildDirectWhatsAppUrl(servico.nome)` e entra na mensagem enviada ao WhatsApp. | funcionalidade |
| 3 | CTA contextual por página exige criar prop em `components/Contato.tsx`, que hoje não recebe nenhuma. | estrutura |
| 4 | Rodapé completo depende de razão social, CNPJ, horário, áreas atendidas, LinkedIn, responsabilidade técnica e política de privacidade — dados cadastrais que só o cliente tem. | bloqueado |
| 5 | Substituir "equipe própria" por "gestão e núcleo técnico próprios com parceiros homologados" depende da decisão do cliente sobre o modelo de operação. | bloqueado (modelo de operação) |
| 6 | A auditoria manda **manter** o H1 do hero da Home, e ele está literal em `components/Hero.tsx:29-31`. Nada a fazer. | já feito |
| 8 | O texto atual citado ("Falar com especialista") não existe no repositório desde 20/08 (commit `a4b6669`); hoje é "Solicitar atendimento", e trocá-lo exige mudar também a mensagem enviada em `lib/whatsapp.ts:58`. | não localizado |
| 9 | Nota metodológica dos quatro indicadores depende de período-base, critério do "100%" e fonte interna; e `components/Stats.tsx:16-19` não tem slot para asterisco nem rodapé. | bloqueado |
| 10 | A resposta proposta duplica a da dor 1 (`lib/content.ts:27`); aplicar exige reescrever também aquela linha, e a auditoria não fornece texto para ela. | estrutura |
| 16 | Definir contrato x spot exige campo novo no objeto `RECORRENTE_SPOT` e mudança no JSX de `components/home/RecorrenteSpot.tsx` — não há slot para o parágrafo. | estrutura |
| 17 | Case na Home cita faturamento (R$ 16 bi/ano) e 1.600+ lojas; depende de autorização escrita do cliente. | bloqueado |
| 18 | O H2 "Gestão própria. Responsabilidade central." é a mesma decisão do item 5 e, sozinho, contradiz a pílula "Equipe própria treinada" logo abaixo (`lib/content.ts:67`). | bloqueado (modelo de operação) |
| 21 | A auditoria não diz se "A Manfac" vira o `label` da seção ou o H2, e o texto proposto é o parágrafo 1 atual com uma palavra trocada. | estrutura |
| 22 | Descrição institucional passa a afirmar núcleo próprio + parceiros e SLA acordado; depende do modelo de operação e da existência de SLA formal. | bloqueado (modelo de operação) |
| 26 | Uma única frase proposta para dois cards distintos ("Gestão ativa" e "Proatividade"); aplicar literal duplica o texto ou apaga a distinção entre os cards. | estrutura |
| 29 | Introdução de `/servicos` passa a citar "núcleo técnico próprio e especialistas complementares"; mesma dependência do item 22. | bloqueado (modelo de operação) |
| 30 | O campo `sub` é compartilhado entre os cards de `/servicos` e o hero das 4 subpáginas (`components/ServicePage.tsx:40`); atender ao item exigiria separar o campo em dois. | estrutura |
| 31 | Sete blocos novos de página (segmentos, FAQ, indicadores, case, CTA por demanda) — criação de seção, com justificativa de cobertura semântica. | SEO |
| 32 | "Apresentar minha demanda" só em `/servicos` exige prop de CTA no `Contato`, compartilhado por 8 rotas. | estrutura |
| 33 | Abandonar a promessa "sem paralisar a operação do cliente", que é o gancho do hero, é decisão comercial do cliente. | bloqueado |
| 34 | Manter ou não "hospitais" depende de validação de capacidade, cases e requisitos aplicáveis. | bloqueado |
| 35 | O texto novo remove "execução com equipe própria e supervisão técnica" de `comoExecutamos`; é a decisão do modelo de operação. | bloqueado (modelo de operação) |
| 36 | +R$800 mil/mês e 400+ unidades exigem período, escopo e autorização; a nota de rodapé pedida não tem slot em `components/ServicePage.tsx:87-92`. | bloqueado |
| 39 | O texto novo troca "equipe técnica própria" por coordenação de fornecedores. | bloqueado (modelo de operação) |
| 40 | "Centros de distribuição" exige experiência comprovada. | bloqueado |
| 41 | O texto novo passa a dizer "coordenamos execução, suprimentos e especialistas", no lugar de "execução com equipe própria". | bloqueado (modelo de operação) |
| 42 | Manda remover indicadores até haver dado próprio de construção, a ser validado internamente. | bloqueado |
| 44 | A subheadline nova troca "equipe técnica própria" por "equipe definida conforme a operação". (O H1, a auditoria manda manter — e está mantido.) | bloqueado (modelo de operação) |
| 45 | "Ambientes críticos" exige validar competências, cobertura e cases. | bloqueado |
| 46 | O texto novo afirma acompanhamento de backlog, aging, cumprimento de prazo e causas de reabertura — capacidades que não aparecem no site e precisam ser confirmadas pela Manfac. | bloqueado |
| 47 | +1.000 OS/mês, 100% e 400+ unidades exigem elegibilidade, backlog, cancelamentos, período e fonte. | bloqueado |
| 49 | CTA por serviço exige campo novo em `ServicoData`; o FAQ de sete perguntas é seção que não existe em `components/ServicePage.tsx`. | estrutura |
| 50 | Abandonar "Energia dentro do orçamento", metade do H1 e gancho comercial da página, é decisão do cliente. | bloqueado |
| 52 | "Ambientes técnicos" só com capacidade comprovada. | bloqueado |
| 53 | PMOC, responsável técnico, ART/TRT e renovação de ar dependem de a Manfac oferecer e comprovar. | bloqueado |
| 54 | Condicionar "SLA garantido" a contrato é decisão comercial do cliente. | bloqueado |
| 55 | Manda remover indicadores até existir métrica de HVAC. | bloqueado |
| 56 | CTA por serviço (campo novo) + FAQ (seção nova) + campos novos de formulário — este último é CRO. | estrutura |
| 58 | Faturamento de R$ 16 bi e 1.600+ unidades exigem fonte, data e autorização documentadas. | bloqueado |
| 60 | "18 meses" exige marco inicial, marco final e aprovação do cliente; "dashboard ao vivo" exige confirmar qual ferramenta sustenta a promessa. | bloqueado |
| 61 | Cada KPI precisa de período, definição e denominador; o depoimento sem autor precisa de nome, cargo e autorização. | bloqueado |
| 62 | "Ver como aplicar este modelo à minha operação" no CTA compartilhado mudaria 8 rotas; exige parametrizar o bloco por rota. | estrutura |
| 64 | "Avaliação técnica" é chave em `DEMAND_PATHS` (`lib/whatsapp.ts:11,17`) e valida `site_leads.path` em runtime; renomear é migração de dado. Além disso o João congelou os três boxes em 20/08. | funcionalidade |
| 65 | Todos os campos-base pedidos já existem em `components/ContactForm.tsx` desde a reescrita de 21/08; prazo/urgência e anexo são campos novos, fora do filtro. | já feito |
| 66 | Depende do documento de política de privacidade (para existir página e link) e de validação jurídica do texto de consentimento. | bloqueado |
| 37 (metade CTA) | "Apresentar obra ou reforma" exige campo de CTA por serviço; só a metade `spot` entrou. | estrutura |
| 38 (metade nome + URL) | Renomear para "Construções corporativas" mexe no `nome` que alimenta a mensagem do WhatsApp e em três rótulos hardcoded; a troca de URL com 301 é SEO. Só o H1 entrou. | funcionalidade |
| 43 (metade CTA) | "Avaliar projeto de nova unidade" exige campo de CTA por serviço; só a metade `spot` entrou. | estrutura |

---

## Ocorrências duplicadas

Uma única string aprovada aparece em mais de um arquivo. **Trocar as duas juntas** — mudar só uma
deixa menu e rodapé chamando a mesma página por nomes diferentes.

| Item | Ocorrência | Arquivo:linha | Natureza |
|---|---|---|---|
| 1 | `{ href: '/resultados', label: 'Resultados' },` | `manfac-site/lib/content.ts:7` | menu do topo (`NAV_ITEMS`) |
| 1 | `{ href: '/resultados', label: 'Resultados' },` | `manfac-site/components/Footer.tsx:16` | rodapé, lista institucional |
| 1 | `;['Início', 'Quem somos', 'Serviços', 'Resultados', 'Contato'].forEach((label) => {` | `manfac-site/components/__tests__/Header.test.tsx:9` | **teste** que assere o rótulo antigo — quebra se não for atualizado junto (não é copy de página, é manutenção do teste) |

Duas ocorrências de "Resultados" **não** entram na troca:

- `manfac-site/app/resultados/page.tsx:9` — `title: 'Resultados — Manfac Engenharia'` é metadado
  (SEO), fora desta rodada;
- `manfac-site/components/Case.tsx:6` — `label="Resultados"` está em componente **não renderizado
  por nenhuma rota** (código morto).

A rota `/resultados` **não muda**. Só o rótulo.

Nenhuma outra string da tabela de aprovados aparece duas vezes: as demais foram conferidas por
busca literal em todo o `manfac-site/` e retornaram ocorrência única. O parágrafo do item 19 é uma
string só, em um arquivo só, mas renderizada em 8 rotas — não é duplicata, é componente
compartilhado.

---

## Resumo

**Entraram:** 22 itens da auditoria, em 26 alterações de string.
**Ficaram fora:** 44 itens (dos quais 2 apenas porque já estão feitos) mais 3 metades de itens
parcialmente aprovados.

### Rejeições por categoria

| Categoria | Qtd. | Itens |
|---|---:|---|
| bloqueado | 22 | 4, 9, 17, 22, 29, 33, 34, 36, 40, 42, 45, 46, 47, 50, 52, 53, 54, 55, 58, 60, 61, 66 |
| bloqueado (modelo de operação) | 6 | 5, 18, 35, 39, 41, 44 |
| estrutura | 10 (+2 metades) | 3, 10, 16, 21, 26, 30, 32, 49, 56, 62; metades de 37 e 43 |
| funcionalidade | 2 (+1 metade) | 2, 64; metade `nome`/URL de 38 |
| SEO | 1 | 31 |
| CRO | 0 | — nenhum item era só CRO: o único pedido desse tipo (campos novos de formulário) veio grudado em estrutura, no item 56 |
| não localizado | 1 | 8 |
| já feito | 2 | 6, 65 |

Soma: 22 + 6 + 10 + 2 + 1 + 0 + 1 + 2 = **44 itens**, mais **3 metades** — 47 linhas na tabela de
rejeitados.

A categoria **bloqueado (modelo de operação)** é a única fora da lista original de categorias.
Ela existe porque o dono do projeto tirou desta rodada, em separado, tudo que dependa da decisão
equipe própria x parceiros — sem ela, esses seis itens seriam confundidos com os bloqueios de
número e autorização, que se resolvem por outro caminho.

### Arquivos que serão tocados

| Arquivo | Alterações |
|---|---:|
| `manfac-site/lib/servicos.ts` | 6 |
| `manfac-site/lib/content.ts` | 4 |
| `manfac-site/components/Resultados.tsx` | 3 |
| `manfac-site/components/home/ServicosTeaser.tsx` | 3 |
| `manfac-site/components/QuemSomos.tsx` | 2 |
| `manfac-site/components/Time.tsx` | 2 |
| `manfac-site/components/Abordagem.tsx` | 1 |
| `manfac-site/components/ContactForm.tsx` | 1 |
| `manfac-site/components/Contato.tsx` | 1 |
| `manfac-site/components/Footer.tsx` | 1 |
| `manfac-site/components/Hero.tsx` | 1 |
| `manfac-site/components/Servicos.tsx` | 1 |
| **Total** | **26** |

Fora da contagem de copy, um arquivo de teste acompanha o item 1:
`manfac-site/components/__tests__/Header.test.tsx:9`.

### Itens que a triagem marcou PROCEDE e este filtro rejeitou

| # | Triagem | Motivo da rejeição aqui |
|---|---|---|
| 5 | PROCEDE (lote A) | É a decisão de modelo de operação (equipe própria x parceiros), explicitamente fora desta rodada. |
| 18 | PROCEDE (lote A) | Mesma decisão do item 5; a triagem já dizia que os dois têm de andar juntos. |
| 35 | PROCEDE (lote C) | O texto novo remove "equipe própria" de `comoExecutamos` — mesma decisão do item 5. |
| 39 | PROCEDE (lote C) | O texto novo troca "equipe técnica própria" por coordenação de fornecedores. |
| 41 | PROCEDE (lote C) | O texto novo passa a citar "especialistas" no lugar de "equipe própria". |
| 44 | PROCEDE (lote C) | A subheadline nova troca "equipe técnica própria" por "equipe definida conforme a operação". |
| 38 (metade `nome`) | PROCEDE (parte) (lote C) | `nome` alimenta a mensagem do WhatsApp via `ServicePage.tsx:42` — é fluxo, não copy. O H1 do item foi aprovado. |

A triagem do lote C registrou explicitamente que a alegação "equipe própria" **não** bloqueia
sozinha. O corte aqui é mais rígido de propósito: o dono do projeto tirou desta rodada tudo que
dependa da decisão equipe própria x parceiros, e esses seis itens dependem — cada um deles remove
ou substitui a afirmação. Nenhum deles se perde: voltam inteiros na rodada que resolver o modelo
de operação, que também destrava os itens 22 e 29.
