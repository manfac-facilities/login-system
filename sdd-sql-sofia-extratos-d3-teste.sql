-- ============================================================
-- *** NÃO APLICADO / NUNCA RODOU EM PRODUÇÃO *** (escrito em 29/10/2026, branch feat/frotas-d3-encerrar-ligacao)
-- Sofia — extratos, D3 (encerrar ligação): TESTE DE RLS E COMPORTAMENTO (não altera nada)
-- Rodar DEPOIS de sdd-sql-sofia-extratos-d3.sql, como postgres (SQL Editor ou
-- Management API com o PAT), projeto iyytcavcgukfjnjjrerx.
-- O bloco TERMINA EM ERRO DE PROPÓSITO: o raise final é o relatório e a
-- garantia de rollback. Resultado esperado: "RESUMO: 10/10 OK".
-- Perfis: G gestor de frotas, U usuário comum do Sofia.
-- Se uma fixture falhar por coluna NOT NULL que não está nos arquivos,
-- é deriva de schema: ajustar a fixture, nunca o teste.
-- ============================================================

begin;

do $$
declare
  uid_g constant uuid := '00000000-0000-4000-a000-0000000000c1';
  uid_u constant uuid := '00000000-0000-4000-a000-0000000000c2';
  mail_g constant text := '__teste_d3_gestor@manfac.com.br';
  mail_u constant text := '__teste_d3_comum@manfac.com.br';
  e1 uuid := gen_random_uuid();
  e2 uuid := gen_random_uuid();
  -- TX1 antes do encerramento (15/10), TXE exatamente no dia, TX2 depois
  lote constant jsonb := '[
    {"codigo_transacao":"__D3TX1","data_uso":"2026-10-01","identificador":"__D3CARTAO1","valor":"10.00"},
    {"codigo_transacao":"__D3TXE","data_uso":"2026-10-15","identificador":"__D3CARTAO1","valor":"20.00"},
    {"codigo_transacao":"__D3TX2","data_uso":"2026-10-20","identificador":"__D3CARTAO1","valor":"30.00"}
  ]';
  r   text[] := '{}';
  n_ok int := 0;
  n_total int := 0;
  v_int int;
  v_txt text;
