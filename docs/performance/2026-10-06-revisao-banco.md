# Revisão de performance do banco — 2026-10-06

Só leitura em produção (`iyytcavcgukfjnjjrerx`): catálogo, `pg_stat_*`, `pg_stat_statements` (zerado em 11/06/2026) e EXPLAIN sem ANALYZE. Nada foi escrito.
Pedido do dono: "o sistema está lento ao carregar [...] quanto mais informação, mais lento".

## Conclusão em uma frase

O módulo Gestão de Obras **não é o maior consumidor do banco**: `obras_*` somam 490 s de 128.838 s de tempo de execução acumulado (0,4%). O que domina é a **view `v_sync_health` do Cockpit (40%)** e o **Realtime (22%)**, no mesmo Postgres de 105 MB. Dentro de Obras, o desenho tem dois defeitos que **escalam com o volume** (achados 2 e 3) e um custo por linha na RLS (achado 1).

## Achados, por impacto

### 1. `v_sync_health` (Cockpit) consome 40% do banco — FORA de obras, mas é o que mais pesa (confirmado)
- Onde: view `public.v_sync_health`; app do Cockpit lê via PostgREST.
- Evidência (`pg_stat_statements`): 21.668 chamadas × 2.062 ms médios = 44.690 s, mais 1.846 chamadas × 3.541 ms = 6.537 s. Total 51.272 s de 128.838 s. Outra: `v_classification_coverage`, 962 × 2.118 ms.
- Causa provável (suspeita, não medi com ANALYZE): a view faz, por linha de `sync_resources`, um LATERAL com `count(*)` em `sync_runs where finished_at is null` e `max(synced_at)` em `work_orders` (sem índice em `synced_at`). `sync_runs` tem 45.697 linhas, **1.698 sem `finished_at` (rodadas presas)**, e só o índice `(resource, started_at desc)`. O EXPLAIN mostra Index Scan com filtro `finished_at IS NOT NULL` estimando 8.727 linhas por recurso.
- Escala: `sync_runs` cresce sem limite e a contagem de presas cresce junto; custo por chamada sobe linear. 10x = ~20 s por chamada.
- Correção proposta (migration manual, exige aprovação):
  ```sql
  create index concurrently if not exists sync_runs_presas_idx on public.sync_runs (resource, started_at) where finished_at is null;
  create index concurrently if not exists sync_runs_terminadas_idx on public.sync_runs (resource, started_at desc) where finished_at is not null;
  create index concurrently if not exists work_orders_synced_at_idx on public.work_orders (synced_at desc);
  ```
  e limpar/expirar as 1.698 rodadas presas e reter só ~30 dias de `sync_runs`. Reduzir a frequência de polling do Cockpit (23k chamadas) é a outra metade.
- Esforço: baixo (índices) a médio (retenção + dono do Cockpit). Decisão de quem é dono do app Cockpit.

