-- ============================================================
-- Controle de Obras — motivos de remarcação e remarcação do início
-- J4, seção B do mockup-j4-v02.html — 2026-09-18
-- Migration da §3 de
-- docs/cliente/2026-08-31-sistema-controle-de-obras/spec-ficha-editavel-2026-09-18.md
-- ============================================================
-- O QUE ESTA MIGRATION FAZ
--   (1) cria public.obras_motivo_remarcacao — a lista padronizada de motivos
--       de remarcação do início, semeada com os 6 motivos do Diário;
--   (2) acrescenta `detalhe` e `registrado_por` a public.obras_remarcacao, que
--       existe desde a v0 e nunca foi escrita por código nenhum;
--   (3) cria a RPC public.obras_remarcar_inicio, que grava a mudança de
--       `inicio_plan` E a linha de remarcação na MESMA transação.
--
-- DE QUE ELA DEPENDE
--   sdd-sql-obras-v0.sql .......... APLICADO em 10/09/2026. Dá obras_obra,
--                                   obras_remarcacao e public.obras_has_access().
--   sdd-sql-obras-historico.sql ... NÃO APLICADO ainda. Dá obras_historico e a
--                                   RPC public.obras_aplicar_alteracao(uuid,
--                                   jsonb, jsonb), que a seção 4 daqui chama.
--   ORDEM OBRIGATÓRIA: histórico PRIMEIRO, este arquivo DEPOIS.
--
--   ⚠️ CORREÇÃO DA SPEC: a §3.3 da spec afirma que "o Postgres valida o corpo
--   da função no momento da criação, então a ordem não é opcional". Isso é
--   FALSO para PL/pgSQL: com check_function_bodies ligado, o validador só faz
--   checagem de SINTAXE — tabelas e funções referenciadas no corpo só são
--   resolvidas na primeira execução. Sem histórico aplicado, este arquivo
--   rodaria "com sucesso" e a ficha quebraria em produção, na primeira
--   remarcação, com "function obras_aplicar_alteracao does not exist". Por
--   isso a seção 0 abaixo checa a dependência à mão e ABORTA a transação.
--
-- COMO REVERTER (rollback completo, roda numa transação só):
--   begin;
--   drop function if exists public.obras_remarcar_inicio(uuid, jsonb, jsonb, date, date, text, text);
--   alter table public.obras_remarcacao
--     drop constraint if exists obras_remarcacao_detalhe_so_com_outro;
--   alter table public.obras_remarcacao drop column if exists detalhe;
--   alter table public.obras_remarcacao drop column if exists registrado_por;
--   drop table if exists public.obras_motivo_remarcacao;
--   -- devolve obras_remarcacao à policy larga da v0 (ver seção 3):
--   drop policy if exists "obras remarcacao leitura" on public.obras_remarcacao;
--   drop policy if exists "obras remarcacao insercao" on public.obras_remarcacao;
--   drop policy if exists "obras access" on public.obras_remarcacao;
--   create policy "obras access" on public.obras_remarcacao for all to authenticated
--     using (public.obras_has_access()) with check (public.obras_has_access());
--   commit;
--   Reverter é seguro enquanto a ficha editável não estiver no ar. Depois de
--   ela subir, o drop das colunas APAGA as remarcações já registradas —
--   nesse caso, reverter é o deploy do código anterior, não este SQL.
--
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase (ou pela
-- Management API com o PAT), projeto de produção iyytcavcgukfjnjjrerx.
-- Confirme o ref antes de colar (AGENTS.md). Não existe CLI de migration aqui.
--
-- IDEMPOTENTE por construção: create table if not exists, add column if not
-- exists, create unique index if not exists, create or replace function,
-- drop policy if exists antes de recriar, constraint dentro de um `if not
-- exists (select 1 from pg_constraint ...)`, e o seed com on conflict do
-- nothing. Rodar duas vezes não dá erro e não duplica semente.
--
-- LIMITE CONHECIDO DA IDEMPOTÊNCIA (mesmo aviso de sdd-sql-obras-v0.sql:13-17):
-- `create table if not exists` não altera uma tabela que já exista com colunas
-- diferentes, e `create index if not exists` não muda a definição de um índice
-- que já exista sob aquele nome. Toda coluna/índice acrescentado depois da
-- primeira versão deste arquivo tem que virar um `alter table ... add column
-- if not exists` / `drop index if exists` + `create index` explícito aqui
-- embaixo, nunca uma edição do `create table` lá em cima.
--
-- AS DUAS ARMADILHAS DE PL/pgSQL DO AGENTS.md:
--   1. Guarda de autorização que devolve NULL falha ABERTA (`if not f() then
--      raise` não dispara com NULL). A única guarda deste arquivo é
--      public.obras_has_access(), que é exists()-based e devolve sempre
--      true/false, inclusive com JWT sem claim de e-mail. Nada de `in (lista)`
--      sem coalesce.
--   2. Trigger compartilhada entre tabelas de colunas diferentes
--      (`if TG_TABLE_NAME = 'x' and new.campo ...` levanta 42703). Não se
--      aplica: este arquivo não cria trigger nenhuma.
--
-- TRANSAÇÃO EXPLÍCITA: o arquivo roda inteiro dentro de begin/commit. Estado
-- parcial em produção é caro; qualquer erro no meio desfaz tudo.
-- ============================================================

