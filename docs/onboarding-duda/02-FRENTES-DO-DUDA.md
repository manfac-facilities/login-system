# Frentes do Duda — Controle de Obras

> O que fazer, em que ordem, e o que significa "pronto" em cada uma.
> Leia antes: `00-CONTEXTO.md` e `01-REGRAS-DE-TRABALHO.md`.
>
> **Segunda versão, de 11/09/2026.** A primeira dividia o trabalho em F1/F2/F3 e
> envelheceu em 24 horas: a F1 (cliente da API do Field) foi executada por nós no commit
> `87acfd8`, a tela de sincronização veio junto no `5d8de8c`, e a F3 ("colunas mortas")
> foi absorvida por uma frente do João, porque era o mesmo buraco no mesmo arquivo. O
> porquê completo está em
> `docs/cliente/2026-08-31-sistema-controle-de-obras/divisao-trabalho-joao-duda.md`.

**Escopo:** apenas o **Controle de Obras** (`app/obras/`). Os outros três sistemas do hub
(`/sofia`, `/conversor-os`, `/admin`) e o `manfac-site/` estão fora — mesmo que você
encontre algo melhorável neles. As 7 suites de teste vermelhas do `manfac-site/` são
conhecidas e **não são suas**.

---

## O estado real, hoje

Números medidos no repositório em 11/09/2026. Se algum texto antigo divergir, o certo é
este:

| Fato | Valor |
|---|---|
| Código em `app/obras/` | 41 arquivos, 8.052 linhas |
| Testes do módulo | **294/294 passando**, 13 suites, 3.813 linhas |
| Comando do verde | `npx jest app/obras` |
| Migration `sdd-sql-obras-v0.sql` | **aplicada em produção em 10/09** — 5 tabelas `obras_*` com RLS, bucket `obras-fotos`, 3 policies de storage |
| Produção | **no ar**, build de 10/09 23h38; `/obras` responde |
| Git | `master` sincronizado com o remoto |
| Obras no banco | **zero, de propósito** |
| Banco real | **nada deste módulo jamais escreveu numa tabela de verdade** — os 294 testes usam mock |

**Duas coisas dessa tabela mudam o desenho do seu trabalho, e vale entender por quê:**

1. **A planilha do cliente não será importada** — decisão de 10/09, seguindo o cliente. A
   tela `/obras/importar` continua no código e continua funcionando, mas não é o caminho
   da base. Ela serve hoje como **modelo de código** para você, não como fonte de dados.
2. **A base vai nascer inteira do Field Control**, e a API do Field traz **três campos**:
   `os`, `loja` e `descricao`. As outras ~30 colunas de `obras_obra` chegam vazias. A base
   nasce incompleta por construção — encher essa obra é a frente J4, do João.

---

## Onde você vai morar

Duas pastas, e o João não vai tocar nelas enquanto você estiver lá:

```
app/obras/sincronizar/     ← a tela /obras/sincronizar e a regra da varredura
app/obras/_lib/field/      ← o cliente da API do Field Control (pronto, 12 arquivos)
```

O João estará em `app/obras/obra/[id]/`. **Isso é de propósito, não sorte:** duas frentes
no mesmo arquivo não rodam em paralelo, e a única regra de ordem deste documento nasceu
exatamente desse critério — está no fim.

O que já existe nessas duas pastas e **não é para refazer**:

- **`_lib/field/`** — autenticação por `X-Api-Key`, resolução do tipo "Atividade Spot",
  paginação, limitador de 1 req/s, normalização. Importe por `_lib/field/index.ts`, que é
  a fronteira pública; o resto é implementação e pode mudar de nome. A chave da API entra
  **por parâmetro** — essa camada não lê `process.env` de propósito.
- **`sincronizar/_sincronizacao.ts`** — funções puras que decidem, OS por OS, o que
  inserir, o que atualizar e o que ignorar. Sem rede e sem banco.
- **`sincronizar/_actions.ts`** — a Server Action que executa o plano: porteiro de admin,
  leitura do banco em lotes, gravação, relatório. **Ela nunca lança** — toda falha vira
  `{ error }` com texto legível.

A regra que o João escolheu e que **não se reabre**: **o Field só preenche o que está
vazio no banco.** Campo que alguém digitou no hub nunca é sobrescrito, mesmo que o Field
traga outro valor. Leia o cabeçalho de `_sincronizacao.ts` — o porquê está lá.

⚠️ **A sincronização ainda não rodou contra o Field de verdade.** A chave local foi validada
em 14/09 (J3: autentica, `q`, `sort=id` e timestamp completo funcionam), mas a gravação real
no banco não aconteceu. Você continua trabalhando contra mock, como todo o módulo.

---

## A ordem, e por que ela é essa

```
D1  Marcar de onde a obra veio     ──────────────►  começa já
D2  A OS que sumiu do Field              ──────────────►  depois do D1
D2.1 Herança da OS reaberta + N1 + N3     ───────►  ✅ mergeada em 14/09
D3  Sincronização que roda sozinha           ───────►  agora (mecanismo decidido em 14/09)
D4  Smoke test contra o banco real                ──►  quando a chave e o deploy existirem

depois de tudo: cancelamento de obra   ───────────►  quando o J4 mergear (leia o fim)
```

**D1 começa imediatamente** porque é pequeno, mexe em uma pasta só e é **pré-requisito do
D2** — sem saber quais obras vieram do Field, não há como perguntar "esta sumiu de lá?".
É também o seu primeiro contato com a base: uma hora de trabalho que ensina a forma do
código antes de você encarar o desenho difícil.

