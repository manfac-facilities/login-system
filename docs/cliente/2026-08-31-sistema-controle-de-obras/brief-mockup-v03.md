# Brief do mockup v03 — Sistema de Controle de Obras

Para quem for aplicar as mudanças em `mockup-obras.html`.
Fonte: `feedback-05-liberado-por-mau-uso-fotos-diarias.md` (literal do cliente) e
`feedback-05-leitura-e-decisoes.md` (a tradução em decisões). **Leia os dois antes.**

## Regra que vale para tudo

A v02 foi **aprovada pelo cliente**. Isto não é um redesenho — são quatro acréscimos
cirúrgicos. Não mexa em layout, cor, tipografia, estrutura de telas, nem em texto que
já está lá e não foi citado abaixo. Não "melhore" nada de passagem.

Siga as convenções que já existem no arquivo: `CICLO`/`ETAPAS`/`ESTEIRA` para o ciclo de
vida, `marcos` para as datas de cada passo, o padrão de `.pill` para etiquetas, os
blocos `.box` / `.box-h` / `.box-b` na ficha, e o sistema de feedback por seção
(`class="fb"`, `data-fb`) — **toda seção nova precisa do campo de feedback embaixo,
igual às que já têm.** É por ali que o cliente responde.

Português do Brasil em toda a interface. Nada de jargão técnico na tela.

---

## Mudança 1 — Liberação para executar ("liberado por" + data)

**O conceito:** hoje o mockup só conhece `osAprovada` e a data `aprovacao`. Passam a
existir **dois destravamentos independentes**:

| | Campo novo | O que é |
|---|---|---|
| Liberação | `liberadoPor` (nome) + `liberadoEm` (data) | o OK verbal de um analista do cliente: "pode executar, a OS eu aprovo depois" |
| Aprovação da OS | `osAprovada` + `marcos.osAprov` (já existem) | o ato formal no sistema do cliente |

Nomes de quem libera, tirados da planilha real: **AMANDA, LEANDRO, JUAN**.
`liberadoPor: null` significa que ninguém liberou.

**As quatro combinações precisam ser visíveis, e a quarta é a que importa:**

1. liberada e com OS → normal, sem alarde
2. liberada, sem OS → executando com OK informal. Mostrar quem liberou e há quantos dias
   a OS não sai.
3. não liberada, com OS → normal (a OS já é a autorização)
4. **nem liberada nem com OS → "Sem cobertura".** Serviço sendo feito sem documento e
   sem ninguém nomeado que tenha autorizado. É o estado de risco que hoje ninguém
   enxerga. Trate com o destaque visual mais forte disponível no arquivo (o mesmo peso
   que a obra crítica já tem), mas sem inventar componente novo.

**Onde aparece:**

- **Ficha da obra:** um bloco "Autorização" com as duas linhas — "Liberado por Amanda ·
  12/08" e "OS aprovada · 20/08" ou "OS ainda não aprovada · há 22 dias". Quando não há
  nem uma nem outra, o bloco diz isso com todas as letras.
- **Base de obras:** etiqueta na obra em campo sem OS aprovada; e um filtro para
  "sem cobertura".
- **Esteira (ciclo de vida):** na etapa de cobrança da OS, mostrar quem liberou — a
  cobrança precisa ter nome, é ele que a Manfac vai procurar.

**Distribua os campos novos pelas obras de exemplo** de modo que as quatro combinações
apareçam na base, incluindo pelo menos duas obras "sem cobertura".

---

## Mudança 2 — Mau uso é etiqueta, não etapa

**O que é:** dano por uso indevido do cliente — funcionário arromba o cadeado, quebra a
chave dentro do tambor. A Manfac conserta e cobra.

**Hoje está errado:** na planilha, `MAU USO - APROVAR OS` vive na coluna de status,
misturado com `FECHAR OS` e `PENDENTE FATURAMENTO`. Classificação ocupando lugar de
etapa — e por isso 22 obras somem do funil normal.