begin;


-- ============================================================
-- 0. PRÉ-REQUISITOS — aborta cedo, em vez de quebrar em produção depois
-- ============================================================
-- Ver a CORREÇÃO DA SPEC no cabeçalho: o corpo de uma função PL/pgSQL não é
-- resolvido contra o catálogo na criação. Estas checagens são o que realmente
-- impõe a ordem entre as migrations.
do $$
begin
  if to_regprocedure('public.obras_aplicar_alteracao(uuid, jsonb, jsonb)') is null then
    raise exception
      'Pré-requisito ausente: public.obras_aplicar_alteracao(uuid, jsonb, jsonb). Rode sdd-sql-obras-historico.sql ANTES deste arquivo.'
      using errcode = '42883';
  end if;

  if to_regprocedure('public.obras_has_access()') is null then
    raise exception
      'Pré-requisito ausente: public.obras_has_access(). Rode sdd-sql-obras-v0.sql ANTES deste arquivo.'
      using errcode = '42883';
  end if;

  if to_regclass('public.obras_remarcacao') is null then
    raise exception
      'Pré-requisito ausente: tabela public.obras_remarcacao. Rode sdd-sql-obras-v0.sql ANTES deste arquivo.'
      using errcode = '42P01';
  end if;
end
$$;


-- ============================================================
-- 1. obras_motivo_remarcacao — a lista padronizada
-- ============================================================
-- POR QUE TABELA, E NÃO CONSTANTE TypeScript como BLOQUEIOS:
-- o cliente pediu, no feedback 14 B, poder "cadastrar um novo motivo que não
-- esteja disponível". Motivo novo cadastrado por quem usa não cabe numa
-- constante — exigiria deploy a cada motivo.
--
-- `chave` é coluna GERADA, não preenchida pelo app: a unicidade do motivo é
-- garantida pelo banco, não pela boa vontade de quem chama. A normalização
-- sem acento fica do lado do app (pré-checagem em normalizarMotivo), porque
-- ela exigiria a extensão `unaccent`, e habilitar extensão em produção não
-- vale o risco para o ganho.
create table if not exists public.obras_motivo_remarcacao (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  chave       text generated always as (lower(btrim(nome))) stored,
  ativo       boolean not null default true,
  ordem       int not null default 100,
  criado_por  text,
  created_at  timestamptz not null default now(),
  constraint obras_motivo_remarcacao_nome_nao_vazio
    check (btrim(nome) <> ''),
  constraint obras_motivo_remarcacao_nome_tamanho
    check (char_length(btrim(nome)) between 3 and 60)
);

-- Para quem já rodou uma versão anterior deste arquivo (ver LIMITE CONHECIDO):
alter table public.obras_motivo_remarcacao add column if not exists ativo boolean not null default true;
alter table public.obras_motivo_remarcacao add column if not exists ordem int not null default 100;
alter table public.obras_motivo_remarcacao add column if not exists criado_por text;

