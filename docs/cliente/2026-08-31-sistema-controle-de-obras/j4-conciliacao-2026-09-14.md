# J4 — Completar a obra: conciliação entre decisões e código

Levantamento feito em 14/09/2026, só leitura: código em `master` (HEAD `4a6cafe`) e os documentos
de `docs/cliente/2026-08-31-sistema-controle-de-obras/`. Toda referência `arquivo:linha` foi
lida nesta sessão. Onde algo não foi verificado, está dito.

Abreviações: `D/` = `docs/cliente/2026-08-31-sistema-controle-de-obras/`;
`obra/` = `app/obras/obra/[id]/`.

---

## 1. Inventário de campos a completar

### Fatos que valem para as três tabelas

- **O Field grava só isto na criação:** `os`, `loja`, `descricao`, `fonte='field'`, `field_id`,
  `etapa='definir'` (`app/obras/sincronizar/_sincronizacao.ts:295-302`).
- **Em obra que já existe, o Field só preenche o que está vazio:** `loja`, `descricao`,
  `fonte`, `field_id` (`_sincronizacao.ts:307-316`), com `vazio()` tratando `''` como vazio
  (`:105-108`). Texto da tela: *"Field preenche campo vazio; campo que alguém digitou aqui fica
  como está [...] A etapa e a triagem nunca são tocadas"* (`sincronizar/page.tsx:60-61`).
- **Todas as outras colunas chegam nulas.** O único outro escritor, o importador da planilha
  (`_lib/importacao.ts`), está sem uso por decisão de 10/09 (`D/ESTADO.md:96-106`).
- **Colunas:** `sdd-sql-obras-v0.sql:60-135`, mais `fonte`
  (`sdd-sql-obras-fonte.sql:18-19`) e `field_id`/`field_ausente_*`
  (`sdd-sql-obras-field-reconciliacao.sql:6-9`). Tipo TS em `_lib/tipos.ts:216-270`.
- **Quem pode escrever:** a RLS de `obras_obra` é uma policy única, `for all`, guardada por
  `obras_has_access()` (`sdd-sql-obras-v0.sql:346-349`). Não há restrição por coluna, obra ou
  nível.

### 1.A — Campos da Triagem (entrada, `etapa = 'definir'`) — **7 campos**

Hoje eles só são graváveis enquanto a obra está em `definir`: a página desvia para a Triagem em
`page.tsx:103`, e o update filtra `.eq('etapa','definir')` em `_actions.ts:161`. Depois disso,
nenhum deles é editável em lugar nenhum.

| Coluna | Tipo | Rótulo na tela / do cliente | Escrito hoje | Lido hoje | Quem preenche (decisão registrada) | Momento | Efeito em crítica / esteira / kanban |
|---|---|---|---|---|---|---|---|
| `pcm` | text | "Responsável da obra" (`_triagem.tsx:37`, `_ficha.tsx:559`); o cliente escreve "Responsavel da obra" (`D/feedback-02...txt`, item 04) | `_actions.ts:144` (obrigatório) | `tipos.ts:386` (`donoDa`), `_ficha.tsx:196-199` (dono na esteira), `diario/page.tsx:63` (filtro da fila), `base/_regras.ts:173-176,226` | **Qualquer um.** `D/feedback-12:13-14`: *"nesse primeiro momento a gente pode deixar pra qualquer um cadastrar"*. Isso supera a Decisão D (`D/decisoes-A-B-C-D:11-12`: *"no primeiro momento o analista (yuri)"*) | Triagem. Pode trocar depois (sem tela hoje) | Define **de quem é o diário**. Obra sem `pcm` não entra na fila de ninguém que não seja admin (`D/inventario-campos-obra.md:102`). Dono na esteira. Filtro da base |
| `equipe` | text | "Equipe / prestador" | `_actions.ts:145` (obrigatório) | `_ficha.tsx:146,562`; `tipos.ts:614-622` (`chaveDaEquipe` → tarefa de foto) | Qualquer um (feedback 12) | Triagem | Destino da tarefa "Foto" (`tipos.ts:602`) |
| `prioridade` | text, check `Normal\|Urgente` (`sql:91`) | "Prioridade" | `_actions.ts:146` (obrigatório, enum em `:135`) | `EtiquetaPrioridade`, `_regras.ts:229` | Qualquer um | Triagem | Só etiqueta e coluna. Não afeta crítica |
| `inicio_plan` | date | "Data de início" na Triagem (`_triagem.tsx:40`), "Início planejado" na ficha (`_ficha.tsx:585`) | `_actions.ts:147` (obrigatório) | `tipos.ts:402-404` (`fimCalc`, `atraso`, `diaDe`), `:503` (`diasSemOS`), `_ficha.tsx:319` | Qualquer um | Triagem. **Mudar depois = remarcação**: a ficha promete que o final *"se recalcula sozinho a cada remarcação"* (`_ficha.tsx:593-596`), mas `obras_remarcacao` é "Só leitura na v0" (`tipos.ts:314`) e nada grava nela | `atraso > 0` vira `sev = 'atencao'` (`tipos.ts:531`). Caixa âmbar "Passou da duração" (`_ficha.tsx:309-326`) |
| `duracao` | int | "Duração em dias" | `_actions.ts:148` (1–180, `:136`) | `tipos.ts:403,408-415,448` (`estourou`), `_ficha.tsx:285,587` | Qualquer um | Triagem | `estourou()` → âmbar. A caixa vermelha de crítico exige `duracao` (`_ficha.tsx:285`) |
| `liberado_por` | text | "Liberado por" (`_triagem.tsx:316`); cliente: *"OS liberada por (nome do analista + data da liberação)"* (`D/feedback-12:35-36`) | `_actions.ts:151` (opcional) | `tipos.ts:485-491` (`liberada`, `semCobertura`), `_etiquetas.tsx:64-68`, `_ficha.tsx:224-235,483-491,518-525`, `_regras.ts:189-190,310` | Qualquer um. O **conteúdo** é o analista do cliente: *"a gente bota por exemplo liberado por Amanda liberado por Leandro"* (`D/feedback-05-liberado-por...md:16`) | Hoje só na Triagem. O cliente fala de liberação **por telefone, antes da obra**, e às vezes a obra começa sem triagem (`D/feedback-12:29-33`). Precisa ser editável em qualquer etapa (`D/feedback-12:121`) | **Sim.** `semCobertura` → `sev = 'semCobertura'`, vermelho igual a crítico (`tipos.ts:527`). KPI "sem cobertura" (`_regras.ts:310`). Texto da cobrança na esteira |
| `liberado_em` | date | "Data da liberação", com a dica *"é outra data, não a da aprovação da OS"* (`_triagem.tsx:337-339`) | `_actions.ts:152`: só grava junto com `liberado_por`; sem data, usa hoje | `tipos.ts:503` (`diasSemOS`), `_ficha.tsx:228,486` | Idem. Cliente: *"a data de aprovação da os é uma e a data de liberação é outra"* (`feedback-05-liberado-por...:20`) | Idem | Conta "há N dias sem OS". A defasagem `aprovacao − liberado_em` é *"um indicador que a gente sempre cobra o cliente"* (`D/feedback-12:43-44`) |

