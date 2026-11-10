-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 10/11/2026 via MCP, autorizado pelo Jose Guilherme (valores e datas).
-- Conferido depois: 100 OS em fecharOS com etapa_por carga-10-11; 0 da lista em aprovarOS; 3 já à frente intactas;
-- 240 linhas em obras_historico (etapa 100, os_aprovada_em 100, valor 2, marco_exec_fim 19, marco_relatorio 19); marcos coerentes.
-- Aprovação DPSP de 103 OS do SPOT (pedido do Jose Guilherme em 10/11/2026).
-- Fontes (commitadas antes): docs/cliente/2026-11-10-os-aprovadas-dpsp.xlsx (103 OS, todas em
-- "Executado - pendente aprovação OS") e docs/cliente/2026-11-10-os-aprovadas-dpsp-relatorio-interacoes-desk.xlsx.
-- Regra do Jose: no desk vale a ÚLTIMA interação "Orçamento Aprovado" — a data dela é a data de aprovação;
-- o valor é o da última interação "Aguardando Aprovação" anterior a ela (a aprovada não traz valor).
-- Resultado do cruzamento: 101 valores iguais à planilha/hub; 2 diferentes (Jose: "pode atualizar os valores"):
--   0826-003813 R$ 2.589,08 -> R$ 1.120,92 (orçamento 05/11, aprovado 10/11)
--   1126-008764 R$ 6.937,02 -> R$ 6.843,57 (orçamento 05/11, aprovado 06/11)
-- 0726-019256 (16/09) e 0826-003857 (23/09) já tinham aprovação: troca pela do desk, 10/11 (Jose: "pode atualizar as datas").
-- Fora daqui (já à frente, aprovação 06/11 igual ao desk): 1026-014840 e 1126-009031 (fecharOS), 1026-015503 (pendFat).
-- Etapa -> fecharOS com os mesmos marcos que a ficha grava (calcularMarcosDaEsteira): exec_fim e relatório só se vazios,
-- fechou_os/liberou_fat/faturou nulos. Qualquer OS fora do estado esperado aborta tudo.
do $$
declare
  qm text := 'carga-10-11 (Claude, a pedido do Jose Guilherme)';
  r record;
  o record;
  motivo text;

