# Revisão de código independente: Descontos pelo fluxo de etapas + bloqueio de avaria em rascunho

Data: 03/11/2026 (noite). Revisor: agente independente; não escreveu nenhuma linha do que foi revisado.

- **(A)** `feat/frotas-descontos-integ` (worktree `C:\Users\joao-\wt-frotas-descontos`), `a567bbb..dd44823`
  (5cd4dda, 2e78f8f, b251003, dd44823).
- **(B)** `feat/frotas-multa-fotos-checklist`, commit `2866ca2`.
- Fontes: spec `docs/superpowers/specs/2026-11-03-frotas-multa-fotos-checklist-design.md` (§2.1, §2.6, §2.8, §4.2, §4.3,
  ajuste final), `sdd-sql-sofia-multa-avaria.sql` (trigger `sofia_multas_etapa_guarda` + RPC
  `sofia_multa_registrar_etapa`), `AGENTS.md`, `.claude/rules/sofia.md`.

## Veredito

**(A) APROVADO. (B) APROVADO. Nenhum bloqueante.**

## Verificação executada

| Onde | Comando | Resultado |
|---|---|---|
| A | `npx tsc --noEmit` (sem app/obras, app/portal-obra, scripts) | **0 erros** |
| A | `npx jest -i "app/.operacoes./sofia/descontos" "app/.operacoes./sofia/multas" lib/sofia` | **40 suítes, 494 passaram**, 2 puladas, 0 falhas |
| B | `npx jest -i "app/.operacoes./sofia/checklist" lib/sofia/__tests__/fotosChecklist` | **9 suítes, 88 passaram** |
| B | `npx tsc --noEmit` | 1 erro em `app/(operacoes)/sofia/pendencias/page.tsx:68`. **Não vem do 2866ca2**, que não toca esse arquivo. A integração de Pendências está no branch A, e A compila limpo. Só vale lembrar que B sozinho não compila e não pode subir sem A. |

## (A) Conferência item por item

1. **O papel é checado antes de qualquer leitura ou escrita.** Confirmado.
   - `registrarDescontoMultaAction` (`descontos/_actions.ts:28-55`) chama `requireGestorFrotas` antes do `select('valor')`.
   - `desfazerDescontoMultaAction` (`:58-63`) faz o mesmo antes de chamar a etapa.
   - `marcarBoletoContestadaAction` (`multas/_actions.ts:248-282`) chama `requireGestorFrotas` antes de ler `etapa`.
   - `atualizarAutorizacaoMultaAction` só valida o enum e delega a `registrarEtapaMultaAction`, que checa o gestor
     e, em `exigeAdmin`, o admin.
   - O banco checa de novo: a RPC usa `sofia_pode_gerir() is not true` e `sofia_is_admin() is not true`, e a trigger
     também.
2. **Nenhuma escrita direta em `status`, `autorizacao_status` ou `valor_descontado`.** Confirmado.
   - O único `UPDATE` novo em `multas` é o de `boleto_lancado_em` (`multas/_actions.ts:261`).
   - O restante passa pela RPC.
   - O teste `_actions.multa.test.ts` garante que nada faz UPDATE em multas.
3. **O desconto respeita valor entre 0 e o valor da multa, e a competência.** Confirmado em três camadas.
   - App (`descontos/_actions.ts:38-48`): valor ≥ 0, valor ≤ `multa.valor`, tipo `total|parcial`, competência
     `^\d{4}-\d{2}$`.
   - `montarDados`: grava o dia 1 e confere `DATA_RE`.
   - Trigger (`sql:276-286`): exige etapa anterior `autorizado`, `0 ≤ v ≤ new.valor`, tipo e competência; a RPC aplica
     `date_trunc('month')`.
   - Mês inválido (ex.: `2026-13`) cai no cast do banco e volta com a mensagem fixa. Duplo clique é recusado pelo
     `for update` com "já está nesta etapa".
4. **Desfazer o desconto não abre caminho para o gestor reautorizar.** Confirmado.
   - Desfazer leva `descontada` para `autorizado`, que é exatamente a volta permitida na §2.1.
   - De `autorizado`, o gestor só consegue registrar `descontada` de novo; a autorização do admin já existia.
   - `autorizado → solicitado` exige admin no app (`exigeAdmin`), na RPC (`sql:380-384`) e na trigger (`sql:265-268`).
   - Chamar a action direto com uma multa em `solicitado` também é barrado: `exigeAdmin(solicitado, autorizado)` no app
     e na RPC.
   - O "← Revogar" do bloco de autorização aparece numa multa `descontada`, porque o status derivado é `autorizado`, e
     manda a etapa `solicitado`. A trigger recusa (`sql:292`: `old.etapa in (...,'descontada')`), e o erro aparece na
     tela.
5. **`marcarBoletoContestadaAction` não é atômico (UPDATE e depois insert em `multa_etapas`), mas não causa dano.**
   - Se o histórico falhar, o boleto fica gravado e a tela avisa: "Boleto registrado, mas o histórico... não foi
     gravado". Não se perde dado de cliente; falta só uma linha de rastro.
   - `contestada` é etapa final (`sql:292`), então não há corrida entre a leitura de `etapa` e o UPDATE.
   - A trigger exige gestor para mudar `boleto_lancado_em` sem trocar a etapa (`sql:239-249`). A policy de
     `multa_etapas` exige `feito_por` igual ao e-mail do JWT, e a action normaliza esse e-mail com
     `lower(trim(...))`.
