# Levantamento — criar OS no Field Control via API (POST /orders)

Feito em 28/09/2026, só com leitura (GET) na API real do Field Control, para responder
a viabilidade do pedido do cliente registrado em
`docs/cliente/2026-09-28-pedido-cadastro-no-hub-abre-os-no-field.md`. Base de código
consultada: `app/obras/_lib/field/` (cliente HTTP existente, rate limit de 1 req/s).
Doc oficial consultada ao vivo: https://developers.fieldcontrol.com.br/ (HTML baixado e
convertido para texto em 28/09/2026, seções "Ordem de Serviço (OS)" e "Atividades").

**Nenhum POST/PUT/PATCH/DELETE foi feito.** Todas as chamadas abaixo são GET, executadas
por um script Node que carregou `FIELD_API_KEY` de `.env.local` em memória (nunca
impressa, nunca gravada em arquivo) e espaçou as chamadas em 1100ms — acima do limite de
1 req/s documentado. Total: ~27 chamadas GET em ~30s, nenhum 429.

---

## 0. Achado mais importante: "Atividade Spot" não é exclusivo da DPSP

O `service_id` de "Atividade Spot" (`NTA1MjA2Ojk1NzMx`) é usado por **dois clientes
diferentes** dentro da mesma conta Field:

- `customer.id = "NjQ4MTI1OTo5NTczMQ=="` → nome **"DPSP"** (confirmado via
  `GET /customers/:id`). É o cliente do Controle de Obras — todas as OS com
  `location.name` no padrão "DP <bairro> <número>" e a TESTE D5 pertencem a ele.
- `customer.id = "NjQ4MTI3NTo5NTczMQ=="` → nome **"D1000"**. Aparece nas OS com
  identifier "VISA", "VISA TMO-108/141" e nos identifiers só-numéricos (`3226990`,
  `3212081`, `3199171`, `3199998`), 6 das 15 OS mais recentes do tipo.

**Consequência prática para o formulário do hub:** filtrar só por `service_id` ao criar
ou listar não basta — **é preciso sempre enviar `customer.id` da DPSP explicitamente**
no `POST /orders`, hardcoded na integração, e não deduzir o cliente pelo tipo de OS. Isso
não muda o comportamento da sincronização hoje (que só lê e não filtra por cliente porque
lê tudo do tipo), mas é um risco real na hora de **criar**: uma falha aqui criaria uma OS
de DPSP dentro do cliente errado, ou vice-versa.

---

## 1. Amostra: as 15 OS mais recentes de "Atividade Spot" (28/09/2026, ~19h)

`totalCount` do tipo "Atividade Spot": **268**. As 15 mais recentes, por `-created_at`
(confirmado que esse valor de `sort` funciona na API real — `cliente.ts` usava `'id'`
por padrão e marcava isso como "não verificado"; `-created_at` agora está confirmado):

| # | identifier | cliente | descrição (truncada) | createdAt |
|---|---|---|---|---|
| 1 | `0626-005488` | DPSP | Bom dia, durante a operação da porta automática... | 28/09 19:36 |
| 2 | `0626-011696` | DPSP | Solicito apoio na dedetização na retaguarda... | 28/09 18:46 |
| 3 | `0526-008209` | DPSP | JATEAMENTO | 28/09 18:18 |
| 4 | `0926-017419` | DPSP | a tomada que temos na gerencia é 220V... | 27/09 01:26 |
| 5 | `0926-017427` | DPSP | Solicito instalação de tomada 110v/127v... | 27/09 01:17 |
| 6 | `3226990` | D1000 | Solicito apoio com urgência para retirada... | 24/09 21:14 |
| 7 | **`TESTE D5`** | DPSP | Teste do sistema Controle de Obras (D5) - NAO EXECUTAR | 24/09 18:17 |
| 8 | `0926-017407` | DPSP | Solicito instalação de novo ponto de tomada... | 24/09 16:48 |
| 9 | `VISA TMO-108` | D1000 | VISA | 24/09 10:55 |
| 10 | `VISA TMO-141` | D1000 | VISA | 24/09 10:54 |
| 11 | `VISA` | D1000 | VISA | 24/09 10:53 |
| 12 | `DP NOVA FRIBURGO 3` | DPSP | INSTALAÇÃO DE TRANFORMADOR NA GELADEIRA... | 24/09 00:19 |
| 13 | `1125-014523` | DPSP | Solicito reparo nesta tampa que fica na fachada | 23/09 19:29 |
| 14 | `3212081` | D1000 | ABASTECIMENTO DE CAIXA D'ÁGUA | 23/09 19:22 |
| 15 | `3199171` | D1000 | COMPRA DE CONTROLES | 23/09 19:21 |

