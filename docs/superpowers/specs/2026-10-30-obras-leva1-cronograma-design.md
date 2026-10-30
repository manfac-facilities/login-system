# OBRAS — Leva 1: cronograma de verdade + painel + nova identidade visual

**Data:** 30/10/2026 · **Pedido:** José Guilherme — texto literal e mapa de ajustes em `docs/cliente/2026-10-29-obras-ajustes-pos-teste.md` (itens A1, A2, A3, A5, A13, A14, A18 e respostas às 12 perguntas). Base: spec `2026-10-29-obras-modalidade-obra-design.md` (Fase 1, no ar desde 30/10).

**Mockup:** o José dispensou mockup nesta leva ("Nao precisa fazer mockup") — exceção explícita à regra do AGENTS.md. Em troca, este documento descreve as telas com precisão e o build passa por revisão visual (screenshot) antes do deploy.

## 1. Intenção

No teste da Fase 1 o José achou o cronograma "ruim" e o layout "muito pobre": não dá para replanejar datas, não há visão por etapa nem Gantt, a atualização é uma tabela crua e o visual não transmite a Manfac. A Leva 1 transforma o cronograma numa ferramenta de planejamento comparável a MS Project / Builderpad / Prevision, com a identidade da Manfac, mantendo o que já funciona (base imutável, revisões, trava, diário, e-mail).

## 2. Objetivos / não-objetivos

**Objetivos**
- A1 Revisão com **Início e Fim editáveis** + comparação com a base por atividade (Início base, Fim base, Δ dias).
- A2 Estrutura **tipo MS Project**: linha-resumo por etapa (abre/fecha), atividades indentadas.
- A3 **Gantt** ao lado da tabela.
- A5 **Atualizar status**: % obrigatório + **dias restantes** opcional (quando informado, manda na projeção); datas reais automáticas.
- A13/A14 **Painel** com 3 séries Base · Previsto · Realizado em **% físico**: avanço físico, curva S, progresso semanal/mensal, evolução por etapa; sempre "dados até dd/mm".
- A18 **Clima por turno** (manhã/tarde) no diário.
- **Nova identidade visual** do módulo OBRAS com logos e cores da Manfac.

**Não-objetivos (outras levas):** lookahead/plano semanal/PPC/restrições Kanban (Leva 2), PDF do RDO (Leva 3), página do cliente/documentos/mensagens (Leva 4), mapa (Leva 5), integrações/IA (Leva 6). O botão de IA (resposta 12) entra na Leva 2.

**Anti-objetivos:** quebrar o que está no ar (base imutável, trava, máquina de estados do diário, e-mail); mostrar R$ ao cliente; uma tela bonita que fica lenta com 28+ atividades no celular.

## 3. Decisões do José (não reabrir)
1. Editar o **Fim** recalcula a duração; não existe "prazo máximo" separado.
2. Gantt **lado a lado** com a tabela no computador (estilo MS Project), escala **semana** com zoom **dia**; no celular só a lista.
3. % obrigatório; **dias restantes** opcional e, quando informado, manda na previsão de entrega.
4. Gráficos em **% físico**, não R$.
5. Sem mockup; layout "muito melhor", inspirado em sistemas do gênero (Figma/Behance/Dribbble), **com logos e identidade visual da Manfac**.

## 4. Identidade visual do módulo OBRAS (chamada minha — o José pode vetar)

Referências estudadas (Playwright, 30/10): Dribbble "ConstructOS" e "Structra" (KPI com numeral grande e fino, cartões limpos, sidebar escura), **"Builderpad — Construction Schedule"** (fases com bolinha de cor + anel de % + dias úteis + Gantt ao lado + Recolher/Expandir — é o modelo do cronograma), teamKube (barra com % preenchido), Prevision (Base laranja/Previsto/Realizado em todo gráfico + "dados até a última medição").

**Decisão:** o módulo OBRAS passa a usar a identidade do **site institucional da Manfac** (claro), não o tema escuro genérico do hub. Motivo: tela densa de cronograma/Gantt lê melhor em fundo claro, imprime, e é o que o cliente vai ver na Leva 4 — a Manfac precisa parecer a Manfac. O resto do hub continua escuro (fora do escopo).

