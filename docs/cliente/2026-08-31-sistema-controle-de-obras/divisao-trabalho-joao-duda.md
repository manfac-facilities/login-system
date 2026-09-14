# Divisão de trabalho — João e Duda

**Segunda versão, decidida em 11/09/2026.** A primeira é de 10/09 e está no histórico do
git — envelheceu em 24 horas, pelos motivos registrados abaixo. **Escopo do Duda: apenas o
Controle de Obras** (`app/obras/`) — decisão do João, como teste da parceria. Se der
certo, amplia.

> **A fonte detalhada é o pacote de onboarding**, em `docs/onboarding-duda/`:
> `00-CONTEXTO.md`, `01-REGRAS-DE-TRABALHO.md` e `02-FRENTES-DO-DUDA.md`.
> Este arquivo registra só a decisão e o porquê dela.
>
> Página para o Duda validar:
> https://claude.ai/code/artifact/03377e53-2156-4ae1-8257-4e844e28fc54

## Por que a divisão de 10/09 não valia mais

Três fatos, todos verificados no repositório antes de redividir:

1. **A F1 do Duda foi executada por nós** — commit `87acfd8`, 10/09 às 22h23: o cliente da
   API do Field Control, 12 arquivos e 1.773 linhas. Era a frente que abria o trabalho
   dele. Ele nunca chegou a começar: não há branch, PR nem commit do `daduu27`.
2. **A 1c também foi executada** — commit `5d8de8c`, 11/09 às 02h22: `/obras/sincronizar`,
   com a regra de que o Field só preenche o que está vazio.
3. **A frente 0 foi concluída**: migration aplicada em produção, 82 commits pushados,
   deploy feito, `/obras` no ar.

Sobravam ao Duda a F2 (smoke test) e a F3 (colunas mortas) — 4 a 7 horas, pequeno demais
para justificar o onboarding, e a F3 colidindo com a 1a no mesmo arquivo.

## O fato que redesenhou a divisão

**A API do Field traz três campos**: `os`, `loja` e `descricao`. A tabela `obras_obra` tem
cerca de 30 outras colunas — `aprovacao`, `os_aprovada`, `inicio_plan`, `duracao`, equipe,
valor, os seis marcos — e **todas chegam vazias**. Com a planilha fora (decisão de 10/09),
a base nasce inteira do Field, e portanto nasce incompleta por construção.

Isso promove a antiga 1a de "bloqueador conhecido" a **única porta de entrada de dado real
do sistema**, e tem consequência direta no mecanismo central: sem `aprovacao` preenchida,
**nenhuma obra jamais vira crítica** — que é o alarme que o projeto existe para dar.

**E desmonta a F3.** As tais "colunas mortas" — `os_aprovada`, `marco_exec_fim`,
`marco_relatorio`, `marco_os_aprov` — não estão mortas: são **lidas em 20 lugares**
(`base/_kanban.tsx`, `base/_etiquetas.tsx`, `base/_regras.ts`, `obra/[id]/_ficha.tsx`) e
**nunca escritas por ninguém**. F3 e 1a são o mesmo buraco, no mesmo arquivo. Separá-las
garantiria conflito de merge, então a F3 foi absorvida pela J4.

## Critério, em ordem de peso

1. **Credencial** — o que só uma pessoa executa não é divisível. Mudou um item: o push
   deixou de ser barreira em 10/09, quando a `Mainsis` virou admin do repositório.
   Continuam atrás de credencial do João o Supabase, o deploy no EasyPanel e a chave da
   API do Field.
2. **Canal com o cliente** — frente que depende de decisão do cliente fica com quem fala
   com ele. Hoje são **quatro** perguntas em aberto, não duas.
3. **Sobreposição de arquivo** — duas frentes no mesmo arquivo não rodam em paralelo.
   Este critério gerou a restrição de ordem do fim deste documento.

## João — produção, cliente e a porta de entrada do dado

