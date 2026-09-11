# Feedback 11 — a obra cancelada, e de quem foi a decisão

**Recebido em 10/09/2026, fim da noite**, do João, na mesma conversa sobre o ciclo de vida
da OS. É **requisito novo de produto** — não existe no modelo construído.

## Texto literal

> Outro ponto também, as vezes o cliente cancela a OS... entao tem que ter essa etapa, e
> ai se cancelar coloca o motivo do cancelamento.
> "Cancelado pelo Cliente"
> "Cancelado pela Manfac"

## Por que isso não é detalhe

O modelo atual (`_lib/tipos.ts`) tem **nove etapas**, e todas descrevem uma obra que
avança: `definir` → `levantamento` → `andamento`/`paralisado` → `relatorio` → `aprovarOS`
→ `fecharOS` → `pendFat` → `faturado`. **Não existe saída lateral.** Uma obra cancelada,
hoje, não tem para onde ir — ela ficaria parada numa etapa qualquer, contando dias de
"não andou", gerando tarefa de cobrança e aparecendo como problema no Diário de alguém.

Ou seja: **sem etapa de cancelamento, obra cancelada vira ruído permanente** — exatamente
o tipo de lixo que faz gente abandonar a ferramenta e voltar para a planilha.

## E ele resolve, de graça, a pergunta do feedback 10

O feedback 10 perguntava o que fazer quando o cliente abre uma OS errada e quer removê-la.
A resposta estava sendo desenhada como "descartar obra". **Cancelamento e descarte são a
mesma necessidade**, e unificar os dois é melhor que ter os dois:

| Situação | Vira |
|---|---|
| Cliente desistiu da obra | Cancelado — **pelo Cliente** |
| Manfac não vai executar | Cancelado — **pela Manfac** |
| OS aberta por engano no Field | Cancelado — **pela Manfac**, motivo "erro de cadastro" |

Uma saída só, com autoria explícita. O cliente ganha o que pediu, e o caso do erro de
cadastro deixa de precisar de um mecanismo próprio.

## Desenho proposto — a decidir com o João e o cliente

**`cancelado` é etapa terminal, como `faturado`.** Pode ser alcançada de qualquer etapa,
a qualquer momento — cancelamento não respeita esteira.

Campos novos em `obras_obra`:

| Campo | O que guarda |
|---|---|
| `cancelado_por` | `cliente` ou `manfac` — os dois valores que o cliente nomeou |
| `cancelado_motivo` | texto livre, obrigatório — "erro de cadastro", "loja desistiu"… |
| `cancelado_em` | data |
| `cancelado_quem` | e-mail de quem registrou no sistema (autoria, como `etapa_por`) |

Comportamento:

- Sai do Diário, das Tarefas e da contagem de "não andou" — **imediatamente**. Obra
  cancelada não cobra ninguém.
- **Continua na base**, filtrável, com diário e fotos intactos. Cancelar é arquivar com
  motivo, nunca apagar.
- É **reversível** por ação humana: se foi engano, a obra volta para a etapa em que
  estava. O registro do cancelamento e da reversão fica no histórico.

**Por que `cancelado_por` é campo estruturado e não texto:** "Cancelado pelo Cliente" e
"Cancelado pela Manfac" respondem perguntas diferentes de negócio. Quantas obras a DPSP
cancela por mês é conversa comercial; quantas a Manfac cancela é conversa operacional.
Como texto livre, isso vira "cancelado p/ cliente", "CANCELADO CLIENTE", "cancel. cliente"
— e nenhuma contagem é possível. **Foi exatamente o que aconteceu com o avanço físico na
planilha** (`0.9` numa linha, `95` em outra), que originou a pergunta 03 do cliente.

## Perguntas em aberto

- Cancelamento pode ser feito por **qualquer analista** ou só por administrador?
- Uma obra cancelada **depois de executada** (serviço feito, cliente cancela o pedido) é
  cancelamento ou é outra coisa? Há trabalho a faturar nesse caso — e isso muda tudo.
- No Field, a OS cancelada é **arquivada** ou muda de status? A resposta define se o
  sistema consegue detectar o cancelamento sozinho pelo `order-updated`, ou se depende de
  alguém marcar à mão aqui.
