# RH: descoberta de integrações com os outros sistemas (05/11/2026)

Somente leitura. Sem fases (o coordenador decide). Nada de banco de produção: tudo vem de migrations e código.

**Legenda:** **[V]** verificado (caminho:linha) · **[H]** hipótese minha, não provada.

**Caminhos.** `repos/X/...` = clone raso em
`C:\Users\joao-\AppData\Local\Temp\claude\8b487bef2614d2fb\7645a9ed-944e-4d64-8425-05f5ec28725e\scratchpad\repos\X\`.
Caminho sem `repos/` = o hub (`C:\Users\joao-\projeto-01-elite-da-ia`). Dado pessoal e segredo não foram copiados.
O estado interno do RH está em `docs/rh/descoberta-estado-atual-2026-11-05.md` (outro agente); aqui só o que é fora dele.

Ressalva de frescor: são clones rasos de 05/11. SQL do hub marcado "NÃO APLICADO" nos arquivos pode já ter sido aplicado
(o cabeçalho é de quando foi escrito); não consultei o banco.

---

## 0. Os cinco achados que mais mudam o desenho

1. **`rh_colaboradores` não tem e-mail.** Colunas: id, cpf, nome, cargo, tipo_contratacao, admissao, desligamento, status,
   fornecedor_omie_codigo, salario_centavos (+ auditoria) [V] `repos/rh/supabase/hub-install/002_rh_colaboradores.sql:20-39`,
   `003_rh_salario.sql:30-35`. Todo sistema que identifica pessoa por e-mail (hub_system_access, Cockpit, Obras, Compras, Financeiro)
   não consegue achar o colaborador. A chave que o RH já tem é **CPF** (único) e **`fornecedor_omie_codigo`** (único, liga ao catálogo de
   fornecedores do Omie). Isso decide como admissão/desligamento falam com acessos (item 4) e com Frotas/Cockpit (item 5).
2. **O único consumidor real de `rh_*` é o Orçamento, e o padrão dele é "ler a tabela direto dentro de função SQL do próprio módulo",
   sem FK e com trava de pré-requisito.** Não há view, nem API HTTP, nem chamada de função `rh_*` por outro módulo [V] (item 1).
   Esse padrão é copiável para folha/VR, mas lê **o cadastro de agora**, não o de um mês fechado.
3. **O Financeiro não tem lote, recorrência, provisão nem importação de pagamentos.** Cada solicitação = 1 fornecedor, 1 valor, 1 vencimento,
   1 rateio de departamentos [V] `repos/financeiro/supabase/hub-install/006_fin_solicitacoes.sql:32-113`. Folha de N pessoas, VR rateado por
   pessoa, provisão de ajuda de custo: **nenhum existe**; o que existe é a **porta HTTP** que o Fornecedores usa para criar solicitação
   (`POST /financeiro/api/integracoes/medicoes`, idempotente por chave) — único precedente de "um app cria pagamento no outro". Ela só aceita
   `origem = 'fornecedores_medicao'` por CHECK no banco [V] `023_fin_integracao_medicoes.sql:17-24`. Anexo (boleto) **não** entra por essa porta
   [V] `repos/financeiro/lib/integracoes/medicoes.ts:21-22`.
4. **Centro de custo: a fonte é uma só na origem (departamento do Omie), mas existem 3 espelhos independentes e 2 formas de texto livre.**
   Divergência real, ver item 3.4. O RH e o Orçamento usam `fin_catalogo_departamentos`; o Compras tem cópia própria sincronizada do Omie; a Frotas
   guarda código/nome digitados e, em outra tabela, texto livre.
5. **A Frotas já tem "desconto em salário" (multa, sinistro, km excedido), mas o motorista dela é só nome** — sem CPF, sem e-mail, sem vínculo com
   `rh_colaboradores` [V] `sdd-sql-passo1.sql:22-30` (tabela `motoristas`). O desconto 6.6 do pedido existe como conceito do lado da Frotas
   (`.claude/rules/sofia.md:76-78`), mas não há como atribuí-lo a um colaborador do RH hoje.

Almoxarifado/patrimônio: **só especificação e um papel**. Não existe tabela, tela nem módulo de patrimônio em nenhum repositório (item 4.9).

---

## 1. Quem lê ou escreve `rh_*` hoje

### 1.1 Resumo [V]

| Quem | Como | Lê/escreve | Evidência |
|---|---|---|---|
| RH (próprio) | RPC `rh_*` pelo servidor (chave de serviço) e funções `security definer` | lê e escreve | `repos/rh/supabase/hub-install/002_rh_colaboradores.sql:229-740` |
| **Orçamento** | **leitura direta das tabelas `rh_colaboradores` e `rh_colaborador_rateios` dentro de funções SQL `orc_*` (definer)**; TS chama só as funções `orc_*` | só lê | detalhe 1.2 |
| Financeiro | nenhum código lê `rh_*`; só tipos gerados (`types/supabase.ts:12159-12290`) | nada | busca em `repos/financeiro` (fora de `types/`) sem ocorrência |
| Compras | nenhum código; só tipos gerados (`repos/compras/types/supabase.ts:16574-16605`) | nada | idem |
| Fornecedores, Cockpit, CRM | nenhuma ocorrência | nada | busca `rh_` em `repos/` fora de `rh/` e `orcamento/` |
| Hub (Obras, Frotas, Admin) | nenhuma ocorrência de `rh_` no código; **uma citação de intenção** em doc: "custo de mão de obra própria (folha rateada pelo RH) entra no custo da obra? Hoje vem por `rh_colaborador_rateios` no Orçamento, não no Financeiro" | nada | `docs/obras/descoberta-integracao-financeiro.md:123` |

Os tipos gerados de `rh_*` aparecem em Financeiro e Compras só porque `npm run types` gera para o banco inteiro [V] (regra `repos/financeiro/CLAUDE.md:18`
"depois: npm run types"); não é uso. [H] que ninguém lê `rh_*` fora do Orçamento, pelo método (busca textual em clones rasos); não vi o banco.

Também o contrário: o RH lê tabelas de outros: `fin_catalogo_departamentos` (função `rh_departamentos`, `002:720-742`),
`fin_catalogo_fornecedores` (função `rh_buscar_fornecedor_pf`, `002:671-717`) e `hub_user_roles` (`001:29-46`). Regra do RH: pode ler esses três, não escrever
fora de `rh_*` [V] `repos/rh/CLAUDE.md:28-30` (regra 4).

### 1.2 Como o Orçamento puxa pessoas e rateio (o precedente) [V]

Regra escrita do Orçamento: pode **ler** `fin_catalogo_departamentos`, `fin_catalogo_fornecedores`, `rh_colaboradores`, `rh_colaborador_rateios`, `hub_user_roles`;
escrever fora de `orc_*` não; **corpo de função SQL não chama função de outro módulo (nem `rh_rateio_em`): lê as tabelas `rh_*` direto**; FK só para `orc_*`
`repos/orcamento/CLAUDE.md:20-24`. Teste de segurança trava isso (`repos/orcamento/tests/hub-install-safety.test.ts:443,1507-1532`).

Mecânica:

- **Sem FK.** `orc_dir_pessoas.colaborador_id uuid` com o comentário "sem chave estrangeira: rh_colaboradores é de outro módulo" `repos/orcamento/supabase/hub-install/006_orc_ciclos.sql:140`.
  A pessoa orçada guarda **cópia** de cargo, contratação, salário e `salario_base_em` (`006:142-148`), não referência viva ao salário.
- **Funções definer do Orçamento leem o RH.** `orc_colaboradores_para_pef_v2` (`022_orc_colaborador_salario.sql:~48-135`): `from public.rh_colaboradores c where c.status <> 'desligado'`
  e, por subconsulta, o rateio da vigência do 1º mês do ciclo (`022:111-131`; mesma lógica em `007:905-922`). Devolve nome, cargo, contratação, admissão, desligamento,
  status, rateio (jsonb departamento+percentual), `salario_centavos` (`022:131`), sem CPF.
- **Headcount realizado** lê as duas tabelas `rh_*` direto, ignora sócio, trata admissão/desligamento proporcional ao mês e usa 100% em departamento `'-'` quando falta rateio
  `repos/orcamento/supabase/hub-install/016_orc_headcount.sql:250-300`.
- **Carga única**: script de dados com `join public.rh_colaboradores` / `rh_colaborador_rateios` (`repos/orcamento/supabase/dados/2026-10-29-carga-pefs-4T2026.sql:190-225`).
- **Dependência entre migrations**: o `022` aborta se faltar `rh_colaboradores.salario_centavos` (`ORC_GUARD`, `022:20-38`); README manda aplicar o `003` do RH antes
  (`repos/orcamento/supabase/hub-install/README.md:126-135`). **Contrato implícito de schema, sem versionamento**: se o RH renomear coluna, o Orçamento quebra em SQL.
- **Quem pode ver** (importante para folha/VR): "Dado pessoal vence o admin vê tudo" — salário e lista de colaboradores só para `controladoria`/`diretoria` do Orçamento e para o
  gestor do PEF cujo departamento aparece no rateio da pessoa; admin do hub sem papel recebe nulo/lista vazia (`repos/orcamento/CLAUDE.md:86-98`).
  O RH tem a regra própria equivalente (papel `rh`/`diretoria`, `repos/rh/supabase/hub-install/003_rh_salario.sql:39-50`). **São duas regras de visibilidade que hoje precisam coincidir à mão.**
- O módulo RH é descrito pelo Orçamento como "o módulo Colaboradores continua só `rh`/`diretoria`" (`CLAUDE.md:86-92`): o gestor lê pelo Orçamento, não pelo RH.

---

## 2. Como os apps conversam hoje (padrões reais)

Cinco padrões distintos, todos [V]:

| # | Padrão | Exemplo | Evidência |
|---|---|---|---|
| A | **Leitura direta de tabela de outro módulo**, com chave de serviço no servidor | Compras lê `obras_obra`, `obras_restricao` (`repos/compras/lib/obras/leitura.ts:8-49`); Fornecedores lê `fin_catalogo_fornecedores` (`repos/fornecedores/lib/catalogo/servidor.ts:104-107`) e `obras_obra`; Financeiro lê `obras_obra`, `obras_nota_externa`, `obras_medicao_cliente` (`repos/financeiro/lib/faturamento/saldo-spot.ts:45-53`, `lib/obra/medicoes.ts:7`) | regras de leitura explícitas: `repos/compras/CLAUDE.md:36` (regra 9), `repos/orcamento/CLAUDE.md:20-24` |
| B | **Função SQL do módulo consumidor lendo tabela do produtor** (definer) | Orçamento ← `rh_*` (item 1.2); Obras do hub chama RPCs `obras_fin_notas/_compras/_fornecedores/_vinculos/_locacoes` que leem `fin_*` (`sdd-sql-obras-financeiro-bc.sql:671-1067`; uso `app/obras/obra/[id]/_financeiro/dados.ts:27`) | |
| C | **RPC do produtor chamada pelo consumidor** | Fornecedores chama `fin_pagamentos_por_solicitacao` (`repos/fornecedores/lib/pagamentos/repositorio.ts`); Financeiro chama `obras_devolver_faturamento` no hub (`repos/financeiro/lib/faturamento/actions.ts:1088`); Orçamento chama `fin_pegar_vez_omie/fin_soltar_vez_omie` (`repos/orcamento/lib/omie/vez.ts`) | |
| D | **API HTTP com segredo compartilhado + idempotência** | Fornecedores → `POST {FINANCEIRO_URL}/financeiro/api/integracoes/medicoes` (`repos/fornecedores/lib/integracoes/financeiro.ts:15,260-262`), `Authorization: Bearer <FORNECEDORES_INTEGRACAO_SECRET>`; do outro lado `repos/financeiro/app/api/integracoes/medicoes/route.ts` e `lib/integracoes/medicoes.ts`; chave de idempotência = id da medição (`023_fin_integracao_medicoes.sql:17-60`) | **único exemplo de app criando registro de outro**; "falha fechada": sem segredo/URL, nada é enviado (`financeiro.ts:11-12`) |
| E | **Views/funções do produtor para o consumidor, guarda de leitura** | Frotas expõe `sofia_extrato_*_financeiro` (views definer, guarda `sofia_extrato_pode_ler()`) para o Financeiro (`.claude/rules/sofia.md:132-133`); Frotas × Financeiro: recarga de carteira vive em `fin_recargas` (`repos/financeiro/supabase/hub-install/043_fin_recargas.sql:1-17`) | |

Regras transversais [V]: ninguém escreve em tabela de outro módulo (`repos/compras/CLAUDE.md:8-10`, `repos/orcamento/CLAUDE.md:22`, `repos/rh/CLAUDE.md:28-30`); migration é manual, aplicada pelo Jose Guilherme
(`repos/orcamento/CLAUDE.md:14-16`); conta é do hub, o app não tem login próprio. Acesso a sistema: `hub_system_access` (slug) lido por `hasSystemAccess` (`lib/auth/systemAccess.ts:5-40`);
Cockpit, Orçamento e Frotas leem a tabela (`repos/orcamento/lib/auth/sessao.ts:46`, `repos/dashboard-manutencao/src/app/api/export/conferencia/route.ts:110`).

**Não existe** hoje: evento/webhook entre módulos, fila de integração, nem biblioteca compartilhada de contratos. Cada contrato é código + SQL duplicado em dois repositórios [V] (ausência por busca).

---

## 3. Como um pagamento entra no Financeiro

### 3.1 Dados mínimos de uma solicitação [V]
`repos/financeiro/supabase/hub-install/006_fin_solicitacoes.sql:32-113` (`fin_solicitacoes`) e `fin_criar_solicitacao` (`:226-310`):

- Identidade: `ambiente` (producao/teste), `numero` (contador por ambiente, `:22-30`), `etapa` (aguardando_diretor, aguardando_financeiro, devolvida, recusada, cancelada, lancando, lancada, falha_lancamento).
- Quem pede: `solicitante_email` (**tem de ser e-mail de conta do hub**, `check ... like '%_@_%'`) e nome. Na porta HTTP, o e-mail do solicitante vai no corpo e o servidor confere se é conta do hub
  (`repos/financeiro/app/api/integracoes/medicoes/route.ts:25-37`; erro `solicitante_desconhecido`, `lib/integracoes/medicoes.ts:57-60`).
- **Fornecedor obrigatório**: `fornecedor_origem` ∈ {`catalogo`, `cnpj_novo`, `cpf_novo`}, `fornecedor_documento` (11-14 dígitos), razão social. Origem `catalogo` exige `fornecedor_codigo_omie` (`:60-66,:79-80`).
  **Colaborador precisa ser fornecedor PF no Omie** (ou entrar como `cpf_novo`, que gera etiqueta de cadastro). O RH já guarda `fornecedor_omie_codigo` e tem busca
  `rh_buscar_fornecedor_pf` (`repos/rh/.../002:671-717`). O vínculo existe como coluna opcional; **quantos colaboradores têm esse código não sei (dado, não código)**.
- Pagamento: `forma_pagamento` ∈ {boleto, guia, pix_chave, pix_qrcode}; `codigo_pagamento` (linha digitável/PIX copia-e-cola) obrigatório exceto `pix_chave`; `valor_centavos > 0`; `vencimento`.
  Chave PIX completa em tabela fechada `fin_solicitacao_chaves_pix` (`:157`), só serviço lê.
- Classificação: `categoria_codigo/descricao`, `tipo_documento_*`, `descricao` (5-500 caracteres, `repos/financeiro/lib/solicitacoes/schemas.ts:67`), `numero_documento` opcional.
- **Rateio**: `rateio_modo` ∈ {percentual, valor}; linhas em `fin_solicitacao_rateio` (`:102-113`): `departamento_codigo`, `departamento_descricao`, `percentual_centesimos` (0-10000), `valor_centavos`.
  O banco recusa se a soma de valor ≠ total ou percentuais ≠ 100% (`:289-292`). Há `calcularRateio` no TS que converte (`schemas.ts:110`). **Percentual do RH é `numeric(5,2)` (centésimos), o do Financeiro é inteiro em centésimos: casa, mas a conversão e o arredondamento do último centavo são trabalho a especificar** [H sobre o desenho; V sobre os tipos].
- Prazo/janela: `emergencial` (automático ou manual com justificativa ≥ 10 caracteres), `data_minima`, `primeira_janela`, `enviado_em`, `dia_referencia` (`:84-91`). Etiquetas de validação (`:92-96`).

### 3.2 Fluxo, papéis e aprovação [V]
- Quem pode criar: **qualquer pessoa logada** (decisão do hub: Financeiro não tem slug, `AGENTS.md` do hub, tabela de sistemas). Papéis do módulo: só `financeiro` e `diretor`
  (`repos/financeiro/supabase/hub-install/002_fin_papeis.sql:17`).
- Etapa inicial: `aguardando_financeiro`, ou `aguardando_diretor` se emergencial (`006:245`). Financeiro valida/devolve/recusa; depois lançamento automático no Omie
  (`009_fin_lancamento.sql`, tarefas agendadas em `app/api/tarefas/lancamento`). Escrita **só** por funções de serviço (`CLAUDE.md:30-33`, regra 8). Decisão carrega `atualizado_em` (concorrência otimista).
- Escrita no Omie de produção exige autorização do Jose Guilherme (regra 4 do Financeiro).
- Duplicidade: o servidor procura solicitação duplicada por documento/valor/vencimento/código (`procurarDuplicadas`, `fin_solicitacoes_fornecedor_idx` `:97`) e marca etiqueta `possivel_duplicidade`.
  **Folha com vários colaboradores de mesmo valor/dia dispararia essa heurística** [H].

### 3.3 O que existe e o que não existe (itens 13.7, 16.3, 16.4, 18.8 do pedido e folha/VR)

| Capacidade | Existe? | Evidência |
|---|---|---|
| Criar solicitação por outro app (HTTP, idempotente) | **Sim**, só para `fornecedores_medicao` | `023:17-24` (CHECK em `origem`), `route.ts` |
| Criação **em lote** | **Não.** "Lote" no Financeiro = validação em lote (`components/solicitacoes/validacao-em-lote.tsx`), baixa em lote (`components/programacao/baixa-em-lote.tsx`) e lote de faturamento (a receber). Nenhum cria N solicitações | busca `lote` em `repos/financeiro/{app,components,lib}` |
| **Recorrência** de pagamento | **Não** no Financeiro. Existe no **Compras**: `cmp_modelos` (compra recorrente com fornecedor habitual) `repos/compras/supabase/hub-install/014_cmp_recorrente.sql:10` | busca `recorr` sem resultado em `repos/financeiro/{app,lib,supabase,components}` |
| **Provisão/provisionamento** | **Não.** Nenhuma ocorrência de `provis*` | idem |
| **Importação** de planilha de pagamentos | **Não** para pagamentos. (Há leitura de e-mail/colar linhas em Faturamento, que é a receber: `components/faturamento/colar-linhas.tsx`) | |
| **Anexo de boleto** | **Sim, pela tela**, pelo solicitante, depois de criada: `fin_anexos` (pdf/jpeg/png, ≤ 10 MB, `006:115-131`), pasta privada `financeiro-anexos`; **não pela porta HTTP** (`lib/integracoes/medicoes.ts:21-22` "TODO"). O boleto pode ir como `codigo_pagamento` (linha digitável) sem anexo | |
| Aprovação por papel | `financeiro`/`diretor`; no Compras há alçada por gestor de CC (`repos/compras/lib/auth/permissoes.ts:1,9`) | |
| Planilha de chaves PIX (17.3) | O Financeiro guarda PIX por solicitação (`fin_solicitacao_chaves_pix`), **não** cadastro de PIX por pessoa | `006:157` |

Leitura para o pedido (não decide fase): 13.7 (boleto do seguro), 16.4 (boleto do VT), 18.8 (conta do celular) são **uma solicitação normal** com fornecedor = seguradora/operadora/telefonia — cabem **hoje** pela tela, e o ganho do RH seria só pré-preencher rateio
a partir do cadastro e anexar o boleto. 16.3 (provisionar ajuda de custo) e folha/VR **por pessoa** exigem capacidade nova no Financeiro (lote, ou 1 solicitação consolidada por departamento) [H].
Pergunta aberta: **a folha vai ao Omie como 1 título por pessoa, 1 por departamento, ou 1 consolidado?** Orçamento diz: "Folha entra no Omie pelo **líquido** em Salários; guias separadas" (`repos/orcamento/docs/superpowers/specs/2026-10-16-orcamento-design.md:34` D9)
e "a hora extra… 2.03.01, como o financeiro lança hoje", "jantar de plantão é VR (2.03.12), como o financeiro lança" (`repos/orcamento/CLAUDE.md:42-48`), ou seja, o Financeiro **já lança** folha e VR hoje, mas não sei por qual rotina/forma (não achei no código do app; pode ser direto no Omie).

### 3.4 Lista de centros de custo: fonte única ou divergência?

**Resposta: fonte única de verdade = departamentos do Omie; mas há divergência de cópia e de formato.** [V] salvo onde marcado.

| Sistema | De onde vem | Evidência |
|---|---|---|
| Financeiro | `fin_catalogo_departamentos` (sincronizada do Omie por tarefa agendada). **Filtra `ativo = true`** ao listar para nova solicitação | `repos/financeiro/lib/catalogo/listas.ts:30-39`; tabela `003_fin_catalogo.sql:42-48` |
| RH | lê `fin_catalogo_departamentos` (`ambiente='producao'`, **inclui inativos**); rateio guarda só o **código** (`departamento_omie_codigo text`), sem FK | `repos/rh/.../002:720-742`, `002:49-60` |
| Orçamento | lê `fin_catalogo_departamentos` (`ambiente='producao'`, inclusive `ativo=false`) e usa o código como "departamento" do PEF | `repos/orcamento/CLAUDE.md:42-44` (regra 7) |
| Fornecedores | lê `fin_catalogo_departamentos` ("o mesmo código do rateio do Financeiro") | `repos/fornecedores/lib/catalogo/servidor.ts:104-105` |
| **Compras** | **cópia própria**, `cmp_catalogo_departamentos`, sincronizada do Omie pelo próprio Compras (`lib/catalogo/executar.ts`, `mapearDepartamentos`); gestor de CC por código em `cmp_papeis` | `repos/compras/lib/catalogo/queries.ts:63-68`; `004_cmp_catalogo.sql`; `permissoes.ts:9` |
| **Frotas** | (a) `equipes.centro_custo text` livre; (b) `centro_custo_historico` (veículo, texto) editado em `custos/_form.tsx:17` (input de texto); (c) `sofia_equipe_centro_custo (codigo text, nome text, vigente_desde)`, sem FK para catálogo nenhum, "centro de custo do Omie" digitado/escolhido na tela de cadastros | `sdd-sql-passo1.sql:1-6`; `sdd-sql-sofia-extratos.sql:134-146`; `app/(operacoes)/sofia/extratos/cadastros/page.tsx:266`. [H] se a tela de cadastros oferece lista fechada ou texto; não abri o formulário |
| Obras | **sem eixo de CC próprio** nas tabelas lidas: o Financeiro não tem conceito de obra; "o único eixo de centro de custo é o departamento do Omie"; obra é vínculo por tabela nova `fin_obra_vinculos` | `docs/obras/descoberta-integracao-financeiro.md:5,:73-80`; `repos/financeiro/.../044_fin_obra_vinculos.sql:123` |
| Cockpit | não tem CC; tem `clients`/`locations` próprios [V] tabelas em `repos/dashboard-manutencao/supabase/migrations/20260814032857_core_schema.sql` | |
| Caixinha (Financeiro) | `centro_custo_id/nome` **do VExpenses**, texto de outro sistema, mapeado a "contrato" em `fin_caixinha_cc_contrato` | `docs/obras/descoberta-integracao-financeiro.md:49-53` |

Riscos concretos [H sobre consequência, V sobre os fatos acima]:
- Departamento **inativado no Omie** continua no rateio do RH (vigência antiga) mas **some** da lista do Financeiro para nova solicitação: rateio puxado do RH pode conter código que o Financeiro recusa/não exibe.
- O Compras sincroniza o catálogo por conta própria: pode ficar defasado em relação ao Financeiro (jobs diferentes).
- Frotas não valida o código contra o catálogo: pode haver código inexistente/antigo.
- Duas "ambientes" (`producao`/`teste`) no Financeiro, Compras e catálogo; RH e Orçamento fixam `producao`.

---

## 4. Mapa de pontos de contato do RH

### 4.1 Financeiro
| Contato | Existe hoje [V] | Possível [H] |
|---|---|---|
| Fornecedor PF do colaborador | `rh_colaboradores.fornecedor_omie_codigo` + `rh_buscar_fornecedor_pf` lê `fin_catalogo_fornecedores` (`002:671-717`) | Financeiro ler o rateio do RH para pré-preencher |
| Folha líquida, hora extra, VR: realizado | Orçamento lê o realizado dos títulos do Omie por categoria de folha (`repos/orcamento/CLAUDE.md:42-48,110-116`); Financeiro lança hoje (forma não achada) | RH gerar consolidado por departamento a partir do cadastro e enviar por porta HTTP no padrão `medicoes` |
| VR/VA, VT, seguro, ajuda de custo, celular | Nada específico; cabe como solicitação comum (itens 13.7/16.4/18.8) | Porta HTTP nova (`origem` nova no CHECK de `fin_solicitacao_integracoes`, `023:17-24`); provisão (16.3) não tem equivalente |
| Papéis | Financeiro: `financeiro`/`diretor` (`002_fin_papeis.sql:17`); RH: `rh`/`diretoria` (`001:72`) | A pessoa que "sobe" o boleto é o solicitante; não precisa de papel no Financeiro |

### 4.2 Orçamento
Existe e funciona: rateio, status, admissão/desligamento, salário (item 1.2). Aberto: o Orçamento guarda **cópia** do salário ao orçar (`006:146-148`); salário novo no RH só chega ao orçamento se alguém refizer a linha.
Verbas variáveis (hora extra, VR variável, prêmios, plantão) o Orçamento orça por conta própria em "Despesas com pessoal" (`repos/orcamento/CLAUDE.md:42-48`); o RH hoje não tem esses dados [H sobre sobreposição futura].

### 4.3 Obras (custo de mão de obra, equipes de campo 17.2, escala)
- Existe: pergunta em aberto do José se folha rateada entra no custo da obra (`docs/obras/descoberta-integracao-financeiro.md:123`). Obras tem `obras_pessoa` (chave texto + **e-mail** único + área Compras/Obras/Campo + função + fone)
  `sdd-sql-obras-v0.sql:186-213` — é lista de "quem pode ser dono de tarefa", não folha.
- A obra liga a Financeiro por `fin_obra_vinculos` (`044:123`), mas **o rateio do RH é por departamento Omie, não por obra**. Se o CC "DPSP - OBRAS" for único para todas as obras da DPSP (pergunta 2 da descoberta, `:~108`), o custo de pessoal por obra precisa de outra dimensão [H].
- Equipes de campo (17.2) e escala (17.5): **não achei** tabela de escala nem de equipe de campo em Obras; equipes existem na Frotas (`equipes`) e no Cockpit (técnicos) [V para a ausência em Obras, por busca de `obras_*` tabelas listadas em item de uso; não li o schema inteiro].

### 4.4 Frotas
- Existe: `motoristas` (nome, CNH, vencimento, contato, equipe_id, ativo) sem CPF/e-mail (`sdd-sql-passo1.sql:22-30`); `veiculos.equipe_id`; histórico `veiculo_responsabilidade_historico` (usado em `app/api/sofia/veiculo-motorista/route.ts:~22`).
  Multa por etapa + `motorista_condutor_id` (arquivo **marcado NÃO APLICADO**) `sdd-sql-sofia-multa-avaria.sql:1-12,105-118`. Desconto em salário já modelado: `valor_descontado`, `autorizacao_status` em multas/sinistros, `km_excedido_desconto` (`.claude/rules/sofia.md:76-78`); só administrador do hub (ou gestor de frotas) mexe.
- 2.7.3 (veículo como recurso do colaborador): **não há ligação** pessoa↔veículo para quem não é motorista cadastrado; veículo é de equipe/motorista [V]. 6.6 (desconto na folha): a Frotas calcula o valor, mas **quem o aplica na folha** e **de qual colaborador** não tem chave comum [H quanto ao desenho].

### 4.5 Compras (uniforme, EPI)
Existe: solicitação de compra com itens de produto do Omie ou descrição livre; checagem de estoque por local; papéis `compras`, `almoxarifado`, `gestor` (por CC), `diretor`; recorrentes (`repos/compras/supabase/hub-install/007_cmp_solicitacoes.sql:93-112`, `014_cmp_recorrente.sql`).
A solicitação é do **e-mail do solicitante** e do **CC**, sem conceito de "para quem é" (colaborador beneficiário) [V por leitura do schema; busca de `colaborador` não aparece em `cmp_*`]. Uniforme/EPI por colaborador, com o ganho de rastrear entrega por pessoa: [H] precisa de beneficiário (CPF/colaborador_id) na solicitação.

### 4.6 Cockpit
`technicians(id text, name, email, is_active)` sincronizada do Field (`repos/dashboard-manutencao/supabase/migrations/20260814032857_core_schema.sql:3-9`), com `technician_goals`, metas e `user_client_access`.
Match possível com RH por **e-mail** (não existe no RH) ou por **nome** (frágil) [V para as colunas; H para o casamento]. Plantões/escala: Cockpit é app separada, responsável Jose Guilherme (AGENTS.md do hub). Não achei tabela de escala de plantão.

### 4.7 Fornecedores (PJ/MEI)
RH tem `tipo_contratacao='pj'` (e 'extra','estagio','socio') (`002:34-35`). Gestão de Fornecedores usa o catálogo de fornecedores do Omie (`fin_catalogo_fornecedores`) e cria contrato/medição; PJ de RH seria
fornecedor do Omie com `fornecedor_omie_codigo` [V para os dois lados]. Contratos PJ/MEI (seção 10 do pedido: valor, vencimento, aviso ao gestor) **sobrepõem o domínio de contratos do Fornecedores** (`003_frn_contratos.sql`);
decidir onde mora o contrato do PJ é decisão de desenho [H]. Dívida: não li o schema de contratos do Fornecedores a fundo.

### 4.8 Admin / `hub_system_access` (acessos ao entrar e sair: 2.10, 10.12, 11.7)
- Existe: conceder/remover acesso e usuário = **Server Actions do hub** com service role (`app/admin/_actions.ts:204-250` convidar+upsert de acessos, `:174-195` remover usuário, `:311-330` alternar acesso); tabela `hub_system_access (user_email, system_slug, has_access, granted_by…)` e `hub_user_roles (user_email, nivel analista|administrador)`
  (`sdd-sql-admin-usuarios.sql:17-24`). Só leitura para `authenticated` (policy "authenticated read", `sdd-sql-admin-usuarios.sql:64-67`); **escrever fora do hub é proibido** pela regra 4 do RH (`repos/rh/CLAUDE.md:28-30`) e pela história do projeto (RLS aberta até 10/08).
- **Não existe API HTTP do hub para conceder/revogar acesso**; o hub só tem `/api/{frotas,obras,sofia}` [V] `app/api`. Lista de sistemas com slug: `lib/sistemas.ts:7-13` (sofia, dashboard-manutencao, crm, obras, orcamento). Financeiro, Compras, RH, Fornecedores **sem slug** de propósito.
- **Fonte de papéis dispersa** (queixa do José, `docs/cliente/2026-10-14-reuniao-jose-guilherme.md:262`): papéis vivem no admin do hub e em cada módulo (`rh_papeis`, `fin_papeis`, `cmp_papeis`, `orc_papeis`, `sofia_gestores`). Admissão/desligamento que "concede/cancela acessos" teria de tocar vários.
- Casamento: acesso é por **e-mail**; RH não tem e-mail (achado 1). Desligamento (11.7, 10.12): desativar acesso = `hub_system_access.has_access=false` + (opcional) remover usuário; papéis de cada módulo ficam ativos até revogar [H].

### 4.9 Almoxarifado / patrimônio (seção 18)
- **Não existe módulo.** Em código: só o papel `almoxarifado` e o fluxo de estoque dentro do Compras (decidir quanto sai do estoque, checagem de saldo lida do Omie, locais de estoque) [V] `repos/compras/lib/auth/permissoes.ts:1`, `007_cmp_solicitacoes.sql:93-112`, `app/(modulo)/solicitacoes/[numero]/decidir-estoque.tsx`. Estoque vem do **Omie**, não é cadastro interno.
- `docs/cliente/2026-10-14-reuniao-jose-guilherme.md:270,306,314,484`: José diz que fez parte do almoxarifado no Compras, pede ao João aproveitar o contexto, e está em aberto se equipes pedem material "pelo Field" ou pelo sistema.
  `docs/cliente/2026-10-29-sgo-especificacao-eduardo.md:140,144,350`: "Compras e Almoxarifado" como aba/seção e termo de baixa de patrimônio DPSP (patrimônio do **cliente**, não da Manfac). **Nada sobre patrimônio de colaborador (celular, notebook, ferramenta) em código.**
- `rg "almoxarif|patrim"` em `*.ts/*.tsx/*.sql` do hub (fora de manfac-site, sistema-os e worktrees): sem resultado [V]. Itens 2.7.1/2.7.2/2.7.8/2.7.9 e seção 18 do pedido são **domínio novo**.

### 4.10 Resumo "existe hoje" vs "possível"
- **Existe e ligado:** RH→Financeiro (catálogos), RH←→Orçamento (leitura de pessoas/rateio/salário).
- **Existe, mas sem chave comum com o RH:** Frotas (motorista/desconto), Cockpit (técnico), Obras (`obras_pessoa`), Compras (solicitante), acessos do hub, Fornecedores (só via `fornecedor_omie_codigo`).
- **Não existe:** lote/recorrência/provisão no Financeiro, API de acesso no hub, patrimônio, escala, equipe de campo em Obras.

---

## 5. Duplicidades de cadastro de pessoa e chave de casamento

| Sistema | Tabela | Identificadores que tem | Casa com `rh_colaboradores` por |
|---|---|---|---|
| RH | `rh_colaboradores` | **CPF** (único), nome, `fornecedor_omie_codigo` (único parcial), **sem e-mail** | — |
| Hub (conta) | Supabase Auth + `hub_system_access`, `hub_user_roles` | **e-mail** | só se o RH ganhar e-mail |
| Obras | `obras_pessoa` | chave texto, nome, **e-mail** (único), área, função, fone (`sdd-sql-obras-v0.sql:186-213`) | e-mail |
| Frotas | `motoristas` | nome, CNH, contato, equipe_id; **sem CPF/e-mail** (`sdd-sql-passo1.sql:22-30`) | só nome (frágil) |
| Frotas | `equipes` / `sofia_gestores` | código de equipe; gestor por e-mail | e-mail (gestor) |
| Cockpit | `technicians` | id Field (texto), nome, e-mail | e-mail / nome |
| Cockpit | `user_client_access` | e-mail (usuário do hub) × cliente | e-mail |
| CRM | `contacts` (cliente), `memberships`, `crm_user_directory` | e-mail dos membros | e-mail |
| Compras | `cmp_papeis` | e-mail + papel + CC | e-mail |
| Financeiro | `fin_papeis`, `solicitante_email`, `fin_caixinha_pessoas` (VExpenses, com `email_hub` manual) | e-mail; VExpenses por ligação manual (`037_fin_caixinha.sql:1-30`) | e-mail |
| Orçamento | `orc_papeis`, `orc_pef_gestores`, `orc_dir_pessoas.colaborador_id` | e-mail / **id do RH** | já é por `rh_colaboradores.id` |
| Fornecedores | `frn_*` | catálogo Omie (CNPJ/CPF, código Omie) | CPF / `fornecedor_omie_codigo` |

Leitura [H]:
- **CPF é a chave mais forte** (Omie, Financeiro `cpf_novo`, RH). Mas Frotas, Cockpit e Obras **não têm CPF**; só e-mail ou nome.
- **E-mail** é a chave de acesso em todo o hub; o RH não a tem. Adicionar e-mail corporativo ao colaborador seria o elo para acessos, Obras, Cockpit, Compras, Financeiro (papel/solicitante).
- Nome como chave é a pior: Frotas/Cockpit/RH escrevem nome de formas diferentes [H; não comparei dados].
- Quem já usa **id** do RH como referência: apenas Orçamento (`orc_dir_pessoas.colaborador_id`, sem FK).

---

## 6. Perguntas que ficaram sem resposta por não dar para verificar em código (para o coordenador)

1. A folha/VR hoje entra no Omie por qual rotina (digitação no Omie, planilha, solicitação do Financeiro)? Define o que o RH "puxa" e para onde.
2. Quantos colaboradores têm `fornecedor_omie_codigo` preenchido? (dado de produção; não consultei)
3. A tela de cadastros da Frotas oferece o catálogo de departamentos ou texto livre?
4. Os arquivos SQL da Frotas marcados "NÃO APLICADO" (extratos, multa/avaria) já foram aplicados? (A memória do projeto indica pendente de autorização.)
5. O departamento "CC" de obra: um único "DPSP - OBRAS" ou um por obra? (pergunta 2 de `docs/obras/descoberta-integracao-financeiro.md`)
