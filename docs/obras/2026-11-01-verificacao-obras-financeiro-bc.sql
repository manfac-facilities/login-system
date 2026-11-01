-- ============================================================
-- Teste de comportamento de sdd-sql-obras-financeiro-bc.sql
-- Rodar DEPOIS de aplicar a migration (e a Fase A, o Financeiro 044 e o
-- Compras 016), no SQL Editor, projeto iyytcavcgukfjnjjrerx.
-- Rodar o arquivo INTEIRO de uma vez. NÃO GRAVA NADA: tudo roda numa
-- transação e o bloco final termina em erro de propósito (desfaz tudo).
-- A mensagem de erro final é o relatório:
--   "RESUMO: N/N OK"               -> tudo certo
--   "RESUMO: x/N OK — FALHOU: ..." -> parar e não deployar
-- Sem a linha "RESUMO" = algo quebrou antes (erro diferente do esperado).
--
-- Padrão da Fase A: cada teste roda num bloco do $$ ... $$ que termina em
-- erro (o esperado, ou raise 'ok:...'), o que desfaz o que ele fez,
-- inclusive a troca de role. Booleanos como t/f (pg_temp.tf).
--   * pg_temp.jwt(email): JWT simulado como postgres (testa triggers);
--   * pg_temp.como(role, email): troca a role para authenticated / anon /
--     service_role com o JWT daquele e-mail (testa GRANT e RLS de verdade);
--   * pg_temp.rec(msg, tag): 'RECUSADO' quando a mensagem tem a tag da guarda
--     OU é recusa de RLS (a ordem trigger x WITH CHECK não importa ao teste).
--
-- Cobre o Review Focus 3 do plano (medição ao cliente: soma > 100% recusada,
-- só engenheiro da obra/mãe ou admin grava) + organograma só admin + locação
-- com pedido de outra obra / não-locação recusada + leituras vazias para quem
-- não pode + grants (anon não executa nem lê).
--
-- Fixture (só dentro da transação; e-mails .invalid, nada pessoal):
--   obra A TESTE-FIN-BC-MAE   (OBRA, engenheiro eng.a@teste.invalid)
--   obra F TESTE-FIN-BC-FILHA (OBRA, filha de A, engenheiro eng.f@teste.invalid)
--   obra B TESTE-FIN-BC-OUTRA (OBRA, engenheiro eng.b@teste.invalid)
--   acesso ao Obras: eng.a, eng.f, eng.b, usuario.obras, fin.teste (papel financeiro)
--   Organograma: P1 em A (pessoa1@cliente.invalid).
--   Medições ao cliente (gravadas sem JWT): A: M1 30% enviada, M2 20% aprovada,
--     M3 40% recusada (enviada há 30 dias) -> soma não recusada 50%;
--     F: MFF 50% enviada; B: MB1 20% enviada.
--   Compras: p1 material em A; p2 LOCAÇÃO em A (entregue, fim +30, estado E1
--     renovada até +60); p3 LOCAÇÃO em F (não entregue, fim +10); p4 LOCAÇÃO em B;
--     p5 LOCAÇÃO em A ainda na fila (não emitida).
--   Financeiro: S1 100000 rateada A 60% (60000) + F 40% (40000), paga, gerada
--     pela medição de fornecedor MF5; S2 em B; S3 em A com vínculo DESFEITO;
--     S4 em A no ambiente TESTE. Caixinha: D1 (OBRAS, Material) ligada a A com
--     vínculo de 1500 e valor atual 1800; sem obra: D2 (SPOT, Material, 700) e
--     D6 (OBRAS, Ferramentas, 300, vínculo desfeito) contam; D3 (Combustível =
--     fixa), D4 (CC administrativo) e D5 (ambiente teste) não contam.
--   Fornecedores: contrato em A com MF1 solicitada há 11 dias (atrasada),
--     MF2 solicitada há 5 dias, MF3 aprovada há 20 dias, MF5 pagamento
--     solicitado (S1); contrato em B com MF4 solicitada há 15 dias.
--   Faturamento: nota N1 rateada A 60000 + F 40000, ligada a M1, M2 (A) e MFF (F).
-- "Administrador" = o primeiro e-mail com nivel 'administrador' em hub_user_roles.
-- ============================================================

begin;

create temp table _v (n int, teste text, esperado text, obtido text) on commit drop;
create temp table _base (valor text) on commit drop;

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

create function pg_temp.rec(p_msg text, p_tag text) returns text language sql as $$
  select case when strpos(p_msg, p_tag) > 0 or strpos(p_msg, 'row-level security') > 0
              then 'RECUSADO' else p_msg end;
$$;

-- Comparação: 'ok:...' e 'RECUSADO' têm de ser IGUAIS (nada de 'ok:1' aceitar 'ok:12');
-- mensagens de erro esperadas continuam por trecho (strpos, sem curinga).
create function pg_temp.passou(p_obtido text, p_esperado text) returns boolean language sql as $$
  select coalesce(case when p_esperado like 'ok:%' or p_esperado = 'RECUSADO' then p_obtido = p_esperado
                       else strpos(p_obtido, p_esperado) > 0 end, false);
$$;

create function pg_temp.admin_email() returns text language sql as $$
  select lower(trim(user_email)) from public.hub_user_roles where nivel = 'administrador' order by lower(trim(user_email)) limit 1;
$$;

select pg_temp.jwt(null);

-- Obras (sem JWT: a guarda de parâmetros só confere a estrutura mãe/filha)
insert into public.obras_obra (id, os, modalidade, engenheiro_email)
values ('00000000-0000-4000-8000-0000000bc001', 'TESTE-FIN-BC-MAE',   'obra', 'eng.a@teste.invalid'),
       ('00000000-0000-4000-8000-0000000bc003', 'TESTE-FIN-BC-OUTRA', 'obra', 'eng.b@teste.invalid'),
       ('00000000-0000-4000-8000-0000000bc004', 'TESTE-FIN-BC-SPOT',  'spot', null);
insert into public.obras_obra (id, os, modalidade, engenheiro_email, obra_pai_id)
values ('00000000-0000-4000-8000-0000000bc002', 'TESTE-FIN-BC-FILHA', 'obra', 'eng.f@teste.invalid',
        '00000000-0000-4000-8000-0000000bc001');

insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
values ('eng.a@teste.invalid', 'obras', true, 'verificacao-fin-bc'),
       ('eng.f@teste.invalid', 'obras', true, 'verificacao-fin-bc'),
       ('eng.b@teste.invalid', 'obras', true, 'verificacao-fin-bc'),
       ('usuario.obras@teste.invalid', 'obras', true, 'verificacao-fin-bc'),
       ('fin.teste@teste.invalid', 'obras', true, 'verificacao-fin-bc');

insert into public.fin_papeis (user_email, papel) values ('fin.teste@teste.invalid', 'financeiro');

-- Linha de base da caixinha sem obra (GLOBAL: o banco real já tem despesas),
-- lida como administrador ANTES das despesas da fixture.
do $$
declare v_q bigint;
begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  select quantidade into v_q
    from public.obras_fin_caixinha_sem_obra('00000000-0000-4000-8000-0000000bc001');
  raise exception 'base:%', coalesce(v_q, 0);
exception when others then
  insert into _base values (sqlerrm);
end $$;

-- Organograma
insert into public.obras_cliente_pessoa (id, obra_id, nome, cargo, email, ordem)
values ('00000000-0000-4000-8000-0000000bc091', '00000000-0000-4000-8000-0000000bc001',
        'Pessoa Um', 'Gerente', 'pessoa1@cliente.invalid', 1);

-- Medições ao cliente (sem JWT: livre de papel, mas soma e numeração valem)
insert into public.obras_medicao_cliente (id, obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos, situacao)
values ('00000000-0000-4000-8000-0000000bc081', '00000000-0000-4000-8000-0000000bc001', date '2026-10-01', date '2026-10-15', 3000, 300000, 'enviada');
insert into public.obras_medicao_cliente (id, obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos, situacao)
values ('00000000-0000-4000-8000-0000000bc082', '00000000-0000-4000-8000-0000000bc001', date '2026-10-16', date '2026-10-31', 2000, 200000, 'aprovada');
insert into public.obras_medicao_cliente (id, obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos, situacao, enviada_em)
values ('00000000-0000-4000-8000-0000000bc083', '00000000-0000-4000-8000-0000000bc001', date '2026-10-01', date '2026-10-31', 4000, 400000, 'recusada', now() - interval '30 days');
insert into public.obras_medicao_cliente (id, obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos, situacao)
values ('00000000-0000-4000-8000-0000000bc084', '00000000-0000-4000-8000-0000000bc002', date '2026-10-01', date '2026-10-31', 5000, 50000, 'enviada');
insert into public.obras_medicao_cliente (id, obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos, situacao)
values ('00000000-0000-4000-8000-0000000bc085', '00000000-0000-4000-8000-0000000bc003', date '2026-10-01', date '2026-10-31', 2000, 20000, 'enviada');