begin
  -- ---------- FIXTURES (postgres, acima da RLS) ----------
  insert into auth.users (id, email, aud, role) values
    (uid_g, mail_g, 'authenticated', 'authenticated'), (uid_u, mail_u, 'authenticated', 'authenticated');
  insert into public.hub_user_roles (user_email, nivel, granted_by) values
    (mail_g, 'analista', 'teste-d3'), (mail_u, 'analista', 'teste-d3');
  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by) values
    (mail_g, 'sofia', true, 'teste-d3'), (mail_u, 'sofia', true, 'teste-d3');
  insert into public.sofia_gestores (user_email, granted_by) values (mail_g, 'teste-d3');
  insert into public.equipes (id, codigo, ativo) values
    (e1, '__teste_d3_e1', true), (e2, '__teste_d3_e2', true);

  perform set_config('role', 'authenticated', true);

  -- ================= GESTOR (G) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'email', mail_g, 'role', 'authenticated')::text, true);

  -- (d0) base: cartão em e1 desde 01/08, CC por equipe, 3 gastos resolvidos
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('ticketlog', '__D3CARTAO1', e1, date '2026-08-01');
    insert into public.sofia_equipe_centro_custo (equipe_id, codigo, nome, vigente_desde) values
      (e1, '__D3CC1', 'Obra Um', date '2026-08-01'), (e2, '__D3CC2', 'Obra Dois', date '2026-08-01');
    perform public.sofia_registrar_extrato('ticketlog', 'd3.xlsx', 100, lote);
    select string_agg(codigo_transacao || '=' || coalesce(centro_custo_codigo, motivo_sem_centro_custo), ',' order by codigo_transacao)
      into v_txt from public.sofia_extrato_consumo where codigo_transacao like '\_\_D3TX%';
    if v_txt = '__D3TX1=__D3CC1,__D3TX2=__D3CC1,__D3TXE=__D3CC1' then
      n_ok := n_ok + 1; r := r || '(d0) base: os 3 gastos resolvem em CC1: OK'::text;
    else r := r || ('(d0) base: *** FALHOU *** ' || coalesce(v_txt, '(nada)'))::text; end if;
  exception when others then r := r || ('(d0) base: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (d1) G encerra a ligação em 15/10: linha nova com equipe nula, carimbada com a sessão
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('ticketlog', '__D3CARTAO1', null, date '2026-10-15');
    select count(*) into v_int from public.sofia_extrato_ligacoes
    where identificador = '__D3CARTAO1' and equipe_id is null and criado_por = mail_g;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(d1) G encerra a ligação (equipe nula, carimbo = sessão): OK'::text;
    else r := r || format('(d1) encerrar: *** FALHOU *** (%s linhas)', v_int); end if;
  exception when others then r := r || ('(d1) encerrar: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (d2) gasto com data >= encerramento sai sem_equipe (no dia e depois)
  n_total := n_total + 1;
  select string_agg(codigo_transacao || '=' || coalesce(motivo_sem_centro_custo, 'resolvido'), ',' order by codigo_transacao)
    into v_txt from public.sofia_extrato_consumo where codigo_transacao in ('__D3TXE', '__D3TX2');
  if v_txt = '__D3TX2=sem_equipe,__D3TXE=sem_equipe' then
    n_ok := n_ok + 1; r := r || '(d2) gasto de 15/10 e 20/10: sem_equipe: OK'::text;
  else r := r || ('(d2) pós-encerramento: *** FALHOU *** ' || coalesce(v_txt, '(nada)'))::text; end if;

  -- (d3) gasto anterior ao encerramento continua na equipe antiga
  n_total := n_total + 1;
  select centro_custo_codigo || '/' || equipe_codigo into v_txt
  from public.sofia_extrato_consumo where codigo_transacao = '__D3TX1';
  if v_txt = '__D3CC1/__teste_d3_e1' then
    n_ok := n_ok + 1; r := r || '(d3) gasto de 01/10 segue em e1/CC1: OK'::text;
  else r := r || ('(d3) passado: *** FALHOU *** ' || coalesce(v_txt, 'NULL'))::text; end if;

  -- (d4) religar depois (cadastro normal, e2 desde 18/10): 20/10 volta a resolver, 15/10 segue sem_equipe
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('ticketlog', '__D3CARTAO1', e2, date '2026-10-18');
    select string_agg(codigo_transacao || '=' || coalesce(centro_custo_codigo, motivo_sem_centro_custo), ',' order by codigo_transacao)
      into v_txt from public.sofia_extrato_consumo where codigo_transacao like '\_\_D3TX%';
    if v_txt = '__D3TX1=__D3CC1,__D3TX2=__D3CC2,__D3TXE=sem_equipe' then
      n_ok := n_ok + 1; r := r || '(d4) religar: 20/10 em CC2, 15/10 sem_equipe, 01/10 em CC1: OK'::text;
    else r := r || ('(d4) religar: *** FALHOU *** ' || coalesce(v_txt, '(nada)'))::text; end if;
  exception when others then r := r || ('(d4) religar: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (d5) carimbo forjado no encerramento: barrado pela policy
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde, criado_por)
    values ('ticketlog', '__D3CARTAO1', null, date '2026-10-30', 'outra.pessoa@manfac.com.br');
    r := r || '(d5) G forja criado_por ao encerrar: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(d5) G forja criado_por ao encerrar: OK (barrado)'::text;
  end;

  -- (d6) a linha de encerramento não se edita nem se apaga (tabela só-inserção)
  n_total := n_total + 1;
  v_int := 0;
  begin update public.sofia_extrato_ligacoes set equipe_id = e1 where equipe_id is null and identificador = '__D3CARTAO1';
  exception when insufficient_privilege then v_int := v_int + 1; end;
  begin delete from public.sofia_extrato_ligacoes where equipe_id is null and identificador = '__D3CARTAO1';
  exception when insufficient_privilege then v_int := v_int + 1; end;
  if v_int = 2 then n_ok := n_ok + 1; r := r || '(d6) G edita/apaga o encerramento: OK (2 barrados)'::text;
  else r := r || format('(d6) editar/apagar: *** FALHOU *** (%s/2 barrados)', v_int); end if;

  -- (d7) encerrar um cartão não afeta a tag Veloe de mesmo número
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('veloe', '__D3CARTAO1', e1, date '2026-08-01');
    perform public.sofia_registrar_extrato('veloe', 'd3.csv', 10,
      '[{"codigo_transacao":"__D3TXV","data_uso":"2026-10-16","identificador":"__D3CARTAO1","valor":"5"}]');
    select centro_custo_codigo into v_txt from public.sofia_extrato_consumo where codigo_transacao = '__D3TXV';
    if v_txt = '__D3CC1' then n_ok := n_ok + 1; r := r || '(d7) encerrar ticketlog não mexe na tag Veloe de mesmo número: OK'::text;
    else r := r || ('(d7) plataforma: *** FALHOU *** ' || coalesce(v_txt, 'NULL'))::text; end if;
  exception when others then r := r || ('(d7) plataforma: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- ================= USUÁRIO COMUM (U) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_u, 'email', mail_u, 'role', 'authenticated')::text, true);

  -- (u1) não-gestor não consegue encerrar (nem com o próprio carimbo)
  n_total := n_total + 1;
  begin
    insert into public.sofia_extrato_ligacoes (plataforma, identificador, equipe_id, vigente_desde)
    values ('veloe', '__D3CARTAO1', null, date '2026-10-30');
    r := r || '(u1) U encerra ligação: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(u1) U encerra ligação: OK (barrado)'::text;
  end;

  -- (u2) U continua lendo (vê o gasto sem_equipe)
  n_total := n_total + 1;
  select count(*) into v_int from public.sofia_extrato_consumo
  where codigo_transacao = '__D3TXE' and motivo_sem_centro_custo = 'sem_equipe';
  if v_int = 1 then n_ok := n_ok + 1; r := r || '(u2) U lê o gasto encerrado como sem_equipe: OK'::text;
  else r := r || format('(u2) leitura do U: *** FALHOU *** (%s)', v_int); end if;

  perform set_config('role', 'postgres', true);

  raise exception E'TESTE extratos D3 (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;

-- Depois, como postgres, confirmar que nada ficou (todas = 0):
--   select count(*) from public.sofia_extrato_linhas   where codigo_transacao like '\_\_D3TX%';
--   select count(*) from public.sofia_extrato_ligacoes where identificador like '\_\_D3%';
--   select count(*) from public.equipes                where codigo like '\_\_teste\_d3\_%';
--   select count(*) from auth.users                    where email like '\_\_teste\_d3\_%';