create unique index if not exists obras_motivo_remarcacao_chave_uniq
  on public.obras_motivo_remarcacao (chave);

-- SEED — o mesmo vocabulário do Diário (app/obras/_lib/tipos.ts:187-194,
-- constante BLOQUEIOS), decisão do João de 18/09 e seção G do mockup v02.
-- A grafia é a do CÓDIGO ("Cliente / loja", com espaços em volta da barra),
-- não a do texto do mockup ("Cliente/loja"): duas grafias para a mesma coisa
-- quebrariam o cruzamento entre o bloqueio do dia e o motivo da remarcação,
-- que é justamente a razão de as duas listas serem a mesma.
-- "Sem bloqueio" (o 6º item de BLOQUEIOS) NÃO entra: não é motivo de
-- remarcação, é a ausência de um. No lugar dele entra "Outro", que é o único
-- motivo que pede descrição.
--
-- `on conflict do nothing` SEM alvo, de propósito: `chave` é coluna gerada e
-- só há um índice único nesta tabela além da PK — não especificar o alvo
-- evita qualquer dúvida sobre inferência de índice em coluna gerada, e o
-- efeito prático é o mesmo (reaplicar o arquivo não duplica e não falha).
insert into public.obras_motivo_remarcacao (nome, ordem) values
  ('Clima', 10),
  ('Cliente / loja', 20),
  ('Disponibilidade de equipe', 30),
  ('Contratação de prestador', 40),
  ('Falta de material', 50),
  ('Outro', 900)
on conflict do nothing;


-- ============================================================
-- 2. obras_remarcacao — duas colunas novas
-- ============================================================
-- A tabela existe desde a v0 (sdd-sql-obras-v0.sql:218-226: id, obra_id, data,
-- de, para, motivo, created_at) e nunca foi escrita: nasceu para receber a
-- importação de planilha, que foi descartada em 10/09. Hoje o único código que
-- a toca é um select (app/obras/obra/[id]/page.tsx:85).
--
-- `motivo` continua TEXTO, e isso é deliberado: ele guarda o NOME do motivo no
-- momento da remarcação, não uma FK. Se um motivo for renomeado um dia, as
-- remarcações antigas continuam dizendo o que foi escolhido de verdade. É o
-- mesmo princípio de obras_historico, que grava `de`/`para` já formatados.
alter table public.obras_remarcacao add column if not exists detalhe text;
alter table public.obras_remarcacao add column if not exists registrado_por text;

-- Com "Outro", a descrição é obrigatória; sem "Outro", não há descrição.
-- A regra vive na Server Action (R10), na RPC da seção 4 e AQUI, porque a tela
-- não é fronteira.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'obras_remarcacao_detalhe_so_com_outro'
      and conrelid = 'public.obras_remarcacao'::regclass
  ) then
    alter table public.obras_remarcacao
      add constraint obras_remarcacao_detalhe_so_com_outro
      check (
        (lower(btrim(coalesce(motivo, ''))) = 'outro'
           and detalhe is not null and btrim(detalhe) <> '')
        or (lower(btrim(coalesce(motivo, ''))) <> 'outro'
           and detalhe is null)
      ) not valid;
  end if;
end
$$;

-- `not valid` de propósito: a tabela está vazia hoje, mas o `not valid` faz o
-- check valer para toda linha NOVA sem varrer o passado — se um dia alguém
-- carregar remarcações históricas antes de rodar este arquivo, a migration não
-- falha no meio. Validar depois, à mão, quando houver certeza:
--   alter table public.obras_remarcacao
--     validate constraint obras_remarcacao_detalhe_so_com_outro;


