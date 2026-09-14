# Conselho — a revisão da D2/D2.1 está rigorosa demais?

## Por que este conselho existe

O dono do projeto (João) percebeu que a revisão das entregas do Duda (desenvolvedor novo)
entrou num "ping-pong de micro ajustes" que parecem edge cases. Pergunta dele, literal:
"vale trocar uma ideia com a IA que está revisando e aprovando para ver se ela não está
muito rigorosa, porque senão fica esse ping-pong de micro ajuste que muitas vezes é
besteira". Queremos saber **o que é realmente necessário** e **se o que foi pedido é
factível**.

Você é um membro independente. Não edite nada, não faça checkout (o working tree está no
`master`), não acesse banco nem API externa. Só leitura via `git show` / `git diff` e
leitura de arquivos.

## Contexto do negócio (fatos verificados)

- Repositório: `C:\Users\joao-\projeto-01-elite-da-ia`. Módulo `app/obras/` (Next.js +
  Supabase). Controla obras de manutenção em lojas de farmácia. A obra nasce de uma OS no
  Field Control (sistema de terceiro).
- **Escala real:** 167 OS do tipo "Atividade Spot" no Field hoje. Poucos usuários (analistas
  PCM + administradores). **Banco de produção com 0 obras**, de propósito.
- A sincronização é **um botão manual de administrador** hoje. A D3 (próxima frente) vai
  torná-la automática: incremental a cada 15 min e completa 1x/dia às 3h.
- **Nada disso rodou com dado real ainda.** A primeira carga espera o pente fino do cliente
  no Field e a D2.1 mergeada.
- Regras de produto fechadas: o sistema **nunca apaga** por causa do Field; OS que some
  vira **alerta**, não exclusão; a identidade é o `field_id` (o número da OS é editável).
- Respostas do cliente (14/09): excluir no Field **arquiva** e dá para recuperar; OS apagada
  e reaberta com o **mesmo número** deve **herdar** o histórico (diário, fotos) da antiga;
  OS nova aparece em até 15 min; aviso de sumiço em ~24h está bom.
- Chamadas reais à API (14/09): `GET /orders/:id` e cada item da listagem trazem
  `archived` booleano; id inventado devolve **422**, não 404; ninguém sabe o que volta para
  id bem formado e inexistente; não se sabe se a listagem inclui OS arquivadas.

## Histórico das rodadas

| Rodada | Commit | O que o revisor achou | O que aconteceu |
|---|---|---|---|
| D2 (1ª) | `3adbbfb` | **I1** leitura parcial/vazia do Field valia como varredura completa (poderia alertar a base inteira); **I2** conflito de identidade sem saída; **I3** etiqueta `=== null` com coluna `undefined` antes da migration; M1–M9 | Duda corrigiu I1, I3, M1, M3 |
| D2 (2ª) | `2c9a0cf` | **N1** alertas já confirmados contam no disjuntor de 20% (acumulam até desligar a detecção); N2 piso p/ base pequena; N3 tolerância nas 24h; N4 aviso inútil com base vazia; N5 página extra quando total é múltiplo de 100 | Mergeado; N1–N5 foram para a D2.1 |
| D2.1 | `6f5aa96` | **I1** herança dispara mesmo com a OS antiga presente na mesma varredura (obra híbrida); **I2** `archived` não provado + motivo descartado, relatório diz sempre "tentada novamente"; **I3** 404 é o único caminho que junta históricos sem prova positiva; 5 menores | **Não mergeada.** Mensagem já enviada ao Duda pedindo os 3 ajustes abaixo |

Relatórios completos (leia os três):
- `docs/cliente/2026-08-31-sistema-controle-de-obras/review-d2-2026-09-14.md`
- `docs/cliente/2026-08-31-sistema-controle-de-obras/review-d2-2026-09-14-adendo.md`
- `docs/cliente/2026-08-31-sistema-controle-de-obras/review-d21-2026-09-14.md`

Código: `git diff 671949b 6f5aa96` (a D2.1) e o estado em `6f5aa96` de
`app/obras/sincronizar/_sincronizacao.ts`, `_actions.ts`, `app/obras/_lib/field/consulta-ordem.ts`,
`app/obras/_lib/field/cliente.ts`.
Resultado das chamadas reais: `docs/cliente/2026-08-31-sistema-controle-de-obras/j3-verificacao-api-2026-09-14.md`.
Critério do autor: `git show 6f5aa96:docs/cliente/2026-08-31-sistema-controle-de-obras/criterio-ausencia-field-d2.md`.

## O pedido que está com o Duda agora (enviado após as chamadas reais)

1. **Herança só com `archived === true`.** 404 não autoriza mais. Qualquer outra resposta
   não herda.
2. **I1:** levar `archived` para a `OsNormalizada`. Se o `field_id` antigo veio na listagem:
   `archived:false` → ativa, não herda (conflito visível); `archived:true` → herda sem
   consultar. Só consulta `GET /orders/:id` quando o antigo não veio na listagem. Teste para
   os dois casos, incluindo renumeração com número novo na mesma varredura.
3. **I2:** o motivo chega ao relatório, separando falha passageira ("tentaremos na próxima")
   de resposta sem `archived` ("precisa de decisão manual").
4. Comentário + teste: OS listada com `archived:true` não é tratada como presente-e-ativa.

## O ponto do Duda que ele manteve

N5: quando o total de OS é múltiplo de 100 (tamanho da página), a paginação faz uma
requisição a mais, que volta vazia. O Duda manteve, argumentando que evitá-la exigiria
voltar a confiar no `totalCount`, que pode estar desatualizado.

## Perguntas ao conselho

**A. Para cada item** (I1/I2/I3 da D2.1, os 4 itens do pedido atual, e os menores da D2.1):
classifique em uma destas quatro, com **probabilidade real** na operação descrita acima,
**impacto** (e se é reversível), e **custo de corrigir**:
- `BLOQUEIA MERGE` — corrompe ou mistura dado de forma difícil de desfazer, ou quebra algo
  provável;
- `ANTES DA 1ª CARGA REAL` — pode esperar o merge, mas não pode ir para produção com dado;
- `BACKLOG` — registrar, corrigir quando a dor aparecer;
- `DESCARTAR` — não vale o custo.

**B. O pedido atual (itens 1–4) é factível numa rodada só**, sem abrir novos buracos? Há
algo nele que é excesso, ou que deveria ser simplificado (ex.: existe forma mais simples de
cumprir a resposta 2B do cliente)?

**C. O N5 do Duda:** a decisão dele está certa?

**D. Calibração:** nas três rodadas, quais achados foram **valiosos de verdade** (evitaram
dano provável) e quais foram **rigor excessivo**? Proponha uma **régua de severidade**
curta (5–8 linhas) para as próximas revisões deste projeto — o que bloqueia merge, o que
não bloqueia, e quando o revisor deve se calar.

## Formato de saída

Grave sua resposta no arquivo indicado no seu prompt. Estrutura: A (tabela), B, C, D. Seja
direto; discorde do revisor quando for o caso, e discorde também de mim (o coordenador)
quando o pedido atual estiver errado. Na resposta final, devolva só 5 linhas: sua régua em
uma frase, quantos itens caíram em cada categoria, e o veredito de B e C.
