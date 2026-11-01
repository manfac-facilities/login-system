-- ============================================================
-- Teste de comportamento de sdd-sql-obras-leva6.sql
-- Rodar DEPOIS de aplicar a migration (e a Leva 5), no SQL Editor,
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
--     authenticated / anon com o JWT daquele e-mail — testa a RLS, os GRANTs
--     e as policies de storage DE VERDADE.
--
-- Fixture (só dentro da transação):
--   obra A TESTE-VERIF-LEVA6-A (OBRA, engenheiro eng.teste@teste.invalid);
--   obra B TESTE-VERIF-LEVA6-B (OBRA, sem engenheiro);
--   hub_system_access slug obras para eng.teste@teste.invalid e
--   usuario.obras@teste.invalid (o "supervisor": acesso ao Obras, não admin,
--   não engenheiro); sem.acesso@teste.invalid não tem linha nenhuma;
--   pelo engenheiro: mapa da obra A, ambientes A1 (com retângulo) e A2 (sem
--   coordenadas), pontos P1 (A1) e P2 (A2), ligação A1 × atividade 1;
--   sem JWT: ambiente B1 e ponto PB1 da obra B;
--   RDOs: R1 (A, 2026-11-02, rascunho), RV (A, 2026-11-01, com a foto FV
--   ligada a A1/P1/atividade 1, depois VALIDADO), RB (B, 2026-11-02, rascunho);
--   storage obras-fotos: <A>/impedimento/<uuid>.jpg e <A>/mapa/<uuid>.png
--   (como postgres).
-- "Administrador" = o primeiro e-mail com nivel 'administrador' em hub_user_roles.
-- ============================================================

begin;

-- 0. A migration (e a Leva 5) têm de estar aplicadas.
do $$
begin
  if to_regclass('public.obras_portal_acesso') is null
     or to_regprocedure('public.obras_docs_pode_escrever(text)') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva5.sql não está aplicado.';
  end if;
  if to_regclass('public.obras_mapa') is null
     or to_regclass('public.obras_ambiente') is null
     or to_regclass('public.obras_ponto_foto') is null
     or to_regclass('public.obras_ambiente_atividade') is null
     or to_regprocedure('public.obras_mapa_pode_escrever(text)') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_rdo_foto' and column_name = 'ponto_id') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva6.sql não está aplicado.';
  end if;
  if not exists (select 1 from public.hub_user_roles where nivel = 'administrador') then
    raise exception 'Nenhum administrador em hub_user_roles: os testes de admin não rodam.';
  end if;
end $$;

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
values ('00000000-0000-4000-8000-00000000a020', 'TESTE-VERIF-LEVA6-A', 'obra', 'eng.teste@teste.invalid'),
       ('00000000-0000-4000-8000-00000000a021', 'TESTE-VERIF-LEVA6-B', 'obra', null);

insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
values ('eng.teste@teste.invalid', 'obras', true, 'verificacao-leva6'),
       ('usuario.obras@teste.invalid', 'obras', true, 'verificacao-leva6');

-- Mapa, ambientes, pontos e ligação da obra A pelo engenheiro (autoria e
-- número forjados de propósito).
select pg_temp.jwt('eng.teste@teste.invalid');
insert into public.obras_mapa (obra_id, modo, criado_por, criado_em)
values ('00000000-0000-4000-8000-00000000a020', 'croqui', 'forjado@teste.invalid', '2020-01-01');
insert into public.obras_ambiente (id, obra_id, nome, area_m2, x, y, w, h, ordem, criado_por, criado_em)
values ('00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-00000000a020', 'Salão', 120, 0.1, 0.1, 0.5, 0.4, 1,
        'forjado@teste.invalid', '2020-01-01'),
       ('00000000-0000-4000-8000-0000000b0002', '00000000-0000-4000-8000-00000000a020', 'Copa', null, null, null, null, null, 2,
        null, now());
insert into public.obras_ponto_foto (id, obra_id, numero, nome, ambiente_id, x, y)
values ('00000000-0000-4000-8000-0000000c0001', '00000000-0000-4000-8000-00000000a020', 99, 'Entrada do salão',
        '00000000-0000-4000-8000-0000000b0001', 0.2, 0.3);
insert into public.obras_ponto_foto (id, obra_id, numero, nome, ambiente_id)
values ('00000000-0000-4000-8000-0000000c0002', '00000000-0000-4000-8000-00000000a020', 99, 'Bancada da copa',
        '00000000-0000-4000-8000-0000000b0002');
insert into public.obras_ambiente_atividade (ambiente_id, atividade_numero)
values ('00000000-0000-4000-8000-0000000b0001', 1);

