# Conselho — parecer da lente de dados e código

Verificado em `sdd-sql-obras-*.sql`, `app/obras/_lib/tipos.ts`, `app/obras/base/_regras.ts`,
`app/obras/obra/[id]/_actions.ts` e `_ficha.tsx`. Critério: a resposta errada custa um
`update` (seed/parâmetro), um teste (regra) ou uma migration + retrabalho de tela (schema)?

| # | Pergunta | Relevante? | Bloqueia o quê, concretamente | Suposição declarada? | Quem responde | Custo se errar |
|---|---|---|---|---|---|---|
| 1 | O que o funcionário faz hoje | Sim, mas não é dado/schema | Prioridade de telas no "pronto 21/09" — escopo de produto, nada em `tipos.ts`/SQL | Sim — assumir Base+Ficha+Diário primeiro | Cliente | Retrabalho de tela/fluxo; zero schema |
| 2 | Motivos de remarcação | Sim, mas não agora | Nada hoje: `obras_remarcacao.motivo` é `text` livre, sem FK/catálogo, e a tabela é **"só leitura na v0, vem da importação"** — não existe tela de escrita ainda | Sim — declarar a lista sugerida como enum TS (padrão `BLOQUEIOS`) | Cliente (mas pode adiar: nada consome a resposta agora) | Baixo agora; alto só se o cliente quiser catálogo editável de verdade ("cadastrar novo" persistente) — aí vira tabela nova + migration, não um array |
| 3 | Fim do SLA 2 | Sim — mas o achado abaixo pesa mais que a resposta | Indicador semanal citado pelo cliente (feedback 14, seção F) | Não dá para fechar sem o achado abaixo | Já em boa parte respondido pelo próprio texto do cliente (feedback 14) | Sem o achado, qualquer resposta fica sem efeito prático |
| 4 | Metas dos SLAs (20/30) | Sim, mas baixo custo | Só a cor dos dois contadores de SLA na Base/Ficha | Sim — reusar 20/30 da seção E (já em spec+plano em paralelo) | Pode assumir; confirmar com cliente depois | Baixíssimo — é literal numérico em `_regras.ts`, sem migration |

## Achado — mais importante que a pergunta 3

As três datas que a pergunta 3 precisa **existem como coluna**, sem exigir migration:
- "autorização de início" → `obras_obra.liberado_em` (o próprio código já documenta isso:
  `_ficha.tsx:228`, "é com ele que a cobrança da OS começa").
- "fechamento da OS no sistema do cliente" / "Fechar OS" → `obras_obra.marco_fechou_os`.
- faturamento → `marco_liberou_fat` (entrada em Pendente faturamento) e `marco_faturou`.

**Mas os cinco `marco_*` (`marco_relatorio`, `marco_os_aprov`, `marco_fechou_os`,
`marco_liberou_fat`, `marco_faturou`) nunca são escritos por nenhum código.** Busquei
`marco_` no repo inteiro: aparecem em `tipos.ts` (tipo), em testes (`null` fixo) e em
`_ficha.tsx` (só leitura, para desenhar a esteira). `mudarEtapaAction`
(`_actions.ts:59-93`), o único lugar que muda etapa hoje, grava `etapa`, `desde_etapa` e
`atualizacao` — nunca um `marco_*`. Ou seja: **se o cliente confirmar que SLA 2 conta a
partir do evento "Fechar OS concluído" (o marco), a conta vai ficar sempre nula**, porque
nada grava essa data. A leitura alternativa — dias parado NA etapa "Fechar OS" via
`desde_etapa`/`paradaEtapa` — **já funciona hoje**, pois `mudarEtapaAction` grava
`desde_etapa` a cada troca.

Isso não é uma 5ª pergunta ao cliente: é uma decisão interna que falta no radar. A
seção C do mockup ("Concluir esta etapa", veredito "Ajustar") é onde essa escrita nasceria,
e ela **não está** na lista de frentes já rodando em paralelo (só D e E estão). Sem ela,
qualquer resposta do cliente sobre "fim do SLA 2" fica sem como ser implementada de forma
duradoura — só o substituto via `desde_etapa` funciona, e só enquanto a obra está na etapa.

## Recomendação em 3 linhas

Perguntar ao João hoje: se a seção C (escrita dos `marco_*` ao concluir etapa) entra no
escopo do 21/09 ou fica para depois — sem ela, o "achado" acima se repete em qualquer SLA
baseado em marco, não só o 2. Perguntar ao cliente: só a pergunta 3 mesmo, com a leitura
literal do feedback 14 (seção F) já basta para produto — 1 e 2 podem esperar. Assumir e
declarar: motivos de remarcação como enum TS provisório (pergunta 2) e metas 20/30
reaproveitadas da seção E (pergunta 4), ambos triviais de reverter.
