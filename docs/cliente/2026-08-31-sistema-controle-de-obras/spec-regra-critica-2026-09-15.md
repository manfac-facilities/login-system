# Spec — nova contagem da obra em atenção / crítica (15/09/2026)

Frente: J4, seção E do mockup. Só especificação: nenhum código foi alterado para escrever este
documento. Plano de implementação: `plano-regra-critica-2026-09-15.md` (mesma pasta).

## 1. Fontes (as decisões que valem)

| Fonte | O que diz |
|---|---|
| `feedback-14-mockup-j4-v01.md:31-34`, fala literal do cliente | *"a sinalização de atenção fica acima de 20 dias da data de aprovação da OS ou liberação, a que for menor. Acima de 30 dias já é critico.. aqui só muda o criterio de tempo desde a data"* |
| `j4-decisoes-2026-09-14.md:46`, decisão **5 (revista)** | Os dias contam da **data mais antiga entre liberação e aprovação**; sem nenhuma das duas, da **entrada**. Registrar uma data nova nunca derruba a contagem. Substitui a decisão 5 original (`:25`) |
| `j4-decisoes-2026-09-14.md:49`, decisão **12** | A obra sai dos alertas de obra parada **quando a Manfac faturar** (data de faturamento registrada), não em `etapa === 'faturado'` |
| `mockup-j4-v01.html:261-277` (seção E) e `:344-356` (`ancora`, `selo`) | O que o cliente viu e julgou: âncora na data mais antiga, fallback na entrada, selo "N dias desde a {aprovação \| liberação \| entrada}", **limiares 100 (crítica) e 60 (atenção)** |
| `revisao-mockup-j4-2026-09-14.md:67-100, 114-124` | O caso dos 104 dias e a recomendação de que `encerrada` passe a depender de `marco_faturou` |
| `j4-conciliacao-2026-09-14.md:63, 140, 253-263` | Mapa plano × código: `aprovacao` dispara a crítica; nula, a obra nunca fica crítica |
| Decisão do João (15/09/2026), repassada pelo coordenador desta implementação | Sobre o "caso 12" (linha 12 da tabela §4): registrar uma data nova **nunca** pode derrubar a contagem, nem quando a data nova é a liberação. Generaliza a decisão 5 revista: a **entrada** vira candidata à âncora **sempre**, não só quando faltam aprovação e liberação — vale para obras cujas datas já existiam, não só para data registrada depois. Resolve a contradição C1 (seção 7) |

### Como ler o "aqui só muda o critério de tempo"

O mockup mostrado ao cliente **já trazia a âncora nova** (data mais antiga, com a entrada como
fallback) e os limiares **antigos**: 100 e 60 (`mockup-j4-v01.html:262`, `:1002`). O cliente
marcou "Ajustar" e disse que só muda o critério de tempo. Leitura: **a âncora foi aceita; os
limiares passam de 100/60 para 30/20.**

**Os limiares 20/30 não existem no código.** Hoje o código usa 100 e 60 (seção 2). A
hipótese de que "20/30 já existem" está errada.

## 2. Regra atual (código em 15/09/2026)

