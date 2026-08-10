-- sdd-sql-track-c-integridade.sql
-- Track C sub-projeto 1 (integridade de dados): move 3 sequências de
-- escrita multi-tabela/leitura-então-escrita, hoje feitas em passos
-- separados pela aplicação, para dentro de functions atômicas do
-- Postgres. Rodar manualmente no Supabase Dashboard (projeto
-- iyytcavcgukfjnjjrerx) ANTES do deploy do código desta spec — as
-- Server Actions passam a chamar essas functions via supabase.rpc().
--
-- Fecha os achados B-13 (race condition no lançamento de KM), B-06
-- (reatribuição de equipe no checklist sem transação) e B-18 (exclusão em
-- massa de multas sem audit log atômico).
--
-- ESTADO: APLICADO EM PRODUÇÃO em 2026-08-10 (iyytcavcgukfjnjjrerx, migration
-- `track_c_integridade_functions_atomicas`), com as três dependências abaixo já
-- aplicadas na mesma data. Verificado por teste funcional em transação
-- revertida, com request.jwt.claims forjado por identidade:
--   guarda de acesso    -> usuário sem acesso ao sofia é bloqueado nas 3
--   lancar_km_atomico   -> grava km_diario e atualiza veiculos.km_atual
--   regra de KM menor   -> levanta SOF01 com a mensagem em pt-BR ("2.214 km"),
--                          que é o texto que a Server Action mostra ao usuário
--   atribuir_responsab. -> troca deixa exatamente 1 histórico aberto;
--                          finalizacao_contrato deixa o veículo inativo e sem equipe
--   excluir_multas      -> apaga a multa e grava 1 linha em audit_log com
--                          usuario_id vindo de auth.uid()
--
-- ORDEM OBRIGATÓRIA — este arquivo é o ÚLTIMO da fila. Depende de:
--   1. sdd-sql-v04.sql            → cria a constraint unique (data, veiculo_id)
--                                   usada pelo "on conflict" de lancar_km_atomico
--   2. sdd-sql-v04-seguranca.sql  → cria sofia_has_access()/sofia_is_admin(),
--                                   usadas nas guardas abaixo, e derruba o
--                                   NOT NULL de audit_log.acao/dados, sem o
--                                   qual excluir_multas_em_massa falha
--   3. sdd-sql-track-b.sql        → (independente destas functions, mas também
--                                   pendente; rodar antes do deploy)
--   4. este arquivo
-- Idempotente: são 3 "create or replace function", pode rodar quantas vezes
-- precisar.
--
-- SEGURANÇA: as 3 functions são "security definer", ou seja, ignoram RLS.
-- O PostgREST expõe toda function do schema public como endpoint /rpc/, e o
-- Postgres concede EXECUTE a PUBLIC por padrão — sem as guardas e o
-- revoke/grant do fim deste arquivo, qualquer usuário autenticado do Hub
-- (mesmo sem acesso liberado ao sofia) chamaria estas functions direto do
-- navegador, reabrindo os achados B-01/B-04 fechados no pacote de segurança.
--
-- Erros de regra de negócio usam o SQLSTATE customizado 'SOF01' — é assim que
-- a Server Action distingue "mensagem que pode ser mostrada ao usuário" de
-- erro interno do banco, que vira mensagem genérica.
--
-- PENDÊNCIA CONHECIDA (achado do code review de 2026-08-10, não corrigido):
-- o PostgREST escolhe o status HTTP pela classe do SQLSTATE, e a classe 'SO'
-- não casa com nenhuma regra dele, então cai no 500 genérico. Ou seja, um
-- usuário digitar KM menor que a atual — validação rotineira — é registrado
-- como erro 5xx nos logs do Supabase e do Next, enquanto o "sem acesso"
-- (raise sem errcode, vira P0001) responde 400 corretamente. O usuário final
-- não é afetado: a mensagem certa aparece, porque o corpo JSON traz o code e a
-- action testa error.code === 'SOF01'.
-- A correção seria trocar por 'PT400', que o PostgREST mapeia pra 400 — mas
-- isso exige confirmar que ele continua devolvendo o code no corpo, senão a
-- action cai na mensagem genérica e o usuário perde o "KM não pode ser menor
-- que…". Como só dá pra confirmar isso com um JWT real batendo em /rpc/, e o
-- efeito hoje é só ruído de log, ficou pendente de decisão em vez de trocado
-- às cegas.

-- ============================================================
-- 1. lancar_km_atomico (fecha B-13 — race condition no lançamento de KM)
-- ============================================================
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
set search_path = pg_catalog, public
as $$
declare
  v_km_atual_veiculo integer;
