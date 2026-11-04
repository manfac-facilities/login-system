-- ============================================================
-- Teste de comportamento de sdd-sql-obras-material.sql (material antecipado)
-- Rodar DEPOIS de aplicar o Compras 017 e a migration, no SQL Editor,
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
-- (desfaz o que ele fez, inclusive a troca de role).
-- Dois modos:
--   * como postgres (acima da RLS) com o JWT simulado por
--     set_config('request.jwt.claims'): testa os TRIGGERS;
--   * com pg_temp.como(role, email): troca a role da transação para
--     authenticated / anon / service_role com o JWT daquele e-mail — testa a
--     RLS e os GRANTs DE VERDADE.
--
-- Cobre (plano docs/superpowers/plans/2026-11-03-obras-material-antecipado.md, Task 1):
--   resposta "não precisa" — autoria forçada, duplicada recusada, sem update,
--     sem acesso não lê nem grava — 1–10;
--   obras_compras_prazos — valor vigente, sem acesso vazio — 11–15;
--   obras_restricao_compras — solicitação ligada com e sem pedido, id órfão,
--     outra obra, ambiente teste, sem acesso vazio — 16–24;
--   trava em obras_restricao (apagar / trocar tipo com compra ativa) — 25–34.
--
-- Fixture (só dentro da transação):
--   obras A TESTE-VERIF-MATERIAL-A e B TESTE-VERIF-MATERIAL-B;
--   hub_system_access slug obras para usuario.obras@teste.invalid
--     (sem.acesso@teste.invalid não tem linha);
--   restrições (todas tipo material, criadas por usuario.obras):
--     R1 (A, atividade 6)  <- S1 #999000301 em_cotacao, sem pedido
--                          <- S2 #999000302 pedido_emitido, pedidos 1 e 2 (produção) e 3 (teste)
--                          <- S8 #999000308 em_cotacao, ambiente TESTE
--     R2 (A, atividade 7)  <- S3 #999000303 cancelada, S4 #999000304 recusada
--     R3 (A, atividade 8)  <- S5 #999000305 concluida
--     R4 (A, atividade 9)  sem solicitação
--     RO (A, atividade 10) <- S6 #999000306 cancelada; RO é APAGADA na fixture
--                             (S6 fica com id órfão)
--     RB (B, atividade 6)  <- S7 #999000307 aguardando_cotacao
--   cmp_configuracoes: uma linha nova de 'prazos' (o carimbo do Compras põe
--     vigente_desde = now(), a maior de todas).
-- ============================================================

begin;

-- 0. Compras 017 e a migration têm de estar aplicados.
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'cmp_solicitacoes'
                    and column_name = 'obras_restricao_id') then
    raise exception 'Pré-requisito ausente: Compras 017 (cmp_solicitacoes.obras_restricao_id) não está aplicado.';
  end if;
  if to_regclass('public.obras_material_resposta') is null
     or to_regprocedure('public.obras_compras_prazos()') is null
     or to_regprocedure('public.obras_restricao_compras(uuid)') is null
     or to_regprocedure('public.obras_restricao_compra_ativa_guarda()') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-material.sql não está aplicado.';
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
                    case when p_email is null then json_build_object('role', p_role)::text
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

-- Linhas de obras_restricao_compras(obra) como "numero:sequencia" (role corrente),
-- terminadas em '.' (o strpos do relatório não aceita linha a mais).
create function pg_temp.compras(p_obra uuid) returns text language sql as $$
  select coalesce(string_agg(solicitacao_numero || ':' || coalesce(pedido_sequencia::text, '-'), ','
                             order by solicitacao_numero, pedido_sequencia), '(vazio)') || '.'
    from public.obras_restricao_compras(p_obra);
$$;

select pg_temp.jwt(null);

insert into public.obras_obra (id, os, modalidade)
values ('00000000-0000-4000-8000-00000000b301', 'TESTE-VERIF-MATERIAL-A', 'obra'),
       ('00000000-0000-4000-8000-00000000b302', 'TESTE-VERIF-MATERIAL-B', 'obra');

insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
values ('usuario.obras@teste.invalid', 'obras', true, 'verificacao-material');

