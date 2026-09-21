# Inventário do hub — 2026-09-20

Levantamento factual do app Next.js do hub (`hub.manfac.com.br`). Todo número
vem de comando rodado neste repositório em 20/09/2026 (`find`, `wc -l`,
`grep`). Escopo: só o app do hub — **excluídos** `manfac-site/`,
`sistema-os/`, `material manfac/`, `node_modules/`, `.claude/worktrees/`,
`.git/`, `docs/`.

**Achado fora do pedido, registrado aqui porque muda "onde mexer":** a rota
`/crm` existe, está protegida pelo `middleware.ts` (está no `matcher`), tem
`_actions` implícitas via Server Component + `_table.tsx`, e usa
`lib/leads/formato.ts` — é a tela de leads da Frente B do site (ver memória
`project-manfac-frente-b-leads.md`). Ela **não aparece na tabela de sistemas
do `AGENTS.md`** (que lista Sofia, Conversor de OS, Admin, Obras, Cockpit,
Financeiro). Não é erro deste inventário; é uma lacuna do `AGENTS.md` para
alguém corrigir no mesmo commit em que notar.

---

## 1. Árvore de pastas do hub

Até 3 níveis. Pastas de cache/build (`.next`, `.swc`, `.playwright-mcp`) estão
marcadas como tal e não são código-fonte.

```
.
├── app/                          # rotas Next.js (App Router) do hub
│   ├── (auth)/                   # route group: login, signup, recuperação de senha
│   │   ├── forgot-password/      # tela + action de "esqueci minha senha"
│   │   ├── login/                # tela + action de login
│   │   ├── reset-password/       # tela + action de redefinir senha
│   │   └── signup/               # tela + action de cadastro, com /verify (aguardando confirmação de e-mail)
│   ├── (dashboard)/dashboard/    # painel pós-login com os cards de sistema
│   │   └── __tests__/            # teste do page.tsx do dashboard
│   ├── (operacoes)/              # route group do Sofia (Gestão de Frotas), com layout com Sidebar
│   │   ├── layout.tsx            # exige sessão, renderiza Sidebar + children
│   │   └── sofia/                # 15 subrotas do Sofia (abastecimento, checklist, custos, ...) — ver seção 2
│   ├── admin/                    # módulo de login/acessos (Admin na UI)
│   │   ├── __tests__/            # testes de _actions.ts e _dialogs.tsx
│   │   └── acessos/              # tela /admin/acessos (contas e acessos)
│   ├── api/                      # rotas de API (route handlers)
│   │   ├── conversor-os/processar/   # endpoint que roda a conversão de planilha
│   │   ├── obras/sincronizar/        # endpoint chamado pelo pg_cron do Field Control
│   │   └── sofia/veiculo-motorista/  # endpoint de cascata veículo→motorista
│   ├── auth/callback/            # route handler do callback do Supabase Auth
│   ├── conversor-os/             # tela do Conversor de OS + histórico
│   │   ├── __tests__/
│   │   └── historico/            # lista de conversões já feitas
│   ├── crm/                      # tela de leads (Frente B do site) — ver achado acima
│   │   └── __tests__/
│   ├── obras/                    # módulo Controle de Obras — ver seção 2 (81 arquivos .ts/.tsx)
│   │   ├── __tests__/            # 10 arquivos de teste no nível do módulo
│   │   ├── _lib/                 # regras de domínio (tipos, importação, histórico, ficha-campos)
│   │   │   └── field/            # cliente HTTP da API do Field Control (fronteira: index.ts)
│   │   ├── _ui/                  # componentes de UI genéricos do módulo (diálogo, primitivos)
│   │   ├── base/                 # aba "Base de obras" (tabela/kanban com filtros)
│   │   ├── diario/                # aba "Diário do dia"
│   │   ├── importar/              # tela de importação manual de planilha (legado; não é mais a fonte dos dados)
│   │   ├── obra/[id]/             # Ficha da obra (tela de detalhe, maior módulo em linhas)
│   │   ├── sincronizar/           # tela + lógica da sincronização com o Field Control
│   │   └── tarefas/               # aba "Tarefas"
│   ├── favicon.ico, globals.css, layout.tsx, page.tsx   # raiz do app (root layout, tema, "/" redireciona)
├── components/
│   ├── sofia/                    # componentes de UI específicos do Sofia (Sidebar, formulários, câmera, galeria)
│   │   └── __tests__/
│   └── ui/                       # componentes genéricos (Button, Input, FormError, Logo)
├── lib/
│   ├── auth/                     # domínio de e-mail, nível (admin/analista), acesso por sistema
│   │   └── __tests__/
│   ├── conversor-os/             # conversão de planilha (DPSP, D1000) para o formato Field Control
│   │   └── __tests__/
│   ├── leads/                    # formatação de lead (usado por /crm)
│   │   └── __tests__/
│   ├── sofia/                    # domínio do Sofia: queries, tipos, validações, upload de fotos
│   │   └── __tests__/
│   ├── supabase/                 # clients Supabase (browser, server, admin/service-role)
│   │   └── __tests__/
│   └── sistemas.ts               # lista dos sistemas exibidos no dashboard
├── __tests__/                    # testes de arquivos da raiz (middleware, lib/sistemas, use-server)
├── public/                       # 7 assets estáticos (svgs padrão do Next + logo-white.png, logo.png)
├── scripts/                      # 2 scripts .mjs avulsos (exportar-os-field.mjs, verificar-field.mjs) — fora de app/lib
├── sdd/                          # 1 arquivo: fix-final-review-report.md (relatório de review, não código)
├── sdd-sql-*.sql (22 arquivos)   # migrations manuais na raiz — ver seção 4
├── middleware.ts                 # fronteira real de autorização (Supabase Auth + matcher de rotas)
├── jest.config.ts, jest.setup.ts # configuração de testes
├── next.config.ts                # configuração do Next.js
├── .next/                        # BUILD — cache/output do `next build`, não é código-fonte
├── .swc/                         # BUILD — cache do compilador SWC
└── .playwright-mcp/              # cache de logs de console do Playwright MCP (sessões de teste manual)
```

