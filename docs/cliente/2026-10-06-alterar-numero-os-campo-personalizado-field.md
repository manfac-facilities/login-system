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
