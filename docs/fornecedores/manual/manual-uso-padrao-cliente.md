# Gestão de Fornecedores — manual de uso

**Onde fica:** hub.manfac.com.br → card **Gestão de Fornecedores**
**Quem pode usar:** qualquer pessoa com login no hub. Não precisa de liberação.

A Gestão de Fornecedores é o lugar onde a Manfac registra o contrato com cada
fornecedor, controla quanto já foi medido e acompanha o pagamento. O que muda: a
medição aprovada vira, sozinha, uma solicitação de pagamento no Financeiro,
sem ninguém redigitar.

Não existe senha separada: basta estar logado no hub. O menu lateral tem dois
grupos: **Contratação** (Contratos e Aprovações) e **Medição** (Nova medição,
Fila de aprovação e Acompanhamento). Para o José e para quem ele indicar, há um
terceiro grupo, **Configurações** (Condições de pagamento e Modelo de contrato).

### Palavras que aparecem na tela

| Palavra | O que quer dizer |
|---|---|
| **Contrato específico** | Contrato de uma obra. A obra é obrigatória. |
| **Contrato global** | Contrato sem obra, para serviços avulsos (Spot) ou de manutenção. Tem um valor teto, que as medições vão consumindo. |
| **Medição** | O pedido de pagamento de uma parte do contrato. |
| **Aditivo** | Mudança num contrato já aprovado: aumentar o valor ou trocar a condição de pagamento. |
| **Homologação** | Conferência cadastral de um fornecedor que a Manfac nunca usou. |
| **Aceite final e retenção** | Em obra crítica, os 10% finais só são medidos depois do aceite final. |

---

## As duas coisas que fazem a sua medição chegar ao pagamento

Se você ler só uma parte deste manual, leia esta.

### 1. Peça a medição até o dia 25

| Quando você envia | Entra no pagamento de |
|---|---|
| Até o dia 25 (inclusive) | O mês atual |
| Do dia 26 em diante | O mês seguinte |

O sistema não impede o envio depois do dia 25; só avisa, e a tela mostra quantos
dias faltam para o corte.

Depois de aprovada, quem paga é o Financeiro. A medição aprovada vira uma
solicitação lá, com as mesmas regras de quem pede pela tela do Financeiro: o
vencimento respeita a condição de pagamento do contrato e nunca é antes da
primeira janela de pagamento do Financeiro.

### 2. Anexe a evidência e confira os dados de pagamento

A **evidência** do serviço (ou o comprovante de entrega, no material) é
obrigatória. A nota fiscal é opcional; se existir, anexe e informe o número.

| Forma | O que pede |
|---|---|
| **Boleto ou guia** | Linha digitável / código de pagamento (obrigatório) |
| **PIX QR code** | Código "copia e cola" (obrigatório) |
| **PIX chave** | Nada: usa a chave do fornecedor no cadastro do Omie (a tela mostra o tipo e o final). Se o fornecedor não tem chave no Omie, o envio fica bloqueado — escolha outra forma ou peça o cadastro da chave. |

Escolha sempre também a **categoria**, o **tipo de documento** e o **centro de
custo**. Dado errado é o motivo mais comum de o Financeiro recusar.

Descreva o que foi feito como quem vai conferir:

| Em vez de | Escreva |
|---|---|
| "Serviço feito" | "Troca do quadro de distribuição e cabeamento do Galpão 2, conforme proposta" |
| "Material entregue" | "12 rolos de cabo flexível 2,5 mm² azul, conforme nota fiscal" |
| "Manutenção" | "Desentupimento da rede de esgoto, bloco B, atendimento de 10/10" |

> Anexos: PDF, JPG ou PNG, até **10 MB** cada.

---

## O caminho de um fornecedor

