# Reunião Gestão de Frotas — 20/10/2026 (transcrição literal)

Fonte: tl;dv, reunião `6ad79ec2d747790013342647` ("20/10/2026-Meeting"), 20/10/2026 17:02 UTC, duração 28 min.
URL: https://tldv.io/app/meetings/6ad79ec2d747790013342647
Participantes: João Victor (organizador, "costinha"), José Guilherme Oliveira, Igor de Souza Jesus (entra aos 03:30).
Transcrição salva sem edição, como devolvida pelo tl;dv (erros de transcrição automática mantidos).

---

José Guilherme Oliveira [00:01]: Então, coisa rápida, que que eu acho aqui? Tu pegou aquele documento, jogou lá, né? E claro que vai ter mais coisa aqui para fazer do que de fato a gente realmente tinha construído, porque a gente pegou agora e detalhou tudo com calma. Só que tem que tomar um cuidado para ele não sair fazendo tudo, entendeu? E esse que eu acho que é o ponto. E aí assim, É, eu acho que tem coisas ali que são correções de bugs, entendeu? Por exemplo, a questão de trocar o motorista, a questão de trocar a CNH, a questão de editar a quilometragem, é mais uma questão de bug do que outra coisa, entendeu? Então quando eu vi as duas perguntas que ele perguntou, ah beleza, vai pelo que eu tô entendendo, ele vai começar pelo KM do dia. Não sei se é isso, tem que entender por onde ele tá imaginando começar. Mas assim, o que acontece hoje é, já que vai aproveitar o mesmo sistema, eu faria da seguinte forma, cara: corrija os bugs, entendeu?

joao victor (costinha) [01:16]: Não, então a parada é, vamos diferenciar o que que é bug e o que que é falta de funcionalidade, entendeu?

José Guilherme Oliveira [01:21]: Exatamente, é isso que eu tô falando.

joao victor (costinha) [01:22]: É uma coisa E não ter funcionalidade é outra.

José Guilherme Oliveira [01:25]: Exatamente isso que eu tô falando. Quer ver? Ó, vou abrir aqui.

joao victor (costinha) [01:29]: Eu acho, mano, que valia uma revisão do rapaz. Não sei quanto que tu vai botar isso na mão dele, usar o tempo dele, mas só para rever funcionalidade, tipo essa que você falou. A motorista não dá para trocar, CNH não dá para editar, tá ligado?

José Guilherme Oliveira [01:44]: Mas eu já—

joao victor (costinha) [01:46]: pera aí, caso tu tenha esse mapeado também, até melhor.

José Guilherme Oliveira [01:51]: Mas eu já tenho, pô, é isso que eu tô te falando. Deixa eu só Eu tinha até anotado de uma reunião que eu tive com ele. Fala comigo, tá aqui na sala? Vou te mandar um link de reunião aí, aí tu entra aí rapidinho, tá? Valeu.

joao victor (costinha) [02:23]: Que aí a gente tenta fazer para essa frente, entendeu? Ajusta, ajusta a funcionalidade, tudo que tiver para ajustar de funcionalidade.

José Guilherme Oliveira [02:32]: Eu acho que é isso. Primeiro é o ajuste do bug, depois a gente corrige algumas coisas. Em que sentido? Por exemplo, esse processo de multa, ele tá mal feito aqui, entendeu? Além de ter bug também Mas ele, ele tá mal feito, tem pontos de melhoria, entendeu?

joao victor (costinha) [02:55]: Entendi.

José Guilherme Oliveira [03:01]: Deixa ele entrar aqui.

joao victor (costinha) [03:06]: É, mano, eu acho que enfim, a gente tem que olhar lá o que que é prioritário e resolvendo por módulo, sabe? Para a gente, enfim, não cair no limbo de se perder. Fala aí, Igor, beleza?

José Guilherme Oliveira [03:30]: Fala aí, Igor, tá ouvindo?

Igor de Souza Jesus [03:32]: Opa, boa tarde, tô ouvindo sim.

