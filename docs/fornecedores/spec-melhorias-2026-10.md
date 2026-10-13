# Spec — melhorias do Gestão de Fornecedores (outubro/2026)

**Data:** 13/10/2026 · **Estado:** revisada (laudo `revisao-spec-melhorias-2026-10.md`: APROVADA COM AJUSTES);
bloqueantes B1 e B2 corrigidos, melhorias respondidas na §8, decisões do João de 13/10 na §7 · **Entrega:** única
(decisão do João). Plano: `plano-melhorias-2026-10.md`.

**Fontes:** mockup aprovado `docs/fornecedores/mockup-melhorias-2026-10-12.html`; feedback literal
`docs/cliente/2026-10-12-feedback-fornecedores.md`; retorno ao mockup (7 suposições aceitas)
`docs/cliente/2026-10-12-retorno-mockup-melhorias-fornecedores.md`; spec original `docs/fornecedores/spec.md`.

**Código medido:** repo `manfac-facilities/fornecedores`, `main` = `017e0d9`, clone
`D:\fornecedores-work\fornecedores-melhorias`. Todo `arquivo:linha` abaixo é relativo à raiz desse clone,
salvo quando indicado. SQL: `supabase/hub-install/NNN_*.sql` abreviado como `NNN:linha`.

**Banco medido (leitura, 13/10/2026, projeto `iyytcavcgukfjnjjrerx`):**

| O quê | Valor |
|---|---|
| Contratos | **1** — `CT-0001`, `aguardando`, global/manutenção, `OBRA_MEDICAO_MENSAL`, criado por `jose.guilherme@manfac.com.br`, fornecedor homologado |
| Aprovações do CT-0001 | `condicoes_aprovadas_por = jose.guilherme@…` em `2026-10-11 23:47:07 UTC`; `contratacao_aprovada_* = NULL` |
| Eventos do CT-0001 | 3: `contrato_criado`, `contrato_enviado` ("Enviado para aprovação de Eduardo e José"), `condicoes_aprovadas` |
| Aditivos / medições | 0 / 0 |
| Anexos | 1 |
| `frn_condicoes` | 12 linhas, todas ativas (= seed `002:98-138`) |
| `frn_papeis` | eduardo.maia → `aprovador_contratacao`; jose.guilherme → `aprovador_financeiro`, ambos ativos |

Leitura única, feita pela sessão da spec em 13/10. Nenhuma leitura nova foi feita na rodada de ajustes (não
autorizada); a conferência antes/depois em produção fica no roteiro do plano.

---

## 0. Regras que valem para a spec inteira

1. **Modelo de escrita não muda** (`001:3-6`, `005:3-12`): toda tabela `frn_*` com RLS, `authenticated` só
   `SELECT`, toda escrita por função `frn_*` `security definer`, executável só por `service_role`, que recebe
   `p_ator` = e-mail da sessão e revalida tudo. Funções de autorização devolvem `true/false`, nunca `NULL`
   (`exists`/`coalesce`/`is not true`).
2. **Nada é apagado nem sobrescrito por trás do usuário.** Edição de condição e de modelo gera **versão nova**;
   o que já existe continua apontando para a versão com que nasceu. Tabelas de versão são imutáveis (trigger,
   como `frn_eventos`, `004:188-204`).
3. **Território** (borda tratada mesmo sem pedido): RLS/policies, `frn_papeis`, sobrescrita de dado
   (condições, modelo, contrato), dinheiro (parcelas, prazo de pagamento). Fora disso: menor mudança.
4. **As telas de Medição não mudam.** A única mudança na pasta `app/(modulo)/medicoes/` é a **fonte** da condição
   em `_dados.ts` (§2.5), exigida pela suposição 2 — sem ela, editar uma condição mudaria a medição de contrato já
   aprovado.
5. **Proposta comercial opcional (seção F do mockup) já está no ar**: migration `008` aplicada em 12/10 e PR #4
   (`017e0d9`). Resta só o texto do cartão de aprovação (§1.2, item 9).

---

## 1. Escopo item a item

### 1.1 Seção A — Busca na lista de Contratos

**Hoje:**
- A página lê todos os contratos visíveis pela RLS, sem `q` (`app/(modulo)/contratos/page.tsx:49-62`), e só
  filtra por `st` e `cl` (`_lista.ts:196-210`, `page.tsx:284-310`). Não há campo de busca.
- Chips de status: Todos, Rascunho, Aguardando, Aprovado, Encerrado (`_lista.ts:196`, `page.tsx:40-46`).
  "Devolvido" não é status: é `rascunho` com `devolvido_motivo` (`_lista.ts:160`) e aparece como texto
  "devolvido — ajustar" embaixo da pill (`page.tsx:244-247`).
- Sub-linha de aditivo segue o filtro de classificação do contrato pai (`_lista.ts:216-232`).

**Novo:**
1. Campo de busca acima dos chips (placeholder "Buscar por fornecedor, CNPJ ou nº do contrato", botão "×" para
   limpar, contador "N de M contratos" / "M contratos"). Só aparece quando há ao menos 1 contrato (estado vazio
   do mockup: "A busca aparece quando houver o que buscar").
2. Filtra **enquanto digita**: componente cliente `_busca.tsx` atualiza `?q=` com `router.replace` após 300 ms
   sem digitar; o servidor filtra (os dados já são todos lidos hoje). `q` convive com `st` e `cl` na URL.
3. Regra de casamento (função pura `casaBusca`, espelho de `filtrar()` do mockup), sobre texto normalizado
   (minúsculas, sem acento, `trim`):
   - `q` vazio → casa;
   - `q` casa `/^ct[-\s]?\d*$/` → compara só com o número (`ct 1` vira `ct-1`);
   - contém o texto no nome do fornecedor (razão social) ou no número → casa;
   - `q` só com dígitos e `. / - espaço`: com **5+ dígitos** compara com os dígitos do CNPJ/CPF; com menos,
     com os dígitos do número do contrato.
4. Destaque (`<mark>`) do trecho encontrado no número, no fornecedor e no documento.
5. Sub-linha de aditivo aparece se o contrato pai casar (mesma regra do CA-1.4 de classificação).
6. Chip novo **"Devolvido"** entre Aguardando e Aprovado; "Rascunho" passa a contar só rascunho **sem**
   `devolvido_motivo`; "Aguardando" conta as etapas `eduardo`, `jose` e `homologacao`.
   Sub-linhas de aditivo nos chips: hoje seguem o **próprio** status do aditivo (`_lista.ts:221-229`); isso fica
   para Aguardando e Aprovado. No chip **Devolvido** só entram contratos devolvidos (aditivo devolvido é estado
   final, sem ação, e apareceria solto sob contrato aprovado); aditivo `devolvido` continua visível em "Todos".
7. Coluna Status usa a **etapa** (§1.3) em vez do status cru.
8. Estado "nenhum resultado" com o texto do mockup: com busca, "Nenhum contrato encontrado para “q”" + dica de
   CNPJ/nº + botões "Limpar busca" e (se houver filtro ligado) "Limpar busca e filtros"; sem busca, "Nenhum
   contrato com esses filtros" + "Limpar filtros".

### 1.2 Seção B — Aprovação em ordem (Eduardo → José) com José alterando as condições

**Hoje (paralelo, em qualquer ordem):**
- `frn_aprovar_contrato` aceita a parte `contratacao` ou `condicoes` em qualquer ordem enquanto `aguardando`
  (`005:484-512`); libera quando as duas existem **e** o fornecedor está homologado (`005:463-482`).
  O teste fixa esse comportamento: "CA-3.2 libera com as duas partes em qualquer ordem"
  (`tests/sql/contratos.test.ts:335`).
- `frn_devolver_contrato` aceita qualquer das duas partes a qualquer momento do `aguardando`, volta a
  `rascunho` e descarta as duas aprovações (`005:514-540`).
- No app, `pode` = parte pendente + papel, sem olhar a outra parte (`aprovacoes/_lib/cartoes.ts:101-125`);
  o cartão mostra dois blocos lado a lado, cada um com Aprovar/Devolver (`_cartao.tsx:100-125`); a página tem
  as abas "Esperando por mim" / "Todos aguardando" (`aprovacoes/page.tsx:39-63`).
- José **não** consegue mudar a condição na aprovação: só aprova ou devolve. Mudar condição só por aditivo
  depois de aprovado (`005:707-767`).
- É exatamente o relato do cliente: José aprovou o CT-0001 e ele continua "Aguardando aprovação" porque falta
  o Eduardo (banco medido acima).

**Novo:**
1. **Ordem obrigatória.** Etapa 1: Eduardo aprova a contratação. Etapa 2: José valida as condições (e a
   homologação, se o fornecedor for novo). O banco recusa `condicoes` com contratação pendente:
   "O Eduardo aprova a contratação primeiro."
2. **Devolver só na própria etapa.** Eduardo devolve na etapa 1; José, na etapa 2 (inclusive quando só falta a
   homologação). Fora da etapa: "Este contrato não está na sua etapa."
3. **José altera as condições e aprova** (sem devolver), na etapa 2, com o editor do mockup
   (`editorCond`, mockup linhas 289-305):
   - troca da condição por outra **permitida** para o contrato (R-09, `005:125-139`), mais a atual mesmo se
     tiver sido desativada (mockup `opcoesCond`, linha 288);
   - em condição de modo `parcelas`: ajusta só os **percentuais** de cada parcela, "só neste contrato";
     inteiros de 1 a 100, soma 100 (os gatilhos e a quantidade de parcelas são os da condição);
   - em `excecao`: prazo em dias (0 a 120; 0 = à vista) e justificativa (5 a 1.000 caracteres);
   - troca para condição de modo `tabela` só se o contrato já tiver tabela de preços; senão recusa:
     "Esta condição precisa da tabela de preços. Devolva ao solicitante para incluir.";
   - prévia "Antes → Depois" e "Desfazer alteração"; botão vira "Aprovar com a condição alterada" e fica
     desabilitado enquanto a soma ≠ 100 ou faltar prazo/justificativa;
   - **o Eduardo não reaprova** (suposição 4): recebe e-mail de aviso.
   - ao sair de uma exceção para outra condição, `excecao_condicao`, `excecao_justificativa` e `excecao_dias`
     do contrato são zerados (o "antes" fica no evento). Motivo: `frn_parcelas_mo` usa `excecao_condicao` como
     nome da parcela única em modo não-lista (`005:236`), e o texto antigo vazaria para a parcela e o documento;
   - os percentuais ajustados valem **só para a condição e a versão em que foram feitos**: qualquer salvamento
     de rascunho e qualquer devolução zeram `parcelas_ajustadas` (§2.1, §2.2).
