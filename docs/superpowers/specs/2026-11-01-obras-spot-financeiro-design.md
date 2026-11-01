# SPOT — Financeiro da OS (réplica das Fases A/B/C das OBRAS) e faturamento parcial

**Data:** 01/11/2026 · **Branch:** `feat/obras-spot-financeiro` (de `master` `c19d7ee`) · **Mockup aprovado:**
https://claude.ai/artifact/SqeXWVr9ua5ZVKi4THu77G (versão 1; José: "pode seguir") · **Base:** specs
`2026-10-31-obras-financeiro-fase-a-design.md` e `2026-11-01-obras-financeiro-fases-b-c-design.md`; memória
`obras-spot-replicar-financeiro` (José, 31/10: "quando finalizarmos essa questão do financeiro e compras, temos que
replicar também esse formato para as obras spot").

## 1. Intenção

Na ficha de cada SPOT (`app/obras/obra/[id]`), qualquer pessoa com acesso ao Gestão de Obras vê quanto a OS custou,
de onde veio o custo, quanto já foi faturado e qual é a margem, e consegue pedir material, pagamento, medição e
locação dali mesmo. É a mesma visão que as OBRAS ganharam nas Fases A/B/C, só que uma OS por vez. A visão consolidada
(margem por cliente e por mês) fica para uma etapa própria do painel.

Junto com isso, corrigir o faturamento parcial **do SPOT**. Hoje uma OS só aceita uma nota: o Financeiro recusa a 2ª
(`financeiro/supabase/hub-install/036_…:38-46`, `041_…:73-81`, `lib/faturamento/liberadas.ts:46-59`,
`lib/faturamento/conferir.ts:68`) e `obras_marcar_faturada` leva a OS inteira para Faturado na 1ª. Caso real: MACAÉ 2
(0426-012516), R$ 156.412,32, NF 735 de 20/05 (R$ 140.771,09, antes do módulo de faturamento, fora de `fin_fat_*`).
Para contornar, em 30/10 o `valor` dela foi baixado para o saldo R$ 15.641,23 (`docs/obras/2026-10-30-macae2-saldo.sql`);
ela está em `pendFat`.

## 2. Decisões do José (literal, 01/11/2026)

1. "a margem vai ficar disponivel para todos olhando uma OS de cada vez e depois criamos uma visão melhor no painel,
   que vamos melhorar em outra etapa"
2. "deve incluir também locações, as vezes precisa, corrige também nessa etapa essa possibilidade de faturamento
   parcial"
3. Quando a OS sai de Pendente faturamento: "muda sozinho quando somar o valor"
4. Mockup: "pode seguir" (as quatro sugestões marcadas nele foram aprovadas junto — §4).
5. Depois da revisão, sobre as recomendações (parte da obra na nota, 2ª nota e volta à fila, faturadas fora do
   sistema, regra só no SPOT): "pode seguir com as recomendações, mas no caso de macae 2 teria que levar em
   consideração como faturado so o valor que de fato tem NF. 4=pode aplicar a regra somente ao spot por enquanto"

## 3. O que entra

### 3.1 Ficha do SPOT (hub)

- **Quadro "Pedir a partir desta OS"** (já existe com "Solicitar compra"): passa a ter 4 botões, todos `<a>` em nova
  aba (apps separadas, AGENTS.md), escondidos em OS cancelada como hoje:
  - Pedir material → `/compras/solicitacoes/nova?obra=<id>`
  - Pedir pagamento → `/financeiro/solicitacoes/nova?obra=<id>`
  - Pedir medição → `/fornecedores/medicoes/nova?obra=<id>`
  - Nova locação → `/compras/solicitacoes/nova?obra=<id>&tipo=locacao`
  (mesmos destinos dos botões das OBRAS em `app/obras/obras/[id]/page.tsx` e `financeiro/_tela.tsx`.)
- **Bloco novo "Financeiro da OS"**, depois dos blocos atuais da ficha, com "Dados até" e:
  - **Totais:** Valor da OS (`obras_obra.valor`, a receita esperada) · Faturado (R$, % do valor, nº de notas, quanto
    falta) · Custo comprometido (com realizado e pago) · Margem prevista (R$ e %).
  - **Sub-abas:**
    - **Resumo:** custos por origem (Compras, Fornecedores, Pagamentos/rateio, Caixinha, Locações) × comprometido /
      realizado / pago, com pendências (pedido sem entrega, medição de fornecedor > 10 dias em aprovação, locação
      perto de vencer); margem prevista e margem realizada.
    - **Compras:** pedidos da OS (fornecedor, status, entrega, valor, NF, pago), link "abrir no Compras".
    - **Fornecedores:** contratos (valor, medido, saldo) e medições com situação.
    - **Pagamentos e caixinha:** lançamentos do Financeiro ligados à OS, com a parte desta OS quando há rateio.
    - **Locações:** pedidos de locação da OS (item, fornecedor, início, fim, valor, situação) com "Devolvida" e
      "Renovar até…"; aviso 5 dias úteis antes do fim e no dia.
    - **Faturamento:** barra faturado/valor, notas (nº, emissão, valor da nota, parte desta OS), "falta faturar".
  - Sem dado numa origem → linha/sub-aba mostra vazio, não some o bloco inteiro (a OS sempre tem Valor e Faturado).
- **Fora da réplica (só fazem sentido nas OBRAS):** aba Dados da obra, organograma, portal, medição ao cliente,
  "avanço × liberado", OS filha/aditivo, pré-aprovação do engenheiro.

### 3.2 Banco (SQL do hub, `sdd-sql-obras-spot-financeiro.sql`)

- **Quem vê valores no SPOT:** `obras_pode_ver_valores(p_obra)` passa a devolver `true` para obra
  `modalidade = 'spot'` quando `obras_has_access()` é true. Para `modalidade = 'obra'` a regra atual **não muda**
  (admin, engenheiro da obra/mãe, papel financeiro/diretor). Falha fechada continua: sem e-mail no JWT, sem acesso ao
  Obras ou obra inexistente → false. As leituras `obras_fin_compras`, `_fornecedores`, `_notas`, `_vinculos`,
  `_locacoes`, `_medicoes_fornecedor_atrasadas`, `_caixinha_sem_obra` já filtram só por essa função e por
  `obra_id`/filhas — não têm filtro de modalidade — então passam a servir o SPOT sem mudança.
- **Locação no SPOT:** o gatilho `obras_locacao_estado_guarda` **e** as policies de insert/update de
  `obras_locacao_estado` (`sdd-sql-obras-financeiro-bc.sql:623-629`) exigem `obras_engenheiro_ou_admin_mae`. Para obra
  SPOT, os três aceitam **analista da OS ou admin** (§4.2). OBRAS sem mudança.
- **Faturamento parcial — só `modalidade = 'spot'`** (decisão 5; OBRAS mantêm o comportamento de hoje):
  - **Parte da obra na nota** passa a ser um dado próprio do vínculo nota×obra (hoje `fin_fat_nota_obras.valor_centavos`
    é cópia de `obras_obra.valor`, `financeiro/lib/faturamento/montar-notas.ts:73,85`, `actions.ts:1039`). Nota com
    **uma** obra: a parte é o valor da nota (campo da nota que vale — total ou serviço — o construtor confere com o
    Financeiro e registra). Nota com **várias** obras: o Financeiro digita a parte de cada uma e a soma das partes
    tem de bater com a nota; sem isso a nota não emite.
  - `obras_marcar_faturada`, para obra SPOT em `pendFat`: soma as partes de todas as notas vivas ligadas a ela e só
    passa para `faturado` quando a soma ≥ `obras_obra.valor`, com `marco_faturou` = data da nota que fechou a soma.
    Nota que não fecha a soma: a OS fica em `pendFat`, a função devolve a OS numa lista nova "parciais" (soma e falta)
    e grava linha no `obras_historico` ("NFS-e X · faturado R$ a de R$ b"). Obra com `valor` nulo ou modalidade
    `obra`: comportamento de hoje.
  - `fat_nfse` deixa de ser "a" nota no SPOT: guarda as notas (formato com o construtor, sem quebrar quem lê).
    `obras_desmarcar_faturada` hoje só age quando `fat_nfse` é igual à NFS-e cancelada (`sdd-sql-obras-faturamento.sql:146`)
    — muda junto: se a soma restante cair abaixo do valor, a OS volta para `pendFat` (§4.4).
- **Faturado da ficha** = soma das partes das notas vivas ligadas à OS. Exceção: OS já em `faturado` **sem** nota
  ligada em `fin_fat_*` mas com `fat_nfse` preenchido (cargas SQL de 30/10) conta o próprio `valor` como faturado, com
  o aviso "nota fora do sistema". Faturada sem `fat_nfse` não conta (sem NF, não é faturado).
- **Escrita em produção:** SQL só em arquivo, aplicado pelo José; script de verificação com rollback como nas levas
  anteriores (`docs/obras/2026-11-0X-verificacao-spot-financeiro.sql`).

### 3.3 Outros repositórios

- **Financeiro (muda regra, não só confere):**
  - Aceitar 2ª nota para a mesma **OS SPOT**: abrir as quatro recusas citadas no §1 só para SPOT com saldo
    (soma das partes < valor); continuam recusando OBRAS e SPOT já quitado.
  - A OS SPOT faturada em parte **volta sozinha** à fila de "liberadas" mostrando só o **saldo**, sem nova liberação.
    O casamento automático por loja+valor (`montar-notas.ts:82`) compara com o saldo, não com o valor cheio.
  - Tela da nota: com várias obras, campo da parte de cada uma (soma = valor da nota).
  - `repositorio-entrega.ts` chama `obras_marcar_faturada` depois de gravar as partes e trata a lista "parciais"
    ("OS X: faturado parcial, falta R$ Y").
  - Conferir que o seletor Obra/OS da solicitação de pagamento (Fase B/C) e a fila de caixinha oferecem OS SPOT.
  - Migração nova em `supabase/hub-install/` (próximo número livre), regras do repo (escrita só por funções `fin_*`).
- **Compras:** conferir que `?obra=<id>` de OS SPOT abre preenchido (`lib/obras/leitura.ts`) e que `&tipo=locacao`
  funciona para SPOT.
- **Fornecedores:** conferir que `/medicoes/nova?obra=<id>` aceita OS SPOT e que a medição sem engenheiro segue direto
  para o Eduardo (decisão B/C §2.8).
- Cada repo com deploy próprio; o deploy do Fornecedores não atualiza outro sistema (AGENTS.md). Se algum desses
  "conferir" falhar, a correção no outro repo entra nesta etapa, mas sem mudar regra que não seja de obra/OS.

### 3.4 Acerto da MACAÉ 2 (dado de produção — script à parte, aplicado pelo José)

Com o faturamento parcial no ar: voltar `valor` de 0426-012516 para R$ 156.412,32 (com linha no histórico) e
registrar a NF 735 (20/05/2026, pedido 4500728137) com parte R$ 140.771,09 ligada à OS. Pela decisão 5, o faturado da
ficha conta **só o que tem NF**: R$ 140.771,09; a OS segue em `pendFat` com saldo R$ 15.641,23 e volta à fila de
liberadas. Como a NF 735 entra no Financeiro (nota histórica em `fin_fat_*` ou registro só de vínculo) o construtor
define com as regras do repo Financeiro; script com pré-condição (`valor = 15641.23 and etapa = 'pendFat'`) e
ensaio com rollback antes.

## 4. Chamadas minhas (marcadas no mockup, aprovadas)

1. **Margem prevista = valor da OS − custo comprometido.** SPOT não tem % de avanço físico, então a projeção
   "comprometido ÷ avanço" das OBRAS não se aplica. Margem realizada = faturado − custo realizado (igual às OBRAS).
2. **Locação no SPOT: quem marca devolvida/renovada é o analista da OS (`obras_obra.pcm`, por e-mail) ou admin.**
   O construtor confere como o analista é identificado por e-mail; se não houver ligação confiável nome→e-mail,
   cai para "qualquer pessoa com acesso ao Obras" e registra em `docs/DIVIDAS.md`.
3. **Notas que passam do valor da OS:** a OS vira Faturado e a ficha mostra o aviso "faturado acima do valor".
4. **Nota cancelada que derruba a soma abaixo do valor:** a OS volta para Pendente faturamento.

## 5. Fora

Visão consolidada de margem no painel / Base SPOT (etapa própria), PEF/orçado, Projeto do Omie, backfill de vínculos
de custo de SPOTs antigos (só o que já estiver ligado aparece), faturamento parcial das OBRAS (decisão 5: "somente
ao spot por enquanto"), qualquer mudança nas OBRAS além da condição `modalidade = 'spot'` nas guardas.

## 6. Restrições

AGENTS.md: dinheiro, RLS, autorização e escrita que sobrescreve dado de cliente são exceção (tratar borda); centavos
inteiros; cliente nunca vê R$ (o portal só atende `modalidade = 'obra'`, então não é afetado). Mudança de schema e
de guarda foi aprovada pelo José neste desenho. A ficha SPOT é tema escuro do hub (não o tema claro `/obras/obras/**`).

## 7. O que fica com o construtor

Nomes reais de colunas (conferir por catálogo), formato do `fat_nfse` com várias notas, onde exatamente o aviso de
locação aparece na ficha, componentização do bloco (reaproveitar as peças de `app/obras/obras/[id]/financeiro/` onde
der, adaptadas ao tema escuro).
