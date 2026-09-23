# Spec — Ajustes da ficha da obra (feedback de 22/09)

**Data:** 23/09/2026 · **Frente:** item C do feedback da ficha J4 + equipe/prestador em texto livre ·
**Prazo:** Controle de Obras em 28/09/2026.

Só especificação: nenhum código de produção foi escrito para produzir este documento. O que está
afirmado sobre o código atual foi verificado por leitura, com arquivo e linha citados. O banco de
produção **não** foi consultado; o schema foi lido dos `sdd-sql-obras-*.sql` da raiz.

**Fontes, na ordem de precedência:**
1. `mockup-ajustes-ficha-2026-09-22.html` — **aprovado pelo João em 23/09 como está** (registro no
   fim de `brief-mockup-ajustes-ficha-2026-09-22.md`). É a referência de comportamento e texto de tela.
2. `docs/cliente/2026-09-22-feedback-ficha-obra-j4.md` (item C) e
   `docs/cliente/2026-09-22-feedback-esteira-e-equipes.md` — fala literal do cliente e decisões do João.
3. Código em `app/obras/`.

---

## 1. O problema, em cinco linhas

O cliente leu a esteira e entendeu que "Fechar OS" é pulado quando a OS já estava aprovada. Não é:
o único desvio é `aprovarOS`, que ainda aparece com o nome antigo **"Pendente fechamento"**
(`app/obras/_lib/tipos.ts:165`) — o nome sugere que o fechamento é o que falta. Ao concluir
"Fechar OS", o sistema grava **hoje** como data de fechamento, sem campo e sem correção posterior,
quando o analista pode ter fechado a OS no sistema do cliente ontem ou há dois dias. E a equipe é um
`<select>` fechado; o cliente quer texto livre "pra não limitar e ficar errado".

**O que muda para quem usa:** a etapa de desvio passa a se chamar **"Executado - pendente aprovação
OS"** em toda a tela; ao trocar a etapa de "Fechar OS" para "Pendente faturamento", aparece o campo
**"Data de fechamento da OS"** (hoje, editável); o passo "Fechar OS" concluído ganha **"corrigir
data"**, com rastro no histórico; e "Equipe / prestador" vira um campo de texto que sugere as equipes
já usadas e aceita qualquer texto.

---

## 2. Escopo

### 2.1 O que entra

| # | Item | Seção do mockup |
|---|---|---|
| A1 | `aprovarOS` passa a se chamar **"Executado - pendente aprovação OS"** em toda a UI | 1 |
| A2 | Selo **"sempre existe"** ao lado de "Fechar OS" na esteira, nos dois caminhos; no caminho direto com a obra parada em Fechar OS, a frase "Este passo nunca é pulado…" | 1 |
| A3 | Campo **"Data de fechamento da OS"** no seletor "Mudar a etapa desta obra", só na transição Fechar OS → Pendente faturamento: padrão hoje, editável, recusa data futura e data anterior ao relatório/aprovação | 2 |
| A4 | Essa data grava `marco_fechou_os` **e** passa a ser o início dos "dias esperando o faturamento" (`desde_etapa` de Pendente faturamento) | 2 (texto da dica) |
| A5 | **"corrigir data"** no passo Fechar OS concluído: edição inline, mesmas duas recusas, correção gravada em `obras_historico` (quem, quando, de → para) | 2 |
| A6 | Estados **Salvando · Salvo · Erro ao salvar**, visivelmente diferentes, na troca com data e na correção | 2 |
| A7 | **Equipe / prestador** em texto livre com sugestões, na Triagem e no bloco Cronograma | 3 |

### 2.2 O que explicitamente NÃO entra

