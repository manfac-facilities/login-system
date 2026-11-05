# RH: descoberta do estado atual (05/11/2026)

Somente leitura. Sem recomendação de fase. Legenda: **[V]** verificado (arquivo/consulta citados), **[NV]** não verificado / suposição.

Caminhos relativos ao clone raso `...\scratchpad\repos\rh` (chamado `rh/`). Rede: `gh pr list`, `git ls-remote`, `gh api .../commits`.

## 0. O push de 04/11 não é trabalho novo

- [V] `main` = `8bf5bd3`, de 21/10/2026 (`gh api repos/manfac-facilities/rh/commits`). Não há commit mais novo.
- [V] 5 PRs, todos do dependabot (next, body-parser, fast-uri, systeminformation); 4 abertos, 1 fechado. O "push de 04/11" é o PR #5 (dependabot, 04/11).
- [V] `ls-remote`: só `main` + 4 branches `dependabot/*`. Não há branch de feature. A árvore da `main` no GitHub é a mesma do clone.
- Conclusão [V]: o clone é o estado completo. Nada foi construído além da fase 1 (+ salário de 19/10).

## 1. O que existe hoje

### 1.1 Rotas/telas [V] (`rh/app/(modulo)/`)
| Rota | Arquivo | O que faz |
|---|---|---|
| `/rh` | `page.tsx` | Lista de colaboradores com filtros busca, departamento, status. Sem papel: texto "você ainda não tem acesso" (`page.tsx:27-35`) |
| `/rh/novo` | `novo/page.tsx` | Novo colaborador (só papel `rh`) |
| `/rh/[id]` | `[id]/page.tsx` | Ficha: edição, rateio por vigência, histórico (auditoria) |
| `/rh/importar` | `importar/page.tsx` | Importa planilha colada |
| `/rh/papeis` | `papeis/page.tsx` | Conceder/revogar papel (só admin do hub: `requireAdmin`, `lib/auth/sessao.ts:50`) |
| `/rh/sem-acesso`, `/rh/api/health` | | utilitárias |

Menu: só "Colaboradores" (+ "Papéis" para admin) (`layout.tsx`).

### 1.2 Papéis [V]
- `rh_papeis.papel in ('rh','diretoria')` (`001_...sql:72`). `rh` = "Controladoria/RH" (`lib/auth/permissoes.ts`).
- `rh`: cria, edita, rateio, importa, vê CPF inteiro e salário. `diretoria`: vê tudo, CPF mascarado, salário visível, não edita. Admin do hub (`hub_user_roles.nivel='administrador'`): vê lista e ficha com CPF mascarado e salário **nulo**; concede/revoga papéis (`001:172-179`, `003:39-46`).
- Papel nunca é apagado: revogar marca `ativo=false` e não volta (`001:114-116`).
- Qualquer pessoa logada com e-mail "entra" (`rh_has_access`), mas sem papel não lê dado.

### 1.3 Server Actions [V]
`salvarColaborador`, `salvarRateio`, `importarColaboradores`, `buscarFornecedores` (`rh/lib/colaboradores/actions.ts`); `concederPapelAction`, `revogarPapelAction` (`rh/lib/papeis/actions.ts`); `signOutAction`. Escrita por RPC com chave de serviço (`repositorio.ts`: `rh_salvar_colaborador`, `rh_salvar_rateio`, `rh_importar`). Leitura por RPC com o token da pessoa (`queries.ts`: `rh_listar_colaboradores`, `rh_obter_colaborador`, `rh_buscar_fornecedor_pf`, `rh_departamentos`; `rh_rateio_em` existe só no banco).

