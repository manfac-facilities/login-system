# Triagem de copy — lote D: `/resultados` e `/contato`

**Data:** 2026-08-29
**Fonte:** `docs/cliente/2026-08-29-auditoria-copy-seo-cro.md`, linhas 2513–2592 (tabela achatada,
itens **57 a 66**). Contexto narrativo em 7.9 (linha 975) e 7.10 (linha 1047).
**Mapa de apoio:** `docs/superpowers/notas/2026-08-29-inventario-copy.md` — usado como índice,
todas as linhas abaixo foram reconferidas no código.
**Escopo:** só copy. Nada foi implementado; nenhum arquivo de `manfac-site/` foi tocado.

## Como ler os vereditos

| Veredito | Significado |
|---|---|
| **JÁ FEITO** | o site atual já atende ao pedido |
| **PROCEDE** | implementável hoje, sem depender de terceiro |
| **BLOQUEADO** | depende de dado, fonte ou autorização do cliente |
| **NÃO SE APLICA** | não existe no código, ou a premissa da auditoria é falsa |
| **DISCUTÍVEL** | implementável, mas com objeção que precisa de decisão do João |

**Nota transversal ao bloco `/contato`:** a página foi **inteiramente reescrita em 21/08/2026**,
depois da coleta da auditoria (fontes consultadas em **5 de agosto de 2026**, linha 2594 do
arquivo-fonte). Hoje ela é um formulário de duas etapas que grava lead no banco
(`components/ContactForm.tsx`, `app/contato/page.tsx`, `app/contato/_actions.ts`,
`components/ContatoInfo.tsx`, `lib/leads.ts`). Cada item de `/contato` foi conferido contra o
código atual, um a um.

---

## `/resultados` — itens 57 a 62

| # | Veredito | Evidência (`arquivo:linha`) | Observação |
|---|---|---|---|
| **57** — Hero | **PROCEDE** | `manfac-site/components/Resultados.tsx:33-37` — H1 atual: `Gestão que transforma escala` / `<br />` / `em resultado.`; subtítulo em `:38-41`: `400+ unidades. Mais de 1.000 ordens de serviço por mês. 7 anos de operação fragmentada transformados em referência de excelência no Estado do Rio de Janeiro.` | Troca de H1 e apoio em um único arquivo, sem depender de dado novo — os dois números que o texto proposto usa (400+ e 1.000+) já estão publicados. |
| **58** — Cliente e contexto | **BLOQUEADO** | `manfac-site/components/Resultados.tsx:69` (H2), `:71-75` (parágrafo com `faturamento de R$16 bilhões/ano e mais de 1.600 unidades`), `:46-48` (stats do hero) e `:83-86` (card "Escala da operação") | Falta: **fonte documentada + data** do faturamento de R$16 bi e das 1.600+ unidades, e **autorização escrita do cliente** para manter esses dados no ar — a auditoria condiciona a permanência deles a "fonte, data e autorização documentadas". |
| **59** — Desafio | **PROCEDE** | `manfac-site/components/Resultados.tsx:110-112` (H2 `Uma operação fragmentada que precisava de estrutura — e ganhou.`) e `:113-118` (parágrafo atual, que contém `O cliente não sabia o que estava acontecendo nas suas unidades`) | Reescrita de tom, sem dado externo; o texto proposto não introduz nenhuma afirmação nova que precise de validação. |
| **60** — Solução | **BLOQUEADO** | `manfac-site/components/Resultados.tsx:146-148` — H2 `Como a Manfac virou referência em 18 meses.`; `:6-12` (`PASSOS_DETALHES`), com `:10` = `Relatórios semanais, dashboard ao vivo e ponto de contato único para o cliente.` | Falta: **marco inicial, marco final e aprovação do cliente** para os 18 meses, e a **confirmação de qual ferramenta** sustenta o "dashboard ao vivo" (a auditoria pede "painéis atualizados na ferramenta acordada"). Só o novo título ("Estruturação da operação em cinco frentes") é livre. |
| **61** — Resultados e depoimento | **BLOQUEADO** | `manfac-site/components/Resultados.tsx:190-196` (eyebrow `Resultado` + H2 `Os números falam por si.`), `:200-213` (grade que renderiza `STATS`), `manfac-site/lib/content.ts:11-16` (os 4 KPIs, incluindo `100% / das demandas concluídas no mês`), `components/Resultados.tsx:230-233` (frase entre aspas, sem autor) e `:236-238` (assinatura `Resultado da parceria após 18 meses de operação`) | Falta: **período, definição e denominador de cada KPI** (o que conta como "demanda concluída", sobre qual base), e — para a frase entre aspas — **nome, cargo e autorização** de quem depõe, ou a decisão de rebaixá-la a "Síntese do resultado". A premissa da auditoria confere: a citação existe e não tem autor. |
| **62** — CTA | **DISCUTÍVEL** | `manfac-site/components/Contato.tsx:30` — `AGENDAR CONVERSA TÉCNICA`; o bloco é montado em `/resultados` por `manfac-site/app/resultados/page.tsx:23` | **Objeção:** `components/Contato.tsx` é o CTA final compartilhado por `/`, `/quem-somos`, `/servicos`, as 4 rotas `/servicos/[slug]` e `/resultados` — trocar o texto ali muda **8 rotas de uma vez**, e "Ver como aplicar este modelo à minha operação" só faz sentido depois de ler o case. **Recomendação:** aceitar o novo CTA apenas se o bloco for parametrizado por rota; caso contrário, manter como está. |

