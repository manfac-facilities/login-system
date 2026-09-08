# Review de `sdd-sql-obras-v0.sql` — antes do Run em produção

Revisado em 08/09/2026. Alvo: projeto `iyytcavcgukfjnjjrerx`, SQL Editor, à mão.
Arquivo revisado: `C:\Users\joao-\projeto-01-elite-da-ia\sdd-sql-obras-v0.sql` (406 linhas).
Código conferido: tudo em `C:\Users\joao-\projeto-01-elite-da-ia\app\obras\` + `lib/auth/*`, `lib/sistemas.ts`, `middleware.ts`.

---

## VEREDITO

**Pode rodar como está** — não achei nada no SQL que faça o Run falhar ou quebrar tela; **0 bloqueadores no arquivo**, mas **2 passos manuais obrigatórios depois dele** (sem os quais o Diário abre vazio no treinamento) e 1 ajuste barato que eu faria antes de apertar Run (envelopar em `begin/commit`).

---

## BLOQUEADORES

Nenhum bloqueador **dentro do arquivo SQL**. Os dois itens abaixo não impedem a migration de rodar, mas **quebram a tela principal do treinamento** se ninguém executá-los depois — então estão aqui, não em avisos.

### B1. Ninguém tem acesso ao slug `obras` — a rota devolve tela de "sem permissão" para todo mundo que não é admin

- **O que é:** a migration não cria nenhuma linha em `hub_system_access` com `system_slug = 'obras'`. Ela mesma avisa disso em `sdd-sql-obras-v0.sql:398-405`, mas o passo é fácil de esquecer no dia.
- **Onde bate:**
  - `app/obras/base/page.tsx:28` → `hasSystemAccess(supabase, user.email, 'obras')` falso ⇒ `EstadoVazio` "Esta tela é de quem é responsável pelas obras".
  - `app/obras/diario/page.tsx:46-47` → mesma coisa, `<SemPermissao />`.
  - `middleware.ts:132` já protege `/obras/:path*`, então o bloqueio acontece antes mesmo da página.
  - `app/(dashboard)/dashboard/page.tsx:28` → sem a linha, o card "Controle de Obras" não aparece no hub.
  - Do lado do banco, a policy `obras access` chama `public.obras_has_access()` (`sdd-sql-obras-v0.sql:306-321`), que devolve `false` ⇒ mesmo furando a UI, o `select` volta 0 linhas.
- **Por que não é automático:** `system_slug` é string livre (`sdd-sql-conversor-os.sql:24-32`), não há catálogo no banco. O slug `obras` **já existe** no catálogo do app (`lib/sistemas.ts:13`), então a tela `/admin/acessos` consegue conceder — é só clicar. Confirmado.
- **SQL corrigido exato** (alternativa a clicar em `/admin/acessos`, se quiser deixar pronto junto com a migration — trocar os e-mails pelos reais):

```sql
insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
values
  ('yuri.nascimento@manfac.com.br', 'obras', true, 'migracao-obras-v0'),
  ('amanda.ribeiro@manfac.com.br',  'obras', true, 'migracao-obras-v0'),
  ('luana.prado@manfac.com.br',     'obras', true, 'migracao-obras-v0'),
  ('roberta.lima@manfac.com.br',    'obras', true, 'migracao-obras-v0')
on conflict (user_email, system_slug) do update set has_access = true;
```

(`hub_system_access` tem `UNIQUE (user_email, system_slug)` — `sdd-sql-conversor-os.sql:31` — então o `on conflict` acima é o certo. `granted_by` é `not null`.)

### B2. `obras_pessoa.email` nasce NULL — se o e-mail de alguém fugir do padrão, essa pessoa vê o Diário VAZIO

- **O que é:** o seed de `obras_pessoa` (`sdd-sql-obras-v0.sql:390-395`) grava `chave, nome, iniciais, area, funcao, fone` e **não grava `email`**. A coluna existe (`:196`, `:200`) e tem índice único sobre `lower(email)` (`:201-202`), mas fica vazia.
- **Por que quebra:** `app/obras/diario/_pessoa.ts:54-63` tenta `obras_pessoa.email = <e-mail em minúsculas>`; sem linha, cai na **convenção** `chaveDoUsuario()` (`_pessoa.ts:67-76`): primeiro pedaço do local-part, sem acento, maiúsculas. Aí:
  - `app/obras/diario/page.tsx:58` → `if (!admin && !minhaChave) return <SemPermissao />`
  - `app/obras/diario/page.tsx:60-62` → `consulta.eq('pcm', filtroPcm)`
  - `app/obras/diario/page.tsx:71` → `if (!admin && ids.length === 0) return <SemPermissao />`
  Ou seja: chave que não casa com nenhum `pcm` ⇒ **tela de "sem permissão", não lista vazia**. É a falha mais visível possível numa sala de treinamento.
- **O que eu consegui verificar:** os valores reais de `pcm` na planilha são **maiúsculos e batem com as chaves semeadas** — em `docs/cliente/2026-08-31-sistema-controle-de-obras/planilha-dpsp-rev02-dump.txt` aparecem `AMANDA` (64×), `YURI` (15×), `LUANA` (2×), nenhuma variante em minúsculas. E o importador **não** normaliza `pcm` (`app/obras/_lib/importacao.ts:530` → `pcm: paraTexto(...)`, que só faz `trim`), então o que está na planilha é o que vai para o banco. Logo a convenção funciona **se e somente se** os e-mails forem `yuri.*@`, `amanda.*@`, `luana.*@`, `roberta.*@`.
- **O que eu NÃO consegui verificar:** os e-mails reais das contas no Supabase Auth — não tenho acesso ao banco nesta sessão. É exatamente o dado que fecha o risco.
- **SQL corrigido exato** (rodar depois da migration, com os e-mails reais conferidos em `auth.users`; **tudo em minúsculas**, como manda o comentário `:193-195`):

```sql
-- 1) Confira quais contas existem, para não chutar:
select email from auth.users where email ilike '%manfac.com.br' order by email;

-- 2) Amarre a conta do hub à pessoa da planilha:
update public.obras_pessoa set email = 'roberta.lima@manfac.com.br'    where chave = 'ROBERTA';
update public.obras_pessoa set email = 'yuri.nascimento@manfac.com.br' where chave = 'YURI';
update public.obras_pessoa set email = 'amanda.ribeiro@manfac.com.br'  where chave = 'AMANDA';
update public.obras_pessoa set email = 'luana.prado@manfac.com.br'     where chave = 'LUANA';

-- 3) Prova de que a fila de cada um não vai estar vazia:
select p.chave, p.email, count(o.id) as obras_em_campo
from public.obras_pessoa p
left join public.obras_obra o
  on o.pcm = p.chave
 and o.etapa in ('levantamento','andamento','paralisado')
group by p.chave, p.email
order by p.chave;
```

Se a linha 3 devolver `0` para alguém que vai mexer na tela no treinamento, o Diário dessa pessoa vai abrir em "sem permissão".

---

## AVISOS

### A1. Falta `begin;` / `commit;` — recomendo envelopar

O arquivo **não tem** transação explícita. Na prática o SQL Editor manda o script inteiro num único batch de simple query, e o Postgres executa batch assim numa transação implícita (falhou no meio, desfaz tudo) — mas isso é comportamento do cliente, não garantia do arquivo, e a aposta é ruim horas antes de um treinamento. Custo de blindar: duas linhas.

```sql
begin;
-- ... o arquivo inteiro, das seções 1 a 8 ...
commit;
```

Não há nada no arquivo que impeça rodar dentro de transação — `insert into storage.buckets`, `create policy` e `alter table ... enable row level security` são todos transacionais no Postgres.

### A2. `create policy ... on storage.objects` pode dar "must be owner of table objects"

Seções 7 (`:368-381`) e o insert do bucket (`:274-276`) mexem no schema `storage`, cujo dono é `supabase_storage_admin`, não `postgres`. **Há precedente de que funciona neste projeto**: `sdd-sql-passo3.sql:1-7` faz exatamente isso (buckets `checklist-fotos` / `sofia-anexos` + policies) e está aplicado. Se mesmo assim der erro de dono, o contorno é criar as três policies pelo Dashboard → Storage → `obras-fotos` → Policies, com as mesmas expressões. Com `begin/commit` (A1), esse erro derruba o script inteiro e não deixa estado parcial — outro motivo para envelopar.

### A3. Não existe policy de DELETE em `storage.objects` para `obras-fotos`

São criadas insert / select / update (`:369`, `:373`, `:379`), mas nenhuma delete. Consequência real: `desfazerDiarioAction` (`app/obras/diario/_actions.ts:225`) apaga a linha de `obras_diario` e **deixa o arquivo órfão no bucket** — ninguém, nem o app, consegue removê-lo pelo client. Não quebra nada na v0 (o caminho é determinístico `{obra_id}/{data}.jpg`, então reenviar sobrescreve via `upsert`), mas é lixo que só cresce. Adicionar depois, não agora.

### A4. Se a PRIMEIRA importação falhar no meio, a obra "GARANTIA" (sem OS) se perde para sempre

`app/obras/importar/_actions.ts:129` calcula `baseVazia = idPorOs.size === 0` e `:160-167` só aceita obra sem `Nº OS` quando a base está vazia. O insert é em lotes de 100 e **retorna no primeiro erro** (`:175-180`), deixando o que já entrou. Numa segunda tentativa a base não está mais vazia ⇒ a linha sem OS é descartada em silêncio (vira só um item no relatório de descartadas).
**Se a primeira importação der erro, limpe antes de repetir:**

```sql
delete from public.obras_obra;   -- cascata leva diario/tarefa/remarcacao
```

(Só vale enquanto ninguém tiver respondido diário — depois disso, apagar é perder trabalho.)

### A5. `create table if not exists` não altera tabela existente — e o arquivo já convive com isso

Documentado no próprio cabeçalho (`:13-17`) e tratado com `alter table ... add column if not exists` para `etapa_por`, `etapa_em` (`:123-124`) e `email` (`:200`). Está correto hoje. **Regra para o futuro:** qualquer coluna nova entra como `alter table ... add column if not exists` no fim do arquivo, nunca editando o `create table` lá em cima — editar o `create table` é uma mudança silenciosamente ignorada em qualquer banco que já tenha rodado a v0.

### A6. Reimportar sobrescreve `pcm` e `equipe` com o que estiver na planilha

`camposParaAtualizar` (`app/obras/_lib/importacao.ts:680-690`) protege só `etapa` e `mau_uso`. `pcm`, `equipe`, `prioridade`, `inicio_plan` e `duracao` — os cinco campos que a Triagem grava (`app/obras/obra/[id]/_actions.ts:143-158`) — **são sobrescritos** por uma reimportação, se a planilha trouxer valor não-nulo para eles. Não é bug de schema, é comportamento; só vale avisar quem for reimportar durante o treinamento.

### A7. `obras_tarefa.aberta` tem `default current_date`, que é o dia em UTC

`sdd-sql-obras-v0.sql:158`. O app **sempre** passa `aberta` explicitamente com `hojeISO()` em `America/Sao_Paulo` (`app/obras/diario/_actions.ts:186`), então o default nunca é usado pelo caminho normal. Só morde se alguém inserir tarefa à mão pelo SQL Editor depois das 21h — aí a tarefa nasce com o dia seguinte e o `.eq('aberta', dia)` de `diario/page.tsx:99` não a encontra.

### A8. Obras vindas só da aba Pipeline nascem com `bloqueio` NULL, não `'Sem bloqueio'`

O default da coluna (`:76`) não se aplica porque o importador manda `bloqueio: null` explícito (`app/obras/_lib/importacao.ts:434`). **Conferi que isso não quebra nada:** `base/_table.tsx:44`, `obra/[id]/_ficha.tsx:565` e `travado()` em `_lib/tipos.ts:439-448` tratam NULL como "sem bloqueio" de propósito, com comentário explicando. Fica registrado só para não parecer bug depois.

---

## CONFERIDO E OK

### As duas armadilhas do AGENTS.md — procurei uma por uma

- **Armadilha (a): trigger compartilhada entre tabelas de colunas diferentes (`42703 record "new" has no field`).**
  Procurei em **todas** as functions e triggers do arquivo — só existe uma de cada: `public.obras_touch_updated_at()` (`:251-260`) e `obras_obra_touch_updated_at` (`:262-265`). A função **não testa `TG_TABLE_NAME`** e a trigger está presa a **uma tabela só** (`obras_obra`, a única com `updated_at`). Corpo é `new.updated_at := now(); return new;`. A armadilha foi evitada por construção, não por sorte. `grep` por `TG_TABLE_NAME` no arquivo: zero ocorrências.

- **Armadilha (b): guarda de autorização que falha ABERTA com NULL.**
  As duas funções de autorização são `public.obras_is_admin()` (`:292-304`) e `public.obras_has_access()` (`:306-321`). Ambas usam **`exists(...)`**, que devolve `true`/`false` e nunca NULL — inclusive quando `auth.jwt()` é NULL (aí `lower(trim(NULL))` é NULL, `user_email = NULL` é NULL, e `exists` sobre zero linhas é `false`). Não há nenhum `in (lista)` sem `coalesce` no arquivo. `obras_has_access()` é `obras_is_admin() or exists(...)` — `false or false = false`, nunca NULL. Guarda falha **fechada**. Confirmado.
  Nota complementar pedida: **nenhuma trigger `security definer` foi criada**, então o problema do AGENTS.md de "trigger trava edição manual pelo SQL Editor / MCP porque `auth.jwt()` é NULL" **não se aplica aqui**. Dá para semear e corrigir dados à mão sem `disable trigger`. As duas functions `security definer` só são chamadas de dentro de policies, e `postgres`/`service_role` têm BYPASSRLS, então o SQL Editor nunca as avalia.

### Idempotência — rodar duas vezes é seguro

Passei item por item: `create table if not exists` (5×), `alter table ... add column if not exists` (3×), `create index if not exists` / `create unique index if not exists` (8×), `create or replace function` (3×), `drop policy if exists` antes de cada `create policy` (8×), `alter table ... enable row level security` (idempotente por natureza), `insert into storage.buckets ... on conflict (id) do nothing`, seed com `on conflict (chave) do nothing`. `revoke`/`grant` são idempotentes. **Não achei um único comando que estoure na segunda execução.** A única limitação é a de A5, que o arquivo já documenta.

### Divergência schema × código — não achei nenhuma

Conferi coluna a coluna os dois lados. Todos os `select` com colunas nomeadas, `insert` e `update` do módulo:

| Onde (código) | Colunas | Existem na migration? |
|---|---|---|
| `app/obras/_lib/tipos.ts:209-255` (`ObraRow`) | 40 colunas | ✅ todas, e com os tipos certos (`:49-119`) |
| `_lib/tipos.ts:259-269` (`DiarioRow`) | 10 | ✅ (`:129-145`) |
| `_lib/tipos.ts:273-286` (`TarefaRow`) | 12 | ✅ (`:153-168`) |
| `_lib/tipos.ts:290-297` (`PessoaRow`) | 7 | ✅ (`:175-198`) — a migration tem `email` a mais, que o tipo não declara; inofensivo |
| `_lib/tipos.ts:301-308` (`RemarcacaoRow`) | 7 | ✅ (`:207-215`) |
| `diario/_actions.ts:92-104` upsert diário | `obra_id, data, andou, motivo, item, obs, foto_path, registrado_por` | ✅ |
| `diario/_actions.ts:182-197` insert tarefa | `obra_id, item, dono, aberta, hora_aberta, prazo, registrou, situacao, resumo` | ✅ |
| `diario/_actions.ts:288-291` update contadores | `nao_andou_seguidos, bloqueada_dias, bloqueio` | ✅ |
| `obra/[id]/_actions.ts:81` update etapa | `etapa, desde_etapa, atualizacao, etapa_por, etapa_em` | ✅ — `etapa_por`/`etapa_em` entram por `:117-118` e `:123-124`. O fallback `colunaInexistente()` de `_actions.ts:44-48` vira código morto depois desta migration, o que é o desejado |
| `obra/[id]/_actions.ts:143-158` liberar obra | `pcm, equipe, prioridade, inicio_plan, duracao, liberado_por, liberado_em, etapa, desde_etapa, atualizacao, pendencia, pend_resp, prox_acao` | ✅ |
| `tarefas/_actions.ts:42-47` responder | `situacao, resposta_em, resposta_hora, resumo` | ✅ |
| `importar/_actions.ts` (via `ObraCampos`, `_lib/importacao.ts:375-399`) | 23 colunas | ✅ todas |
| `diario/_pessoa.ts:54-58` | `obras_pessoa.chave` filtrado por `email` | ✅ coluna criada em `:196`/`:200` |

Também conferi os `select` de colunas nomeadas espalhados: `diario/page.tsx:78,93,98,135`, `obra/[id]/page.tsx:104`, `tarefas/page.tsx:55,68`, `importar/_actions.ts:116`, `diario/_actions.ts:81,159,281` — todas as colunas citadas existem.

### `check` constraints × valores que o código grava

- `etapa` (`:74-75`, 9 valores) bate **exatamente** com `type Etapa` (`_lib/tipos.ts:114-123`) e com as chaves de `CICLO` (`:145-155`). `mudarEtapaAction` valida contra `CICLO` antes de gravar (`obra/[id]/_actions.ts:25,68`); o importador só produz valores desse conjunto (`etapaDeStatusManfac` cai em `'definir'` no default, `etapaDePlanejamento` devolve `null` ⇒ vira `'definir'`).
- `prioridade` (`:80`) bate com `PRIORIDADES` (`_lib/tipos.ts:193`); `normalizarPrioridade` (`_lib/importacao.ts:194-198`) só devolve `'Normal'`, `'Urgente'` ou `null`; `liberarObraAction` revalida (`obra/[id]/_actions.ts:135`).
- `situacao` (`:162-163`) bate com `SITUACOES_TAREFA` — "vencida" nunca é gravada, é derivada em `sitTarefa()`.
- `area` (`:179`) bate com `AREAS` (`_lib/tipos.ts:198`) e com o seed.
- `obras_diario_motivo_quando_nao_andou` (`:143-144`): `andou boolean not null`, então não há caminho NULL; `salvarDiarioAction:74-77` já barra antes, com o mesmo critério.
- **Nenhum caminho de gravação consegue violar um check.** (Importante porque um check violado num lote de 100 mataria a importação inteira em `importar/_actions.ts:178`.)

### RLS — o padrão bate com o resto do hub

- As functions leem **as mesmas tabelas e do mesmo jeito que o app**: `hub_user_roles(user_email, nivel)` e `hub_system_access(user_email, system_slug, has_access)`, nomes conferidos contra `sdd-sql-admin-usuarios.sql:17-24` e `sdd-sql-conversor-os.sql:24-32`. ✅
- A normalização é idêntica dos dois lados: `lower(trim(...))` no SQL (`:301`, `:317`) vs. `normalizarEmail` (`lib/auth/roles.ts:7-9`) e `email.trim().toLowerCase()` (`lib/auth/systemAccess.ts:15`). Sem risco de "admin no app, não-admin no banco". ✅
- Admin passa sempre, nos dois lados: `obras_has_access()` começa com `obras_is_admin()` (`:314`), igual a `hasSystemAccess` (`lib/auth/systemAccess.ts:10`). ✅
- Policies `for all to authenticated` com `using` **e** `with check` nas 5 tabelas (`:335-358`) — necessário porque a importação e o diário escrevem com o **client do usuário**, não com service role. Não é restritiva demais (tela vazia) nem `using(true)` (o furo do conversor-os). ✅
- As functions usadas nas policies **são criadas no próprio arquivo**, antes das policies (`obras_is_admin` em `:292` vem antes de `obras_has_access` em `:306`, que vem antes das policies em `:335`) — ordem correta, nada depende de objeto pré-existente além das duas tabelas do hub, que já estão em produção. ✅
- `grant execute ... to authenticated` (`:325-326`) está presente — sem ele as policies dariam "permission denied for function". ✅
- `middleware.ts:132` já tem `/obras/:path*` no matcher. ✅

### Dependências externas

- **Tabelas do hub** `hub_user_roles` e `hub_system_access`: **já existem em produção** (AGENTS.md, aplicadas em 2026-08-07 e 2026-08-10). A migration as consome, não as cria — correto.
- **`auth.users`**: referenciada por FK em `obras_obra.criado_por` (`:108`) e `obras_diario.registrado_por` (`:140`). Precedente aplicado: `sdd-sql-passo1.sql:71`. ✅
- **`gen_random_uuid()`**: nativa no Postgres 17 (o projeto é PG17), sem precisar de `pgcrypto`. ✅
- **Bucket `obras-fotos`**: **é criado pela própria migration** (`:274-276`), não é passo manual. As policies de storage necessárias também estão no arquivo (§7, `:368-381`) — insert, select e update, esta última porque o upload é `upsert: true` em caminho determinístico (`diario/_foto.tsx:75-80`). Ler exige signed URL, gerada em server action (`diario/_actions.ts:257`) e na ficha (`obra/[id]/page.tsx:133-137`), ambas cobertas pela policy de select. ✅ (ver A2 e A3 para as ressalvas)
- **Nenhuma extensão** é exigida além do que já vem no Supabase.

### Outros

- Índices (`:224-244`) cobrem as consultas reais: `pcm` e `etapa` (`diario/page.tsx:62-63`), `obra_id` em tarefa e remarcação, `data` no diário. O unique parcial `obras_obra_os_uniq` sobre `(os) where os is not null` está certo para a idempotência por OS, e o parcial é necessário porque a obra "GARANTIA" fica com `os = null` (`normalizarOs`, `_lib/importacao.ts:165-170`). ✅
- `unique (obra_id, data)` em `obras_diario` (`:142`) é exatamente o que o `onConflict: 'obra_id,data'` do PostgREST precisa (`diario/_actions.ts:103`). ✅
- Slug `obras` já está no catálogo do app (`lib/sistemas.ts:13`), então `/admin/acessos` consegue conceder sem deploy. ✅
- Seed de `obras_pessoa` (`:390-395`) usa chaves maiúsculas que batem com os valores de `pcm` da planilha real. ✅ (ver B2 para a parte que falta)

### O que eu NÃO consegui verificar

1. **Nada foi executado contra banco.** Não tenho conexão com o `iyytcavcgukfjnjjrerx` nesta sessão (o MCP do Supabase está listado mas não autenticado). Toda a revisão é leitura de SQL e de código — e o próprio AGENTS.md avisa que "SQL só é verificado de verdade rodando".
2. **Os e-mails reais das contas** em `auth.users` — é o dado que fecha o risco B2.
3. **Se `postgres` ainda consegue criar policy em `storage.objects`** neste projeto hoje (A2). O precedente do `sdd-sql-passo3.sql` é forte, mas é de outra data.
4. **Se o SQL Editor de hoje envolve o batch numa transação implícita** (A1). Por isso a recomendação é envelopar à mão em vez de confiar.
