# Conferência de lista fechada — D2.1 simplificada

- Branch `origin/duda/field-api-client`, commit `3edba98` (autor daduu27), diff líquido contra `6f5aa96`.
- Régua: `conselho-revisao-d21-2026-09-14.md`, seção "A régua". Lista: a mesma do conselho, itens 1 a 5.
- Método: só leitura estática (`git show`/`git diff`), sem checkout. **Não rodei os testes.** A
  mensagem do Duda diz 337/337 testes de Obras, lint e build ok; não conferi isso por fora.

## MERGE: sim

## Lista

| # | Item | Veredito | Onde | Teste que prova |
|---|---|---|---|---|
| 1 | `archived === true` na listagem é filtrada na entrada | **CUMPRIDO** | `_sincronizacao.ts:224` (`if (vinda.archived === true) continue`), antes do `idsEncontrados.add` (226), do insert (295), do update (345) e da limpeza de alerta (334-338). Normalização: `cliente.ts:243` (só booleano passa, o resto vira `null`) | `_sincronizacao.test.ts` "OS arquivada na listagem não vira obra nem conta como presença ativa" (inserir 0; com obra existente que já tem alerta: atualizar 0, alertasRemovidos 0). `cliente.test.ts` "leva archived booleano da listagem até a OS normalizada" |
| 2 | Herança só com `archived === true` no GET direto | **CUMPRIDO** | `consulta-ordem.ts:28` (única saída `arquivada`); 404/422/500 caem no `catch` → `inconclusiva` (34-38); campo ausente → `inconclusiva` (30-33); `inexistente` saiu do tipo (11). `_sincronizacao.ts:274` herda só com `'arquivada'` | `_sincronizacao.test.ts` "herda o histórico somente quando a ordem antiga está arquivada", "não herda quando a ordem antiga ainda está ativa", "não herda quando a consulta é inconclusiva…". `consulta-ordem.test.ts`: 404, archived null e 500 → inconclusiva. `_actions.test.ts`: falha na consulta não herda |
| 3 | Antiga presente na mesma varredura: sem consulta, sem herança, conflito visível | **CUMPRIDO** | Consulta: `_sincronizacao.ts:144-146,158`. Plano: `vindasPorFieldId` montado antes do laço (190-193), o que dispensa depender da ordem da listagem, e o conflito entra em `ignoradas` (259-267) | `_sincronizacao.test.ts` "não consulta nem herda quando o field_id antigo veio na mesma varredura" e "…quando a antiga vem ativa na mesma varredura". `_actions.test.ts` "field_id antigo na listagem bloqueia consulta e herança" (`consultarSituacaoDaOrdem` não chamado, sem update do field_id) |
| 4 | Motivo da consulta chega ao relatório como veio | **CUMPRIDO** | `_actions.ts:110` (`{ ...consulta, ...resultado }`), `_sincronizacao.ts:282-284` (usa o motivo recebido, só com `trim`) | `_actions.test.ts` "leva o motivo da consulta ao relatório sem categorizá-lo" (422); `_sincronizacao.test.ts` inconclusiva com o motivo do 404; `consulta-ordem.test.ts` 404 preserva o motivo |
| 5 | Três testes pedidos | **CUMPRIDO** | — | arquivada na listagem não vira obra: sim; antiga presente não herda: sim, nos dois níveis; herança só com `archived === true`: sim |

Nota ao item 3, sem efeito no veredito: a spec fala da antiga "não arquivada" presente na
varredura. O código aplica a mesma guarda quando a antiga vem na listagem **com**
`archived: true`: dá conflito visível, sem consulta e sem herança. É a saída conservadora e
bate com o `criterio-ausencia-field-d2.md` atualizado ("se ele veio na listagem, não consulta
e não herda"). Não cria o buraco do "herda sem consultar", que o conselho retirou.

## Alerta em massa por causa do filtro do item 1? **Não.**

1. **Só muda algo se a listagem trouxer arquivadas**, o que continua sem prova (J3). Se não
   trouxer, a OS arquivada já sumia antes deste commit e o comportamento de ausência é o mesmo.
2. **Primeira varredura completa depois de o cliente arquivar muitas OS:** a base está com 0
   obras. As arquivadas são filtradas e não viram obra; `obrasDoField` está vazio e não há
   ausente. Nenhum alerta. Como a base nasce depois do pente fino do cliente, o arquivamento
   em lote cai justamente nessa situação.
3. **Arquivamento em lote depois de a base existir:**
   - acima de max(3, 20%) das obras do Field, o disjuntor (`_sincronizacao.ts:357-369`) não
     grava nada e mostra aviso;
   - abaixo disso, a primeira varredura só grava **suspeita**, e o alerta pede uma segunda
     varredura completa pelo menos 20h depois;
   - suspeitas pendentes continuam no numerador. Dois lotes de 15% em dias seguidos somam 30%
     e o disjuntor segura os dois.
   - Os alertas que passam são verdadeiros: a OS foi arquivada, que é o "sumiu" descrito pelo
     cliente (1B).
4. **O disjuntor cobre, então não é bloqueador.** Efeito colateral, só para backlog e fora do
   pedido ao Duda: depois de um arquivamento legítimo acima de 20% com a base já povoada, o
   aviso de "varredura suspeita" se repete a cada varredura e a detecção de ausência fica
   parada até alguém agir. É visível, não mistura nem apaga dado.

## Bloqueadores

Nenhum.