-- Obra B sem JWT (service role).
select pg_temp.jwt(null);
insert into public.obras_ambiente (id, obra_id, nome, x, y, w, h, criado_por)
values ('00000000-0000-4000-8000-0000000b0101', '00000000-0000-4000-8000-00000000a021', 'Área B', 0, 0, 1, 1, 'carga@teste.invalid');
insert into public.obras_ponto_foto (id, obra_id, numero, nome, ambiente_id)
values ('00000000-0000-4000-8000-0000000c0101', '00000000-0000-4000-8000-00000000a021', 7, 'Ponto B',
        '00000000-0000-4000-8000-0000000b0101');

insert into public.obras_rdo (id, obra_id, data, estado)
values ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-4000-8000-00000000a020', date '2026-11-02', 'rascunho'),
       ('00000000-0000-4000-8000-0000000d0002', '00000000-0000-4000-8000-00000000a020', date '2026-11-01', 'rascunho'),
       ('00000000-0000-4000-8000-0000000d0101', '00000000-0000-4000-8000-00000000a021', date '2026-11-02', 'rascunho');
insert into public.obras_rdo_foto (id, rdo_id, path, ambiente_id, ponto_id, atividade_numero)
values ('00000000-0000-4000-8000-0000000e0002', '00000000-0000-4000-8000-0000000d0002',
        '00000000-0000-4000-8000-00000000a020/rdo/2026-11-01/00000000-0000-4000-8000-0000000f0002.jpg',
        '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000c0001', 1);
update public.obras_rdo set estado = 'validado' where id = '00000000-0000-4000-8000-0000000d0002';

insert into storage.objects (bucket_id, name)
values ('obras-fotos', '00000000-0000-4000-8000-00000000a020/impedimento/33333333-3333-4333-8333-333333333333.jpg'),
       ('obras-fotos', '00000000-0000-4000-8000-00000000a020/mapa/44444444-4444-4444-8444-444444444444.png');

-- ============================================================
-- Autoria e número sequencial
-- ============================================================
select pg_temp.reg(1, 'mapa pelo engenheiro: criado_por = JWT e criado_em = now() (forjados ignorados)',
  'ok:croqui|t|t',
  (select 'ok:' || modo || '|' || pg_temp.tf(criado_por = 'eng.teste@teste.invalid') || '|' || pg_temp.tf(criado_em = now())
     from public.obras_mapa where obra_id = '00000000-0000-4000-8000-00000000a020'));

select pg_temp.reg(2, 'ambiente pelo engenheiro: criado_por = JWT e criado_em = now()',
  'ok:t|t',
  (select 'ok:' || pg_temp.tf(criado_por = 'eng.teste@teste.invalid') || '|' || pg_temp.tf(criado_em = now())
     from public.obras_ambiente where id = '00000000-0000-4000-8000-0000000b0001'));

select pg_temp.reg(3, 'pontos da obra A numerados pelo banco (99 enviado ignorado): P1 = 1, P2 = 2',
  'ok:1,2',
  (select 'ok:' || string_agg(numero::text, ',' order by numero) from public.obras_ponto_foto
    where obra_id = '00000000-0000-4000-8000-00000000a020'));

select pg_temp.reg(4, 'sequência é por obra: primeiro ponto da obra B = 1 (7 enviado ignorado, sem JWT)',
  'ok:1',
  (select 'ok:' || numero::text from public.obras_ponto_foto where id = '00000000-0000-4000-8000-0000000c0101'));

select pg_temp.reg(5, 'sem JWT (service role): criado_por enviado é mantido',
  'ok:carga@teste.invalid',
  (select 'ok:' || criado_por from public.obras_ambiente where id = '00000000-0000-4000-8000-0000000b0101'));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ponto_foto (obra_id, numero, nome, ambiente_id)
  values ('00000000-0000-4000-8000-00000000a020', 1, 'Terceiro', '00000000-0000-4000-8000-0000000b0001');
  raise exception 'ok:%', (select string_agg(numero::text, ',' order by numero) from public.obras_ponto_foto
                            where obra_id = '00000000-0000-4000-8000-00000000a020');
