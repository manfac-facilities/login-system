-- ============================================================
-- *** NÃO APLICADO / NUNCA RODOU *** (escrito em 26/10/2026, branch feat/frotas-f1-f3)
-- Gestão de Frotas (Sofia) — F1/F2/F3: editar equipe, corrigir KM diário,
-- corrigir abastecimento — 2026-10-26
-- Spec: docs/frotas/2026-10-26-spec-f1-f2-f3.md
-- Revisão (prevalece): docs/frotas/2026-10-26-revisao-spec-f1-f2-f3.md
--   (B1, B2, B3, B6, B9 aplicados neste arquivo)
--
-- DEPENDÊNCIA: sdd-sql-sofia-gestor-frotas.sql (tabela sofia_gestores e
-- função sofia_pode_gerir()). A seção 0 ABORTA se ele não estiver aplicado.
--
-- ORDEM: sdd-sql-sofia-gestor-frotas.sql (+ teste, 37/37) -> ESTE (12/12)
--        -> sdd-sql-sofia-correcoes-f1-f3-teste.sql (35/35) -> deploy do app.
-- Rodar como postgres (SQL Editor ou Management API com o PAT), projeto
-- iyytcavcgukfjnjjrerx. Idempotente: só "create or replace function" +
-- revoke/grant; pode rodar de novo.
--
-- As 3 funções são SECURITY INVOKER: a RLS "sofia access" continua valendo
-- e a guarda sofia_pode_gerir() só estreita para admin/gestor. Nenhum
-- trigger, policy, tabela ou coluna é criado ou alterado.
--
-- Regras de negócio levantam errcode 'SOF01' (a Server Action mostra o
-- texto); a guarda de permissão levanta P0001 (texto não chega ao usuário).
--
-- KM excedido (km_excedido_desconto): NENHUMA destas funções mexe. A regra
-- depende da resposta do João (pergunta 1 do §8 da spec); até lá a Server
-- Action só AVISA quando o mês corrigido tem registro de KM excedido.
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS — aborta a transação se algo não estiver como a spec leu
-- ============================================================
do $$
declare
  v_txt text;
begin
  if to_regprocedure('public.sofia_pode_gerir()') is null then
    raise exception 'ABORTADO: public.sofia_pode_gerir() não existe — aplique sdd-sql-sofia-gestor-frotas.sql antes';
  end if;
  if to_regclass('public.sofia_gestores') is null then
    raise exception 'ABORTADO: public.sofia_gestores não existe — aplique sdd-sql-sofia-gestor-frotas.sql antes';
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.km_diario'::regclass
                   and conname = 'km_diario_data_veiculo_id_key') then
    raise exception 'ABORTADO: unique (data, veiculo_id) de km_diario ausente (sdd-sql-v04.sql)';
  end if;
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'audit_log'
        and column_name in ('tabela','operacao','registro_id','descricao','usuario_id','usuario_email','dados')) <> 7 then
    raise exception 'ABORTADO: audit_log sem as 7 colunas esperadas';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'audit_log'
               and column_name in ('acao','dados') and is_nullable = 'NO') then
    raise exception 'ABORTADO: audit_log.acao/dados ainda NOT NULL (sdd-sql-v04-seguranca.sql seção 7)';
  end if;
  select data_type into v_txt from information_schema.columns
   where table_schema = 'public' and table_name = 'audit_log' and column_name = 'registro_id';
  if v_txt is distinct from 'text' then
    raise exception 'ABORTADO: audit_log.registro_id é % (esperado text)', v_txt;
  end if;
  select data_type into v_txt from information_schema.columns
   where table_schema = 'public' and table_name = 'km_diario' and column_name = 'km_atual';
  if v_txt is distinct from 'integer' then
    raise exception 'ABORTADO: km_diario.km_atual é % (esperado integer)', v_txt;
  end if;
  -- Triggers de usuário nas tabelas escritas: exatamente os 4 que a spec leu.
  -- Trigger desconhecido = parar e ler antes (pode bloquear ou duplicar escrita).
  select string_agg(tgname, ',' order by tgname) into v_txt
  from pg_trigger
  where not tgisinternal
    and tgrelid in ('public.equipes'::regclass, 'public.motoristas'::regclass,
                    'public.veiculos'::regclass, 'public.km_diario'::regclass,
                    'public.abastecimentos'::regclass,
                    'public.veiculo_responsabilidade_historico'::regclass,
                    'public.audit_log'::regclass);
  if v_txt is distinct from
     'trg_bloquear_escrita_abastecimentos,trg_bloquear_escrita_equipes,trg_bloquear_escrita_km_diario,trg_bloquear_escrita_veiculos' then
    raise exception 'ABORTADO: triggers diferentes do esperado: %', coalesce(v_txt, '(nenhum)');
  end if;
