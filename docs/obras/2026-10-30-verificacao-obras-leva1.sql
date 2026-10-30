-- ============================================================
-- Teste de comportamento de sdd-sql-obras-leva1.sql
-- Rodar DEPOIS de aplicar a migration, no SQL Editor, projeto iyytcavcgukfjnjjrerx.
-- NÃO GRAVA NADA: tudo roda numa transação e o bloco final termina em erro
-- de propósito (desfaz tudo). A mensagem de erro final é o relatório:
--   "RESUMO: N/N OK"               -> tudo certo
--   "RESUMO: x/N OK — FALHOU: ..." -> parar e não deployar
-- Sem a linha "RESUMO" = algo quebrou antes (erro diferente do esperado).
--
-- Cada teste de erro esperado roda num bloco
--   do $$ begin ...; raise exception 'NAO_FALHOU';
--   exception when others then raise notice 'resultado: %', sqlerrm; end $$;
-- e cada teste que tem de PASSAR termina com raise exception 'OK_SEM_ERRO'
-- (desfaz o que ele fez). Roda como postgres (acima da RLS): testa os
-- TRIGGERS e CHECKs; a sessão de usuário é simulada pelo JWT
-- (request.jwt.claims). As policies são conferidas na verificação da migration.
--
-- Fixture (só dentro da transação): obra TESTE-VERIF-LEVA1, modalidade obra,
-- engenheiro eng.teste@teste.invalid, versão 1 rascunho com a atividade 1,
-- execução da 1 e um RDO rascunho.
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

select pg_temp.jwt(null);

insert into public.obras_obra (id, os, modalidade, engenheiro_email, data_base, atividade_trava)
values ('00000000-0000-4000-8000-00000000a003', 'TESTE-VERIF-LEVA1', 'obra',
        'eng.teste@teste.invalid', null, null);

insert into public.obras_cronograma_versao (id, obra_id, numero, criada_por)
values ('00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000a003', 1, 'teste');

insert into public.obras_atividade (versao_id, obra_id, numero, descricao, duracao)
values ('00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000a003', 1, 'atividade', 1);

insert into public.obras_atividade_exec (obra_id, numero, status)
values ('00000000-0000-4000-8000-00000000a003', 1, 'nao_iniciado');

insert into public.obras_rdo (id, obra_id, data)
values ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-00000000a003', date '2026-10-30');

