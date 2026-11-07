# RH: módulos restantes, plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** cobrir as 18 áreas do documento do cliente com um sistema organizado por módulos e registros, responsivo em quatro larguras, sem mudar o que o Orçamento lê.

**Architecture:** app `rh` com moldura nova e um padrão de módulo único. Cada módulo tem migration, `lib/<modulo>/`, rotas e testes próprios. Módulos não se conhecem no banco: falam por `lib/modulos/registro.ts`. Só a conclusão de uma movimentação muda cadastro.

**Tech Stack:** Next.js 16 (`proxy.ts`, `searchParams` como Promise), TypeScript strict, Supabase com migrations manuais, Zod 4, shadcn base-nova (`render={<X />}`), Tailwind 4 com container queries, Vitest + PGlite, Biome.

**Spec:** `C:\Users\joao-\projeto-01-elite-da-ia\docs\rh\2026-11-06-spec-modulos.md`. Leia a seção do módulo antes de codar. Desenho: `docs\rh\mockups\2026-11-06-rh-modulos.html`, funções `V.<modulo>` e `reg*`.

## Global Constraints

- Repositório: `C:\Users\joao-\AppData\Local\Temp\claude\8b487bef2614d2fb\7645a9ed-944e-4d64-8425-05f5ec28725e\scratchpad\repos\rh`, branch `rh-modulos`. Cada frente paralela numa worktree própria, a partir de `rh-modulos` com F0 e F1 mergeadas. F6 também toca `repos\financeiro`, branch nova a partir de `main` atualizada.
- Leia `CLAUDE.md` do RH inteiro, `supabase/hub-install/README.md` e o guia em `node_modules/next/dist/docs/` antes de codar. As regras numeradas não se dobram.
- **Sem push, sem deploy, sem migration em produção, sem chamada ao Omie.** Isso é da sessão principal, com autorização do João.
- **Nunca rode a app logada localmente:** grava no banco de verdade. Testes não dependem dela. Para ver tela, use a vitrine (F0.6).
- Sem nome de pessoa real em teste, fixture, commit ou documento. Use "Pessoa Exemplo". Sem segredo, CPF real, chave PIX ou valor real em log.
- Dinheiro em centavos inteiros. `ActionResult` em toda função do servidor, nunca `error.message`. Trava do banco começa com `RH_GUARD:`.
- **Tudo aditivo:** `status` e `tipo_contratacao` sem valor novo, `salario_centavos` sempre o vigente, nenhuma coluna lida pelo Orçamento renomeada.
- Interface em português coloquial, sem jargão. Fim de vínculo só como "Encerramento de vínculo".
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e `Claude-Session: https://claude.ai/code/session_01JeP5ynHqSKwA7FAcgkvt5D`.
- Menor mudança que entrega a tela. O improvável vai para `docs/DIVIDAS.md` do RH, com data e motivo.

## Pronto de cada frente

Vale para todas, além do que a frente listar:

```bash
npx tsc --noEmit
npm run test
npm run build
npx biome check .
```

Mais: cada tela nova conferida na vitrine nas 4 larguras (390×844, 820×1180, 1366×768, 1920×1080), com os 5 itens da seção 9 da spec; revisão independente, por agente que não executou; nenhuma regra de `tests/hub-install-safety.test.ts` afrouxada.

**Se `npm run build` não couber na memória da máquina**, diga isso no relatório. Não dê como verde sem ter rodado.

## Review Focus

- Concluir duas vezes, em paralelo, ou com rede repetida: uma só aplicação.
- Cadastro mudou depois de abrir a alteração: recusa, nunca sobrescreve.
- Qualquer caminho que mude dado de pessoa sem `rh.via_movimentacao`.
- Valor, CPF, CID ou arquivo saindo para `diretoria` ou admin onde a spec proíbe. Conferir no retorno da função, não na tela.
- Link de arquivo gerado antes de conferir a classe.
- Coluna cortada ou rolagem horizontal em qualquer largura.

---

## Paralelismo e conflitos

**Ordem:** F0, depois F1. Depois de mergeadas, **F2, F3, F4 e F5 rodam em paralelo**, porque cada uma é dona de rotas, `lib/<modulo>`, componentes e migration próprios. **F6 só depois de F3**, porque as duas tocam `/pagamentos` e `lib/pagamentos/rotulos.ts`. Dentro de F2, férias, exames e contratos também podem ser separados: compartilham só o padrão.

De dia, com o João no PC, no máximo 2 agentes ao mesmo tempo (regra dele); à noite, sem limite.

| Frente | Migrations | Pasta exclusiva | Depende de | Paralela com |
|---|---|---|---|---|
| F0 | 005 | `components/modulo`, `lib/modulos`, `lib/etapas`, `lib/arquivos`, `lib/historico`, `lib/avisos`, `app/vitrine` | — | — |
| F1 | 006, 007 | `lib/pessoas`, `lib/movimentacoes`, `lib/agenda`, `lib/inicio` | F0 | — |
| F2 | 008, 009, 010 | `lib/ferias`, `lib/exames`, `lib/contratos` | F1 | F3, F4, F5 |
| F3 | 011 | `lib/ponto`, `app/(modulo)/ponto`, `/pagamentos/page.tsx` | F1 | F2, F4, F5 |
| F4 | 012 | `lib/patrimonio`, `app/(modulo)/patrimonio` | F1 | F2, F3, F5 |
| F5 | 013, 014 | `lib/recrutamento`, `lib/comunicacao` | F1 | F2, F3, F4 |
| F6 | 015 + Financeiro | `lib/beneficios`, `lib/seguro`, `lib/celular`, `lib/pagamentos/*` | F3 | F2, F4, F5 |

