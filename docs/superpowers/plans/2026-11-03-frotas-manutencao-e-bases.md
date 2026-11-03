# Plano — Frotas: manutenção (revisão 10 mil km, corretiva) e bases (03/11/2026)

Spec: `docs/superpowers/specs/2026-11-03-frotas-manutencao-e-bases-design.md` (inclui o SQL literal, §5).
Mockup: `docs/frotas/mockups/2026-11-03-mockup-manutencao-e-bases.html`. Decisões: `docs/frotas/2026-11-03-decisoes-terceira-bateria.md`.

Branch/worktree próprio a partir de `master`: **`feat/frotas-manutencao`**. Antes de codar, ler `AGENTS.md`,
`.claude/rules/sofia.md`, `.claude/rules/sql.md` e, para qualquer API do Next, `node_modules/next/dist/docs/`.
TDD: teste antes do código em cada tarefa com lógica (`superpowers:test-driven-development`). Testes em `__tests__/`
ao lado do arquivo testado, nome = arquivo + `.test.ts` (ou `.<recorte>.test.ts`).

**Critério de pronto global:** `npx tsc --noEmit` limpo; `npx jest lib/sofia app/\(operacoes\)/sofia app/api/frotas`
verde (inclui `sem-admin-do-hub.test.ts` e os testes atuais das 4 bases); `npm run lint` sem erro novo;
`npm run build` ok; revisão independente (outro agente) sem bloqueante. **SQL não é aplicado por esta frente.**

---

## LISTA DE ARQUIVOS QUE A FRENTE TOCA

**Exclusivos desta frente (tarefas 1–9):**

| Arquivo | Novo/alterado |
|---|---|
| `sdd-sql-sofia-manutencao.sql`, `sdd-sql-sofia-manutencao-teste.sql` | novos |
| `lib/sofia/revisaoPrevisao.ts` (+ `__tests__/revisaoPrevisao.test.ts`) | novo |
| `lib/sofia/revisaoLeitura.ts` | novo |
| `lib/sofia/revisaoImportacao.ts` (+ `__tests__/revisaoImportacao.test.ts`) | novo |
| `lib/sofia/manutencoes.ts` (+ `__tests__/manutencoes.test.ts`) | novo |
| `lib/sofia/bases/tipos.ts`, `colunas.ts`, `filtro.ts`, `montar.ts`, `leitura.ts` (+ testes em `lib/sofia/bases/__tests__/`) | alterados |
| `lib/sofia/bases/montar-novas.ts` (+ `__tests__/montar-novas.test.ts`) | novo |
| `app/(operacoes)/sofia/_base/BaseTabela.tsx` | alterado |
| `app/(operacoes)/sofia/_base/DetalheNovas.tsx` | novo |
| `app/(operacoes)/sofia/revisoes/_actions.ts` (+ `__tests__/_actions.test.ts`, `__tests__/_actions.importar.test.ts`, `__tests__/_actions.intervalo.test.ts`) | alterado |
| `app/(operacoes)/sofia/revisoes/page.tsx`, `_painel.tsx` (novo), `_importar.tsx` (novo), `_intervalo.tsx` (novo) | |
| `app/(operacoes)/sofia/revisoes/nova/page.tsx`, `nova/_form.tsx` | alterados |
| `app/(operacoes)/sofia/revisoes/historico/page.tsx` | novo |
| `app/(operacoes)/sofia/manutencoes/_actions.ts` (+ `__tests__/_actions.test.ts`), `page.tsx`, `_tabela.tsx`, `_concluir.tsx`, `_anexo.tsx`, `nova/page.tsx`, `nova/_form.tsx` | novos |
| `app/(operacoes)/sofia/documentos/page.tsx` | alterado |
| `app/(operacoes)/sofia/sinistros/page.tsx`, `sinistros/_tabela.tsx` (novo) | |

