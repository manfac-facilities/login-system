# Gestão de Fornecedores — melhorias de novembro: entrega da madrugada (04/11/2026)

Pedido: `docs/cliente/2026-11-03-melhorias-fornecedores.md`. Decisões: `2026-11-03-decisoes-melhorias-novembro.md`.

## Estado

- **PR #18 (rascunho):** https://github.com/manfac-facilities/fornecedores/pull/18 — branch
  `feat/melhorias-novembro-integracao`, head `b739081`. **CI verde** (2× `verificar`); local: tsc 0, lint limpo,
  vitest 1334/1334.
- Os 7 itens em 6 frentes (BANCO, FORM, LISTA, CONDICAO, RESUMO, MEDICAO), cada uma aprovada por revisor
  independente. Relatórios em `D:\fornecedores-work\relatorios-nov\`.
- **Nada aplicado em produção:** o auto mode bloqueou até leitura do banco pelo PAT. Main não foi mexida.

## Ordem da manhã (não inverter)

1. **Banco:** aplicar `supabase/hub-install/014_frn_melhorias_novembro.sql` e depois `015_frn_resumo_diario.sql`
   (roteiro com conferência antes/depois: `docs/roteiro-014.md` do repo; rollbacks em `supabase/rollback/`).
   A saída da 014 são 11 linhas de invariante — todas `OK`. Caminho mais rápido: liberar o Claude
   (regra de permissão para o PAT) e ele aplica com a conferência.
2. **Merge** do PR #18 em `main`.
3. **Deploy** no EasyPanel; conferir pelo `Last-Modified` dos chunks.

Merge/deploy antes do banco = app nova pedindo colunas que não existem.

## Configuração para o resumo diário (item 3)

- EasyPanel (app fornecedores): `FRN_CRON_SECRET` e `SMTP_*` (copiar do app `compras`), se ainda faltarem.
- Cofre do Supabase: `fornecedores_producao_resumo_url` e `fornecedores_producao_cron_secret` (mesmo valor do
  `FRN_CRON_SECRET`); depois rodar a 015 de novo para agendar o cron (dia útil, 8h07).
- Sem isso, o resto funciona; só o e-mail diário não sai.

## Backlog (não bloqueia)

Quantidade "1.000" lida como 1 (comportamento antigo); reaplicar a 009 depois da 014 sobrescreve funções
novas; pequenas diferenças de texto em relação ao mockup; demais itens em `docs/DIVIDAS.md` do repo e nos
`REV-*.md`.
