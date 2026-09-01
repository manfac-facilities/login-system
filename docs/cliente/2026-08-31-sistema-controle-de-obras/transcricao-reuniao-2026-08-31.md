# Transcrição da reunião — José Guilherme Oliveira × João Victor (Costinha)

Colada pelo João no chat em 31/08/2026. **Texto literal, sem edição.**
Nota: a transcrição automática troca falantes em vários trechos (o rótulo nem sempre
corresponde a quem fala) e grafa "Cloud" para Claude, "ZIV"/"Ziv" para Zeev,
"fio de control" para Field Control, "cópia" para copy, "opt-in/opt-out" para
entrada/saída de informação.

---

José Guilherme Oliveira [00:00]: Bom, oligo, tô vendo minha tela, né? Tá vendo?

joao victor (costinha) [00:08]: Sim.

José Guilherme Oliveira [00:12]: Bom, eu anotei aqui algumas coisas, tá? Fui anotando por área. E aí aqui, na verdade, é mais uma ideia e tal do que fazer. Tá? Na real, mano, a minha ideia é tipo assim, desde o início eu tava pensando em usar aquela empresa IA do Natan como se fosse pra Manfac, entendeu? Como se fosse pra minha empresa aqui pra Manfac.

joao victor (costinha) [00:44]: Aham. Entendeu? Só que pelo que eu... Eu não olhei ainda com calma, mas assim, pelo que eu entendi ali, não é bem essa a proposta, tá ligado? A proposta dele é gerar um site que todo mundo usa e paga uma merca pra ele. Não, não é não.

José Guilherme Oliveira [01:01]: É... A proposta dele não é tipo assim, ah, um agente de IA do financeiro. O agente de IA não é uma parada específica, entendeu?

joao victor (costinha) [01:11]: Ele é bem genericão. Então, mas é o que ele falou lá. Ele faz genérico pra gente personalizar. É, eu sei.

José Guilherme Oliveira [01:25]: Então assim, é... A ideia é essa. A ideia, na verdade... Desde o início, na verdade, eu tava com essa ideia, né? Por isso que eu falei, pô, vamos criar um hub.

joao victor (costinha) [01:36]: É... Pra deixar, tipo, as paradas todas lá e tal. É... Então é isso, assim. Essa daqui é a ideia. Então, por exemplo, no financeiro. É... Tarefas que a gente precisa executar.

José Guilherme Oliveira [01:50]: Por exemplo, tipo, hoje eu tô sem ninguém lá no financeiro, né? A pessoa saiu e tal, tô tentando contratar alguém.

joao victor (costinha) [01:56]: Aí, porra, o que que acontece? Eu não consigo lançar o que tem pra pagar no sistema, né? Porque eu não tenho tempo de parar e ficar lá lançando no sistema.

José Guilherme Oliveira [02:06]: E aí, ao mesmo tempo, quando eu pago, eu não consigo fazer a conciliação bancária, porque não tá lançado no sistema. Então, não tem como botar lá que eu paguei, entendeu?

joao victor (costinha) [02:16]: Uhum.

José Guilherme Oliveira [02:16]: E aí, no final disso tudo, o resultado financeiro da empresa fica errado.

joao victor (costinha) [02:21]: Sim.

José Guilherme Oliveira [02:22]: Entendeu? Então, assim, tem várias paradas aqui pra fazer. É... Acho que a ideia aqui é a gente entender o que que... O que que traz mais benefício e mais rápido. É... Na minha visão, é essa parte aqui de controle operacional. E aqui, tipo, é um ganho absurdo, porque hoje eu tenho uma pessoa contratada que faz isso aqui e faz muito mal, por sinal, entendeu? Então, tipo, além da gente ter uma parada que teria uma... Que a gente teria uma visão melhor, né? Com dashboard, indicador e tal, a gente... Se a gente conseguisse já de cara implantar aqui um agente de IA, a gente já inclusive demitiria essa pessoa. Entendeu?

joao victor (costinha) [03:06]: Entendi. É, é isso que eu ia falar, mano. Vamos pegar essas áreas aí e atacar uma área por vez, sabe?

José Guilherme Oliveira [03:15]: Então, aí aqui, assim...

joao victor (costinha) [03:16]: O caso aí são três sistemas de controle de obras?

José Guilherme Oliveira [03:21]: Não. É um só. É... Mas, assim, o que que acontece, pra eu te explicar? A gente presta serviço de engenharia, né? Aí a gente tem um braço que é a manutenção predial e outro braço que é obras, entendeu? Mas é a mesma empresa.

joao victor (costinha) [03:36]: Sim.

José Guilherme Oliveira [03:38]: Só que os tipos de controle são diferentes. E aí, aqui na manutenção predial, por exemplo, é o dashboard que eu tô montando lá.

joao victor (costinha) [03:47]: É, que eu tô montando aqui, que tá aqui no Hub, ó.

José Guilherme Oliveira [03:51]: Que, porra, tá dando um trabalho fodido. Eu achei que ia ser moleza. Caralho, uma puta trabalheira aqui que tá dando.

joao victor (costinha) [03:58]: Por que que tá dando trabalho? Em que momento?

José Guilherme Oliveira [04:01]: Ah, porque é API e aí eu comecei... Esse foi o projeto que eu comecei, né? No Cloud.

joao victor (costinha) [04:08]: Lembra que eu comecei a usar? Aham. Então... Então... E aí... É...

José Guilherme Oliveira [04:14]: O Cloud tava usando o Soné. E aí depois eu vendo o curso e tal, e até nas dúvidas com o Nathan, ele falou, cara, o Soné é muito ruim. É... Ele não serve pra fazer parada boa e tal, é mais coisa de dia a dia. Aí... É... Quando eu mudei pro Opus, aí ele começou a mudar a porra toda, entendeu? Começou a pegar um monte de erro, uma porrada de coisa, aí ele começou a mudar a porra toda. Então, agora eu tô na etapa de pegar isso daqui, eu pedi pra ele melhorar os indicadores, tá vendo? Ele já botou aqui, ó. Não tinha isso aqui. Entendeu? Aí não tinha esses status aqui. O ranking de produtividade aqui tava uma merda, não tava bem feito. Entendeu?

joao victor (costinha) [05:07]: Entendi.

José Guilherme Oliveira [05:09]: E aí várias coisas, tá vendo? Algumas coisas ainda tão meio bugadinha aqui e tem que ir ajustando.

joao victor (costinha) [05:15]: Esse aí é o... É o que você quer atacar agora, né?

José Guilherme Oliveira [05:21]: Não, esse aqui é meio que o que eu já tô fazendo, né? O que a gente precisa atacar é a parte de manutenção. Aliás, de obras, né? Essa daqui é a parte de manutenção. E aí o que que acontece pra tu entender toda a estrutura? Você precisa entender todo o processo, senão não vai ficar bem feito. Esse sistema aqui é um sistema de gestão de ordem de serviço, né? O foco dele é manutenção, né? Só que a gente vai usar esse sistema também para controle de obras. Por quê? Porque ele é um sistema de ordem de serviço e o técnico consegue ir lá no aplicativo, né? Preencher o formulário dele. Quer ver? Deixa eu achar um exemplo aqui. Ó, por exemplo.

