# Pesquisa: como organizar/documentar um repositório para um agente de IA encontrar rápido onde mexer

Data da pesquisa: 2026-09-20. Todas as afirmações abaixo vieram de busca na web (WebSearch/WebFetch)
nesta sessão — não de memória do modelo. Cada bloco tem URL e classificação da fonte.

---

## 1. Como o Aider faz o repo map

O Aider (aider.chat) tem a implementação mais madura e documentada publicamente do conceito de
"repo map". Funciona assim:

**Parsing:** usa **tree-sitter** (não regex, não LSP) para extrair de cada arquivo do repo os
"tags" — definições (classe, função, método, variável, tipo) e referências (onde cada símbolo é
chamado/usado). Isso substituiu uma versão anterior baseada em **ctags** — a migração para
tree-sitter é registrada no próprio changelog/post do Aider.
[DOCUMENTAÇÃO OFICIAL] https://aider.chat/2023/10/22/repomap.html
[DOCUMENTAÇÃO OFICIAL] https://aider.chat/docs/ctags.html

**Grafo:** cada arquivo do repositório vira um nó; uma aresta dirigida liga o arquivo que
**referencia** um símbolo ao arquivo que o **define**. Auto-loops de peso 0.1 existem para
arquivos isolados não sumirem do ranking.
[CÓDIGO-FONTE/análise de código] https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping-system

**Ranking — PageRank personalizado:** o Aider roda o **PageRank do NetworkX** sobre esse grafo,
mas com um vetor de personalização enviesado para o que importa *agora*: arquivos já abertos no
chat e arquivos/identificadores mencionados na conversa recebem peso `100 / len(fnames)`, puxando
o PageRank para a vizinhança do que o usuário está tocando. Isso é o que torna o mapa dinâmico —
ele muda a cada mensagem, não é estático.
[CÓDIGO-FONTE/análise de código] https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping-system
[POST INDIVIDUAL] https://anishgandhi.com/aider-pagerank-codebase-ranking/

**Corte por orçamento de tokens:** existe um budget (`--map-tokens`, **default 1.000 tokens**) e
o Aider seleciona, na ordem do ranking, os símbolos/arquivos que cabem nesse orçamento — cortando
o resto. Quando nenhum arquivo está no chat (ou seja, o Aider precisa entender o repo inteiro do
zero), ele **expande esse orçamento significativamente** (`map_mul_no_files`) porque tem menos
sinal de personalização para focar.
[DOCUMENTAÇÃO OFICIAL] https://aider.chat/docs/repomap.html
[DOCUMENTAÇÃO OFICIAL] https://github.com/Aider-AI/aider/blob/main/aider/website/docs/repomap.md

**O que entra no mapa:** não é o código inteiro — é a **assinatura**: linha de definição da
classe/função/método com seu tipo, sem o corpo. A ideia declarada é permitir que o LLM "descubra
como usar uma API só pela assinatura" e decida, a partir do mapa, quais arquivos pedir para ver
inteiros.
[DOCUMENTAÇÃO OFICIAL] https://aider.chat/docs/repomap.html

**Escala/cache:** para não reprocessar tree-sitter a cada turno, o Aider cacheia as tags extraídas
em disco (`diskcache`, pasta `.aider.tags.cache.v{versão}/`), invalidando por mtime do arquivo. A
documentação pública não detalha um limite explícito de número de arquivos para repos muito
grandes — a estratégia declarada é sempre "ranking + corte por token budget", que escala por
construção (o grafo cresce, mas só o topo do ranking é enviado).
[CÓDIGO-FONTE/análise de código] https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping-system

Resumindo o pipeline: **tree-sitter extrai símbolos → vira grafo de referência→definição →
PageRank personalizado pelo contexto da conversa → binary/greedy cut pelo orçamento de tokens →
manda só as assinaturas do topo.** Não existe "arquivo de mapa" persistido para o usuário ler; é
gerado sob demanda, por turno.

---

## 2. Formatos de mapa que as pessoas usam

