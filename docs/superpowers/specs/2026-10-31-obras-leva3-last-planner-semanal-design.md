# OBRAS — Leva 3: Last Planner + relatório semanal

**Data:** 31/10/2026 · **Fontes:** roadmap `docs/obras/roadmap-obras.md` (Leva 3); mapa A4, A6, A7 (`docs/cliente/2026-10-29-obras-ajustes-pos-teste.md`, respostas 5–7 "ok": engenheiro fecha o plano na sexta; restrições com lista fixa + quadro de 3 colunas; IA sugere e o engenheiro revisa, botão opcional — resposta 12); Fase 2 da spec base; SGO do Eduardo §2.3 (semanal toda sexta, antecipa em feriado), §5 (alertas), §6 item 11 (conteúdo do semanal). **Base:** Leva 2 (branch `feat/obras-leva2`, SQL ainda não aplicado). O José pediu para seguir sem pausa e deixar os SQLs para aplicar no fim.

## 1. Intenção
Trazer o ritmo do Last Planner: enxergar 3–6 semanas à frente o que precisa estar liberado (restrições), comprometer um plano por semana, medir o PPC (% do prometido entregue) com a causa do que não foi cumprido, e mandar ao coordenador do cliente um **relatório semanal** que mostra isso tudo — inclusive o que depende do cliente.

## 2. O que entra

### 2.1 Restrições e Lookahead (A4, A6)
- Item **Lookahead** da sidebar passa a funcionar (sai o "em breve").
- Tela Lookahead: atividades não concluídas cujo início (previsto ou projetado) cai nas próximas **N semanas** (seletor 3/4/6, padrão 4), agrupadas por semana; cada atividade mostra suas restrições e um selo **Pronta** (todas liberadas) / **Com restrição** (n abertas).
- **Restrição** = tipo (lista fixa: Acesso/área, Material, Mão de obra, Projeto/informação, Decisão do cliente, Equipamento, Outro), descrição, **responsável** (Cliente / Manfac / Terceiro), prazo, situação **Identificada → Em tratativa → Liberada**, atividade (número) obrigatória.
- **Quadro de restrições** (Kanban, 3 colunas) com filtro por responsável e atrasadas (prazo vencido) em destaque; mover entre colunas por botão (arrastar opcional).
- Quem cria/move: engenheiro, admin ou qualquer usuário com acesso à obra (*chamada minha: o administrativo também alimenta*); apagar: autor ou admin.
- Restrição do **cliente** em aberto aparece no painel em "Aguardando vocês" e no semanal.

### 2.2 Plano da semana e PPC (A4)
- Na sexta (ou em qualquer dia), o engenheiro **monta o plano da próxima semana** (segunda a sexta): escolhe atividades — as **Prontas** do lookahead vêm marcadas; uma com restrição aberta pode entrar com aviso — e define a **meta de %** de cada uma ao fim da semana.
- O plano é **fechado** (salvo) e não muda depois; o diário da semana mostra "Plano da semana" no passo "O que andou" (as atividades do plano vêm primeiro).
- No fim da semana (sexta ou ao montar o semanal), para cada item: **cumprido** se o % realizado ≥ meta; não cumprido pede **causa** (mesma lista do diário: Cliente/loja, Material, Equipe, Clima, Projeto, Outro — mapeamento José: Cliente/loja e Projeto → cliente; Material e Equipe → Manfac; Clima → clima; Outro → sem responsável).
- **PPC** da semana = itens cumpridos ÷ itens planejados; histórico do PPC por semana (gráfico de barras no painel).

### 2.3 Relatório semanal (Fase 2, SGO §6 item 11)
- Tela **Semanal** (dentro de Comunicação ou item próprio — *chamada minha: botão "Semanal" na aba Comunicação e alerta no painel*): na sexta (antecipa para o último dia útil se for feriado; considera feriados da obra), monta o rascunho da semana (segunda a sexta).
- Conteúdo (cliente): obra, semana, avanço planejado até a sexta × realizado × desvio, previsão de entrega (com quebra por responsável), **PPC da semana** e itens não cumpridos com causa (Manfac sem área interna), atividades concluídas, em andamento (% e término), programação da próxima semana (o plano novo, se já fechado), **decisões/restrições que dependem do cliente** (só as visíveis ao cliente), impedimentos da semana, fotos da semana (até 8, dos diários) e **observações da engenharia** (texto).
- **Botão "Sugerir texto com IA"** (opcional): escreve um rascunho das observações — resumo de desvios, gargalos e oportunidades de recuperação — a partir dos dados da semana; o engenheiro edita. Nunca enviado sem revisão. Exige a variável `ANTHROPIC_API_KEY` no servidor; sem ela o botão não aparece (*chamada minha: modelo `claude-opus-5-5` com effort `low`, `fallbacks: "default"`, via SDK oficial `@anthropic-ai/sdk`*).
- **Prévia**, **Validar e enviar** (engenheiro/admin) aos destinatários com tipo **semanal** (lado cliente) e versão interna aos internos; **PDF** (react-pdf, mesmo modelo visual) anexado e disponível em "Abrir PDF" no histórico.

### 2.4 Alertas do painel (SGO §5)
Faixa de alertas no topo do painel da obra (só o que estiver valendo): N atividades atrasadas → "comunicar o cliente hoje" (atalho para Comunicação imediata); desvio < −5 p.p. → "definir ação de recuperação e registrar no semanal"; diário de dia útil passado sem envio; semanal da sexta não enviado; N decisões/restrições aguardando o cliente; N restrições vencidas.

## 3. Fora desta leva
Apresentação e relatórios mensal/fase/entrega (Leva 4), página do cliente (Leva 5), mapa (Leva 6), financeiro (à parte).

## 4. Dados (SQL novo `sdd-sql-obras-leva3.sql`, aplicado no fim junto com os demais)
- `obras_restricao` (obra_id, atividade_numero, tipo, descricao, responsavel, prazo, situacao, liberada_em, criado_por (JWT), criado_em (forçado), atualizado_em/por).
- `obras_plano_semana` (obra_id, semana_inicio date (segunda), fechado_em, fechado_por, unique (obra_id, semana_inicio)) + `obras_plano_item` (plano_id, numero, meta_percentual 0–1, percentual_final, cumprido bool, causa, avaliado_em/por). Plano fechado: itens imutáveis exceto a avaliação.
- `obras_semanal` (obra_id, semana_inicio, estado rascunho→validado→enviado (máquina de estados como o RDO), observacoes, validado_por/em) — conteúdo imutável após validado.
- `obras_envio.tipo` aceita `semanal`.
- RLS obras; escrita de plano/semanal só engenheiro/admin (guarda `obras_engenheiro_ou_admin`); restrição por qualquer acesso.

## 5. Restrições
As de sempre (AGENTS.md, rules obras/sql): SQL só em arquivo novo, nenhum agente executa SQL; guardas falham fechadas; tema Manfac; cliente nunca vê R$, item oculto ou área interna; sem emoji; `numero` imutável.
