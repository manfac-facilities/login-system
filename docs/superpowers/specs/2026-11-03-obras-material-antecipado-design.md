# OBRAS — Material antecipado (A19 + cadeia de causa)

**Data:** 03/11/2026 · **Branch:** `feat/obras-material-antecipado` (worktree `C:\Users\jguil\claude\wt-obras-material`)
**Mockup aprovado:** https://claude.ai/artifact/9r58kQdteAMDQigyTufX3f (aprovado pelo José em 03/11: "pode seguir").
**Origem:** roadmap `docs/obras/roadmap-obras.md` ("Depois": pedir material da obra, cadeia de causa no e-mail
interno); A19 em `docs/cliente/2026-10-29-obras-ajustes-pos-teste.md`.

## 1. Por quê

Pergunta ao José: "a última vez que faltou material, como chegou até você?" Resposta: **"chegou em cima da hora porque
ninguém se antecipou"**. Quem sabe com antecedência que uma atividade vai precisar de material comprado é **quem
acompanha o time de campo** (supervisor, analista da obra). O caminho até o Compras já existe ("Pedir material" no
Lookahead e no Financeiro, restrição ligada a pedido, selo "Pronta para liberar"). O que falta é o sistema **perguntar a
tempo** e **vigiar o prazo**.

Sucesso: nenhuma atividade começa sem material por falta de pedido feito a tempo, e quando uma compra vai atrasar a
obra, o engenheiro sabe antes, com a cadeia atividade ← material ← compra.

## 2. Objetivos

1. **Perguntar:** lista "Vem aí: precisa de material?" com as atividades que começam nas próximas 4 semanas e ainda não
   tiveram resposta. Respostas: **Não precisa** (sai da lista) ou **Precisa** + texto do material (vira restrição de
   material da atividade).
2. **Pedido nasce ligado:** "Pedir no Compras" abre a nova solicitação do Compras com obra, tipo material, prazo
   necessário = início da atividade, texto do material e a **restrição de origem**, que o Compras grava na solicitação.
   O Obras acompanha a compra **desde a solicitação** (não só depois do pedido).
3. **Vigiar:** avisos com a cadeia, no painel da obra, no Lookahead e no e-mail interno diário:
   - **Pedir até dd/mm** (amarelo) / **Pedir hoje** ou **vencido** (vermelho): restrição de material sem solicitação, ou
     atividade sem resposta cujo "pedir até" chegou.
   - **Não chega a tempo** (vermelho): pedido com previsão de entrega depois do início da atividade e entrega não
     confirmada.
   - **Solicitação parada** (amarelo): solicitação ligada, ainda sem pedido, com hoje > data mínima do Compras.

## 3. Não-objetivos

- Calcular quantidade, sugerir material a partir do orçamento/LPU, prazo de entrega por material ou fornecedor.
- Criar solicitação no Compras sem uma pessoa clicar "Enviar" lá (o Compras continua dono da solicitação e dos itens).
- Notificação push, WhatsApp, e-mail novo. Feriados no "pedir até" (o Compras não conta feriado; seguimos o Compras).
- Liberar restrição automaticamente na entrega (continua o engenheiro, como hoje).
- Mudar o fluxo do Compras além de aceitar e gravar a origem.

**Anti-objetivo:** a pergunta virar ruído que todo mundo ignora. Por isso: só atividades na janela, só uma vez por
atividade, e "Não precisa" resolve em um toque.

## 4. Regras

### 4.1 Janela e lista "Vem aí"
- Atividades da **versão vigente** do cronograma com execução **`nao_iniciado`** e **início até hoje + 28 dias**
  (4 semanas, o padrão do Lookahead), **incluindo as de início já passado que ainda não começaram** (o Lookahead as põe
  na primeira semana; são as de maior risco). Início = o mesmo do Lookahead (`inicioProjetado || inicioPrevisto` em
  `_lib/last-planner.ts`). "Ainda não começou" em todo este documento = status de execução `nao_iniciado`, não a data.
