-- ============================================================
-- Hub — comunicados: TESTE DE COMPORTAMENTO DA RLS (não altera nada)
-- Rodar DEPOIS de sdd-sql-hub-comunicados.sql, como postgres (SQL Editor ou
-- Management API com o PAT), projeto iyytcavcgukfjnjjrerx.
-- ============================================================
-- COMO FUNCIONA
--   Cria usuários, acessos e comunicados de mentira DENTRO de uma transação,
--   troca para `role authenticated` com `request.jwt.claims` forjado (como o
--   PostgREST faz) e prova o que cada identidade consegue ou não.
--
--   O bloco TERMINA EM ERRO DE PROPÓSITO. O `raise exception` final é o
--   relatório e, ao mesmo tempo, a garantia de rollback: mesmo quem rodar sem
--   o begin/rollback em volta não deixa nada gravado. O SQL Editor mostra só o
--   resultado da última instrução; a mensagem de erro aparece sempre.
--
--   LEITURA DO RESULTADO: a mensagem tem uma linha por teste e termina em
--     "RESUMO: 13/13 OK"          -> passou
--     "RESUMO: ... *** FALHOU ***" -> não deployar
--
--   Fixtures (e-mails __teste_*@manfac.com.br, slug __teste_comunicados) só
--   existem dentro da transação. Nada toca linha real de produção.
-- ============================================================

begin;

do $$
declare
  uid_a   constant uuid := '00000000-0000-4000-a000-00000000000a'; -- tem o slug
  uid_b   constant uuid := '00000000-0000-4000-a000-00000000000b'; -- não tem o slug
  uid_adm constant uuid := '00000000-0000-4000-a000-0000000000ad'; -- administrador
  mail_a   constant text := '__teste_comunicado_a@manfac.com.br';
  mail_b   constant text := '__teste_comunicado_b@manfac.com.br';
  mail_adm constant text := '__teste_comunicado_adm@manfac.com.br';
  slug     constant text := '__teste_comunicados';
  c_pub    uuid := gen_random_uuid();  -- publicado há 1h
  c_fut    uuid := gen_random_uuid();  -- publicado_em no futuro
  c_rasc   uuid := gen_random_uuid();  -- publicado_em NULL (rascunho)
  c_outro  uuid := gen_random_uuid();  -- publicado, mas de outro slug
  r        text[] := '{}';
  n_ok     int := 0;
  n_total  int := 0;
  v_int    int;
  v_txt    text;
