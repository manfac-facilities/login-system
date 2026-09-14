# Conferência de lista fechada — D3 (commit 972945b, `origin/duda/field-api-client`)

Data: 14/09/2026. Só leitura: `git fetch` + `git show`/`git diff master...origin/duda/field-api-client`.
Sem checkout, sem banco, sem API. **Os testes não foram rodados** (rodar exigiria checkout). A régua
usada é a de `conselho-revisao-d21-2026-09-14.md`.

**MERGE: sim. Bloqueadores: nenhum.**

Referências: `route.ts` = `app/api/obras/sincronizar/route.ts`, `_execucao.ts` =
`app/obras/sincronizar/_execucao.ts`, `SQL` = `sdd-sql-obras-sync-execucao.sql` (todos no branch).

---

## Lista fechada

### 1. Agendador pg_cron + pg_net, incremental a cada 15 min, completa às 06:00 UTC — CUMPRIDO
- `SQL:114-131`: job `obras-field-incremental`, `*/15 * * * *`, `net.http_post` com corpo `{"tipo":"incremental"}`.
- `SQL:133-150`: job `obras-field-completa`, `0 6 * * *`, com corpo `{"tipo":"completa"}`.
- As duas URLs apontam para `https://hub.manfac.com.br/api/obras/sincronizar` (`SQL:119`, `SQL:138`). O handler é só `POST` (`route.ts:25`).

### 2. Tabela única, marca vigente = última execução com sucesso, avança só em sucesso, maior updated_at, margem de 10 min — CUMPRIDO
- Tabela única `obras_sync_execucao` com tipo, origem, status, erro, contagens e `marca_dagua_nova` (`SQL:7-35`). A marca não é guardada em nenhum outro lugar.
- Marca vigente: a subconsulta pega a última linha com `status='sucesso'`, ordenada por `finalizada_em desc` (`SQL:93-100`).
- A marca avança só em sucesso: `marca_dagua_nova` fica nula quando o status não é `sucesso` (`_execucao.ts:172`). Qualquer falha de gravação lança erro antes de a marca ser calculada (`_execucao.ts:277-279`).
- A marca é o maior `atualizadoEm` vindo do Field, nunca abaixo da anterior (`_execucao.ts:76-84`, `281`).
- Margem de 10 min (`_execucao.ts:25`, `86-91`), aplicada só quando o tipo é incremental (`_execucao.ts:140`).

### 3. Bearer com tempo constante, service role só na rota, /api/obras fora do matcher, criado_por nulo — CUMPRIDO
- Os dois lados passam por SHA-256 antes do `timingSafeEqual`, e a rota recusa o cabeçalho vazio (`route.ts:13-23`, chamada em `route.ts:30`).
- `createAdminClient()` só aparece em `route.ts:49`. O botão continua usando o client do usuário, e `_execucao.ts` recebe o client por parâmetro.
- `middleware.ts:127-142`: o matcher tem `/api/conversor-os` e `/api/sofia`, mas não `/api/obras`.
- A execução agendada grava `criadoPor: null` (`route.ts:53`). `obras_obra.criado_por` não tem default (`sdd-sql-obras-v0.sql:119`) e a sincronização não preenche o campo, então a obra criada pelo job nasce com autoria nula.
- O comentário que explica o porteiro está em `route.ts:47-48`.

### 4. Trava no banco (índice único parcial em rodando) com expiração de órfã — CUMPRIDO
- Índice único parcial `on ((true)) where status = 'rodando'` (`SQL:39-41`).
- A mesma função expira a trava órfã antes de tentar inserir (`SQL:77-82`), e o insert usa `on conflict do nothing` (`SQL:86-89`). Sem linha nova, a resposta é "já estava rodando" (`_execucao.ts:132`).
- A expiração é de 2h (`_execucao.ts:26`, `122`).

### 5. O status vale pelo que foi gravado, não pela resposta ao pg_net — CUMPRIDO
- A rota responde 202 "rodando" e deixa o trabalho no `after()` (`route.ts:59-67`).
- O resultado final é gravado na linha pelo `finalizarExecucao` (`_execucao.ts:161-177`).
- A tela lê o histórico da tabela (`page.tsx:38-44`). O job usa `timeout_milliseconds := 5000`, e nada depende da resposta que o pg_net recebe.

