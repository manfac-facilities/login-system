# Dívidas da ficha da obra — A1, A13, B5, B7 — Spec

**Data:** 23/09/2026. **Origem:** `docs/DIVIDAS.md` (linhas A1, A13, B5, B7) e a divisão de trabalho
de 23/09 (`divisao-trabalho-2026-09-23.md`, item 2: "Dívidas da ficha que tocam dado", com o João).
**Território:** escrita que sobrescreve dado de cliente — exceção 3 do `AGENTS.md`, aqui a borda se
trata mesmo sem pedido.

**Base de código:** branch `feat/cancelamento-obra` (HEAD `9a0f32a`), que entra no master ANTES
destas dívidas. Todo `arquivo:linha` abaixo é dessa branch. A migration do cancelamento
(`sdd-sql-obras-cancelamento.sql`) já está aplicada em produção.

**Plano:** `plano-dividas-ficha-2026-09-23.md`, nesta pasta.

---

## 0. Resumo — o que muda e o que precisa do João

| Dívida | Correção | Schema/SQL? | Muda a tela? |
|---|---|---|---|
| **A13** | `mudarEtapaAction` grava etapa + marcos numa chamada só da RPC que já existe | **Não** — a RPC já aceita as colunas de etapa (§2.1) | Sim: o Histórico passa a mostrar a troca de etapa (§2.4) |
| **B5** | O auto-avanço da Autorização carimba os marcos com a mesma regra de `mudarEtapaAction`, na mesma chamada | Não | Não (só linhas "Esteira" no histórico, quando houver marco a carimbar) |
| **B7** | `liberarObraAction` valida as três datas com os validadores da ficha | Não | Uma mensagem nova (§4.3) |
| **A1** | Cada bloco manda de volta a "versão" que leu; o servidor recusa se a versão mudou | Não | Uma mensagem nova (§5.4) |

