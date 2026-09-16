-- ============================================================
-- Controle de Obras — histórico de alterações (J4, seção D) — 2026-09-15
-- Migration da spec-historico-alteracoes-2026-09-15.md
-- Revisão 2026-09-15 (review-historico-2026-09-15.md): corrige B1 (lista de
-- colunas do UPDATE incompleta + RPC aceitava chave desconhecida em
-- silêncio), M4 (clock_timestamp vs now()) e M5 (desempate de created_at).
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar (AGENTS.md).
--
-- IDEMPOTENTE por construção: create table if not exists, create or replace
-- function, drop policy if exists antes de recriar.
--
-- Esta migration NÃO cria nenhuma trigger — ver spec §5 para por quê. A única
-- função nova, obras_aplicar_alteracao, roda "security invoker" (não
-- definer): ela herda a RLS de obras_obra e obras_historico, não eleva
-- privilégio. As duas armadilhas de PL/pgSQL do AGENTS.md não se aplicam
-- aqui: (1) não há guarda de autorização que possa devolver NULL —
-- obras_has_access() já é exists()-based, e o e-mail nulo é checado à parte;
-- (2) não há trigger compartilhada entre tabelas.
--
-- B1 (bloqueador da review de 2026-09-15): a lista de colunas do
-- `set`/`select` do UPDATE é ESTÁTICA de propósito (sem SQL dinâmico) — mas
-- precisa cobrir TODA coluna de obras_obra que alguma tela escreve, não só
-- as rastreadas no histórico. As duas listas (esta aqui vs. a lista de
-- rastreamento em app/obras/_lib/historico.ts) são propositalmente
-- DIFERENTES: uma decide "o que o update aceita mudar", a outra decide "o
-- que vira linha de histórico" — ver spec §6, tabela "Deliberadamente fora
-- da lista". Confundir as duas foi o defeito original: uma coluna fora da
-- lista do UPDATE era descartada em silêncio, sem erro, sem aviso. A
-- correção tem duas partes: (1) a lista do UPDATE agora cobre também as 9
-- colunas de bookkeeping que faltavam (bloqueio, pendencia, pend_resp,
-- pend_prazo, prox_acao, inicio_real, fim_real, nao_andou_seguidos,
-- bloqueada_dias); (2) a função RECUSA (raise exception) qualquer chave em
-- p_campos que não esteja em v_colunas_validas, em vez de ignorá-la — falha
-- alta, não silenciosa.
-- ============================================================

begin;