### 1.4 Migrations [V] (`rh/supabase/hub-install/`)
- `001_rh_acesso_papeis.sql`: `rh_papeis`, funções de acesso, 3 policies (todas em `rh_papeis`).
- `002_rh_colaboradores.sql`: `rh_colaboradores`, `rh_colaborador_rateios`, `rh_auditoria`, funções de escrita e leitura.
- `003_rh_salario.sql`: coluna `salario_centavos` + `rh_ve_salario()`.
- Em produção [V consulta, ref `iyytcavcgukfjnjjrerx`, só SELECT em catálogo e contagens]: as 4 tabelas `rh_*` existem; `rh_papeis` tem 8 colunas, `rh_auditoria` 8, `rh_colaborador_rateios` 5, `rh_colaboradores` 14 (cabe: 13 do 002 + salário do 003 = a 003 foi aplicada, pois já há 48 salários).

### 1.5 Tabelas `rh_*` e colunas principais [V migrations]
- `rh_colaboradores` (`002:20-39`, `003:33`): `id`, `cpf` (único, 11 dígitos), `nome`, `cargo`, `tipo_contratacao` (`clt|pj|estagio|extra|socio`, nulável), `admissao`, `desligamento`, `status` (`ativo|desligado|afastado`), `fornecedor_omie_codigo` (bigint, único, liga a fornecedor PF do Omie), `salario_centavos` (bigint mensal, nulo = não informado), `criado_em/por`, `atualizado_em/por`.
- `rh_colaborador_rateios` (`002:49-58`): `colaborador_id`, `vigente_desde` (sempre dia 1), `departamento_omie_codigo` (text, de `fin_catalogo_departamentos`), `percentual numeric(5,2)`; único por (colaborador, vigência, departamento).
- `rh_auditoria` (`002:63-72`): `em, por, tabela, registro, antes jsonb, depois jsonb, motivo`; imutável (trigger bloqueia update/delete, `002:83-97`).
- `rh_papeis` (`001:61-77`).

### 1.6 Contagens em produção [V consulta agregada; nenhum dado de pessoa impresso nem salvo]
- 50 colaboradores, **todos `ativo`**; 24 CLT, 26 PJ; 0 estágio/extra/sócio.
- 48 de 50 com salário; 2 sem.
- 50 de 50 com rateio, cada um com **uma única** data de vigência (nenhuma mudança de rateio ainda).
- 50 com `admissao`; **0 com `desligamento`**.
- **0 com `fornecedor_omie_codigo`** (nenhum ligado ao Omie).
- 3 papéis ativos; 361 linhas de auditoria.

## 2. Cobertura das 18 áreas

Critério: "coberto" = a atividade funciona hoje de ponta a ponta. Um campo solto não é "coberto".

