-- ============================================================
-- Teste de comportamento de sdd-sql-obras-leva5.sql
-- Rodar DEPOIS de aplicar a migration (e as Levas 2–4), no SQL Editor,
-- projeto iyytcavcgukfjnjjrerx.
-- Rodar o arquivo INTEIRO de uma vez. NÃO GRAVA NADA: tudo roda numa
-- transação e o bloco final termina em erro de propósito (desfaz tudo).
-- A mensagem de erro final é o relatório:
--   "RESUMO: N/N OK"               -> tudo certo
--   "RESUMO: x/N OK — FALHOU: ..." -> parar e não deployar
-- Sem a linha "RESUMO" = algo quebrou antes (erro diferente do esperado).
--
-- Cada teste de erro esperado roda num bloco
--   do $$ begin ...; raise exception 'NAO_FALHOU';
--   exception when others then ... end $$;
-- e cada teste que tem de PASSAR termina com raise exception 'ok:...'
-- (desfaz o que ele fez, inclusive a troca de role). Booleanos como t/f
-- (pg_temp.tf).
-- Dois modos:
--   * como postgres (acima da RLS) com o JWT simulado por
--     set_config('request.jwt.claims'): testa os TRIGGERS e os checks;
--   * com pg_temp.como(role, email): troca a role da transação para
--     authenticated / anon / service_role com o JWT daquele e-mail — testa a
--     RLS, os GRANTs e as policies de storage DE VERDADE. A troca vale só
--     dentro do bloco (o erro final do bloco a desfaz).
--
-- Fixture (só dentro da transação):
--   obra A TESTE-VERIF-LEVA5-A (OBRA, engenheiro eng.teste@teste.invalid);
--   obra B TESTE-VERIF-LEVA5-B (OBRA, sem engenheiro);
--   hub_system_access slug obras para eng.teste@teste.invalid e
--   usuario.obras@teste.invalid (acesso ao Obras, não admin, não engenheiro);
--   sem.acesso@teste.invalid não tem linha nenhuma;
--   acesso do portal: cliente@exemplo.invalid na obra A (ativo), criado pelo admin;
--   documento D1 da obra A (criado pelo engenheiro);
--   objeto de storage obras-docs/<A>/<uuid>-fixture.pdf (como postgres);
--   mensagem M1 da obra A (manfac, pelo engenheiro).
-- "Administrador" = o primeiro e-mail com nivel 'administrador' em hub_user_roles.
-- ============================================================

begin;

create temp table _v (n int, teste text, esperado text, obtido text) on commit drop;

create function pg_temp.jwt(p_email text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    case when p_email is null then ''
                         else json_build_object('email', p_email, 'role', 'authenticated')::text end,
                    true);
$$;

-- Troca a role da transação (desfeita pelo erro que fecha o bloco).
create function pg_temp.como(p_role text, p_email text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    case when p_email is null then ''
                         else json_build_object('email', p_email, 'role', p_role)::text end,
                    true);
  select set_config('role', p_role, true);
$$;

create function pg_temp.reg(p_n int, p_teste text, p_esperado text, p_obtido text) returns void language sql as $$
  insert into _v values (p_n, p_teste, p_esperado, p_obtido);
$$;

create function pg_temp.tf(p boolean) returns text language sql as $$
  select case when p then 't' when not p then 'f' else 'NULL' end;
$$;

create function pg_temp.admin_email() returns text language sql as $$
  select user_email from public.hub_user_roles where nivel = 'administrador' order by user_email limit 1;
$$;

select pg_temp.jwt(null);

insert into public.obras_obra (id, os, modalidade, engenheiro_email)
values ('00000000-0000-4000-8000-00000000a010', 'TESTE-VERIF-LEVA5-A', 'obra', 'eng.teste@teste.invalid'),
       ('00000000-0000-4000-8000-00000000a011', 'TESTE-VERIF-LEVA5-B', 'obra', null);

insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
values ('eng.teste@teste.invalid', 'obras', true, 'verificacao-leva5'),
       ('usuario.obras@teste.invalid', 'obras', true, 'verificacao-leva5');

-- Acesso do portal pelo administrador (e-mail com caixa e espaços, criado_em forjado)
select pg_temp.jwt(pg_temp.admin_email());
insert into public.obras_portal_acesso (id, obra_id, email, nome, criado_por, criado_em)
values ('00000000-0000-4000-8000-0000000f0001', '00000000-0000-4000-8000-00000000a010',
        '  Cliente@Exemplo.INVALID ', 'Cliente Teste', 'forjado@teste.invalid', '2020-01-01');

-- D1 e M1 pelo engenheiro
select pg_temp.jwt('eng.teste@teste.invalid');
insert into public.obras_documento (id, obra_id, pasta, nome, path, tamanho, tipo, criado_por, criado_em)
values ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-4000-8000-00000000a010', 'projetos', 'Planta baixa.pdf',
        '00000000-0000-4000-8000-00000000a010/11111111-1111-4111-8111-111111111111-planta-baixa.pdf',
        1024, 'application/pdf', 'forjado@teste.invalid', '2020-01-01');
insert into public.obras_mensagem (id, obra_id, autor_tipo, autor_email, texto, criado_em)
values ('00000000-0000-4000-8000-0000000e0001', '00000000-0000-4000-8000-00000000a010', 'manfac',
        'forjado@teste.invalid', 'Olá, a obra começa segunda.', '2020-01-01');
select pg_temp.jwt(null);

insert into storage.objects (bucket_id, name)
values ('obras-docs', '00000000-0000-4000-8000-00000000a010/22222222-2222-4222-8222-222222222222-fixture.pdf');

