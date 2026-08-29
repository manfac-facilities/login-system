# Triagem do lote A — Site (global) e Home `/`

**Data:** 2026-08-29
**Fonte:** `docs/cliente/2026-08-29-auditoria-copy-seo-cro.md`, linhas 2065–2216 (itens 1 a 19 da
lista mestra), cruzadas com a seção 7.1/7.2 do mesmo arquivo (a partir da linha 317).
**Escopo:** alterações globais (menu, CTAs, rodapé, prova operacional) e a página Home.
**Regra desta rodada:** só copy. Nada de SEO (metadados, keywords, páginas novas) nem CRO.
**Nada foi implementado.** Nenhum arquivo de `manfac-site/` foi tocado.

## Nota de método — por que a auditoria erra em alguns "textos atuais"

A auditoria é de **05/08/2026**. Depois dela entraram no site a frente A de interação e
polimento (20/08) e a reescrita do formulário de contato (21/08). O commit `a4b6669`
("CTAs vao direto pro WhatsApp com icone e copy nova", 20/08) e o `75288e1`
("rodape em 4 colunas com subpaginas e contato", 20/08) invalidam parte do diagnóstico.
Todo veredito abaixo foi conferido no arquivo de código, não no inventário.

Caminhos são relativos à raiz do repositório.

---

## Tabela de vereditos

| # | Veredito | Evidência `arquivo:linha` | Observação |
|---|---|---|---|
| 1 | PROCEDE | `manfac-site/lib/content.ts:7` | Rótulo `'Resultados'` existe em dois lugares e num teste; trocar os três juntos. |
| 2 | DISCUTÍVEL | `manfac-site/components/Header.tsx:16` | Trocar só o dropdown descasa o menu do nome do serviço no rodapé e na página. |
| 3 | DISCUTÍVEL | `manfac-site/components/Contato.tsx:30` | CTA contextual exige prop nova no componente compartilhado — não é troca de string. |
| 4 | BLOQUEADO | `manfac-site/components/Footer.tsx:31-103` | Metade do pedido já existe; falta razão social, CNPJ, horário, áreas, LinkedIn, RT e política. |
| 5 | PROCEDE | `manfac-site/lib/content.ts:28,67`, `manfac-site/components/home/Diferenciais.tsx:43` | Três strings no lote; o resto do site repete a promessa e cai nos outros lotes. |
| 6 | JÁ FEITO | `manfac-site/components/Hero.tsx:29-31` | A auditoria pede para manter o H1 e o H1 está lá, literal. |
| 7 | PROCEDE | `manfac-site/components/Hero.tsx:37` | Troca de um parágrafo único, sem dependência. |
| 8 | DISCUTÍVEL | `manfac-site/components/Hero.tsx:50`, `manfac-site/lib/whatsapp.ts:58` | "Falar com especialista" não existe mais; o rótulo novo descasa da mensagem do WhatsApp. |
| 9 | BLOQUEADO | `manfac-site/lib/content.ts:11-16`, `manfac-site/components/Stats.tsx:16-19` | Falta período-base, critério e fonte dos quatro números; e não há slot de nota de rodapé. |
| 10 | DISCUTÍVEL | `manfac-site/lib/content.ts:31` | A resposta proposta duplica a resposta da dor 1 (`lib/content.ts:27`). |
| 11 | PROCEDE | `manfac-site/lib/content.ts:39` | Troca de uma string. "dashboard ao vivo" sobrevive em `/resultados` (fora do lote). |
| 12 | PROCEDE | `manfac-site/components/home/ServicosTeaser.tsx:125-127` | A mesma promessa absoluta reaparece em `lib/servicos.ts:26` (fora do lote). |
| 13 | PROCEDE | `manfac-site/components/home/ServicosTeaser.tsx:139-140` | Troca de uma string, sem dependência. |
| 14 | PROCEDE | `manfac-site/components/home/ServicosTeaser.tsx:146-147` | A mesma promessa é o H1 de `/servicos/hvac` (`lib/servicos.ts:106`, fora do lote). |
| 15 | PROCEDE | `manfac-site/lib/content.ts:50` | Troca de um bullet do card recorrente. |
| 16 | DISCUTÍVEL | `manfac-site/lib/content.ts:44-63`, `manfac-site/components/home/RecorrenteSpot.tsx:43-76` | Não há campo nem slot para o parágrafo de definição; exige mexer no tipo e no componente. |
| 17 | BLOQUEADO | `manfac-site/components/home/CaseTeaser.tsx:67,72-76,79-82` | Falta a autorização do cliente para citar faturamento e número de lojas. |
| 18 | PROCEDE | `manfac-site/components/home/Diferenciais.tsx:42-44` | Andar junto com o item 5; sozinho, o H2 contradiz a pílula `lib/content.ts:67`. |
| 19 | PROCEDE | `manfac-site/components/Contato.tsx:20-23` | Componente compartilhado por 5 rotas: a troca vale para todas de uma vez. |

