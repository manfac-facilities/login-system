# Decisões do João — datas de conclusão da esteira (marcos) — 21/09/2026

Contexto: `marco_exec_fim`, `marco_relatorio`, `marco_fechou_os`, `marco_liberou_fat` e
`marco_faturou` são lidos pela ficha e nenhum código os grava. A única ação que muda a etapa é
`mudarEtapaAction` (`app/obras/obra/[id]/_actions.ts`). Perguntas feitas pelo Claude, respostas
do João escolhidas entre as opções (todas as recomendadas):

1. **Avançar pulando passos** (ex.: "Em andamento" → "Fechar OS"): as datas dos passos pulados
   **recebem a data de hoje**. A esteira fica concluída até a etapa atual; a data é a da
   marcação, não a real, e pode ser corrigida pelo histórico.

2. **Voltar a etapa** (ex.: "Faturado" → "Pendente faturamento"): as datas dos passos à frente
   **são apagadas e o valor antigo fica registrado no histórico** de alterações.

3. **Obras que já estão em fechamento/faturamento sem data**: **preencher uma vez** com a data em
   que a obra entrou na etapa atual (`desde_etapa`), como fim da execução e dos passos anteriores.
   Escrita em produção: mostrar a contagem ao João antes de gravar.
