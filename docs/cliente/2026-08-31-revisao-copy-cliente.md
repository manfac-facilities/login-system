# Revisão de copy — decisões do cliente

**Data:** 2026-08-31
**Fonte:** `2026-08-31-revisao-copy-cliente.pdf`, gerado pelo cliente a partir do artifact
"Revisão de Copy Manfac" (`92ecb40c-284d-491a-b79f-be50874fe392`).
**Texto extraído literal:** `2026-08-31-revisao-copy-cliente-texto-extraido.txt`.

## Placar declarado no próprio documento

`aprovadas 14 · ajustar 0 · recusadas 11 · pendentes 0` — 25 decisões, 0 pendências.

## Como as decisões foram lidas

O PDF é uma impressão da página. O botão marcado não aparece no texto extraído: é um
retângulo colorido. As decisões foram lidas dos operadores de preenchimento do PDF —
`#1f7a4d` (verde, aprovar), `#a8321c` (vermelho, recusar), `#9a6b00` (âmbar, ajustar) —
e casadas com os itens pela ordem do documento.

**Conferência que valida a leitura:** 14 verdes e 11 vermelhos, exatamente o placar
impresso; nenhum âmbar, exatamente os 0 "ajustar"; e a contagem de botões por página
(2,2,2,2,2,3,2,1,2,2,1,2,2 nas páginas 3–15) bate com a contagem de linhas de botão do
texto extraído, página a página.

**O cliente não escreveu nenhum comentário.** O PDF não tem anotações de texto, destaque
ou nota (`/Text`, `/Highlight`, `/FreeText` ausentes). As decisões são binárias.

## APROVADOS — 14 decisões, 15 trocas de string

| # | Onde | Arquivo:linha |
|---|---|---|
| 1 | Menu do topo e rodapé — "Resultados" → "Case de sucesso" | `lib/content.ts:7` **e** `components/Footer.tsx:16` |
| 19 | Bloco de contato no fim de 8 páginas | `components/Contato.tsx:21-22` |
| 15 | Home — card "Contrato recorrente" | `lib/content.ts:50` |
| 13 | Home — card "Manutenção Predial" | `components/home/ServicosTeaser.tsx:140` |
| 24 | /quem-somos — pilar "Gestão ativa, não reativa" | `lib/content.ts:78` |
| 25 | /quem-somos — H2 "Nossa abordagem" | `components/Abordagem.tsx:27` |
| 27 | /quem-somos — H2 "Nossa cultura" | `components/Time.tsx:14` |
| 27 | /quem-somos — card sobre a foto | `components/Time.tsx:60` |
| 37 | /servicos/obras-e-reformas — card "Demanda spot" | `lib/servicos.ts:42` |
| 38 | /servicos/novas-construcoes — H1 | `lib/servicos.ts:51` |
| 43 | /servicos/novas-construcoes — card "Demanda spot" | `lib/servicos.ts:68` |
| 57 | /resultados — texto de apoio do hero | `components/Resultados.tsx:39-40` |
| 59 | /resultados — seção "O Desafio" | `components/Resultados.tsx:113-118` |
| 63 | /contato — parágrafo de abertura | `components/ContactForm.tsx:140` |

Acompanha o item 1: `components/__tests__/Header.test.tsx:9` assere o rótulo antigo e
quebra se não for atualizado junto.

## RECUSADOS — 11 decisões

| # | Onde | Arquivo:linha |
|---|---|---|
| 7 | Home — subheadline do hero | `components/Hero.tsx:37` |
| 11 | Home — "Como funciona na prática", passo 04 | `lib/content.ts:39` |
| 12 | Home — card "Obras e Reformas Corporativas" | `components/home/ServicosTeaser.tsx:126` |
| 14 | Home — card "Sistemas de Climatização (HVAC)" | `components/home/ServicosTeaser.tsx:147` |
| 20 | /quem-somos — H1 do hero | `components/QuemSomos.tsx:35-37` |
| 23 | /quem-somos — 2º parágrafo institucional | `components/QuemSomos.tsx:64-66` |
| 28 | /servicos — H1 do hero | `components/Servicos.tsx:33-35` |
| 48 | /servicos/manutencao-predial — card "Contrato recorrente" | `lib/servicos.ts:96` |
| 48 | /servicos/manutencao-predial — card "Demanda spot" | `lib/servicos.ts:97` |
| 51 | /servicos/hvac — subtítulo do hero | `lib/servicos.ts:107` |
| 57 | /resultados — H1 do hero | `components/Resultados.tsx:34-36` |

## Observação para a próxima rodada

As 28 perguntas que dependem da Manfac (modelo de operação, metodologia dos números,
autorização do case, promessas técnicas, dados cadastrais) continuam sem resposta — o
documento revisado não as cobre.
