# Runbook — pôr o Controle de Obras no ar

Escrito em 08/09/2026, manhã do treinamento. Atualizado em **10/09/2026, à noite**, com o
que foi de fato executado.

> ## Estado em 10/09/2026
>
> | Passo | Estado |
> |---|---|
> | 1 — migration | ✅ **APLICADA E VERIFICADA em produção** (`iyytcavcgukfjnjjrerx`) |
> | 2 — push | ❌ bloqueado: `Mainsis` tem `push: false` no repositório |
> | 3 — deploy | ❌ pendente do passo 2. Build no ar ainda é de 26/08 |
> | 4 — importar planilha | ❌ pendente do passo 3 |
> | 5 — liberar acesso | ⚠️ pendente, e **AMANDA e YURI não têm conta no hub** — ver passo 6 |
> | 6 — amarrar e-mails | ⚠️ a lista deste runbook estava errada; corrigida abaixo |

**A ordem importa.** O passo 5 (liberar o acesso na tela) só funciona depois do passo 3
(deploy), porque o slug `obras` faltava em `lib/sistemas.ts` e a correção precisa estar
no ar. Há um plano B por SQL, no fim, se o deploy atrasar.

---

## Passo 0 — acesso do Claude ao banco: resolvido por token, não por OAuth

**O fluxo OAuth do MCP não funcionou em 10/09.** O caminho que funcionou, e que fica
valendo:

1. Gerar um Personal Access Token em https://supabase.com/dashboard/account/tokens.
2. Gravá-lo em `C:\Users\joao-\.supabase-pat` — **fora do repositório**, e por um
   PowerShell próprio, nunca pelo `!` do chat (o `!` traz o token para o contexto):
   `Set-Content -NoNewline -Path "$HOME\.supabase-pat" -Value 'sbp_...'`
3. O Claude executa SQL pela Management API, lendo o token do arquivo sem nunca vê-lo:
   `POST https://api.supabase.com/v1/projects/<ref>/database/query`, corpo `{"query": "..."}`.

Isso executa como o papel `postgres`, ou seja **acima da RLS** — o que é poder suficiente
para aplicar migration, conferir schema e rodar os passos 5 e 6, e poder suficiente para
estragar. Vale a mesma disciplina do SQL Editor: conferir o ref antes de escrever.

⚠️ **O auto mode barra escrita em produção** (`[Production Deploy]`) e push
(`[Sensitive-Source Provenance]`). Não é erro de token nem de rede: é uma trava que pede
autorização explícita do João, uma vez por ação.

---

## Passo 1 — rodar a migration ✅ FEITO EM 10/09/2026

> **Aplicada e verificada em 10/09/2026**, pela Management API, no projeto
> `iyytcavcgukfjnjjrerx`. Resultado conferido: 5 tabelas `obras_*` com RLS ligado, bucket
> `obras-fotos` criado, 5 policies `obras access` e **as 3 policies de storage** — ou
> seja, a seção 7 passou sem o erro de ownership que este runbook previa.
>
> A policy é `obras_has_access()` = `obras_is_admin()` **ou** linha em `hub_system_access`
> com `system_slug = 'obras'`. As duas funções usam `exists(...)`, então devolvem
> `true`/`false` e não caem na armadilha do NULL registrada no `AGENTS.md`.
> **Consequência prática:** administrador do hub abre `/obras` sem precisar de linha
> nenhuma em `hub_system_access`.
>
> **Foi o primeiro contato deste módulo com um Supabase real.** O texto abaixo fica como
> referência para reaplicar em outro ambiente.

**Antes de colar qualquer coisa, confirme o projeto.** O SQL Editor não pergunta duas
vezes. O ref tem que ser **`iyytcavcgukfjnjjrerx`** — ele aparece na URL do dashboard.

1. Supabase → SQL Editor → New query.
2. Cole o conteúdo inteiro de `sdd-sql-obras-v0.sql` (raiz do repositório).
3. Run.

O arquivo é idempotente por construção: se falhar no meio, dá para corrigir e rodar de
novo inteiro sem erro. Desde 08/09 ele roda dentro de `begin`/`commit`, então um erro no
meio **desfaz tudo** e deixa o banco intocado, em vez de metade aplicada.

**Se der `must be owner of table objects`:** é a seção 7, que cria as policies de storage
no schema `storage`, cujo dono é `supabase_storage_admin`. Há precedente de que funciona
neste projeto (o `sdd-sql-passo3.sql`, dos buckets do Sofia, faz o mesmo e está
aplicado), mas se acontecer, o contorno é criar as três policies pelo Dashboard →
Storage → `obras-fotos` → Policies, com as mesmas expressões do arquivo. Com a transação,
esse erro não deixa lixo: rode o resto de novo depois.