---

## Detalhamento por item

### 1 — Menu: "Resultados" → "Case de sucesso" · PROCEDE

Texto atual literal (`manfac-site/lib/content.ts:7`):

```
  { href: '/resultados', label: 'Resultados' },
```

O mesmo rótulo aparece uma segunda vez, na lista institucional do rodapé
(`manfac-site/components/Footer.tsx:16`):

```
  { href: '/resultados', label: 'Resultados' },
```

Trocar só um dos dois deixa menu e rodapé chamando a mesma página por nomes diferentes.
Há ainda um teste que assere o rótulo antigo (`manfac-site/components/__tests__/Header.test.tsx:9`):

```
    ;['Início', 'Quem somos', 'Serviços', 'Resultados', 'Contato'].forEach((label) => {
```

A rota `/resultados` **não** muda — só o rótulo. Mudar a rota seria SEO, e está fora desta rodada.

### 2 — Menu: "Sistemas de Climatização (HVAC)" → "Climatização e HVAC" · DISCUTÍVEL

Texto atual literal (`manfac-site/components/Header.tsx:16`):

```
  { href: '/servicos/hvac', label: 'Sistemas de Climatização (HVAC)' },
```

**Objeção:** a string idêntica é o `nome` canônico do serviço em `manfac-site/lib/servicos.ts:105`,
e é ela que alimenta o rodapé (`manfac-site/components/Footer.tsx:66`), os chips e os cards de
`/servicos` e o eyebrow da página do serviço — trocar só o dropdown do header faz o menu
prometer "Climatização e HVAC" e a página entregar "Sistemas de Climatização (HVAC)".

**Recomendação:** trocar `Header.tsx:16` e `lib/servicos.ts:105` no mesmo passe, aceitando que
o rótulo muda em todo o site, ou não trocar nenhum dos dois. O meio-termo que a auditoria
descreve ("Menu") é o pior dos três estados.

### 3 — CTAs contextuais · DISCUTÍVEL

Texto atual literal (`manfac-site/components/Contato.tsx:30`):

```
            AGENDAR CONVERSA TÉCNICA
```

A premissa está correta: esse é um único literal, dentro de um componente reaproveitado por
**cinco** rotas — `app/page.tsx:36`, `app/quem-somos/page.tsx:30`, `app/servicos/page.tsx:23`,
`app/resultados/page.tsx:23` e `components/ServicePage.tsx:135` (que serve as 4 subpáginas de
serviço). Então ele realmente aparece igual em quase todas as páginas.

**Objeção:** `Contato.tsx` não recebe nenhuma prop (`manfac-site/components/Contato.tsx:3`:
`export default function Contato() {`). CTA contextual por página exige criar a prop, decidir o
texto de cada uma das cinco chamadas e propagar — é refactor de componente, não troca de copy.
Além disso os outros CTAs do site já são contextuais e contradizem parcialmente o diagnóstico:
`Header.tsx:139` e `Hero.tsx:50` dizem "Solicitar atendimento", `ServicePage.tsx:48` diz
"Solicitar proposta técnica" (por decisão registrada do João no commit `a4b6669`).

