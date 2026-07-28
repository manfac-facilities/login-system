# Gestão de Frotas — Track C, sub-projeto 1: integridade de dados

**Data:** 2026-07-28
**Status:** aprovado para plano de implementação

## Contexto

A auditoria de 16 etapas (2026-07-16/17) identificou 40 achados, já triados em tracks (ver [[gestao-frotas-v04]]). Tracks A e B já estão mergeados. Este documento cobre o primeiro dos 3 sub-projetos do **Track C** (backend/perf) — os 3 achados de maior risco: dado errado ou perdido silenciosamente, sem erro visível pra ninguém.

- **B-13**: `lancarKmAction` lê `veiculos.km_atual`, valida, e só depois grava — sem lock. Dois lançamentos concorrentes pro mesmo veículo podem fazer um "atropelar" o outro (last-write-wins), deixando `veiculos.km_atual` com um valor menor do que o real, sem nenhum erro.
- **B-06**: `criarChecklistAction` (tipos `troca`, `recebimento`, `devolucao`, `finalizacao_contrato`) faz 3-4 escritas separadas (fecha histórico de responsabilidade, insere o novo, atualiza `veiculos.equipe_id`, atualiza `motoristas.equipe_id`) sem transação. O código já sabe que isso pode falhar no meio — devolve `"Checklist salvo, mas a atribuição de equipe não foi totalmente registrada. Contate o suporte."` — mas não impede a inconsistência.
- **B-18**: `excluirMultasEmMassaAction` faz um `DELETE ... WHERE id IN (...)` (já atômico, uma instrução SQL só) seguido de um loop de `logAudit` por multa excluída. Se um desses inserts de auditoria falhar no meio do loop, a multa já foi excluída sem deixar rastro de quem excluiu.

Confirmado lendo o código atual (`app/(operacoes)/sofia/km/_actions.ts`, `app/(operacoes)/sofia/checklist/_actions.ts`, `app/(operacoes)/sofia/multas/_actions.ts`) que os 3 problemas continuam presentes, nenhum foi tocado pelos Tracks A ou B.

Escopo confirmado com o usuário durante o brainstorming: os 2 sub-projetos restantes do Track C (performance — N+1, paginação, agrupamento; infra — índices, storage policies, CI) ficam para specs separadas, depois deste.

## Decisão de abordagem

Os 3 achados compartilham a mesma causa raiz (sequência de leitura-validação-escrita ou múltiplas escritas em tabelas diferentes, feitas como chamadas separadas do Supabase a partir da aplicação, sem transação) e a mesma correção: mover cada sequência para uma **function do Postgres** (`plpgsql`, `security definer`, mesmo padrão já usado em `sdd-sql-v04-seguranca.sql` para as functions de acesso), chamada via `supabase.rpc(...)`. Cada function roda inteira dentro de uma transação implícita do Postgres — ou tudo aplica, ou nada aplica — e onde precisa de proteção contra concorrência, usa `select ... for update` para travar a linha relevante até o fim da function.

Validações que são só leitura (ex.: `validarVinculoEquipeUnico`) continuam em JS antes da chamada RPC — não precisam estar na mesma transação da escrita. Só a sequência de escritas (e a leitura que precisa do lock) entra na function.

### B-13 — `lancar_km_atomico`

```sql
create or replace function public.lancar_km_atomico(
  p_equipe_id uuid,
  p_veiculo_id uuid,
  p_motorista_id uuid,
  p_km_atual integer,
  p_data date,
  p_observacoes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_km_atual_veiculo integer;
begin
  select km_atual into v_km_atual_veiculo
  from public.veiculos
  where id = p_veiculo_id
  for update;

  if v_km_atual_veiculo is null then
    raise exception 'Veículo não encontrado';
  end if;

  if p_km_atual < v_km_atual_veiculo then
    raise exception 'KM não pode ser menor que a última KM registrada (% km)', v_km_atual_veiculo;
  end if;

  insert into public.km_diario (equipe_id, veiculo_id, motorista_id, km_atual, data, observacoes)
  values (p_equipe_id, p_veiculo_id, p_motorista_id, p_km_atual, p_data, p_observacoes)
  on conflict (data, veiculo_id) do update
    set km_atual = excluded.km_atual,
        equipe_id = excluded.equipe_id,
        motorista_id = excluded.motorista_id,
        observacoes = excluded.observacoes;

  update public.veiculos set km_atual = p_km_atual where id = p_veiculo_id;
end;
$$;
```

`lancarKmAction` troca os 3 passos atuais (select, upsert, update) por uma chamada `supabase.rpc('lancar_km_atomico', {...})`. `RAISE EXCEPTION` chega no client como `error.message` — a action mapeia pro mesmo texto de erro que já mostra hoje (mensagem de "KM não pode ser menor..." fica igual, só passa a vir do banco em vez do JS). O resto da action (validação de formato do `km_atual` via `validateKmAtual`, `verificarERegistrarExcedencia`, `logAudit`, `revalidatePath`) continua em JS, fora da function.

### B-06 — `atribuir_responsabilidade_veiculo`

