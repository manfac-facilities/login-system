-- ============================================================
-- Teste de comportamento de sdd-sql-obras-leva1b.sql
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
-- e cada teste que tem de PASSAR termina com raise exception 'OK_SEM_ERRO'
-- (desfaz o que ele fez). Booleanos aparecem como t/f no texto.
-- Roda como postgres (acima da RLS): testa os TRIGGERS e o backfill.
--
-- Fixture (só dentro da transação): obra TESTE-VERIF-LEVA1B, versão 1
-- rascunho com 5 atividades em 3 etapas (B, A, B, null, A) e um RDO rascunho.
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
values ('00000000-0000-4000-8000-00000000a004', 'TESTE-VERIF-LEVA1B', 'obra',
        'eng.teste@teste.invalid', null, null);

insert into public.obras_cronograma_versao (id, obra_id, numero, criada_por)
values ('00000000-0000-4000-8000-00000000b004', '00000000-0000-4000-8000-00000000a004', 1, 'teste');

insert into public.obras_atividade (versao_id, obra_id, numero, etapa, descricao, duracao)
select '00000000-0000-4000-8000-00000000b004', '00000000-0000-4000-8000-00000000a004', x.numero, x.etapa, 'atividade', 1
  from (values (1, 'B'), (2, 'A'), (3, 'B'), (4, null), (5, 'A')) as x(numero, etapa);

insert into public.obras_rdo (id, obra_id, data)
values ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-00000000a004', date '2026-10-31');

-- ============================================================
-- Estrutura e defaults
-- ============================================================
select pg_temp.reg(1, 'colunas ordem/etapa_ordem nascem nulas em INSERT novo', '5',
  (select count(*)::text from public.obras_atividade
    where versao_id = '00000000-0000-4000-8000-00000000b004' and ordem is null and etapa_ordem is null));

select pg_temp.reg(2, 'sem_impedimento nasce false', 'f',
  (select sem_impedimento::text from public.obras_rdo where id = '00000000-0000-4000-8000-00000000c004'));

-- ============================================================
-- Backfill (mesmo SQL da migration, sobre a fixture), com o trigger
-- desabilitado só durante o UPDATE e religado depois.
-- ============================================================
alter table public.obras_atividade disable trigger obras_atividade_imutavel;
update public.obras_atividade a set ordem = a.numero where a.ordem is null;
update public.obras_atividade a
   set etapa_ordem = e.pos
  from (
    select versao_id, coalesce(etapa, '') as etapa,
           dense_rank() over (partition by versao_id order by min(numero)) as pos
      from public.obras_atividade
     group by versao_id, coalesce(etapa, '')
  ) e
 where e.versao_id = a.versao_id
   and e.etapa = coalesce(a.etapa, '')
   and a.etapa_ordem is null;
alter table public.obras_atividade enable trigger obras_atividade_imutavel;

select pg_temp.reg(3, 'backfill: ordem = numero', 'f',
  (select (count(*) > 0)::text from public.obras_atividade
    where versao_id = '00000000-0000-4000-8000-00000000b004' and ordem is distinct from numero));

select pg_temp.reg(4, 'backfill: etapa_ordem por primeira aparição (B=1, A=2, nula=3)', '1,2,1,3,2',
  (select string_agg(etapa_ordem::text, ',' order by numero) from public.obras_atividade
    where versao_id = '00000000-0000-4000-8000-00000000b004'));

select pg_temp.reg(5, 'trigger obras_atividade_imutavel ligado depois do backfill', '1',
  (select count(*)::text from pg_trigger where tgname = 'obras_atividade_imutavel'
     and tgrelid = 'public.obras_atividade'::regclass and not tgisinternal and tgenabled = 'O'));

-- ============================================================
-- Versão salva continua imutável (inclusive para ordem/etapa_ordem)
-- ============================================================
do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_atividade set ordem = 99
   where versao_id = '00000000-0000-4000-8000-00000000b004' and numero = 1;
  raise exception 'OK_SEM_ERRO';
exception when others then
  perform pg_temp.reg(6, 'versão rascunho: reordenar (ordem) passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_cronograma_versao set salva_em = now(), salva_por = 'teste'
   where id = '00000000-0000-4000-8000-00000000b004';
  update public.obras_atividade set etapa_ordem = 9
   where versao_id = '00000000-0000-4000-8000-00000000b004' and numero = 1;
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(7, 'versão salva: alterar etapa_ordem bloqueado', 'OBRAS_VERSAO_SALVA', sqlerrm);
end $$;

-- ============================================================
-- RDO: sem_impedimento e máquina de estados
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_rdo set sem_impedimento = true
   where id = '00000000-0000-4000-8000-00000000c004';
  raise exception 'OK_SEM_ERRO';
exception when others then
  perform pg_temp.reg(8, 'RDO rascunho: engenheiro marca sem_impedimento -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo set sem_impedimento = true where id = '00000000-0000-4000-8000-00000000c004';
  update public.obras_rdo set estado = 'validado' where id = '00000000-0000-4000-8000-00000000c004';
  update public.obras_rdo set sem_impedimento = false where id = '00000000-0000-4000-8000-00000000c004';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(9, 'RDO validado: sem_impedimento imutável', 'OBRAS_RDO_ESTADO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo set estado = 'validado' where id = '00000000-0000-4000-8000-00000000c004';
  update public.obras_rdo set estado = 'enviado' where id = '00000000-0000-4000-8000-00000000c004';
  update public.obras_rdo set sem_impedimento = true where id = '00000000-0000-4000-8000-00000000c004';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(10, 'RDO enviado: sem_impedimento imutável', 'OBRAS_RDO_ESTADO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_rdo set sem_impedimento = null where id = '00000000-0000-4000-8000-00000000c004';
  raise exception 'NAO_FALHOU';
exception when others then
  perform pg_temp.reg(11, 'sem_impedimento nulo -> not null', 'not-null', sqlerrm);
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
         string_agg(n::text || ' (' || coalesce(obtido, 'NULL') || ')', '; ' order by n)
           filter (where obtido is null or obtido not like '%' || esperado || '%')
    into v_total, v_ok, v_falhas
    from _v;
  if v_total <> 11 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 11 testes rodaram';
  end if;
  raise exception 'RESUMO: %/11 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