| O quê | Onde | Regra |
|---|---|---|
| Número de dias | `app/obras/_lib/tipos.ts:401` | `dias = diasDesde(o.aprovacao, hoje)`. Sem `aprovacao`, `dias = null` |
| Doc do derivado | `tipos.ts:330-331` | "Dias desde a aprovação. É o número da coluna 'dias' e da ordenação default" |
| Crítica | `tipos.ts:440-442` | `!encerrada(o) && o.etapa !== 'definir' && o.dias !== null && o.dias >= 100` |
| Atenção (cor do contador) | `tipos.ts:550-555` | `classeDias`: vazio se encerrada ou `definir`; `'critico'` se `critico`; `'atencao'` se `estourou(o) \|\| dias >= 60` |
| Estourou | `tipos.ts:445-449` | fora de pós-campo e `definir`: `duracao ? dias > duracao*4 : dias >= 120`. **Usa o mesmo `dias`** |
| Encerrada | `tipos.ts:360-363` | `etapa === 'faturado'` |
| Severidade | `tipos.ts:522-534` | `encerrada` → `critico` → `semCobertura` → ... → `atencao` (paralisado, travado, estourou, atraso). **O token `atencao` de `sev` não olha dias corridos** |
| Usam `encerrada` | `tipos.ts:471-473` (`encalhada`), `:489-491` (`semCobertura`), `:523` (`sev`), `:551` (`classeDias`) | |
| Comentários que fixam o produto | `tipos.ts:11-12` ("100 dias ... mudá-los é mudar o produto"), `:432-436` ("vermelho reservado a 100 dias ou mais. São três na base") | Ficam falsos com a regra nova |
| Aritmética de data | `tipos.ts:59-81` | `msDe`/`diasDesde` só aceitam `AAAA-MM-DD`. **Um `timestamptz` como `created_at` devolve `null`** (`'2026-09-14T16:53:22+00:00'.split('-')` dá 3 partes, e o dia `'14T16…'` vira `NaN`) |
| Testes da regra atual | `app/obras/__tests__/tipos.test.ts:233-247` (crítico 99/100), describe `contador de dias` (60/100), `estourou o prazo`, `severidade` | |

### Colunas reais (`sdd-sql-obras-v0.sql` e `tipos.ts:216-270`)

| Conceito do cliente | Coluna | Tipo | Observação |
|---|---|---|---|
| Aprovação da OS | `aprovacao` (`sql:94`) | `date` | Decisão 4: mesma data gravada em `marco_os_aprov` (`sql:104`). A spec usa `aprovacao` |
| Liberação | `liberado_em` (`sql:81`) + `liberado_por` (`sql:80`) | `date` + `text` | A action só grava a data junto com o nome (`obra/[id]/_actions.ts:147-152`): "sem nome de quem liberou, a data não significa nada" |
| Entrada | **não existe coluna `entrada`**. O mais próximo é `created_at` (`sql:120`) | `timestamptz not null default now()` | É a hora do **insert**, ou seja, da sincronização. Não é a data de abertura da OS no Field |
| Faturamento | `marco_faturou` (`sql:107`, `tipos.ts:257`) | `date` | **Existe. Não há bloqueio de schema para a decisão 12.** Mas **nenhum código grava essa coluna hoje**: o único uso é a leitura em `obra/[id]/_ficha.tsx:63` |

## 3. Regra nova

### 3.1 Âncora (de que data se conta)

> **Atualizada em 15/09/2026 por decisão do João sobre o "caso 12" (tabela da seção 4),
> repassada pelo coordenador — não é interpretação do implementador.** A versão original desta
> seção (decisão 5 revista, 14/09) só olhava a entrada quando faltavam aprovação e liberação.
> Isso contradizia a própria decisão 5 revista ("registrar uma data nova nunca derruba a
> contagem"): no caso 12, registrar a liberação derrubava a contagem de 75 para 0 (contradição
> C1, seção 7). O João decidiu a favor da decisão 5 revista, não da implementação literal: a
> **entrada** passa a ser candidata **sempre**, não só como último recurso. Isso vale para
> obras cujas datas de aprovação/liberação **já existiam desde o início**, não só para uma data
> registrada depois do fato — por isso o caso 1 da tabela (antes "os 104 dias") também muda,
> para 108.

1. **Data de entrada:** `created_at` convertido para o **dia em São Paulo** (`America/Sao_Paulo`,
   o mesmo fuso de `hojeISO`). Candidata **sempre**, não só na ausência das outras duas.
2. **Data de aprovação válida:** `aprovacao`, quando for uma data `AAAA-MM-DD` válida.
3. **Data de liberação válida:** `liberado_em`, **só quando `liberado_por` estiver preenchido**
   e a data for válida.
4. Vale a **mais antiga das três**. Em empate, a fonte mais "oficial" decide: aprovação >
   liberação > entrada (a mesma prioridade que a decisão 5 revista já dava a aprovação sobre
   liberação, agora estendida à entrada).
5. Sem nenhuma data utilizável, não há contagem (`null`), e a obra nunca fica em atenção nem
   crítica por tempo.

Consequência: registrar uma aprovação ou liberação **nova** — mesmo que mais recente que a
entrada — **nunca** derruba a contagem, porque a entrada continua concorrendo como candidata.
Isso resolve a contradição C1 (seção 7): deixa de ser exceção/resíduo e vira a regra.

