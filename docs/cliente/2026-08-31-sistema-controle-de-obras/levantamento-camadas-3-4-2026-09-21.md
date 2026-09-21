# Camadas 3 e 4 do Controle de Obras — requisitos levantados do material do cliente

Fontes lidas: todo `docs/cliente/2026-08-31-sistema-controle-de-obras/` (feedbacks 01-20,
decisões, conselhos, ESTADO.md, transcrição de 31/08, mockups) + `docs/cliente/2026-09-18-mockup-visao-do-dono-da-pacheco.md`
+ código em `app/obras/`, `app/api/obras/`, `sdd-sql-obras-cron-jobs.sql`, `.claude/rules/obras.md`, `.claude/rules/sql.md`.

---

## 1. Camada 3 — "agente que cobra sozinho"

### Quem é cobrado, sobre o quê, por qual canal

Citação literal, `feedback-04-agente-cobrador.md:9-13` (fala do cliente, repassada pelo João em 01/09):

> "Basicamente ele vai falar assim: ó Roberta que é a menina de compras, olha aqui o Yuri falou
> que na obra tal tá tá faltando material preciso que cê veja com ele o que tá faltando e me
> responda aqui até o final do dia essa é a ideia do agente de um cobrador"

O mesmo arquivo (linhas 19-27) decompõe a mensagem em 5 partes fixas: chama pelo nome → diz de
onde veio a informação → diz o que fazer → pede resposta de volta → dá prazo. Pessoa nova citada:
**Roberta, de compras**.

Canal: **WhatsApp**, e muda de aviso de mão única para conversa — `feedback-04:43-46`:
> "Muda o requisito de WhatsApp, para melhor. Deixa de ser aviso de mão única e vira conversa. Na
> API oficial, quando a pessoa responde, abre uma janela de 24h em que a empresa conversa
> livremente sem template aprovado. Só a primeira mensagem do dia precisa de template."

Roteamento por tipo de falta, `feedback-03-tarefas-por-falta.md:24-28` (citação literal do
cliente nas linhas 8-17): **Material → Compras** (checar o que faltou); **Ferramenta → Yuri**;
**Equipe → Yuri**. "Documento/ART" e "Outro" o cliente não citou — são default nosso, marcado
como tal (Decisão J, ver seção 4).

### Quando / com que frequência

Prazo padrão: **"até o final do dia"** — `feedback-04:39-41`, confirmado no código (seção 5).
Não há frequência de repetição declarada além disso; Decisão F (`decisoes-para-ir-ao-ar.md:154-160`)
diz que o aviso das 19h (peça correlata, não a cobrança da Roberta) "não escala e não muda de
forma. Sai o mesmo todo dia às 19h [...]. Nada bloqueia, nada sobe sozinho para mais ninguém."

### O que acontece se não responder

**Não respondido pelo cliente.** Pergunta explícita e em aberto em dois arquivos:
- `feedback-04-agente-cobrador.md:53-54`: "O que acontece quando o prazo vence e a Roberta não
  respondeu: entra no aviso das 19h, vira aviso próprio, ou sobe para o dono?"
- `feedback-03-tarefas-por-falta.md:63-64`: mesma pergunta, também sem resposta.

### Quem vê o resultado

- `feedback-03:56-57`: "Na ficha da obra e no painel do dono: ao lado da falta, quem está com
  ela e desde quando."
- `feedback-03:54-55`: "Uma visão de tarefas abertas — por área e por obra, com há quantos dias
  está na mão de cada um."
- Canal para os administradores do hub, decidido em 01/09 (`decisoes-para-ir-ao-ar.md:63-68`,
  citação literal): "a notificaçao aos adm do hub é via email e wpp" — vale para o aviso das 19h
  de quem não preencheu e para o aviso de falta de material. **O canal do aviso das 18h ao
  analista não foi especificado** (linha 70: "não assumir").

### Resolvido em 01/09/2026 (não estava nas perguntas acima)

`feedback-04-agente-cobrador.md:58-63`, citação literal do cliente: "a tarefa para a roberta
nasce em nosso sistema" — não empurra para o Zeev (que está em standby por decisão do cliente,
minuto 38 da reunião de 31/08).

