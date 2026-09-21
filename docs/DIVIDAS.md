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
| A1 | **R22 — "última gravação vence".** Duas pessoas editando o mesmo bloco (Autorização/Identificação/Cronograma) da mesma obra ao mesmo tempo: a segunda apaga a primeira sem aviso na tela. | `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-ficha-editavel-2026-09-18.md:815-819`; comentário em `app/obras/obra/[id]/_actions.ts:616-619` | 18/09/2026, spec da ficha editável | "Aceitar nesta entrega. O histórico grava as duas [gravações], então a perda é visível e reversível à mão." Correção proposta (não feita): parâmetro `p_updated_at` na RPC | A edição concorrente perde dado silenciosamente na tela; só aparece para quem for conferir o histórico de alterações |
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

---

## (B) Dívidas silenciosas (sem decisão registrada)

Ninguém escreveu que ia deixar isso para depois — foi achado por leitura de código ou
está pendente sem dono declarado.

| # | O que foi deixado passar | Onde está | Quando foi decidido | Por que foi adiado | Consequência se ficar assim |
|---|---|---|---|---|---|
| B1 | **Três colunas de marco nunca são escritas por nenhum código de produção**: `marco_exec_fim`, `marco_relatorio` e `marco_faturou` — existem só como campo de tipo, aparecem no mapeamento do histórico e são lidas na ficha, mas nada as grava. Confirmado por `grep` hoje (20/09): a única ocorrência de atribuição está em testes, sempre com valor `null`. | `app/obras/_lib/tipos.ts:302-303,307`; leitura em `app/obras/obra/[id]/_ficha.tsx:204,214,331`; mapeamento em `app/obras/_lib/historico.ts:37-41,59-63,85-86,188-192`; achado original registrado em `ESTADO.md`, bloco "10/09/2026", item 1, e reafirmado em `ESTADO.md:364` para `marco_faturou` ("Task 5 [...] bloqueada até alguém gravar `marco_faturou`") | motivo não registrado — é achado de leitura de código, não decisão | A etapa "Execução em campo" (`campoFeito = !!obra.marco_exec_fim`) nunca aparece como concluída, e fica assim "para sempre" (texto do próprio achado de 10/09); "Relatório de entrega" e a Task 5 da regra de crítica (que depende de `marco_faturou`) têm o mesmo problema |
| B2 | **Pergunta 03 do cliente — "como calcula esse avanço %?" — segue sem resposta** desde 31/08/2026. | `ESTADO.md`, seções "Perguntas em aberto COM O CLIENTE" e "Pendências" (`- [ ] Responder a pergunta 03...`); texto pronto em `docs/cliente/2026-08-31-sistema-controle-de-obras/pergunta-03-como-calcula-o-avanco.md` | motivo não registrado — a única nota é "falta só o João mandar" | Hoje o avanço é digitado à mão sem regra: "a planilha tem `0.9` numa linha e `95` em outra querendo dizer a mesma coisa" (texto do próprio `ESTADO.md`) |
| B3 | **Nenhum marcador de código** (`TODO`, `FIXME`, `HACK`, `XXX`, "gambiarra", "por enquanto", "temporário", "workaround") **foi encontrado** em nenhum `.ts`/`.tsx` do hub (fora `node_modules`, `manfac-site`, `.next`, `.claude/worktrees`). | `grep` rodado nesta sessão sobre `app/`, `lib/`, `components/` e a raiz do repo — achado negativo, sem ocorrência | não se aplica | não se aplica | Achado que vale registrar por si: a dívida técnica deste projeto vive nos documentos de `docs/cliente/`, não em comentários de código |
| B4 | **`cadastrarMotivoRemarcacaoAction` — a mensagem específica de "motivo desativado" (item 5a da revisão de 20/09) não cobre o caminho de corrida do 23505.** O fix de 21/09 faz `procurarMotivo` recusar oferecer um motivo INATIVO como `jaExistia`. Mas no ramo de corrida (`error.code === '23505'`, duas pessoas cadastrando o mesmo nome ao mesmo tempo), a releitura (`relido`) só checa `relido.motivo` — se o motivo que "ganhou" a corrida for inativo, cai no `return { error: 'Erro ao cadastrar o motivo' }` genérico, não na mensagem que nomeia o motivo. | `app/obras/obra/[id]/_actions.ts`, função `cadastrarMotivoRemarcacaoAction`, bloco do `error.code === '23505'` | 21/09/2026, ao corrigir o item 5a | Corrida DENTRO de uma corrida (duas pessoas cadastrando o mesmo nome ao mesmo tempo, E esse nome já existir inativo) — combinação improvável, e o usuário ainda recebe um erro (não trava sem saída), só com mensagem genérica em vez da específica | Nenhuma — só a mensagem de erro é menos informativa nesse caso raríssimo |

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