| # | Etapa | Com quem está | Para sair dela |
|---|---|---|---|
| 1 | **Rascunho** | Solicitante | Clicar em Enviar para aprovação |
| 2 | **Aguardando aprovação** | Primeiro o Eduardo (**Aguardando Eduardo**: contratação); depois o José (**Aguardando José**: condições, e homologação de fornecedor novo) | As duas aprovações, nessa ordem |
| 3 | **Aprovado** — liberado para medição | Solicitante | Pedir a medição |
| 4 | **Solicitada** (a medição) | Eduardo | Aprovar ou devolver |
| 5 | **Pagamento solicitado** | Financeiro | Validar e lançar |
| 6 | **Pago** | — | — |
| 7 | **Encerrado** | — | Automático, quando chega a 100% medido e pago; ou pelo Eduardo |

Saem do caminho antes do fim: **Devolvido** (contrato ou aditivo que voltou com
motivo; ao reenviar, o contrato recomeça pelo Eduardo), **Devolvida** (medição que voltou com motivo; o saldo volta ao
contrato) e **Cancelado** (rascunho cancelado).

Não há prazo fixo, mas há alerta: medição que fica mais de **5 dias** esperando
o Eduardo aparece marcada como "parada há N dias", e parcela que passou da data
prevista sem medição aparece como "em atraso".

Etiquetas: **Fornecedor novo** (ainda não homologado; fornecedores que já
estavam no Omie entram homologados), **Global**, **Emergencial**,
**Retenção 10%**, **Aditivo de valor**, **Aditivo de condição**.

---

## Do contrato à aprovação

### 1. Você cria o contrato

Todo contrato nasce como rascunho. Em **Contratação › Contratos**, clique em
**+ Novo contrato**.

| | Específico | Global |
|---|---|---|
| Para quê | Serviço de uma obra | Serviço avulso (Spot) ou manutenção contínua |
| Obra | Obrigatória | Não existe: o campo some |
| Classificação | Obra, Material, Spot, Manutenção ou Emergencial | Só Spot ou Manutenção |
| Material | Pode ter, separado da mão de obra | Não tem |
| Valor | Mão de obra (e material, se houver) | "Valor global (teto)" |

- Busque o **fornecedor** por razão social ou CNPJ. CNPJ e dados bancários vêm
  do Omie.
- Escolha tipo, classificação, centro de custo, escopo, valor e datas. Em
  **Emergencial**, escreva a justificativa.
- Anexe a **proposta comercial**. Se o fornecedor for novo, anexe também as
  **certidões**.
- Confira a **condição de pagamento sugerida** (as condições do padrão da
  Manfac, que o José mantém em Configurações) e troque se precisar.
- Escolha entre **Salvar rascunho**, **Gerar documento** (usa o modelo de
  contrato vigente) e **Enviar para aprovação**.

**Pagar à vista ou em 30 dias:** use a condição **Exceção**: condição proposta,
**prazo em dias** (0 a 120; 0 é à vista) e justificativa. Quem aprova é o José.
Contrato com **tabela de preço** pede cada serviço com unidade e preço; na
medição, o valor vem da tabela.

### 2. Eduardo e José aprovam, nesta ordem

Em **Contratação › Aprovações**, a página mostra **Com você** (o que espera a sua
aprovação) e **Em andamento, com outra pessoa**. O número ao lado do menu conta
quantos itens esperam por você.

1. **Primeiro o Eduardo** aprova a contratação: escopo, obra ou centro de custo,
   valor, prazo e documentos.
2. **Depois o José** valida as condições de pagamento (parcelas e valores) e, se o
   fornecedor for novo, homologa.

