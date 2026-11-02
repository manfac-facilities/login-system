-- ============================================================
-- OBRAS — Financeiro da OS no SPOT e faturamento parcial (01/11/2026)
-- Spec: docs/superpowers/specs/2026-11-01-obras-spot-financeiro-design.md §3.2 e §4.
-- Plano: docs/superpowers/plans/2026-11-01-obras-spot-financeiro.md, Task 1.
--
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor, projeto iyytcavcgukfjnjjrerx,
-- ANTES do deploy do app. Ordem: este SQL -> Financeiro 045 -> app do Financeiro (logo
-- depois da 045) -> docs/obras/2026-11-01-macae2-nf735.sql -> app do hub. Depois, o teste de comportamento
-- docs/obras/2026-11-01-verificacao-obras-spot-financeiro.sql (rollback).
--
-- TERRITÓRIO DE DINHEIRO + AUTORIZAÇÃO (AGENTS.md): toda dúvida falha FECHADA.
-- Nenhuma escrita, coluna, FK, trigger ou policy em cmp_*, fin_*, frn_*.
--
-- O QUE FAZ
--   1. obras_pode_ver_valores(p_obra): obra SPOT (modalidade = 'spot') passa a ser
--      visível a quem tem acesso ao Obras — DENTRO do bloco que já exige e-mail no
--      JWT e obras_has_access() is true. OBRA (modalidade 'obra') sem mudança.
--   2. obras_pode_marcar_locacao(p_obra) -> boolean (nunca NULL) = engenheiro da
--      obra/mãe ou admin (obras_engenheiro_ou_admin_mae) OU (obra SPOT existente E
--      e-mail no JWT E obras_has_access() is true). No SPOT é QUALQUER usuário do
--      Obras, não "o analista": obras_obra.pcm e obras_pessoa.email são editáveis por
--      qualquer usuário do Obras (policy "obras access"), então uma guarda por analista
--      seria forjável — fallback da spec §4.2, registrado em docs/DIVIDAS.md. Substitui
--      obras_engenheiro_ou_admin_mae no gatilho obras_locacao_estado_guarda e nas
--      policies "obras engenheiro insert"/"obras engenheiro update" (mesmos nomes).
--   3. obras_nota_externa: NF emitida FORA do módulo de faturamento do Financeiro
--      (obra, nfse, emitida_em, valor_centavos > 0, pedido, obs, autoria), única
--      por (obra, nfse). Lê: obras_pode_ver_valores(obra). Insere/apaga: só
--      administrador (criado_por = e-mail do JWT). Sem update.
--   4. obras_spot_faturado_centavos(p_obra) -> bigint: soma da PARTE da obra
--      (fin_fat_nota_obras.valor_centavos; nula = total da nota, como no Financeiro) nas notas vivas de produção
--      (situacao autorizada|enviada e obras_devolvidas_em nulo — a mesma regra de
--      contaNaReceita em app/obras/obras/_lib/financeiro-tela.ts) + soma das notas
--      externas. Só service_role (uso interno de marcar/desmarcar).
--   5. obras_marcar_faturada (mesma assinatura): obra SPOT com valor em pendFat
--      acrescenta a NFS-e à lista fat_nfse ("735, 812", sem repetir) e só passa a
--      'faturado' quando o faturado >= round(valor * 100); senão fica em pendFat,
--      grava histórico ('Esteira' / 'faturamento parcial' / 'R$ a de R$ b') e volta
--      em "parciais". Retorno: {marcadas, puladas, parciais:[{id, faturado_centavos,
--      falta_centavos}]} (parciais sempre presente). OBRA e SPOT sem valor: igual a hoje.
--      SPOT: fat_pedido/fat_folhas guardam o último valor não vazio.
--   6. obras_desmarcar_faturada (mesma assinatura): SPOT tira a NFS-e da lista
--      (em qualquer posição). Estava faturado e o faturado recalculado < valor (ou
--      sem valor): volta a pendFat como hoje. Senão (faturado que continua coberto,
--      ou pendFat parcial): só atualiza a lista e grava histórico. OBRA: igual a hoje.
--      Retorno {marcadas, puladas}: no SPOT a obra vai em "marcadas" sempre que a
--      NFS-e estava na lista — também quando continua faturado ou só a lista mudou
--      (pendFat parcial). "puladas" = obra inexistente, etapa fora de
--      faturado/pendFat ou NFS-e fora da lista.
--   7. obras_historico_campo_check aceita o campo 'faturamento parcial'.
--   8. obras_reais_txt(bigint) -> 'R$ 1.234,56' (formato do histórico).
--
-- CHAMADOR: o Financeiro (chave de serviço) chama marcar DEPOIS de a NFS-e estar
-- autorizada (a nota já conta na soma) e desmarcar DEPOIS de marcá-la cancelada
-- (a nota já não conta). marcar/desmarcar/faturado: execute só service_role.
--
-- IDEMPOTENTE: create table if not exists, create or replace, drop ... if exists.
-- ARMADILHAS DO .claude/rules/sql.md: guardas usam `is not true`; funções de
-- autorização devolvem coalesce(..., false).
--
-- ROLLBACK (só depois de reverter o app):
--   reaplicar a seção 2 de sdd-sql-obras-financeiro-a.sql (obras_pode_ver_valores);
--   reaplicar o gatilho e as policies de obras_locacao_estado da seção 4 de
--     sdd-sql-obras-financeiro-bc.sql; depois
--     drop function public.obras_pode_marcar_locacao(uuid);
--   reaplicar as seções 2 e 3 de sdd-sql-obras-faturamento.sql (marcar/desmarcar); depois
--     drop function public.obras_spot_faturado_centavos(uuid), public.obras_reais_txt(bigint);
--   drop table public.obras_nota_externa;   -- apaga dados (exportar antes)
--   o campo 'faturamento parcial' no check só pode sair sem linha com ele no histórico.
-- ============================================================

