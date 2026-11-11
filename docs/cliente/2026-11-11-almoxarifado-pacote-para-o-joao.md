# Almoxarifado — pacote para o João

Este arquivo junta tudo o que foi decidido em 10–11/11/2026 entre o Jose Guilherme e o Claude
para o módulo Almoxarifado do hub (`hub.manfac.com.br/almox`).

**Você implementa o sistema inteiro**: fases 1 a 7 e a virada. As fases são só a ordem de
entrega. Você tem acesso ao Supabase do hub e a todos os repositórios da organização
`manfac-facilities` no GitHub — consulte os repositórios de referência (lista na seção 0 do
plano) sempre que precisar ver como algo já foi feito.

Ordem de leitura:
1. **Parte A — Desenho** (o quê e por quê). Leia inteiro.
2. **Parte B — Plano de implementação** (como, task a task). Comece pela seção 0.

Os mesmos textos estão separados em `docs/superpowers/specs/2026-11-11-almoxarifado-design.md`
e `docs/superpowers/plans/2026-11-11-almoxarifado-sistema-completo.md` do repositório
`manfac-facilities/compras`; copie os dois para o repositório novo na Task 1.

---

# PARTE A — DESENHO

# Almoxarifado — desenho (módulo do hub Manfac)

> Data: 11/11/2026 · Autor da conversa: Jose Guilherme · Quem implementa: João
> Endereço: `hub.manfac.com.br/almox` · Molde: o módulo Compras (`manfac-facilities/compras`)
> Fonte dos desejos: "Fluxos Processo IA (4).pdf" (Jose) + brainstorming de 10–11/11/2026.

Marcações neste documento:
- **(Jose)** decisão dita pelo Jose Guilherme na conversa.
- **(decisão de desenho)** escolha feita no brainstorming que o Jose não contestou
  explicitamente; pode ser revista por ele, não pelo implementador.
- **(a validar)** fato técnico que precisa ser medido antes de construir a parte que depende dele.

---

## 1. O que a gente está resolvendo

O almoxarifado da Manfac (manutenção predial com contratos DPSP e Profarma, mais Obras e
Spot) trabalha às cegas e no braço:

1. **Solicitação item a item.** Hoje o técnico pede material no Field, um item por vez, e o
   almoxarife libera um por vez. Não dá para pedir um conjunto nem aprovar de uma vez.
2. **Estoque que nunca bate.** O almoxarife nunca sabe o que tem; para qualquer consulta tira
   um Excel do Omie. Físico e sistema divergem e ninguém conta.
3. **Retirada sem aviso.** O técnico pede e aparece na empresa na hora; nada foi separado.
4. **Pouca visão do que o Compras pediu e do que chegou.** O lançamento da entrada vira bola
   dividida entre compras e almox; o almox não tem o pedido em mãos para conferir.
5. **Carga do colaborador em planilha e papel.** Quem está com qual ferramenta, EPI e
   uniforme não é confiável; na demissão o RH não sabe o que descontar.

**Sucesso:** o almoxarife abre uma tela e vê quanto tem de cada produto em cada estoque, sem
Excel; o técnico manda um pedido só, pelo celular, com dia de retirada; o aprovador aprova o
pedido inteiro; quando o técnico chega o material está separado; o estoque bate porque é
contado toda semana; a ficha de cada colaborador diz o que está com ele, com termo assinado.

**Anti-objetivos (seria fracasso mesmo funcionando):**
- Criar mais burocracia que o Field: pedir tem que ser mais rápido que hoje.
- Um segundo "estoque de verdade" que diverge do Omie. **O Omie é a fonte da verdade (Jose).**
- Dar ao técnico acesso ao banco do hub ou exigir conta no hub para ele **(Jose)**.

## 2. O que o levantamento achou (10/11/2026, só leitura no Omie de produção)

**Locais de estoque no Omie (26, todos ativos, tipo 1):**

| Código Omie | Código | Descrição | Saldo aproximado em 10/11 |
|---|---|---|---|
| 10152414293 | BASE | Almoxarifado Base | ~102 produtos, ~R$ 17 mil |
| 10167614709 | DPSP | Base Almox - DPSP | 59 produtos, ~R$ 14 mil |
| 10167614993 | PROFARMA | Base Almox Profarma | 58 produtos, ~R$ 11 mil |
| 10170713109 … 10225159554 | MANFAC 1 … MANFAC-25 | um por equipe (23 locais; não há 14 nem 16) | 0 a 56 produtos cada |

**Movimentações observadas:**
- Compras entram no **BASE** (`codOrigem = COM`, "Compra de Produto") e também em DPSP e Profarma.
- Entregas às equipes saem de DPSP/Profarma como **transferência manual** (`ListarAjusteEstoque`:
  `tipo = TRF`, `imp_api = N`) — 125 só entre 29/10 e 10/11.
- As equipes têm **saídas automáticas** (`tipo = SAI`, `motivo = INV`, `imp_api = S`, sem
  observação, pequenas quantidades, quase todo dia — 74 no mesmo período). É quase certo que
  sejam a **integração nativa Field → Omie** dando baixa do material aplicado na OS. A API do
  Field tem módulo de estoque (`/storages-v2`, `/storages-movements-v2`, com
  `external.id` "ex: ID no Omie" e `/storages-movements-v2/transfers` por `externalId`).
  **(a validar, item V1)**: a chave do Field no computador do Jose estava vencida; a válida
  está no cofre do Supabase do Cockpit.
- Ajustes de saldo manuais (`SLD`) frequentes, inclusive em equipes: o sintoma do "não bate".
- Quirks medidos: `ListarMovimentoEstoque` **sem** `codigo_local_estoque` só devolve o BASE;
  com o filtro, devolve o local. Intervalo de datas longo demais devolve "Não existem
  registros" — ler em janelas de até ~1 mês. `ListarAjusteEstoque` aceita só paginação (sem
  filtro de data/ID); traz `obs`, `motivo`, `tipo` (ENT/SAI/TRF/SLD), `imp_api`,
  `cod_int_ajuste`, `id_local_ds` (destino da transferência).
- **Só existe uma chave do Omie (produção).** Não há Aplicativo de Teste de verdade (em 13/10
  as chaves "de teste" eram as mesmas da produção). Ver §14.

**Field / Cockpit:** o Cockpit (`dash_field`) sincroniza OS e atividades do Field a cada 5 min
no banco do hub, mas **não guarda nada de material ou estoque** hoje.

**Compras (no ar):** já tem papel `almoxarifado`, a etapa AGUARDANDO ENTREGA de pedido com
entrega na Base (almox confirma ok/divergência), `cmp_pedidos.previsao_entrega` atualizável
pelo compras, e a "requisição de estoque" da solicitação de compra, que hoje vai **por
e-mail** ao almox (a spec do Compras deixou "sistema de requisição do almoxarifado" como
futuro — é este).

## 3. Decisões tomadas

| # | Assunto | Decisão |
|---|---|---|
| D1 | Fonte da verdade | Omie. Toda movimentação física vira movimentação no Omie via API **(Jose)** |
| D2 | Onde o técnico pede | Neste sistema, pelo celular, como um app; deixa de pedir no Field **(Jose)** |
| D3 | Estoque que o técnico vê | Só o do contrato dele; Obras e Spot saem do BASE **(Jose)** |
| D4 | Sem saldo no contrato, com saldo em outro | Item marcado com asterisco; o técnico pede mesmo assim; vira pedido de transferência que o almox decide **(Jose)**. O técnico não vê de onde nem quanto **(decisão de desenho)** |
| D5 | Acesso do técnico | Sem conta no hub: link de convite + PIN, no modelo do portal do fornecedor do Cockpit **(Jose aprovou)** |
| D6 | Aprovação | Aprovadores cadastrados por contrato (e por Obras/Spot) na configuração; aprova o pedido inteiro, parcial, ajusta e inclui itens **(Jose)** |
| D7 | Alerta de não aprovado | Para o técnico ("não vai poder retirar no dia") e para o aprovador (para não virar gargalo) **(Jose)** |
| D8 | Separado | O almoxarife marca separado e isso gera um OK para técnico e aprovador **(Jose)** |
| D9 | Tela do aprovador | Coluna "saldo da equipe depois" (pediu 2, já tem 2, fica 4) **(Jose)** |
| D10 | Carga (ferramentas/equipamentos) | Vive só neste sistema; o Omie não fica sabendo **(Jose)**. Termo de responsabilidade assinado pelo colaborador **(Jose)** |
| D11 | EPI e uniforme | Saem do estoque do Omie como material, identificados pela **família** do produto (EPI / Uniforme), e entram na ficha do colaborador **(Jose)** |
| D12 | Demissão | Integração com o sistema de RH do João: o pedido chega ao almox pelo sistema e é respondido pelo sistema **(Jose)** |
| D13 | Recebimento de compra | O almox confere contra o pedido do Compras; a entrada no Omie (Recebimento de NF-e) fica com compras/fiscal; o sistema mostra "conferido, falta entrada no Omie" **(Jose)** |
| D14 | Agenda de entregas | A previsão de entrega informada pelo compras aparece como programação do dia do almox **(Jose)** |
| D15 | Inventário | Contagem em ondas de 20 itens sorteados até cobrir tudo; mensagem "inventário físico em dia"; ciclo novo pelo menos semestral **(Jose)** |
| D16 | Ajuste de inventário | Só com aprovação de admin (Jose ou outro admin) **(Jose)**; motivos de lista fixa com botão "novo motivo" **(Jose)** |
| D17 | Abaixo do mínimo | O sistema monta a sugestão de reposição para o compras **(Jose)** |
| D18 | Avisos | E-mail para usuários do hub; alerta dentro do app para o técnico **(Jose)**. WhatsApp é desejo futuro **(Jose)** |
| D19 | Indicadores | Tela própria com giro, cobertura, estoque parado etc. (§12) **(Jose pediu; lista da conversa)** |
| D20 | Cockpit "Operação" | Fase seguinte, depois do almox rodando; aviso no sistema para não esquecer **(Jose)** |
| D21 | Gestor | Papel que vê tudo e aprova qualquer pedido (Gabriel Vidal); **não** aprova ajuste **(Jose)** |
| D22 | Equipe × contrato | Cada equipe tem um contrato e retira só dele; atendimento ocasional do outro contrato aparece nos números, não na retirada **(Jose)** |
| D23 | Gravar no Field | Permitido para transferências de estoque, se for o lado que propaga para o Omie; movimentar em um lado só, nunca nos dois **(Jose; depende do V3)** |

## 4. Arquitetura

```
Celular do técnico ──► hub.manfac.com.br/almox/t/...   (portal do técnico: link + PIN, sem conta do hub)
Navegador (hub)    ──► hub.manfac.com.br/almox         (porteiro: sessão do hub)
                          │
                          ├──► Banco do hub (Supabase): tabelas alx_*, cópia do estoque do Omie, eventos
                          │        ├── leitura de cmp_pedidos / cmp_pedido_itens / cmp_solicitacoes (Compras)
                          │        ├── leitura de rh_colaboradores (RH)
                          │        └── leitura de obras_obra (Controle de Obras)
                          └──► API do Omie (só pelo servidor)

Agendador do banco (pg_cron) ──► rotas protegidas do app:
   cópia do estoque (10 min) · movimentações (1 h) · fila do Omie (5 min) · avisos/lembretes (1 h) · indicadores (diário)
```

### 4.1 Repositório e base

Repositório novo (sugestão: `manfac-facilities/almox`), publicado no EasyPanel como o Compras.
Mesma base do Compras: Next.js 16 (App Router, `basePath: "/almox"`, `proxy.ts`), TypeScript
strict, shadcn/ui base-nova (`render={<X />}`, `<Select>` com `items`), Tailwind 4, React Hook
Form + Zod 4, funções do servidor com `ActionResult`, Biome, Vitest, PGlite para testar o SQL,
nodemailer. Visual, cabeçalho, menu e tema iguais ao Compras.

**Copiar do Compras e adaptar (não importar):** porteiro e sessão, cliente do Omie
(`lib/omie/cliente.ts`: limite de requisições, erro em HTTP 500, lista vazia como erro,
`repetirSemResposta`), leitura de posição (`lib/estoque/posicao.ts`), catálogo com
sincronização, avisos/SMTP, fila com trava e tentativas, papéis, configurações versionadas,
linha do tempo de eventos, `ActionResult`, logger, teste de segurança da instalação
(`tests/hub-install-safety.test.ts`), leitura de `obras_obra` (`lib/obras/leitura.ts`).

**Copiar do Cockpit e adaptar:** o portal do fornecedor (`dash_field/src/lib/portal/*`,
migração `20261012190000_portal_fornecedor.sql`) como base do portal do técnico (§5.2).

### 4.2 Banco

Mesmas regras do Compras, trocando o prefixo:

- Tabelas `alx_*` no `public` do hub; funções `almox_*`/`alx_*`; jobs `almox-*`; pasta de
  arquivos `almox-arquivos` (privada). RLS em toda tabela; policies com
  `(select public.almox_...())`; `security definer` sempre com `set search_path = public, pg_temp`
  e `set row_security = off`.
- SQL novo só em `supabase/hub-install/NNN_*.sql`, aplicado à mão no SQL Editor, só o arquivo
  novo. Depois `npm run types` e commit junto com `types/supabase.ts`.
- **Travas do banco compartilhado:** nunca `drop extension` (o `pg_net` sustenta o Cockpit),
  nunca mexer em `auth.users`, nunca permissão de alcance global, nunca escrever em `obras_*`,
  `fin_*`, `hub_*`, `rh_*` **nem `cmp_*`**. Ler pode. O teste de segurança recusa.
- Toda decisão manda o `atualizado_em` que a tela mostrou; o banco recusa se mudou.
- Toda tabela de dados tem `ambiente` (`producao` | `teste`).
- Configuração nunca é editada nem apagada: salvar grava linha nova em `alx_configuracoes`;
  vale a última até o momento.

**Integração entre módulos: cada um escreve só no seu, lê do outro (decisão de desenho).**
O almox lê `cmp_*`; o Compras passa a ler `alx_*` (§10). Nenhuma função de um chama função do
outro no banco.

Esboço das tabelas (nomes e colunas finais no plano):

| Tabela | Guarda |
|---|---|
| `alx_estoques` | os locais do Omie com papel no almox: tipo (`base`, `contrato`, `equipe`, `conserto` virtual), contrato associado, aprovadores (via `alx_papeis`) |
| `alx_contratos` | DPSP, Profarma, "Obras/Spot" (destino especial) → estoque de origem, centro de custo |
| `alx_equipes` | MANFAC N → local Omie, contrato (um só), depósito no Field (externalId), ativa |
| `alx_colaboradores` | nome, celular, CPF, `rh_colaborador_id` (do módulo RH), equipe, ativo, data de desligamento; é o técnico do portal **e** o dono da ficha de carga |
| `alx_acessos` / `alx_convites` / `alx_sessoes` | PIN (hash), falhas seguidas, bloqueado até; convite (hash do token, expira, usado); sessão (hash do token, expira) — padrão do portal do fornecedor |
| `alx_produtos` | cópia do cadastro do Omie: código, descrição, unidade, família, CMC, ativo, texto de busca normalizado |
| `alx_saldos` | cópia da posição: produto × local → saldo, CMC, lido em |
| `alx_movimentos` | cópia das movimentações do Omie por local (para giro, parado, consumo da equipe) |
| `alx_minimos` | produto × estoque de contrato → mínimo, estoque alvo (versionado como configuração) |
| `alx_pedidos` | número, colaborador, equipe, contrato/destino, OS (uma ou mais), data de retirada, emergencial (+motivo), etapa, `atualizado_em` |
| `alx_pedido_itens` | produto, pedido, aprovado, separado, entregue, OS do item, "aguardando transferência" |
| `alx_transferencias` | pedidos de transferência entre estoques (origem decidida pelo almox), decisão, movimento no Omie |
| `alx_devolucoes` | sobra da equipe → estoque do contrato |
| `alx_assinaturas` | quem, quando, o quê (pedido/termo/devolução), imagem do traço, PIN conferido, IP/aparelho |
| `alx_ferramentas` | item rastreado (patrimônio/etiqueta) ou por quantidade; valor; estado |
| `alx_cargas` | entrega/devolução de ferramenta, EPI e uniforme ao colaborador, termo |
| `alx_consertos` | saída para conserto, fornecedor, previsão, volta |
| `alx_desligamentos` | pedido do RH, conferência do almox, itens faltantes com valor, resposta |
| `alx_recebimentos` (+ itens) | conferência de pedido do Compras, item a item, divergência |
| `alx_sugestoes_reposicao` (+ itens) | rascunho gerado pelo mínimo, para o Compras |
| `alx_contagens` / `alx_contagem_itens` | ciclo de inventário, ondas de 20, contado × Omie |
| `alx_ajustes` | diferença, motivo, aprovação do admin, movimento no Omie |
| `alx_motivos_ajuste` | lista fixa + criados ("novo motivo"), quem criou |
| `alx_tarefas_omie` | cada gravação no Omie: tipo, corpo (sem chave), tentativas, trava, último erro, código de integração |
| `alx_avisos` | cada e-mail e cada alerta do app: para quem, de quê, canal, situação |
| `alx_eventos` | toda mudança: quem, quando, de/para, motivo — nunca apagada |
| `alx_papeis` | e-mail do hub, papel, contrato (para aprovador), quem concedeu, ativo |
| `alx_configuracoes` | chave, valor, vigente desde, quem alterou |
| `alx_indicadores_mensais` | foto mensal dos indicadores (histórico a partir do go-live) |
| `alx_pendencias_projeto` | avisos fixos ao gestor, ex.: "Fase 2: aba Operação no Cockpit" (D20) |