4. **Homologação** de fornecedor novo continua do José (`005:542-571`) e continua podendo ser feita a qualquer
   momento; o contrato só fica aprovado com contratação + condições + homologação (`005:474-475`, sem mudança).
   Se José aprovar as condições antes de homologar, a etapa vira "Aguardando José — homologação do fornecedor".
5. **Página Aprovações** (mockup `pageAprovacoes`, linhas 242-257): para Eduardo/José, seções
   "Com você (n)" e "Em andamento, com outra pessoa (n)" no lugar das abas; para solicitante, banner
   "Você acompanha aqui, mas não aprova…" e os próprios contratos; para admin, banner "Admin do hub vê tudo e não
   aprova nada". Estado vazio "Nada aguardando aprovação".
6. **Cartão de contrato** numa coluna (mockup `cardAprov`, linhas 258-287): cabeçalho (nº · fornecedor,
   tipo · classificação · obra · CC, valor, pill da etapa), barra de etapas (Criado → Contratação · Eduardo →
   Condições · José → Aprovado), escopo, vigência, documentos, caixa da condição; rodapé com os botões **só para
   quem é da etapa**; para os demais, a caixa "⏳ Aguardando o Eduardo/José…" com o texto do mockup. O bloco de
   homologação atual (`_cartao.tsx:452-523`) continua, para o José.
7. Diálogos de confirmação com os textos do mockup (linhas 533-545, 948-952): "Aprovar a contratação do CT-…?",
   "Aprovar as condições do CT-…?", "Aprovar com a condição alterada?" (com o Antes/Depois).
8. **Aditivos** (suposição 6): aditivo de **valor** passa a seguir a mesma ordem (Eduardo, depois José);
   aditivo de **condição** continua só com o José (`005:789-790`, sem mudança). O cartão de aditivo mantém o
   layout de dois blocos de hoje; só o bloco do José mostra "Aguardando o Eduardo" enquanto a contratação do
   aditivo de valor estiver pendente. Hoje a ordem é livre (`005:792-798`).
9. Texto dos documentos no cartão: "Proposta faltando" (`_cartao.tsx:311`) vira
   "Proposta comercial: não anexada (opcional)" / "anexada".

### 1.3 Seção C — Etapa atual na lista e na linha do tempo

**Hoje:**
- Pill de status com um só rótulo para tudo que está em aprovação: "Aguardando aprovação"
  (`components/ui/pill.tsx:10-16`); ficha usa a mesma pill (`[numero]/page.tsx:89`).
- Ficha mostra o banner "Devolvido para ajuste" (`[numero]/page.tsx:111-115`) e a linha do tempo só com
  eventos gravados (`lib/eventos/linha-do-tempo.ts:39-59`); não diz em que etapa o contrato está.
- Texto do evento de envio: "Enviado para aprovação de Eduardo e José" (`008:51`).

**Novo:**
1. **Etapa derivada** (função pura `etapaDoContrato`, `lib/regras/etapa.ts`; espelho SQL `frn_etapa`), nenhuma
   coluna nova:

   | Etapa | Condição | Rótulo da pill | Cor |
   |---|---|---|---|
   | `rascunho` | `status = rascunho` e `devolvido_motivo` nulo | Rascunho | `#94a3b8` |
   | `devolvido` | `status = rascunho` e `devolvido_motivo` não nulo | Devolvido | `#ef4444` |
   | `eduardo` | `aguardando` e `contratacao_aprovada_em` nulo | Aguardando Eduardo | `#f59e0b` |
   | `jose` | `aguardando`, contratação aprovada, condições pendentes | Aguardando José | `#f59e0b` |
   | `homologacao` | `aguardando`, as duas aprovadas, fornecedor não homologado | Aguardando José · homologação | `#f59e0b` |
   | `aprovado` / `encerrado` / `cancelado` | igual ao status | como hoje | como hoje |

2. **Ficha** (mockup `pageFicha`, linhas 343-361): caixa "Etapa atual" no topo com título, subtítulo
   ("Desde dd/mm/aaaa hh:mm. Depois do Eduardo, segue para o José." etc., mockup `etapaInfo`, linhas 325-334),
   a barra de etapas e o botão da ação: "Abrir aprovação" para quem é da etapa; "Ajustar e reenviar" (contrato
   devolvido) / "Enviar para aprovação" (rascunho) para o dono, levando a `/contratos/CT-…/editar`. O "desde" vem
   de `enviado_em`, `contratacao_aprovada_em`, `devolvido_em`, `aprovado_em` ou `criado_em`, conforme a etapa.
3. Contrato devolvido: banner "Ao reenviar, o contrato recomeça pelo Eduardo." (suposição 7).
4. **Linha do tempo**: último item sintético "agora · Agora: aguardando aprovação do Eduardo" (ou José, ou
   "com o solicitante para ajuste", ou "rascunho, ainda não enviado"), cor laranja; nada é gravado.
5. Eventos novos com texto do mockup: "Enviado para aprovação do Eduardo" / "Reenviado para aprovação do
   Eduardo"; "Contratação aprovada por {nome}"; "Condições alteradas por {nome}: {antes} → {depois}" e, quando a
   nova é exceção, ". Justificativa: {texto}" (mockup linha 496; também em `dados.justificativa`); o nome vem
   do cadastro do hub (§2.2, `frn__nome`). Eventos antigos não mudam (imutáveis).
6. Box "Aditivos" da ficha de contrato aprovado com o texto do mockup (linha 354): valor = Eduardo e depois
   José; condição = só José. Os botões de aditivo continuam os de hoje (`_ficha/acoes.tsx`).

### 1.4 Seção D — E-mail a cada etapa

**Hoje:** o Fornecedores não envia e-mail nenhum: não há `nodemailer` no `package.json`, nem variável `SMTP_*`
no `.env.example`. A spec original deixou fora de escopo de propósito: "D10 … e-mail/notificação (só contadores
no menu)" (`docs/fornecedores/spec.md:34`). Mecanismo dos irmãos em §3.

**Novo** (suposição 5: próximo aprovador + quem abriu o contrato). "Eduardo" = todos os e-mails ativos com
`aprovador_contratacao`; "José" = `aprovador_financeiro`; "solicitante" = `frn_contratos.criado_por`.

| # | Quando | Para | Cópia | Assunto |
|---|---|---|---|---|
| 1 | Enviado ou reenviado (vai para a etapa 1) | Eduardo | — | `[Fornecedores] CT-… aguarda sua aprovação — {fornecedor}` |
| 2 | Eduardo aprovou e o contrato **não** foi liberado | José | solicitante | `[Fornecedores] CT-…: contratação aprovada — aguarda as condições` |
| 3 | Contrato ficou **aprovado** e houve alteração de condição pelo José desde o último envio | solicitante | Eduardo | `[Fornecedores] CT-… aprovado com condição de pagamento alterada` (corpo com "Antes/Depois") |
| 3b | Contrato ficou **aprovado** sem alteração | solicitante | Eduardo | `[Fornecedores] CT-… aprovado — liberado para medição` |
| 4 | Devolvido | solicitante | Eduardo, se quem devolveu foi o José | `[Fornecedores] CT-… devolvido para ajuste` (corpo com o motivo) |

- "Aprovado" sai no momento em que o contrato vira `aprovado`, seja pela aprovação do José, seja pela homologação
  que liberou (`frn_homologar_fornecedor`, `005:562-567`), seja pela aprovação do Eduardo (caso CT-0001, §2.4).
- Corpo: os textos do mockup (`mkMail`, linhas 106-123) + tabela Contrato/Fornecedor/Tipo/Valor/CC + link
  "Abrir o contrato no Hub" = `NEXT_PUBLIC_APP_URL + /contratos/CT-…` (o valor da variável já inclui
  `/fornecedores`, ver `.github/workflows/ci.yml` e `next.config.ts` `basePath`). HTML simples com versão texto
  (`html` + `text` do nodemailer).
- Destinatários sem repetição: quem está em "Para" sai da "Cópia" (no CT-0001, José é solicitante e aprovador).
- **Falha de e-mail nunca bloqueia nem desfaz a ação**: envio em `after()`, depois da resposta, com nova tentativa
  em recusa temporária 4xx (padrão do Financeiro, §3). Cada envio registrado em `frn_avisos`
  (`enviado` / `falhou` / `sem_configuracao`).
- **Valores digitados por pessoas** (razão social, escopo, motivo, justificativa, nome de condição) são
  **escapados** antes de entrar no HTML (`& < > " '`, como `esc()` do mockup, linha 76); a versão texto vai crua.
  Assunto sem quebra de linha (`\r`/`\n` removidos).
- **E-mails de aditivo** (decisão D4 do João, 13/10). "Quem pediu" = `frn_aditivos.criado_por`; "dono" = dono do
  contrato (entra em cópia quando for outra pessoa):

| # | Quando | Para | Cópia | Assunto |
|---|---|---|---|---|
| A1 | Aditivo de **valor** pedido | Eduardo | quem pediu, dono | `[Fornecedores] Aditivo CT-…-K aguarda sua aprovação — {fornecedor}` |
| A2 | Aditivo de **condição** pedido | José | quem pediu, dono | idem |
| A3 | Eduardo aprovou o aditivo de valor (falta o José) | José | quem pediu, dono | `[Fornecedores] Aditivo CT-…-K: valor aprovado — aguarda as condições` |
| A4 | Aditivo aprovado (aplicado) | quem pediu | dono, Eduardo | `[Fornecedores] Aditivo CT-…-K aprovado` (novo total ou condição antes → depois) |
| A5 | Aditivo devolvido | quem pediu | dono; Eduardo se quem devolveu foi o José | `[Fornecedores] Aditivo CT-…-K devolvido` (com o motivo) |


