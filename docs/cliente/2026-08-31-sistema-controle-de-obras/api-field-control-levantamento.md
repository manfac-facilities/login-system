# API de Integração do Field Control — levantamento para o Controle de Obras

Fonte primária: https://developers.fieldcontrol.com.br/ (documentação única, uma
página longa). Baixada literalmente em 2026-09-08 e convertida para texto para
citação exata (arquivo local: `devdocs-text2.txt`, extraído de `devdocs-root.html`,
ambos na mesma pasta deste relatório). Complementado com o README do cliente
Node.js oficial: https://github.com/FieldControl/carchost-node (mesma organização,
`FieldControl`), que expõe os mesmos endpoints via wrapper JS e serviu para
confirmar nomes de campos com exemplos de request/response.

Todos os exemplos de URL usam o host real documentado:
`https://carchost.fieldcontrol.com.br`.

---

## 1. Autenticação

- **Header estático**: `X-Api-Key`. Citação literal da doc: "A chave da API deve
  ser fornecida como um cabeçalho HTTP chamado X-Api-Key." Exemplo dado:
  `curl -H "X-Api-Key: SUA_KEY" https://carchost.fieldcontrol.com.br/`.
- É **chave estática (API key)**, não OAuth. Não há menção a token com expiração,
  refresh token, nem fluxo de autorização — é chave única gerada manualmente.
- **Como se obtém**: só usuários com perfil de administrador, pelo painel em
  `https://app.fieldcontrol.com.br/#/configuracoes/configuracao-para-desenvolvedores`,
  seção "Chave de integração".
- **Sandbox**: procurei por "sandbox", "homologação", "ambiente de teste", "staging"
  na documentação inteira — **nenhuma ocorrência**. Não há ambiente de testes
  documentado separado do de produção; a doc só descreve um host
  (`carchost.fieldcontrol.com.br`).
- Headers adicionais que a doc pede em toda requisição (seção "Rate Limits" /
  "Headers obrigatórios"): `Host`, `Content-Type` (para métodos com corpo) e
  `User-Agent` — a ausência de `User-Agent` "pode disparar regras que bloqueiam
  bots ou tráfego não autenticado".

## 2. Como listar ordens de serviço

