# Brief — mockup dos ajustes da ficha da obra (22/09/2026)

**Quem aprova:** o João (decisão de 22/09). O cliente vê direto no ar. Feedback volta pelo chat,
por seção — **sem campos de revisão na página**.

**Fonte do pedido (ler antes, literal):**
- `docs/cliente/2026-09-22-feedback-ficha-obra-j4.md` (item C)
- `docs/cliente/2026-09-22-feedback-esteira-e-equipes.md` (equipe/prestador como texto livre + decisões)

**Base visual:** reutilizar o CSS e a linguagem do mockup aprovado
`docs/cliente/2026-08-31-sistema-controle-de-obras/mockup-j4-v03.html`. Tema do hub (fundo `#0a1628`,
navy `#0d2050`, laranja `#f05a28`, texto secundário `#94a3b8`, bordas `#1e3a5f`). **Cor não é
proposta** — não inventar paleta.

**Reconciliar com o código real antes de desenhar** (a tela existe em produção):
- esteira: `app/obras/_lib/tipos.ts:127-184`, `app/obras/obra/[id]/_ficha.tsx` (~200-600)
- concluir etapa / marcos: `app/obras/obra/[id]/_actions.ts` (`mudarEtapaAction`, `calcularMarcosDaEsteira`, ~263-400)
- equipe: `app/obras/obra/[id]/_triagem.tsx`, `_bloco-cronograma.tsx`, `page.tsx:48-67,176`, `EQUIPES_PISO`
- Desenhe a tela como ela é HOJE, mudando só o que este brief pede.

## Seção 1 — Nome da etapa de desvio

A etapa `aprovarOS` aparece hoje como **"Pendente fechamento"**. A versão 2 do mockup J4 (aprovada)
a renomeou para **"Executado - pendente aprovação OS"**. Mostrar a esteira com o nome novo, nos
dois caminhos (com o desvio e com a OS já aprovada, desvio apagado). Deixar claro visualmente que
**"Fechar OS" sempre existe** nos dois caminhos — foi o que o cliente temeu.

## Seção 2 — Data de fechamento da OS

Pedido do cliente: ao concluir "Fechar OS", gravar a **data de fechamento da OS**; por padrão hoje,
mas editável, porque ele pode ter fechado no sistema do cliente ontem ou há 2 dias. E poder
corrigir depois.

Desenhar, com interação real (clique abre, troca de estado):
1. A janela "Concluir Fechar OS" com o campo **"Data de fechamento da OS"**, preenchido com hoje,
   editável. Regra: **não aceita data futura** (mostrar a mensagem de erro inline) e não aceita
   data anterior à conclusão do relatório de entrega/aprovação (mensagem clara). O texto da janela
   diz que essa data inicia os "dias esperando o faturamento".
2. O passo "Fechar OS" já concluído na esteira mostrando a data e a ação **"corrigir data"**, que
   abre edição inline/janela pequena. Dizer que a correção fica no histórico (quem, quando,
   de → para).
3. Estados: salvando · salvo · erro ao salvar (visivelmente diferentes).

Só "Fechar OS". "Faturado" fica como está (não foi pedido).

## Seção 3 — Equipe / prestador em texto livre

Hoje é um `<select>` fixo (inclui "Prestador a contratar"). O cliente quer texto livre "pra não
limitar e ficar errado". Desenhar um **campo de texto com sugestões** (as equipes já usadas
aparecem como sugestão enquanto digita, mas qualquer texto é aceito). Mostrar nos dois lugares em
que aparece (triagem de obra nova e bloco de cronograma). Estados: vazio, digitando com sugestões,
texto novo que não está na lista (aceito, sem erro), salvo.

## Regras

- Dados de exemplo plausíveis (obras DPSP / Drogarias Pacheco, ex.: "DP ITABORAI", equipes reais
  que aparecerem no código). Nada de "Item 1".
- Nunca mencionar demissão ou saída de alguém.
- Um arquivo HTML único, sem dependências fora de cdnjs/jsdelivr/Google Fonts. Deve funcionar na
  largura de celular.
- Cada seção termina com uma caixa "**O que julgar aqui**" (2-4 perguntas objetivas ao João).
- **Não publique.** Grave em
  `docs/cliente/2026-08-31-sistema-controle-de-obras/mockup-ajustes-ficha-2026-09-22.html`
  e devolva um resumo curto + qualquer divergência encontrada entre este brief e o código.