**Como não colidir:**

| Arquivo disputado | Regra |
|---|---|
| **Numeração** | Reservada na tabela acima. Ninguém escolhe número. Módulos depois de F1 não se referenciam em SQL, então a ordem entre 008 e 014 não importa. Vale o teste do nome `NNN_rh_*.sql` |
| **Navegação** | `lib/modulos/registro.ts` nasce em F0 com os 13 módulos, um por linha, separados por um comentário de uma linha, com `ligado: false`. A frente muda só a linha dela. Linhas não vizinhas não dão conflito no git |
| **Abas da ficha** | F1 cria `app/(modulo)/pessoas/[id]/_abas/<aba>.tsx` para todas, com o estado "em breve" das não prontas. A frente só substitui o arquivo dela |
| **`types/supabase.ts`** | **Só o coordenador mexe, depois de aplicar em produção** (`npm run types`). Antes disso, `lib/supabase/rpc.ts` (F0) dá `chamarRpc<T>(cliente, nome, args)`, com o tipo de retorno declarado em `lib/<modulo>/tipos.ts`. Nunca escreva à mão em `types/supabase.ts` |
| **Testes de banco** | `tests/hub-install-pglite.test.ts` não recebe bloco novo. Cada migration tem `tests/hub-install/NNN-*.test.ts`, com banco próprio |
| **`tests/stubs/supabase-minimo.sql`, `package.json`, `globals.css`, `.env.example`, `next.config.ts`** | Só F0. Se outra frente precisar, pare e avise o coordenador |
| **`README` do hub-install e `CLAUDE.md`** | O coordenador atualiza ao mergear |
| **`lib/vitrine/dados`** | Um arquivo por módulo, e índice com uma linha por módulo, como o registro |

---

## F0: Moldura e padrão de módulo

**Migration:** `005_rh_modulos_base.sql`. **Arquivos da frente:** `app/(modulo)/layout.tsx`, `components/modulo/*`, `lib/modulos/*`, `lib/etapas/*`, `lib/arquivos/*`, `lib/historico/*`, `lib/avisos/*`, `lib/supabase/rpc.ts`, `app/vitrine/*`, `lib/vitrine/*`, `proxy.ts`, `lib/auth/porteiro.ts`, `app/globals.css`, `next.config.ts` (só se preciso), `package.json`, `.env.example`, `tests/apoio/banco.ts`.

**Nada do produto muda de lugar nesta frente:** `/` continua a lista e `/[id]` a ficha. Só a moldura muda, com Colaboradores, Pagamentos e Papéis ligados.

### Task F0.1: ajudante de banco e migration 005

- [ ] Criar `tests/apoio/banco.ts`: `abrirBanco(ate: string)` sobe PGlite, aplica `tests/stubs/supabase-minimo.sql` e os SQL até o número pedido; exporta `como`, `falhaCom`, `contar`, `valor`, iguais aos de `tests/hub-install-pglite.test.ts`.
- [ ] Escrever `tests/hub-install/005-base.test.ts`, falhando: `authenticated` e `anon` não leem `rh_etapas`, `rh_arquivos`, `rh_historico`, `rh_avisos`; não executam escrita; `rh_etapas_criar` repetida não duplica; `rh_etapa_registrar` recusa cada `exige` sem o dado (`data`, `texto`, `arquivo`, `escolha`), recusa `auto` por fora e "não se aplica" em passo obrigatório ou sem motivo; `rh_historico` não aceita update nem delete, e recusa CPF no texto; `rh_arquivo_caminho` devolve caminho a `rh`, nada a `diretoria` em classe `saude`, nada a admin em nenhuma classe, nada de arquivo removido; aviso com a mesma chave não é reservado duas vezes.
- [ ] Em `tests/hub-install-pglite.test.ts`, trocar o filtro de arquivos para aplicar só até o `004`, com comentário do motivo. Ele prova o estado até ali; os testes de 005 em diante têm banco próprio. Sem isso, a trava do 006 quebraria as gravações diretas dele.
- [ ] Rodar: `npx vitest run tests/hub-install/005-base.test.ts`. Esperado: falha, o arquivo não existe.
- [ ] Escrever `supabase/hub-install/005_rh_modulos_base.sql` conforme a seção 7 da spec, com bloco de verificação no fim, como o 004.
- [ ] Rodar o teste e `npx vitest run tests/hub-install-safety.test.ts tests/hub-install-pglite.test.ts`. Esperado: tudo verde.
- [ ] Commit `feat(base): etapas, arquivos, histórico e avisos (005)`.

### Task F0.2: regras puras

