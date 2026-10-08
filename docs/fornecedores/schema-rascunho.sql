-- ============================================================================
-- Gestão de Fornecedores — SCHEMA RASCUNHO (08/10/2026)
-- *** RASCUNHO. NÃO APLICAR EM BANCO NENHUM. ***
-- Vira as migrations supabase/hub-install/001..005_frn_*.sql do repo
-- manfac-facilities/fornecedores (fatia F1 da spec), testadas em PGlite antes.
--
-- Spec: docs/fornecedores/spec.md (R-xx = regra, CA-x.y = critério de aceite).
-- Padrão copiado do Compras (levantamento A4):
--   * toda frn_*: RLS ligada, revoke all de anon/authenticated, devolve SÓ select;
--   * toda escrita: função frn_* security definer, execute SÓ para service_role;
--     a Server Action confere a sessão e passa p_ator = e-mail da sessão;
--   * a função revalida papel/dono/estado/saldo a partir de p_ator;
--   * guardas com exists()/coalesce/"is not true" — nada falha aberto com NULL;
--   * nunca escreve em fin_*, hub_*, obras_* (só lê hub_user_roles e obras_obra).
--
-- DÚVIDAS DO CLIENTE que mexem aqui (padrão adotado entre parênteses):
--   C1 obra = obras_obra? (sim; sem FK, com snapshot do rótulo)
--   C2 fornecedores já no Omie contam como homologados? (sim: carga inicial)
--   C5 e-mails de Eduardo e José (seed de frn_papeis no fim, comentado)
-- DECISÃO-PENDENTE P1/P3 (spec §9.3): só afetam frn_registrar_solicitacao_fin
-- e frn_registrar_pagamento, cuja assinatura já cobre as duas opções.
-- ============================================================================

begin;

-- ============================================================================
-- 0. PRÉ-REQUISITOS — aborta se o ambiente não for o esperado
-- ============================================================================
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='public' and table_name='hub_user_roles'
                   and column_name='nivel') then
    raise exception 'hub_user_roles.nivel não existe — abortando';
  end if;
  if to_regclass('public.obras_obra') is null then
    raise exception 'obras_obra não existe — abortando (dúvida C1)';
  end if;
  if exists (select 1 from pg_tables where schemaname='public' and tablename like 'frn\_%') then
    raise exception 'já existem tabelas frn_* — esta é a migration inicial, abortando';
  end if;
end;
$$;

-- ============================================================================
-- 1. ACESSO
-- ============================================================================
create table public.frn_papeis (
  user_email     text not null check (user_email = lower(trim(user_email)) and user_email like '%@%'),
  papel          text not null check (papel in ('aprovador_contratacao','aprovador_financeiro')),
  ativo          boolean not null default true,
  concedido_por  text not null,
  concedido_em   timestamptz not null default now(),
  revogado_por   text,
  revogado_em    timestamptz,
  primary key (user_email, papel),
  check (ativo or (revogado_por is not null and revogado_em is not null))
);

-- e-mail da sessão (só para policies). NULL sem sessão → policies negam.
create function public.frn_email() returns text
language sql stable
set search_path = public, pg_temp
as $$ select nullif(lower(trim(auth.jwt() ->> 'email')), '') $$;

create function public.frn_e_admin(p_email text) returns boolean
language sql stable security definer
set search_path = public, pg_temp set row_security = off
as $$
  select exists (select 1 from public.hub_user_roles
                 where user_email = lower(trim(p_email)) and nivel = 'administrador')
$$;

create function public.frn_tem_papel(p_email text, p_papel text) returns boolean
language sql stable security definer
set search_path = public, pg_temp set row_security = off
as $$
  select exists (select 1 from public.frn_papeis
                 where user_email = lower(trim(p_email)) and papel = p_papel and ativo)
$$;

-- "vê tudo" = admin do hub ou qualquer papel ativo. exists() nunca devolve NULL.
create function public.frn_ve_tudo(p_email text) returns boolean
language sql stable security definer
set search_path = public, pg_temp set row_security = off
as $$
  select public.frn_e_admin(p_email)
      or exists (select 1 from public.frn_papeis
                 where user_email = lower(trim(p_email)) and ativo)
$$;

-- normaliza e valida o ator recebido da Server Action. Nunca devolve NULL.
create function public.frn__ator(p_ator text) returns text
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare v text := lower(trim(coalesce(p_ator, '')));
begin
  if v = '' or position('@' in v) = 0 then
    raise exception 'Sessão inválida.' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- ============================================================================
-- 2. CADASTROS
-- ============================================================================
create table public.frn_condicoes (
  codigo               text primary key check (codigo ~ '^[A-Z0-9_]+$'),
  nome                 text not null,
  tipo                 text not null,
  faixa                text not null,
  modo                 text not null check (modo in ('parcelas','mensal','por_servico','consolidado','tabela','excecao')),
  parcelas             jsonb not null default '[]'::jsonb,  -- [{gatilho,pct,final,retencao}]
  gatilho              text,                                -- para modos sem lista
  dias_pagamento       int check (dias_pagamento >= 0),     -- NULL = calendário financeiro
  permite_global       boolean not null,
  so_global            boolean not null default false,
  exige_justificativa  boolean not null default false,
  pratica              text not null,
  observacao           text,
  ativo                boolean not null default true,
  ordem                int not null unique,
  check (not so_global or permite_global),
  check ((modo = 'parcelas') = (jsonb_array_length(parcelas) > 0))
);

create table public.frn_fornecedores (
  id                     uuid primary key default gen_random_uuid(),
  omie_codigo            bigint not null unique,
  documento              text not null unique check (documento ~ '^[0-9]{11}([0-9]{3})?$'), -- só dígitos
  razao_social           text not null,
  nome_fantasia          text,
  cidade                 text,
  uf                     text,
  origem                 text not null check (origem in ('carga_inicial','primeiro_uso')),
  homolog_cnpj_ok        boolean not null default false,
  homolog_banco_ok       boolean not null default false,
  homolog_certidoes_ok   boolean not null default false,
  homologado             boolean not null default false,
  homologado_por         text,
  homologado_em          timestamptz,
  atualizado_em          timestamptz not null default now(),
  check (not homologado or (homologado_em is not null and homologado_por is not null)),
  check (origem = 'carga_inicial' or not homologado
         or (homolog_cnpj_ok and homolog_banco_ok and homolog_certidoes_ok))
);

-- ============================================================================
-- 3. CONTRATOS, TABELA DE PREÇOS, ADITIVOS
-- ============================================================================
create sequence public.frn_ct_seq start 1;
create sequence public.frn_md_seq start 1;

-- 'CT' , 7 → 'CT-0007'; 12345 → 'CT-12345' (lpad trunca — por isso o case)
create function public.frn__numero(p_prefixo text, p_n bigint) returns text
language sql immutable
set search_path = public, pg_temp
as $$ select p_prefixo || '-' || case when p_n < 10000 then lpad(p_n::text, 4, '0') else p_n::text end $$;

create table public.frn_contratos (
  id                         uuid primary key default gen_random_uuid(),
  seq                        bigint not null unique,
  numero                     text not null unique,
  fornecedor_id              uuid not null references public.frn_fornecedores(id),
  tipo                       text not null check (tipo in ('especifico','global')),
  classificacao              text check (classificacao in ('spot','manutencao','obra','material','emergencial')),
  obra_id                    uuid,          -- obras_obra.id, sem FK de propósito (dúvida C1)
  obra_rotulo                text,
  cc_codigo                  text,
  cc_nome                    text,
  escopo                     text not null default '' check (length(escopo) <= 4000),
  valor_mo                   numeric(14,2) not null default 0 check (valor_mo >= 0),
  valor_mat                  numeric(14,2) not null default 0 check (valor_mat >= 0),
  inicio                     date,
  fim                        date,
  condicao_codigo            text references public.frn_condicoes(codigo),
  condicao_sugerida          text references public.frn_condicoes(codigo),
  excecao_condicao           text,
  excecao_justificativa      text,
  emergencia_justificativa   text,
  status                     text not null default 'rascunho'
                               check (status in ('rascunho','aguardando','aprovado','encerrado','cancelado')),
  enviado_em                 timestamptz,
  contratacao_aprovada_por   text,
  contratacao_aprovada_em    timestamptz,
  condicoes_aprovadas_por    text,
  condicoes_aprovadas_em     timestamptz,
  aprovado_em                timestamptz,
  devolvido_por              text,
  devolvido_em               timestamptz,
  devolvido_motivo           text,
  aceite_final_por           text,
  aceite_final_em            timestamptz,
  encerrado_por              text,
  encerrado_em               timestamptz,
  encerrado_motivo           text,
  cancelado_em               timestamptz,
  documento_gerado_em        timestamptz,
  prox_aditivo               int not null default 2 check (prox_aditivo >= 2),
  criado_por                 text not null,
  criado_em                  timestamptz not null default now(),
  atualizado_em              timestamptz not null default now(),

  -- R-02: global sem obra, só spot/manutenção, sem material
  constraint frn_ct_global check (tipo <> 'global'
      or (obra_id is null and valor_mat = 0 and (classificacao is null or classificacao in ('spot','manutencao')))),
  -- R-05: material só material
  constraint frn_ct_material check (classificacao is distinct from 'material' or valor_mo = 0),
  constraint frn_ct_datas check (inicio is null or fim is null or fim >= inicio),
  -- fora do rascunho/cancelado o contrato está completo (R-01..R-07)
  constraint frn_ct_completo check (status in ('rascunho','cancelado') or (
        classificacao is not null
    and (tipo = 'global' or obra_id is not null)
    and coalesce(trim(cc_codigo), '') <> ''
    and trim(escopo) <> ''
    and inicio is not null and fim is not null
    and condicao_codigo is not null
    and (valor_mo + valor_mat) > 0
    and (classificacao <> 'emergencial' or coalesce(trim(emergencia_justificativa), '') <> '')
  )),
  constraint frn_ct_aprovado check (status not in ('aprovado','encerrado') or (
    contratacao_aprovada_em is not null and condicoes_aprovadas_em is not null and aprovado_em is not null)),
  constraint frn_ct_devolvido check (devolvido_em is null or coalesce(trim(devolvido_motivo), '') <> ''),
  constraint frn_ct_encerrado check (status <> 'encerrado' or encerrado_em is not null)
);
create index frn_contratos_criado_por_idx on public.frn_contratos (criado_por);
create index frn_contratos_status_idx on public.frn_contratos (status);
create index frn_contratos_fornecedor_idx on public.frn_contratos (fornecedor_id);

create table public.frn_tabela_precos (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references public.frn_contratos(id) on delete restrict,
  ordem        int not null,
  servico      text not null check (trim(servico) <> ''),
  unidade      text not null check (trim(unidade) <> ''),
  preco        numeric(14,2) not null check (preco > 0),
  unique (contrato_id, ordem)
);

