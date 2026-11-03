-- ============================================================
-- Teste de comportamento de sdd-sql-obras-leva6b.sql
-- Rodar DEPOIS de aplicar a migration (e a Leva 6), no SQL Editor,
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
--     authenticated / anon com o JWT daquele e-mail — testa a RLS e os
--     GRANTs DE VERDADE.
--
-- Cobre a Review Focus do plano (docs/superpowers/plans/2026-11-01-obras-leva6b.md):
--   1. coordenador NULL/vazio/diferente não escreve (falha fechada) — 1–23;
--   2. emitida não muda e não volta; envio faseamento só aponta emitida da
--      mesma obra — 24–52;
--   4. camadas inválidas recusadas no banco — 53–61 (regras 62, 65, 66: até 12 de até 200 caracteres; carimbo 63; válidas 64).
--   Rodada de correções da revisão — 67–86: obra_id/fase_id da revisão e
--   obra_id da fase imutáveis (67–69), supervisor cria fase e outro e-mail
--   apaga fase como authenticated (70–71), obra_id do envio (72), cascata da
--   obra com JWT de admin (73), base (planta) e fase congeladas na emissão,
--   imutáveis depois e NULL no rascunho (74–81), limites de tamanho de
--   camadas e carimbo (82–85), anon sem execute nos validadores (86).
--
-- Fixture (só dentro da transação):
--   obra A TESTE-VERIF-LEVA6B-A (OBRA, engenheiro eng.teste@teste.invalid,
--     coordenador '  Coord.Teste@Teste.INVALID ' — testa lower/trim,
--     atividade_trava 6);
--   obra B TESTE-VERIF-LEVA6B-B (OBRA, sem engenheiro, coordenador NULL,
--     sem atividade_trava);
--   obra C TESTE-VERIF-LEVA6B-C (OBRA, sem engenheiro, coordenador '  ', sem mapa);
--   mapa da obra A com planta <A>/mapa/5555….png 1200×840 (congelada na R0);
--   hub_system_access slug obras para eng.teste, coord.teste, outro.coord e
--   usuario.obras (o "supervisor"); sem.acesso não tem linha;
--   cronograma da obra A: versão 1 SALVA (6 Escoramento provisório; 7 sem
--   trava; 11 e 12 bloqueia_por_trava) e versão 2 RASCUNHO (6 "Escoramento
--   V2", não pode aparecer no retrato); execução: 6 em_andamento 0,4;
--   11 bloqueado; 12 sem linha (= nao_iniciado);
--   pelo engenheiro: fase F1 da obra A e revisão R0 (rascunho), emitida pelo
--   coordenador; depois R1 (rascunho, cópia); pelo coordenador: fase F2;
--   sem JWT: fase FB da obra B com revisão RB (usa_trava) e o envio E1
--   (faseamento -> R0).
-- "Administrador" = o primeiro e-mail com nivel 'administrador' em hub_user_roles.
-- ============================================================

begin;

-- 0. A migration (e a Leva 6) têm de estar aplicadas.
do $$
begin
  if to_regclass('public.obras_mapa') is null
     or to_regprocedure('public.obras_mapa_pode_escrever(text)') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva6.sql não está aplicado.';
  end if;
  if to_regclass('public.obras_fase') is null
     or to_regclass('public.obras_fase_revisao') is null
     or to_regprocedure('public.obras_pode_fasear(uuid)') is null
     or to_regprocedure('public.obras_emitir_fase_revisao(uuid)') is null
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_envio' and column_name = 'fase_revisao_id')
     or not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'coordenador_email') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva6b.sql não está aplicado.';
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

insert into public.obras_obra (id, os, modalidade, engenheiro_email, coordenador_email, atividade_trava)
values ('00000000-0000-4000-8000-00000000a060', 'TESTE-VERIF-LEVA6B-A', 'obra', 'eng.teste@teste.invalid',
        '  Coord.Teste@Teste.INVALID ', 6),
       ('00000000-0000-4000-8000-00000000a061', 'TESTE-VERIF-LEVA6B-B', 'obra', null, null, null),
       ('00000000-0000-4000-8000-00000000a062', 'TESTE-VERIF-LEVA6B-C', 'obra', null, '  ', null);

insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
values ('eng.teste@teste.invalid', 'obras', true, 'verificacao-leva6b'),
       ('coord.teste@teste.invalid', 'obras', true, 'verificacao-leva6b'),
       ('outro.coord@teste.invalid', 'obras', true, 'verificacao-leva6b'),
       ('usuario.obras@teste.invalid', 'obras', true, 'verificacao-leva6b');

-- Mapa da obra A com planta (a revisão emitida congela este caminho e as dimensões).
insert into public.obras_mapa (obra_id, modo, planta_path, planta_largura, planta_altura)
values ('00000000-0000-4000-8000-00000000a060', 'planta',
        '00000000-0000-4000-8000-00000000a060/mapa/55555555-5555-4555-8555-555555555555.png', 1200, 840);

insert into public.obras_cronograma_versao (id, obra_id, numero, criada_por, salva_em, salva_por)
values ('00000000-0000-4000-8000-0000000c0601', '00000000-0000-4000-8000-00000000a060', 1, 'verificacao', null, null),
       ('00000000-0000-4000-8000-0000000c0602', '00000000-0000-4000-8000-00000000a060', 2, 'verificacao', null, null);
