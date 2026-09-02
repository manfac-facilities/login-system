# Feedback 04 — o agente de IA é um cobrador

Repassado pelo João em 01/09/2026. Fala do cliente, texto literal.

## Texto literal

> Que essa é a ideia de ter o agente de ia entendeu
>
> Basicamente ele vai falar assim: ó Roberta que é a menina de compras, olha aqui
> o Yuri falou que na obra tal tá tá faltando material preciso que cê veja com ele
> o que tá faltando e me responda aqui até o final do dia
>
> essa é a ideia do agente de um cobrador

## O que isso define

O agente não distribui tarefa dentro de um sistema: ele **fala com a pessoa**,
onde ela já está, e **cobra resposta com prazo**. A mensagem que ele descreve tem
cinco partes, e todas importam:

1. **Chama pelo nome** — "ó Roberta"
2. **Diz de onde veio** — "o Yuri falou que na obra tal está faltando material"
3. **Diz o que fazer** — "veja com ele o que está faltando"
4. **Pede resposta de volta** — "me responda aqui"
5. **Dá prazo** — "até o final do dia"

Pessoa nova citada: **Roberta, de compras**.

## Consequências que isso traz

**Quem resolve não precisa entrar no sistema.** A Roberta é cobrada e responde no
WhatsApp; o agente registra. Isso derruba a maior barreira de adoção — pessoas de
outras áreas não precisam aprender tela nenhuma.

**A resposta fecha o ciclo.** O que a Roberta responder volta para a obra: ou
resolve a falta, ou vira um prazo novo. Sem isso o agente é só um alarme com
educação.

**O prazo tem padrão:** "até o final do dia". Responde a pergunta que o feedback
03 tinha deixado aberta sobre quem define o prazo — quem define é o agente, ao
cobrar, e o padrão é fechar no mesmo dia.

**Muda o requisito de WhatsApp, para melhor.** Deixa de ser aviso de mão única e
vira conversa. Na API oficial, quando a pessoa responde, abre uma janela de 24h
em que a empresa conversa livremente sem template aprovado. Só a primeira
mensagem do dia precisa de template.

## O que segue aberto

- **Compras vive no Zeev**, que ele mesmo pôs em standby na reunião. A tarefa da
  Roberta nasce no nosso sistema ou empurra para o Zeev? Se nascer nos dois, cria
  um segundo lugar onde procurar tarefa — e aí ninguém olha nenhum.
- **O que acontece quando o prazo vence** e a Roberta não respondeu: entra no
  aviso das 19h, vira aviso próprio, ou sobe para o dono?
- **Destino de "documento / ART" e "outro"**, que estão na lista de faltas e ele
  não citou.
