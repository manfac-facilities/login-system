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

### Pergunta que isso abre — vira DECISÃO H

**O que separa obra grande de obra pequena?** Não foi dito, e o critério muda
quem recebe cada obra. Duas leituras possíveis, com base na planilha real:

- **Por valor:** as obras ativas vão de R$ 1.886 (portais do Copacabana 6) a
  R$ 68.134 (rollout de telhado do Alcântara 5). Um corte por valor é objetivo e
  o sistema aplica sozinho.
- **Por duração planejada:** de 2 a 22 dias. Também objetivo, e mais ligado ao
  esforço real de acompanhamento do que o valor.

Uma terceira saída é não automatizar: o Yuri olha e decide caso a caso, e o
sistema só registra. É a mais fiel ao que existe hoje e a que menos erra — o
custo é que o direcionamento continua dependendo de uma pessoa.
