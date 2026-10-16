# Gestão de Obras — "Agendar e tirar do diário" + botão "Solicitar compra" — design

Data: 16/10/2026. Autor: subagente de spec, para a rodada noturna (decisões em
`docs/obras/2026-10-16-decisoes-rodada-noturna.md`).

Fontes, todas lidas:

- Mockup aprovado para seguir: `docs/obras/mockups/mockup-pausa-diario.html` (as 8 suposições são seguidas
  **exatamente como escritas**; os vereditos do cliente ainda não chegaram, o que mudar vira ajuste depois).
- Mockup dos botões (só o de compra): `docs/obras/mockups/mockup-botoes-compra-medicao.html`.
- Mapa técnico: `docs/obras/2026-10-15-mapa-diario-tarefas.md` (seções 4 e 5, Desenho B) + nota "híbrido" em
  `docs/obras/2026-10-15-estado-ajustes.md:18` (campos na obra; a pausa aparece numa seção "Agendadas" em Tarefas).
- Investigação dos botões: `docs/obras/2026-10-15-investigacao-botoes-compra-medicao.md` §1.
- SQL: `sdd-sql-obras-historico.sql`, `sdd-sql-obras-cancelamento.sql` (padrão de extensão da RPC e do CHECK de bloco).

O que o mapa de 15/10 afirmava com linha foi reconferido no código de hoje (§10).

---

## 1. Escopo

**Entra:**

- **A) Agendar e tirar do diário.** O analista (PCM da obra) ou o administrador agenda uma ação ("o que vai
  acontecer") com motivo e data; a obra sai da fila do Diário até essa data e volta sozinha no dia marcado.
  Aparece em: cartão do Diário (botão + diálogo), bloco "Agendadas" no Diário, seção nova "Agendadas" em
  Tarefas, contador "Responderam X/Y" do Painel e do e-mail das 8h, Histórico da ficha.
- **B) Botão "Solicitar compra"** na ficha da obra, abrindo `/compras/solicitacoes/nova?obra=<obras_obra.id>` em
  nova aba.

**Fica de fora (não deixar placeholder):**

- Botão "Solicitar medição" (decisão pendente com o cliente) e a etiqueta "criada em DD/MM/AAAA" do mockup dos
  botões, que só existe para a medição.
- Tarefa manual avulsa (Desenho A do mapa). O agendamento mora na obra, não em `obras_tarefa`.
- Aviso por WhatsApp/e-mail no dia marcado. A obra só volta à fila.
- Bloquear a resposta do diário de obra agendada (hoje nada impede; ela só some da lista).
- Congelar "N dias sem andar" / "mesmo bloqueio há N dias" durante o agendamento: os contadores contam
  registros, e sem registro eles simplesmente não mudam.
- Etiqueta/filtro do agendamento na Base, no Kanban ou no cabeçalho da ficha (o mockup não mostra). A ficha
  mostra o agendamento só pelo Histórico.
- A lista por obra embaixo da linha "N agendadas (não contam)" no e-mail (o mockup desenha; a suposição 6 só
  fala da linha — ver §11, S7).
- Mudança no Compras (já aceita `?obra=`).

---

## 2. Regras (as 8 suposições do mockup, como escritas)

| # | Suposição do mockup | Como vira regra |
|---|---|---|
| 1 | Quem pode agendar: o PCM da obra e o administrador. O dono na tela Tarefas é quem agendou. | Server Action recusa quem não é admin nem tem `resolverChave(email) === obra.pcm`. "Dono" exibido = quem agendou (`diario_agendado_por`). |
| 2 | Motivo obrigatório, da lista curta, mais "Outro" com texto. | Lista fechada `MOTIVOS_AGENDAMENTO` (§5). "Outro" exige texto de 1 a 100 letras, gravado como `Outro: <texto>`. Validado na action e no CHECK. |
| 3 | Máximo de 30 dias. | Data entre **amanhã** e **hoje + 30** (inclusive), hoje em Brasília. Validado na action e no CHECK. |
| 4 | Volta sozinha na data, de manhã, sem ninguém liberar. Se atrasar, agenda de novo. | Nada de cron: a regra é **calculada** contra `hojeISO()`. A obra está fora da fila enquanto `hoje < diario_agendado_ate`; **no próprio dia marcado ela já está de volta** desde 00:00 de Brasília (ou seja, já aparece no diário da manhã e conta no e-mail das 08:01). |
| 5 | O botão aparece em todas as obras que estão no diário. | Botão em todo cartão pendente do Diário (etapas `levantamento`, `andamento`, `paralisado`). A action aceita só essas etapas. |
| 6 | Agendada não conta no "Responderam X/Y" do painel e do e-mail das 8h; o e-mail mostra a linha "3 agendadas (não contam)". | A obra agendada sai da `fila` de `ritmoDe` (denominador **e** numerador). `Ritmo` ganha `agendadas`. Painel e e-mail mostram "N agendadas (não contam)". |
| 7 | Tarefas atual intocada; seção nova "Agendadas" acima. | `tarefas/_lista.tsx` não muda. Componente novo acima dele. |
| 8 | No dia marcado a linha em Tarefas ganha "Marcar como feito", que tira o agendamento da lista. | Quando `hoje >= diario_agendado_ate`, a linha mostra o botão; o clique limpa os 5 campos e grava uma linha de histórico. |

