# Dívidas — o que foi deixado passar de propósito

Este arquivo existe porque a régua do projeto (ver `AGENTS.md`, "Fase do projeto e régua de
escopo") manda **não parar uma etapa para tratar borda improvável**. Isso só é honesto se o que
foi deixado passar ficar escrito. Sem este arquivo, "não vamos tratar agora" vira "ninguém nunca
soube".

## Como usar

**Ao deixar algo passar**, acrescente uma linha na seção (A) com: o que é, a âncora
(`arquivo:linha`, documento ou commit), a data, **o motivo** e a consequência de ficar assim.
Linha sem âncora não vale — ninguém consegue reencontrar o ponto depois.

**Ao corrigir**, não apague a linha: marque com ✅ e a data. O histórico de por que algo foi
adiado vale mais que a lista limpa.

**O que NÃO entra aqui:** qualquer coisa dos cinco territórios de exceção do `AGENTS.md` — RLS,
tabelas de acesso, escrita que apaga dado de cliente, autenticação e dinheiro. Nesses, borda se
trata na hora; adiar não é uma opção disponível.

## Situação em 20/09/2026

Primeira carga levantada por varredura de `AGENTS.md`, `docs/cliente/` inteira, `git log` de 60
dias e `grep` de marcadores no código do hub.

**Achado que vale registrar:** não existe **um único** `TODO`, `FIXME`, `HACK` ou `gambiarra` em
nenhum `.ts`/`.tsx` do hub. A dívida deste projeto nunca morou em comentário de código — mora nos
documentos, o que a tornava invisível para quem lê só o código.

---


Levantamento, não correção. Nada aqui foi mexido. Cada linha tem uma âncora verificável
(`arquivo:linha`, nome de documento ou hash de commit). Onde o motivo do adiamento não
está escrito em lugar nenhum, a coluna diz isso explicitamente — é informação, não falha
do levantamento.

Fontes varridas: `AGENTS.md`; `docs/cliente/2026-08-31-sistema-controle-de-obras/`
inteira (ESTADO.md, os `review-*.md`, os `conselho-*.md`, `backlog-integracao-field.md`);
`docs/onboarding-duda/`; `grep` de `TODO|FIXME|HACK|XXX|gambiarra|por enquanto|
temporário|workaround` em todo `.ts`/`.tsx` do hub (fora `node_modules`, `manfac-site`,
`.next`, `.claude/worktrees`); `git log --since="60 days ago"`.

---

## (A) Decisões conscientes de adiar ou aceitar risco

Alguém, em algum documento ou comentário, escreveu explicitamente que ia deixar isso
para depois — e por quê.

| # | O que foi deixado passar | Onde está | Quando foi decidido | Por que foi adiado | Consequência se ficar assim |
|---|---|---|---|---|---|
| A1 | ✅ **Corrigido em 24/09/2026, commits 054c27d, db6f74c e 37f46a6** (spec-dividas-ficha-2026-09-23 §5): cada bloco captura no Editar a "versão" das colunas DELE (`versaoDoBloco`, `app/obras/_lib/ficha-campos.ts`) e a devolve ao salvar; as três actions recusam, antes de qualquer escrita, se a versão mudou ("Outra pessoa alterou esta obra enquanto você editava…"). Não usa `updated_at` (Field, diário e outro bloco dariam conflito falso). Sobra a janela de milissegundos entre ler e gravar — ver A31. ~~**R22 — "última gravação vence".**~~ Duas pessoas editando o mesmo bloco (Autorização/Identificação/Cronograma) da mesma obra ao mesmo tempo: a segunda apaga a primeira sem aviso na tela. | `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-ficha-editavel-2026-09-18.md:815-819`; comentário em `app/obras/obra/[id]/_actions.ts:616-619` | 18/09/2026, spec da ficha editável | "Aceitar nesta entrega. O histórico grava as duas [gravações], então a perda é visível e reversível à mão." Correção proposta (não feita): parâmetro `p_updated_at` na RPC | A edição concorrente perde dado silenciosamente na tela; só aparece para quem for conferir o histórico de alterações |
| A2 | **Read-then-write na proteção do último administrador** de `hub_user_roles`. Duas remoções realmente simultâneas ainda passariam ambas. | `AGENTS.md:289-292`; guarda em `app/admin/_actions.ts` (bloco perto da linha 114, comentário "Rebaixar o último administrador deixaria o hub sem ninguém capaz de...") | Plano `docs/superpowers/plans/2026-08-07-admin-usuarios.md` | "Risco conhecido e aceito, ver o plano" — motivo específico além disso não está escrito | O hub pode ficar sem nenhum administrador se duas remoções colidirem no mesmo instante |
| A3 | **Cobrança automática das Tarefas não existe na v0** do Controle de Obras — hoje alguém precisa abrir a tela e marcar a tarefa como respondida à mão. | `app/obras/tarefas/_actions.ts:6-14` (cita "spec §8, risco 4") | Spec v0 de treinamento (05/09/2026) | "Na v1 essa volta chega pelo WhatsApp, sozinha. Na v0 alguém marca aqui" | Sem alguém entrar na tela de Tarefas, nada cobra a pendência sozinho — "vencida" nem é gravada, só calculada na hora (`sitTarefa()`) |
| A4 | **`estourou()` pode passar a acender alertas de prazo novos** assim que alguém registrar uma `aprovacao` (a ficha editável liberou esse campo, antes só vinha nulo do Field). | `spec-ficha-editavel-2026-09-18.md:806-813`; `app/obras/_lib/tipos.ts:425,513-518` | 18/09/2026 | "Aceitar e observar. [...] mexer na régua de alerta na véspera é trocar um problema conhecido por um desconhecido" | Obras antigas podem passar a mostrar "estourou o prazo" pela primeira vez, sem aviso prévio à equipe, assim que ganharem uma `aprovacao` retroativa |
| A5 | **Limiares de atenção/crítica (20/30 dias) são constante de código**, não configurável pela tela. | `app/obras/_lib/tipos.ts:11-12`; discutido em `conselho-4-perguntas-diabo.md` (item 4 da tabela) | 15/09/2026 | Tornar editável seria "escopo novo (tela de configuração, tabela, permissão) para uma métrica que ainda nem foi validada, e sob prazo" — "constante agora, tela depois, se pedirem" | Mudar o limiar exige deploy de código; não é self-service para o cliente |
| A6 | **Corte de escopo de 18/09:** a tela do histórico de alterações, os dois contadores de SLA e a migração de `liberarObraAction` para o caminho do histórico ficam fora desta entrega. | `docs/cliente/.../ESTADO.md:108-109,168-169` | 18/09/2026, decisão do João | Prazo do cliente (operar em 21/09) — priorizar ficha editável + remarcação | A liberação da obra não aparece no histórico de alterações; os dois contadores de SLA (SLA 1 e SLA 2) ainda não existem na tela |
| A7 | **Tela `/obras/sincronizar` construída sem mockup aprovado antes** — quebra a régua "mockup → spec → plano → código" do projeto. | `ESTADO.md`, seção "Dívida de processo assumida nesta sessão" (linhas ~474-479) | 10–11/09/2026 | Prazo do cliente; a tela segue o padrão da `/obras/importar`, já aprovada. Texto do próprio registro: "não deve virar precedente" | Nenhuma relatada além do desvio de processo em si — registrado de propósito para não repetir |
| A8 | **Parser de importação de planilha mantido no ar sem uso previsto**, depois da decisão de que a base nasce só do Field. | `ESTADO.md`, bloco "10/09/2026, fim da noite" (linhas ~492-495); código em `app/obras/_lib/importacao.ts`, rota `/obras/importar` | 10/09/2026 | "É o único caminho de carga em massa que existe — se a integração com o Field atrasar, ele é o plano B" | Código construído, testado e no ar, mantido de propósito como contingência não usada |
| A9 | **Contas de Amanda e Yuri e liberação de acesso adiadas** — "não há o que elas vejam hoje" com a base vinda do Field. | `ESTADO.md`, bloco "10/09/2026, fim da noite", item 2 | 10/09/2026 | Decisão do João: esperar existir obra no sistema | **Parcialmente superado**: em 18/09 o slug `obras` já estava liberado para 4 e-mails (`gabriel.lima`, `gabriel.vidal`, `luana.silva`, `yuri.moreira` — `AGENTS.md`, linha da tabela de sistemas). Em 20/09, `ESTADO.md` registra que **nenhum dos 4 tem linha em `hub_user_roles`** e que falta confirmar se têm conta em `auth.users` |
| A10 | **Backlog de integração com o Field — 7 itens** que "não bloqueiam merge nem a primeira carga" e "não voltam ao desenvolvedor até a dor aparecer". Inclui: herança só se a loja for a mesma; aviso de "varredura suspeita" que se repete e trava a detecção de ausência; comportamento de `field_id` sobrescrito sem registro persistente; entre outros. | `docs/cliente/2026-08-31-sistema-controle-de-obras/backlog-integracao-field.md:10-16` | 14/09/2026, "pela régua do conselho" | Régua explícita: só bloqueia dano de dado alcançável | Varia por item — o próprio arquivo lista o gatilho de cada um subir de prioridade |
| A11 | **Backlog da revisão da migration de motivos de remarcação — 9 itens**, entre eles: `p_de` não é conferido contra o `inicio_plan` atual da obra; a constraint nasce `not valid` e nada manda validá-la; **o campo `detalhe` (texto livre) é descartado quando o motivo não é "Outro" e não deixa registro em lugar nenhum**. | `docs/cliente/.../review-migration-motivos-2026-09-18.md:41-50`; descarte confirmado no código em `app/obras/obra/[id]/_actions.ts:556` (`detalhe = ehMotivoOutro(motivo) ? nulo(dados.detalhe) : null`) | 18/09/2026 | Régua de revisão: "não volta para quem escreveu, não impede aplicar" | Se alguém digitar uma observação de texto livre com um motivo já cadastrado (diferente de "Outro"), o texto é perdido silenciosamente — nenhuma tela avisa |
| A12 | **Ruído de teste conhecido, não corrigido de propósito:** `npm test` na raiz reporta 7 suites falhando — todas dentro de `manfac-site/`, que o `jest.config.ts` da raiz varre sem querer. | `ESTADO.md`, bloco 20/09 "⚠️ As 7 suites que 'falham' não são do hub" (linhas ~75-83); `jest.config.ts:14` (`testPathIgnorePatterns` só ignora `node_modules/` e `.claude/worktrees/`) | Constatado e registrado em 20/09/2026; o próprio texto chama de "pré-existente" | "Não perca tempo investigando isso ao retomar: é ruído de configuração [...] sem relação com obras" | `npm test` sempre mostra falhas que não são reais no hub — risco de uma falha real futura se perder no meio do ruído |
| A13 | ✅ **Corrigido em 24/09/2026, commit d581ffe** (spec-dividas-ficha-2026-09-23 §2): `mudarEtapaAction` grava etapa, `desde_etapa`, `etapa_por`, `etapa_em`, `atualizacao` e os marcos numa chamada SÓ de `obras_aplicar_alteracao`, com a linha "Esteira · Etapa: A → B" no histórico; o `update` direto, o refazer sem `etapa_por` e a mensagem "A etapa mudou, mas…" saíram. **A premissa abaixo estava errada:** a RPC já aceitava `etapa`/`desde_etapa`/`etapa_por`/`etapa_em`/`atualizacao` desde `sdd-sql-obras-historico.sql` — não foi preciso estender a RPC nem mudar schema. **As duas escritas de `mudarEtapaAction` (troca de `etapa` + marcos da esteira) não são atômicas entre si.** A troca de etapa é um `update` direto em `obras_obra`; os marcos vão numa chamada SEPARADA a `gravarComHistorico`/`obras_aplicar_alteracao` (a única forma de gravar marco+histórico juntos sem mudar schema/RPC). Se a segunda escrita falhar, a obra fica com a etapa nova mas os marcos ainda no estado antigo — inconsistente — até a PRÓXIMA troca de etapa (a partir de 21/09, `calcularMarcosDaEsteira` calcula pelo ESTADO FINAL da nova etapa, não pela direção da troca, então essa próxima troca reconcilia sozinha, mesmo que seja de novo para a mesma etapa). | `app/obras/obra/[id]/_actions.ts:377-401` (`mudarEtapaAction`, comentário acima da chamada a `gravarComHistorico` e a mensagem `'A etapa mudou, mas houve erro ao atualizar os marcos da esteira'`) | 21/09/2026, ao implementar a correção de B1 | Tornar as duas escritas atômicas exigiria estender a RPC `obras_aplicar_alteracao` para também aceitar a troca de `etapa`/`desde_etapa`/`etapa_por`/`etapa_em` (ou mudar schema) — maior que a troca pedida | Nenhuma perda de dado (o valor antigo de um marco apagado já está no histórico antes de a coluna mudar) — só uma janela de exibição incoerente entre as duas escritas, até a próxima troca de etapa reconciliar |
| A14 | **Backlog da revisão dos 7 ajustes do Duda — 4 itens**: uma OS com `/tasks` quebrado de forma persistente trava a sincronização inteira (falha visível, não estraga dado); duplo clique em "Desfazer" do diário mostra erro em vez de sucesso; foto HEIC/PNG é recusada quando a redução no aparelho falha; foto tirada perto da meia-noite pode ser recusada. | `docs/onboarding-duda/revisoes/2026-09-21-revisao-ajustes-field-api.md`, seção de backlog | 21/09/2026, revisão da branch `duda/field-api-client` | Régua de revisão: não é dano de dado alcançável, não volta ao dev | Recusas e travas aparecem como erro na tela ou falha registrada da sincronização — nenhuma perda silenciosa |
| A15 | **Bordas da incremental por `created_at>=` (correção de 21/09 das OS com `updatedAt` nulo).** (a) Se o Field publicar uma OS na API com atraso maior que a margem de 10 min em relação ao `createdAt` dela, e outra OS mais nova já tiver empurrado a marca d'água, a incremental não a vê. (b) As duas consultas (`updated_at>=` e `created_at>=`) são lidas em momentos diferentes: uma OS criada entre elas entra só pela segunda, sem problema; uma editada entre elas pode entrar com o `updatedAt` antigo, e a próxima rodada corrige. (c) O teto `OFFSET_MAXIMO` vale por consulta — só estoura com mais de 200 mil OS criadas numa janela de 5 min. | `app/obras/_lib/field/cliente.ts`, `listarOsNormalizadas` (bloco "DUAS CONSULTAS") e `varrer`; `app/obras/sincronizar/_execucao.ts`, `maiorMarcaDagua` | 21/09/2026, ao corrigir `docs/cliente/2026-09-21-os-cadastradas-no-field-nao-subiram.md` | Improváveis e não pedidas (régua do `AGENTS.md`); a varredura completa diária (sem filtro de data) recolhe qualquer OS que escape | No pior caso a OS espera até a varredura completa da madrugada — o mesmo atraso que existia antes da correção, agora só em caso raro |
| A16 | ✅ **Corrigido em 24/09/2026, commit d581ffe**, junto com a A13: sem escrita parcial não existe mais "etapa nova com `marco_fechou_os` nulo" — a data digitada, a etapa e `desde_etapa` gravam na mesma chamada ou nada grava. **Falha parcial da troca Fechar OS → Pendente faturamento seguida de recarregar a página** (extensão da A13). Se a RPC dos marcos falhar depois de a etapa mudar e a pessoa recarregar em vez de clicar "Tentar de novo", a obra fica em Pendente faturamento com `marco_fechou_os` `null`: o "corrigir data" não aparece (o passo não está feito) e a próxima troca de etapa carimba hoje, perdendo a data digitada. | `app/obras/obra/[id]/_actions.ts:423-430` (`mudarEtapaAction`, gravação dos marcos e mensagem "A etapa mudou, mas houve erro…"); "Tentar de novo" em `app/obras/obra/[id]/_etapa.tsx` | 23/09/2026, spec-ajustes-ficha §8 item 1 | Correção de verdade = a troca de etapa inteira pela RPC (resolve A13 junto); maior que o pedido | Rara: exige falha de rede entre as duas escritas E recarregar. A data digitada se perde e o marco sai com a data da próxima troca; reparável à mão com "corrigir data" depois |
| A17 | **"corrigir data" não recusa data de fechamento posterior a `marco_liberou_fat`.** Recusa futuro e anterior ao relatório/aprovação, mas aceita uma data depois do dia em que o faturamento foi liberado. | `app/obras/obra/[id]/_actions.ts:444-490` (`corrigirDataFechamentoAction`) | 23/09/2026, spec-ajustes-ficha §8 item 2 | Improvável (o limite de cima já é hoje); não pedido | Esteira pode mostrar Fechar OS depois de Pendente faturamento em datas; a correção fica no histórico |
| A18 | **Grafias diferentes da mesma equipe** ("MANFAC-7", "manfac-7", "Manfac 7") viram equipes distintas nas sugestões, na Base e no filtro do diário, agora que equipe é texto livre. | `app/obras/obra/[id]/page.tsx:61-68` (`unir`); `app/obras/obra/[id]/_triagem.tsx:498`, `app/obras/obra/[id]/_bloco-cronograma.tsx:250` (`datalist`) | 23/09/2026, spec-ajustes-ficha §8 item 3 | Texto livre foi o pedido; normalizar não foi | Filtros e contagens por equipe podem dividir a mesma equipe em duas ou mais |
| A19 | **Sem limite de tamanho em equipe.** A coluna é `text`; um texto colado enorme é aceito. | `app/obras/obra/[id]/_actions.ts:531,801` (`nulo(dados.equipe)`); `sdd-sql-obras-v0.sql:74` | 23/09/2026, spec-ajustes-ficha §8 item 4 | Não pedido; entrada é de usuário autenticado do módulo | Layout de Base/diário pode quebrar com um nome muito longo |
| A20 | **Salto que pula Fechar OS** (ex.: Relatório → Pendente faturamento, Fechar OS → Faturado sem passar pelo campo) continua carimbando `marco_fechou_os` com hoje sem perguntar a data. | `app/obras/obra/[id]/_etapa.tsx` (condição `etapa === 'fecharOS' && escolhida === 'pendFat'`) | 23/09/2026, spec-ajustes-ficha §2.2 e §8 item 5 | Escopo do mockup aprovado: o campo só aparece nessa transição específica | A data real só entra depois, pelo "corrigir data" |
| A21 | **`<datalist>` no iOS/Safari antigo** mostra as sugestões de equipe de forma diferente (ou menos visível) do que no Chrome. | `app/obras/obra/[id]/_triagem.tsx:498`, `app/obras/obra/[id]/_bloco-cronograma.tsx:250` | 23/09/2026, spec-ajustes-ficha §8 item 6 e §9 divergência 1 | `<datalist>` nativo escolhido no lugar de componente de autocomplete (decisão do João); não verificável sem o aparelho | O campo continua aceitando qualquer texto; só a sugestão pode ficar menos visível |
| A22 | **Diário respondido numa aba antiga depois do cancelamento.** `salvarDiarioAction` lê a obra sem recusar etapa `cancelado` e aceitaria a resposta, podendo abrir tarefa para obra cancelada. | `app/obras/diario/_actions.ts:80-85` (leitura de `obras_obra` sem guarda de etapa) | 23/09/2026, spec-cancelamento-obra §9 item 1 | Exige a aba do diário aberta desde antes do cancelamento; improvável e não pedido | Uma resposta de diário e, talvez, uma tarefa aberta numa obra cancelada; a tarefa não aparece em Tarefas (filtro `tarefaVisivelNaLista`) e volta a cobrar se o cancelamento for desfeito |
| A23 | **Tarefa aberta de obra cancelada respondida por aba antiga** de `/obras/tarefas`. | `app/obras/tarefas/_actions.ts:40-44` (update de `obras_tarefa` sem olhar a obra) | 23/09/2026, spec-cancelamento-obra §9 item 2 | Inofensivo | Fecha uma cobrança que já não aparecia na lista |
| A24 | **Observação do cancelamento sem limite de tamanho** (`cancelado_obs` é `text`). | `app/obras/obra/[id]/_actions.ts:548` (`nulo(dados.obs)` em `cancelarObraAction`) | 23/09/2026, spec-cancelamento-obra §9 item 3 | Não pedido; entrada de usuário autenticado do módulo | Um texto colado enorme vai para a obra e para o `motivo` da linha de histórico; o selo da ficha fica longo |
| A25 | **Autoria do cancelamento forjável por quem já tem acesso**, via `update` direto pelo PostgREST: `cancelado_quem`/`cancelado_em` vêm do servidor, não do JWT. A trigger `obras_obra_transicao_cancelamento` garante a transição, não a autoria. | `app/obras/obra/[id]/_actions.ts:555` (`cancelado_quem: email`); `sdd-sql-obras-cancelamento.sql`, seção 4; mesma classe do M7 em `sdd-sql-obras-historico.sql:144-148` e de `etapa_por` | 23/09/2026, spec-cancelamento-obra §9 item 4 | Mesma decisão já aceita para `etapa_por` e para o M7 do histórico; corrigir exige mexer em security invoker/REST | Quem já tem acesso ao módulo pode gravar outro e-mail como autor; a linha do histórico continua com o `quem` real do JWT |
| A26 | **"N obras nesta visão · base completa: M"** conta as canceladas em M. | `app/obras/base/_visao.tsx:71` | 23/09/2026, spec-cancelamento-obra §9 item 5 | Correto ("base completa"); não pedido mudar | Pode surpreender: M é maior que a soma do que "Todas" mostra |
| A27 | **OS cancelada no Field e reaberta como OS nova** entra como obra nova em "Aguardando definição"; quem vê cancela de novo. | `docs/cliente/2026-08-31-sistema-controle-de-obras/feedback-13-os-duplicadas-no-field.md`; resposta 3B em `pergunta-07-cancelamento-e-pedido-de-compra.md` | 23/09/2026, spec-cancelamento-obra §9 item 6 | Depende da verificação do status no Field (3B), fora desta entrega | Trabalho manual repetido de cancelar a duplicata |
| A28 | ✅ **Resolvido em 24/09/2026, commit af2b17c** (revisão do cancelamento, B1: as fotos e o diário aparecem só leitura na ficha cancelada). **Obra cancelada perde a "Evolução em fotos" e as linhas "foto recebida / não veio" da linha do tempo do diário na ficha**, embora o passo congelado diga "O diário e as fotos continuam abaixo". Consequência de `pedeFoto()` = `false` para a cancelada (spec §4.3). O diário continua na tela; as fotos continuam no banco/bucket. | `app/obras/obra/[id]/_ficha.tsx:884,956` (`pedeFoto(obra)`); `app/obras/_lib/tipos.ts` (`faseDe` → `null` para `cancelado`) | 23/09/2026, implementação do cancelamento | Consequência aceita da spec §4.3; tratar exigiria separar "pede foto hoje" de "mostra fotos que já vieram" — não pedido | Na ficha cancelada as fotos da obra não aparecem até desfazer o cancelamento; nada é apagado |
| A29 | **Campo "Caminho" do Ciclo de vida continua escrito para obra cancelada** ("com desvio — vai parar em …" quando não há OS aprovada), texto que não se aplica mais. | `app/obras/obra/[id]/_ficha.tsx:673` | 23/09/2026, implementação do cancelamento | Não está na spec nem no mockup; mudança cosmética | Texto que descreve um caminho que a obra cancelada não vai percorrer |
| A30 | **Teste intermitente `autorizacao: editar, erro do servidor, cancelar`**: o `findByRole('button', { name: 'Editar Autorização' })` depois de Cancelar às vezes estoura o 1 s padrão da consulta. Medido em 23/09: falhou 1 de 5 vezes **no código de antes do cancelamento** (795bbc1) rodando o arquivo sozinho, e 1 vez no `npm test` completo. Na mesma máquina, numa de duas rodadas de `npx jest app/obras` logo depois do `npm run build`, também estouraram 3 testes de `_dialogo-remarcar.test.tsx` e 1 de `_triagem-equipe.test.tsx` — os dois arquivos passam 15/15 rodando sozinhos. Remedido em 24/09 na branch `feat/dividas-ficha`: 1 falha em 6 rodadas do teste sozinho (mesma taxa); `npx jest app/obras --runInBand` com só ele falhando; em paralelo, com a máquina carregada, também estouram `_triagem-equipe`, `_dialogo-remarcar`, `historico` e `base` (nenhum tocado na branch). | `app/obras/obra/[id]/__tests__/_blocos-editaveis.test.tsx:33-35` | 23/09/2026, verificação final do cancelamento | Pré-existente e fora do escopo; o próprio teste já tem comentário sobre lentidão em paralelo | `npm test` pode mostrar 1 falha a mais que não é regressão; rodar o arquivo de novo confirma |
| A31 | **A1 — janela de milissegundos entre ler e gravar.** A versão do bloco é conferida no `lerObra`, antes da RPC; duas gravações do mesmo bloco da mesma obra no mesmo instante ainda podem passar as duas. | `app/obras/obra/[id]/_actions.ts` — `salvarAutorizacaoAction`/`salvarIdentificacaoAction`/`salvarCronogramaAction`, linha `if (versao !== versaoDoBloco(...))` | 24/09/2026, spec-dividas-ficha-2026-09-23 §5.5 e §7 item 1 | Fechar exige a RPC receber `p_versao` e conferir sob `for update` (migration); improvável: dois cliques no mesmo bloco da mesma obra na mesma fração de segundo | A segunda gravação desfaz a primeira sem aviso, como antes da A1 — só nesse instante; o histórico registra as duas |
| A32 | **"Salvar dados" da Triagem continua "última gravação vence"** (R22). | `app/obras/obra/[id]/_actions.ts`, `salvarDadosTriagemAction` | 24/09/2026, spec-dividas-ficha-2026-09-23 §5.5 e §7 item 2 | A dívida A1 listava só os três blocos da ficha; o mesmo mecanismo (colunas de Autorização + Identificação) resolveria | Duas pessoas salvando os dados da mesma obra em "Aguardando definição" ao mesmo tempo: a segunda desfaz a primeira; o histórico grava as duas |
| A33 | **Autorização: o aviso de avanço (R16) usa a etapa que a tela viu.** A etapa não entra na versão do bloco (senão toda troca de etapa derrubaria uma edição de Autorização aberta). Se outra pessoa puser a obra em `aprovarOS` enquanto alguém edita a Autorização e preenche a aprovação, a obra avança sem o diálogo ter aparecido. | `app/obras/_lib/ficha-campos.ts` (`COLUNAS_DO_BLOCO`, sem `etapa`); diálogo em `app/obras/obra/[id]/_bloco-autorizacao.tsx` | 24/09/2026, spec-dividas-ficha-2026-09-23 §7 item 3 | Improvável e não pedido; o avanço em si está certo | Só o aviso falta; a troca aparece no Histórico |
| A34 | **B7 — a régua de ano 2000–2100 não pega "2016 em vez de 2026".** Nem na Triagem nem no bloco Cronograma. | `app/obras/_lib/ficha-campos.ts` (`ANO_MIN`/`ANO_MAX`) | 23/09/2026, decisão do João (spec-dividas-ficha-2026-09-23 §4.4 e aprovações) | Pegar exigiria regra nova ("início não pode ser mais de N meses atrás"), que muda produto; se o João quiser, vira item novo com mockup da mensagem | Um ano plausível mas errado passa; os cálculos de prazo ficam sem sentido até alguém corrigir à mão (com histórico) |
| A35 | **B5 — o diálogo de avanço não avisa que passos anteriores sem data recebem hoje.** | `app/obras/obra/[id]/_bloco-autorizacao.tsx` (diálogo "Salvar a aprovação e avançar a obra") | 24/09/2026, spec-dividas-ficha-2026-09-23 §3.4 e §7 item 5 | Só acontece com obra que chegou a `aprovarOS` sem marco (antes de 21/09 e fora do backfill); não pedido | A data sai no Histórico (bloco Esteira) e é corrigível |
| A36 | **Backlog da revisão das dívidas da ficha (24/09):** (1) troca para a mesma etapa com cancelamento no meio escapa da trigger (janela de ms, classe da A31); (2) depois de um conflito, Cancelar + Editar sem recarregar repete o conflito; (3) gravação que entrou mas a resposta se perdeu na rede dá conflito com ela mesma ao salvar de novo; (4) na Triagem, data inválida na liberação/aprovação mostra "Data inválida." sem dizer o campo (já era assim); (5) `_etapa.test.tsx:76` simula a mensagem antiga "A etapa mudou, mas…". | `docs/cliente/2026-08-31-sistema-controle-de-obras/review-dividas-ficha-2026-09-24.md` | 24/09/2026 | Régua de revisão: nenhum é dano de dado alcançável; a mensagem de conflito já manda recarregar | Mensagem de conflito desnecessária em casos raros; teste com texto desatualizado |
| A37 | **Backlog da revisão da busca na Base (24/09):** (1) o "×" fica dentro do `<label>`, então com texto o nome acessível do campo vira "Buscar loja ou OS Limpar busca"; (2) sem resultado há dois controles "Limpar busca" (o "×" e o botão do vazio); (3) o "×" aparece com campo só de espaços; (4) sem teste de componente para busca + aviso de canceladas juntos (coberto na unidade); (5) realce do trecho encontrado, que estava no mockup, ficou fora por prazo. | `app/obras/base/_filtros.tsx`, `_visao.tsx`; `spec-busca-base-2026-09-24.md` | 24/09/2026 | Régua de revisão: nenhum afeta dado nem resultado da busca | Leitor de tela anuncia rótulo longo; detalhe visual |
| A38 | **Backlog da revisão do pendente faturamento B (28/09):** (1) com 9 cartões sobra um sozinho no sm (4+4+1) e no mobile (2+2+2+2+1); (2) no xl, 9 colunas deixam cada cartão com ~130px e o rótulo longo quebra em várias linhas, conferir na tela; (3) falta um teste explícito de que os dois cartões somam o antigo grupo (hoje coberto só pelas contagens separadas). | `app/obras/base/_regras.ts`, `page.tsx`; `spec-pendente-faturamento-B-2026-09-28.md` | 28/09/2026 | Régua de revisão: cosmético; soma provada por leitura de `tipos.ts` e por mutação no teste | Cartão solto na última linha; rótulo apertado em tela larga |
| A39 | **Fotos da Sofia provavelmente quebradas pela mesma CSP (28/09):** `components/sofia/GaleriaFotos.tsx:33/49` usa `<img>` com signed URL de `checklist-fotos`/`sofia-anexos`; o `img-src` sem o Storage bloqueava. A correção de `obras-foto-csp` cobre também, mas **não foi conferido em produção** antes nem depois. | `next.config.ts`; `components/sofia/GaleriaFotos.tsx` | 28/09/2026 | Achado da revisão, fora do escopo; a correção já entra no mesmo deploy | Fotos de checklist/sinistro não apareciam na Gestão de Frotas |
| A40 | **Testes de UI estouram 5s na suíte inteira de obras:** `_triagem-equipe`, `_dialogo-remarcar` (e às vezes `_visao`, `_blocos-editaveis`) falham por timeout em `npx jest app/obras` no master de 28/09; em série, 2 ainda estouram. Complementa a D7 do Duda. | `app/obras/obra/[id]/__tests__/`, `app/obras/base/__tests__/_visao.test.tsx` | 28/09/2026 | Pré-existente, não é regressão; verde quando rodados isolados | Falso vermelho na suíte; esconde falha real |
| A41 | **Backlog da revisão da coluna cliente (29/09):** (1) falha do `GET /customers` vira `null` sem aparecer no relatório da sync — se o endpoint falhar sempre, `cliente` fica vazio sem sinal; (2) o `catch` genérico também engole `ErroDeRateLimit`; (3) `idCliente` entra na URL sem `encodeURIComponent` (mesmo padrão de `loja.ts`); (4) se o Field renomear um cliente, obras antigas ficam com o nome velho (regra "só preenche vazio") e o painel pode agrupar o mesmo cliente com dois nomes; (5) OS arquivada ou sumida do Field nunca ganha cliente. | `app/obras/_lib/field/cliente-da-obra.ts`, `sincronizar/_sincronizacao.ts` | 29/09/2026 | Régua de revisão: nenhum é dano de dado alcançável | Obra aparece como "Sem cliente" no painel |
| A42 | **Backlog da revisão do painel gerencial (29/09):** (1) na visão "Acumulado do ano" a linha da meta desce a zero nos meses sem dado; (2) "Ritmo do campo" usa hoje mesmo com mês passado escolhido (coerente com "posição de hoje", conferir rótulo); (3) a spec não diz explicitamente o que acontece com faturada/cancelada sem data (o código trata: fora da carteira); (4) cancelada antes do recurso de cancelamento, sem `cancelado_em`, fica fora da carteira histórica (conservador, nunca infla); (5) dias do diário vão para a equipe gravada HOJE na obra (o diário não registra equipe). | `app/obras/painel/_calculos.ts`, `_historico.tsx` | 29/09/2026 | Régua de revisão: não bloqueia; números conferidos à mão | Leitura visual; atribuição de dias se a equipe mudar no meio da obra |
| A43 | **"Liberado por" da Triagem não mostra valor salvo fora da lista:** o select de `_triagem.tsx:639` não acrescenta o `libPor` gravado às opções (o `Selecao` da ficha acrescenta). Com a lista de analistas por cliente, uma obra D1000 cuja triagem já tenha `libPor` de analista DPSP abriria com o select vazio. | `app/obras/obra/[id]/_triagem.tsx:639` | 06/10/2026 | Pré-existente; improvável (as 18 obras D1000/PROFARMA estão sem analista) | Select aparece vazio e, se salvo assim, pode apagar o `libPor` |
| A44 | **Leitura paginada sem snapshot (`app/obras/_lib/ler-paginas.ts`):** acima de 1000 linhas, uma escrita entre uma página e outra pode deslocar linhas (uma linha some ou aparece duas vezes naquela leitura). O laço antigo do painel tinha o mesmo risco. | `app/obras/_lib/ler-paginas.ts` | 07/10/2026 | Só ocorre acima de 1000 linhas (hoje 241 obras); a alternativa (RPC/snapshot) é migration | Uma leitura momentânea com linha a mais ou a menos |
| A45 | **"Agendar e tirar do diário": a regra "PCM da obra ou administrador" só existe na Server Action, não na RLS.** A RLS de `obras_obra` é por módulo (`obras_has_access()`, policy `obras access`); quem tem acesso ao módulo agenda ou encerra o agendamento de qualquer obra chamando a API REST direto, sem passar pela action. | `app/obras/diario/_actions.ts:339` (`podeMexerNoAgendamento`), usada em `:371` e `:418`; spec §6.3 | 16/10/2026, spec-obras-agendar-tirar-do-diario §6.3 e §9 item 1 | Restringir por pcm no banco exige mudar a RLS de `obras_obra` (schema, e arrisca quebrar as outras escritas do módulo); o resto do módulo (ficha, remarcação, cancelamento) já escreve nesse mesmo nível | Quem já tem acesso pode tirar uma obra de outro analista do diário por até 30 dias, com rastro no Histórico |
| A46 | **`diario_agendado_em` vem do cliente pela RPC e pode ser antedatado via API REST** (mesma classe da A25): o CHECK só exige `em` coerente com `ate`, e quem escreve pela REST escolhe o `em`, e com ele a janela de 30 dias. | `app/obras/diario/_actions.ts:385` (`diario_agendado_em: agora.toISOString()`); `sdd-sql-obras-agendamento-diario.sql` (CHECK `obras_obra_agendamento_diario_coerente`) | 16/10/2026, spec §3 e §9 | Mesma decisão já aceita para `etapa_por`/`cancelado_quem` (A25); corrigir exige trigger que carimbe `em` no servidor | Quem já tem acesso consegue agendar além de 30 dias a partir de hoje, antedatando `em`; a linha do Histórico mostra o `para` real |
| A47 | **Read-then-write nas duas actions do agendamento:** duas pessoas agendando ou encerrando a mesma obra ao mesmo tempo — vence a última, as duas deixam linha de histórico. | `app/obras/diario/_actions.ts:364` e `:411` (leitura da obra antes da RPC) | 16/10/2026, spec §9 item 2 | Fechar exige a RPC conferir sob `for update` (migration); dois cliques simultâneos no mesmo agendamento são improváveis | A segunda gravação sobrescreve a primeira sem aviso; o Histórico registra as duas |
| A48 | **Agendamento gravado em obra que sai das etapas do diário fica no banco** e, se a obra voltar a uma etapa do diário antes da data, volta agendada; resposta de diário em obra agendada (aba antiga aberta) é aceita e não conta no "Responderam". | `app/obras/_lib/agendamento.ts:30-42` (as três regras olham a etapa); `app/obras/diario/_actions.ts:64` (`salvarDiarioAction` não olha agendamento) | 16/10/2026, spec §9 itens 3 e 4 e §11 S5 | Improvável e não pedido; limpar automaticamente exigiria trigger ou código novo em cada troca de etapa | Obra reaparece agendada depois de voltar de Relatório; registro de aba antiga fica fora do contador |
| A49 | **Virada de meia-noite entre abrir o diálogo de agendar e salvar:** o servidor revalida com o "hoje" dele. | `app/obras/diario/_actions.ts:361` (`validarAgendamento(entrada, hoje)`) | 16/10/2026, spec §9 item 5 | Janela de minutos por dia, só à meia-noite de Brasília; a mensagem já explica | Pior caso: "Escolha uma data entre amanhã e 30 dias." com a data que a tela ainda aceitava |

---

## (B) Dívidas silenciosas (sem decisão registrada)

Ninguém escreveu que ia deixar isso para depois — foi achado por leitura de código ou
está pendente sem dono declarado.

| # | O que foi deixado passar | Onde está | Quando foi decidido | Por que foi adiado | Consequência se ficar assim |
|---|---|---|---|---|---|
| B1 | ✅ **Corrigido em 21/09/2026.** ~~Três colunas de marco nunca são escritas por nenhum código de produção~~: `marco_exec_fim`, `marco_relatorio` e `marco_faturou` — existem só como campo de tipo, aparecem no mapeamento do histórico e são lidas na ficha, mas nada as grava. Confirmado por `grep` hoje (20/09): a única ocorrência de atribuição está em testes, sempre com valor `null`. **Correção:** `mudarEtapaAction` (`app/obras/obra/[id]/_actions.ts`, `calcularMarcosDaEsteira`) agora carimba os marcos anteriores à nova etapa (avançar, inclusive pulando passos), carimba `marco_faturou` ao entrar em `faturado`, e apaga com histórico os marcos da nova etapa em diante ao voltar — decisões do João em `docs/cliente/2026-09-21-decisoes-marcos-da-esteira.md`. `marco_os_aprov` continua fora, de propósito (satélite da aprovação). Revisão de 21/09: o cálculo passou a ser pelo ESTADO FINAL da nova etapa, não pela direção da troca — qualquer troca (inclusive repetir a mesma etapa) reconcilia o estado dos marcos, o que cobre a não-atomicidade registrada em A13. Preenchimento retroativo em `docs/obras/2026-09-21-preencher-marcos-retroativos.sql` (não aplicado ainda — produção). | `app/obras/_lib/tipos.ts:302-303,307`; leitura em `app/obras/obra/[id]/_ficha.tsx:204,214,331`; mapeamento em `app/obras/_lib/historico.ts:37-41,59-63,85-86,188-192`; achado original registrado em `ESTADO.md`, bloco "10/09/2026", item 1, e reafirmado em `ESTADO.md:364` para `marco_faturou` ("Task 5 [...] bloqueada até alguém gravar `marco_faturou`") | motivo não registrado — é achado de leitura de código, não decisão | ~~A etapa "Execução em campo" (`campoFeito = !!obra.marco_exec_fim`) nunca aparece como concluída, e fica assim "para sempre" (texto do próprio achado de 10/09); "Relatório de entrega" e a Task 5 da regra de crítica (que depende de `marco_faturou`) têm o mesmo problema~~ — resolvido pela correção de 21/09 para obras que trocarem de etapa dali em diante; obras já paradas em etapa pós-campo dependem do backfill SQL rodar |
| B2 | ⏸️ **Adiada pelo João em 24/09 ("não é relevante agora").** **Pergunta 03 do cliente — "como calcula esse avanço %?" — segue sem resposta** desde 31/08/2026. | `ESTADO.md`, seções "Perguntas em aberto COM O CLIENTE" e "Pendências" (`- [ ] Responder a pergunta 03...`); texto pronto em `docs/cliente/2026-08-31-sistema-controle-de-obras/pergunta-03-como-calcula-o-avanco.md` | motivo não registrado — a única nota é "falta só o João mandar" | Hoje o avanço é digitado à mão sem regra: "a planilha tem `0.9` numa linha e `95` em outra querendo dizer a mesma coisa" (texto do próprio `ESTADO.md`) |
| B3 | **Nenhum marcador de código** (`TODO`, `FIXME`, `HACK`, `XXX`, "gambiarra", "por enquanto", "temporário", "workaround") **foi encontrado** em nenhum `.ts`/`.tsx` do hub (fora `node_modules`, `manfac-site`, `.next`, `.claude/worktrees`). | `grep` rodado nesta sessão sobre `app/`, `lib/`, `components/` e a raiz do repo — achado negativo, sem ocorrência | não se aplica | não se aplica | Achado que vale registrar por si: a dívida técnica deste projeto vive nos documentos de `docs/cliente/`, não em comentários de código |
| B4 | **`cadastrarMotivoRemarcacaoAction` — a mensagem específica de "motivo desativado" (item 5a da revisão de 20/09) não cobre o caminho de corrida do 23505.** O fix de 21/09 faz `procurarMotivo` recusar oferecer um motivo INATIVO como `jaExistia`. Mas no ramo de corrida (`error.code === '23505'`, duas pessoas cadastrando o mesmo nome ao mesmo tempo), a releitura (`relido`) só checa `relido.motivo` — se o motivo que "ganhou" a corrida for inativo, cai no `return { error: 'Erro ao cadastrar o motivo' }` genérico, não na mensagem que nomeia o motivo. | `app/obras/obra/[id]/_actions.ts`, função `cadastrarMotivoRemarcacaoAction`, bloco do `error.code === '23505'` | 21/09/2026, ao corrigir o item 5a | Corrida DENTRO de uma corrida (duas pessoas cadastrando o mesmo nome ao mesmo tempo, E esse nome já existir inativo) — combinação improvável, e o usuário ainda recebe um erro (não trava sem saída), só com mensagem genérica em vez da específica | Nenhuma — só a mensagem de erro é menos informativa nesse caso raríssimo |
| B5 | ✅ **Corrigido em 24/09/2026, commit 7a8826c** (spec-dividas-ficha-2026-09-23 §3): no auto-avanço `aprovarOS → fecharOS`, `salvarAutorizacaoAction` aplica `calcularMarcosDaEsteira(obra, 'fecharOS', hoje)` — a mesma regra do seletor (decisão 1 de 21/09: avanço é avanço, qualquer que seja o gatilho) — na MESMA chamada da RPC, com as linhas "Esteira" depois das da Autorização. Aviso que faltou no diálogo: ver A35. ~~**`salvarAutorizacaoAction` também muda `etapa`**~~ (o auto-avanço R16, `aprovarOS → fecharOS` ao registrar uma aprovação nova) **e não carimba nenhum marco da esteira** — a correção de 21/09 (B1) só cobriu `mudarEtapaAction`, que o pedido descrevia como "a única ação que muda etapa". Não é: uma obra que avança por este caminho pode pular `fecharOS` sem `marco_relatorio` nem `marco_exec_fim` carimbados, se ainda estivessem `null`. | `app/obras/obra/[id]/_actions.ts`, função `salvarAutorizacaoAction`, bloco `avancou` (perto da linha 435) | 21/09/2026, achado ao implementar a correção de B1 — não corrigido, fora do escopo pedido | Escopo explícito da correção de 21/09 era só `mudarEtapaAction`; estender exigiria decisão sobre se este auto-avanço específico soma no cálculo de "anterior" do mesmo jeito | Uma obra que sai de `aprovarOS` para `fecharOS` por este caminho (em vez de pela troca manual de etapa) pode chegar em `fecharOS`/depois com `marco_relatorio` e/ou `marco_exec_fim` ainda `null` — o backfill de `docs/obras/2026-09-21-preencher-marcos-retroativos.sql` cobre o estado ATUAL das obras, mas não este caminho daqui em diante |
| B6 | **Histórico de alterações ordenado só por `created_at`** — linhas gravadas pela MESMA chamada de `obras_aplicar_alteracao` compartilham o mesmo `created_at` (fixado uma vez por chamada, spec §7) e por isso podem empatar e sair em ordem não determinística entre uma leitura e outra. `sdd-sql-obras-historico.sql:69-74` já criou a coluna `seq` (bigserial, estritamente crescente) e o índice `obras_historico_obra_idx (obra_id, created_at desc, seq desc)` exatamente para desempatar — mas o código de leitura do histórico não usa `seq` na ordenação. | `sdd-sql-obras-historico.sql:69-74` (comentário e índice); leitura do histórico em `app/obras/obra/[id]/page.tsx` (busca de `obras_historico`) | achado na revisão independente de 21/09 — não corrigido, fora do escopo desta rodada | — | Linhas da mesma troca de bloco (ex.: os cinco marcos carimbados juntos por `mudarEtapaAction`) podem aparecer em ordem diferente a cada carregamento da Ficha; nenhuma perde dado, só a ordem de exibição é instável |
| B7 | ✅ **Corrigido em 24/09/2026, commit 1103597** (spec-dividas-ficha-2026-09-23 §4): `liberarObraAction` valida os cinco campos com `validarCronograma` (data de calendário real, ano 2000–2100, prioridade, duração 1–180 só com dígitos) e `libEm`/`aprovadaEm` com `validarAutorizacao`; início inválido devolve "Data de início inválida. Confira o dia, o mês e o ano." (aprovado pelo João em 23/09). Data de liberação sem nome agora é recusada em vez de descartada. O exemplo "2016 em vez de 2026" continua passando — régua 2000–2100 mantida por decisão do João, ver A34. ~~**`liberarObraAction` e a "Data de início" da Triagem não validam ano/calendário no servidor.**~~ O campo é `<input type="date">` (validação só no navegador); o servidor (`nulo()` + trim) aceita qualquer string não vazia como data, sem checar se é uma data real nem se o ano faz sentido (ex.: `2099-01-01` só é barrado onde há uma checagem explícita contra "hoje", como em `aprovadaEm` — a Data de início não tem checagem equivalente). | `app/obras/obra/[id]/_actions.ts`, `liberarObraAction` (~linha 308, campo `inicio`); `app/obras/obra/[id]/_triagem.tsx:518` (o input) | achado na revisão independente de 21/09 — não corrigido, fora do escopo desta rodada | — | Um ano digitado errado (ex.: `2016` em vez de `2026`) é aceito sem aviso do servidor; os cálculos de prazo/atraso da obra ficam sem sentido até alguém notar e corrigir à mão |
| B8 | **`fimCalc = ini + duracao` é EXCLUSIVO, mas a contagem de "dia N de M" é INCLUSIVA (dia 1 = `ini`).** Numa obra de `duracao` dias começando em `ini`, o último dia "dentro do prazo" pela contagem inclusiva é `ini + (duracao-1)`; mas `atraso` (que decide o vermelho que o cliente vê) só liga a partir de `ini + duracao + 1`, porque `atraso = diasDesde(fimCalc, hoje)` só fica `> 0` no dia seguinte a `fimCalc`. Consequência: o dia `ini + (duracao-1)` E o dia `fimCalc` (`ini + duracao`) mostram **os dois** "dia N de N" / 100% — o último dia aparece duplicado na contagem, um dia a mais de "folga" antes do vermelho acender. Corrigido só o sintoma visível (a barra não passava de 100% antes do vermelho acender, e não pulava um número ao acender — ver commit da correção do item 2, 21/09/2026); a causa (a semântica de `fimCalc` exclusivo vs. contagem inclusiva) não foi mexida por decisão do coordenador: é semântica de prazo que o cliente vê, não cabe mudar sem o João decidir qual dia é realmente "o último". | `app/obras/_lib/tipos.ts`, `derivar()` — `fimCalc` (~linha 467) vs. `diaDe`/`corridos` (~linha 470-485) | achado em 21/09/2026, ao corrigir o item 2 da revisão de código de 20/09 ("dia 8 de 7") | Mudar `fimCalc` muda quando a obra vira vermelha para o cliente — decisão de produto, não de bug fix, e pedida para não mexer nesta rodada | Todo prazo tem um dia a mais de folga entre "dia N de N" e o vermelho acender do que o nome "duracao" sugere; o último dia do prazo aparece com o mesmo rótulo duas vezes seguidas |
| B9 | **`npm run lint` na raiz varre `.claude/worktrees/` e `material manfac/manfac-site/.next/`.** Medido em 22/09/2026: 81.016 problemas com as worktrees dos agentes; 573 erros sem elas — **todos** em artefatos compilados de `material manfac/manfac-site/.next`. O código do hub passa limpo, mas o número bruto do lint não serve de sinal. | `eslint.config.mjs` (ignores); o jest já ignora `.claude/worktrees/` em `jest.config.ts:14` | 22/09/2026, ao verificar o merge do comunicado | Mudar config de lint não era o pedido; conferência feita por `npx eslint <arquivos alterados>` | Quem rodar `npm run lint` sem saber disso lê "573 erros" e conclui que o hub está quebrado. Para conferir: `npx eslint . --ignore-pattern ".claude/**" --ignore-pattern "material manfac/**"` |

---

## Contradição encontrada dentro do próprio `AGENTS.md`

A tabela "Estado das migrations em produção" diz que a `admin-usuarios` **PARTE 2** foi
"aplicada em 2026-08-10, após o deploy" (`AGENTS.md:224`). Mas a seção logo abaixo,
"`sdd-sql-admin-usuarios.sql` é aplicado em DUAS PARTES", ainda afirma que a PARTE 2
está "**PENDENTE, não rodar ainda**" (`AGENTS.md:270-271`). As duas frases não podem
estar certas ao mesmo tempo. Não corrigi — o pedido era só levantar, não corrigir — mas
fica registrado aqui para quem for arrumar o arquivo.

---

## Item confirmado por medição em 20/09/2026

**B1 foi verificado pela sessão principal, não só reportado.** As três colunas de marco
(`marco_exec_fim`, `marco_relatorio`, `marco_faturou`) aparecem em:

- `app/obras/obra/[id]/_ficha.tsx:80,84,204,214,331` — **lidas e exibidas**
- `app/obras/_lib/tipos.ts:302-307` — **tipadas**
- `app/obras/_lib/historico.ts:37-41,59-63,85-86,188-192` — **mapeadas para o histórico**

E em **nenhum** `update`, `insert` ou `upsert` do repositório. Conferido com
`grep -rn ... | grep -iE "update|insert|upsert"` fora de `__tests__`: zero resultados.

**Consequência na tela do cliente:** `_ficha.tsx:204` faz `const campoFeito = !!obra.marco_exec_fim`.
Como nada grava essa coluna, `campoFeito` é sempre falso e a ficha mostra **"em curso" para
sempre**. A etapa "Execução em campo" não tem como terminar, e a mensagem "Obra entregue em … e
ainda não faturada" (`_ficha.tsx:331`) nunca aparece.

Isso **não** é borda improvável: é o caminho normal de qualquer obra que termine. Pela régua do
`AGENTS.md`, não é candidato a ficar nesta lista — é trabalho a fazer.

**Feito em 21/09/2026** (ver B1 marcado ✅ acima): `mudarEtapaAction` passou a gravar os cinco
marcos ao trocar de etapa, e o backfill para as obras já paradas está escrito (não aplicado) em
`docs/obras/2026-09-21-preencher-marcos-retroativos.sql`.

## Relatório diário por e-mail (08/10/2026) — backlog da revisão independente

- `app/api/obras/relatorio-diario/route.ts`: `SMTP_PORTA` não numérica vira `NaN` → 502 em todos os envios (falha fechada, sem validação explícita).
- `route.ts`: transporte sem `pool`; com muitos destinatários o envio pode passar dos 60 s do `pg_net` (os e-mails saem, o registro fica `timed_out`). Se acontecer: `pool: true` ou timeout maior no SQL.
- `route.ts`: resposta 502 lista os e-mails que falharam; fica em `net._http_response` (só legível com acesso ao banco).
- A rota lê com service role, a tela com a sessão (RLS). Números só batem se a RLS de `obras_*` não esconder linhas de quem tem `obras` — não medido.
- Locaweb devolveu `451` temporário no 1º envio de teste (08/10, local); o 2º passou. Sem retry por decisão de escopo — aguardando o João sobre uma nova tentativa.

## 13/10/2026 — troca do nº da OS pelo campo "OS Cliente" (merge 4b5be3f)

Backlog da revisão independente; nenhum bloqueia.
- Aviso de colisão aparece só no histórico da tela Sincronizar, não na obra (decisão do João de 13/10; reabrir se ele pedir).
- O mesmo aviso de colisão se repete a cada execução do cron enquanto o campo seguir preenchido.
- Execução que falha perde os avisos daquela rodada (`erro` guarda só a falha).
- Campo achado pelo início do nome "os cliente"; outro campo com o mesmo início pegaria o primeiro do array.
- Colisão no insert (obra nova, lote de 100) derruba a execução inteira; sem dano, a próxima rodada vira aviso. Comportamento anterior a este commit.

## 23/10/2026 — Frotas: correção de B1/B3/B7 (merge fix/frotas-bugs-b1-b3-b7)

Backlog da revisão independente; nenhum bloqueia.
- `checklist/page.tsx:18` e `checklist/[id]/page.tsx:21` ignoram o `error` da consulta: outro erro de query volta a mostrar a lista vazia / 404 em vez de avisar.
- `atualizarTratativaSinistroAction`: se a RLS negar o update, o Supabase devolve 0 linhas sem erro e a tela mostra "Alterações salvas" sem ter gravado. Anterior a este merge.

## 26/10/2026 — Frotas: revisão por KM, SQL de peças, botões admin escondidos (merge fix/frotas-rodada2-suporte)

Backlog da revisão independente; nenhum bloqueia.
- "Vence em breve" (≤1.000 km) e `km_passados` existem só em `lib/sofia/revisaoStatus.ts`/`getRevisoesAtrasadas`; nenhuma tela exibe ainda (espera o mockup da rodada 2).
- `revisoes/page.tsx:67` mostra "atrasada" na revisão mais recente mesmo com status `realizada` (já era assim por data; agora também por KM).
- Para não-admin seguem visíveis excluir sinistro, excluir lançamento de KM e desativar equipe; devolvem erro por State, não em silêncio. Resolver junto com o papel gestor de frotas.
- `atualizarAutorizacao*Action`, `toggleEquipeAction`, `upsertKmExcedidoStatusAction` ainda saem calados para não-admin; só alcançável por chamada forjada (botão escondido).
- Indentação do JSX em `multas/_table.tsx` nos blocos `{isAdmin && (`.

## 26/10/2026 — Frotas: papel gestor de frotas (branch feat/frotas-gestor)

Registrado por decisão do coordenador (spec `docs/frotas/2026-10-26-spec-gestor-frotas.md` §1.4/§3.2/§6 e revisão `docs/frotas/2026-10-26-revisao-spec-gestor-frotas.md`). Nenhum bloqueia.
- Concessão do papel só por SQL (spec §1.4); tela em `/admin/acessos` adiada até haver um segundo gestor ou pedido do João (UI + action com `exigirAdmin` + service role + testes).
- `softDeleteVeiculoAction` (`app/(operacoes)/sofia/veiculos/_actions.ts`) segue sem trava: qualquer um com o slug `sofia` desativa veículo. Anterior a este branch; trava nova é outra decisão.
- Reconvite após remoção (linha de `sofia_gestores` apagada por `apagarLinhasDoUsuario`) só provado no jest mockado (`app/admin/__tests__/_actions.test.ts`), não no banco.
- Vetor `auth.updateUser({ email })` para o e-mail de um gestor órfão (linha deixada por remoção feita direto no painel do Supabase): o risco já existia igual com `hub_user_roles`/`hub_system_access`.
- Itens 7 e 9 do diagnóstico (corrigir KM / corrigir abastecimento) não existem para ninguém; quando F2/F3 forem feitas, a action nasce com `requireGestorFrotas` e a função de banco com a guarda `sofia_pode_gerir() is not true` (se restrita). *(Feito em `feat/frotas-f1-f3`, seção abaixo.)*

## 26/10/2026 — Frotas: F1-F3 editar equipe, corrigir KM e abastecimento (branch feat/frotas-f1-f3)

Registrado por decisão do coordenador (spec `docs/frotas/2026-10-26-spec-f1-f2-f3.md` §7 e revisão `docs/frotas/2026-10-26-revisao-spec-f1-f2-f3.md`, itens "vai para DIVIDAS.md"). Nenhum bloqueia; **B7 e B12: avisar o João**.
- **B7 (impacto em desconto):** `app/api/sofia/veiculo-motorista/route.ts:21-28` sugere o motorista do registro de responsabilidade **aberto**, não o da data da infração. Multa que chega depois de uma troca (por F1 ou pelo checklist) sugere o motorista novo; o campo é editável, mas a sugestão errada vira desconto em salário de quem não dirigia se ninguém conferir.
- **B8:** o checklist (`atribuir_responsabilidade_veiculo`) não limpa o motorista anterior da equipe de destino — ainda pode nascer equipe com dois motoristas ativos. F1 corrige a equipe quando ela é editada; não há limpeza em massa.
- **B11:** corrigir o primeiro lançamento de KM pode levar `veiculos.km_atual` abaixo do KM de cadastro do carro (a função usa o maior lançamento restante). A prévia do diálogo mostra o valor novo antes de salvar.
- **B12 / R5:** o ✕ (excluir lançamento de KM, `deletarKmAction`) continua sem recalcular `veiculos.km_atual`. Com F2 no ar, o caminho recomendado ao cliente é "Corrigir".
- **R1 (pré-existente):** quem tem o slug `sofia` consegue, pelo navegador, dar UPDATE direto em `km_diario.km_atual`, `abastecimentos`, `equipes.codigo`, `motoristas.equipe_id` e `veiculos.km_atual` (RLS `sofia access`), sem passar pelas funções nem pela auditoria. Fechar exige trigger novo sem quebrar o upsert de `lancar_km_atomico`. A linha `(info)` de `sdd-sql-sofia-correcoes-f1-f3-teste.sql` mede isso.
- **R2 (pré-existente):** `audit_log` não é à prova de adulteração — a policy `sofia access` é `for all`. Sugestão do revisor (pergunta 2 do §8, aguarda o João): `revoke update, delete on public.audit_log from authenticated` (o app só faz insert/select: `lib/sofia/auditLog.ts:16`, `audit/page.tsx`). Impede alterar/apagar o histórico de correções; inserir linha falsa continua possível.
- **R4 / pergunta 1 do §8 (dinheiro) — pré-requisito do deploy (C16):** a correção de KM **não altera** `km_excedido_desconto`; só avisa na mensagem de sucesso quando o mês tem registro ("Este mês tem registro de KM excedido para o {placa}. A correção não altera esse registro — confira em Descontos."; se a consulta falhar, avisa que não conseguiu conferir). Casos aguardando a regra do João: (a) correção cria excesso sem linha no mês; (b) correção tira o excesso com status `sem_solicitacao` (apagar a linha e fechar a pendência — apaga dado de cliente — ou manter e avisar; `descontos/page.tsx:168` mostraria "+-N km"); (c) `solicitado`/`autorizado`: não mexer e avisar.
- `editar_equipe_atomico` recusa com "Os dados da equipe mudaram enquanto você editava…" se o motorista novo trocar de equipe entre a leitura e a trava, e `corrigir_km_atomico` recusa se o veículo do lançamento mudar (B3). Nenhum dos dois é coberto pelo teste SQL (exige duas sessões simultâneas).
- `getCorrecoes` (`lib/sofia/queries.ts`) consulta o `audit_log` em lotes de 100 ids para todos os lançamentos exibidos (as listas de KM e de abastecimento não têm paginação); o custo cresce com o histórico.

## 26/10/2026 — Frotas: B5/B6 (branch feat/frotas-revisoes-b5-b6)

- Detalhe da revisão (`revisoes/[id]`) classifica pela previsão da própria revisão, mesmo quando ela já foi substituída por uma mais nova do mesmo veículo+tipo; na lista só a mais recente é classificada. Chip de revisão antiga no detalhe pode divergir da lista.
- `[id]` que não é uuid válido faz a consulta falhar e cai no error boundary, não em "Revisão não encontrada".
- Linha clicável da lista usa link esticado (`after:absolute`) na célula da placa; não testado em Safari antigo.

## 28/10/2026 — Frotas: backend dos extratos Ticketlog/Veloe (branch feat/frotas-extratos-backend)

- Envio de arquivo passa pelo limite padrão de 1 MB do corpo de Server Action (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`); `next.config.ts` não foi mexido. A amostra Veloe de 27 dias tem 155 KB (Ticketlog 51 KB): a carga desde 01/08 cabe; um .csv de mais de ~5 meses estoura com erro genérico do Next. A tela (quando vier) deve avisar pelo tamanho antes de enviar.
- O .csv da Veloe é lido com divisão por `;` e aspas simples (`lib/sofia/extratos/veloe.ts`, `campos`); quebra de linha dentro de campo entre aspas não é tratada. A amostra real não tem aspas.
- `lib/sofia/extratos/__tests__/amostras-reais.test.ts` é pulado em quem não tem as amostras (fora do Git por dado pessoal) — a conferência 206/26 e 403/27 só roda na máquina do João.

## 27/10/2026 — Diário para todos (branch `feat/obras-diario-para-todos`), não bloqueantes do review

- Rótulo "Respondido por" de quem não está em `obras_pessoa` quebra o e-mail só no `.` (`ana_paula@` vira "Ana_paula"); `chaveDoUsuario` quebra em `.-_+`. Cosmético.
- `page.tsx`: erro da consulta `todosPcm` é ignorado; se falhar, o seletor sai das obras já filtradas. Não vaza nada (todos com acesso veem tudo).
- "Em nome de" usa o `pcm` atual da obra, não o da hora da resposta.

## 28/10/2026 — Frotas: telas dos extratos (branch feat/frotas-extratos-telas)

- **D2 (decisão do João):** o histórico de envios mostra o e-mail de quem enviou e o saldo digitado a **todo o Frotas** (RLS `sofia_extrato_ler` = `sofia_has_access`). Contraria a recomendação de restringir a gestor/admin/financeiro. O e-mail de quem enviou fica exposto a todo o Frotas.
- **D3 (encerrar ligação) feito em 29/10/2026** (branch `feat/frotas-d3-encerrar-ligacao`): encerrar = linha nova com `equipe_id` nulo (view já dava `sem_equipe`). Depende de `sdd-sql-sofia-extratos-d3.sql` (**NÃO APLICADO**): sem ele o botão falha no NOT NULL. Não há "desfazer encerramento" além de religar com equipe; encerrar com data anterior a uma ligação mais nova é recusado só se não houver ligação vigente naquela data.
- **D4 (divergência no reenvio)** é feita no app: `enviarExtratoAction` lê `sofia_extrato_linhas` antes da RPC e compara o valor. Uma linha gravada por outro envio entre a leitura e a RPC não aparece como divergente (a RPC ignora, nada é sobrescrito). Se quiser à prova de corrida, a RPC precisa devolver as divergentes.
- Lista de gastos, "sem centro de custo" e cadastros leem a view inteira (paginando de 1000 em 1000) e agrupam/somam no servidor; com dezenas de milhares de linhas isso pesa e vira agregação no banco.
- Telas de leitura (cadastros, gastos, sem centro de custo, histórico) abrem para qualquer pessoa com acesso ao Sofia; só os botões de gravar exigem gestor/admin (a action e a RLS reforçam). O mockup mostrava "sem permissão" para quem não é gestor; D2 prevaleceu.
- Sem teste de componente/página (o projeto não tem teste de UI para as páginas do Sofia); a lógica está em `lib/sofia/extratos/__tests__/agrupar.test.ts` e na action.

## 29/10/2026 — Frotas: D3 encerrar ligação, não bloqueantes da revisão

- Encerramento com data passada tira gastos já enviados do centro de custo sem aviso (views do financeiro mudam junto, são calculadas na hora). Falta aviso/limite de data retroativa no diálogo.
- Encerramento com data futura é aceito; até a data a tela segue mostrando a equipe e o botão "Encerrar" (a linha futura só aparece no histórico).
- Gasto de cartão encerrado cai na caixa "ainda não têm equipe" — texto um pouco enganoso nesse caso.
- `ligacaoVigente` desempata por `criado_em`; a view por `criado_em, id`. Só diverge com `criado_em` idêntico.
- Teste da action não cobre não-gestor recusado (coberto pela RLS e pelo teste SQL u1); teste SQL não cobre encerrar no mesmo dia de uma ligação existente.
## 29/10/2026 — Diário de obra da OBRA (Task 8, branch `feat/obras-modalidade-obra`)

- "Tirar" foto do rascunho apaga só a linha de `obras_rdo_foto`; o arquivo fica em `obras-fotos` (o bucket não tem policy de delete). Mesmo destino de RDO rascunho apagado (já anotado na Task 1).
- Foto que sobe ao bucket e falha no `registrarFotoAction` vira arquivo órfão.
- `salvarRascunhoAction` não é atômico: o RDO pode ser gravado e o avanço falhar; a tela mostra o erro e um novo "Salvar" completa. A substituição do avanço grava antes de apagar, então não há janela de perda.

## 29/10/2026 — Modalidade OBRA, Fase 1 (branch `feat/obras-modalidade-obra`), deixado de propósito

Fora de escopo da Fase 1 (âncora: `.superpowers/sdd/2026-10-29-obras-modalidade-obra-fase1/`):

- Clima automático no diário: o campo é manual.
- Ronda de pontos fixos / mapa: Fase 4.
- Semanal, PPC, curva S e Gantt: Fase 2.
- Página do cliente: Fase 3 (hoje o cliente só recebe o e-mail).

Bordas conhecidas, não tratadas (Task 9b, `diario/_actions.ts`, `_lib/enviar.ts`):

- Fotos vão ao e-mail sem redimensionar: cap de 6 e foto >1,5 MB é omitida.
- Sem trava contra reenvio simultâneo em duas abas (o envio é por destinatário, mas a janela existe).
- Avanço + validação sem transação: falha no meio deixa o RDO gravado sem validar; novo clique completa.
- `page.tsx` do diário não checa erro ao calcular pendentes.
- `sdd-sql-obras-modalidade-obra.sql` (verificação 1) para no 1º erro esperado no SQL Editor; o `-2` já não.
- Trava de atividade (`atividade_trava`) bloqueia correção só de status quando o % > 0.
- Regex de path de foto no banco aceita só minúsculas (uuid em maiúsculas é recusado).

Menores dos reviews por tarefa, não confirmados como corrigidos na leva final (conferir antes de dar por fechados):

- Lista de obras faz N+1 de leituras do cronograma (Task 6).
- Causa de impedimento continua gravada quando a atividade avança (`diario/_actions.ts`); `de` defasado ao reabrir rascunho (`page.tsx`, `_preenchimento.ts`), afeta o de→para do e-mail (Task 8).
- Encerrar impedimento não confere categoria nem data futura; form do passo 4 aparece em diário já validado (a action recusa) (Task 9a).
- Update de id inexistente devolve ok; rótulos crus de tipo de envio (usar `TIPOS_ENVIO`); engenheiro inalterado sem acesso trava os outros campos (Task 10).
- Cronograma: `n` negativo/não inteiro vira 0 em silêncio; sem validação de data malformada; faltam testes a==b, início em fim de semana e virada de ano (Task 2).
- Apagar RDO rascunho deixa fotos órfãs no storage; sem botão "Tornar OBRA" na Triagem; sem teste obra→spot (Tasks 1 e 5).
- SQL 1: `create table if not exists` não acrescenta o check de/para se a tabela já existir; verificação 8e pode devolver `OBRAS_VERSAO_SALVA` em vez de 23514 (Task 1).

## 30/10/2026 — Leva 1, Task 5 (cronograma árvore + Gantt), deixado de propósito

- **"Descartar rascunho" fora:** `obras_cronograma_versao` não tem delete (RLS) e `obras_atividade` do rascunho também não; descartar exigiria policy/RPC nova. Hoje o rascunho vazio é reaproveitado por `criarRevisaoAction`.
- Edição da execução (status/%/datas reais) saiu da tela do cronograma junto com a tabela antiga; volta na gaveta "Atualizar status" (Task 6). O botão já está na barra com um aviso provisório.
- Setas de dependência no Gantt: desligadas (spec §5 deixa a chamada ao builder).
- O rótulo do mês no cabeçalho do Gantt não acompanha a rolagem horizontal (o mês da esquerda some ao rolar).

## 30/10/2026 — Leva 1 do cronograma (branch `feat/obras-leva1`), menores dos reviews que ficaram

Âncora: `.superpowers/sdd/2026-10-30-obras-leva1/progress.md` (linhas "minor") e `task-*-review.md`.
Corrigidos na prévia da Task 9 (não entram aqui): desalinhamento árvore×Gantt nas últimas linhas,
tooltip das barras com a caixa rolada, rótulo Realizado cortado/encostando no "Hoje", cabeçalho da
tabela não fixo no celular, KPI cortado, "p.p." encostado no eixo, botão Salvar rascunho atrás do
menu inferior do diário.

- Motor (`_lib/cronograma.ts`): campos de entrada opcionais (`?:`); sem teste com `dataStatus` ≠ hoje;
  `diasRestantes = 0` pode projetar o fim num dia não útil; `deltaDiasUteis` exportado a mais (Task 2).
- Curvas/leitura (`_lib/curvas.ts`, `_lib/leitura.ts`): histórico sem paginação (corta em 1000 linhas);
  `dadosAte` via RDO em UTC; realizado ausente vira 0 em `progressoPorPeriodo`; fórmula do % previsto
  duplicada entre `curvas.ts` e `cronograma.ts` (Task 3).
- Shell: "Dados até" sem hora (é data); telas internas ainda leem a obra 2x até migrarem; outros 6 em
  `task-4-review.md` (Task 4).
- Cronograma (`[id]/cronograma/`): Enter+blur pode enviar duas vezes; fallback de `data_base` diferente entre
  action e página; `gravarAtividade` duplicado; mock duplicado nos testes; Dias e Predecessoras não editáveis
  abaixo de 768px (Task 5).
- Gaveta "Atualizar status" e validação do diário: ✅ 30/10/2026 (revisão final, I2) o histórico passou a ser
  gravado **antes** do exec, então falha no histórico não deixa exec sem ponto na curva. **Segue fora de
  transação:** falha no exec depois do histórico deixa uma linha de histórico a mais (no retry vira duplicata
  com a mesma data e %, absorvida pela curva). Atomicidade real exige RPC nova. Outros 5 em `task-6-review.md` (Task 6).
- Motor: ✅ 30/10/2026 (revisão final, I1) dias restantes ancorados na `data_status` em que foram informados
  (derivada do histórico na leitura); `diasRestantes = 0` continua projetando o fim na própria âncora.
- Painel (`_ui/`): `previstoDaEtapa` duplicado; hex fora de token; ordem impedimentos × evolução;
  `SeloSinal`/`corSinal` mortos; sem teste anti-NaN (Task 7).
- Diário/e-mail: ícone do clima no e-mail é bolinha colorida (não SVG); hex literal no lugar de token;
  clima legado regravado junto com os turnos (Task 8).
- Visual, visto na prévia (`/previa-obras`): a faixa "Trava ativa" do painel lista as descrições inteiras
  (8 linhas no celular com Macaé 3, empurra os KPIs); no celular, "Salvar rascunho" + menu inferior
  ocupam ~130px fixos; a prévia importa a fixture de `_lib/__tests__/fixtures/` (só dev, 404 em produção).

## 30/10/2026 — Frotas visão geral (branch `feat/frotas-visao-geral`), deixado de propósito

- CNH: janela de 60 dias (mockup e `getMotoristasComCnhVencendo`); spec corrigida em 27fcd0b.
- "Carros na oficina agora": o "desde" é o `created_at` da revisão mais recente do veículo (mesmo critério da tela Disponibilidade); não existe coluna com a data de envio à oficina.
- Custos do mês somam a locação de **todos** os veículos (inclusive inativos), igual à tela Custos; o mockup excluía inativos. Divergência do mockup, regra da tela Custos preservada.
- "Em uso" conta carro ativo com responsável no histórico, mesmo sem equipe (a regra pedida); "Equipes sem KM" usa só equipe ativa com carro ativo.
- Os links `?sit=`, `?cnh=alerta`, `?de=&ate=`, `?placa=` dependem das bases novas (outra frente); até lá as listas abrem sem filtro.
- Mês corrente pela data de São Paulo, mas `getRevisoesAtrasadas` e `getDocumentosVencendo` ainda usam data UTC (queries.ts, fora desta frente).
- Falha de leitura vai para o `error.tsx` de /sofia (sem estado de erro por bloco, como o resto do Sofia).

## 30/10/2026 — Frotas e-mail diário (branch `feat/frotas-email-diario`), deixado de propósito

- Feriados não entram em "dia útil anterior": depois de feriado a equipe aparece sem KM de ontem (só seg–sex).
- Sem nova tentativa de envio (Obras tenta de novo após 60 s): falha de SMTP responde 502 e fica em `net._http_response`.
- Leituras sem paginação (limite de 1000 linhas do PostgREST); aceitável para a frota atual, revisar se passar disso.
- "Carro obrigado a apresentar KM" (item 2.3.4 do mapa do Igor) não existe no cadastro: todo carro com equipe é cobrado.
- CNH usa janela de 60 dias (mockup, spec e `getMotoristasComCnhVencendo`). Constante `DIAS_CNH` em `lib/sofia/alertas/blocos.ts`.
- Links "Abrir no hub" levam à lista, sem filtro por query string (as telas ainda não leem filtro).
- Destinatário = `sofia_gestores` com `hub_system_access` sofia ativo (mesma regra de `sofia_pode_gerir()`); gestor sem o slug não recebe e não há aviso disso.

## 30/10/2026 — Frotas bases (`feat/frotas-bases`)

- Filtros das bases ficam só no estado da tela: a URL só é lida ao abrir (não é reescrita ao filtrar); compartilhar o
  link exige montar a query à mão. Ordenação e página também não vão para a URL.
- Equipe/motorista do abastecimento sem trecho no histórico na data aparecem como "—" (sem fallback para o cadastro atual,
  de propósito: não inventar responsável). Abastecimentos anteriores ao primeiro registro do histórico ficam assim.
- Leitura carrega a base inteira no servidor (paginada de 1000 em 1000) e filtra no navegador; com dezenas de milhares de
  linhas passa a pesar e pede filtro/paginação no servidor.
- "Rodou no mês" do veículo soma o "rodou desde o anterior" dos lançamentos do mês corrente (inclui o salto do último
  lançamento do mês anterior), não MAX−MIN como a tela Consumo do mês.
- "Enviar para oficina" na gaveta do veículo (mockup) não entrou: depende de manutenção corretiva (rodada seguinte).
- Chip "corrigido" do KM aparece só quando o valor atual difere do original (regra de `valorOriginalKm`).

## 31/10/2026 — Obras Leva 1b, estrutura do cronograma + visão Tabela (`feat/obras-leva1b`, Task 3)

- Reordenar com o mouse (arrastar) não entrou: ↑/↓ por etapa e por atividade na visão Tabela. Para trocar de etapa,
  edita-se a célula Etapa (lista das etapas existentes).
- A estrutura (+ Etapa, renomear, ↑/↓, + Atividade, excluir) ficou só na visão Tabela (padrão no rascunho); a árvore
  da visão Gantt segue com a edição inline de antes, sem os botões de estrutura (linha de 44px casada com o Gantt).
- Atividade criada pela tela nasce com `peso_valor = 0`; o engenheiro preenche na coluna "Valor (R$)" da Tabela
  (decisão do José, 31/10, opção A). Enquanto ficar 0 não pesa no % físico; com Σ = 0 o motor dá 0% (regra atual).
  A coluna só aparece no rascunho, para engenheiro/admin; "+ Atividade" cria a linha e o valor se digita nela.
- Renomear etapa numa revisão: a comparação com a base por etapa (início/fim base da linha de etapa) é pelo nome, então
  a etapa renomeada aparece sem base até a próxima base. A comparação por atividade (`numero`) não muda.
- Excluir atividade deixa a linha de `obras_atividade_exec` (sem avanço; não há delete nela). O `numero` não é
  reaproveitado (próximo = maior da obra em todas as versões e na execução + 1).
- Lista de etapas na linha muda ao escolher (inclusive com as setas do teclado numa lista fechada no Windows, que grava
  a cada seta); predecessoras idem.

## 31/10/2026 — Obras Leva 3, Last Planner + semanal (`feat/obras-leva3`), revisão final

- `obras_restricao.atualizado_por`: UPDATE sem JWT (service role, cron) herda o valor anterior. Só a service role
  escreve sem JWT.
- Admin apaga um plano já avaliado e os itens vão em cascata (poder de admin, sem UI).
- Avaliação do plano grava item por item, sem transação: falha no meio deixa parte avaliada; o resto segue avaliável
  (a checagem é por item).
- Validar e enviar o semanal em duas abas/cliques ao mesmo tempo: as duas leem `obras_envio` antes de qualquer insert
  e mandam duas vezes. O botão fica desabilitado enquanto envia.
- Semanal validado com `conteudo` fora do formato (só possível escrevendo o jsonb à mão pela API): o app ignora e monta
  na hora, ou seja, volta a mostrar o estado atual para esse semanal.
- Cabeçalho do PDF do semanal congelado (OS, cliente, engenheiro) ainda sai da obra atual; o corpo é o congelado.

## 31/10/2026 — Obras Leva 5, portal do cliente (`feat/obras-leva5`), deixado de propósito

Fontes: `.superpowers/sdd/2026-10-31-obras-leva5/progress.md` (ledger) e `final-review.md` (revisão final).
O que é auth/RLS foi corrigido na hora (I1, M1, M2); aqui ficam só bordas de operação e de produto.

- **Verificações antigas não rodam de novo** (`docs/obras/2026-10-31-verificacao-obras-leva3.sql` caso 58 e `docs/obras/2026-10-31-verificacao-obras-leva4.sql` caso 57): elas
  apagam obra com JWT de não-admin, e a Leva 5 passou a recusar isso (`obras_obra_delete_guarda`). Motivo: o teste
  antigo não é reaproveitado; corrigir é trocar para JWT de admin quando alguém precisar rodá-lo. Consequência:
  rodar de novo dá falso "FALHOU" nesses dois casos.
- **Índice de IP não usado** (`obras_portal_codigo_ip_idx`, `sdd-sql-obras-leva5.sql`): o rpc conta por
  `ip is not distinct from p_ip`, que não usa o índice. Motivo: volume baixo (códigos da última hora). Consequência:
  varredura da tabela a cada pedido; vira problema só com dezenas de milhares de linhas (falta limpeza de códigos
  antigos, ver abaixo).
- **Cota da vítima** (`obras_portal_emitir_codigo`): quem sabe o e-mail do cliente pode pedir código por ele,
  aposentar o código vivo e gastar os 5/h dele. Motivo: desenho do spec (resposta uniforme, sem enumeração);
  não vaza nada. Consequência: o cliente pode ficar até 1 h sem conseguir entrar sob abuso.
- **Obra com mensagem ou documento não se apaga** (FK `on delete restrict`; delete de obra só admin). Motivo:
  mensagem é registro imutável. Consequência: apagar obra exige runbook (exportar e limpar antes, sem JWT).
- **Linha órfã de documento sem objeto** no Storage só admin apaga (Task 3). Motivo: borda rara (falha entre
  upload e insert). Consequência: o documento aparece e o download dá erro até um admin limpar.
- **URL de foto do portal com 300 s** em thumbnail lazy (Task 4): a página aberta por muito tempo mostra foto
  quebrada até recarregar. Motivo: URL curta é a proteção; recarregar resolve.
- **Rate limit de mensagens do cliente não é atômico** (30/h por e-mail, `(obra)/_lib/mensagens.ts`). Motivo:
  não é auth; o excesso numa corrida é de poucas unidades.
- **Conferência do código usa o relógio do app** (`lib/portal-obra/codigo.ts`, `.gt('expira_em', agora)`): a
  emissão já usa o relógio do banco (M1), mas a conferência compara com a hora do servidor Next. Motivo: só muda
  a validade efetiva pelo tamanho do desvio de relógio (NTP nos dois); um rpc `obras_portal_usar_codigo` resolveria.
- **Códigos e sessões vencidos não são apagados** (`obras_portal_codigo`, `obras_portal_sessao`). Motivo: volume
  pequeno; sem cron de limpeza. Consequência: a tabela cresce devagar.
- **Pergunta de execução/entrega pode voltar quase todo dia** (`app/obras/obras/_lib/analista.ts`, `impressao` =
  duração + fim projetado; o fim de atividade em andamento sem `dias_restantes` anda com a data de status).
  Motivo: é o que o spec diz ("sem mudança nos números não volta"); faixas (semana do término) dependem do José.
- **Situação publicada fica no portal indefinidamente**, mesmo se os pontos somem; e se a última versão estiver
  com formato inválido (só por escrita manual) nada aparece, sem cair para a anterior. Motivo: spec ("a última
  publicada"). Consequência: o engenheiro publica uma nova quando a situação melhora.
- **Restrição da Manfac/terceiros vai ao prompt** com tipo e código, sem descrição; a resposta do engenheiro pode
  citar área interna. Motivo: desenho do spec; só a instrução da IA e a revisão humana antes de publicar protegem.
- **Apresentação (`apresentacao.ts`) não leva a situação.** Motivo: o spec não pede.

## 31/10/2026 — Obras Financeiro da obra, Fase A (`feat/obras-financeiro-a`), deixado de propósito
- Falta índice em `frn_contratos.obra_id` (a leitura `obras_fin_fornecedores` filtra por ele). Sem custo hoje (poucos contratos); criar quando crescer.
- Entrega com situação `divergencia` não conta como entregue no selo "Pronta para liberar" (só `confirmada`/`resolvida`). Confirmar com o José se está certo.
- Uma RPC a mais (`obras_pode_ver_valores`) em toda página da obra, calculada no layout. Aceito; cachear se pesar.
- As `obras_fin_*` ainda têm grant a `service_role`, inútil (retornam vazio sem e-mail). Não removido: o teste 13 de verificação chama como service_role.
- Bloco Compras mostra pedido de solicitação cancelada com valor e status "Cancelada", sem esmaecer; o Resumo já o exclui (salvo com NF/pago).

## 01/11/2026 — Obras Financeiro da obra, Fases B/C, SQL do hub (`feat/obras-financeiro-bc`, Task 5), deixado de propósito
- **Pedido do Compras pago por solicitação do Financeiro conta duas vezes.** Nem `fin_solicitacoes` nem `fin_obra_vinculos` guardam o pedido do Compras (`cmp_pedidos`), então se alguém pedir no Financeiro o pagamento da NF de um pedido do Compras (CC de OBRAS → o 044 obriga vínculo), o custo entra em `obras_fin_compras` e em `obras_fin_vinculos`. Não há chave para deduplicar em SQL. A Task 7 deve rotular/alertar; ou combinar com o José a regra "pedido do Compras não vira solicitação no Financeiro". **Mitigado em 01/11/2026 (revisões da Task 7 e final):** a aba Financeiro casa pelo CPF/CNPJ do fornecedor (`fin_solicitacoes.fornecedor_documento` × `cmp_mapa_fornecedores.documento`). Regra exata (`consolidarMargem` em `app/obras/obras/_lib/financeiro-obra.ts`): um pagamento do Financeiro (vínculo de solicitação, em **qualquer OS da família** mãe + aditivos) ao mesmo documento de um pedido do Compras que conta (emitido; cancelado só com NF/pago) é tratado como quitação desse pedido, **só enquanto o pedido não está pago no Compras** (`cmp_pedidos.pago_em` vazio) e até o valor do pedido menos o que outros pagamentos já quitaram; o excedente fica em "Pagamentos / rateio". Pedido já pago no Compras não absorve nada, **exceto** o pagamento com a mesma data (dia BRT de `pago_em` = `fin_pagamentos_omie.data_pagamento`), que é o mesmo pagamento visto dos dois lados. Bordas que sobram: (1) um pagamento **avulso** (serviço extra, outra NF) ao mesmo fornecedor enquanto ele tem pedido **em aberto** na família é absorvido pelo pedido — o custo da obra fica menor até o Compras marcar o pedido como pago (aí, se as datas forem diferentes, volta a contar); (2) pedido quitado pelo Financeiro e marcado pago no Compras em **dia diferente** do pagamento conta duas vezes; (3) dois pagamentos no mesmo dia ao mesmo fornecedor com pedido pago: o segundo também é absorvido até o valor do pedido. A pílula "pagamentos casados com pedidos do Compras" deixa o casamento à vista. Apertar exige chave de verdade (número da NF na solicitação ou o id do pedido no vínculo) — levar ao José.
- `obras_medicao_cliente` com nota ligada fica travada (nem admin apaga, muda %/valor ou tira de aprovada); a checagem lê `fin_fat_nota_medicoes` na hora, sem trava contra o Financeiro ligar uma nota no mesmo instante. Janela de corrida aceita (o Financeiro liga nota a medição aprovada, que o engenheiro já não altera).
- Datas da medição (`enviada_em`/`aprovada_em`) só têm limite superior (hoje, BRT) e coerência (aprovação não antes do envio); retroagir livremente continua possível. Combinar com o José se quer um limite inferior.

## 01/11/2026 — Obras Financeiro da obra, Fases B/C, telas do hub (`feat/obras-financeiro-bc`, Task 6), deixado de propósito
- `obras_medicao_cliente.percentual_centesimos` é NOT NULL: OS sem valor receita não registra medição (a tela mostra o % como "—" e pede o valor receita em Dados da obra). Se o José quiser medição só por valor, o percentual precisa virar nulável.
- Trocar o e-mail de uma pessoa do organograma não leva junto o destinatário/acesso do e-mail antigo: eles aparecem em "sem cadastro no organograma" até alguém acertar.
- Funções da lista antiga sem tela: "Trazer destinatários do lado cliente" (`trazerDestinatariosClienteAction`) ficou sem botão (o organograma substitui). Remover acesso ao portal e editar destinatário do cliente voltaram em Dados da obra.
- Avanço físico da medição é gravado no momento do registro (lido do cronograma da própria OS); aditivo sem cronograma grava NULL ("—").
## 01/11/2026 — Obras Leva 6, mapa e fotos (`feat/obras-leva6`), deixado de propósito
- ~~Planta só como imagem (PDF não)~~ **Resolvida em 01/11/2026** (`feat/obras-leva6b-pdf`): a tela de montar aceita
  PDF e converte a 1ª página em imagem no navegador (`pdfjs-dist` 5.4.624 — a 6.x exige Node ≥22 e o Dockerfile usa node:20, import dinâmico, `montar/_pdf-para-imagem.ts`);
  o servidor segue recebendo só imagem.
- **Trocar a planta deixa a imagem antiga no bucket** (`<obra>/mapa/`): a policy não deixa apagar pelo navegador e
  não há limpeza. Volume pequeno (uma imagem por troca).
- **Ponto desativado não é barrado no banco para foto nova** (Task 1, ponto 2): a ronda só lista pontos ativos,
  mas uma chamada direta à action com o id de um ponto desativado grava.
- **Leituras de foto do mapa sempre ordenadas e limitadas** (fix 1 da revisão, contra o corte calado de 1000 linhas do
  PostgREST): diário = 1 consulta `limit 1` por ponto ativo (referência de ângulo); mapa = 1 consulta por ambiente com as
  6 mais novas; linha do tempo do ponto = páginas de 60 ("Ver mais fotos", até 600) + a primeira foto. Custo: N consultas
  pequenas por tela (N = pontos ativos ou ambientes). Se pesar, trocar por um rpc com `distinct on`.
- **Ordem por coluna do RDO** usa `order=obras_rdo(data)` (ordenação por relação to-one do PostgREST ≥ 11). Conferir na
  primeira abertura em produção que a linha do tempo vem em ordem.
- **Editor do mapa sem desfazer e sem atalho de teclado para mover/redimensionar** (só ponteiro e os botões
  "+ Ambiente"/"Pôr no desenho"). O mockup mostrava "Desfazer"; como tudo grava na hora, ficou de fora.
- **`salvarPlantaAction` não confere se o arquivo existe no bucket**: um caminho canônico válido mas não enviado deixa a
  planta quebrada (a imagem não aparece). Só engenheiro/admin chega lá; reenviar a planta resolve.
- **Deploy: `sdd-sql-obras-leva6.sql` antes do app** (verificação pós-commit 20/20 e teste
  `docs/obras/2026-11-01-verificacao-obras-leva6.sql` 94/94). Se o app subir antes, o diário, a foto e o impedimento
  continuam como antes da Leva 6 (leitura do mapa que falha = obra sem mapa; `ambiente_id`/`ponto_id`/`atividade_numero`
  só vão no insert quando preenchidos); só as telas do mapa dão erro.
- **Ambiente com impedimento (mesmo encerrado) nunca se apaga** (FK NO ACTION de `obras_impedimento.ambiente_id`) e não
  há tela para desmarcar o ambiente do impedimento. Coerente com não apagar histórico; a mensagem orienta renomear.
- **`atividade_numero` da foto não é conferido contra o cronograma** (nem no banco nem na action, só `>= 1`). A tela só
  oferece atividades da versão vigente; uma chamada direta pode gravar número inexistente (a foto só não aparece na
  atividade).
- **Diário aberto antes de o mapa existir:** se o engenheiro cria o primeiro ambiente enquanto o supervisor está com o
  diário aberto, a foto seguinte é recusada com "O mapa da obra mudou; recarregue a página…" e o arquivo enviado é
  apagado na hora (sem órfão, salvo falha da própria remoção).
- **Teste manual do editor do mapa pendente** (arrastar, redimensionar, pontos) em desktop e tablet antes do deploy; só
  há testes em jsdom.
- **Ambiente obrigatório só no app**, não no banco (Task 1, ponto 1): obra com mapa recusa foto sem ambiente/ponto em
  `registrarFotoAction`; quem gravar direto pelo banco escapa. De propósito, para não quebrar obra sem mapa.

## 01/11/2026 — Obras Leva 6b, planta de faseamento, telas do hub (`feat/obras-leva6b-faseamento`, Task 3), deixado de propósito

- **Deploy: `sdd-sql-obras-leva6b.sql` antes do app.** Se o app subir antes, a aba Faseamento mostra "Faseamento ainda
  não está disponível nesta obra"; a Comunicação relê os envios sem `fase_revisao_id` (42703) e segue sem o faseamento;
  Dados da obra aguenta (o coordenador é leitura própria; sem a coluna só o campo some). Corrigido na revisão (I1).
- **Destinatários do envio `faseamento` = os do relatório de fase** (tipos `semanal` ou `mensal`): não existe tipo
  `fase` em `obras_destinatario` (o CHECK só aceita diario/semanal/mensal/imediato). Reenviar manda de novo a todos (cada
  clique é um envio registrado), sem pular quem já recebeu.
- **Prévia da prancha na tela é HTML/SVG, não o PDF**: o hub manda `X-Frame-Options: DENY` e `frame-ancestors 'none'`
  em todas as rotas, então `<iframe>` do PDF não abre. A prévia segue o layout do PDF mas não é idêntica (fontes, quebra
  das regras, rótulo da zona que encolhe só no PDF). O oficial é "Gerar PDF". Na revisão emitida, o título da prévia sem
  carimbo usa o nome ATUAL da fase (o PDF usa o congelado).
- **Planta com caminho mas sem largura/altura** (permitido pelo banco) sai em quadro branco no PDF (a prancha precisa da
  proporção). O `salvarPlantaAction` sempre grava as dimensões, então não deve acontecer.
- **Sem renomear, reordenar nem apagar fase pela tela**, e sem desfazer no editor de camadas (o rascunho só grava em
  "Salvar rascunho"; recarregar descarta). Fora da spec.
- **Filtro "Relatórios" da Comunicação não inclui o faseamento**: o envio aparece em "Todos".
- **Teste manual do editor de camadas pendente** (zona por arrasto, linha com duplo clique/Enter/Esc, mover, ocultar)
  em desktop e tablet, e conferência visual do PDF com planta real: só há testes em jsdom e o render do react-pdf é mockado
  no Jest.

### Revisão final da Leva 6b (01/11/2026)

- ~~Planta em WEBP some do PDF em silêncio (C1)~~ **Resolvida na origem em 01/11/2026**: o `@react-pdf/image` só lê
  JPEG e PNG. O conversor de PDF do mapa (`montar/_pdf-para-imagem.ts`) gera JPEG 0,9 (PNG se o navegador não gerar
  JPEG) e o upload direto de WEBP é convertido para JPEG no navegador (`webpParaJpeg`, mesmos tetos de 2400 px e
  16 Mpx). Servidor e policy continuam aceitando `.webp` (sem SQL). Se ainda assim houver planta `.webp` (enviada antes
  ou gravada direto), o PDF sai sem a base e com "Formato da planta não suportado no PDF; envie JPG, PNG ou PDF em
  Montar o mapa" no rodapé; a prévia e a tela mostram o mesmo aviso. Prova com o react-pdf real:
  `scripts/verificar-prancha-formato-planta.tsx`. Em 01/11 não havia planta em produção (`obras_mapa.planta_path` vazio).
  Revisão **emitida** com `.webp` congelado continuaria sem base para sempre; reenviar a planta e criar nova revisão
  resolve. Converter no servidor (`sharp`) consertaria as antigas, mas exige declarar a dependência (OK do José).
- **Planta WEBP fora do PDF sai no quadro padrão 1000×700**, não na proporção da planta: as camadas (0–1) ficam
  esticadas em relação ao que o editor mostra. Só acontece com planta antiga ou gravada direto.
- **Revisão ilegível (M2):** a "Nova revisão" copia só o legível da última emitida (camadas e regras uma a uma, carimbo
  validado ou o padrão), então a emitida ilegível destrava por ela, sem avisar quantas camadas/regras foram descartadas.
  Já um **rascunho** ilegível (só por SQL manual: o app nunca grava assim) continua em leitura, porque salvar apagaria o
  descartado e não há tela de correção; a mensagem diz "peça ajuda ao suporte" e o conserto é por SQL.

## 01/11/2026 — Obras Financeiro da OS no SPOT, SQL do hub (`feat/obras-spot-financeiro`, Task 1), deixado de propósito
- **Locação do SPOT é marcável (devolvida/renovada) por qualquer usuário do Obras**, não só pelo analista da OS
  (`obras_pode_marcar_locacao` em `sdd-sql-obras-spot-financeiro.sql`, fallback da spec
  `docs/superpowers/specs/2026-11-01-obras-spot-financeiro-design.md` §4.2). Motivo: a ligação analista → e-mail
  (`obras_obra.pcm` → `obras_pessoa.email`) não é confiável como guarda — as duas tabelas têm a policy "obras access"
  `for all` (`sdd-sql-obras-v0.sql`), então qualquer usuário do Obras pode pôr a própria chave no `pcm` ou o próprio
  e-mail numa pessoa. Restringir ao analista exige antes proteger essas colunas (só admin grava `obras_pessoa.email` e o
  `pcm`, ou gatilho de guarda). OBRAS continuam só com engenheiro da obra/mãe ou admin.
- **Inserir/apagar `obras_nota_externa` não reavalia a etapa do SPOT.** A nota externa só entra na soma quando o
  Financeiro chama `obras_marcar_faturada` (próxima NFS-e da OS) ou `obras_desmarcar_faturada`. Uma nota externa que
  sozinha fecha o valor deixa a OS em "Pendente faturamento" até alguém mudar a etapa na ficha ou a próxima nota chegar.

## 01/11/2026 — Obras Financeiro da OS no SPOT, app e documentação (`feat/obras-spot-financeiro`, Tasks 2–10), deixado de propósito
- **Sobrefaturamento do SPOT só gera aviso:** a parte acima do saldo da OS é permitida (a OS passa a `faturado` e o
  excedente fica visível), não é recusada.
- **Parciais devolvidos por `obras_marcar_faturada` não são gravados na linha do tempo do Financeiro:** o "falta" é
  recalculado por `faltaSpot` a cada leitura.
- **Aviso de vencimento de locação na ficha SPOT ignora feriados** (conta dias corridos).
- **Leitura do financeiro do SPOT é tudo-ou-nada:** falha de uma RPC (caixinha, medições atrasadas) derruba o bloco
  inteiro; a página das OBRAS tolera leitura parcial.
- **Faturamento parcial das OBRAS fora:** decisão de 01/11 — "somente ao SPOT por enquanto".
- **Visão consolidada de margem no painel:** etapa própria, ainda não feita.
- **Teste "044: nota ↔ medição" do Financeiro é instável:** pega nota rascunho por uuid aleatório (repo `financeiro`).

## 01/11/2026 — Financeiro da OS no SPOT, revisão final da branch (hub + `financeiro` `feat/spot-faturamento-parcial`), deixado de propósito
- **Desmarcar um SPOT ainda coberto por outras notas o devolve em `marcadas`:** `obras_desmarcar_faturada` mantém a OS
  em `faturado`, mas a linha do tempo do Financeiro diz "de volta a pendente faturamento".
- **Baixa parcial gera o evento "0 obra(s) em faturado"** na linha do tempo do Financeiro quando nenhuma OS fechou.
- **SPOT com valor 0 nunca entra numa nota no Financeiro** (saldo 0, fora da fila), enquanto o hub o faturaria na hora
  na primeira NFS-e.
- **A fila de um lote de teste (homologação) usa o saldo de produção** (`saldosSpot` só conta notas de produção).
- **Qualquer usuário do Obras edita `obras_obra.valor` de um SPOT**, e esse valor agora move saldo, fila e faturado.
  Pré-existente (policy "obras access"); é a próxima borda de dinheiro a fechar.
- **Rascunhos antigos de nota SPOT com várias obras, no dia do deploy, vão pedir a parte de cada obra** (a trava
  recusa parte vazia). Avisar a equipe do Financeiro antes do deploy.

## 03/11/2026 — Frotas: terceira bateria, manutenção e bases (branch `feat/frotas-manutencao`), deixado de propósito
Fontes: spec `docs/superpowers/specs/2026-11-03-frotas-manutencao-e-bases-design.md` §7, revisão SQL
`docs/frotas/2026-11-03-revisao-sql-manutencao.md` (N2, N5–N8) e revisão de código
`docs/frotas/2026-11-03-revisao-codigo-manutencao.md` (N2–N5, mais N6).
- **Corretiva concluída não tem tela de edição nem de exclusão** (spec §7.1). Correção só por SQL; sem DELETE de propósito.
- **"Enviar para oficina"/"Retornar da oficina" da ficha não criam nem fecham manutenção** (§7.2). Carro devolvido pela
  ficha com manutenção aberta fica com ela aberta até alguém concluir.
- **Conclusão pode devolver a Ativo um carro que está na oficina por outro episódio** (revisão SQL N2): corretiva aberta
  com "tirar", retorno pela ficha, novo envio pela ficha e só então a conclusão da antiga. O carro vai para `ativo` e
  perde `previsao_retorno_oficina` **e o substituto**. A ação é explícita do gestor; variação do item anterior.
- **Disponibilidade, Custos e Visão geral não somam corretivas** (§7.3): dias parados e custo ficam só na tela de corretiva.
- **As 20 corretivas antigas continuam em `revisoes`** (§7.4), sem migrar (decisão 2.1 da spec).
- **Importação simultânea da mesma planilha por duas pessoas pode duplicar** (§7.5; revisão de código N4): a checagem de
  repetida é no app, sem índice único `(veiculo_id, km_realizada)`. Só gestor importa e o botão trava durante o envio.
- **UPDATE direto de gestor na manutenção** (§7.6): o grant de UPDATE por coluna congela `veiculo_id`, `criado_por`,
  `tirou_da_equipe`, `data_entrada` e `created_at`, mas um gestor ainda pode reabrir uma concluída ou concluir direto por
  UPDATE no PostgREST, sem passar pela RPC e sem auditoria. Fechar de vez exige trigger.
- **`veiculos.intervalo_revisao_km` guardado só no app** (§7.7): o `sofia_bloquear_escrita_nao_admin` não foi estendido
  para não mexer em trigger compartilhado.
- **Base de Multas sem as colunas novas da outra frente** (§7.8) até a integração; ajustar colunas e planilha.
- **"Registrar revisão" continua aberto a quem tem Sofia** (§7.9, colisão 2); fechar se o João confirmar.
- **Média km/dia sem lançamentos recentes = "—" e sem "Chega em"** (§7.10).
- **Fechamento do histórico de responsabilidade usa `current_date` (UTC)** mesmo com `data_entrada` passada (revisão SQL
  N5); igual ao app.
- **Abrir corretiva com "tirar" num carro já em `manutencao` sobrescreve `previsao_retorno_oficina`** (revisão SQL N6).
- **Dado de produção: `EWH1B84` está em `status = 'manutencao'` com `equipe_id` preenchido** (revisão SQL N7, medido em
  03/11). Se abrirem uma corretiva com "tirar" para ele, a equipe sai (efeito correto). Avisar o coordenador.
- **Grants antigos de `anon` em `audit_log`** (revisão SQL N8, fora do SQL desta frente): INSERT, SELECT, UPDATE, DELETE,
  TRUNCATE etc. A RLS `sofia access` barra o anon, então não é alcançável pelo PostgREST. Sugestão futura:
  `revoke all on public.audit_log from anon`.
- **Importação envia a prévia inteira à server action** (código N1): o limite padrão é 1 MB; planilha grande (aceita até
  2 MB e 2.000 linhas) pode estourar e mostrar "Nada foi gravado". Não estraga dado. Correção: enviar só as linhas a gravar
  (`linhasParaGravar`) ou configurar `serverActions.bodySizeLimit`.
- **Anexo de manutenção trocado deixa o arquivo antigo órfão** em `sofia-anexos` (código N2). Só custa armazenamento.
- **Importação aceita placa de carro inativo** (código N3): não causa dano, o inativo não aparece no painel. Se quiser
  barrar, virar aviso.
- **`concluirManutencaoAction` não chama `validarConclusao` no servidor** (código N5): a RPC valida tudo e devolve SOF01
  com a mensagem certa; o resultado é o mesmo.
- **Policies do bucket `sofia-anexos` deixavam qualquer logado enviar e ler** (código N6, pré-existente); o SQL de multa
  as restringe ao Sofia (seção seguinte). Antes disso, um não gestor subia arquivo solto em `manutencoes/<id>/`.

## 03/11/2026 — Frotas: terceira bateria, multa/fotos/checklist (branch `feat/frotas-multa-fotos-checklist`), deixado de propósito
Fontes: spec `docs/superpowers/specs/2026-11-03-frotas-multa-fotos-checklist-design.md` §7, revisão SQL
`docs/frotas/2026-11-03-revisao-sql-multa-avaria.md` (N1, N4–N9) e revisão de código
`docs/frotas/2026-11-03-revisao-codigo-multa-fotos.md` (menores 6–8).
- **Aceite digital do termo pelo motorista não existe** (spec §7.1, §2.3): motoristas não têm login no hub. Hoje é só o
  upload do termo em papel pelo gestor. Exige ligar `motoristas` a usuário do hub: decisão de cadastro, não de código.
- **Comprovante da indicação** (§7.2): só protocolo e data; não há coluna para o arquivo.
- **Multa contestada é final** (§7.3): reabrir não existe; correção por SQL com o contorno documentado.
- **Valor extra da multa em dobro não tem coluna** (§7.4): a tela usa `valor`.
- **Atomicidade do checklist** (§7.5; código 8): checklist, avarias e fotos são escritas separadas (mesmo padrão de antes).
  Falha no meio deixa um checklist sem avarias/fotos ("Checklist salvo, mas…"), que só o admin exclui.
- **Checklist sem KM e "feito por" ilegível** no histórico (§7.6): `created_by` é uuid de `auth.users`.
- **`avaria_origem_id` criado sem uso** (§7.7; SQL N6): quando passar a ser usado, excluir um checklist cuja avaria é
  origem de outra vai falhar, e `set null` bateria na guarda da avaria. Decidir junto com o uso.
- **Gestor pode gravar linha avulsa em `multa_etapas`** (§7.8), com o próprio e-mail: é registro; a etapa só muda pela trigger.
- **Teto de 30 fotos só no app** (§7.9), não no banco.
- **Alerta de multa no e-mail é "≤ 10 dias"**, não 10/5/2 (§7.10).
- **Arquivos órfãos no storage** (§7.11): 139 objetos em `checklist-fotos` para 126 linhas (uploads que falharam depois).
  Não apagar: são do mesmo tipo de prova.
- **Arquivos órfãos após exclusão de checklist/sinistro pelo admin:** a cascata apaga as linhas de foto, mas os objetos
  ficam no bucket (não há policy de DELETE de propósito). Os caminhos ficam em `audit_log.dados.fotos`, de onde dá para
  localizar e, se um dia valer, limpar por SQL.
- **N1 em aberto (decisão do João):** as 3 multas que já estavam `autorizado` em 03/11 viram etapa `autorizado`, e o
  gestor pode registrar `descontada` sem nova confirmação do admin. Se o João quiser a regra nova valendo para elas,
  trocar no backfill `then 'autorizado'` por `then 'solicitado'`.
- **Teste SQL não cobre "gestor insere multa já autorizada"** (SQL N4); a trigger cobre (INSERT exige `registrada`).
- **`sem_solicitacao → cobrada` em `atualizarAutorizacaoMultaAction` falha a partir de `autorizado`** (SQL N5): a
  "revogação" antiga do admin vira dois passos (`solicitado`, depois `cobrada`).
- **`avaria_origem_id` e exclusão:** ver acima (SQL N6).
- **`multa_etapas` some junto com a multa** (SQL N7, cascade): excluir multa já vai para `audit_log`, mas sem a trilha das
  etapas. Se importar, copiar a trilha em `audit_log.dados` de `excluir_multas_em_massa`.
- **Storage** (SQL N8): `service_role` continua podendo apagar objetos pela API (fora do alcance do usuário); só registrar.
- **Usuário comum altera `valor`/`descricao` antes do pedido de desconto** (SQL N9): aceitável, o valor congela em `solicitado`.
- **`marcarAvariaReparadaAction` diz sucesso sem atualizar linha** numa avaria já reparada, e não recusa data de reparo
  anterior ao checklist (código 6). Sem dano: o banco não deixa voltar nem alterar a baixa.
- **Qualquer usuário do Sofia insere avaria ou foto em checklist antigo pelo PostgREST** (código 7): as policies de INSERT
  são só `sofia_has_access`. Só acrescenta, não apaga nem altera prova. Travar por janela de tempo se o João quiser.
