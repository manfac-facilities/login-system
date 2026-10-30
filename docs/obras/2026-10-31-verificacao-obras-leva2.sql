-- ============================================================
-- Teste de comportamento de sdd-sql-obras-leva2.sql
-- Rodar DEPOIS de aplicar a migration, no SQL Editor, projeto iyytcavcgukfjnjjrerx.
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
-- e cada teste que tem de PASSAR termina com raise exception 'OK_SEM_ERRO...'
-- (desfaz o que ele fez). Booleanos aparecem como t/f no texto.
-- Roda como postgres (acima da RLS): testa os TRIGGERS, checks e índices.
-- A RLS em si (obras_has_access) é conferida só estruturalmente (verificação
-- da migration); o JWT é simulado por set_config('request.jwt.claims').
--
-- Fixture (só dentro da transação): obra TESTE-VERIF-LEVA2 (SPOT), dois
-- registros do autor (um novo, um com criado_em 25 h atrás). "Administrador"
-- = o primeiro e-mail com nivel 'administrador' em hub_user_roles.
-- ============================================================

begin;

create temp table _v (n int, teste text, esperado text, obtido text) on commit drop;

create function pg_temp.jwt(p_email text) returns void language sql as $$
  select set_config('request.jwt.claims',
                    case when p_email is null then '' else json_build_object('email', p_email)::text end,
                    true);
$$;

create function pg_temp.reg(p_n int, p_teste text, p_esperado text, p_obtido text) returns void language sql as $$
  insert into _v values (p_n, p_teste, p_esperado, p_obtido);
$$;

create function pg_temp.admin_email() returns text language sql as $$
  select user_email from public.hub_user_roles where nivel = 'administrador' order by user_email limit 1;
$$;

select pg_temp.jwt(null);

insert into public.obras_obra (id, os, modalidade)
values ('00000000-0000-4000-8000-00000000a005', 'TESTE-VERIF-LEVA2', 'spot');

-- R1: criado pelo autor COM JWT tentando falsificar criado_por
select pg_temp.jwt('autor.teste@teste.invalid');
insert into public.obras_registro (id, obra_id, tipo, texto, criado_por)
values ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-00000000a005', 'reuniao', 'r1', 'falsificado@teste.invalid');
select pg_temp.jwt(null);

-- R2: do mesmo autor, criado há 25 h (fixture sem JWT)
insert into public.obras_registro (id, obra_id, tipo, texto, criado_por, criado_em)
values ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000a005', 'ligacao', 'r2',
        'autor.teste@teste.invalid', now() - interval '25 hours');

-- ============================================================
-- obras_registro: autoria e janela de edição
-- ============================================================
select pg_temp.reg(1, 'sem JWT o criado_por informado fica (fixture R2)', 'autor.teste@teste.invalid',
  (select criado_por from public.obras_registro where id = '00000000-0000-4000-8000-00000000d002'));

select pg_temp.reg(2, 'com JWT criado_por vira o e-mail da sessão (não falsificável)', 'autor.teste@teste.invalid',
  (select criado_por from public.obras_registro where id = '00000000-0000-4000-8000-00000000d001'));

do $$ begin
  perform pg_temp.jwt('autor.teste@teste.invalid');
  update public.obras_registro set texto = 'editado', criado_por = 'outro@teste.invalid',
         criado_em = now() - interval '5 days'
   where id = '00000000-0000-4000-8000-00000000d001';
  raise exception 'ok:%|%|%', (select (editado_em is not null)::text from public.obras_registro where id = '00000000-0000-4000-8000-00000000d001'),
    (select criado_por from public.obras_registro where id = '00000000-0000-4000-8000-00000000d001'),
    (select (criado_em > now() - interval '1 hour')::text from public.obras_registro where id = '00000000-0000-4000-8000-00000000d001');