**D2 é a frente de verdade deste pacote.** É desenho de produto, não recado: você decide
como o sistema se comporta diante de um dado que sumiu.

**D3 já tem o mecanismo decidido** (14/09, no capítulo dela). A única trava agora é de
ordem: ela espera a D2.1, porque mexe nos mesmos arquivos.

**D4 depende de duas coisas que não são suas:** a chave da API e o deploy.

---

## D1 · Marcar de onde a obra veio

**Onde:** `app/obras/sincronizar/_sincronizacao.ts` (e o teste ao lado)
**Tempo estimado:** ~1 h
**Depende de:** nada

### O problema, verificado

A coluna existe: `origem text` em `sdd-sql-obras-v0.sql:69`, tipada como
`origem: string | null` em `_lib/tipos.ts:216`. Ela é **exibida** na ficha
(`obra/[id]/_ficha.tsx:563`) e na triagem (`obra/[id]/_triagem.tsx:176`).

A importação da planilha preenche essa coluna a partir da coluna "Origem" da aba
Planejamento (`_lib/importacao.ts:526`) — texto livre do cliente, valores como
`"Sistema DPSP"` e `"Garantia"`. A aba Pipeline não tem essa coluna e grava `null`
(`_lib/importacao.ts:429`).

**A sincronização do Field não grava `origem` nenhuma.** Confirme você mesmo: o tipo
`ObraNovaDoField` em `_sincronizacao.ts` tem exatamente quatro campos — `os`, `loja`,
`descricao`, `etapa`. A obra nasce com `origem` em `null`.

**Consequência:** nada no sistema consegue responder *"quais obras vieram do Field?"*. E
essa pergunta deixa de ser curiosidade no D2, onde a resposta define **quais obras a
varredura tem o direito de considerar ausentes**. Obra criada à mão no hub nunca vai
aparecer numa varredura do Field — e marcá-la como "sumiu" seria alarme falso garantido.

> ⚠️ **Um erro de leitura que já circulou, para você não repetir:** em
> `importar/_actions.ts` aparecem os literais `'pipeline'` e `'planejamento'`. Eles
> **não** são valores da coluna `origem` — são o campo `origem` do tipo `LinhaDescartada`
> (`_lib/importacao.ts:404`), que diz de qual aba veio a linha que o relatório descartou.
> Coisa diferente, mesmo nome. Sempre confira o tipo antes de copiar um literal.

### A decisão já foi tomada: coluna nova `fonte`

Esta seção **era** uma pergunta em aberto. O João respondeu em 11/09/2026, e a decisão é
**coluna nova**, não reuso da `origem`. As duas opções e o custo de cada uma:

| Opção | Custo | Efeito colateral |
|---|---|---|
| ~~Reusar a coluna `origem`~~ | zero — nenhuma migration | **descartada:** mistura o vocabulário do cliente (`"Sistema DPSP"`, `"Garantia"`) com o nosso (`"Field Control"`) na mesma coluna, que é exibida na ficha e na triagem |
| **Coluna nova `fonte`** ✅ | um arquivo `sdd-sql-*.sql` que **o João roda à mão** no Supabase | separa procedência de sistema do texto do cliente |

**Por que a coluna nova, apesar de custar uma migration:** contagem por procedência é
pergunta de negócio ("quantas obras vieram do Field este mês?"), e texto livre
compartilhado com o vocabulário do cliente torna essa contagem impossível. É o mesmo erro
que o avanço físico da planilha cometeu — `0.9` numa linha e `95` em outra querendo dizer
a mesma coisa — e que virou uma pergunta do cliente que ficou três dias sem resposta.

**E o momento é agora, de graça:** a base em produção está **vazia**, zero obras. A
migration não precisa fazer backfill de nada nem decidir o que fazer com linha antiga.
Daqui a um mês, com a base cheia, essa mesma mudança custa uma conversa sobre dados
existentes.

**O que você escreve:**

- `sdd-sql-obras-fonte.sql` na raiz, idempotente, dentro de `begin`/`commit`, seguindo o
  estilo de `sdd-sql-obras-v0.sql`. Coluna `fonte text` em `obras_obra`, **nullable e sem
  default**.
- **Um único valor no vocabulário hoje: `'field'`.** Minúsculo, sem acento — é chave de
  sistema, não texto de tela. Só a sincronização grava.
- **Você não roda a migration.** Escreve, avisa, e o João roda — é a regra 3 do
  `01-REGRAS-DE-TRABALHO.md`. Até ela rodar, o código que lê `fonte` não funciona em
  produção, e isso é esperado.

**Por que só um valor, e não `'planilha'` junto** (decidido em 11/09, depois de a pergunta
ser levantada): a tela `/obras/importar` existe no código, mas é resíduo da v0 — foi
construída para a carga inicial das 187 obras da planilha, antes de a integração com o
Field existir. **Em 10/09 o cliente decidiu que a planilha não será importada**, e a base
nasce inteira do Field. A rota hoje não está linkada de lugar nenhum: nada na interface
leva até ela.

Então `'planilha'` seria um valor permitido que nenhum código grava — e valor fantasma em
coluna é a semente da próxima confusão, exatamente o tipo de coisa que esta frente existe
para evitar. Se um dia a importação voltar a ser usada, acrescenta-se o valor **e** a
escrita no mesmo commit.