### 4.3 Cópia do estoque (por que e como)

A tela de posição não pode esperar 26 chamadas ao Omie. **(decisão de desenho)** Um job copia
`ListarPosEstoque` (`cExibeTodos = "N"`) de cada local a cada 10 min para `alx_saldos`, em
sequência (o Omie pune rajada; ~26–40 chamadas ≈ 1 min). A tela mostra "atualizado às hh:mm".
Antes de **gravar** (transferir, baixar, ajustar), o servidor relê o saldo do produto no local
no Omie, não confia na cópia. Movimentações (`ListarMovimentoEstoque` por local, janela
deslizante) a cada 1 h para `alx_movimentos`. Catálogo de produtos (com família e CMC) a cada
1 h, como o catálogo do Compras.

A chave do Omie é a mesma de Compras e Financeiro **(a validar, V7)**: o limite de requisições
é compartilhado; jobs do almox não devem cair no mesmo minuto dos jobs do Compras.

### 4.4 Segredos

Chave do Omie, SMTP, chave de serviço do Supabase, segredo do agendador e (se usado) chave do
Field ficam só no EasyPanel e no cofre do Supabase, colocados pelo Jose. O plano entrega os
nomes das variáveis. `SUPABASE_SERVICE_ROLE_KEY` só em arquivo `server-only`.

## 5. Papéis e acesso

### 5.1 Usuários do hub

| Papel | Quem | Vê | Faz |
|---|---|---|---|
| Aprovador | cadastrado por contrato (DPSP, Profarma) e por Obras/Spot | pedidos dos seus contratos | aprova (inteiro/parcial), ajusta quantidades, inclui itens, recusa, informa OS; recebe alerta de pendência |
| Almoxarife | equipe do almox | tudo do almox | separa, entrega, decide transferência, confere recebimento, conta inventário, cuida de carga/fichas/consertos, responde desligamento, revisa sugestão de reposição, cadastra técnicos e gera convites |
| Gestor | Jose, Gabriel Vidal | tudo | aprova qualquer pedido; **não** aprova ajuste |
| Admin | Jose e quem ele indicar | tudo | aprova ajuste de inventário; edita configurações e papéis |

Uma pessoa pode acumular papéis. Pedido pendente aparece para todos os aprovadores do contrato;
o primeiro que agir resolve **(decisão de desenho)**. Concessão/retirada de papel fica registrada.
O porteiro é o do Compras (sessão do hub; sem sessão → `HUB_LOGIN_URL`).

### 5.2 Portal do técnico (sem conta do hub)

Modelo do portal do fornecedor do Cockpit (conta fora do Supabase Auth, porque uma sessão do
hub daria ao técnico o papel `authenticated` no banco compartilhado):

1. O almoxarife cadastra o colaborador (nome, celular, equipe) e clica "gerar convite".
2. O sistema cria um link pessoal de uso único (token aleatório; o banco guarda o SHA-256),
   válido por 7 dias **(decisão de desenho)**. Botões "copiar link" e "abrir no WhatsApp"
   (`wa.me` com texto pronto — não é a API do WhatsApp).
3. No primeiro acesso o técnico cria um **PIN de 4 a 6 dígitos** (hash forte, ex. scrypt).
   O celular fica com sessão de **90 dias** em cookie `httpOnly` **(decisão de desenho)**.
4. **O PIN é a assinatura**: retirada, termo de ferramentas, EPI, devolução pedem PIN + traço
   do dedo na tela. Vale no celular do técnico ou no tablet do almox.
   **(decisão de desenho)** Quem só recebe ferramenta/EPI e não pede material (ex.:
   pessoal de escritório) não precisa de convite: o PIN pode ser criado na hora, no tablet do
   almox, durante a primeira entrega. O convite por link serve para quem vai usar o celular.
5. 5 PINs errados seguidos bloqueiam por 15 min **(decisão de desenho)**. O almox bloqueia,
   desbloqueia e reemite convite. Desligamento bloqueia automaticamente.
6. Tudo do portal é lido e gravado por rotas do servidor com a chave de serviço, **sempre
   filtrado pelo colaborador da sessão**. O técnico vê só os pedidos dele, o estoque do
   contrato dele e a própria ficha.
7. O portal vive em `/almox/t/...`, fora do porteiro do hub, com proteção de origem e limite de
   tentativas como no portal do fornecedor.

O portal deve funcionar bem no celular (layout de app, botões grandes) e pode ser instalável
como PWA (atalho na tela inicial). Notificação push fica fora (§16).

## 6. Pedido de material (fluxo principal)

```
RASCUNHO (carrinho no celular)
  └─ enviar ─► AGUARDANDO APROVAÇÃO ──(aprovador)──► APROVADO ──(almox)──► SEPARADO ──(retirada + assinatura)──► ENTREGUE
                     │ recusa total ─► RECUSADO                │                    │
                     │ passou do corte sem aprovação ─► alerta "não vai poder retirar em dd/mm"
                     │                                         └ itens "aguardando transferência" (D4) ficam pendentes no almox
  cancelar: técnico enquanto não separado; almox/aprovador com motivo
  não retirado até o fim do dia agendado ─► NÃO RETIRADO (alerta; volta à prateleira; pode reagendar)
```

### 6.1 Técnico monta o pedido (celular)

- **Contrato/destino:** cada equipe tem **um contrato** (configuração) e retira só do estoque
  dele **(Jose)**. O técnico não troca de contrato; a única outra opção no pedido é
  **Obra/Spot** (sai do BASE). Quando uma equipe acaba atendendo OS do outro contrato, isso
  **não** muda a retirada: aparece nos números (indicador "aplicação fora do contrato", §12) —
  ex.: MANFAC 2 é DPSP mas aplicou material em OS da D1000/Profarma **(Jose)**. O estoque da
  equipe é, portanto, um local só, sem divisão por contrato.
- **Busca instantânea (Jose):** filtra a cada letra digitada; ignora acento e caixa; casa por
  pedaços ("disj 20" acha "Disjuntor DIN 20A curva C"). Texto de busca normalizado em
  `alx_produtos`; a filtragem pode ser no navegador sobre a lista do contrato (centenas de
  itens) — escolha do implementador.
- Só aparecem produtos **ativos do cadastro do Omie**. Com saldo no estoque do contrato:
  mostra a quantidade. Sem saldo no contrato mas com saldo em outro estoque (exceto equipes):
  **asterisco** "sem saldo aqui, o almox pode transferir" — pode pedir (D4). Sem saldo em
  lugar nenhum: cinza, não pede (o caminho é o Compras).
- **OS:** obrigatória para Obra/Spot (busca em `obras_obra` por OS, loja ou descrição — leitura,
  como o Compras); opcional na manutenção. Fora do centro de custo da manutenção o aprovador
  pode informar uma ou mais OS e dizer qual item vai para qual (do PDF).
- **Data de retirada:** retiradas de **segunda a sexta até 10h**. A data padrão é o primeiro
  dia válido respeitando: aprovado até **16h** → retira no dia útil seguinte; depois das 16h →
  dia útil + 2 (PDF). O técnico pode escolher data posterior. Horários e janelas são
  configuração.
- **Emergencial:** qualquer retirada fora dessas regras (hoje, depois das 10h, sábado). Exige
  motivo; vira alerta para aprovador e gestor e conta no indicador.

### 6.1.1 Saldo comprometido (decisão de desenho)

O saldo mostrado ao técnico e ao aprovador é **disponível = saldo no Omie − aprovado e ainda
não entregue** naquele estoque. É esse número que decide asterisco/cinza (D4). Aprovar além do
disponível não é bloqueado: o item excedente vira "aguardando transferência" para o almox
decidir, e conta como ruptura.

### 6.1.2 EPI e uniforme no pedido (decisão de desenho)

O técnico pode pedir EPI e uniforme no carrinho normal. Na entrega, itens das famílias EPI e
Uniforme não são transferidos para a equipe: viram **saída no Omie + linha na ficha do
colaborador + assinatura** (§7). A origem segue a regra do pedido (estoque do contrato; BASE
para Obra/Spot). O almox também entrega EPI/uniforme direto pela ficha, sem pedido.

### 6.2 Aprovação (tela do aprovador, no hub)

- Fila de pendentes do(s) contrato(s), mais antigos e mais próximos da retirada primeiro, com
  tempo de espera.
- Abre o pedido inteiro. Por item: pedido, **aprovar (editável)**, **equipe já tem**,
  **saldo da equipe depois** (já tem + aprovado) **(Jose)**, saldo no estoque do contrato.
  Pode incluir item, zerar item, recusar tudo (motivo). Um clique aprova o que está na tela.
- **Divergência equipe × pedido (PDF):** destaque quando a equipe pede algo que, no Omie, já
  tem em quantidade relevante — ex.: equipe já tem ≥ o pedido **(decisão de desenho; limite em
  configuração)**.
- Aprovar recalcula a data de retirada se passou do corte das 16h.

### 6.3 Alertas de pendência (D7)

- **Técnico (no app):** "Pedido #1042 ainda não aprovado — se não for aprovado até 16h, você
  não retira em qua 12/11." Depois do corte: "não aprovado a tempo; nova data: …".
- **Aprovador (e-mail + tela):** pendente há mais de X horas úteis **e** sempre perto do corte
  das 16h do dia anterior à retirada **(decisão de desenho; horários em configuração)**. Um
  e-mail por pessoa com tudo o que está com ela, como os lembretes do Compras.

### 6.4 Separação (almoxarife)

- Lista do dia (e do dia seguinte) por data de retirada: equipe, nº, itens, emergenciais em
  destaque. Lista de separação imprimível.
- Marca **separado** (pode ser parcial: item faltou na prateleira → volta ao aprovador ou ao
  técnico com aviso). Separado gera **OK** para técnico (app) e aprovador (e-mail) **(Jose)**.
- Itens "aguardando transferência" (D4): o almox escolhe a origem (vê saldos de todos os
  estoques), confirma ou recusa. Confirmado → transferência no Omie (origem → estoque do
  contrato), depois o item segue o fluxo normal.

### 6.5 Retirada e entrega

- O técnico chega; o almox abre o pedido, confere, e o técnico **assina (PIN + traço)**.
- **Manutenção (contrato):** transferência no Omie **estoque do contrato → local da equipe**,
  item a item, com código de integração. O material passa a constar no estoque da equipe, e a
  baixa quando aplicado na OS é feita pelo Field (V1).
- **Obra/Spot:** **saída (baixa) no Omie do BASE** no momento da entrega, com OS e loja na
  observação, porque o material não é aplicado na OS do Field (PDF). O custo fica registrado
  aqui por OS (quantidade × CMC). O Controle de Obras **não é alterado**; poderá ler esse
  custo no futuro.
- Gera o **documento de requisição** (PDF com itens, quantidades, OS, assinatura) — o papel
  assinado de hoje (PDF).
- O registro fica ENTREGUE quando o Omie confirmou todas as gravações; se o Omie falhar, a
  entrega fica registrada como feita fisicamente e a gravação segue na fila (§11.2).

### 6.6 Devolução de sobra

O técnico pede no app "devolver" (itens e quantidades do estoque da equipe). O almox confere
na chegada e confirma; o sistema transfere **local da equipe → estoque do contrato** no Omie.
Assinatura do técnico na devolução.

## 7. Carga do colaborador (ferramentas, equipamentos, EPI, uniforme)

- **Ferramentas e equipamentos (D10):** vivem só aqui; o Omie não fica sabendo.
  **(decisão de desenho)** Itens caros/marcantes (martelete, roçadeira, escada) são
  **rastreados um a um** por patrimônio/etiqueta; os pequenos (chave de fenda, alicate) por
  quantidade. Estados: no almox · com fulano · em conserto · baixado (perdido/quebrado, com
  motivo). Cadastro inicial a partir da planilha atual (importação simples por CSV/planilha).
- **Entrega:** o almox escolhe colaborador e itens; o sistema gera o **termo de
  responsabilidade** (lista, data, valor de cada item, texto de responsabilidade e desconto);
  o colaborador assina (PIN + traço); o PDF fica na ficha. O texto do termo é configuração
  (o Jose/RH revisam o texto jurídico).
- **Devolução** (frequente: o martelete volta ao fim da obra): registra estado (ok/danificado);
  danificado pode ir direto para **conserto** (fornecedor, data de saída, previsão, volta).
- **EPI e uniforme (D11):** produtos do Omie cuja família é EPI ou Uniforme. Entrega a uma
  pessoa = **saída no Omie** do estoque de origem (com o nome do colaborador na observação) +
  linha na ficha com assinatura. Não "voltam" ao estoque.
- **Ficha do colaborador:** o que está com ele agora, valor total, histórico, termos assinados.

### 7.1 Desligamento (integração com o RH)

```
RH (sistema do João) ─► pedido de conferência (colaborador, data prevista, quem pediu)
   almox confere a ficha item a item: devolvido ok · devolvido danificado · não devolvido
   ─► resposta ao RH: lista de faltantes/danificados com valor a descontar, termo de devolução assinado
   colaborador bloqueado no portal
```

O sistema de RH é o módulo **RH do hub** (repositório `manfac-facilities/rh`,
`hub.manfac.com.br/rh`), **no mesmo banco**, com `public.rh_colaboradores` (`id uuid`, `cpf`
11 dígitos, `nome`, `cargo`, `tipo_contratacao`, `admissao`, `desligamento date`,
`status in ('ativo','desligado','afastado')`). O fluxo de demissão ainda não existe lá.
**(decisão de desenho)** Mesma regra de "cada um escreve no seu, lê do outro":
- **Cadastro:** `alx_colaboradores` guarda `rh_colaborador_id` (uuid, sem chave estrangeira —
  FK só para `alx_*`) e o almox busca/importa nome e CPF de `rh_colaboradores` (só as colunas
  acima; **nunca** `salario_centavos`). Colaborador sem cadastro no RH também pode existir.
- **Entrada da demissão:** um job do almox (de hora em hora) lê `rh_colaboradores` e, quando um
  colaborador ligado passa a ter `desligamento` preenchido ou `status = 'desligado'`, abre a
  conferência em `alx_desligamentos`, bloqueia o portal na data e avisa o almox por e-mail.
- **Resposta ao RH:** situação (aguardando conferência / conferido), itens faltantes e
  danificados com valor, PDF. O RH lê de `alx_desligamentos` (+ itens) por uma view/função de
  leitura que o almox expõe; a tela no RH é uma **mudança no repositório do RH** (fase 6),
  pequena: mostrar a conferência do almox na ficha do colaborador.
- O almox também abre a conferência à mão (ex.: colaborador sem RH) e baixa o PDF.

