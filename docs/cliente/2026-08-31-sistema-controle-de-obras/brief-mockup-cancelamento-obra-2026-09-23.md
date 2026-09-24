# Brief — mockup do cancelamento de obra (23/09/2026)

Mockup: `mockup-cancelamento-obra-2026-09-23.html` (nesta pasta). **Não publicado** — quem publica é
a sessão principal. Sem campos de revisão: o feedback volta pelo chat/WhatsApp, por seção.

## O que foi pedido

Mockup interativo do cancelamento de obra no Controle de Obras, em 5 seções: (1) onde fica o botão
"Cancelar obra", separado dos Editar; (2) a janela de cancelar com motivo estruturado, observação
opcional, aviso e estados salvando/cancelada/erro; (3) a ficha da obra cancelada, com desfazer;
(4) a Base de obras; (5) diário e tarefas, antes/depois. Mais o levantamento de schema e dos pontos
de exclusão para a spec — sem implementar.

## Fontes

- `feedback-11-cancelamento-de-obra.md` — pedido de 10/09 e o esboço (etapa terminal, `cancelado_por`
  estruturado, reversível, sai de diário/tarefas, fica na base).
- `pergunta-07-cancelamento-e-pedido-de-compra.md` — respostas de 14/09: **1A** (qualquer pessoa com
  acesso), **2B** (obra executada não cancela), **3B** (no Field a OS continua ativa com status
  cancelado → cancelamento é manual aqui); **6C** (nome da etapa `aprovarOS`).
- `docs/onboarding-duda/02-FRENTES-DO-DUDA.md`, "A restrição de ordem" — cancelamento só começa depois
  da J4 mergeada; toca `_lib/tipos.ts`, `base/_regras.ts`, `obra/[id]/_actions.ts`, `diario/`, `tarefas/`.
- `docs/cliente/2026-09-23-pergunta-botoes-editar-cancelar-obra.md` — o cliente perguntou se os Editar
  cancelam; resposta: cancelar tem botão próprio.
- Código lido: `obra/[id]/page.tsx`, `_ficha.tsx`, `_etapa.tsx`, `_actions.ts` (mudarEtapaAction),
  `_lib/tipos.ts`, `_lib/historico.ts`, `base/_regras.ts`, `diario/page.tsx`, `diario/_actions.ts`,
  `tarefas/page.tsx`, `sincronizar/_sincronizacao.ts`, `sdd-sql-obras-v0.sql`, `sdd-sql-obras-historico.sql`.
- Base visual: `mockup-ajustes-ficha-2026-09-22.html` (CSS reaproveitado quase inteiro).

## Decisões de desenho tomadas sem o João (estão nas caixas "Decisão que tomei" do mockup)

1. **Botão dentro do bloco "Ciclo de vida"**, numa faixa "Encerrar sem executar" abaixo do seletor de
   etapa — não no cabeçalho, não perto dos Editar. Também na **Triagem** (etapa `definir`), porque é lá
   que cai a OS aberta por engano.
2. **Corte do 2B = `posCampo`**: cancela em `definir`, `levantamento`, `andamento`, `paralisado`; não
   cancela de `relatorio` em diante.
3. **Obra executada: botão ausente + uma linha de explicação** (não botão desabilitado).
4. **"Cancelada" não entra no select "Mudar a etapa"** — só se chega pelo botão, que exige motivo.
5. **Obra cancelada é só leitura**: sem Editar nos blocos, sem seletor de etapa; só "Desfazer".
6. **Desfazer volta para a etapa exata e não zera `desde_etapa`**; cancelada na triagem volta para a Triagem.
7. **Base: "Todas" esconde canceladas**, com aviso "N canceladas fora desta lista · ver"; grupo novo
   "Canceladas" no filtro (todas / pelo Cliente / pela Manfac); **fora do Kanban**; "Dias em aberto" = "—".
8. **Indicador "canceladas no mês (Cliente · Manfac)"** marcado como proposta, não pedido.
9. **Tarefa aberta de obra cancelada some da lista** de Tarefas (fica na ficha); volta se desfizer.
10. **Observação opcional** (a instrução desta frente pediu assim; o esboço de 10/09 dizia texto obrigatório).

## Divergências fonte × código

- **Nome de `aprovarOS`**: o código ainda diz "Pendente fechamento" em `_lib/tipos.ts:165`, **e também
  cravado** em `_ficha.tsx:244` (passo pulado) e `_ficha.tsx:553,570` (texto "Caminho" e rodapé da
  esteira). O mockup já usa "Executado - pendente aprovação OS". Quem renomear precisa pegar os três
  lugares, não só o `CICLO`.