---

## 2. Mapa por módulo

### `(auth)` — telas de autenticação
- Rota: `/login`, `/signup`, `/signup/verify`, `/forgot-password`, `/reset-password`.
- Arquivos principais: `app/(auth)/login/page.tsx` + `LoginForm.tsx` + `actions.ts`; mesmo padrão em `signup/`, `forgot-password/`, `reset-password/`.
- Exports de `actions.ts` (um por pasta, não farejados individualmente — são Server Actions simples de login/signup/reset, sem `_actions.ts` com prefixo `_`, note a exceção à convenção do projeto).
- Testes: nenhum arquivo `__tests__` dentro de `(auth)/`.

### `(dashboard)/dashboard` — painel pós-login
- Rota: `/dashboard`.
- Arquivos: `page.tsx` (renderiza os cards de `lib/sistemas.ts`, filtrando por `hasSystemAccess`), `actions.ts` (não farejado em detalhe).
- Testes: `app/(dashboard)/dashboard/__tests__/page.test.tsx`.

### `(operacoes)/sofia` — Gestão de Frotas
- Rota base: `/sofia`, com 15 subseções. Layout do route group (`app/(operacoes)/layout.tsx`) exige sessão e monta `components/sofia/Sidebar.tsx`.
- Subrotas e seus `_actions.ts` (exports = Server Actions exportadas, uma frase cada):
  - **abastecimento** (`/sofia/abastecimento`): `lancarAbastecimentoAction`, `deletarAbastecimentoAction`. Teste: `__tests__/_actions.test.ts`.
  - **checklist** (`/sofia/checklist`, `/checklist/[id]`, `/checklist/novo`): `_actions.ts` → `criarChecklistAction`, `excluirChecklistAction`; `_validation.ts` → `parseChecklistFormData`, `validateChecklistInput` (parsing/validação de FormData de checklist com fotos). Testes: `_actions.devolucao-finalizacao.test.ts`, `_actions.troca.test.ts`, `_validation.test.ts`.
  - **custos** (`/sofia/custos`): `atualizarCentroCustoAction`. Teste: `_actions.test.ts`.
  - **descontos** (`/sofia/descontos`): `atualizarStatusMultaAction`, `registrarDescontoMultaAction`, `desfazerDescontoMultaAction`, `atualizarStatusDescontoSinistroAction`, `registrarDescontoSinistroAction`, `desfazerDescontoSinistroAction`. Teste: `_actions.test.ts`.
  - **disponibilidade** (`/sofia/disponibilidade`): só `page.tsx`, sem `_actions.ts` próprio (usa `lib/sofia/disponibilidade.ts`).
  - **documentos** (`/sofia/documentos`, `/documentos/novo`): `criarDocumentoAction`, `obterUrlDocumentoAction`. Sem teste próprio.
  - **equipes** (`/sofia/equipes`, `/equipes/nova`): `criarEquipeAction`, `toggleEquipeAction`, `desativarEquipeAction`. Teste: `_actions.test.ts`.
  - **km** (`/sofia/km`): `_actions.ts` → `lancarKmAction`, `deletarKmAction`, `upsertKmExcedidoStatusAction`, `atualizarAutorizacaoKmExcedidoAction`; `_validation.ts` é um **re-export** de `lib/sofia/kmValidation.ts` (`export { validateKmAtual } from '@/lib/sofia/kmValidation'`). Testes: `_actions.test.ts`, `_validation.test.ts`.
  - **motoristas** (`/sofia/motoristas`, `/motoristas/[id]`, `/motoristas/novo`): raiz → `criarMotoristaAction`, `desativarMotoristaAction`; `[id]/_actions.ts` → `marcarTermoAssinadoAction`. Sem `__tests__` visível para estas actions.
  - **multas** (`/sofia/multas`, `/multas/nova`): `criarMultaAction`, `enviarParaDescontoEmMassaAction`, `excluirMultaAction`, `excluirMultasEmMassaAction`, `atualizarAutorizacaoMultaAction`. Teste: `_actions.test.ts`.
  - **pendencias** (`/sofia/pendencias`): `criarPendenciaAction`, `atualizarStatusPendenciaAction`. Sem teste próprio.
  - **revisoes** (`/sofia/revisoes`, `/revisoes/nova`): `criarRevisaoAction`, `excluirRevisaoAction`. Sem teste próprio.
  - **sinistros** (`/sofia/sinistros`, `/sinistros/[id]`, `/sinistros/novo`): `atualizarAutorizacaoSinistroAction`, `criarSinistroAction`, `atualizarTratativaSinistroAction`, `excluirSinistroAction`. Testes: `_actions.criar.test.ts`, `_actions.test.ts`.
  - **veiculos** (`/sofia/veiculos`, `/veiculos/[id]`, `/veiculos/novo`): `criarVeiculoAction`, `softDeleteVeiculoAction`, `atualizarLocacaoVeiculoAction`, `atualizarEquipeVeiculoAction`, `enviarParaOficinaAction`, `retornarDaOficinaAction`, `definirSubstitutoAction`. Teste: `_actions.test.ts`.
  - **audit** (`/sofia/audit`): só `page.tsx` (lê `lib/sofia/auditLog.ts`).
