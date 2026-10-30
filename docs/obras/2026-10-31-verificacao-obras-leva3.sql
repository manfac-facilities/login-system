-- ============================================================
-- Teste de comportamento de sdd-sql-obras-leva3.sql
-- Rodar DEPOIS de aplicar a migration (e a da Leva 2), no SQL Editor,
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
-- (desfaz o que ele fez). Booleanos aparecem como t/f no texto (::text de
-- boolean dá true/false; por isso os testes convertem com pg_temp.tf).
-- Roda como postgres (acima da RLS): testa os TRIGGERS, checks e a função
-- obras_fechar_plano. A RLS em si é conferida estruturalmente (verificação
-- da migration); o JWT é simulado por set_config('request.jwt.claims').
--
-- Fixture (só dentro da transação):
--   obra A TESTE-VERIF-LEVA3-A (OBRA, engenheiro eng.teste@teste.invalid);
--   obra B TESTE-VERIF-LEVA3-B (OBRA, sem engenheiro);
--   restrição R1 do autor.teste (identificada);
--   plano de A na semana 2026-11-02 (itens 1 e 2), fechado pelo engenheiro,
--   com o item 1 já avaliado pelo engenheiro;
--   semanal S1 de A na semana 2026-11-02 (rascunho).
-- "Administrador" = o primeiro e-mail com nivel 'administrador' em hub_user_roles.
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

create function pg_temp.tf(p boolean) returns text language sql as $$
  select case when p then 't' when not p then 'f' else 'NULL' end;
$$;

create function pg_temp.admin_email() returns text language sql as $$
  select user_email from public.hub_user_roles where nivel = 'administrador' order by user_email limit 1;
$$;

create function pg_temp.plano(p_semana date) returns uuid language sql as $$
  select id from public.obras_plano_semana
   where obra_id = '00000000-0000-4000-8000-00000000a006' and semana_inicio = p_semana;
$$;

create function pg_temp.item(p_numero int) returns uuid language sql as $$
  select i.id from public.obras_plano_item i
   where i.plano_id = pg_temp.plano('2026-11-02') and i.numero = p_numero;
$$;

select pg_temp.jwt(null);

insert into public.obras_obra (id, os, modalidade, engenheiro_email)
values ('00000000-0000-4000-8000-00000000a006', 'TESTE-VERIF-LEVA3-A', 'obra', 'eng.teste@teste.invalid'),
       ('00000000-0000-4000-8000-00000000a007', 'TESTE-VERIF-LEVA3-B', 'obra', null);

-- R1: criada pelo autor COM JWT tentando falsificar autoria e datas
select pg_temp.jwt('autor.teste@teste.invalid');
insert into public.obras_restricao (id, obra_id, atividade_numero, tipo, descricao, responsavel,
                                    criado_por, criado_em, atualizado_por, atualizado_em, liberada_em)
values ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000a006', 1, 'material',
        'falta piso', 'manfac', 'falsificado@teste.invalid', timestamptz '2100-01-01',
        'falsificado@teste.invalid', timestamptz '2100-01-01', timestamptz '2100-01-01');

-- Plano da semana 2026-11-02 (segunda), fechado pelo engenheiro
select pg_temp.jwt('eng.teste@teste.invalid');
select public.obras_fechar_plano('00000000-0000-4000-8000-00000000a006', '2026-11-02',
  '[{"numero":1,"meta_percentual":0.5},{"numero":2,"meta_percentual":1}]'::jsonb);
-- Item 1 avaliado pelo engenheiro (tentando falsificar o carimbo)
update public.obras_plano_item
   set percentual_final = 0.4, cumprido = false, causa = 'material',
       avaliado_por = 'falsificado@teste.invalid', avaliado_em = timestamptz '2100-01-01'
 where id = pg_temp.item(1);
-- Semanal S1 (rascunho) pelo engenheiro
insert into public.obras_semanal (id, obra_id, semana_inicio, observacoes)
values ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a006', '2026-11-02', 'obs inicial');
select pg_temp.jwt(null);

