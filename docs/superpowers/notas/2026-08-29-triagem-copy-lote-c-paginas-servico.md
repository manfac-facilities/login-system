# Triagem de copy — Lote C: as 4 páginas de serviço

**Data:** 2026-08-29
**Fonte:** `docs/cliente/2026-08-29-auditoria-copy-seo-cro.md`, itens **33 a 56** (linhas 2321–2512),
com o contexto detalhado das seções **7.5 a 7.8** (linhas 687–974) do mesmo arquivo.
**A auditoria é de 05/08/2026** — todo "texto atual" descrito por ela foi reconferido no código em 29/08.
**Nada foi implementado.** Nenhum arquivo de `manfac-site/` foi tocado.

## Onde a copy desse lote mora

As quatro páginas não têm arquivo próprio: `app/servicos/[slug]/page.tsx` resolve o slug
(`app/servicos/[slug]/page.tsx:36-49`) e renderiza `components/ServicePage.tsx` com o objeto
vindo de `lib/servicos.ts`.

| Tipo de texto | Arquivo | Custo da alteração |
|---|---|---|
| Toda a copy variável por serviço (`headline`, `sub`, `paraQuem`, `dores`, `escopo[]`, `comoExecutamos`, `indicadores[]`, `recorrente`, `spot`, `metaTitle`, `metaDescription`) | `manfac-site/lib/servicos.ts:21-129` | baixo — string em objeto de dados |
| Rótulos fixos e estrutura ("Serviços · ", "Para quem é", "Dores que resolve", "Escopo", "Como executamos", "Como contratar", "Contrato recorrente", "Demanda spot") e o CTA do hero | `manfac-site/components/ServicePage.tsx:34-135` | médio — muda as 4 páginas de uma vez |
| CTA final ("AGENDAR CONVERSA TÉCNICA") | `manfac-site/components/Contato.tsx:30` | alto — componente compartilhado com o site inteiro |

**Consequência que atravessa vários itens:** qualquer CTA **por serviço** exige campo novo em
`ServicoData` (`lib/servicos.ts:1-19`) e troca do literal em `ServicePage.tsx:48`. Hoje as 4 páginas
mostram o mesmo botão. E **não existe nenhuma seção de FAQ** em `ServicePage.tsx` (138 linhas;
grep por "faq"/"pergunta" em toda a `manfac-site/` não retorna nada): FAQ é feature nova, não
edição de copy.

## Critério usado para BLOQUEADO

