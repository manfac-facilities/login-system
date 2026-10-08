# 08/10/2026 — Mockup do e-mail diário do Painel gerencial: APROVADO

Mockup: https://claude.ai/artifact/7mRBFRUYoUXhZecDv2CGAm (versão 1)
Fonte do mockup (scratchpad da sessão, não versionado): `mockup-email-painel.html`.

## Resposta do João (08/10/2026), literal

> aprovado

Dada em resposta à lista de 6 itens do Claude, cada um com recomendação. Aprovação lida como
**aceite das recomendações**:

1. Imagem com os 8 blocos do painel, sem corte (pedido: "só um print do painel gerencial").
2. Imagem gerada com **900px** de largura (não 1200), exibida a 600px. No celular, o caminho é o
   botão "Abrir o Painel no hub".
3. Cronograma: recorte fixo das obras mais críticas (atrasadas, paradas, próximas a iniciar),
   **7 obras**, com a linha "Mostrando N de M obras".
4. Painel quase vazio: zeros em cinza + faixa neutra "X das Y obras ainda não têm valor em R$ no hub".
5. Falha ao montar: **ninguém recebe nada, sem aviso aos administradores**; o hub registra a falha;
   o dia seguinte sai normal. Sem reenvio.
6. Textos: remetente "Manfac" <manfac@manfac.com.br>; saudação "Bom dia! Segue o Painel gerencial
   de hoje."; assunto "Gestão de Obras — Painel gerencial de DD/MM/AAAA"; rodapé com o motivo do
   recebimento e o horário de leitura dos dados.

Mais as três correções que o Claude apontou e entram junto:
- `alt` da imagem com os 4 números principais (carteira, faturamento do mês, faturado no ano, pendente).
- Corrigir o plural "últimos 1 meses fechados" no painel real.
- Conferir que o valor grande do cartão de faturamento cabe.

Decisões anteriores: `docs/cliente/2026-10-07-relatorio-diario-painel-gerencial-email.md`
(Locaweb, não Resend; remetente; destinatários = slug `obras` + administradores; 8h BRT).
Levantamento técnico: `docs/relatorio-email/2026-10-07-levantamento-e-estado.md`.
