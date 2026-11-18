-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 05/11/2026, a pedido do Jose Guilherme ("pode gravar as da profarma").
-- Fonte: docs/cliente/2026-11-05-consolidado-financeiro-manfac-profarma.xlsx (OS x pedido x NF) conferida no Omie
-- (ListarNFSEs, só leitura): toda NF autorizada (F) e soma das OS da planilha = valor da NF, ao centavo.
-- marco_faturou = emissão da NF no Omie. Folhas: a Profarma não usa (fica vazio).
-- 3087264: o pedido gravado é o da NF no Omie (4503268281); a planilha diz 4503279739.
-- 3082591: a NF 1419 não tem pedido no Omie; o pedido é o da planilha.
-- 2714566: duas notas (958 de 14/07 com R$ 1.470,40 e 1415 de 24/09 com R$ 2.131,60); marco = a última.
-- Fora: 3245574 (hub R$ 401,60 x NF 1500 R$ 200,80). Aviso: o Omie tem 965 e 966 (15/07) com o mesmo pedido e valor de 958 e 956.
do $$
declare
  qm text := 'carga-05-11 (Claude, a pedido do Jose Guilherme)';
  r record;
  n int;
begin
  for r in select * from (values
    ('3106284', 4693.70, '1497', '4503307056', date '2026-10-16'),
    ('3230485', 1610.26, '1501', '4503312270', date '2026-10-16'),
    ('3235497', 1348.98, '1505', '4503312273', date '2026-10-16'),
    ('3251617', 368.26, '1507', '4503312226', date '2026-10-16'),
    ('2983365', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('2419572', 2128.45, '1262', '4503262781', date '2026-08-07'),
    ('2461419', 3975.45, '958', '4503245122', date '2026-07-14'),
    ('2532038', 5365.32, '1331', '4503278241', date '2026-08-26'),
    ('2677412', 1649.03, '1415', '4503297999', date '2026-09-24'),
    ('2681966', 522.75, '958', '4503245122', date '2026-07-14'),
    ('2684022', 496.24, '1292', '4503268291', date '2026-08-17'),
    ('2714566', 3602.00, '958, 1415', '4503245122, 4503297999', date '2026-09-24'),
    ('2725797', 4323.80, '1333', '4503278252', date '2026-08-26'),
    ('2730579', 1126.80, '958', '4503245122', date '2026-07-14'),
    ('2731555', 2400.36, '958', '4503245122', date '2026-07-14'),
    ('2736434', 1565.57, '1415', '4503297999', date '2026-09-24'),
    ('2738602', 1565.57, '1415', '4503297999', date '2026-09-24'),
    ('2741876', 3825.42, '956', '4503243322', date '2026-07-14'),
    ('2791349', 1023.47, '958', '4503245122', date '2026-07-14'),
    ('2811031', 2823.48, '1418', '4503296588', date '2026-09-24'),
    ('2834680', 1669.67, '1004', '4503251659', date '2026-07-21'),
    ('2851704', 2041.14, '1415', '4503297999', date '2026-09-24'),
    ('2865147', 12258.30, '1329', '4503278245', date '2026-08-26'),
    ('2908817', 1585.25, '958', '4503245122', date '2026-07-14'),
    ('2928929', 2481.40, '1414', '4503297998', date '2026-09-24'),
    ('2934134', 740.81, '958', '4503245122', date '2026-07-14'),
    ('2975939', 1017.03, '958', '4503245122', date '2026-07-14'),
    ('3048568', 919.80, '1416', '4503289873', date '2026-09-24'),
    ('3053075', 1332.68, '1293', '4503268272', date '2026-08-17'),
    ('3056197', 1004.00, '1347', '4503278262', date '2026-08-26'),
    ('3082169', 1326.37, '1345', '4503275498', date '2026-08-26'),
    ('3082591', 3500.00, '1419', '4503296582', date '2026-10-01'),
    ('3087264', 850.65, '1297', '4503268281', date '2026-08-17'),
    ('3112058', 2500.00, '1414', '4503297998', date '2026-09-24'),
    ('3115066', 1017.03, '1417', '4503289874', date '2026-09-24'),
    ('3129438', 1516.87, '1343', '4503278247', date '2026-08-26'),
    ('3134246', 1421.08, '1344', '4503271849', date '2026-08-26'),
    ('3149147', 1091.60, '1414', '4503297998', date '2026-09-24'),
    ('3151602', 2273.33, '1414', '4503297998', date '2026-09-24'),
    ('3159410', 4399.00, '1415', '4503297999', date '2026-09-24'),
    ('3159758', 368.26, '1415', '4503297999', date '2026-09-24')

  ) v(os, val, nf, ped, em) loop
    update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
      fat_nfse = r.nf, fat_pedido = r.ped, marco_faturou = r.em
    where os = r.os and etapa = 'pendFat' and fat_nfse is null and fat_pedido is null and valor = r.val;
    get diagnostics n = row_count; if n <> 1 then raise exception 'faturar: %', r.os; end if;
    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
      select id, 'Esteira', 'etapa', 'Pendente faturamento', 'Faturado',
        format('Consolidado Profarma: NF %s de %s no Omie, pedido %s', r.nf, to_char(r.em, 'DD/MM'), r.ped), qm
      from obras_obra where os = r.os;
  end loop;
end $$;

-- 2ª parte, aplicada em 05/11/2026: o Jose confirmou que o valor da 3245574 é R$ 200,80 ("valor é 200,80 mesmo pode corrigir").
-- 965/966 (possível duplicidade com 958/956): o Jose pediu para desconsiderar.
do $$
declare
  qm text := 'carga-05-11 (Claude, a pedido do Jose Guilherme)';
  n int;
begin
  update obras_obra set valor = 200.80, atualizacao = current_date where os = '3245574' and valor = 401.60 and etapa = 'pendFat';
  get diagnostics n = row_count; if n <> 1 then raise exception 'valor 3245574'; end if;
  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
    select id, 'Identificação', 'valor', 'R$ 401,60', 'R$ 200,80', 'Consolidado Profarma: valor confirmado pelo Jose Guilherme (= NF 1500)', qm
    from obras_obra where os = '3245574';
  update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
    fat_nfse = '1500', fat_pedido = '4503312241', marco_faturou = '2026-10-16'
  where os = '3245574' and etapa = 'pendFat' and fat_nfse is null and fat_pedido is null and valor = 200.80;
  get diagnostics n = row_count; if n <> 1 then raise exception 'faturar 3245574'; end if;
  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
    select id, 'Esteira', 'etapa', 'Pendente faturamento', 'Faturado', 'Consolidado Profarma: NF 1500 de 16/10 no Omie, pedido 4503312241', qm
    from obras_obra where os = '3245574';
end $$;
