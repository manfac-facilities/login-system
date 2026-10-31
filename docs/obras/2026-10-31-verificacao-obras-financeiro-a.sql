-- ============================================================
-- Teste de comportamento de sdd-sql-obras-financeiro-a.sql
-- Rodar DEPOIS de aplicar a migration (e a Leva 5), no SQL Editor,
-- projeto iyytcavcgukfjnjjrerx.
-- Rodar o arquivo INTEIRO de uma vez. NÃO GRAVA NADA: tudo roda numa
-- transação e o bloco final termina em erro de propósito (desfaz tudo).
-- A mensagem de erro final é o relatório:
--   "RESUMO: N/N OK"               -> tudo certo
--   "RESUMO: x/N OK — FALHOU: ..." -> parar e não deployar
-- Sem a linha "RESUMO" = algo quebrou antes (erro diferente do esperado).
--
-- Padrão da Leva 5: cada teste roda num bloco do $$ ... $$ que termina em
-- erro (o esperado, ou raise 'ok:...'), o que desfaz o que ele fez,
-- inclusive a troca de role. Booleanos como t/f (pg_temp.tf).
--   * pg_temp.jwt(email): JWT simulado como postgres (testa triggers);
--   * pg_temp.como(role, email): troca a role para authenticated / anon /
--     service_role com o JWT daquele e-mail (testa GRANT e RLS de verdade).
--
-- Cobre o Review Focus do plano: 1 (engenheiro de outra obra, usuário comum,
-- sem papel -> vazio), 4 (restrição ligada a pedido de outra obra é
-- recusada), 5 (lista de pedidos para vincular sem valor) + grants (anon não
-- executa) + OS filha (só admin, um nível, sem ciclo, modalidade obra).
--
-- Fixture (só dentro da transação; e-mails .invalid, nada pessoal):
--   obra A TESTE-FIN-A-MAE   (OBRA, engenheiro eng.a@teste.invalid)
--   obra F TESTE-FIN-A-FILHA (OBRA, filha de A, engenheiro eng.f@teste.invalid)
--   obra B TESTE-FIN-A-OUTRA (OBRA, engenheiro eng.b@teste.invalid)
--   obra S TESTE-FIN-A-SPOT  (SPOT)
--   acesso ao Obras: eng.a, eng.f, eng.b, usuario.obras, fin.teste, fin.revogado
--   fin_papeis: fin.teste financeiro (ativo); fin.semobras diretor (ativo, SEM
--   acesso ao Obras); fin.revogado financeiro (revogado).
--   Compras: solicitação+pedido em A (123456 centavos), F (20000), B (99999).
--   Fornecedores: contrato CT-TFA-1 em A (MO 1000.50) com medição 250.75;
--   contrato CT-TFA-2 em B.
--   Faturamento: nota N1 rateada A 60000 + F 40000 (total 100000); nota N2 em B.
--   Restrição R1 (Material) em A, sem pedido.
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

-- Soma de linhas das 3 leituras de valor para uma obra (chamada na role corrente).
create function pg_temp.linhas(p_obra uuid) returns bigint language sql as $$
  select (select count(*) from public.obras_fin_compras(p_obra))
       + (select count(*) from public.obras_fin_fornecedores(p_obra))
       + (select count(*) from public.obras_fin_notas(p_obra));
$$;

select pg_temp.jwt(null);

-- Obras (sem JWT: a guarda de parâmetros só confere a estrutura mãe/filha)
insert into public.obras_obra (id, os, modalidade, engenheiro_email)
values ('00000000-0000-4000-8000-00000000fa01', 'TESTE-FIN-A-MAE',   'obra', 'eng.a@teste.invalid'),
       ('00000000-0000-4000-8000-00000000fa03', 'TESTE-FIN-A-OUTRA', 'obra', 'eng.b@teste.invalid'),
       ('00000000-0000-4000-8000-00000000fa04', 'TESTE-FIN-A-SPOT',  'spot', null);
