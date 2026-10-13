# Revisão independente — PR #7 (Frente D: etapa atual e linha do tempo na ficha)

Veredito: **APROVADA** (0 bloqueantes). CI `verificar` verde nas duas execuções.

## Conferido
- Etapa: a ficha usa `etapaDoContrato`/`desdeDaEtapa` sem reimplementar; os 8 estados mapeiam certo (pill, caixa, barra, "agora").
- Botão por papel (`acaoDaEtapa`): "Abrir aprovação" só com `contratacao` na etapa eduardo e só com `financeiro` em jose/homologacao; "Ajustar e reenviar"/"Enviar para aprovação" só para `ehDono` (criado_por = e-mail) em devolvido/rascunho. Admin não recebe botão. `/editar` reconfere dono e rascunho no servidor.
- Nenhum dado novo de contrato exposto: tudo vem de `carregarFicha` (RLS inalterada).
- CA-C3: "agora" existe em rascunho/eduardo/jose/homologacao/devolvido, não em aprovado/encerrado/cancelado; fica sempre por último (ordenação no componente); testes cobrem.
- Textos de `infoDaEtapa` e do "agora" batem com `etapaInfo` do mockup; banner de reenvio e box Aditivos presentes (só com status aprovado); `condicoes_alteradas` laranja.

## Melhorias curtas (não bloqueiam)
1. Barra no estado `devolvido`: o mockup marca "!" no passo de quem devolveu (Eduardo ou José, rótulo "· devolveu") e deixa "Criado" como feito; o PR marca "!" no passo 1 ("Devolvido · ajuste do solicitante"). Não declarado como desvio. O dado "quem devolveu" é só o nome (`devolvidoPor`), sem papel, então a fidelidade exige a Frente B/E; registrar em DIVIDAS.
2. `devolvidoEm` ainda não é preenchido por `_ficha/dados.ts` neste branch: caixa "Devolvido" sai sem "em dd/mm" até a Frente B (coberto pelo cast declarado). Conferir no merge.
3. `desdeDaEtapa` não recebe `canceladoEm`: cancelado fica sem "Desde". Cosmético.
4. Banner de reenvio usa tom "aviso"; mockup usa "info". Cosmético.
5. Fallback `condicaoCodigo === "SPOT_MENSAL_CONSOLIDADO"` precisa sair quando a B entregar `condicaoVersao`; a comparação `modo === "consolidado"` só compila se o tipo `ModoCondicao` tiver esse valor (o CI passou, então tem). Remover o cast no merge.
6. Item "agora" usa a hora do servidor como `quando`; irrelevante para exibição (mostra "agora").

## Desvios declarados — aceitos
Cast temporário; homologação no 4º passo (rótulo "Homologação · José", coerente com `etapa.ts`); pulso do "agora" não feito (CSS de outro dono).
