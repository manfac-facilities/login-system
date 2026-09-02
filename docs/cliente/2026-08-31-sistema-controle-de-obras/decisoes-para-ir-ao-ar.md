# Decisões para colocar o projeto no ar

Recebidas do João em 01/09/2026, respondendo à lista do que falta entre o
mockup aprovado e a produção.

## Resposta literal

> sobre a decisao b: ok, gostei.  sobre o numero 5 entrada das obras o sistema
> deve ser capaz de conectar com api do field control e se travar deve dar para
> fazer manual. 6- ok, crie o agendador, nesse trabalho vaiser imprescindivel ter
> o agendador

## Decisão B — AMBÍGUA, precisa de uma palavra a mais

"ok, gostei" não diz **qual** dos dois formatos do diário ele escolheu: uma obra
por vez, ou a lista única no estilo planilha.

Leitura mais provável, pelo precedente da decisão A ("pode manter as duas, o
cliente gostou assim"): ele quer **as duas, com o seletor**. Mas é suposição, e
a diferença muda o que se constrói. Perguntado ao João.

## Entrada das obras — DECIDIDA: as duas vias

> "o sistema deve ser capaz de conectar com api do field control e se travar deve
> dar para fazer manual"

Não é uma ou outra: **integração com a API do Field Control é requisito**, e o
cadastro manual é o caminho que mantém o sistema de pé quando ela falhar ou
demorar. Consequência prática: o cadastro manual não é um degrau provisório a ser
removido depois — é o modo degradado permanente, e precisa ser tão bom quanto o
automático.

## Agendador — DECIDIDO: construir, e é imprescindível

> "crie o agendador, nesse trabalho vai ser imprescindível ter o agendador"

Sem ele não existem os avisos das 18h e das 19h — ou seja, não existe a cobrança
que sustenta o hábito de preencher. É a peça que faz o sistema funcionar sozinho
em vez de depender de alguém lembrar.

## Escopo da v1, definido a partir destas respostas

**Entra:**
- Base de obras (cadastro vivo)
- Entrada via API do Field Control **e** cadastro manual
- Triagem da obra que chega sem definição
- Diário do dia, nas duas formas (a confirmar na decisão B)
- Painel do dia para administradores
- Agendador com os avisos das 18h e 19h

**Fica para depois:**
- Dashboard e apresentação automática para reunião (camada 4)
- Agente de IA conversacional no WhatsApp (2ª etapa da decisão 01)
- Integração com o Zeev (standby, decisão do cliente na reunião)

## Canal das notificações — decidido em 01/09/2026

> "a notificaçao aos adm do hub é via email e wpp"

Os avisos aos administradores do hub (o das 19h de quem não preencheu, e o de
falta de material) saem por **e-mail e WhatsApp**, os dois.

O canal do aviso das 18h ao analista não foi especificado — não assumir.

### Consequência técnica, para a spec

**E-mail** é direto: o hub já usa Supabase, e o envio cabe numa rota chamada pelo
`pg_cron` + `pg_net`, que já estão instalados em produção.

**WhatsApp não é ligar uma chave.** Precisa de um provedor, e a escolha tem
custo e prazo diferentes:

| Caminho | O que exige | Risco |
|---|---|---|
| API oficial (Meta / Twilio / 360dialog) | conta WhatsApp Business, número dedicado, verificação da empresa e **template aprovado** para mensagem iniciada pela empresa | prazo de aprovação; custo por conversa |
| Provedor não oficial (Z-API, Evolution) | um número comum conectado via QR | número pode ser bloqueado pelo WhatsApp; sem garantia de entrega |

O aviso das 19h é mensagem iniciada pela empresa fora de qualquer conversa — ou
seja, no caminho oficial ele **exige template aprovado**. Isso precisa entrar no
cronograma como pré-requisito, não como detalhe de implementação: dá para o
sistema subir com e-mail funcionando e o WhatsApp entrar depois, sem travar nada.

## Quem pega qual obra — informação do cliente, 01/09/2026

> "sobre quem pega qual obra. o yuri toma conta das obras grandes e os outros sao
> equipes de manutencao e obra pequena, o cliente recomendou a pessoa que deve
> definir/direcionar o projeto é o yuri"

Três coisas de uma vez:

1. **Existe uma distinção entre obra grande e obra pequena / manutenção** que o
   mockup não representa. Ela não aparece como coluna na planilha — está na
   cabeça de quem distribui.
2. **A carteira é dividida por porte:** o Yuri fica com as obras grandes; os
   outros analistas com manutenção e obra pequena.
3. **Quem direciona é o Yuri.** Isso confirma e aperta a decisão D: a fila
   "Aguardando definição" não é de qualquer analista — é **dele**, e o ato de
   definir inclui dizer quem vai tocar a obra, não só preencher os campos.

### DECISÃO H — descartada pelo cliente em 01/09/2026

> "ignora obra grande e pequena, envia direto para o yuri"

**Não existe classificação de porte no sistema.** Toda obra que chega do Field
vai para a fila do Yuri, e ele direciona.

Por que isso é bom: o porte não existe como dado na planilha — está na cabeça de
quem distribui. Qualquer corte que inventássemos (por valor, por duração) erraria
nos casos de fronteira, e o sistema estaria automatizando um palpite nosso em vez
de um processo real. Uma fila só, com um dono, é mais simples de construir e mais
fiel ao que acontece hoje.

Consequência para a tela: a triagem deixa de ter qualquer campo de porte, e a
fila "Aguardando definição" é sempre do Yuri. Definir inclui dizer quem vai
tocar a obra.

## DECISÃO B — resolvida em 01/09/2026

> "mantem as duas formas do diario"

O analista escolhe como responder: **uma obra por vez** (cartões) ou **lista
única** (estilo planilha). O seletor "Como responder" fica no alto do diário.

Já é o que está construído no mockup — nada muda.

Custo assumido, para constar: são dois caminhos de tela para manter e testar
para sempre, e toda mudança no diário precisa ser feita nos dois. O cliente
escolheu isso conscientemente nas duas vezes em que a pergunta apareceu (aqui e
na decisão A, sobre tabela e Kanban).

## Situação das decisões em 01/09/2026

| # | Assunto | Situação |
|---|---|---|
| A | Tabela ou Kanban na base | as duas |
| B | Formato do diário | as duas |
| C | Travar no 3º "não andou" | sem trava; motivo obrigatório |
| D | Quem define a obra que chega | o Yuri, e ele também direciona |
| E | O que perguntar às 9h | dissolvida — ciclo passou para 18h |
| F | Falta repetida vários dias | **aberta** — proposta no Painel do dia |
| G | Quem marca "faturado" | **aberta** — vai no mockup do ciclo de vida |
| H | Porte da obra | descartada |

**Nenhuma decisão em aberto trava a spec.** F e G são propostas dentro do
mockup, e o sistema funciona com o padrão adotado em cada uma até ele responder.

## DECISÃO F — resolvida em 01/09/2026

> "F — o aviso das 19h muda quando a falta se repete? — nao, so atualiza"

O aviso **não escala e não muda de forma**. Sai o mesmo todo dia às 19h, com o
número de dias seguidos dentro dele ("2º dia sem registro"), e o painel guarda a
contagem. Nada bloqueia, nada sobe sozinho para mais ninguém.

É a mesma linha da decisão C, um andar acima: o sistema **registra e mostra** em
vez de **forçar alguém a agir**. A falta repetida aparece como número que cresce,
não como cobrança que muda de tom. Era o padrão já adotado no mockup — confirmado
por ele, agora vira nota fechada na tela.

## Horário do agente de IA — confirmado em 01/09/2026

> "as 18h substituem as 9h para o agente de IA? isso, substitui"

**As 18h são o horário único do ciclo.** As 9h saem de vez, inclusive para a
segunda etapa com o agente de IA conversacional. Era a suposição que eu vinha
carregando desde a decisão E — agora é fato confirmado, não inferência.

## WhatsApp — decidido em 01/09/2026: sem API oficial

> "sobre os disparos de wpp faremos sem api oficial"

Provedor não oficial (Z-API, Evolution e similares): um número comum conectado
por QR code, sem Meta, sem verificação de empresa, sem template aprovado.

**O que isso ganha:** sai em dias, não em semanas; custo baixo; e — o que mais
importa para o agente cobrador — **conversa livre nos dois sentidos**, sem a
janela de 24h e sem template para iniciar. O agente fala com a Roberta quando
precisar, do jeito que precisar.

**O que isso custa, e é preciso dizer:** é uso fora dos termos do WhatsApp. O
número pode ser bloqueado, sem aviso e sem recurso. Se cair, os disparos param.

**Consequências práticas para a spec:**

1. **Número dedicado, nunca o pessoal de ninguém.** Um chip "Manfac Obras". Se o
   número for bloqueado, some o WhatsApp da empresa junto — e não pode ser o
   número que o cliente DPSP usa para falar com a Manfac.
2. **E-mail não é redundância, é rede de segurança.** Já estava decidido que os
   avisos vão pelos dois canais; agora isso deixa de ser conveniência e passa a
   ser o que mantém o sistema de pé no dia em que o número cair.
3. **O envio precisa registrar o que aconteceu** — enviado, entregue, falhou. Sem
   confirmação da plataforma, o log do nosso lado é a única evidência de que a
   cobrança saiu.
4. **Volume baixo ajuda.** São poucas mensagens por dia, para pessoas da própria
   empresa, que respondem — padrão de conversa real, que é justamente o que menos
   chama atenção dos mecanismos anti-spam.
