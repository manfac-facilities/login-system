# Revisão adversarial — PR financeiro#1 (`integracao/fornecedores-medicoes`)

- Data: 08/10/2026. Revisor: subagente (não escreveu o código). Somente leitura: sem push, sem
  comentário no PR, sem SQL em banco real.
- Alvo: commit `2b4c529` — `POST /financeiro/api/integracoes/medicoes`, migration
  `023_fin_integracao_medicoes.sql`, porteiro/proxy, `gravarSolicitacao` com chave de integração.
- Clone novo em `scratchpad/repos/financeiro-review`, `git diff origin/main...origin/integracao/fornecedores-medicoes`
  (11 arquivos, +795/−6).
- Régua: só bloqueia dano alcançável a dado/dinheiro ou abertura de acesso.

## Veredito

**APROVAR** (sem achado bloqueante). Os pontos abaixo vão para backlog; dois deles (B1, B2) são
decisões de contrato que o lado Fornecedores (fatia F6) precisa conhecer antes de chamar a rota.

---

## BLOQUEANTES

Nenhum.

---

## NÃO BLOQUEANTES (backlog)

**B1. Chave já usada devolve 200 com a solicitação antiga, em qualquer etapa — inclusive `recusada`/`cancelada`.**
`lib/integracoes/medicoes.ts:114-115` e `023:52-60`. Cenário: o Financeiro recusa a solicitação
da MD-0007; o Eduardo corrige e reaprova a mesma medição; o Fornecedores chama de novo com o mesmo
`medicao.id` e recebe `200 { numero, id }` da recusada — nada é criado e a resposta não diz a
etapa. Não cria dinheiro a mais (falha fechada), mas a medição pode ficar "pagamento solicitado"
para sempre. Isso cumpre R-41 ao pé da letra; falta decidir o caminho de reenvio (pela tela do
Financeiro, como hoje, ou chave nova) e, de preferência, devolver `etapa` na resposta 200.

**B2. Anexos (NF, evidência) não passam pela rota** — TODO declarado no próprio PR
(`lib/integracoes/medicoes.ts:26-27`). R-42 do spec pede anexos; hoje o solicitante teria de
anexar pela tela do Financeiro. Anexo é opcional no Financeiro, então não quebra o fluxo.

**B3. Emergencial pela hora do Financeiro, não do Fornecedores.** O vencimento R-40 é calculado no
Fornecedores; se a chamada chegar depois das 17h (ou numa retentativa no dia seguinte), a primeira
janela anda e `interpretarEnvio` (`medicoes.ts:137`) marca emergencial automático → vai para o
diretor. Mesmo comportamento da tela (não é brecha), mas o F6 deve recalcular o vencimento a cada
retentativa ou aceitar que o diretor receba esses casos.

**B4. `emergencialManual` vem do chamador** (`schemas.ts:82`, passado inteiro em `corpoSchema`).
A tela também deixa qualquer logado marcar emergencial com justificativa, então não é poder novo;
mas o spec R-40 diz "nunca gerar emergencial automático" — o F6 deve mandar sempre `false`.

**B5. `listUsers` com `perPage: 1000` e parada por `length < 1000`** (`route.ts:29-34`). Se o
Auth limitar o tamanho da página abaixo de 1000 sem avisar, a busca para na 1ª página e quem
estiver depois recebe 422 `solicitante_desconhecido`. Falha fechada (não cria nada). Não verifiquei
o limite do GoTrue nesta versão. Hoje o hub tem poucas contas; também é O(n) por chamada.

**B6. Conta não confirmada ou só convidada é aceita como solicitante.** `buscarUsuario` só compara
e-mail. Não há "desativado" a tratar: o hub remove conta com `auth.admin.deleteUser`
(`app/admin/_actions.ts:187,280` do hub), e conta apagada não aparece na lista → 422. Ok.

**B7. Corpo é lido antes do segredo** (`route.ts:44-49`). Sem efeito em dado; só custo de parse
para chamador anônimo (limite de 11 MB do proxy já existe).

