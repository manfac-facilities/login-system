-- ============================================================
-- Teste de comportamento de sdd-sql-obras-spot-financeiro.sql
-- Rodar DEPOIS de aplicar a migration, no SQL Editor, projeto iyytcavcgukfjnjjrerx.
-- Rodar o arquivo INTEIRO de uma vez. NÃO GRAVA NADA: tudo roda numa
-- transação e o bloco final termina em erro de propósito (desfaz tudo).
-- A mensagem de erro final é o relatório:
--   "RESUMO: N/N OK"               -> tudo certo
--   "RESUMO: x/N OK — FALHOU: ..." -> parar e não deployar
-- Sem a linha "RESUMO" = algo quebrou antes (erro diferente do esperado).
--
-- Padrão de docs/obras/2026-11-01-verificacao-obras-financeiro-bc.sql: cada teste
-- roda num bloco do $$ ... $$ que termina em erro (o esperado, ou raise 'ok:...'),
-- o que desfaz o que ele fez, inclusive a troca de role. Booleanos como t/f.
--   * pg_temp.jwt(email): JWT simulado como postgres;
--   * pg_temp.como(role, email): troca a role (authenticated / service_role) com o
--     JWT daquele e-mail (testa GRANT e RLS de verdade);
--   * pg_temp.rec(msg, tag): 'RECUSADO' quando a mensagem tem a tag da guarda OU é
--     recusa de RLS.
-- marcar/desmarcar rodam como postgres SEM JWT (a rodada do Financeiro não tem
-- usuário); o GRANT só para service_role é conferido nos casos 34 e 35.
--
-- Fixture (só dentro da transação; e-mails .invalid, nada pessoal):
--   S1 TESTE-SPOTFIN-S1 (SPOT, pcm TESTE-SPOTFIN-AN, valor R$ 1.000,00, pendFat)
--   S2 TESTE-SPOTFIN-S2 (SPOT, pcm TESTE-SPOTFIN-OUTRO, valor R$ 500,00, pendFat)
--   S3 TESTE-SPOTFIN-S3 (SPOT, sem valor, pendFat)
--   O1 TESTE-SPOTFIN-O1 (OBRA, engenheiro eng.o, pcm TESTE-SPOTFIN-AN, valor R$ 2.000,00, pendFat)
--   obras_pessoa: TESTE-SPOTFIN-AN = analista.spot; TESTE-SPOTFIN-OUTRO = outro.analista
--   acesso ao Obras: usuario.obras, analista.spot, outro.analista, eng.o (sem.acesso não tem)
--   Compras: locações emitidas P1 e P2 em S1, P3 em S2, P4 em O1; estado E1 em P2 (sem JWT).
--   Notas do Financeiro: criadas DENTRO de cada teste (pg_temp.nota), autorizadas, produção.
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

create function pg_temp.rec(p_msg text, p_tag text) returns text language sql as $$
  select case when strpos(p_msg, p_tag) > 0 or strpos(p_msg, 'row-level security') > 0
              then 'RECUSADO' else p_msg end;
$$;

-- 'ok:...' e 'RECUSADO' têm de ser IGUAIS; mensagens de erro esperadas, por trecho.
create function pg_temp.passou(p_obtido text, p_esperado text) returns boolean language sql as $$
  select coalesce(case when p_esperado like 'ok:%' or p_esperado = 'RECUSADO' then p_obtido = p_esperado
                       else strpos(p_obtido, p_esperado) > 0 end, false);
$$;

create function pg_temp.admin_email() returns text language sql as $$
  select lower(trim(user_email)) from public.hub_user_roles where nivel = 'administrador' order by lower(trim(user_email)) limit 1;
$$;

-- Nota AUTORIZADA de produção com UMA obra; parte da obra = valor da nota.
create function pg_temp.nota(p_obra uuid, p_nfse text, p_centavos bigint, p_ambiente text default 'producao') returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.fin_fat_notas
    (lote_id, ambiente, tomador_cnpj, valor_total_centavos, situacao, nfse_numero,
     codigo_servico_municipal, aliquota_iss, retem_iss, aliquota_inss, descricao, departamento, codigo_integracao)
  values ('00000000-0000-4000-8000-00000005fa01', p_ambiente, '00000000000000', p_centavos, 'autorizada', p_nfse,
          '0000', 0, false, 0, 'Teste SPOT financeiro', 'TESTE', 'TSF-' || p_nfse || '-' || right(p_obra::text, 3) || '-' || p_ambiente)
  returning id into v_id;
  insert into public.fin_fat_nota_obras (nota_id, obra_id, os, valor_centavos, forma)
  values (v_id, p_obra, null, p_centavos, 'manual');
  return v_id;
