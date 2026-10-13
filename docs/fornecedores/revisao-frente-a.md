# Revisão independente — Frente A (PR fornecedores #9, migrations 009–012 + rollback)

**Data:** 13/10/2026 · **Revisor:** subagente independente (não executou a frente) · **Commit revisado:**
`b1e9b08` (`feat/melhorias-a-banco`, base `feat/melhorias-0-contratos`) · **CI do PR:** verde (45 arquivos,
792 testes, inclusive `tests/sql/*`: fluxo-em-ordem 21, condicoes-versoes 23, rollback 8, rls 16, modelo 7,
reaplicacao 2, instalacao 6).

Lido: diff inteiro de `supabase/hub-install/009–012`, `supabase/rollback/009-012-ROLLBACK.sql`, o teste do
CT-0001 (`tests/sql/fluxo-em-ordem.test.ts:668-795`), 001/002/003/004/005/008 para comparar, spec §2 + D1–D5 +
CAs, plano (Frente A e §5) e `.claude/rules/sql.md`. Banco de produção **não** acessado.

## Veredito: **APROVADA**

Nenhum bloqueante pela régua. Há uma melhoria recomendada antes de aplicar (M1, trava no rollback), mas ela não
muda nada do caminho normal 009→012.

## O que foi conferido contra a régua

| Item da régua | Resultado |
|---|---|
| Falha sobre o estado real 001–008 | Não falha. Os tipos e checks de `frn_condicoes_versoes` são cópia exata de `frn_condicoes` (`002:29-48`), então o seed da v1 cabe. As constraints entram depois do preenchimento. `frn_eventos_tipo_check` (010) é um superconjunto do de `004:170-179`. `frn_ct_ordem` entra `not valid`. Não há gatilho em `frn_contratos` em produção (a 009 derruba os do rollback antes). |
| Coluna existente de dado real | Só `add column if not exists`. A única escrita em contrato é `update … set condicao_versao = 1 where … condicao_versao is null` (`009:118-119`), que não mexe em `atualizado_em`. O teste do CT-0001 compara o hash do roteiro **e a linha inteira** antes e depois, e reaplica tudo. |
| Função/tabela aberta a `anon`/`authenticated` | Todas as funções novas têm `revoke … from public, anon, authenticated` + `grant … to service_role`. As alteradas mantêm os revokes de `001:182` e `005:1324-1363`. A verificação de cada migration confere função por função. O stub do pglite imita os default privileges do Supabase (`stubs/supabase-minimo.sql:9-11`), então o teste de grants é real. |
| Policy que abre dado | `frn_condicoes_versoes` e `frn_modelos_contrato` só têm SELECT para quem é logado (`frn_email() is not null`), igual a `frn_condicoes` — está na spec. `frn_avisos` não tem grant, e a policy é `using (false)`. |
| `security definer` sem `search_path` | Nenhum. Todas usam `set search_path = public, pg_temp`. As de trigger (`frn__imutavel`, `frn__rb_*`) não são definer. |
| Papel que falha aberto com NULL | `frn_pode_configurar` = `frn_tem_papel(...) or frn_tem_papel(...)`, os dois `exists` (nunca NULL); a verificação testa `(null) is false`. Todas as guardas usam `is not true`. |
| Contrato aprovado mudando ao editar condição | `frn_parcelas_mo`, `frn_solicitar_medicao`, `frn_registrar_atendimento`, `frn_registrar_solicitacao_fin` (via `frn_dias_pagamento` de 3 args) e `frn_aprovar_aditivo` leem a versão pinada. A busca em 001–008 por leitura de `frn_condicoes` não achou nenhum outro uso que envolva dinheiro. As versões são imutáveis (trigger de update/delete/truncate). Ver a observação O1 (material). |
| `parcelas_ajustadas` incoerente | Há um check de forma e status (`009:144-148`). `frn_parcelas_mo` levanta erro quando o tamanho difere da versão (`009:244-247`). O único gravador (`frn_alterar_e_aprovar_condicoes`) exige inteiros de 1 a 100, a mesma quantidade de parcelas e soma 100. Salvar o rascunho, devolver o contrato ou aprovar aditivo de condição zeram o campo. |
| Ordem Eduardo → José | `frn_aprovar_contrato` e `frn_alterar_e_aprovar_condicoes` recusam se a contratação estiver pendente. `frn_ct_ordem` vale para toda escrita nova. Os aditivos de valor seguem em ordem. A devolução só é aceita na própria etapa. Conferido: nenhum caminho de escrita sobre o CT-0001 em `aguardando` viola `frn_ct_ordem`, porque só os dois `update` de aprovar/devolver tocam contrato aguardando. |
| José altera sem evento | `frn_alterar_e_aprovar_condicoes` sempre grava `condicoes_alteradas` (antes, depois e justificativa) e depois `condicoes_aprovadas` (`010:337-342`). |
| Rollback apaga dado / abre acesso | Não apaga tabela, coluna nem dado. O único efeito é zerar `parcelas_ajustadas` de rascunho, que o check já proíbe. O desvio de `frn_tem_algum_papel` está **correto**: devolver o corpo do 001 com `configurador` ainda aceito faria o configurador ver tudo e operar. A verificação do rollback confere isso e exige que nenhuma `frn_*` fique executável por `anon`. |
| Tabela de outro sistema | Nenhuma. Só leitura de `auth.users` em `frn__nome` (service_role). |