-- Restrições criadas pelo usuário (autor = usuario.obras: a guarda de autoria
-- da Leva 3 deixa ele apagar; só a trava nova pode recusar).
select pg_temp.jwt('usuario.obras@teste.invalid');
insert into public.obras_restricao (id, obra_id, atividade_numero, tipo, descricao, responsavel)
values ('00000000-0000-4000-8000-00000000b311', '00000000-0000-4000-8000-00000000b301', 6,  'material', 'Porcelanato 60x60', 'manfac'),
       ('00000000-0000-4000-8000-00000000b312', '00000000-0000-4000-8000-00000000b301', 7,  'material', 'Drywall', 'manfac'),
       ('00000000-0000-4000-8000-00000000b313', '00000000-0000-4000-8000-00000000b301', 8,  'material', 'Luminárias', 'manfac'),
       ('00000000-0000-4000-8000-00000000b314', '00000000-0000-4000-8000-00000000b301', 9,  'material', 'Tinta', 'manfac'),
       ('00000000-0000-4000-8000-00000000b315', '00000000-0000-4000-8000-00000000b301', 10, 'material', 'Será apagada', 'manfac'),
       ('00000000-0000-4000-8000-00000000b316', '00000000-0000-4000-8000-00000000b302', 6,  'material', 'Cimento obra B', 'manfac');
select pg_temp.jwt(null);

-- Compras: solicitações ligadas pela origem (formato aceito em produção).
insert into public.cmp_solicitacoes
  (id, ambiente, numero, etapa, tipo, solicitante_email, solicitante_nome, cc_codigo, cc_descricao,
   obra_id, obra_os, motivo, prazo_necessario, recebimento, urgente, enviado_em, dia_referencia, data_minima,
   obras_restricao_id)
select x.id, x.amb, x.numero, x.etapa, 'material', 'solicitante@teste.invalid', 'Solicitante Teste',
       '10159908939', 'DPSP - OBRAS', x.obra, x.os, 'Material antecipado para teste da obra',
       current_date + 10, 'base', false, now(), current_date, current_date + 3, x.restricao
  from (values
    ('00000000-0000-4000-8000-00000000b321'::uuid, 'producao', 999000301::bigint, 'em_cotacao',
     '00000000-0000-4000-8000-00000000b301'::uuid, 'TESTE-VERIF-MATERIAL-A', '00000000-0000-4000-8000-00000000b311'::uuid),
    ('00000000-0000-4000-8000-00000000b322', 'producao', 999000302, 'pedido_emitido',
     '00000000-0000-4000-8000-00000000b301', 'TESTE-VERIF-MATERIAL-A', '00000000-0000-4000-8000-00000000b311'),
    ('00000000-0000-4000-8000-00000000b323', 'producao', 999000303, 'cancelada',
     '00000000-0000-4000-8000-00000000b301', 'TESTE-VERIF-MATERIAL-A', '00000000-0000-4000-8000-00000000b312'),
    ('00000000-0000-4000-8000-00000000b324', 'producao', 999000304, 'recusada',
     '00000000-0000-4000-8000-00000000b301', 'TESTE-VERIF-MATERIAL-A', '00000000-0000-4000-8000-00000000b312'),
    ('00000000-0000-4000-8000-00000000b325', 'producao', 999000305, 'concluida',
     '00000000-0000-4000-8000-00000000b301', 'TESTE-VERIF-MATERIAL-A', '00000000-0000-4000-8000-00000000b313'),
    ('00000000-0000-4000-8000-00000000b326', 'producao', 999000306, 'cancelada',
     '00000000-0000-4000-8000-00000000b301', 'TESTE-VERIF-MATERIAL-A', '00000000-0000-4000-8000-00000000b315'),
    ('00000000-0000-4000-8000-00000000b327', 'producao', 999000307, 'aguardando_cotacao',
     '00000000-0000-4000-8000-00000000b302', 'TESTE-VERIF-MATERIAL-B', '00000000-0000-4000-8000-00000000b316'),
    ('00000000-0000-4000-8000-00000000b328', 'teste', 999000308, 'em_cotacao',
     '00000000-0000-4000-8000-00000000b301', 'TESTE-VERIF-MATERIAL-A', '00000000-0000-4000-8000-00000000b311')
  ) as x(id, amb, numero, etapa, obra, os, restricao);

-- Pedidos da S2: sequência 1 e 2 em produção, 3 em teste (não pode aparecer).
insert into public.cmp_mapas (id, solicitacao_id, rodada, situacao, criado_por)
values ('00000000-0000-4000-8000-00000000b331', '00000000-0000-4000-8000-00000000b322', 1, 'aprovado', 'comprador@teste.invalid');
insert into public.cmp_mapa_fornecedores (id, mapa_id, ordem, razao_social, frete_tipo)
values ('00000000-0000-4000-8000-00000000b341', '00000000-0000-4000-8000-00000000b331', 1, 'Fornecedor Material Um', 'incluso'),
       ('00000000-0000-4000-8000-00000000b342', '00000000-0000-4000-8000-00000000b331', 2, 'Fornecedor Material Dois', 'incluso');
