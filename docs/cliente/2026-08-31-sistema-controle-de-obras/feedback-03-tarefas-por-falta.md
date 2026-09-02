# Feedback 03 — tarefas geradas a partir da falta

Repassado pelo João em 01/09/2026. Fala do cliente (transcrição de áudio, texto
literal, sem correção).

## Texto literal

> quando eu falei de abrir uma tarefa tipo assim ah faltou o quê material
> entendeu ah então existe uma tarefa pra compras checar o que que faltou de
> material naquela obra faltou o que ferramenta ah então existe uma tarefa pro
> pro pro ___ Yuri pra checar o que que precisa fazer com essa ferramenta faltou
> o que equipe é uma tarefa pro próprio Yuri saber o que que ele precisa fazer
> ali com a equipe entendeu De forma que tipo assim fica gerando tarefas ali pra
> pras pessoas né pros responsáveis e que eles cumpram e bote assim ah beleza
> quando é que ele resolve isso então entendeu a pergunta é sempre essa eu como
> dono quero olhar aqui e beleza ele respondeu que faltou material tá mas quando
> é que resolve isso quem resolve tá na mão de quem entendeu

## O que ele está pedindo

Responder "faltou material" não pode terminar em registro. Tem que **abrir uma
tarefa**, roteada para quem resolve aquele tipo de falta:

| O que faltou | Tarefa vai para |
|---|---|
| Material | **Compras** — checar o que faltou naquela obra |
| Ferramenta | **Yuri** — ver o que precisa fazer com a ferramenta |
| Equipe | **Yuri** — ver o que fazer com a equipe |

E a tarefa carrega **dono e prazo**. A pergunta que ele quer responder olhando a
tela, nas palavras dele:

> "beleza, ele respondeu que faltou material. Tá, mas **quando é que resolve
> isso? Quem resolve? Tá na mão de quem?**"

## Isto NÃO contradiz a decisão C — resolve melhor

Na decisão C eu propus travar o salvamento até o analista dizer quem resolve e
até quando. Ele recusou: *"não, deixe ficar marcando não andou todo dia e o
motivo"*.

O que ele pede agora é a mesma informação — quem resolve, até quando — obtida por
outro caminho: **o analista continua respondendo só o que ele sabe** (não andou,
faltou material), e **o sistema** abre a tarefa e a roteia para a área
responsável. O peso sai do analista e vai para quem tem que resolver.

Ou seja: ele não recusou a cobrança, recusou **cobrar da pessoa errada**.

## O que isso acrescenta ao desenho

1. **Roteamento por tipo de falta** — material → Compras; ferramenta → Yuri;
   equipe → Yuri. Faltam definir os destinos de "documento / ART" e "outro".
2. **Tarefa com dono e prazo**, aberta pelo sistema, não digitada pelo analista.
3. **Uma visão de tarefas abertas** — por área e por obra, com há quantos dias
   está na mão de cada um.
4. **Na ficha da obra e no painel do dono:** ao lado da falta, quem está com ela
   e desde quando.

## Perguntas que isso abre e ele ainda não respondeu

- **Quem define o prazo da tarefa?** Um prazo padrão por tipo de falta (SLA), a
  área que recebeu, ou o Yuri ao direcionar?
- **O que acontece quando a tarefa vence?** Entra no aviso das 19h junto com quem
  não preencheu, vira aviso próprio, ou só fica marcada em atraso na tela?
- **Compras hoje vive no Zeev**, que está em standby por decisão dele na reunião.
  A tarefa de compras nasce dentro do nosso sistema, ou é um empurrão para o
  Zeev? Isso decide se estamos criando um segundo lugar onde procurar tarefa.
