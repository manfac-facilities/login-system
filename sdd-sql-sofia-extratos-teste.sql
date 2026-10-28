-- ============================================================
-- *** NÃO APLICADO / NUNCA RODOU EM PRODUÇÃO *** (escrito em 28/10/2026, branch feat/frotas-extratos-backend)
-- Sofia — extratos Ticketlog/Veloe: TESTE DE RLS E COMPORTAMENTO (não altera nada)
-- Rodar DEPOIS de sdd-sql-sofia-extratos.sql, como postgres (SQL Editor ou
-- Management API com o PAT), projeto iyytcavcgukfjnjjrerx.
-- O bloco TERMINA EM ERRO DE PROPÓSITO: o raise final é o relatório e a
-- garantia de rollback. Resultado esperado: "RESUMO: 42/42 OK".
-- Perfis: G gestor de frotas, A admin do hub, U usuário comum do Sofia,
-- F papel financeiro, D papel diretor, R financeiro REVOGADO, N ninguém,
-- J JWT sem e-mail, anon.
-- Se uma fixture falhar por coluna NOT NULL que não está nos arquivos,
-- é deriva de schema: ajustar a fixture, nunca o teste.
-- ============================================================

begin;

do $$
declare
  uid_g constant uuid := '00000000-0000-4000-a000-0000000000b1';
  uid_a constant uuid := '00000000-0000-4000-a000-0000000000b2';
  uid_u constant uuid := '00000000-0000-4000-a000-0000000000b3';
  uid_f constant uuid := '00000000-0000-4000-a000-0000000000b4';
  uid_d constant uuid := '00000000-0000-4000-a000-0000000000b5';
  uid_r constant uuid := '00000000-0000-4000-a000-0000000000b6';
  uid_n constant uuid := '00000000-0000-4000-a000-0000000000b7';
  mail_g constant text := '__teste_ext_gestor@manfac.com.br';
  mail_a constant text := '__teste_ext_admin@manfac.com.br';
  mail_u constant text := '__teste_ext_comum@manfac.com.br';
  mail_f constant text := '__teste_ext_financeiro@manfac.com.br';
  mail_d constant text := '__teste_ext_diretor@manfac.com.br';
  mail_r constant text := '__teste_ext_revogado@manfac.com.br';
  mail_n constant text := '__teste_ext_ninguem@manfac.com.br';
  e1 uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
  -- 4 transações Ticketlog: t1/t2 resolvem (CC1/CC2 por data), t3 cartão sem
  -- ligação, t4 data de uso anterior à vigência da ligação
  lote1 constant jsonb := '[
    {"codigo_transacao":"__TX1","data_uso":"2026-10-01","hora_uso":"05:17:44","identificador":"__CARTAO1","valor":"69.99","servico":"Abastecimento","litros":"13.23","valor_litro":"5.29","hodometro":"39115"},
    {"codigo_transacao":"__TX2","data_uso":"2026-10-20","hora_uso":"08:00:00","identificador":"__CARTAO1","valor":"140.00","servico":"Abastecimento"},
    {"codigo_transacao":"__TX3","data_uso":"2026-10-02","identificador":"__CARTAO9","valor":"70"},
    {"codigo_transacao":"__TX4","data_uso":"2026-07-01","identificador":"__CARTAO1","valor":"10.50"}
  ]';
  -- mesmo lote com o valor de __TX1 adulterado: não pode sobrescrever
  lote1b constant jsonb := '[
    {"codigo_transacao":"__TX1","data_uso":"2026-10-01","identificador":"__CARTAO1","valor":"999.99"},
    {"codigo_transacao":"__TX2","data_uso":"2026-10-20","identificador":"__CARTAO1","valor":"140.00"},
    {"codigo_transacao":"__TX3","data_uso":"2026-10-02","identificador":"__CARTAO9","valor":"70"},
    {"codigo_transacao":"__TX4","data_uso":"2026-07-01","identificador":"__CARTAO1","valor":"10.50"}
  ]';
  r   text[] := '{}';
  n_ok int := 0;
  n_total int := 0;
  v_j   jsonb;
  v_int int;
  v_txt text;
  v_num numeric;
  v_envios int;