- **Cores (tokens CSS do módulo, em `app/obras/obras/_ui/tema.css` ou equivalente com Tailwind v4 `@theme`):**
  - `--obra-ink: #00345e` (azul da marca — títulos, sidebar, barra "Previsto")
  - `--obra-orange: #f85e0b` (laranja da marca — ação primária, "Realizado", hoje)
  - `--obra-yellow: #f7cb15` (atenção)
  - `--obra-surface: #f6f6f5` (fundo da página) · `--obra-card: #ffffff` · `--obra-border: #dadad8`
  - `--obra-text: #333336` · `--obra-muted: #6e8894`
  - **Base:** cinza `#9aa9b2` tracejado/contorno (a "foto" — nunca cor cheia)
  - Status: verde `#1f9d55` (no prazo/concluída), amarelo `--obra-yellow` (atenção), vermelho `#d64545` (atrasada), **aguardando cliente** = vermelho com hachura diagonal; travada = cinza com cadeado.
  - Contraste mínimo 4.5:1 em texto; cor nunca é o único sinal (sempre rótulo/ícone/padrão).
- **Tipografia:** Inter (já no hub) para texto; **IBM Plex Mono** (como no site) para números, datas e % (KPIs com numeral grande peso 300–400, estilo ConstructOS). Base 14px em tabelas densas, 16px em formulários do celular.
- **Logos:** `public/logo-white.png` na sidebar azul; `public/logo.png` em fundos claros e no cabeçalho do e-mail/PDF futuro. Criar o **símbolo isolado** (arco + losango) como SVG para ícone compacto/favicon do módulo — *chamada minha: redesenhar o símbolo em SVG a partir do PNG; se houver arquivo vetorial oficial, usar ele*.
- **Motivo gráfico:** o quadriculado de planta (`blueprint-grid` do site) **só** no cabeçalho da obra, sutil.
- **Ícones:** SVG (Lucide via `lucide-react` se já existir no projeto; senão SVG inline) — nunca emoji.
- **Densidade:** dashboard denso (espaçamento 8–32px), cartões com borda 1px e raio 12px, sem sombras pesadas.
- **Movimento:** sutil (150–250ms), respeitar `prefers-reduced-motion`.

### Shell do módulo OBRAS
- **Sidebar fixa à esquerda (desktop, 240px, `--obra-ink`):** logo branca; seletor da obra (nome + OS + cliente); navegação: Painel · Cronograma · Diário · Impedimentos · Comunicação (+ espaços já previstos e desabilitados com "em breve": Lookahead, Documentos). No celular vira menu inferior com 4 itens (Painel, Cronograma, Diário, Impedimentos) e o resto num "Mais".
- **Cabeçalho da obra:** nome grande, OS · cliente · loja, pílula do sinal (No prazo / Atenção / Atrasado), "Dados até dd/mm hh:mm" (última validação de diário ou atualização de status), versão vigente ("v2 · reprogramada em 31/10"), faixa quadriculada sutil.
- A lista `/obras/obras` usa o mesmo visual: cartões por obra com sinal, barra base×previsto×realizado mini, entrega prevista, último diário.

## 5. Cronograma (A1, A2, A3, A5)

Tela dividida (desktop ≥1024px): **tabela em árvore à esquerda** (redimensionável, padrão ~55%) e **Gantt à direita**, com rolagem vertical sincronizada. Celular: só a árvore, com a barrinha de progresso dentro da linha.

**Barra de ferramentas:** Expandir tudo / Recolher tudo · seletor de versão (Base v1 · v2 · v3… vigente marcada) · "Mostrar base" (liga/desliga a sombra da base no Gantt) · escala Semana/Dia · "Hoje" (rola até hoje) · botões **Atualizar status** e **Nova revisão** (ou **Salvar revisão** / **Descartar rascunho** quando há rascunho; **Salvar base** enquanto a v1 não foi salva).

