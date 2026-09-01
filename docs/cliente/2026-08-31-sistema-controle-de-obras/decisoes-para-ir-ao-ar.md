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
