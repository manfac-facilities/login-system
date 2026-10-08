# Levantamento técnico — Compras e Financeiro como base da Gestão de Fornecedores (08/10/2026)

Somente leitura. Clones feitos com `gh repo clone` no scratchpad da sessão:
`compras` em `d8c459d`, `financeiro` em `ece0506`. Nenhum `npm install`, nenhum script
rodado, nada escrito em banco ou em repositório remoto.

Convenção: `C:` = repo `compras`, `F:` = repo `financeiro`, `H:` = este repo (hub).
Tudo que não tem prova está marcado como **inferência**.

---

## Resumo do que muda o plano

1. **O Financeiro não guarda a data real de pagamento.** A etapa final de uma solicitação é
   `lancada` (título criado no Omie). A cópia do Omie da programação só guarda título **em
   aberto**; título pago some. `pagamento_data` existe só para regularização. O passo 4 do
   cliente ("registrar a data de pagamento real do Omie") **não tem fonte pronta**.
2. **Não existe porta para outro sistema criar solicitação.** Toda escrita em `fin_*` é por
   funções que só a `service_role` executa, e a função de criação **confia no payload** — prazos,
   emergencial, duplicidade e conferência de catálogo são calculados em TypeScript dentro do app
   Financeiro, não no banco.
3. **Não há corte mensal no Financeiro.** A regra é 17h + 2 dias úteis + janelas seg/qua/sex;
   vencimento antes da primeira janela vira emergencial e vai para o diretor. O "dia 25" do
   cliente é regra nova, do Fornecedores.
4. **A solicitação exige forma de pagamento com código** (boleto/guia/PIX QR exigem código;
   PIX por chave exige chave). Medição não tem isso naturalmente — o formulário de medição vai
   precisar coletar.
5. **Devolução volta para o solicitante**, e só ele reenvia, pela tela do Financeiro.
6. **Compras e Financeiro estão no MESMO projeto `manfac` do EasyPanel** e dividem a mesma
   chave do Omie (bloqueio por "consumo indevido" derruba a chave do app inteira por ~5 min).

---

## A. Esqueleto de app separada (molde: Compras)

### A1. Versões, basePath, output, Docker, scripts — FATOS

| Item | Valor | Prova |
|---|---|---|
| Next | `16.3.5` | C:`package.json:23` (F:`package.json:23` igual) |
| React / React DOM | `19.2.4` | C:`package.json:26-27` (F:`package.json:26`) |
| Node | `node:22-alpine` no Docker; `@types/node ^20`; **sem `.nvmrc` e sem `engines`** | C:`Dockerfile:3,9,29`; C:`package.json:40` |
| `output` | `"standalone"` | C:`next.config.ts:79` |
| `basePath` | vem de `NEXT_PUBLIC_BASE_PATH`, lido **na construção** | C:`next.config.ts:76,80` |
| Build | Dockerfile multi-stage (deps → builder → runner), `npm ci`, `npm run build`, `node server.js` | C:`Dockerfile:3-52` |
| Build args | `NEXT_PUBLIC_APP_URL` (default `https://hub.manfac.com.br/compras`), `NEXT_PUBLIC_BASE_PATH` (`/compras`), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (build falha sem ela) | C:`Dockerfile:17-26` |
| Build quebra sem URL | `next.config.ts` lança erro em produção sem `NEXT_PUBLIC_APP_URL` | C:`next.config.ts:4-6` |
| Server Actions | `allowedOrigins` = host do app; `bodySizeLimit` e `proxyClientMaxBodySize` = `11mb` | C:`next.config.ts:84-92` |
| Headers | HSTS, X-Frame DENY, CSP em **Report-Only** | C:`next.config.ts:49-63` |
| Healthcheck | `wget http://127.0.0.1:${PORT:-3000}${NEXT_PUBLIC_BASE_PATH}/api/health`; rota devolve `ok` sem tocar banco | C:`Dockerfile:47-50`; C:`app/api/health/route.ts:1-9` |
| Scripts | `dev`, `build`, `start`, `check`/`lint` (Biome), `types` (gera tipos do projeto `iyytcavcgukfjnjjrerx`), `test` (Vitest) | C:`package.json:5-14` |
| Testes de SQL | PGlite + teste de segurança do SQL | C:`package.json:38`; C:`tests/hub-install-pglite.test.ts`, `tests/hub-install-safety.test.ts` |

