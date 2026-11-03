-- ============================================================
-- *** NÃO APLICADO / NUNCA RODOU *** (escrito em 03/11/2026)
-- Sofia — multa por etapa, avaria, fotos imutáveis, storage: TESTE DE COMPORTAMENTO
-- Rodar DEPOIS de sdd-sql-sofia-multa-avaria.sql, como postgres, projeto iyytcavcgukfjnjjrerx.
-- TERMINA EM ERRO DE PROPÓSITO (o raise final é o relatório e o rollback).
-- Esperado: "RESUMO: 42/42 OK".
-- Fixture que falhar por coluna NOT NULL não prevista = deriva de schema:
-- ajustar a fixture, nunca o teste.
-- ============================================================

begin;

do $$
declare
  uid_g constant uuid := '00000000-0000-4000-a000-0000000000b1';
  uid_u constant uuid := '00000000-0000-4000-a000-0000000000b2';
  uid_a constant uuid := '00000000-0000-4000-a000-0000000000b3';
  uid_n constant uuid := '00000000-0000-4000-a000-0000000000b4';
  mail_g constant text := '__teste_ma_gestor@manfac.com.br';
  mail_u constant text := '__teste_ma_comum@manfac.com.br';
  mail_a constant text := '__teste_ma_admin@manfac.com.br';
  mail_n constant text := '__teste_ma_semsofia@manfac.com.br';
  e1  uuid := gen_random_uuid();
  v1  uuid := gen_random_uuid();
  mo1 uuid := gen_random_uuid();
  m1  uuid := gen_random_uuid();   -- percorre o fluxo inteiro
  m2  uuid := gen_random_uuid();   -- tentativas de U; deve ficar intacta
  m3  uuid := gen_random_uuid();   -- revogação
  c1  uuid := gen_random_uuid();   -- checklist com foto e avaria
  c2  uuid := gen_random_uuid();   -- outro checklist (avaria de outro checklist)
  f1  uuid := gen_random_uuid();
  av1 uuid := gen_random_uuid();
  av2 uuid := gen_random_uuid();
  av3 uuid := gen_random_uuid();   -- avaria criada por U
  s1  uuid := gen_random_uuid();
  sf1 uuid := gen_random_uuid();
  r   text[] := '{}';
  n_ok int := 0;
  n_total int := 0;
  v_txt text;
  v_txt2 text;
  v_int int;
