# Revisão adversarial — PR financeiro#2 (`integracao/data-pagamento`)

- Data: 09/10/2026. Revisor independente (não escreveu o código). Somente leitura: nenhum push, comentário, SQL em banco real ou chamada ao Omie.
- Alvo: `origin/integracao/fornecedores-medicoes...origin/integracao/data-pagamento`, head `8e9f44de`, PR em rascunho.
- Clone: `D:\fornecedores-work\financeiro-rev2`.
- CI do PR: run 37886077273, job `verificar` **pass**. O lint sai com código 1 (não barra), `tsc` passa, 66/66 arquivos de teste passam (pglite com 87 testes, incluindo os 7 novos do 024; `data-pagamento.test.ts` com 17), e o build compila.

## Veredito: APROVADO. Nenhum bloqueante.

Não achei cenário alcançável de dano a dado ou dinheiro, de acesso indevido ou de bloqueio da chave Omie. Os itens abaixo vão para o backlog. A principal ressalva já está no próprio PR: o 025 só pode ser ligado depois de uma leitura medida de `ListarMovimentos`, porque o mapeamento dos campos vem da documentação e não foi medido.

## 1. Rota sem sessão (`app/api/tarefas/pagamentos/route.ts`)
- O porteiro não mudou. `lib/auth/porteiro.ts:52-58` libera só `POST` sem `next-action` em `/api/tarefas/*`, o mesmo prefixo que catálogo, lançamento e programação já usam.
- O segredo é conferido em `route.ts:15` por `autorizarAgendador` (`lib/catalogo/agendador.ts`): exige no mínimo 32 caracteres, recusa quando o segredo está ausente e compara em tempo constante. Sem `FIN_CRON_SECRET`, ninguém passa.
- `GET` não é exportado e o proxy não libera outros métodos nesse prefixo.
- A rota segue o mesmo padrão de `programacao/route.ts`. Nada vaza na resposta (só `202 aceito`/`401`). O log usa só o código do erro do banco (`executar.ts:17`).

## 2. Limite do Omie
- O teto é real. `sincronizar.ts:186-190` confere `chamadas >= 10` antes de cada chamada, somando os dois filtros. O cliente é criado com `tentativas: 1` (`executar.ts:31`), então não há repetição escondida. O teste da linha 237 confere uma requisição por chamada e que o bloqueio não é repetido.
- Não há paginação infinita: o loop para em `pagina >= nTotPaginas`, em `nTotPaginas` não numérico e, em último caso, no teto de 10.
- As chamadas são sequenciais, com a pausa de 350 ms do cliente. "Consumo indevido" pede mais de 60 s, então o cliente desiste na hora e a rodada vira `falhou`, sem gravar nada.
- **Concorrência:** não existe trava entre duas execuções. Na pior hipótese são 2 × 10 chamadas. Só quem tem o segredo dispara a rota, e o `pg_cron` roda uma vez por dia. Uma repetição em menos de 60 s com os mesmos parâmetros cai em "consumo redundante", que vira `falhou`. Não chega perto de 240/min por método. → backlog (B1).

