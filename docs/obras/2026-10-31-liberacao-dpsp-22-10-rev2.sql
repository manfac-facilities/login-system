-- Aplicado em produção (iyytcavcgukfjnjjrerx) em 31/10/2026, a pedido do Jose Guilherme ("pode gravar").
-- Fonte: docs/cliente/2026-10-31-dpsp-liberacao-os-22-10-rev2-ja-faturados.xlsx (aba BASE, filtro da coluna NOTA).
-- NFs 1421/1425/1426/1427 de 06/10 confirmadas no Omie (pedido e folhas pelo texto da NF via ConsultarOS, só leitura).
-- Valores: vale a planilha, já validada com o cliente. 0126-015288 fica com 3.911,99 (NF 1425 saiu com 3.914,99).
-- Ficam em Pendente faturamento as que serão faturadas em 03/11 e a 0826-006388 (liberação não recebida).
do $$
declare
  qm text := 'carga-30-10 (Claude, a pedido do Jose Guilherme)';
  r record;
  n int;
begin
  for r in select * from (values
    ('0626-008725', 2922.24, 3922.64, 'R$ 2.922,24', 'R$ 3.922,64'),
    ('0626-005882', 900.00, 752.50, 'R$ 900,00', 'R$ 752,50'),
    ('0626-005012', 1599.18, 1568.93, 'R$ 1.599,18', 'R$ 1.568,93')
  ) v(os, de, para, de_txt, para_txt) loop
    update obras_obra set valor = r.para, atualizacao = current_date where os = r.os and valor = r.de;
    get diagnostics n = row_count; if n <> 1 then raise exception 'valor: %', r.os; end if;
    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
      select id, 'Identificação', 'valor', r.de_txt, r.para_txt,
        'Liberação DPSP 22/10 rev2 (valor validado com o cliente)', qm
      from obras_obra where os = r.os;
  end loop;

  for r in select * from (values
    ('0526-013810', '1427', '4500758929', '1000695978 / 1000695979'),
    ('0626-004183', '1427', '4500758929', '1000695978 / 1000695979'),
    ('0626-010339', '1427', '4500758929', '1000695978 / 1000695979'),
    ('0726-018751', '1427', '4500758929', '1000695978 / 1000695979'),
    ('0626-008725', '1426', '4500758934', '1000695987 / 1000695989'),
    ('0626-008727', '1426', '4500758934', '1000695987 / 1000695989'),
    ('0126-015288', '1425', '4500758937', '1000695992 / 1000695993'),
    ('0626-005882', '1421', '4500759016', '1000696004 / 1000696005')
  ) v(os, nf, ped, fol) loop
    update obras_obra set etapa = 'faturado', etapa_por = qm, etapa_em = now(), desde_etapa = current_date, atualizacao = current_date,
      fat_nfse = r.nf, fat_pedido = r.ped, fat_folhas = r.fol, marco_faturou = '2026-10-06'
    where os = r.os and etapa = 'pendFat' and fat_nfse is null;
    get diagnostics n = row_count; if n <> 1 then raise exception 'faturar: %', r.os; end if;
    insert into obras_historico (obra_id, bloco, campo, de, para, motivo, quem)
      select id, 'Esteira', 'etapa', 'Pendente faturamento', 'Faturado',
        format('Liberação DPSP 22/10 rev2: NF %s de 06/10 no Omie, pedido %s', r.nf, r.ped), qm
      from obras_obra where os = r.os;
  end loop;
end $$;
