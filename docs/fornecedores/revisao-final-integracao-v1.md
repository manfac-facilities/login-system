# Revisão final adversarial — Gestão de Fornecedores, `integracao/v1`

- **Repo/commit:** `manfac-facilities/fornecedores`, branch `integracao/v1`, HEAD `b706cd8`
- **Clone revisado:** `D:\fornecedores-work\revisao` (clone novo, somente leitura; nada aplicado em banco real)
- **Data:** 08/10/2026
- **Revisor:** subagente independente (não escreveu o código)
- **Régua:** BLOQUEANTE = dano alcançável a dado ou dinheiro, ou acesso indevido, com cenário concreto. O resto vai como backlog.
  O que já está em `docs/DIVIDAS.md` do repo não conta como achado.

## Veredito

**APROVAR. Nenhum bloqueante.**

Dois itens de backlog pedem **decisão do João antes de liberar a medição para uso** (B-1 e B-2). Os dois falham fechado
ou dependem de alguém aprovar no meio, então não entram na régua de bloqueio. Mas o B-2 bate de frente com o que o
cliente pediu ("pagar à vista ou com 30 dias").

## Checks (em série, Node local, máquina com pouca memória)

| Check | Resultado |
|---|---|
| `npm ci` | ok (98 pacotes) |
| `npm run lint` (Biome) | ok, 129 arquivos, 0 achados |
| `npx tsc --noEmit` | ok, 0 erros |
| `npx vitest run --no-file-parallelism` | **33 arquivos, 557 testes, todos passando** (143 s) |

---

## 1. SQL (`supabase/hub-install/001–005`)

O que foi conferido e está correto:

- **RLS:** todas as 9 tabelas `frn_*` com RLS ligada, `revoke all from anon, authenticated` + `grant select` só para
  `authenticated`, nenhuma policy de escrita. `frn_contratos` libera para `criado_por = frn_email()` ou `frn_vejo_tudo()`. As
  filhas (aditivos, tabela de preços, medições, atendimentos, anexos, eventos) usam `exists(select … from frn_contratos)`,
  então herdam a RLS do contrato. Sem sessão, `frn_email()` é NULL, a comparação dá NULL e `frn_vejo_tudo()` dá false:
  **nega**. `frn_condicoes`/`frn_fornecedores` ficam visíveis a qualquer pessoa logada, que é o que a spec pede.
- **NULL:** `frn_e_admin`/`frn_tem_papel`/`frn_tem_algum_papel` usam `exists`, então NULL vira false. `frn__ator` recusa
  NULL ou vazio. `frn__pode_operar` usa `coalesce(…, false)`. As guardas usam `is not true`. Nenhum caminho falha aberto.
- **`security definer`:** todas têm `search_path = public, pg_temp`, e a verificação 005 confere isso. Execução
  revogada de `public, anon, authenticated` e concedida só a `service_role`. Exceções conscientes: `frn_email`,
  `frn_sou_admin` e `frn_vejo_tudo`, que só respondem sobre o próprio token. Sequências fechadas.
- **Ator:** toda função de escrita revalida dono e papel a partir de `p_ator`.
- **Trava de 100% (R-22):** contrato travado com `for update` antes de ler medido e em aberto, e as chamadas seguintes
  pegam snapshot novo (READ COMMITTED). Atendimento, devolução, aditivo e remoção de atendimento travam o contrato na
  mesma ordem. A concorrência real continua sem teste, mas já é dívida aceita (CA-5.2).
- **Retenção (R-24) e aceite (R-23):** conferidos em `frn_solicitar_medicao`. O aceite final só é aceito a partir do
  início da parcela retida.
- **Transições:** cada função confere o estado de origem. Não achei transição ilegal alcançável: cancelado, encerrado e
  devolvido são finais, e a medição `aprovada` não volta a `solicitada` nem é devolvida.
- **Instalação:** idempotente (`if not exists`, `create or replace`, `on conflict do nothing`, `drop policy if exists`).
  Fora de `frn_*`, só cria o bucket `fornecedores-anexos` em `storage.buckets` (privado, 10 MB, PDF/JPG/PNG). Lê
  `hub_user_roles`, `auth.users` e `obras_obra` e não escreve em nenhuma delas. O seed de papéis só concede a quem tem
  conta em `auth.users`.

## 2. Server Actions

- **`p_ator`:** em todas as escritas vem de `requireSessao()`/`obterAtor()`, que usam `auth.getUser()` validado no
  servidor de Auth. Não achei nenhum caminho em que o e-mail venha do navegador.
- **Escalar papel:** nenhuma action escreve em `frn_papeis`, e papel só é lido.
- **Trocar dono:** `criado_por` só é gravado no insert, com o ator.
- **Mexer em contrato aprovado:** `frn_salvar_contrato` exige `rascunho` e dono.
- **Aprovar por outra pessoa:** as funções de aprovação exigem o papel do próprio `p_ator`.
- **Valores no servidor:** a medição em modo `tabela` calcula o valor no banco e ignora o que veio. Fornecedor,
  categoria, tipo de documento e centro de custo são resolvidos no catálogo pelo servidor.