end;
$$;


-- ============================================================
-- 1. F2 — corrigir_km_atomico
-- ============================================================
create or replace function public.corrigir_km_atomico(
  p_km_id uuid,
  p_km_novo integer,
  p_motivo text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_veiculo_id uuid;
  v_veic record;
  v_lanc record;
  v_ant record;
  v_prox record;
  v_tem_ant boolean;
  v_tem_prox boolean;
  v_km_veiculo_novo integer;
  v_equipe text;
  v_motivo text := nullif(btrim(p_motivo), '');
  v_email text := lower(btrim(auth.jwt() ->> 'email'));
begin
  -- "is not true": sofia_pode_gerir() nunca deve devolver NULL, mas "if not NULL"
  -- não dispara e a guarda falharia ABERTO (.claude/rules/sql.md, armadilha 1).
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem corrigir lançamentos de KM';
  end if;

  if p_km_novo is null or p_km_novo < 0 then
    raise exception 'Informe o KM correto.' using errcode = 'SOF01';
  end if;

  -- 1ª leitura sem trava: só para saber qual veículo travar. A ordem de trava é
  -- veiculos -> km_diario, a mesma de lancar_km_atomico (sem deadlock, sem B-13).
  select k.veiculo_id into v_veiculo_id
  from public.km_diario k where k.id = p_km_id;
  if v_veiculo_id is null then
    raise exception 'Lançamento de KM não encontrado.' using errcode = 'SOF01';
  end if;

  select v.id, v.placa, v.km_atual into v_veic
  from public.veiculos v where v.id = v_veiculo_id
  for update;

  select k.id, k.data, k.km_atual, k.equipe_id, k.veiculo_id into v_lanc
  from public.km_diario k where k.id = p_km_id
  for update;
  if not found then
    raise exception 'Lançamento de KM não encontrado.' using errcode = 'SOF01';
  end if;
  -- (revisão B3) o veículo travado tem de ser o do lançamento já travado.
  if v_lanc.veiculo_id is distinct from v_veiculo_id then
    raise exception 'O lançamento mudou enquanto você corrigia. Recarregue a página e tente de novo.'
      using errcode = 'SOF01';
  end if;

  if p_km_novo = v_lanc.km_atual then
    raise exception 'O valor é igual ao lançado. Nada a corrigir.' using errcode = 'SOF01';
  end if;

  select k.data, k.km_atual into v_ant
  from public.km_diario k
  where k.veiculo_id = v_veiculo_id and k.data < v_lanc.data
  order by k.data desc
  limit 1;
  v_tem_ant := found;

  select k.data, k.km_atual into v_prox
  from public.km_diario k
  where k.veiculo_id = v_veiculo_id and k.data > v_lanc.data
  order by k.data asc
  limit 1;
  v_tem_prox := found;

  if v_tem_ant and p_km_novo < v_ant.km_atual then
    raise exception 'O KM não pode ser menor que o lançamento anterior: % km em %.',
      replace(trim(to_char(v_ant.km_atual, '999G999G999')), ',', '.'),
      to_char(v_ant.data, 'DD/MM/YYYY')
      using errcode = 'SOF01';
  end if;

  if v_tem_prox and p_km_novo > v_prox.km_atual then
    raise exception 'O KM não pode ser maior que o lançamento seguinte: % km em %.',
      replace(trim(to_char(v_prox.km_atual, '999G999G999')), ',', '.'),
      to_char(v_prox.data, 'DD/MM/YYYY')
      using errcode = 'SOF01';
  end if;

  update public.km_diario set km_atual = p_km_novo where id = p_km_id;

  -- KM atual do veículo = maior lançamento restante (diagnóstico §4 opção C).
  select max(k.km_atual) into v_km_veiculo_novo
  from public.km_diario k where k.veiculo_id = v_veiculo_id;

  if v_km_veiculo_novo is distinct from v_veic.km_atual then
    update public.veiculos set km_atual = v_km_veiculo_novo where id = v_veiculo_id;
  end if;

  select e.codigo into v_equipe from public.equipes e where e.id = v_lanc.equipe_id;

  -- usuario_id vem do JWT, nunca de parâmetro: o autor da correção não pode
  -- ser escolhido por quem chama /rpc/.
  insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id, usuario_email, dados)
  values (
    'km_diario', 'corrigiu', p_km_id::text,
    format('KM corrigido — %s · %s · lançamento de %s: %s → %s km',
           coalesce(v_equipe, '—'), v_veic.placa, to_char(v_lanc.data, 'DD/MM/YYYY'),
           v_lanc.km_atual, p_km_novo),
    auth.uid(),
    v_email,
    jsonb_build_object(
      'tipo', 'correcao_km',
      'contexto', jsonb_build_object('equipe', v_equipe, 'placa', v_veic.placa,
                                     'data', v_lanc.data, 'veiculo_id', v_veiculo_id),
      'antes', jsonb_build_object('km_atual', v_lanc.km_atual),
      'depois', jsonb_build_object('km_atual', p_km_novo),
      'km_veiculo', jsonb_build_object('antes', v_veic.km_atual, 'depois', v_km_veiculo_novo),
      'motivo', v_motivo,
      'autor', jsonb_build_object(
        'email', v_email,
        'nome', nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
        'papel', case when public.sofia_is_admin() then 'administrador' else 'gestor de frotas' end)
    )
  );

  -- veiculo_id e data voltam para a action conferir km_excedido_desconto do
  -- mês (correção obrigatória da revisão: nunca ficar em silêncio).
  return jsonb_build_object(
    'placa', v_veic.placa,
    'veiculo_id', v_veiculo_id,
    'data', v_lanc.data,
    'km_veiculo_antes', v_veic.km_atual,
    'km_veiculo_depois', v_km_veiculo_novo
  );