| Formato | Como funciona | Prós | Contras | Fonte |
|---|---|---|---|---|
| **Markdown escrito à mão** (tipo AGENTS.md/CLAUDE.md com "onde mexer") | Humano descreve estrutura, convenções, onde fica cada coisa | Captura *intenção* e contexto de negócio que nenhuma ferramenta extrai do AST; barato de escrever uma vez | Apodrece (seção 3); pesquisa mostrou que arquivo gerado por LLM ou longo demais **piora** a taxa de sucesso do agente | [PESQUISA ACADÊMICA] https://arxiv.org/html/2601.20404v2 ; [BLOG DE EMPRESA] https://developer.upsun.com/posts/ai/agents-md-less-is-more |
| **Mapa gerado automaticamente (tree-sitter/ctags/AST)** | Ferramenta varre o repo e produz lista de símbolos por arquivo, sem intervenção humana | Nunca fica desatualizado (é dado, não prosa); é o modelo do Aider | Não carrega contexto de negócio ("por que este módulo existe"); precisa de ferramenta rodando (build step) | [DOCUMENTAÇÃO OFICIAL] https://aider.chat/docs/repomap.html |
| **Árvore de diretórios comentada** (`tree` com uma frase por pasta) | Lista de pastas/arquivos com 1 linha de propósito ao lado | Muito barato, fácil de escrever e ler, dá visão de "onde fica o quê" em segundos | Não mostra símbolos/funções — só granularidade de arquivo/pasta; ainda precisa manutenção manual | [BLOG DE EMPRESA] https://blog.jenuel.dev/blog/build-ai-agent-project-brain-without-overloading-context |
| **Índice de funções/símbolos (ctags/LSP/tree-sitter puro, sem prosa)** | Lista plana de símbolo → arquivo:linha, sem narrativa | Preciso, verificável por máquina, base de ferramentas como ripgrep/ast-grep | Sozinho não dá "por onde começar" — é bom para busca pontual, ruim para orientação | [BLOG DE EMPRESA] https://ceaksan.com/en/code-search-for-ai-agents-which-tool-when |
| **"Repo pack" / dump inteiro compactado** (Repomix) | Empacota o repositório inteiro em um arquivo (XML/MD/texto), com árvore de diretórios, e opcionalmente comprime com tree-sitter (`--compress`) extraindo só a estrutura | Dá visão completa de uma vez, bom para "primeira leitura" de um repo desconhecido | Não é seletivo — o próprio problema que o repo map tenta resolver (gastar contexto/token à toa); em repo grande estoura o budget | [DOCUMENTAÇÃO OFICIAL/produto] https://repomix.com/ ; [CÓDIGO-FONTE] https://github.com/yamadashy/repomix |

**Padrão que emerge nas fontes de "camadas" (project brain, ceaksan.com):** ninguém usa um único
formato — a prática recomendada é **estratificar**: um arquivo pequeno sempre carregado (regras +
ponteiros) e documentos específicos carregados sob demanda por caminho/tópico, em vez de um mapa
único gigante.
[BLOG DE EMPRESA] https://blog.jenuel.dev/blog/build-ai-agent-project-brain-without-overloading-context

---

## 3. Manutenção — o problema real