### 2.1 Definições (a regra única, em `app/obras/_lib/agendamento.ts`)

Hoje = `hojeISO()` de `app/obras/_lib/tipos.ts:36` (fuso `America/Sao_Paulo`). Datas comparadas como
`AAAA-MM-DD` (comparação de string é correta nesse formato).

```ts
export const ETAPAS_FILA_DIARIO: Etapa[] = ['levantamento', 'andamento', 'paralisado']

// obra está agendada e ainda fora do diário
agendadaForaDoDiario(o, hoje) = ETAPAS_FILA_DIARIO.includes(o.etapa) && !!o.diario_agendado_ate && hoje < o.diario_agendado_ate
// obra entra na fila do diário
naFilaDoDiario(o, hoje)       = ETAPAS_FILA_DIARIO.includes(o.etapa) && !agendadaForaDoDiario(o, hoje)
// agendamento cuja data chegou e ninguém marcou como feito (a obra já voltou)
agendamentoVoltou(o, hoje)    = ETAPAS_FILA_DIARIO.includes(o.etapa) && !!o.diario_agendado_ate && hoje >= o.diario_agendado_ate
```

Obra agendada que **saiu** das etapas do diário (ex.: foi para Relatório ou foi cancelada) deixa de aparecer em
qualquer lista de agendadas e não conta em lugar nenhum; os campos ficam gravados e inofensivos (§11, S5).

### 2.2 A regra de fila deixa de ser duplicada

Hoje ela existe em dois lugares (`diario/page.tsx:32` `ETAPAS_FILA` e `painel/_calculos.ts:709`
`ETAPAS_FILA_DIARIO`, com um comentário apontando um para o outro). **Decisão: as duas cópias somem e os dois
importam `naFilaDoDiario` / `ETAPAS_FILA_DIARIO` de `_lib/agendamento.ts`.**

Por quê: o critério passa a ter duas partes (etapa + data), tem quatro consumidores reais (tela do Diário, Painel,
e-mail via Painel, seção de Tarefas) e o próprio mapa (§4) apontou a duplicação como risco. Manter duas cópias
de uma regra de duas partes é pedir que o e-mail diga um número e a tela outro. O e-mail não tem regra própria:
ele usa `montarPainel` → `ritmoDe` (`app/api/obras/relatorio-diario/route.ts`), então corrigir o Painel corrige o
e-mail.

Não vai para `_lib/tipos.ts` (936 linhas, o arquivo mais importado do módulo) para não aumentar o raio de
alcance; `tipos.ts` só ganha os 5 campos opcionais em `ObraRow`.

---

## 3. Schema (migration `sdd-sql-obras-agendamento-diario.sql`, na raiz)

Cinco colunas novas em `obras_obra`, todas nullable e sem default (Desenho B do mapa):

| Coluna | Tipo | Conteúdo |
|---|---|---|
| `diario_agendado_ate` | `date` | dia em que a obra **volta** ao diário |
| `diario_agendado_oque` | `text` | "O que vai acontecer?" (texto livre até 80, com 3 sugestões) |
| `diario_agendado_motivo` | `text` | um dos 3 motivos ou `Outro: <texto>` |
| `diario_agendado_por` | `text` | e-mail de quem agendou (padrão de `etapa_por`, `cancelado_quem`) |
| `diario_agendado_em` | `timestamptz` | quando agendou |