José Guilherme Oliveira [03:34]: Então, o João é É o responsável que tá apoiando a gente aí no processo dos sistemas. E aí eu tô batendo algumas coisas com ele aqui de frotas. Eu peguei aquele documento que tu fez, mandei para ele, e a gente identificou na verdade. E aí eu te chamando, tô te chamando aqui para a gente alinhar de fazer na verdade assim duas frentes. Uma frente é as correções de bugs que atrapalham hoje o dia a dia. Né, para a gente conseguir na verdade colocar o sistema atual em uso. E outra frente é melhorar não só o que já tem, mas incluir também outras coisas que não tem aqui hoje, né? É a própria parte de combustível da TicketLog que a gente comentou. Enfim, aí, cara, a gente falou dos bugs que tava dando, mas eu cheguei a escrever isso na nossa reunião, não escrevi? Escreveu, porra. Pois é, mas eu Procurei aqui, não sei se eu saí.

joao victor (costinha) [04:31]: Até para posicionar o Igor, né, José, a gente chegou a falar disso. Só a gente diferenciar o que que é bug e o que que é falta de funcionalidade, porque tem uma diferença. No final do dia, para vocês é a mesma coisa, mas na operação aqui dos ajustes muda, né? Porque uma coisa é a gente corrigir, outra coisa é criar do zero. Então acho que é bom a gente pensar isso: o que que não tá funcionando porque tem, mas não dá certo, E o que que não tem que tinha que ter para fazer a operação funcionar bem. Vai facilitar aqui na hora de fazer esses ajustes aí. Mas vai lá, prossegue aí.

Igor de Souza Jesus [05:05]: Acho que tu tinha anotado no Word na reunião.

José Guilherme Oliveira [05:09]: Não, não, aquele que eu te mandei foi o que o Igor fez. Mas eu tô, eu procurei nesse Word, Igor, eu não tô achando. Eu acho que eu talvez fechei sem salvar. Mas enfim, vamos por partes aqui, ó. Primeiro ponto, João, é esse. Isso aqui é melhoria, né? Esse visão geral, essa tela que precisa mudar, mas é melhoria. Quando a gente fala aqui de equipes, ó, a gente não tá conseguindo trocar equipe com veículo, não é isso, Igor?

Igor de Souza Jesus [05:41]: Isso.

José Guilherme Oliveira [05:42]: Na verdade, João, aqui existia aquela trava de só troca através do checklist, tá? Mas aí tem duas questões aqui. Uma é essa trava, ela não pode ter, tá? Ela, eu acho que a gente tem que ter opção aqui de entrar na equipe, editar, e aí eu editar a placa do carro, editar o nome da equipe, porque acontece também, por exemplo, aqui a equipe 21 não é mais esse cara, é outro motorista, entendeu? E aqui no checklist também, ó, O Igor já fez vários checklists, mas tá sempre aqui criar primeiro, nunca aparece aqui o checklist que ele já fez, entendeu? Então a gente precisa permitir que essa edição das equipes seja feita, que a edição dos veículos com quem tá seja feita, tá? E permitir aqui também que a gente consiga editar qual é a km atual do carro,

joao victor (costinha) [06:44]: tá? Porque também não

José Guilherme Oliveira [06:45]: tem, não tem onde editar isso aqui. E aí aconteceu um cenário onde o Igor errou a digitação aqui de 1 km e agora ele não consegue mais corrigir.

joao victor (costinha) [06:56]: Tá, beleza, cara. Só tem uma coisa importante que a gente tem que pensar aí. Uma das coisas que o sistema veio para fazer foi para mitigar o carro ter problema. E quem foi que fez isso, né? E o checklist como obrigação, ele é, ele é por conta disso, né? Sempre que alguém trocar de carro, tem que ver como o carro tá para na mão da pessoa como é que tá o carro, né? E aí tô até provocando vocês: como a gente pode passar o carro para outra pessoa e ainda assim saber as condições do carro? O ideal, cara, pensando aqui assim agora, eu vejo a trava do checklist como importante, porque aquilo vai trocar o carro, vai chegar na hora, vai cobrar quem quando deu uma merda, né? Multa a gente consegue ver, porque multa tem data, tem hora. Agora, uma avaria um arranhadinho, alguma coisa assim, a gente não vai contemplar. E aí vai morrer na mão da empresa, que é o que tá acontecendo hoje, e que é o que o sistema veio para fazer. Então tô devolvendo essa dúvida aí para vocês, para ver como a gente lida com isso. Porque aquilo, multa, vai dar bom, tranquilo. Agora uma avaria, um arranhado, qualquer coisa a mais, uma quilometragem que passou, a gente não vai perder esse mapeamento. E são decisões, né, são decisões da gente pedir o mapeamento e facilitar o processo, ou manter. Enfim, né, o que que vocês acham?

