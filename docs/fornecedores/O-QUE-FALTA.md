# Gestão de Fornecedores — o que falta para o cliente testar (09/10/2026)

## Atualização 10/10/2026 — etapas 1 e 2 concluídas, merges feitos

- **Banco aplicado** (frn 001–006, fin 023–024; 007/025 desligados) — 1.226 fornecedores na carga inicial; laudo
  independente sem divergência em `revisao-banco-producao-2026-10-10.md`. Detalhe em `.claude/rules/sql.md`.
- **CA-5.2 testado em produção e aprovado:** duas sessões presas na mesma trava (comprovado: 2 em `pg_stat_activity`);
  ao soltar, B gravou 60% e A foi recusada com "Passa de 100%. Ainda dá para medir no máximo R$ 400,00." Conferência 9/9
  OK; limpeza 6/6 OK (tudo apagado, trigger de imutabilidade religada, numeração reposta: o primeiro contrato real nasce
  CT-0001). Scripts revisados antes de rodar; ficaram no scratchpad da sessão.
- **Merges:** financeiro #1–#3 e fornecedores #1–#2 na `main` (conferido: SQL da main = SQL aplicado). Nenhum dos dois
  repositórios tem auto-deploy — nada subiu.
- **Segredo da integração** gerado em `C:\Users\joao-\fornecedores-integracao-secret.txt` (48 caracteres; nunca no chat).
- ⚠️ A `main` do financeiro tem **dois arquivos 023** (`023_fin_catalogo_categoria_grupo.sql`, do José, já aplicado; e
  `023_fin_integracao_medicoes.sql`, nosso, aplicado hoje). Só o número colide. O deploy do financeiro leva junto o
  commit `e31d0ae` do José (categorias por totalizadora) — confirmar com ele se já está no ar.

**Etapas 3 e 4 concluídas (10/10, noite):** financeiro na versão nova (rotas `/api/integracoes/medicoes` e
`/api/tarefas/pagamentos` respondendo 401 sem credencial); app `fornecedores` criada no projeto `manfac` do EasyPanel,
`/fornecedores/api/health` = `ok`, sem sessão cai no `/login` do hub; hub, Compras, Cockpit, Obras e Sofia abrindo.
Armadilha nova: o campo do arquivo de build veio como `dockerfile` (minúsculo) e o build falhou — tem de ser `Dockerfile`.

⚠️ **Segredos expostos no chat em 10/10:** o log de erro do EasyPanel imprime todos os `--build-arg`, e foi colado na
conversa. O `FORNECEDORES_INTEGRACAO_SECRET` foi **trocado na hora** (conferido: o antigo dá 401, o novo passa). A
**`SUPABASE_SERVICE_ROLE_KEY` NÃO foi trocada** — trocar derruba hub, Sofia, Compras, Financeiro, Cockpit e Fornecedores
até cada um ser atualizado. **Decisão pendente do João** (território de autenticação: não vai para `DIVIDAS.md`).
Regra para log do EasyPanel: colar só as linhas do erro, nunca a linha `Command failed … --build-arg`.

**11/10/2026 — card no hub antecipado a pedido do cliente:** login-system #1 mergeado (`d83eef2`) e hub no ar com
build de 11/10 21:18 UTC; fornecedores com o menu lateral (`d9821ff`) redeployado junto. O teste completo (etapa 5)
passa a ser o primeiro uso real, com Eduardo e José. Aviso dado ao cliente: aprovar medição cria pedido real no Financeiro.

**Falta:** etapas 5 e 7 abaixo (a 6 foi feita antes da 5, por pedido do cliente).

## Atualização 13/10/2026 — cliente aprovou o mockup de melhorias

- Retorno literal: `docs/cliente/2026-10-12-retorno-mockup-melhorias-fornecedores.md` ("prosseguir"; 7 suposições aceitas).
- Decisões do João: **entrega única** (não em 2 partes); schema liberado (migrations frn 009+, aplicadas após revisão
  independente); **CT-0001 segue no fluxo novo** (posicionado na etapa do Eduardo, sem perder dado).
- Em andamento: spec em `docs/fornecedores/spec-melhorias-2026-10.md` → revisão independente → plano → código.
  Clone de trabalho: `D:\fornecedores-work\fornecedores-melhorias`.