O Financeiro é o mesmo esqueleto: `diff` do Dockerfile, `proxy.ts` e `next.config.ts` só difere
no texto `/compras` ↔ `/financeiro` (F:`Dockerfile:17-18,36`).

### A2. Autenticação — FATOS

- **Sem tela de login própria.** Sem sessão → redireciona para `https://hub.manfac.com.br/login`
  (C:`lib/hub.ts:6-9`; C:`proxy.ts:37-38`; C:`lib/auth/sessao.ts:47`).
- **Porteiro em `proxy.ts`** (Next 16 renomeou middleware), **sem `config.matcher` de
  propósito**; filtra dentro (C:`proxy.ts:11-19`). Deixa passar assets, `/api/health` e
  `POST /api/tarefas/*` (agendador, sem cookie, confere segredo) (C:`lib/auth/porteiro.ts:54-81`).
- **Gap do Next 16:** o endereço exato do basePath (`/compras`) pula o proxy; por isso o
  layout confere a sessão de novo (C:`proxy.ts:16-18`; C:`app/(modulo)/layout.tsx:9-14`).
- **Sessão lida do cookie do Supabase do hub** via `@supabase/ssr` `createServerClient` com a
  anon key; `getClaims()` renova o token (C:`lib/supabase/proxy-session.ts:18-54`). Em produção o
  cookie regravado é `secure`, `sameSite lax`, `httpOnly` (C:`lib/supabase/proxy-session.ts:30-37`).
  O hub não define `domain` nem `cookieOptions` (grep vazio em H:`lib/supabase` e
  H:`middleware.ts`) → cookie padrão do host `hub.manfac.com.br`, path `/`, visível a todas as
  apps sob o mesmo domínio. **Inferência:** é por isso que basePath no mesmo domínio funciona sem
  SSO extra.
- **Quem é o usuário:** `supabase.auth.getUser()`; papéis por RPC `compras_meus_papeis` e
  `compras_is_admin` (C:`lib/auth/sessao.ts:15-42`). Falha ao ler papel = nenhum papel
  (C:`lib/auth/sessao.ts:30-32`).
- **Admin vem de `hub_user_roles`** (`nivel = 'administrador'`) — lido, nunca escrito
  (C:`supabase/hub-install/001_cmp_acesso.sql:21-35`). **Não usa `hub_system_access`**: qualquer
  logado com e-mail entra como solicitante (C:`001_cmp_acesso.sql:40-48`;
  C:`lib/auth/porteiro.ts:5-9,74-81`). O Financeiro é igual (F:`lib/auth/porteiro.ts:6-7`).
- Papéis do módulo ficam em tabela própria `cmp_papeis` (ver A4).

### A3. Variáveis de ambiente (só nomes) — FATOS