### 3.2 Limiares ("acima de")

- **Atenção:** contagem **> 20** (21 dias em diante).
- **Crítica:** contagem **> 30** (31 dias em diante).
- Exatamente 20 dias: nada. Exatamente 30 dias: atenção, ainda não crítica.

O código atual usa `>=` (100, 60). A spec segue a letra do cliente ("acima de"), e isso muda a
fronteira em um dia.

### 3.3 O que continua igual na regra

- `critico` continua excluindo a obra encerrada e a obra em `definir` (o selo do mockup também
  não pinta obra em definição, `:354`).
- `classeDias` continua pintando de âmbar a obra que `estourou()`, além da contagem > 20.
- `sev` continua com a mesma ordem de `if`. Só muda o que entra por `critico` (e, se a decisão 12
  entrar, por `encerrada`).
- O derivado `dias` **continua sendo "dias desde a aprovação"**. A contagem nova vira um derivado
  **novo** (`diasAlerta`, com a âncora em `ancora`). Motivo técnico: `dias` alimenta `estourou`,
  o KPI "aprovadas há mais de 60 dias", a ordenação do diário e textos que dizem literalmente
  "desde a aprovação", dois deles em arquivos que outra frente está mexendo (seção 5). Trocar o
  significado de `dias` mudaria tudo isso sem decisão (ver ambiguidade A3).

### 3.4 Selo e coluna

- `BadgeDias` mostra `diasAlerta`, com cor de `classeDias`. Na forma longa, escreve "N dias desde
  a aprovação / liberação / entrada" (mockup `:270`, `:355`). Na forma curta, só "N dias". Com 1,
  usa o singular "dia".
- A coluna da tabela passa a ordenar por `diasAlerta` (o número que ela mostra), e a ordem padrão
  também. O rótulo "Dias desde a aprovação" deixa de ser verdade. **O texto novo é decisão
  pendente (A5)**; o plano usa "Dias em aberto" como provisório, texto que já existe em
  `_ficha.tsx:290`.

### 3.5 Decisão 12: encerrada = faturada pela Manfac

- `encerrada(o)` passa a ser: `marco_faturou` preenchido. `etapa` deixa de importar.
- Obra em `etapa = 'faturado'` **sem** `marco_faturou`: continua em aberto, continua na esteira,
  pode ser crítica.
- **Dependência bloqueante de sequência, não de schema:** nada grava `marco_faturou` hoje. Se isso
  subir antes de a frente da esteira gravar essa data ao concluir o passo Faturado, nenhuma obra
  volta a encerrar. O banco tem 0 obras, então não há dado a corrigir, mas o comportamento fica
  errado. Ver A6 e A7.

## 4. Tabela de casos

Hoje = **14/09/2026** (a mesma data dos exemplos do mockup). "Atual" é o código de hoje (≥100
crítica, ≥60 atenção, só `aprovacao`, encerrada por etapa). "Nova" é esta spec. Salvo indicação,
`etapa = 'andamento'`, `duracao = null` (para `estourou` não interferir) e `marco_faturou = null`.

**Linhas 1, 2 e 12 foram recalculadas em 15/09/2026** pela decisão do João sobre o caso 12 (âncora
da §3.1) — não são erro de digitação, é o efeito da entrada virar candidata sempre.