end $$;

create function pg_temp.cancelar(p_nfse text) returns void language sql as $$
  update public.fin_fat_notas set situacao = 'cancelada'
   where codigo_integracao like 'TSF-' || p_nfse || '-%';
$$;

create function pg_temp.marcar(p_obra uuid, p_nfse text, p_pedido text default 'PED-1') returns jsonb language sql as $$
  select public.obras_marcar_faturada(array[p_obra], p_nfse, p_pedido, 'F1', date '2026-11-01', 'teste-spot@hub');
$$;

create function pg_temp.desmarcar(p_obra uuid, p_nfse text) returns jsonb language sql as $$
  select public.obras_desmarcar_faturada(array[p_obra], p_nfse, 'teste-spot@hub');
$$;

-- etapa|fat_nfse da obra
create function pg_temp.estado(p_obra uuid) returns text language sql as $$
  select etapa || '|' || coalesce(fat_nfse, 'null') from public.obras_obra where id = p_obra;
$$;

select pg_temp.jwt(null);

-- Obras (sem JWT)
insert into public.obras_obra (id, os, modalidade, engenheiro_email, pcm, etapa, valor)
values ('00000000-0000-4000-8000-00000005f001', 'TESTE-SPOTFIN-S1', 'spot', null, 'TESTE-SPOTFIN-AN', 'pendFat', 1000.00),
       ('00000000-0000-4000-8000-00000005f002', 'TESTE-SPOTFIN-S2', 'spot', null, 'TESTE-SPOTFIN-OUTRO', 'pendFat', 500.00),
       ('00000000-0000-4000-8000-00000005f003', 'TESTE-SPOTFIN-S3', 'spot', null, null, 'pendFat', null),
       ('00000000-0000-4000-8000-00000005f004', 'TESTE-SPOTFIN-O1', 'obra', 'eng.o@teste.invalid', 'TESTE-SPOTFIN-AN', 'pendFat', 2000.00);

insert into public.obras_pessoa (chave, nome, email)
values ('TESTE-SPOTFIN-AN', 'Analista Teste', 'analista.spot@teste.invalid'),
       ('TESTE-SPOTFIN-OUTRO', 'Outro Analista Teste', 'outro.analista@teste.invalid');

insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
values ('usuario.obras@teste.invalid', 'obras', true, 'verificacao-spot-fin'),
       ('analista.spot@teste.invalid', 'obras', true, 'verificacao-spot-fin'),
       ('outro.analista@teste.invalid', 'obras', true, 'verificacao-spot-fin'),
       ('eng.o@teste.invalid', 'obras', true, 'verificacao-spot-fin');

-- Compras: solicitação -> mapa -> fornecedor do mapa -> pedido (locações emitidas)
insert into public.cmp_solicitacoes
  (id, ambiente, numero, etapa, tipo, solicitante_email, solicitante_nome, cc_codigo, cc_descricao,
   obra_id, obra_os, motivo, prazo_necessario, locacao_fim, recebimento, urgente, enviado_em, dia_referencia, data_minima)
select x.id, 'producao', x.numero, 'pedido_emitido', 'locacao', 'solicitante@teste.invalid', 'Solicitante Teste',
       '10159908939', 'DPSP - OBRAS', x.obra, x.os, 'Teste do SPOT financeiro',
       current_date + 1, current_date + 30, 'base', false, now(), current_date, current_date
  from (values
    ('00000000-0000-4000-8000-00000005f011'::uuid, 999005011::bigint, '00000000-0000-4000-8000-00000005f001'::uuid, 'TESTE-SPOTFIN-S1'),
    ('00000000-0000-4000-8000-00000005f012'::uuid, 999005012::bigint, '00000000-0000-4000-8000-00000005f001'::uuid, 'TESTE-SPOTFIN-S1'),
    ('00000000-0000-4000-8000-00000005f013'::uuid, 999005013::bigint, '00000000-0000-4000-8000-00000005f002'::uuid, 'TESTE-SPOTFIN-S2'),
    ('00000000-0000-4000-8000-00000005f014'::uuid, 999005014::bigint, '00000000-0000-4000-8000-00000005f004'::uuid, 'TESTE-SPOTFIN-O1'))
  as x(id, numero, obra, os);