-- Compras: solicitação -> mapa -> fornecedor do mapa -> pedido
insert into public.cmp_solicitacoes
  (id, ambiente, numero, etapa, tipo, solicitante_email, solicitante_nome, cc_codigo, cc_descricao,
   obra_id, obra_os, motivo, prazo_necessario, locacao_fim, recebimento, urgente, enviado_em, dia_referencia, data_minima)
select x.id, 'producao', x.numero, 'pedido_emitido', x.tipo, 'solicitante@teste.invalid', 'Solicitante Teste',
       '10159908939', 'DPSP - OBRAS', x.obra, x.os, 'Teste do financeiro B/C',
       current_date + 1, x.fim, 'base', false, now(), current_date, current_date
  from (values
    ('00000000-0000-4000-8000-0000000bc011'::uuid, 999000111::bigint, 'material', null::date,
     '00000000-0000-4000-8000-0000000bc001'::uuid, 'TESTE-FIN-BC-MAE'),
    ('00000000-0000-4000-8000-0000000bc012'::uuid, 999000112::bigint, 'locacao', current_date + 30,
     '00000000-0000-4000-8000-0000000bc001'::uuid, 'TESTE-FIN-BC-MAE'),
    ('00000000-0000-4000-8000-0000000bc013'::uuid, 999000113::bigint, 'locacao', current_date + 10,
     '00000000-0000-4000-8000-0000000bc002'::uuid, 'TESTE-FIN-BC-FILHA'),
    ('00000000-0000-4000-8000-0000000bc014'::uuid, 999000114::bigint, 'locacao', current_date + 20,
     '00000000-0000-4000-8000-0000000bc003'::uuid, 'TESTE-FIN-BC-OUTRA'),
    ('00000000-0000-4000-8000-0000000bc015'::uuid, 999000115::bigint, 'locacao', current_date + 40,
     '00000000-0000-4000-8000-0000000bc001'::uuid, 'TESTE-FIN-BC-MAE'))
  as x(id, numero, tipo, fim, obra, os);

insert into public.cmp_mapas (id, solicitacao_id, rodada, situacao, criado_por)
select ('00000000-0000-4000-8000-0000000bc02' || k)::uuid, ('00000000-0000-4000-8000-0000000bc01' || k)::uuid,
       1, 'aprovado', 'comprador@teste.invalid'
  from unnest(array['1','2','3','4','5']) k;

-- Só o fornecedor 1 tem documento (formatado, como pode vir do mapa): a leitura devolve só [0-9A-Z].
insert into public.cmp_mapa_fornecedores (id, mapa_id, ordem, razao_social, frete_tipo, documento)
select ('00000000-0000-4000-8000-0000000bc03' || k)::uuid, ('00000000-0000-4000-8000-0000000bc02' || k)::uuid,
       1, 'Locadora Teste ' || k, 'incluso', case when k = '1' then '12.345.678/0001-90' else '' end
  from unnest(array['1','2','3','4','5']) k;

insert into public.cmp_pedidos
  (id, solicitacao_id, ambiente, sequencia, mapa_fornecedor_id, codigo_integracao, pagamento, condicao_codigo,
   total_centavos, situacao, etapa_atual, previsao_entrega, entrega_situacao, entrega_em)
values ('00000000-0000-4000-8000-0000000bc041', '00000000-0000-4000-8000-0000000bc011', 'producao', 1,
        '00000000-0000-4000-8000-0000000bc031', 'TBC-P1', 'faturado', '000', 11111, 'emitido', 'pedido', current_date + 5, null, null),
       ('00000000-0000-4000-8000-0000000bc042', '00000000-0000-4000-8000-0000000bc012', 'producao', 1,
        '00000000-0000-4000-8000-0000000bc032', 'TBC-P2', 'faturado', '000', 50000, 'emitido', 'pedido', current_date, 'confirmada', now()),
       ('00000000-0000-4000-8000-0000000bc043', '00000000-0000-4000-8000-0000000bc013', 'producao', 1,
        '00000000-0000-4000-8000-0000000bc033', 'TBC-P3', 'faturado', '000', 30000, 'emitido', 'pedido', current_date + 2, null, null),
       ('00000000-0000-4000-8000-0000000bc044', '00000000-0000-4000-8000-0000000bc014', 'producao', 1,
        '00000000-0000-4000-8000-0000000bc034', 'TBC-P4', 'faturado', '000', 40000, 'emitido', 'pedido', current_date + 2, null, null),
       ('00000000-0000-4000-8000-0000000bc045', '00000000-0000-4000-8000-0000000bc015', 'producao', 1,
        '00000000-0000-4000-8000-0000000bc035', 'TBC-P5', 'faturado', '000', 60000, 'na_fila', 'pedido', current_date + 2, null, null);

-- Estado E1: locação p2 (A) renovada até +60 (sem JWT: autoria vazia)
insert into public.obras_locacao_estado (id, cmp_pedido_id, obra_id, renovada_ate)
values ('00000000-0000-4000-8000-0000000bc092', '00000000-0000-4000-8000-0000000bc042',
        '00000000-0000-4000-8000-0000000bc001', current_date + 60);

-- Financeiro: solicitações de pagamento
insert into public.fin_solicitacoes
  (id, ambiente, numero, etapa, solicitante_email, solicitante_nome, fornecedor_origem, fornecedor_documento,
   fornecedor_razao_social, forma_pagamento, codigo_pagamento, valor_centavos, vencimento, categoria_codigo,
   categoria_descricao, tipo_documento_codigo, tipo_documento_descricao, descricao, rateio_modo, emergencial,
   enviado_em, dia_referencia, data_minima, primeira_janela)
select x.id, x.amb, x.numero, 'lancada', 'solicitante@teste.invalid', 'Solicitante Teste', 'cnpj_novo',
       '99999999000191', 'Fornecedor Pagamento Teste', 'boleto', '0000', x.valor, current_date + 10, '2.01.01',
       'Material Aplicado', 'NF', 'Nota fiscal', 'Teste do financeiro B/C', 'percentual', false,
       now(), current_date, current_date, current_date
  from (values ('00000000-0000-4000-8000-0000000bc051'::uuid, 'producao', 999000301::bigint, 100000::bigint),
               ('00000000-0000-4000-8000-0000000bc052'::uuid, 'producao', 999000302::bigint, 50000::bigint),
               ('00000000-0000-4000-8000-0000000bc053'::uuid, 'producao', 999000303::bigint, 20000::bigint),
               ('00000000-0000-4000-8000-0000000bc054'::uuid, 'teste',    999000304::bigint, 10000::bigint),
               ('00000000-0000-4000-8000-0000000bc055'::uuid, 'producao', 999000305::bigint, 7000::bigint))
       as x(id, amb, numero, valor);

-- S5 nasceu pela integração de medição do Fornecedores (chave = id da medição MF8),
-- e o Fornecedores ainda não gravou o fin_solicitacao_id na medição.
insert into public.fin_solicitacao_integracoes (ambiente, origem, chave, solicitacao_id)
values ('producao', 'fornecedores_medicao', '00000000-0000-4000-8000-0000000bc078', '00000000-0000-4000-8000-0000000bc055');

-- Rateio de S1: só 33,333% em CC de OBRAS; o resto em ADM (o vínculo cobre 100% do total).
insert into public.fin_solicitacao_rateio
  (solicitacao_id, ordem, departamento_codigo, departamento_descricao, percentual_centesimos, valor_centavos)
values ('00000000-0000-4000-8000-0000000bc051', 1, '10159908939', 'DPSP - OBRAS', 3333, 33333),
       ('00000000-0000-4000-8000-0000000bc051', 2, '10159908940', 'ADMINISTRATIVO', 6667, 66667);

insert into public.fin_pagamentos_omie
  (solicitacao_id, ambiente, codigo_lancamento_omie, situacao, data_pagamento, valor_pago_centavos, status_omie)
values ('00000000-0000-4000-8000-0000000bc051', 'producao', 999000301, 'pago', current_date, 100000, 'PAGO');