- Erro de rota: `app/(operacoes)/sofia/error.tsx`.
- Testes de API relacionada: `app/api/sofia/veiculo-motorista/route.ts` com teste em `app/api/sofia/__tests__/veiculo-motorista.route.test.ts`.

### `admin` — Admin (contas e acessos)
- Rota: `/admin`, `/admin/acessos`.
- Arquivos principais: `app/admin/_actions.ts` (329 linhas), `app/admin/_dialogs.tsx`, `app/admin/acessos/_contas.tsx` (297 linhas), `app/admin/acessos/_table.tsx`.
- Exports de `_actions.ts`: `UsuarioHub` (interface), `listarUsuariosAction`, `alterarNivelAction`, `removerUsuarioAction`, `convidarUsuarioAction`, `reenviarConviteAction`, `cancelarConviteAction`, `enviarResetSenhaAction`, `alternarAcessoAction` — todas via `createAdminClient()` (service role), única forma de escrita em `hub_user_roles`/`hub_system_access`.
- Testes: `app/admin/__tests__/_actions.test.ts` (545 linhas), `_dialogs.test.tsx`; `app/admin/acessos/__tests__/_contas.test.tsx`, `_table.test.tsx`.

### `api` — route handlers
- `app/api/conversor-os/processar/route.ts`: endpoint POST que roda a conversão de planilha (usa `lib/conversor-os/*`). Teste: `__tests__/route.test.ts`.
- `app/api/obras/sincronizar/route.ts`: endpoint chamado pelo `pg_cron` (jobs `obras-field-incremental` e `obras-field-completa`), protegido por `OBRAS_CRON_SECRET`. Teste: `__tests__/route.test.ts`.
- `app/api/sofia/veiculo-motorista/route.ts`: endpoint de cascata veículo→motorista usado pelo hook `lib/sofia/useVeiculoMotoristaCascade.ts`.
- `app/auth/callback/route.ts`: callback do fluxo de e-mail do Supabase Auth (fora de `api/`, na raiz de `app/auth/`).