- **Endpoint**: `GET https://carchost.fieldcontrol.com.br/orders/`
- **Filtros disponíveis** (tabela literal da doc, seção "Listar ordens de
  serviço"):

  | Parâmetro | Operadores | Descrição |
  |---|---|---|
  | `identifier` | Nenhum | Identificador da ordem de serviço |
  | `customer_id` | Nenhum | Identificador do cliente da ordem de serviço |
  | `external_id` | Nenhum | Identificador externo |
  | `ticket_id` | Nenhum | Identificador da solicitação de serviço |
  | `service_id` | Nenhum | **Identificador do tipo de OS da ordem de serviço** |
  | `created_at` | `>=`, `<=`, `>`, `<` | Data de criação da ordem de serviço |
  | `updated_at` | `>=`, `<=`, `>`, `<` | Data da última atualização da ordem de serviço |

  Sintaxe: `?q=chave:"valor"`, múltiplos filtros separados por espaço dentro do
  mesmo `q`. Exemplo literal da doc para tipo de OS:
  `GET 'https://carchost.fieldcontrol.com.br/orders?q=service_id:"MTox"'`

- **SIM, dá para filtrar por tipo de OS na query** — mas o filtro é por
  `service_id` (o **id** do tipo de OS), não pelo nome. O filtro é feito no
  servidor (query string), não é preciso trazer tudo e filtrar do nosso lado.

- **Como o tipo de OS é representado**: é um **recurso próprio**, chamado na
  documentação de "Tipos de OS" mas exposto no endpoint `/services` (nome
  histórico/confuso — no client Node.js oficial esse mesmo recurso aparece como
  `client.services`, e é diferente do recurso "Serviços" de itens de fatura, que
  vive em `/work-services`; são dois recursos distintos com nomes parecidos,
  cuidado ao implementar). Campos do tipo de OS: `id`, `name`, `duration`
  (inteiro, duração estimada), `archived`, `createdAt`.

  Para descobrir o `id` de "Atividade Spot" é preciso uma chamada prévia:
  `GET 'https://carchost.fieldcontrol.com.br/services?q=name:"Atividade Spot"'`
  (filtro por `name` é documentado para esse recurso; a doc não diz explicitamente
  se a comparação é exata ou parcial — ver seção 6, "não deu para descobrir").
  Depois, usar o `id` retornado como `service_id` no filtro de `/orders`.

  Ou seja: **duas chamadas** — uma para resolver nome→id do tipo de OS, outra
  para listar as ordens já filtradas por esse id. Não há um único parâmetro que
  aceite o nome do tipo diretamente em `/orders`.

## 3. Os três campos que interessam

Do schema oficial da OS (seção "Ordem de Serviço (OS)", tabela "Parâmetros")
e do exemplo de resposta de `GET /orders`:

- **Número da OS** → campo `identifier` (`string`). Citação: "Identificador da
  ordem de serviço, deve ser único entre todas as ordens de serviço." Vem direto
  no objeto da OS, sem chamada adicional.

- **Descrição do chamado** → campo `description` (`string`, máx. 2000
  caracteres). Citação: "Descrição da ordem de serviço, por exemplo, detalhes da
  OS inseridos pelo gestor e que o técnico deve levar em consideração ao atender
  a OS." Também vem direto no objeto da OS. Pode ser `null`.

- **Localização da loja** → aqui há uma ambiguidade real, dois caminhos possíveis
  e a doc não deixa claro qual o cliente quer:

  1. **`address` embutido na própria OS** — objeto estruturado sempre presente
     na resposta de `/orders` e `/orders/:id`: `address.zipCode`, `address.city`,
     `address.state`, `address.neighborhood`, `address.street`, `address.number`,
     `address.complement`, `address.coords.latitude/longitude`. É texto/estruturado,
     **não** exige chamada extra — vem junto na listagem.

  2. **`location.id`** — referência opcional a um recurso separado
     ("Localização" do cliente, endpoint `/customers/:id/locations/:locationId`).
     Esse recurso tem campo **`name`** (ex.: `"Sede São Paulo"` no exemplo da doc)
     — é esse `name` que provavelmente corresponde ao "nome da loja" que o
     cliente quer, e não está no `address` da OS. Só vem como `{"id": "..."}` na
     listagem de `/orders`; para pegar o nome é **preciso uma chamada adicional**
     por OS: `GET /customers/:id/locations/:locationId`.

  **Recomendação**: perguntar ao cliente se "localização da loja" é o endereço
  físico (caminho 1, sem custo extra de chamadas) ou o nome/identificação da loja
  cadastrada como "Localização" no Field Control (caminho 2, custa uma chamada
  por OS — relevante dado o rate limit de 1 req/s, ver seção 4). Como cada loja
  do cliente provavelmente é cadastrada como uma "Localização" separada dentro do
  customer, é bem provável que o caminho 2 (`location.name`) seja o que ele quer
  dizer com "loja", mas a doc por si só não resolve isso — é uma decisão de
  negócio, não um fato técnico.

## 4. Paginação e volume

- Parâmetros `limit` e `offset` na query, combináveis com `&`.
- `limit`: padrão 10, mínimo 1, **máximo 100** por página.
- `offset`: padrão 0, mínimo 0, **máximo 200000**.
- `totalCount` vem no corpo da resposta (nível raiz, ao lado de `items`) com o
  total de registros da lista.
- Valores inválidos de `limit`/`offset` (não numéricos, negativos, fora da faixa)
  retornam `422` com objeto de erro descrevendo o parâmetro.
- **Rate limit documentado: 1 requisição por segundo** ("A API permite que a
  aplicação cliente possa fazer uma requisição por segundo."). Ultrapassar
  resulta em `429`. Não há menção de `Retry-After` no header de resposta, nem de
  limite diário/mensal, nem de burst — a doc não fala nada além dessa frase.
- Existe também `sort` (`&sort=campo` ascendente, `&sort=-campo` descendente) —
  não pedido, mas relevante para paginação estável ao varrer tudo.

## 5. Atualização incremental (polling vs. webhook)

- **Filtro por `updated_at` existe e está documentado**, com operadores `>=`,
  `<=`, `>`, `<`, no mesmo endpoint `/orders`. Exemplo real de uso combinando
  filtros:
  `GET '/orders?q=customer_id:"MTox" created_at>=:2024-02-01'`
  (o padrão se estende a `updated_at` da mesma forma). Isso permite polling
  incremental: guardar o maior `updatedAt` já processado e buscar
  `updated_at>=:<timestamp>` na próxima varredura.

- **Webhooks existem e estão documentados** (seção "Webhooks"). Citação: "No
  Field Control você pode receber webhooks de diferentes tipos de eventos
  referentes a sua operação [...] para permitir que seu sistema seja atualizado
  em tempo real sobre os principais eventos que ocorrem no Field Control."
  - Eventos relevantes para OS: **`order-created`** e **`order-updated`**
    (lista completa de ~26 eventos documentada, incluindo eventos de atividade,
    formulário, anexo, comentário, ticket, orçamento, veículo — não há
    `order-deleted`/`order-archived` na lista).
  - Entrega: `POST` HTTP para a URL configurada no painel
    ("Webhooks integração"), com headers `X-FieldControl-Event` (nome do
    evento), `X-FieldControl-Delivery` (id único do envio, usado para
    deduplicação) e `Content-Type: application/json`.
  - O corpo do POST de cada evento é o próprio recurso afetado (para
    `order-created`/`order-updated`, é o objeto da OS, no mesmo formato do GET).
  - Há suporte a autenticação na URL do webhook ("Sem autenticação" / "Com
    autenticação" — a doc não detalha os métodos disponíveis nessa tela).
  - Existe painel de histórico de entregas (id da requisição, evento, data/hora),
    útil para auditoria/replay manual.

  **Decisão de arquitetura**: como `order-created`/`order-updated` existem, dá
  para desenhar por evento (webhook) em vez de varredura periódica — isso é mais
  responsivo e evita gastar o rate limit de 1 req/s em polling. A varredura por
  `updated_at` fica como fallback/reconciliação (garantir que nenhum webhook foi
  perdido), não como mecanismo principal.

## 6. Escrita

- A API **não é só leitura** — suporta CRUD completo em vários recursos.
- Para ordens de serviço especificamente: `POST /orders` (criar, exige pelo
  menos uma `task`/atividade), `GET /orders/:id`, `GET /orders` (listar), e a
  doc também documenta atualização (`PUT`) de outros recursos citados (tipo de
  OS, serviços de fatura, tickets etc.) seguindo o mesmo padrão REST. O create
  de OS aceita vincular `customer`/`service`/`location` tanto por `id` quanto
  por `name` (resolução por nome no servidor).
- Não vamos escrever agora, mas fica registrado: a API permitiria, no futuro,
  atualizar status ou campos da OS de volta no Field Control, se algum dia o
  fluxo precisar de mão dupla.

---

## O que não deu para descobrir

- **Se o filtro `name` em `/services` (tipos de OS) é exato ou parcial/case
  sensitive.** A doc só mostra o exemplo `q=name:"Instalação"` sem especificar
  a semântica de match. Isso importa para saber se `name:"Atividade Spot"`
  precisa do nome cadastrado byte a byte.
- **Se `identifier` (número da OS) aceita busca parcial.** A tabela de filtros
  de `/orders` diz "Nenhum" operador para `identifier`, o que sugere só match
  exato, mas a doc não confirma isso em texto explícito.
- **Rate limit em números redondos além de "1 req/s"**: não há burst
  documentado, não há `Retry-After`, não há limite diário. Não sei se 1 req/s é
  hard-cap por chave de API ou por conta/empresa (múltiplas chaves da mesma
  empresa dividem o limite ou não?) — a doc não diz.
- **Ambiente de sandbox/homologação**: não existe menção nenhuma. Não sei se
  isso significa que não existe mesmo, ou que a doc pública simplesmente não
  cobre isso e é preciso perguntar ao suporte do Field Control.
- **Se `location.id` é obrigatório ou nasce automaticamente quando a OS é criada
  sem ele.** A doc de `orders` mostra `location.id` como campo opcional na
  criação; não ficou claro se toda OS de fato tem uma localização associada
  (e portanto sempre dá para resolver "loja") ou se isso depende de como o
  cliente configurou a conta dele no Field Control.
- **Retenção do histórico de webhooks / política de retry em caso de falha na
  URL do consumidor** (quantas tentativas, backoff, por quanto tempo). A seção
  "Histórico de eventos" só descreve a tela de visualização, não a política de
  reentrega.
- **Autenticação da URL de webhook** ("Com autenticação") — a doc menciona a
  opção na tela do painel mas não detalha os métodos suportados (Basic Auth?
  header customizado? assinatura HMAC do payload?).
- **Formato de erro consolidado para 429** — a doc mostra o formato de erro 4xx
  genérico (`resourceValidationErr`), mas não confirma se o 429 usa a mesma
  estrutura de corpo.

## Perguntas que só um teste com a chave real responde

1. O texto de `q=name:"Atividade Spot"` retorna exatamente um tipo de OS, ou é
   preciso tratar acentuação/maiúsculas/correspondência parcial na prática?
2. Toda OS trazida pela conta do cliente já vem com `location.id` preenchido
   (ou seja, dá pra sempre resolver o "nome da loja"), ou existem OS sem
   localização vinculada (só com `address` solto)?
3. O rate limit de 1 req/s é por chave de API ou por conta — importa para saber
   se vale a pena gerar mais de uma chave para paralelizar a carga inicial de
   histórico.
4. Os webhooks `order-created`/`order-updated` disparam de fato em produção
   para a conta do cliente (feature pode estar sujeita a plano/configuração), e
   qual a confiabilidade/latência real de entrega.
5. Quantas "Localizações" (lojas) o cliente já tem cadastradas no Field Control
   hoje — se for pouco, a chamada extra por OS (`GET
   /customers/:id/locations/:locationId`) tem custo desprezível; se for muito,
   pode valer a pena cachear localizações localmente em vez de resolver a cada
   sincronização.
