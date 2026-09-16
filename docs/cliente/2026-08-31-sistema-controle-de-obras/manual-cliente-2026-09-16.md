# Controle de Obras — manual de uso

**Manfac Facilities · 16/09/2026**

O sistema deixou de estar vazio. Na madrugada de 16/09, às 03:11, a primeira carga
entrou: o sistema leu **185 ordens de serviço** no Field Control e trouxe **64 obras**
para dentro do Controle de Obras. As outras 121 ficaram de fora porque já estavam
concluídas, reportadas ou a caminho — não são obras para acompanhar.

**O critério de entrada é o que foi combinado:** entra a OS do tipo *Atividade Spot*
cuja **última atividade** esteja em **pendente**, **agendada** ou **em andamento**.
Mudar esse critério depois é mexer numa lista só, num lugar só.

**As 64 obras entraram com três informações:** número da OS, loja e descrição do
chamado. Mais nada — o Field Control só devolve esses três campos. Por isso todas estão
na etapa **"Aguardando definição"**, esperando alguém dizer quem é o responsável, qual
equipe vai, quando começa e quanto tempo dura.

**A atualização automática já está ligada.** Desde as 03:25 de 16/09, o sistema procura
OS nova sozinho **a cada 5 minutos** e, **uma vez por dia**, faz uma varredura completa
para conferir tudo o que existe no Field. Ninguém precisa mais clicar em nada para a
obra nova aparecer.

> **Se alguma tela der erro:** uma correção subiu em 16/09. Quem tiver deixado a página
> aberta antes disso precisa recarregar com **Ctrl + Shift + R** (segurando as três
> teclas). Isso resolve.

---

# Parte 1 — Como testar o sistema hoje

Roteiro para percorrer o sistema inteiro em uma sessão, do primeiro login à primeira
cobrança respondida. Cada passo diz **o que fazer** e **o que você deve ver na tela**.

## Passo 1 — Liberar as contas e os acessos (é o primeiro passo, e hoje ele trava tudo)

Hoje **ninguém da equipe consegue abrir o Controle de Obras**, exceto os 3
administradores do hub. Duas coisas precisam acontecer, nesta ordem:

1. **Conta no hub.** O **Yuri ainda não tem conta** — sem conta ele não entra no sistema
   de jeito nenhum. A **Amanda já tem**. Ao todo existem 12 contas no hub hoje.
2. **Acesso ao módulo.** Mesmo com conta, a pessoa não vê o Controle de Obras enquanto
   um administrador não marcar o acesso dela na tela **Admin → Acessos**. Hoje esse
   acesso não está marcado para ninguém.

**O que você deve ver depois:** no próximo login da pessoa, o quadro **🏗️ Controle de
Obras** aparece na tela inicial do hub, ao lado dos outros sistemas. Enquanto o acesso
não for liberado, esse quadro simplesmente não existe para ela.

Enquanto isso não for feito, os passos abaixo só funcionam para quem é administrador.

## Passo 2 — Entrar e abrir a base

**O que fazer:** entre em `hub.manfac.com.br`, faça login e clique no quadro
**Controle de Obras**.

**O que você deve ver:** o sistema abre direto na **Base de obras**, com três abas no
topo — *Diário do dia*, *Tarefas* e *Base de obras* — e uma tabela com **64 linhas**,
uma por obra. Cada linha traz o número da OS, a loja e a descrição do chamado, e a
etiqueta laranja **"Aguardando definição"**.

Acima da tabela há oito números-resumo: aguardando definição, em andamento, paralisadas,
executadas na esteira, sem OS aprovada, sem cobertura, aprovadas há mais de 60 dias e
passaram da duração planejada.

**Hoje, o esperado é:** "aguardando definição" = 64, e os outros sete em zero ou perto
disso. Não é falha: nenhuma obra foi definida ainda, e as datas de aprovação e de
duração não vieram do Field.

## Passo 3 — Ver a mesma base em cartões

**O que fazer:** no seletor **Tabela / Kanban**, no topo da Base de obras, escolha
*Kanban*.

