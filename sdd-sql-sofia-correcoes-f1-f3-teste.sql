-- ============================================================
-- *** NÃO APLICADO / NUNCA RODOU *** (escrito em 26/10/2026, branch feat/frotas-f1-f3)
-- Sofia — F1/F2/F3: TESTE DE COMPORTAMENTO (não altera nada)
-- DEPENDE DE: sdd-sql-sofia-gestor-frotas.sql (sofia_gestores, sofia_pode_gerir)
--             e sdd-sql-sofia-correcoes-f1-f3.sql, os dois já aplicados.
-- Rodar como postgres (SQL Editor ou Management API com o PAT), projeto
-- iyytcavcgukfjnjjrerx. O bloco TERMINA EM ERRO DE PROPÓSITO: o raise final é
-- o relatório e a garantia de rollback. Resultado esperado: "RESUMO: 35/35 OK"
-- (p1, g1–g24, u1–u4, n1, j1–j2, a1–a2, z) + uma linha (info).
-- Fixture que falhar por coluna NOT NULL fora dos arquivos = deriva de schema:
-- ajustar a fixture, nunca o teste.
-- Depois, como postgres, conferir 0 linhas:
--   select count(*) from public.equipes where codigo like '\_\_TESTE\_CF%';
--   select count(*) from auth.users where email like '\_\_teste\_cf\_%';
--   select count(*) from public.sofia_gestores where user_email like '\_\_teste\_cf\_%';
-- ============================================================

begin;

do $$
declare
  uid_g constant uuid := '00000000-0000-4000-a000-0000000000c1';
  uid_u constant uuid := '00000000-0000-4000-a000-0000000000c2';
  uid_a constant uuid := '00000000-0000-4000-a000-0000000000c3';
  uid_n constant uuid := '00000000-0000-4000-a000-0000000000c4';
  mail_g constant text := '__teste_cf_gestor@manfac.com.br';
  mail_u constant text := '__teste_cf_comum@manfac.com.br';
  mail_a constant text := '__teste_cf_admin@manfac.com.br';
  mail_n constant text := '__teste_cf_semlinha@manfac.com.br';
  e1 uuid := gen_random_uuid(); e2 uuid := gen_random_uuid();
  e3 uuid := gen_random_uuid(); e4 uuid := gen_random_uuid();
  v1 uuid := gen_random_uuid(); v2 uuid := gen_random_uuid(); v3 uuid := gen_random_uuid();
  m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid();
  m3 uuid := gen_random_uuid();  -- e4, ativo
  m4 uuid := gen_random_uuid();  -- e4, ativo (legado: 2 ativos na mesma equipe)
  m5 uuid := gen_random_uuid();  -- e4, INATIVO (não pode ser tocado)
  m6 uuid := gen_random_uuid();  -- ativo, sem equipe
  m7 uuid := gen_random_uuid();  -- inativo, sem equipe
  k1 uuid := gen_random_uuid(); k2 uuid := gen_random_uuid(); k3 uuid := gen_random_uuid();
  a1 uuid := gen_random_uuid(); a2 uuid := gen_random_uuid(); a3 uuid := gen_random_uuid();
  a4 uuid := gen_random_uuid(); a5 uuid := gen_random_uuid();
  r text[] := '{}';
  n_ok int := 0;
  n_total int := 0;
  v_int int;
  v_j jsonb;