- **Troca de etapa não gera linha de histórico da etapa.** `mudarEtapaAction` (`_actions.ts:345-406`)
  grava `etapa` por `update` direto (não pela RPC) e só registra no `obras_historico` os **marcos**
  (`linhasDeAlteracao(antes, depois, 'Esteira')`, `:389`, onde `antes/depois` só têm marcos). O
  feedback 11 exige que cancelamento e reversão fiquem no histórico → o cancelamento deve passar pela
  RPC `obras_aplicar_alteracao` com linha explícita.
- **`faseDe` cai em `'campo'` para etapa desconhecida** (`tipos.ts:411-413`). Se `cancelado` entrar no
  CHECK sem entrar em `tipos.ts`, a obra cancelada vira "Executando": aparece na coluna do Kanban, pede
  foto (`pedeFoto`), pode ficar crítica (`critico` só exclui `encerrada`). `tipos.ts` precisa tratar
  `cancelado` explicitamente.
- **`mudarEtapaAction` não olha a etapa atual**: sem guarda nova, o seletor tiraria uma obra de
  `cancelado` sem passar pelo desfazer (e sem limpar os campos de cancelamento). E se `cancelado` for
  para `CICLO`, ele aparece no `<select>` de `_etapa.tsx:63` e cancela sem motivo.
- **Feedback 11 esboça "alcançável de qualquer etapa"**; o 2B do cliente restringe a antes do fim da
  execução em campo. O mockup segue o 2B.

## Schema — o que o cancelamento precisa

`obras_obra.etapa` tem CHECK inline em `sdd-sql-obras-v0.sql:84-86` (nome gerado pelo Postgres,
provavelmente `obras_obra_etapa_check` — **conferir em produção** antes de dropar).

Colunas novas:

| Coluna | Tipo | Por quê |
|---|---|---|
| `cancelado_por` | text, `cliente`/`manfac` | o motivo estruturado pedido pelo cliente |
| `cancelado_obs` | text, nullable | observação livre (opcional no mockup) |
| `cancelado_em` | timestamptz | quando — o selo mostra |
| `cancelado_quem` | text | e-mail de quem registrou (como `etapa_por`) |
| `cancelado_etapa_anterior` | text | para o "Desfazer" voltar à etapa exata — sem ela não há como |

SQL mínimo proposto (**não aplicado, não há arquivo .sql**):

```sql
begin;
alter table public.obras_obra drop constraint if exists obras_obra_etapa_check; -- conferir o nome real
alter table public.obras_obra add constraint obras_obra_etapa_check
  check (etapa in ('definir','levantamento','andamento','paralisado',
                   'relatorio','aprovarOS','fecharOS','pendFat','faturado','cancelado'));

alter table public.obras_obra
  add column if not exists cancelado_por text,
  add column if not exists cancelado_obs text,
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_quem text,
  add column if not exists cancelado_etapa_anterior text;

-- Coerência: cancelada ⇔ tem autoria e etapa anterior; a etapa anterior é pré-campo (2B no banco).
alter table public.obras_obra add constraint obras_obra_cancelamento_coerente check (
  (etapa = 'cancelado'
     and cancelado_por in ('cliente','manfac')
     and cancelado_em is not null and cancelado_quem is not null
     and cancelado_etapa_anterior in ('definir','levantamento','andamento','paralisado'))
  or
  (etapa <> 'cancelado'
     and cancelado_por is null and cancelado_obs is null and cancelado_em is null
     and cancelado_quem is null and cancelado_etapa_anterior is null)
);

-- Histórico: bloco novo; o campo 'etapa' já é aceito pelo CHECK de campo.
alter table public.obras_historico drop constraint if exists obras_historico_bloco_check;
alter table public.obras_historico add constraint obras_historico_bloco_check
  check (bloco in ('Triagem','Autorização','Identificação','Cronograma','Esteira','Cancelamento'));
commit;
```

E a RPC `obras_aplicar_alteracao` (`sdd-sql-obras-historico.sql`) precisa de `create or replace` com as
5 colunas novas em **três** lugares: `v_colunas_validas`, a lista do `set (...)` e a do `select` — senão
ela recusa a chave (B1, `raise exception`). Com isso, cancelar = uma chamada atômica da RPC com
`p_campos = {etapa:'cancelado', cancelado_*…}` e `p_linhas = [{bloco:'Cancelamento', campo:'etapa',
de:<etapa anterior>, para:'cancelado', motivo:'Cancelado pelo Cliente — <obs>'}]`. Desfazer = mesma RPC
com os cinco campos `null`, `etapa` = anterior, e linha `de:'cancelado' para:<anterior>`. O CHECK de
`campo` do histórico **não** precisa mudar: o motivo vai na coluna `motivo` da linha.