-- ============================================================
-- 1. TABELA
-- ============================================================
create table if not exists public.obras_historico (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  bloco text not null,
  campo text not null,
  de text,
  para text,
  motivo text,
  quem text not null,
  created_at timestamptz not null default now(),
  -- Desempate de exibição (M5 da review): linhas da MESMA chamada
  -- compartilham created_at (v_quando é fixado uma vez por chamada da RPC,
  -- spec §7) — sem uma coluna de ordem própria, o Postgres pode devolver
  -- essas linhas em qualquer ordem entre uma leitura e outra. `seq` é
  -- estritamente crescente por ordem de inserção (bigserial), então
  -- `order by created_at desc, seq desc` é sempre determinístico.
  seq bigserial not null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.obras_historico'::regclass
      and conname = 'obras_historico_bloco_check'
  ) then
    alter table public.obras_historico
      add constraint obras_historico_bloco_check
      check (bloco in ('Triagem','Autorização','Identificação','Cronograma','Esteira'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.obras_historico'::regclass
      and conname = 'obras_historico_campo_check'
  ) then
    alter table public.obras_historico
      add constraint obras_historico_campo_check
      check (campo in (
        'pcm','equipe','prioridade','inicio_plan','duracao',
        'liberado_por','liberado_em','os_aprovada_em',
        'tipo','valor','origem','analista_cliente','mau_uso',
        'etapa','marco_exec_fim','marco_relatorio','marco_fechou_os',
        'marco_liberou_fat','marco_faturou'
      ));
  end if;
end
$$;

create index if not exists obras_historico_obra_idx
  on public.obras_historico (obra_id, created_at desc, seq desc);

-- ============================================================
-- 2. RLS
-- ============================================================
alter table public.obras_historico enable row level security;

drop policy if exists "obras historico leitura" on public.obras_historico;
create policy "obras historico leitura" on public.obras_historico
  for select to authenticated
  using (public.obras_has_access());

drop policy if exists "obras historico escrita" on public.obras_historico;
create policy "obras historico escrita" on public.obras_historico
  for insert to authenticated
  with check (
    public.obras_has_access()
    and quem = lower(trim(auth.jwt() ->> 'email'))
  );

-- Sem policy de update nem delete, de propósito: histórico é append-only.
-- (M7 da review: a policy acima não impede quem TEM acesso de forjar
-- CONTEÚDO de uma linha própria — só impede forjar autor. Aceito por
-- enquanto, registrado aqui; corrigir exigiria abrir mão de security
-- invoker ou de expor a tabela via REST, decisão maior que este fix round.)

-- ============================================================
-- 3. RPC — update de obras_obra + insert de obras_historico, atômico
-- ============================================================
create or replace function public.obras_aplicar_alteracao(
  p_obra_id uuid,
  p_campos jsonb,
  p_linhas jsonb
)
returns public.obras_obra
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_quem   text := lower(trim(auth.jwt() ->> 'email'));
  v_quando timestamptz := now();
  v_obra   public.obras_obra;
  v_chave  text;
  -- Toda coluna de obras_obra que alguma tela deste módulo escreve por
  -- update (Triagem, Ficha, Esteira) — NÃO é a mesma lista de
  -- CampoHistorico (essa fica em app/obras/_lib/historico.ts): as colunas
  -- de bookkeeping (bloqueio, pendencia, pend_resp, pend_prazo, prox_acao,
  -- inicio_real, fim_real, nao_andou_seguidos, bloqueada_dias) mudam junto
  -- com uma ação de tela mas não geram linha de histórico (spec §6). As
  -- colunas do Field (os, loja, descricao, field_id, fonte, ...) ficam de
  -- fora de propósito — decisão 9, só leitura na tela.
  v_colunas_validas text[] := array[
    'pcm','equipe','prioridade','inicio_plan','duracao',
    'liberado_por','liberado_em','aprovacao','os_aprovada','marco_os_aprov',
    'tipo','valor','origem','analista_cliente','mau_uso',
    'etapa','desde_etapa','etapa_por','etapa_em','atualizacao',
    'marco_exec_fim','marco_relatorio','marco_fechou_os','marco_liberou_fat','marco_faturou',
    'bloqueio','pendencia','pend_resp','pend_prazo','prox_acao',
    'inicio_real','fim_real','nao_andou_seguidos','bloqueada_dias'
  ];
begin
  if not public.obras_has_access() then
    raise exception 'Sem acesso ao Controle de Obras' using errcode = '42501';
  end if;
  if v_quem is null or v_quem = '' then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  -- B1: falha alta em vez de ignorar em silêncio. Sem isto, uma chave fora
  -- de v_colunas_validas passava por jsonb_populate_record sem erro e o
  -- valor nunca era atribuído (a lista do `set` abaixo é quem decide o que
  -- realmente grava) — sucesso reportado, campo não mudou.
  for v_chave in select jsonb_object_keys(coalesce(p_campos, '{}'::jsonb)) loop
    if not (v_chave = any(v_colunas_validas)) then
      raise exception 'obras_aplicar_alteracao: coluna desconhecida em p_campos: %', v_chave
        using errcode = '22023';
    end if;
  end loop;

  update public.obras_obra o set (
    pcm, equipe, prioridade, inicio_plan, duracao,
    liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
    tipo, valor, origem, analista_cliente, mau_uso,
    etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
    marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou,
    bloqueio, pendencia, pend_resp, pend_prazo, prox_acao,
    inicio_real, fim_real, nao_andou_seguidos, bloqueada_dias
  ) = (
    select
      pcm, equipe, prioridade, inicio_plan, duracao,
      liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
      tipo, valor, origem, analista_cliente, mau_uso,
      etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
      marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou,
      bloqueio, pendencia, pend_resp, pend_prazo, prox_acao,
      inicio_real, fim_real, nao_andou_seguidos, bloqueada_dias
    from jsonb_populate_record(o, coalesce(p_campos, '{}'::jsonb))
  )
  where o.id = p_obra_id
  returning * into v_obra;

  if not found then
    raise exception 'Obra não encontrada ou sem permissão' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(p_linhas, '[]'::jsonb)) > 0 then
    insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
    select p_obra_id, x.bloco, x.campo, x.de, x.para, x.motivo, v_quem, v_quando
    from jsonb_to_recordset(p_linhas) as x(bloco text, campo text, de text, para text, motivo text);
  end if;

  return v_obra;
end;
$$;

revoke execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) to authenticated;

commit;

-- ============================================================
-- 4. DEPOIS DE RODAR — SQL de verificação (padrão RUNBOOK-ir-ao-ar.md)
-- ============================================================
-- (a) tabela, índice e as 2 policies existem:
--
-- select table_name from information_schema.tables
--  where table_schema = 'public' and table_name = 'obras_historico';
-- select policyname from pg_policies
--  where schemaname = 'public' and tablename = 'obras_historico';
--   -- espera 2 linhas: "obras historico leitura", "obras historico escrita"
--
-- (b) a função existe e está travada de public/anon:
--
-- select routine_name from information_schema.routines
--  where routine_schema = 'public' and routine_name = 'obras_aplicar_alteracao';
-- select grantee, privilege_type from information_schema.role_routine_grants
--  where routine_name = 'obras_aplicar_alteracao';
--   -- espera só "authenticated" com EXECUTE
--
-- (c) ponta a ponta, rodando COMO POSTGRES (SQL Editor/MCP): confirma que
-- SEM JWT a função recusa por "Não autenticado" (v_quem nulo), não por erro
-- de sintaxe — prova que a guarda funciona:
--
-- select public.obras_aplicar_alteracao(
--   (select id from public.obras_obra limit 1),
--   '{}'::jsonb, '[]'::jsonb
-- );
--   -- espera erro 28000 "Não autenticado" (rodando sem JWT, auth.jwt() é null)
--
-- (d) B1 — confirma que uma coluna desconhecida em p_campos é RECUSADA, não
-- ignorada em silêncio (rodar autenticado como um usuário com acesso, via
-- SQL Editor "Run as" ou pelo app; sem isso o teste (c) já barra antes):
--
-- select public.obras_aplicar_alteracao(
--   (select id from public.obras_obra limit 1),
--   '{"coluna_que_nao_existe": "x"}'::jsonb, '[]'::jsonb
-- );
--   -- espera erro 22023 "obras_aplicar_alteracao: coluna desconhecida em
--   -- p_campos: coluna_que_nao_existe"
-- ============================================================
