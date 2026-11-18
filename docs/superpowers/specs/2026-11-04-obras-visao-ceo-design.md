# Gestão de Obras — Visão do CEO (todas as obras numa tela)

Data: 04/11/2026 · Fontes: A12 do mapa pós-teste (`docs/cliente/2026-10-29-obras-ajustes-pos-teste.md`),
tela 15 e papel "CEO" da especificação do Eduardo (`docs/cliente/2026-10-29-sgo-especificacao-eduardo.md`:
"Visualiza todas as obras e atua nas exceções · Leitura total multi-obra"), conversa com o José em 04/11.
Mockup aprovado: https://claude.ai/artifact/Vi2gx5o5XFE4ep6bBCAP7P (dados de exemplo).

## 1. Intenção

O José (e quem fizer o papel de CEO) abre uma tela numa segunda de manhã e entende, sem abrir obra por obra:

> "como estão, se tá andando, se tá parada, pq tá parada, depende de quem pra destravar, como tá o feeling
> do cliente com a obra, se faturamos quanto vamos faturar, se o que estamos gastando está aderente ao
> resultado esperado etc" — José, 04/11

Sobre o cliente, o José corrigiu: **não é um campo de satisfação**. É "a gente mesmo olhar ali para a tela e
entender se o cliente está satisfeito ou não". A tela mostra os **fatos** que indicam a relação; quem olha conclui.

Sobre o dinheiro: "não espera o orçado, pode seguir" e "cria a visão, mas com um aviso que ainda não tem orçado
caso ainda não tenha, e quando tiver você coloca a visão real".

Sobre o detalhe: ao clicar na obra, "explodir todo o andamento" — o mockup resolveu com andamento por etapa,
semana e últimos diários, e o José aprovou ("Pode seguir").

## 2. Metas, não-metas, anti-metas

**Metas**
- Uma tela, só leitura, com todas as obras em andamento, piores primeiro.
- Para cada obra: situação, avanço × previsto, entrega (base → projetada), o que trava e quem destrava,
  sinais da relação com o cliente, faturado / a faturar / custo / margem.
- Uma lista "Precisa da sua atenção hoje" com as exceções, cada uma numa frase.
- Ao abrir a obra na lista: andamento por etapa, a semana (PPC e causas), últimos diários, travas, sinais
  do cliente, dinheiro — e o link para a obra.

**Não-metas (agora)**
- Agir pela tela (resolver restrição, responder mensagem). Para agir, abre-se a obra.
- O papel CEO e os demais papéis do SGO — é o projeto seguinte (`obras-proximos-projetos`).
- Orçado / PEF por obra. Só o aviso e o lugar reservado (§5.6).
- Obras SPOT. A tela é da modalidade OBRA.
- E-mail, notificação, IA.

**Anti-metas (falharia mesmo funcionando)**
- Uma "nota" ou termômetro de satisfação do cliente.
- Mostrar valores a quem não pode ver valores.
- Inventar estado em obra sem cronograma (mostrar "Sem cronograma", nunca "Parada" ou "No prazo").
- Números diferentes dos que a própria obra mostra. A tela **reusa** os cálculos da obra; não recalcula por
  outro caminho.

## 3. Restrições

- Next desta versão: ler `node_modules/next/dist/docs/` antes de código (AGENTS.md).
- Tema claro Manfac do módulo (`app/obras/obras/obras.css`, `_ui/tema.ts`), pílulas existentes
  (`_ui/pilula-situacao.tsx`), números em `.obra-num`. Cor nunca é o único sinal.
- Regras de negócio em funções puras com teste em `__tests__/` (padrão do módulo: `alertas.ts`,
  `analista.ts`, `financeiro-obra.ts`).
- **Sem mudança de schema prevista.** Tudo sai de tabelas e funções que já existem. Se o construtor
  concluir que precisa de SQL novo, para e pergunta ao José (AGENTS.md).
- Autorização é território de borda (AGENTS.md, exceção 4): falha fechada, testada.

## 4. Quem vê

**Decisão minha (o José pode mudar):** até existirem os papéis do SGO, a tela é só para **administrador do
hub** (`isAdmin`), com acesso ao Obras. Quem não é admin recebe a mesma recusa das outras telas restritas
do módulo. Erro ao conferir = recusa.

Valores (bloco Dinheiro e quadros de faturamento/gasto): por obra, só quando `obras_pode_ver_valores(obra)`
devolve `true` (admin sempre devolve). Se a leitura falhar, o bloco mostra "Não foi possível ler os valores"
— nunca zero.

Quando os papéis do SGO chegarem, o papel CEO entra nesta guarda; esta tela não deve amarrar a guarda de
um jeito que dificulte isso.

## 5. O que a tela mostra (comportamento)