**Consequência prática, e ela é confortável:** obra com `fonte` nula significa *"não sei de
onde veio"*, e o D2 trata isso como **não mexe** — nunca marca ausência. Como a base está
vazia e só o Field escreve nela, na prática toda obra vai nascer com `'field'`.

**Se você achar mais limpo usar um `check` no banco**, use — `fonte text check (fonte in
('field'))` documenta o vocabulário no schema e falha cedo. Mas escreva-o de forma que
acrescentar um valor depois seja um `alter` simples, não uma reescrita da constraint sem
nome.

### O caminho natural no código

Olhe `planejarSincronizacao`, em `_sincronizacao.ts`. Ela monta um objeto
`doFieldEmColunas` com o que o Field sabe, no vocabulário das colunas do banco, e depois
passa por dois filtros. **Acrescentar a procedência nesse objeto faz o caminho de update
herdar a regra de graça:** `camposParaAtualizar` (`_lib/importacao.ts:680`) derruba
`null`, e o filtro logo abaixo derruba o que o banco já tem.

Consequência a decidir e a **escrever em comentário**, no estilo do arquivo: se você
puser a procedência nesse objeto, uma obra que já existia no banco **sem** procedência
passa a ser carimbada quando o Field a mencionar. Isso é defensável — o Field de fato a
conhece — mas é uma escolha, não um acidente. Deixe o motivo no código.

### O que NÃO fazer nesta frente

- ❌ Não mexa em `app/obras/obra/[id]/` — é o território do João.
- ❌ Não altere o que a importação da planilha grava, e **não faça ela gravar `fonte`**.
  Ela não vai rodar — a planilha foi descartada em 10/09 e a rota nem está linkada.
  ⚠️ Cuidado ao mexer em `_lib/importacao.ts`: apesar do nome, ele **não é só da
  planilha**. A `camposParaAtualizar` mora ali e é reusada pela sincronização do Field.
- ❌ Não aplique migration nenhuma. Escrever o `.sql` é seu; **rodar é do João** (regra 3
  do `01-REGRAS-DE-TRABALHO.md`).
- ❌ Não invente um terceiro valor de procedência "para o futuro". Duas portas de entrada
  existem hoje; a terceira se inventa quando existir.

### Pronto quando

- [ ] Obra criada pela sincronização nasce com a procedência gravada
- [ ] Teste em `sincronizar/__tests__/_sincronizacao.test.ts` provando isso na inserção
- [ ] Teste provando o comportamento escolhido no caminho de **update** (carimba ou não
      carimba obra que já existia — o que vocês decidiram)
- [ ] Se a opção foi coluna nova: arquivo `sdd-sql-*.sql` escrito, **não rodado**, e
      avisado ao João
- [ ] O motivo da escolha está em comentário no código, não só no PR
- [ ] `npx jest app/obras` continua em verde

---

## D2 · A OS que sumiu do Field

**Onde:** `app/obras/sincronizar/` — decisão em `_sincronizacao.ts`, execução em
`_actions.ts`, relatório em `_painel.tsx`
**Tempo estimado:** 5–8 h
**Depende de:** **D1 mergeado**

### Leia a fonte antes de tudo

`docs/cliente/2026-08-31-sistema-controle-de-obras/feedback-10-exclusao-de-os-no-field.md`
— **inteiro**. Ele tem a fala literal do cliente, a fala do João, a lista completa dos ~26
eventos de webhook do Field e as três perguntas que continuam em aberto. Este capítulo é
resumo; aquele arquivo é a fonte.

### O problema

O cliente perguntou, com estas palavras:

> abri uma OS errado no field como atividade spot, como o sistema vai se comportar se eu
> precisar excluir essa OS? eu excluo pelo field ou excluo pelo sistema?

E o João, em seguida:

> se excluir no field = perder o historico do sistema (acho arriscado demais, se um fdp
> vai la no field e exclui fudeu ne)

**Dois fatos decidem a maior parte disso:**

1. **O Field não avisa exclusão.** Não existe `order-deleted` nem `order-archived` entre
   os eventos de webhook — só `order-created` e `order-updated`. E a ausência é
   deliberada: existe "Exclusão de um anexo", ou seja, o Field emite evento de exclusão
   quando quer. Para ordem de serviço, ele não emite.
2. **O que o sistema guarda não existe no Field.** Diário do dia, fotos de evolução,
   respostas de "andou / não andou", motivos de bloqueio, tarefas geradas por falta,
   histórico de etapa com autor e data — nada disso tem contraparte lá.

### Por que "ausência" é um sinal fraco, e isso é o coração da frente

A única forma de o sistema perceber que uma OS saiu do Field é ela **deixar de aparecer
numa varredura**. Só que a mesma ausência acontece quando:

- a API falha ou devolve página incompleta;
- a paginação escorrega (por isso o `sort` do cliente é por campo imutável — leia o
  comentário de `ordenacao` em `_lib/field/cliente.ts`);
- o filtro muda, ou alguém corrige o tipo da OS no Field;
- a varredura roda incremental, com `updated_at>=`, e **por definição** não traz o que não
  mudou.

Esse último merece um parágrafo só: **numa varredura incremental, quase tudo está
ausente, e nada disso significa exclusão.** Se o D3 entrar depois com marca d'água, uma
regra de ausência escrita sem esse cuidado transforma o sistema inteiro em alarme. Desenhe
o D2 sabendo que o D3 vem.

**Apagar dado com base em ausência é apagar dado com base em suposição.**

### As três regras de desenho, e elas estão fechadas

