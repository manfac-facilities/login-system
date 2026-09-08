-- ============================================================
-- Controle de Obras — v0 de treinamento — 2026-09-05
-- Migration da §4 da spec
-- docs/cliente/2026-08-31-sistema-controle-de-obras/spec-v0-treinamento.md
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Não existe CLI de migration neste projeto.
--
-- O arquivo é IDEMPOTENTE: pode ser rodado mais de uma vez sem erro.
-- Tudo é `if not exists` / `drop ... if exists` antes de criar, e o seed de
-- obras_pessoa usa `on conflict do nothing`.
--
-- LIMITE CONHECIDO DA IDEMPOTÊNCIA: `create table if not exists` não altera
-- uma tabela que já exista com colunas diferentes. Se este arquivo for
-- editado depois de a v0 subir, a mudança de coluna tem que virar um
-- `alter table ... add column if not exists` explícito aqui embaixo, não uma
-- edição do `create table` lá em cima — que seria silenciosamente ignorada.
--
-- DUAS ARMADILHAS DE PL/pgSQL QUE JÁ MORDERAM NESTE PROJETO (spec §4.7):
--
-- 1. Função de autorização NUNCA pode devolver NULL — a guarda falharia
--    ABERTA (`if not f() then raise` não dispara com NULL). As duas funções
--    abaixo usam `exists(...)`, que devolve sempre true/false, inclusive
--    quando o JWT não tem claim de e-mail. Nada de `in (lista)`.
--
-- 2. Trigger compartilhada entre tabelas de colunas diferentes levanta
--    `42703 record "new" has no field` — `if TG_TABLE_NAME = 'x' and
--    new.campo ...` é UMA expressão SQL e o `and` NÃO protege. Aqui a
--    armadilha foi evitada por construção: a única trigger deste módulo
--    (`obras_touch_updated_at`) não testa TG_TABLE_NAME e está presa a UMA
--    tabela só — obras_obra, a única com coluna `updated_at`. Se algum dia
--    ela for reaproveitada em outra tabela, o teste de tabela tem que ser um
--    `if` EXTERNO com o campo aninhado dentro.
--
-- TRANSAÇÃO EXPLÍCITA (revisão de 08/09/2026, véspera do treinamento):
-- o arquivo roda inteiro dentro de `begin`/`commit`. O SQL Editor manda o
-- script num batch só, e o Postgres já executaria isso numa transação
-- implícita — mas isso é comportamento do CLIENTE, não garantia do arquivo,
-- e estado parcial em produção é caro. Com o envelope, qualquer erro no meio
-- (o candidato mais provável é a seção 7, que mexe em `storage.objects`,
-- de dono `supabase_storage_admin`) desfaz tudo e deixa o banco intocado,
-- em vez de metade aplicada.
-- ============================================================

begin;


-- ============================================================
-- 1. TABELAS
-- ============================================================

-- ------------------------------------------------------------
-- 1.1 obras_obra — a obra. 187 linhas na carga inicial.
--
-- NADA DE CAMPO DERIVADO AQUI. `dias`, `atraso`, `fim_calc`, `critico`,
-- `sem_cobertura`, `estourou`, `travado` e `encalhada` são calculados no
-- código a cada render (app/obras/_lib/tipos.ts), exatamente como no mockup.
-- Gravar derivado é garantir que ele fique velho.
-- ------------------------------------------------------------
create table if not exists public.obras_obra (
  id uuid primary key default gen_random_uuid(),

  -- Identificação
  os text,
  loja text,
  descricao text,
  tipo text,
  valor numeric,
  origem text,

  -- Responsáveis
  analista_cliente text,           -- quem aprova do lado da DPSP
  pcm text,                        -- o responsável Manfac; é por ele que o diário filtra
  equipe text,

  -- Autorização — os dois destravamentos são INDEPENDENTES (decisão I).
  -- Obra sem nenhum dos dois está "sem cobertura", e esse é o estado de risco
  -- que hoje ninguém enxerga. A regra vive no código, não numa coluna.
  os_aprovada boolean not null default false,
  liberado_por text,
  liberado_em date,

  -- Situação
  etapa text not null default 'definir'
    check (etapa in ('definir','levantamento','andamento','paralisado',
                     'relatorio','aprovarOS','fecharOS','pendFat','faturado')),
  bloqueio text default 'Sem bloqueio',
  -- mau uso é CLASSIFICAÇÃO, nunca etapa (decisão J). A obra segue a esteira
  -- normal e carrega só uma etiqueta.
  mau_uso boolean not null default false,
  prioridade text check (prioridade is null or prioridade in ('Normal','Urgente')),

  -- Cronograma
  aprovacao date,
  inicio_plan date,
  inicio_real date,
  duracao int,
  fim_real date,
  desde_etapa date,

  -- Marcos: 6 colunas de data, não tabela (spec §4.1)
  marco_exec_fim date,
  marco_relatorio date,
  marco_os_aprov date,
  marco_fechou_os date,
  marco_liberou_fat date,
  marco_faturou date,

  -- Pendências
  pendencia text,
  pend_resp text,
  pend_prazo date,
  prox_acao text,

  -- Controle
  atualizacao date,
  nao_andou_seguidos int not null default 0,
  bloqueada_dias int not null default 0,
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz,

  -- Autoria da troca de etapa.
  -- O mockup não tem gatilho para sair de "Levantamento" — é a decisão técnica 6 da
  -- spec, que criou a troca manual na ficha. Sem estas duas colunas a troca acontece
  -- sem deixar rastro, e numa obra parada há 123 dias saber QUEM mexeu e QUANDO é
  -- justamente o que faltava na planilha.
  etapa_por text,
  etapa_em timestamptz
);