---

## `/contato` — itens 63 a 66

| # | Veredito | Evidência (`arquivo:linha`) | Observação |
|---|---|---|---|
| **63** — Introdução | **PROCEDE** | `manfac-site/components/ContactForm.tsx:139-141` — `Escolha o caminho — leva menos de 1 minuto e sua mensagem já chega qualificada.` (H1 `Qual é a sua demanda?` em `:136-138`) | A reescrita de 21/08 **manteve** essa frase, então a premissa da auditoria continua válida; e o parágrafo fica **fora** do container dos três boxes (`role="group" aria-label="Tipo de demanda"`, `:143`), portanto não esbarra na restrição do João. |
| **64** — Cards | **DISCUTÍVEL** | `manfac-site/components/ContactForm.tsx:8-21` — array `PATHS` com `Manutenção recorrente` / `Obra ou reforma` / `Avaliação técnica` e suas três descrições; renderizados em `:161-164` | **Objeção:** o João foi enfático em 20/08 — os três boxes "qual é a sua demanda" não mudam, nem layout, nem copy, nem comportamento; e renomear "Avaliação técnica" quebraria o tipo `DemandPath` e a lista `DEMAND_PATHS` (`manfac-site/lib/whatsapp.ts:11` e `:17`), que validam o campo `site_leads.path` em runtime. **Recomendação:** não implementar sem decisão explícita do João; se ele reabrir, tratar a renomeação como migração de dado, não como troca de texto. |
| **65** — Formulário | **JÁ FEITO** | Nome `ContactForm.tsx:187-198`; e-mail corporativo `:201-213`; telefone `:216-228`; tipo de demanda `:143-166`; empresa `:285-295`; cargo `:298-308`; localidade das unidades `:311-321`; nº de unidades (select 1–10 / 11–50 / 51–200 / 200+) `:325-340`; resumo da demanda `:344-355`. Mensagens de erro em `manfac-site/lib/leads.ts:41-89` e `manfac-site/app/contato/_actions.ts:14` | A premissa ("os campos não aparecem no conteúdo rastreado") é falsa desde 21/08: o formulário é um client component e não era visível ao crawler em 05/08. Restam **três lacunas menores**, listadas em "O que exigir mais" abaixo. |
| **66** — Confiança e privacidade | **BLOQUEADO** | E-mail comercial: `manfac-site/components/ContatoInfo.tsx:30,36`. Telefone/WhatsApp: `ContatoInfo.tsx:19,27` via `manfac-site/lib/whatsapp.ts:9` (`(21) 98428-0058`). Prazo de retorno: `ContactForm.tsx:274-277` e `:395-397` (`Resposta em até 1 dia útil`). Consentimento: `manfac-site/lib/leads.ts:9-10`. Cidade/UF: `manfac-site/components/Footer.tsx:11` (`Rio de Janeiro · RJ`), presente em `/contato` via `app/contato/page.tsx:43`. **Política de privacidade: não existe** — `manfac-site/app/` tem apenas `contato/`, `quem-somos/`, `resultados/`, `servicos/`, `layout.tsx`, `page.tsx`, `sitemap.ts`, e não há nenhuma ocorrência de "privacidade" em `app/`, `components/` ou `lib/` | Quatro dos cinco pedidos já estão no ar. Falta: **o documento de política de privacidade** (texto jurídico que só o cliente fornece) para poder existir a página e o link, e a **validação jurídica do texto de consentimento** — o de hoje foi aprovado pelo João em 21/08 (`lib/leads.ts:4-8`), o que não é o mesmo que parecer jurídico. |

