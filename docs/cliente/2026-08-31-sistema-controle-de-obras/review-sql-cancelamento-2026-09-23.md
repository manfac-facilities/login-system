# Revisão independente: `sdd-sql-obras-cancelamento.sql` (23/09/2026)

Revisor: subagente independente, que não escreveu a migration. Não acessei o banco. Comparei com
o estado de produção que o coordenador leu hoje (`prod-rpc.json`, `prod-checks.json`,
`prod-triggers.json`) e com os pontos do código que escrevem em `app/obras/**`.

## Veredito: **APLICAR**. Nenhum bloqueante.

---

## 1. A RPC é a de produção mais as 5 colunas?

**Sim.** Tirei os comentários dos três corpos (produção, `sdd-sql-obras-historico.sql` §3 e o
arquivo novo) e fiz o diff linha a linha:

- **Produção contra `historico.sql`:** idênticos. Ninguém mexeu na RPC à mão.
- **Produção contra o arquivo novo:** a diferença está só em 3 pontos: `v_colunas_validas`, o
  `set (...)` e o `select`. Em cada um entram as mesmas 5 colunas, no fim e na mesma ordem.
  A ordem casa entre o `set` e o `select`.
- **Cabeçalho:**
  - A assinatura continua `(uuid, jsonb, jsonb)`, então o `create or replace` substitui a função
    e não cria uma nova.
  - O retorno continua `public.obras_obra`.
  - O `search_path` continua `pg_catalog, public`.
  - A produção não declara `SECURITY` e o arquivo novo declara `security invoker`. Dá no mesmo,
    porque invoker já é o padrão.
- **Guarda de acesso:** `if not public.obras_has_access()` ficou igual. O comentário do arquivo diz
  que ela é baseada em `exists()`, mas não conferi o corpo dessa função (ver "Não verificado").
- **B1, `not found` e insert do histórico:** idênticos.
- **Grants:** `revoke` de `public`/`anon` e `grant` para `authenticated`, iguais aos de
  `historico.sql:240-241`. O `create or replace` preserva a ACL que já existe.
- `sdd-sql-obras-motivos-remarcacao.sql` **não** altera esta RPC, só a chama (linha 416). A
  chamada continua funcionando.

## 2. CHECKs

- `obras_obra_etapa_check` e `obras_historico_bloco_check` têm exatamente esses nomes em
  produção, e as listas antigas batem com `prod-checks.json`. O drop e o add mantêm os valores
  antigos e só acrescentam `'cancelado'` / `'Cancelamento'`. Nenhum outro CHECK de `obras_obra`
  cita `'definir'`, então a seção 0 passa.
- **Coerência com os dados de hoje:**
  - `etapa` é `not null` (`v0.sql:84`), então o `coalesce(..., false)` nunca bloqueia uma linha
    por etapa NULL.
  - `add column` sem default deixa as linhas existentes em NULL.
  - Nenhuma linha tem `'cancelado'`, porque o CHECK antigo recusava esse valor.
  - Resultado: todas as linhas atuais caem no ramo "não cancelada, 5 nulas" e o `add constraint`
    valida.
- **Inserts que já existem:** o sync do Field (`_sincronizacao.ts:317`) e a importação inserem com
  a etapa inicial e sem as colunas `cancelado_*`, então passam.
- A armadilha do NULL está fechada: há `is not null` antes de cada `in` e `coalesce(..., false)`
  por fora.

## 3. Trigger

- **Quando dispara:** `BEFORE UPDATE OF etapa, cancelado_*`. Não dispara em insert. Todas as
  comparações usam `is distinct from`, então não há guarda que falha aberto com NULL.
- **Escritas que já existem hoje.** Enquanto nenhuma obra estiver cancelada, os três ramos da
  trigger são falsos para qualquer update que não grave `'cancelado'`:
  - **RPC** (`historico.ts:238`, `gravarComHistorico`, `obras_remarcar_inicio`): o `set` inclui
    sempre `etapa`, então a trigger dispara em toda chamada. Numa obra não cancelada ela não faz
    nada. Numa obra cancelada ela deixa passar edições que não tocam nos dados do cancelamento,
    porque o `jsonb_populate_record(o, ...)` preserva o valor quando a chave não vem.
  - **`mudarEtapaAction`** (`_actions.ts:398`): update direto de `etapa`. Nenhum destino atual é
    `'cancelado'`. Numa obra já cancelada, a gravação é recusada, e isso é o que se quer (a spec
    põe a guarda também na action).
  - **`liberarObraAction`** (`:576`): a gravação só vale para obras em `.eq('etapa','definir')`, e
    esse caminho é igual ao da troca de etapa comum.
  - **Diário** (`contadoresDoDiario`, `diario/_actions.ts:298`), **sync do Field**
    (`_execucao.ts:244/261`) e **importação** (`camposParaAtualizar` descarta `etapa`,
    `importacao.ts:684`): nenhum grava `etapa` nem `cancelado_*`, então a trigger nem dispara.
  - **`obras_desfazer_diario`:** não escreve em `obras_obra.etapa`.
