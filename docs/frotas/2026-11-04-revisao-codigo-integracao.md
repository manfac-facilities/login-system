# Revisão independente — integração da terceira bateria do Frotas

- **Data:** 04/11/2026
- **Escopo:** `git diff 8429aee..615882a` na worktree `C:\Users\joao-\wt-frotas-integracao`
  (branch `feat/frotas-terceira-integracao`; commits a567bbb, 72e0ec7, f3125e8, 490121c, ca9e279, 615882a).
- **Fontes:** spec manutenção §1.5 / T10 (`2026-11-03-frotas-manutencao-e-bases-design.md`), spec multa §2.11, §2.12,
  §4.3 e AJUSTE pós-spec (`2026-11-03-frotas-multa-fotos-checklist-design.md`), `AGENTS.md`, `.claude/rules/sofia.md`.
- **Revisor:** agente independente (não escreveu o código). Não rodei build (havia outro build na worktree).
- **Testes:** `npx jest -i` nos 7 arquivos tocados (queries, pendencias, alertas, rota alertas-diarios,
  multas-embed-motorista, montar-novas, importar revisões): **7 suites, 91/91 passando**.
- **Master:** os commits de `master` que ainda não estão no branch são só de docs (nenhum em `app/`, `lib/`, `components/`),
  então não há regressão por base desatualizada.

## Veredito

**APROVADO, sem bloqueantes.** Quatro pontos não bloqueantes abaixo. O N2 deve ser corrigido antes de importar a
planilha de revisões em produção, porque é o cenário que a própria integração prevê.

## Conferência por foco

1. **Regra da vigente (maior KM).** `queries.ts` (`classificarRevisoesVigentes`) e `alertas/blocos.ts` usam
   `classificarFrota`, a mesma função do painel (`revisaoLeitura.ts`) e da base (`montar-novas.ts`). O motivo
   `data`/`km` e `km_passados` saem de `i.porData`/`i.passou`, e o retorno mantém o tipo (como a §1.5 pede).
   A Visão geral recebe a correção por `getRevisoesAtrasadas`/`getRevisoesVenceEmBreve`. A leitura paginada de
   `queries.ts` usa `buscarTudo` com `.order('id')` (id único, então nenhuma linha se perde nem se repete) e lança erro
   em vez de devolver lista vazia. **Exceção:** o e-mail não pagina (N2).
2. **Pendências B8 e e-mail.** Em Pendências entram multas com etapa fora de `descontada`/`contestada`, e o erro de
   leitura lança exceção (não vira "nenhuma multa"). O grupo "aguardando terceiros" entra como `em_andamento`, sem
   prazo, num bloco separado. As revisões "chegando" ficam sem `prazoKm`, como a §1.5 pede. O e-mail mostra só as etapas
   `registrada`/`condutor`/`termo` com prazo vencido ou que vence em até 10 dias, com link para `/sofia/multas/{id}`,
   como a §2.12 pede.
3. **Multas como BaseTabela.** Nada na tabela escreve em `status`/etapa: a tratativa fica só no link "Abrir no fluxo
   da multa". As caixas de seleção e o Excluir aparecem só com `podeGerir`, e as actions conferem de novo
   (`podeGerirFrotas` + RPC `excluir_multas_em_massa`). A coluna, o filtro e o Excel trocam "Situação" por "Etapa"
   (todas as 10 etapas, `contestada` incluída) e acrescentam o prazo de indicação. A base de multas não tem período
   padrão (`filtrosDaUrl`), então a lista continua mostrando tudo, como no master. A exclusão de sinistro passou a
   exigir `ehAdminSofia`, que devolve false em erro ou null; a action confere de novo (AJUSTE pós-spec).
4. **Ficha do veículo.** `IntervaloRevisao` só aparece com `podeGerirFrotas`, e `definirIntervaloRevisaoAction`
   confere de novo. O link "Histórico do checklist" aponta para uma rota que existe (`checklist/veiculo/[veiculoId]`).
5. **Importação N1.** A tela manda só `linhasParaGravar`. O servidor revalida tudo contra o banco (`validarLinhas`),
   e um subconjunto nunca faz uma linha subir de `dup`/`aviso`/`erro` para `ok`. Duplicata dentro da própria planilha
   continua barrada, porque a segunda ocorrência nem é enviada. O teste novo cobre o caso de corpo grande.
