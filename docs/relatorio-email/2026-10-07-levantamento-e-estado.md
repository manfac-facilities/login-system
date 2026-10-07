# 07/10/2026 — Relatório diário por e-mail + troca do nº da OS: levantamento e estado

Pedidos literais: `docs/cliente/2026-10-07-relatorio-diario-painel-gerencial-email.md` e
`docs/cliente/2026-10-06-alterar-numero-os-campo-personalizado-field.md`.

## Frente 1 — Troca do nº da OS pelo campo "OS Cliente" (PRAZO: madrugada 07→08/10, prometido ao cliente)

**Conferido no Field (API, só leitura) em 07/10:** OS `123-TESTE` (id `M2QxNDE2ZGItNTUyYy00NzQ2LWIwMmUtNWQxZjQ5YzAzMmQ1Ojk1NzMx`)
tem `customFields[0] = { name: "OS Cliente - preencher se foi aberto sem OS", type: "question", value: "0926-017378" }`,
`updatedAt 2026-10-07T12:59:55Z`. Valor é texto puro. O Field NÃO informa quem preencheu o campo.

**Decisões do João:** número já usado por outra obra → não troca + aviso na obra; campo apagado → mantém o último válido;
histórico obrigatório (trilha: o que, de/para, quando, por quem).

**Fatos do código:**
- Sync já troca `os` quando o `identifier` muda no Field (`app/obras/sincronizar/_sincronizacao.ts:358`), mas não grava histórico (só conta `numerosDeOsAlterados`).
- `obras_historico` tem `obras_historico_campo_check` com lista fechada (`sdd-sql-obras-historico.sql:104`) — `os` não está.
- Índice único parcial `obras_obra_os_uniq` (`sdd-sql-obras-v0.sql:242`) — colisão sem tratamento derruba a atualização.
- Hub não lê `customFields` hoje.

**Desenho proposto (enxuto), AGUARDANDO SIM DO JOÃO:**
1. Migration de uma linha: incluir `os` no `obras_historico_campo_check` (sem coluna nova).
2. Sync lê o campo; preenchido e livre → troca + linha no histórico (quem = Sincronização do Field / campo OS Cliente); colisão → não troca + linha no histórico com motivo; vazio → nada.
3. Aviso de colisão na obra derivado da última linha do histórico. Mockup rápido do aviso + linha do histórico antes do código.
4. Subagente implementa, outro revisa; João faz deploy; conferir Last-Modified.

Ver também: o 123-TESTE é OS de teste — cancelar/limpar depois.

## Frente 2 — Relatório diário do Painel gerencial por e-mail às 8h

**Decisões:** a tela é o **Painel gerencial** (`/obras/painel`) — "painel operacional" na fala do cliente = essa aba.
Cliente: "é coisa simples ta? só um print". Envio pela caixa Locaweb, "mesmo critério de Compras e Financeiro".

**Levantamento (subagente Explore, 07/10):**
- Agendamento existente: pg_cron + pg_net → POST `https://hub.manfac.com.br/api/obras/sincronizar`, Bearer `OBRAS_CRON_SECRET` (Vault), service role, `after()` (`app/api/obras/sincronizar/route.ts:14-65`; `sdd-sql-obras-cron-jobs.sql:41-75`). pg_cron em UTC → 8h BRT = `0 11 * * *`.
- Painel: `app/obras/painel/page.tsx` lê `obras_obra`, `obras_diario`, `obras_tarefa`, `obras_remarcacao`; cálculo puro em `montarPainel` (`_calculos.ts`). RLS só `to authenticated` → dá para montar com service role.
- Sem lib de gráfico (barras em div + svg manual). Sem puppeteer/playwright/nodemailer no hub. `next/og` (satori+resvg) disponível no Next 16.2.11 → PNG sem navegador, CSS limitado. Print fiel exigiria Chromium = imagem Docker nova no EasyPanel.
- Hub não manda e-mail de dentro do app; Resend nunca ativado (`scripts/enviar-comunicado.mjs`, `.resend-key` ausente).
- Locaweb: só DNS conhecido (`docs/infra/dns-manfac.md:36-50`); SMTP provável `smtp.manfac.com.br`, porta/TLS NÃO confirmados.
- Compras/Financeiro: conta GitHub `Mainsis` só enxerga `login-system`; repos NÃO lidos.

**Recomendação:** imagem montada com `next/og` (metas, etapas, SLAs), inline (cid) no e-mail via nodemailer + SMTP Locaweb; cron `0 11 * * *` numa rota nova com o mesmo padrão de segredo.

**Bloqueios:** caixa remetente + destinatários (cliente) ou acesso aos repos de Compras/Financeiro; depois mockup do e-mail → spec → plano.