-- ============================================================
-- CHECKs
-- ============================================================
do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo set clima_manha = 'neve' where id = '00000000-0000-4000-8000-00000000c003';
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(1, 'clima_manha inválido -> check', 'obras_rdo_clima_manha_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo set clima_tarde = 'neve' where id = '00000000-0000-4000-8000-00000000c003';
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(2, 'clima_tarde inválido -> check', 'obras_rdo_clima_tarde_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_atividade_exec set dias_restantes = -1
   where obra_id = '00000000-0000-4000-8000-00000000a003' and numero = 1;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(3, 'dias_restantes negativo -> check', 'obras_atividade_exec_dias_restantes_check', sqlerrm);
end $$;

-- ============================================================
-- RDO: clima por turno e máquina de estados
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_rdo set clima_manha = 'sol', clima_tarde = 'chuva'
   where id = '00000000-0000-4000-8000-00000000c003';
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(4, 'engenheiro edita clima por turno em RDO rascunho -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo set estado = 'validado' where id = '00000000-0000-4000-8000-00000000c003';
  update public.obras_rdo set clima_manha = 'chuva' where id = '00000000-0000-4000-8000-00000000c003';
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(5, 'RDO validado: clima_manha imutável', 'OBRAS_RDO_ESTADO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo set estado = 'validado' where id = '00000000-0000-4000-8000-00000000c003';
  update public.obras_rdo set clima_tarde = 'sol' where id = '00000000-0000-4000-8000-00000000c003';
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(6, 'RDO validado: clima_tarde imutável', 'OBRAS_RDO_ESTADO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo set estado = 'validado' where id = '00000000-0000-4000-8000-00000000c003';
  update public.obras_rdo set estado = 'enviado' where id = '00000000-0000-4000-8000-00000000c003';
  update public.obras_rdo set clima_manha = 'chuva' where id = '00000000-0000-4000-8000-00000000c003';
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(7, 'RDO enviado: clima_manha imutável', 'OBRAS_RDO_ESTADO', sqlerrm);
end $$;

-- ============================================================
-- Execução: dias_restantes e início fixo passam pelas guardas existentes
-- ============================================================
do $$ begin
  perform pg_temp.jwt('outro@teste.invalid');
  update public.obras_atividade_exec set dias_restantes = 3
   where obra_id = '00000000-0000-4000-8000-00000000a003' and numero = 1;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(8, 'outro usuário grava dias_restantes -> barrado', 'OBRAS_EXECUCAO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_atividade_exec set dias_restantes = 3.5
   where obra_id = '00000000-0000-4000-8000-00000000a003' and numero = 1;
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(9, 'engenheiro grava dias_restantes -> passa (guarda aceita a coluna nova)', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_atividade set inicio_fixo = date '2026-11-03'
   where versao_id = '00000000-0000-4000-8000-00000000b003' and numero = 1;
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(10, 'engenheiro grava inicio_fixo em versão rascunho -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_obra set data_base = date '2026-10-26'
   where id = '00000000-0000-4000-8000-00000000a003';
  update public.obras_cronograma_versao set salva_em = now()
   where id = '00000000-0000-4000-8000-00000000b003';
  update public.obras_atividade set inicio_fixo = date '2026-11-03'
   where versao_id = '00000000-0000-4000-8000-00000000b003' and numero = 1;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(11, 'inicio_fixo em versão salva -> barrado', 'OBRAS_VERSAO_SALVA', sqlerrm);
end $$;

-- ============================================================
-- Histórico de status
-- ============================================================
do $$ begin
  perform pg_temp.jwt('outro@teste.invalid');
  insert into public.obras_atividade_status_hist (obra_id, numero, data_status, percentual, status, origem)
  values ('00000000-0000-4000-8000-00000000a003', 1, date '2026-10-30', 0.5, 'em_andamento', 'status');
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(12, 'outro usuário insere histórico -> barrado', 'OBRAS_HISTORICO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_atividade_status_hist (obra_id, numero, data_status, percentual, status, origem)
  values ('00000000-0000-4000-8000-00000000a003', 1, date '2026-10-30', 0.5, 'em_andamento', 'status');
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(13, 'engenheiro insere histórico -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$
declare v text;
begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_atividade_status_hist (obra_id, numero, data_status, percentual, status, origem, registrado_por)
  values ('00000000-0000-4000-8000-00000000a003', 1, date '2026-10-30', 0.5, 'em_andamento', 'status', 'falsificado@x.invalid')
  returning registrado_por into v;
  raise exception '%', v;
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(14, 'registrado_por vem do JWT, não do payload', 'eng.teste@teste.invalid', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_atividade_status_hist (obra_id, numero, data_status, percentual, status, origem, registrado_por)
  values ('00000000-0000-4000-8000-00000000a003', 1, date '2026-10-30', 0.5, 'em_andamento', 'diario', 'backfill@teste.invalid');
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(15, 'sem JWT (service role/backfill) insere histórico -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_atividade_status_hist (obra_id, numero, data_status, percentual, status, origem)
  values ('00000000-0000-4000-8000-00000000a003', 1, date '2026-10-30', 1.5, 'em_andamento', 'status');
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(16, 'histórico com percentual > 1 -> check', 'obras_atividade_status_hist_percentual_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_atividade_status_hist (obra_id, numero, data_status, status, origem)
  values ('00000000-0000-4000-8000-00000000a003', 1, date '2026-10-30', 'em_andamento', 'xis');
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(17, 'histórico com origem inválida -> check', 'obras_atividade_status_hist_origem_check', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_atividade_status_hist (obra_id, numero, data_status, status, origem)
  values ('00000000-0000-4000-8000-00000000a003', 1, date '2026-10-30', 'pausado', 'status');
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(18, 'histórico com status inválido -> check', 'obras_atividade_status_hist_status_check', sqlerrm);
end $$;

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
         string_agg(n::text || ' (' || obtido || ')', '; ' order by n)
           filter (where obtido not like '%' || esperado || '%')
    into v_total, v_ok, v_falhas
    from _v;
  if v_total <> 18 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 18 testes rodaram';
  end if;
  raise exception 'RESUMO: %/18 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