joao victor (costinha) [06:24]: Essa aqui foi feita hoje, tá vendo?

José Guilherme Oliveira [06:31]: Então, tipo, o técnico preencheu aqui as informações, aqui a descrição que o meu time preencheu, né? Aí o técnico veio aqui e respondeu aqui um relatório. Inclusive respondeu o relatório errado.

joao victor (costinha) [06:47]: Mas enfim, respondeu o relatório aqui do que foi feito, tá?

José Guilherme Oliveira [06:58]: E aí esse daqui é uma obra, por exemplo, né? Então, qual é a ideia atual? Além disso, a gente tem o Ziv, que é esse aplicativo aqui, que inclusive eu quero deixar de usar ele com o tempo, né? Esse aplicativo eu contratei em dezembro. Ele é bem maneiro, assim. Ele é de...

joao victor (costinha) [07:22]: Ele é um BPMN, tá ligado? Sabe o que é isso? É... Basicamente cuida de encargos que foram, né? Faz reembolso.

José Guilherme Oliveira [07:32]: Não. Ele... É... Ele é um aplicativo de modelagem de processos, mas ele não é só modelagem, né? Ele... Ele também torna os processos um fluxo automatizado, entendeu? Aham. Então, por exemplo, ó. Esse daqui é um processo de solicitação de pagamento, tá vendo? Tu vai aprovando e ele vai mudando as áreas, entendeu?

joao victor (costinha) [08:04]: Sim.

José Guilherme Oliveira [08:06]: Aí, por exemplo, essa solicitação de pagamento, quando eu aprovo aqui a tarefa finalizada, ele já vai pro meu administrativo financeiro, entendeu?

joao victor (costinha) [08:15]: Entendi.

José Guilherme Oliveira [08:15]: Então, aqui eu já pulo uma etapa de não precisar que o financeiro fique lançando as coisas.

joao victor (costinha) [08:22]: Aham. Entendeu?

José Guilherme Oliveira [08:23]: E aqui tem SLA e tal. Então, tem alguns processos aqui que a ideia é a gente fazer, né? Um sistema e não dependa disso. Sabe quanto eu...

joao victor (costinha) [08:36]: Sabe quanto eu pago nisso aqui por mês?

José Guilherme Oliveira [08:39]: Aham. Treze... Quatorze mil reais. Que isso. É... Por mês.

joao victor (costinha) [08:50]: Entendeu?

José Guilherme Oliveira [08:53]: É... E aí tem processos bobos aqui, ó. Tipo, solicitação de viagem. Aí a pessoa clica aqui, solicitar. E aí segue um passo a passo aqui de um formulário e responder algumas perguntas. E aí, óbvio, né? Ele tem uma estrutura aqui de fluxo, ó. Vou te mostrar pra você ver.

joao victor (costinha) [09:10]: Mas teu interesse é reproduzir isso aí ou só alguns recursos?

José Guilherme Oliveira [09:15]: Cara, não... Aqui eu tô te dando mais uma visão geral pra tu entender. Porque... É... A ideia... Esse processo de obras... Tá vendo aqui? Obras spot? Sim. Qual era a minha ideia desde o começo? É... A gente fazer o processo de obras aqui, né?

joao victor (costinha) [09:33]: Deixa eu voltar aqui pra tu entender. Oi, Sérgio.

José Guilherme Oliveira [09:51]: Tá ligado?

joao victor (costinha) [09:53]: Foda, hein?

José Guilherme Oliveira [09:56]: Tu que montou isso aí? É, eu com a consultoria. Então, chega aqui... Tá. Pode comer. Então, por exemplo, o processo todo ele começa aqui. Realizar solicitação. E aí ele vai passando aqui em cada etapa que é de cada área diferente. Tá vendo aqui na esquerda as áreas? Sim. E aí ele tem os fluxos aqui de decisão e tal. Aí cada etapa dessa aqui, ó. É aquele formulário que você viu, né?

joao victor (costinha) [10:24]: A gente configura aqui o formulário do jeito que a gente quer. Tá vendo?

José Guilherme Oliveira [10:35]: Sim. Eu boto os campos aqui que eu quero e tal, enfim. E aí ele se transforma naquele formulário lá que você tava vendo, ó. Isso aqui, por exemplo. Entendeu?

joao victor (costinha) [10:44]: Sim.

José Guilherme Oliveira [10:45]: Só que assim, isso aqui é uma parada muito complexa. É, muito complexa que não faz sentido nem, sinceramente, reproduzir com IA. Sabe? Uhum. Mas talvez a gente não precise usar isso aqui. Por quê? Qual era a minha ideia quando eu comecei a usar isso aqui? A minha ideia desde o início foi usar com as obras. Entendeu? Porque a obra, ele existe, obviamente, um passo a passo a ser seguido, né? E processos que precisam ser seguidos até chegar lá na parte que executa e depois quando executa, né? Fatorar. É, então a minha ideia era, tipo assim, cada pessoa, né? Cada área saber qual é o seu momento ali e saber o que tem pra fazer. Pra não ficar aquelas paradas jogadas no e -mail, sabe? Tipo, ai, João, ó, vai começar a obra tal, tem que comprar um quilo de areia. É, aí joga no e -mail ou joga no WhatsApp, entendeu? Entendeu? Então todo esse fluxo acontece aqui.

joao victor (costinha) [11:47]: Entendeu? Entendi. E o que o cara monta aí na plataforma já vai por e -mail e pro WhatsApp.

José Guilherme Oliveira [11:53]: Por e -mail. Só que aí o que que eu fiz aqui? Que a minha ideia era usar isso aqui desde o início. Só que eu consegui criar um dashboard em cima disso aqui. Pra eu saber em qual etapa a obra tá. Se tinha alguma pendência, se não tinha. Pendência, entendeu? Só que isso aqui na prática não funcionou. E não funciona até hoje. Então, eu tive uma reunião semana passada com a consultoria que... Que é do próprio sistema, né? Mas a gente paga a parte. Pra gente redesenhar todo esse processo e tentar fazer funcionar.

joao victor (costinha) [12:31]: Entendeu? E é isso aí que tá batendo lá no cockpit?

José Guilherme Oliveira [12:35]: Então, ainda não. O cockpit, ele só vê a parte de manutenção corretiva. Daqui, pela API. Entendeu? Então, o cockpit aqui, ele toma conta da parte de manutenção predial.

joao victor (costinha) [12:49]: O ideal era ter vários cockpits pra vários tipos de serviço, né?

José Guilherme Oliveira [12:54]: Então, exato. Agora, eu preciso... A gente precisa criar pras obras. Entendeu? E aí, é tipo... É exatamente o que eu escrevi aqui, ó. Que é controle de obras.

joao victor (costinha) [13:05]: Copy, que a gente chama, né?

José Guilherme Oliveira [13:06]: Que é controle operacional. Então, o que que o cara que tá lá faz hoje? Ele atualiza a planilha com as obras aprovadas. Ele faz, junto com a operação lá, um cronograma de obra. Ele atualiza o status das obras. Ele atualiza pendências com outras áreas. Tipo, ah... Tem que comprar o material. Então, tem uma pendência lá de compras. Tem que pagar um fornecedor. Então, tem uma pendência do financeiro. É... Tem que... É... Contratar um fornecedor. Ah, então, uma pendência lá do administrativo operacional. Entendeu?