**Compartilhados — SÓ na tarefa 10 (INTEGRAÇÃO):** `lib/sofia/queries.ts`, `lib/sofia/pendencias.ts`,
`app/(operacoes)/sofia/pendencias/page.tsx`, `lib/sofia/alertas/blocos.ts`, `lib/sofia/alertas/leitura.ts`,
`lib/sofia/alertas/__tests__/alertas.test.ts`, `lib/sofia/__tests__/pendencias.test.ts`, `components/sofia/Sidebar.tsx`,
`app/(operacoes)/sofia/veiculos/[id]/page.tsx`, `app/(operacoes)/sofia/multas/page.tsx`,
`app/(operacoes)/sofia/multas/_table.tsx`, `.claude/rules/sql.md`, `.claude/rules/sofia.md`, `docs/DIVIDAS.md`.

**Só leitura (não editar):** `lib/sofia/types.ts` (tipos novos ficam nos arquivos novos, com interseção
`Revisao & { prever_proxima: boolean; origem: 'manual' | 'importacao' }`), `lib/sofia/revisaoStatus.ts`,
`lib/sofia/permissoes.ts`, `lib/sofia/auditLog.ts`, `veiculos/_actions.ts`, `components/sofia/*` (exceto Sidebar na T10).

> Atenção de sobreposição: a frente paralela mexe em `sinistros/novo` (fotos). Esta frente só toca a **lista**
> (`sinistros/page.tsx` + `_tabela.tsx` novo). Se a outra frente também mudar `sinistros/page.tsx`, a T9-b passa para a T10.

Ordem: T1 → (T2, T3, T4 em paralelo, sem arquivo em comum) → T5 → T6 → T7 → T8 → T9 → T10 (coordenador sequencia
depois do merge da frente Multa/fotos/checklist).

---

## T1 — SQL (migration + teste)

**Arquivos:** `sdd-sql-sofia-manutencao.sql`, `sdd-sql-sofia-manutencao-teste.sql` (raiz).

1. Copiar **literal** da spec §5.1 e §5.2 (sem reformatar; final de linha LF).
2. Conferir de novo, só leitura via PAT, que nada do que o arquivo cria já existe:
   `select to_regclass('public.manutencoes'), to_regprocedure('public.sofia_abrir_manutencao(uuid,text,text,date,date,numeric,text,text,boolean,text)')`
   e colunas `revisoes.prever_proxima/origem`, `veiculos.intervalo_revisao_km`. **Nunca escrever.**

**Pronto:** arquivos idênticos aos blocos da spec (`diff` com o trecho extraído); consulta de leitura confirma que
nada existe ainda. Não aplicar.

## T2 — Regra de previsão (pura)

**Arquivos:** `lib/sofia/revisaoPrevisao.ts`, `lib/sofia/__tests__/revisaoPrevisao.test.ts`.

Exportar: `INTERVALO_REVISAO_KM_PADRAO`, `intervaloDoVeiculo`, `revisaoVigente(revs)`, `proximaEfetiva(rev, intervalo)`
→ `{ km: number|null, auto: boolean }`, `mediaKmDia(lancamentos, hoje)` → `number|null`, `classificarCarro(veiculo,
revisoesDoCarro, lancamentosKm, hoje)` → `{ s: 'atrasada'|'breve'|'dia'|'semprev'|'sembase', vigente, proxima, auto,
falta, passou, media, dias, quando, porData }`, `classificarFrota(...)` (um por veículo não inativo, ordenado
atrasada→breve→dia→semprev→sembase e por `falta`), `contarCartoes(lista)` (`atrasada`, `breve`, `d30`, `sp`),
`textoPendencia(item)` (textos do bloco 1.1 do mockup). Importa `MARGEM_AVISO_KM` de `revisaoStatus.ts` sem editá-lo.

Testes mínimos: vigente por maior KM (não por `created_at`; importada antiga não vira vigente); empate por data;
corretiva vigente com `prever_proxima=false` → `semprev`; sem revisão → `sembase`; próxima auto = km + 10.000;
intervalo próprio 15.000; `proxima_km` manual ≠ km+intervalo → `auto=false`; atrasada na igualdade (km = próxima);
atrasada por data passada; breve com 1.000 exatos; média com 1 lançamento → null; média com 2 dias; `dias = ceil`;
`quando` em AAAA-MM-DD; cartão `d30` só conta `dia` com `dias ≤ 30`.

**Pronto:** testes verdes; nenhum `Date()` sem `hoje` injetado.