Igor de Souza Jesus [08:18]: Posso falar? Pode. Eu acho que a questão do checklist realmente é bem válida. Inclusive, ela já até acontece quando o carro troca de motorista, sempre, sempre faço. É só mesmo uma questão que eu não consigo ter um histórico, né, do checklist que foi feito. Abrir aquele último que foi feito para tentar comparar, para ver se tem alguma diferença ali, principalmente nas fotos, né? Porque tem algumas avarias, né? Deixa eu colocar aqui, por exemplo, para-choque dianteiro arranhado. Fica muito subjetivo, né? Aí se chegar amanhã, tiver um outro arranhado, eu posso não lembrar exatamente qual foi o tipo de arranhado que eu notei daquela vez.

joao victor (costinha) [08:54]: Aí até para contextualizar, Igor, nego, por que que o sistema ficou assim, cara? Ele nasceu, né, foi o primeiro sistema do projeto. E aí o José viu e acreditou no projeto, e a gente começou a desenvolver outros sistemas, e esse ficou como o primeiro. Então a gente tava entendendo todo o workflow da empresa, todas essas questões, né, técnicas, e a gente deixou esse projeto de lado porque tinha outros mais prioritários, tipo de venda, de obra, de fornecedor. E aí a gente rodou uma auditoria grande de funcionalidade e enfim, essas coisas. E aí essa auditoria ficou parada no meio. Então o que que aconteceu? Foram feitos alguns ajustes, mas não foi terminado. Então isso quebrou várias coisas dentro do sistema. E aí qual é a ideia? A gente matou os sistemas prioritários que o José tinha, e agora vamos voltar a atuar nesse. Aí o José já sabe disso, já tá claro para ele, ele sabe. Mas aí só te dando esse contexto todo, sabe? É porque que tá assim, etc. Mas é isso, eu concordo com você, e deve ter muito mais problema aí, tá? Porque realmente a gente começou uma alteração e parou no meio. E esse sistema, ele é todo interligado, os módulos entre os outros. Então, se tu mexe numa coisa, vai mexer em outra. É um dos principais desafios aí. Inclusive, ele tá sendo até mais, ele é até mais robusto do que o gestão de obras, né, que tem mais integrações.

José Guilherme Oliveira [10:14]: O que que mais tem aqui de problema ainda?

Igor de Souza Jesus [10:17]: Eu achei uma anotação que eu fiz aqui. Tem a questão de registrar, né, as multas. Ela, eu consigo até registrar elas aqui no sistema. Mas não consigo solicitar desconto ou sair dessa parte de pendente.

joao victor (costinha) [10:31]: Boa, valeu.

Igor de Souza Jesus [10:32]: Eu só lanço e ela fica dessa forma aí, não aparece mais nada que eu consiga fazer. Tem, acredito que essa questão da edição, né, do KM ali que eu lanço diariamente, eu poderia ter essa edição porque assim, se eu digitar um número a mais ali, né, na hora de digitar eu for atualizar no dia seguinte, ele não vai deixar eu entrar com o km certo do carro porque vai estar dando um km inferior, né, no caso. E eu não consigo depois ir para frente, acaba que vai acumulando os dias sem lançar o odômetro do carro. E tem o principal aqui, eu acho que pelo menos aqui para mim, na minha tela, eu não consigo ver o histórico, né, do carro. É, tanto do carro quanto de abastecimento, eu consigo ter aqui na tela, né, só o abastecimento daquele mês. Eu não consigo puxar um relatório, por exemplo, de abastecimento que foi feito no mês passado, o que aquele carro exatamente rodou de km, o que ele abasteceu, a revisão que ele fez, o que ele não fez. Aí tem a revisão também, que eu consigo lançar revisão, mas eu não consigo entrar na revisão, para se lá na frente eu precisar abrir, né, ver o detalhe ali do que foi feito no tipo de serviço, o que foi trocado. Eu não consigo acessar, eu só consigo colocar ela aqui em dia, atualizar no sistema que foi feito, mas pelo menos para mim não mostra. Se depois eu precisar ver, sei lá, trocou a pastilha, não trocou, trocou o filtro, não trocou, eu lanço tudo isso aqui quando atualizo a revisão. Mas depois eu não consigo ter essa, essa visão histórica, né? Tu

