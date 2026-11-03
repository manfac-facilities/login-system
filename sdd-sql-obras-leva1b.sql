-- ============================================================
-- OBRAS — Leva 1b (ajustes da reunião de validação, 31/10/2026): ordem de
-- exibição das etapas/atividades e "sem impedimento" no diário.
-- Plano: docs/superpowers/plans/2026-10-31-obras-leva1b-ajustes-reuniao.md (Task 1).
--
-- O QUE FAZ
--   1. obras_atividade.ordem int e obras_atividade.etapa_ordem int:
--      posição de EXIBIÇÃO (global dentro da versão; posição da etapa).
--      `numero` NÃO muda nunca (é a identidade ligada à execução/histórico).
--      Backfill em TODAS as versões (só metadado de exibição):
--        ordem = numero;
--        etapa_ordem = posição da etapa pela primeira aparição (menor numero)
--        dentro da versão (etapa nula/vazia conta como uma etapa só).
--      O trigger obras_atividade_imutavel bloqueia UPDATE em versão salva
--      sempre (com ou sem JWT); por isso o backfill o DESABILITA só durante
--      o UPDATE, dentro da transação, e o REABILITA logo em seguida. Se algo
--      falhar no meio, o rollback da transação devolve o trigger ligado.
--      As colunas ficam NULLABLE: código antigo que insere sem elas não quebra
--      (o app cai em numero quando ordem é nula).
--   2. obras_rdo.sem_impedimento boolean not null default false (item 7 do
--      diário). obras_rdo_estado() é recriada com a coluna nos dois row(...)
--      de conteúdo imutável (RDO validado/enviado). Resto do corpo idêntico
--      ao de sdd-sql-obras-leva1.sql seção 2.
--
-- COMO RODAR — em DOIS passos (o SQL Editor só mostra o último resultado):
--   PASSO 1  do `begin;` até o `commit;`;
--   PASSO 2  a consulta de VERIFICAÇÃO no fim — qualquer *** FALHOU *** = parar.
--   Depois, o teste de comportamento (rollback, não grava nada):
--   docs/obras/2026-10-31-verificacao-obras-leva1b.sql.
--
-- IDEMPOTENTE: add column if not exists, create or replace, backfill só onde
-- ordem/etapa_ordem é nula, trigger reabilitado ao fim.
--
-- ARMADILHAS DO .claude/rules/sql.md: sem guarda de autorização nova (nada de
-- NULL aberto); sem trigger compartilhada.
--
-- ROLLBACK (só depois de reverter o app):
--   alter table public.obras_atividade drop column ordem, drop column etapa_ordem;
--   alter table public.obras_rdo drop column sem_impedimento;
--   e recriar obras_rdo_estado a partir de sdd-sql-obras-leva1.sql seção 2.
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos
-- ============================================================
do $$
begin
  if to_regclass('public.obras_atividade') is null
     or to_regclass('public.obras_rdo') is null
     or to_regprocedure('public.obras_rdo_estado()') is null
     or to_regprocedure('public.obras_atividade_imutavel()') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-modalidade-obra.sql e -2 não estão aplicados. Nada foi alterado.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'obras_rdo' and column_name = 'clima_manha') then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-leva1.sql não está aplicado (obras_rdo.clima_manha). Nada foi alterado.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'obras_atividade_imutavel'
                    and tgrelid = 'public.obras_atividade'::regclass and not tgisinternal and tgenabled = 'O') then
    raise exception 'Trigger obras_atividade_imutavel não está ligado antes do backfill. Nada foi alterado.';
  end if;
end $$;

-- ============================================================
-- 1. Colunas novas
-- ============================================================
alter table public.obras_atividade add column if not exists ordem int;
alter table public.obras_atividade add column if not exists etapa_ordem int;
alter table public.obras_rdo add column if not exists sem_impedimento boolean not null default false;

-- ============================================================
-- 2. Backfill de ordem/etapa_ordem (todas as versões, inclusive salvas).
-- Trigger de imutabilidade desligado SÓ aqui e religado na sequência.
-- ============================================================
alter table public.obras_atividade disable trigger obras_atividade_imutavel;

update public.obras_atividade a
   set ordem = a.numero
 where a.ordem is null;

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

