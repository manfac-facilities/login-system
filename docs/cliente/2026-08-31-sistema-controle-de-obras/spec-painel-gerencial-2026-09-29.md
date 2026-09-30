# Spec — Painel gerencial do Controle de Obras (29/09/2026)

Pedido literal e decisões: `docs/cliente/2026-09-28-dashboard-gerencial-pedido-joao.md` (pedido, metas, respostas,
feedback). **Mockup aprovado pelo cliente:** `mockup-dashboard-gerencial-2026-09-28.html` (mesma pasta) —
é a referência de layout, textos e interação. Ajuste pedido: o "Resumo por status" usa as **etapas do sistema**
(o botão "Como a planilha" SAI; fica só a visão por etapa).

## Onde
- Rota nova `app/obras/painel/` (`page.tsx` server, componentes client `_*.tsx`, cálculo puro em `_calculos.ts`).
- Aba nova no `app/obras/layout.tsx`: **"Painel gerencial"**, depois de "Base de obras".
- Quem vê: todo usuário com acesso ao Controle de Obras (o layout já faz a guarda — conferir).

## Dados (tudo lido do banco; nada de dado fictício)
| Número | Fonte |
|---|---|
| Valor de cada obra | `obras_obra.valor` (campo novo na ficha; nulo = R$ 0 e a obra conta como "sem valor") |
| Cliente | `obras_obra.cliente` (coluna nova, frente paralela; nulo = "Sem cliente"). **Não editar `tipos.ts`**: declare o tipo local `ObraRow & { cliente?: string \| null }` e selecione a coluna; se a coluna ainda não existir no banco, a query não pode quebrar a tela — selecione `*`. |
| Faturado + data | etapa `faturado`, data = `marco_faturou` (decisão do cliente) |
| Carteira | não cancelada e não faturada: etapas de antes, campo, fechamento e `pendFat` |
| Carteira no fim de um mês passado | reconstruída: entrou (`created_at`, dia SP) ≤ D, e não (faturada com `marco_faturou` ≤ D), e não (cancelada com `cancelado_em` ≤ D) |
| SLA pendente faturamento | `marco_liberou_fat` → `marco_faturou`, das faturadas no mês; esperando = obras em `pendFat` hoje |
| SLA aprovação da OS | `liberado_em` → `aprovacao` (OS aprovada em), das aprovadas no mês; esperando = liberadas sem `aprovacao` |
| Receita da equipe | `valor` das obras com `marco_exec_fim` no mês, por `equipe` (texto; normalizar trim/caixa só para agrupar) |
| Dias trabalhados | `obras_diario` com `andou = true`, por obra (e por mês) |
| Produtividade | receita ÷ dias trabalhados nessas obras |
| Paradas e porquê | etapa `paralisado` hoje; motivo = `bloqueio` da obra ou o `motivo` do último diário "não andou" |
| Atrasadas / remarcadas | em campo (andamento/paralisado) hoje; atrasada = regra existente de atraso em `tipos.ts` (`derivar`/`estourou`) ; remarcada = tem linha em `obras_remarcacao` |
| Ritmo do campo | mesmas contas das telas Diário e Tarefas (reusar as funções existentes) |
| Gantt | planejado `inicio_plan` + `duracao`; realizado `inicio_real` → `fim_real` ou hoje |
| Metas | constantes no código: DPSP carteira 600.000 / faturamento 350.000 por mês; D1000 80.000 / 60.000; demais sem meta; "Todos" soma. Casar o nome do cliente sem diferenciar caixa |

**Simplificação decidida pelo coordenador:** resumo por etapa, paradas, atrasos e Gantt mostram a **posição de hoje**
(não há histórico diário de etapa); mês escolhido afeta metas, faturamento, SLAs, equipes e histórico. Deixar o
rótulo "Posição de hoje" visível nessas seções, como o mockup já faz.

## Regras
- Obras ausentes do Field / canceladas: canceladas fora de carteira e de tudo, exceto se o mockup mostrar.
- Mês em curso compara com os mesmos dias do mês anterior (ou do ano anterior, pelo seletor).
- Performance: uma leitura de obras + uma agregação de diário (por obra e mês) + remarcações + tarefas; cálculo no servidor em função pura testada; nada de N+1.
- Mobile: sem rolagem horizontal da página (tabelas e Gantt rolam dentro da caixa).

## Testes (TDD em `_calculos.ts`)
Carteira atual e reconstruída; faturamento por mês e YTD; metas por filtro e soma; SLAs média/pior/esperando;
receita/dias/produtividade por equipe; % atrasadas e remarcadas; filtro por cliente muda tudo e "Todos" = soma;
obra sem valor não quebra somas.