exception when others then
  perform pg_temp.reg(3, 'autor edita dentro de 24 h: passa, editado_em preenchido, autoria e criado_em intactos',
    'ok:true|autor.teste@teste.invalid|true', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  update public.obras_registro set texto = 'x' where id = '00000000-0000-4000-8000-00000000d001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(4, 'outro usuário (não admin) edita registro alheio: bloqueado', 'OBRAS_REGISTRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  delete from public.obras_registro where id = '00000000-0000-4000-8000-00000000d001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(5, 'outro usuário (não admin) apaga registro alheio: bloqueado', 'OBRAS_REGISTRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('autor.teste@teste.invalid');
  update public.obras_registro set texto = 'x' where id = '00000000-0000-4000-8000-00000000d002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(6, 'autor edita depois de 24 h: bloqueado', 'OBRAS_REGISTRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('autor.teste@teste.invalid');
  delete from public.obras_registro where id = '00000000-0000-4000-8000-00000000d002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(7, 'autor apaga depois de 24 h: bloqueado', 'OBRAS_REGISTRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_registro set texto = 'admin' where id = '00000000-0000-4000-8000-00000000d002';
  raise exception 'ok:%', (select texto from public.obras_registro where id = '00000000-0000-4000-8000-00000000d002');
exception when others then
  perform pg_temp.reg(8, 'administrador edita depois de 24 h: passa', 'ok:admin', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  delete from public.obras_registro where id = '00000000-0000-4000-8000-00000000d002';
  raise exception 'ok:%', (select count(*) from public.obras_registro where id = '00000000-0000-4000-8000-00000000d002');
exception when others then
  perform pg_temp.reg(9, 'administrador apaga depois de 24 h: passa', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('autor.teste@teste.invalid');
  delete from public.obras_registro where id = '00000000-0000-4000-8000-00000000d001';
  raise exception 'ok:%', (select count(*) from public.obras_registro where id = '00000000-0000-4000-8000-00000000d001');
exception when others then
  perform pg_temp.reg(10, 'autor apaga dentro de 24 h: passa', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_registro set texto = 'service' where id = '00000000-0000-4000-8000-00000000d002';
  delete from public.obras_registro where id = '00000000-0000-4000-8000-00000000d002';
  raise exception 'ok:%', (select count(*) from public.obras_registro where id = '00000000-0000-4000-8000-00000000d002');
exception when others then
  perform pg_temp.reg(11, 'sem JWT (service role/SQL Editor) edita e apaga fora da janela: passa', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_registro (obra_id, tipo) values ('00000000-0000-4000-8000-00000000a005', 'palestra');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(12, 'tipo de registro inválido: check', 'obras_registro_tipo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_registro (obra_id, tipo, nivel) values ('00000000-0000-4000-8000-00000000a005', 'imediata', 'critico');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(13, 'nivel inválido: check', 'obras_registro_nivel_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_registro (obra_id, tipo, nivel, ata, atividade_numero)
  values ('00000000-0000-4000-8000-00000000a005', 'imediata', 'urgente', '{"pauta":"x","decisoes":[],"pendencias":[]}'::jsonb, 3);
  raise exception 'OK_SEM_ERRO';
exception when others then
  perform pg_temp.reg(14, 'registro imediata/urgente com ata jsonb e atividade_numero: passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $ begin
  perform pg_temp.jwt('autor.teste@teste.invalid');
  insert into public.obras_registro (id, obra_id, tipo, criado_em, editado_em)
  values ('00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-00000000a005', 'visita',
          timestamptz '2100-01-01', timestamptz '2100-01-01');
  raise exception 'ok:%|%',
    (select (criado_em = now())::text from public.obras_registro where id = '00000000-0000-4000-8000-00000000d004'),
    (select (editado_em is null)::text from public.obras_registro where id = '00000000-0000-4000-8000-00000000d004');
exception when others then
  perform pg_temp.reg(33, 'com JWT, criado_em/editado_em enviados no INSERT são ignorados (janela de 24 h não burlável)', 'ok:true|true', sqlerrm);
end $;

-- ============================================================
-- obras_envio: tipos e registro_id
-- ============================================================
do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a005', 'ata', 'cliente', 'ok');
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a005', 'imediata', 'cliente', 'ok');
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a005', 'diario', 'cliente', 'ok');
  raise exception 'OK_SEM_ERRO';
exception when others then
  perform pg_temp.reg(15, 'envio aceita tipo ata, imediata e diario', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a005', 'relatorio', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(16, 'envio com tipo fora da lista: check', 'obras_envio_tipo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_registro (id, obra_id, tipo) values ('00000000-0000-4000-8000-00000000d003', '00000000-0000-4000-8000-00000000a005', 'reuniao');
  insert into public.obras_envio (id, obra_id, tipo, registro_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000a005', 'ata', '00000000-0000-4000-8000-00000000d003', 'cliente', 'ok');
  raise exception 'ok:%', (select registro_id::text from public.obras_envio where id = '00000000-0000-4000-8000-00000000e001');
exception when others then
  perform pg_temp.reg(17, 'envio guarda registro_id', 'ok:00000000-0000-4000-8000-00000000d003', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_registro (id, obra_id, tipo) values ('00000000-0000-4000-8000-00000000d003', '00000000-0000-4000-8000-00000000a005', 'reuniao');
  insert into public.obras_envio (id, obra_id, tipo, registro_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000a005', 'ata', '00000000-0000-4000-8000-00000000d003', 'cliente', 'ok');
  delete from public.obras_registro where id = '00000000-0000-4000-8000-00000000d003';
  raise exception 'ok:%', (select (registro_id is null)::text from public.obras_envio where id = '00000000-0000-4000-8000-00000000e001');
exception when others then
  perform pg_temp.reg(18, 'apagar o registro não apaga o envio (registro_id vira nulo)', 'ok:true', sqlerrm);
end $$;

-- ============================================================
-- obras_obra.peso_avanco e guarda de parâmetros
-- ============================================================
do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_obra set peso_avanco = 'valor' where id = '00000000-0000-4000-8000-00000000a005';
  update public.obras_obra set peso_avanco = 'duracao' where id = '00000000-0000-4000-8000-00000000a005';
  update public.obras_obra set peso_avanco = null where id = '00000000-0000-4000-8000-00000000a005';
  raise exception 'OK_SEM_ERRO';
exception when others then
  perform pg_temp.reg(19, 'sem JWT: peso_avanco aceita valor, duracao e nulo', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_obra set peso_avanco = 'area' where id = '00000000-0000-4000-8000-00000000a005';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(20, 'peso_avanco inválido: check', 'peso_avanco_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  update public.obras_obra set peso_avanco = 'valor' where id = '00000000-0000-4000-8000-00000000a005';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(21, 'usuário comum altera peso_avanco: bloqueado', 'OBRAS_PARAMETROS', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_obra set peso_avanco = 'duracao' where id = '00000000-0000-4000-8000-00000000a005';
  raise exception 'ok:%', (select peso_avanco from public.obras_obra where id = '00000000-0000-4000-8000-00000000a005');
exception when others then
  perform pg_temp.reg(22, 'administrador altera peso_avanco: passa', 'ok:duracao', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  update public.obras_obra set cliente = 'Cliente Teste' where id = '00000000-0000-4000-8000-00000000a005';
  raise exception 'OK_SEM_ERRO';
exception when others then
  perform pg_temp.reg(23, 'usuário comum altera coluna comum (cliente): a guarda não dispara', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  insert into public.obras_obra (os, modalidade, peso_avanco) values ('TESTE-VERIF-LEVA2-B', 'spot', 'valor');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(24, 'usuário comum cria obra já com peso_avanco: bloqueado', 'OBRAS_PARAMETROS', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  update public.obras_obra set modalidade = 'obra' where id = '00000000-0000-4000-8000-00000000a005';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(25, 'guarda antiga segue valendo: usuário comum não muda modalidade', 'OBRAS_PARAMETROS', sqlerrm);
end $$;

-- ============================================================
-- obras_feriado.obra_id e unicidade
-- ============================================================
do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_feriado (data, descricao, abrangencia) values ('2031-05-01', 'global teste', 'nacional');
  insert into public.obras_feriado (data, descricao, abrangencia) values ('2031-05-01', 'global duplicado', 'nacional');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(26, 'dois feriados globais na mesma data: unique', 'obras_feriado_obra_data_uniq', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_feriado (data, descricao, abrangencia) values ('2031-05-01', 'global teste', 'nacional');
  insert into public.obras_feriado (data, descricao, abrangencia, obra_id)
  values ('2031-05-01', 'da obra', 'municipal', '00000000-0000-4000-8000-00000000a005');
  raise exception 'ok:%', (select count(*) from public.obras_feriado where data = '2031-05-01');
exception when others then
  perform pg_temp.reg(27, 'feriado global e feriado da obra na mesma data convivem', 'ok:2', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_feriado (data, descricao, abrangencia, obra_id)
  values ('2031-05-02', 'da obra', 'municipal', '00000000-0000-4000-8000-00000000a005');
  insert into public.obras_feriado (data, descricao, abrangencia, obra_id)
  values ('2031-05-02', 'da obra duplicado', 'municipal', '00000000-0000-4000-8000-00000000a005');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(28, 'dois feriados da mesma obra na mesma data: unique', 'obras_feriado_obra_data_uniq', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_feriado (data, descricao, abrangencia, obra_id)
  values ('2031-05-03', 'da obra', 'municipal', '00000000-0000-4000-8000-00000000a005');
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a005';
  raise exception 'ok:%', (select count(*) from public.obras_feriado where data = '2031-05-03');
exception when others then
  perform pg_temp.reg(29, 'apagar a obra leva os feriados dela (on delete cascade)', 'ok:0', sqlerrm);
end $$;

select pg_temp.reg(30, 'obras_feriado: escrita segue só admin (3 policies com obras_is_admin)', '3',
  (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_feriado'
     and cmd in ('INSERT','UPDATE','DELETE') and coalesce(qual, with_check) like '%obras_is_admin%'));

select pg_temp.reg(31, 'obras_registro: select/insert/update/delete usam obras_has_access', '4',
  (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'obras_registro'
     and coalesce(qual, with_check) like '%obras_has_access%'));

select pg_temp.reg(32, 'existe administrador para os testes de admin', 't',
  (select (pg_temp.admin_email() is not null)::text));

-- ============================================================
-- Relatório (a tabela abaixo; no SQL Editor vale a mensagem do bloco final)
-- ============================================================
select n, teste, esperado, obtido,
       case when obtido like '%' || esperado || '%' then 'OK' else '*** FALHOU ***' end as resultado
  from _v order by n;

do $$
declare
  v_total int;
  v_ok    int;
  v_falhas text;
begin
  select count(*), count(*) filter (where obtido like '%' || esperado || '%'),
         string_agg(n::text || ' (' || coalesce(obtido, 'NULL') || ')', '; ' order by n)
           filter (where obtido is null or obtido not like '%' || esperado || '%')
    into v_total, v_ok, v_falhas
    from _v;
  if v_total <> 33 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 33 testes rodaram';
  end if;
  raise exception 'RESUMO: %/33 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
