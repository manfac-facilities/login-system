-- ============================================================
-- Controle de Obras — preenchimento retroativo dos marcos da esteira
-- 2026-09-21. Decisão 3 de docs/cliente/2026-09-21-decisoes-marcos-da-esteira.md.
-- ============================================================
-- ESTE ARQUIVO NÃO É UMA MIGRATION — não muda schema, só dado. Segue o mesmo
-- padrão de conferibilidade de .claude/rules/sql.md (begin/commit, seção de
-- pré-condição, verificação depois do commit) porque escreve em produção.
--
-- ESTADO: APLICADO em 21/09/2026 ~02:15 (Brasília), pela Management API, com
-- autorização do João. Verificação: 6 linhas, todas OK. As 2 obras (DP
-- ITABORAI, pendFat) receberam exec_fim/relatorio/fechou_os = 16/09/2026.
-- Reaplicar ABORTA na guarda (a contagem cai para 0) — esperado.
-- Projeto de produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar
-- (AGENTS.md). O PAT fica em C:\Users\joao-\.supabase-pat — nunca pelo `!`
-- do chat (vaza o valor para o contexto).
--
-- O QUE ISTO CORRIGE: até 21/09/2026 nenhum código gravava
-- marco_exec_fim/marco_relatorio/marco_fechou_os/marco_liberou_fat/
-- marco_faturou (achado B1 de docs/DIVIDAS.md). A correção em
-- app/obras/obra/[id]/_actions.ts (mudarEtapaAction) passa a gravá-los DAQUI
-- PRA FRENTE, a cada troca de etapa. Este script cobre o PASSADO: obras que
-- já estão paradas numa etapa pós-campo (relatorio…faturado) sem
-- marco_exec_fim, porque a troca de etapa que as levou até lá aconteceu
-- antes da correção existir.
--
-- REGRA (decisão 3, escrita em produção "mostrar a contagem ao João antes de
-- gravar" — é para isso que a SEÇÃO 1 abaixo existe, comentada, ANTES do
-- `begin`): para toda obra em etapa pós-campo (relatorio, aprovarOS,
-- fecharOS, pendFat, faturado) com marco_exec_fim NULL, preenche
-- marco_exec_fim e os marcos dos passos ANTERIORES à etapa atual (nunca
-- marco_os_aprov — satélite do trio de aprovação, fora desta conta) com
-- `desde_etapa` — ou, quando `desde_etapa` também for null (obra antiga
-- sem o campo populado), com `atualizacao`, o mesmo fallback que
-- `paradaNaEtapa()` usa em app/obras/_lib/tipos.ts. SÓ grava onde a coluna
-- já é NULL — marco com data não é tocado, idempotente por construção.
--
-- A ÚNICA EXCEÇÃO simétrica à regra de app/obras/obra/[id]/_actions.ts
-- (calcularMarcosDaEsteira): se a etapa ATUAL da obra já é 'faturado', o
-- PRÓPRIO marco_faturou também é preenchido (mesma regra do "entrar em
-- faturado" da decisão 1 — etapa terminal, a esteira só marca como feita
-- com data). Hoje (21/09) nenhuma das obras afetadas está em 'faturado' —
-- as 2 conhecidas estão em 'pendFat' — mas o script cobre o caso geral.
--
-- Contado hoje (21/09/2026, antes de rodar): 2 obras em pendFat com
-- marco_exec_fim null. Confirme de novo com a SEÇÃO 1 antes de gravar — a
-- contagem muda se alguém trocar etapa entre a escrita deste arquivo e a
-- aplicação. A SEÇÃO 2 também confere isso sozinha (guarda dentro da
-- transação, que ABORTA se a contagem não for exatamente 2) — a Seção 1 é
-- para OLHAR antes; a guarda é para não gravar às cegas se ninguém olhou.
-- ============================================================


-- ============================================================
-- SEÇÃO 1 — PRÉ-VISUALIZAÇÃO. Rode ISTO sozinho primeiro (SEM o `begin`
-- abaixo) e confira a lista antes de aplicar a Seção 2. Mostra, por obra,
-- o que cada marco VAI virar — sem gravar nada.
-- ============================================================