José Guilherme Oliveira [12:16]: bota aqui nas

Igor de Souza Jesus [12:17]: observações, é isso aí, escrevo tudo aí, boto todas as peças que foram trocadas ali, o KM, a data, o local, e depois eu não consigo mais ver se eu precisar.

José Guilherme Oliveira [12:28]: Aqui tem uma questão também, João, que aqui nesse histórico de revisões, a próxima prevista não tá preenchendo sozinho. Na verdade, pelo que eu entendi, isso aqui foi mapeado para ser feito de forma manual, tá vendo? Não é que tem campo aqui no formulário, mas o ideal assim é uma regra que todos os carros fazem de 10 em 10 mil.

joao victor (costinha) [12:55]: Então quando bater 10, já cria a tarefa de revisão, entendeu?

José Guilherme Oliveira [12:59]: Porque a gente tem o km diário, então a gente tá acompanhando ali. Então a gente consegue fazer uma projeção de dia tal esse carro vai bater 50 mil, por exemplo, entendeu? Então assim, hoje o Igor ele tem uma lista das últimas revisões feitas, com qual km foi, né, Igor? E aí ele pode inclusive passar isso para já alimentar o sistema, e o sistema a partir dessa lista, entendeu?

joao victor (costinha) [13:28]: Não, beleza.

Igor de Souza Jesus [13:29]: Essa regra dos 10 mil só não seria em relação a alguma corretiva. Por exemplo, a embreagem do carro da 5 que foi feita, teria que ter também essa opção de eu não prever, né, a próxima, já que tem

joao victor (costinha) [13:42]: os dois, né, um automático e

Igor de Souza Jesus [13:44]: manual. Isso aí, já que não

José Guilherme Oliveira [13:46]: é uma, na verdade, assim, aí o cenário ideal, Igor, era que a gente tivesse aqui não só revisão, mas a parte, o módulo manutenção corretiva, entendeu? Porque são manutenções que geram custo.

Igor de Souza Jesus [14:00]: É, aqui eu tô, aqui eu lancei todas as revisões que nós fizemos, tanto a corretiva quanto a preventiva, tá tudo junto aqui. Aí eu dividi as que foram repassadas para gente, eu coloquei o valor aqui nosso, e o que foi só da maestra ou só da locadora eu coloquei 00, né, que aí não foi passado valor nenhum.

José Guilherme Oliveira [14:18]: É, pode ser assim também, pode ser.

joao victor (costinha) [14:26]: Não, boa, beleza. Eu vou dar prioridade nisso aí que vocês falaram, e aí a gente faz uma próxima bateria quando tiver com isso resolvido, e a gente já vê mais coisa, né? Você já ficou aí de olho.

José Guilherme Oliveira [14:38]: Se quiser, tem mais algum, tem mais algum bug, Igor? Você lembra?

Igor de Souza Jesus [14:42]: Eu não consigo lançar o valor da locação de cada veículo.

joao victor (costinha) [14:48]: Boa, é, pode falar tudo que tu quiser, tudo que tu falar eu vou trazer na próxima. Se tu quiser priorizar e fazer com calma, por pura estratégia tua aí de desenvolvimento, né, do projeto, a gente faz por etapa também. Mas se quiser mandar tudo, já manda aí.

Igor de Souza Jesus [15:05]: Eu só pegando as anotações aqui que eu já mando tudo, porque eu tenho algumas funções aqui que depende da atualização, né. Por exemplo, atribuir motorista para 19, trocar o motorista da mudar o carro da 5. Isso eu tendo, né, como fazer, atualizando, né, a questão do checklist ali, de fato mudando o carro da equipe. Isso aí eu já consigo resolver.

José Guilherme Oliveira [15:33]: Boa. Tem a questão também do documento, João. Assim, por exemplo, o André Vinícius, ele tá constando como CNH vencida um tempão, mas ele não tem mais CNH vencida. Ele não tá nem mais aqui, já tem tanto tempo que acho que nem aparece mais. E aí precisa ter opção de atualizar essa documentação, tá? Mas eu acho que nem, não é nenhuma questão para agora, porque depois a gente pode fazer uma melhoria nisso aqui de forma mais robusta, e a gente faz integrar com o Drive, entendeu? Mas é isso, Igor. Pode falar aí se tiver mais coisa.

