-- ============================================================
-- Controle de Obras — baixa do faturamento vinda do Financeiro — 2026-10-12
-- Spec: financeiro/docs/superpowers/specs/2026-10-12-financeiro-faturamento-etapa3-design.md §5
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor, projeto iyytcavcgukfjnjjrerx.
--
-- O que faz: quando a prefeitura autoriza a NFS-e, o Financeiro (rodada automática,
-- sem usuário logado, chave de serviço) passa as obras da nota para "Faturado" com a
-- MESMA regra da troca de etapa da ficha (`calcularMarcosDaEsteira` em
-- app/obras/obra/[id]/_actions.ts) e grava NFS-e, pedido e folhas de serviço na obra
-- (pedido do Jose, 12/10: "pra gente se achar depois"). Nota cancelada no Omie volta
-- as obras para "Pendente faturamento".
--
-- Por que não `obras_aplicar_alteracao`: ela exige `auth.jwt()` com e-mail e
-- `obras_has_access()` — a rodada do Financeiro não tem usuário.
--
-- Segurança: `security invoker` + execute só para service_role (que já passa por cima
-- da RLS). Nenhum usuário logado chama estas funções. Sem guarda que possa falhar
-- aberto com NULL (armadilha 1 de .claude/rules/sql.md): não há guarda de acesso.
--
-- IDEMPOTENTE: add column if not exists, create or replace function.
-- ============================================================

-- 0. Pré-requisitos (aborta se faltar)
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'obras_historico' and column_name = 'seq') then
    raise exception 'pré-requisito: aplicar sdd-sql-obras-historico.sql antes';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'obras_obra' and column_name = 'cancelado_etapa_anterior') then
    raise exception 'pré-requisito: aplicar sdd-sql-obras-cancelamento.sql antes';
  end if;
end $$;

begin;

-- 1. Rastro do faturamento. Só as funções abaixo escrevem aqui.
alter table public.obras_obra add column if not exists fat_nfse text;
alter table public.obras_obra add column if not exists fat_pedido text;
alter table public.obras_obra add column if not exists fat_folhas text;

