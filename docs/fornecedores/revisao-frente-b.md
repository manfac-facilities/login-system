# Revisão independente — Frente B (PR fornecedores#10)

**Data:** 13/10/2026 · **PR:** https://github.com/manfac-facilities/fornecedores/pull/10
**Branch:** `feat/melhorias-b-condicoes` @ `296a24b` · **Base:** `feat/melhorias-h-email`
**Referências conferidas:** plano §"Frente B", spec (B1, B2, CA-E3, E4, E6, M3, D3), migrations 009 e 010 de
`origin/feat/melhorias-a-banco`.
**Verificação executada no clone (só leitura):** `tsc --noEmit` = 0 erros; `vitest run` = 47 arquivos, 794 testes, todos
passando.

## Veredito: AJUSTAR

Um bloqueante no escopo do PR (B-1), curto. O núcleo de dinheiro (B1, parcelas ajustadas, envio, aditivo, e-mail) está
correto. Além dele, um bloqueante de integração (I-1) que não é deste PR, mas impede o deploy do conjunto.

---

## Bloqueantes

### B-1 — Diálogo do aditivo de condição mostra prazo e nome da cópia fixa e decide "exceção" pelo código
`app/(modulo)/contratos/[numero]/_ficha/acoes.tsx` está na lista de arquivos da Frente B no plano, e o PR não mexeu nele:

- `:388` `prazoDaCondicao(para, …)` e `:365/:371` `nomeDaCondicao(…)` vêm de `aprovacoes/_lib/condicao.ts`, que lê
  `condicaoPorCodigo(codigo)` **sem catálogo**, ou seja, a cópia fixa `CONDICOES`. Se a condição foi editada nas
  Configurações (exemplo: v2 com D+15), o diálogo mostra **D+7** e o aditivo vai pinar a versão atual com **D+15**.
  A pessoa decide o aditivo vendo o prazo errado. Condição criada nas Configurações aparece sem nome e com prazo "—".
- `:318` `ehExcecao = para === "EXCECAO_APROVACAO"`. O servidor (`_actions.ts:111`) agora decide pelo **modo**. Pela
  D3, uma condição criada ou editada no modo `excecao` não mostra os campos de exceção. O servidor então recusa com
  "Exceção exige…" e a pessoa fica sem saída. A falha é segura (nada é gravado), mas o fluxo fica travado.

**Correção curta:** `montarFicha` já recebe o `catalogo`. Basta entregar em `Ficha` as condições do aditivo como
objetos `Condicao` (ou um mapa código→{nome, modo, diasPagamento}) e, no diálogo, calcular prazo, nome e `ehExcecao`
a partir deles, com `modo === "excecao"`.

### I-1 — (integração, fora deste diff) prazo, parcelas e texto de contrato aprovado ainda vêm da cópia fixa
Não bloqueia o merge do #10, mas bloqueia o deploy do conjunto. Restam leituras sem a versão pinada:

| Onde | O que mostra | Frente dona |
|---|---|---|
| `contratos/[numero]/page.tsx:187-189` | nome e **prazo** da condição do contrato (`nomeDaCondicao`/`prazoDaCondicao`) — `f.condicao` (pinada, entregue por este PR) não é usada | D |
| `contratos/[numero]/page.tsx:358` | `consolidado` por código (`=== "SPOT_MENSAL_CONSOLIDADO"`) | D (já no plano) |
| `aprovacoes/_lib/cartoes.ts:149,190` → `parcelasDoContrato` | **parcelas** mostradas ao Eduardo/José, pela cópia fixa | E |
| `contratos/_lista.ts:114` | parcelas atrasadas da lista, pela cópia fixa | C (já no plano) |
| `contratos/[numero]/documento/{page.tsx:20,_documento.tsx:40}` | condição no documento do contrato | F |

Sugestão ao coordenador: antes do deploy, rodar `grep -rn "condicaoPorCodigo(\|parcelasDoContrato(\|nomeDaCondicao(\|prazoDaCondicao(" app lib`
e exigir que nenhuma chamada sem catálogo ou versão sobre contrato enviado ou aprovado sobreviva.

---

## Conferido e correto (régua de bloqueante)

