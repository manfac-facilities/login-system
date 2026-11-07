# Revisão independente — F6.1 no Financeiro (seguro e celular na porta do RH), 07/11/2026

- Repositório: `manfac-facilities/financeiro`, branch `fin-seguro-celular`, HEAD `7644098`, comparado com `main` `cfcefb2`.
- Contrato do outro lado: `manfac-facilities/rh`, branch `rh-f6` (HEAD `8f3a099`), lido por `git show` num clone sem checkout.
- Revisor não escreveu o código. Nada foi alterado, commitado ou pushado; nenhum banco real, nenhuma app logada.

## Veredito

**Zero bloqueios.** Três itens de backlog, um deles (categorias não conferidas) é pré-condição de deploy já declarada no próprio código e na spec.

## O que rodou

- `package-lock.json` idêntico ao de `D:\rh-work\fin-f6` (`cmp`); `node_modules` copiado de lá com robocopy. Sem `npm ci`, sem `npx`.
- `tsc --noEmit`: verde.
- 21 suites que tocam `fin_solicitacoes`, duplicidade, etiquetas, medições e instalação no hub (`rh-pagamentos`, `integracoes-medicoes`, `hub-install-pglite`, `hub-install-safety`, `solicitacoes-*`, `avisos-mensagens`, `regularizacao-*`, `obra-actions`, `faturamento-*`, `caixinha-leitura`, `programacao-leitura-classificacao`, `nota-form-partes`): 794 testes verdes. Um teste (`sem segredo no servidor: 401 antes de montar o cliente de serviço`) estourou os 5 s **na primeira rodada a frio** (import dinâmico da rota levou ~10 s); rodado de novo, a suite inteira de `rh-pagamentos` passou 40/40 na branch, e o mesmo teste passou em `cfcefb2`. Não é efeito da mudança (a rota não foi tocada). Sem build, como pedido.
- 7 testes descartáveis da revisão (em `tests/_rev/`, apagados com o clone), todos verdes — detalhados abaixo.

## Foco 1 — escopo do diff

`git diff --stat cfcefb2..7644098`: só `lib/integracoes/rh-pagamentos.ts` (+23/−1) e `tests/integracoes/rh-pagamentos.test.ts`. Entraram apenas `seguro` e `celular` em `TIPOS_RH` e `LISTA_PERMITIDA`, mais a constante `CATEGORIAS_A_CONFIRMAR`. Nenhuma linha dos oito tipos antigos mudou; `medicoes.ts`, rota, repositório e SQL intactos.

Prova por teste: `a lista é a da spec, sem nada a mais` (`tests/integracoes/rh-pagamentos.test.ts:326`) compara `LISTA_PERMITIDA` inteira com `toEqual`, incluindo os oito antigos com categoria, formas e flag de duplicidade. Medições: `integracoes-medicoes.test.ts` verde.

## Foco 2 — validação

Ordem em `receberPagamentoRh` (`lib/integracoes/rh-pagamentos.ts:174-195`): segredo → chave → leitura da chave → envelope → `recusaDaLista` (categoria exata, forma da lista, origem `catalogo`, rateio em valor) → schema completo. Conferido:

- seguro com categoria `2.04.05` e celular com `2.03.13`: 422, sem ler catálogo e sem gravar (teste `:347`).
- forma fora da lista: o teste `:366` percorre `TIPOS_RH`, então já cobre `seguro`/`celular` com `pix_chave` e `guia` → 422. Reconfirmado em teste descartável.
- `seguro` e `celular` com `boleto` e com `pix_qrcode`: 201 (teste `:399`).
- tipo desconhecido (`Seguro`, `seguro_vida`, `telefone`, vazio): **400**, não 422 (cai no `z.enum` do envelope), sem gravar. Comportamento anterior à mudança; não grava nada, então não é problema de dinheiro.
- categoria com espaços (`" 2.03.13 "`): aceita, porque o envelope faz `trim` antes de comparar. Inofensivo.

## Foco 3 — duplicidade

- `seguro`: `bloqueiaDuplicidade: true` → `procurarAtivasNoMes` (`lib/solicitacoes/repositorio.ts:287`) procura em `fin_solicitacoes` por ambiente, etapa fora de `cancelada/recusada`, documento, categoria e mês **do vencimento** — sem filtro de origem, portanto pega o lançado à mão. Teste novo `:551` (lançado à mão, outro valor, outra chave → 409). Descartável confirmou: chave diferente + valor diferente no mesmo mês de vencimento → 409.
- `celular`: `bloqueiaDuplicidade: false` → nunca consulta o mês; cria com `possivel_duplicidade` quando a duplicidade comum casa (teste `:619` e descartável).
- **Corrida (BACKLOG, ver B1):** reproduzida em teste descartável com banco falso compartilhado: duas chamadas simultâneas de `seguro`, chaves diferentes (`rh:seguro:2026-11:seguro:t1` e `rh:seguro:2026-10:seguro:t1`), mesmo documento, mesmo mês de vencimento → **201 e 201**. A trava do banco (`pg_advisory_xact_lock` no 023) é por chave, não por documento+categoria+mês.

## Foco 4 — autorização e consulta

