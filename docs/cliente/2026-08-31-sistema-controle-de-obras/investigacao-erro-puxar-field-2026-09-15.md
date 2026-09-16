# Investigação — "Puxar do Field" respondeu "não deu pra falar com o servidor" (2026-09-15)

**Método:** `superpowers:systematic-debugging`, Fase 1 (causa raiz antes de qualquer
conserto). Só leitura: nenhum código foi alterado, nenhuma chamada à API do Field, ao
banco ou à produção foi feita. Esta investigação foi revisada e reordenada em duas
rodadas, incorporando evidências que o coordenador levantou depois da primeira leitura
(ver §6).

## O fato

João clicou em **"Puxar do Field"** em `https://hub.manfac.com.br/obras/sincronizar`
(produção, build de 15/09 01:43 GMT). A tela respondeu **"não deu pra falar com o
servidor, tentar novamente"** em **menos de 10 segundos**. Nenhuma obra entrou. É a
primeira vez que essa tela é usada de verdade em produção.

---

## 1. De onde vem a mensagem

A mensagem é **nossa**, gerada no cliente, em
`app/obras/sincronizar/_painel.tsx:23-34`:

```ts
async function puxar() {
  setRodando(true)
  setEstado(null)
  try {
    setEstado(await sincronizarComFieldAction())
    router.refresh()
  } catch {
    setEstado({ error: 'Não deu para falar com o servidor. Tente de novo.' })
  } finally {
    setRodando(false)
  }
}
```

**Ponto central da investigação:** esse texto só aparece quando a *chamada da Server
Action em si* rejeita (`catch`) — não quando a Server Action roda e devolve um erro de
regra de negócio. Um erro de regra de negócio (ex.: `FIELD_API_KEY` faltando, Field fora
do ar, erro de gravação) é sempre devolvido como um objeto `{ error: string }` resolvido
normalmente, e essa mensagem aparece na faixa vermelha do próprio painel
(`_painel.tsx:66-72`), com um prefixo característico e diferente: **"Não deu para puxar
as OS do Field Control. ..."** (`_execucao.ts:69-74`, função `mensagemDeFalha`).

A frase que o João relatou é quase idêntica, palavra por palavra, ao texto fixo do
`catch` — e nada parecida com o prefixo de erro de aplicação. Isso aponta com bastante
segurança para: **a chamada HTTP que invoca a Server Action falhou como requisição —
nunca chegou a rodar `executarSincronizacao`, ou rodou mas a resposta não pôde ser
interpretada como resposta de Server Action.**

Lendo o código-fonte do runtime do Next 16.2.11 que está instalado
(`node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js:108-123`),
existe exatamente um ponto onde isso acontece do lado do cliente:

```js
const isRscResponse = !!(contentType && contentType.startsWith(RSC_CONTENT_TYPE_HEADER))
if (!isRscResponse && !redirectLocation) {
  const message = res.status >= 400 && contentType === 'text/plain'
    ? await res.text()
    : 'An unexpected response was received from the server.'
  throw new Error(message)
}
```

Ou seja: **qualquer resposta HTTP que não seja `content-type: text/x-component` (o
formato RSC/Flight que uma Server Action sempre devolve) vira um `throw` genérico no
cliente**, que cai direto no `catch` de `_painel.tsx:29-31` e vira a mensagem que o João
viu — **não importa o motivo original**. Isso inclui: uma página HTML normal (ex.: tela
de login ou dashboard, se o servidor redirecionar), uma resposta 500 de erro de
framework, ou uma falha de rede pura (conexão recusada/resetada, em que nem chega a
existir um `res`).

**Conclusão do item 1:** a causa está em algum ponto **entre o clique do botão e o
`fetch` da Server Action devolver um Flight response válido** — antes mesmo de
`sincronizarComFieldAction` (`app/obras/sincronizar/_actions.ts:12-28`) terminar de
rodar, ou possivelmente antes dela começar.

---

## 2. Duração da operação na pior hipótese — **hipótese descartada**, conta mantida por completude

> **Descartada por evidência do coordenador:** o João relatou falha em **menos de 10
> segundos**. A conta abaixo mostra que a varredura completa — na hipótese mais provável
> (primeira sincronização real, banco com obras `field_id` nulo) — não tem como estourar
> um tempo de proxy: ela é rápida por natureza. Não vale mais esforço nessa direção; a
> falha não é de operação longa, porque a carga real (chamadas ao Field, gravações no
> banco) provavelmente nem chegou a começar. Mantida aqui só para não perder o raciocínio.

