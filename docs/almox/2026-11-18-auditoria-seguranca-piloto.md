# Auditoria de segurança do Almoxarifado antes do piloto (18/11/2026)

Só leitura. Código: `C:\Users\joao-\almox`, branch `fase-1` (HEAD `c859c7a`). Banco de produção
`iyytcavcgukfjnjjrerx`, consultado só com SELECT (Management API, `read_only`). Nada foi escrito,
nenhuma rota de produção foi chamada. As telas de Retirada e Falhas no Omie, que estão sendo
feitas em outros worktrees, ficaram fora.

Régua: só conta como achado um cenário concreto de dano que alguém consegue alcançar.

## Resultado

**Nenhum achado bloqueia o piloto.** Dois são para corrigir logo e o resto fica no backlog.

Estado do banco hoje (medido): `alx_papeis`, `alx_colaboradores`, `alx_convites`, `alx_sessoes`,
`alx_pedidos` e `alx_configuracoes` estão vazios. Ninguém tem papel no almox: só os admins do hub
(`hub_user_roles.nivel = 'administrador'`) entram. Como `alx_configuracoes` está vazia, valem os
padrões do código: 5 falhas, 15 min de bloqueio, sessão de 90 dias, convite de 7 dias. Não há job
de cron do almox em `cron.job`.

---

## Achados

### A1. Aprovador lê custo e estoque de tudo pela API do Supabase (corrigir logo)

- **Onde:** `supabase/hub-install/003_alx_copia_omie.sql:163-171` (policies `alx_produtos_select`,
  `alx_saldos_select` e `alx_movimentos_select` com `almox_has_access`). A mesma condição vale em
  produção para `alx_configuracoes`, `alx_recebimentos`, `alx_recebimento_itens`, `alx_contagens`,
  `alx_contagem_itens`, `alx_sugestoes_reposicao`, `alx_sugestao_itens`, `alx_tarefas_omie`,
  `alx_omie_locais`, `alx_sincronizacoes`, `alx_minimos`, `alx_motivos_ajuste`, `alx_estoques`,
  `alx_contratos` e `alx_equipes`.
- **Cenário:** `almox_has_access` dá `true` para quem tem **qualquer** papel, aprovador incluído.
  Um aprovador do contrato DPSP abre o hub, copia o próprio token (fica no cookie do navegador e
  a anon key é pública) e chama
  `GET /rest/v1/alx_saldos?select=*` e `/alx_movimentos`. Recebe saldo e CMC de todos os estoques
  e o valor de todas as movimentações. O desenho (§5.1) diz que o aprovador vê só "pedidos dos
  seus contratos", e a tela de custo por OS foi limitada a gestor e admin
  (`lib/pedidos/actions-pos-aprovacao.ts`, `custoPorOsAction`), mas o banco não aplica esse limite.
- **Por que não bloqueia:** ainda não há aprovador cadastrado, e quem entra são funcionários com
  papel dado por um admin. O dano só passa a valer quando houver aprovador. Se algum aprovador
  for gente do cliente (DPSP/Profarma), o risco é custo da Manfac vazar para o cliente, e aí
  vale corrigir **antes** de cadastrá-lo.
- **Correção:** nas policies de leitura de `alx_saldos`, `alx_movimentos`, `alx_produtos` (CMC) e
  das demais tabelas operacionais, trocar `almox_has_access` por almoxarife, gestor ou admin, num
  SQL novo `024_...`. Antes, confirmar que nenhuma tela do aprovador lê essas tabelas com o
  cliente da pessoa: `carregarCatalogo` do aprovador e o `pedidos/[id]` usam `createClient`.

### A2. Quem sabe o celular ou CPF de um técnico consegue travar o PIN dele, inclusive no balcão (corrigir logo, operacional)

- **Onde:** `lib/portal/fluxos.ts:147-202` (`entrarComPin`) e, em produção,
  `alx_portal_tentativa_pin` (bloqueio crescente: 15 min, 1 h, 24 h, 48 h, 96 h, 7 dias; no 6º
  bloqueio seguido o PIN é suspenso).
- **Cenário:** no grupo de WhatsApp todo mundo vê o celular do colega. Qualquer pessoa na internet
  abre `/almox/t/entrar`, digita esse celular e erra o PIN 5 vezes. O técnico fica bloqueado
  15 min, e quem insistir chega a 1 h e depois 24 h. A trava do PIN de assinatura no balcão é a
  mesma (`docs/validacoes.md`, "Assinatura por PIN"), então ele também **não consegue assinar a
  retirada** nesse período. Não há vazamento nem dado alterado, só gente impedida de usar o
  sistema, e a trava existe para segurar força bruta.
