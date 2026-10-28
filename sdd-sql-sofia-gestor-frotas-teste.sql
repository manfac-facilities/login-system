-- ============================================================
-- *** NÃO APLICADO / NUNCA RODOU *** (escrito em 26/10/2026, branch feat/frotas-gestor)
-- Sofia — gestor de frotas: TESTE DE COMPORTAMENTO (não altera nada)
-- Rodar DEPOIS de sdd-sql-sofia-gestor-frotas.sql, como postgres (SQL
-- Editor ou Management API com o PAT), projeto iyytcavcgukfjnjjrerx.
-- O bloco TERMINA EM ERRO DE PROPÓSITO: o raise final é o relatório e a
-- garantia de rollback. Resultado esperado: "RESUMO: 37/37 OK"
-- (p1, g0–g18, u1–u8, n1–n2, x1–x2, w1, j1, a1–a2, z).
-- Se uma fixture falhar por coluna NOT NULL que não está nos arquivos,
-- é deriva de schema: ajustar a fixture, nunca o teste.
-- ============================================================

begin;

do $$
declare
  uid_g constant uuid := '00000000-0000-4000-a000-0000000000a1';
  uid_u constant uuid := '00000000-0000-4000-a000-0000000000a2';
  uid_a constant uuid := '00000000-0000-4000-a000-0000000000a3';
  uid_n constant uuid := '00000000-0000-4000-a000-0000000000a4';
  uid_x constant uuid := '00000000-0000-4000-a000-0000000000a5';
  uid_w constant uuid := '00000000-0000-4000-a000-0000000000a6';
  mail_g constant text := '__teste_gf_gestor@manfac.com.br';
  mail_u constant text := '__teste_gf_comum@manfac.com.br';
  mail_a constant text := '__teste_gf_admin@manfac.com.br';
  mail_n constant text := '__teste_gf_semlinha@manfac.com.br';
  mail_x constant text := '__teste_gf_gestor_sem_slug@manfac.com.br';
  mail_w constant text := '__teste_gf_gestor_sem_linha_acesso@manfac.com.br';
  e1  uuid := gen_random_uuid();
  v1  uuid := gen_random_uuid();
  m1  uuid := gen_random_uuid();  -- G altera autorização/desconto
  m2  uuid := gen_random_uuid();  -- G apaga direto
  m3  uuid := gen_random_uuid();  -- G apaga em massa
  m4  uuid := gen_random_uuid();  -- U/N/X tentam, sobrevive
  m5  uuid := gen_random_uuid();  -- A apaga direto
  m6  uuid := gen_random_uuid();  -- A apaga em massa
  s1  uuid := gen_random_uuid();  -- G altera desconto
  s2  uuid := gen_random_uuid();  -- G apaga
  s3  uuid := gen_random_uuid();  -- A altera desconto
  ke1 uuid := gen_random_uuid();  -- G autoriza
  ke2 uuid := gen_random_uuid();  -- G apaga
  k1  uuid := gen_random_uuid();  -- G apaga
  k2  uuid := gen_random_uuid();  -- U tenta apagar
  a1  uuid := gen_random_uuid();  -- G apaga
  a2  uuid := gen_random_uuid();  -- U tenta apagar
  r   text[] := '{}';
  n_ok int := 0;
  n_total int := 0;
  v_int int;
  v_int2 int;
  v_txt text;