- **Anexos:**
  - o upload confere pela RLS que a pessoa enxerga o contrato;
  - o caminho é gerado no servidor (`<contrato_id>/<uuid>.<ext>`) e o tipo é conferido pelo conteúdo do arquivo;
  - o registro no banco exige o prefixo `<contrato_id>/`. Na medição, a action ainda exige a regex exata, sem `..` e sem
    outra pasta;
  - o download (`medicoes/anexo/[id]`) confere a sessão, lê `frn_anexos` pela RLS e só então assina uma URL de 60 s.
  - **Não dá para ler anexo de contrato alheio nem fazer path traversal.**

## 3. Proxy e autenticação

- Sem `matcher`. Ficam fora da sessão: `/_next`, `/api/health` e caminhos com extensão estática.
- O desvio por extensão (`/medicoes/anexo/<id>.txt`) não abre nada:
  - as páginas passam por `requireSessao()` no `layout.tsx`;
  - a única rota (o anexo) confere a sessão sozinha;
  - não existe outra rota em `/api/*`.
- `basePath` é fixo em `/fornecedores`, e o gap do endereço exato do basePath está coberto pelo layout.
- Server Actions com `allowedOrigins` = host do app.

## 4. Integração Financeiro (`lib/integracoes/financeiro.ts`)

- **Segredo ou URL vazios:** `trim()` + recusa. Nada é enviado.
- **Retentativa:** uma só, para 5xx, rede ou timeout, e com a **mesma chave** (`medicao.id`). O Financeiro devolve 200
  com a mesma solicitação, então **não duplica**. 4xx não é repetido. Duplo clique em aprovar: a segunda chamada falha
  em `frn_aprovar_medicao`, porque a medição já não está `solicitada`.
- **Valor e fornecedor:** relidos do banco (`frn_medicoes.valor`, `frn_contratos → frn_fornecedores.omie_codigo`), nunca
  da tela. O fornecedor não muda depois de aprovado.
- **Regra das 17h:** o vencimento R-40 sai no mínimo na primeira janela e é recalculado a cada envio.
  `emergencialManual: false` fixo. O resíduo de borda já está nas dívidas (B3/B4).

## 5. Dinheiro

- Na lógica, só centavos inteiros (`dividirArredondando`, sem float). O banco recebe texto exato (`"14400.00"`).
  `reaisParaCentavos` e `deBanco` usam `Math.round(n*100)`, que é exato para `numeric(14,2)` até R$ 99.999.999,99.
- O arredondamento é meio-para-longe-do-zero nos dois lados, igual ao `round(numeric)`, e há teste de paridade TS/SQL
  (`tests/sql/paridade.test.ts`).
- Os dois `parseBRL` leem "3.500" como **R$ 3.500,00**. "3,5" e "3.5" viram R$ 3,50. Mais de duas casas decimais, ou
  agrupamento de milhar inválido, dá `null`, então recusa.

---

## BLOQUEANTES

**Nenhum.**

## BACKLOG (não bloqueia; em ordem de prioridade)

### B-1 (alta, decisão do João antes do go-live): a carga inicial C2 não existe, e todo fornecedor do Omie vai entrar como "novo"
- A resposta 2 do cliente ("fornecedores do Omie já homologados = sim") depende de `frn_upsert_fornecedor(…, 'carga_inicial')`.
- Ninguém chama a função com essa origem. A action (`app/(modulo)/contratos/novo/_actions.ts:66-73`) usa o padrão
  `primeiro_uso`, e não há script de carga no repo. `grep carga_inicial` só acha o SQL e os testes.
- **Efeito:** o primeiro contrato de qualquer fornecedor vai exigir certidões e a homologação do José.
- É falha fechada, sem risco de dinheiro, mas é atrito operacional grande no dia 1.
- **Correção:** um script SQL de carga a partir de `fin_catalogo_fornecedores` (ambiente `producao`, `ativo`), rodado
  uma vez com autorização.

### B-2 (alta, decisão do João): exceção "30 dias" é paga na primeira janela, uns 25 dias antes do combinado
- O seed tem só as 12 condições da planilha. `SPOT_A_VISTA` e `SPOT_D30`, que estão na spec §4 e D5, ficaram de fora de
  propósito: `002_frn_cadastros.sql:3-5` diz que "30 dias" vai como `EXCECAO_APROVACAO`.
- Só que `EXCECAO_APROVACAO` tem `dias_pagamento = NULL` (`002:134-136`), e o R-40 manda `NULL` para a **primeira janela**
  (`lib/regras/vencimento.ts:17`).
- **Cenário:** o solicitante abre um contrato, ou pede um aditivo de condição, com a exceção "pagar com 30 dias". O José
  aprova. O Eduardo aprova a medição. O Financeiro recebe vencimento ≈ D+2 a D+5 úteis.