Cada um clica em **Aprovar** ou **Devolver com motivo**, e só na sua etapa. O
José só consegue agir depois do Eduardo (antes disso, o sistema avisa "O Eduardo
aprova a contratação primeiro."), e o Eduardo não devolve o que já está com o
José ("Este contrato não está na sua etapa."). Quem está esperando vê a
mensagem "Aguardando o Eduardo" ou "Aguardando o José". Quem só pediu o contrato
acompanha por aqui, mas não aprova; o admin do hub vê tudo e não aprova nada.

Ao devolver, o contrato volta ao solicitante como rascunho e as aprovações já
dadas se perdem. Na ficha, o botão **Ajustar e reenviar** leva à edição; ao
reenviar, o contrato **recomeça pelo Eduardo**.

### O José pode alterar a condição ao aprovar

Na etapa dele, em vez de devolver o contrato, o José pode **alterar a condição de
pagamento e aprovar**:

- trocar por **outra condição** permitida para aquele contrato;
- ajustar os **percentuais das parcelas**, só naquele contrato (números inteiros
  de 1 a 100, somando 100);
- na condição **Exceção**, informar o **prazo em dias** (0 a 120; 0 é à vista) e
  a justificativa;
- trocar para uma condição de **tabela de preço** só se o contrato já tiver a
  tabela; senão, o José devolve ao solicitante para incluí-la.

A tela mostra o **Antes → Depois**, e o botão passa a ser **Aprovar com a
condição alterada**; ele só habilita quando a soma é 100 e o prazo e a
justificativa estão preenchidos. **Desfazer alteração** volta ao que estava. Se
nada mudou, use o **Aprovar** comum.

**O Eduardo não aprova de novo:** ele recebe um e-mail avisando o que mudou. A
alteração fica na linha do tempo, com o antes e o depois.

### 3. José homologa o fornecedor novo

Só passa por aqui fornecedor cadastrado depois do início do sistema. José marca
**CNPJ ativo na Receita**, **dados bancários conferem** e **certidões negativas
válidas**, e clica em **Salvar homologação**. Com as três marcadas, o
fornecedor fica homologado e os contratos dele que já têm as duas aprovações
ficam Aprovados. Com menos de três, fica registrado o que foi conferido e a
homologação continua pendente.

---

## Mudar um contrato aprovado

Contrato aprovado **não se edita**. Mudança só por aditivo, aceite final ou
encerramento, nos botões da ficha do contrato.

### Aditivo de valor

Quem criou o contrato, o Eduardo ou o José pedem; **Eduardo e José aprovam, nessa
ordem** (primeiro o Eduardo). Na
ficha, **+ Aditivo de valor**: item (mão de obra ou material), valor a
acrescentar e motivo. Gera um número como **CT-0118-2**. O valor original não
muda: o aditivo soma por cima e as parcelas são recalculadas. Se for devolvido,
ele termina ali; para tentar de novo, peça outro.

### Aditivo de condição

Quem criou, Eduardo ou José pedem; **só o José aprova** (não passa pelo
Eduardo). **+ Aditivo de
condição**: nova condição (para à vista ou 30 dias, use Exceção) e motivo. A
nova condição vale para as medições **ainda não aprovadas**; as já aprovadas ou
pagas mantêm a antiga. Enquanto houver um aditivo de condição esperando o José,
o botão fica desabilitado.

### Aceite final e retenção de 10%

Nas obras críticas (acima de R$ 8.000 ou de risco técnico), o contrato é pago
em 30% / 30% / 30%, e os últimos **10% ficam retidos** até o aceite final.

- Meça até 90%. Com 90% da mão de obra medida, o botão **Registrar aceite
  final** fica disponível na ficha (para quem criou o contrato ou o Eduardo).
- Antes do aceite, o sistema não deixa passar de 90%.
- Depois, peça a medição dos 10% restantes.

### Encerrar um contrato

Contrato que chega a 100% medido e pago se encerra sozinho. O **Encerrar**
manual, só do **Eduardo**, serve para fechar um contrato que não será usado até
o fim: escreva o motivo e confirme. Só encerra sem medição ou aditivo pendente.
Nada é apagado.

---

## Da medição ao pedido de pagamento

### 1. Você pede a medição

Em **Medição › Nova medição**, escolha o contrato (só aparecem os aprovados). O
quadro mostra valor total, já medido e saldo. O sistema **não deixa passar de
100%**.

- Se o contrato tem mão de obra e material, escolha qual dos dois: os saldos são
  separados.
- Informe o valor em % ou em reais. No **Spot**: serviço executado, data e
  valor. Com **tabela de preço**: serviço e quantidade. No **mensal
  consolidado**: registre cada atendimento no dia e, no fim do mês, clique em
  **Fechar o mês e enviar medição**.
- Anexe a **evidência** (obrigatória) e, se houver, a nota fiscal.
- Preencha os **dados de pagamento**.
- Se aparecer o **aceite operacional**, marque: ele é pedido na parcela final e
  em todo serviço de contrato global.
- Clique em **Enviar medição para aprovação**. Se faltar algo, a tela lista em
  "Para enviar: …".

### 2. O Eduardo aprova

Em **Medição › Fila de aprovação**, cada linha mostra valor, acumulado (antes →
depois), evidência, NF e aceite. O Eduardo clica em **Aprovar** ou **Devolver
com motivo**.

- **Aprovar:** a solicitação nasce no Financeiro na hora, e a tela mostra o
  número (por exemplo, FIN-0412).
- **Devolver:** o motivo é obrigatório, o saldo volta ao contrato e nada vai ao
  Financeiro.

Aprovar duas vezes não duplica nada.

---

## O elo com o Financeiro

A medição aprovada pelo Eduardo vira, sozinha, uma solicitação de pagamento no
Financeiro, com as mesmas regras de quem pede pela tela do Financeiro.

| Ponto | Como funciona |
|---|---|
| **Quem é o solicitante** | Quem abriu a medição. Por isso essa pessoa precisa ter login no hub. |
| **Para onde vai** | Toda medição aprovada entra em **Aguardando financeiro**. A Gestão de Fornecedores nunca envia o pedido como emergencial. |
| **E-mails** | Os mesmos e-mails de aviso do Financeiro são enviados. |
| **Anexos** | **NF e evidência não vão automaticamente.** Depois que a solicitação aparece no Financeiro, quem pediu a medição anexa os documentos lá. |
| **Número** | A medição passa a mostrar **Pagamento solicitado**, com o número da solicitação no Financeiro. |
| **Data do pagamento** | A data real do pagamento **ainda não aparece** na Gestão de Fornecedores (próxima etapa). Por enquanto, consulte o Financeiro. |

### Se o Financeiro recusar ou cancelar

A medição continua aprovada: não precisa pedir outra nem passar de novo pelo
Eduardo. **Hoje**, a Gestão de Fornecedores não fica sabendo da recusa sozinha:
quem abriu a medição recebe o e-mail do Financeiro **"Sua solicitação nº X foi
recusada"**, com o motivo. Enquanto isso, a medição continua mostrando Pagamento
solicitado. Fale com o Eduardo e com o financeiro sobre o que foi apontado.

**Próxima etapa:** quando a checagem diária estiver ligada, a medição passará a
mostrar **Recusada no Financeiro** com o motivo e o botão **Reenviar ao
Financeiro** (quem abriu a medição ou o Eduardo). Isso ainda não está
funcionando.

### Se a solicitação não for criada

Se o Financeiro não responder na hora da aprovação, a medição fica **Aprovada**
com o aviso "a solicitação no Financeiro ainda não foi criada". Na **Fila de
aprovação**, o Eduardo clica em **Tentar criar solicitação de novo**. Nada é
gravado pela metade e nenhum pedido sai duplicado.

---

## Como acompanhar

**No menu**, um número ao lado de **Aprovações** e de **Fila de aprovação**
mostra quantos itens esperam por você (só para quem aprova).

**Em Contratos**, todos os seus contratos com valor, % medido, saldo e etapa,
com busca e filtros por situação e por classificação (veja "Buscar na lista de
contratos", mais abaixo).

**Na ficha do contrato** (**CT-0001**, **CT-0002**…):

- valor contratado, aditivos e total;
- a barra de **pago**, **medido** e **saldo**;
- as parcelas da condição e as medições, com a situação de cada uma;
- condição de pagamento, documentos e aceite;
- a **etapa atual** do contrato, em destaque no topo;
- a **linha do tempo**: quem fez o quê e quando, com motivos, terminando num item
  "Agora" que diz com quem o contrato está.

**Em Medição › Acompanhamento**, cada medição mostra a trilha **Solicitada →
Aprovada → Pagamento solicitado** (com o número do Financeiro). Filtros: Todas,
Solicitada, Pagamento solicitado, Pago, Devolvida e Em atraso. No topo, um aviso
lista as parcelas que passaram da data prevista sem medição.

### O que você pode fazer

- **Editar ou cancelar o rascunho**, até enviar para aprovação.
- **Pedir aditivo** (quem criou o contrato, Eduardo ou José), com o contrato
  aprovado.
- **Registrar aceite final** (quem criou o contrato ou Eduardo), com 90% medido.
- **Reenviar ao Financeiro**: ainda não disponível, virá com a checagem diária.
- **Ver documento / Baixar PDF** na ficha (o texto segue o modelo de contrato
  mantido em Configurações).
- **Ajustar e reenviar** um contrato devolvido (quem criou), ou **Enviar para
  aprovação** um rascunho.

---

## Avisos por e-mail

A cada etapa do contrato, a Gestão de Fornecedores **envia e-mail** para quem
precisa agir e para quem pediu o contrato. O assunto de todos começa com
**[Fornecedores]**, e o e-mail traz os dados do contrato e o link **Abrir o
contrato no Hub**. Se um e-mail falhar, o que você fez no sistema não é
desfeito.

| Quando | Quem recebe | Em cópia | Assunto |
|---|---|---|---|
| Contrato enviado ou reenviado | Eduardo | — | "CT-… aguarda sua aprovação" |
| Eduardo aprovou a contratação | José | Quem abriu o contrato | "CT-…: contratação aprovada — aguarda as condições" |
| Contrato aprovado | Quem abriu o contrato | Eduardo | "CT-… aprovado — liberado para medição" |
| Aprovado com a condição alterada pelo José | Quem abriu o contrato | Eduardo | "CT-… aprovado com condição de pagamento alterada" (mostra o Antes e o Depois) |
| Contrato devolvido | Quem abriu o contrato | Eduardo, se o José devolveu | "CT-… devolvido para ajuste" (com o motivo) |

Os **aditivos** têm avisos no mesmo modelo: aditivo pedido (para o Eduardo, se for
de valor; para o José, se for de condição), valor aprovado pelo Eduardo (para o
José), aditivo aprovado e aditivo devolvido (para quem pediu, com cópia ao dono
do contrato). Ninguém recebe o mesmo e-mail duas vezes.

O menu continua mostrando um número ao lado de **Aprovações** e de **Fila de
aprovação**:

| Número ao lado de | O que conta | Quem vê |
|---|---|---|
| **Aprovações** | Contratos, aditivos e homologações esperando a sua parte | Eduardo e José |
| **Fila de aprovação** | Medições solicitadas esperando aprovação | Eduardo |

Depois que a medição vira solicitação no Financeiro, os **mesmos e-mails de
aviso do Financeiro** são enviados, com as regras de lá:

- solicitação **devolvida**, **recusada** ou **lançada no Omie**: aviso a quem
  pediu;
- aguardando validação ou falha no lançamento: aviso ao financeiro;

Não há lembrete automático por e-mail. Para não esquecer, olhe o número no menu e
o aviso de **parcelas previstas sem medição** no Acompanhamento.

---

## Quem faz o quê

| Papel | O que faz |
|---|---|
| **Solicitante** (qualquer pessoa do hub) | Cria contrato, pede aditivo e medição, anexa os documentos, registra o aceite final dos seus contratos. Vê apenas o que ela mesma criou |
| **Eduardo Maia** | Aprova a contratação (primeiro), o aditivo de valor e cada medição. Registra aceite final e encerra contratos. Vê todos os contratos |
| **José Guilherme** | Depois do Eduardo, aprova (ou altera e aprova) as condições de pagamento; aprova o aditivo de condição e a homologação de fornecedor novo. Mantém as Configurações e pode indicar quem também as mantém. Vê todos os contratos |
| **Admin do hub** | Só consulta: vê tudo (inclusive as Configurações), mas não aprova nem altera nada |

O Eduardo pode aprovar o que ele mesmo abriu; fica registrado na linha do
tempo. Quem não tem papel é solicitante.

---

## Contrato global

Para serviço avulso ou manutenção contínua (caminhão pipa, desentupimento,
dedetização), o contrato é **global**: não tem obra, e o valor é um **teto** que
cada serviço medido vai consumindo.

- Só pode ser **Spot** ou **Manutenção**, e não tem material.
- Cada medição é um serviço dentro do saldo, e o **aceite operacional** é pedido
  em todas.
- Em contrato de **tabela de preço**, o valor da medição é o preço da tabela
  vezes a quantidade.
- No **mensal consolidado**, os atendimentos do mês viram uma medição só, enviada
  até o dia 25.

---

## A lista de contratos

Em **Contratação › Contratos**, o topo traz os números do que você pode ver
(quem não é Eduardo nem José vê só os seus contratos):

- **Contratado (ativos)**: soma dos contratos em andamento;
- **Medido**: quanto já foi medido;
- **Pago**: quanto já foi pago;
- **Saldo a medir**: quanto ainda pode ser medido;
- **Com medição em atraso**: contratos com parcela prevista sem medição ou
  medição parada há mais de 5 dias.

Abaixo, filtros por situação (Todos, Rascunho, Aguardando, **Devolvido**,
Aprovado, Encerrado) e por classificação (incluindo "Só contratos globais"). Os
aditivos aparecem logo abaixo do contrato. A coluna de situação mostra a
**etapa** do contrato.

### Buscar na lista de contratos

Acima dos filtros há um campo de busca ("Buscar por fornecedor, CNPJ ou nº do
contrato"). Ele filtra **enquanto você digita**, e o trecho encontrado fica
destacado.

- **Fornecedor:** digite parte do nome, sem se preocupar com maiúsculas ou
  acentos ("joao" acha "João").
- **Número do contrato:** "CT-0001", "ct 1" ou só "0001".
- **CNPJ ou CPF:** com pontos ou sem; a busca por documento pede 5 números ou
  mais ("32.542" ou "32542450").
- A busca funciona **junto** com os filtros de situação e classificação, e o
  contador mostra "N de M contratos". Se o contrato casar, os aditivos dele
  aparecem abaixo.
- O botão **×** limpa a busca. Se nada for encontrado, a tela diz o que foi
  buscado e oferece **Limpar busca** (ou **Limpar busca e filtros**).
- O campo só aparece quando já existe algum contrato.

### A etapa atual

Em vez de só "Aguardando aprovação", a lista e a ficha mostram em que etapa o
contrato está:

| Etapa | Quer dizer |
|---|---|
| **Rascunho** | Ainda não foi enviado |
| **Aguardando Eduardo** | Espera a aprovação da contratação |
| **Aguardando José** | O Eduardo aprovou; espera as condições de pagamento |
| **Aguardando José · homologação** | As duas aprovações foram dadas, mas o fornecedor novo ainda não foi homologado |
| **Devolvido** | Voltou ao solicitante, com o motivo, para ajustar |
| **Aprovado**, **Encerrado**, **Cancelado** | Como já eram |

Na ficha, uma caixa **Etapa atual** no topo diz a etapa, desde quando, o que vem
depois, e traz o botão da ação: **Abrir aprovação** (para quem aprova naquela
etapa), **Ajustar e reenviar** (contrato devolvido) ou **Enviar para aprovação**
(rascunho). A **linha do tempo** termina com um item **Agora**, por exemplo
"Agora: aguardando aprovação do Eduardo". Esse item só mostra o momento; não é um
registro. Contrato aprovado não tem o "Agora".

---

## Configurações

O grupo **Configurações** aparece no menu para o **José** e para **quem ele
indicar**. O admin do hub vê as telas, mas só para consulta. Para os demais, o
grupo não aparece; se abrirem o link direto, a tela diz "Você não tem acesso às
Configurações".

### Condições de pagamento

Em **Configurações › Condições de pagamento** ficam as condições que aparecem na
hora de criar um contrato. A tabela mostra o nome, a faixa de uso, como paga, se
vale para contrato global, **em quantos contratos está em uso** e a situação
(Ativa ou Desativada). Há filtros Ativas, Desativadas e Todas.

> **Mudança aqui vale só para contratos novos.** Contrato que já foi enviado ou
> aprovado, e as medições dele, continuam exatamente como estavam. Para mudar um
> contrato aprovado, o caminho continua sendo o aditivo.

- **Editar:** nome, faixa (texto), como paga, prazo do Financeiro em dias (vazio
  segue o calendário; 0 a 120), parcelas (quando paga e percentual, somando 100)
  e se pode ser usada em contrato global. O código da condição não muda. A tela
  avisa quantos contratos usam a condição. Cada salvamento cria uma **versão
  nova**; as anteriores ficam guardadas.
- **Nova condição:** os mesmos campos. Ela entra no fim da lista, já ativa.
- **Desativar:** a condição some da escolha em contratos novos. Contratos
  enviados ou aprovados que a usam seguem com ela. **Rascunhos e devolvidos** com
  ela precisam escolher outra antes de enviar. Nada é apagado, e **Reativar**
  devolve a condição como estava. **Não existe excluir.**
- Duas condições são usadas pelo próprio sistema (**material mediante NF** e
  **exceção**): o modo delas não muda e elas não podem ser desativadas.
- Se outra pessoa alterou a condição enquanto você editava, o sistema avisa:
  "Esta condição foi alterada por outra pessoa. Abra de novo para ver a versão
  atual."
- A **sugestão automática** de condição segue faixas fixas (até R$ 1.500; até
  R$ 5.000; até R$ 8.000; acima disso; manutenção com mais de 45 dias = mensal).
  Editar o texto da faixa não muda essa sugestão.

### Modelo de contrato

Em **Configurações › Modelo de contrato** fica o texto do contrato que sai em
**Ver documento** e **Baixar PDF**. É um texto livre, com **campos automáticos**
entre chaves duplas, que o sistema troca pelos dados do contrato: `{{numero}}`,
`{{fornecedor}}`, `{{cnpj}}`, `{{valor}}`, `{{condicao}}`, `{{parcelas}}`,
`{{inicio}}`, `{{fim}}`, `{{escopo}}`, `{{obra}}`, `{{classificacao}}`,
`{{centro_custo}}` e `{{data_emissao}}`.

- Botões inserem o campo onde está o cursor, e a **pré-visualização** ao lado
  mostra o texto com os dados de um contrato real. Os campos preenchidos
  aparecem em laranja.
- Campo escrito errado aparece em vermelho, com o aviso "Campo desconhecido".
  Dá para salvar assim, mas ele sai literalmente no contrato.
- Campo sem dado sai como "[a preencher]".
- **Descartar alterações** volta ao texto salvo; **Salvar modelo** cria uma versão
  nova.
- **Contratos já gerados não mudam.** Cada contrato guarda o modelo da primeira
  vez em que o documento dele foi gerado; antes disso, usa o modelo atual.
- O cabeçalho (MANFAC, número, data) e o bloco de assinaturas são fixos.

---

## Perguntas que costumam aparecer

**Quem aprova primeiro, o Eduardo ou o José?**
O Eduardo aprova a contratação; depois o José valida as condições. O José não
consegue aprovar antes.

**O José achou a condição errada. Precisa devolver?**
Não. Na etapa dele, ele pode alterar a condição e aprovar. O Eduardo recebe um
e-mail de aviso e não precisa aprovar de novo.

**Devolveram meu contrato. Quando reenvio, quem aprova primeiro?**
Sempre recomeça pelo Eduardo. Use o botão **Ajustar e reenviar** na ficha.

**Alterei uma condição em Configurações. Os contratos antigos mudam?**
Não. A mudança vale só para contratos novos; os já enviados ou aprovados ficam
com a condição de antes.

**Posso editar um contrato depois de aprovado?**
Não. Só por aditivo de valor ou de condição.

**Contrato global pode ter obra?**
Não. Nunca tem obra, nem material.

**Fornecedor que já está no Omie precisa de homologação?**
Não. Os que já estão no Omie entram homologados. Só os cadastrados depois passam
pela homologação do José.

**A nota fiscal é obrigatória na medição?**
Não, é opcional. A evidência (ou o comprovante de entrega) é obrigatória.

**Como pagar à vista ou em 30 dias?**
Condição Exceção, com o prazo em dias e a justificativa. Quem aprova é o José.

**Até que dia posso pedir a medição do mês?**
Até o dia 25. Depois, entra no pagamento do mês seguinte.

**Posso medir mais de 100%?**
Não. Para mais, peça um aditivo de valor.

**Anexei a NF e a evidência. Preciso anexar de novo no Financeiro?**
Sim. Os anexos não vão automaticamente: depois que a solicitação aparece no
Financeiro, anexe os documentos lá.

**Onde vejo a data em que o fornecedor foi pago?**
Por enquanto, no Financeiro. A data real ainda não aparece na Gestão de
Fornecedores.

**O Financeiro recusou. Preciso pedir a medição de novo?**
Você recebe o e-mail do Financeiro com o motivo. Hoje a Gestão de Fornecedores
não mostra a recusa nem tem o botão de reenviar (próxima etapa): fale com o
Eduardo e com o financeiro.

**Aprovei a medição e o pedido não apareceu no Financeiro.**
A medição fica Aprovada com um aviso. O Eduardo clica em Tentar criar
solicitação de novo, na Fila de aprovação.

**Vejo contratos de outras pessoas?**
Só se for o Eduardo ou o José. Os demais veem apenas o que criaram.

---

## Mensagens que podem aparecer

| Na tela | O que fazer |
|---|---|
| O Eduardo aprova a contratação primeiro | O José só aprova depois do Eduardo; aguarde |
| Este contrato não está na sua etapa | Cada pessoa aprova ou devolve só a sua etapa; veja em "Etapa atual" com quem está |
| Esta condição foi alterada por outra pessoa. Abra de novo para ver a versão atual | Abra a condição de novo e refaça a alteração |
| Esta condição precisa da tabela de preços. Devolva ao solicitante para incluir | Devolva o contrato com o motivo; o solicitante inclui a tabela e reenvia |
| Faltam informações para enviar: … | Preencha os campos citados e envie de novo; o que você digitou não se perde |
| Anexe a proposta comercial / Fornecedor novo: anexe as certidões | Anexe o arquivo (PDF, JPG ou PNG, até 10 MB) e envie |
| Exceção exige condição proposta, prazo em dias e justificativa | Escreva a condição, o prazo (0 a 120) e o motivo |
| Passa de 100% do contrato. Ainda dá para medir no máximo … | Reduza o valor. Para mais, peça aditivo de valor |
| Os 10% retidos só são liberados depois do aceite final | Registre o aceite final na ficha do contrato |
| Este fornecedor não tem chave PIX cadastrada no Omie | Escolha boleto, guia ou PIX QR code, ou peça o cadastro da chave |
| Não conseguimos consultar o cadastro do Omie agora | Aguarde alguns instantes; o formulário continua aberto |

Se aparecer algo que este manual não explica, fale com o suporte do hub **antes
de repetir o pedido** — repetir pode gerar medição ou contrato duplicado.

<!--
NOTAS DE DIVERGENCIA ENTRE O MOCKUP E A SPEC (interno, nao e para o cliente; vale a spec):
1. Exige justificativa: o mockup mostrava um checkbox na edicao da condicao; a spec o torna automatico (so a condicao Exceção exige justificativa). O manual nao fala do checkbox.
2. Desativar condicao: o mockup diz que rascunhos seguem com ela e o José pode manter ou trocar na aprovação; a spec diz que rascunhos e devolvidos precisam escolher outra antes de enviar. O manual segue a spec.
3. Quem acessa as Configurações: o mockup diz só José e Admin; a spec acrescenta o papel configurador (quem o José indicar). O manual segue a spec.
4. Chip Devolvido: a spec define que ele não mostra aditivos devolvidos e que Rascunho passa a contar só os não devolvidos; o manual só cita o chip.
5. E-mails de aditivo (A1 a A5) e as duas condições do sistema (material mediante NF e exceção, travadas) existem na spec e não estão no mockup; entram resumidos.
6. Modo de pagamento editável e faixa só como texto (D2 e D3 da spec): o mockup não distingue; o manual segue a spec.
-->