insert into public.cmp_mapas (id, solicitacao_id, rodada, situacao, criado_por)
select ('00000000-0000-4000-8000-00000005f02' || k)::uuid, ('00000000-0000-4000-8000-00000005f01' || k)::uuid,
       1, 'aprovado', 'comprador@teste.invalid'
  from unnest(array['1','2','3','4']) k;

insert into public.cmp_mapa_fornecedores (id, mapa_id, ordem, razao_social, frete_tipo, documento)
select ('00000000-0000-4000-8000-00000005f03' || k)::uuid, ('00000000-0000-4000-8000-00000005f02' || k)::uuid,
       1, 'Locadora SPOT Teste ' || k, 'incluso', ''
  from unnest(array['1','2','3','4']) k;

insert into public.cmp_pedidos
  (id, solicitacao_id, ambiente, sequencia, mapa_fornecedor_id, codigo_integracao, pagamento, condicao_codigo,
   total_centavos, situacao, etapa_atual, previsao_entrega, entrega_situacao, entrega_em)
select ('00000000-0000-4000-8000-00000005f04' || k)::uuid, ('00000000-0000-4000-8000-00000005f01' || k)::uuid, 'producao', 1,
       ('00000000-0000-4000-8000-00000005f03' || k)::uuid, 'TSF-P' || k, 'faturado', '000', 10000, 'emitido', 'pedido',
       current_date + 2, null, null
  from unnest(array['1','2','3','4']) k;

-- Estado E1: locação P2 (S1) renovada até +60 (sem JWT)
insert into public.obras_locacao_estado (id, cmp_pedido_id, obra_id, renovada_ate)
values ('00000000-0000-4000-8000-00000005f092', '00000000-0000-4000-8000-00000005f042',
        '00000000-0000-4000-8000-00000005f001', current_date + 60);

-- Lote do faturamento (as notas nascem em cada teste)
insert into public.fin_fat_lotes (id, ambiente, tipo_id, referencia, criado_por_email, criado_por_nome)
select '00000000-0000-4000-8000-00000005fa01', 'producao', t.id, 'TESTE-SPOT-FIN', 'fin.teste@teste.invalid', 'Fin Teste'
  from (select id from public.fin_fat_tipos order by id limit 1) t;

do $$ begin
  raise exception 'ok:%', (select count(*) from public.obras_obra where os like 'TESTE-SPOTFIN-%')
                          || '|' || (select count(*) from public.fin_fat_lotes where id = '00000000-0000-4000-8000-00000005fa01')
                          || '|' || pg_temp.tf(pg_temp.admin_email() is not null);
exception when others then
  perform pg_temp.reg(1, 'fixture: 4 obras, lote do faturamento, há administrador', 'ok:4|1|t', sqlerrm);
end $$;

-- ============================================================
-- Quem vê valores (obras_pode_ver_valores)
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000005f001'));
exception when others then
  perform pg_temp.reg(2, 'valores: SPOT visível a usuário só com acesso ao Obras', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000005f004'));
exception when others then
  perform pg_temp.reg(3, 'valores: OBRA NÃO visível ao mesmo usuário', 'ok:f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000005f001'));
exception when others then
  perform pg_temp.reg(4, 'valores: sem acesso ao Obras -> false no SPOT', 'ok:f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000005f001'))
                          || '|' || pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-0000000fffff'));