joao victor (costinha) [13:41]: Entendi.

José Guilherme Oliveira [13:41]: E aí, ele faz os envios de relatório, né? Apresenta essas informações também pro cliente. E ele cobra o fechamento da ordem de serviço no sistema do cliente. E ele acompanha o faturamento. Tá?

joao victor (costinha) [13:56]: Tá.

José Guilherme Oliveira [13:56]: E aí, o... A planilha que o cara usa hoje é essa aqui, ó. Tá vendo?

joao victor (costinha) [14:09]: Uhum.

José Guilherme Oliveira [14:11]: Então, por exemplo, essa planilha aqui, que ele chama de planejamento, é onde ele bota o cronograma. E aqui, onde ele chama de pipeline, é basicamente um resumo, uma base de cadastro. Entendeu? Entendeu?

joao victor (costinha) [14:26]: Uhum.

José Guilherme Oliveira [14:26]: Oi, neném! E, então, onde ele acompanha aqui, ó, é isso. Aí, a ordem de serviço é aprovada. Aí, ele bota aqui o número da ordem de serviço. Bota qual é a loja, qual é a descrição do chamado, algumas informações que já vem lá do sistema do cliente, entendeu? Qual é o valor, o analista, quem é o responsável aqui da Manfac pela obra, quem é a equipe que vai fazer, se tem uma equipe definida, se é um terceiro, se não tem equipe definida. Entendeu? E aí, ele começa a botar aqui os status. Ah, então, essa obra aqui tá pra executar, tá na etapa em andamento. Significa que a obra tá em andamento. Essa daqui tá pra executar, ou seja, já foi aprovada e ainda precisa planejar ou fazer um levantamento. Essa daqui tá pra executar e a obra tá parada. Por quê? Aí, ele bota aqui o motivo de bloqueio.

joao victor (costinha) [15:20]: O que é o status dessas coisas, visivelmente. Tu quer essa planilha visual, né, mano? É o que tu quer.

José Guilherme Oliveira [15:25]: Eu quero essa planilha automática.

joao victor (costinha) [15:29]: Além de visual, automática. Tanto de opt -in, como opt -out.

José Guilherme Oliveira [15:34]: Exatamente, entendeu? Automática, tipo assim, aprovou a obra, né? Ah, beleza. O fluxo que eu quero seguir, que é o mais fácil, porque assim, basicamente hoje a gente tem dois clientes onde as obras são aprovadas pelo contrato de manutenção, tá? Então, esse número de ordem de serviço que aparece aqui, ó, esse aqui, ele é o número de ordem de serviço lá no sistema do meu cliente. Ah, José, dá pra gente ligar a API lá? Dá. Porém, eu dependo de aprovação deles. Eu já tô, você tem ideia, há uns três meses já tentando. É, eu dependo de aprovação deles. A gente depende de configurar uma porrada de coisa. Então, o que que eu pensei em fazer que vai tornar mais fácil e vai centralizar pra gente a entrada das demandas? Aprovou a obra, ele vai criar no field, que é o nosso sistema. Entendeu? Então, ele vai vir a CRI, que vai criar uma nova OS. É, vai botar aqui quem é o cliente, por exemplo, Pacheco. Entendeu?

joao victor (costinha) [16:41]: Vai criar uma nova OS aqui. Entendi, entendi.

José Guilherme Oliveira [16:43]: E vai botar aqui o tipo de OS e atividade spot, que são obras. Sacou?

joao victor (costinha) [16:49]: Aham.

José Guilherme Oliveira [16:49]: No momento que ele criar isso aqui, o field tem a API aberta.

joao victor (costinha) [16:53]: Então...

José Guilherme Oliveira [16:53]: Já vai bater lá no cockpit. Obviamente, a gente vai fazer assim, ah, beleza. Se foi criado uma OS que é a atividade spot e ainda não tá na base, puxa pra lá. Entendeu?

joao victor (costinha) [17:06]: Aham.

José Guilherme Oliveira [17:07]: Aí, depois disso, a minha ideia, e aí a gente pensar no que fica melhor, é a gente talvez imigrando em três etapas num formato de Kanban, tá ligado?

joao victor (costinha) [17:19]: Sim.

José Guilherme Oliveira [17:20]: Não necessariamente precisa ser num formato de Kanban. Mas, assim... Uma parada que visualmente... É, uma parada que tem uma lógica e que, tipo, funcione, tá ligado? E aí, o que ele precisa atualizar aqui, que são os prazos, é... Na verdade, tem um agente de IA que vai ficar cobrando esse cara aqui, que é o responsável, tá vendo? PCM responsável.

joao victor (costinha) [17:43]: Sim. Sim.

José Guilherme Oliveira [17:44]: Ele vai lá e vai cobrar o Yuri. Yuri, a obra DP Barra de São João, 5730, tá paralisada por causa do clima, ou seja, tá chovendo. Ah, mas essa semana não vai chover. Então, preciso que você refaça o cronograma, porque o cronograma que tá aqui, ele tá furado. Tá vendo? Ele tava com o final planejado pra 17 de agosto.

joao victor (costinha) [18:06]: Sim. Entendeu? Que maneiro, hein? E aí, não só isso, talvez...

José Guilherme Oliveira [18:12]: Talvez, na verdade, faça mais sentido, porque o que que acontece hoje aqui na prática, João? Os caras... Beleza, a obra aprovou. Aí, ele vem aqui e fala assim, ah, beleza. Pô, eu vou começar essa obra, então, dia 17 de agosto. Mas, porra, pra eu começar a obra dia 17, eu tenho que ter o material, tem que ter a equipe, tem que ter a porra toda. Então, tem que ter um checklist antes de eu começar a obra, entendeu? Sim. E aí, não só isso. Por exemplo, aqui ó, de 24, aqui ele tá falando que essa obra vai durar sete dias, né? Basicamente. Oito dias aqui, contando com o dia 17. Então, talvez seja melhor. Ao invés da gente levar em consideração que o prazo é até o dia 24 do 8, seria legal a gente ter que... Quanto tempo essa obra dura? Ah, é uma obra de três dias, é uma obra de quatro dias. Pô, beleza. Então, eu não preciso exatamente qual é a data final planejada, entendeu? Eu preciso de uma data de início. E aí, o final, a gente vai fazer com base em quanto tempo o cara falou que a obra ia durar.

joao victor (costinha) [19:27]: Entendi. Entendeu? Então, uma data final é tipo um tiro no pé, né? Porque pode acontecer mil fatores que tu não vai fazer, tu não cumprir a data.

José Guilherme Oliveira [19:37]: Exatamente, porque aí, o cara ali, ele tem, por exemplo, sete dias pra fazer a obra. Se a obra atrasa, né, passa de sete dias, eu tenho que ter um histórico do que aconteceu

joao victor (costinha) [19:51]: ali naquela obra, né? O que atrasou.

José Guilherme Oliveira [19:54]: Pra que a gente tenha atrasado.

joao victor (costinha) [19:58]: Entendeu? Entendi. Ok.

