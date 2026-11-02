-- NÃO APLICADO. Rodar à mão no SQL Editor (projeto iyytcavcgukfjnjjrerx) SÓ DEPOIS do deploy do
-- "Financeiro da OS no SPOT" (ordem em .claude/rules/obras.md): hub SQL -> Financeiro 045 ->
-- Financeiro app -> hub app -> este script. Pedido do Jose Guilherme, 01/11/2026.
--
-- Reverte o acerto de 30/10 (docs/obras/2026-10-30-macae2-saldo.sql, que baixou o valor da OS para o
-- saldo) e registra a NF 735 da forma nova: valor TOTAL da OS e a nota emitida antes do módulo de
-- faturamento em obras_nota_externa.
--
-- 0426-012516 (DP MACAE 2): valor total R$ 156.412,32; NF 735 (20/05/2026, pedido 4500728137) já
-- cobriu R$ 140.771,09; falta R$ 15.641,23 (liberação DPSP de 26/10).
--
-- Pré-condição: a OS precisa estar em pendFat com valor 15641.23 (estado deixado pelo acerto de 30/10)
-- e obras_nota_externa precisa existir (sdd-sql-obras-spot-financeiro.sql). Senão aborta e nada muda.
-- Rodando como postgres/service no SQL Editor não há JWT: criado_por e quem vão explícitos.
--
-- ENSAIO: não foi feito (sem acesso ao banco nesta sessão). Antes de valer, trocar o `commit;` por
-- `rollback;`, rodar e conferir a consulta do rodapé; só então rodar com `commit;`.

begin;

do $$
declare
  qm text := 'carga (Claude, a pedido do Jose Guilherme)';
  v_id uuid;
  n int;
begin
  if to_regclass('public.obras_nota_externa') is null then
    raise exception 'obras_nota_externa não existe: aplicar sdd-sql-obras-spot-financeiro.sql antes. Nada foi alterado.';
  end if;

  select id into v_id from obras_obra
   where os = '0426-012516' and etapa = 'pendFat' and valor = 15641.23;
  if v_id is null then
    raise exception 'Pré-condição falhou: 0426-012516 não está em pendFat com valor 15641.23. Nada foi alterado.';
  end if;

  update obras_obra set valor = 156412.32, atualizacao = current_date where id = v_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'update de 0426-012516 afetou % linhas', n; end if;

  insert into obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos, pedido, obs, criado_por)
  values (v_id, '735', date '2026-05-20', 14077109, '4500728137',
          'NF anterior ao módulo de faturamento', qm);

  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
  values (v_id, 'Identificação', 'valor', 'R$ 15.641,23', 'R$ 156.412,32',
          'Valor total da OS restaurado: R$ 140.771,09 já faturados na NF 735 de 20/05 (pedido 4500728137) passam a constar como nota externa; falta R$ 15.641,23',
          qm);
end $$;

-- Conferência esperada: valor 156412.32, etapa pendFat, faturado_centavos 14077109
-- (falta 15.641,23 = 1564123 centavos), 1 nota externa (735), 1 linha de histórico nova.
select o.os, o.etapa, o.valor,
       (select coalesce(sum(valor_centavos), 0) from obras_nota_externa where obra_id = o.id) as faturado_centavos,
       round(o.valor * 100)::bigint
         - (select coalesce(sum(valor_centavos), 0) from obras_nota_externa where obra_id = o.id) as falta_centavos
from obras_obra o where o.os = '0426-012516';

commit;