### 1.B — Campos sem tela hoje, editáveis a qualquer momento — **6 campos**

Mais os 7 da seção 1.A, que também precisam ser reeditáveis depois de `definir`.

Ninguém escreve estes seis. Todos aparecem somente leitura no bloco "O que veio do Field"
(`_triagem.tsx:161-178`) e em "Identificação" (`_ficha.tsx:536-578`). A lista mínima de
`D/feedback-12:118` é *"Os cinco campos que o Field não traz: tipo, valor, origem,
analista_cliente, aprovacao"*. O `mau_uso` entra por ser classificação da Decisão J, que perdeu
seu único escritor (o importador).

| Coluna | Tipo | Rótulo | Lido hoje | Quem preenche | Momento | Efeito |
|---|---|---|---|---|---|---|
| `tipo` | text livre | "Tipo" (ficha); "Tipo de serviço" (`D/pergunta-04` HTML) | `_ficha.tsx:369,544`, `_triagem.tsx:131,167`, `_regras.ts:225` | Qualquer um (feedback 12) | Entrada ou depois. Os valores da planilha são ofícios, como SERRALHERIA (`D/feedback-05-leitura:84-85`) | Nenhum na crítica |
| `valor` | numeric | "Valor"; na Triagem vazio aparece como *"ainda sem orçamento"* (`_triagem.tsx:168-174`) | `_ficha.tsx:272-278,396-400,557` | Qualquer um | **Chega depois**: o próprio texto admite que a obra nasce sem orçamento | Só aparece no texto dos alertas ("São R$ X...") |
| `origem` | text livre | "Origem" | `_ficha.tsx:563`, `_triagem.tsx:176` | Qualquer um | Entrada | Nenhum. É vocabulário do cliente, como "Sistema DPSP" (`D/divisao-trabalho:91-93`) |
| `analista_cliente` | text | "Analista"; na planilha, "ANALISTA — o analista do cliente dono da OS" (`D/feedback-05-leitura:21`) | `_ficha.tsx:558`, `_triagem.tsx:175`, `diario/_cartao.tsx:212`, `tipos.ts:387` (`donoDa` em `definir`), `page.tsx:104-108` (lista do "Liberado por") | Qualquer um | Entrada | "Com quem está" na etapa `definir` (ver contradição 7) |
| `aprovacao` | date | "Aprovada em" (Triagem), "OS aprovada em" (pergunta 04), coluna "Dias desde a aprovação" (`_regras.ts:234`), badge "dias desde a aprovação" (`_etiquetas.tsx:90`) | `tipos.ts:401` (`dias`) → `critico` `:441`, `classeDias` `:553`, `estourou` `:447-448`; `_regras.ts:242` (ordem padrão), `:297` (KPI 60 dias); `tipos.ts:503`; `_ficha.tsx:170,294,494`; `_triagem.tsx:146,177` | Qualquer um | Cliente: a aprovação *"às vezes [...] aconteceu tipo três meses depois do que a gente tinha já feito tudo"* (`D/feedback-12:41-44`). **Não pode ser obrigatória na entrada** | **Dispara a crítica.** Nula → `dias = null` → a obra nunca é crítica e afunda na ordem padrão (`D/inventario-campos-obra.md:101`) |
| `mau_uso` | boolean, default false | "Classificação" → etiqueta "Mau uso" | `_ficha.tsx:545-553`, `_regras.ts:192-193` | Decisão J (`D/feedback-05-leitura:92-94`): *"um campo de classificação, separado da etapa"*. Quem marca não foi decidido; vale o "qualquer um" do feedback 12 | Qualquer momento | Etiqueta e filtro. Não afeta crítica nem esteira |

