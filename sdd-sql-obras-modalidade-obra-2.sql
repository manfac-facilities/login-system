-- ============================================================
-- Gestão de Obras — modalidade OBRA (fase 1), correções do review final — 2026-10-29
-- Review: .superpowers/sdd/2026-10-29-obras-modalidade-obra-fase1/final-review.md (C1, I1, I2)
-- Depende de: sdd-sql-obras-modalidade-obra.sql (JÁ APLICADO; este arquivo não o altera)
-- Teste de comportamento: docs/obras/2026-10-29-verificacao-modalidade-obra-2.sql
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar (AGENTS.md).
--
-- O QUE MUDA
--   C1. RPC obras_aplicar_alteracao aceita a coluna `modalidade` (no FIM das
--       três listas: v_colunas_validas, `set (...)` e `select`). Sem isso o
--       "Tornar OBRA"/"Voltar para SPOT" da ficha falha sempre com
--       22023 coluna desconhecida. Resto da RPC IDÊNTICO ao de
--       sdd-sql-obras-agendamento-diario.sql (security invoker, search_path
--       pg_catalog, public). A guarda obras_obra_parametros_guarda continua
--       limitando a mudança de modalidade a administrador.
--   I1. Bucket obras-fotos: objeto com `/rdo/` no nome
--         - não pode ser atualizado (sobrescrito/movido) por usuário;
--         - só pode ser apagado se nenhuma obras_rdo_foto com esse path
--           pertencer a RDO fora de rascunho (validado/enviado).
--       Fotos fora de /rdo/ (diário SPOT, impedimento) seguem como estavam:
--       update permitido, delete sem policy (negado).
--   I2. Cronograma e execução, numa sessão de usuário (JWT com e-mail):
--         - obras_cronograma_versao, obras_atividade (insert/update/delete) e
--           obras_atividade_exec (insert/update): só o engenheiro da obra
--           (obras_obra.engenheiro_email) ou administrador;
--         - versão nasce rascunho (salva_em nulo) e com numero = max + 1;
--         - salvar a versão (salva_em nulo -> não nulo) exige >= 1 atividade
--           e, na v1, obras_obra.data_base preenchida;
--         - execução: atividade com bloqueia_por_trava (na versão vigente —
--           maior numero salvo — ou, sem nenhuma salva, no rascunho) não
--           avança (em_andamento/concluido/percentual > 0) enquanto a
--           atividade-trava da obra não está 'concluido' em
--           obras_atividade_exec -> OBRAS_TRAVA.
--       Sem JWT (service role, seed, SQL Editor) tudo passa, como nos
--       triggers de sdd-sql-obras-modalidade-obra.sql.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim do arquivo — qualquer
--            *** FALHOU *** = parar e não deployar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-10-29-verificacao-modalidade-obra-2.sql.
--
-- IDEMPOTENTE: create or replace function, drop trigger/policy if exists antes
-- de recriar. A RPC só é recriada se ainda não cita `modalidade` (seção 1).
--
-- ARMADILHAS DO .claude/rules/sql.md
--   (1) Guarda que falha ABERTA com NULL: a checagem de engenheiro/admin é a
--       função obras_engenheiro_ou_admin(), que devolve coalesce(..., false);
--       os triggers usam `is not true`.
--   (2) Trigger compartilhada: não há — uma função por tabela.
--
-- ROLLBACK (não apaga dado):
--   begin;
--   drop trigger if exists obras_versao_guarda on public.obras_cronograma_versao;
--   drop trigger if exists obras_atividade_guarda on public.obras_atividade;
--   drop trigger if exists obras_atividade_exec_guarda on public.obras_atividade_exec;
--   drop trigger if exists obras_atividade_exec_trava on public.obras_atividade_exec;
--   drop policy if exists "obras fotos delete" on storage.objects;
--   alter policy "obras fotos update" on storage.objects
--     using (((bucket_id = 'obras-fotos'::text) AND (select obras_has_access())))
--     with check (((bucket_id = 'obras-fotos'::text) AND (select obras_has_access())));
--   -- RPC: rodar a seção 4 de sdd-sql-obras-agendamento-diario.sql (só depois
--   -- de reverter o código que grava modalidade pela ficha).
--   commit;
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (aborta a transação se faltar algum)
-- ============================================================
do $$
declare
  v_def text;
begin
  if to_regprocedure('public.obras_has_access()') is null
     or to_regprocedure('public.obras_is_admin()') is null then
    raise exception 'Pré-requisito ausente: obras_has_access()/obras_is_admin() (sdd-sql-obras-v0.sql). Nada foi alterado.';
  end if;

  if to_regclass('public.obras_cronograma_versao') is null
     or to_regclass('public.obras_atividade') is null
     or to_regclass('public.obras_atividade_exec') is null
     or to_regclass('public.obras_rdo') is null
     or to_regclass('public.obras_rdo_foto') is null
     or (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'obras_obra'
            and column_name in ('modalidade','data_base','engenheiro_email','atividade_trava')) <> 4 then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra.sql não está aplicado. Nada foi alterado.';
  end if;

  if to_regprocedure('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)') is null then
    raise exception 'Pré-requisito ausente: public.obras_aplicar_alteracao(uuid, jsonb, jsonb). Nada foi alterado.';
  end if;

  -- A RPC é substituída INTEIRA. Só com a versão conhecida (agendamento-diario,
  -- md5 de pg_get_functiondef medido em produção em 29/10/2026) ou se ela já
  -- aceita modalidade (reaplicação: a seção 1 não mexe nela).
  v_def := pg_get_functiondef('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'::regprocedure);
  if position('modalidade' in v_def) = 0
     and md5(v_def) <> '2e26a7d4662f7e3c4d1298c163702bcf' then
    raise exception 'A RPC obras_aplicar_alteracao em produção não é a de sdd-sql-obras-agendamento-diario.sql (md5 de pg_get_functiondef = %). Esta migration a substituiria inteira e apagaria a mudança. Confira antes. Nada foi alterado.', md5(v_def);
  end if;

  if (select count(*) from pg_policies
       where schemaname = 'storage' and tablename = 'objects'
         and policyname in ('obras fotos upload','obras fotos read','obras fotos update')) <> 3 then
    raise exception 'Pré-requisito ausente: policies "obras fotos upload/read/update" em storage.objects (sdd-sql-obras-v0.sql, seção 7). Nada foi alterado.';
  end if;
