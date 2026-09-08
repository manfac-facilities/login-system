# Manual do Controle de Obras

Guia de uso do **Controle de Obras**, o sistema que a Manfac usa para acompanhar cada
obra da DPSP do começo ao fim — da chegada do chamado até a obra faturada.

---

## 1. Para que serve este sistema

Hoje, quando uma obra para no meio do caminho — falta material, a equipe não conseguiu
entrar na loja, o cliente não aprovou a OS — a informação fica só com quem estava lá. Ela
não chega para quem cobra o material, para quem cobra a OS do cliente, nem para quem
precisa saber, na sexta-feira, quantas obras já foram executadas e ainda não viraram nota
fiscal. A planilha registra o status de hoje, mas não registra o que aconteceu ontem, nem
desde quando uma obra está parada num mesmo passo — e é assim que uma obra some por
semanas sem ninguém perceber.

O Controle de Obras existe para isso: todo dia, quem está com uma obra na mão responde
"andou ou não andou", e o sistema já sabe para quem mandar a cobrança quando faltar
alguma coisa — material, ferramenta, equipe, documento ou até a foto do avanço do dia. A
obra passa a ter uma linha do tempo, um dono visível em cada etapa e um contador de "há
quantos dias está parada aqui" — o número que, até hoje, só existia na planilha como um
status sem data.

---

## 2. Como entrar

O Controle de Obras é um dos sistemas do hub da Manfac (`hub.manfac.com.br`). Você entra
com o mesmo login que já usa para os outros sistemas do hub — não existe login separado
para o Controle de Obras.

1. Acesse `hub.manfac.com.br` e entre com seu e-mail `@manfac.com.br`.
2. Na tela inicial (o painel do hub), procure o card **Controle de Obras**.
3. Clique nele para entrar.

**Se você não vê o card "Controle de Obras" no painel**, é porque seu acesso a este
sistema ainda não foi liberado. Isso não é um erro seu — é uma permissão que alguém
precisa te dar. Fale com o administrador do hub para que ele libere seu acesso na tela de
administração de acessos. Enquanto isso não acontecer, o card não aparece e, mesmo que
você digite o endereço da tela direto no navegador, o sistema não deixa entrar.

---

## 3. O ciclo de vida da obra

Toda obra passa pelas mesmas etapas, sempre nesta ordem. Nem toda obra passa por todas —
por exemplo, se a OS do cliente já estava aprovada antes de a obra sair de campo, ela pula
direto de "Fechar OS" sem passar por "Pendente fechamento".

| # | Etapa | O que significa | Quem tipicamente move |
|---|---|---|---|
| 1 | **Aguardando definição** | A obra acabou de chegar do Field Control, com pouca informação (só o chamado, a loja e o tipo). Ainda não tem responsável, equipe nem cronograma definidos. | O time interno de obras faz a triagem (normalmente o Yuri) |
| 2 | **Levantamento** | A obra foi definida (tem responsável, equipe, prioridade, data de início e duração) e está sendo preparada antes de a equipe ir para a loja. | O responsável da obra (o PCM definido na triagem) |
| 3 | **Em andamento** | A equipe está na loja, executando o serviço. É aqui que o diário do dia passa a perguntar "andou hoje?". | A equipe em campo |
| 4 | **Paralisado** | A obra está em campo mas parada por algum motivo (clima, falta de material, equipe indisponível, etc.). Continua aparecendo no diário do dia. | O responsável da obra |
| 5 | **Relatório de entrega** | A execução terminou e falta o relatório que fecha a OS. **Aviso:** o sistema foi desenhado para preencher esta etapa sozinho quando a OS fechar no Field Control — mas essa integração ainda não existe nesta versão (ver seção 7). Na prática, alguém precisa mover a obra para cá manualmente, pelo seletor de etapa da ficha. | Equipe / responsável — hoje, manualmente |
| 6 | **Pendente fechamento** | O relatório está pronto, mas a OS ainda não foi aprovada no sistema do cliente (DPSP). Só existe quando a obra saiu de campo sem OS aprovada. | O cliente (analista da DPSP) |
| 7 | **Fechar OS** | A OS já está aprovada (ou já estava desde antes) e falta alguém encerrar formalmente. | O responsável da obra |
| 8 | **Pendente faturamento** | A OS foi fechada e falta o cliente liberar o faturamento. | O cliente (analista da DPSP) |
| 9 | **Faturado** | Fim de linha. A obra virou nota fiscal. | Financeiro Manfac |

As etapas são agrupadas em quatro **fases**, que é como a visão Kanban organiza a tela:
**Antes de executar** (1–2), **Executando** (3–4), **Fechamento** (5–7) e **Faturamento**
(8–9).

Uma obra sempre tem uma etapa. Não existe "obra sem etapa": ao chegar do Field, ela nasce
em "Aguardando definição".

---

## 4. Tela por tela

