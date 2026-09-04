# Feedback 05 — leitura, e o que ele muda no sistema

Escrito em 03/09/2026, a partir de `feedback-05-liberado-por-mau-uso-fotos-diarias.md`.
Cinco assuntos. Três fecham decisões abertas, dois abrem trabalho novo.

---

## DECISÃO I — "Liberado por" e a data de liberação

> "mesmo quando as obras não têm OS aprovada, a gente precisa de um OK que a
> gente pode executar aqui (...) a gente bota liberado por Amanda, liberado por
> Leandro (...) a data de aprovação da OS é uma e a data de liberação é outra"

### Correção de fato, antes de tudo

**Essa coluna não existe na planilha.** Procurei "liberad" célula a célula nas duas
abas do dump — zero ocorrências. O que existe é parecido o bastante para confundir:

| Coluna | Aba | O que guarda |
|---|---|---|
| `ANALISTA` | Pipeline DPSP | Amanda / Leandro / Juan — o analista do cliente dono da OS |
| `AUTORIZAÇÃO` | Pipeline DPSP | uma data, sem nome junto |
| `STATUS DESK` | Pipeline DPSP | Aguardando Aprovação / Aguardando Atendimento / Resolvido |

Ou seja: hoje existe **um nome** numa coluna e **uma data** em outra, e nada diz que
elas se referem ao mesmo ato. Não dá para saber, olhando a planilha de hoje, se uma
obra foi executada com OK verbal de alguém ou se ninguém autorizou nada.

Isso não enfraquece o pedido — **reforça**. Ele está pedindo para o sistema registrar
uma coisa que a operação faz todo dia e que a planilha nunca guardou direito.

### O que passa a existir

Dois destravamentos separados, cada um com quem e quando:

| | Quem | Quando | O que significa |
|---|---|---|---|
| **Liberação** | analista do cliente (Amanda, Leandro, Juan…) | data da liberação | "pode executar, a OS eu aprovo depois" |
| **OS aprovada** | sistema do cliente | data de aprovação | o ato formal, que destrava o fechamento |

A obra pode ter uma, outra, as duas ou nenhuma. **São quatro estados, não dois** — e o
quarto é o que interessa para a gestão:

- liberada **e** com OS → normal
- liberada, **sem** OS → executando com OK informal. Precisa cobrar a OS.
- **não** liberada, com OS → normal (a OS já é a autorização)
- **nem** liberada **nem** com OS → **executando sem cobertura nenhuma.** Risco puro:
  serviço feito, sem documento e sem ninguém nomeado que tenha autorizado.

O sistema tem que saber dizer, a qualquer momento, quantas obras estão no quarto caso.
Hoje ninguém consegue responder isso.

### Onde aparece na tela

- **Ficha da obra:** bloco de autorização com as duas linhas — "Liberado por Amanda ·
  12/08" e "OS aprovada · 20/08" ou "OS ainda não aprovada · 22 dias".
- **Base de obras:** etiqueta para a obra que está em campo sem OS aprovada.
- **Esteira:** a etapa de cobrança da OS mostra quem liberou, para a cobrança ter nome.
- **Triagem:** campo para registrar a liberação quando a obra entra.

---

## DECISÃO G — FECHADA

> "pode deixar do jeito que o Claude recomendou: responsável da obra vai até fechar
> a OS, o financeiro vai no faturado"

Confirmado exatamente como está no mockup v02. Nada muda na tela.

**Visão de futuro registrada, fora da v1:** o financeiro passa a faturar dentro do
próprio sistema, e existe hoje um "robôzinho" de faturamento que precisa ser
estruturado. Isso é uma frente inteira — fica anotada, não entra agora.

---

## DECISÃO J — Mau uso é etiqueta, não caminho

> "não precisa ficar num caminho separado (...) a gente separa numa classificação de
> tipo (...) o importante é a gente ter lá a obra aberta"

**O que é:** dano causado por uso indevido do cliente. O funcionário arromba o cadeado
na abertura da loja, quebra a chave dentro do tambor. A Manfac conserta **e cobra**.

Os dados confirmam o padrão: das 22 obras "MAU USO" na planilha, quase todas são
SERRALHERIA e valem entre R$ 175 e R$ 527. É volume alto de valor baixo.

**O problema de hoje:** na planilha, `MAU USO - APROVAR OS` mora na coluna
`STATUS MANFAC`, misturado com `FECHAR OS` e `PENDENTE FATURAMENTO`. Classificação
ocupando o lugar de etapa. Resultado: 22 obras somem do funil normal — não aparecem
em "aguardando aprovação de OS" porque estão num status próprio.

**O que passa a ser:** um campo de classificação, separado da etapa. A obra de mau uso
é uma obra como qualquer outra, percorre a mesma esteira, e carrega uma etiqueta.
O status `MAU USO - APROVAR OS` deixa de existir e vira `Aprovar OS` + etiqueta.

**Ganho concreto:** as 22 voltam para a contagem real do funil, e dá para filtrar
"quanto de mau uso está pendente de cobrança" sem quebrar mais nada.

---

## DECISÃO K — Relatório de entrega, e o estado "Pendente fechamento"

> "hoje a gente não acompanha isso, é gap muito grande (...) eu sei que a OS foi
> fechada no Field, logo tem relatório (...) se a OS está aprovada no sistema do
> cliente é só pegar o relatório e fechar lá. Se não tem OS aprovada, aí de fato não
> dá pra fechar e fica: pendente fechamento"

Ele resolveu a etapa que o mockup marcava como "a única sem nome na planilha". E
resolveu do jeito certo: **ninguém marca o relatório à mão — ele é deduzido.**

A regra, exatamente como ele a formulou:

```
OS fechada no Field  ──►  o relatório existe   (dedução automática, via API)
        │
        ├── OS aprovada no sistema do cliente  ──►  FECHAR OS  (dá para agir hoje)
        │
        └── OS não aprovada                    ──►  PENDENTE FECHAMENTO
                                                     (travado por fora, não por nós)
```

**Por que isso é bom:** separa o que está parado por culpa nossa do que está parado
esperando o cliente. "Fechar OS" é uma fila de trabalho — alguém pega e faz. "Pendente
fechamento" é uma fila de cobrança — ninguém da Manfac resolve sozinho, o que resolve é
insistir com o analista. Hoje as duas coisas estão embaraçadas dentro do mesmo balaio de
89 obras executadas e não faturadas.

**Pré-requisito técnico:** a API do Field Control precisa entregar o fechamento da OS e
o link do relatório. Já estava decidido que a integração é requisito (01/09), com
cadastro manual como modo degradado — vale igual aqui: se a API não trouxer, alguém
marca à mão.

---

## DECISÃO L — O agente pede evolução E foto, todo dia, para a equipe

> "ele manda um WhatsApp pra equipe que está definida na obra e todo dia ele pede
> evolução e foto (...) o sistema registra essa foto todo santo dia (...) vai ter um
> link lá de foto pra gente acompanhar a evolução"

Isto **muda o agente de IA de papel**. Até aqui ele era um cobrador que falava com quem
não preencheu o diário. Agora ele é quem **coleta** — e fala com a ponta, com a equipe em
campo, não com o escritório.

### O que muda em relação ao que já estava decidido

| Antes | Agora |
|---|---|
| fala com o responsável da obra | fala com a **equipe definida na obra** |
| pede o preenchimento do diário | pede **evolução + foto** |
| texto | texto **e imagem**, recebida e guardada |
| a linha do tempo é escrita | a linha do tempo tem **foto de cada dia** |

### Três pré-requisitos que ainda não existem, e precisam entrar no cronograma

1. **Telefone por equipe.** Na planilha, "Equipe / prestador" é texto solto: `MANFAC-7`,
   `ALEX`, `ERLI/RICARDO`, `MANFAC-4/PARCEIRO`, `DEFINIR`. Não há cadastro, não há
   telefone, e boa parte é terceiro. Sem isso o agente não tem para quem mandar.
   **É a peça que trava tudo o resto** — e é trabalho de operação, não de código.
2. **Receber e guardar imagem.** Mandar texto por um provedor não oficial (Z-API,
   Evolution — decidido em 01/09) é simples; receber foto por webhook e guardar é outra
   coisa: precisa de armazenamento, e as fotos de obra pesam.
3. **A foto precisa saber a que dia pertence.** O valor está na sequência — a evolução.
   Foto que chega solta, sem dia e sem obra, não vira linha do tempo, vira pasta.

### O que eu recomendo, e por quê

**Construir a linha do tempo com foto por dia na v1, alimentada pela tela; o agente de
WhatsApp entra logo depois, escrevendo no mesmo lugar.**

Não é diminuir o pedido — é a ordem que não gera retrabalho. O trabalho de verdade aqui
é o repositório de fotos por obra e por dia: onde guarda, como aparece na linha do
tempo, quem vê. Isso é o mesmo código, venha a foto do WhatsApp ou de um botão na tela.
Já o WhatsApp depende de duas coisas fora do nosso alcance — o telefone das equipes
terceirizadas e um provedor que pode ser bloqueado sem aviso.

Se a v1 depender do WhatsApp para ter foto, ela não sobe enquanto o cadastro de telefone
não estiver pronto. Se a v1 tiver a tela, ela sobe, começa a acumular histórico, e o
WhatsApp vira o que ele deve ser: o jeito mais fácil de alimentar uma coisa que já
funciona.

**Ainda vale perguntar ao João** — se ele quiser o WhatsApp junto na v1, dá, mas o
cadastro de telefones das equipes vira tarefa dele para ontem.

### Detalhes que decidi sozinho, para constar

- A cobrança de foto sai **às 18h**, junto com o resto do ciclo. Um disparo só, não dois.
  (Horário único confirmado em 01/09.)
- Só obras **em campo** recebem a cobrança diária. Obra em levantamento ou já executada
  não tem evolução para fotografar.
- **Foto que não veio é falta**, e falta vira tarefa com dono e prazo — mesma mecânica
  do feedback 03. Não inventa um caminho novo.

---

## Situação das decisões depois deste feedback

| # | Assunto | Situação |
|---|---|---|
| A | Tabela ou Kanban | as duas |
| B | Formato do diário | as duas |
| C | Travar no 3º "não andou" | sem trava; motivo obrigatório |
| D | Quem define a obra que chega | o Yuri, e ele direciona |
| E | O que perguntar às 9h | dissolvida — ciclo às 18h |
| F | Falta repetida | o aviso não escala, só atualiza |
| G | Quem marca "faturado" | **FECHADA** — financeiro |
| H | Porte da obra | descartada |
| I | Liberado por + data de liberação | **NOVA** — entra na v03 |
| J | Mau uso como etiqueta | **NOVA** — entra na v03 |
| K | Relatório derivado + pendente fechamento | **NOVA** — entra na v03 |
| L | Foto diária pelo agente | **NOVA** — desenho na v03, escopo a confirmar |

## Pendências abertas

- [ ] Confirmar com o João: foto por WhatsApp na v1, ou tela primeiro (ver decisão L)
- [ ] Cadastro de telefone das equipes / prestadores — trabalho de operação
- [ ] Extrair e versionar o `FEEDBACK CLIENTE CONTROLE DE OBRAS V01.docx` da raiz
- [ ] Link da planilha viva, que o José ficou de mandar