## T3 — Importação (pura)

**Arquivos:** `lib/sofia/revisaoImportacao.ts`, `lib/sofia/__tests__/revisaoImportacao.test.ts`.

Exportar: `sugerirMapeamento(cabecalhos)`, `mapeamentoValido(map)`, `lerCsv(texto)` (`;`/`,`, aspas), `normalizarPlaca`,
`lerKm(valor)`, `lerData(valor)` (dd/mm/aaaa, ISO, `Date`), `lerValor(valor)`, `validarLinhas(linhas, mapa, contexto)`
com `contexto = { hoje, veiculos: {id, placa, km_atual, intervalo_revisao_km}[], existentes: {veiculo_id, km_realizada}[] }`
→ `{ linha, placa, km, data, oficina, valor, pecas, obs, veiculo_id, resultado: 'ok'|'aviso'|'erro'|'dup', motivo }[]`,
`contar(resultados)`, `linhasParaGravar(resultados, incluirAvisos)`. Limites `MAX_LINHAS = 2000`.
Textos exatos da spec §2.

Testes: as 10 linhas de exemplo do mockup (`SHEET`) dão os mesmos resultados do mockup (placa inexistente → erro; "dez
mil" → erro KM; data 2027 → erro futuro; mesma placa+KM existente → dup; KM > atual → aviso); repetida dentro do arquivo
→ dup na segunda; `30.050` → 30050; `30050,0` → 30050; célula `Date` → ISO; sugestão de mapeamento para os cabeçalhos
"Placa do carro, KM, Data feita, Oficina, Obs."; mapa sem Data → inválido; CSV com `;` e aspas.

**Pronto:** testes verdes; o mesmo `validarLinhas` serve ao navegador e à action (sem import de servidor).

## T4 — Lógica pura da corretiva

**Arquivos:** `lib/sofia/manutencoes.ts`, `lib/sofia/__tests__/manutencoes.test.ts`.

Exportar: tipos `ManutencaoStatus`, `QuemArca`, rótulos `STATUS_LBL`/`ARCA_LBL` (mockup), `proximoStatus(atual)` →
`{ para, rotulo } | null` (orçamento→aprovação→conserto→null), `diasParados(m, hoje)`,
`diasParadosNoMes(manutencoes, mes, hoje)` (por placa, só `tirou_da_equipe`, recortado ao mês), `cartoesCorretiva(...)`
(em aberto, com carro parado, custo do mês, nº de serviços com valor), `validarAbertura(form)` e `validarConclusao(form,
entrada)` com as mensagens do mockup, `caminhoAnexoValido(id, path)` (prefixo `manutencoes/<id>/`, sem `..`).

Testes: cada transição; concluída → null; dias parados com saída e sem saída (usa hoje); recorte no mês; validações.

## T5 — Motor das bases: 5 bases novas

**Arquivos:** `lib/sofia/bases/{tipos,colunas,filtro,montar,leitura}.ts`, `lib/sofia/bases/montar-novas.ts`,
testes em `lib/sofia/bases/__tests__/` (`colunas.test.ts`, `filtro.test.ts`, `montar-novas.test.ts`, `leitura.test.ts`),
`app/(operacoes)/sofia/_base/BaseTabela.tsx`, `app/(operacoes)/sofia/_base/DetalheNovas.tsx`.

1. `tipos.ts`: `BaseId` + `'rev'|'corr'|'multa'|'sin'|'doc'`; linhas `RevLinha`, `CorrLinha`, `MultaLinha`, `SinLinha`,
   `DocLinha` (campos do mockup + ids necessários às ações; **sem storage_path**, só `temArquivo: boolean`);
   `FiltrosBase` + `tipo`, `status`, `arca`, `aut`; `FILTROS_DA_BASE: Record<BaseId, CampoFiltro[]>` (inclusive as 4
   atuais, reproduzindo o que o `BaseTabela` mostra hoje).
2. `montar-novas.ts`: `montarRevisoes` (usa `classificarFrota` da T2 para marcar a vigente), `montarCorretivas` (usa T4),
   `montarMultas`, `montarSinistros`, `montarDocumentos` (situação vencido/vence30/dia).
3. `colunas.ts`: colunas de tela, rodapés e `EXCEL_*` exatamente do mockup (`BASES.*.cols`, `.total`, `.planilha`);
   `EXCEL` com `arquivo` = `revisoes`, `manutencao-corretiva`, `multas`, `sinistros`, `documentos`.
4. `filtro.ts`: `textoBusca`, `filtrarLinhas`, `filtrosDaUrl` (novas chaves; sem filtro **não** aplica período nas 5
   novas), `descreverFiltros` para as 5.
5. `leitura.ts`: `need` das 5 bases (revisões + veículos + km_diario 30 dias; manutencoes; multas com veículo/motorista;
   sinistros idem; documentos_veiculo), sempre com `buscarTudo` e o cliente do usuário. Selects com colunas explícitas
   (sem `storage_path` exceto para calcular `temArquivo`).
6. `BaseTabela.tsx`: filtros guiados por `FILTROS_DA_BASE` (remove os `base === …` dos filtros); props opcionais
   `novoHref?` (sem ele, sem botão), `selecao?`, `celula?`, `acoesDetalhe?`, `cabecalhoExtra?` (cartões acima da
   tabela); cliques em controle não abrem a gaveta; gaveta das novas em `DetalheNovas.tsx`.

Testes: colunas da planilha de cada base = lista do mockup (ordem e títulos); nenhum valor de planilha contém
`storage`/`/`-caminho; dinheiro número; filtro por situação "hist" na base rev; doc sem período; URL sem filtro nas
novas = sem período; **os testes atuais das 4 bases continuam verdes sem alteração de expectativa**.

**Pronto:** testes verdes; `/sofia/abastecimento`, `/sofia/km`, `/sofia/motoristas`, `/sofia/veiculos` idênticas
(conferir no `npm run dev` com 375px e desktop).

## T6 — Revisões: actions

**Arquivos:** `app/(operacoes)/sofia/revisoes/_actions.ts`, `revisoes/__tests__/_actions.test.ts` (estender),
`revisoes/__tests__/_actions.importar.test.ts`, `revisoes/__tests__/_actions.intervalo.test.ts`.

1. `criarRevisaoAction`: lê `modo_proxima` (`auto`|`manual`|`nao`); KM realizada obrigatório; busca o veículo
   (`km_atual`, `intervalo_revisao_km`) e a vigente; erro "O KM (X) é menor que o da última revisão deste carro (Y).
   Confira o número." quando aplicável; grava `prever_proxima`, `origem: 'manual'`, `proxima_km` (auto = recalculado no
   servidor; manual = informado, obrigatório; nao = null). **Sem guarda nova** (colisão 2 da spec). Mantém peças.