Campos que ficam **fora** do grupo editável, com o motivo:

| Coluna(s) | Por quê |
|---|---|
| `os`, `loja`, `descricao` | Vêm do Field. Editar aqui divergiria para sempre, sem aviso, porque a sincronização só preenche vazio (ver decisão 9) |
| `bloqueio`, `nao_andou_seguidos`, `bloqueada_dias` | Recalculados pelo diário (`tipos.ts:664-723`) |
| `etapa`, `desde_etapa`, `etapa_por`, `etapa_em` | Pertencem ao seletor de etapa (`_actions.ts:59-93`) |
| `pendencia`, `pend_resp`, `pend_prazo`, `prox_acao` | Sugestão: fora da J4 (ver seção 5, padrões assumidos). Hoje recebem texto fixo na liberação (`_actions.ts:156-158`) e nunca mais mudam; `pend_prazo` não é escrito por nada |
| `criado_por` | Nunca escrito. A sincronização não tem usuário; não é campo de tela |

### 1.C — Marcos (datas de evento) — **7 campos**, mais 2 datas de evento fora da lista

**Ninguém escreve nenhum dos sete.** Confirmado por grep em `app/obras` excluindo testes: só há
leituras. O mapa etapa → marco está em `_ficha.tsx:58-64`. Na esteira, o marco de um passo é o
evento que **encerra** esse passo: com data, o passo aparece `feito`; sem data, `atual` se a obra
está nele, senão `futuro` (`_ficha.tsx:177-187`).

| Coluna | Tipo | Evento, nas palavras do cliente | Lido hoje | Quem é o dono (decisão) | Efeito |
|---|---|---|---|---|---|
| `os_aprovada` | **boolean** (não é data) | "OS aprovada": *"aprovação formal, no sistema do cliente"* (`D/feedback-12:65`); *"as obras podem iniciar com ou sem OS Aprovada"* (feedback 02, item 05) | `tipos.ts:490,502`; `_ficha.tsx:163,406,442,493,506`; `_triagem.tsx:299`; `_kanban.tsx:76`; `_etiquetas.tsx:49-68`; `_regras.ts:187-189,232,308` | Processo da DPSP. Quem **registra** no sistema: qualquer um (feedback 12) | **Esteira:** decide o desvio. Como é sempre `false`, o desvio *"nunca acontece"* (`D/feedback-12:103-107`). **Sev:** entra em `semCobertura` (vermelho). **Kanban:** etiqueta. **KPI** "sem OS aprovada". Filtro |
| `marco_exec_fim` | date | *"Equipe finaliza a obra em campo"* (feedback 02, item 04) | `_ficha.tsx:139,149,266` | Equipe em campo | Passo zero da esteira. A caixa pós-campo escreve *"Obra entregue em {data}"*; sem data, sai "—" |
| `marco_relatorio` | date | *"Equipe ou o Responsavel preenche o relatorio no field [...] e gera o Relatorio de entrega"* (feedback 02). Decisão K: *"eu sei que OS foi fechado no Field [...] tem um relatório"* (`feedback-05-liberado-por:40`) | via `MARCO_DE` (`_ficha.tsx:59`) | **Deduzido do Field** pela Decisão K, com saída manual prevista: *"se a API não trouxer, alguém marca à mão"* (`D/feedback-05-leitura:128-131`, texto nosso, não do cliente) | Esteira. Hoje nada lê o fechamento no Field (contradição 4) |
| `marco_os_aprov` | date | Data da aprovação formal da OS. Encerra "Pendente fechamento" | `_ficha.tsx:60,170,494` (`marco_os_aprov ?? aprovacao`) | Cliente DPSP (`tipos.ts:152`) | Esteira. Tem sobreposição com `aprovacao` e `os_aprovada` (contradição 6) |
| `marco_fechou_os` | date | *"Responsavel da obra precisa pegar o relatorio, anexar no sistema do cliente e encerrar a OS"* (feedback 02) | `_ficha.tsx:61` | Decisão G: *"responsável da obra vai até fechar a OS"* (`D/feedback-05-leitura:65-66`) | Esteira |
| `marco_liberou_fat` | date | *"o cliente precisa liberar o faturamento, entao fica em pendente faturamento"* (feedback 02). O feedback 09 acrescenta *"cliente ainda nao enviou o pedido de compra"* | `_ficha.tsx:62` | Cliente DPSP | Esteira. O significado depende das perguntas abertas do feedback 09 |
| `marco_faturou` | date | *"quando recebemos essa liberação de faturamento, e a obra foi faturada"* (feedback 02) | `_ficha.tsx:63` | Decisão G: *"o financeiro vai no faturado"*. Não existe papel "financeiro" no hub (`lib/auth/roles.ts:3`) nem em `obras_pessoa.area` (`sql:190`) | Esteira |
| *extra:* `inicio_real` | date | Início real em campo | `tipos.ts:402` (tem precedência sobre `inicio_plan` em `fimCalc`/`atraso`), `:503`, `_ficha.tsx:319,586` | Não decidido | Afeta prazo e atraso. Nunca escrito |
| *extra:* `fim_real` | date | Fim real | **Não é lido por tela nenhuma** (grep: só `importacao.ts:393,441,538,580` e `tipos.ts:249`) | — | Nenhum. Duplica `marco_exec_fim` (contradição 8) |