- **B1 / vencimento ao Financeiro** (`lib/integracoes/financeiro.ts:459-480`): o select não embute mais `frn_condicoes`.
  O código lê `condicao_codigo` + `condicao_versao` da **medição** e busca a versão em `frn_condicoes_versoes`.
  Versão nula ou ausente **lança**, sem cair no catálogo atual. `deLinha` continua aplicando `excecao_dias` quando o
  **modo da versão** é `excecao`. O SQL (`frn_solicitar_medicao`, 009:658-664) pina na medição o par certo, inclusive
  `MATERIAL_MEDIANTE_NF` atual para o item material. O teste novo cobre v1 D+7 contra atual D+15, o vencimento do
  corpo, exceção pela versão e versão ausente (CA-E3 TS ✔).
- **Parcelas ajustadas:** `condicaoDaVersao` e `parcelasMo` lançam quando a quantidade diverge. É o espelho de
  `frn_parcelas_mo` (009:244-247). A ficha aplica o ajuste uma vez só (por `condicaoDaVersao`) e não passa de novo
  para `parcelasMo`. A versão pinada vem do mesmo código do contrato, e se o código divergir lança
  (`calculo.ts:169-175`).
- **Ficha:** dinheiro (parcelas, retenção, aceite final) vem da versão pinada. O catálogo atual é usado só em
  `condicoesParaAditivo`, filtrado por `ativo` e permitido (via `condicaoPermitida`) ✔.
- **Medição (tela):** `medicoes/_dados.ts` usa a versão do contrato. Os testes de medição antigos passam sem mudar a
  expectativa (CA-M3 ✔).
- **Condição desativada:** no **envio**, `faltasParaEnviar` roda contra o catálogo lido do banco. A sugerida
  desativada ou não permitida gera a falta "condição", e o banco revalida em `frn_salvar_contrato`. No **aditivo**,
  `k.ativo !== true` recusa, e `frn_criar_aditivo` revalida por `frn_condicao_permitida`, que exige `ativo`. CA-E6 (TS):
  `condicaoEfetiva` devolve `null` quando a sugerida não é permitida ✔. CA-E4 (TS): o formulário usa o catálogo por
  prop ✔.
- **E-mail:** `after(() => avisar…)` só depois de `!r.ok`/`envio.error` e antes do `return`. Em caso de erro, nada é
  agendado. A porta nunca lança (`avisar.ts:202-217`, try/catch). Os testes cobrem sucesso e erro (CA-D3, parte B ✔).
- **RPC e assinaturas:** `frn_criar_aditivo` com 10 argumentos, incluindo `p_exc_dias` (009:418) ✔.
  `frn_enviar_contrato(p_ator, p_id)` (010:134) ✔. `frn_parcelas_mo(p_contrato)` ✔. Nenhum TS chama
  `frn_dias_pagamento` (a versão de 2 argumentos sai na 009:874, e só o SQL usa a de 3) ✔.
- **Exposição:** só se leem `frn_condicoes`/`frn_condicoes_versoes` (catálogo, RLS `frn_email() is not null`). A chave
  de serviço nova em `enviarParaAprovacaoAction` lê só o catálogo. Nenhum dado de contrato passa a ser lido fora da
  RLS ✔.

---

## Melhorias (não bloqueiam; voltam ao backlog se não forem feitas agora)

1. **Catálogo vazio apaga a escolha do rascunho** (`_contrato.ts:189-193` + `_catalogo.ts:420`). Se o catálogo falha,
   o form abre com `condicoes: []`, e o banner pede para "salvar o rascunho". `paraEntrada` manda então
   `condicaoCodigo: null`, porque nada é permitido em catálogo vazio. O banco grava a sugerida no lugar da condição
   escolhida à mão, por exemplo uma exceção. Como sobrescreve dado de rascunho, **recomendo fazer já**: com
   `erroCatalogo`, bloquear salvar e enviar, ou preservar `condicaoEscolhida` quando o catálogo estiver vazio. São
   umas 2 linhas.
2. **Falha do catálogo derruba a ficha inteira** (`_ficha/dados.ts:296-298`, `Promise.all`). O catálogo só serve para
   o aditivo. Dá para degradar para `[]` e esconder o botão de aditivo de condição.
3. **R-27 por código** (`medicoes/_dados.ts:336`, `.eq("condicao_codigo", "OBRA_MEDICAO_MENSAL")`). Com a D3, uma
   condição nova ou editada em modo `mensal` fica fora do banner de parcela atrasada. Trocar para o modo da versão.
4. **Código morto:** `esquemaEnvio` (`_esquema.ts`) ficou sem uso e é o único motivo do padrão `CONDICOES` em
   `faltasParaEnviar`. Remover os dois evita que alguém volte a validar envio contra a cópia fixa.