**Regra 1 — O sistema nunca apaga nada por causa do Field.** Nenhuma exclusão,
arquivamento ou sumiço na origem remove obra, diário ou foto. A integração é entrada de
dados, não comando de destruição.

**Regra 2 — OS que some do Field vira ALERTA, não exclusão.** A obra é marcada como *"não
está mais no Field"*, mas continua inteira, com todo o histórico, esperando um humano
decidir. Se foi engano, o alerta some e ela volta.

**Regra 3 — Descartar é ação do sistema, feita por gente, e é reversível.** Pede motivo,
grava quem fez e quando, e a obra sai das telas do dia a dia sem sair do banco. É o
equivalente a arquivar, não a deletar. **É a resposta à pergunta do cliente: exclui pelo
sistema.**

### Decisão de 14/09/2026 — a identidade da obra é o `field_id`, não o número da OS

Pergunta levantada na preparação da D2: *"podemos incluir field_id na migration da D2 para
reconciliar pela identidade estável do Field?"* **Sim — decisão do João.**

**Por quê.** O `identifier` (número da OS) é único mas **editável pelo gestor no painel**
(`_lib/field/tipos.ts`, comentário do `idField`). Casando só pelo `os`, uma correção de
número no Field faz a sincronização **criar uma segunda obra**, e o histórico fica preso na
antiga — que em seguida cairia no alerta de sumiço. O falso desaparecimento é o sintoma; a
duplicata é a causa. E a base em produção tem **0 obras** (verificado em 14/09), então a
coluna entra sem backfill — mesmo raciocínio que fechou a D1.

**O que entra:**

1. **Coluna** `field_id text`, nullable, com índice único parcial
   `where field_id is not null`.
2. **Casamento na sincronização:** primeiro pelo `field_id`; se o `field_id` do banco estiver
   nulo, pelo `os`, gravando o `field_id` nesse momento (o mesmo padrão da `fonte` na D1).
3. **Obra nova** já nasce com `field_id` — o `idField` já vem normalizado da F1 e hoje é
   descartado na gravação.
4. **Obra encontrada pelo `field_id` com número diferente: o `os` segue o Field**
   (confirmado pelo João em 14/09). É exceção deliberada à regra "só preenche vazio" — o
   número é identificador do Field, não dado da operação — e por isso **não é silenciosa**:
   aparece no relatório como "número da OS alterado".
5. **Teste obrigatório:** OS com número corrigido no Field não cria duplicata nem gera
   alerta de ausência.

### Estado em 14/09/2026 — D2 mergeada, D2.1 antes da D3

A D2 (`3adbbfb` + ajustes `2c9a0cf`) foi **mergeada em 14/09**, depois de duas rodadas de
revisão independente (`docs/cliente/2026-08-31-sistema-controle-de-obras/review-d2-2026-09-14.md`
e o `-adendo.md`). A migration `sdd-sql-obras-field-reconciliacao.sql` **está aplicada em
produção**. Três pendências ficaram conhecidas e formam a **D2.1**, que vem **antes da D3**
(mesmos arquivos) e **antes do primeiro deploy com a chave do Field**:

**1. OS reaberta com o mesmo número herda o histórico.** O cliente respondeu **2B** em
14/09 (`pergunta-05-os-no-field-e-sincronizacao.md`), e o João confirmou a trava abaixo no
mesmo dia. Quando chega uma OS com `field_id` novo e o número pertence a uma obra com outro
`field_id`:

> ✅ **Mergeada em 14/09** (`3edba98`), na forma simplificada que saiu do conselho sobre a
> revisão (`conselho-revisao-d21-2026-09-14.md`). A regra abaixo foi **corrigida** depois
> das chamadas reais à API: `archived` existe e **404 não autoriza herança**. O que ficou
> fora pela régua está em `backlog-integracao-field.md`.

- **OS com `archived === true` na listagem é filtrada na entrada:** não cria obra e não
  conta como presente — arquivar no Field vale como "sumiu" para a regra da D2;
- consultar a OS antiga direto no Field (`GET /orders/:id` do `field_id` antigo) **só se
  ela não veio na varredura**;
- **só `archived === true` na consulta** → a obra existente recebe o `field_id` novo, limpa
  suspeita e alerta, e o relatório mostra **"OS reaberta: histórico herdado"**. 404, 422,
  campo ausente ou falha **não herdam**;
- **antiga ainda ativa** → não herda: é duplicidade, e fica como conflito visível;
- **consulta falhou ou veio inconclusiva** → não herda; tenta na próxima execução. Na
  dúvida, nunca junta;
- troca de números entre duas obras continua como conflito visível;
- a consulta fica numa função própria — a semântica de "arquivada" na API ainda não foi
  provada (J3) — e os quatro caminhos têm teste.

**Por que a trava:** herdar pelo número sem conferir é o erro que o `field_id` existe para
evitar — um número em duas OS ativas faria uma obra herdar diário e fotos da loja errada.
A trava cumpre a resposta do cliente no caso que ele descreveu (abrir errado, apagar,
abrir de novo) sem abrir esse buraco.

**2. N1 — o disjuntor de 20% conta só ausências ainda não alertadas.** Hoje alertas já
confirmados entram na conta e, sem fluxo de descarte, acumulam até desligar a detecção.

**3. N3 — tolerância no intervalo de 24h** (ex.: 20h). Sem ela, a completa do dia seguinte
que termina segundos antes empurra o aviso para 48h.

