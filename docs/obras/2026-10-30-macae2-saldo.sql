-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 30/10/2026, a pedido do Jose Guilherme
-- ("baixa o valor da MACAÉ 2 pro saldo de 15.641,23").
-- 0426-012516 (DP MACAE 2): a NF 735 (20/05/2026, pedido 4500728137) já cobriu R$ 140.771,09 de R$ 156.412,32;
-- o saldo a faturar é R$ 15.641,23 (liberação DPSP de 26/10).
do $$
declare
  qm text := 'carga-30-10 (Claude, a pedido do Jose Guilherme)';
  n int;
begin
  update obras_obra set valor = 15641.23, atualizacao = current_date
  where os = '0426-012516' and etapa = 'pendFat' and valor = 156412.32;
  get diagnostics n = row_count; if n <> 1 then raise exception '0426-012516'; end if;
  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
    select id, 'Identificação', 'valor', 'R$ 156.412,32', 'R$ 15.641,23',
      'Conciliação SPOT: R$ 140.771,09 já faturados na NF 735 de 20/05 (pedido 4500728137); fica o saldo da liberação DPSP de 26/10', qm
    from obras_obra where os = '0426-012516';
end $$;