-- Idempotência: `create table if not exists` não acrescenta coluna em tabela que já
-- existe. Quem tiver rodado uma versão anterior deste arquivo ganha as duas colunas aqui.
alter table public.obras_obra add column if not exists etapa_por text;
alter table public.obras_obra add column if not exists etapa_em timestamptz;

-- ------------------------------------------------------------
-- 1.2 obras_diario — um registro por obra por dia.
-- ------------------------------------------------------------
create table if not exists public.obras_diario (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  data date not null,
  andou boolean not null,
  -- ÚNICA TRAVA DO DIÁRIO (decisão C): "não andou" exige motivo. Nada mais
  -- trava o salvamento — nem item, nem observação, nem foto.
  motivo text,
  item text not null,
  obs text,
  foto_path text,
  registrado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint obras_diario_obra_data_uniq unique (obra_id, data),
  constraint obras_diario_motivo_quando_nao_andou
    check (andou or (motivo is not null and motivo <> ''))
);

-- ------------------------------------------------------------
-- 1.3 obras_tarefa — a falta virando tarefa com dono e prazo.
--
-- "Vencida" NUNCA é gravada: é `situacao <> 'respondida' and prazo < hoje`,
-- calculado no código. Gravar vencida é gravar derivado.
-- ------------------------------------------------------------
create table if not exists public.obras_tarefa (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  item text not null,
  dono text,
  aberta date not null default current_date,
  hora_aberta time,
  prazo date,
  registrou text,
  situacao text not null default 'aberta'
    check (situacao in ('aberta','respondida')),
  resposta_em date,
  resposta_hora time,
  resumo text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 1.4 obras_pessoa — quem pode ser dono de tarefa.
-- A chave é texto (YURI, ROBERTA, MANFAC-7) porque é assim que a planilha
-- guarda hoje: string solta, sem cadastro.
-- ------------------------------------------------------------
create table if not exists public.obras_pessoa (
  chave text primary key,
  nome text not null,
  iniciais text,
  area text check (area is null or area in ('Compras','Obras','Campo')),
  funcao text,
  -- O telefone fica NULO até o João cadastrar. É pendência de operação
  -- conhecida e não trava a v0, porque o WhatsApp está fora dela.
  fone text,
  -- A ligação entre a conta do hub e a pessoa da planilha.
  --
  -- `obras_obra.pcm` guarda a chave em texto (YURI, AMANDA) e é por ela que o
  -- diário é filtrado — mas quem entra no hub entra por e-mail. Sem esta coluna
  -- a ligação só pode ser adivinhada do e-mail (yuri.nascimento@ -> YURI), e um
  -- apelido, um sobrenome primeiro ou um homônimo faz a pessoa ver o diário
  -- VAZIO. Num treinamento com a equipe toda na sala, é a falha mais cara
  -- possível. Preencher antes de terça.
  --
  -- GRAVAR SEMPRE EM MINÚSCULAS: a consulta do código é `eq(email, minúsculas)`
  -- e o índice único é sobre `lower(email)`. Um endereço cadastrado com
  -- maiúscula não seria encontrado.
  email text,
  created_at timestamptz not null default now()
);

alter table public.obras_pessoa add column if not exists email text;
create unique index if not exists obras_pessoa_email_uniq
  on public.obras_pessoa (lower(email)) where email is not null;

-- ------------------------------------------------------------
-- 1.5 obras_remarcacao — só leitura na v0. Vem da importação.
-- ------------------------------------------------------------
create table if not exists public.obras_remarcacao (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras_obra(id) on delete cascade,
  data date,
  de date,
  para date,
  motivo text,
  created_at timestamptz not null default now()
);


-- ============================================================
-- 2. ÍNDICES — um por consulta que as telas fazem de verdade
-- ============================================================

-- Base de obras: filtro "Responsável da obra" e filtro "Etapa da obra";
-- o diário monta a fila do usuário logado por pcm + etapa em campo.
create index if not exists obras_obra_pcm_idx on public.obras_obra (pcm);
create index if not exists obras_obra_etapa_idx on public.obras_obra (etapa);

-- Importação idempotente por `os` (spec §6): rodar de novo atualiza, não
-- duplica. Índice PARCIAL porque a 19ª obra ativa é a GARANTIA, sem OS
-- numérica, e cadastro manual pode nascer sem OS — várias linhas com
-- `os is null` precisam conviver.
create unique index if not exists obras_obra_os_uniq
  on public.obras_obra (os) where os is not null;

-- Diário do dia: a tela abre sempre por obra + data (e a unique já serve de
-- índice para isso). Este aqui é o outro lado: "quem registrou hoje".
create index if not exists obras_diario_data_idx on public.obras_diario (data);

-- Tarefas: "na mão de quem" agrupa por dono; os KPIs contam por situação.
create index if not exists obras_tarefa_dono_idx on public.obras_tarefa (dono);
create index if not exists obras_tarefa_situacao_idx on public.obras_tarefa (situacao);
create index if not exists obras_tarefa_obra_idx on public.obras_tarefa (obra_id);

-- Ficha da obra: as remarcações de uma obra só.
create index if not exists obras_remarcacao_obra_idx on public.obras_remarcacao (obra_id);


-- ============================================================
-- 3. updated_at de obras_obra
-- Uma trigger, uma tabela. Ver a armadilha 2 no cabeçalho.
-- ============================================================
create or replace function public.obras_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists obras_obra_touch_updated_at on public.obras_obra;
create trigger obras_obra_touch_updated_at
  before update on public.obras_obra
  for each row execute function public.obras_touch_updated_at();


-- ============================================================
-- 4. STORAGE — bucket privado obras-fotos
-- Caminho: obras-fotos/{obra_id}/{data}.jpg
-- Upload ANTES do insert do diário (padrão de lib/sofia/uploadFotos.ts).
-- Leitura só por signed URL curta gerada em server action.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('obras-fotos', 'obras-fotos', false)
on conflict (id) do nothing;


-- ============================================================
-- 5. RLS — funções de autorização
--
-- Espelham lib/auth/roles.ts (isAdmin) e lib/auth/systemAccess.ts
-- (hasSystemAccess), lendo as MESMAS tabelas que o app: hub_user_roles e
-- hub_system_access. Nada para sincronizar à mão.
--
-- `exists(...)` devolve sempre true/false — nunca NULL, nem com JWT sem
-- claim de e-mail. É o que impede a guarda de falhar aberta.
-- ============================================================

-- Vem antes de obras_has_access porque esta a chama, e o Postgres valida o
-- corpo da função no momento da criação.
create or replace function public.obras_is_admin()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.hub_user_roles
    where user_email = lower(trim(auth.jwt() ->> 'email'))
      and nivel = 'administrador'
  );
