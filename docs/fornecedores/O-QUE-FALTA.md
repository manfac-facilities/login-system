# Gestão de Fornecedores — o que falta para o cliente testar (09/10/2026)

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

1. **Acesso ao EasyPanel** está com o cliente desde 20/09 — combinar horário.
2. **Primeiro deploy de app nova** pode surpreender (o Compras caiu no portal do hub com HTTPS desligado) — 1–2 h de folga.
3. **Projeto próprio no EasyPanel:** não verificado se aceita o mesmo domínio vindo de outro projeto; se não, app no projeto `manfac` (deploy continua isolado).
4. **Máquina local:** pouca memória e disco C cheio — rodar testes no GitHub Actions; clones de trabalho em `D:\fornecedores-work`.

## Pendente com o cliente (WhatsApp)

> Bom dia! Uma dúvida rápida do sistema de Fornecedores: quando o Financeiro recusa um pagamento de medição, quem abriu a medição pode corrigir e reenviar sozinho, ou só o Eduardo? (Hoje deixamos os dois.)

## Depois do teste

Uma rodada de ajustes com o retorno do cliente pelo WhatsApp (histórico: meio dia a um dia).