---

## 2. Camada 4 — "dashboard e apresentação para reunião"

**Muito menos material dedicado do que a camada 3.** A camada 4 aparece quase sempre como item
de lista, sem desenho próprio ainda — é o oposto do padrão de detalhe da camada 3.

### O que ela é, na fonte primária

Transcrição de 31/08, José Guilherme (cliente), `transcricao-reuniao-2026-08-31.md:567-571`:
> José Guilherme [52:10-52:45]: "...Aí, a base de obras, o que que alimenta ela? É o dia a dia
> das obras. [...] Aí você tem uma base pronta que essa base tá sendo atualizada diariamente. Ou
> seja, o meu controle tá pronto."
> José Guilherme [52:47]: "Que é criar o dashboard e criar os relatórios de reunião."

Não há, em nenhum arquivo lido, uma definição de **quem assiste a essa reunião** (interna
Manfac/DPSP, ou com o cliente do cliente) nem uma lista de perguntas/números específicos que o
painel deveria responder — ao contrário da camada 3, que tem a mensagem inteira roteirizada.

### Onde ela é citada como adiada

`ESTADO.md:862-867` e `decisoes-para-ir-ao-ar.md:58-60` (idênticas): ordem definida pelo cliente
na reunião — 1) base de obras, 2) diário (o coração), 3) agente cobrador (camada 3), 4) dashboard
e apresentação para reunião (camada 4). "Fica para depois: Dashboard e apresentação automática
para reunião (camada 4)."

`cronograma-2026-09-14.html:365`, citação literal: "Painel do dia, dashboard de reunião e agente
cobrador. Adiados pelo cliente em 31/08; entram depois que a equipe estiver usando."

### O que já foi construído que se aproxima, mas não é a camada 4

- **"Painel do dia para administradores"** — está no escopo da v1 (`decisoes-para-ir-ao-ar.md:51-56`),
  diferente da camada 4. É o painel que a diretoria abre às 19h (rótulo `telaAdm` em
  `mockup-obras.html:2271`), voltado para dentro (Manfac), não para a reunião com o cliente.
- **Seção F do mockup (painel de SLA)** — citada em `conselho-4-perguntas-operacao.md:32,41` como
  "o painel que substitui a 'apresenta pro cliente' da tarefa 1" (a tarefa que o funcionário que
  seria dispensado fazia). P3 (fim do SLA2) e P4 (metas 20/30) travavam essa seção; o mesmo
  conselho (linhas 54-60) recomenda o João fechar sozinho — **não encontrei registro de resposta
  formal a essa recomendação em arquivo posterior** (ver lacunas, seção 6).
- Nenhum dos dois é a "apresentação automática para reunião" que o cliente descreveu — são telas
  internas de acompanhamento diário, não o relatório/dashboard que sai para reunião.

### Periodicidade

Não encontrada. A única periodicidade textual ligada a "reunião" é a reunião semanal citada em
`conselho-4-perguntas-operacao.md:32` ("apresentar os indicadores ao cliente na reunião semanal"),
mas essa frase é inferência do conselheiro a partir da fala 13:06 do cliente sobre o que o
funcionário fazia — não é uma declaração direta do cliente sobre a periodicidade da camada 4.

---

## 3. Relação com o mockup da "visão do dono da Pacheco"

**Não há, em nenhum arquivo, uma frase do cliente ou decisão do João classificando o mockup da
Pacheco como "camada 4", parte dela, ou algo separado.** Isto é uma lacuna real — ver seção 6.

O que dá para inferir por contraste, sem forçar a conclusão:

- `2026-09-18-mockup-visao-do-dono-da-pacheco.md:17-21`, escrito pelo João: "Todas as telas do
  Controle de Obras feitas até 18/09 são internas da Manfac [...]. Este pedido é a primeira tela
  voltada para fora — quem lê é o cliente do cliente, o dono da rede de farmácias." Isso separa
  explicitamente o público da tela Pacheco (o dono da Drogaria Pacheco, cliente do cliente José
  Guilherme) do público mais provável da camada 4 (reunião entre Manfac e José
  Guilherme/DPSP — não fica claro se o dono da Pacheco participa dessa reunião).