insert into public.obras_atividade (versao_id, obra_id, numero, descricao, duracao, bloqueia_por_trava)
values ('00000000-0000-4000-8000-0000000c0601', '00000000-0000-4000-8000-00000000a060', 6, 'Escoramento provisório', 3, false),
       ('00000000-0000-4000-8000-0000000c0601', '00000000-0000-4000-8000-00000000a060', 7, 'Tapume', 1, false),
       ('00000000-0000-4000-8000-0000000c0601', '00000000-0000-4000-8000-00000000a060', 11, 'Demolição da laje', 2, true),
       ('00000000-0000-4000-8000-0000000c0601', '00000000-0000-4000-8000-00000000a060', 12, 'Demolição da parede', 2, true),
       ('00000000-0000-4000-8000-0000000c0602', '00000000-0000-4000-8000-00000000a060', 6, 'Escoramento V2', 3, false),
       ('00000000-0000-4000-8000-0000000c0602', '00000000-0000-4000-8000-00000000a060', 13, 'Só na V2', 2, true);
-- A V1 só é salva depois das atividades: em produção `obras_atividade_imutavel` recusa
-- atividade nova em versão já salva.
update public.obras_cronograma_versao set salva_em = now(), salva_por = 'verificacao'
 where id = '00000000-0000-4000-8000-0000000c0601';
insert into public.obras_atividade_exec (obra_id, numero, status, percentual)
values ('00000000-0000-4000-8000-00000000a060', 6, 'em_andamento', 0.4),
       ('00000000-0000-4000-8000-00000000a060', 11, 'bloqueado', 0);

-- Fase F1 e revisão R0 da obra A pelo engenheiro (número, status e emissão
-- forjados de propósito; R0 sem obra_id — o banco copia o da fase).
select pg_temp.jwt('eng.teste@teste.invalid');
insert into public.obras_fase (id, obra_id, numero, nome, ordem, criado_por, criado_em)
values ('00000000-0000-4000-8000-0000000f0001', '00000000-0000-4000-8000-00000000a060', 99, 'Fase 1 · Demolição e reforço', 1,
        'forjado@teste.invalid', '2020-01-01');
insert into public.obras_fase_revisao (id, fase_id, revisao, status, camadas, regras, carimbo, usa_trava,
                                       trava_snapshot, emitida_em, emitida_por)
values ('00000000-0000-4000-8000-0000000e0001', '00000000-0000-4000-8000-0000000f0001', 7, 'emitida',
        '[{"id":1,"t":"zona_obra","r":[0.02,0.03,0.36,0.94],"rot":"ZONA DE OBRA"},
          {"id":7,"t":"drywall","p":[[0.38,0.03],[0.38,0.69],[0.98,0.69]]},
          {"id":9,"t":"porta_obra","at":[0.98,0.86]},
          {"id":13,"t":"extintor","at":[0.93,0.77],"oculta":false}]',
        array['Nenhuma demolição antes do escoramento.', 'Clientes usam só a entrada existente.'],
        '{"titulo":"Planta de faseamento · Fase 1","cliente":"Cliente teste","desenho":"FAS-01"}',
        true, '{"forjado":true}', '2020-01-01', 'forjado@teste.invalid');

-- Fase F2 pelo coordenador (e-mail do JWT em minúsculas; o da obra tem
-- maiúsculas e espaços).
select pg_temp.jwt('coord.teste@teste.invalid');
insert into public.obras_fase (id, obra_id, numero, nome, ordem)
values ('00000000-0000-4000-8000-0000000f0002', '00000000-0000-4000-8000-00000000a060', 1, 'Fase 2 · Piso do salão', 2);
insert into public.obras_fase_revisao (id, fase_id, obra_id, camadas)
values ('00000000-0000-4000-8000-0000000e0201', '00000000-0000-4000-8000-0000000f0002',
        '00000000-0000-4000-8000-00000000a060', '[]');

-- R0 emitida pelo coordenador (persiste para os testes de imutabilidade).
select public.obras_emitir_fase_revisao('00000000-0000-4000-8000-0000000e0001');

-- R1 da F1 pelo engenheiro (cópia da emitida).
select pg_temp.jwt('eng.teste@teste.invalid');
insert into public.obras_fase_revisao (id, fase_id, camadas, regras, carimbo, usa_trava)
select '00000000-0000-4000-8000-0000000e0002', fase_id, camadas, regras, carimbo, usa_trava
  from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0001';

-- Obra B sem JWT (service role): fase FB, revisão RB com trava, envio E1 de R0.
select pg_temp.jwt(null);
insert into public.obras_fase (id, obra_id, numero, nome, criado_por)
values ('00000000-0000-4000-8000-0000000f0101', '00000000-0000-4000-8000-00000000a061', 5, 'Fase B', 'carga@teste.invalid');
insert into public.obras_fase_revisao (id, fase_id, usa_trava)
values ('00000000-0000-4000-8000-0000000e0101', '00000000-0000-4000-8000-0000000f0101', true);
insert into public.obras_envio (id, obra_id, tipo, fase_revisao_id, resultado, destinatarios)
values ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-4000-8000-00000000a060', 'faseamento',
        '00000000-0000-4000-8000-0000000e0001', 'ok', array['cliente@teste.invalid']);