-- ============================================================
-- 3. RLS — padrão "obras access" do módulo (sdd-sql-obras-v0.sql seção 6)
-- ============================================================
-- obras_motivo_remarcacao: LEITURA e INSERÇÃO para quem tem acesso ao módulo,
-- e nada mais. Não é o `for all` das outras tabelas, de propósito:
--   • a única escrita que alguma tela faz é o insert de
--     cadastrarMotivoRemarcacaoAction (spec §4.5), e as Server Actions deste
--     módulo usam o client do USUÁRIO, não a service role — então o insert
--     precisa mesmo estar liberado na policy;
--   • renomear ou apagar motivo está explicitamente FORA do escopo (spec §2.2:
--     "não há tela para isso"). Com `for all`, qualquer usuário logado com
--     acesso ao módulo poderia apagar a lista padronizada inteira pelo client
--     do navegador, contornando as Server Actions. É o mesmo raciocínio que
--     fechou hub_system_access em 2026-08-10 (AGENTS.md).
-- O dia em que existir tela de editar/desativar motivo, a policy de update
-- entra aqui, junto com a action que a usa.
--
-- O `with check` do insert amarra `criado_por` ao e-mail do JWT, como a policy
-- "obras historico escrita" já faz com `quem`: impede forjar autoria. As 6
-- linhas do seed nascem com criado_por NULL porque quem as inseriu foi esta
-- migration (rodando como postgres, que passa por cima da RLS) — é assim que
-- se distingue motivo de fábrica de motivo cadastrado por gente.
alter table public.obras_motivo_remarcacao enable row level security;

drop policy if exists "obras access" on public.obras_motivo_remarcacao;
drop policy if exists "obras motivo leitura" on public.obras_motivo_remarcacao;
create policy "obras motivo leitura" on public.obras_motivo_remarcacao
  for select to authenticated
  using (public.obras_has_access());

drop policy if exists "obras motivo cadastro" on public.obras_motivo_remarcacao;
create policy "obras motivo cadastro" on public.obras_motivo_remarcacao
  for insert to authenticated
  with check (
    public.obras_has_access()
    and criado_por is not null
    and lower(btrim(criado_por)) = lower(btrim(auth.jwt() ->> 'email'))
  );

-- obras_remarcacao: MUDANÇA em relação à v0, que tinha "obras access"
-- (`for all`). Remarcação é registro histórico — a mesma natureza de
-- obras_historico, que é append-only por decisão da spec do histórico. Nenhum
-- código faz update ou delete nesta tabela (grep em app/ e lib/ em 18/09/2026:
-- só o select de page.tsx:85), então fechar não quebra nada hoje e evita que
-- alguém apague pelo navegador o motivo que esta entrega existe para guardar.
-- O rollback do cabeçalho devolve a policy larga em uma linha.
alter table public.obras_remarcacao enable row level security;

drop policy if exists "obras access" on public.obras_remarcacao;
drop policy if exists "obras remarcacao leitura" on public.obras_remarcacao;
create policy "obras remarcacao leitura" on public.obras_remarcacao
  for select to authenticated
  using (public.obras_has_access());

-- O `with check` amarra `registrado_por` ao e-mail do JWT, como na policy de
-- cadastro de motivo e na "obras historico escrita": a RPC da seção 4 já grava
-- exatamente esse valor, então na prática nada muda para o app — e um client
-- do navegador que tentasse inserir uma remarcação direto, em nome de outra
-- pessoa, é recusado.
drop policy if exists "obras remarcacao insercao" on public.obras_remarcacao;
create policy "obras remarcacao insercao" on public.obras_remarcacao
  for insert to authenticated
  with check (
    public.obras_has_access()
    and registrado_por is not null
    and lower(btrim(registrado_por)) = lower(btrim(auth.jwt() ->> 'email'))
  );