6. **Embeds `motoristas(`.** Toda leitura de `multas` que embute motorista usa `motoristas!motorista_id(...)`
   (`multas/[id]`, `descontos`), e não há embed reverso `multas(`. O teste `multas-embed-motorista` trava a regressão.
7. **Regressão.** Não encontrei nada que o app deixe de fazer. As mudanças de comportamento estão todas na spec:
   carro inativo sai dos avisos de revisão, passa a haver um aviso por carro em vez de um por veículo+tipo, e excluir
   sinistro fica só para admin.

## Não bloqueantes

**N1. A seleção em massa de multas sobrevive à troca de filtro e de página.**
`app/(operacoes)/sofia/_base/BaseTabela.tsx:163-173` mantém em `marcados` os ids que saíram da tela (`fora`), e
`multas/_table.tsx:35` manda todos para `excluirMultasEmMassaAction`.
- **Cenário:** o gestor marca 3 multas, troca o filtro de Etapa, marca mais 2 e clica "Excluir selecionadas". As 5 são
  excluídas, inclusive as 3 que não estão mais visíveis.
- **Por que não bloqueia:** o `confirm` mostra a contagem ("Excluir 5 multa(s)"), só gestor alcança a ação e cada
  exclusão vai para o audit_log.
- **Contradição no código:** o comentário do arquivo (`multas/_table.tsx:4-5`) diz "em massa só da página visível",
  e isso não é verdade.
- **Correção:** limpar `marcados` quando filtro ou página mudarem (por exemplo, um `useEffect` em `MultasTable`, ou um
  callback de BaseTabela chamado em `muda`/`setPagina`), ou filtrar `marcados` pelas linhas visíveis antes de enviar.
  Se a decisão for manter, corrigir o comentário.

**N2. O e-mail diário lê `revisoes` sem paginar.**
`lib/sofia/alertas/leitura.ts:31-33` usa `ler(admin.from('revisoes').select(...))` sem `.range`/`.order`.
- **Cenário:** depois da importação da planilha, a tabela passa de 1.000 linhas (o próprio comentário de
  `queries.ts:131` prevê isso). O PostgREST corta em 1.000 linhas, numa ordem arbitrária. Com a regra nova (maior KM),
  a revisão que define a vigente pode ficar de fora: o e-mail aponta como atrasado um carro que já fez a revisão, ou
  deixa de avisar um que está atrasado. A tela de Pendências, que pagina, mostraria outra coisa.
- **Por que não bloqueia:** o e-mail é só de leitura (nenhum dado é gravado), e o limite já existia no master.
- **Correção:** paginar com `buscarTudo` (ou um laço equivalente com `.order('id').range(a, b)`), como em
  `queries.ts`. `veiculos` e `multas` cabem no limite hoje.

**N3. Pendências e Visão geral leem `revisoes` e `veiculos` duas vezes.**
`getRevisoesAtrasadas` e `getRevisoesVenceEmBreve` chamam `classificarRevisoesVigentes` cada uma
(`pendencias/page.tsx:57-58`, `visao-geral-leituras.ts:41`). O resultado está correto. Só o custo cresce com a
importação.
- **Correção (opcional):** uma função que devolva as duas listas de uma leitura só.

**N4. A Visão geral ainda conta multas por `status`.**
`lib/sofia/visao-geral.ts:157-158` conta pelo `status` antigo, então multa contestada (status `pendente`) entra como
pendente, e multa `cobrada`/`solicitada` entra como "validada". Isso está fora da §4.3, que não lista a Visão geral.
- **Correção (opcional):** registrar em `docs/DIVIDAS.md` ou alinhar o cartão à etapa numa próxima rodada.

## Observação de deploy

Pendências, Visão geral e o e-mail passam a ler `revisoes.prever_proxima`, `veiculos.intervalo_revisao_km` e
`multas.etapa`/`prazo_indicacao`. Se este código subir antes dos dois SQL (`sofia-manutencao` e `sofia-multa-avaria`),
essas telas e o e-mail quebram. A ordem da spec (SQL → merge → deploy na mesma janela) cobre isso; é só não inverter.