**O que você deve ver:** quatro colunas — *Antes de executar*, *Executando*,
*Fechamento*, *Faturamento* — com as 64 obras todas amontoadas na primeira coluna, cada
cartão com "Aguardando definição" embaixo do nome da loja.

## Passo 4 — Filtrar

**O que fazer:** no filtro **Etapa da obra**, escolha "Aguardando definição". Depois
volte para "todas".

**O que você deve ver:** a tabela muda, mas **os oito números do topo continuam os
mesmos**. Isso é de propósito: os indicadores mostram sempre a operação inteira, para
que ninguém filtre a tela e conclua que o problema sumiu.

## Passo 5 — Abrir uma obra

**O que fazer:** clique na loja de qualquer linha da tabela.

**O que você deve ver:** como a obra ainda está em "Aguardando definição", ela abre no
modo **triagem**, com uma faixa laranja: *"Obra nova, esperando você definir"*, e um
contador *"0 de 5 preenchidos"*.

Do lado esquerdo, o bloco **"O que veio do Field"** mostra número da OS, loja e chamado
preenchidos — e **Tipo, Valor, Analista, Origem e Aprovada em vazios**, com um traço.
É exatamente o que o Field manda hoje. Pelo mesmo motivo, a faixa laranja diz "entrou
pelo Field em —" e "esperando há 0 dias": a data de aprovação não veio, então não há de
onde contar.

## Passo 6 — Fazer a triagem de uma obra

Este é o passo que transforma uma linha do Field em obra de verdade.

**O que fazer:** no bloco **"O que falta definir"**, preencha os cinco campos:

| Campo | O que escolher |
|---|---|
| 1. Responsável da obra | quem vai responder por ela todo dia |
| 2. Equipe / prestador | quem vai executar |
| 3. Prioridade | a urgência dela |
| 4. Data de início | quando a equipe entra na loja |
| 5. Duração em dias | a data final o sistema calcula sozinho |

Se algum analista da loja autorizou começar antes de a OS estar aprovada, registre
também **"Liberado por"** e **"Data da liberação"**, no bloco de baixo. Esses dois são
opcionais — obra com OS já aprovada não precisa deles.

Depois clique em **"Liberar para o diário do dia"**.