-- ============================================================
-- 4. RPC obras_remarcar_inicio — mudança de início + remarcação, atômicas
-- ============================================================
-- POR QUE ELA EXISTE: obras_aplicar_alteracao grava obras_obra e
-- obras_historico juntos, mas não conhece obras_remarcacao. Se a Server Action
-- fizesse "RPC, depois insert", uma falha entre as duas gravaria a data nova
-- SEM a remarcação — perder o motivo da remarcação é perder exatamente o dado
-- que esta entrega existe para capturar. O corpo de uma função é uma transação
-- só: ou as duas escritas acontecem, ou nenhuma.
--
-- security INVOKER, como obras_aplicar_alteracao: herda a RLS de quem chama,
-- não eleva privilégio.
--
-- CONTRATO (o que a Server Action precisa mandar):
--   p_campos  jsonb com as colunas de obras_obra a gravar. PRECISA conter
--             "inicio_plan" igual a p_para — a coerência é checada aqui.
--   p_linhas  jsonb das linhas de histórico (formato de obras_aplicar_alteracao).
--   p_de      início anterior (pode ser null só em teoria; ver a guarda).
--   p_para    início novo, obrigatório.
--   p_motivo  nome do motivo, tem que estar ATIVO na lista.
--   p_detalhe descrição, obrigatória quando o motivo é "Outro", ignorada
--             quando não é.
create or replace function public.obras_remarcar_inicio(
  p_obra_id  uuid,
  p_campos   jsonb,
  p_linhas   jsonb,
  p_de       date,
  p_para     date,
  p_motivo   text,
  p_detalhe  text
)
returns public.obras_obra
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_obra    public.obras_obra;
  v_quem    text := lower(btrim(auth.jwt() ->> 'email'));
  v_motivo  text := btrim(coalesce(p_motivo, ''));
  v_detalhe text := nullif(btrim(coalesce(p_detalhe, '')), '');
begin
  -- Guarda de acesso ANTES de qualquer leitura. Sem ela, quem não tem acesso
  -- receberia "motivo fora da lista" (porque a RLS esconde as linhas da lista)
  -- em vez de "sem acesso" — erro certo pelo motivo errado, caro de depurar.
  -- obras_has_access() é exists()-based: nunca devolve NULL, então esta guarda
  -- não pode falhar ABERTA (armadilha 1 do AGENTS.md).
  if not public.obras_has_access() then
    raise exception 'Sem acesso ao Controle de Obras' using errcode = '42501';
  end if;

  if v_quem is null or v_quem = '' then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;

  -- APAGAR um início que existia também é remarcação: a data combinada deixou de
  -- valer, e é exatamente isso que a remarcação registra. Quem decide isso é
  -- `precisaRemarcar` em app/obras/_lib/ficha-campos.ts, com teste de regressão
  -- em ficha-campos.test.ts. Esta função não pode contradizer o app: se ela
  -- recusasse p_para nulo, limpar o início viraria erro cru do Postgres na cara
  -- do usuário, e consertar custaria outra migration à mão. Só o caso
  -- degenerado — nunca houve data e continua não havendo — é recusado.
  if p_de is null and p_para is null then
    raise exception 'obras_remarcar_inicio: nem a data antiga nem a nova existem — não há o que remarcar'
      using errcode = '22023';
  end if;

  -- Com p_para nulo, `p_campos ->> 'inicio_plan'` devolve NULL tanto para
  -- "inicio_plan": null quanto para a chave AUSENTE — e os dois casos são
  -- diferentes: ausente faz obras_aplicar_alteracao não tocar na coluna, e a
  -- obra ficaria com a data antiga enquanto a remarcação diz que ela sumiu.
  -- Exigir a chave presente fecha esse buraco antes da checagem de igualdade.
  if not jsonb_exists(p_campos, 'inicio_plan') then
    raise exception
      'obras_remarcar_inicio: p_campos precisa trazer inicio_plan (use null para apagar a data)'
      using errcode = '22023';
  end if;

  if p_de is not distinct from p_para then
    raise exception 'obras_remarcar_inicio: o início não mudou — não há o que remarcar'
      using errcode = '22023';
  end if;

  -- Coerência entre o que vai para obras_obra e o que vai para a linha de
  -- remarcação. Sem esta checagem, um bug da action poderia gravar a obra com
  -- uma data e a remarcação dizendo outra — e ninguém descobriria. Falha alta,
  -- não silenciosa, pela mesma lição do B1 da review do histórico.
  if (p_campos ->> 'inicio_plan')::date is distinct from p_para then
    raise exception
      'obras_remarcar_inicio: p_campos.inicio_plan (%) tem que ser igual a p_para (%)',
      coalesce(p_campos ->> 'inicio_plan', '<ausente>'), p_para
      using errcode = '22023';
  end if;

  if v_motivo = '' then
    raise exception 'obras_remarcar_inicio: motivo da remarcação é obrigatório'
      using errcode = '22023';
  end if;

  -- O motivo tem que estar na lista e ativo. Cadastrar motivo novo é outra
  -- ação, que roda antes; aqui a lista é fechada, senão "padronizado" não
  -- significa nada.
  if not exists (
    select 1 from public.obras_motivo_remarcacao
    where chave = lower(btrim(v_motivo)) and ativo
  ) then
    raise exception 'obras_remarcar_inicio: motivo fora da lista: %', v_motivo
      using errcode = '23514';
  end if;

  -- A descrição só existe para "Outro". Quando o motivo é outro qualquer, o
  -- detalhe é DESCARTADO em vez de virar erro: é o caso real de quem digita em
  -- "Qual é o outro motivo?" e depois troca o radio para "Clima" — a descrição
  -- perde o sentido junto com a escolha, e derrubar a gravação inteira por
  -- causa dela (o check da seção 2 derrubaria) seria punir o usuário por uma
  -- sobra de tela. Já a falta de descrição COM "Outro" é erro, porque aí o
  -- dado que o cliente pediu não existe.
  if lower(btrim(v_motivo)) = 'outro' then
    if v_detalhe is null then
      raise exception 'obras_remarcar_inicio: com o motivo "Outro" a descrição é obrigatória'
        using errcode = '22023';
    end if;
  else
    v_detalhe := null;
  end if;

  -- 1) a obra. Toda a autorização, a validação de coluna e o histórico moram
  --    dentro de obras_aplicar_alteracao — este arquivo não os reimplementa.
  v_obra := public.obras_aplicar_alteracao(p_obra_id, p_campos, p_linhas);

  -- 2) a remarcação. `data` é o dia em que a remarcação foi feita, não a data
  --    nova de início: é isso que o bloco Remarcações da ficha mostra à
  --    esquerda da linha.
  insert into public.obras_remarcacao
    (obra_id, data, de, para, motivo, detalhe, registrado_por)
  values
    (p_obra_id, (now() at time zone 'America/Sao_Paulo')::date,
     p_de, p_para, v_motivo, v_detalhe, v_quem);

  return v_obra;
