-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 30/10/2026, a pedido do Jose Guilherme.
-- Cruzamento da planilha docs/cliente/2026-10-30-pedidos-manfac.xlsx (chamado -> pedido DPSP) com as NFS-e do Omie
-- (pedido do cliente na OS da nota; pedido e folhas confirmados pelo texto da NF via ConsultarOS, só leitura).
-- Só preenche campo vazio; a etapa muda na 0426-009327 e na 0526-016210.
do $$
declare
  qm text := 'carga-30-10 (Claude, a pedido do Jose Guilherme)';
  n int;
begin
  -- NF 1428 de 06/10, R$ 1.886,40, pedido 4500743458
  update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
    fat_nfse = '1428', fat_pedido = '4500743458', fat_folhas = '1000694143 / 1000694144', marco_faturou = '2026-10-06'
  where os = '0426-009327' and etapa = 'pendFat';
  get diagnostics n = row_count; if n <> 1 then raise exception '0426-009327'; end if;
  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
    select id, 'Esteira', 'etapa', 'Pendente faturamento', 'Faturado',
      'Conciliação SPOT (planilha Pedidos Manfac): NF 1428 de 06/10 no Omie, pedido 4500743458', qm
    from obras_obra where os = '0426-009327';

  -- NF 1308 de 19/08, R$ 960,00, pedido 4500742679 (texto da NF via ConsultarOS; recebida)
  update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
    fat_nfse = '1308', fat_pedido = '4500742679', fat_folhas = '1000685215 / 1000685216', marco_faturou = '2026-08-19'
  where os = '0526-016210' and etapa = 'pendFat';
  get diagnostics n = row_count; if n <> 1 then raise exception '0526-016210'; end if;
  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
    select id, 'Esteira', 'etapa', 'Pendente faturamento', 'Faturado',
      'Conciliação SPOT: NF 1308 de 19/08 no Omie, pedido 4500742679', qm
    from obras_obra where os = '0526-016210';

  -- Já faturadas no hub, sem NF/pedido/folhas: preenche só o que está vazio
  update obras_obra set fat_nfse = '1317', fat_pedido = '4500742669', fat_folhas = '1000687090 / 1000687092'
  where os = '0226-011320' and etapa = 'faturado' and fat_nfse is null and fat_pedido is null and fat_folhas is null;
  get diagnostics n = row_count; if n <> 1 then raise exception '0226-011320'; end if;

  update obras_obra set fat_nfse = '1318'
  where os = '0226-005730' and etapa = 'faturado' and fat_nfse is null and fat_pedido = '4500716175';
  get diagnostics n = row_count; if n <> 1 then raise exception '0226-005730'; end if;

  -- 0626-005068 saiu: as folhas 1000700703/1000700704 já estavam preenchidas (a guarda barrou e a 1ª tentativa voltou inteira).
end $$;
