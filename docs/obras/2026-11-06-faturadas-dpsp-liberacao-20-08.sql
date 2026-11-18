-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 06/11/2026, a pedido do Jose Guilherme ("pode fazer 1 e 2, a 3 nao precisa").
-- Fonte: docs/cliente/2026-11-06-liberacao-faturamento-dpsp-20-08.md (liberação DPSP de 20/08/2026, 12 pedidos).
-- Conferido no Omie (ListarNFSEs, só leitura, 06/11): os 12 pedidos têm NFS-e autorizada (F); valor da NF = valor do e-mail.
-- 6 já estavam faturadas no hub; 5 OS não existem no hub e o Jose decidiu NÃO cadastrar
-- (0426-008819 NF 1324, 0426-014237 NF 1322, 0626-013801 NF 1320, 0626-008580 NF 1319, 0626-010686 NF 1323).
do $$
declare
  qm text := 'carga-06-11 (Claude, a pedido do Jose Guilherme)';
  n int;
begin
  -- 1) 0626-010405: estava em pendFat; NF 1321 emitida em 20/08, R$ 500,00, pedido 4500742677, folha 1000687093.
  update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
    fat_nfse = '1321', fat_pedido = '4500742677', fat_folhas = '1000687093', marco_faturou = date '2026-08-20'
  where os = '0626-010405' and etapa = 'pendFat' and fat_nfse is null and fat_pedido is null and valor = 500;
  get diagnostics n = row_count; if n <> 1 then raise exception 'faturar 0626-010405'; end if;
  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
    select id, 'Esteira', 'etapa', 'Pendente faturamento', 'Faturado',
      'Liberação DPSP de 20/08: NF 1321 de 20/08 no Omie, pedido 4500742677', qm
    from obras_obra where os = '0626-010405';

  -- 2) 0226-011320: marco_faturou 05/10 -> 20/08 = emissão da NF 1317 no Omie.
  update obras_obra set marco_faturou = date '2026-08-20', atualizacao = current_date
  where os = '0226-011320' and etapa = 'faturado' and fat_nfse = '1317' and marco_faturou = date '2026-10-05';
  get diagnostics n = row_count; if n <> 1 then raise exception 'marco 0226-011320'; end if;
  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
    select id, 'Esteira', 'marco_faturou', '05/10/2026', '20/08/2026', 'Liberação DPSP de 20/08: data de emissão da NF 1317 no Omie', qm
    from obras_obra where os = '0226-011320';
end $$;
