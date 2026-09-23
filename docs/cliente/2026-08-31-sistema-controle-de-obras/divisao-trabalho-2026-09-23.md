# Divisão de trabalho João × Duda — 23/09/2026

Proposta do Claude no chat, ajustada pelo João. Critérios (os mesmos aprovados em 11/09 e 20/09):
credencial e canal com o cliente ficam com o João; divisão por **arquivo**, não por tamanho; horas
parecidas, responsabilidade maior do lado do João. "João" inclui os subagentes do Claude.

**Decisão do João, 23/09 (literal):** "tira da lista: visao do dono da pacheco, o agente de wpp.
depois gere o mockup com os arquivos md que ele vai precisar". A visão do dono da Pacheco e os
agentes de WhatsApp **saem desta divisão** (ficam fora do trabalho distribuído agora). Antes disso,
no mesmo dia, ele tirou a manutenção real vinda do Cockpit.

## João (+ subagentes do Claude) — ≈ 21–33 h

| # | Frente | Horas | Por quê |
|---|---|---|---|
| 1 | Cancelamento de obra (espera aprovação do CLIENTE do mockup https://claude.ai/artifact/QiMcQupmStD4svv5TDsKvB) | 9–14 h | mesmos arquivos da ficha (`obra/[id]`, `_lib/tipos.ts`, `base/`); exige migration; o João assumiu em 23/09 |
| 2 | Dívidas da ficha que tocam dado: A1, A13, B5, B7 (`docs/DIVIDAS.md`) | 8–12 h | ficha e as actions dela |
| 3 | "Pendente faturamento" dentro da esteira (quando o João decidir; adiado em 22/09) | 2–4 h | esteira e Base |
| 4 | Só o João: Resend + DNS + chave; pergunta 03 ao cliente (avanço %) | ~2–3 h | credencial e canal com o cliente |

## Duda — ≈ 20–32 h

| # | Frente | Horas | Por quê |
|---|---|---|---|
| D5 | Validar o operacional ponta a ponta (sincronização, diário, tarefas) — já combinado por mensagem em 23/09 | 4–8 h | área dele; item 1 da ordem do cliente |
| D6 | Dashboard de saúde da operação — **mockup primeiro** | 13–19 h | só lê dados de sync/diário/tarefas; tela nova, não toca arquivo do João; é o item 2 da ordem do cliente |
| D7 | Dívidas da área dele: A14, A15 e o teste instável de `_blocos-editaveis.test.tsx` | 3–5 h | sincronização e testes |

## Pontos de contato

- O cancelamento tira a obra cancelada de `tarefas/page.tsx` (área do Duda): uma linha de filtro,
  feita pelo subagente do João, **avisando o Duda antes**.
- Mockup do dashboard: o Duda desenha; **quem publica é a sessão principal do Claude** (mockup
  publicado por subagente não salva); o João revisa antes e o **cliente aprova**.
- Revisão cruzada, uma rodada, lista fechada: só bloqueia dano de dado alcançável.
- Pedido do cliente que originou o dashboard (literal): `docs/cliente/2026-09-22-feedback-esteira-e-equipes.md`
  ("adicionar uma tela de dashboard da saúde da operaçao no lugar dos agentes"; ordem "finalizar o
  operaional validado pelo time > faz o dash > faz o agente").