Igor de Souza Jesus [16:19]: Deixa eu pegar a relação que eu tinha te mandado.

José Guilherme Oliveira [16:22]: O principal, Ivan, assim, pelo que eu entendi, assim, o principal é essa relação entre motorista, equipe e carro.

joao victor (costinha) [16:35]: Sim, manutenção, né?

José Guilherme Oliveira [16:38]: Não, não manutenção, cadastro. Base, entendeu? Que aí ele não consegue atualizar isso e consequentemente fica tudo errado. Sim, entendeu? E aí a questão do KM diário também precisa ter opção de editar, entendeu? Eu acho que você tinha que pensar numa ficha do veículo, entendeu? Igual a gente tem lá a ficha da obra, ter a ficha do veículo. Já tem isso aqui mais ou menos, né? Quando você entra aqui, ó, entendeu? Só que aí eu acho que falta essa opção de mudar.

joao victor (costinha) [17:21]: Tá bom, beleza,

Igor de Souza Jesus [17:22]: deixa comigo, porque algumas atualizações que eu tento fazer no próprio sistema aqui acusa mensagem de que só administrador consegue fazer essa edição.

José Guilherme Oliveira [17:33]: O quê?

joao victor (costinha) [17:35]: Tem essa questão também, né, do nível de acesso. Eu lembro até que eu já tinha mexido em algumas edições, mas provavelmente questão do nível de acesso tá travando mesmo.

Igor de Souza Jesus [17:46]: E se eu quiser editar, por exemplo, a equipe, né, mudar o motorista ali, já tendo feito o checklist, se não atualizar sozinho, eu preciso manualmente ali mudar. Só que aí não muda, diz que eu preciso ter acesso de, é isso mesmo, acesso de administrador.

José Guilherme Oliveira [18:03]: Revisa as permissões dele então, João, vê o que que ele não tem permissão, aí tu me manda, eu valido aqui. E se for o caso, se precisar, a gente cria um fluxo de aprovação diferente, entendeu?

joao victor (costinha) [18:14]: Tá bom, beleza.

José Guilherme Oliveira [18:17]: Então assim, faz essa, pode falar aí.

Igor de Souza Jesus [18:19]: Esse KM diário também ele só deixa eu editar se talvez até tenha como editar, mas eu aparece aqui para mim pelo menos que Que eu não tenho acesso de administrador. Ele pede para colocar uma senha.

José Guilherme Oliveira [18:33]: Eu acho que não consegue editar porque aqui no cadastro do carro, tá vendo, não tem, não mostra KM.

Igor de Souza Jesus [18:45]: Clicando ali no KM diário, se eu tentar cancelar qualquer um desses aí no vermelho, ali no X, ele pede como se fosse uma senha, né, uma confirmação. Aí eu escrevo aqui na gestão de frotas, que é o que pede, mas aí acusa que eu não tenho permissão.

joao victor (costinha) [19:04]: Beleza, eu vou rever isso aí também.

Igor de Souza Jesus [19:06]: Isso vale também para o abastecimento. Se eu digitar qualquer número errado ali na hora do abastecimento, ali seja o litro, o km, ele acusa, eu não consigo editar depois.

José Guilherme Oliveira [19:19]: E Esse formato aqui de histórico de base tá uma merda, entendeu? O ideal é que tenha, porque assim, as duas telas são tão juntas, né? O ideal é que seja tipo dashboard, né? Não, tem que ter uma base igual gestão de obras assim, sabe? Tem uma tabela com as informações aqui. E aí, se for o caso, tem um botão aqui registrar o novo abastecimento, e aí abre o formulário de solicitação. Acho que isso se repete aqui também no KM diário, né? Tudo isso aqui, tá vendo? Não, como é que a gente, como é que isso aqui é uma base? Como é que eu exporto isso aqui? Vai sair com informação nenhuma, entendeu? Tem que ter um formato de tabela aqui, base de dados melhor.

joao victor (costinha) [20:12]: Não, beleza, deixa comigo.

Igor de Souza Jesus [20:14]: Mas me abre aqui do sinistro também, não consigo dar da tratativa. Eu consigo cadastrar, coloca aqui em tratativa, mas se eu precisar atualizar ou encerrar ou manter em aberto, ele não salva. Eu clico em salvar e ele aparece que tá salvando, mas para mim ele não muda.