- O pedido do cliente que gerou o mockup (`2026-09-18-mockup-visao-do-dono-da-pacheco.md:9-15`,
  literal): "Crie um mock up de como eu apresentaria a informação pro cliente sem demonstrar a
  operação interna da manfac [...] Ele precisa de um mock up pra ver obras, manutenção,
  cronograma. Uma visão de agente de ia que dispara as informações pra ele (ele tem que olhar uma
  página que ele vai ter a informação da op em tempo real)." Isso descreve uma página
  permanente + avisos por e-mail (início/fim de obra) — mais perto de um portal de cliente do que
  de "apresentação para reunião".
- Regra de conteúdo do mockup Pacheco (`2026-09-18-...md:48-52`): esconde tudo que é interno
  (equipe, prestador, custo, motivo de atraso, SLA, jargão). A camada 4, como descrita na
  transcrição, é "dashboard e relatórios de reunião" sem essa restrição declarada — não há
  indício de que a reunião da camada 4 tenha o mesmo público leigo/externo.

**Recomendação de leitura, não decisão:** o mockup Pacheco parece um produto **novo e mais
específico** (visão do dono da rede, focada em progresso e comunicação por e-mail), não uma
substituição do que o cliente pediu como "camada 4" na reunião de 31/08. Mas isso não está escrito
em lugar nenhum — precisa ser perguntado ao João ou ao cliente.

### Status do retorno do cliente

`divisao-trabalho-2026-09-20.html:490`, citação literal: "A tela para o dono da Pacheco foi
enviada em 18/09 e ainda não voltou resposta. Ela não atrapalha o prazo: é para o cliente do
cliente ver, não para a equipe trabalhar." **Sem resposta até 20/09** (data do arquivo mais
recente que toca o assunto). Não encontrei nada mais novo sobre isso nos arquivos de 21/09.

---

## 4. Decisões já tomadas (com data e arquivo) e perguntas sem resposta

### Decisões tomadas

| Decisão | Data | Arquivo |
|---|---|---|
| Tarefa da Roberta (compras) nasce no nosso sistema, não no Zeev | 01/09/2026 | `feedback-04-agente-cobrador.md:58-63` |
| Roteamento por falta: Material→Compras, Ferramenta/Equipe→Yuri | fala do cliente, sem data exata (repassada 01/09) | `feedback-03-tarefas-por-falta.md:8-28` |
| Aviso das 19h não escala, só atualiza contagem de dias | 01/09/2026 | `decisoes-para-ir-ao-ar.md:154-160` |
| Notificação aos admins do hub por e-mail e WhatsApp | 01/09/2026 | `decisoes-para-ir-ao-ar.md:63-68` |
| Agendador (base dos avisos 18h/19h) é imprescindível, construir | 01/09/2026 | `decisoes-para-ir-ao-ar.md:40-46` |
| Camada 3 e camada 4 ficam para depois, entram quando a equipe estiver usando o sistema | 31/08/2026 (reunião) | `ESTADO.md:860-867`, `cronograma-2026-09-14.html:365` |
| Roteamento "Documento/ART" e "Outro" para o Yuri é o *default nosso*, não confirmado pelo cliente (Decisão J) | pendente, marcada como aberta desde criação do mockup | `app/obras/_lib/tipos.ts:710-714`, `spec-v0-treinamento.md:59` |
| Mockup visão do dono da Pacheco: sem atraso/remarcação visível, só avanço e conclusão; e-mail no início e no fim da obra; sem campo de perguntar/responder | 18/09/2026 | `2026-09-18-mockup-visao-do-dono-da-pacheco.md:27-36` |

### Perguntas feitas ao cliente ainda sem resposta

- O que acontece quando o prazo da tarefa/cobrança vence (entra no aviso das 19h? vira aviso
  próprio? sobe para o dono?) — `feedback-03:63-64` e `feedback-04:53-54`.