**Recomendação:** deixar fora desta rodada de copy e tratar junto com o refactor, ou, se o João
quiser ganho imediato, trocar apenas o literal por um único texto novo aprovado, sem
contextualização por página.

### 4 — Rodapé completo · BLOQUEADO

A premissa da auditoria ("Apenas logomarca, copyright e links básicos") **já não descreve o
rodapé atual** — o rodapé de 4 colunas entrou em 20/08 (commit `75288e1`). Do que a auditoria
pede, já existe:

- cidade/UF — `manfac-site/components/Footer.tsx:11` (`const ENDERECO = 'Rio de Janeiro · RJ'`) e `:96`
- telefone — `manfac-site/components/Footer.tsx:91`, valor em `manfac-site/lib/whatsapp.ts:9`
- e-mail comercial — `manfac-site/components/Footer.tsx:93-94`
- links de serviços — `manfac-site/components/Footer.tsx:59-69`
- copyright — `manfac-site/components/Footer.tsx:101`

**Falta, e depende exclusivamente do cliente:**

1. **Razão social** (o rodapé só tem o nome fantasia "Manfac Engenharia")
2. **CNPJ**
3. **Horário de atendimento comercial**
4. **Áreas atendidas** (lista de municípios/regiões)
5. **Link do LinkedIn** (não há nenhuma rede social no arquivo)
6. **Dados de responsabilidade técnica** (CREA da empresa / nome e registro do RT)
7. **Política de privacidade** — não existe página nem link no site

Observação: o próprio código já registra a pendência de dados —
`manfac-site/components/Footer.tsx:7-9` traz um `TODO` dizendo que o João ainda não passou
tagline nem endereço.

### 5 — Prova operacional: "equipe própria" vira "gestão e núcleo técnico próprios" · PROCEDE

Dentro do lote (global + Home), três strings afirmam equipe própria como promessa absoluta:

`manfac-site/lib/content.ts:28`
```
  { dor: 'Falta de padrão', resposta: 'Equipe própria treinada, rotina técnica e supervisão operacional.' },
```

`manfac-site/lib/content.ts:67`
```
  'Equipe própria treinada',
```

`manfac-site/components/home/Diferenciais.tsx:43`
```
            Equipe própria. Ponto único de responsabilidade.
```

Fora do lote, a mesma promessa aparece em `manfac-site/components/QuemSomos.tsx:59`,
`manfac-site/components/Servicos.tsx:39` e em sete pontos de `manfac-site/lib/servicos.ts`
(linhas 25, 36, 52, 57, 62, 80 e nas metaDescriptions). Aplicar só na Home deixa o site
contraditório consigo mesmo — os outros lotes precisam do mesmo tratamento.

Dois achados laterais: `manfac-site/components/home/QuemSomosTeaser.tsx:34` também diz "equipe
própria", mas o componente **não é importado em lugar nenhum** (código morto, não renderiza);
e `manfac-site/lib/content.ts:97` (`export const SERVICOS`) também é código morto, sem nenhum
consumidor — nenhum dos dois precisa entrar na revisão de copy.

A formulação exata ("parceiros especializados homologados") é uma decisão de posicionamento
comercial; ela é implementável hoje, mas o texto final é do João.

### 6 — Hero H1: manter · JÁ FEITO

`manfac-site/components/Hero.tsx:29-31`:

```
          Engenharia, manutenção predial e obras corporativas
          <br />
          para operações que não podem parar.
```

É exatamente o texto que a auditoria manda preservar. Nenhuma ação.

### 7 — Hero subheadline · PROCEDE

Texto atual literal a ser substituído (`manfac-site/components/Hero.tsx:37`):

```
          A Manfac atende empresas com múltiplas unidades, alto volume de demandas e necessidade de controle, padronização e visibilidade em campo — da manutenção recorrente às obras e reformas spot.
```

String isolada, sem reúso. Troca direta.

### 8 — Hero CTA principal · DISCUTÍVEL