exception when others then
  perform pg_temp.reg(5, 'valores: sem JWT -> false; obra inexistente -> false', 'ok:f|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.o@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_pode_ver_valores('00000000-0000-4000-8000-00000005f004'));
exception when others then
  perform pg_temp.reg(6, 'valores: OBRA continua visível ao engenheiro dela', 'ok:t', sqlerrm);
end $$;

-- ============================================================
-- Locação no SPOT: analista da OS ou admin
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'analista.spot@teste.invalid');
  raise exception 'ok:%', pg_temp.tf(public.obras_analista_spot('00000000-0000-4000-8000-00000005f001'))
                          || '|' || pg_temp.tf(public.obras_analista_spot('00000000-0000-4000-8000-00000005f002'))
                          || '|' || pg_temp.tf(public.obras_analista_spot('00000000-0000-4000-8000-00000005f004'))
                          || '|' || pg_temp.tf(public.obras_analista_spot('00000000-0000-4000-8000-0000000fffff'));
exception when others then
  perform pg_temp.reg(7, 'analista_spot: true na OS dele; false em outra OS, em OBRA (mesmo pcm) e em obra inexistente', 'ok:t|f|f|f', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'analista.spot@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em, criado_por)
  values ('00000000-0000-4000-8000-00000005f041', '00000000-0000-4000-8000-00000005f001', current_date, 'forjado@teste.invalid');
  raise exception 'ok:%', (select criado_por from public.obras_locacao_estado where cmp_pedido_id = '00000000-0000-4000-8000-00000005f041');
exception when others then
  perform pg_temp.reg(8, 'locação: analista (via obras_pessoa.email) marca locação do SPOT; autoria forçada', 'ok:analista.spot@teste.invalid', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'outro.analista@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-00000005f041', '00000000-0000-4000-8000-00000005f001', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(9, 'locação: analista de OUTRA OS recusado (42501)', 'RECUSADO|42501',
    pg_temp.rec(sqlerrm, 'OBRAS_LOCACAO: só o engenheiro da obra, o analista do SPOT') || '|' || sqlstate);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-00000005f041', '00000000-0000-4000-8000-00000005f001', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(10, 'locação: usuário só com acesso ao Obras NÃO marca locação do SPOT', 'RECUSADO',
    pg_temp.rec(sqlerrm, 'OBRAS_LOCACAO: só o engenheiro da obra, o analista do SPOT'));
end $$;

do $$ begin
  perform pg_temp.jwt(pg_temp.admin_email());
  -- a guarda do gatilho (sem a RLS): admin passa
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-00000005f043', '00000000-0000-4000-8000-00000005f002', current_date);
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-00000005f041', '00000000-0000-4000-8000-00000005f001', current_date);
  raise exception 'ok:%', (select count(*) from public.obras_locacao_estado
                            where cmp_pedido_id in ('00000000-0000-4000-8000-00000005f041', '00000000-0000-4000-8000-00000005f043'));
exception when others then
  perform pg_temp.reg(11, 'locação: administrador marca locação de SPOT (gatilho e RLS)', 'ok:2', sqlerrm);
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', 'analista.spot@teste.invalid');
  update public.obras_locacao_estado set devolvida_em = current_date where id = '00000000-0000-4000-8000-00000005f092';
  get diagnostics v_n = row_count;
  raise exception 'ok:%|%', v_n, (select atualizado_por from public.obras_locacao_estado where id = '00000000-0000-4000-8000-00000005f092');
exception when others then
  perform pg_temp.reg(12, 'locação: analista marca devolvida (update) no SPOT dele', 'ok:1|analista.spot@teste.invalid', sqlerrm);
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', 'outro.analista@teste.invalid');
  update public.obras_locacao_estado set devolvida_em = current_date where id = '00000000-0000-4000-8000-00000005f092';
  get diagnostics v_n = row_count;
  raise exception 'ok:%', v_n;
exception when others then
  perform pg_temp.reg(13, 'locação: analista de outra OS não altera (0 linhas)', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro.analista@teste.invalid');
  -- a guarda do gatilho (sem a RLS): analista de outra OS = 42501
  update public.obras_locacao_estado set devolvida_em = current_date where id = '00000000-0000-4000-8000-00000005f092';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(14, 'locação: gatilho recusa analista de outra OS com 42501 (sem RLS)', 'OBRAS_LOCACAO: só o engenheiro da obra, o analista do SPOT ou administrador marca a locação|42501',
    sqlerrm || '|' || sqlstate);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'eng.o@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-00000005f044', '00000000-0000-4000-8000-00000005f004', current_date);
  raise exception 'ok:%', (select criado_por from public.obras_locacao_estado where cmp_pedido_id = '00000000-0000-4000-8000-00000005f044');
exception when others then
  perform pg_temp.reg(15, 'locação: OBRA continua com o engenheiro dela', 'ok:eng.o@teste.invalid', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'analista.spot@teste.invalid');
  insert into public.obras_locacao_estado (cmp_pedido_id, obra_id, devolvida_em)
  values ('00000000-0000-4000-8000-00000005f044', '00000000-0000-4000-8000-00000005f004', current_date);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(16, 'locação: analista (pcm) NÃO marca locação de OBRA', 'RECUSADO',
    pg_temp.rec(sqlerrm, 'OBRAS_LOCACAO: só o engenheiro da obra, o analista do SPOT'));
end $$;

-- ============================================================
-- obras_nota_externa
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos)
  values ('00000000-0000-4000-8000-00000005f001', '7001', current_date, 10000);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(17, 'nota externa: não-admin NÃO insere', 'RECUSADO', pg_temp.rec(sqlerrm, 'row-level security'));
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'analista.spot@teste.invalid');
  insert into public.obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos)
  values ('00000000-0000-4000-8000-00000005f001', '7001', current_date, 10000);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(18, 'nota externa: analista do SPOT NÃO insere', 'RECUSADO', pg_temp.rec(sqlerrm, 'row-level security'));
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  insert into public.obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos)
  values ('00000000-0000-4000-8000-00000005f001', '7001', current_date, 10000);
  raise exception 'ok:%', (select pg_temp.tf(criado_por = pg_temp.admin_email()) from public.obras_nota_externa
                            where obra_id = '00000000-0000-4000-8000-00000005f001' and nfse = '7001');