insert into public.obras_obra (id, os, modalidade, engenheiro_email, obra_pai_id)
values ('00000000-0000-4000-8000-00000000fa02', 'TESTE-FIN-A-FILHA', 'obra', 'eng.f@teste.invalid',
        '00000000-0000-4000-8000-00000000fa01');

insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
values ('eng.a@teste.invalid', 'obras', true, 'verificacao-fin-a'),
       ('eng.f@teste.invalid', 'obras', true, 'verificacao-fin-a'),
       ('eng.b@teste.invalid', 'obras', true, 'verificacao-fin-a'),
       ('usuario.obras@teste.invalid', 'obras', true, 'verificacao-fin-a'),
       ('fin.teste@teste.invalid', 'obras', true, 'verificacao-fin-a'),
       ('fin.revogado@teste.invalid', 'obras', true, 'verificacao-fin-a');

insert into public.fin_papeis (user_email, papel)
values ('fin.teste@teste.invalid', 'financeiro'),
       ('fin.semobras@teste.invalid', 'diretor'),
       ('fin.revogado@teste.invalid', 'financeiro');
update public.fin_papeis set ativo = false where user_email = 'fin.revogado@teste.invalid';

-- Compras: solicitação -> mapa -> fornecedor do mapa -> pedido, em A, F e B
insert into public.cmp_solicitacoes
  (id, ambiente, numero, etapa, tipo, solicitante_email, solicitante_nome, cc_codigo, cc_descricao,
   obra_id, obra_os, motivo, prazo_necessario, recebimento, urgente, enviado_em, dia_referencia, data_minima)
select x.id, 'producao', x.numero, 'pedido_emitido', 'material', 'solicitante@teste.invalid', 'Solicitante Teste',
       '10159908939', 'DPSP - OBRAS', x.obra, x.os, 'Material para teste do financeiro da obra',
       current_date + 10, 'base', false, now(), current_date, current_date
  from (values ('00000000-0000-4000-8000-00000000fb01'::uuid, 999000101::bigint, '00000000-0000-4000-8000-00000000fa01'::uuid, 'TESTE-FIN-A-MAE'),
               ('00000000-0000-4000-8000-00000000fb02'::uuid, 999000102::bigint, '00000000-0000-4000-8000-00000000fa02'::uuid, 'TESTE-FIN-A-FILHA'),
               ('00000000-0000-4000-8000-00000000fb03'::uuid, 999000103::bigint, '00000000-0000-4000-8000-00000000fa03'::uuid, 'TESTE-FIN-A-OUTRA'))
       as x(id, numero, obra, os);

insert into public.cmp_mapas (id, solicitacao_id, rodada, situacao, criado_por)
values ('00000000-0000-4000-8000-00000000fc01', '00000000-0000-4000-8000-00000000fb01', 1, 'aprovado', 'comprador@teste.invalid'),
       ('00000000-0000-4000-8000-00000000fc02', '00000000-0000-4000-8000-00000000fb02', 1, 'aprovado', 'comprador@teste.invalid'),
       ('00000000-0000-4000-8000-00000000fc03', '00000000-0000-4000-8000-00000000fb03', 1, 'aprovado', 'comprador@teste.invalid');

insert into public.cmp_mapa_fornecedores (id, mapa_id, ordem, razao_social, frete_tipo)
values ('00000000-0000-4000-8000-00000000fd01', '00000000-0000-4000-8000-00000000fc01', 1, 'Fornecedor Compras Teste A', 'incluso'),
       ('00000000-0000-4000-8000-00000000fd02', '00000000-0000-4000-8000-00000000fc02', 1, 'Fornecedor Compras Teste F', 'incluso'),
       ('00000000-0000-4000-8000-00000000fd03', '00000000-0000-4000-8000-00000000fc03', 1, 'Fornecedor Compras Teste B', 'incluso');