José Guilherme Oliveira [20:01]: E aí, qual era a minha ideia nisso tudo?

joao victor (costinha) [20:04]: É, eu preciso que tu sintetize agora. A gente falou do micro, beleza.

José Guilherme Oliveira [20:09]: Não, é isso aqui. Isso daqui é o detalhe. Mas aí, qual é a minha ideia disso tudo? É porque, caralho, não tem como eu desenhar aqui pra tu, né? Deixa eu ver aqui pelo... Acho que não vai mais funcionar não, porque eu não tenho mais esse e -mail.

joao victor (costinha) [20:39]: Se quiser desenhar, me manda no WhatsApp. Eu acho que antes de tudo, mano, a gente tinha que partir de um miro, entendeu? Tipo assim, sistema que a gente quer criar tá aqui no meio. O que que vem de informação? Essa informação vem da onde?

José Guilherme Oliveira [20:59]: Eu vou te ajudar muito.

joao victor (costinha) [21:02]: É exatamente isso que eu vou fazer agora.

José Guilherme Oliveira [21:17]: Deixa eu tentar fechar umas paradas aqui, que tá muito lento.

joao victor (costinha) [21:20]: Às vezes é atualização de computador, mano. Meu também tava atualizando aqui, melhorou.

José Guilherme Oliveira [21:27]: Tinha coisa aberta aqui, consumindo memória, inclusive o cloud. Deixa eu fechar a câmera aqui.

joao victor (costinha) [21:58]: Deixa eu te ativo rapidinho. Os ajustes de cópia no site, tu chegou a ver o botão laranja, mano? Copiar as decisões para enviar?

José Guilherme Oliveira [22:08]: Não, pra mim não apareceu pelo celular, não.

joao victor (costinha) [22:11]: Tu botou onde tu tinha comprado?

José Guilherme Oliveira [22:16]: Comprado?

joao victor (costinha) [22:17]: Onde você viu?

José Guilherme Oliveira [22:21]: Ah, sei lá, agora eu não lembro. Cliquei no link, né?

joao victor (costinha) [22:24]: Eles botaram o botão laranja lá que ia copiar tudo que tu escreveu e falou. Mas aí tinha sido pelo navegador e o navegador que tu usou. Em vez de desenhar assim, mano, bota bloco melhor. Bota ali, ó. Bota mais, mais, mais, mais, mais shape. Isso.

José Guilherme Oliveira [24:11]: Eu te mostrei a parada que eu te falei da controladoria. Vou te mostrar aqui que você vai entender o que eu tô falando. Ó, se liga, esse é o sisteminha que os caras criaram, tá vendo?

joao victor (costinha) [24:28]: Moleque, muito maneiro.

José Guilherme Oliveira [24:29]: Mas quem criou isso mesmo? Isso é a empresa que faz uma assessoria aqui pra gente de estratégia, de controladoria, financeira, entendeu? Entendi. É... Muito foda, tá? Criaram isso aqui com... É claro que eles já tinham uns moleque lá de tech, uns moleque novo, sinistrão lá, que eles já mexiam pra caralho no Power BI, tá ligado? Aí eles pegaram o cloud e começaram a criar isso daqui. Moleque, é do caralho. Inclusive tem um assistente de IA aqui dentro, que tu pergunta a porra toda.

joao victor (costinha) [25:04]: Maneiro.

José Guilherme Oliveira [25:06]: Mas por que isso aí não te serve? Por quê?

joao victor (costinha) [25:11]: Por que que isso aí não serve, não te serve?

José Guilherme Oliveira [25:14]: Não, pro financeiro ele serve. Ah, entendi. Ele não serve hoje porque as informações no financeiro estão erradas.

joao victor (costinha) [25:23]: Entendeu?

José Guilherme Oliveira [25:24]: Entendi. Mas eu quero te mostrar pra tu entender o que que eu tô te falando. Ó, por exemplo, se a gente pegar aqui uma análise de fluxo de caixa, tá ligado? Tem várias, várias informações aqui maneiras. Mas aí, qual é o bizu? Moleque, tu clica aqui em apresentação, tá vendo aqui do lado?

joao victor (costinha) [25:47]: Sim. Já dá logo o relatório da empresa.

José Guilherme Oliveira [25:53]: Qual é o período pra análise? E o que que eu quero avaliar? Eu quero avaliar só um único centro de custo. Eu quero avaliar um consolidado com a porra toda. Moleque, simplesmente, a apresentação toda está aqui. Automático. Olha isso.

joao victor (costinha) [26:09]: Porra, foda ver isso, hein?

José Guilherme Oliveira [26:12]: Olha isso aqui.

joao victor (costinha) [26:14]: A ideia é fazer uma apresentação dessa lá no sistema de obras. E detalhe. E detalhe. Exatamente. E detalhe.

José Guilherme Oliveira [26:21]: Mas na parte do cliente, né? Se eu quiser apresentar por aqui, eu apresento por aqui. E olha a qualidade do slide, tá ligado? Aqui. Tudo animado, né? Muito maneiro, moleque. Tá vendo?

joao victor (costinha) [26:39]: Pô, irado.

José Guilherme Oliveira [26:45]: Então, a ideia é essa. É ter essa parte de apresentação, entendeu? Por quê? Eu não fico mais dependendo. Ah, quem é que vai gerar a apresentação? Aí, os caras sempre mandam a apresentação em cima da hora. Aí, eu não tenho tempo de validar nem o Eduardo. Aí, quando a gente vai ver, no meio da reunião com o cliente tem uma porra errada. Entendeu?

joao victor (costinha) [27:07]: Aí, isso é uma merda, mano.

José Guilherme Oliveira [27:09]: Então, porra, a apresentação, saindo daqui, saindo do dashboard lá, porra, mata todos os problemas. Entendeu?

joao victor (costinha) [27:18]: Sim. Deixa eu dar uma menina daqui, já volto. O que tem pra comer, irmão? O que tem pra comer? Por você. Por que meu pai tava te chamando? Porque ele tava avisando quem é na rua. Posso estar amando? Ah, tá. Quando liberar, consegue botar na sargentinha pra gente... Vamos acabar aqui logo, tá? Tu tá empregado, por acaso? Não é funcionário, filho. Boa, José. Isso aí. Não é funcionário. Pois é. Tá cheio de monomínio.

José Guilherme Oliveira [28:56]: Então, se ligou? Tá vendo aí?

joao victor (costinha) [28:58]: Aham. Aprovou a obra, o cara vai lá e joga no fio de control. Bateu no fio de control, tem que bater nesse sistema, certo?

José Guilherme Oliveira [29:18]: Tá, mas se liga aqui, ó. Aprovou a obra. A obra pode ser aprovada por e -mail, WhatsApp, telefone.

joao victor (costinha) [29:27]: Ah, suave. Integra isso tudo. Mas, porra, alguém vai ter que dar um gatilho, mano. Essa porra tá aprovada.

José Guilherme Oliveira [29:35]: Então, exatamente. A ideia é essa, entendeu? Aí, a gente definir, tipo assim, ah, vamos botar, tipo, o gatilho, sei lá, é enviar um WhatsApp pra um número, pro agente de apegar, tá ligado? Entendi. Ou... Porque, assim, é foda. Eu queria evitar o máximo possível de ter alguém interagindo no sistema, entendeu?