### `conversor-os` — Conversor de OS
- Rota: `/conversor-os`, `/conversor-os/historico`.
- Arquivos: `page.tsx`, `_form.tsx` (258 linhas), `_actions.ts`, `layout.tsx`; `historico/page.tsx`, `historico/_table.tsx`.
- Exports de `_actions.ts`: `RegistrarImportacaoInput` (interface), `registrarImportacaoAction`, `obterUrlDownloadAction`.
- Testes: `app/conversor-os/__tests__/_actions.test.ts`.

### `crm` — leads (achado fora do AGENTS.md, ver nota no topo)
- Rota: `/crm`.
- Arquivos: `page.tsx` (Server Component, usa `createAdminClient()` com comentário explícito sobre "defesa em profundidade" porque `site_leads` não tem RLS própria — o middleware é hoje a única barreira), `_table.tsx`, `layout.tsx`.
- Depende de `lib/leads/formato.ts` (tipo `Lead` e helpers).
- Testes: `app/crm/__tests__/page.test.tsx`, `table.test.tsx`.

### `obras` — Controle de Obras (maior módulo do hub: 81 arquivos .ts/.tsx)
- Rota base: `/obras`, com abas `base`, `diario`, `tarefas` (layout client-side em `app/obras/layout.tsx` que marca a aba ativa via `usePathname`), mais `obra/[id]` (Ficha, não é aba), `importar` e `sincronizar`.
- **`_lib/` (regras de domínio, sem prefixo de rota):**
  - `tipos.ts` (845 linhas) — tipos e constantes centrais: `Etapa`, `Fase`, `Obra`/`ObraRow`, `Bloqueio`, `Prioridade`, `Origem`, `TipoObra`, `FonteObra`, e funções derivadas: `derivar`, `faseDe`, `critico`, `estourou`, `travado`, `encalhada`, `sev` (severidade), `diasSemOS`, `nomeDaEquipe`, `contadoresDoDiario`. É o arquivo mais importado do módulo.
  - `importacao.ts` (690 linhas) — parsing e normalização da planilha de obras (dois formatos: pipeline e planejamento): `paraTexto`, `paraNumero`, `paraDataIso`, `normalizarOs/Loja/Equipe/Bloqueio/Prioridade`, `mapearLinhaPipeline`, `mapearLinhaPlanejamento`, `montarImportacao`, `camposParaAtualizar`.
  - `historico.ts` — `linhasDeAlteracao`, `gravarComHistorico` (grava histórico de mudanças de campo na obra).
  - `ficha-campos.ts` (368 linhas) — validação dos blocos editáveis da ficha: `validarAutorizacao`, `validarIdentificacao`, `validarCronograma`, `precisaRemarcar`, `MOTIVOS_REMARCACAO`.
  - **`_lib/field/`** — cliente da API do Field Control. **Fronteira pública é só `index.ts`** (comentário explícito no arquivo: "IMPORTE DAQUI, não dos arquivos internos"). Reexporta: `criarClienteField` (cliente.ts), `consultarSituacaoDaOrdemField` (consulta-ordem.ts), `criarResolvedorDeLoja`/`textoDoEndereco` (loja.ts), `criarHttpField`/`montarQ` (http.ts), `criarLimitador` (limitador.ts), classes de erro `ErroDaApiField`/`ErroDeParametroInvalido`/`ErroDeRateLimit`/`ErroDeTipoDeOs` (erros.ts), e os tipos de `tipos.ts`. Não lê `process.env` — a chave (`FIELD_API_KEY`) entra por parâmetro, de propósito. Cada arquivo interno tem teste em `field/__tests__/`.