insert into public.cmp_pedidos
  (id, solicitacao_id, ambiente, sequencia, mapa_fornecedor_id, codigo_integracao, pagamento, condicao_codigo,
   total_centavos, situacao, etapa_atual, previsao_entrega, entrega_situacao)
values ('00000000-0000-4000-8000-00000000b351', '00000000-0000-4000-8000-00000000b322', 'producao', 1,
        '00000000-0000-4000-8000-00000000b341', 'TVM-P1', 'faturado', '000', 123456, 'emitido', 'pedido',
        current_date + 5, 'pendente'),
       ('00000000-0000-4000-8000-00000000b352', '00000000-0000-4000-8000-00000000b322', 'producao', 2,
        '00000000-0000-4000-8000-00000000b342', 'TVM-P2', 'faturado', '000', 654321, 'emitido', 'pedido',
        current_date + 9, null),
       ('00000000-0000-4000-8000-00000000b353', '00000000-0000-4000-8000-00000000b322', 'teste', 3,
        '00000000-0000-4000-8000-00000000b342', 'TVM-P3', 'faturado', '000', 111, 'emitido', 'pedido',
        current_date + 1, null);

-- RO só tem solicitação cancelada: apagar passa (deixa S6 com id órfão).
delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b315';

-- Configuração do Compras: valor novo de 'prazos' (vira o vigente).
insert into public.cmp_configuracoes (chave, valor)
values ('prazos', '{"verificacao":"material-antecipado"}');

-- ============================================================
-- obras_material_resposta ("não precisa")
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_material_resposta (obra_id, atividade_numero, criado_por, criado_em)
  values ('00000000-0000-4000-8000-00000000b301', 6, 'forjado@teste.invalid', '2020-01-01');
  raise exception 'ok:%', (select criado_por || '|' || pg_temp.tf(criado_em = now())
                             from public.obras_material_resposta
                            where obra_id = '00000000-0000-4000-8000-00000000b301' and atividade_numero = 6);
exception when others then
  perform pg_temp.reg(1, 'resposta: autoria forçada (criado_por = JWT, criado_em = now(); forjados ignorados)',
                      'ok:usuario.obras@teste.invalid|t', sqlerrm);
end $$;

