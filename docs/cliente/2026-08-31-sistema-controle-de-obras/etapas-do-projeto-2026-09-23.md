# Mapa completo de etapas — Sistema de Controle de Obras — 23/09/2026

Hoje: **23/09/2026**. Entrega final ao cliente: **28/09/2026, segunda** (dias úteis: 24 qui, 25 sex e 28 seg; 26–27 é fim de semana).

**Método:** leitura de `ESTADO.md` (885 linhas), `divisao-trabalho-2026-09-20.html`,
`divisao-trabalho-joao-duda.md` + `frentes-joao-duda.html` (14/09), `02-FRENTES-DO-DUDA.md` +
`entregas/`, `cronograma-2026-09-14.html`, `status-testavel-2026-09-15.md`, `docs/DIVIDAS.md`,
`docs/cliente/2026-09-2*.md`, `levantamento-camadas-3-4-2026-09-21.md`, `spec-ajustes-ficha-2026-09-23.md`
e `plano-ajustes-ficha-2026-09-23.md`, e `git log --oneline --since=2026-08-31 -- app/obras
sdd-sql-obras* docs/cliente`. Commit/merge no `master` = feito. "No ar" só quando algum documento
registra build/deploy.

**Regra de honestidade seguida:** horas/tokens de itens FEITOS são a **estimativa que existia no
documento de origem** (nunca o gasto real, que não foi medido) — marcada "estimado". Onde não há
estimativa, "sem registro". Para itens que FALTAM sem estimativa em documento, a coluna diz
"**estimativa nova (23/09)**" com o porquê, na mesma ordem de grandeza dos documentos (~40k–200k
tokens por item de código).

---

## 1. FEITO

