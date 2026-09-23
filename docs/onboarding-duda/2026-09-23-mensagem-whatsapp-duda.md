# Mensagem de WhatsApp para o Duda — 23/09/2026

**Estado: rascunho para o João revisar e enviar.** Fontes: feedbacks do cliente de 22/09
(`docs/cliente/2026-09-22-*.md`) e pergunta de 23/09 sobre cancelamento.

**Revisado em 23/09:** o João decidiu que o cancelamento fica com o Claude, junto com os ajustes da
ficha (mesmos arquivos), porque o cliente quer agilidade nele. A primeira versão desta mensagem o
entregava ao Duda. A próxima frente do Duda está **em aberto**, e o João precisa definir antes de

## O texto

```
Fala Duda! Atualização do Controle de Obras depois do feedback do cliente de ontem (22/09). Dá um *git pull* antes.

*O que mudou*
• Nova ordem do cliente: 1) operacional validado pelo time → 2) dashboard de saúde da operação → 3) agentes. *Agente e cobrança por WhatsApp estão parados* até o sistema estar 100% testado. A "ponte" de cobrança pelo WhatsApp do dia 21 caiu: o cliente quer agente, não botão.
• Ficha da obra (frente minha, em andamento): a etapa "Pendente fechamento" vira *"Executado - pendente aprovação OS"*; ao concluir *Fechar OS* entra a *data de fechamento da OS* (editável, com histórico); *equipe/prestador vira texto livre* com sugestões.
• "Trocar o status para pendente faturamento ainda na esteira": adiado.

*Cancelamento de obra: fica comigo*
O cliente pediu agilidade, então vou fazer junto com os ajustes da ficha, que mexem nos mesmos arquivos (obra/[id], _lib/tipos.ts, base/). *Não mexe no cancelamento*, pra gente não colidir. Quando entrar, a obra cancelada vai sair de diario/ e tarefas/, que são a sua área. Te aviso antes de mexer lá.

*Sua próxima frente: validar o operacional*
É o item 1 da ordem do cliente ("operacional validado pelo time"). Teste de ponta a ponta com dados reais, na sua área: sincronização (OS nova no Field entra, OS sumida gera alerta, obra que volta limpa o alerta), diário (registro, foto, desfazer) e tarefas (cobrança aparece, resposta grava, some quando resolve). O que quebrar na sua área, você corrige. O que quebrar em obra/[id] ou base/, me passa com o passo a passo pra reproduzir, sem corrigir. Anota o roteiro e o resultado num .md em docs/ pra virar o checklist da entrega do dia 28.

Entrega final segue dia 28. Qualquer coisa me chama!
```
