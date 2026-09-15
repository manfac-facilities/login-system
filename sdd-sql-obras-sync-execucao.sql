-- D3 — histórico, marca d'água e trava da sincronização automática do Field.
-- ESTADO: NÃO APLICADO. O João aplica manualmente depois de configurar
-- OBRAS_CRON_SECRET no Vault e de publicar a rota no hub.

begin;

create table if not exists public.obras_sync_execucao (
  id uuid primary key default gen_random_uuid(),
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz,
  tipo text not null,
  origem text not null,
  status text not null default 'rodando',
  erro text,
  criado_por uuid references auth.users(id),
  total_field integer not null default 0,
  novas integer not null default 0,
  atualizadas integer not null default 0,
  inalteradas integer not null default 0,
  ignoradas integer not null default 0,
  suspeitas_ausencia integer not null default 0,
  novos_alertas_ausencia integer not null default 0,
  alertas_removidos integer not null default 0,
  numeros_os_alterados integer not null default 0,
  historicos_herdados integer not null default 0,
  avisos integer not null default 0,
  marca_dagua_nova timestamptz,
  constraint obras_sync_execucao_tipo_check check (tipo in ('completa', 'incremental')),
  constraint obras_sync_execucao_origem_check check (origem in ('agendada', 'botao')),
  constraint obras_sync_execucao_status_check check (status in ('rodando', 'sucesso', 'falhou')),
  constraint obras_sync_execucao_fim_check check (
    (status = 'rodando' and finalizada_em is null)
    or (status <> 'rodando' and finalizada_em is not null)
  )
);

-- A expressão constante permite uma única linha em andamento. A expiração é
-- feita atomicamente pela função abaixo antes de tentar adquirir esta trava.
create unique index if not exists obras_sync_execucao_uma_rodando
  on public.obras_sync_execucao ((true))
  where status = 'rodando';

create index if not exists obras_sync_execucao_mais_recentes
  on public.obras_sync_execucao (iniciada_em desc);

create index if not exists obras_sync_execucao_ultimo_sucesso
  on public.obras_sync_execucao (finalizada_em desc)
  where status = 'sucesso' and marca_dagua_nova is not null;

alter table public.obras_sync_execucao enable row level security;
drop policy if exists "obras sync admin" on public.obras_sync_execucao;
create policy "obras sync admin" on public.obras_sync_execucao for all to authenticated
  using (public.obras_is_admin()) with check (public.obras_is_admin());

create or replace function public.obras_iniciar_sync_execucao(
  p_tipo text,
  p_origem text,
  p_criado_por uuid,
  p_expira_antes timestamptz
)
returns table (execucao_id uuid, marca_dagua_anterior timestamptz)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  if current_user <> 'service_role' and not public.obras_is_admin() then
    raise exception 'Sem permissão para iniciar a sincronização de obras'
      using errcode = '42501';
  end if;

  if p_tipo not in ('completa', 'incremental') or p_origem not in ('agendada', 'botao') then
    raise exception 'Tipo ou origem inválidos para a sincronização de obras'
      using errcode = '22023';
  end if;

  update public.obras_sync_execucao
  set status = 'falhou',
      finalizada_em = now(),
      erro = 'Execução interrompida sem conclusão; trava expirada automaticamente.'
  where status = 'rodando'
    and iniciada_em < p_expira_antes;

  return query
  with nova as (
    insert into public.obras_sync_execucao (tipo, origem, criado_por)
    values (p_tipo, p_origem, p_criado_por)
    on conflict do nothing
    returning id
  )
  select
    nova.id,
    (
      select e.marca_dagua_nova
      from public.obras_sync_execucao e
      where e.status = 'sucesso'
        and e.marca_dagua_nova is not null
      order by e.finalizada_em desc
      limit 1
    )
  from nova;
end
$$;

revoke execute on function public.obras_iniciar_sync_execucao(text, text, uuid, timestamptz)
  from public, anon;
grant execute on function public.obras_iniciar_sync_execucao(text, text, uuid, timestamptz)
  to authenticated, service_role;

-- O pg_cron usa UTC. `cron.schedule` substitui um job de mesmo nome, então
-- reaplicar a migration não duplica agendas. As expressões abaixo são os dois
-- pontos de configuração de frequência.

select cron.schedule(
  'obras-field-incremental',
  '*/15 * * * *',
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
  '0 6 * * *',
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

commit;