insert into public.cmp_pedidos
  (id, solicitacao_id, ambiente, sequencia, mapa_fornecedor_id, codigo_integracao, pagamento, condicao_codigo,
   total_centavos, situacao, etapa_atual, previsao_entrega)
values ('00000000-0000-4000-8000-00000000fe01', '00000000-0000-4000-8000-00000000fb01', 'producao', 1,
        '00000000-0000-4000-8000-00000000fd01', 'TFA-PA', 'faturado', '000', 123456, 'emitido', 'pedido', current_date + 5),
       ('00000000-0000-4000-8000-00000000fe02', '00000000-0000-4000-8000-00000000fb02', 'producao', 1,
        '00000000-0000-4000-8000-00000000fd02', 'TFA-PF', 'faturado', '000', 20000, 'emitido', 'pedido', current_date + 5),
       ('00000000-0000-4000-8000-00000000fe03', '00000000-0000-4000-8000-00000000fb03', 'producao', 1,
        '00000000-0000-4000-8000-00000000fd03', 'TFA-PB', 'faturado', '000', 99999, 'emitido', 'pedido', current_date + 5);

-- Fornecedores: contrato (rascunho dispensa os campos de aprovação) e medição
insert into public.frn_fornecedores (id, omie_codigo, documento, razao_social, origem)
values ('00000000-0000-4000-8000-00000000ff01', 9999990001, '99999999000191', 'Fornecedor Contrato Teste', 'carga_inicial');

insert into public.frn_contratos (id, seq, numero, fornecedor_id, tipo, criado_por, status, obra_id, valor_mo, valor_mat)
values ('00000000-0000-4000-8000-00000000f101', 9999990001, 'CT-TFA-1', '00000000-0000-4000-8000-00000000ff01',
        'especifico', 'comprador@teste.invalid', 'rascunho', '00000000-0000-4000-8000-00000000fa01', 1000.50, 0),
       ('00000000-0000-4000-8000-00000000f102', 9999990002, 'CT-TFA-2', '00000000-0000-4000-8000-00000000ff01',
        'especifico', 'comprador@teste.invalid', 'rascunho', '00000000-0000-4000-8000-00000000fa03', 500, 0);

insert into public.frn_medicoes
  (id, seq, numero, contrato_id, item, modo, descricao, valor, percentual, condicao_codigo, condicao_versao,
   competencia, forma_pagamento, codigo_pagamento, categoria_codigo, categoria_nome, tipo_documento_codigo,
   tipo_documento_nome, cc_codigo, cc_nome, solicitado_por, status)
select '00000000-0000-4000-8000-00000000f201', 9999990001, 'MD-TFA-1', '00000000-0000-4000-8000-00000000f101',
       'mo', 'servico', 'Medição de teste', 250.75, 10, cv.codigo, cv.versao,
       date '2026-10-01', 'boleto', '0000', 'x', 'Teste', 'x', 'Teste', '10159908939', 'DPSP - OBRAS',
       'eng.a@teste.invalid', 'solicitada'
  from (select codigo, versao from public.frn_condicoes_versoes order by codigo, versao limit 1) cv;

-- Faturamento: nota rateada entre mãe e filha, e uma nota da outra obra
insert into public.fin_fat_lotes (id, ambiente, tipo_id, referencia, criado_por_email, criado_por_nome)
select '00000000-0000-4000-8000-00000000f301', 'producao', t.id, 'TESTE-FIN-A', 'fin.teste@teste.invalid', 'Fin Teste'
  from (select id from public.fin_fat_tipos order by id limit 1) t;

insert into public.fin_fat_notas (id, lote_id, ambiente, tomador_cnpj, valor_total_centavos, situacao)
values ('00000000-0000-4000-8000-00000000f401', '00000000-0000-4000-8000-00000000f301', 'producao', '00000000000000', 100000, 'rascunho'),
       ('00000000-0000-4000-8000-00000000f402', '00000000-0000-4000-8000-00000000f301', 'producao', '00000000000000', 77777, 'rascunho');