- Compras vive no Zeev (em standby): a Roberta responde só por WhatsApp ou o processo formal de
  compra também é acionado no Zeev? (parcialmente respondido — a tarefa nasce no nosso sistema,
  mas o texto de `feedback-04:65-67` deixa em aberto se o Zeev entra depois, "com o processo
  formal de compra").
- Roteamento de "Documento/ART" e "Outro" (Decisão J) — nunca confirmado pelo cliente.
- Mockup da visão do dono da Pacheco — enviado 18/09, sem resposta até 20/09 (a data mais recente
  verificada).
- Provedor de WhatsApp (API oficial Meta/Twilio/360dialog vs não-oficial Z-API/Evolution) — não é
  pergunta ao cliente, é decisão técnica/de custo pendente do João (ver seção 6).

---

## 5. O que já existe no código (arquivo:linha) e o que falta

### Já existe — infraestrutura que a camada 3 reusaria

- **Tarefas com dono e prazo, abertas automaticamente pelo diário** —
  `app/obras/diario/_actions.ts:140-206` (função `abrirTarefas`). Confirma exatamente o pedido do
  feedback-03: ao salvar o diário com uma falta, o sistema cria a linha em `obras_tarefa` com
  `dono` (roteado) e `prazo` — não é o analista quem digita quem resolve.
- **Roteamento por tipo de falta (`ROTA_FALTA`)** — `app/obras/_lib/tipos.ts:708-725`:
  `Material → ROBERTA`, `Ferramenta → YURI`, `Equipe → YURI`, `Documento/ART → YURI` (marcado
  `nosso: true`), `Outro → YURI` (`nosso: true`), `Foto → equipe da obra` (chave `CHAVE_EQUIPE`).
- **Prazo padrão "fim do dia"** — `app/obras/_lib/tipos.ts:756-759` (`prazoPadrao`): fecha no
  mesmo dia, ou no dia seguinte se registrado depois das 18h. Isso bate literalmente com "até o
  final do dia" do feedback-04.
- **Cálculo de vencida sem gravar estado derivado** — `app/obras/_lib/tipos.ts:761-768`
  (`sitTarefa`): "vencida" nunca é coluna, é calculada contra hoje sempre que a tela renderiza.
- **Tela de tarefas** — `app/obras/tarefas/page.tsx`, `_lista.tsx`, `_actions.ts`. A resposta hoje
  é manual: `responderTarefaAction` (`app/obras/tarefas/_actions.ts:24-55`) — alguém abre a tela
  e marca; o comentário no topo do arquivo diz isso explicitamente: "NA v1 essa volta chega pelo
  WhatsApp, sozinha. Na v0 alguém marca aqui."
- **Painel do dia (internos)** — decidido em escopo v1, tela para administradores (não é a camada
  4). Ver `decisoes-para-ir-ao-ar.md:51-56`.

### O que falta — nada do envio automático existe

- **Nenhuma integração de envio de WhatsApp ou e-mail transacional no módulo obras, nem no resto
  do hub.** Busquei `whatsapp`, `twilio`, `z-api`, `evolution`, `resend`, `nodemailer` em todo o
  repositório (fora `node_modules`): o único resultado relevante é
  `manfac-site/lib/whatsapp.ts`, que é só um gerador de link `wa.me/...` para o formulário de
  contato do site institucional (`manfac-site`) — não manda mensagem nenhuma, é outro app, e não
  tem relação com o Controle de Obras.
- **Nenhum cron job de aviso/cobrança existe.** Os únicos jobs de cron do módulo são de
  sincronização com o Field: `obras-field-incremental` (`*/5 * * * *`) e `obras-field-completa`
  (`2 6 * * *`), definidos em `sdd-sql-obras-cron-jobs.sql:41-77` e confirmados em
  `.claude/rules/sql.md`. Não há job "aviso-18h", "aviso-19h" nem "cobrador" no banco nem no
  código — `find app/api/obras -type d` só retorna `sincronizar/`.
- **Telefone de equipes e prestadores não está cadastrado.** Confirmado em dois lugares:
  - Comentário no código, `app/obras/_lib/tipos.ts:731-734`: "A planilha guarda a equipe como
    texto solto (MANFAC-19, ALEX, DEFINIR), sem telefone nenhum — daí a normalização" (função
    `chaveDaEquipe`, que gera uma chave textual, não um contato).
  - `ESTADO.md:854-855` (pendência, ainda aberta): "**Cadastro de telefone das equipes /
    prestadores** — trabalho de operação do João. Trava o agente de WhatsApp, não trava a v1."
  - `divisao-trabalho-2026-09-20.html:485`, mais recente (20/09): "Continua aberto, sem pressa e
    sem travar ninguém: cadastrar o telefone das equipes e prestadores — o robô de cobrança da
    camada 3 vai precisar deles." Nenhuma tabela `obras_pessoa` (ou equivalente) com coluna de
    telefone foi encontrada nas migrations lidas.
