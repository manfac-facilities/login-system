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
| B | Diálogo de aditivo (`acoes.tsx`): nome/prazo de condição nova vêm da cópia fixa (aparece só o código, prazo "—"); `page.tsx` passar o catálogo | fazer (só exibição) — repassado à E |
| B | Varredura final: nenhum `condicaoPorCodigo(` sem catálogo em `_lista.ts` (C), `documento/*` (F, repassado), `aprovacoes/_lib/condicao.ts` (E, repassado) | fazer na integração |
| B | `lib/regras/aditivo.ts` com `CONDICOES` como padrão: tornar o catálogo obrigatório depois da E | fazer |
| D/G | Pulso animado do "agora" na linha do tempo: nenhuma frente fez (CSS em `ui.css`) | fazer na integração |
| E | Tirar o padrão `CONDICOES` de `nomeDaCondicao`/`prazoDaCondicao`/`condicaoDe`/`parcelasDoContrato` depois que `contratos/[numero]/page.tsx:187,189` (D), `_ficha/acoes.tsx:365,371,377` e `_ficha/calculo.ts:107` (B) passarem o catálogo; conferir se `calculo.ts:107` envolve valor | fazer na integração |
| B-rev | **I-1 (bloqueia o deploy):** depois de juntar tudo, nenhum prazo/parcela/texto de contrato aprovado pode sair da cópia fixa: conferir `[numero]/page.tsx:187-189` (usar `f.condicao` pinado), `aprovacoes/_lib/cartoes.ts`, `_lista.ts:114`, `documento/*` | obrigatório antes do deploy |
| G | Configurador vê nº e status de contratos alheios em "Em uso" (conflita com §1.7 "não vê contrato alheio"): mostrar só a contagem a quem não é José/admin | fazer (acesso) |
| G | Erro de desativar/reativar aparece atrás do modal | fazer |
| G | Banner do modal de editar: avisar que rascunhos usam a versão nova no envio | fazer se couber |
| G | G e F sobem juntas (link "Modelo de contrato" daria 404) | entrega única já garante |
| E-rev | Editor do José trava quando a versão pinada ≠ atual (`condicao.ts:135,189`; `_cartao.tsx:109,293`): acontece se as Configurações mudarem entre o envio e a aprovação. Nada grava errado | fazer (uso) |
| E-rev | Comentário desatualizado `_actions.ts:354`; limite de 10 parcelas em 3 lugares | fazer se couber |
| E-rev | Alteração do José sem concorrência otimista (precisa mudar assinatura SQL da A); `avisarLiberados` pode duplicar e-mail em cenário remoto | DIVIDAS |
| F-rev | Detalhes de robustez da tela do modelo (laudo `revisao-frente-f.md`) | fazer se couber |
| F-rev | 1ª impressão: janela residual de ms entre a checagem da versão exibida e o pino no SQL | DIVIDAS |
