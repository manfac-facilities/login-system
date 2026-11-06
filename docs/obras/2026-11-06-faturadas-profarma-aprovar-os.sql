-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 06/11/2026, a pedido do Jose Guilherme ("pode conferir no omie e gravar").
-- Correção da carga de 05/11 (2026-11-05-faturadas-profarma-consolidado.sql), que só olhou OS em pendFat:
-- 21 OS da mesma planilha (docs/cliente/2026-11-05-consolidado-financeiro-manfac-profarma.xlsx) estavam em aprovarOS.
-- Conferido no Omie (ListarNFSEs, só leitura, 06/11): as 6 NF autorizadas (F), valor da NF = soma das OS da planilha,
-- pedido da NF = pedido da planilha. marco_faturou = emissão da NF.
--   1027 28/07 R$ 1.145,44 | 1028 28/07 R$ 530,00 | 1496 16/10 R$ 2.811,20 (13 aqui + 2983365 já gravada em 05/11)
--   1498 16/10 R$ 200,80 | 1499 16/10 R$ 401,60 | 1503 16/10 R$ 602,40
-- Conferido depois: soma das OS por NF no hub = valor da NF no Omie nas 6; 20 historicos novos (3018955 sem, ver abaixo).
do $$
declare
  qm text := 'carga-06-11 (Claude, a pedido do Jose Guilherme)';
  r record;
  n int;
begin
  for r in select * from (values
    ('2767867', 530.00, '1028', '4503255570', date '2026-07-28'),
    ('3227877', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3112825', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3108288', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3147597', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3183964', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3215191', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3174050', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3189312', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3123030', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3163062', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3183923', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3212123', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3147017', 200.80, '1496', '4503312274', date '2026-10-16'),
    ('3215921', 200.80, '1498', '4503312336', date '2026-10-16'),
    ('3032545', 200.80, '1499', '4503312280', date '2026-10-16'),
    ('3047605', 200.80, '1499', '4503312280', date '2026-10-16'),
    ('3099670', 200.80, '1503', '4503312286', date '2026-10-16'),
    ('3167169', 200.80, '1503', '4503312286', date '2026-10-16'),
    ('3173631', 200.80, '1503', '4503312286', date '2026-10-16')
  ) v(os, val, nf, ped, em) loop
    update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
      fat_nfse = r.nf, fat_pedido = r.ped, marco_faturou = r.em
    where os = r.os and etapa = 'aprovarOS' and fat_nfse is null and fat_pedido is null and valor = r.val;
    get diagnostics n = row_count; if n <> 1 then raise exception 'faturar: %', r.os; end if;
    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
      select id, 'Esteira', 'etapa', 'Executado - pendente aprovação OS', 'Faturado',
        format('Consolidado Profarma: NF %s de %s no Omie, pedido %s', r.nf, to_char(r.em, 'DD/MM'), r.ped), qm
      from obras_obra where os = r.os;
  end loop;

  -- 3018955: o matheus.oliveira já a moveu para Faturado em 06/11 (marco 06/11, sem NF/pedido).
  -- Só preenche os campos vazios; o marco (emissão real 28/07) fica como ele gravou até o Jose decidir.
  update obras_obra set fat_nfse = '1027', fat_pedido = '4503255566', atualizacao = current_date
  where os = '3018955' and etapa = 'faturado' and fat_nfse is null and fat_pedido is null and valor = 1145.44;
  get diagnostics n = row_count; if n <> 1 then raise exception 'nf 3018955'; end if;
  -- sem linha em obras_historico: o check não tem campo de NF/pedido (mesmo padrão da 0726-012477 em 30/10)
end $$;
