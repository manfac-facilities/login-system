-- ============================================================
-- *** NUNCA RODOU *** (escrito em 03/11/2026, branch feat/frotas-manutencao)
-- Sofia — Manutenção corretiva + colunas de revisão: TESTE DE COMPORTAMENTO (não altera nada)
-- DEPENDE DE: sdd-sql-sofia-gestor-frotas.sql e sdd-sql-sofia-manutencao.sql, aplicados.
-- Rodar como postgres (SQL Editor ou Management API com o PAT), projeto
-- iyytcavcgukfjnjjrerx. O bloco TERMINA EM ERRO DE PROPÓSITO: o raise final é
-- o relatório e a garantia de rollback. Resultado esperado: "RESUMO: 30/30 OK"
-- (p1, g1–g20, u1–u5, n1–n2, a1, z).
-- Fixture que falhar por coluna NOT NULL fora dos arquivos = deriva de schema:
-- ajustar a fixture, nunca o teste.
-- Depois, como postgres, conferir 0 linhas:
--   select count(*) from public.equipes where codigo like '\_\_TESTE\_MN%';
--   select count(*) from public.veiculos where placa like '\_\_TMN%';
--   select count(*) from auth.users where email like '\_\_teste\_mn\_%';
--   select count(*) from public.manutencoes where defeito like '\_\_teste%';
-- ============================================================

begin;