- [ ] Testes, falhando: `tests/modulo/larguras.test.ts`, para `conferirLarguras(colunas)`: acusa quando, numa faixa de 640, 900, 1200 ou 1500 px, a soma das colunas visíveis passa da faixa; `tests/modulo/etapas.test.ts`, para `proximoPasso`, `progresso`, `agrupar`; `tests/modulo/arquivos.test.ts`, para caminho sem nome de pessoa, e `conteudoPermitido`; `tests/modulo/registro.test.ts`: os 13 módulos existem na ordem do mockup, e só os ligados aparecem.
- [ ] Implementar `lib/modulos/colunas.ts`, `lib/modulos/registro.ts` (seção 7.5), `lib/etapas/regras.ts`, `lib/etapas/modelos/tipos.ts`, `lib/arquivos/caminho.ts`.
- [ ] Rodar os testes. Commit `feat(modulo): regras puras do padrão de módulo`.

### Task F0.3: servidor de arquivos, etapas e avisos

- [ ] Testes, falhando, com `vi.mock` no padrão de `tests/colaboradores-actions.test.ts`: subir com pasta pública recusa; arquivo vazio, acima de 10 MB, ou com conteúdo errado recusa; falha ao registrar remove o objeto; `abrirArquivo` não gera link se `rh_arquivo_caminho` devolver nada; quem não é `rh` não sobe; `tests/avisos/configuracao.test.ts`, copiado do Compras, com faltar qualquer variável = `null`; `tests/avisos/enviar.test.ts`: sem SMTP grava `sem_configuracao` e nada finge ter enviado; erro grava só o código; `tests/avisos/textos.test.ts`, regra que varre os modelos de e-mail contra padrões de `R$` e CPF.
- [ ] Acrescentar `nodemailer` e `@types/nodemailer` em `package.json`. **Dependência nova com autorização do coordenador**, já dada por esta spec.
- [ ] Implementar `lib/arquivos/actions.ts`, `lib/etapas/actions.ts`, `lib/avisos/{configuracao,smtp,enviar}.ts`, `lib/supabase/rpc.ts`. Atualizar `.env.example`.
- [ ] Rodar testes. Commit `feat(base): arquivos, etapas e avisos no servidor`.

### Task F0.4: componentes do padrão

- [ ] Em `app/globals.css`: `--breakpoint-tab`, `--breakpoint-note`, `--breakpoint-larga` e tokens da lateral. O tema da marca não muda.
- [ ] Teste por `renderToStaticMarkup` em `tests/modulo/componentes.test.ts`: `TabelaResponsiva` gera tabela e cartões, e cada coluna recebe a classe da prioridade; `Indicadores` são botões com `aria-pressed`; `Andamento` não contém "Marcar como feito"; `ProximoPasso` pede o dado conforme `exige`; item de lateral tem `aria-label` com o contador; `PaginaRegistro` não renderiza ações se `podeEditar` for falso.
- [ ] Implementar `components/modulo/*`, seguindo `regH`, `tabela`, `kpiH`, `tempoH`, `proxH`, `docsH`, `histH` do mockup, sem copiar o HTML gerado: use shadcn e Tailwind. Ícones de `lucide-react`.
- [ ] Rodar testes. Commit `feat(modulo): componentes do padrão`.

### Task F0.5: moldura

- [ ] Testes, falhando: `tests/modulo/moldura.test.ts`: lateral com os ligados e o pé (Hub, Papéis só para admin, Sair); barra inferior com Início, Pessoas, Agenda e Menu; texto com nome e papel; `tests/porteiro.test.ts` segue verde.
- [ ] Trocar `app/(modulo)/layout.tsx`: `requireSessao`, calcula contadores com `Promise.allSettled`, entrega `Casca`. Mantém a checagem de sessão, pelo gap do `/rh`. Casca só recebe props, sem nenhuma leitura.
- [ ] `BuscaGeral`: mínimo de 2 caracteres, espera de 250 ms, action `buscarGeral` chama `busca` dos módulos ligados, com fonte falha indicada na lista. No celular, abre em diálogo.
- [ ] Ajustar `components/pagamentos/moldura.tsx` e páginas só no necessário para a largura nova. Tela de Pagamentos com os rótulos e regras de hoje.
- [ ] Rodar. Commit `feat(moldura): lateral, barra inferior e busca geral`.

### Task F0.6: vitrine

Ver tela nas 4 larguras sem login e sem tocar no banco.

- [ ] Teste em `tests/porteiro.test.ts`: `decideGate` com `vitrine: true` e caminho `/vitrine/x`, sem sessão, deixa passar; com `vitrine: false`, vai para o login do hub; `vitrineLigada({NODE_ENV:"production", RH_VITRINE:"1"})` é `false`; caminho que só começa parecido (`/vitrinex`) não passa.
- [ ] Teste de texto: nenhum arquivo sob `app/vitrine` ou `lib/vitrine` importa `lib/supabase`, `queries`, nem `lib/auth/sessao`.
- [ ] Implementar `vitrineLigada`, ajustar `decideGate` e `proxy.ts` (retorna antes de `updateSession`), `app/vitrine/layout.tsx` com sessão fictícia e `app/vitrine/[tela]/page.tsx` (`notFound()` se desligada), `lib/vitrine/dados/` e `scripts/vitrine.mjs`, que sobe `next dev` com `RH_VITRINE=1` e `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9`, sem chave de serviço.
- [ ] Conferir com `plugin_playwright` nas 4 larguras: `scrollWidth <= clientWidth`, lateral nas quatro formas. Salvar captura em pasta temporária, fora do repositório.
- [ ] Commit `feat(vitrine): telas com dados fictícios, só em desenvolvimento`.