end;
$$;


-- ============================================================
-- 2. F3 — corrigir_abastecimento (NÃO mexe em veiculos.km_atual: decisão
--    aprovada no mockup — quem define o KM atual é o KM diário)
-- ============================================================
create or replace function public.corrigir_abastecimento(
  p_abastecimento_id uuid,
  p_litros numeric,
  p_valor numeric,
  p_km integer,
  p_motivo text
)
returns void
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_ab record;
  v_ant record;
  v_prox record;
  v_placa text;
  v_litros numeric := round(p_litros, 2);   -- colunas são numeric(8,2)/(10,2)
  v_valor numeric := round(p_valor, 2);
  v_antes jsonb := '{}'::jsonb;
  v_depois jsonb := '{}'::jsonb;
  v_motivo text := nullif(btrim(p_motivo), '');
  v_email text := lower(btrim(auth.jwt() ->> 'email'));
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem corrigir abastecimentos';
  end if;

  if v_litros is null or v_litros < 0 then
    raise exception 'Informe os litros abastecidos.' using errcode = 'SOF01';
  end if;
  if v_valor is null or v_valor < 0 then
    raise exception 'Informe o valor do abastecimento.' using errcode = 'SOF01';
  end if;
  if p_km is not null and p_km < 0 then
    raise exception 'KM inválido.' using errcode = 'SOF01';
  end if;

  select a.id, a.veiculo_id, a.data, a.created_at, a.litros, a.valor, a.km into v_ab
  from public.abastecimentos a where a.id = p_abastecimento_id
  for update;
  if not found then
    raise exception 'Abastecimento não encontrado.' using errcode = 'SOF01';
  end if;

  if v_litros is not distinct from v_ab.litros
     and v_valor is not distinct from v_ab.valor
     and p_km is not distinct from v_ab.km then
    raise exception 'Nada foi alterado.' using errcode = 'SOF01';
  end if;

  -- Vizinhos do mesmo veículo que TÊM km (km é opcional). Pode haver dois
  -- abastecimentos no mesmo dia: desempate por created_at e id.
  -- (revisão B1) Só valida quando o KM muda: senão um histórico legado fora de
  -- ordem impediria corrigir só os litros ou o valor.
  if p_km is not null and p_km is distinct from v_ab.km then
    select a.data, a.km into v_ant
    from public.abastecimentos a
    where a.veiculo_id = v_ab.veiculo_id and a.km is not null and a.id <> v_ab.id
      and (a.data, a.created_at, a.id) < (v_ab.data, v_ab.created_at, v_ab.id)
    order by a.data desc, a.created_at desc, a.id desc
    limit 1;
    if found and p_km < v_ant.km then
      raise exception 'O KM não pode ser menor que o do abastecimento anterior: % km em %.',
        replace(trim(to_char(v_ant.km, '999G999G999')), ',', '.'),
        to_char(v_ant.data, 'DD/MM/YYYY')
        using errcode = 'SOF01';
    end if;

    select a.data, a.km into v_prox
    from public.abastecimentos a
    where a.veiculo_id = v_ab.veiculo_id and a.km is not null and a.id <> v_ab.id
      and (a.data, a.created_at, a.id) > (v_ab.data, v_ab.created_at, v_ab.id)
    order by a.data asc, a.created_at asc, a.id asc
    limit 1;
    if found and p_km > v_prox.km then
      raise exception 'O KM não pode ser maior que o do abastecimento seguinte: % km em %.',
        replace(trim(to_char(v_prox.km, '999G999G999')), ',', '.'),
        to_char(v_prox.data, 'DD/MM/YYYY')
        using errcode = 'SOF01';
    end if;
  end if;

  update public.abastecimentos
     set litros = v_litros, valor = v_valor, km = p_km
   where id = p_abastecimento_id;

  -- Antes/depois só dos campos que mudaram (é o que o histórico mostra).
  if v_litros is distinct from v_ab.litros then
    v_antes := v_antes || jsonb_build_object('litros', v_ab.litros);
    v_depois := v_depois || jsonb_build_object('litros', v_litros);
  end if;
  if v_valor is distinct from v_ab.valor then
    v_antes := v_antes || jsonb_build_object('valor', v_ab.valor);
    v_depois := v_depois || jsonb_build_object('valor', v_valor);
  end if;
  if p_km is distinct from v_ab.km then
    v_antes := v_antes || jsonb_build_object('km', v_ab.km);
    v_depois := v_depois || jsonb_build_object('km', p_km);
  end if;

  select v.placa into v_placa from public.veiculos v where v.id = v_ab.veiculo_id;

  insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id, usuario_email, dados)
  values (
    'abastecimentos', 'corrigiu', p_abastecimento_id::text,
    format('Abastecimento corrigido — %s · %s', v_placa, to_char(v_ab.data, 'DD/MM/YYYY')),
    auth.uid(),
    v_email,
    jsonb_build_object(
      'tipo', 'correcao_abastecimento',
      'contexto', jsonb_build_object('placa', v_placa, 'data', v_ab.data, 'veiculo_id', v_ab.veiculo_id),
      'antes', v_antes,
      'depois', v_depois,
      'motivo', v_motivo,
      'autor', jsonb_build_object(
        'email', v_email,
        'nome', nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
        'papel', case when public.sofia_is_admin() then 'administrador' else 'gestor de frotas' end)
    )
  );
