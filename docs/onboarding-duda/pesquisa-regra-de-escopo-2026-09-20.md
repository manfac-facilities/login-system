# Pesquisa: como calibrar agentes de IA para não travar perseguindo edge case

Data: 2026-09-20. Objetivo: embasar uma regra de projeto que impeça o agente de tratar
toda possibilidade improvável e nunca terminar uma etapa, sem virar desculpa para
entregar código frágil. Buscas feitas via WebSearch/WebFetch nesta sessão.

---

## 1. Práticas que aparecem repetidas (mais de uma fonte independente)

### 1.1 Restrição negativa ("não faça X") funciona melhor que instrução positiva vaga ("seja cuidadoso")

Três fontes independentes convergem no mesmo padrão: listar explicitamente o que o
agente **não** deve fazer sem pedido explícito (refatorar código não tocado, criar
abstração para caso único, adicionar try/except em código que não pode lançar,
cache/retry sem requisito nomeado), em vez de pedir "cuidado" ou "código robusto" de
forma genérica.

- [DOCUMENTAÇÃO OFICIAL] Claude Code Docs, "Best practices for Claude Code":
  regra vaga como "write clean code" é listada explicitamene na coluna do que
  **excluir** do CLAUDE.md ("Self-evident practices like 'write clean code'"), porque
  não muda comportamento.
  https://code.claude.com/docs/en/best-practices
