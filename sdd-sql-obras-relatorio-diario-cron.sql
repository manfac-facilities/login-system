-- Relatório diário do Painel gerencial por e-mail.
-- ESTADO: NÃO APLICADO.
-- Spec: docs/relatorio-email/2026-10-08-spec.md (§9)
-- Plano: docs/relatorio-email/2026-10-08-plano.md (T6, T14)
--
-- 1 11 * * * = 08:01 em Brasília (pg_cron em UTC; Brasil sem horário de verão desde 2019).
-- Minuto 1 (não 0) por decisão do João em 08/10/2026 (ajuste do coordenador, item 2).
-- Não disputa trava com a sincronização (rota e tabelas diferentes, a rota só LÊ).
-- timeout 180 s (render ~15 s + envio sequencial + 1 nova tentativa após 60 s): a rota é síncrona de propósito — o status e o corpo da resposta
-- ficam em net._http_response e são o registro do envio (ver spec §3.5).
-- PRÉ-REQUISITO: OBRAS_CRON_SECRET no Vault (já existe desde 16/09) e as
-- variáveis SMTP_* no EasyPanel com deploy feito. Sem SMTP a rota responde 503.

begin;

-- 0. Pré-requisitos: aborta se faltar.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron não instalado';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then
    raise exception 'pg_net não instalado';
  end if;
  if not exists (select 1 from vault.secrets where name = 'OBRAS_CRON_SECRET') then
    raise exception 'OBRAS_CRON_SECRET ausente do Vault';
  end if;
end $$;

select cron.schedule(
  'obras-relatorio-diario',
  '1 11 * * *',
  $cron$
    select net.http_post(
      url := 'https://hub.manfac.com.br/api/obras/relatorio-diario',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || decrypted_secret
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 180000
    )
    from vault.decrypted_secrets
    where name = 'OBRAS_CRON_SECRET'
    limit 1;
  $cron$
);

commit;

-- VERIFICAÇÃO (uma linha por invariante, OK ou *** FALHOU ***)
select 'job existe, ativo, 1 11 * * * (08:01 BRT)' as invariante,
       case when exists (select 1 from cron.job where jobname = 'obras-relatorio-diario'
                          and schedule = '1 11 * * *' and active) then 'OK' else '*** FALHOU ***' end
union all
select 'job aponta para a rota certa',
       case when exists (select 1 from cron.job where jobname = 'obras-relatorio-diario'
                          and command like '%/api/obras/relatorio-diario%') then 'OK' else '*** FALHOU ***' end
union all
select 'jobs da sincronização intactos (2)',
       case when (select count(*) from cron.job where jobname in ('obras-field-incremental','obras-field-completa')
                   and active) = 2 then 'OK' else '*** FALHOU ***' end
union all
select 'segredo no Vault',
       case when exists (select 1 from vault.secrets where name = 'OBRAS_CRON_SECRET') then 'OK' else '*** FALHOU ***' end;

-- CONSULTA ÚTIL — retenção do registro (padrão do pg_net: 6 hours):
-- select current_setting('pg_net.ttl', true);
-- DEPOIS DAS 8h — resultado do envio:
-- select created, status_code, timed_out, error_msg, content
--   from net._http_response order by created desc limit 5;
-- COMO DESLIGAR:
-- select cron.unschedule('obras-relatorio-diario');