N2, N4 e N5 (adendo) entram se forem baratos.

### O que fazer

1. **Definir quando uma obra conta como ausente.** Uma varredura só não basta, e uma
   varredura incremental não serve como base. Escreva o critério explicitamente, com o
   raciocínio — é a parte mais importante da frente, e ela é de desenho, não de código.
2. **Guardar o alerta.** A coluna não existe; `ObraRow` em `_lib/tipos.ts` não tem nada
   parecido. Vai precisar de migration — você escreve o `.sql`, o João roda.
3. **Marcar e desmarcar.** Se a OS reaparece numa varredura seguinte, o alerta some
   sozinho. Isso é o antídoto direto contra o falso positivo.
4. **Mostrar.** O lugar natural é a base: `base/_etiquetas.tsx` já tem o padrão de
   etiqueta por estado (`EtiquetaOS`, `EtiquetaCobertura`, `EtiquetaMauUso`), e
   `base/_regras.ts` tem os filtros (`FiltroOs`, `FiltroMau`, `filtrar`). Siga a forma que
   está lá em vez de inventar outra. ⚠️ **Esses arquivos são compartilhados** — mudança
   aditiva e pequena; se a frente puxar você para uma reescrita deles, pare e fale com o
   João antes.
5. **Relatar.** A varredura já tem o vocabulário certo: toda OS que não entrou vira uma
   `OsIgnorada` com motivo, e o painel mostra. Obra marcada como ausente merece o mesmo
   tratamento — **nada some calado**.

### O atalho que resolve o caso concreto do cliente sem código nenhum

O caso que ele descreveu é *"abri uma OS errada como Atividade Spot"*. O sistema só puxa
OS desse tipo, filtrando por `service_id`. **Corrigir o tipo da OS no Field** já tira a OS
do filtro — sem excluir nada, sem perder a OS lá, sem destruir histórico aqui. É a
correção mais barata e a menos destrutiva, e ela é de processo, não de software.

Isso não dispensa o D2: o alerta continua sendo necessário para o dia em que alguém
excluir de verdade. Mas registre o atalho no que você escrever — resposta que evita código
vale mais que código.

### Três perguntas que são do cliente, e você não vai respondê-las

Estão em aberto, e quem fala com o cliente é o João:

- Obra marcada como "não está mais no Field" deve **sumir das telas** do dia a dia
  automaticamente, ou ficar visível com o alerta até alguém tratar?
- **Quem pode descartar** uma obra: qualquer analista, ou só administrador?
- Se a OS **reaparecer** no Field depois de descartada, ela volta sozinha ou precisa de
  reativação manual?

**Não escolha por conta própria e não pare esperando.** Vale aqui o mesmo princípio que
guiou a camada da API quando a "loja" ficou indefinida — e que está escrito em
`_lib/field/loja.ts`: **onde falta decisão de negócio, isole o ponto de variação em vez de
travar.** Implemente atrás de uma função ou de uma opção de configuração, com o padrão
mais conservador ligado, e deixe comentado o que muda quando a resposta chegar.

Conservador, aqui, quer dizer: **mostra o alerta, não esconde a obra.** Esconder dado sem
alguém ter pedido é a versão suave de apagar.

### O que NÃO fazer nesta frente

- ❌ **Não delete linha nenhuma**, de nenhuma tabela, por causa do Field. Nem `obras_obra`,
  nem `obras_diario`, nem foto do bucket. Isso é a Regra 1, e ela não tem exceção.
- ❌ Não marque ausência a partir de uma varredura que falhou no meio. Erro de rede não é
  evidência de exclusão — `_actions.ts` já tem o padrão de parar sem gravar quando a
  leitura sai parcial; leia aquele bloco antes de decidir o seu.
- ❌ Não implemente webhook. O Field não emite o evento que interessaria, e o mecanismo de
  varredura é decisão do João (D3).
- ❌ Não crie um mecanismo de "descarte" separado do cancelamento de obra. São a mesma
  necessidade, e unificar é decisão registrada — mas o cancelamento é a **próxima** frente,
  e ela tem trava de ordem. Leia o fim deste documento.
- ❌ Não use credencial real. Você não precisa dela.

### Pronto quando

- [ ] O critério de "esta obra sumiu do Field" está escrito em português, com o
      raciocínio, antes de existir em código
- [ ] O critério é **imune a varredura incremental** e a falha de rede, e há teste para
      cada um desses dois casos
- [ ] Só obras que vieram do Field podem ser marcadas (é para isso que o D1 existe) —
      com teste provando que obra criada à mão nunca é marcada
- [ ] Reaparecer no Field desmarca o alerta, com teste
- [ ] Nenhum `delete` foi escrito em lugar nenhum
- [ ] A obra marcada aparece na base com etiqueta, seguindo o padrão de
      `base/_etiquetas.tsx`
- [ ] O `.sql` da coluna nova escrito, **não rodado**, e avisado ao João
- [ ] As três perguntas em aberto estão isoladas em ponto de variação, com o padrão
      conservador ligado e comentado
- [ ] `npx jest app/obras` em verde

---

## D3 · Sincronização que roda sozinha

**Onde:** `app/obras/sincronizar/`
**Tempo estimado:** 4–7 h
**Depende de:** nada — **D2.1 mergeada em 14/09**. As decisões de mecanismo estão tomadas
— abaixo. **Pode começar.**

### Decisões do João — 14/09/2026