---

## 2. O que o código atual já faz e deve ser preservado

| # | Comportamento | Onde |
|---|---|---|
| 1 | Receita fixa das Server Actions: `createClient` → `getUser` → `hasSystemAccess('obras')` → query → `revalidatePath` → `{error?}/{success?}`. **Nunca `throw`**; o erro vira mensagem em português | `obra/_actions.ts:6-13,59-66,114-124` |
| 2 | `null` é o único vazio; nunca se grava `""`. **Isso ficou crítico com a sincronização:** `""` gravado por engano seria tratado como vazio e sobrescrito pelo Field | `_actions.ts:27-31`; `_sincronizacao.ts:105-108` |
| 3 | Os 5 obrigatórios são revalidados no servidor, com prioridade no enum e duração entre 1 e 180; no cliente, `min`/`max` | `_actions.ts:126-136`; `_triagem.tsx:272-280` |
| 4 | Liberação **opcional por projeto**: *"obrigar o campo faria alguém inventar um nome"*. `liberado_por` e `liberado_em` andam juntos | `_triagem.tsx:11-13`; `_actions.ts:108-113,149-152` |
| 5 | Guarda de concorrência: `.eq('etapa','definir').select('id')`; zero linhas afetadas vira *"Esta obra já foi liberada por outra pessoa. Recarregue a página."* | `_actions.ts:160-171` |
| 6 | Efeitos da liberação: `etapa='levantamento'`, `desde_etapa`, `atualizacao`, pendência e próxima ação, revalidação de ficha, base e diário, depois redireciona para a base | `_actions.ts:153-158,173-176`; `_triagem.tsx:121` |
| 7 | Troca de etapa: valida a etapa, zera `desde_etapa` (o contador "parada há N dias") e grava autoria em `etapa_por`/`etapa_em`, com fallback se a coluna não existir | `_actions.ts:44-93` |
| 8 | A troca de etapa confirma em dois passos, para não mudar *"por esbarrão no select do celular"* | `_etapa.tsx:11-14,33,68-76` |
| 9 | Checklist visual `CampoTri` (círculo numerado que vira ✓ verde), contador "N de 5 preenchidos", botão desabilitado com a frase de quantos faltam | `_triagem.tsx:45-49,54-86,113-114,153-155,284-291` |
| 10 | Listas de apoio: um piso fixo unido ao que existe no banco, ignorando `DEFINIR`, para a lista não nascer vazia | `page.tsx:32-64,104-121` |
| 11 | Ficha em Server Component com **ordem de blocos aprovada** (*"não se reabre"*), uma caixa de alerta só, esteira com desvio, autorização em quatro estados | `_ficha.tsx:5-9,245-337,138-242,479-534` |
| 12 | Derivados (`dias`, `fimCalc`, `atraso`, `paradaEtapa`, `dono`) nunca são gravados | `tipos.ts:14-19,400-427` |
| 13 | A sincronização preserva o que alguém digitou e nunca toca etapa nem triagem | `_sincronizacao.ts:313-316`; `sincronizar/page.tsx:60-61` |
| 14 | Fotos por signed URL de 60 s, fora do escopo da J4 | `page.tsx:126-140` |
| 15 | Estados de tela existentes: texto no gerúndio com botão desabilitado, linha vermelha `#ff4d6d` sob o botão, `EstadoVazio` para sem permissão | `D/inventario-campos-obra.md:207-215` |

**Linguagem visual a reutilizar** (do mockup v05 e do código):

- Tokens em `_ui/primitivos.tsx:17-24`: fundo `#0a1628`, navy `#0d2050`, laranja `#f05a28`,
  bordas `#1e3a5f`, crítico `#ff4d6d`, atenção `#f4b73f`, ok `#35c98a`, info `#5aa9f0`.
- Componentes: `Box`/`BoxH`/`BoxB`, `Campo`/`Campos`, `Pill`, `Botao` principal e secundário,
  `EstadoVazio`, `Placeholder`.
- A classe de input `INPUT` (`_triagem.tsx:51-52`) e o `CampoTri` são o único padrão de
  formulário aprovado.
- No mockup: `.triagem-aviso`, `.campo .rot .mk`, `.dica`, `.liberar .hint`, `.box`/`.dl`, e o
  bloco `.decisao` com `fbPor()` embaixo de cada seção (`mockup-01-v05:291-300,2252-2337`).

---

## 3. Contradições