do $$
declare
  uid_g constant uuid := '00000000-0000-4000-a000-0000000000d1';
  uid_u constant uuid := '00000000-0000-4000-a000-0000000000d2';
  uid_a constant uuid := '00000000-0000-4000-a000-0000000000d3';
  uid_n constant uuid := '00000000-0000-4000-a000-0000000000d4';
  mail_g constant text := '__teste_mn_gestor@manfac.com.br';
  mail_u constant text := '__teste_mn_comum@manfac.com.br';
  mail_a constant text := '__teste_mn_admin@manfac.com.br';
  mail_n constant text := '__teste_mn_semacesso@manfac.com.br';
  e1 uuid := gen_random_uuid();
  v1 uuid := gen_random_uuid();   -- com equipe e1
  v2 uuid := gen_random_uuid();   -- sem equipe
  v3 uuid := gen_random_uuid();   -- inativo
  m1 uuid := gen_random_uuid();
  mg1 uuid; mg2 uuid; mg12 uuid; ma1 uuid; rv uuid := gen_random_uuid();
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
    (mail_g, 'analista', 'teste-mn'), (mail_u, 'analista', 'teste-mn'),
    (mail_a, 'administrador', 'teste-mn'), (mail_n, 'analista', 'teste-mn');
  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by) values
    (mail_g, 'sofia', true, 'teste-mn'), (mail_u, 'sofia', true, 'teste-mn');
  insert into public.sofia_gestores (user_email, granted_by) values (mail_g, 'teste-mn');

  insert into public.equipes (id, codigo, ativo) values (e1, '__TESTE_MN_E1', true);
  insert into public.veiculos (id, placa, modelo, km_atual, equipe_id, status) values
    (v1, '__TMN01', 'teste', 1000, e1, 'ativo'),
    (v2, '__TMN02', 'teste', 2000, null, 'ativo'),
    (v3, '__TMN03', 'teste', 3000, null, 'inativo');
  insert into public.motoristas (id, nome, equipe_id, ativo) values (m1, '__teste_mn_m1', e1, true);
  insert into public.veiculo_responsabilidade_historico (veiculo_id, equipe_id, motorista_id, inicio) values
    (v1, e1, m1, date '2000-01-01'),
    (v2, e1, null, date '2000-01-01');

  -- ---------- (p1) postgres sem JWT é barrado pela guarda ----------
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v1, '__teste p1', null, date '2000-02-01', null, null, null, null, true, null);
    r := r || '(p1) postgres sem JWT abrindo manutenção: *** FALHOU *** (passou)'::text;
  exception when raise_exception then
    n_ok := n_ok + 1; r := r || '(p1) postgres sem JWT abrindo manutenção: OK (barrado)'::text;
  end;

  -- ================= GESTOR (G) =================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid_g, 'email', mail_g,
    'role', 'authenticated', 'user_metadata', json_build_object('full_name', 'Gestor Teste'))::text, true);

  -- (g1) abre tirando da equipe: manutenção + veículo em manutenção + histórico fechado + auditoria
  n_total := n_total + 1;
  begin
    v_j := public.sofia_abrir_manutencao(v1, '__teste câmbio', 'Oficina X', date '2000-02-01', date '2000-02-05',
                                         null, null, null, true, null);
    mg1 := (v_j ->> 'id')::uuid;
    if (select status from public.manutencoes where id = mg1) = 'aguardando_orcamento'
       and (select criado_por from public.manutencoes where id = mg1) = mail_g
       and (select status from public.veiculos where id = v1) = 'manutencao'
       and (select equipe_id from public.veiculos where id = v1) is null
       and (select previsao_retorno_oficina from public.veiculos where id = v1) = date '2000-02-05'
       and not exists (select 1 from public.veiculo_responsabilidade_historico where veiculo_id = v1 and fim is null)
       and exists (select 1 from public.veiculo_responsabilidade_historico where veiculo_id = v2 and fim is null)
       and v_j ->> 'equipe_que_saiu' = '__TESTE_MN_E1'
       and exists (select 1 from public.audit_log l
                   where l.tabela = 'manutencoes' and l.operacao = 'criou' and l.registro_id = mg1::text
                     and l.usuario_id = uid_g and l.dados ->> 'tipo' = 'manutencao_aberta'
                     and l.dados -> 'contexto' ->> 'placa' = '__TMN01'
                     and l.dados -> 'autor' ->> 'papel' = 'gestor de frotas') then
      n_ok := n_ok + 1; r := r || '(g1) G abre tirando da equipe (veículo, histórico, auditoria): OK'::text;
    else r := r || ('(g1) G abre tirando da equipe: *** FALHOU *** (' || v_j::text || ')')::text; end if;
  exception when others then r := r || ('(g1) G abre: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g2) abre SEM tirar: veículo intacto
  n_total := n_total + 1;
  begin
    v_j := public.sofia_abrir_manutencao(v2, '__teste suspensão', null, date '2000-02-01', null,
                                         null, 'empresa', 'aguardando_orcamento', false, null);
    mg2 := (v_j ->> 'id')::uuid;
    if (select status from public.veiculos where id = v2) = 'ativo'
       and (select tirou_da_equipe from public.manutencoes where id = mg2) = false
       and v_j ->> 'veiculo_status' = 'ativo' then
      n_ok := n_ok + 1; r := r || '(g2) G abre sem tirar, veículo continua ativo: OK'::text;
    else r := r || '(g2) G abre sem tirar: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g2) G abre sem tirar: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g3) defeito vazio / (g4) saída prevista antes da entrada / (g5) status concluida na abertura
  -- (g6) veículo inativo / (g7) quem arca inválido: todos SOF01
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '   ', null, date '2000-02-01', null, null, null, null, false, null);
    r := r || '(g3) defeito vazio: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g3) defeito vazio: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '__teste g4', null, date '2000-02-10', date '2000-02-01', null, null, null, false, null);
    r := r || '(g4) saída prevista antes da entrada: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g4) saída prevista antes da entrada: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '__teste g5', null, date '2000-02-01', null, 10, 'empresa', 'concluida', false, null);
    r := r || '(g5) abrir já concluída: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g5) abrir já concluída: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v3, '__teste g6', null, date '2000-02-01', null, null, null, null, true, null);
    r := r || '(g6) veículo inativo: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g6) veículo inativo: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '__teste g7', null, date '2000-02-01', null, null, 'xyz', null, false, null);
    r := r || '(g7) quem arca inválido: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g7) quem arca inválido: OK (recusado)'::text;
  end;

  -- (g8) G muda status por UPDATE direto (RLS deixa)
  n_total := n_total + 1;
  begin
    update public.manutencoes set status = 'em_conserto', updated_at = now()
     where id = mg1 and status = 'aguardando_orcamento';
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g8) G avança status por UPDATE: OK'::text;
    else r := r || ('(g8) G avança status: *** FALHOU *** (linhas=' || v_int || ')')::text; end if;
  exception when others then r := r || ('(g8) G avança status: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g9) UPDATE direto para concluida sem saída/custo: CHECK de coerência barra
  n_total := n_total + 1;
  begin
    update public.manutencoes set status = 'concluida' where id = mg1;
    r := r || '(g9) concluída sem saída por UPDATE: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(g9) concluída sem saída por UPDATE: OK (CHECK barrou)'::text;
  end;

  -- (g10) concluir sem quem arca / (g11) saída antes da entrada: SOF01
  n_total := n_total + 1;
  begin
    perform public.sofia_concluir_manutencao(mg1, date '2000-02-04', 100, null);
    r := r || '(g10) concluir sem quem arca: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g10) concluir sem quem arca: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_concluir_manutencao(mg1, date '2000-01-15', 100, 'locadora');
    r := r || '(g11) saída antes da entrada: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g11) saída antes da entrada: OK (recusado)'::text;
  end;

  -- (g12) segunda manutenção tirando o MESMO carro; concluir a 1ª não devolve o carro
  n_total := n_total + 1;
  begin
    v_j := public.sofia_abrir_manutencao(v1, '__teste pneu', null, date '2000-02-02', date '2000-02-08',
                                         null, null, null, true, null);
    mg12 := (v_j ->> 'id')::uuid;
    v_j := public.sofia_concluir_manutencao(mg1, date '2000-02-04', 1500, 'locadora');
    if (v_j ->> 'voltou_ativo')::boolean = false
       and (select status from public.veiculos where id = v1) = 'manutencao'
       and (select status from public.manutencoes where id = mg1) = 'concluida'
       and (select custo from public.manutencoes where id = mg1) = 1500 then
      n_ok := n_ok + 1; r := r || '(g12) com outra aberta, concluir não devolve o carro: OK'::text;
    else r := r || ('(g12) outra aberta: *** FALHOU *** (' || v_j::text || ')')::text; end if;
  exception when others then r := r || ('(g12) outra aberta: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g13) concluir a última: carro volta a ativo, previsão e substituto limpos
  n_total := n_total + 1;
  begin
    v_j := public.sofia_concluir_manutencao(mg12, date '2000-02-09', 0, 'empresa');
    if (v_j ->> 'voltou_ativo')::boolean
       and (select status from public.veiculos where id = v1) = 'ativo'
       and (select previsao_retorno_oficina from public.veiculos where id = v1) is null
       and (select equipe_id from public.veiculos where id = v1) is null then
      n_ok := n_ok + 1; r := r || '(g13) concluir a última devolve o carro a ativo (sem equipe): OK'::text;
    else r := r || ('(g13) concluir a última: *** FALHOU *** (' || v_j::text || ')')::text; end if;
  exception when others then r := r || ('(g13) concluir a última: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g14) concluir de novo: SOF01
  n_total := n_total + 1;
  begin
    perform public.sofia_concluir_manutencao(mg12, date '2000-02-09', 0, 'empresa');
    r := r || '(g14) concluir duas vezes: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g14) concluir duas vezes: OK (recusado)'::text;
  end;

  -- (g15) DELETE direto: sem privilégio nem para gestor
  n_total := n_total + 1;
  begin
    delete from public.manutencoes where id = mg2;
    r := r || '(g15) G apagando manutenção: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g15) G apagando manutenção: OK (sem privilégio)'::text;
  end;

  -- (g16) INSERT direto com carimbo de outra pessoa: RLS barra
  n_total := n_total + 1;
  begin
    insert into public.manutencoes (veiculo_id, defeito, data_entrada, criado_por)
    values (v2, '__teste g16', date '2000-02-01', mail_u);
    r := r || '(g16) INSERT com criado_por de outro: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g16) INSERT com criado_por de outro: OK (RLS barrou)'::text;
  end;

  -- (g17) INSERT direto com o próprio carimbo: passa
  n_total := n_total + 1;
  begin
    insert into public.manutencoes (veiculo_id, defeito, data_entrada, criado_por, tirou_da_equipe)
    values (v2, '__teste g17', date '2000-02-01', mail_g, false);
    n_ok := n_ok + 1; r := r || '(g17) INSERT com o próprio carimbo: OK'::text;
  exception when others then r := r || ('(g17) INSERT com o próprio carimbo: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g18) revisão nova: prever_proxima = true e origem = manual por padrão
  n_total := n_total + 1;
  begin
    insert into public.revisoes (id, veiculo_id, tipo, km_realizada, data_realizada, status)
    values (rv, v2, 'preventiva', 1900, date '2000-01-20', 'em_dia');
    if (select prever_proxima from public.revisoes where id = rv) = true
       and (select origem from public.revisoes where id = rv) = 'manual' then
      n_ok := n_ok + 1; r := r || '(g18) revisão nova com prever_proxima=true e origem=manual: OK'::text;
    else r := r || '(g18) padrões da revisão: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g18) revisão nova: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g19) origem fora da lista: CHECK barra
  n_total := n_total + 1;
  begin
    update public.revisoes set origem = 'planilha' where id = rv;
    r := r || '(g19) origem inválida: *** FALHOU *** (passou)'::text;
  exception when check_violation then n_ok := n_ok + 1; r := r || '(g19) origem inválida: OK (CHECK barrou)'::text;
  end;

  -- (g20) intervalo próprio: 500 barra, 15000 passa
  n_total := n_total + 1;
  begin
    begin
      update public.veiculos set intervalo_revisao_km = 500 where id = v2;
      r := r || '(g20) intervalo 500: *** FALHOU *** (passou)'::text;
    exception when check_violation then
      update public.veiculos set intervalo_revisao_km = 15000 where id = v2;
      if (select intervalo_revisao_km from public.veiculos where id = v2) = 15000 then
        n_ok := n_ok + 1; r := r || '(g20) intervalo 500 barrado, 15000 gravado: OK'::text;
      else r := r || '(g20) intervalo 15000: *** FALHOU ***'::text; end if;
    end;
  exception when others then r := r || ('(g20) intervalo: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- ================= USUÁRIO COMUM DO FROTAS (U) =================
  perform set_config('request.jwt.claims', json_build_object('sub', uid_u, 'email', mail_u,
    'role', 'authenticated')::text, true);

  -- (u1) lê as manutenções (mg1, mg2, mg12, g17)
  n_total := n_total + 1;
  select count(*) into v_int from public.manutencoes where veiculo_id in (v1, v2);
  if v_int = 4 then n_ok := n_ok + 1; r := r || '(u1) U lê as 4 manutenções: OK'::text;
  else r := r || ('(u1) U lê: *** FALHOU *** (viu ' || v_int || ')')::text; end if;

  -- (u2) RPC abrir / (u3) RPC concluir: barrados pela guarda
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '__teste u2', null, date '2000-02-01', null, null, null, null, false, null);
    r := r || '(u2) U abrindo: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u2) U abrindo: OK (barrado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_concluir_manutencao(mg2, date '2000-02-03', 10, 'empresa');
    r := r || '(u3) U concluindo: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u3) U concluindo: OK (barrado)'::text;
  end;

  -- (u4) INSERT direto, mesmo com o próprio carimbo: RLS barra
  n_total := n_total + 1;
  begin
    insert into public.manutencoes (veiculo_id, defeito, data_entrada, criado_por)
    values (v2, '__teste u4', date '2000-02-01', mail_u);
    r := r || '(u4) U INSERT direto: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(u4) U INSERT direto: OK (RLS barrou)'::text;
  end;

  -- (u5) UPDATE direto: 0 linhas, nada muda
  n_total := n_total + 1;
  update public.manutencoes set status = 'em_conserto' where id = mg2;
  get diagnostics v_int = row_count;
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(u5) U UPDATE direto: OK (0 linhas)'::text;
  else r := r || ('(u5) U UPDATE direto: *** FALHOU *** (linhas=' || v_int || ')')::text; end if;

  -- ================= SEM ACESSO AO FROTAS (N) =================
  perform set_config('request.jwt.claims', json_build_object('sub', uid_n, 'email', mail_n,
    'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  select count(*) into v_int from public.manutencoes where veiculo_id in (v1, v2);
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(n1) N não vê manutenções: OK'::text;
  else r := r || ('(n1) N vê: *** FALHOU *** (viu ' || v_int || ')')::text; end if;

  n_total := n_total + 1;
  begin
    insert into public.manutencoes (veiculo_id, defeito, data_entrada, criado_por)
    values (v2, '__teste n2', date '2000-02-01', mail_n);
    r := r || '(n2) N INSERT direto: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(n2) N INSERT direto: OK (RLS barrou)'::text;
  end;

  -- ================= ADMIN DO HUB (A) =================
  perform set_config('request.jwt.claims', json_build_object('sub', uid_a, 'email', mail_a,
    'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  begin
    v_j := public.sofia_abrir_manutencao(v2, '__teste a1', null, date '2000-03-01', null, null, null,
                                         'aguardando_aprovacao', true, '  ');
    ma1 := (v_j ->> 'id')::uuid;
    if (select status from public.veiculos where id = v2) = 'manutencao'
       and (select previsao_retorno_oficina from public.veiculos where id = v2) = date '2000-03-01'
       and (select observacoes from public.manutencoes where id = ma1) is null
       and exists (select 1 from public.audit_log l where l.registro_id = ma1::text
                   and l.dados -> 'autor' ->> 'papel' = 'administrador') then
      n_ok := n_ok + 1; r := r || '(a1) A abre (previsão = entrada sem saída prevista; papel administrador): OK'::text;
    else r := r || '(a1) A abre: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(a1) A abre: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (z) auditoria: 4 'criou' (g1, g2, g12, a1; o INSERT direto do g17 não audita) e 2 'atualizou' (conclusões)
  n_total := n_total + 1;
  if (select count(*) from public.audit_log where tabela = 'manutencoes' and operacao = 'criou'
        and registro_id in (mg1::text, mg2::text, mg12::text, ma1::text)) = 4
     and (select count(*) from public.audit_log where tabela = 'manutencoes' and operacao = 'atualizou'
        and registro_id in (mg1::text, mg2::text, mg12::text, ma1::text)) = 2 then
    n_ok := n_ok + 1; r := r || '(z) 4 aberturas e 2 conclusões auditadas, nenhuma a mais: OK'::text;
  else r := r || '(z) contagem de auditoria: *** FALHOU ***'::text; end if;

  raise exception E'TESTE MANUTENÇÃO (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;