**Pronto de F0:** comum, mais moldura vista na vitrine nas 4 larguras, e Colaboradores e Pagamentos funcionando sem mudança de regra.

**Autorização do João:** aplicar `005`; criar a pasta `rh-arquivos`; caixa de e-mail e `SMTP_*` (opcional); deploy; merge e push.

---

## F1: Pessoas, Admissões e alterações, Agenda, Início

**Migrations:** `006_rh_pessoas_movimentacoes.sql`, `007_rh_agenda.sql`. **Arquivos da frente:** `lib/pessoas/*`, `lib/movimentacoes/*`, `lib/agenda/*`, `lib/inicio/*`, `app/(modulo)/page.tsx`, `app/(modulo)/pessoas/**`, `app/(modulo)/movimentacoes/**`, `app/(modulo)/agenda/**`, `app/(modulo)/[id]/page.tsx`, `app/(modulo)/novo/page.tsx`, `app/(modulo)/importar/page.tsx`, `lib/colaboradores/*`, `components/colaboradores/*`, `components/pessoas/*`, `components/movimentacoes/*`, `components/agenda/*`.

### Task F1.1: trava e movimentação no banco (território de borda)

- [ ] Escrever `tests/hub-install/006-movimentacoes.test.ts`, falhando. Cada linha é um teste:
  - `update` direto em `salario_centavos`, `status`, `email` pela chave de serviço: `RH_GUARD`. Também `rh_salvar_colaborador`, `rh_salvar_rateio` e `rh_importar`.
  - `rh_ligar_fornecedor_pj` continua funcionando.
  - Admissão: conclui e cria pessoa, rateio e `recebe_vr` de CLT; repetir não duplica e devolve `ja_concluida`; CPF ativo recusa; CPF com vínculo encerrado vira readmissão; rateio com soma 99,99 recusa e nada fica gravado.
  - Alteração material sem aprovação não conclui; com aprovador igual à própria pessoa recusa; não material conclui sem aprovação.
  - Foto: outro processo muda o valor depois de abrir, conclusão recusa e nada muda.
  - Carimbo velho recusa. Passo obrigatório pendente recusa.
  - Vigência futura: `agendada`, `salario_centavos` igual até a data; `rh_aplicar_vigencias` com data simulada aplica; rodar de novo não faz nada; foto divergente fica `agendada` com `erro_aplicacao`; papel do autor revogado não impede a aplicação; auditoria grava `rh.autor` e antes e depois.
  - Encerramento: só com colaborador; conclui com `status = 'desligado'` e `desligamento`; data futura agenda; segundo encerramento aberto recusa; `pendencias_no_fim` sem motivo recusa.
  - `rh_preencher_emails`: não sobrescreve preenchido; recusa e-mail repetido; cria uma movimentação concluída por pessoa.
  - Leitura: admin e `diretoria` conforme a seção 8; `de` e `dados` sem salário para admin; `rh_listar_pessoas` devolve e-mail, gestor e equipe.
- [ ] Escrever `tests/hub-install/contrato-orcamento.test.ts`, falhando: leituras nomeadas iguais às de `orcamento/supabase/hub-install/022_*.sql` e `016_*.sql`; `rh_colaboradores_status_valido` e `rh_colaboradores_tipo_contratacao_valido` com a definição do 002.
- [ ] Rodar. Esperado: falha.
- [ ] Escrever o 006, conforme a seção 5 e a seção 7 da spec. Atenção à ordem das travas de `rh_concluir_movimentacao`.
- [ ] Rodar também `npx vitest run tests/hub-install-safety.test.ts tests/hub-install-pglite.test.ts`. Esperado: verde, porque o segundo parou no 004 (F0.1). Nos testes novos, a pessoa nasce por `rh_abrir_admissao` e `rh_concluir_movimentacao`, nunca por `insert` direto.
- [ ] Commit `feat(movimentacoes): só a movimentação muda o cadastro (006)`.

### Task F1.2: regras e ações no servidor

- [ ] Testes, falhando, em `tests/movimentacoes/*.test.ts`: `materialidade(mudancas)` conforme a tabela 4.3; `montarDe(atual, mudancas)`; vigência no dia 1 para salário e rateio; `textoDoEfeito(mov)`, com "o que acontece" e "o que não muda" sem valor no histórico; `modelos`: admissão, alteração e encerramento com os `exige` da seção 4.1, modelo curto de "Já está trabalhando", PJ com 11.2 a 11.5 não aplicáveis, CLT com 10.10 a 10.12 não aplicáveis; ações: `diretoria` recebe erro de permissão, erro do banco nunca chega à tela, `RH_GUARD` chega.
- [ ] Implementar `lib/movimentacoes/{regras,modelos,schemas,repositorio,queries,actions,tipos,colunas}.ts`.
- [ ] Ajustar `lib/colaboradores/actions.ts`: retirar `salvarColaborador`, `salvarRateio`, `importarColaboradores`, mantendo `buscarFornecedores`. Atualizar `tests/colaboradores-actions.test.ts` e `tests/editor-rateio-total.test.ts`.
- [ ] Commit `feat(movimentacoes): regras e ações`.