- **`_ui/`** — `dialogo.tsx`, `primitivos.tsx` (componentes de UI genéricos do módulo, ex.: modal de confirmação). Teste: `_ui/__tests__/dialogo.test.tsx`.
- **`base/`** (`/obras/base`) — aba "Base de obras": `_table.tsx`, `_kanban.tsx`, `_filtros.tsx`, `_etiquetas.tsx`, `_visao.tsx`, `_regras.ts` (355 linhas: filtros, ordenação, KPIs — `filtrar`, `ordenar`, `kpisDaBase`, `COLS`, `COR_ETAPA`).
- **`diario/`** (`/obras/diario`) — aba "Diário do dia": `_actions.ts` (292 linhas: `salvarDiarioAction`, `desfazerDiarioAction`, `obterUrlFotoAction`), `_cartao.tsx`, `_cartoes.tsx` (359 linhas), `_foto.tsx`, `_pessoa.ts` (`resolverChave`, `chaveDoUsuario`), `loading.tsx`.
- **`importar/`** (`/obras/importar`) — importação manual de planilha (legado; por decisão de 10/09 a base nasce do Field Control, planilha não é mais importada como fonte): `_actions.ts` (`importarPlanilhaAction`), `_form.tsx`.
- **`obra/[id]/`** (Ficha da obra) — maior conjunto de arquivos do módulo:
  - `_ficha.tsx` (870 linhas) — monta a tela da ficha a partir dos blocos.
  - `_actions.ts` (741 linhas) — `mudarEtapaAction`, `liberarObraAction`, `salvarAutorizacaoAction`, `salvarIdentificacaoAction`, `salvarCronogramaAction`, `salvarDadosTriagemAction`, `cadastrarMotivoRemarcacaoAction`.
  - `_triagem.tsx` (647 linhas) — modo de triagem (definição inicial), não é uma aba separada.
  - `_bloco-autorizacao.tsx`, `_bloco-cronograma.tsx` (368), `_bloco-editavel.tsx` (360), `_bloco-identificacao.tsx` (257), `_etapa.tsx`, `_dialogo-remarcar.tsx` (393), `_historico.tsx`.
  - Testes: `__tests__/_blocos-editaveis.test.tsx`, `_dialogo-remarcar.test.tsx`, `_historico.test.tsx`.
- **`sincronizar/`** (`/obras/sincronizar`) — sincronização com o Field Control:
  - `_actions.ts` — `sincronizarComFieldAction` (dispara sync pelo botão).
  - `_criterio-de-entrada.ts` — `SITUACOES_ACEITAS`, `entraNaCarga`, `motivoDaRecusa` (critério do cliente: última atividade em pending/scheduled/in-progress).
  - `_execucao.ts` (337 linhas) — `prepararExecucao`, `executarExecucaoPreparada`, `executarSincronizacao`. **Não lê `process.env`**; a chave `FIELD_API_KEY` entra por parâmetro.
  - `_sincronizacao.ts` (428 linhas) — `planejarSincronizacao`, `encontrarConsultasDeReabertura`, `numerosDeOsDoField`, `emLotes`; tipos `PlanoDeSincronizacao`, `AtualizacaoDoField`, `ObraNovaDoField`.
  - `_historico.tsx`, `_painel.tsx` (UI).
  - Testes: `_actions.test.ts` (488), `_criterio-de-entrada.test.ts`, `_execucao.test.ts`, `_sincronizacao.test.ts` (752 linhas).
- **`tarefas/`** (`/obras/tarefas`) — aba "Tarefas": `_actions.ts` (`responderTarefaAction`), `_lista.tsx` (368 linhas).
- `error.tsx` — página de erro do módulo.
- Testes no nível do módulo (`app/obras/__tests__/`): `base.test.ts`, `diario.test.ts`, `etiquetas.test.tsx`, `ficha-campos.test.ts`, `ficha-editavel.test.ts` (758), `ficha.test.ts`, `historico.test.ts`, `importacao.test.ts` (792), `tarefas.test.ts`, `tipos.test.ts` (811) — testam `_lib/` e componentes de nível superior, não ficam dentro da subpasta da rota.