2. `importarRevisoesAction(linhas, incluirAvisos)`: `requireGestorFrotas`; revalida com `validarLinhas` (T3) contra o
   banco; `insert([...])` único; `logAudit`; devolve `{ importadas, avisosIncluidos, erros, repetidas }`. Lista vazia →
   "Nenhuma linha para importar".
3. `definirIntervaloRevisaoAction`: `requireGestorFrotas`; vazio = null; inteiro 1.000–100.000; `logAudit('veiculos',
   'atualizou', id, 'Intervalo de revisão: X km')`; `revalidatePath('/sofia/revisoes')` e da ficha.
4. `excluirRevisaoAction` continua igual.

Testes (mock do Supabase como os atuais): auto grava km+10.000 mesmo se o form mandar outro `proxima_km`; intervalo
próprio; manual sem KM → erro; `nao` → `prever_proxima=false` e `proxima_km=null`; KM menor que a vigente com data
posterior → erro; importar sem gestor → `MSG_SEM_PERMISSAO_FROTAS` e nenhum insert; importar com aviso desmarcado não
grava aviso; repetida no banco não grava; intervalo 500 → erro, vazio → null, sem gestor → negado.

## T7 — Revisões: telas

**Arquivos:** `lib/sofia/revisaoLeitura.ts`, `app/(operacoes)/sofia/revisoes/page.tsx`, `revisoes/_painel.tsx`,
`revisoes/_importar.tsx`, `revisoes/_intervalo.tsx`, `revisoes/nova/page.tsx`, `revisoes/nova/_form.tsx`,
`revisoes/historico/page.tsx`.

