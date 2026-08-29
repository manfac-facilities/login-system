# Triagem de copy — Lote B: `/quem-somos` e `/servicos`

**Fonte:** `docs/cliente/2026-08-29-auditoria-copy-seo-cro.md`, linhas 2216–2319 (itens **20 a 32**).
Contexto adicional lido nas seções **7.3 Quem Somos** (linha 533) e **7.4 Hub de Serviços** (linha 625) do mesmo arquivo.
**Mapa de apoio:** `docs/superpowers/notas/2026-08-29-inventario-copy.md`.

**Nada foi alterado em `manfac-site/`.** Esta nota é só triagem.

## Fato apurado antes de julgar: a auditoria é de 05/08 e o site mudou em 20/08

Rodei `git log --since=2026-08-01` sobre todos os arquivos deste lote
(`QuemSomos.tsx`, `Abordagem.tsx`, `Diferencial.tsx`, `Time.tsx`, `Servicos.tsx`,
`lib/servicos.ts`, `Contato.tsx`). O único commit é `626c449`
*fix(manfac-site): correcoes do code review da frente A* (20/08), e o diff dele **não
toca em uma única linha de copy** deste lote — mexe em `pt-20` no hero de
`/quem-somos`, na classe `btn-pump` do CTA e em acessibilidade.

**Consequência:** nenhum item deste lote é *JÁ FEITO*. Todos os "Texto atual" citados
pela auditoria foram conferidos linha a linha no código e **continuam literais** no
repositório hoje.

## Tabela de vereditos

| # | Veredito | Evidência (arquivo:linha + texto atual literal) | Observação |
|---|---|---|---|
| 20 | **PROCEDE** | `manfac-site/components/QuemSomos.tsx:34-38` — `<h1 …>Engenharia que vai<br />além da obra.</h1>` | Troca de H1 isolada, sem dependência de dado externo nem de outro componente. |
| 21 | **DISCUTÍVEL** | Rótulo em `manfac-site/components/QuemSomos.tsx:50` — `<BlueprintSection index="01" label="Nossa missão">`; H2 em `QuemSomos.tsx:53-56` — "Especialistas na gestão e execução de obras, reformas e manutenção predial para grandes operações."; parágrafo 1 em `QuemSomos.tsx:57-62` | A proposta não diz se "A Manfac" vira o `label` (que é um rótulo mono minúsculo, não um heading — ver `BlueprintSection.tsx:29`) ou o H2, e o texto proposto quase duplica o parágrafo 1 já existente. Ver seção detalhada. |
| 22 | **BLOQUEADO** | `manfac-site/components/QuemSomos.tsx:57-62` — "A Manfac é uma empresa de engenharia especializada em manutenção predial, obras e reformas corporativas para grandes operações. Atuamos com equipe própria, gestão ativa e visibilidade em campo para empresas que precisam de previsibilidade, padrão técnico e resposta rápida em múltiplas unidades." | Falta a Manfac confirmar o modelo operacional declarado e a existência de SLA formal. Ver seção detalhada. |
| 23 | **PROCEDE** | `manfac-site/components/QuemSomos.tsx:63-67` — "Enquanto o mercado divide engenharia em contratos isolados, a Manfac entrega um modelo único: do diagnóstico à conclusão, com um time que conhece cada detalhe da sua demanda." | Substituição direta do parágrafo 2; mas o "responsabilidade total" citado no item sobra em `QuemSomos.tsx:68-71` sem texto proposto — ver "Lacunas de cobertura". |
| 24 | **PROCEDE** | `manfac-site/lib/content.ts:76-79` (`PILARES[0]`) — título "Gestão ativa, não reativa", descrição "Cada obra e chamado fazem parte de um plano maior. Acompanhamos de perto, ajustamos quando necessário e respondemos por tudo." | Constante **viva**: importada em `QuemSomos.tsx:4` e renderizada em `QuemSomos.tsx:75-85`. Não é a parte morta do arquivo. |
| 25 | **PROCEDE** | `manfac-site/components/Abordagem.tsx:26-28` — `<h2 …>Do diagnóstico à entrega —<br />sem buracos no meio do caminho.</h2>` | O rótulo da seção ("Nossa abordagem", `Abordagem.tsx:8`) não muda; só o H2. |
| 26 | **DISCUTÍVEL** | `manfac-site/components/Diferencial.tsx:44` — "Não deixamos a operação rodar sozinha. Acompanhamos, ajustamos e **garantimos o resultado**." e `Diferencial.tsx:48` — "**Antecipamos problemas antes que virem crise.** Agimos, não reagimos." | A auditoria dá **uma** frase para substituir **dois** cards distintos. Ver seção detalhada. |
| 27 | **PROCEDE** | `manfac-site/components/Time.tsx:13-15` — `<h2 …>Uma equipe que trata sua operação como se fosse dela.</h2>`; `Time.tsx:59-61` — "Presença ativa. Comunicação direta. Entrega garantida." | Mapeamento 1-para-1: a 1ª frase proposta cai no H2, a 2ª no card sobre a foto. |
| 28 | **PROCEDE** | `manfac-site/components/Servicos.tsx:32-36` — `<h1 …>Tudo que sua infraestrutura precisa.<br />Uma equipe. Um único ponto de responsabilidade.</h1>` | H1 hardcoded no componente; troca isolada. |
| 29 | **BLOQUEADO** | `manfac-site/components/Servicos.tsx:37-40` — "Obras, reformas, novas construções, manutenção predial e climatização — com equipe técnica própria e responsabilidade total do início ao fim." | Mesma dependência do #22: o texto novo troca "equipe técnica própria" por "núcleo técnico próprio e especialistas complementares". Ver seção detalhada. |
| 30 | **DISCUTÍVEL** | Campo `sub` de cada serviço: `manfac-site/lib/servicos.ts:26`, `:52`, `:80`, `:107`; renderizados em `manfac-site/components/Servicos.tsx:73`. Textos atuais: "Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar a operação do cliente." / "Gestão completa de novas construções: do planejamento à entrega, com equipe técnica própria em campo, cronograma real e comunicação recorrente." / "Menos emergências, mais previsibilidade — equipe técnica própria, rotina de chamados e relatório mensal de cada demanda." / "Instalação, manutenção e gestão de sistemas HVAC com plano preventivo dedicado e técnicos especializados." | O mesmo campo `sub` é o subtítulo do hero das 4 subpáginas (`manfac-site/components/ServicePage.tsx:40`). Ver seção detalhada. |
| 31 | **FORA DE ESCOPO (SEO)** | Confirmado: a página é só hero + cards + CTA — `manfac-site/app/servicos/page.tsx:17-28` (`<Servicos />` + `<Contato />`) e `manfac-site/components/Servicos.tsx:88-90` (fim do componente, nada depois dos cards) | Não é reescrita de copy: é criação de sete blocos novos, justificada pela própria auditoria como "cobertura semântica" e "distribui autoridade". Dois dos blocos ("Indicadores e provas validados", "Case relacionado") ainda dependeriam de validação do cliente. |
| 32 | **DISCUTÍVEL** | `manfac-site/components/Contato.tsx:30` — `AGENDAR CONVERSA TÉCNICA` | O componente é compartilhado por 5 rotas. Ver seção detalhada. |