**Árvore (colunas):** ▸/▾ · nº · Atividade · Situação (pílula) · % (anel) · Dias úteis · Início · Fim · Início base · Fim base · Δ dias · Predecessoras · (no modo edição: cadeado de trava).
- **Linha de etapa (resumo):** fundo levemente tingido, nome da etapa em negrito com bolinha de cor da etapa; início = menor início das filhas, fim = maior fim, dias úteis do intervalo, % ponderado pelo peso das atividades, Δ do fim vs base. Clicar alterna aberto/fechado; estado lembrado por usuário/obra em `localStorage`.
- **Δ dias** = dias úteis entre Fim base e Fim projetado (positivo vermelho "+5", negativo verde "−2", zero "—").
- **Situação:** Concluída, Em andamento, Não iniciada, Atrasada, Início atrasado, Aguardando cliente, Travada.

**Edição (só em rascunho — base v1 antes de salvar ou revisão v2+):**
- Células editáveis inline: Atividade, Dias úteis, **Início**, **Fim**, Predecessoras, trava.
- **Início digitado** → grava `inicio_fixo` da atividade naquela versão; a atividade começa nessa data (se cair em fim de semana/feriado, vai para o próximo dia útil, com aviso).
- **Fim digitado** → recalcula `duracao` = dias úteis entre início e fim (mín. 1).
- Sem `inicio_fixo`, segue as predecessoras (como hoje). Mudança propaga para as dependentes sem data fixa.
- `inicio_fixo` antes do fim de uma predecessora: aceito, linha com **alerta amarelo** "começa antes da atividade N terminar".
- Limpar o Início fixo volta a seguir as predecessoras (ação "Seguir predecessoras").
- Versão salva = somente leitura (já garantido no banco).

**Gantt:**
- Cabeçalho de meses + semanas (escala Semana) ou dias (escala Dia), fins de semana e feriados sombreados, **linha "Hoje"** laranja.
- Por atividade: **sombra da base** (contorno cinza tracejado, fina, abaixo), **barra do previsto** (azul `--obra-ink` claro) com **preenchimento do % realizado** (laranja) e, se a projeção passou do previsto, **extensão projetada** em vermelho hachurado. Etapas = barra-resumo fina escura com "colchetes" nas pontas (estilo MS Project).
- Travadas com cadeado; aguardando cliente com hachura vermelha; dependências como setas finas (pode ficar desligado por padrão — *chamada minha*).
- Tooltip/foco: nome, datas previsto/base/projetado, %, Δ, situação. Acessível por teclado (foco na linha mostra o mesmo).

**Atualizar status (A5) — gaveta lateral (desktop) / tela cheia (celular):**
- Lista das atividades **em andamento** + **não iniciadas com início previsto ≤ data de status**, agrupadas por etapa.
- Por linha: % (slider + campo), **dias restantes** (opcional), status (iniciar/concluir), início real/fim real (preenchidos sozinhos: início real = data de status quando sai de 0%; fim real = data de status ao concluir; editáveis).
- **Data de status** no topo (padrão hoje).
- Salvar aplica em `obras_atividade_exec` (mesmas regras do diário: nunca regride sem confirmação explícita, trava respeitada, só engenheiro/admin). O diário validado continua alimentando o % normalmente.
- **Projeção com dias restantes:** se informado, `fimProjetado = somarDiasUteis(proximoDiaUtil(dataStatus), diasRestantes − 1)` (ou a data de status se 0), substituindo o cálculo por %. Sem dias restantes, regra atual.

## 6. Painel da obra (A13, A14)

Grade de cartões (inspirada em ConstructOS/Prevision), tudo em **% físico**:
1. **Linha de KPIs** (numeral grande Plex Mono): Avanço realizado % · Desvio (p.p.) vs previsto · **Dias vs base** ("+5 dias" com quebra por responsável) · Entrega prevista (data, com base riscada ao lado se mudou) · Impedimentos abertos (n, com "do cliente: n").
2. **Avanço físico:** três barras horizontais Base · Previsto · Realizado com o % de cada, "dados até dd/mm".
3. **Curva S:** eixo do tempo da data-base ao término; **Base** = linha cinza tracejada, **Previsto** (vigente) = linha azul, **Realizado** = colunas/linha laranja até a data de status; linha "Hoje". Legenda direta nas séries (não só cor).
4. **Progresso semanal / mensal** (alternável): barras agrupadas Base · Previsto · Realizado por período (p.p. de avanço no período).
5. **Evolução por etapa:** uma linha por etapa com bullet bar (base/previsto/realizado) e Δ dias da etapa.
6. Blocos atuais mantidos e redesenhados: impedimentos abertos por responsável, trava ativa, diário de hoje, último envio.