insert into public.fin_fat_nota_obras (nota_id, obra_id, os, valor_centavos, forma)
values ('00000000-0000-4000-8000-00000000f401', '00000000-0000-4000-8000-00000000fa01', 'TESTE-FIN-A-MAE', 60000, 'manual'),
       ('00000000-0000-4000-8000-00000000f401', '00000000-0000-4000-8000-00000000fa02', 'TESTE-FIN-A-FILHA', 40000, 'manual'),
       ('00000000-0000-4000-8000-00000000f402', '00000000-0000-4000-8000-00000000fa03', 'TESTE-FIN-A-OUTRA', 77777, 'manual');

-- Restrição R1 em A, sem pedido
insert into public.obras_restricao (id, obra_id, atividade_numero, tipo, descricao, responsavel)
values ('00000000-0000-4000-8000-00000000f501', '00000000-0000-4000-8000-00000000fa01', 1, 'material',
        'Porcelanato não entregue', 'manfac');

-- ============================================================
-- obras_pode_ver_valores (Review Focus 1), como authenticated de verdade
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(1, 'pode ver valores: administrador', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(2, 'pode ver valores: engenheiro da obra', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa02'));
exception when others then
  perform pg_temp.reg(3, 'pode ver valores: engenheiro da MÃE vê a filha', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.f@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa02'));
exception when others then
  perform pg_temp.reg(4, 'pode ver valores: engenheiro da filha vê a filha', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.f@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(5, 'pode ver valores: engenheiro da filha NÃO vê a mãe', 'ok:f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(6, 'pode ver valores: engenheiro de OUTRA obra = f', 'ok:f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(7, 'pode ver valores: usuário do Obras sem papel (supervisor) = f', 'ok:f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'fin.teste@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(8, 'pode ver valores: papel financeiro ativo + acesso ao Obras', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'fin.semobras@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(9, 'pode ver valores: diretor SEM acesso ao Obras = f', 'ok:f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'fin.revogado@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(10, 'pode ver valores: papel financeiro REVOGADO = f', 'ok:f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(11, 'pode ver valores: sem acesso nenhum = f', 'ok:f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%|%', pg_temp.tf(public.obras_pode_ver_valores(null)),
    pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-0000000fffff'));
exception when others then
  perform pg_temp.reg(12, 'pode ver valores: obra NULL e obra inexistente = f (nunca NULL)', 'ok:f|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('service_role', null);
  raise exception 'ok:%|%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01')),
    pg_temp.linhas('00000000-0000-4000-8000-00000000fa01');
exception when others then
  perform pg_temp.reg(13, 'service role sem JWT: f e leituras vazias (falha fechada)', 'ok:f|0', sqlerrm);
end $$;

-- ============================================================
-- Leituras de valor: obra + filhas, nada de outra obra, valores como gravados
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || count(distinct obra_id) || '|'
                                  || count(*) filter (where obra_id = '00000000-0000-4000-8000-00000000fa03')
                             from public.obras_fin_compras('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(14, 'compras(mãe) como engenheiro: 2 linhas (mãe + filha), 0 da outra obra', 'ok:2|2|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select total_centavos || '|' || fornecedor_razao_social || '|' || obra_os
                             from public.obras_fin_compras('00000000-0000-4000-8000-00000000fa01')
                            where pedido_id = '00000000-0000-4000-8000-00000000fe01');
exception when others then
  perform pg_temp.reg(15, 'compras: total_centavos exatamente como gravado + fornecedor + OS de origem',
    'ok:123456|Fornecedor Compras Teste A|TESTE-FIN-A-MAE', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || max(valor_mo_reais) || '|' || max(aditivos_mo_reais) || '|'
                                  || max(medicao_valor_reais) || '|' || max(medicao_status)
                             from public.obras_fin_fornecedores('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(16, 'fornecedores(mãe): 1 linha, reais como gravados, sem o contrato da outra obra',
    'ok:1|1000.50|0|250.75|solicitada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || count(distinct nota_id) || '|' || sum(parcela_centavos) || '|'
                                  || count(*) filter (where nota_id = '00000000-0000-4000-8000-00000000f402')
                             from public.obras_fin_notas('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(17, 'notas(mãe): nota rateada = 2 parcelas de 1 nota, soma 100000; nota da outra obra fora',
    'ok:2|1|100000|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.f@teste.invalid');
  raise exception 'ok:%|%', (select count(*) from public.obras_fin_compras('00000000-0000-4000-8000-00000000fa02')),
    (select sum(parcela_centavos) from public.obras_fin_notas('00000000-0000-4000-8000-00000000fa02'));
exception when others then
  perform pg_temp.reg(18, 'filha: só os dados da filha (1 compra, parcela 40000)', 'ok:1|40000', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  raise exception 'ok:%', pg_temp.linhas('00000000-0000-4000-8000-00000000fa01');
exception when others then
  perform pg_temp.reg(19, 'engenheiro de OUTRA obra: 3 leituras da mãe vazias', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.f@teste.invalid');
  raise exception 'ok:%', pg_temp.linhas('00000000-0000-4000-8000-00000000fa01');
exception when others then
  perform pg_temp.reg(20, 'engenheiro da filha: leituras da mãe vazias', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', pg_temp.linhas('00000000-0000-4000-8000-00000000fa01');
exception when others then
  perform pg_temp.reg(21, 'usuário do Obras sem papel (supervisor): leituras vazias', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', pg_temp.linhas('00000000-0000-4000-8000-00000000fa01');
exception when others then
  perform pg_temp.reg(22, 'sem acesso nenhum: leituras vazias', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'fin.semobras@teste.invalid');
  raise exception 'ok:%', pg_temp.linhas('00000000-0000-4000-8000-00000000fa01');
exception when others then
  perform pg_temp.reg(23, 'diretor sem acesso ao Obras: leituras vazias', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'fin.teste@teste.invalid');
  raise exception 'ok:%', pg_temp.linhas('00000000-0000-4000-8000-00000000fa01');
exception when others then
  perform pg_temp.reg(24, 'papel financeiro: vê compras 2 + fornecedores 1 + notas 2', 'ok:5', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', pg_temp.linhas('00000000-0000-4000-8000-00000000fa03');
exception when others then
  perform pg_temp.reg(25, 'engenheiro da mãe pedindo a OUTRA obra: vazio', 'ok:0', sqlerrm);
end $$;

-- ============================================================
-- Grants: anon não executa nada
-- ============================================================
do $$ begin
  perform pg_temp.como('anon', null);
  perform public.obras_pode_ver_valores('00000000-0000-4000-8000-00000000fa01');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(26, 'anon não executa obras_pode_ver_valores', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_fin_compras('00000000-0000-4000-8000-00000000fa01');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(27, 'anon não executa obras_fin_compras', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_fin_fornecedores('00000000-0000-4000-8000-00000000fa01');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(28, 'anon não executa obras_fin_fornecedores', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_fin_notas('00000000-0000-4000-8000-00000000fa01');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(29, 'anon não executa obras_fin_notas', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_restricao_pedidos('00000000-0000-4000-8000-00000000fa01');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(30, 'anon não executa obras_restricao_pedidos', 'permission denied for function', sqlerrm);
end $$;

-- ============================================================
-- Pedidos para vincular (Review Focus 5): sem valor, só a obra, só com acesso
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || string_agg(pedido_id::text, ',')
                             from public.obras_restricao_pedidos('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(31, 'pedidos para vincular (usuário do Obras): só o pedido da própria obra (nem filha, nem outra)',
    'ok:1|00000000-0000-4000-8000-00000000fe01', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) filter (where k ~ '(valor|centavos|total|frete|reais|pago|nf_)')
                                  || '|' || count(*) filter (where k = 'previsao_entrega')
                             from public.obras_restricao_pedidos('00000000-0000-4000-8000-00000000fa01') r,
                                  jsonb_object_keys(to_jsonb(r)) k);
exception when others then
  perform pg_temp.reg(32, 'pedidos para vincular: nenhuma chave de valor na linha devolvida (tem previsão)', 'ok:0|1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_restricao_pedidos('00000000-0000-4000-8000-00000000fa01'));
exception when others then
  perform pg_temp.reg(33, 'pedidos para vincular: sem acesso ao Obras = vazio', 'ok:0', sqlerrm);
end $$;

-- ============================================================
-- Restrição <-> pedido (Review Focus 4)
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_restricao (obra_id, atividade_numero, tipo, descricao, responsavel, cmp_pedido_id)
  values ('00000000-0000-4000-8000-00000000fa01', 1, 'material', 'Pedido de outra obra', 'manfac',
          '00000000-0000-4000-8000-00000000fe03');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(34, 'restrição criada com pedido de OUTRA obra: recusada', 'OBRAS_RESTRICAO_PEDIDO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_restricao (obra_id, atividade_numero, tipo, descricao, responsavel, cmp_pedido_id)
  values ('00000000-0000-4000-8000-00000000fa01', 1, 'material', 'Pedido da filha', 'manfac',
          '00000000-0000-4000-8000-00000000fe02');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(35, 'restrição da mãe com pedido da FILHA: recusada (tem de ser a mesma obra)', 'OBRAS_RESTRICAO_PEDIDO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_restricao (obra_id, atividade_numero, tipo, descricao, responsavel, cmp_pedido_id)
  values ('00000000-0000-4000-8000-00000000fa01', 1, 'material', 'Pedido inexistente', 'manfac',
          '00000000-0000-4000-8000-0000000fffff');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(36, 'restrição com pedido inexistente: recusada', 'OBRAS_RESTRICAO_PEDIDO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_restricao set cmp_pedido_id = '00000000-0000-4000-8000-00000000fe03'
   where id = '00000000-0000-4000-8000-00000000f501';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(37, 'restrição existente trocada para pedido de OUTRA obra: recusada', 'OBRAS_RESTRICAO_PEDIDO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_restricao set cmp_pedido_id = '00000000-0000-4000-8000-00000000fe03'
   where id = '00000000-0000-4000-8000-00000000f501';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(38, 'sem JWT (service role/postgres): pedido de outra obra também recusado', 'OBRAS_RESTRICAO_PEDIDO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_restricao set cmp_pedido_id = '00000000-0000-4000-8000-00000000fe01'
   where id = '00000000-0000-4000-8000-00000000f501';
  raise exception 'ok:%', (select cmp_pedido_id from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f501');
exception when others then
  perform pg_temp.reg(39, 'restrição ligada ao pedido da própria obra: aceita', 'ok:00000000-0000-4000-8000-00000000fe01', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_restricao (id, obra_id, atividade_numero, tipo, descricao, responsavel, cmp_pedido_id)
  values ('00000000-0000-4000-8000-00000000f502', '00000000-0000-4000-8000-00000000fa01', 2, 'material',
          'Pedido certo', 'manfac', '00000000-0000-4000-8000-00000000fe01');
  raise exception 'ok:%', (select count(*) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000f502');
exception when others then
  perform pg_temp.reg(40, 'restrição criada com pedido da própria obra: aceita', 'ok:1', sqlerrm);
end $$;

-- ============================================================
-- OS filha (obra_pai_id): só admin, um nível, sem ciclo, modalidade obra
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_obra set obra_pai_id = '00000000-0000-4000-8000-00000000fa01'
   where id = '00000000-0000-4000-8000-00000000fa03';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(41, 'obra mãe: usuário do Obras não altera', 'OBRAS_PARAMETROS', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  update public.obras_obra set obra_pai_id = '00000000-0000-4000-8000-00000000fa01'
   where id = '00000000-0000-4000-8000-00000000fa03';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(42, 'obra mãe: engenheiro da obra não altera', 'OBRAS_PARAMETROS', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_obra (os, modalidade, obra_pai_id)
  values ('TESTE-FIN-A-NOVA', 'spot', '00000000-0000-4000-8000-00000000fa01');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(43, 'obra mãe: usuário do Obras não cria obra já com mãe', 'OBRAS_PARAMETROS', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set obra_pai_id = '00000000-0000-4000-8000-00000000fa01'
   where id = '00000000-0000-4000-8000-00000000fa03';
  raise exception 'ok:%', (select obra_pai_id from public.obras_obra where id = '00000000-0000-4000-8000-00000000fa03');
exception when others then
  perform pg_temp.reg(44, 'obra mãe: administrador liga OBRA a OBRA', 'ok:00000000-0000-4000-8000-00000000fa01', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set obra_pai_id = '00000000-0000-4000-8000-00000000fa03'
   where id = '00000000-0000-4000-8000-00000000fa01';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(45, 'obra com filha não vira filha (um nível)', 'esta obra tem aditivos e não pode virar aditivo', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set obra_pai_id = '00000000-0000-4000-8000-00000000fa02'
   where id = '00000000-0000-4000-8000-00000000fa03';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(46, 'mãe que já é filha recusada (um nível)', 'a obra mãe já é aditivo de outra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set obra_pai_id = '00000000-0000-4000-8000-00000000fa01'
   where id = '00000000-0000-4000-8000-00000000fa01';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(47, 'obra aditivo de si mesma recusada (ciclo)', 'não pode ser aditivo de si mesma', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set obra_pai_id = '00000000-0000-4000-8000-00000000fa04'
   where id = '00000000-0000-4000-8000-00000000fa03';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(48, 'mãe SPOT recusada', 'a obra mãe tem de ser da modalidade OBRA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set obra_pai_id = '00000000-0000-4000-8000-00000000fa01'
   where id = '00000000-0000-4000-8000-00000000fa04';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(49, 'filha SPOT recusada', 'só obra da modalidade OBRA pode ser aditivo', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set modalidade = 'spot' where id = '00000000-0000-4000-8000-00000000fa01';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(50, 'mãe com filha não volta para SPOT', 'não pode deixar de ser OBRA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set modalidade = 'spot' where id = '00000000-0000-4000-8000-00000000fa02';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(51, 'filha não volta para SPOT', 'só obra da modalidade OBRA pode ser aditivo', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_obra set obra_pai_id = '00000000-0000-4000-8000-00000000fa02'
   where id = '00000000-0000-4000-8000-00000000fa03';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(52, 'sem JWT (service role/postgres): dois níveis também recusados', 'a obra mãe já é aditivo de outra', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set obra_pai_id = null where id = '00000000-0000-4000-8000-00000000fa02';
  raise exception 'ok:%', (select coalesce(obra_pai_id::text, 'null') from public.obras_obra
                            where id = '00000000-0000-4000-8000-00000000fa02');
exception when others then
  perform pg_temp.reg(53, 'administrador desliga a filha da mãe', 'ok:null', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_obra where id = '00000000-0000-4000-8000-00000000fa01';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(54, 'obra mãe com filha não se apaga (FK restrict)', 'obra_pai_id_fkey', sqlerrm);
end $$;

-- ============================================================
-- Relatório (a tabela abaixo; no SQL Editor vale a mensagem do bloco final)
-- Comparação por strpos (no LIKE o '_' dos nomes é curinga).
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
  if v_total <> 54 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 54 testes rodaram';
  end if;
  raise exception 'RESUMO: %/54 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