begin
  for r in select * from (values
    ('1026-006468', 800.96, 800.96, null::date, date '2026-11-10'),
    ('1026-006374', 687.96, 687.96, null::date, date '2026-11-10'),
    ('0826-008396', 982.94, 982.94, null::date, date '2026-11-10'),
    ('0826-006580', 869.94, 869.94, null::date, date '2026-11-10'),
    ('0826-004996', 643.94, 643.94, null::date, date '2026-11-10'),
    ('0826-003813', 2589.08, 1120.92, null::date, date '2026-11-10'),
    ('0726-019100', 643.94, 643.94, null::date, date '2026-11-10'),
    ('0926-017407', 756.94, 756.94, null::date, date '2026-11-10'),
    ('0926-016516', 982.94, 982.94, null::date, date '2026-11-10'),
    ('0926-012611', 1429.12, 1429.12, null::date, date '2026-11-10'),
    ('0826-014414', 918.12, 918.12, null::date, date '2026-11-10'),
    ('0826-007499', 869.94, 869.94, null::date, date '2026-11-10'),
    ('0826-006247', 790.60, 790.60, null::date, date '2026-11-10'),
    ('0826-003857', 884.94, 884.94, date '2026-09-23', date '2026-11-10'),
    ('0726-015202', 766.47, 766.47, null::date, date '2026-11-10'),
    ('0726-017515', 609.45, 609.45, null::date, date '2026-11-10'),
    ('0726-017712', 913.96, 913.96, null::date, date '2026-11-10'),
    ('0726-017988', 722.45, 722.45, null::date, date '2026-11-10'),
    ('0726-018314', 1694.78, 1694.78, null::date, date '2026-11-10'),
    ('0726-018663', 1244.94, 1244.94, null::date, date '2026-11-10'),
    ('0726-018718', 1619.94, 1619.94, null::date, date '2026-11-10'),
    ('0726-018834', 1300.96, 1300.96, null::date, date '2026-11-10'),
    ('0726-019042', 869.94, 869.94, null::date, date '2026-11-10'),
    ('0726-019256', 1043.98, 1043.98, date '2026-09-16', date '2026-11-10'),
    ('0826-004017', 869.94, 869.94, null::date, date '2026-11-10'),
    ('0826-004044', 1293.54, 1293.54, null::date, date '2026-11-10'),
    ('0826-004109', 1244.94, 1244.94, null::date, date '2026-11-10'),
    ('0826-004219', 860.60, 860.60, null::date, date '2026-11-10'),
    ('0826-005626', 963.15, 963.15, null::date, date '2026-11-10'),
    ('0826-009182', 1016.60, 1016.60, null::date, date '2026-11-10'),
    ('0926-010822', 1318.98, 1318.98, null::date, date '2026-11-10'),
    ('0926-011302', 805.60, 805.60, null::date, date '2026-11-10'),
    ('0926-014930', 1344.98, 1344.98, null::date, date '2026-11-10'),
    ('0926-017453', 1187.96, 1187.96, null::date, date '2026-11-10'),
    ('1026-007611', 1031.12, 1031.12, null::date, date '2026-11-10'),
    ('0626-014867', 982.94, 982.94, null::date, date '2026-11-10'),
    ('0826-014224', 756.94, 756.94, null::date, date '2026-11-10'),
    ('0826-005767', 982.94, 982.94, null::date, date '2026-11-10'),
    ('0726-018501', 1095.94, 1095.94, null::date, date '2026-11-10'),
    ('0826-013359', 1031.94, 1031.94, null::date, date '2026-11-10'),
    ('0826-006870', 1369.94, 1369.94, null::date, date '2026-11-10'),
    ('0726-018710', 1174.44, 1174.44, null::date, date '2026-11-10'),
    ('0726-012971', 1024.94, 1024.94, null::date, date '2026-11-10'),
    ('0726-018242', 1470.64, 1470.64, null::date, date '2026-11-10'),
    ('0726-018280', 574.96, 574.96, null::date, date '2026-11-10'),
    ('0726-017822', 982.94, 982.94, null::date, date '2026-11-10'),
    ('1026-010971', 1500.96, 1500.96, null::date, date '2026-11-10'),
    ('1026-010970', 1026.96, 1026.96, null::date, date '2026-11-10'),
    ('1026-010969', 1026.96, 1026.96, null::date, date '2026-11-10'),
    ('1026-010966', 992.47, 992.47, null::date, date '2026-11-10'),
    ('1026-010963', 1026.96, 1026.96, null::date, date '2026-11-10'),
    ('1026-010961', 1580.96, 1580.96, null::date, date '2026-11-10'),
    ('1026-010951', 982.94, 982.94, null::date, date '2026-11-10'),
    ('1026-010942', 1254.94, 1254.94, null::date, date '2026-11-10'),
    ('1026-010939', 1139.96, 1139.96, null::date, date '2026-11-10'),
    ('1026-010935', 1387.96, 1387.96, null::date, date '2026-11-10'),
    ('1026-010929', 1187.96, 1187.96, null::date, date '2026-11-10'),
    ('1026-010920', 766.47, 766.47, null::date, date '2026-11-10'),
    ('0926-017419', 1015.31, 1015.31, null::date, date '2026-11-10'),
    ('0926-008965', 1300.96, 1300.96, null::date, date '2026-11-10'),
    ('1026-007566', 1305.12, 1305.12, null::date, date '2026-11-10'),
    ('1026-007561', 677.56, 677.56, null::date, date '2026-11-10'),
    ('1026-007550', 564.56, 564.56, null::date, date '2026-11-10'),
    ('1026-007542', 1305.12, 1305.12, null::date, date '2026-11-10'),
    ('1026-007533', 1418.12, 1418.12, null::date, date '2026-11-10'),
    ('1026-007532', 1192.12, 1192.12, null::date, date '2026-11-10'),
    ('1026-007531', 1192.12, 1192.12, null::date, date '2026-11-10'),
    ('1026-007529', 1418.12, 1418.12, null::date, date '2026-11-10'),
    ('1026-007528', 1079.12, 1079.12, null::date, date '2026-11-10'),
    ('1026-007527', 1305.12, 1305.12, null::date, date '2026-11-10'),
    ('1026-007526', 1929.12, 1929.12, null::date, date '2026-11-10'),
    ('1026-007521', 1118.98, 1118.98, null::date, date '2026-11-10'),
    ('1026-007519', 1231.98, 1231.98, null::date, date '2026-11-10'),
    ('1026-007425', 1413.96, 1413.96, null::date, date '2026-11-10'),
    ('0826-007682', 1648.80, 1648.80, null::date, date '2026-11-10'),
    ('0826-009369', 609.45, 609.45, null::date, date '2026-11-10'),
    ('0826-010012', 618.98, 618.98, null::date, date '2026-11-10'),
    ('0826-011174', 766.47, 766.47, null::date, date '2026-11-10'),
    ('0826-012111', 1139.96, 1139.96, null::date, date '2026-11-10'),
    ('0826-011701', 948.45, 948.45, null::date, date '2026-11-10'),
    ('0726-019044', 1205.50, 1205.50, null::date, date '2026-11-10'),
    ('0726-019005', 805.12, 805.12, null::date, date '2026-11-10'),
    ('0726-018624', 982.94, 982.94, null::date, date '2026-11-10'),
    ('0726-018452', 692.12, 692.12, null::date, date '2026-11-10'),
    ('0726-018351', 982.94, 982.94, null::date, date '2026-11-10'),
    ('0726-018305', 1095.94, 1095.94, null::date, date '2026-11-10'),
    ('0726-018126', 1190.90, 1190.90, null::date, date '2026-11-10'),
    ('0726-018125', 461.96, 461.96, null::date, date '2026-11-10'),
    ('0726-018009', 895.46, 895.46, null::date, date '2026-11-10'),
    ('0726-017816', 982.94, 982.94, null::date, date '2026-11-10'),
    ('0726-016502', 948.45, 948.45, null::date, date '2026-11-10'),
    ('0826-013245', 911.24, 911.24, null::date, date '2026-11-10'),
    ('0826-008756', 918.52, 918.52, null::date, date '2026-11-10'),
    ('0726-018167', 992.87, 992.87, null::date, date '2026-11-10'),
    ('1125-010536', 4391.40, 4391.40, null::date, date '2026-11-06'),
    ('1126-008764', 6937.02, 6843.57, null::date, date '2026-11-06'),
    ('1126-008269', 175.66, 175.66, null::date, date '2026-11-06'),
    ('1026-005630', 2100.00, 2100.00, null::date, date '2026-11-06'),
    ('1126-008722', 4084.27, 4084.27, null::date, date '2026-11-06'),
    ('0826-007943', 869.94, 869.94, null::date, date '2026-11-06')
  ) v(os, val_atual, val_novo, aprov_atual, dt) loop
    select * into o from obras_obra
    where os = r.os and modalidade = 'spot' and cliente = 'DPSP' and etapa = 'aprovarOS'
      and valor = r.val_atual and aprovacao is not distinct from r.aprov_atual
    for update;
    if not found then raise exception 'estado inesperado: %', r.os; end if;
    motivo := format('Aprovação DPSP no desk em %s', to_char(r.dt, 'DD/MM/YYYY'));

    update obras_obra set
      aprovacao = r.dt, os_aprovada = true, marco_os_aprov = r.dt, valor = r.val_novo,
      etapa = 'fecharOS', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
      marco_exec_fim = coalesce(marco_exec_fim, current_date), marco_relatorio = coalesce(marco_relatorio, current_date),
      marco_fechou_os = null, marco_liberou_fat = null, marco_faturou = null
    where id = o.id;

    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem) values
      (o.id, 'Autorização', 'os_aprovada_em', to_char(o.aprovacao, 'DD/MM/YYYY'), to_char(r.dt, 'DD/MM/YYYY'), motivo, qm),
      (o.id, 'Esteira', 'etapa', 'Executado - pendente aprovação OS', 'Fechar OS', motivo, qm);
    if r.val_novo <> r.val_atual then
      insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem) values
        (o.id, 'Identificação', 'valor', 'R$ ' || translate(to_char(r.val_atual, 'FM999,999,990.00'), ',.', '.,'), 'R$ ' || translate(to_char(r.val_novo, 'FM999,999,990.00'), ',.', '.,'),
         motivo || ' (valor do último orçamento)', qm);
    end if;
    if o.marco_exec_fim is null then
      insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
        values (o.id, 'Esteira', 'marco_exec_fim', null, to_char(current_date, 'DD/MM/YYYY'), motivo, qm);
    end if;
    if o.marco_relatorio is null then
      insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
        values (o.id, 'Esteira', 'marco_relatorio', null, to_char(current_date, 'DD/MM/YYYY'), motivo, qm);
    end if;
    if o.marco_fechou_os is not null or o.marco_liberou_fat is not null or o.marco_faturou is not null then
      raise exception 'marco de passo futuro preenchido: %', r.os;
    end if;
  end loop;
end $$;