> ## ⚠️ CORREÇÃO FEITA PELA SESSÃO PRINCIPAL EM 20/09/2026
>
> **As duas afirmações abaixo foram entregues com a MESMA URL de arXiv, dizendo coisas opostas.**
> Fui ao abstract original conferir, e o resultado importa:
>
> **arXiv 2601.20404 é "On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents"**
> (Lulla, Mohsenimofidi, Galster, Zhang, Baltes, Treude). Abstract literal: *"the presence of
> AGENTS.md is associated with a lower median runtime (Δ 28.64%) and reduced output token
> consumption (Δ 16.58%), while maintaining a comparable task completion behavior."*
> São 10 repositórios e 124 pull requests.
>
> **Ou seja: esse paper é FAVORÁVEL a ter o arquivo** — 28,64% menos tempo, 16,58% menos tokens de
> saída, com conclusão de tarefa comparável. Ele **não mede taxa de sucesso**, só eficiência.
>
> **A afirmação de que o arquivo PIORA o sucesso em ~3% não vem desse paper.** Ela é atribuída ao
> estudo da ETH Zurich / LogicStar.ai, lido pelo agente através do blog da Upsun — fonte de segunda
> mão, cuja referência primária **não foi verificada**. Trate como não confirmada até alguém abrir
> o estudo original.
>
> **O que sobrevive à correção**, e é o que sustenta o desenho: o arquivo tem que ser **mínimo e
> vivo**. Isso continua apoiado por arXiv 2510.05381 ("Context Length Alone Hurts LLM Performance
> Despite Perfect Retrieval", EMNLP 2025 Findings), que mede degradação de **13,9% a 85%** só por
> aumentar o tamanho da entrada, mesmo com recuperação perfeita da informação.

**Mapa escrito à mão apodrece.** O estudo citado como mais rigoroso
(ETH Zurich / LogicStar.ai, via Upsun) teria comparado repos com e sem AGENTS.md e medido: arquivo de
contexto **gerado por LLM** reduziu a taxa de sucesso da tarefa em ~3% e aumentou o custo de
inferência em mais de 20%; arquivo **escrito por humano** teve ganho marginal de sucesso (~4%) mas
ainda aumentou custo em até 19%. A causa apontada: o agente segue o arquivo desatualizado/genérico
"ao pé da letra" em vez de tratá-lo como sugestão, e arquivo gerado por LLM tende a repetir o que
já está descobrível no próprio repo (redundância cara).
**⚠️ Números NÃO verificados na fonte primária — ver a correção acima.**
[BLOG DE EMPRESA — resumo, fonte de segunda mão] https://developer.upsun.com/posts/ai/agents-md-less-is-more

Medindo eficiência operacional (não qualidade), o paper verificado achou o contrário:
presença de AGENTS.md **reduziu o tempo mediano em 28,64%** e os tokens de saída em
**16,58%** — mantendo conclusão de tarefa comparável. Ele não mede se o resultado final estava
certo, só tempo e tokens.
[PESQUISA ACADÊMICA — abstract conferido em 20/09/2026] https://arxiv.org/abs/2601.20404

**O que as pessoas fazem contra o apodrecimento:**

1. **Geração automática via hook/CI**, para a parte que é fato objetivo do código (não decisão de
   negócio): ferramentas como **RepoAgent** rodam num pre-commit hook para manter documentação
   interna sincronizada a cada commit; outra abordagem roda um **GitHub Actions agendado
   diariamente** para resincronizar docs com o código-fonte.
   [FÓRUM/registro de projeto] https://pypi.org/project/repoagent
   [POST INDIVIDUAL] https://dev.to/sarupurisailalith/i-built-a-tool-that-updates-your-docs-every-time-you-commit-code-4me8
2. **Aceitar o apodrecimento da parte estrutural e não escrever essa parte à mão** — é
   exatamente a lógica do Aider: o mapa de símbolos nunca é escrito por humano, é sempre
   recomputado. Isso elimina a categoria de erro "mapa desatualizado" para tudo que é AST.
   [DOCUMENTAÇÃO OFICIAL] https://aider.chat/docs/repomap.html
3. **Reduzir o que é mantido à mão ao mínimo que a ferramenta não descobre sozinha** —
   recomendação explícita do estudo do Upsun/ETH: só documentar convenções e decisões que **não**
   estão no código (preferência de tooling, regra de negócio, "por que"), nunca estrutura de
   diretório ou stack, que o agente lê sozinho.
   [BLOG DE EMPRESA] https://developer.upsun.com/posts/ai/agents-md-less-is-more
4. **Feedback loop manual, mas disciplinado**: quando o agente erra repetido, a lição vira uma
   linha no doc — não fica só na conversa. Isso é manutenção manual, mas orientada a evento (erro
   real), não a calendário.
   [BLOG DE EMPRESA] https://blog.jenuel.dev/blog/build-ai-agent-project-brain-without-overloading-context

Não achei nenhuma fonte com hook de pre-commit **específico para regenerar um repo-map estilo
Aider** (símbolo+assinatura) — o padrão de hook/CI que existe na prática é para documentação
narrativa (docstrings, overview), não para o índice de símbolos, que em geral é recomputado em
tempo de execução pela própria ferramenta (Aider, ast-grep, ctags) e não versionado.

---

## 4. Tamanho de arquivo

**Não existe uma fonte primária/medição controlada específica para "600-700 linhas".** Esse
número, como pedido especificamente, é **número sem origem verificável** — não apareceu em nenhuma
das buscas como resultado de medição. O que existe são números vizinhos, de fontes diferentes e
sem metodologia comparável entre si:

- **150-500 linhas** para arquivos Python, com a justificativa de que dentro dessa faixa o agente
  "segura o arquivo inteiro na memória de trabalho sem truncar" — é **opinião de blog**, não
  medição publicada.
  [POST INDIVIDUAL] https://medium.com/@eamonn.faherty_58176/right-sizing-your-python-files-the-150-500-line-sweet-spot-for-ai-code-editors-340d550dcea4
- **800 linhas (soft cap 880)** para componentes JSX/TSX especificamente, com o argumento de que
  markup declarativo "pesa" menos cognitivamente que lógica — também **opinião de blog**, sem
  estudo citado.
  [POST INDIVIDUAL] https://scanaislop.com/blog/function-size-limits-for-ai-code/
- **CLAUDE.md (não código, mas o próprio mapa/regras):** o guia da Claude Code Docs recomenda
  **abaixo de 200-300 linhas**, e a ferramenta de lint `claudelint` aplica um limite de **40KB**
  como default, justificado como "o ponto em que o Claude Code emite aviso de degradação de
  performance" — isso é próximo de um número operacional real (vem do próprio comportamento do
  produto, não de um estudo externo), mas é sobre o arquivo de instruções, não sobre arquivos de
  código-fonte do projeto.
  [DOCUMENTAÇÃO OFICIAL] https://code.claude.com/docs/en/best-practices
  [FERRAMENTA/análise de comportamento do produto] https://claudelint.com/rules/claude-md/claude-md-size