end;
$$;

revoke execute on function public.obras_remarcar_inicio(uuid, jsonb, jsonb, date, date, text, text)
  from public, anon;
grant execute on function public.obras_remarcar_inicio(uuid, jsonb, jsonb, date, date, text, text)
  to authenticated;

commit;


-- ============================================================
-- 5. VERIFICAÇÃO — depois do commit, tudo só leitura
-- Padrão de sdd-sql-obras-v0.sql / RUNBOOK-ir-ao-ar.md: cada passo diz o que
-- se espera ver.
--
-- POR QUE UMA CONSULTA SÓ, e não uma dúzia de selects soltos: o SQL Editor do
-- Supabase mostra apenas o resultado da ÚLTIMA instrução do batch — uma dúzia
-- de selects daria onze resultados invisíveis e a sensação falsa de ter
-- conferido. A consulta abaixo devolve UMA LINHA POR VERIFICAÇÃO, com o
-- esperado, o encontrado e OK / *** FALHOU ***. Ela é a prova de que cada
-- objeto foi criado e de que a semente tem as 6 linhas.
--
-- ESPERADO: 18 linhas, todas com resultado = OK.
-- Se rodar o arquivo duas vezes, o resultado tem que ser idêntico — é assim
-- que se confere a idempotência (em especial a linha 5, "total de motivos").
-- ============================================================

