-- ============================================================
-- Controle de Obras — procedência da obra (D1) — 2026-09-11
-- ============================================================
-- ESTADO: NÃO APLICADO. O Duda escreve; o João roda à mão no
-- SQL Editor do Supabase, conforme docs/onboarding-duda/.
--
-- `fonte` não reaproveita `origem`: `origem` é vocabulário livre do
-- cliente ("Sistema DPSP", "Garantia"), enquanto `fonte` responde de
-- qual integração a obra veio. Hoje a única porta ativa é o Field.
--
-- Nullable e sem default de propósito: NULL significa "procedência
-- desconhecida" e não autoriza a futura reconciliação (D2) a marcar
-- uma obra como ausente do Field.
-- ============================================================

begin;

alter table public.obras_obra
  add column if not exists fonte text;

-- Constraint nomeada: quando uma nova porta de entrada realmente existir,
-- o vocabulário muda com um ALTER explícito e auditável.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.obras_obra'::regclass
      and conname = 'obras_obra_fonte_check'
  ) then
    alter table public.obras_obra
      add constraint obras_obra_fonte_check
      check (fonte in ('field'));
  end if;
end
$$;

commit;
