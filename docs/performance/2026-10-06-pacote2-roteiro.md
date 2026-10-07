# Pacote 2 — RLS com `(select ...)` — roteiro de aplicação e verificação

Data: 2026-10-06. Origem: achado 2 de `docs/performance/2026-10-06-revisao-banco.md`.
Arquivos: `sdd-sql-perf-rls-initplan.sql` (migration + verificação) e `sdd-sql-perf-rls-initplan-ROLLBACK.sql`.
**Estado: NÃO APLICADO.** Nada foi escrito em produção na preparação; só `SELECT` e `EXPLAIN` sem `ANALYZE`.

## O que muda e por que o resultado é idêntico

32 policies passam a chamar `(select f())` em vez de `f()`; o Postgres avalia a função uma vez por consulta (InitPlan) em vez de uma vez por linha.

- `obras_has_access`, `obras_is_admin`, `sofia_has_access`: medido em 06/10 — todas `STABLE`, `SECURITY DEFINER`, **sem argumento**. Sem argumento da linha, não há o que mudar de valor entre linhas; o embrulho é neutro.
- `auth.jwt()` (3 policies de INSERT de obras): embrulhado só o `auth.jwt()`, e a comparação com a coluna fica de fora: `(quem = lower(TRIM(BOTH FROM ((select auth.jwt()) ->> 'email'))))`. `quem`, `criado_por` e `registrado_por` são colunas da linha e **não** entram no select.
- `ALTER POLICY` mantém nome, comando, roles e permissive; só `using`/`with check` são reescritos. Não existe instante sem policy.
- Nenhuma policy do conjunto estava com `(select ...)` antes: o texto original tinha a chamada nua em 100% delas.

## Contagem

| Módulo | Policies |
|---|---|
| `obras_*` (public) | 11 |
| `storage.objects` — bucket `obras-fotos` | 3 |
| Sofia (`"sofia access"`, 18 tabelas) | 18 |
| **Total** | **32** (56 expressões `using`/`with check`) |

## Fora do pacote, e por quê

- CRM, Compras, Financeiro: já usam `(select ...)`.
- `hub_system_access`, `hub_user_roles`: `using (true)`, sem função. Nada a embrulhar.
- Cockpit/dashboard (`clients`, `default_goals`, `locations`, `sync_runs`, `technician_goals`, `technicians`, `work_orders`): têm `dashboard_manutencao_has_access()` **nua** (o `auth.uid()` já está embrulhado). É app separada, fora do pedido. Candidato a um pacote próprio, com o mesmo método.
- `hub_comunicados_lidos` (`user_id = auth.uid()`), `user_client_access` (idem): `auth.uid()` nu, mas tabelas pequenas. Embrulhável como `user_id = (select auth.uid())`. Não incluído por estar fora do escopo pedido.
- `hub_comunicados` "comunicados leitura": `hub_tem_acesso_sistema(sistema)` recebe **coluna da linha**: não é embrulhável. Também `hub_comunicados_lidos` "lidos insercao propria" tem `hub_tem_acesso_sistema(c.sistema)` com coluna: só o `auth.uid()` seria embrulhável.
- `conversor_os_imports`, storage de `conversor-os-arquivos`, `sofia-anexos`, `checklist-fotos`: sem função (`true`/`bucket_id`).

## Policy a policy (antes → depois)

### obras