O sistema tem três abas no topo — **Diário do dia**, **Tarefas** e **Base de obras** — e
uma quarta tela, a **ficha da obra**, que se abre a partir de qualquer uma delas ao clicar
no nome de uma obra.

### 4.1 Base de obras

**Para que serve:** é a visão geral — todas as obras cadastradas, em qualquer etapa, com
filtros para encontrar o que você procura. É a tela que responde "quantas obras estão
paradas", "quais estão sem OS aprovada" e "quantas já foram executadas e ainda não
viraram dinheiro".

No topo da tela ficam oito números (indicadores): aguardando definição, em andamento,
paralisadas, executadas e ainda na esteira (fechamento/faturamento), sem OS aprovada,
sem cobertura, aprovadas há mais de 60 dias e obras que passaram da duração planejada.
**Esses números sempre contam a base inteira, nunca só o que está filtrado na tela** — se
você filtrar por uma etapa e o número não mudar, é assim de propósito: filtrar não pode
dar a impressão de que a operação parou.

A tela tem duas formas de olhar a mesma lista:

- **Tabela** — uma linha por obra, com todas as colunas (OS, loja, tipo, responsável,
  equipe, etapa, prioridade, com quem está a bola, dias parada nesta etapa, OS do
  cliente, bloqueio, dias desde a aprovação, prazo consumido, última atualização).
  Clicar no título de uma coluna ordena por ela; clicar de novo inverte a ordem. Por
  padrão, a lista vem ordenada pela obra com mais dias desde a aprovação primeiro. No
  celular a tabela vira uma lista de cartões, um por obra.
- **Kanban** — as obras em cartões, organizadas em quatro colunas por **fase** (não por
  etapa — nove colunas lado a lado ficariam ilegíveis). Dentro de cada coluna, a etapa
  exata de cada obra aparece como subtítulo.

**Passo a passo do uso normal:**

1. Abra a aba **Base de obras**.
2. Escolha Tabela ou Kanban no seletor no topo.
3. Use os filtros — **Responsável da obra**, **Etapa da obra**, **Autorização** (todas /
   com OS aprovada / sem OS aprovada / liberadas mas ainda sem OS / sem cobertura) e
   **Classificação** (todas / só mau uso / sem mau uso) — para restringir a lista.
4. Clique no nome da obra (na coluna Loja, ou no cartão) para abrir a ficha dela.

**O que as etiquetas e cores significam:**