| Etapa | Fase | Dono | Data | Horas | Tokens | Evidência |
|---|---|---|---|---|---|---|
| Camada 1 — base de obras entra sozinha pelo Field (completa + incremental a cada 5 min) | código+deploy | João/Claude | 10–16/09 | sem registro | sem registro | commits `50d9182`, `ef6c199`, `018b527`; "77 obras sincronizando a cada 5 min" (`divisao-trabalho-2026-09-20.html`) |
| Camada 2 base — diário, tarefas, triagem, esteira | código | João/Claude+Duda | 05–14/09 | sem registro | sem registro | `spec-v0-treinamento.md`; dezenas de commits `feat(obras)` anteriores a 14/09 |
| J1 — chave da API do Field cadastrada (.env.local + EasyPanel) | infra | João | 14–15/09 | **15 min** (estimado) | **~10k** (estimado) | `divisao-trabalho-joao-duda.md`; `ESTADO.md:402` |
| J2 — deploy da tela `/obras/sincronizar` | deploy | João | 14–17/09 | **10 min + espera** (estimado) | **~20k** (estimado) | `divisao-trabalho-joao-duda.md` |
| J3 — provar as 4 incógnitas da API do Field | código/pesquisa | João/Claude | 14/09 | **1–2 h** (estimado) | **0,2–0,4 M** (estimado) | `j3-verificacao-api-2026-09-14.md`; `divisao-trabalho-joao-duda.md` |
| J4 — Triagem e ficha editáveis ("completar a obra") | spec+plano+código+deploy | João/Claude | 15–21/09 | **5–8 h** (estimado, doc 14/09) | **0,8–1,4 M** (estimado) | commits `5362700`, `3b98e8f`, `d2ae7ea`; deploy 21/09 (`cronograma-2026-09-14.html`: "Deploy da J4 20 min") |
| 7 marcos da esteira gravados por `mudarEtapaAction` (B1 do DIVIDAS) | código | Claude | 21/09 | **2–4 h** (estimado, `cronograma-2026-09-14.html`) | sem registro | commits `ab4cb3b`, `dc6a83f`, `caabefa`; `docs/cliente/2026-09-21-decisoes-marcos-da-esteira.md` |
| Histórico de alterações Parte 1 (componente `_historico.tsx`, RPC `obras_aplicar_alteracao`, ligado na ficha) | spec+código | Claude | 11–21/09 | sem registro | sem registro | `1112b07`, `e197786`, `c35310d`, `0a5f90d` (merge), `84bd2a2` (liga a tela) |
| Regra de atenção/crítica (20/30 dias) | spec+plano+código | Claude | 15/09 | sem registro | sem registro | `plano-regra-critica-2026-09-15.md`; `cce3677` e correções seguintes |
| D1 — coluna `fonte` (marca de onde a obra veio) | código | Duda | 14/09 | **1–2 h** (estimado) | **0,1–0,3 M** (estimado) | `entregas/2026-09-14-D1-mensagem-do-duda.md` |
| D2 — OS sumida do Field vira alerta, nunca exclusão | código | Duda | 14/09 | **5–8 h** (estimado) | **0,8–1,4 M** (estimado) | `entregas/2026-09-14-D2-mensagem-do-duda.md` |
| D2.1 — herança da OS reaberta (N1, N3) | código | Duda | 14/09 | **1–3 h** (estimado) | sem registro (doc não dá tokens desta subfrente) | "D2.1 no ar — build de 14/09 19:36:54 GMT" (`1c610c3`) |
| D3 — sincronização automática (cron incremental 5 min) | código+deploy | Duda | 14–21/09 | **4–7 h** (estimado) | **0,6–1,1 M** (estimado) | `972945b`, merge `06aefd9`; ligada em produção por `50d9182` |
| Revisão de código de 20/09 — 15 achados (3 corrompendo dado) por 4 revisores independentes | review | Claude | 20/09 | sem registro | **medido** (não estimado): 232.784+151.713+165.287+141.138+120.721+103.339 tokens em 6 tarefas da própria sessão | `divisao-trabalho-2026-09-20.html` |
| Correção dos 7 itens do João (dos 15 achados) — histórico ligado, marcos, apagar liberação, validar data, remarcação, "obra não encontrada", selo da esteira | código | João/Claude | 20–21/09 | **7–8 h** (estimado, doc 20/09) | **~570k** (estimado) | `84bd2a2`, `63f8fbc`, `5e4fdfd`, `994ffcc`, `cff8109`, `919c7b2` |
| Correção dos 7 itens do Duda (dos 15 achados) — sumiço, falha de rede, freio de emergência, timeout do Field, tarefa dupla, diário órfão, limite de foto | código | Duda | 21/09 | **6–7 h** (estimado, doc 20/09) | **~530k** (estimado) | merge `2c58c83` (bate exatamente com os arquivos previstos) |
| 2 ajustes pequenos — ordenação numérica de Nº OS, "dia N de M" sem passar de 100% | código | quem terminasse primeiro | 21/09 | **~40 min** (estimado) | sem registro | `3a26287`, `c262161`, `a94bc97`, `4c47635` |
| AGENTS.md reestruturado (445→199 linhas) + regras por módulo + `docs/DIVIDAS.md` criado | doc/infra | Claude | 20/09 | sem registro | sem registro | `512bebd`, `528dcfc`, `492ca4e`, `7ca3fb4` |
| Levantamento de requisitos das camadas 3 e 4 | pesquisa/doc | Claude | 21/09 | sem registro | sem registro | `levantamento-camadas-3-4-2026-09-21.md` |
| Decisão do João sobre camadas 3/4 (camada 4 primeiro; camada 4 = visão do dono da Pacheco; ponte de WhatsApp até o oficial ficar pronto) | decisão | João | 21/09 | — | — | `2026-09-21-decisoes-camadas-3-e-4.md` |
| Mockup + publicação da ponte de cobrança pelo WhatsApp | mockup | Claude | 21/09 | sem registro | sem registro | `f9de349`; **descartado em 22/09** — ver seção 4 |
| Mockup da visão do dono da Pacheco | mockup | Claude | 18/09 | sem registro | sem registro | `891a132`; publicado, **aguardando resposta do cliente desde 18/09** (5 dias) — não é "fechado", ver seção 4 |
| Comunicado de atualizações — mockup aprovado | mockup | Claude | 22/09 | sem registro | sem registro | `cb816b1` |
| Comunicado de atualizações — spec + plano | spec+plano | Claude | 22/09 | sem registro | sem registro | `df0a464` |
| Comunicado de atualizações — código (migration `hub_comunicados` RLS fechada, server actions, faixa "Novidade", script de e-mail Resend em modo simulação) | código | Claude | 22/09 | sem registro | sem registro | `189591e`, `4d32207`, `e892b10`, `5d101b6`, `b23d9f7`, `6f67aa6`, merge `40a6e1d` |
| Comunicado de atualizações — migration aplicada em produção (12/12 + teste RLS 13/13) | deploy (banco) | Claude/João | 22/09 23:49 | sem registro | sem registro | commit `a048cce` |
| Mockup dos ajustes da ficha (nome da etapa + data de fechamento + equipe texto livre) | mockup | Claude | 22/09 construído, 23/09 aprovado "como está" | sem registro | sem registro | `mockup-ajustes-ficha-2026-09-22.html`; aprovação registrada no fim de `brief-mockup-ajustes-ficha-2026-09-22.md`; commit `c3e0bbd` |
| Spec + plano dos ajustes da ficha (11 tarefas, T1–T11, ondas de paralelismo) | spec+plano | Claude | 23/09 | sem registro | sem registro | commit `4d3dc3d`; `spec-ajustes-ficha-2026-09-23.md`, `plano-ajustes-ficha-2026-09-23.md` (690 linhas) |
| Pesquisa de provedor de WhatsApp (360dialog/Twilio vs. Z-API/Evolution) | pesquisa | Claude | 21/09 | sem registro | sem registro | `pesquisa-provedor-whatsapp-2026-09-21.md`; **parada por decisão do cliente em 22/09**, ver seção 4 |