Chamadas à API do Field Control para uma varredura completa de ~185 OS:

1. **Resolução do tipo de OS** (`Atividade Spot`): 1 chamada a `GET /services`
   (`app/obras/_lib/field/cliente.ts:158-173`), com cache em memória do processo
   (`idDoTipoDeOs`), então só acontece uma vez por processo "quente".
2. **Listagem paginada de `/orders`**: página máxima de 100
   (`TAMANHO_MAXIMO_DA_PAGINA = 100`, `cliente.ts:25`). Para ~185 OS:
   `ceil(185 / 100) = 2` páginas → 2 chamadas (`cliente.ts:189-226`).
3. **Chamada por loja**: a estratégia padrão é `'endereco'`, custo **zero** — o endereço
   já vem embutido na listagem (`app/obras/_lib/field/loja.ts:61-63`). A estratégia cara
   (`'localizacao'`, uma chamada por loja nova) só entraria em jogo se alguém passasse
   `estrategiaDeLoja: 'localizacao'` ao criar o cliente — e `_execucao.ts:190` chama
   `criarClienteField({ chaveApi })` **sem** esse parâmetro, então cai no padrão. **0
   chamadas extra confirmadas por leitura de código.**
4. **Chamada por OS para resolver reabertura** (`consultarSituacaoDaOrdem`,
   `app/obras/_lib/field/consulta-ordem.ts`): só acontece quando uma obra já existe no
   banco com um `field_id` diferente do que veio agora
   (`app/obras/sincronizar/_sincronizacao.ts:127-165`,
   `encontrarConsultasDeReabertura`). Numa primeira sincronização real, toda obra
   existente tem `field_id` nulo — a linha 158 (`!idFieldAnterior`) descarta o caso antes
   de qualquer chamada. **0 chamadas nessa hipótese.**

**Total de chamadas Field, pior hipótese plausível (primeira carga real): 1 + 2 + 0 + 0
= 3 chamadas.**

O limitador (`app/obras/_lib/field/limitador.ts:46-77`) espaça o **início** de cada
chamada em pelo menos 1000 ms da anterior, medido do disparo, não da resposta. As três
chamadas são disparadas em sequência (cada uma depende do resultado da anterior via
`await`), então o tempo mínimo teórico é `(3 − 1) × 1000 ms = 2000 ms`, mais a latência
de rede de cada resposta. Com uma latência generosa e pessimista de 2 s por chamada
(pior que qualquer latência razoável Brasil↔Field): `3 × 2 s = 6 s` (a própria latência
já cobre o espaçamento de 1 s exigido). Somando leitura da tabela `obras_obra`
(`lerTodasAsObras`, `_execucao.ts:94-110`, 1 página de 1000 já cobre qualquer volume
atual) e até 2 lotes de `insert` de 100 em 100 (`TAMANHO_DO_LOTE = 100`,
`_execucao.ts:23,233-237`): **total estimado bem abaixo de 15 segundos**, mesmo pessimista.

**Único cenário que estoura esse número:** 429 (rate limit) repetido em todas as 3
chamadas, cada uma pagando o backoff máximo de `2 s → 4 s → 8 s` (3 tentativas, teto em
`http.ts:86-88,125-126,208`) — até `+14 s` por chamada, `+42 s` no total, chegando a
~48 s. Isso exigiria outro processo usando a mesma chave `FIELD_API_KEY` ao mesmo tempo
(`erros.ts:37-48`). Mesmo esse pior caso realista não bate com "menos de 10 segundos" —
reforça que a operação real (chamadas ao Field) muito provavelmente **nem chegou a
começar**.

---

## 3. Falha silenciosa de configuração — **descartada como explicação direta, por incompatibilidade de texto**

`FIELD_API_KEY` só é lida em `app/obras/sincronizar/_execucao.ts:185-186`:

```ts
const chaveApi = (process.env.FIELD_API_KEY ?? '').trim()
if (!chaveApi) throw new Error('FIELD_API_KEY não está configurada no servidor')
```

