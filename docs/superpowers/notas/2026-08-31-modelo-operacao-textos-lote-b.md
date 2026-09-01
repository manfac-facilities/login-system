# Textos do modelo de operação — lote B (`lib/servicos.ts` + `app/servicos/page.tsx`)

**Data:** 2026-08-31
**Entrada:**
- `docs/cliente/2026-08-31-decisao-modelo-de-operacao.md` — decisão: "gestão e núcleo técnico próprios, com parceiros homologados".
- `docs/superpowers/notas/2026-08-29-copy-lista-final-aprovacao.md` — padrão de redação aprovado (itens 35, 39, 41, 44 listados como PROCEDE, retidos só pela decisão de modelo de operação).
- `docs/cliente/2026-08-29-auditoria-copy-seo-cro.md` — auditoria original, lista mestra (linha 2054+, itens numerados 1–66).

**Nada foi implementado.** Nenhum arquivo de `manfac-site/` foi tocado. Esta é só a proposta de texto.

## Verificação executada

Os 10 "texto ATUAL" abaixo foram lidos diretamente nos arquivos, nas linhas citadas, com a
ferramenta de leitura, e conferidos literalmente contra o conteúdo mostrado. Confirmo que todos
existem exatamente como transcritos — nenhum foi reconstruído de memória ou da auditoria.

## Mapeamento auditoria → pontos (para os 4 que a auditoria já cobria)

| Item da auditoria (lista mestra) | Seção da auditoria | Ponto correspondente |
|---|---|---|
| 33 (1ª frase) | `/servicos/obras-e-reformas` — Hero | `headline` obras, linha 25 (só a 1ª frase; a 2ª frase do item 33 mexe em "sem paralisar", que é decisão comercial separada e **não** está no escopo deste lote) |
| 35 | `/servicos/obras-e-reformas` — Escopo e execução | `comoExecutamos` obras, linha 36 |
| 39 | `/servicos` (auditoria chama de hub, mas o texto bate com a Introdução de `/servicos/novas-construcoes`) | `sub` novas construções, linha 52 |
| 41 | `/servicos/novas-construcoes` — Como executamos | `comoExecutamos` novas construções, linha 62 |
| 44 (subheadline) | `/servicos/manutencao-predial` — Hero | `sub` manutenção predial, linha 80 |

Os itens 35, 39, 41 e 44 eram texto **integral** de substituição (parágrafo inteiro), não troca de
uma palavra — por isso as observações abaixo avisam quando a nova versão deixa de mencionar algo
que a antiga mencionava (cronograma, comunicação recorrente, rotina de chamados etc.), mesmo sem
relação com "equipe própria".

Os outros 6 pontos (bullet da linha 57 e as quatro `metaDescription` + a `description` do
`app/servicos/page.tsx`) **não têm texto correspondente na auditoria** — foram escritos aqui,
seguindo o padrão de troca mínima (só a menção a equipe própria) usado no restante desta rodada.

---

## Tabela de propostas

