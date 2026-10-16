# Plano — "Agendar e tirar do diário" + botão "Solicitar compra"

> Para quem executa: TDD estrito. Em cada tarefa, escreva o teste, rode e **veja falhar pelo motivo certo**,
> implemente o mínimo, rode e veja passar, e só então passe à próxima. Um commit por tarefa
> (`feat(obras): ...`), terminando com a linha `Co-Authored-By` da sessão.

**Spec:** `docs/superpowers/specs/2026-10-16-obras-agendar-tirar-do-diario-design.md` (referida como "spec §N").
**SQL:** `sdd-sql-obras-agendamento-diario.sql` — aplicado pelo coordenador, depois de revisão, **antes do deploy**.
O código abaixo não pode subir sem as 5 colunas no banco: `gravarComHistorico` mandaria chaves que a RPC antiga
recusa (`22023`), e o agendamento falharia sempre com a mensagem de erro.

**Antes de começar:** leia `AGENTS.md`, `.claude/rules/obras.md` (armadilha do `export type` em `use server`) e o
guia do Next em `node_modules/next/dist/docs/` para qualquer API de página/Server Action que for usar.

**Regras de execução:**

- Menor mudança. Nada de `export type` novo em `diario/_actions.ts` (arquivo `use server`); tipos ficam em
  `_lib/agendamento.ts`.
- Não mexer em `tarefas/_lista.tsx`, RLS, `middleware.ts`, Compras.
- Rodar cada teste com `npx jest <caminho>`. No fim, `npx jest app/obras app/api/obras` (não `npm test` na raiz,
  que varre `manfac-site/`).
- Padrão de mocks: copie de `app/obras/obra/[id]/__tests__/_actions.test.ts:37-46` (Server Actions),
  `app/obras/diario/__tests__/page.test.tsx:7-20` (página do Diário) e
  `app/obras/tarefas/__tests__/page.test.tsx:14-20` (página de Tarefas).

**Paralelismo:** as tarefas 1→2→3 são sequenciais (base). Depois disso, {4,5,6}, {7,8,9}, {10} e {11} tocam
arquivos disjuntos e podem correr em paralelo. A 11 (botão de compra) é independente de todas e pode ser feita
a qualquer momento.

---

## Tarefa 1 — Regra única da fila e validação (`_lib/agendamento.ts`) + `ObraRow`

**Arquivos:** `app/obras/_lib/agendamento.ts` (novo), `app/obras/_lib/tipos.ts` (só `ObraRow`),
`app/obras/__tests__/agendamento.test.ts` (novo).

**Teste primeiro** (`app/obras/__tests__/agendamento.test.ts`), com `hoje = '2026-10-15'`:

1. `naFilaDoDiario`: obra em `levantamento`/`andamento`/`paralisado` sem agendamento → `true`; em `definir`,
   `relatorio`, `cancelado` → `false`.
2. Agendada até `2026-10-22` → `agendadaForaDoDiario = true`, `naFilaDoDiario = false`.
3. **No dia marcado** (`hoje = '2026-10-22'`, até `2026-10-22`) → `naFilaDoDiario = true`,
   `agendadaForaDoDiario = false`, `agendamentoVoltou = true` (spec §2, suposição 4 / S2).
4. Depois do dia (`hoje = '2026-10-25'`) → `agendamentoVoltou = true`.
5. Agendada mas em `relatorio` → as três funções `false` (S5).
6. `somarDiasISO('2026-10-31', 1) === '2026-11-01'`; `limitesAgendamento('2026-10-15')` →
   `{ min: '2026-10-16', max: '2026-11-14' }`.
7. `validarAgendamento`, cada mensagem da spec §4.2: `oque` vazio → `Diga o que vai acontecer.`; sem motivo →
   `Escolha o motivo da parada.`; motivo fora da lista → `Escolha o motivo da parada.`; `Outro` sem texto →
   `Escreva o motivo.`; data `hoje`, data `hoje+31`, data inválida → `Escolha uma data entre amanhã e 30 dias.`;
   `oque` com 81 letras ou `outro` com 101 → recusados; `hoje+30` aceito; `Outro` + `  loja fechada ` →
   `motivo: 'Outro: loja fechada'`; `oque` com espaços nas pontas sai com `trim`.