| # | Contradição | Evidência |
|---|---|---|
| 1 | **A Triagem diz que a obra "entrou pelo Field em {aprovacao}".** `aprovacao` é a data de aprovação da OS, não de entrada. Em obra do Field ela é nula, então a tela diz "entrou pelo Field em — e está esperando há **0** dias" (`obra.dias ?? 0`). A data real de entrada, `created_at`, não é lida | `_triagem.tsx:146-147`; `mockup-01-v05:2262`; `D/feedback-12:41` |
| 2 | **O bloco "O que veio do Field" lista Tipo, Valor, Analista, Origem e Aprovada em.** O Field traz 3 campos: *"Numero da OS, Localização da Loja, Descrição do chamado, Todo o restante [...] manualmente"*. E o aviso *"O Field não manda responsável, equipe, prioridade nem cronograma"* omite esses 5 | `_triagem.tsx:161-178,191-192`; `D/feedback-07:12-13` |
| 3 | **"Definir a obra que chega é tarefa do analista de obras"** (Decisão D, Yuri) contra *"qualquer um cadastrar"* | `_triagem.tsx:148`; `mockup-01-v05:2325-2327`; `D/feedback-12:13-14` |
| 4 | **"Ninguém marca esta etapa à mão. O sistema lê o fechamento da OS no Field Control."** Nada lê status do Field: o cliente da API normaliza só `os`/`loja`/`descricao` (`_lib/field/cliente.ts:239-240`) e `marco_relatorio` nunca é gravado. **Não verificado** que a API exponha o fechamento: `api-field-control-levantamento.md` não traz status nem relatório, e a J3 não testou isso | `_ficha.tsx:213-220`; `tipos.ts:151` ("deduzido do Field") |
| 5 | **Nome da etapa `aprovarOS`:** "Pendente fechamento" no código (Decisão K), *"Pendente aprovação da OS"* no feedback 09, *"cobrar aprovação do cliente"* no feedback 02. As 4 perguntas do feedback 09 (inclusive o pedido de compra) **não têm resposta registrada**: grep por "pedido de compra" em `docs/` só acha o próprio feedback 09 | `tipos.ts:152`; `D/feedback-09:10-13,58-65` |
| 6 | **Três representações da mesma aprovação:** `os_aprovada` (bool), `aprovacao` (date) e `marco_os_aprov` (date). A ficha mistura `marco_os_aprov ?? aprovacao`. A leitura do feedback 12 pede *"os_aprovada como estado próprio, independente de aprovacao ter data"*, mas isso é **interpretação nossa**, não fala do cliente | `_ficha.tsx:170,494`; `D/feedback-12:120` |
| 7 | **`critico()` conta dias a partir de `aprovacao`.** O cliente diz que a aprovação pode sair meses depois da obra pronta, e toda OS do Field nasce sem ela. Resultado: obra emergencial liberada sem OS nunca vira crítica, e o KPI mostra "a mais antiga há 0 dias". O `tipos.ts:11-12` diz que mudar limiares "é mudar o produto aprovado" | `tipos.ts:401,441`; `_regras.ts:300-317`; `D/feedback-12:41-44` |
| 8 | **`fim_real` e `marco_exec_fim` descrevem o mesmo evento.** `fim_real` não é lido por tela nenhuma. `inicio_real` é lido e nunca escrito | grep em `app/obras`; `tipos.ts:402` |
| 9 | **"Com quem está" em `definir` diz "Analista {analista_cliente}".** Esse é o analista da **DPSP**, mas definir a obra é tarefa da **Manfac**. Em obra do Field sai "Analista " com o nome vazio | `tipos.ts:147,387` |
| 10 | **Comentários desatualizados:** `_actions.ts:33-43` diz que `etapa_por`/`etapa_em` "ainda não existem"; eles existem (`sql:128-135`, aplicada). `_actions.ts:55-58` e `spec-v0-treinamento.md:57` dizem "Decisão G, aberta"; ela foi fechada em 03/09 | `D/feedback-05-leitura:63-68` |
| 11 | **"Fica registrado quem mudou e quando"** está gravado, mas não aparece em tela nenhuma | `_etapa.tsx:75`; `D/inventario-campos-obra.md:74-75` |
| 12 | **"Textos reproduzidos do mockup aprovado — não reescrever"**, e os textos das contradições 1 a 4 estão errados para obra do Field. A rodada do mockup J4 precisa **reaprovar** esses textos de forma explícita | `_triagem.tsx:15`; `D/feedback-06-leitura:12-14` |
| 13 | **Pendência fixa "Finalizar levantamento, confirmar material e programar a equipe"** continua na ficha quando a obra já está em Fechar OS | `_actions.ts:156-158`; `_ficha.tsx:768-779` |
| 14 | **O `ESTADO.md` está velho em três pontos:** (a) "Perguntas em aberto COM O CLIENTE" ainda lista a pergunta 03, que o João encerrou; (b) a pendência "Campo de liberação na Triagem" já está construída; (c) o cabeçalho diz "Atualizado em 11/09" com um bloco de 14/09 logo abaixo | `D/ESTADO.md:3,448-455,467`; `D/feedback-12:84-89,129-151` |
| 15 | **O piso de responsáveis é `YURI`/`AMANDA`/`LUANA`.** O `ESTADO.md` registra `GABRIEL` e `EDUARDO` na planilha, e que `ROBERTA` não existe nela | `page.tsx:42`; `D/ESTADO.md:155-159` |