**O que você deve ver:** cada campo preenchido ganha um ✓ verde e o contador sobe ("3 de
5 preenchidos"). Enquanto faltar campo, o botão fica apagado e o aviso diz *"Faltam 2
campos. Enquanto isso a obra não aparece para ninguém responder."* Ao liberar, o sistema
devolve você para a Base de obras e a obra aparece agora como **"Levantamento"**.

> **Detalhe que importa para o teste:** escolha como **Responsável** a mesma pessoa que
> vai abrir o Diário do dia no passo seguinte. O sistema liga a conta de login à pessoa
> da obra **pelo primeiro nome do e-mail** — `yuri.nascimento@manfac.com.br` vira
> `YURI`. Se você marcar YURI como responsável e entrar com outro login, o diário
> aparecerá vazio, e não é erro.

Faça isso em **duas ou três obras**, para o próximo passo ter com o que trabalhar.

## Passo 7 — Responder o Diário do dia

É a rotina principal do sistema — o que substitui a cobrança feita hoje por telefone e
planilha.

**O que fazer:** clique na aba **Diário do dia**. Em um dos cartões:

1. Responda **"Andou hoje?"** — Sim ou Não.
2. Se a resposta for **Não**, escolha **"Por que não andou?"** — o motivo é obrigatório.
3. Se faltou alguma coisa, responda **"Faltou algum item?"**.
4. Clique em **salvar**.

**O que você deve ver:** antes de salvar, o próprio cartão escreve o que vai acontecer
("vai abrir uma cobrança para…"). Depois de salvar, o cartão **sai da fila** e desce
para a lista *"Já respondidas"*. Se você marcou "Não" ou apontou uma falta, **nasce
automaticamente uma cobrança** na aba Tarefas.

**Quem vê o quê:** cada pessoa vê só as obras em que ela é a **Responsável**, e só as
que estão em Levantamento, Em andamento ou Paralisado. Administrador vê todas, com um
seletor para escolher de quem é a fila.

## Passo 8 — Anexar a foto do dia

**O que fazer:** num cartão de obra que já está em campo, clique em **"+ anexar foto do
dia"**, escolha uma imagem do celular e salve.

**O que você deve ver:** a foto é reduzida no próprio aparelho antes de subir (não
consome o pacote de dados da equipe) e passa a aparecer na ficha da obra, no bloco
**"Evolução em fotos"**, em ordem de dia. Não anexar **não** impede salvar o diário —
mas abre uma cobrança pedindo a foto para a equipe da obra.

## Passo 9 — Desfazer uma resposta

**O que fazer:** na lista *"Já respondidas"*, clique em **Desfazer**.

**O que você deve ver:** a obra volta para a fila de pendentes do dia. As cobranças que
aquela resposta abriu e que **ainda não foram respondidas** somem junto. Cobrança que
outra pessoa já respondeu continua existindo — o trabalho dela não é apagado.

## Passo 10 — Ver e responder uma cobrança

**O que fazer:** abra a aba **Tarefas**.

**O que você deve ver:** a lista agrupada **por dono**, sem filtro e sem ordenação para
escolher — vencidas em vermelho no topo, depois quem está há mais tempo com a bola.
Ninguém digita tarefa aqui: toda linha nasceu de um diário respondido.

Clique em **"Marcar como respondida"** e escreva o que foi feito. A linha sai de
*Abertas* e entra em *Respondidas*, com data, hora e o que foi escrito.

**O destino de cada falta é fixo:**

| Faltou | Vai para |
|---|---|
| Material | Compras (Roberta) — comprar |
| Ferramenta | Obras (Yuri) |
| Equipe | Obras (Yuri) — ver o que dá para remanejar |
| Documento / ART | Obras (Yuri) |
| Foto do dia | a **equipe da obra**, que é quem está lá |
| Outro | Obras (Yuri) — ler e dizer quem resolve |

## Passo 11 — Mover uma obra de etapa

**O que fazer:** abra a ficha de uma obra já liberada e, no fim do bloco **"Ciclo de
vida da obra"**, escolha outra etapa e clique em **"Confirmar mudança"**.

**O que você deve ver:** a etapa muda na hora e o contador "dias parada nesta etapa"
zera. O sistema guarda quem mudou e quando.

## Passo 12 — Conferir a sincronização com o Field (só administrador)

**O que fazer:** abra `hub.manfac.com.br/obras/sincronizar` digitando o endereço — essa
tela não tem link no menu, e é a única que escreve na base inteira de uma vez.

**O que você deve ver:** o botão **"Puxar do Field"**, o **histórico das últimas 10
execuções** (início, tipo, origem, resultado) e, na última linha registrada, a carga de
16/09: 185 OS lidas, 64 obras criadas, 121 ignoradas, sem erro. Com a atualização
automática ligada, novas linhas passam a aparecer aqui sozinhas, marcadas como
*agendada*.

Pode clicar em "Puxar do Field" quantas vezes quiser: **OS que já existe nunca é
duplicada**, e o que foi digitado aqui dentro **nunca é sobrescrito** pelo Field.

---

# Parte 2 — Como usar cada funcionalidade

## Base de obras

**Para que serve:** responder "onde está cada obra" numa tela só. É a substituta da
planilha.

**Quando usar:** para ter o retrato do dia, achar uma obra específica e abrir a ficha
dela.

**Como funciona:** oito indicadores no topo, e abaixo a lista em **Tabela** ou
**Kanban**. Os filtros mudam a lista, nunca os indicadores.

**O que ainda não funciona hoje:** os indicadores *"aprovadas há mais de 60 dias"* e
*"passaram da duração planejada"* vão ficar em **zero** enquanto ninguém puder digitar a
data de aprovação e a duração — a duração entra na triagem, a data de aprovação só na
próxima entrega (item 2 da Parte 3).

## Ficha da obra

**Para que serve:** tudo sobre uma obra num lugar só — ciclo de vida, autorização,
identificação, cronograma, remarcações, fotos, diário e cobranças.

**Quando usar:** antes de cobrar alguém, antes de uma reunião, ou quando alguém pergunta
"o que houve com essa obra?".

**Como funciona:** abre clicando na obra em qualquer lista, e volta para a lista de onde
veio. O bloco **Autorização** mostra o que destrava a execução (OS aprovada ou liberação
com nome) e marca **"Sem cobertura"** em vermelho quando a obra não tem nem uma nem
outra — ou seja, equipe em campo sem ninguém nomeado que tenha autorizado.

**O que ainda não funciona hoje:**
- **A ficha é só de leitura.** Os cerca de 30 campos que o Field não manda — valor, tipo,
  analista do cliente, origem, data de aprovação da OS — estão vazios e **não há onde
  digitá-los** até a próxima entrega.
- O bloco **"Vindo do Field"** avisa na tela que o relatório fotográfico e o PDF de
  entrega **ainda não chegam automaticamente**.
- A esteira desenhada na ficha ainda não marca passo concluído: as datas de cada marco
  só passam a ser gravadas com o botão "Concluir esta etapa" (item 5 da Parte 3).

## Triagem

**Para que serve:** é o checklist de entrada. A obra vem do Field sem responsável, sem
equipe e sem cronograma; a triagem é onde isso é decidido.

**Quando usar:** sempre que uma obra nova aparecer em "Aguardando definição" — hoje, as
64.

**O que acontece depois:** ao liberar, a obra vai para **Levantamento**, entra na fila do
Diário do dia do responsável escolhido e passa a ser cobrada todo dia. Antes disso ela
não aparece para ninguém responder, de propósito.

## Diário do dia

**Para que serve:** substituir a pergunta "andou?" feita no telefone. Uma resposta por
obra, por dia.

**Quando usar:** todo dia, por cada responsável.

**O que acontece depois:** a resposta fica gravada; "não andou" com motivo e falta de
item viram cobrança com dono e prazo, na hora, sem ninguém digitar nada.

**O que ainda não funciona hoje:**
- A lista de motivos de "não andou" é **fixa** — ainda não dá para cadastrar um motivo
  novo pela tela.
- **Não existe nenhum aviso automático.** Quem esquecer de responder não recebe nada às
  18h nem às 19h; hoje isso só aparece para quem abrir a tela (item 10 da Parte 3).

## Tarefas

**Para que serve:** a falta virando cobrança com dono, prazo e resposta escrita. É o
registro de quem estava com a bola e o que fez.

**Quando usar:** todo dia, por quem recebe cobrança (Compras, Obras, equipes) — e nas
reuniões, para ver o que está vencido.

**O que ainda não funciona hoje:**
- Tarefa vencida fica vermelha e sobe para o topo, mas **não avisa ninguém sozinha**.
- O prazo de uma cobrança aberta depois das 18h cai no **dia seguinte corrido**, mesmo
  que seja sábado ou domingo.

## Sincronização com o Field Control

**Para que serve:** trazer a OS do Field para cá como obra, sem ninguém redigitar.

**Quando usar:** a partir de agora, **em nenhum momento** — ela passa a rodar sozinha, a
cada 5 minutos, com uma varredura completa uma vez por dia. O botão continua existindo
para quando alguém quiser forçar a busca na hora.

**As três regras, que valem tanto para o botão quanto para a busca automática:**
1. OS que não existe aqui **vira obra nova**, em "Aguardando definição".
2. OS que já existe **só ganha o que falta** — campo que alguém digitou aqui fica como
   está, mesmo que o Field traga outro valor. A etapa e a triagem nunca são tocadas.
3. OS sem número **fica de fora**, com o motivo no relatório.

**O que ainda não funciona hoje:** quando o cliente **cancela** uma OS no Field, ela muda
de situação lá, mas o sistema **não detecta esse cancelamento sozinho** — a obra continua
aqui até alguém tratá-la à mão. É o item 7 da Parte 3.

---

# Parte 3 — O que falta para ficar pronto

Só está listado o que **realmente falta**. O que já foi entregue saiu da conta: a carga
das obras, o filtro de entrada, a nova regra da obra em atenção/crítica (20 e 30 dias,
contando da data mais antiga entre entrada, liberação e aprovação) e a primeira parte do
histórico de alterações já estão no ar.

| # | Tarefa | O que entrega | Horas | Data prevista |
|---|---|---|---|---|
| 1 | Conta do Yuri e liberação de acesso da equipe | as pessoas entram no sistema e passam a ver as 64 obras — hoje só os administradores veem | 1h | 16/09 |
| 2 | Ficha e triagem editáveis, com remarcação por motivo | preencher aqui o que o Field não manda (valor, tipo, analista, origem, data de aprovação da OS) e mudar a data de início só com motivo registrado, de uma lista padronizada em que se pode cadastrar motivo novo | 5–8h | trabalho 17–18/09 · no ar 21/09 |
| 3 | Histórico de alterações ligado | cada alteração com campo, valor antigo, valor novo, quem mudou e quando | 2h | no ar 21/09 |
| 4 | Revisão independente e ajustes antes de publicar | garante que as entregas 2 e 3 não quebrem o que já está funcionando | 2h | 18–21/09 |
| 5 | Botão "Concluir esta etapa" e as datas dos 7 marcos | a data de cada passo da esteira passa a ser gravada; a esteira deixa de ser desenho e vira histórico | 2–4h | 21–22/09 |
| 6 | Os dois SLAs da reunião semanal | dias desde a autorização sem OS aprovada, e dias do fechamento da OS até o faturamento — os dois contadores que você apresenta ao cliente toda semana | 2–4h | 22–23/09 |
| 7 | Cancelamento de obra | cancelar com motivo e autoria, sai do diário e das cobranças na hora, e dá para reverter | 6–10h | trabalho 23–24/09 · no ar 25/09 |
| 8 | Pedido de compra | registrar número e data de chegada, e exigir isso antes de a obra ir para faturamento | 2–4h | trabalho 25/09 · no ar 28/09 |
| 9 | Manual do fluxo real e treinamento da equipe | manual reescrito com as telas novas e o treinamento presencial | 2–3h + treinamento | manual 23/09 · treinamento na semana de 28/09 |
| | **Total** | | **24–38h (cerca de 31h)** | **fim previsto 28/09** |

| Fora do total | Por quê |
|---|---|
| **Aviso automático das 18h/19h** — lembrete por WhatsApp e e-mail para quem não respondeu o diário | Está decidido que é imprescindível, e a base técnica que dispara na hora certa já existe. Mas ele ainda não foi desenhado, e estimar antes de desenhar seria chute. Entra no cronograma com número assim que o desenho ficar pronto. |
| **Painel de reunião, relatório para o cliente e agente cobrador** | Adiados em 31/08, por decisão de vocês. Entram depois que a equipe estiver usando o sistema todo dia. |

## O que estará pronto até 21/09

Até **21/09** ficam no ar os itens **1 a 4**: acesso liberado, ficha e triagem
editáveis, remarcação com motivo e histórico de alterações. Isso é o que cobre o
trabalho de atualizar a base, montar o cronograma da obra e registrar o que mudou.

Os itens **5 a 8** — marcos da esteira, SLAs, cancelamento e pedido de compra — seguem
até **28/09**. O plano completo tem uma faixa realista de **25/09 a 01/10**, porque cada
entrega depende de a anterior ter sido publicada e conferida.

## Duas coisas que dependem de uma definição, e ficam registradas como tal

- **A meta do SLA de aprovação da OS** (quantos dias sem OS aprovada já é demais) ainda
  não foi definida. Até que seja, o sistema vai usar **20 dias para amarelo e 30 para
  vermelho**, os mesmos números da obra crítica. O SLA de faturamento já está definido:
  amarelo acima de **15 dias**, vermelho acima de **30**, contando do fechamento da OS
  no sistema do cliente até a obra ser faturada.
- **A data do treinamento** da equipe ainda não está marcada. A semana de 28/09 é a
  previsão do plano, não um compromisso fechado.
