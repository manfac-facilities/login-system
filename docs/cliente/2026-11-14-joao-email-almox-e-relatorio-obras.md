# Pedidos do João sobre e-mail (14/11/2026)

Mensagens no chat, literal:

> pode

(resposta a: gravar BASE, DPSP, PROFARMA e as 15 equipes sem dúvida e copiar os saldos)

> sobre a chave do email vamos pegar a mesma que ja tem em outro app que usa o msm formato

> e também quero que pare de me mandar email do painel de obras do gestao de obras

Tradução: (1) o almox usa as mesmas `SMTP_*` do Compras/hub (Locaweb), copiadas para `ALX_SMTP_*`;
(2) o relatório diário do painel de Obras deixa de ir para o João — variável
`OBRAS_RELATORIO_SEM_ENVIO` no app do hub (commit `6423329`).
