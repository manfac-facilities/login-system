# Spec — Ficha editável da obra + remarcação do início

**Data:** 18/09/2026 · **Frente:** J4, seções A e B do `mockup-j4-v02.html` · **Prazo:** operando
na segunda, 21/09/2026.

Só especificação: nenhum código de produção foi escrito para produzir este documento. Tudo o que
está afirmado aqui sobre o código atual foi verificado por leitura, e o arquivo e a linha estão
citados. Onde não deu para verificar, está dito.

**Fontes, na ordem de precedência:** `mockup-j4-v02.html` (desenho aprovado no conteúdo) →
`decisoes-joao-2026-09-15.md` → `feedback-14-mockup-j4-v01.md` → `inventario-campos-obra.md` e
`spec-regra-critica-2026-09-15.md` → código em `app/obras/`. Contradições entre essas fontes não
foram resolvidas por conta própria: estão na seção 9, **DECISÕES QUE FALTAM**.

---

## 1. O problema, em cinco linhas

Os campos que dizem **quem autorizou a obra, quando, por onde e quando a OS foi aprovada** só são
editáveis na Triagem, e a Triagem desaparece quando a obra sai da etapa `definir`
(`app/obras/obra/[id]/page.tsx:103`). Obra que já andou nunca mais registra quem liberou nem a
data de aprovação da OS — e são exatamente esses dois números que alimentam a contagem de obra em
atenção/crítica e os SLAs que a Manfac apresenta ao cliente toda semana. Sete colunas de marco
existem no banco e **nenhum código escreve** nelas (`inventario-campos-obra.md`, §1). Mudar a data
de início hoje não é possível em tela nenhuma, e quando for, precisa registrar **por que** mudou.

**O que muda para quem usa:** a ficha da obra (`/obras/obra/[id]`) deixa de ser só leitura. Os três
blocos — **Autorização**, **Identificação**, **Cronograma** — ganham **Editar / Salvar / Cancelar**,
cada um por vez. Quem descobre hoje quem liberou uma obra de agosto registra agora, sem depender de
a obra estar em `definir`. Mudar o **início** abre a janela de remarcação com **motivo obrigatório**,
escolhido de uma lista padronizada que o próprio usuário pode ampliar. Mudar a **duração** continua
livre. E a Triagem passa a ter um **Salvar dados** separado do **Liberar**, para quem já sabe o tipo,
o valor ou quem liberou antes de ter equipe definida.

---

## 2. Escopo

### 2.1 O que entra

| # | Item | Onde no mockup |
|---|---|---|
| E1 | Triagem com bloco **Dados da obra** (tipo, valor, analista do cliente, OS aprovada em) e botão **Salvar dados**, que grava sem liberar | seção A |
| E2 | **Origem** sai de "Dados da obra" e entra no bloco **Autorização para executar**, na Triagem e na ficha | seção A e B (feedback 14 A) |
| E3 | Ficha: bloco **Autorização** editável — origem, liberado por, data da liberação, OS aprovada em | seção B |
| E4 | Ficha: bloco **Identificação** editável — tipo, valor, analista do cliente, mau uso. Nº OS, loja e chamado continuam **só leitura** | seção B |
| E5 | Ficha: bloco **Cronograma** editável — responsável, equipe, prioridade, início planejado, duração | seção B |
| E6 | **Janela de remarcação** ao salvar um início diferente: motivo obrigatório de lista padronizada, "Outro" com descrição, **Cadastrar novo motivo** dentro da própria janela | seção B |
| E7 | Bloco **Remarcações** da ficha passa a mostrar motivo, descrição e quem remarcou (hoje mostra só data/de/para/motivo, e a tabela está vazia porque nada escreve nela) | seção B |
| E8 | Salvar "OS aprovada em" com a obra parada em `aprovarOS` **avança a obra para `fecharOS`**, depois de um diálogo que diz o que vai acontecer | seção B, fim de `ligarB()` |
| E9 | Correção do texto da Triagem "Ela entrou pelo Field em…", que hoje mostra a coluna errada (ver R23) | seção A |

### 2.2 O que explicitamente NÃO entra

| Item | Por quê |
|---|---|
| **Histórico de alterações (Parte 2, seção D do mockup)** — a tela `_historico.tsx`, o filtro por bloco, a linha do tempo | Corte de escopo do João, 18/09. **Mas ver a seção 9, decisão D1:** o *mecanismo* de gravação do histórico já existe em código e esta spec se apoia nele |
| **Esteira com "Concluir esta etapa" (seção C)** | Fora do corte. Consequência direta: dos sete marcos hoje órfãos, esta entrega passa a escrever **dois** — `os_aprovada` e `marco_os_aprov` (via "OS aprovada em"). Os outros cinco — `marco_exec_fim`, `marco_relatorio`, `marco_fechou_os`, `marco_liberou_fat`, `marco_faturou` — **continuam sem ninguém que os escreva** e esperam a seção C |
| **SLAs (seção F)**: o selo "SLA 1 · N dias" no topo da ficha, o quadro dos dois SLAs, a visão da reunião semanal | Tela nova, fora do corte. O cabeçalho da ficha mantém o `BadgeDias` atual |
| **Regra da obra crítica (seção E)** | **Já implementada** em `app/obras/_lib/tipos.ts:470-491` (`LIMIAR_ATENCAO = 20`, `LIMIAR_CRITICO = 30`, `ancoraDias`). Esta entrega não a altera — só não pode quebrá-la (R13, R14) |
| Renomear ou apagar motivo de remarcação | Suposição 2 do mockup: não há tela para isso. A tabela nasce com uma coluna `ativo` para o dia em que houver |
| Editar Nº OS, loja e chamado | Decisão 9 da Parte 2 e texto do próprio mockup: são do Field. Ver R19 — é a regra que faz a edição manual conviver com a recarga de 5 minutos |
| Trava por papel (só admin edita) | Mesma decisão técnica 1 que vale para `mudarEtapaAction` (`_actions.ts:51-58`): qualquer usuário com acesso ao módulo edita. Travar exige resposta do cliente; não travar é reversível |
| Campo "cliente" na obra | Suposição 14 do mockup. Não existe coluna e não entra agora |

---

## 3. Mudanças de banco

### 3.1 O que **não** precisa de migration — e isso é a boa notícia

**Nenhuma coluna nova em `obras_obra`.** Todos os campos que a ficha editável passa a gravar já
existem na tabela, com o tipo certo (`sdd-sql-obras-v0.sql:60-135`, espelhados em
`app/obras/_lib/tipos.ts:229-283`):

`origem`, `liberado_por`, `liberado_em`, `aprovacao`, `os_aprovada`, `marco_os_aprov`, `tipo`,
`valor`, `analista_cliente`, `mau_uso`, `pcm`, `equipe`, `prioridade`, `inicio_plan`, `duracao`,
`etapa`, `desde_etapa`, `etapa_por`, `etapa_em`, `atualizacao`.

A tabela `obras_remarcacao` também já existe (`sdd-sql-obras-v0.sql:218-226`), com RLS
`obras access` e índice por `obra_id`. Ela está **vazia e nunca foi escrita por código nenhum** —
foi criada "só leitura na v0, vem da importação", e a importação de planilha foi descartada.

### 3.2 O que precisa

Três coisas, todas no arquivo novo `sdd-sql-obras-motivos-remarcacao.sql` (raiz do projeto):

1. **Tabela `obras_motivo_remarcacao`** — a lista padronizada, semeada com os motivos que o Diário
   já usa, e aberta a cadastro de motivo novo.
2. **Duas colunas em `obras_remarcacao`**: `detalhe text` (a descrição que "Outro" pede) e
   `registrado_por text` (o nome que o mockup mostra na linha da remarcação).
