# Plano de implementação — melhorias do Gestão de Fornecedores (outubro/2026)

**Spec:** `docs/fornecedores/spec-melhorias-2026-10.md` (revisada; decisões D1–D5 fechadas em 13/10). Toda
referência "§x" abaixo é da spec. **Repo:** `manfac-facilities/fornecedores`, base `main` = `017e0d9`.

---

## 1. Ambiente dos executores

- Um clone por frente em `D:\fornecedores-work\melh-<frente>` (o disco C está cheio). Nunca instalar nada em C:.
- npm com cache em D:
  ```bash
  cd /d/fornecedores-work/melh-<frente>
  npm ci --cache /d/fornecedores-work/npm-cache --prefer-offline
  ```
- Comandos de verificação (os mesmos do CI, `.github/workflows/ci.yml`):
  ```bash
  npm run lint
  npx tsc --noEmit
  npx vitest run <arquivos da frente>          # durante o TDD
  npx vitest run --no-file-parallelism         # antes de abrir o PR
  ```
- **Se a máquina não aguentar** (pglite/build pesados): fazer push do branch e ler o resultado do GitHub Actions
  (`gh run watch` / `gh run view --log-failed`). O CI roda lint, tsc, vitest e build em todo push.
- Doc do Next 16.3.5 instalada: `D:\fornecedores-work\backlog-fornecedores\node_modules\next\dist\docs\` (o clone
  novo terá a sua depois do `npm ci`). Ler antes de usar API do Next que não esteja no código atual.
- Nada de banco de produção nas frentes. Testes de SQL rodam no pglite (`tests/sql/apoio.ts` instala
  `supabase/hub-install/*` inteiro, em ordem).

## 2. Branches

```
main (017e0d9)
 └─ feat/melhorias                 ← integração; PR final para main
     ├─ feat/melhorias-0-contratos  (Frente 0; entra primeiro)
     ├─ feat/melhorias-a-banco
     ├─ feat/melhorias-b-condicoes
     ├─ feat/melhorias-c-lista
     ├─ feat/melhorias-d-ficha
     ├─ feat/melhorias-e-aprovacoes
     ├─ feat/melhorias-f-modelo
     ├─ feat/melhorias-g-configuracoes
     └─ feat/melhorias-h-email
```

Criar a base: `git switch -c feat/melhorias 017e0d9 && git push -u origin feat/melhorias`. As frentes A–H saem
de `feat/melhorias` **depois** do merge da Frente 0. Cada frente abre PR para `feat/melhorias`. Commits com a
atribuição pedida pela sessão.

## 3. Frentes

Regra: **cada arquivo tem um dono só**. Se uma frente precisar mexer num arquivo de outra, para e avisa o
coordenador. Toda frente segue TDD: escrever o teste, ver falhar, implementar, ver passar, refatorar.

### Frente 0 — contratos compartilhados (sequencial, antes de tudo)

**Arquivos (exclusivos):** `lib/regras/etapa.ts` (novo), `lib/regras/condicoes.ts`, `lib/tipos.ts`,
`lib/tipos-db.ts`, `components/ui/pill.tsx`, `lib/auth/papeis.ts`, `lib/condicoes/servidor.ts` (novo),
`app/(modulo)/contratos/[numero]/_ficha/tipos.ts` (novo), `tests/condicoes/servidor.test.ts` (novo),
`tests/regras/etapa.test.ts` (novo), `tests/regras/condicoes.test.ts`, `tests/ui/componentes.test.tsx`,
`tests/porteiro.test.ts` (só se `lerPapeis` quebrar algo ali).

**Passos:**
1. Teste de `etapaDoContrato` para as 8 etapas (§1.3), `rotuloEtapa`, `corEtapa`, `desdeDaEtapa` → implementar.
2. Teste de `condicaoDaVersao(versao, parcelasAjustadas)` (com e sem ajuste; ajuste de tamanho errado lança) e de
   `exigeJustificativa(modo)` → implementar em `condicoes.ts`. `condicaoPorCodigo` ganha `catalogo` (padrão
   `CONDICOES` para não quebrar chamadores até as frentes trocarem). `CONDICOES` intocado (paridade com o seed v1).
3. `lib/tipos.ts`: `condicoes_alteradas` em `EVENTO_TIPOS`; `lib/tipos-db.ts`: colunas novas da §2 (009–012).
4. `PillEtapa` em `pill.tsx` + teste de componente.
5. `lerPapeis`: `frn_sou_admin()` no lugar de `frn_e_admin` (`lib/auth/papeis.ts:27`), papel `configurador`,
   `podeConfigurar`, `veConfiguracoes`; teste com fake de Supabase (admin vira true; erro = tudo false).
6. `lib/tipos.ts`: só os **tipos** do aviso (`EventoAvisoContrato`, `EventoAvisoAditivo`, `AvisarContrato`,
   `AvisarAditivo`). A porta `lib/avisos/porta.ts` é da Frente H.
6a. `lib/condicoes/servidor.ts`: `carregarCatalogo(supabase)`, `versoesDe(supabase, pares)` e
   `condicaoDoContrato(linha)` (lê a versão pinada + `parcelas_ajustadas` via `condicaoDaVersao`); teste com fake.
6b. `_ficha/tipos.ts`: `FichaDados` e `Ficha` com os campos novos (etapa, condição pinada, `parcelasAjustadas`,
   `modeloVersao`), movidos de `_ficha/calculo.ts:32-84` sem mudar os campos de hoje.
7. `npm run lint && npx tsc --noEmit && npx vitest run --no-file-parallelism`.

**Fecha:** CA-C1 (parte TS), base de CA-E1. **Revisão:** coordenador confere as assinaturas antes do merge (são o
contrato das outras frentes).

### Frente A — banco (009–012 + testes de SQL)

**Arquivos:** `supabase/hub-install/{009_frn_condicoes_versoes,010_frn_fluxo_em_ordem,011_frn_modelo_contrato,
012_frn_avisos}.sql` (novos), `supabase/rollback/009-012-ROLLBACK.sql` (novo), `tests/sql/*` (inclusive
`stubs/` e `versao-antiga/` se a reaplicação precisar), `tests/casos-regras.json`.

**Passos (um arquivo por vez, nesta ordem):**
1. Fixture no pglite que reproduz o CT-0001 de produção (aguardando, global/manutenção, `OBRA_MEDICAO_MENSAL`,
   José aprovou condições, Eduardo não, fornecedor homologado, 3 eventos) — usada em CA-B14 e CA-M2.
2. **009**: testes de CA-E2, E3 (SQL), E4–E9, B5 (parte de `frn_parcelas_mo`), B11, B13, B10 (configurador) e as
   verificações → escrever a 009 com a ordem tabela/coluna → preenchimento → constraints (§2 "Regras de escrita").
3. **010**: testes de CA-B1–B4, B6–B9, B12, B14, paridade `frn_etapa` × `etapaDoContrato` (C1) → escrever a 010.
   Ajustar `contratos.test.ts:335` ("qualquer ordem" vira "em ordem") e `:404`.
4. **011**: CA-E11, E12 (SQL) → escrever. **012**: grants/RLS de `frn_avisos` → escrever.
5. `paridade.test.ts`: `frn_parcelas_mo` com `parcelas_ajustadas` = espelho TS (`lib/regras/parcelas.ts` da B —
   a paridade é conferida no merge, na integração).
6. `instalacao.test.ts` (contagem de linhas OK das verificações), `reaplicacao.test.ts` (rodar 001→012 duas vezes
   e sobre `versao-antiga/`), `rls.test.ts` (tabelas novas: `authenticated` só SELECT onde há policy;
   `frn_avisos` sem nada).
7. Rollback: script que recria `frn_aprovar_contrato`, `frn_devolver_contrato`, `frn_enviar_contrato`,
   `frn_aprovar_aditivo`, `frn_devolver_aditivo`, `frn_criar_aditivo`, `frn_salvar_contrato`, `frn_parcelas_mo`,
   `frn_solicitar_medicao`, `frn_registrar_solicitacao_fin`, `frn_registrar_atendimento`, `frn_registrar_documento`,
   `frn_tem_algum_papel` e `frn_dias_pagamento(text,int)` com os corpos de `005`/`008` e dropa as funções novas.
   **Não** dropa tabelas nem colunas (dados de versão podem já existir). Testado no pglite: 001→012→rollback e o
   conjunto de testes de antes passa.
8. `npx vitest run tests/sql --no-file-parallelism` (pesado: preferir o CI).

**Fecha:** CA-B1–B14 (SQL), CA-C1 (SQL), CA-E2–E9, E11, E12 (SQL), CA-M2, CA-M3 (SQL).

### Frente B — catálogo versionado no app + integração Financeiro

**Arquivos:** `lib/regras/parcelas.ts`, `lib/regras/aditivo.ts`,
`lib/integracoes/financeiro.ts`, `app/(modulo)/contratos/novo/{_catalogo.ts,_contrato.ts,_condicao.tsx,_form.tsx,
_ler.ts,_actions.ts,page.tsx}`, `app/(modulo)/contratos/[numero]/_ficha/{calculo.ts,dados.ts,_actions.ts,
acoes.tsx}`, `app/(modulo)/medicoes/_dados.ts`, testes `tests/regras/{parcelas,aditivo}.test.ts`,
`tests/contratos/{form,actions}.test.ts`, `tests/ficha/*`, `tests/medicoes/*`, `tests/integracoes/financeiro.test.ts`.

**Passos:**
1. **B1 primeiro** (dinheiro): teste em `tests/integracoes/financeiro.test.ts` — medição na versão 1 com
   `dias_pagamento` 7, catálogo atual com 15 → `diasPagamento` = 7. Trocar o select de `carregarMedicaoDoBanco`
   (`lib/integracoes/financeiro.ts:456`) para a versão pinada pela FK composta
   (`condicao:frn_condicoes_versoes!<fk>(dias_pagamento, modo)`; se o embed composto não funcionar, select separado
   por `(codigo, versao)`). Rodar todos os testes de integração.
2. `parcelasMo` com `parcelasAjustadas` (teste: ajuste usado; tamanho errado lança, igual ao SQL).
3. Usar `lib/condicoes/servidor.ts` (da Frente 0) em todos os pontos abaixo; `_ficha/calculo.ts` importa os tipos
   de `_ficha/tipos.ts` (da Frente 0).
4. Novo contrato: catálogo por prop (`_catalogo.ts` → `page.tsx` → `_form.tsx`); `condicoesPermitidas` e
   `condicaoEfetiva` com catálogo e sugestão não permitida → `null` (CA-E6 TS); campos de exceção e tabela pelo
   **modo** (troca das constantes `EXCECAO`/`TABELA_FIXA`, `_contrato.ts:17-18`, `_form.tsx:421,468`).
5. Ficha `_ficha/*`: condição da versão pinada; `condicoesParaAditivo` do catálogo; validação de `para` contra o
   catálogo (`_ficha/_actions.ts:92`).
6. `medicoes/_dados.ts`: condição da versão do contrato (`:85-92`). Testes de medição de hoje passam sem mudar
   expectativa (CA-M3).
7. E-mails: `after(() => avisarContrato("enviado", id))` em `enviarParaAprovacaoAction` e
   `after(() => avisarAditivo("aditivo_pedido", id))` na ação de pedir aditivo, importando de `lib/avisos/porta.ts`
   (da H). **Último passo**, depois de atualizar o branch com o `feat/melhorias` que já tem a H.
   Teste: a action chama a porta depois do sucesso e não chama no erro.

**Fecha:** CA-E3 (TS), E4 (TS), E6 (TS), CA-M3 (TS), parte de CA-D3.

### Frente C — lista: busca e etapa

**Arquivos:** `app/(modulo)/contratos/{page.tsx,_lista.ts,_busca.tsx}`, `tests/contratos/lista.test.ts`.

**Passos:** testes de `casaBusca` (CA-A1–A3), `filtrarLinhas` com `q` e chip Devolvido (A4, A6, A7), contagem →
implementar em `_lista.ts`; select da página com `q`, `condicao_versao`, `parcelas_ajustadas` e a versão embutida;
parcelas atrasadas via `condicaoDaVersao`; `_busca.tsx` (cliente, `router.replace` com 300 ms; ler a doc de
`useRouter` do Next 16 antes); estados vazios do mockup (A5); coluna Status com `PillEtapa`; destaque `<mark>`.

**Fecha:** CA-A1–A7, CA-C2 (lista).

### Frente D — ficha: etapa atual e linha do tempo

**Arquivos:** `app/(modulo)/contratos/[numero]/page.tsx`, `lib/eventos/linha-do-tempo.ts`,
`components/ui/linha-do-tempo.tsx`, `tests/eventos/linha-do-tempo.test.ts`.

**Passos:** teste do item "agora" por etapa e ausência em aprovado (CA-C3) → implementar; caixa "Etapa atual" com
barra de etapas, "desde" e botão por papel (§1.3 item 2); banner de reenvio; box de aditivos; troca de
`=== "SPOT_MENSAL_CONSOLIDADO"` (`page.tsx:358`) pelo modo da versão; cor de `condicoes_alteradas`.

**Fecha:** CA-C2 (ficha), CA-C3.

### Frente E — aprovações em ordem e José alterando

**Arquivos:** `app/(modulo)/aprovacoes/{page.tsx,_cartao.tsx,_actions.ts,_editor-condicao.tsx}`,
`app/(modulo)/aprovacoes/_lib/{cartoes.ts,permissoes.ts,servidor.ts,dados.ts,linhas.ts,condicao.ts}`,
`tests/aprovacoes/*`. **Não** toca `app/(modulo)/layout.tsx`; mantém `montarCartoes(d, papeis)` e
`carregarAprovacoes(supabase)` com a mesma assinatura.

**Passos:**
1. `cartoes.ts`: `pode` respeita a etapa (José só com contratação aprovada; aditivo de valor idem); seções "Com
   você"/"Em andamento"; testes (CA-B1 TS, B10 TS, B11 TS).
2. Editor da condição (puro + componente): opções permitidas + a atual; % (soma 100, 1–100), exceção (0–120 +
   justificativa), diff Antes/Depois, validação que desabilita o botão; testes.
3. `alterarEAprovarCondicoesAction`: sessão → Zod → papel → `frn_alterar_e_aprovar_condicoes`; teste com fakes
   (`tests/aprovacoes/fakes.ts`).
4. Página e cartão no layout do mockup (§1.2 itens 5–7, 9); diálogos.
5. E-mails pela porta, em `after()`: aprovar contrato (2 ou "aprovado"), alterar e aprovar ("aprovado_alterado" se
   liberou), devolver (4), homologar (aprovado por contrato liberado), aprovar/devolver aditivo (A3–A5). Testes: a
   porta é chamada só depois do sucesso. **Último passo**, depois de atualizar o branch com o `feat/melhorias` que já
   tem a H (a porta é da H).

**Fecha:** CA-B1–B4, B7–B11 (TS), CA-C2 (pill nas aprovações), parte de CA-D3.

### Frente F — modelo de contrato

**Arquivos:** `app/(modulo)/contratos/[numero]/documento/{page.tsx,_documento.tsx}`, `lib/modelo/campos.ts` (novo),
`app/(modulo)/configuracoes/modelo/{page.tsx,_editor.tsx,_actions.ts}` (novos), `tests/contratos/documento.test.tsx`,
`tests/modelo/campos.test.ts` (novo).

**Passos:** testes de `valoresDosCampos(contrato)` e `aplicarModelo(texto, valores)` (13 campos, desconhecido,
vazio, escape — CA-E10); teste de que a v1 sobre o CT-0001 contém as frases de hoje (CA-E13, comparando com o
render atual antes de trocar o componente); documento usa `modelo_versao` ou a atual (CA-E12 TS); tela de edição
com inserção no cursor, prévia com o CT-0001, aviso de campo desconhecido, "Descartar"/"Salvar"; action →
`frn_salvar_modelo` com `p_versao_base`. Tela de sem acesso: importa `configuracoes/_sem-acesso.tsx` da G (até o
merge da G, um componente local temporário **no próprio arquivo da página**).

**Fecha:** CA-E10, E12 (TS), E13; parte de CA-E1 (modelo).

### Frente G — Configurações: condições, menu e layout

**Arquivos:** `app/(modulo)/configuracoes/condicoes/{page.tsx,_tabela.tsx,_form.tsx,_actions.ts}`,
`app/(modulo)/configuracoes/_sem-acesso.tsx` (novos), `components/app/{menu-itens.ts,menu-lateral.tsx,
app-shell.tsx}`, `app/(modulo)/layout.tsx`, `tests/menu-lateral.test.tsx`, `tests/app-shell.test.tsx`,
`tests/configuracoes/*` (novo).

**Passos:** menu com grupo "Configurações" só com `veConfiguracoes` (teste para José, configurador, admin,
Eduardo, solicitante); `layout.tsx` passa `veConfiguracoes` ao `AppShell` mesmo sem contadores; tela de condições
(tabela, chips, "Em uso", banners, leitura para admin, sem acesso para os demais); modal de editar/criar com modo
editável e aviso de troca de modo, parcelas com soma, regras derivadas (§1.5 item 6) e texto das faixas fixas;
modal de desativar com contagens (aprovados/enviados × rascunhos); actions → `frn_salvar_condicao` /
`frn_definir_condicao_ativa` com `p_versao_base`. Testes de cada action com fakes e da validação pura do formulário.

**Fecha:** CA-E1 (TS), parte de E5 e E8 (validação na tela).

### Frente H — e-mail

**Arquivos:** `lib/avisos/{porta,configuracao,smtp,tentativas,mensagens,avisar}.ts` (novos; a porta é só da H e
exporta `avisarContrato`/`avisarAditivo` com os tipos de `lib/tipos.ts`), `package.json`, `package-lock.json`, `.env.example`,
`tests/avisos/{mensagens,tentativas,configuracao,avisar}.test.ts` (novos).

**Passos:** copiar `configuracao.ts`, `smtp.ts`, `tentativas.ts` do Financeiro (`D:\fornecedores-work\
financeiro-reenvio\lib\avisos\`, `63270ff`) com os testes deles; `smtp.ts` com `cc` e `html`; `mensagens.ts` —
testes de `destinatarios` para os 10 eventos (CA-D1), sem repetição, e de `montarMensagem` com escape (CA-D4);
`avisar.ts` — com fakes: sem SMTP registra `sem_configuracao` (D2), falha não lança (D3), registra via
`frn_registrar_aviso`; `npm i nodemailer@9.1.1 @types/nodemailer@8.0.1 --cache /d/fornecedores-work/npm-cache`;
`.env.example` com as cinco `SMTP_*` comentadas como no Financeiro.

**Fecha:** CA-D1–D4.

## 4. Ordem de integração

1. **Frente 0** → `feat/melhorias` (revisão do coordenador).
2. Frentes **A–H em paralelo**, cada uma com PR para `feat/melhorias`. Ordem sugerida de merge (sem conflito de
   arquivo; é ordem de dependência de execução): **A → H → B → E → C → D → F → G**. A H entra cedo porque B e E
   importam a porta dela (o passo das chamadas `after()` é o último de B e de E).
3. Depois de cada merge: CI verde em `feat/melhorias`.
4. Na integração final (coordenador ou frente designada, sem dono de arquivo novo):
   - conferir paridade TS×SQL (`tests/sql/paridade.test.ts`) com A e B juntas;
   - F troca o componente temporário de sem acesso pelo `_sem-acesso.tsx` da G (um import, dono: F);
   - grep de sobra: nenhum `condicaoPorCodigo(` sem catálogo e nenhum `from("frn_condicoes")` fora de
     `lib/condicoes/servidor.ts` e das Configurações; `CONDICOES` só em testes e como padrão removido.
5. **Revisão independente** do diff `main...feat/melhorias` (outro agente, não um executor), com a régua do
   projeto: só bloqueia dano de dado alcançável.
6. PR `feat/melhorias` → `main` com CI verde. **Não mergear antes de o banco estar aplicado** (§5).

## 5. Aplicação das migrations 009–012 em produção

**Quem:** a sessão principal, com autorização explícita do João para escrita em produção. **Quando:** com o PR
final aprovado, logo antes do deploy (risco 1 da spec: CT-0001 real esperando o Eduardo).

0. **CT-0001:** nenhuma escrita nas colunas existentes do CT-0001 (a 009 só preenche `condicao_versao = 1`); a conferência do passo 5 prova isso pelo hash.
1. **Confirmar o ref** (o PAT vê mais de um projeto):
   ```bash
   TOKEN=$(tr -d '\r\n' < /c/Users/joao-/.supabase-pat)
   curl -s https://api.supabase.com/v1/projects/iyytcavcgukfjnjjrerx -H "Authorization: Bearer $TOKEN"
   ```
   Tem de devolver `"id":"iyytcavcgukfjnjjrerx"` e o nome "jose.guilherme@manfac.com.br's Project". Senão, parar.
2. **Conferir que 001–008 estão aplicadas e 009+ não**: `select to_regclass('public.frn_condicoes_versoes')` nulo;
   `frn_enviar_contrato` sem "Anexe a proposta".
3. **Antes** (salvar a saída literal em `docs/fornecedores/revisao-banco-melhorias-antes.json`, commit no hub):
   ```sql
   select c.numero, md5(row(c.numero, c.status, c.tipo, c.classificacao, c.condicao_codigo, c.excecao_dias,
          c.valor_mo, c.valor_mat, c.inicio, c.fim, c.escopo, c.enviado_em, c.contratacao_aprovada_por,
          c.contratacao_aprovada_em, c.condicoes_aprovadas_por, c.condicoes_aprovadas_em, c.aprovado_em,
          c.devolvido_por, c.devolvido_em, c.devolvido_motivo, c.documento_gerado_em, c.criado_por,
          c.atualizado_em)::text) as hash_ct
     from frn_contratos c order by seq;
   select (select count(*) from frn_eventos) ev, (select count(*) from frn_anexos) an,
          (select count(*) from frn_aditivos) ad, (select count(*) from frn_medicoes) md,
          (select count(*) from frn_condicoes) cond;
   select codigo, md5(row(codigo, nome, tipo, faixa, modo, parcelas, gatilho, dias_pagamento, permite_global,
          so_global, exige_justificativa, pratica, observacao, ativo, ordem)::text) from frn_condicoes order by ordem;
   select * from frn_parcelas_mo((select id from frn_contratos where numero = 'CT-0001'));
   ```
   Se houver contrato além do CT-0001, aditivo ou medição, **parar e reavaliar** (o estado medido em 13/10 mudou).
4. **Aplicar** cada arquivo inteiro, um por chamada, na ordem 009 → 010 → 011 → 012, montando o JSON com `node`
   (sem Python na máquina; arquivos temporários no scratchpad). Ler todas as linhas de verificação: **qualquer
   `*** FALHOU ***` = parar**, não aplicar o seguinte, não deployar.
5. **Depois**: rodar as mesmas consultas do passo 3 e comparar. Tem de bater: `hash_ct` do CT-0001 igual;
   contagens iguais; hash das 12 condições igual; `frn_parcelas_mo` igual. E mais:
   ```sql
   select numero, condicao_versao, parcelas_ajustadas, modelo_versao from frn_contratos;   -- 1, null, null
   select count(*) from frn_condicoes_versoes;                                              -- 12
   select count(*) from frn_modelos_contrato;                                               -- 1
   select public.frn_etapa(c) from frn_contratos c where numero = 'CT-0001';                -- eduardo
   ```
   Salvar em `docs/fornecedores/revisao-banco-melhorias-depois.json`.
6. **Registrar** no mesmo commit do hub: linha nova na tabela "Estado das migrations" de `.claude/rules/sql.md`
   (Fornecedores `009`–`012`, data, contagens de verificação OK) e o estado em `docs/fornecedores/O-QUE-FALTA.md`.
7. **Rollback**, se algo falhar depois do commit de uma migration: `supabase/rollback/009-012-ROLLBACK.sql`
   (recria as funções de 005/008; não apaga dado). Só com o João avisado.

## 6. Checklist de deploy (app `fornecedores` no EasyPanel, projeto `manfac`)

- [ ] Migrations 009–012 aplicadas e conferidas (§5); `sql.md` atualizado.
- [ ] PR `feat/melhorias` → `main` mergeado, CI verde no commit do merge.
- [ ] **João** copia do Environment do app **Compras** para o do app **fornecedores**: `SMTP_HOST`, `SMTP_PORTA`,
      `SMTP_USUARIO`, `SMTP_SENHA`, `SMTP_REMETENTE` (D5). Valores nunca no chat nem em arquivo versionado. Se o
      log de erro do EasyPanel for colado, só as linhas do erro, nunca a linha `--build-arg`.
- [ ] Deploy **só** do app `fornecedores` (não há auto-deploy; o deploy dele não pode atualizar outro sistema).
      Campo do arquivo de build = `Dockerfile` (maiúsculo).
- [ ] Confirmar que subiu pelo `Last-Modified` dos chunks em `https://hub.manfac.com.br/fornecedores/_next/static/…`,
      não pelo painel; `GET /fornecedores/api/health` = `ok`.
- [ ] Hub, Compras, Financeiro, Cockpit, Obras e Sofia abrindo (CA-M4).
- [ ] Na tela, sem escrever nada: lista com "Aguardando Eduardo" no CT-0001; busca "davi"; ficha com a etapa e o item
      "agora"; Configurações visível para o José e em leitura para o admin; prévia do modelo com o CT-0001.
- [ ] **CA-D5**: o primeiro e-mail real será o da aprovação do Eduardo no CT-0001 (3b, para José, cópia Eduardo).
      Depois dela, conferir `select evento, para, copia, situacao, erro, criado_em from frn_avisos order by
      criado_em desc limit 5` (leitura, autorizada pelo João). `falhou` com `EENVELOPE 453` = remetente diferente da
      caixa; `EMESSAGE 451` = recusa temporária (houve novas tentativas).
- [ ] Atualizar o manual (`docs/fornecedores/manual/`) e escrever o comunicado curto ao cliente (só o que muda na
      tela; o João aprova antes de enviar).