## 8. Recebimento de compras (D13, D14)

- **Agenda de entregas:** por dia, os pedidos do Compras com entrega na Base em aberto, pela
  `cmp_pedidos.previsao_entrega` (lida do banco). Mudou no Compras, muda aqui. Atrasados em
  destaque.
- **Conferência contra o pedido:** o almox abre o pedido (itens de `cmp_pedido_itens`) e
  confere item a item: quantidade recebida, item errado, avaria, observação, foto opcional.
  Grava em `alx_recebimentos`.
- **Ligação com o Compras (decisão de desenho):** a conferência do almox substitui o botão
  ok/divergência do Compras para entrega na Base: o Compras passa a ler `alx_recebimentos` e
  avança o próprio pedido (ok → segue para NF; divergência → DIVERGÊNCIA no Compras). Isso é
  uma **mudança no repositório do Compras**, entregue junto (§15, fase 4).
- **Entrada no Omie:** não é do almox. Lista "conferido pelo almox, falta entrada no Omie"
  (pedido conferido sem movimento `COM` correspondente no Omie há X dias), visível ao compras
  e ao almox, com a quantidade que de fato chegou.
- **Requisição de estoque do Compras:** a solicitação de compra que decidiu "vem do estoque"
  (`cmp_solicitacoes` com requisição de estoque) aparece aqui como pedido a separar, no lugar
  do e-mail. O Compras deixa de mandar o e-mail quando o almox estiver no ar (configuração no
  Compras). **(decisão de desenho)** Esse pedido não passa de novo por aprovação (o Compras já
  decidiu); vai direto para separação, sai do local que o Compras indicou na checagem de
  estoque, e o solicitante (usuário do hub) confirma a retirada com a sessão do hub, sem PIN.
  Movimento no Omie: transferência se o destino é uma equipe; senão saída com o CC/OS da
  solicitação na observação. Em `alx_pedidos`, o solicitante é colaborador **ou** e-mail do hub.
- **Para qual estoque entra cada compra (decisão de desenho):** "Em compra" e a sugestão de
  reposição usam o estoque de destino do pedido do Compras, derivado do centro de custo da
  solicitação por um mapa CC → estoque na configuração do almox. Sem mapa, conta no BASE.

## 9. Posição de estoque, mínimos e reposição

### 9.1 Tela de posição (`/almox/estoque`)

- **Topo:** valor em estoque, itens abaixo do mínimo, divergências abertas, retiradas de hoje
  (quantas separadas), entregas de fornecedor de hoje.
- **Tabela:** uma linha por produto; colunas Base · DPSP · Profarma · Equipes (soma, abre por
  MANFAC N) · Total · Mínimo por contrato · Valor (saldo × CMC) · **Em compra** (quantidade em
  pedidos do Compras em aberto e a previsão).
- **Filtros:** estoque, família, "só abaixo do mínimo", "só com saldo", busca instantânea.
- Produto abre o histórico de movimentações (de `alx_movimentos`) e onde está.
- Exportar Excel existe, mas não é o caminho.
- "Atualizado às hh:mm" sempre visível.

### 9.2 Mínimos e sugestão de reposição (D17)

- Mínimo e **estoque alvo** por produto × estoque de contrato (e BASE). Alvo padrão =
  2 × mínimo **(decisão de desenho)**. Cadastro em tela, com importação por planilha.
- Job diário (e botão "gerar agora"): para cada estoque, itens com saldo abaixo do mínimo →
  quantidade sugerida = alvo − saldo − em compra (se > 0).
- Resultado: **um rascunho por contrato** em `alx_sugestoes_reposicao`, com o centro de custo
  do contrato. O almox revisa (muda quantidade, tira item) e envia ao Compras. O Compras lê as
  sugestões enviadas e abre a solicitação a partir delas (mudança no Compras, fase 4). Nada
  sai sozinho para fornecedor.

## 10. Inventário (D15, D16)

- **Ciclo por estoque** (BASE, DPSP, Profarma, cada equipe; ferramental também). O sistema
  sorteia **ondas de 20 itens** entre os que têm saldo (ou movimento) e ainda não foram contados
  no ciclo. Terminou a onda, a próxima aparece, até cobrir tudo. Aí: **"Inventário físico em
  dia ✓ (dd/mm)"**.
- **Contagem às cegas (decisão de desenho):** quem conta não vê o saldo do sistema.
- **Ciclo novo pelo menos semestral (Jose):** começa sozinho 6 meses após o início do anterior.
  **(decisão de desenho)** Os itens curva A (10% de maior valor) e os que já divergiram entram
  também no meio do ciclo.
- **Equipes:** contagem no mesmo esquema, feita pelo almoxarife com o técnico.
- **Diferença:** contado × saldo do Omie **relido no momento da contagem**. Diferença gera
  ajuste proposto com **motivo da lista fixa** (perda, quebra, erro de lançamento, devolução não
  registrada, consumo não apontado, …) e botão "novo motivo" (entra para todos, registra quem
  criou) **(Jose)**.
- **Aprovação só por admin (Jose)**: tela com local, produto, Omie, contado, diferença, valor,
  motivo; aprova/recusa em lote. Aprovado → ajuste no Omie com motivo e nº da contagem na
  observação.

## 11. Integração com o Omie

### 11.1 Leitura

| Dado | Chamada | Frequência |
|---|---|---|
| Locais | `estoque/local` `ListarLocaisEstoque` | 1 h |
| Produtos (família, CMC, ativo) | `geral/produtos` `ListarProdutos` (como o catálogo do Compras) | 1 h |
| Posição | `estoque/consulta` `ListarPosEstoque` por local, `cExibeTodos = "N"` | 10 min |
| Movimentações | `estoque/consulta` `ListarMovimentoEstoque` **com** `codigo_local_estoque`, janelas ≤ 1 mês | 1 h (incremental) |
| Ajustes (origem, `imp_api`) | `estoque/ajuste` `ListarAjusteEstoque` (só paginação) | se necessário para indicadores |

### 11.2 Gravação

| Movimento | Quando | Chamada (a validar, V2) |
|---|---|---|
| Transferência contrato → equipe | entrega de pedido de manutenção | `estoque/ajuste` `IncluirAjusteEstoque` tipo TRF com local de destino |
| Transferência entre estoques | D4 decidido pelo almox | idem |
| Transferência equipe → contrato | devolução de sobra | idem |
| Saída do BASE | entrega de Obra/Spot | `IncluirAjusteEstoque` tipo SAI, OS/loja na `obs` |
| Saída de EPI/uniforme | entrega na ficha | `IncluirAjusteEstoque` tipo SAI, colaborador na `obs` |
| Ajuste de inventário | aprovado pelo admin | `IncluirAjusteEstoque` (ENT/SAI ou SLD), motivo na `obs` |

- **Código de integração** em toda gravação: `HUBALX-<tipo>-<id>` (teste: `HUBALXT-`), dentro do
  limite de caracteres do campo (V2). Antes de repetir uma gravação sem resposta, **consultar
  pelo código** (padrão do Compras: `repetirSemResposta: false` para gravação).
- **Fila:** `alx_tarefas_omie` com trava, até 5 tentativas em erro temporário, depois
  "FALHA NO OMIE" com mensagem traduzida e botão "tentar de novo". Recusa do Omie: falha
  imediata com mensagem traduzida (original no evento).
- **Conferir saldo antes de transferir/baixar** (relendo o Omie): sem saldo → a tarefa falha
  com aviso claro ao almox, nada é gravado.
- Erro do banco nunca vai para a tela; funções retornam `ActionResult`; trava para a pessoa:
  `ALX_GUARD:`.

## 12. Indicadores (`/almox/indicadores`)

Filtro por estoque e período; limites "X dias" em configuração; histórico mensal gravado a
partir do go-live (`alx_indicadores_mensais`).

| Grupo | Indicador | Cálculo |
|---|---|---|
| Estoque | Valor por local | Σ saldo × CMC |
| | **Giro** | saídas (valor) no período ÷ estoque médio (valor) no período |
| | **Cobertura (dias)** | saldo ÷ consumo médio diário (últimos 90 dias) |
| | **Estoque parado** | itens sem saída há ≥ X dias (padrão 90 e 180), com valor imobilizado |
| | **Curva ABC** | classificação por valor consumido no período (A ≈ 80% do valor) |
| | Ruptura | itens pedidos que estavam sem saldo no contrato (com e sem transferência) |
| Atendimento | Tempo até aprovação; % aprovado até 16h | por aprovador e contrato |
| | **% separado antes do técnico chegar** | separado antes da retirada ÷ entregues |
| | % emergencial | por equipe e aprovador |
| | Inteiro × parcial × recusado | por pedido |
| | Não retirado no dia | por equipe |
| Acuracidade | % itens contados sem diferença | por ciclo e estoque |
| | Valor ajustado por motivo, por mês | de `alx_ajustes` aprovados |
| | Andamento do ciclo | contados ÷ total, data prevista de fim |
| Equipes | Consumo por equipe | saídas automáticas (Field) do local da equipe, em valor |
| | **Aplicação fora do contrato** | material da equipe aplicado em OS de cliente de outro contrato (V9) |
| | **Material parado na equipe** | saldo na equipe sem saída há ≥ X dias |
| Ferramental | Valor em campo; em conserto há ≥ X dias; perdas e descontos | de `alx_cargas`/`alx_consertos`/`alx_desligamentos` |
| Recebimento | Entrega no prazo do fornecedor; divergência no recebimento; conferido sem entrada no Omie há ≥ X dias | `cmp_pedidos` + `alx_recebimentos` + movimentos `COM` |

O "aplicado na OS" vem das saídas automáticas que o Field faz no Omie (V1), não do Cockpit.

## 13. Avisos (D18)

- **E-mail** (SMTP como o Compras; remetente a definir, ex. `almox@`) para usuários do hub:
  pendência de aprovação, separado (OK), emergencial, falha no Omie, desligamento a conferir,
  ajuste a aprovar, sugestão de reposição pronta. Um e-mail agrupado por pessoa nos lembretes
  periódicos; pontuais na hora.
- **Alerta no app do técnico:** contador e faixa no topo ao abrir (não aprovado a tempo,
  aprovado, separado, recusado, item aguardando transferência, não retirado).
- **(decisão de desenho)** Os avisos passam por um ponto central com "canais"
  (`email`, `app`); o WhatsApp entra depois como mais um canal sem mudar quem avisa.
- Aviso fixo ao gestor/admin na tela inicial: "Fase 2 pendente: aba Operação no Cockpit
  (custo de material por loja)" até alguém marcar como feito (D20).

## 14. Ambiente de teste e itens a validar

**Só existe uma chave do Omie (produção).** **(decisão de desenho)** O ambiente
`/almox-teste` (`ALX_AMBIENTE=teste`, mesmo banco, dados com `ambiente = teste`) roda com a
**gravação no Omie em modo simulado**: a tarefa monta o corpo, registra "seria enviado" e não
chama o Omie. Leitura do Omie de produção é permitida. **Qualquer gravação real no Omie de
produção para teste precisa de autorização do Jose na hora** (regra 4 do Compras), com
movimento de quantidade mínima e o estorno combinado. Rodar local grava no banco de verdade e
a tela logada não abre em `localhost`.

| # | Validar | Se a resposta for ruim |
|---|---|---|
| V1 | **As saídas automáticas nas equipes são do Field?** Pegar uma OS com material no Field (API `GET /orders/:id/materials` ou produtos da OS, com a chave do cofre) e achar a saída correspondente no local da equipe no Omie (data, produto, quantidade) | Se o Field **não** baixa no Omie: o almox precisa ler o material aplicado nas OS do Field e dar a baixa ele mesmo (job novo); avisar o Jose antes de seguir a fase 2 |
| V2 | Formato do `IncluirAjusteEstoque` para TRF (campo do local de destino), SAI e SLD; tamanho do `cod_int_ajuste`; consulta por código de integração | Transferência como SAI + ENT pareadas com o mesmo código-base |
| V3 | **Em que sentido a integração Omie ↔ Field propaga transferências?** Testar (com o Jose, quantidade mínima): (a) transferência só no Omie aparece no depósito da equipe no Field? (b) transferência só no Field (`POST /storages-movements-v2` ou `/transfers`) aparece no Omie? | **Movimentar em um lado só**, o que se propaga para o outro, para não duplicar **(Jose)**. Se só (b) funcionar, as gravações de transferência do almox passam a ser feitas no Field (que leva ao Omie), com a mesma fila, código externo e conferência no Omie depois. Gravar no Field está **permitido** para isso **(Jose)** |
| V4 | `ListarPosEstoque` devolve CMC por produto (`nCMC`) em todos os locais? | Pegar CMC do cadastro |
| V5 | Paginação: posição com mais de 100 produtos por local (o BASE tem 102) | Paginar sempre até `nTotPaginas` (o código do Compras já faz) |
| V6 | Como identificar o movimento `COM` de um pedido do Compras (nº do pedido no movimento: `numPedido`, `idDoc`) | Casar por produto + data + quantidade, com conferência manual |
| V7 | Usar a mesma chave Omie do Compras ou uma própria (limite compartilhado) | Mesma chave, jobs em minutos diferentes |
| V8 | ~~Onde mora o RH~~ — resolvido: módulo RH no mesmo banco (`rh_colaboradores`), ver §7.1. Validar só se o RH preenche `desligamento` antes da saída efetiva | Se preencher só depois: o almox abre à mão quando o RH avisar |
| V9 | Como ligar uma saída automática do Field no Omie à OS e ao cliente (para "aplicação fora do contrato") | Cruzar por equipe + produto + data com o material das OS no Field; se não der, o indicador fica para a fase do Cockpit |

## 15. Ordem de entrega

| Fase | Entrega |
|---|---|
| 1 | **Base + visibilidade:** repositório, porteiro, banco com teste de segurança, papéis, configurações versionadas, contratos/equipes/estoques, cópia do Omie (produtos, locais, posição, movimentações), **tela de posição de estoque**, mínimos e estoque alvo. Resolve o "Excel" primeiro. Validar V1, V4, V5 |
| 2 | **Pedido do técnico:** cadastro de colaboradores, portal (convite, PIN, sessão), busca, carrinho, data de retirada, aprovação, alertas, separação, retirada com assinatura, documento de requisição, transferência no Omie (fila). Validar V2, V3 antes |
| 3 | **Exceções do pedido:** Obra/Spot com baixa no BASE e custo por OS, OS múltiplas, emergencial, transferência entre estoques (D4), devolução de sobra, não retirado |
| 4 | **Compras:** agenda de entregas, conferência de recebimento, "falta entrada no Omie", requisição de estoque do Compras, sugestão de reposição. **Inclui as mudanças no repositório do Compras** (ler `alx_recebimentos` e `alx_sugestoes_reposicao`, desligar o e-mail de requisição) |
| 5 | **Inventário:** ciclos, ondas, contagem às cegas, motivos, aprovação do admin, ajuste no Omie |
| 6 | **Carga do colaborador:** ferramentas, importação da planilha, termo assinado, devolução, conserto, EPI/uniforme, ficha, desligamento lido de `rh_colaboradores`. **Inclui a mudança no repositório do RH** (mostrar a conferência do almox na ficha) |
| 7 | **Indicadores** e histórico mensal |
| — | **Virada:** segredos, papéis e aprovadores cadastrados, técnicos convidados, card "Almoxarifado" no hub (`login-system/lib/sistemas.ts`), dados de teste apagados, avisar as equipes que o pedido sai do Field |
| Próximo projeto | **Aba "Operação" no Cockpit** (D20): estoque das equipes em tempo real (lendo `alx_saldos`) e custo de material aplicado por loja (material das OS do Field × CMC), ranking de lojas, cruzamento com receita por loja |

## 16. Fora de escopo (por enquanto)

- WhatsApp por API (desejo; entra como canal novo).
- Notificação push no celular.
- Contas a pagar / lançamento de boleto da NF faturada (outra conversa).
- Aba "Operação" do Cockpit (próximo projeto).
- Qualquer escrita no Controle de Obras, Financeiro ou Cockpit. No Field, só as
  transferências de estoque, e só se o V3 mostrar que é o lado que propaga.