begin
  -- ---------- FIXTURES (postgres, acima da RLS) ----------
  insert into auth.users (id, email, aud, role) values
    (uid_g, mail_g, 'authenticated', 'authenticated'),
    (uid_u, mail_u, 'authenticated', 'authenticated'),
    (uid_a, mail_a, 'authenticated', 'authenticated'),
    (uid_n, mail_n, 'authenticated', 'authenticated'),
    (uid_x, mail_x, 'authenticated', 'authenticated'),
    (uid_w, mail_w, 'authenticated', 'authenticated');

  insert into public.hub_user_roles (user_email, nivel, granted_by) values
    (mail_g, 'analista', 'teste-gf'),
    (mail_u, 'analista', 'teste-gf'),
    (mail_a, 'administrador', 'teste-gf'),
    (mail_x, 'analista', 'teste-gf'),
    (mail_w, 'analista', 'teste-gf');

  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by) values
    (mail_g, 'sofia', true,  'teste-gf'),
    (mail_u, 'sofia', true,  'teste-gf'),
    (mail_x, 'sofia', false, 'teste-gf');

  insert into public.sofia_gestores (user_email, granted_by) values
    (mail_g, 'teste-gf'),
    (mail_x, 'teste-gf'),
    (mail_w, 'teste-gf');  -- W: gestor SEM nenhuma linha em hub_system_access

  insert into public.equipes (id, codigo, ativo) values (e1, '__teste_gf_e1', true);
  insert into public.veiculos (id, placa, modelo, km_atual, valor_locacao_mensal, equipe_id)
  values (v1, '__TGF01', 'teste', 1000, 1000, e1);

  insert into public.multas (id, veiculo_id, data, descricao, valor) values
    (m1, v1, current_date, 'teste-gf', 10), (m2, v1, current_date, 'teste-gf', 10),
    (m3, v1, current_date, 'teste-gf', 10), (m4, v1, current_date, 'teste-gf', 10),
    (m5, v1, current_date, 'teste-gf', 10), (m6, v1, current_date, 'teste-gf', 10);
  insert into public.sinistros (id, veiculo_id, data, descricao) values
    (s1, v1, current_date, 'teste-gf'), (s2, v1, current_date, 'teste-gf'),
    (s3, v1, current_date, 'teste-gf');
  insert into public.km_excedido_desconto (id, veiculo_id, mes, km_contratual, km_realizado) values
    (ke1, v1, date '2000-01-01', 100, 200), (ke2, v1, date '2000-02-01', 100, 200);
  insert into public.km_diario (id, equipe_id, veiculo_id, km_atual, data) values
    (k1, e1, v1, 900, date '2000-01-01'), (k2, e1, v1, 950, date '2000-01-02');
  insert into public.abastecimentos (id, veiculo_id, data, valor) values
    (a1, v1, current_date, 50), (a2, v1, current_date, 50);

  -- ---------- (p1) POSTGRES SEM JWT continua barrado (limitação mantida) ----------
  n_total := n_total + 1;
  begin
    update public.multas set autorizacao_status = 'solicitado' where id = m4;
    r := r || '(p1) postgres sem JWT alterando autorização: *** FALHOU *** (passou)'::text;
  exception when raise_exception then
    n_ok := n_ok + 1; r := r || '(p1) postgres sem JWT alterando autorização: OK (barrado)'::text;
  end;

  -- ================= GESTOR (G) =================
  perform set_config('role', 'authenticated', true);

  -- (g0) e-mail do JWT em maiúscula e com espaço: o lower(trim) da função
  -- tem que casar com a linha normalizada de sofia_gestores/hub_system_access
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'email', '  ' || upper(mail_g) || ' ', 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  if public.sofia_pode_gerir() is true then n_ok := n_ok + 1; r := r || '(g0) G com e-mail do JWT em maiúscula/espaço: true: OK'::text;
  else r := r || '(g0) G com e-mail do JWT em maiúscula/espaço: *** FALHOU ***'::text; end if;

  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'email', mail_g, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if public.sofia_pode_gerir() is true then n_ok := n_ok + 1; r := r || '(g1) G: sofia_pode_gerir = true: OK'::text;
  else r := r || '(g1) G: sofia_pode_gerir = true: *** FALHOU ***'::text; end if;

  -- (g2) multa: autorização + valor descontado
  n_total := n_total + 1;
  begin
    update public.multas set autorizacao_status = 'solicitado', valor_descontado = 10 where id = m1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g2) G altera autorização/desconto de multa: OK'::text;
    else r := r || format('(g2) G altera autorização/desconto de multa: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g2) G altera autorização/desconto de multa: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g3) sinistro: desconto
  n_total := n_total + 1;
  begin
    update public.sinistros set autorizacao_status = 'solicitado', valor_descontado = 5 where id = s1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g3) G altera desconto de sinistro: OK'::text;
    else r := r || format('(g3) G altera desconto de sinistro: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g3) G altera desconto de sinistro: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g4) KM excedido: autorizar
  n_total := n_total + 1;
  begin
    update public.km_excedido_desconto set autorizacao_status = 'autorizado' where id = ke1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g4) G autoriza KM excedido: OK'::text;
    else r := r || format('(g4) G autoriza KM excedido: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g4) G autoriza KM excedido: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g5) desativar equipe
  n_total := n_total + 1;
  begin
    update public.equipes set ativo = false where id = e1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g5) G desativa equipe: OK'::text;
    else r := r || format('(g5) G desativa equipe: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g5) G desativa equipe: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g6) valor de locação
  n_total := n_total + 1;
  begin
    update public.veiculos set valor_locacao_mensal = 1500 where id = v1;
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g6) G altera valor de locação: OK'::text;
    else r := r || format('(g6) G altera valor de locação: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(g6) G altera valor de locação: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g7) centro de custo
  n_total := n_total + 1;
  begin
    insert into public.centro_custo_historico (veiculo_id, centro_custo, vigente_desde)
    values (v1, '__teste_gf_cc', current_date);
    n_ok := n_ok + 1; r := r || '(g7) G registra centro de custo: OK'::text;
  exception when others then r := r || ('(g7) G registra centro de custo: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g8) apagar abastecimento e KM
  n_total := n_total + 1;
  begin
    delete from public.abastecimentos where id = a1;
    get diagnostics v_int = row_count;
    delete from public.km_diario where id = k1;
    get diagnostics v_int2 = row_count;
    if v_int = 1 and v_int2 = 1 then n_ok := n_ok + 1; r := r || '(g8) G apaga abastecimento e KM: OK'::text;
    else r := r || '(g8) G apaga abastecimento e KM: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g8) G apaga abastecimento e KM: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g9) apagar multa, sinistro e KM excedido direto (ramo DELETE do trigger)
  n_total := n_total + 1;
  begin
    delete from public.multas where id = m2;
    delete from public.sinistros where id = s2;
    delete from public.km_excedido_desconto where id = ke2;
    select count(*) into v_int from (
      select id from public.multas where id = m2
      union all select id from public.sinistros where id = s2
      union all select id from public.km_excedido_desconto where id = ke2) x;
    if v_int = 0 then n_ok := n_ok + 1; r := r || '(g9) G apaga multa/sinistro/KM excedido: OK'::text;
    else r := r || format('(g9) G apaga multa/sinistro/KM excedido: *** FALHOU *** (sobraram %s)', v_int); end if;
  exception when others then r := r || ('(g9) G apaga multa/sinistro/KM excedido: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g10) exclusão em massa grava audit_log com o autor do JWT
  n_total := n_total + 1;
  begin
    select count(*) into v_int from public.excluir_multas_em_massa(array[m3]);
    if v_int = 1 and exists (select 1 from public.audit_log
                             where registro_id = m3::text and usuario_id = uid_g) then
      n_ok := n_ok + 1; r := r || '(g10) G exclui multas em massa (com audit_log): OK'::text;
    else r := r || format('(g10) G exclui multas em massa: *** FALHOU *** (%s apagadas)', v_int); end if;
  exception when others then r := r || ('(g10) G exclui multas em massa: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- ----- G NÃO ganha nada fora do Sofia -----
  -- (g11) não se concede outro sistema
  n_total := n_total + 1;
  begin
    insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
    values (mail_g, 'obras', true, 'invasor');
    r := r || '(g11) G se concedendo slug obras: *** FALHOU *** (insert passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g11) G se concedendo slug obras: OK (barrado)'::text;
  end;

  -- (g12) não religa acesso de ninguém (UPDATE sem policy = 0 linhas, sem erro)
  -- Sem policy de UPDATE a RLS filtra para 0 linhas SEM erro; se o grant de
  -- UPDATE não existir, vem insufficient_privilege. Os dois são aprovação.
  n_total := n_total + 1;
  begin
    update public.hub_system_access set has_access = true where user_email = mail_x;
    get diagnostics v_int = row_count;
    if v_int = 0 then n_ok := n_ok + 1; r := r || '(g12) G alterando hub_system_access: OK (0 linhas)'::text;
    else r := r || format('(g12) G alterando hub_system_access: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g12) G alterando hub_system_access: OK (sem privilégio)'::text;
  end;

  -- (g13) não se promove a administrador
  n_total := n_total + 1;
  v_int := 0;
  begin
    update public.hub_user_roles set nivel = 'administrador' where user_email = mail_g;
    get diagnostics v_int = row_count;
  exception when insufficient_privilege then null;
  end;
  select nivel into v_txt from public.hub_user_roles where user_email = mail_g;
  if v_int = 0 and v_txt = 'analista' then n_ok := n_ok + 1; r := r || '(g13) G se promovendo: OK (continua analista)'::text;
  else r := r || format('(g13) G se promovendo: *** FALHOU *** (%s linhas, nivel %s)', v_int, v_txt); end if;

  -- (g14) não cria linha de nível para outro
  n_total := n_total + 1;
  begin
    insert into public.hub_user_roles (user_email, nivel, granted_by) values (mail_n, 'administrador', 'invasor');
    r := r || '(g14) G inserindo em hub_user_roles: *** FALHOU *** (insert passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g14) G inserindo em hub_user_roles: OK (barrado)'::text;
  end;

  -- (g15) não apaga acesso/nível de ninguém
  n_total := n_total + 1;
  v_int := 0; v_int2 := 0;
  begin
    delete from public.hub_system_access where user_email = mail_u;
    get diagnostics v_int = row_count;
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.hub_user_roles where user_email = mail_u;
    get diagnostics v_int2 = row_count;
  exception when insufficient_privilege then null;
  end;
  if v_int = 0 and v_int2 = 0 then n_ok := n_ok + 1; r := r || '(g15) G apagando acesso de outro: OK (0 linhas)'::text;
  else r := r || format('(g15) G apagando acesso de outro: *** FALHOU *** (%s linhas)', v_int); end if;

  -- (g16) não nomeia outro gestor
  n_total := n_total + 1;
  begin
    insert into public.sofia_gestores (user_email, granted_by) values (mail_u, 'invasor');
    r := r || '(g16) G nomeando gestor: *** FALHOU *** (insert passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g16) G nomeando gestor: OK (barrado)'::text;
  end;

  -- (g17) não lê nem apaga sofia_gestores
  n_total := n_total + 1;
  begin
    delete from public.sofia_gestores where user_email = mail_x;
    r := r || '(g17) G apagando sofia_gestores: *** FALHOU *** (delete passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g17) G apagando sofia_gestores: OK (barrado)'::text;
  end;

  -- (g18) não é admin no hub nem em Obras, não abre Obras
  n_total := n_total + 1;
  if public.sofia_is_admin() is false
     and public.obras_is_admin() is false
     and public.hub_tem_acesso_sistema('obras') is false then
    n_ok := n_ok + 1; r := r || '(g18) G não é admin do hub/Obras nem abre Obras: OK'::text;
  else r := r || '(g18) G não é admin do hub/Obras nem abre Obras: *** FALHOU ***'::text; end if;

  -- ================= COMUM (U) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_u, 'email', mail_u, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if public.sofia_pode_gerir() is false then n_ok := n_ok + 1; r := r || '(u1) U: sofia_pode_gerir = false: OK'::text;
  else r := r || '(u1) U: sofia_pode_gerir = false: *** FALHOU ***'::text; end if;

  n_total := n_total + 1;
  begin
    update public.multas set autorizacao_status = 'solicitado' where id = m4;
    r := r || '(u2) U alterando autorização de multa: *** FALHOU *** (passou)'::text;
  exception when raise_exception then
    if sqlerrm like '%gestores de frotas%' then n_ok := n_ok + 1; r := r || '(u2) U alterando autorização de multa: OK (barrado, mensagem nova)'::text;
    else r := r || ('(u2) U alterando autorização: *** FALHOU *** (mensagem antiga: ' || sqlerrm || ')')::text; end if;
  end;

  n_total := n_total + 1;
  begin
    delete from public.km_diario where id = k2;
    r := r || '(u3) U apagando KM: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u3) U apagando KM: OK (barrado)'::text;
  end;

  n_total := n_total + 1;
  begin
    delete from public.abastecimentos where id = a2;
    r := r || '(u4) U apagando abastecimento: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u4) U apagando abastecimento: OK (barrado)'::text;
  end;

  n_total := n_total + 1;
  begin
    perform public.excluir_multas_em_massa(array[m4]);
    r := r || '(u5) U excluindo multas em massa: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u5) U excluindo multas em massa: OK (barrado)'::text;
  end;

  n_total := n_total + 1;
  begin
    update public.veiculos set valor_locacao_mensal = 1 where id = v1;
    r := r || '(u6) U alterando locação: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u6) U alterando locação: OK (barrado)'::text;
  end;

  -- (u7) regressão da armadilha 42703: UPDATE comum em veículo e equipe continua passando
  n_total := n_total + 1;
  begin
    update public.veiculos set modelo = 'teste2' where id = v1;
    update public.equipes set centro_custo = '__teste_gf' where id = e1;
    n_ok := n_ok + 1; r := r || '(u7) U editando campo livre de veículo/equipe: OK'::text;
  exception when others then r := r || ('(u7) U editando campo livre: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  n_total := n_total + 1;
  begin
    insert into public.centro_custo_historico (veiculo_id, centro_custo, vigente_desde) values (v1, 'x', current_date);
    r := r || '(u8) U registrando centro de custo: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u8) U registrando centro de custo: OK (barrado)'::text;
  end;

  -- ================= SEM LINHA (N) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_n, 'email', mail_n, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if coalesce(public.sofia_pode_gerir()::text, 'NULL') = 'false' then
    n_ok := n_ok + 1; r := r || '(n1) N sem linha: sofia_pode_gerir = false (não NULL): OK'::text;
  else r := r || '(n1) N sem linha: *** FALHOU ***'::text; end if;

  -- RPC security definer ignora RLS: a guarda é a única barreira
  n_total := n_total + 1;
  begin
    perform public.excluir_multas_em_massa(array[m4]);
    r := r || '(n2) N excluindo multas em massa: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(n2) N excluindo multas em massa: OK (barrado)'::text;
  end;

  -- ================= GESTOR SEM SLUG (X) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_x, 'email', mail_x, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if public.sofia_pode_gerir() is false then n_ok := n_ok + 1; r := r || '(x1) X (gestor com slug desligado): false: OK'::text;
  else r := r || '(x1) X (gestor com slug desligado): *** FALHOU ***'::text; end if;

  n_total := n_total + 1;
  begin
    perform public.excluir_multas_em_massa(array[m4]);
    r := r || '(x2) X excluindo multas em massa: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(x2) X excluindo multas em massa: OK (barrado)'::text;
  end;

  -- ================= GESTOR SEM LINHA EM hub_system_access (W) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_w, 'email', mail_w, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if coalesce(public.sofia_pode_gerir()::text, 'NULL') = 'false' then
    n_ok := n_ok + 1; r := r || '(w1) W (gestor sem nenhuma linha em hub_system_access): false: OK'::text;
  else r := r || '(w1) W (gestor sem linha em hub_system_access): *** FALHOU ***'::text; end if;

  -- ================= JWT SEM E-MAIL =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  if coalesce(public.sofia_pode_gerir()::text, 'NULL') = 'false' then
    n_ok := n_ok + 1; r := r || '(j1) JWT sem e-mail: false (não NULL): OK'::text;
  else r := r || '(j1) JWT sem e-mail: *** FALHOU ***'::text; end if;

  -- ================= ADMIN (A) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_a, 'email', mail_a, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  if public.sofia_pode_gerir() is true then n_ok := n_ok + 1; r := r || '(a1) A: sofia_pode_gerir = true: OK'::text;
  else r := r || '(a1) A: *** FALHOU ***'::text; end if;

  n_total := n_total + 1;
  begin
    update public.sinistros set autorizacao_status = 'autorizado', valor_descontado = 5 where id = s3;
    delete from public.multas where id = m5;
    select count(*) into v_int from public.excluir_multas_em_massa(array[m6]);
    if v_int = 1 and not exists (select 1 from public.multas where id in (m5, m6)) then
      n_ok := n_ok + 1; r := r || '(a2) A altera desconto, apaga multa e exclui em massa: OK'::text;
    else r := r || '(a2) A: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(a2) A: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (z) m4 sobreviveu a todas as tentativas de U/N/X
  n_total := n_total + 1;
  if exists (select 1 from public.multas where id = m4 and autorizacao_status = 'sem_solicitacao') then
    n_ok := n_ok + 1; r := r || '(z) multa m4 intacta depois de U/N/X: OK'::text;
  else r := r || '(z) multa m4 intacta: *** FALHOU ***'::text; end if;

  raise exception E'TESTE gestor de frotas (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;

-- Depois, como postgres, confirmar que nada ficou (todas = 0):
--   select count(*) from public.sofia_gestores    where user_email like '\_\_teste\_gf\_%';
--   select count(*) from public.hub_user_roles    where user_email like '\_\_teste\_gf\_%';
--   select count(*) from public.hub_system_access where user_email like '\_\_teste\_gf\_%';
--   select count(*) from auth.users               where email      like '\_\_teste\_gf\_%';