- **CHECK `obras_obra_agendamento_diario_coerente`**: ou as cinco vazias, ou as cinco preenchidas com textos não
  vazios, `oque` até 80, motivo da lista (ou `Outro: ` + 1 a 100 letras) e
  `(em em Brasília)::date < ate <= (em em Brasília)::date + 30`. Envolvido em `coalesce(..., false)`.
- **Histórico:** `obras_historico_bloco_check` ganha `'Agendamento'`; `obras_historico_campo_check` ganha
  `'diario_agendado_ate'`. Os dois são recriados a partir das listas **conferidas em produção em 16/10/2026**.
- **RPC `obras_aplicar_alteracao`:** recriada idêntica à do cancelamento, com as 5 colunas no fim das três listas.
  A seção 0 aborta se o md5 do corpo em produção não for `aeb70b0d0d9df777d2ca803e22c469ce` (medido em produção
  em 16/10 e igual ao corpo de `sdd-sql-obras-cancelamento.sql`), para não apagar mudança feita por outro caminho.
- **RLS de `obras_obra`: não muda.** Conferida em produção em 16/10: uma policy só, `obras access`, `ALL`,
  `using`/`with check` `(select obras_has_access())`. A regra "PCM da obra ou admin" fica na Server Action, que
  é o mesmo nível em que o Diário já aplica a regra de pcm (a tela filtra por pcm; a RLS libera o módulo inteiro).
  Ver §11, S1.
- Verificação: 13 linhas (PARTE 2). Teste de comportamento com rollback forçado: 12 casos (PARTE 3).
- **Sem índice:** a fila lê as obras das 3 etapas e separa em memória (§6.4); a tabela tem centenas de linhas.

O que **grava** cada ação (o mínimo que o mockup mostra):

| Ação | `obras_obra` | `obras_historico` (bloco `Agendamento`, campo `diario_agendado_ate`) |
|---|---|---|
| Agendar | as 5 colunas preenchidas (`por` = e-mail da sessão, `em` = agora) | `de` = data anterior (se havia agendamento vencido) ou vazio; `para` = DD/MM/AAAA; `motivo` = `<o que> — <motivo>` |
| Trazer de volta agora | as 5 colunas = `null` | `de` = DD/MM/AAAA, `para` vazio, `motivo` = `Trazido de volta ao diário` |
| Marcar como feito | as 5 colunas = `null` | `de` = DD/MM/AAAA, `para` vazio, `motivo` = `Marcado como feito` |

Quem e quando de "trazer de volta" e "marcar como feito" ficam no histórico (`quem`, `created_at`, preenchidos pela
RPC). Nenhuma coluna extra de "feito por/em".

---

## 4. Telas e textos

Textos copiados do mockup. `DD/MM` = `dia/mês` da data; `<o que>` com a primeira letra minúscula onde o mockup usa
`lc()`.

### 4.1 Cartão do Diário (`diario/_cartao.tsx`)

- **Faixa "voltou"** (quando `agendamentoVoltou`), logo abaixo do cabeçalho do cartão:
  `Voltou do agendamento: <o que> previsto para <hoje | DD/MM>. Agendado por <Nome> · motivo: <motivo>`
  ("hoje" quando a data é hoje; senão `DD/MM`).
- **Rodapé, depois de "Salvar e sair da fila"**, separado por linha:
  botão `📅 Agendar e tirar do diário` e, ao lado, a nota
  `Para obra que só será levantada mais tarde: ela sai do diário até a data que você escolher.`
- O botão abre o diálogo (§4.2). Em sucesso: mensagem `Obra agendada. Sai do diário até DD/MM e volta sozinha
  nesse dia.` (role="status") e `router.refresh()` — a obra sai da fila.

### 4.2 Diálogo "Agendar e tirar do diário" (componente novo `diario/_dialogo-agendar.tsx`)

Modal (`role="dialog"`, `aria-modal`), no padrão de `obra/[id]/_dialogo-remarcar.tsx`.

- Cabeçalho: `OS <os> · <tipo>` / título `Agendar e tirar do diário` / `<loja> · <descrição>`.
- **"O que vai acontecer?"** — campo de texto (máx. 80), começa preenchido com `Levantamento de material`, e três
  sugestões clicáveis que substituem o texto: `Levantamento de material`, `Levantamento de medidas`,
  `Visita técnica`.