---

## 3. Bibliotecas compartilhadas

### `lib/auth/`
- `domain.ts` — `isManfacEmail(email)`: só e-mails `@manfac.com.br` (+ exceção do dono); `getFirstName(fullName)`: extrai primeiro nome.
- `roles.ts` — `Nivel` (tipo `'analista'|'administrador'`); `normalizarEmail`; `getNivel(email)`: lê `hub_user_roles`; `isAdmin(email)`: nível é administrador.
- `requireAdmin.ts` — `requireAdmin()`: guarda de página/action que redireciona/lança se não for admin.
- `systemAccess.ts` — `hasSystemAccess(email, slug)`: lê `hub_system_access`; admin sempre passa.
- Testes: `domain.test.ts`, `requireAdmin.test.ts`, `roles.test.ts`, `systemAccess.test.ts`.

### `lib/supabase/`
- `client.ts` — `createClient()`: client Supabase de browser (anon key).
- `server.ts` — `createClient()`: client Supabase de Server Component/Action (cookies).
- `admin.ts` — `createAdminClient()`: client com `SUPABASE_SERVICE_ROLE_KEY` (ignora RLS); usado só em `app/admin/_actions.ts` e `app/crm/page.tsx`.
- Teste: `admin.test.ts`.

### `lib/sofia/`
- `queries.ts` (313 linhas) — ~20 funções `get*` (ex.: `getEquipes`, `getVeiculos`, `getMotoristas`, `getKmHoje`, `getMultasPendentes`, `getSinistrosAbertos`, `getRevisoesAtrasadas`, `getDocumentosVencendo`, `getKmResumoMensal`): leituras centralizadas do domínio Sofia.
- `types.ts` — todas as interfaces/tipos de domínio do Sofia (`Equipe`, `Veiculo`, `Motorista`, `Checklist`, `Multa`, `Sinistro`, `Revisao`, `DocumentoVeiculo`, `Abastecimento`, `Pendencia`, etc.) e os enums de status.
- `enums.ts` — arrays `as const` dos enums (`VEICULO_STATUS`, `MULTA_STATUS`, `CHECKLIST_TIPOS`, ...) e `isValidEnum`.
- `auditLog.ts` — `logAudit(...)`: grava em log de auditoria.
- `autorizacao.ts` — `formatAutorizacaoLabel`, `autorizacaoBadgeClass`.
- `checklistBadge.ts` — `badgeChecklist(tipo)`: cor/label do badge de tipo de checklist.
- `comprimirImagem.ts` — `comprimirImagem(file)`: compressão de imagem antes do upload.
- `disponibilidade.ts` — `motivoParado`, `formatarTempoDesde`.
- `equipes.ts` — `ultimoTipoPorVeiculo`, `statusEquipe`.
- `kmValidation.ts` — `validateKmAtual(km)`.
- `motoristas.ts` — `classificarCnh`, `cnhStatus`.
- `multas.ts` — `TIPOS_INFRACAO` (lista fixa).
- `pendencias.ts` — `mapAutomaticPendencias`, `calcularKpisPendencias`, `agruparGargalos`.
- `uploadFotos.ts` — `uploadFotos(...)`: upload de fotos capturadas para o storage.
- `useVeiculoMotoristaCascade.ts` — hook client-side que consome `app/api/sofia/veiculo-motorista/route.ts`.
- `veiculos.ts` — `validarVinculoEquipeUnico`.
- Testes: um arquivo por módulo em `lib/sofia/__tests__/` (12 arquivos).

