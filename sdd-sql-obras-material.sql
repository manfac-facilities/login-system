-- ============================================================
-- OBRAS — Material antecipado (03/11/2026).
-- Spec: docs/superpowers/specs/2026-11-03-obras-material-antecipado-design.md §4.4, §6.
-- Plano: docs/superpowers/plans/2026-11-03-obras-material-antecipado.md, Task 1.
-- Teste de comportamento: docs/obras/2026-11-03-verificacao-obras-material.sql.
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar (AGENTS.md).
--
-- TERRITÓRIO DE RLS E DE DADO DE CLIENTE (AGENTS.md): toda dúvida falha FECHADA.
-- Nenhuma escrita, coluna, trigger ou policy em cmp_*: só LEITURA do Compras,
-- por funções security definer do lado do hub.
--
-- O QUE FAZ
--   1. obras_material_resposta (id, obra_id -> obras_obra ON DELETE CASCADE,
--      atividade_numero int > 0, criado_por, criado_em); unique (obra_id,
--      atividade_numero). Guarda só o "não precisa" (o "precisa" é a própria
--      restrição de material). Trigger obras_material_resposta_autoria: no
--      INSERT com JWT, criado_por = e-mail do JWT; criado_em = now() sempre.
--      RLS select/insert/delete para authenticated com obras_has_access();
--      SEM update (sem policy e sem grant). anon sem nada.
--   2. obras_compras_prazos() -> table(prazos jsonb, expediente jsonb):
--      security definer, search_path fixo, stable. O `valor` da linha de maior
--      vigente_desde de cada chave em cmp_configuracoes (NULL sem linha). Uma
--      linha só para quem tem obras_has_access(); sem acesso (inclusive sem
--      e-mail / service role) = zero linhas.
--   3. obras_restricao_compras(p_obra uuid): por restrição da obra, as
--      solicitações do Compras com obras_restricao_id = restrição (join em
--      obras_restricao da MESMA obra: id órfão ou de outra obra some), só
--      ambiente 'producao', com left join dos pedidos de produção (sem pedido
--      = uma linha com as colunas de pedido nulas). SEM NENHUM VALOR (R$).
--      Mesmo acesso de obras_restricao_pedidos: obras_has_access() ou
--      service_role (o claim assinado).
--   4. Trava em obras_restricao: trigger obras_restricao_compra_ativa_guarda
--      (before delete; before update of tipo quando o tipo muda), security
--      definer para ler cmp_solicitacoes. Se existe solicitação com
--      obras_restricao_id = a restrição e etapa fora de cancelada/recusada,
--      recusa com P0001 "OBRAS_MATERIAL: Esta restrição tem a solicitação #N
--      no Compras. Cancele lá antes." (N = a mais recente, produção primeiro).
--      Vale para qualquer role (com ou sem JWT) e também na cascata da obra:
--      obra com compra ativa ligada não se apaga.
--
-- PRÉ-REQUISITO: Compras 017 (cmp_solicitacoes.obras_restricao_id) e a Leva 3
-- (obras_restricao) aplicados — a seção 0 confere e aborta.
-- Ordem: Compras 017 -> este arquivo -> app do Compras -> app do hub.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-11-03-verificacao-obras-material.sql.
--
-- IDEMPOTENTE: create ... if not exists, create or replace, drop trigger/policy
-- if exists antes de recriar.
--
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is true` / `is not true`
-- (sem NULL aberto); uma função de trigger por tabela.
--
-- ROLLBACK (só depois de reverter o app; apaga as respostas "não precisa"):
--   drop trigger if exists obras_restricao_compra_ativa_guarda on public.obras_restricao;
--   drop function if exists public.obras_restricao_compra_ativa_guarda(),
--                           public.obras_restricao_compras(uuid),
--                           public.obras_compras_prazos();
--   drop table if exists public.obras_material_resposta;
--   drop function if exists public.obras_material_resposta_autoria();
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos
-- ============================================================
do $$
begin
  if to_regclass('public.obras_obra') is null
     or to_regclass('public.obras_restricao') is null
     or to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('auth.role()') is null
     or to_regprocedure('auth.jwt()') is null then
    raise exception 'Pré-requisito ausente: obras_obra, obras_restricao (leva3), obras_has_access(), auth.jwt()/auth.role(). Nada foi alterado.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'cmp_solicitacoes'
                    and column_name = 'obras_restricao_id') then
    raise exception 'Pré-requisito ausente: Compras 017 (cmp_solicitacoes.obras_restricao_id). Aplicar o 017 do Compras ANTES deste arquivo. Nada foi alterado.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'cmp_solicitacoes'
                    and column_name in ('id','numero','etapa','enviado_em','data_minima','prazo_necessario','ambiente')
                  having count(*) = 7)
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'cmp_pedidos'
                       and column_name in ('id','solicitacao_id','sequencia','situacao','previsao_entrega',
                                           'entrega_situacao','entrega_em','mapa_fornecedor_id','ambiente')
                     having count(*) = 9)
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'cmp_mapa_fornecedores'
                       and column_name in ('id','razao_social')
                     having count(*) = 2)
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'cmp_configuracoes'
                       and column_name in ('chave','valor','vigente_desde')
                     having count(*) = 3) then
    raise exception 'Pré-requisito ausente: colunas lidas de cmp_solicitacoes/cmp_pedidos/cmp_mapa_fornecedores/cmp_configuracoes. Nada foi alterado.';
  end if;
end $$;

-- ============================================================
-- 1. obras_material_resposta ("não precisa")
-- ============================================================
create table if not exists public.obras_material_resposta (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  atividade_numero int not null
    constraint obras_material_resposta_atividade_numero_check check (atividade_numero > 0),
  criado_por text,
  criado_em timestamptz not null default now(),
  constraint obras_material_resposta_obra_id_atividade_numero_key unique (obra_id, atividade_numero)
);

create or replace function public.obras_material_resposta_autoria() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
begin
  if v_email is not null then
    new.criado_por := v_email;
  end if;
  new.criado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_material_resposta_autoria() from public, anon, authenticated;

drop trigger if exists obras_material_resposta_autoria on public.obras_material_resposta;
create trigger obras_material_resposta_autoria
  before insert on public.obras_material_resposta
  for each row execute function public.obras_material_resposta_autoria();

alter table public.obras_material_resposta enable row level security;
drop policy if exists "obras select" on public.obras_material_resposta;
create policy "obras select" on public.obras_material_resposta for select to authenticated
  using ((select public.obras_has_access()));
drop policy if exists "obras insert" on public.obras_material_resposta;
create policy "obras insert" on public.obras_material_resposta for insert to authenticated
  with check ((select public.obras_has_access()));
drop policy if exists "obras delete" on public.obras_material_resposta;
create policy "obras delete" on public.obras_material_resposta for delete to authenticated
  using ((select public.obras_has_access()));

-- Os default privileges do Supabase dão tudo a anon/authenticated em tabela nova:
-- tirar explicitamente, e dar só o que a RLS cobre.
revoke all on public.obras_material_resposta from public, anon, authenticated;
grant select, insert, delete on public.obras_material_resposta to authenticated;
grant select, insert, update, delete on public.obras_material_resposta to service_role;

-- ============================================================
-- 2. obras_compras_prazos() — configuração vigente do Compras
-- ============================================================
create or replace function public.obras_compras_prazos()
returns table (prazos jsonb, expediente jsonb)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (select c.valor from public.cmp_configuracoes c
           where c.chave = 'prazos' order by c.vigente_desde desc limit 1),
         (select c.valor from public.cmp_configuracoes c
           where c.chave = 'expediente' order by c.vigente_desde desc limit 1)
   where public.obras_has_access() is true;
$$;
revoke execute on function public.obras_compras_prazos() from public, anon;
grant execute on function public.obras_compras_prazos() to authenticated, service_role;

-- ============================================================
-- 3. obras_restricao_compras(p_obra) — solicitações ligadas pela origem
-- ============================================================
-- SEM NENHUM VALOR (nem total, nem estimado, nem frete). Gate igual ao de
-- obras_restricao_pedidos: obras_has_access() ou service_role.
create or replace function public.obras_restricao_compras(p_obra uuid)
returns table (
  restricao_id uuid,
  solicitacao_id uuid,
  solicitacao_numero bigint,
  etapa text,
  enviado_em timestamptz,
  data_minima date,
  prazo_necessario date,
  pedido_id uuid,
  pedido_sequencia smallint,
  fornecedor_razao_social text,
  pedido_situacao text,
  previsao_entrega date,
  entrega_situacao text,
  entrega_em timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select r.id, s.id, s.numero, s.etapa, s.enviado_em, s.data_minima, s.prazo_necessario,
         p.id, p.sequencia, f.razao_social, p.situacao, p.previsao_entrega, p.entrega_situacao, p.entrega_em
    from public.cmp_solicitacoes s
    join public.obras_restricao r on r.id = s.obras_restricao_id and r.obra_id = p_obra
    left join public.cmp_pedidos p on p.solicitacao_id = s.id and p.ambiente = 'producao'
    left join public.cmp_mapa_fornecedores f on f.id = p.mapa_fornecedor_id
   where (public.obras_has_access() is true or coalesce(auth.role(), '') = 'service_role')
     and p_obra is not null
     and s.ambiente = 'producao'
   order by r.id, s.numero, p.sequencia;
$$;
revoke execute on function public.obras_restricao_compras(uuid) from public, anon;
grant execute on function public.obras_restricao_compras(uuid) to authenticated, service_role;

-- ============================================================
-- 4. Trava: restrição com compra ativa não se apaga nem troca de tipo
-- ============================================================
create or replace function public.obras_restricao_compra_ativa_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_numero bigint;
begin
  if tg_op = 'UPDATE' and new.tipo is not distinct from old.tipo then
    return new;
  end if;
  select s.numero into v_numero
    from public.cmp_solicitacoes s
   where s.obras_restricao_id = old.id
     and s.etapa not in ('cancelada', 'recusada')
   order by (s.ambiente = 'producao') desc, s.numero desc
   limit 1;
  if found then
    raise exception 'OBRAS_MATERIAL: Esta restrição tem a solicitação #% no Compras. Cancele lá antes.', v_numero
      using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_restricao_compra_ativa_guarda() from public, anon, authenticated;

drop trigger if exists obras_restricao_compra_ativa_guarda on public.obras_restricao;
create trigger obras_restricao_compra_ativa_guarda
  before delete or update of tipo on public.obras_restricao
  for each row execute function public.obras_restricao_compra_ativa_guarda();

commit;

-- ============================================================
-- VERIFICAÇÃO (rodar depois do commit; qualquer FALHOU = parar e não deployar)
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado is not distinct from esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'obras_material_resposta existe com RLS', 'true',
      (select relrowsecurity::text from pg_class where oid = to_regclass('public.obras_material_resposta'))),
  (2, 'colunas da resposta', 'atividade_numero:integer:NO|criado_em:timestamp with time zone:NO|criado_por:text:YES|id:uuid:NO|obra_id:uuid:NO',
      (select string_agg(column_name || ':' || data_type || ':' || is_nullable, '|' order by column_name)
         from information_schema.columns where table_schema = 'public' and table_name = 'obras_material_resposta')),
  (3, 'unique (obra_id, atividade_numero), check > 0 e FK cascade para obras_obra', 'u|c|c',
      (select contype::text from pg_constraint where conname = 'obras_material_resposta_obra_id_atividade_numero_key')
      || '|' || (select contype::text from pg_constraint where conname = 'obras_material_resposta_atividade_numero_check')
      || '|' || (select confdeltype::text from pg_constraint
                  where conrelid = 'public.obras_material_resposta'::regclass and contype = 'f'
                    and confrelid = 'public.obras_obra'::regclass)),
  (4, 'policies da resposta: select/insert/delete com obras_has_access, sem update', 'DELETE,INSERT,SELECT|true',
      (select string_agg(cmd, ',' order by cmd) || '|'
              || bool_and(coalesce(qual, '') || coalesce(with_check, '') like '%obras_has_access%')::text
         from pg_policies where schemaname = 'public' and tablename = 'obras_material_resposta')),
  (5, 'privilégios da resposta: authenticated select/insert/delete sem update; anon nada', 'true|true|true|false|false',
      has_table_privilege('authenticated', 'public.obras_material_resposta', 'SELECT')::text
      || '|' || has_table_privilege('authenticated', 'public.obras_material_resposta', 'INSERT')::text
      || '|' || has_table_privilege('authenticated', 'public.obras_material_resposta', 'DELETE')::text
      || '|' || has_table_privilege('authenticated', 'public.obras_material_resposta', 'UPDATE')::text
      || '|' || has_table_privilege('anon', 'public.obras_material_resposta', 'SELECT,INSERT,UPDATE,DELETE')::text),
  (6, 'triggers novos ligados (autoria da resposta e trava da restrição)', '2',
      (select count(*)::text from pg_trigger
        where not tgisinternal and tgenabled = 'O'
          and ((tgname = 'obras_material_resposta_autoria' and tgrelid = 'public.obras_material_resposta'::regclass)
            or (tgname = 'obras_restricao_compra_ativa_guarda' and tgrelid = 'public.obras_restricao'::regclass)))),
  (7, 'trava: before delete e update of tipo; definer; fechada para authenticated/anon', 'true|true|false',
      (select (pg_get_triggerdef(oid) like '%BEFORE DELETE OR UPDATE OF tipo%')::text
         from pg_trigger where tgname = 'obras_restricao_compra_ativa_guarda')
      || '|' || (select prosecdef::text from pg_proc where oid = 'public.obras_restricao_compra_ativa_guarda()'::regprocedure)
      || '|' || (has_function_privilege('authenticated', 'public.obras_restricao_compra_ativa_guarda()', 'EXECUTE')
              or has_function_privilege('anon', 'public.obras_restricao_compra_ativa_guarda()', 'EXECUTE'))::text),
  (8, 'trava confere etapa fora de cancelada/recusada e usa a mensagem OBRAS_MATERIAL', 'true',
      (select (prosrc like '%s.etapa not in (''cancelada'', ''recusada'')%'
               and prosrc like '%OBRAS_MATERIAL: Esta restrição tem a solicitação #% no Compras. Cancele lá antes.%')::text
         from pg_proc where oid = 'public.obras_restricao_compra_ativa_guarda()'::regprocedure)),
  (9, 'leituras: definer, search_path fixo, authenticated e service_role executam, anon não', 'true|true|true|false',
      (select bool_and(p.prosecdef)::text
              || '|' || bool_and(array_to_string(p.proconfig, ',') like '%search_path=pg_catalog, public%')::text
              || '|' || bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')
                                 and has_function_privilege('service_role', p.oid, 'EXECUTE'))::text
              || '|' || bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))::text
         from pg_proc p
        where p.oid in ('public.obras_compras_prazos()'::regprocedure, 'public.obras_restricao_compras(uuid)'::regprocedure))),
  (10, 'obras_restricao_compras: nenhuma coluna de valor/centavos/total/frete', '0',
      (select count(*)::text
         from pg_proc p, unnest(p.proargnames) a
        where p.oid = 'public.obras_restricao_compras(uuid)'::regprocedure
          and a ~* '(valor|centavos|total|frete)')),
  (11, 'obras_restricao_compras: só produção e join na restrição da mesma obra', 'true',
      (select (prosrc like '%r.id = s.obras_restricao_id and r.obra_id = p_obra%'
               and prosrc like '%s.ambiente = ''producao''%' and prosrc like '%p.ambiente = ''producao''%')::text
         from pg_proc where oid = 'public.obras_restricao_compras(uuid)'::regprocedure))
) as t(n, verificacao, esperado, encontrado)
order by n;