### 1.5 Seção E1 — Configurações: condições de pagamento editáveis

**Hoje:**
- As 12 condições são fixas: seed de `frn_condicoes` (`002:98-138`), comentário "Só leitura no app; o seed
  deste arquivo é a fonte" (`002:3-6`); não existe função de escrita para elas (lista de grants `005:1365-1380`).
- O app usa uma **cópia fixa no código**, `CONDICOES` (`lib/regras/condicoes.ts:65-188`, "Se o seed mudar, mude
  aqui também", linhas 1-5), em: sugestão/permitidas da tela de novo contrato (`contratos/novo/_contrato.ts:114-119`,
  `_condicao.tsx:42,124`), lista (`contratos/_lista.ts:114`), ficha (`[numero]/_ficha/calculo.ts:184-189`,
  `_ficha/_actions.ts:92`), aprovações (`aprovacoes/_lib/condicao.ts:10-26`),
  documento (`documento/page.tsx:20`, `_documento.tsx:40`), aditivo (`lib/regras/aditivo.ts:7,36`).
- **Tudo que é dinheiro lê a condição "ao vivo" pelo código**, sem versão:
  - parcelas: `frn_parcelas_mo` lê `frn_condicoes.parcelas` na hora (`005:214-218`);
  - prazo: `frn_registrar_solicitacao_fin` confere o vencimento com `frn_dias_pagamento(m.condicao_codigo, …)`,
    que lê `frn_condicoes.dias_pagamento` na hora (`005:143-153`, `005:1199-1202`);
  - medição: modo e parcelas lidos na hora (`005:962-963`, `005:1028`); a tela de nova medição lê
    `frn_condicoes` pelo código (`app/(modulo)/medicoes/_dados.ts:85-92`);
  - **integração com o Financeiro** (achado da revisão, B1): `carregarMedicaoDoBanco` embute
    `condicao:frn_condicoes(dias_pagamento, modo)` pelo código da medição (`lib/integracoes/financeiro.ts:456`) e
    calcula `diasPagamento` com isso (`:448`), que vira o vencimento enviado ao Financeiro
    (`vencimentoR40`, `:444-447`; `lib/regras/vencimento.ts`). Editar `dias_pagamento` mudaria o vencimento de
    medição de contrato já aprovado (para mais tarde, passando calado na checagem do banco; ou para antes,
    travando a solicitação).
  - Consequência: editar uma condição hoje mudaria parcelas e prazo de **contratos já aprovados e medições em
    curso** — exatamente o que a suposição 2 proíbe.
- Comportamento preso a código fixo (não a modo): tabela de preços só grava se o código for `SPOT_TABELA_FIXA`
  (`005:398`); atendimento só em `SPOT_MENSAL_CONSOLIDADO` (`005:886`); ficha testa
  `=== "SPOT_MENSAL_CONSOLIDADO"` (`[numero]/page.tsx:358`); formulário usa as constantes `EXCECAO`/`TABELA_FIXA`
  (`novo/_contrato.ts:17-18`, `_form.tsx:421,468`); material só aceita `MATERIAL_MEDIANTE_NF`
  (`005:135`, `005:962`); sugestão devolve códigos fixos (`005:103-122`, `lib/regras/condicoes.ts:253-286`).

**Novo** (mockup `pageCond`/`condForm`, linhas 379-414; suposições 1 e 2):
1. Menu ganha o grupo **"Configurações"** (selo "NOVO") com "Condições de pagamento" e "Modelo de contrato".
   Aparece para quem pode configurar (§1.7) e para o admin do hub (só leitura). Para os demais o grupo não aparece;
   link direto mostra "🔒 Você não tem acesso às Configurações" (mockup `semPermissao`, linha 374).
2. Tabela: Condição (nome + código), Faixa, Como paga (modo + resumo "30% / 30% / 40% · D+7"), Global
   ("Sim"/"Não"/"Só global"), Em uso ("N contratos", contando contratos não cancelados com o código), Situação
   (Ativa/Desativada), ações Editar / Desativar / Reativar. Chips Ativas / Desativadas / Todas. Banner
   "Mudança aqui vale só para contratos novos…". Texto "Não existe excluir…". Erro de carregamento com
   "Tentar de novo". Admin vê sem botões, com banner de só leitura.
3. **Editar** (modal): nome, faixa (texto), **"Como paga" (modo, editável — decisão D3 do João)**, prazo do
   Financeiro em dias (vazio = calendário; 0 a 120), parcelas (gatilho + %; adicionar/remover; soma 100) **ou**
   "quando paga" (modos sem lista), "Pode ser usada em contrato global", explicação. Código não muda. Aviso
   "N contratos usam esta condição (…). Eles continuam exatamente como estão." Se o modo mudar, aviso extra:
   "Contratos novos com esta condição passam a pagar como {modo novo}. Rascunhos com ela passam a valer assim no
   próximo salvamento." Salvar cria **versão nova** da condição.
4. **Nova condição**: os mesmos campos. Código gerado do nome (maiúsculas, sem acento, `_`, até 30 caracteres; se
   já existir, sufixo `_2`, `_3`…). Entra no fim da ordem e ativa. Colunas que a tela não mostra: `tipo` = nome,
   `observacao` = `null` (`tipo` é `not null`, `002:31`).
5. **Desativar** (modal do mockup, linhas 977-985, com o texto de rascunho ajustado): some da escolha em contratos
   novos; contratos **enviados ou aprovados** que a usam seguem com ela (inclusive na aprovação do José);
   **rascunhos e devolvidos** com ela precisam escolher outra antes de enviar (o envio confere a condição no
   catálogo, `008:34-35`) — o modal mostra a contagem e os números desses rascunhos; nada é apagado; reativar
   devolve como estava.
6. **Regras de integridade** (território dinheiro; o banco é a fonte):
   - **Modo editável** (D3). A proteção é a versão: contrato enviado/aprovado e medição ficam na versão antiga.
     Ao trocar o modo: modo sem lista ⇒ `parcelas = []` e "quando paga" obrigatório; modo `parcelas` ⇒ lista
     obrigatória e `gatilho = null` (check `frn_condicoes_lista`, `002:47`).
   - Comportamento passa a depender do **modo**, não do código, em tudo que era fixo por código e não é regra de
     material/exceção: tabela de preços (`005:398`), atendimento (`005:886`), ficha (`[numero]/page.tsx:358`),
     formulário (`novo/_contrato.ts:17-18`, `_form.tsx:421,468`).
   - `MATERIAL_MEDIANTE_NF`: modo travado em `parcelas` e não pode ser desativada (material só aceita esta,
     `005:135`, e a medição de material ignora o modo, `005:972-975`). `EXCECAO_APROVACAO`: modo travado em
     `excecao` e não pode ser desativada (emergencial é sugerido nela, `005:111`). Mensagem: "Esta condição é usada
     pelo sistema: o modo não muda e ela não pode ser desativada."
   - `so_global` = modo em (`tabela`, `consolidado`), sempre; com `so_global`, `permite_global` = true.
     Motivo: medição de tabela/consolidado só existe em contrato global (`005:976-992`).
   - Parcelas (modo `parcelas`): 1 a 10 linhas, gatilho de 3 a 200 caracteres, % inteiro de 1 a 100, soma 100.
     Marcas recalculadas ao salvar: `retencao` fica na linha que já a tinha (só pode ser a última); `final` =
     a última parcela não retida e a retida. Condição nova não cria retenção (a tela não oferece).
   - **"Exige justificativa" deixa de ser checkbox** e passa a ser derivado: `exige_justificativa = (modo =
     'excecao')`. Motivo (revisão, melhoria 4): `frn_enviar_contrato` exige `excecao_condicao`/`_justificativa`
     quando a flag está ligada (`008:36-37`), mas o formulário só mostra esses campos para exceção; uma condição
     `parcelas` com a flag viraria contrato impossível de enviar. O formulário passa a mostrar os campos pelo modo.
   - Sugestão (R-10) que caia numa condição **não permitida** para o contrato — desativada, ou que perdeu
     "permite global" — não é aplicada: `frn_salvar_contrato` testa `frn_condicao_permitida(v_sug, …)` e, se falso,
     `v_cond := null`; o rascunho fica sem condição e a pessoa escolhe (hoje recusaria o salvamento,
     `005:354-358`). Espelho em `condicaoEfetiva` (`novo/_contrato.ts:121-126`). A condição **escolhida à mão** e
     não permitida continua recusada.
   - Faixa é texto descritivo; os limites da sugestão automática continuam fixos no código (decisão D2). A tela
     mostra: "A sugestão automática segue as faixas fixas: até R$ 1.500; até R$ 5.000; até R$ 8.000; acima disso;
     manutenção com mais de 45 dias = mensal."
   - Edição concorrente: o salvamento leva a versão que a pessoa abriu; se mudou no meio, recusa
     "Esta condição foi alterada por outra pessoa. Abra de novo para ver a versão atual."
7. **"Vale só para contratos novos"** (suposição 2), definido assim:
   - cada contrato guarda **(código, versão)** da condição; o rascunho é **repinado na versão atual a cada
     salvamento** (quem salva vê no formulário a condição atual); do envio em diante a versão fica fixa;
   - José trocando a condição na aprovação pina a versão atual da condição escolhida;
   - aditivo de condição pina a versão atual da condição pedida no momento do pedido e a aplica na aprovação;
   - cada medição guarda a versão com que foi solicitada; prazo e modo dela vêm dessa versão — **no banco e na
     integração com o Financeiro** (`lib/integracoes/financeiro.ts` lê `frn_condicoes_versoes` por
     `(condicao_codigo, condicao_versao)` da medição, nunca `frn_condicoes`).
### 1.6 Seção E2 — Configurações: modelo de contrato com campos automáticos