### 5.1 Universo
Mesmo critério da lista de obras atual (`app/obras/obras/page.tsx`): obras da modalidade OBRA, não
canceladas. Aditivos (OS filhas, `obra_pai_id`) **não** viram linhas: entram na obra mãe, como já faz o
Financeiro da obra.

**Quando a obra sai da tela (decisão do José, 04/11: "Deve continuar até finalizar o faturamento"):** a obra
fica enquanto houver valor a faturar, mesmo com a execução a 100%. Sai quando a execução está concluída
(avanço 100% no cronograma vigente) **e** o faturado alcançou o valor da obra (mãe + aditivos não
cancelados). Decisões minhas em volta disso:
- Obra com execução concluída e ainda faturando mostra pílula **Concluída** e o estado "Execução concluída ·
  faltam R$ X a faturar"; entra num grupo próprio, **depois** dos demais na ordem, e ganha o filtro
  "Faturando".
- Obra sem valor informado (`valor` nulo) não tem como provar que terminou de faturar: continua na tela, com
  "Valor da obra não informado" no bloco Dinheiro.
- Obra cujos valores não puderam ser lidos (erro) também continua: na dúvida, aparece.

### 5.2 Resumo no topo (4 quadros)
1. **Como estão as obras:** total em andamento e quantas atrasadas / em atenção / no prazo / sem
   cronograma, pelo `sinal` que a obra já calcula (`sinalDaObra`).
2. **Quem está segurando as obras:** travas abertas por responsável (Cliente, Manfac, Terceiros) e em
   quantas obras. Trava = restrição não liberada (`obras_restricao.situacao <> 'liberada'`) + impedimento
   aberto (`obras_impedimento` sem `encerrado_em`). Clima conta como Terceiros. Clicar filtra a lista.
3. **Faturamento da carteira:** faturado, a faturar e valor total, somando as obras cujos valores o
   usuário pode ver.
4. **Gasto × orçado:** custo realizado das obras + aviso "N de M obras ainda sem orçado. A comparação
   aparece quando o orçado da obra existir."

### 5.3 Precisa da sua atenção hoje
Uma frase por exceção, mais grave primeiro, com o nome da obra, o fato e quem destrava. Clicar abre a obra
na lista. Exceções:
- obra com sinal **Atrasado**;
- obra **parada** (§5.4);
- restrição com prazo vencido (prazo < hoje e não liberada);
- mensagem do cliente no portal sem resposta da Manfac há mais de 1 dia útil;
- relatório semanal não enviado na data esperada (o alerta que o painel da obra já calcula em `alertas.ts`).

Sem exceções: "Nada pedindo sua atenção hoje."

### 5.4 Lista de obras
Ordem: Atrasado, Atenção, No prazo, Sem cronograma; dentro de cada grupo, a mais tempo parada primeiro.
Filtros: Todas · Atrasadas e atenção · Esperando o cliente · Esperando a Manfac · Esperando terceiros ·
No prazo (com contagem).

Cada linha (fechada):
- **Obra:** OS, loja, engenheiro.
- **Situação:** pílula do sinal + estado em texto:
  - "Parada há N dias" quando não há avanço registrado há **3 ou mais dias úteis** (pelo histórico de %
    da obra, o mesmo que dá o `dadosAte`) e a obra não terminou. *Limite de 3 d.u.: decisão minha.*
  - "Andando, frente parada" quando há avanço mas há impedimento aberto;
  - senão "Andando" (No prazo) ou "Andando com atraso" (Atenção/Atrasado);
  - "Começou em dd/mm" nas duas primeiras semanas; "Sem cronograma" quando não há cálculo.
- **Avanço e entrega:** realizado × previsto (os mesmos números do painel da obra), entrega base →
  projetada e o desvio em dias úteis, ou "mantida".
- **Por que / quem destrava:** a trava principal — a restrição vencida mais antiga; senão o impedimento
  aberto mais antigo; senão a restrição aberta de prazo mais próximo; sem nenhuma, "Nada travando". Mostra o
  responsável (pílula Cliente com hachura / Manfac / Terceiros) e há quanto tempo, ou o prazo.
- **Relação com o cliente:** só os sinais ruins ou de atenção, curtos; sem nenhum, "Sem sinais ruins".
- **Dinheiro:** % faturado do valor da obra e o valor a faturar.

### 5.5 Obra aberta
- **Andamento por etapa:** cada etapa com barra do realizado, marca de onde deveria estar hoje e pílula de
  situação (as do módulo, incluindo "Aguardando cliente"). Base: `ObraGrande.etapas` + o previsto na data do
  cronograma vigente.
- **Esta semana:** atividades planejadas × concluídas, PPC e causas das não cumpridas (plano da semana do
  Last Planner). Sem plano: "Sem plano da semana".