| Arquivo:linha | Texto ATUAL (literal) | Texto NOVO proposto | Onde aparece | Caracteres (só metaDescription) | Observação |
|---|---|---|---|---|---|
| `manfac-site/lib/servicos.ts:25` | `headline: 'Obras e reformas corporativas com escopo, cronograma, equipe própria e acompanhamento de ponta a ponta.',` | `Obras e reformas corporativas com escopo, cronograma, supervisão técnica e acompanhamento de ponta a ponta.` | H1 do hero de `/servicos/obras-e-reformas` (`components/ServicePage.tsx:38`) | — | Reaproveita literalmente a 1ª frase do item 33 da auditoria. A 2ª frase do item 33 troca a promessa "sem paralisar" — isso é outra decisão (comercial, não de modelo de operação) e fica de fora; o `sub` da linha 26, que carrega essa promessa, não foi tocado. |
| `manfac-site/lib/servicos.ts:36` | `comoExecutamos: 'Planejamento com escopo fechado, cronograma real e orçamento definido; execução com equipe própria e supervisão técnica; comunicação recorrente com registro fotográfico até a entrega.',` | `Planejamento com escopo-base, marcos, responsabilidades e orçamento aprovados; execução conforme normas e documentos aplicáveis; mudanças registradas e aprovadas antes da incorporação ao cronograma e ao custo.` | Bloco "Como executamos" de `/servicos/obras-e-reformas` (`components/ServicePage.tsx:85`) | — | Texto integral do item 35 da auditoria (PROCEDE, só retido pela decisão de modelo). É substituição de parágrafo inteiro: a versão nova **não menciona mais** "comunicação recorrente com registro fotográfico até a entrega" — informação que a antiga tinha e que não depende de equipe própria x parceiros. Se o João quiser manter essa promessa, precisa de uma frase adicional; não inventei uma para não extrapolar o texto da auditoria. |
| `manfac-site/lib/servicos.ts:46` | `metaDescription: 'Obras e reformas corporativas com escopo fechado, cronograma, equipe própria e acompanhamento de ponta a ponta, sem paralisar sua operação.',` | `Obras e reformas corporativas com escopo fechado, cronograma, supervisão técnica e acompanhamento de ponta a ponta, sem paralisar sua operação.` | `<meta name="description">` da rota `/servicos/obras-e-reformas` (não é exibido na página) | 143 | Troca mínima, só a menção a equipe própria. "Sem paralisar sua operação" foi mantido de propósito — é o mesmo item bloqueado por decisão comercial (item 33, 2ª metade / item 50 da auditoria para outra página), fora do escopo desta decisão. |
| `manfac-site/lib/servicos.ts:52` | `sub: 'Gestão completa de novas construções: do planejamento à entrega, com equipe técnica própria em campo, cronograma real e comunicação recorrente.',` | `Coordenamos planejamento, compatibilização, execução, fornecedores e entrega documentada, com gestão central e responsáveis definidos em cada fase.` | Subtítulo do hero de `/servicos/novas-construcoes`, abaixo do H1 (`components/ServicePage.tsx:40`) | — | Texto integral do item 39 da auditoria. Também é substituição de parágrafo: a versão antiga citava "cronograma real e comunicação recorrente" explicitamente; a nova não repete esses termos (cobre implicitamente com "responsáveis definidos em cada fase"). Avaliar se cronograma precisa voltar em algum lugar da página — ele ainda aparece no bullet da linha 58 ("Controle rigoroso de cronograma e custo"), não some da página inteira. |
| `manfac-site/lib/servicos.ts:57` | `'Equipe técnica própria com gestão centralizada',` | `Núcleo técnico próprio com gestão centralizada` | Bullet da lista "Escopo" de `/servicos/novas-construcoes` (`components/ServicePage.tsx:67-71`) | — | Sem texto correspondente na auditoria. Troca mínima de duas palavras, mantendo o resto do bullet e o padrão de vocabulário da formulação aprovada ("núcleo técnico próprio"). |
| `manfac-site/lib/servicos.ts:62` | `comoExecutamos: 'Planejamento executivo com marcos de entrega; execução com equipe própria e supervisão de engenharia; reuniões de status, cronograma atualizado e evidências de campo em cada fase.',` | `Definimos marcos, riscos, interfaces e responsabilidades; coordenamos execução, suprimentos e especialistas; reportamos avanço e desvios; encerramos com testes, documentação e aceite conforme escopo.` | Bloco "Como executamos" de `/servicos/novas-construcoes` (`components/ServicePage.tsx:85`) | — | Texto integral do item 41 da auditoria. A versão antiga citava "reuniões de status, cronograma atualizado e evidências de campo"; a nova fala em "reportamos avanço e desvios" — cobertura mais genérica, sem citar reuniões, cronograma atualizado ou evidências de campo como artefatos específicos. |
| `manfac-site/lib/servicos.ts:74` | `metaDescription: 'Gestão e execução de novas construções do planejamento à entrega das chaves, com equipe própria, cronograma real e custo sob controle.',` | `Gestão e execução de novas construções do planejamento à entrega das chaves, com núcleo técnico próprio, cronograma real e custo sob controle.` | `<meta name="description">` da rota `/servicos/novas-construcoes` | 142 | Troca mínima, só a menção a equipe própria. Mantém "cronograma real e custo sob controle", que a nova `sub` (linha 52) não repete mais — ver observação de contradição abaixo. |
| `manfac-site/lib/servicos.ts:80` | `sub: 'Menos emergências, mais previsibilidade — equipe técnica própria, rotina de chamados e relatório mensal de cada demanda.',` | `Menos emergências e mais previsibilidade, com plano preventivo, atendimento por criticidade, equipe definida conforme a operação e relatórios de desempenho.` | Subtítulo do hero de `/servicos/manutencao-predial`, abaixo do H1 que a auditoria manda manter (`components/ServicePage.tsx:40`) | — | Texto integral do item 44 da auditoria (só a parte de subheadline; o H1 a auditoria manda manter e este lote não toca nele). A versão antiga citava "rotina de chamados e relatório mensal de cada demanda"; a nova fala em "atendimento por criticidade" e "relatórios de desempenho" — troca o enquadramento de "todo mês, toda demanda" para "por criticidade", o que é mais preciso mas é uma mudança de promessa, não só de equipe própria. |
| `manfac-site/lib/servicos.ts:101` | `metaDescription: 'Manutenção predial preventiva e corretiva com SLA, equipe técnica própria e visibilidade mensal dos chamados para redes e grandes operações.',` | `Manutenção predial preventiva e corretiva com SLA, núcleo técnico próprio e visibilidade mensal dos chamados para redes e grandes operações.` | `<meta name="description">` da rota `/servicos/manutencao-predial` | 140 | Troca mínima, só a menção a equipe própria. |
| `manfac-site/app/servicos/page.tsx:11` | `'Obras e reformas corporativas, novas construções, manutenção predial preventiva e corretiva e sistemas de climatização (HVAC) — tudo com equipe técnica própria.',` | `Obras e reformas corporativas, novas construções, manutenção predial preventiva e corretiva e sistemas de climatização (HVAC), com núcleo técnico próprio.` | `<meta name="description">` da rota `/servicos` (metadata do `ServicosPage`, não é exibido na página) | 154 | Troca mínima. O texto atual (160 caracteres) já estourava o limite prático de ~155; a nova versão, além de corrigir a alegação, fica em 154. Troquei o travessão por vírgula para caber. **Ver contradição abaixo — é o ponto mais importante desta entrega.** |