## 3. Gravação
- **Marcar como pago o que não foi pago:** exige `cStatus` PAGO/LIQUIDADO/…PARCIAL **e** `dDtPagamento` válida **e** `nValPago > 0` (`sincronizar.ts:111-125`). Status desconhecido é ignorado. O banco repete a guarda (024, `FIN_GUARD`). O casamento é exato: `nCodTitulo = codigo_lancamento_omie` **e** `ambiente`. Não casa por aproximação.
- **Natureza:** o filtro `cNatureza: "P"` vai na requisição, mas `mapearMovimento` aceita linha **sem** `cNatureza` (`sincronizar.ts:109`, `d.cNatureza !== undefined && ...`). Para virar dano, o Omie teria de ignorar o filtro, omitir o campo e ter um título a receber com o mesmo `nCodTitulo` de um título a pagar do hub. Não é alcançável na prática. → backlog (B2): exigir `cNatureza === "P"` estrito.
- **Estorno:** só vira `estornado` ou `cancelado` quando o título **aparece** no Omie em aberto ou cancelado e já tinha linha pago/parcial. Ausência na leitura nunca apaga nada. Erro no meio da leitura aborta sem gravar nada, nem o que já foi lido. Situações divergentes para o mesmo título são ignoradas na rodada.
- **Sobrescrever com vazio:** acontece só no estorno ou cancelamento acima, e de propósito: o Omie é a fonte e a cópia é derivada.
- **Apagar:** não há `delete` em lugar nenhum. O 024 não toca tabela existente (a verificação confere `fin_solicitacoes`).
- O RPC é atômico. Uma entrada ruim recusa o lote inteiro, e o teste do pglite confirma que nada fica gravado pela metade.
- Backlog:
  - **B3:** `juntarPorTitulo` usa o **maior** `nValPago`, não a soma. Se o Omie devolver uma linha por baixa com o valor da baixa, `valor_pago_centavos` fica menor que o real. A situação continua certa. Medir na leitura de validação.
  - **B4:** com o teto atingido, uma linha divergente do mesmo título pode ficar fora da leitura e escapar da checagem de divergência. Improvável com 50 por página.
  - **B5:** `codigo_lancamento_omie` não é único em `fin_solicitacoes`. Se duas solicitações apontarem para o mesmo título, as duas recebem a mesma data, o que é coerente.

## 4. Migrations 024/025
- O 024 cria uma tabela nova, um índice e duas funções. Nada fora disso.
- RLS ligada, nenhuma policy, `revoke all` de anon e authenticated na tabela. As duas funções têm `revoke execute from public, anon, authenticated` e `grant` só para `service_role`.
- As funções **não** são `security definer`: rodam como `service_role`, que já ignora RLS. `set search_path = public, pg_temp` está nas duas.
- A verificação final cobre os 13 invariantes e o teste confirma que rodar o arquivo de novo é idempotente.
- Os pré-requisitos (`select ... limit 0`) exigem 006 e **023** aplicados, então o 024 não sobe sem o 023.
- **B6:** a FK `solicitacao_id references fin_solicitacoes(id)` está **sem** `on delete cascade`, diferente de todas as outras `fin_*`. Não achei fluxo que apague `fin_solicitacoes`. Hoje o efeito seria só travar um delete manual.
- **025 realmente desligado:** o único comando ativo é um `select` de aviso. O `cron.schedule` inteiro está comentado. O nome do job começa com `financeiro-`, o horário é 07:17 UTC e o segredo fica no vault.
- **B7:** às 07:17 o job `*/15` iniciado às 07:15 ainda pode estar rodando. São métodos diferentes, então não há colisão de cota por método. Fica só a observação.

## 5. Linha alterada em `tests/hub-install-safety.test.ts:598`
- O teste é de **consistência** ("toda função citada está definida"), não de segurança.
- O lookbehind `(?<!\bexists\s)` só deixa de tratar como chamada de função o `public.x(` que vem depois de `exists `, ou seja, `create table if not exists public.t (` e `drop ... if exists public.f(`. Nenhum dos dois é chamada.
- `exists (subquery)` não tem `public.` colado, então não é afetado. Não há SQL válido com `exists public.f(...)` como chamada.
- Não afrouxou nenhuma proteção. As travas de segurança do arquivo (bloco `do`, policies, cron, grants) ficaram intactas.

## 6. Lint sem barrar no CI
- O log do run 37886077273 mostra só os dois achados antigos: `components/ui/label.tsx:9` e `tests/hub-install-safety.test.ts:75`. Os dois estão fora do diff; a linha 75 não foi tocada.
- Nenhum arquivo desta branch aparece no lint, então o `continue-on-error` não esconde nada daqui.
- **B8:** zerar os dois achados e tirar o `continue-on-error`. Sem isso, o lint deixa de proteger PRs futuros.

## Backlog (não volta ao dev como bloqueio)
B1 trava entre execuções · B2 `cNatureza` estrito · B3 soma × máximo de `nValPago` (medir) · B4 divergência com o teto · B5 código não único · B6 `on delete cascade` · B7 observar 07:15/07:17 · B8 lint barrando.