**Como verificar que funcionou** — cole isto numa query nova; tem que devolver 5 linhas
de tabela e 1 de bucket:

```sql
select table_name from information_schema.tables
 where table_schema = 'public' and table_name like 'obras_%'
union all
select 'BUCKET: ' || id from storage.buckets where id = 'obras-fotos';
```

O bucket `obras-fotos` **é criado pela própria migration** (seção 4 do arquivo), junto
com as policies de storage. Não é passo separado — o `ESTADO.md` dizia que era, e estava
errado.

---

## Passo 2 — push

O `master` local está **81 commits à frente** do `origin/master` (medido em 10/09). Nada
disso está no GitHub.

> ⚠️ **A causa está identificada, e a correção é de uma linha na tela do GitHub.**
> `gh api repos/manfac-facilities/login-system` devolve
> `{"admin": false, "maintain": false, "pull": true, "push": false, "triage": false}`
> para a conta `Mainsis`, que é a desta máquina. O token dela tem escopo `repo` — **o que
> falta é permissão no repositório, não credencial.** Enquanto isso não mudar, o push é
> manual e de outra conta.
>
> **A correção definitiva** (e já está no plano de acessos de 10/09): em
> https://github.com/manfac-facilities/login-system/settings/access, dar **Admin** à conta
> `Mainsis` — `Write` já basta para o push. É a mesma tela onde o Duda recebe `Write`.
> Feito isso, o Claude passa a pushar sozinho e este passo deixa de bloquear o deploy,
> como bloqueou em 07/09, 08/09 e 10/09.

Da sua conta:

```bash
git push origin master
```

**Verificar:** `git log origin/master --oneline -1` tem que mostrar o mesmo commit que
`git log master --oneline -1`.

---

## Passo 3 — deploy

EasyPanel → projeto `manfac` → app **`manfac-login-system`** → botão Deploy.

⚠️ **Não é o `manfac-site`.** Os dois vivem no mesmo projeto e a confusão entre eles já
custou uma investigação inteira em 09/08.

**Verificar (não confie no painel nem em "já cliquei"):**

```bash
curl -sI https://hub.manfac.com.br/_next/static/chunks/webpack-*.js | grep -i last-modified
```

Todos os chunks têm que ter o mesmo timestamp, e posterior ao push. Timestamps
misturados = cache velho junto com build novo. O Claude confere isso para você se pedir.

---

## Passo 4 — importar a planilha

Entre em `https://hub.manfac.com.br/obras/importar` e suba a planilha
`DPSP_Rev.02`. A tela devolve um relatório do que entrou e do que ficou de fora — **leia
esse relatório**, ele é o primeiro contato do parser com dados reais.

Reimportar é seguro para o que foi digitado no diário: desde o commit `3bfc6b3`, campo
vazio da planilha não sobrescreve o que está no app, e `etapa` e `mau uso` nunca são
reescritos.

⚠️ **Duas ressalvas que a revisão de hoje levantou:**

- **Reimportar sobrescreve `pcm`, `equipe`, `prioridade`, início planejado e duração** se
  a planilha trouxer valor para eles — que são justamente os cinco campos gravados pela
  Triagem. Se alguém triar uma obra no treinamento e você reimportar depois, a triagem
  daquela obra volta ao que diz a planilha.
- **Se a PRIMEIRA importação falhar no meio, limpe antes de repetir.** A obra "GARANTIA"
  (a que não tem nº de OS) só é aceita quando a base está vazia; numa segunda tentativa
  sobre base já parcialmente cheia ela é descartada em silêncio, virando só uma linha no
  relatório de descartadas. Antes de repetir, e **só enquanto ninguém tiver respondido
  diário**:

  ```sql
  delete from public.obras_obra;   -- a cascata leva diário, tarefa e remarcação
  ```

---

## Passo 5 — liberar o acesso de quem vai ao treinamento

`https://hub.manfac.com.br/admin/acessos` → ligue a chave **Controle de Obras** para cada
pessoa.

Essa coluna **só existe depois do deploy do passo 3**. Sem a linha em
`hub_system_access`, a pessoa não entra em `/obras` e nem vê o card no dashboard.
Administrador do hub passa sempre, então a sua conta já enxerga.

---

## Passo 6 — ligar cada conta do hub à pessoa da planilha

Este é o passo que, se ficar de fora, faz **cada analista ver o diário VAZIO no
treinamento**. A planilha diz `YURI`; quem entra no hub entra por e-mail. O que costura os
dois é a coluna `email` de `obras_pessoa`.