-- select
--   o.id,
--   o.os,
--   o.loja,
--   o.etapa,
--   o.desde_etapa,
--   o.atualizacao,
--   coalesce(o.desde_etapa, o.atualizacao) as data_a_gravar,
--   o.marco_exec_fim as marco_exec_fim_atual,
--   coalesce(o.marco_exec_fim, coalesce(o.desde_etapa, o.atualizacao)) as marco_exec_fim_novo,
--   o.marco_relatorio as marco_relatorio_atual,
--   case
--     when (case o.etapa
--             when 'relatorio' then 4 when 'aprovarOS' then 5 when 'fecharOS' then 6
--             when 'pendFat' then 7 when 'faturado' then 8 else -1 end) > 4
--       then coalesce(o.marco_relatorio, coalesce(o.desde_etapa, o.atualizacao))
--     else o.marco_relatorio
--   end as marco_relatorio_novo,
--   o.marco_fechou_os as marco_fechou_os_atual,
--   case
--     when (case o.etapa
--             when 'relatorio' then 4 when 'aprovarOS' then 5 when 'fecharOS' then 6
--             when 'pendFat' then 7 when 'faturado' then 8 else -1 end) > 6
--       then coalesce(o.marco_fechou_os, coalesce(o.desde_etapa, o.atualizacao))
--     else o.marco_fechou_os
--   end as marco_fechou_os_novo,
--   o.marco_liberou_fat as marco_liberou_fat_atual,
--   case
--     when (case o.etapa
--             when 'relatorio' then 4 when 'aprovarOS' then 5 when 'fecharOS' then 6
--             when 'pendFat' then 7 when 'faturado' then 8 else -1 end) > 7
--       then coalesce(o.marco_liberou_fat, coalesce(o.desde_etapa, o.atualizacao))
--     else o.marco_liberou_fat
--   end as marco_liberou_fat_novo,
--   o.marco_faturou as marco_faturou_atual,
--   case
--     when o.etapa = 'faturado'
--       then coalesce(o.marco_faturou, coalesce(o.desde_etapa, o.atualizacao))
--     else o.marco_faturou
--   end as marco_faturou_novo
-- from public.obras_obra o
-- where o.etapa in ('relatorio', 'aprovarOS', 'fecharOS', 'pendFat', 'faturado')
--   and o.marco_exec_fim is null
-- order by o.etapa, o.desde_etapa nulls last;
--
-- -- Contagem simples, para bater com "2 obras em pendFat" antes de aplicar:
-- -- select o.etapa, count(*) from public.obras_obra o
-- --  where o.etapa in ('relatorio','aprovarOS','fecharOS','pendFat','faturado')
-- --    and o.marco_exec_fim is null
-- --  group by o.etapa order by o.etapa;


-- ============================================================
-- SEÇÃO 2 — A ESCRITA. Só depois de conferir a Seção 1.
-- ============================================================

begin;

-- Seção 0 — pré-condição: a tabela e as colunas de marco precisam existir
-- (migration obras-v0, já aplicada — ver .claude/rules/sql.md). Aborta a
-- transação em vez de falhar a meio caminho se, por algum motivo, isso não
-- for verdade neste banco.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'obras_obra'
      and column_name = 'marco_exec_fim'
  ) then
    raise exception 'obras_obra.marco_exec_fim não existe — migration obras-v0 não aplicada neste banco. Abortando.';
  end if;
end
$$;

-- Snapshot ANTES do update — é o MESMO filtro do update logo abaixo (a
-- update usa `id in (select id from esta tabela)`, então os dois nunca
-- divergem por edição futura de um dos dois). Serve para três coisas: (1) a
-- guarda de contagem abaixo, que aborta se o número não bater com o que foi
-- contado ao escrever este arquivo — não rodar às cegas se a base mudou
-- nesse meio-tempo; (2) a verificação de depois do commit (Seção 3) comparar
-- antes×depois de verdade, inclusive provar que marco_os_aprov não mudou;
-- (3) documentação viva de quais obras este script tocou. `temporary`
-- (sem `on commit drop`) sobrevive ao `commit;` abaixo — continua visível
-- para a Seção 3 dentro da MESMA sessão do SQL Editor.
create temporary table _marcos_backfill_antes as
select o.id, o.os, o.etapa, o.desde_etapa, o.atualizacao,
       o.marco_exec_fim, o.marco_relatorio, o.marco_fechou_os,
       o.marco_liberou_fat, o.marco_faturou, o.marco_os_aprov