- **Se a variável não chegou ao processo** (ausente, ou vítima da armadilha do
  `NOME=valor` numa linha só descrita no `AGENTS.md`): o `throw` acontece **dentro** do
  `try` de `executarExecucaoPreparada` (`_execucao.ts:184-313`), é capturado no
  `catch (erro)` da própria função (linha 299), vira `mensagemDeFalha(erro)` (linha
  69-74) = **"Não deu para puxar as OS do Field Control. FIELD_API_KEY não está
  configurada no servidor"**, e volta como um `EstadoSincronizacao` **resolvido
  normalmente** (`{ error: mensagem, ... }`, linha 306-312). A Server Action HTTP
  responde 200 com um Flight response válido. O cliente exibe esse texto na faixa
  vermelha do painel (`_painel.tsx:66-72`) — **não** no texto fixo do `catch`.
- **Se a variável chegou com quebra de linha:** o `.trim()` na linha 185 remove
  `\n`/`\r` nas pontas — não quebra nada.
- **Se a variável chegou com aspas literais** (por exemplo colada como `"abc123"` com as
  aspas fazendo parte do valor): `.trim()` não remove aspas internas; a chave enviada no
  header `X-Api-Key` (`http.ts:172-176`) incluiria as aspas, o Field devolveria
  401/403, isso viraria `ErroDaApiField` (`erros.ts:17-27`), capturado do mesmo jeito e
  também exibido como erro de aplicação com prefixo "Não deu para puxar as OS do Field
  Control. Field Control respondeu 401/403 em ...".