-- Resposta da atividade 7 fica gravada (base dos testes seguintes).
select pg_temp.jwt('usuario.obras@teste.invalid');
insert into public.obras_material_resposta (obra_id, atividade_numero)
values ('00000000-0000-4000-8000-00000000b301', 7);
select pg_temp.jwt(null);

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_material_resposta (obra_id, atividade_numero)
  values ('00000000-0000-4000-8000-00000000b301', 7);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(2, 'resposta duplicada (mesma obra e atividade) recusada',
                      'obras_material_resposta_obra_id_atividade_numero_key', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  insert into public.obras_material_resposta (obra_id, atividade_numero)
  values ('00000000-0000-4000-8000-00000000b301', 0);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(3, 'atividade_numero 0 recusado', 'obras_material_resposta_atividade_numero_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  insert into public.obras_material_resposta (obra_id, atividade_numero)
  values ('00000000-0000-4000-8000-00000000b301', 8);
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(4, 'sem acesso Obras não grava resposta (RLS)', 'row-level security', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_material_resposta);
exception when others then
  perform pg_temp.reg(5, 'sem acesso Obras não lê resposta', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_material_resposta
                            where obra_id = '00000000-0000-4000-8000-00000000b301');
exception when others then
  perform pg_temp.reg(6, 'com acesso Obras lê a resposta da obra', 'ok:1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_material_resposta set atividade_numero = 70
   where obra_id = '00000000-0000-4000-8000-00000000b301';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(7, 'resposta não se edita (sem UPDATE para authenticated)', 'permission denied', sqlerrm);
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  delete from public.obras_material_resposta
   where obra_id = '00000000-0000-4000-8000-00000000b301' and atividade_numero = 7;
  get diagnostics v_n = row_count;
  raise exception 'ok:%', v_n;
exception when others then
  perform pg_temp.reg(8, 'com acesso Obras desfaz o "não precisa" (DELETE)', 'ok:1', sqlerrm);
end $$;

do $$
declare v_n int;
begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  delete from public.obras_material_resposta
   where obra_id = '00000000-0000-4000-8000-00000000b301';
  get diagnostics v_n = row_count;
  raise exception 'ok:%', v_n;
exception when others then
  perform pg_temp.reg(9, 'sem acesso Obras não apaga resposta (0 linhas)', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform count(*) from public.obras_material_resposta;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(10, 'anon não lê resposta', 'permission denied', sqlerrm);
end $$;

-- ============================================================
-- obras_compras_prazos()
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%|%', (select count(*) from public.obras_compras_prazos()),
                            (select prazos ->> 'verificacao' from public.obras_compras_prazos());
exception when others then
  perform pg_temp.reg(11, 'prazos com acesso: uma linha com o valor vigente (maior vigente_desde)',
                      'ok:1|material-antecipado', sqlerrm);
end $$;

do $$
declare v_esperado jsonb;
begin
  -- lido como postgres, antes da troca de role (authenticated não lê cmp_configuracoes)
  select valor into v_esperado from public.cmp_configuracoes where chave = 'expediente'
   order by vigente_desde desc limit 1;
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', pg_temp.tf((select expediente from public.obras_compras_prazos())
                                     is not distinct from v_esperado);
exception when others then
  perform pg_temp.reg(12, 'expediente = valor vigente da chave (NULL quando não há linha)', 'ok:t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_compras_prazos());
exception when others then
  perform pg_temp.reg(13, 'prazos sem acesso Obras: zero linhas', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('service_role', null);
  raise exception 'ok:%', (select count(*) from public.obras_compras_prazos());
exception when others then
  perform pg_temp.reg(14, 'prazos sem e-mail (service role): zero linhas', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_compras_prazos();
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(15, 'anon não executa obras_compras_prazos', 'permission denied', sqlerrm);
end $$;

-- ============================================================
-- obras_restricao_compras(p_obra)
-- ============================================================
do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', pg_temp.compras('00000000-0000-4000-8000-00000000b301');
exception when others then
  perform pg_temp.reg(16, 'obra A: S1 sem pedido, S2 com pedidos 1 e 2, S3–S5; sem órfã (S6), sem teste (S8, pedido 3), sem obra B (S7)',
                      'ok:999000301:-,999000302:1,999000302:2,999000303:-,999000304:-,999000305:-.', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select concat_ws('|', pg_temp.tf(restricao_id = '00000000-0000-4000-8000-00000000b311'),
                                            etapa, fornecedor_razao_social, pedido_situacao,
                                            pg_temp.tf(previsao_entrega = current_date + 5), entrega_situacao,
                                            pg_temp.tf(data_minima = current_date + 3),
                                            pg_temp.tf(prazo_necessario = current_date + 10),
                                            pg_temp.tf(enviado_em is not null), pg_temp.tf(entrega_em is null))
                             from public.obras_restricao_compras('00000000-0000-4000-8000-00000000b301')
                            where solicitacao_numero = 999000302 and pedido_sequencia = 1);
exception when others then
  perform pg_temp.reg(17, 'colunas da S2 / pedido 1 (restrição, etapa, fornecedor, situação, previsão, entrega, datas)',
                      'ok:t|pedido_emitido|Fornecedor Material Um|emitido|t|pendente|t|t|t|t', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%|%', (select concat_ws('|', pg_temp.tf(restricao_id = '00000000-0000-4000-8000-00000000b311'),
                                              etapa, pg_temp.tf(pedido_id is null),
                                              coalesce(fornecedor_razao_social, '-'))
                               from public.obras_restricao_compras('00000000-0000-4000-8000-00000000b301')
                              where solicitacao_numero = 999000301),
                            (select count(*) from public.obras_restricao_compras('00000000-0000-4000-8000-00000000b301')
                              where solicitacao_id = '00000000-0000-4000-8000-00000000b321');
exception when others then
  perform pg_temp.reg(18, 'S1 sem pedido: uma linha, pedido e fornecedor nulos', 'ok:t|em_cotacao|t|-|1', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', pg_temp.compras('00000000-0000-4000-8000-00000000b302');
exception when others then
  perform pg_temp.reg(19, 'obra B: só a S7 da restrição da obra B', 'ok:999000307:-.', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', (select count(*) from public.obras_restricao_compras('00000000-0000-4000-8000-00000000b301')
                            where solicitacao_id = '00000000-0000-4000-8000-00000000b326')
                        + (select count(*) from public.obras_restricao_compras('00000000-0000-4000-8000-00000000b302')
                            where solicitacao_id = '00000000-0000-4000-8000-00000000b326');
exception when others then
  perform pg_temp.reg(20, 'id órfão (S6, restrição apagada) não aparece em nenhuma obra', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'sem.acesso@teste.invalid');
  raise exception 'ok:%', pg_temp.compras('00000000-0000-4000-8000-00000000b301');
exception when others then
  perform pg_temp.reg(21, 'sem acesso Obras: zero linhas', 'ok:(vazio).', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('service_role', null);
  raise exception 'ok:%', pg_temp.compras('00000000-0000-4000-8000-00000000b301');
exception when others then
  perform pg_temp.reg(22, 'service_role lê (mesmo acesso de obras_restricao_pedidos)',
                      'ok:999000301:-,999000302:1,999000302:2,999000303:-,999000304:-,999000305:-.', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('anon', null);
  perform * from public.obras_restricao_compras('00000000-0000-4000-8000-00000000b301');
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(23, 'anon não executa obras_restricao_compras', 'permission denied', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  raise exception 'ok:%', pg_temp.compras(null);
exception when others then
  perform pg_temp.reg(24, 'p_obra NULL: zero linhas', 'ok:(vazio).', sqlerrm);
end $$;

-- ============================================================
-- Trava em obras_restricao (compra ativa)
-- ============================================================
do $$ begin
  perform pg_temp.jwt('usuario.obras@teste.invalid');
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b311';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(25, 'apagar R1 (S1 em cotação): recusado, P0001, número da mais recente de produção',
                      'P0001|OBRAS_MATERIAL: Esta restrição tem a solicitação #999000302 no Compras. Cancele lá antes.',
                      sqlstate || '|' || sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b311';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(26, 'apagar R1 como authenticated (sem grant em cmp_*): mesma recusa',
                      'P0001|OBRAS_MATERIAL: Esta restrição tem a solicitação #999000302 no Compras. Cancele lá antes.',
                      sqlstate || '|' || sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_restricao set tipo = 'acesso' where id = '00000000-0000-4000-8000-00000000b311';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(27, 'trocar tipo de R1: recusado',
                      'P0001|OBRAS_MATERIAL: Esta restrição tem a solicitação #999000302 no Compras. Cancele lá antes.',
                      sqlstate || '|' || sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_restricao set descricao = 'Porcelanato 60x60 retificado', situacao = 'em_tratativa'
   where id = '00000000-0000-4000-8000-00000000b311';
  raise exception 'ok:%', (select descricao from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b311');
exception when others then
  perform pg_temp.reg(28, 'editar descrição/situação de R1 (tipo igual): passa', 'ok:Porcelanato 60x60 retificado', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_restricao set tipo = 'material', prazo = current_date + 1
   where id = '00000000-0000-4000-8000-00000000b311';
  raise exception 'ok:%', (select tipo from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b311');
exception when others then
  perform pg_temp.reg(29, 'UPDATE que regrava o mesmo tipo em R1: passa', 'ok:material', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b313';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(30, 'apagar R3 (só solicitação concluída): recusado com o número',
                      'P0001|OBRAS_MATERIAL: Esta restrição tem a solicitação #999000305 no Compras. Cancele lá antes.',
                      sqlstate || '|' || sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  update public.obras_restricao set tipo = 'acesso' where id = '00000000-0000-4000-8000-00000000b312';
  raise exception 'ok:%', (select tipo from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b312');
exception when others then
  perform pg_temp.reg(31, 'trocar tipo de R2 (só cancelada e recusada): passa', 'ok:acesso', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b312';
  raise exception 'ok:%', (select count(*) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b312');
exception when others then
  perform pg_temp.reg(32, 'apagar R2 (só cancelada e recusada) como authenticated: apaga', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.como('authenticated', 'usuario.obras@teste.invalid');
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b314';
  raise exception 'ok:%', (select count(*) from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b314');
exception when others then
  perform pg_temp.reg(33, 'apagar R4 (sem solicitação): apaga', 'ok:0', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  delete from public.obras_restricao where id = '00000000-0000-4000-8000-00000000b316';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(34, 'sem JWT (service role / SQL) apagar RB (S7 aguardando cotação): recusado também',
                      'P0001|OBRAS_MATERIAL: Esta restrição tem a solicitação #999000307 no Compras. Cancele lá antes.',
                      sqlstate || '|' || sqlerrm);
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
  if v_total <> 34 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 34 testes rodaram';
  end if;
  raise exception 'RESUMO: %/34 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