### Task F1.3: Pessoas e ficha

- [ ] Testes, falhando: `lib/pessoas/colunas.ts` passa em `conferirLarguras`, e-mail é prioridade 2; `tests/pessoas/ficha.test.ts`: aba por `?aba=`, valor inválido volta para Dados; abas de PJ; redirecionamentos de `/[id]`, com UUID, `/novo` e `/importar`; **teste de texto** em `tests/pessoas/textos.test.ts`, varrendo `app/**`, `components/**` e `lib/**/rotulos.ts` contra `/Desligad|Desligament|demiss|rescis|dispensa/i` em texto de tela, com exceção só para identificadores de código em minúsculas; `rotuloStatus('desligado')` é "Vínculo encerrado".
- [ ] Implementar `/pessoas`, com o indicador e o filtro "Sem e-mail", `/pessoas/[id]`, `/pessoas/emails`, redirecionamentos, e `_abas/*`. Abas ainda sem módulo: `em-breve.tsx`. A Dados mostra CPF com máscara do banco, PIX como hoje, e a "Situação agora", que usa `abertoComPessoa`.
- [ ] `FormColaborador` sai da ficha; `BuscaFornecedor` e `EditorRateio` ficam para os formulários.
- [ ] Ligar Pessoas no registro, com busca e contador.
- [ ] Vitrine: lista, relação, ficha de CLT e de PJ.
- [ ] Commit `feat(pessoas): lista e ficha`.

### Task F1.4: Admissões e alterações

- [ ] Testes, falhando: `colunas` em `conferirLarguras`; formulário rejeita sem rateio; `/movimentacoes/nova-admissao` e `nova-alteracao` só para `rh`; botão Concluir desabilitado e motivo à vista sem aprovação (teste por `renderToStaticMarkup`); confirmação lista "o que acontece" e "o que não muda"; Encerramento não tem botão na lista, só na ficha; o vazio da aba explica o caminho; recursos em 3 estados; encerramento com itens em aberto exige motivo.
- [ ] Implementar telas, com abas Resumo, Dados, Recursos, Documentos, Histórico, como em `regAdm` e `regAlt`.
- [ ] Vitrine, nas 4 larguras.
- [ ] Commit `feat(movimentacoes): telas`.

### Task F1.5: Agenda

- [ ] Escrever `tests/hub-install/007-agenda.test.ts`, falhando: `senhas_portao` com observação recusa; `rh_controles_versoes` não muda nem apaga; foto não tem `cpf` nem `salario_centavos`; `rh_registrar_obrigacao` repetida não duplica.
- [ ] Testes puros: `obrigacoesDoMes` traz 17.1 a 17.6 e o seguro do dia 25; 17.3 tem o texto de catálogo (D4); `montarAgenda` junta fontes, ordena e tolera fonte falha; `gradeDoMes` com 28 a 31 dias.
- [ ] Implementar o 007, `lib/agenda/*` e `/agenda`. Celular abre em Lista; `?mes=` válido, inválido volta ao atual em Brasília.
- [ ] Commit `feat(agenda): prazos, obrigações e versões`.

### Task F1.6: Início

- [ ] Testes, falhando: `precisaDeVoce` ordena por prazo, corta em 7; `proximosDias`; módulo não ligado some; fonte que falha não derruba; alerta de `erro_aplicacao` e de agendada vencida.
- [ ] Implementar `/`, com `Bom dia`, nome da sessão, e o botão "Aplicar agora" chamando `rh_aplicar_vigencias` por action só para `rh`.
- [ ] Commit `feat(inicio): painel do RH`.

**Pronto de F1:** comum, mais PGlite provando trava, idempotência e foto; teste de contrato do Orçamento verde; nenhuma tela grava em `rh_colaboradores` fora de `lib/movimentacoes`.

**Autorização do João:** aplicar `006` e `007`, com o intervalo avisado ao RH, e deploy imediato; preenchimento dos 50 e-mails é trabalho do RH.

---

## Condição de entrada de F2 a F6 (revisão da F0, 06/11)

Relatório: `docs/rh/2026-11-06-revisao-f0.md`. Corrigir antes de qualquer frente que os use, por tarefa própria, com teste:

- **B1:** `rh_etapas_listar` devolve `dados` inteiro a `diretoria` e a admin sem papel. Antes da primeira etapa com dado de saúde.
- **B2:** a classe do arquivo vem do navegador, com padrão `geral`. A classe passa a ser decidida no servidor, por módulo, e nunca assume `geral` sozinha.
- **B3:** `textoSeguro` deixa passar valor sem prefixo, CPF com espaços e CID. Antes do primeiro módulo que envia e-mail.

---

## F2: Férias, Exames, Contratos PJ

**Migrations:** `008_rh_ferias.sql`, `009_rh_exames.sql`, `010_rh_contratos_pj.sql`. **Arquivos da frente:** `lib/ferias/*`, `lib/exames/*`, `lib/contratos/*`, `app/(modulo)/{ferias,exames,contratos}/**`, `components/{ferias,exames,contratos}/*`, `app/(modulo)/pessoas/[id]/_abas/{ferias,exames}.tsx`, as linhas `ferias`, `exames` e `contratos` de `registro.ts`, `lib/vitrine/dados/{ferias,exames,contratos}.ts`.

