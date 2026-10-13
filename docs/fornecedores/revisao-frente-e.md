# Revisão independente — Frente E (PR fornecedores#12)

**Data:** 13/10/2026 · **PR:** https://github.com/manfac-facilities/fornecedores/pull/12
**Branch:** `feat/melhorias-e-aprovacoes` @ `1a5e205` · **Base:** `feat/melhorias-h-email`
**Revisor:** subagente independente (não executou a frente), clone novo em `D:\fornecedores-work\revisao-e`.
**Referências conferidas:** plano §"Frente E", spec §0, §1.2, §1.4, §2.2, D1, CAs B1–B4, B7–B11, B14, C2, D3;
migrations 009 e 010 de `origin/feat/melhorias-a-banco` (as funções que o PR chama); `AJUSTES-INTEGRACAO-MELHORIAS.md`
(o que já está lá não é repetido aqui).
**Verificação executada (só leitura):** `npx vitest run tests/aprovacoes --no-file-parallelism` = 3 arquivos, 52 testes,
todos passando. CI do PR verde. Banco de produção não acessado.

## Veredito: APROVAR

Nenhum bloqueante pela régua. Nenhum caminho alcançável deixa o José aprovar antes do Eduardo. Nenhum papel errado
consegue aprovar, e nenhuma escrita sobrescreve condição aprovada. A ordem e o papel são checados três vezes: na
tela, na Server Action e no banco (`for update`). As melhorias abaixo não bloqueiam.

---

## Conferido e correto (régua de bloqueante)

| Ponto | Resultado |
|---|---|
| **Ordem Eduardo → José, no servidor** | `recusaPelaEtapa` (`_actions.ts:48-81`) relê o contrato com o cliente da pessoa e calcula `etapaDoContrato`. Contrato não encontrado ou com erro de leitura é recusado. A defesa que vale é a do banco: `frn_aprovar_contrato` e `frn_alterar_e_aprovar_condicoes` (010:209-210 e 274-275) recusam `condicoes` com a contratação pendente, depois de `select … for update`. Uma chamada direta à action (sem passar pela tela) também é recusada. Teste: `actions.test.ts:102` (CA-B1). |
| **Devolver só na própria etapa** | `podeDevolverNaEtapa` (`permissoes.ts:51`) e, no SQL, `(p_parte = 'contratacao') <> (contratacao_aprovada_em is null)` (010:241). José ainda devolve quando só falta a homologação, como manda a spec. Aditivo de valor: a ordem é checada na TS (`podeAgirNoAditivoNaOrdem`) e no SQL (009:521-522 e 591-594). |
| **Quem pode aprovar (falha fechada)** | `podeAgirNaParte` exige `=== true` (`permissoes.ts:20-22`). `lerPapeis` com erro devolve tudo `false` (Frente 0). Admin, solicitante e `configurador` não ganham nenhuma parte, e o SQL usa `frn_tem_papel(...) is not true`. `frn_tem_algum_papel` (009:175-185) não inclui `configurador`, então ele não enxerga contrato alheio pela RLS (CA-B10). Teste: `actions.test.ts:91,270`. |
| **Alteração pelo José grava a versão certa** | A action valida com Zod (código, % inteiros de 1 a 100 com soma 100, prazo de 0 a 120, justificativa de 5 a 1.000) e repassa o pedido a `frn_alterar_e_aprovar_condicoes`. O banco valida tudo de novo contra a **versão atual** da condição escolhida e grava `condicao_versao = k.versao`. `parcelas_ajustadas` fica `null` quando os % são os da versão. Ao sair de exceção, os campos `excecao_*` são zerados. O evento `condicoes_alteradas` guarda antes, depois e justificativa (010:255-354). "Aprovar condições" sem mudança chama `frn_aprovar_contrato`, que não toca a condição: a versão pinada continua a mesma. |
| **Nada aprovado é sobrescrito** | A alteração só é aceita com `aguardando`, contratação aprovada e condições pendentes. Contrato aprovado só muda por aditivo. A tela lê a condição de cada cartão pela versão pinada (`dados.ts:83-122`, via `condicaoDoContrato`). Versão ausente lança erro, sem cair no catálogo atual. A página e o layout capturam esse erro. Com isso, a linha `aprovacoes/_lib/cartoes.ts` do **I-1** (revisão B) fica resolvida: parcelas e prazo do cartão vêm da versão pinada. |
| **CT-0001 (D1)** | Estado: `aguardando`, José aprovou, Eduardo não → etapa `eduardo`. Para o José não aparece botão nenhum (não há o que homologar). O Eduardo vê "Aprovar contratação" com o texto "o contrato fica Aprovado". `frn_aprovar_contrato('contratacao')` libera, a action recebe `liberado = true` e manda o e-mail `aprovado` (3b: para o solicitante, que é o José, com cópia ao Eduardo). O PR não faz nenhuma escrita nova nas colunas existentes. A devolução pelo Eduardo zera as duas aprovações, o que é permitido por CA-B8 e satisfaz `frn_ct_ordem`. Teste: `actions.test.ts:146`. |
| **E-mails por etapa** | Todos são disparados em `after()` **depois** de `r.ok`. Com erro, nada é agendado, e a porta nunca lança (CA-D3). O mapa: 2 quando o Eduardo aprova sem liberar; 3b quando libera; 3 (`aprovado_alterado`) quando a alteração libera; 4 na devolução, com `ator` (para a cópia ao Eduardo); `aprovado` ou `aprovado_alterado` quando a homologação libera, com o filtro de `condicoes_alteradas` desde o `enviado_em`, que o reenvio atualiza (010:175); A3, A4 e A5 nos aditivos. CA-B9: o "aprovado" sai uma vez, no momento em que libera. |
| **Corrida (duplo clique / duas abas)** | Os botões e o diálogo ficam desabilitados com `ocupado` (`useTransition`). Se duas requisições chegarem mesmo assim, o `for update` serializa, e a segunda recebe "Condições já aprovadas" ou "Contratação já aprovada" sem e-mail. Uma aba velha do José não aprova antes do Eduardo, porque a checagem é feita na hora, no banco. |
| **Assinaturas para o layout** | `montarCartoes(d, papeis)` e `carregarAprovacoes(supabase)` mantidas. `layout.tsx` não foi tocado. |