**Soma parcial (só itens com estimativa numérica, ponto médio de cada faixa):** ≈ **42 h estimadas**
e ≈ **4,7 M tokens estimados**. Não é o gasto real — ninguém mediu consumo real neste projeto; é a
soma das estimativas que os próprios documentos registraram antes de cada frente.

---

## 2. EM ANDAMENTO

| Etapa | Dono | Situação hoje (23/09) | Evidência |
|---|---|---|---|
| Ajustes da ficha — código (11 tarefas do plano) | Claude | Spec e plano prontos (`4d3dc3d`). **Código em execução** desde 23/09 por subagente, na branch `feat/ajustes-ficha` (worktree isolado); revisão independente depois. | `plano-ajustes-ficha-2026-09-23.md` |
| Cancelamento de obra — mockup | Claude | Mockup commitado (`0c2f771`) e **publicado em 23/09**: https://claude.ai/artifact/QiMcQupmStD4svv5TDsKvB — aguardando aprovação do João. Exige migration (SQL proposto no brief). | `brief-mockup-cancelamento-obra-2026-09-23.md` |
| Duda — validar o operacional de ponta a ponta | Duda | Mensagem final pronta e commitada (`36bec1e`, `93b7437`), mas **é rascunho revisado pelo João** — não há confirmação de que o Duda já a recebeu ou começou. | `docs/onboarding-duda/2026-09-23-mensagem-whatsapp-duda.md` |
| Comunicado de atualizações — falta ir ao ar | João | Código e migration já em produção (banco). **Falta clicar em Deploy no EasyPanel** + criar conta Resend + apontar DNS (zona na Locaweb) para o e-mail sair de verdade; hoje o script roda em modo simulação. | `a048cce`; `2026-09-22-audio-joao-comunicado-de-atualizacoes.md` |

---

## 3. FALTA ATÉ 28/09