8. `nomeDeQuemAgendou('yuri.moreira@manfac.com.br', [])` → `Yuri`; com
   `[{ email: 'yuri.moreira@manfac.com.br', nome: 'Yuri Moreira' }]` → `Yuri`; e-mail sem ponto → local com
   inicial maiúscula.
9. `textoAgendadas(1) === '1 agendada'`, `textoAgendadas(3) === '3 agendadas'`.

Rodar: `npx jest app/obras/__tests__/agendamento.test.ts` → falha (módulo não existe).

**Implementar:** spec §2.1, §5, §6.4. `ObraRow` ganha `diario_agendado_ate?`, `diario_agendado_oque?`,
`diario_agendado_motivo?`, `diario_agendado_por?` (`string | null`) e `diario_agendado_em?` (`string | null`).
`EntradaAgendamento` (tipo) mora aqui.

Rodar de novo → passa. Rodar também `npx jest app/obras/__tests__/tipos.test.ts` (não pode quebrar).

---

## Tarefa 2 — Histórico aceita o agendamento

**Arquivos:** `app/obras/_lib/historico.ts`, `app/obras/obra/[id]/_historico.tsx`,
`app/obras/__tests__/historico.test.ts`, `app/obras/obra/[id]/__tests__/_historico.test.tsx`.

**Teste primeiro:**

- `historico.test.ts`: `linhasDeAlteracao({ diario_agendado_ate: null }, { diario_agendado_ate: '2026-10-22' },
  'Agendamento')` → `[{ bloco: 'Agendamento', campo: 'diario_agendado_ate', de: null, para: '22/10/2026',
  motivo: null }]`; `ROTULO_CAMPO.diario_agendado_ate === 'Agendamento do diário (volta em)'`;
  `gravarComHistorico` com `campos: { diario_agendado_ate: ... }` e `linhas: []` **lança** (a trava do
  `COLUNA_PARA_CAMPO`); com `diario_agendado_oque` sozinho (sem linha) **não** lança (coluna de apoio).
- `_historico.test.tsx`: existe o botão de filtro `Agendamento` e ele mostra só a linha desse bloco (copie o caso
  `Cancelamento` das linhas 110-125).

Rodar: `npx jest app/obras/__tests__/historico.test.ts "app/obras/obra/\[id\]/__tests__/_historico.test.tsx"` →
falha.

**Implementar:** spec §4.6 (`BlocoHistorico`, `CampoHistorico`, `ROTULO_CAMPO`, `CAMPOS_DATA`,
`COLUNA_PARA_CAMPO`, lista de filtros em `_historico.tsx:17`). Rodar → passa.

---

## Tarefa 3 — Server Actions `agendarDiarioAction` e `encerrarAgendamentoAction`

**Arquivos:** `app/obras/diario/_actions.ts`, `app/obras/diario/__tests__/agendamento-actions.test.ts` (novo).

**Teste primeiro** — mocks: `@/lib/supabase/server`, `next/cache`, `@/lib/auth/systemAccess`,
`@/lib/auth/roles` (`isAdmin`), `../_pessoa` (`resolverChave`). Use `jest.useFakeTimers().setSystemTime(...)` com
um instante de 15/10/2026 às 10:00 de Brasília. Fixture: obra `levantamento`, `pcm: 'YURI'`, sem agendamento.

`agendarDiarioAction`:

1. Sem usuário → `{ error: 'Não autenticado' }`; sem acesso → `Sem acesso à Gestão de Obras`; nenhuma RPC chamada.
2. Validação falha (ex.: sem motivo) → mensagem da tarefa 1, nenhuma leitura de obra nem RPC.
3. Não-admin com chave `ROBERTA` em obra do `YURI` → `Só o responsável pela obra ou o administrador pode agendar.`,
   sem RPC. Chave vazia `''` com `pcm: null` → também recusa (falha fechada).
4. PCM (`YURI`) → chama `rpc('obras_aplicar_alteracao', …)` com `p_campos` contendo exatamente as 5 chaves
   `diario_agendado_*`, `diario_agendado_por` = e-mail da sessão, `diario_agendado_ate = '2026-10-22'`, e
   `p_linhas` com uma linha `{ bloco: 'Agendamento', campo: 'diario_agendado_ate', de: null, para: '22/10/2026',
   motivo: 'Levantamento de material — Aguardando material' }`; devolve `{ success: true }`; `revalidatePath`
   chamado para `/obras/diario`, `/obras/tarefas`, `/obras/painel` e a ficha.