exception when others then
  perform pg_temp.reg(6, 'terceiro ponto da obra A (numero 1 enviado, já usado) recebe 3', 'ok:1,2,3', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_ponto_foto set numero = 5 where id = '00000000-0000-4000-8000-0000000c0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(7, 'numero do ponto é imutável', 'obra_id e numero do ponto são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_ponto_foto set ativo = false, criado_por = 'forjado@teste.invalid', criado_em = '2020-01-01'
   where id = '00000000-0000-4000-8000-0000000c0001';
  raise exception 'ok:%', (select pg_temp.tf(ativo) || '|' || criado_por || '|' || atualizado_por || '|' || pg_temp.tf(atualizado_em = now())
                             from public.obras_ponto_foto where id = '00000000-0000-4000-8000-0000000c0001');
exception when others then
  perform pg_temp.reg(8, 'engenheiro desativa ponto; autoria não muda, atualizado_por = JWT',
    'ok:f|eng.teste@teste.invalid|eng.teste@teste.invalid|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_mapa set modo = 'ambientes', criado_por = 'forjado@teste.invalid'
   where obra_id = '00000000-0000-4000-8000-00000000a020';
  raise exception 'ok:%', (select modo || '|' || criado_por || '|' || pg_temp.tf(atualizado_por = pg_temp.admin_email())
                             from public.obras_mapa where obra_id = '00000000-0000-4000-8000-00000000a020');
exception when others then
  perform pg_temp.reg(9, 'admin troca o modo do mapa; criado_por não muda', 'ok:ambientes|eng.teste@teste.invalid|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_ambiente set obra_id = '00000000-0000-4000-8000-00000000a021'
   where id = '00000000-0000-4000-8000-0000000b0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(10, 'obra_id do ambiente é imutável (nem o admin move de A para B)', 'obra_id do ambiente é imutável', sqlerrm);
end $$;

-- ============================================================
-- Review Focus 2 — supervisor não altera o mapa (triggers, JWT simulado)
-- ============================================================
do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome) values ('00000000-0000-4000-8000-00000000a020', 'Novo');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(11, 'supervisor cria ambiente: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  update public.obras_ambiente set nome = 'Trocado' where id = '00000000-0000-4000-8000-0000000b0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(12, 'supervisor renomeia ambiente: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  update public.obras_ambiente set x = 0.2 where id = '00000000-0000-4000-8000-0000000b0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(13, 'supervisor move o retângulo do ambiente: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  delete from public.obras_ambiente where id = '00000000-0000-4000-8000-0000000b0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(14, 'supervisor apaga ambiente: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  insert into public.obras_ponto_foto (obra_id, numero, nome, ambiente_id)
  values ('00000000-0000-4000-8000-00000000a020', 1, 'P', '00000000-0000-4000-8000-0000000b0001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(15, 'supervisor cria ponto: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  update public.obras_ponto_foto set ativo = false where id = '00000000-0000-4000-8000-0000000c0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(16, 'supervisor desativa ponto: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  delete from public.obras_ponto_foto where id = '00000000-0000-4000-8000-0000000c0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(17, 'supervisor apaga ponto: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  update public.obras_mapa set modo = 'planta' where obra_id = '00000000-0000-4000-8000-00000000a020';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(18, 'supervisor troca o modo do mapa: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  insert into public.obras_mapa (obra_id, modo) values ('00000000-0000-4000-8000-00000000a021', 'croqui');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(19, 'supervisor cria mapa (obra sem engenheiro): bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  delete from public.obras_mapa where obra_id = '00000000-0000-4000-8000-00000000a020';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(20, 'supervisor apaga o mapa: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  insert into public.obras_ambiente_atividade (ambiente_id, atividade_numero)
  values ('00000000-0000-4000-8000-0000000b0001', 2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(21, 'supervisor liga atividade ao ambiente: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  delete from public.obras_ambiente_atividade
   where ambiente_id = '00000000-0000-4000-8000-0000000b0001' and atividade_numero = 1;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(22, 'supervisor desliga atividade do ambiente: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome) values ('00000000-0000-4000-8000-00000000a021', 'Intruso');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(23, 'engenheiro da obra A cria ambiente na obra B: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_ambiente (obra_id, nome) values ('00000000-0000-4000-8000-00000000a021', 'Pelo admin');
  raise exception 'ok:%', (select pg_temp.tf(criado_por = pg_temp.admin_email()) from public.obras_ambiente
                            where obra_id = '00000000-0000-4000-8000-00000000a021' and nome = 'Pelo admin');
exception when others then
  perform pg_temp.reg(24, 'administrador cria ambiente em obra sem engenheiro', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente_atividade (ambiente_id, atividade_numero)
  values ('00000000-0000-4000-8000-0000000b0001', 2), ('00000000-0000-4000-8000-0000000b0002', 2);
  raise exception 'ok:%', (select count(*) from public.obras_ambiente_atividade where atividade_numero = 2
                             and ambiente_id in ('00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000b0002'));
exception when others then
  perform pg_temp.reg(25, 'engenheiro liga a mesma atividade a dois ambientes (N:N)', 'ok:2', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_ambiente_atividade set atividade_numero = 3
   where ambiente_id = '00000000-0000-4000-8000-0000000b0001' and atividade_numero = 1;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(26, 'ligação ambiente × atividade não se altera (nem pelo engenheiro)', 'não se altera', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente_atividade (ambiente_id, atividade_numero)
  values ('00000000-0000-4000-8000-0000000b0001', 0);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(27, 'ligação com atividade_numero 0: recusada', 'obras_ambiente_atividade_numero_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente_atividade (ambiente_id, atividade_numero)
  values ('00000000-0000-4000-8000-0000000b0101', 5);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(28, 'engenheiro de A liga atividade a ambiente da obra B: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

-- ============================================================
-- RLS de verdade (role authenticated / anon)
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%|%|%|%',
    (select count(*) from public.obras_mapa where obra_id = '00000000-0000-4000-8000-00000000a020'),
    (select count(*) from public.obras_ambiente where obra_id = '00000000-0000-4000-8000-00000000a020'),
    (select count(*) from public.obras_ponto_foto where obra_id = '00000000-0000-4000-8000-00000000a020'),
    (select count(*) from public.obras_ambiente_atividade where ambiente_id = '00000000-0000-4000-8000-0000000b0001');
exception when others then
  perform pg_temp.reg(29, 'supervisor (authenticated) LÊ mapa, ambientes, pontos e ligações', 'ok:1|2|2|1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome) values ('00000000-0000-4000-8000-00000000a020', 'Via RLS');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(30, 'supervisor (authenticated) cria ambiente: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_ponto_foto set nome = 'Via RLS' where id = '00000000-0000-4000-8000-0000000c0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(31, 'supervisor (authenticated) renomeia ponto: bloqueado', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome, x, y, w, h)
  values ('00000000-0000-4000-8000-00000000a020', 'Via RLS', 0, 0, 1, 1);
  get diagnostics v = row_count;
  raise exception 'ok:%|%', v, (select criado_por from public.obras_ambiente where nome = 'Via RLS'
                                  and obra_id = '00000000-0000-4000-8000-00000000a020');
exception when others then
  perform pg_temp.reg(32, 'engenheiro (authenticated) cria ambiente cobrindo o quadro inteiro (0,0,1,1)',
    'ok:1|eng.teste@teste.invalid', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%|%|%|%',
    (select count(*) from public.obras_mapa),
    (select count(*) from public.obras_ambiente),
    (select count(*) from public.obras_ponto_foto),
    (select count(*) from public.obras_ambiente_atividade);
exception when others then
  perform pg_temp.reg(33, 'authenticated sem acesso ao Obras não lê nada das 4 tabelas', 'ok:0|0|0|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome) values ('00000000-0000-4000-8000-00000000a020', 'X');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(34, 'authenticated sem acesso cria ambiente: bloqueado (trigger antes da RLS)', 'só o engenheiro da obra ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_ambiente;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(35, 'anon não lê obras_ambiente', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_ponto_foto;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(36, 'anon não lê obras_ponto_foto', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  update public.obras_ambiente_atividade set atividade_numero = 9
   where ambiente_id = '00000000-0000-4000-8000-0000000b0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(37, 'authenticated sem privilégio de UPDATE em obras_ambiente_atividade', 'permission denied', sqlerrm);
end $$;

-- ============================================================
-- Coordenadas e checks
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome, x, y, w, h)
  values ('00000000-0000-4000-8000-00000000a020', 'Estoura', 0.6, 0.1, 0.5, 0.2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(38, 'ambiente com x + w > 1: recusado', 'obras_ambiente_retangulo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome, x, y, w, h)
  values ('00000000-0000-4000-8000-00000000a020', 'Estoura', 0.1, 0.7, 0.2, 0.31);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(39, 'ambiente com y + h > 1: recusado', 'obras_ambiente_retangulo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome, x, y, w, h)
  values ('00000000-0000-4000-8000-00000000a020', 'Negativo', -0.1, 0.1, 0.2, 0.2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(40, 'ambiente com x negativo: recusado', 'obras_ambiente_retangulo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome, x, y, w, h)
  values ('00000000-0000-4000-8000-00000000a020', 'Sem largura', 0.1, 0.1, 0, 0.2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(41, 'ambiente com w = 0: recusado', 'obras_ambiente_retangulo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome, x, y, w, h)
  values ('00000000-0000-4000-8000-00000000a020', 'Meio', 0.1, 0.1, null, null);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(42, 'ambiente com retângulo pela metade (w, h nulos): recusado', 'obras_ambiente_retangulo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_ambiente set w = 0.95 where id = '00000000-0000-4000-8000-0000000b0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(43, 'arrastar ambiente para fora do quadro (update x + w > 1): recusado', 'obras_ambiente_retangulo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome) values ('00000000-0000-4000-8000-00000000a020', '   ');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(44, 'ambiente com nome só de espaços: recusado', 'obras_ambiente_nome_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente (obra_id, nome, area_m2) values ('00000000-0000-4000-8000-00000000a020', 'Área zero', 0);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(45, 'ambiente com area_m2 = 0: recusado', 'obras_ambiente_area_check', sqlerrm);
end $$;

select pg_temp.reg(46, 'ambiente sem coordenadas (modo ambientes) existe: A2 com x,y,w,h nulos',
  'ok:t',
  (select 'ok:' || pg_temp.tf(x is null and y is null and w is null and h is null)
     from public.obras_ambiente where id = '00000000-0000-4000-8000-0000000b0002'));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ponto_foto (obra_id, numero, nome, ambiente_id, x, y)
  values ('00000000-0000-4000-8000-00000000a020', 1, 'Fora', '00000000-0000-4000-8000-0000000b0001', 1.5, 0.2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(47, 'ponto com x = 1,5: recusado', 'obras_ponto_foto_posicao_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ponto_foto (obra_id, numero, nome, ambiente_id, x, y)
  values ('00000000-0000-4000-8000-00000000a020', 1, 'Meio', '00000000-0000-4000-8000-0000000b0001', 0.2, null);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(48, 'ponto com só x preenchido: recusado', 'obras_ponto_foto_posicao_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ponto_foto (obra_id, numero, nome, ambiente_id)
  values ('00000000-0000-4000-8000-00000000a020', 1, 'Ponto em B', '00000000-0000-4000-8000-0000000b0101');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(49, 'ponto da obra A num ambiente da obra B: recusado', 'o ambiente do ponto não é desta obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_ponto_foto (obra_id, numero, nome, ambiente_id)
  values ('00000000-0000-4000-8000-00000000a021', 1, 'Ponto B em A', '00000000-0000-4000-8000-0000000b0001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(50, 'mesmo sem JWT: ponto num ambiente de outra obra recusado', 'o ambiente do ponto não é desta obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_mapa set modo = 'satelite' where obra_id = '00000000-0000-4000-8000-00000000a020';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(51, 'modo do mapa fora de planta|croqui|ambientes: recusado', 'obras_mapa_modo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_mapa
     set modo = 'planta', planta_path = '00000000-0000-4000-8000-00000000a020/mapa/55555555-5555-4555-8555-555555555555.png',
         planta_largura = 2000, planta_altura = 1400
   where obra_id = '00000000-0000-4000-8000-00000000a020';
  raise exception 'ok:%', (select modo || '|' || planta_largura || 'x' || planta_altura from public.obras_mapa
                            where obra_id = '00000000-0000-4000-8000-00000000a020');
exception when others then
  perform pg_temp.reg(52, 'planta no caminho canônico <obra>/mapa/<uuid>.png: aceita', 'ok:planta|2000x1400', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_mapa set planta_path = '00000000-0000-4000-8000-00000000a021/mapa/55555555-5555-4555-8555-555555555555.png'
   where obra_id = '00000000-0000-4000-8000-00000000a020';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(53, 'planta apontando para o prefixo de outra obra: recusada', 'obras_mapa_planta_path_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_mapa set planta_path = '00000000-0000-4000-8000-00000000a020/mapa/55555555-5555-4555-8555-555555555555.gif'
   where obra_id = '00000000-0000-4000-8000-00000000a020';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(54, 'planta com extensão .gif: recusada', 'obras_mapa_planta_path_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_mapa set planta_path = '00000000-0000-4000-8000-00000000a020/mapa/../rdo/x.png'
   where obra_id = '00000000-0000-4000-8000-00000000a020';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(55, 'planta com ../ e nome fora do formato: recusada', 'obras_mapa_planta_path_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_mapa set planta_largura = 2000, planta_altura = null
   where obra_id = '00000000-0000-4000-8000-00000000a020';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(56, 'planta com largura e sem altura: recusada', 'obras_mapa_planta_dimensoes_check', sqlerrm);
end $$;

-- ============================================================
-- Review Focus 1 e 2 — fotos ligadas ao mapa
-- ============================================================
do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_rdo_foto (rdo_id, path, ambiente_id, ponto_id, atividade_numero)
  values ('00000000-0000-4000-8000-0000000d0001',
          '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0101.jpg',
          '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000c0001', 3);
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(57, 'supervisor (authenticated) tira foto ligada a ambiente, ponto e atividade', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_rdo_foto (rdo_id, path, ambiente_id)
  values ('00000000-0000-4000-8000-0000000d0001',
          '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0102.jpg',
          '00000000-0000-4000-8000-0000000b0101');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(58, 'foto do RDO da obra A com ambiente da obra B: recusada', 'o ambiente da foto não é da obra do RDO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_rdo_foto (rdo_id, path, ponto_id)
  values ('00000000-0000-4000-8000-0000000d0001',
          '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0103.jpg',
          '00000000-0000-4000-8000-0000000c0101');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(59, 'foto do RDO da obra A com ponto da obra B: recusada', 'o ponto da foto não é da obra do RDO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_rdo_foto (rdo_id, path, ambiente_id, ponto_id)
  values ('00000000-0000-4000-8000-0000000d0101',
          '00000000-0000-4000-8000-00000000a021/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0104.jpg',
          '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000c0001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(60, 'mesmo sem JWT: foto do RDO da obra B com ambiente/ponto da obra A recusada', 'não é da obra do RDO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_rdo_foto (rdo_id, path, ambiente_id, ponto_id)
  values ('00000000-0000-4000-8000-0000000d0001',
          '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0105.jpg',
          '00000000-0000-4000-8000-0000000b0001', '00000000-0000-4000-8000-0000000c0002');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(61, 'foto com ponto P2 (Copa) e ambiente A1 (Salão): recusada', 'o ponto da foto não é do ambiente informado', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_rdo_foto (rdo_id, path, ponto_id)
  values ('00000000-0000-4000-8000-0000000d0001',
          '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0106.jpg',
          '00000000-0000-4000-8000-0000000c0002');
  insert into public.obras_rdo_foto (rdo_id, path)
  values ('00000000-0000-4000-8000-0000000d0001',
          '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0107.jpg');
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(62, 'foto só com ponto e foto sem vínculo nenhum (como hoje): aceitas', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_rdo_foto (rdo_id, path, atividade_numero)
  values ('00000000-0000-4000-8000-0000000d0001',
          '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0108.jpg', 0);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(63, 'foto com atividade_numero 0: recusada', 'obras_rdo_foto_atividade_numero_check', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.jwt(null);
  insert into public.obras_rdo_foto (id, rdo_id, path, ambiente_id)
  values ('00000000-0000-4000-8000-0000000e0101', '00000000-0000-4000-8000-0000000d0001',
          '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0109.jpg',
          '00000000-0000-4000-8000-0000000b0001');
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_rdo_foto
     set ambiente_id = '00000000-0000-4000-8000-0000000b0002', ponto_id = '00000000-0000-4000-8000-0000000c0002'
   where id = '00000000-0000-4000-8000-0000000e0101';
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(64, 'supervisor (authenticated) muda ambiente/ponto de foto em RDO rascunho', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_rdo_foto (id, rdo_id, path)
  values ('00000000-0000-4000-8000-0000000e0102', '00000000-0000-4000-8000-0000000d0001',
          '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0110.jpg');
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_rdo_foto set ponto_id = '00000000-0000-4000-8000-0000000c0101'
   where id = '00000000-0000-4000-8000-0000000e0102';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(65, 'update de foto em rascunho para ponto da obra B: recusado', 'o ponto da foto não é da obra do RDO', sqlerrm);
end $$;

-- Foto congelada (RV validado)
do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo_foto set ambiente_id = '00000000-0000-4000-8000-0000000b0002', ponto_id = null
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(66, 'foto de RDO validado: trocar ambiente recusado mesmo sem JWT', 'OBRAS_FOTO_CONGELADA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo_foto set ponto_id = null where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(67, 'foto de RDO validado: tirar o ponto recusado', 'OBRAS_FOTO_CONGELADA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_rdo_foto set atividade_numero = 2 where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(68, 'foto de RDO validado: admin troca a atividade, recusado', 'OBRAS_FOTO_CONGELADA', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  update public.obras_rdo_foto set ambiente_id = null where id = '00000000-0000-4000-8000-0000000e0002';
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(69, 'foto de RDO validado: engenheiro (authenticated) não altera, RLS de hoje dá 0 linhas', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo set estado = 'enviado' where id = '00000000-0000-4000-8000-0000000d0002';
  update public.obras_rdo_foto set ponto_id = '00000000-0000-4000-8000-0000000c0002'
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(70, 'foto de RDO enviado: trocar o ponto recusado', 'OBRAS_FOTO_CONGELADA', sqlerrm);
end $$;

-- ============================================================
-- Review Focus 1 — impedimento ligado ao mapa
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_impedimento (obra_id, categoria, responsavel, descricao, exibir_ao_cliente, aberto_em, ambiente_id)
  values ('00000000-0000-4000-8000-00000000a020', 'impedimento', 'cliente', 'Área B no impedimento A', false,
          date '2026-11-02', '00000000-0000-4000-8000-0000000b0101');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(71, 'impedimento da obra A com ambiente da obra B: recusado', 'o ambiente do impedimento não é desta obra', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_impedimento (obra_id, categoria, responsavel, descricao, exibir_ao_cliente, aberto_em, ambiente_id)
  values ('00000000-0000-4000-8000-00000000a020', 'impedimento', 'cliente', 'Salão sem liberação', false,
          date '2026-11-02', '00000000-0000-4000-8000-0000000b0001');
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(72, 'supervisor (authenticated) registra impedimento no ambiente da própria obra', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_impedimento (id, obra_id, categoria, responsavel, descricao, exibir_ao_cliente, aberto_em)
  values ('00000000-0000-4000-8000-0000000a6001', '00000000-0000-4000-8000-00000000a020', 'impedimento', 'cliente',
          'Sem ambiente', false, date '2026-11-02');
  update public.obras_impedimento set ambiente_id = '00000000-0000-4000-8000-0000000b0101'
   where id = '00000000-0000-4000-8000-0000000a6001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(73, 'update do impedimento para ambiente da obra B: recusado (sem JWT também)', 'o ambiente do impedimento não é desta obra', sqlerrm);
end $$;

-- ============================================================
-- Apagar: ambiente/ponto com foto ou impedimento recusado; ponto sem foto cai
-- em cascata com o ambiente; obra apagada leva tudo junto.
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_ambiente where id = '00000000-0000-4000-8000-0000000b0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(74, 'engenheiro apaga ambiente com foto: recusado (FK)', 'violates foreign key constraint "obras_rdo_foto_', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_ponto_foto where id = '00000000-0000-4000-8000-0000000c0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(75, 'engenheiro apaga ponto com foto: recusado (desativar em vez de apagar)', 'obras_rdo_foto_ponto_id_fkey', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_ambiente (id, obra_id, nome)
  values ('00000000-0000-4000-8000-0000000b0003', '00000000-0000-4000-8000-00000000a020', 'Depósito');
  insert into public.obras_impedimento (obra_id, categoria, responsavel, descricao, exibir_ao_cliente, aberto_em, ambiente_id)
  values ('00000000-0000-4000-8000-00000000a020', 'impedimento', 'cliente', 'Depósito trancado', false,
          date '2026-11-02', '00000000-0000-4000-8000-0000000b0003');
  delete from public.obras_ambiente where id = '00000000-0000-4000-8000-0000000b0003';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(76, 'engenheiro apaga ambiente com impedimento: recusado (FK)', 'obras_impedimento_ambiente_id_fkey', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_ambiente where id = '00000000-0000-4000-8000-0000000b0002';
  raise exception 'ok:%|%',
    (select count(*) from public.obras_ponto_foto where id = '00000000-0000-4000-8000-0000000c0002'),
    (select count(*) from public.obras_ambiente_atividade where ambiente_id = '00000000-0000-4000-8000-0000000b0002');
exception when others then
  perform pg_temp.reg(77, 'engenheiro apaga ambiente sem foto: o ponto sem foto cai junto', 'ok:0|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_ponto_foto set ambiente_id = '00000000-0000-4000-8000-0000000b0002'
   where id = '00000000-0000-4000-8000-0000000c0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(78, 'ponto com foto não muda de ambiente', 'ponto com foto não muda de ambiente', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_ponto_foto set ambiente_id = '00000000-0000-4000-8000-0000000b0001', x = 0.5, y = 0.5
   where id = '00000000-0000-4000-8000-0000000c0002';
  raise exception 'ok:%', (select ambiente_id::text from public.obras_ponto_foto where id = '00000000-0000-4000-8000-0000000c0002');
exception when others then
  perform pg_temp.reg(79, 'ponto sem foto muda de ambiente (mesma obra)', 'ok:00000000-0000-4000-8000-0000000b0001', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_ponto_foto set ambiente_id = '00000000-0000-4000-8000-0000000b0101'
   where id = '00000000-0000-4000-8000-0000000c0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(80, 'ponto movido para ambiente de outra obra: recusado', 'o ambiente do ponto não é desta obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_rdo_foto (rdo_id, path, ambiente_id, ponto_id)
  values ('00000000-0000-4000-8000-0000000d0101',
          '00000000-0000-4000-8000-00000000a021/rdo/2026-11-02/00000000-0000-4000-8000-0000000f0201.jpg',
          '00000000-0000-4000-8000-0000000b0101', '00000000-0000-4000-8000-0000000c0101');
  insert into public.obras_mapa (obra_id, modo) values ('00000000-0000-4000-8000-00000000a021', 'croqui');
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a021';
  raise exception 'ok:%|%|%',
    (select count(*) from public.obras_ambiente where obra_id = '00000000-0000-4000-8000-00000000a021'),
    (select count(*) from public.obras_ponto_foto where obra_id = '00000000-0000-4000-8000-00000000a021'),
    (select count(*) from public.obras_mapa where obra_id = '00000000-0000-4000-8000-00000000a021');
exception when others then
  perform pg_temp.reg(81, 'apagar a obra (sem JWT) com foto ligada a ambiente/ponto: cascata passa', 'ok:0|0|0', sqlerrm);
end $$;

-- ============================================================
-- Storage: planta em <obra>/mapa/<uuid>.(jpg|jpeg|png|webp)
-- ============================================================
do $$
declare a text; b text; c text; d text; e text; f text; g text;
begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  a := pg_temp.tf(public.obras_mapa_pode_escrever('00000000-0000-4000-8000-00000000a020/mapa/66666666-6666-4666-8666-666666666666.webp'));
  b := pg_temp.tf(public.obras_mapa_pode_escrever('00000000-0000-4000-8000-00000000a021/mapa/66666666-6666-4666-8666-666666666666.webp'));
  c := pg_temp.tf(public.obras_mapa_pode_escrever('00000000-0000-4000-8000-00000000a020/mapa/planta.png'));
  d := pg_temp.tf(public.obras_mapa_pode_escrever('00000000-0000-4000-8000-00000000a020/mapa/66666666-6666-4666-8666-666666666666.PNG'));
  e := pg_temp.tf(public.obras_mapa_pode_escrever(null));
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  f := pg_temp.tf(public.obras_mapa_pode_escrever('00000000-0000-4000-8000-00000000a020/mapa/66666666-6666-4666-8666-666666666666.jpg'));
  perform pg_temp.jwt(pg_temp.admin_email());
  g := pg_temp.tf(public.obras_mapa_pode_escrever('00000000-0000-4000-8000-0000000000ff/mapa/66666666-6666-4666-8666-666666666666.jpeg'));
  raise exception 'ok:%|%|%|%|%|%|%', a, b, c, d, e, f, g;
exception when others then
  perform pg_temp.reg(82, 'obras_mapa_pode_escrever: eng A / eng em B / nome livre / .PNG / NULL / supervisor / admin obra inexistente',
    'ok:t|f|f|f|f|f|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-fotos', '00000000-0000-4000-8000-00000000a020/mapa/77777777-7777-4777-8777-777777777777.jpg');
  raise exception 'ok:inseriu';
exception when others then
  perform pg_temp.reg(83, 'engenheiro (authenticated) sobe a planta no caminho canônico da obra A', 'ok:inseriu', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-fotos', '00000000-0000-4000-8000-00000000a020/mapa/77777777-7777-4777-8777-777777777777.jpg');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(84, 'supervisor sobe planta: bloqueado', 'row-level security', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-fotos', '00000000-0000-4000-8000-00000000a021/mapa/77777777-7777-4777-8777-777777777777.jpg');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(85, 'engenheiro de A sobe planta no prefixo da obra B: bloqueado', 'row-level security', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-fotos', '00000000-0000-4000-8000-00000000a020/mapa/planta-final.pdf');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(86, 'engenheiro sobe em /mapa/ fora do formato <uuid>.(jpg|jpeg|png|webp): bloqueado', 'row-level security', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-fotos', '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/88888888-8888-4888-8888-888888888888.jpg');
  raise exception 'ok:inseriu';
exception when others then
  perform pg_temp.reg(87, 'supervisor continua subindo foto do diário (fora de /mapa/)', 'ok:inseriu', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  update storage.objects set name = '00000000-0000-4000-8000-00000000a020/mapa/99999999-9999-4999-8999-999999999999.png'
   where bucket_id = 'obras-fotos' and name = '00000000-0000-4000-8000-00000000a020/mapa/44444444-4444-4444-8444-444444444444.png';
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(88, 'engenheiro sobrescreve/move a planta (update em /mapa/): 0 linhas', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  update storage.objects set name = '00000000-0000-4000-8000-00000000a020/mapa/99999999-9999-4999-8999-999999999999.jpg'
   where bucket_id = 'obras-fotos' and name = '00000000-0000-4000-8000-00000000a020/impedimento/33333333-3333-4333-8333-333333333333.jpg';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(89, 'mover objeto de fora para dentro de /mapa/: bloqueado (with check)', 'row-level security', sqlerrm);
end $$;

do $$
declare v int;
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update storage.objects set name = '00000000-0000-4000-8000-00000000a020/impedimento/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'
   where bucket_id = 'obras-fotos' and name = '00000000-0000-4000-8000-00000000a020/impedimento/33333333-3333-4333-8333-333333333333.jpg';
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(90, 'update fora de /rdo/ e /mapa/ continua como antes (supervisor renomeia foto de impedimento)', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) from storage.objects where bucket_id = 'obras-fotos'
                             and name = '00000000-0000-4000-8000-00000000a020/mapa/44444444-4444-4444-8444-444444444444.png');
exception when others then
  perform pg_temp.reg(91, 'supervisor (acesso ao Obras) lê a planta', 'ok:1', sqlerrm);
end $$;

do $$
declare v int;
begin
  -- A Storage API liga esta flag; sem ela o trigger protect_objects_delete recusa tudo.
  perform set_config('storage.allow_delete_query', 'true', true);
  perform pg_temp.como('authenticated', 'eng.teste@teste.invalid');
  delete from storage.objects where bucket_id = 'obras-fotos'
     and name = '00000000-0000-4000-8000-00000000a020/mapa/44444444-4444-4444-8444-444444444444.png';
  get diagnostics v = row_count;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(92, 'planta não se apaga pelo navegador (delete só em /rdo/): 0 linhas', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  insert into storage.objects (bucket_id, name)
  values ('obras-fotos', '00000000-0000-4000-8000-00000000a020/rdo/2026-11-02/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(93, 'authenticated sem acesso ao Obras não sobe nada em obras-fotos', 'row-level security', sqlerrm);
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
  if v_total <> 93 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 93 testes rodaram';
  end if;
  raise exception 'RESUMO: %/93 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