```sql
create or replace function public.atribuir_responsabilidade_veiculo(
  p_veiculo_id uuid,
  p_equipe_id uuid,       -- null para devolução/finalização
  p_motorista_id uuid,    -- pode ser null
  p_tipo text,            -- 'troca' | 'recebimento' | 'devolucao' | 'finalizacao_contrato'
  p_checklist_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_hoje date := current_date;
begin
  perform 1 from public.veiculos where id = p_veiculo_id for update;

  update public.veiculo_responsabilidade_historico
  set fim = v_hoje
  where veiculo_id = p_veiculo_id and fim is null;

  if p_equipe_id is not null then
    insert into public.veiculo_responsabilidade_historico
      (veiculo_id, equipe_id, motorista_id, inicio, origem_checklist_id)
    values (p_veiculo_id, p_equipe_id, p_motorista_id, v_hoje, p_checklist_id);
  end if;

  update public.veiculos
  set equipe_id = p_equipe_id,
      status = case when p_tipo = 'finalizacao_contrato' then 'inativo' else status end
  where id = p_veiculo_id;

  if p_motorista_id is not null and p_equipe_id is not null then
    update public.motoristas set equipe_id = p_equipe_id where id = p_motorista_id;
  end if;
end;
$$;
```

`criarChecklistAction` chama essa function nos 4 branches que hoje fazem as escritas manualmente (`troca`/`recebimento` com `equipe_destino_id`, `devolucao`, `finalizacao_contrato`) — os parâmetros variam por tipo (`p_equipe_id`/`p_motorista_id` vêm `null` pra devolução; `p_tipo` controla se o veículo é inativado). `validarVinculoEquipeUnico` continua rodando antes, em JS, como hoje — o `select ... for update` na function é uma segunda camada de proteção contra duas trocas simultâneas pra a mesma equipe, não substitui a validação de negócio.

O antigo aviso `"Checklist salvo, mas a atribuição de equipe não foi totalmente registrada"` deixa de fazer sentido — com a function atômica, ou a atribuição funciona inteira, ou o `rpc()` retorna erro e a action devolve `"Erro ao processar a troca de responsável. O checklist não foi afetado."` (a inserção do checklist em si, feita antes desta chamada, continua não afetada por essa function).

### B-18 — `excluir_multas_em_massa`

```sql
create or replace function public.excluir_multas_em_massa(
  p_ids uuid[],
  p_usuario_id uuid
)
returns setof public.multas
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_multa record;
begin
  for v_multa in
    delete from public.multas where id = any(p_ids) returning *
  loop
    insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id)
    values (
      'multas', 'excluiu', v_multa.id::text,
      'Multa excluída em massa — ' || coalesce(v_multa.tipo_infracao, v_multa.descricao, v_multa.id::text),
      p_usuario_id
    );
    return next v_multa;
  end loop;
end;
$$;
```

`excluirMultasEmMassaAction` troca o `.delete().in('id', ids).select()` + loop de `logAudit` por uma chamada `supabase.rpc('excluir_multas_em_massa', { p_ids: ids, p_usuario_id: user.id })` — `user.id` já está disponível na action (mesmo `auth.getUser()` que ela já chama hoje pra checar admin). Colunas conferidas contra o schema real de `audit_log` (`sdd-sql-passo4.sql` + `sdd-sql-audit-log.sql`, o que `lib/sofia/auditLog.ts` de fato grava): `tabela`, `operacao`, `registro_id text`, `descricao`, `usuario_id uuid references auth.users(id)` — as colunas antigas (`acao`, `dados`, `usuario_email`) existem na tabela mas ficaram nullable e não são mais usadas, a function não mexe nelas. Se qualquer insert de auditoria falhar, o `for` desfaz junto com todos os deletes já feitos no loop (mesma transação) — nunca fica multa excluída sem rastro.

## Testes

- Unitários das actions: mock de `supabase.rpc()` (retorna `{ data, error }`) no lugar do mock encadeado de `.insert()/.update()` — mesmo padrão de mock já usado nos testes existentes de `_actions.ts`, só troca o que está sendo mockado.
- Casos de erro: `rpc()` retornando `error` deve mapear pra a mesma mensagem de erro que a action mostra hoje (ou a nova mensagem genérica, no caso do B-06).
- A garantia de lock/transação em si (que duas chamadas concorrentes não se pisam) **não é testável via mock** — só contra um Postgres real. Fica documentado no plano como verificação manual: abrir 2 abas, lançar KM pro mesmo veículo quase ao mesmo tempo, confirmar que o `veiculos.km_atual` final reflete o maior dos dois lançamentos, não o último a terminar.

## Fora de escopo

- Sub-projetos 2 (performance: B-10/U-09, B-09, U-07/U-11, B-19) e 3 (infra: B-11, B-15, B-14) do Track C — specs separadas, depois desta.
- RLS/policies das tabelas envolvidas — já corrigidas no pacote de segurança (Track anterior), não mexidas aqui.
- Qualquer mudança de schema — as 3 functions operam só com as tabelas/colunas já existentes.

## O que isto custa

- **SQL para João rodar:** um arquivo novo (`sdd-sql-track-c-integridade.sql`), 3 functions `create or replace`, nenhuma migração de schema.
- **Código:** 3 actions trocam chamadas encadeadas por uma chamada `rpc()` cada — sem mudança de assinatura pública (as actions continuam recebendo o mesmo `FormData`/parâmetros, retornando o mesmo `State`).
- **Maior risco técnico:** nenhum — são funções pequenas, sem lógica nova de negócio, só uma reorganização de onde a atomicidade é garantida (banco em vez de aplicação).