-- ============================================================
-- 3. Máquina de estados do RDO: row(...) passa a cobrir sem_impedimento.
-- Corpo igual ao de sdd-sql-obras-leva1.sql seção 2, só com a coluna nova.
-- ============================================================
create or replace function public.obras_rdo_estado() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_eng   text;
begin
  if tg_op = 'INSERT' then
    if v_email is not null and (new.estado is distinct from 'rascunho'
        or new.validado_por is not null or new.validado_em is not null) then
      raise exception 'OBRAS_RDO_ESTADO: RDO novo nasce como rascunho' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.obra_id is distinct from old.obra_id or new.data is distinct from old.data then
    raise exception 'OBRAS_RDO_ESTADO: obra_id e data do RDO são imutáveis' using errcode = 'P0001';
  end if;

  if new.estado is distinct from old.estado
     and not ((old.estado = 'rascunho' and new.estado = 'validado')
           or (old.estado = 'validado' and new.estado = 'enviado')) then
    raise exception 'OBRAS_RDO_ESTADO: transição % -> % não permitida', old.estado, new.estado
      using errcode = 'P0001';
  end if;

  -- Toda mudança de estado (validar e enviar), numa sessão de usuário, é do
  -- engenheiro da obra ou de administrador.
  if v_email is not null and new.estado is distinct from old.estado then
    select o.engenheiro_email into v_eng from public.obras_obra o where o.id = new.obra_id;
    if not (public.obras_is_admin()
            or (v_eng is not null and v_email = lower(trim(v_eng)))) then
      raise exception 'OBRAS_RDO_ESTADO: só o engenheiro da obra ou administrador muda o estado do RDO'
        using errcode = '42501';
    end if;
  end if;

  if old.estado is distinct from 'rascunho' then
    if row(new.id, new.obra_id, new.data, new.sem_execucao, new.motivo_sem_execucao,
           new.efetivo, new.equipe_texto, new.clima, new.clima_manha, new.clima_tarde,
           new.programacao_amanha, new.sem_impedimento, new.registrado_por, new.validado_por, new.validado_em)
       is distinct from
       row(old.id, old.obra_id, old.data, old.sem_execucao, old.motivo_sem_execucao,
           old.efetivo, old.equipe_texto, old.clima, old.clima_manha, old.clima_tarde,
           old.programacao_amanha, old.sem_impedimento, old.registrado_por, old.validado_por, old.validado_em) then
      raise exception 'OBRAS_RDO_ESTADO: RDO % não pode ter o conteúdo alterado', old.estado
        using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- old.estado = 'rascunho'
  if new.estado = 'validado' then
    if v_email is not null then
      new.validado_por := v_email;
    end if;
    new.validado_em := now();
  elsif new.validado_por is distinct from old.validado_por
     or new.validado_em is distinct from old.validado_em then
    raise exception 'OBRAS_RDO_ESTADO: validado_por/validado_em só mudam na validação'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.obras_rdo_estado() from public, anon, authenticated;

drop trigger if exists obras_rdo_estado on public.obras_rdo;
create trigger obras_rdo_estado before insert or update on public.obras_rdo
  for each row execute function public.obras_rdo_estado();

commit;

-- ============================================================
-- VERIFICAÇÃO (PASSO 2) — rodar depois do commit. Qualquer *** FALHOU *** = parar.
-- ============================================================
select n, verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'colunas ordem e etapa_ordem existem (int, nullable)', '2',
      (select count(*)::text from information_schema.columns where table_schema = 'public'
        and table_name = 'obras_atividade' and column_name in ('ordem','etapa_ordem')
        and data_type = 'integer' and is_nullable = 'YES')),
  (2, 'sem_impedimento é boolean not null default false', 'boolean|NO|false',
      (select data_type || '|' || is_nullable || '|' || column_default from information_schema.columns
        where table_schema = 'public' and table_name = 'obras_rdo' and column_name = 'sem_impedimento')),
  (3, 'backfill: atividades sem ordem', '0',
      (select count(*)::text from public.obras_atividade where ordem is null)),
  (4, 'backfill: atividades sem etapa_ordem', '0',
      (select count(*)::text from public.obras_atividade where etapa_ordem is null)),
  (5, 'ordem = numero (logo após a migration, nada foi reordenado ainda)', '0',
      (select count(*)::text from public.obras_atividade where ordem is distinct from numero)),
  (6, 'cada etapa tem uma só etapa_ordem por versão', '0',
      (select count(*)::text from (
         select versao_id, coalesce(etapa, '') from public.obras_atividade
          group by versao_id, coalesce(etapa, '')
         having count(distinct etapa_ordem) > 1) x)),
  (7, 'etapa_ordem segue a primeira aparição (menor numero) em cada versão', '0',
      (select count(*)::text from (
         select min(etapa_ordem) as eo,
                dense_rank() over (partition by versao_id order by min(numero)) as r
           from public.obras_atividade group by versao_id, coalesce(etapa, '')) x
        where x.eo is distinct from x.r)),
  (8, 'trigger obras_atividade_imutavel religado', '1',
      (select count(*)::text from pg_trigger where tgname = 'obras_atividade_imutavel'
         and tgrelid = 'public.obras_atividade'::regclass and not tgisinternal and tgenabled = 'O')),
  (9, 'obras_rdo_estado cobre sem_impedimento (new e old) e mantém o clima por turno', 'true',
      (select (prosrc like '%new.sem_impedimento%' and prosrc like '%old.sem_impedimento%'
               and prosrc like '%new.clima_manha, new.clima_tarde%' and prosrc like '%old.clima_manha, old.clima_tarde%')::text
         from pg_proc where oid = 'public.obras_rdo_estado()'::regprocedure)),
  (10, 'trigger obras_rdo_estado ligado', '1',
      (select count(*)::text from pg_trigger where tgname = 'obras_rdo_estado' and not tgisinternal and tgenabled = 'O')),
  (11, 'obras_rdo_estado fechada para authenticated e anon', 'false',
      (select (has_function_privilege('authenticated', 'public.obras_rdo_estado()', 'EXECUTE')
            or has_function_privilege('anon', 'public.obras_rdo_estado()', 'EXECUTE'))::text))
) as t(n, verificacao, esperado, encontrado)
order by n;
