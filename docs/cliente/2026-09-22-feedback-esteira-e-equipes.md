# Feedback — 22/09/2026 — complementos à seção 2 (esteira e cadastro de equipes)

Colados pelo João no chat, literal, na sequência do feedback da ficha da obra:

> trocar o stuatos ainda na esteira para pendente faturamento

> um ponto importante, a lista de equipes/prestadores seria ideal nesse inicio deixar como texto
> escrito, pra nao limitar e ficar errado

**Notas do Claude (não são fala do cliente):** o primeiro item ainda precisa de confirmação —
entendi como "ao concluir Fechar OS, a obra vai para Pendente faturamento dentro da própria
esteira". O segundo pede campo de texto livre para equipe/prestador, em vez de lista fechada.

## Terceiro complemento, colado depois (literal)

> o cliente pediu para adicionar uma tela de dashboard da saúde da operaçao no lugar dos agentes
> e só fazer os agentes quando finalizar o sistema

## Ordem de prioridade dada pelo cliente (colada pelo João, literal)

> a ordem dele foi: finalizar o operaional validado pelo time > faz o dash > faz o agente

## Decisões do João, 22/09, depois do feedback

1. **Letra D do mockup da ficha: tratada como aprovada** (o cliente não citou; João optou por não
   perguntar).
2. **Verificação na Meta / 360dialog: PARADA.** Não seguir com nada do provedor de WhatsApp agora;
   recomeça quando o agente entrar na fila (2-3 semanas de espera naquele momento).
   `passo-a-passo-360dialog-2026-09-22.md` fica como referência, não como tarefa.
3. **Primeiro os ajustes da ficha** (item C em três partes + equipe/prestador como texto livre),
   que é o "operacional validado pelo time" da ordem do cliente. O mockup do dashboard de saúde da
   operação vem depois.

## Decisões do João, 22/09, segunda rodada (respostas a perguntas do Claude)

4. **"Trocar o status ainda na esteira para pendente faturamento": adiado.** Resposta literal:
   "vamos resolver os outros pontos, essa nao é a mais relevante". Contexto levantado pelo Claude:
   "Executadas, ainda na esteira" é o filtro/indicador da Base (`app/obras/base/_regras.ts:148,357`),
   que junta relatório, aprovação OS, Fechar OS e Pendente faturamento.
5. **Comunicado de atualização (áudio de 22/09): aviso dentro do hub + e-mail.**
6. **Mockup dos ajustes da ficha: o João aprova; o cliente vê direto no ar.** Exceção pontual à
   decisão de 18/09 (cliente aprova mockup), para caber no prazo de 28/09.

**Fatos levantados pelo Claude sobre o item C (não são fala do cliente):**
- O código **não pula "Fechar OS" em caso nenhum**. O único desvio é a etapa `aprovarOS`, pulada
  quando a OS já estava aprovada (`app/obras/obra/[id]/_ficha.tsx:238`).
- Essa etapa ainda aparece no hub como **"Pendente fechamento"** (`app/obras/_lib/tipos.ts:165`),
  embora a versão 2 do mockup J4 a tenha renomeado para "Executado - pendente aprovação OS". É
  provável que o nome antigo tenha causado a leitura de que "Fechar OS" é pulado.
- Não existe data de fechamento editável: `marco_fechou_os` é gravado com a data de hoje ao
  concluir Fechar OS. O histórico já aceita esse campo.
- `obras_obra.equipe` já é `text` livre no banco: texto livre para equipe/prestador **não exige migration**.
