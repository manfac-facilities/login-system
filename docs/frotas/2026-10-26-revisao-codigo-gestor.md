# Code review independente — branch feat/frotas-gestor — 26/10/2026

Veredito: **APROVADO, sem bloqueadores.** Executado: jest lib/sofia+app/admin+lib/auth 199/199; jest app.*sofia 170/170;
tsc ok; eslint nos 31 arquivos ok; prova de que o teste T5 falha se `isAdmin`/`requireAdmin` voltar ao Sofia.
Corpos SQL comparados linha a linha com os originais: só guarda, mensagens e comentários mudaram.
SQL não executado (sem banco na revisão).

Backlog (vai para `docs/DIVIDAS.md` no merge):
- Spec §5 T11 fala em 17/17 e 35/35; o certo é 18/18 e 37/37.
- T5 não varre `app/api/sofia/**` nem reexportação de `lib/auth`.
- Verificações #15/#16 esperam exatamente uma policy SELECT por tabela de acesso; não confirmado em produção (FALHOU falso possível, pós-commit).
- Fixtures do teste dependem de colunas NOT NULL fora dos arquivos (aborta com erro visível).
- `permissoes.test.ts` sem caso de `data` não booleano.
- g15 mostra só `v_int` na mensagem de falha.