joao victor (costinha) [30:02]: Sim.

José Guilherme Oliveira [30:04]: Mas, enfim. Porque vai adiantar nada.

joao victor (costinha) [30:05]: Tu vai ter que botar um candão do mesmo jeito que já tem hoje.

José Guilherme Oliveira [30:09]: É. Mas, enfim, é...

joao victor (costinha) [30:15]: Tem que ter um gatilho no e -mail, no WhatsApp, no telefone. Ou então pode ser até um gatilho na plataforma, né?

José Guilherme Oliveira [30:23]: É, entendeu? Sei lá. Tipo assim, ah, é... Eu... Eu cadastro a obra na plataforma e a plataforma abre a ordem de serviço no field, por exemplo. Entendeu?

joao victor (costinha) [30:37]: Cadastro a obra na plataforma já seria, tipo, tá aprovado, né?

José Guilherme Oliveira [30:42]: Exatamente.

joao victor (costinha) [30:45]: Aí já abre uma ordem de serviço no field, lá com os campos preenchidos. Depois do field volta pro sistema de novo.

José Guilherme Oliveira [30:52]: Então, aí a parada é essa, exato. Aí no field volta pro sistema de novo. Aí, ah, mas pra que que serve o field? Aqui o meu técnico vai preencher ele em campo. Sacou?

joao victor (costinha) [31:11]: Entendi. Por isso que tem que ter o field, né?

José Guilherme Oliveira [31:13]: Porque preenche o campo... Então, aqui ele tem uma informação.

joao victor (costinha) [31:16]: Manil, isso é bom saber, porque tipo assim, é... Quando a gente evolui que o sistema estiver onde a gente quer, a gente já pode pensar em criar um app, né? Pro... Oi, mo... Pode ser tilapia.

José Guilherme Oliveira [31:41]: Bom, tá ligado? É que ele vai ter essas duas informações. Ele vai preencher em campo. Então, obviamente, a gente tem um relatório fotográfico e a gente tem um fechamento da OS.

joao victor (costinha) [31:49]: Bom, isso é importante estar mapeado, porque depois a gente vai precisar disso.

José Guilherme Oliveira [31:53]: Então, aí... É... A gente vem... A gente vem no field, né? Nesse cadastro da base de obras, tá ligado? Essa base de obras, ela é algo muito parecido com essa planilha aqui.

joao victor (costinha) [32:11]: Achei que fosse essa. Ué, se a base de obras é essa planilha, essa planilha é o quê?

José Guilherme Oliveira [32:16]: É, essa planilha é a base de obras. Entendeu? É isso. Mas tô falando assim. Existem mais... Mais coisas aqui que dá pra colocar. Dá pra fazer.

joao victor (costinha) [32:25]: Entendi. Entendeu? E aí, qual é a ideia? Bota o linkzinho aí. Bota o linkzinho aí, Bedado. Sublinha aí o base de obras e aperta Ctrl K.

José Guilherme Oliveira [32:35]: Mas pra quê?

joao victor (costinha) [32:37]: Pra deixar o link aí, né? Pra ficar fácil. Eu vou te... Que link? Da planilha? É, da planilha. Eu vou te mandar por e -mail. Tá bom. Enfim, prossegue aí.

José Guilherme Oliveira [32:53]: Aí, a base de obras, ela gera várias informações aqui, tá ligado?

joao victor (costinha) [32:58]: Isso é o que hoje em dia tu não tem e quer.

José Guilherme Oliveira [33:01]: Que até então... Exatamente. Entendi. Exatamente.

joao victor (costinha) [33:05]: E que informações gera o dia a dia da base de obras? Quais são os opt -ins dela? E quais são os opt -outs?

José Guilherme Oliveira [33:12]: É isso que tu tem que ter em mente.

joao victor (costinha) [33:23]: E é o que o Nathan fala, mano. A gente tem que perder mais tempo planejando do que executando, tá ligado?

José Guilherme Oliveira [33:29]: Então, o que que acontece? Aqui, nesse lado mais administrativo, a gente tem o ZIV hoje.

joao victor (costinha) [33:37]: Tá? Sim.

José Guilherme Oliveira [33:41]: O que que é aqui o administrativo? Financeiro... Eu vou botar assim, mas dá pra entender, tá?

joao victor (costinha) [33:51]: Compras... Eu tô gravando e que tá escrevendo também, irmão. Que eu não entendeu o volta.

José Guilherme Oliveira [33:54]: Relaxa. Obviamente, não é um embaixo do outro, né? Mas, enfim. Eu preciso entender.

joao victor (costinha) [34:01]: Bota tudo junto, então, na mesma caixinha, pô.

José Guilherme Oliveira [34:05]: Não, pô. Vai ficar pior.

joao victor (costinha) [34:07]: Tá.

José Guilherme Oliveira [34:07]: Tô com chave. É... Contratação de parceiros, tá? Então, esse lado aqui hoje, né, eu gero ele pelo ZIV. Pelo ZIV.

joao victor (costinha) [34:35]: Tá. Suara, vou botar igual tem base de obras ali, botar o administrativo com as opções embaixo como isso. Mas, enfim. É só estrutura. Não se importa com isso. Não.

José Guilherme Oliveira [34:46]: Aqui eu tô só desenhando rápido, só pra tentar...

joao victor (costinha) [34:48]: Não, é. Beleza.

José Guilherme Oliveira [34:48]: Tá. Tá. O que que eu não tenho hoje? Isso aqui. A gente faz manual e depende do responsável da obra.

joao victor (costinha) [35:06]: É, eu quero que tu bote tudo isso. Quem... É tipo... O que que a gente tem hoje que faz manual e depende do responsável? O que que a gente tem no ZIV que já existe?

José Guilherme Oliveira [35:13]: Porque qual é a parada?

joao victor (costinha) [35:14]: Cada caixinha dessa, mano, vai ser uma semana de projeto, tá ligado?

José Guilherme Oliveira [35:20]: Aqui.

joao victor (costinha) [35:21]: Entendeu? E o plano de ação que eu vou fazer vai ser baseado em cada caixinha dessa. Ah, mano, o que que é melhor pra tu agora? A gente atacar dia a dia da obra, atacar um dashboard ou tracar o relatório? O relatório não vai ser porque pra ter o relatório tem que ter as informações. Então a gente vai ter que atacar a parte de dados e visualização.

José Guilherme Oliveira [35:41]: Aqui. Mal feito.

joao victor (costinha) [35:48]: Porra, mano. Inclusive a gente vai pegar a estrutura lá daquele lá que fizeram pra tu, de financeiro, e vamos copiar a estrutura ali do agente para o sistema e da apresentação já integrada no sistema, tá ligado? E aí botar uma opção tipo de campo de texto com negrito, formatação, que aí a pessoa

José Guilherme Oliveira [36:09]: tá ligado? O quê? É isso aqui, tá ligado?

joao victor (costinha) [36:14]: Aham. O que que é importante aqui?

José Guilherme Oliveira [36:16]: Essa base de obras, ela de alguma forma vai ter que ser viva, tá ligado?

joao victor (costinha) [36:22]: Como se fosse o Excel.

