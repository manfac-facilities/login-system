# OBRAS — Leva 2: uso no dia a dia

**Data:** 31/10/2026 · **Fontes:** roadmap `docs/obras/roadmap-obras.md` (Leva 2), mapa de ajustes A17/A20/A21 (`docs/cliente/2026-10-29-obras-ajustes-pos-teste.md`), reunião R13/R15 (`docs/cliente/2026-10-31-obras-anotacoes-reuniao-validacao-leva1.md`), especificação SGO do Eduardo §2.3 e §9 · **Base:** Fase 1, Leva 1 e Leva 1b no ar (master `855c369`).

## 1. Intenção
Deixar a obra redonda para o uso diário antes das levas maiores: a aba Comunicação vira o **histórico de tudo o que foi comunicado** (automático e manual, com ata de reunião), as configurações saem para um **menu próprio**, o diário ganha **PDF**, obras sem orçamento por atividade conseguem medir avanço (**% por duração**), existe **comunicação imediata** e os **feriados municipais** entram por obra.

## 2. Decisões do José (não reabrir)
1. Registro manual na Comunicação: **tipo, data, participantes e texto**, sem anexo. Fica **só registrado** no histórico.
2. **Ata de reunião** segue um **modelo de documento**, com **Baixar PDF** e um botão opcional **Enviar por e-mail**.
3. Destinatários, engenheiro, data-base, atividade-trava vão para um menu **Configurações** separado (A21).
4. PDF do diário **sem assinatura**, botão **Gerar PDF**; o histórico de envios ganha **Abrir** o PDF daquele diário (R13).
5. "Criar cronograma do zero" já entrou na Leva 1b (`_criar-cronograma.tsx`); esta leva só faz o acabamento que faltar.

## 3. O que entra

### 3.1 Comunicação = histórico (A20)
- A aba **Comunicação** mostra uma **linha do tempo única**, mais recente primeiro, com filtros por tipo: diários enviados (automático, com destinatários e resultado), registros manuais e comunicações imediatas.
- **Novo registro** (engenheiro, admin ou quem tem acesso `obras` — *chamada minha: qualquer usuário com acesso à obra registra; editar/apagar só o autor ou admin, e só até 24 h*): tipos **Reunião (ata)**, **Ligação**, **Visita**, **Outro**; campos data, participantes (texto livre, um por linha), texto.
- **Ata de reunião** tem campos de modelo: pauta, participantes, **decisões** e **pendências** (o quê · responsável · prazo). Botões **Baixar PDF** e **Enviar por e-mail** (escolhe destinatários entre os cadastrados da obra, lado cliente e interno; registra o envio no histórico).
- Cada diário enviado no histórico tem **Abrir PDF** (gera o PDF daquele RDO como foi enviado).

### 3.2 Configurações da obra (A21)
- Item novo **Configurações** na sidebar da obra (só admin vê e edita, como hoje): destinatários, engenheiro, data-base, atividade-trava, **critério de peso do avanço** (§3.4) e **feriados da obra** (§3.6). A aba Comunicação perde esses formulários.

### 3.3 PDF do diário (A17, R13)
- Botão **Gerar PDF** no diário validado/enviado e no histórico. Modelo de RDO formal com a identidade Manfac (logo, cores): cabeçalho (obra, OS, cliente, data, dia N, engenheiro), clima manhã/tarde, equipe, serviços executados (de → para), não avançou (causa), impedimentos abertos, orientações, programação de amanhã e fotos (até 6, em grade). Versão **cliente** (mesmas regras do e-mail: sem R$, sem itens ocultos, Manfac sem área). *Chamada minha: só a versão cliente nesta leva.*
- **Tecnologia (chamada minha):** geração no servidor com `@react-pdf/renderer` (dependência nova, sem Chromium no servidor; serve também à ata e, depois, à apresentação). Fotos baixadas com o cliente admin e embutidas.

