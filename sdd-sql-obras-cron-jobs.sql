-- Agendamentos da sincronização automática com o Field — a parte da D3 que ficou
-- de fora de propósito em 14/09.
--
-- ESTADO: NÃO APLICADO.
--
-- Por que só agora: a primeira incremental seria a primeira carga real, e ela
-- esperava a liberação do cliente. A carga aconteceu em 16/09/2026 às 03:11
-- (execução cf98d8d3, 64 obras criadas de 185 OS lidas), então os agendamentos
-- deixaram de ser perigosos.
--
-- Pedido do cliente, 16/09/2026, pelo João: "toda obra nova com tipo de os =
-- atividade spot voce tem que puxar [...] a ideia é ser bem agil (subiu os no
-- fiel o sistema em 5 minutos ou menos já atualiza)".
--
-- FREQUÊNCIA, e o porquê de cada uma:
--
--   incremental  */5 * * * *   lê só o que mudou desde a última marca d'água.
--                              Barata: poucas OS por passada, e cada uma custa
--                              uma consulta de situação no ritmo de 1 req/s que
--                              o Field impõe. Atende o pedido dos 5 minutos.
--
--   completa     5 6 * * *     lê as 185 OS e é a única que detecta OS que sumiu
--                              ou foi arquivada no Field. Custa ~3 minutos de
--                              requisições, o que não se paga a cada 5 minutos.
--                              No minuto 5 para não disputar a trava com a
--                              incremental, que roda no minuto 0.
--
-- PRÉ-REQUISITO: o segredo OBRAS_CRON_SECRET precisa existir no Vault, com o
-- mesmo valor que está no Environment do EasyPanel. Sem ele, o job dispara uma
-- chamada sem Authorization e a rota responde 401, silenciosamente, a cada 5
-- minutos.
--
-- SOBREPOSIÇÃO: a função obras_iniciar_sync_execucao e o índice parcial
-- obras_sync_execucao_uma_rodando já impedem duas execuções simultâneas. Uma
-- passada que demore mais que o intervalo não empilha: a seguinte é recusada
-- pela trava e registra o motivo.
--
-- O pg_cron usa UTC. `cron.schedule` substitui job de mesmo nome, então
-- reaplicar este arquivo não duplica agenda.

select cron.schedule(
  'obras-field-incremental',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := 'https://hub.manfac.com.br/api/obras/sincronizar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || decrypted_secret
      ),
      body := '{"tipo":"incremental"}'::jsonb,
      timeout_milliseconds := 5000
    )
    from vault.decrypted_secrets
    where name = 'OBRAS_CRON_SECRET'
    limit 1;
  $cron$
);

select cron.schedule(
  'obras-field-completa',
  '5 6 * * *',
  $cron$
    select net.http_post(
      url := 'https://hub.manfac.com.br/api/obras/sincronizar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || decrypted_secret
      ),
      body := '{"tipo":"completa"}'::jsonb,
      timeout_milliseconds := 5000
    )
    from vault.decrypted_secrets
    where name = 'OBRAS_CRON_SECRET'
    limit 1;
  $cron$
);

-- VERIFICAÇÃO 1 — os dois jobs existem, ativos, na frequência certa.
-- Esperado: obras-field-incremental */5 * * * * t
--           obras-field-completa    5 6 * * *   t
-- select jobname, schedule, active from cron.job
--   where jobname like 'obras-field-%' order by jobname;

-- VERIFICAÇÃO 2 — o segredo está no cofre (nunca selecione decrypted_secret).
-- Esperado: 1
-- select count(*) from vault.secrets where name = 'OBRAS_CRON_SECRET';

-- VERIFICAÇÃO 3 — depois de 5 a 10 minutos, houve execução de origem agendada.
-- Esperado: linhas com origem = 'agendada' e status 'sucesso'.
-- select tipo, origem, status, novas, ignoradas, erro, iniciada_em
--   from obras_sync_execucao where origem = 'agendada'
--   order by iniciada_em desc limit 5;

-- COMO DESLIGAR, se precisar:
-- select cron.unschedule('obras-field-incremental');
-- select cron.unschedule('obras-field-completa');
