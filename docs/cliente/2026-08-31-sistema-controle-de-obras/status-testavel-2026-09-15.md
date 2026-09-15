# O que o cliente já consegue testar — 15/09/2026

Inventário honesto para responder à pergunta do cliente ao João: "como eu vou testar se
as OS não estão lá?". Baseado em `manual-uso-v0.md`, `ESTADO.md` (blocos de 14/09 e
15/09), `cronograma-2026-09-14.html` e nos feedbacks/decisões listados no pedido. Onde o
manual e o código divergem, vale o código — as divergências encontradas estão marcadas
com ⚠️. Só leitura: nada aqui foi conferido contra banco, produção ou API.

---

## 1. Pré-requisitos para o cliente testar

| # | Pré-requisito | Quem faz | Status hoje (15/09) |
|---|---|---|---|
| 1 | **OS carregadas na base** | João, clicando em "Puxar do Field" em `/obras/sincronizar` (tela só de administrador) | **Ainda não puxado.** O cliente confirmou (`feedback-16`, item 6A) que o pente fino terminou e liberou a carga, mas no item 7 pediu para conferir a lista antes (não sabe se as 185 OS de hoje são todas obras ativas). O Excel com as 185 foi extraído hoje (`entregas/relatorio-exportacao-2026-09-15.md`) para essa conferência — a carga real no sistema espera essa resposta. Mecanismo: `app/obras/sincronizar/_actions.ts:12-28` (só admin) chama `executarSincronizacao` com `tipo: 'completa'`, que cria obra nova na etapa `definir` para toda OS "Atividade Spot" não arquivada (`app/obras/sincronizar/_execucao.ts:179-298`). Até o clique acontecer, a base continua com 0 obras. |
| 2 | **Acesso ao módulo liberado** | Administrador do hub, em `/admin/acessos`, marcando o slug `obras` (`lib/sistemas.ts:16`) para cada e-mail | Não verificado hoje se algum e-mail de analista já tem o slug `obras` marcado — não foi conferido (só leitura, sem acesso a banco). **Administrador do hub entra em qualquer tela de `/obras` sem essa liberação**: `hasSystemAccess` chama `isAdmin` primeiro e retorna `true` direto (`lib/auth/systemAccess.ts:8-9`), e o `middleware.ts:108-113` é quem aplica essa checagem em toda rota `/obras/*`. |
| 3 | **Contas dos usuários no hub** | Administrador do hub, convidando pelo login do hub | `AGENTS.md` registra que, em 10/09, **Amanda e Yuri não tinham conta no hub** (79 das 82 obras da planilha eram deles). **Isso não foi verificado hoje** — não há como conferir `auth.users` sem acessar o banco, o que está fora do escopo desta leitura. Sem conta, a pessoa não entra no hub e não aparece no diário mesmo com o slug liberado. |

**Conclusão da seção:** o cliente só vai ver obras em `/obras/base` depois do passo 1. Até
lá, toda tela vazia é esperado, não é bug — o próprio `/obras/base` avisa isso
(`app/obras/base/page.tsx:66-68`: "Nenhuma obra cadastrada ainda...").

---

## 2. Pronto para testar

Cada linha: tela/rota — o que faz — roteiro (2 a 4 passos) — o que esperar ver.
Requer o pré-requisito 1 cumprido (obras na base), exceto onde indicado.

1. **Ver a base de obras, em tabela** — `/obras/base`. Lista todas as obras cadastradas
   com filtros. Roteiro: (1) abra `/obras/base`; (2) confira os 8 números no topo
   (aguardando definição, em andamento, paralisadas, executadas na esteira, sem OS
   aprovada, sem cobertura, aprovadas há 60+ dias, passaram da duração); (3) veja a
   tabela abaixo, ordenada por "dias desde a aprovação" decrescente. Esperar ver: uma
   linha por obra recém-puxada do Field, todas na etapa "Aguardando definição", com
   `os`, `loja` e `descricao` preenchidos e o resto em branco.
   `app/obras/base/page.tsx:36-70`, `app/obras/base/_regras.ts:289-334`.
