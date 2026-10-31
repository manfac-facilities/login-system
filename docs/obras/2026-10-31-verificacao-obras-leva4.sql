-- ============================================================
-- Teste de comportamento de sdd-sql-obras-leva4.sql
-- Rodar DEPOIS de aplicar a migration (e as das Levas 2 e 3), no SQL Editor,
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
-- Roda como postgres (acima da RLS): testa o TRIGGER, os checks e o vínculo
-- do envio. A RLS em si é conferida estruturalmente (verificação da
-- migration); o JWT é simulado por set_config('request.jwt.claims').
--
-- Fixture (só dentro da transação):
--   obra A TESTE-VERIF-LEVA4-A (OBRA, engenheiro eng.teste@teste.invalid);
--   obra B TESTE-VERIF-LEVA4-B (OBRA, sem engenheiro);
--   relatório M1 de A: mensal '2026-11', período 2026-11-01..2026-11-30,
--   criado pelo engenheiro (rascunho);
--   relatório MB de B: mensal '2026-11' (rascunho, sem JWT).
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

select pg_temp.jwt(null);

insert into public.obras_obra (id, os, modalidade, engenheiro_email)
values ('00000000-0000-4000-8000-00000000a008', 'TESTE-VERIF-LEVA4-A', 'obra', 'eng.teste@teste.invalid'),
       ('00000000-0000-4000-8000-00000000a009', 'TESTE-VERIF-LEVA4-B', 'obra', null);

-- MB: relatório da obra B, sem JWT
insert into public.obras_relatorio (id, obra_id, tipo, referencia, periodo_inicio, periodo_fim)
values ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000a009', 'mensal', '2026-11',
        '2026-11-01', '2026-11-30');

-- M1: relatório mensal da obra A pelo engenheiro
select pg_temp.jwt('eng.teste@teste.invalid');
insert into public.obras_relatorio (id, obra_id, tipo, referencia, periodo_inicio, periodo_fim, observacoes)
values ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a008', 'mensal', '2026-11',
        '2026-11-01', '2026-11-30', 'obs inicial');
select pg_temp.jwt(null);

-- ============================================================
-- obras_relatorio: criação e autorização
-- ============================================================
select pg_temp.reg(1, 'engenheiro cria relatório: nasce rascunho, sem validado_*/conteudo', 'ok:rascunho|t',
  (select 'ok:' || estado || '|' || pg_temp.tf(validado_por is null and validado_em is null and conteudo is null)
     from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001'));

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim, estado, conteudo)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-12', '2026-12-01', '2026-12-31', 'validado', '{}');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(2, 'relatório novo já validado (com JWT): bloqueado', 'nasce como rascunho', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim, validado_por)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-12', '2026-12-01', '2026-12-31', 'falsificado@teste.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(3, 'relatório novo com validado_por forjado: bloqueado', 'nasce como rascunho', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-12', '2026-12-01', '2026-12-31');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(4, 'quem não é engenheiro da obra nem admin cria relatório: bloqueado', 'OBRAS_RELATORIO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a009', 'entrega', 'entrega', '2026-11-01', '2026-12-31');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(5, 'engenheiro de outra obra cria relatório na obra B: bloqueado', 'OBRAS_RELATORIO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_relatorio (id, obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000c009', '00000000-0000-4000-8000-00000000a009', 'entrega', 'entrega', '2026-11-01', '2026-12-31');
  raise exception 'ok:%', (select estado from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c009');
exception when others then
  perform pg_temp.reg(6, 'administrador cria relatório em obra sem engenheiro: passa', 'ok:rascunho', sqlerrm);
end $$;

-- ============================================================
-- obras_relatorio: tipo, referencia por tipo, período, único
-- ============================================================
do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-13', '2026-12-01', '2026-12-31');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(7, 'mensal com mês 13: check de referencia', 'obras_relatorio_referencia_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-1', '2026-01-01', '2026-01-31');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(8, 'mensal fora de AAAA-MM: check de referencia', 'obras_relatorio_referencia_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'fase', '01', '2026-11-01', '2026-11-20');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(9, 'fase com zero à esquerda (duplicaria a etapa 1): check de referencia', 'obras_relatorio_referencia_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'fase', 'a', '2026-11-01', '2026-11-20');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(10, 'fase com referencia não numérica: check de referencia', 'obras_relatorio_referencia_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'entrega', 'final', '2026-11-01', '2026-12-31');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(11, 'entrega com referencia diferente de entrega: check de referencia', 'obras_relatorio_referencia_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '3', '2026-11-01', '2026-11-20');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(12, 'mensal com referencia de fase (tipo cruzado): check de referencia', 'obras_relatorio_referencia_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim) values
    ('00000000-0000-4000-8000-00000000a008', 'fase', '0', '2026-11-01', '2026-11-10'),
    ('00000000-0000-4000-8000-00000000a008', 'fase', '12', '2026-11-11', '2026-11-20'),
    ('00000000-0000-4000-8000-00000000a008', 'entrega', 'entrega', '2026-11-01', '2026-12-31'),
    ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-12', '2026-12-01', '2026-12-31');
  raise exception 'ok:%', (select count(*) from public.obras_relatorio where obra_id = '00000000-0000-4000-8000-00000000a008');