1. `revisaoLeitura.ts`: `carregarPainelRevisoes()` (RLS; veículos não inativos, revisões, `km_diario` dos últimos 30
   dias, equipes; `podeGerir`), devolve `classificarFrota` + cartões + intervalo/“N com intervalo próprio”.
2. `page.tsx` + `_painel.tsx`: tela 1 da spec §1.2 (filtro `?sit=` dos cartões; botão Importar só se `podeGerir`).
3. `_importar.tsx`: diálogo de 4 passos (spec §2), exceljs por import dinâmico; "Baixar modelo" e "Baixar relatório
   de erros" geram `.xlsx` no navegador; ao terminar, `router.refresh()`.
4. `nova/page.tsx` + `_form.tsx`: spec §1.3 (`?veiculo=` pré-seleciona; precisa de `km_atual`, `intervalo_revisao_km`
   e média km/dia do carro — passados pela página).
5. `historico/page.tsx`: `BaseTabela` com `base="rev"`, `novoHref="/sofia/revisoes/nova"`.
6. `_intervalo.tsx`: componente client (campo + Salvar) para a ficha do veículo (montado na T10).

**Pronto:** com dados reais em dev (só leitura): 18 carros com revisão aparecem; um carro cuja vigente é corretiva
mostra "Sem previsão automática"; a importação com a planilha de exemplo do mockup (montada em `.xlsx`) dá os mesmos
contadores do mockup **na prévia** (não gravar em produção); 375px sem rolagem horizontal da página.

## T8 — Manutenção corretiva: actions e telas

**Arquivos:** `app/(operacoes)/sofia/manutencoes/_actions.ts`, `manutencoes/__tests__/_actions.test.ts`,
`manutencoes/page.tsx`, `manutencoes/_tabela.tsx`, `manutencoes/_concluir.tsx`, `manutencoes/_anexo.tsx`,
`manutencoes/nova/page.tsx`, `manutencoes/nova/_form.tsx`.

1. Actions da spec §3.2: `abrirManutencaoAction` (RPC `sofia_abrir_manutencao`), `avancarStatusManutencaoAction`,
   `concluirManutencaoAction` (RPC `sofia_concluir_manutencao`), `anexarManutencaoAction`, `verAnexoManutencaoAction`.
   Todas as de escrita com `requireGestorFrotas` primeiro. Erro com `code === 'SOF01'` → `error.message`; outro →
   mensagem genérica + `console.error`.
2. `page.tsx`: cartões (T4) + `BaseTabela base="corr"` (`novoHref` só para gestor) + gráfico de dias parados do mês
   (barras CSS, como o mockup). `_tabela.tsx` (client) passa `acoesDetalhe` com avançar status / concluir / anexo.
3. `nova/page.tsx`: não gestor → `redirect('/sofia/manutencoes')`; `_form.tsx` conforme spec §3.1, `?veiculo=` opcional.
4. Upload do anexo no navegador para `sofia-anexos` no padrão de `documentos/novo/_form.tsx` (mesmos tipos e limite).

Testes: sem gestor → negado sem chamar RPC; RPC recebe os 10 parâmetros na ordem certa (`p_tirar_da_equipe` do
checkbox); erro SOF01 repassa a mensagem; avançar status com transição inválida → erro sem update; update com 0 linhas →
mensagem de "mudou"; concluir repassa SOF01; anexar com caminho de outro id ou com `..` → erro; ver anexo lê o caminho
do banco, nunca do form.

**Pronto:** testes verdes; tela e formulário a 375px; usuário comum vê e exporta, sem botões de escrita.

## T9 — Bases de Documentos e Sinistros

**Arquivos:** `app/(operacoes)/sofia/documentos/page.tsx`; `app/(operacoes)/sofia/sinistros/page.tsx`,
`app/(operacoes)/sofia/sinistros/_tabela.tsx` (novo, client).

a. Documentos: `BaseTabela base="doc"`, `novoHref="/sofia/documentos/novo"`; gaveta com `VerArquivoButton`
   (action existente `documentos/_actions.ts`).