**De onde vem o Realizado histórico** (sem job): % de cada atividade em cada data = último `para` aplicado por diário validado (`obras_rdo_avanco` dos RDOs validados) **ou** pela atualização de status (registrar cada atualização de status numa tabela de histórico — ver §8) até aquela data; Realizado(D) = Σ peso × %(D). Base(D) e Previsto(D) = curva planejada da versão (Σ peso × %previsto(D)).

## 7. Diário (A18)
- Clima vira **dois campos**: manhã e tarde (sol/nublado/chuva/impraticável). O campo atual `clima` continua aceito (legado); o e-mail mostra "Manhã: ☀ … · Tarde: …" com ícones SVG (não emoji).
- O diário (mobile) recebe o novo visual (cores/tipografia/ícones), sem mudar o fluxo de 5 passos.

## 8. Dados (SQL novo `sdd-sql-obras-leva1.sql`, idempotente, aplicado pelo José)
- `obras_atividade.inicio_fixo date null` (versionada; o trigger de imutabilidade da versão salva já cobre).
- `obras_atividade_exec.dias_restantes numeric(6,1) null` (`>= 0`).
- `obras_atividade_status_hist` (obra_id, numero, data_status date, percentual, dias_restantes, status, origem 'diario'|'status', registrado_por (do JWT), registrado_em) — insert-only, RLS obras + guarda engenheiro/admin para origem 'status'; o diário validado também grava aqui (origem 'diario'). Alimenta a curva do Realizado.
- `obras_rdo.clima_manha`, `obras_rdo.clima_tarde` (mesmo check do `clima`).
- As guardas existentes (engenheiro/admin, trava, versão salva) continuam valendo; a guarda de `obras_atividade_exec` precisa aceitar `dias_restantes`.

## 8.1 Chamadas minhas após a revisão do builder
1. **Backfill do histórico:** o SQL popula `obras_atividade_status_hist` a partir de `obras_rdo_avanco` dos RDOs já validados/enviados (data_status = rdo.data, origem 'diario'). A curva do Realizado começa na data-base com 0.
2. **Séries:** Base = curva planejada da v1; **Previsto = curva planejada da versão vigente**; Realizado = histórico. A **projeção** (dias restantes / atraso) aparece só como extensão no Gantt e na "Entrega prevista"; o desvio em p.p. continua sendo Realizado − Previsto (vigente).
3. **`inicio_fixo`:** no **planejado** a atividade começa exatamente na data fixa (próximo dia útil se cair em folga), com alerta amarelo se antes do fim de uma predecessora. Na **projeção** prevalece o realista: em andamento/concluída usa o início real; não iniciada usa max(inicio_fixo, fim projetado das predecessoras + 1, hoje). Sucessoras sempre partem do projetado.
4. **Editar o Fim sem Início fixo:** grava só a duração (dias úteis entre o início calculado e o fim digitado); o Fim exibido é recalculado. Fim antes do início calculado → erro "Fim antes do início (dd/mm)".
5. **Peso zero:** o avanço da obra continua ponderado pelo valor; o **% da linha de etapa** usa a duração como peso quando a soma dos pesos da etapa é 0.
6. **Layout:** toda a árvore `/obras/obras/**` (lista, painel, cronograma, diário, impedimentos, comunicação) usa o tema claro; páginas da obra (`[id]/**`) têm a sidebar/menu inferior; as abas escuras do Gestão de Obras não aparecem dentro do shell da obra — a sidebar tem "← Gestão de Obras". As telas SPOT ficam como estão.
7. **Quebra por responsável:** usa `atrasoPorResponsavel` (nível obra) já existente em `_lib/cronograma.ts`; nada por atividade nesta leva.

## 9. Fora do escopo do builder decidir sozinho
- Paleta/identidade acima é chamada minha; se o José vetar o tema claro, voltar ao escuro do hub mantendo os mesmos componentes.

## 10. O que fica para o builder
Componentização, biblioteca de gráfico (preferir **SVG próprio**, como `painel/_gantt.tsx` já faz — sem dependência nova salvo justificativa), virtualização (só se >200 linhas), organização de arquivos, testes.