---

## 4. Papéis

### O que o código distingue hoje

| Papel | Como se define | O que libera no módulo |
|---|---|---|
| **Admin do hub** | `hub_user_roles.nivel = 'administrador'` (`lib/auth/roles.ts:29-35`) | Tudo o que o slug libera, porque `hasSystemAccess` devolve `true` para admin (`lib/auth/systemAccess.ts:10`) e a RLS faz o mesmo (`sql:317-332`). **Exclusivo do admin:** `/obras/importar` (`importar/page.tsx:16`) e `/obras/sincronizar` (`sincronizar/page.tsx:19`, `_actions.ts:79`). No diário, vê a fila de todos e escolhe a de quem (`diario/page.tsx:47,60`) |
| **Quem tem o slug `obras`** | Linha em `hub_system_access` | Base, Ficha, Triagem, liberar e mudar etapa (`obra/page.tsx:73`, `_actions.ts:66,124`). **Não há diferença entre analista e admin em nada que a J4 toca** |
| **PCM dono da obra** | `obras_obra.pcm` casado com o e-mail via `resolverChave` / `obras_pessoa.email` (`diario/page.tsx:51-63`) | Não é permissão, é **filtro do diário**. Ficha e Triagem não conferem dono: qualquer pessoa com o slug edita qualquer obra |

Toda trava por papel que se quiser na J4 teria de viver em Server Action **e** em RLS ou trigger.
A policy atual deixa qualquer pessoa com o slug escrever qualquer coluna direto do navegador, o
mesmo tipo de brecha fechado em `hub_system_access` em 10/08 (AGENTS.md).

### O que as decisões dizem

- **Cadastro e complemento: qualquer um, sem papel exclusivo, com autoria.** O cliente
  (`D/feedback-12:13-19`): *"a gente pode deixar pra qualquer um cadastrar. Até pra gente não
  travar o processo [...] se esse cara sair depois pra gente mudar essa pessoa que cadastra, pode
  ser meio caótico"*. A leitura registrada (`:51-52`): *"Basta que a tela exista e que quem
  preencheu fique registrado (autoria, não permissão)"*.
- **Dono das etapas finais é quem é cobrado, não quem pode clicar.** Decisão G: *"responsável da
  obra vai até fechar a OS, o financeiro vai no faturado"*. A decisão técnica 1 da spec
  (`spec-v0-treinamento.md:57`) diz *"Qualquer usuário com acesso muda a etapa; sem trava por
  papel"*.
- **A Decisão D (Yuri define) foi superada** pelo feedback 12, no que diz respeito ao cadastro.
- **Conclusão: "quem pode editar cada grupo" já está respondido.** Todos os grupos ficam abertos
  a quem tem o slug `obras`, e o que muda por grupo é só o **dono esperado**, exibido como dica.
  Quem cancela obra (`D/feedback-11:71`) é pergunta em aberto, mas pertence ao cancelamento, não
  à J4.

---

## 5. Decisões ainda abertas que moldam o mockup

### Já respondidas — não reabrir

| Pergunta | Resposta |
|---|---|
| Quem edita | Qualquer um com o slug, com autoria (feedback 12) |
| Até quando dá para editar | Sem prazo. O cliente não respondeu essa parte e a leitura registrada é *"Tratar como sem prazo definido — e não inventar um"* (`D/feedback-12:54-55`), com exigência de edição *"em qualquer etapa"* (`:121`) |
| Liberação na Triagem | Opcional (`_triagem.tsx:11-13`) |
| Mau uso | Etiqueta, não etapa (Decisão J) |
| Avanço % | Fora de escopo (João, `D/feedback-12:133`) |
| Cancelamento | Fora da J4 (`divisao-trabalho:123-134`) |

### Abertas

**1. Como se edita na ficha?**
- **A)** Botão "Editar" por bloco (Identificação · Autorização · Cronograma): o bloco vira
  formulário com Salvar/Cancelar. Ordem dos blocos preservada, edição pequena e autoria natural
  por bloco.
- **B)** Clique no valor e edita direto (a opção C da pergunta 04). Menos cliques, mas mistura
  leitura com escrita na tela mais consultada.
- **C)** Um botão "Editar dados da obra" que abre todos os campos numa página ou painel. Simples
  de construir, mas longe do contexto e com formulário grande.
- **Recomendação: A.** A pergunta 04 recomendou um botão porque *"misturar leitura e edição no
  mesmo lugar aumenta a chance de alguém alterar o valor de uma obra sem perceber"*. Fazer por
  bloco mantém a ordem aprovada (`_ficha.tsx:5-9`) e cada salvamento pequeno.

**2. O que a Triagem vira, e o que é obrigatório para liberar?**
- **A)** Mantém os 5 obrigatórios e a liberação. O bloco "O que veio do Field" passa a mostrar
  só os 3 campos de verdade e ganha um bloco **"Dados da obra"** editável e opcional (tipo, valor,
  origem, analista, OS aprovada + data), com botão **"Salvar dados"** independente de "Liberar".
  Depois de `definir`, os mesmos campos seguem editáveis pela decisão 1.