- [POST INDIVIDUAL] DEV Community (rams901), "CLAUDE.md Rules: How to Cut AI Coding
  Mistakes from 40% to 3% in 2026": "negative constraints ('don't refactor,' 'don't add
  features') prove more effective than positive guidance ('be helpful') for preventing
  scope creep".
  https://dev.to/rams901/claudemd-rules-how-to-cut-ai-coding-mistakes-from-40-to-3-in-2026-2j7o
- [POST INDIVIDUAL] kirill-markin.com, "Cursor IDE Rules for AI": regra de estilo é
  redigida como proibição direta ("no fallbacks, symptom-masking guards, or silent
  recovery unless I explicitly ask"), não como recomendação de tom.
  https://kirill-markin.com/articles/cursor-ide-rules-for-ai/

**Por que funciona:** um modelo de linguagem segue melhor um teste binário ("isto é
refatoração de código não pedido? então não faço") do que um critério de qualidade
subjetivo, que ele pode racionalizar caso a caso.

### 1.2 Regra do "3+ usos" para abstração / YAGNI aplicado literalmente

- [BLOG] codersera.com, "How to Stop Claude Code From Over-Engineering (2026)": "Do NOT
  add abstractions (interfaces, base classes, factories, wrappers, generic helpers) for
  a single use case. Inline first; abstract only when there are 3+ real call sites."
  https://codersera.com/blog/how-to-stop-claude-code-over-engineering-2026/
- [POST INDIVIDUAL] kirill-markin.com: "Follow DRY, KISS, and YAGNI principles. Prefer
  simple, native, vendor-recommended solutions and avoid premature abstractions."
  https://kirill-markin.com/articles/cursor-ide-rules-for-ai/

Duas fontes independentes usam o mesmo princípio (YAGNI), uma delas com um número
concreto (3+ call sites) em vez de "quando fizer sentido" — o número concreto é o que
torna a regra testável.

### 1.3 Verificação (teste/check) substitui a varredura manual de edge case

A documentação oficial da Anthropic recomenda dar ao agente um critério de aprovação
automático (teste, build, screenshot) em vez de deixá-lo decidir sozinho quando "está
pronto" — isso desloca o julgamento de "quantos edge cases tratar" para "o check passa
ou não".

- [DOCUMENTAÇÃO OFICIAL] Claude Code Docs: "Claude stops when the work looks done.
  Without a check it can run, 'looks done' is the only signal available (...) Give
  Claude something that produces a pass or fail, and the loop closes on its own."
  E, na lista de padrões de falha comuns: "The trust-then-verify gap. Claude produces a
  plausible-looking implementation that doesn't handle edge cases. Fix: Always provide
  verification (tests, scripts, screenshots). If you can't verify it, don't ship it."
  https://code.claude.com/docs/en/best-practices
- [POST INDIVIDUAL] DEV Community (panav_mhatre), "Your Claude-generated code works.
  That's the problem": concorda que "'it works' is the most dangerous acceptance
  criterion in AI-assisted development" — o problema não é o agente evitar edge case,
  é a equipe aceitar "funciona" como prova de que não há edge case.
  https://dev.to/panav_mhatre_732271d2d44b/your-claude-generated-code-works-thats-the-problem-nga

**Nuance importante para nós:** isso não contradiz "não persiga todo edge case" — é o
complemento. A regra de escopo diz o que o agente não deve *construir* sem pedido; a
verificação diz o que a equipe não deve *aceitar* sem prova. As duas fontes tratam de
momentos diferentes do processo.

### 1.4 O próprio revisor/reviewer é instruído a não escalar todo achado

- [DOCUMENTAÇÃO OFICIAL] Claude Code Docs, seção "Add an adversarial review step":
  "A reviewer prompted to find gaps will usually report some, even when the work is
  sound, because that is what it was asked to do. Chasing every finding leads to
  over-engineering: extra abstraction layers, defensive code, and tests for cases that
  can't happen. Tell the reviewer to flag only gaps that affect correctness or the
  stated requirements, and treat the rest as optional."
  https://code.claude.com/docs/en/best-practices

  Isto é quase textualmente a mesma régua que já está em
  `docs/cliente/.../feedback-regua-de-revisao.md` deste projeto ("só bloqueia dano de
  dado alcançável; resto vai a backlog") — é bom sinal de que a prática do João já
  está alinhada com a documentação oficial mais recente, não é invenção isolada.

### 1.5 Fase MVP tende a "caminho feliz primeiro, edge case depois", não "edge case nunca"

- [BLOG DE EMPRESA] Augment Code, "The 80% Problem": "Use spec-driven generation for
  production services; skip for throwaway prototypes." O mesmo texto define o "problema
  dos 20%" como exatamente error handling, segurança e observabilidade deixados de lado
  — tratado como dívida a pagar, não como decisão permanente.
  https://www.augmentcode.com/guides/the-80-percent-problem-ai-agents-technical-debt
- [BLOG DE EMPRESA] aibuilderclub.com, "Claude Code for Startup Founders": estrutura
  literal de 5 dias — dias 1–4 são "Build the one flow that is your entire product" /
  "Ship when the one core flow is solid", e trata edge case como item de dia 4
  ("What happens when a free user tries to create project 6?"), não como algo banido.
  No dia 5 ("production deployment"): "add basic error boundaries, loading skeletons,
  and a 404 page" e "always get eyes on auth and payment flows" antes de deploy —
  ou seja, segurança/pagamento nunca entram na categoria "não se preocupe".
  https://www.aibuilderclub.com/blog/claude-code-for-startup-founders

Duas fontes concordam: a calibração real observada não é "ignore edge case", é
"sequencie": primeiro o fluxo principal, depois uma passada dedicada de edge case antes
de produção — com auth/pagamento/dados sensíveis excluídos da fase "não se preocupe" em
ambas.

---

## 2. Texto de regra pronto para copiar (trechos literais)

### 2.1 codersera.com — bloco "Change discipline" (o mais completo e literal que achei)

> ## Change discipline
>
> - Make the SMALLEST change that satisfies the request. Do not refactor,
>   rename, reformat, or "improve" code you were not asked to touch.
> - Do NOT create new files unless strictly required. Prefer editing an
>   existing file over adding a new one.
> - Do NOT add abstractions (interfaces, base classes, factories, wrappers,
>   generic helpers) for a single use case. Inline first; abstract only when
>   there are 3+ real call sites.
> - Do NOT add error handling, fallbacks, retries, or defensive guards unless
>   the input is genuinely untrusted or I explicitly ask. No try/except around
>   code that cannot throw.
> - Do NOT add caching, memoization, or batching unless I name a performance
>   requirement.
> - Match the surrounding code's style, naming, and patterns. Do not introduce
>   a new pattern.
> - If a change seems to need more than ~20 lines or a new file, STOP and
>   propose the plan first instead of writing it.
> - Comments only where the "why" is non-obvious. No narration of what the
>   code plainly does.

Fonte: https://codersera.com/blog/how-to-stop-claude-code-over-engineering-2026/

### 2.2 dev.to (rams901) — regras nomeadas

> Rule 2 (Simplicity First): "The agent must write the minimum code that solves the
> problem. No speculative features, no generic abstractions, no 'future-proofing.'"
>
> Rule 3 (Surgical Changes Only): "The agent must touch only what the task requires.
> Match existing style. Do not refactor, rename, reformat, or clean unrelated code."

Fonte: https://dev.to/rams901/claudemd-rules-how-to-cut-ai-coding-mistakes-from-40-to-3-in-2026-2j7o

### 2.3 kirill-markin.com — regras de estilo/erro

> "Follow DRY, KISS, and YAGNI principles. Prefer simple, native, vendor-recommended
> solutions and avoid premature abstractions."
>
> "Always raise errors explicitly, never silently ignore them. Use specific error types
> that clearly indicate what went wrong."
>
> "No fallbacks, symptom-masking guards, or silent recovery unless I explicitly ask for
> them; fix root causes and make code either succeed or fail with a clear error."

Fonte: https://kirill-markin.com/articles/cursor-ide-rules-for-ai/

### 2.4 Documentação oficial — regra para o revisor, não para quem implementa

> "Tell the reviewer to flag only gaps that affect correctness or the stated
> requirements, and treat the rest as optional."

Fonte: https://code.claude.com/docs/en/best-practices (seção "Add an adversarial review step")

**Observação:** nenhuma das quatro fontes usa a frase "não se preocupe com edge cases".
Todas formulam a régua como *o quê não construir sem pedido explícito* + *quando parar e
perguntar* (ex.: "if a change seems to need more than ~20 lines... STOP and propose the
plan first"). É uma diferença de formulação relevante: a regra não desliga julgamento,
ela dá um teste objetivo para não precisar exercer julgamento a cada linha.

---

## 3. O contra-argumento

Busquei ativamente por casos de "regra mandou ignorar edge case → bug em produção" com
nome, postmortem ou incidente documentado. **Não encontrei um caso desse tipo.** O que
encontrei foi mais fraco e mais genérico: críticas ao ato de *aceitar* "funciona" como
prova de qualidade, não críticas a uma regra específica de escopo. Registro os dois
achados e a lacuna:

- [POST INDIVIDUAL] DEV Community (panav_mhatre), "Your Claude-generated code works.
  That's the problem": argumenta que "AI-assisted coding creates pressure to skip the
  checks that normally catch them [edge cases]" — mas o alvo da crítica é a ausência de
  code review humano, não uma regra de "não construa defesa sem pedido". A solução
  proposta é tratar o output do Claude "como o primeiro rascunho de um engenheiro
  júnior", com revisão normal — não é "afrouxe a regra de escopo".
  https://dev.to/panav_mhatre_732271d2d44b/your-claude-generated-code-works-thats-the-problem-nga
- [POST INDIVIDUAL] Level Up Coding (Gapur Kassym), "Claude AI Said 'Excellent Work',
  and Then My Team Found 3 Critical Bugs": pelo título e resumo indexado, relata um caso
  em que o próprio Claude avaliou seu código como pronto ("handles edge cases
  properly") e a equipe achou 3 bugs críticos depois. **Não consegui abrir a página
  (HTTP 403 ao WebFetch)** — não tenho o texto completo para confirmar se o problema foi
  uma regra de escopo ou apenas o agente se autoavaliando mal. Cito a URL para o João
  conferir, mas não valido a afirmação além do que o snippet de busca mostrou.
  https://levelup.gitconnected.com/claude-ai-said-excellent-work-and-then-my-team-found-3-critical-bugs-3b42ffb47d0e
- **Auto-crítica dentro de uma fonte pró-regra:** o próprio codersera.com, que fornece o
  bloco de regras da seção 2.1, admite o risco: "overly strict rules risk
  under-building, producing brittle, unguarded code that breaks on the first real edge
  case." O remédio que a fonte propõe não é afrouxar a regra padrão, é **pedir robustez
  explicitamente quando for genuinamente necessária**, em vez de deixar o padrão
  implícito.
  https://codersera.com/blog/how-to-stop-claude-code-over-engineering-2026/

**Conclusão desta seção:** a crítica que existe é "não confie apenas na palavra do
agente de que está pronto" (reforça a necessidade de verificação — item 1.3), não
"regras de escopo mínimo causam bugs". Pouca coisa encontrada especificamente contra a
prática que pretendemos adotar; o que existe reforça condicionar a regra a um
mecanismo de verificação, não abandoná-la.

---

## 4. Como declarar fase (MVP vs. produção)

Aviso: esta foi a seção com material mais fraco. Não achei nenhum exemplo de um projeto
que literalmente escreve `FASE: mvp` ou `FASE: produção` no CLAUDE.md e troca a régua
programaticamente. O que existe na prática, em duas fontes, é sequenciamento por dia/
etapa dentro do próprio fluxo de trabalho, não uma variável de fase no arquivo de regras:

- [BLOG DE EMPRESA] aibuilderclub.com — estrutura de 5 dias (citada na seção 1.5): dias
  1–4 focam no fluxo principal, o dia 4 já introduz edge case como item de checklist
  manual ("Make a list of everything that breaks or behaves unexpectedly... feed that
  list back to Claude Code"), e o dia 5 é explicitamente rotulado como o corte de
  produção, com uma lista fixa do que passa a ser obrigatório dali para frente (error
  boundaries, loading skeletons, página 404, revisão de auth/pagamento).
  https://www.aibuilderclub.com/blog/claude-code-for-startup-founders
- [BLOG DE EMPRESA] Augment Code — não é uma fase no arquivo de regras, é uma condição
  binária no processo: "Use spec-driven generation for production services; skip for
  throwaway prototypes." O critério é o destino do código (vai para produção? é
  descartável?), não uma data ou um rótulo de fase.
  https://www.augmentcode.com/guides/the-80-percent-problem-ai-agents-technical-debt
- [POST INDIVIDUAL] Addy Osmani, "How to write a good spec for AI agents": reforça a
  mesma distinção binária sem oferecer um formato de declaração de fase: "Rapid
  prototyping with AI ('vibe coding') is great for exploration and throwaway projects.
  But shipping that code to production without rigorous specs, tests, and review is
  asking for trouble." O artigo estrutura specs com três níveis de permissão
  explícitos — "✅ Always do", "⚠️ Ask first", "🚫 Never do" — que é o mecanismo mais
  próximo de "fase" que encontrei: em vez de uma fase global, cada tarefa carrega sua
  própria régua de risco em três níveis.
  https://addyosmani.com/blog/good-spec/

**O que dá para aproveitar, mesmo com pouca base:** o padrão dos "três níveis" (sempre
faça / pergunte antes / nunca faça) do Addy Osmani é estruturalmente igual ao que o
`AGENTS.md` deste projeto já faz em outras seções (ex.: a régua de revisão, os avisos
"⚠️" espalhados pelo arquivo). Ele é mais aplicável ao nosso caso do que um rótulo único
de "fase do projeto", porque o Hub tem quatro sistemas em produção simultaneamente com
níveis de risco diferentes (RLS de acesso vs. sincronização de obras vs. UI) — uma fase
única para o projeto inteiro esconderia essa diferença.

---

## 5. Recomendação

Adotar a régua negativa (seção 2.1/2.3) como padrão do repositório, mas com uma
exceção nomeada explícita, não uma "fase" — porque o Hub já está em produção com 4
sistemas de risco desigual simultaneamente, uma fase única mentiria sobre o Conversor
de OS estar no mesmo nível de risco que RLS de acesso ou migration de obras.

**Regra proposta, dois níveis (segue o padrão "3 níveis" do Osmani, reduzido a 2 porque
já temos "pergunte antes" cobrindo o resto do AGENTS.md):**

1. **Padrão (a maioria do código):** menor mudança que resolve o pedido; sem
   abstração para caso único (limiar de 3+ usos); sem try/except em código que não
   pode lançar; sem retry/cache/fallback não pedido. Se parecer precisar de >20 linhas
   novas ou arquivo novo, parar e propor o plano antes de escrever.
2. **Lista fechada de exceção, sempre trata defensivamente mesmo sem pedido:** escrita
   em `hub_system_access`/`hub_user_roles`, RLS, qualquer coisa que apague ou
   sobrescreva dado de cliente (obras, financeiro, fotos), autenticação/autorização e
   dinheiro. Aqui a régua se inverte: falha silenciosa é o erro, não a defesa.

Isso resolve o trade-off do prazo de 28/09 sem contradizer "sem dado perdido": a
lentidão vem de tratar edge case fora da lista de exceção (ex.: enfeitar erro de UI que
nunca ocorre); o dado perdido vem de não tratar dentro dela. Complementar com a
verificação (seção 1.3): todo item da lista de exceção precisa de teste ou SQL de
verificação antes de "pronto", os demais não precisam além do build/lint padrão.