- Decisões pendentes da spec, respondidas pelo João (13/10):
  - **D1 CT-0001:** literal "como dito, o eduardo aprova o contrato e o josé as condiçoes do contrato" → lido como:
    a aprovação de condições do José (11/10) vale; quando o Eduardo aprovar, o contrato fica aprovado; nenhuma escrita no CT-0001.
  - **D2:** faixa de uso só texto; sugestão automática segue com os limites fixos (recomendação adotada, não perguntada).
  - **D3:** "Como paga" de condição existente **editável, como no mockup** (contrato aprovado continua preso à versão dele).
  - **D4:** e-mail também nas etapas de aditivo.
  - **D5 (ação do João no deploy):** confirmar mesma caixa/`SMTP_*` do Compras e pôr as 5 variáveis no EasyPanel do `fornecedores`.

## PONTO DE RETOMADA — 12/10/2026

**Feito em 11–12/10:**
- Manual no padrão visual do cliente (Compras/Financeiro): `manual/manual-uso-padrao-cliente.{html,md}` + PDF
  `manual/Manual de Uso - HubManfac - Gestão de Fornecedores.pdf` (15 p.). Revisado contra o código. Artifact privado:
  https://claude.ai/artifact/BZQFSWtXYcu5k6BNMcSAzm. João pediu o PDF (= aprovado).
- Fatos do elo com o Financeiro, conferidos no código: medição aprovada vira solicitação na hora, em nome de quem abriu,
  sempre em "Aguardando financeiro" (nunca emergencial — `emergencialManual:false`); NF/anexos NÃO vão junto; recusa no
  Financeiro HOJE só chega por e-mail do Financeiro (o Fornecedores só fica sabendo com o cron 007, desligado).
- Feedback do cliente (José) salvo literal: `docs/cliente/2026-10-12-feedback-fornecedores.md` + prints.
- **Proposta comercial opcional NO AR:** PR fornecedores #4 (`017e0d9`), migration `008` aplicada (2/2 OK), deploy
  clicado 12/10 ~11h17. **Falta o João conferir na tela** (+ Novo contrato → "Proposta comercial · opcional").
- **Mockup das melhorias** publicado: https://claude.ai/artifact/7jC6nMH8HuUdNDhsrrC6Cw (cópia em
  `mockup-melhorias-2026-10-12.html`). Cobre busca, aprovação em ordem Eduardo→José com José alterando condições, etapa
  atual na lista/linha do tempo, e-mails por etapa, Configurações (condições + modelo de contrato) e 7 suposições.
  Custo real: aprovação em ordem e condições editáveis mudam schema e regras (condições hoje fixas no seed/código) —
  ~1 semana; recomendado entregar em 2 partes (Configurações por último).

