# Mensagem de WhatsApp para o Duda — 23/09/2026

**Estado: rascunho para o João revisar e enviar.** Fontes: feedbacks do cliente de 22/09
(`docs/cliente/2026-09-22-*.md`), pergunta de 23/09 sobre cancelamento, e a restrição de ordem
em `02-FRENTES-DO-DUDA.md` ("o cancelamento só começa depois que a frente da ficha estiver mergeada").

## O texto

```
Fala Duda! Atualização do Controle de Obras depois do feedback do cliente de ontem (22/09). Dá um *git pull* antes.

*O que mudou*
• Nova ordem do cliente: 1) operacional validado pelo time → 2) dashboard de saúde da operação → 3) agentes. *Agente e cobrança por WhatsApp estão parados* até o sistema estar 100% testado. A "ponte" de cobrança pelo WhatsApp do dia 21 caiu: o cliente quer agente, não botão.
• Ficha da obra (frente minha, em andamento): a etapa "Pendente fechamento" vira *"Executado - pendente aprovação OS"*; ao concluir *Fechar OS* entra a *data de fechamento da OS* (editável, com histórico); *equipe/prestador vira texto livre* com sugestões.
• "Trocar o status para pendente faturamento ainda na esteira": adiado.

*Sua próxima frente: cancelamento de obra*
O cliente perguntou hoje justamente se dá pra cancelar obra, então é a vez dela. Regras já respondidas por ele (pergunta 07 e seção final do 02-FRENTES): qualquer um com acesso cancela; motivo "Cancelado pelo Cliente" / "Cancelado pela Manfac"; obra já executada não cancela; sai do diário e das cobranças; nada apagado, reversível.

⚠️ *Ordem:* a ação e o botão ficam em obra/[id]/_actions.ts, _ficha.tsx e _lib/tipos.ts, que eu estou mexendo agora nos ajustes da ficha. Pra não dar conflito:
1. *Já pode começar:* a migration (etapa terminal + campos cancelado_*, vai pro João aplicar), e a saída da obra cancelada em diario/, tarefas/ e base/.
2. *Confere uma coisa na API:* o critério de entrada hoje lê a situação da atividade e já conhece "canceled". Vê se dá pra sincronização *sinalizar* OS cancelada no Field (sem cancelar sozinha). Só vale se provar com a API.
3. *obra/[id] e tipos.ts:* só depois que os ajustes da ficha entrarem no master. Te aviso.

Antes de codar, me manda um mockup da tela do cancelamento. Regra do projeto, e o cliente vai ver.

Entrega final segue dia 28. Qualquer coisa me chama!
```