5. Admin (`isAdmin` true) em obra de outro PCM → passa.
6. `Outro` + texto → `diario_agendado_motivo: 'Outro: <texto>'`.
7. Etapa `relatorio` → `Só obra que está no diário pode ser agendada.`
8. Já agendada até `2026-10-20` → `Esta obra já está agendada até 20/10. Recarregue a página.`; agendada até
   `2026-10-15` (vencida, hoje) → aceita e a linha traz `de: '15/10/2026'`.
9. RPC devolve erro → `{ error: <texto do mockup "A conexão falhou...">  }` e nenhum `revalidatePath`.
10. `diario_agendado_em` e o `hoje` da validação saem do mesmo instante (com o relógio fixo em 15/10 23:59:59 de
    Brasília, `ate = '2026-11-14'` é aceito e `em` convertido para Brasília ainda é 15/10).

`encerrarAgendamentoAction`:

11. `'volta'` em obra agendada até `2026-10-22` → RPC com as 5 chaves `null` e linha `{ de: '22/10/2026', para:
    null, motivo: 'Trazido de volta ao diário' }`.
12. `'feito'` em obra com data `2026-10-15` (hoje) → linha `motivo: 'Marcado como feito'`.
13. `'feito'` antes da data → `O agendamento ainda não chegou na data. Use "Trazer de volta agora" no diário.`;
    `'volta'` depois da data → `Esta obra já voltou ao diário. Recarregue a página.`; sem agendamento →
    `Esta obra não está agendada. Recarregue a página.`
14. Mesma regra de permissão do item 3.

Rodar: `npx jest app/obras/diario/__tests__/agendamento-actions.test.ts` → falha.

**Implementar:** spec §6.1-6.2. Rodar → passa. Rodar também o teste que varre os arquivos `use server`
(`npx jest -t "use server"`; se não achar pelo nome, `git show 4071df1 --stat` mostra o arquivo) e
`npx jest app/obras/__tests__/diario.test.ts`.

---

## Tarefa 4 — Página do Diário separa fila e agendadas

**Arquivos:** `app/obras/diario/page.tsx`, `app/obras/diario/__tests__/page.test.tsx`.

**Teste primeiro** (estender o existente):

1. Com 3 obras do PCM, uma agendada até amanhã: `Cartoes` recebe 2 em `obras` e 1 em `agendadas`.
2. Obra com data = hoje vai em `obras` (voltou).
3. Analista com **todas** as obras agendadas não vê `SemPermissao`: `Cartoes` recebe `obras: []`, `agendadas: [1]`.
4. As leituras de `obras_diario`/`obras_tarefa` usam só os ids da fila.
5. A consulta de `obras_pessoa` pede `email`, e `Cartoes` recebe as pessoas com e-mail.

Rodar: `npx jest app/obras/diario/__tests__/page.test.tsx` → falha.

**Implementar:** spec §7 (Diário). Remover `ETAPAS_FILA` local e importar `ETAPAS_FILA_DIARIO`/`naFilaDoDiario`/
`agendadaForaDoDiario`. Passar `agendadas` (as obras derivadas) e `pessoasPorEmail` a `Cartoes`. Rodar → passa.

---

## Tarefa 5 — Diálogo "Agendar e tirar do diário"

**Arquivos:** `app/obras/diario/_dialogo-agendar.tsx` (novo),
`app/obras/diario/__tests__/dialogo-agendar.test.tsx` (novo).

Componente recebe `obra`, `hoje`, `admin`, `agendar: (e: EntradaAgendamento) => Promise<{error?; success?}>`,
`aoFechar`, `aoAgendar(ate)`.

**Teste primeiro** (Testing Library, `userEvent`):

1. Abre com `Levantamento de material` no campo; clicar `Visita técnica` troca o texto.
2. Botão `Agendar e tirar do diário` desabilitado; dica `Escolha o motivo da parada.`; depois de escolher motivo,
   `Escolha uma data entre amanhã e 30 dias.`; `Outro` mostra o campo e a dica `Escreva o motivo.`.