begin;

-- ============================================================
-- 0. Pré-requisitos (aborta se faltar; nada é alterado)
-- ============================================================
do $$
declare
  v_def text;
  v_campos text[];
  v_esperado text[] := array[
    'pcm','equipe','prioridade','inicio_plan','duracao',
    'liberado_por','liberado_em','os_aprovada_em',
    'tipo','valor','origem','analista_cliente','mau_uso',
    'etapa','marco_exec_fim','marco_relatorio','marco_fechou_os',
    'marco_liberou_fat','marco_faturou',
    'diario_agendado_ate',
    'modalidade'];
begin
  if to_regprocedure('public.obras_fin_notas(uuid)') is null
     or to_regprocedure('public.obras_pode_ver_valores(uuid)') is null
     or to_regprocedure('public.obras_engenheiro_ou_admin_mae(uuid)') is null
     or to_regclass('public.obras_locacao_estado') is null
     or to_regprocedure('public.obras_locacao_estado_guarda()') is null then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-financeiro-a.sql e sdd-sql-obras-financeiro-bc.sql (obras_fin_notas, obras_locacao_estado) não estão aplicados. Nada foi alterado.';
  end if;
  if to_regprocedure('public.obras_marcar_faturada(uuid[], text, text, text, date, text)') is null
     or to_regprocedure('public.obras_desmarcar_faturada(uuid[], text, text)') is null
     or (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'obras_obra'
            and column_name in ('fat_nfse', 'fat_pedido', 'fat_folhas', 'modalidade', 'valor')) <> 5 then
    raise exception 'Pré-requisito ausente: sdd-sql-obras-faturamento.sql / modalidade (obras_marcar_faturada, obras_obra.fat_*). Nada foi alterado.';
  end if;
  if (select count(*) from information_schema.columns
          where table_schema = 'public'
            and ((table_name = 'fin_fat_nota_obras' and column_name in ('nota_id', 'obra_id', 'valor_centavos'))
              or (table_name = 'fin_fat_notas' and column_name in ('id', 'ambiente', 'situacao', 'obras_devolvidas_em')))) <> 7 then
    raise exception 'Pré-requisito ausente: colunas de fin_fat_notas/fin_fat_nota_obras. Nada foi alterado.';
  end if;

  -- O check de campo é recriado com a lista inteira: tem de estar no estado de
  -- sdd-sql-obras-modalidade-obra.sql (ou já com 'faturamento parcial', se reaplicado).
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.obras_historico'::regclass and conname = 'obras_historico_campo_check';
  select array_agg(m[1] order by m[1]) into v_campos
    from regexp_matches(coalesce(v_def, ''), '''([^'']+)''', 'g') as m;
  if v_campos is distinct from (select array_agg(x order by x) from unnest(v_esperado) x)
     and v_campos is distinct from (select array_agg(x order by x) from unnest(v_esperado || 'faturamento parcial'::text) x) then
    raise exception 'obras_historico_campo_check não está no estado esperado (%). Nada foi alterado.', v_def;
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.obras_historico'::regclass and conname = 'obras_historico_bloco_check'
                    and pg_get_constraintdef(oid) like '%''Esteira''%') then
    raise exception 'obras_historico_bloco_check não aceita Esteira. Nada foi alterado.';
  end if;
