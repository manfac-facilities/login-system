---
paths:
  - "*.sql"
  - "**/*.sql"
---

# Regras para SQL e migrations

## Não existe CLI de migration. É tudo manual.

Cada mudança de schema vira um arquivo `sdd-sql-*.sql` na raiz que **alguém roda à mão**.
Consequência que já mordeu de verdade: **código mergeado ≠ schema aplicado.** Antes de concluir
que um bug é de código, verifique se o SQL correspondente rodou em produção.

Em 2026-08-09 o `master` tinha um mês de código não deployado dependendo de dois SQLs que
ninguém havia rodado. Subir naquele estado quebraria a criação de checklist e a tela de veículos.

**Antes de qualquer deploy, confira coluna por coluna no banco.** O arquivo estar no repositório
não significa absolutamente nada.

## Como aplicar

Projeto de produção: **`iyytcavcgukfjnjjrerx`**. **Confirme o ref antes de escrever** — há mais de
um projeto visível na conta.

Caminho que funciona (Personal Access Token + Management API), sem o Claude ver o valor:

```bash
TOKEN=$(tr -d '\r\n' < /c/Users/joao-/.supabase-pat)
curl -s -X POST "https://api.supabase.com/v1/projects/iyytcavcgukfjnjjrerx/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select 1"}'
```

Isso roda como `postgres` — **acima da RLS**. Poder de aplicar migration e de estragar.

O PAT é gerado pelo João em Dashboard → Account → Access Tokens e gravado em
`C:\Users\joao-\.supabase-pat` por um PowerShell dele. **Nunca pelo `!` do chat**, que traz o
valor para o contexto. Ele expira: `401` significa token vencido, não código errado.

> ⚠️ **O `Set-Content` com argumentos invertidos cria um arquivo cujo NOME é o token.** Aconteceu
> duas vezes em 20/09/2026. Se acontecer, o token tem que ser revogado — o valor vaza para
> qualquer listagem de diretório. Use `-Path` e `-Value` nomeados, ou o script que pede o valor
> por `Read-Host`.

## Escreva a migration para ser conferível

Todo `sdd-sql-*.sql` deste projeto segue o padrão, e SQL novo deve seguir também:

1. `begin;` … `commit;` — nada pela metade.
2. Uma **seção 0** que aborta a transação se um pré-requisito não estiver aplicado.
3. Um **bloco de verificação depois do commit**, que devolve uma linha por invariante com `OK` ou
   `*** FALHOU ***`. É isso que torna a aplicação auditável: a de motivos de remarcação devolve
   18 linhas, e qualquer `FALHOU` é motivo para parar e não deployar.

Escrever a verificação custa 20 minutos e é o que permite aplicar em produção sem medo.

## Duas armadilhas de PL/pgSQL que já morderam aqui

### 1. Guarda de autorização falha ABERTO com NULL

```sql
if not minha_funcao() then raise exception '...'; end if;
```

**Não dispara** se a função devolver `NULL` — `NULL in (...)` é `NULL`, e `not NULL` é `NULL`.
A RLS não expõe isso porque policy trata `NULL` como negado; a guarda imperativa, não.

Toda função de autorização daqui tem que devolver `true`/`false`. `exists(...)` já garante;
`in (lista)` precisa de `coalesce(..., false)`. Onde a comparação for explícita, use
`is not true` em vez de `not`.

### 2. Trigger compartilhada por tabelas de colunas diferentes

```sql
if TG_TABLE_NAME = 'equipes' and new.ativo is distinct from old.ativo then
```

Isso é **uma** expressão SQL: `new.ativo` é resolvido contra o registro real quando ela executa, e
o `and` **não protege**. Numa tabela sem a coluna, levanta `42703 record "new" has no field`.

O teste de tabela tem que ser um `if` **externo**, com o campo aninhado dentro.

> Esse bug passou por dois code reviews e um `/security-review` sem ser visto, e só apareceu na
> primeira escrita real. **SQL só é verificado de verdade rodando.**

## Os triggers do Sofia bloqueiam até a service role

Os `trg_bloquear_*` são `security definer` e disparam para **qualquer** role, inclusive
`postgres` e `service_role`. Pelo SQL Editor ou pela Management API, `auth.jwt()` é NULL e
`sofia_is_admin()` é false — então editar à mão as colunas guardadas falha com
"Apenas administradores...".

Contorno: `alter table ... disable trigger`, corrigir, **reabilitar**. Não esqueça de reabilitar.

## Pendência que não pode ser rodada por engano

**`sdd-sql-admin-usuarios.sql` PARTE 2** dropa `authenticated full access` de
`hub_system_access`. Só rode **depois** do deploy do código que escreve por service role —
antes disso, quebra o toggle de `/admin/acessos`. O script é idempotente: reaplicar o arquivo
inteiro depois do deploy é seguro.

## Estado das migrations em produção

Conferido no banco em **20/09/2026**. Atualize esta tabela no mesmo commit em que aplicar uma.

| Arquivo | Estado |
|---|---|
| `passo1`–`passo4`, `v03`, `audit-log`, `autorizacao`, `feedback-cliente`, `conversor-os` | aplicados |
| `v04` | aplicado por inteiro; o índice `veiculos_equipe_ativo_uniq` entrou em 2026-08-10 |
| `track-b`, `track-c-integridade` | aplicados |
| `admin-usuarios` PARTE 1 | aplicado em 2026-08-07 |
| `admin-usuarios` PARTE 2 | **aplicado.** Medido em 20/09/2026: `hub_system_access` tem apenas a policy `authenticated read` (SELECT), ou seja `authenticated full access` já foi dropada. O `AGENTS.md` se contradizia sobre isto até 20/09 |
| `v04-seguranca` | aplicado em 2026-08-10, na versão que lê `hub_user_roles`. **Não rode cópia antiga** — a antiga trazia três e-mails fixos que hoje contradiriam o banco |
| `obras-v0` | aplicado em 2026-09-10. 5 tabelas `obras_*`, bucket `obras-fotos` e 3 policies de storage |
| `obras-fonte`, `obras-field-reconciliacao` | aplicados em 2026-09-14 |
| `obras-sync-execucao` | aplicado em 2026-09-14; os dois jobs de cron entraram em 2026-09-16 |
| `obras-historico` | **aplicado em 2026-09-20.** Tabela `obras_historico` + RPC `obras_aplicar_alteracao` |
| `obras-motivos-remarcacao` | **aplicado em 2026-09-20.** Verificação devolveu 18 linhas, todas `OK` |

## Jobs de cron que não são deste repositório

O banco tem `field-sync-every-5-min`, `financeiro-producao-catalogo` e
`financeiro-producao-lancamento`. **Não mexa** sem saber de quem são.

Os nossos são `obras-field-incremental` (`*/5 * * * *`) e `obras-field-completa` (`2 6 * * *`).
A completa saiu de `5 6` em 20/09/2026 porque colidia com a incremental, perdia a trava e morria
em silêncio — não rodou nenhuma vez entre 17 e 20/09. **Ao agendar job novo, não use um minuto
múltiplo de 5.**