José Guilherme Oliveira [20:33]: Ele volta aqui, ó, aberto.

joao victor (costinha) [20:35]: Isso é uma coisa que dá para fazer, mas não tá dando certo. Então é bug.

José Guilherme Oliveira [20:40]: E outra coisa, não tem onde voltar aqui, ó. Se eu abrir esse sinistro, eu não consigo voltar para tela lá.

joao victor (costinha) [20:46]: Para tela de sinistro, vai ter que clicar na aba de novo. Ele salvou

José Guilherme Oliveira [20:55]: uma aberta, mas

joao victor (costinha) [20:56]: bugou lá naquela hora, não deu a confirmação de salvamento. Isso aí faz diferença para caramba. Aí parece que não deu certo. Mas fala aí, Igor, o que que tu vai falar?

Igor de Souza Jesus [21:05]: A questão da quantidade de fotos também, se der para aumentar, porque acho que duas fotos, dependendo do sinistro, pode ser pouca. Na hora de cadastrar ali tem

José Guilherme Oliveira [21:14]: um ponto que a gente colocou aqui. A gente travou muito, né, a quantidade de fotos. Deixa isso aqui em aberto, cara, tanto para cá quanto para o— é porque o checklist ele é um pouco mais orientativo no sentido das fotos, entendeu? Que aí ele pede de fato uma foto da frente, da traseira, mas aqui Eu não sei se só dá para botar uma, tipo frente, só dá para botar uma foto. Então aí é ruim, João. Aí é melhor você ter, por

joao victor (costinha) [21:48]: exemplo, uma indicação de fotos, né, tipo frente, pá, e

José Guilherme Oliveira [21:52]: não delimitado. Aí a pessoa anexa ali, mas não delimitado, entendeu?

joao victor (costinha) [21:57]: Boa.

Igor de Souza Jesus [21:57]: Eu acho que é uma parte também interessante que já tem no checklist que eu montei aqui do que eu faço pelo celular. Seria a foto só da avaria, porque como eu falei, tem avaria aqui no para-choque que dependendo da foto que eu tirar de frente ele não vai conseguir pegar tão bem, entendeu? Dependendo do ângulo. Então se tivesse uma aba só para foto de avaria seria interessante, porque aí a gente conseguia tirar uma foto exata ali do problema, ali tirar uma foto mais centralizada ali do—

joao victor (costinha) [22:27]: beleza. De repente aba avaria, foto da peça e foto da avaria, né?

Igor de Souza Jesus [22:31]: Isso. Se eu colocar aqui na hora de preencher aqui, lá estaria, escrever por exemplo problema Aí abre uma nova aba onde eu consigo colocar aquelas fotos ali, escrever tudo que tem e anexar a foto ali.

joao victor (costinha) [22:47]: Beleza, é isso. Tiver mais alguma coisa, vai falando. Igor, se lembrar depois, manda também para o José. Se o José quiser também me botar em contato com Igor para sair desse processo, né, pode ser também. Vê o que você achar melhor. Essa aba

Igor de Souza Jesus [23:01]: de disponibilidade aqui que tem aqui embaixo, aqui na gestão, esse percentual aqui é

joao victor (costinha) [23:07]: referente, cara, essa disponibilidade ia ser entender as frotas que tem hoje, o que que tá sendo usado, o que que tá livre, o que que tá em revisão, o que que tá no mecânico, né? Então a ideia é essa. E como eu te falei, a gente fez uma bateria de ajuste que parou no meio, então realmente vai ter coisa aí que não tá funcionando. Tem coisa que tá incompleto, a gente priorizou outras coisas. Aí de segunda para cá que a gente está olhando para isso, né, de ontem para cá.

José Guilherme Oliveira [23:39]: E aí tem aqui em pendências, isso aqui tem que pedir também, João, para dar uma olhada aí, para ver o que que de fato é uma pendência, né.

joao victor (costinha) [23:58]: Tá, é isso. Agora é ajustar esses erros, depois partir para os erros, para os erros não, para as atualizações notificar no email, por exemplo, né? Para o Igor não ter que ficar, ó, tem que revisar aqui, e sim já bater no email dele, já bateu no teu. E é isso, Igor. Se tiver alguma funcionalidade que tu viu em outro sistema, uma experiência que tu teve em outro lugar, cara, manda para cá que a gente faz, faz acontecer.