select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (
  select 1 as n, 'tabela public.obras_motivo_remarcacao existe' as verificacao, 1 as esperado,
         (select count(*) from information_schema.tables
           where table_schema = 'public' and table_name = 'obras_motivo_remarcacao')::int as encontrado
  union all
  select 2, 'colunas dela: id, nome, chave, ativo, ordem, criado_por, created_at', 7,
         (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'obras_motivo_remarcacao')::int
  union all
  select 3, '`chave` e coluna GERADA (generated always ... stored)', 1,
         (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'obras_motivo_remarcacao'
             and column_name = 'chave' and is_generated = 'ALWAYS')::int
  union all
  select 4, 'indice unico obras_motivo_remarcacao_chave_uniq', 1,
         (select count(*) from pg_indexes
           where schemaname = 'public' and indexname = 'obras_motivo_remarcacao_chave_uniq')::int
  union all
  select 5, 'SEMENTE: os 6 de fabrica continuam la (motivo novo cadastrado nao conta)', 6,
         (select count(*) from public.obras_motivo_remarcacao where criado_por is null)::int
  union all
  select 6, 'SEMENTE: os 6 nomes exatos, na grafia de BLOQUEIOS (tipos.ts:187-194)', 6,
         (select count(*) from public.obras_motivo_remarcacao
           where nome in ('Clima', 'Cliente / loja', 'Disponibilidade de equipe',
                          'Contratação de prestador', 'Falta de material', 'Outro'))::int
  union all
  select 7, 'SEMENTE: "Sem bloqueio" NAO entrou (nao e motivo de remarcacao)', 0,
         (select count(*) from public.obras_motivo_remarcacao where nome = 'Sem bloqueio')::int
  union all
  select 8, 'SEMENTE: os 6 estao ativos', 6,
         (select count(*) from public.obras_motivo_remarcacao where ativo)::int
  union all
  select 9, 'obras_remarcacao ganhou `detalhe` e `registrado_por`', 2,
         (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'obras_remarcacao'
             and column_name in ('detalhe', 'registrado_por'))::int
  union all
  select 10, 'check obras_remarcacao_detalhe_so_com_outro existe, como NOT VALID', 1,
         (select count(*) from pg_constraint
           where conrelid = 'public.obras_remarcacao'::regclass
             and conname = 'obras_remarcacao_detalhe_so_com_outro'
             and not convalidated)::int
  union all
  select 11, 'RLS ligada nas duas tabelas', 2,
         (select count(*) from pg_class c
            join pg_namespace ns on ns.oid = c.relnamespace
           where ns.nspname = 'public'
             and c.relname in ('obras_motivo_remarcacao', 'obras_remarcacao')
             and c.relrowsecurity)::int
  union all
  select 12, 'policies: 4 (leitura + insercao em cada tabela)', 4,
         (select count(*) from pg_policies
           where schemaname = 'public'
             and tablename in ('obras_motivo_remarcacao', 'obras_remarcacao'))::int
  union all
  select 13, 'NENHUMA policy de ALL / UPDATE / DELETE nessas tabelas', 0,
         (select count(*) from pg_policies
           where schemaname = 'public'
             and tablename in ('obras_motivo_remarcacao', 'obras_remarcacao')
             and cmd not in ('SELECT', 'INSERT'))::int
  union all
  select 14, 'RPC obras_remarcar_inicio: existe, 7 argumentos, security INVOKER', 1,
         (select count(*) from pg_proc p
            join pg_namespace ns on ns.oid = p.pronamespace
           where ns.nspname = 'public' and p.proname = 'obras_remarcar_inicio'
             and p.pronargs = 7 and p.prosecdef = false)::int
  union all
  select 15, 'RPC concedida a authenticated', 1,
         (select count(*) from information_schema.role_routine_grants
           where routine_schema = 'public' and routine_name = 'obras_remarcar_inicio'
             and grantee = 'authenticated' and privilege_type = 'EXECUTE')::int
  union all
  select 16, 'RPC NAO concedida a PUBLIC nem a anon', 0,
         (select count(*) from information_schema.role_routine_grants
           where routine_schema = 'public' and routine_name = 'obras_remarcar_inicio'
             and grantee in ('PUBLIC', 'anon'))::int
  union all
  select 17, 'dependencia viva: obras_aplicar_alteracao (sdd-sql-obras-historico.sql)', 1,
         (case when to_regprocedure('public.obras_aplicar_alteracao(uuid, jsonb, jsonb)')
                    is null then 0 else 1 end)
  union all
  select 18, 'dependencia viva: obras_has_access (sdd-sql-obras-v0.sql)', 1,
         (case when to_regprocedure('public.obras_has_access()') is null then 0 else 1 end)
) t
order by n;