Desvios declarados — os três aceitos: corpo novo de `frn_tem_algum_papel` no rollback; `frn_avisos` com policy
`using (false)` sem grant; `frn__desc_condicao` só `service_role` e dropada no rollback.

## Bloqueantes

Nenhum.

## Melhorias (curtas, não bloqueiam)

**M1 — Rollback sem trava de "app novo já usado" (recomendado antes de aplicar).**
`supabase/rollback/009-012-ROLLBACK.sql:34-40`. O cabeçalho diz que o rollback só vale com o app novo fora do
ar, mas nada impede rodá-lo depois. Se alguém já editou uma condição (v2) ou o José já ajustou %, o
`frn_parcelas_mo` velho passa a ler o catálogo atual. Aí as parcelas de contrato **aprovado** na v1 mudam e os
% ajustados deixam de valer. Isso é exatamente o dano de dinheiro que a régua proíbe, só que fora do caminho
previsto. Correção (cerca de 6 linhas na seção 0): abortar se `exists (select 1 from frn_condicoes_versoes where
versao > 1)`, `exists (select 1 from frn_contratos where parcelas_ajustadas is not null)` ou
`(select count(*) from frn_modelos_contrato) > 1`, com a mensagem "o app novo já foi usado — rollback mudaria
dinheiro de contrato aprovado; fale com o João".

**M2 — Envio com versão pinada desatualizada.** `010:147-148` e `010:159-161`. Um rascunho salvo antes de editarem
a condição é enviado com a versão antiga. O envio só confere `ativo` no catálogo, não `versao`. Não é dano
(do envio em diante a versão fica fixa, como a spec quer), mas quem enviou pode ter visto a condição nova na
tela. Correção: recusar quando `c.condicao_versao <> v_atual.versao` ("A condição mudou; abra e salve de novo").
Outra saída é repinar no envio. Em qualquer caso, a decisão é da Frente E/G.

**M3 — Texto do evento quando o José mantém o código mas a versão muda.** `010:319-340`. Se o José escolhe a
mesma condição, sem mudar %, num contrato pinado na v1 com catálogo na v2, a função não cai em "Nada foi
alterado": ela repina na v2 e grava "X → X". Os `dados` registram as duas versões, mas o texto engana.
Correção: incluir "(versão N)" no texto quando o código for igual e a versão mudar.

**M4 — `frn_parcelas_mo` confere só o tamanho de `parcelas_ajustadas`.** `009:244-247`. Uma escrita direta
por service_role com soma ≠ 100 passa pelo check e pelo cálculo. O total continua certo, porque a última parcela
leva o resto, mas os % exibidos ficam errados. Defesa barata: no mesmo `if`, levantar erro também quando
`(select sum((x->>'pct')::int) from jsonb_array_elements(c.parcelas_ajustadas) x) <> 100`.

**M5 — Reaplicar só a 005 desfaz a 009.** A `005` recria `frn_dias_pagamento(text,int)` e os corpos que leem o
catálogo. O teste reaplica 001→012 inteiro, então passa. Sugestão: uma linha no cabeçalho da 009 (e no
`sql.md`, quando registrar a aplicação) dizendo "nunca reaplicar 001–008 sem 009–012 em seguida".

**M6 — Verificação por nome de constraint sem `conrelid`.** `009:1085-1089`. A contagem `= 9` filtra só por
`conname`. Os nomes têm prefixo `frn_`, então o risco de colisão é baixo. Para ficar à prova, filtrar também
por `conrelid` nas quatro tabelas.

## Observações para o coordenador (não são defeito da Frente A)

- **O1 — Material de contrato de mão de obra usa a versão atual de `MATERIAL_MEDIANTE_NF`**
  (`009:660-666`). Isso está na spec (§2.1, `frn_solicitar_medicao`). A medição já solicitada fica protegida pela
  versão gravada. Mas, se o José editar `dias_pagamento` de `MATERIAL_MEDIANTE_NF`, as **próximas** medições de
  material de um contrato já aprovado ganham o prazo novo. O comportamento é o mesmo de hoje (sem regressão),
  mas vale o João saber que é decisão, não acaso.
- **O2 — Ordem de deploy:** `lib/integracoes/financeiro.ts:456` (no `main`) ainda lê `frn_condicoes` ao vivo.
  Aplicar 009–012 com o app velho é seguro, porque ninguém edita condição sem o app novo. Mas o app novo só pode
  subir **com a Frente B** (B1) junto, senão a primeira edição muda o prazo enviado ao Financeiro.
- **O3 —** `frn_condicoes_versoes.criado_por` expõe o e-mail de quem editou para qualquer logado. É dado interno
  e já acontece com `frn_contratos`; registro só para constar.
