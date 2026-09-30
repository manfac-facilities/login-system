# Spec — "Valor da obra (R$)" editável na ficha (29/09/2026)

Decisão: cliente respondeu "1-Campo da ficha" (`docs/cliente/2026-09-28-dashboard-gerencial-pedido-joao.md`).
Base do painel gerencial: todo número em R$ (carteira, faturamento, receita por equipe) sai de `obras_obra.valor`.

- Coluna `obras_obra.valor numeric` JÁ EXISTE (`sdd-sql-obras-v0.sql:68`) e a RPC `obras_aplicar_alteracao`
  JÁ aceita `valor` (`sdd-sql-obras-historico.sql:179`). **Sem SQL.**
- Hoje nada escreve `valor` (nem sync, nem ficha) — conferido por grep em 29/09.

## O que fazer
1. Campo **"Valor da obra (R$)"** no bloco **Autorização** da ficha (`app/obras/obra/[id]/_bloco-autorizacao.tsx`),
   seguindo exatamente o padrão dos outros campos editáveis desse bloco (Editar/Salvar/Cancelar, histórico,
   conflito de versão). Também no modo Triagem (`_triagem.tsx`), opcional, junto dos campos de autorização.
2. Validação em `app/obras/_lib/ficha-campos.ts`: aceita vazio (= null) ou número ≥ 0 com até 2 casas;
   aceita digitação brasileira ("12.345,67", "12345,67", "R$ 12.345,67"); rejeita texto, negativo.
   Grava número puro.
3. Exibição: `R$ 12.345,67` (Intl pt-BR) na leitura do bloco e na tabela da Base se houver coluna de valor
   (se não houver, NÃO criar coluna na Base — fora de escopo).
4. Histórico: o rótulo do campo no histórico (`historico.ts`) = "Valor da obra".
5. Testes: parser (casos BR acima + inválidos), gravação pelo caminho da RPC com o campo, e componente.

## Fora de escopo
Painel, sync, schema, Base. Território de dinheiro: não arredondar silenciosamente — valor com 3+ casas é erro de validação.

---

## ❌ CANCELADA em 29/09/2026 — premissa falsa

O campo já existe: "Valor (R$)" no bloco **Identificação** (`_bloco-identificacao.tsx`) e na **Triagem**
(`_triagem.tsx`), gravando `obras_obra.valor` por `salvarIdentificacaoAction` (`_actions.ts:222`), com parser BR
(`numeroBR`), validação (`validarIdentificacao`) e rótulo "Valor" no histórico (`historico.ts:55`), desde 20/09.
Achado pelo subagente implementador antes de escrever código; confirmado pelo coordenador. Criar outro campo
duplicaria a coluna em dois blocos com controle de versão separado. **Nada a fazer**: a resposta do cliente
("1-Campo da ficha") já está atendida pelo campo existente.