from public.obras_obra o
where o.etapa in ('relatorio', 'aprovarOS', 'fecharOS', 'pendFat', 'faturado')
  and o.marco_exec_fim is null;

-- Guarda: aborta se a contagem não bater com o que foi visto ao escrever
-- este script (21/09/2026, "Hoje são 2 obras em pendFat" — ver cabeçalho).
-- Se a base mudou desde então (alguém trocou etapa de uma destas obras,
-- ou entrou uma obra nova nesse estado), rodar sem olhar de novo não é
-- seguro — pare e confira a SEÇÃO 1 antes de mudar o número aqui.
-- Reaplicar este arquivo depois de rodado com sucesso também aborta aqui
-- (a contagem cai para 0, porque o filtro não acha mais nenhuma obra
-- pós-campo com marco_exec_fim null) — comportamento esperado, não bug.
do $$
declare
  v_afetadas int;
begin
  select count(*) into v_afetadas from _marcos_backfill_antes;
  if v_afetadas <> 2 then
    raise exception 'preencher-marcos-retroativos: esperava 2 obras (contadas em 21/09/2026), achou %. Confira a SEÇÃO 1 antes de continuar — o número mudou desde a escrita deste script, e rodar às cegas sobre uma contagem diferente da esperada não é seguro.', v_afetadas;
  end if;
end
$$;

update public.obras_obra o set
  marco_exec_fim = coalesce(o.marco_exec_fim, coalesce(o.desde_etapa, o.atualizacao)),

  -- Cada marco só é tocado se o passo dele for ANTERIOR à etapa atual da
  -- obra (posição estritamente menor na esteira) — nunca o próprio passo em
  -- que ela está agora, e nunca marco_os_aprov (fora desta conta, de
  -- propósito, decisão 3 do João).
  marco_relatorio = case
    when (case o.etapa
            when 'relatorio' then 4 when 'aprovarOS' then 5 when 'fecharOS' then 6
            when 'pendFat' then 7 when 'faturado' then 8 else -1 end) > 4
      then coalesce(o.marco_relatorio, coalesce(o.desde_etapa, o.atualizacao))
    else o.marco_relatorio
  end,

  marco_fechou_os = case
    when (case o.etapa
            when 'relatorio' then 4 when 'aprovarOS' then 5 when 'fecharOS' then 6
            when 'pendFat' then 7 when 'faturado' then 8 else -1 end) > 6
      then coalesce(o.marco_fechou_os, coalesce(o.desde_etapa, o.atualizacao))
    else o.marco_fechou_os
  end,

  marco_liberou_fat = case
    when (case o.etapa
            when 'relatorio' then 4 when 'aprovarOS' then 5 when 'fecharOS' then 6
            when 'pendFat' then 7 when 'faturado' then 8 else -1 end) > 7
      then coalesce(o.marco_liberou_fat, coalesce(o.desde_etapa, o.atualizacao))
    else o.marco_liberou_fat
  end,

  -- Exceção simétrica à de calcularMarcosDaEsteira: só quando a obra JÁ ESTÁ
  -- em 'faturado' (etapa terminal) o próprio marco_faturou também entra.
  marco_faturou = case
    when o.etapa = 'faturado'
      then coalesce(o.marco_faturou, coalesce(o.desde_etapa, o.atualizacao))
    else o.marco_faturou
  end

where o.id in (select id from _marcos_backfill_antes);

commit;

-- ============================================================
-- SEÇÃO 3 — VERIFICAÇÃO, depois do commit, tudo só leitura. Mesmo padrão de
-- sdd-sql-obras-motivos-remarcacao.sql §5: uma consulta só (o SQL Editor só
-- mostra o resultado da ÚLTIMA instrução do batch), uma linha por
-- invariante, com o esperado, o encontrado e OK / *** FALHOU ***.
--
-- ESPERADO: 6 linhas, todas com resultado = OK.
-- ============================================================