- **Provedor de WhatsApp não escolhido**, com o trade-off já registrado em
  `decisoes-para-ir-ao-ar.md:79-88`: API oficial (Meta/Twilio/360dialog — exige número dedicado,
  verificação da empresa e template aprovado para a primeira mensagem) vs. provedor não oficial
  (Z-API, Evolution — número comum via QR, risco de bloqueio, sem garantia de entrega). O mesmo
  arquivo nota que o aviso das 19h é mensagem iniciada pela empresa, então **exige template
  aprovado no caminho oficial** — está registrado como pré-requisito de cronograma, não como
  detalhe.
- **Nenhum desenho de tela/mockup específico para a camada 4** (dashboard de reunião) foi
  encontrado — ao contrário da camada 3 (que tem seção dedicada nos mockups `mockup-obras.html`,
  rótulos `telaTarefas`, `decI`, `decJ`) e ao contrário do mockup Pacheco (arquivo HTML dedicado,
  `mockup-visao-pacheco-v01.html`).

---

## 6. Lacunas — o que não está em lugar nenhum e precisa ser perguntado ao João

1. **A relação entre a camada 4 e o mockup da visão do dono da Pacheco não está escrita em
   nenhum lugar.** Não há frase do cliente nem decisão do João dizendo se são a mesma coisa, se
   uma é subconjunto da outra, ou coisas diferentes com públicos diferentes. A seção 3 traz só
   inferência por contraste — precisa confirmação.
2. **"O que acontece quando o prazo da cobrança vence" nunca foi respondido pelo cliente**,
   apesar de perguntado duas vezes (feedback-03 e feedback-04). Sem essa resposta não dá para
   fechar o desenho de escalonamento da camada 3.
3. **Provedor de WhatsApp não decidido** (API oficial com template aprovado vs. não oficial via
   QR) — decisão de custo/prazo do João, não pergunta ao cliente, mas não está tomada em nenhum
   arquivo lido.
4. **"Quem cobre cronograma, cobrança ativa de fechamento de OS e apresentação semanal ao
   cliente entre 22/09 e essas frentes (camada 3 e 4) ficarem prontas"** — pergunta recomendada
   ao João em `conselho-4-perguntas-operacao.md:52-60` (15/09/2026). Não encontrei resposta
   registrada em nenhum arquivo posterior (`decisoes-joao-2026-09-15.md` não menciona o assunto).
   Isso é risco operacional aberto, não só lacuna documental — o funcionário que fazia isso na
   planilha antiga está sendo dispensado (transcrição 31/08, linha 527: "a gente vai demitir ele
   [...] o sistema passa a fazer").
5. **Cadastro de telefones** — sem prazo definido, "trabalho de operação do João", sem dono nem
   data-alvo declarada em nenhum arquivo.
6. **Nenhuma resposta do cliente ao mockup Pacheco desde 18/09** (verificado até 20/09, o arquivo
   mais recente que toca o assunto).
7. **Decisão J (roteamento de "Documento/ART" e "Outro") segue como default nosso**, nunca
   confirmada pelo cliente, apesar de já estar implementada em produção-código como se fosse
   definitiva.

---

**Nota sobre nomenclatura, para não confundir quem ler depois:** o repositório usa "J4" em vários
arquivos (`j4-decisoes-2026-09-14.md`, `mockup-j4-v01/v02/v03.html`, `revisao-mockup-j4-...md`)
para a **frente de trabalho do João** "completar a obra" (ficha editável, remarcação, ciclo de
vida da OS) — isso **não é a mesma coisa que "camada 4"** (dashboard/apresentação para reunião).
São dois sistemas de rótulo diferentes que coincidem no dígito por acaso.