- Sai da lista quem tem **resposta "não precisa"** OU **alguma restrição de tipo `material`** (de qualquer origem).
- Ordem: "pedir até" crescente (o que vence primeiro no topo).
- Quem responde: **qualquer usuário com acesso ao Obras** (mesma regra de criar restrição hoje). Registra quem e quando.
- "Não precisa" pode ser **desfeito** no Lookahead (a atividade volta à lista). Sem tela de histórico.

### 4.2 "Pedir até"
- `pedirAte = início previsto − N dias de expediente`, com `N = folga_processo_dias + entrega_material_dias` da
  configuração **vigente** do Compras (`cmp_configuracoes`, chave `prazos`, linha com maior `vigente_desde`) e os dias de
  expediente da chave `expediente` (padrão do Compras quando não há linha: `dias [1..5]`; `PADROES` em
  `compras/lib/configuracoes/definicoes.ts`). Produção (conferido em 03/11 por SELECT): linha `prazos` vigente desde
  07/10 com `folga_processo_dias 3` + `entrega_material_dias 2` = **5 dias úteis**; sem linha `expediente` (vale o
  padrão seg–sex). Atenção: o `PADROES` do código é 4 + 5 = 9; só vale se a linha `prazos` sumir.
- Mesma aritmética de `somarDiasDeExpediente` do Compras (`compras/lib/solicitacoes/prazos.ts`), só que para trás. Teste:
  pedir em `pedirAte` (antes do fim do expediente) dá `dataMinima` = início da atividade, ou seja, não urgente.

### 4.3 Resposta "Precisa"
- Campo único **"Qual material?"** (obrigatório, até 500 caracteres).
- Cria `obras_restricao` com `tipo = 'material'`, `descricao` = texto, `responsavel = 'manfac'`, `prazo = pedirAte`,
  `situacao` inicial padrão. Mesma action/guarda que o Lookahead usa (reaproveitar `criarRestricaoAction`).

### 4.4 Ligação restrição ↔ solicitação
- Link: `/compras/solicitacoes/nova?obra=<obra_id>&tipo=material&prazo=<AAAA-MM-DD>&restricao=<restricao_id>&atividade=<N>&nome=<nome>&inicio=<AAAA-MM-DD>`.
  `atividade`, `nome` e `inicio` são **só para exibir** a faixa de origem (o Compras não calcula o cronograma); o que
  vale para gravar é `restricao`. O texto do material vai no campo livre de descrição/motivo da solicitação (o
  construtor escolhe qual, conforme o form do Compras).
- Compras grava `cmp_solicitacoes.obras_restricao_id`, **sem FK** (regra do Compras: FK só para `public.cmp_*`,
  `supabase/hub-install/README.md` e `tests/hub-install-safety.test.ts`; espelha `obras_restricao.cmp_pedido_id`, também
  sem FK). **Guarda no banco (falha fechada), trigger no Compras:** no insert/update da coluna, só aceita se a restrição
  existir, for `tipo = 'material'` e tiver o **mesmo `obra_id`** da solicitação; senão recusa. Depois de gravada a
  coluna não muda. Restrição inválida no link = o Compras ignora o parâmetro e mostra aviso (como já faz com obra
  inválida), não quebra o form.
- **Do lado do hub (falha fechada), trigger em `obras_restricao`:** recusa **apagar** ou **trocar o `tipo`** de uma
  restrição que tenha solicitação ligada pela origem e não terminada (etapa fora de cancelada/recusada). Mensagem:
  "Esta restrição tem a solicitação #N no Compras. Cancele lá antes." Assim não sobra id órfão nem restrição de outro
  tipo com compra. A leitura ainda ignora id que não casar (defesa para o que for apagado por SQL manual).
- Uma restrição pode ter várias solicitações (pedido refeito). Para o aviso vale a **mais recente não terminada sem
  sucesso** (ver etapas abaixo).
- **Etapas do Compras** (`cmp_solicitacoes.etapa`, `compras/lib/solicitacoes/tipos.ts`):
  - `cancelada`, `recusada` → não conta; se todas forem assim, a restrição volta a "Pedir até".
  - `atendida_estoque` → material atendido pelo estoque: equivale a **entregue** ("Pronta para liberar"), nunca "parada".
  - `concluida` → equivale a entregue.
  - demais (`decisao_estoque`, cotação, aprovação etc.) sem pedido → em andamento; vira "parada" se hoje > data mínima.