b. Sinistros: `_tabela.tsx` envolve `BaseTabela base="sin"` passando `celula` para a coluna de autorização
   (`AutorizacaoActions` com `atualizarAutorizacaoSinistroAction.bind(null, id)`, `showActions={podeGerir}`) e
   `acoesDetalhe` com "Abrir sinistro" (`/sofia/sinistros/[id]`) e Excluir (`DeleteConfirmButton` +
   `excluirSinistroAction`, só gestor) — **as mesmas actions e regras de hoje**.

**Pronto:** as ações de autorização e exclusão de sinistro funcionam igual a antes (conferir em dev com um registro de
teste local, não em produção); exportar sem caminho de arquivo.

## T10 — INTEGRAÇÃO — arquivo compartilhado (coordenador sequencia, depois do merge da frente Multa/fotos/checklist)

Pequena e mecânica; cada item é troca de chamada ou ligação de componente pronto.

| Arquivo | Mudança |
|---|---|
| `lib/sofia/queries.ts` | `classificarRevisoesMaisRecentes` passa a usar `classificarFrota` (T2): lê `revisoes` com `km_realizada, data_realizada, prever_proxima`, `veiculos(placa, km_atual, intervalo_revisao_km)` e `km_diario` 30 dias. `getRevisoesAtrasadas`/`getRevisoesVenceEmBreve` mantêm o tipo de retorno |
| `lib/sofia/pendencias.ts` (+ `__tests__/pendencias.test.ts`) | entrada opcional `revisoesVenceEmBreve` → "Revisão chegando: PLACA — faltam X km para Y" (origem `manutencao`, sem `prazoKm`) |
| `app/(operacoes)/sofia/pendencias/page.tsx` | passa `getRevisoesVenceEmBreve()` |
| `lib/sofia/alertas/leitura.ts`, `blocos.ts` (+ `__tests__/alertas.test.ts`) | troca a escolha "mais recente por created_at/tipo" pela regra da T2; títulos/textos dos blocos iguais |
| `components/sofia/Sidebar.tsx` | grupo de Revisões: + "Histórico de revisões" (`/sofia/revisoes/historico`) e "Manutenção corretiva" (`/sofia/manutencoes`) logo após "Revisões" |
| `app/(operacoes)/sofia/veiculos/[id]/page.tsx` | monta `revisoes/_intervalo.tsx` (só gestor) perto do bloco "Oficina" |
| `app/(operacoes)/sofia/multas/page.tsx`, `multas/_table.tsx` | `carregarBase('multa')` + `MultasTable` envolvendo `BaseTabela base="multa"` com `selecao` (enviar para desconto / excluir em massa, só página visível), `celula` (`AutorizacaoActions`) e `acoesDetalhe` (excluir). **Mesmas actions de hoje** e, se a outra frente tiver mudado colunas/ações, adaptar as colunas da base a elas |
| `.claude/rules/sql.md` | linha `sofia-manutencao` = **NÃO APLICADO** (até o João autorizar) |
| `.claude/rules/sofia.md` | seção curta: `manutencoes` (RLS, RPCs, sem DELETE), regra da revisão vigente, importação |
| `docs/DIVIDAS.md` | itens da spec §7 |

Testes: `pendencias.test.ts` (vence em breve não conta como urgência alta), `alertas.test.ts` (importada antiga não vira
vigente; corretiva vigente sai dos blocos), jest do Sofia inteiro verde.

**Pronto:** critério global acima + conferência em dev de Pendências, Visão geral, Multas (seleção em massa, desconto,
autorização, excluir iguais a antes) e do texto do e-mail (`route.test.ts` verde).

---

## Depois do código (fora desta frente, para o coordenador)

1. Revisão independente (agente diferente; território de exceção: RLS/autorização/escrita de status de veículo).
2. João autoriza por escrito → aplicar `sdd-sql-sofia-manutencao.sql` (verificação 22/22 `OK`) → rodar
   `sdd-sql-sofia-manutencao-teste.sql` (30/30 `OK`, rollback) → atualizar `sql.md` → merge → push → João clica Deploy →
   conferir chunks. **SQL antes do deploy.**
3. Pedir ao Igor a planilha real antes da primeira importação.