**Atenção ao modo de falhar:** sem o e-mail cadastrado, o sistema tenta adivinhar a chave
pelo primeiro pedaço do e-mail em maiúsculas (`amanda.ribeiro@` → `AMANDA`). Quando a
adivinhação erra, a pessoa não vê uma lista vazia — vê **"sem permissão"**. É a falha mais
visível possível numa sala de treinamento, e some com este passo.

> ⚠️ **A lista deste passo estava errada até 10/09.** Ela mandava amarrar `ROBERTA`, que
> **não aparece uma única vez na planilha**, e não citava `GABRIEL` nem `EDUARDO`, que
> aparecem. Conferido em 10/09 cruzando o dump da planilha com `auth.users`:

| Chave na planilha | Obras | Conta no hub |
|---|---|---|
| `AMANDA` | 64 | ❌ **não existe** — precisa ser convidada |
| `YURI` | 15 | ❌ **não existe** — precisa ser convidada |
| `LUANA` | 2 | ✅ `luana.silva@manfac.com.br` |
| `GABRIEL` | 1 | ✅ `gabriel.vidal@manfac.com.br` |
| `EDUARDO` | 1 | ✅ `eduardo.maia@manfac.com.br` |

**As duas analistas que concentram 79 das 82 obras não têm login no hub.** Não há como
liberar acesso nem amarrar e-mail para quem não tem conta: convidar as duas é
pré-requisito do passo 5, não um detalhe deste passo.

No SQL Editor. Primeiro confira quais contas existem, para não chutar:

```sql
select email from auth.users where email ilike '%manfac.com.br' order by email;
```

Depois amarre cada uma, **tudo em minúsculas**:

```sql
update public.obras_pessoa set email = 'yuri.xxx@manfac.com.br'      where chave = 'YURI';
update public.obras_pessoa set email = 'amanda.xxx@manfac.com.br'    where chave = 'AMANDA';
update public.obras_pessoa set email = 'luana.silva@manfac.com.br'   where chave = 'LUANA';
update public.obras_pessoa set email = 'gabriel.vidal@manfac.com.br' where chave = 'GABRIEL';
update public.obras_pessoa set email = 'eduardo.maia@manfac.com.br'  where chave = 'EDUARDO';
```

**Verificar — esta consulta é a prova de que ninguém vai abrir o Diário no vazio.** Ela
mostra, por pessoa, quantas obras vão cair na fila dela:

```sql
select p.chave, p.email, count(o.id) as obras_em_campo
from public.obras_pessoa p
left join public.obras_obra o
  on o.pcm = p.chave
 and o.etapa in ('levantamento','andamento','paralisado')
group by p.chave, p.email
order by p.chave;
```

Ninguém que vá usar a tela pode ficar com `email` nulo. E se alguém que vai mexer na tela
aparecer com `obras_em_campo = 0`, o Diário dessa pessoa vai abrir em "sem permissão" —
resolva antes. Pela planilha atual (contagem de 10/09), o esperado é **AMANDA com 64**,
**YURI com 15**, **LUANA com 2**, e GABRIEL e EDUARDO com 1 cada.

As equipes de campo (MANFAC-7, ALEX, ...) entram sozinhas pela importação do passo 4;
não precisam de e-mail.

---

## Plano B — liberar acesso sem esperar o deploy

Se o deploy atrasar e o treinamento estiver em cima da hora, dá para criar as linhas de
acesso direto no banco. Funciona porque o middleware lê `hub_system_access`, não a lista
do código — o que falta sem o deploy é só a **tela** de administração.

```sql
insert into public.hub_system_access (user_email, system_slug, has_access, granted_by)
values
  ('fulano@manfac.com.br', 'obras', true, 'jose.guilherme@manfac.com.br'),
  ('sicrano@manfac.com.br', 'obras', true, 'jose.guilherme@manfac.com.br')
on conflict (user_email, system_slug) do update set has_access = excluded.has_access;
```

⚠️ Isso **não** dispensa o deploy: sem ele, o código do módulo `/obras` não está no ar de
jeito nenhum. O plano B só cobre o caso de o deploy ter subido mas você não conseguir
mexer na tela.

---

## O que NÃO vai estar pronto no treinamento — avise a equipe

- **Toda obra entra pela planilha nesta versão.** A entrada pela API do Field Control é a
  próxima frente (o cliente confirmou em 08/09 que a obra vem sempre do Field, e a chave
  da API já existe). Não há, nem vai haver, tela de criar obra do zero.
- **"Relatório de entrega" não é deduzido do Field automaticamente**, embora o texto da
  ficha prometa isso. No treinamento, essa etapa é movida à mão. O manual já avisa; o
  texto da tela é que continua prometendo — corrigir na v1.
- A **pergunta 03 do cliente** ("como calcula esse avanço %?") segue sem resposta desde
  31/08. O texto pronto está no fim de `pergunta-03-como-calcula-o-avanco.md`.