end $$;

-- ============================================================
-- 1. obras_pode_ver_valores(p_obra) — nunca NULL; falha fechada; SPOT para quem
--    tem acesso ao Obras (dentro das exigências de e-mail e acesso)
-- ============================================================
create or replace function public.obras_pode_ver_valores(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with eu as (select nullif(lower(trim(auth.jwt() ->> 'email')), '') as email)
  select coalesce((
    select true
      from eu
      join public.obras_obra o on o.id = p_obra
      left join public.obras_obra m on m.id = o.obra_pai_id
     where eu.email is not null
       and public.obras_has_access() is true
       and (public.obras_is_admin() is true
            or o.modalidade = 'spot'
            or eu.email = nullif(lower(trim(o.engenheiro_email)), '')
            or eu.email = nullif(lower(trim(m.engenheiro_email)), '')
            or exists (select 1 from public.fin_papeis f
                        where f.ativo is true
                          and f.revogado_em is null
                          and f.papel in ('financeiro', 'diretor')
                          and lower(trim(f.user_email)) = eu.email))
  ), false);
$$;
revoke execute on function public.obras_pode_ver_valores(uuid) from public, anon;
grant execute on function public.obras_pode_ver_valores(uuid) to authenticated, service_role;

-- ============================================================
-- 2. Locação no SPOT: qualquer usuário do Obras (ver o cabeçalho, item 2)
-- ============================================================
create or replace function public.obras_pode_marcar_locacao(p_obra uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    public.obras_engenheiro_ou_admin_mae(p_obra) is true
    or (nullif(lower(trim(auth.jwt() ->> 'email')), '') is not null
        and public.obras_has_access() is true
        and exists (select 1 from public.obras_obra o where o.id = p_obra and o.modalidade = 'spot')),
    false);
$$;
revoke execute on function public.obras_pode_marcar_locacao(uuid) from public, anon;
-- authenticated executa: as policies abaixo rodam como o usuário.
grant execute on function public.obras_pode_marcar_locacao(uuid) to authenticated, service_role;

-- Gatilho: IDÊNTICO ao de sdd-sql-obras-financeiro-bc.sql §4, só a guarda e a mensagem mudam.
create or replace function public.obras_locacao_estado_guarda() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  v_fim_atual date;
begin
  if tg_op = 'DELETE' then
    -- Cascata da obra apagada passa (obra só é apagada por admin ou sem JWT).
    if v_email is not null
       and exists (select 1 from public.obras_obra o where o.id = old.obra_id)
       and public.obras_is_admin() is not true then
      raise exception 'OBRAS_LOCACAO: só administrador apaga o estado da locação' using errcode = '42501';
    end if;
    return old;
  end if;

  if v_email is not null and public.obras_pode_marcar_locacao(new.obra_id) is not true then
    raise exception 'OBRAS_LOCACAO: só o engenheiro da obra, quem tem acesso ao Obras (no SPOT) ou administrador marca a locação'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    -- Qualquer role: o pedido existe, foi EMITIDO, é de LOCAÇÃO e a solicitação é desta obra.
    if not exists (
         select 1
           from public.cmp_pedidos p
           join public.cmp_solicitacoes s on s.id = p.solicitacao_id
          where p.id = new.cmp_pedido_id
            and p.ambiente = 'producao'
            and p.situacao = 'emitido'
            and s.ambiente = 'producao'
            and s.tipo = 'locacao'
            and s.obra_id = new.obra_id) then
      raise exception 'OBRAS_LOCACAO: o pedido não existe, não foi emitido, não é de locação ou não é desta obra'
        using errcode = '23514';
    end if;
  end if;

  -- renovada_ate depois do fim atual (locacao_fim do Compras, ou o dia da entrega).
  if new.renovada_ate is not null
     and (tg_op = 'INSERT' or new.renovada_ate is distinct from old.renovada_ate) then
    select coalesce(s.locacao_fim, (p.entrega_em at time zone 'America/Sao_Paulo')::date) into v_fim_atual
      from public.cmp_pedidos p
      join public.cmp_solicitacoes s on s.id = p.solicitacao_id
     where p.id = new.cmp_pedido_id;
    if v_fim_atual is not null and new.renovada_ate <= v_fim_atual then
      raise exception 'OBRAS_LOCACAO: renovada até tem de ser depois do fim atual da locação (%)', v_fim_atual
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.criado_por := v_email;
    new.criado_em := now();
    new.atualizado_por := null;
    new.atualizado_em := null;
    return new;
  end if;

  -- UPDATE: pedido e obra imutáveis (o vínculo foi conferido no INSERT); autoria fica.
  if new.id is distinct from old.id
     or new.cmp_pedido_id is distinct from old.cmp_pedido_id
     or new.obra_id is distinct from old.obra_id then
    raise exception 'OBRAS_LOCACAO: id, cmp_pedido_id e obra_id são imutáveis' using errcode = 'P0001';
  end if;
  new.criado_por := old.criado_por;
  new.criado_em := old.criado_em;
  new.atualizado_por := v_email;
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function public.obras_locacao_estado_guarda() from public, anon, authenticated;

drop policy if exists "obras engenheiro insert" on public.obras_locacao_estado;
create policy "obras engenheiro insert" on public.obras_locacao_estado for insert to authenticated
  with check (public.obras_pode_marcar_locacao(obra_id));
drop policy if exists "obras engenheiro update" on public.obras_locacao_estado;
create policy "obras engenheiro update" on public.obras_locacao_estado for update to authenticated
  using (public.obras_pode_marcar_locacao(obra_id))
  with check (public.obras_pode_marcar_locacao(obra_id));

-- ============================================================
-- 3. obras_nota_externa — NF emitida fora do módulo de faturamento
-- ============================================================
create table if not exists public.obras_nota_externa (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  nfse text not null,
  emitida_em date not null,
  valor_centavos bigint not null check (valor_centavos > 0),
  pedido text,
  obs text,
  criado_por text not null default nullif(lower(trim(auth.jwt() ->> 'email')), ''),
  criado_em timestamptz not null default now(),
  constraint obras_nota_externa_obra_nfse_key unique (obra_id, nfse)
);

alter table public.obras_nota_externa enable row level security;
drop policy if exists "obras valores select" on public.obras_nota_externa;
create policy "obras valores select" on public.obras_nota_externa for select to authenticated
  using (public.obras_pode_ver_valores(obra_id));
-- Insere só administrador, e a autoria é o próprio e-mail do JWT.
drop policy if exists "obras admin insert" on public.obras_nota_externa;
create policy "obras admin insert" on public.obras_nota_externa for insert to authenticated
  with check ((select public.obras_is_admin()) is true
              and criado_por = nullif(lower(trim((select auth.jwt()) ->> 'email')), ''));
drop policy if exists "obras admin delete" on public.obras_nota_externa;
create policy "obras admin delete" on public.obras_nota_externa for delete to authenticated
  using ((select public.obras_is_admin()));
-- Sem policy de update (nota errada: apaga e lança de novo).
revoke all on public.obras_nota_externa from anon;
revoke update, truncate on public.obras_nota_externa from authenticated;

-- ============================================================
-- 4. Faturado do SPOT (centavos) e formato R$ do histórico — só uso interno
-- ============================================================
create or replace function public.obras_spot_faturado_centavos(p_obra uuid)
returns bigint
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  -- Parte nula = total da nota (mesma regra do Financeiro).
  select coalesce((select sum(coalesce(nob.valor_centavos, n.valor_total_centavos))
                     from public.fin_fat_nota_obras nob
                     join public.fin_fat_notas n on n.id = nob.nota_id
                    where nob.obra_id = p_obra
                      and n.ambiente = 'producao'
                      and n.situacao in ('autorizada', 'enviada')
                      and n.obras_devolvidas_em is null), 0)::bigint
       + coalesce((select sum(e.valor_centavos)
                     from public.obras_nota_externa e
                    where e.obra_id = p_obra), 0)::bigint;
$$;
revoke execute on function public.obras_spot_faturado_centavos(uuid) from public, anon, authenticated;
grant execute on function public.obras_spot_faturado_centavos(uuid) to service_role;

create or replace function public.obras_reais_txt(p_centavos bigint)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select 'R$ ' || replace(replace(replace(to_char(p_centavos / 100.0, 'FM999,999,999,990.00'), ',', 'X'), '.', ','), 'X', '.');
$$;
revoke execute on function public.obras_reais_txt(bigint) from public, anon, authenticated;
grant execute on function public.obras_reais_txt(bigint) to service_role;

-- ============================================================
-- 5. obras_historico aceita o campo 'faturamento parcial'
--    (lista de sdd-sql-obras-modalidade-obra.sql + o campo novo; a seção 0 conferiu)
-- ============================================================
alter table public.obras_historico drop constraint if exists obras_historico_campo_check;
alter table public.obras_historico add constraint obras_historico_campo_check
  check (campo in (
    'pcm','equipe','prioridade','inicio_plan','duracao',
    'liberado_por','liberado_em','os_aprovada_em',
    'tipo','valor','origem','analista_cliente','mau_uso',
    'etapa','marco_exec_fim','marco_relatorio','marco_fechou_os',
    'marco_liberou_fat','marco_faturou',
    'diario_agendado_ate',
    'modalidade',
    'faturamento parcial'
  ));

-- ============================================================
-- 6. Marca como faturada. Só obra em pendFat; o resto volta em "puladas".
--    SPOT com valor: só fatura quando a soma das notas cobre o valor.
-- ============================================================
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
  v_nfse text := btrim(p_nfse);
  v_motivo text;
  v_spot boolean;
  v_ja boolean;
  v_lista text;
  v_alvo bigint;
  v_faturado bigint;
  v_marcadas jsonb := '[]'::jsonb;
  v_puladas jsonb := '[]'::jsonb;
  v_parciais jsonb := '[]'::jsonb;
begin
  if nullif(v_nfse, '') is null then
    raise exception 'obras_marcar_faturada: NFS-e vazia' using errcode = '22023';
  end if;
  if nullif(btrim(p_quem), '') is null or p_data is null then
    raise exception 'obras_marcar_faturada: quem e data são obrigatórios' using errcode = '22023';
  end if;
  v_motivo := concat_ws(' · ', 'NFS-e ' || v_nfse,
                        'Pedido ' || nullif(btrim(p_pedido), ''),
                        'Folha(s) ' || nullif(btrim(p_folhas), ''));

  foreach v_id in array coalesce(p_obras, '{}'::uuid[]) loop
    select * into v_antes from public.obras_obra o where o.id = v_id for update;
    if not found or v_antes.etapa is distinct from 'pendFat' then
      v_puladas := v_puladas || jsonb_build_object('id', v_id, 'etapa', v_antes.etapa);
      continue;
    end if;

    -- SPOT com valor: fat_nfse é a LISTA das notas ("735, 812"), sem repetir.
    v_spot := v_antes.modalidade = 'spot' and v_antes.valor is not null;
    if v_spot then
      v_ja := v_nfse = any (select btrim(x) from unnest(string_to_array(v_antes.fat_nfse, ',')) x);
      v_lista := case when nullif(btrim(v_antes.fat_nfse), '') is null then v_nfse
                      when v_ja then v_antes.fat_nfse
                      else v_antes.fat_nfse || ', ' || v_nfse end;
      v_alvo := round(v_antes.valor * 100)::bigint;
      v_faturado := public.obras_spot_faturado_centavos(v_id);

      if v_faturado < v_alvo then
        -- Parcial: fica em pendFat; guarda a nota e o último pedido/folhas não vazios.
        update public.obras_obra o set
          atualizacao = v_hoje,
          fat_nfse = v_lista,
          fat_pedido = coalesce(nullif(btrim(p_pedido), ''), o.fat_pedido),
          fat_folhas = coalesce(nullif(btrim(p_folhas), ''), o.fat_folhas)
        where o.id = v_id;

        -- A mesma NFS-e chamada de novo (nova tentativa) não repete o histórico.
        if v_ja is not true then
          insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
          values (v_id, 'Esteira', 'faturamento parcial', null,
                  public.obras_reais_txt(v_faturado) || ' de ' || public.obras_reais_txt(v_alvo),
                  v_motivo, btrim(p_quem), v_quando);
        end if;

        v_parciais := v_parciais || jsonb_build_object('id', v_id, 'faturado_centavos', v_faturado,
                                                       'falta_centavos', v_alvo - v_faturado);
        continue;
      end if;
    end if;

    -- Mesma conta de calcularMarcosDaEsteira para a nova etapa `faturado`:
    -- marcos de passos anteriores recebem data só se vazios; marco_faturou recebe a
    -- data da autorização (no SPOT, a da nota que fechou a soma); marco_exec_fim
    -- recebe hoje se vazio (pós-campo).
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
      fat_nfse = case when v_spot then v_lista else v_nfse end,
      fat_pedido = case when v_spot then coalesce(nullif(btrim(p_pedido), ''), o.fat_pedido)
                        else nullif(btrim(p_pedido), '') end,
      fat_folhas = case when v_spot then coalesce(nullif(btrim(p_folhas), ''), o.fat_folhas)
                        else nullif(btrim(p_folhas), '') end
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

  return jsonb_build_object('marcadas', v_marcadas, 'puladas', v_puladas, 'parciais', v_parciais);
end;
$$;

revoke execute on function public.obras_marcar_faturada(uuid[], text, text, text, date, text) from public, anon, authenticated;
grant execute on function public.obras_marcar_faturada(uuid[], text, text, text, date, text) to service_role;

-- ============================================================
-- 7. Desmarca (NFS-e cancelada no Omie).
--    OBRA: só obra em `faturado` com ESTA NFS-e (igual a hoje).
--    SPOT: obra em `faturado` ou `pendFat` com a NFS-e EM QUALQUER POSIÇÃO da lista.
-- ============================================================
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
  v_nfse text := btrim(p_nfse);
  v_motivo text;
  v_spot boolean;
  v_lista text;
  v_alvo bigint;
  v_faturado bigint;
  v_marcadas jsonb := '[]'::jsonb;
  v_puladas jsonb := '[]'::jsonb;
begin
  if nullif(v_nfse, '') is null or nullif(btrim(p_quem), '') is null then
    raise exception 'obras_desmarcar_faturada: NFS-e e quem são obrigatórios' using errcode = '22023';
  end if;

  foreach v_id in array coalesce(p_obras, '{}'::uuid[]) loop
    select * into v_antes from public.obras_obra o where o.id = v_id for update;
    v_spot := found and v_antes.modalidade = 'spot';
    if not found
       or (v_spot is not true
           and (v_antes.etapa is distinct from 'faturado' or v_antes.fat_nfse is distinct from v_nfse))
       or (v_spot
           and ((v_antes.etapa in ('faturado', 'pendFat')) is not true
                or (v_nfse = any (select btrim(x) from unnest(string_to_array(v_antes.fat_nfse, ',')) x)) is not true)) then
      v_puladas := v_puladas || jsonb_build_object('id', v_id, 'etapa', v_antes.etapa);
      continue;
    end if;
    v_motivo := concat_ws(' · ', 'NFS-e ' || v_nfse || ' cancelada no Omie',
                          'Pedido ' || v_antes.fat_pedido, 'Folha(s) ' || v_antes.fat_folhas);

    if v_spot then
      -- A lista sem esta NFS-e (ordem mantida; vazia vira NULL).
      v_lista := nullif(array_to_string(array(
                   select btrim(x.v)
                     from unnest(string_to_array(v_antes.fat_nfse, ',')) with ordinality as x(v, i)
                    where btrim(x.v) <> v_nfse and btrim(x.v) <> ''
                    order by x.i), ', '), '');
      v_faturado := public.obras_spot_faturado_centavos(v_id);
      v_alvo := round(v_antes.valor * 100)::bigint;

      -- pendFat parcial, ou faturado que continua coberto: só a lista muda.
      if v_antes.etapa = 'pendFat' or (v_alvo is not null and v_faturado >= v_alvo) then
        update public.obras_obra o set
          atualizacao = v_hoje,
          fat_nfse = v_lista,
          fat_pedido = case when v_lista is null then null else o.fat_pedido end,
          fat_folhas = case when v_lista is null then null else o.fat_folhas end
        where o.id = v_id;

        insert into public.obras_historico (obra_id, bloco, campo, de, para, motivo, quem, created_at)
        values (v_id, 'Esteira', 'faturamento parcial', null,
                case when v_alvo is null then public.obras_reais_txt(v_faturado)
                     else public.obras_reais_txt(v_faturado) || ' de ' || public.obras_reais_txt(v_alvo) end,
                v_motivo, btrim(p_quem), v_quando);

        v_marcadas := v_marcadas || to_jsonb(v_id);
        continue;
      end if;
    end if;

    -- Nova etapa pendFat: marco do passo pendFat (marco_liberou_fat) e marco_faturou
    -- viram nulos (índice >= N); os anteriores ficam. SPOT guarda as notas que sobraram.
    update public.obras_obra o set
      etapa = 'pendFat',
      desde_etapa = v_hoje,
      atualizacao = v_hoje,
      etapa_por = btrim(p_quem),
      etapa_em = v_quando,
      marco_liberou_fat = null,
      marco_faturou = null,
      fat_nfse = case when v_spot then v_lista end,
      fat_pedido = case when v_spot and v_lista is not null then o.fat_pedido end,
      fat_folhas = case when v_spot and v_lista is not null then o.fat_folhas end
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
-- VERIFICAÇÃO — rodar depois do commit. Qualquer *** FALHOU *** = parar e não deployar.
-- ============================================================
select n, verificacao, case when ok then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'obras_nota_externa existe com RLS ligada',
      exists (select 1 from pg_class where oid = to_regclass('public.obras_nota_externa') and relrowsecurity)),
  (2, 'obras_nota_externa: policies select, insert, delete (sem update)',
      (select string_agg(cmd, ',' order by cmd) from pg_policies
        where schemaname = 'public' and tablename = 'obras_nota_externa') = 'DELETE,INSERT,SELECT'),
  (3, 'anon não lê obras_nota_externa; authenticated não atualiza',
      not has_table_privilege('anon', 'public.obras_nota_externa', 'select')
      and not has_table_privilege('authenticated', 'public.obras_nota_externa', 'update')),
  (4, 'pode_ver_valores aceita SPOT dentro do bloco de acesso',
      (select prosrc like '%obras_has_access() is true%o.modalidade = ''spot''%' from pg_proc
        where oid = 'public.obras_pode_ver_valores(uuid)'::regprocedure)),
  (5, 'pode_marcar_locacao: definer, search_path fixo',
      (select count(*) from pg_proc
        where oid = 'public.obras_pode_marcar_locacao(uuid)'::regprocedure
          and prosecdef and proconfig is not null) = 1),
  (6, 'gatilho de locação usa obras_pode_marcar_locacao',
      (select prosrc like '%obras_pode_marcar_locacao(new.obra_id) is not true%'
              and prosrc not like '%obras_engenheiro_ou_admin_mae%'
         from pg_proc where oid = 'public.obras_locacao_estado_guarda()'::regprocedure)),
  (7, 'policies insert/update de locação usam obras_pode_marcar_locacao',
      (select count(*) from pg_policies
        where schemaname = 'public' and tablename = 'obras_locacao_estado'
          and policyname in ('obras engenheiro insert', 'obras engenheiro update')
          and coalesce(with_check, '') like '%obras_pode_marcar_locacao(obra_id)%'
          and coalesce(qual, 'obras_pode_marcar_locacao(obra_id)') like '%obras_pode_marcar_locacao(obra_id)%') = 2),
  (8, 'authenticated/anon não executam marcar, desmarcar, faturado',
      not has_function_privilege('authenticated', 'public.obras_marcar_faturada(uuid[], text, text, text, date, text)', 'execute')
      and not has_function_privilege('anon', 'public.obras_marcar_faturada(uuid[], text, text, text, date, text)', 'execute')
      and not has_function_privilege('authenticated', 'public.obras_desmarcar_faturada(uuid[], text, text)', 'execute')
      and not has_function_privilege('anon', 'public.obras_desmarcar_faturada(uuid[], text, text)', 'execute')
      and not has_function_privilege('authenticated', 'public.obras_spot_faturado_centavos(uuid)', 'execute')
      and not has_function_privilege('anon', 'public.obras_spot_faturado_centavos(uuid)', 'execute')),
  (9, 'service_role executa marcar, desmarcar, faturado',
      has_function_privilege('service_role', 'public.obras_marcar_faturada(uuid[], text, text, text, date, text)', 'execute')
      and has_function_privilege('service_role', 'public.obras_desmarcar_faturada(uuid[], text, text)', 'execute')
      and has_function_privilege('service_role', 'public.obras_spot_faturado_centavos(uuid)', 'execute')),
  (10, 'marcar e desmarcar continuam invoker',
      (select count(*) from pg_proc
        where oid in ('public.obras_marcar_faturada(uuid[], text, text, text, date, text)'::regprocedure,
                      'public.obras_desmarcar_faturada(uuid[], text, text)'::regprocedure)
          and not prosecdef) = 2),
  (11, 'histórico aceita o campo faturamento parcial',
      (select pg_get_constraintdef(oid) like '%''faturamento parcial''%' from pg_constraint
        where conrelid = 'public.obras_historico'::regclass and conname = 'obras_historico_campo_check')),
  (12, 'formato R$ do histórico',
      public.obras_reais_txt(123456789) = 'R$ 1.234.567,89' and public.obras_reais_txt(5) = 'R$ 0,05')
) as v(n, verificacao, ok)
order by n;