$$;

create or replace function public.obras_has_access()
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select
    public.obras_is_admin()
    or exists (
      select 1 from public.hub_system_access
      where user_email = lower(trim(auth.jwt() ->> 'email'))
        and system_slug = 'obras'
        and has_access = true
    );
$$;

revoke execute on function public.obras_is_admin() from public, anon;
revoke execute on function public.obras_has_access() from public, anon;
grant execute on function public.obras_is_admin() to authenticated;
grant execute on function public.obras_has_access() to authenticated;


-- ============================================================
-- 6. RLS — policies "obras access" em todas as tabelas
-- Padrão novo (sdd-sql-v04-seguranca.sql), não a RLS aberta do conversor-os:
-- "authenticated full access" com using(true) foi achado de auditoria.
-- ============================================================

alter table public.obras_obra enable row level security;
drop policy if exists "obras access" on public.obras_obra;
create policy "obras access" on public.obras_obra for all to authenticated
  using (public.obras_has_access()) with check (public.obras_has_access());

alter table public.obras_diario enable row level security;
drop policy if exists "obras access" on public.obras_diario;
create policy "obras access" on public.obras_diario for all to authenticated
  using (public.obras_has_access()) with check (public.obras_has_access());

alter table public.obras_tarefa enable row level security;
drop policy if exists "obras access" on public.obras_tarefa;
create policy "obras access" on public.obras_tarefa for all to authenticated
  using (public.obras_has_access()) with check (public.obras_has_access());

