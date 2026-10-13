# Revisão independente — PR #11 (Frente G: Configurações → condições, menu e layout)

**Data:** 13/10/2026 · **Revisor:** agente independente (não executor) · **Head revisado:** `88a2387`
(`feat/melhorias-g-configuracoes` → `feat/melhorias-0-contratos`), CI `verificar` verde nesse SHA.
**Fontes conferidas:** diff do PR; plano §3 "Frente G"; spec §1.5, §1.7, CA-E1/E5/E8, D2/D3, M4/M5; mockup
`pageCond`/`condForm`/`semPermissao`/`cond-off`; `009_frn_condicoes_versoes.sql` em `origin/feat/melhorias-a-banco`
(`frn_salvar_condicao` l.880-1006, `frn_definir_condicao_ativa` l.1009-1041, `frn_pode_configurar` l.187-198);
`lib/auth/papeis.ts`, `lib/auth/sessao.ts`, `002` (policy de `frn_condicoes`), `005:125-139` (`frn_condicao_permitida`).

## Veredito: **APROVADA** — nenhum bloqueante

## Régua, item a item (lido linha a linha)

| Critério bloqueante | Resultado | Evidência |
|---|---|---|
| Action grava sem conferir `podeConfigurar` no servidor | **Não ocorre** | `_actions.ts:33-40` `autorizado()` roda primeiro nas duas actions (`:75`, `:108`): sessão → `lerPapeis` (cliente da pessoa) → `podeConfigurar`. Só depois zod, validação e RPC. |
| Admin ou pessoa sem papel grava | **Não ocorre** | `podeConfigurar` = `financeiro \|\| configurador` (`papeis.ts:64-66`); admin não entra. `lerPapeis` fecha em erro (`:45-48`, `:57-60`). No banco, `frn_pode_configurar` também não tem atalho de admin e as duas RPCs só são executáveis por `service_role`. Testes: `actions.test.ts:67-104` (Eduardo, solicitante, admin, erro de leitura → RPC nem é chamada). |
| Página/menu aparece a quem não deveria sem cair em `_sem-acesso` | **Não ocorre** | `page.tsx:206` devolve `<SemAcesso>` antes de ler catálogo ou contratos (teste confere `servicoChamado = false`). Menu: `gruposVisiveis(veConfiguracoes)` com o booleano calculado no layout (servidor); falha → `false` (`layout.tsx:59-61`). Admin vê em leitura (`somenteLeitura={!podeConfigurar}`), sem botões. |
| Edição de modo de `MATERIAL_MEDIANTE_NF`/`EXCECAO_APROVACAO` aceita; desativar as duas | **Não ocorre** | Tela: `select` desabilitado (`_form.tsx:207`), Desativar desabilitado (`_tabela.tsx:193`). Action: `validarCondicao` recusa modo diferente (`_validacao.ts:74-75`) e `definirCondicaoAtivaAction` recusa desativar (`_actions.ts:114`). Banco repete (009 l.931-934 e l.1027-1029). Leitura adotada: a spec §1.5 item 6 trava **só o modo e a desativação**; nome, faixa, parcelas, prazo e explicação dessas duas continuam editáveis (versionados). Se a régua quis dizer "nenhuma edição", isso contraria a spec, não o código. |
| Editar condição mexe em contrato aprovado | **Não ocorre** | O app só chama `frn_salvar_condicao`/`frn_definir_condicao_ativa`; nenhuma escrita direta em `frn_condicoes`/`frn_contratos`. A RPC grava versão `n+1` e atualiza o catálogo; contrato fica pinado em `(código, versão)`. |
| `p_ator` vindo do cliente | **Não ocorre** | `p_ator: a.email`, com `a.email` de `obterSessao()` (`auth.getUser()`, normalizado). As assinaturas das actions não recebem e-mail. |
| Condição desativada prende rascunho sem saída | **Não ocorre** | `frn_salvar_contrato` (009 l.346-355) recusa a condição desativada escolhida à mão, mas aceita trocar por outra; sugestão desativada vira "sem condição". O modal de desativar avisa a contagem e os números dos rascunhos/devolvidos (`separarUsos`: `rascunho` x resto; devolvido volta a `rascunho`, conferido em `003:56`). |
| Chamada RPC divergente da 009 | **Confere** | Nomes e parâmetros idênticos: `(p_ator, p_codigo, p_versao_base, p)` e `(p_ator, p_codigo, p_versao_base, p_ativo)`. Chaves do `p` batem com o que a função lê (`nome, faixa, modo, parcelas[{gatilho,pct,retencao}], gatilho, dias_pagamento, permite_global, pratica`); `pct` vai como número inteiro (a função exige `jsonb_typeof = 'number'`), `retencao`/`permite_global` como booleano (`= 'true'::jsonb`). Nova: `p_codigo`/`p_versao_base` nulos. Edição/desativação levam a `versao` lida na carga (edição concorrente recusada pelo banco). |
| Requisito do mockup contrariado | **Não** | Tabela com as 7 colunas, chips com contagem, banners de "vale só para contratos novos" e de só leitura, texto "Não existe excluir", erro com "Tentar de novo" (`EstadoErro` é client e tem o botão), modal de editar/criar com os mesmos campos e textos, sem-acesso com o texto do mockup, selo NOVO no grupo. Desvios são os aprovados na spec: checkbox "Exige justificativa" removido (M4) e texto de rascunho no modal de desativar ajustado (M5). Aviso de troca de modo (D3) e texto das faixas fixas (D2) presentes. |

## Melhorias curtas (não bloqueiam; vão a backlog)

1. **Erro ao desativar/reativar some atrás do modal.** `definirAtiva` põe o erro em `aviso` (banner da página), mas o
   `<dialog>` aberto com `showModal()` fica por cima: a pessoa clica "Desativar condição", nada parece acontecer
   (ex.: "alterada por outra pessoa"). Mostrar o erro dentro do `ModalDesativar`.
2. **`configurador` vê números/status de contratos alheios** na coluna "Em uso" e nos modais (leitura com chave de
   serviço, `page.tsx:162-167`). É o que a spec §1.5 itens 3 e 5 pede (contagem e números), mas cruza com §1.7
   ("configurador não vê contrato alheio"). Só número e status, sem conteúdo; registrar a escolha.
3. **Banner do modal de editar** diz que os contratos que usam a condição "continuam exatamente como estão", mas
   rascunhos com ela são repinados no próximo salvamento (o aviso de troca de modo já diz isso; o banner geral
   não). Texto é o da spec; ajuste fino se o cliente estranhar.
4. **Link "Modelo de contrato"** do menu aponta para `/configuracoes/modelo`, que é da Frente F: se G subir antes
   de F, José/admin veem 404. A ordem de merge do plano (F antes de G) resolve; só não inverter.
5. **Commit do head** se chama "wip: frente g interrompida a pedido do João (13/10) - continuar daqui", enquanto o
   corpo do PR descreve a frente como completa. Conferi contra o plano: todos os passos da Frente G estão no diff.
   Vale renomear no squash para o histórico não sugerir trabalho pela metade.

## O que não foi verificado

- Não rodei os testes localmente (`node_modules` do clone incompleto); vale o CI verde em `88a2387`.
- Nada no banco de produção; comportamento das RPCs lido no SQL da 009, não executado.
