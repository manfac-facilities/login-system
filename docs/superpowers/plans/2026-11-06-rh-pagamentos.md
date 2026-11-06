# RH: pagamentos via Financeiro, plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** criar pela porta de integração as solicitações de folha, guias, VR, VT/ajuda e PJ, com valor conferido e rateio do cadastro.

**Architecture:** porta nova no Financeiro, isolada de medições, e módulo de pagamentos no RH. As duas frentes só se tocam pelo contrato da spec.

**Tech Stack:** Next.js, Supabase com migrations manuais em `supabase/hub-install`, Vitest. Leia o `CLAUDE.md` do repositório e o guia em `node_modules/next/dist/docs/` antes de codar.

**Spec:** `C:\Users\joao-\projeto-01-elite-da-ia\docs\rh\2026-11-06-spec-pagamentos.md`. Detalhes com arquivo e linha em `docs\rh\levantamento-implementacao-pagamentos-2026-11-06.md`.

## Global Constraints

- Repositórios de trabalho: `C:\Users\joao-\AppData\Local\Temp\claude\8b487bef2614d2fb\7645a9ed-944e-4d64-8425-05f5ec28725e\scratchpad\repos\{financeiro,rh}`. Branch `rh-pagamentos`, a partir de `main` atualizada.
- Sem push, sem deploy, sem migration em produção, sem chamada ao Omie, sem dependência nova. Isso é da sessão principal.
- Dinheiro em centavos inteiros. Nenhum segredo, CPF, chave PIX ou dado real em log, teste ou commit.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01JeP5ynHqSKwA7FAcgkvt5D`.
- Interface em português, sem jargão técnico. Não mencionar saída ou demissão de alguém em texto de tela.

## Review Focus

- Clique duplo ou repetição de rede em "Criar": nunca cria duas solicitações.
- Resposta perdida depois de o Financeiro gravar: o reenvio usa a mesma chave e recupera a mesma solicitação.
- Pessoa já paga à mão no mês, com vencimento diferente: 409, mesmo com valor diferente.
- Rateio 33,33 / 33,33 / 33,34 em valor pequeno: soma exata e nenhuma linha zerada.
- Corpo do relatório colado com CPF formatado, vírgula decimal, linha em branco, nome repetido: linha ambígua nunca casa sozinha.

---

## Frente A: Financeiro

### Task A1: Migration e porta de pagamentos

**Files:**
- Create: `supabase/hub-install/047_fin_integracao_rh.sql` (confirme o próximo número livre)
- Create: `app/api/integracoes/rh/pagamentos/route.ts`, `lib/integracoes/rh-pagamentos.ts`
- Modify: `lib/solicitacoes/repositorio.ts` (tipo de origem), `lib/env.ts` (`RH_INTEGRACAO_SECRET` opcional), `.env.example`, `tests/hub-install-pglite.test.ts`
- Test: `tests/integracoes/rh-pagamentos.test.ts`

**Interfaces:**
- Produces: `receberPagamentoRh(corpo: unknown, deps): Promise<{status: number; corpo: RespostaRh}>`, com a resposta da spec.

- [ ] Escrever testes que falham, um por linha: 401 sem segredo e com segredo errado; 400 em consulta de chave inexistente; 200 em consulta existente com `valorCentavos` e `etiquetas`; 201 criando; 200 repetindo a mesma chave com valor diferente, sem alterar nada; 422 para categoria ou forma fora da lista de cada tipo; 422 com `origem` diferente de catálogo; 422 com `documentoEsperado` diferente; 409 em `salario` com solicitação ativa no mês criada à mão, com vencimento e valor diferentes; sem 409 se a anterior for `recusada` ou `cancelada`; 201 com `liberarDuplicidade` de 10 ou mais caracteres e evento registrado; 422 com motivo curto; `vr` e `vr_adicional` no mesmo mês criam ambos; 422 com solicitante fora do hub; trava de obra cria como `pendente`.
- [ ] Rodar e ver falhar: `npx vitest run tests/integracoes/rh-pagamentos.test.ts`.
- [ ] Implementar, reaproveitando `solicitacaoFormSchema`, `interpretarEnvio`, `montarPayload`, `gravarSolicitacao`. **Não alterar `lib/integracoes/medicoes.ts`.**
- [ ] Migration: só amplia o CHECK de `origem` para incluir `rh_pagamento`; ajustar o teste pglite.
- [ ] Rodar `npx vitest run` no repositório inteiro e confirmar que os testes de medições passam sem alteração.
- [ ] Commit.

### Task A2: Porta de anexos

**Files:**
- Create: `app/api/integracoes/rh/anexos/route.ts`, `lib/integracoes/rh-anexos.ts`
- Test: `tests/integracoes/rh-anexos.test.ts`

**Interfaces:**
- Consumes: solicitação achada por `chave` com origem `rh_pagamento`.
- Produces: `POST` multipart `chave`, `arquivo`; 201 `{id, nomeOriginal}`.

- [ ] Testes que falham: 401; 400 sem arquivo; 404 chave inexistente; 422 para conteúdo que não é PDF, JPG ou PNG, mesmo com extensão certa; 422 acima de 10 MB; 422 no 11º anexo; 422 em etapa fechada; 201 com autor igual ao solicitante.
- [ ] Implementar com `tipoPeloConteudo`, `caminhoDoAnexo`, `fin_registrar_anexo`.
- [ ] Rodar a suíte e confirmar. Rodar `npm run build`, se a máquina aguentar; se não, dizer isso no relatório.
- [ ] Commit.

---

## Frente B: RH

### Task B1: Banco e regras puras

**Files:**
- Create: `supabase/hub-install/004_rh_pagamentos.sql`, `lib/pagamentos/dinheiro.ts`, `lib/pagamentos/rateio.ts`, `lib/pagamentos/prazos.ts`, `lib/pagamentos/ler-relatorio.ts`, `lib/pagamentos/folha.ts`, `lib/pagamentos/vr.ts`
- Test: um arquivo em `tests/pagamentos/` para cada módulo; `tests/hub-install-pglite.test.ts`

**Interfaces:**
- Produces: `ratearCentavos(total: number, linhas: {departamento: string; percentual: string}[]): {departamento: string; valorCentavos: number}[]`; `calcularPrazo(agora: Date, vencimento: string): {primeiraJanela: string; emergencial: boolean}`; `lerRelatorio(texto: string): {linhas: LinhaRelatorio[]; erros: string[]}`; `conferirFolha(linhas, colaboradores, totalCentavos): ConferenciaFolha`; `calcularVr(colaboradores, diasUteis, ausencias, diaCentavos): CalculoVr`; `chavePagamento(tipo, competencia, alvo, tentativa): string`.

- [ ] Testes que falham: `ratearCentavos(35200, 50/33,33/16,67)` dá 17600, 11732, 5868; soma sempre igual ao total em 1 centavo, 100 centavos, 999.999 centavos; linha que daria zero é omitida; mais de 20 linhas lança erro. `calcularPrazo` com os casos da tabela do levantamento, item 4: vencimento 09/11 com envio 05/11 16h não é emergencial e com envio 06/11 é; envio depois das 17h conta como próximo dia útil. `lerRelatorio` aceita CPF formatado, vírgula, milhar e linha em branco, e devolve erro por linha inválida. `conferirFolha`: soma diferente bloqueia tudo; sem CPF com nome único exige confirmação; nome repetido nunca casa; CLT ativo sem linha gera pendência; aviso acima de 20%. `calcularVr`: PJ fora, ausência maior que os dias é erro, entrada no mês vai para crédito à parte, zero dias não gera item. `chavePagamento` nunca passa de 100 caracteres.
- [ ] Migration aditiva conforme a spec, com RLS, `revoke`, auditoria e função de ligar por CPF. Testes pglite e safety passando, incluindo: quem não tem papel não lê valor; colunas lidas pelo Orçamento intactas.
- [ ] Implementar os módulos puros. Rodar `npx vitest run`.
- [ ] Commit.

### Task B2: Cliente da porta e envio

**Files:**
- Create: `lib/pagamentos/financeiro.ts`, `lib/pagamentos/enviar.ts`, `lib/pagamentos/actions.ts`, `lib/pagamentos/queries.ts`
- Modify: `lib/env.ts`, `.env.example`
- Test: `tests/pagamentos/enviar.test.ts`

**Interfaces:**
- Consumes: contrato da spec (a Frente A pode ainda não estar pronta: use `fetch` falso nos testes).
- Produces: `enviarPagamento(id): Promise<SituacaoPagamento>`, `enviarLote(ids)`, `atualizarSituacao(id)`, `abrirNovaTentativa(id)`.

- [ ] Testes que falham: chave é gravada antes do `fetch`; 201 vira `criada`; rede caindo vira `erro` e o reenvio usa a mesma chave; 200 com valor diferente do local marca divergência e não sobrescreve; 409 vira pendência com o número existente; `abrirNovaTentativa` só com `recusada` ou `cancelada`; dois envios simultâneos do mesmo id só fazem uma chamada; papel `diretoria` e sem papel são recusados; o valor nunca vai para log.
- [ ] Implementar. Lote em série, com falha por linha sem interromper as outras.
- [ ] Rodar a suíte. Commit.

### Task B3: Telas

**Files:**
- Create: `app/(modulo)/pagamentos/` com `page.tsx` (competência), `folha/`, `guias/`, `vr/`, `vt/`, `pj/`
- Modify: `app/(modulo)/layout.tsx`, ficha em `app/(modulo)/[id]`, `next.config.ts` (`bodySizeLimit` de 11 MB)
- Test: testes de componente que o repositório já usa, mais verificação em navegador

**Interfaces:**
- Consumes: B1 e B2. Referência visual e de texto: `docs\rh\mockups\2026-11-05-rh-fase2.html`, seções 2 a 8.

- [ ] Implementar competência, folha (colar, conferir, exceções, data, criar, situação), guias, VR com crédito à parte, VT e ajuda, PJ e ficha. Estados de carregando, vazio, erro e sem permissão. Diálogo declara quantidade, total, vencimento, rateio, emergenciais e quem fica de fora.
- [ ] Botão de criar desabilita durante o envio.
- [ ] Testar localmente em desktop e 385 px, se a máquina permitir; relatar o que não deu.
- [ ] `npx vitest run`, `npm run lint`, `npm run build`. Commit.