---

## O que exigir mais

### Do cliente — bloqueios de dado e autorização

1. **Autorização de uso do case** (itens 58 e 61): documento do cliente permitindo citar
   faturamento (R$16 bi), número nacional de unidades (1.600+) e a descrição "um dos maiores
   varejistas farmacêuticos do Brasil". Sem isso, a alternativa da auditoria é remover os dados
   identificadores e manter só o escopo do trabalho da Manfac.
2. **Fonte e data de cada número do cliente** (item 58): de onde vêm R$16 bi e 1.600+, e a que
   ano se referem.
3. **Metodologia dos KPIs** (item 61): para `100% das demandas concluídas no mês`, `+1.000 ordens
   de serviço/mês`, `400+ unidades` e `+R$800 mil em obras e reformas/mês` — período de apuração,
   definição operacional e denominador. Hoje nenhum deles tem período declarado no site.
4. **Marcos do período de 18 meses** (itens 60 e 61): data de início, data de fim e aprovação do
   cliente sobre a frase "virou referência em 18 meses".
5. **Depoimento nomeado** (item 61): nome, cargo, empresa e autorização — ou a decisão de trocar a
   citação por um rótulo neutro.
6. **Política de privacidade** (item 66): o texto jurídico, para virar página e link no formulário.
7. **Parecer jurídico sobre o consentimento LGPD** (item 66): validação do texto atual de
   `lib/leads.ts:9-10`.

### Do João — decisões pendentes

8. **Item 62:** aceitar trocar o CTA final nas 8 rotas, parametrizar o bloco por rota, ou recusar.
9. **Item 64:** confirmar (ou revogar) a restrição de 20/08 sobre os três boxes.

### Lacunas menores do item 65 (não bloqueiam, mas ficam registradas)

- **Campo de prazo/urgência**: pedido pela auditoria, não existe no formulário atual.
- **Anexo**: pedido pela auditoria, não existe — é feature, não copy.
- **Tela de confirmação com próximo passo**: hoje o fluxo termina abrindo o WhatsApp
  (`ContactForm.tsx:112-129`), sem mensagem de sucesso na página. A copy sugerida pela auditoria
  para esse momento está na linha 310 do arquivo-fonte.

---

## Resumo do lote

**10 itens triados (57–66).**

| Veredito | Qtd. | Itens |
|---|---:|---|
| JÁ FEITO | 1 | 65 |
| PROCEDE | 3 | 57, 59, 63 |
| BLOQUEADO | 4 | 58, 60, 61, 66 |
| NÃO SE APLICA | 0 | — |
| DISCUTÍVEL | 2 | 62, 64 |
| FORA DE ESCOPO (SEO/CRO) | 0 | — |

### Bloqueados — o que falta em cada um