exception when others then
  perform pg_temp.reg(13, 'referencias válidas (fase 0 e 12, entrega, mensal 2026-12): passam', 'ok:5', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'semanal', '2026-11', '2026-11-01', '2026-11-30');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(14, 'tipo de relatório fora de mensal/fase/entrega: check', 'obras_relatorio_tipo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-12', '2026-12-31', '2026-12-01');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(15, 'periodo_inicio depois de periodo_fim: check', 'obras_relatorio_periodo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'fase', '2', '2026-11-05', '2026-11-05');
  raise exception 'ok:%', (select count(*) from public.obras_relatorio
                            where obra_id = '00000000-0000-4000-8000-00000000a008' and tipo = 'fase' and referencia = '2');
exception when others then
  perform pg_temp.reg(16, 'período de um dia (início = fim): passa', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_relatorio set periodo_fim = '2026-10-01' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(17, 'UPDATE que inverte o período: check', 'obras_relatorio_periodo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-11', '2026-11-01', '2026-11-30');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(18, 'dois relatórios mesma obra/tipo/referencia: unique', 'obras_relatorio_obra_tipo_referencia_key', sqlerrm);
end $$;

select pg_temp.reg(19, 'mesmo tipo/referencia em obras diferentes: permitido (M1 e MB coexistem)', 'ok:2',
  (select 'ok:' || count(*) from public.obras_relatorio where tipo = 'mensal' and referencia = '2026-11'
      and obra_id in ('00000000-0000-4000-8000-00000000a008', '00000000-0000-4000-8000-00000000a009')));

-- ============================================================
-- obras_relatorio: rascunho
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio
     set observacoes = 'obs editada', highlights = '[{"id":"h1","texto":"x"}]', periodo_fim = '2026-11-27'
   where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'ok:%|%|%', (select observacoes from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001'),
    (select highlights #>> '{0,id}' from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001'),
    (select periodo_fim from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001');
exception when others then
  perform pg_temp.reg(20, 'engenheiro edita observações, highlights e período em rascunho: passa', 'ok:obs editada|h1|2026-11-27', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  update public.obras_relatorio set observacoes = 'intruso' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(21, 'quem não é engenheiro da obra nem admin edita rascunho: bloqueado', 'OBRAS_RELATORIO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set referencia = '2026-12' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(22, 'mudar referencia em rascunho: bloqueado', 'tipo e referencia são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_relatorio set tipo = 'entrega', referencia = 'entrega' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(23, 'mudar tipo em rascunho (admin): bloqueado', 'tipo e referencia são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_relatorio set obra_id = '00000000-0000-4000-8000-00000000a009', referencia = '2026-10'
   where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(24, 'mudar obra_id (sem JWT): bloqueado', 'tipo e referencia são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set validado_por = 'falsificado@teste.invalid' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(25, 'validado_por mexido em rascunho sem validar: bloqueado', 'só mudam na validação', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set estado = 'enviado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(26, 'rascunho -> enviado direto: bloqueado', 'transição rascunho -> enviado', sqlerrm);
end $$;

-- conteudo congelado (jsonb): nulo em rascunho, obrigatório ao validar, imutável depois
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set estado = 'validado' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(27, 'validar sem conteudo: bloqueado', 'validar exige o conteudo', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set estado = 'validado', conteudo = '[]' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(28, 'validar com conteudo que não é objeto: bloqueado', 'validar exige o conteudo', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(29, 'conteudo gravado em rascunho sem validar: bloqueado', 'nulo em rascunho', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim, estado)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-12', '2026-12-01', '2026-12-31', 'validado');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(30, 'sem JWT: relatório inserido validado sem conteudo: bloqueado', 'nulo em rascunho', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (obra_id, tipo, referencia, periodo_inicio, periodo_fim, conteudo)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '2026-12', '2026-12-01', '2026-12-31', '{"cliente":{}}');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(31, 'sem JWT: rascunho inserido com conteudo: bloqueado', 'nulo em rascunho', sqlerrm);
end $$;

-- ============================================================
-- obras_relatorio: validação e depois
-- ============================================================
do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(32, 'quem não é engenheiro da obra nem admin valida: bloqueado', 'OBRAS_RELATORIO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio
     set estado = 'validado', conteudo = '{"cliente":{}}',
         validado_por = 'falsificado@teste.invalid', validado_em = timestamptz '2100-01-01'
   where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'ok:%|%', (select validado_por from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001'),
    (select pg_temp.tf(validado_em = now()) from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001');
exception when others then
  perform pg_temp.reg(33, 'engenheiro valida: validado_por = sessão, validado_em = now() (não falsificáveis)', 'ok:eng.teste@teste.invalid|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'ok:%', (select pg_temp.tf(validado_por = lower(pg_temp.admin_email()))
                             from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001');
exception when others then
  perform pg_temp.reg(34, 'administrador valida: passa, carimbo do admin', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set observacoes = 'mudou depois' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(35, 'observações depois de validado: bloqueado', 'não pode ter o conteúdo alterado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set highlights = '[{"id":"h2","texto":"y"}]' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(36, 'highlights depois de validado (admin): bloqueado', 'não pode ter o conteúdo alterado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{"a":1}}' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set conteudo = '{"cliente":{"a":2}}' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(37, 'conteudo alterado depois de validado: bloqueado', 'não pode ter o conteúdo alterado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set periodo_inicio = '2026-11-02' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(38, 'período depois de validado (sem JWT): bloqueado', 'não pode ter o conteúdo alterado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set validado_em = timestamptz '2100-01-01' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(39, 'validado_em forjado depois de validado (admin): bloqueado', 'não pode ter o conteúdo alterado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set estado = 'rascunho' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(40, 'validado -> rascunho (até admin): bloqueado', 'transição validado -> rascunho', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{"a":1}}' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set estado = 'enviado' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'ok:%|%', (select estado from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001'),
    (select conteudo #>> '{cliente,a}' from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001');
exception when others then
  perform pg_temp.reg(41, 'valida com conteudo e envia: passa, conteudo preservado', 'ok:enviado|1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set estado = 'enviado' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set estado = 'validado' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(42, 'enviado -> validado (sem JWT): bloqueado', 'transição enviado -> validado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set estado = 'enviado' where id = '00000000-0000-4000-8000-00000000c001';
  update public.obras_relatorio set observacoes = 'depois do envio' where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(43, 'observações depois de enviado (sem JWT): bloqueado', 'relatório enviado não pode ter o conteúdo alterado', sqlerrm);
end $$;

-- ============================================================
-- obras_relatorio: DELETE (só rascunho é garantido pela policy, conferida na migration)
-- ============================================================
do $$ begin
  perform pg_temp.jwt('intruso.teste@teste.invalid');
  delete from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(44, 'quem não é engenheiro da obra nem admin apaga relatório: bloqueado', 'OBRAS_RELATORIO: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'ok:%', (select count(*) from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001');
exception when others then
  perform pg_temp.reg(45, 'engenheiro apaga rascunho: passa', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'ok:%', (select count(*) from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001');
exception when others then
  perform pg_temp.reg(46, 'sem JWT (service role/SQL Editor) apaga: passa', 'ok:0', sqlerrm);
end $$;

-- ============================================================
-- obras_envio: tipos mensal/fase/entrega e relatorio_id
-- ============================================================
do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_relatorio (id, obra_id, tipo, referencia, periodo_inicio, periodo_fim) values
    ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000a008', 'fase', '1', '2026-11-01', '2026-11-20'),
    ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-00000000a008', 'entrega', 'entrega', '2026-11-01', '2026-12-31');
  insert into public.obras_envio (id, obra_id, tipo, relatorio_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000e005', '00000000-0000-4000-8000-00000000a008', 'mensal',
          '00000000-0000-4000-8000-00000000c001', 'cliente', 'ok');
  insert into public.obras_envio (obra_id, tipo, relatorio_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000a008', 'fase', '00000000-0000-4000-8000-00000000c003', 'cliente', 'ok'),
         ('00000000-0000-4000-8000-00000000a008', 'entrega', '00000000-0000-4000-8000-00000000c004', 'interno', 'ok');
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values
    ('00000000-0000-4000-8000-00000000a008', 'diario', 'cliente', 'ok'),
    ('00000000-0000-4000-8000-00000000a008', 'ata', 'cliente', 'ok'),
    ('00000000-0000-4000-8000-00000000a008', 'imediata', 'cliente', 'ok'),
    ('00000000-0000-4000-8000-00000000a008', 'semanal', 'cliente', 'ok');
  raise exception 'ok:%|%', (select relatorio_id::text from public.obras_envio where id = '00000000-0000-4000-8000-00000000e005'),
    (select count(*) from public.obras_envio where obra_id = '00000000-0000-4000-8000-00000000a008');
exception when others then
  perform pg_temp.reg(47, 'envio aceita mensal/fase/entrega (com relatorio_id) e diario, ata, imediata, semanal',
    'ok:00000000-0000-4000-8000-00000000c001|7', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a008', 'quinzenal', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(48, 'envio com tipo fora da lista: check', 'obras_envio_tipo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (obra_id, tipo, relatorio_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '00000000-0000-4000-8000-00000000c002', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(49, 'envio da obra A com relatorio_id da obra B: bloqueado', 'relatorio_id é de outra obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (obra_id, tipo, relatorio_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000a008', 'fase', '00000000-0000-4000-8000-00000000c001', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(50, 'envio tipo fase com relatorio_id de um mensal: bloqueado', 'outro tipo de relatório', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo, relatorio_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000a008', null, '00000000-0000-4000-8000-00000000c001', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(51, 'envio sem tipo com relatorio_id (sem JWT): bloqueado', 'outro tipo de relatório', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (id, obra_id, tipo, relatorio_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000e006', '00000000-0000-4000-8000-00000000a008', 'mensal',
          '00000000-0000-4000-8000-00000000c001', 'cliente', 'ok');
  update public.obras_envio set tipo = 'entrega' where id = '00000000-0000-4000-8000-00000000e006';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(52, 'UPDATE do tipo de envio vinculado a relatório de outro tipo: bloqueado', 'outro tipo de relatório', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (id, obra_id, tipo, relatorio_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000e006', '00000000-0000-4000-8000-00000000a008', 'mensal',
          '00000000-0000-4000-8000-00000000c001', 'cliente', 'ok');
  update public.obras_envio set relatorio_id = '00000000-0000-4000-8000-00000000c002' where id = '00000000-0000-4000-8000-00000000e006';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(53, 'UPDATE do relatorio_id para relatório de outra obra: bloqueado', 'relatorio_id é de outra obra', sqlerrm);
end $$;

do $$ begin
  -- envio feito pelo administrador; o engenheiro tenta apagar o relatório
  -- (rascunho): a FK NO ACTION recusa (envio feito não perde o relatório).
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (id, obra_id, tipo, relatorio_id, lado, resultado, enviado_por)
  values ('00000000-0000-4000-8000-00000000e007', '00000000-0000-4000-8000-00000000a008', 'mensal',
          '00000000-0000-4000-8000-00000000c001', 'cliente', 'ok', 'falsificado@teste.invalid');
  perform pg_temp.jwt('eng.teste@teste.invalid');
  delete from public.obras_relatorio where id = '00000000-0000-4000-8000-00000000c001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(54, 'apagar relatório que tem envio: bloqueado pela FK', 'obras_envio_relatorio_id_fkey', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (id, obra_id, tipo, relatorio_id, lado, resultado, enviado_por)
  values ('00000000-0000-4000-8000-00000000e007', '00000000-0000-4000-8000-00000000a008', 'mensal',
          '00000000-0000-4000-8000-00000000c001', 'cliente', 'ok', 'falsificado@teste.invalid');
  raise exception 'ok:%', (select pg_temp.tf(enviado_por = lower(pg_temp.admin_email()))
                             from public.obras_envio where id = '00000000-0000-4000-8000-00000000e007');
exception when others then
  perform pg_temp.reg(59, 'envio de relatório: enviado_por = sessão (não falsificável)', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a008', 'mensal', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(60, 'envio mensal sem relatorio_id: check', 'obras_envio_relatorio_obrigatorio', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a008', 'fase', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(61, 'envio fase sem relatorio_id: check', 'obras_envio_relatorio_obrigatorio', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (obra_id, tipo, lado, resultado) values ('00000000-0000-4000-8000-00000000a008', 'entrega', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(62, 'envio entrega sem relatorio_id: check', 'obras_envio_relatorio_obrigatorio', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_envio (id, obra_id, tipo, relatorio_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000e008', '00000000-0000-4000-8000-00000000a008', 'mensal',
          '00000000-0000-4000-8000-00000000c001', 'cliente', 'ok');
  update public.obras_envio set relatorio_id = null where id = '00000000-0000-4000-8000-00000000e008';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(63, 'UPDATE que tira o relatorio_id de envio mensal: check', 'obras_envio_relatorio_obrigatorio', sqlerrm);
end $$;

-- Regressão das Levas 2 e 3: o trigger recriado continua conferindo registro_id e semanal_id
do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_semanal (id, obra_id, semana_inicio)
  values ('00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000a009', '2026-11-02');
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (obra_id, tipo, semanal_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000a008', 'semanal', '00000000-0000-4000-8000-00000000b003', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(55, 'envio da obra A com semanal_id da obra B: bloqueado (Leva 3)', 'semanal_id é de outra obra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_registro (id, obra_id, tipo)
  values ('00000000-0000-4000-8000-00000000d007', '00000000-0000-4000-8000-00000000a009', 'reuniao');
  perform pg_temp.jwt(pg_temp.admin_email());
  insert into public.obras_envio (obra_id, tipo, registro_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000a008', 'ata', '00000000-0000-4000-8000-00000000d007', 'cliente', 'ok');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(56, 'envio da obra A com registro_id da obra B: bloqueado (Leva 2)', 'registro_id é de outra obra', sqlerrm);
end $$;

-- ============================================================
-- Cascata da obra (com JWT de não administrador)
-- ============================================================
do $$ begin
  -- M1 validado + envio vinculado; o engenheiro (não admin) apaga a obra A:
  -- relatórios e envios saem em cascata (a guarda não trava a cascata).
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_relatorio set estado = 'validado', conteudo = '{"cliente":{}}' where id = '00000000-0000-4000-8000-00000000c001';
  insert into public.obras_envio (obra_id, tipo, relatorio_id, lado, resultado)
  values ('00000000-0000-4000-8000-00000000a008', 'mensal', '00000000-0000-4000-8000-00000000c001', 'cliente', 'ok');
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000a008';
  raise exception 'ok:%|%',
    (select count(*) from public.obras_relatorio where obra_id = '00000000-0000-4000-8000-00000000a008'),
    (select count(*) from public.obras_envio where obra_id = '00000000-0000-4000-8000-00000000a008');
exception when others then
  perform pg_temp.reg(57, 'apagar a obra leva relatórios (inclusive validado) e envios em cascata', 'ok:0|0', sqlerrm);
end $$;

select pg_temp.reg(58, 'existe administrador para os testes de admin', 't',
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
  if v_total <> 63 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 63 testes rodaram';
  end if;
  raise exception 'RESUMO: %/63 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
