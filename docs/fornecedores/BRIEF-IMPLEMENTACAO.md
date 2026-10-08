# Brief comum de implementação — Gestão de Fornecedores

Vale para todo agente que implementa uma fatia. Leia antes de começar.

## Fontes
- Spec: `C:\Users\joao-\projeto-01-elite-da-ia\docs\fornecedores\spec.md` (decisões em §0 e §9.3 — não reabrir)
- Schema rascunho (testado em PGlite): `...\docs\fornecedores\schema-rascunho.sql`
- Levantamento Compras/Financeiro: `...\docs\fornecedores\2026-10-08-levantamento-compras-financeiro.md`
- Mockup (referência visual e de comportamento): `...\docs\cliente\2026-10-07-gestao-de-fornecedores\mockup-fornecedores.html`
- Molde de código: repo `manfac-facilities/compras` (já há clone só-leitura em `<SCRATCH>\repos\compras`)

`<SCRATCH>` = `C:\Users\joao-\AppData\Local\Temp\claude\C--Users-joao--projeto-01-elite-da-ia\0671cfdf-44bc-4933-b31c-c2ae4f60d535\scratchpad`

## Repositório e git
- Repo: `manfac-facilities/fornecedores`, branch base `main` (esqueleto no commit 91826da: Next 16.3.5, React 19.2.4, Biome, Vitest, `output: standalone`, basePath `/fornecedores`).
- **Cada fatia trabalha no SEU clone e na SUA branch**: `gh repo clone manfac-facilities/fornecedores <SCRATCH>\repos\fornecedores-<fatia>` e `git checkout -b fatia/<fatia>`. Nunca use o clone de outra fatia. Nunca faça push na `main` — o coordenador faz o merge.
- Mexa **só nos arquivos da sua fatia** (spec §11). Se precisar de algo de outra fatia, importe pela interface combinada ou crie um stub local marcado `// STUB até fatia X`.
- Esta versão do Next tem mudanças incompatíveis: consulte `node_modules/next/dist/docs/` antes de usar API que você não viu no Compras.
- Commits em português, terminando com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_0172qGayQJQ3iG4kekkyCjmE
  ```
- Push da branch ao final: `git push -u origin fatia/<fatia>`.

## Regras
- **Nunca** conecte em banco real nem chame a API do Omie. SQL é testado em PGlite local.
- Nunca grave segredos em arquivo. Env só por nome.
- Menor mudança que satisfaz a spec; sem abstração para um caso só. Mas **dinheiro, RLS, autorização**: defesa completa, falha fechada, nunca aberta com NULL.
- Pronto = `npm run lint`, `npm test` e `npx tsc --noEmit` passando (e `npm run build` se tocou em rota/config). Cole o resumo da saída na resposta.
- UI em português do Brasil, tema do hub (fundo `#0a1628`, navy `#0d2050`, laranja `#f05a28`, texto secundário `#94a3b8`, bordas `#1e3a5f`), responsiva (390px sem rolagem horizontal).
- Nunca mencionar demissão ou saída de pessoas em texto de tela.

## Resposta final (até 15 linhas)
Branch e hash, o que foi feito, o que ficou stub/TODO, saída resumida dos checks, e qualquer divergência da spec com o motivo.