-- Caixinha: relatórios e despesas
insert into public.fin_caixinha_relatorios (ambiente, vex_id, usuario_vex_id, status, valor_centavos, atualizado_em_vex)
values ('producao', 999000001, 999000001, 'ENVIADO', 0, now()),
       ('teste',    999000002, 999000001, 'ENVIADO', 0, now());

insert into public.fin_caixinha_despesas (ambiente, vex_id, relatorio_vex_id, data, titulo, valor_centavos, tipo_nome, centro_custo_nome)
values ('producao', 999000011, 999000001, current_date, 'D1', 1800, 'Material',    'OBRAS TESTE BC'),
       ('producao', 999000012, 999000001, current_date, 'D2',  700, 'Material',    'SPOT TESTE BC'),
       ('producao', 999000013, 999000001, current_date, 'D3',  999, 'Combustível', 'OBRAS TESTE BC'),
       ('producao', 999000014, 999000001, current_date, 'D4',  888, 'Material',    'ADMINISTRATIVO BC'),
       ('teste',    999000015, 999000002, current_date, 'D5',  555, 'Material',    'OBRAS TESTE BC'),
       ('producao', 999000016, 999000001, current_date, 'D6',  300, 'Ferramentas', 'OBRAS TESTE BC');

-- Vínculos do Financeiro (escrita direta só porque é postgres numa transação desfeita)
insert into public.fin_obra_vinculos
  (ambiente, origem, solicitacao_id, vex_despesa_id, obra_id, os, percentual_centesimos, valor_centavos,
   criado_por_email, criado_por_nome, desfeito_em, desfeito_por_email)
values ('producao', 'solicitacao', '00000000-0000-4000-8000-0000000bc051', null, '00000000-0000-4000-8000-0000000bc001',
        'TESTE-FIN-BC-MAE', 6000, 60000, 'fin.teste@teste.invalid', 'Fin Teste', null, null),
       ('producao', 'solicitacao', '00000000-0000-4000-8000-0000000bc051', null, '00000000-0000-4000-8000-0000000bc002',
        'TESTE-FIN-BC-FILHA', 4000, 40000, 'fin.teste@teste.invalid', 'Fin Teste', null, null),
       ('producao', 'solicitacao', '00000000-0000-4000-8000-0000000bc052', null, '00000000-0000-4000-8000-0000000bc003',
        'TESTE-FIN-BC-OUTRA', 10000, 50000, 'fin.teste@teste.invalid', 'Fin Teste', null, null),
       ('producao', 'solicitacao', '00000000-0000-4000-8000-0000000bc053', null, '00000000-0000-4000-8000-0000000bc001',
        'TESTE-FIN-BC-MAE', 10000, 20000, 'fin.teste@teste.invalid', 'Fin Teste', now(), 'fin.teste@teste.invalid'),
       ('teste', 'solicitacao', '00000000-0000-4000-8000-0000000bc054', null, '00000000-0000-4000-8000-0000000bc001',
        'TESTE-FIN-BC-MAE', 10000, 10000, 'fin.teste@teste.invalid', 'Fin Teste', null, null),
       ('producao', 'solicitacao', '00000000-0000-4000-8000-0000000bc055', null, '00000000-0000-4000-8000-0000000bc001',
        'TESTE-FIN-BC-MAE', 10000, 7000, 'fin.teste@teste.invalid', 'Fin Teste', null, null),
       ('producao', 'caixinha_despesa', null, 999000011, '00000000-0000-4000-8000-0000000bc001',
        'TESTE-FIN-BC-MAE', 10000, 1500, 'fin.teste@teste.invalid', 'Fin Teste', null, null),
       ('producao', 'caixinha_despesa', null, 999000016, '00000000-0000-4000-8000-0000000bc001',
        'TESTE-FIN-BC-MAE', 10000, 300, 'fin.teste@teste.invalid', 'Fin Teste', now(), 'fin.teste@teste.invalid');

-- Fornecedores: contratos (rascunho) e medições
insert into public.frn_fornecedores (id, omie_codigo, documento, razao_social, origem)
values ('00000000-0000-4000-8000-0000000bc061', 9999990061, '99999999000272', 'Fornecedor BC Teste', 'carga_inicial');

insert into public.frn_contratos (id, seq, numero, fornecedor_id, tipo, criado_por, status, obra_id, valor_mo, valor_mat)
values ('00000000-0000-4000-8000-0000000bc062', 9999990062, 'CT-TBC-1', '00000000-0000-4000-8000-0000000bc061',
        'especifico', 'comprador@teste.invalid', 'rascunho', '00000000-0000-4000-8000-0000000bc001', 1000, 0),
       ('00000000-0000-4000-8000-0000000bc063', 9999990063, 'CT-TBC-2', '00000000-0000-4000-8000-0000000bc061',
        'especifico', 'comprador@teste.invalid', 'rascunho', '00000000-0000-4000-8000-0000000bc003', 1000, 0),
       ('00000000-0000-4000-8000-0000000bc064', 9999990064, 'CT-TBC-G', '00000000-0000-4000-8000-0000000bc061',
        'global', 'comprador@teste.invalid', 'rascunho', null, 700, 0);

insert into public.frn_medicoes
  (id, seq, numero, contrato_id, item, modo, descricao, valor, percentual, condicao_codigo, condicao_versao,
   competencia, forma_pagamento, codigo_pagamento, categoria_codigo, categoria_nome, tipo_documento_codigo,
   tipo_documento_nome, cc_codigo, cc_nome, solicitado_por, status, solicitado_em,
   aprovado_por, aprovado_em, fin_ref, vencimento, fin_solicitacao_id, obra_id, pre_aprovado_por, pre_aprovado_em,
   fin_criada_em, fin_tentativa)
select x.id, x.seq, x.numero, x.contrato, 'mo', 'servico', 'Medição BC', 100, 10, cv.codigo, cv.versao,
       date '2026-10-01', 'boleto', '0000', 'x', 'Teste', 'x', 'Teste', '10159908939', 'DPSP - OBRAS',
       'eng.a@teste.invalid', x.status, now() - x.dias * interval '1 day',
       case when x.status <> 'solicitada' then 'eduardo@teste.invalid' end,
       case when x.status <> 'solicitada' then now() end,
       case when x.status = 'pagamento_solicitado' then 'TBC-FIN' end,
       case when x.status = 'pagamento_solicitado' then current_date + 10 end,
       case when x.status = 'pagamento_solicitado' then '00000000-0000-4000-8000-0000000bc051'::uuid end,
       x.obra,
       case when x.pre then 'eng.a@teste.invalid' end,
       case when x.pre then now() - interval '1 day' end,
       case when x.status = 'pagamento_solicitado' then now() end,
       case when x.status = 'pagamento_solicitado' then 1 end
  from (values ('00000000-0000-4000-8000-0000000bc071'::uuid, 9999990071::bigint, 'MD-TBC-1', '00000000-0000-4000-8000-0000000bc062'::uuid, 'solicitada', 11, '00000000-0000-4000-8000-0000000bc001'::uuid, true),
               ('00000000-0000-4000-8000-0000000bc072'::uuid, 9999990072::bigint, 'MD-TBC-2', '00000000-0000-4000-8000-0000000bc062'::uuid, 'solicitada', 5, '00000000-0000-4000-8000-0000000bc001'::uuid, false),
               ('00000000-0000-4000-8000-0000000bc073'::uuid, 9999990073::bigint, 'MD-TBC-3', '00000000-0000-4000-8000-0000000bc062'::uuid, 'aprovada', 20, '00000000-0000-4000-8000-0000000bc001'::uuid, true),
               ('00000000-0000-4000-8000-0000000bc074'::uuid, 9999990074::bigint, 'MD-TBC-4', '00000000-0000-4000-8000-0000000bc063'::uuid, 'solicitada', 15, '00000000-0000-4000-8000-0000000bc003'::uuid, false),
               ('00000000-0000-4000-8000-0000000bc075'::uuid, 9999990075::bigint, 'MD-TBC-5', '00000000-0000-4000-8000-0000000bc062'::uuid, 'pagamento_solicitado', 30, '00000000-0000-4000-8000-0000000bc001'::uuid, true),
               ('00000000-0000-4000-8000-0000000bc078'::uuid, 9999990078::bigint, 'MD-TBC-8', '00000000-0000-4000-8000-0000000bc062'::uuid, 'aprovada', 25, '00000000-0000-4000-8000-0000000bc001'::uuid, true),
               ('00000000-0000-4000-8000-0000000bc076'::uuid, 9999990076::bigint, 'MD-TBC-6', '00000000-0000-4000-8000-0000000bc064'::uuid, 'solicitada', 12, '00000000-0000-4000-8000-0000000bc001'::uuid, false),
               ('00000000-0000-4000-8000-0000000bc077'::uuid, 9999990077::bigint, 'MD-TBC-7', '00000000-0000-4000-8000-0000000bc064'::uuid, 'solicitada', 14, '00000000-0000-4000-8000-0000000bc003'::uuid, false))
       as x(id, seq, numero, contrato, status, dias, obra, pre)
 cross join (select codigo, versao from public.frn_condicoes_versoes order by codigo, versao limit 1) cv;