O "Texto atual" da auditoria ("Falar com especialista") **não existe mais no repositório** — foi
trocado em 20/08 pelo commit `a4b6669`, que registra no corpo: "A copy 'Falar com especialista'
virou 'Solicitar atendimento' no header e no hero."

Texto atual literal (`manfac-site/components/Hero.tsx:50`):

```
            Solicitar atendimento
```

**Objeção:** esse botão não leva a um formulário — ele abre o WhatsApp com mensagem
pré-preenchida (`manfac-site/components/Hero.tsx:44`, `href={buildDirectWhatsAppUrl('Home')}`),
e a mensagem é `manfac-site/lib/whatsapp.ts:58`:

```
  const texto = `Olá! Vim pelo site da Manfac (${origem}) e gostaria de solicitar atendimento.`
```

Trocar o rótulo para "Solicitar avaliação da operação" sem trocar essa frase faz o visitante
clicar em uma coisa e mandar outra. E o mesmo rótulo está no header (`components/Header.tsx:139`),
que ficaria divergente do hero.

**Recomendação:** se aprovar, trocar os três juntos — `Hero.tsx:50`, `Header.tsx:139` e a frase de
`lib/whatsapp.ts:58` — mantendo botão e mensagem coerentes. Alterar só o hero é pior que não mexer.

### 9 — Indicadores com nota metodológica · BLOQUEADO

Texto atual literal (`manfac-site/lib/content.ts:11-16`):

```
export const STATS = [
  { value: '400+', label: 'unidades sob gestão no RJ' },
  { value: '+1.000', label: 'ordens de serviço/mês' },
  { value: '100%', label: 'das demandas concluídas no mês' },
  { value: '+R$800 mil', label: 'em obras e reformas/mês' },
]
```

**Falta, e só a Manfac pode fornecer:** o **período-base** de apuração dos quatro números, o
**critério** do "100%" (o que conta como demanda concluída) e a **fonte interna** (relatório,
sistema, mês de referência). Sem isso, a nota metodológica que a auditoria pede não pode ser
escrita — ela é justamente o dado que falta.

Dois pontos técnicos para quando destravar: `manfac-site/components/Stats.tsx:16-19` só renderiza
`value` e `label`, não há slot para o asterisco nem para a nota de rodapé; e os mesmos quatro
números se repetem em `manfac-site/components/home/CaseTeaser.tsx:7,19,29,41` e em
`manfac-site/lib/servicos.ts` (38, 39, 64, 65, 92, 93, 94, 119, 120), então a delimitação
"dados do case" precisa valer para todos.

### 10 — Dor x resposta · DISCUTÍVEL

Texto atual literal (`manfac-site/lib/content.ts:31`):

```
  { dor: 'Dificuldade de cobrança', resposta: 'Gestão ativa com responsável técnico e acompanhamento de ponta a ponta.' },
```

