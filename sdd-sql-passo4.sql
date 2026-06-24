-- sdd-sql-passo4.sql
-- Multas + Descontos: novos campos, audit_log, ajuste de FK

alter table public.multas
  add column data_recebimento date,
  add column tipo_infracao text,
  alter column descricao drop not null;

alter table public.sinistros
  add column status_desconto text not null default 'pendente';

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  registro_id uuid not null,
  acao text not null check (acao in ('criacao', 'exclusao')),
  dados jsonb not null,
  usuario_email text,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
create policy "authenticated full access" on public.audit_log
  for all to authenticated using (true) with check (true);

alter table public.motorista_documentos
  drop constraint motorista_documentos_multa_id_fkey,
  add constraint motorista_documentos_multa_id_fkey
    foreign key (multa_id) references public.multas(id) on delete set null;