- **Últimos diários:** os 3 últimos diários validados, data + resumo curto (equipe e o que foi feito).
- **O que está travando:** todas as travas abertas (descrição, tipo, responsável, prazo, vencida ou não).
  Sem travas: "Nenhuma restrição aberta" + PPC.
- **Sinais da relação com o cliente** (todos, bons e ruins):
  1. entrega: mantida ou mudou de X para Y;
  2. pendências com o cliente: restrições abertas com responsável cliente, quantas e a idade da mais antiga;
  3. mensagens do portal: a última mensagem é do cliente e está sem resposta desde quando; ou "respondidas";
  4. relatório semanal: último enviado e se saiu no dia.
- **Dinheiro da obra:** valor da obra (mãe + aditivos), faturado (com nº de notas), a faturar
  (valor − faturado, nunca negativo — se negativo, mostra "faturado acima do valor"), custo realizado e
  comprometido, margem realizada. Os números vêm do mesmo cálculo da aba Financeiro da obra
  (`consolidarMargem` / leituras `obras_fin_*`).
- Link **Abrir a obra →**.

### 5.6 Orçado × realizado
Hoje nenhuma obra tem orçado. Todo bloco de orçado mostra o aviso **"Orçado × realizado: ainda sem
orçado"** com o realizado que já existe. O exemplo verde da obra "Barra" no mockup é só ilustração de como
ficará; **não** se constrói agora. Quando o orçado por obra existir, o bloco passa a comparar
gasto/orçado com o avanço — trabalho daquele projeto.

## 6. O que fica com o construtor
- Rota e entrada no menu (sugestão: dentro de `/obras/obras`, item "Visão do CEO" visível só para quem pode
  abrir).
- Como carregar várias obras sem ficar lento (a lista atual já faz `lerObraGrande` por obra em paralelo).
- O formato exato das frases, desde que digam o fato, a obra e quem destrava.
- Celular: o mockup já empilha as colunas; manter.

## 6b. Decisões tomadas depois da leitura do construtor (minhas, o José pode mudar)

- **Universo (corrige §5.1):** a lista atual (`page.tsx`) **não** exclui canceladas nem aditivos. A tela nova
  exclui as duas (`etapa = 'cancelado'` ou `cancelado_em` preenchido; `obra_pai_id` preenchido). A lista
  atual não é mexida aqui; a divergência vai para `docs/DIVIDAS.md`.
- **"Parada" (corrige §5.4):** avanço = **aumento de `percentual`** de alguma atividade no histórico
  (`hist`), não o `dadosAte` (que conta qualquer atualização). Dias úteis pelo calendário da obra
  (`ObraGrande.feriados`).
- **Guarda (detalha §4):** função isolada e testada, `isAdmin` do hub, falha fechada. Valores por obra só com
  `obras_pode_ver_valores = true`; `false` mostra "Sem permissão para ver valores", erro mostra "Não foi
  possível ler os valores" — nunca zero, e essa obra fica fora das somas do topo (com a contagem de quantas
  ficaram de fora).
- **Carga:** a carteira OBRA tem poucas obras (hoje ~4), então aceita-se ler tudo por obra em paralelo numa
  carga só. A montagem do Financeiro hoje está dentro de `financeiro/page.tsx`: **extrair** para `_lib` e as
  duas telas usarem o mesmo caminho (obrigatório pelo anti-meta de números iguais), mantendo o teste
  existente da aba.
- **Faturado / a faturar:** faturado = a receita realizada da aba Financeiro (notas autorizadas/enviadas, não
  devolvidas). Valor da obra = mãe + aditivos não cancelados. A faturar por obra nunca negativo; abaixo de
  zero, a obra mostra "faturado acima do valor" e soma 0 no topo.
- **Mensagens:** "sem resposta" = a última mensagem da obra é do cliente, há mais de 1 dia útil. Se a leitura
  falhar, o sinal mostra "não foi possível ler as mensagens" — nunca "respondidas".
- **Semanal:** usa a agenda da obra (`agendaDaObra`) filtrada no tipo `semanal`; o detalhe mostra o último
  envio semanal (`obras_envio`) e se saiu no dia.
- **Impedimentos:** só `categoria = 'impedimento'` conta como trava; `orientacao` não.
- **Desempate da ordem:** dentro do grupo, parada há mais tempo; depois maior desvio de entrega; depois loja.

## 7. Como saber que está pronto
- Testes das funções puras: estado (parada/andando/sem cronograma), trava principal, sinais do cliente,
  exceções do dia, ordenação e filtros, a faturar.
- Teste da guarda: não admin é recusado; erro na conferência recusa.
- Conferência com dados reais: para cada obra OBRA em produção, os números da tela batem com o painel e a
  aba Financeiro da própria obra.