3. Input de data tem `min` = amanhã e `max` = hoje+30; nota `Entre 16/10 e 14/11 (máximo de 30 dias).`.
4. Caixa de consequências mostra `__/__` sem data e `22/10` depois de escolher `2026-10-22`; admin vê
   `com você (admin) como dono`.
5. Confirmar chama `agendar` com `{ obraId, oque, motivo, outro, ate }`; durante a espera o botão diz `salvando…`.
6. `agendar` devolve erro genérico → aparece `Não deu para agendar` + o texto do mockup, e o botão vira
   `Tentar de novo`; erro de validação do servidor aparece no lugar da dica.
7. Sucesso → `aoAgendar('2026-10-22')`. `Cancelar` e Esc chamam `aoFechar`.

Rodar: `npx jest app/obras/diario/__tests__/dialogo-agendar.test.tsx` → falha.

**Implementar:** spec §4.2, no padrão visual de `obra/[id]/_dialogo-remarcar.tsx`. Rodar → passa.

---

## Tarefa 6 — Cartão e topo do Diário

**Arquivos:** `app/obras/diario/_cartao.tsx`, `app/obras/diario/_cartoes.tsx`,
`app/obras/diario/__tests__/cartoes-agendadas.test.tsx` (novo).

**Teste primeiro** (mock de `next/navigation` e de `../_actions`):

1. Cartão mostra o botão `📅 Agendar e tirar do diário` e a nota; clicar abre o diálogo.
2. Obra que voltou (`diario_agendado_ate = hoje`) mostra `Voltou do agendamento: levantamento de material previsto
   para hoje. Agendado por Yuri · motivo: Aguardando material`; com data de ontem, `previsto para 14/10`.
3. Barra: `2 obras para responder hoje` e o botão `· 1 agendada ▾`; clicar mostra o bloco
   `Agendadas — fora do diário até a data` com `volta em 22/10`, `Motivo: … · agendou Yuri em 14/10` e
   `Trazer de volta agora`; clicar chama `encerrarAgendamentoAction(id, 'volta')` e mostra
   `<loja> voltou para o diário.`.
4. Com 0 agendadas a barra mostra `· 0 agendadas` e o bloco aberto mostra o texto de vazio.
5. Fila vazia e 2 agendadas → `Nenhuma obra para responder hoje` + `Todas as obras deste diário estão agendadas.
   Elas voltam sozinhas nas datas marcadas.`.
6. Tudo respondido com 1 agendada → o texto do diário fechado contém `1 agendada não conta até a data de volta`.
7. Ordem: a obra que voltou vem antes de uma com `diasAlerta` maior.
8. Admin vê `Você é administrador do hub: vê tudo e pode trazer de volta qualquer agendada.`.

Rodar: `npx jest app/obras/diario/__tests__/cartoes-agendadas.test.tsx` → falha.

**Implementar:** spec §4.1 e §4.3. Rodar → passa. Rodar `npx jest app/obras/diario` (tudo da pasta).

---

## Tarefa 7 — `ritmoDe` usa a regra única e conta agendadas

**Arquivos:** `app/obras/painel/_calculos.ts`, `app/obras/painel/__tests__/calculos.test.ts`.

**Teste primeiro:**

1. 3 obras em `andamento`, 1 agendada até amanhã → `ritmo.esperados = 2`, `ritmo.agendadas = 1`.
2. Obra agendada **respondida hoje** não conta em `responderam` (está fora da fila).
3. Obra com data = hoje conta em `esperados` e não em `agendadas`.
4. Agendada em `relatorio` não conta em `agendadas`.

Rodar: `npx jest app/obras/painel/__tests__/calculos.test.ts` → falha.

**Implementar:** remover a constante local (linha 709), importar `naFilaDoDiario`/`agendadaForaDoDiario`, campo
`agendadas` em `Ritmo`. Rodar → passa, e `npx jest app/obras/painel app/api/obras/relatorio-diario`.

---

## Tarefa 8 — Painel mostra "N agendadas (não contam)"

**Arquivos:** `app/obras/painel/_painel.tsx`, `app/obras/painel/__tests__/painel.test.tsx`.

**Teste primeiro:** com `ritmo.agendadas = 3`, o mini "Responderam" mostra `3 agendadas (não contam)`; com 0, o
texto não aparece; com 1, `1 agendada (não contam)`.

