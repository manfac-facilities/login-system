-- ============================================================
-- Teste de comportamento de sdd-sql-obras-modalidade-obra-2.sql (C1, I1, I2)
-- Rodar DEPOIS de aplicar a migration, no SQL Editor, projeto iyytcavcgukfjnjjrerx.
-- NÃO GRAVA NADA: tudo roda numa transação e o bloco final termina em erro
-- de propósito (desfaz tudo). A mensagem de erro final é o relatório:
--   "RESUMO: N/N OK"            -> tudo certo
--   "RESUMO: x/N OK — FALHOU: ..." -> parar e não deployar
-- Sem a linha "RESUMO" = algo quebrou antes (erro diferente do esperado).
--
-- Cada teste de erro esperado roda num bloco
--   do $$ begin ...; raise exception 'NAO_FALHOU';
--   exception when others then raise notice 'resultado: %', sqlerrm; end $$;
-- e cada teste que tem de PASSAR termina com raise exception 'OK_SEM_ERRO'
-- (desfaz o que ele fez). Assim o arquivo roda inteiro e cada bloco começa do
-- mesmo estado.
--
-- Roda como postgres (acima da RLS): testa os TRIGGERS e as funções; a sessão
-- de usuário é simulada só pelo JWT (request.jwt.claims). As policies de
-- storage são conferidas por leitura na verificação da própria migration.
--
-- Fixture (só dentro da transação): obra TESTE-VERIF-MOD-2, modalidade obra,
-- engenheiro eng.teste@teste.invalid, sem data-base, atividade-trava 1;
-- versão 1 rascunho com as atividades 1 (trava) e 2 (bloqueia_por_trava);
-- execução das duas em nao_iniciado.
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

-- ---------- fixture (sem JWT: caminho service role/seed) ----------
select pg_temp.jwt(null);

insert into public.obras_obra (id, os, modalidade, engenheiro_email, data_base, atividade_trava)
values ('00000000-0000-4000-8000-00000000a002', 'TESTE-VERIF-MOD-2', 'obra',
        'eng.teste@teste.invalid', null, 1);

insert into public.obras_cronograma_versao (id, obra_id, numero, criada_por)
values ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a002', 1, 'teste');

insert into public.obras_atividade (versao_id, obra_id, numero, descricao, duracao, bloqueia_por_trava)
values ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a002', 1, 'trava', 1, false),
       ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a002', 2, 'travada', 1, true);

insert into public.obras_atividade_exec (obra_id, numero, status)
values ('00000000-0000-4000-8000-00000000a002', 1, 'nao_iniciado'),
       ('00000000-0000-4000-8000-00000000a002', 2, 'nao_iniciado');