- **"Por que a obra está parada?"** — botões de escolha única (`aria-pressed`):
  `Aguardando levantamento de material`, `Aguardando material`, `Aguardando cliente / liberação da loja`,
  `Outro`. Com "Outro", aparece o campo `Escreva o motivo em uma linha` (máx. 100).
- **"Até quando? (a obra volta ao diário nesse dia)"** — `<input type="date" min=amanhã max=hoje+30>`, com a nota
  `Entre DD/MM e DD/MM (máximo de 30 dias).`
- **Caixa "O que acontece quando você confirmar"** (atualiza ao vivo; `__/__` enquanto não há data válida):
  - `A obra sai do diário até DD/MM. Ninguém precisa responder o diário dela até lá.`
  - `No dia DD/MM ela volta sozinha para o diário.`
  - `O agendamento aparece em Tarefas, com você como dono.` (admin: `com você (admin) como dono`)
  - `Ela deixa de contar no "Responderam X/Y" do painel e do e-mail das 8h.`
- Botões: `Cancelar` e `Agendar e tirar do diário` (desabilitado até tudo válido; durante o envio `salvando…`).
- Dica ao lado do botão, na ordem: `Diga o que vai acontecer.` / `Escolha o motivo da parada.` /
  `Escreva o motivo.` / `Escolha uma data entre amanhã e 30 dias.`
- **Erro de gravação** (qualquer `{error}` que não seja de validação): bloco
  `Não deu para agendar` / `A conexão falhou na hora de salvar. Nada mudou: a obra continua no diário e nenhuma
  tarefa foi criada. Tente de novo; se continuar, avise o suporte da Manfac.` e o botão vira `Tentar de novo`.
  Erro de validação/permissão devolvido pelo servidor aparece no lugar da dica.
- Fecha por `Cancelar`, clique fora ou Esc.

### 4.3 Topo do Diário (`diario/_cartoes.tsx`)

- **Barra:** depois de `N obras para responder hoje`, o botão `· M agendada(s) ▾/▴` (singular/plural como no
  mockup), que abre/fecha o bloco abaixo. Aparece sempre, inclusive com 0 (como no mockup).
- **Bloco "Agendadas — fora do diário até a data"**, subtítulo `voltam sozinhas no dia`. Cada linha:
  `<loja>` · `OS <os>` · `volta em DD/MM` / `<o que>` / `Motivo: <motivo> · agendou <Nome> em DD/MM` e o botão
  `Trazer de volta agora` (só para admin ou para o PCM da obra; na prática todo não-admin só vê as próprias).
  Vazio: `Nenhuma obra agendada. Quando alguém tirar uma obra do diário por causa de um levantamento, ela aparece
  aqui.` Em sucesso de "Trazer de volta": `<loja> voltou para o diário.` e `router.refresh()`.
- **Todas agendadas** (fila vazia, agendadas > 0): `Nenhuma obra para responder hoje` /
  `Todas as obras deste diário estão agendadas. Elas voltam sozinhas nas datas marcadas.`
- **Diário fechado:** o texto atual ganha o complemento do mockup quando há agendadas:
  `As N obras foram respondidas. M agendada(s) não conta(m) até a data de volta.` (o resto do texto atual fica).
- **Ordem da fila:** obras que voltaram de agendamento primeiro, depois a ordem atual (`diasAlerta` decrescente).
- **Seletor do admin:** o texto passa a ser o do mockup:
  `Você é administrador do hub: vê tudo e pode trazer de volta qualquer agendada.`
- Sem fila e sem agendadas: fica o estado vazio atual (`Nenhuma obra em campo para responder hoje.`).

### 4.4 Tarefas (`tarefas/page.tsx` + componente novo `tarefas/_agendadas.tsx`)

Seção nova **acima** da lista atual, que não muda:

- Título `Agendadas` + selo `novo` + `N obra(s) fora do diário`; subtítulo
  `Obras que saíram do diário até a data do levantamento. No dia marcado elas voltam sozinhas.`
- Ordenadas por data de volta crescente. Inclui as fora do diário **e** as que já voltaram sem "feito".
- Linha ainda fora do diário: título `<o que>`, data `DD/MM` à direita, e
  `<loja> · OS <os> · dono <Nome> · motivo: <motivo>`.
