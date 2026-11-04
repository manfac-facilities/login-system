# Melhorias de novembro — frentes da madrugada (03→04/11/2026)

Coordenação: sessão principal (MANFAC FORNECEDOR). Retomada do trabalho da sessão 351d88a2, que caiu às 21h22
com quatro worktrees pela metade.

## Fontes (ler antes de qualquer código)

- Pedido literal do cliente: `C:\Users\joao-\projeto-01-elite-da-ia\docs\cliente\2026-11-03-melhorias-fornecedores.md`
- **Decisões aprovadas pelo João (a spec desta rodada):** `C:\Users\joao-\projeto-01-elite-da-ia\docs\fornecedores\2026-11-03-decisoes-melhorias-novembro.md`
- Banco desta rodada (fonte da verdade de nomes de coluna e regras): `D:\fornecedores-work\melhorias-nov\supabase\hub-install\014_frn_melhorias_novembro.sql`
  - `frn_contratos.preco_fixo boolean` (só global), `frn_contratos.vigencia_meses int` (fim calculado por `frn_fim_por_meses`: início + N meses − 1 dia, último dia do mês quando não existe o dia)
  - papel `consulta` em `frn_papeis` (vê tudo, não aprova)
  - `frn_janela_medicao_aberta(timestamptz)`: dia 1–25 em America/Sao_Paulo; emergencial passa; dentro de `frn_solicitar_medicao`
  - `SPOT_TABELA_FIXA` (modo `tabela`) fora das opções de contrato NOVO; sugestão do global Spot fica vazia
- Repositório: `manfac-facilities/fornecedores`, base `origin/main` = `af5881f`. Regras do repo: `AGENTS.md`/`CLAUDE.md` dele, se houver.

## Frentes (uma por worktree — não toque em arquivo de outra frente)

| Frente | Item | Worktree / branch | Arquivos dela |
|---|---|---|---|
| BANCO | 1, 2, 4, 6 | `D:\fornecedores-work\melhorias-nov` / `feat/melhorias-novembro` | `supabase/**`, `tests/sql/**` |
| FORM | 1, 2 | `D:\fornecedores-work\nov-form-contrato` / `feat/nov-form-contrato` | `app/(modulo)/contratos/novo/**`, `contratos/[numero]/**` (ficha, documento, editar), `lib/regras/condicoes.ts`, `lib/regras/prazos.ts`, `lib/tipos.ts`, testes correspondentes |
| MEDICAO | 1 (linha variável na medição), 6 | `D:\fornecedores-work\nov-medicao` / `feat/nov-medicao` | `app/(modulo)/medicoes/**`, `lib/regras/competencia.ts`, testes correspondentes |
| CONDICAO | 7 | `D:\fornecedores-work\nov-condicao-extenso` / `feat/nov-condicao-extenso` | `app/(modulo)/aprovacoes/**` |
| LISTA | 5 | `D:\fornecedores-work\nov-lista-contratos` / `feat/nov-lista-contratos` | `app/(modulo)/contratos/page.tsx`, `_lista.ts`, `_busca.tsx`, `_escopo.tsx` |
| RESUMO | 3 | `D:\fornecedores-work\nov-resumo-diario` / `feat/nov-resumo-diario` | `app/api/tarefas/resumo-diario/**`, `lib/avisos/resumo*.ts`, testes; cron (ver abaixo) |

Se precisar mudar um arquivo listado de outra frente, **não mude**: escreva no seu relatório o que precisaria e por quê.

## Regras para todas as frentes

1. Worktrees `nov-*` antigos já têm trabalho não commitado de uma sessão que caiu: **leia o diff (`git status`, `git diff`) e continue de onde parou**, não recomece.
2. TDD: teste primeiro, vendo falhar. Rode só os seus testes durante o trabalho (`npx vitest run <caminho> --no-file-parallelism`); antes de terminar, rode `npx tsc --noEmit`, `npm run lint` e a suíte inteira `npx vitest run --no-file-parallelism`.
3. `node_modules` em `nov-form-contrato`, `nov-medicao` e `nov-resumo-diario` é junção para `melhorias-nov\node_modules`. **Não rode `npm ci`/`npm install`** (o disco C está com 13 GB livres e o PC já travou com isso). Não rode `npm run build` (o CI faz).
4. Menor mudança que satisfaz a decisão. Não invente regra nova. Borda improvável e não pedida → anote em `docs/DIVIDAS.md` do repo e siga. Exceção: dinheiro, RLS, acesso — aí trata.
5. **Nunca** toque no banco de produção (`iyytcavcgukfjnjjrerx`), nem leitura. Nada de segredo em arquivo.
6. Commits pequenos em português, terminando com:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_01JeP5yo7sBd7JuqsPgRJNVP
   ```
   `git push -u origin <branch>` ao final. **Não abra PR, não mergeie em main.**
7. Relatório final em `D:\fornecedores-work\relatorios-nov\<FRENTE>.md`: o que fez, arquivos, resultado de tsc/lint/vitest (números reais), o que ficou de fora e por quê, o que precisa de outra frente. Sua resposta final ao coordenador: 5 linhas no máximo + caminho do relatório.