create table public.frn_aditivos (
  id                        uuid primary key default gen_random_uuid(),
  contrato_id               uuid not null references public.frn_contratos(id) on delete restrict,
  seq                       int not null check (seq >= 2),
  numero                    text not null unique,
  tipo                      text not null check (tipo in ('valor','condicao')),
  item                      text check (item in ('mo','mat')),
  valor                     numeric(14,2),
  condicao_de               text references public.frn_condicoes(codigo),
  condicao_para             text references public.frn_condicoes(codigo),
  excecao_condicao          text,
  excecao_justificativa     text,
  motivo                    text not null check (length(trim(motivo)) >= 5),
  status                    text not null default 'aguardando'
                              check (status in ('aguardando','aprovado','devolvido')),
  contratacao_aprovada_por  text,
  contratacao_aprovada_em   timestamptz,
  condicoes_aprovadas_por   text,
  condicoes_aprovadas_em    timestamptz,
  aprovado_em               timestamptz,
  devolvido_por             text,
  devolvido_em              timestamptz,
  devolvido_motivo          text,
  aplicado_resumo           jsonb,        -- R-30: {antes, depois, passaram[], mantiveram[]}
  criado_por                text not null,
  criado_em                 timestamptz not null default now(),
  unique (contrato_id, seq),
  constraint frn_ad_valor check (tipo <> 'valor' or
    (valor > 0 and item is not null and condicao_de is null and condicao_para is null)),
  constraint frn_ad_cond check (tipo <> 'condicao' or
    (valor is null and item is null and condicao_de is not null and condicao_para is not null
     and condicao_de <> condicao_para and contratacao_aprovada_em is null)),
  constraint frn_ad_aprovado check (status <> 'aprovado' or (
    condicoes_aprovadas_em is not null and aprovado_em is not null
    and (tipo = 'condicao' or contratacao_aprovada_em is not null))),
  constraint frn_ad_devolvido check (status <> 'devolvido' or coalesce(trim(devolvido_motivo), '') <> '')
);
-- CA-3.5: no máximo um aditivo de condição aguardando por contrato
create unique index frn_aditivos_cond_pendente_uniq
  on public.frn_aditivos (contrato_id) where tipo = 'condicao' and status = 'aguardando';

-- ============================================================================
-- 4. MEDIÇÕES, ATENDIMENTOS, ANEXOS, EVENTOS
-- ============================================================================
create table public.frn_medicoes (
  id                     uuid primary key default gen_random_uuid(),
  seq                    bigint not null unique,
  numero                 text not null unique,
  contrato_id            uuid not null references public.frn_contratos(id) on delete restrict,
  item                   text not null check (item in ('mo','mat')),
  modo                   text not null check (modo in ('parcela','material','servico','tabela','consolidado')),
  descricao              text not null check (length(trim(descricao)) between 3 and 500),
  data_servico           date,
  tabela_preco_id        uuid references public.frn_tabela_precos(id),
  quantidade             numeric(12,3) check (quantidade > 0),
  valor                  numeric(14,2) not null check (valor > 0),
  percentual             numeric(9,4) not null,         -- valor / total do item no momento
  condicao_codigo        text not null references public.frn_condicoes(codigo),
  competencia            date not null check (extract(day from competencia) = 1),
  aceite_operacional     boolean not null default false,
  -- dados de pagamento exigidos pela solicitação do Financeiro (levantamento B2)
  nf_numero              text not null check (trim(nf_numero) <> ''),
  forma_pagamento        text not null check (forma_pagamento in ('boleto','guia','pix_chave','pix_qrcode')),
  codigo_pagamento       text,
  pix_chave              text,
  categoria_codigo       text not null,
  categoria_nome         text not null,
  tipo_documento_codigo  text not null,
  tipo_documento_nome    text not null,
  cc_codigo              text not null,
  cc_nome                text not null,
  vencimento             date,                          -- R-40, fixado no envio ao Financeiro
  status                 text not null default 'solicitada'
                           check (status in ('solicitada','aprovada','pagamento_solicitado','paga','devolvida')),
  solicitado_por         text not null,
  solicitado_em          timestamptz not null default now(),
  aprovado_por           text,
  aprovado_em            timestamptz,
  devolvido_por          text,
  devolvido_em           timestamptz,
  devolvido_motivo       text,
  fin_ref                text unique,                   -- nº da solicitação no Financeiro (R-41)
  fin_criada_em          timestamptz,
  fin_ultimo_erro        text,
  pago_em                date,
  valor_pago             numeric(14,2),
  constraint frn_md_codigo check ((forma_pagamento = 'pix_chave') = (codigo_pagamento is null)
                                  and (codigo_pagamento is null or trim(codigo_pagamento) <> '')),
  constraint frn_md_tabela check ((modo = 'tabela') = (tabela_preco_id is not null and quantidade is not null)),
  constraint frn_md_item check ((item = 'mat') = (modo = 'material')),
  constraint frn_md_aprovada check (status not in ('aprovada','pagamento_solicitado','paga')
                                    or (aprovado_por is not null and aprovado_em is not null)),
  constraint frn_md_fin check (status not in ('pagamento_solicitado','paga')
                               or (fin_ref is not null and fin_criada_em is not null and vencimento is not null)),
  constraint frn_md_paga check (status <> 'paga' or (pago_em is not null and valor_pago is not null)),
  constraint frn_md_devolvida check (status <> 'devolvida'
                                     or (devolvido_em is not null and coalesce(trim(devolvido_motivo), '') <> ''))
);
create index frn_medicoes_contrato_idx on public.frn_medicoes (contrato_id, item, status);
create index frn_medicoes_status_idx on public.frn_medicoes (status);

create table public.frn_atendimentos (
  id           uuid primary key default gen_random_uuid(),
  contrato_id  uuid not null references public.frn_contratos(id) on delete restrict,
  data         date not null,
  descricao    text not null check (length(trim(descricao)) between 3 and 500),
  valor        numeric(14,2) not null check (valor > 0),
  medicao_id   uuid references public.frn_medicoes(id),
  criado_por   text not null,
  criado_em    timestamptz not null default now()
);
create index frn_atendimentos_abertos_idx on public.frn_atendimentos (contrato_id) where medicao_id is null;

create table public.frn_anexos (
  id             uuid primary key default gen_random_uuid(),
  contrato_id    uuid not null references public.frn_contratos(id) on delete restrict,
  medicao_id     uuid references public.frn_medicoes(id) on delete restrict,
  tipo           text not null check (tipo in ('proposta','certidoes','nf','evidencia','comprovante_entrega','outro')),
  storage_path   text not null unique,   -- bucket privado fornecedores-anexos, sem policy de storage
  nome_arquivo   text not null,
  tamanho        int not null check (tamanho > 0 and tamanho <= 10485760),
  enviado_por    text not null,
  enviado_em     timestamptz not null default now(),
  check ((tipo in ('proposta','certidoes')) = (medicao_id is null) or tipo = 'outro')
);
create index frn_anexos_contrato_idx on public.frn_anexos (contrato_id);

create table public.frn_eventos (
  id           bigint generated always as identity primary key,
  contrato_id  uuid not null references public.frn_contratos(id) on delete restrict,
  aditivo_id   uuid references public.frn_aditivos(id),
  medicao_id   uuid references public.frn_medicoes(id),
  tipo         text not null check (tipo in (
                 'contrato_criado','contrato_enviado','contratacao_aprovada','condicoes_aprovadas',
                 'homologacao_aberta','fornecedor_homologado','contrato_aprovado','contrato_devolvido',
                 'contrato_cancelado','contrato_encerrado','documento_gerado',
                 'aditivo_pedido','aditivo_aprovado_parte','aditivo_aprovado','aditivo_devolvido',
                 'atendimento_registrado','atendimento_removido',
                 'medicao_solicitada','medicao_aprovada','solicitacao_financeiro_criada',
                 'solicitacao_financeiro_falhou','medicao_devolvida','pagamento_registrado','aceite_final')),
  descricao    text not null,
  dados        jsonb not null default '{}'::jsonb,
  autor_email  text,                    -- NULL = sistema (integração)
  criado_em    timestamptz not null default now()
);
create index frn_eventos_contrato_idx on public.frn_eventos (contrato_id, criado_em);

-- linha do tempo imutável
create function public.frn__eventos_imutavel() returns trigger
language plpgsql set search_path = public, pg_temp
as $$ begin raise exception 'frn_eventos é imutável'; end; $$;
create trigger frn_eventos_imutavel before update or delete on public.frn_eventos
  for each row execute function public.frn__eventos_imutavel();

