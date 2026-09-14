-- D2 — identidade estável e reconciliação de ausência com o Field Control.
-- ESTADO: APLICADO em produção em 14/09/2026, pela Management API, com autorização do João.

begin;

alter table public.obras_obra
  add column if not exists field_id text,
  add column if not exists field_ausente_desde timestamptz,
  add column if not exists field_ausente_em timestamptz;

create unique index if not exists obras_obra_field_id_unico
  on public.obras_obra (field_id)
  where field_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'obras_obra_field_id_nao_vazio'
      and conrelid = 'public.obras_obra'::regclass
  ) then
    alter table public.obras_obra
      add constraint obras_obra_field_id_nao_vazio
      check (field_id is null or btrim(field_id) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'obras_obra_alerta_field_tem_suspeita'
      and conrelid = 'public.obras_obra'::regclass
  ) then
    alter table public.obras_obra
      add constraint obras_obra_alerta_field_tem_suspeita
      check (field_ausente_em is null or field_ausente_desde is not null);
  end if;
end
$$;

commit;