**Há evidência real de que contexto grande piora resultado — mas é sobre tamanho de contexto
total na janela, não sobre "linhas de um arquivo" como unidade**: um paper mostra que aumentar o
comprimento do input **degrada o raciocínio mesmo quando a evidência correta ainda é recuperável**
("Context Length Alone Hurts LLM Performance Despite Perfect Retrieval") — ou seja, o problema não
é achar o dado certo, é a quantidade de texto ao redor dele atrapalhando o uso do dado.
[PESQUISA ACADÊMICA] https://arxiv.org/html/2510.05381v1

**Conclusão da seção:** a ideia geral — "arquivo menor ajuda o agente" — tem lastro indireto (o
paper de context length acima, mais o fato de que arquivo maior = mais tokens gastos por edição,
que é aritmética, não medição de qualidade). Mas o número específico **600-700 não tem fonte
rastreável**; é uma convenção de mercado que varia de 150 a 880 dependendo de quem escreve e da
linguagem, sem estudo controlado comparando "agente erra mais acima de X linhas".

---

## 5. Exemplos reais

- **Aider (aider-ai/aider)** — o próprio repositório é a referência para o repo map em si (não é
  "documentação para navegar o repo", é a feature). Código da implementação:
  `aider/repomap.py` (via análise em DeepWiki).
  [CÓDIGO-FONTE] https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping-system
- **RepoMapper** — reimplementação standalone só da lógica de repo map do Aider, útil como
  referência de como extrair a técnica sem o resto do Aider.
  [CÓDIGO-FONTE] https://github.com/pdavis68/RepoMapper
- **Padrão "project brain" em camadas** (AGENTS.md enxuto → `docs/ai/index.md` → docs
  especializados por tópico) é descrito com exemplos de nomes de arquivo reais
  (`docs/ai/project-overview.md`, `docs/architecture/system.md`, `docs/testing.md`,
  `docs/decisions/`) — é a estrutura mais próxima do que este projeto já faz com
  `docs/cliente/` e `AGENTS.md`.
  [BLOG DE EMPRESA] https://blog.jenuel.dev/blog/build-ai-agent-project-brain-without-overloading-context
- **Repomix** — exemplo de ferramenta com saída real inspecionável (`repomix-output.xml`), árvore
  de diretório + contagem de token por arquivo, opção `--compress` via tree-sitter para reduzir
  para só a estrutura.
  [CÓDIGO-FONTE] https://github.com/yamadashy/repomix
  [DOCUMENTAÇÃO OFICIAL] https://repomix.com/

Renderizou menos do que eu queria nesta seção: não encontrei, dentro do tempo de busca, um
repositório público com um `.claude/rules/` ou mapa por-caminho já maduro e citado como referência
por terceiros (o padrão é recente demais — a maioria das fontes é post de blog descrevendo a
prática, não repositório aberto para inspecionar). Prefiro sinalizar isso a inventar um exemplo.

---

## 6. Recomendação (para este repositório)