**Objeção:** a resposta proposta ("Um ponto focal, responsáveis definidos por etapa e
rastreabilidade até a conclusão") é praticamente a mesma da dor 1, que já está na tabela
(`manfac-site/lib/content.ts:27`):

```
  { dor: 'Muitos fornecedores', resposta: 'Ponto único de responsabilidade e comunicação.' },
```

Aplicada literalmente, a tabela passa a ter duas linhas de cinco dizendo "ponto focal único",
o que enfraquece as duas.

**Recomendação:** aplicar a troca da dor 5 e, no mesmo passe, reescrever a resposta da dor 1 para
não repetir — ou trocar só o rótulo `'Dificuldade de cobrança'` → `'Responsabilidade pulverizada'`
e manter a resposta atual, que não colide.

### 11 — Como funciona: "dashboard" · PROCEDE

Texto atual literal (`manfac-site/lib/content.ts:39`):

```
  { n: '04', title: 'Gestão e comunicação', description: 'Status recorrente, cronograma, dashboard, reuniões e pendências.' },
```

Troca direta. Observação: a mesma promessa de plataforma sobrevive em
`manfac-site/components/Resultados.tsx:10` ("Relatórios semanais, dashboard ao vivo e ponto de
contato único para o cliente."), que é da rota `/resultados` e cai em outro lote.

### 12 — Card Obras: "sem paralisar sua operação" · PROCEDE

Texto atual literal (`manfac-site/components/home/ServicosTeaser.tsx:125-127`):

```
    title: 'Obras e Reformas Corporativas',
    description:
      'Reformas corporativas de diferentes portes, com planejamento, equipe técnica e gestão próxima — sem paralisar sua operação.',
```

Troca direta — a copy da Home é hardcoded no componente e não vem de `lib/servicos.ts`.
Observação: a mesma promessa absoluta está em `manfac-site/lib/servicos.ts:26` ("sem paralisar a
operação do cliente"), usada em `/servicos` e `/servicos/obras-e-reformas`, e em
`manfac-site/lib/servicos.ts:46` (metaDescription — SEO, fora de escopo). Ambas fora deste lote.

### 13 — Card Manutenção: "eliminam emergências" · PROCEDE

Texto atual literal (`manfac-site/components/home/ServicosTeaser.tsx:139-140`):

```
    title: 'Manutenção Predial Preventiva e Corretiva',
    description:
      'Rotinas preventivas que eliminam emergências e mantêm seu prédio funcionando sem interrupções imprevistas.',
```

Troca direta, sem reúso desta string em outro lugar.

### 14 — Card HVAC: "energia dentro do orçamento" · PROCEDE

Texto atual literal (`manfac-site/components/home/ServicosTeaser.tsx:146-147`):

```
    title: 'Sistemas de Climatização (HVAC)',
    description:
      'Climatização funcionando, energia dentro do orçamento e manutenção preventiva com técnicos especializados.',
```

Troca direta. Observação: a mesma garantia financeira é o **H1** de `/servicos/hvac`
(`manfac-site/lib/servicos.ts:106`: `headline: 'Climatização funcionando. Energia dentro do
orçamento.'`) — fora deste lote, mas se ficar só lá o problema apontado continua no site.

### 15 — Contrato recorrente: "equipe dedicada" · PROCEDE

Texto atual literal (`manfac-site/lib/content.ts:50`):

```
      'SLA, equipe dedicada, rotina de chamados e relatórios',
```

Troca direta de um bullet. Não há limite de tamanho no componente
(`manfac-site/components/home/RecorrenteSpot.tsx:54-58` renderiza a lista inteira).

### 16 — Contrato x spot: definir os dois termos · DISCUTÍVEL

Estrutura atual (`manfac-site/lib/content.ts:44-63`): cada lado tem `tagline`, `title` e
`items: string[]`. O componente (`manfac-site/components/home/RecorrenteSpot.tsx:43-76`) renderiza
exatamente esses três campos — tagline, `<h3>` e a `<ul>` de bullets.

**Objeção:** o texto proposto é um parágrafo de definição para cada lado, e não existe campo nem
slot no componente para ele. Aplicar exige mudar o objeto e o JSX, não só a copy.

**Recomendação:** adicionar um campo `definicao` a cada lado e renderizá-lo entre o `<h3>` e a
`<ul>`; alternativa mais barata, se o João não quiser mexer no componente agora, é entrar com a
definição como **primeiro item** da lista de cada card, que já renderiza sem mudança de código.

### 17 — Case na Home · BLOQUEADO

Texto atual literal (`manfac-site/components/home/CaseTeaser.tsx:67`):

```
                400+ unidades de um dos maiores varejistas farmacêuticos do Brasil, sob gestão Manfac.
```

`manfac-site/components/home/CaseTeaser.tsx:72-76`:

```
                Como a Manfac reestruturou a engenharia de manutenção de mais de{' '}
                <strong className="text-white">400 unidades</strong>{' '}de um dos maiores varejistas
                farmacêuticos do Brasil — R$&nbsp;16&nbsp;bi/ano,{' '}
                <strong className="text-white">1.600+ lojas</strong>{' '}no país.
```

`manfac-site/components/home/CaseTeaser.tsx:79-82`:

```
                Uma operação fragmentada transformada em referência: +1.000 OS/mês com 100% das
                demandas concluídas mensalmente.
```

**Falta:** a confirmação de que o cliente **autorizou** a publicação do faturamento
(R$ 16 bi/ano) e do número de lojas (1.600+) — dados que, somados a "varejista farmacêutico",
identificam a empresa. A auditoria condiciona a publicação a "validação e autorização"; sem
essa resposta não dá para decidir entre reescrever (removendo os dados) e manter.

Observação: os mesmos dados aparecem de forma ainda mais explícita em `/resultados`
(`manfac-site/components/Resultados.tsx:46-48,72-74,83-86`), fora deste lote. A decisão do João
sobre autorização vale para as duas páginas de uma vez.

### 18 — Por que a Manfac (H2) · PROCEDE

Texto atual literal (`manfac-site/components/home/Diferenciais.tsx:42-44`):

```
          <h2 className="mt-3 text-2xl font-bold leading-snug text-[var(--ink)] md:text-3xl">
            Equipe própria. Ponto único de responsabilidade.
          </h2>
```

Troca direta. **Precisa andar junto com o item 5:** as pílulas logo abaixo vêm de
`manfac-site/lib/content.ts:67` (`'Equipe própria treinada'`), então mudar só o H2 deixa o título
dizendo "gestão própria" e a pílula ao lado dizendo "equipe própria treinada".

### 19 — CTA final · PROCEDE

Texto atual literal (`manfac-site/components/Contato.tsx:20-23`):

```
          <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
            Conte como funciona sua operação hoje — unidades, volume de demandas e principais
            dores. Retornamos com uma leitura técnica.
          </p>
```

Troca direta de um parágrafo. Observação de alcance: o componente é usado em cinco rotas
(`app/page.tsx:36`, `app/quem-somos/page.tsx:30`, `app/servicos/page.tsx:23`,
`app/resultados/page.tsx:23` e `components/ServicePage.tsx:135`), então esta troca resolve o item
para o site inteiro, não só para a Home. O texto proposto é mais longo que o atual; o container
tem `max-w-xl` e vai quebrar em mais linhas, o que é aceitável, mas vale conferir no mockup.

---

## Resumo do lote

**Contagem por veredito (19 itens):**

| Veredito | Qtd | Itens |
|---|---|---|
| PROCEDE | 10 | 1, 5, 7, 11, 12, 13, 14, 15, 18, 19 |
| DISCUTÍVEL | 5 | 2, 3, 8, 10, 16 |
| BLOQUEADO | 3 | 4, 9, 17 |
| JÁ FEITO | 1 | 6 |
| NÃO SE APLICA | 0 | — |
| FORA DE ESCOPO (SEO/CRO) | 0 | — |

**Itens em que a auditoria está desatualizada** (o "Texto atual" descrito não corresponde ao
código de hoje): **6** (JÁ FEITO — o H1 que ela manda preservar está preservado), **8** (o CTA
"Falar com especialista" não existe desde 20/08, commit `a4b6669`) e **4** (o rodapé deixou de
ser "logomarca, copyright e links básicos" em 20/08, commit `75288e1` — telefone, e-mail,
cidade/UF e links de serviços já estão lá).

**BLOQUEADOS e o dado exato que falta:**

- **Item 4 — rodapé:** razão social · CNPJ · horário de atendimento comercial · lista de áreas
  atendidas · URL do LinkedIn · dados de responsabilidade técnica (CREA da empresa e nome/registro
  do RT) · página de política de privacidade (não existe no site).
- **Item 9 — indicadores:** período-base de apuração dos quatro números · critério do "100%"
  (o que conta como demanda concluída) · fonte interna de cada número (sistema/relatório e mês
  de referência).
- **Item 17 — case na Home:** confirmação por escrito de que o cliente autorizou publicar
  faturamento (R$ 16 bi/ano) e número de lojas (1.600+) associados a "varejista farmacêutico".