| # | Caso | aprovacao | liberado_por / liberado_em | created_at | Outros | Âncora nova | Contagem nova | Atual | **Nova** |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Os 108 dias** (era "104", decisão de 15/09): liberada, OS aprovada hoje | 2026-09-14 | JUAN / 2026-06-02 | 2026-05-29T12:00Z | | entrada 29/05 — era liberação 02/06; a entrada é anterior e agora concorre | 108 | nada (0 dias) | **Crítica** |
| 2 | Mesma obra antes de aprovar | null | JUAN / 2026-06-02 | 2026-05-29T12:00Z | | entrada 29/05 — era liberação 02/06 | 108 | nada (`dias` null) | **Crítica** |
| 3 | Aprovação **posterior** à liberação | 2026-09-01 | LEANDRO / 2026-08-20 | | | liberação 20/08 | 25 | nada (13) | **Atenção** |
| 4 | Aprovação **anterior** à liberação | 2026-08-10 | LEANDRO / 2026-08-30 | | | aprovação 10/08 | 35 | nada (35 < 60) | **Crítica** |
| 5 | Mockup obra 1 (aprovação antes da liberação) | 2026-05-28 | LEANDRO / 2026-06-10 | | | aprovação 28/05 | 109 | Crítica | **Crítica** |
| 6 | Mesma data nas duas | 2026-08-10 | LEANDRO / 2026-08-10 | | | aprovação 10/08 | 35 | nada | **Crítica** |
| 7 | **Sem nenhuma data** (só entrada) | null | null / null | 2026-07-01T13:00:00+00:00 | | entrada 01/07 | 75 | nada | **Crítica** |
| 8 | Entrada perto da meia-noite UTC | null | null / null | 2026-08-25T02:00:00+00:00 | | entrada **24/08** (SP) | 21 | nada | **Atenção** (no dia UTC seriam 20: nada) |
| 9 | Sem data nenhuma utilizável | null | null / null | `''` | | nenhuma | null | nada | **nada** |
| 10 | Liberado_em sem liberado_por | null | null / 2026-06-02 | 2026-07-01T13:00Z | | entrada 01/07 | 75 | nada | **Crítica** (a data sem nome é ignorada) |
| 11 | Liberado_por sem liberado_em | null | JUAN / null | 2026-07-01T13:00Z | | entrada 01/07 | 75 | nada | **Crítica** (mockup usaria hoje = 0; ver A4) |
| 12 | **Caso 12** (decisão do João, 15/09): só entrada, liberação registrada hoje | null | JUAN / 2026-09-14 | 2026-07-01T13:00Z | | entrada 01/07 — a liberação de hoje não vence, a entrada é mais antiga | 75 | nada | **Crítica** (permanece em 75; antes da decisão de 15/09 caía para 0 — ver C1, RESOLVIDA) |
| 13 | **Exatamente 20 dias** | 2026-08-25 | null | | | aprovação | 20 | nada | **nada** |
| 14 | 21 dias | 2026-08-24 | null | | | aprovação | 21 | nada | **Atenção** |
| 15 | **Exatamente 30 dias** | 2026-08-15 | null | | | aprovação | 30 | nada | **Atenção** (não crítica) |
| 16 | 31 dias | 2026-08-14 | null | | | aprovação | 31 | nada | **Crítica** |
| 17 | Aguardando definição | null | null | 2026-07-01T13:00Z | etapa `definir` | entrada | 75 | nada | **nada** (definir não pinta nem é crítica) |
| 18 | Pós-campo | 2026-08-01 | null | | etapa `fecharOS`, desde_etapa 2026-09-10 | aprovação | 44 | nada (azul) | **Crítica** |
| 19 | **Faturada pela Manfac** | null | JUAN / 2026-06-02 | | etapa `faturado`, marco_faturou 2026-09-10 | liberação | 104 | encerrada | **encerrada** (sem alerta) |
| 20 | Etapa Faturado **sem** data de faturamento (decisão 12) | null | JUAN / 2026-06-02 | | etapa `faturado`, marco_faturou null | liberação | 104 | encerrada | **Crítica** e continua em "Executadas, ainda na esteira" |
| 21 | Faturamento registrado fora da etapa final | null | JUAN / 2026-06-02 | | etapa `pendFat`, marco_faturou 2026-09-10 | liberação | 104 | nada (`dias` null; etapa não é `faturado`) | **encerrada** |
| 22 | Obra que estoura com poucos dias | 2026-09-01 | null | | duracao 3 | aprovação | 13 | Atenção (13 > 12) | **Atenção** (por `estourou`, que continua) |

Os casos 19 a 21 dependem da decisão 12 (Task 5 do plano). Sem ela, 20 e 21 ficam como na coluna
"Atual" quanto a encerrar.

## 5. Quem consome a regra