select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (
  select 1 as n,
         'obras identificadas para o backfill (pos-campo, marco_exec_fim null, contadas antes do update)' as verificacao,
         2 as esperado,
         (select count(*) from _marcos_backfill_antes)::int as encontrado
  union all
  select 2,
         'marco_exec_fim preenchido em toda afetada que tinha desde_etapa ou atualizacao para usar',
         (select count(*) from _marcos_backfill_antes where not (desde_etapa is null and atualizacao is null))::int,
         (select count(*) from public.obras_obra o join _marcos_backfill_antes b on b.id = o.id
            where o.marco_exec_fim is not null)::int
  union all
  select 3,
         'marco_os_aprov NAO mudou em nenhuma afetada (satelite da aprovacao, fora desta conta)',
         0,
         (select count(*) from public.obras_obra o join _marcos_backfill_antes b on b.id = o.id
            where o.marco_os_aprov is distinct from b.marco_os_aprov)::int
  union all
  select 4,
         'marco do PROPRIO passo atual continua null nas afetadas que NAO estao em faturado',
         0,
         (select count(*) from public.obras_obra o join _marcos_backfill_antes b on b.id = o.id
            where o.etapa <> 'faturado'
              and (
                (o.etapa = 'relatorio' and o.marco_relatorio is not null)
                or (o.etapa = 'fecharOS' and o.marco_fechou_os is not null)
                or (o.etapa = 'pendFat' and o.marco_liberou_fat is not null)
              ))::int
  union all
  select 5,
         'marco_faturou preenchido nas afetadas que JA ESTAO em faturado (excecao da etapa terminal)',
         (select count(*) from _marcos_backfill_antes where etapa = 'faturado')::int,
         (select count(*) from public.obras_obra o join _marcos_backfill_antes b on b.id = o.id
            where o.etapa = 'faturado' and o.marco_faturou is not null)::int
  union all
  select 6,
         'nenhum marco ANTERIOR ao passo atual ficou null quando estava null e havia data para preencher',
         0,
         (select count(*) from public.obras_obra o join _marcos_backfill_antes b on b.id = o.id
            where not (b.desde_etapa is null and b.atualizacao is null)
              and (
                ((case b.etapa when 'relatorio' then 4 when 'aprovarOS' then 5 when 'fecharOS' then 6
                                when 'pendFat' then 7 when 'faturado' then 8 else -1 end) > 4
                  and b.marco_relatorio is null and o.marco_relatorio is null)
                or
                ((case b.etapa when 'relatorio' then 4 when 'aprovarOS' then 5 when 'fecharOS' then 6
                                when 'pendFat' then 7 when 'faturado' then 8 else -1 end) > 6
                  and b.marco_fechou_os is null and o.marco_fechou_os is null)
                or
                ((case b.etapa when 'relatorio' then 4 when 'aprovarOS' then 5 when 'fecharOS' then 6
                                when 'pendFat' then 7 when 'faturado' then 8 else -1 end) > 7
                  and b.marco_liberou_fat is null and o.marco_liberou_fat is null)
              ))::int
) x
order by n;

-- Conferência visual complementar, se alguma linha acima der FALHOU (rodar
-- separado, não faz parte do batch principal):
--
-- select b.id, b.os, b.etapa,
--        b.marco_exec_fim as exec_fim_antes, o.marco_exec_fim as exec_fim_depois,
--        b.marco_relatorio as relatorio_antes, o.marco_relatorio as relatorio_depois,
--        b.marco_fechou_os as fechou_os_antes, o.marco_fechou_os as fechou_os_depois,
--        b.marco_liberou_fat as liberou_fat_antes, o.marco_liberou_fat as liberou_fat_depois,
--        b.marco_faturou as faturou_antes, o.marco_faturou as faturou_depois,
--        b.marco_os_aprov as os_aprov_antes, o.marco_os_aprov as os_aprov_depois
--  from _marcos_backfill_antes b
--  join public.obras_obra o on o.id = b.id
--  order by b.etapa;