3. **RPC `obras_remarcar_inicio`** — grava a mudança de início e a linha de remarcação **na mesma
   transação**. Sem ela, a data mudaria e a remarcação poderia não ser registrada, que é
   precisamente o dado que esta entrega existe para não perder.

> **Dependência que precisa de decisão:** esta spec pressupõe que
> `sdd-sql-obras-historico.sql` (já escrito, já revisado em `review-historico-2026-09-15.md`, **não
> aplicado**) seja aplicado junto. Ele cria a tabela `obras_historico` e a RPC
> `obras_aplicar_alteracao`, que é o caminho de escrita usado aqui. **Ver a decisão D1 da seção 9**
> — lá está a alternativa, caso o João prefira não ampliar a migration na véspera.

### 3.3 O SQL

```sql
-- ============================================================
-- Controle de Obras — motivos de remarcação e remarcação do início
-- J4, seção B do mockup-j4-v02.html — 2026-09-18
-- Migration da §3 de
-- docs/cliente/2026-08-31-sistema-controle-de-obras/spec-ficha-editavel-2026-09-18.md
-- ============================================================
-- ESTADO: NÃO APLICADO. Rodar à mão no SQL Editor do Supabase, projeto de
-- produção iyytcavcgukfjnjjrerx. Confirme o ref antes de colar (AGENTS.md).
-- Não existe CLI de migration neste projeto.
--
-- ORDEM: rodar DEPOIS de sdd-sql-obras-historico.sql. A seção 4 deste arquivo
-- chama public.obras_aplicar_alteracao, criada lá — o Postgres valida o corpo
-- da função no momento da criação, então a ordem não é opcional.
--
-- IDEMPOTENTE por construção: create table if not exists, add column if not
-- exists, create or replace function, drop policy if exists antes de recriar,
-- e o seed com on conflict do nothing.
--
-- LIMITE CONHECIDO DA IDEMPOTÊNCIA (mesmo aviso de sdd-sql-obras-v0.sql:13-17):
-- `create table if not exists` não altera uma tabela que já exista com colunas
-- diferentes. Toda coluna acrescentada depois da primeira versão deste arquivo
-- tem que virar um `alter table ... add column if not exists` explícito aqui
-- embaixo, nunca uma edição do `create table` lá em cima.
--
-- AS DUAS ARMADILHAS DE PL/pgSQL DO AGENTS.md:
-- 1. Guarda de autorização que devolve NULL falha ABERTA. A única guarda aqui
--    é public.obras_has_access(), que é exists()-based e devolve sempre
--    true/false — nada de `in (lista)`.
-- 2. Trigger compartilhada entre tabelas de colunas diferentes. Não se aplica:
--    este arquivo não cria trigger nenhuma.
--
-- TRANSAÇÃO EXPLÍCITA: o arquivo roda inteiro dentro de begin/commit. Estado
-- parcial em produção é caro; qualquer erro no meio desfaz tudo.
-- ============================================================

begin;


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
-- sem acento fica do lado do app (pré-checagem), porque ela exigiria a
-- extensão `unaccent`, e habilitar extensão em produção não vale o risco
-- para o ganho.
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

-- Para quem já rodou uma versão anterior deste arquivo:
alter table public.obras_motivo_remarcacao add column if not exists ativo boolean not null default true;
alter table public.obras_motivo_remarcacao add column if not exists ordem int not null default 100;
alter table public.obras_motivo_remarcacao add column if not exists criado_por text;

create unique index if not exists obras_motivo_remarcacao_chave_uniq
  on public.obras_motivo_remarcacao (chave);

-- SEED — o mesmo vocabulário do Diário (app/obras/_lib/tipos.ts:187-195,
-- constante BLOQUEIOS), decisão registrada no mockup v02, seção G. A grafia é
-- a do CÓDIGO ("Cliente / loja", com espaços), não a do texto do mockup
-- ("Cliente/loja"): duas grafias para a mesma coisa quebrariam o cruzamento
-- entre o bloqueio do dia e o motivo da remarcação, que é justamente a razão
-- de as duas listas serem a mesma.
-- "Sem bloqueio" NÃO entra: não é motivo de remarcação, é a ausência de um.
-- "Outro" entra, e é o único que pede descrição.
insert into public.obras_motivo_remarcacao (nome, ordem) values
  ('Clima', 10),
  ('Cliente / loja', 20),
  ('Disponibilidade de equipe', 30),
  ('Contratação de prestador', 40),
  ('Falta de material', 50),
  ('Outro', 900)
on conflict (chave) do nothing;


-- ============================================================
-- 2. obras_remarcacao — duas colunas novas
-- ============================================================
-- A tabela existe desde a v0 (sdd-sql-obras-v0.sql:218-226) e nunca foi
-- escrita: nasceu para receber a importação de planilha, que foi descartada.
--
-- `motivo` continua TEXTO, e isso é deliberado: ele guarda o NOME do motivo no
-- momento da remarcação, não uma FK. Se um motivo for renomeado um dia, as
-- remarcações antigas continuam dizendo o que foi escolhido de verdade. É o
-- mesmo princípio de obras_historico, que grava `de`/`para` já formatados.
alter table public.obras_remarcacao add column if not exists detalhe text;
alter table public.obras_remarcacao add column if not exists registrado_por text;

-- Com "Outro", a descrição é obrigatória; sem "Outro", não há descrição.
-- A regra vive na Server Action (R10) e AQUI, porque a tela não é fronteira.
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
end $$;

-- `not valid` de propósito: a tabela está vazia hoje, mas o `not valid` faz o
-- check valer para toda linha NOVA sem varrer o passado — se um dia alguém
-- carregar remarcações históricas antes de rodar este arquivo, a migration não
-- falha no meio. Validar depois, à mão, quando houver certeza:
--   alter table public.obras_remarcacao
--     validate constraint obras_remarcacao_detalhe_so_com_outro;


-- ============================================================
-- 3. RLS — a policy "obras access", igual a todas as outras tabelas do módulo
-- ============================================================
-- Padrão de sdd-sql-obras-v0.sql seção 6. obras_remarcacao já tem a dela;
-- recriada aqui por idempotência, com a mesma expressão, sem mudar nada.
alter table public.obras_motivo_remarcacao enable row level security;
drop policy if exists "obras access" on public.obras_motivo_remarcacao;
create policy "obras access" on public.obras_motivo_remarcacao for all to authenticated
  using (public.obras_has_access()) with check (public.obras_has_access());

alter table public.obras_remarcacao enable row level security;
drop policy if exists "obras access" on public.obras_remarcacao;
create policy "obras access" on public.obras_remarcacao for all to authenticated
  using (public.obras_has_access()) with check (public.obras_has_access());


-- ============================================================
-- 4. RPC obras_remarcar_inicio — mudança de início + remarcação, atômicas
-- ============================================================
-- POR QUE ELA EXISTE: obras_aplicar_alteracao grava obras_obra e
-- obras_historico juntos, mas não conhece obras_remarcacao. Se a Server Action
-- fizesse "RPC, depois insert", uma falha entre as duas gravaria a data nova
-- SEM a remarcação — perder o motivo da remarcação é perder exatamente o dado
-- que esta entrega existe para capturar.
--
-- O corpo de uma função é uma transação só: ou as duas escritas acontecem, ou
-- nenhuma.
--
-- security INVOKER, como obras_aplicar_alteracao: herda a RLS de quem chama,
-- não eleva privilégio. A guarda de acesso é a da função chamada, que levanta
-- exceção com errcode 42501 — não há guarda nova aqui que pudesse falhar
-- aberta com NULL.
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
  v_quem    text := lower(trim(auth.jwt() ->> 'email'));
  v_motivo  text := btrim(coalesce(p_motivo, ''));
  v_detalhe text := nullif(btrim(coalesce(p_detalhe, '')), '');
begin
  if v_motivo = '' then
    raise exception 'obras_remarcar_inicio: motivo da remarcação é obrigatório'
      using errcode = '22023';
  end if;

  if p_para is null then
    raise exception 'obras_remarcar_inicio: a data nova de início é obrigatória'
      using errcode = '22023';
  end if;

  -- O motivo tem que estar na lista. Cadastrar motivo novo é outra ação, que
  -- roda antes; aqui a lista é fechada, senão "padronizado" não significa nada.
  if not exists (
    select 1 from public.obras_motivo_remarcacao
    where chave = lower(btrim(v_motivo)) and ativo
  ) then
    raise exception 'obras_remarcar_inicio: motivo fora da lista: %', v_motivo
      using errcode = '23514';
  end if;

  -- 1) a obra. Toda a autorização, a validação de coluna e o histórico moram
  --    aqui dentro — este arquivo não os reimplementa.
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
-- VERIFICAÇÃO — rodar DEPOIS, fora da transação
-- ============================================================
-- 1) os seis motivos entraram:
--   select nome, ordem, ativo from public.obras_motivo_remarcacao order by ordem;
-- 2) as colunas novas existem:
--   select column_name from information_schema.columns
--   where table_name = 'obras_remarcacao' order by ordinal_position;
-- 3) a RLS está ligada nas duas tabelas:
--   select relname, relrowsecurity from pg_class
--   where relname in ('obras_motivo_remarcacao','obras_remarcacao');
-- 4) as policies:
--   select tablename, policyname, cmd from pg_policies
--   where tablename in ('obras_motivo_remarcacao','obras_remarcacao');
-- 5) a RPC existe e está concedida só a authenticated:
--   select proname, proacl from pg_proc where proname = 'obras_remarcar_inicio';
```