Igor de Souza Jesus [24:22]: Essa revisão aqui também, né, a próxima revisão prevista. Tem um exemplo aqui do carro da equipe 25 que eu lanço o km acima do km que tá lá na revisão, ele não acusa nada, né, que o carro já passou, que não passou da revisão.

joao victor (costinha) [24:36]: Então tem que ter esse markdown, né?

Igor de Souza Jesus [24:38]: Tem que ter esse— eu tô lançando o km previsto, né, para a próxima revisão, mas ele não tá sincronizando com o km diário que eu lanço. E não avisa se passou, se não passou.

José Guilherme Oliveira [24:55]: Aí, João, um ponto de melhoria com a questão aqui do abastecimento: tem um modelo de relatório que a TicketLog manda para gente em TXT. Eu vou procurar esse modelo aqui e vou te mandar, e te mando junto com a planilha que a gente extrai. Aí é só cruzar aí se tem todas as informações nesse TXT. Porque se tiver, aí a gente bota o sistema para começar a ler esse arquivo, e aí esse relatório aqui se preenche sozinho e ele só dá os alertas, entendeu? Sem o Igor ter que ficar aqui digitando todo dia.

joao victor (costinha) [25:29]: Bom,

José Guilherme Oliveira [25:29]: ou até mesmo, ou até mesmo para esse primeiro momento, o que a gente podia fazer é importar a planilha de Excel aqui. Entendeu? Vai ser mais fácil até.

joao victor (costinha) [25:46]: Tá, vou bater ali que o Igor falou e bater isso com que você falou. Caso tem algum questionamento, eu trago aí para você.

Igor de Souza Jesus [25:54]: Talvez seria interessante, Zé, ter nessa gestão aqui cadastrar, por exemplo, o cartão de cada motorista, porque na hora que importar a planilha ele cruzar com o cartão. Porque aquela questão da placa lá, mesmo eu alterando o número da frota Pode ser que tenha alguma divergência, mas já o número do cartão não vai mudar.

José Guilherme Oliveira [26:14]: Essa aba aqui, motoristas de cadastro, tá muito fraco, viu? Precisa melhorar isso aqui, deixar isso aqui num formato de tabela, entendeu?

joao victor (costinha) [26:22]: Poder pesquisar as pessoas, né?

Igor de Souza Jesus [26:28]: Na planilha do Excel eu coloquei um histórico, né, de que equipe para o veículo da equipe e o motorista da equipe. Porque conforme eu vou lançando o km diário, né, pelo menos aqui na planilha, para mim ficou mais fácil. Eu coloco só a equipe, ele já traz para mim quem é o motorista e quem é o, qual é o carro, né, daquela equipe naquele dia. E talvez seria interessante também no sistema ter esse histórico, né, do motorista ali ter um como é que eu posso dizer, um extrato, né, de que tempo ficou aquele carro com aquela equipe, com aquele motorista. Porque tem alternado, né, algumas vezes tem alternado motorista da equipe, eu tenho alternado o carro da equipe. E aí, para não se perder, né, a informação de qual carro tava com qual equipe, com qual motorista, eu tenho esse histórico aqui que eu cadastro. Se o carro mudar, eu coloco a data que mudou e para qual carro ele foi. E aí, na hora de eu lançar esse km, já E já extrai essa informação dessa data e já preenche.

José Guilherme Oliveira [27:36]: É isso, fechou, João? Tem uma outra agenda aqui, precisa ir lá.

joao victor (costinha) [27:43]: Fechou, valeu, rapaziada. Aí, lembrar de alguma coisa, só dá um alô, conta com a gente. Isso aí tem que ficar bom para você antes de tudo. Então, que você fala vai estar falado, tá?

Igor de Souza Jesus [27:53]: Tá, beleza. Vou ver com o José para pegar o teu contato e qualquer coisa eu vou falando contigo.

joao victor (costinha) [27:59]: Não, beleza. Vai adiantar todo mundo, adianta eu, adianta tu, adianta o José. Eu acho que é jogo, mas vamos ver o que ele quer, tá? Valeu, rapaziada, até já.

José Guilherme Oliveira [28:08]: Valeu, tchau tchau,

joao victor (costinha) [28:08]: um abraço.