| Tabela | Policy | Cmd | Antes → Depois |
|---|---|---|---|
| `public.obras_diario` | obras access | ALL | USING `obras_has_access()` → `(select obras_has_access())`<br>CHECK `obras_has_access()` → `(select obras_has_access())` |
| `public.obras_historico` | obras historico escrita | INSERT | CHECK `(obras_has_access() AND (quem = lower(TRIM(BOTH FROM (auth.jwt() ->> 'email'::text)))))` → `((select obras_has_access()) AND (quem = lower(TRIM(BOTH FROM ((select auth.jwt()) ->> 'email'::text)))))` |
| `public.obras_historico` | obras historico leitura | SELECT | USING `obras_has_access()` → `(select obras_has_access())` |
| `public.obras_motivo_remarcacao` | obras motivo cadastro | INSERT | CHECK `(obras_has_access() AND (criado_por IS NOT NULL) AND (lower(btrim(criado_por)) = lower(btrim((auth.jwt() ->> 'email'::text)))))` → `((select obras_has_access()) AND (criado_por IS NOT NULL) AND (lower(btrim(criado_por)) = lower(btrim(((select auth.jwt()) ->> 'email'::text)))))` |
| `public.obras_motivo_remarcacao` | obras motivo leitura | SELECT | USING `obras_has_access()` → `(select obras_has_access())` |
| `public.obras_obra` | obras access | ALL | USING `obras_has_access()` → `(select obras_has_access())`<br>CHECK `obras_has_access()` → `(select obras_has_access())` |
| `public.obras_pessoa` | obras access | ALL | USING `obras_has_access()` → `(select obras_has_access())`<br>CHECK `obras_has_access()` → `(select obras_has_access())` |
| `public.obras_remarcacao` | obras remarcacao insercao | INSERT | CHECK `(obras_has_access() AND (registrado_por IS NOT NULL) AND (lower(btrim(registrado_por)) = lower(btrim((auth.jwt() ->> 'email'::text)))))` → `((select obras_has_access()) AND (registrado_por IS NOT NULL) AND (lower(btrim(registrado_por)) = lower(btrim(((select auth.jwt()) ->> 'email'::text)))))` |
| `public.obras_remarcacao` | obras remarcacao leitura | SELECT | USING `obras_has_access()` → `(select obras_has_access())` |
| `public.obras_sync_execucao` | obras sync admin | ALL | USING `obras_is_admin()` → `(select obras_is_admin())`<br>CHECK `obras_is_admin()` → `(select obras_is_admin())` |
| `public.obras_tarefa` | obras access | ALL | USING `obras_has_access()` → `(select obras_has_access())`<br>CHECK `obras_has_access()` → `(select obras_has_access())` |

### storage

| Tabela | Policy | Cmd | Antes → Depois |
|---|---|---|---|
| `storage.objects` | obras fotos read | SELECT | USING `((bucket_id = 'obras-fotos'::text) AND obras_has_access())` → `((bucket_id = 'obras-fotos'::text) AND (select obras_has_access()))` |
| `storage.objects` | obras fotos update | UPDATE | USING `((bucket_id = 'obras-fotos'::text) AND obras_has_access())` → `((bucket_id = 'obras-fotos'::text) AND (select obras_has_access()))`<br>CHECK `((bucket_id = 'obras-fotos'::text) AND obras_has_access())` → `((bucket_id = 'obras-fotos'::text) AND (select obras_has_access()))` |
| `storage.objects` | obras fotos upload | INSERT | CHECK `((bucket_id = 'obras-fotos'::text) AND obras_has_access())` → `((bucket_id = 'obras-fotos'::text) AND (select obras_has_access()))` |

### sofia

| Tabela | Policy | Cmd | Antes → Depois |
|---|---|---|---|
| `public.abastecimentos` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.audit_log` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.centro_custo_historico` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.checklist` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.checklist_fotos` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.documentos_veiculo` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.equipes` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.km_diario` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.km_excedido_desconto` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.motorista_documentos` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.motoristas` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.multas` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.pendencias` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.revisoes` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.sinistro_fotos` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.sinistros` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.veiculo_responsabilidade_historico` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |
| `public.veiculos` | sofia access | ALL | USING `sofia_has_access()` → `(select sofia_has_access())`<br>CHECK `sofia_has_access()` → `(select sofia_has_access())` |

## Como aplicar

