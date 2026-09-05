# Feedback 06 — leitura e decisões (M, N, O)

Tradução do `feedback-06-audios-aprovacao.md` em decisões. **O literal é lá; aqui é
interpretação.** Escrito em 05/09/2026.

## O que o cliente aprovou

**"A nível de layout é isso. O mockup bem legal."** Aprovação do mockup v03 sem ressalva
de layout. Ele citou por nome as duas coisas que entraram e que reconheceu: as **tarefas
do dia** e as **cobranças e lembretes via WhatsApp**.

Consequência: **o mockup v03 é lei.** Cor, tipografia, estrutura de telas, ciclo de vida
e os textos em português da interface estão aprovados e não se reabrem. O que ele
levantou depois são pontos de operação, não de tela.

---

## DECISÃO M — WhatsApp: virar para a API oficial (PROPOSTA, aguarda o cliente)

> "a questão do WhatsApp envolve a PI oficial, dá pra fazer sem a PI oficial. Natan está
> falando que sem a PI oficial o Whatsapp tá bloqueando o número, tendo em vista isso,
> quer ver qual é o custo da PI"

**Isto reabre a decisão de 01/09**, quando o cliente disse "sobre os disparos de wpp
faremos sem api oficial". Naquele dia registramos o risco com todas as letras: "o número
pode ser bloqueado, sem aviso e sem recurso". Agora alguém do lado dele — o Natan —
confirma que o bloqueio está acontecendo na prática. O risco saiu do papel.

### O custo, levantado em 05/09/2026

Cobrança da Meta é **por mensagem**, por categoria, no Brasil:

| Categoria | Por mensagem |
|---|---|
| **Utility** (lembrete, cobrança de tarefa) — **é a nossa** | ~R$ 0,04 |
| Authentication | ~R$ 0,15 – 0,19 |
| Marketing | ~R$ 0,31 – 0,38 |
| Resposta dentro da janela de 24h aberta pelo usuário | **grátis** |

Volume estimado: ~30 mensagens por dia útil x 22 dias x R$ 0,04 = **menos de R$ 30/mês**.
Mesmo triplicando o volume não passa de R$ 100/mês. Pela **Cloud API da Meta direto** não
há taxa de plataforma; BSPs brasileiros (Zenvia, Blip, Twilio) cobram mensalidade que
**não foi verificada**.

Fontes conferidas em 05/09/2026: messagecentral.com/blog/whatsapp-business-api-pricing-brazil,
whats.team/waba-pricing/brazil, payperwa.com/blog/whatsapp-business-api-pricing-brazil-2026.

### Recomendação

**Ir para a oficial.** R$ 30/mês não se compara ao risco de perder o número da Manfac sem
aviso — e se o número cair, a cobrança das 18h para de existir, que é o mecanismo que
sustenta o hábito de preencher o diário. O sistema inteiro depende dele.

**O custo real não é dinheiro, é prazo e burocracia:** verificação da empresa no Meta
Business Manager, número dedicado, e **cada template aprovado antes de poder disparar**.
Dias a semanas, e não depende da Manfac nem de nós.

**Detalhe técnico que ajuda:** a limitação da janela de 24h quase não pesa aqui. O
disparo das 18h sai como template utility; quando a pessoa responde, abre a janela e a
conversa com o agente fica livre e gratuita. É exatamente o padrão de uso do cobrador.

**Não trava a entrega de terça** — WhatsApp não está no escopo dela. A burocracia pode
correr em paralelo.

---

## DECISÃO N — A base inicial vem da PLANILHA, não do Field

> "Ver sobre a base de obras, de onde vai vir inicialmente essa base de obras, se vai
> fazer API pelo Field, se vai puxar pela planilha oficial. É uma coisa nova que precisa
> passar a acontecer. Alinhar com o pessoal para abrirem essas obras no Field"

**Decidido: planilha primeiro, Field depois.** Não é preferência, é a única saída — e o
próprio cliente explicou por quê.

Três motivos, em ordem de peso:

1. **O Field ainda não tem os dados.** Abrir obra no Field é, nas palavras dele, "uma
   coisa nova que precisa passar a acontecer". Integrar hoje traria uma base vazia.
2. **Não temos credencial nem documentação da API do Field Control.** Não existe nada
   sobre isso no repositório. Sem elas a integração nem começa.
3. **Prazo.** Ver decisão O.

Isto **não contradiz** a decisão de 01/09 ("conectar com API do Field Control e se travar
deve dar para fazer manual"). As duas vias continuam no escopo da v1. O que mudou é a
**ordem**: a planilha é a carga inicial, o cadastro manual é o modo permanente de
operação, e a API do Field entra depois — quando houver credencial E quando a equipe do
cliente estiver de fato abrindo obra por lá.

**Pré-requisito operacional, e é do cliente:** alinhar com a equipe dele para passarem a
abrir as obras no Field. Ele mesmo levantou. Sem isso, a integração futura não tem o que
ler.

**Bloqueio imediato:** a carga inicial precisa da **planilha viva**. O que temos é o dump
da Rev.02 de 31/08 — o link atualizado o José ficou de mandar por e-mail e nunca chegou.
Sem ele, o pessoal treina em cima de obra desatualizada.

---

## DECISÃO O — Prazo: terça 08/09 à tarde, com escopo cortado

> "Terça feira chegar com a parada rodando para ensinar o pessoal a usar e pedir pro
> claude fazer um manual de uso"

Primeira aparição de um prazo nesta frente. Terça é **08/09/2026** — três dias contados
de sábado 05/09, dois deles fim de semana. O cronograma levantado horas antes era de
**15 a 17 dias de trabalho** para a v1. Não cabe.

**Corte confirmado pelo João em 05/09.** A entrega de terça é uma **v0 de treinamento**:
não é a v1, é o subconjunto que permite ensinar alguém a operar de verdade.

### Entra na terça

- Base de obras (tabela, filtros, ficha) com as obras **reais** importadas da planilha
- Cadastro manual de obra
- Triagem (fila do Yuri)
- Diário do dia — **forma cartões apenas**
- Tarefas do dia
- **Manual de uso** (artifact + PDF), entregável nomeado pelo cliente

### Fica para depois

- Integração com a API do Field Control (decisão N)
- WhatsApp e o agendador das 18h/19h (decisão M em aberto)
- Painel do dia
- Segunda forma do diário (lista estilo planilha) — a decisão B continua valendo, só não
  cabe em três dias
- Dashboard de reunião, Zeev

**Treinamento é à tarde.** A entrega fecha segunda à noite; terça de manhã fica para
deploy e teste de fumaça em produção com dados reais.

---

## Situação das decisões após o feedback 06

| # | Assunto | Situação |
|---|---|---|
| A–H | ver `decisoes-para-ir-ao-ar.md` | fechadas (H descartada) |
| I–L | ver `feedback-05-leitura-e-decisoes.md` | fechadas, na v03 |
| **M** | Canal do WhatsApp | **proposta enviada ao cliente — recomendamos a API oficial** |
| **N** | Origem da base inicial | **fechada — planilha primeiro, Field depois** |
| **O** | Prazo e escopo de terça | **fechada pelo João — v0 de treinamento** |

## Pendências que o feedback 06 criou

- [ ] Responder ao cliente o custo da API oficial (decisão M) — **junto com a pergunta 03,
      que segue sem resposta desde 31/08**
- [ ] Link da planilha viva — **até segunda de manhã**, senão a carga sobe velha
- [ ] Cliente alinhar com a equipe para abrirem obra no Field
- [ ] Quem é o Natan e que peso a opinião dele tem
