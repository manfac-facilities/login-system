-- Verificação da migration sdd-sql-obras-modalidade-obra.sql (rodar depois de aplicar).
-- Projeto iyytcavcgukfjnjjrerx. Cada consulta traz o valor esperado.

-- 1. colunas novas em obras_obra (esperado 4)
select count(*) from information_schema.columns
 where table_schema='public' and table_name='obras_obra'
   and column_name in ('modalidade','data_base','engenheiro_email','atividade_trava');

-- 2. atividades de Macaé 3 (esperado 28)
select count(*) from public.obras_atividade where obra_id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c';

-- 3. soma dos pesos (esperado 437772.41)
select sum(peso_valor) from public.obras_atividade where obra_id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c';

-- 4. feriados (esperado 10)
select count(*) from public.obras_feriado;

-- 5. obras classificadas como obra (esperado: Macaé 3 / 1026-014683, PLK-NORTESHOP, CDRJ-TELHADO)
select id, os, modalidade, data_base, atividade_trava from public.obras_obra where modalidade = 'obra' order by os;

-- 6. RLS ligada nas 10 tabelas novas (esperado 10 linhas, todas true)
select c.relname, c.relrowsecurity
  from pg_class c join pg_namespace s on s.oid = c.relnamespace
 where s.nspname = 'public'
   and c.relname in ('obras_feriado','obras_cronograma_versao','obras_atividade',
     'obras_atividade_exec','obras_rdo','obras_rdo_avanco','obras_rdo_foto',
     'obras_impedimento','obras_destinatario','obras_envio')
 order by 1;

-- 7. Teste do trigger (não grava nada): esperado ERRO "OBRAS_VERSAO_SALVA ..."
--    Rodar o bloco inteiro de uma vez; o rollback final desfaz tudo.
begin;
  update public.obras_cronograma_versao
     set salva_em = now(), salva_por = 'teste'
   where obra_id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c' and numero = 1;
  update public.obras_atividade set duracao = 9
   where obra_id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c' and numero = 1;   -- deve falhar
rollback;