Bloqueia quando executar o item exige (a) número/dado que só a Manfac tem, (b) confirmação de
capacidade ou segmento atendido (hospitais, ambientes críticos, centros de distribuição, PMOC),
ou (c) desistir de uma **garantia que hoje é o gancho comercial da página**.
A alegação "equipe própria" **não** bloqueia sozinha: a própria auditoria (seção 7.1, "Prova
operacional") cita material interno [I1]/[I2] registrando terceirizados e parceiros — trocá-la é
implementável; fica como ponto a confirmar, não como bloqueio.

---

## /servicos/obras-e-reformas (itens 33–37)

| # | Veredito | Evidência (`arquivo:linha`) | Observação |
|---|---|---|---|
| 33 | **BLOQUEADO** | `lib/servicos.ts:25` — `headline: 'Obras e reformas corporativas com escopo, cronograma, equipe própria e acompanhamento de ponta a ponta.'` · `lib/servicos.ts:26` — `sub: 'Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar a operação do cliente.'` · a mesma promessa se repete na `metaDescription`, `lib/servicos.ts:46` | A troca abandona a promessa **"sem paralisar a operação do cliente"**, que hoje é o gancho do hero e da meta description — precisa do aval da Manfac antes de sair do ar. |
| 34 | **BLOQUEADO** | `lib/servicos.ts:27` — `paraQuem: 'Empresas com unidades corporativas, redes de varejo, escritórios, galpões e hospitais que precisam reformar, adequar ou expandir sem interromper a operação.'` | A auditoria condiciona explicitamente: manter **hospitais** só "após validação de capacidade, cases e requisitos aplicáveis". |
| 35 | **PROCEDE** | `lib/servicos.ts:36` — `comoExecutamos: 'Planejamento com escopo fechado, cronograma real e orçamento definido; execução com equipe própria e supervisão técnica; comunicação recorrente com registro fotográfico até a entrega.'` | O texto novo **reduz** promessa ("escopo fechado" vira escopo-base com mudanças aprovadas); o bullet `lib/servicos.ts:32` ("Cumprimento de normas técnicas e exigências legais") cai no mesmo item e precisa de decisão à parte. |
| 36 | **BLOQUEADO** | `lib/servicos.ts:37-40` — `{ value: '+R$800 mil', label: 'em obras e reformas por mês' }` e `{ value: '400+', label: 'unidades atendidas no RJ' }` | Precisa validar **período, escopo e autorização** dos dois números; além disso `ServicePage.tsx:87-92` renderiza só `value` + `label`, sem lugar para o asterisco e a nota metodológica que a auditoria exige. |
| 37 | **DISCUTÍVEL** | `lib/servicos.ts:42` — `spot: 'Reformas, expansões e adequações maiores viram proposta técnica avulsa, com escopo, cronograma e orçamento fechados.'` · CTA em `ServicePage.tsx:48` ("Solicitar proposta técnica") e `Contato.tsx:30` ("AGENDAR CONVERSA TÉCNICA") | A metade do `spot` é troca direta de string, mas a metade do CTA ("Apresentar obra ou reforma") não existe por página hoje — recomendo aplicar o `spot` agora e tratar CTA contextual como um item único junto de 43, 49 e 56. |

## /servicos/novas-construcoes (itens 38–43)

| # | Veredito | Evidência (`arquivo:linha`) | Observação |
|---|---|---|---|
| 38 | **PROCEDE** (parte) | `lib/servicos.ts:50` — `nome: 'Novas Construções'` · `lib/servicos.ts:51` — `headline: 'Do zero à entrega das chaves — prazo e custo sob controle.'` · rótulo repetido em `components/Header.tsx:14` e `components/home/ServicosTeaser.tsx:130-131` | Nome e H1 são copy e trocam hoje, mas o `nome` sai em quatro lugares (`ServicePage.tsx:35`, `Footer.tsx:66`, `Servicos.tsx:51` e `:71`) e o rótulo do menu está hardcoded; a troca de URL para `/servicos/construcoes-corporativas` com 301 é **FORA DE ESCOPO (SEO)** nesta rodada. |
| 39 | **PROCEDE** | `lib/servicos.ts:52` — `sub: 'Gestão completa de novas construções: do planejamento à entrega, com equipe técnica própria em campo, cronograma real e comunicação recorrente.'` | Troca "gestão completa"/"equipe própria" por linguagem de coordenação; a mesma dupla reaparece na `metaDescription` (`lib/servicos.ts:74`) e deve cair junto. |
| 40 | **BLOQUEADO** | `lib/servicos.ts:53` — `paraQuem: 'Empresas que precisam construir novas unidades, centros de distribuição ou instalações corporativas...'` · `lib/servicos.ts:59` — `'Visibilidade do andamento em tempo real'` | Só **centros de distribuição** trava (exige experiência comprovada); a troca de "tempo real" por status na periodicidade acordada é implementável sozinha e pode ser destacada. |
| 41 | **PROCEDE** | `lib/servicos.ts:62` — `comoExecutamos: 'Planejamento executivo com marcos de entrega; execução com equipe própria e supervisão de engenharia; reuniões de status, cronograma atualizado e evidências de campo em cada fase.'` | O que o texto novo acrescenta (testes, documentação, aceite/comissionamento) já é afirmado hoje em `lib/servicos.ts:60` — não amplia capacidade declarada. |
| 42 | **BLOQUEADO** | `lib/servicos.ts:63-66` — `{ value: '+R$800 mil', label: 'em obras executadas por mês' }` e `{ value: '100%', label: 'das demandas concluídas no mês' }` | Manda **remover** os dois até haver dado próprio de construção (m² entregues, projetos concluídos, aderência ao cronograma) — "necessário validar internamente antes da publicação". |
| 43 | **DISCUTÍVEL** | `lib/servicos.ts:68` — `spot: 'A construção em si é sempre um projeto spot: escopo fechado, cronograma, orçamento e entrega técnica documentada.'` · CTA em `ServicePage.tsx:48` | Tirar o "sempre" é troca direta de string; o CTA "Avaliar projeto de nova unidade" depende do campo novo de CTA por serviço — recomendo separar as duas metades. |

## /servicos/manutencao-predial (itens 44–49)

| # | Veredito | Evidência (`arquivo:linha`) | Observação |
|---|---|---|---|
| 44 | **PROCEDE** | `lib/servicos.ts:80` — `sub: 'Menos emergências, mais previsibilidade — equipe técnica própria, rotina de chamados e relatório mensal de cada demanda.'` | A auditoria manda **manter o H1** (`lib/servicos.ts:79` já é exatamente o texto que ela quer preservar, nada a fazer nessa metade); só a subheadline muda. |
| 45 | **BLOQUEADO** | `lib/servicos.ts:81` — `paraQuem: 'Redes varejistas, operações corporativas e ambientes críticos com múltiplas unidades...'` | Manter **"ambientes críticos"** exige validar competências, cobertura e cases — a auditoria trata como sinalização de capacidade regulada sem prova. |
| 46 | **DISCUTÍVEL** | `lib/servicos.ts:90` — `comoExecutamos: 'Mapeamento das unidades e histórico; rotina preventiva programada; corretiva com SLA e priorização por criticidade; relatório mensal com análise de recorrência para reduzir emergências.'` | O texto novo **acrescenta** capacidades de gestão (backlog, aging, cumprimento de prazo, causas de reabertura) que não aparecem em lugar nenhum do site hoje; recomendo publicar só depois de a Manfac confirmar que esses indicadores existem no relatório mensal. |
| 47 | **BLOQUEADO** | `lib/servicos.ts:91-95` — `{ value: '+1.000', label: 'ordens de serviço por mês' }`, `{ value: '100%', label: 'das demandas concluídas no mês' }`, `{ value: '400+', label: 'unidades sob gestão no RJ' }` | Precisa **definir elegibilidade, backlog, cancelamentos, período e fonte** antes de manter o 100%; vale a mesma limitação estrutural do item 36 (`ServicePage.tsx:87-92` não comporta nota de rodapé). |
| 48 | **PROCEDE** | `lib/servicos.ts:96` — `recorrente: 'É o coração do contrato mensal: preventiva, corretiva e emergencial com SLA, equipe e relatórios.'` · `lib/servicos.ts:97` — `spot: 'Intervenções fora do escopo contratual — trocas de grande porte, adequações — viram proposta técnica específica.'` | A lista de exclusões proposta (sinistro, mau uso, terceiros, condições preexistentes) vem do contrato do cliente citado como [I2] na auditoria — não consegui ler esse documento, então vale conferir a redação contra ele antes de publicar. |
| 49 | **DISCUTÍVEL** | CTA em `ServicePage.tsx:48` e `Contato.tsx:30`; **nenhuma seção de FAQ** em `ServicePage.tsx:19-137` | O CTA "Avaliar minha operação de manutenção" é implementável com o campo novo; as sete perguntas de FAQ são bloco novo de página, não edição de copy — recomendo tirar o FAQ desta rodada e tratá-lo como feature. |

## /servicos/hvac (itens 50–56)

| # | Veredito | Evidência (`arquivo:linha`) | Observação |
|---|---|---|---|
| 50 | **BLOQUEADO** | `lib/servicos.ts:106` — `headline: 'Climatização funcionando. Energia dentro do orçamento.'` | Metade do H1 é a promessa financeira **"Energia dentro do orçamento"**; abandoná-la é decisão comercial da Manfac, não ajuste redacional. |
| 51 | **PROCEDE** | `lib/servicos.ts:107` — `sub: 'Instalação, manutenção e gestão de sistemas HVAC com plano preventivo dedicado e técnicos especializados.'` | O que o texto novo cita (split, VRF/VRV, centrais) já está afirmado hoje em `lib/servicos.ts:111` — não amplia capacidade declarada. |
| 52 | **BLOQUEADO** | `lib/servicos.ts:108` — `paraQuem: 'Operações onde climatização parada significa perda direta: lojas, escritórios, ambientes técnicos e áreas de atendimento ao público.'` | Manter **"ambientes técnicos"** só com capacidade comprovada — a auditoria quer evitar a leitura de data center, sala limpa e hospital. |
| 53 | **BLOQUEADO** | `lib/servicos.ts:110-116` (nenhum bullet cita PMOC) · `lib/servicos.ts:114` — `'Monitoramento de performance e consumo'` | Incluir **PMOC, responsável técnico, ART/TRT e renovação de ar** depende de a Manfac oferecer e comprovar; note que `comoExecutamos` (`lib/servicos.ts:117`) já diz "acompanhamento de consumo e performance", então só o bullet da linha 114 destoa. |
| 54 | **BLOQUEADO** | `lib/servicos.ts:115` — `'Atendimento de urgência com SLA garantido'` · a mesma expressão na `metaDescription`, `lib/servicos.ts:127` | Abandonar a garantia **"SLA garantido"** e condicioná-la a contrato é o mesmo tipo de decisão comercial do item 50 — precisa de aval. |
| 55 | **BLOQUEADO** | `lib/servicos.ts:118-121` — `{ value: '400+', label: 'unidades atendidas no RJ' }` e `{ value: '100%', label: 'das demandas concluídas no mês' }` | Manda **remover** os dois até existir métrica de HVAC (equipamentos sob plano, aderência preventiva, tempo de resposta, reincidência, economia com linha de base). |
| 56 | **DISCUTÍVEL** | CTA em `ServicePage.tsx:48`; **nenhum FAQ** em `ServicePage.tsx`; formulário em `components/ContactForm.tsx:187-351` (campos hoje: nome, e-mail, telefone, empresa, cargo, localidade, unidades, resumo) | Só o CTA "Avaliar meu parque de climatização" é copy; os campos novos do formulário (quantidade e tipo de equipamentos, PMOC existente, histórico de falhas, anexos) são **FORA DE ESCOPO (CRO)** e o FAQ é feature nova. |

---

## Resumo do lote

**Itens triados:** 24 (33 a 56).

| Veredito | Quantidade | Itens |
|---|---|---|
| BLOQUEADO | **12** | 33, 34, 36, 40, 42, 45, 47, 50, 52, 53, 54, 55 |
| PROCEDE | **7** | 35, 38, 39, 41, 44, 48, 51 |
| DISCUTÍVEL | **5** | 37, 43, 46, 49, 56 |
| JÁ FEITO | 0 | — |
| NÃO SE APLICA | 0 | — |

Metades de item marcadas fora de escopo: **SEO** — troca de URL + 301 no item 38. **CRO** — campos
novos do formulário no item 56. O FAQ pedido em 49 e 56 é bloco de página inexistente hoje
(`ServicePage.tsx` não tem seção de FAQ): é feature, não copy.

### BLOQUEADOS — o que exatamente precisa de validação

| # | Página | O número / promessa que trava |
|---|---|---|
| 33 | obras-e-reformas | Promessa **"sem paralisar a operação do cliente"** (`lib/servicos.ts:26` e `:46`) — aval para abandoná-la |
| 34 | obras-e-reformas | Segmento **hospitais** (`lib/servicos.ts:27`) — capacidade, cases e requisitos aplicáveis |
| 36 | obras-e-reformas | **+R$800 mil/mês** e **400+ unidades** (`lib/servicos.ts:38-39`) — período, escopo e autorização de publicação |
| 40 | novas-construcoes | Segmento **centros de distribuição** (`lib/servicos.ts:53`) — experiência comprovada |
| 42 | novas-construcoes | **+R$800 mil/mês** e **100% das demandas** (`lib/servicos.ts:64-65`) — remover até haver dado próprio de construção |
| 45 | manutencao-predial | Segmento **ambientes críticos** (`lib/servicos.ts:81`) — competências, cobertura e cases |
| 47 | manutencao-predial | **+1.000 OS/mês**, **100%** e **400+ unidades** (`lib/servicos.ts:92-94`) — elegibilidade, backlog, cancelamentos, período e fonte |
| 50 | hvac | Promessa **"Energia dentro do orçamento"** (`lib/servicos.ts:106`) — aval para abandoná-la |
| 52 | hvac | Segmento **ambientes técnicos** (`lib/servicos.ts:108`) — capacidade comprovada |
| 53 | hvac | **PMOC, responsável técnico, ART/TRT, renovação de ar** (ausentes em `lib/servicos.ts:110-116`) — a Manfac oferece e comprova? |
| 54 | hvac | Garantia **"SLA garantido"** (`lib/servicos.ts:115` e `:127`) — aval para condicioná-la a contrato |
| 55 | hvac | **400+ unidades** e **100% das demandas** (`lib/servicos.ts:119-120`) — remover até haver métrica de HVAC |

### Todas as promessas absolutas encontradas no código das 4 páginas

Levantamento completo, independente de a auditoria ter citado ou não. **(*)** = não citada pela auditoria.

**Números sem metodologia** (campo `indicadores`, renderizado em `ServicePage.tsx:87-92`)

| Texto | `arquivo:linha` |
|---|---|
| `+R$800 mil` — "em obras e reformas por mês" | `lib/servicos.ts:38` |
| `400+` — "unidades atendidas no RJ" | `lib/servicos.ts:39` |
| `+R$800 mil` — "em obras executadas por mês" | `lib/servicos.ts:64` |
| `100%` — "das demandas concluídas no mês" | `lib/servicos.ts:65` |
| `+1.000` — "ordens de serviço por mês" | `lib/servicos.ts:92` |
| `100%` — "das demandas concluídas no mês" | `lib/servicos.ts:93` |
| `400+` — "unidades sob gestão no RJ" | `lib/servicos.ts:94` |
| `400+` — "unidades atendidas no RJ" | `lib/servicos.ts:119` |
| `100%` — "das demandas concluídas no mês" | `lib/servicos.ts:120` |

**Promessas de resultado, garantia ou continuidade**

| Texto | `arquivo:linha` |
|---|---|
| "sem paralisar a operação do cliente" | `lib/servicos.ts:26` |
| "sem interromper a operação" **(*)** | `lib/servicos.ts:27` |
| "Relatório semanal de andamento — sem precisar pedir" **(*)** | `lib/servicos.ts:33` |
| "Um ponto de contato responsável do início à entrega" **(*)** | `lib/servicos.ts:34` |
| "escopo fechado, cronograma real e orçamento definido" | `lib/servicos.ts:36` |
| "escopo, cronograma e orçamento fechados" | `lib/servicos.ts:42` |
| "sem paralisar sua operação" (metaDescription) **(*)** | `lib/servicos.ts:46` |
| "Do zero à entrega das chaves — prazo e custo sob controle." | `lib/servicos.ts:51` |
| "Controle rigoroso de cronograma e custo" **(*)** | `lib/servicos.ts:58` |
| "Visibilidade do andamento em tempo real" | `lib/servicos.ts:59` |
| "A construção em si é sempre um projeto spot" | `lib/servicos.ts:68` |
| "cronograma real e custo sob controle" (metaDescription) **(*)** | `lib/servicos.ts:74` |
| "É o coração do contrato mensal" **(*)** | `lib/servicos.ts:96` |
| "Climatização funcionando. Energia dentro do orçamento." | `lib/servicos.ts:106` |
| "Monitoramento de performance e consumo" | `lib/servicos.ts:114` |
| "Atendimento de urgência com **SLA garantido**" | `lib/servicos.ts:115` |
| "SLA garantido" (metaDescription) | `lib/servicos.ts:127` |
| "Retornamos com uma leitura técnica" (CTA final compartilhado) **(*)** | `components/Contato.tsx:22` |

**Alegação de "equipe própria" / internalização** — a auditoria (seção 7.1, "Prova operacional") diz
que material interno [I1]/[I2] registra terceirizados e parceiros especializados:

| Texto | `arquivo:linha` |
|---|---|
| "escopo, cronograma, **equipe própria** e acompanhamento de ponta a ponta" | `lib/servicos.ts:25` |
| "planejamento, **equipe técnica** e gestão próxima" | `lib/servicos.ts:26` |
| "**equipe própria** e acompanhamento de ponta a ponta" (metaDescription) | `lib/servicos.ts:46` |
| "**Gestão completa** de novas construções ... com **equipe técnica própria** em campo" | `lib/servicos.ts:52` |
| "**Gestão completa** do projeto de engenharia" | `lib/servicos.ts:56` |
| "**Equipe técnica própria** com gestão centralizada" | `lib/servicos.ts:57` |
| "execução com **equipe própria** e supervisão de engenharia" | `lib/servicos.ts:62` |
| "**equipe própria**, cronograma real e custo sob controle" (metaDescription) | `lib/servicos.ts:74` |
| "com SLA, **equipe técnica** e visibilidade mensal dos chamados" | `lib/servicos.ts:79` |
| "**equipe técnica própria**, rotina de chamados e relatório mensal" | `lib/servicos.ts:80` |
| "SLA, **equipe técnica própria** e visibilidade mensal" (metaDescription) | `lib/servicos.ts:101` |
| "plano preventivo dedicado e **técnicos especializados**" | `lib/servicos.ts:107` |
| "execução por **técnicos especializados** com registro por visita" | `lib/servicos.ts:117` |

`lib/servicos.ts:36` ("execução com **equipe própria** e supervisão técnica") também pertence a esta
última lista — foi listado acima, na linha de "escopo fechado", por ser o mesmo campo.