- Linha cuja data chegou: título `Hoje: <o que> na <loja>`, `OS <os> · dono <Nome> · motivo: <motivo>`,
  `A obra já voltou ao diário.` (com ` desde DD/MM` se a data não é hoje) e o botão `Marcar como feito`.
- Vazio: `Nenhuma obra agendada. Quando alguém tirar uma obra do diário por causa de um levantamento, ela aparece
  aqui.`
- Quem vê: admin vê todas; os demais veem as agendadas das obras em que são PCM (mesmo recorte do Diário; o
  mockup filtra assim). Sem chave e não-admin: a seção mostra o estado vazio.

### 4.5 Painel (`painel/_painel.tsx`) e e-mail (`relatorio-diario/_imagem.tsx`)

- `Responderam X/Y` e `N ainda aguardam resposta` já saem certos de `ritmoDe` (agendada fora da fila).
- Painel: quando `agendadas > 0`, uma linha a mais no mini "Responderam": `N agendada(s) (não contam)`.
- E-mail: o mini tem altura fixa de 2 linhas (`linhasM: 2`); a linha entra no mesmo texto de rodapé:
  `N ainda aguardam resposta · M agendada(s) (não contam)` quando `M > 0`. Sem mudar alturas (o render do PNG é
  sensível a layout; ver `.claude/rules/obras.md`, relatório diário).

### 4.6 Histórico da ficha

`_lib/historico.ts`: `BlocoHistorico` ganha `'Agendamento'`; `CampoHistorico` ganha `'diario_agendado_ate'` com
rótulo `Agendamento do diário (volta em)`, formatado como data; `COLUNA_PARA_CAMPO` mapeia
`diario_agendado_ate`. `obra/[id]/_historico.tsx` ganha o filtro `Agendamento`.

### 4.7 Botão "Solicitar compra" (ficha, `obra/[id]/_ficha.tsx`)

Dentro do `<header>` da ficha, à direita, uma caixa no estilo `.acoes` do mockup:

- título `Pedir a partir desta obra` (11px, maiúsculas, `#94a3b8`);
- `<a href="/compras/solicitacoes/nova?obra=<obra.id>" target="_blank" rel="noopener">Solicitar compra ↗</a>`
  com aparência de botão primário laranja (`#f05a28`), `↗` com `aria-hidden`;
- nota `Abre o Compras em nova aba, com esta obra.`
- `<a>` e não `<Link>`: o Compras é app separada no mesmo domínio (AGENTS.md).
- Some quando a obra está cancelada (§11, S8). Nenhum placeholder de medição.

---

## 5. Constantes (`app/obras/_lib/agendamento.ts`)

```ts
export const SUGESTOES_AGENDAMENTO = ['Levantamento de material', 'Levantamento de medidas', 'Visita técnica'] as const
export const MOTIVOS_AGENDAMENTO = [
  'Aguardando levantamento de material',
  'Aguardando material',
  'Aguardando cliente / liberação da loja',
] as const
export const MOTIVO_OUTRO = 'Outro'
export const LIMITE_DIAS_AGENDAMENTO = 30
export const MAX_OQUE = 80
export const MAX_OUTRO = 100
```

Os três motivos têm de bater, letra por letra, com o CHECK do SQL.

---

## 6. Server Actions (em `app/obras/diario/_actions.ts`)

Receita do módulo: `createClient()` → `auth.getUser()` → `hasSystemAccess(..., 'obras')` → leitura → validação →
`gravarComHistorico` (RPC `obras_aplicar_alteracao`) → `revalidatePath` → `{ error? } | { success? }`. Nunca lança.
**Sem `export type` novo** nesse arquivo `use server` (armadilha 1 de `.claude/rules/obras.md`): os tipos de
entrada vão para `_lib/agendamento.ts`.

### 6.1 `agendarDiarioAction(entrada: EntradaAgendamento)`

`EntradaAgendamento = { obraId: string; oque: string; motivo: string; outro: string; ate: string }`.

