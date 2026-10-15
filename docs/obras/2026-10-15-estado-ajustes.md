# Gestão de Obras: ajustes da reunião de 14/10, estado em 15/10/2026

Fonte: `docs/cliente/2026-10-14-reuniao-jose-guilherme.md` (literal) e os complementos do João no resumo.

## Frentes
1. **Botões "Solicitar compra" e "Solicitar medição"** na ficha da obra. O José cobrou como entrega imediata.
   Mockup: https://claude.ai/artifact/B9HC5cYWsZQKdLoaVXmyMD (cópia em `mockups/mockup-botoes-compra-medicao.html`).
   Investigação: `2026-10-15-investigacao-botoes-compra-medicao.md`.
2. **Agendar e tirar a obra do diário até uma data** (tarefa com data + trava temporária, prioridade do João).
   Mockup: https://claude.ai/artifact/WyFkCVBwZC8ZsN35jPQKkR (cópia em `mockups/mockup-pausa-diario.html`).
   Mapa: `2026-10-15-mapa-diario-tarefas.md`. Exige migration, que não foi escrita.
3. Exportar Excel: já feito pelo José (8a4b6e5).
4. Depois: análise e tendências, layout no padrão do Cockpit, agente de cobrança.

## Decisões técnicas do coordenador (não vão para o cliente)
- Pop-up = nova aba com query string, porque os três apps mandam `X-Frame-Options: DENY`.
- Corte por data só na medição; a compra vale para qualquer obra (fala literal: "solicitar medição e solicitar contratação").
- Pausa: híbrido dos desenhos A e B do mapa. Os campos ficam na obra, para não cair na armadilha das tarefas apagadas pelo `abrirTarefas`, e a pausa aparece numa seção "Agendadas" em Tarefas.
- Medição com vários contratos: a escolha do contrato fica em aberto entre a ficha (hub lê `frn_contratos`) e o Fornecedores (aceita `?obra=`). Decidir na spec, depois de conferir a RLS de `frn_contratos`.

## Pendências de decisão (João e cliente)
Ver a seção "Suposições que precisam do seu sim" em cada mockup.