begin
  -- ---------- FIXTURES (postgres, acima da RLS) ----------
  insert into auth.users (id, email, aud, role) values
    (uid_g, mail_g, 'authenticated', 'authenticated'), (uid_a, mail_a, 'authenticated', 'authenticated'),
    (uid_u, mail_u, 'authenticated', 'authenticated'), (uid_f, mail_f, 'authenticated', 'authenticated'),
    (uid_d, mail_d, 'authenticated', 'authenticated'), (uid_r, mail_r, 'authenticated', 'authenticated'),
    (uid_n, mail_n, 'authenticated', 'authenticated');

  insert into public.hub_user_roles (user_email, nivel, granted_by) values
    (mail_g, 'analista', 'teste-ext'), (mail_a, 'administrador', 'teste-ext'),
    (mail_u, 'analista', 'teste-ext'), (mail_f, 'analista', 'teste-ext'),
    (mail_d, 'analista', 'teste-ext'), (mail_r, 'analista', 'teste-ext');

  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by) values
    (mail_g, 'sofia', true, 'teste-ext'),
    (mail_u, 'sofia', true, 'teste-ext');

  insert into public.sofia_gestores (user_email, granted_by) values (mail_g, 'teste-ext');

  insert into public.fin_papeis (user_email, papel) values
    (mail_f, 'financeiro'), (mail_d, 'diretor'), (mail_r, 'financeiro');
  update public.fin_papeis set ativo = false where user_email = mail_r;

  insert into public.equipes (id, codigo, ativo) values
    (e1, '__teste_ext_e1', true), (e2, '__teste_ext_e2', true);

  perform set_config('role', 'authenticated', true);

  -- ================= GESTOR (G) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'email', mail_g, 'role', 'authenticated')::text, true);

  -- (g1) ligação cartão -> equipe e duas vigências de centro de custo
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('ticketlog', '__CARTAO1', e1, date '2026-08-01');
    insert into public.sofia_equipe_centro_custo (equipe_id, codigo, nome, vigente_desde) values
      (e1, '__CC1', 'Obra Um', date '2026-08-01'),
      (e1, '__CC2', 'Obra Dois', date '2026-10-15');
    select count(*) into v_int from public.sofia_extrato_ligacoes where identificador = '__CARTAO1' and criado_por = mail_g;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g1) G cadastra ligação e 2 vigências de CC (carimbo = sessão): OK'::text;
    else r := r || '(g1) G cadastra ligação: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g1) G cadastra ligação: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g2) primeiro envio: 4 novas, 0 existentes, 2 sem centro de custo (TX3, TX4)
  n_total := n_total + 1;
  begin
    v_j := public.sofia_registrar_extrato('ticketlog', 'RFCV_teste.xlsx', 1234.56, lote1);
    if (v_j->>'novas')::int = 4 and (v_j->>'existentes')::int = 0 and (v_j->>'sem_centro_custo')::int = 2
       and v_j->>'periodo_inicio' = '2026-07-01' and v_j->>'periodo_fim' = '2026-10-20' then
      n_ok := n_ok + 1; r := r || '(g2) 1º envio: 4 novas, 0 existentes, 2 sem CC, período 01/07–20/10: OK'::text;
    else r := r || ('(g2) 1º envio: *** FALHOU *** ' || v_j::text)::text; end if;
  exception when others then r := r || ('(g2) 1º envio: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g3) resolução por data: TX1 -> CC1, TX2 -> CC2 (vigência de 15/10)
  n_total := n_total + 1;
  select string_agg(codigo_transacao || '=' || coalesce(centro_custo_codigo, motivo_sem_centro_custo), ',' order by codigo_transacao)
    into v_txt from public.sofia_extrato_consumo where codigo_transacao like '\_\_TX%';
  if v_txt = '__TX1=__CC1,__TX2=__CC2,__TX3=sem_equipe,__TX4=sem_equipe' then
    n_ok := n_ok + 1; r := r || '(g3) resolução na data de uso (CC1/CC2, sem_equipe x2): OK'::text;
  else r := r || ('(g3) resolução: *** FALHOU *** ' || coalesce(v_txt, '(nada)'))::text; end if;

  -- (g4) reenvio com valor adulterado: 0 novas, 4 existentes
  n_total := n_total + 1;
  begin
    v_j := public.sofia_registrar_extrato('ticketlog', 'RFCV_teste_de_novo.xlsx', 1200, lote1b);
    if (v_j->>'novas')::int = 0 and (v_j->>'existentes')::int = 4 then
      n_ok := n_ok + 1; r := r || '(g4) reenvio: 0 novas, 4 existentes: OK'::text;
    else r := r || ('(g4) reenvio: *** FALHOU *** ' || v_j::text)::text; end if;
  exception when others then r := r || ('(g4) reenvio: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g5) nunca sobrescreve: TX1 continua 69.99 e no envio original
  n_total := n_total + 1;
  select valor into v_num from public.sofia_extrato_linhas where plataforma = 'ticketlog' and codigo_transacao = '__TX1';
  select count(*) into v_int from public.sofia_extrato_linhas where codigo_transacao like '\_\_TX%';
  if v_num = 69.99 and v_int = 4 then n_ok := n_ok + 1; r := r || '(g5) TX1 continua 69.99, 4 linhas (sem duplicar): OK'::text;
  else r := r || format('(g5) sobrescrita/duplicação: *** FALHOU *** (valor %s, %s linhas)', v_num, v_int); end if;

  -- (g6) dois envios e dois saldos gravados, carimbados com o gestor
  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_envios where enviado_por = mail_g;
  select count(*) into v_envios from public.sofia_extrato_saldos where informado_por = mail_g;
  if v_int = 2 and v_envios = 2 then n_ok := n_ok + 1; r := r || '(g6) 2 envios e 2 saldos carimbados: OK'::text;
  else r := r || format('(g6) envios/saldos: *** FALHOU *** (%s/%s)', v_int, v_envios); end if;

  -- (g7) mover o cartão para e2 (sem CC) a partir de 18/10 NÃO muda o passado:
  --      TX1 (01/10) segue CC1; TX2 (20/10) vira sem_centro_custo
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('ticketlog', '__CARTAO1', e2, date '2026-10-18');
    select string_agg(codigo_transacao || '=' || coalesce(centro_custo_codigo, motivo_sem_centro_custo), ',' order by codigo_transacao)
      into v_txt from public.sofia_extrato_consumo where codigo_transacao in ('__TX1', '__TX2');
    if v_txt = '__TX1=__CC1,__TX2=sem_centro_custo' then
      n_ok := n_ok + 1; r := r || '(g7) troca de equipe vale só da vigência em diante (motivo sem_centro_custo): OK'::text;
    else r := r || ('(g7) troca de equipe: *** FALHOU *** ' || coalesce(v_txt, '(nada)'))::text; end if;
  exception when others then r := r || ('(g7) troca de equipe: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g8) correção = linha nova na MESMA data: a registrada por último vale
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('ticketlog', '__CARTAO1', e1, date '2026-10-18');
    select centro_custo_codigo into v_txt from public.sofia_extrato_consumo where codigo_transacao = '__TX2';
    if v_txt = '__CC2' then n_ok := n_ok + 1; r := r || '(g8) correção na mesma data: última registrada vale: OK'::text;
    else r := r || ('(g8) correção: *** FALHOU *** ' || coalesce(v_txt, 'NULL'))::text; end if;
  exception when others then r := r || ('(g8) correção: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g9) cadastrar a ligação do cartão "sem centro de custo" resolve o passado (E2)
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('ticketlog', '__CARTAO9', e1, date '2026-08-01');
    select centro_custo_codigo into v_txt from public.sofia_extrato_consumo where codigo_transacao = '__TX3';
    if v_txt = '__CC1' then n_ok := n_ok + 1; r := r || '(g9) ligação nova resolve gasto antigo (E2): OK'::text;
    else r := r || ('(g9) E2: *** FALHOU *** ' || coalesce(v_txt, 'NULL'))::text; end if;
  exception when others then r := r || ('(g9) E2: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g10) UPDATE de linha: barrado
  n_total := n_total + 1;
  begin
    update public.sofia_extrato_linhas set valor = 1 where codigo_transacao = '__TX1';
    r := r || '(g10) G altera linha de extrato: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(g10) G altera linha de extrato: OK (barrado)'::text;
  end;

  -- (g11) DELETE de ligação, de CC e de saldo: barrado
  n_total := n_total + 1;
  v_int := 0;
  begin delete from public.sofia_extrato_ligacoes where identificador = '__CARTAO1';
  exception when insufficient_privilege then v_int := v_int + 1; end;
  begin delete from public.sofia_equipe_centro_custo where equipe_id = e1;
  exception when insufficient_privilege then v_int := v_int + 1; end;
  begin delete from public.sofia_extrato_saldos where informado_por = mail_g;
  exception when insufficient_privilege then v_int := v_int + 1; end;
  if v_int = 3 then n_ok := n_ok + 1; r := r || '(g11) G apaga ligação/CC/saldo: OK (3 barrados)'::text;
  else r := r || format('(g11) G apaga: *** FALHOU *** (%s/3 barrados)', v_int); end if;

  -- (g12) carimbo forjado: barrado pela policy
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde, criado_por)
    values ('veloe', '__TAG_FORJADA', e1, current_date, 'outra.pessoa@manfac.com.br');
    r := r || '(g12) G forja criado_por: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(g12) G forja criado_por: OK (barrado)'::text;
  end;

  -- (g13–g16) validações do RPC: SOF01 e NADA gravado
  select count(*) into v_envios from public.sofia_extrato_envios;

  n_total := n_total + 1;
  begin
    perform public.sofia_registrar_extrato('ticketlog', 'x.xlsx', 1,
      '[{"codigo_transacao":"__TX9","data_uso":"2026-10-01","identificador":"__CARTAO1","valor":"1.005"}]');
    r := r || '(g13) valor com 3 casas: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g13) valor com 3 casas: OK (SOF01)'::text;
  end;

  n_total := n_total + 1;
  begin
    perform public.sofia_registrar_extrato('ticketlog', 'x.xlsx', 1,
      '[{"codigo_transacao":"__TX9","data_uso":"2026-10-01","identificador":"__CARTAO1","valor":"1"},
        {"codigo_transacao":"__TX9","data_uso":"2026-10-02","identificador":"__CARTAO1","valor":"2"}]');
    r := r || '(g14) código repetido no arquivo: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g14) código repetido no arquivo: OK (SOF01)'::text;
  end;

  n_total := n_total + 1;
  begin
    perform public.sofia_registrar_extrato('ticketlog', 'x.xlsx', -1,
      '[{"codigo_transacao":"__TX9","data_uso":"2026-10-01","identificador":"__CARTAO1","valor":"1"}]');
    r := r || '(g15) saldo negativo: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g15) saldo negativo: OK (SOF01)'::text;
  end;

  n_total := n_total + 1;
  begin
    perform public.sofia_registrar_extrato('ticketlog', 'x.xlsx', 1,
      '[{"codigo_transacao":"__TX9","data_uso":"2026-10-01","identificador":"__CARTAO1","valor":"-5"}]');
    r := r || '(g16) valor negativo: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g16) valor negativo: OK (SOF01)'::text;
  end;

  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_envios;
  if v_int = v_envios and not exists (select 1 from public.sofia_extrato_linhas where codigo_transacao = '__TX9') then
    n_ok := n_ok + 1; r := r || '(g17) envios recusados não gravaram nada: OK'::text;
  else r := r || '(g17) envios recusados gravaram algo: *** FALHOU ***'::text; end if;

  -- (g18) mesmo código em outra plataforma é outra transação
  n_total := n_total + 1;
  begin
    v_j := public.sofia_registrar_extrato('veloe', 'Extrato_veloe.csv', 50,
      '[{"codigo_transacao":"__TX1","data_uso":"2026-10-01","hora_uso":"13:38:19","identificador":"__TAG1","placa":"ABC1D23","valor":"22","servico":"REENVIO DENTRO SLA","tipo_movimento":"Debito"}]');
    if (v_j->>'novas')::int = 1 and (v_j->>'sem_centro_custo')::int = 1 then
      n_ok := n_ok + 1; r := r || '(g18) Veloe com o mesmo código da Ticketlog: nova, sem CC: OK'::text;
    else r := r || ('(g18) Veloe: *** FALHOU *** ' || v_j::text)::text; end if;
  exception when others then r := r || ('(g18) Veloe: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g19) G lê as views do financeiro
  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_consumo_financeiro where codigo_transacao like '\_\_TX%';
  select count(*) into v_envios from public.sofia_extrato_saldos_financeiro where informado_por = mail_g;
  if v_int = 5 and v_envios = 3 then n_ok := n_ok + 1; r := r || '(g19) G lê consumo (5) e saldos (3) do financeiro: OK'::text;
  else r := r || format('(g19) G views financeiro: *** FALHOU *** (%s/%s)', v_int, v_envios); end if;

  -- ================= USUÁRIO COMUM DO SOFIA (U) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_u, 'email', mail_u, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_consumo where codigo_transacao like '\_\_TX%';
  if v_int = 5 then n_ok := n_ok + 1; r := r || '(u1) U lê os extratos no Sofia (5): OK'::text;
  else r := r || format('(u1) U lê extratos: *** FALHOU *** (%s)', v_int); end if;

  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_consumo_financeiro;
  select count(*) into v_envios from public.sofia_extrato_saldos_financeiro;
  if v_int = 0 and v_envios = 0 then n_ok := n_ok + 1; r := r || '(u2) U NÃO lê as views do financeiro: OK (0/0)'::text;
  else r := r || format('(u2) U views financeiro: *** FALHOU *** (%s/%s)', v_int, v_envios); end if;

  n_total := n_total + 1;
  begin
    perform public.sofia_registrar_extrato('ticketlog', 'x.xlsx', 1,
      '[{"codigo_transacao":"__TXU","data_uso":"2026-10-01","identificador":"__CARTAO1","valor":"1"}]');
    r := r || '(u3) U envia extrato: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u3) U envia extrato: OK (barrado)'::text;
  end;

  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('veloe', '__TAG_U', e1, current_date);
    r := r || '(u4) U cadastra ligação: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(u4) U cadastra ligação: OK (barrado)'::text;
  end;

  n_total := n_total + 1;
  begin
    insert into public.sofia_equipe_centro_custo (equipe_id, codigo, nome, vigente_desde)
    values (e1, '__CCU', 'X', current_date);
    r := r || '(u5) U cadastra centro de custo: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(u5) U cadastra centro de custo: OK (barrado)'::text;
  end;

  -- U tenta gravar linha direto, contornando o RPC
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_linhas (plataforma, codigo_transacao, data_uso, identificador, valor, envio_id)
    select 'ticketlog', '__TXU2', current_date, '__CARTAO1', 1, id from public.sofia_extrato_envios limit 1;
    r := r || '(u6) U grava linha direto: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(u6) U grava linha direto: OK (barrado)'::text;
  end;

  -- ================= FINANCEIRO (F) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_f, 'email', mail_f, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_consumo_financeiro where codigo_transacao like '\_\_TX%';
  select count(*) into v_envios from public.sofia_extrato_saldos_financeiro where informado_por = mail_g;
  if v_int = 5 and v_envios = 3 then n_ok := n_ok + 1; r := r || '(f1) F lê consumo (5) e saldos (3): OK'::text;
  else r := r || format('(f1) F views: *** FALHOU *** (%s/%s)', v_int, v_envios); end if;

  n_total := n_total + 1;
  select string_agg(codigo_transacao || '=' || coalesce(centro_custo_codigo, '(vazio)') || '/' || valor::text, ',' order by codigo_transacao)
    into v_txt from public.sofia_extrato_consumo_financeiro where plataforma = 'ticketlog' and codigo_transacao like '\_\_TX%';
  if v_txt = '__TX1=__CC1/69.99,__TX2=__CC2/140.00,__TX3=__CC1/70.00,__TX4=(vazio)/10.50' then
    n_ok := n_ok + 1; r := r || '(f2) F vê centro de custo resolvido e valores exatos: OK'::text;
  else r := r || ('(f2) F conteúdo: *** FALHOU *** ' || coalesce(v_txt, '(nada)'))::text; end if;

  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_linhas;
  select count(*) into v_envios from public.sofia_extrato_consumo;
  if v_int = 0 and v_envios = 0 then n_ok := n_ok + 1; r := r || '(f3) F não lê as tabelas do Sofia direto (0/0): OK'::text;
  else r := r || format('(f3) F tabelas do Sofia: *** FALHOU *** (%s/%s)', v_int, v_envios); end if;

  n_total := n_total + 1;
  begin
    perform public.sofia_registrar_extrato('ticketlog', 'x.xlsx', 1,
      '[{"codigo_transacao":"__TXF","data_uso":"2026-10-01","identificador":"__CARTAO1","valor":"1"}]');
    r := r || '(f4) F envia extrato: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(f4) F envia extrato: OK (barrado)'::text;
  end;

  n_total := n_total + 1;
  begin
    insert into public.sofia_equipe_centro_custo (equipe_id, codigo, nome, vigente_desde)
    values (e1, '__CCF', 'X', current_date);
    r := r || '(f5) F cadastra centro de custo: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(f5) F cadastra centro de custo: OK (barrado)'::text;
  end;

  -- ================= DIRETOR (D) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_d, 'email', mail_d, 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_consumo_financeiro where codigo_transacao like '\_\_TX%';
  if v_int = 5 then n_ok := n_ok + 1; r := r || '(d1) D (diretor) lê consumo: OK'::text;
  else r := r || format('(d1) D: *** FALHOU *** (%s)', v_int); end if;

  -- ================= FINANCEIRO REVOGADO (R) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_r, 'email', mail_r, 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_consumo_financeiro;
  if v_int = 0 and coalesce(public.sofia_extrato_pode_ler()::text, 'NULL') = 'false' then
    n_ok := n_ok + 1; r := r || '(r1) R (papel revogado): pode_ler false, 0 linhas: OK'::text;
  else r := r || format('(r1) R: *** FALHOU *** (%s)', v_int); end if;

  -- (r2) e-mail em maiúscula/espaço no JWT de quem tem papel: casa (lower/btrim)
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_f, 'email', '  ' || upper(mail_f) || ' ', 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  if public.sofia_extrato_pode_ler() is true then n_ok := n_ok + 1; r := r || '(r2) F com e-mail em maiúscula/espaço: true: OK'::text;
  else r := r || '(r2) F com e-mail em maiúscula/espaço: *** FALHOU ***'::text; end if;

  -- ================= NINGUÉM (N) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_n, 'email', mail_n, 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_consumo_financeiro;
  select count(*) into v_envios from public.sofia_extrato_consumo;
  if v_int = 0 and v_envios = 0 and public.sofia_extrato_pode_ler() is false then
    n_ok := n_ok + 1; r := r || '(n1) N: nada visível, pode_ler false: OK'::text;
  else r := r || format('(n1) N: *** FALHOU *** (%s/%s)', v_int, v_envios); end if;

  n_total := n_total + 1;
  begin
    perform public.sofia_registrar_extrato('veloe', 'x.csv', 1,
      '[{"codigo_transacao":"__TXN","data_uso":"2026-10-01","identificador":"__TAG1","valor":"1"}]');
    r := r || '(n2) N envia extrato: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(n2) N envia extrato: OK (barrado)'::text;
  end;

  -- ================= JWT SEM E-MAIL (J) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'role', 'authenticated')::text, true);
  n_total := n_total + 1;
  if coalesce(public.sofia_extrato_pode_ler()::text, 'NULL') = 'false' then
    n_ok := n_ok + 1; r := r || '(j1) JWT sem e-mail: pode_ler false (não NULL): OK'::text;
  else r := r || '(j1) JWT sem e-mail: *** FALHOU ***'::text; end if;

  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_consumo_financeiro;
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(j2) JWT sem e-mail: 0 linhas no financeiro: OK'::text;
  else r := r || format('(j2) JWT sem e-mail: *** FALHOU *** (%s)', v_int); end if;

  n_total := n_total + 1;
  begin
    perform public.sofia_registrar_extrato('veloe', 'x.csv', 1,
      '[{"codigo_transacao":"__TXJ","data_uso":"2026-10-01","identificador":"__TAG1","valor":"1"}]');
    r := r || '(j3) JWT sem e-mail envia extrato: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(j3) JWT sem e-mail envia extrato: OK (barrado)'::text;
  end;

  -- ================= ADMIN (A) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_a, 'email', mail_a, 'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  begin
    v_j := public.sofia_registrar_extrato('veloe', 'Extrato_veloe_2.csv', 40,
      '[{"codigo_transacao":"__TX1","data_uso":"2026-10-01","identificador":"__TAG1","valor":"22"},
        {"codigo_transacao":"__TXA","data_uso":"2026-10-03","identificador":"__TAG1","valor":"4.00"}]');
    if (v_j->>'novas')::int = 1 and (v_j->>'existentes')::int = 1 then
      n_ok := n_ok + 1; r := r || '(a1) A envia Veloe: 1 nova, 1 existente: OK'::text;
    else r := r || ('(a1) A envia: *** FALHOU *** ' || v_j::text)::text; end if;
  exception when others then r := r || ('(a1) A envia: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('veloe', '__TAG1', e1, date '2026-08-01');
    select count(*) into v_int from public.sofia_extrato_consumo_financeiro
    where plataforma = 'veloe' and centro_custo_codigo = '__CC1';
    if v_int = 2 then n_ok := n_ok + 1; r := r || '(a2) A liga a tag e o financeiro vê as 2 linhas Veloe resolvidas: OK'::text;
    else r := r || format('(a2) A tag: *** FALHOU *** (%s)', v_int); end if;
  exception when others then r := r || ('(a2) A tag: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- ================= ANON =================
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  n_total := n_total + 1;
  v_int := 0;
  begin perform 1 from public.sofia_extrato_consumo_financeiro limit 1;
  exception when insufficient_privilege then v_int := v_int + 1; end;
  begin perform 1 from public.sofia_extrato_saldos_financeiro limit 1;
  exception when insufficient_privilege then v_int := v_int + 1; end;
  begin perform 1 from public.sofia_extrato_linhas limit 1;
  exception when insufficient_privilege then v_int := v_int + 1; end;
  begin perform public.sofia_registrar_extrato('veloe', 'x.csv', 1, '[]');
  exception when insufficient_privilege then v_int := v_int + 1; end;
  if v_int = 4 then n_ok := n_ok + 1; r := r || '(an1) anon sem acesso a views, tabela e RPC: OK (4 barrados)'::text;
  else r := r || format('(an1) anon: *** FALHOU *** (%s/4 barrados)', v_int); end if;

  perform set_config('role', 'postgres', true);

  -- (z) nada além do esperado foi gravado nas tabelas
  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_linhas where codigo_transacao like '\_\_TX%';
  if v_int = 6 then n_ok := n_ok + 1; r := r || '(z) 6 linhas de teste no total (4 Ticketlog + 2 Veloe): OK'::text;
  else r := r || format('(z) total de linhas: *** FALHOU *** (%s)', v_int); end if;

  raise exception E'TESTE extratos (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;

-- Depois, como postgres, confirmar que nada ficou (todas = 0):
--   select count(*) from public.sofia_extrato_linhas   where codigo_transacao like '\_\_TX%';
--   select count(*) from public.sofia_extrato_ligacoes where identificador like '\_\_%';
--   select count(*) from public.equipes                where codigo like '\_\_teste\_ext\_%';
--   select count(*) from public.fin_papeis             where user_email like '\_\_teste\_ext\_%';
--   select count(*) from auth.users                    where email like '\_\_teste\_ext\_%';