| Item | Por quê |
|---|---|
| Data editável em "Faturado" ou em qualquer outro marco | Brief, seção 2: "Só Fechar OS. Faturado fica como está (não foi pedido)." |
| "Trocar o status ainda na esteira para pendente faturamento" | Adiado pelo João em 22/09 (decisão 4 de `2026-09-22-feedback-esteira-e-equipes.md`) |
| Mudar a lógica do desvio (`os_aprovada && etapa !== 'aprovarOS'`) | O mockup, seção 1: "Este mockup só troca o nome — a lógica do desvio não muda." |
| Campo de data quando a troca pula Fechar OS (ex.: Fechar OS → Faturado, ou Relatório → Pendente faturamento) | O mockup restringe o campo "só nesta transição específica (Fechar OS → Pendente faturamento)". Nesses saltos o marco continua sendo carimbado com hoje, como já é, e "corrigir data" resolve depois |
| Frase "Parada aqui há N dias. Mude a etapa no controle abaixo para avançar." no passo atual | Aparece no mockup só como ilustração do passo atual; não foi pedida em nenhum dos três ajustes. A ficha continua com a mensagem de encalhada que já tem (`_ficha.tsx:285-290`) |
| Normalizar grafia de equipe (caixa, espaços internos), cadastro de equipes | Não pedido. Ver seção 8 |
| Renomear o texto do mockup/manual já entregues (`manual-cliente-2026-09-16.*`) | Documento, não tela. Fica para o comunicado de atualização, que o João aprova |
| Tornar atômicas as duas escritas de `mudarEtapaAction` | Dívida A13 já registrada; tratar exige mudar o caminho de gravação da troca de etapa inteira (bem mais que ~20 linhas além do pedido). Ver §5.4 e seção 8 |

---

## 3. Mudanças de banco

**Nenhuma.** Nenhum dos três ajustes exige coluna, CHECK, enum, função SQL ou RLS novos.
Verificado:

- **`marco_fechou_os` já existe**, `date` (`sdd-sql-obras-v0.sql:105`).
- **Já é rastreado no histórico:** `CampoHistorico` inclui `'marco_fechou_os'`
  (`app/obras/_lib/historico.ts:39`), com rótulo **"Data de fechamento da OS"** (`historico.ts:61`),
  formatado como data (`historico.ts:84-87`) e mapeado na trava de `gravarComHistorico`
  (`historico.ts:190`).
- **A RPC `obras_aplicar_alteracao` já aceita** `marco_fechou_os` **e** `desde_etapa` em `p_campos`
  (lista de colunas válidas em `sdd-sql-obras-historico.sql:177-181`; coluna fora da lista é
  recusada com `raise`, `:197-199`). A RPC checa sessão e acesso por conta própria
  (`:187-190`) e grava `quem` a partir do JWT, não do cliente (`:164`).
- **`desde_etapa` não é rastreado** (`CampoHistorico` não o contém, `historico.ts:22-41`), então pode
  entrar em `p_campos` sem linha de histórico — a trava só acusa colunas mapeadas em
  `COLUNA_PARA_CAMPO` (trava em `historico.ts:223-233`).
- **`obras_obra.equipe` é `text` sem restrição** (`sdd-sql-obras-v0.sql:74`); nenhum CHECK, enum ou
  FK em nenhum `sdd-sql-obras-*.sql` (grep de `equipe` em todos). O servidor também não restringe:
  `liberarObraAction` só exige não vazio (`_actions.ts:451`) e `salvarCronogramaAction` grava
  `nulo(dados.equipe)` (`_actions.ts:716`). **A lista fechada existe só na tela.**
- **A data hoje é gravada como "hoje" automaticamente:** `calcularMarcosDaEsteira` faz
  `depois[campo] = ORDEM_ETAPA[etapa] < indiceNovo ? (antes[campo] ?? hoje) : null`
  (`_actions.ts:326-329`), e `marco_fechou_os` está em `PASSOS_MARCO` (`_actions.ts:265`). Ou seja: o
  marco de Fechar OS é carimbado quando a obra vai para **depois** de `fecharOS` e está `null`.

---

## 4. Ajuste 1 — Nome da etapa de desvio

### 4.1 O que muda

`CICLO`, `app/obras/_lib/tipos.ts:165`: `nome: 'Pendente fechamento'` → `nome: 'Executado - pendente
aprovação OS'`. **Só o `nome`.** A chave `k: 'aprovarOS'` não muda (é o valor gravado em
`obras_obra.etapa`, com CHECK em `sdd-sql-obras-v0.sql:85`).

**`planilha:` não muda.** `planilha: 'EXECUTADO - APROVAR OS'` (`tipos.ts:165`) é o valor da coluna
STATUS MANFAC da planilha. Conferido: **o import não lê `CICLO.planilha`** — ele usa um mapa próprio,
`STATUS_MANFAC_PARA_ETAPA` (`app/obras/_lib/importacao.ts:286-293`). O único leitor de
`CICLO.planilha` é a ficha, que o exibe como código em fonte mono no passo da esteira
(`_ficha.tsx:282`). Renomear o `nome` não afeta import nem esse código.