**Hoje:** o documento é JSX fixo (`documento/_documento.tsx:39-177`), com a marca "Modelo provisório gerado pelo
sistema. O texto pode ser ajustado pela Manfac quando quiser." (`_documento.tsx:49-51`), renderizado de novo a
cada abertura (`documento/page.tsx:15-66`). `frn_registrar_documento` só carimba `documento_gerado_em` na 1ª
impressão após aprovação (`005:669-686`); não guarda qual texto foi usado.

**Novo** (mockup `pageModelo`/`renderPrev`, linhas 415-439; suposição 3):
1. Tela "Modelo de contrato": editor de texto livre; botões que inserem `{{campo}}` no cursor; pré-visualização ao
   lado com os dados do **CT-0001** (campos preenchidos em laranja); campo desconhecido aparece em vermelho com o
   aviso "Campo desconhecido: {{x}}. Ele sai assim no contrato." (salvar é permitido). "Descartar alterações" /
   "Salvar modelo" (habilitados só com alteração). Banner "Contratos já gerados não mudam… Já gerados com o
   modelo atual: … Última alteração do modelo: dd/mm/aaaa." Admin vê só leitura.
2. Campos (os 13 do mockup, `CAMPOS`, linha 62), todos calculados no servidor:

   | Campo | Valor |
   |---|---|
   | `numero` | CT-NNNN |
   | `fornecedor` | razão social |
   | `cnpj` | documento formatado (`formatarDocumento`) |
   | `valor` | total contratado com aditivos de valor aprovados; com material separado num contrato não-material: "R$ T (mão de obra R$ A + material R$ B)" |
   | `condicao` | "nome (CÓDIGO)" da versão pinada |
   | `parcelas` | o bloco de pagamento que a Cláusula 3 mostra hoje (`_documento.tsx:104-160`), em linhas de texto: frase do prazo; parcelas "1ª parcela: 30% — gatilho — R$ X"; ou a tabela de preços "serviço · unidade · R$ preço"; ou a frase do consolidado / da exceção (com justificativa) / do global por serviço; e a frase da retenção quando houver |
   | `inicio`, `fim` | dd/mm/aaaa |
   | `escopo` | escopo |
   | `obra` | rótulo da obra; global: "contrato global (guarda-chuva), sem obra vinculada" |
   | `classificacao` | rótulo; emergencial: "Emergencial (justificativa: …)" |
   | `centro_custo` | nome do CC |
   | `data_emissao` | data de hoje (Brasília) |

   Campo vazio sai como "[a preencher]" (como hoje, `_documento.tsx:34-35`).
3. O documento passa a ser: cabeçalho MANFAC/nº/emissão e bloco de assinaturas fixos (como hoje) + o texto do
   modelo com os campos substituídos, em `white-space: pre-wrap`, como texto (React escapa). A marca "Modelo
   provisório" sai.
4. **Versão 1** do modelo = o texto atual do documento convertido para campos (Apêndice A). O CT-0001 continua
   com o mesmo conteúdo.
5. Cada salvamento cria versão nova. O contrato guarda a versão usada na **1ª geração** (o mesmo momento que hoje
   carimba `documento_gerado_em`); depois disso o documento dele sempre usa essa versão. Antes da 1ª geração, usa
   a atual. Edição concorrente recusada como nas condições.

### 1.7 Quem pode o quê nas Configurações (suposição 1)

- **Altera:** `aprovador_financeiro` (José) e o papel novo `configurador` ("quem ele indicar"), concedido por SQL a
  pedido do José, como os papéis de hoje (`001:10`). Hoje ninguém tem `configurador`.
- **Vê sem alterar:** admin do hub.
- **Não vê:** os demais (Eduardo incluído, como no mockup).
- O papel `configurador` **não** dá "ver tudo" nem operar contratos: `frn_tem_algum_papel` (`001:107-118`) hoje
  conta qualquer papel ativo e alimenta `frn_ve_tudo` (`001:120-130`) e `frn__pode_operar` (`005:75-84`); passa a
  contar só os dois aprovadores.
- **Bug medido que precisa ser corrigido para o admin ver as Configurações:** `lerPapeis` chama
  `supabase.rpc("frn_e_admin", …)` com o cliente da pessoa (`lib/auth/papeis.ts:27`), mas `frn_e_admin(text)`
  não é executável por `authenticated` (`001:178-179`, conferido pela verificação `005:1417-1422`). Resultado:
  `papeis.admin` é sempre `false` e loga erro a cada página. Hoje nada usa `papeis.admin` (grep sem uso), por isso
  não apareceu. Correção: usar `frn_sou_admin()` (sem argumento, lê o próprio token; executável por
  `authenticated`, `001:173-174`).

### 1.8 Reenvio após devolução (suposição 7)

**Hoje:** devolver volta para `rascunho` e zera as duas aprovações (`005:531-535`); o dono edita em
`/contratos/CT-…/editar` (`[numero]/editar/page.tsx:12-46`) e reenvia; `frn_enviar_contrato` zera aprovações e
`devolvido_*` (`008:46-50`). Ou seja, o reenvio **já recomeça do zero**.

**Novo:** o comportamento fica; muda o que se vê: botão "Ajustar e reenviar" na ficha (§1.3), evento
"Reenviado para aprovação do Eduardo" (quando havia `devolvido_em`), e-mail 1 para o Eduardo.

---

## 2. Mudanças de schema (migrations 009–012)

Padrão de `.claude/rules/sql.md` do hub: `begin … commit`, seção 0 que aborta se o pré-requisito faltar, bloco de
verificação depois do `commit` (uma linha por invariante, `OK` / `*** FALHOU ***`), idempotente (o teste
`tests/sql/reaplicacao.test.ts` reaplica tudo). **009, 010, 011 e 012 são aplicadas na mesma sessão, nesta ordem,
antes do deploy do app** (o app novo lê colunas que só existem depois delas; o app velho continua funcionando
depois delas porque nenhuma coluna existente muda de nome ou de tipo).

**Regras de escrita das quatro migrations (revisão, melhorias 1 e 2):**
- Ordem dentro do arquivo: (1) criar tabela/coluna **sem** FK nem check; (2) preencher; (3) só então
  `drop constraint if exists` + `add constraint` (FKs e checks validam as linhas existentes ao nascer).
- Toda constraint nova entra como `alter table … drop constraint if exists X; alter table … add constraint X …`
  (reaplicação sem erro). Coluna nova: `add column if not exists`.
- Toda função **nova** (inclusive assinatura nova de função existente) recebe
  `revoke all on function … from public, anon, authenticated; grant execute … to service_role;` explícitos — o
  Supabase concede EXECUTE por padrão a `public`. `create or replace` de função existente preserva os grants do
  `005`, mas a verificação confere de novo.
- Verificação de privilégio em toda migration: `has_function_privilege('authenticated', f, 'EXECUTE')` e
  `('anon', …)` falsos para **cada** função criada ou alterada nela (inclui `frn_etapa`, `frn__nome`,
  `frn_registrar_aviso`, `frn_dias_pagamento(text,int,int)`).

### 2.1 `009_frn_condicoes_versoes.sql` — condições versionadas, Configurações, papel `configurador`, aditivos

**Seção 0:** aborta se `008` não estiver aplicada (`pg_get_functiondef(frn_enviar_contrato)` sem
"Anexe a proposta comercial") ou se `frn_condicoes` tiver menos de 12 linhas.

**Passo 1 — tabela nova `frn_condicoes_versoes`** (imutável):

| Coluna | Tipo / regra |
|---|---|
| `codigo` | `text not null` (FK para `frn_condicoes(codigo)` no passo 3) |
| `versao` | `int not null check (versao >= 1)`; PK `(codigo, versao)` |
| `acao` | `text not null check (acao in ('seed','criada','editada','desativada','reativada'))` |
| `nome`, `tipo`, `faixa`, `modo`, `parcelas`, `gatilho`, `dias_pagamento`, `permite_global`, `so_global`, `exige_justificativa`, `pratica`, `observacao`, `ativo` | mesmos tipos e checks de `frn_condicoes` (`002:29-48`), incluindo `frn_condicoes_lista` e `frn_condicoes_so_global` |
| `criado_por` | `text not null` (e-mail normalizado ou `'seed 009'`) |
| `criado_em` | `timestamptz not null default now()` |

- Trigger de imutabilidade (update/delete/truncate → exceção), como `004:188-204`.
- RLS ligada; `revoke all from anon, authenticated`; `grant select to authenticated`; policy
  `using ((select public.frn_email()) is not null)` (igual `frn_condicoes`, `002:54-57`). Motivo: quem vê um
  contrato precisa ler a condição dele; as condições já são legíveis assim hoje.
- **Escrita: ninguém direto.** Só pelas funções abaixo (service_role).

**Passo 1 — colunas novas (sem constraint ainda):**

| Tabela | Coluna |
|---|---|
| `frn_condicoes` | `versao int not null default 1`, `atualizado_por text`, `atualizado_em timestamptz` |
| `frn_contratos` | `condicao_versao int`, `parcelas_ajustadas jsonb` |
| `frn_medicoes` | `condicao_versao int` |
| `frn_aditivos` | `condicao_para_versao int` |

**Passo 2 — preencher** (só coluna nova; nenhuma coluna existente muda):
1. `insert into frn_condicoes_versoes … select codigo, 1, 'seed', <campos>, 'seed 009', now() from frn_condicoes
   on conflict do nothing` — as 12 viram versão 1, conteúdo idêntico.
2. `update frn_contratos set condicao_versao = 1 where condicao_codigo is not null and condicao_versao is null`
   (hoje: só o CT-0001 — **única escrita em linha de contrato, só na coluna nova; não toca `atualizado_em`**).
3. Mesmo para `frn_medicoes` e `frn_aditivos` (hoje 0 linhas; update genérico).

**Passo 3 — constraints** (cada uma com `drop … if exists` antes):