1. Sessão + `hasSystemAccess` (admin passa) → senão `Sem acesso à Gestão de Obras` / `Não autenticado`.
2. `validarAgendamento(entrada, hoje)` (pura, §6.4) → mensagem de validação.
3. Lê a obra (`id, etapa, pcm, diario_agendado_ate`). Não achou → `Obra não encontrada`.
4. Permissão: admin, ou `resolverChave(supabase, email) === obra.pcm` (chave vazia nunca casa) → senão
   `Só o responsável pela obra ou o administrador pode agendar.`
5. Etapa fora de `ETAPAS_FILA_DIARIO` → `Só obra que está no diário pode ser agendada.`
6. Já agendada e ainda fora (`agendadaForaDoDiario`) → `Esta obra já está agendada até DD/MM. Recarregue a página.`
   (agendamento vencido pode ser sobrescrito: "se o levantamento atrasar, o analista agenda de novo").
7. Um só `agora = new Date()`: `hoje = hojeISO(agora)`, `em = agora.toISOString()` — os dois do mesmo instante,
   para o CHECK (que conta os 30 dias a partir de `em` em Brasília) concordar com a validação.
8. `gravarComHistorico` com os 5 campos e a linha de §3. Erro → `ERRO_AGENDAR` (o texto do mockup, §4.2).
9. `revalidatePath('/obras/diario')`, `('/obras/tarefas')`, `('/obras/painel')`, `(`/obras/obra/${id}`)`.

### 6.2 `encerrarAgendamentoAction(obraId: string, como: 'volta' | 'feito')`

1. Sessão + acesso + leitura (`id, etapa, pcm, diario_agendado_ate`) + a mesma permissão de 6.1.
2. Sem agendamento → `Esta obra não está agendada. Recarregue a página.`
3. `como = 'volta'` exige `agendadaForaDoDiario` (senão `Esta obra já voltou ao diário. Recarregue a página.`);
   `como = 'feito'` exige `agendamentoVoltou` (senão `O agendamento ainda não chegou na data. Use "Trazer de
   volta agora" no diário.`).
4. Grava as 5 colunas `null` + a linha de §3. Erro → `Não deu para salvar. Nada mudou — tente de novo.`
5. Mesmos `revalidatePath`.

### 6.3 Por que a regra de quem pode fica na action e não na RLS

A RLS de `obras_obra` é por módulo (`obras_has_access()`), e é assim que todo o módulo escreve hoje: a ficha, a
remarcação e o cancelamento deixam qualquer pessoa com acesso editar qualquer obra; o Diário restringe por pcm
só na tela. Restringir por pcm no banco exigiria mudar a RLS de `obras_obra` (território de exceção, schema, e
com risco de quebrar as outras escritas). O dano possível de alguém com acesso ao módulo agendar a obra de outro
analista pelo navegador é tirar uma obra do diário por até 30 dias, com rastro no histórico. Registrar em
`docs/DIVIDAS.md`.

### 6.4 Funções puras (`_lib/agendamento.ts`)

- `ETAPAS_FILA_DIARIO`, `naFilaDoDiario`, `agendadaForaDoDiario`, `agendamentoVoltou` (§2.1).
- `somarDiasISO(iso, n)` — soma dias em `AAAA-MM-DD` (UTC ao meio-dia, como o mockup).
- `limitesAgendamento(hoje)` → `{ min: amanhã, max: hoje + 30 }`.
- `validarAgendamento(entrada, hoje)` → `{ error: string } | { campos: { ate, oque, motivo } }` com o motivo já
  montado (`Outro: <texto>`), textos com `trim`, e as mensagens de §4.2.
- `nomeDeQuemAgendou(email, pessoas)` → primeiro nome de `obras_pessoa` com aquele e-mail; senão a parte antes do
  `@` e do primeiro `.`, com inicial maiúscula (`yuri.moreira@…` → `Yuri`).
- `textoAgendadas(n)` → `1 agendada` / `N agendadas` (usado no Diário, Painel e e-mail).

---

## 7. Leitura dos dados

- **Diário (`diario/page.tsx`):** a consulta continua pegando as obras das 3 etapas (`select('*')`, já traz as
  colunas novas) com o filtro de pcm. Depois, em memória: `fila = naFilaDoDiario`, `agendadas =
  agendadaForaDoDiario`. A guarda "não-admin sem obra nenhuma → SemPermissao" passa a olhar **todas** as obras lidas
  (fila + agendadas), senão o analista com tudo agendado cairia na tela de sem permissão em vez de "Todas as
  obras deste diário estão agendadas". Respostas e tarefas de hoje continuam lidas só para os ids da fila.
  `obras_pessoa` passa a selecionar também `email` (para o nome de quem agendou).