- **Correção:** não mexer no código para o piloto. Deixar o almoxarife sabendo que "desbloquear"
  em Colaboradores zera a contagem (`bloquearAcessoAction` e `limparEspelho`). Registrar em
  `DIVIDAS.md`.

### A3. Uma enxurrada de falhas vinda de vários IPs trava o login e o convite de todos por até 5 min (backlog)

- **Onde:** `lib/portal/sessao.ts:133-172` (`MAX_FALHAS_GLOBAIS = 300` em 5 min, contado entre
  todos os IPs).
- **Cenário:** um robô com 5 ou mais IPs manda 300 PINs errados em 5 minutos, e por até 5 minutos
  ninguém entra com PIN nem cria PIN pelo convite. Quem já tem sessão aberta no celular (90 dias)
  não é afetado. O código assume esse custo de propósito, como diz o comentário na linha 141.
- **Correção:** nenhuma para o piloto.

### A4. O limite por IP depende de haver um único proxy na frente do app (backlog, só dá para conferir depois dos primeiros acessos)

- **Onde:** `lib/portal/origem.ts:57-63` (`ipDoPedido` pega o último valor de `X-Forwarded-For`).
- **Cenário:** se houver outro salto antes do Traefik, todo mundo cai no mesmo "IP" e divide o
  limite de 60 POSTs a cada 5 min. Com uma equipe só no piloto, isso não deve estourar.
  `alx_sessoes` está vazia, então não deu para medir.
- **Correção:** depois dos primeiros acessos, rodar a conferência que já está em
  `docs/validacoes.md` (`alx_sessoes.ip` todos iguais e privados = salto errado).

### A5. Link de convite encaminhado: quem abrir primeiro cria o PIN (backlog, operacional)

- **Onde:** `app/t/convite/[token]/page.tsx` e `alx_portal_usar_convite` (uso único, vence em
  7 dias).
- **Cenário:** o técnico encaminha a mensagem do convite, ou alguém pega o celular dele, e essa
  outra pessoa usa o link antes dele. Ela cria o PIN e entra como o técnico. Ele percebe na hora,
  porque aparece "Esse link já foi usado". Reemitir o convite e usá-lo apaga todas as sessões do
  colaborador (`delete ... alx_sessoes` dentro de `alx_portal_usar_convite`), o que derruba quem
  entrou.
- **Correção:** dizer na mensagem do convite "não encaminhe este link" e orientar o almox a
  reemitir quando o técnico disser que o link "já foi usado".

### A6. O portal divide a origem com os outros apps do hub (backlog)

- **Onde:** `lib/portal/origem.ts:50-54` (`Sec-Fetch-Site` precisa ser `same-origin`).
- **Cenário:** Cockpit, Compras, RH e os demais estão todos em `https://hub.manfac.com.br`. Uma
  falha de XSS em qualquer um deles, se rodasse no navegador onde o técnico tem sessão do portal,
  conseguiria fazer POST nas rotas `/almox/t/api/*`: pedir material ou cancelar pedido em nome
  dele. O cookie é `httpOnly`, então o token não pode ser lido. Esse cenário é distante: o técnico
  não tem conta no hub nem usa os outros apps no celular. A CSP aplicada no `/t`
  (`lib/portal/csp.ts`) não protege contra script que roda em outro app.
- **Correção:** nenhuma agora. É assunto de arquitetura do hub (subdomínio próprio para o portal).

---

## Verificado e OK

**Portal do técnico**
- **Token** (convite e sessão): 32 bytes de `randomBytes` em base64url. O banco só guarda o SHA-256.
  O formato é conferido antes de qualquer consulta (`lib/portal/token.ts`).
- **Convite:**
  - Vence entre 1 e 31 dias, e o banco recusa validade fora disso.
  - É de uso único, decidido num `UPDATE ... where usado_em is null` atômico.
  - Gerar um convite novo invalida os anteriores.
  - Usar o convite troca o PIN e apaga as sessões.
  - Colaborador bloqueado ou desligado não usa convite.
- **PIN:**
  - Hash scrypt (N=16384) com sal por PIN. `conferirPin` só aceita os próprios parâmetros e usa
    `timingSafeEqual`.
  - PIN fácil de adivinhar é recusado no servidor.
  - O banco trava de forma atômica, por colaborador, com bloqueio crescente e suspensão.
  - A resposta é a mesma para quem existe e quem não existe, com um scrypt sempre, inclusive
    contra o hash falso.
  - Também há limite por IP e limite global.
- **Sessão:**
  - Cookie `alx_sessao` com `httpOnly`, `secure`, `sameSite=lax` e caminho `/almox/t` (o de teste
    não vale em produção).
  - Vale 90 dias. O banco recusa sessão com mais de 366 dias.
  - É reconferida no banco **a cada requisição**: ativo, não desligado, não bloqueado e com PIN.
  - Bloquear ou desligar apaga as sessões e fecha os convites (gatilhos `alx_acessos_depois` e
    `alx_colaboradores_depois`).
  - Não dá para forjar uma sessão sem o token.
