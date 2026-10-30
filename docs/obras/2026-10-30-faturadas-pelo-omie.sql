-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 30/10/2026, autorizado pelo Jose Guilherme ("pode gravar a 1").
-- Aba "Pendente Financeiro" da conciliação SPOT: obras que o Omie mostra faturadas.
-- Fonte: ConsultarOS/ListarContasReceber do Omie (só leitura). O pedido e as folhas vêm do texto da NF,
-- e o valor da NF bate com o valor da obra (0826-006643 + 0826-011293 = NF 1493, R$ 4.861,79).
-- marco_faturou = data de emissão da NF. Guardas: cada linha precisa casar com exatamente uma obra na etapa esperada.
do $$
declare
  qm text := 'carga-30-10 (Claude, a pedido do Jose Guilherme)';
  nm jsonb := '{"levantamento":"Levantamento","andamento":"Em andamento","fecharOS":"Fechar OS","pendFat":"Pendente faturamento"}';
  r record;
  n int;
begin
  for r in select * from (values
    -- os, etapa atual, NF, pedido, folhas, emissão
    ('0126-021642', 'fecharOS', '921', '4500727838', '1000673780 / 1000673781', date '2026-07-10'),
    ('0126-018429', 'pendFat', '922', '4500727837', '1000673782 / 1000673784', date '2026-07-10'),
    ('0226-014989', 'andamento', '1314', '4500721679', '1000687052 / 1000687053', date '2026-08-20'),
    ('0326-018507', 'pendFat', '1315', '4500739555', '1000687079 / 1000687080', date '2026-08-20'),
    ('0326-018578', 'pendFat', '1316', '4500739557', '1000687061 / 1000687068', date '2026-08-20'),
    ('0326-015760', 'pendFat', '1327', '4500742675', '1000687293 / 1000687294', date '2026-08-21'),
    ('0626-014071', 'pendFat', '1325', '4500742670', '1000687289 / 1000687290', date '2026-08-21'),
    ('0726-009429', 'pendFat', '1372', '4500743457', '1000689554 / 1000689555', date '2026-09-10'),
    ('0826-006643', 'pendFat', '1493', '4500758861', '1000698349 / 1000698350', date '2026-10-13'),
    ('0826-011293', 'pendFat', '1493', '4500758861', '1000698349 / 1000698350', date '2026-10-13'),
    ('TMO136 - TROCA DE CADEADOS', 'levantamento', '1259', '4503262453', null, date '2026-08-07')
  ) v(os, de, nf, ped, fol, em) loop
    update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
      fat_nfse = r.nf, fat_pedido = r.ped, fat_folhas = r.fol, marco_faturou = r.em
    where os = r.os and etapa = r.de;
    get diagnostics n = row_count; if n <> 1 then raise exception 'faturar: % (esperava etapa %)', r.os, r.de; end if;
    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
      select id, 'Esteira', 'etapa', nm->>r.de, 'Faturado',
        format('Conciliação SPOT (aba Financeiro): NF %s de %s no Omie, pedido %s', r.nf, to_char(r.em, 'DD/MM'), r.ped), qm
      from obras_obra where os = r.os;
  end loop;
end $$;
