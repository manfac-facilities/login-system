# Ajustes para a rodada de integração das melhorias (coordenador)

Melhorias não bloqueantes apontadas nas revisões das frentes. Entram depois que todas as frentes forem mergeadas em
`feat/melhorias`, numa rodada só. O que não couber vai para `docs/DIVIDAS.md`.

| De | Ajuste | Decisão |
|---|---|---|
| H | `NEXT_PUBLIC_APP_URL` preenchida no EasyPanel (senão o link do e-mail sai relativo) | checklist de deploy |
| H | E-mails 1 e 2: mostrar parcelas da condição, como no mockup | fazer se couber |
| H | Sem destinatário: registrar em `frn_avisos`, não só log | DIVIDAS |
| C | Chip Encerrado passou a incluir `cancelado` (spec: "igual ao status") | reverter para a spec |
| C | Busca por dígitos ("ct-1") acha mas não destaca | DIVIDAS |
| C | Teste do atraso de aprovado usando a versão pinada | fazer |
| D | Devolvido: "!" no passo de quem devolveu (Eduardo/José), como no mockup | fazer se `devolvido_por` permitir saber o papel |
| D | Remover cast e fallback `SPOT_MENSAL_CONSOLIDADO` depois da B | fazer |
| D | Cancelado sem "desde"; banner de reenvio em tom aviso (mockup: info) | DIVIDAS |
| D | Pulso animado do "agora" (CSS fora da frente D) | conferir se a G fez |
