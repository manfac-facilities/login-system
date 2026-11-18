-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 10/11/2026, a pedido do Jose Guilherme ("pode seguir com o restante").
-- Fonte: docs/cliente/2026-11-10-pendente-faturamento-hub-operacao.xlsx (cruzamento da operação) +
-- docs/cliente/2026-11-05-consolidado-financeiro-manfac-profarma.xlsx. Critério do Jose: pedido x hub; data de PAGAMENTO não entra.
-- Correção da carga de 05/11, que cruzou só pelo número da OS: as linhas "SEM OS" / "VISA" / "EMERGENCIAL" do consolidado
-- ficaram de fora. Casadas aqui por loja + valor + escopo. 2803532 e 3058267 não estavam na lista da operação.
-- 3108137, 3176745, 3190630: pedido só na planilha da operação (versão mais nova do consolidado).
-- Conferido no Omie (ListarNFSEs, só leitura, 10/11): as 9 NF autorizadas (F), valor e pedido batem; 1420 sem pedido no
-- Omie (pedido = planilha). NF 1415: 15 linhas no consolidado somam R$ 25.961,91 = NF. marco_faturou = emissão da NF.
-- VISA995 (paralisada, R$ 2.525,10) fica como está: o pedido 4503312224 vai para a TMO995 - SERVIÇOS ADICIONAIS (decisão do Jose).
-- 3238303: o Jose mandou cancelar (o pedido 4503312269 / NF 1495 é da OS 3238623), mas o gabriel.vidal já a tinha
-- cancelado pelo hub em 10/11 14:36; o 1º envio deste bloco (com o cancelamento) abortou inteiro e nada foi gravado.
-- Rodou só a parte abaixo. Conferido depois: 15 faturadas, 15 históricos; soma por NF = Omie (1415: hub 21.089,29 +
-- 2714566 parte 1415 2.131,60 + 2384534 FML-65 fora do hub 2.741,02 = 25.961,91). 36 Profarma seguem em pendFat.
do $$
declare
  qm text := 'carga-10-11 (Claude, a pedido do Jose Guilherme)';
  r record;
  n int;
begin
  for r in select * from (values
    ('DML51 - TROCA DE DISJUNTOR', 1700.72, '1415', '4503297999', date '2026-09-24'),
    ('DML70 - TROCA DE LUMINÁRIAS', 1300.00, '1415', '4503297999', date '2026-09-24'),
    ('DML81 - TROCA DE LUMINÁRIAS', 1300.00, '1415', '4503297999', date '2026-09-24'),
    ('DML636 - TROCA DE LUMINÁRIAS', 1300.00, '1415', '4503297999', date '2026-09-24'),
    ('DML638 - TROCA DE LUMINÁRIAS', 1300.00, '1415', '4503297999', date '2026-09-24'),
    ('DML641 - TROCA DE LUMINÁRIAS', 1300.00, '1415', '4503297999', date '2026-09-24'),
    ('DML639 - TROCA DE LUMINÁRIAS', 1300.00, '1415', '4503297999', date '2026-09-24'),
    ('VISA141', 22815.31, '1420', '4503298521', date '2026-10-01'),
    ('VISA', 5727.38, '1504', '4503312221', date '2026-10-16'),
    ('TMO995 - SERVIÇOS ADICIONAIS', 2525.10, '1506', '4503312224', date '2026-10-16'),
    ('2803532', 3694.46, '1336', '4503278243', date '2026-08-26'),
    ('3058267', 1660.54, '957', '4503243318', date '2026-07-14'),
    ('3108137', 4706.07, '1519', '4503318169', date '2026-10-23'),
    ('3176745', 1667.70, '1515', '4503318051', date '2026-10-23'),
    ('3190630', 2748.46, '1527', '4503318057', date '2026-10-26')
  ) v(os, val, nf, ped, em) loop
    update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
      fat_nfse = r.nf, fat_pedido = r.ped, marco_faturou = r.em
    where os = r.os and etapa = 'pendFat' and fat_nfse is null and fat_pedido is null and valor = r.val;
    get diagnostics n = row_count; if n <> 1 then raise exception 'faturar: % (% linhas)', r.os, n; end if;
    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
      select id, 'Esteira', 'etapa', 'Pendente faturamento', 'Faturado',
        format('Consolidado Profarma: NF %s de %s no Omie, pedido %s', r.nf, to_char(r.em, 'DD/MM'), r.ped), qm
      from obras_obra where os = r.os and etapa = 'faturado';
  end loop;

end $$;

-- 2ª parte, aplicada em 10/11/2026: o Jose mudou a decisão da VISA995 x TMO995 ("deixa o faturamento na os VISA995
-- (faturamos a obra mas de fato ainda tem algumas pendencias pra finalizar mas foi faturado, inclusive ta no historico a
-- pendencia) e cancela o TMO995 - SERVICOS ADICIONAIS"). Conferido depois: VISA995 faturada com NF 1506 (única OS na nota,
-- R$ 2.525,10 = NF); TMO995 cancelada, sem NF/pedido/marco; 3 históricos novos.
do $$
declare
  qm text := 'carga-10-11 (Claude, a pedido do Jose Guilherme)';
  n int;
begin
  update obras_obra set etapa = 'andamento', fat_nfse = null, fat_pedido = null, marco_faturou = null
  where os = 'TMO995 - SERVIÇOS ADICIONAIS' and etapa = 'faturado' and fat_nfse = '1506' and fat_pedido = '4503312224' and etapa_por = qm;
  get diagnostics n = row_count; if n <> 1 then raise exception 'desfazer TMO995: % linhas', n; end if;
  update obras_obra set etapa = 'cancelado', cancelado_por = 'manfac', cancelado_em = now(), cancelado_quem = qm,
    cancelado_obs = 'Cancelada a pedido do Jose Guilherme: o faturamento (NF 1506, pedido 4503312224) fica na OS VISA995 (estava em Faturado)',
    cancelado_etapa_anterior = 'andamento',
    etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date
  where os = 'TMO995 - SERVIÇOS ADICIONAIS' and etapa = 'andamento';
  get diagnostics n = row_count; if n <> 1 then raise exception 'cancelar TMO995: % linhas', n; end if;
  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
    select id, 'Cancelamento', 'etapa', 'Faturado', 'Cancelada', cancelado_obs, qm from obras_obra where os = 'TMO995 - SERVIÇOS ADICIONAIS';

  update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
    fat_nfse = '1506', fat_pedido = '4503312224', marco_faturou = date '2026-10-16'
  where os = 'VISA995' and etapa = 'paralisado' and fat_nfse is null and fat_pedido is null and valor = 2525.10;
  get diagnostics n = row_count; if n <> 1 then raise exception 'faturar VISA995: % linhas', n; end if;
  insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
    select id, 'Esteira', 'etapa', 'Paralisado', 'Faturado',
      'Consolidado Profarma: NF 1506 de 16/10 no Omie, pedido 4503312224 (faturada com pendências de finalização, ver histórico)', qm
    from obras_obra where os = 'VISA995';
end $$;