-- ============================================================
-- Review Focus 1 — quem escreve (falha fechada)
-- ============================================================
select pg_temp.reg(1, 'fases numeradas pelo banco (99 e 1 enviados ignorados): F1 = 1, F2 = 2; autoria = JWT',
  'ok:1,2|eng.teste@teste.invalid,coord.teste@teste.invalid|t',
  (select 'ok:' || string_agg(numero::text, ',' order by numero) || '|'
          || string_agg(criado_por, ',' order by numero) || '|'
          || pg_temp.tf(bool_and(criado_em = now()))
     from public.obras_fase where obra_id = '00000000-0000-4000-8000-00000000a060'));

select pg_temp.reg(2, 'sem JWT (service role) a fase da obra B passa e mantém criado_por; número = 1',
  'ok:1|carga@teste.invalid',
  (select 'ok:' || numero || '|' || criado_por from public.obras_fase where id = '00000000-0000-4000-8000-0000000f0101'));

do $$ begin
  perform pg_temp.jwt('coord.teste@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a060'));
exception when others then
  perform pg_temp.reg(3, 'pode_fasear: coordenador da obra A (lower/trim) = t', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro.coord@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a060'));
exception when others then
  perform pg_temp.reg(4, 'pode_fasear: e-mail diferente do coordenador = f', 'ok:f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('coord.teste@teste.invalid');
  raise exception 'ok:%|%', pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a061')),
                            pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a062'));
exception when others then
  perform pg_temp.reg(5, 'pode_fasear: obra com coordenador NULL e com coordenador só espaços = f|f', 'ok:f|f', sqlerrm);
end $$;

do $$ begin
  perform set_config('request.jwt.claims', '{"email":"  ","role":"authenticated"}', true);
  raise exception 'ok:%|%', pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a062')),
                            pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a060'));
exception when others then
  perform pg_temp.reg(6, 'pode_fasear: JWT com e-mail só espaços (obra C coordenador espaços; obra A) = f|f (nunca NULL)', 'ok:f|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  raise exception 'ok:%|%', pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a061')),
                            pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a060'));
exception when others then
  perform pg_temp.reg(7, 'pode_fasear: sem JWT = f|f (nunca NULL; quem passa sem JWT é o trigger, não a função)', 'ok:f|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  raise exception 'ok:%|%', pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a060')),
                            pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a061'));
  exception when others then
  perform pg_temp.reg(8, 'pode_fasear: engenheiro da obra A = t; na obra B (sem engenheiro) = f', 'ok:t|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a062'));