---

## Contradição com texto vizinho não listado (a mais relevante desta entrega)

`manfac-site/components/Servicos.tsx:38-39` — texto **visível** na própria página `/servicos`,
logo abaixo do H1, ainda diz:

> "Obras, reformas, novas construções, manutenção predial e climatização — com equipe técnica
> própria e responsabilidade total do início ao fim."

Esse é o item 29 da auditoria ("Introdução" do hub de serviços), listado como **bloqueado (modelo
de operação)** na lista final de aprovação — ou seja, está fora do escopo dos 9 pontos que recebi
e continua com "equipe técnica própria" enquanto eu não tiver instrução para tocá-lo.

**Consequência prática:** depois desta troca, a rota `/servicos` fica com o `<meta
description>` corrigido (dizendo "núcleo técnico próprio") e, na mesma página, duas linhas abaixo
do H1, um parágrafo visível ainda afirmando "equipe técnica própria e responsabilidade total do
início ao fim". Um visitante que ler o snippet do Google e depois abrir a página vê a Manfac se
contradizer na primeira dobra. Recomendo que este trecho entre no próximo lote de correção do
modelo de operação — ele está na lista dos 14 pontos originais
(`docs/cliente/2026-08-31-decisao-modelo-de-operacao.md`, mas com o número de linha desatualizado:
lá está registrado como `Diferenciais.tsx:43`, que é outro arquivo; o texto real que contradiz é
este, em `Servicos.tsx:38-39`).

Não editei esse arquivo porque está fora dos 9 pontos que recebi ("NÃO EDITE NENHUM ARQUIVO DE
CÓDIGO" e escopo restrito a `lib/servicos.ts` e `app/servicos/page.tsx`).

## Outras observações de consistência (dentro dos arquivos tocados)

- **`lib/servicos.ts:26` (sub de obras, não tocado):** ainda diz "planejamento, equipe técnica e
  gestão próxima — sem paralisar a operação do cliente." Não usa "própria", só "equipe técnica" —
  não contradiz a decisão, então não precisa mudar aqui.
- **`lib/servicos.ts:58` (bullet "Controle rigoroso de cronograma e custo", não tocado):** ajuda a
  cobrir a menção a cronograma que saiu da nova `sub` da linha 52 — a página não fica muda sobre
  cronograma, só não repete no subtítulo do hero.
- Os quatro parágrafos que a auditoria reescreveu por inteiro (linhas 36, 52, 62, 80) trocam mais
  do que a menção a equipe própria — são a copy que já estava aprovada tecnicamente (PROCEDE) e
  só esperava a decisão do modelo de operação para poder ser usada; não reduzi ao mínimo porque a
  instrução foi reutilizar o texto da auditoria onde ela já cobre o ponto.