-- ============================================================
-- obras_restricao
-- ============================================================
select pg_temp.reg(1, 'com JWT: criado_por = sessão, criado_em = now(), atualizado_*/liberada_em vazios',
  'ok:autor.teste@teste.invalid|t|t|t',
  (select 'ok:' || criado_por || '|' || pg_temp.tf(criado_em = now()) || '|'
          || pg_temp.tf(atualizado_por is null and atualizado_em is null) || '|' || pg_temp.tf(liberada_em is null)
     from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001'));

do $$ begin
  perform pg_temp.jwt('outro.teste@teste.invalid');
  update public.obras_restricao
     set descricao = 'falta piso cerâmico', criado_por = 'outro@teste.invalid',
         criado_em = timestamptz '2000-01-01', atualizado_por = 'falsificado@teste.invalid',
         obra_id = '00000000-0000-4000-8000-00000000a007'
   where id = '00000000-0000-4000-8000-00000000f001';
  raise exception 'ok:%|%|%|%|%', (select criado_por from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001'),
    (select pg_temp.tf(criado_em = now()) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001'),
    (select atualizado_por from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001'),
    (select pg_temp.tf(atualizado_em is not null) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001'),
    (select pg_temp.tf(obra_id = '00000000-0000-4000-8000-00000000a006') from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001');
exception when others then
  perform pg_temp.reg(2, 'outro usuário edita: passa; autoria, criado_em e obra intactos; atualizado_por = sessão',
    'ok:autor.teste@teste.invalid|t|outro.teste@teste.invalid|t|t', sqlerrm);
end $$;

do $$
declare v1 timestamptz; v2 timestamptz; v3 timestamptz;
begin
  perform pg_temp.jwt('autor.teste@teste.invalid');
  update public.obras_restricao set situacao = 'em_tratativa', liberada_em = timestamptz '2100-01-01'
   where id = '00000000-0000-4000-8000-00000000f001';
  select liberada_em into v1 from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001';
  update public.obras_restricao set situacao = 'liberada' where id = '00000000-0000-4000-8000-00000000f001';
  select liberada_em into v2 from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001';
  update public.obras_restricao set descricao = 'liberada, nota', liberada_em = timestamptz '2100-01-01'
   where id = '00000000-0000-4000-8000-00000000f001';
  select liberada_em into v3 from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001';
  update public.obras_restricao set situacao = 'identificada' where id = '00000000-0000-4000-8000-00000000f001';
  raise exception 'ok:%|%|%|%', pg_temp.tf(v1 is null), pg_temp.tf(v2 = now()), pg_temp.tf(v3 = v2),
    (select pg_temp.tf(liberada_em is null) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001');
exception when others then
  perform pg_temp.reg(3, 'liberada_em: vazio fora de liberada, now() ao entrar, mantido enquanto liberada, limpo ao sair',
    'ok:t|t|t|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('autor.teste@teste.invalid');
  insert into public.obras_restricao (id, obra_id, atividade_numero, tipo, descricao, responsavel, situacao)
  values ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000a006', 2, 'acesso', 'x', 'cliente', 'liberada');
  raise exception 'ok:%', (select pg_temp.tf(liberada_em = now()) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f002');
exception when others then
  perform pg_temp.reg(4, 'restrição criada já liberada: liberada_em = now()', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(5, 'outro usuário (não admin) apaga restrição alheia: bloqueado', 'OBRAS_RESTRICAO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('autor.teste@teste.invalid');
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001';
  raise exception 'ok:%', (select count(*) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001');
exception when others then
  perform pg_temp.reg(6, 'autor apaga a própria restrição: passa', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001';
  raise exception 'ok:%', (select count(*) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001');
exception when others then
  perform pg_temp.reg(7, 'administrador apaga restrição alheia: passa', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001';
  raise exception 'ok:%', (select count(*) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f001');
exception when others then
  perform pg_temp.reg(8, 'sem JWT (service role/SQL Editor) apaga: passa', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_restricao (obra_id, atividade_numero, tipo, descricao, responsavel)
  values ('00000000-0000-4000-8000-00000000a006', 1, 'clima', 'x', 'manfac');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(9, 'tipo de restrição inválido: check', 'obras_restricao_tipo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_restricao (obra_id, atividade_numero, tipo, descricao, responsavel)
  values ('00000000-0000-4000-8000-00000000a006', 1, 'material', 'x', 'clima');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(10, 'responsável inválido: check', 'obras_restricao_responsavel_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_restricao set situacao = 'resolvida' where id = '00000000-0000-4000-8000-00000000f001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(11, 'situação inválida: check', 'obras_restricao_situacao_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_restricao (obra_id, tipo, descricao, responsavel)
  values ('00000000-0000-4000-8000-00000000a006', 'material', 'x', 'manfac');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(12, 'restrição sem atividade_numero: not null', 'atividade_numero', sqlerrm);
end $$;

-- ============================================================
-- obras_plano_semana / obras_plano_item / obras_fechar_plano
-- ============================================================
select pg_temp.reg(13, 'engenheiro fecha o plano: fechado_por = sessão, 2 itens sem avaliação na criação',
  'ok:eng.teste@teste.invalid|2|t',
  (select 'ok:' || p.fechado_por || '|' || (select count(*) from public.obras_plano_item i where i.plano_id = p.id)::text
          || '|' || pg_temp.tf((select avaliado_em is null and cumprido is null from public.obras_plano_item where id = pg_temp.item(2)))
     from public.obras_plano_semana p where p.id = pg_temp.plano('2026-11-02')));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a006', '2026-11-02', '[]'::jsonb);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(14, 'segundo plano na mesma semana: recusado', 'já existe plano', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a006', '2026-11-09',
    '[{"numero":1,"meta_percentual":0.5}]'::jsonb);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(15, 'usuário que não é engenheiro da obra nem admin fecha plano: bloqueado', 'OBRAS_PLANO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a007', '2026-11-09', '[]'::jsonb);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(16, 'engenheiro de outra obra fecha plano da obra B: bloqueado', 'OBRAS_PLANO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a007', '2026-11-09',
    '[{"numero":3,"meta_percentual":0.25}]'::jsonb);
  raise exception 'ok:%', (select pg_temp.tf(p.fechado_por = pg_temp.admin_email()) from public.obras_plano_semana p
                             where p.obra_id = '00000000-0000-4000-8000-00000000a007' and p.semana_inicio = '2026-11-09');
exception when others then
  perform pg_temp.reg(17, 'administrador fecha plano de obra sem engenheiro: passa', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a006', '2026-11-03', '[]'::jsonb);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(18, 'semana que não começa na segunda: check', 'obras_plano_semana_segunda', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a006', '2026-11-09', '{"numero":1}'::jsonb);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(19, 'itens que não são lista: recusado', 'têm de ser uma lista', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a006', '2026-11-09',
    '[{"numero":1,"meta_percentual":0.5},{"numero":2,"meta_percentual":1.5}]'::jsonb);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(20, 'meta fora de 0..1: check', 'obras_plano_item_meta_percentual_check', sqlerrm);
end $$;

do $$
declare v text;
begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  begin
    perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a006', '2026-11-09',
      '[{"numero":1,"meta_percentual":0.5},{"numero":2,"meta_percentual":1.5}]'::jsonb);
  exception when others then null;
  end;
  raise exception 'ok:%|%', (select count(*) from public.obras_plano_semana p
                              where p.obra_id = '00000000-0000-4000-8000-00000000a006' and p.semana_inicio = '2026-11-09'),
    '[' || coalesce(current_setting('obras.fechando_plano', true), '') || ']';
exception when others then
  perform pg_temp.reg(21, 'falha nos itens desfaz o plano e não deixa a marca ligada', 'ok:0|[]', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a006', '2026-11-09',
    '[{"numero":1,"meta_percentual":0.5},{"numero":1,"meta_percentual":0.7}]'::jsonb);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(22, 'mesma atividade duas vezes no plano: unique', 'obras_plano_item_plano_id_numero_key', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  perform public.obras_fechar_plano('00000000-0000-4000-8000-00000000a006', '2026-11-09', '[]'::jsonb);
  raise exception 'ok:%|%', (select count(*) from public.obras_plano_item where plano_id = pg_temp.plano('2026-11-09')),
    '[' || coalesce(current_setting('obras.fechando_plano', true), '') || ']';
exception when others then
  perform pg_temp.reg(23, 'plano com lista vazia: passa, 0 itens, marca desligada depois', 'ok:0|[]', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_plano_item (plano_id, numero, meta_percentual) values (pg_temp.plano('2026-11-02'), 9, 0.5);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(24, 'sem JWT: item inserido fora de obras_fechar_plano: bloqueado', 'itens só entram ao fechar o plano', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_plano_item (plano_id, numero, meta_percentual) values (pg_temp.plano('2026-11-02'), 9, 0.5);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(25, 'engenheiro insere item em plano já fechado: bloqueado', 'itens só entram ao fechar o plano', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  delete from public.obras_plano_item where id = pg_temp.item(2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(26, 'apagar item de plano fechado (admin): bloqueado', 'não é apagado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_plano_item where id = pg_temp.item(2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(27, 'apagar item de plano fechado (sem JWT): bloqueado', 'não é apagado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_plano_item set meta_percentual = 0.9 where id = pg_temp.item(2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(28, 'mudar a meta do item (admin): bloqueado', 'só a avaliação do item muda', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_plano_item set numero = 7 where id = pg_temp.item(2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(29, 'mudar o numero do item (sem JWT): bloqueado', 'só a avaliação do item muda', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_plano_semana set semana_inicio = '2026-11-09' where id = pg_temp.plano('2026-11-02');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(30, 'alterar o plano (admin): bloqueado', 'plano fechado não muda', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_plano_semana set fechado_por = 'x' where id = pg_temp.plano('2026-11-02');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(31, 'alterar o plano (sem JWT): bloqueado', 'plano fechado não muda', sqlerrm);
end $$;

select pg_temp.reg(32, 'engenheiro avalia item: avaliado_por = sessão, avaliado_em = now() (carimbo não falsificável)',
  'ok:eng.teste@teste.invalid|t|f|material',
  (select 'ok:' || avaliado_por || '|' || pg_temp.tf(avaliado_em = now()) || '|' || pg_temp.tf(cumprido) || '|' || causa
     from public.obras_plano_item where id = pg_temp.item(1)));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_plano_item set percentual_final = 0.5, cumprido = true, causa = null where id = pg_temp.item(1);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(33, 'engenheiro reavalia item já avaliado: bloqueado', 'só administrador reavalia', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_plano_item set percentual_final = 0.5, cumprido = true, causa = null where id = pg_temp.item(1);
  raise exception 'ok:%|%', (select pg_temp.tf(avaliado_por = pg_temp.admin_email()) from public.obras_plano_item where id = pg_temp.item(1)),
    (select pg_temp.tf(cumprido) from public.obras_plano_item where id = pg_temp.item(1));
exception when others then
  perform pg_temp.reg(34, 'administrador reavalia: passa, carimbo do admin', 'ok:t|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_plano_item set percentual_final = null, cumprido = null, causa = null where id = pg_temp.item(1);
  raise exception 'ok:%', (select pg_temp.tf(avaliado_em is null and avaliado_por is null)
                             from public.obras_plano_item where id = pg_temp.item(1));
exception when others then
  perform pg_temp.reg(62, 'administrador zera a avaliação: avaliado_em/avaliado_por voltam a nulo', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  update public.obras_plano_item set percentual_final = 1, cumprido = true where id = pg_temp.item(2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(35, 'quem não é engenheiro da obra nem admin avalia: bloqueado', 'só o engenheiro da obra ou administrador avalia', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_plano_item set percentual_final = 0.2, cumprido = false, causa = 'chuva' where id = pg_temp.item(2);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(36, 'causa fora de CausaRdo: check', 'obras_plano_item_causa_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_plano_item set avaliado_por = 'falsificado@teste.invalid', avaliado_em = timestamptz '2100-01-01'
   where id = pg_temp.item(1);
  raise exception 'ok:%', (select avaliado_por from public.obras_plano_item where id = pg_temp.item(1));
exception when others then
  perform pg_temp.reg(37, 'carimbo da avaliação não é editável à mão (sem mudar a avaliação)', 'ok:eng.teste@teste.invalid', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_plano_semana where id = pg_temp.plano('2026-11-02');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(38, 'engenheiro apaga plano fechado: bloqueado', 'só administrador apaga', sqlerrm);
end $$;

do $$
declare v_id uuid := pg_temp.plano('2026-11-02');
begin
  perform pg_temp.jwt(pg_temp.admin_email());
  delete from public.obras_plano_semana where id = v_id;
  raise exception 'ok:%|%', (select count(*) from public.obras_plano_semana where id = v_id),
    (select count(*) from public.obras_plano_item where plano_id = v_id);
exception when others then
  perform pg_temp.reg(39, 'administrador apaga plano: passa e os itens saem em cascata', 'ok:0|0', sqlerrm);
end $$;

-- ============================================================
-- obras_semanal
-- ============================================================
select pg_temp.reg(40, 'engenheiro cria semanal: nasce rascunho', 'ok:rascunho|t',
  (select 'ok:' || estado || '|' || pg_temp.tf(validado_por is null and validado_em is null)
     from public.obras_semanal where id = '00000000-0000-4000-8000-00000000b001'));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_semanal (obra_id, semana_inicio, estado) values ('00000000-0000-4000-8000-00000000a006', '2026-11-09', 'validado');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(41, 'semanal novo já validado: bloqueado', 'nasce como rascunho', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  insert into public.obras_semanal (obra_id, semana_inicio) values ('00000000-0000-4000-8000-00000000a006', '2026-11-09');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(42, 'quem não é engenheiro da obra nem admin cria semanal: bloqueado', 'OBRAS_SEMANAL: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  update public.obras_semanal set estado = 'validado' where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(43, 'quem não é engenheiro da obra nem admin valida: bloqueado', 'OBRAS_SEMANAL: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_semanal set observacoes = 'obs editada' where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'ok:%', (select observacoes from public.obras_semanal where id = '00000000-0000-4000-8000-00000000b001');
exception when others then
  perform pg_temp.reg(44, 'engenheiro edita observações em rascunho: passa', 'ok:obs editada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_semanal set validado_por = 'falsificado@teste.invalid' where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(45, 'validado_por mexido em rascunho sem validar: bloqueado', 'só mudam na validação', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_semanal set estado = 'enviado' where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(46, 'rascunho -> enviado direto: bloqueado', 'transição rascunho -> enviado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_semanal set estado = 'validado', validado_por = 'falsificado@teste.invalid'
   where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'ok:%|%', (select validado_por from public.obras_semanal where id = '00000000-0000-4000-8000-00000000b001'),
    (select pg_temp.tf(validado_em = now()) from public.obras_semanal where id = '00000000-0000-4000-8000-00000000b001');
exception when others then
  perform pg_temp.reg(47, 'engenheiro valida: validado_por = sessão, validado_em = now()', 'ok:eng.teste@teste.invalid|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_semanal set estado = 'validado' where id = '00000000-0000-4000-8000-00000000b001';
  update public.obras_semanal set observacoes = 'mudou depois' where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(48, 'observações depois de validado: bloqueado', 'não pode ter o conteúdo alterado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_semanal set estado = 'validado' where id = '00000000-0000-4000-8000-00000000b001';
  update public.obras_semanal set estado = 'rascunho' where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(49, 'validado -> rascunho (até admin): bloqueado', 'transição validado -> rascunho', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_semanal set estado = 'validado' where id = '00000000-0000-4000-8000-00000000b001';
  update public.obras_semanal set estado = 'enviado' where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'ok:%', (select estado from public.obras_semanal where id = '00000000-0000-4000-8000-00000000b001');
exception when others then
  perform pg_temp.reg(50, 'validado -> enviado: passa', 'ok:enviado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_semanal set estado = 'validado' where id = '00000000-0000-4000-8000-00000000b001';
  update public.obras_semanal set estado = 'enviado' where id = '00000000-0000-4000-8000-00000000b001';
  update public.obras_semanal set estado = 'validado' where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(51, 'enviado -> validado (sem JWT): bloqueado', 'transição enviado -> validado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_semanal (obra_id, semana_inicio) values ('00000000-0000-4000-8000-00000000a006', '2026-11-04');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(52, 'semanal em semana que não começa na segunda: check', 'obras_semanal_segunda', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_semanal (obra_id, semana_inicio) values ('00000000-0000-4000-8000-00000000a006', '2026-11-02');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(53, 'dois semanais na mesma semana: unique', 'obras_semanal_obra_id_semana_inicio_key', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  delete from public.obras_semanal where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(54, 'quem não é engenheiro da obra nem admin apaga semanal: bloqueado', 'OBRAS_SEMANAL: só o engenheiro', sqlerrm);
end $$;

-- ============================================================
-- obras_envio: tipo 'semanal' e semanal_id
-- ============================================================
do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (id, obra_id, tipo, semanal_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000e003', '00000000-0000-4000-8000-00000000a006', 'semanal',
          '00000000-0000-4000-8000-00000000b001', 'cliente', 'ok');
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a006', 'diario', 'cliente', 'ok');
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a006', 'ata', 'cliente', 'ok');
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a006', 'imediata', 'cliente', 'ok');
  raise exception 'ok:%', (select semanal_id::text from public.obras_envio where id = '00000000-0000-4000-8000-00000000e003');
exception when others then
  perform pg_temp.reg(55, 'envio aceita semanal (com semanal_id), diario, ata e imediata', 'ok:00000000-0000-4000-8000-00000000b001', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a006', 'mensal', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(56, 'envio com tipo fora da lista: check', 'obras_envio_tipo_check', sqlerrm);
end $$;

do $$ begin
  -- envio feito pelo administrador; o engenheiro apaga o semanal (rascunho):
  -- semanal_id vira nulo e o enviado_por não muda.
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (id, obra_id, tipo, semanal_id, lado, resultado, enviado_por)
  values ('00000000-0000-4000-8000-00000000e004', '00000000-0000-4000-8000-00000000a006', 'semanal',
          '00000000-0000-4000-8000-00000000b001', 'cliente', 'ok', 'falsificado@teste.invalid');
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_semanal where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'ok:%|%',
    (select pg_temp.tf(enviado_por = pg_temp.admin_email()) from public.obras_envio where id = '00000000-0000-4000-8000-00000000e004'),
    (select pg_temp.tf(semanal_id is null) from public.obras_envio where id = '00000000-0000-4000-8000-00000000e004');
exception when others then
  perform pg_temp.reg(57, 'engenheiro apaga semanal rascunho: semanal_id do envio vira nulo, enviado_por intacto', 'ok:t|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_semanal (id, obra_id, semana_inicio)
  values ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a007', '2026-11-02');
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (obra_id, tipo, semanal_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000a006', 'semanal', '00000000-0000-4000-8000-00000000b002', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(60, 'envio da obra A com semanal_id da obra B: bloqueado', 'semanal_id é de outra obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_registro (id, obra_id, tipo)
  values ('00000000-0000-4000-8000-00000000d006', '00000000-0000-4000-8000-00000000a007', 'reuniao');
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (obra_id, tipo, registro_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000a006', 'ata', '00000000-0000-4000-8000-00000000d006', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(61, 'envio da obra A com registro_id da obra B: bloqueado', 'registro_id é de outra obra', sqlerrm);
end $$;

-- ============================================================
-- Cascata da obra (com JWT de não administrador)
-- ============================================================
do $$
declare v_plano uuid := pg_temp.plano('2026-11-02');
begin
  -- restrição de outro autor, plano e semanal da obra A; o engenheiro (não
  -- admin, não autor da restrição) apaga a obra: tudo sai em cascata.
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a006';
  raise exception 'ok:%|%|%|%',
    (select count(*) from public.obras_restricao where obra_id = '00000000-0000-4000-8000-00000000a006'),
    (select count(*) from public.obras_plano_semana where obra_id = '00000000-0000-4000-8000-00000000a006'),
    (select count(*) from public.obras_plano_item i where i.plano_id = v_plano),
    (select count(*) from public.obras_semanal where obra_id = '00000000-0000-4000-8000-00000000a006');
exception when others then
  perform pg_temp.reg(58, 'apagar a obra leva restrições, planos, itens e semanais (guardas não travam a cascata)', 'ok:0|0|0|0', sqlerrm);
end $$;

select pg_temp.reg(59, 'existe administrador para os testes de admin', 't',
  (select pg_temp.tf(pg_temp.admin_email() is not null)));

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
  if v_total <> 62 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 62 testes rodaram';
  end if;
  raise exception 'RESUMO: %/62 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