| Etapa | Dono | Horas | Tokens | Depende de | Caminho crítico? |
|---|---|---|---|---|---|
| Código dos ajustes da ficha (T1–T11) | Claude | **~7–9 h** — estimativa nova (23/09): 11 tarefas com TDD (teste antes do código), tocando `_ficha.tsx`, `_actions.ts`, `_etapa.tsx` (novo), `_corrigir-fechamento.tsx` (novo), `_triagem.tsx`, `_bloco-cronograma.tsx`, `_lib/tipos.ts`, `_lib/ficha-campos.ts` — porte comparável a um recorte fino da J4 (que levou 5–8h), mas fragmentado em mais commits | **~600–800k** — estimativa nova, ~11 tarefas × 55–75k tokens (escala de correção do doc de 20/09, 40–200k por item) | Nada bloqueante (spec+plano prontos) | **Sim** |
| Deploy dos ajustes da ficha | João | **~20–30 min** — estimativa nova, mesma ordem do doc 14/09 para deploys pontuais | **~10–20k** | Código acima mergeado | **Sim** |
| Cancelamento de obra — aprovação do mockup, spec, plano | Claude/João | **~2–3 h** no total (João: revisão ~30 min; Claude: spec+plano ~1,5–2,5h) — estimativa nova, mesma ordem do brief/spec dos ajustes da ficha (spec 1–1,5h + plano 1h) | **~150–250k** — estimativa nova | Mockup já desenhado; falta o João aprovar (item ainda não colado no chat) | **Sim** |
| Cancelamento de obra — código + migration (etapa terminal nova, `cancelado_por`, `cancelado_motivo`, `cancelado_em`, `cancelado_quem`; sai de diário/tarefas) | Claude | **~7–11 h** — estimativa nova (23/09), ancorada na estimativa original do Duda para esta frente (6–10h, "a estimar" em `02-FRENTES-DO-DUDA.md`) somada ao fato de que agora **exige migration** (schema novo), que a estimativa antiga do Duda não precificava à parte | **~700k–1,1 M** — estimativa nova, escala J4/D2 (frentes de porte parecido) | Aprovação do mockup + spec/plano acima; **toca os mesmos arquivos dos ajustes da ficha** (`obra/[id]/_actions.ts`, `_lib/tipos.ts`) — não roda em paralelo com o item acima, é sequencial | **Sim, mas com prioridade abaixo dos ajustes da ficha** — nenhum documento de 22–23/09 lista cancelamento na "ordem do cliente" (operacional → dash → agentes); o João assumiu por "o cliente quer agilidade", sem data-alvo explícita |
| Cancelamento de obra — deploy (migration + código) | João | **~30–45 min** — estimativa nova | **~15k** | Código acima | Sim, se a data-alvo for 28/09 |
| Duda — validar o operacional de ponta a ponta (sincronização, diário, tarefas) | Duda | **~4–8 h** (1–2 dias a 4h/dia, ritmo dele nos docs de 14/09) — estimativa nova, mesma régua do ritmo declarado | sem registro — o Duda não reporta consumo de token nos documentos | Nada (arquivos diferentes dos dois itens acima — roda em paralelo) | **Sim — é o item 1 da ordem do cliente** ("operacional validado pelo time > faz o dash > faz o agente", `2026-09-22-feedback-esteira-e-equipes.md`) |
| Deploy do comunicado de atualizações no EasyPanel | João | **~20 min** — estimativa nova | **~10k** | Credencial do EasyPanel (histórico: já travou o deploy em 17, 19/09) | Não (comunicação interna, não é funcionalidade core de obras) |
| Conta Resend + apontar DNS (Locaweb) para o e-mail do comunicado sair de verdade | João | sem estimativa em documento — **~30 min–1 h**, estimativa nova (infra simples, mas fora do código) | não se aplica (trabalho de infra, não de agente) | Nada | Não |
| Responder a pergunta 03 ao cliente ("como calcula o avanço %?") | João | **5 min + espera** (texto já pronto desde 31/08) | não se aplica | Nada | Não, mas está aberta há 23 dias |

**Soma "falta até 28/09" (pontos médios, só itens com estimativa):** ≈ **21–30 h** de trabalho
técnico (Claude+João+Duda somados) e ≈ **1,5–2,2 M tokens**.

---

## 4. FALTA DEPOIS DE 28/09