### Task F2.1: Férias

- [ ] `tests/hub-install/008-ferias.test.ts`, falhando: gerar períodos só cria último completo e aberto, só para CLT ativo com admissão, e repetir não duplica; saldo = direito menos gozos não cancelados; gozo acima do saldo, abaixo de 5 ou acima de 30 recusa; data passada recusa; admin não recebe valor nenhum, porque não há; leitura para `diretoria`; `rh_em_ferias` em data de borda.
- [ ] Testes puros: `situacaoFerias`, com todas as etiquetas de `sitFer`; `faixaDeVencimento` em -1, 0, 30, 31, 60, 90 e 91 dias, calculada em Brasília; modelo com `exige`.
- [ ] Testes de aviso: sem SMTP cai no manual; corpo sem valor.
- [ ] Implementar migration, `lib/ferias/*`, telas, aba da ficha, `situacaoPessoas`, `ausenciasNoMes`, `agenda`, `contador`.
- [ ] Vitrine nas 4 larguras. Commit `feat(ferias): períodos, gozos e aviso ao gestor`.

### Task F2.2: Exames

- [ ] `tests/hub-install/009-exames.test.ts`, falhando: arquivar sem nova validade recusa; arquivo `saude` não abre para `diretoria`; leitura sem arquivo para `diretoria`; admissional pode nascer de uma movimentação.
- [ ] Testes puros: faixas; 14.11 só em PJ; pedido ao SESMT usa `sesmt_aso` na obrigação do mês.
- [ ] Implementar. Vitrine. Commit `feat(exames): vencimentos, agendamento e ASO`.

### Task F2.3: Contratos PJ

- [ ] `tests/hub-install/010-contratos.test.ts`, falhando: só para `tipo_contratacao = 'pj'`; dois vigentes recusa; vencimento antes do início recusa; aditivo de vigência exige data maior; **aditivo de valor não muda `salario_centavos`**, só abre alteração com `movimentacao_id`; baixa só de vigente; tabela sem coluna de valor (`information_schema`).
- [ ] Testes puros e colunas. Tela lê `emite_nota`, sem texto fixo.
- [ ] Implementar, incluindo `abertoComPessoa`, para o encerramento mostrar contrato vigente, e "Dar baixa".
- [ ] Vitrine. Commit `feat(contratos): prestadores PJ e aditivos`.

**Pronto de F2:** comum. **Autorização do João:** aplicar `008`, `009`, `010`; deploy. **Pergunta para a empresa, sem travar:** saldo inicial de férias.

---

## F3: Ponto e fechamento

**Migration:** `011_rh_ponto.sql`. **Arquivos da frente:** `lib/ponto/*`, `app/(modulo)/ponto/**`, `components/ponto/*`, `app/(modulo)/pagamentos/page.tsx`, `lib/pagamentos/competencia.ts` (novo), `components/pagamentos/tabela-competencias.tsx` (novo), `app/(modulo)/pessoas/[id]/_abas/ponto.tsx`, a linha `ponto` e a linha `folha` do registro, `lib/vitrine/dados/ponto.ts`.

### Task F3.1: banco

- [ ] `tests/hub-install/011-ponto.test.ts`, falhando: **CID:** `rh` recebe, `diretoria` recebe nulo, admin não recebe linha; arquivo idem; histórico sensível oculto; `rh_colar_lancamentos` com uma linha ruim não grava nenhuma; lançamento repetido recusa; banco só cresce: `update` e `delete` recusam; movimento vindo do lançamento não duplica; `periodo_inicio` fora do dia 25 recusa; fechamento mapeia 25/10 para novembro; `rh_listar_competencias` sem valor para admin; `rh_atestado` tipo afastamento **não muda `status`**.
- [ ] Implementar 011. Commit `feat(ponto): banco (011)`.

### Task F3.2: regras

- [ ] Testes puros: `divergenciaAberta`, todos os casos de `divAberta`, inclusive só acionamento diferente, e resolvido; `minutosDe('01:30')`, com `1:5` e `25:00`, conforme a regra; `lerColado`, com linha em branco, cabeçalho, nome ambíguo que nunca casa sozinho; `periodoDe(data)` em 24 e 25; `saldo`; `colunas` em `conferirLarguras`.
- [ ] Implementar `lib/ponto/*`. Commit.

### Task F3.3: telas do Ponto

- [ ] Testes: aba por `?vista=`; `diretoria` não vê botão, nem CID; texto sobre o arquivo como no mockup; "Copiar orientação" sem nome; afastamento mostra "Abrir alteração de situação".
- [ ] Implementar. "Novo lançamento" e "Colar lista" são novos (D21). Relatório vai para `rh_arquivos`, sem leitura do conteúdo.
- [ ] Ligar módulo, aba da ficha, agenda, pendências, `ausenciasNoMes` (atestados), `abertoComPessoa` (saldo diferente de zero).
- [ ] Vitrine. Commit `feat(ponto): telas`.

### Task F3.4: competência como registro