### 2. Policies de `obras_*` chamam `obras_has_access()` sem `(select ...)` — custo por linha (confirmado a policy; custo por linha inferido)
- Onde: policies `obras access` em `obras_obra`, `obras_diario`, `obras_tarefa`, `obras_pessoa`; `obras historico leitura`, `obras motivo leitura`, `obras remarcacao leitura`; `obras sync admin` (`obras_is_admin()`); e as policies de storage `obras fotos read/update`. Todas usam `obras_has_access()` nua.
- A função é `STABLE SECURITY DEFINER`; sendo chamada sem argumento e fora de subselect, o planner não a eleva a InitPlan: roda **por linha lida**, e cada execução faz 1 a 2 buscas em `hub_user_roles` e `hub_system_access`. As policies de CRM, Compras e Financeiro do mesmo banco já usam `( SELECT crm_has_access() )`; as de Obras e Sofia não.
- Evidência indireta: `hub_system_access` com **205.017.954** idx_scan e `hub_user_roles` com **233.380.772**, contra ~108 mil chamadas diretas de leitura vindas do código (`hasSystemAccess`/`isAdmin`). `track_functions = none`, então não deu para contar chamadas da função diretamente — por isso o "por linha" é inferência forte, não medição.
- Custo hoje: pequeno em milissegundos (cada lookup ~0,05 ms; `obras_obra` 241 linhas; a tela Base lê 241 linhas × ~2 lookups ≈ 500 buscas por carregamento). A leitura `select *` de `obras_obra`: média 24–57 ms por chamada, máx. 226 ms (sem RLS seria ~1 ms).
- Escala: **linear em linhas lidas**. 10x (2.400 obras) = ~5.000 lookups por carregamento da Base/Painel/Diário, ~250–500 ms só de RLS; 100x = segundos.
- Correção (baixo risco, mesma semântica, mantém a função como está):
  ```sql
  alter policy "obras access" on public.obras_obra using ((select public.obras_has_access())) with check ((select public.obras_has_access()));
  -- idem obras_diario, obras_tarefa, obras_pessoa;
  alter policy "obras historico leitura" on public.obras_historico using ((select public.obras_has_access()));
  alter policy "obras motivo leitura" on public.obras_motivo_remarcacao using ((select public.obras_has_access()));
  alter policy "obras remarcacao leitura" on public.obras_remarcacao using ((select public.obras_has_access()));
  alter policy "obras sync admin" on public.obras_sync_execucao using ((select public.obras_is_admin())) with check ((select public.obras_is_admin()));
  ```
  As policies de INSERT (`obras historico escrita`, `obras motivo cadastro`, `obras remarcacao insercao`) também: embrulhar `auth.jwt() ->> 'email'` como `(select auth.jwt() ->> 'email')`. Storage `obras fotos read/update` idem. **Território de RLS (exceção do AGENTS.md):** exige teste com usuário sem acesso e com acesso antes/depois, e verificação pós-commit no padrão do projeto. Mesma correção vale para Sofia (`sofia_has_access()` nua em ~20 tabelas) e `hub_comunicados` (`hub_tem_acesso_sistema(sistema)` passa coluna como argumento, então não dá para elevar; ver achado 5).
- Esforço: baixo (1 migration, ~15 `alter policy`).

### 3. Telas leem a base inteira e filtram/derivam no servidor (confirmado)
- Onde: `app/obras/base/page.tsx:36` (`select('*')` sem filtro nem limite), `app/obras/painel/page.tsx` (idem, de propósito por causa de `cliente`), `app/obras/obra/[id]/page.tsx:131` (`select equipe, analista_cliente, cliente` de **todas** as obras só para montar listas de sugestão — a cada abertura de ficha), `app/obras/diario/page.tsx:135` (todas as obras, só `pcm`).
- Evidência: `pg_stat_statements` — 1.519 chamadas de `select equipe, analista_cliente from obras_obra` sem WHERE (41 ms média, 793 mil blocos lidos) e 655 + 530 chamadas de `select *` sem WHERE (57 e 24 ms). `obras_obra`: 4.532 seq_scans / 565.598 linhas lidas; EXPLAIN `Seq Scan on obras_obra rows=240`.
- Escala: payload e CPU crescem linear com obras (`select *` traz 618 bytes/linha; 241 obras ≈ 150 KB; 10x = 1,5 MB por carregamento, mais a derivação em JS e a hidratação). É aqui que "mais informação = mais lento" vai aparecer primeiro para o usuário. Nenhuma dessas leituras tem paginação.
- Correção (código, não SQL): na ficha, trocar a leitura de listas por consulta distinta (`select distinct` via RPC/view, ou cache de poucos minutos); na Base, paginar/filtrar por etapa no servidor e selecionar só as colunas que a tabela usa; no painel, agregar no banco (RPC) em vez de trazer linhas. Para SQL, uma RPC `obras_listas_sugestao()` com `select distinct` resolve a ficha.
- Esforço: médio (cada tela). Prioridade: ficha primeiro (é a mais aberta e a mais desperdiçada).