alter table public.obras_pessoa enable row level security;
drop policy if exists "obras access" on public.obras_pessoa;
create policy "obras access" on public.obras_pessoa for all to authenticated
  using (public.obras_has_access()) with check (public.obras_has_access());

alter table public.obras_remarcacao enable row level security;
drop policy if exists "obras access" on public.obras_remarcacao;
create policy "obras access" on public.obras_remarcacao for all to authenticated
  using (public.obras_has_access()) with check (public.obras_has_access());


-- ============================================================
-- 7. RLS do bucket — policies em storage.objects
-- Bucket PRIVADO: sem estas policies ninguém sobe nem lê nada.
-- Guardadas por obras_has_access(), não só por `to authenticated` — quem não
-- tem o sistema liberado não pode ler foto de obra.
-- ============================================================

drop policy if exists "obras fotos upload" on storage.objects;
create policy "obras fotos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'obras-fotos' and public.obras_has_access());

drop policy if exists "obras fotos read" on storage.objects;
create policy "obras fotos read" on storage.objects for select to authenticated
  using (bucket_id = 'obras-fotos' and public.obras_has_access());

-- Update existe porque o upload do diário pode reenviar a foto do mesmo dia
-- (o caminho é {obra_id}/{data}.jpg — determinístico, então é upsert).
drop policy if exists "obras fotos update" on storage.objects;
create policy "obras fotos update" on storage.objects for update to authenticated
  using (bucket_id = 'obras-fotos' and public.obras_has_access())
  with check (bucket_id = 'obras-fotos' and public.obras_has_access());


-- ============================================================
-- 8. SEED de obras_pessoa
-- As quatro pessoas do escritório que o mockup nomeia. Telefone NULO de
-- propósito (spec §4.4). As equipes de campo (MANFAC-7, ALEX, ...) entram
-- pela importação, que é quem sabe quais existem na planilha.
-- ============================================================
insert into public.obras_pessoa (chave, nome, iniciais, area, funcao, fone) values
  ('ROBERTA', 'Roberta Lima',    'RL', 'Compras', 'compras',           null),
  ('YURI',    'Yuri Nascimento', 'YN', 'Obras',   'analista de obras', null),
  ('AMANDA',  'Amanda Ribeiro',  'AR', 'Obras',   'analista de obras', null),
  ('LUANA',   'Luana Prado',     'LP', 'Obras',   'analista de obras', null)
on conflict (chave) do nothing;


commit;


-- ============================================================
-- 9. DEPOIS DE RODAR ESTE ARQUIVO — o que ainda falta, à mão
--
-- O passo a passo completo, com o SQL de verificação de cada etapa, está em
-- docs/cliente/2026-08-31-sistema-controle-de-obras/RUNBOOK-ir-ao-ar.md
--
-- (1) Liberar o acesso de cada usuário ao sistema 'obras' em /admin/acessos.
-- O slug 'obras' é string livre em hub_system_access.system_slug e NÃO é
-- criado por esta migration: sem a linha por usuário, ninguém entra em
-- /obras — nem vê o card no dashboard. Administrador do hub passa sempre.
--
-- (2) Preencher obras_pessoa.email. O seed acima deixa a coluna NULA de
-- propósito — os e-mails reais não estavam disponíveis quando ele foi
-- escrito. Sem esse passo, `resolverChave` cai na convenção (primeiro
-- pedaço do e-mail, em maiúsculas); se o e-mail de alguém fugir do padrão
-- `nome.sobrenome@`, a chave não casa com nenhum `pcm` e o Diário dessa
-- pessoa abre em "sem permissão" — não em lista vazia. É a falha mais
-- visível possível numa sala de treinamento. O runbook traz o SQL.
-- ============================================================
