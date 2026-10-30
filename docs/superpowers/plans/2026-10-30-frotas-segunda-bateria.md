# Plano — Frotas segunda bateria (30/10/2026)

Spec: `docs/superpowers/specs/2026-10-30-frotas-segunda-bateria-design.md`. Mockup: `docs/frotas/mockups/2026-10-30-mockup-segunda-bateria.html`.

Três frentes em paralelo, cada uma num branch e worktree próprios a partir de `master`. Critério de paralelismo:
**nenhuma frente edita arquivo de outra.** Arquivos compartilhados (`lib/sofia/queries.ts`, `lib/sofia/pendencias.ts`,
`lib/sofia/permissoes.ts`) são **só leitura** para as três; lógica nova vai em arquivo novo da própria frente.

## Frente A — Bases em tabela + Exportar Excel (`feat/frotas-bases`)
Arquivos: `app/(operacoes)/sofia/{abastecimento,km,motoristas,veiculos}/page.tsx` e novos `_table.tsx`/`_filtros.tsx`/
`_exportar.ts` em cada uma (ou um componente comum novo em `app/(operacoes)/sofia/_base/`), `lib/sofia/bases/*` (novo).
1. Funções puras de filtro/ordenação/colunas de exportação por base, com testes.
2. Resolução equipe/motorista na data (histórico de responsabilidade), com teste.
3. Exportar `.xlsx` (exceljs, padrão `app/obras/base/_exportar.ts`): colunas do mockup, tudo o que está filtrado.
4. Telas: filtros, tabela ordenável, 20 por página, total, "Registrar novo…" (formulário existente), linha clicável,
   ficha do veículo em gaveta. Corrigir/Excluir só para quem `podeGerirFrotas`.

## Frente B — Visão geral nova (`feat/frotas-visao-geral`)
Arquivos: `app/(operacoes)/sofia/page.tsx` (+ `_visao*.tsx` novos ao lado), `lib/sofia/visao-geral.ts` (novo).
1. Funções puras: frota por situação, disponibilidade (regra 3 da spec), ações de hoje, custos do mês; testes.
2. Leituras (RLS do usuário) e a página com 1.1–1.4, estados vazio/erro, cliques levando à lista filtrada
   (links por query string nas rotas existentes).

## Frente C — E-mail diário de alertas (`feat/frotas-email-diario`)
Arquivos: `app/api/frotas/alertas-diarios/route.ts` (novo), `lib/sofia/alertas/*` (novo), `sdd-sql-sofia-alertas-cron.sql` (novo, NÃO aplicado).
1. Montagem dos blocos (funções puras) + HTML/texto do e-mail conforme mockup seção 3; testes.
2. Rota protegida por segredo (mesmo padrão de `app/api/obras/relatorio-diario/route.ts`), destinatários de `sofia_gestores`,
   variantes "com pendências" / "nada pendente" / "falha".
3. SQL do `pg_cron` 07:00 BRT seg–sex, com verificação e rollback; documentar variável/segredo em `docs/infra/variaveis-e-deploy.md`.

## Integração
Revisão independente por frente (agente diferente) → merge no `master` em sequência → `tsc` + jest do Sofia + `npm run build`
→ SQL do cron com autorização escrita do João → push → João clica Deploy → conferir chunks.