exception when others then
  perform pg_temp.reg(19, 'nota externa: admin insere; criado_por = e-mail do JWT', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  insert into public.obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos, criado_por)
  values ('00000000-0000-4000-8000-00000005f001', '7002', current_date, 10000, 'forjado@teste.invalid');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(20, 'nota externa: admin não forja criado_por', 'RECUSADO', pg_temp.rec(sqlerrm, 'row-level security'));
end $$;

do $$
declare v text;
begin
  insert into public.obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos, criado_por)
  values ('00000000-0000-4000-8000-00000005f001', '7003', current_date, 10000, 'carga@teste.invalid'),
         ('00000000-0000-4000-8000-00000005f004', '7004', current_date, 10000, 'carga@teste.invalid');
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  v := (select count(*) from public.obras_nota_externa where nfse in ('7003', '7004'))::text;
  raise exception 'ok:%', v;
exception when others then
  perform pg_temp.reg(21, 'nota externa: usuário do Obras lê a do SPOT, não a da OBRA', 'ok:1', sqlerrm);
end $$;

do $$ begin
  insert into public.obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos, criado_por)
  values ('00000000-0000-4000-8000-00000005f001', '7005', current_date, 10000, 'carga@teste.invalid');
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  update public.obras_nota_externa set valor_centavos = 1 where nfse = '7005';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(22, 'nota externa: sem update (nem admin)', 'permission denied', sqlerrm);
end $$;

-- ============================================================
-- Faturamento parcial do SPOT (marcar/desmarcar como a rodada do Financeiro: sem JWT)
-- ============================================================
do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 40000);
  r := pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  raise exception 'ok:%|%|%|%|%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'),
    jsonb_array_length(r -> 'marcadas'), jsonb_array_length(r -> 'parciais'),
    (r -> 'parciais' -> 0 ->> 'faturado_centavos') || '/' || (r -> 'parciais' -> 0 ->> 'falta_centavos'),
    (select para from public.obras_historico where obra_id = '00000000-0000-4000-8000-00000005f001' and campo = 'faturamento parcial'),
    (select fat_pedido from public.obras_obra where id = '00000000-0000-4000-8000-00000005f001');