-- Faturamento: nota rateada entre mãe e filha, ligada a M1, M2 (A) e MFF (F)
insert into public.fin_fat_lotes (id, ambiente, tipo_id, referencia, criado_por_email, criado_por_nome)
select '00000000-0000-4000-8000-0000000bc0a1', 'producao', t.id, 'TESTE-FIN-BC', 'fin.teste@teste.invalid', 'Fin Teste'
  from (select id from public.fin_fat_tipos order by id limit 1) t;

insert into public.fin_fat_notas (id, lote_id, ambiente, tomador_cnpj, valor_total_centavos, situacao)
values ('00000000-0000-4000-8000-0000000bc0a2', '00000000-0000-4000-8000-0000000bc0a1', 'producao', '00000000000000', 100000, 'rascunho');

insert into public.fin_fat_nota_obras (nota_id, obra_id, os, valor_centavos, forma)
values ('00000000-0000-4000-8000-0000000bc0a2', '00000000-0000-4000-8000-0000000bc001', 'TESTE-FIN-BC-MAE', 60000, 'manual'),
       ('00000000-0000-4000-8000-0000000bc0a2', '00000000-0000-4000-8000-0000000bc002', 'TESTE-FIN-BC-FILHA', 40000, 'manual');

insert into public.fin_fat_nota_medicoes (nota_id, medicao_id, criado_por_email)
values ('00000000-0000-4000-8000-0000000bc0a2', '00000000-0000-4000-8000-0000000bc081', 'fin.teste@teste.invalid'),
       ('00000000-0000-4000-8000-0000000bc0a2', '00000000-0000-4000-8000-0000000bc082', 'fin.teste@teste.invalid'),
       ('00000000-0000-4000-8000-0000000bc0a2', '00000000-0000-4000-8000-0000000bc084', 'fin.teste@teste.invalid');

-- ============================================================
-- Fixture conferida (numeração dada pelo banco)
-- ============================================================
do $$ begin
  raise exception 'ok:%', (select string_agg(numero::text, ',' order by id) from public.obras_medicao_cliente
                            where id in ('00000000-0000-4000-8000-0000000bc081', '00000000-0000-4000-8000-0000000bc082',
                                         '00000000-0000-4000-8000-0000000bc083', '00000000-0000-4000-8000-0000000bc084'));
exception when others then
  perform pg_temp.reg(1, 'fixture: numeração por OS dada pelo banco (A 1,2,3; F 1)', 'ok:1,2,3,1', sqlerrm);
end $$;

-- ============================================================
-- Organograma do cliente (obras_cliente_pessoa): só administrador grava
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  insert into public.obras_cliente_pessoa (id, obra_id, nome, email, criado_por, criado_em)
  values ('00000000-0000-4000-8000-0000000bc0f1', '00000000-0000-4000-8000-0000000bc001', '  Fulano  ',
          '  Fulano@Cliente.INVALID ', 'forjado@teste.invalid', now() - interval '9 days');
  raise exception 'ok:%', (select email || '|' || nome || '|' || pg_temp.tf(criado_por = pg_temp.admin_email())
                                  || '|' || pg_temp.tf(criado_em = now())
                             from public.obras_cliente_pessoa where id = '00000000-0000-4000-8000-0000000bc0f1');
