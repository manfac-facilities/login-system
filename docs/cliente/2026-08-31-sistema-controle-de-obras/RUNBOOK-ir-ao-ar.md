# Runbook — pôr o Controle de Obras no ar

Escrito em 08/09/2026, manhã do treinamento. **Todos os passos abaixo são do João** —
nenhum o Claude consegue fazer sozinho: o MCP do Supabase pede autorização OAuth e a
conta de GitHub desta máquina (`Mainsis`) não tem permissão de push.

**A ordem importa.** O passo 5 (liberar o acesso na tela) só funciona depois do passo 3
(deploy), porque o slug `obras` faltava em `lib/sistemas.ts` e a correção precisa estar
no ar. Há um plano B por SQL, no fim, se o deploy atrasar.

---

## Passo 0 — autorizar o MCP do Supabase (opcional, mas economiza o passo 1)

Se você abrir a URL de autorização que está no chat e concluir o fluxo, o Claude aplica a
migration por você e confere o resultado. Sem isso, o passo 1 é manual.

---

## Passo 1 — rodar a migration

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

O `master` local está **72 commits à frente** do `origin/master`. Nada disso está no
GitHub. Da sua conta:

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

No SQL Editor. Primeiro confira quais contas existem, para não chutar:

```sql
select email from auth.users where email ilike '%manfac.com.br' order by email;
```

Depois amarre cada uma, **tudo em minúsculas**:

```sql
update public.obras_pessoa set email = 'yuri.xxx@manfac.com.br'    where chave = 'YURI';
update public.obras_pessoa set email = 'amanda.xxx@manfac.com.br'  where chave = 'AMANDA';
update public.obras_pessoa set email = 'luana.xxx@manfac.com.br'   where chave = 'LUANA';
update public.obras_pessoa set email = 'roberta.xxx@manfac.com.br' where chave = 'ROBERTA';
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

Nenhuma das quatro pode ficar com `email` nulo. E se alguém que vai mexer na tela no
treinamento aparecer com `obras_em_campo = 0`, o Diário dessa pessoa vai abrir em "sem
permissão" — resolva antes da sala. Pela planilha atual, o esperado é AMANDA com o maior
volume, YURI em seguida e LUANA com poucas.

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

- **Cadastro manual de obra não existe.** Toda obra entra pela planilha. Está no escopo
  declarado da v0, mas não foi construído: não há mockup aprovado dessa tela, e desenhar
  tela nova sem mockup quebra o processo combinado. Decisão sua se entra na v1.
- **"Relatório de entrega" não é deduzido do Field automaticamente**, embora o texto da
  ficha prometa isso. No treinamento, essa etapa é movida à mão. O manual já avisa; o
  texto da tela é que continua prometendo — corrigir na v1.
- A **pergunta 03 do cliente** ("como calcula esse avanço %?") segue sem resposta desde
  31/08. O texto pronto está no fim de `pergunta-03-como-calcula-o-avanco.md`.
