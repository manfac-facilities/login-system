# Mapa do Diário e das Tarefas (Gestão de Obras) — 15/10/2026

Levantamento SÓ DE LEITURA do código. Nada foi alterado, nada foi lido do banco de produção (o
schema vem dos `sdd-sql-obras-*.sql` da raiz; o que foi aplicado em produção NÃO foi conferido aqui).
Origem do pedido: `docs/cliente/2026-10-14-reuniao-jose-guilherme.md` (linhas 30-38 e 70) + complemento do
João ("trava temporária").

Caminhos relativos a `app/obras/`, salvo quando indicado.

---

## 1. Diário — quais obras aparecem e o que acontece se não responder

### Regra de entrada na fila
- `diario/page.tsx:32` — `ETAPAS_FILA = ['levantamento','andamento','paralisado']`. É o ÚNICO critério de
  "estar na fila". Não há filtro por data, por pausa, nem por tarefa existente.
- `diario/page.tsx:84-88` — consulta `obras_obra` com `select('*')`, `.in('etapa', ETAPAS_FILA)` e, se houver
  `filtroPcm`, `.eq('pcm', filtroPcm)`.
- Por analista: `diario/page.tsx:81` — `filtroPcm = admin ? (analista || '') : minhaChave`. Não-admin só vê obras
  onde `obras_obra.pcm` = sua chave (`resolverChave`, `diario/_pessoa.ts:40-62`: `obras_pessoa.email`, senão a
  convenção do e-mail `yuri.x@` -> `YURI`). Admin vê todas, com seletor `?analista=` (`page.tsx:151-155`).
- Sem chave e não-admin: `SemPermissao` (`page.tsx:80`, falha fechada). Não-admin sem nenhuma obra: `page.tsx:97`.
- Equipe NÃO entra na regra de fila (só no destino da tarefa de foto, `_lib/tipos.ts:826`).
- Etapa `definir` fica fora de propósito (`page.tsx:13-16`); pós-campo e `cancelado` também.
- Respostas de hoje: `page.tsx:111-122` (`obras_diario` com `data = hoje`; `obras_tarefa` com `aberta = hoje`).
- Ordem da fila: `diario/_cartoes.tsx:67-68` — não respondidas, por `diasAlerta` decrescente.

### Resposta
- `diario/_actions.ts:64` `salvarDiarioAction`. Única trava: "não andou" exige motivo de `BLOQUEIOS` (`:72-78`).
  Upsert em `obras_diario` por `(obra_id,data)` (`:106-118`), depois `recalcularContadores` (`:121`, `:284-301`) e
  `abrirTarefas` (`:123`, `:154-220`).
- `BLOQUEIOS` (`_lib/tipos.ts:215-222`): Clima, Cliente / loja, Disponibilidade de equipe, Contratação de prestador,
  Falta de material, Sem bloqueio. `ITENS` (`:228`): Não faltou, Material, Ferramenta, Equipe, Documento / ART, Outro.
- Contadores gravados em `obras_obra`: `nao_andou_seguidos`, `bloqueada_dias`, `bloqueio`, via
  `contadoresDoDiario` (`tipos.ts:906+`), recalculados do histórico (60 últimos registros). "Seguidos" conta
  REGISTROS, não dias de calendário.
- Desfazer: RPC `obras_desfazer_diario` (`sdd-sql-obras-desfazer-diario-atomico.sql:15-30`) apaga
  `obras_tarefa` com `aberta = p_dia and situacao = 'aberta'` da obra (qualquer item) e o diário do dia.

### O que acontece se a obra NÃO for respondida
- **Nada é cobrado nem criado.** Não existe job que gere tarefa por falta de resposta. Tarefa só nasce quando se
  SALVA o diário (`diario/_actions.ts:11-13`). Não responder = a obra continua na lista.
- Cor/alerta: nenhum específico por "não respondeu". As cores (`sev()`, `tipos.ts:734-745`; `COR_SEV` `:749`) vêm de
  crítico/atraso/etapa, não da resposta do diário. `levantamento` tem token próprio (azul `#5aa9f0`).
