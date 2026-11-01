---
paths:
  - "app/obras/**"
  - "app/api/obras/**"
  - "app/portal-obra/**"
  - "lib/portal-obra/**"
---

# Módulo Controle de Obras

Maior módulo do hub: 81 arquivos `.ts`/`.tsx`. Mapa completo em
`docs/onboarding-duda/inventario-hub-2026-09-20.md` (seção 2) — leia lá antes de
perguntar "onde fica X". Este arquivo só registra o que não está óbvio.

## Onde fica o quê

- **`_lib/tipos.ts`** (845 linhas) — tipos e regras centrais (`Etapa`, `Obra`,
  `derivar`, `faseDe`, `critico`, `estourou`, severidade). Arquivo mais importado
  do módulo; mexer aqui tem raio de alcance grande.
- **`_lib/importacao.ts`** (690 linhas) — parsing da planilha legada (dois formatos).
  Não é mais a fonte dos dados, mas o código continua vivo.
- **`_lib/ficha-campos.ts`** (368 linhas) — validação dos blocos editáveis da ficha.
- **`_lib/field/`** — cliente HTTP do Field Control. **Fronteira pública é só
  `index.ts`** (o próprio arquivo diz "IMPORTE DAQUI, não dos arquivos internos").
- **`obra/[id]/`** — a Ficha: `_ficha.tsx` (870 linhas, monta a tela), `_actions.ts`
  (741 linhas, Server Actions de salvar/liberar/mudar etapa), `_triagem.tsx`
  (647 linhas, modo de definição inicial, não é aba separada).
- **`sincronizar/`** — tela e lógica da sincronização com o Field: `_execucao.ts`
  (337 linhas, executa a varredura), `_sincronizacao.ts` (428 linhas, planeja o
  diff), `_criterio-de-entrada.ts` (o filtro do cliente).
- **`base/`, `diario/`, `tarefas/`** — as três abas do layout (`layout.tsx` client-side,
  marca aba ativa por `usePathname`).
- **`importar/`** — importação manual de planilha; legado, mantido mas não é a fonte.
- Testes ficam ao lado do código (`__tests__/` em cada subpasta), **mais** um
  `app/obras/__tests__/` de nível de módulo para `_lib/` e componentes de topo
  (`tipos.test.ts` 811 linhas, `importacao.test.ts` 792, `ficha-editavel.test.ts` 758).

## Como o dado entra

A obra nasce no Field Control — **não existe cadastro manual em produção**
(`importar/` é legado). O caminho:

1. `app/api/obras/sincronizar/route.ts` — rota chamada pelo `pg_cron`, autenticada
   por `OBRAS_CRON_SECRET` (header `Bearer`, comparação em tempo constante). Chama
   `prepararExecucao`/`executarExecucaoPreparada` de `sincronizar/_execucao.ts`.
2. `sincronizar/_actions.ts` (`sincronizarComFieldAction`) é o mesmo caminho para o
   clique manual em "Puxar do Field" — mesma execução, origem diferente.
3. `sincronizar/_execucao.ts:185` lê `process.env.FIELD_API_KEY` **diretamente**
   (única leitura de `process.env` no módulo) e desce a chave por parâmetro
   (`criarClienteField({ chaveApi })`). **A partir daí `_lib/field/` não lê
   `process.env` de propósito** — mudar isso quebra o objetivo de a camada Field
   ser testável sem mock de ambiente.
4. `sincronizar/_criterio-de-entrada.ts` decide o que entra: última atividade em
   pendente, agendada ou em andamento (critério do cliente, `feedback-20`).
5. Cron, dois jobs (estado em 20/09/2026, ver armadilha abaixo):
   `obras-field-incremental` em `*/5 * * * *`; `obras-field-completa` em
   `2 6 * * *` — só ela detecta OS arquivada/sumida no Field, e roda ~3 min.

## Armadilhas — só as que já morderam

1. **`export type` num arquivo `use server` derruba a tela inteira**
   (`ReferenceError: <Tipo> is not defined`). `tsc` e os testes não pegam isso —
   em teste os tipos somem direito, só aparece em runtime real. Corrigido em
   `e26d7ce`; regressão coberta em `4071df1`, que varre os arquivos `use server`
   do hub. Se adicionar `export type` a `_actions.ts` de novo, confira manualmente.
   (`docs/cliente/2026-08-31-sistema-controle-de-obras/ESTADO.md:205`)