| Arquivo:linha | Consome | Efeito da regra nova | Quem mexe |
|---|---|---|---|
| `_lib/tipos.ts:401` `derivar` | calcula `dias` | ganha `ancora` e `diasAlerta`; `dias` fica | este plano (fora de `base/`) |
| `_lib/tipos.ts:440` `critico` | `dias >= 100` | `diasAlerta > 30` | este plano |
| `_lib/tipos.ts:550` `classeDias` | `dias >= 60` | `diasAlerta > 20` | este plano |
| `_lib/tipos.ts:361` `encerrada` | etapa | `marco_faturou` (decisão 12) | este plano, Task 5 |
| `_lib/tipos.ts:471, 489, 522` | `encerrada` | herdam a decisão 12 | este plano, Task 5 |
| `_ui/primitivos.tsx:88` `PillSev` | token de `sev` | pinta mais vermelho | não precisa mudar |
| `base/_etiquetas.tsx:83-93` `BadgeDias` | `classeDias` e `obra.dias`, "dias desde a aprovação" | passa a mostrar `diasAlerta` e a âncora | este plano |
| `base/_regras.ts:234, 242` `COLS`, `ORDEM_PADRAO` | `dias` | ordenam por `diasAlerta` | este plano |
| `base/_regras.ts:180, 305, 308` | `encerrada` | filtro "esteira", KPIs esteira e sem OS herdam a decisão 12 | este plano, Task 5 |
| `base/_regras.ts:297` KPI "aprovadas há mais de 60 dias" | `dias >= 60` | **não muda** (A3) | ninguém |
| `base/_regras.ts:301` KPI "a mais antiga há N dias" (definir) | `dias` | **não muda**; obra do Field em definir segue "há 0 dias" (A3) | ninguém |
| `base/_table.tsx:88, 151` | `critico` (destaque da linha) | mais linhas destacadas | não precisa mudar |
| `base/_table.tsx:100, 202` | `BadgeDias` | herda | não precisa mudar |
| `base/_table.tsx:59` | `encerrada` | herda a decisão 12 | não precisa mudar |
| `base/_kanban.tsx:38, 45, 62, 75` | `critico`, `sev`, `encerrada`, `BadgeDias` | herdam | não precisa mudar |
| `base/_kanban.tsx:110-111` | ordena por `paradaEtapa ?? dias` | **não muda** | ninguém |
| `diario/_cartao.tsx:80, 82, 162` | `encerrada`, `critico` (nota de alerta), `sev` | mais cartões vermelhos | não precisa mudar |
| `diario/_cartao.tsx:228` | `obra.dias` + "dias desde a aprovação" | texto continua verdadeiro, mas **a cor vermelha vem de outra contagem** (A8) | fora de `base/`, não está no plano |
| `diario/_cartoes.tsx:64` | ordena por `dias` | **muda** (review I3, 15/09): passa a ordenar por `diasAlerta`, a mesma medida que `_cartao.tsx:228` já mostrava desde `02defb4` — senão a fila aparecia fora da ordem do que a tela exibia | corrigido nesta rodada |
| `obra/[id]/_ficha.tsx:249-334` `CaixaAlerta`/`temAlerta` | `critico` + `obra.dias` | **bug visível**: com `critico` verdadeiro e `aprovacao` nula, `:289` mostra número vazio, `:298` escreve "contados  dias desde a aprovação" e `:300` "0 vezes" | **ARQUIVO EM PARALELO**, sinalizar à outra frente |
| `obra/[id]/_ficha.tsx:378, 433` | `BadgeDias`, `encerrada` | herdam | paralelo, sem edição necessária |
| `obra/[id]/_triagem.tsx:136` | `BadgeDias` | herda o selo novo sem edição | paralelo, sem edição necessária |
| `obra/[id]/_triagem.tsx:147` | "esperando há `obra.dias` dias" | **não muda**; obra do Field sem aprovação segue "há 0 dias" (erro pré-existente) | paralelo |
| `obra/[id]/_actions.ts` | grava `aprovacao`, `liberado_*` | nada. Mas **precisa passar a gravar `marco_faturou`** para a decisão 12 funcionar | paralelo |
| `tarefas/*`, `sincronizar/*` | não consomem `critico`, `classeDias`, `encerrada` nem `dias` (verificado por grep) | nenhum | ninguém |

## 6. O que NÃO entra