**Decisões/ações com o João:**
1. Compartilhar o mockup com o cliente (Share) + mensagem; trazer as respostas dos 7 pontos pelo WhatsApp. Nada de código das melhorias antes disso.
2. Entrega única ou em 2 partes (recomendado 2).
3. Data de pagamento do Omie (pedido do cliente, literal em `docs/cliente/2026-10-11-pedido-manual-e-fluxo-fornecedores.md`):
   ok do José para UMA consulta de teste + `C:\Users\joao-\omie-chaves.txt` (criado, 4 linhas VAZIAS: OMIE_APP_KEY,
   OMIE_APP_SECRET, FIN_CRON_SECRET, FRN_CRON_SECRET). Depois: leitura medida (roteiro no PR financeiro #2), cofre, crons 025+007.
   Ligar o 007 também traz a recusa para dentro do Fornecedores → atualizar o manual.
4. Trocar ou não a `SUPABASE_SERVICE_ROLE_KEY` (exposta no chat em 10/10).
5. CT-0001 (DAVI CRISTIANO…, global, R$ 200 mil) aguarda só a aprovação do Eduardo.

**Estado:** código completo, revisado por agentes independentes (sem bloqueante) e com testes verdes no GitHub Actions.
Nada aplicado no banco de produção, nenhum deploy. Tudo está no GitHub — nada depende desta máquina.

## Onde está cada coisa

| Peça | Onde | Estado |
|---|---|---|
| Sistema (7 telas, banco, integração) | `manfac-facilities/fornecedores` branch `main` | CI verde |
| Data real de pagamento (lado Fornecedores) | `fornecedores` PR #1 (`feat/data-pagamento` → main) | revisado, CI verde |
| Reenvio após recusa + reaplicação do banco | `fornecedores` PR #2 (`feat/reenvio` → `feat/data-pagamento`) | revisado, CI verde |
| Rota de integração no Financeiro (migration 023) | `manfac-facilities/financeiro` PR #1 | revisado, CI verde |
| Data real de pagamento no Financeiro (024, job 025 DESLIGADO) | `financeiro` PR #2 (base: #1) | revisado, CI verde |
| Rota devolve etapa/vencimento (reenvio) | `financeiro` PR #3 (base: #2) | revisado, CI verde |
| Card no painel do hub | `login-system` PR #1 — **não mergear antes do deploy** | teste 8/8 |
| Manual (rascunho) | `docs/fornecedores/manual/` + artifact privado https://claude.ai/artifact/4uV3uJ4DDJpAMBw2zoqnMz | aguarda o João |
| Roteiro de deploy | `docs/fornecedores/deploy-easypanel.md` | pronto |
| Laudos de revisão | `docs/fornecedores/revisao-*.md` | todos aprovados |

## O que falta, em ordem

| # | Etapa | Quem | Tempo |
|---|---|---|---|
| 1 | Liberar a permissão de banco de produção no Claude Code (o auto mode bloqueia leitura/escrita e até o script de aplicação). Como: **Shift+Tab** para sair do auto mode e aprovar cada comando (~10) com um clique. Confirmar também se o João ainda tem acesso ao EasyPanel (código estava com o cliente) | João | 5–15 min |
| 2 | Aplicar em `iyytcavcgukfjnjjrerx`: fornecedores `supabase/hub-install/001…006` (007 é o cron, desligado) + financeiro 023 e 024 (025 é o cron, desligado). Conferir OK/FALHOU; a 006 roda UMA vez e precisa carregar N > 0 fornecedores. Teste de concorrência (CA-5.2) com dados de teste apagados depois. Atualizar a tabela de migrations em `.claude/rules/sql.md` | Claude | ~1 h |
| 3 | Financeiro: merge #1 → #2 → #3 na `main`; Environment `FORNECEDORES_INTEGRACAO_SECRET` (≥ 32, gerado na hora); Deploy só do financeiro | João clica, Claude confere | ~30 min |
| 4 | Fornecedores: merge #1 e #2 na `main`; criar a app no EasyPanel pelo roteiro (HTTPS ligado, porta 80, caminho `/fornecedores`, variáveis da tabela + `FRN_CRON_SECRET`); Deploy | João ou cliente | 30–60 min |
| 5 | Teste completo em produção (contrato → aprovação → medição → pedido no Financeiro), dados de teste apagados; conferir que Compras, Financeiro e hub seguem abrindo | Claude | 1–2 h |
| 6 | Merge do card (login-system #1) e Deploy do hub | João clica, Claude confere | 15 min |
| 7 | Manual: João aprova → PDF → mensagem curta ao CEO | João + Claude | ~1 h |

**Pode vir depois do teste do cliente:** data real de pagamento. Precisa das chaves do Omie gravadas em arquivo pelo João
(nunca no chat) → leitura medida de `ListarMovimentos` (roteiro no PR financeiro #2) → ligar os crons 025 (07:17 UTC) e 007
(07:41 UTC) e pôr os segredos no cofre do banco. Até lá a medição mostra "Pagamento solicitado" com o nº FIN.

## Riscos

1. ~~Acesso ao EasyPanel com o cliente~~ — **corrigido em 10/10: o João tem acesso pleno.**
2. **Primeiro deploy de app nova** pode surpreender (o Compras caiu no portal do hub com HTTPS desligado) — 1–2 h de folga.
3. **Projeto próprio no EasyPanel:** não verificado se aceita o mesmo domínio vindo de outro projeto; se não, app no projeto `manfac` (deploy continua isolado).
4. **Máquina local:** pouca memória e disco C cheio — rodar testes no GitHub Actions; clones de trabalho em `D:\fornecedores-work`.

## Pendente com o cliente (WhatsApp)

> Bom dia! Uma dúvida rápida do sistema de Fornecedores: quando o Financeiro recusa um pagamento de medição, quem abriu a medição pode corrigir e reenviar sozinho, ou só o Eduardo? (Hoje deixamos os dois.)

## Depois do teste

Uma rodada de ajustes com o retorno do cliente pelo WhatsApp (histórico: meio dia a um dia).