2. **Os dois jobs de cron podem colidir e um morre em silêncio.** Até 20/09 ambos
   disparavam às 06:05 UTC; quem perdia a trava `obras_sync_execucao_uma_rodando`
   recebia 409 `ja_estava_rodando` e **não gravava linha nenhuma** — nem em
   `obras_sync_execucao`, nem erro visível. `cron.job_run_details` mostrava
   `succeeded` mesmo assim, porque para o `pg_cron` a chamada HTTP foi feita. Isso
   deixou a varredura completa sem rodar de 17/09 a 19/09 (4 dias cego para OS
   arquivada). Corrigido movendo `obras-field-completa` para `2 6 * * *` — ao tocar
   em qualquer um dos dois cron schedules, mantenha uma folga de minutos entre eles.
   (`ESTADO.md`, seção 20/09, "A colisão do cron das 06:05 foi corrigida hoje")

3. **A coluna `origem` da execução não prova que o agendamento rodou.**
   `app/api/obras/sincronizar/route.ts:52` grava `origem: 'agendada'` para
   **qualquer** chamada que passe pelo segredo — inclusive testes manuais feitos
   por humano com `curl`. Para confirmar que o cron de fato disparou, use
   `tipo: 'incremental'` combinado com `cron.job_run_details`, nunca a coluna
   `origem` sozinha. (`ESTADO.md`, seção 16/09, "Armadilha ao verificar isto no futuro")

## Estado em 23/09/2026

No ar: build de **23/09 19:38 UTC** (master `2b7d2fa`) — ficha editável (no ar desde
20/09), marcos da esteira gravados, histórico de alterações ligado, e os ajustes de
23/09: etapa `aprovarOS` exibida como "Executado - pendente aprovação OS", data de
fechamento da OS informável/corrigível, equipe/prestador em texto livre. Faixa
"Novidade" (`hub_comunicados`) no ar, comunicado 01 publicado; e-mail pendente do
Resend. Os 4 e-mails com slug `obras` têm conta e já entraram. Deploy segue manual,
com o código de acesso ao EasyPanel com o cliente. Próximo: cancelamento de obra
(mockup aprovado 23/09; exige migration `sdd-sql-obras-cancelamento.sql`).

**No ar desde o deploy de 24/09 14:03 UTC (master `3f08943`):** cancelamento de
obra (merge `fed48eb`; migration `obras-cancelamento` já aplicada em 23/09) e as dívidas da ficha
(merge `29b526e`): troca de etapa atômica (etapa + marcos numa chamada só da RPC, com linha
"Esteira · Etapa" no Histórico), auto-avanço da Autorização carimba os marcos, liberação da
Triagem valida datas no servidor, e os três blocos detectam edição concorrente pela versão do
bloco (`versaoDoBloco`). Dívidas A1, A13, A16, B5, B7 fechadas; bordas novas em A31–A36.

## Relatório diário por e-mail (no ar desde 09/10/2026)

`app/api/obras/relatorio-diario/route.ts` — chamada pelo pg_cron `obras-relatorio-diario` às 08:01 BRT
com `OBRAS_CRON_SECRET`. Lê o painel (`app/obras/painel/_leitura.ts` + `montarPainel`) com service role,
gera PNG 2x com `next/og` (`_imagem.tsx`, **sem `overflow: hidden`** — o render passa de 5 min) e envia
pela Locaweb (`SMTP_*`, mesmas do Compras; `email-ssl.com.br:465`) um e-mail por destinatário: slug
`obras` com `has_access = true` + administradores. Falha de leitura/imagem → ninguém recebe; falha de
envio → 1 nova tentativa após 60 s. Registro = `net._http_response` (some em ~6 h). Corpo
`{"previa":true}` devolve o PNG; `{"somentePara":"<e-mail da lista>"}` manda a uma pessoa só.
Docs: `docs/relatorio-email/`.

## OBRAS (modalidade obra) — desde 29/10/2026

`obras_obra.modalidade` ('spot' default | 'obra'). Cronograma, diário (RDO), impedimentos e e-mail ao cliente.

