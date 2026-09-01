# Decisão do cliente — modelo de operação

**Data:** 2026-08-31
**Contexto:** reunião com o cliente, junto da entrega das decisões de copy
(`2026-08-31-revisao-copy-cliente.md`).

## A decisão

**O modelo de operação é PARCEIROS HOMOLOGADOS.**

Dita pelo João em 31/08/2026, na presença do cliente. É a resposta que estava travando
6 itens da auditoria (5, 18, 35, 39, 41, 44) e, por dependência, os itens 22 e 29.

## Consequência imediata

O site afirma hoje "equipe própria" em **14 pontos** — mais que os 6 da auditoria.
Enquanto não forem corrigidos, o site declara ao prospect um modelo de operação que a
empresa não pratica.

| Arquivo:linha | Trecho |
|---|---|
| `lib/content.ts:28` | "Equipe própria treinada, rotina técnica e supervisão operacional." |
| `lib/content.ts:67` | "Equipe própria treinada" (pílula) |
| `lib/servicos.ts:25` | headline obras — "...escopo, cronograma, equipe própria..." |
| `lib/servicos.ts:36` | comoExecutamos obras — "execução com equipe própria e supervisão técnica" |
| `lib/servicos.ts:46` | **metaDescription** obras |
| `lib/servicos.ts:52` | sub novas construções — "equipe técnica própria em campo" |
| `lib/servicos.ts:57` | bullet — "Equipe técnica própria com gestão centralizada" |
| `lib/servicos.ts:62` | comoExecutamos construções — "execução com equipe própria" |
| `lib/servicos.ts:74` | **metaDescription** construções |
| `lib/servicos.ts:80` | sub manutenção — "equipe técnica própria" |
| `lib/servicos.ts:101` | **metaDescription** manutenção |
| `components/home/Diferenciais.tsx:43` | "Equipe própria. Ponto único de responsabilidade." |
| `components/home/QuemSomosTeaser.tsx:34` | "A Manfac assume tudo com equipe própria" |
| `components/QuemSomos.tsx:59` | "Atuamos com equipe própria, gestão..." |
| `app/servicos/page.tsx:11` | **metadata** — "tudo com equipe técnica própria" |

**A auditoria cobria só 6 destes.** Corrigir apenas os 6 deixa a afirmação viva nos
outros 8 — resultado pior que o atual: incoerente e ainda incorreto.

## Pendente

Falta a formulação exata: "gestão e núcleo técnico próprios com parceiros homologados"
(texto da auditoria, item 5) ou "gestão própria com execução por parceiros homologados".
São textos diferentes e a escolha muda os 14 pontos.

## Formulação escolhida (31/08/2026, decisão do João)

> **"gestão e núcleo técnico próprios, com parceiros homologados"**

É a formulação que a auditoria propôs no item 5. Vale para os 14 pontos listados acima —
não só os 6 que a auditoria mapeou.

**Não implementar antes da aprovação do cliente.** Ele não revisou nenhum texto sobre
modelo de operação: o PDF de 31/08 cobriu apenas os 25 itens de troca pura de texto. Os
textos novos entram na próxima rodada de revisão com ele.