`autorizarAgendador` e a rota não mudaram no diff. Corpo só com `chave` continua sendo consulta: existente → 200 sem validar nada; inexistente → 400 (`:180`). Descartável: consulta com chave de seguro e Bearer errado → 401.

## Foco 5 — Omie, tabelas e CHECK

- Nenhuma escrita no Omie no diff; a porta cria a solicitação em etapa de aprovação pelas mesmas funções de sempre (`fin_criar_solicitacao_integrada`, 023/044).
- Nenhuma tabela nova tocada. O `tipo` do RH vai só para `dados_evento.integracao.tipo` (jsonb). `fin_solicitacao_integracoes` (023) não tem coluna `tipo`; o 047 só amplia o CHECK de `origem`. Varri `supabase/hub-install/*.sql` até a 047: os CHECKs de `tipo` existentes são de outras tabelas (`fin_eventos`, regularização, conciliação, caixinha, programação) e não recebem esse valor. Nada recusaria `seguro`/`celular`.

## Foco 6 — contrato com o RH (`rh-f6`)

| Item | Financeiro (`fin-seguro-celular`) | RH (`rh-f6`) | Bate |
|---|---|---|---|
| Tipos | `TIPOS_RH` com `seguro`, `celular` | `TIPOS_PAGAMENTO` (`lib/pagamentos/regras.ts`) idem, mesma lista de 10 | sim |
| Categoria seguro | `2.03.13` | `CATEGORIAS_SEGURO_CELULAR.seguro = "2.03.13"` | sim |
| Categoria celular | `2.04.05` | `"2.04.05"` | sim |
| Formas | `pix_qrcode`, `boleto` | `boleto`, `pix_qrcode` (e CHECK do `015_rh_...sql:58`) | sim |
| Duplicidade | seguro bloqueia, celular não | `temBloqueioDeDuplicidade` inclui `seguro`, não `celular` | sim |
| Campos | `chave, tipo, competencia, solicitanteEmail, documentoEsperado, liberarDuplicidade, solicitacao{fornecedor.origem, formaPagamento, categoriaCodigo, rateioModo, ...}` | `montarCorpo` em `lib/pagamentos/enviar.ts:66` manda exatamente esses, `origem: "catalogo"`, `rateioModo: "valor"`, categoria por `categoriaDoTipo` | sim |
| Chave | ≤ 100 caracteres | `rh:seguro:<aaaa-mm>:seguro:t<n>` (`chave.ts`, alvo fixo `seguro`/`celular` no 015) | sim |
| Tipo de documento | carregado do catálogo | `BOL` / `PIXQC` | sim (mesmo par já usado por VT) |

## Backlog

**B1 — Corrida de seguro com chaves diferentes no mesmo mês.** `lib/integracoes/rh-pagamentos.ts:207-226` faz ler-depois-gravar sem trava por documento+categoria+mês. Cenário: duas chamadas de seguro com chaves diferentes chegam juntas (do RH, só acontece com duas competências enviadas ao mesmo tempo com vencimento no mesmo mês, já que a `t2` só nasce depois de `t1` recusada/cancelada e a reserva do RH impede clique duplo; ou uma chamada do RH concorrendo com um lançamento à mão). Resultado: duas solicitações, e nenhuma ganha `possivel_duplicidade`, porque `procurarDuplicadas` também lê antes. Não é bloqueio: é o mesmo comportamento já em produção para `salario`, `vt`, `ajuda_custo` e `pj`, a janela é de milissegundos, e as duas param em `aguardando_financeiro`/diretor, com aprovação humana antes do Omie. Correção sugerida, se quiser fechar: `pg_advisory_xact_lock` por `ambiente:documento:categoria:mês` dentro de `fin_criar_solicitacao_integrada`, repetindo a busca do mês ali — é migration, precisa da decisão do João.

**B2 — Categorias `2.03.13` e `2.04.05` não conferidas no catálogo do Omie.** Já declarado em `CATEGORIAS_A_CONFIRMAR` e na spec (`docs/rh/2026-11-06-spec-modulos.md:639`). Se o código não existir/estiver inativo, a porta recusa (422, `preparar.ts:173`) — falha fechada. O risco real é o código existir com outro significado ("Telefonia" para celular é inferência): o título seria classificado na conta errada do DRE. Conferir em `fin_catalogo_*` ou com o Jose Guilherme **antes do deploy**.

**B3 — Teste da rota sensível a import frio.** `tests/integracoes/rh-pagamentos.test.ts:711` usa o timeout padrão de 5 s e importa a rota dinamicamente; na primeira rodada da máquina levou ~10 s e falhou. Passa nas rodadas seguintes e em `main`. Sugestão: `{ timeout: 30_000 }` nesse teste. Não é da mudança.

## O que não deu para verificar

- Se `2.03.13` e `2.04.05` existem e significam seguro de vida e telefonia no Omie de produção (não consultei banco nem Omie, por regra).
- A corrida foi reproduzida com repositório falso, não com Postgres de verdade; a conclusão vale porque o caminho do código não tem trava por mês e a trava do banco (023) é só por chave.

Clones `D:\rh-work\rev-fin` e `D:\rh-work\rev-rh-ro` removidos ao fim (ver resumo).
