-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 30/10/2026, a pedido do Jose Guilherme.
-- Pedido 4500752900: as liberações da DPSP (docs/cliente/2026-10-30-liberacao-pedido-folha-manfac-{1,2}.xlsx)
-- dizem quais chamados estão em cada NF, e o Omie confirma as NFs (emissão 08/10/2026):
--   NF 1456 = folhas 1000696205 / 1000696207, 23 chamados
--   NF 1457 = folhas 1000693393 / 1000693395, 9 chamados
-- Só os chamados que estão no hub e ainda não estavam faturados. 0726-012477 já estava em Faturado (marco 09/10):
-- só preenche NF, pedido e folhas, sem mexer na data.
do $$
declare
  qm text := 'carga-30-10 (Claude, a pedido do Jose Guilherme)';
  r record;
  n int;
begin
  for r in select * from (values
    ('0626-004570', '1456', '1000696205 / 1000696207'),
    ('0626-010287', '1456', '1000696205 / 1000696207'),
    ('0726-012456', '1456', '1000696205 / 1000696207'),
    ('0726-013342', '1456', '1000696205 / 1000696207'),
    ('0726-017769', '1456', '1000696205 / 1000696207'),
    ('0726-018372', '1456', '1000696205 / 1000696207'),
    ('0726-019109', '1456', '1000696205 / 1000696207'),
    ('0526-008721', '1457', '1000693393 / 1000693395')
  ) v(os, nf, fol) loop
    update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
      fat_nfse = r.nf, fat_pedido = '4500752900', fat_folhas = r.fol, marco_faturou = '2026-10-08'
    where os = r.os and etapa = 'pendFat';
    get diagnostics n = row_count; if n <> 1 then raise exception 'faturar: % (esperava Pendente faturamento)', r.os; end if;
    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
      select id, 'Esteira', 'etapa', 'Pendente faturamento', 'Faturado',
        format('Conciliação SPOT (aba Financeiro): NF %s de 08/10 no Omie, pedido 4500752900 (liberação DPSP)', r.nf), qm
      from obras_obra where os = r.os;
  end loop;

  update obras_obra set fat_nfse = '1456', fat_pedido = '4500752900', fat_folhas = '1000696205 / 1000696207', atualizacao = current_date
  where os = '0726-012477' and etapa = 'faturado' and fat_nfse is null and fat_pedido is null and fat_folhas is null;
  get diagnostics n = row_count; if n <> 1 then raise exception 'faturar: 0726-012477 preencher NF'; end if;
end $$;