**Nenhum SQL.** A premissa do pedido ("se A13 exigir mudança de RPC, escreva
`sdd-sql-obras-etapa-atomica.sql`") não se confirmou lendo o código: a RPC `obras_aplicar_alteracao`
aceita `etapa`, `desde_etapa`, `etapa_por`, `etapa_em` e `atualizacao` desde
`sdd-sql-obras-historico.sql`, e continua aceitando na versão do cancelamento
(`sdd-sql-obras-cancelamento.sql`, lista `v_colunas_validas`, linha
`'etapa','desde_etapa','etapa_por','etapa_em','atualizacao'`). O próprio cancelamento já troca a
etapa por essa RPC (`_actions.ts:550-566`), e a Autorização também (`_actions.ts:782-798`). O texto
de A13 no `DIVIDAS.md` ("exigiria estender a RPC") está desatualizado — corrigir no commit da
implementação (plano, T7).

**Para o João aprovar (texto de tela):**

1. **A1** — mensagem de conflito (§5.4):
   > Outra pessoa alterou esta obra enquanto você editava. Recarregue a página para ver o que foi
   > gravado e refaça a sua alteração.
2. **B7** — mensagem de data de início inválida na Triagem (§4.3):
   > Data de início inválida. Confira o dia, o mês e o ano.
3. **A13** — o Histórico de alterações passa a mostrar uma linha a cada troca de etapa pelo seletor
   (§2.4), no formato que já existe: selo **Esteira** · `Etapa: Em andamento → Relatório de entrega`.
   Já era o previsto na spec do histórico (§11, item 4) e no mockup aprovado (`HIST_C`); hoje a troca
   manual não deixa rastro nenhum no histórico.

**Decisão do João (uma):** a régua de ano da B7 (§4.4). Recomendação: manter a mesma da ficha
(2000–2100).

Nenhuma dívida se revelou já resolvida nem maior do que "fechar a dívida". Nada exige redesenhar a
ficha.

---

## 1. Regras gerais (valem para as quatro)

- **Toda recusa sai antes de qualquer escrita**, olhando a obra lida do banco (`lerObra`), no padrão
  do cancelamento.
- **Uma gravação = uma chamada de RPC.** Depois desta entrega, nenhuma action da ficha que mexe em
  etapa ou em bloco editável faz duas escritas.
- `_actions.ts` é `'use server'`: **nada de `export type`/`export const` novo** (armadilha 1 de
  `.claude/rules/obras.md`). Constante de mensagem fica como `const` não exportada, igual às que já
  existem (`_actions.ts:57-64`). Função pura nova vai para `_lib/ficha-campos.ts`.
- `null` é o único sentinela de vazio.

---

## 2. A13 — troca de etapa atômica

### 2.1 O problema, lido no código

`mudarEtapaAction` (`_actions.ts:360-447`) faz:

1. `update` direto em `obras_obra` com `etapa`, `desde_etapa`, `atualizacao`, `etapa_por`,
   `etapa_em` (`:409-418`), com um refazer sem `etapa_por`/`etapa_em` se a coluna não existir
   (`colunaInexistente`, `:248-252`, `:414-416`);
2. depois, se algum marco muda, `gravarComHistorico` com os marcos (`:431-442`).

Se (2) falha, a etapa já mudou e os marcos não. É a A13, e é também a causa da **A16** (Fechar OS →
Pendente faturamento com falha no meio + recarregar = data digitada perdida).

### 2.2 A correção

Uma chamada só de `gravarComHistorico`, com:

- `linhas` = a linha da etapa (se a etapa mudou) **seguida** das linhas dos marcos:
  - `linhasDeAlteracao({ etapa: obra.etapa }, { etapa }, 'Esteira')` — gera a linha só quando a etapa
    muda de verdade; trocar para a mesma etapa não gera;
  - `linhasDeAlteracao(antes, depois, 'Esteira')` dos marcos, como hoje.
  - A linha da etapa vem primeiro: linhas da mesma chamada compartilham `created_at` e desempatam
    por `seq` (spec do histórico, §11 item 2).
- `campos` = `camposDasLinhas(linhas, { ...depois, etapa })` + as colunas de controle que hoje vão no
  `update`: `desde_etapa` (mesma regra de hoje, `:405`), `atualizacao`, `etapa_por`, `etapa_em`.
  `etapa` só entra em `campos` quando mudou — a trava de `gravarComHistorico`
  (`historico.ts:224-237`) recusa coluna rastreada sem linha, e ela está certa.
- Erro da RPC → `{ error: 'Erro ao mudar a etapa da obra' }` (texto que já existe). **Nada foi
  gravado**, então a mensagem "A etapa mudou, mas houve erro ao atualizar os marcos da esteira"
  (`:440`) deixa de existir.
- **Remover** `colunaInexistente` e o refazer (`:237-252`, `:414-416`). `etapa_por`/`etapa_em` estão
  em produção desde 10/09 (a seção 0 do cancelamento confere `etapa_por` como pré-requisito); a spec
  do histórico já mandava tirar esse resíduo (§11 item 4).

O que **não** muda: a validação da data de fechamento (`:384-397`), o cálculo por estado final
(`calcularMarcosDaEsteira`), a recusa de obra cancelada (`:375`), a revalidação (`:444-445`), e o
"trocar para a mesma etapa" continuar zerando `desde_etapa` (comportamento de hoje).

### 2.3 Por que isso é seguro com o cancelamento

A trigger `obras_obra_transicao_cancelamento` só age quando a etapa **velha ou nova** é `cancelado`.
`mudarEtapaAction` recusa obra cancelada (`:375`) e `cancelado` não está em `ETAPAS_VALIDAS`. Se
alguém cancelar a obra entre o `lerObra` e a RPC, a trigger recusa o update ("Desfazer o cancelamento
devolve a obra para…") e **nada** grava — a RPC é uma transação. Hoje o `update` direto teria o mesmo
destino, então não há regressão; há ganho, porque os marcos também não gravam.

### 2.4 O que muda na tela

- O Histórico ganha a linha **Esteira · Etapa: A → B** a cada troca pelo seletor (texto para o João,
  item 3 do §0). Formatação já existe: `formatarValor` traduz `etapa` por `nomeEtapa`
  (`historico.ts:100`).
- O "Tentar de novo" de `_etapa.tsx` continua funcionando igual: a guarda `aplicavel` (`:388-390`)
  olha a obra lida do banco, e agora a falha é sempre total.

### 2.5 A16 fecha junto

Sem escrita parcial não existe "etapa nova com `marco_fechou_os` nulo". A16 sai do `DIVIDAS.md` como
corrigida na T7.

---

## 3. B5 — o auto-avanço da Autorização carimba os marcos

### 3.1 O problema

`salvarAutorizacaoAction` (`_actions.ts:756-801`), quando a obra está em `aprovarOS` e ganha a
primeira aprovação (R16), grava `etapa: 'fecharOS'` na mesma RPC da autorização (`:779-798`) — mas
**não** chama `calcularMarcosDaEsteira`. Uma obra que chegou a `aprovarOS` sem `marco_exec_fim` ou
`marco_relatorio` (antes de 21/09, ou antes do backfill) vai para `fecharOS` com eles nulos.

### 3.2 A regra — não precisa de decisão nova

O `DIVIDAS.md` dizia que estender exigiria "decisão sobre se este auto-avanço específico soma no
cálculo de 'anterior' do mesmo jeito". A decisão 1 de 21/09
(`docs/cliente/2026-09-21-decisoes-marcos-da-esteira.md`) é sobre **avançar**, sem distinguir o
gatilho: "as datas dos passos pulados recebem a data de hoje". `aprovarOS → fecharOS` é um avanço.
Aplica-se a mesma função, `calcularMarcosDaEsteira(obra, 'fecharOS', hoje)`, sem parâmetro novo.

Resultado para a nova etapa `fecharOS` (índice 6 em `CICLO`):

| Marco | Efeito |
|---|---|
| `marco_exec_fim` | hoje, se nulo (`fecharOS` é pós-campo) |
| `marco_relatorio` | hoje, se nulo (passo anterior) |
| `marco_fechou_os`, `marco_liberou_fat`, `marco_faturou` | `null` (normalmente já são; se não forem, apaga com histórico — é a reconciliação por estado final) |
| `marco_os_aprov` | fora da função, como sempre; continua sendo gravado pelo trio da aprovação (R7) |

No caso normal (obra que chegou a `aprovarOS` pelo seletor depois de 21/09) nada muda: os marcos já
têm data e não são sobrescritos.

### 3.3 A correção

Só quando `avancou` (`:779-785`):

- `m = calcularMarcosDaEsteira(obra, 'fecharOS', hoje)`;
- `linhasEsteira = linhasDeAlteracao(m.antes, m.depois, 'Esteira')`;
- `linhas` = linhas da Autorização (como hoje, incluindo a linha da etapa com bloco `Autorização`,
  que não muda) **seguidas** de `linhasEsteira`;
- `campos` = `camposDasLinhas(linhas, { ...depois, ...m.depois })` + `atualizacao`, `desde_etapa`,
  `etapa_por`, `etapa_em` como hoje (`:788-796`). As chaves de `m.depois` (cinco marcos) e de
  `depois` (origem, liberação, aprovação, etapa) são disjuntas — `marco_os_aprov` chega via
  `os_aprovada_em`, não via marcos.

Tudo continua numa chamada só de `gravarBloco`. Sem avanço, nada muda.

### 3.4 A tela

Sem mudança. O diálogo de avanço (`_bloco-autorizacao.tsx:326-357`) não fala de marcos, e o seletor
de etapa também não fala. O caso em que um marco é carimbado aqui é raro (ver §7, item 5).

---

## 4. B7 — datas da liberação validadas no servidor

### 4.1 O problema

`liberarObraAction` (`_actions.ts:640-730`) trata `inicio`, `libEm` e `aprovadaEm` só com `nulo()`
(trim). O servidor aceita `"20266-01-01"`, `"2026-02-31"`, `"0226-09-01"`. A tela da Triagem não
valida a Data de início (`_triagem.tsx:209-224` chama `validarAutorizacao` e
`validarIdentificacao`, não `validarCronograma`), e o `<input type="date">` (`:530-537`) aceita ano de
5 dígitos em alguns navegadores.

### 4.2 A correção — reuso, sem função nova

Os cinco campos obrigatórios da Triagem **são** os campos do bloco Cronograma (`resp`, `equipe`,
`prioridade`, `inicio`, `duracao`). Depois da checagem de obrigatórios (`:654-656`):

- `validarCronograma({ resp, equipe, prioridade, inicio, duracao: dados.duracao }, {})` — sem
  `inicioAtual`, então não pede motivo de remarcação. Cobre data de calendário + ano 2000–2100 do
  início, prioridade e duração 1–180 **com as mesmas mensagens** das duas linhas que existem hoje
  (`:657-658`), que são **substituídas** por esta chamada.
  - Diferença: a duração passa a exigir só dígitos (`/^\d+$/`); hoje `parseInt('12abc')` vira 12. O
    campo é `type="number"`, então a tela nunca manda isso.
- `validarAutorizacao({ origem: '', libPor: dados.libPor ?? '', libEm: dados.libEm ?? '',
  aprovadaEm: dados.aprovadaEm ?? '' }, { hoje })` — **usar só** as chaves `libEm` e `aprovadaEm` do
  resultado. A origem é deixada de fora de propósito: `liberarObraAction` não lê a obra (a trava é o
  `.eq('etapa','definir')`), então não tem `origemAtual` para comparar, e hoje não valida origem —
  validar agora recusaria origem legada que a tela exibe.
  - Diferença: data de liberação sem nome passa a ser recusada ("Tem data da liberação sem nome…"); hoje
    o servidor descarta a data em silêncio (`:705`). A tela já recusa isso com a mesma função
    (`_triagem.tsx:212-215`), então ninguém vê diferença pela tela.
- A checagem `aprovadaEm > hoje` que existe (`:685-687`) fica — fica redundante, mas tirar não é
  pedido.

### 4.3 Mensagem

O erro de `validarCronograma` para `inicio` é o genérico "Data inválida." — na ficha ele aparece
**embaixo do campo**; na Triagem ele cairia na caixa geral (`setErro`, `_triagem.tsx:236`) sem dizer
qual campo. `liberarObraAction` troca só esse caso por:

> **Data de início inválida. Confira o dia, o mês e o ano.** *(texto para o João aprovar)*

Os demais (duração, prioridade, liberação, aprovação) já dizem de que campo falam.

### 4.4 Decisão: a régua de ano

O exemplo do `DIVIDAS.md` ("`2016` em vez de `2026`") **não** é pego pela régua da ficha (2000–2100),
nem aqui nem no bloco Cronograma. Pegar exigiria regra nova ("início não pode ser mais de N meses
atrás"), que vale para as duas telas e muda produto. **Recomendação: manter 2000–2100** — fecha
"data que não existe" e "ano de 5 dígitos/século errado", que é o que o servidor não pegava, e não
inventa regra que ninguém pediu. Se o João quiser a janela mais estreita, vira item novo com mockup
da mensagem.

---

## 5. A1 — "última gravação vence" nos três blocos

### 5.1 O problema

Os três blocos (Autorização, Identificação, Cronograma) leem a obra no servidor, calculam o diff
contra o que está gravado **agora**, e gravam o formulário inteiro do bloco. Se A e B abrem o mesmo
bloco, B salva primeiro, e A salva depois, o diff de A é calculado contra o que B gravou: A desfaz B
sem aviso. O histórico registra as duas gravações, mas ninguém na tela fica sabendo.

### 5.2 Por que não `updated_at`

A coluna existe (`sdd-sql-obras-v0.sql:121`, trigger `obras_obra_touch_updated_at` em **todo**
update). Por isso mesmo ela não serve:

- a sincronização do Field atualiza `obras_obra` a cada 5 minutos (`sincronizar/_execucao.ts:244,261`);
- o diário atualiza os contadores a cada registro (`diario/_actions.ts:297-300`);
- salvar a Autorização mexe no `updated_at` e derrubaria a Identificação que a mesma pessoa tem
  aberta ao lado (os três blocos podem estar em edição ao mesmo tempo —
  `_bloco-editavel.tsx:14-16`).

Tudo isso seria "conflito" falso. E conflito falso ensina a pessoa a recarregar sem ler.

### 5.3 O mecanismo — versão por bloco, sem schema

Função pura nova em `_lib/ficha-campos.ts`:

```ts
versaoDoBloco(obra, bloco: 'Autorização' | 'Identificação' | 'Cronograma'): string
```

Devolve `JSON.stringify` da lista de valores **crus do banco** das colunas daquele bloco (cada um com
`?? null`):

| Bloco | Colunas |
|---|---|
| Autorização | `origem`, `liberado_por`, `liberado_em`, `aprovacao` |
| Identificação | `tipo`, `valor`, `analista_cliente`, `mau_uso` |
| Cronograma | `pcm`, `equipe`, `prioridade`, `inicio_plan`, `duracao` |

(`os_aprovada` e `marco_os_aprov` são satélites de `aprovacao`, R7 — não precisam entrar.)

Fluxo:

1. `_ficha.tsx` passa `versao={versaoDoBloco(obra, '<bloco>')}` a cada bloco (`:750-803`). `obra` é
   `derivar(linha)`, que espalha a linha (`...o`), então a versão é a mesma que o servidor calcula da
   linha crua.
2. Cada bloco **captura** a versão no clique em **Editar** (junto com `setRascunho(valores)`), e manda
   a capturada como terceiro argumento de `salvar`. Capturar no Editar, e não ler a prop na hora de
   salvar, é o que faz a detecção funcionar mesmo se a página for revalidada durante a edição.
3. As três actions recebem `versao: string` como terceiro parâmetro. Logo depois da recusa de obra
   cancelada, e antes da validação:
   `if (versao !== versaoDoBloco(obra, '<bloco>')) return { error: CONFLITO_EDICAO }`.
   - Versão ausente (`undefined`, aba aberta antes do deploy) **também recusa** — falha fechada, sem
     caso especial.
   - No Cronograma, a checagem vem antes de `motivoCanonico` e da RPC de remarcação.

O que isso detecta: qualquer mudança nas colunas **daquele bloco** entre o Editar e o Salvar —
feita por outra pessoa, outra aba, ou pela Triagem. O que **não** dispara: Field, diário, troca de
etapa, outro bloco.

### 5.4 O que a tela mostra — texto para o João aprovar

A caixa de erro de gravação que já existe (`_bloco-editavel.tsx:309-323`) — sem componente novo. Ela
já prevê este caso ("Se a mensagem disser que outra pessoa alterou esta obra, recarregue a página e
refaça a alteração"). A mensagem do servidor entra em "O sistema respondeu:":

> **Não salvou a autorização**
> O sistema não confirmou, então **nada foi gravado**. O que você preencheu continua abaixo. Clique
> em Salvar de novo. Se a mensagem disser que outra pessoa alterou esta obra, recarregue a página e
> refaça a alteração.
> O sistema respondeu: **Outra pessoa alterou esta obra enquanto você editava. Recarregue a página
> para ver o que foi gravado e refaça a sua alteração.**

O bloco continua em edição com o que foi digitado (R21) — dá para copiar antes de recarregar.

Alternativa considerada e **não** recomendada: dizer quem alterou e quando ("Yuri alterou às
14:32"). Exige uma consulta a mais ao histórico e texto novo na caixa; a ficha já mostra o Histórico
logo abaixo depois de recarregar.

### 5.5 Fora do escopo de A1, de propósito

- **"Salvar dados" da Triagem** (`salvarDadosTriagemAction`, `:975-1021`) tem a mesma janela (o
  comentário `:970-973` cita R22). A dívida lista só os três blocos da ficha → `DIVIDAS.md` (§7).
- A janela de milissegundos entre o `lerObra` e a RPC. Fechar exige a RPC conferir a versão sob
  `for update` (mudança de RPC) → `DIVIDAS.md` (§7).

---

## 6. Arquivos tocados

| Arquivo | A13 | B5 | B7 | A1 |
|---|---|---|---|---|
| `app/obras/obra/[id]/_actions.ts` | ✓ | ✓ | ✓ | ✓ |
| `app/obras/_lib/ficha-campos.ts` | | | | ✓ (`versaoDoBloco`) |
| `app/obras/obra/[id]/_bloco-autorizacao.tsx`, `_bloco-identificacao.tsx`, `_bloco-cronograma.tsx` | | | | ✓ |
| `app/obras/obra/[id]/_ficha.tsx` | | | | ✓ |
| `app/obras/obra/[id]/__tests__/_actions.test.ts` | ✓ | | | |
| `app/obras/__tests__/ficha.test.ts` | ✓ | | ✓ | |
| `app/obras/__tests__/ficha-editavel.test.ts` | | ✓ | | ✓ |
| `app/obras/__tests__/ficha-campos.test.ts` | | | | ✓ |
| `app/obras/obra/[id]/__tests__/_blocos-editaveis.test.tsx` | | | | ✓ |
| `docs/DIVIDAS.md` | ✓ | ✓ | ✓ | ✓ |

Nada em `_triagem.tsx`, `_etapa.tsx`, `_bloco-editavel.tsx`, `historico.ts`, `tipos.ts`, nem SQL.

---

## 7. Vai para `docs/DIVIDAS.md` (bordas novas, improváveis, não tratadas)

1. **A1 — janela de milissegundos entre ler e gravar.** Duas gravações do mesmo bloco no mesmo
   instante ainda podem passar as duas. Fechar = RPC recebe `p_versao` e confere sob `for update`
   (migration). Improvável: exige dois cliques no mesmo bloco da mesma obra na mesma fração de
   segundo.
2. **"Salvar dados" da Triagem continua "última gravação vence"** (R22). Mesmo mecanismo de A1
   resolveria (as colunas são as de Autorização + Identificação); fora das três pedidas.
3. **Autorização: o aviso de avanço (R16) usa a etapa que a tela viu.** A etapa não entra na versão
   do bloco (senão toda troca de etapa derrubaria uma edição de Autorização aberta). Se outra pessoa
   puser a obra em `aprovarOS` enquanto alguém edita a Autorização e preenche a aprovação, a obra
   avança sem o diálogo ter aparecido. O avanço está certo; só o aviso faltou.
4. **B7 — a régua de ano 2000–2100 não pega "2016 em vez de 2026".** Depende da decisão do §4.4.
5. **B5 — o diálogo de avanço não avisa que passos anteriores sem data recebem hoje.** Só acontece
   com obra que chegou a `aprovarOS` sem marco (antes de 21/09 e fora do backfill). A data sai no
   Histórico, bloco Esteira, e é corrigível.

---

## 8. Como provar que está pronto

- Jest dos arquivos do §6 verde; `npx tsc --noEmit` sem erro novo; `npm run lint` limpo nos arquivos
  tocados.
- Teste de regressão da armadilha 1 (`4071df1`, varredura dos `use server`) verde — nenhum
  `export type` novo em `_actions.ts`.
- Revisão independente (agente diferente do que implementou), contra esta spec.
- Depois do deploy, teste manual em produção (plano, T9): dois navegadores no mesmo bloco da mesma
  obra de teste; troca de etapa conferindo a linha nova no Histórico; Triagem com data inválida.

## Aprovações do João — 23/09/2026

- **A1:** mensagem de conflito aprovada como está: "Outra pessoa alterou esta obra enquanto você
  editava. Recarregue a página para ver o que foi gravado e refaça a sua alteração."
- **B7:** mensagem "Data de início inválida. Confira o dia, o mês e o ano." aprovada, com a régua de
  ano 2000–2100 (a mesma da ficha).
- **A13:** troca de etapa passa a aparecer no Histórico ("Esteira · Etapa: A → B") — aprovado.
- Sem SQL: nada a aprovar de schema.