### 4.2 Onde o nome antigo está escrito à mão (grep de "Pendente fechamento" em `app/`)

| Lugar | Hoje | Passa a |
|---|---|---|
| `app/obras/_lib/tipos.ts:165` | `nome: 'Pendente fechamento'` | `nome: 'Executado - pendente aprovação OS'` |
| `app/obras/obra/[id]/_ficha.tsx:244` | `nome="Pendente fechamento"` (passo pulado) | `nome={c.nome}` — `c` já está no escopo (`_ficha.tsx:228`) |
| `app/obras/obra/[id]/_ficha.tsx:553` | `'com desvio — vai parar em Pendente fechamento'` | `` `com desvio — vai parar em ${ETAPAS.aprovarOS.nome}` `` |
| `app/obras/obra/[id]/_ficha.tsx:570` | `<b>Pendente fechamento</b> é o que depende do cliente…` | `<b>{ETAPAS.aprovarOS.nome}</b> é o que depende do cliente…` |
| `app/obras/obra/[id]/_bloco-autorizacao.tsx:23` | comentário | atualizar o texto do comentário (não é tela) |

Todo o resto (Base, Kanban, etiquetas, seletor de etapa, caixa de alerta, histórico) lê o nome por
`nomeEtapa()` / `ETAPAS[k].nome` e muda sozinho.

**Histórico já gravado não muda:** `linhasDeAlteracao` grava o **texto** da etapa (`formatarValor`,
`historico.ts:82`). Linhas antigas continuam dizendo "Pendente fechamento" — é o registro do que a tela
mostrava na época, e está certo assim.

### 4.3 Selo "sempre existe" (A2)

No `Passo` de `fecharOS` da esteira (`_ficha.tsx:268-313`), um selo **"sempre existe"** ao lado do nome,
em todos os estados (futuro, atual, feito) e nos dois caminhos — é o que o mockup mostra na seção 1.
Implementação: uma prop booleana `sempre` no `Passo` (`_ficha.tsx:141`), desenhada como o selo
`desvio` já existente (`_ficha.tsx:182-186`).

Quando `fecharOS` é o passo **atual** e `obra.os_aprovada` é `true` (caminho direto), o corpo do passo
ganha o texto do mockup: *"Este passo **nunca é pulado**: é quando o analista de obras insere o
relatório no sistema do cliente e finaliza a OS lá. Só depois é possível faturar."*