exception when others then
  perform pg_temp.reg(23, 'parcial: nota que não cobre o valor deixa o SPOT em pendFat e em parciais; histórico R$',
    'ok:pendFat|9001|0|1|40000/60000|R$ 400,00 de R$ 1.000,00|PED-1', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 40000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9002', 60000);
  r := pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9002', null);
  raise exception 'ok:%|%|%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'),
    jsonb_array_length(r -> 'marcadas') || '/' || jsonb_array_length(r -> 'parciais'),
    (select to_char(marco_faturou, 'DD/MM/YYYY') || '/' || coalesce(fat_pedido, 'null')
       from public.obras_obra where id = '00000000-0000-4000-8000-00000005f001'),
    (select count(*) from public.obras_historico where obra_id = '00000000-0000-4000-8000-00000005f001' and campo = 'etapa' and para = 'Faturado');
exception when others then
  perform pg_temp.reg(24, 'parcial: 2ª nota que fecha a soma leva a faturado; lista das duas NFS-e; pedido anterior mantido',
    'ok:faturado|9001, 9002|1/0|01/11/2026/PED-1|1', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 150000);
  r := pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  raise exception 'ok:%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'), jsonb_array_length(r -> 'parciais');
exception when others then
  perform pg_temp.reg(25, 'parcial: soma acima do valor leva a faturado', 'ok:faturado|9001|0', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 40000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9002', 60000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9002');
  perform pg_temp.cancelar('9002');
  r := pg_temp.desmarcar('00000000-0000-4000-8000-00000005f001', '9002');
  raise exception 'ok:%|%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'),
    jsonb_array_length(r -> 'marcadas'),
    (select coalesce(marco_faturou::text, 'null') || '/' || coalesce(fat_pedido, 'null')
       from public.obras_obra where id = '00000000-0000-4000-8000-00000005f001');
exception when others then
  perform pg_temp.reg(26, 'desmarcar a nota que fechou: volta a pendFat e tira a NFS-e da lista (a outra fica)',
    'ok:pendFat|9001|1|null/PED-1', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 40000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9002', 60000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9002');
  perform pg_temp.cancelar('9001');
  r := pg_temp.desmarcar('00000000-0000-4000-8000-00000005f001', '9001');
  raise exception 'ok:%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'), jsonb_array_length(r -> 'marcadas');
exception when others then
  perform pg_temp.reg(27, 'desmarcar a 1ª NFS-e da lista (não só igualdade): volta a pendFat com a 2ª', 'ok:pendFat|9002|1', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 50000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9002', 50000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9002');
  insert into public.obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos, criado_por)
  values ('00000000-0000-4000-8000-00000005f001', '7009', current_date, 60000, 'carga@teste.invalid');
  perform pg_temp.cancelar('9001');
  r := pg_temp.desmarcar('00000000-0000-4000-8000-00000005f001', '9001');
  raise exception 'ok:%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'), jsonb_array_length(r -> 'marcadas');
exception when others then
  perform pg_temp.reg(28, 'desmarcar com o restante ainda cobrindo o valor: continua faturado, só a lista muda', 'ok:faturado|9002|1', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 40000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  perform pg_temp.cancelar('9001');
  r := pg_temp.desmarcar('00000000-0000-4000-8000-00000005f001', '9001');
  raise exception 'ok:%|%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'), jsonb_array_length(r -> 'marcadas'),
    (select para from public.obras_historico where obra_id = '00000000-0000-4000-8000-00000005f001'
        and campo = 'faturamento parcial' and motivo like '%cancelada%');
exception when others then
  perform pg_temp.reg(29, 'desmarcar nota parcial (pendFat): só a lista muda e o histórico registra', 'ok:pendFat|null|1|R$ 0,00 de R$ 1.000,00', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 40000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  r := pg_temp.desmarcar('00000000-0000-4000-8000-00000005f001', '9099');
  raise exception 'ok:%|%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'),
    jsonb_array_length(r -> 'marcadas'), jsonb_array_length(r -> 'puladas');
exception when others then
  perform pg_temp.reg(30, 'desmarcar NFS-e fora da lista: pulada, nada muda', 'ok:pendFat|9001|0|1', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 40000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  r := pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  raise exception 'ok:%|%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'), jsonb_array_length(r -> 'parciais'),
    (select count(*) from public.obras_historico where obra_id = '00000000-0000-4000-8000-00000005f001' and campo = 'faturamento parcial');
