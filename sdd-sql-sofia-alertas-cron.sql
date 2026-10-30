-- E-mail diário de alertas da Gestão de Frotas (Frente C da segunda bateria).
-- ESTADO: NÃO APLICADO. Só aplicar com autorização escrita do João. Projeto iyytcavcgukfjnjjrerx — confirme o ref.
-- Spec: docs/superpowers/specs/2026-10-30-frotas-segunda-bateria-design.md (decisões 5, 6, 11)
--
-- 1 10 * * 1-5 = 07:01 em Brasília, segunda a sexta (pg_cron em UTC; Brasil sem horário de verão desde 2019).
-- Minuto 1, não 0: regra de .claude/rules/sql.md (não usar minuto múltiplo de 5) e mesmo padrão do
-- relatório de Obras (08:01). O e-mail diz "gerado às 07:00".
-- Timeout 120 s: a rota é síncrona; status e corpo da resposta ficam em net._http_response (único registro).
--
-- PRÉ-REQUISITOS, nesta ordem (sem eles a rota responde 503/401 e ninguém recebe):
--   1. SOFIA_ALERTAS_SECRET no Environment do EasyPanel + Deploy clicado (código da rota no ar).
--   2. O MESMO valor no Vault do Supabase, com o nome SOFIA_ALERTAS_SECRET (vault.create_secret, como
--      foi feito com OBRAS_CRON_SECRET). Nunca colar o valor em arquivo versionado.
--   3. SMTP_* já existem no EasyPanel (usadas pelo e-mail de Obras).
--   4. sofia_gestores já aplicado (28/10/2026) e o Igor com linha nela e hub_system_access sofia = true.

begin;

-- 0. Aborta se faltar pré-requisito.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron não instalado';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net não instalado';
  end if;
  if not exists (select 1 from vault.secrets where name = 'SOFIA_ALERTAS_SECRET') then
    raise exception 'SOFIA_ALERTAS_SECRET ausente do Vault';
  end if;
  if to_regclass('public.sofia_gestores') is null then
    raise exception 'sofia_gestores não existe (aplicar sdd-sql-sofia-gestor-frotas.sql antes)';
  end if;
end $$;

select cron.schedule(
  'sofia-alertas-diarios',
  '1 10 * * 1-5',
  $cron$
    select net.http_post(
      url := 'https://hub.manfac.com.br/api/frotas/alertas-diarios',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || decrypted_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    )
    from vault.decrypted_secrets
    where name = 'SOFIA_ALERTAS_SECRET'
    limit 1;
  $cron$
);

commit;

-- VERIFICAÇÃO (uma linha por invariante, OK ou *** FALHOU ***)
select 'job existe, ativo, 1 10 * * 1-5 (07:01 BRT, seg-sex)' as invariante,
       case when exists (select 1 from cron.job where jobname = 'sofia-alertas-diarios'
                          and schedule = '1 10 * * 1-5' and active) then 'OK' else '*** FALHOU ***' end
union all
select 'job aponta para a rota certa',
       case when exists (select 1 from cron.job where jobname = 'sofia-alertas-diarios'
                          and command like '%/api/frotas/alertas-diarios%') then 'OK' else '*** FALHOU ***' end
union all
select 'segredo no Vault',
       case when exists (select 1 from vault.secrets where name = 'SOFIA_ALERTAS_SECRET') then 'OK' else '*** FALHOU ***' end
union all
select 'jobs de Obras intactos (obras-field-incremental, obras-field-completa, obras-relatorio-diario)',
       case when (select count(*) from cron.job where jobname in ('obras-field-incremental','obras-field-completa','obras-relatorio-diario')
                   and active) = 3 then 'OK' else '*** FALHOU ***' end
union all
select 'há ao menos um gestor com acesso ao slug sofia (senão a rota responde 500 sem destinatários)',
       case when exists (select 1 from public.sofia_gestores g
                          join public.hub_system_access a on lower(a.user_email) = lower(g.user_email)
                         where a.system_slug = 'sofia' and a.has_access = true) then 'OK' else '*** FALHOU ***' end;

-- RESULTADO DO ENVIO, depois das 07:01 (retenção do pg_net: select current_setting('pg_net.ttl', true);):
-- select created, status_code, timed_out, error_msg, content
--   from net._http_response order by created desc limit 5;
-- 200 = enviado ("variante" diz com/nada); 500 "falha-avisada" = a montagem quebrou e o aviso de falha foi enviado;
-- 502 = SMTP recusou; 503 = variável do EasyPanel faltando; 401 = segredo do Vault diferente do EasyPanel (a rota fica fora do matcher do middleware, então o 401 vem dela mesma).
--
-- ROLLBACK (desligar):
-- select cron.unschedule('sofia-alertas-diarios');
-- (o segredo no Vault pode ficar; para removê-lo: delete from vault.secrets where name = 'SOFIA_ALERTAS_SECRET';)
