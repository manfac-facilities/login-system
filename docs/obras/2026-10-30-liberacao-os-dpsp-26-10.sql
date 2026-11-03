-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 30/10/2026, autorizado pelo Jose Guilherme
-- ("pode gravar a (a); para a OS com valor diferente vale o que está nessa planilha, já validado com o cliente").
-- Fonte: docs/cliente/2026-10-30-manfac-dpsp-liberacao-os-26-10.xlsx (aba BASE) x hub x Omie (só leitura).
-- (a) Faturadas: 0526-016397 está na BASE com "NF 1377"; as outras 9 casam por valor exato com uma única NF DPSP
--     e estão na planilha Pedidos Manfac com o mesmo valor (pedido em branco). Pedido e folhas = texto da NF (ConsultarOS).
-- (b) Valor: vale o da BASE, validado com o cliente.
do $$
declare
  qm text := 'carga-30-10 (Claude, a pedido do Jose Guilherme)';
  r record;
  n int;
begin
  for r in select * from (values
    ('0526-016397', '1377', '4500751783', '1000689534 / 1000689539', date '2026-09-10'),
    ('0726-013344', '1269', '4500742684', '1000679867 / 1000679868', date '2026-08-10'),
    ('0726-010838', '1305', '4500742681', '1000685890', date '2026-08-19'),
    ('0726-015135', '1328', '4500743459', '1000687295 / 1000687296', date '2026-08-21'),
    ('0426-016925', '1374', '4500751830', '1000689720 / 1000689721', date '2026-09-10'),
    ('0426-016931', '1378', '4500751803', '1000689722 / 1000689723', date '2026-09-10'),
    ('0526-018145', '1422', '4500759012', '1000696002 / 1000696003', date '2026-10-06'),
    ('0726-010993', '1423', '4500758953', '1000696000 / 1000696001', date '2026-10-06'),
    ('0626-004129', '1424', '4500758940', '1000695997 / 1000695998', date '2026-10-06'),
    ('0226-013174', '1429', '4500721680', '1000694141 / 1000694142', date '2026-10-06')
  ) v(os, nf, ped, fol, em) loop
    update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
      fat_nfse = r.nf, fat_pedido = r.ped, fat_folhas = r.fol, marco_faturou = r.em
    where os = r.os and etapa = 'pendFat' and fat_nfse is null;
    get diagnostics n = row_count; if n <> 1 then raise exception 'faturar: %', r.os; end if;
    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
      select id, 'Esteira', 'etapa', 'Pendente faturamento', 'Faturado',
        format('Conciliação SPOT (liberação DPSP 26/10): NF %s de %s no Omie, pedido %s', r.nf, to_char(r.em, 'DD/MM'), r.ped), qm
      from obras_obra where os = r.os;
  end loop;

  for r in select * from (values
    ('0526-008209', 1750.00, 8600.00, 'R$ 1.750,00', 'R$ 8.600,00'),
    ('0926-010486', 6440.00, 1679.60, 'R$ 6.440,00', 'R$ 1.679,60'),
    ('0926-017427', 1930.00, 1241.31, 'R$ 1.930,00', 'R$ 1.241,31'),
    ('0626-004592', 1294.18, 1599.18, 'R$ 1.294,18', 'R$ 1.599,18'),
    ('0526-019340', null,    500.63,  null,          'R$ 500,63')
  ) v(os, de, para, de_t, para_t) loop
    update obras_obra set valor = r.para, atualizacao = current_date
    where os = r.os and etapa = 'pendFat' and valor is not distinct from r.de;
    get diagnostics n = row_count; if n <> 1 then raise exception 'valor: %', r.os; end if;
    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
      select id, 'Identificação', 'valor', r.de_t, r.para_t,
        'Conciliação SPOT: valor da liberação DPSP de 26/10, validado com o cliente', qm
      from obras_obra where os = r.os;
  end loop;
end $$;
