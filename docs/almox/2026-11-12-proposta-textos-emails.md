# Almoxarifado — proposta de texto dos e-mails de aviso (para o João aprovar)

> Gerado em 12/11/2026 pelo código da branch `fase-1` do `manfac-facilities/almox` (`lib/avisos/mensagens.ts`).
> **Nenhum e-mail é enviado hoje:** o envio está desligado no código até remetente, destinatários e textos serem aprovados.
> Exemplos com pedido #1042, DPSP, Equipe 1, 2 itens. Em teste o assunto ganha "[TESTE] " na frente.

```
### pedido_pendente
Assunto: Pedido #1042 esperando sua aprovação
O pedido está esperando aprovação há 2 horas úteis.
Pedido #1042 · DPSP · Equipe 1 · retirada sex 13/11 · 2 itens
Abrir no hub: https://hub.manfac.com.br/almox/pedidos/PEDIDO-ID

Aviso automático do Almoxarifado do hub Manfac.

### pedido_quase_no_corte
Assunto: Pedido #1042: aprove até as 16h de hoje
Se o pedido não for aprovado até as 16h de hoje, o técnico não retira sex 13/11.
Pedido #1042 · DPSP · Equipe 1 · retirada sex 13/11 · 2 itens
Abrir no hub: https://hub.manfac.com.br/almox/pedidos/PEDIDO-ID

Aviso automático do Almoxarifado do hub Manfac.

### pedido_nao_aprovado_a_tempo
Assunto: Pedido #1042 não foi aprovado a tempo
O pedido não foi aprovado até as 16h e o técnico não retira sex 13/11. Aprovando agora, a retirada fica para seg 16/11.
Pedido #1042 · DPSP · Equipe 1 · retirada sex 13/11 · 2 itens
Abrir no hub: https://hub.manfac.com.br/almox/pedidos/PEDIDO-ID

Aviso automático do Almoxarifado do hub Manfac.

### emergencial
Assunto: Pedido emergencial #1042 — DPSP
Chegou um pedido emergencial (retirada antes do prazo normal). O motivo está no pedido.
Pedido #1042 · DPSP · Equipe 1 · retirada qui 12/11 · 2 itens
Abrir no hub: https://hub.manfac.com.br/almox/pedidos/PEDIDO-ID

Aviso automático do Almoxarifado do hub Manfac.

### pedido_separado
Assunto: Pedido #1042 separado
O almoxarifado separou o pedido que você aprovou.
Pedido #1042 · DPSP · Equipe 1 · retirada sex 13/11 · 2 itens
Abrir no hub: https://hub.manfac.com.br/almox/pedidos/PEDIDO-ID

Aviso automático do Almoxarifado do hub Manfac.

### transferencia_pedida
Assunto: Pedido #1042: itens aguardando transferência
O pedido foi aprovado com itens que o estoque do contrato não tem. Escolha a origem da transferência ou recuse esses itens.
Pedido #1042 · DPSP · Equipe 1 · retirada sex 13/11 · 2 itens
Abrir no hub: https://hub.manfac.com.br/almox/pedidos/PEDIDO-ID

Aviso automático do Almoxarifado do hub Manfac.

### falha_omie/falha
Assunto: Omie: movimento não gravado
Uma transferência não foi gravada no Omie depois das tentativas. Veja a mensagem na fila do Omie e tente de novo.
Abrir no hub: https://hub.manfac.com.br/almox

Aviso automático do Almoxarifado do hub Manfac.

### falha_omie/conferir
Assunto: Omie: movimento para conferir
Uma saída no Omie ficou sem resposta e pode ter sido gravada. Confira no Omie antes de tentar de novo.
Abrir no hub: https://hub.manfac.com.br/almox

Aviso automático do Almoxarifado do hub Manfac.

### ajuste_a_aprovar
Assunto: Ajuste de inventário #7 para aprovar
O inventário encontrou diferença em Luva nitrílica. O ajuste #7 espera a aprovação de um admin.
Abrir no hub: https://hub.manfac.com.br/almox

Aviso automático do Almoxarifado do hub Manfac.

### reposicao_pronta
Assunto: Sugestão de reposição pronta — Base Almox - DPSP
A sugestão de reposição do estoque Base Almox - DPSP está pronta para revisar (4 itens abaixo do mínimo).
Abrir no hub: https://hub.manfac.com.br/almox

Aviso automático do Almoxarifado do hub Manfac.

### agrupado (2 avisos)
Assunto: Almoxarifado: 2 avisos para você
Pedido #1042 esperando sua aprovação
O pedido está esperando aprovação há 2 horas úteis.
Pedido #1042 · DPSP · Equipe 1 · retirada sex 13/11 · 2 itens
Abrir no hub: https://hub.manfac.com.br/almox/pedidos/PEDIDO-ID

Pedido #1042: aprove até as 16h de hoje
Se o pedido não for aprovado até as 16h de hoje, o técnico não retira sex 13/11.
Pedido #1042 · DPSP · Equipe 1 · retirada sex 13/11 · 2 itens
Abrir no hub: https://hub.manfac.com.br/almox/pedidos/PEDIDO-ID

Aviso automático do Almoxarifado do hub Manfac.

```