- **B)** Os mesmos 5 obrigatórios mais `aprovacao`/`tipo`/`valor`. Obriga a inventar data, porque
  a aprovação sai meses depois.
- **C)** A Triagem deixa de existir e tudo vira ficha editável com checklist. Perde o "Liberar
  para o diário" aprovado e o contador.
- **Recomendação: A.** É o mesmo raciocínio que já deixou a liberação opcional
  (`_actions.ts:108-113`): obrigar gera dado falso. O "Salvar dados" é necessário porque hoje o
  rascunho vive só no estado do cliente (`_triagem.tsx:100-108`), e quem souber a aprovação antes
  de ter equipe perderia o que digitou.

**3. Marcos: digitados, "marcar agora" ou deduzidos da etapa?**
- **A)** Datas digitadas livremente num bloco "Datas do ciclo". Flexível, mas etapa e marco se
  descolam: com a obra em Fechar OS, o relatório pode aparecer "futuro".
- **B)** Botão "Concluir esta etapa" no passo atual da esteira. Carimba hoje no marco do passo,
  avança a etapa (respeitando o desvio de `os_aprovada`) e confirma em dois passos. A data fica
  corrigível depois.
- **C)** Dedução automática pelo seletor livre atual. Pular etapas carimbaria datas de passos que
  não aconteceram naquele dia.
- **Recomendação: B.** Uma ação só grava o evento e move a obra, então esteira e etapa não se
  contradizem. Mantém o seletor livre para exceções, **sem carimbar** passos pulados, que ficam
  "sem data registrada". Não apaga marco ao voltar de etapa. Enquanto o Field não devolver
  fechamento (contradição 4), o relatório também usa esse botão e o texto da ficha muda para
  dizer isso.

**4. OS aprovada: um controle ou vários?**
- **A)** Um controle só, "OS aprovada no sistema do cliente em [data]". Com data preenchida:
  `os_aprovada = true`, `aprovacao` e `marco_os_aprov` recebem a mesma data. Sem data:
  `os_aprovada = false`.
- **B)** Checkbox `os_aprovada` independente, com data opcional. Permite "aprovada, data
  desconhecida", mas cria dois campos que podem discordar.
- **C)** Duas datas diferentes: `aprovacao` como "autorização / entrada", no sentido da coluna
  AUTORIZAÇÃO da planilha, e `marco_os_aprov` como aprovação formal. Mais fiel à planilha, que
  está descartada, e confunde o usuário.
- **Recomendação: A.** O cliente fala de dois atos: **liberada** (nome + data) e **aprovada**
  (data no sistema). A opção A dá um controle para cada, e a defasagem entre as duas datas, que
  ele diz cobrar, sai direto. Depende da decisão 5.

**5. De onde contam os "dias" que tornam a obra crítica?**
- **A)** Continua `aprovacao`. É a regra aprovada, mas obra liberada sem OS e toda OS do Field
  sem data nunca ficam críticas.
- **B)** `aprovacao`, senão `liberado_em`, senão a data de entrada (`created_at`). O badge diz de
  qual data está contando.
- **C)** Sempre a data de entrada. Com o pente fino, obra de oito meses ganha OS aberta hoje
  (`D/feedback-08:24-29`) e apareceria nova.
- **Recomendação: B.** Preserva a regra quando o dado existe e fecha o buraco que a J4 existe para
  fechar. **É mudança de regra de produto** em `_lib/tipos.ts` (`critico`, `classeDias`, rótulo
  "dias desde a aprovação"), por isso é decisão do João e não detalhe técnico. Muda o rótulo que o
  mockup mostra.

**6. Autoria: em que granularidade?**
- **A)** Por obra: "última edição por X em DD/MM" (2 colunas). Barato, mas a edição seguinte apaga
  quem mexeu no valor.
- **B)** Por bloco (≈3 pares de colunas): "editado por X em DD/MM" no cabeçalho de cada bloco.
- **C)** Histórico por alteração (tabela nova: campo, de, para, quem, quando), com
  "editado por X · ver histórico" em cada bloco.
- **Recomendação: C**, com **B** como piso se o prazo apertar. É a única que responde "quem mudou
  o valor desta obra", que é o risco que a própria pergunta 04 apontou. Pede migration, que o João
  roda. **Motivo não obrigatório** em edição comum, pelo *"não travar o processo"* do feedback 12;
  a exceção é a decisão 7.

**7. Mudar início planejado ou duração depois de liberada.**
- **A)** Edita direto, sem rastro.
- **B)** Mudar o início abre "Remarcar": grava `obras_remarcacao` (de, para, **motivo
  obrigatório**) e atualiza `inicio_plan`. Duração edita livre, com autoria.
- **C)** Trava depois de liberar.
- **Recomendação: B.** A ficha já promete recálculo "a cada remarcação" e já tem o bloco
  Remarcações, que nada alimenta. O motivo de remarcar é exatamente o dado que faltou no caso de
  123 dias. Motivo obrigatório já tem precedente: o "não andou" da Decisão C.

