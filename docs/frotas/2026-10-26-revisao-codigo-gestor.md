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

---

# Code review independente — branch feat/frotas-f1-f3 (C13) — 26/10/2026

Veredito: **aprovado com 1 bloqueador**, corrigido pelo coordenador no mesmo branch: `abastecimento/_corrigir.tsx:104`
`step="0.1"` recusava lançamentos com 2 casas (coluna `numeric(8,2)`) e obrigava a alterar litros; trocado para `0.01`
e `fmtLitros` passa a mostrar até 2 casas. Executado pelo revisor: jest lib/sofia+app/admin 191/191; app.*sofia 214/214;
tsc ok. SQL lido, não executado.

Backlog (vai para `docs/DIVIDAS.md` no merge):
- `Dialogo.tsx`: sem prender foco nem devolvê-lo ao fechar; confirmação da equipe abre sem foco.
- F3 não trava o veículo: correções simultâneas no mesmo carro podem gravar KM de abastecimento fora de ordem (não toca `km_atual`).
- F1 trava só os veículos lidos antes; veículo atribuído por checklist no meio da edição fica fora da trava (raro).
- Aviso "a {origem} fica sem motorista" pode ser falso com 2 motoristas ativos legados.
- Código da equipe vai para maiúsculas: editar só o motorista de equipe com código minúsculo troca o código (diálogo mostra).
- Prévia usa histórico limitado pelo max-rows do PostgREST (banco é a autoridade).
- Seção 0 exige exatamente os 4 triggers conhecidos: conferir produção antes de aplicar.