exception when others then
  perform pg_temp.reg(9, 'pode_fasear: administrador em qualquer obra = t', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro.coord@teste.invalid');
  insert into public.obras_fase (obra_id, nome) values ('00000000-0000-4000-8000-00000000a060', 'Intrusa');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(10, 'e-mail diferente do coordenador não cria fase', 'só o engenheiro da obra, o coordenador ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('coord.teste@teste.invalid');
  insert into public.obras_fase (obra_id, nome) values ('00000000-0000-4000-8000-00000000a061', 'Na obra B');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(11, 'coordenador da obra A não cria fase na obra B (coordenador NULL)', 'só o engenheiro da obra, o coordenador ou administrador', sqlerrm);
end $$;

do $$ begin
  perform set_config('request.jwt.claims', '{"email":"x@teste.invalid","role":"authenticated"}', true);
  insert into public.obras_fase (obra_id, nome) values ('00000000-0000-4000-8000-00000000a062', 'Na obra C');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(12, 'obra C (coordenador só espaços): outro e-mail não cria fase', 'só o engenheiro da obra, o coordenador ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro.coord@teste.invalid');
  update public.obras_fase_revisao set camadas = '[]' where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(13, 'e-mail diferente do coordenador não altera revisão em rascunho', 'só o engenheiro da obra, o coordenador ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro.coord@teste.invalid');
  delete from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(14, 'e-mail diferente do coordenador não apaga revisão em rascunho', 'só o engenheiro da obra, o coordenador ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%|%',
    (select count(*) from public.obras_fase where obra_id = '00000000-0000-4000-8000-00000000a060'),
    (select count(*) from public.obras_fase_revisao where obra_id = '00000000-0000-4000-8000-00000000a060');
exception when others then
  perform pg_temp.reg(15, 'supervisor (authenticated, acesso ao Obras) LÊ fases e revisões da obra A', 'ok:2|3', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_fase set nome = 'Via RLS' where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(16, 'supervisor (authenticated) renomeia fase: bloqueado pelo trigger', 'só o engenheiro da obra, o coordenador ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%|%', (select count(*) from public.obras_fase), (select count(*) from public.obras_fase_revisao);
exception when others then
  perform pg_temp.reg(17, 'authenticated sem acesso ao Obras não lê fases nem revisões', 'ok:0|0', sqlerrm);
end $$;

do $$ begin
  -- E-mail vazio no JWT: o trigger trata como "sem JWT", mas a RLS fecha.
  perform set_config('request.jwt.claims', '{"email":"","role":"authenticated"}', true);
  perform set_config('role', 'authenticated', true);
  insert into public.obras_fase (obra_id, nome) values ('00000000-0000-4000-8000-00000000a062', 'Sem e-mail');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(18, 'authenticated com e-mail vazio no JWT não cria fase (RLS)', 'row-level security', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_fase_revisao;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(19, 'anon sem privilégio em obras_fase_revisao', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_obra set coordenador_email = 'eng.teste@teste.invalid' where id = '00000000-0000-4000-8000-00000000a060';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(20, 'não-admin (engenheiro) não troca coordenador_email', 'OBRAS_PARAMETROS: só administrador altera', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  insert into public.obras_obra (os, coordenador_email) values ('TESTE-VERIF-LEVA6B-X', 'usuario.obras@teste.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(21, 'não-admin não cria obra com coordenador_email', 'OBRAS_PARAMETROS: só administrador cria obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_obra set coordenador_email = 'outro.coord@teste.invalid' where id = '00000000-0000-4000-8000-00000000a061';
  perform pg_temp.jwt('outro.coord@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_fasear('00000000-0000-4000-8000-00000000a061'));
exception when others then
  perform pg_temp.reg(22, 'administrador grava coordenador_email; o novo coordenador passa a fasear', 'ok:t', sqlerrm);
end $$;

do $$
declare v public.obras_fase_revisao;
begin
  perform pg_temp.como('authenticated', 'coord.teste@teste.invalid');
  update public.obras_fase_revisao set camadas = '[{"t":"emerg","at":[0.3,0.7]}]', regras = array['Regra A']
   where id = '00000000-0000-4000-8000-0000000e0201';
  v := public.obras_emitir_fase_revisao('00000000-0000-4000-8000-0000000e0201');
  raise exception 'ok:%|%|%|%', v.status, v.emitida_por, pg_temp.tf(v.emitida_em = now()), pg_temp.tf(v.trava_snapshot is null);
exception when others then
  perform pg_temp.reg(23, 'coordenador (authenticated, RLS de verdade) edita rascunho e emite pela rpc',
    'ok:emitida|coord.teste@teste.invalid|t|t', sqlerrm);
end $$;

-- ============================================================
-- Review Focus 2 — emissão, imutabilidade e envio
-- ============================================================
select pg_temp.reg(24, 'R0: revisao 0 (7 enviado ignorado), obra copiada da fase, emitida pelo coordenador agora',
  'ok:0|t|emitida|coord.teste@teste.invalid|t',
  (select 'ok:' || revisao || '|' || pg_temp.tf(obra_id = '00000000-0000-4000-8000-00000000a060') || '|' || status
          || '|' || emitida_por || '|' || pg_temp.tf(emitida_em = now())
     from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0001'));

select pg_temp.reg(25, 'retrato da trava: atividade 6 da versão SALVA (não a V2), status e % da execução',
  'ok:6|Escoramento provisório|em_andamento|0.4|1',
  (select 'ok:' || (trava_snapshot -> 'atividade' ->> 'numero') || '|' || (trava_snapshot -> 'atividade' ->> 'descricao')
          || '|' || (trava_snapshot -> 'atividade' ->> 'status') || '|' || (trava_snapshot -> 'atividade' ->> 'percentual')
          || '|' || (trava_snapshot ->> 'versao')
     from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0001'));

select pg_temp.reg(26, 'retrato da trava: bloqueadas = 11 bloqueado, 12 nao_iniciado (sem linha); forjado descartado; data de hoje',
  'ok:11:bloqueado,12:nao_iniciado|f|t',
  (select 'ok:' || (select string_agg((b ->> 'numero') || ':' || (b ->> 'status'), ',' order by (b ->> 'numero')::int)
                      from jsonb_array_elements(trava_snapshot -> 'bloqueadas') b)
          || '|' || pg_temp.tf(trava_snapshot ? 'forjado')
          || '|' || pg_temp.tf(trava_snapshot ->> 'data' = to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD'))
     from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0001'));

select pg_temp.reg(27, 'R1 (cópia): revisao 1, rascunho, sem retrato nem emissão, camadas iguais às da R0',
  'ok:1|rascunho|t|t',
  (select 'ok:' || r1.revisao || '|' || r1.status || '|' || pg_temp.tf(r1.trava_snapshot is null and r1.emitida_em is null)
          || '|' || pg_temp.tf(r1.camadas = r0.camadas)
     from public.obras_fase_revisao r1, public.obras_fase_revisao r0
    where r1.id = '00000000-0000-4000-8000-0000000e0002' and r0.id = '00000000-0000-4000-8000-0000000e0001'));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_fase_revisao (fase_id) values ('00000000-0000-4000-8000-0000000f0001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(28, 'segunda revisão em rascunho na mesma fase: recusada', 'já tem uma revisão em rascunho', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_fase_revisao set camadas = '[]' where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(29, 'emitida: camadas não mudam (nem sem JWT)', 'revisão emitida é imutável', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_fase_revisao set regras = array['Outra'] where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(30, 'emitida: regras não mudam (nem sem JWT)', 'revisão emitida é imutável', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_fase_revisao set carimbo = '{"titulo":"Outro"}' where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(31, 'emitida: carimbo não muda (nem sem JWT)', 'revisão emitida é imutável', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_fase_revisao set trava_snapshot = '{"forjado":true}' where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(32, 'emitida: status da trava (retrato) não muda (nem sem JWT)', 'revisão emitida é imutável', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_fase_revisao set status = 'rascunho' where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(33, 'emitida não volta a rascunho (nem sem JWT)', 'revisão emitida é imutável', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_fase_revisao set usa_trava = false, emitida_em = now() - interval '1 day'
   where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(34, 'emitida: nem o administrador muda usa_trava/emitida_em', 'revisão emitida é imutável', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(35, 'emitida não se apaga (nem sem JWT)', 'revisão emitida não se apaga', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  delete from public.obras_fase where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(36, 'fase com revisão emitida não se apaga (nem pelo administrador)', 'fase com revisão emitida não se apaga', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('coord.teste@teste.invalid');
  perform public.obras_emitir_fase_revisao('00000000-0000-4000-8000-0000000e0001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(37, 'rpc em revisão já emitida: recusada', 'revisão não encontrada ou já emitida', sqlerrm);
end $$;

do $$
declare v_em timestamptz; v_snap jsonb; v_por text;
begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao
     set usa_trava = false, status = 'emitida', emitida_em = '2020-01-01', emitida_por = 'forjado@teste.invalid',
         trava_snapshot = '{"forjado":true}'
   where id = '00000000-0000-4000-8000-0000000e0002'
  returning emitida_em, trava_snapshot, emitida_por into v_em, v_snap, v_por;
  raise exception 'ok:%|%|%', pg_temp.tf(v_em = now()), coalesce(v_snap::text, 'null'), v_por;
exception when others then
  perform pg_temp.reg(38, 'emissão por UPDATE direto: data, autor e retrato forjados são trocados pelos do banco',
    'ok:t|null|eng.teste@teste.invalid', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  perform public.obras_emitir_fase_revisao('00000000-0000-4000-8000-0000000e0101');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(39, 'emitir com usa_trava numa obra sem atividade-trava: recusado', 'não tem atividade-trava definida', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set trava_snapshot = '{"forjado":true}', emitida_por = 'forjado@teste.invalid'
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'ok:%', (select coalesce(trava_snapshot::text, 'null') || '|' || coalesce(emitida_por, 'null')
                             from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0002');
exception when others then
  perform pg_temp.reg(40, 'rascunho não aceita retrato nem emissão forjados', 'ok:null|null', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set revisao = 5 where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(41, 'número da revisão é imutável', 'fase, obra e número da revisão são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase set numero = 9 where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(42, 'número da fase é imutável', 'obra_id e numero da fase são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_fase_revisao (fase_id, obra_id) values ('00000000-0000-4000-8000-0000000f0101',
                                                                   '00000000-0000-4000-8000-00000000a060');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(43, 'revisão com obra_id diferente da obra da fase: recusada', 'a fase não é desta obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_envio (obra_id, tipo, fase_revisao_id)
  values ('00000000-0000-4000-8000-00000000a060', 'faseamento', '00000000-0000-4000-8000-0000000e0002');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(44, 'envio faseamento apontando revisão em rascunho: recusado', 'não é revisão emitida', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (obra_id, tipo, fase_revisao_id)
  values ('00000000-0000-4000-8000-00000000a061', 'faseamento', '00000000-0000-4000-8000-0000000e0001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(45, 'envio faseamento da obra B apontando revisão da obra A: recusado', 'fase_revisao_id é de outra obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo) values ('00000000-0000-4000-8000-00000000a060', 'faseamento');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(46, 'envio faseamento sem fase_revisao_id: recusado (check)', 'obras_envio_faseamento_obrigatorio', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo, fase_revisao_id)
  values ('00000000-0000-4000-8000-00000000a060', 'diario', '00000000-0000-4000-8000-0000000e0001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(47, 'fase_revisao_id em envio de outro tipo: recusado', 'só em envio do tipo faseamento', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_envio set fase_revisao_id = '00000000-0000-4000-8000-0000000e0002'
   where id = '00000000-0000-4000-8000-0000000d0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(48, 'UPDATE do envio para revisão em rascunho: recusado (nem sem JWT)', 'não é revisão emitida', sqlerrm);
end $$;

do $$
declare v_por text;
begin
  perform pg_temp.como('authenticated', 'coord.teste@teste.invalid');
  insert into public.obras_envio (obra_id, tipo, fase_revisao_id, resultado, destinatarios)
  values ('00000000-0000-4000-8000-00000000a060', 'faseamento', '00000000-0000-4000-8000-0000000e0001', 'ok',
          array['cliente@teste.invalid'])
  returning enviado_por into v_por;
  raise exception 'ok:%', v_por;
exception when others then
  perform pg_temp.reg(49, 'coordenador (authenticated) registra envio faseamento de revisão emitida da mesma obra',
    'ok:coord.teste@teste.invalid', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('coord.teste@teste.invalid');
  insert into public.obras_envio (obra_id, tipo, referencia) values ('00000000-0000-4000-8000-00000000a060', 'diario', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(50, 'coordenador NÃO registra envio de outro tipo (diario): igual a antes', 'só o engenheiro da obra ou administrador registra envio', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro.coord@teste.invalid');
  insert into public.obras_envio (obra_id, tipo, fase_revisao_id)
  values ('00000000-0000-4000-8000-00000000a060', 'faseamento', '00000000-0000-4000-8000-0000000e0001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(51, 'e-mail diferente do coordenador não registra envio faseamento', 'registra envio do faseamento', sqlerrm);
end $$;

do $$
declare v int;
begin
  -- Em produção, obra com cronograma salvo não se apaga (obras_versao_imutavel e
  -- obras_atividade_imutavel recusam a cascata). Este caso testa só a cascata do
  -- faseamento: desliga as duas travas aqui dentro; a exceção do bloco desfaz o ALTER.
  if exists (select 1 from pg_trigger where tgname = 'obras_versao_imutavel') then
    alter table public.obras_cronograma_versao disable trigger obras_versao_imutavel;
  end if;
  if exists (select 1 from pg_trigger where tgname = 'obras_atividade_imutavel') then
    alter table public.obras_atividade disable trigger obras_atividade_imutavel;
  end if;
  perform pg_temp.jwt(null);
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a060';
  raise exception 'ok:%|%|%',
    (select count(*) from public.obras_fase where obra_id = '00000000-0000-4000-8000-00000000a060'),
    (select count(*) from public.obras_fase_revisao where obra_id = '00000000-0000-4000-8000-00000000a060'),
    (select count(*) from public.obras_envio where obra_id = '00000000-0000-4000-8000-00000000a060');
exception when others then
  perform pg_temp.reg(52, 'apagar a obra (sem JWT) leva fases, revisões emitidas e envios em cascata', 'ok:0|0|0', sqlerrm);
end $$;

-- ============================================================
-- Review Focus 4 — camadas, regras e carimbo inválidos
-- (UPDATE na R1, rascunho, pelo engenheiro)
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set camadas = '[{"t":"extintor","at":[1.2,0.5]}]' where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(53, 'camada com coordenada > 1: recusada', 'obras_fase_revisao_camadas_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set camadas = '[{"t":"fluxo_cli","p":[[0.1,0.1],[-0.01,0.5]]}]' where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(54, 'camada com coordenada < 0 (polilinha): recusada', 'obras_fase_revisao_camadas_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set camadas = '[{"t":"piscina","at":[0.5,0.5]}]' where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(55, 'camada de tipo desconhecido: recusada', 'obras_fase_revisao_camadas_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao
     set camadas = (select jsonb_agg('{"t":"emerg","at":[0.5,0.5]}'::jsonb) from generate_series(1, 301))
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(56, '301 camadas: recusadas', 'obras_fase_revisao_camadas_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao
     set camadas = (select jsonb_agg('{"t":"emerg","at":[0.5,0.5]}'::jsonb) from generate_series(1, 300))
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'ok:%', (select jsonb_array_length(camadas) from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0002');
exception when others then
  perform pg_temp.reg(57, '300 camadas: aceitas', 'ok:300', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set camadas = '{"t":"emerg","at":[0.5,0.5]}' where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(58, 'camadas que não são array: recusadas', 'obras_fase_revisao_camadas_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set camadas = '[{"t":"zona_salao","r":[0.6,0.1,0.5,0.2]}]' where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(59, 'zona que passa da borda (x + w > 1): recusada', 'obras_fase_revisao_camadas_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set camadas = '[{"t":"drywall","p":[[0.1,0.1]]},{"t":"porta_exist"}]' where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(60, 'polilinha com 1 ponto / porta sem posição: recusadas', 'obras_fase_revisao_camadas_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set camadas = '[{"t":"emerg","at":["0.5",0.5]}]' where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(61, 'coordenada como texto: recusada', 'obras_fase_revisao_camadas_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao
     set regras = (select array_agg('Regra ' || g) from generate_series(1, 13) g)
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(62, '13 regras (limite 12): recusadas', 'obras_fase_revisao_regras_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set regras = array['Curta', repeat('x', 201)]
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(65, 'regra com 201 caracteres (limite 200): recusada', 'obras_fase_revisao_regras_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set regras = (select array_agg(repeat('r', 200)) from generate_series(1, 12))
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'ok:%', (select cardinality(regras) || '|' || char_length(regras[12])
                             from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0002');
exception when others then
  perform pg_temp.reg(66, '12 regras de 200 caracteres (no limite): aceitas', 'ok:12|200', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set carimbo = '["titulo"]' where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(63, 'carimbo que não é objeto: recusado', 'obras_fase_revisao_carimbo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao
     set camadas = '[{"id":1,"t":"zona_obra","r":[0,0,1,1],"rot":"TUDO"},{"id":2,"t":"zona_salao","r":[0.5,0.1,0.5,0.2]},
                     {"id":3,"t":"zona_atend","r":[0.1,0.1,0.1,0.1],"rot":null},{"id":4,"t":"zona_uso","r":[0.2,0.2,0.1,0.1]},
                     {"id":5,"t":"restrita","r":[0.3,0.3,0.1,0.1]},{"id":6,"t":"drywall","p":[[0,0],[1,1]]},
                     {"id":7,"t":"balcao","p":[[0.1,0.4],[0.9,0.4]]},{"id":8,"t":"porta_obra","at":[1,0.86]},
                     {"id":9,"t":"porta_exist","at":[0.98,0.34]},{"id":10,"t":"fluxo_cli","p":[[0.9,0.3],[0.7,0.4],[0.5,0.5]]},
                     {"id":11,"t":"fluxo_obra","p":[[0.9,0.8],[0.2,0.6]],"oculta":true},{"id":12,"t":"extintor","at":[0,0]},
                     {"id":13,"t":"emerg","at":[0.3,0.7]}]',
         regras = array['Uma', 'Duas'],
         carimbo = '{"titulo":"T","responsavel":"Fulano · CREA 123","base":null}'
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'ok:%', (select jsonb_array_length(camadas) from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0002');
exception when others then
  perform pg_temp.reg(64, 'os 13 tipos válidos (bordas 0 e 1, rot null, oculta) + regras + carimbo: aceitos', 'ok:13', sqlerrm);
end $$;

-- ============================================================
-- Rodada de correções (revisão da Task 1): imutáveis que faltavam,
-- escritas sem permissão, cascata com admin, congelamento da base/fase e
-- limites de tamanho (M1, M5, I1, M6)
-- ============================================================
do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_fase_revisao set obra_id = '00000000-0000-4000-8000-00000000a061'
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(67, 'obra_id da revisão em rascunho é imutável (nem admin)', 'fase, obra e número da revisão são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_fase_revisao set fase_id = '00000000-0000-4000-8000-0000000f0002'
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(68, 'fase_id da revisão em rascunho é imutável (nem admin)', 'fase, obra e número da revisão são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_fase set obra_id = '00000000-0000-4000-8000-00000000a061'
   where id = '00000000-0000-4000-8000-0000000f0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(69, 'obra_id da fase é imutável (nem admin)', 'obra_id e numero da fase são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_fase (obra_id, nome) values ('00000000-0000-4000-8000-00000000a060', 'Via RLS');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(70, 'supervisor (authenticated) cria fase: bloqueado pelo trigger', 'só o engenheiro da obra, o coordenador ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'outro.coord@teste.invalid');
  delete from public.obras_fase where id = '00000000-0000-4000-8000-0000000f0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(71, 'e-mail diferente do coordenador (authenticated) apaga fase: bloqueado', 'só o engenheiro da obra, o coordenador ou administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_envio set obra_id = '00000000-0000-4000-8000-00000000a061'
   where id = '00000000-0000-4000-8000-0000000d0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(72, 'UPDATE do obra_id do envio faseamento para outra obra: recusado (nem sem JWT)', 'fase_revisao_id é de outra obra', sqlerrm);
end $$;

do $$ begin
  -- Em produção, obra com cronograma salvo não se apaga (obras_versao_imutavel e
  -- obras_atividade_imutavel recusam a cascata). Este caso testa só a cascata do
  -- faseamento: desliga as duas travas aqui dentro; a exceção do bloco desfaz o ALTER.
  if exists (select 1 from pg_trigger where tgname = 'obras_versao_imutavel') then
    alter table public.obras_cronograma_versao disable trigger obras_versao_imutavel;
  end if;
  if exists (select 1 from pg_trigger where tgname = 'obras_atividade_imutavel') then
    alter table public.obras_atividade disable trigger obras_atividade_imutavel;
  end if;
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a060';
  raise exception 'ok:%|%|%',
    (select count(*) from public.obras_fase where obra_id = '00000000-0000-4000-8000-00000000a060'),
    (select count(*) from public.obras_fase_revisao where obra_id = '00000000-0000-4000-8000-00000000a060'),
    (select count(*) from public.obras_envio where obra_id = '00000000-0000-4000-8000-00000000a060');
exception when others then
  perform pg_temp.reg(73, 'administrador (authenticated, JWT) apaga a obra: fases, emitidas e envios saem em cascata', 'ok:0|0|0', sqlerrm);
end $$;

select pg_temp.reg(74, 'R0 emitida congelou planta (caminho e dimensões do mapa) e fase (nome e número)',
  'ok:t|1200x840|Fase 1 · Demolição e reforço|1',
  (select 'ok:' || pg_temp.tf(planta_path = '00000000-0000-4000-8000-00000000a060/mapa/55555555-5555-4555-8555-555555555555.png')
          || '|' || planta_largura || 'x' || planta_altura || '|' || fase_nome || '|' || fase_numero
     from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0001'));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_mapa set planta_path = '00000000-0000-4000-8000-00000000a060/mapa/66666666-6666-4666-8666-666666666666.jpg',
                               planta_largura = 800, planta_altura = 800
   where obra_id = '00000000-0000-4000-8000-00000000a060';
  update public.obras_fase set nome = 'Fase 1 renomeada' where id = '00000000-0000-4000-8000-0000000f0001';
  raise exception 'ok:%', (select pg_temp.tf(planta_path like '%55555555-5555-4555-8555-555555555555.png')
                                  || '|' || planta_largura || 'x' || planta_altura || '|' || fase_nome
                             from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0001');
exception when others then
  perform pg_temp.reg(75, 'trocar a planta do mapa e renomear a fase NÃO muda a R0 emitida',
    'ok:t|1200x840|Fase 1 · Demolição e reforço', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_fase_revisao set planta_path = null where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(76, 'emitida: planta congelada não muda (nem sem JWT)', 'revisão emitida é imutável', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_fase_revisao set fase_nome = 'Outro nome', planta_largura = 10
   where id = '00000000-0000-4000-8000-0000000e0001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(77, 'emitida: nome da fase e dimensões congelados não mudam (nem admin)', 'revisão emitida é imutável', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao
     set planta_path = 'forjado.png', planta_largura = 1, planta_altura = 1, fase_nome = 'Forjado', fase_numero = 9
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'ok:%', (select concat_ws('|', coalesce(planta_path, 'null'), coalesce(planta_largura::text, 'null'),
                                            coalesce(planta_altura::text, 'null'), coalesce(fase_nome, 'null'),
                                            coalesce(fase_numero::text, 'null'))
                             from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0002');
exception when others then
  perform pg_temp.reg(78, 'rascunho: planta e fase ficam NULL (forjados ignorados)', 'ok:null|null|null|null|null', sqlerrm);
end $$;

select pg_temp.reg(79, 'rascunho criado (R1) nasce com planta e fase NULL',
  'ok:t',
  (select 'ok:' || pg_temp.tf(planta_path is null and planta_largura is null and planta_altura is null
                              and fase_nome is null and fase_numero is null)
     from public.obras_fase_revisao where id = '00000000-0000-4000-8000-0000000e0002'));

do $$
declare v public.obras_fase_revisao;
begin
  perform pg_temp.jwt(null);
  insert into public.obras_fase (id, obra_id, nome) values ('00000000-0000-4000-8000-0000000f0201', '00000000-0000-4000-8000-00000000a062', 'Fase C');
  insert into public.obras_fase_revisao (id, fase_id) values ('00000000-0000-4000-8000-0000000e0301', '00000000-0000-4000-8000-0000000f0201');
  v := public.obras_emitir_fase_revisao('00000000-0000-4000-8000-0000000e0301');
  raise exception 'ok:%|%|%|%|%', v.status, coalesce(v.planta_path, 'null'), coalesce(v.planta_largura::text, 'null'),
                                  v.fase_nome, v.fase_numero;
exception when others then
  perform pg_temp.reg(80, 'obra sem mapa: emitida com planta NULL (quadro branco) e fase congelada', 'ok:emitida|null|null|Fase C|1', sqlerrm);
end $$;

do $$
declare v public.obras_fase_revisao;
begin
  perform pg_temp.jwt(null);
  insert into public.obras_mapa (obra_id, modo) values ('00000000-0000-4000-8000-00000000a062', 'ambientes');
  insert into public.obras_fase (id, obra_id, nome) values ('00000000-0000-4000-8000-0000000f0201', '00000000-0000-4000-8000-00000000a062', 'Fase C');
  insert into public.obras_fase_revisao (id, fase_id) values ('00000000-0000-4000-8000-0000000e0301', '00000000-0000-4000-8000-0000000f0201');
  v := public.obras_emitir_fase_revisao('00000000-0000-4000-8000-0000000e0301');
  raise exception 'ok:%|%|%', coalesce(v.planta_path, 'null'), coalesce(v.planta_largura::text, 'null'), coalesce(v.planta_altura::text, 'null');
exception when others then
  perform pg_temp.reg(81, 'obra com mapa sem planta: emitida com planta NULL', 'ok:null|null|null', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao
     set camadas = (select jsonb_agg(jsonb_build_object('t', 'emerg', 'at', '[0.5,0.5]'::jsonb, 'id', repeat(md5(g::text), 30)))
                      from generate_series(1, 300) g)
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(82, 'camadas válidas mas > 256 KiB (300 itens com id de ~1 KB): recusadas', 'obras_fase_revisao_camadas_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao set carimbo = jsonb_build_object(repeat('k', 41), 'v')
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(83, 'carimbo com chave de 41 caracteres: recusado', 'obras_fase_revisao_carimbo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao
     set carimbo = (select jsonb_object_agg('c' || g, repeat('é', 300)) from generate_series(1, 20) g)
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(84, 'carimbo > 8 KiB (20 valores de 300 "é"): recusado', 'obras_fase_revisao_carimbo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_fase_revisao
     set carimbo = (select jsonb_object_agg(repeat('k', 38) || lpad(g::text, 2, '0'), repeat('v', 300)) from generate_series(1, 20) g)
   where id = '00000000-0000-4000-8000-0000000e0002';
  raise exception 'ok:%', (select count(*) from jsonb_object_keys((select carimbo from public.obras_fase_revisao
                                                                    where id = '00000000-0000-4000-8000-0000000e0002')));
exception when others then
  perform pg_temp.reg(85, 'carimbo no limite (20 chaves de 40, valores de 300 ASCII): aceito', 'ok:20', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform public.obras_fase_camadas_validas('[]');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(86, 'anon não executa os validadores (/rpc)', 'permission denied', sqlerrm);
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
  if v_total <> 86 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 86 testes rodaram';
  end if;
  raise exception 'RESUMO: %/86 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