Rodar: `npx jest app/obras/painel/__tests__/painel.test.tsx` → falha. **Implementar** spec §4.5. Rodar → passa.

---

## Tarefa 9 — E-mail das 8h

**Arquivos:** `app/api/obras/relatorio-diario/_imagem.tsx`,
`app/api/obras/relatorio-diario/__tests__/imagem.test.tsx`.

**Teste primeiro:** com `ritmo.agendadas = 3`, o texto do mini é `N ainda aguardam resposta · 3 agendadas (não
contam)`; com 0, continua só `N ainda aguardam resposta`. Nenhuma altura (`RITMO_H`, `linhasM`) muda.

Rodar: `npx jest app/api/obras/relatorio-diario/__tests__/imagem.test.tsx` → falha. **Implementar.** Rodar →
passa, e `npx jest app/api/obras/relatorio-diario`.

Verificação manual depois do deploy (coordenador): `POST /api/obras/relatorio-diario` com `{"previa":true}` e
olhar o PNG.

---

## Tarefa 10 — Seção "Agendadas" em Tarefas

**Arquivos:** `app/obras/tarefas/page.tsx`, `app/obras/tarefas/_agendadas.tsx` (novo),
`app/obras/tarefas/__tests__/page.test.tsx`, `app/obras/tarefas/__tests__/agendadas.test.tsx` (novo).

**Teste primeiro:**

- `page.test.tsx`: a página faz uma leitura de `obras_obra` com `diario_agendado_ate` não nulo e etapas do
  diário; admin recebe todas; não-admin (`resolverChave` → `YURI`) recebe só as de `pcm = 'YURI'`; sem chave,
  nenhuma; falha da leitura nova → tela de erro. `Lista` continua recebendo exatamente o que recebia.
- `agendadas.test.tsx`: título `Agendadas`, selo `novo`, `2 obras fora do diário`; ordem por data; linha futura
  mostra `<o que>`, `22/10` e `DP Moema · OS … · dono Yuri · motivo: …` sem botão; linha com data = hoje mostra
  `Hoje: levantamento de material na DP Moema`, `A obra já voltou ao diário.` e `Marcar como feito`; com data
  passada, `A obra já voltou ao diário desde 14/10.`; clicar `Marcar como feito` chama
  `encerrarAgendamentoAction(id, 'feito')`; vazio mostra o texto da spec §4.4.

Rodar: `npx jest app/obras/tarefas` → falha.

**Implementar:** spec §4.4 e §7 (Tarefas). Rodar → passa.

---

## Tarefa 11 — Botão "Solicitar compra" na ficha (independente)

**Arquivos:** `app/obras/obra/[id]/_ficha.tsx`, `app/obras/obra/[id]/__tests__/_ficha.test.tsx`.

**Teste primeiro:**

1. Obra não cancelada: existe o link com nome `Solicitar compra` e
   `href = '/compras/solicitacoes/nova?obra=<obra.id>'`, `target="_blank"`, `rel` contendo `noopener`; texto
   `Pedir a partir desta obra` e `Abre o Compras em nova aba, com esta obra.`.
2. Obra cancelada: o link não existe.
3. Não existe nenhum texto `Solicitar medição`.

Rodar: `npx jest "app/obras/obra/\[id\]/__tests__/_ficha.test.tsx"` → falha.

**Implementar:** spec §4.7 — `<a>`, não `<Link>`. Rodar → passa.

---

## Tarefa 12 — Fechamento

1. `docs/DIVIDAS.md`: acrescentar as 5 bordas da spec §9, com data 16/10/2026 e motivo.
2. `npx jest app/obras app/api/obras` — tudo verde.
3. `npm run lint` e `npm run build` — sem erro novo.
4. Code review independente (outro agente) antes do merge.
5. Deploy só depois de a PARTE 2 do SQL dar 13/13 `OK` e a PARTE 3 `RESUMO: 12/12 OK` em produção; atualizar a
   tabela de `.claude/rules/sql.md` no commit em que o SQL for aplicado.
6. Teste de fumaça em produção (coordenador): agendar uma obra de teste até amanhã → some do Diário, aparece em
   Agendadas (Diário e Tarefas) e no Histórico; "Trazer de volta agora" → volta; prévia do e-mail com a linha.