- Leitor de código de barras/QR (as etiquetas de patrimônio podem ter QR no futuro).

## 17. Riscos aceitos

- **Banco compartilhado:** mitigado pelas travas e pelo teste de segurança.
- **O app grava no Omie de produção** a cada entrega, devolução e ajuste: código de integração,
  consulta antes de repetir, saldo relido antes de gravar.
- **Sem Aplicativo de Teste do Omie:** teste em modo simulado; gravação real só com o Jose.
- **Cópia do estoque com até 10 min de atraso:** a tela diz a hora; gravações releem o Omie.
- **Dependência da integração Field → Omie** para o estoque da equipe "em tempo real" (V1).
- **Assinatura por PIN + traço** é registro interno, não assinatura digital ICP-Brasil; o
  termo traz quem, quando, IP/aparelho e o PDF fica guardado.
- **Leitura de `cmp_*` e `obras_obra`** acopla aos esquemas desses módulos; ler só as colunas
  necessárias e guardar foto do que importa.


---

# PARTE B — PLANO DE IMPLEMENTAÇÃO

# Almoxarifado — Plano de Implementação (sistema completo)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir e publicar o módulo Almoxarifado do hub Manfac (`hub.manfac.com.br/almox`) inteiro — as 7 fases e a virada descritas no desenho.

**Architecture:** App Next.js próprio no molde do Compras, no banco compartilhado do hub (tabelas `alx_*`), lendo e gravando estoque no Omie pela API (Omie é a fonte da verdade), com um portal do técnico sem conta do hub (link + PIN) e integrações por leitura com Compras (`cmp_*`), RH (`rh_*`) e Controle de Obras (`obras_obra`).

**Tech Stack:** Next.js 16 (App Router, `proxy.ts`, `basePath: "/almox"`), TypeScript strict, Supabase (Postgres + pg_cron + pg_net + vault + storage), Zod 4, React Hook Form, shadcn/ui base-nova, Tailwind 4, Vitest, PGlite, Biome, nodemailer. Publicação no EasyPanel.

**Spec:** `docs/superpowers/specs/2026-11-11-almoxarifado-design.md` — leia inteiro antes de começar. Este plano argumenta a partir dele; quando o plano citar "§N", é a seção N do desenho.

---

## 0. Para o João — leia primeiro

**Escopo: o sistema inteiro.** Tudo que está no desenho é para ser implementado e colocado no
ar: fases 1 a 7 e a virada. A divisão em fases é **ordem de entrega**, não corte de escopo.
Cada fase termina publicada e conferida (dá para o almox começar a usar o que já está pronto),
mas o trabalho só está concluído quando todas as fases e a virada estiverem no ar. A única
coisa fora deste projeto é a aba "Operação" do Cockpit (próximo projeto, D20), e mesmo ela
ganha um lembrete dentro do sistema (Task 33).

**Seus acessos.** Você tem acesso ao **Supabase do hub** (projeto `iyytcavcgukfjnjjrerx`) e ao
**GitHub da organização `manfac-facilities`, com todos os repositórios**. Use isso: quando o
plano mandar "copiar do Compras", ou quando ficar em dúvida sobre como algo já foi feito,
**abra o repositório de referência e leia o código de lá** antes de inventar. Os repositórios
que importam:

| Repositório | O que tem para este projeto |
|---|---|
| `manfac-facilities/compras` | **O molde.** Porteiro, sessão, papéis, configurações versionadas, cliente do Omie, posição de estoque, catálogo, fila de gravação no Omie, avisos/SMTP, lembretes, teste de segurança da instalação, PGlite, EasyPanel (`docs/deploy-easypanel.md`), manual (`docs/cliente/`). Também é onde este desenho e este plano estão. E é um dos repositórios que **este projeto altera** (Task 26) |
| `manfac-facilities/financeiro` | Origem do molde do Compras; útil quando o Compras disser "portado do Financeiro" |
| `manfac-facilities/dashboard-manutencao` | O Cockpit. **Portal do fornecedor** (`src/lib/portal/*`, migração `20261012190000_portal_fornecedor.sql`, spec `docs/superpowers/specs/2026-10-12-portal-fornecedor-design.md`) = base do portal do técnico. Cliente da API do Field (`supabase/functions/sync/field-client.ts`) e a documentação da API do Field (`Field Control API - Documentação.pdf` na raiz). A `FIELD_API_KEY` válida está no cofre/segredos do Supabase do Cockpit |
| `manfac-facilities/rh` | Módulo RH: `rh_colaboradores` (cadastro, `desligamento`, `status`). **Este projeto altera** (Task 31) |
| `manfac-facilities/login-system` | O hub: login, `hub_user_roles`, cards dos sistemas (`lib/sistemas.ts`), Controle de Obras (`app/obras`, tabela `obras_obra`) |

**Regras que não se quebram** (as mesmas do Compras, com o prefixo deste módulo):
1. O banco é **compartilhado** com Sofia, Conversor OS, Cockpit, CRM, Controle de Obras,
   Financeiro, Compras e RH. Nunca `drop extension` (o `pg_net` sustenta o Cockpit), nunca
   `auth.users`, nunca permissão de alcance global, nunca escrever fora de `alx_*`. O teste de
   segurança da instalação trava isso — se ficar vermelho, não force.
2. SQL novo só em `supabase/hub-install/NNN_alx_*.sql`, aplicado à mão no SQL Editor, só o
   arquivo novo; depois `npm run types` e commit do SQL junto com `types/supabase.ts`.
   Depois de aplicar, confira que o Cockpit segue sincronizando
   (`select resource, started_at, success from public.v_sync_health order by resource;`).
3. **Só existe uma chave do Omie, a de produção.** Toda gravação real no Omie para teste
   precisa de autorização do Jose Guilherme na hora. Em `/almox-teste` a gravação é simulada
   (Task 18). Leitura do Omie de produção é livre.
4. Rodar local grava no banco de verdade e a tela logada não abre em `localhost`. Confira
   telas no `/almox-teste` publicado.
5. Antes de dizer "feito" em qualquer task: `npx tsc --noEmit`, `npm run test`, `npm run build`
   verdes. Não afirme que uma tela funciona sem tê-la visto publicada.
6. Segredos só no EasyPanel e no cofre do Supabase, nunca em código, log, commit ou conversa.

**Como trabalhar.** Uma branch/PR por fase. Ao fim de cada fase: SQL aplicado, tipos
regenerados, deploy em `/almox-teste`, conferência visual, deploy em `/almox`. Os itens
"a validar" (V1–V9, §14 do desenho) estão encaixados nas tasks que dependem deles; quando a
resposta for ruim, siga o fallback do desenho e registre o resultado em
`docs/validacoes.md` do repositório novo.

---

## Global Constraints

- Prefixos: tabelas `alx_*`; funções SQL `almox_*`/`alx_*`; jobs `almox-*`; pasta de arquivos `almox-arquivos`; segredos do cofre `almox_<ambiente>_*`.
- `basePath: "/almox"` (produção) e `/almox-teste` (teste), `ALX_AMBIENTE=producao|teste`; toda tabela de dados tem `ambiente`.
- RLS em toda tabela (nunca `force`); `revoke all ... from anon, authenticated` em toda tabela nova; policies com `(select public.almox_...())`; `security definer` com `set search_path = public, pg_temp` e `set row_security = off`; FK só para `public.alx_*`.
- Pode ler (nunca escrever): `cmp_pedidos`, `cmp_pedido_itens`, `cmp_solicitacoes`, `cmp_solicitacao_itens`, `rh_colaboradores` (sem `salario_centavos`), `obras_obra`, `hub_user_roles`.
- Funções do servidor retornam `ActionResult`; erro do banco nunca vai para a tela; trava de regra no banco começa com `ALX_GUARD:`.
- Configuração nunca é editada nem apagada: salvar grava linha nova em `alx_configuracoes`.
- Toda decisão manda o `atualizado_em` que a tela mostrou; o banco recusa se mudou.
- Fuso: todas as regras de horário em `America/Sao_Paulo`, nunca no fuso do servidor.
- Omie: chamadas em sequência (nunca em paralelo); código de integração `HUBALX-` (produção) / `HUBALXT-` (teste) em toda gravação; `repetirSemResposta: false` em gravação.
- Texto de tela e mensagens em PT-BR coloquial; nomes do domínio no código em português, iguais aos do banco (`pedido`, `colaborador`, `equipe`, `contrato`, `estoque`, `contagem`, `ajuste`, `carga`).
- shadcn base-nova: `render={<X />}`, não `asChild`; `<Select>` com `items`.

## Review Focus

1. **Corte das 16h e fuso:** pedido aprovado às 15:59 × 16:01, sexta 16:30 (→ terça), véspera de feriado, servidor em UTC — a data de retirada tem que sair igual à do relógio de São Paulo. Teste na Task 11.
2. **Dois aprovadores (ou aprovador e técnico cancelando) no mesmo pedido ao mesmo tempo:** o segundo recebe "o pedido mudou, recarregue" e nada é gravado em dobro. Teste na Task 12.
3. **Omie sem resposta no meio de uma transferência:** a fila não pode repetir às cegas e duplicar o movimento; consulta pelo código de integração antes de repetir. Teste na Task 18.
4. **Saldo mudou entre a aprovação e a retirada** (o Field baixou, outra entrega saiu): a entrega relê o Omie, o item sem saldo vira entrega parcial com aviso, nunca saldo negativo. Teste na Task 19.
5. **Técnico desligado ou bloqueado com sessão ainda aberta no celular:** a próxima requisição dele é recusada, não só o próximo login. Teste na Task 10.

---

## Estrutura de arquivos (repositório novo `manfac-facilities/almox`)

```
app/
  (modulo)/                 telas do hub (porteiro do hub)
    page.tsx                tela inicial: resumo do dia + pendências do projeto
    estoque/                posição de estoque, mínimos
    pedidos/                fila de aprovação, detalhe, separação, retirada
    transferencias/  devolucoes/  recebimentos/  reposicao/
    inventario/  ajustes/
    colaboradores/  ferramentas/  consertos/  desligamentos/
    indicadores/  papeis/  configuracoes/
  t/                        portal do técnico (fora do porteiro do hub)
    convite/[token]/  entrar/  pedidos/  novo/  devolver/  ficha/
  api/
    tarefas/{copia-estoque,movimentos,catalogo,omie,avisos,indicadores,rh}/route.ts
    health/route.ts
lib/
  action-result.ts  logger.ts  env.ts  hub.ts  dinheiro.ts            (copiados do Compras)
  auth/  supabase/  papeis/  configuracoes/  avisos/                  (copiados e adaptados)
  tempo/            data-civil.ts, dias-uteis.ts, retirada.ts
  busca/            normalizar.ts
  omie/             cliente.ts, paginar.ts, leitura.ts, movimentos.ts, codigos.ts
  field/            cliente.ts (só se V3 exigir)
  copia/            sincronizar.ts (produtos, locais, saldos, movimentos)
  estoque/          posicao.ts, disponivel.ts, em-compra.ts
  portal/           token.ts, pin.ts, sessao.ts, origem.ts
  pedidos/          regras.ts, repositorio.ts, actions.ts, aprovacao.ts, separacao.ts, retirada.ts
  fila/             tarefas.ts, executar.ts
  assinaturas/      registrar.ts
  pdf/              requisicao.ts, termo.ts, desligamento.ts
  obras/            leitura.ts (copiado do Compras)
  transferencias/  devolucoes/  recebimentos/  reposicao/
  inventario/       ondas.ts, ciclo.ts, ajustes.ts
  carga/            ferramentas.ts, cargas.ts, epi.ts, importar.ts
  rh/               leitura.ts, desligamentos.ts
  indicadores/      calculo.ts, montar.ts
supabase/hub-install/  001_alx_acesso_papeis_config.sql … (numeração contínua)
tests/                 um arquivo por módulo de lib; hub-install-safety.test.ts; hub-install-pglite.test.ts
docs/                  validacoes.md, deploy-easypanel.md, cliente/ (manual)
```

---

# FASE 1 — Base e visibilidade do estoque

### Task 1: Repositório, porteiro e trava de segurança

**Files:**
- Create: repositório `manfac-facilities/almox` com a base do Compras: `package.json` (mesmas versões), `next.config.ts` (`basePath` por `ALX_AMBIENTE`), `proxy.ts`, `lib/auth/*`, `lib/supabase/*`, `lib/action-result.ts`, `lib/logger.ts`, `lib/env.ts`, `lib/hub.ts`, `app/layout.tsx`, `app/(modulo)/layout.tsx`, `app/sem-acesso/page.tsx`, `app/api/health/route.ts`, `Dockerfile`, `biome.json`, `vitest.config.mts`, `CLAUDE.md`
- Create: `tests/hub-install-safety.test.ts`, `tests/porteiro.test.ts`, `tests/env.test.ts`
- Copy: `docs/superpowers/specs/2026-11-11-almoxarifado-design.md` e este plano para o repositório novo

**Interfaces:**
- Produces: `decideGate()` com caminho público extra `/t/*` e `/api/tarefas/*` (agendador); `requireSessao(): Promise<{ email: string }>`; `criarClienteServico()` (server-only).

- [ ] **Step 1:** Copiar os arquivos listados do Compras trocando `compras`→`almox`, `cmp_`→`alx_`, `CMP_`→`ALX_`, `HUBCMP`→`HUBALX`. `CLAUDE.md` novo com as regras da seção 0 deste plano.
- [ ] **Step 2: Adaptar o teste de segurança.** Mesma lista `PROIBIDOS` do Compras, trocando os alvos permitidos para `public.alx_*`, `public.almox_*`, jobs `almox-`, pasta `almox-arquivos`; acrescentar casos que **acusam** escrita em `public.cmp_x`, `public.rh_x` e `public.obras_obra`, e um caso que **aceita** `select ... from public.rh_colaboradores`.
- [ ] **Step 3: Teste do porteiro:**

```ts
it("portal do técnico não passa pelo login do hub", () => {
  expect(decideGate({ method: "GET", pathname: "/almox/t/pedidos", hasServerAction: false, hasSession: false, email: null }).type).toBe("allow");
});
it("tela do hub sem sessão vai ao login do hub", () => {
  expect(decideGate({ method: "GET", pathname: "/almox/estoque", hasServerAction: false, hasSession: false, email: null }).type).toBe("hub-login");
});
```

- [ ] **Step 4:** `npm run test` → falha nos dois testes novos; implementar o desvio de `/t/` em `lib/auth/porteiro.ts`; `npm run test` → PASS.
- [ ] **Step 5:** `npx tsc --noEmit && npm run build` verdes. Commit `chore: base do almox a partir do compras`.

### Task 2: Acesso, papéis e configurações (SQL 001)

**Files:**
- Create: `supabase/hub-install/001_alx_acesso_papeis_config.sql`, `lib/papeis/*`, `lib/configuracoes/*`, `app/(modulo)/papeis/`, `app/(modulo)/configuracoes/`
- Test: `tests/hub-install-pglite.test.ts`, `tests/papeis-concessao.test.ts`, `tests/configuracoes-montar.test.ts`

**Interfaces:**
- Produces (SQL): `almox_current_email()`, `almox_is_admin()` (admin do hub **ou** papel `admin` em `alx_papeis`), `almox_tem_papel(papel text)`, `almox_aprova_contrato(contrato_id uuid)`, `almox_has_access()`.
- Produces (TS): `type Papel = "aprovador" | "almoxarife" | "gestor" | "admin"`; `lerConfiguracao<K extends ChaveConfig>(db, chave: K, ambiente, em?: Date): Promise<ValorConfig[K]>`.
- Tabelas: `alx_papeis(user_email, papel, contrato_id null, concedido_por, ativo, …)`, `alx_configuracoes(chave, valor jsonb, ambiente, vigente_desde, alterado_por)`, `alx_eventos(entidade, entidade_id, tipo, autor, de, para, dados jsonb, criado_em)` — sem update/delete para ninguém.