**Em nenhum desses três casos o texto que o João viu ("não deu pra falar com o servidor,
tentar novamente") é o que apareceria.** Essa é uma diferença de redação verificável:
uma é a frase fixa do `catch` do cliente, a outra sempre carrega o prefixo "Não deu para
puxar as OS do Field Control." Por isso o item 3 fica descartado como explicação direta
— mas note-se o corolário: **se a chave estiver ausente/malformada, `_execucao.ts:184-313`
sempre grava uma linha em `obras_sync_execucao` com `status: 'falhou'`** (via
`finalizarExecucao`, linha 161-177) antes de devolver a resposta. Isso é um fato
verificável sem tocar em produção: **se essa investigação read-only pudesse consultar o
banco (não pode, por escopo), a ausência de qualquer linha nova em `obras_sync_execucao`
no horário do clique seria a prova definitiva de que a execução nunca chegou a
`executarSincronizacao` — ou seja, que a causa está a montante, no meio de campo entre
o clique e a Server Action, e não dentro dela.** Fica registrado para o coordenador
decidir se vale pedir essa consulta.

---

## 4. Falhas de rede e de plataforma

| Hipótese | O que aconteceria no código | Evidência no log que confirma/derruba |
|---|---|---|
| **Container sem saída para a API do Field** (egress bloqueado/firewall) | `fetch` dentro de `http.ts:128-130` falha ou trava. Se falhar rápido (ex.: `ECONNREFUSED`), é capturado pelo `try/catch` de `_execucao.ts:184-313` e vira erro de aplicação (prefixo "Não deu para puxar as OS do Field Control. fetch failed"), **não** o texto genérico — mesma lógica do item 3. Se travar sem erro (pacotes descartados em silêncio), pode nunca resolver, mas isso contradiz a evidência de falha em <10s. | Uma linha `erro` em `obras_sync_execucao` com texto começando por "Não deu para puxar as OS do Field Control." e mencionando falha de rede/fetch — ou, se travou, nenhuma linha (mesma assinatura do item 3). |
| **DNS não resolve `carchost.fieldcontrol.com.br` a partir do container** | Mesmo caminho do item acima: erro rápido, capturado, vira erro de aplicação. | Idem — procurar por `ENOTFOUND`/`getaddrinfo` dentro de uma mensagem de erro de aplicação, nunca isolado no stdout sem contexto (porque a classe de erro sempre passa por `mensagemDeFalha`). |
| **TLS falha ao negociar com a API do Field** | Mesmo caminho — capturado, vira erro de aplicação. | Idem, procurar `certificate`/`TLS`/`SSL` dentro do texto de erro de aplicação. |
| **Proxy do EasyPanel encerra conexão longa** | Só seria relevante se a operação demorasse muito — **descartado pela evidência de falha em <10 s** (item 2). Mesmo que acontecesse, o sintoma bateria (fetch do navegador rejeita sem resposta válida → mesmo `catch` genérico). | Um 502/504/524 no log de acesso do proxy para o POST em `/obras/sincronizar`, com timestamp muito **depois** do clique (segundos a dezenas de segundos) — não bate com "menos de 10 s". Se o log mostrar isso já nos primeiros 1-2 segundos, não é timeout de proxy, é outra coisa. |
| **Container reiniciando por memória (OOM)** | Se o processo morre no meio da requisição, a conexão TCP cai — o `fetch` do navegador (dentro do runtime do Next) rejeita sem `res` válido → mesmo `catch` genérico, sem nenhuma linha de log da aplicação (o processo já não existe mais para logar nada). | Uma entrada de **reinício do container** no EasyPanel (novo "started"/boot) bem no horário do clique, ou status "OOMKilled" no painel. Ausência de log é, paradoxalmente, a própria evidência aqui — não confundir com "log vazio = nada aconteceu". |

---

## 5. Requisição da Server Action — investigado a pedido do coordenador (prioridade alta)

As duas evidências novas do coordenador — falha em **menos de 10 segundos** e produção
**viva e rápida** (`/login` 200 em 0,87 s; `POST /api/obras/sincronizar` sem segredo,
401 em 0,5 s; `/obras/sincronizar` sem sessão, 307 em 0,5 s) — descartam a hipótese de
operação longa e confirmam que o servidor responde normalmente **para as rotas
testadas**. Mas nenhuma dessas três checagens passa pelo caminho de uma Server Action
real:

- `/login` é uma página comum.
- `POST /api/obras/sincronizar` é um **Route Handler** comum
  (`app/api/obras/sincronizar/route.ts`), autenticado por `OBRAS_CRON_SECRET`
  (`route.ts:17-31`) — **não é uma Server Action**, e o caminho `/api/obras/:path*`
  **não está no `matcher` do `middleware.ts`** (`middleware.ts:127-143` lista
  `/api/conversor-os/:path*` e `/api/sofia/:path*`, mas não `/api/obras`). Essa rota
  passa direto, sem tocar o `middleware.ts` nem o mecanismo de Server Actions do Next.
- `GET /obras/sincronizar` sem sessão passa pelo `middleware.ts`, mas só exercita o
  ramo `!user` de uma requisição GET — nunca invoca de fato uma Server Action nem o
  ramo de sessão válida.

**Ou seja: nenhuma das três checagens replica o que aconteceu com o João — um POST de
Server Action, autenticado, para `/obras/sincronizar`.** A pista mais promissora
continua sem ser testada diretamente, e por isso os dois itens abaixo passam a liderar
a lista de hipóteses.

### 5.1 — `middleware.ts` intercepta o POST da Server Action

`middleware.ts:127-143` inclui `/obras/:path*` no `matcher`. Uma Server Action invocada
a partir de `/obras/sincronizar` é, do ponto de vista HTTP, um **POST para a própria
URL da página** (confirmado lendo
`node_modules/next/dist/client/components/router-reducer/reducers/server-action-reducer.js:70`,
`fetch(state.canonicalUrl, { method: 'POST', ... })`). Esse POST **passa pelo
`middleware.ts` antes de chegar no handler de Server Action do Next** — é a mesma
função, o mesmo arquivo, para GET e para POST.

Dentro dela (`middleware.ts:36-116`):

```ts
const { data: { user } } = await supabase.auth.getUser()   // linha 38, sem try/catch
...
if (isProtected) {
  if (!user) {
    ...
    return NextResponse.redirect(new URL('/login', request.url))   // linha 75
  }
  ...
  if (isObrasPage) {
    const acessoObras = await hasSystemAccess(supabase, user.email ?? '', 'obras')  // linha 109
    if (!acessoObras) {
      return NextResponse.redirect(new URL('/dashboard', request.url))              // linha 111
    }
  }
}
```

Se, no instante exato do clique, `supabase.auth.getUser()` devolver `user: null` (sessão
expirada, refresh falhou) **ou** `hasSystemAccess` devolver `false` por qualquer motivo
transitório, o middleware devolve um **redirect HTTP puro (307)** — não uma resposta de
Server Action. O `fetch` do navegador (dentro do dispatcher do Next, trecho citado no
item 1) **segue esse redirect automaticamente** (comportamento padrão do `fetch`), cai
numa página HTML normal (login ou dashboard), cujo `content-type` não é
`text/x-component`. Isso bate exatamente com a condição
`!isRscResponse && !redirectLocation` do `server-action-reducer.js:114` (o campo
`redirectLocation` só existe para redirects **internos do Next** via `redirect()` dentro
da própria action — não para um 307 bruto do middleware) → `throw new Error('An
unexpected response was received from the server.')` → cai no `catch` genérico de
`_painel.tsx:29-31`.

Um detalhe agrava isso: **a linha 38 do `middleware.ts` não tem `try/catch`.** Se a
chamada de rede ao Supabase Auth (para validar/renovar o JWT) falhar de verdade (não só
devolver "sem usuário", mas lançar uma exceção — timeout, DNS, etc.), o middleware
inteiro quebra sem tratamento, e o Next responde com o próprio erro de framework para
**qualquer rota protegida**, incluindo `/admin`, `/sofia`, `/dashboard` — não só
`/obras`. Isso é indistinguível do item 5.3 abaixo, e é uma pista de que, se for essa a
causa, o problema não é exclusivo desta tela — só aconteceu de aparecer aqui primeiro,
porque é a primeira vez que essa tela é usada de verdade.

**O que procurar no log do EasyPanel:**
- **Log de acesso HTTP** (se o EasyPanel expõe um): uma linha de `POST /obras/sincronizar`
  no horário do clique, com **status 307 ou 302**. Isso confirma o redirect.
- **Log da aplicação (stdout/stderr do container):** se `getUser()` lançou exceção, uma
  stack trace do Node mencionando `middleware`, `getUser`, ou um erro de rede
  (`fetch failed`, `ENOTFOUND`, `ECONNRESET`, `ETIMEDOUT`) no mesmo timestamp. A
  **ausência** de stack trace, com uma linha de acesso mostrando 307, aponta para o
  ramo "sessão/acesso negados sem exceção" (`!user` ou `hasSystemAccess` falso) em vez
  do ramo "middleware quebrou".
- Peça ao João para checar, ao lado, se o mesmo clique **hoje, de novo**, reproduz o
  problema — se sim, e se ele reabrir a página antes de clicar (forçando revalidação de
  sessão via GET), e o erro sumir, é forte indício de sessão/JWT vencido no momento do
  clique anterior.

### 5.2 — Checagem de origem (CSRF) das Server Actions do Next

`next.config.ts` **não define** `experimental.serverActions.allowedOrigins` — não há
esse bloco no arquivo (conferido lendo o arquivo inteiro). Pela documentação da própria
versão instalada
(`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md:8-10`):
> "Next.js compares the origin of a Server Action request with the host domain... If not
> provided, only the same origin is allowed."

O código que aplica essa regra
(`node_modules/next/dist/server/app-render/action-handler.js:426-477`) compara o header
`Origin` da requisição (mandado pelo navegador) contra o `Host` ou `X-Forwarded-Host`
que o servidor Next enxerga. Rodando atrás do proxy do EasyPanel, o `X-Forwarded-Host`
(ou `Host`, se aquele não vier) é o que decide. Se o proxy, por qualquer motivo, mandar
um host diferente de `hub.manfac.com.br` para o container (nome interno do serviço,
porta, IP), o Next **aborta a Server Action antes de rodar qualquer linha nossa**, com
`res.statusCode = 500` (linha 465) e — crucialmente — **sempre grava uma destas duas
linhas em `console.error` antes de abortar** (linhas 454 e 457):

```
`${host.type}` header with value `${host.value}` does not match `origin` header with
value `${originHost}` from a forwarded Server Actions request. Aborting the action.
```
ou, se nenhum dos dois headers vier:
```
`x-forwarded-host` or `host` headers are not provided. One of these is needed to
compare the `origin` header from a forwarded Server Actions request. Aborting the
action.
```

A resposta resultante ainda tenta ser um Flight response válido (a rejeição é
serializada via `generateFlight`, linha 477-479), então o sintoma no cliente pode ser
levemente diferente do item 5.1 — mas cai no mesmo tipo de `catch` genérico assim que a
promessa rejeitada se propaga até `await sincronizarComFieldAction()`.

**Importante:** essa checagem é **global** — vale para toda Server Action do hub, não só
a de obras. Se for essa a causa, é esperado que **qualquer outro botão que dispare uma
Server Action** (por exemplo o toggle de acesso em `/admin/acessos`,
`app/admin/acessos/_table.tsx:32-44`) também falhe, hoje, agora. Vale o João testar um
clique nesse toggle como diagnóstico cruzado — mas com uma ressalva de código encontrada
nesta investigação: **`_table.tsx:37` chama `alternarAcessoAction(...)` sem
`try/catch`** (ao contrário do painel de obras). Se essa mesma falha acontecesse ali,
**o sintoma visível para quem usa a tela seria diferente** (provavelmente uma exceção
não tratada no console do navegador, não uma mensagem amigável) — então "o toggle nunca
reclamou" não é prova de que esse caminho está saudável; é só prova de que, se falhou,
ninguém viu.

**O que procurar no log do EasyPanel:**
- Grep por `"Aborting the action"` ou `"Invalid Server Actions request"` no
  stdout/stderr do container, no horário do clique. Presença confirma esta hipótese de
  imediato — é a única das listadas aqui com uma frase de log garantida e exclusiva.
- Se aparecer, a linha também diz **qual dos dois headers (`host` ou
  `x-forwarded-host`)** foi usado e **qual valor** ele carregava — isso já aponta para o
  ajuste de proxy a fazer (fora do escopo desta investigação).

### 5.3 — Instabilidade pontual do Supabase Auth/DB exatamente no clique

Variante dos itens 5.1: em vez de um problema de código, o `getUser()` ou a leitura de
`hub_user_roles`/`hub_system_access` (`lib/auth/roles.ts:19-24`,
`lib/auth/systemAccess.ts:12-19`) simplesmente engasgou por um instante — rede, cold
start do lado do Supabase, ou qualquer blip. Como é o **mesmo código** usado por
`/admin` e por `/obras`, não há diferença estrutural entre os dois; a única razão para
ter aparecido aqui primeiro é que esta foi a primeira vez que a tela foi usada de
verdade — pode ter sido azar de horário, não uma causa exclusiva desta tela.

**O que procurar no log do EasyPanel:** qualquer erro/aviso relacionado a Supabase
(`fetch failed`, timeout, 5xx do domínio `*.supabase.co`) no mesmo minuto do clique — em
`middleware.ts` (autenticação) ou nas duas consultas de `hasSystemAccess`. Se não houver
NADA no log da aplicação e só uma linha HTTP de 307, é indício de que o `getUser()`
devolveu "sem usuário" **sem lançar exceção** (ramo silencioso — sessão realmente
expirada), que é o cenário mais provável dentro desta hipótese.

---

## 6. Ordem final das hipóteses, por evidência disponível

1. **`middleware.ts` redireciona o POST da Server Action** (sessão expirada ou
   `hasSystemAccess`/`isAdmin` momentaneamente negando acesso) — `middleware.ts:38,75,109-111`.
   *Log:* linha de acesso `POST /obras/sincronizar` com status 307/302 no horário do
   clique; se `getUser()` lançou exceção, stack trace mencionando `middleware`/`getUser`
   no mesmo instante.
2. **Checagem de origem (CSRF) do Next para Server Actions** rejeitando a requisição por
   descasamento entre `Origin` e `Host`/`X-Forwarded-Host` vindos do proxy do EasyPanel —
   `next.config.ts` sem `allowedOrigins`; `action-handler.js:439-477`.
   *Log:* grep por `"Aborting the action"` ou `"Invalid Server Actions request"` no
   mesmo horário — presença confirma de forma inequívoca; ausência descarta.
3. **Instabilidade pontual do Supabase Auth/DB** bem no instante do clique (mesma
   mecânica do item 1, sem ser um problema de código desta tela) —
   `lib/auth/roles.ts:19-24`, `lib/auth/systemAccess.ts:12-19`.
   *Log:* erro/timeout relacionado a `*.supabase.co` no mesmo minuto; na ausência de
   qualquer log, a hipótese mais provável dentro deste item é sessão realmente expirada.
4. **`FIELD_API_KEY` ausente ou malformada** — descartada como explicação direta: essa
   falha sempre volta como erro de aplicação com o prefixo "Não deu para puxar as OS do
   Field Control...", nunca com o texto genérico que o João viu —
   `_execucao.ts:184-313`, `_painel.tsx:66-72`.
5. **Falha de rede/DNS/TLS do container até a API do Field** — mesma lógica do item 4:
   capturada dentro do `try/catch` de `_execucao.ts`, vira erro de aplicação, não o
   texto genérico — a menos que trave sem erro, o que contradiz a falha em <10s.
6. **Proxy encerrando conexão longa** — descartada pela evidência de falha em <10s e
   pela conta do item 2 (operação, na hipótese mais provável, termina em segundos, não
   minutos).
7. **Container reiniciado por falta de memória** exatamente na janela do clique — sem
   motivo aparente de correlação com esta tela (o volume de dados é pequeno); mantida
   como hipótese residual, só verificável por um evento de reinício no log do EasyPanel
   no mesmo horário.

**Nenhum conserto é recomendado aqui** — a decisão de qual hipótese perseguir e como
corrigir é do coordenador, como pedido.