**B8. Documentação do repo Financeiro**: a regra 8 do `CLAUDE.md` ("só gravados pelas funções do
006 e do 008 … depois de conferir sessão") não cita o 023 nem a rota sem sessão. Atualizar junto.

**B9. `on delete cascade` em `fin_solicitacao_integracoes.solicitacao_id`** (`023:21`). Se algum
dia uma solicitação for apagada, a chave some e a medição poderia gerar outra. Hoje não há `delete`
de `fin_solicitacoes` em nenhum SQL ou código (grep vazio). Registrar.

**B10. Testes de concorrência só sequenciais.** O PGlite roda numa conexão; a trava
`pg_advisory_xact_lock` não é exercitada com duas sessões. A análise abaixo indica que está
correta, mas não há prova automatizada.

---

## O que verifiquei e está correto

### 1. Autenticação e porteiro
- Segredo ausente, vazio ou com menos de 32 caracteres → `autorizarAgendador` devolve `false` → 401
  antes de qualquer leitura (`lib/catalogo/agendador.ts:9-15`; `medicoes.ts:107-109`). Teste cobre
  `undefined` e curto.
- Comparação com `timingSafeEqual` sobre `Bearer <segredo>`; o atalho por tamanho diferente só
  revela o comprimento, que é fixo (64). Segredo próprio (`FORNECEDORES_INTEGRACAO_SECRET`), separado
  do `FIN_CRON_SECRET`.
- Cliente de serviço só é criado depois do segredo (criação preguiçosa em `route.ts:55-58`).
- Bypass do porteiro: exige `POST` + sem `next-action` + `pathname` começando com
  `/api/integracoes/` (com a barra final — `/api/integracoes-falsas` não passa; teste cobre).
  Espelha exatamente o padrão já em produção do agendador. `nextUrl.pathname` já vem normalizado
  (`..`, `%2e%2e`), e sob esse prefixo só existe `app/api/integracoes/medicoes/route.ts` — nenhuma
  página ou rota dinâmica que um POST anônimo alcance. Server Action não passa (exige ausência de
  `next-action`). GET e demais métodos continuam exigindo sessão.

### 2. Mesmas validações da tela
- Caminho idêntico ao `enviarSolicitacaoAction` (`lib/solicitacoes/actions.ts:64-118`):
  `solicitacaoFormSchema` → `carregarCatalogoDoEnvio` (serviço) → Receita para CNPJ novo →
  `interpretarEnvio` com relógio do servidor → `procurarDuplicadas` → `montarPayload` → RPC.
- O chamador não controla `etapa`, aprovação, status, `ambiente`, `numero`, prazos, `primeira_janela`
  nem `etiquetas`: tudo sai de `montarPayload`/`fin_criar_solicitacao` (`006:248` decide a etapa).
  Valor, vencimento, fornecedor, forma de pagamento e emergencial manual são os mesmos campos que
  qualquer logado já preenche na tela.
- Solicitante: único poder novo é escolher o e-mail (decisão P2). Precisa ser conta do hub. A
  segregação existente impede esse solicitante de aprovar/validar a própria solicitação
  (`etapas.ts:150`). E-mail gravado em minúsculas, igual à sessão (`sessao.ts:31`) e às comparações
  (`etapas.ts:89`) — devolução/reenvio/anexo funcionam para quem abriu a medição.
- Erro do banco nunca vaza: só `mensagemDeGuarda` (FIN_GUARD) ou mensagem fixa.

### 3. Idempotência, concorrência e migration 023
- Duas chamadas simultâneas com o mesmo `medicao.id`: ambas passam do `lerExistente` (null), mas na
  função a segunda espera o `pg_advisory_xact_lock` até o commit da primeira; em READ COMMITTED o
  `select` seguinte (novo snapshot por comando em função volátil) enxerga a linha → `repetida: true`,
  200, sem e-mail. Se a trava falhar por qualquer motivo, a PK `(ambiente, origem, chave)` e o
  `unique(solicitacao_id)` derrubam o `insert`, e como tudo roda numa transação o
  `fin_criar_solicitacao` (contador, solicitação, rateio, evento) é desfeito junto → 500 → retentativa
  devolve a existente. Não há como sair com duas solicitações.
- E-mails só no caminho 201 (`medicoes.ts:166-168`), em `after()`, depois do commit.
- RLS ligada sem policy; `revoke all` de `anon, authenticated` na tabela; função sem
  `security definer` (roda como `service_role`), `search_path = public, pg_temp`, `execute`
  revogado de `public, anon, authenticated` e dado só a `service_role`. Teste PGlite confere
  `permission denied` para logado na função e na tabela.
- Falha aberta com NULL: origem nula ou chave vazia → exceção; `ambiente` nulo faria a trava virar
  no-op (função estrita), mas o `fin_criar_solicitacao` recusa ambiente desconhecido e a coluna é
  `not null` — e `montarPayload` sempre preenche. Origem desconhecida cai no `check`.
- Efeito em tabela existente: nenhum. Só tabela nova + função nova; `fin_criar_solicitacao` não foi
  alterada (aceita chaves extras no jsonb e as ignora).

### 4. Solicitante por e-mail
- Caixa: os dois lados em `trim().toLowerCase()` (`medicoes.ts:122`, `route.ts:32`). Ok.
- Desativado: no hub = apagado → não listado → 422. Ok. Paginação: ver B5.

### 5. Comportamento atual da tela
- `gravarSolicitacao` sem o 3º argumento chama o mesmo `fin_criar_solicitacao` de antes; o retorno
  só ganha `repetida: false` e o `criadaSchema` aceita `repetida` opcional. `ERRO_AO_GRAVAR` só
  passou a ser exportado. Proxy/porteiro só mudam para `POST /api/integracoes/*`. Nenhuma tela,
  action ou função SQL existente foi alterada.

### Testes
Rodados no clone novo, commit `2b4c529`, depois de `npm ci`:
- `npx vitest run` (suíte inteira): **65 arquivos, 992 testes, todos passando**.
  Os do PR (`integracoes-medicoes`, `porteiro`, `hub-install-pglite`, `hub-install-safety`): 286/286.
- `npx tsc --noEmit`: sem erro.
- Não testei: concorrência real com duas sessões no Postgres (B10) nem o limite de página do
  `listUsers` em produção (B5).