- **Vários pedidos na mesma solicitação** (um por fornecedor, `sequencia`): "Não chega a tempo" se **qualquer** pedido
  não entregue tiver previsão depois do início (vale a pior previsão); "entregue" só com **todos** entregues.
- `obras_restricao.cmp_pedido_id` (ligação manual antiga) continua valendo; "Ligar a um pedido existente" continua na
  tela. Se houver as duas, a solicitação ligada pela origem manda.

### 4.5 Avisos (puro, testável)
Para cada atividade na janela (ou com restrição de material não liberada cuja atividade ainda não começou):

| Situação | Nível | Texto |
|---|---|---|
| sem resposta e `pedirAte ≤ hoje` | vermelho | "Ninguém respondeu e o prazo para pedir vence hoje / venceu em dd/mm" |
| sem resposta e `pedirAte > hoje` | (só na lista, não vira aviso) | — |
| restrição material, sem solicitação, `pedirAte ≤ hoje` | vermelho | "Pedir hoje: <material>" / "Pedir: vencido em dd/mm" |
| restrição material, sem solicitação, `pedirAte > hoje` | amarelo | "Pedir até dd/mm: <material>" |
| pedido com `previsao_entrega > início` e entrega não confirmada | vermelho | "Material chega N dia(s) útil(eis) depois do início" |
| solicitação sem pedido e `hoje > data_minima` | amarelo | "Solicitação #N parada em cotação" |
| restrição liberada, ou entregue, ou no prazo | — | sem aviso |

Cada aviso carrega a cadeia: `Atividade N começa dd/mm` ← `<material>` ← `<solicitação/pedido e situação>`, e um destino
(diário para responder, Compras para pedir, Lookahead com a restrição selecionada para o resto). Ordem: vermelho antes
de amarelo, depois início da atividade.

Leitura do Compras que falhar **não vira aviso falso**: some só o aviso que dependia dela (mesmo padrão de
`calcularAlertas`), e a restrição mostra "andamento indisponível agora".

## 5. Telas (seguir o mockup)

1. **Diário (celular):** passo novo **"Vem aí"** antes de "Enviar", **opcional** (não bloqueia o envio do diário). Cartão
   por atividade: número, nome, "Começa dd/mm · Pedir até dd/mm", selo; botões "Não precisa" / "Precisa"; depois de
   "Precisa", "Pedir no Compras". Lista vazia: "Tudo respondido nas próximas 4 semanas." Toque ≥ 44px.
2. **Compras (app separada):** faixa de origem "Pedido para a restrição da atividade N · <nome> · começa dd/mm"; obra,
   tipo e prazo preenchidos; a prévia de data mínima/urgente que o form já tem continua.
3. **Lookahead:** coluna/indicação de material por atividade (Sem resposta / Não precisa / material) e "pedir até";
   a restrição de material mostra a **trilha** Restrição → Solicitação → Cotação → Pedido → Entrega com as datas do
   Compras; botões conforme o caso ("Pedir no Compras", "Ver no Compras", "Desfazer não precisa"). Sem valores (R$)
   nunca.
4. **Painel da obra:** os avisos entram na `FaixaAlertas` existente, com a cadeia e o botão para onde se resolve.
5. **E-mail diário, versão interna** (`_lib/email-diario.ts`, lado `interno`): seção **"Materiais"** com os avisos
   vermelhos e amarelos; sem aviso, a seção não aparece. **Nunca no lado cliente.**

Tema Manfac claro (`.obra-tema`), números em `.obra-num`, sem emoji.

## 6. Dados

### Hub (`sdd-sql-obras-material.sql`, aplicado pelo José)
- `obras_material_resposta` (`obra_id` FK obras_obra on delete cascade, `atividade_numero int`, `criado_por` forçado do
  JWT, `criado_em` forçado; `unique (obra_id, atividade_numero)`). Só guarda o "não precisa" (o "precisa" é a própria
  restrição). RLS: select/insert/delete com `obras_has_access()`; sem update.
