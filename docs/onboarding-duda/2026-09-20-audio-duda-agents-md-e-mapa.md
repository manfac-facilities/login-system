# Áudio do Duda — AGENTS.md, regras do projeto e mapa de arquivos

Recebido pelo João e colado no chat em **20/09/2026**, como transcrição de áudio
(TurboScribe). Salvo literal antes de qualquer decisão, conforme a regra do projeto.

> **Nota de leitura:** a transcrição automática escreve "Coixinha", "CloudMD", "Clouds",
> "CloudGPT" e "Cloud". Leia como **Claude**, **CLAUDE.md** e **Claude/GPT**. O texto abaixo
> está **sem correção nenhuma**, de propósito — a correção é interpretação, e a fonte tem que
> poder ser reconferida.

## Texto literal

```
(Transcrito por TurboScribe. Atualize para Ilimitado para remover esta mensagem.)

Boa, o Coixinha faz isso aí ó Não sei se já deve ter feito alguma coisa disso Mas faz só isso
aí com certa prioridade, cara Faz o CloudMD na raiz Ou o AgentsMD Pode ser só sempre uma cópia
do CloudMD Só que tem que atualizar ele sempre que o CloudMD for atualizado O Clouds, o
CloudGPT acho que usa o AgentsMD, sei lá, por default Mas é o seguinte, bota nesse AgentsMD as
regras de como a gente tem que se comportar Como se fosse as skills dele ali Mas não é bem
skills, é as regras do projeto Então é isso aí, cara, nunca ir no micro do micro Ou, a não ser
que a fase tenha explicitamente mudado A fase tá em, sei lá, MVP Que é pra focar na prática Ou
pro, sei lá, tu vai fuçar na internet e vai ver várias boas práticas pra botar nesse CloudMD
Essas são as regras do projeto, sacou, pra que o Cloud sempre que vai atuar O GPT vai consultar
esse arquivo primeiro Pra usar isso como regra, sabe Só que aí tem várias coisas, mano, dá pra
fazer várias coisas maneiras Tipo, aí não sei se vale a pena fazer isso Mas em um dos projetos
que eu fiz, melhorou muito Mano, o CloudMD, ele era só essas regras principais assim E, mano,
um grande mapa de onde tá os arquivos Porque a IA gasta muito token e tempo procurando onde vão
ser feitas as mudanças Onde tá o contexto daquela tarefa específica que tá sendo pedida E isso
vale a pena tu pesquisar, mano Cara, foi muito bom pro meu projeto, economizava muito token,
muito tempo A gente vai gastar um tempo agora nesse setupzinho inicial, mas sinceramente vale a
pena Então ali o CloudMD, ele é só ser um mapa de onde tá, como se fosse um mapa de gavetas,
sabe Onde tá cada arquivo, cada função pra consulta do agente sempre que ele for agir E, claro,
isso provavelmente vai acarrear mudanças na organização dos arquivos, criação de novos Ele, o
recomendado é deixar sempre os arquivos com poucas linhas, sabe Não passando muito de 600, 700
linhas de código cada arquivo Mas parece que vale a pena, mano, você pesquisar e chegar no
formatinho ideal Até, mano, pesquisar com o próprio Cloud, de repente, ele faz isso, sabe Como
fazer o CloudMD ser uma otimização dele mesmo, pra ele mesmo agir E essas regrinhas, mano, que
a gente tá falando agora principalmente Essa de não ir do micro do micro, mano Se for muito
edge case, se for uma possibilidade que não é provável de dar problema agora Deixar passar,
deixar anotado isso em algum lugar, sabe Criar um MD de... MD é um arquivo markdown, né, de
meio de texto Mas criar um MD de, sabe, assim, dependências que deixamos passar de propósito
Mas que vale a pena voltar no futuro, mas, sabe, pra ele liberar assim isso Enfim, vale a pena
gastar um tempo nessa organização inicial, sabe Nesse setup, que, mano, o projeto acaba sendo
construído de forma mais organizada, rápida e sustentável, sabe

(Transcrito por TurboScribe. Atualize para Ilimitado para remover esta mensagem.)
```

## Os seis pedidos, destacados do áudio

Tradução mínima, para virar plano depois. A fonte é o bloco acima.

| # | Pedido | Situação no repositório em 20/09 |
|---|---|---|
| 1 | `AGENTS.md` na raiz, espelhando o `CLAUDE.md`, sempre em sincronia | **Já existe, e melhor que cópia:** o `CLAUDE.md` é só `@AGENTS.md`, então há uma fonte só e não há o que dessincronizar |
| 2 | Regras de comportamento do projeto dentro dele | Existem, mas **espalhadas** pelo arquivo e misturadas com fatos de infra |
| 3 | **Nunca ir no micro do micro**, salvo se a fase mudar explicitamente | Existe como régua de revisão acordada com o João, **mas não como fase declarada** no arquivo |
| 4 | **Mapa de onde está cada arquivo e cada função** — "mapa de gavetas" | **Não existe.** É o buraco real |
| 5 | Arquivos de código curtos, na faixa de 600–700 linhas | Não é regra escrita; falta medir o repositório |
| 6 | Um `.md` de **coisas deixadas passar de propósito**, para voltar depois | **Não existe** como arquivo único. Hoje vive espalhado em "backlog" dentro dos docs de obras |

## Por que o pedido 4 é o que mais paga

O argumento do Duda é de custo: o agente gasta token e tempo **procurando** onde mexer, antes
de mexer. Neste repositório isso é agravado por um fato concreto — a raiz contém, além do hub,
o `manfac-site/`, o `sistema-os/` e `material manfac/`, que **não** fazem parte do app. Toda
busca cega varre os quatro.

Evidência colhida no mesmo dia: um `grep -ril` na raiz **estourou 120 segundos** e precisou ir
para background; e `npm test` na raiz roda as suítes do `manfac-site/`, que falham por
resolução de módulo e poluem o resultado com `7 failed` que não são do hub.