- **Código:** `app/obras/obras/` (lista, cronograma, diário, impedimentos, comunicação).
  `_lib/`: `calendario.ts` (dias úteis/feriados), `cronograma.ts` (plano, de/para, atraso), `leitura.ts`
  (leitura única das tabelas), `email-diario.ts` (monta o e-mail, lado cliente × interno), `enviar.ts`
  (envio por destinatário), `ultimo-diario.ts` (último envio ao cliente com destinatário).
- **Tabelas:** `obras_cronograma_versao`, `obras_atividade`, `obras_atividade_exec`, `obras_rdo` (+`_avanco`,
  `_foto`), `obras_impedimento`, `obras_destinatario`, `obras_envio`, `obras_feriado`. Colunas novas em
  `obras_obra`: `modalidade`, `data_base`, `engenheiro_email`, `atividade_trava`.
- **Regras que mordem (todas no banco, não só no app):**
  - Versão salva do cronograma é imutável; mudança = revisão v2, v3… (o rascunho é reaproveitado).
  - Diário: `rascunho → validado → enviado`, máquina de estados forçada por trigger.
  - Só engenheiro da obra ou admin grava cronograma/execução/`obras_envio`; sem JWT (service role, cron) passa.
  - Os 4 parâmetros da obra (`modalidade`, `data_base`, `engenheiro_email`, `atividade_trava`) só admin.
  - Caminho de foto é canônico (`<obra>/rdo/<data>/<uuid>.jpg`, `<obra>/impedimento/<uuid>.jpg`) e a foto
    congela após a validação (storage write-once em `/rdo/`).
  - E-mail do cliente nunca mostra R$, peso nem item oculto; impedimento oculto vira "outros fatores".
  - Base SPOT, diário/tarefas, painel gerencial e e-mail das 08:01 filtram `modalidade='spot'`.
- **SQL:** `sdd-sql-obras-modalidade-obra.sql` aplicado em 29/10/2026; `sdd-sql-obras-modalidade-obra-2.sql`
  (RPC com `modalidade`, guardas de engenheiro/admin, storage e caminhos canônicos) **aplicado em 29/10/2026**;
  Ver `.claude/rules/sql.md`.
- **Fora de escopo (ver `docs/DIVIDAS.md`):** clima, ronda/mapa (Fase 4), semanal/PPC/curva S/Gantt (Fase 2),
  página do cliente (Fase 3).

### Leva 1 do cronograma (branch `feat/obras-leva1`, 30/10/2026)

Spec: `docs/superpowers/specs/2026-10-30-obras-leva1-cronograma-design.md`.

- **Onde fica:** shell da obra (sidebar azul, menu inferior no celular) em `obras/_ui/shell.tsx`;
  painel em `obras/_ui/painel.tsx` (+ `kpi`, `curva-s`, `barras-periodo`, `evolucao-etapas`, `avanco-fisico`);
  cronograma em `obras/[id]/cronograma/` (`_tela` monta barra + `_arvore` + `_gantt`; `_atualizar-status` é a
  gaveta; `_dados.ts` monta o que a tela recebe); motor em `obras/_lib/cronograma.ts`, curvas em `_lib/curvas.ts`;
  leitura única em `_lib/leitura.ts` (`lerObraGrande` com banco, `montarObraGrande` puro).