- **IDOR:** toda rota de `app/t/api/*` passa por `postDoTecnico`, que confere origem, sessão e
  limite. O colaborador sai **só** da sessão:
  - `enviarPedido` e `pedirDevolucao` montam `colaborador_id` a partir de `conta`.
  - O SQL de `alx_pedido_cancelar`, `alx_pedido_reagendar` e `alx_devolucao_cancelar` filtra por
    `colaborador_id = p_colaborador_id`.
  - A página `t/pedidos/[id]` usa `pedidoDoColaborador`, e pedido de outro técnico dá 404.
  - `minhasDevolucoes` filtra pelo colaborador e o estoque da devolução é o da equipe da sessão.
  - **Um técnico não vê nem cancela pedido de outro técnico ou de outra equipe.**
- **Requisição forjada de outro site:** POST de outro site é recusado. `Origin` precisa bater
  exatamente com `NEXT_PUBLIC_APP_URL`, que é obrigatória na construção de produção
  (`next.config.ts:4`). Se vier `Sec-Fetch-Site`, ele tem de ser `same-origin`.
- **Server Action:** o proxy recusa qualquer Server Action mirando `/t`.
- **Busca de OS:** o termo é limpo antes de entrar no `.or()` do PostgREST (`lib/obras/leitura.ts`).
  A busca devolve só id, OS, loja e descrição.
- **Catálogo do técnico:** não traz CMC nem saldo de outros locais (só uma marca de "asterisco").

**Módulo do almoxarife**
- **Telas:** o layout chama `requireAcesso`. Erro na leitura do papel é tratado como "sem acesso"
  (`respostaLibera` só aceita `true`). Cada página ainda confere o papel dela.
- **Server actions:** todas as de `lib/*/actions.ts` conferem sessão e papel no servidor antes de
  criar a chave de serviço. Fazem isso por `requireAcesso`, `operadorDoBalcao`, `exigirAlmox`,
  `exigirAdmin` ou `sessaoQueAprova`, ou dentro da lib, com `operador.podeOperar` ou `ehAdmin`.
  Quando falha, o resultado é sem acesso.
- **Ambiente:** vem sempre de `envServidor().ALX_AMBIENTE`. Nenhuma action recebe ambiente da tela.
  Quem chama a RPC direto e escolhe `p_ambiente` só age onde tem papel naquele ambiente.

**Banco (produção)**
- RLS ligada nas 42 tabelas `alx_*`, nenhuma com `force`.
- **`anon` não tem privilégio** em nenhuma tabela ou função `alx_*`/`almox_*`.
- Escrita de `authenticated` só em `alx_contratos`, `alx_equipes`, `alx_estoques`,
  `alx_configuracoes`, `alx_minimos`, `alx_motivos_ajuste` e `alx_papeis`, sempre com policy de
  admin (ou almoxarife, em mínimos e motivos).
- `authenticated` não tem acesso a `alx_colaboradores` (CPF e celular), `alx_acessos`,
  `alx_convites`, `alx_sessoes`, `alx_assinaturas`, `alx_cargas` nem `alx_ferramentas`.
- As 147 funções têm `search_path` fixo. Toda `security definer` tem também `row_security = off`.
  As 23 que `authenticated` pode executar conferem o papel por dentro e falham fechado
  (`coalesce(..., false)` e `ALX_GUARD`).
- Todas as funções do portal, como `alx_portal_*`, `alx_pedido_enviar` e `alx_pedido_cancelar`,
  só podem ser executadas pelo `service_role`.
- `hub_user_roles` só tem policy de SELECT, então ninguém se promove a admin do hub pelo navegador.
- O bucket `almox-arquivos` ainda não existe, então não há policy de Storage a conferir.

**Rotas `app/api/tarefas/*`**
- As 9 rotas chamam `autorizarAgendador` antes de qualquer coisa.
- A comparação é em tempo constante (`timingSafeEqual`).
- Sem `ALX_CRON_SECRET`, ou com menos de 32 caracteres, **ninguém passa**: a rota falha fechada.

**Porteiro**
- Abre sem sessão do hub só: arquivo estático em GET, `/api/health` (não toca no banco), POST em
  `/api/tarefas/`, o `/t` e `/sem-acesso`.
- Todo o resto exige sessão. Quem só tem sessão do hub, sem papel, vai para `/sem-acesso` pelo
  layout.
- A chave de serviço fica em arquivo `server-only`, e nenhum componente de cliente a importa.
