-- Controle de Obras: desfaz diário e tarefas abertas na mesma transação.
-- Aplicar antes do deploy que chama obras_desfazer_diario.
begin;

-- 0. Pré-requisitos: falhar antes de criar a função se a v0 não estiver aplicada.
do $$
begin
  if to_regclass('public.obras_diario') is null
     or to_regclass('public.obras_tarefa') is null then
    raise exception 'A migration obras-v0 precisa estar aplicada';
  end if;
end;
$$;

create or replace function public.obras_desfazer_diario(p_obra_id uuid, p_dia date)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.obras_tarefa
  where obra_id = p_obra_id and aberta = p_dia and situacao = 'aberta';

  delete from public.obras_diario
  where obra_id = p_obra_id and data = p_dia;

  if not found then
    raise exception 'Registro do diário não encontrado para desfazer';
  end if;
end;
$$;

revoke all on function public.obras_desfazer_diario(uuid, date) from public, anon;
grant execute on function public.obras_desfazer_diario(uuid, date) to authenticated;

commit;

-- Verificação após o commit: as três linhas devem retornar OK.
select 'função criada' as invariante,
       case when to_regprocedure('public.obras_desfazer_diario(uuid,date)') is not null
            then 'OK' else '*** FALHOU ***' end as resultado
union all
select 'executa com RLS do usuário',
       case when p.prosecdef = false then 'OK' else '*** FALHOU ***' end
from pg_proc p
where p.oid = to_regprocedure('public.obras_desfazer_diario(uuid,date)')
union all
select 'somente authenticated pode executar',
       case when has_function_privilege('authenticated', 'public.obras_desfazer_diario(uuid,date)', 'EXECUTE')
                 and not has_function_privilege('anon', 'public.obras_desfazer_diario(uuid,date)', 'EXECUTE')
            then 'OK' else '*** FALHOU ***' end;