exception when others then
  perform pg_temp.reg(31, 'parcial: mesma NFS-e de novo não repete na lista nem no histórico', 'ok:pendFat|9001|1|1', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f003', '9003', 10000);
  r := pg_temp.marcar('00000000-0000-4000-8000-00000005f003', '9003');
  raise exception 'ok:%|%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f003'),
    jsonb_array_length(r -> 'marcadas'), jsonb_array_length(r -> 'parciais');
exception when others then
  perform pg_temp.reg(32, 'SPOT sem valor fatura na 1ª nota', 'ok:faturado|9003|1|0', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f004', '9004', 10000);
  r := pg_temp.marcar('00000000-0000-4000-8000-00000005f004', '9004');
  raise exception 'ok:%|%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f004'),
    jsonb_array_length(r -> 'marcadas'), pg_temp.tf(r ? 'parciais') || '/' || jsonb_array_length(r -> 'parciais');
exception when others then
  perform pg_temp.reg(33, 'OBRA fatura na 1ª nota como antes (nota abaixo do valor); retorno tem a chave parciais', 'ok:faturado|9004|1|t/0', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f004', '9004', 10000);
  perform pg_temp.marcar('00000000-0000-4000-8000-00000005f004', '9004');
  perform pg_temp.cancelar('9004');
  r := pg_temp.desmarcar('00000000-0000-4000-8000-00000005f004', '9004');
  raise exception 'ok:%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f004'),
    (select coalesce(fat_pedido, 'null') || '/' || coalesce(fat_folhas, 'null') from public.obras_obra where id = '00000000-0000-4000-8000-00000005f004');
exception when others then
  perform pg_temp.reg(34, 'OBRA: desmarcar volta a pendFat e limpa fat_* como antes', 'ok:pendFat|null|null/null', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  insert into public.obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos, criado_por)
  values ('00000000-0000-4000-8000-00000005f001', '7010', current_date, 70000, 'carga@teste.invalid');
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 30000);
  r := pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  raise exception 'ok:%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'), jsonb_array_length(r -> 'marcadas');
exception when others then
  perform pg_temp.reg(35, 'nota externa entra na soma (70000 externa + 30000 nota = valor)', 'ok:faturado|9001|1', sqlerrm);
end $$;

do $$
declare r jsonb;
begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 40000);
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9010', 100000, 'teste');
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9011', 100000);
  update public.fin_fat_notas set obras_devolvidas_em = now() where codigo_integracao like 'TSF-9011-%';
  r := pg_temp.marcar('00000000-0000-4000-8000-00000005f001', '9001');
  raise exception 'ok:%|%', pg_temp.estado('00000000-0000-4000-8000-00000005f001'), r -> 'parciais' -> 0 ->> 'faturado_centavos';
exception when others then
  perform pg_temp.reg(36, 'soma ignora nota de ambiente teste e nota com obras devolvidas', 'ok:pendFat|9001|40000', sqlerrm);
end $$;

-- ============================================================
-- Grants (só service_role executa marcar e o faturado)
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  perform public.obras_marcar_faturada(array['00000000-0000-4000-8000-00000005f001'::uuid], '9001', null, null, current_date, 'x');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(37, 'authenticated (nem admin) executa obras_marcar_faturada', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', pg_temp.admin_email());
  perform public.obras_spot_faturado_centavos('00000000-0000-4000-8000-00000005f001');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(38, 'authenticated (nem admin) executa obras_spot_faturado_centavos', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.nota('00000000-0000-4000-8000-00000005f001', '9001', 40000);
  perform pg_temp.como('service_role', null);
  raise exception 'ok:%', public.obras_spot_faturado_centavos('00000000-0000-4000-8000-00000005f001');
exception when others then
  perform pg_temp.reg(39, 'service_role executa obras_spot_faturado_centavos', 'ok:40000', sqlerrm);
end $$;

-- ============================================================
-- Relatório (a tabela abaixo; no SQL Editor vale a mensagem do bloco final)
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
  if v_total <> 39 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 39 testes rodaram';
  end if;
  raise exception 'RESUMO: %/39 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end
    using errcode = 'P0001';
end $$;

rollback;
