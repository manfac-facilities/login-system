---
paths:
  - "app/obras/**"
  - "app/api/obras/**"
---

# Módulo Controle de Obras

Maior módulo do hub: 81 arquivos `.ts`/`.tsx`. Mapa completo em
`docs/onboarding-duda/inventario-hub-2026-09-20.md` (seção 2) — leia lá antes de
perguntar "onde fica X". Este arquivo só registra o que não está óbvio.

## Onde fica o quê

- **`_lib/tipos.ts`** (845 linhas) — tipos e regras centrais (`Etapa`, `Obra`,
  `derivar`, `faseDe`, `critico`, `estourou`, severidade). Arquivo mais importado
  do módulo; mexer aqui tem raio de alcance grande.
- **`_lib/importacao.ts`** (690 linhas) — parsing da planilha legada (dois formatos).
  Não é mais a fonte dos dados, mas o código continua vivo.
- **`_lib/ficha-campos.ts`** (368 linhas) — validação dos blocos editáveis da ficha.
- **`_lib/field/`** — cliente HTTP do Field Control. **Fronteira pública é só
  `index.ts`** (o próprio arquivo diz "IMPORTE DAQUI, não dos arquivos internos").
- **`obra/[id]/`** — a Ficha: `_ficha.tsx` (870 linhas, monta a tela), `_actions.ts`
  (741 linhas, Server Actions de salvar/liberar/mudar etapa), `_triagem.tsx`
  (647 linhas, modo de definição inicial, não é aba separada).
- **`sincronizar/`** — tela e lógica da sincronização com o Field: `_execucao.ts`
  (337 linhas, executa a varredura), `_sincronizacao.ts` (428 linhas, planeja o
  diff), `_criterio-de-entrada.ts` (o filtro do cliente).
- **`base/`, `diario/`, `tarefas/`** — as três abas do layout (`layout.tsx` client-side,
  marca aba ativa por `usePathname`).
- **`importar/`** — importação manual de planilha; legado, mantido mas não é a fonte.
- Testes ficam ao lado do código (`__tests__/` em cada subpasta), **mais** um
  `app/obras/__tests__/` de nível de módulo para `_lib/` e componentes de topo
  (`tipos.test.ts` 811 linhas, `importacao.test.ts` 792, `ficha-editavel.test.ts` 758).

## Como o dado entra

A obra nasce no Field Control — **não existe cadastro manual em produção**
(`importar/` é legado). O caminho:

1. `app/api/obras/sincronizar/route.ts` — rota chamada pelo `pg_cron`, autenticada
   por `OBRAS_CRON_SECRET` (header `Bearer`, comparação em tempo constante). Chama
   `prepararExecucao`/`executarExecucaoPreparada` de `sincronizar/_execucao.ts`.
2. `sincronizar/_actions.ts` (`sincronizarComFieldAction`) é o mesmo caminho para o
   clique manual em "Puxar do Field" — mesma execução, origem diferente.
3. `sincronizar/_execucao.ts:185` lê `process.env.FIELD_API_KEY` **diretamente**
   (única leitura de `process.env` no módulo) e desce a chave por parâmetro
   (`criarClienteField({ chaveApi })`). **A partir daí `_lib/field/` não lê
   `process.env` de propósito** — mudar isso quebra o objetivo de a camada Field
   ser testável sem mock de ambiente.
4. `sincronizar/_criterio-de-entrada.ts` decide o que entra: última atividade em
   pendente, agendada ou em andamento (critério do cliente, `feedback-20`).
5. Cron, dois jobs (estado em 20/09/2026, ver armadilha abaixo):
   `obras-field-incremental` em `*/5 * * * *`; `obras-field-completa` em
   `2 6 * * *` — só ela detecta OS arquivada/sumida no Field, e roda ~3 min.

## Armadilhas — só as que já morderam

1. **`export type` num arquivo `use server` derruba a tela inteira**
   (`ReferenceError: <Tipo> is not defined`). `tsc` e os testes não pegam isso —
   em teste os tipos somem direito, só aparece em runtime real. Corrigido em
   `e26d7ce`; regressão coberta em `4071df1`, que varre os arquivos `use server`
   do hub. Se adicionar `export type` a `_actions.ts` de novo, confira manualmente.
   (`docs/cliente/2026-08-31-sistema-controle-de-obras/ESTADO.md:205`)

2. **Os dois jobs de cron podem colidir e um morre em silêncio.** Até 20/09 ambos
   disparavam às 06:05 UTC; quem perdia a trava `obras_sync_execucao_uma_rodando`
   recebia 409 `ja_estava_rodando` e **não gravava linha nenhuma** — nem em
   `obras_sync_execucao`, nem erro visível. `cron.job_run_details` mostrava
   `succeeded` mesmo assim, porque para o `pg_cron` a chamada HTTP foi feita. Isso
   deixou a varredura completa sem rodar de 17/09 a 19/09 (4 dias cego para OS
   arquivada). Corrigido movendo `obras-field-completa` para `2 6 * * *` — ao tocar
   em qualquer um dos dois cron schedules, mantenha uma folga de minutos entre eles.
   (`ESTADO.md`, seção 20/09, "A colisão do cron das 06:05 foi corrigida hoje")

3. **A coluna `origem` da execução não prova que o agendamento rodou.**
   `app/api/obras/sincronizar/route.ts:52` grava `origem: 'agendada'` para
   **qualquer** chamada que passe pelo segredo — inclusive testes manuais feitos
   por humano com `curl`. Para confirmar que o cron de fato disparou, use
   `tipo: 'incremental'` combinado com `cron.job_run_details`, nunca a coluna
   `origem` sozinha. (`ESTADO.md`, seção 16/09, "Armadilha ao verificar isto no futuro")

## Estado em 23/09/2026

No ar: build de **23/09 19:38 UTC** (master `2b7d2fa`) — ficha editável (no ar desde
20/09), marcos da esteira gravados, histórico de alterações ligado, e os ajustes de
23/09: etapa `aprovarOS` exibida como "Executado - pendente aprovação OS", data de
fechamento da OS informável/corrigível, equipe/prestador em texto livre. Faixa
"Novidade" (`hub_comunicados`) no ar, comunicado 01 publicado; e-mail pendente do
Resend. Os 4 e-mails com slug `obras` têm conta e já entraram. Deploy segue manual,
com o código de acesso ao EasyPanel com o cliente. Próximo: cancelamento de obra
(mockup aprovado 23/09; exige migration `sdd-sql-obras-cancelamento.sql`).

**No master em 24/09, ainda sem deploy (quem deploya atualiza esta linha):** cancelamento de
obra (merge `fed48eb`; migration `obras-cancelamento` já aplicada em 23/09) e as dívidas da ficha
(merge `29b526e`): troca de etapa atômica (etapa + marcos numa chamada só da RPC, com linha
"Esteira · Etapa" no Histórico), auto-avanço da Autorização carimba os marcos, liberação da
Triagem valida datas no servidor, e os três blocos detectam edição concorrente pela versão do
bloco (`versaoDoBloco`). Dívidas A1, A13, A16, B5, B7 fechadas; bordas novas em A31–A36.