- [ ] **Step 1: Testes PGlite** (padrão de `tests/hub-install-pglite.test.ts` do Compras: aplica `001` sobre stubs de `auth.jwt()` e `hub_user_roles`):
  - `aprovador do DPSP aprova DPSP e não Profarma` → `almox_aprova_contrato(dpsp)=true`, `(profarma)=false`.
  - `gestor aprova qualquer contrato` → true para ambos.
  - `configuração não se edita: update em alx_configuracoes falha` e `vale a última linha até o momento`.
- [ ] **Step 2:** Rodar → FAIL. Escrever o SQL. Rodar → PASS.
- [ ] **Step 3: Chaves de configuração** (`lib/configuracoes/definicoes.ts`, com valor padrão e validação Zod): `janela_retirada` = `{ dias: [1,2,3,4,5], ate: "10:00", corte_aprovacao: "16:00", antecedencia_antes_corte: 1, antecedencia_depois_corte: 2 }`; `feriados` = `string[]` (`AAAA-MM-DD`); `lembrete_aprovador` = `{ pendente_horas_uteis: 2, aviso_antes_corte: "15:00" }`; `divergencia_equipe` = `{ fator: 1 }` (alerta se equipe já tem ≥ fator × pedido); `alvo_padrao_fator` = `2`; `estoque_parado_dias` = `[90, 180]`; `material_parado_equipe_dias` = `30`; `conserto_atrasado_dias` = `30`; `sem_entrada_omie_dias` = `3`; `onda_tamanho` = `20`; `ciclo_meses` = `6`; `curva_a_percentual` = `10`; `cc_para_estoque` = `Record<string, estoqueId>`; `termo_texto` = texto do termo; `pin_falhas_bloqueio` = `5`, `pin_bloqueio_minutos` = `15`; `sessao_dias` = `90`; `convite_dias` = `7`.
- [ ] **Step 4:** Telas de papéis (aprovador pede contrato) e configurações, copiadas do Compras. Teste `papeis-concessao`: `aprovador sem contrato é recusado`.
- [ ] **Step 5:** tsc/test/build; aplicar o 001 no SQL Editor; `npm run types`; commit `feat: papéis e configurações do almox (001)`.

### Task 3: Estoques, contratos e equipes (SQL 002)

**Files:**
- Create: `supabase/hub-install/002_alx_estrutura.sql`, `lib/estrutura/{queries,actions}.ts`, `app/(modulo)/configuracoes/estrutura/`
- Test: `tests/hub-install-pglite.test.ts` (casos novos), `tests/estrutura-actions.test.ts`

**Interfaces:**
- Tabelas: `alx_estoques(id, ambiente, omie_local_codigo bigint, codigo, descricao, tipo check in ('base','contrato','equipe','conserto'), ativo)`; `alx_contratos(id, nome, estoque_id, centro_custo, eh_obras_spot bool)`; `alx_equipes(id, nome, estoque_id, contrato_id not null, field_storage_external_id null, ativa)`.
- Produces: `listarEstrutura(db, ambiente): Promise<{ estoques; contratos; equipes }>`.

- [ ] **Step 1: Teste PGlite** `equipe sem contrato é recusada` (D22: um contrato por equipe) e `existe no máximo um contrato com eh_obras_spot`.
- [ ] **Step 2:** FAIL → SQL → PASS.
- [ ] **Step 3:** Tela "Estrutura": importa os locais do Omie (Task 4 produz a lista em `alx_omie_locais`), o admin marca o tipo de cada um e liga equipe → contrato. Valores medidos para conferir (§2 do desenho): BASE `10152414293`, DPSP `10167614709`, PROFARMA `10167614993`, equipes `MANFAC 1…MANFAC-25`.
- [ ] **Step 4:** tsc/test/build; aplicar; types; commit.

### Task 4: Cópia do Omie — produtos, locais, saldos e movimentos (SQL 003–004)

**Files:**
- Create: `lib/omie/{cliente,paginar}.ts` (copiar do Compras), `lib/omie/leitura.ts`, `lib/copia/sincronizar.ts`, `app/api/tarefas/{catalogo,copia-estoque,movimentos}/route.ts`, `supabase/hub-install/003_alx_copia_omie.sql`, `supabase/hub-install/004_alx_agendador_copia.sql`, `scripts/sondar-estoque.mjs` (só leitura)
- Test: `tests/omie-cliente.test.ts` (copiar), `tests/omie-leitura.test.ts`, `tests/copia-sincronizar.test.ts`

**Interfaces:**
- Tabelas: `alx_omie_locais`, `alx_produtos(omie_codigo bigint, codigo, descricao, unidade, familia, cmc, ativo, busca text)`, `alx_saldos(estoque_id, produto_id, saldo numeric(14,3), cmc, lido_em)`, `alx_movimentos(omie_id_mov unique, estoque_id, produto_id, data, tipo, origem, qtde, valor, imp_api, cod_int)`, `alx_sincronizacoes(tipo, inicio, fim, ok, resumo)`.
- Produces: `lerPosicaoDoLocal(omie, localCodigo: number, data: DataCivil): Promise<Map<number, { saldo: number; cmc: number }>>`; `lerMovimentosDoLocal(omie, localCodigo, de: DataCivil, ate: DataCivil): Promise<MovimentoOmie[]>`; `sincronizarSaldos(deps): Promise<ResumoSinc>`; `sincronizarMovimentos(deps): Promise<ResumoSinc>`; `sincronizarProdutos(deps): Promise<ResumoSinc>`.

- [ ] **Step 1: Testes com respostas gravadas** (quirks medidos em 10/11, §2):
  - `lerMovimentosDoLocal sempre manda codigo_local_estoque` (sem ele o Omie só devolve o BASE).
  - `lerMovimentosDoLocal quebra o período em janelas de até 31 dias` (período de 90 dias → 3 chamadas).
  - `"Não existem registros" na página 1 é lista vazia, não erro`.
  - `lerPosicaoDoLocal pagina até nTotPaginas` (local com 102 produtos → 2 páginas de 100).
  - `sincronizarSaldos: falha num local não apaga os saldos daquele local` (mantém a última cópia e marca a sincronização com erro).
  - `sincronizarSaldos chama os locais em sequência` (nenhuma chamada começa antes da anterior terminar).
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Rotas do agendador protegidas por segredo (padrão `app/api/tarefas/catalogo` do Compras). `004` agenda no padrão `005_cmp_agendador_catalogo.sql`: `almox-<amb>-copia-estoque` a cada 10 min (minutos 3,13,23…), `almox-<amb>-movimentos` de hora em hora no minuto 41, `almox-<amb>-catalogo` no minuto 52 (fora dos minutos do Compras, V7).
- [ ] **Step 4: V4 e V5.** Rodar `scripts/sondar-estoque.mjs` (só leitura) e registrar em `docs/validacoes.md`: `nCMC` vem em todos os locais? quantos produtos tem o maior local?
- [ ] **Step 5:** tsc/test/build; aplicar 003 e 004 (segredos no cofre pelo Jose); types; commit.

### Task 5: Busca instantânea

**Files:**
- Create: `lib/busca/normalizar.ts`
- Test: `tests/busca-normalizar.test.ts`

**Interfaces:**
- Produces: `normalizarBusca(texto: string): string` (minúsculas, sem acento, espaços colapsados); `casaBusca(termo: string, textoNormalizado: string): boolean` (todo pedaço do termo aparece no texto); `filtrarProdutos<T extends { busca: string }>(lista: T[], termo: string): T[]`.

- [ ] **Step 1: Testes:**

```ts
expect(casaBusca("disj 20", normalizarBusca("Disjuntor DIN 20A curva C"))).toBe(true);
expect(casaBusca("LAMPADA", normalizarBusca("Lâmpada LED 9W"))).toBe(true);
expect(casaBusca("disj 32", normalizarBusca("Disjuntor DIN 20A curva C"))).toBe(false);
expect(filtrarProdutos(lista, "")).toEqual(lista);
```

- [ ] **Step 2:** FAIL → implementar → PASS. `alx_produtos.busca` é preenchido com `normalizarBusca(codigo + " " + descricao)` na Task 4.
- [ ] **Step 3:** Commit.

### Task 6: Tela de posição de estoque + "Em compra"

**Files:**
- Create: `lib/estoque/posicao.ts`, `lib/estoque/em-compra.ts`, `app/(modulo)/estoque/page.tsx` (+ componentes), `app/(modulo)/estoque/[produto]/page.tsx`
- Test: `tests/estoque-posicao.test.ts`, `tests/estoque-em-compra.test.ts`

**Interfaces:**
- Consumes: `alx_saldos`, `alx_produtos`, `alx_estoques`, `alx_movimentos`; leitura de `cmp_pedidos`/`cmp_pedido_itens`/`cmp_solicitacoes`; config `cc_para_estoque`.
- Produces: `montarPosicao(linhas, estrutura): LinhaPosicao[]` com `{ produto, familia, porEstoque: Record<estoqueId, number>, equipes: number, total, valor, minimos, emCompra: { quantidade, previsao } | null }`; `emCompraPorEstoque(pedidosAbertos, ccParaEstoque, baseId): Map<string /*produto:estoque*/, { quantidade: number; previsao: string | null }>`.

- [ ] **Step 1: Testes:**
  - `valor = saldo × cmc somado em todos os estoques`.
  - `equipes somam todos os locais tipo equipe`.
  - `em compra usa o CC da solicitação para achar o estoque; sem mapa conta no BASE`.
  - `pedido do Compras concluído ou cancelado não conta em compra`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Tela** (§9.1): números do topo (valor, abaixo do mínimo, divergências abertas, retiradas hoje com separadas, entregas de fornecedor hoje), tabela com colunas Base · DPSP · Profarma · Equipes (expande por equipe) · Total · Mínimo · Valor · Em compra; filtros estoque, família, "só abaixo do mínimo", "só com saldo", busca (Task 5, filtrando no navegador); "Atualizado às hh:mm" lido de `alx_sincronizacoes`; exportar Excel (CSV). Detalhe do produto: onde está + histórico de `alx_movimentos`. Os números que dependem de fases seguintes mostram 0 até existirem.
- [ ] **Step 4:** tsc/test/build; deploy `/almox-teste`; conferir a tela publicada contra o Omie em 3 produtos; commit.

### Task 7: Mínimos e estoque alvo (SQL 005)

**Files:**
- Create: `supabase/hub-install/005_alx_minimos.sql`, `lib/estoque/minimos.ts`, `app/(modulo)/estoque/minimos/`
- Test: `tests/estoque-minimos.test.ts`, PGlite

**Interfaces:**
- Tabela: `alx_minimos(estoque_id, produto_id, minimo, alvo null, vigente_desde, alterado_por)` — versionada como configuração (linha nova a cada mudança).
- Produces: `minimoVigente(db, estoqueId, produtoId, em?: Date)`; `alvoEfetivo(minimo: number, alvo: number | null, fator: number): number` (alvo informado ou `minimo × fator`); `importarMinimos(csv: string): { linhas; erros: { linha: number; motivo: string }[] }`.

- [ ] **Step 1: Testes:** `alvoEfetivo(10, null, 2) === 20`; `alvoEfetivo(10, 15, 2) === 15`; `importar recusa produto desconhecido e mínimo negativo, apontando a linha`; PGlite `mínimo vigente é a última linha até o momento`.
- [ ] **Step 2:** FAIL → implementar → PASS. Tela de cadastro e importação; a posição (Task 6) passa a pintar vermelho (abaixo do mínimo) e amarelo (até 20% acima).
- [ ] **Step 3:** aplicar; types; deploy; **publicar a fase 1 em `/almox`**; commit.

### Task 8: Validação V1 — o Field baixa no Omie?

**Files:**
- Create: `scripts/sondar-field-omie.mjs` (só leitura), `docs/validacoes.md`

- [ ] **Step 1:** Com a `FIELD_API_KEY` válida (segredos do Supabase do Cockpit), pegar 5 OS concluídas recentes com material (`GET /orders/:id/materials` ou produtos da OS) de equipes diferentes; para cada uma, procurar no local da equipe no Omie (`ListarMovimentoEstoque` com o local) uma saída com mesmo produto, quantidade e data próxima; ver em `ListarAjusteEstoque` se é `imp_api = S`.
- [ ] **Step 2:** Registrar em `docs/validacoes.md`: como casa (produto do Field ↔ produto do Omie: código/externalId), atraso típico, se a OS/cliente aparece em algum campo (serve ao V9).
- [ ] **Step 3: Se o Field não baixa no Omie:** parar e avisar o Jose antes da fase 2 (o desenho manda acrescentar um job de baixa). Se baixa: seguir. Commit.

---

# FASE 2 — Pedido do técnico

### Task 9: Colaboradores e acesso do portal (SQL 006)

**Files:**
- Create: `supabase/hub-install/006_alx_colaboradores_portal.sql`, `lib/portal/{token,pin}.ts`, `lib/colaboradores/{queries,actions}.ts`, `lib/rh/leitura.ts`, `app/(modulo)/colaboradores/`
- Test: `tests/portal-token.test.ts`, `tests/portal-pin.test.ts`, `tests/colaboradores-actions.test.ts`, PGlite

**Interfaces:**
- Tabelas: `alx_colaboradores(id, nome, celular, cpf, rh_colaborador_id uuid null, equipe_id null, ativo, desligado_em null)`; `alx_acessos(colaborador_id pk, pin_hash, falhas_seguidas, bloqueado_ate, bloqueado_manual bool)`; `alx_convites(token_hash unique, colaborador_id, expira_em, usado_em)`; `alx_sessoes(token_hash unique, colaborador_id, expira_em, ip, user_agent)`. Todas sem grant para `authenticated` (só service role, como o portal do fornecedor).
- Produces: `novoToken(): { token: string; hash: string }`; `hashToken(t: string): string` (SHA-256); `hashPin(pin: string): Promise<string>` (scrypt, sal aleatório); `conferirPin(pin, hash): Promise<boolean>`; `pinValido(pin: string): boolean` (4–6 dígitos); `proximoEstadoDeFalha(falhas: number, agora: Date, cfg): { falhas: number; bloqueadoAte: Date | null }`; `buscarNoRh(db, termo): Promise<{ id; nome; cpf; cargo; status }[]>` (lê só essas colunas de `rh_colaboradores`).

- [ ] **Step 1: Testes:**

```ts
expect(pinValido("1234")).toBe(true); expect(pinValido("123")).toBe(false); expect(pinValido("12a4")).toBe(false);
expect(await conferirPin("4321", await hashPin("4321"))).toBe(true);
const e = proximoEstadoDeFalha(4, new Date("2026-11-12T13:00:00Z"), { pin_falhas_bloqueio: 5, pin_bloqueio_minutos: 15 });
expect(e.bloqueadoAte?.toISOString()).toBe("2026-11-12T13:15:00.000Z");
```

  - `buscarNoRh nunca seleciona salario_centavos` (espia o `select`).
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Tela de colaboradores: cadastrar (buscar no RH ou manual), equipe, celular; "gerar convite" (link de `convite_dias`, botões "copiar" e "abrir no WhatsApp" com `https://wa.me/55<celular>?text=...`); bloquear/desbloquear; reemitir.
- [ ] **Step 4:** aplicar; types; commit.

### Task 10: Portal do técnico — convite, PIN e sessão

**Files:**
- Create: `lib/portal/{sessao,origem}.ts`, `app/t/convite/[token]/`, `app/t/entrar/`, `app/t/layout.tsx`, `app/t/api/*`
- Test: `tests/portal-sessao.test.ts`, `tests/portal-origem.test.ts`

**Interfaces:**
- Consumes: Task 9.
- Produces: `exigirTecnico(): Promise<ContaTecnico>` (lê o cookie `alx_sessao`, confere hash, validade, **colaborador ativo e não bloqueado a cada chamada**; senão redireciona a `/t/entrar`); `type ContaTecnico = { colaboradorId; nome; equipeId; contratoId; estoqueContratoId; estoqueEquipeId }`; `abrirSessao(colaboradorId, req): Promise<string>`; `origemPermitida(origin, hosts): boolean`.

- [ ] **Step 1: Testes:**
  - `convite usado ou vencido não abre` → erro "Esse link já foi usado ou venceu. Peça um novo ao almox.".
  - `sessão de colaborador desligado é recusada mesmo dentro dos 90 dias` (Review Focus 5).
  - `sessão de colaborador bloqueado manualmente é recusada`.
  - `PIN errado 5 vezes bloqueia 15 minutos e avisa o tempo restante`.
  - `POST de origem estranha é recusado` (copiar casos de `dash_field/tests` do portal do fornecedor).