O texto do desvio pulado continua o do código (`_ficha.tsx:245`, "Desvio não usado — a OS já estava
aprovada em…"). O mockup usa redação quase igual; não há mudança de comportamento.

### 4.4 Testes que citam o nome antigo e precisam mudar junto

- `app/obras/__tests__/tipos.test.ts:187` — `expect(nomeEtapa('aprovarOS')).toBe('Pendente fechamento')`
- `app/obras/__tests__/historico.test.ts:158` — `para: 'Pendente fechamento'`
- `app/obras/obra/[id]/__tests__/_ficha.test.tsx:180` — só a descrição do `it`

---

## 5. Ajuste 2 — Data de fechamento da OS

### 5.1 Onde o campo aparece (reconciliado com o código)

**Não existe botão "Concluir" por passo.** A troca de etapa é o `<select>` "Mudar a etapa desta obra"
com "Confirmar mudança" (`app/obras/obra/[id]/_etapa.tsx`), renderizado em `_ficha.tsx:581` com só
`obraId` e `etapa`. O mockup aprovado reconhece isso e põe o campo **dentro desse controle**:

- **Condição de tela:** `etapa === 'fecharOS'` **e** `escolhida === 'pendFat'`. Só aí o campo
  "Data de fechamento da OS" aparece abaixo do select, pré-preenchido com `hoje`.
- **Dica** (texto do mockup): *"Vem preenchida com hoje. Edite se a OS foi fechada no sistema do
  cliente em outro dia. É essa data que inicia os dias esperando o faturamento."*
- **Erro inline** abaixo do campo; com erro, "Confirmar mudança" fica desabilitado.
- Trocar a etapa escolhida volta a data para hoje (mockup: `change` do select reseta `s2Data`).

`SeletorEtapa` passa a receber, além de `obraId` e `etapa`: `hoje` (já disponível na ficha,
`_ficha.tsx:448`) e `referenciaFechamento: { relatorio: string | null; aprovacao: string | null }`
(de `obra.marco_relatorio` e `obra.aprovacao`).

### 5.2 A regra de validação — uma função pura, usada na tela e no servidor

Nova função em `app/obras/_lib/ficha-campos.ts` (mesmo lugar de `validarAutorizacao` e
`erroData`, `ficha-campos.ts:231-276`):

```ts
validarDataFechamentoOS(
  data: string,
  ctx: { hoje: string; relatorio: string | null; aprovacao: string | null }
): string | undefined
```

| Situação | Mensagem (texto do mockup) |
|---|---|
| vazio | `Informe a data de fechamento da OS.` |
| não é `AAAA-MM-DD` de calendário real | `Data inválida.` (o `MSG_DATA` que já existe, `ficha-campos.ts:29`) |
| `data > hoje` | `A data não pode ser posterior a hoje.` |
| `data < referência`, referência = aprovação | `A data não pode ser anterior à aprovação da OS (DD/MM/AAAA).` |
| `data < referência`, referência = relatório | `A data não pode ser anterior ao relatório de entrega (DD/MM/AAAA).` |

**Referência = a MAIOR das duas datas não nulas** (`relatorio`, `aprovacao`). Se as duas forem
`null`, só vale a recusa de data futura. Ver §9, divergência 2: o mockup usa "aprovação, senão
relatório"; a maior das duas dá o mesmo resultado no exemplo do mockup e não deixa passar uma data
anterior ao relatório no caminho direto (OS aprovada antes do relatório).

`aprovacao` é a coluna que manda no trio da aprovação (R7, `_actions.ts:145-153`); `marco_os_aprov`
é satélite e não entra.

### 5.3 `mudarEtapaAction` — o que muda

Assinatura: `mudarEtapaAction(obraId: string, etapa: string, dataFechamentoOS?: string)`.
Arquivo `'use server'`: **não exportar tipo nem constante dele** (armadilha 1 de
`.claude/rules/obras.md`).

Ordem, com tudo o que recusa **antes de qualquer escrita**:

1. `abrirSessao()` (já existe, `_actions.ts:79-89`) → etapa válida → `lerObra` (inalterados).
2. **Se `dataFechamentoOS !== undefined`:**
   - **Aplicável** só quando esta troca vai carimbar `marco_fechou_os` a partir de `null`:
     `obra.marco_fechou_os === null` e `ORDEM_ETAPA[etapa] > ORDEM_ETAPA.fecharOS`. A condição olha
     a obra **lida do banco**, não a etapa que a tela acha que a obra tem. Não aplicável →
     `{ error: 'A data de fechamento da OS só vale ao concluir Fechar OS.' }`, sem gravar nada.
   - Valida com `validarDataFechamentoOS(data, { hoje, relatorio: <marco_relatorio já calculado
     para o estado final>, aprovacao: obra.aprovacao })`. Erro → devolve a mensagem, sem gravar nada.
     *"Revalidados AQUI, não só na tela"* — mesmo princípio de `liberarObraAction` (`_actions.ts:431-436`).
3. `update` da etapa (inalterado), **exceto**: com data aplicável e `etapa === 'pendFat'`,
   `desde_etapa` recebe a **data informada**, não hoje (A4 — é ela que inicia os dias esperando o
   faturamento, `paradaNaEtapa`, `tipos.ts:431-436`).
4. `calcularMarcosDaEsteira(obra, etapa, hoje, dataFechamentoOS?)` — novo 4º parâmetro opcional:
   quando presente, `marco_fechou_os` recebe `antes ?? dataFechamentoOS` em vez de `antes ?? hoje`.
   Nada mais no cálculo muda. A linha de histórico sai sozinha de `linhasDeAlteracao`
   (bloco `Esteira`, `de: null` → `para: DD/MM/AAAA`), pela mesma `gravarComHistorico` de hoje
   (`_actions.ts:392`).
5. `dataFechamentoOS === undefined` → comportamento **idêntico ao de hoje** (carimba hoje). Nenhum
   outro chamador precisa mudar.

### 5.4 Falha parcial (dívida A13) e o "Tentar de novo"

As duas escritas de `mudarEtapaAction` (etapa por `update` direto, marcos pela RPC) não são atômicas —
dívida **A13** de `docs/DIVIDAS.md`, já registrada. Consequência nova para esta troca: se o `update`
da etapa passar e a RPC dos marcos falhar, a obra fica em Pendente faturamento **sem**
`marco_fechou_os`, e a data digitada não foi gravada. A mensagem já existente é devolvida
(`_actions.ts:398`).

O que evita a perda **sem mudar o caminho de gravação**: o botão **"Tentar de novo"** do estado de
erro reenvia a **mesma** etapa e a **mesma** data. Como a aplicabilidade (§5.3, passo 2) é calculada
pela obra lida do banco (`marco_fechou_os` `null`, nova etapa depois de `fecharOS`), a nova tentativa
é aceita e grava a data digitada. O que sobra — a pessoa **recarregar a página** depois da falha
parcial, em vez de tentar de novo — vai para DIVIDAS (seção 8).

Por isso a tela **não** reproduz literalmente a frase do mockup "nada foi gravado: a obra continua em
Fechar OS" para todo erro: no caso parcial ela seria falsa. Ver §9, divergência 3.

### 5.5 Estados do seletor (A6), texto do mockup

| Estado | Tela |
|---|---|
| Salvando | Botão desabilitado "Salvando…" + "Não feche a página." |
| Salvo, com data | Caixa verde ✓ "Etapa atualizada para \"Pendente faturamento\", com o fechamento da OS gravado em **DD/MM/AAAA**." |
| Salvo, sem data | O "Etapa atualizada." que já existe (`_etapa.tsx:88`) |
| Erro, com data | Caixa vermelha com título **"Não concluiu \"Fechar OS\""**, corpo = mensagem do servidor, botão **"Tentar de novo"** |
| Erro, sem data | A linha vermelha que já existe (`_etapa.tsx:87`) |

### 5.6 "corrigir data" — nova action `corrigirDataFechamentoAction(obraId, data)`

Em `_actions.ts`. Receita fixa do hub:

1. `abrirSessao()` → `lerObra`.
2. **Só corrige o que existe:** `obra.marco_fechou_os !== null` **e**
   `ORDEM_ETAPA[obra.etapa] > ORDEM_ETAPA.fecharOS`. Senão →
   `{ error: 'Fechar OS ainda não foi concluído nesta obra.' }`. (Território de sobrescrita de dado de
   cliente — a guarda é obrigatória, não excesso.)
3. `validarDataFechamentoOS(nulo(data) ?? '', { hoje, relatorio: obra.marco_relatorio, aprovacao: obra.aprovacao })`.
   Erro → devolve a mensagem.
4. Data igual à gravada → `{ success: true }` sem chamar a RPC (nada a registrar).
5. `linhasDeAlteracao({ marco_fechou_os: antiga }, { marco_fechou_os: nova }, 'Esteira')` →
   `camposDasLinhas` (`_actions.ts:127`) → `gravarComHistorico`. `quem` e `quando` vêm da RPC (JWT e
   `created_at`); `de → para` vêm da linha.
6. **`desde_etapa` acompanha** só quando `obra.etapa === 'pendFat'` **e**
   `obra.desde_etapa === obra.marco_fechou_os` (a obra ainda está na espera que esta data iniciou).
   Aí `desde_etapa: nova` entra no mesmo `p_campos`, na mesma chamada atômica. Em qualquer outro caso
   `desde_etapa` não é tocado.
7. `revalidatePath` da ficha e da base; `{ success: true }`. Erro da RPC →
   `{ error: 'Erro ao corrigir a data de fechamento da OS' }`.

### 5.7 "corrigir data" — a tela

Novo client component `app/obras/obra/[id]/_corrigir-fechamento.tsx`, renderizado dentro do `Passo`
de `fecharOS` quando o passo está **feito** (`_ficha.tsx:259-260`). A action entra **por prop**,
padrão da ficha (`_ficha.tsx:17-22`); `Esteira` passa a receber `hoje` e a action.

- Fechado: *"Fechada no sistema do cliente em **DD/MM/AAAA**."* + link **"corrigir data"**.
- Aberto (inline, sem janela — mockup): `input type="date"` com a data atual e `max={hoje}`,
  **"Salvar correção"**, **"Cancelar"**, erro inline da mesma função pura (Salvar desabilitado com
  erro), e a dica *"A correção entra no Histórico de alterações: quem corrigiu, quando, de
  **DD/MM/AAAA** para a nova data."*
- Salvando: botão "Salvando…" desabilitado. Salvo: *"Corrigido: de X para Y. Fica no histórico."*
  Erro: caixa vermelha com a mensagem do servidor, edição continua aberta.
- O bloco **Histórico de alterações** da ficha mostra a linha sozinho — lê `obras_historico`
  (`_ficha.tsx:712`); o rótulo "Data de fechamento da OS" já existe (`historico.ts:61`).

---

## 6. Ajuste 3 — Equipe / prestador em texto livre

### 6.1 Hoje

`<select>` fechado nos dois lugares: Triagem (`_triagem.tsx:478-491`, campo 2 dos 5 obrigatórios) e
bloco Cronograma (`_bloco-cronograma.tsx:241-249`, componente `Selecao`). As opções vêm de
`EQUIPES_PISO` (`page.tsx:48-59`) unido aos valores já gravados na base, sem `DEFINIR`, ordenado
(`unir`, `page.tsx:61-68,176`).

### 6.2 O que muda

- **Os dois `<select>` viram `<input type="text">` com `<datalist>`** das mesmas `equipes`
  (`list="equipes-tri"` na Triagem, `list="equipes-cro"` no Cronograma). O navegador sugere enquanto
  digita e aceita qualquer texto. No Cronograma usa-se o `Entrada` que já existe
  (`_bloco-editavel.tsx:140-172`, repassa `list` pelo `...resto`); na Triagem, `<input>` direto com a
  classe `INPUT` do arquivo. Sem componente compartilhado novo: são dois usos (régua do projeto).
- `autoComplete="off"` e `placeholder="Digite a equipe ou o prestador"` (mockup).
- **Triagem:** dica do `CampoTri` (prop `dica`, `_triagem.tsx:96`) = *"Comece a digitar para ver
  equipes já usadas. Qualquer texto é aceito."* O check verde do campo 2 passa a olhar
  `t.equipe.trim()` — só espaço não conta como preenchido (o servidor já recusa, `nulo`,
  `_actions.ts:446,451`).
- **Cronograma:** a dica atual (`_bloco-cronograma.tsx:346`) já é a do mockup; não muda.
- **`EQUIPES_PISO` e `unir` não mudam.** "Prestador a contratar" continua como sugestão, como no mockup
  aprovado.
- **Servidor:** nada muda. Já aceita qualquer texto não vazio e grava aparado (`nulo`). Valor gravado
  fora da lista já era preservado pelo `Selecao` (`_bloco-editavel.tsx:118`); com o input, é o
  próprio valor do campo.

---

## 7. Arquivos

| Arquivo | O que muda | Ajuste |
|---|---|---|
| `app/obras/_lib/tipos.ts` | `nome` de `aprovarOS` (linha 165) | 1 |
| `app/obras/_lib/ficha-campos.ts` | + `validarDataFechamentoOS` | 2 |
| `app/obras/obra/[id]/_actions.ts` | `mudarEtapaAction` (3º parâmetro), `calcularMarcosDaEsteira` (4º parâmetro), + `corrigirDataFechamentoAction` | 2 |
| `app/obras/obra/[id]/_etapa.tsx` | campo de data condicional, novos props, estados | 2 |
| `app/obras/obra/[id]/_corrigir-fechamento.tsx` | **novo** | 2 |
| `app/obras/obra/[id]/_ficha.tsx` | nomes à mão (244, 553, 570), selo `sempre`, texto do caminho direto, props do `SeletorEtapa`, `Esteira` recebe `hoje` + action e renderiza `_corrigir-fechamento` | 1, 2 |
| `app/obras/obra/[id]/_bloco-autorizacao.tsx` | comentário da linha 23 | 1 |
| `app/obras/obra/[id]/_triagem.tsx` | campo 2 vira input + datalist, dica, `trim` no check | 3 |
| `app/obras/obra/[id]/_bloco-cronograma.tsx` | `Selecao` de equipe vira `Entrada` + datalist | 3 |

Testes: seção 7 do plano.

---

## 8. Vai para `docs/DIVIDAS.md`

Bordas improváveis e não pedidas — registradas, **não tratadas**:

1. **Falha parcial seguida de recarregar a página** (extensão da A13). Se a RPC dos marcos falhar
   depois da etapa mudar e a pessoa recarregar em vez de "Tentar de novo", a obra fica em Pendente
   faturamento com `marco_fechou_os` `null`: o "corrigir data" não aparece (passo não está feito) e a
   próxima troca de etapa carimba hoje. Âncora: `_actions.ts:392-399`. Correção de verdade = a troca
   de etapa inteira pela RPC (resolve A13 junto); maior que o pedido.
2. **Correção posterior a `marco_liberou_fat`.** "corrigir data" recusa futuro e anterior ao
   relatório/aprovação, mas não recusa data **depois** do dia em que o faturamento foi liberado.
   Improvável (o limite de cima já é hoje). Âncora: `corrigirDataFechamentoAction`.
3. **Grafias diferentes da mesma equipe** ("MANFAC-7", "manfac-7", "Manfac 7") viram equipes
   distintas nas sugestões, na Base e no filtro do diário. Texto livre foi o pedido; normalizar não foi.
   Âncora: `page.tsx:61-68` (`unir`).
4. **Sem limite de tamanho em equipe.** A coluna é `text`; um texto colado enorme é aceito.
   Âncora: `_actions.ts:716`, `sdd-sql-obras-v0.sql:74`.
5. **Salto que pula Fechar OS** (ex.: Relatório → Pendente faturamento) continua carimbando hoje sem
   perguntar a data; só o "corrigir data" resolve. Consequência do escopo do mockup (§2.2).
6. **`<datalist>` no iOS/Safari antigo** mostra sugestões de forma diferente (ou menos visível) do que
   no Chrome; o campo continua aceitando texto. Não verificável sem o aparelho.

---

## 9. Divergências mockup × código (nenhuma muda o comportamento pedido)

1. **Lista de sugestões de equipe.** O mockup desenha uma lista própria, com o trecho digitado
   destacado e a linha "Nenhuma sugestão — o texto digitado é aceito do mesmo jeito". Esta spec usa o
   `<datalist>` nativo do navegador: mesmo comportamento (sugere as equipes já usadas, aceita qualquer
   texto, sem erro), visual do navegador e sem aquela linha. Motivo: menor mudança, zero componente
   novo, acessível por padrão. A dica do campo já diz "Qualquer texto é aceito". **Se o João quiser o
   visual exato do mockup, é um componente de autocomplete a mais (~80 linhas + teste).**
2. **Referência da data mínima.** O mockup usa `aprovação || relatório`. A spec usa a **maior** das
   duas: idêntico no exemplo do mockup (aprovação 20/09 > relatório 18/09) e correto no caminho
   direto, em que a aprovação vem antes do relatório.
3. **Texto do erro.** O mockup diz "nada foi gravado: a obra continua em Fechar OS" em todo erro. Por
   causa da A13 isso seria falso na falha parcial; a tela mostra a mensagem do servidor sob o título
   do mockup, e o "Tentar de novo" recupera o caso parcial (§5.4).
4. **Condição do campo.** O mockup fala em "concluir Fechar OS"; no código, concluir = trocar a etapa
   de `fecharOS` para depois dela. Seguido o mockup à letra: só `fecharOS → pendFat` mostra o campo.

---

## 10. Riscos

| Risco | O que faz |
|---|---|
| `export` de tipo/constante em `_actions.ts` derruba a tela em runtime (armadilha 1) | `validarDataFechamentoOS` e mensagens moram em `ficha-campos.ts`; `_actions.ts` só ganha funções `async`. O teste de regressão `__tests__/use-server-exports-async.test.ts` (`4071df1`) varre os arquivos `use server` |
| Data digitada no fuso errado | `hoje` vem sempre de `hojeISO()` (fuso de São Paulo, `tipos.ts:36-45`), no servidor; a tela recebe `hoje` por prop, não calcula |
| Quebrar os testes existentes de `mudarEtapaAction` | O 3º parâmetro é opcional e, ausente, o comportamento é idêntico — os testes de `_actions.test.ts:110-315` passam sem mudança |
| Obra retroativa sem `marco_relatorio` nem `aprovacao` | Só a recusa de futuro vale; sem erro. Coberto por teste |
