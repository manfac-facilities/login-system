---
paths:
  - "app/admin/**"
  - "app/crm/**"
  - "lib/auth/**"
  - "lib/supabase/**"
  - "middleware.ts"
---

# Acesso e admin — território de dado de cliente e autopromoção

Este é o código onde um erro vaza dado de cliente ou deixa alguém se autopromover.
Leia isto antes de tocar em qualquer arquivo destas pastas.

## A fronteira real de autorização é o `middleware.ts`

Todo o controle de acesso por rota (login exigido, domínio `@manfac.com.br`, acesso por
sistema, admin) é decidido em `middleware.ts` e só roda para o que está no `matcher` no
fim do arquivo. **Rota nova protegida = entrar no `matcher`, senão a rota fica aberta
para qualquer pessoa autenticada** — a lógica dentro da função `middleware` nunca
executa se o path não casar com o `matcher`.

Cockpit Manutenção Predial (`/cockpit-manutencao`) e Financeiro (`/financeiro`) ficam
**de propósito fora do `matcher`**: são apps Next separadas com autorização própria
(proxy no mesmo domínio), e colocá-las aqui quebra o acesso delas em vez de reforçar.
Não "corrija" essa ausência.

## `app/crm/page.tsx` repete a checagem que o middleware já fez — não remova

A página chama `hasSystemAccess(..., 'crm')` de novo, depois do middleware já ter
barrado a rota. É intencional, com comentário explícito no próprio arquivo: a doc deste
Next (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`) classifica
checagem de middleware/proxy como **"optimistic"** — checagem definitiva tem que ficar
perto do dado. Some-se a isso que `site_leads` (nome, telefone, e-mail de lead) **não
tem nenhuma policy de RLS**, e a página lê com `createAdminClient()`, que ignora RLS.
Sem a segunda checagem, o middleware vira a **única** barreira entre qualquer bug de
reordenação/refactor futuro e a exposição de dado de cliente direto pela query. Remover
essa checagem "porque já tem no middleware" é o tipo de simplificação que parece
correta e não é — mantenha a duplicação.

## Escrita em `hub_system_access` e `hub_user_roles` só pela service role

As duas tabelas têm **apenas** policy de leitura (`authenticated read`, SELECT). Toda
escrita passa por Server Action em `app/admin/_actions.ts`, usando
`createAdminClient()` (`lib/supabase/admin.ts`, service role). Não existe policy de
`INSERT`/`UPDATE` para o client comum — se existisse, o navegador do próprio usuário
poderia se autopromover a admin ou se autoconceder acesso a um sistema. Isso já
aconteceu: até 10/08/2026 a policy de `hub_system_access` era `ALL` com
`with_check = true`, e qualquer usuário logado se concedia acesso a qualquer sistema
pelo client do navegador. Não recrie uma policy de escrita para "simplificar" uma
Server Action.

## Invariantes garantidos na Server Action, não na UI

Em `alterarNivelAction` e `removerUsuarioAction` (`app/admin/_actions.ts`): ninguém
altera o próprio nível, ninguém remove a própria conta, e o último administrador não
pode ser rebaixado nem removido (`contarAdministradores` <= 1 bloqueia). Esses cheques
estão no servidor porque desabilitar um botão na UI não impede uma chamada direta à
action. **Risco conhecido e aceito:** a checagem do último admin é um read-then-write
(`nivelDe` + `contarAdministradores`, depois o `upsert`/`delete`) — duas remoções
realmente simultâneas do penúltimo e último admin ainda passariam as duas. Não é bug a
corrigir sem pedido; é trade-off já avaliado.

## Duas armadilhas de autorização que já morderam — valem para qualquer SQL novo aqui

1. **Guarda que falha ABERTO com NULL.** `if not minha_funcao() then raise` não dispara
   se a função devolver NULL (`NULL in (...)` é NULL, não `false`). RLS não expõe isso
   porque policy trata NULL como negado — mas uma guarda em PL/pgSQL solta. Toda função
   de autorização usada aqui tem que devolver `true`/`false` sempre: `exists(...)` já
   garante isso; `in (lista)` precisa de `coalesce(..., false)`.
2. **`lib/auth/admins.ts` e `isAdminEmail` não existem mais.** Admin vem só do banco,
   via `hub_user_roles` (`lib/auth/roles.ts` → `getNivel`/`isAdmin`). Qualquer
   referência a `admins.ts` ou `isAdminEmail` em código, comentário ou plano é resíduo
   desatualizado — não recrie o padrão de lista fixa de e-mails.

---

## ⚠️ Exceções defensivas do projeto

A regra geral do projeto é fazer a menor mudança e não adicionar defesa não pedida.
**Este território é a exceção.** Aqui se trata o caso de borda mesmo sem pedido
explícito, porque falha silenciosa em autorização é o próprio erro — não é defesa
excessiva. Isso vale para:

- Regras de RLS (Row Level Security) em qualquer tabela.
- `hub_system_access` e `hub_user_roles` — leitura, escrita e quem pode fazer cada uma.
- Qualquer escrita que apague ou sobrescreva dado de cliente (leads, usuários, acessos).
- Autenticação (login, domínio permitido, sessão).
- Qualquer coisa que envolva dinheiro (ver também o escopo do Financeiro).

Nestes casos, adicione a checagem redundante, o `coalesce`, o teste do caso de borda —
mesmo que ninguém tenha pedido.