| # | Falta |
|---|---|
| **58** | Fonte documentada + data dos R$16 bi e das 1.600+ unidades, e autorização do cliente para citá-los. |
| **60** | Marco inicial, marco final e aprovação do cliente para os "18 meses"; confirmação de qual ferramenta sustenta o "dashboard ao vivo". |
| **61** | Período, definição e denominador de cada KPI; nome, cargo e autorização do depoimento (ou decisão de removê-lo). |
| **66** | Documento de política de privacidade (para existir a página e o link) e validação jurídica do texto de consentimento. |

### `/contato` — impacto da reescrita de 21/08

Dos 4 itens da página, **1 ficou integralmente obsoleto** (65 — a premissa "os campos não aparecem
no conteúdo rastreado" é falsa; todos os campos-base pedidos, exceto prazo/urgência e anexo, já
existem) e **1 ficou parcialmente obsoleto** (66 — e-mail, telefone, cidade/UF, prazo de retorno e
texto de consentimento já estão no ar; só a política de privacidade continua faltando). Os itens
63 e 64 permanecem válidos porque a reescrita preservou literalmente a copy que a auditoria mirou.

---

## Divergências de número encontradas no código

Cada número do case aparece em mais de um arquivo, e as redações **não batem entre si**. Isso
importa para o lote: qualquer correção de metodologia (itens 58, 60 e 61) tem que ser aplicada em
todas as ocorrências, ou o site passa a se contradizer.

> `components/Case.tsx` e a constante `RESULTADOS` (`lib/content.ts:120-125`) **não são
> renderizados em nenhuma rota** — `Case.tsx` não é importado por nenhum arquivo. Estão listados
> abaixo porque são fonte de divergência latente, não porque o visitante os veja hoje.

### 1. `400+` unidades no RJ — **três redações distintas**

| Arquivo:linha | Redação | Onde aparece |
|---|---|---|
| `manfac-site/lib/content.ts:12` | `400+` / `unidades sob gestão no RJ` | `STATS` — `/` e `/resultados` |
| `manfac-site/components/Resultados.tsx:48` | `400+` / `unidades no RJ sob gestão Manfac` | hero de `/resultados` |
| `manfac-site/components/Resultados.tsx:85` | `400+` / `unidades no RJ sob gestão Manfac` | card "Escala da operação" |
| `manfac-site/components/home/CaseTeaser.tsx:29-30` | `400+` / `unidades sob gestão da Manfac no RJ` | `/` |
| `manfac-site/lib/servicos.ts:39` | `400+` / **`unidades atendidas no RJ`** | `/servicos/obras-e-reformas` |
| `manfac-site/lib/servicos.ts:94` | `400+` / `unidades sob gestão no RJ` | `/servicos/manutencao-predial` |
| `manfac-site/lib/servicos.ts:119` | `400+` / **`unidades atendidas no RJ`** | `/servicos/hvac` |
| `manfac-site/lib/content.ts:123` | `400+` / `unidades sob gestão da Manfac no RJ` | não renderizado |

**"Atendidas" e "sob gestão" não são a mesma afirmação** — a primeira é mais fraca e a segunda é a
que o case sustenta.

### 2. `1.600+` — **"unidades" vs. "lojas"**

| Arquivo:linha | Redação |
|---|---|
| `manfac-site/components/Resultados.tsx:47` | `1.600+` / `unidades no Brasil` |
| `manfac-site/components/Resultados.tsx:84` | `1.600+` / `unidades no Brasil` |
| `manfac-site/components/Resultados.tsx:72` | `mais de 1.600 unidades espalhadas pelo país` |
| `manfac-site/components/home/CaseTeaser.tsx:75` | **`1.600+ lojas`** `no país` |
| `manfac-site/components/Case.tsx:9` | `1.600+ unidades no país` (não renderizado) |

### 3. `R$16 bi` — **com e sem "mais de"**