- **Etiqueta da etapa** — uma cor por etapa (laranja para "aguardando definição", azul
  para as etapas de campo/relatório, verde para "em andamento", vermelho para
  "paralisado" e "pendente fechamento", amarelo para "fechar OS" e "pendente
  faturamento", cinza para "faturado").
- **Mau uso** — etiqueta cinza. Não é uma etapa: é uma classificação que anda junto com a
  etapa normal e significa que o dano foi causado por uso indevido do cliente (a Manfac
  conserta e cobra à parte).
- **Prioridade** — "Normal" em cinza, "Urgente" em laranja.
- **OS aprovada / sem OS aprovada** — verde quando o cliente já aprovou a OS no sistema
  dele, vermelho quando ainda não.
- **Liberado por [nome]** — etiqueta amarela. Aparece quando não há OS aprovada, mas
  alguém do cliente autorizou a execução mesmo assim.
- **Sem cobertura** — etiqueta vermelha, a de maior risco. Aparece quando a obra não tem
  OS aprovada **e** ninguém autorizou a execução: não existe documento nem nome de quem
  disse "pode fazer". É o número que motivou o projeto.
- **Contador de dias** (dias desde a aprovação) — fica vermelho quando a obra está aberta
  há 100 dias ou mais (o caso mais grave da base), amarelo quando passou muito da duração
  combinada ou já soma 60 dias ou mais, e cinza no resto.
- **Prazo consumido** ("dia N de M" com uma barrinha) — substitui o que a planilha chamava
  de "avanço físico". Não é o quanto do serviço já foi feito, e sim quanto do prazo
  combinado já passou. Quando não há duração planejada, a tela escreve "sem prazo
  definido" em vez de inventar um número.
- **Bloqueio** e a marcação de dias ao lado dele aparecem quando a obra está parada no
  mesmo bloqueio há 3 dias ou mais.
- Linhas com uma faixa vermelha à esquerda são obras críticas (100+ dias) ou sem
  cobertura — são as que pedem atenção primeiro.

### 4.2 Ficha da obra

**Para que serve:** é a tela de uma obra só, com tudo o que existe sobre ela — em que
etapa está, quem autorizou, os dados de identificação, o cronograma e o histórico do
diário. Abre a partir de qualquer lugar em que o nome da obra aparece (base, diário,
tarefas).

Os blocos aparecem sempre nesta ordem:

1. **Cabeçalho** — loja, nº da OS, tipo, valor e as etiquetas (etapa, mau uso,
   prioridade, OS, cobertura, dias).
2. **Caixa de alerta** (só aparece quando há algo a dizer) — obra crítica, obra executada
   e ainda não faturada, ou obra que passou do prazo planejado. Nunca aparece mais de uma
   ao mesmo tempo.
3. **Caixa de cobertura** — "Sem cobertura" (vermelha, quando não há OS nem liberação) ou
   "Sem OS aprovada" (quando falta só a OS, mas alguém liberou a execução).
4. **Ciclo de vida da obra** — mostra a etapa atual, quem está com a bola, o prazo (ou há
   quantos dias está parada, se já saiu de campo) e o caminho que ela vai seguir (direto,
   ou com o desvio para "Pendente fechamento"). Logo abaixo vem a lista com todas as
   etapas da esteira pós-campo, marcando o que já foi feito, o que está em curso e o que
   ainda não chegou.
5. **Autorização** — os dois destravamentos, lado a lado: se alguém **liberou** a
   execução (e quem foi, e quando) e se a **OS do cliente** já foi aprovada. Os dois são
   independentes um do outro:
   - **OS aprovada** é a aprovação formal, no sistema da DPSP — quando ela existe, é ela
     sozinha que autoriza o trabalho, não precisa de mais nada.
   - **Liberado por** é o registro de que um analista do cliente deu o "pode fazer" antes
     de a OS sair, para a equipe não ficar esperando o processo formal. Pode existir uma
     coisa sem a outra: uma obra pode ter OS aprovada sem nunca ter sido "liberada" (ela
     não precisou), ou pode ter sido liberada e, dias depois, ainda estar sem a OS
     aprovada — e é esse segundo caso que o sistema mede em "dias sem OS", contados a
     partir da data da liberação.
   - Quando **nenhuma das duas** existe, a obra está "sem cobertura" — o estado de maior
     risco.
6. **Identificação** — nº da OS, loja, chamado, tipo, classificação (se for mau uso),
   prioridade, valor, analista do cliente, responsável da obra, equipe/prestador, origem
   e o bloqueio atual.
7. **Cronograma** — início planejado, início real, duração e a data final, que o sistema
   calcula sozinho (início + duração) — ninguém digita data de término.
8. **Remarcações** — o histórico de mudanças de data de início, quando existir (só
   leitura; vem da importação da planilha).
9. **Evolução em fotos** — as fotos anexadas nos últimos dias do diário, em miniatura, só
   para obras em execução (etapas "Em andamento" e "Paralisado").
10. **Linha do tempo do diário** — todo dia respondido, se andou ou não e por quê. É só
    leitura aqui — quem registra é a tela de Diário do dia.
11. **Tarefas que as faltas geraram** — as cobranças abertas a partir das respostas do
    diário desta obra, com a situação de cada uma.
12. **Pendências e próxima ação** — um texto livre com o que falta fazer, o responsável e
    o prazo.
13. **Vindo do Field** — dois avisos fixos explicando que o relatório fotográfico e o
    relatório de entrega (PDF) virão automaticamente do Field Control quando essa
    integração existir; hoje é só um espaço reservado.

**Como trocar a etapa da obra:** no fim do bloco "Ciclo de vida da obra" há um seletor com
as nove etapas. Escolha a nova etapa e clique em "Confirmar mudança". Qualquer pessoa com
acesso ao Controle de Obras pode fazer essa troca — não existe hoje uma trava por função
(o sistema não decide quem "pode" mover cada etapa). Ao confirmar, fica registrado quem
mudou e quando, e o contador de "dias parada nesta etapa" recomeça do zero.

### 4.3 Triagem

A Triagem não é uma tela separada: é o que a ficha da obra mostra automaticamente
**quando a etapa é "Aguardando definição"**. Não existe uma aba "Triagem" nem um endereço
próprio — você chega nela abrindo a obra pela base ou por um link.

**Para que serve:** obra que chega do Field vem só com o básico (chamado, loja, tipo,
valor às vezes). Antes de entrar na rotina do diário, alguém precisa decidir quem vai
tocar a obra, com qual equipe, com que prioridade e quando ela começa.

**Os 5 campos obrigatórios**, na ordem em que aparecem na tela:

1. Responsável da obra
2. Equipe / prestador
3. Prioridade
4. Data de início
5. Duração em dias

Enquanto os cinco não estiverem preenchidos, o botão **"Liberar para o diário do dia"**
fica desabilitado e a obra não aparece para ninguém responder no diário.

Há também dois campos **opcionais**, fora desse checklist: **Liberado por** (o analista da
DPSP que autorizou a execução antes da OS sair) e **Data da liberação**. Eles ficam de
fora de propósito — se a obra já tem OS aprovada, não precisa de liberação nenhuma, e
obrigar o preenchimento faria alguém inventar um nome só para destravar a tela.

**O que acontece depois de triada:** ao clicar em "Liberar para o diário do dia", a obra
muda para a etapa **Levantamento**, o contador de dias na etapa zera, e o sistema já
preenche uma pendência padrão ("Finalizar levantamento, confirmar material e programar a
equipe") com o responsável escolhido. A partir daí a obra some da triagem e passa a
aparecer na base normalmente — e, quando chegar em "Em andamento" ou "Paralisado", passa
a aparecer no diário do dia de quem foi definido como responsável.

Se duas pessoas tentarem liberar a mesma obra ao mesmo tempo, só a primeira consegue; a
segunda recebe o aviso "Esta obra já foi liberada por outra pessoa" e precisa recarregar a
página.

### 4.4 Diário do dia

**Para que serve:** é a tela que sustenta o sistema — todo dia, cada pessoa responsável
por obras em campo diz, obra por obra, se andou ou não.

**De quem é a fila:** você só vê, no seu diário, as obras em que **você** é o responsável
cadastrado (o campo "Responsável da obra"/PCM da obra) — e só as que estão em
"Levantamento", "Em andamento" ou "Paralisado". Obra "Aguardando definição" nunca aparece
aqui: sem responsável, sem equipe e sem cronograma, não há o que responder. O
administrador do hub vê o diário de todo mundo, com um seletor para escolher de quem
quer ver.

**Passo a passo do uso normal**, um cartão por vez:

1. Abra a aba **Diário do dia**. As obras pendentes de hoje aparecem em cartões, a mais
   parada (mais dias desde a aprovação) primeiro.
2. Em cada cartão, responda **"Andou hoje?"** — Sim ou Não. É a única pergunta
   obrigatória.
3. Responda **"Faltou algum item?"** — Não faltou, Material, Ferramenta, Equipe,
   Documento / ART ou Outro.
4. Se você marcou "Não" em "Andou hoje?", aparece a pergunta **"Por que não andou?"**,
   com os motivos de bloqueio (Clima, Cliente/loja, Disponibilidade de equipe, Contratação
   de prestador, Falta de material, Sem bloqueio). **Essa é a única resposta obrigatória
   além do "Andou hoje?"** — o motivo é exigido sempre que a resposta for "Não". Nada
   mais impede salvar: nem o item que faltou, nem a observação, nem a foto.
5. Se quiser, clique em **"+ observação"** para escrever uma linha livre.
6. Nas obras em execução ("Em andamento" ou "Paralisado"), aparece o botão **"+ anexar
   foto do dia"**. A foto é reduzida no próprio celular antes de subir, para não travar
   com sinal fraco. Anexar a foto **não é obrigatório** — mas, se ela não vier, o sistema
   abre sozinho uma tarefa cobrando a foto da equipe da obra.
7. Clique em **"Salvar e sair da fila"**. Antes de clicar, o texto ao lado do botão já
   avisa o que vai acontecer — inclusive para quem vai a cobrança, se alguma coisa
   faltou.

**O que muda depois de salvar:** a obra sai da fila de pendentes e desce para a lista "Já
respondidas", com um resumo do que foi dito. **Só existe um registro por obra por dia** —
se você salvar de novo para a mesma obra no mesmo dia, o sistema **corrige** a resposta
anterior, não cria uma segunda. Se você errou, use o botão **"Desfazer"** na lista de "Já
respondidas": ele apaga a resposta de hoje e devolve a obra para a fila (as tarefas que
essa resposta abriu e que ainda não foram respondidas também são apagadas junto; uma
tarefa já respondida por outra pessoa fica, porque apagá-la apagaria o trabalho dela).

Quando todas as obras do dia forem respondidas, a tela mostra um resumo: quantas
obras andaram, quantas não andaram e quantas estão paradas há 3 dias ou mais sem andar.

**Os contadores se atualizam sozinhos.** "Dias seguidos sem andar" e "dias no mesmo
bloqueio", que aparecem nos cartões e na base, são recalculados toda vez que alguém
responde o diário — e também quando alguém desfaz uma resposta. Responder "andou" zera os
dois. Como a conta é feita sobre os registros, e não sobre o calendário, o fim de semana
sem registro não quebra a sequência de uma obra que está parada desde quinta.

### 4.5 Tarefas

**Para que serve:** é o quadro de cobranças que nascem sozinhas do diário. **Ninguém
digita uma tarefa aqui** — toda linha desta tela nasceu no instante em que alguém salvou o
diário do dia e algo faltou (ou a foto não veio).

**De onde elas nascem e para quem vão:**

| Faltou | Vai para |
|---|---|
| Material | Compras (Roberta) |
| Ferramenta | Obras (Yuri) |
| Equipe | Obras (Yuri) |
| Documento / ART | Obras (Yuri) |
| Outro | Obras (Yuri) |
| Foto do dia (não veio) | A equipe em campo da própria obra |

"Ferramenta" e "Equipe" vão para o Yuri mesmo quando a obra é de outro analista, porque é
ele quem remaneja ferramenta e equipe entre obras.

**Prazo:** por padrão, até o fim do dia em que a falta foi registrada. Se o diário for
respondido depois das 18h, o prazo já nasce para o dia seguinte — senão a tarefa nasceria
vencida no mesmo minuto.

**O que é uma tarefa vencida:** é qualquer tarefa que ainda não foi respondida e cujo
prazo já passou. Essa situação **nunca é digitada** — o sistema calcula na hora, comparando
o prazo com a data de hoje. Ela aparece em vermelho e em primeiro lugar na lista de quem
está com ela na mão. **Nesta versão, uma tarefa vencida não avisa ninguém sozinha** — ela
só fica visível para quem entrar na tela (ver seção 7).

**Como responder:** dentro do grupo de cada pessoa, clique em "Marcar como respondida",
escreva em uma linha o que foi feito e confirme. A tarefa sai da lista de abertas e entra
em "Respondidas", com a data, a hora e o resumo.

### 4.6 Importar planilha

**Quem usa:** só administradores do hub. Quem não é administrador, ao abrir a tela, vê o
aviso de que precisa pedir a alguém com esse acesso.

**Para que serve:** é a carga inicial (e as recargas seguintes) da base de obras a partir
da planilha de controle que a Manfac já usa. A planilha tem duas abas, e as duas entram
juntas: a aba **Pipeline DPSP** cria as obras (é a base inteira, todos os chamados), e a
aba **Planejamento DPSP** completa as que já estão em campo com o detalhe operacional
(bloqueio, pendência, cronograma). Importar só uma das duas deixaria a base incompleta.

**Passo a passo:**

1. Abra a aba **Importar** (só visível para administradores).
2. Escolha o arquivo `.xlsx` da planilha.
3. Clique em **Importar** e aguarde — a tela avisa para não fechar a página enquanto
   importa.

**O que o relatório de importação mostra:** ao final, aparecem cinco números — quantas
linhas foram lidas em cada aba, quantas obras foram criadas, quantas foram atualizadas e
quantas linhas foram descartadas — seguidos de uma lista com **cada linha descartada, a
aba de origem e o motivo**.

**O que significa uma linha descartada:** a linha não virou obra no sistema. Os motivos
mais comuns são faltar o número da OS e a loja ao mesmo tempo (não dá para saber de qual
obra se trata), ou o número da OS já ter aparecido em outra linha da mesma aba (a segunda
ocorrência é descartada e a primeira prevalece). **Nenhuma linha é ignorada em silêncio**
— é assim de propósito, para não esconder uma obra que o cliente acredita que já está no
sistema.

A importação pode ser rodada de novo com segurança: uma obra que já existe (identificada
pelo número da OS) é **atualizada**, nunca duplicada. E atualizar não apaga o que foi
digitado aqui dentro — a planilha preenche o que está vazio e corrige o que ela realmente
tem, mas não desfaz a triagem nem devolve para trás a etapa que alguém moveu na tela.

---

## 5. Rotina do dia a dia

**Analista de obras / PCM (quem tem obras sob sua responsabilidade):**

- **De manhã:** abra o **Diário do dia** e responda cada obra da sua fila — andou ou não,
  o que faltou, se for o caso a foto do dia. É a tarefa mais importante do dia, porque é
  dela que nascem as cobranças automáticas.
- **Ao longo do dia:** acompanhe suas **Tarefas** — as que vieram do seu próprio diário
  (ferramenta, equipe, documento) e responda assim que resolver.
- **Quando uma obra nova chegar** ("Aguardando definição"): entre na ficha dela e faça a
  **Triagem** — defina responsável, equipe, prioridade, data de início e duração para ela
  entrar na rotina do diário.
- **Quando precisar mudar a etapa de uma obra** (ela saiu de campo, o cliente aprovou a
  OS, etc.): abra a ficha e use o seletor de etapa.

**Yuri (quem cuida da triagem e das tarefas de Obras):**

- Confira todo dia se chegou obra nova "Aguardando definição" na **Base de obras** e faça
  a triagem dela.
- Acompanhe as **Tarefas** do grupo "Obras" — é para lá que vão ferramenta, equipe,
  documento/ART e "outro", de qualquer analista.

**Administrador do hub:**

- Libera o acesso de cada pessoa ao Controle de Obras (sem isso, a pessoa não vê o card
  no painel nem entra no sistema).
- É quem roda a **Importação da planilha**, na carga inicial e sempre que precisar
  atualizar a base a partir da planilha.
- No Diário do dia, pode ver e responder pelo diário de qualquer analista, usando o
  seletor "Diário de quem".

---

## 6. Quando algo dá errado

| O que você vê | O que significa | O que fazer |
|---|---|---|
| Uma mensagem vermelha ao tentar salvar (ex.: "Erro ao salvar o diário", "Erro ao mudar a etapa da obra") | Algo falhou ao gravar no servidor — pode ser conexão, ou uma permissão que falta. **O que já estava salvo antes continua salvo.** | Tente de novo. Se continuar acontecendo, avise o administrador. |
| O botão de salvar/liberar continua desabilitado, ou aparece "Diga por que não andou" / "Preencha os cinco campos antes de liberar" | Um campo obrigatório está vazio — no diário, o motivo de "não andou"; na triagem, um dos cinco campos do checklist. | Preencha o campo indicado. O sistema não deixa avançar sem ele de propósito — é o que garante que ninguém invente um motivo depois. |
| A obra não aparece mais para responder hoje, mesmo achando que não respondeu | Alguém (ou você mesmo, em outra aba) já registrou o diário dessa obra hoje. Só existe um registro por obra por dia. | Procure a obra em "Já respondidas", no fim da tela do Diário. Se a resposta estiver errada, use "Desfazer" e responda de novo. |
| "Não deu para enviar a foto. Dá para salvar sem ela." | O upload da foto falhou (sinal fraco, arquivo grande, conexão instável). | Pode salvar o diário mesmo assim — a foto não trava o salvamento. Sem ela, o sistema abre sozinho uma tarefa cobrando a foto da equipe. |
| Uma obra que eu esperava responder não aparece no meu Diário do dia | O diário mostra só as obras em que **você** é o "Responsável da obra" (o campo PCM). Se a obra está com o nome de outra pessoa, ou esse campo está vazio, ela não entra na sua fila. | Confira, na ficha da obra, quem está em "Responsável da obra". Se estiver errado, é preciso corrigi-lo (na triagem, se a obra ainda não foi liberada) ou pedir ao administrador para ajustar o cadastro. |
| Não vejo o card "Controle de Obras" no painel do hub | Seu acesso a este sistema ainda não foi liberado. | Peça ao administrador do hub para liberar seu acesso ao Controle de Obras. |
| "Esta obra já foi liberada por outra pessoa. Recarregue a página." | Duas pessoas tentaram liberar a mesma obra na Triagem ao mesmo tempo; só a primeira valeu. | Recarregue a página — a obra já está liberada e seguiu para "Levantamento". |
| A tela inteira mostra "Não deu para carregar..." | A lista não chegou do servidor (instabilidade momentânea). | Nada do que já foi salvo se perde. Clique em "Tentar de novo"; se persistir, avise o suporte. |

---

## 7. O que esta versão ainda NÃO faz

Esta é a primeira versão do sistema, entregue para o treinamento. De propósito, ela ainda
não inclui:

- **Cobrança automática por WhatsApp.** Hoje, quem precisa resolver uma tarefa (Compras,
  Yuri, a equipe em campo) só vê a cobrança se entrar na tela de Tarefas. Não existe
  mensagem automática avisando.
- **Avisos automáticos no fim do dia** (a ideia de um lembrete perto das 18h/19h para
  quem ainda não respondeu o diário). Hoje não há esse lembrete — quem esquecer de
  responder só percebe ao abrir o sistema de novo.
- **Integração automática com o Field Control.** As obras novas ainda chegam por
  importação de planilha, não sozinhas; e etapas como "Relatório de entrega" precisam ser
  movidas manualmente pelo seletor, porque o sistema ainda não recebe automaticamente a
  informação de que a OS fechou no Field.
- **Um painel de reunião** (uma tela pensada para acompanhar tudo em uma reunião do dia,
  em vez de abrir obra por obra).
- **Entrada automática pelo Field Control.** Nesta versão, toda obra entra pela
  importação da planilha. A ligação direta com o Field, que traz o número da OS, a loja e
  a descrição do chamado sozinha, é a próxima frente.

Essas frentes estão previstas para depois, sem data ainda definida. É importante ter isso
em mente no treinamento: sem a cobrança automática, o hábito de preencher o diário todo
dia depende, por enquanto, da equipe mesmo — o sistema ainda não empurra sozinho.

---

## 8. Glossário

- **OS (Ordem de Serviço)** — o número que identifica o chamado da obra. É o mesmo número
  que precisa ser aprovado no sistema do cliente (DPSP) para liberar o fechamento e o
  faturamento.
- **PCM / Responsável da obra** — a pessoa da Manfac responsável por tocar aquela obra.
  É por esse nome que o Diário do dia decide de quem é cada obra.
- **Triagem** — o preenchimento dos dados que faltam numa obra recém-chegada (responsável,
  equipe, prioridade, início, duração) antes de ela entrar na rotina do diário.
- **Etapa** — cada um dos nove passos do ciclo de vida da obra, de "Aguardando definição"
  até "Faturado".
- **Bloqueio** — o motivo pelo qual uma obra não andou num dia (clima, cliente/loja,
  disponibilidade de equipe, contratação de prestador, falta de material, ou "sem
  bloqueio").
- **Mau uso** — uma classificação, não uma etapa: dano causado por uso indevido do
  cliente, que a Manfac conserta e cobra à parte. A obra segue o mesmo ciclo de vida das
  outras.
- **Sem cobertura** — a obra está sendo (ou foi) executada sem OS aprovada pelo cliente e
  sem ninguém nomeado que tenha autorizado a execução. É o estado de maior risco: não há
  documento nem nome a quem recorrer se algo der errado.
- **Pendente fechamento** — a etapa em que o relatório da obra já está pronto, mas a OS
  ainda não foi aprovada pelo cliente; só quem destrava é o próprio cliente.
- **Avanço %** — termo que a planilha usava e que **este sistema não tem**. No lugar dele,
  o sistema mostra "prazo consumido" (por exemplo, "dia 12 de 20"), que mede quanto do
  prazo combinado já passou — não quanto do serviço já foi feito fisicamente.

---

## Verificação — não faz parte do manual

Cada linha abaixo aponta o arquivo e o trecho de código de onde a regra descrita no manual
foi tirada.

1. `app/obras/_lib/tipos.ts:146-156` — a lista `CICLO`, com os nove nomes exatos das
   etapas, a fase e o "dono" de cada uma, usada na seção 3.
2. `app/obras/_lib/tipos.ts:127-132` — os quatro nomes de fase (`FASES`) e o agrupamento
   de etapas por fase usado no Kanban.
3. `app/obras/_lib/tipos.ts:475-477` (`semCobertura`) — obra "sem cobertura" é
   `!os_aprovada && !liberado_por && etapa !== 'definir' && !encerrada`.
4. `app/obras/_lib/tipos.ts:471-473` (`liberada`) — "liberada" é `!!liberado_por`.
5. `app/obras/_lib/tipos.ts:426-428` (`critico`) — obra crítica: etapa diferente de
   "definir", não encerrada, e 100 dias ou mais desde a aprovação.
6. `app/obras/_lib/tipos.ts:443-450` (`travado`) — "travada no bloqueio" exige
   `bloqueada_dias >= 3` e bloqueio diferente de nulo e de "Sem bloqueio".
7. `app/obras/_lib/tipos.ts:457-459` (`encalhada`) — obra fora de campo, não encerrada,
   parada 15 dias ou mais na etapa atual.
8. `app/obras/_lib/tipos.ts:363-366` (`pedeFoto`) — só pede foto quando a fase é "campo"
   (etapas "Em andamento" e "Paralisado"); "Levantamento" não pede foto, apesar de estar
   "antes de campo".
9. `app/obras/obra/[id]/_actions.ts:126-136` (`liberarObraAction`) — os cinco campos
   obrigatórios da triagem são revalidados no servidor, não só travados na tela.
10. `app/obras/obra/[id]/_actions.ts:139-153` — "Liberado por" e "Data da liberação" são
    opcionais e andam juntos (sem nome, a data não é gravada); ao liberar, a etapa vira
    `'levantamento'` e uma pendência padrão é preenchida.
11. `app/obras/obra/[id]/_actions.ts:161-171` — a checagem de "0 linhas afetadas" detecta
    quando outra pessoa já liberou a mesma obra entre o carregamento da tela e o clique.
12. `app/obras/obra/[id]/_etapa.tsx` e `app/obras/obra/[id]/_actions.ts:59-93`
    (`mudarEtapaAction`) — a troca de etapa é manual, sem trava por papel/função, e
    registra quem mudou e quando.
13. `app/obras/obra/[id]/_ficha.tsx:213-220` — o texto que diz que "Relatório de entrega"
    é deduzido automaticamente do fechamento da OS no Field Control (usado para embasar o
    aviso de que essa automação não existe ainda nesta v0 — não há integração com o Field
    em nenhum arquivo deste módulo).
14. `app/obras/diario/_cartao.tsx:46-50` (`validar`) — a única trava de salvamento do
    diário é motivo obrigatório quando "andou" é "Não".
15. `sdd-sql-obras-v0.sql:142-144` — `unique (obra_id, data)` e o check
    `andou or (motivo is not null and motivo <> '')` no banco, reforçando a regra 14.
16. `app/obras/diario/_actions.ts:90-102` (`salvarDiarioAction`) — salvar de novo no
    mesmo dia é um `upsert` (corrige a resposta), não gera erro de duplicata.
17. `app/obras/diario/page.tsx:31` (`ETAPAS_FILA`) — a fila do diário só inclui
    "Levantamento", "Em andamento" e "Paralisado"; "Aguardando definição" fica fora.
18. `app/obras/diario/page.tsx:60` e `:47-59` — cada analista vê só as obras em que é o
    `pcm`; administrador vê todas com seletor; sem chave resolvida, o não-admin não entra.
19. `app/obras/diario/_pessoa.ts:40-76` (`resolverChave`, `chaveDoUsuario`) — a ligação
    entre a conta do hub e a "chave" da pessoa é primeiro por `obras_pessoa.email`
    cadastrado e, na falta dele, por convenção a partir do e-mail (antes do primeiro
    ponto/traço/underscore no local-part, maiúsculo, sem acento).
20. `app/obras/diario/_actions.ts:149-151` (`abrirTarefas`) — a foto que não veio numa
    obra "em campo" abre uma tarefa extra ("Foto") para a equipe da obra.
21. `app/obras/_lib/tipos.ts:580-589` (`ROTA_FALTA`) — a tabela de roteamento de cada
    tipo de falta para o dono correspondente, usada na seção 4.5.
22. `app/obras/_lib/tipos.ts:620-623` (`prazoPadrao`) — depois das 18h, o prazo da tarefa
    vai para o dia seguinte (soma 1 dia corrido, não dia útil, apesar do comentário do
    código mencionar "dia útil").
23. `app/obras/_lib/tipos.ts:630-638` (`sitTarefa`) — "vencida" nunca é gravada; é
    calculada comparando o prazo com a data de hoje toda vez que a tela renderiza.
24. `app/obras/importar/page.tsx:16` e `app/obras/importar/_actions.ts:60-63` — a tela e
    a Server Action de importação exigem `isAdmin`, não apenas acesso ao módulo.
25. `app/obras/_lib/importacao.ts:611` e `:622-625` — os dois motivos de descarte mais
    comuns: "sem Nº OS e sem Loja" e "Nº OS repetido" (a segunda ocorrência é descartada).
26. `app/obras/importar/_actions.ts:146-153` — obra sem número de OS só é aceita na
    primeira carga (base vazia); nas cargas seguintes, uma linha sem OS é descartada.
27. `app/obras/base/_regras.ts:249-256` (comentário de `kpisDaBase`) e
    `app/obras/base/page.tsx:38-44` — os indicadores da Base sempre somam a base inteira
    (`todas`), nunca a lista já filtrada.
28. `app/obras/base/_kanban.tsx:6-9` — o Kanban agrupa as colunas por fase, não por
    etapa, de propósito.
29. `app/obras/diario/_foto.tsx:24-50` — a foto é reduzida no próprio aparelho (até 1600px
    de lado, qualidade 0,82) antes do upload, e sobe para o Storage antes de o diário ser
    gravado.
30. `app/obras/base/page.tsx:28` e `app/obras/obra/[id]/page.tsx:73` — cada tela do módulo
    confere `hasSystemAccess(..., 'obras')` e mostra "Esta tela é de quem é responsável
    pelas obras" para quem não tem acesso.
31. `app/(dashboard)/dashboard/page.tsx:137-148` — o card "Controle de Obras" só é
    renderizado quando `podeObras` (ou administrador) é verdadeiro.
32. `app/obras/diario/_cartoes.tsx:180-211` (`Sucesso`) — o resumo de fim de dia mostra
    quantas obras andaram, não andaram e quantas têm `nao_andou_seguidos >= 3`.
33. `app/obras/_lib/tipos.ts` (tipo `ObraRow`) comparado com
    `app/obras/_lib/importacao.ts:375-399` (tipo `ObraCampos`) e com todas as Server
    Actions do módulo (`diario/_actions.ts`, `obra/[id]/_actions.ts`,
    `importar/_actions.ts`) — **nenhum código deste v0 escreve nos campos
    `nao_andou_seguidos` e `bloqueada_dias`** fora da carga inicial da planilha (que
    também não os mapeia, então nascem em 0 por padrão do banco,
    `sdd-sql-obras-v0.sql:106-107`). Usados no manual para justificar o aviso da seção 4.4
    e o item da seção 7.
34. Busca por `cadastr|nova obra|criarObra` em `app/obras/**` e por rotas em
    `middleware.ts`/`app/(dashboard)/dashboard/page.tsx` — **não existe nenhuma tela nem
    Server Action de cadastro manual de obra nesta entrega**, apesar de
    `docs/cliente/2026-08-31-sistema-controle-de-obras/spec-v0-treinamento.md` (seção 1)
    listar "Cadastro manual de obra" como item do escopo da v0. Por isso o manual não
    documenta essa tela — documentá-la seria inventar uma tela que não existe no código
    entregue. **Resolvido em 08/09/2026: não ficou de fora por engano nem foi cortado —
    nunca foi requisito.** O cliente esclareceu que a obra vem sempre do Field Control;
    "manual", na fala dele, era o preenchimento dos campos, não a criação da obra. O item
    saiu da spec. Ver `feedback-07-obra-vem-sempre-do-field.md`.
35. `app/obras/tarefas/_lista.tsx:150-155` — o texto "Ferramenta e equipe vão para o Yuri
    mesmo quando a obra é de outro analista" é o texto literal da tela, usado na seção
    4.5.
