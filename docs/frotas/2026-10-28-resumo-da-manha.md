# Resumo para o João — manhã de 28/10/2026

## Pronto de madrugada (tudo revisado por agente independente, nada em produção)

| Frente | Onde | Estado |
|---|---|---|
| Etapa 1 do Frotas (rodada 2) + Urgência Alta por KM | branch `frotas/rodada2-integracao` (`84fef2c`), já com o master junto (diário de Obras) | 548 testes ok, `tsc` ok, build ok |
| Compatibilidade "hub no ar + SQL da Etapa 1" | — | compatível nos 4 passos (ordem pode ser SQL antes, deploy depois) |
| Mockup Etapas 2 e 3 (cadastros e extratos) | https://claude.ai/artifact/5HaVsqgsUPZbe13KDzXvkx | publicado, espera aprovação |
| Backend Etapas 2 e 3 | branch `feat/frotas-extratos-backend` | SQL testado em banco local 24/24 e 42/42; 74 testes; amostras reais batem (206/26 e 403/27) |

**Não foi feito:** aplicar SQL em produção — a trava de permissão barrou mesmo com a autorização geral. Precisa de
autorização sua por escrito, na hora.

## O que você faz de manhã, em ordem

1. Responder: **"autorizo aplicar em produção os SQLs da rodada 2 do Frotas: peças trocadas, gestor de frotas,
   correções F1-F3, os dois testes e o revoke do audit_log"**. Eu aplico e confiro (4/4, 18/18, 37/37, 12/12, 35/35).
2. Eu mergeio a integração no master e envio.
3. **Você clica Deploy** no app `manfac-login-system`. Antes, abra o histórico de deploys: o clique de ontem à noite não
   gerou build novo (no ar ainda é o build de 27/10 10:26). Eu confiro pelos arquivos publicados.
   Esse deploy leva junto o **diário de Obras** e a **Etapa 1 do Frotas**.
4. Me mandar o **e-mail do Igor** para eu dar o papel de gestor de frotas.
5. Mandar ao cliente as mensagens (eu deixo prontas depois de conferir o deploy).

## Decisões para você (Etapas 2 e 3), com minha recomendação

1. **Cartão/tag com data de início** (trocar de equipe não muda o passado) — decidi provisoriamente que **sim**. Confirma?
2. **Envios e saldos digitados visíveis para todos do Frotas** (hoje: sim, incluindo e-mail de quem enviou). Recomendo
   restringir a gestor/admin/financeiro.
3. **Encerrar a ligação de um cartão desativado** (hoje não dá; o gasto vai para a última equipe). Recomendo incluir na
   tela de cadastro.
4. **Aviso quando um reenvio traz a mesma transação com valor diferente** (hoje é ignorada em silêncio, como pedido).
   Recomendo mostrar o aviso no resultado do envio.

Depois do mockup aprovado: telas das Etapas 2 e 3 (~1 dia) e aplicação do SQL dos extratos.

## Aviso: disco C: cheio

Às 02h o disco estava com 250 MB livres (chegou a 0 durante a noite). Apaguei só caches de build que se recriam.
O resto do espaço não é meu — vale olhar quando puder, porque build e testes falham com disco cheio.