- **Painel/e-mail:** `lerEntradaDoPainel` já faz `select('*')` em `obras_obra` — nenhuma mudança de leitura.
- **Tarefas:** uma leitura nova de `obras_obra` (`id, os, loja, pcm, etapa, diario_agendado_*`) com
  `.not('diario_agendado_ate', 'is', null)` e `.in('etapa', ETAPAS_FILA_DIARIO)`, mais `resolverChave` para o
  recorte do não-admin. Falha da leitura nova → a tela de erro atual (como as outras leituras da página).

---

## 8. Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `sdd-sql-obras-agendamento-diario.sql` (novo) | migration |
| `app/obras/_lib/agendamento.ts` (novo) | regra da fila, validação, constantes, nomes |
| `app/obras/_lib/tipos.ts` | 5 campos opcionais em `ObraRow` |
| `app/obras/_lib/historico.ts` | bloco, campo, rótulo, data, mapa coluna→campo |
| `app/obras/obra/[id]/_historico.tsx` | filtro `Agendamento` |
| `app/obras/diario/_actions.ts` | `agendarDiarioAction`, `encerrarAgendamentoAction` |
| `app/obras/diario/page.tsx` | sai `ETAPAS_FILA`; separa fila/agendadas; e-mail em `obras_pessoa` |
| `app/obras/diario/_cartoes.tsx` | barra com agendadas, bloco Agendadas, todas agendadas, diário fechado, ordem, texto do admin |
| `app/obras/diario/_cartao.tsx` | botão + faixa "voltou" |
| `app/obras/diario/_dialogo-agendar.tsx` (novo) | diálogo |
| `app/obras/painel/_calculos.ts` | sai a cópia da constante; `naFilaDoDiario`; `Ritmo.agendadas` |
| `app/obras/painel/_painel.tsx` | linha "N agendadas (não contam)" |
| `app/api/obras/relatorio-diario/_imagem.tsx` | complemento no rodapé do mini |
| `app/obras/tarefas/page.tsx` | leitura das agendadas |
| `app/obras/tarefas/_agendadas.tsx` (novo) | seção Agendadas + "Marcar como feito" |
| `app/obras/obra/[id]/_ficha.tsx` | botão "Solicitar compra" |
| `docs/DIVIDAS.md` | bordas registradas (§9) |
| testes ao lado (ver plano) | |

Nenhuma mudança em `middleware.ts`, RLS, `hub_system_access`, `hub_user_roles`, Compras.

---

## 9. Bordas deixadas de propósito (vão para `docs/DIVIDAS.md`)

1. Permissão "PCM ou admin" só na action; pela API REST, quem tem acesso ao módulo consegue agendar qualquer obra
   (§6.3).
2. Read-then-write nas duas actions: duas pessoas agendando/encerrando a mesma obra ao mesmo tempo — vence a última,
   ambas com linha de histórico.
3. Obra que sai das etapas do diário com agendamento gravado: os campos ficam; se ela voltar para uma etapa do
   diário antes da data, volta agendada.
4. Resposta de diário em obra agendada (aba antiga aberta) é aceita e não aparece no "Responderam".
5. Virada de meia-noite entre abrir o diálogo e salvar: o servidor revalida com o hoje dele; o pior caso é a
   mensagem "Escolha uma data entre amanhã e 30 dias.".

---

## 10. Conferência do mapa de 15/10 contra o código de hoje

| Afirmação do mapa | Hoje |
|---|---|
| `diario/page.tsx:32` `ETAPAS_FILA` | confere (linha 32) |
| `diario/page.tsx:84-88` consulta com `.in('etapa')` e pcm | confere (linhas 84-88) |
| `painel/_calculos.ts:709` cópia + `ritmoDe :726-745` | confere (709; `ritmoDe` 726-746) |
| `painel/_painel.tsx:826-841` "Responderam X/Y" | confere (839-841) |
| `_imagem.tsx:981-992` | confere (981-994) |
| `painel/_leitura.ts` lê `obras_obra` com `*` | confere |
| `hojeISO` em Brasília | `_lib/tipos.ts:36` |
| RPC e CHECKs do histórico | conferidos **em produção** em 16/10 (consulta de catálogo só leitura): md5 da RPC = corpo do cancelamento; bloco com 6 valores; campo com 19 |
| RLS de `obras_obra` | produção: só `obras access` (ALL) |
| `salvarDiarioAction` não checa pcm | confere (`diario/_actions.ts:64-85`) |

