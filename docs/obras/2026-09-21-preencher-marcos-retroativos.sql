-- ============================================================
-- Controle de Obras — preenchimento retroativo dos marcos da esteira
-- 2026-09-21. Decisão 3 de docs/cliente/2026-09-21-decisoes-marcos-da-esteira.md.
-- ============================================================
-- ESTE ARQUIVO NÃO É UMA MIGRATION — não muda schema, só dado. Segue o mesmo
-- padrão de conferibilidade de .claude/rules/sql.md (begin/commit, seção de
-- pré-condição, verificação depois do commit) porque escreve em produção.
--
-- ESTADO: NÃO APLICADO. João roda à mão no SQL Editor do Supabase, projeto
-- de produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar
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
-- aplicação.
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

where o.etapa in ('relatorio', 'aprovarOS', 'fecharOS', 'pendFat', 'faturado')
  and o.marco_exec_fim is null;

commit;

-- ============================================================
-- SEÇÃO 3 — DEPOIS DE RODAR: confirma que não sobrou obra pós-campo com
-- marco_exec_fim null (a menos que desde_etapa E atualizacao sejam AMBOS
-- null — caso que este script não tem como resolver e precisa ser olhado à
-- mão) e que marco_os_aprov não mudou.
-- ============================================================
--
-- select count(*) as obras_pos_campo_ainda_sem_marco_exec_fim
--  from public.obras_obra o
--  where o.etapa in ('relatorio','aprovarOS','fecharOS','pendFat','faturado')
--    and o.marco_exec_fim is null;
--   -- espera 0 (ou, se não for 0, que cada uma tenha desde_etapa E
--   -- atualizacao null — conferir à mão antes de se preocupar)
--
-- select id, os, etapa, marco_exec_fim, marco_relatorio, marco_fechou_os,
--        marco_liberou_fat, marco_faturou, marco_os_aprov
--  from public.obras_obra
--  where etapa in ('relatorio','aprovarOS','fecharOS','pendFat','faturado')
--  order by etapa;
--   -- conferência visual: cada obra tem marco_exec_fim preenchido; os
--   -- marcos ANTERIORES à etapa atual também; o marco do passo ATUAL
--   -- (ex.: marco_liberou_fat numa obra em pendFat) continua null;
--   -- marco_os_aprov está EXATAMENTE como estava antes de rodar este script.
-- ============================================================