Respostas às seis perguntas do Duda (`entregas/2026-09-14-D3-perguntas-do-duda.md`). A
frequência veio do cliente (`pergunta-05-os-no-field-e-sincronizacao.md`, respostas 3A e
4A); o resto, do João. **Isto é o desenho — não reabra sem perguntar.**

**1. Agendador: `pg_cron` do Supabase chamando uma rota do hub via `pg_net`.**
`POST /api/obras/sincronizar`. As duas extensões **já estão instaladas** no projeto de
produção (verificado em 14/09). A lógica fica no Next, onde já está testada. Nada de Edge
Function (duplicaria a lógica em Deno), GitHub Actions (atraso e segredo fora da infra) ou
webhook do Field, por enquanto.

**2 e 4. Marca d'água e histórico: uma tabela só, `obras_sync_execucao`.**
Uma linha por execução: início, fim, tipo (`completa`/`incremental`), origem
(`agendada`/`botao`), status, erro, contagens do relatório e a marca d'água nova. **A marca
vigente é a da última execução com sucesso** — não guarde em outro lugar, senão vira duas
fontes da verdade e "só avança se deu certo" fica fácil de quebrar. As últimas execuções
aparecem em `/obras/sincronizar`.

**3. Autenticação sem usuário: segredo no cabeçalho + service role só nesta rota.**
- A rota exige `Authorization: Bearer <OBRAS_CRON_SECRET>`, comparado em tempo constante.
- Escrita com o `createAdminClient()` que já existe (`lib/supabase/admin.ts`). **Isto amplia
  uma regra do hub** — até aqui a service role só era usada em `app/admin/_actions.ts` — e
  foi decidido conscientemente pelo João.
- `/api/obras` fica **fora** do `matcher` do `middleware.ts`, de propósito: quem protege a
  rota é o segredo, não o login.
- O segredo mora no Vault do Supabase (lido pelo `pg_cron`) e no Environment do EasyPanel.
  **Quem configura os dois é o João/Claude**; o código só lê `process.env`.
- Obra criada por execução agendada fica com `criado_por` nulo; a autoria fica na linha da
  execução.

**5. Frequência (cliente: 3A e 4A).**
- Incremental **a cada 15 min, 24h, todos os dias**.
- Completa **uma vez por dia às 3h de Brasília** — `0 6 * * *` no `pg_cron`, que roda em UTC.
- Os dois configuráveis.
- Janela incremental com **10 min de margem** antes da marca; a marca é o **maior
  `updated_at` vindo do Field**, nunca o relógio do servidor.

**6. `updated_at>=` com timestamp completo:** a J3 responde. Até lá, o formato do `desde`
fica isolado num parâmetro — se o Field só aceitar data, a janela vira "desde o dia anterior".

**Três requisitos que entram junto:**
- **trava contra execução simultânea** (agendada + botão) no banco: índice único parcial em
  `status = 'rodando'`, com expiração para trava órfã;
- **o status vale pelo que ficou gravado na tabela**, não pela resposta ao `pg_net`, cujo
  timeout é curto;
- **contrato do botão:** insere e preenche vazio, nunca apaga nem mescla. A única junção
  permitida é a herança da D2.1.

A migration da D3 você escreve; quem aplica é o João/Claude.

### O problema

Hoje a sincronização é **um botão que alguém precisa lembrar de apertar**: `/obras/sincronizar`,
painel em `_painel.tsx`, ação em `_actions.ts`. A tela é de administrador do hub — a
checagem de verdade está na Server Action, e a da página só evita mostrar um botão que não
funcionaria.

Obra que não entra no sistema não é cobrada por ele. Um botão manual transforma o alarme
que o projeto existe para dar numa função da memória de alguém.

### O que a frente precisa resolver, qualquer que seja o mecanismo

1. **Marca d'água.** A varredura recorrente não pode reler a base inteira toda vez. O
   cliente da API já aceita isso: `listarOsNormalizadas({ desde })` vira o filtro
   `updated_at>=`, e o tipo `OpcoesDaVarredura` está em `_lib/field/cliente.ts`. O que
   falta é **onde guardar o "desde quando"** e como avançá-lo.
2. **Avançar a marca só quando a passada deu certo.** Marca avançada depois de uma
   varredura que falhou no meio é o jeito silencioso de perder OS para sempre — elas nunca
   mais entram na janela.
3. **Autoria e porteiro.** A ação de hoje exige usuário logado e administrador, e usa o
   client do usuário. Rodando sozinha não há usuário. **Isso é problema de desenho, não
   detalhe de implementação** — e mexe em como a escrita autentica, o que toca decisão de
   segurança do hub. Traga ao João em vez de resolver sozinho.
4. **Registro do que aconteceu.** Varredura que roda sozinha e não deixa rastro é
   varredura que ninguém sabe se rodou. O relatório já existe como tipo
   (`RelatorioSincronizacao`) — hoje ele vive na tela e morre com ela.
5. **Conviver com o D2.** Marca d'água e detecção de ausência se contradizem se o desenho
   for ingênuo. Releia a seção "por que ausência é um sinal fraco".

### As incógnitas da API — provadas em 14/09/2026 (J3)

Rodadas com a chave real, só leitura (`docs/cliente/2026-08-31-sistema-controle-de-obras/j3-verificacao-api-2026-09-14.md`):