Formato: **híbrido em camadas, não um mapa único.**

1. `AGENTS.md`/`CLAUDE.md` continua enxuto — só o que a ferramenta não descobre sozinha (decisão
   de negócio, armadilha histórica, estado de deploy). Isso já é a prática deste projeto; manter.
2. Em `.claude/rules/`, um arquivo **por módulo com carregamento por caminho** (`app/obras/**`),
   não um índice global — é exatamente o mecanismo que a doc do Claude Code recomenda para dividir
   regra grande, e resolve o caso do `app/obras` concentrar 81 dos 281 arquivos.
3. Dentro do rule de `app/obras`, **não escreva um índice de símbolos à mão** (isso apodrece,
   seção 3) — escreva só: mapa de pastas com 1 linha de propósito cada, e os 9 arquivos
   >600 linhas nomeados explicitamente com aviso ("ler com offset/grep, não inteiro"). O índice de
   símbolo em si, se algum dia for necessário, deveria ser gerado (ctags/tree-sitter), nunca
   mantido manualmente.
4. Sobre o limite de linha: **não adote "600-700" como regra numérica com peso técnico** — não tem
   origem verificável (seção 4). Trate-o como heurística operacional local ("estes 9 arquivos são
   grandes o bastante para pedir leitura por trecho"), não como padrão a impor em código novo.
5. Não tente automatizar a manutenção do mapa agora com 2 pessoas — o ganho de um pre-commit hook
   gerador não paga o custo de manutenção nesse tamanho de equipe; revisite se `app/obras` crescer
   de módulo concentrado para maioria do repo.

Sources:
- [Repository map | aider](https://aider.chat/docs/repomap.html)
- [Building a better repository map with tree sitter | aider](https://aider.chat/2023/10/22/repomap.html)
- [Improving GPT-4's codebase understanding with ctags | aider](https://aider.chat/docs/ctags.html)
- [aider/aider/website/docs/repomap.md](https://github.com/Aider-AI/aider/blob/main/aider/website/docs/repomap.md)
- [Repository Mapping System | Aider-AI/aider | DeepWiki](https://deepwiki.com/Aider-AI/aider/4.1-repository-mapping-system)
- [How Aider's repomap uses PageRank to rank your codebase](https://anishgandhi.com/aider-pagerank-codebase-ranking/)
- [GitHub - pdavis68/RepoMapper](https://github.com/pdavis68/RepoMapper)
- [AGENTS.md](https://agents.md/)
- [Best practices for Claude Code - Claude Code Docs](https://code.claude.com/docs/en/best-practices)
- [claude-md-size | claudelint](https://claudelint.com/rules/claude-md/claude-md-size)
- [On the Impact of AGENTS.md Files on the Efficiency of AI Coding Agents (arXiv)](https://arxiv.org/html/2601.20404v2)
- [The research is in: your AGENTS.md is probably too long - Upsun Developer](https://developer.upsun.com/posts/ai/agents-md-less-is-more)
- [Context Length Alone Hurts LLM Performance Despite Perfect Retrieval (arXiv)](https://arxiv.org/html/2510.05381v1)
- [Stop Feeding Your AI Agent the Whole Repo: Build a Project Brain](https://blog.jenuel.dev/blog/build-ai-agent-project-brain-without-overloading-context)
- [Code Search for AI Agents: ripgrep, ast-grep, or Semantic?](https://ceaksan.com/en/code-search-for-ai-agents-which-tool-when)
- [Repomix | Pack your codebase into AI-friendly formats](https://repomix.com/)
- [GitHub - yamadashy/repomix](https://github.com/yamadashy/repomix)
- [Right-Sizing Your Python Files: The 150–500 Line Sweet Spot for AI Code Editors](https://medium.com/@eamonn.faherty_58176/right-sizing-your-python-files-the-150-500-line-sweet-spot-for-ai-code-editors-340d550dcea4)
- [Function size limits for AI code](https://scanaislop.com/blog/function-size-limits-for-ai-code/)
- [Rules | Cursor Docs](https://cursor.com/help/customization/rules)
- [RepoAgent - PyPI](https://pypi.org/project/repoagent)
- [I Built a Tool That Updates Your Docs Every Time You Commit Code](https://dev.to/sarupurisailalith/i-built-a-tool-that-updates-your-docs-every-time-you-commit-code-4me8)