begin
  -- ---------- FIXTURES (postgres) ----------
  insert into auth.users (id, email, aud, role) values
    (uid_g, mail_g, 'authenticated', 'authenticated'),
    (uid_u, mail_u, 'authenticated', 'authenticated'),
    (uid_a, mail_a, 'authenticated', 'authenticated'),
    (uid_n, mail_n, 'authenticated', 'authenticated');
  insert into public.hub_user_roles (user_email, nivel, granted_by) values
    (mail_g, 'analista', 'teste-ma'), (mail_u, 'analista', 'teste-ma'),
    (mail_a, 'administrador', 'teste-ma'), (mail_n, 'analista', 'teste-ma');
  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by) values
    (mail_g, 'sofia', true, 'teste-ma'), (mail_u, 'sofia', true, 'teste-ma');
  insert into public.sofia_gestores (user_email, granted_by) values (mail_g, 'teste-ma');

  insert into public.equipes (id, codigo, ativo) values (e1, '__teste_ma_e1', true);
  insert into public.veiculos (id, placa, modelo, km_atual, valor_locacao_mensal, equipe_id)
    values (v1, '__TMA01', 'teste', 1000, 1000, e1);
  insert into public.motoristas (id, nome, equipe_id) values (mo1, '__teste_ma_motorista', e1);
  insert into public.multas (id, veiculo_id, data, data_recebimento, descricao, valor) values
    (m1, v1, current_date - 10, current_date - 5, 'teste-ma', 100),
    (m2, v1, current_date - 10, current_date - 5, 'teste-ma', 100),
    (m3, v1, current_date - 10, current_date - 5, 'teste-ma', 100);
  insert into public.checklist (id, tipo, veiculo_id) values (c1, 'retorno', v1), (c2, 'retorno', v1);
  insert into public.checklist_avarias (id, checklist_id, peca, tamanho) values
    (av1, c1, 'Porta direita', 'media'), (av2, c2, 'Retrovisor', 'pequena');
  insert into public.checklist_fotos (id, checklist_id, storage_path, posicao, tipo_foto) values
    (f1, c1, '__teste_ma/c1/Frente.jpg', 'Frente', 'obrigatoria');
  insert into public.sinistros (id, veiculo_id, data, descricao) values (s1, v1, current_date, 'teste-ma');
  insert into public.sinistro_fotos (id, sinistro_id, storage_path) values (sf1, s1, '__teste_ma/s1/dano.jpg');
  insert into storage.objects (bucket_id, name) values ('checklist-fotos', '__teste_ma/c1/Frente.jpg');

  -- (p1) postgres sem JWT não avança etapa
  n_total := n_total + 1;
  begin
    update public.multas set etapa = 'condutor' where id = m2;
    r := r || '(p1) postgres sem JWT avançando etapa: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(p1) postgres sem JWT avançando etapa: OK (barrado)'::text;
    else r := r || ('(p1) *** FALHOU *** erro inesperado: ' || sqlerrm)::text; end if;
  end;

  -- (p2) postgres apaga foto direto: barrado pela trigger (qualquer role)
  n_total := n_total + 1;
  begin
    delete from public.checklist_fotos where id = f1;
    r := r || '(p2) postgres apagando foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(p2) postgres apagando foto: OK (barrado)'::text;
    else r := r || ('(p2) *** FALHOU *** erro inesperado: ' || sqlerrm)::text; end if;
  end;

  -- ================= USUÁRIO COMUM (U) =================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_u, 'email', mail_u, 'role', 'authenticated')::text, true);

  -- (u1) U registra multa nova (etapa registrada) com prazo
  n_total := n_total + 1;
  begin
    insert into public.multas (veiculo_id, data, data_recebimento, prazo_indicacao, descricao, valor, locadora)
    values (v1, current_date, current_date, current_date + 30, 'teste-ma-u1', 50, 'Maestro');
    n_ok := n_ok + 1; r := r || '(u1) U registra multa: OK'::text;
  exception when others then r := r || ('(u1) U registra multa: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (u2) U insere multa já em etapa posterior
  n_total := n_total + 1;
  begin
    insert into public.multas (veiculo_id, data, descricao, valor, etapa) values (v1, current_date, 'teste-ma-u2', 50, 'indicado');
    r := r || '(u2) U insere multa indicada: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u2) U insere multa indicada: OK (barrado)'::text;
    else r := r || ('(u2) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u3) U avança etapa por UPDATE
  n_total := n_total + 1;
  begin
    update public.multas set etapa = 'condutor' where id = m2;
    r := r || '(u3) U avança etapa: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u3) U avança etapa: OK (barrado)'::text;
    else r := r || ('(u3) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u4) U avança etapa pela RPC
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m2, 'solicitado', '{}'::jsonb);
    r := r || '(u4) U pela RPC: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u4) U pela RPC: OK (barrado)'::text;
    else r := r || ('(u4) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u5) U muda status direto
  n_total := n_total + 1;
  begin
    update public.multas set status = 'validada' where id = m2;
    r := r || '(u5) U muda status direto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u5) U muda status direto: OK (barrado)'::text;
    else r := r || ('(u5) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u6) U muda prazo de indicação de multa existente
  n_total := n_total + 1;
  begin
    update public.multas set prazo_indicacao = current_date + 300 where id = m2;
    r := r || '(u6) U muda prazo: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u6) U muda prazo: OK (barrado)'::text;
    else r := r || ('(u6) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u7) U grava em multa_etapas direto
  n_total := n_total + 1;
  begin
    insert into public.multa_etapas (multa_id, etapa, feito_por) values (m2, 'validada', mail_u);
    r := r || '(u7) U grava multa_etapas: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u7) U grava multa_etapas: OK (barrado)'::text;
    else r := r || ('(u7) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u8) U apaga foto do checklist
  n_total := n_total + 1;
  begin
    delete from public.checklist_fotos where id = f1;
    r := r || '(u8) U apaga foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u8) U apaga foto: OK (barrado)'::text;
    else r := r || ('(u8) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u9) U troca o arquivo de uma foto (UPDATE storage_path)
  n_total := n_total + 1;
  begin
    update public.checklist_fotos set storage_path = 'outro.jpg' where id = f1;
    r := r || '(u9) U troca arquivo da foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u9) U troca arquivo da foto: OK (barrado)'::text;
    else r := r || ('(u9) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u10) U dá baixa em avaria (RLS de UPDATE filtra: 0 linhas; conferir que segue aberta)
  n_total := n_total + 1;
  begin
    update public.checklist_avarias set status = 'reparada', reparada_em = now(), reparada_por = mail_u where id = av1;
    perform set_config('role', 'postgres', true);
    select status into v_txt from public.checklist_avarias where id = av1;
    perform set_config('role', 'authenticated', true);
    if v_txt = 'aberta' then n_ok := n_ok + 1; r := r || '(u10) U dá baixa em avaria: OK (sem efeito)'::text;
    else r := r || '(u10) U dá baixa em avaria: *** FALHOU *** (reparada)'::text; end if;
  exception when others then
    perform set_config('role', 'authenticated', true);
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u10) U dá baixa em avaria: OK (barrado)'::text;
    else r := r || ('(u10) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u11) U apaga avaria
  n_total := n_total + 1;
  begin
    delete from public.checklist_avarias where id = av1;
    r := r || '(u11) U apaga avaria: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u11) U apaga avaria: OK (barrado)'::text;
    else r := r || ('(u11) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u12) U registra avaria nova e foto dela: OK
  n_total := n_total + 1;
  begin
    -- dois comandos separados (num CTE a trigger da foto não enxergaria a avaria do mesmo comando)
    insert into public.checklist_avarias (id, checklist_id, peca, tamanho) values (av3, c1, 'Farol / lanterna', 'grande');
    insert into public.checklist_fotos (checklist_id, storage_path, posicao, tipo_foto, avaria_id)
      values (c1, '__teste_ma/c1/av-dano.jpg', 'Avaria 1', 'avaria_dano', av3);
    n_ok := n_ok + 1; r := r || '(u12) U registra avaria com foto: OK'::text;
  exception when others then r := r || ('(u12) U registra avaria: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (u13) foto de avaria apontando para avaria de OUTRO checklist
  n_total := n_total + 1;
  begin
    insert into public.checklist_fotos (checklist_id, storage_path, posicao, tipo_foto, avaria_id)
      values (c1, '__teste_ma/c1/x.jpg', 'Avaria x', 'avaria_peca', av2);
    r := r || '(u13) foto com avaria de outro checklist: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(u13) foto com avaria de outro checklist: OK (barrado)'::text;
    else r := r || ('(u13) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u14) U vê o arquivo do bucket (tem Sofia)
  n_total := n_total + 1;
  select count(*) into v_int from storage.objects where bucket_id = 'checklist-fotos' and name = '__teste_ma/c1/Frente.jpg';
  if v_int = 1 then n_ok := n_ok + 1; r := r || '(u14) U lê objeto do bucket: OK'::text;
  else r := r || '(u14) U lê objeto do bucket: *** FALHOU ***'::text; end if;

  -- ================= SEM SOFIA (N) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_n, 'email', mail_n, 'role', 'authenticated')::text, true);

  -- (n1) N não lista o bucket de fotos do checklist
  n_total := n_total + 1;
  select count(*) into v_int from storage.objects where bucket_id = 'checklist-fotos' and name = '__teste_ma/c1/Frente.jpg';
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(n1) N (sem Sofia) não vê objeto do bucket: OK'::text;
  else r := r || '(n1) N vê objeto do bucket: *** FALHOU ***'::text; end if;

  -- (n2) N não vê multa_etapas nem avarias
  n_total := n_total + 1;
  if (select count(*) from public.checklist_avarias) = 0 and (select count(*) from public.multa_etapas) = 0 then
    n_ok := n_ok + 1; r := r || '(n2) N não lê avarias/etapas: OK'::text;
  else r := r || '(n2) N lê avarias/etapas: *** FALHOU ***'::text; end if;

  -- ================= GESTOR (G) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'email', mail_g, 'role', 'authenticated')::text, true);

  -- (g1) G percorre m1: condutor → termo → indicado → validada → cobrada → solicitado
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'condutor', jsonb_build_object('motorista_id', mo1));
    perform public.sofia_multa_registrar_etapa(m1, 'termo', jsonb_build_object('storage_path', 'multas/' || m1 || '/termo-1.pdf'));
    perform public.sofia_multa_registrar_etapa(m1, 'indicado', jsonb_build_object('indicado_em', current_date, 'protocolo', 'P-1'));
    perform public.sofia_multa_registrar_etapa(m1, 'validada', jsonb_build_object('em_nome_de', 'Gestor EQ', 'canal', 'whatsapp'));
    perform public.sofia_multa_registrar_etapa(m1, 'cobrada', jsonb_build_object('boleto_lancado_em', current_date));
    perform public.sofia_multa_registrar_etapa(m1, 'solicitado', '{}'::jsonb);
    select status || '/' || autorizacao_status || '/' || motorista_id::text into v_txt from public.multas where id = m1;
    select count(*) into v_int from public.multa_etapas where multa_id = m1 and feito_por = mail_g;
    if v_txt = 'validada/solicitado/' || mo1::text and v_int = 6 then
      n_ok := n_ok + 1; r := r || '(g1) G percorre até solicitado, status derivado, 6 etapas registradas: OK'::text;
    else r := r || ('(g1) *** FALHOU *** ' || coalesce(v_txt,'null') || ' etapas=' || v_int)::text; end if;
  exception when others then r := r || ('(g1) G percorre fluxo: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (g2) GESTOR NÃO CONSEGUE AUTORIZAR pela RPC
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'autorizado', '{}'::jsonb);
    r := r || '(g2) G autoriza pela RPC: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g2) G autoriza pela RPC: OK (barrado)'::text;
    else r := r || ('(g2) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g3) GESTOR NÃO CONSEGUE AUTORIZAR por UPDATE direto da etapa
  n_total := n_total + 1;
  begin
    update public.multas set etapa = 'autorizado' where id = m1;
    r := r || '(g3) G autoriza por UPDATE da etapa: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g3) G autoriza por UPDATE da etapa: OK (barrado)'::text;
    else r := r || ('(g3) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g4) GESTOR NÃO CONSEGUE AUTORIZAR mudando autorizacao_status direto
  n_total := n_total + 1;
  begin
    update public.multas set autorizacao_status = 'autorizado' where id = m1;
    r := r || '(g4) G muda autorizacao_status direto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g4) G muda autorizacao_status direto: OK (barrado)'::text;
    else r := r || ('(g4) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g5) G pula de solicitado para descontada (contornando o admin)
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'descontada',
      jsonb_build_object('valor_descontado', 100, 'tipo_desconto', 'total', 'competencia', current_date));
    r := r || '(g5) G desconta sem autorização: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g5) G desconta sem autorização: OK (barrado)'::text;
    else r := r || ('(g5) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g6) G volta etapa (solicitado → registrada)
  n_total := n_total + 1;
  begin
    update public.multas set etapa = 'registrada' where id = m1;
    r := r || '(g6) G volta etapa: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g6) G volta etapa: OK (barrado)'::text;
    else r := r || ('(g6) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g7) G grava etapa com feito_por de outra pessoa
  n_total := n_total + 1;
  begin
    insert into public.multa_etapas (multa_id, etapa, feito_por) values (m1, 'validada', mail_a);
    r := r || '(g7) G grava etapa em nome de outro e-mail: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = '42501' then n_ok := n_ok + 1; r := r || '(g7) G grava etapa com feito_por alheio: OK (barrado)'::text;
    else r := r || ('(g7) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g8) G apaga foto direto
  n_total := n_total + 1;
  begin
    delete from public.checklist_fotos where id = f1;
    r := r || '(g8) G apaga foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(g8) G apaga foto: OK (barrado)'::text;
    else r := r || ('(g8) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g9) G exclui o checklist com foto (cascata não pode levar a foto)
  n_total := n_total + 1;
  begin
    delete from public.checklist where id = c1;
    r := r || '(g9) G exclui checklist com foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','23503') then n_ok := n_ok + 1; r := r || '(g9) G exclui checklist com foto: OK (barrado)'::text;
    else r := r || ('(g9) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g10) G exclui sinistro com foto (gestor pode excluir sinistro, mas a cascata bate na foto)
  n_total := n_total + 1;
  begin
    delete from public.sinistros where id = s1;
    r := r || '(g10) G exclui sinistro com foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g10) G exclui sinistro com foto: OK (barrado)'::text;
    else r := r || ('(g10) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g11) G dá baixa na avaria: OK, quem = e-mail do JWT (ignora o informado)
  n_total := n_total + 1;
  begin
    update public.checklist_avarias set status = 'reparada', reparada_em = now(), reparada_por = 'forjado@x' where id = av1;
    select reparada_por into v_txt from public.checklist_avarias where id = av1;
    if v_txt = mail_g then n_ok := n_ok + 1; r := r || '(g11) G dá baixa, reparada_por = JWT: OK'::text;
    else r := r || ('(g11) *** FALHOU *** reparada_por=' || coalesce(v_txt,'null'))::text; end if;
  exception when others then r := r || ('(g11) G dá baixa: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (g12) G reabre avaria reparada
  n_total := n_total + 1;
  begin
    update public.checklist_avarias set status = 'aberta', reparada_em = null, reparada_por = null where id = av1;
    r := r || '(g12) G reabre avaria: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','23514') then n_ok := n_ok + 1; r := r || '(g12) G reabre avaria: OK (barrado)'::text;
    else r := r || ('(g12) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g13) G muda a peça de uma avaria
  n_total := n_total + 1;
  begin
    update public.checklist_avarias set peca = 'Outra peça' where id = av2;
    r := r || '(g13) G muda peça da avaria: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g13) G muda peça da avaria: OK (barrado)'::text;
    else r := r || ('(g13) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g14) G pede m3 (para revogação depois)
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m3, 'solicitado', '{}'::jsonb);  -- pular para frente é permitido
    n_ok := n_ok + 1; r := r || '(g14) G solicita m3 pulando etapas: OK'::text;
  exception when others then r := r || ('(g14) *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- ================= ADMIN (A) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_a, 'email', mail_a, 'role', 'authenticated')::text, true);

  -- (a1) ADMIN AUTORIZA m1 pela RPC
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'autorizado', '{}'::jsonb);
    select etapa || '/' || status || '/' || autorizacao_status into v_txt from public.multas where id = m1;
    if v_txt = 'autorizado/validada/autorizado' then n_ok := n_ok + 1; r := r || '(a1) A autoriza: OK'::text;
    else r := r || ('(a1) *** FALHOU *** ' || v_txt)::text; end if;
  exception when others then r := r || ('(a1) A autoriza: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (a2) A autoriza m3 e depois revoga: OK
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m3, 'autorizado', '{}'::jsonb);
    perform public.sofia_multa_registrar_etapa(m3, 'solicitado', '{}'::jsonb);
    select etapa || '/' || autorizacao_status into v_txt from public.multas where id = m3;
    if v_txt = 'solicitado/solicitado' then n_ok := n_ok + 1; r := r || '(a2) A autoriza e revoga: OK'::text;
    else r := r || ('(a2) *** FALHOU *** ' || v_txt)::text; end if;
  exception when others then r := r || ('(a2) *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (a3) A apaga foto
  n_total := n_total + 1;
  begin
    delete from public.sinistro_fotos where id = sf1;
    r := r || '(a3) A apaga foto de sinistro: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(a3) A apaga foto de sinistro: OK (barrado)'::text;
    else r := r || ('(a3) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- ================= GESTOR de novo =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'email', mail_g, 'role', 'authenticated')::text, true);

  -- (g15) G revoga autorização (m1 autorizado → solicitado)
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'solicitado', '{}'::jsonb);
    r := r || '(g15) G revoga autorização: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g15) G revoga autorização: OK (barrado)'::text;
    else r := r || ('(g15) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g16) G registra desconto acima do valor
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'descontada',
      jsonb_build_object('valor_descontado', 101, 'tipo_desconto', 'total', 'competencia', current_date));
    r := r || '(g16) desconto acima do valor: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g16) desconto acima do valor: OK (barrado)'::text;
    else r := r || ('(g16) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g17) G registra desconto válido depois da autorização do admin
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'descontada',
      jsonb_build_object('valor_descontado', 100, 'tipo_desconto', 'total', 'competencia', current_date));
    select status || '/' || to_char(desconto_competencia, 'DD') into v_txt from public.multas where id = m1;
    if v_txt = 'descontada/01' then n_ok := n_ok + 1; r := r || '(g17) G registra desconto autorizado: OK'::text;
    else r := r || ('(g17) *** FALHOU *** ' || v_txt)::text; end if;
  exception when others then r := r || ('(g17) *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (g18) G muda valor descontado sem mudar etapa
  n_total := n_total + 1;
  begin
    update public.multas set valor_descontado = 1 where id = m1;
    r := r || '(g18) G mexe no valor descontado: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g18) G mexe no valor descontado: OK (barrado)'::text;
    else r := r || ('(g18) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g19) G não apaga linha de multa_etapas
  n_total := n_total + 1;
  begin
    delete from public.multa_etapas where multa_id = m1;
    get diagnostics v_int = row_count;
    if v_int = 0 then n_ok := n_ok + 1; r := r || '(g19) G apaga multa_etapas: OK (sem efeito)'::text;
    else r := r || '(g19) G apaga multa_etapas: *** FALHOU *** (apagou)'::text; end if;
  exception when others then
    if sqlstate = '42501' then n_ok := n_ok + 1; r := r || '(g19) G apaga multa_etapas: OK (barrado)'::text;
    else r := r || ('(g19) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- ================= FIM: invariantes como postgres =================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- (z1) m2 intacta depois de U
  n_total := n_total + 1;
  if exists (select 1 from public.multas where id = m2 and etapa = 'registrada' and status = 'pendente'
             and autorizacao_status = 'sem_solicitacao' and prazo_indicacao is null) then
    n_ok := n_ok + 1; r := r || '(z1) m2 intacta: OK'::text;
  else r := r || '(z1) m2 intacta: *** FALHOU ***'::text; end if;

  -- (z2) ninguém apagou foto: f1, sf1 e o checklist c1 continuam
  n_total := n_total + 1;
  if exists (select 1 from public.checklist_fotos where id = f1 and storage_path = '__teste_ma/c1/Frente.jpg')
     and exists (select 1 from public.sinistro_fotos where id = sf1)
     and exists (select 1 from public.checklist where id = c1)
     and exists (select 1 from public.sinistros where id = s1) then
    n_ok := n_ok + 1; r := r || '(z2) nenhuma foto apagada nem trocada: OK'::text;
  else r := r || '(z2) fotos intactas: *** FALHOU ***'::text; end if;

  raise exception E'TESTE multa/avaria/fotos (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;

-- Depois, como postgres, confirmar que nada ficou (todas = 0):
--   select count(*) from auth.users            where email like '\_\_teste\_ma\_%';
--   select count(*) from public.hub_user_roles where user_email like '\_\_teste\_ma\_%';
--   select count(*) from public.sofia_gestores where user_email like '\_\_teste\_ma\_%';
--   select count(*) from public.multas         where descricao like 'teste-ma%';
--   select count(*) from storage.objects       where name like '\_\_teste\_ma/%';
