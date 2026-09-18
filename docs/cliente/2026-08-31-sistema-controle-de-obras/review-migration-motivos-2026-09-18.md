# Review — `sdd-sql-obras-motivos-remarcacao.sql` (18/09/2026)

Revisor independente (não escreveu o arquivo). Régua: bloqueia só o que causa dano de dado
alcançável ou deixa a produção quebrada. Resultado: **1 bloqueador, 9 itens de backlog.**

## Bloqueador B1 — CORRIGIDO no mesmo dia

A RPC `obras_remarcar_inicio` recusava `p_para is null`, ou seja, **apagar** um início já
marcado. Só que `precisaRemarcar` (`app/obras/_lib/ficha-campos.ts`) decide o contrário, com
teste de regressão já commitado: apagar a data combinada **é** remarcação — é justamente o
que a remarcação registra.

Dano concreto: o usuário limpa o campo Início, a tela exige motivo (caminho especificado e
testado), ele escolhe "Clima", clica em Salvar — e leva um `22023` cru do Postgres. Caminho da
entrega quebrado em produção, e consertar depois custa outra migration rodada à mão.

**Correção aplicada:** a guarda de `p_para` nulo saiu; ficou só o caso degenerado (`p_de` e
`p_para` ambos nulos). E entrou uma guarda nova que o bloqueador expôs: com `p_para` nulo,
`p_campos ->> 'inicio_plan'` devolve NULL tanto para `"inicio_plan": null` quanto para a chave
**ausente** — e ausente faria `obras_aplicar_alteracao` não tocar na coluna, deixando a obra
com a data antiga enquanto a remarcação diz que ela sumiu. Agora `jsonb_exists` exige a chave.

Também ajustada a verificação #5: contava `count(*) = 6`, que passaria a acusar falha legítima
assim que alguém cadastrasse o primeiro motivo novo. Agora conta os 6 de fábrica
(`criado_por is null`).

## O que a revisão confirmou (verificado, não presumido)

- Idempotente de verdade: rodar duas vezes não duplica semente nem falha.
- Tudo dentro de `begin`/`commit`; nenhuma instrução que não viva em transação.
- Guardas de autorização falham **fechado** — `obras_has_access()` é `exists(...)`, nunca NULL.
  (Armadilha 1 do AGENTS.md evitada; a 2 não se aplica, o arquivo não cria trigger.)
- A troca de RLS em `obras_remarcacao` (de `for all` para SELECT+INSERT) **não quebra nada no
  ar**: o único acesso hoje é um `select` em `app/obras/obra/[id]/page.tsx:85`, e nenhuma action
  de obras usa service role. O delete em cascata não passa por RLS.
- A RPC grava a data nova e a linha de remarcação **na mesma transação** — não há caminho em
  que uma aconteça sem a outra.
- Semente conferida byte a byte contra `BLOQUEIOS` (`tipos.ts:187-194`), acento por acento,
  inclusive os espaços de `Cliente / loja`.

## Backlog (não volta para quem escreveu, não impede aplicar)

`p_de` não é conferido contra o `inicio_plan` atual da obra · verificações #15/#16 usam
`information_schema.role_routine_grants`, que pode dar verde por invisibilidade · as
verificações leem como `postgres`, acima da RLS, então não provam o que um `authenticated`
enxerga · a constraint nasce `not valid` e nada manda validá-la · nada exige que `p_linhas`
traga a linha de histórico de `inicio_plan` · `chave` mantém acento, então "Contratação" e
"Contratacao" poderiam coexistir se alguém inserisse por fora da action · o `detalhe` descartado
quando o motivo não é "Outro" não deixa registro · `begin`/`commit` explícitos emitem
`WARNING 25001` pela Management API (inofensivo, igual à v0 em 10/09).

## Ordem de aplicação, que o próprio arquivo impõe pela seção 0

1. `sdd-sql-obras-historico.sql` (**nunca aplicado**) 2. este arquivo 3. verificação: 18 linhas,
todas OK 4. só então o deploy do código. Deploy sem migration quebra a tela; migration sem
deploy não quebra nada.