José Guilherme Oliveira [36:25]: Porque o cara vai estar preenchendo, né? Porque tem muita atualização. É. Exatamente. Só que o que que eu penso aqui, por exemplo? O que que a gente não tem hoje que acaba atrasando as obras? Eu não tenho visão do que foi executado cada dia.

joao victor (costinha) [36:43]: Entendi. Então basicamente é como se fosse no final do dia e tal horário, tem que puxar as informações de tudo porque nesse tal horário tu quer ver.

José Guilherme Oliveira [36:52]: Não. A gente acaba não tendo uma visão executada em cada dia, que é uma parada que existe em obra, que é um termo chamado RDO. se chama Relatório Diário de Obras. Tá ligado? Aham. Isso daqui, se você pesquisar na internet, modelo RDO. Aqui ó. 50 mil.

joao victor (costinha) [37:12]: Entendeu? Aham. Tem milhares que existem.

José Guilherme Oliveira [37:16]: É, exato. Assim, eu não preciso disso daqui exatamente, tá? Então é importante que você preste atenção porque eu tô te dando exemplos, mas não é isso que eu preciso.

joao victor (costinha) [37:28]: Sim, é só tá dando a base ali, a ideia, né?

José Guilherme Oliveira [37:31]: É. Porque assim, por exemplo, mão de obra. Aí tem aqui, quantidade de pessoas, cada função. Tá vendo? Tu tá vendo ou tá pequeno?

joao victor (costinha) [37:39]: Tô vendo, porra. Tô com uma tela só com isso aqui, mano, do meu lado. Só tem só tela. A conversa e o chat tá aqui no meio.

José Guilherme Oliveira [37:45]: Ficou melhor aqui, ó. Tá vendo? Se tá sol, se tá chuva, tá, tá, tá, tá, tá, tá, tá, tá.

joao victor (costinha) [37:51]: Entendeu? Caralho, moleque. Fazer gestão de uma operação de engenharia, puta que pariu.

José Guilherme Oliveira [37:56]: Enjoado, hein? Então, existe esse modelo aqui que é o RDO, mas não é bem isso que eu preciso. O que eu preciso aqui, eu preciso saber o que foi produzido naquele dia. Entendeu? O que que eu preciso responder? Teve produção? Faltou algum item?

joao victor (costinha) [38:25]: Tá dentro do cronograma?

José Guilherme Oliveira [38:28]: Não, dentro do cronograma o próprio sistema vai falar, né?

joao victor (costinha) [38:33]: No caso o nosso ou o field?

José Guilherme Oliveira [38:35]: O nosso. O nosso. Tá? Esquece esse ZIV aqui hoje. Deixa ele em standby por enquanto. Tá. Primeiro, a gente precisa entender esse lado aqui. Entendeu?

joao victor (costinha) [38:48]: Sim. É o lado operacional da coisa.

José Guilherme Oliveira [38:51]: Sim. Tá? Porque o ZIV, se a gente mexer aqui, ele vai envolver um processo do financeiro, um processo de compras, um processo de contratação, aí o negócio toma uma proporção dez vezes isso aqui. Entendeu? Sim. Então, o que a gente precisa resolver hoje é o lado operacional, que é o quê? A visão do que foi executado a cada dia, que eu não tenho hoje e eu dependo do responsável da obra. Então, pra tu ter ideia, tipo, imagina só. O moleque lá, que faz o controle operacional, na prática o que que ele faz? Ah, peraí. Pô, deixa eu ver todas as obras que estão... Aqui só tem obra pra executar, tá? Deixa eu ver todas as obras que são do Yuri. Tá? Tem onze linhas aqui. Tá ligado? São todas essas obras aqui. Aí ele vai... Aí ele senta com o cara, fisicamente, quando dá, quando não dá fisicamente, vai atualizando por telefone. Ou, o que eu não gosto, que tipo, ele pega, manda a planilha pro cara e fala, cara, atualiza aí e me devolve.

joao victor (costinha) [39:58]: Aí não faz sentido, entendeu?

José Guilherme Oliveira [40:01]: Não, e não faz sentido, porque, vamos lá, se o João que tá executando a obra, ele vai atualizar aqui fazendo, dando as respostas que são as respostas que a gente quer ter? Não vai, né? Ele vai botar aqui que a obra atrasou? Não vai, né? Sim. Entendeu? Então aí ele pega aqui com o Yuri, linha a linha, e vai batendo. Yuri, do jeito que eu tô te falando aqui, tá? Obra DP, bairro de Fátima, como é que tá? A gente tava em andamento, tava com início planejado pra dia 19 do 8. Começou 19 do 8? Ah, começou. Você vê que tá preenchido aqui, ó, início real 19 do 8. Entendeu? Aham. Então, não tem fim real. Então a obra tá em andamento, tá? E aí, tu vai ver aqui, ó, você precisa começar a entender os problemas, entendeu? Sim. Ó, na nossa base, essa obra foi aprovada no dia 30 do 4. Ela tá a 117... Acho que nem isso, né? Acho que até mais.

joao victor (costinha) [41:18]: 117 dias aprovada a fazer.

José Guilherme Oliveira [41:21]: É. Ela tá a 123 dias aprovada e o meu time não terminou a obra.

joao victor (costinha) [41:30]: Caralho. Tá ligado? Sendo que no planejamento ia durar quanto?

José Guilherme Oliveira [41:35]: No planejamento ia durar sete dias.

joao victor (costinha) [41:42]: Você deve botar por padrão, né?

José Guilherme Oliveira [41:44]: Tipo, no meio do caminho, alguma coisa aconteceu que simplesmente pararam a obra e ela ficou esquecida.

joao victor (costinha) [41:55]: Caralho, que merda.

José Guilherme Oliveira [41:56]: Tá ligado? Nisso, na quinta -feira passada, um analista lá da Pacheco... Que assim, a Pacheco é um cliente, mas tem vários analistas lá dentro que a gente atende, né?

joao victor (costinha) [42:09]: Uhum.

José Guilherme Oliveira [42:10]: Um analista deles simplesmente ligou pro Eduardo e cancelou 100 mil reais de faturamento em obra.

joao victor (costinha) [42:18]: Caralho, por causa de uma porra dessa.

José Guilherme Oliveira [42:20]: Por causa que a gente tava com a obra parada na mão. Exatamente esse cenário aqui, entendeu? Foram exatamente essas duas obras aqui. Essas três.

joao victor (costinha) [42:34]: Tava com uma ordem de serviço aberta, o cara foi ver lá 117 dias.

José Guilherme Oliveira [42:38]: O cara vendo lá a ordem de serviço. Ele toda hora, cara, e aí, acabou a obra? Qual o cronograma? Ah, não. Toda hora alguém pedalando o cara, entendeu? Uhum. Aí o cara chegou e falou, não, meu irmão, eu preciso da obra pronta, porra. A obra tá com vocês há mais de 100 dias, que isso aí tá aprovado. Não é possível que em uma obra de uma semana vocês estão há 100 dias pra executar. Caralho. Entendeu? E aí, o trabalho é esse. Aí ele vai linha em linha aqui, batendo com o Yuri. Aí eu te pergunto, não é muito mais fácil o próprio Yuri responder isso aqui todo dia? Sim. Entendeu? Tipo, imagina. Nessa parte de diário de obras, o Yuri chega todo dia na empresa e ele responde isso aqui. Tá ligado? Ele tem todo dia uma tarefa de responder o que tá acontecendo em cada obra. Ou um agente de IA vai perguntar pra ele, sei lá, e o agente de IA vai atualizar isso, entendeu?