### 6. Contrato do botão e executor único — CUMPRIDO
- O botão chama o mesmo `executarSincronizacao` com tipo `completa` e origem `botao` (diff de `_actions.ts`). As 180 linhas antigas foram removidas, sem segunda cópia.
- O executor reusa `listarOsNormalizadas` (`_execucao.ts:191`) e `planejarSincronizacao` (`_execucao.ts:213`). O `_sincronizacao.ts` não mudou no diff.
- Em `obras_obra` só há `insert` (`_execucao.ts:234`) e `update` por id vindos do plano (`242`, `259`). Não há `delete` nem mesclagem nova.

### 7. Incremental nunca marca ausência, inclusive a inaugural — CUMPRIDO
- `varreduraCompleta: execucao.tipo === 'completa'` (`_execucao.ts:213-217`). Quem decide é o tipo da execução, não a ausência de `desde`. Na incremental inaugural o `desde` fica vazio e a leitura é total, mas a varredura continua valendo como incremental.
- A reconciliação de ausência só roda com `varreduraCompleta` (`app/obras/sincronizar/_sincronizacao.ts:349`).
- O teste `_execucao.test.ts:31-45` cobre o `desde` vazio com tipo incremental.

### 8. Testes do "Pronto quando" — CUMPRIDO (lidos, não executados)
- **Trava:** `__tests__/_actions.test.ts:459` (a RPC sem linha devolve `jaEstavaRodando` e o Field não é chamado) e `route.test.ts:81-88` (409 sem agendar o `after`). O índice em si só se prova rodando o SQL.
- **Rota sem segredo:** `route.test.ts:52-57` (401 sem criar o client admin). O caso de tamanho diferente está em `route.test.ts:76-79`.
- **Falha no meio não avança a marca:** `__tests__/_actions.test.ts:440-457` (status `falhou` com `marca_dagua_nova: null`).
- **Botão manual continua funcionando:** `__tests__/_actions.test.ts:459` (tipo completa, origem botao, `p_criado_por: 'u1'`) e o sucesso em `:165-171` (grava `sucesso` com a marca).
- O "`npx jest app/obras` em verde" **não foi verificado por mim**. O teste da rota fica em `app/api/`, fora desse caminho: rode `npx jest app/obras app/api/obras`.

---

## Verificações de segurança e de migration

### a) Rota — OK, sem brecha
- **Tempo constante sem vazar tamanho:** os dois valores viram hashes de 32 bytes antes do `timingSafeEqual`, então o comprimento não entra na comparação (`route.ts:13-23`).
- **Segredo ausente, vazio ou só com espaços:** a rota devolve 503 antes de qualquer comparação (`route.ts:26-29`) e nunca aceita Bearer vazio. Mesmo sem esse corte, `recebido.length > 0` recusaria.
- **Outro método:** só `POST` é exportado, e o Next responde 405 aos demais.
- **Vazamento:** a rota nunca devolve o segredo. A mensagem de erro interna só aparece no 500 (`route.ts:68-72`) e no 400, que vêm **depois** da autenticação, ou seja, só para quem já tem o segredo. Para quem não tem, as respostas são `401 Não autorizado` e `503 não configurado`, sem dado nenhum.

### b) 202 com trabalho depois — OK
- A rota usa `after()` (`route.ts:61-63`), não promessa solta. A doc desta versão (Next 16.2.11) confirma: "`after` is fully supported when self-hosting with `next start`", e as callbacks pendentes rodam no desligamento gracioso (`node_modules/next/dist/docs/01-app/02-guides/self-hosting.md:295-299`). O `maxDuration = 300` não limita nada no `next start`.
- `revalidatePath` dentro do `after` num route handler não lança erro: `revalidate.js:114` só lança na fase `render`. O `catch` não chega a sobrescrever o `sucesso` com `falhou`.
- **Trava presa:** se o container reiniciar no meio (um deploy, por exemplo), a linha fica `rodando` por até 2h. A próxima chamada depois disso a marca como `falhou` (`SQL:77-82`) e segue. A sincronização fica suspensa por no máximo 2h, não para sempre, e a marca não avança, porque só avança no update de sucesso.
- **Marca avançando errado:** não achei cenário. No caso extremo, uma execução com mais de 2h expira e depois termina com marca menor que a de uma execução mais nova. A marca vigente então **recua**, e o único efeito é reler uma janela maior. Esse lado é seguro: não perde OS.