---

## Bloqueantes

Nenhum.

---

## Melhorias (não bloqueiam; voltam ao backlog se não forem feitas agora)

1. **Editor travado quando a versão pinada difere da atual.** Os pontos são `_lib/condicao.ts:135` e `:189`, e
   `_cartao.tsx:109` e `:293`. `edicaoInicial` usa os % da versão **pinada**, mas `validarEdicao` e a lista de
   parcelas do editor usam a versão **atual** do catálogo. Cenário: o contrato foi enviado com `X` v1 (3 parcelas), e
   depois alguém salvou `X` v2 (2 parcelas) nas Configurações. O José clica em "Alterar condições" e aparece
   "Informe o percentual das 2 parcelas". Como `invalida` é calculado mesmo **sem mudança**, o botão
   "Aprovar condições" também fica desabilitado até ele clicar em "Desfazer alteração". Ajustar os % da mesma condição
   fica impossível, porque `trocarCondicao` de volta para `X` devolve o `inicial` com 3 valores. Com a mesma
   quantidade de parcelas e gatilhos diferentes, o editor mostra os % da v1 ao lado dos gatilhos da v2. Nada é gravado
   errado: o banco valida contra a v2, e o "Depois" mostra a v2. Correção curta: calcular `invalida` só quando
   `mudou`, e partir dos % da versão atual quando `condicao_versao` for diferente da atual.
2. **Sem controle de concorrência otimista na alteração.** Cenário: uma aba do José ficou aberta. Nesse meio-tempo o
   contrato foi devolvido, o solicitante trocou a condição e reenviou, e o Eduardo aprovou de novo. O pedido da aba
   velha é aceito e troca a condição nova por uma que o José escolheu olhando a anterior. O resultado é válido (o banco
   revalida tudo) e o evento registra o "antes" real, então não há dano de dado. Ainda assim, um `p_atualizado_em` ou
   `p_versao_base`, como as Configurações já fazem, fecharia o caso. Exige mudar a assinatura no SQL (Frente A).
3. **Comentário desatualizado** em `_actions.ts:354`: "frn_devolver_aditivo não olha o tipo". Na 009, ele olha
   (`009:591-594`). A checagem da TS é redundante, o que não é problema; o comentário engana quem for mexer depois.
4. **`avisarLiberados`** (`_actions.ts:223-253`). Se outro caminho liberar um contrato do mesmo fornecedor entre a
   leitura de `antes` e a homologação (por exemplo, o José aprovando as condições em outra aba ao mesmo tempo), sai
   e-mail "aprovado" duplicado. A chance é remota e o dano é só um e-mail repetido. Além disso, o filtro
   `ids.includes(...)` da linha 232 é redundante com o `.in("id", ids)`.
5. **Zod `parcelasPct.max(10)`** (`_actions.ts:127`) bate com o limite de 10 parcelas da 009 (`:151`, `:937`) e com
   o formulário da G. Fica registrado só como contrato: se o limite subir num lugar, tem de subir nos três.

## Desvios declarados

Nenhum arquivo fora da lista da Frente E no diff (14 arquivos, todos em `app/(modulo)/aprovacoes/**` e
`tests/aprovacoes/**`). O diálogo de aditivo em `_ficha/acoes.tsx`, repassado à E na revisão B, **não** foi feito
neste PR: o arquivo é da B e já está em `AJUSTES-INTEGRACAO-MELHORIAS.md`.