- [ ] **Step 2:** FAIL → implementar → PASS. Cookie `httpOnly`, `secure`, `sameSite=lax`, `path=/almox/t` (ou `/almox-teste/t`), validade `sessao_dias`.
- [ ] **Step 3:** Telas mobile: convite → criar PIN (2×) → início; entrar (CPF ou celular + PIN) quando a sessão vence. `manifest.webmanifest` para instalar como atalho.
- [ ] **Step 4:** tsc/test/build; deploy teste; abrir no celular; commit.

### Task 11: Regras de retirada (puras)

**Files:**
- Create: `lib/tempo/{data-civil,dias-uteis,retirada}.ts`
- Test: `tests/tempo-retirada.test.ts`

**Interfaces:**
- Produces: `agoraEmSaoPaulo(d: Date): { data: DataCivil; hhmm: string }`; `proximoDiaUtil(d: DataCivil, n: number, feriados: string[], dias: number[]): DataCivil`; `dataPadraoDeRetirada(referencia: Date, cfg: JanelaRetirada, feriados: string[]): DataCivil` (referência = momento da aprovação, ou do envio enquanto não aprovado); `classificarRetirada(retirada: DataCivil, referencia: Date, cfg, feriados): { emergencial: boolean; motivo: "fora_dos_dias" | "sem_antecedencia" | null }`; `retiradaPerdida(retirada: DataCivil, agora: Date, aprovado: boolean, cfg): boolean` (não aprovado e já passou o corte do dia útil anterior).

- [ ] **Step 1: Testes** (datas em UTC; São Paulo = UTC−3):

```ts
const cfg = { dias: [1,2,3,4,5], ate: "10:00", corte_aprovacao: "16:00", antecedencia_antes_corte: 1, antecedencia_depois_corte: 2 };
// qua 11/11 15:59 SP → qui 12/11
expect(dataPadraoDeRetirada(new Date("2026-11-11T18:59:00Z"), cfg, [])).toEqual({ ano: 2026, mes: 11, dia: 12 });
// qua 11/11 16:01 SP → sex 13/11
expect(dataPadraoDeRetirada(new Date("2026-11-11T19:01:00Z"), cfg, [])).toEqual({ ano: 2026, mes: 11, dia: 13 });
// sex 13/11 16:30 SP → ter 17/11
expect(dataPadraoDeRetirada(new Date("2026-11-13T19:30:00Z"), cfg, [])).toEqual({ ano: 2026, mes: 11, dia: 17 });
// qui 19/11 10:00 SP, feriado 20/11 → seg 23/11
expect(dataPadraoDeRetirada(new Date("2026-11-19T13:00:00Z"), cfg, ["2026-11-20"])).toEqual({ ano: 2026, mes: 11, dia: 23 });
// 00:30 UTC de qui 12/11 ainda é qua 11/11 21:30 em SP → sex 13/11
expect(dataPadraoDeRetirada(new Date("2026-11-12T00:30:00Z"), cfg, [])).toEqual({ ano: 2026, mes: 11, dia: 13 });
expect(classificarRetirada({ ano: 2026, mes: 11, dia: 11 }, new Date("2026-11-11T12:00:00Z"), cfg, []).emergencial).toBe(true); // hoje
expect(classificarRetirada({ ano: 2026, mes: 11, dia: 14 }, new Date("2026-11-11T12:00:00Z"), cfg, []).motivo).toBe("fora_dos_dias"); // sábado
```

- [ ] **Step 2:** FAIL → implementar → PASS. Commit.

### Task 12: Pedidos no banco (SQL 007)

**Files:**
- Create: `supabase/hub-install/007_alx_pedidos.sql`, `lib/pedidos/{regras,repositorio}.ts`
- Test: PGlite (`tests/hub-install-pglite.test.ts`), `tests/pedidos-regras.test.ts`

**Interfaces:**
- Tabelas: `alx_pedidos(id, numero serial por ambiente, ambiente, origem check in ('tecnico','compras'), colaborador_id null, solicitante_email null, equipe_id null, contrato_id, estoque_origem_id, destino check in ('equipe','obra_spot','pessoa'), retirada_em date, emergencial bool, motivo_emergencial, etapa, cmp_solicitacao_id null, criado_em, atualizado_em)`; `alx_pedido_itens(id, pedido_id, produto_id, pedido numeric, aprovado numeric null, separado numeric null, entregue numeric null, situacao check in ('normal','aguardando_transferencia','recusado'), os_id null)`; `alx_pedido_os(pedido_id, obra_id, os, loja, descricao)` (foto de `obras_obra`).
- Etapas: `aguardando_aprovacao`, `aprovado`, `separado`, `entregue`, `recusado`, `cancelado`, `nao_retirado`.
- Produces (SQL, security definer, chamadas só pelo servidor com service role): `alx_pedido_enviar(p jsonb)`, `alx_pedido_aprovar(p_id, p_atualizado_em, p_itens jsonb, p_autor)`, `alx_pedido_recusar(...)`, `alx_pedido_cancelar(...)`, `alx_pedido_marcar_separado(...)`, `alx_pedido_registrar_entrega(...)`, `alx_pedido_marcar_nao_retirado(...)`; cada uma grava `alx_eventos`.
- Produces (TS): `transicaoPermitida(etapa: Etapa, acao: Acao, papel: PapelNoPedido): boolean`.

- [ ] **Step 1: Testes PGlite:**
  - `aprovar com atualizado_em antigo falha com ALX_GUARD: o pedido mudou` (Review Focus 2).
  - `aprovador de outro contrato não aprova` / `gestor aprova qualquer um`.
  - `técnico cancela até separado; depois não`.
  - `item aprovado acima do pedido é aceito` (aprovador pode aumentar) e `aprovado = 0 vira recusado`.
  - `pedido de equipe usa o contrato da equipe; obra_spot exige ao menos uma OS`.
- [ ] **Step 2:** FAIL → SQL → PASS. Aplicar; types; commit.

### Task 13: Disponível e marca do item

**Files:**
- Create: `lib/estoque/disponivel.ts`
- Test: `tests/estoque-disponivel.test.ts`

**Interfaces:**
- Produces: `comprometidoPorEstoque(itensAprovadosNaoEntregues): Map<string /*produto:estoque*/, number>`; `disponivel(saldo: number, comprometido: number): number` (nunca < 0); `marcaDoItem(dispNoContrato: number, dispEmOutros: number): "disponivel" | "asterisco" | "sem_saldo"` (outros = base e contratos, **não** equipes).

- [ ] **Step 1: Testes:** `disponivel(14, 4) === 10`; `disponivel(2, 5) === 0`; `marcaDoItem(3, 0) === "disponivel"`; `marcaDoItem(0, 12) === "asterisco"`; `marcaDoItem(0, 0) === "sem_saldo"`.
- [ ] **Step 2:** FAIL → implementar → PASS. Commit.

### Task 14: Portal — novo pedido, meus pedidos e alertas

**Files:**
- Create: `app/t/novo/`, `app/t/pedidos/`, `app/t/pedidos/[id]/`, `lib/pedidos/actions-tecnico.ts`, `lib/avisos/app.ts`
- Test: `tests/pedidos-actions-tecnico.test.ts`

**Interfaces:**
- Consumes: `exigirTecnico()`, `filtrarProdutos()`, `marcaDoItem()`, `dataPadraoDeRetirada()`, `classificarRetirada()`, `alx_pedido_enviar`.
- Produces: `catalogoDoTecnico(conta): Promise<ItemCatalogo[]>` (`{ produtoId, descricao, unidade, familia, disponivel: number | null, marca }` — `disponivel` só para `"disponivel"`; nunca revela estoque nem quantidade de outro local); `enviarPedido(entrada): Promise<ActionResult<{ numero: number; retiradaEm: string }>>`; `alertasDoTecnico(conta): Promise<AlertaApp[]>`.

- [ ] **Step 1: Testes:**
  - `catálogo do técnico DPSP lê o disponível do estoque DPSP, não do Profarma`.
  - `item "asterisco" não expõe de onde nem quanto` (payload sem `estoqueId`/quantidade de outro local).
  - `"sem_saldo" não entra no pedido` → `ActionResult` com erro.
  - `obra/spot exige OS e muda a origem para o BASE`.
  - `emergencial sem motivo é recusado`.
  - `técnico de outra equipe não lê o pedido` (filtro pela sessão).
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Telas mobile** (§6.1, rascunho mostrado ao Jose): busca no topo filtrando a cada letra; lista com quantidade disponível, asterisco "sem saldo aqui, o almox pode transferir", cinza para sem saldo; carrinho; OS (busca em `obras_obra`, Task 20 entrega a busca — até lá, só manutenção); data de retirada pré-preenchida e editável; botão "preciso antes (emergencial)" com motivo. "Meus pedidos" com etapa e faixa de alertas no topo (não aprovado a tempo, aprovado, separado ✓, recusado, aguardando transferência, não retirado).
- [ ] **Step 4:** tsc/test/build; deploy teste; testar no celular com um colaborador de teste; commit.

### Task 15: Aprovação

**Files:**
- Create: `lib/pedidos/aprovacao.ts`, `lib/pedidos/actions-aprovador.ts`, `app/(modulo)/pedidos/page.tsx` (fila), `app/(modulo)/pedidos/[id]/page.tsx`
- Test: `tests/pedidos-aprovacao.test.ts`

**Interfaces:**
- Produces: `saldoEquipeDepois(jaTem: number, aprovado: number): number`; `alertaDivergencia(jaTem: number, pedido: number, fator: number): boolean`; `filaDoAprovador(db, email): Promise<LinhaFila[]>` (ordenada por retirada mais próxima, depois mais antigo; com tempo de espera em horas úteis); `aprovarPedido(entrada): Promise<ActionResult>` (recalcula `retirada_em` com `dataPadraoDeRetirada(agora)` se a data escolhida ficou antes do possível; itens acima do disponível do contrato viram `aguardando_transferencia`).

- [ ] **Step 1: Testes:** `saldoEquipeDepois(2, 2) === 4` (exemplo do Jose); `alertaDivergencia(3, 2, 1) === true`; `alertaDivergencia(1, 2, 1) === false`; `aprovar depois do corte empurra a retirada` (aprovação qua 16:30, pedido para qui → sex); `aprovado acima do disponível marca o excedente como aguardando_transferencia`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3: Tela** (§6.2): colunas Item · Pediu · Aprovar (editável) · Equipe já tem · **Saldo da equipe depois** · Disponível no contrato; destaque de divergência; incluir item (busca); recusar com motivo; botão único "Aprovar".
- [ ] **Step 4:** tsc/test/build; commit.

### Task 16: Avisos e lembretes

**Files:**
- Create: `lib/avisos/{canais,avisar,mensagens,smtp}.ts` (base no Compras), `lib/avisos/lembretes.ts`, `app/api/tarefas/avisos/route.ts`, `supabase/hub-install/008_alx_avisos.sql`
- Test: `tests/avisos-mensagens.test.ts`, `tests/avisos-lembretes.test.ts`

**Interfaces:**
- Tabela: `alx_avisos(id, canal check in ('email','app'), para_email null, para_colaborador_id null, tipo, referencia, situacao, tentativas, criado_em, enviado_em)` com índice único de (canal, destinatário, tipo, referência) para não duplicar.
- Produces: `avisar(evento: EventoAviso): Promise<void>` (decide canais e destinatários; um único ponto — WhatsApp entra depois como canal novo aqui); `montarLembretes(pendencias, agora, cfg): Map<email, Pendencia[]>`.
- Eventos: `pedido_pendente`, `pedido_quase_no_corte`, `pedido_nao_aprovado_a_tempo`, `pedido_aprovado`, `pedido_recusado`, `pedido_separado`, `emergencial`, `transferencia_pedida`, `falha_omie`, `ajuste_a_aprovar`, `desligamento_a_conferir`, `reposicao_pronta`.

- [ ] **Step 1: Testes:**
  - `pedido pendente há 2 horas úteis gera lembrete ao aprovador`.
  - `às 15:00 do dia útil anterior à retirada, pedido não aprovado gera aviso "perto do corte" ao aprovador e ao técnico`.
  - `separado avisa técnico (app) e aprovador (email)` (D8).
  - `um e-mail por pessoa com todas as pendências dela`.
  - `o mesmo aviso não sai duas vezes`.
- [ ] **Step 2:** FAIL → implementar → PASS. Job `almox-<amb>-avisos` a cada 15 min. Remetente por variável de ambiente (`ALX_SMTP_*`).
- [ ] **Step 3:** aplicar; types; commit.

### Task 17: Separação

**Files:**
- Create: `lib/pedidos/separacao.ts`, `app/(modulo)/pedidos/separacao/page.tsx`
- Test: `tests/pedidos-separacao.test.ts`

**Interfaces:**
- Produces: `listaDoDia(db, data: DataCivil): Promise<LinhaSeparacao[]>` (aprovados com retirada no dia e no dia seguinte; emergenciais primeiro); `marcarSeparado(entrada: { pedidoId; atualizadoEm; itens: { itemId; separado: number }[] }): Promise<ActionResult>`.

- [ ] **Step 1: Testes:** `separado menor que aprovado deixa o item parcial e avisa aprovador e técnico`; `não separa pedido não aprovado`; `itens aguardando_transferencia não entram na separação até decididos`.
- [ ] **Step 2:** FAIL → implementar → PASS. Tela com lista imprimível (folha de separação). Commit.

### Task 18: Fila de gravação no Omie (e no Field, se o V3 mandar)

**Files:**
- Create: `lib/omie/codigos.ts`, `lib/omie/movimentos.ts`, `lib/fila/{tarefas,executar}.ts`, `lib/field/cliente.ts` (só se V3), `app/api/tarefas/omie/route.ts`, `supabase/hub-install/009_alx_fila_omie.sql`, `scripts/sondar-ajuste.mjs`
- Test: `tests/omie-codigos.test.ts`, `tests/omie-movimentos.test.ts`, `tests/fila-executar.test.ts`

**Interfaces:**
- Tabela: `alx_tarefas_omie(id, ambiente, tipo check in ('transferencia','saida','entrada','ajuste_saldo'), origem_tipo, origem_id, corpo jsonb, codigo_integracao unique, situacao check in ('pendente','executando','feita','falha','simulada'), tentativas, trava_ate, ultimo_erro, omie_id null, criado_em)`.
- Produces: `type MovimentoEstoque = { tipo: "transferencia" | "saida" | "entrada" | "ajuste_saldo"; produtoOmie: number; quantidade: number; localOrigem: number; localDestino?: number; obs: string; codigoIntegracao: string }`; `codigoIntegracao(tipo: "TRF"|"SAI"|"ENT"|"AJU", id: string, ambiente): string` (`HUBALX-TRF-<id>` / `HUBALXT-…`, cortado ao tamanho que o V2 medir); `enfileirar(db, mov, origem): Promise<string>`; `executarTarefa(deps, tarefa): Promise<ResultadoTarefa>`; `interface GravadorEstoque { gravar(mov): Promise<{ id: string }>; consultarPorCodigo(codigo): Promise<{ id: string } | null>; saldo(local, produto): Promise<number> }` com `gravadorOmie`, `gravadorSimulado` (teste) e, se o V3 mandar, `gravadorField`.

- [ ] **Step 1: V2 e V3 (antes do código de gravação).** Com o Jose, quantidade 1 de um item barato: (a) `IncluirAjusteEstoque` TRF de DPSP → MANFAC N no Omie; ver se aparece no depósito da equipe no Field; (b) transferência no Field (`POST /storages-movements-v2` tipo transfer ou `/transfers` por externalId) e ver se aparece no Omie; estornar as duas. Medir campos obrigatórios, campo do local de destino, tamanho do `cod_int_ajuste` e a consulta por código. Registrar em `docs/validacoes.md`. **Regra D23: grava-se num lado só, o que propaga para o outro.**
- [ ] **Step 2: Testes:**
  - `sem resposta do gravador: a próxima tentativa consulta pelo código antes de gravar de novo` (Review Focus 3) — se achar, marca `feita` sem nova gravação.
  - `saldo relido menor que a quantidade → falha "sem saldo no Omie" sem gravar`.
  - `erro temporário repete até 5 vezes; depois falha e avisa (falha_omie)`.
  - `recusa do Omie falha na hora com mensagem traduzida; o original fica no evento`.
  - `em ALX_AMBIENTE=teste usa gravadorSimulado e marca "simulada"`.
  - `duas execuções concorrentes não pegam a mesma tarefa` (trava).
