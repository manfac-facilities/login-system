# Feedback 09 — os estados do fim da esteira, e o pedido de compra

**Recebido em 10/09/2026, à noite**, pelo João, no chat, logo após a discussão sobre
controle de faturamento. Chegou sem enquadramento: não foi dito se é fala do cliente, se
é correção do modelo ou se é esclarecimento do fluxo real. **Registrado literal antes de
qualquer interpretação.**

## Texto literal

> Obra concluída - OK
> Pendente aprovação da OS
> OU
> Pendente faturamento (OS aprovada e cliente ainda nao enviou o pedido de compra)

## O que há de novo aqui

**O "pedido de compra" nunca apareceu neste projeto.** Verificado em 10/09 por `grep`:
não existe no código (`app/obras/`), não existe em nenhum `.md` desta pasta, não existe
na transcrição da reunião nem no dump da planilha. É um conceito que entra agora.

E ele **redefine o gatilho do faturamento**. Até aqui, "Pendente faturamento" era um
estado sem causa declarada. Agora tem uma: a obra fica parada ali porque **o cliente
ainda não enviou o pedido de compra**. Isso dá ao estado um dono (o cliente), um evento
que o encerra (a chegada do PC) e, portanto, algo concreto a cobrar — que é o que o
agente cobrador da camada 3 precisaria saber.

## Como isso se compara ao modelo construído

O modelo atual (`_lib/tipos.ts`) tem, do fim da execução em diante:

| Chave | Nome na UI | Dono | Onde | Status na planilha |
|---|---|---|---|---|
| `relatorio` | Relatório de entrega | Equipe / responsável | Field Control | deduzido do Field |
| `aprovarOS` | **Pendente fechamento** | Cliente DPSP | Sistema do cliente | EXECUTADO - APROVAR OS |
| `fecharOS` | Fechar OS | Responsável da obra | Sistema do cliente | FECHAR OS |
| `pendFat` | **Pendente faturamento** | Cliente DPSP | Sistema do cliente | PENDENTE FATURAMENTO |
| `faturado` | Faturado | Financeiro Manfac | Manfac | FATURADO |

**Três observações, e nenhuma delas é conclusão — são o que precisa ser confirmado:**

1. **A bifurcação descrita ("OU") já existe no código**, como desvio: em
   `_ficha.tsx:162`, quando `os_aprovada` é verdadeiro, o passo "Pendente fechamento" é
   desenhado como *pulado* e a obra vai direto para Fechar OS. Ou seja, o modelo já
   entende que uma obra concluída vai para **um de dois lugares**, dependendo de a OS já
   estar aprovada ou não. O texto acima parece descrever exatamente isso.

2. **Divergência de nome.** O texto diz "Pendente aprovação da OS"; a UI diz "Pendente
   fechamento". Os dois se referem à mesma etapa (`aprovarOS`). O nome atual veio da
   decisão K (feedback 05), que trocou "Cobrar aprovação da OS" por "Pendente
   fechamento". **Se o nome atual não é o que a operação usa na fala, ele está errado na
   tela** — nome de etapa é vocabulário de trabalho, não estética.

3. **Não há onde registrar o pedido de compra.** `obras_obra` não tem coluna para número
   nem data de PC. Sem isso, "Pendente faturamento" continua sendo um estado sem
   evidência: dá para saber que a obra está esperando, mas não desde quando o pedido foi
   cobrado, nem quando chegou.

## O que precisa ser respondido antes de virar spec

- Esse texto é **fala do cliente** ou definição do João?
- "Pendente aprovação da OS" é para **renomear** a etapa `aprovarOS` na tela?
- O **pedido de compra** vira campo do sistema (número + data), ou é só a explicação de
  por que a obra espera, sem registro próprio?
- O PC é o que autoriza o **faturamento** — então ele é pré-requisito de `faturado`, ou
  existe caso em que se fatura sem ele?

---

## Respostas às perguntas desta página (14/09/2026)

- **"Esse texto é fala do cliente ou definição do João?"** — **Fala do cliente.** Resposta do
  João no chat, literal: *"isso foi fala do cliente"*.
- As outras três foram respondidas pelo próprio cliente na
  `pergunta-07-cancelamento-e-pedido-de-compra.md` (respostas 4A, 5A e 6C): o pedido de
  compra é sempre exigido para faturar, com número e data registrados, e a etapa se chama
  **"Executado - pendente aprovação OS"** — "dinheiro parado e que depende do cliente".