-- ============================================================
-- I2 — quem pode (usuário que não é engenheiro nem admin)
-- ============================================================
do $$ begin
  perform pg_temp.jwt('outro@teste.invalid');
  insert into public.obras_cronograma_versao (obra_id, numero, criada_por)
  values ('00000000-0000-4000-8000-00000000a002', 2, 'x');
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(1, 'outro usuário cria versão -> barrado', 'OBRAS_CRONOGRAMA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro@teste.invalid');
  update public.obras_cronograma_versao set motivo = 'x'
   where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(2, 'outro usuário altera versão -> barrado', 'OBRAS_CRONOGRAMA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro@teste.invalid');
  insert into public.obras_atividade (versao_id, obra_id, numero, descricao, duracao)
  values ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a002', 3, 'x', 1);
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(3, 'outro usuário cria atividade -> barrado', 'OBRAS_CRONOGRAMA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro@teste.invalid');
  update public.obras_atividade set duracao = 5
   where versao_id = '00000000-0000-4000-8000-00000000b001' and numero = 1;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(4, 'outro usuário altera atividade -> barrado', 'OBRAS_CRONOGRAMA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro@teste.invalid');
  delete from public.obras_atividade
   where versao_id = '00000000-0000-4000-8000-00000000b001' and numero = 2;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(5, 'outro usuário apaga atividade -> barrado', 'OBRAS_CRONOGRAMA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro@teste.invalid');
  update public.obras_atividade_exec set percentual = 0.1
   where obra_id = '00000000-0000-4000-8000-00000000a002' and numero = 1;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(6, 'outro usuário atualiza execução -> barrado', 'OBRAS_EXECUCAO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('outro@teste.invalid');
  insert into public.obras_atividade_exec (obra_id, numero, status)
  values ('00000000-0000-4000-8000-00000000a002', 3, 'nao_iniciado');
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(7, 'outro usuário insere execução -> barrado', 'OBRAS_EXECUCAO', sqlerrm);
end $$;

-- ============================================================
-- I2 — regras da versão (engenheiro da obra)
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_cronograma_versao (obra_id, numero, criada_por, salva_em)
  values ('00000000-0000-4000-8000-00000000a002', 2, 'x', now());
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(8, 'versão nova já salva -> barrada', 'nasce como rascunho', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_cronograma_versao (obra_id, numero, criada_por)
  values ('00000000-0000-4000-8000-00000000a002', 99, 'x');
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(9, 'versão nova com numero fora de max+1 -> barrada', 'tem de ser a v2', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_cronograma_versao set salva_em = now()
   where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(10, 'salvar a v1 sem data-base -> barrado', 'data-base', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_cronograma_versao (id, obra_id, numero, criada_por)
  values ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a002', 2, 'x');
  update public.obras_cronograma_versao set salva_em = now(), motivo = 'teste'
   where id = '00000000-0000-4000-8000-00000000b002';
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(11, 'salvar versão sem atividades -> barrado', 'sem atividades', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_cronograma_versao (obra_id, numero, criada_por)
  values ('00000000-0000-4000-8000-00000000a002', 2, 'x');
  update public.obras_atividade set descricao = 'trava (editada)'
   where versao_id = '00000000-0000-4000-8000-00000000b001' and numero = 1;
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(12, 'engenheiro cria v2 rascunho e edita atividade -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_obra set data_base = date '2026-10-26'
   where id = '00000000-0000-4000-8000-00000000a002';
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_cronograma_versao set salva_em = now()
   where id = '00000000-0000-4000-8000-00000000b001';
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(13, 'engenheiro salva a v1 com data-base e atividades -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$
declare v_admin text := (select user_email from public.hub_user_roles where nivel = 'administrador' limit 1);
begin
  if v_admin is null then
    raise exception 'OK_SEM_ERRO (nenhum administrador cadastrado: teste não exercitado)';
  end if;
  perform pg_temp.jwt(v_admin);
  update public.obras_atividade set duracao = 2
   where versao_id = '00000000-0000-4000-8000-00000000b001' and numero = 1;
  update public.obras_atividade_exec set status = 'em_andamento', percentual = 0.5
   where obra_id = '00000000-0000-4000-8000-00000000a002' and numero = 1;
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(14, 'administrador altera atividade e execução -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt(null);
  insert into public.obras_cronograma_versao (obra_id, numero, criada_por, salva_em, salva_por)
  values ('00000000-0000-4000-8000-00000000a002', 7, 'seed', now(), 'seed');
  update public.obras_atividade_exec set status = 'em_andamento', percentual = 0.3
   where obra_id = '00000000-0000-4000-8000-00000000a002' and numero = 2;
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(15, 'sem JWT (service role/seed): versão salva e trava ignoradas -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

-- ============================================================
-- I2 — atividade-trava na execução (engenheiro da obra)
-- ============================================================
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_atividade_exec set status = 'em_andamento'
   where obra_id = '00000000-0000-4000-8000-00000000a002' and numero = 2;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(16, 'atividade travada para em_andamento com trava aberta -> barrado', 'OBRAS_TRAVA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_atividade_exec set percentual = 0.2
   where obra_id = '00000000-0000-4000-8000-00000000a002' and numero = 2;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(17, 'atividade travada com percentual > 0 e trava aberta -> barrado', 'OBRAS_TRAVA', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_atividade_exec (obra_id, numero, status, percentual)
  values ('00000000-0000-4000-8000-00000000a002', 2, 'concluido', 1)
  on conflict (obra_id, numero) do update set status = excluded.status, percentual = excluded.percentual;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(18, 'upsert concluindo a travada com trava aberta -> barrado', 'OBRAS_TRAVA', sqlerrm);
end $$;

-- A trava concluída no MESMO upsert (linha da travada antes da trava) libera.
do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  insert into public.obras_atividade_exec (obra_id, numero, status, percentual, inicio_real, fim_real)
  values ('00000000-0000-4000-8000-00000000a002', 2, 'em_andamento', 0.4, date '2026-10-29', null),
         ('00000000-0000-4000-8000-00000000a002', 1, 'concluido', 1, date '2026-10-29', date '2026-10-29')
  on conflict (obra_id, numero) do update
    set status = excluded.status, percentual = excluded.percentual,
        inicio_real = excluded.inicio_real, fim_real = excluded.fim_real;
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(19, 'trava concluída no mesmo upsert libera a travada -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$ begin
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_atividade_exec set status = 'em_andamento', percentual = 0.5
   where obra_id = '00000000-0000-4000-8000-00000000a002' and numero = 1;
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(20, 'a própria trava avança -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

-- A versão vigente (v1 salva, 2 travada) manda, não o rascunho v2 (2 livre).
do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_obra set data_base = date '2026-10-26'
   where id = '00000000-0000-4000-8000-00000000a002';
  update public.obras_cronograma_versao set salva_em = now(), salva_por = 'teste'
   where id = '00000000-0000-4000-8000-00000000b001';
  insert into public.obras_cronograma_versao (id, obra_id, numero, criada_por)
  values ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a002', 2, 'teste');
  insert into public.obras_atividade (versao_id, obra_id, numero, descricao, duracao, bloqueia_por_trava)
  values ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a002', 2, 'livre na v2', 1, false);
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_atividade_exec set status = 'em_andamento'
   where obra_id = '00000000-0000-4000-8000-00000000a002' and numero = 2;
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(21, 'trava lida da versão vigente, não do rascunho -> barrado', 'OBRAS_TRAVA', sqlerrm);
end $$;

-- Já andando antes (ex.: legado): mudar só a data não é "avançar".
do $$ begin
  perform pg_temp.jwt(null);
  update public.obras_atividade_exec set status = 'em_andamento', percentual = 0.3
   where obra_id = '00000000-0000-4000-8000-00000000a002' and numero = 2;
  perform pg_temp.jwt('eng.teste@teste.invalid');
  update public.obras_atividade_exec set inicio_real = date '2026-10-28'
   where obra_id = '00000000-0000-4000-8000-00000000a002' and numero = 2;
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(22, 'atividade já andando: editar só a data -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

-- ============================================================
-- C1 — RPC aceita modalidade; a guarda de parâmetros segue só para admin
-- ============================================================
do $$
declare v_admin text := (select user_email from public.hub_user_roles where nivel = 'administrador' limit 1);
begin
  if v_admin is null then
    raise exception 'OK_SEM_ERRO (nenhum administrador cadastrado: teste não exercitado)';
  end if;
  perform pg_temp.jwt(v_admin);
  perform public.obras_aplicar_alteracao('00000000-0000-4000-8000-00000000a002',
    '{"modalidade":"spot"}'::jsonb,
    '[{"bloco":"Classificação","campo":"modalidade","de":"obra","para":"spot","motivo":null}]'::jsonb);
  if (select modalidade from public.obras_obra where id = '00000000-0000-4000-8000-00000000a002') <> 'spot' then
    raise exception 'modalidade não mudou';
  end if;
  raise exception 'OK_SEM_ERRO';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(23, 'admin muda modalidade pela RPC (com histórico) -> passa', 'OK_SEM_ERRO', sqlerrm);
end $$;

do $$
declare v_user text := (select a.user_email from public.hub_system_access a
                         where a.system_slug = 'obras' and a.has_access
                           and not exists (select 1 from public.hub_user_roles r
                                            where r.user_email = a.user_email and r.nivel = 'administrador')
                         limit 1);
begin
  if v_user is null then
    raise exception 'OBRAS_PARAMETROS (nenhum usuário obras não-admin: teste não exercitado)';
  end if;
  perform pg_temp.jwt(v_user);
  perform public.obras_aplicar_alteracao('00000000-0000-4000-8000-00000000a002',
    '{"modalidade":"spot"}'::jsonb, '[]'::jsonb);
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(24, 'usuário obras não-admin muda modalidade pela RPC -> barrado', 'OBRAS_PARAMETROS', sqlerrm);
end $$;

do $$
declare v_admin text := (select user_email from public.hub_user_roles where nivel = 'administrador' limit 1);
begin
  perform pg_temp.jwt(coalesce(v_admin, 'outro@teste.invalid'));
  perform public.obras_aplicar_alteracao('00000000-0000-4000-8000-00000000a002',
    '{"coluna_que_nao_existe":"x"}'::jsonb, '[]'::jsonb);
  raise exception 'NAO_FALHOU';
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(25, 'RPC continua recusando coluna desconhecida', 'coluna desconhecida', sqlerrm);
end $$;

-- ============================================================
-- I1 — foto do RDO congela com a validação (função usada na policy de delete)
-- ============================================================
do $$
declare v_antes boolean; v_depois boolean; v_fora boolean;
begin
  perform pg_temp.jwt(null);
  insert into public.obras_rdo (id, obra_id, data, estado)
  values ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a002', date '2026-10-29', 'rascunho');
  insert into public.obras_rdo_foto (rdo_id, path)
  values ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-00000000a002/rdo/2026-10-29/teste.jpg');
  v_antes := public.obras_foto_rdo_congelada('00000000-0000-4000-8000-00000000a002/rdo/2026-10-29/teste.jpg');
  update public.obras_rdo set estado = 'validado', validado_por = 'teste'
   where id = '00000000-0000-4000-8000-00000000c001';
  v_depois := public.obras_foto_rdo_congelada('00000000-0000-4000-8000-00000000a002/rdo/2026-10-29/teste.jpg');
  v_fora := public.obras_foto_rdo_congelada('00000000-0000-4000-8000-00000000a002/rdo/2026-10-29/outra.jpg');
  raise exception 'congelada: rascunho=% validado=% sem_linha=%', v_antes, v_depois, v_fora;
exception when others then
  raise notice 'resultado: %', sqlerrm;
  perform pg_temp.reg(26, 'obras_foto_rdo_congelada: false no rascunho, true validado, false sem linha',
                      'congelada: rascunho=false validado=true sem_linha=false', sqlerrm);
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
  if v_total <> 26 then
    v_falhas := coalesce(v_falhas || '; ', '') || 'só ' || v_total || ' de 26 testes rodaram';
  end if;
  raise exception 'RESUMO: %/26 OK%  (rollback: nada foi gravado)', v_ok,
    case when v_falhas is null then '' else ' — FALHOU: ' || v_falhas end;
end $$;

rollback;