| Etapa | Situação | Evidência |
|---|---|---|
| Dashboard de saúde da operação | Pedido novo do cliente em 22/09, **substitui os agentes na ordem imediata**, mas ainda **sem mockup** — regra do projeto exige mockup antes de spec/código. Não há como caber em 5 dias além do resto da lista. | `2026-09-22-feedback-esteira-e-equipes.md` |
| Agentes de IA / cobrança automática por WhatsApp (camada 3) | **Parado** por decisão do cliente em 22/09: "não faz sentido alguém ter que clicar" — quer agente de verdade, não a ponte por botão desenhada em 21/09 (que foi descartada). Volta só quando o sistema estiver "100% testado". Verificação Meta/360dialog também parada. | `2026-09-22-feedback-cobranca-whatsapp.md`; `2026-09-22-feedback-esteira-e-equipes.md` |
| Camada 4 / visão do dono da Pacheco | Mockup publicado 18/09, **decisão de 21/09 já classificou isso como "camada 4"**, mas segue **sem resposta do cliente desde 18/09** (5 dias). **Atenção:** isso é diferente do "dashboard de saúde da operação" pedido em 22/09 — são dois painéis distintos (um externo, para o cliente-do-cliente; outro interno, para a própria equipe), nenhum documento confunde os dois, mas também nenhum documento os relaciona explicitamente. | `2026-09-21-decisoes-camadas-3-e-4.md`; `2026-08-31-.../divisao-trabalho-2026-09-20.html:490` |
| "Trocar o status ainda na esteira para pendente faturamento" | Adiado pelo João em 22/09: "vamos resolver os outros pontos, essa não é a mais relevante" | `2026-09-22-feedback-esteira-e-equipes.md` |
| D4 — smoke test contra o banco real (10 passos) | **Sem evidência de execução encontrada.** Estava previsto no cronograma de 14/09 para 16/09 (2,5h) e detalhado em `02-FRENTES-DO-DUDA.md`, mas **não aparece na tabela "Resumo" final do mesmo documento** nem em `entregas/` (só há entregas D1, D2, D2.1, D3). Possível que tenha sido superado pela carga real em produção (64→77 obras, sincronização rodando ao vivo), mas isso não está escrito em lugar nenhum — é lacuna, não decisão registrada. |  `02-FRENTES-DO-DUDA.md:89,105,586,733` vs. seu próprio "Resumo" (não cita D4) |
| Dívidas registradas, não corrigidas (não travam entrega) | B4 (mensagem genérica em corrida dentro de corrida), B5 (`salvarAutorizacaoAction` não carimba marcos), B6 (histórico sem `seq` na ordenação), B7 (data de início sem validação de calendário), B8 (semântica de "dia N de M" com um dia de folga a mais) | `docs/DIVIDAS.md`, seção (B) |
| Cadastro de telefone de equipes/prestadores | Sem prazo, "trabalho de operação do João"; agora ainda menos urgente porque a camada 3 está parada | `ESTADO.md`; `divisao-trabalho-2026-09-20.html` |

---

## 5. Totais por tabela

| Tabela | Horas (pontos médios, só itens com estimativa) | Tokens (idem) |
|---|---|---|
| FEITO | ≈ 42 h estimadas | ≈ 4,7 M estimados (+ 915k medidos de revisão, à parte) |
| FALTA ATÉ 28/09 | ≈ 21–30 h | ≈ 1,5–2,2 M |
| FALTA DEPOIS DE 28/09 | sem estimativa — depende de mockups que não existem ainda | — |

## Totais por dono (só "falta até 28/09")

- **Claude:** ≈ 10–14 h de código/spec/plano (ajustes da ficha + cancelamento), ≈ 1,3–1,8 M tokens.
- **Duda:** ≈ 4–8 h (validação operacional), tokens sem registro.
- **João:** ≈ 2–3 h somando aprovações, deploys, Resend/DNS e a pergunta 03 — não é trabalho de
  código, é aprovação/infra/decisão, e histórico mostra que é justamente aqui que o projeto já
  perdeu dois dias inteiros (17/09 e 19/09 "passaram sem commit e sem deploy" por bloqueio de
  credencial, `ESTADO.md:6`).
- **Cliente:** nenhuma ação de código pendente; deve ainda responder ao mockup da visão do dono da
  Pacheco (parado há 5 dias) — isso não bloqueia o prazo de 28/09, por decisão já registrada.

## Cabe em 5 dias (24–28/09)?

**Aperta, mas cabe — com duas condições que já falharam antes neste mesmo projeto.** O trabalho
técnico somado (ajustes da ficha + cancelamento + validação do Duda) fica em torno de 21–30 horas,
e Claude "não tem limite de horas" (`cronograma-2026-09-14.html`) — quem limita o ritmo é a
aprovação do João a cada etapa (mockup, spec, deploy) e o deploy no EasyPanel, que depende de
clique manual sem webhook de auto-deploy. As duas condições:

1. **O mockup do cancelamento precisa ser aprovado nos próximos 1–2 dias.** Publicado em 23/09,
   aguardando o João. Sem isso, cancelamento não cabe.
2. **Nenhum novo bloqueio de credencial no EasyPanel.** Isso já comeu 17/09 e 19/09 do cronograma
   anterior (dois dias inteiros perdidos, `ESTADO.md:6,26`), e o mecanismo de deploy não mudou —
   ainda é clique manual, sem CI.

Ajustes da ficha e cancelamento **tocam os mesmos arquivos** (`obra/[id]/_actions.ts`,
`_lib/tipos.ts`) e por isso são sequenciais, não paralelos — essa é a maior pressão de calendário,
não o volume de horas em si. A validação do Duda roda em paralelo (arquivos diferentes) e não
aperta o caminho crítico.