| Tabela | Constraint |
|---|---|
| `frn_condicoes_versoes` | FK `codigo` → `frn_condicoes(codigo)` |
| `frn_condicoes` | FK `(codigo, versao)` → versões, `deferrable initially deferred` (as duas são gravadas na mesma transação) |
| `frn_contratos` | FK `(condicao_codigo, condicao_versao)` → versões; check `(condicao_codigo is null) = (condicao_versao is null)` |
| `frn_contratos` | `frn_ct_parcelas_ajustadas`: `check (parcelas_ajustadas is null or (status in ('aguardando','aprovado','encerrado') and jsonb_typeof(parcelas_ajustadas) = 'array' and jsonb_array_length(parcelas_ajustadas) between 1 and 10))` (revisão, B2) |
| `frn_medicoes` | FK `(condicao_codigo, condicao_versao)`; check `condicao_versao is not null` |
| `frn_aditivos` | FK `(condicao_para, condicao_para_versao)`; check `(condicao_para is null) = (condicao_para_versao is null)` |
| `frn_papeis` | `frn_papeis_papel_valido` (`001:53-54`) aceita também `'configurador'` |

**Funções alteradas (create or replace, corpo inteiro):**

| Função | Mudança |
|---|---|
| `frn_dias_pagamento` | **função nova** `(p_codigo text, p_versao int, p_excecao_dias int)` lendo a versão (revoke/grant explícitos); a de 2 argumentos é **dropada** na mesma transação, depois de trocar o único chamador (`005:1201`) |
| `frn_parcelas_mo` (`005:194-254`) | lê a versão pinada; `arr := coalesce(c.parcelas_ajustadas, v.parcelas)`; se `parcelas_ajustadas` não for nulo e o tamanho for diferente do da versão, **levanta exceção** "Parcelas ajustadas incoerentes com a condição (contrato CT-…)" — falha alta em dinheiro; pelos caminhos de escrita abaixo o estado é inalcançável |
| `frn_salvar_contrato` (`005:304-411`) | pina `condicao_versao` = versão atual; **grava sempre `parcelas_ajustadas = null`** (B2); sugestão não permitida → `v_cond := null` (§1.5 item 6); tabela de preços grava quando o **modo** da versão é `tabela` (troca o teste por código de `005:398`) |
| `frn_solicitar_medicao` (`005:936-1099`) | `k` lido da versão pinada do contrato (material: versão atual de `MATERIAL_MEDIANTE_NF`, que tem modo travado); grava `condicao_versao` na medição |
| `frn_registrar_solicitacao_fin` (`005:1153-1215`) | prazo com `frn_dias_pagamento(m.condicao_codigo, m.condicao_versao, m.excecao_dias)` |
| `frn_registrar_atendimento` (`005:874-902`) | testa o modo `consolidado` da versão pinada em vez do código (`005:886`) |
| `frn_criar_aditivo` (`005:707-767`) | aditivo de condição grava `condicao_para_versao` = versão atual; `k` lido dessa versão |
| `frn_aprovar_aditivo` (`005:769-839`) | (a) **ordem**: parte `condicoes` de aditivo de valor recusa com contratação pendente ("O Eduardo aprova o aditivo primeiro."); (b) aditivo de condição aplicado grava no contrato `condicao_versao = a.condicao_para_versao`, `parcelas_ajustadas = null` e, quando a nova não é exceção, `excecao_* = null`; nas medições `solicitada` da MO grava também `condicao_versao` |
| `frn_devolver_aditivo` (`005:841-869`) | **etapa**: aditivo de valor — `contratacao` só com contratação pendente; `condicoes` só depois dela |
| `frn_tem_algum_papel` (`001:107-118`) | `and p.papel in ('aprovador_contratacao','aprovador_financeiro')` |

(Os aditivos ficam aqui, e não na 010, para nenhuma função ser recriada em dois arquivos.)

**Funções novas (security definer, `search_path` fixo, só `service_role`):**

| Função | O que faz |
|---|---|
| `frn_pode_configurar(p_email) → boolean` | `frn_tem_papel(e,'aprovador_financeiro') or frn_tem_papel(e,'configurador')`; nunca `NULL` |
| `frn_salvar_condicao(p_ator, p_codigo text, p_versao_base int, p jsonb) → text` | `p_codigo` nulo = nova. Recusa sem `frn_pode_configurar`; valida §1.5 item 6 (modo editável, exceto nas duas do sistema; `exige_justificativa` e `so_global` derivados do modo; `tipo` = nome e `observacao` = null na criação); em edição, `for update` na linha atual e recusa se `versao <> p_versao_base`; grava versão `n+1` (`criada`/`editada`) e atualiza `frn_condicoes` (conteúdo, `versao`, `atualizado_*`). Devolve o código |
| `frn_definir_condicao_ativa(p_ator, p_codigo, p_versao_base, p_ativo) → void` | Mesmas checagens de papel e versão; recusa desativar `MATERIAL_MEDIANTE_NF`/`EXCECAO_APROVACAO`; grava versão `n+1` (`desativada`/`reativada`) com o mesmo conteúdo e atualiza `ativo` |

`frn_condicao_permitida` (`005:125-139`) **não muda**: continua olhando o catálogo atual, que é o que importa para
escolher condição nova.

**Verificação (pós-commit):** RLS ligada em `frn_condicoes_versoes`; `authenticated` só SELECT, `anon` nada;
12 versões `v1` com conteúdo **igual** a `frn_condicoes` (comparação campo a campo); todo contrato com código tem
versão; nenhuma medição/aditivo sem versão; trigger de imutabilidade presente; `frn_dias_pagamento(text,int)` não
existe; `frn_pode_configurar(null)` = false; privilégios das funções criadas/alteradas; constraint
`frn_ct_parcelas_ajustadas` presente e validada; nenhum contrato com `parcelas_ajustadas`.
O caso "e-mail só com `configurador` não vê tudo" é testado no pglite, não em produção.

### 2.2 `010_frn_fluxo_em_ordem.sql` — ordem Eduardo → José, alteração pelo José

**Seção 0:** aborta se `009` não estiver aplicada (`to_regclass('public.frn_condicoes_versoes')`).

**Schema:**
- `frn_eventos_tipo_check` (`004:170-179`) recriado com os tipos de hoje + `condicoes_alteradas`.
- Constraint `frn_ct_ordem` em `frn_contratos`:
  `check (status <> 'aguardando' or contratacao_aprovada_em is not null or condicoes_aprovadas_em is null)`,
  criada **`not valid` e mantida assim** (decisão D1: o CT-0001 tem a aprovação do José anterior à do Eduardo; as colunas existentes dele não são alteradas — a 009 só preenche `condicao_versao = 1`). Vale para toda escrita nova; todos os caminhos de escrita sobre o CT-0001 (Eduardo aprova, devolve)
  a satisfazem (conferido na revisão).

**Funções alteradas:**

| Função | Mudança |
|---|---|
| `frn_enviar_contrato` (`008:11-56`) | condição lida da versão pinada (`exige_justificativa`, `modo`); evento "Enviado para aprovação do Eduardo" ou, se `devolvido_em` não era nulo, "Reenviado para aprovação do Eduardo". Resto idêntico (continua sem exigir proposta e exigindo certidões de fornecedor novo) |
| `frn_aprovar_contrato` (`005:484-512`) | `condicoes` recusa com contratação pendente ("O Eduardo aprova a contratação primeiro."); evento "Contratação aprovada por {nome}" / "Condições de pagamento aprovadas por {nome}" |
| `frn_devolver_contrato` (`005:514-540`) | `contratacao` só com contratação pendente; `condicoes` só com contratação aprovada; senão "Este contrato não está na sua etapa." Efeito de hoje (volta a rascunho, zera as duas, grava motivo) **+ `parcelas_ajustadas = null`** (B2) |

**Funções novas** (revoke/grant explícitos):

| Função | O que faz |
|---|---|
| `frn__nome(p_email) → text` | nome do cadastro do hub (`auth.users.raw_user_meta_data` → `full_name`, `name`, `nome`; senão parte antes do @), mesma cascata de `lib/auth/nome.ts:1-13`. `stable`, `security definer`, `set row_security = off`, só service_role (lê `auth.users`) |
| `frn_etapa(c frn_contratos) → text` | a etapa de §1.3 (espelho de `lib/regras/etapa.ts`); usada na verificação e nos testes; só service_role |
| `frn_alterar_e_aprovar_condicoes(p_ator, p_id, p jsonb) → boolean` | `p = {condicao_codigo, parcelas_pct?: int[], excecao_dias?, excecao_justificativa?}`. Papel `aprovador_financeiro`; `for update`; `aguardando`, contratação aprovada, condições pendentes. Valida §1.2 item 3 (permitida ou a atual; % inteiros 1–100, **mesma quantidade de parcelas da versão atual da condição escolhida**, soma 100; exceção 0–120 + justificativa 5–1.000; `tabela` exige linhas). Recusa se nada mudou ("Nada foi alterado. Use Aprovar condições."). Grava `condicao_codigo`, `condicao_versao` (atual), `parcelas_ajustadas` (`null` se os % forem os da versão). Exceção: `excecao_dias`, `excecao_justificativa` e `excecao_condicao` = "Pagamento em N dias após a aprovação da medição" / "Pagamento à vista". Saindo de exceção: `excecao_* = null`. Evento `condicoes_alteradas` com `dados = {antes:{codigo,versao,parcelas,excecao_dias,excecao_justificativa}, depois:{…}, justificativa}` e texto da §1.3 item 5. Depois faz o mesmo que a aprovação de `condicoes` e chama `frn__liberar_contrato`. Devolve se liberou |

**CT-0001 (decisão D1 do João, 13/10): nenhuma escrita nas colunas existentes do CT-0001 (a 009 só preenche `condicao_versao = 1`).** Pelo §1.3 ele já está na etapa `eduardo`
(contratação nula). A aprovação do José de 11/10 vale: quando o Eduardo aprovar, `frn__liberar_contrato` libera
(homologado = true). E-mail 3b para o solicitante (José), cópia Eduardo.

**Verificação:** `frn_ct_ordem` existe (`not valid`); tipo `condicoes_alteradas` no check;
`frn_alterar_e_aprovar_condicoes`, `frn__nome`, `frn_etapa` só service_role; `frn_etapa(CT-0001) = 'eduardo'`
(lida, sem escrita); `frn_enviar_contrato` sem "Anexe a proposta" e com "anexe as certidões" (as duas linhas da
`008:64-70`).