begin
  -- "is not true" e não "not ...": se a função devolver NULL (JWT sem claim de
  -- e-mail), "if not NULL" não dispara e a guarda falharia ABERTO. As funções
  -- já usam coalesce desde sdd-sql-v04-seguranca.sql; isto é a segunda camada.
  if public.sofia_has_access() is not true then
    raise exception 'Sem acesso ao sistema de Gestão de Frotas';
  end if;

  select km_atual into v_km_atual_veiculo
  from public.veiculos
  where id = p_veiculo_id
  for update;

  if v_km_atual_veiculo is null then
    raise exception 'Veículo não encontrado' using errcode = 'SOF01';
  end if;

  if p_km_atual < v_km_atual_veiculo then
    -- Formata em pt-BR (1.000) pra mensagem ficar idêntica à que a action
    -- montava em JS com toLocaleString('pt-BR'). O replace cobre o caso de
    -- lc_numeric usar vírgula como separador de milhar.
    raise exception 'KM não pode ser menor que a última KM registrada (% km)',
      replace(trim(to_char(v_km_atual_veiculo, '999G999G999')), ',', '.')
      using errcode = 'SOF01';
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

-- ============================================================
-- 2. atribuir_responsabilidade_veiculo (fecha B-06 — reatribuição de
--    equipe/motorista no checklist sem transação)
-- ============================================================
create or replace function public.atribuir_responsabilidade_veiculo(
  p_veiculo_id uuid,
  p_equipe_id uuid,       -- null para devolução/finalização de contrato
  p_motorista_id uuid,    -- pode ser null
  p_tipo text,            -- 'troca' | 'recebimento' | 'devolucao' | 'finalizacao_contrato'
  p_checklist_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_hoje date := current_date;
begin
  -- "is not true" e não "not ...": se a função devolver NULL (JWT sem claim de
  -- e-mail), "if not NULL" não dispara e a guarda falharia ABERTO. As funções
  -- já usam coalesce desde sdd-sql-v04-seguranca.sql; isto é a segunda camada.
  if public.sofia_has_access() is not true then
    raise exception 'Sem acesso ao sistema de Gestão de Frotas';
  end if;

  perform 1 from public.veiculos where id = p_veiculo_id for update;

  -- Sem esta checagem, um p_veiculo_id inexistente não trava linha nenhuma, os
  -- 3 updates seguintes afetam 0 linhas e a function retorna sucesso: a action
  -- responderia {success:true} e ainda gravaria auditoria dizendo que a equipe
  -- foi reatribuída. Mesmo comportamento de lancar_km_atomico.
  if not found then
    raise exception 'Veículo não encontrado' using errcode = 'SOF01';
  end if;

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

-- ============================================================
-- 3. excluir_multas_em_massa (fecha B-18 — exclusão em massa sem
--    atomicidade entre delete e audit log)
-- ============================================================
-- Assinatura antiga (com p_usuario_id) descartada: o autor da auditoria não pode
-- vir do cliente. "create or replace" não troca assinatura, criaria overload.
drop function if exists public.excluir_multas_em_massa(uuid[], uuid);

create or replace function public.excluir_multas_em_massa(
  p_ids uuid[]
)
returns setof public.multas
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_multa record;
begin
  if public.sofia_is_admin() is not true then
    raise exception 'Apenas administradores podem excluir multas';
  end if;

  for v_multa in
    delete from public.multas where id = any(p_ids) returning *
  loop
    -- auth.uid() vem do JWT, não do parâmetro: a function é "security definer"
    -- e alcançável direto em /rpc/, então um autor recebido do cliente poderia
    -- ser forjado — justamente o rastro que o B-18 existe pra garantir.
    insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id)
    values (
      'multas', 'excluiu', v_multa.id::text,
      'Multa excluída em massa — ' || coalesce(v_multa.tipo_infracao, v_multa.descricao, v_multa.id::text),
      auth.uid()
    );
    return next v_multa;
  end loop;
end;
$$;

-- ============================================================
-- 4. Permissões de execução
--    "create function" concede EXECUTE a PUBLIC por padrão, e o PostgREST
--    expõe /rpc/<function> pra quem tiver token. Tirar de PUBLIC/anon e
--    deixar só "authenticated" — a autorização de verdade é a guarda
--    sofia_has_access()/sofia_is_admin() dentro de cada function.
-- ============================================================
revoke execute on function public.lancar_km_atomico(uuid, uuid, uuid, integer, date, text) from public, anon;
revoke execute on function public.atribuir_responsabilidade_veiculo(uuid, uuid, uuid, text, uuid) from public, anon;
revoke execute on function public.excluir_multas_em_massa(uuid[]) from public, anon;

grant execute on function public.lancar_km_atomico(uuid, uuid, uuid, integer, date, text) to authenticated;
grant execute on function public.atribuir_responsabilidade_veiculo(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.excluir_multas_em_massa(uuid[]) to authenticated;