### c) Migration — OK
- Está dentro de `begin`/`commit` (`SQL:5`, `SQL:152`).
- **É idempotente:** `create table/index if not exists`, `drop policy if exists` antes do `create policy`, `create or replace function`, e `cron.schedule` com nome fixo, que substitui o job de mesmo nome. Reaplicar não duplica jobs.
- **RLS:** está ligada, com uma única policy `for all to authenticated using/with check (obras_is_admin())` (`SQL:50-53`). A tela lê como admin e passa. O usuário não admin não lê nem escreve, e o `anon` não tem policy nenhuma. A service role fica acima da RLS, como esperado.
- **Função `obras_iniciar_sync_execucao`:** é `security invoker`, **não** definer, então não eleva privilégio. Tem `set search_path = pg_catalog, public` (`SQL:63-64`) e `revoke execute from public, anon` (`SQL:105-106`). Quem não é admin nem service role recebe 42501 (`SQL:67-70`) e, mesmo sem essa guarda, esbarraria na RLS. Um admin pode passar `p_expira_antes` no futuro e derrubar a trava, mas isso é poder de admin, não escalada.
- **Armadilha do NULL:** não se aplica. `obras_is_admin()` é `exists(...)` e sempre devolve true ou false (`sdd-sql-obras-v0.sql:303-315`), e `current_user <> 'service_role'` nunca é NULL.
- **Armadilha da trigger compartilhada:** não se aplica, porque a migration não cria trigger.
- **Segredo dos jobs:** o job lê `vault.decrypted_secrets where name = 'OBRAS_CRON_SECRET'` na hora de rodar (`SQL:127-129`, `146-148`). O `cron.job.command` guarda só essa consulta, **sem o valor**. Se o segredo não existir no Vault, a consulta volta vazia, nenhum POST sai e nada acontece.
- **Não verificado:** o pg_net guarda os headers da requisição por instantes em `net.http_request_queue`. O schema `net` não é exposto pela API, então não tratei isso como brecha.
- **Extensões:** a migration não cria `pg_cron` nem `pg_net`, porque a decisão registra que as duas já estão instaladas (verificado em 14/09). Se não estiverem, o `cron.schedule` falha e o `begin/commit` desfaz tudo.

### d) Tela /obras/sincronizar — OK
- Há duas travas: a página só mostra o histórico para admin (`page.tsx:20`) e a RLS filtra a leitura.
- As colunas são datas, tipo, origem, status, contagens, marca e `erro` (`page.tsx:41`, `_historico.tsx:53-68`). O `erro` é a mesma mensagem que o botão já mostrava na tela antes da D3. A diferença é que agora ela fica gravada, e continua visível só para admin. Nenhuma coluna traz segredo ou chave.

---

## Backlog (não bloqueia, não vai ao Duda nesta rodada)
- **Colisão às 06:00 UTC:** os dois jobs disparam no mesmo minuto, já que `*/15` inclui 06:00. Se a incremental pegar a trava primeiro, a completa leva 409 e não roda naquele dia, e a ausência só é detectada no dia seguinte. Não mistura nem apaga dado. O ajuste é de configuração e dá para fazer ao aplicar: por exemplo, `'5 6 * * *'` na completa (`SQL:135`), dentro de uma janela em que a incremental das 06:00 já terminou. Com 167 OS, a execução deve durar segundos, mas isso não foi medido.

---

## O que o João/Claude precisa fazer para ligar