end
$$;

-- ============================================================
-- 1. C1 — RPC obras_aplicar_alteracao aceita `modalidade`.
--    IDÊNTICA à da seção 4 de sdd-sql-obras-agendamento-diario.sql, com
--    `modalidade` acrescentada no FIM das três listas. Não escreva o nome da
--    coluna em comentário DENTRO do corpo: a verificação 1 conta as ocorrências.
--    Se a RPC já cita a coluna (reaplicação), nada é feito.
-- ============================================================
do $do$
begin
  if position('modalidade' in pg_get_functiondef('public.obras_aplicar_alteracao(uuid,jsonb,jsonb)'::regprocedure)) > 0 then
    raise notice 'obras_aplicar_alteracao já aceita modalidade — mantida como está.';
    return;
  end if;

  execute $fn$
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
  v_colunas_validas text[] := array[
    'pcm','equipe','prioridade','inicio_plan','duracao',
    'liberado_por','liberado_em','aprovacao','os_aprovada','marco_os_aprov',
    'tipo','valor','origem','analista_cliente','mau_uso',
    'etapa','desde_etapa','etapa_por','etapa_em','atualizacao',
    'marco_exec_fim','marco_relatorio','marco_fechou_os','marco_liberou_fat','marco_faturou',
    'bloqueio','pendencia','pend_resp','pend_prazo','prox_acao',
    'inicio_real','fim_real','nao_andou_seguidos','bloqueada_dias',
    'cancelado_por','cancelado_obs','cancelado_em','cancelado_quem','cancelado_etapa_anterior',
    'diario_agendado_ate','diario_agendado_oque','diario_agendado_motivo','diario_agendado_por','diario_agendado_em',
    'modalidade'
  ];
begin
  if not public.obras_has_access() then
    raise exception 'Sem acesso ao Controle de Obras' using errcode = '42501';
  end if;
  if v_quem is null or v_quem = '' then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

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
    inicio_real, fim_real, nao_andou_seguidos, bloqueada_dias,
    cancelado_por, cancelado_obs, cancelado_em, cancelado_quem, cancelado_etapa_anterior,
    diario_agendado_ate, diario_agendado_oque, diario_agendado_motivo, diario_agendado_por, diario_agendado_em,
    modalidade
  ) = (
    select
      pcm, equipe, prioridade, inicio_plan, duracao,
      liberado_por, liberado_em, aprovacao, os_aprovada, marco_os_aprov,
      tipo, valor, origem, analista_cliente, mau_uso,
      etapa, desde_etapa, etapa_por, etapa_em, atualizacao,
      marco_exec_fim, marco_relatorio, marco_fechou_os, marco_liberou_fat, marco_faturou,
      bloqueio, pendencia, pend_resp, pend_prazo, prox_acao,
      inicio_real, fim_real, nao_andou_seguidos, bloqueada_dias,
      cancelado_por, cancelado_obs, cancelado_em, cancelado_quem, cancelado_etapa_anterior,
      diario_agendado_ate, diario_agendado_oque, diario_agendado_motivo, diario_agendado_por, diario_agendado_em,
      modalidade
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
$$
$fn$;
end
$do$;

revoke execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.obras_aplicar_alteracao(uuid, jsonb, jsonb) to authenticated;

-- ============================================================
-- 2. I1 — fotos do RDO não são sobrescritas nem apagadas depois da validação.
--    Caminho da foto do RDO: {obra_id}/rdo/{data}/{uuid}.jpg (= obras_rdo_foto.path).
--    obras_foto_rdo_congelada: security definer para ler obras_rdo_foto /
--    obras_rdo por cima da RLS (a guarda nunca falha aberta por não enxergar
--    a linha). exists() devolve sempre true/false.
-- ============================================================
create or replace function public.obras_foto_rdo_congelada(p_path text)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
      from public.obras_rdo_foto f
      join public.obras_rdo r on r.id = f.rdo_id
     where f.path = p_path
       and r.estado <> 'rascunho'
  );
$$;
revoke execute on function public.obras_foto_rdo_congelada(text) from public, anon;
grant execute on function public.obras_foto_rdo_congelada(text) to authenticated;

-- Update (upsert/move): continua para as fotos do diário SPOT e de
-- impedimento; nunca para /rdo/ (o upload do RDO usa nome único, sem upsert).
drop policy if exists "obras fotos update" on storage.objects;
create policy "obras fotos update" on storage.objects for update to authenticated
  using (bucket_id = 'obras-fotos' and (select public.obras_has_access())
         and name not like '%/rdo/%')
  with check (bucket_id = 'obras-fotos' and (select public.obras_has_access())
              and name not like '%/rdo/%');

-- Delete: só foto de RDO ainda não validado. Fora de /rdo/ continua sem
-- policy de delete (negado), como antes.
drop policy if exists "obras fotos delete" on storage.objects;
create policy "obras fotos delete" on storage.objects for delete to authenticated
  using (bucket_id = 'obras-fotos' and (select public.obras_has_access())
         and name like '%/rdo/%'
         and public.obras_foto_rdo_congelada(name) is not true);

commit;