| # | Frente | Por quê | Tempo | Tokens (est.) |
|---|---|---|---|---|
| J1 | A chave da API do Field | Trava tudo o que está construído: a sincronização existe e está testada, mas nunca rodou contra o Field de verdade. Vai para o `.env.local` da raiz (teste; ignorado pelo git) **e** para o EasyPanel como `FIELD_API_KEY=valor` numa linha só | 15 min | ~10 k |
| J2 | Deploy da sincronização | `/obras/sincronizar` está no `master` desde 11/09 02h22; o build em produção é de 10/09 23h38. A tela não existe em produção até alguém clicar em Deploy | 10 min + espera | ~20 k |
| J3 | Provar as quatro incógnitas da API | Depende do J1. Codificação do `q`, `sort=id` como campo válido, `updated_at>=` com timestamp ou só data, e se a OS é arquivada ou excluída no Field. Cada uma custa meia hora durante o cadastro do cliente | 1–2 h | 0,2–0,4 M |
| J4 | Completar a obra — Triagem e ficha editáveis | A frente de maior valor agora: transforma a OS de três campos numa obra de verdade. Absorve a antiga F3. Arquivos: `obra/[id]/_triagem.tsx`, `_ficha.tsx`, `_actions.ts` | 5–8 h | 0,8–1,4 M |
| — | Fechar as quatro perguntas com o cliente | Único canal com o cliente: como se calcula o avanço %, quem pode cancelar uma obra, se obra cancelada some ou fica com alerta, e o que acontece se a OS reaparecer no Field depois de descartada | 20 min + espera | ~25 k |

**Frentes de código: 6–10 h · 1,0–1,8 M**

## Duda — dono do ciclo de vida da OS

O pacote inteiro vive em **duas pastas que o João não vai tocar**: `app/obras/sincronizar/`
e `app/obras/_lib/field/`. Enquanto o João estiver em `obra/[id]/`, os dois trabalham no
mesmo repositório sem se cruzarem — critério 3 aplicado de propósito, não por sorte.

| # | Frente | Por quê | Tempo | Tokens (est.) |
|---|---|---|---|---|
| D1 | Marcar de onde a obra veio | Pré-requisito do D2: hoje **nada distingue uma obra que veio do Field**, e a reconciliação precisa saber disso antes de qualquer outra coisa. **Decidido em 11/09: coluna nova `fonte`** (só `'field'` &mdash; a planilha foi descartada), não reuso da `origem` — ver abaixo. O Duda escreve o `.sql`, o João roda | 1–2 h | 0,1–0,3 M |
| D2 | A OS que sumiu do Field | O desenho mais delicado do módulo, e o cliente já levantou: *"abri uma OS errada, como o sistema se comporta se eu precisar excluir?"*. O Field **não avisa exclusão** — não existe `order-deleted` nem `order-archived` entre os ~26 webhooks. Só se descobre por ausência, e ausência também acontece se a API falhar ou a paginação escorregar. Duas regras fechadas: o sistema nunca apaga por causa do Field, e sumiço vira **alerta**, não exclusão. Fonte: `feedback-10-exclusao-de-os-no-field.md` | 5–8 h | 0,8–1,4 M |
| D3 | Sincronização que roda sozinha | Hoje é um botão que alguém precisa lembrar de apertar — e obra que não entra no sistema não é cobrada por ele. Precisa de varredura recorrente com marca d'água (`updated_at>=` da última passada). ⚠️ **O mecanismo ainda não está decidido**; o João escolhe antes de a frente começar | 4–7 h | 0,6–1,1 M |
| D4 | Smoke test contra o banco real | Todos os testes do módulo usam mock: nada aqui jamais escreveu numa tabela de verdade. Era aceitável sem migration; agora ela está aplicada e o módulo está no ar vazio, e o primeiro dado real entraria sem ninguém ter provado o caminho | 2–3 h | 0,2–0,3 M |

**Total: 12–20 h · 1,7–3,1 M**

### A correção que o D1 sofreu, e vale registrar como se descobriu

A primeira redação desta tabela dizia que *"a importação da planilha grava
`origem: 'pipeline'` ou `'planejamento'`"*. **Está errado, e o erro veio de um `grep`
superficial.** O código diz outra coisa:

- A coluna `origem` de `obras_obra` (`sdd-sql-obras-v0.sql:69`, `text` livre) recebe a
  coluna **"Origem" da aba Planejamento** da planilha (`_lib/importacao.ts:526`) — é
  **vocabulário do cliente**, com valores como `Sistema DPSP`. A aba Pipeline grava `null`
  (`_lib/importacao.ts:429`).