- [ ] **Step 3:** FAIL → implementar → PASS. Job `almox-<amb>-omie` a cada 5 min + execução imediata depois de cada ação. Tela "Falhas no Omie" com "tentar de novo".
- [ ] **Step 4:** aplicar; types; commit.

### Task 19: Retirada com assinatura e documento de requisição

**Files:**
- Create: `supabase/hub-install/010_alx_assinaturas.sql`, `lib/assinaturas/registrar.ts`, `lib/pdf/requisicao.ts`, `lib/pedidos/retirada.ts`, `components/assinatura-traco.tsx`, `app/(modulo)/pedidos/[id]/retirada/`
- Test: `tests/assinaturas-registrar.test.ts`, `tests/pedidos-retirada.test.ts`, `tests/pdf-requisicao.test.ts`

**Interfaces:**
- Tabela: `alx_assinaturas(id, colaborador_id null, usuario_email null, objeto_tipo, objeto_id, traco_caminho, pin_conferido bool, ip, user_agent, criado_em)`; arquivos em `almox-arquivos/<ambiente>/assinaturas/` e `/documentos/`.
- Produces: `registrarAssinatura(entrada: { colaboradorId; pin; tracoPng: Blob; objeto }): Promise<ActionResult<{ assinaturaId }>>`; `registrarRetirada(entrada: { pedidoId; atualizadoEm; assinaturaId; entregues: { itemId; quantidade }[] }): Promise<ActionResult>` — relê o saldo no Omie por item; o que não tiver saldo vira entrega parcial com aviso (Review Focus 4); enfileira os movimentos (§6.5): equipe → `transferencia` contrato→local da equipe; famílias EPI/Uniforme → `saida` + linha de carga (Task 30); obra_spot → `saida` do BASE com `OS <os> – <loja>` na obs; `gerarPdfRequisicao(pedido): Promise<Uint8Array>`.

- [ ] **Step 1: Testes:**
  - `PIN errado não assina e conta falha` (usa Task 9).
  - `saldo do Omie abaixo do separado → entrega parcial, item restante avisado, nada negativo`.
  - `pedido de equipe gera transferência DPSP → MANFAC N com o código HUBALX-TRF-<item>`.
  - `item de família EPI gera saída e não transferência`.
  - `PDF da requisição traz número, equipe, itens, quantidades, OS e a imagem da assinatura`.
- [ ] **Step 2:** FAIL → implementar → PASS. Componente de traço com `<canvas>` (sem biblioteca nova se possível). Tela do almox no tablet: conferir itens → técnico digita PIN e assina → confirmar.
- [ ] **Step 3:** aplicar; types; deploy teste (gravação simulada); com autorização do Jose, uma retirada real de 1 item em produção; **publicar a fase 2 em `/almox`**; commit.

---

# FASE 3 — Exceções do pedido

### Task 20: Obra/Spot e OS múltiplas

**Files:**
- Create: `lib/obras/leitura.ts` (copiar do Compras), `lib/obras/busca.ts`, `lib/pedidos/os.ts`, `lib/estoque/custo-obra.ts`
- Test: `tests/pedidos-os.test.ts`, `tests/estoque-custo-obra.test.ts`

**Interfaces:**
- Produces: `buscarObrasAction(texto): Promise<ObraEscolhida[]>`; `distribuirPorOs(itens, os[]): ActionResult<ItemComOs[]>` (todo item com OS quando o pedido tem mais de uma); `custoPorOs(db, de, ate): Promise<{ os; loja; valor }[]>` (entregue × CMC do momento da entrega, gravado na entrega).

- [ ] **Step 1: Testes:** `pedido obra_spot com duas OS recusa item sem OS`; `aprovador pode informar OS no pedido de manutenção fora do CC`; `custo da obra usa o CMC gravado na entrega, não o atual`.
- [ ] **Step 2:** FAIL → implementar → PASS. Ligar a busca de OS no portal (Task 14) e na aprovação. Nenhuma escrita em `obras_*` (o teste de segurança confere). Commit.

### Task 21: Transferência entre estoques (D4)

**Files:**
- Create: `supabase/hub-install/011_alx_transferencias.sql`, `lib/transferencias/{regras,actions}.ts`, `app/(modulo)/transferencias/`
- Test: `tests/transferencias-regras.test.ts`, PGlite

**Interfaces:**
- Tabela: `alx_transferencias(id, pedido_item_id null, produto_id, quantidade, estoque_destino_id, estoque_origem_id null, situacao check in ('pendente','feita','recusada'), decidido_por, motivo, tarefa_id null)`.
- Produces: `origensPossiveis(produtoId, quantidade, saldos): { estoqueId; disponivel }[]` (base e contratos com disponível > 0, maior primeiro; nunca equipes); `decidirTransferencia(entrada: { id; atualizadoEm; origemId | null; motivo? }): Promise<ActionResult>` — aceita → enfileira `transferencia` e, feita no Omie, o item volta a `normal` no pedido; recusa → item `recusado` com motivo, avisa técnico.

- [ ] **Step 1: Testes:** `origem com disponível menor que o pedido aparece mas exige quantidade parcial`; `recusar avisa o técnico e o aprovador`; `transferência feita libera o item para a separação`.
- [ ] **Step 2:** FAIL → implementar → PASS. Tela do almox com a fila de transferências pedidas, saldos de todos os estoques e escolha da origem. aplicar; types; commit.

### Task 22: Devolução de sobra, não retirado e cancelamento

**Files:**
- Create: `supabase/hub-install/012_alx_devolucoes.sql`, `lib/devolucoes/{regras,actions}.ts`, `app/t/devolver/`, `app/(modulo)/devolucoes/`, rota no job de avisos para "não retirado"
- Test: `tests/devolucoes-regras.test.ts`, `tests/pedidos-nao-retirado.test.ts`

**Interfaces:**
- Tabela: `alx_devolucoes(id, colaborador_id, equipe_id, estoque_destino_id, situacao, itens jsonb ou tabela filha, conferido_por, assinatura_id, tarefa_ids)`.
- Produces: `pedirDevolucao(conta, itens)` (só itens com saldo no local da equipe); `conferirDevolucao(entrada)` → transferência local da equipe → estoque do contrato da equipe, com assinatura; `marcarNaoRetirados(agora)` (aprovados/separados cuja retirada era ontem → `nao_retirado`, avisa; o técnico pode reagendar).

- [ ] **Step 1: Testes:** `devolver mais do que a equipe tem é recusado`; `devolução vai sempre para o estoque do contrato da equipe` (D22); `pedido separado não retirado até o fim do dia vira nao_retirado e libera o comprometido`; `reagendar volta a separado com nova data`.
- [ ] **Step 2:** FAIL → implementar → PASS. aplicar; types; deploy; **publicar a fase 3**; commit.

---

# FASE 4 — Ligação com o Compras

### Task 23: Agenda de entregas e conferência de recebimento

**Files:**
- Create: `supabase/hub-install/013_alx_recebimentos.sql`, `lib/recebimentos/{agenda,conferencia,sem-entrada}.ts`, `app/(modulo)/recebimentos/`
- Test: `tests/recebimentos-agenda.test.ts`, `tests/recebimentos-conferencia.test.ts`, `tests/recebimentos-sem-entrada.test.ts`

**Interfaces:**
- Tabelas: `alx_recebimentos(id, cmp_pedido_id uuid, conferido_por, conferido_em, resultado check in ('ok','divergencia'), observacao)`; `alx_recebimento_itens(recebimento_id, cmp_pedido_item_id, esperado, recebido, problema check in (null,'faltou','errado','avariado'), obs, foto_caminho)`.
- Produces: `agendaDeEntregas(db, de, ate): Promise<DiaAgenda[]>` (pedidos `cmp_pedidos` com entrega na Base em AGUARDANDO ENTREGA, por `previsao_entrega`; atrasados destacados); `registrarConferencia(entrada): Promise<ActionResult>` (`resultado` = ok só se todo item recebido = esperado e sem problema); `semEntradaNoOmie(db, agora, dias): Promise<Linha[]>` (conferido há ≥ `sem_entrada_omie_dias` sem movimento `COM` casado — V6).

- [ ] **Step 1: V6.** Ler 3 movimentos `COM` recentes e ver se `numPedido`/`idDoc` casam com o código do pedido no Omie gravado em `cmp_pedidos`; registrar em `docs/validacoes.md`. Sem casamento direto: casar por produto + quantidade + data ≥ conferência.
- [ ] **Step 2: Testes:** `mudou a previsão no Compras, muda a agenda`; `faltou 2 de 10 → divergência`; `conferido há 3 dias sem COM aparece em "falta entrada no Omie"`; `com COM casado some da lista`.
- [ ] **Step 3:** FAIL → implementar → PASS. Telas: agenda por dia; conferência item a item (foto opcional em `almox-arquivos`); lista "falta entrada no Omie" (visível também ao compras pelo hub). aplicar; types; commit.

### Task 24: Requisição de estoque do Compras vira pedido

**Files:**
- Create: `lib/pedidos/de-compras.ts`, rota no job `copia-estoque` (ou job próprio a cada 10 min)
- Test: `tests/pedidos-de-compras.test.ts`

**Interfaces:**
- Consumes: `cmp_solicitacoes` + `cmp_solicitacao_itens` com requisição de estoque (ver no repositório do Compras as colunas `tem_requisicao_estoque` e quanto vem do estoque por item, e o local escolhido na checagem — `cmp_estoque_checagens`).
- Produces: `importarRequisicoes(db, ambiente): Promise<{ criados: number }>` — cria `alx_pedidos` com `origem = 'compras'`, `solicitante_email`, `cmp_solicitacao_id` (único: não importa duas vezes), etapa `aprovado` (o Compras já decidiu), origem = local da checagem; destino `equipe` se a solicitação tem equipe, senão `pessoa` (saída com CC/OS na obs). A retirada é confirmada pelo solicitante logado no hub (sem PIN): `confirmarRetiradaHub(pedidoId, atualizadoEm)`.

- [ ] **Step 1: Testes:** `mesma solicitação não vira dois pedidos`; `pedido de compras nasce aprovado e vai para a separação`; `solicitação cancelada no Compras antes da separação cancela o pedido`; `só o solicitante (ou almox) confirma a retirada de pedido de compras`.
- [ ] **Step 2:** FAIL → implementar → PASS. Commit.

### Task 25: Sugestão de reposição

**Files:**
- Create: `supabase/hub-install/014_alx_reposicao.sql`, `lib/reposicao/{sugerir,actions}.ts`, `app/(modulo)/reposicao/`
- Test: `tests/reposicao-sugerir.test.ts`, PGlite

**Interfaces:**
- Tabelas: `alx_sugestoes_reposicao(id, ambiente, contrato_id null, estoque_id, centro_custo, situacao check in ('rascunho','enviada','descartada','atendida'), gerada_em, enviada_por, enviada_em, cmp_solicitacao_id null)`; `alx_sugestao_itens(sugestao_id, produto_id, saldo, minimo, alvo, em_compra, sugerido, quantidade_final)`.
- Produces: `sugerirReposicao(linhas: { produtoId; saldo; minimo; alvo: number | null; emCompra: number }[], fator: number): { produtoId; sugerido: number }[]` (só `saldo < minimo`; `sugerido = alvoEfetivo − saldo − emCompra`, se > 0); `gerarRascunhos(db, ambiente)` (um por estoque de contrato e BASE; substitui o rascunho aberto anterior); `enviarSugestao(entrada)`.

- [ ] **Step 1: Testes:**

```ts
expect(sugerirReposicao([{ produtoId: "a", saldo: 2, minimo: 10, alvo: null, emCompra: 0 }], 2)).toEqual([{ produtoId: "a", sugerido: 18 }]);
expect(sugerirReposicao([{ produtoId: "a", saldo: 2, minimo: 10, alvo: null, emCompra: 20 }], 2)).toEqual([]);
expect(sugerirReposicao([{ produtoId: "a", saldo: 10, minimo: 10, alvo: null, emCompra: 0 }], 2)).toEqual([]);
```

- [ ] **Step 2:** FAIL → implementar → PASS. Job diário `almox-<amb>-reposicao` às 6h + botão "gerar agora". Tela de revisão (mudar quantidade, tirar item, enviar). aplicar; types; commit.

### Task 26: Mudanças no repositório do Compras

**Files (repositório `manfac-facilities/compras`):**
- Create: `supabase/hub-install/018_cmp_integracao_almox.sql` (próximo número livre lá), `lib/integracao-almox/{recebimentos,sugestoes}.ts`
- Modify: rota de acompanhamento (`app/api/tarefas/acompanhamento`), tela de nova solicitação (abrir a partir de uma sugestão), envio do e-mail de requisição ao almox, `tests/hub-install-safety.test.ts` do Compras (permitir **ler** `alx_recebimentos`, `alx_recebimento_itens`, `alx_sugestoes_reposicao`, `alx_sugestao_itens`)
- Test: `tests/integracao-almox.test.ts` (no Compras)

**Interfaces:**
- Produces (Compras): `aplicarConferenciasDoAlmox(db)` — pedido em AGUARDANDO ENTREGA com entrega na Base e conferência `ok` → mesma transição que o botão "ok" do almox fazia; `divergencia` → DIVERGÊNCIA com o texto da conferência; `solicitacaoAPartirDaSugestao(sugestaoId)` — abre o formulário de nova solicitação preenchido (itens, quantidades, CC) e, ao enviar, grava o vínculo do lado do Compras; configuração `requisicao_estoque_por_email` (desligar quando o almox estiver no ar).
- O almox marca a sugestão como `atendida` lendo o vínculo do lado do Compras (o almox nunca escreve em `cmp_*`, o Compras nunca escreve em `alx_*`).

- [ ] **Step 1: Testes (no Compras):** `conferência ok do almox conclui a entrega do pedido como o botão fazia`; `divergência do almox abre DIVERGÊNCIA`; `conferência repetida não aplica duas vezes`; `teste de segurança do Compras continua recusando escrita em alx_`.
- [ ] **Step 2:** FAIL → implementar → PASS. tsc/test/build **nos dois repositórios**; aplicar o SQL do Compras; types nos dois; deploy dos dois; **publicar a fase 4**; commit em cada repositório.

---

# FASE 5 — Inventário

### Task 27: Ciclos, ondas e contagem às cegas

**Files:**
- Create: `supabase/hub-install/015_alx_inventario.sql`, `lib/inventario/{ondas,ciclo}.ts`, `lib/inventario/actions.ts`, `app/(modulo)/inventario/contar/` (tela mobile do almoxarife, sessão do hub), `app/(modulo)/inventario/`
- Test: `tests/inventario-ondas.test.ts`, `tests/inventario-ciclo.test.ts`, PGlite

**Interfaces:**
- Tabelas: `alx_contagens(id, ambiente, estoque_id, ciclo_inicio date, ciclo_fim null, situacao)`; `alx_contagem_itens(contagem_id, produto_id, onda int, saldo_omie numeric null, contado numeric null, contado_por, contado_em, extra bool)`.
- Produces: `proximaOnda(candidatos: string[], jaContados: Set<string>, tamanho: number, sortear: (n: number) => number): string[]`; `cicloEmDia(candidatos, jaContados): boolean`; `inicioDoProximoCiclo(inicioAnterior: DataCivil, meses: number): DataCivil`; `extrasDoMeio(curvaA: string[], divergiram: string[], jaNoCicloAtual: Set<string>): string[]`; `registrarContagem(entrada)` — grava o contado e **só então** lê o saldo do Omie naquele momento (quem conta nunca recebe o saldo na tela).