---

## 11. Suposições do coordenador (decididas sem fonte)

- **S1.** A regra "PCM da obra + admin" fica na Server Action; RLS intocada (§6.3). Dívida registrada.
- **S2.** "Volta no dia marcado" = fora da fila enquanto `hoje < data`; no dia marcado, desde 00:00 de Brasília, a
  obra já está na fila (e conta no e-mail das 08:01). Interpretação literal de "no dia marcado a obra reaparece no
  diário de manhã".
- **S3.** "Máximo de 30 dias" = data de volta entre amanhã e hoje + 30, inclusive. Data de hoje não é aceita (seria
  um agendamento que não tira a obra de lugar nenhum).
- **S4.** "Marcar como feito" e "Trazer de volta agora" **limpam** os 5 campos; quem e quando ficam só no
  histórico. "Trazer de volta" só existe enquanto a obra está fora (no bloco do Diário, como no mockup);
  "Marcar como feito" só depois que a data chegou (em Tarefas, como no mockup).
- **S5.** Agendada cuja obra saiu das 3 etapas não aparece nem conta em lugar nenhum; nada limpa os campos
  automaticamente.
- **S6.** Na seção Agendadas de Tarefas, o não-admin vê só as das obras em que é PCM (o mockup filtra assim), embora a
  lista de tarefas atual mostre tudo a todos.
- **S7.** No e-mail e no Painel entra só a linha `N agendadas (não contam)`, e só quando N > 0; a lista por obra que
  o mockup desenha embaixo da linha fica de fora (altura fixa do PNG; a suposição 6 fala só da linha). No Diário, o
  contador `· 0 agendadas` aparece mesmo com zero, como no mockup.
- **S8.** O botão "Solicitar compra" some em obra cancelada (o Compras ignoraria a obra cancelada e abriria sem ela).
- **S9.** "Dono" exibido = primeiro nome de quem agendou, vindo de `obras_pessoa.email`; sem cadastro, a parte do
  e-mail antes do primeiro ponto. Grava-se o e-mail, como `etapa_por`/`cancelado_quem`.
- **S10.** Re-agendar uma obra cujo agendamento venceu sobrescreve o antigo (com linha de histórico `de → para`);
  re-agendar enquanto ainda está fora é recusado.
- **S11.** Os textos de estado vazio e do diário fechado que já existem no código ficam; só se acrescenta o que é
  do agendamento. Exceção: o texto do seletor do admin, que o mockup reescreve por causa do "trazer de volta".
- **S12.** A regra de fila sai de `diario/page.tsx` e de `painel/_calculos.ts` e passa a morar em
  `_lib/agendamento.ts` (§2.2).

## 12. Contradições entre o mockup e o código

1. **Seletor do admin:** código diz `Você é administrador do hub — cada analista vê só as obras dele.`; mockup diz
   `…: vê tudo e pode trazer de volta qualquer agendada.` Segue o mockup (S11).
2. **Estado vazio:** código `Nenhuma obra em campo para responder hoje.`; mockup `Nenhuma obra para responder hoje
   / Não há obras em levantamento, andamento ou paralisadas neste diário.` Fica o do código (fora do escopo).
3. **Analista sem obra nenhuma:** o código mostra "Esta tela é de quem é responsável pelas obras"; o mockup (cenário
   "Diário vazio") mostra o estado vazio. Fica o do código.
4. **Onde fica o botão:** o Desenho B do mapa punha o botão na ficha; o mockup aprovado põe no cartão do Diário.
   Segue o mockup.
5. **Recorte do "Ritmo":** o mockup mostra `RITMO DO DIÁRIO · YURI` (por analista); o Painel e o e-mail reais
   filtram por cliente. Fica o recorte real.
6. **Tarefas para o analista:** a lista atual mostra tarefas de todos os donos a qualquer pessoa com acesso; a
   seção Agendadas do mockup filtra por PCM. Segue o mockup só na seção nova (S6).