### 3.4 % por duração
- Configuração por obra **"Peso do avanço: por valor | por duração"**. Por valor = regra atual (`peso_valor`). Por duração = peso de cada atividade proporcional aos dias úteis. Padrão: **valor** se a soma de `peso_valor` da versão vigente > 0, senão **duração** (*chamada minha*). Afeta painel, curvas, e-mail e etapas.

### 3.5 Comunicação imediata (SGO §2.3)
- Botão **Comunicação imediata** na aba Comunicação (engenheiro/admin): assunto, texto, nível (atenção / urgente), vínculo opcional a impedimento ou atividade. Envia e-mail aos destinatários com tipo **imediato** (lado cliente; versão interna aos internos) e registra no histórico.

### 3.6 Feriados da obra (SGO §9)
- Feriados nacionais continuam globais. Cada obra pode ter **feriados/recessos próprios** (municipais, recesso do shopping) cadastrados em Configurações; o cálculo de dias úteis da obra usa globais + os da obra.

## 4. Fora desta leva
Last Planner/semanal (Leva 3), apresentação e relatórios mensal/fase/entrega (Leva 4), página do cliente (Leva 5), mapa (Leva 6), financeiro da obra (projeto à parte).

## 5. Restrições
Mesmas das levas anteriores (AGENTS.md, `.claude/rules/obras.md` e `sql.md`): SQL em arquivo novo aplicado pelo José; guardas falham fechadas; tema Manfac; nunca R$ ou item oculto para o cliente; sem emoji; `numero` da atividade imutável.

## 6. Dados (SQL novo `sdd-sql-obras-leva2.sql`)
- `obras_registro` (obra_id, tipo `reuniao|ligacao|visita|outro|imediata`, data, participantes text, texto, ata jsonb (pauta, decisoes[], pendencias[{oque,responsavel,prazo}]), nivel, impedimento_id?, atividade_numero?, criado_por (JWT), criado_em, editado_em) + RLS obras; editar/apagar só autor/admin até 24 h (trigger).
- `obras_envio` passa a aceitar `tipo` `ata` e `imediata` e `registro_id`.
- `obras_obra.peso_avanco text check in ('valor','duracao') null` (null = automático).
- `obras_feriado.obra_id uuid null` (null = global) — escrita da obra só admin.

## 6.1 Chamadas minhas após a revisão do builder
1. **Feriados da obra** valem para todos os cálculos da obra, inclusive as datas da base (a base guarda durações em dias úteis, as datas são calculadas). Incluir/remover feriado depois da base salva é permitido ao admin, com aviso "isso muda as datas calculadas, inclusive da base".
2. **% por duração**: peso = duração (dias úteis) planejada de cada atividade na versão em questão (base usa as durações da base). Ao **salvar a base**, se  estiver nulo, grava o critério automático (valor se Σ peso_valor > 0, senão duração) — dali em diante é explícito. Admin pode trocar depois, com aviso de que os números do painel mudam; e-mails já enviados não mudam.
3. **Texto livre** (ata, imediata) é responsabilidade de quem escreve: antes de enviar, confirmação mostrando destinatários e o texto. Ata: o envio escolhe destinatários (padrão = destinatários do lado cliente com tipo diário). Imediata vai a quem tem o tipo **imediato** (já existe no cadastro de destinatários).
4. **Editar/apagar registro**: autor até 24 h após ; admin a qualquer tempo.
5. **Abrir PDF do diário** no histórico: gerado na hora a partir do RDO validado (conteúdo imutável pelo banco) e dos impedimentos/orientações daquela data; rodapé "gerado em dd/mm a partir do diário validado em dd/mm". Sem guardar cópia.
6.  aprovado como dependência nova (fontes Inter/Plex Mono e logo PNG já do projeto).

## 7. Para o builder decidir
Layout da linha do tempo, componentes do PDF, organização de arquivos, testes.