- O valor está certo, mas o prazo combinado não é cumprido. É justamente o pedido do cliente ("quero mudar pra pagar a
  vista ou com 30 dias").
- **Correção (escolha do João):**
  - (a) semear `SPOT_D30`/`SPOT_A_VISTA`, ou condições 30 dias para obra, como diz a spec; ou
  - (b) dar à exceção um campo `dias` numérico, aprovado pelo José e usado no R-40.
- A spec e o seed divergem hoje. O que vale precisa ficar registrado.

### B-3 (média): aditivo de condição move medições `solicitada` sem revalidar retenção e aceite
- O trecho é `005_frn_funcoes.sql:788-789`. Uma medição `solicitada` que passa de 90% sob `OBRA_MAIOR_30_30_40` muda
  para `OBRA_RETENCAO_10` quando o José aprova o aditivo, e continua aprovável pelo Eduardo **sem aceite final**.
- Resultado: paga a retenção antes do aceite, dentro do total do contrato. Precisa de dois aprovadores no meio, por isso
  não bloqueia.
- **Correção:** na aplicação do R-30, recusar o aditivo se houver medição `solicitada` que viole R-23 ou R-24 sob a nova
  condição, ou devolvê-la.

### B-4 (média): a evidência da medição pode apontar para arquivo que não existe
- `solicitarMedicaoAction` (`app/(modulo)/medicoes/_actions.ts:169-179`) e `frn_solicitar_medicao` (`005:1013-1015`,
  `1050-1061`) conferem só o formato do caminho, não se o objeto existe no bucket.
- Um solicitante pode montar o corpo da action com um `storagePath` inventado dentro da pasta do contrato e cumprir a
  exigência de "evidência" sem enviar nada. O Eduardo vê o link quebrado na fila antes de aprovar.
- **Correção:** a action confere a existência no storage (`list`/`createSignedUrl`) antes de chamar a função.

### B-5 (baixa): `lerPapeis` chama `frn_e_admin` com o cliente da sessão, e essa função só aceita `service_role`
- Em `lib/auth/papeis.ts:27`, a chamada **sempre** dá erro. Resultado: `admin` sempre false, mais um `logError("papeis.admin")`
  em toda página e toda action.
- `papeis.admin` não é usado em `app/`, e a RLS do admin funciona por `frn_sou_admin()`. O teste não pega porque o fake
  (`tests/aprovacoes/fakes.ts:24`) responde a RPC.
- **Correção:** trocar por `rpc("frn_sou_admin")` ou remover. Hoje só gera ruído de log.

### B-6 (baixa): aditivo de condição para `SPOT_TABELA_FIXA` não exige tabela de preços
- `frn_criar_aditivo`/`frn_aprovar_aditivo` não aplicam o R-08. Um contrato global que passa para tabela fixa sem linhas
  fica sem como medir. Falha fechada.

### B-7 (baixa): upload de anexo de medição só confere que a pessoa vê o contrato
- O trecho é `app/(modulo)/medicoes/_actions.ts:73-79`. O admin, que só lê, consegue subir arquivo para a pasta de
  qualquer contrato aprovado.
- O arquivo não é registrado: só vira órfão no bucket, o que já é dívida aceita.

### B-8 (baixa): o valor que vai ao Financeiro é formatado com `Intl` + float
- O trecho é `lib/dinheiro.ts:7` (`formatarNumeroBRL`, usado em `financeiro.ts:175`). Conferi na faixa toda e está
  correto. A imagem `node:22-alpine` tem ICU completo.
- Mesmo assim, o texto do valor depende do ICU do runtime. `formatarValor`, de `lib/regras/dinheiro.ts`, faz o mesmo só
  com inteiros.
- Há também dois `parseBRL` com regras ligeiramente diferentes: `lib/dinheiro.ts` remove espaços internos, e
  `lib/regras/dinheiro.ts` recusa. Vale unificar.

### B-9 (baixa): `frn_solicitar_medicao` no modo tabela calcula com a quantidade antes de arredondar
- `v_valor = preco × qtd` sem arredondar, mas a coluna é `numeric(12,3)`. Quem chamar a função direto com 4 casas grava
  quantidade e valor levemente incoerentes.
- A action manda no máximo 3 casas (`parseQuantidade`), então o caminho da tela é inalcançável.

### B-10 (verificar na instalação, não no código)
- O bucket está "sem policy", mas o `storage.objects` do hub pode ter policy genérica de outro módulo, sem filtro de
  `bucket_id`.
- Antes de aplicar o 004, rodar `select policyname, qual from pg_policies where schemaname = 'storage'` e confirmar que
  nenhuma policy vale para todos os buckets.

## Observações (não são achados)

- Um e-mail com os dois papéis faz sozinho o ciclo inteiro (aditivo, as duas aprovações e a medição). É decisão da spec
  §1.2 e está correto pela regra, mas tira o duplo controle se o cliente juntar os papéis.
- O código de pagamento (linha do boleto ou copia-e-cola) é texto livre do solicitante. Quem confere o beneficiário é o
  Financeiro, como no fluxo direto de lá.