| Pergunta | Resposta |
|---|---|
| A chave autentica? | **Sim** |
| O `q` com dois filtros combinados é aceito? | **Sim** |
| `sort=id` é ordenação válida? | **Sim** |
| `updated_at>=` aceita timestamp completo? | **Sim** — aceita data pura e ISO completo. Use o timestamp |
| OS arquivada continua listada em `/orders`? | **Não provado ainda.** O cliente confirmou que excluir no Field arquiva (resposta 1B); se a API continuar listando arquivada, a ausência nunca acontece e o alerta da D2 nunca dispara. Isso precisa de um caso real para testar — mantenha o comportamento isolado |

Fato de contexto: em 14/09 o Field tinha **167 OS "Atividade Spot"**, e o banco, zero obras.

### O que NÃO fazer nesta frente

- ❌ Não reabra o desenho da D2/D2.1 dentro da D3. O que ficou de fora está em
  `backlog-integracao-field.md` e entra quando a dor aparecer.
- ❌ Não configure webhook por conta própria — e note que o Field não emite os eventos que
  resolveriam isso.
- ❌ Não toque no painel do EasyPanel nem em nada de produção. Credencial de produção é do
  João, por critério, não por desconfiança.
- ❌ Não faça a varredura automática apagar, mesclar ou "limpar" nada. Ela insere e
  preenche vazio — o mesmo contrato do botão.

### Pronto quando

- [x] O mecanismo está decidido pelo João e registrado por escrito **antes** do primeiro
      commit (14/09, seção "Decisões do João" acima)
- [ ] A marca d'água é persistida e só avança quando a passada terminou inteira, com teste
      para o caso de falha no meio
- [ ] A varredura recorrente reusa `listarOsNormalizadas({ desde })` e
      `planejarSincronizacao` — sem segunda implementação da regra
- [ ] Cada passada deixa registro consultável do que fez
- [ ] A decisão de autoria/porteiro (item 3 acima) está implementada e explicada em
      comentário no código
- [ ] Trava contra execução simultânea, com teste
- [ ] Rota `/api/obras/sincronizar` recusa pedido sem o segredo, com teste
- [ ] O botão manual continua funcionando, com teste
- [ ] `npx jest app/obras` em verde

---

## D4 · Smoke test contra o banco real

**Onde:** roteiro executado nas telas, mais um documento de achados
**Tempo estimado:** 2–3 h
**Depende de:** a chave `FIELD_API_KEY` existir e o deploy ter subido — **as duas são
trabalho do João** (J1 e J2)

### Por que esta frente existe

**Nada deste módulo jamais tocou um banco real.** Os 294 testes são todos de unidade com
mock. Isso era aceitável enquanto não havia migration; agora ela está aplicada, o módulo
está **no ar e vazio**, e o primeiro dado real entraria sem ninguém ter provado o caminho.

É muito melhor que o primeiro contato com o Supabase de verdade aconteça com você, num
roteiro, do que com a equipe do cliente numa sala de treinamento.

### O que mudou em relação ao roteiro antigo

O roteiro da versão anterior começava importando a planilha. **Esse passo saiu**: a
planilha não será importada, por decisão de 10/09. O roteiro agora começa pela
sincronização do Field — e, se a chave ainda não tiver chegado, por **uma obra criada à
mão diretamente no banco**, que serve para exercitar as telas mesmo sem a integração.

### O roteiro, na ordem

1. **Sincronizar com o Field** em `/obras/sincronizar` e **ler o relatório**: quantas
   novas, quantas atualizadas, quantas inalteradas, e cada OS ignorada com o motivo. É o
   primeiro contato da varredura com dado real.
   *Sem a chave:* crie uma obra à mão no banco, com `os`, `loja` e `descricao` — os três
   campos que o Field traria — e siga do passo 2.
2. **Sincronizar de novo, sem mudar nada no Field.** A segunda passada tem que dar
   "inalteradas" e não duplicar obra nenhuma. É o teste da idempotência, e é o tipo de
   coisa que só o banco real prova.
3. Abrir a base: tabela e kanban, os 4 filtros, a ordenação.
4. Triar uma obra: distribuir para um responsável, definir prioridade, início e duração.
5. Responder o diário de uma obra: andou.
6. Responder outra: não andou, com motivo — e confirmar que o contador de dias parados
   sobe.
7. **Desfazer** uma resposta e confirmar que o contador volta.
8. Anexar foto no diário e conferir que ela aparece em "Evolução em fotos" na ficha.
9. Conferir que a falta virou tarefa em `/obras/tarefas`.
10. Mover etapas na ficha até `faturado`.

Preste atenção especial ao passo 2: a regra "o Field só preenche o que está vazio" nunca
foi exercitada contra dado real. Edite um campo na tela, sincronize de novo e confirme que
**o que você digitou continua lá**.

### O que NÃO fazer nesta frente

- ❌ **Não conserte o que encontrar durante o teste.** Registre tudo primeiro. Consertar no
  meio do roteiro perde o resto dos achados, e a prioridade do conserto é decisão do João.
- ❌ Não rode o roteiro com dados que atrapalhem o cliente. A base está vazia porque ela vai
  nascer do Field depois do pente fino dele — combine com o João o que você pode deixar lá
  e o que precisa sair.
- ❌ Não mexa no painel do EasyPanel nem no SQL Editor do Supabase por conta própria.

### Pronto quando

- [ ] Os dez passos executados, cada um com resultado anotado
- [ ] O passo 2 (sincronizar duas vezes) provou idempotência e provou que o digitado no hub
      sobreviveu
- [ ] Documento em `docs/cliente/2026-08-31-sistema-controle-de-obras/` com o que
      funcionou, o que quebrou e o que ficou estranho mas não quebrou