-- 2. Marca como faturada. Só obra em pendFat; o resto volta em "puladas".
create or replace function public.obras_marcar_faturada(
  p_obras uuid[], p_nfse text, p_pedido text, p_folhas text, p_data date, p_quem text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_antes public.obras_obra;
  v_depois public.obras_obra;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_quando timestamptz := now();
  v_motivo text;
  v_marcadas jsonb := '[]'::jsonb;
  v_puladas jsonb := '[]'::jsonb;
begin
  if nullif(btrim(p_nfse), '') is null then
    raise exception 'obras_marcar_faturada: NFS-e vazia' using errcode = '22023';
  end if;
  if nullif(btrim(p_quem), '') is null or p_data is null then
    raise exception 'obras_marcar_faturada: quem e data são obrigatórios' using errcode = '22023';
  end if;
  v_motivo := concat_ws(' · ', 'NFS-e ' || btrim(p_nfse),
                        'Pedido ' || nullif(btrim(p_pedido), ''),
                        'Folha(s) ' || nullif(btrim(p_folhas), ''));

  foreach v_id in array coalesce(p_obras, '{}'::uuid[]) loop
    select * into v_antes from public.obras_obra o where o.id = v_id for update;
    if not found or v_antes.etapa is distinct from 'pendFat' then
      v_puladas := v_puladas || jsonb_build_object('id', v_id, 'etapa', v_antes.etapa);
      continue;
    end if;

    -- Mesma conta de calcularMarcosDaEsteira para a nova etapa `faturado`:
    -- marcos de passos anteriores recebem data só se vazios; marco_faturou recebe a
    -- data da autorização; marco_exec_fim recebe hoje se vazio (pós-campo).
    update public.obras_obra o set
      etapa = 'faturado',
      desde_etapa = p_data,
      atualizacao = v_hoje,
      etapa_por = btrim(p_quem),
      etapa_em = v_quando,
      marco_relatorio = coalesce(o.marco_relatorio, v_hoje),
      marco_fechou_os = coalesce(o.marco_fechou_os, v_hoje),
      marco_liberou_fat = coalesce(o.marco_liberou_fat, v_hoje),
      marco_faturou = coalesce(o.marco_faturou, p_data),
      marco_exec_fim = coalesce(o.marco_exec_fim, v_hoje),
      fat_nfse = btrim(p_nfse),
      fat_pedido = nullif(btrim(p_pedido), ''),
      fat_folhas = nullif(btrim(p_folhas), '')
    where o.id = v_id
    returning * into v_depois;

    -- Histórico no formato de app/obras/_lib/historico.ts (formatarValor): etapa pelo
    -- nome de tela, datas dd/mm/aaaa, uma linha por campo que mudou.
    insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
    select v_id, 'Esteira', x.campo, x.de, x.para, v_motivo, btrim(p_quem), v_quando
      from (values
        ('etapa', 'Pendente faturamento', 'Faturado'),
        ('marco_relatorio', to_char(v_antes.marco_relatorio, 'DD/MM/YYYY'), to_char(v_depois.marco_relatorio, 'DD/MM/YYYY')),
        ('marco_fechou_os', to_char(v_antes.marco_fechou_os, 'DD/MM/YYYY'), to_char(v_depois.marco_fechou_os, 'DD/MM/YYYY')),
        ('marco_liberou_fat', to_char(v_antes.marco_liberou_fat, 'DD/MM/YYYY'), to_char(v_depois.marco_liberou_fat, 'DD/MM/YYYY')),
        ('marco_faturou', to_char(v_antes.marco_faturou, 'DD/MM/YYYY'), to_char(v_depois.marco_faturou, 'DD/MM/YYYY')),
        ('marco_exec_fim', to_char(v_antes.marco_exec_fim, 'DD/MM/YYYY'), to_char(v_depois.marco_exec_fim, 'DD/MM/YYYY'))
      ) as x(campo, de, para)
     where x.de is distinct from x.para;

    v_marcadas := v_marcadas || to_jsonb(v_id);
  end loop;

  return jsonb_build_object('marcadas', v_marcadas, 'puladas', v_puladas);
end;
$$;

revoke execute on function public.obras_marcar_faturada(uuid[], text, text, text, date, text) from public, anon, authenticated;
grant execute on function public.obras_marcar_faturada(uuid[], text, text, text, date, text) to service_role;

-- 3. Desmarca (NFS-e cancelada no Omie). Só obra em `faturado` com ESTA NFS-e.
create or replace function public.obras_desmarcar_faturada(p_obras uuid[], p_nfse text, p_quem text)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_id uuid;
  v_antes public.obras_obra;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_quando timestamptz := now();
  v_motivo text;
  v_marcadas jsonb := '[]'::jsonb;
  v_puladas jsonb := '[]'::jsonb;
begin
  if nullif(btrim(p_nfse), '') is null or nullif(btrim(p_quem), '') is null then
    raise exception 'obras_desmarcar_faturada: NFS-e e quem são obrigatórios' using errcode = '22023';
  end if;

  foreach v_id in array coalesce(p_obras, '{}'::uuid[]) loop
    select * into v_antes from public.obras_obra o where o.id = v_id for update;
    if not found or v_antes.etapa is distinct from 'faturado' or v_antes.fat_nfse is distinct from btrim(p_nfse) then
      v_puladas := v_puladas || jsonb_build_object('id', v_id, 'etapa', v_antes.etapa);
      continue;
    end if;
    v_motivo := concat_ws(' · ', 'NFS-e ' || btrim(p_nfse) || ' cancelada no Omie',
                          'Pedido ' || v_antes.fat_pedido, 'Folha(s) ' || v_antes.fat_folhas);

    -- Nova etapa pendFat: marco do passo pendFat (marco_liberou_fat) e marco_faturou
    -- viram nulos (índice >= N); os anteriores ficam.
    update public.obras_obra o set
      etapa = 'pendFat',
      desde_etapa = v_hoje,
      atualizacao = v_hoje,
      etapa_por = btrim(p_quem),
      etapa_em = v_quando,
      marco_liberou_fat = null,
      marco_faturou = null,
      fat_nfse = null,
      fat_pedido = null,
      fat_folhas = null
    where o.id = v_id;

    insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
    select v_id, 'Esteira', x.campo, x.de, x.para, v_motivo, btrim(p_quem), v_quando
      from (values
        ('etapa', 'Faturado', 'Pendente faturamento'),
        ('marco_liberou_fat', to_char(v_antes.marco_liberou_fat, 'DD/MM/YYYY'), null),
        ('marco_faturou', to_char(v_antes.marco_faturou, 'DD/MM/YYYY'), null)
      ) as x(campo, de, para)
     where x.de is distinct from x.para;

    v_marcadas := v_marcadas || to_jsonb(v_id);
  end loop;

  return jsonb_build_object('marcadas', v_marcadas, 'puladas', v_puladas);
end;
$$;

revoke execute on function public.obras_desmarcar_faturada(uuid[], text, text) from public, anon, authenticated;
grant execute on function public.obras_desmarcar_faturada(uuid[], text, text) to service_role;

commit;

-- ============================================================
-- VERIFICAÇÃO (rodar junto; qualquer *** FALHOU *** = não deployar)
-- ============================================================
select item, case when ok then 'OK' else '*** FALHOU ***' end as resultado from (values
  (1, 'coluna fat_nfse', exists (select 1 from information_schema.columns where table_schema='public' and table_name='obras_obra' and column_name='fat_nfse')),
  (2, 'coluna fat_pedido', exists (select 1 from information_schema.columns where table_schema='public' and table_name='obras_obra' and column_name='fat_pedido')),
  (3, 'coluna fat_folhas', exists (select 1 from information_schema.columns where table_schema='public' and table_name='obras_obra' and column_name='fat_folhas')),
  (4, 'marcar existe e é invoker', exists (select 1 from pg_proc where proname='obras_marcar_faturada' and not prosecdef)),
  (5, 'desmarcar existe e é invoker', exists (select 1 from pg_proc where proname='obras_desmarcar_faturada' and not prosecdef)),
  (6, 'authenticated não executa marcar', not has_function_privilege('authenticated', 'public.obras_marcar_faturada(uuid[], text, text, text, date, text)', 'execute')),
  (7, 'anon não executa marcar', not has_function_privilege('anon', 'public.obras_marcar_faturada(uuid[], text, text, text, date, text)', 'execute')),
  (8, 'service_role executa marcar', has_function_privilege('service_role', 'public.obras_marcar_faturada(uuid[], text, text, text, date, text)', 'execute')),
  (9, 'authenticated não executa desmarcar', not has_function_privilege('authenticated', 'public.obras_desmarcar_faturada(uuid[], text, text)', 'execute')),
  (10, 'service_role executa desmarcar', has_function_privilege('service_role', 'public.obras_desmarcar_faturada(uuid[], text, text)', 'execute'))
) as v(item, nome, ok) order by item;
