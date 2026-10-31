# OBRAS — Leva 4: Apresentação ao cliente, relatórios mensal/fase/entrega e agenda

**Data:** 31/10/2026 · **Fontes:** roadmap (Leva 4); mapa A22 (`docs/cliente/2026-10-29-obras-ajustes-pos-teste.md`: "período escolhível; entram todos os blocos que fazem sentido, inclusive highlights (ex.: etapa entregue antecipada)"); SGO do Eduardo §2.3 (mensal no último dia útil, fase na conclusão de cada etapa, entrega no fim; todo envio registrado), agenda de comunicação (regras literais abaixo), tela 13 ("mesma base, com marcos, medições aprovadas, aditivos e comparativo antes/depois"). **Base:** Leva 3 (`feat/obras-leva3`); SQLs leva2 e leva3 ainda não aplicados — o José aplica leva2 → leva3 → leva4 no fim ("executa tudo e deixa o sql pro final", 31/10).

## 1. Intenção
Fechar o ciclo de comunicação do SGO: o cliente recebe, além do diário e do semanal, o **mensal**, o de **fase** e o de **entrega**; a engenharia tem uma **agenda** que diz o que deve sair e quando (e o que está atrasado); e qualquer um monta uma **apresentação** com dados reais para reunião com o cliente, em tela cheia ou PDF.

## 2. O que entra

### 2.1 Relatórios de período (mensal, fase, entrega)
- Mesmo motor do semanal com período [início, fim]: avanço planejado × realizado na data-fim e desvio, curva S até a data-fim, previsão de entrega (quebra por responsável), **marcos** (etapas concluídas no período, com data base × real), atividades concluídas no período, em andamento, PPC médio do período (semanas avaliadas), impedimentos do período, decisões/restrições do cliente em aberto, **highlights** (§2.3), fotos do período (até 12, dos diários validados/enviados), observações da engenharia (texto, IA opcional igual ao semanal).
- **Mensal:** período = mês civil (do 1º dia — ou data-base — ao último dia útil); data de envio = último dia útil do mês (feriados da obra).
- **Fase:** um por etapa; período = início real da etapa → conclusão; data de envio = maior término previsto das atividades da etapa (SGO) — fica disponível quando a etapa está concluída.
- **Entrega:** período = data-base → término real; data de envio = previsão de término; inclui "comparativo base × final" (término base × real, dias de desvio com quebra por responsável).
- **Medições aprovadas e aditivos** ficam para o projeto Financeiro da obra (fora desta leva; o bloco não aparece).
- Fluxo igual ao semanal: rascunho → validar (congela conteúdo cliente e interno) → enviar; PDF; "Abrir PDF" no histórico. Engenheiro/admin valida e envia.
- Destinatários (*chamada minha*): mensal → tipo `mensal`; fase e entrega → quem tem `semanal` **ou** `mensal`.

### 2.2 Agenda de comunicação (SGO, literal)
"diários: cada dia útil de dataBase até a previsão de término; semanais: cada sexta a partir da primeira sexta ≥ dataBase, até término + 7 dias, antecipando se for feriado; mensais: último dia útil de cada mês até o mês do término; de fase: maior fimPrevisto de cada etapa; de entrega: previsão de término. Situação: Enviado no prazo | Enviado com atraso | ATRASADO | ENVIAR HOJE | Programado. A agenda se recalcula quando o cronograma muda; envios já feitos não podem ser apagados."
- Aba **Agenda** na Comunicação (lista por mês, filtros por tipo, situação colorida, atalho para o rascunho do item). Cálculo puro a partir do cronograma vigente + envios; nada gravado.
- A faixa de alertas do painel passa a usar a agenda (ATRASADO / ENVIAR HOJE de qualquer tipo).

### 2.3 Highlights (automáticos, o engenheiro pode desmarcar e escrever um próprio)
Etapa concluída antes do término base; atividade concluída antes do previsto; semana com PPC ≥ 80%; impedimento do cliente resolvido no período; desvio recuperado (melhorou ≥ 2 p.p. no período). Só fatos do lado cliente.

### 2.4 Apresentação ao cliente (A22)
- Item **Apresentação** na obra. Escolhe o **período** (esta semana, este mês, desde o início, personalizado) e os **blocos** (capa; resumo/sinal; avanço e curva S; cronograma por etapa (barras base × previsto × realizado); marcos e highlights; fotos (escolha até 12); impedimentos e "Aguardando vocês"; PPC; próximos passos (lookahead 3 semanas)). Todos marcados por padrão quando fazem sentido (bloco sem dado some).
- **Tela cheia** (um bloco por slide, setas do teclado e toque, tecla F, contador) e **Baixar PDF** (paisagem, mesmo conteúdo). Não grava nada. Sempre versão cliente. Qualquer usuário com acesso à obra.

## 3. Fora
Medições/aditivos/financeiro (projeto à parte), página do cliente (Leva 5), mapa (Leva 6).

## 4. Dados (`sdd-sql-obras-leva4.sql`)
- `obras_relatorio` (obra_id, tipo `mensal|fase|entrega`, referencia text (`AAAA-MM` | ordem da etapa | `entrega`), periodo_inicio, periodo_fim, estado rascunho→validado→enviado, observacoes, highlights jsonb, conteudo jsonb congelado no validado, validado_por/em; unique(obra_id, tipo, referencia)) — mesmas regras do `obras_semanal` (máquina de estados, imutável após validado, escrita só engenheiro/admin).
- `obras_envio.tipo` aceita `mensal|fase|entrega` + `relatorio_id` (trigger de mesma obra estendido).

## 5. Restrições
As de sempre + lições da Leva 3: conteúdo congelado é entrada não confiável (validar com esquema, escapar no HTML, fotos por id re-resolvidas); cliente vê só código exibido; nada de numero.