-- ------------------------------------------------------------
-- Detalhe, para quando alguma linha acima der FALHOU. Rodar UM de cada vez
-- (o editor só mostra o resultado da última instrução).
-- ------------------------------------------------------------
-- (a) a semente, em ordem de exibição:
--   select ordem, nome, chave, ativo, criado_por
--     from public.obras_motivo_remarcacao order by ordem, nome;
--   espera: 10 Clima · 20 Cliente / loja · 30 Disponibilidade de equipe ·
--   40 Contratação de prestador · 50 Falta de material · 900 Outro,
--   todos ativo = true e criado_por = null (motivo de fábrica, veio da migration)
--
-- (b) as colunas de obras_remarcacao, na ordem:
--   select column_name, data_type, is_nullable from information_schema.columns
--    where table_schema = 'public' and table_name = 'obras_remarcacao'
--    order by ordinal_position;
--   espera: id, obra_id, data, de, para, motivo, created_at, detalhe, registrado_por
--
-- (c) as policies, uma a uma:
--   select tablename, policyname, cmd, roles, qual, with_check from pg_policies
--    where schemaname = 'public'
--      and tablename in ('obras_motivo_remarcacao','obras_remarcacao')
--    order by tablename, policyname;
--   espera 4 linhas, roles = {authenticated}:
--     obras_motivo_remarcacao · "obras motivo cadastro"     · INSERT
--     obras_motivo_remarcacao · "obras motivo leitura"      · SELECT
--     obras_remarcacao        · "obras remarcacao insercao" · INSERT
--     obras_remarcacao        · "obras remarcacao leitura"  · SELECT
--
-- (d) a assinatura e os grants da RPC:
--   select p.proname, pg_get_function_arguments(p.oid) as args, p.prosecdef
--     from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
--    where ns.nspname = 'public' and p.proname = 'obras_remarcar_inicio';
--   select grantee, privilege_type from information_schema.role_routine_grants
--    where routine_schema = 'public' and routine_name = 'obras_remarcar_inicio';

-- ============================================================
-- 6. TESTE MANUAL — SQL não é verificado de verdade sem rodar
-- (a lição do AGENTS.md sobre a trigger que passou por dois code reviews)
-- Fazer DEPOIS dos selects acima, antes de liberar a tela:
--
-- (1) Rodando COMO POSTGRES (SQL Editor/MCP, sem JWT): a RPC tem que recusar
--     por "Não autenticado" — prova que a guarda existe e não falha aberta:
--       select public.obras_remarcar_inicio(
--         (select id from public.obras_obra limit 1),
--         '{}'::jsonb, '[]'::jsonb, null, current_date, 'Clima', null);
--     espera erro 28000 "Não autenticado".
--     (obras_has_access() devolve true para postgres? Não: ela lê o e-mail do
--     JWT, que é nulo aqui, então a primeira guarda a barrar é a de acesso,
--     42501 "Sem acesso ao Controle de Obras" — qualquer uma das duas serve
--     como prova; o que NÃO pode acontecer é a chamada gravar alguma coisa.)
--
-- (2) Autenticado, com acesso ao slug 'obras': motivo fora da lista
--     ("Chuva forte") tem que levantar 23514, e NADA pode ser gravado —
--     conferir com  select count(*) from public.obras_remarcacao  antes e
--     depois.
--
-- (3) Autenticado: motivo válido, p_campos com inicio_plan igual a p_para →
--     uma linha nova em obras_remarcacao E o inicio_plan novo em obras_obra,
--     na mesma chamada. Conferir os dois.
--
-- (4) Com uma conta SEM o slug 'obras' liberado:
--       select * from public.obras_motivo_remarcacao;  → zero linhas (RLS)
--       delete from public.obras_motivo_remarcacao;    → zero linhas apagadas
--     (não há policy de delete: o delete não dá erro, simplesmente não alcança
--     linha nenhuma — é o comportamento esperado da RLS.)
-- ============================================================
