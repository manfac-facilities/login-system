-- NÃO APLICADO. Rodar à mão no SQL Editor (projeto iyytcavcgukfjnjjrerx). Pedido do Jose Guilherme, 01/11/2026.
--
-- QUANDO RODAR: LOGO DEPOIS do deploy do app do Financeiro (branch feat/spot-faturamento-parcial) e ANTES de
-- qualquer nota nova ser emitida para a 0426-012516. Não depende do app do hub. Ordem completa (também em
-- .claude/rules/obras.md): hub SQL -> Financeiro 045 -> app do Financeiro (logo depois da 045) -> ESTE script ->
-- app do hub.
--
-- SE ABORTAR porque a OS já está 'faturado' (ou por qualquer outra pré-condição): NÃO escrever variante deste
-- script. José pede ajuda antes de mexer na OS.
--
-- Reverte o acerto de 30/10 (docs/obras/2026-10-30-macae2-saldo.sql, que baixou o valor da OS para o
-- saldo) e registra a NF 735 da forma nova: valor TOTAL da OS e a nota emitida antes do módulo de
-- faturamento em obras_nota_externa.
--
-- 0426-012516 (DP MACAE 2): valor total R$ 156.412,32; NF 735 (20/05/2026, pedido 4500728137) já
-- cobriu R$ 140.771,09; falta R$ 15.641,23 (liberação DPSP de 26/10).
--
-- Pré-condição: a OS precisa existir UMA vez, estar em pendFat com valor 15641.23 (estado deixado pelo
-- acerto de 30/10) e obras_nota_externa precisa existir (sdd-sql-obras-spot-financeiro.sql). Senão aborta e nada
-- muda. Também acerta fat_nfse para conter '735' (nulo vira '735'; senão '735, ' na frente se ainda não constar).
-- Rodando como postgres/service no SQL Editor não há JWT: criado_por e quem vão explícitos.
--
-- ENSAIO: não foi feito (sem acesso ao banco nesta sessão). Antes de valer, trocar o `commit;` por
-- `rollback;`, rodar e conferir a consulta do rodapé; só então rodar com `commit;`.

begin;

do $$
declare
  qm text := 'carga (Claude, a pedido do Jose Guilherme)';
  v_id uuid;
  v_etapa text;
  v_valor numeric;
  v_nfse text;
  n int;
begin
  if to_regclass('public.obras_nota_externa') is null then
    raise exception 'obras_nota_externa não existe: aplicar sdd-sql-obras-spot-financeiro.sql antes. Nada foi alterado.';
  end if;

  -- strict: zero ou mais de uma linha aborta.
  begin
    select id, etapa, valor, fat_nfse into strict v_id, v_etapa, v_valor, v_nfse
      from obras_obra where os = '0426-012516';
  exception
    when no_data_found then
      raise exception 'Pré-condição falhou: 0426-012516 não encontrada. Nada foi alterado.';
    when too_many_rows then
      raise exception 'Pré-condição falhou: mais de uma obra com a OS 0426-012516. Nada foi alterado.';
  end;
  if v_etapa = 'faturado' then
    raise exception '0426-012516 já está faturado. Não escrever variante: pedir ajuda. Nada foi alterado.';
  end if;
  if v_etapa is distinct from 'pendFat' or v_valor is distinct from 15641.23 then
    raise exception 'Pré-condição falhou: 0426-012516 está em % com valor % (esperado pendFat, 15641.23). Nada foi alterado.',
      v_etapa, v_valor;
  end if;

  -- fat_nfse passa a conter '735' (lista separada por vírgula, como obras_marcar_faturada grava).
  if v_nfse is null or btrim(v_nfse) = '' then
    v_nfse := '735';
  elsif not ('735' = any (select btrim(x) from unnest(string_to_array(v_nfse, ',')) as x)) then
    v_nfse := '735, ' || v_nfse;
  end if;

  update obras_obra set valor = 156412.32, fat_nfse = v_nfse, atualizacao = current_date where id = v_id;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'update de 0426-012516 afetou % linhas', n; end if;

  insert into obras_nota_externa (obra_id, nfse, emitida_em, valor_centavos, pedido, obs, criado_por)
  values (v_id, '735', date '2026-05-20', 14077109, '4500728137',
          'NF anterior ao módulo de faturamento', qm);

  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
  values (v_id, 'Identificação', 'valor', 'R$ 15.641,23', 'R$ 156.412,32',
          'Valor total da OS restaurado: R$ 140.771,09 já faturados na NF 735 de 20/05 (pedido 4500728137) passam a constar como nota externa (735 incluída em fat_nfse); falta R$ 15.641,23',
          qm);
end $$;

-- Conferência esperada: valor 156412.32, etapa pendFat, fat_nfse contendo 735, faturado_centavos 14077109
-- (falta 15.641,23 = 1564123 centavos), 1 nota externa (735), 1 linha de histórico nova.
select o.os, o.etapa, o.valor, o.fat_nfse,
       (select coalesce(sum(valor_centavos), 0) from obras_nota_externa where obra_id = o.id) as faturado_centavos,
       round(o.valor * 100)::bigint
         - (select coalesce(sum(valor_centavos), 0) from obras_nota_externa where obra_id = o.id) as falta_centavos
from obras_obra o where o.os = '0426-012516';

commit;