end;
$$;


-- ============================================================
-- 3. F1 — editar_equipe_atomico (código e motorista; NUNCA o veículo)
--
-- Ordem de trava (revisão B2): VEÍCULOS primeiro (o da equipe e o da equipe de
-- origem do motorista novo, em ordem de id), depois a equipe, depois os
-- motoristas (em ordem de id). Motivo: lancar_km_atomico trava o veículo
-- (FOR UPDATE) e depois grava km_diario, cuja FK pega FOR KEY SHARE na linha
-- de equipes e de motoristas. Se esta função travasse equipe/motorista antes
-- do veículo, as duas podiam se esperar em ciclo (deadlock). Com veículo
-- primeiro, as duas se enfileiram no veículo.
-- ============================================================
create or replace function public.editar_equipe_atomico(
  p_equipe_id uuid,
  p_codigo text,
  p_motorista_id uuid      -- null = "Sem motorista"
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_codigo text := upper(btrim(p_codigo));
  v_codigo_antes text;
  v_atuais uuid[];
  v_atuais_nomes text[];
  v_novo_nome text;
  v_novo_equipe uuid;
  v_novo_equipe_lida uuid;
  v_origem uuid;
  v_origem_codigo text;
  v_restante uuid;
  v_veic uuid;
  v_mudou_codigo boolean;
  v_mudou_motorista boolean;
  v_email text := lower(btrim(auth.jwt() ->> 'email'));
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem editar equipes';
  end if;

  if v_codigo is null or v_codigo = '' then
    raise exception 'Informe o código da equipe' using errcode = 'SOF01';
  end if;

  -- Leitura sem trava do motorista novo: só para saber a equipe de origem e
  -- travar o veículo dela antes de tudo. Conferida de novo depois da trava.
  if p_motorista_id is not null then
    select m.equipe_id into v_novo_equipe_lida
    from public.motoristas m
    where m.id = p_motorista_id and m.ativo;
    if not found then
      raise exception 'Motorista não encontrado ou desativado.' using errcode = 'SOF01';
    end if;
  end if;

  -- 1º veículos (só trava; esta função nunca escreve em veiculos).
  perform 1 from public.veiculos v
   where v.status <> 'inativo'
     and v.equipe_id in (p_equipe_id, v_novo_equipe_lida)
   order by v.id
   for update;

  -- 2º equipe.
  select e.codigo into v_codigo_antes
  from public.equipes e where e.id = p_equipe_id
  for update;
  if not found then
    raise exception 'Equipe não encontrada.' using errcode = 'SOF01';
  end if;

  if exists (select 1 from public.equipes e
             where upper(e.codigo) = v_codigo and e.id <> p_equipe_id) then
    raise exception 'Já existe uma equipe com o código %.', v_codigo using errcode = 'SOF01';
  end if;

  -- 3º motoristas: os ATIVOS da equipe (pode haver mais de um em dado legado)
  -- e o motorista novo, em ordem de id.
  perform 1 from public.motoristas m
   where (m.equipe_id = p_equipe_id and m.ativo) or m.id = p_motorista_id
   order by m.id
   for update;

  select coalesce(array_agg(m.id order by m.nome, m.id), '{}'::uuid[]),
         coalesce(array_agg(m.nome order by m.nome, m.id), '{}'::text[])
    into v_atuais, v_atuais_nomes
  from public.motoristas m
  where m.equipe_id = p_equipe_id and m.ativo;

  if p_motorista_id is not null then
    select m.nome, m.equipe_id into v_novo_nome, v_novo_equipe
    from public.motoristas m
    where m.id = p_motorista_id and m.ativo;
    if not found then
      raise exception 'Motorista não encontrado ou desativado.' using errcode = 'SOF01';
    end if;
    -- Mudou de equipe entre a 1ª leitura e a trava: o veículo travado pode não
    -- ser o da equipe de origem. Recusa em vez de gravar histórico errado.
    if v_novo_equipe is distinct from v_novo_equipe_lida then
      raise exception 'Os dados da equipe mudaram enquanto você editava. Recarregue a página e tente de novo.'
        using errcode = 'SOF01';
    end if;
    if v_novo_equipe is distinct from p_equipe_id then
      v_origem := v_novo_equipe;   -- pode ser null (motorista sem equipe)
    end if;
  end if;

  v_mudou_codigo := v_codigo <> v_codigo_antes;
  v_mudou_motorista := v_atuais <> (case when p_motorista_id is null then '{}'::uuid[]
                                          else array[p_motorista_id] end);

  if not v_mudou_codigo and not v_mudou_motorista then
    raise exception 'Nada foi alterado.' using errcode = 'SOF01';
  end if;

  if v_mudou_codigo then
    begin
      update public.equipes set codigo = v_codigo where id = p_equipe_id;
    exception when unique_violation then
      raise exception 'Já existe uma equipe com o código %.', v_codigo using errcode = 'SOF01';
    end;
  end if;

  if v_mudou_motorista then
    -- Invariante depois de salvar: no máximo 1 motorista ATIVO por equipe
    -- (a API veiculo-motorista usa .maybeSingle() e falha com 2).
    -- Motoristas inativos não são tocados.
    update public.motoristas
       set equipe_id = null
     where equipe_id = p_equipe_id and ativo and id is distinct from p_motorista_id;

    if p_motorista_id is not null then
      update public.motoristas set equipe_id = p_equipe_id where id = p_motorista_id;
    end if;

    -- Histórico de responsabilidade do carro desta equipe: fecha o aberto e abre
    -- com o motorista novo (padrão de atribuir_responsabilidade_veiculo). É dele
    -- que a API tira o motorista sugerido em multa/sinistro.
    -- (veículo já travado acima)
    select v.id into v_veic
    from public.veiculos v
    where v.equipe_id = p_equipe_id and v.status <> 'inativo';
    if v_veic is not null then
      update public.veiculo_responsabilidade_historico
         set fim = current_date
       where veiculo_id = v_veic and fim is null;
      insert into public.veiculo_responsabilidade_historico
        (veiculo_id, equipe_id, motorista_id, inicio, origem_checklist_id)
      values (v_veic, p_equipe_id, p_motorista_id, current_date, null);
    end if;

    -- Equipe de onde o motorista novo saiu: fica com quem sobrar (normalmente ninguém).
    if v_origem is not null then
      select e.codigo into v_origem_codigo from public.equipes e where e.id = v_origem;
      select m.id into v_restante
      from public.motoristas m
      where m.equipe_id = v_origem and m.ativo
      order by m.nome
      limit 1;
      v_veic := null;
      select v.id into v_veic
      from public.veiculos v
      where v.equipe_id = v_origem and v.status <> 'inativo';
      if v_veic is not null then
        update public.veiculo_responsabilidade_historico
           set fim = current_date
         where veiculo_id = v_veic and fim is null;
        insert into public.veiculo_responsabilidade_historico
          (veiculo_id, equipe_id, motorista_id, inicio, origem_checklist_id)
        values (v_veic, v_origem, v_restante, current_date, null);
      end if;
    end if;
  end if;

  insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id, usuario_email, dados)
  values (
    'equipes', 'atualizou', p_equipe_id::text,
    format('Equipe %s editada%s%s', v_codigo,
      case when v_mudou_codigo then format(' — código %s → %s', v_codigo_antes, v_codigo) else '' end,
      case when v_mudou_motorista then format(' — motorista %s → %s%s',
             coalesce(nullif(array_to_string(v_atuais_nomes, ', '), ''), 'sem motorista'),
             coalesce(v_novo_nome, 'sem motorista'),
             case when v_origem_codigo is not null
                  then format(' (%s ficou sem motorista)', v_origem_codigo) else '' end)
           else '' end),
    auth.uid(),
    v_email,
    jsonb_build_object(
      'tipo', 'edicao_equipe',
      -- (revisão B9) ids junto dos nomes: nome pode repetir ou mudar depois.
      'antes', jsonb_build_object('codigo', v_codigo_antes,
                                  'motoristas', to_jsonb(v_atuais_nomes),
                                  'motorista_ids', to_jsonb(v_atuais)),
      'depois', jsonb_build_object('codigo', v_codigo, 'motorista', v_novo_nome,
                                   'motorista_id', p_motorista_id),
      'equipe_que_perdeu_motorista', v_origem_codigo,
      'autor', jsonb_build_object(
        'email', v_email,
        'nome', nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
        'papel', case when public.sofia_is_admin() then 'administrador' else 'gestor de frotas' end)
    )
  );

  return jsonb_build_object('codigo', v_codigo);