---

## Itens que exigem mais que uma linha

### #21 — "Título: A Manfac" não tem destino definido no código

O bloco institucional de `/quem-somos` tem **três** elementos de texto de topo, não dois:

1. o `label` da `BlueprintSection` (`QuemSomos.tsx:50`, `label="Nossa missão"`), que
   `BlueprintSection.tsx:29` renderiza como um `<p>` mono, `text-xs`, laranja — um
   rótulo de seção, **não um heading**;
2. o H2 real (`QuemSomos.tsx:53-56`), hoje com uma frase de posicionamento de duas linhas;
3. o parágrafo 1 (`QuemSomos.tsx:57-62`).

A copy proposta ("Título: A Manfac. Texto: A Manfac é uma empresa de engenharia
especializada em manutenção predial, obras e reformas corporativas para redes e
operações com múltiplas unidades.") não diz em qual dos dois primeiros "A Manfac"
entra, e o "Texto" proposto é o parágrafo 1 atual com uma única alteração
("grandes operações" → "redes e operações com múltiplas unidades").

**Objeção:** aplicar "A Manfac" no H2 troca um heading descritivo — que é o mais forte
sinal semântico da página — por um nome de duas palavras.
**Recomendação:** aplicar "A Manfac" no `label` (`QuemSomos.tsx:50`), preservar o H2, e
tratar a alteração do parágrafo como parte do #22. Confirmar com a auditoria antes de
implementar.

### #22 e #29 — dependem de uma decisão de posicionamento, não de redação

Ambos substituem a afirmação **"equipe própria" / "equipe técnica própria"** por
**"gestão e núcleo técnico próprios … parceiros especializados quando necessário"**
(#22) e **"núcleo técnico próprio e especialistas complementares conforme o escopo"**
(#29), e ambos passam a citar **"o SLA acordado"**.

A própria auditoria trata isso como item **global** e de prioridade **Crítica** (seção
7.1, "Prova operacional", linhas ~310-317: *"os materiais comerciais também registram
gestão de serviços terceirizados complementares [I1] e parceiros especializados [I2]"*).

**O que falta para desbloquear (uma resposta só, vale para os dois itens e para o site
inteiro):**

1. A Manfac opera com equipe 100% própria, ou com núcleo próprio + parceiros/terceiros
   homologados? A resposta muda copy em pelo menos 6 pontos fora deste lote
   (`lib/servicos.ts:26`, `:52`, `:80`, `components/home/ServicosTeaser.tsx`, etc.).
2. Existe SLA formal contratado, com prazos por criticidade, que possa ser citado na
   página institucional?

Enquanto isso não vier da empresa, implementar é afirmar um modelo operacional que o
Claude não tem como verificar.

### #26 — uma frase proposta para dois cards diferentes

`components/Diferencial.tsx` renderiza 5 cards, cada um com título vindo de
`lib/content.ts:127-133` e descrição de `Diferencial.tsx:43-49`. Os dois trechos
citados pela auditoria estão em cards **distintos**:

- card 1, "Gestão ativa e estruturada" (`lib/content.ts:128`) → descrição em
  `Diferencial.tsx:44`, que contém "garantimos o resultado";
- card 5, "Proatividade na resolução de problemas" (`lib/content.ts:132`) → descrição em
  `Diferencial.tsx:48`, que contém "Antecipamos problemas antes que virem crise".

**Objeção:** a auditoria entrega uma frase única para os dois. Aplicá-la literalmente ou
duplica o mesmo texto em dois cards, ou apaga a distinção entre "gestão" e
"proatividade" — que é a razão de existirem dois cards.
**Recomendação:** pedir à auditoria a divisão por card antes de implementar. Há ainda um
terceiro absoluto **não citado pelo item** e do mesmo tipo: "Transparência total" /
"Nada fica escondido" (`lib/content.ts:129` + `Diferencial.tsx:45`).

### #30 — o texto dos cards é compartilhado com as subpáginas (lote de outro agente)

O campo `sub` de `lib/servicos.ts` tem **dois consumidores**:

- `components/Servicos.tsx:73` — o card de resumo no hub `/servicos` (alvo deste item);
- `components/ServicePage.tsx:40` — o **subtítulo do hero** de cada
  `/servicos/[slug]`.

**Objeção:** trocar `sub` para atender ao #30 reescreve, sem querer, o hero das quatro
subpáginas, que são objeto dos itens **33 em diante** — outro lote. Os dois lotes
podem propor textos diferentes para a mesma string.
**Recomendação:** ou separar o campo em dois (`sub` do card × `heroSub` da subpágina)
antes de aplicar qualquer copy, ou coordenar #30 com os itens 33+ numa alteração única.
Enquanto isso não estiver decidido, não implementar.

Nota: os cards do hub **não** leem `SERVICOS` de `lib/content.ts:97-118` — essa
constante é copy morta (nenhum import em todo o `manfac-site`, verificado por grep). O
item aponta corretamente para os textos vivos, então não é caso de NÃO SE APLICA.

### #32 — mudar esse CTA muda o site inteiro

`components/Contato.tsx` é importado por cinco rotas: `app/page.tsx:11`,
`app/quem-somos/page.tsx:8`, `app/servicos/page.tsx:4`, `app/resultados/page.tsx:4` e
`components/ServicePage.tsx:3` (que serve as 4 subpáginas de serviço).

**Objeção:** o item pede "Apresentar minha demanda" só em `/servicos`, mas o texto vive
num componente sem prop de CTA — a edição pontual em `Contato.tsx:30` trocaria o botão
em todas as páginas, inclusive as que o item 19 (outro lote) e a seção 7.1 querem com
textos próprios ("Solicitar avaliação da operação", "Apresentar obra ou reforma", etc.).
**Recomendação:** não tratar como edição de copy. Tratar como o item global de
**CTA contextual** da seção 7.1: adicionar props de texto ao `Contato` e resolver os
cinco CTAs numa tacada só, com a lista completa aprovada pelo João.

## Lacunas de cobertura da auditoria neste lote

Trechos com o mesmo defeito que a auditoria aponta, mas **sem texto substituto
proposto** — quem implementar vai deixar contradições no ar:

- `components/QuemSomos.tsx:68-71` — "Nosso compromisso é que cada cliente tenha mais
  controle, mais clareza e mais confiança na execução — com **responsabilidade total do
  início ao fim**." O item #23 cita "responsabilidade total" no diagnóstico, mas o texto
  novo cobre apenas o parágrafo 2 (`:63-67`).
- `components/Diferencial.tsx:45` — "Nada fica escondido…" sob o título
  "Transparência total" (`lib/content.ts:129`), mesmo tipo de absoluto do #26.
- `components/Diferencial.tsx:81` — citação "Não escondemos problemas. Assumimos,
  tratamos e evoluímos continuamente." Não aparece em nenhum item do lote.

## Resumo do lote

**13 itens triados (20 a 32).**

| Veredito | Qtd. | Itens |
|---|---|---|
| JÁ FEITO | 0 | — |
| PROCEDE | 6 | 20, 23, 24, 25, 27, 28 |
| BLOQUEADO | 2 | 22, 29 |
| DISCUTÍVEL | 4 | 21, 26, 30, 32 |
| NÃO SE APLICA | 0 | — |
| FORA DE ESCOPO (SEO) | 1 | 31 |

### BLOQUEADOS e o dado que falta

- **#22** (`components/QuemSomos.tsx:57-62`) e **#29**
  (`components/Servicos.tsx:37-40`) — bloqueados pela **mesma** pergunta à Manfac:
  1. o modelo declarado é equipe 100% própria ou núcleo técnico próprio + parceiros
     especializados homologados?
  2. existe SLA formal contratado que possa ser citado publicamente?

  Uma única resposta destrava os dois — e é pré-requisito do item global "Prova
  operacional" (seção 7.1 da auditoria), que a auditoria classifica como Crítico.