### 4. `obras_sync_execucao`: cresce 288/dia, a leitura da tela é limitada, mas a escrita custa mais que deveria (confirmado)
- Onde: tabela `obras_sync_execucao` (6.032 linhas, 1,8 MB total; 6.029 sucessos + 3 falhas desde 16/09). Tela `app/obras/sincronizar/page.tsx:39` lê `limit 10` ordenado por `iniciada_em desc`: EXPLAIN usa `obras_sync_execucao_mais_recentes`, custo 0,69. **Isso está certo e não degrada com o volume.** Nada mais no carregamento de páginas lê a tabela (grep: só `page.tsx:39` e `_execucao.ts:169`).
- Evidência do custo real: RPC `obras_iniciar_sync_execucao` 6.059 chamadas, 41 ms médios, máx. 708 ms, **2,8 milhões de blocos lidos (~463 por chamada)** — alto para uma tabela de 6 mil linhas; o `update ... where status='
- Escala: 100x (~5 anos de cron) = 600 mil linhas, ~180 MB com índices; a leitura da tela segue barata; a RPC tende a piorar se a subquery da marca d'água não usar o índice parcial `ultimo_sucesso` (suspeita — não medi o plano interno da função).
- Correção: retenção semanal por cron (apaga log de sucesso antigo, preservando o último sucesso com `marca_dagua_nova`, que o sync usa):
  ```sql
  delete from public.obras_sync_execucao
  where status = 'sucesso' and iniciada_em < now() - interval '30 days'
    and id <> (select id from public.obras_sync_execucao where status='sucesso' and marca_dagua_nova is not null order by finalizada_em desc limit 1);
  ```
  É log, não dado de cliente, mas é DELETE: só com aprovação do dono. Seguimento: EXPLAIN do corpo da RPC.
- Esforço: baixo (retenção); médio (investigar a RPC).

### 5. `hub_comunicados` chama `hub_tem_acesso_sistema(sistema)` por linha (confirmado; impacto pequeno hoje)
- Policy `comunicados leitura`. Depende da coluna `sistema`, então não dá para elevar a InitPlan. Hoje 1 linha em `hub_comunicados`: irrelevante. Registrar, não agir.
- `FaixaComunicados` é componente cliente no layout de `/obras`: dispara uma server action (`listarComunicadosNaoLidos`) a cada montagem, um round-trip extra por navegação. Suspeita de latência percebida, não medida.

### 6. Autorização repetida no servidor (confirmado, baixo custo no banco)
- `hasSystemAccess` = 2 consultas (`hub_user_roles`, `hub_system_access`) mais `auth.getUser()` por página, em sequência. 125.525 e 108.886 chamadas, 0,08–0,11 ms cada: barato no banco, mas são 2–3 viagens de rede antes da consulta útil. Correção: uma chamada só (`rpc('obras_has_access')`) ou `Promise.all`. Ganho de latência, não de CPU de banco.

## O que está bem (não mexer)
- `obras_historico_obra_idx (obra_id, created_at desc, seq desc)`: Bitmap Index Scan, 3,8 ms médios em 1.500 chamadas.
- `obras_tarefa`, `obras_diario`, `obras_remarcacao`: índices adequados, <30 linhas; seq_scan em tabela minúscula é o planner acertando.
- Funções de acesso: `STABLE SECURITY DEFINER` com `search_path` fixo — só falta embrulhar a chamada na policy.
- RPCs `obras_aplicar_alteracao` (~58 ms) e `obras_remarcar_inicio` (~44 ms): aceitável.

## Ordem sugerida
1. Achado 2 (RLS com `(select ...)`): uma migration, baixo risco; vale também para Sofia.
2. Achado 3 (ficha e Base lendo tudo): o que mais cresce com o uso.
3. Achado 1 (Cockpit): maior consumidor do banco; decidir com quem cuida do Cockpit.
4. Achado 4 (retenção do sync): evita crescimento sem limite.
5. Achados 5 e 6 só se ainda houver lentidão depois.

## Limites
`pg_stat_statements` acumula desde 11/06 e não separa horários. Sem `EXPLAIN ANALYZE` nem `track_functions`, o custo por linha da RLS é inferido, não medido: medir antes/depois da migration do achado 2 comparando `mean_exec_time` de `select * from obras_obra`. Latência de rede, Next.js e Auth não foi medida.