- Os literais `'pipeline'` e `'planejamento'` pertencem ao tipo `LinhaDescartada`
  (`_lib/importacao.ts:404`): dizem **de qual aba** veio uma linha que ficou de fora, para
  o relatório da importação. Mesmo nome de campo, significado completamente diferente.

**Consequência real, e é por isso que o registro importa:** reusar `origem` para marcar
procedência misturaria "de que sistema a obra veio" com um texto que é do cliente e
aparece em duas telas.

**Decisão do João, 11/09/2026: coluna nova `fonte`**, nullable, sem default, e com **um
único valor hoje: `'field'`**. O Duda escreve a migration `sdd-sql-obras-fonte.sql`; o João
a roda.

> **Correção do mesmo dia, e ela veio de quem estava começando.** A primeira redação desta
> decisão previa três valores — `'field'`, `'planilha'` e `'manual'` — e mandava a
> importação gravar `'planilha'`. O Duda apontou duas contradições reais: o próprio
> documento já dizia "não altere o que a importação grava" e "não invente um terceiro valor
> de procedência para o futuro". Ele estava certo nas duas. **A planilha foi descartada em
> 10/09 e a rota `/obras/importar` nem está linkada na interface**; não existe fluxo de
> cadastro manual, e o cliente já disse que não vai existir — a obra vem sempre do Field.
> Valor permitido que nenhum código grava é semente de confusão, então ficou só `'field'`.
> Obra com `fonte` nula significa "não sei de onde veio", e o D2 trata isso como não mexe. O peso da escolha foi o momento: **a base em produção está vazia**, então a migration
não precisa de backfill nem de decisão sobre linha antiga — a mesma mudança daqui a um mês
custaria uma conversa sobre dados existentes. E contagem por procedência é pergunta de
negócio, que texto livre compartilhado com o vocabulário do cliente torna impossível.

O achado é de uma revisão independente: quem escreveu a divisão não foi quem detalhou as
frentes. É exatamente o que "quem executa e quem confere nunca são o mesmo" compra.

## A restrição de ordem

⚠️ **O cancelamento de obra fica para depois do J4 mergeado.** O cliente pediu a frente em
10/09 — *"às vezes o cliente cancela a OS... então tem que ter essa etapa, e aí se cancelar
coloca o motivo"*, com os dois valores que ele mesmo nomeou (**Cancelado pelo Cliente** e
**Cancelado pela Manfac**). É requisito real, e resolve de graça o caso da OS aberta por
engano: cancelar e descartar são a mesma necessidade.

Mas ela toca `_lib/tipos.ts` (uma etapa terminal nova), `base/_regras.ts`,
`obra/[id]/_actions.ts`, `diario/` e `tarefas/` — exatamente onde o J4 estará mexendo.
Começar em paralelo é garantir merge doloroso. É a **próxima frente do Duda**, assim que o
J4 estiver mergeado. Fonte: `feedback-11-cancelamento-de-obra.md`.

## Notas sobre o equilíbrio

A divisão de 10/09 dava 10–16 h ao João contra 10–17 h ao Duda. Esta dá **6–10 h ao João
contra 12–19 h ao Duda** — e a inversão é deliberada, não descuido. O que sobrou no João é
curto porque é **caro de outro jeito**: é onde estão a credencial de produção, o canal com
o cliente e a frente que, se sair errada, sai errada para o cliente na semana do cadastro.

Com o Duda ficam frentes de escopo fechado, verificáveis por teste, sem acesso a produção
— que continua sendo o formato certo para um primeiro trabalho em parceria — mas agora com
**uma decisão de produto de verdade dentro** (o D2 desenha o comportamento do sistema
diante de um dado que sumiu). É um degrau acima do pacote de ontem, e é de propósito.

## Correções de estimativas anteriores, mantidas para registro

A primeira versão desta divisão dava ao Duda uma frente de "foto diária" estimada em
4–6 h. **Esse trabalho já estava construído** — `diario/_foto.tsx`, upload com redução,
`foto_path`, signed URL, bloco "Evolução em fotos" (`_ficha.tsx:627`) e o aviso de dia sem
foto (`_ficha.tsx:702`), mais bucket e policies na migration. A decisão L do `ESTADO.md`
("tela na v1") foi lida como pendência quando era entrega da v0.

Também está fora do escopo do Duda a higiene das 7 suites de `manfac-site/`: não é
Controle de Obras.