| Arquivo:linha | Redação |
|---|---|
| `manfac-site/components/Resultados.tsx:46` | `R$16 bi` / `faturamento anual do cliente` |
| `manfac-site/components/Resultados.tsx:83` | `R$16 bi` / `em faturamento anual` |
| `manfac-site/components/Resultados.tsx:72` | `faturamento de R$16 bilhões/ano` |
| `manfac-site/components/home/CaseTeaser.tsx:74` | `R$ 16 bi/ano` |
| `manfac-site/components/Case.tsx:9` | **`faturamento de mais de R$16 bilhões/ano`** (não renderizado) |

### 4. `+1.000` ordens de serviço — **quatro redações**

| Arquivo:linha | Redação |
|---|---|
| `manfac-site/lib/content.ts:13` | `+1.000` / `ordens de serviço/mês` |
| `manfac-site/components/home/CaseTeaser.tsx:7-8` | `+1.000` / `ordens de serviço por mês` |
| `manfac-site/components/home/CaseTeaser.tsx:80` | **`+1.000 OS/mês`** |
| `manfac-site/components/Resultados.tsx:39` | **`Mais de 1.000 ordens de serviço por mês`** |
| `manfac-site/lib/servicos.ts:92` | `+1.000` / `ordens de serviço por mês` |
| `manfac-site/lib/content.ts:121` | `+1.000` / `ordens de serviço por mês` (não renderizado) |

### 5. `100%` das demandas — **"no mês" vs. "mensalmente"**

| Arquivo:linha | Redação |
|---|---|
| `manfac-site/lib/content.ts:14` | `100%` / `das demandas concluídas no mês` |
| `manfac-site/lib/servicos.ts:65` | `100%` / `das demandas concluídas no mês` |
| `manfac-site/lib/servicos.ts:93` | `100%` / `das demandas concluídas no mês` |
| `manfac-site/lib/servicos.ts:120` | `100%` / `das demandas concluídas no mês` |
| `manfac-site/components/home/CaseTeaser.tsx:19-20` | `100%` / **`das demandas concluídas mensalmente`** |
| `manfac-site/components/home/CaseTeaser.tsx:80-81` | `100% das demandas concluídas mensalmente` |
| `manfac-site/lib/content.ts:122` | `100%` / `das demandas concluídas mensalmente` (não renderizado) |

### 6. `+R$800 mil` — **"obras e reformas" vs. "obras executadas"**

| Arquivo:linha | Redação |
|---|---|
| `manfac-site/lib/content.ts:15` | `+R$800 mil` / `em obras e reformas/mês` |
| `manfac-site/components/home/CaseTeaser.tsx:41-42` | `+R$800 mil` / `em obras e reformas por mês` |
| `manfac-site/lib/servicos.ts:38` | `+R$800 mil` / `em obras e reformas por mês` |
| `manfac-site/lib/servicos.ts:64` | `+R$800 mil` / **`em obras executadas por mês`** |
| `manfac-site/lib/content.ts:124` | `+R$800 mil` / `em obras e reformas por mês` (não renderizado) |

### 7. `7 anos` — **o que exatamente durou 7 anos**

| Arquivo:linha | Redação |
|---|---|
| `manfac-site/components/Resultados.tsx:39` | `7 anos de operação fragmentada` |
| `manfac-site/components/Resultados.tsx:86` | `7 anos` / `de operação fragmentada antes da Manfac` |
| `manfac-site/app/resultados/page.tsx:11` | `transformando 7 anos de operação fragmentada em referência de excelência` (meta description) |
| `manfac-site/components/Case.tsx:13` | **`Depois de 7 anos com fornecedores de baixa qualidade`** — muda o sentido e é a versão mais acusatória (não renderizado; ver item 59) |

### 8. `18 meses` — duas ocorrências, ambas em `/resultados`

| Arquivo:linha | Redação |
|---|---|
| `manfac-site/components/Resultados.tsx:147` | `Como a Manfac virou referência em 18 meses.` |
| `manfac-site/components/Resultados.tsx:237` | `Resultado da parceria após 18 meses de operação` |

Não divergem entre si, mas **nenhuma das duas declara marco inicial ou final** — é exatamente o que
os itens 60 e 61 exigem antes de manter a alegação.