- **SLAs da seção F** (`feedback-14:38-41`): SLA 1, dias desde a liberação sem OS aprovada, e
  SLA 2, dias desde o fechamento da OS. `diasSemOS` (`tipos.ts:498-504`) não muda.
- **Cancelamento de obra** (feedback 11).
- `estourou()` e o limiar de 120 dias: continuam contando de `aprovacao`.
- O token `atencao` de `sev` (paralisado, travado, estourou, atraso) não ganha a condição "> 20
  dias" (A2).
- KPIs de `kpisDaBase`, exceto o que herda `encerrada` pela decisão 12.
- Gravar a data de faturamento, o botão do passo Faturado e o nome das etapas (decisão de 15/09):
  são da frente da esteira (`_actions.ts`, `_ficha.tsx`).
- Qualquer migration. `marco_faturou` já existe.
- Textos de `_ficha.tsx`, `_triagem.tsx` e `diario/_cartao.tsx`.

## 7. Ambiguidades e contradições (não resolvidas aqui)

| # | Ponto | Por que é aberto | O que o plano faz provisoriamente |
|---|---|---|---|
| A1 | "a que for menor" | Pode ser "a menor data" (a mais antiga, maior contagem) ou "o menor número de dias" (a data mais recente). A decisão 5 revista escolheu a mais antiga | Segue a decisão 5 revista |
| A2 | "Sinalização de atenção" é só a cor do contador (`classeDias`) ou também a borda e o card (`sev = 'atencao'`)? | No código são duas "atenções" diferentes. O mockup só pinta o selo | Só `classeDias`. A borda do card de uma obra com 25 dias segue verde, com o selo âmbar |
| A3 | A contagem nova substitui `dias` em tudo (estourou, KPI 60 dias, ordenação do diário, "a mais antiga há N dias")? | O cliente falou de atenção e crítica; a revisão notou que a âncora também afetaria `estourou` | Derivado novo `diasAlerta`; `dias` fica |
| A4 | `liberado_por` preenchido sem `liberado_em` | O mockup conta de **hoje** (`:347`), o que zera a contagem, exatamente o que a decisão 5 revista proíbe | Trata como sem data de liberação e cai para aprovação ou entrada |
| A5 | Rótulo da coluna da tabela | "Dias desde a aprovação" fica falso; o mockup não desenhou a tabela | "Dias em aberto" (provisório; texto que já existe em `_ficha.tsx:290`) |
| A6 | Decisão 12: `encerrada()` global ou só os alertas? | "sai dos alertas de obra parada" pode ser só crítica/encalhada/cor (12-B), ou a obra continuar em aberto em filtro e KPIs também (12-A, a recomendação da revisão que originou a decisão) | Plano escrito para 12-A, com as substituições de 12-B listadas. Task bloqueada até a escolha |
| A7 | Obra em etapa `faturado` sem data | Com 12-A, nunca encerra enquanto ninguém gravar `marco_faturou` | A Task 5 só pode ser mergeada depois de a frente da esteira gravar a data |
| A8 | Cartão do diário | Vermelho por `diasAlerta`, texto "N dias desde a aprovação" por `dias` | Fica fora; `diario/` não está no perímetro |
| A9 | Crítica em `definir` | O cliente não excluiu; o código e o mockup excluem | Mantém a exclusão |
| A10 | Data futura (erro de digitação) | Contagem negativa | Não trata (igual a hoje) |
| C1 | ~~Contradição decisão × regra~~ **RESOLVIDA em 15/09/2026, decisão do João** (repassada pelo coordenador, não interpretação do implementador): a decisão 5 revista dizia "registrar uma data nova **nunca** derruba a contagem", mas a regra original ("sem nenhuma das duas, da entrada") derrubava no caso 12 (75 → 0). A revisão (`:78-81`) e o mockup (`:277`) chamaram isso de "resíduo para julgar"; o João decidiu a favor da decisão 5 revista: a entrada vira candidata sempre (§3.1), e o caso 12 passa a **permanecer em 75**. Vale para obras cujas datas já existiam, não só para data registrada depois — por isso o caso 1 também mudou, de 104 para 108 (§4) | Ver §3.1 (regra da âncora) e §4, casos 1, 2 e 12 |
| C2 | **Perímetro × código:** a instrução restringe o código a `app/obras/base/` e testes, mas a regra vive em `app/obras/_lib/tipos.ts` (`critico`, `classeDias`, `derivar`, `encerrada`). `_regras.ts:7-8` diz explicitamente que essas regras "NÃO são reescritas aqui". Pôr a regra em `base/` criaria import circular (`tipos` ← `base/_regras` ← `tipos`) ou duplicaria a regra, e `diario/_cartao.tsx` e `_ficha.tsx` importam `critico` de `tipos` | O plano edita `tipos.ts` e marca as tasks como **fora do perímetro, exigem OK do coordenador**. `tipos.ts` também guarda o nome das etapas (`:152`), que a decisão de 15/09 manda trocar: risco de conflito com outra frente |
| C3 | O comentário `tipos.ts:432-436` ("vermelho reservado a uma coisa só... quando tudo é vermelho, nada é") | Com crítica em 31 dias, a maior parte das obras abertas tende a ficar vermelha. É o produto pedido pelo cliente, mas contradiz a decisão de leitura registrada no código | Atualiza o comentário; não muda a regra |