| # | Área | Situação | Prova | O que falta |
|---|---|---|---|---|
| 1 | Recrutamento e seleção | **Não existe** | nenhuma tabela/rota de vaga ou candidato | Tudo: vaga, currículos, entrevistas, decisão. |
| 2 | Admissão | **Parcial (mínimo)** | `rh_colaboradores` (cargo, tipo, admissão, salário) + rateio | Checklist, documentos, ASO, VR, recursos, comunicado, seguro. Só o registro final existe. |
| 3 | Ponto e banco de horas | **Não existe** | nenhuma tabela de ponto/saldo | Marcações, fechamento 25-24, saldo e histórico. |
| 4 | Validação de HE e plantões | **Não existe** | idem | Apontamentos, aprovação do gestor, conferência com ponto/escala. |
| 5 | Levantamento de CLT ativos | **Parcial** | `status`, `tipo_contratacao='clt'`, filtro de status na lista | Filtro por tipo (a lista filtra só busca/departamento/status); sinal de férias; relação mensal fechada. |
| 6 | Folha de pagamento | **Não existe** | só `salario_centavos` base | Competência mensal, movimentações, descontos, FOPAG, contracheque. Salário e rateio são a matéria-prima. |
| 7 | Atestados e afastamentos | **Parcial (só rótulo)** | `status='afastado'` (`002:38`) | Registro de atestado, período, documentos, conferência ponto/folha. Sem datas de afastamento. |
| 8 | Férias | **Não existe** | nenhuma coluna/tabela | Períodos, saldo, vencimento, solicitação, aviso, calendário. |
| 9 | Alterações cadastrais | **Parcial** | edição + `rh_auditoria` com antes/depois/motivo | Solicitação, aprovação, **data de vigência** (só o rateio tem). |
| 10 | Contratos PJ/MEI | **Parcial (só identificação)** | `tipo_contratacao='pj'` (26 pessoas) | Valor contratual, vigência/vencimento, contrato, assinatura, encerramento. |
| 11 | Desligamento e rescisão | **Parcial (só campo)** | `desligamento`, `status='desligado'`, regra desligamento >= admissão (`002:270`) | Fluxo: prévia, descontos, ASO demissional, cancelamento de benefícios/acessos. |
| 12 | Campanhas, comunicados, confraternizações | **Não existe** | nada | Calendário, comunicados, orçamento de eventos. |
| 13 | Seguro de vida | **Não existe** | nenhum campo de segurado | Relação de segurados, movimentação mensal, boleto no Hub. |
| 14 | Acompanhamento de ASOs | **Não existe** | nenhum campo de ASO/exame | Data, validade, clínica, arquivo. |
| 15 | VR/VA | **Não existe** | sem elegibilidade, valor/dia, cartão | Elegibilidade, valor, movimentações, crédito. O rateio já divide por centro de custo. |
| 16 | Ajuda de custo e VT | **Não existe** | nada | Solicitações, provisionamento, boleto no Hub. |
| 17 | Atualizações mensais de controles | **Parcial** | lista de ativos (17.1) | Equipes de campo, **chave PIX**, senhas de portão, escala de plantão. |
| 18 | Controle de patrimônio | **Não existe** | nada | Itens, entrega/devolução, termos, conta de celulares. |

Resumo [V]: 0 áreas cobertas; 7 parciais (2, 5, 7, 9, 10, 11, 17); 11 inexistentes (1, 3, 4, 6, 8, 12, 13, 14, 15, 16, 18).

## 3. Dado do colaborador hoje (o que folha/VR puxam sem digitação)

| Pergunta | Resposta | Prova |
|---|---|---|
| Histórico de salário/vigência? | **Não.** Um único `salario_centavos`, sem vigência. O histórico só existe indiretamente como `antes/depois` em `rh_auditoria` (leitura filtrada por `rh_salario_no_json`). | `003:33`; `002:63-72` |
| Rateio: % ou valor? | **Percentual** `numeric(5,2)`, soma exatamente 100,00, por departamento do Omie, com vigência mensal (dia 1) e histórico (linhas antigas ficam). Valor em reais = salário x % é derivação, não é gravado. | `002:49-58`; `rh_salvar_rateio` `002:394` |
| CLT vs PJ/MEI? | Sim: `clt|pj|estagio|extra|socio`. **MEI não é distinto de PJ.** | `002:36-37` |
| Admissão/desligamento? | Sim, as duas datas. Em prod: admissão 50/50, desligamento 0. | `002:26-27` + consulta |
| Status ativo? | Sim: `ativo|desligado|afastado`. Sem datas de afastamento/retorno. | `002:28,38` |
| Benefícios VR/VA/VT? | **Nenhuma coluna.** | leitura das 3 migrations |
| Chave PIX? | **Não existe.** Há `fornecedor_omie_codigo` (liga a fornecedor PF do Omie); se o cadastro do Omie traz PIX/banco: [NV]. Em prod: 0 de 50 ligados. | `002:29`; consulta |
| ASO? Férias? | **Não existem.** | idem |
| Gestor, e-mail, telefone, banco | **Não existem.** Sem chave para ligar o colaborador ao login do hub (e-mail) ou ao gestor. | `002:20-39` |

O "centro de custo" é o catálogo de departamentos do Omie (`fin_catalogo_departamentos`), só lido (regra 4 do `rh/CLAUDE.md`).

## 4. Lacunas para "lançar folha/VR sem digitar rateio" e riscos de segurança