begin
  -- ---------- FIXTURES (postgres, acima da RLS) ----------
  insert into auth.users (id, email, aud, role) values
    (uid_g, mail_g, 'authenticated', 'authenticated'),
    (uid_u, mail_u, 'authenticated', 'authenticated'),
    (uid_a, mail_a, 'authenticated', 'authenticated'),
    (uid_n, mail_n, 'authenticated', 'authenticated');
  insert into public.hub_user_roles (user_email, nivel, granted_by) values
    (mail_g, 'analista', 'teste-cf'), (mail_u, 'analista', 'teste-cf'),
    (mail_a, 'administrador', 'teste-cf');
  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by) values
    (mail_g, 'sofia', true, 'teste-cf'), (mail_u, 'sofia', true, 'teste-cf');
  insert into public.sofia_gestores (user_email, granted_by) values (mail_g, 'teste-cf');

  insert into public.equipes (id, codigo, ativo) values
    (e1, '__TESTE_CF_E1', true), (e2, '__TESTE_CF_E2', true),
    (e3, '__TESTE_CF_E3', true), (e4, '__TESTE_CF_E4', true);
  -- v1.km_atual = 2100: estado do bug (lançamento de d3 digitado a mais). e3 sem veículo.
  insert into public.veiculos (id, placa, modelo, km_atual, equipe_id) values
    (v1, '__TCF01', 'teste', 2100, e1), (v2, '__TCF02', 'teste', 500, e2),
    (v3, '__TCF03', 'teste', 700, e4);
  insert into public.motoristas (id, nome, equipe_id, ativo) values
    (m1, '__teste_cf_m1', e1, true), (m2, '__teste_cf_m2', e2, true),
    (m3, '__teste_cf_m3', e4, true), (m4, '__teste_cf_m4', e4, true),
    (m5, '__teste_cf_m5', e4, false), (m6, '__teste_cf_m6', null, true),
    (m7, '__teste_cf_m7', null, false);
  insert into public.veiculo_responsabilidade_historico (veiculo_id, equipe_id, motorista_id, inicio) values
    (v1, e1, m1, date '2000-01-01'), (v2, e2, m2, date '2000-01-01'), (v3, e4, m3, date '2000-01-01');
  insert into public.km_diario (id, equipe_id, veiculo_id, motorista_id, km_atual, data) values
    (k1, e1, v1, m1, 1000, date '2000-01-01'),
    (k2, e1, v1, m1, 1100, date '2000-01-02'),
    (k3, e1, v1, m1, 2100, date '2000-01-03');
  -- a5 é legado FORA DE ORDEM (km 900 depois de 1200), para provar a revisão B1.
  insert into public.abastecimentos (id, veiculo_id, data, litros, valor, km) values
    (a1, v1, date '2000-01-01', 40,  240,    1000),
    (a2, v1, date '2000-01-02', 423, 253.38, 1080),
    (a3, v1, date '2000-01-03', 38,  230,    1140),
    (a4, v1, date '2000-01-04', 35,  210,    1200),
    (a5, v1, date '2000-01-05', 30,  180,    900);

  -- ---------- (p1) postgres sem JWT é barrado pela guarda ----------
  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(k3, 1150, null);
    r := r || '(p1) postgres sem JWT corrigindo KM: *** FALHOU *** (passou)'::text;
  exception when raise_exception then
    n_ok := n_ok + 1; r := r || '(p1) postgres sem JWT corrigindo KM: OK (barrado)'::text;
  end;

  -- ================= GESTOR (G) =================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid_g, 'email', mail_g,
    'role', 'authenticated', 'user_metadata', json_build_object('full_name', 'Gestor Teste'))::text, true);

  -- (g1) corrige o lançamento digitado a mais (último) e recalcula km_atual 2100 -> 1150
  n_total := n_total + 1;
  begin
    v_j := public.corrigir_km_atomico(k3, 1150, 'digitou 2 no lugar de 1');
    if (v_j ->> 'km_veiculo_antes')::int = 2100 and (v_j ->> 'km_veiculo_depois')::int = 1150
       and (v_j ->> 'veiculo_id')::uuid = v1 and (v_j ->> 'data')::date = date '2000-01-03'
       and (select km_atual from public.km_diario where id = k3) = 1150
       and (select km_atual from public.veiculos where id = v1) = 1150 then
      n_ok := n_ok + 1; r := r || '(g1) G corrige último lançamento e km_atual 2100 -> 1150: OK'::text;
    else r := r || ('(g1) G corrige último: *** FALHOU *** (' || v_j::text || ')')::text; end if;
  exception when others then r := r || ('(g1) G corrige último: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g2) audit_log com antes/depois/motivo/autor/papel
  n_total := n_total + 1;
  if exists (select 1 from public.audit_log l
             where l.tabela = 'km_diario' and l.operacao = 'corrigiu' and l.registro_id = k3::text
               and l.usuario_id = uid_g and l.usuario_email = mail_g
               and (l.dados -> 'antes' ->> 'km_atual')::int = 2100
               and (l.dados -> 'depois' ->> 'km_atual')::int = 1150
               and (l.dados -> 'km_veiculo' ->> 'antes')::int = 2100
               and (l.dados -> 'km_veiculo' ->> 'depois')::int = 1150
               and l.dados ->> 'motivo' = 'digitou 2 no lugar de 1'
               and l.dados -> 'autor' ->> 'papel' = 'gestor de frotas'
               and l.dados -> 'autor' ->> 'nome' = 'Gestor Teste'
               and l.dados -> 'contexto' ->> 'placa' = '__TCF01') then
    n_ok := n_ok + 1; r := r || '(g2) audit_log da correção de KM completo: OK'::text;
  else r := r || '(g2) audit_log da correção de KM: *** FALHOU ***'::text; end if;

  -- (g3) corrige lançamento do meio: km_atual do veículo NÃO muda
  n_total := n_total + 1;
  begin
    v_j := public.corrigir_km_atomico(k2, 1050, null);
    if (select km_atual from public.km_diario where id = k2) = 1050
       and (select km_atual from public.veiculos where id = v1) = 1150
       and (v_j ->> 'km_veiculo_depois')::int = 1150 then
      n_ok := n_ok + 1; r := r || '(g3) G corrige o meio, km_atual continua 1150: OK'::text;
    else r := r || '(g3) G corrige o meio: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g3) G corrige o meio: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g4) abaixo do anterior: recusado com a mensagem exata, nada muda
  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(k2, 999, null);
    r := r || '(g4) KM abaixo do anterior: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then
    if sqlerrm = 'O KM não pode ser menor que o lançamento anterior: 1.000 km em 01/01/2000.'
       and (select km_atual from public.km_diario where id = k2) = 1050 then
      n_ok := n_ok + 1; r := r || '(g4) KM abaixo do anterior: OK (recusado, texto pt-BR)'::text;
    else r := r || ('(g4) KM abaixo do anterior: *** FALHOU *** (texto: ' || sqlerrm || ')')::text; end if;
  end;

  -- (g5) acima do seguinte: recusado
  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(k2, 1200, null);
    r := r || '(g5) KM acima do seguinte: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then
    if sqlerrm = 'O KM não pode ser maior que o lançamento seguinte: 1.150 km em 03/01/2000.' then
      n_ok := n_ok + 1; r := r || '(g5) KM acima do seguinte: OK (recusado)'::text;
    else r := r || ('(g5) KM acima do seguinte: *** FALHOU *** (texto: ' || sqlerrm || ')')::text; end if;
  end;

  -- (g6) valor igual / (g7) id inexistente / (g8) negativo: SOF01
  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(k3, 1150, null);
    r := r || '(g6) valor igual: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g6) valor igual: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(gen_random_uuid(), 10, null);
    r := r || '(g7) id inexistente: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g7) id inexistente: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(k1, -1, null);
    r := r || '(g8) KM negativo: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g8) KM negativo: OK (recusado)'::text;
  end;

  -- (g9) o bug original destravou: lançar 1200 no dia seguinte passa (antes, 1200 < 2100 era recusado)
  n_total := n_total + 1;
  begin
    perform public.lancar_km_atomico(e1, v1, m1, 1200, date '2000-01-04', null);
    if (select km_atual from public.veiculos where id = v1) = 1200 then
      n_ok := n_ok + 1; r := r || '(g9) lançamento seguinte destravado (km_atual 1200): OK'::text;
    else r := r || '(g9) lançamento seguinte: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g9) lançamento seguinte: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g10) corrige litros 423 -> 42,3; km_atual do veículo NÃO muda; audit só com litros
  n_total := n_total + 1;
  begin
    perform public.corrigir_abastecimento(a2, 42.3, 253.38, 1080, 'vírgula no lugar errado');
    if (select litros from public.abastecimentos where id = a2) = 42.30
       and (select km_atual from public.veiculos where id = v1) = 1200
       and exists (select 1 from public.audit_log l
                   where l.tabela = 'abastecimentos' and l.operacao = 'corrigiu'
                     and l.registro_id = a2::text and l.usuario_id = uid_g
                     and (l.dados -> 'antes' ->> 'litros')::numeric = 423
                     and (l.dados -> 'depois' ->> 'litros')::numeric = 42.3
                     and not (l.dados -> 'antes' ? 'valor')
                     and l.dados ->> 'motivo' = 'vírgula no lugar errado') then
      n_ok := n_ok + 1; r := r || '(g10) G corrige litros, km_atual intacto, audit só litros: OK'::text;
    else r := r || '(g10) G corrige litros: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g10) G corrige litros: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g11) km abaixo do anterior / (g12) acima do seguinte / (g13) nada alterado
  n_total := n_total + 1;
  begin
    perform public.corrigir_abastecimento(a2, 42.3, 253.38, 990, null);
    r := r || '(g11) abastecimento km < anterior: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g11) abastecimento km < anterior: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.corrigir_abastecimento(a2, 42.3, 253.38, 1150, null);
    r := r || '(g12) abastecimento km > seguinte: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g12) abastecimento km > seguinte: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.corrigir_abastecimento(a2, 42.3, 253.38, 1080, null);
    r := r || '(g13) abastecimento nada alterado: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g13) abastecimento nada alterado: OK (recusado)'::text;
  end;

  -- (g14) edita e1: código (minúsculo vira maiúsculo) + motorista m2, que sai da e2
  n_total := n_total + 1;
  begin
    v_j := public.editar_equipe_atomico(e1, ' __teste_cf_e1x ', m2);
    if v_j ->> 'codigo' = '__TESTE_CF_E1X'
       and (select codigo from public.equipes where id = e1) = '__TESTE_CF_E1X'
       and (select equipe_id from public.motoristas where id = m1) is null
       and (select equipe_id from public.motoristas where id = m2) = e1
       and (select count(*) from public.veiculo_responsabilidade_historico where veiculo_id = v1 and fim is null) = 1
       and (select motorista_id from public.veiculo_responsabilidade_historico where veiculo_id = v1 and fim is null) = m2
       and (select count(*) from public.veiculo_responsabilidade_historico where veiculo_id = v2 and fim is null) = 1
       and (select motorista_id from public.veiculo_responsabilidade_historico where veiculo_id = v2 and fim is null) is null
       and exists (select 1 from public.audit_log l
                   where l.tabela = 'equipes' and l.operacao = 'atualizou' and l.registro_id = e1::text
                     and l.usuario_id = uid_g
                     and l.dados -> 'antes' ->> 'codigo' = '__TESTE_CF_E1'
                     and l.dados -> 'antes' -> 'motorista_ids' = jsonb_build_array(m1)
                     and l.dados -> 'depois' ->> 'motorista' = '__teste_cf_m2'
                     and (l.dados -> 'depois' ->> 'motorista_id')::uuid = m2
                     and l.dados ->> 'equipe_que_perdeu_motorista' = '__TESTE_CF_E2') then
      n_ok := n_ok + 1; r := r || '(g14) G edita código e motorista; históricos e audit (com ids) corretos: OK'::text;
    else r := r || '(g14) G edita equipe: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g14) G edita equipe: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g15) o carro não mudou de equipe
  n_total := n_total + 1;
  if (select equipe_id from public.veiculos where id = v1) = e1
     and (select equipe_id from public.veiculos where id = v2) = e2 then
    n_ok := n_ok + 1; r := r || '(g15) veículos continuam nas equipes (carro só pelo checklist): OK'::text;
  else r := r || '(g15) veículos: *** FALHOU ***'::text; end if;

  -- (g16) código repetido (sem diferenciar maiúsculas) / (g17) nada alterado
  n_total := n_total + 1;
  begin
    perform public.editar_equipe_atomico(e3, '__teste_cf_e2', null);
    r := r || '(g16) código repetido: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then
    if sqlerrm = 'Já existe uma equipe com o código __TESTE_CF_E2.' then
      n_ok := n_ok + 1; r := r || '(g16) código repetido: OK (recusado)'::text;
    else r := r || ('(g16) código repetido: *** FALHOU *** (texto: ' || sqlerrm || ')')::text; end if;
  end;
  n_total := n_total + 1;
  begin
    perform public.editar_equipe_atomico(e3, '__TESTE_CF_E3', null);
    r := r || '(g17) equipe nada alterado: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g17) equipe nada alterado: OK (recusado)'::text;
  end;

  -- (g18) legado com DOIS motoristas ativos (m3, m4) em e4: escolher m3 limpa m4;
  --       m5 (inativo, também em e4) não é tocado; audit guarda os 2 ids (revisão B5/B9)
  n_total := n_total + 1;
  begin
    perform public.editar_equipe_atomico(e4, '__TESTE_CF_E4', m3);
    if (select equipe_id from public.motoristas where id = m3) = e4
       and (select equipe_id from public.motoristas where id = m4) is null
       and (select equipe_id from public.motoristas where id = m5) = e4
       and (select count(*) from public.motoristas where equipe_id = e4 and ativo) = 1
       and (select motorista_id from public.veiculo_responsabilidade_historico where veiculo_id = v3 and fim is null) = m3
       and exists (select 1 from public.audit_log l
                   where l.registro_id = e4::text and l.operacao = 'atualizou'
                     and l.dados -> 'antes' -> 'motorista_ids' @> jsonb_build_array(m3, m4)
                     and jsonb_array_length(l.dados -> 'antes' -> 'motorista_ids') = 2) then
      n_ok := n_ok + 1; r := r || '(g18) legado com 2 ativos: limpa o outro, inativo intacto, ids no audit: OK'::text;
    else r := r || '(g18) legado com 2 ativos: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g18) legado com 2 ativos: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g19) "Sem motorista" numa equipe que tem motorista atual (m3): m3 fica sem equipe,
  --       histórico do v3 reaberto sem motorista, m5 (inativo) intacto
  n_total := n_total + 1;
  begin
    perform public.editar_equipe_atomico(e4, '__TESTE_CF_E4', null);
    if (select equipe_id from public.motoristas where id = m3) is null
       and (select equipe_id from public.motoristas where id = m5) = e4
       and (select count(*) from public.veiculo_responsabilidade_historico where veiculo_id = v3 and fim is null) = 1
       and (select motorista_id from public.veiculo_responsabilidade_historico where veiculo_id = v3 and fim is null) is null then
      n_ok := n_ok + 1; r := r || '(g19) "Sem motorista" com motorista atual: OK'::text;
    else r := r || '(g19) "Sem motorista": *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g19) "Sem motorista": *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g20) motorista SEM equipe (m6) vai para e3 (equipe sem veículo): nenhum histórico
  --       criado, nenhuma equipe "perdeu motorista"
  n_total := n_total + 1;
  begin
    perform public.editar_equipe_atomico(e3, '__TESTE_CF_E3', m6);
    if (select equipe_id from public.motoristas where id = m6) = e3
       and exists (select 1 from public.audit_log l
                   where l.registro_id = e3::text and l.operacao = 'atualizou'
                     and l.dados ->> 'equipe_que_perdeu_motorista' is null
                     and (l.dados -> 'depois' ->> 'motorista_id')::uuid = m6) then
      n_ok := n_ok + 1; r := r || '(g20) motorista sem equipe atribuído: OK'::text;
    else r := r || '(g20) motorista sem equipe: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g20) motorista sem equipe: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g21) motorista INATIVO (m7): SOF01, nada muda
  n_total := n_total + 1;
  begin
    perform public.editar_equipe_atomico(e3, '__TESTE_CF_E3', m7);
    r := r || '(g21) motorista inativo: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then
    if sqlerrm = 'Motorista não encontrado ou desativado.'
       and (select equipe_id from public.motoristas where id = m7) is null
       and (select equipe_id from public.motoristas where id = m6) = e3 then
      n_ok := n_ok + 1; r := r || '(g21) motorista inativo: OK (recusado)'::text;
    else r := r || ('(g21) motorista inativo: *** FALHOU *** (texto: ' || sqlerrm || ')')::text; end if;
  end;

  -- (g22) KM do abastecimento apagado (null): grava null, audit com km antes 1140 e depois null
  n_total := n_total + 1;
  begin
    perform public.corrigir_abastecimento(a3, 38, 230, null, null);
    if (select km from public.abastecimentos where id = a3) is null
       and exists (select 1 from public.audit_log l
                   where l.registro_id = a3::text and l.operacao = 'corrigiu'
                     and (l.dados -> 'antes' ->> 'km')::int = 1140
                     and (l.dados -> 'depois') ? 'km'
                     and l.dados -> 'depois' ->> 'km' is null
                     and not (l.dados -> 'antes' ? 'litros')) then
      n_ok := n_ok + 1; r := r || '(g22) KM do abastecimento apagado (null): OK'::text;
    else r := r || '(g22) KM apagado: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g22) KM apagado: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g23) vizinho sem KM é pulado: a2 -> 1300; o seguinte COM km é a4 (1.200), não a3 (null)
  n_total := n_total + 1;
  begin
    perform public.corrigir_abastecimento(a2, 42.3, 253.38, 1300, null);
    r := r || '(g23) pula vizinho sem KM: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then
    if sqlerrm = 'O KM não pode ser maior que o do abastecimento seguinte: 1.200 km em 04/01/2000.' then
      n_ok := n_ok + 1; r := r || '(g23) pula vizinho sem KM: OK (comparou com 1.200 de 04/01)'::text;
    else r := r || ('(g23) pula vizinho sem KM: *** FALHOU *** (texto: ' || sqlerrm || ')')::text; end if;
  end;

  -- (g24) revisão B1: legado fora de ordem (a5 km 900 < a4 1200) — corrigir só os litros passa
  n_total := n_total + 1;
  begin
    perform public.corrigir_abastecimento(a5, 31, 180, 900, null);
    if (select litros from public.abastecimentos where id = a5) = 31
       and (select km from public.abastecimentos where id = a5) = 900 then
      n_ok := n_ok + 1; r := r || '(g24) legado fora de ordem: corrigir só litros passa (B1): OK'::text;
    else r := r || '(g24) legado fora de ordem: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g24) legado fora de ordem: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- ================= COMUM (U) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_u, 'email', mail_u, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(k1, 1001, null);
    r := r || '(u1) U corrigindo KM: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u1) U corrigindo KM: OK (barrado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.corrigir_abastecimento(a1, 41, 240, 1000, null);
    r := r || '(u2) U corrigindo abastecimento: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u2) U corrigindo abastecimento: OK (barrado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.editar_equipe_atomico(e3, '__TESTE_CF_E3Y', null);
    r := r || '(u3) U editando equipe: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u3) U editando equipe: OK (barrado)'::text;
  end;

  -- (info, não conta) lacuna PRÉ-EXISTENTE: UPDATE direto pela RLS "sofia access"
  begin
    update public.km_diario set km_atual = 5 where id = k1;
    get diagnostics v_int = row_count;
    raise exception 'desfaz' using errcode = 'SOF99';
  exception when sqlstate 'SOF99' then
    r := r || ('(info) U altera km_diario direto pela RLS: ' || case when v_int = 1 then 'SIM (lacuna pré-existente, spec §7 R1)' else 'não' end)::text;
  end;

  -- ================= SEM LINHA (N) e JWT SEM E-MAIL (J) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_n, 'email', mail_n, 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(k1, 1001, null);
    r := r || '(n1) N corrigindo KM: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(n1) N corrigindo KM: OK (barrado)'::text;
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(k1, 1001, null);
    r := r || '(j1) JWT sem e-mail corrigindo KM: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(j1) JWT sem e-mail corrigindo KM: OK (barrado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.editar_equipe_atomico(e3, '__TESTE_CF_E3Z', null);
    r := r || '(j2) JWT sem e-mail editando equipe: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(j2) JWT sem e-mail editando equipe: OK (barrado)'::text;
  end;

  -- ================= ADMIN (A) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_a, 'email', mail_a, 'role', 'authenticated')::text, true);

  -- (u4) nada do que U/N/J tentou ficou gravado (lido como A)
  n_total := n_total + 1;
  if (select km_atual from public.km_diario where id = k1) = 1000
     and (select litros from public.abastecimentos where id = a1) = 40
     and (select codigo from public.equipes where id = e3) = '__TESTE_CF_E3'
     and not exists (select 1 from public.audit_log where usuario_id in (uid_u, uid_n)) then
    n_ok := n_ok + 1; r := r || '(u4) tentativas de U/N/J não gravaram nada: OK'::text;
  else r := r || '(u4) tentativas de U/N/J: *** FALHOU ***'::text; end if;

  n_total := n_total + 1;
  begin
    perform public.corrigir_km_atomico(k1, 1001, null);
    if (select km_atual from public.km_diario where id = k1) = 1001
       and exists (select 1 from public.audit_log l where l.registro_id = k1::text
                   and l.operacao = 'corrigiu' and l.usuario_id = uid_a
                   and l.dados -> 'autor' ->> 'papel' = 'administrador'
                   and l.dados ->> 'motivo' is null) then
      n_ok := n_ok + 1; r := r || '(a1) A corrige KM (papel administrador, motivo vazio = null): OK'::text;
    else r := r || '(a1) A corrige KM: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(a1) A corrige KM: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.corrigir_abastecimento(a1, 40, 241, 1000, '  ');
    if (select valor from public.abastecimentos where id = a1) = 241 then
      n_ok := n_ok + 1; r := r || '(a2) A corrige valor do abastecimento: OK'::text;
    else r := r || '(a2) A corrige abastecimento: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(a2) A corrige abastecimento: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (z) contagem final de auditoria das fixtures: 7 'corrigiu' de KM/abastecimento
  --     (g1 k3, g3 k2, g10 a2, g22 a3, g24 a5 do G; a1 k1, a2 a1 do A) e
  --     4 'atualizou' de equipe (g14 e1, g18 e4, g19 e4, g20 e3)
  n_total := n_total + 1;
  select count(*) into v_int from public.audit_log
   where registro_id in (k1::text, k2::text, k3::text, a1::text, a2::text, a3::text, a4::text, a5::text)
     and operacao = 'corrigiu';
  if v_int = 7 and (select count(*) from public.audit_log
                    where registro_id in (e1::text, e2::text, e3::text, e4::text)) = 4 then
    n_ok := n_ok + 1; r := r || '(z) 7 correções e 4 edições de equipe auditadas, nenhuma a mais: OK'::text;
  else r := r || ('(z) contagem de auditoria: *** FALHOU *** (corrigiu=' || v_int || ')')::text; end if;

  raise exception E'TESTE F1/F2/F3 (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;