- **Convivência com `obras_obra_touch_updated_at`:** as duas são BEFORE e rodam em ordem
  alfabética, primeiro `touch` e depois `transicao`. Uma não lê o que a outra escreve.

## 4. Idempotência, passos e teste

- **Reaplicar o arquivo inteiro funciona:**
  - A seção 0 continua achando os nomes.
  - O drop/add de etapa e de bloco revalida sem problema, porque os valores novos já estão nas
    listas.
  - As colunas usam `if not exists`.
  - Coerência e trigger usam `drop if exists`.
  - A RPC usa `create or replace`.
  - Mesmo com obras já canceladas, o re-add valida, porque elas são coerentes.
- **PASSO 0 (a):** o filtro `ilike '%etapa%'` devolve 1 linha na primeira vez e 2 na reaplicação,
  como o arquivo descreve.
- **PASSO 2:**
  - A verificação 7 conta exatamente 15 ocorrências (3 listas × 5), porque não há comentário com
    esses nomes dentro do corpo.
  - A verificação 2 exclui a coerência pelo nome.
  - Um subselect NULL cai em `*** FALHOU ***`, ou seja, a verificação falha fechado.
- **PASSO 3:**
  - O `raise` final é incondicional, então o DO sempre aborta e tudo o que ele fez é desfeito,
    inclusive o `auth.users`, o `hub_system_access` e as fixtures.
  - A trigger levanta `23514`, que é `check_violation`, então os `when check_violation` de
    (c)/(d)/(e)/(g) pegam tanto a trigger quanto o CHECK.
  - Percorri os 11 casos contra a trigger e o CHECK e todos dão o resultado esperado.
  - O padrão `auth.users` + `set_config('role')` é o mesmo de
    `sdd-sql-hub-comunicados-teste-rls.sql`, que já rodou em produção com rollback confirmado.

## 5. Rollback

A ordem está correta e as pré-condições (0 canceladas, 0 linhas `Cancelamento`) são as certas,
porque sem elas o re-add dos CHECKs antigos falha, e falha fechado. Há uma ressalva de redação,
registrada no backlog (item 1).

---

## Backlog (não bloqueia)

1. **Rollback, linhas 59-61.** Hoje a restauração da RPC é só um comentário ("rodar de novo a
   seção 3"), e o `drop column` aparece como opcional logo depois. Se alguém dropar as colunas sem
   restaurar a RPC, **toda** chamada de `obras_aplicar_alteracao` quebra com
   `column cancelado_por does not exist`, e com ela a ficha e a remarcação. Correção: escrever
   "restaurar a RPC ANTES de dropar colunas", ou tirar o `drop column` do roteiro.
2. **PARTE 3, casos (f)–(h), (j) e (k).** Só capturam o erro esperado. Um erro diferente (por
   exemplo `42501` de RLS) aborta o DO com outra mensagem, sem a linha "RESUMO". Nada é gravado,
   mas a instrução de leitura só prevê "RESUMO: …". Acrescentar ao cabeçalho: "sem linha RESUMO =
   FALHOU".
3. **Insert direto com `etapa='cancelado'`.** A trigger é só de UPDATE, então um insert coerente
   (com qualquer etapa anterior das 4 permitidas) passa. Nenhum código faz isso. Anotar em
   `docs/DIVIDAS.md` se interessar.

## O que não consegui verificar

- **A ACL real da RPC em produção.** `prod-rpc.json` traz só o `functiondef`. O `create or replace`
  preserva a ACL e o arquivo reaplica os grants esperados. A verificação 10 do PASSO 2 cobre isso
  depois de aplicar.
- **O corpo de `obras_has_access()` em produção**, para confirmar que devolve `true`/`false` e
  nunca NULL. A guarda não muda nesta migration, então isso não é regressão, mas não foi lido.
- **Se existe trigger em `auth.users`** que a fixture da PARTE 3 dispararia. Se existir, o efeito
  dela é desfeito pelo rollback forçado de qualquer forma.
- **Execução real.** Tudo acima é leitura. A prova é o PASSO 2 (11/11) e o PASSO 3 ("RESUMO:
  11/11 OK").
