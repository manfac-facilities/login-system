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

-- 8. Fix round 1 — policies e triggers novos
-- 8a. policies de escrita em avanço/foto exigem RDO rascunho (esperado: 'obras insert/update/delete' com "rascunho" no texto, 6 linhas)
select tablename, policyname, cmd
  from pg_policies
 where schemaname = 'public' and tablename in ('obras_rdo_avanco','obras_rdo_foto')
   and cmd in ('INSERT','UPDATE','DELETE')
   and (coalesce(qual,'') || coalesce(with_check,'')) like '%rascunho%'
 order by 1, 3;

-- 8b. feriado: escrita só admin (esperado: 3 linhas INSERT/UPDATE/DELETE com obras_is_admin)
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'obras_feriado'
   and cmd in ('INSERT','UPDATE','DELETE')
   and (coalesce(qual,'') || coalesce(with_check,'')) like '%obras_is_admin%';

-- 8c. triggers de autoria (esperado 5) e de imutabilidade (esperado 2)
select tgname from pg_trigger
 where not tgisinternal
   and tgname in ('obras_envio_autor','obras_rdo_autor','obras_impedimento_autor',
                  'obras_versao_autor','obras_atividade_exec_autor',
                  'obras_atividade_imutavel','obras_versao_imutavel')
 order by 1;

-- 8d. versão salva: qualquer UPDATE falha, inclusive no motivo (esperado ERRO OBRAS_VERSAO_SALVA; rollback desfaz)
begin;
  update public.obras_cronograma_versao
     set salva_em = now(), salva_por = 'teste'
   where obra_id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c' and numero = 1;
  update public.obras_cronograma_versao set motivo = 'x'
   where obra_id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c' and numero = 1;   -- deve falhar
rollback;

-- 8e. atividade com obra_id diferente do da versão (esperado ERRO 23514; rollback desfaz)
begin;
  update public.obras_atividade set obra_id = (select id from public.obras_obra where id <> 'a6271663-d342-4669-8c32-f9dd97e8aa7c' limit 1)
   where obra_id = 'a6271663-d342-4669-8c32-f9dd97e8aa7c' and numero = 1;   -- deve falhar
rollback;

-- 8f. de/para fora de 0..1 (esperado ERRO de check; rollback desfaz)
begin;
  insert into public.obras_rdo (obra_id, data) values ('a6271663-d342-4669-8c32-f9dd97e8aa7c', date '2099-01-01');
  insert into public.obras_rdo_avanco (rdo_id, numero, de, para)
    select id, 1, 0, 1.5 from public.obras_rdo where data = date '2099-01-01';   -- deve falhar
rollback;

-- 9. Fix round 2 — máquina de estados do RDO (tudo em begin/rollback; sem JWT, como postgres)
-- 9a. trigger e policy de delete (esperado 1 linha cada)
select tgname from pg_trigger where tgname = 'obras_rdo_estado' and not tgisinternal;
select policyname, qual from pg_policies
 where schemaname = 'public' and tablename = 'obras_rdo' and cmd = 'DELETE';   -- qual contém 'rascunho'

-- 9b. fluxo feliz + travas (esperado: ERRO "OBRAS_RDO_ESTADO" no primeiro update marcado "deve falhar")
begin;
  insert into public.obras_rdo (obra_id, data) values ('a6271663-d342-4669-8c32-f9dd97e8aa7c', date '2099-01-02');
  update public.obras_rdo set estado = 'enviado' where data = date '2099-01-02';   -- deve falhar (pulo)
rollback;

begin;
  insert into public.obras_rdo (obra_id, data) values ('a6271663-d342-4669-8c32-f9dd97e8aa7c', date '2099-01-02');
  update public.obras_rdo set estado = 'validado', validado_por = 'teste' where data = date '2099-01-02';   -- ok
  select estado, validado_por, validado_em is not null as tem_validado_em
    from public.obras_rdo where data = date '2099-01-02';   -- validado | teste | true
  update public.obras_rdo set efetivo = 99 where data = date '2099-01-02';   -- deve falhar (conteúdo imutável)
rollback;

begin;
  insert into public.obras_rdo (obra_id, data) values ('a6271663-d342-4669-8c32-f9dd97e8aa7c', date '2099-01-02');
  update public.obras_rdo set estado = 'validado' where data = date '2099-01-02';
  update public.obras_rdo set estado = 'rascunho' where data = date '2099-01-02';   -- deve falhar (volta)
rollback;

begin;
  insert into public.obras_rdo (obra_id, data) values ('a6271663-d342-4669-8c32-f9dd97e8aa7c', date '2099-01-02');
  update public.obras_rdo set validado_por = 'x' where data = date '2099-01-02';   -- deve falhar (fora da validação)
rollback;
-- (validação por engenheiro/admin com JWT: testar pelo app na Task do RDO)