- Contagem: `painel/_calculos.ts:709` `ETAPAS_FILA_DIARIO` (cópia da constante do diário, com comentário apontando
  para `diario/page.tsx`); `ritmoDe` `:726-745` -> `esperados = fila.size`, `responderam`, `naoAndou`, `comFoto`,
  `abertas`, `vencidas`, `respondidas7`.
- Painel: `painel/_painel.tsx:826-841` ("Responderam X/Y", "N ainda aguardam resposta").
- E-mail diário: `app/api/obras/relatorio-diario/_imagem.tsx:981-992` (mesmo "Responderam X/Y ... ainda aguardam
  resposta"); dados vêm de `montarPainel` (`route.ts:129`) com `lerEntradaDoPainel` (`painel/_leitura.ts:27-61`).
  Com 32 obras na fila o e-mail mostra "0/32" enquanto ninguém responde. Esse é o denominador que uma pausa precisa
  tirar, senão o relatório continua dizendo "N aguardam".
- Fila zerada: tela de sucesso (`_cartoes.tsx:183-215`), "As N obras foram respondidas".

---

## 2. Tarefas

### De onde nascem
- **Só do diário.** `tarefas/page.tsx:62-64`: "NINGUÉM DIGITA TAREFA AQUI". Único insert: `diario/_actions.ts:217`
  (`abrirTarefas`). Duas situações: item que faltou (Material -> ROBERTA; Ferramenta/Equipe/Documento/Outro -> YURI,
  `tipos.ts:806-815`) ou foto que não veio em obra de fase `campo` (`pedeFoto`, `tipos.ts:510`; dono = equipe da
  obra, `CHAVE_EQUIPE`).
- **Não existe criação manual.** `tarefas/_actions.ts` só tem `responderTarefaAction`. O comentário em
  `tarefas/_actions.ts:9-11` registra que a cobrança automática e o WhatsApp são v1.
- **Não existe data agendada.** Só `aberta` (data de abertura), `hora_aberta` e `prazo`. `prazoPadrao`
  (`tipos.ts:846`): mesmo dia, ou dia seguinte se depois das 18h.

### Tabela `obras_tarefa` (`sdd-sql-obras-v0.sql:164-177`); nenhum `alter` posterior nos `sdd-sql-obras-*.sql`
`id uuid pk`, `obra_id uuid not null -> obras_obra on delete cascade`, `item text not null`, `dono text`,
`aberta date not null default current_date`, `hora_aberta time`, `prazo date`, `registrou text`,
`situacao text not null default 'aberta' check in ('aberta','respondida')`, `resposta_em date`,
`resposta_hora time`, `resumo text`, `created_at`. Índices: dono, situacao, obra_id (`:250-252`). RLS "obras access"
via `obras_has_access()` (`:356-358`). Tipo TS: `TarefaRow` (`_lib/tipos.ts:382-395`).
- Não há coluna de título/descrição livre, de origem, nem de data de execução. `item` é texto livre no banco, mas o
  código só conhece as chaves de `ROTA_FALTA`.
- Dono: `dono` = chave de `obras_pessoa` (`YURI`, `ROBERTA`...) ou `EQ_<EQUIPE>` (`chaveDaEquipe`, `tipos.ts:826`).
  A tela agrupa por dono.

### Como fecha / "vencida"
- Fecha por `responderTarefaAction` (`tarefas/_actions.ts:24-58`): exige resumo de uma linha; `update` com
  `.eq('situacao','aberta')`; grava `situacao='respondida'`, `resposta_em/hora`, `resumo`. Qualquer usuário com acesso
  ao módulo `obras` pode responder qualquer tarefa (não checa dono).
- "Vencida" nunca é gravada: `sitTarefa` (`tipos.ts:856-863`) = aberta e `prazo < hoje`. Só pinta de vermelho
  (`tarefas/_lista.tsx:84-86, 102`); **nada escala** (`tarefas/_actions.ts:13-14`).
- Visibilidade: aberta de obra cancelada some (`tarefaVisivelNaLista`, `tipos.ts:479`; `tarefas/page.tsx:150`).
- Painel/e-mail contam: `abertas` (inclui vencidas), `vencidas`, `respondidas7` (`_calculos.ts:737-744`).
- Ficha da obra lista "Tarefas que as faltas geraram" (`obra/[id]/_ficha.tsx:992-1030`; dados em
  `obra/[id]/page.tsx:130`).

### ARMADILHA para tarefa manual (vale para qualquer desenho)
`abrirTarefas` (`diario/_actions.ts:180-186`) APAGA toda tarefa da obra com `aberta = hoje` e `situacao <> 'respondida'`
cujo `item` não esteja no que a resposta de hoje "quer". A RPC de desfazer faz o mesmo. Hoje isso é correto porque só
o diário cria tarefa. Uma tarefa manual criada HOJE para a obra seria apagada quando o analista salvar ou corrigir o
diário dessa obra no mesmo dia (e no "desfazer"). Tarefa manual precisa de uma marca que o diário não toque (coluna de
origem), senão a regra de apagar "órfãs" a destrói.

---

## 3. Pausa / parada / aguardando / remarcação — o que já existe

- **Não existe pausa do diário.** Nenhum campo "pausada até", "aguardando" ou "trava". Nada na fila olha data.
- Etapas (`_lib/tipos.ts:128-142`, `CICLO` `:167-177`): `definir` (Aguardando definição), `levantamento`
  (Levantamento), `andamento`, `paralisado`, `relatorio`, `aprovarOS`, `fecharOS`, `pendFat`, `faturado`; mais
  `cancelado` (saída lateral; CHECK recriado em `sdd-sql-obras-cancelamento.sql:161`). Fases (`:146-153`): antes /
  campo / fechamento / faturamento. `levantamento` é fase `antes`; `andamento` e `paralisado` são fase `campo`.
- Onde "levantamento" aparece: `tipos.ts:130,169,210,731,744,757` (etapa, CICLO, PODE_CANCELAR, token `Sev`, cor);
  `diario/page.tsx:32`; `painel/_calculos.ts:709`; `base/_regras.ts:43` (cor); `obra/[id]/_actions.ts:692-697`
  (liberar da Triagem põe `etapa:'levantamento'`, `pendencia:'Finalizar levantamento, confirmar material e programar a
  equipe'`, `prox_acao:'Concluir levantamento'`); `obra/[id]/_etapa.tsx` (troca manual). A obra nasce em `definir`
  (`sincronizar/_sincronizacao.ts:97,393`) e vira `levantamento` na liberação da Triagem.
- Troca de etapa manual: `mudarEtapaAction` (`obra/[id]/_actions.ts:348`), atômica com marcos e histórico.
- `paralisado` é só etapa, e ainda ENTRA no diário. `travado()` (`tipos.ts:668`): 3+ dias no mesmo bloqueio.
- Remarcação: **só do início planejado.** `obras_remarcacao` (`sdd-sql-obras-v0.sql`; colunas `data,de,para,motivo`,
  mais `detalhe` e `registrado_por` de `sdd-sql-obras-motivos-remarcacao.sql`); lista `obras_motivo_remarcacao`
  semeada com os mesmos 6 motivos do diário, incluindo "Outro" (`:164-171`). UI: `obra/[id]/_dialogo-remarcar.tsx`;
  actions `salvarCronogramaAction` (`obra/[id]/_actions.ts:877`) e `cadastrarMotivoRemarcacaoAction` (`:1075`). Não
  afeta o diário.
- Campos de data em `obras_obra` (v0): `aprovacao`, `inicio_plan`, `inicio_real`, `duracao`, `fim_real`,
  `desde_etapa`, marcos de fechamento, e **`pend_prazo date`** + `pend_resp`, `pendencia`, `prox_acao`. Esses últimos
  são exibidos (`diario/_cartao.tsx:238`, `base/_exportar.ts:108-109`, `obra/[id]/_ficha.tsx:1045-1046`) mas NENHUMA
  regra de fila os lê. São o parente mais próximo de "levantamento até o dia X", hoje só informativos. `inicio_plan`
  também não filtra o diário (obra em levantamento com início planejado no futuro aparece igual).
- Auditoria: `obras_historico` + RPC `obras_aplicar_alteracao` (`sdd-sql-obras-historico.sql`); o CHECK de `bloco` foi
  estendido para o cancelamento (`sdd-sql-obras-cancelamento.sql:267`). Padrão para gravar mudança com rastro.

---

## 4. Quem consome a lista/contagem do diário (o que uma pausa teria que respeitar)

| Consumidor | Onde | Usa |
|---|---|---|
| Tela do diário | `diario/page.tsx:32,84-88` | `ETAPAS_FILA` + pcm |
| Placar "Diário fechado" | `diario/_cartoes.tsx:183-215` | obras da fila (total/andaram/paradas) |
| Painel gerencial "Ritmo" | `painel/_calculos.ts:709,726-745` -> `painel/_painel.tsx:826-841` | `ETAPAS_FILA_DIARIO` (CÓPIA da constante) |
| E-mail das 08:01 | `app/api/obras/relatorio-diario/_imagem.tsx:981-992` <- `route.ts:129` `montarPainel` | mesmo `ritmoDe` |
| "N dias sem andar" / "mesmo bloqueio há N dias" | gravados por `diario/_actions.ts:284`; lidos em `diario/_cartao.tsx:84-91,321-322`, `base/_table.tsx:52`, `tipos.ts:668,785`, ficha | independem da fila |
| Dias parados por obra no painel | `painel/_calculos.ts:616` (`paradasDe`), `:506` (`diasTrabalhados`) | `obras_diario` real, não a fila |
| Tarefas abertas/vencidas | `_calculos.ts:737-738`, `tarefas/_lista.tsx:102` | `obras_tarefa` |

A regra de fila está duplicada em dois lugares (`diario/page.tsx:32` e `painel/_calculos.ts:709`). Qualquer pausa
precisa entrar nos dois (o ideal é uma função única em `_lib/tipos.ts`, mas isso é refatoração a decidir). Testes que
fixam a regra: `diario/__tests__/page.test.tsx`, `__tests__/diario.test.ts`, `painel/__tests__/leitura.test.ts`,
`app/api/obras/relatorio-diario/__tests__/route.test.ts`, `tarefas/__tests__/page.test.tsx`.

---

## 5. Dois desenhos mínimos (sem escolher)

Nos dois, a pausa é CALCULADA contra `hoje` (padrão do módulo, como `vencida`): pausada = `data >= hoje`. Ao passar
a data a obra volta sozinha à fila, sem cron.

### Desenho A — "a tarefa é a pausa" (tarefa manual com data que esconde a obra)
- **Migration: sim, em `obras_tarefa`:** `agendada_para date`; `tira_do_diario boolean not null default false`;
  `origem text not null default 'diario' check (origem in ('diario','manual'))`; `titulo`/`descricao text` (hoje só
  há `item`); opcional `criada_por`. Índice parcial em `(obra_id)` onde `tira_do_diario and situacao='aberta'`.
  Alterar também a RPC `obras_desfazer_diario` (para não apagar `origem='manual'`). RLS já é `for all` por
  `obras_has_access()` (conferir em produção).
- **Regra:** obra sai do diário se existe tarefa `aberta`, `tira_do_diario` e `agendada_para >= hoje`. Quando a
  tarefa é respondida (levantamento feito) ou a data passa, a obra volta.
- **Arquivos que mudariam:** novo `sdd-sql-obras-<nome>.sql`; `_lib/tipos.ts` (`TarefaRow`, função da fila);
  `tarefas/_actions.ts` (nova `criarTarefaAction`); `tarefas/_lista.tsx` + novo formulário `tarefas/_nova.tsx`;
  `diario/page.tsx` (ler as tarefas-pausa e filtrar); `diario/_actions.ts:180-186` (não apagar manuais);
  `painel/_leitura.ts:44` (incluir as colunas novas) e `painel/_calculos.ts:709-731`; `sitTarefa` (`tipos.ts:856`)
  para decidir se tarefa agendada para o futuro conta como vencida (qual é o `prazo`); testes.
- **Prós:** é o que o José Guilherme descreveu ("crio uma tarefa de levantamento no dia tal e a obra sai do
  diário"); a aba Tarefas passa a ter uso real. **Contras:** mais peças (formulário, dono, fechamento); risco da
  armadilha de apagar tarefa manual; a fila passa a depender da vida de uma tarefa (fechar ou apagar muda a fila).

### Desenho B — "pausa na obra" (campos em `obras_obra`; tarefa fica de fora nesta versão)
- **Migration: sim, em `obras_obra`:** `diario_pausado_ate date`, `diario_pausa_motivo text`, `diario_pausa_por text`,
  `diario_pausa_em timestamptz`; CHECK de coerência (data e motivo juntos). Para rastro: gravar via
  `obras_aplicar_alteracao`/`obras_historico` (o CHECK de `bloco` precisa aceitar o novo valor, como fez
  `sdd-sql-obras-cancelamento.sql:267`). `obras_tarefa` não muda.
- **Regra:** obra sai da fila se `diario_pausado_ate >= hoje`.
- **Arquivos que mudariam:** novo `sdd-sql-obras-<nome>.sql`; `_lib/tipos.ts` (`ObraRow` e função da fila);
  `diario/page.tsx:84-88` (filtro; pode ir no banco com `.or('diario_pausado_ate.is.null,diario_pausado_ate.lt.<hoje>')`);
  `painel/_calculos.ts:709-731`; `obra/[id]/_actions.ts` (nova action pausar/retomar com histórico);
  `obra/[id]/_ficha.tsx` (botão e rótulo "Diário pausado até DD/MM — motivo"); opcional etiqueta/filtro na base
  (`base/_etiquetas.tsx`); testes.
- **Prós:** menor, não mexe em tarefas, sem a armadilha de apagar, atende literalmente a "trava temporária" do João.
  **Contras:** não responde ao ponto "ninguém faz nada em Tarefas"; data e motivo ficam na obra, não numa tarefa
  que alguém responde.

### Comum aos dois
Nenhum toca em RLS de `hub_system_access`/`hub_user_roles`. Ambos escrevem dado de cliente (`obras_obra` /
`obras_tarefa`), então seguir a receita das actions do módulo (auth + `hasSystemAccess` + `{error}`) e, no B, RPC com
histórico. Migration é manual e precisa estar aplicada ANTES do deploy do código (mudança de schema: parar e
perguntar ao João, conforme AGENTS.md).

---

## 6. Decisões em aberto (perguntas curtas para o dono do produto)

1. A pausa é só "tira do diário", ou também precisa de dono e de um "feito" (virar tarefa de verdade)?
2. Quem pode pausar: o analista dono da obra (`pcm`), qualquer um com acesso, só admin?
3. Quais etapas podem ser pausadas: só `levantamento`, ou também `andamento` e `paralisado`?
4. A pausa exige motivo? Lista fixa (os 6 de `BLOQUEIOS`/remarcação) ou texto livre?
5. Data obrigatória? Há máximo de dias? Passou a data sem ninguém fazer nada, a obra volta sozinha ao diário?
6. Na data marcada a obra volta à fila no próprio dia ou no dia seguinte?
7. Se alguém responder o diário de uma obra pausada, vale? (hoje nada impediria; seria só escondida da lista.)
8. A obra pausada sai do denominador "Responderam X/Y" no painel e no e-mail das 08:01? Aparece uma linha "N obras
   pausadas"?
9. Os contadores "N dias sem andar" e "mesmo bloqueio há N dias" congelam durante a pausa ou continuam?
10. Quem é o dono da tarefa de levantamento e precisa de aviso (WhatsApp/e-mail) no dia?
11. Tarefa manual avulsa (sem pausa) também deve poder ser criada na aba Tarefas, para qualquer obra e etapa?
12. Se o levantamento adiantar ou atrasar, como se muda a data, e isso entra no histórico?
13. A pausa deve aparecer na base de obras (etiqueta/filtro), na ficha e no Kanban?
14. Unificar a regra da fila numa função única (hoje duplicada em 2 lugares)? É refatoração além do pedido.