## 8. Não verificado

- Se a API do Field traz a data de abertura da OS. "Entrada" aqui é `created_at`, a hora da sincronização.
- O formato exato que o `supabase-js` devolve em `created_at` em produção (o banco tem 0 obras). A
  spec aceita qualquer string que o `Date` do JavaScript entenda (`…Z`, `…+00:00`, com
  microssegundos).
- Se algum código de outra frente, ainda não commitado, já grava `marco_faturou`. O `git status` só
  mostra `scripts/` não rastreado.

## 9. Pendências para a J4 (`obra/[id]/_triagem.tsx`)

Achados do review independente (`review-regra-critica-2026-09-15.md`, itens I2 e M8). O arquivo
está na lista "Não tocar" desta frente porque a J4 está reescrevendo-o — por isso ficam anotados
aqui em vez de corrigidos, para quem pegar o arquivo não perder o achado.

### I2 — Selo e texto mostram números contraditórios na mesma tela

`_triagem.tsx:136` renderiza `<BadgeDias obra={obra} />`, que desde `2ce3c33` mostra `diasAlerta`
e a âncora (ex.: "75 dias desde a entrada"). Onze linhas abaixo, `_triagem.tsx:147` ainda escreve:

```tsx
esperando há <b>{obra.dias ?? 0} dias</b>
```

`dias` continua sendo só "desde a aprovação" (decisão técnica, spec §3.3/A3) — e a Triagem é
majoritariamente obra vinda do Field, sem `aprovacao` ainda. Resultado: o selo diz "75 dias desde
a entrada" e o parágrafo, onze linhas abaixo, diz "esperando há 0 dias". **Antes desta frente os
dois liam `dias` e diziam 0 — errado, mas coerente.** Trocar só o selo (o que esta frente fez, e
que era o que estava autorizado) transformou um erro escondido numa contradição visível na tela
que o cliente usa para triar obra nova.

**O que precisa mudar:** trocar `obra.dias` por `obra.diasAlerta` em `_triagem.tsx:147`, no mesmo
espírito da correção já feita em `_ficha.tsx`/`diario/_cartao.tsx` (`02defb4`) — número junto,
texto que não afirme uma data que não existe.

### M8 — A Triagem afirma que a obra entrou pelo Field na data de aprovação

`_triagem.tsx:146`: `"Ela entrou pelo Field em {br(obra.aprovacao)}"`. Erro pré-existente, já
registrado na conciliação de 14/09 (`j4-conciliacao-2026-09-14.md`): a OS chega do Field sem data
de aprovação; a frase deveria usar a data de entrada, não a de aprovação.

**O que esta frente criou que resolve isso:** `obra.ancora` — quando `ancora.de === 'entrada'`,
`ancora.data` é exatamente a data que a frase precisa. Trocar `br(obra.aprovacao)` por
`obra.ancora?.de === 'entrada' ? br(obra.ancora.data) : br(obra.aprovacao)` (ou equivalente)
resolve os dois achados (I2 e M8) com o mesmo dado.
