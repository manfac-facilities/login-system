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

## Respostas do João após a spec (08/10/2026), literal

> E sim, eu autorizo o agendamento para as 8h01, como você falou. E eu posso fazer o deploy, é só você me falar quando.

> Pode testar a rota mandando só para mim esse e-mail para eu ver como é que ele vai ficar na prática.

> Prossiga com a opção a

Opção A = sem tabela de registro; a falha fica só na resposta do pg_net e no log do servidor.

## Achado do Claude (08/10/2026): variáveis do Compras

`manfac-facilities/compras` (`lib/avisos/configuracao.ts`) já manda e-mail pela Locaweb com
nodemailer e lê `SMTP_HOST`, `SMTP_PORTA` (padrão 465), `SMTP_USUARIO`, `SMTP_SENHA`,
`SMTP_REMETENTE`. O hub passa a usar **os mesmos nomes** ("mesmo critério de Compras e
Financeiro"): o João copia essas linhas do Environment do app `compras` para o
`manfac-login-system`, e host/porta deixam de ser incógnita.

## Teste real e decisões (09/10/2026), literal

> Achei que o print está sem resolução
> Principalmente dando zooom

(Resposta: imagem passou a sair em 2x — 1800 px — `0dd9ab5` no branch `relatorio-email`.)

> ficou bom, mantém as 28 e aprova a nova tentativa

= e-mail de teste aprovado; bloco Equipes com todas as equipes (28 hoje); se a Locaweb recusar
um envio, uma nova tentativa automática depois de 1 minuto.

## Deploy e disparo extra (09/10/2026), literal

> cliquei em deploy

> depois de ligar o agendamento quero que faça um disparo as 11:10 para cobrir o dia de hoje, e nos próximos o disparo acontece normalmente