Compras (C:`lib/env.ts:9-17`; C:`.env.example`; C:`docs/deploy-easypanel.md:18-48`):
`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_PATH`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CMP_AMBIENTE` (`producao|teste`),
`CMP_CRON_SECRET` (≥32), `OMIE_APP_KEY`, `OMIE_APP_SECRET`; opcionais `SMTP_HOST`, `SMTP_PORTA`,
`SMTP_USUARIO`, `SMTP_SENHA`, `SMTP_REMETENTE`.

Financeiro (F:`lib/env.ts:9-29`): as mesmas com prefixo `FIN_` (`FIN_AMBIENTE`,
`FIN_CRON_SECRET`) + `OMIE_CONTA_CORRENTE`, opcionais `FIN_EXTRATO_CONTA`,
`FIN_PREVISAO_LIBERADA`, e as `SMTP_*`.

Env lida na hora do uso, não no import (build roda sem segredos) (C:`lib/env.ts:4-8,34-37`).
A service role só em arquivo `server-only` (C:`lib/supabase/service.ts:1,11-16`).

### A4. Papéis do módulo e RLS das `cmp_*` — FATOS

**Padrão (vale para o Fornecedores copiar):**
- Tabela de papéis `cmp_papeis` com `ativo`, carimbo de quem concedeu/revogou por trigger, papel
  revogado não volta, sem delete; `gestor` exige `cc_codigo` (C:`002_cmp_papeis.sql:61-135`).
- Funções `security definer` com `set search_path = public, pg_temp` e `set row_security = off`:
  `compras_tem_papel`, `compras_e_gestor_do_cc`, `compras_meus_papeis`
  (C:`002_cmp_papeis.sql:137-193`).
- Policies de `cmp_papeis`: select admin ou dono; insert/update só admin
  (C:`002_cmp_papeis.sql:197-208`).
- **Toda tabela:** `enable row level security`, `revoke all ... from anon, authenticated`, devolve
  **só `select`** (C:`007_cmp_solicitacoes.sql:172-180`). Policy de `cmp_solicitacoes`:
  solicitante, admin, compras, diretor, gestor do CC, almoxarifado em casos específicos
  (C:`007_cmp_solicitacoes.sql:184-193`). Filhas herdam via `exists` na mãe (`:196-210`).
- **Escrita só por funções `cmp_*` com `grant execute ... to service_role`** e revogadas de
  `authenticated` (ex. C:`007_cmp_solicitacoes.sql:329`; lista completa em
  `008`–`015`, ~40 funções). O servidor confere sessão/regra e chama com a chave de serviço.
- Linha do tempo imutável por trigger (C:`007_cmp_solicitacoes.sql:212-229`).
- Regras escritas e travadas por teste: prefixo, `revoke`, policies com `(select fn())`,
  **nunca escrever em `fin_*`, `hub_*`, `obras_*`**, corpo de função não chama função de outro
  módulo (C:`supabase/hub-install/README.md:15-46`; C:`CLAUDE.md:257-266`).

Migrations do Compras (todas em C:`supabase/hub-install/`, aplicadas à mão no SQL Editor, só o
arquivo novo — C:`README.md:6-13`): `001_cmp_acesso`, `002_cmp_papeis`, `003_cmp_configuracoes`,
`004_cmp_catalogo`, `005_cmp_agendador_catalogo`, `006_cmp_conta_existe`, `007_cmp_solicitacoes`,
`008_cmp_mapa_aprovacoes`, `009_cmp_sla_lembretes`, `010_cmp_pedidos_omie`,
`011_cmp_produto_anexo`, `012_cmp_pos_pedido`, `013_cmp_ajustes_pos_pedido`,
`014_cmp_recorrente`, `015_cmp_recorrente_ajustes`.

Policies (`create policy`): `cmp_papeis_{select,insert,update}`, `cmp_configuracoes_{select,insert}`
(003:68,72), `cmp_catalogo_{fornecedores,produtos,departamentos,categorias,locais_estoque}_select`,
`cmp_sincronizacoes_select` (004:110-130), `cmp_solicitacoes_select`,
`cmp_solicitacao_itens_select`, `cmp_estoque_checagens_select`, `cmp_anexos_select`,
`cmp_eventos_select` (007:184-208), `cmp_mapas_select`, `cmp_mapa_{fornecedores,precos,escolhas}_select`
(008:99-111), `cmp_catalogo_parcelas_select`, `cmp_pedidos_select` (010:48,82),
`cmp_modelos_select`, `cmp_modelo_itens_select` (014:67-69). `cmp_contadores`, `cmp_avisos`,
`cmp_lembretes_*` têm RLS sem policy = fechadas para logado.

Agendador: `pg_cron` + `pg_net` chamando `POST /compras/api/tarefas/*` com Bearer lido do
`vault` (C:`005_cmp_agendador_catalogo.sql:15-28`); a rota responde 202 e trabalha em `after()`
(C:`app/api/tarefas/pedidos/route.ts:13-25`). Minutos escolhidos para não colidir com o
Financeiro (17) (C:`005_cmp_agendador_catalogo.sql:11`).

### A5. Omie no Compras — FATOS

- Cliente HTTP próprio, server-side, `https://app.omie.com.br/api/v1`, com tratamento de erro
  500-como-negócio, lista vazia, limite e "sem resposta" (C:`lib/omie/cliente.ts:1-120`).
  Credenciais: `OMIE_APP_KEY`, `OMIE_APP_SECRET` (C:`lib/env.ts:15-16`), **a mesma chave do
  Financeiro** por decisão (C:`docs/superpowers/specs/2026-10-05-compras-design.md:553`;
  C:`docs/deploy-easypanel.md:34`).
- **Bloqueio por consumo indevido trava a chave do app inteiro por ~5 min**, medido em 25/09
  (C:`lib/omie/cliente.ts:84-93`).
- **Cadastro de fornecedor:** catálogo sincronizado de hora em hora (`ListarClientes` etc.); busca
  ao vivo por CNPJ (`ListarClientes` com `clientesFiltro.cnpj_cpf`) (C:`lib/fornecedores/omie.ts:17-40`);
  consulta à Receita/BrasilAPI (C:`lib/fornecedores/actions.ts:45-66`). Fornecedor novo é
  **criado no Omie na hora de gerar o pedido**: `ConsultarCliente` por código de integração →
  busca por documento → `IncluirCliente` com tag `Fornecedor` (C:`lib/pedidos/omie.ts:113-180`).
- **Pedido de compra:** `IncluirPedCompra` (C:`lib/pedidos/omie.ts:319`; montagem em
  C:`lib/pedidos/montar.ts:106-113`), também `IncluirProduto`, `IncluirAnexo`,
  `ConsultarPedCompra`. Roda em fila com retomada por `pg_cron` a cada 5 min
  (C:`app/api/tarefas/pedidos/route.ts:9-12`).
- Regra do repo: escrita no Omie de produção só com autorização do Jose Guilherme na hora
  (C:`CLAUDE.md:269-270`).

---

## B. Financeiro — ponto de integração

### B1. Tabelas `fin_*` e fluxo de status — FATOS

Principais (F:`supabase/hub-install/`):
- `fin_solicitacoes` (006:32-92, + colunas do 016:28-38): `ambiente`, `numero` (contador por
  ambiente), `etapa`, `solicitante_email/nome`, `fornecedor_origem` (`catalogo|cnpj_novo|cpf_novo`),
  `fornecedor_codigo_omie`, `fornecedor_documento`, razão social/fantasia, `fornecedor_novo`
  (jsonb), `forma_pagamento` (`boleto|guia|pix_chave|pix_qrcode`), `codigo_pagamento`,
  `pix_recebedor`, `valor_centavos`, `vencimento`, `categoria_*`, `tipo_documento_*`,
  `numero_documento`, `descricao`, `rateio_modo`, `emergencial*`, `enviado_em`,
  `dia_referencia`, `data_minima`, `primeira_janela`, `etiquetas`, `codigo_lancamento_omie`,
  `atualizado_em`; desde o 016: `tipo` (`pagamento|regularizacao`), `emissao`, `extrato_*`,
  `pagamento_data`, `baixa_*`.
- `fin_solicitacao_rateio` (006:102-111): departamento (centro de custo), percentual, valor;
  soma tem de fechar 100% e o valor (006:282-289).
- `fin_anexos` (006:115-127): PDF/JPEG/PNG até 10 MB, bucket privado, `omie_situacao`.
- `fin_eventos` (006:133-151): linha do tempo imutável (006:204-221).
- `fin_solicitacao_chaves_pix` (006:157-165): sem leitura para logado (006:173-179).
- `fin_lancamento_tarefas` (009:28), `fin_avisos` (008:19), `fin_papeis` (002:6, papéis
  `financeiro` e `diretor`), catálogo `fin_catalogo_{fornecedores,categorias,departamentos,tipos_documento}`
  (003), programação: `fin_titulos_omie`, `fin_movimentos_omie`, `fin_extrato*`,
  `fin_saldo_inicial` (014), `fin_programacao_parametros`, `fin_entradas_previstas` (018),
  `fin_programacao_mudancas` (019), `fin_pagamentos_marcados` (020).

Etapas (F:`006_fin_solicitacoes.sql:36-39`; F:`lib/solicitacoes/etapas.ts:9-41`):

```
envio ─┬─ emergencial ─► aguardando_diretor ─(aprovar)─► aguardando_financeiro
       └─ normal ──────────────────────────────────────► aguardando_financeiro
aguardando_financeiro ─(validar)─► lancando ─► lancada            (final)
                                           └─► falha_lancamento ─(tentar de novo)─► lancando
diretor/financeiro ─(devolver)─► devolvida ─(solicitante reenvia)─► ...
financeiro ─(recusar)─► recusada (final) ; solicitante ─(cancelar)─► cancelada (final)
```
Provas: etapa inicial (006:249); aprovar diretor → `aguardando_financeiro` (008:102); devolver
(008:149); recusar (008:191); validar → `lancando` (008:235); lançado → `lancada` +
`codigo_lancamento_omie` (009:312); falha (009:403); tentar de novo (009:462). Etapas finais:
`recusada`, `cancelada`, `lancada` (F:`lib/solicitacoes/etapas.ts:41`).

**Não existe etapa "paga".** O fim do fluxo é o título existir no Omie.

### B2. Como a solicitação é criada hoje — FATOS

- Server action `enviarSolicitacaoAction` (F:`lib/solicitacoes/actions.ts:64-118`):
  `requireSessao()` → Zod (`solicitacaoFormSchema`) → carrega catálogo com a **chave de serviço**
  (fornecedor, categoria ativa, tipo de documento ativo, departamentos) → reconsulta Receita se CNPJ
  novo → `interpretarEnvio` (prazos com o relógio do servidor) → `procurarDuplicadas` →
  `montarPayload` → RPC `fin_criar_solicitacao` (F:`lib/solicitacoes/repositorio.ts:138`) →
  e-mails em `after()`.
- **Quem pode criar:** qualquer pessoa logada no hub (F:`lib/auth/porteiro.ts:6-7`); o solicitante
  é o e-mail da sessão (F:`lib/solicitacoes/actions.ts:89`).
- **Campos obrigatórios** (F:`lib/solicitacoes/schemas.ts:19-121`): fornecedor (do catálogo por
  `codigoOmie`, ou CNPJ novo com razão social, ou CPF novo com nome); forma de pagamento;
  **código de pagamento** validado conforme a forma (`:100-101`); chave PIX se `pix_chave` com
  fornecedor novo (`:103-106`); valor; vencimento; categoria; tipo de documento; descrição
  (5–500); rateio com 1–20 centros de custo fechando o valor (`:62-72,107-110`); justificativa se
  emergencial manual (`:114-120`). No banco, `codigo_pagamento` nulo ⇔ `pix_chave`
  (F:`016_fin_regularizacao.sql:54-57`).
- **Fornecedor Omie:** do catálogo `fin_catalogo_fornecedores`, ou novo — cadastrado no Omie
  durante o lançamento (spec, F:`docs/superpowers/specs/2026-09-14-financeiro-solicitacao-pagamentos-design.md:376-402`).
- **Centro de custo:** é o rateio por `departamento_codigo` do Omie (006:102-111).
- **Anexos/NF:** opcionais; sobem um a um depois de criada (F:`app/(modulo)/solicitacoes/nova/nova-solicitacao-form.tsx:210`),
  por `anexarArquivoAction` + `fin_registrar_anexo` (F:`lib/anexos/actions.ts:23-55`), bucket
  privado `financeiro-anexos`, sem policy em storage (006:17-18). Só o solicitante anexa, e só nas
  etapas abertas (F:`lib/solicitacoes/etapas.ts:65,71`).
- **Vencimento:** livre, mas define emergencial (ver B5).
- **Devolução:** só o solicitante reenvia, pela tela (F:`lib/solicitacoes/etapas.ts:72`;
  F:`lib/solicitacoes/actions.ts:164-182`).
- **No Omie:** título com `codigo_lancamento_integracao = HUBFIN-<nº>`, `data_vencimento` e
  `data_previsao` = vencimento (F:`lib/lancamento/titulo.ts:162-171`).

### B3. Data real de pagamento — FATOS

- **Não há webhook nem coluna para isso em pagamento comum.** `pagamento_data` só vale para
  `tipo = 'regularizacao'`, e o check proíbe preenchê-la em pagamento comum
  (F:`016_fin_regularizacao.sql:42-52`).
- A programação copia do Omie a cada 15 min (F:`015_fin_agendador_programacao.sql:20`) via
  `ListarContasPagar` (F:`lib/programacao/sincronizar.ts:66`), mas **só título em aberto**
  (`ATRASADO`, `A VENCER`, `VENCE HOJE`); os demais são descartados
  (F:`lib/programacao/mapear.ts:3-7,84-92`). Título pago sai da cópia.
- `fin_pagamentos_marcados` é um lembrete "paguei hoje" feito à mão, não muda o Omie e não é
  data confirmada (F:`020_fin_pagamentos_marcados.sql:4-5,14-23`).
- **Inferência:** para ter a data real, alguém precisa consultar o Omie pelo
  `HUBFIN-<nº>` (`ConsultarContaPagar`) ou ler `ListarContasPagar` incluindo pagos, e gravar.
  O formato do campo de data de pagamento no retorno do Omie **não foi medido** em nenhum dos repos.

### B4. Outro sistema criando solicitação — FATOS + análise

**Hoje não existe** API, rota ou função aberta para isso:
- `fin_criar_solicitacao` só `service_role` executa (F:`006:309-310`); `authenticated` só tem
  `select` nas tabelas (F:`006:173-179`; F:`007_fin_limpeza_privilegios.sql:24-26`).
- A função **não valida** prazos, emergencial, catálogo nem duplicidade: grava o que vier, só
  confere ambiente, rateio e chave PIX (F:`006:226-307`). Essas regras moram no TypeScript do
  Financeiro (F:`lib/solicitacoes/actions.ts:76-91`; `preparar.ts:150,232,281`;
  `prazos.ts:85-98`).
- Regra escrita do Financeiro: solicitação só é gravada pelas funções do 006/008 "depois de o
  servidor conferir sessão e regras" (F:`CLAUDE.md:28-32`). Regra escrita do Compras: nunca
  escrever em `fin_*` (C:`CLAUDE.md:257-261`).
- Não há nenhum acoplamento hoje entre Compras e Financeiro (grep de `fin_`/`cmp_` cruzado vazio).

Opções (análise, não implementada):

| Opção | Prós | Contras |
|---|---|---|
| **1. Fornecedores chama `fin_criar_solicitacao` (ou insere em `fin_*`) com service role** | Zero mudança e zero deploy no Financeiro | Duplica no Fornecedores as regras de prazo/emergencial/duplicidade/catálogo; se o Financeiro mudar, diverge em silêncio; viola as regras escritas dos dois repos; insert direto nem tem contador/evento — **não recomendável** |
| **2. Nova função SQL `fin_criar_solicitacao_de_medicao` no Financeiro (`security definer` ou só `service_role`)** | Contrato no banco, versionado no repo do Financeiro | Regras de prazo estão em TS, não em SQL: ou reescreve em PL/pgSQL (duplicação) ou a função continua confiando no chamador; muda schema de dinheiro (território de exceção do AGENTS.md) |
| **3. Rota no Financeiro (`POST /financeiro/api/integracoes/medicoes`) com segredo de serviço, que reusa `interpretarEnvio`/`montarPayload`/`gravarSolicitacao`** | Uma única implementação das regras; o Financeiro continua dono de `fin_*`; auditável | Exige mudança + deploy do Financeiro; acopla o Fornecedores à disponibilidade dele (precisa fila/retentativa); autenticação entre apps a definir |
| 3b. Variante: Fornecedores grava "medição aprovada" numa tabela `forn_*`, e o **Financeiro puxa** (agendador) e cria a solicitação | Nenhuma escrita cruzada; falha do Financeiro não perde a medição | Mesmo deploy no Financeiro; latência do agendador |

**Inferência / recomendação:** 3 ou 3b. O que o cliente quer (seguir "todo o fluxo" do
Financeiro) só fica garantido se a criação passar pelo código que o Financeiro já usa. Para a
volta da data de pagamento, o mais barato é o Financeiro (que já fala com o Omie e já tem
agendador) passar a gravar a data de pagamento nas solicitações `lancada`, e o Fornecedores só
**ler** (select com policy ou função de leitura). Sobra decidir **quem é o solicitante** gravado
(Eduardo? quem abriu a medição? um e-mail de sistema?) — isso define quem recebe devolução e quem
pode reenviar/anexar.

### B5. Regra de corte de data — FATOS

- Não existe corte mensal. A regra é: envio em dia útil até 17h00 conta no dia; depois, próximo
  dia útil; data mínima = +2 dias úteis; primeira janela de pagamento = seg/qua/sex a partir da
  mínima; feriado conta como dia útil (F:`lib/solicitacoes/prazos.ts:1-5,18-22,78-98`; decisão 5
  do spec F:`docs/superpowers/specs/2026-09-14-financeiro-solicitacao-pagamentos-design.md:109`).
- Vencimento antes da primeira janela = **emergencial automático** → vai para `aguardando_diretor`
  (F:`prazos.ts:95`; F:`006:249`).
- **Inferência:** o "até dia 25" é regra do Fornecedores (abrir medição). Se a medição gerar
  vencimento curto, cai como emergencial no Financeiro — o vencimento que o Fornecedores calcula
  precisa respeitar a primeira janela para não inundar o diretor.

---

## C. Deploy

### FATOS
- EasyPanel: serviço App, fonte GitHub branch `main`, build por **Dockerfile** (nunca upload .zip)
  (C:`docs/deploy-easypanel.md:5-10`).
- Todas as variáveis vão na aba Environment (não há campo de build args); as `NEXT_PUBLIC_*`
  ficam gravadas no JS (C:`docs/deploy-easypanel.md:12-23`; C:`Dockerfile:14-16`).
- **Domínio:** host `hub.manfac.com.br`, caminho `/compras`, destino **porta 80** (EasyPanel
  injeta `PORT=80`), caminho de destino também `/compras` (sem remover prefixo)
  (C:`docs/deploy-easypanel.md:59-62`; F:`docs/deploy-easypanel.md:62-65`). Medido em 06/10:
  HTTPS ligado no domínio, **protocolo de destino HTTP**; com destino HTTPS o roteador devolve 500;
  **sem HTTPS no domínio, `/compras` cai no portal do hub** (C:`docs/deploy-easypanel.md:146`).
- Healthcheck no Dockerfile em `${BASE_PATH}/api/health` (C:`Dockerfile:47-50`).
- Agendador: segredos no `vault` + `cron.schedule` aplicado à mão depois do app responder
  (C:`docs/deploy-easypanel.md:69-81`). A tabela `net._http_response` é compartilhada com Cockpit
  e Financeiro (C:`docs/deploy-easypanel.md:122`).
- Conferência pós-deploy inclui ver o Cockpit saudável (`v_sync_health`) (C:`docs/deploy-easypanel.md:140,153`).
- Compras, Financeiro, hub, CRM, Cockpit e site estão **todos no mesmo projeto `manfac`** do
  EasyPanel (H:`docs/infra/variaveis-e-deploy.md:12-19`). O pedido do cliente é "um projeto
  próprio no easy panel" (H:`docs/cliente/2026-10-07-gestao-de-fornecedores.md:5`).

### Por que um deploy afetaria outro — o que os repos indicam

Nenhum repo registra um incidente específico de "deploy de A derrubou B". Pontos de acoplamento
que existem de fato:
1. **Mesmo domínio por caminho:** cada app é uma regra de caminho do roteador do EasyPanel em
   `hub.manfac.com.br`. Regra mal configurada (HTTPS desligado no domínio do caminho) faz o caminho
   cair no hub (C:`docs/deploy-easypanel.md:146`). **Inferência:** mexer no domínio de um app pode
   reordenar/sobrepor regras do mesmo host e afetar os vizinhos.
2. **Mesma chave do Omie** para Compras e Financeiro; excesso bloqueia a chave inteira por ~5 min
   (C:`lib/omie/cliente.ts:84-93`). Um terceiro consumidor (Fornecedores consultando data de
   pagamento) aumenta esse risco.
3. **Mesmo banco**, migrations manuais, `pg_cron`/`pg_net` compartilhados com o Cockpit — daí as
   regras "nunca drop extension" e a conferência do Cockpit após cada SQL (C:`CLAUDE.md:257-261`;
   C:`supabase/hub-install/README.md:10-13`).
4. **Mesmo cookie de sessão** (host `hub.manfac.com.br`, path `/`) renovado por todas as apps.
   **Inferência, não verificada:** rotação do refresh token por apps diferentes ao mesmo tempo pode
   deslogar usuário; não há registro disso nos repos.
5. **Inferência:** o mesmo VPS constrói e roda tudo; `npm ci` + `next build` de um app consome
   CPU/memória do servidor que serve os outros. "Projeto próprio" no EasyPanel é agrupamento
   lógico — se for o mesmo servidor, **não isola recursos nem o roteador**.

---

## O que NÃO consegui verificar

- Configuração real do EasyPanel (domínios, regras de caminho, recursos do VPS, se "projeto
  próprio" usa outro servidor) — sem acesso ao painel.
- Se as migrations do Financeiro `001`–`022` e do Compras `001`–`015` estão todas aplicadas em
  produção — não consultei o banco (proibido escrever; leitura não foi pedida).
- Formato e nome do campo de data de pagamento no retorno do Omie (`ConsultarContaPagar` /
  `ListarContasPagar` para título pago) — nenhum repo mediu.
- Se o Omie aceita/retorna o título lançado pelo hub com o `HUBFIN-<nº>` depois de pago (só
  inferido pelo padrão de código de integração).
- A causa real do "deploy de um sistema acaba afetando outros" relatado pelo cliente — nenhum
  documento dos repos registra o incidente.
- O conteúdo completo de `interpretarEnvio`/`montarPayload` (F:`lib/solicitacoes/preparar.ts`)
  e da tela do Compras de pós-pedido; li só as assinaturas e o uso.