Pontos a decidir na spec: o CHECK de coerência é defesa de dado de cliente (território 3 do AGENTS.md),
por isso está proposto; se o João achar excesso, o mínimo absoluto é o CHECK de etapa + as 5 colunas +
a RPC. Alternativa descartada: não mudar `etapa` e usar só `cancelado_em` como flag — evita mexer no
CHECK, mas obriga todo filtro por etapa (diário, base, kpis) a lembrar da flag; com `etapa='cancelado'`
o diário sai sozinho.

A sincronização **não sobrescreve** a etapa de obra existente (`_sincronizacao.ts:323` só grava `etapa`
no insert) — o cancelamento não é desfeito pelo cron.

## Onde diário, tarefas e base selecionam obras

| Lugar | O que faz hoje | Precisa |
|---|---|---|
| `diario/page.tsx:31,62` (e `:135`, lista de responsáveis) | `.in('etapa', ETAPAS_FILA)` com levantamento/andamento/paralisado | **nada** — cancelada sai sozinha |
| `diario/page.tsx:96-101` | tarefas/respostas por `obra_id` das obras da fila | nada (já filtradas) |
| `diario/_actions.ts:80-84` | responde o diário lendo a obra sem olhar etapa | guarda: recusar se `etapa = 'cancelado'` (aba aberta antiga) — improvável, candidato a `DIVIDAS.md` |
| `tarefas/page.tsx:42-46` | lista **todas** as `obras_tarefa` (limit 500), sem filtro de obra | **excluir** tarefas de obra cancelada (buscar `etapa` em `:54-57` e filtrar, ou join) |
| `base/page.tsx:36` | `select('*')` de todas as obras | nada na consulta; a regra fica em `_regras.ts` |
| `base/_regras.ts:170-200` `filtrar` | "todas" = sem filtro | "todas" exclui `cancelado`; opções `cancelado`, `cancelado:cliente`, `cancelado:manfac` |
| `base/_regras.ts:137-158` `opcoesEtapa` | grupos por fase a partir de `CICLO` | grupo "Canceladas" à parte |
| `base/_regras.ts:40-50` `COR_ETAPA` | `Record<Etapa,…>` | cor de `cancelado` (tsc obriga) |
| `base/_regras.ts:321+` `kpisDaBase` | `velhas`/`estouradas` usam `!posCampo`; `semOS` usa `!encerrada` | excluir `cancelado` de todos — o caminho curto é `encerrada()` incluir `cancelado` |
| `base/_kanban.tsx:90` | coluna por `faseDe` | excluir `cancelado` |
| `_lib/tipos.ts:127-136,159-169,411-424` | `Etapa`, `CICLO`, `faseDe`, `encerrada` | `cancelado` no tipo `Etapa`, **fora** do `CICLO` (senão entra no seletor); `faseDe`/`encerrada`/`sev`/`critico`/`semCobertura`/`pedeFoto` tratando `cancelado` |
| `obra/[id]/_actions.ts:345` `mudarEtapaAction` | aceita qualquer `ETAPAS_VALIDAS` | recusar destino `cancelado` e origem `cancelado` |
| `obra/[id]/page.tsx:186` | `definir` → Triagem | botão de cancelar também na `_triagem.tsx` |

## Estado da aprovação — 23/09/2026

- Publicado em https://claude.ai/artifact/QiMcQupmStD4svv5TDsKvB.
- **Quem aprova: o cliente.** Resposta do João: "o cliente ainda nao viu e aprovou, vamos ter que
  esperar". Spec, plano e código esperam a aprovação dele. Quando vier, fica com subagente
  (decisão do João: "mantenha o cancelamento como subagente").
- **Observação do cancelamento: opcional** (decisão do João, 23/09), como está no mockup.

## Aprovado — 23/09/2026

Mensagem do João no chat (literal): "o mockup cancelaento de obra está aprovado". Aprovado como
está, com a observação opcional (decisão anterior do mesmo dia). Próximo passo: spec → plano (com o
SQL final da migration para o João aprovar) → código por subagente → revisão → migration → deploy.

## Migration aprovada — 23/09/2026

O João aprovou a migration (`sdd-sql-obras-cancelamento.sql`) e decidiu **manter a trigger** de
transição (a trava extra). Revisão independente do SQL: "pode aplicar", zero bloqueantes
(`review-sql-cancelamento-2026-09-23.md`); RPC nova conferida contra a definição lida de produção.