### `lib/conversor-os/`
- `types.ts` — `Cliente` (`'DPSP'|'D1000'`), `ConversorRow`, `LinhaErro`, `ConversaoResultado`.
- `converter.ts` — `converterLinhas(...)` genérico (recebe `MapearLinha`/`FiltrarLinha`).
- `d1000.ts` — `filtrarLinhaD1000`, `mapearLinhaD1000`, `ABREVIACOES_BANDEIRA`, `abreviarLocalizacao`.
- `dpsp.ts` — `mapearLinhaDPSP`.
- `planilha.ts` — `localizarAba`, `localizarLinhaCabecalho`, `extrairLinhasBrutas`, `gerarWorkbookFieldControl` (usa ExcelJS).
- `nomeArquivo.ts` — `gerarNomeArquivo(cliente, data)`.
- Testes: um por arquivo em `lib/conversor-os/__tests__/` (5 arquivos).

### `lib/leads/`
- `formato.ts` — tipo `Lead`; `formatarData`, `linkWhatsApp`, `estaCompleto`. Único consumidor conhecido: `app/crm/`.
- Teste: `formato.test.ts`.

### `lib/sistemas.ts`
- `Sistema` (interface), `SISTEMAS` (array usado pelo dashboard para montar os cards — nota do `AGENTS.md`: o card do Financeiro fica fora deste array de propósito).

### `components/sofia/`
- `Sidebar.tsx` — `navSections`, `detailRoutes`, `Sidebar()`: navegação lateral do route group `(operacoes)`. Teste: `Sidebar.test.ts`.
- `AlertBanner.tsx`, `AutorizacaoActions.tsx`, `CameraCapture.tsx`, `DeleteConfirmButton.tsx`, `EditarEquipeVeiculoForm.tsx`, `FilterSelect.tsx`, `GaleriaFotos.tsx` (teste: `GaleriaFotos.test.tsx`), `OficinaForm.tsx`, `PrintExportButton.tsx`, `StatCard.tsx`, `VerArquivoButton.tsx` — todos `export default function`, um componente por arquivo, nomes autoexplicativos.

### `components/ui/`
- `Button.tsx`, `Input.tsx`, `FormError.tsx`, `Logo.tsx` — componentes genéricos, todos `export default function`. Sem testes próprios.

### `middleware.ts` (143 linhas)
- `middleware(request)`: cria client Supabase SSR, checa sessão/domínio/nível, redireciona não-autenticado para `/login` e autenticado tentando abrir página de auth para `/dashboard`.
- `config.matcher` (linha 127): `/dashboard/:path*`, `/sofia/:path*`, `/conversor-os/:path*`, `/crm/:path*`, `/obras/:path*`, `/admin/:path*`, `/api/conversor-os/:path*`, `/api/sofia/:path*`, `/login`, `/signup`, `/signup/verify`, `/forgot-password`, `/reset-password`, `/auth/callback`. **Confirma o que o `AGENTS.md` já diz**: Cockpit e Financeiro não estão aqui, de propósito.
- Teste: `__tests__/middleware.test.ts` (raiz).

---

## 4. Arquivos com mais de 600 linhas

9 arquivos `.ts`/`.tsx` e 1 arquivo `.sql` passam de 600 linhas. Todos em `app/obras/` ou na raiz (SQL).

| Caminho | Linhas | O que é |
|---|---:|---|
| `app/obras/obra/[id]/_ficha.tsx` | 870 | Componente da Ficha da obra — monta a tela de detalhe a partir dos blocos editáveis |
| `app/obras/_lib/tipos.ts` | 845 | Tipos e constantes centrais do domínio obras (`Etapa`, `Obra`, regras derivadas de prazo/severidade) |
| `app/obras/__tests__/tipos.test.ts` | 811 | Testes de `_lib/tipos.ts` |
| `app/obras/__tests__/importacao.test.ts` | 792 | Testes de `_lib/importacao.ts` |
| `app/obras/__tests__/ficha-editavel.test.ts` | 758 | Testes dos blocos editáveis da Ficha |
| `app/obras/sincronizar/__tests__/_sincronizacao.test.ts` | 752 | Testes do planejamento de sincronização com o Field Control |
| `app/obras/obra/[id]/_actions.ts` | 741 | Server Actions da Ficha da obra (liberar, salvar autorização/identificação/cronograma/triagem, mudar etapa, cadastrar remarcação) |
| `app/obras/_lib/importacao.ts` | 690 | Parsing/normalização da planilha de obras (formatos pipeline e planejamento) |
| `app/obras/obra/[id]/_triagem.tsx` | 647 | Componente de triagem — modo da Ficha quando a etapa é "definir" |
| `sdd-sql-obras-motivos-remarcacao.sql` | 610 | Migration: tabela/coluna de motivos de remarcação de obras |