6. **A remoção de `atualizarStatusMultaAction` não quebra nada.** Conferido com `git grep` em `dd44823`: não sobra
   referência em `app/`, `components/` ou `lib/`.
   - O nome aparece só no comentário de `descontos/_actions.ts:24`, no teste que garante que a action não existe mais
     e em docs/planos antigos.
   - Em `feat/frotas-multa-fotos-checklist` o nome ainda existe (página, action e teste antigos), mas isso é a base que
     o branch A substitui. O merge-base é `5f8774d`, e `2866ca2` não toca em Descontos.
7. **Sinistro e KM excedido continuam funcionando em Descontos.** Confirmado.
   - Os três botões de sinistro (avançar, desfazer, registrar) só trocaram a condição `origem !== 'km_excedido'` por
     `origem === 'sinistro'`, e continuam ligados às mesmas actions de sinistro.
   - KM excedido continua sem botões de desconto, como antes, e com `atualizarAutorizacaoKmExcedidoAction` na
     autorização.
   - `parseDescontoFormData` e `MULTA_STATUS` continuam usados pelas actions de sinistro.
   - Os testes de sinistro estão em `_actions.test.ts` e passaram.

## (B) Conferência

- **Não perde dado.** O bloqueio só impede o envio enquanto houver rascunho de avaria com algum dado, e o aviso tem
  botão "Descartar". Antes, esse rascunho se perdia em silêncio ao salvar. É exatamente o achado 4 da revisão de
  03/11 (`docs/frotas/2026-11-03-revisao-codigo-multa-fotos.md`).
- **Não bloqueia envio legítimo.**
  - `vazia()` tem todos os campos `''` e listas vazias (`RegistrarAvaria.tsx:17-19`), então `pendente` começa
    `false`.
  - `adicionar()` reseta para `vazia()`, e uma descrição só com espaços não conta.
  - O aviso fica fora das abas, então aparece mesmo na aba "lista".
  - O componente só é usado no checklist; o sinistro não usa.
- **`avaria_identificada` com item marcado "Problema".** `itensProblemas` só recebe itens com `itens[key] === false`
  (`novo/_form.tsx:156-161`), então um checklist sem problema continua `false`, como o teste cobre. Isso restaura o
  significado antigo (achado 5 da revisão anterior). Diverge do texto da §2.8 da spec ("`avarias.length > 0`"); ver
  não bloqueante 5.

## Não bloqueantes (backlog, não voltam ao dev)

1. **A spec §4.3 diz para *remover* registrar e desfazer de multa em Descontos, e A os *manteve* pelo fluxo de
   etapas** (`descontos/_multa-acoes.tsx`). O resultado é seguro, porque passa pela RPC com o mesmo controle do
   detalhe. Mas é desvio do texto: se foi decisão do João, registrar na spec ou em `docs/frotas`; se não foi, ele
   precisa saber.
2. **Antes do SQL aplicado, multa fica sem ação em Descontos** (`etapa` vem `null`, só aparece o link) e o bloco de
   autorização recebe erro da RPC ausente. A falha é fechada, sem dano. Reforça a ordem já prevista: aplicar
   `sdd-sql-sofia-multa-avaria.sql` antes do deploy.
3. **"Solicitar" em Descontos funciona a partir de qualquer etapa de `registrada` a `cobrada`**, já que
   `sem_solicitacao` mapeia para `solicitado` e a trigger permite pular para frente (§2.1). O gestor consegue pular
   condutor, termo e validação direto da tela Descontos. Continua dependendo do admin para autorizar, então não há
   falha de autorização. O comportamento é anterior a este diff (a assinatura antiga já fazia isso) e está coberto
   pela spec ("pular etapa para frente é permitido"). Sugestão de UX: em Descontos, mostrar "Solicitar" só a partir de
   `cobrada`.
4. **O gestor vê o botão "Autorizar"**, porque `showActions = podeGerir`, e só depois do clique recebe "Só o
   administrador autoriza o desconto". O comportamento está correto, mas a interface é confusa. Sugestão: esconder
   para quem não é admin.
5. **(B) `avaria_identificada` diverge do texto da §2.8.** Agora um triângulo ou macaco faltando também acende "Avaria
   identificada", e no detalhe aparece "Avaria identificada: —", porque `avaria_descricao` é `null` sem avaria
   registrada (`checklist/[id]/page.tsx:148-150`). Sugestão: atualizar a §2.8 com a decisão e, se quiser, mostrar os
   itens com problema quando `avaria_descricao` for nulo.
6. **(B) Payload malicioso derruba a action.** `itens_problemas` vem de `JSON.parse` (`_validation.ts:118`), e um
   payload `"null"` faz `Object.keys(null)` lançar em `_actions.ts:38`. Só um request forjado chega aí: dá erro 500,
   sem gravação parcial e sem dano.
7. **`marcarBoletoContestadaAction` sobrescreve uma data de boleto já gravada sem aviso.** O valor anterior só
   sobrevive se também tiver sido registrado por esta action, no `dados` de `multa_etapas`. Sugestão: recusar quando
   `boleto_lancado_em` já estiver preenchido, ou mostrar a data atual. A action também não tem chamador na UI em
   `dd44823` (a worktree tem `multas/[id]/_fluxo.tsx` modificado e não commitado, provavelmente a ligação).
8. **Tipo "total" com valor menor que o da multa é aceito**, e o inverso também. O dinheiro está limitado pelo teto,
   então a incoerência é só de rótulo.