- [ ] Cada defeito encontrado com **passo de reprodução**, não só descrição
- [ ] Nada foi consertado durante o roteiro

---

## ⚠️ A restrição de ordem, e ela é dura

**A próxima frente depois destas quatro é o cancelamento de obra. Ela só começa depois que
a frente J4 do João (Triagem e ficha editáveis) estiver mergeada.**

### Por que ela existe

O cliente pediu, em 10/09, com estas palavras:

> as vezes o cliente cancela a OS... entao tem que ter essa etapa, e ai se cancelar coloca
> o motivo do cancelamento. "Cancelado pelo Cliente" / "Cancelado pela Manfac"

É requisito real e não existe no modelo. Hoje `_lib/tipos.ts` tem nove etapas, e todas
descrevem uma obra que **avança**: `definir` → `levantamento` → `andamento`/`paralisado`
→ `relatorio` → `aprovarOS` → `fecharOS` → `pendFat` → `faturado`. **Não existe saída
lateral.** Uma obra cancelada ficaria parada numa etapa qualquer, contando dias de "não
andou", gerando tarefa de cobrança e aparecendo como problema no diário de alguém — o tipo
de lixo que faz gente abandonar a ferramenta e voltar para a planilha.

E ela resolve **de graça** o caso do feedback 10: OS aberta por engano vira "Cancelado
pela Manfac", motivo "erro de cadastro". Cancelar e descartar são a mesma necessidade.

A fonte é
`docs/cliente/2026-08-31-sistema-controle-de-obras/feedback-11-cancelamento-de-obra.md`.

### Por que ela espera

Porque ela toca **exatamente** os arquivos do J4:

| Arquivo | Por que o cancelamento mexe nele | Por que o J4 mexe nele |
|---|---|---|
| `_lib/tipos.ts` | etapa terminal nova | os campos que a triagem passa a gravar |
| `base/_regras.ts` | filtro e cor da etapa nova | as obras mudam de estado |
| `obra/[id]/_actions.ts` | a ação de cancelar | é o arquivo central da frente dele |
| `diario/` e `tarefas/` | obra cancelada sai da cobrança | a obra completa muda o que aparece |

Tocar os dois ao mesmo tempo garante conflito de merge no arquivo mais delicado do módulo
— e `obra/[id]/_actions.ts` é esse arquivo. **Não é preferência de organização: é o
critério que definiu a divisão inteira**, e é por isso que as suas quatro frentes vivem em
`sincronizar/` e `_lib/field/`, onde o João não entra.

**Não comece o cancelamento antes de confirmar que o J4 foi mergeado.** Confirme olhando
o `master`, não perguntando "já deu?".

### Quando começar, o desenho já está esboçado — e tem três perguntas abertas

O esboço (etapa terminal alcançável de qualquer etapa, campos `cancelado_por`,
`cancelado_motivo`, `cancelado_em`, `cancelado_quem`, saída imediata do diário e das
tarefas, reversível por ação humana) está no feedback 11. **`cancelado_por` é campo
estruturado, não texto livre** — o porquê está lá, e vale ler: é a mesma armadilha que o
avanço físico da planilha caiu, com `0.9` numa linha e `95` em outra.

**As três perguntas foram respondidas pelo cliente em 14/09/2026**
(`docs/cliente/2026-08-31-sistema-controle-de-obras/pergunta-07-cancelamento-e-pedido-de-compra.md`):

- **Quem cancela: qualquer pessoa com acesso** ao módulo (1A). Sem trava por papel.
- **Obra já executada não se cancela** (2B): segue a esteira até faturar o que foi feito. Na
  prática, "Cancelar" só existe **antes** de a execução em campo ser concluída — o que deixa
  a frente menor, não maior.
- **No Field, a OS cancelada continua ativa, com status "cancelado"** — talvez arquivada no
  futuro (3B). A D2.1 só reage a `archived`, e a J3 não encontrou campo de status em
  `/orders`. **Portanto o cancelamento é manual no sistema.** Não tente detectá-lo pela
  sincronização sem uma verificação da API antes (ver também `feedback-13-os-duplicadas-no-field.md`).

Na mesma resposta vieram duas decisões que **não são desta frente**, mas mexem nos mesmos
arquivos: a etapa `aprovarOS` passa a se chamar **"Executado - pendente aprovação OS"**, e o
**pedido de compra (número + data) é pré-requisito para faturar**. As duas entram com a J4 e
com a frente de pedido de compra — não as antecipe aqui.

---

## Resumo

| | Frente | Tempo | Começa quando |
|---|---|---|---|
| **D1** | Marcar de onde a obra veio | ~1 h | **agora** |
| **D2** | A OS que sumiu do Field | 5–8 h | D1 mergeado |
| **D2.1** | Herança da OS reaberta, N1 e N3 | 1–3 h | ✅ mergeada em 14/09 |
| **D3** | Sincronização que roda sozinha | 4–7 h | **agora** (mecanismo decidido em 14/09) |
| **D4** | Smoke test contra o banco real | 2–3 h | chave `FIELD_API_KEY` + deploy |
| — | *Cancelamento de obra* | *a estimar* | *J4 mergeado* |

**Total das quatro: 12–19 h.**

Três das quatro são de escopo fechado e verificáveis por teste. A D2 não é: ela é uma
decisão de produto de verdade, e o desenho que você escrever vira o comportamento do
sistema diante de um dado que sumiu. É de propósito que ela esteja aqui.