---

## 4. Server Actions

Todas em `app/obras/obra/[id]/_actions.ts`, ao lado das duas que já existem. **A receita fixa do
hub, na ordem, sem exceção** (`_actions.ts:5-9`, e o mesmo padrão em `diario/_actions.ts` e
`tarefas/_actions.ts`):

```ts
const supabase = await createClient()                               // client do USUÁRIO, não service role
const { data: { user } } = await supabase.auth.getUser()
if (!user?.email) return { error: 'Não autenticado' }
if (!(await hasSystemAccess(supabase, user.email, 'obras'))) return { error: SEM_ACESSO }
// … validação … → gravação → revalidatePath → { success: true }
```

Invariantes que valem para **todas** as actions desta spec:

- **Nunca `throw`.** Erro vira `{ error: string }` em português. A única exceção é a trava de
  precondição de `gravarComHistorico`, que lança de propósito e síncrono, antes de qualquer rede —
  ela indica bug de quem chamou, não erro de usuário (`_lib/historico.ts:196-218`).
- **`null` é o único sentinela de vazio.** String vazia nunca é gravada (decisão 8 da spec da
  ficha, `_actions.ts:11-12`). Reusar o helper `nulo()` que já existe em `_actions.ts:28-31`.
- **A tela não é fronteira de autorização.** Toda validação de tela é repetida no servidor.
- **`revalidatePath`** em `/obras/obra/${obraId}` e `/obras/base` sempre; mais `/obras/diario`
  quando `pcm`, `equipe`, `etapa` ou `inicio_plan` mudarem (mexem na fila de alguém).
- **Quem pode chamar:** qualquer usuário autenticado, com e-mail `@manfac.com.br`, com acesso ao
  slug `obras` (ou administrador do hub, que passa direto). Sem trava por papel.