**O que fazer:** campo novo `mauUso: true/false`, separado de `etapa`. A obra de mau uso
percorre **a mesma esteira de todas as outras** e carrega uma etiqueta. Nenhuma etapa
nova, nenhum caminho paralelo, nenhuma tela própria.

- Etiqueta "Mau uso" visível na base e na ficha
- Filtro na base
- No texto explicativo do ciclo de vida, uma linha dizendo que mau uso é classificação,
  não etapa — e que por isso essas obras voltaram para a contagem normal do funil
- As obras de mau uso do exemplo são de SERRALHERIA, valor entre R$ 175 e R$ 527, quase
  todas "chave/tambor/cadeado". Use descrições desse feitio.

---

## Mudança 3 — Relatório derivado, e o estado "Pendente fechamento"

Hoje a etapa `relatorio` está marcada no arquivo como "a única sem nome na planilha".
O cliente resolveu: **ninguém marca o relatório à mão — ele é deduzido do Field.**

A regra, na formulação dele:

```
OS fechada no Field  ──►  o relatório existe   (dedução automática, via API)
        │
        ├── OS aprovada no sistema do cliente  ──►  FECHAR OS
        │                                            (fila de trabalho: alguém pega e faz)
        │
        └── OS não aprovada                    ──►  PENDENTE FECHAMENTO
                                                     (fila de cobrança: só o cliente destrava)
```

**O que muda no ciclo:**

- A etapa do relatório passa a ser derivada, não marcada. Deixe explícito na tela que
  ela vem do Field Control — some o ar de "campo que alguém esqueceu de preencher".
- Entra o estado **"Pendente fechamento"**: relatório pronto, OS não aprovada. Hoje o
  arquivo tem `aprovarOS` ("Cobrar aprovação da OS") cobrindo aproximadamente esse
  caso — decida se renomeia ou se acrescenta, mas o nome que o cliente usa é
  **Pendente fechamento**, e é ele que tem que aparecer na tela.
- A diferença entre as duas filas precisa estar dita em uma frase na própria tela:
  "Fechar OS" é o que depende de nós; "Pendente fechamento" é o que depende do cliente.
  Hoje as duas estão embaraçadas dentro das 89 obras executadas e não faturadas.

---

## Mudança 4 — Foto de evolução, todo dia, na linha do tempo

**Decidido pelo João em 03/09:** a v1 registra a foto **pela tela**; o agente de
WhatsApp entra na sequência escrevendo no mesmo lugar. O mockup desenha o destino final
das fotos, não o canal.

- Cada dia da **linha do tempo do diário** (na ficha, já existe) passa a poder ter
  **foto**: miniatura no dia, e o dia sem foto aparece como dia sem foto — a ausência
  tem que ser visível, é ela que dispara a cobrança.
- Uma faixa de **evolução** na ficha: as fotos dos últimos dias em sequência, para bater
  o olho e ver a obra andando. É esse o pedido — "pra gente acompanhar a evolução".
- No diário do dia, ao responder, existe o **anexar foto** junto com a evolução.
- Use retângulos de placeholder rotulados, no padrão `.placeholder` que já existe no
  arquivo. **Não** embuta imagens de verdade nem chame CDN de imagem.
- Uma nota curta na tela: a foto vai poder chegar por WhatsApp, respondendo ao agente
  das 18h — e cai no mesmo lugar. Como nota de próximo passo, não como coisa pronta.

**Regras que valem e já estão decididas** (não reabrir): cobrança às 18h, num disparo
só; só obras em campo recebem; foto que não veio é falta, e falta vira tarefa com dono
e prazo, na mecânica que a tela de Tarefas já tem.

---

## Ao terminar

- O arquivo tem que abrir e funcionar: navegação entre as cinco telas, filtros, ficha,
  diário, tarefas, painel. Nada de erro no console.
- Não renomeie o arquivo, não mude o `<title>`, não mexa no favicon.
- Escreva ao fim um resumo curto do que mudou e do que você decidiu sozinho.