joao victor (costinha) [43:45]: É, porque o agente ele vai puxar lá do fio de control, né? E aí já vai tatuar.

José Guilherme Oliveira [43:49]: Não, não vai. Esquece o fio de control nesse momento. Tá. O agente não puxa nada do fio de control. O fio de control não serve pra nada. Ele só serve como uma entrada da obra pra gente ter da onde puxar. Ó. Ele só serve como isso daqui.

joao victor (costinha) [44:05]: E o técnico vai preencher lá.

José Guilherme Oliveira [44:07]: Eu não tenho aqui nenhuma informação de cronograma, de status, de porra nenhuma.

joao victor (costinha) [44:13]: Entendeu? Ótimo. Eu não tenho aqui nenhuma informação de nada.

José Guilherme Oliveira [44:21]: Tá? Aham. Então, basicamente, o que eu preciso é isso. É ter essa visão do que tá sendo executado a cada dia. Entendeu? Só que, tipo, aqui, João, nesse meio, a gente tem obras muito rápidas.

joao victor (costinha) [44:36]: A gente chama de obra, mas não é uma obra. Imagina assim. Não é nada que a gente tá construindo.

José Guilherme Oliveira [44:40]: É uma manutenção. É. Exatamente. Tipo, não tem um vazamento aí na sala de casa? Uhum.

joao victor (costinha) [44:47]: Imagina isso numa loja. É.

José Guilherme Oliveira [44:50]: Imagina isso numa loja. Aí tem uma equipe que vai lá um dia, aí quebra o forro, conserta o vazamento.

joao victor (costinha) [44:56]: Aí fecha o forro. Aí a mesma equipe volta lá no dia seguinte e pinta. Acabou. Entendeu?

José Guilherme Oliveira [45:04]: Uhum. É isso. Só que isso também tem obras que às vezes demoram sete dias, dez dias. Ah, eu vou pintar a loja inteira.

joao victor (costinha) [45:13]: Entendeu? Entendi. E pela tua experiência aí, qual é o nível de complexidade que isso vai levar? Porque, tipo assim, eu comecei achando que ia ser muito difícil, aí tu desenhou, vi que não vai ser tão difícil assim.

José Guilherme Oliveira [45:26]: Cara, eu acho que o mais difícil, na minha visão, vai ser criar as views e criar esse processo aqui.

joao victor (costinha) [45:36]: O dia a dia, tá ligado? Tá. E o que nutre o dia a dia das obras? Porque tem uma base de obras ali.

José Guilherme Oliveira [45:46]: Exato. Exatamente isso que eu tô te falando. Pensa no seguinte.

joao victor (costinha) [45:50]: A base de obras, no caso, é o planejamento DPSP, né? Planilha.

José Guilherme Oliveira [45:55]: Não. A base de obras é... Imagina o cadastro de todas as obras.

joao victor (costinha) [45:59]: Uhum. Tá?

José Guilherme Oliveira [46:03]: Então, o que alimenta a base de obras é o field, né? Aprovou a obra, eu abri no field, o sistema puxa lá pra base de obras e cadastra. Uhum. Tá? O que que alimenta e mantém vivo o cronograma, tudo isso? É o dia a dia da obra, que é o que eu te falei, que é o processo que o cara, né, hoje filtra aqui, a obra do Yuri. Yuri, Lúcio Costa, como é que tá? Pedra de Guaratiba, como é que tá? E vai atualizando caso a caso. Ah, Zé, essa obra aqui eu parei porque tá chovendo. Tá vendo?

joao victor (costinha) [46:36]: Uhum.

José Guilherme Oliveira [46:37]: Bloqueio, ó. Clima. Ah, essa obra aqui eu parei porque o cliente mandou parar. Essa obra aqui eu parei porque eu tive que deslocar a equipe pra outro lugar. Então, eu tô sem equipe. Então, o problema é a disponibilidade de equipe. Entendeu? Uhum. Então, é isso. E aí, quando o Yuri responde isso todo dia, esse molequinho vai lá e vai atualizando essa planilha lá todo dia. Entendeu?

joao victor (costinha) [47:04]: Uhum.

José Guilherme Oliveira [47:04]: Só que, e se esse moleque não atualizar? E se o Yuri não responder?

joao victor (costinha) [47:14]: Entendeu? O que eu não tô entendendo é como é que a gente vai saber de uma coisa que o Yuri

José Guilherme Oliveira [47:19]: tem que falar. Como assim?

joao victor (costinha) [47:25]: Porque o Yuri tem que dar as informações pra essa planilha.

José Guilherme Oliveira [47:31]: Aham.

joao victor (costinha) [47:33]: Como é que a gente vai ter essa informação se o Yuri não falar nada?

José Guilherme Oliveira [47:37]: Mas ele tem que falar. Por que que ele não falaria? Ele tem que falar. Ele tem que preencher lá.

joao victor (costinha) [47:44]: E o que que ele tem que preencher lá? Que é o que tu diz. Ele tem que preencher lá a planilha, não é?

José Guilherme Oliveira [47:49]: Não. Hoje ele não preenche, não. Hoje ele chega aqui e pergunta, Yuri, como é que tá a obra? Ah, essa obra tá em andamento ainda. Tá com previsão pra terminar no dia 31 do 8. É, tá em andamento, tá tudo certo, não precisa de material, não precisa nada. Tá? Aí, até o dia 31, né, vamos supor, tem mais três dias. E aí todo dia a obra, qual é a atualização da obra todo dia? Tá em andamento, tá em andamento, tá em andamento, entendeu? Só que chega lá no terceiro dia, pião, imagina, pião, imagina a obra aí de casa. O que que acontecia todo dia? O cara chegava e falava assim, ah, eu preciso comprar uma tinta. Né? Aí meu pai saía e ia na rua. Quando meu pai voltava, o pião fazia o quê? Ah, agora faltou um pedaço de fio.

joao victor (costinha) [48:38]: Aí saía e ia na rua, não é verdade?

José Guilherme Oliveira [48:41]: Uhum. Então, imagina isso com todos os piões, todos são assim. Então, qual é a parada? Às vezes, vai chegar lá no terceiro dia e faltou material. E aí no último dia que era pra acabar a obra, faltou material, faltou material. E vamos supor, ninguém resolveu, eu, o José não sei, o Eduardo não sabe. Pra mim, a obra está em andamento e vai acabar.

joao victor (costinha) [49:12]: Aham. Só que não, a obra não vai acabar, entendeu? Sim. E tá atrasado por causa do material.

José Guilherme Oliveira [49:19]: Por quê? Faltou material. E aí, eu não sei que tá parada aguardando material. Então, por isso que seria importante a gente, todo dia ali, né? Vamos botar assim, ah, no momento que a etapa da obra virou em andamento, ele tem que, né, falar todo dia o que tá sendo produzido.