-- ============================================================================
-- 5. RLS — fechada por padrão; só SELECT, com policy explícita
-- ============================================================================
do $$
declare t text;
begin
  foreach t in array array['frn_papeis','frn_condicoes','frn_fornecedores','frn_contratos',
                           'frn_tabela_precos','frn_aditivos','frn_medicoes','frn_atendimentos',
                           'frn_anexos','frn_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end;
$$;
revoke all on sequence public.frn_ct_seq, public.frn_md_seq from anon, authenticated;

create policy frn_papeis_select on public.frn_papeis for select to authenticated
  using (user_email = (select public.frn_email())
         or (select public.frn_e_admin((select public.frn_email()))));

create policy frn_condicoes_select on public.frn_condicoes for select to authenticated
  using ((select public.frn_email()) is not null);

create policy frn_fornecedores_select on public.frn_fornecedores for select to authenticated
  using ((select public.frn_email()) is not null);

-- D2: dono ou "vê tudo". frn_email() NULL → criado_por = NULL é NULL e ve_tudo(NULL) é false → nega.
create policy frn_contratos_select on public.frn_contratos for select to authenticated
  using (criado_por = (select public.frn_email())
         or (select public.frn_ve_tudo((select public.frn_email()))));

-- filhas herdam a visibilidade da mãe (a RLS de frn_contratos vale dentro do exists)
create policy frn_tabela_precos_select on public.frn_tabela_precos for select to authenticated
  using (exists (select 1 from public.frn_contratos c where c.id = contrato_id));
create policy frn_aditivos_select on public.frn_aditivos for select to authenticated
  using (exists (select 1 from public.frn_contratos c where c.id = contrato_id));
create policy frn_medicoes_select on public.frn_medicoes for select to authenticated
  using (exists (select 1 from public.frn_contratos c where c.id = contrato_id));
create policy frn_atendimentos_select on public.frn_atendimentos for select to authenticated
  using (exists (select 1 from public.frn_contratos c where c.id = contrato_id));
create policy frn_anexos_select on public.frn_anexos for select to authenticated
  using (exists (select 1 from public.frn_contratos c where c.id = contrato_id));
create policy frn_eventos_select on public.frn_eventos for select to authenticated
  using (exists (select 1 from public.frn_contratos c where c.id = contrato_id));

-- Storage: bucket privado, SEM policy (upload/download só pelo servidor com service role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fornecedores-anexos', 'fornecedores-anexos', false, 10485760,
        array['application/pdf','image/jpeg','image/png'])
on conflict (id) do nothing;

-- ============================================================================
-- 6. SEED — 14 condições (12 da planilha Zeev + SPOT_A_VISTA + SPOT_D30)
-- ============================================================================
insert into public.frn_condicoes
  (codigo, nome, tipo, faixa, modo, parcelas, gatilho, dias_pagamento, permite_global, so_global, exige_justificativa, pratica, observacao, ordem)
values
 ('OBRA_PEQUENA_UNICA_D7','Obra pequena · pagamento único','Obra pequena','Até R$ 1.500','parcelas',
  '[{"gatilho":"Após execução aprovada + documentação mínima","pct":100,"final":true,"retencao":false}]',null,7,false,false,false,
  'Mede uma vez; o Financeiro programa D+7.','Não permitir pagamento antes da execução, salvo exceção',1),
 ('OBRA_MEDIA_50_50','Obra média · 50% / 50%','Obra média','R$ 1.500 a R$ 5.000','parcelas',
  '[{"gatilho":"Contrato aprovado + início/mobilização autorizada","pct":50,"final":false,"retencao":false},{"gatilho":"Conclusão aprovada + NF + evidências","pct":50,"final":true,"retencao":false}]',null,null,false,false,false,
  'A medição final libera a segunda parcela. Para quando há custo de mobilização.','Usar quando há custo de mobilização, mas escopo é controlado',2),
 ('OBRA_MEDIA_UNICA_D15','Obra média baixo risco · único','Obra média baixo risco','R$ 1.500 a R$ 5.000, baixo risco','parcelas',
  '[{"gatilho":"Após conclusão aprovada + NF","pct":100,"final":true,"retencao":false}]',null,15,false,false,false,
  'Medição única; o Financeiro programa D+15. Para parceiros confiáveis e serviços rápidos.','Alternativa ao 50/50 para parceiros confiáveis e serviços rápidos',3),
 ('OBRA_MAIOR_30_30_40','Obra maior · 30% / 30% / 40%','Obra maior','Acima de R$ 5.000','parcelas',
  '[{"gatilho":"Contrato aprovado + início/mobilização","pct":30,"final":false,"retencao":false},{"gatilho":"Medição parcial aprovada","pct":30,"final":false,"retencao":false},{"gatilho":"Conclusão + aceite final + NF","pct":40,"final":true,"retencao":false}]',null,null,false,false,false,
  'Cada medição fica vinculada ao contrato; o sistema controla o saldo.','Condição principal para obras maiores',4),
 ('OBRA_RETENCAO_10','Obra crítica · 30% / 30% / 30% + 10% retido','Obra crítica / garantia','Acima de R$ 8.000 ou risco técnico','parcelas',
  '[{"gatilho":"Início/mobilização","pct":30,"final":false,"retencao":false},{"gatilho":"Medição parcial","pct":30,"final":false,"retencao":false},{"gatilho":"Conclusão aprovada","pct":30,"final":true,"retencao":false},{"gatilho":"Retenção · liberada após aceite final","pct":10,"final":true,"retencao":true}]',null,null,false,false,false,
  'Os últimos 10% só são pagos depois do aceite final.','Usar com cautela para não gerar excesso de controle em serviços simples',5),
 ('OBRA_MEDICAO_MENSAL','Obra contínua · medição mensal','Obra contínua','Contrato com medições recorrentes','mensal',
  '[]','Medição mensal aprovada + NF',null,true,false,false,
  'Cada medição mensal aprovada gera um pagamento.','Ideal para contratos contínuos ou guarda-chuva de manutenção',6),
 ('SPOT_UNICO_D7','Spot simples · único','Serviço Spot simples','Atendimento avulso até R$ 1.500','por_servico',
  '[]','Atendimento concluído + evidência + NF',7,true,false,false,
  'Cada atendimento vira uma medição; o Financeiro programa D+7.','Caminhão pipa avulso, desentupidora, dedetização simples',7),
 ('SPOT_UNICO_D15','Spot padrão · único','Serviço Spot padrão','Atendimento avulso acima de R$ 1.500','por_servico',
  '[]','Atendimento concluído + NF aprovada',15,true,false,false,
  'Cada atendimento vira uma medição; o Financeiro programa D+15.','Melhor para melhorar prazo de caixa',8),
 ('SPOT_MENSAL_CONSOLIDADO','Spot recorrente · mensal consolidado','Spot recorrente','Vários atendimentos no mês','consolidado',
  '[]','Fechamento mensal aprovado + NF consolidada',null,true,true,false,
  'Os atendimentos do mês se acumulam; o fechamento gera uma medição só.','Reduz retrabalho e volume de solicitações de pagamento',9),
 ('SPOT_TABELA_FIXA','Spot com tabela de preço fixa','Spot recorrente com preço fixo','Contrato global com tabela','tabela',
  '[]','Serviço da tabela + evidência + NF',null,true,true,false,
  'Quem pede escolhe o serviço da tabela; o valor vem dela.','Recomendado para caminhão pipa, dedetização, desentupidoras',10),
 ('MATERIAL_MEDIANTE_NF','Material · mediante NF','Material','Compra/entrega de material','parcelas',
  '[{"gatilho":"Entrega comprovada + NF aprovada","pct":100,"final":false,"retencao":false}]',null,null,false,false,false,
  'Material fica separado da mão de obra no contrato e na medição.','Evita misturar lógica de empreiteiro com compra de material',11),
 ('EXCECAO_APROVACAO','Exceção · fora do padrão','Exceção comercial','Justificativa obrigatória','excecao',
  '[]','Conforme aprovação',null,true,false,true,
  'Antecipação, condição especial ou urgência. Exige justificativa.','Usar para antecipação, condição especial, aditivo ou urgência',12),
 ('SPOT_A_VISTA','Spot · à vista na conclusão','Serviço Spot à vista','Atendimento avulso pago na conclusão','por_servico',
  '[]','Atendimento concluído + evidência + NF',0,true,false,false,
  'Cada atendimento vira uma medição; o Financeiro programa na primeira janela de pagamento.','Nova (08/10/2026): exemplo do cliente — global de 7 dias para à vista',13),
 ('SPOT_D30','Spot · 30 dias','Serviço Spot 30 dias','Atendimento avulso com prazo de 30 dias','por_servico',
  '[]','Atendimento concluído + evidência + NF',30,true,false,false,
  'Cada atendimento vira uma medição; o Financeiro programa D+30.','Nova (08/10/2026): exemplo do cliente — global de 7 dias para 30 dias',14);

-- ============================================================================
-- 7. FUNÇÕES DE CÁLCULO (puras sobre o banco; espelho em lib/regras/*.ts)
-- ============================================================================

-- valor em formato brasileiro sem prefixo (to_char com G/D depende do locale do servidor)
create function public.frn__brl(p numeric) returns text
language sql immutable
set search_path = public, pg_temp
as $$ select translate(to_char(round(p, 2), 'FM999,999,999,990.00'), ',.', '.,') $$;

-- R-10
create function public.frn_sugerir_condicao(p_tipo text, p_classe text, p_mo numeric, p_inicio date, p_fim date)
returns text language sql immutable
set search_path = public, pg_temp
as $$
  select case
    when p_classe is null then null
    when p_classe = 'emergencial' then 'EXCECAO_APROVACAO'
    when p_tipo = 'global' then case when p_classe = 'manutencao' then 'OBRA_MEDICAO_MENSAL' else 'SPOT_TABELA_FIXA' end
    when p_classe = 'material' then 'MATERIAL_MEDIANTE_NF'
    when p_classe = 'spot' then case when coalesce(p_mo,0) > 1500 then 'SPOT_UNICO_D15' else 'SPOT_UNICO_D7' end
    when p_classe = 'manutencao' and p_inicio is not null and p_fim is not null and (p_fim - p_inicio) > 45 then 'OBRA_MEDICAO_MENSAL'
    when coalesce(p_mo,0) <= 1500 then 'OBRA_PEQUENA_UNICA_D7'
    when p_mo <= 5000 then 'OBRA_MEDIA_50_50'
    when p_mo <= 8000 then 'OBRA_MAIOR_30_30_40'
    else 'OBRA_RETENCAO_10'
  end
$$;

-- R-09 (boolean sempre: coalesce no fim)
create function public.frn_condicao_permitida(p_codigo text, p_tipo text, p_classe text)
returns boolean language sql stable security definer
set search_path = public, pg_temp set row_security = off
as $$
  select coalesce((
    select c.ativo
       and (case when p_classe = 'material' then c.codigo = 'MATERIAL_MEDIANTE_NF'
                 when p_tipo = 'global' then c.permite_global
                 else not c.so_global end)
    from public.frn_condicoes c where c.codigo = p_codigo), false)
$$;

-- R-20
create function public.frn_total(p_contrato uuid, p_item text) returns numeric
language sql stable security definer
set search_path = public, pg_temp set row_security = off
as $$
  select coalesce((select case when p_item = 'mat' then valor_mat else valor_mo end
                   from public.frn_contratos where id = p_contrato), 0)
       + coalesce((select sum(valor) from public.frn_aditivos
                   where contrato_id = p_contrato and tipo = 'valor' and item = p_item and status = 'aprovado'), 0)
$$;

create function public.frn_medido(p_contrato uuid, p_item text) returns numeric
language sql stable security definer
set search_path = public, pg_temp set row_security = off
as $$
  select coalesce(sum(valor), 0) from public.frn_medicoes
  where contrato_id = p_contrato and item = p_item
    and status in ('solicitada','aprovada','pagamento_solicitado','paga')
$$;

create function public.frn_em_aberto(p_contrato uuid) returns numeric
language sql stable security definer
set search_path = public, pg_temp set row_security = off
as $$ select coalesce(sum(valor), 0) from public.frn_atendimentos where contrato_id = p_contrato and medicao_id is null $$;

-- R-21: parcelas da mão de obra de contrato específico (derivadas, nada gravado)
create function public.frn_parcelas_mo(p_contrato uuid)
returns table (ordem int, nome text, pct numeric, valor numeric, ini numeric, fim numeric,
               final boolean, retencao boolean, prevista date)
language plpgsql stable security definer
set search_path = public, pg_temp set row_security = off
as $$
declare
  c public.frn_contratos; k public.frn_condicoes;
  arr jsonb; p jsonb; t numeric; acc numeric := 0; n int; base numeric; i int; m date;
  meses text[] := array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto',
                        'Setembro','Outubro','Novembro','Dezembro'];
begin
  select * into c from public.frn_contratos where id = p_contrato;
  if not found or c.tipo = 'global' or c.classificacao = 'material' or c.condicao_codigo is null then return; end if;
  select * into k from public.frn_condicoes where codigo = c.condicao_codigo;
  t := public.frn_total(p_contrato, 'mo');

  if k.modo = 'parcelas' then
    arr := k.parcelas;
  elsif k.modo = 'mensal' then
    if c.inicio is null or c.fim is null then return; end if;
    n := (extract(year from c.fim)::int - extract(year from c.inicio)::int) * 12
       + extract(month from c.fim)::int - extract(month from c.inicio)::int + 1;
    if n < 1 or n > 36 then return; end if;
    base := floor(10000.0 / n) / 100;
    arr := '[]'::jsonb;
    for i in 0 .. n - 1 loop
      m := (date_trunc('month', c.inicio) + make_interval(months => i))::date;
      arr := arr || jsonb_build_array(jsonb_build_object(
        'gatilho', meses[extract(month from m)::int] || '/' || extract(year from m)::int,
        'pct', case when i = n - 1 then 100 - base * (n - 1) else base end,
        'final', i = n - 1, 'retencao', false,
        'prevista', ((m + interval '1 month') - interval '1 day')::date));
    end loop;
  else  -- excecao, por_servico em contrato específico: 1 parcela 100% final
    arr := jsonb_build_array(jsonb_build_object(
      'gatilho', coalesce(nullif(trim(c.excecao_condicao), ''), coalesce(k.gatilho, k.nome)),
      'pct', 100, 'final', true, 'retencao', false));
  end if;

  n := jsonb_array_length(arr);
  for i in 0 .. n - 1 loop
    p := arr -> i;
    ordem := i + 1;
    nome := p ->> 'gatilho';
    pct := (p ->> 'pct')::numeric;
    valor := case when i = n - 1 then t - acc else round(t * pct / 100, 2) end;  -- última leva o resto
    ini := acc; acc := acc + valor; fim := acc;
    final := coalesce((p ->> 'final')::boolean, false);
    retencao := coalesce((p ->> 'retencao')::boolean, false);
    prevista := (p ->> 'prevista')::date;
    return next;
  end loop;
end;
$$;

-- R-26: corte dia 25, fuso de São Paulo
create function public.frn_competencia(p_quando timestamptz) returns date
language sql stable
set search_path = public, pg_temp
as $$
  select case when extract(day from (p_quando at time zone 'America/Sao_Paulo')) <= 25
              then date_trunc('month', p_quando at time zone 'America/Sao_Paulo')::date
              else (date_trunc('month', p_quando at time zone 'America/Sao_Paulo') + interval '1 month')::date end
$$;

-- pode ver/agir como dono? (dono OU papel). Boolean sempre.
create function public.frn__pode_operar(p_contrato public.frn_contratos, p_ator text) returns boolean
language sql stable security definer
set search_path = public, pg_temp set row_security = off
as $$ select coalesce(p_contrato.criado_por = p_ator, false) or public.frn_ve_tudo(p_ator) $$;

create function public.frn__evento(p_contrato uuid, p_tipo text, p_desc text, p_autor text,
                                   p_dados jsonb default '{}'::jsonb, p_aditivo uuid default null, p_medicao uuid default null)
returns void language sql
set search_path = public, pg_temp
as $$
  insert into public.frn_eventos (contrato_id, aditivo_id, medicao_id, tipo, descricao, dados, autor_email)
  values (p_contrato, p_aditivo, p_medicao, p_tipo, p_desc, coalesce(p_dados, '{}'::jsonb), p_autor)
$$;

-- ============================================================================
-- 8. FUNÇÕES DE ESCRITA (service_role only). Todas: p_ator validado, linha travada.
-- ============================================================================

-- 8.1 fornecedor (cópia do catálogo Omie no primeiro uso; carga inicial usa origem 'carga_inicial')
create function public.frn_upsert_fornecedor(p_omie_codigo bigint, p_documento text, p_razao text,
  p_fantasia text, p_cidade text, p_uf text, p_origem text default 'primeiro_uso')
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  insert into public.frn_fornecedores (omie_codigo, documento, razao_social, nome_fantasia, cidade, uf, origem,
                                       homologado, homologado_por, homologado_em)
  values (p_omie_codigo, regexp_replace(p_documento, '\D', '', 'g'), p_razao, p_fantasia, p_cidade, p_uf, p_origem,
          p_origem = 'carga_inicial',
          case when p_origem = 'carga_inicial' then 'carga_inicial' end,
          case when p_origem = 'carga_inicial' then now() end)
  on conflict (omie_codigo) do update
     set razao_social = excluded.razao_social, nome_fantasia = excluded.nome_fantasia,
         cidade = excluded.cidade, uf = excluded.uf, atualizado_em = now()   -- nunca mexe em homologação
  returning id into v_id;
  return v_id;
end;
$$;

-- 8.2 salvar rascunho (cria se p_id NULL). Só o dono, só rascunho.
create function public.frn_salvar_contrato(p_ator text, p_id uuid, p jsonb)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ator text := public.frn__ator(p_ator);
  c public.frn_contratos;
  v_tipo text := coalesce(p ->> 'tipo', 'especifico');
  v_classe text := nullif(p ->> 'classificacao', '');
  v_mo numeric := coalesce((p ->> 'valor_mo')::numeric, 0);
  v_mat numeric := coalesce((p ->> 'valor_mat')::numeric, 0);
  v_ini date := nullif(p ->> 'inicio', '')::date;
  v_fim date := nullif(p ->> 'fim', '')::date;
  v_sug text; v_cond text; v_n bigint; v_id uuid; r jsonb; i int := 0;
begin
  if v_tipo = 'global' and v_classe is not null and v_classe not in ('spot','manutencao') then
    raise exception 'Contrato global só pode ser Spot ou Manutenção.' using errcode = 'P0001';
  end if;
  if v_classe = 'material' then v_mo := 0; end if;
  if v_tipo = 'global' then v_mat := 0; end if;
  v_sug := public.frn_sugerir_condicao(v_tipo, v_classe, v_mo, v_ini, v_fim);
  v_cond := coalesce(nullif(p ->> 'condicao_codigo', ''), v_sug);
  if v_cond is not null and public.frn_condicao_permitida(v_cond, v_tipo, v_classe) is not true then
    raise exception 'Condição % não é permitida para este tipo de contrato.', v_cond using errcode = 'P0001';
  end if;

  if p_id is null then
    v_n := nextval('public.frn_ct_seq');
    insert into public.frn_contratos (seq, numero, fornecedor_id, tipo, criado_por)
    values (v_n, public.frn__numero('CT', v_n), (p ->> 'fornecedor_id')::uuid, v_tipo, v_ator)
    returning * into c;
    perform public.frn__evento(c.id, 'contrato_criado',
      'Contrato criado por ' || v_ator, v_ator, jsonb_build_object('condicao', v_cond, 'sugerida', v_sug));
  else
    select * into c from public.frn_contratos where id = p_id for update;
    if not found or c.criado_por is distinct from v_ator then
      raise exception 'Contrato não encontrado.' using errcode = 'P0001';
    end if;
    if c.status <> 'rascunho' then
      raise exception 'Só rascunho pode ser editado.' using errcode = 'P0001';
    end if;
  end if;

  update public.frn_contratos set
    fornecedor_id = coalesce((p ->> 'fornecedor_id')::uuid, fornecedor_id),
    tipo = v_tipo, classificacao = v_classe,
    obra_id = case when v_tipo = 'global' then null else nullif(p ->> 'obra_id', '')::uuid end,
    obra_rotulo = case when v_tipo = 'global' then null else p ->> 'obra_rotulo' end,
    cc_codigo = p ->> 'cc_codigo', cc_nome = p ->> 'cc_nome',
    escopo = coalesce(p ->> 'escopo', ''),
    valor_mo = v_mo, valor_mat = v_mat, inicio = v_ini, fim = v_fim,
    condicao_codigo = v_cond, condicao_sugerida = v_sug,
    excecao_condicao = p ->> 'excecao_condicao', excecao_justificativa = p ->> 'excecao_justificativa',
    emergencia_justificativa = p ->> 'emergencia_justificativa',
    atualizado_em = now()
  where id = c.id;

  -- tabela de preços: substitui inteira (só existe em rascunho)
  delete from public.frn_tabela_precos where contrato_id = c.id;
  if v_cond = 'SPOT_TABELA_FIXA' then
    for r in select * from jsonb_array_elements(coalesce(p -> 'tabela', '[]'::jsonb)) loop
      i := i + 1;
      insert into public.frn_tabela_precos (contrato_id, ordem, servico, unidade, preco)
      values (c.id, i, r ->> 'servico', r ->> 'unidade', (r ->> 'preco')::numeric);
    end loop;
  end if;
  return c.id;
end;
$$;

-- 8.3 enviar para aprovação (R-01..R-08)
create function public.frn_enviar_contrato(p_ator text, p_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos; f public.frn_fornecedores; k public.frn_condicoes;
begin
  select * into c from public.frn_contratos where id = p_id for update;
  if not found or c.criado_por is distinct from v_ator then raise exception 'Contrato não encontrado.' using errcode='P0001'; end if;
  if c.status <> 'rascunho' then raise exception 'Só rascunho pode ser enviado.' using errcode='P0001'; end if;
  select * into f from public.frn_fornecedores where id = c.fornecedor_id;
  select * into k from public.frn_condicoes where codigo = c.condicao_codigo;
  if public.frn_condicao_permitida(c.condicao_codigo, c.tipo, c.classificacao) is not true then
    raise exception 'Condição de pagamento inválida para este contrato.' using errcode='P0001'; end if;
  if c.classificacao = 'material' and c.valor_mat <= 0 then raise exception 'Informe o valor do material.' using errcode='P0001'; end if;
  if coalesce(c.classificacao,'') <> 'material' and c.valor_mo <= 0 then raise exception 'Informe o valor.' using errcode='P0001'; end if;
  if k.exige_justificativa and (coalesce(trim(c.excecao_condicao),'') = '' or coalesce(trim(c.excecao_justificativa),'') = '') then
    raise exception 'Exceção exige condição proposta e justificativa.' using errcode='P0001'; end if;
  if k.modo = 'tabela' and not exists (select 1 from public.frn_tabela_precos where contrato_id = c.id) then
    raise exception 'Preencha ao menos um serviço da tabela de preços.' using errcode='P0001'; end if;
  if not exists (select 1 from public.frn_anexos where contrato_id = c.id and tipo = 'proposta') then
    raise exception 'Anexe a proposta comercial.' using errcode='P0001'; end if;
  if f.homologado is not true and not exists (select 1 from public.frn_anexos where contrato_id = c.id and tipo = 'certidoes') then
    raise exception 'Fornecedor novo: anexe as certidões.' using errcode='P0001'; end if;

  -- o CHECK frn_ct_completo cobre obra, CC, escopo, datas, emergência
  update public.frn_contratos set status = 'aguardando', enviado_em = now(),
    contratacao_aprovada_por = null, contratacao_aprovada_em = null,
    condicoes_aprovadas_por = null, condicoes_aprovadas_em = null,
    devolvido_por = null, devolvido_em = null, devolvido_motivo = null, atualizado_em = now()
  where id = c.id;
  perform public.frn__evento(c.id, 'contrato_enviado', 'Enviado para aprovação de Eduardo e José', v_ator);
  if f.homologado is not true then
    perform public.frn__evento(c.id, 'homologacao_aberta', 'Fornecedor novo — homologação cadastral aberta', v_ator);
  end if;
end;
$$;

-- libera se as duas partes + homologação estiverem ok (interna)
create function public.frn__liberar_contrato(p_id uuid) returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare c public.frn_contratos; v_hom boolean;
begin
  select * into c from public.frn_contratos where id = p_id for update;
  select homologado into v_hom from public.frn_fornecedores where id = c.fornecedor_id;
  if c.status = 'aguardando' and c.contratacao_aprovada_em is not null
     and c.condicoes_aprovadas_em is not null and coalesce(v_hom, false) then
    update public.frn_contratos set status = 'aprovado', aprovado_em = now(), atualizado_em = now() where id = p_id;
    perform public.frn__evento(p_id, 'contrato_aprovado', 'Contrato aprovado — liberado para medição', null);
    return true;
  end if;
  return false;
end;
$$;

-- 8.4 aprovar parte ('contratacao' = Eduardo | 'condicoes' = José)
create function public.frn_aprovar_contrato(p_ator text, p_id uuid, p_parte text)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos;
begin
  if p_parte not in ('contratacao','condicoes') then raise exception 'Parte inválida.' using errcode='P0001'; end if;
  if public.frn_tem_papel(v_ator, case p_parte when 'contratacao' then 'aprovador_contratacao' else 'aprovador_financeiro' end) is not true then
    raise exception 'Sem permissão para aprovar esta parte.' using errcode='P0001'; end if;
  select * into c from public.frn_contratos where id = p_id for update;
  if not found or c.status <> 'aguardando' then raise exception 'Contrato não está aguardando aprovação.' using errcode='P0001'; end if;
  if p_parte = 'contratacao' then
    if c.contratacao_aprovada_em is not null then raise exception 'Contratação já aprovada.' using errcode='P0001'; end if;
    update public.frn_contratos set contratacao_aprovada_por = v_ator, contratacao_aprovada_em = now() where id = p_id;
    perform public.frn__evento(p_id, 'contratacao_aprovada', 'Contratação aprovada por ' || v_ator, v_ator);
  else
    if c.condicoes_aprovadas_em is not null then raise exception 'Condições já aprovadas.' using errcode='P0001'; end if;
    update public.frn_contratos set condicoes_aprovadas_por = v_ator, condicoes_aprovadas_em = now() where id = p_id;
    perform public.frn__evento(p_id, 'condicoes_aprovadas', 'Condições de pagamento aprovadas por ' || v_ator, v_ator);
  end if;
  return public.frn__liberar_contrato(p_id);
end;
$$;

-- 8.5 devolver (descarta as duas aprovações)
create function public.frn_devolver_contrato(p_ator text, p_id uuid, p_parte text, p_motivo text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos;
begin
  if p_parte not in ('contratacao','condicoes') then raise exception 'Parte inválida.' using errcode='P0001'; end if;
  if public.frn_tem_papel(v_ator, case p_parte when 'contratacao' then 'aprovador_contratacao' else 'aprovador_financeiro' end) is not true then
    raise exception 'Sem permissão.' using errcode='P0001'; end if;
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'Escreva o motivo.' using errcode='P0001'; end if;
  select * into c from public.frn_contratos where id = p_id for update;
  if not found or c.status <> 'aguardando' then raise exception 'Contrato não está aguardando aprovação.' using errcode='P0001'; end if;
  update public.frn_contratos set status = 'rascunho',
    contratacao_aprovada_por = null, contratacao_aprovada_em = null,
    condicoes_aprovadas_por = null, condicoes_aprovadas_em = null,
    devolvido_por = v_ator, devolvido_em = now(), devolvido_motivo = trim(p_motivo), atualizado_em = now()
  where id = p_id;
  perform public.frn__evento(p_id, 'contrato_devolvido',
    'Devolvido por ' || v_ator || ': "' || trim(p_motivo) || '" — voltou para Rascunho', v_ator,
    jsonb_build_object('parte', p_parte, 'motivo', trim(p_motivo)));
end;
$$;

-- 8.6 homologar fornecedor (José). Libera todos os contratos aguardando desse fornecedor.
create function public.frn_homologar_fornecedor(p_ator text, p_fornecedor uuid, p_cnpj boolean, p_banco boolean, p_certidoes boolean)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); f public.frn_fornecedores; v_ct uuid; v_ok boolean;
begin
  if public.frn_tem_papel(v_ator, 'aprovador_financeiro') is not true then
    raise exception 'Sem permissão para homologar.' using errcode='P0001'; end if;
  select * into f from public.frn_fornecedores where id = p_fornecedor for update;
  if not found then raise exception 'Fornecedor não encontrado.' using errcode='P0001'; end if;
  if f.homologado then return true; end if;
  v_ok := coalesce(p_cnpj,false) and coalesce(p_banco,false) and coalesce(p_certidoes,false);
  update public.frn_fornecedores set homolog_cnpj_ok = coalesce(p_cnpj,false), homolog_banco_ok = coalesce(p_banco,false),
    homolog_certidoes_ok = coalesce(p_certidoes,false), homologado = v_ok,
    homologado_por = case when v_ok then v_ator end, homologado_em = case when v_ok then now() end, atualizado_em = now()
  where id = p_fornecedor;
  if v_ok then
    for v_ct in select id from public.frn_contratos where fornecedor_id = p_fornecedor and status = 'aguardando' order by seq loop
      perform public.frn__evento(v_ct, 'fornecedor_homologado',
        'Fornecedor homologado por ' || v_ator || ' — CNPJ, dados bancários e certidões conferidos', v_ator);
      perform public.frn__liberar_contrato(v_ct);
    end loop;
  end if;
  return v_ok;
end;
$$;

-- 8.7 cancelar rascunho (nada é apagado)
create function public.frn_cancelar_contrato(p_ator text, p_id uuid, p_motivo text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos;
begin
  select * into c from public.frn_contratos where id = p_id for update;
  if not found or c.criado_por is distinct from v_ator then raise exception 'Contrato não encontrado.' using errcode='P0001'; end if;
  if c.status <> 'rascunho' then raise exception 'Só rascunho pode ser cancelado.' using errcode='P0001'; end if;
  update public.frn_contratos set status = 'cancelado', cancelado_em = now(), atualizado_em = now() where id = p_id;
  perform public.frn__evento(p_id, 'contrato_cancelado', 'Rascunho cancelado por ' || v_ator, v_ator,
    jsonb_build_object('motivo', p_motivo));
end;
$$;

-- 8.8 registrar anexo de contrato (proposta/certidões) — arquivo já enviado pelo servidor
create function public.frn_registrar_anexo_contrato(p_ator text, p_contrato uuid, p_tipo text,
  p_path text, p_nome text, p_tamanho int)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos; v_id uuid;
begin
  select * into c from public.frn_contratos where id = p_contrato for update;
  if not found or c.criado_por is distinct from v_ator then raise exception 'Contrato não encontrado.' using errcode='P0001'; end if;
  if c.status <> 'rascunho' then raise exception 'Anexos do contrato só no rascunho.' using errcode='P0001'; end if;
  if p_tipo not in ('proposta','certidoes','outro') then raise exception 'Tipo de anexo inválido.' using errcode='P0001'; end if;
  if p_path not like p_contrato::text || '/%' then raise exception 'Caminho de anexo inválido.' using errcode='P0001'; end if;
  insert into public.frn_anexos (contrato_id, tipo, storage_path, nome_arquivo, tamanho, enviado_por)
  values (p_contrato, p_tipo, p_path, p_nome, p_tamanho, v_ator) returning id into v_id;
  return v_id;
end;
$$;

-- 8.9 aditivo (valor ou condição). Nasce 'aguardando'.
create function public.frn_criar_aditivo(p_ator text, p_contrato uuid, p_tipo text, p_item text, p_valor numeric,
  p_condicao_para text, p_exc_condicao text, p_exc_justificativa text, p_motivo text)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos; v_seq int; v_id uuid; v_num text; k public.frn_condicoes;
begin
  select * into c from public.frn_contratos where id = p_contrato for update;
  if not found or public.frn__pode_operar(c, v_ator) is not true then raise exception 'Contrato não encontrado.' using errcode='P0001'; end if;
  if c.status <> 'aprovado' then raise exception 'Aditivo só em contrato aprovado.' using errcode='P0001'; end if;
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'Informe o motivo.' using errcode='P0001'; end if;
  v_seq := c.prox_aditivo;
  v_num := c.numero || '-' || v_seq;
  if p_tipo = 'valor' then
    if coalesce(p_valor, 0) <= 0 then raise exception 'Informe o valor do aditivo.' using errcode='P0001'; end if;
    if p_item is null or p_item not in ('mo','mat') then raise exception 'Item inválido.' using errcode='P0001'; end if;
    if (c.classificacao = 'material') <> (p_item = 'mat') or (c.tipo = 'global' and p_item = 'mat') then
      raise exception 'Item não combina com o contrato.' using errcode='P0001'; end if;
    insert into public.frn_aditivos (contrato_id, seq, numero, tipo, item, valor, motivo, criado_por)
    values (p_contrato, v_seq, v_num, 'valor', p_item, round(p_valor, 2), trim(p_motivo), v_ator) returning id into v_id;
    perform public.frn__evento(p_contrato, 'aditivo_pedido',
      'Aditivo ' || v_num || ' pedido: +R$ ' || public.frn__brl(round(p_valor,2)) || ' — ' || trim(p_motivo),
      v_ator, jsonb_build_object('valor', round(p_valor,2), 'item', p_item), v_id);
  elsif p_tipo = 'condicao' then
    if p_condicao_para is null or p_condicao_para = c.condicao_codigo then raise exception 'Escolha uma condição diferente da atual.' using errcode='P0001'; end if;
    if public.frn_condicao_permitida(p_condicao_para, c.tipo, c.classificacao) is not true then
      raise exception 'Condição não permitida para este contrato.' using errcode='P0001'; end if;
    select * into k from public.frn_condicoes where codigo = p_condicao_para;
    if k.exige_justificativa and (coalesce(trim(p_exc_condicao),'') = '' or coalesce(trim(p_exc_justificativa),'') = '') then
      raise exception 'Exceção exige condição proposta e justificativa.' using errcode='P0001'; end if;
    -- índice único parcial barra o segundo pendente (CA-3.5)
    insert into public.frn_aditivos (contrato_id, seq, numero, tipo, condicao_de, condicao_para,
                                     excecao_condicao, excecao_justificativa, motivo, criado_por)
    values (p_contrato, v_seq, v_num, 'condicao', c.condicao_codigo, p_condicao_para,
            nullif(trim(p_exc_condicao),''), nullif(trim(p_exc_justificativa),''), trim(p_motivo), v_ator) returning id into v_id;
    perform public.frn__evento(p_contrato, 'aditivo_pedido',
      'Aditivo de condição ' || v_num || ' pedido por ' || v_ator || ': ' || c.condicao_codigo || ' → ' || p_condicao_para,
      v_ator, jsonb_build_object('de', c.condicao_codigo, 'para', p_condicao_para), v_id);
  else
    raise exception 'Tipo de aditivo inválido.' using errcode='P0001';
  end if;
  update public.frn_contratos set prox_aditivo = v_seq + 1, atualizado_em = now() where id = p_contrato;
  return v_id;
end;
$$;

-- 8.10 aprovar parte do aditivo; aplica quando completo (R-30)
create function public.frn_aprovar_aditivo(p_ator text, p_id uuid, p_parte text)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); a public.frn_aditivos; c public.frn_contratos;
        v_pass jsonb; v_mant jsonb; v_completo boolean;
begin
  if p_parte not in ('contratacao','condicoes') then raise exception 'Parte inválida.' using errcode='P0001'; end if;
  if public.frn_tem_papel(v_ator, case p_parte when 'contratacao' then 'aprovador_contratacao' else 'aprovador_financeiro' end) is not true then
    raise exception 'Sem permissão para aprovar esta parte.' using errcode='P0001'; end if;
  select * into a from public.frn_aditivos where id = p_id;
  if not found then raise exception 'Aditivo não encontrado.' using errcode='P0001'; end if;
  select * into c from public.frn_contratos where id = a.contrato_id for update;   -- trava o contrato antes do aditivo
  select * into a from public.frn_aditivos where id = p_id for update;
  if a.status <> 'aguardando' then raise exception 'Aditivo não está aguardando.' using errcode='P0001'; end if;
  if a.tipo = 'condicao' and p_parte = 'contratacao' then raise exception 'Aditivo de condição não passa pela contratação.' using errcode='P0001'; end if;

  if p_parte = 'contratacao' then
    if a.contratacao_aprovada_em is not null then raise exception 'Já aprovado.' using errcode='P0001'; end if;
    update public.frn_aditivos set contratacao_aprovada_por = v_ator, contratacao_aprovada_em = now() where id = p_id;
  else
    if a.condicoes_aprovadas_em is not null then raise exception 'Já aprovado.' using errcode='P0001'; end if;
    update public.frn_aditivos set condicoes_aprovadas_por = v_ator, condicoes_aprovadas_em = now() where id = p_id;
  end if;
  perform public.frn__evento(a.contrato_id, 'aditivo_aprovado_parte',
    'Aditivo ' || a.numero || ': ' || case p_parte when 'contratacao' then 'contratação' else 'condições' end || ' aprovada(s) por ' || v_ator,
    v_ator, '{}'::jsonb, p_id);

  select * into a from public.frn_aditivos where id = p_id;
  v_completo := a.condicoes_aprovadas_em is not null and (a.tipo = 'condicao' or a.contratacao_aprovada_em is not null);
  if not v_completo then return false; end if;

  if a.tipo = 'condicao' then
    if public.frn_condicao_permitida(a.condicao_para, c.tipo, c.classificacao) is not true then
      raise exception 'Condição não permitida para este contrato.' using errcode='P0001'; end if;
    select coalesce(jsonb_agg(numero order by seq), '[]') into v_pass from public.frn_medicoes
      where contrato_id = c.id and item = 'mo' and status = 'solicitada';
    select coalesce(jsonb_agg(numero order by seq), '[]') into v_mant from public.frn_medicoes
      where contrato_id = c.id and item = 'mo' and status in ('aprovada','pagamento_solicitado','paga');
    update public.frn_medicoes set condicao_codigo = a.condicao_para
      where contrato_id = c.id and item = 'mo' and status = 'solicitada';
    update public.frn_contratos set condicao_codigo = a.condicao_para,
      excecao_condicao = coalesce(a.excecao_condicao, excecao_condicao),
      excecao_justificativa = coalesce(a.excecao_justificativa, excecao_justificativa), atualizado_em = now()
      where id = c.id;
    update public.frn_aditivos set status = 'aprovado', aprovado_em = now(),
      aplicado_resumo = jsonb_build_object('antes', a.condicao_de, 'depois', a.condicao_para, 'passaram', v_pass, 'mantiveram', v_mant)
      where id = p_id;
    perform public.frn__evento(c.id, 'aditivo_aprovado',
      'Aditivo ' || a.numero || ' aprovado — condição ' || a.condicao_de || ' → ' || a.condicao_para, v_ator,
      jsonb_build_object('antes', a.condicao_de, 'depois', a.condicao_para, 'passaram', v_pass, 'mantiveram', v_mant), p_id);
  else
    update public.frn_aditivos set status = 'aprovado', aprovado_em = now() where id = p_id;
    perform public.frn__evento(c.id, 'aditivo_aprovado',
      'Aditivo ' || a.numero || ' aprovado — novo total R$ ' ||
      public.frn__brl(public.frn_total(c.id,'mo') + public.frn_total(c.id,'mat')), v_ator,
      jsonb_build_object('valor', a.valor, 'item', a.item), p_id);
  end if;
  return true;
end;
$$;

create function public.frn_devolver_aditivo(p_ator text, p_id uuid, p_parte text, p_motivo text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); a public.frn_aditivos;
begin
  if p_parte not in ('contratacao','condicoes') then raise exception 'Parte inválida.' using errcode='P0001'; end if;
  if public.frn_tem_papel(v_ator, case p_parte when 'contratacao' then 'aprovador_contratacao' else 'aprovador_financeiro' end) is not true then
    raise exception 'Sem permissão.' using errcode='P0001'; end if;
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'Escreva o motivo.' using errcode='P0001'; end if;
  select * into a from public.frn_aditivos where id = p_id for update;
  if not found or a.status <> 'aguardando' then raise exception 'Aditivo não está aguardando.' using errcode='P0001'; end if;
  update public.frn_aditivos set status = 'devolvido', devolvido_por = v_ator, devolvido_em = now(), devolvido_motivo = trim(p_motivo)
  where id = p_id;
  perform public.frn__evento(a.contrato_id, 'aditivo_devolvido',
    'Aditivo ' || a.numero || ' devolvido por ' || v_ator || ': "' || trim(p_motivo) || '"', v_ator, '{}'::jsonb, p_id);
end;
$$;

-- 8.11 atendimentos (Spot mensal consolidado)
create function public.frn_registrar_atendimento(p_ator text, p_contrato uuid, p_data date, p_descricao text, p_valor numeric)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos; v_id uuid; v_saldo numeric;
begin
  select * into c from public.frn_contratos where id = p_contrato for update;
  if not found or public.frn__pode_operar(c, v_ator) is not true then raise exception 'Contrato não encontrado.' using errcode='P0001'; end if;
  if c.status <> 'aprovado' or c.condicao_codigo <> 'SPOT_MENSAL_CONSOLIDADO' then
    raise exception 'Atendimento só em contrato aprovado com Spot mensal consolidado.' using errcode='P0001'; end if;
  if coalesce(p_valor,0) <= 0 or p_data is null then raise exception 'Informe data, descrição e valor.' using errcode='P0001'; end if;
  v_saldo := public.frn_total(c.id,'mo') - public.frn_medido(c.id,'mo') - public.frn_em_aberto(c.id);
  if round(p_valor,2) > v_saldo then
    raise exception 'Passa do saldo do contrato. Saldo disponível: R$ %.', public.frn__brl(v_saldo) using errcode='P0001'; end if;
  insert into public.frn_atendimentos (contrato_id, data, descricao, valor, criado_por)
  values (c.id, p_data, trim(p_descricao), round(p_valor,2), v_ator) returning id into v_id;
  perform public.frn__evento(c.id, 'atendimento_registrado',
    'Atendimento de ' || to_char(p_data,'DD/MM') || ' — ' || trim(p_descricao) || ' — R$ ' || public.frn__brl(round(p_valor,2)), v_ator);
  return v_id;
end;
$$;

create function public.frn_remover_atendimento(p_ator text, p_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); t public.frn_atendimentos; c public.frn_contratos;
begin
  select * into t from public.frn_atendimentos where id = p_id;
  if not found then raise exception 'Atendimento não encontrado.' using errcode='P0001'; end if;
  select * into c from public.frn_contratos where id = t.contrato_id for update;
  if public.frn__pode_operar(c, v_ator) is not true then raise exception 'Atendimento não encontrado.' using errcode='P0001'; end if;
  select * into t from public.frn_atendimentos where id = p_id for update;
  if t.medicao_id is not null then raise exception 'Atendimento já faz parte de uma medição.' using errcode='P0001'; end if;
  delete from public.frn_atendimentos where id = p_id;   -- só atendimento em aberto, nunca medido
  perform public.frn__evento(c.id, 'atendimento_removido',
    'Atendimento de ' || to_char(t.data,'DD/MM') || ' removido — ' || t.descricao || ' — R$ ' || public.frn__brl(t.valor), v_ator);
end;
$$;

-- 8.12 solicitar medição (R-22..R-26). p:
--  {contrato_id, item, pct?, valor?, descricao?, data_servico?, tabela_preco_id?, quantidade?, aceite,
--   nf_numero, forma_pagamento, codigo_pagamento?, pix_chave?, categoria_codigo, categoria_nome,
--   tipo_documento_codigo, tipo_documento_nome, cc_codigo, cc_nome,
--   anexos:[{tipo, storage_path, nome, tamanho}]}
create function public.frn_solicitar_medicao(p_ator text, p jsonb)
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_ator text := public.frn__ator(p_ator);
  c public.frn_contratos; k public.frn_condicoes; tp public.frn_tabela_precos;
  v_item text; v_modo text; v_cond text; v_total numeric; v_medido numeric; v_aberto numeric;
  v_valor numeric; v_pct numeric := nullif(p ->> 'pct','')::numeric; v_desc text := nullif(trim(p ->> 'descricao'),'');
  v_depois numeric; v_aceite_exigido boolean := false; v_aceite boolean := coalesce((p ->> 'aceite')::boolean, false);
  v_n bigint; v_id uuid; v_forma text := p ->> 'forma_pagamento'; v_cod text := nullif(trim(p ->> 'codigo_pagamento'),'');
  r record; an jsonb; v_qtd int;
begin
  select * into c from public.frn_contratos where id = (p ->> 'contrato_id')::uuid for update;
  if not found or public.frn__pode_operar(c, v_ator) is not true then raise exception 'Contrato não encontrado.' using errcode='P0001'; end if;
  if c.status <> 'aprovado' then raise exception 'Só contrato aprovado recebe medição.' using errcode='P0001'; end if;

  v_item := case when c.classificacao = 'material' then 'mat' when c.tipo = 'global' then 'mo'
                 else coalesce(p ->> 'item', 'mo') end;
  if v_item not in ('mo','mat') then raise exception 'Item inválido.' using errcode='P0001'; end if;
  v_cond := case when v_item = 'mat' then 'MATERIAL_MEDIANTE_NF' else c.condicao_codigo end;
  select * into k from public.frn_condicoes where codigo = v_cond;
  v_total := public.frn_total(c.id, v_item);
  if v_total <= 0 then raise exception 'Este contrato não tem valor de % para medir.', case v_item when 'mat' then 'material' else 'mão de obra' end using errcode='P0001'; end if;
  v_medido := public.frn_medido(c.id, v_item);
  v_aberto := case when v_item = 'mo' then public.frn_em_aberto(c.id) else 0 end;

  -- valor por modo
  if v_item = 'mat' then
    v_modo := 'material';
    v_valor := coalesce(nullif(p ->> 'valor','')::numeric, round(v_total * v_pct / 100, 2));
    if v_desc is null then raise exception 'Descreva o material entregue.' using errcode='P0001'; end if;
  elsif c.tipo = 'global' and k.modo = 'tabela' then
    v_modo := 'tabela';
    select * into tp from public.frn_tabela_precos where id = (p ->> 'tabela_preco_id')::uuid and contrato_id = c.id;
    if not found or coalesce((p ->> 'quantidade')::numeric, 0) <= 0 then raise exception 'Escolha o serviço e a quantidade.' using errcode='P0001'; end if;
    v_valor := round(tp.preco * (p ->> 'quantidade')::numeric, 2);    -- ignora valor enviado (CA-5.6)
    v_desc := tp.servico || ' — ' || (p ->> 'quantidade') || ' × ' || tp.unidade;
  elsif c.tipo = 'global' and k.modo = 'consolidado' then
    v_modo := 'consolidado';
    select coalesce(sum(valor),0), count(*) into v_valor, v_qtd from public.frn_atendimentos where contrato_id = c.id and medicao_id is null;
    if v_valor <= 0 then raise exception 'Registre ao menos um atendimento.' using errcode='P0001'; end if;
    v_aberto := 0;   -- os abertos viram esta medição
    v_desc := 'Fechamento — ' || v_qtd || ' atendimento' || case when v_qtd > 1 then 's' else '' end;
  elsif c.tipo = 'global' then
    v_modo := 'servico';
    v_valor := nullif(p ->> 'valor','')::numeric;
    if v_desc is null then raise exception 'Descreva o serviço executado.' using errcode='P0001'; end if;
  else
    v_modo := 'parcela';
    if k.modo = 'excecao' then v_pct := null; end if;   -- exceção: só em R$
    v_valor := coalesce(nullif(p ->> 'valor','')::numeric, round(v_total * v_pct / 100, 2));
    if v_desc is null then
      select nome into v_desc from public.frn_parcelas_mo(c.id) where fim > v_medido order by ordem limit 1;
      v_desc := coalesce(v_desc, 'Medição');
    end if;
  end if;
  v_valor := round(coalesce(v_valor, 0), 2);
  if v_valor <= 0 then raise exception 'Informe o valor.' using errcode='P0001'; end if;

  -- R-22: trava 100% (com ajuste de 1 centavo de arredondamento quando veio em %)
  if v_medido + v_aberto + v_valor > v_total then
    if v_pct is not null and v_medido + v_aberto + v_valor - v_total <= 0.01 then
      v_valor := v_total - v_medido - v_aberto;
    else
      raise exception 'Passa de 100%%. Ainda dá para medir no máximo R$ %.',
        public.frn__brl(greatest(v_total - v_medido - v_aberto, 0)) using errcode='P0001';
    end if;
  end if;
  v_depois := v_medido + v_valor;

  -- R-23 / R-24
  if v_item = 'mo' then
    if c.tipo = 'global' then
      v_aceite_exigido := true;
    else
      for r in select * from public.frn_parcelas_mo(c.id) loop
        if r.final and v_medido < r.fim and v_depois >= r.fim then v_aceite_exigido := true; end if;
        if r.retencao and c.aceite_final_em is null and v_depois > r.ini then
          raise exception 'Os 10%% retidos só são liberados depois do aceite final. Agora dá para medir até R$ %.',
            public.frn__brl(greatest(r.ini - v_medido, 0)) using errcode='P0001';
        end if;
      end loop;
    end if;
  end if;
  if v_aceite_exigido and v_aceite is not true then
    raise exception 'Marque o aceite operacional.' using errcode='P0001'; end if;

  -- documentos e dados de pagamento
  if not exists (select 1 from jsonb_array_elements(coalesce(p -> 'anexos','[]')) x where x ->> 'tipo' = 'nf') then
    raise exception 'Anexe a NF.' using errcode='P0001'; end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(p -> 'anexos','[]')) x
                 where x ->> 'tipo' in ('evidencia','comprovante_entrega')) then
    raise exception 'Anexe a evidência do serviço ou o comprovante de entrega.' using errcode='P0001'; end if;
  if v_forma in ('boleto','guia','pix_qrcode') and v_cod is null then
    raise exception 'Informe o código de pagamento.' using errcode='P0001'; end if;
  if v_forma = 'pix_chave' then v_cod := null; end if;
  -- demais (forma inválida, NF, categoria, tipo doc, CC vazios) caem nos CHECKs/NOT NULL da tabela

  v_n := nextval('public.frn_md_seq');
  insert into public.frn_medicoes (seq, numero, contrato_id, item, modo, descricao, data_servico, tabela_preco_id, quantidade,
    valor, percentual, condicao_codigo, competencia, aceite_operacional,
    nf_numero, forma_pagamento, codigo_pagamento, pix_chave, categoria_codigo, categoria_nome,
    tipo_documento_codigo, tipo_documento_nome, cc_codigo, cc_nome, solicitado_por)
  values (v_n, public.frn__numero('MD', v_n), c.id, v_item, v_modo, v_desc, nullif(p ->> 'data_servico','')::date,
    case when v_modo = 'tabela' then tp.id end, case when v_modo = 'tabela' then (p ->> 'quantidade')::numeric end,
    v_valor, round(v_valor / v_total * 100, 4), v_cond, public.frn_competencia(now()), v_aceite_exigido and v_aceite,
    trim(p ->> 'nf_numero'), v_forma, v_cod, nullif(trim(p ->> 'pix_chave'),''),
    p ->> 'categoria_codigo', p ->> 'categoria_nome', p ->> 'tipo_documento_codigo', p ->> 'tipo_documento_nome',
    coalesce(nullif(p ->> 'cc_codigo',''), c.cc_codigo), coalesce(nullif(p ->> 'cc_nome',''), c.cc_nome), v_ator)
  returning id into v_id;

  if v_modo = 'consolidado' then
    update public.frn_atendimentos set medicao_id = v_id where contrato_id = c.id and medicao_id is null;
  end if;
  for an in select * from jsonb_array_elements(coalesce(p -> 'anexos','[]')) loop
    if (an ->> 'storage_path') not like c.id::text || '/%' then raise exception 'Caminho de anexo inválido.' using errcode='P0001'; end if;
    insert into public.frn_anexos (contrato_id, medicao_id, tipo, storage_path, nome_arquivo, tamanho, enviado_por)
    values (c.id, v_id, an ->> 'tipo', an ->> 'storage_path', an ->> 'nome', (an ->> 'tamanho')::int, v_ator);
  end loop;
  perform public.frn__evento(c.id, 'medicao_solicitada',
    'Medição ' || public.frn__numero('MD', v_n) || case when v_item = 'mat' then ' (material)' else '' end ||
    ' solicitada — R$ ' || public.frn__brl(v_valor) || ' · ' || v_desc, v_ator,
    jsonb_build_object('valor', v_valor, 'competencia', public.frn_competencia(now())), null, v_id);
  return v_id;
end;
$$;

-- 8.13 aprovar / devolver medição (Eduardo)
create function public.frn_aprovar_medicao(p_ator text, p_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); m public.frn_medicoes;
begin
  if public.frn_tem_papel(v_ator, 'aprovador_contratacao') is not true then
    raise exception 'Sem permissão para aprovar medição.' using errcode='P0001'; end if;
  select * into m from public.frn_medicoes where id = p_id for update;
  if not found then raise exception 'Medição não encontrada.' using errcode='P0001'; end if;
  if m.status <> 'solicitada' then raise exception 'Medição não está aguardando aprovação.' using errcode='P0001'; end if;  -- CA-6.2
  update public.frn_medicoes set status = 'aprovada', aprovado_por = v_ator, aprovado_em = now() where id = p_id;
  perform public.frn__evento(m.contrato_id, 'medicao_aprovada', 'Medição ' || m.numero || ' aprovada por ' || v_ator, v_ator,
    '{}'::jsonb, null, p_id);
end;
$$;

create function public.frn_devolver_medicao(p_ator text, p_id uuid, p_motivo text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); m public.frn_medicoes;
begin
  if public.frn_tem_papel(v_ator, 'aprovador_contratacao') is not true then
    raise exception 'Sem permissão para devolver medição.' using errcode='P0001'; end if;
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'Escreva o motivo.' using errcode='P0001'; end if;
  select * into m from public.frn_medicoes where id = p_id for update;
  if not found or m.status <> 'solicitada' then raise exception 'Medição não está aguardando aprovação.' using errcode='P0001'; end if;
  update public.frn_medicoes set status = 'devolvida', devolvido_por = v_ator, devolvido_em = now(), devolvido_motivo = trim(p_motivo)
  where id = p_id;
  update public.frn_atendimentos set medicao_id = null where medicao_id = p_id;   -- CA-6.3
  perform public.frn__evento(m.contrato_id, 'medicao_devolvida',
    'Medição ' || m.numero || ' devolvida por ' || v_ator || ': "' || trim(p_motivo) || '"', v_ator, '{}'::jsonb, null, p_id);
end;
$$;

-- 8.14 retorno da integração (DECISÃO-PENDENTE P1/P3 só muda QUEM chama). p_ator NULL = sistema.
create function public.frn_registrar_solicitacao_fin(p_id uuid, p_fin_ref text, p_vencimento date, p_erro text default null)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare m public.frn_medicoes;
begin
  select * into m from public.frn_medicoes where id = p_id for update;
  if not found or m.status <> 'aprovada' then raise exception 'Medição não está aprovada aguardando o Financeiro.' using errcode='P0001'; end if;
  if p_erro is not null then
    update public.frn_medicoes set fin_ultimo_erro = left(p_erro, 1000) where id = p_id;
    perform public.frn__evento(m.contrato_id, 'solicitacao_financeiro_falhou', 'Falha ao criar a solicitação no Financeiro — tentar de novo', null,
      jsonb_build_object('erro', left(p_erro, 1000)), null, p_id);
    return;
  end if;
  if coalesce(trim(p_fin_ref),'') = '' or p_vencimento is null then raise exception 'Referência e vencimento obrigatórios.' using errcode='P0001'; end if;
  update public.frn_medicoes set status = 'pagamento_solicitado', fin_ref = trim(p_fin_ref), fin_criada_em = now(),
    vencimento = p_vencimento, fin_ultimo_erro = null where id = p_id;
  perform public.frn__evento(m.contrato_id, 'solicitacao_financeiro_criada',
    'Solicitação ' || trim(p_fin_ref) || ' criada no Financeiro (' || m.condicao_codigo || ', vencimento ' || to_char(p_vencimento,'DD/MM/YYYY') || ')',
    null, jsonb_build_object('fin_ref', trim(p_fin_ref), 'vencimento', p_vencimento), null, p_id);
end;
$$;

create function public.frn_registrar_pagamento(p_fin_ref text, p_pago_em date, p_valor_pago numeric)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare m public.frn_medicoes; c public.frn_contratos;
begin
  select * into m from public.frn_medicoes where fin_ref = p_fin_ref for update;
  if not found then raise exception 'Solicitação % não pertence ao Fornecedores.', p_fin_ref using errcode='P0001'; end if;
  if m.status = 'paga' then return; end if;    -- idempotente
  if m.status <> 'pagamento_solicitado' or p_pago_em is null or coalesce(p_valor_pago,0) <= 0 then
    raise exception 'Pagamento inválido para %.', m.numero using errcode='P0001'; end if;
  update public.frn_medicoes set status = 'paga', pago_em = p_pago_em, valor_pago = round(p_valor_pago,2) where id = m.id;
  perform public.frn__evento(m.contrato_id, 'pagamento_registrado',
    'Pagamento ' || m.fin_ref || ' registrado — pago em ' || to_char(p_pago_em,'DD/MM/YYYY') || ' (data do Omie)', null,
    jsonb_build_object('pago_em', p_pago_em, 'valor_pago', round(p_valor_pago,2)), null, m.id);
  -- encerramento automático: tudo pago e nada pendente
  select * into c from public.frn_contratos where id = m.contrato_id for update;
  if c.status = 'aprovado'
     and (select coalesce(sum(valor),0) from public.frn_medicoes where contrato_id = c.id and status = 'paga')
         >= public.frn_total(c.id,'mo') + public.frn_total(c.id,'mat')
     and not exists (select 1 from public.frn_medicoes where contrato_id = c.id and status in ('solicitada','aprovada','pagamento_solicitado'))
     and not exists (select 1 from public.frn_aditivos where contrato_id = c.id and status = 'aguardando') then
    update public.frn_contratos set status = 'encerrado', encerrado_em = now(), encerrado_motivo = '100% medido e pago' where id = c.id;
    perform public.frn__evento(c.id, 'contrato_encerrado', 'Contrato encerrado — 100% medido e pago', null);
  end if;
end;
$$;

-- 8.15 aceite final (R-25)
create function public.frn_registrar_aceite_final(p_ator text, p_contrato uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos; v_ini numeric;
begin
  select * into c from public.frn_contratos where id = p_contrato for update;
  if not found or (coalesce(c.criado_por = v_ator, false) or public.frn_tem_papel(v_ator,'aprovador_contratacao')) is not true then
    raise exception 'Contrato não encontrado.' using errcode='P0001'; end if;
  if c.status <> 'aprovado' or c.aceite_final_em is not null then raise exception 'Aceite final indisponível.' using errcode='P0001'; end if;
  select ini into v_ini from public.frn_parcelas_mo(c.id) where retencao limit 1;
  if v_ini is null then raise exception 'Este contrato não tem retenção.' using errcode='P0001'; end if;
  if public.frn_medido(c.id,'mo') < v_ini then raise exception 'Aceite final só com 90%% da mão de obra medida.' using errcode='P0001'; end if;
  update public.frn_contratos set aceite_final_por = v_ator, aceite_final_em = now(), atualizado_em = now() where id = c.id;
  perform public.frn__evento(c.id, 'aceite_final', 'Aceite final registrado por ' || v_ator || ' — retenção liberada para medição', v_ator);
end;
$$;

-- 8.16 encerrar manual (Eduardo)
create function public.frn_encerrar_contrato(p_ator text, p_id uuid, p_motivo text)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos;
begin
  if public.frn_tem_papel(v_ator, 'aprovador_contratacao') is not true then raise exception 'Sem permissão.' using errcode='P0001'; end if;
  if length(trim(coalesce(p_motivo,''))) < 5 then raise exception 'Escreva o motivo.' using errcode='P0001'; end if;
  select * into c from public.frn_contratos where id = p_id for update;
  if not found or c.status <> 'aprovado' then raise exception 'Só contrato aprovado pode ser encerrado.' using errcode='P0001'; end if;
  if exists (select 1 from public.frn_medicoes where contrato_id = p_id and status in ('solicitada','aprovada')) then
    raise exception 'Há medição pendente neste contrato.' using errcode='P0001'; end if;
  if exists (select 1 from public.frn_aditivos where contrato_id = p_id and status = 'aguardando') then
    raise exception 'Há aditivo aguardando aprovação.' using errcode='P0001'; end if;
  update public.frn_contratos set status = 'encerrado', encerrado_por = v_ator, encerrado_em = now(),
    encerrado_motivo = trim(p_motivo), atualizado_em = now() where id = p_id;
  perform public.frn__evento(p_id, 'contrato_encerrado', 'Contrato encerrado por ' || v_ator || ': "' || trim(p_motivo) || '"', v_ator);
end;
$$;

-- 8.17 documento gerado (1ª impressão após aprovação)
create function public.frn_registrar_documento(p_ator text, p_id uuid)
returns void language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_ator text := public.frn__ator(p_ator); c public.frn_contratos;
begin
  select * into c from public.frn_contratos where id = p_id for update;
  if not found or public.frn__pode_operar(c, v_ator) is not true then raise exception 'Contrato não encontrado.' using errcode='P0001'; end if;
  if c.status in ('aprovado','encerrado') and c.documento_gerado_em is null then
    update public.frn_contratos set documento_gerado_em = now() where id = p_id;
    perform public.frn__evento(p_id, 'documento_gerado', 'Documento do contrato gerado', v_ator);
  end if;
end;
$$;

-- 8.18 obras para o select da tela 2 (dúvida C1). Só leitura; nunca escreve em obras_*.
create function public.frn_listar_obras()
returns table (id uuid, rotulo text)
language sql stable security definer
set search_path = public, pg_temp set row_security = off
as $$
  select o.id, concat_ws(' · ', nullif(o.os,''), nullif(o.loja,''), nullif(o.descricao,''))
  from public.obras_obra o
  where o.etapa not in ('faturado','cancelado')
  order by 2
$$;

-- ============================================================================
-- 9. PRIVILÉGIOS DE FUNÇÃO — escrita só service_role; leitura auxiliar para authenticated
-- ============================================================================
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'frn\_%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end;
$$;
-- usadas dentro das policies / telas (só leitura, devolvem boolean/derivados)
grant execute on function public.frn_email() to authenticated;
grant execute on function public.frn_e_admin(text) to authenticated;
grant execute on function public.frn_ve_tudo(text) to authenticated;
-- frn_parcelas_mo NÃO é concedida a authenticated: é definer com row_security off e devolveria
-- parcelas de contrato alheio. Parcelas na tela vêm de lib/regras/parcelas.ts (servidor).

commit;

-- ============================================================================
-- 10. SEED DE PAPÉIS (dúvida C5 — e-mails a confirmar; rodar à mão, pelo PAT)
-- ============================================================================
-- insert into public.frn_papeis (user_email, papel, concedido_por) values
--   ('<eduardo>@manfac.com.br', 'aprovador_contratacao', 'joao (seed)'),
--   ('<jose>@manfac.com.br',    'aprovador_financeiro',  'joao (seed)');

-- ============================================================================
-- 11. VERIFICAÇÃO PÓS-COMMIT — uma linha por invariante, OK ou *** FALHOU ***
-- ============================================================================
select 'RLS ligada em todas as frn_*' as invariante,
  case when not exists (select 1 from pg_tables where schemaname='public' and tablename like 'frn\_%' and not rowsecurity)
       then 'OK' else '*** FALHOU ***' end as resultado
union all
select 'authenticated sem INSERT/UPDATE/DELETE em frn_*',
  case when not exists (select 1 from information_schema.role_table_grants
                        where table_schema='public' and table_name like 'frn\_%' and grantee in ('authenticated','anon')
                          and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE'))
       then 'OK' else '*** FALHOU ***' end
union all
select 'anon sem SELECT em frn_*',
  case when not exists (select 1 from information_schema.role_table_grants
                        where table_schema='public' and table_name like 'frn\_%' and grantee = 'anon')
       then 'OK' else '*** FALHOU ***' end
union all
select 'nenhuma policy de escrita em frn_*',
  case when not exists (select 1 from pg_policies where schemaname='public' and tablename like 'frn\_%' and cmd <> 'SELECT')
       then 'OK' else '*** FALHOU ***' end
union all
select 'toda frn_* tem policy de SELECT',
  case when (select count(distinct tablename) from pg_policies where schemaname='public' and tablename like 'frn\_%' and cmd='SELECT')
          = (select count(*) from pg_tables where schemaname='public' and tablename like 'frn\_%')
       then 'OK' else '*** FALHOU ***' end
union all
select 'funções de escrita não executáveis por authenticated',
  case when not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                        where n.nspname='public' and p.proname in ('frn_salvar_contrato','frn_enviar_contrato','frn_aprovar_contrato',
                          'frn_devolver_contrato','frn_homologar_fornecedor','frn_criar_aditivo','frn_aprovar_aditivo',
                          'frn_solicitar_medicao','frn_aprovar_medicao','frn_devolver_medicao','frn_registrar_pagamento',
                          'frn_registrar_solicitacao_fin','frn_upsert_fornecedor','frn_encerrar_contrato')
                          and has_function_privilege('authenticated', p.oid, 'EXECUTE'))
       then 'OK' else '*** FALHOU ***' end
union all
select '14 condições semeadas',
  case when (select count(*) from public.frn_condicoes) = 14 then 'OK' else '*** FALHOU ***' end
union all
select 'condições em parcelas somam 100%',
  case when not exists (select 1 from public.frn_condicoes c where c.modo='parcelas'
                        and (select sum((x->>'pct')::numeric) from jsonb_array_elements(c.parcelas) x) <> 100)
       then 'OK' else '*** FALHOU ***' end
union all
select 'SPOT_A_VISTA D+0 e SPOT_D30 D+30',
  case when (select dias_pagamento from public.frn_condicoes where codigo='SPOT_A_VISTA') = 0
        and (select dias_pagamento from public.frn_condicoes where codigo='SPOT_D30') = 30 then 'OK' else '*** FALHOU ***' end
union all
select 'só TABELA_FIXA e CONSOLIDADO são so_global',
  case when (select string_agg(codigo, ',' order by codigo) from public.frn_condicoes where so_global)
          = 'SPOT_MENSAL_CONSOLIDADO,SPOT_TABELA_FIXA' then 'OK' else '*** FALHOU ***' end
union all
select 'frn_ve_tudo(NULL) = false (não falha aberto)',
  case when public.frn_ve_tudo(null) is false then 'OK' else '*** FALHOU ***' end
union all
select 'frn_condicao_permitida(inexistente) = false',
  case when public.frn_condicao_permitida('NAO_EXISTE','global','spot') is false then 'OK' else '*** FALHOU ***' end
union all
select 'numeração não trunca acima de 9999',
  case when public.frn__numero('CT', 7) = 'CT-0007' and public.frn__numero('CT', 12345) = 'CT-12345' then 'OK' else '*** FALHOU ***' end
union all
select 'competência: 25/10 23h30 SP → outubro; 26/10 00h10 SP → novembro',
  case when public.frn_competencia('2026-10-25 23:30-03') = date '2026-10-01'
        and public.frn_competencia('2026-10-26 00:10-03') = date '2026-11-01' then 'OK' else '*** FALHOU ***' end
union all
select 'frn__brl(1234567.5) = 1.234.567,50',
  case when public.frn__brl(1234567.5) = '1.234.567,50' then 'OK' else '*** FALHOU ***' end
union all
select 'sugestão nas fronteiras (1500/1500,01/5000/8000/8000,01)',
  case when public.frn_sugerir_condicao('especifico','obra',1500,null,null) = 'OBRA_PEQUENA_UNICA_D7'
        and public.frn_sugerir_condicao('especifico','obra',1500.01,null,null) = 'OBRA_MEDIA_50_50'
        and public.frn_sugerir_condicao('especifico','obra',5000,null,null) = 'OBRA_MEDIA_50_50'
        and public.frn_sugerir_condicao('especifico','obra',8000,null,null) = 'OBRA_MAIOR_30_30_40'
        and public.frn_sugerir_condicao('especifico','obra',8000.01,null,null) = 'OBRA_RETENCAO_10'
       then 'OK' else '*** FALHOU ***' end
union all
select 'bucket fornecedores-anexos privado',
  case when exists (select 1 from storage.buckets where id='fornecedores-anexos' and not public) then 'OK' else '*** FALHOU ***' end;

-- Testes de comportamento (PGlite, fatia F1) — um por CA marcado "função" na spec:
-- CA-1.1 RLS dono x alheio x papel x admin x sem sessão; CA-3.1/3.2/3.3/3.4/3.5; CA-4.3/4.5;
-- CA-5.1 (estouro), CA-5.2 (duas sessões concorrentes), CA-5.3/5.4/5.5/5.6/5.7/5.8; CA-6.1/6.2/6.3;
-- paridade frn_parcelas_mo × lib/regras/parcelas.ts com tests/casos-regras.json.