1. **Medir antes** (seção "Medição" abaixo) e guardar o resultado.
2. Rodar a PARTE 1 de `sdd-sql-perf-rls-initplan.sql` (`begin` … `commit`). A seção 0 aborta se as funções mudaram ou se o número de policies não for 32.
3. Rodar a PARTE 2 (verificação, 5 linhas): todas `OK`. Qualquer `*** FALHOU ***`: rodar o ROLLBACK e não deployar.
4. Rodar o teste de comportamento (abaixo) e comparar com o "antes".
5. Se `ALTER POLICY` em `storage.objects` falhar por ownership (`supabase_storage_admin` é o dono, `postgres` não é membro), o envelope desfaz tudo. Nesse caso, mover a seção 2 para o SQL Editor do dashboard, que roda como dono; as outras duas seções não dependem dela.

Atualizar a tabela de migrations em `.claude/rules/sql.md` no mesmo commit em que aplicar.

## Verificação pós-aplicação

### V1. Texto novo em `pg_policies`

```sql
select tablename, policyname, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and (tablename like 'obras\_%' or policyname = 'sofia access'))
   or (schemaname = 'storage' and policyname like 'obras fotos%')
order by schemaname, tablename, policyname;
```

Esperado: 32 linhas; todo `qual`/`with_check` com função mostra `( SELECT obras_has_access() AS obras_has_access)` (ou `obras_is_admin`/`sofia_has_access`), e `auth.jwt()` aparece como `( SELECT auth.jwt() AS jwt)`. Nenhuma chamada nua:

```sql
select count(*) as nuas  -- esperado 0
from pg_policies
where (coalesce(qual,'') || ' ' || coalesce(with_check,'')) ~ '(?<!SELECT )(obras_has_access|obras_is_admin|sofia_has_access|auth\.jwt)\(\)'
  and ((schemaname = 'public' and (tablename like 'obras\_%' or policyname = 'sofia access'))
    or (schemaname = 'storage' and policyname like 'obras fotos%'));
```

### V2. Mesmo resultado para quem tem e quem não tem acesso (só leitura)

Roda como `postgres` pela Management API, assume o papel `authenticated` e forja o JWT como o PostgREST faz. Só `SELECT`. O bloco termina em `raise exception` de propósito: a mensagem é o relatório e nada fica gravado.

```sql
do $$
declare
  v_com  text;                              -- e-mail com acesso a obras
  v_sem  text := '__sem.acesso@manfac.com.br';  -- e-mail que não existe em hub_system_access
  v_id   text;
  v_out  text := '';
  v_n    bigint;
  t      text;
begin
  select user_email into v_com from public.hub_system_access
   where system_slug = 'obras' and has_access = true limit 1;
  foreach v_id in array array[v_com, v_sem] loop
    perform set_config('request.jwt.claims',
      json_build_object('email', v_id, 'role', 'authenticated')::text, true);
    set local role authenticated;
    v_out := v_out || E'\n' || case when v_id = v_com then 'COM acesso' else 'SEM acesso' end || ':';
    foreach t in array array['obras_obra','obras_tarefa','obras_diario','obras_pessoa',
                             'obras_historico','obras_remarcacao','obras_motivo_remarcacao','obras_sync_execucao'] loop
      execute format('select count(*) from public.%I', t) into v_n;
      v_out := v_out || ' ' || t || '=' || v_n;
    end loop;
    select count(*) into v_n from storage.objects where bucket_id = 'obras-fotos';
    v_out := v_out || ' storage_obras_fotos=' || v_n;
    select count(*) into v_n from public.veiculos;
    v_out := v_out || ' veiculos(sofia)=' || v_n;
    reset role;
  end loop;
  raise exception 'RELATORIO:%', v_out;
end $$;
```

Esperado: **a linha "COM acesso" é idêntica antes e depois da migration**, e a linha "SEM acesso" é toda `=0`. Rodar uma vez antes e uma depois e comparar as duas mensagens caractere a caractere. Se o e-mail com acesso for admin de obras, `obras_sync_execucao` também aparece com linhas; é o esperado (guardado por `obras_is_admin()`).
Para a Sofia, o e-mail com acesso a obras pode não ter acesso à Sofia (`veiculos` = 0 nele). Para exercitar a Sofia, repetir trocando `'obras'` por `'sofia'` na primeira consulta.