- [ ] Testes: `situacaoDeTela(comp, pagamentos)` nunca devolve "paga" ou "pago" (D3); tabela de competências sem valor para admin; modelo da área 6, sem nome de pessoa em 6.12, com 6.2 "Reunir os dados de encerramentos", vindo das movimentações do mês; 6.13 é confirmação, sem envio; `tests/pagamentos/textos.test.ts` segue verde.
- [ ] Em `/pagamentos`: sem `?mes=` mostra competências; com `?mes=`, registro com abas Pagamentos (o conteúdo de hoje), Andamento, Documentos, Histórico. Rotas `/pagamentos/folha`, `guias`, `vr`, `vt`, `pj`, `ligar` não mudam.
- [ ] Vitrine. Commit `feat(pagamentos): competência como registro`.

**Pronto de F3:** comum, mais prova em teste de que `diretoria` nunca recebe CID nem arquivo de atestado. **Autorização do João:** aplicar `011`; deploy. **Pedido à empresa, sem travar:** um relatório exportado do VR Ponto, para decidir a leitura automática.

---

## F4: Patrimônio

**Migration:** `012_rh_patrimonio.sql`. **Arquivos da frente:** `lib/patrimonio/*`, `app/(modulo)/patrimonio/**`, `components/patrimonio/*`, `app/(modulo)/pessoas/[id]/_abas/patrimonio.tsx`, linha `patrimonio` do registro, `lib/vitrine/dados/patrimonio.ts`.

- [ ] `tests/hub-install/012-patrimonio.test.ts`, falhando: código sequencial sem repetir, mesmo em duas chamadas seguidas; entregar item não disponível recusa; `em_uso` sem responsável recusa pelo CHECK; devolver gera termo e libera; transferir mantém o termo antigo; baixa só de disponível, e baixado não entrega; `rh_termo_assinado` sem arquivo recusa; tipo `veiculo` recusado (D14); `diretoria` só lê; nada lê tabela de Frotas (teste de texto no SQL).
- [ ] Rodar. Implementar 012. Commit.
- [ ] Testes puros: `acoesDoItem(situacao, podeEditar)`, os casos de `regPat`; `colunas`; termo impresso sem CPF inteiro para outro papel, página só para `rh`.
- [ ] Implementar telas, termo (`/patrimonio/termos/[id]/imprimir`, com CSS de impressão, sem biblioteca de PDF), busca, contador, agenda, `abertoComPessoa`, aba da ficha, "Pedir devolução" na lista de pessoas com vínculo encerrado.
- [ ] Texto sobre Compras e Frotas, sem leitura de nenhum dos dois.
- [ ] Vitrine nas 4 larguras. Commit `feat(patrimonio): itens, entrega, devolução e termos`.

**Pronto de F4:** comum. **Autorização do João:** aplicar `012`; deploy. **Pedido à empresa, sem travar:** ler o texto do termo.

---

## F5: Recrutamento e Comunicação

**Migrations:** `013_rh_recrutamento.sql`, `014_rh_comunicacao.sql`. **Arquivos da frente:** `lib/recrutamento/*`, `lib/comunicacao/*`, `app/(modulo)/{recrutamento,comunicacao}/**`, `components/{recrutamento,comunicacao}/*`, linhas `recrutamento` e `comunicacao` do registro, `lib/vitrine/dados/{recrutamento,comunicacao}.ts`.

### Task F5.1: Recrutamento

- [ ] `tests/hub-install/013-recrutamento.test.ts`, falhando: `rh_aprovar_candidato` sem CPF recusa; aprovado cria admissão com cargo, remuneração, rateio sugerido e `origem_candidato_id`, marca vaga como preenchida; repetir não cria segunda; falha na admissão desfaz tudo; CPF inteiro só para `rh`; remuneração nula para admin; `rh_apagar_curriculos_vencidos`: não toca em vaga aberta nem antes de 12 meses, marca arquivo, apaga CPF e e-mail, devolve os caminhos, e repetir não faz nada.
- [ ] Testes puros: `etapaDoCandidato` nos limites de `ETQ`; `podeDecidir`, depois dos passos do gestor; `colunas`; `quadro` em coluna única no celular.
- [ ] Implementar telas. "Apagar agora" exige confirmação; falha ao remover objeto fica visível para refazer.
- [ ] Vitrine. Commit `feat(recrutamento): vagas e candidatos`.

### Task F5.2: Comunicação

- [ ] `tests/hub-install/014-comunicacao.test.ts`, falhando: orçamento nulo para admin; chave de aviso repetida não reserva duas vezes.
- [ ] Testes: destinatários só com e-mail; lote de 5; reenvio só para quem falhou; sem SMTP cai no manual; nota "N pessoas sem e-mail"; `Copiar` usa só texto; nenhuma chamada a WhatsApp (teste de texto).
- [ ] Implementar. O passo 2.16 aponta para cá, sem escrever em `rh_movimentacoes`.
- [ ] Vitrine. Commit `feat(comunicacao): campanhas, comunicados e eventos`.

**Pronto de F5:** comum. **Autorização do João:** aplicar `013` e `014`; deploy; caixa de e-mail, se não veio em F0.

---

## F6: Benefícios, seguro e celular, e mudança no Financeiro