- `obras_compras_prazos()` — security definer, `search_path` fixo, executável por `authenticated`, devolve os `valor`
  vigentes das chaves `prazos` e `expediente` de `cmp_configuracoes` (null quando não houver linha) só para quem tem
  `obras_has_access()`; sem acesso = vazio. O app usa os padrões do Compras quando vier null.
- `obras_restricao_compras(p_obra)` — security definer, como `obras_restricao_pedidos` (que continua para a ligação
  antiga): por restrição da obra, as solicitações com `obras_restricao_id` = restrição, `ambiente = 'producao'`, com
  número, etapa, enviado_em, data_minima, prazo_necessario e o pedido (left join: sequência, fornecedor, situação,
  previsão, entrega). **Sem valores.** Mesma regra de acesso de `obras_restricao_pedidos`.

- Trigger em `obras_restricao` (before delete / before update of `tipo`): recusa se existir solicitação ligada pela
  origem com etapa fora de `cancelada`/`recusada` (§4.4). Security definer para ler `cmp_solicitacoes`.

### Compras (`supabase/hub-install/017_cmp_obras_restricao.sql`, repo `compras`)
- `cmp_solicitacoes.obras_restricao_id uuid null` (**sem FK**, regra do Compras) + índice.
- Trigger de guarda (insert/update da coluna): restrição existe, `tipo = 'material'`, mesmo `obra_id`; senão
  `raise exception` (falha fechada). Coluna imutável depois de gravada. Tem que passar em `tests/hub-install-safety.test.ts`
  sem exceção nova.

Verificação no padrão das levas (`docs/obras/2026-11-03-verificacao-obras-material.sql`: seção 0 exige o que já existe,
JWT simulado, `RESUMO: n/N OK`, rollback; PGlite local). Cobrir: resposta duplicada recusada; usuário sem acesso não lê
prazos nem compras; guarda do Compras recusa restrição de outra obra, de outro tipo e inexistente.

## 7. Ordem de deploy
Compras `017` → `sdd-sql-obras-material.sql` (a função e a trava do hub leem a coluna nova do Compras) → app do
Compras → app do hub. Sem o SQL o hub mostra a lista sem "pedir
até" e sem andamento (leituras falham fechadas como vazio, sem aviso falso); sem o app do Compras o link funciona como
hoje (o Compras ignora parâmetros que não conhece).

## 8. Restrições
AGENTS.md, `.claude/rules/obras.md`, `.claude/rules/sql.md`; Next 16 (ler `node_modules/next/dist/docs/` para API nova).
Schema autorizado pelo José nesta conversa (03/11). SQL só em arquivo; **nenhum agente escreve em produção** (SELECT de
catálogo permitido). Cliente nunca vê material/compra. Commits pt-BR com trailer; nunca commitar `AGENTS.md`. Compras é
repo e deploy próprios: mudar só o necessário em `app/(modulo)/solicitacoes/nova/`, `lib/solicitacoes/` e o SQL 017.

## 9. Fica com o construtor
Nome e lugar dos componentes; em qual campo do form do Compras o texto do material entra; como o passo "Vem aí" se
encaixa em `_passos.tsx`; reaproveitar `restricao-pedido.ts` ou criar `_lib/material.ts` (puro, TDD); copy final dentro
do tom do mockup.

## 10. Chamadas minhas (não discutidas com o José)
- Janela fixa de 4 semanas (o Lookahead deixa escolher 3/4/6 só na tela).
- Passo "Vem aí" opcional no diário.
- `responsavel = 'manfac'` e `prazo = pedirAte` na restrição criada pela resposta.
- Atividade sem resposta só vira aviso quando o "pedir até" chega.
- Avisos no e-mail diário interno (não no semanal).
- Da revisão independente (03/11): sem FK no Compras + trava no hub contra apagar/trocar tipo com compra ativa;
  `atendida_estoque`/`concluida` = entregue, `recusada` = cancelada; pior previsão entre vários pedidos; atividades de
  início passado e não iniciadas entram; nome e início da atividade vão no link só para exibir.