5. **Ordem de deploy:** o branch não contém 009–011, mas lê `condicao_versao`, `parcelas_ajustadas`, `modelo_versao`,
   `devolvido_em` e `frn_condicoes_versoes`. Sem a Frente A aplicada no banco, a ficha, a medição e o Financeiro
   **lançam**. Pela régua isso é o comportamento certo, mas o B só pode subir depois das migrations.
6. Ordem do import em `financeiro.ts:9` (`@/lib/condicoes/servidor` depois de `@/lib/regras/vencimento`): o
   `biome check` pode reordenar. É cosmético.

## Desvio declarado — aceito
`lib/regras/aditivo.ts` mantém `CONDICOES` como padrão (`e.catalogo ?? CONDICOES`). O chamador é da Frente E. A
validação real do aditivo de condição neste PR passa pelo catálogo do banco (`_ficha/_actions.ts:101-108`) e pelo SQL.
**Condição para fechar o conjunto:** a Frente E precisa passar o catálogo.

---

## Rerrevisão (60f92f4)

**Data:** 13/10/2026 · **Clone novo:** `D:\fornecedores-work\revisao-b2` · **Diffs conferidos:** `296a24b..60f92f4`
(`3a68356`, `60f92f4`) · **Testes:** `vitest run tests/ficha tests/contratos` = 8 arquivos, 110 testes, todos passando.

### Veredito: APROVAR

- **B-1 fechado, com teste.** `acoes.tsx` não importa mais `aprovacoes/_lib/condicao` nem `CONDICOES`. Nome, prazo
  (`prazoDoAditivo`, espelho de `prazoDaCondicao` sobre o `Condicao` do catálogo) e `ehExcecao` (`modo === "excecao"`)
  saem de `condicoesParaAditivo: Condicao[]`, que `montarFicha` filtra do catálogo do banco (`calculo.ts:154`). O nome
  da condição atual vem da versão pinada (`page.tsx:101`, `f.condicao?.nome`). `tests/ficha/acoes.test.tsx` cobre
  a versão editada (D+20, não D+15), a condição criada nas Configurações, a exceção pelo modo com código qualquer,
  e uma varredura de fonte que impede `CONDICOES` e `aprovacoes/_lib/condicao` nos arquivos do aditivo.
- **Melhoria 1 (rascunho) feita.** `_contrato.ts:191-197`: com o catálogo vazio, a escolhida vai como está, e o banco
  revalida. Antes ia `null` e o banco gravava a sugerida. O teste confirma que a exceção e `excecaoDias = 0` são
  preservadas, que o envio fica barrado (`faltas(..., [])` contém "condicao") e que o caso de material continua `null`.
- **Falha fechada.** Com o catálogo vazio, a lista do aditivo fica vazia e o botão não habilita (`para === ""`).
  Se o catálogo falha na ação, ela devolve erro sem gravar. Se falha na ficha, a ficha inteira cai (melhoria 2,
  que segue no backlog e é segura). Não existe caminho que grave uma condição errada.
- **Sem regressão no aditivo.** Uma condição desativada sai da lista (`condicaoPermitida` exige `ativo`) e é recusada
  no servidor (`k.ativo !== true`) e no SQL. A atual pinada numa versão antiga aparece pelo nome pinado e não entra
  na lista (mesmo código), salvo exceção→exceção (D-4), que ainda exige um prazo diferente. O prazo enviado é o
  digitado só quando o modo é `excecao`. O servidor decide pelo modo do catálogo atual, o mesmo usado na tela.
- **Integração com C–G.** `git merge-tree` de B com cada um dos branches remotos C, D, E, F e G deu **zero conflitos**.
  Nenhum deles mexe em `_ficha/tipos.ts`, `calculo.ts`, `acoes.tsx` ou `tests/ficha`. Só D altera `page.tsx`, e no
  merge `AcoesFicha` recebe `nomeCondicaoAtual` e `condicoesParaAditivo={f.condicoesParaAditivo}`, coerentes com o
  novo tipo. Não há outro consumidor de `condicoesParaAditivo` como `string[]`. Não rodei `tsc` nos merges, por
  causa da RAM: a conferência foi textual.
- **Continua aberto, sem bloquear o #10:** I-1 (`page.tsx:187-190`, `_lista.ts:114`, `documento/*`, `cartoes.ts`
  ainda leem a cópia fixa, e cada um é de outra frente) e as melhorias 2 a 6.