**Migration:** `015_rh_beneficios_seguro_celular.sql`, no RH. **Financeiro:** sem migration (D25 da spec). **Arquivos da frente, RH:** `lib/beneficios/*`, `lib/seguro/*`, `lib/celular/*`, `lib/pagamentos/{regras,rotulos,repositorio,enviar,actions}.ts`, `app/(modulo)/beneficios/**`, `app/(modulo)/pagamentos/{seguro,celular}/**`, `components/{beneficios,seguro,celular}/*`, `components/pagamentos/tela-vr.tsx`, `app/(modulo)/pessoas/[id]/_abas/{beneficios,pagamentos}.tsx`, linha `beneficios` do registro. **Financeiro:** `lib/integracoes/rh-pagamentos.ts`, `tests/integracoes/rh-pagamentos.test.ts`.

### Task F6.1: Financeiro (primeiro, por contrato)

- [ ] Antes de tudo, conferir em `main` atualizada se `TIPOS_RH` e `LISTA_PERMITIDA` estão como em `origin/rh-pagamentos` e se não há CHECK de `tipo` em 047 nem em migration posterior. Se houver, pare e avise. Confirmar com o coordenador os códigos `2.03.13` e `2.04.05` (a spec diz que não foram verificados no catálogo).
- [ ] Testes, falhando: `seguro` categoria `2.03.13`, formas `pix_qrcode` e `boleto`; `celular` categoria `2.04.05`, mesmas formas; 422 para categoria ou forma fora; `seguro` bloqueia duplicidade no mês, incluindo lançamento à mão; `celular` não bloqueia e usa etiqueta; tipos antigos intactos; medições intactas.
- [ ] Implementar só as duas linhas e a lista. Rodar `npx tsc --noEmit && npm run test && npm run build && npx biome check .` no Financeiro.
- [ ] Commit `feat(integracoes): seguro e celular na porta do RH`.

### Task F6.2: banco do RH

- [ ] `tests/hub-install/015-beneficios.test.ts`, falhando: `seguro` e `celular` aceitos com `pix_qrcode` e `boleto`, recusados em `pix_chave`, e colaborador tem de ser nulo; tipos antigos com a mesma regra; chave de `seguro` e `celular` não usa o alvo `credito`; `rh_nova_tentativa` mantém o alvo; um segurado aberto por pessoa; valores nulos para admin; `rh_pagamentos` não ganhou coluna lida pelo Orçamento.
- [ ] Implementar 015: `drop constraint` e `add constraint`, no mesmo comando, com `lock_timeout`.
- [ ] Commit `feat(pagamentos): tipos seguro e celular (015)`.

### Task F6.3: regras de dinheiro

- [ ] Testes puros: `pesosDoSeguro` pelo rateio dos segurados no mês; `pesosDoCelular` pelo responsável da linha; soma fecha no centavo por `ratearCentavos`, sem linha zerada, no máximo 20 linhas; **linha sem responsável bloqueia**; centro de custo inativo bloqueia; diferença entre boleto e soma acima da tolerância bloqueia (`LIMITES`, constante única); prêmio em branco não bloqueia; `inclusoesAPedir` e `exclusoesAPedir`, derivadas das movimentações; `planilhaSeguro` em CSV, só `rh`, e registra o download; `sugestaoDeAusencias` a partir de `ausenciasNoMes` dos módulos ligados, sem preencher sozinha.
- [ ] Acrescentar `seguro` e `celular` em `regras.ts` e `GRUPOS`. Envio reaproveita `lib/pagamentos/enviar.ts`, com a mesma chave em reenvio.
- [ ] Commit `feat(seguro): regras e rateio`.

### Task F6.4: telas

- [ ] Testes: `/beneficios` lê `recebe_vr`, nunca `clt()`; solicitação não muda ficha e oferece "Abrir alteração" (D12); `situacaoVisivel` não diz pago; aviso de "enviado não é pago" presente.
- [ ] Implementar `/beneficios`, registros, `/pagamentos/seguro`, `/pagamentos/celular`, aba Benefícios e Pagamentos da ficha, sugestão em `tela-vr`. Ligar módulo, pendências, agenda (dia 10, dia 25), `abertoComPessoa` (segurado).
- [ ] Vitrine nas 4 larguras. Commit `feat(beneficios): VR, VT, seguro e celular`.

**Pronto de F6:** comum nos dois repositórios, mais teste de contrato do Orçamento verde, e nada escrito em `fin_*` ou Omie.

**Autorização do João:** merge e deploy do Financeiro; aplicar `015`; deploy do RH; teste de fumaça com `TESTE - APAGAR`, avisando o Financeiro antes. **José:** categoria Telefonia nas fixas, e primeiro título real no Omie, regra 4 do Financeiro.

---

## Encerramento

- [ ] Revisão final independente do conjunto, com o Review Focus acima, por agente que não executou nenhuma frente.
- [ ] Coordenador: atualizar `CLAUDE.md` do RH, `supabase/hub-install/README.md`, `docs/deploy-easypanel.md` (SMTP, pasta) e `docs/DIVIDAS.md`, com as dívidas da seção 16 da spec.
- [ ] Coordenador: `npm run types` depois de cada SQL aplicado, com commit junto. Depois, retirar os `chamarRpc` que a tipagem gerada já cobre, se forem muitos, em uma tarefa só.
- [ ] Confirmar no ar, com o João logado, as 4 larguras nas telas de cada frente. Não dizer que está no ar antes disso.