-- ============================================================
-- obras_portal_acesso
-- ============================================================
select pg_temp.reg(1, 'admin cadastra acesso: e-mail lower(trim), criado_por = admin, criado_em forçado',
  'ok:cliente@exemplo.invalid|t|t',
  (select 'ok:' || email || '|' || pg_temp.tf(criado_por = pg_temp.admin_email()) || '|' || pg_temp.tf(criado_em = now())
     from public.obras_portal_acesso where id = '00000000-0000-4000-8000-0000000f0001'));

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_acesso (obra_id, email)
  values ('00000000-0000-4000-8000-00000000a011', 'fulano@manfac.com.br');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(2, 'e-mail @manfac.com.br recusado (mesmo sem JWT)', 'obras_portal_acesso_email_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_acesso (obra_id, email)
  values ('00000000-0000-4000-8000-00000000a011', '  Fulano@MANFAC.com.BR');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(3, 'e-mail Manfac com caixa alta e espaços: normalizado e recusado', 'obras_portal_acesso_email_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_acesso (obra_id, email)
  values ('00000000-0000-4000-8000-00000000a011', 'fulano@obras.manfac.com.br');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(4, 'subdomínio de manfac.com.br recusado', 'obras_portal_acesso_email_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_acesso (obra_id, email)
  values ('00000000-0000-4000-8000-00000000a011', 'semarroba');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(5, 'e-mail sem formato recusado', 'obras_portal_acesso_email_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_portal_acesso (obra_id, email)
  values ('00000000-0000-4000-8000-00000000a010', 'CLIENTE@exemplo.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(6, 'mesmo e-mail (outra caixa) na mesma obra: único', 'obras_portal_acesso_obra_email_key', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_portal_acesso (obra_id, email)
  values ('00000000-0000-4000-8000-00000000a010', 'outro@exemplo.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(7, 'engenheiro (não admin) cadastra acesso: bloqueado', 'só administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_portal_acesso set ativo = false where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(8, 'engenheiro (não admin) desativa acesso: bloqueado', 'só administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_portal_acesso where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(9, 'engenheiro (não admin) apaga acesso: bloqueado', 'só administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_portal_acesso
     set ativo = false, nome = 'Novo nome', criado_por = 'forjado@teste.invalid', criado_em = '2020-01-01'
   where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'ok:%', (select pg_temp.tf(ativo) || '|' || nome || '|' || pg_temp.tf(criado_por = pg_temp.admin_email())
                                  || '|' || pg_temp.tf(criado_em = now())
                             from public.obras_portal_acesso where id = '00000000-0000-4000-8000-0000000f0001');
exception when others then
  perform pg_temp.reg(10, 'admin desativa e renomeia; criado_por/criado_em não mudam', 'ok:f|Novo nome|t|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_portal_acesso set email = 'trocado@exemplo.invalid'
   where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(11, 'trocar o e-mail de um acesso: imutável', 'obra_id e email são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_portal_acesso set obra_id = '00000000-0000-4000-8000-00000000a011'
   where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(12, 'mover um acesso para outra obra: imutável', 'obra_id e email são imutáveis', sqlerrm);
end $$;

-- RLS de verdade (role authenticated)
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_portal_acesso);
exception when others then
  perform pg_temp.reg(13, 'authenticated com acesso ao Obras (não admin) não enxerga nenhum acesso do portal', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_portal_acesso (obra_id, email)
  values ('00000000-0000-4000-8000-00000000a010', 'outro@exemplo.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(14, 'authenticated não admin insere acesso do portal: bloqueado', 'só administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_portal_acesso set ativo = false;
  raise exception 'ok:%', coalesce((select pg_temp.tf(ativo) from public.obras_portal_acesso
                                      where id = '00000000-0000-4000-8000-0000000f0001'), 'nada');
exception when others then
  -- O select do ok roda ainda como authenticated (não enxerga) -> 'nada'.
  perform pg_temp.reg(15, 'authenticated não admin: UPDATE em massa não alcança nenhuma linha', 'ok:nada', sqlerrm);
end $$;

select pg_temp.reg(16, 'depois do UPDATE em massa (desfeito) o acesso segue ativo', 'ok:t',
  (select 'ok:' || pg_temp.tf(ativo) from public.obras_portal_acesso where id = '00000000-0000-4000-8000-0000000f0001'));

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  raise exception 'ok:%', (select pg_temp.tf(count(*) >= 1) from public.obras_portal_acesso
                             where id = '00000000-0000-4000-8000-0000000f0001');
exception when others then
  perform pg_temp.reg(17, 'authenticated admin enxerga o acesso do portal', 'ok:t', sqlerrm);
end $$;

do $$
declare v_adm text := pg_temp.admin_email();  -- lido como postgres, antes da troca de role
begin
  perform pg_temp.como('authenticated', v_adm);
  insert into public.obras_portal_acesso (obra_id, email, criado_por)
  values ('00000000-0000-4000-8000-00000000a011', 'novo@exemplo.invalid', 'forjado@teste.invalid');
  raise exception 'ok:%', (select pg_temp.tf(criado_por = v_adm) from public.obras_portal_acesso
                             where email = 'novo@exemplo.invalid');
exception when others then
  perform pg_temp.reg(18, 'authenticated admin cadastra acesso; criado_por = JWT', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_portal_acesso;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(19, 'anon lê obras_portal_acesso: sem privilégio', 'permission denied', sqlerrm);
end $$;

-- ============================================================
-- obras_portal_codigo e obras_portal_sessao (só service role)
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  perform count(*) from public.obras_portal_codigo;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(20, 'authenticated (até admin) lê obras_portal_codigo: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  insert into public.obras_portal_codigo (email, codigo_hash, expira_em)
  values ('cliente@exemplo.invalid', repeat('a', 64), now() + interval '10 minutes');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(21, 'authenticated insere em obras_portal_codigo: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  perform count(*) from public.obras_portal_sessao;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(22, 'authenticated (até admin) lê obras_portal_sessao: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  insert into public.obras_portal_sessao (token_hash, email, expira_em)
  values (repeat('b', 64), 'cliente@exemplo.invalid', now() + interval '7 days');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(23, 'authenticated insere em obras_portal_sessao: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_portal_codigo;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(24, 'anon lê obras_portal_codigo: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  insert into public.obras_portal_sessao (token_hash, email, expira_em)
  values (repeat('c', 64), 'cliente@exemplo.invalid', now() + interval '7 days');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(25, 'anon insere em obras_portal_sessao: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('service_role', null);
  insert into public.obras_portal_codigo (email, codigo_hash, expira_em, ip)
  values ('cliente@exemplo.invalid', repeat('a', 64), now() + interval '10 minutes', '203.0.113.1');
  insert into public.obras_portal_sessao (token_hash, email, expira_em)
  values (repeat('b', 64), 'cliente@exemplo.invalid', now() + interval '7 days');
  update public.obras_portal_codigo set tentativas = tentativas + 1 where email = 'cliente@exemplo.invalid';
  raise exception 'ok:%|%', (select tentativas from public.obras_portal_codigo where email = 'cliente@exemplo.invalid'),
                            (select count(*) from public.obras_portal_sessao where email = 'cliente@exemplo.invalid');
exception when others then
  perform pg_temp.reg(26, 'service_role grava e lê código e sessão', 'ok:1|1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_codigo (email, codigo_hash, expira_em)
  values ('cliente@exemplo.invalid', '123456', now() + interval '10 minutes');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(27, 'código cru de 6 dígitos no lugar do hash: check', 'obras_portal_codigo_hash_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_codigo (email, codigo_hash, expira_em)
  values ('Cliente@Exemplo.invalid', repeat('a', 64), now() + interval '10 minutes');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(28, 'código com e-mail não normalizado: check', 'obras_portal_codigo_email_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_sessao (token_hash, email, expira_em) values
    (repeat('d', 64), 'cliente@exemplo.invalid', now() + interval '7 days'),
    (repeat('d', 64), 'outro@exemplo.invalid', now() + interval '7 days');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(29, 'token_hash repetido: único', 'obras_portal_sessao_token_hash_key', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_sessao (token_hash, email, expira_em)
  values (repeat('e', 64), 'cliente@exemplo.invalid', now() - interval '1 minute');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(30, 'sessão que já nasce expirada: check', 'obras_portal_sessao_expira_check', sqlerrm);
end $$;

-- ============================================================
-- obras_documento
-- ============================================================
select pg_temp.reg(31, 'engenheiro cria documento: criado_por = JWT, criado_em forçado', 'ok:t|t',
  (select 'ok:' || pg_temp.tf(criado_por = 'eng.teste@teste.invalid') || '|' || pg_temp.tf(criado_em = now())
     from public.obras_documento where id = '00000000-0000-4000-8000-0000000d0001'));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_documento (obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-00000000a011', 'laudos', 'Laudo.pdf',
          '00000000-0000-4000-8000-00000000a011/33333333-3333-4333-8333-333333333333-laudo.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(32, 'engenheiro de outra obra sobe documento na obra B: bloqueado', 'OBRAS_DOCUMENTO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  insert into public.obras_documento (obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-00000000a010', 'laudos', 'Laudo.pdf',
          '00000000-0000-4000-8000-00000000a010/33333333-3333-4333-8333-333333333333-laudo.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(33, 'usuário do Obras que não é engenheiro nem admin sobe documento: bloqueado', 'OBRAS_DOCUMENTO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_documento (id, obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-0000000d0002', '00000000-0000-4000-8000-00000000a011', 'art', 'ART.pdf',
          '00000000-0000-4000-8000-00000000a011/33333333-3333-4333-8333-333333333333-ART_01.pdf');
  raise exception 'ok:%', (select pasta from public.obras_documento where id = '00000000-0000-4000-8000-0000000d0002');
exception when others then
  perform pg_temp.reg(34, 'administrador sobe documento em obra sem engenheiro: passa', 'ok:art', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_documento (obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-00000000a010', 'laudos', 'Laudo.pdf',
          '00000000-0000-4000-8000-00000000a011/33333333-3333-4333-8333-333333333333-laudo.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(35, 'documento da obra A com caminho da obra B (sem JWT): caminho', 'OBRAS_DOCUMENTO_CAMINHO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_documento (obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-00000000a010', 'laudos', 'Laudo.pdf',
          '00000000-0000-4000-8000-00000000a010/33333333-3333-4333-8333-333333333333-../../x.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(36, 'caminho com barra/travessia no nome: caminho', 'OBRAS_DOCUMENTO_CAMINHO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_documento (obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-00000000a010', 'laudos', 'Laudo.pdf',
          '00000000-0000-4000-8000-00000000a010/laudo.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(37, 'caminho sem o uuid antes do nome: caminho', 'OBRAS_DOCUMENTO_CAMINHO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_documento (obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-00000000a010', 'laudos', 'Laudo final.pdf',
          '00000000-0000-4000-8000-00000000a010/33333333-3333-4333-8333-333333333333-laudo final.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(38, 'nome não saneado (espaço) no caminho: caminho', 'OBRAS_DOCUMENTO_CAMINHO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_documento (obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-00000000a010', 'financeiro', 'X.pdf',
          '00000000-0000-4000-8000-00000000a010/33333333-3333-4333-8333-333333333333-x.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(39, 'pasta fora das 6 fixas: check', 'obras_documento_pasta_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_documento
     set path = '00000000-0000-4000-8000-00000000a010/44444444-4444-4444-8444-444444444444-outro.pdf'
   where id = '00000000-0000-4000-8000-0000000d0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(40, 'trocar o path de um documento: imutável', 'são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  delete from public.obras_documento where id = '00000000-0000-4000-8000-0000000d0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(41, 'usuário do Obras não engenheiro apaga documento: bloqueado', 'OBRAS_DOCUMENTO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_documento where id = '00000000-0000-4000-8000-0000000d0001';
  raise exception 'ok:%', (select count(*) from public.obras_documento where id = '00000000-0000-4000-8000-0000000d0001');
exception when others then
  perform pg_temp.reg(42, 'engenheiro apaga documento da obra: passa', 'ok:0', sqlerrm);
end $$;

-- RLS de verdade
do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into public.obras_documento (id, obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-0000000d0003', '00000000-0000-4000-8000-00000000a010', 'termos', 'Termo.pdf',
          '00000000-0000-4000-8000-00000000a010/55555555-5555-4555-8555-555555555555-termo.pdf');
  raise exception 'ok:%', (select pasta from public.obras_documento where id = '00000000-0000-4000-8000-0000000d0003');
exception when others then
  perform pg_temp.reg(43, 'authenticated engenheiro (com acesso ao Obras) sobe documento: passa', 'ok:termos', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  update public.obras_documento set nome = 'x' where id = '00000000-0000-4000-8000-0000000d0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(44, 'authenticated faz UPDATE em obras_documento: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_documento);
exception when others then
  perform pg_temp.reg(45, 'authenticated sem acesso ao Obras não enxerga documentos', 'ok:0', sqlerrm);
end $$;

-- ============================================================
-- Storage: bucket obras-docs
-- ============================================================
select pg_temp.reg(46, 'bucket obras-docs privado', 'ok:f',
  (select 'ok:' || pg_temp.tf(public) from storage.buckets where id = 'obras-docs'));
select pg_temp.reg(94, 'bucket obras-docs com limite de 25 MB (file_size_limit 26214400)', 'ok:26214400',
  (select 'ok:' || coalesce(file_size_limit::text, 'sem limite') from storage.buckets where id = 'obras-docs'));

do $$
declare a text; b text; c text; d text; e text; f text;
begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  a := pg_temp.tf(public.obras_docs_pode_escrever('00000000-0000-4000-8000-00000000a010/66666666-6666-4666-8666-666666666666-a.pdf'));
  b := pg_temp.tf(public.obras_docs_pode_escrever('00000000-0000-4000-8000-00000000a011/66666666-6666-4666-8666-666666666666-a.pdf'));
  c := pg_temp.tf(public.obras_docs_pode_escrever('nao-e-uuid/66666666-6666-4666-8666-666666666666-a.pdf'));
  e := pg_temp.tf(public.obras_docs_pode_escrever(null));
  perform pg_temp.jwt(pg_temp.admin_email());
  d := pg_temp.tf(public.obras_docs_pode_escrever('00000000-0000-4000-8000-0000000fffff/66666666-6666-4666-8666-666666666666-a.pdf'));
  perform pg_temp.jwt(null);
  f := pg_temp.tf(public.obras_docs_pode_escrever('00000000-0000-4000-8000-00000000a010/66666666-6666-4666-8666-666666666666-a.pdf'));
  raise exception 'ok:%|%|%|%|%|%', a, b, c, d, e, f;
exception when others then
  perform pg_temp.reg(47, 'obras_docs_pode_escrever: eng A / eng B / formato ruim / admin obra inexistente / NULL / sem JWT',
    'ok:t|f|f|f|f|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-docs', '00000000-0000-4000-8000-00000000a010/77777777-7777-4777-8777-777777777777-planta.pdf');
  raise exception 'ok:inseriu';
exception when others then
  perform pg_temp.reg(48, 'authenticated engenheiro sobe objeto no prefixo da obra A: passa', 'ok:inseriu', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-docs', '00000000-0000-4000-8000-00000000a011/77777777-7777-4777-8777-777777777777-planta.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(49, 'engenheiro sobe objeto no prefixo da obra B: bloqueado', 'row-level security', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-docs', '00000000-0000-4000-8000-00000000a010/77777777-7777-4777-8777-777777777777-planta.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(50, 'usuário do Obras não engenheiro sobe objeto: bloqueado', 'row-level security', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-docs', '00000000-0000-4000-8000-00000000a010/planta.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(51, 'engenheiro sobe objeto fora do formato <obra>/<uuid>-<nome>: bloqueado', 'row-level security', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  update storage.objects set name = name || '-x'
   where bucket_id = 'obras-docs' and name = '00000000-0000-4000-8000-00000000a010/22222222-2222-4222-8222-222222222222-fixture.pdf';
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(52, 'engenheiro tenta sobrescrever/mover objeto (sem policy de update): 0 linhas', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  raise exception 'ok:%', (select count(*) from storage.objects where bucket_id = 'obras-docs'
                             and name = '00000000-0000-4000-8000-00000000a010/22222222-2222-4222-8222-222222222222-fixture.pdf');
exception when others then
  perform pg_temp.reg(53, 'engenheiro (acesso ao Obras) enxerga o objeto da obra', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', (select count(*) from storage.objects where bucket_id = 'obras-docs');
exception when others then
  perform pg_temp.reg(54, 'authenticated sem acesso ao Obras não enxerga objetos de obras-docs', 'ok:0', sqlerrm);
end $$;

-- ============================================================
-- obras_mensagem
-- ============================================================
select pg_temp.reg(55, 'engenheiro escreve mensagem: autor_email = JWT (forjado ignorado), criado_em forçado', 'ok:manfac|t|t',
  (select 'ok:' || autor_tipo || '|' || pg_temp.tf(autor_email = 'eng.teste@teste.invalid') || '|' || pg_temp.tf(criado_em = now())
     from public.obras_mensagem where id = '00000000-0000-4000-8000-0000000e0001'));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_mensagem (obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-00000000a010', 'cliente', 'cliente@exemplo.invalid', 'Me passando pelo cliente');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(56, 'pelo hub (JWT) gravar como cliente: bloqueado', 'só se grava mensagem da Manfac', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_mensagem (id, obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-0000000e0002', '00000000-0000-4000-8000-00000000a010', 'cliente',
          ' Cliente@Exemplo.invalid', '<script>alert(1)</script>');
  raise exception 'ok:%|%', (select autor_email from public.obras_mensagem where id = '00000000-0000-4000-8000-0000000e0002'),
                            (select pg_temp.tf(texto = '<script>alert(1)</script>') from public.obras_mensagem
                              where id = '00000000-0000-4000-8000-0000000e0002');
exception when others then
  perform pg_temp.reg(57, 'servidor grava mensagem do cliente com acesso ativo (e-mail normalizado, texto literal)', 'ok:cliente@exemplo.invalid|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_mensagem (obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-00000000a011', 'cliente', 'cliente@exemplo.invalid', 'Oi');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(58, 'mensagem do cliente numa obra em que ele não tem acesso: bloqueada', 'sem acesso ativo', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_portal_acesso set ativo = false where id = '00000000-0000-4000-8000-0000000f0001';
  insert into public.obras_mensagem (obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-00000000a010', 'cliente', 'cliente@exemplo.invalid', 'Oi');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(59, 'mensagem do cliente com acesso DESATIVADO: bloqueada', 'sem acesso ativo', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_mensagem (obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-00000000a010', 'manfac', 'x', '');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(60, 'texto vazio: check', 'obras_mensagem_texto_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_mensagem (obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-00000000a010', 'manfac', 'x', '   ');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(61, 'texto só de espaços: check', 'obras_mensagem_texto_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_mensagem (obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-00000000a010', 'manfac', 'x', repeat('a', 4001));
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(62, 'texto com 4001 caracteres: check', 'obras_mensagem_texto_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_mensagem (id, obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-0000000e0003', '00000000-0000-4000-8000-00000000a010', 'manfac', 'x', repeat('é', 4000));
  raise exception 'ok:%', (select char_length(texto) from public.obras_mensagem where id = '00000000-0000-4000-8000-0000000e0003');
exception when others then
  perform pg_temp.reg(63, 'texto com 4000 caracteres (multibyte): passa', 'ok:4000', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_mensagem set texto = 'alterado' where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(64, 'UPDATE de mensagem sem JWT (service role): bloqueado', 'não pode ser alterada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_mensagem set texto = 'alterado' where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(65, 'UPDATE de mensagem pelo administrador: bloqueado', 'não pode ser alterada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_mensagem where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(66, 'DELETE de mensagem sem JWT (service role): bloqueado', 'não pode ser apagada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('service_role', null);
  delete from public.obras_mensagem where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(67, 'DELETE de mensagem pela role service_role: bloqueado', 'não pode ser apagada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_mensagem set texto = 'alterado' where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(68, 'authenticated (admin) faz UPDATE em obras_mensagem: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  delete from public.obras_mensagem where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(69, 'authenticated (admin) faz DELETE em obras_mensagem: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_mensagem (id, obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-0000000e0004', '00000000-0000-4000-8000-00000000a010', 'manfac',
          'forjado@teste.invalid', 'Resposta da Manfac');
  raise exception 'ok:%', (select autor_email from public.obras_mensagem where id = '00000000-0000-4000-8000-0000000e0004');
exception when others then
  perform pg_temp.reg(70, 'authenticated com acesso ao Obras responde: passa com autor = JWT', 'ok:usuario.obras@teste.invalid', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  insert into public.obras_mensagem (obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-00000000a010', 'manfac', 'sem.acesso@teste.invalid', 'Oi');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(71, 'authenticated sem acesso ao Obras escreve mensagem: RLS', 'row-level security', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_mensagem);
exception when others then
  perform pg_temp.reg(72, 'authenticated sem acesso ao Obras não enxerga mensagens', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_mensagem;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(73, 'anon lê obras_mensagem: sem privilégio', 'permission denied', sqlerrm);
end $$;

-- ============================================================
-- Apagar obra: só admin com JWT; documentos e mensagens com FK restrict
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a011';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(74, 'engenheiro (não admin) apaga obra: bloqueado', 'só administrador apaga obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a011';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(75, 'authenticated do Obras (não admin) apaga obra pelo navegador: bloqueado', 'só administrador apaga obra', sqlerrm);
end $$;

do $$ begin
  -- Sem o documento D1, só a mensagem segura a obra A.
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_documento where obra_id = '00000000-0000-4000-8000-00000000a010';
  perform pg_temp.jwt(pg_temp.admin_email());
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a010';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(76, 'admin apaga obra com mensagens: FK restrict', 'obras_mensagem_obra_id_fkey', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_obra (id, os, modalidade) values ('00000000-0000-4000-8000-00000000a012', 'TESTE-VERIF-LEVA5-C', 'obra');
  insert into public.obras_documento (obra_id, pasta, nome, path)
  values ('00000000-0000-4000-8000-00000000a012', 'outros', 'X.pdf',
          '00000000-0000-4000-8000-00000000a012/88888888-8888-4888-8888-888888888888-x.pdf');
  perform pg_temp.jwt(pg_temp.admin_email());
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a012';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(77, 'admin apaga obra com documento: FK restrict', 'obras_documento_obra_id_fkey', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a010';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(78, 'sem JWT (service role) apaga obra com documento/mensagem: FK restrict', 'violates foreign key constraint', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_acesso (obra_id, email) values ('00000000-0000-4000-8000-00000000a011', 'b@exemplo.invalid');
  perform pg_temp.jwt(pg_temp.admin_email());
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a011';
  raise exception 'ok:%|%', (select count(*) from public.obras_obra where id = '00000000-0000-4000-8000-00000000a011'),
    (select count(*) from public.obras_portal_acesso where obra_id = '00000000-0000-4000-8000-00000000a011');
exception when others then
  perform pg_temp.reg(79, 'admin apaga obra sem documento/mensagem: passa e o acesso do portal sai em cascata', 'ok:0|0', sqlerrm);
end $$;

-- ============================================================
-- Ajustes da revisão (fix round 1)
-- ============================================================
do $$ begin
  perform pg_temp.jwt(null);
  truncate public.obras_mensagem;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(80, 'TRUNCATE de obras_mensagem (postgres): bloqueado', 'não pode ser apagada (truncate)', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_mensagem (obra_id, autor_tipo, autor_email, texto)
  values ('00000000-0000-4000-8000-00000000a010', 'manfac', 'x', E'\n\t \n');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(81, 'texto só de quebras de linha e tabs: check', 'obras_mensagem_texto_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_acesso (obra_id, email)
  values ('00000000-0000-4000-8000-00000000a011', 'fulano@manfac.com.br.');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(82, 'e-mail Manfac com ponto final de FQDN: recusado', 'obras_portal_acesso_email_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_portal_acesso (obra_id, email)
  values ('00000000-0000-4000-8000-00000000a011', U&'fulano\200B@exemplo.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(83, 'e-mail com caractere invisível (U+200B): recusado', 'obras_portal_acesso_email_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_portal_acesso set id = '00000000-0000-4000-8000-0000000f0009'
   where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(84, 'trocar o id de um acesso: imutável', 'id, obra_id e email são imutáveis', sqlerrm);
end $$;

-- Storage: policy "obras docs delete" (o GUC libera o DELETE direto em
-- versões do Storage com trigger protect_delete; sem ele não tem efeito).
do $$
declare v int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  delete from storage.objects
   where bucket_id = 'obras-docs' and name = '00000000-0000-4000-8000-00000000a010/22222222-2222-4222-8222-222222222222-fixture.pdf';
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(85, 'engenheiro apaga objeto da própria obra: passa', 'ok:1', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  delete from storage.objects
   where bucket_id = 'obras-docs' and name = '00000000-0000-4000-8000-00000000a010/22222222-2222-4222-8222-222222222222-fixture.pdf';
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(86, 'usuário do Obras não engenheiro apaga objeto: 0 linhas', 'ok:0', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.jwt(null);
  insert into storage.objects (bucket_id, name)
  values ('obras-docs', '00000000-0000-4000-8000-00000000a011/99999999-9999-4999-8999-999999999999-b.pdf');
  perform set_config('storage.allow_delete_query', 'true', true);
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  delete from storage.objects
   where bucket_id = 'obras-docs' and name = '00000000-0000-4000-8000-00000000a011/99999999-9999-4999-8999-999999999999-b.pdf';
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(87, 'engenheiro apaga objeto de outra obra: 0 linhas', 'ok:0', sqlerrm);
end $$;

-- obras_portal_emitir_codigo
do $$
declare v_ok int := 0; v_6 boolean;
begin
  perform pg_temp.como('service_role', null);
  for i in 1..5 loop
    if public.obras_portal_emitir_codigo('limite.email@exemplo.invalid', '198.51.100.' || i, repeat('a', 64)) then
      v_ok := v_ok + 1;
    end if;
  end loop;
  v_6 := public.obras_portal_emitir_codigo('limite.email@exemplo.invalid', '198.51.100.99', repeat('a', 64));
  raise exception 'ok:%|%|%', v_ok, pg_temp.tf(v_6),
    (select count(*) from public.obras_portal_codigo where email = 'limite.email@exemplo.invalid');
exception when others then
  perform pg_temp.reg(88, 'emitir: 5 por e-mail na hora passam, o 6º é recusado e não grava', 'ok:5|f|5', sqlerrm);
end $$;

do $$
declare v_ok int := 0; v_21 boolean;
begin
  perform pg_temp.como('service_role', null);
  for i in 1..20 loop
    if public.obras_portal_emitir_codigo('ip' || i || '@exemplo.invalid', '203.0.113.77', repeat('a', 64)) then
      v_ok := v_ok + 1;
    end if;
  end loop;
  v_21 := public.obras_portal_emitir_codigo('ip21@exemplo.invalid', '203.0.113.77', repeat('a', 64));
  raise exception 'ok:%|%', v_ok, pg_temp.tf(v_21);
exception when others then
  perform pg_temp.reg(89, 'emitir: 20 por IP na hora passam, o 21º é recusado', 'ok:20|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('service_role', null);
  perform public.obras_portal_emitir_codigo('  Dois.Codigos@Exemplo.invalid', '198.51.100.200', repeat('a', 64));
  perform public.obras_portal_emitir_codigo('dois.codigos@exemplo.invalid', '198.51.100.200', repeat('b', 64));
  raise exception 'ok:%|%|%',
    (select count(*) from public.obras_portal_codigo where email = 'dois.codigos@exemplo.invalid' and usado_em is null),
    (select count(*) from public.obras_portal_codigo where email = 'dois.codigos@exemplo.invalid' and usado_em is not null),
    (select (codigo_hash = repeat('b', 64) and expira_em - criado_em = interval '10 minutes')::text
       from public.obras_portal_codigo
      where email = 'dois.codigos@exemplo.invalid' and usado_em is null);
exception when others then
  perform pg_temp.reg(90, 'emitir: e-mail normalizado; o anterior é aposentado, só o novo vale e expira 10 min depois de criado (banco)', 'ok:1|1|true', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  perform public.obras_portal_emitir_codigo('x@exemplo.invalid', '198.51.100.1', repeat('a', 64));
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(91, 'authenticated (até admin) executa obras_portal_emitir_codigo: sem privilégio', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform public.obras_portal_emitir_codigo('x@exemplo.invalid', '198.51.100.1', repeat('a', 64));
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(92, 'anon executa obras_portal_emitir_codigo: sem privilégio', 'permission denied', sqlerrm);
end $$;

select pg_temp.reg(93, 'existe administrador para os testes de admin', 'ok:t',
  (select 'ok:' || pg_temp.tf(pg_temp.admin_email() is not null)));

-- ============================================================
-- 6. Analista da obra: obras_situacao_pergunta
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_pergunta (obra_id, chave, pergunta, contexto, resposta, interno, respondida_por, respondida_em, aberta, criado_em)
  values ('00000000-0000-4000-8000-00000000a010', 'execucao:12', 'Drywall (4.2): 13 dias úteis contra 9. O que causou?',
          '{"impressao":"9|2026-11-20"}', 'Interferência com a infra existente.', false,
          'forjado@teste.invalid', '2020-01-01', false, '2020-01-01');
  raise exception 'ok:%',
    (select pg_temp.tf(respondida_por = 'eng.teste@teste.invalid') || '|' || pg_temp.tf(respondida_em = now())
            || '|' || pg_temp.tf(criado_em = now())
       from public.obras_situacao_pergunta where obra_id = '00000000-0000-4000-8000-00000000a010' and chave = 'execucao:12');
exception when others then
  perform pg_temp.reg(95, 'pergunta: engenheiro responde; respondida_por/em e criado_em forçados', 'ok:t|t|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  insert into public.obras_situacao_pergunta (obra_id, chave, pergunta, resposta, aberta)
  values ('00000000-0000-4000-8000-00000000a010', 'desvio:obra', 'Desvio de 4 p.p.', 'x', false);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(96, 'pergunta: usuário do Obras que não é engenheiro nem admin não responde', 'OBRAS_SITUACAO_PERGUNTA', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into public.obras_situacao_pergunta (obra_id, chave, pergunta, resposta, aberta)
  values ('00000000-0000-4000-8000-00000000a010', 'desvio:obra', 'Desvio de 4 p.p.', 'Primeira resposta', false);
  insert into public.obras_situacao_pergunta (obra_id, chave, pergunta, resposta, interno, aberta)
  values ('00000000-0000-4000-8000-00000000a010', 'desvio:obra', 'Desvio de 5 p.p.', 'Segunda resposta', true, false)
  on conflict (obra_id, chave) do update
    set pergunta = excluded.pergunta, resposta = excluded.resposta, interno = excluded.interno, aberta = excluded.aberta;
  select count(*) into v from public.obras_situacao_pergunta
   where obra_id = '00000000-0000-4000-8000-00000000a010' and chave = 'desvio:obra';
  raise exception 'ok:%|%', v,
    (select resposta || '|' || pg_temp.tf(interno) || '|' || respondida_por from public.obras_situacao_pergunta
      where obra_id = '00000000-0000-4000-8000-00000000a010' and chave = 'desvio:obra');
exception when others then
  perform pg_temp.reg(97, 'pergunta (RLS real): engenheiro regrava a resposta pela chave estável (upsert, uma linha)',
    'ok:1|Segunda resposta|t|eng.teste@teste.invalid', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_pergunta (obra_id, chave, pergunta)
  values ('00000000-0000-4000-8000-00000000a010', 'entrega:obra', 'Entrega mudou');
  update public.obras_situacao_pergunta set chave = 'entrega:outra'
   where obra_id = '00000000-0000-4000-8000-00000000a010' and chave = 'entrega:obra';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(98, 'pergunta: chave (e obra) imutáveis no UPDATE', 'são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_pergunta (obra_id, chave, pergunta, aberta)
  values ('00000000-0000-4000-8000-00000000a010', 'entrega:obra', 'Entrega mudou', false);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(99, 'pergunta: fechada sem resposta recusada', 'obras_situacao_pergunta_fechada_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  delete from public.obras_situacao_pergunta where obra_id = '00000000-0000-4000-8000-00000000a010';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(100, 'pergunta: authenticated não apaga (sem privilégio de delete)', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform 1 from public.obras_situacao_pergunta limit 1;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(101, 'pergunta: anon não lê', 'permission denied', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_pergunta (obra_id, chave, pergunta)
  values ('00000000-0000-4000-8000-00000000a010', 'impedimento:x1', 'Impedimento aberto há 5 dias úteis');
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  select count(*) into v from public.obras_situacao_pergunta where obra_id = '00000000-0000-4000-8000-00000000a010';
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(102, 'pergunta: quem não tem acesso ao Obras não vê nada (RLS)', 'ok:0', sqlerrm);
end $$;

-- ============================================================
-- 6. Situação para o cliente: obras_situacao_cliente (publicada = imutável)
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, acoes, publicada_por, publicada_em)
  values ('00000000-0000-4000-8000-00000000a010', 99, 'O atraso é de responsabilidade da Manfac.',
          '[{"oque":"Segunda equipe","quando":"desde 23/11","efeito":"recupera 2 dias úteis"}]',
          'forjado@teste.invalid', '2020-01-01');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, publicada_por)
  values ('00000000-0000-4000-8000-00000000a010', 1, 'Nova versão.', 'forjado@teste.invalid');
  raise exception 'ok:%',
    (select string_agg(versao::text || '/' || publicada_por || '/' || pg_temp.tf(publicada_em = now()), ',' order by versao)
       from public.obras_situacao_cliente where obra_id = '00000000-0000-4000-8000-00000000a010');
exception when others then
  perform pg_temp.reg(103, 'situação: versões 1 e 2 em sequência (versão do navegador ignorada), autoria e data forçadas',
    'ok:1/eng.teste@teste.invalid/t,2/eng.teste@teste.invalid/t', sqlerrm);
end $$;

do $$
declare v_erro text;
begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, publicada_por)
  values ('00000000-0000-4000-8000-00000000a010', 1, 'Publicada.', 'x@teste.invalid');
  begin
    update public.obras_situacao_cliente set explicacao = 'Trocada.'
     where obra_id = '00000000-0000-4000-8000-00000000a010';
    v_erro := 'NAO_FALHOU';
  exception when others then
    v_erro := sqlerrm;
  end;
  raise exception 'ok:%', v_erro;
exception when others then
  perform pg_temp.reg(104, 'situação: publicada não se altera (engenheiro)', 'ok:OBRAS_SITUACAO: situação publicada é imutável', sqlerrm);
end $$;

do $$
declare v_erro text;
begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, publicada_por)
  values ('00000000-0000-4000-8000-00000000a010', 1, 'Publicada.', 'x@teste.invalid');
  perform pg_temp.jwt(null);
  begin
    update public.obras_situacao_cliente set explicacao = 'Trocada.'
     where obra_id = '00000000-0000-4000-8000-00000000a010';
    v_erro := 'NAO_FALHOU';
  exception when others then
    v_erro := sqlerrm;
  end;
  begin
    delete from public.obras_situacao_cliente where obra_id = '00000000-0000-4000-8000-00000000a010';
    v_erro := v_erro || '|NAO_FALHOU';
  exception when others then
    v_erro := v_erro || '|' || sqlerrm;
  end;
  raise exception 'ok:%', v_erro;
exception when others then
  perform pg_temp.reg(105, 'situação: nem sem JWT (service role/postgres) altera ou apaga',
    'ok:OBRAS_SITUACAO: situação publicada é imutável (publique uma nova versão)|OBRAS_SITUACAO: situação publicada é registro, não pode ser apagada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  truncate public.obras_situacao_cliente;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(106, 'situação: truncate recusado', 'não pode ser apagada (truncate)', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, publicada_por)
  values ('00000000-0000-4000-8000-00000000a010', 1, 'Tentativa.', 'usuario.obras@teste.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(107, 'situação: usuário do Obras que não é engenheiro nem admin não publica', 'só o engenheiro da obra ou administrador publica', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, acoes, publicada_por)
  values ('00000000-0000-4000-8000-00000000a010', 1, 'Seis ações.',
          '[{"oque":"a","quando":"","efeito":""},{"oque":"b","quando":"","efeito":""},{"oque":"c","quando":"","efeito":""},{"oque":"d","quando":"","efeito":""},{"oque":"e","quando":"","efeito":""},{"oque":"f","quando":"","efeito":""}]',
          'x@teste.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(108, 'situação: mais de 5 ações recusado', 'obras_situacao_cliente_acoes_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, acoes, publicada_por)
  values ('00000000-0000-4000-8000-00000000a010', 1, 'Campo extra.',
          '[{"oque":"a","quando":"","efeito":"","area":"suprimentos"}]', 'x@teste.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(109, 'situação: ação com campo desconhecido recusada', 'OBRAS_SITUACAO_ACOES', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, publicada_por)
  values ('00000000-0000-4000-8000-00000000a010', 1, 'Custou R$ 3.000 a mais.', 'x@teste.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(110, 'situação: R$ na explicação recusado', 'obras_situacao_cliente_explicacao_check', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, publicada_por)
  values ('00000000-0000-4000-8000-00000000a010', 7, 'Pela API.', 'eng.teste@teste.invalid');
  get diagnostics v = row_count;
  raise exception 'ok:%|%', v,
    (select string_agg(versao::text, ',') from public.obras_situacao_cliente where obra_id = '00000000-0000-4000-8000-00000000a010');
exception when others then
  perform pg_temp.reg(111, 'situação (RLS real): engenheiro publica pela API; versão 1', 'ok:1|1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, publicada_por)
  values ('00000000-0000-4000-8000-00000000a010', 1, 'Sem acesso.', 'sem.acesso@teste.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(112, 'situação (RLS real): sem acesso ao Obras não publica', 'OBRAS_SITUACAO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_situacao_cliente set explicacao = 'x';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(113, 'situação: authenticated (até admin) sem privilégio de update', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform 1 from public.obras_situacao_cliente limit 1;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(114, 'situação: anon não lê', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_situacao_cliente (obra_id, versao, explicacao, publicada_por)
  values ('00000000-0000-4000-8000-00000000a011', 1, 'Admin publica na obra sem engenheiro.', 'x@teste.invalid');
  raise exception 'ok:%',
    (select pg_temp.tf(publicada_por = pg_temp.admin_email()) from public.obras_situacao_cliente
      where obra_id = '00000000-0000-4000-8000-00000000a011');
exception when others then
  perform pg_temp.reg(115, 'situação: administrador publica em obra sem engenheiro', 'ok:t', sqlerrm);
end $$;

-- ============================================================
-- Relatório (a tabela abaixo; no SQL Editor vale a mensagem do bloco final)
-- Comparação por strpos (no LIKE o '_' dos nomes de constraint é curinga).
-- ============================================================
select n, teste, esperado, obtido,
       case when strpos(obtido, esperado) > 0 then 'OK' else '*** FALHOU ***' end as resultado
  from _v order by n;

do $$
declare
  v_total int;
  v_ok    int;
  v_falhas text;
begin
  select count(*), count(*) filter (where strpos(obtido, esperado) > 0),
         string_agg(n::text || ' (' || coalesce(obtido, 'NULL') || ')', '; ' order by n)
           filter (where obtido is null or strpos(obtido, esperado) = 0)
    into v_total, v_ok, v_falhas
    from _v;
  if v_total <> 115 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 115 testes rodaram';
  end if;
  raise exception 'RESUMO: %/115 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