Nenhum outro arquivo do hub (código ou SQL) passa de 600 linhas. O próximo maior é `app/admin/__tests__/_actions.test.ts` com 545 linhas.

---

## 5. Onde estão os testes

- **78 arquivos** `*.test.ts`/`*.test.tsx` dentro do escopo do hub (contagem: `find app components lib __tests__ -type f -name "*.test.ts*" | wc -l`).
- Distribuídos em **28 pastas** `__tests__/`, sempre **ao lado do código que testam** (nunca centralizados), exceto a raiz:
  - `__tests__/` na raiz do repo — testa arquivos de nível raiz: `middleware.test.ts`, `sistemas.test.ts`, `use-server-exports-async.test.ts`.
  - Uma `__tests__/` por rota/lib que tem teste: `app/(dashboard)/dashboard/__tests__`, `app/(operacoes)/sofia/{abastecimento,checklist,custos,descontos,equipes,km,multas,sinistros,veiculos}/__tests__`, `app/admin/__tests__` e `app/admin/acessos/__tests__`, `app/api/{conversor-os/processar,obras/sincronizar,sofia}/__tests__`, `app/conversor-os/__tests__`, `app/crm/__tests__`, `app/obras/__tests__` (nível de módulo) + `app/obras/{_lib/field,_ui,obra/[id],sincronizar}/__tests__`, `components/sofia/__tests__`, `lib/{auth,conversor-os,leads,sofia,supabase}/__tests__`.
- **Padrão de nomeação:** nome do arquivo testado + `.test.ts`/`.test.tsx` (ex.: `_actions.ts` → `_actions.test.ts`, `page.tsx` → `page.test.tsx`). Quando um arquivo tem mais de um arquivo de teste, o padrão vira `<arquivo>.<recorte>.test.ts` — ex.: `_actions.criar.test.ts` e `_actions.test.ts` (sinistros), `_actions.devolucao-finalizacao.test.ts` e `_actions.troca.test.ts` (checklist).
- Módulos do Sofia **sem** `__tests__` de `_actions.ts`: `documentos`, `motoristas`, `pendencias`, `revisoes`, `disponibilidade`, `audit` — os testes existentes cobrem só as ações escritas depois de 2026-08 (v04-seguranca em diante); não medi se há cobertura indireta via outro teste.

---

## 6. Contagens totais

Escopo: `app/`, `components/`, `lib/`, `__tests__/` (raiz) + `middleware.ts`, `jest.config.ts`, `jest.setup.ts`, `next.config.ts`.

| Métrica | Valor |
|---|---:|
| Arquivos `.ts`/`.tsx` em `app/` + `components/` + `lib/` + `__tests__/` (raiz) | 277 |
| + `middleware.ts`, `jest.config.ts`, `jest.setup.ts`, `next.config.ts` | 4 |
| **Total de arquivos `.ts`/`.tsx` do hub** | **281** |
| **Total de linhas** (mesmo conjunto) | **36.977** |
| — das quais em `app/` | 32.609 (201 arquivos) |
| — das quais em `lib/` | 2.787 (55 arquivos) |
| — das quais em `components/` | 980 (18 arquivos) |
| — das quais em `__tests__/` (raiz) | 389 (3 arquivos) |
| — das quais em `middleware.ts`+configs | 212 (4 arquivos) |
| Rotas de página (`page.tsx`) | 47 |
| Rotas de API/callback (`route.ts`) | 4 |
| **Total de rotas** (page + route) | **51** |
| Arquivos de teste (`*.test.ts*`) | 78 |
| Migrations SQL na raiz (`sdd-sql-*.sql`) | 22 arquivos, 2.805 linhas |

Não medido: cobertura de linha/branch dos testes (não rodei `npm test -- --coverage` porque o pedido era estrutura, não execução); contagem de arquivos dentro de `.next/` (é build output, variável a cada build, sem valor para este inventário).