exception when others then
  perform pg_temp.reg(2, 'pessoa: admin grava; e-mail minúsculo sem espaço; autoria forçada', 'ok:fulano@cliente.invalid|Fulano|t|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  insert into public.obras_cliente_pessoa (obra_id, nome, email)
  values ('00000000-0000-4000-8000-0000000bc001', 'Sem E-mail 1', '   '),
         ('00000000-0000-4000-8000-0000000bc001', 'Sem E-mail 2', null);
  raise exception 'ok:%', (select count(*) from public.obras_cliente_pessoa
                            where obra_id = '00000000-0000-4000-8000-0000000bc001' and email is null);
exception when others then
  perform pg_temp.reg(3, 'pessoa: e-mail opcional (vazio vira NULL; dois sem e-mail convivem)', 'ok:2', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  insert into public.obras_cliente_pessoa (obra_id, nome, email)
  values ('00000000-0000-4000-8000-0000000bc001', 'Repetida', ' PESSOA1@cliente.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(4, 'pessoa: e-mail repetido na mesma obra recusado', 'obras_cliente_pessoa_obra_email_key', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  insert into public.obras_cliente_pessoa (obra_id, nome, email)
  values ('00000000-0000-4000-8000-0000000bc003', 'Mesmo e-mail, outra obra', 'pessoa1@cliente.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_cliente_pessoa where email = 'pessoa1@cliente.invalid');
exception when others then
  perform pg_temp.reg(5, 'pessoa: mesmo e-mail em OUTRA obra é aceito', 'ok:2', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_cliente_pessoa (obra_id, nome) values ('00000000-0000-4000-8000-0000000bc001', 'Pelo engenheiro');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(6, 'pessoa: engenheiro da obra NÃO grava', 'RECUSADO', pg_temp.rec(sqlerrm, 'OBRAS_CLIENTE_PESSOA'));
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_cliente_pessoa (obra_id, nome) values ('00000000-0000-4000-8000-0000000bc001', 'Pelo usuário');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(7, 'pessoa: usuário do Obras NÃO grava', 'RECUSADO', pg_temp.rec(sqlerrm, 'OBRAS_CLIENTE_PESSOA'));
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_cliente_pessoa set nome = 'Trocado' where id = '00000000-0000-4000-8000-0000000bc091';
  get diagnostics v_n = row_count;
  raise exception 'ok:%|%', v_n, (select nome from public.obras_cliente_pessoa where id = '00000000-0000-4000-8000-0000000bc091');
exception when others then
  perform pg_temp.reg(8, 'pessoa: engenheiro não altera (0 linhas, nome intacto)', 'ok:0|Pessoa Um', sqlerrm);
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  delete from public.obras_cliente_pessoa where id = '00000000-0000-4000-8000-0000000bc091';
  get diagnostics v_n = row_count;
  raise exception 'ok:%', v_n;
exception when others then
  perform pg_temp.reg(9, 'pessoa: usuário do Obras não apaga (0 linhas)', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.a@teste.invalid');
  insert into public.obras_cliente_pessoa (obra_id, nome) values ('00000000-0000-4000-8000-0000000bc001', 'Por trás da RLS');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(10, 'pessoa: trigger recusa não-admin mesmo como postgres com JWT', 'OBRAS_CLIENTE_PESSOA: só administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_cliente_pessoa set obra_id = '00000000-0000-4000-8000-0000000bc003'
   where id = '00000000-0000-4000-8000-0000000bc091';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(11, 'pessoa: obra_id imutável (nem admin)', 'id e obra_id são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_cliente_pessoa set cargo = 'Diretor', criado_por = 'forjado@teste.invalid'
   where id = '00000000-0000-4000-8000-0000000bc091';
  raise exception 'ok:%', (select cargo || '|' || coalesce(criado_por, 'null') || '|' || pg_temp.tf(atualizado_por = pg_temp.admin_email())
                             from public.obras_cliente_pessoa where id = '00000000-0000-4000-8000-0000000bc091');
exception when others then
  perform pg_temp.reg(12, 'pessoa: admin altera; criado_por nunca reescrito; atualizado_por = admin', 'ok:Diretor|null|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_cliente_pessoa where obra_id = '00000000-0000-4000-8000-0000000bc001');
exception when others then
  perform pg_temp.reg(13, 'pessoa: usuário do Obras lê o organograma', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_cliente_pessoa where obra_id = '00000000-0000-4000-8000-0000000bc001');
exception when others then
  perform pg_temp.reg(14, 'pessoa: sem acesso ao Obras não lê', 'ok:0', sqlerrm);
end $$;

-- ============================================================
-- Medições ao cliente (Review Focus 3)
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (id, obra_id, numero, periodo_inicio, periodo_fim, percentual_centesimos,
                                            valor_centavos, criado_por, criado_em)
  values ('00000000-0000-4000-8000-0000000bc0f2', '00000000-0000-4000-8000-0000000bc001', 99, date '2026-11-01',
          date '2026-11-15', 2000, 200000, 'forjado@teste.invalid', now() - interval '9 days');
  raise exception 'ok:%', (select numero || '|' || criado_por || '|' || situacao || '|' || coalesce(aprovada_em::text, 'NULL')
                                  || '|' || pg_temp.tf(criado_em = now())
                             from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc0f2');
exception when others then
  perform pg_temp.reg(15, 'medição: engenheiro grava; número dado pelo banco (4); autoria forçada; nasce enviada',
    'ok:4|eng.a@teste.invalid|enviada|NULL|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 5000, 500000);
  raise exception 'ok:%', (select sum(percentual_centesimos) from public.obras_medicao_cliente
                            where obra_id = '00000000-0000-4000-8000-0000000bc001' and situacao <> 'recusada');
exception when others then
  perform pg_temp.reg(16, 'medição: soma exatamente 100% é aceita (50% + 50%)', 'ok:10000', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 5001, 500100);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(17, 'medição: soma > 100% recusada (50% + 50,01%)', 'passaria de 100%', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 5001, 500100);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(18, 'medição: sem JWT (service role/postgres) > 100% também recusada', 'passaria de 100%', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (id, obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc0f3', '00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 1000, 100000);
  update public.obras_medicao_cliente set percentual_centesimos = 5001
   where id = '00000000-0000-4000-8000-0000000bc0f3';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(19, 'medição: aumentar % passando de 100% recusado (50% + 50,01%)', 'passaria de 100%', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set situacao = 'enviada'
   where id = '00000000-0000-4000-8000-0000000bc083';
  raise exception 'ok:%', (select situacao || '|' || pg_temp.tf(enviada_em >= now() - interval '1 minute')
                             from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc083');
exception when others then
  perform pg_temp.reg(20, 'medição: recusada volta para enviada (90%) e o envio recomeça agora', 'ok:enviada|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 5000, 500000);
  update public.obras_medicao_cliente set situacao = 'enviada'
   where id = '00000000-0000-4000-8000-0000000bc083';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(21, 'medição: reenviar a recusada que passaria de 100% é recusado', 'passaria de 100%', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc002', date '2026-11-01', date '2026-11-15', 1000, 10000);
  raise exception 'ok:%', (select max(numero) from public.obras_medicao_cliente
                            where obra_id = '00000000-0000-4000-8000-0000000bc002');
exception when others then
  perform pg_temp.reg(22, 'medição: engenheiro da MÃE grava na filha (número 2 da filha)', 'ok:2', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.f@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 100, 1000);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(23, 'medição: engenheiro da filha NÃO grava na mãe', 'RECUSADO', pg_temp.rec(sqlerrm, 'OBRAS_MEDICAO_CLIENTE: só o engenheiro'));
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 100, 1000);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(24, 'medição: engenheiro de OUTRA obra NÃO grava', 'RECUSADO', pg_temp.rec(sqlerrm, 'OBRAS_MEDICAO_CLIENTE: só o engenheiro'));
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 100, 1000);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(25, 'medição: usuário do Obras (supervisor) NÃO grava', 'RECUSADO', pg_temp.rec(sqlerrm, 'OBRAS_MEDICAO_CLIENTE: só o engenheiro'));
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'fin.teste@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 100, 1000);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(26, 'medição: papel financeiro vê valores mas NÃO grava', 'RECUSADO', pg_temp.rec(sqlerrm, 'OBRAS_MEDICAO_CLIENTE: só o engenheiro'));
end $$;

do $$ begin
  perform pg_temp.jwt('eng.b@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 100, 1000);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(27, 'medição: trigger recusa engenheiro errado mesmo como postgres com JWT', 'OBRAS_MEDICAO_CLIENTE: só o engenheiro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos, situacao)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 100, 1000, 'aprovada');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(28, 'medição: engenheiro não cria já aprovada', 'nasce como enviada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set situacao = 'aprovada' where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'ok:%', (select situacao || '|' || pg_temp.tf(aprovada_em is not null) || '|' || atualizado_por
                             from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc081');
exception when others then
  perform pg_temp.reg(29, 'medição: enviada -> aprovada (aprovada_em preenchida, atualizado_por = engenheiro)',
    'ok:aprovada|t|eng.a@teste.invalid', sqlerrm);
end $$;

do $$ begin
  -- M1 tem nota ligada na fixture: desliga só dentro deste bloco (o raise desfaz).
  perform pg_temp.jwt(null);
  delete from public.fin_fat_nota_medicoes where medicao_id = '00000000-0000-4000-8000-0000000bc081';
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set situacao = 'recusada' where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'ok:%', (select situacao from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc081');
exception when others then
  perform pg_temp.reg(30, 'medição: enviada -> recusada (sem nota)', 'ok:recusada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set situacao = 'enviada' where id = '00000000-0000-4000-8000-0000000bc082';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(31, 'medição: aprovada é final para o engenheiro (não volta)', 'aprovada não muda', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set percentual_centesimos = 1000 where id = '00000000-0000-4000-8000-0000000bc082';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(32, 'medição: aprovada é final para o engenheiro (% não muda)', 'aprovada não muda', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set situacao = 'aprovada' where id = '00000000-0000-4000-8000-0000000bc083';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(33, 'medição: recusada não vai direto para aprovada', 'volta para enviada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_medicao_cliente set situacao = 'enviada' where id = '00000000-0000-4000-8000-0000000bc082';
  raise exception 'ok:%', (select situacao || '|' || coalesce(aprovada_em::text, 'NULL')
                             from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc082');
exception when others then
  perform pg_temp.reg(34, 'medição: nem administrador reabre aprovada que tem nota no Financeiro', 'medição com nota emitida', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 0, 1000);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(35, 'medição: percentual 0 recusado', 'obras_medicao_cliente_percentual_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 100, 0);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(36, 'medição: valor 0 recusado', 'obras_medicao_cliente_valor_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-15', date '2026-11-01', 100, 1000);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(37, 'medição: fim do período antes do início recusado', 'obras_medicao_cliente_periodo_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_medicao_cliente (obra_id, periodo_inicio, periodo_fim, percentual_centesimos, valor_centavos, enviada_em)
  values ('00000000-0000-4000-8000-0000000bc001', date '2026-11-01', date '2026-11-15', 100, 1000, now() + interval '3 days');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(38, 'medição: data de envio no futuro recusada', 'no futuro', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set obra_id = '00000000-0000-4000-8000-0000000bc002'
   where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(39, 'medição: obra_id imutável', 'id e obra_id são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set numero = 77, criado_por = 'forjado@teste.invalid', periodo_fim = date '2026-10-20'
   where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'ok:%', (select numero || '|' || coalesce(criado_por, 'null') || '|' || periodo_fim
                             from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc081');
exception when others then
  perform pg_temp.reg(40, 'medição: número e autoria nunca reescritos no UPDATE (período muda)', 'ok:1|null|2026-10-20', sqlerrm);
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  delete from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc081';
  get diagnostics v_n = row_count;
  raise exception 'ok:%', v_n;
exception when others then
  perform pg_temp.reg(41, 'medição: engenheiro não apaga (0 linhas)', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.a@teste.invalid');
  delete from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(42, 'medição: trigger recusa apagar por não-admin mesmo como postgres', 'só administrador apaga medição', sqlerrm);
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  delete from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc083';
  get diagnostics v_n = row_count;
  raise exception 'ok:%', v_n;
exception when others then
  perform pg_temp.reg(43, 'medição: administrador apaga', 'ok:1', sqlerrm);
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  update public.obras_medicao_cliente set valor_centavos = 1 where id = '00000000-0000-4000-8000-0000000bc081';
  get diagnostics v_n = row_count;
  raise exception 'ok:%', v_n;
exception when others then
  perform pg_temp.reg(44, 'medição: engenheiro de outra obra não altera (0 linhas)', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_medicao_cliente
                            where obra_id in ('00000000-0000-4000-8000-0000000bc001', '00000000-0000-4000-8000-0000000bc002'));
exception when others then
  perform pg_temp.reg(45, 'medição: usuário do Obras (supervisor) não lê', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'fin.teste@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_medicao_cliente
                            where obra_id = '00000000-0000-4000-8000-0000000bc001');
exception when others then
  perform pg_temp.reg(46, 'medição: papel financeiro lê', 'ok:3', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || count(*) filter (where obra_id = '00000000-0000-4000-8000-0000000bc003')
                             from public.obras_medicao_cliente
                            where obra_id in ('00000000-0000-4000-8000-0000000bc001', '00000000-0000-4000-8000-0000000bc002',
                                              '00000000-0000-4000-8000-0000000bc003'));
exception when others then
  perform pg_temp.reg(47, 'medição: engenheiro da mãe lê mãe + filha (4), nada da outra obra', 'ok:4|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.f@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_medicao_cliente
                            where obra_id in ('00000000-0000-4000-8000-0000000bc001', '00000000-0000-4000-8000-0000000bc002'));
exception when others then
  perform pg_temp.reg(48, 'medição: engenheiro da filha lê só a filha', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_obra where id = '00000000-0000-4000-8000-0000000bc003';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(49, 'medição: OS com medição não se apaga (FK restrict)', 'obras_medicao_cliente', sqlerrm);
end $$;

-- ============================================================
-- Estado da locação (obras_locacao_estado)
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-0000000bc041', '00000000-0000-4000-8000-0000000bc001', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(50, 'locação: pedido que NÃO é de locação recusado', 'OBRAS_LOCACAO: o pedido não existe', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-0000000bc044', '00000000-0000-4000-8000-0000000bc001', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(51, 'locação: pedido de OUTRA obra recusado', 'OBRAS_LOCACAO: o pedido não existe', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-0000000bc044', '00000000-0000-4000-8000-0000000bc003', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(52, 'locação: engenheiro não marca locação da obra de outro engenheiro', 'RECUSADO',
    pg_temp.rec(sqlerrm, 'OBRAS_LOCACAO: só o engenheiro'));
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-0000000fffff', '00000000-0000-4000-8000-0000000bc001', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(53, 'locação: pedido inexistente recusado', 'OBRAS_LOCACAO: o pedido não existe', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-0000000bc044', '00000000-0000-4000-8000-0000000bc001', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(54, 'locação: sem JWT (service role) pedido de outra obra também recusado', 'OBRAS_LOCACAO: o pedido não existe', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em, criado_por)
  values ('00000000-0000-4000-8000-0000000bc043', '00000000-0000-4000-8000-0000000bc002', current_date, 'forjado@teste.invalid');
  raise exception 'ok:%', (select criado_por || '|' || devolvida_em::text = 'eng.a@teste.invalid|' || current_date::text
                             from public.obras_locacao_estado where cmp_pedido_id = '00000000-0000-4000-8000-0000000bc043');
exception when others then
  perform pg_temp.reg(55, 'locação: engenheiro da mãe marca a da filha devolvida; autoria forçada', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-0000000bc043', '00000000-0000-4000-8000-0000000bc002', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(56, 'locação: engenheiro de outra obra NÃO marca', 'RECUSADO', pg_temp.rec(sqlerrm, 'OBRAS_LOCACAO: só o engenheiro'));
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-0000000bc043', '00000000-0000-4000-8000-0000000bc002', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(57, 'locação: usuário do Obras NÃO marca', 'RECUSADO', pg_temp.rec(sqlerrm, 'OBRAS_LOCACAO: só o engenheiro'));
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-0000000bc042', '00000000-0000-4000-8000-0000000bc001', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(58, 'locação: um estado por pedido', 'obras_locacao_estado_pedido_key', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_locacao_estado set cmp_pedido_id = '00000000-0000-4000-8000-0000000bc045'
   where id = '00000000-0000-4000-8000-0000000bc092';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(59, 'locação: pedido imutável', 'são imutáveis', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_locacao_estado set renovada_ate = current_date + 90, criado_por = 'forjado@teste.invalid'
   where id = '00000000-0000-4000-8000-0000000bc092';
  raise exception 'ok:%', (select atualizado_por || '|' || coalesce(criado_por, 'null')
                             from public.obras_locacao_estado where id = '00000000-0000-4000-8000-0000000bc092');
exception when others then
  perform pg_temp.reg(60, 'locação: engenheiro renova; criado_por nunca reescrito', 'ok:eng.a@teste.invalid|null', sqlerrm);
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_locacao_estado set devolvida_em = current_date where id = '00000000-0000-4000-8000-0000000bc092';
  get diagnostics v_n = row_count;
  raise exception 'ok:%', v_n;
exception when others then
  perform pg_temp.reg(61, 'locação: usuário do Obras não altera (0 linhas)', 'ok:0', sqlerrm);
end $$;

-- ============================================================
-- obras_fin_vinculos (pagamentos/rateio e caixinha)
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || sum(valor_centavos) || '|' || count(distinct obra_id) || '|'
                                  || count(*) filter (where obra_id = '00000000-0000-4000-8000-0000000bc003'
                                                         or solicitacao_id in ('00000000-0000-4000-8000-0000000bc053',
                                                                               '00000000-0000-4000-8000-0000000bc054')
                                                         or vex_despesa_id = 999000016)
                             from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(62, 'vínculos(mãe): 4 linhas (atribuído 20000 + 13333 + 7000 + 1800), mãe + filha; sem outra obra, desfeito ou teste',
    'ok:4|42133|2|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select pagamento_situacao || '|' || frn_medicao_id || '|' || solicitacao_valor_centavos || '|' || percentual_centesimos
                                  || '|' || valor_centavos || '|' || vinculo_valor_centavos || '|' || rateio_obras_centavos
                             from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001')
                            where origem = 'solicitacao' and obra_id = '00000000-0000-4000-8000-0000000bc001'
                              and solicitacao_id = '00000000-0000-4000-8000-0000000bc051');
exception when others then
  perform pg_temp.reg(63, 'vínculos: pago; medição de fornecedor de origem; atribuído = 60000 × 33333 ÷ 100000 = 20000 (bruto 60000)',
    'ok:pago|00000000-0000-4000-8000-0000000bc075|100000|6000|20000|60000|33333', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select valor_centavos || '|' || vinculo_valor_centavos || '|' || relatorio_status || '|' || despesa_tipo_nome
                             from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001')
                            where origem = 'caixinha_despesa');
exception when others then
  perform pg_temp.reg(64, 'vínculos: caixinha com o valor ATUAL da despesa (1800) e o do vínculo (1500)',
    'ok:1800|1500|ENVIADO|Material', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.f@teste.invalid');
  raise exception 'ok:%|%', (select count(*) || '|' || sum(valor_centavos)
                               from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc002')),
    (select count(*) from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(65, 'vínculos: engenheiro da filha vê a filha (1, 40000 × 0,33333 = 13333) e nada da mãe', 'ok:1|13333|0', sqlerrm);
end $$;

do $$
declare v text := '';
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  v := v || (select count(*) from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001'));
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  v := v || '|' || (select count(*) from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001'));
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  v := v || '|' || (select count(*) from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001'));
  perform pg_temp.como('service_role', null);
  v := v || '|' || (select count(*) from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001'));
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(66, 'vínculos: supervisor, engenheiro de outra obra, sem acesso e service role = vazio', 'ok:0|0|0|0', sqlerrm);
end $$;

-- ============================================================
-- obras_fin_caixinha_sem_obra (contagem global)
-- ============================================================
do $$
declare v_q0 bigint; v_q bigint;
begin
  select substr(valor, strpos(valor, 'base:') + 5)::bigint into v_q0 from _base;
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  select quantidade into v_q
    from public.obras_fin_caixinha_sem_obra('00000000-0000-4000-8000-0000000bc001');
  raise exception 'ok:%|%', v_q - v_q0,
    (select count(*) from pg_proc p, unnest(p.proargnames) as x(nome)
      where p.oid = 'public.obras_fin_caixinha_sem_obra(uuid)'::regprocedure and x.nome like '%valor%');
exception when others then
  perform pg_temp.reg(67, 'caixinha sem obra: +2 despesas (SPOT/Material e vínculo desfeito; fixa, ADM, teste e ligada fora); só a contagem',
    'ok:2|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_fin_caixinha_sem_obra('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(68, 'caixinha sem obra: engenheiro da obra recebe UMA linha', 'ok:1', sqlerrm);
end $$;

do $$
declare v text := '';
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  v := v || (select count(*) from public.obras_fin_caixinha_sem_obra('00000000-0000-4000-8000-0000000bc001'));
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  v := v || '|' || (select count(*) from public.obras_fin_caixinha_sem_obra('00000000-0000-4000-8000-0000000bc001'));
  perform pg_temp.como('service_role', null);
  v := v || '|' || (select count(*) from public.obras_fin_caixinha_sem_obra('00000000-0000-4000-8000-0000000bc001'));
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(69, 'caixinha sem obra: supervisor, engenheiro de outra obra e service role = zero linhas', 'ok:0|0|0', sqlerrm);
end $$;

-- ============================================================
-- obras_fin_locacoes
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || count(*) filter (where pedido_id in ('00000000-0000-4000-8000-0000000bc041',
                                                                                      '00000000-0000-4000-8000-0000000bc044',
                                                                                      '00000000-0000-4000-8000-0000000bc045'))
                             from public.obras_fin_locacoes('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(70, 'locações(mãe): 2 (mãe + filha); sem material, sem outra obra, sem pedido não emitido', 'ok:2|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select pg_temp.tf(inicio = (now() at time zone 'America/Sao_Paulo')::date) || '|'
                                  || pg_temp.tf(fim = current_date + 60) || '|' || pg_temp.tf(locacao_fim = current_date + 30) || '|'
                                  || estado || '|' || total_centavos || '|' || pg_temp.tf(sem_periodo)
                             from public.obras_fin_locacoes('00000000-0000-4000-8000-0000000bc001')
                            where pedido_id = '00000000-0000-4000-8000-0000000bc042');
exception when others then
  perform pg_temp.reg(71, 'locações: entregue -> início = entrega; renovada -> fim = renovada_ate; total para quem vê valor',
    'ok:t|t|t|renovada|50000|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select coalesce(inicio::text, 'NULL') || '|' || pg_temp.tf(fim = current_date + 10) || '|'
                                  || estado || '|' || obra_os
                             from public.obras_fin_locacoes('00000000-0000-4000-8000-0000000bc001')
                            where pedido_id = '00000000-0000-4000-8000-0000000bc043');
exception when others then
  perform pg_temp.reg(72, 'locações: não entregue -> início NULL; fim = locacao_fim do Compras; ativa; OS da filha',
    'ok:NULL|t|ativa|TESTE-FIN-BC-FILHA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || count(total_centavos)
                             from public.obras_fin_locacoes('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(73, 'locações: usuário do Obras vê as linhas (aviso) mas total_centavos NULL', 'ok:2|0', sqlerrm);
end $$;

do $$
declare v text := '';
begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  v := v || (select count(*) from public.obras_fin_locacoes('00000000-0000-4000-8000-0000000bc001'));
  perform pg_temp.como('service_role', null);
  v := v || '|' || (select count(*) from public.obras_fin_locacoes('00000000-0000-4000-8000-0000000bc001'));
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(74, 'locações: sem acesso e service role = vazio', 'ok:0|0', sqlerrm);
end $$;

-- ============================================================
-- obras_fin_medicoes_fornecedor_atrasadas
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || string_agg(medicao_id::text || ':' || aguardando, ',' order by solicitado_em) || '|' || pg_temp.tf(bool_and(dias_aguardando >= 10))
                             from public.obras_fin_medicoes_fornecedor_atrasadas('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(75, 'atrasadas(mãe): global com obra na medição (aguarda engenheiro) + pré-aprovada há 11 dias (aguarda Eduardo); 5 dias, aprovada e outra obra fora',
    'ok:2|00000000-0000-4000-8000-0000000bc076:engenheiro,00000000-0000-4000-8000-0000000bc071:eduardo|t', sqlerrm);
end $$;

do $$
declare v text := '';
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  v := v || (select count(*) from public.obras_fin_medicoes_fornecedor_atrasadas('00000000-0000-4000-8000-0000000bc001'));
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  v := v || '|' || (select count(*) from public.obras_fin_medicoes_fornecedor_atrasadas('00000000-0000-4000-8000-0000000bc001'));
  perform pg_temp.como('service_role', null);
  v := v || '|' || (select count(*) from public.obras_fin_medicoes_fornecedor_atrasadas('00000000-0000-4000-8000-0000000bc001'));
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(76, 'medições de fornecedor atrasadas: supervisor, engenheiro de outra obra e service role = vazio', 'ok:0|0|0', sqlerrm);
end $$;

-- ============================================================
-- obras_fin_notas com medicao_ids
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || sum(parcela_centavos) || '|'
                                  || max(medicao_ids::text) filter (where obra_id = '00000000-0000-4000-8000-0000000bc001') || '|'
                                  || max(medicao_ids::text) filter (where obra_id = '00000000-0000-4000-8000-0000000bc002')
                             from public.obras_fin_notas('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(77, 'notas: uma linha por (nota, obra), soma 100000; medições da MESMA obra em cada linha',
    'ok:2|100000|{00000000-0000-4000-8000-0000000bc081,00000000-0000-4000-8000-0000000bc082}|{00000000-0000-4000-8000-0000000bc084}', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_fin_notas('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(78, 'notas: usuário do Obras (supervisor) = vazio', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.fin_fat_nota_medicoes where nota_id = '00000000-0000-4000-8000-0000000bc0a2';
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select string_agg(medicao_ids::text, ',') from public.obras_fin_notas('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(79, 'notas: sem medição ligada -> medicao_ids vazio ({}), nunca NULL', 'ok:{},{}', sqlerrm);
end $$;

-- ============================================================
-- Grants: anon não executa nada nem lê as tabelas
-- ============================================================
do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(80, 'anon não executa obras_fin_vinculos', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_fin_caixinha_sem_obra('00000000-0000-4000-8000-0000000bc001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(81, 'anon não executa obras_fin_caixinha_sem_obra', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_fin_locacoes('00000000-0000-4000-8000-0000000bc001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(82, 'anon não executa obras_fin_locacoes', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_fin_medicoes_fornecedor_atrasadas('00000000-0000-4000-8000-0000000bc001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(83, 'anon não executa obras_fin_medicoes_fornecedor_atrasadas', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_fin_notas('00000000-0000-4000-8000-0000000bc001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(84, 'anon não executa obras_fin_notas (recriada)', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform public.obras_engenheiro_ou_admin_mae('00000000-0000-4000-8000-0000000bc001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(85, 'anon não executa obras_engenheiro_ou_admin_mae', 'permission denied for function', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_medicao_cliente;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(86, 'anon não lê obras_medicao_cliente', 'permission denied for table', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_cliente_pessoa;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(87, 'anon não lê obras_cliente_pessoa', 'permission denied for table', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_locacao_estado;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(88, 'anon não lê obras_locacao_estado', 'permission denied for table', sqlerrm);
end $$;

do $$
declare v text := '';
begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  v := pg_temp.tf(public.obras_engenheiro_ou_admin_mae('00000000-0000-4000-8000-0000000bc002'))
       || '|' || pg_temp.tf(public.obras_engenheiro_ou_admin_mae('00000000-0000-4000-8000-0000000bc003'))
       || '|' || pg_temp.tf(public.obras_engenheiro_ou_admin_mae(null))
       || '|' || pg_temp.tf(public.obras_engenheiro_ou_admin_mae('00000000-0000-4000-8000-0000000fffff'));
  perform pg_temp.como('authenticated', 'eng.f@teste.invalid');
  v := v || '|' || pg_temp.tf(public.obras_engenheiro_ou_admin_mae('00000000-0000-4000-8000-0000000bc001'));
  perform pg_temp.como('service_role', null);
  v := v || '|' || pg_temp.tf(public.obras_engenheiro_ou_admin_mae('00000000-0000-4000-8000-0000000bc001'));
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(89, 'engenheiro_ou_admin_mae: mãe vê filha t; outra obra, NULL, inexistente, filha->mãe, service role = f (nunca NULL)',
    'ok:t|f|f|f|f|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  raise exception 'ok:%', (select valor_centavos || '|' || vinculo_valor_centavos || '|' || coalesce(rateio_obras_centavos::text, 'NULL')
                             from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc003'));
exception when others then
  perform pg_temp.reg(90, 'vínculos: solicitação sem rateio -> atribuído = valor do vínculo', 'ok:50000|50000|NULL', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || count(*) filter (where not contrato_da_obra) || '|'
                                  || pg_temp.tf(bool_and(valor_mo_reais is null and aditivos_mo_reais is null) filter (where not contrato_da_obra)) || '|'
                                  || count(*) filter (where medicao_id = '00000000-0000-4000-8000-0000000bc077')
                             from public.obras_fin_fornecedores('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(91, 'fornecedores(mãe): 5 do contrato da obra + 1 do GLOBAL pela medição (valor do contrato NULL); global de outra obra fora',
    'ok:6|1|t|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.b@teste.invalid');
  raise exception 'ok:%', (select count(*) || '|' || string_agg(medicao_id::text, ',' order by medicao_id)
                             from public.obras_fin_fornecedores('00000000-0000-4000-8000-0000000bc003'));
exception when others then
  perform pg_temp.reg(92, 'fornecedores(outra): medição do contrato da obra + medição do global com esta obra',
    'ok:2|00000000-0000-4000-8000-0000000bc074,00000000-0000-4000-8000-0000000bc077', sqlerrm);
end $$;

-- ============================================================
-- Fix round 1: origem fornecedor, medição com nota, locação, datas, truncate
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select frn_medicao_id || '|' || pg_temp.tf(de_medicao_fornecedor) || '|' || valor_centavos
                             from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001')
                            where solicitacao_id = '00000000-0000-4000-8000-0000000bc055');
exception when others then
  perform pg_temp.reg(93, 'vínculos: solicitação da integração (sem write-back no Fornecedores) marcada, medição pela chave',
    'ok:00000000-0000-4000-8000-0000000bc078|t|7000', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select count(*) filter (where de_medicao_fornecedor) || '|' || count(*) || '|'
                                  || count(*) filter (where de_medicao_fornecedor is null)
                             from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(94, 'vínculos: S1 (mãe e filha, pelo fin_solicitacao_id) e S5 marcadas; caixinha não; nunca NULL', 'ok:3|4|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  delete from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(95, 'medição: administrador não apaga medição com nota', 'medição com nota emitida não se apaga', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(96, 'medição: sem JWT (service role) também não apaga medição com nota', 'medição com nota emitida não se apaga', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_medicao_cliente set valor_centavos = 299999 where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(97, 'medição: administrador não muda valor de medição com nota', 'medição com nota emitida: percentual', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.fin_fat_nota_medicoes where medicao_id = '00000000-0000-4000-8000-0000000bc082';
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_medicao_cliente set situacao = 'enviada' where id = '00000000-0000-4000-8000-0000000bc082';
  raise exception 'ok:%', (select situacao || '|' || coalesce(aprovada_em::text, 'NULL')
                             from public.obras_medicao_cliente where id = '00000000-0000-4000-8000-0000000bc082');
exception when others then
  perform pg_temp.reg(98, 'medição: sem nota, administrador reabre a aprovada (aprovada_em limpa)', 'ok:enviada|NULL', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set situacao = 'aprovada', aprovada_em = now() - interval '3 days'
   where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(99, 'medição: aprovação antes do envio recusada', 'a aprovação não pode ser antes do envio', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-0000000bc045', '00000000-0000-4000-8000-0000000bc001', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(100, 'locação: pedido ainda não emitido recusado', 'não foi emitido', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_locacao_estado set renovada_ate = current_date + 30
   where id = '00000000-0000-4000-8000-0000000bc092';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(101, 'locação: renovada até = fim do Compras recusada (tem de ser depois)', 'tem de ser depois do fim atual', sqlerrm);
end $$;

do $$
declare v text := '';
begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  begin
    truncate public.obras_cliente_pessoa;
    v := 'truncou';
  exception when others then
    v := 'negado:' || pg_temp.tf(strpos(sqlerrm, 'permission denied') > 0);
  end;
  begin
    truncate public.obras_locacao_estado;
    v := v || '|truncou';
  exception when others then
    v := v || '|negado:' || pg_temp.tf(strpos(sqlerrm, 'permission denied') > 0);
  end;
  begin
    truncate public.obras_medicao_cliente;
    v := v || '|truncou';
  exception when others then
    v := v || '|negado:' || pg_temp.tf(strpos(sqlerrm, 'permission denied') > 0);
  end;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(102, 'authenticated (até admin) não faz TRUNCATE nas 3 tabelas', 'ok:negado:t|negado:t|negado:t', sqlerrm);
end $$;

-- ============================================================
-- Follow-up: valor receita (obras_obra.valor) só admin em OBRA
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_obra set valor = 123456.78 where id = '00000000-0000-4000-8000-0000000bc001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(103, 'valor receita: engenheiro da OBRA não altera', 'OBRAS_VALOR: só administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_obra set valor = 123456.78 where id = '00000000-0000-4000-8000-0000000bc001';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(104, 'valor receita: usuário do Obras não altera em OBRA', 'OBRAS_VALOR: só administrador', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_obra set valor = 123456.78 where id = '00000000-0000-4000-8000-0000000bc001';
  raise exception 'ok:%', (select valor from public.obras_obra where id = '00000000-0000-4000-8000-0000000bc001');
exception when others then
  perform pg_temp.reg(105, 'valor receita: administrador altera em OBRA', 'ok:123456.78', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_obra set valor = 999.5 where id = '00000000-0000-4000-8000-0000000bc004';
  raise exception 'ok:%', (select valor from public.obras_obra where id = '00000000-0000-4000-8000-0000000bc004');
exception when others then
  perform pg_temp.reg(106, 'valor: usuário do Obras continua alterando em SPOT', 'ok:999.5', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_obra set valor = 777 where id = '00000000-0000-4000-8000-0000000bc001';
  raise exception 'ok:%', (select valor from public.obras_obra where id = '00000000-0000-4000-8000-0000000bc001');
exception when others then
  perform pg_temp.reg(107, 'valor receita: sem JWT (service role / sync) altera em OBRA', 'ok:777', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_obra set descricao = 'Outra descrição', valor = valor where id = '00000000-0000-4000-8000-0000000bc001';
  raise exception 'ok:%', (select descricao from public.obras_obra where id = '00000000-0000-4000-8000-0000000bc001');
exception when others then
  perform pg_temp.reg(108, 'valor receita: gravar outra coluna (valor igual) na OBRA continua livre', 'ok:Outra descrição', sqlerrm);
end $$;

-- ============================================================
-- fornecedor_documento (revisão da Task 7, M3): casar pagamento do Financeiro com pedido
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select coalesce(max(fornecedor_documento) filter (where pedido_id = '00000000-0000-4000-8000-0000000bc041'), 'null')
                                  || '|' || coalesce(max(fornecedor_documento) filter (where pedido_id = '00000000-0000-4000-8000-0000000bc042'), 'null')
                             from public.obras_fin_compras('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(109, 'compras: fornecedor_documento só [0-9A-Z] (12.345.678/0001-90 → 12345678000190); vazio → NULL',
    'ok:12345678000190|null', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  raise exception 'ok:%', (select max(fornecedor_documento) filter (where solicitacao_id = '00000000-0000-4000-8000-0000000bc051')
                                  || '|' || count(*) filter (where origem = 'caixinha_despesa' and fornecedor_documento is not null)
                             from public.obras_fin_vinculos('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(110, 'vínculos: fornecedor_documento da solicitação; caixinha sem documento', 'ok:99999999000191|0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_fin_compras('00000000-0000-4000-8000-0000000bc001'));
exception when others then
  perform pg_temp.reg(111, 'compras recriada: quem não vê valores continua sem linhas', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.a@teste.invalid');
  update public.obras_medicao_cliente set situacao = 'recusada' where id = '00000000-0000-4000-8000-0000000bc081';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(112, 'medição com nota: engenheiro não recusa (enviada -> recusada)', 'não pode ser recusada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_medicao_cliente set situacao = 'recusada' where id = '00000000-0000-4000-8000-0000000bc084';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(113, 'medição com nota: nem administrador recusa', 'não pode ser recusada', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_medicao_cliente set situacao = 'recusada' where id = '00000000-0000-4000-8000-0000000bc084';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(114, 'medição com nota: sem JWT também não recusa', 'não pode ser recusada', sqlerrm);
end $$;

-- ============================================================
-- Relatório (a tabela abaixo; no SQL Editor vale a mensagem do bloco final)
-- Comparação por pg_temp.passou: exata para 'ok:'/'RECUSADO', por trecho para erro.
-- ============================================================
select n, teste, esperado, obtido,
       case when pg_temp.passou(obtido, esperado) then 'OK' else '*** FALHOU ***' end as resultado
  from _v order by n;

do $$
declare
  v_total int;
  v_ok    int;
  v_falhas text;
begin
  select count(*), count(*) filter (where pg_temp.passou(obtido, esperado)),
         string_agg(n::text || ' (' || coalesce(obtido, 'NULL') || ')', '; ' order by n)
           filter (where not pg_temp.passou(obtido, esperado))
    into v_total, v_ok, v_falhas
    from _v;
  if v_total <> 114 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 114 testes rodaram';
  end if;
  raise exception 'RESUMO: %/114 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end
    using errcode = 'P0001';
end $$;

rollback;