- [ ] **Step 1: Testes:**
  - `onda tem 20 itens sorteados entre os ainda não contados`; `última onda tem o que sobrar`; `sem candidatos restantes → cicloEmDia = true` (tela mostra "Inventário físico em dia ✓ (dd/mm)").
  - `inicioDoProximoCiclo({2026,11,12}, 6) = {2027,5,12}`.
  - `extrasDoMeio inclui curva A e quem divergiu, sem repetir o que já está no ciclo`.
  - `a resposta da tela de contagem não contém saldo do sistema` (contagem às cegas).
- [ ] **Step 2:** FAIL → implementar → PASS. Job diário abre o ciclo novo na data e encaixa os extras do meio. Contagem de estoques de equipe e de ferramental no mesmo esquema (ferramental conta `alx_ferramentas` em vez de saldo do Omie, a partir da Task 29). aplicar; types; commit.

### Task 28: Motivos, aprovação do admin e ajuste no Omie

**Files:**
- Create: `supabase/hub-install/016_alx_ajustes.sql`, `lib/inventario/ajustes.ts`, `app/(modulo)/ajustes/`
- Test: `tests/inventario-ajustes.test.ts`, PGlite

**Interfaces:**
- Tabelas: `alx_motivos_ajuste(id, nome unique (normalizado), fixo bool, criado_por, ativo)` com semente: `Perda`, `Quebra`, `Erro de lançamento`, `Devolução não registrada`, `Consumo não apontado`, `Furto`, `Validade vencida`; `alx_ajustes(id, contagem_item_id, estoque_id, produto_id, saldo_omie, contado, diferenca, valor, motivo_id, situacao check in ('proposto','aprovado','recusado'), decidido_por, decidido_em, tarefa_id)`.
- Produces: `criarMotivo(nome)` (recusa duplicado por nome normalizado; fica para todos; registra quem criou); `decidirAjustes(entrada: { ids: string[]; decisao: "aprovar" | "recusar"; atualizadoEm: Record<string,string> })` — **só `almox_is_admin()`** (D16; gestor não); aprovado → enfileira `ajuste_saldo` com `Inventário <contagem> – <motivo>` na obs.

- [ ] **Step 1: Testes:** PGlite `gestor que não é admin não aprova ajuste` e `admin aprova`; `motivo "erro de lancamento" duplica "Erro de lançamento" e é recusado`; `diferença zero não gera ajuste`; `ajuste aprovado enfileira uma tarefa com o código HUBALX-AJU-<id>`.
- [ ] **Step 2:** FAIL → implementar → PASS. Tela do admin com aprovação em lote. aplicar; types; deploy; **publicar a fase 5**; commit.

---

# FASE 6 — Carga do colaborador

### Task 29: Ferramentas, conserto e importação da planilha

**Files:**
- Create: `supabase/hub-install/017_alx_ferramentas.sql`, `lib/carga/{ferramentas,importar}.ts`, `app/(modulo)/ferramentas/`, `app/(modulo)/consertos/`
- Test: `tests/carga-ferramentas.test.ts`, `tests/carga-importar.test.ts`

**Interfaces:**
- Tabelas: `alx_ferramentas(id, tipo check in ('rastreada','quantidade'), patrimonio null unique, descricao, categoria, valor, quantidade_total (para 'quantidade'), estado check in ('almox','com_colaborador','conserto','baixada'), colaborador_id null)`; `alx_consertos(id, ferramenta_id, fornecedor, saiu_em, previsao, voltou_em null, custo null, obs)`.
- Produces: `transicaoFerramenta(estado, acao): Estado | null`; `importarFerramentas(planilha: string /*CSV*/): { criadas; erros: { linha; motivo }[] }` (colunas: patrimônio, descrição, categoria, valor, quantidade, com quem está [nome/CPF], estado); `consertosAtrasados(db, agora, dias)`.

- [ ] **Step 1: Testes:** `rastreada com colaborador não pode ir para outro sem devolver`; `baixada exige motivo e não volta`; `importação liga "com quem está" a um colaborador existente por CPF ou nome exato e aponta a linha quando não acha`; `conserto há mais de 30 dias aparece atrasado`.
- [ ] **Step 2:** FAIL → implementar → PASS. aplicar; types; commit.

### Task 30: Entrega e devolução com termo; EPI e uniforme

**Files:**
- Create: `supabase/hub-install/018_alx_cargas.sql`, `lib/carga/{cargas,epi}.ts`, `lib/pdf/termo.ts`, `app/(modulo)/colaboradores/[id]/ficha/`, `app/t/ficha/`
- Test: `tests/carga-cargas.test.ts`, `tests/carga-epi.test.ts`, `tests/pdf-termo.test.ts`

**Interfaces:**
- Tabela: `alx_cargas(id, colaborador_id, tipo check in ('ferramenta','epi','uniforme'), ferramenta_id null, produto_id null, quantidade, valor_unitario, entregue_em, assinatura_entrega_id, devolvido_em null, estado_devolucao check in (null,'ok','danificado'), assinatura_devolucao_id null, termo_caminho, pedido_item_id null)`.
- Produces: `familiaDeCarga(familia: string): "epi" | "uniforme" | null` (comparação normalizada com "EPI" e "Uniforme"); `entregarCarga(entrada: { colaboradorId; itens; pin; traco })` — ferramenta: muda estado, sem Omie; EPI/uniforme: enfileira `saida` com `Entregue a <nome>` na obs; gera o termo (texto de `termo_texto` + lista, data, valor de cada item) e guarda o PDF; `devolverCarga(entrada)` (danificado pode abrir conserto direto); `fichaDoColaborador(db, id): Promise<{ comEle; valorTotal; historico; termos }>`. O PIN pode ser criado na hora no tablet para quem não tem convite (§5.2): `criarPinPresencial(colaboradorId, pin)` — só almoxarife, só se o colaborador ainda não tem PIN.

- [ ] **Step 1: Testes:** `familiaDeCarga("Epi ") === "epi"`; `EPI entregue gera saída no Omie e linha na ficha`; `ferramenta entregue não gera nada no Omie`; `termo traz itens, valores, data e assinatura`; `ficha soma o valor do que está com o colaborador`; `PIN presencial recusado se já existe PIN`.
- [ ] **Step 2:** FAIL → implementar → PASS. A retirada de pedido (Task 19) chama `entregarCarga` para itens EPI/uniforme. O técnico vê a própria ficha em `/t/ficha`. aplicar; types; commit.

### Task 31: Desligamento integrado ao RH

**Files:**
- Create: `supabase/hub-install/019_alx_desligamentos.sql`, `lib/rh/desligamentos.ts`, `lib/pdf/desligamento.ts`, `app/api/tarefas/rh/route.ts`, `app/(modulo)/desligamentos/`
- Modify (repositório `manfac-facilities/rh`): ficha do colaborador mostra a conferência do almox (situação, faltantes com valor, link do PDF); `tests/hub-install-safety.test.ts` do RH passa a permitir **ler** a view do almox
- Test: `tests/rh-desligamentos.test.ts` (almox), teste da tela no RH

**Interfaces:**
- Tabelas: `alx_desligamentos(id, colaborador_id, rh_colaborador_id null, data_prevista, origem check in ('rh','manual'), situacao check in ('aguardando','conferido'), conferido_por, conferido_em, valor_desconto, pdf_caminho)`; `alx_desligamento_itens(desligamento_id, carga_id, resultado check in ('devolvido_ok','devolvido_danificado','nao_devolvido'), valor)`.
- View de leitura para o RH: `alx_v_desligamentos_rh(rh_colaborador_id, situacao, valor_desconto, itens jsonb, pdf_caminho, conferido_em)` com grant de select a `authenticated` filtrado por quem tem papel no RH (ver no repositório do RH a função de acesso `rh_*`; como corpo de função não pode chamar função de outro módulo, a view filtra lendo `rh_papeis` diretamente, que é leitura permitida).
- Produces: `detectarDesligamentos(db, agora): Promise<{ abertos: number }>` — colaborador ligado com `rh_colaboradores.desligamento` preenchido ou `status = 'desligado'` e sem conferência → abre `aguardando`, agenda o bloqueio do portal para a data, avisa (`desligamento_a_conferir`); `conferirDesligamento(entrada)` — fecha a ficha, calcula `valor_desconto` = Σ não devolvidos + danificados (valor do item), gera o PDF, marca `conferido`.

- [ ] **Step 1: Testes:** `desligamento no RH abre conferência uma vez só`; `portal bloqueia na data do desligamento`; `valor do desconto soma não devolvidos e danificados`; `abrir à mão funciona para colaborador sem RH`; `a leitura do RH nunca seleciona salario_centavos` (o almox só lê id, cpf, nome, cargo, status, desligamento, admissao).
- [ ] **Step 2:** FAIL → implementar → PASS. Job `almox-<amb>-rh` de hora em hora. **No repositório do RH:** a tela e o ajuste do teste de segurança; tsc/test/build lá também. V8: perguntar ao RH (Jose) se `desligamento` é preenchido antes da saída efetiva; registrar.
- [ ] **Step 3:** aplicar; types nos dois; deploy dos dois; **publicar a fase 6**; commit em cada repositório.

---

# FASE 7 — Indicadores e tela inicial

### Task 32: Indicadores

**Files:**
- Create: `supabase/hub-install/020_alx_indicadores.sql`, `lib/indicadores/{calculo,montar}.ts`, `app/(modulo)/indicadores/`, `app/api/tarefas/indicadores/route.ts`
- Test: `tests/indicadores-calculo.test.ts`, `tests/indicadores-montar.test.ts`

**Interfaces:**
- Tabela: `alx_indicadores_mensais(ambiente, mes date, chave, estoque_id null, valor numeric, detalhe jsonb)` — foto do mês, gravada no dia 1 pelo job; nunca recalculada.
- Produces (puras): `giro(saidasValor: number, estoqueMedioValor: number): number | null` (null se estoque médio 0); `coberturaDias(saldo: number, consumoDiarioMedio: number): number | null`; `parados(itens: { produtoId; ultimaSaida: DataCivil | null; valor }[], hoje: DataCivil, dias: number)`; `curvaABC(itens: { produtoId; valorConsumido }[]): Map<string, "A"|"B"|"C">` (A até 80% acumulado, B até 95%, C resto); `percentualSeparadoAntes(pedidos)`; `acuracidade(itensContados)`; `aplicacaoForaDoContrato(saidasEquipe, contratoDaEquipe, clienteDaOs)` (V9; se não houver vínculo OS↔saída, devolve `null` e a tela mostra "depende do V9").
- `montarIndicadores(db, filtro: { estoqueId?; de; ate })` com todos os grupos do §12: estoque (valor por local, giro, cobertura, parado 90/180 com valor, ABC, ruptura), atendimento (tempo até aprovação, % aprovado até 16h, % separado antes, % emergencial por equipe e aprovador, inteiro/parcial/recusado, não retirado), acuracidade (% sem diferença, valor ajustado por motivo/mês, andamento do ciclo), equipes (consumo, material parado na equipe, aplicação fora do contrato), ferramental (valor em campo, conserto atrasado, perdas/descontos), recebimento (no prazo, divergência, sem entrada no Omie).

- [ ] **Step 1: Testes:**

```ts
expect(giro(12000, 4000)).toBe(3);
expect(giro(100, 0)).toBeNull();
expect(coberturaDias(30, 2)).toBe(15);
expect(curvaABC([{ produtoId: "a", valorConsumido: 80 }, { produtoId: "b", valorConsumido: 15 }, { produtoId: "c", valorConsumido: 5 }]))
  .toEqual(new Map([["a", "A"], ["b", "B"], ["c", "C"]]));
```

  - `parado há 90 dias conta; com saída há 89 não`; `item nunca movimentado conta como parado desde a primeira cópia`.
- [ ] **Step 2:** FAIL → implementar → PASS. Tela com filtro por estoque e período e um bloco por grupo. Job mensal `almox-<amb>-indicadores` dia 1 às 5h. aplicar; types; commit.

### Task 33: Tela inicial e lembrete da fase seguinte

**Files:**
- Create: `supabase/hub-install/021_alx_pendencias_projeto.sql`, `app/(modulo)/page.tsx`, `lib/inicio/resumo.ts`
- Test: `tests/inicio-resumo.test.ts`

**Interfaces:**
- Tabela: `alx_pendencias_projeto(id, titulo, descricao, criado_em, concluido_por null, concluido_em null)` com semente: "Fase 2 pendente: aba Operação no Cockpit — estoque das equipes em tempo real e custo de material aplicado por loja (ranking, cruzamento com receita)".
- Produces: `resumoDoDia(db, papel, email)`: para almoxarife — retiradas de hoje (separadas/total), transferências pedidas, entregas de fornecedor, falhas no Omie, onda de contagem; para aprovador — pendentes e perto do corte; para gestor/admin — tudo isso + ajustes a aprovar + **pendências do projeto** (só gestor/admin; some quando alguém marca "feito").

- [ ] **Step 1: Testes:** `aprovador vê só os pendentes dos seus contratos`; `pendência do projeto aparece para gestor e admin e não para almoxarife`; `marcar feito registra quem e quando`.
- [ ] **Step 2:** FAIL → implementar → PASS. aplicar; types; deploy; **publicar a fase 7**; commit.

---

# VIRADA

### Task 34: Colocar no ar para valer

**Files:**
- Create: `docs/deploy-easypanel.md` (copiar do Compras e adaptar), `docs/cliente/manual-almox.md` (+ HTML/PDF no padrão de `docs/cliente/` do Compras), `docs/validacoes.md` completo
- Modify (repositório `login-system`): card "Almoxarifado" em `lib/sistemas.ts`

- [ ] **Step 1:** Conferir que `/almox-teste` existe desde a fase 1 (`ALX_AMBIENTE=teste`, agendador próprio, gravação simulada) e que dados de teste estão fora dos indicadores.
- [ ] **Step 2:** Segredos (Jose): `OMIE_APP_KEY/SECRET`, `ALX_SMTP_*`, `SUPABASE_SERVICE_ROLE_KEY`, segredo do agendador no cofre (`almox_producao_cron_secret` e URLs das rotas), `FIELD_API_KEY` só se o V3 exigir.
- [ ] **Step 3:** Cadastros com o Jose: papéis (aprovadores por contrato e Obras/Spot, almoxarifes, gestores Jose e Gabriel Vidal, admins), estrutura (estoques, contratos, equipes), mínimos iniciais, motivos, texto do termo (revisado pelo RH), feriados, mapa CC → estoque.
- [ ] **Step 4:** Ferramental: importar a planilha atual (Task 29). Colaboradores: buscar no RH, ligar às equipes, gerar convites e mandar pelo WhatsApp.
- [ ] **Step 5:** Card no hub (`login-system`), deploy. Desligar no Compras o e-mail de requisição (`requisicao_estoque_por_email = false`). Combinar com o Jose o dia em que os técnicos deixam de pedir pelo Field e avisar as equipes.
- [ ] **Step 6:** Apagar dados de teste com autorização do Jose. Rodar uma semana acompanhando falhas no Omie e alertas. Manual publicado. Commit final.

---

## Self-review (feito)

- **Cobertura do desenho:** §5.1 papéis → T2; §5.2 portal → T9/T10/T30; §6.1 → T11/T13/T14/T20; §6.1.1 → T13/T15; §6.1.2 → T19/T30; §6.2 → T15; §6.3 → T16; §6.4 → T17; §6.5 → T18/T19; §6.6 → T22; §7 → T29/T30; §7.1 → T31; §8 → T23/T24/T26; §9.1 → T6; §9.2 → T7/T25/T26; §10 → T27/T28; §11 → T4/T18; §12 → T32; §13 → T16/T33; §14 → T8/T18/T23/T31/T34; §15 → fases; D20 → T33.
- **Nomes consistentes:** `dataPadraoDeRetirada`, `marcaDoItem`, `disponivel`, `alvoEfetivo`, `sugerirReposicao`, `codigoIntegracao`, `GravadorEstoque`, `exigirTecnico`, `entregarCarga`, `avisar` usados com a mesma assinatura em todas as tasks.
- **Numeração do SQL** é indicativa (001–021); siga a ordem real em que os arquivos forem criados.