Além dessas 15, detalhe completo (`GET /orders/:id` + `GET /orders/:id/tasks` +
`GET /customers/:id/locations/:id`) foi puxado para as 5 primeiras da lista (#1 a #5) e
para a TESTE D5 (#7) — 6 OS com o pacote completo.

---

## 2. Tabela de campos da OS (objeto de `/orders`, amostra das 15)

| Campo | Preenchido em | Exemplo real | Obrigatório no POST (doc) |
|---|---|---|---|
| `id` | 15/15 | `"NWEwZWZhNGYtMzdj...Ok5NzMx"` | somente leitura (gerado) |
| `identifier` | 15/15 (sempre vem, gerado ou digitado) | `"0626-005488"` / `"TESTE D5"` | Não — auto-gerado se omitido; obrigatório só se a conta usar "identificador manual" (não é o caso da DPSP, ver §5) |
| `description` | 15/15 | `"JATEAMENTO"` | Não |
| `archived` | 15/15 (sempre `false` na amostra) | `false` | somente leitura |
| `external.id` | 0/15 (sempre `null`) | `null` | Não |
| `customer.id` | 15/15 | `"NjQ4MTI1OTo5NTczMQ=="` | **Sim** |
| `service.id` | 15/15 | `"NTA1MjA2Ojk1NzMx"` | **Sim** |
| `ticket` | 0/15 (sempre `null`) | `null` | Não |
| `address.zipCode` | 15/15 | `"22793-081"` (com hífen — a doc diz "apenas números", a API real aceita e devolve com hífen) | **Sim** |
| `address.street` | 15/15 | `"AV DAS AMERICAS"` | **Sim** |
| `address.number` | 15/15 | `"7360"` / `"S/N"` | **Sim** |
| `address.neighborhood` | 15/15 | `"BARRA DA TIJUCA"` | Não |
| `address.complement` | 2/15 | `"Loja 101"` | Não |
| `address.city` | 15/15 | `"RIO DE JANEIRO"` | **Sim** |
| `address.state` | 15/15 | `"RJ"` (sigla, 2 letras — na amostra real, nunca nome por extenso, exceto na própria TESTE D5, ver §6 anomalia) | **Sim** |
| `address.coords.latitude/longitude` | 15/15 | `-22.9997401 / -43.4050746` | **Sim** |
| `location.id` | 15/15 | `"Nzg2NTI5NjQt...Ok5NzMx"` | Não |
| `deadlineAt` | 6/15 | `"2026-09-30"` | Não |
| `deadlineContract` / `serviceAgreement` | 0/15 | `null` | Não (mutuamente exclusivos, só na criação) |
| `metadata` | 14/15 (ausente só na TESTE D5, criada manualmente pelo painel) | `{}` | Não |
| `createdBy.id` / `.name` | 14/15 (ausente/`null` só na TESTE D5) | `{"id": "...", "name": "Yuri"}` (nome anonimizado) | somente leitura |
| `createdAt` / `updatedAt` | 15/15 | ISO 8601 | somente leitura |
| `customFields` | 15/15 presente, sempre `[]` na amostra | `[]` | somente leitura |
| `tasks` (array) | — (não vem na listagem, só no POST) | — | **Sim, obrigatório, ≥1 atividade** |

---

## 3. Tabela de campos da atividade/task (amostra de 6: OS #1–#5 + TESTE D5)

| Campo | Preenchido em | Exemplo real | Obrigatório no POST (doc) |
|---|---|---|---|
| `id` | 6/6 | — | somente leitura |
| `position` | 6/6 (valores `1` em 5 delas, `100` na TESTE D5) | `1` | Marcado com `*` na tabela de parâmetros, **mas** o próprio exemplo oficial de "atividade pendente sem agendamento" da doc **omite `position`** — contradição da doc, ver §7 |
| `status` | 6/6 | `"done"`, `"scheduled"`, `"pending"` | **Sim** |
| `employee.id` | **0/6** (sempre `{}` vazio — nenhuma das 6 tem técnico) | `{}` | Não — confirma que dá para criar atividade sem técnico |
| `duration` | 6/6 (sempre `60`, igual à duração cadastrada do tipo "Atividade Spot") | `60` | Não — se omitido, herda a duração do tipo de OS |
| `scheduling.type` | 6/6 | `"scheduled-date"` (3×) / `"non-scheduled"` (3×, incl. TESTE D5) | Opcional na criação |
| `scheduling.date` | 3/6 (as 3 com `scheduled-date`) | `"2026-09-28"` | Só junto com `scheduling.type` |
| `coords.latitude/longitude` | 6/6 | igual ao `address.coords` da OS | Marcado com `*`, mas também aparece em TODOS os exemplos, inclusive o mínimo |
| `statusDescription` | 0/6 | `null` | Não |
| `statusClassification` | 2/6 (as 2 com status `pending` vindas de orçamento) | `{"name": "Orçamento Aguardando Aprovação", ...}` | somente leitura |
| `taskType` | 0/6 | (campo nem aparece) | Não — DPSP não usa tipo de atividade hoje |
| `startedAt` / `completedAt` | 2/6 (só as `done`) | ISO 8601 | somente leitura |

---

## 4. Como a TESTE D5 foi preenchida (referência para o teste novo)

```
identifier: "TESTE D5"
description: "Teste do sistema Controle de Obras (D5) - NAO EXECUTAR"
customer.id: DPSP ("NjQ4MTI1OTo5NTczMQ==")
service.id: Atividade Spot ("NTA1MjA2Ojk1NzMx")
location.id: "DPSP Matriz" ("MTRiZjk5YjctMzg3Ni00ZDJiLTg5NmQtOTM2NDg2ZmQ5MjU4Ojk1NzMx")
address: Avenida Manuel Bandeira, 291, Vila Leopoldina, CEP 05317020
  ⚠️ anomalia: address.city e address.state vieram com encoding quebrado
  ("S�o Paulo" em vez de "São Paulo", e state por extenso em vez da sigla "SP") —
  é um dado da própria OS de teste no Field, não do nosso script (a chamada de
  location da mesma OS devolveu "São Paulo" corretamente). Provavelmente foi digitado
  errado/com encoding errado direto no painel ao criar a TESTE D5 manualmente.
createdBy: null (única das 15 sem usuário criador — reforça que "criado pela API/fora
  do fluxo normal do painel" aparece como null, conforme a própria doc do campo diz)
metadata: campo ausente (as outras 14 têm "metadata": {})
tasks: 1 atividade, sem técnico, status "pending", scheduling "non-scheduled"
  (sem data), position 100 (não 1 — não achamos explicação na doc para esse valor)
```

---

## 5. Respostas às perguntas do pedido

**Quem gera o `identifier`? Segue padrão MMAA-sequencial?**
Não é um padrão fixo — é o formato que a conta gera **quando o campo é omitido**
(`"0626-005488"`, `"0926-017419"` = MMAA-NNNNNN). Mas a conta da DPSP **não exige
identificador manual**: das 15 OS recentes, 6 têm identifier livre digitado por alguém
(`"TESTE D5"`, `"VISA"`, `"VISA TMO-108"`, `"DP NOVA FRIBURGO 3"`, `"Garantia ..."`,
números crus como `"3226990"`). Confirmado pelo texto literal da doc: **"Quando
informado, o valor enviado é sempre utilizado. Quando não informado, o valor é gerado
automaticamente conforme a configuração da conta; caso a conta utilize identificador
manual, o campo é obrigatório."** Ou seja: **o POST aceita enviar `identifier` livremente,
e também aceita omitir** (a conta da DPSP gera o MMAA-sequencial sozinha nesse caso).

**Que customer/location a DPSP usa?**
`customer.id = "NjQ4MTI1OTo5NTczMQ=="` (nome "DPSP", confirmado por `GET /customers/:id`).
Loja é sempre resolvida por `location.id` — os nomes seguem "DP <bairro> <número>" (ex.:
"DP BARRA DA TIJUCA 9", "DP TAQUARA 6") ou nomes de unidade especial ("DPSP Matriz", a
mesma da TESTE D5). Confirma a decisão de 16/09/2026 já registrada em `loja.ts`.

**A atividade exige técnico, data, duração?**
Nenhum dos três é obrigatório pela doc, e a prática confirma: **0 das 6 atividades
detalhadas têm técnico** (`employee` sempre `{}`), 3 das 6 não têm data (`non-scheduled`),
e `duration` nunca precisa ser enviado (usa o padrão do tipo de OS, 60 min para
"Atividade Spot"). O único campo de fato sempre presente e coerente com a doc é `status`.

**Como a TESTE D5 foi preenchida?** Ver §4 acima.

---

## 6. Payload mínimo proposto — POST /orders (NÃO EXECUTADO)

Usa a mesma loja da TESTE D5 ("DPSP Matriz"), sem técnico, com data futura (pedido
explícito do João, diferente da própria TESTE D5 que ficou pendente sem data):

```json
{
  "identifier": "TESTE HUB API 2809",
  "description": "TESTE HUB API 28/09 — não executar",
  "customer": { "id": "NjQ4MTI1OTo5NTczMQ==" },
  "service": { "id": "NTA1MjA2Ojk1NzMx" },
  "location": { "id": "MTRiZjk5YjctMzg3Ni00ZDJiLTg5NmQtOTM2NDg2ZmQ5MjU4Ojk1NzMx" },
  "address": {
    "zipCode": "05317020",
    "street": "Avenida Manuel Bandeira",
    "number": "291",
    "neighborhood": "Vila Leopoldina",
    "city": "São Paulo",
    "state": "SP",
    "coords": { "latitude": -23.541423, "longitude": -46.733682 }
  },
  "tasks": [
    {
      "position": 1,
      "status": "scheduled",
      "scheduling": { "type": "scheduled-date", "date": "2026-10-15" },
      "coords": { "latitude": -23.541423, "longitude": -46.733682 }
    }
  ]
}
```

**Por que cada campo está aí (e por que os outros ficaram de fora):**

- `identifier` **enviado de propósito** (não omitido): um teste que cai no contador
  automático de sequência real da DPSP é mais difícil de achar e apagar depois. A TESTE
  D5 fez a mesma escolha. **Em produção, o formulário do hub deve deixar `identifier` de
  fora** e deixar o Field gerar o MMAA-sequencial normal — replicar esse comportamento
  manual só faz sentido para um teste descartável.
- `customer.id` fixo na DPSP, nunca vindo de input do usuário — é a defesa contra o
  achado do §0 (duas contas compartilham o tipo de OS).
- `address` completo copiado da própria localização da TESTE D5, mas com `city`/`state`
  corrigidos (a doc marca os 6 subcampos com `*`; nenhum exemplo da doc cria uma OS só
  com `location.id` e sem `address` — os dois sempre aparecem juntos nos exemplos
  oficiais, mesmo quando `location` já identifica a loja).
- `tasks[0].position: 1` incluído por segurança, apesar da ambiguidade do §3 (doc marca
  como obrigatório, mas o próprio exemplo oficial de atividade pendente o omite).
- Sem `employee` (nenhum técnico) — confirmado como opcional pela doc e pela prática
  (0/6 na amostra tinham técnico).
- Sem `duration` — herda os 60 min do tipo "Atividade Spot", como todas as 6 da amostra.
- `status: "scheduled"` com `scheduling.date` futura, em vez de `"pending"` como a TESTE
  D5 — porque o pedido explícito foi "data futura", e não "sem agendamento".

---

## 7. Campos que o formulário do hub precisaria ter

Para o fluxo real (cadastro no hub → cria OS no Field), não para o teste isolado:

1. **Descrição** (texto livre) → `description`
2. **Loja** (select, vindo do cadastro de localizações da DPSP já sincronizado por
   `loja.ts`) → resolve `location.id` **e** o `address` completo automaticamente
   (`GET /customers/:id/locations/:id` já devolve endereço estruturado — não precisa
   pedir endereço digitado ao usuário)
3. **Data de agendamento** (opcional) → `tasks[0].scheduling.date`; se vazio, enviar
   `status: "pending"` e omitir `scheduling` (fila de pendentes do Field)
4. **Técnico** (opcional, pode ficar em branco) → `tasks[0].employee.id` ou
   `employee.name`
5. Campos fixos, não expostos no formulário: `customer.id` (DPSP, hardcoded),
   `service.id` (Atividade Spot, resolvido 1x e cacheado como já faz `cliente.ts`),
   `tasks[0].position` (sempre `1`, só há uma atividade por OS nesse fluxo),
   `identifier` (deixado de fora, autogerado pelo Field)

---

## 8. Perguntas que só um POST real responde

1. `tasks[0].position` omitido é aceito de fato (como o exemplo oficial de "atividade
   pendente" sugere), ou o servidor real vai recusar com 422 apesar do exemplo da doc?
   A tabela de parâmetros marca `position*` como obrigatório — contradição a resolver
   só testando.
2. `status: "scheduled"` sem `employee` é aceito, ou o Field recusa/ignora um agendamento
   sem técnico responsável? Nenhum exemplo da doc cobre essa combinação exata.
3. `address.zipCode` — a doc pede "apenas números" mas todos os exemplos reais trazem
   hífen (`22793-081`); enviar sem hífen (`22793081`) seria aceito igualmente, ou algum
   validador de CEP recusaria por não bater com o cadastro da loja?
4. Enviar `identifier` livre (tipo `"TESTE HUB API 2809"`) tem alguma checagem de
   duplicidade contra os ~268 identifiers já existentes do tipo, ou contra a conta
   inteira?
5. O `position: 100` da TESTE D5 é resquício de alguma regra do painel manual (ex.:
   posição default quando criado fora de um fluxo de ticket) — isso muda alguma coisa
   se o hub sempre mandar `position: 1`?
6. A OS criada por essa via aparece no painel do Field com `createdBy: null` (como a
   TESTE D5), ou o Field atribui um usuário "de sistema/API" quando a chave é usada?
   Isso importa para auditoria de quem criou o quê.

---

## Anexos gerados nesta pesquisa (fora do controle de versão, no scratchpad da sessão)

- Dump completo das 15 OS + 6 detalhes + tasks + locations em JSON (para conferência,
  se precisar reabrir números exatos sem nova consulta à API).
- Texto integral da documentação oficial convertido de HTML para texto plano (seções
  "Ordem de Serviço (OS)", "Atividades", "Erros", "Rate Limits").

Nenhum dos dois foi commitado — só este relatório em markdown, conforme pedido.

---

## 9. Resultado do POST real — 28/09/2026, 21:31 BRT (executado pela sessão principal)

Autorização do João: `docs/cliente/2026-09-28-pedido-cadastro-no-hub-abre-os-no-field.md`.
Script: GET de guarda por `identifier` antes (0 resultados) → um único `POST /orders`, sem retry.

| Tentativa | Resultado |
|---|---|
| 1 | **422** `resourceValidationErr` — `@.address.zipCode` "must be not null and must have 8 digits". Enviado `"05317-020"`. **Nada criado** (GET de guarda seguinte voltou 0). |
| 2 | **201 Created** com `zipCode: "05317020"`. |

OS criada: `identifier` **"TESTE HUB API 2809"**, id `NjZkNGVkN2MtZTcwNi00MzUzLThmNTAtZjM3MDVmNDVlNjg4Ojk1NzMx`,
loja DPSP Matriz (mesma location da TESTE D5), 1 atividade `pending` / `non-scheduled`, sem técnico,
`createdAt 2026-09-29T00:31:14Z`.

Respostas às dúvidas da §8:
- **A chave TEM permissão de escrita.**
- `address.zipCode`: **só 8 dígitos, sem hífen** (a doc estava certa; os exemplos com hífen não).
- `position: 1` aceito; `status: "pending"` + `scheduling.type: "non-scheduled"` sem técnico aceito.
- `createdBy` volta `null` (igual à TESTE D5), `external.id` existe e veio `null` — candidato a guardar o id da obra do hub.
- Duração herdada do tipo: 60 min.

Pendente: (a) conferir se a OS entrou no hub pela sincronização incremental; (b) cancelar no hub
com observação "OS de teste da API" e arquivar/cancelar no Field, como na D5.

## 10. Achado lateral — a sincronização não filtra o cliente

O tipo "Atividade Spot" é compartilhado por DPSP e **D1000** na mesma conta Field, e
`app/obras/_lib/field/cliente.ts` / `sincronizar/` filtram só por `service_id` (nenhum filtro de
`customer`). Obras do D1000 podem estar entrando no hub. **Não conferido no banco:** o PAT da
Supabase devolveu 401 em 28/09 (precisa ser regravado com `C:\Users\joao-\gravar-pat.ps1`).