### 4.1 Lacunas de dado [V, deduzidas das migrations]
1. **Salário sem vigência.** Rateio tem vigência, salário não: reprocessar um mês passado usaria o salário de hoje.
2. **Sem consulta pronta "distribuição do mês M para todos".** `rh_rateio_em(colaborador, mês)` é por colaborador e exige `rh_pode_ver()` com token de pessoa (`002:639-667`). Outro app teria de ler as tabelas com service role ou ganhar função/view nova. O `rh/CLAUDE.md` diz "o módulo de orçamento lê dele", mas isso não está neste repositório [NV como o Orçamento lê].
3. **Sem coluna** para benefícios, PIX, ASO, férias, datas de afastamento, gestor, valor contratual PJ.
4. `tipo_contratacao` aceita NULL (`002:27` sem `not null`). Hoje CLT+PJ = 50, então não há nulos [V consulta de contagem por tipo].
5. 2 de 50 sem salário: qualquer cálculo de folha/VR falharia ou ficaria incompleto nesses dois.
6. 0 colaboradores ligados ao Omie: não há ponte pronta para lançamento por pessoa no Financeiro.
7. Rateio só por departamento: sem dimensão de obra/contrato/frota [NV se o cliente precisa].

### 4.2 Segurança / RLS [V]
- RLS ligada nas 4 tabelas, nunca `force` (consulta `pg_class`). `anon` sem grant algum; `authenticated` só tem INSERT/SELECT/UPDATE em `rh_papeis` (consulta `role_table_grants`). Em `rh_colaboradores`, `rh_colaborador_rateios` e `rh_auditoria` o `authenticated` **não tem grant nem policy**: leitura só pelas funções `security definer`, todas começando por `rh_pode_ver()` (`002:519,582,648,684,729`; `003:284,350`).
- Policies: só 3, todas em `rh_papeis`: insert/update só admin; select admin ou a própria linha (`001:186-197`; consulta `pg_policies`).
- **Quem lê salário:** papel `rh` ou `diretoria` (`rh_ve_salario`, `003:39-46`). Admin do hub sem papel vê a lista mas com salário null, também no histórico (`003:384-385`). Sem papel nem admin: as funções recusam.
- **Quem escreve:** só funções com `grant execute ... to service_role`, que exigem papel `rh` ativo do `p_autor` (`rh_autor_rh`, `002:204-223`). A trava do banco confia no e-mail que o servidor passa (service role não tem token). Bug no servidor que passe o e-mail errado vira escrita em nome de outro [V desenho; testes em `tests/colaboradores-actions.test.ts` não executados].
- Observações:
  - Exceção "sobrescrita de dado" do projeto: `rh_salvar_rateio` apaga a vigência do mês e regrava (`002:328`), com trava de concorrência por `atualizado_em` e auditoria. `rh_importar` não apaga salário quando a linha vem sem salário (`003:182-216`).
  - A auditoria guarda salário e CPF **em claro** no jsonb; a máscara é aplicada só na leitura pelas funções. Quem tem service role ou SQL Editor lê tudo [V desenho].
  - A concessão de papel valida só o formato do e-mail (`001:70-71`), não se existe em `auth.users`: e-mail com erro de digitação vira papel órfão [V].
  - `rh_is_admin` devolve `exists` (nunca NULL), então a guarda fecha em vez de abrir [V `001:29-43`].
- [NV] Funções `rh_*` e seus grants em produção (só tabelas, policies e contagens foram consultadas); outras policies fora das migrations: a consulta de `pg_policies` mostrou só as 3 esperadas.

## 5. Não verificado
- Funções `rh_*` e grants de função em produção.
- Se o app publicado corresponde à `main` de 21/10 (não conferi `Last-Modified`).
- Se Orçamento/Financeiro leem `rh_*` e como.
- Dados bancários/PIX no Omie via `fornecedor_omie_codigo`.
- Testes e build do repositório (não rodados por restrição de máquina).