### 2.3 `011_frn_modelo_contrato.sql` — modelo de contrato versionado

**Tabela nova `frn_modelos_contrato`** (imutável):

| Coluna | Tipo / regra |
|---|---|
| `versao` | `int primary key check (versao >= 1)` |
| `texto` | `text not null check (length(btrim(texto)) between 1 and 50000)` |
| `criado_por` | `text not null` |
| `criado_em` | `timestamptz not null default now()` |

- Trigger de imutabilidade; RLS ligada; `revoke all from anon, authenticated`; `grant select to authenticated`;
  policy `using ((select public.frn_email()) is not null)` (todo logado que vê um contrato abre o documento).
- **Escrita só por** `frn_salvar_modelo`.
- Seed: versão 1 = Apêndice A, `criado_por = 'seed 011'`, `on conflict do nothing`.

**Coluna nova:** `frn_contratos.modelo_versao int`; depois, FK → `frn_modelos_contrato(versao)` e check
`modelo_versao is null or documento_gerado_em is not null`. Sem backfill (CT-0001 nunca gerou documento:
`documento_gerado_em = NULL`, medido).

**Funções:**

| Função | O que faz |
|---|---|
| `frn_salvar_modelo(p_ator, p_versao_base int, p_texto text) → int` (nova) | `frn_pode_configurar`; `pg_advisory_xact_lock` fixo do modelo; recusa se `max(versao) <> p_versao_base`; insere `max+1`. Devolve a versão |
| `frn_registrar_documento` (`005:669-686`, alterada) | ao carimbar `documento_gerado_em` grava também `modelo_versao = max(versao)` |

**Verificação:** RLS/grants; trigger; 1 versão; privilégios; nenhum contrato com `modelo_versao`.

### 2.4 `012_frn_avisos.sql` — registro dos e-mails

**Tabela nova `frn_avisos`** (modelo `fin_avisos`, `financeiro/supabase/hub-install/008_fin_decisoes.sql`):

| Coluna | Tipo / regra |
|---|---|
| `id` | `uuid pk default gen_random_uuid()` |
| `contrato_id` | `uuid not null references frn_contratos(id) on delete restrict` |
| `aditivo_id` | `uuid references frn_aditivos(id)` |
| `evento` | `text not null check (evento in ('enviado','contratacao_aprovada','aprovado','aprovado_alterado','devolvido','aditivo_pedido','aditivo_contratacao_aprovada','aditivo_aprovado','aditivo_devolvido','teste'))` |
| `para` | `text not null` (e-mails normalizados separados por vírgula) |
| `copia` | `text` |
| `assunto` | `text not null` |
| `situacao` | `text not null check (situacao in ('enviado','falhou','sem_configuracao'))` |
| `erro` | `text` (só o código SMTP, nunca a mensagem do servidor) |
| `criado_em` | `timestamptz not null default now()` |

- RLS ligada, `revoke all from anon, authenticated`, **sem** grant nem policy (como `fin_avisos`): ninguém lê pelo
  app; diagnóstico pelo PAT.
- Escrita só por `frn_registrar_aviso(p_contrato, p_aditivo, p_evento, p_para, p_copia, p_assunto, p_situacao,
  p_erro)`, service_role (revoke/grant explícitos).

### 2.5 Consultas de conferência antes/depois

As consultas, a ordem e a confirmação do ref estão no roteiro do plano (`plano-melhorias-2026-10.md`, §4). O que
tem de bater: CT-0001 com o mesmo hash das colunas existentes antes/depois (as colunas novas ficam
`condicao_versao = 1`, `parcelas_ajustadas = null`, `modelo_versao = null`); contagens de eventos, anexos,
aditivos e medições iguais; versão 1 de cada condição igual à linha de `frn_condicoes` nas colunas originais;
`frn_parcelas_mo(CT-0001)` idêntica antes/depois; todas as verificações das 009–012 em `OK`.

---

## 3. E-mail: como os irmãos fazem e o que será feito aqui

**Neste sistema: não existe** (§1.4).

**Financeiro** (`D:\fornecedores-work\financeiro-reenvio`, `main` `63270ff`, Next 16.3.5 como aqui):
- Provedor: caixa da **Locaweb** por SMTP com `nodemailer` 9.1.1 (`package.json:25`).
- `lib/avisos/configuracao.ts:23-33` lê `SMTP_HOST`, `SMTP_PORTA` (padrão 465), `SMTP_USUARIO`, `SMTP_SENHA`,
  `SMTP_REMETENTE`; sem elas devolve `null` e o aviso fica `sem_configuracao` (o app não cai).
  `codigoDoErroSmtp` (linhas 39-44) guarda só o código do erro.
- `lib/avisos/smtp.ts:11-40` — `createTransport` com `requireTLS` na 587, timeouts de 15 s.
- `lib/avisos/tentativas.ts:27-40` — repete em recusa 4xx após 30 s e 90 s (a Locaweb responde `EMESSAGE 451`
  às vezes; `docs/deploy-easypanel.md:59-60` do Financeiro).
- `lib/avisos/avisar.ts:48-80` — nunca lança; registra cada envio em `fin_avisos`; chamado em `after()`
  (`app/api/integracoes/medicoes/route.ts:97`).
- **Hub** (`login-system`) usa o mesmo par nodemailer + `SMTP_*` no relatório diário
  (`app/api/obras/relatorio-diario/route.ts:77-88,145-154`), e `docs/infra/variaveis-e-deploy.md:69-73` diz que as
  cinco variáveis são **as mesmas do app `compras`**.

**`after()` em Server Action — conferido** na doc do Next 16.3.5 instalada em
`D:\fornecedores-work\backlog-fornecedores\node_modules\next\dist\docs\01-app\03-api-reference\04-functions\after.md`:
seção "In Route Handlers and Server Functions" (o callback roda depois da resposta em Server Functions) e tabela
"Platform Support": "Node.js server — Yes" (o app roda `output: "standalone"` em Node, `next.config.ts`). Limite: se
o processo reiniciar com envio pendente, o e-mail se perde sem registro — aceito (o banco já está gravado; o aviso
é complementar).

**Proposta (mínimo, copiando o Financeiro):**
- `package.json`: `nodemailer` 9.1.1 e `@types/nodemailer` 8.0.1 (versões do Financeiro).
- `lib/avisos/configuracao.ts`, `smtp.ts`, `tentativas.ts`: cópia do Financeiro; `smtp.ts` ganha `cc` e `html`.
- `lib/avisos/mensagens.ts` (puro, testável): `destinatarios(evento, dados, papeis)` e `montarMensagem(evento,
  dados)` com os textos de §1.4; escapa todo valor dinâmico no HTML.
- `lib/avisos/avisar.ts` (`server-only`): `avisarContrato(evento, contratoId, extra?)` e
  `avisarAditivo(evento, aditivoId, extra?)`; leem contrato, aditivo, fornecedor, papéis e o evento
  `condicoes_alteradas` com o cliente de serviço; enviam; registram via `frn_registrar_aviso`; nunca lançam.
- Chamadas, sempre `after(() => …)` (de `next/server`) depois de uma escrita bem-sucedida:
  `enviarParaAprovacaoAction` (`contratos/novo/_actions.ts:132-155`) e a ação de pedir aditivo
  (`[numero]/_ficha/_actions.ts`) — Frente B; `aprovarContratoAction`, a nova `alterarEAprovarCondicoesAction`,
  `devolverContratoAction`, `homologarFornecedorAction` (avisa "aprovado" para cada contrato daquele fornecedor que
  virou `aprovado` nesta chamada), `aprovarAditivoAction`, `devolverAditivoAction` (`aprovacoes/_actions.ts`) —
  Frente E.
- Variáveis no EasyPanel do app `fornecedores`: as cinco `SMTP_*`, **copiadas do Environment do app Compras**
  (decisão D5); `SMTP_REMETENTE` = mesmo endereço da caixa (remetente diferente dá `EENVELOPE 453`, Financeiro
  `docs/deploy-easypanel.md:268`). Atualizar `.env.example`.

---

## 4. Arquivos por frente e paralelismo

Critério: **nenhum arquivo em duas frentes**. A Frente 0 define os contratos compartilhados e roda antes; as
frentes A–H rodam em paralelo depois dela. Detalhe de passos, branches e ordem de integração no plano.

### Frente 0 — contratos compartilhados (antes de todas)
- `lib/regras/etapa.ts` (novo): `type Etapa`, `etapaDoContrato(c)`, `rotuloEtapa`, `corEtapa`, `desdeDaEtapa`.
- `lib/regras/condicoes.ts`: tipo `CondicaoVersao`, `condicaoDaVersao(v, parcelasAjustadas)` → `Condicao`;
  `condicaoPorCodigo(codigo, catalogo)`; `exigeJustificativa` derivado do modo. `CONDICOES` fica como espelho do
  seed v1 (o teste `tests/sql/paridade.test.ts:98` continua valendo).
- `lib/tipos.ts` (`EVENTO_TIPOS` + `condicoes_alteradas`), `lib/tipos-db.ts` (colunas novas).
- `components/ui/pill.tsx`: `PillEtapa`.
- `lib/auth/papeis.ts`: `configurador`, admin via `frn_sou_admin()`, `podeConfigurar`, `veConfiguracoes`.
- `lib/tipos.ts` também recebe **só os tipos** do aviso: `EventoAvisoContrato`, `EventoAvisoAditivo` e os tipos das
  funções `AvisarContrato`/`AvisarAditivo`. A **porta** (`lib/avisos/porta.ts`) é inteira da Frente H.
- `lib/condicoes/servidor.ts` (novo): carregador do catálogo atual (`carregarCatalogo`) e das versões pinadas
  (`versoesDe(pares (codigo, versao))`, `condicaoDoContrato`), para C, D, E e F lerem a condição sem esperar a B.
- `app/(modulo)/contratos/[numero]/_ficha/tipos.ts` (novo): os tipos `FichaDados` e `Ficha` (o formato que
  `_ficha/dados.ts` entrega e `[numero]/page.tsx` consome), já com os campos novos (etapa, condição da versão
  pinada, `parcelasAjustadas`, `modeloVersao`). `calculo.ts` (B) passa a importar daqui.