joao victor (costinha) [49:38]: Então, no caso, não vai ser mais o rapazinho que vai preencher essa planilha.

José Guilherme Oliveira [49:42]: Vai ser o Yuri preenchendo o sistema. Não, a gente vai demitir ele, porra. A gente quer demitir ele justamente por isso. O sistema passa a fazer.

joao victor (costinha) [49:49]: É, vai ser o Yuri preenchendo umas perguntas aí do sistema. Porque querendo ou não, alguém vai ter que preencher isso aí. No caso, o Yuri, né?

José Guilherme Oliveira [49:57]: Exatamente. Entendeu? Em vez de preencher o sistema. Ou o Yuri, ou o próprio técnico preenche.

joao victor (costinha) [50:08]: É, porque pra mim o Yuri é o técnico ali. Eu não sei quem tá de frente lá na obra que pode tomar decisões e reportar. É assim, mano. Mas, é, eu precisava entender o que tem esses retângulos que você quer atacar. Mas fala aí, fala aí.

José Guilherme Oliveira [50:28]: Aqui tem o Yuri, aqui tem o técnico ou prestador de serviço.

joao victor (costinha) [50:34]: O Yuri é tipo um gestor de projeto, tipo isso?

José Guilherme Oliveira [50:37]: O Yuri é um analista de obras.

joao victor (costinha) [50:40]: É, gestor de projeto. Ok.

José Guilherme Oliveira [50:41]: Caralho, tem 9 minutos. Vou ter que te mandar outro link. Oi?

joao victor (costinha) [50:46]: Vou ter que te mandar outro link. Esse link é que vai esperar. Só tem 9 minutos.

José Guilherme Oliveira [50:50]: Porra, eu tô cheio de fome. E o Joaquim tá chorando a Bessa aqui, querendo falar comigo.

joao victor (costinha) [50:55]: Mas, cara, acho que tu já entendeu o conceito, né? Sim. Não, entendi. Tá tudo gravado aqui. O que eu não entendeu, eu volto. É, o que eu quero saber. Onde é que a gente tem que atacar primeiro? Porque tu me mostrou três blocos aí que a gente tem que atacar. É, eu precisava entender o que a gente tem que atacar primeiro versus o tipo de informação que a gente tem, entendeu? Tem que atacar todos, mano. É possível atacar todos?

José Guilherme Oliveira [51:18]: É. Na verdade, assim, primeiro...

joao victor (costinha) [51:21]: O relatório pra reunião, mano, já dá pra tirar ele. Porque o relatório é a última coisa. Então, assim, já não é todos.

José Guilherme Oliveira [51:26]: É, eu tô falando assim, né? Não dá todos ao mesmo tempo. Até porque você vai precisar a partir de uma base de dados. Né, Joaquim?

joao victor (costinha) [51:34]: Vem cá, filho. Papai vai te ensinar.

José Guilherme Oliveira [51:36]: Não, ele tá irritado batendo na porta porque ele quer te ver. Você chegou e entrou aqui.

joao victor (costinha) [51:41]: Vem cá, você vai... Vem cá que eu vou te ensinar como é que faz. Vem aqui no colo do papai.

José Guilherme Oliveira [51:47]: Então, assim, primeiro de tudo, você vai ter que criar uma estrutura... Vem aqui. Uma estrutura que é a base de dados.

joao victor (costinha) [51:53]: Que seria a base das obras, tá ligado? Então, a primeira parte é essa. Você vai ter que criar isso aqui. Field pra base obras. Aí, a tua base obras vai ter que ter uma estrutura assim, ó. De base de dados. Imagina um Excelzão. Por isso que eu queria saber as colunas, né? É exatamente isso aí?

José Guilherme Oliveira [52:10]: É. Exatamente não, né, cara? Aí tem que... É o que a gente escolher pra entrar. É, tem que ir criando aqui e a gente ver o que faz sentido aqui. Tá? Aí, a base de obras, o que que alimenta ela? É o dia a dia das obras. O que que alimenta o dia a dia das obras? É esse processo aqui que a gente acabou de conversar. Tá ligado? Aí, beleza. Aí você tem uma base pronta... Me dá ele aqui, amor. Aí você tem uma base pronta que essa base tá sendo atualizada diariamente. Ou seja, o meu controle tá pronto. Entendeu?

joao victor (costinha) [52:45]: Aí, a partir daí, a gente faz a parte mais fácil.

José Guilherme Oliveira [52:47]: Que é criar o dashboard e criar os relatórios de reunião.

joao victor (costinha) [52:52]: Beleza. Então é isso.

José Guilherme Oliveira [52:55]: Entendi o curso agora.

joao victor (costinha) [52:56]: Vamos atacar dia a dia de obra.

José Guilherme Oliveira [52:59]: Exato. Preciso atacar essa atualização das obras. Entendeu?

joao victor (costinha) [53:03]: Tá.

José Guilherme Oliveira [53:03]: Aqui, aqui, aqui. O que o papai tá fazendo? Que legal. Como é que é?

joao victor (costinha) [53:07]: Tá? Tá entendido? Tá entendido, mano. Obrigado.

José Guilherme Oliveira [53:10]: Aí, depois, a gente entra nesse lado aqui administrativo, que isso aqui agora é mais complexo de mexer. Mas só pra te explicar. Existem etapas de obras aqui que já estão sendo feitas pelo ZIV. E aí, o ZIV, a gente pode também ter integração na API e responder algumas coisas lá dentro ou estartar algumas tarefas, entendeu?

joao victor (costinha) [53:37]: Tá.

José Guilherme Oliveira [53:40]: Tá? E aí, mano, esse bagulho aqui é tipo assim, se der pra começar hoje, começa hoje.

joao victor (costinha) [53:47]: Tá. Isso é uma prioridade zero, né? Exatamente. Isso que eu ia falar. E o site?

José Guilherme Oliveira [53:55]: Cara, eu não sei nem o que tu tá fazendo o site ainda, porra. Demorando pra caralho.

joao victor (costinha) [54:01]: Mano, tu pediu pra rodar uma auditoria de cópia nele. Que que eu tava fazendo o site que demorou? O formulário eu melhorei, tá em duas etapas agora. Cara, primeiro preenche o número e o e -mail.

José Guilherme Oliveira [54:11]: Não, tá bom. Mas, cara, vai tocando os dois em paralelo. O site não tem o que fazer. É deixar lá o Cloud rodando, não tem o que você mexer lá mais que isso.

joao victor (costinha) [54:19]: Não é, mas, tipo assim, eu perdi aquele que é o feedback que tu tem dado, tá ligado? De cópia. Quero que tu mais queira.

José Guilherme Oliveira [54:24]: Me manda essa porra da cópia aí de novo que eu respondo essa porra hoje pra você.

joao victor (costinha) [54:28]: Tá. Tá? Era só isso mesmo que eu precisava.

José Guilherme Oliveira [54:32]: Tá. Beleza, mano. Vou te mandar os documentos depois. Deixa o jantar ficar com o Joaquim aqui que ele tá perturbando a forma.

joao victor (costinha) [54:41]: Tá bom. E aí eu te mando as paradas mais tarde. Valeu. Tá bom, valeu, tchau. Tchau. Tchau.