> ⚠️ **Ligar = fazer a primeira carga do Field.** A primeira incremental é a "inaugural": lê as
> 167 OS e **insere todas** em `obras_obra`. Isso depende da pergunta 06 ao cliente ("liberar a
> primeira carga do Field"). **O interruptor é o segredo no Vault:** sem ele os jobs não chamam
> nada. Dá para aplicar a migration e deployar antes, e gravar o segredo no Vault só quando a
> carga estiver liberada.

1. **Gerar o segredo** (32 bytes aleatórios ou mais, em hex) **fora do chat**, num PowerShell do João ou gravado em arquivo fora do repositório, como foi feito com o PAT. O valor nunca pode passar pelo `!` do chat nem entrar em arquivo versionado.

2. **EasyPanel** → projeto `manfac`, app `manfac-login-system` → Environment:
   `OBRAS_CRON_SECRET=<valor>`, **tudo numa linha só**. Confirme no mesmo lugar que `SUPABASE_SERVICE_ROLE_KEY` e `FIELD_API_KEY` também estão lá, cada uma no formato `NOME=valor`: a rota depende das duas. O Environment só entra no container no próximo deploy.

3. **Merge e push** do branch no `master`.

4. **Aplicar `sdd-sql-obras-sync-execucao.sql`** (Management API, ref `iyytcavcgukfjnjjrerx`) **antes do deploy**. O código novo do botão chama a RPC `obras_iniciar_sync_execucao`: com o deploy antes da migration, o botão quebra. Já a migration antes do deploy não quebra nada, porque o código antigo ignora a tabela e os jobs sem segredo no Vault não chamam ninguém. Conferência:
   ```sql
   select jobname, schedule, active from cron.job where jobname like 'obras-field-%';   -- 2 linhas, active = true
   select to_regclass('public.obras_sync_execucao');                                   -- não nulo
   ```

5. **Deploy:** o João clica em Deploy no `manfac-login-system`. Confirme pelo `Last-Modified` dos chunks de `https://hub.manfac.com.br/login`: todos com o mesmo timestamp, posterior ao push. Depois, o teste de fumaça da rota **sem** segredo:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -X POST https://hub.manfac.com.br/api/obras/sincronizar
   ```
   A resposta tem que ser `401`. `503` significa que o `OBRAS_CRON_SECRET` não chegou no processo (a armadilha do `NOME=valor`), e `404` significa que o deploy não subiu.

6. **Gravar o segredo no Vault, com o nome exato `OBRAS_CRON_SECRET`** (maiúsculas; é o nome lido em `SQL:128` e `SQL:147`), com o **mesmo valor** do EasyPanel. O caminho é Dashboard → Integrations → Vault → Add new secret, ou pela Management API lendo o valor de arquivo: `select vault.create_secret('<valor>', 'OBRAS_CRON_SECRET');`. Conferência sem expor o valor:
   ```sql
   select count(*) from vault.decrypted_secrets where name = 'OBRAS_CRON_SECRET';   -- 1
   ```
   **Só faça este passo com a primeira carga liberada pelo cliente.**

7. **Confirmar que o primeiro job rodou** (espere o próximo múltiplo de 15 min):
   ```sql
   -- o job disparou?
   select d.start_time, d.status, d.return_message
   from cron.job_run_details d join cron.job j using (jobid)
   where j.jobname like 'obras-field-%' order by d.start_time desc limit 5;

   -- o hub respondeu? (202 = aceito; 401 = segredo diferente entre Vault e EasyPanel; 503 = env ausente; 409 = trava)
   select id, status_code, error_msg, created from net._http_response order by created desc limit 5;

   -- o que de fato aconteceu (é esta a fonte da verdade)
   select iniciada_em, finalizada_em, tipo, origem, status, erro, total_field, novas, atualizadas, ignoradas, marca_dagua_nova
   from public.obras_sync_execucao order by iniciada_em desc limit 5;
   ```
   Resultado esperado da primeira: `tipo = incremental`, `origem = agendada`, `status = sucesso`, `total_field ≈ 167`, `novas ≈ 167` e `marca_dagua_nova` preenchida. A partir dela, as próximas incrementais leem só a janela desde a marca, com 10 min de margem.
   Uma linha presa em `rodando` por muito tempo indica que o container reiniciou no meio. A trava expira sozinha em 2h.