### Frente A — banco
- `supabase/hub-install/009…012` (novos).
- `tests/sql/*`: novos `condicoes-versoes.test.ts`, `fluxo-em-ordem.test.ts`, `modelo.test.ts`; alterar
  `contratos.test.ts` (`:335` "qualquer ordem" e `:404` CA-3.3 mudam), `aditivos.test.ts`, `rls.test.ts`,
  `instalacao.test.ts`, `paridade.test.ts`, `reaplicacao.test.ts`, `medicoes.test.ts`; `tests/casos-regras.json` se a
  paridade usar.

### Frente B — catálogo de condições versionado no app (+ integração Financeiro)
- `lib/regras/parcelas.ts`, `lib/regras/aditivo.ts` (o carregador `lib/condicoes/servidor.ts` é da Frente 0).
- **`lib/integracoes/financeiro.ts`** (B1: `carregarMedicaoDoBanco` lê a versão pinada).
- `app/(modulo)/contratos/novo/{_catalogo.ts,_contrato.ts,_condicao.tsx,_form.tsx,_ler.ts,_actions.ts,page.tsx}`.
- `app/(modulo)/contratos/[numero]/_ficha/{calculo.ts,dados.ts,_actions.ts,acoes.tsx}`.
- `app/(modulo)/medicoes/_dados.ts` (só a fonte da condição).
- Testes: `tests/regras/{condicoes,parcelas,aditivo}.test.ts`, `tests/contratos/{form,actions}.test.ts`,
  `tests/ficha/*`, `tests/medicoes/*`, **`tests/integracoes/financeiro.test.ts`**.

### Frente C — lista: busca e etapa
- `app/(modulo)/contratos/page.tsx`, `_lista.ts`, `_busca.tsx` (novo). Teste: `tests/contratos/lista.test.ts`.

### Frente D — ficha: etapa atual e linha do tempo
- `app/(modulo)/contratos/[numero]/page.tsx`, `lib/eventos/linha-do-tempo.ts`, `components/ui/linha-do-tempo.tsx`.
  Teste: `tests/eventos/linha-do-tempo.test.ts`.

### Frente E — aprovações em ordem e José alterando
- `app/(modulo)/aprovacoes/{page.tsx,_cartao.tsx,_actions.ts,_editor-condicao.tsx}`,
  `aprovacoes/_lib/{cartoes.ts,permissoes.ts,servidor.ts,dados.ts,linhas.ts,condicao.ts}`.
- **Não** toca `app/(modulo)/layout.tsx` (é da G) e mantém a assinatura `montarCartoes(d, papeis)` e
  `carregarAprovacoes(supabase)` que o layout usa.
- Testes: `tests/aprovacoes/*`.

### Frente F — modelo de contrato
- `app/(modulo)/contratos/[numero]/documento/{page.tsx,_documento.tsx}`, `lib/modelo/campos.ts` (novo),
  `app/(modulo)/configuracoes/modelo/{page.tsx,_editor.tsx,_actions.ts}` (novos).
- Testes: `tests/contratos/documento.test.tsx`, `tests/modelo/campos.test.ts` (novo).

### Frente G — Configurações: condições, menu e layout
- `app/(modulo)/configuracoes/condicoes/{page.tsx,_tabela.tsx,_form.tsx,_actions.ts}` (novos),
  `app/(modulo)/configuracoes/_sem-acesso.tsx` (novo; F importa),
  `components/app/{menu-itens.ts,menu-lateral.tsx,app-shell.tsx}`, **`app/(modulo)/layout.tsx`** (passa
  `veConfiguracoes` ao `AppShell`; hoje `contarPendencias` devolve `undefined` para quem não é aprovador,
  `layout.tsx:23`, e o admin precisa do grupo mesmo sem contador).
- Testes: `tests/menu-lateral.test.tsx`, `tests/app-shell.test.tsx`, `tests/configuracoes/*` (novo).

### Frente H — e-mail
- `lib/avisos/{porta,configuracao,smtp,tentativas,mensagens,avisar}.ts` (novos). **A porta é só da H**: exporta
  `avisarContrato`/`avisarAditivo` com os tipos definidos pela Frente 0 em `lib/tipos.ts`. Como B e E chamam a
  porta, a **H entra no `feat/melhorias` logo depois da A**, e B e E fazem o passo das chamadas `after()` por
  último, depois de atualizar o branch com a H.
- `package.json`, `package-lock.json`, `.env.example`.
- Testes: `tests/avisos/{mensagens,tentativas,configuracao}.test.ts` (novos).

---

## 5. Critérios de aceite

Marcação: **[SQL]** teste em `tests/sql` (pglite); **[TS]** teste vitest puro/componente; **[Prod]** conferência
no banco/tela depois do deploy.

### Busca (A)
- **CA-A1** [TS] "davi", "DAVI", "Davi Cristiano" encontram o CT-0001; "joão" casa "JOAO".
- **CA-A2** [TS] "32542", "32.542.450" e "32542450000100" encontram pelo CNPJ; "3254" não casa CNPJ, só número.
- **CA-A3** [TS] "0001", "CT-0001", "ct 1", "ct-1" encontram o CT-0001.
- **CA-A4** [TS] busca + chip de status + chip de classificação combinam (E); contador "N de M contratos".
- **CA-A5** [TS] sem resultado: mensagem com o termo e os botões certos (com e sem filtro ligado).
- **CA-A6** [TS] sub-linha de aditivo aparece quando o contrato pai casa.
- **CA-A7** [TS] chip "Devolvido" conta e mostra só contratos devolvidos (sem sub-linha de aditivo devolvido);
  "Rascunho" deixa de contá-los; aditivo devolvido aparece em "Todos".

### Aprovação em ordem (B)
- **CA-B1** [SQL] José aprovando `condicoes` com contratação pendente é recusado; [TS] o botão não aparece.
- **CA-B2** [SQL] Eduardo aprova → `frn_etapa = 'jose'`, evento com nome; [TS] e-mail 2 (Para José, Cópia solicitante).
- **CA-B3** [SQL] José aprova sem alterar → `aprovado`; [TS] e-mail 3b.
- **CA-B4** [SQL] José troca a condição → novo código e versão atual, evento `condicoes_alteradas` com antes/depois,
  `aprovado`, Eduardo não aprova de novo; [TS] e-mail 3 com Antes/Depois.
- **CA-B5** [SQL] José ajusta % → soma ≠ 100, % fora de 1–100, quantidade diferente: recusa; válido: grava
  `parcelas_ajustadas` e `frn_parcelas_mo` usa os novos % (paridade com o TS).
- **CA-B6** [SQL] troca para exceção sem prazo 0–120 ou sem justificativa: recusa; com: grava prazo, justificativa
  no evento e `frn_registrar_solicitacao_fin` respeita o prazo. Saindo de exceção, `excecao_*` zerados.
- **CA-B7** [SQL] condição não permitida, `tabela` sem linhas, "nada mudou": recusa com a mensagem certa.
- **CA-B8** [SQL] Eduardo devolvendo na etapa do José, ou José na do Eduardo: recusa; devolução válida volta a
  rascunho e zera as duas.
- **CA-B9** [SQL] fornecedor novo: só libera com contratação + condições + homologação; [TS] e-mail "aprovado" sai
  uma vez, quando liberou.
- **CA-B10** [SQL] admin, solicitante e `configurador` não aprovam nem devolvem; `configurador` não vê contrato alheio
  nem opera.
- **CA-B11** [SQL] aditivo de valor: José antes do Eduardo é recusado; aditivo de condição continua só José.
- **CA-B12** [SQL] reenvio após devolução: evento "Reenviado para aprovação do Eduardo", etapa `eduardo`.
- **CA-B13** [SQL] (B2) fornecedor novo: José altera os % e aprova → etapa homologação → José devolve →
  `parcelas_ajustadas` nulo; dono troca para condição de 2 parcelas, salva, reenvia; Eduardo e José aprovam,
  homologa → `frn_parcelas_mo` usa as parcelas da condição nova. Variante: rascunho repinado em versão com outro
  número de parcelas. `update` direto que deixe `parcelas_ajustadas` em rascunho é barrado pelo check.
- **CA-B14** [SQL] CT-0001 (estado de produção reproduzido no pglite: aguardando, José aprovado, Eduardo não):
  depois de 009–012 a linha é idêntica nas colunas existentes; Eduardo aprova → `aprovado`.

### Etapa (C)
- **CA-C1** [TS] `etapaDoContrato` cobre as 8 etapas de §1.3; [SQL] `frn_etapa` dá o mesmo resultado (paridade).
- **CA-C2** [TS] lista mostra "Aguardando Eduardo"/"Aguardando José"/"Devolvido"; ficha mostra a caixa da etapa,
  o "desde" e o botão certo por papel.
- **CA-C3** [TS] linha do tempo termina com o item "agora"; aprovado não tem item "agora".

### E-mail (D)
- **CA-D1** [TS] `destinatarios` dá Para/Cópia das tabelas de §1.4 (5 de contrato + 5 de aditivo), sem repetir.
- **CA-D2** [TS] sem `SMTP_*`, nada é enviado e o aviso fica `sem_configuracao`; 4xx tenta de novo (espera falsa);
  5xx não.
- **CA-D3** [TS] erro no envio não muda o resultado da Server Action.
- **CA-D4** [TS] razão social `<b>X & Y</b>` e motivo com `<script>` saem escapados no HTML; assunto sem quebra.
- **CA-D5** [Prod] um envio real chega pela caixa da Locaweb; `frn_avisos` registra `enviado`.

### Condições (E1)
- **CA-E1** [SQL] `frn_salvar_condicao`/`frn_definir_condicao_ativa` recusam Eduardo, solicitante e admin; aceitam
  José e `configurador`. [TS] grupo "Configurações" só para José/`configurador`/admin; admin sem botões; link direto
  para os demais mostra a tela de sem acesso.