**8. Nomes do fim da esteira no mockup (feedback 09).**
- **A)** Mantém "Pendente fechamento" e "Pendente faturamento" sem pedido de compra.
- **B)** Renomeia `aprovarOS` para "Pendente aprovação da OS" e rotula `marco_liberou_fat` como
  "Pedido de compra recebido em".
- **C)** Mockup com os nomes atuais e as duas variantes lado a lado, para o João escolher.
- **Recomendação:** o João responde primeiro se o texto do feedback 09 é fala do cliente. Se for,
  **B**, porque nome de etapa é vocabulário de trabalho. Se não, **A**. Os rótulos dos marcos na
  tela 3 dependem disso.

**9. Os 3 campos do Field (`os`, `loja`, `descricao`) ficam editáveis?**
- **A)** Só leitura, com a dica "corrija no Field".
- **B)** Editáveis. Como a sincronização só preenche vazio, uma correção local nunca mais
  acompanha o Field, e ninguém é avisado.
- **Recomendação: A.** O Field é a fonte declarada (feedback 07), e a D2 depende de `os`/`field_id`
  coerentes.

### Padrões assumidos no brief (o João pode vetar sem reunião)

- `tipo` e `origem` como select com piso + valores do banco + "Outro", no padrão de `unir()`.
- `analista_cliente` com a mesma lista do "Liberado por".
- `valor` como número em R$.
- `mau_uso` como interruptor no bloco Identificação.
- Pendências (`pendencia`, `pend_resp`, `pend_prazo`, `prox_acao`) fora da J4.
- Conflito de edição simultânea: checagem por `updated_at`, com a mesma mensagem da Triagem.
- Os textos das contradições 1 a 4 reescritos e **marcados no mockup como "texto novo"** para
  aprovação.

---

## 6. Rascunho das telas do mockup desta rodada (3 telas, desktop e celular)

### Tela 1 — Triagem revisada (`etapa = definir`)

Conteúdo:
- Cabeçalho com texto corrigido: data de entrada e âncora de dias conforme decisão 5.
- "O que veio do Field", só com os 3 campos.
- "O que falta definir", com os 5 campos.
- "Dados da obra", opcional, com "Salvar dados".
- "Autorização": liberação e OS aprovada.

Estados:
1. Recém-chegada do Field: 3 campos, tudo mais vazio, 0 de 5.
2. Parcial: 3 de 5, dados da obra salvos, botão Liberar desabilitado com "Faltam 2 campos".
3. Pronta: 5 de 5, "Pronta. Ao liberar...".
4. Salvando: "Salvando…" em Dados da obra, "Liberando…" no botão principal.
5. Erro de validação no servidor: duração fora de 1–180, prioridade inválida, data de liberação
   sem nome.
6. Conflito: *"Esta obra já foi liberada por outra pessoa. Recarregue a página."*
7. Erro genérico ao salvar.
8. Sem permissão: `EstadoVazio` *"Esta tela é de quem é responsável pelas obras"*.
9. Lista de responsáveis ou equipes só com o piso, com o banco vazio.

### Tela 2 — Ficha com edição por bloco (obra em andamento)

Blocos editáveis: Identificação (tipo, valor, origem, analista, mau uso; os/loja/chamado só
leitura), Autorização (liberado por + data; OS aprovada em), Cronograma (responsável, equipe,
prioridade, início com "Remarcar", duração).

Estados:
1. Leitura completa, com "editado por X em DD/MM" em cada bloco.
2. **Incompleta:** faixa "Faltam N dados desta obra", links para cada bloco e aviso de que sem a
   data de aprovação ou liberação a obra não entra no alerta de dias (decisão 5).
3. Bloco em edição com Salvar/Cancelar.
4. Salvando.
5. Erro de validação: valor negativo, data de liberação sem nome.
6. Erro ao salvar (genérico).
7. Conflito: alguém editou antes, recarregue.
8. Remarcar com motivo obrigatório: vazio, preenchido, gravado e aparecendo em "Remarcações".
9. Histórico de alterações aberto (se decisão 6 = C).
10. Sem permissão.
11. Os 4 estados de autorização depois de editar: normal, liberada sem OS, OS sem liberação, sem
    cobertura.

### Tela 3 — Esteira com marcos (obra pós-campo)

Conteúdo:
- Passo atual com "Concluir esta etapa" em dois passos.
- Passos feitos com data e "corrigir data".
- Caminho direto (OS aprovada, desvio apagado) e caminho com desvio.

Estados:
1. Em campo: "Concluir execução em campo" carimba `marco_exec_fim`.
2. Relatório com texto honesto ("até o Field devolver o fechamento, marca-se aqui").
3. Pendente fechamento com nome de quem liberou, e o caso sem ninguém.
4. Passo pulado pelo seletor livre: "sem data registrada".
5. Confirmação.
6. Salvando.
7. Erro.
8. Corrigindo data, com validação de data antes do marco anterior (aviso, não trava).
9. Faturado: tudo feito, encerrada.
10. Sem permissão.
11. Variante de nomes do feedback 09 (decisão 8).

Todas as telas levam, **embaixo de cada seção**, os campos de retorno (`fbPor`) exigidos pelo
processo do projeto. A publicação é da sessão principal.