- **Tema claro só dentro de `/obras/obras/**`:** `obras/layout.tsx` põe `.obra-tema` (tokens `--obra-*` em
  `obras/obras.css`) e o IBM Plex Mono (`.obra-num` para números/datas/%). Texto laranja usa `--obra-orange-texto`
  (#b94606), nunca `--obra-orange` (contraste). O cabeçalho escuro de /obras some dentro da obra
  (`_ui/fora-do-shell-obra.tsx`). Tudo em % físico, nunca R$.
- **Histórico de status:** `obras_atividade_status_hist` (só inserção) recebe uma linha por atividade na gaveta
  "Atualizar status" e na validação do diário. É a fonte da curva "Realizado" e do "Dados até". O histórico é gravado
  antes do exec (falha no histórico não muda o exec), ainda fora de transação (DIVIDAS).
- **Dias restantes** (`obras_atividade_exec.dias_restantes`): opcional; quando informado, **manda** na projeção
  do fim (pode antecipar), contado da `data_status` em que foi informado (a leitura acha no histórico), não de hoje. Volta a null quando o diário avança/conclui a atividade ou a gaveta a conclui. O % nunca
  regride (tela e servidor) e data de status futura é recusada.
- **Prévia visual sem banco:** `npm run dev` → `/previa-obras`, `/previa-obras/cronograma`
  (`?status=1` abre a gaveta), `/previa-obras/diario`. Fixture de Macaé 3; 404 em produção; fica fora de /obras
  porque o middleware exige sessão lá.
- **SQL:** `sdd-sql-obras-leva1.sql` aplicado em 30/10/2026 (ver `.claude/rules/sql.md`).

### Portal do cliente (Leva 5, branch `feat/obras-leva5`, 31/10/2026)

Spec: `docs/superpowers/specs/2026-10-31-obras-leva5-pagina-do-cliente-design.md`.

- **Onde fica:** páginas em `app/portal-obra/` (`(entrada)` = e-mail + código; `(obra)` = obras da sessão,
  guardas em `(obra)/_lib/guarda.ts`; `sair/` = logout por POST com conferência de Origin). Auth em
  `lib/portal-obra/` (`codigo.ts` pedido/conferência do código, `sessao.ts`, `segredo.ts`, `acesso.ts`,
  `limites.ts`). Lado do hub: configurações/comunicação/documentos em `app/obras/obras/`; analista e
  "Situação para o cliente" em `app/obras/obras/_lib/analista.ts` + `[id]/_analista-actions.ts`.
- **Não usa o Supabase Auth.** OTP próprio; o portal nunca importa `lib/supabase/server` nem `getUser`.
  Tudo com o cliente admin (service role), e todo carregador recebe o cliente por parâmetro.
- **Regras do código (OTP):** 6 dígitos, 10 min, uso único, 5 tentativas por código, 5 códigos/h por e-mail e
  20/h por IP. Só o HMAC fica no banco. Emissão atômica no rpc `obras_portal_emitir_codigo` (travas por
  e-mail e IP, aposenta os vivos, `criado_em = clock_timestamp()` e validade calculada **no banco**). A
  conferência pega o código **vivo** (`usado_em is null`, não vencido) e conta tentativa/uso por
  compare-and-swap. A resposta do pedido é sempre a mesma e o trabalho roda em `after()` (sem enumeração).
  Sessão: cookie `httpOnly`/`secure`/`lax`, path `/portal-obra`, 7 dias renováveis com teto de 30; o acesso
  (`obras_portal_acesso.ativo`) é relido a cada request, então desativar derruba a sessão.
- **Modalidade:** página, PDF, documento e mensagem do cliente recusam obra que não é `modalidade = 'obra'`.
- **Env:** `PORTAL_OBRA_SEGREDO` (≥ 32 caracteres; só no EasyPanel). Sem ele, ou curto, o portal falha fechado.
- **IA (desde 01/11/2026 na OpenAI, não mais Anthropic):** uma chamada só, `pedirAoModelo` em `_lib/ia-semanal.ts`
  (Responses API, SDK `openai`), usada pelo semanal/relatórios e pela Situação (`_lib/ia-situacao.ts`, JSON com
  esquema estrito). Env `OPENAI_API_KEY` (sem ela o botão some e a Situação sai em rascunho simples) e
  `OPENAI_MODEL` opcional (padrão `gpt-5.4-mini`, escolha do José).
- **IP do limite:** o **último** salto do `x-forwarded-for` (o que o Traefik do EasyPanel acrescenta). Pressupõe
  o Traefik em publish mode **host**; em ingress todos chegam com o mesmo IP e o limite de 20/h vira global.
- **SQL:** `sdd-sql-obras-leva5.sql` aplicado em 31/10/2026 (ver `.claude/rules/sql.md`). Ordem obrigatória no deploy: SQL antes do app
  (sem `obras_situacao_cliente`, a Visão geral do portal, o semanal e o relatório de período dão 500). Teste de
  comportamento: `docs/obras/2026-10-31-verificacao-obras-leva5.sql` (116 casos, rollback).

### Financeiro da obra — Fases B/C (branch `feat/obras-financeiro-bc`, 01/11/2026)

Spec: `docs/superpowers/specs/2026-11-01-obras-financeiro-fases-b-c-design.md`; plano `docs/superpowers/plans/2026-11-01-obras-financeiro-fases-b-c.md`.

- **Onde fica:** aba Dados da obra em `obras/[id]/dados/` (valor receita por OS, organograma do cliente); sub-telas
  `obras/[id]/financeiro/medicoes/` e `.../locacoes/`; o Resumo é `financeiro/page.tsx` → `_tela.tsx` + `_resumo.tsx`.
  Regras puras: `_lib/financeiro-obra.ts` (`consolidarFinanceiro` da Fase A + `consolidarMargem`/`custoDoVinculo`),
  montagem da tela em `_lib/financeiro-tela.ts`, % ⇄ valor em `_lib/medicao.ts`, aviso de locação em `_lib/locacao.ts`,
  alertas > 10 dias (medição ao cliente e de fornecedor) em `_lib/alertas.ts` (faixa do painel da obra).
- **Regras que mordem:** custo projetado = comprometido ÷ avanço físico da obra aberta (`calc.realizado`, 0–1; sem
  avanço → "—"); receita esperada exclui OS cancelada; sem valor receita a tela pede o valor em Dados da obra.
  Sem dupla contagem: vínculo com `de_medicao_fornecedor` fica fora (já está em Fornecedores); pedido de locação do
  Compras sai de "Compras" e entra em "Locações". Pagamento do Financeiro ao mesmo fornecedor (CPF/CNPJ, `fornecedor_documento`) de um
  pedido do Compras da família quita o pedido (realizado/pago na origem do pedido, até o valor dele) só enquanto o pedido não está pago no
  Compras — pedido com `pago_em` só absorve o pagamento do mesmo dia BRT (é o mesmo pagamento); só o
  excedente fica em "Pagamentos / rateio" (DIVIDAS M1). Margem projetada total e percentuais só sobre as OS
  com valor receita; liberado de OS cancelada fora; "liberado e não faturado" somado por OS. Tudo com o cliente da SESSÃO; valores só com
  `obras_pode_ver_valores` (a aba some para os demais). O painel só lê medições para os alertas quando
  `podeVerValoresDaRequisicao` (`[id]/_pode-ver-valores.ts`, `cache` do React compartilhado com o layout) é true —
  quem não vê valores não faz leitura extra (`[id]/_alertas-financeiros.ts`).
- **SQL e ordem de deploy:** Fase A (`sdd-sql-obras-financeiro-a.sql`) → Financeiro `044` → Compras `016` →
  Fornecedores `013` → `sdd-sql-obras-financeiro-bc.sql`; depois os apps. Teste de comportamento:
  `docs/obras/2026-11-01-verificacao-obras-financeiro-bc.sql` (rollback).
- **Merge na master só DEPOIS do SQL B/C aplicado em produção** com a verificação pós-commit **24/24 OK** e o
  teste de comportamento **114/114 OK**. Não há deploy por feature: qualquer deploy de outra coisa leva esta junto,
  e sem o SQL a aba Financeiro fica sem margem e Medições/Locações só avisam. (Dados da obra aguenta: sem
  `obras_cliente_pessoa`, o organograma mostra o aviso e "sem cadastro" continua com os botões de acesso e envio.)
### Mapa da obra e fotos por ponto (Leva 6, branch `feat/obras-leva6`, 01/11/2026)

Spec: `docs/superpowers/specs/2026-11-01-obras-leva6-mapa-fotos-design.md`.

- **Onde fica:** regras puras em `obras/_lib/mapa.ts`, leitura em `_lib/mapa-leitura.ts`; telas em `obras/[id]/mapa/`
  (`_tela` + `_desenho` SVG relativo 0–1; `montar/_editor` com arrasto por ponteiro; `ponto/[pontoId]/_comparar`
  antes × depois); permissão `mapa/_permissao.ts` (engenheiro com acesso `obras` ou admin, igual ao banco).
- **Diário:** com pelo menos um ambiente, o passo Fotos ganha "Por ponto (ronda)", "Por atividade" e "+ Foto avulsa",
  e `registrarFotoAction` exige ambiente ou ponto (regra só do app). Obra sem ambiente: diário de sempre.
- **Planta:** o servidor só recebe imagem (`<obra>/mapa/<uuid>.<jpg|png|webp>`), URL assinada de 600 s gerada no servidor.
  PDF é aceito na tela de montar: a 1ª página vira imagem no navegador (`montar/_pdf-para-imagem.ts`, `pdfjs-dist` por `import()`
  dinâmico; worker em `montar/_pdf-worker.ts`, separado porque `import.meta` não roda no Jest).
- **Portal (aba Mapa):** `portal-obra/(obra)/_lib/mapa.ts` (`lerMapaDoPortal`, `obraTemMapa`); aba só com ≥ 1 ambiente,
  página 404 sem mapa. Fotos só de RDO validado/enviado (filtro no banco e no código), impedimento só aberto e
  `exibir_ao_cliente`, atividade pelo código e pela situação do cronograma do portal, ponto só pelo número.
- **SQL:** `sdd-sql-obras-leva6.sql` **precisa estar aplicado antes do deploy** (20/20 + teste 94/94). Se o app subir
  antes, diário, foto e impedimento seguem como antes da Leva 6 (mapa ilegível = obra sem mapa; colunas novas só vão no
  insert quando preenchidas); só as telas do mapa dão erro.
- **Fotos do mapa:** `lerFotosDoMapa` sempre ordena pela data do RDO e limita (padrão 500); diário usa
  `lerReferenciasDosPontos` (1 foto por ponto). Nunca ler as fotos da obra inteira.

### Planta de faseamento (Leva 6b, branch `feat/obras-leva6b-faseamento`, 01/11/2026)

Spec: `docs/superpowers/specs/2026-11-01-obras-leva6b-faseamento-design.md`.

- **Onde fica:** `obras/[id]/faseamento/`. Regras puras, schemas (escritos à mão, API `safeParse`/`parse`) e a prancha
  react-pdf em `_lib/` (`camadas.ts`, `trava.ts`, `prancha-pdf.tsx`); tela em `page.tsx` → `_tela.tsx` (fases, abas
  "Editar camadas"/"Prancha A3", botões), editor SVG em `_editor.tsx` (arrasto por ponteiro, como o do mapa), desenho em
  `_desenho.tsx`, prévia HTML/SVG da folha em `_previa.tsx`; carga e render do PDF em `_pdf.ts` (rota
  `[revisaoId]/pdf` e envio); permissão em `_permissao.ts`. Coordenador em Dados da obra (`dados/_coordenador.tsx`).
- **Quem edita/emite/envia:** admin, ou com acesso `obras` o engenheiro da obra ou o coordenador
  (`obras_obra.coordenador_email`, só admin grava, direto na tabela). Igual a `obras_pode_fasear` (lower/trim; NULL/vazio
  nunca passa). Os demais veem em leitura; o banco recusa mesmo assim.
- **Regras que mordem:** coordenadas 0–1; ids únicos por camada (o schema recusa repetido); um rascunho por fase;
  emitida é imutável (trigger) e congela base, fase e trava — PDF e portal da emitida usam `planta_*`/`fase_*` da própria
  revisão, nunca o mapa vivo; rascunho usa a planta atual e sai com RASCUNHO. Obra sem planta = quadro branco + aviso.
  Editor só em tela ≥ 768 px. **Prévia nunca em `<iframe>`:** o hub manda `X-Frame-Options: DENY`.
- **Envio:** `obras_envio` tipo `faseamento` com `fase_revisao_id` (só emitida), um por lado, aos destinatários do
  relatório de fase (tipos `semanal`/`mensal`); aparece na linha do tempo da Comunicação com "Abrir PDF".
- **SQL:** `sdd-sql-obras-leva6b.sql` **precisa estar aplicado antes do deploy** (verificação 23/23 + teste 86/86). Sem
  ele a aba Faseamento mostra "ainda não está disponível", a Comunicação relê os envios sem `fase_revisao_id` (42703) e o
  portal ignora o faseamento (PGRST205/42P01/42703 = lista vazia).
- **Portal (aba Mapa):** seção "Faseamento" (`portal-obra/(obra)/obras/[obraId]/mapa/_faseamento.tsx`, leitura em `_lib/faseamento.ts`) com só a **última emitida de cada fase** (base e nome congelados da revisão); sem emitida a seção some, e a aba Mapa aparece também só com faseamento (`obraTemMapa` = ambiente OU emitida). PDF em `faseamento/[revisaoId]/pdf` (sessão do portal, cliente admin, modalidade obra): 404 igual para rascunho, outra obra, id inválido **e revisão antiga já substituída** (só a última emitida abre).