---

## Contradições e itens sem fonte encontrados

1. O estado passado no pedido dizia "comunicado: código pushado (3832971)" — **3832971 não é o
   commit do comunicado** (é `docs(dividas): B9`, sem relação). O merge real do comunicado é
   `40a6e1d`, e a migration aplicada em produção é `a048cce` (22/09, 23:49) — ambos já confirmados
   como no `origin/master`, então "código pushado" está correto, só a referência de commit está
   errada.
2. "Spec+plano dos ajustes da ficha sendo escritos" (estado passado no pedido) já estava **desatualizado
   no momento da pesquisa**: spec e plano foram commitados em `4d3dc3d`, hoje, antes desta apuração
   terminar. Só o código segue pendente.
3. `git status` mostra o `master` local **6 commits à frente do `origin/master`** (todos de
   documentação: `c3e0bbd` até `4d3dc3d`) — nada de código de produção está represado, mas contraria
   a leitura de "push é automático e contínuo" se alguém checar só o placar de commits.
4. **D4 (smoke test do Duda)** é detalhado em `02-FRENTES-DO-DUDA.md` (com roteiro de 10 passos),
   mas **some da tabela "Resumo" do mesmo arquivo** e não tem entrega em `docs/onboarding-duda/entregas/`.
   Sem fonte que diga se foi feito, descartado ou esquecido.
5. **A relação entre "camada 4" e o "dashboard de saúde da operação"** (pedido novo de 22/09) não
   está escrita em nenhum documento — são tratados aqui como duas coisas diferentes por inferência
   (públicos diferentes: cliente-do-cliente vs. equipe interna), não por confirmação.

---

## 6. Até o sistema 100% pronto — estimativa nova (23/09), pedida pelo João

"100% pronto" = as quatro camadas do cliente (31/08) + dashboard de saúde (22/09) + agentes. Todas as
horas abaixo são **estimativa nova do coordenador**, sem documento de origem; régua: frentes
parecidas já feitas (J4 5–8h de código; comunicado inteiro em ~1 dia).

| Item | Horas | Espera de calendário | Por quê da estimativa |
|---|---|---|---|
| Tudo da seção 3 (até 28/09) | 21–30 h | código do EasyPanel | seção 3 |
| Dashboard de saúde da operação (mockup → deploy) | 13–19 h | aprovação do mockup | lê dados que já existem; mockup 2–3h, spec+plano 2h, código 8–12h, review+deploy 1–2h |
| Visão do dono da Pacheco (camada 4) | 20–30 h | resposta do cliente ao mockup de 18/09 | primeira tela para gente de fora: acesso externo + RLS (território de autenticação), página, e-mail de início/fim de obra (reusa o Resend) |
| ↳ manutenção real vinda do Cockpit | +8–16 h | — | Cockpit é outro app, não integrado; sem isso a seção fica com dado de exemplo |
| Agente de cobrança das tarefas (WhatsApp) | 20–30 h | verificação Meta via BSP: 2–3 semanas | pesquisa de 21/09; exige telefones cadastrados |
| Agente de cobrança de fotos das equipes | 24–40 h | idem | conversa com a equipe/grupo e foto que volta para o diário; o próprio cliente disse que "precisa estudar mais" |
| Telefones de equipes/prestadores (operação) | 2–4 h João | — | pré-requisito dos dois agentes |
| "Pendente faturamento" dentro da esteira (adiado 22/09) | 2–4 h | decisão do João | mexe na esteira e no filtro da Base |
| Dívidas que tocam dado de cliente (A1, A13, B5, B7) | 8–12 h | — | edição simultânea, escrita não atômica da etapa, marcos no auto-avanço, validação de data no servidor |
| Dois contadores de SLA (A6) — **confirmar se já entraram** | 0–5 h | — | cortados em 18/09; ESTADO previa para 22–23/09, sem evidência de entrega |

**Total para 100%:** ≈ 120–190 h de trabalho. Com as esperas (Meta 2–3 semanas, respostas do
cliente), o realista é **4 a 6 semanas depois de 28/09**. O gargalo não é hora de código: é
aprovação de mockup, resposta do cliente, deploy manual e a verificação da Meta.
