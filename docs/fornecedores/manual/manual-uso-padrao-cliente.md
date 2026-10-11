# Gestão de Fornecedores — manual de uso

**Onde fica:** hub.manfac.com.br → card **Gestão de Fornecedores**
**Quem pode usar:** qualquer pessoa com login no hub. Não precisa de liberação.

A Gestão de Fornecedores é o lugar onde a Manfac registra o contrato com cada
fornecedor, controla quanto já foi medido e acompanha o pagamento. O que muda: a
medição aprovada vira, sozinha, uma solicitação de pagamento no Financeiro,
sem ninguém redigitar.

Não existe senha separada: basta estar logado no hub. O menu lateral tem dois
grupos: **Contratação** (Contratos e Aprovações) e **Medição** (Nova medição,
Fila de aprovação e Acompanhamento).

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
| 2 | **Aguardando aprovação** | Eduardo (contratação) e José (condições); José também homologa fornecedor novo | As duas aprovações, em qualquer ordem |
| 3 | **Aprovado** — liberado para medição | Solicitante | Pedir a medição |
| 4 | **Solicitada** (a medição) | Eduardo | Aprovar ou devolver |
| 5 | **Pagamento solicitado** | Financeiro | Validar e lançar |
| 6 | **Pago** | — | — |
| 7 | **Encerrado** | — | Automático, quando chega a 100% medido e pago; ou pelo Eduardo |

Saem do caminho antes do fim: **Devolvido** (contrato ou aditivo que voltou com
motivo), **Devolvida** (medição que voltou com motivo; o saldo volta ao
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
- Confira a **condição de pagamento sugerida** (12 condições do padrão da
  Manfac) e troque se precisar.
- Escolha entre **Salvar rascunho**, **Gerar documento** (modelo provisório) e
  **Enviar para aprovação**.

**Pagar à vista ou em 30 dias:** use a condição **Exceção**: condição proposta,
**prazo em dias** (0 a 120; 0 é à vista) e justificativa. Quem aprova é o José.
Contrato com **tabela de preço** pede cada serviço com unidade e preço; na
medição, o valor vem da tabela.

### 2. Eduardo e José aprovam

Em **Contratação › Aprovações**, a aba **Esperando por mim** mostra o que é seu,
e o número ao lado do menu conta quantos itens esperam.

- **Eduardo** confere a contratação: escopo, obra ou centro de custo, valor,
  prazo e documentos.
- **José** confere as condições de pagamento: parcelas e valores.
- Cada um clica em **Aprovar** ou **Devolver com motivo**. Ao devolver, o
  contrato volta ao solicitante como rascunho e as aprovações já dadas se
  perdem.

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

Quem criou o contrato, o Eduardo ou o José pedem; **Eduardo e José aprovam**. Na
ficha, **+ Aditivo de valor**: item (mão de obra ou material), valor a
acrescentar e motivo. Gera um número como **CT-0118-2**. O valor original não
muda: o aditivo soma por cima e as parcelas são recalculadas. Se for devolvido,
ele termina ali; para tentar de novo, peça outro.

### Aditivo de condição

Quem criou, Eduardo ou José pedem; **só o José aprova**. **+ Aditivo de
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

**Em Contratos**, todos os seus contratos com valor, % medido, saldo e situação,
com filtros por situação e por classificação.

**Na ficha do contrato** (**CT-0001**, **CT-0002**…):

- valor contratado, aditivos e total;
- a barra de **pago**, **medido** e **saldo**;
- as parcelas da condição e as medições, com a situação de cada uma;
- condição de pagamento, documentos e aceite;
- a **linha do tempo**: quem fez o quê e quando, com motivos.

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
- **Ver documento / Baixar PDF** na ficha (o modelo do contrato é provisório).

---

## Avisos por e-mail

A Gestão de Fornecedores **não envia e-mails próprios**. Quem avisa é o menu,
com o número de itens esperando por você, e o **Financeiro**, depois que a
solicitação de pagamento é criada.

| Número ao lado de | O que conta | Quem vê |
|---|---|---|
| **Aprovações** | Contratos, aditivos e homologações esperando a sua parte | Eduardo e José |
| **Fila de aprovação** | Medições solicitadas esperando aprovação | Eduardo |

Depois que a medição vira solicitação no Financeiro, os **mesmos e-mails de
aviso do Financeiro** são enviados, com as regras de lá:

- solicitação **devolvida**, **recusada** ou **lançada no Omie**: aviso a quem
  pediu;
- aguardando validação ou falha no lançamento: aviso ao financeiro;

Não há lembrete automático por e-mail na Gestão de Fornecedores. Para não
esquecer, olhe o número no menu e o aviso de **parcelas previstas sem medição**
no Acompanhamento.

---

## Quem faz o quê

| Papel | O que faz |
|---|---|
| **Solicitante** (qualquer pessoa do hub) | Cria contrato, pede aditivo e medição, anexa os documentos, registra o aceite final dos seus contratos. Vê apenas o que ela mesma criou |
| **Eduardo Maia** | Aprova a contratação, o aditivo de valor e cada medição. Registra aceite final e encerra contratos. Vê todos os contratos |
| **José Guilherme** | Aprova as condições de pagamento, o aditivo de condição e a homologação de fornecedor novo. Vê todos os contratos |
| **Admin do hub** | Só consulta: vê tudo, mas não aprova nada |

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

Abaixo, filtros por situação (Todos, Rascunho, Aguardando, Aprovado, Encerrado)
e por classificação (incluindo "Só contratos globais"). Os aditivos aparecem logo
abaixo do contrato.

---

## Perguntas que costumam aparecer

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
| Faltam informações para enviar: … | Preencha os campos citados e envie de novo; o que você digitou não se perde |
| Anexe a proposta comercial / Fornecedor novo: anexe as certidões | Anexe o arquivo (PDF, JPG ou PNG, até 10 MB) e envie |
| Exceção exige condição proposta, prazo em dias e justificativa | Escreva a condição, o prazo (0 a 120) e o motivo |
| Passa de 100% do contrato. Ainda dá para medir no máximo … | Reduza o valor. Para mais, peça aditivo de valor |
| Os 10% retidos só são liberados depois do aceite final | Registre o aceite final na ficha do contrato |
| Este fornecedor não tem chave PIX cadastrada no Omie | Escolha boleto, guia ou PIX QR code, ou peça o cadastro da chave |
| Não conseguimos consultar o cadastro do Omie agora | Aguarde alguns instantes; o formulário continua aberto |

Se aparecer algo que este manual não explica, fale com o suporte do hub **antes
de repetir o pedido** — repetir pode gerar medição ou contrato duplicado.