2. **Alternar para Kanban** — `/obras/base`. Mesma lista, em cartões por fase. Roteiro:
   (1) na Base de obras, use o seletor Tabela/Kanban no topo; (2) veja as colunas "Antes
   de executar", "Executando", "Fechamento", "Faturamento". Esperar ver: as obras recém
   -chegadas do Field concentradas na coluna "Antes de executar" (etapa "Aguardando
   definição" como subtítulo do cartão). `app/obras/base/_kanban.tsx:6-9`.
3. **Filtrar a base** — `/obras/base`. Restringe a lista sem mudar os indicadores do
   topo. Roteiro: (1) escolha um valor em "Etapa da obra" (ex.: "Aguardando definição");
   (2) confira que a tabela muda mas os 8 números do topo continuam os mesmos. Esperar
   ver: os indicadores não zeram nem mudam ao filtrar — é regra deliberada, para não dar
   impressão de que a operação parou. `app/obras/base/_filtros.tsx:26-136`,
   `app/obras/base/_regras.ts:284-288`.
4. **Abrir a ficha de uma obra** — `/obras/obra/[id]`, a partir de qualquer lista.
   Roteiro: (1) na Base, clique no nome/loja de uma obra. Esperar ver: cabeçalho com
   loja, OS, tipo; caixa "Sem cobertura" (obra recém-chegada do Field não tem OS
   aprovada nem liberação); bloco "Identificação" com `os`, `loja`, `descricao`
   preenchidos e o resto vazio; bloco "Vindo do Field" avisando que o relatório
   fotográfico e o PDF de entrega ainda não vêm automaticamente. `_ficha.tsx:343-480`
   (cabeçalho/autorização), `:538-582` (identificação), `:783` (vindo do Field).
5. **Fazer a triagem de uma obra nova** — `/obras/obra/[id]`, quando a etapa é
   "Aguardando definição". Preenche os 5 campos que faltam para a obra entrar na
   rotina. Roteiro: (1) abra uma obra recém-chegada do Field; (2) preencha Responsável,
   Equipe/prestador, Prioridade, Data de início e Duração; (3) clique em "Liberar para o
   diário do dia". Esperar ver: a obra muda para "Levantamento", some da triagem e
   aparece normalmente na Base; se faltar um dos 5 campos, o botão fica desabilitado e,
   ao forçar pelo servidor, a mensagem é "Preencha os cinco campos antes de liberar".
   `app/obras/obra/[id]/_actions.ts:114-177` (`liberarObraAction`).
6. **Trocar a etapa de uma obra manualmente** — `/obras/obra/[id]`, seletor no fim do
   bloco "Ciclo de vida da obra". Roteiro: (1) abra uma obra já liberada; (2) escolha
   outra etapa no seletor; (3) clique em "Confirmar mudança". Esperar ver: a etapa muda
   na hora, o contador "dias parada nesta etapa" zera, e fica gravado quem mudou e
   quando (não exibido na tela ainda — ver seção 3). Qualquer pessoa com acesso ao
   módulo pode fazer essa troca, não só o responsável. `_actions.ts:59-93`
   (`mudarEtapaAction`).
7. **Responder o diário do dia** — `/obras/diario`. É a rotina principal. Roteiro: (1)
   abra o Diário; (2) em um cartão, responda "Andou hoje?" (Sim/Não); (3) se "Não",
   escolha o motivo do bloqueio (obrigatório); (4) clique em "Salvar e sair da fila".
   Esperar ver: o cartão sai da fila e desce para "Já respondidas"; se marcou "Não",
   nasce automaticamente uma tarefa de cobrança visível em `/obras/tarefas`. Só aparecem
   obras em que o usuário logado é o "Responsável" (PCM) e que estão em "Levantamento",
   "Em andamento" ou "Paralisado". `app/obras/diario/page.tsx:31,60`,
   `app/obras/diario/_cartao.tsx:46-50` (validação do motivo obrigatório).
8. **Anexar foto do dia** — `/obras/diario`, obras em "Em andamento" ou "Paralisado".
   Roteiro: (1) no cartão de uma obra em campo, clique em "+ anexar foto do dia"; (2)
   escolha a imagem; (3) salve o diário. Esperar ver: a foto some da tela reduzida
   (compressão no aparelho) e some da ficha da obra em "Evolução em fotos"; não anexar
   não trava o salvamento, mas abre uma tarefa cobrando a foto da equipe.
   `app/obras/diario/_foto.tsx:24-50`, `app/obras/diario/_actions.ts:149-151`.
9. **Desfazer uma resposta do diário** — `/obras/diario`, lista "Já respondidas".
   Roteiro: (1) responda um cartão; (2) na lista "Já respondidas", clique em
   "Desfazer". Esperar ver: a obra volta para a fila de pendentes; tarefas que essa
   resposta abriu e ainda não foram respondidas somem junto; tarefa já respondida por
   outra pessoa continua existindo. `app/obras/diario/_actions.ts:90-102`
   (`salvarDiarioAction`, upsert por `obra_id+data`).
10. **Ver e responder tarefas** — `/obras/tarefas`. Fila de cobranças nascidas do
    diário, agrupadas por dono. Roteiro: (1) responda um diário deixando algo faltando
    (passo 7); (2) abra `/obras/tarefas`; (3) no grupo do dono (Compras/Roberta,
    Obras/Yuri ou a equipe da obra), clique em "Marcar como respondida" e escreva o que
    foi feito. Esperar ver: a tarefa sai de "Abertas" e entra em "Respondidas", com
    data, hora e resumo; tarefa com prazo vencido aparece em vermelho, primeiro na
    lista, mas **não avisa ninguém sozinha** — só quem entrar na tela vê.
    `app/obras/tarefas/page.tsx:1-16` (roteamento e regra da vencida),
    `app/obras/_lib/tipos.ts:594-603` (`ROTA_FALTA`).
11. **Puxar novas OS do Field manualmente** — `/obras/sincronizar` (só administrador).
    Roteiro: (1) abra a tela; (2) clique em "Puxar do Field"; (3) aguarde o relatório.
    Esperar ver: KPIs de OS vindas do Field, obras criadas, obras completadas
    (preenchidas onde estavam vazias), OS ignoradas com motivo listado uma a uma. Pode
    rodar quantas vezes quiser — OS existente nunca é duplicada nem o que foi digitado
    no hub é sobrescrito. `app/obras/sincronizar/_painel.tsx`,
    `app/obras/sincronizar/_actions.ts:12-28` (checa `isAdmin`).
12. **Liberar o acesso de uma pessoa ao módulo** — `/admin/acessos` (só administrador).
    Roteiro: (1) abra a tela; (2) encontre a linha do usuário; (3) marque o acesso ao
    sistema "Controle de Obras". Esperar ver: a partir do próximo login dessa pessoa, o
    card "Controle de Obras" aparece no painel do hub. `lib/sistemas.ts:16`,
    `app/(dashboard)/dashboard/page.tsx:137-148` (card só renderiza com `podeObras`).

---

## 3. Existe, mas com limite conhecido

- **A obra que vem do Field entra com só 3 campos.** A API do Field só traz `os`, `loja`
  e `descricao` — as ~30 outras colunas de `obras_obra` (tipo, valor, analista do
  cliente, data de aprovação, origem etc.) nascem vazias e **não existe hoje nenhuma
  tela para preenchê-las** depois da triagem (a triagem só grava os 5 campos
  obrigatórios + liberação opcional). Consequência que o cliente vai notar: **nenhuma
  obra fica "crítica" nem entra nos indicadores de dias**, porque o contador `dias`
  parte de `aprovacao`, que fica `null` até alguém digitar essa data — e não há onde
  digitá-la ainda. `app/obras/_lib/tipos.ts:401` (`dias = diasDesde(o.aprovacao, hoje)`),
  `:440-442` (`critico`). É exatamente o buraco que motiva a frente J4 (seção 4).
- **"Relatório de entrega" não é preenchido sozinho.** O manual (seção 3, etapa 5) e a
  própria ficha (`_ficha.tsx:213-220`) avisam que essa etapa deveria vir do fechamento da
  OS no Field, mas isso não existe em nenhum arquivo do módulo — hoje alguém precisa
  mover a obra manualmente pelo seletor de etapa (item 6 da seção 2). Consequência: se
  ninguém mover, a obra fica "Em andamento" para sempre, mesmo já pronta.
- **Trocar a etapa não tem trava por papel.** Qualquer pessoa com acesso ao módulo pode
  mover qualquer obra para qualquer etapa — inclusive pular etapas. Não há confirmação
  extra nem aviso de "você não deveria fazer isso". `_actions.ts:59-93`.
- **Os 7 marcos da esteira nunca são gravados.** `marco_exec_fim`, `marco_relatorio`,
  `marco_os_aprov`, `marco_fechou_os`, `marco_liberou_fat` e `marco_faturou` existem só
  como campo de tipo; nenhuma Server Action escreve neles. A esteira que a ficha desenha
  (o que já foi feito / em curso / não chegou) usa esses campos vazios — o efeito prático
  é que a esteira nunca mostra passo concluído até o botão "Concluir esta etapa" (J4,
  ainda não construído) existir. `app/obras/_lib/tipos.ts` (tipo `ObraRow`, linhas
  252-257) comparado a todas as Server Actions do módulo — nenhuma escreve essas colunas.
- **O motivo de "não andou" é uma lista fixa, sem opção de cadastrar motivo novo** no
  diário (isso é diferente do motivo de remarcação, que ainda nem existe — ver seção 4,
  item B). `app/obras/_lib/tipos.ts:174-182` (`BLOQUEIOS`).
- **A ligação entre a conta do hub e a pessoa da obra é por convenção de e-mail**, não
  por cadastro confirmado, enquanto `obras_pessoa.email` não estiver preenchido para
  cada pessoa. Um e-mail fora do padrão (`nome.sobrenome@...`) resolve para uma chave que
  não bate com nenhuma obra, e a pessoa vê "Esta tela é de quem é responsável pelas
  obras" mesmo tendo obras de verdade. `app/obras/diario/_pessoa.ts:30-76`.
- **Prazo de tarefa depois das 18h soma 1 dia corrido, não 1 dia útil**, apesar do
  comentário no próprio código dizer "dia útil seguinte" — divergência interna entre
  comentário e comportamento, registrada como tal, não como bug a corrigir sem decisão.
  `app/obras/_lib/tipos.ts:624-637` (`prazoPadrao`).
- **Cadastro manual de obra não existe** (e não é lacuna: o cliente confirmou em 08/09
  que a obra sempre vem do Field — `manual-uso-v0.md`, item 34 da seção de verificação).

---

## 4. Falta fazer

| Item | O que é | Previsão pelo cronograma | Depende de |
|---|---|---|---|
| **J4 — Triagem e ficha editáveis** | Editar em blocos (Identificação, Autorização, Cronograma) com botão "Editar"/Salvar/Cancelar; grava quem alterou. Mockup v01 revisado pelo cliente em 14/09: só a seção D (histórico) foi aprovada — A, B, C, E, F voltam para ajuste (`feedback-14-mockup-j4-v01.md`) | Mockup v02 e aprovação: 15–16/09; código: 17–18/09; deploy: 21/09 | Decisões do João de 15/09 (já fechadas — `decisoes-joao-2026-09-15.md`) |
| **J4 — Esteira "Concluir esta etapa"** | Botão que grava a data de hoje (editável) e avança a etapa, alimentando os 7 marcos hoje sempre vazios | Junto com a J4 acima, 17–21/09 | Mesmo mockup da J4 |
| **J4 — Nova regra da obra crítica** | Contagem pela data mais antiga entre liberação e aprovação (hoje é só `aprovacao`); registrar uma data nova nunca derruba a contagem | Junto com a J4, 17–21/09 | Decisão 5 revista, já fechada |
| **J4 — Histórico de alterações** | Campo, valor antigo, valor novo, quem, quando — por alteração. Única seção já **aprovada** no mockup v01 | Precisa de migration nova; junto com a J4 | Migration (decisão técnica já fechada) |
| **J4 — SLAs de aprovação/faturamento** | Dois contadores: dias sem OS aprovada (desde a liberação) e dias do fechamento da OS no sistema do cliente até faturar. Amarelo/vermelho do SLA 2 definidos hoje (15/09: 15/30 dias); SLA 1 ainda sem meta, mockup assume 20/30 como suposição | Junto com a J4 | Meta do SLA 1, ainda não respondida pelo cliente |
| **Remarcação com motivo padronizado** | Lista fechada (Loja não liberou acesso, Falta de material, Equipe indisponível, Cliente pediu para mudar, Chuva/clima, Outro) + opção de cadastrar motivo novo; mudar a data de início vira remarcação obrigatória | Parte da J4, 17–21/09 | Decisão fechada em 15/09 |
| **Cancelamento de obra** | Etapa terminal `cancelado`, com autoria (cliente/Manfac) e motivo; reversível; sai do diário e das cobranças na hora | Duda, 23–24/09 (2 dias, decisão do João sobre o que ele faz de 18–22/09 ainda pendente) | Respostas do cliente já vieram (`pergunta-07`): 1A (qualquer um cancela), 2B (obra já executada não cancela, segue até faturar), 3B (no Field a OS cancelada muda status, não arquiva — **sincronização não detecta sozinha**) |
| **Pedido de compra** | Registrar número e data de chegada; vira pré-requisito para concluir "Pendente faturamento" | 25/09 (3h de 2–4h estimadas) | Cancelamento pronto (mexe nos mesmos arquivos); nome da etapa `aprovarOS` decidido (João escolheu "Executado - pendente aprovação OS") |
| **Aviso das 18h/19h** (WhatsApp/e-mail para quem não respondeu o diário) | Lembrete automático — hoje não existe nenhum aviso | **Fora do cronograma de 14/09** — precisa de brainstorming e mockup antes de virar estimativa; recomendação do cronograma é usar a janela do Duda sem frente (18–22/09) para isso | Decisão do João sobre o que o Duda faz nesses dias |
| **Sincronização automática (jobs `pg_cron`)** | Hoje só o botão manual existe; os jobs `obras-field-incremental` e `obras-field-completa` **não foram criados de propósito** — esperam a primeira carga real | 16/09 em diante, depois da primeira carga (D3 termina 16/09, D4 primeira carga 16/09) | Pré-requisito 1 desta lista |
| **D4 — primeira carga com roteiro de 10 passos** | Script/roteiro formal para a carga real das obras do Field, distinto do botão simples | 16/09 (2,5h) | Pré-requisito 1 |
| **Manual reescrito para o fluxo real** | Manual atual (`manual-uso-v0.md`) ainda descreve a importação da planilha como carga principal; precisa refletir Field, ficha editável e alertas novos | 23/09 (2–3h) | J4 e marcos prontos |
| **Treinamento da equipe** | Data a combinar com o cliente | Semana de 28/09 (fim previsto do cronograma) | Tudo acima |

**Nota de prazo:** o cliente disse que vai dispensar um funcionário em 21/09 "por causa do
sistema"; o João interpretou isso como "o sistema substitui ele" — ou seja, 21/09 passa a
exigir operação real (obras do Field no banco + telas que cobrem o trabalho dele), não
uma demonstração. O cronograma de 14/09, porém, projeta o fim em **28/09**, com faixa
realista até 01/10. Essa diferença de datas (21/09 do cliente × 28/09 do plano) ainda não
foi resolvida — é um risco que vale expor ao João, não uma divergência de código.

---

## 5. Relação com as tarefas do funcionário que sai

Base: `transcricao-reuniao-2026-08-31.md:139-143`.

| Tarefa do funcionário | Cobertura | Tela |
|---|---|---|
| Atualiza a planilha com as obras aprovadas | **Parcial** — a obra nasce do Field automaticamente (sem digitar em planilha), mas exige alguém clicar em "Puxar do Field"; não há atualização automática recorrente ainda (pg_cron não criado) | `/obras/sincronizar` |
| Faz o cronograma de obra com a operação | **Parcial** — a Triagem captura responsável, equipe, prioridade, data de início e duração (um cronograma básico), mas não há tela de cronograma detalhado nem reprogramação com motivo (isso é a "remarcação", ainda não construída) | `/obras/obra/[id]` (Triagem) |
| Atualiza o status das obras | **Coberto** — troca de etapa manual, sem trava por papel, registra quem mudou e quando | `/obras/obra/[id]` (seletor de etapa) |
| Atualiza pendências com outras áreas (compras, financeiro, administrativo) | **Parcial** — o roteamento de tarefas cobre Compras (material) e Obras/Yuri (ferramenta, equipe, documento, outro), mas não existe rota para financeiro nem administrativo como áreas distintas; as únicas áreas do sistema são Compras, Obras e Campo | `/obras/tarefas` |
| Envia relatórios e apresenta ao cliente | **Não coberto** — não existe painel de reunião nem exportação de relatório; adiado desde 31/08 (decisão do cliente) e listado como "fora deste calendário" no cronograma de 14/09 | — |
| Cobra o fechamento da OS no sistema do cliente | **Parcial** — a Base mostra o indicador "sem OS aprovada" e a etiqueta na ficha, mas não há cobrança ativa (SLA com alerta e aviso automático é a frente J4/F, ainda em ajuste) | `/obras/base` (indicador), `/obras/obra/[id]` (etiqueta) |
| Acompanha o faturamento | **Parcial** — as etapas "Fechar OS", "Pendente faturamento" e "Faturado" existem e são movidas manualmente; falta o pedido de compra como pré-requisito de faturamento (ainda não construído) e o SLA de dias até faturar (J4/F) | `/obras/obra/[id]`, `/obras/base` |