begin
  -- ---------- FIXTURES (como postgres, acima da RLS) ----------
  insert into auth.users (id, email, aud, role)
  values (uid_a,   mail_a,   'authenticated', 'authenticated'),
         (uid_b,   mail_b,   'authenticated', 'authenticated'),
         (uid_adm, mail_adm, 'authenticated', 'authenticated');

  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
  values (mail_a, slug, true,  'teste-rls'),
         (mail_b, slug, false, 'teste-rls');   -- linha com has_access=false: NÃO dá acesso

  insert into public.hub_user_roles (user_email, nivel, granted_by)
  values (mail_adm, 'administrador', 'teste-rls');

  insert into public.hub_comunicados (id, sistema, titulo, corpo, publicado_em) values
    (c_pub,   slug,                 't', 'c', now() - interval '1 hour'),
    (c_fut,   slug,                 't', 'c', now() + interval '1 day'),
    (c_rasc,  slug,                 't', 'c', null),
    (c_outro, '__teste_outro_slug', 't', 'c', now() - interval '1 hour');

  -- ---------- USUÁRIO A (tem o slug) ----------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_a, 'email', mail_a, 'role', 'authenticated')::text, true);

  -- (a) vê o publicado do seu slug, e SÓ ele (nem futuro, nem rascunho, nem outro slug)
  select string_agg(id::text, ',') into v_txt
  from public.hub_comunicados where id in (c_pub, c_fut, c_rasc, c_outro);
  n_total := n_total + 1;
  if v_txt = c_pub::text then n_ok := n_ok + 1; r := r || '(a) A com o slug vê só o publicado: OK';
  else r := r || format('(a) A com o slug vê só o publicado: *** FALHOU *** (viu %s)', coalesce(v_txt, 'nada')); end if;

  -- (c) authenticated não insere comunicado
  n_total := n_total + 1;
  begin
    insert into public.hub_comunicados (sistema, titulo, corpo, publicado_em)
    values (slug, 'invasor', 'x', now());
    r := r || '(c) A inserindo em hub_comunicados: *** FALHOU *** (insert passou)';
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(c) A inserindo em hub_comunicados: OK (' || sqlerrm || ')';
  end;

  -- (c2) nem altera nem apaga (sem privilégio)
  n_total := n_total + 1;
  begin
    update public.hub_comunicados set titulo = 'alterado' where id = c_pub;
    r := r || '(c2) A fazendo UPDATE em hub_comunicados: *** FALHOU *** (update passou)';
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(c2) A fazendo UPDATE em hub_comunicados: OK';
  end;

  -- (d) insert em lidos com user_id de OUTRO usuário falha
  n_total := n_total + 1;
  begin
    insert into public.hub_comunicados_lidos (comunicado_id, user_id) values (c_pub, uid_b);
    r := r || '(d) A marcando lido em nome de B: *** FALHOU *** (insert passou)';
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(d) A marcando lido em nome de B: OK (' || sqlerrm || ')';
  end;

  -- (e) insert em lidos para comunicado futuro (que A não lê) falha
  n_total := n_total + 1;
  begin
    insert into public.hub_comunicados_lidos (comunicado_id, user_id) values (c_fut, uid_a);
    r := r || '(e) A marcando lido um comunicado futuro: *** FALHOU *** (insert passou)';
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(e) A marcando lido um comunicado futuro: OK';
  end;

  -- (f) insert em lidos da própria linha, comunicado legível: passa
  n_total := n_total + 1;
  begin
    insert into public.hub_comunicados_lidos (comunicado_id, user_id) values (c_pub, uid_a);
    n_ok := n_ok + 1; r := r || '(f) A marcando o próprio lido: OK';
  exception when others then
    r := r || '(f) A marcando o próprio lido: *** FALHOU *** (' || sqlerrm || ')';
  end;

  -- (g) não apaga o próprio lido (sem privilégio de DELETE)
  n_total := n_total + 1;
  begin
    delete from public.hub_comunicados_lidos where user_id = uid_a;
    r := r || '(g) A apagando o próprio lido: *** FALHOU *** (delete passou)';
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g) A apagando o próprio lido: OK';
  end;

  -- ---------- USUÁRIO B (sem o slug; tem linha com has_access=false) ----------
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_b, 'email', mail_b, 'role', 'authenticated')::text, true);

  -- (b) não vê nada
  select count(*) into v_int from public.hub_comunicados
  where id in (c_pub, c_fut, c_rasc, c_outro);
  n_total := n_total + 1;
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(b) B sem o slug não vê nada: OK';
  else r := r || format('(b) B sem o slug não vê nada: *** FALHOU *** (viu %s)', v_int); end if;

  -- (h) B não enxerga o lido de A
  select count(*) into v_int from public.hub_comunicados_lidos where user_id = uid_a;
  n_total := n_total + 1;
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(h) B não enxerga o lido de A: OK';
  else r := r || format('(h) B não enxerga o lido de A: *** FALHOU *** (viu %s)', v_int); end if;

  -- (i) B não marca como lido um comunicado de slug que não tem
  n_total := n_total + 1;
  begin
    insert into public.hub_comunicados_lidos (comunicado_id, user_id) values (c_pub, uid_b);
    r := r || '(i) B marcando lido sem o slug: *** FALHOU *** (insert passou)';
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(i) B marcando lido sem o slug: OK';
  end;

  -- ---------- JWT SEM E-MAIL (não pode falhar aberto) ----------
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_a, 'role', 'authenticated')::text, true);
  select count(*) into v_int from public.hub_comunicados
  where id in (c_pub, c_fut, c_rasc, c_outro);
  n_total := n_total + 1;
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(j) JWT sem e-mail não vê nada: OK';
  else r := r || format('(j) JWT sem e-mail não vê nada: *** FALHOU *** (viu %s)', v_int); end if;

  -- ---------- ADMINISTRADOR (espelha hasSystemAccess: admin vê todo slug) ----------
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_adm, 'email', mail_adm, 'role', 'authenticated')::text, true);
  select count(*) into v_int from public.hub_comunicados
  where id in (c_pub, c_fut, c_rasc, c_outro);
  n_total := n_total + 1;
  if v_int = 2 then n_ok := n_ok + 1; r := r || '(k) admin vê os 2 publicados (ambos os slugs), nenhum futuro/rascunho: OK';
  else r := r || format('(k) admin vê os 2 publicados: *** FALHOU *** (viu %s)', v_int); end if;

  -- ---------- ANON ----------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  n_total := n_total + 1;
  begin
    select count(*) into v_int from public.hub_comunicados;
    r := r || format('(l) anon lendo hub_comunicados: *** FALHOU *** (select passou, %s linhas)', v_int);
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(l) anon lendo hub_comunicados: OK (sem privilégio)';
  end;

  -- ---------- RELATÓRIO + ROLLBACK FORÇADO ----------
  raise exception E'TESTE RLS hub_comunicados (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;
