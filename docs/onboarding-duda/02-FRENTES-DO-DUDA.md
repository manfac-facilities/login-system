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

⚠️ **Nada disso jamais rodou contra o Field de verdade.** Falta a chave `FIELD_API_KEY`,
que é frente do João (J1). Você vai trabalhar contra mock, como todo o módulo.

---

## A ordem, e por que ela é essa

```
D1  Marcar de onde a obra veio     ──────────────►  começa já
D2  A OS que sumiu do Field              ──────────────►  depois do D1
D3  Sincronização que roda sozinha           ───────►  quando o João decidir o mecanismo
D4  Smoke test contra o banco real                ──►  quando a chave e o deploy existirem

depois de tudo: cancelamento de obra   ───────────►  quando o J4 mergear (leia o fim)
```

**D1 começa imediatamente** porque é pequeno, mexe em uma pasta só e é **pré-requisito do
D2** — sem saber quais obras vieram do Field, não há como perguntar "esta sumiu de lá?".
É também o seu primeiro contato com a base: uma hora de trabalho que ensina a forma do
código antes de você encarar o desenho difícil.

**D2 é a frente de verdade deste pacote.** É desenho de produto, não recado: você decide
como o sistema se comporta diante de um dado que sumiu.

**D3 tem uma trava:** o mecanismo da varredura recorrente **ainda não está decidido pelo
João**. Não comece antes da decisão.

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
  estilo de `sdd-sql-obras-v0.sql`. Coluna `fonte text` em `obras_obra`.
- Valores do vocabulário: **`'field'`**, **`'planilha'`**, **`'manual'`**. Minúsculas, sem
  acento — são chaves do sistema, não texto de tela.
- A sincronização grava `'field'`; a importação da planilha grava `'planilha'`.
- **Você não roda a migration.** Escreve, avisa, e o João roda — é a regra 3 do
  `01-REGRAS-DE-TRABALHO.md`. Até ela rodar, o código que lê `fonte` não funciona em
  produção, e isso é esperado.

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
- ❌ Não altere o que a importação da planilha grava. Ela não vai rodar, e mudá-la só
  gera diff para revisar.
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
**Depende de:** ⚠️ **uma decisão do João que ainda não existe** — leia a seguir

### ⚠️ Esta frente não começa antes da decisão do mecanismo

**O mecanismo da varredura recorrente ainda não está decidido pelo João.** Não escolha, não
prototipe "só para testar", não comece pela parte que "vale para qualquer mecanismo".

O motivo é a regra permanente do projeto, e ela vale para todo mundo aqui: **trabalho
iniciado antes da decisão que o molda é trabalho refeito inteiro.** Uma pergunta custa
minutos; uma frente de 4 a 7 horas desenhada contra a suposição errada custa as 4 a 7
horas de novo.

Quando a decisão chegar, ela entra neste documento antes de você abrir o editor.

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

### Quatro incógnitas da API que ainda não foram provadas

Elas são frente do João (J3) e dependem da chave real, mas afetam o seu desenho — saiba
que existem: a codificação do parâmetro `q`; se `sort=id` é campo válido; se `updated_at>=`
aceita timestamp completo ou só data; e se a OS é arquivada ou excluída no Field. O
cliente da API já está construído de forma configurável por causa delas — veja os
comentários de `ordenacao` e `desde` em `_lib/field/cliente.ts`.

### O que NÃO fazer nesta frente

- ❌ **Não comece antes da decisão do mecanismo.** É a única proibição dura desta frente.
- ❌ Não configure webhook por conta própria — e note que o Field não emite os eventos que
  resolveriam isso.
- ❌ Não toque no painel do EasyPanel nem em nada de produção. Credencial de produção é do
  João, por critério, não por desconfiança.
- ❌ Não faça a varredura automática apagar, mesclar ou "limpar" nada. Ela insere e
  preenche vazio — o mesmo contrato do botão.

### Pronto quando

- [ ] O mecanismo está decidido pelo João e registrado por escrito **antes** do primeiro
      commit
- [ ] A marca d'água é persistida e só avança quando a passada terminou inteira, com teste
      para o caso de falha no meio
- [ ] A varredura recorrente reusa `listarOsNormalizadas({ desde })` e
      `planejarSincronizacao` — sem segunda implementação da regra
- [ ] Cada passada deixa registro consultável do que fez
- [ ] A questão de autoria/porteiro foi levada ao João e a decisão está em comentário
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

As três perguntas que continuam com o cliente: se qualquer analista pode cancelar ou só
administrador; o que fazer com obra cancelada **depois de executada**, onde há trabalho a
faturar; e se, no Field, a OS cancelada é arquivada ou muda de status — porque isso define
se o sistema consegue detectar o cancelamento sozinho.

---

## Resumo

| | Frente | Tempo | Começa quando |
|---|---|---|---|
| **D1** | Marcar de onde a obra veio | ~1 h | **agora** |
| **D2** | A OS que sumiu do Field | 5–8 h | D1 mergeado |
| **D3** | Sincronização que roda sozinha | 4–7 h | o João decidir o mecanismo |
| **D4** | Smoke test contra o banco real | 2–3 h | chave `FIELD_API_KEY` + deploy |
| — | *Cancelamento de obra* | *a estimar* | *J4 mergeado* |

**Total das quatro: 12–19 h.**

Três das quatro são de escopo fechado e verificáveis por teste. A D2 não é: ela é uma
decisão de produto de verdade, e o desenho que você escrever vira o comportamento do
sistema diante de um dado que sumiu. É de propósito que ela esteja aqui.