- **CA-E2** [SQL] editar `OBRA_MAIOR_30_30_40` (40/30/30) cria a v2; contrato pinado na v1 continua 30/30/40 em
  `frn_parcelas_mo`; rascunho salvo depois pega a v2.
- **CA-E3** [SQL] editar `dias_pagamento` não muda o vencimento mínimo de medição já solicitada; **[TS]**
  `carregarMedicaoDoBanco` (com fake) devolve `diasPagamento` da versão da medição, não da atual (B1).
- **CA-E4** [SQL] nova condição: código gerado, sufixo em colisão, `tipo` = nome; aparece em
  `frn_condicao_permitida`; [TS] aparece no formulário de novo contrato.
- **CA-E5** [SQL] desativar: some de `frn_condicao_permitida`; enviado/aprovado segue; rascunho com ela não envia
  com a mensagem certa; as duas do sistema recusam; reativar volta.
- **CA-E6** [SQL] rascunho cuja sugestão está desativada **ou não permitida** (ex.: `OBRA_MEDICAO_MENSAL` sem
  "permite global" num global/manutenção) salva sem condição.
- **CA-E7** [SQL] `p_versao_base` desatualizada: recusa. `update`/`delete` em `frn_condicoes_versoes`: exceção.
- **CA-E8** [SQL] validações: parcelas 1–10, % 1–100 somando 100, `so_global` e `exige_justificativa` derivados.
- **CA-E9** [SQL] (D3) trocar o modo de uma condição em uso (ex.: `SPOT_UNICO_D7` de `por_servico` para
  `parcelas`): contrato e medição na v1 continuam como estavam; contrato novo usa o modo novo; as duas do sistema
  recusam troca de modo.

### Modelo (E2)
- **CA-E10** [TS] substituição dos 13 campos com o CT-0001; campo desconhecido literal e listado no aviso; vazio vira
  "[a preencher]"; texto escapado.
- **CA-E11** [SQL] salvar cria versão n+1; base desatualizada recusa; só José/`configurador`.
- **CA-E12** [SQL] 1ª geração após aprovação grava `modelo_versao`; [TS] documento já gerado usa a versão dele.
- **CA-E13** [TS] a versão 1 aplicada ao CT-0001 contém todas as frases das cláusulas do documento de hoje.

### Migração e não-regressão
- **CA-M1** [Prod] conferências do roteiro do plano batem.
- **CA-M2** [SQL] instalação limpa 001→012 e reaplicação sem efeito.
- **CA-M3** [TS/SQL] testes de medição de hoje passam sem mudar expectativa.
- **CA-M4** [Prod] depois do deploy: hub, Compras, Financeiro, Cockpit, Obras e Sofia abrindo.

---

## 6. Riscos e pontos em aberto

1. **CT-0001 é contrato real esperando o Eduardo.** Se o Eduardo aprovar entre a aplicação das migrations e o
   deploy, o app velho chama `frn_aprovar_contrato` novo e o contrato libera — o mesmo resultado do fluxo novo
   (D1). Sem dano. Aplicar 009–012 e fazer o deploy em sequência curta.
2. **App novo não funciona sem as migrations**; o app velho funciona com elas. Ordem: banco → deploy.
3. **`frn_dias_pagamento` muda de assinatura.** Só `frn_registrar_solicitacao_fin` chama (`005:1201`); o app não chama
   por RPC; as funções são só `service_role`.
4. **Fonte da condição em `medicoes/_dados.ts` e em `lib/integracoes/financeiro.ts`** muda (catálogo → versão).
   Tela igual; coberto por CA-M3 e CA-E3.
5. **Locaweb** com recusa temporária `451` (Financeiro, `docs/deploy-easypanel.md:268-269`); coberto pelas novas
   tentativas.
6. **Texto livre do modelo** perde as tabelas (viram linhas), como no mockup (`valores()`).
7. **Nome nos eventos** vem de `auth.users`; quem não tem nome aparece pela parte do e-mail; eventos antigos ficam
   com e-mail.
8. **`papeis.admin` sempre falso hoje** (§1.7): correção em território de autorização; único efeito novo é o admin
   ver as Configurações em leitura. Coberto por teste.
9. **Rascunho repinado a cada salvamento** é a leitura de "vale só para contratos novos". Se o João entender que
   rascunho fica na versão antiga, muda só o `frn_salvar_contrato`.
10. **Modo editável (D3)**: trocar o modo de uma condição muito usada (ex.: `OBRA_MEDICAO_MENSAL`, sugerida para
    global/manutenção) muda o que os contratos **novos** recebem por sugestão. O aviso do modal (§1.5 item 3) é a
    defesa; os existentes ficam protegidos pela versão.
11. **`after()`**: e-mail pendente se perde se o processo reiniciar no meio (§3).

---

## 7. Decisões (fechadas pelo João em 13/10/2026)

| # | Decisão | O que vale |
|---|---|---|
| **D1** | Aprovação do José de 11/10 no CT-0001 | **Vale.** Quando o Eduardo aprovar, o CT-0001 fica aprovado. **Nenhuma escrita nas colunas existentes do CT-0001** (a 009 só preenche `condicao_versao = 1`); `frn_ct_ordem` fica `not valid` |
| **D2** | Faixa de uso | **Só texto.** Limites da sugestão fixos no código; a tela diz quais são |
| **D3** | "Como paga" (modo) de condição existente | **Editável, como no mockup.** O versionamento garante que contrato enviado/aprovado e medição não mudam. Exceções: `MATERIAL_MEDIANTE_NF` e `EXCECAO_APROVACAO` (regras do sistema, §1.5 item 6) |
| **D4** | E-mail nas etapas de aditivo | **Sim** (tabela A1–A5 de §1.4) |
| **D5** | Caixa e remetente | **Mesma caixa e mesmas `SMTP_*` do Compras.** O João põe as cinco variáveis no Environment do app `fornecedores` no deploy |

---

## 8. Respostas à revisão (`revisao-spec-melhorias-2026-10.md`)

| Item | Resposta |
|---|---|
| **B1** integração lê condição ao vivo | **Aceito.** §1.5 "Hoje" e item 7; Frente B; CA-E3 (TS) |
| **B2** `parcelas_ajustadas` sobrevive | **Aceito.** Zerado em `frn_salvar_contrato` e `frn_devolver_contrato`, e no aditivo de condição; check `frn_ct_parcelas_ajustadas`; `frn_parcelas_mo` levanta em tamanho incoerente (em vez de ignorar: falha calada em dinheiro é o que o projeto proíbe); CA-B13 |
| Atenção 1 (D1 × mockup) | Fechado pelo João: D1 = aprovação de 11/10 vale |
| Atenção 2 (D3 × mockup) | Fechado pelo João: modo editável; spec ajustada |
| M1 ordem da 009 | **Aceito.** §2 "Regras de escrita" e passos 1→2→3 da 009 |
| M2 grants da assinatura nova | **Aceito.** Revoke/grant explícitos e verificação por função |
| M3 sugestão não permitida | **Aceito.** §1.5 item 6; CA-E6 |
| M4 "Exige justificativa" | **Aceito**, opção "esconder": a flag vira derivada do modo `excecao` (desvio pequeno do mockup, que mostrava o checkbox) |
| M5 rascunho com condição desativada | **Aceito**, ajustando o texto do modal (rascunho precisa escolher outra); não deixamos o envio aceitar condição desativada, porque desativar existe justamente para parar contrato novo com ela |
| M6 sub-linhas no chip Devolvido | **Aceito.** Chip Devolvido sem sub-linhas; regra de hoje mantida nos outros chips; CA-A7 |
| M7 `layout.tsx` entre E e G | **Aceito.** Layout fica com a G; E mantém as assinaturas usadas pelo layout |
| M8 justificativa no evento | **Aceito.** §1.3 item 5 e `dados.justificativa` |
| M9 escapar HTML | **Aceito.** §1.4; CA-D4 |
| M10 limpar `excecao_*` | **Aceito**, limpar (o texto antigo vazaria como nome da parcela única, `005:236`) |
| M11 `tipo`/`observacao` de condição nova | **Aceito.** `tipo` = nome, `observacao` = null |
| M12 atualizar `sql.md` | **Aceito.** Passo do roteiro no plano |
| Nenhum item rejeitado | — |

---

## Apêndice A — texto da versão 1 do modelo (seed da 011)

Mantém as frases de hoje (`_documento.tsx:65-170`); a parte condicional da Cláusula 3 vem em `{{parcelas}}`
(§1.6). O "[CNPJ da Manfac]" fica como está hoje, para o José preencher na tela.

```
INSTRUMENTO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS

PARTES
CONTRATANTE: Manfac, CNPJ [CNPJ da Manfac].
CONTRATADA: {{fornecedor}}, CNPJ {{cnpj}}, com dados bancários conforme o cadastro de fornecedores.

CLÁUSULA 1 — OBJETO
{{escopo}}
Local de execução: {{obra}}. Classificação: {{classificacao}}. Centro de custo: {{centro_custo}}.

CLÁUSULA 2 — VALOR E PRAZO
Valor: {{valor}}.
Vigência de {{inicio}} a {{fim}}.

CLÁUSULA 3 — CONDIÇÕES DE PAGAMENTO
Condição padrão: {{condicao}}.
{{parcelas}}
Cada pagamento depende de medição aprovada pela CONTRATANTE, com nota fiscal e evidência do serviço. A soma das medições não ultrapassa 100% do valor contratado. Nenhum pagamento final é feito sem o aceite operacional do serviço.

CLÁUSULA 4 — DOCUMENTOS
A CONTRATADA apresenta CNPJ, dados bancários, proposta comercial e, quando aplicável, certidões negativas. Em cada medição: nota fiscal e evidência do serviço.

CLÁUSULA 5 — ADITIVOS
Alterações de valor ou de condição de pagamento são formalizadas por aditivo numerado ({{numero}}-2, {{numero}}-3…). O aditivo de condição vale para as medições ainda não aprovadas.
```

Cabeçalho (MANFAC, `{{numero}}`, "Controle interno", "Emitido em {{data_emissao}}") e assinaturas continuam
fixos no componente, como hoje (`_documento.tsx:53-64`, `171-174`).
