# 06/10/2026 — Alterar número da OS via campo personalizado do Field

**Origem:** mensagem do cliente, repassada pelo João no chat em 06/10/2026. O João a apresentou
como "um funcionário reportou um bug no gestão de obras". Texto literal abaixo.

---

Vamos atualizar pra conseguir alterar o numero da OS com o numero novo do Desk/Cervello

Segue exemplo de uma situação que falamos, começamos a obra sem OS e ai usamos no field um numero ficticio pq ele nao deixa abrir OS sem numero.. ai dps o cliente abriu a OS

No momento atual isso nao da pra alterar no field, nao lembro se da pra alterar manualmente no controle de obras (acho que nao).

Mas oq eu vou fazer é criar um campo personalizado no field com o numero da OS do cliente... pq ai nesses casos se preencher esse campo atualizado com o numero correto da OS, o controle de obras puxa a atualização desse campo e muda o numero no controle de obras

Vamos seguir assim ?

## Resposta do João ao cliente (06/10/2026)

O João perguntou ao cliente se um usuário com perfil de gestor conseguia editar o número da OS no
Field, porque a sincronização já reconcilia pelo id interno do Field e atualiza `os` quando o
`identifier` muda (`app/obras/sincronizar/_sincronizacao.ts:359`).

## Retorno do cliente (06/10/2026), repassado pelo João, literal

> o field bloqueia o numero da OS qnd cria, nao da pra alterar

## Cliente criou o campo e a OS de teste (06/10/2026), repassado pelo João, literal

> 123-TESTE
> Nome da OS que eu criei o campo personalizado
> ve ai se o claude acha ela
> antes da gente mudar o numero da OS no campo personalizado
> o nome do campo é os cliente - preencher se foi aberto sem os
> me avisa ai qnd for pra incluir o numero da OS nesse campo, pra ele identificar se alterou

## Pergunta do cliente (07/10/2026), repassada pelo João, literal

> Testou o campo personalizado?

**Conferido na API do Field em 07/10:** a OS `123-TESTE` existe e o campo
"OS Cliente - preencher se foi aberto sem OS" vem em `customFields` com `type: question` e
`value: ""` — ainda vazio. O hub ainda não lê `customFields` (nenhuma referência em
`app/obras/sincronizar/`).

## Cliente preencheu o campo (07/10/2026), repassado pelo João, literal

> Testa ai e ve se muda pra esse numero novo

**Conferido na API do Field em 07/10:** a OS `123-TESTE` passou a ter `updatedAt: 2026-10-07T12:59:55Z`
e o campo veio com `value: "0926-017378"`, texto puro e sem espaços. A OS no hub **não muda**,
porque a sincronização ainda não lê `customFields`. A leitura chega ponta a ponta: o que falta é o código.

## Resposta do João ao cliente (07/10/2026), literal

> até mais tarde/madruga te mando tudo pronto e o que tem que fazer

Prazo assumido: entregar a troca do número no ar até a madrugada de 07→08/10, com instrução de uso.