end;
$$;


-- ============================================================
-- 4. Permissões de execução — "create function" dá EXECUTE a PUBLIC e o
--    PostgREST expõe /rpc/. Só authenticated chama.
-- ============================================================
revoke all on function public.corrigir_km_atomico(uuid, integer, text) from public, anon;
revoke all on function public.corrigir_abastecimento(uuid, numeric, numeric, integer, text) from public, anon;
revoke all on function public.editar_equipe_atomico(uuid, text, uuid) from public, anon;

grant execute on function public.corrigir_km_atomico(uuid, integer, text) to authenticated;
grant execute on function public.corrigir_abastecimento(uuid, numeric, numeric, integer, text) to authenticated;
grant execute on function public.editar_equipe_atomico(uuid, text, uuid) to authenticated;

commit;


-- ============================================================
-- VERIFICAÇÃO (depois do commit) — uma linha por invariante.
-- Qualquer "*** FALHOU ***" = parar, não deployar.
--
-- (revisão B6) As verificações 7–11 são TEXTUAIS (procuram trechos no corpo
-- da função). A nº 8 só prova que existe um "for update" e um "update
-- public.veiculos set km_atual" no corpo; a ORDEM de trava (veiculos ->
-- km_diario em F2; veiculos -> equipes -> motoristas em F1) é garantida por
-- leitura do código, não por esta consulta.
-- ============================================================
with f(nome, sig) as (values
  ('corrigir_km_atomico',    'public.corrigir_km_atomico(uuid,integer,text)'),
  ('corrigir_abastecimento', 'public.corrigir_abastecimento(uuid,numeric,numeric,integer,text)'),
  ('editar_equipe_atomico',  'public.editar_equipe_atomico(uuid,text,uuid)')
), p as (
  select f.nome, f.sig, pr.oid, pr.prosecdef, pr.proconfig, pr.prosrc
  from f left join pg_proc pr on pr.oid = to_regprocedure(f.sig)
)
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'as 3 funções existem', '3',
      (select count(oid)::text from p)),
  (2, 'as 3 são security INVOKER', '0',
      (select count(*)::text from p where prosecdef)),
  (3, 'as 3 têm search_path fixo', '3',
      (select count(*)::text from p where proconfig::text like '%search_path=pg_catalog, public%')),
  (4, 'authenticated executa as 3', '3',
      (select count(*)::text from p where has_function_privilege('authenticated', oid, 'EXECUTE'))),
  (5, 'anon não executa nenhuma', '0',
      (select count(*)::text from p where has_function_privilege('anon', oid, 'EXECUTE'))),
  (6, 'PUBLIC não executa nenhuma', '0',
      (select count(*)::text from p where has_function_privilege('public', oid, 'EXECUTE'))),
  (7, 'as 3 guardam com sofia_pode_gerir() is not true', '3',
      (select count(*)::text from p where position('sofia_pode_gerir() is not true' in prosrc) > 0)),
  (8, 'corrigir_km_atomico trava FOR UPDATE e recalcula km_atual (textual)', 'true',
      (select (position('for update' in prosrc) > 0
               and position('update public.veiculos set km_atual' in prosrc) > 0)::text
       from p where nome = 'corrigir_km_atomico')),
  (9, 'corrigir_abastecimento NÃO escreve veiculos', 'true',
      (select (position('update public.veiculos' in prosrc) = 0)::text
       from p where nome = 'corrigir_abastecimento')),
  (10, 'editar_equipe_atomico NÃO escreve veiculos (carro só pelo checklist)', 'true',
      (select (position('update public.veiculos' in prosrc) = 0)::text
       from p where nome = 'editar_equipe_atomico')),
  (11, 'as 3 gravam audit_log', '3',
      (select count(*)::text from p where position('insert into public.audit_log' in prosrc) > 0)),
  (12, 'triggers trg_bloquear_escrita_* das 4 tabelas continuam habilitados', '4',
      (select count(*)::text from pg_trigger
       where tgname in ('trg_bloquear_escrita_equipes','trg_bloquear_escrita_veiculos',
                        'trg_bloquear_escrita_abastecimentos','trg_bloquear_escrita_km_diario')
         and tgenabled = 'O'))
) as t(n, verificacao, esperado, encontrado)
order by n;
-- Esperado: 12/12 OK.


-- ============================================================
-- ROLLBACK (comentado — rodar só se for desfazer)
-- 1º reverter/retirar o deploy do app (as actions chamam estas RPCs; sem
--    elas, Corrigir/Editar falham com "Erro ao ..." — falha fechada, sem dano).
-- 2º dropar as funções. As linhas de audit_log 'corrigiu'/'atualizou' que já
--    foram gravadas FICAM (são histórico; não apagar).
-- ============================================================
-- begin;
-- drop function if exists public.corrigir_km_atomico(uuid, integer, text);
-- drop function if exists public.corrigir_abastecimento(uuid, numeric, numeric, integer, text);
-- drop function if exists public.editar_equipe_atomico(uuid, text, uuid);
-- commit;