**Este bloco não foi executado na preparação** (a regra era só `SELECT`/`EXPLAIN`, e `set local role` é comando de sessão). Rodar primeiro **antes** da migration; se o bloco em si falhar de forma diferente de `RELATORIO:`, corrigir o teste antes de aplicar a migration.

## Medição antes/depois

### M1. `pg_stat_statements` (acumulado, não separa horário)

```sql
select calls, round(mean_exec_time::numeric, 2) as media_ms, round(max_exec_time::numeric, 1) as max_ms,
       shared_blks_hit, left(query, 90) as consulta
from pg_stat_statements
where query ~* 'obras_(obra|tarefa|diario|pessoa|historico|remarcacao)'
  and query !~* 'pg_stat_statements'
order by total_exec_time desc
limit 15;
```

Anotar `calls` e `mean_exec_time` das consultas `select * from obras_obra` e `select equipe, analista_cliente from obras_obra` antes. `pg_stat_statements` é acumulado desde 11/06, então a média depois **mistura** o histórico. Para comparar de verdade, usar a **variação**: `(total_exec_time_depois - total_exec_time_antes) / (calls_depois - calls_antes)` depois de alguns dias de uso, ou `pg_stat_statements_reset()` na hora da aplicação (decisão do João: apaga a história de todo o banco, incluindo o Cockpit; por isso não está no roteiro como passo obrigatório).

Referência do relatório: `select *` de `obras_obra` media 24–57 ms, máx. 226 ms.

### M2. `EXPLAIN` mostrando o InitPlan (sem `ANALYZE`)

Como `postgres` o planner **não aplica RLS** e o `EXPLAIN` não mostra a policy. Para ver o efeito, planejar com o papel `authenticated` (mesma técnica do V2, `begin read only` não é necessário porque `EXPLAIN` sem `ANALYZE` não executa):

```sql
begin;
select set_config('request.jwt.claims', '{"email":"<email-com-acesso>","role":"authenticated"}', true);
set local role authenticated;
explain select * from public.obras_obra;
rollback;
```

Esperado:
- **Antes:** `Seq Scan on obras_obra` com `Filter: obras_has_access()` (chamada avaliada por linha).
- **Depois:** `Result` / `Seq Scan on obras_obra` com `InitPlan 1 (returns $0)` e `Filter: $0` (avaliada uma vez).

Na preparação, o `EXPLAIN` da **expressão nova** contra cada tabela foi rodado como `postgres` e todas as 56 expressões planejam com `InitPlan` (ver "Teste de sanidade").

## Teste de sanidade feito na preparação (somente leitura)

Para cada uma das 32 policies, o texto novo foi montado a partir do `qual`/`with_check` real de `pg_policies` (leitura de 06/10/2026) por substituição mecânica e conferido de duas formas:

1. Reversibilidade textual: remover o embrulho do texto novo devolve **exatamente** o texto original (as 56 expressões).
2. `EXPLAIN select * from <tabela> where <expressão nova>` em produção, como `postgres`: 56/56 sem erro (sintaxe, nomes e tipos válidos) e 56/56 com `InitPlan` no plano.

Não foi validado: a sintaxe do `ALTER POLICY ... USING/WITH CHECK` em si (executá-lo seria escrita) e o bloco V2. A forma usada é a documentada do PostgreSQL.

## Casos que exigiram atenção

- **Três policies de INSERT com `auth.jwt()`** (`obras historico escrita`, `obras motivo cadastro`, `obras remarcacao insercao`): embrulhado apenas `auth.jwt()` e `obras_has_access()`; a comparação com a coluna da linha permanece fora.
- **`storage.objects`**: dono é `supabase_storage_admin`; risco de ownership descrito acima.
- Nenhuma policy do conjunto tinha argumento de coluna na função de acesso, então nenhuma ficou de fora por não ser embrulhável.