- **Despacho sequencial.** O Next.js 16 despacha Server Actions uma de cada vez por cliente
  (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, "Sequential dispatch on the
  client"). Não montar `Promise.all` de actions no cliente — e não é preciso: cada bloco salva
  sozinho.

Tipo de retorno compartilhado, o que já existe:

```ts
export type EstadoAcao = { error?: string; success?: boolean }
```

### 4.1 `salvarAutorizacaoAction`

```ts
export type DadosAutorizacao = {
  origem: string          // '' = não definido
  libPor: string
  libEm: string           // AAAA-MM-DD
  aprovadaEm: string      // AAAA-MM-DD; '' = OS ainda não aprovada
}

export async function salvarAutorizacaoAction(
  obraId: string,
  dados: DadosAutorizacao
): Promise<EstadoAcao & { avancou?: boolean }>
```

**Validação (servidor):**

| Regra | Mensagem de erro |
|---|---|
| `libEm` preenchida sem `libPor` | `Tem data da liberação sem nome. Escolha quem liberou ou apague a data.` |
| `libEm > hoje` | `A data da liberação não pode ser depois de hoje.` |
| `aprovadaEm > hoje` | `A data de aprovação não pode ser depois de hoje.` |
| `origem` fora de `ORIGENS` e diferente do valor já gravado na obra | `Origem inválida` |
| `libPor` preenchido e `libEm` vazia | não é erro: grava `hoje`, como `liberarObraAction` já faz (`_actions.ts:152`) |

**Colunas gravadas:** `origem`, `liberado_por`, `liberado_em` e — quando "OS aprovada em" mudou —
o trio `aprovacao`, `os_aprovada`, `marco_os_aprov` **sempre junto** (R7). Mais `atualizacao = hoje`.

**Avanço de etapa (E8):** se `obra.etapa === 'aprovarOS'`, `aprovadaEm` está preenchida e a obra
**não** tinha aprovação antes, a action também grava `etapa = 'fecharOS'`, `desde_etapa = hoje`,
`etapa_por = user.email`, `etapa_em = now()`, e devolve `{ success: true, avancou: true }`. O
diálogo que anuncia isso é da tela; a decisão de avançar é do servidor.

**Erro:** `{ error: 'Erro ao salvar a autorização' }` para falha da RPC. `{ error: 'Obra não
encontrada' }` para leitura vazia.

### 4.2 `salvarIdentificacaoAction`

```ts
export type DadosIdentificacao = {
  tipo: string
  valor: string           // texto pt-BR: '18.450,00'
  analista: string
  mauUso: boolean
}

export async function salvarIdentificacaoAction(
  obraId: string,
  dados: DadosIdentificacao
): Promise<EstadoAcao>
```

**Validação:** `valor`, quando preenchido, tem que virar número finito ≥ 0 pelo parser `numeroBR`
(§5.4) — senão `Valor precisa ser um número em reais, como 18.450,00.` `tipo` fora de `TIPOS_OBRA`
e diferente do já gravado → `Tipo inválido`.

**Colunas:** `tipo`, `valor` (numérico), `analista_cliente`, `mau_uso`, `atualizacao = hoje`.
**Nunca** `os`, `loja`, `descricao` (R19).

### 4.3 `salvarCronogramaAction`

```ts
export type DadosCronograma = {
  resp: string
  equipe: string
  prioridade: string
  inicio: string          // AAAA-MM-DD
  duracao: string
  motivo?: string         // obrigatório quando o início MUDA
  detalhe?: string        // obrigatório quando motivo === 'Outro'
}

export async function salvarCronogramaAction(
  obraId: string,
  dados: DadosCronograma
): Promise<EstadoAcao>
```

**Validação:**

| Regra | Mensagem |
|---|---|
| `duracao` fora de 1–180, quando preenchida | `A duração precisa ficar entre 1 e 180 dias` |
| `prioridade` fora de `PRIORIDADES` | `Prioridade inválida` |
| início mudou **e** havia início antes **e** `motivo` vazio | `Escolha um motivo para remarcar.` |
| `motivo` preenchido e ausente da tabela `obras_motivo_remarcacao` | `Motivo de remarcação desconhecido. Recarregue a página.` |
| `motivo === 'Outro'` e `detalhe` com menos de 3 caracteres úteis | `Descreva o outro motivo (pelo menos 3 letras).` |
| início mudou e **não** havia início antes | **não é remarcação**: grava sem motivo (R9) |

**Gravação:** quando há remarcação, a action chama a RPC `obras_remarcar_inicio`; quando não há,
chama `gravarComHistorico` normal. Colunas: `pcm`, `equipe`, `prioridade`, `inicio_plan`,
`duracao`, `atualizacao = hoje`. **`pend_resp` não é tocado** (é o dono da pendência, conceito
separado do responsável da obra).

### 4.4 `salvarDadosTriagemAction`

```ts
export type DadosTriagemOpcionais = {
  tipo: string; valor: string; analista: string; aprovadaEm: string
  origem: string; libPor: string; libEm: string
}

export async function salvarDadosTriagemAction(
  obraId: string,
  dados: DadosTriagemOpcionais
): Promise<EstadoAcao>
```

O **Salvar dados** da seção A. Mesma validação de 4.1 + 4.2, e o `where` da query exige
`etapa = 'definir'` — se a obra saiu da triagem entre o carregamento e o clique, devolve
`Esta obra já foi liberada por outra pessoa. Recarregue a página.`, exatamente como
`liberarObraAction` já faz (`_actions.ts:169-171`). **Não muda a etapa.**

### 4.5 `cadastrarMotivoRemarcacaoAction`

```ts
export async function cadastrarMotivoRemarcacaoAction(
  nome: string
): Promise<{ error?: string; motivo?: { id: string; nome: string }; jaExistia?: boolean }>
```

Normaliza (`trim`, colapsa espaços internos, primeira letra maiúscula), exige 3–60 caracteres,
procura um motivo existente comparando **sem acento e sem caixa** (§5.4, `normalizarMotivo`). Se
achar, devolve `{ motivo: existente, jaExistia: true }` — a tela diz `"X" já está na lista: foi
escolhido para você.` e marca o radio, exatamente como o mockup (`mockup-j4-v02.html:1577-1580`).
Se não achar, insere e devolve o motivo novo. Violação do índice único por corrida (duas pessoas
cadastrando o mesmo motivo ao mesmo tempo) **não é erro**: relê e devolve `jaExistia: true`.

`criado_por = user.email`. Sem trava por papel (suposição 2 do mockup).

### 4.6 `liberarObraAction` — alteração da action existente

Hoje ela grava só `liberado_por`/`liberado_em` da autorização (`_actions.ts:141-159`). Passa a
gravar também o que o usuário preencheu em **Dados da obra** e em **Origem**, porque o diálogo de
liberar promete isso: *"Os dados da obra e a autorização preenchidos também são gravados"*
(`mockup-j4-v02.html:1223`). Colunas acrescentadas: `origem`, `tipo`, `valor`, `analista_cliente`,
`aprovacao`/`os_aprovada`/`marco_os_aprov`. O resto — os cinco obrigatórios, a trava
`etapa = 'definir'`, os textos fixos de pendência — **não muda**.

Passa a gravar pelo mesmo caminho das outras (`gravarComHistorico`, bloco `'Triagem'`), para que a
liberação apareça no histórico como o mockup mostra (`mockup-j4-v02.html:839-843`).

---

## 5. Telas e componentes

### 5.1 Arquivos a CRIAR

| Caminho | O que faz |
|---|---|
| `app/obras/_ui/dialogo.tsx` | `'use client'`. O módulo **não tem** componente de diálogo — `_ui/primitivos.tsx` é puramente apresentacional e o comentário do topo proíbe estado ali. Componente novo sobre o `<dialog>` nativo: `showModal()`, fechar no Esc, foco no primeiro botão `ghost` ao abrir, foco devolvido ao gatilho ao fechar, `aria-labelledby` no título. Props: `{ aberto, titulo, children, botoes: { id, texto, ghost?, desabilitado?, onClick? }[], onFechar }` |
| `app/obras/obra/[id]/_bloco-editavel.tsx` | `'use client'`. A casca compartilhada dos três blocos: cabeçalho com **Editar** (ou o selo `editando`), corpo em leitura ou formulário, rodapé com autoria, barra de ações **Salvar** / **Cancelar** / hint `aria-live`, caixa de erro de gravação. Espelha `blocoB()` do mockup (`:857-866`). Recebe `leitura`, `formulario`, `onSalvar`, `onCancelar`, `salvando`, `erro`, `rodape` |
| `app/obras/obra/[id]/_bloco-autorizacao.tsx` | `'use client'`. Origem, Liberado por, Data da liberação, OS aprovada em. Texto explicativo condicional (as quatro variantes de `autTxt`, `mockup:906-910`, já espelhadas em `_ficha.tsx:515-541`). Dispara o diálogo de E8 quando aplicável |
| `app/obras/obra/[id]/_bloco-identificacao.tsx` | `'use client'`. Nº OS, loja e chamado em bloco `readonly` com a etiqueta **vem do Field** e a frase de por que não se editam aqui. Tipo, Valor, Analista, Mau uso editáveis |
| `app/obras/obra/[id]/_bloco-cronograma.tsx` | `'use client'`. Responsável, Equipe, Prioridade, Início planejado, Duração. Aviso dinâmico "Mudar o início é uma remarcação" e recálculo ao vivo do final (`dinCro()`, `mockup:868-877`). Abre `_dialogo-remarcar` no Salvar |
| `app/obras/obra/[id]/_dialogo-remarcar.tsx` | `'use client'`. Lista de motivos em `radio` dentro de `<fieldset>`, campo "Qual é o outro motivo?" que aparece só com "Outro", `+ Cadastrar novo motivo` com input inline, mensagem `aria-live` de validação, e a lista do que vai acontecer ao salvar (`mockup:984-1013`) |
| `app/obras/_lib/ficha-campos.ts` | Puro, sem React e sem Supabase: `numeroBR`, `moedaParaTexto`, `normalizarMotivo`, `validarAutorizacao`, `validarIdentificacao`, `validarCronograma`. **A mesma função valida na tela e na Server Action** — é isso que garante que as duas nunca divirjam |
| `sdd-sql-obras-motivos-remarcacao.sql` | A migration da §3.3, na raiz |
| `app/obras/__tests__/ficha-campos.test.ts` | Testes das funções puras (§7) |
| `app/obras/__tests__/ficha-editavel.test.ts` | Testes das Server Actions novas (§7) |

### 5.2 Arquivos a ALTERAR

| Caminho | O que muda |
|---|---|
| `app/obras/obra/[id]/_actions.ts` | As cinco actions de §4.1–4.5 e a alteração de `liberarObraAction` (§4.6) |
| `app/obras/obra/[id]/_ficha.tsx` | Os três blocos `<Box>` de Autorização (`:489-544`), Identificação (`:547-588`) e Cronograma (`:591-608`) passam a renderizar os componentes client novos. O bloco **Remarcações** (`:611-632`) passa a mostrar `detalhe` e `registrado_por`. **Origem sai de Identificação** (`:573`) e entra em Autorização. Continua Server Component; o estado vive só nos filhos |
| `app/obras/obra/[id]/_triagem.tsx` | Bloco **Dados da obra** novo (tipo, valor, analista, OS aprovada em) com **Salvar dados** próprio; **Origem** entra no bloco Autorização; corrige o texto de entrada (E9/R23); troca "analista da DPSP" por "analista do cliente" (`:307`, `:318`) e "no sistema da DPSP" por "no sistema do cliente" — feedback 14 A: *"o texto está vinculado muito a DPSP, mas isso será usado para todas as obras da Manfac em todos os clientes"* |
| `app/obras/obra/[id]/page.tsx` | As listas `responsaveis`/`equipes`/`analistasCliente` hoje só são montadas no ramo da Triagem (`:104-120`) — sobem para antes do `if`, porque a ficha passa a precisar delas. Acrescenta a busca de `obras_motivo_remarcacao` (ordenada por `ordem, nome`) e, para o rodapé de autoria, a última linha de `obras_historico` por bloco |
| `app/obras/_lib/tipos.ts` | Duas constantes novas ao lado de `BLOQUEIOS`/`PRIORIDADES`: `ORIGENS` e `TIPOS_OBRA`. E `entradaDaObra(o) = dataSP(o.created_at)`, o nome honesto da data que a Triagem mostra hoje errado |
| `app/obras/_ui/primitivos.tsx` | **Nada.** O arquivo não tem `'use client'` e o comentário do topo diz "Não acrescente estado aqui". Os inputs ficam nos componentes de bloco, como já acontece em `diario/_cartao.tsx` |
| `app/obras/__tests__/ficha.test.ts` | Acrescenta os casos de `liberarObraAction` com os campos novos |

### 5.3 Fluxo de uma edição, ponta a ponta

1. O usuário clica **Editar** no bloco. `_bloco-editavel` entra em modo formulário com uma cópia
   do valor atual. Só um bloco por vez fica em edição? **Não** — o mockup permite os três juntos
   (`B.edit` é um mapa), e cada um salva sozinho.
2. **Salvar** → validação de tela (a mesma função de `_lib/ficha-campos.ts`). Campo inválido: a
   caixa ganha a classe de erro, a mensagem aparece com `role="alert"`, o foco vai para o primeiro
   inválido. Nada vai ao servidor.
3. No Cronograma, se o início mudou e havia início antes, abre `_dialogo-remarcar`. **Remarcar e
   salvar** fica desabilitado até haver motivo (e descrição, com "Outro").
4. `useTransition` chama a Server Action. Enquanto pendente: botões desabilitados, texto
   `Salvando…`, hint `Gravando no servidor. Não feche a página.`
5. Sucesso: sai do modo edição, `revalidatePath` já trouxe a ficha nova no mesmo roundtrip
   (Next 16 devolve valor de retorno e RSC Payload na mesma resposta), foco volta ao **Editar**.
6. Erro: a caixa de erro do mockup, literal — *"O servidor não confirmou, então **nada foi
   gravado**. O que você preencheu continua abaixo. Clique em Salvar de novo."* Os valores
   digitados **não são perdidos** (R21).

### 5.4 Funções puras de `_lib/ficha-campos.ts`

| Função | Contrato |
|---|---|
| `numeroBR(texto)` | `'18.450,00'` → `18450`; `'4380'` → `4380`; `''` → `null`; `'abc'`, `'-5'` → `undefined` (inválido). Três retornos distintos de propósito: vazio e inválido não são a mesma coisa |
| `moedaParaTexto(n)` | `18450` → `'18.450,00'`, para preencher o input ao entrar em edição |
| `normalizarMotivo(s)` | `trim`, colapsa espaços, `NFD` sem diacríticos, minúsculas. Só para comparar, nunca para gravar |
| `validarAutorizacao / validarIdentificacao / validarCronograma` | Recebem o rascunho, devolvem `Record<campo, mensagem>` vazio quando tudo certo. **Usadas nos dois lados** |

---

## 6. Regras de negócio

Cada uma é testável, e a seção 7 diz por qual teste.

**Autorização e acesso**

- **R1** — Toda escrita desta entrega passa por Server Action que checa, no servidor,
  `auth.getUser()` e `hasSystemAccess(supabase, email, 'obras')`. Sem as duas, nada é gravado e a
  action devolve `{ error }`.
- **R2** — Nenhuma action lança exceção por erro de usuário ou de rede. Erro vira mensagem em
  português.
- **R3** — Qualquer usuário com acesso ao módulo edita qualquer bloco de qualquer obra, e cadastra
  motivo novo. Não há trava por papel.
- **R4** — A RLS vale mesmo se a action for contornada: `obras_motivo_remarcacao` e
  `obras_remarcacao` só aceitam leitura e escrita de quem satisfaz `obras_has_access()`.

**O que é gravado**

- **R5** — String vazia nunca é gravada. Campo limpo pelo usuário vira `null`.
- **R6** — A ficha grava, das sete colunas de marco hoje órfãs, exatamente **duas**:
  `os_aprovada` e `marco_os_aprov`. `marco_exec_fim`, `marco_relatorio`, `marco_fechou_os`,
  `marco_liberou_fat` e `marco_faturou` continuam sem escritor.
- **R7** — "OS aprovada em" é **um campo de tela para três colunas**, sempre coerentes: com data,
  `aprovacao = data`, `os_aprovada = true`, `marco_os_aprov = data`; sem data, `aprovacao = null`,
  `os_aprovada = false`, `marco_os_aprov = null`. Nunca duas das três divergem.
- **R8** — `liberado_em` só é gravada junto de `liberado_por`. Nome sem data grava `hoje`; data sem
  nome é erro de validação. (Regra que já existe em `_actions.ts:149-152` e passa a valer também na
  ficha.)

**Remarcação**

- **R9** — Mudar `inicio_plan` **quando já havia um início** é remarcação: exige motivo. Preencher
  um início que estava vazio **não** é remarcação e não pede motivo.
- **R10** — O motivo é obrigatório, vem da lista `obras_motivo_remarcacao`, e é validado no
  servidor **e** no banco (a RPC recusa motivo fora da lista). Com "Outro", a descrição é
  obrigatória (mínimo 3 caracteres úteis) e vale só para aquela remarcação.
- **R11** — A mudança de `inicio_plan` e a linha em `obras_remarcacao` são gravadas na **mesma
  transação**. Uma nunca existe sem a outra.
- **R12** — Mudar a **duração**, o responsável, a equipe ou a prioridade não abre janela nenhuma e
  não pede motivo. O final calculado se recalcula sozinho — não existe campo "data final".
- **R13** — Remarcar **não** altera os dias em aberto nem a severidade da obra: `ancoraDias` olha
  `aprovacao`, `liberado_em` e `created_at`, nunca `inicio_plan`
  (`app/obras/_lib/tipos.ts:475-491`). Esta entrega não pode introduzir `inicio_plan` nessa conta.
- **R14** — **Registrar** uma data de liberação ou de aprovação que não existia nunca diminui os
  dias em aberto. Garantido por construção — a âncora é a **mais antiga** entre as três candidatas,
  e a entrada é candidata sempre —, não por código novo. **Corolário que precisa estar na tela:**
  *corrigir* uma data que já existia para uma data mais recente, ou apagá-la, **pode** diminuir a
  contagem. Isso é permitido de propósito (senão não há como consertar um erro de digitação) e o
  histórico registra quem fez.
- **R15** — Um motivo cadastrado entra na lista para todas as obras, já vem escolhido na janela em
  que foi criado, e nunca duplica: comparação sem acento e sem caixa, com índice único no banco
  como última linha de defesa.

**Etapa**

- **R16** — Salvar "OS aprovada em" com a obra em `aprovarOS`, quando ela não tinha aprovação,
  avança para `fecharOS`, zera `desde_etapa` e registra `etapa_por`/`etapa_em`. Só depois de um
  diálogo que diz exatamente o que vai acontecer.
- **R17** — Em qualquer outra etapa, preencher "OS aprovada em" **não** move a obra.
- **R18** — Nenhum bloco editável muda `etapa` fora do caso R16. Trocar etapa continua sendo
  trabalho de `mudarEtapaAction`.

**Convivência com o Field**

- **R19** — Nº OS, loja e chamado **não são editáveis na ficha nem na triagem**. Verificado no
  código: a sincronização só escreve `os`, `loja`, `descricao`, `fonte`, `field_id`,
  `field_ausente_desde` e `field_ausente_em`, e para `loja`/`descricao` **só quando estão vazias**
  (`app/obras/sincronizar/_sincronizacao.ts:317-327`, com `vazio()` em `:106-109`). Se a ficha
  permitisse digitar uma loja, a recarga nunca mais a corrigiria e ninguém seria avisado da
  divergência.
- **R20** — **Todo campo que a ficha editável grava está fora da lista que o Field toca.** Os dois
  conjuntos são disjuntos, e por isso a recarga de 5 minutos não precisa de trava, de bloqueio nem
  de coluna "editado à mão": ela não tem como sobrescrever o que foi digitado no hub. Esta é uma
  **invariante de arquitetura** — o teste de R20 existe para quebrar no dia em que alguém
  acrescentar um campo à sincronização.

**Erro e concorrência**

- **R21** — Falha de gravação nunca perde o que o usuário digitou. O bloco continua em modo edição,
  com os valores, e a mensagem diz que **nada foi gravado**.
- **R22** — Duas pessoas editando a mesma obra: **a última gravação vence**, por bloco. Risco
  conhecido e aceito nesta entrega (mesmo tipo de risco que o "último administrador" do
  `/admin/acessos`, `AGENTS.md`). Ele é tolerável porque (a) os três blocos são conjuntos de campos
  disjuntos, então duas pessoas em blocos diferentes não se atropelam, e (b) o histórico registra
  as duas gravações, então uma sobrescrita é visível e refazível à mão. Ver o risco 4 da seção 8.
- **R23** — A Triagem para de afirmar que a obra "entrou pelo Field" numa data que é outra coisa.
  Hoje ela usa `obra.aprovacao` (`_triagem.tsx:146`), que é a data de autorização vinda da antiga
  importação de planilha e é `null` em toda obra do Field — mostra "—". Passa a usar
  `entradaDaObra(obra)`, isto é `dataSP(created_at)`, a mesma data que `ancoraDias` chama de
  "entrada". **Sem esta correção a entrega piora a tela:** assim que a ficha começar a gravar
  `aprovacao`, o texto passaria a exibir a data de aprovação da OS como se fosse a data de entrada.

---

## 7. Testes

Padrão do projeto: Jest, arquivos em `__tests__/` ao lado do código, Supabase/`next/cache`/
`systemAccess` mockados, **nunca banco real** (`app/obras/__tests__/ficha.test.ts:1-30`). `hoje` é
sempre passado explicitamente, para o teste não depender do relógio da máquina
(`__tests__/tipos.test.ts`).

### 7.1 `app/obras/__tests__/ficha-campos.test.ts` — funções puras

| Caso | Prova |
|---|---|
| `numeroBR` converte `'18.450,00'`, `'4380'`, `'0,50'` | §5.4 |
| `numeroBR('')` devolve `null` e `numeroBR('abc')`/`numeroBR('-1')` devolvem `undefined` | R5, §5.4 |
| `moedaParaTexto(numeroBR(x)) === x` para valores típicos | ida e volta sem perder centavo |
| `normalizarMotivo('  Falta   de  Material ')` === `normalizarMotivo('falta de material')` | R15 |
| `normalizarMotivo('Contratação')` === `normalizarMotivo('contratacao')` | R15, acento |
| `validarAutorizacao` acusa data de liberação sem nome | R8 |
| `validarAutorizacao` aceita nome sem data | R8 |
| `validarAutorizacao` acusa liberação e aprovação no futuro | §4.1 |
| `validarCronograma` acusa duração 0 e 181, aceita 1 e 180 | §4.3 |
| `validarCronograma` exige motivo quando o início muda e havia início | R9 |
| `validarCronograma` **não** exige motivo quando o início estava vazio | R9 |
| `validarCronograma` exige descrição com "Outro" e a recusa com 2 caracteres | R10 |

### 7.2 `app/obras/__tests__/ficha-editavel.test.ts` — Server Actions

| Caso | Prova |
|---|---|
| Cada uma das cinco actions recusa quem não tem acesso, **sem escrever nada** (`expect(rpcMock).not.toHaveBeenCalled()`) | R1 |
| Cada uma recusa usuário sem e-mail | R1 |
| Nenhuma lança quando a RPC devolve erro: retorno é `{ error: … }` | R2 |
| `salvarAutorizacaoAction` grava `origem`/`liberado_por`/`liberado_em` e **não** grava `os`, `loja`, `descricao` | R19 |
| `salvarAutorizacaoAction` com campo limpo manda `null`, nunca `''` | R5 |
| `salvarAutorizacaoAction` com data de aprovação grava `aprovacao`, `os_aprovada: true` e `marco_os_aprov` **no mesmo objeto** | R7 |
| `salvarAutorizacaoAction` limpando a aprovação grava as três como vazio/`false` | R7 |
| `salvarAutorizacaoAction` com obra em `aprovarOS` e aprovação nova grava `etapa: 'fecharOS'`, `desde_etapa`, `etapa_por`, `etapa_em`, e devolve `avancou: true` | R16 |
| A mesma, com obra em `andamento`, **não** manda `etapa` no objeto de campos | R17 |
| A mesma, com obra em `aprovarOS` que **já tinha** aprovação, não avança | R16 |
| `salvarIdentificacaoAction` converte `'18.450,00'` para `18450` | §5.4 |
| `salvarIdentificacaoAction` recusa valor não numérico | §4.2 |
| `salvarCronogramaAction` com início igual ao atual chama `gravarComHistorico`, **não** a RPC de remarcação | R12 |
| `salvarCronogramaAction` com início novo e motivo chama `obras_remarcar_inicio` com `de`, `para`, `motivo`, `detalhe` | R11 |
| `salvarCronogramaAction` com início novo **sem** motivo devolve erro e **não chama RPC nenhuma** | R9, R10 |
| `salvarCronogramaAction` com início preenchido pela primeira vez grava sem motivo | R9 |
| `salvarCronogramaAction` com `motivo: 'Outro'` e descrição de 2 letras devolve erro | R10 |
| `salvarCronogramaAction` não manda `pend_resp` mesmo mudando `pcm` | §4.3 |
| `salvarDadosTriagemAction` mantém a etapa: `etapa` não aparece nos campos | §4.4 |
| `salvarDadosTriagemAction` devolve o erro de corrida quando zero linhas mudam | §4.4 |
| `cadastrarMotivoRemarcacaoAction` devolve `jaExistia` para `'clima'` quando `'Clima'` existe | R15 |
| `cadastrarMotivoRemarcacaoAction` trata violação de único como `jaExistia`, não como erro | R15 |
| `cadastrarMotivoRemarcacaoAction` recusa nome com 2 caracteres e com 61 | §4.5 |
| Toda action de sucesso chama `revalidatePath('/obras/obra/x')` e `'/obras/base'` | §4 |
| `salvarCronogramaAction` que muda `pcm` também revalida `/obras/diario` | §4 |

### 7.3 `app/obras/__tests__/tipos.test.ts` — acréscimos à regra da âncora

| Caso | Prova |
|---|---|
| Obra com `created_at` de 01/08 e nenhuma outra data: `ancoraDias` = entrada. Registrar `liberado_por`+`liberado_em` de 20/08 **não** reduz `diasAlerta` | R14 |
| A mesma obra recebendo `aprovacao` de 25/08: `diasAlerta` continua o mesmo | R14 |
| Obra com `aprovacao` de 01/07 anterior ao `created_at`: âncora é a aprovação, `diasAlerta` **aumenta** | R14 |
| Mudar `inicio_plan` não altera `ancoraDias`, `diasAlerta`, `critico` nem `sev` | R13 |
| Fronteira preservada: `diasAlerta = 30` não é crítica, `31` é | regra E, não pode regredir |

### 7.4 `app/obras/sincronizar/__tests__/_sincronizacao.test.ts` — acréscimo

| Caso | Prova |
|---|---|
| **Teste de invariante:** o conjunto de colunas que `planejarSincronizacao` pode escrever numa obra existente é exatamente `{os, loja, descricao, fonte, field_id, field_ausente_desde, field_ausente_em}` — asserção sobre o conjunto, não sobre um exemplo | R20 |
| Obra com `origem`, `liberado_por`, `aprovacao`, `tipo`, `valor`, `inicio_plan` preenchidos no hub passa por uma sincronização completa e sai com todos intactos | R20 |
| Obra com `loja` preenchida não tem a loja sobrescrita pelo Field | R19 |

### 7.5 `app/obras/obra/[id]/__tests__/_dialogo-remarcar.test.tsx`

Renderização com `@testing-library/react`, no padrão de `_historico.test.tsx`:

| Caso | Prova |
|---|---|
| "Remarcar e salvar" nasce desabilitado | R10 |
| Escolher um motivo habilita o botão | R10 |
| Escolher "Outro" revela o campo de descrição e volta a desabilitar até 3 letras | R10 |
| Cadastrar motivo novo acrescenta o radio e já o deixa marcado | R15 |
| Cadastrar nome que já existe seleciona o existente e mostra a mensagem, sem duplicar | R15 |
| Esc fecha sem confirmar, e `onConfirmar` não é chamado | §5.1 |

### 7.6 O que os testes **não** cobrem, e precisa de teste manual antes de segunda

A migration. SQL só é verificado de verdade rodando — é a lição registrada no `AGENTS.md` sobre o
bug de trigger que passou por dois code reviews. Roteiro mínimo, no SQL Editor, depois de aplicar:

1. Os cinco blocos de verificação do fim de §3.3.
2. Com uma conta **sem** o slug `obras`, tentar `select * from obras_motivo_remarcacao` → zero
   linhas (RLS ativa).
3. `select public.obras_remarcar_inicio(...)` com um motivo fora da lista → tem que levantar exceção.
4. `select public.obras_remarcar_inicio(...)` com motivo válido → uma linha em `obras_remarcacao`
   **e** o `inicio_plan` novo em `obras_obra`, na mesma chamada.

---

## 8. Riscos e o que fazer

**1. A migration é manual e está no caminho crítico da segunda.**
Duas migrations, não uma: `sdd-sql-obras-historico.sql` (já escrita e revisada) e
`sdd-sql-obras-motivos-remarcacao.sql` (nova). Sem as duas aplicadas, a ficha editável não grava
nada — a RPC não existe e o PostgREST devolve erro.
*O que fazer:* aplicar as duas **antes** do deploy do código, na ordem (histórico primeiro), pela
Management API com o PAT (`AGENTS.md`), e rodar os blocos de verificação. Se a migration falhar em
produção e não houver tempo de investigar, o código anterior continua no ar: a ficha volta a ser só
leitura, ninguém fica sem sistema. **O deploy do código sem a migration, esse sim, quebra a tela.**

**2. O mockup v02 não tem resposta escrita do cliente nos documentos.**
O feedback registrado (`feedback-14`) é sobre a **v01**. Não há em `docs/cliente/` um arquivo com a
avaliação do cliente sobre a v02, e a v02 declara 17 suposições, várias marcadas como pendentes.
*O que fazer:* nenhuma ação de código. Mas as suposições 2 (lista de motivos) e 4 (significado e
opções de "Origem") são as que esta entrega implementa, e as duas estão marcadas como pendentes na
própria página. Estão na seção 9 como D2 e D3. Se o cliente responder depois, mudar a lista de
motivos é `insert`/`update` numa tabela, sem deploy — foi para isso que ela é tabela.

**3. `aprovacao` passa a ter valor em obras onde hoje é `null`, e ela alimenta mais de um número.**
Além da âncora, `obra.dias = diasDesde(o.aprovacao)` (`tipos.ts:425`) e `estourou()` usa esse
`dias` (`tipos.ts:513-518`). Hoje toda obra do Field tem `aprovacao = null`, então `dias` é `null` e
`estourou` é sempre `false`. Assim que alguém registrar uma aprovação antiga, aquela obra pode
passar a acender "estourou o prazo" — comportamento correto pela regra, mas novo e não anunciado.
*O que fazer:* aceitar e observar. É o sistema passando a enxergar o que não enxergava. Se virar
ruído na primeira semana, o ajuste é em `estourou()`, não na ficha. **Não** mudar `estourou` nesta
entrega: mexer na régua de alerta na véspera é trocar um problema conhecido por um desconhecido.

**4. Última gravação vence (R22).**
Duas pessoas no mesmo bloco da mesma obra, ao mesmo tempo: a segunda apaga a primeira sem avisar.
*O que fazer:* aceitar nesta entrega. O histórico grava as duas, então a perda é visível e
reversível à mão. Se virar problema real, a correção é um parâmetro `p_updated_at` na RPC — mudança
localizada, que não muda tela nenhuma.

**5. `mau_uso` passa a ser editável, e hoje ninguém o escreve.**
Ele era deduzido da coluna STATUS MANFAC da planilha (`importacao.ts:300-305`), e a importação de
planilha foi descartada. Toda obra do Field nasce `mau_uso = false`.
*O que fazer:* nada — é ganho, não risco. Vale só registrar que a etiqueta "Mau uso" vai começar a
aparecer na base pela primeira vez, e que ela é **etiqueta, não etapa**: a obra segue a mesma
esteira (texto já presente em `_ficha.tsx:558-560`).

**6. `origem` hoje é texto livre e vira `select`.**
O importador gravava qualquer texto da planilha (`importacao.ts:526`). Um `select` fechado
exibiria em branco um valor antigo fora da lista, e salvar apagaria o dado sem ninguém notar.
*O que fazer:* o `select` inclui, além de `ORIGENS`, o valor já gravado na obra quando ele estiver
fora da lista, e a Server Action aceita o valor antigo mesmo fora de `ORIGENS` (§4.1). Nenhum dado
existente é destruído por mudança de vocabulário. (Na prática a base é 100% Field e `origem` deve
estar `null` em todas — mas "deve estar" não é verificação, e a base é do cliente.)

**7. Prazo: cinco componentes client novos e seis actions em três dias úteis.**
*O que fazer:* se algo tiver que cair, a ordem de sacrifício, do mais dispensável para o menos, é:
(a) o avanço automático de etapa ao salvar a aprovação (E8/R16) — é conveniência, e
`mudarEtapaAction` já faz o trabalho à mão; (b) o bloco **Dados da obra** com **Salvar dados** na
Triagem (E1) — quem está na triagem ainda pode liberar e editar depois na ficha; (c) o
**Cadastrar novo motivo** dentro da janela (parte de E6) — a lista semeada com seis motivos resolve
a maioria dos casos, e "Outro" cobre o resto. **O que não pode cair de jeito nenhum:** os três
blocos editáveis (E3, E4, E5) e a remarcação com motivo obrigatório (E6), que são o pedido.

**8. Regressão silenciosa na regra da obra crítica.**
Esta entrega mexe justamente nas colunas que a âncora lê. Uma mudança descuidada em `ancoraDias` ou
a introdução de `inicio_plan` na conta quebraria a decisão do João de 15/09 sem quebrar teste
nenhum dos que existem hoje.
*O que fazer:* os testes 7.3 são obrigatórios e devem entrar **antes** do código das actions.

---

## 9. DECISÕES QUE FALTAM

> Estas quatro não foram decididas aqui. As três primeiras são contradições reais entre o mockup e
> um documento de decisão, ou entre o mockup e o código; a quarta é uma escolha de arquitetura cujo
> custo cai sobre o prazo.

### D1 — A ficha editável se apoia no histórico (Parte 2) ou grava por conta própria?

**A contradição.** O corte de escopo do João (18/09) diz que o histórico fica para depois. Mas o
histórico **já está escrito em código**: `app/obras/_lib/historico.ts` (`linhasDeAlteracao`,
`gravarComHistorico`, `ROTULO_CAMPO`), o componente `app/obras/obra/[id]/_historico.tsx`, os testes
`app/obras/__tests__/historico.test.ts` e `obra/[id]/__tests__/_historico.test.tsx`, e a migration
`sdd-sql-obras-historico.sql`, já revisada em `review-historico-2026-09-15.md`. O que falta é
aplicar a migration e ligar a tela. E o caminho de escrita que esse código define — a RPC
`obras_aplicar_alteracao` — **já aceita exatamente as colunas que esta ficha precisa gravar**,
incluindo `aprovacao`, `os_aprovada`, `marco_os_aprov` e `origem`
(`sdd-sql-obras-historico.sql:175-183`). Ele foi desenhado para esta tela.

**Opção 1 — apoiar-se nele (o que esta spec assume).** Aplicar `sdd-sql-obras-historico.sql` junto.
As actions chamam `gravarComHistorico`. A tela do histórico (seção D) **continua fora do escopo** —
só o mecanismo de gravação entra.
*A favor:* menos trabalho, não mais — a alternativa exige escrever o caminho de escrita duas vezes.
O rodapé de cada bloco ("Editado por AMANDA em 02/09 · ver no histórico") fica fiel ao mockup sem
nenhuma coluna nova. A gravação vira atômica. E a partir do primeiro dia de uso já existe registro
de quem mudou o quê — que é o dado que ninguém consegue reconstruir depois.
*Contra:* mais uma migration no caminho crítico da segunda. Ela está revisada, mas não aplicada.

**Opção 2 — não apoiar-se.** As actions fazem `supabase.from('obras_obra').update(...)` direto.
*A favor:* uma migration a menos.
*Contra:* o rodapé de autoria do mockup fica sem fonte — exigiria duas colunas novas
(`editado_por`, `editado_em`) que a Parte 2 torna redundantes. As seis actions são reescritas
quando a Parte 2 entrar. E a mudança de início e a remarcação deixam de ser atômicas, a não ser que
a RPC da §3.3 seja reescrita para fazer o update sozinha.

**Recomendação: Opção 1.** O trabalho da Parte 2 que esta entrega usa já está pago; o que ficou de
fora é a tela, e a tela continua de fora. A economia da Opção 2 é aparente: ela troca uma migration
revisada por duas colunas descartáveis e por reescrever seis actions daqui a duas semanas.

### D2 — Qual é a lista inicial de motivos de remarcação?

**A contradição, literal.** `decisoes-joao-2026-09-15.md:18` registra a sua resposta como
*"siga com as sugestoes"*, e as sugestões daquele momento eram: **Loja não liberou acesso · Falta
de material · Equipe indisponível · Cliente pediu para mudar · Chuva/clima · Outro**. O
`mockup-j4-v02.html:473` mudou depois para a lista do Diário: **Clima · Cliente/loja ·
Disponibilidade de equipe · Contratação de prestador · Falta de material · Outro**, declarando a
troca na seção G. O briefing de hoje repete a lista do mockup.

**Recomendação: a lista do mockup**, com a grafia do código — `Clima`, `Cliente / loja`,
`Disponibilidade de equipe`, `Contratação de prestador`, `Falta de material`, `Outro`. O motivo é o
que a própria seção G diz: `BLOQUEIOS` (`app/obras/_lib/tipos.ts:187-195`) é o vocabulário que o
Diário já usa para responder por que a obra não andou no dia, e ter "Chuva/clima" ao lado de
"Clima" impediria cruzar o bloqueio do dia com o motivo da remarcação — que é a pergunta útil
("as obras que remarcam por clima são as mesmas que param por clima?").
**Atenção à grafia:** o mockup escreve `Cliente/loja` e o código escreve `Cliente / loja`. São a
mesma coisa e precisam ser **uma** string, senão o cruzamento não fecha. A spec usa a do código.
*Se o João preferir a lista de 15/09:* trocar os seis `insert` da §3.3. Nada mais muda.

### D3 — "Origem": o que ela significa e quais são as opções?

**O que está pendente.** A suposição 4 do mockup declara: *"'Origem' é por onde chegou a
autorização para executar (sistema do cliente, e-mail, telefone, WhatsApp, outro). As opções da
lista são provisórias"*, e marca como pendente *"o significado do campo, a lista de opções e o
lugar dele na ficha"*. O cliente pediu (feedback 14 A) que a origem ficasse no mesmo quadro da
autorização, o que confirma o **lugar**, mas não confirma as opções. No código, `origem` é texto
livre vindo da planilha (`importacao.ts:526`).

**Recomendação: seguir com as cinco opções provisórias** — `Sistema do cliente`, `E-mail do
cliente`, `Telefone`, `WhatsApp`, `Outro` — em `ORIGENS`, no bloco Autorização, com a salvaguarda
do risco 6 (valor antigo fora da lista é preservado). É reversível: mudar as opções é editar uma
constante. **Não** transformar `origem` em tabela agora — ela não tem o pedido de "cadastrar novo"
que os motivos têm, e tabela sem pedido é custo sem uso.

### D4 — O rodapé de autoria é por bloco ou um só para a ficha?

Depende de D1. Com a Opção 1, o mockup é atendido ao pé da letra: a última linha de
`obras_historico` por bloco. Com a Opção 2, o honesto é um rodapé só, "Última edição por X em
DD/MM", igual nos três blocos — porque não haveria como saber qual bloco foi editado.
**Recomendação: decidir D1, e este item se resolve sozinho.**

---

## 10. Ordem de execução sugerida

Não é plano de implementação (esse é outro documento), mas a ordem importa porque há dependência
entre as frentes e elas podem correr em paralelo se respeitarem o arquivo de cada uma.

| Ordem | Frente | Arquivos | Pode correr em paralelo com |
|---|---|---|---|
| 1 | Decidir **D1** | — | nada: tudo depende dela |
| 2 | Migration + verificação em produção | `sdd-sql-obras-motivos-remarcacao.sql` (+ aplicar o do histórico) | 3 e 4 |
| 3 | Funções puras e constantes | `_lib/ficha-campos.ts`, `_lib/tipos.ts`, `__tests__/ficha-campos.test.ts` | 2 e 4 |
| 4 | Diálogo genérico | `_ui/dialogo.tsx` | 2 e 3 |
| 5 | Server Actions | `obra/[id]/_actions.ts`, `__tests__/ficha-editavel.test.ts` | depende de 2 e 3 |
| 6 | Blocos editáveis e janela de remarcação | `obra/[id]/_bloco-*.tsx`, `_dialogo-remarcar.tsx` | depende de 4 e 5 |
| 7 | Ligação na ficha e na triagem | `obra/[id]/_ficha.tsx`, `_triagem.tsx`, `page.tsx` | depende de 6 |
| 8 | Testes de invariante da sincronização e da âncora | `sincronizar/__tests__/_sincronizacao.test.ts`, `__tests__/tipos.test.ts` | qualquer momento — **e quanto antes, melhor** |

Depois: `npm run lint`, `npm test`, `npm run build`, code review por quem não implementou, e só
então deploy — com a migration já aplicada e verificada.
