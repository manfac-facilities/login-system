# Spec — Cancelamento de obra

**Data:** 23/09/2026 · **Frente:** cancelamento de obra (feedback 11 + pergunta 07) ·
**Prazo:** Controle de Obras em 28/09/2026.

Só especificação: nenhum código de produção foi escrito para produzir este documento, nenhum SQL foi
aplicado e o banco de produção **não** foi consultado. O schema foi lido dos `sdd-sql-obras-*.sql` da
raiz; o que está afirmado sobre o código atual foi verificado por leitura, com arquivo e linha citados
(master com os ajustes da ficha de 23/09 já mergeados).

**Fontes, na ordem de precedência:**
1. `mockup-cancelamento-obra-2026-09-23.html` — **aprovado pelo João em 23/09 como está**, com a
   observação opcional (registro no fim de `brief-mockup-cancelamento-obra-2026-09-23.md`). É a
   referência de comportamento e de texto de tela.
2. `pergunta-07-cancelamento-e-pedido-de-compra.md` — respostas do cliente de 14/09: **1A** (qualquer
   pessoa com acesso cancela), **2B** (obra executada não cancela), **3B** (no Field a OS continua
   ativa → cancelar é manual aqui).
3. `feedback-11-cancelamento-de-obra.md` — o pedido de 10/09 ("Cancelado pelo Cliente" / "Cancelado
   pela Manfac") e o esboço (etapa terminal, reversível, sai de diário e tarefas, fica na base).
4. Decisões do coordenador para esta frente (23/09): o indicador "canceladas no mês" **não entra**;
   cancelar e desfazer geram linha no `obras_historico` (bloco novo `Cancelamento`) pela RPC;
   `mudarEtapaAction` recusa `cancelado` como origem e destino; território de exceção do AGENTS.md →
   validação no servidor e trava de coerência no banco; mudança em `tarefas/page.tsx` mínima e avisada
   ao Duda.

---

## 1. O problema, em cinco linhas

O modelo tem nove etapas e todas descrevem uma obra que avança; não existe saída lateral. A obra que
o cliente desistiu, que a Manfac não vai executar ou que foi aberta por engano no Field fica parada
numa etapa qualquer, contando dias, pedindo diário, gerando cobrança e aparecendo como problema nos
indicadores. O Field não avisa (resposta 3B): a OS cancelada lá continua ativa.

**O que muda para quem usa:** um botão **"Cancelar obra"**, numa faixa própria **"Encerrar sem
executar"** dentro do bloco Ciclo de vida (e na Triagem), pede **quem cancelou** (Cliente ou Manfac) e
uma observação opcional. A obra sai do diário, das tarefas abertas, do Kanban e de todos os
indicadores; continua na Base (filtro "Canceladas") e na ficha, só leitura, com **"Desfazer
cancelamento"**, que a devolve à etapa exata. Cancelar e desfazer ficam no Histórico de alterações.
Obra que já saiu de campo não mostra o botão (2B).

---

## 2. Escopo

### 2.1 O que entra

| # | Item | Seção do mockup |
|---|---|---|
| C1 | Faixa **"Encerrar sem executar"** + botão **"Cancelar obra"** no bloco Ciclo de vida, abaixo do seletor de etapa — só em `levantamento`, `andamento`, `paralisado` | 1 |
| C2 | Faixa **"Esta OS não vai virar obra?"** + **"Cancelar obra"** na Triagem (`definir`) | 1 |
| C3 | Obra já executada (`relatorio` em diante): **sem botão**, com a linha de explicação | 1 |
| C4 | Janela de cancelar: **"Quem cancelou?"** obrigatório (Cliente / Manfac), **observação opcional**, aviso de quatro linhas, confirmar só acende com a escolha | 2 |
| C5 | Estados Cancelando… · Erro com "Tentar de novo" (escolha mantida) · sucesso = a ficha já aparece cancelada | 2 |
| C6 | Ficha da obra cancelada: selo (quem, quando, por quem, etapa em que estava, observação), esteira congelada, **só leitura** (sem Editar, sem "Mudar a etapa"), sem caixas de alerta, com **"Desfazer cancelamento"** e confirmação | 3 |
| C7 | Desfazer volta à etapa exata, **sem zerar `desde_etapa`**; cancelada na Triagem volta para a Triagem | 3 |
| C8 | Linha no Histórico de alterações ao cancelar e ao desfazer (bloco **Cancelamento**), e o filtro "Cancelamento" no histórico | 3 |
| C9 | Base: **"Todas" esconde canceladas**, com aviso "N obras canceladas fora desta lista · ver canceladas"; grupo **"Canceladas"** no filtro de etapa (todas / pelo Cliente / pela Manfac); pílula "Cancelada · Cliente/Manfac"; "Dias em aberto" = "—" | 4 |
| C10 | Cancelada **fora do Kanban** e de **todos** os indicadores da Base | 4 |
| C11 | Tarefa **aberta** de obra cancelada **some** da tela Tarefas; volta sozinha ao desfazer | 5 |
| C12 | Diário: sai sozinho (nenhuma mudança de código na fila) | 5 |
| C13 | Servidor: sessão, acesso, etapa permitida e motivo válido revalidados; `mudarEtapaAction` recusa `cancelado` como origem e destino; blocos editáveis recusam obra cancelada | — (AGENTS.md) |
| C14 | Banco: etapa `cancelado`, cinco colunas, CHECK de coerência, trigger de transição, bloco `Cancelamento` no histórico, RPC com as colunas novas | — (seção 3) |

### 2.2 O que explicitamente NÃO entra

| Item | Por quê |
|---|---|
| Indicador "canceladas no mês (Cliente · Manfac)" | O próprio mockup o marca "proposta — não pedido"; decisão do coordenador: não entra |
| "Cancelada" como opção do seletor "Mudar a etapa" | Mockup, seção 1: só se chega nela pelo botão, que pede o motivo |
| Cancelar obra já executada / "encerrar faturável" | Resposta 2B: obra executada segue até faturar |
| Detectar o cancelamento pelo Field | Resposta 3B: a OS continua ativa lá; a D2.1 só reage a `archived` |
| Terceira opção de motivo ("OS duplicada / aberta por engano") | Mockup aprovado com duas; o engano vai em "pela Manfac" + observação |
| Nome da pessoa no selo em vez do e-mail | Mockup aprovado com o e-mail (`cancelado_quem`, como `etapa_por`) |
| Limite de tamanho da observação, normalização do texto | Não pedido. Seção 9 |
| Tornar atômica a troca de etapa comum (`mudarEtapaAction`) | Dívida A13 já registrada; o cancelamento **não** usa esse caminho — vai inteiro pela RPC |

---

## 3. Mudanças de banco — `sdd-sql-obras-cancelamento.sql` (raiz)

**Não aplicado.** Aplicar **antes** do deploy do código. O código que está no ar continua funcionando
com a migration aplicada (nenhuma obra fica cancelada até alguém usar o botão novo; a RPC só ganha
colunas aceitas).

### 3.1 O que o arquivo faz

| Seção | O quê | Por quê |
|---|---|---|
| PASSO 0 | Consulta de catálogo (só leitura) do nome real do CHECK de etapa e do corpo atual da RPC | O CHECK foi criado **inline** (`sdd-sql-obras-v0.sql:84-86`); o nome foi dado pelo Postgres. Provável `obras_obra_etapa_check`, **a confirmar em produção antes do drop** |
| 0 | Aborta se: faltar `obras_obra`/`obras_historico`/RPC/`etapa_por`; o CHECK não se chamar `obras_obra_etapa_check`; existir outro CHECK restringindo etapa; faltar `obras_historico_bloco_check` | Nada pela metade (`.claude/rules/sql.md`) |
| 1 | CHECK de etapa com `'cancelado'` | Com `etapa = 'cancelado'`, diário (`.in('etapa', ETAPAS_FILA)`), Kanban e fases saem sozinhos. Alternativa descartada no brief: só uma flag `cancelado_em`, que obrigaria todo filtro por etapa a lembrar dela |
| 2 | `cancelado_por` (text), `cancelado_obs` (text), `cancelado_em` (timestamptz), `cancelado_quem` (text), `cancelado_etapa_anterior` (text) | Motivo estruturado; observação opcional; quando; quem; para onde o desfazer volta |
| 3 | CHECK `obras_obra_cancelamento_coerente` | Cancelada ⇔ tem `cancelado_por ∈ {cliente, manfac}`, `cancelado_em`, `cancelado_quem` não vazio e `cancelado_etapa_anterior ∈ {definir, levantamento, andamento, paralisado}` (2B no banco); não cancelada ⇔ as cinco vazias. Escrito com `is not null` antes de cada `in` e `coalesce(..., false)` em volta — CHECK aprova NULL, e sem isso uma obra `cancelado` com `cancelado_por` NULL passaria (armadilha 1 do `sql.md`) |
| 4 | Trigger `obras_obra_transicao_cancelamento` (BEFORE UPDATE das seis colunas) | O CHECK vê uma linha; não sabe de onde a obra veio. A trigger exige: ao cancelar, `cancelado_etapa_anterior` = etapa em que a obra **estava**; ao desfazer, a nova etapa = `cancelado_etapa_anterior`; enquanto cancelada, os dados do cancelamento não mudam. Fecha também a corrida "servidor leu a obra em Andamento, outra pessoa a mudou para Relatório, o cancelamento grava" |
| 5 | `obras_historico_bloco_check` com `'Cancelamento'` | Linha de histórico do cancelamento. O CHECK de `campo` não muda: a linha usa `campo = 'etapa'`, e quem cancelou + observação vão na coluna `motivo` |
| 6 | `create or replace` da RPC `obras_aplicar_alteracao` com as cinco colunas no fim de `v_colunas_validas`, do `set (...)` e do `select` | Sem isso a RPC recusa a chave (B1, `raise`). Resto idêntico a `sdd-sql-obras-historico.sql:153-241` |
| PARTE 2 | 11 invariantes, cada uma `OK` / `*** FALHOU ***` | Padrão `sql.md` |
| PARTE 3 | Teste de comportamento com rollback forçado, 11 casos (cancelar, desfazer, 2B, NULL, trigger, B1) | "SQL só é verificado de verdade rodando" (`sql.md`) |

A sincronização **não desfaz** o cancelamento: `_sincronizacao.ts:323` só grava `etapa` no insert de
obra nova, e o update de obra existente não inclui `etapa` (grep em `sincronizar/`). A importação
legada também não grava `etapa` no update (`importar/_actions.ts:111`).

### 3.2 Para o João aprovar — o SQL em linguagem simples

> **O que esta migration faz no banco**
>
> 1. **Cria a etapa "cancelado".** Hoje o banco só aceita as nove etapas da esteira; passa a aceitar
>    uma décima. Antes de mexer, o script confere o nome da regra antiga e **para sem alterar nada**
>    se estiver diferente do esperado.
> 2. **Cinco campos novos na obra:** quem cancelou (Cliente ou Manfac), a observação, a data e hora,
>    o e-mail de quem registrou e a etapa em que a obra estava. Nenhum dado existente é apagado ou
>    mudado — os campos nascem vazios.
> 3. **Uma trava de coerência.** O banco recusa obra cancelada sem "quem cancelou", sem data, sem
>    e-mail, ou vinda de uma etapa depois da execução em campo (a regra 2B do cliente passa a valer
>    também no banco, não só na tela). E recusa obra não cancelada com esses campos preenchidos.
> 4. **Uma trava de passagem.** Ao cancelar, o banco confere que a "etapa em que estava" é mesmo a
>    etapa atual; ao desfazer, que a obra volta exatamente para ela; enquanto cancelada, ninguém troca
>    "pelo Cliente" por "pela Manfac" sem desfazer antes. *(Isto vai um passo além do SQL mínimo do
>    brief. Recomendo manter: é o que impede alguém de cancelar uma obra executada "mentindo" a etapa,
>    e é o que evita que duas pessoas mexendo ao mesmo tempo deixem a obra num estado errado. Custa
>    uma função de ~30 linhas. Se preferir o mínimo, é tirar a seção 4 do arquivo e os casos c, d, e,
>    g do teste.)*
> 5. **O histórico passa a aceitar "Cancelamento"** como bloco, para registrar quem cancelou, quando e
>    por quê — e o desfazer.
> 6. **A função que grava alterações com histórico** passa a aceitar os cinco campos novos. Tudo o
>    mais nela fica igual.
>
> **Como se aplica:** em três passos — uma consulta de conferência (não altera nada), a migration, e
> uma verificação que devolve 11 linhas "OK". Depois, um teste que simula cancelar e desfazer com
> obras de mentira e **desfaz tudo no fim** (não grava nada); ele tem que dizer "11/11 OK".
>
> **Se precisar voltar atrás:** há um roteiro de rollback no topo do arquivo, válido enquanto nenhuma
> obra tiver sido cancelada.

---

## 4. Regras de domínio — `app/obras/_lib/tipos.ts`

### 4.1 Tipos

- **`EtapaCiclo`** (novo) = as nove etapas de hoje. **`Etapa` = `EtapaCiclo | 'cancelado'`.**
- `EtapaInfo.k: EtapaCiclo`; `CICLO` **não muda** (nove itens) — por isso "Cancelada" não entra no
  `<select>` de `_etapa.tsx:88` nem em `ETAPAS_VALIDAS` (`_actions.ts:56`); `ETAPAS: Record<EtapaCiclo,
  EtapaInfo>`; `ESTEIRA: EtapaCiclo[]`.
- **Por que dividir o tipo:** hoje `ETAPAS: Record<Etapa, EtapaInfo>` (`tipos.ts:171`). Pôr
  `'cancelado'` em `Etapa` sem entrada em `CICLO` faria o tipo mentir (`ETAPAS.cancelado` é
  `undefined` em runtime). Com a divisão, o `tsc` aponta **cada** `ETAPAS[o.etapa]` e
  `Record<Etapa, …>` que precisa decidir o que fazer com a cancelada — é a lista da seção 4.3, e é o
  que evita o cenário do brief ("`faseDe` cai em `'campo'` e a cancelada vira Executando").
- `ObraRow` ganha, **opcionais** (`?:`), `cancelado_por?: 'cliente' | 'manfac' | null`,
  `cancelado_obs?: string | null`, `cancelado_em?: string | null`, `cancelado_quem?: string | null`,
  `cancelado_etapa_anterior?: EtapaCiclo | null`. Opcionais porque os fixtures de teste montam
  `ObraRow` à mão em oito arquivos (grep de `field_ausente_em:` em `__tests__/`) e nenhum deles precisa
  do cancelamento; o código lê sempre com `?? null`.

### 4.2 Catálogo e regras novas

| Nome | O quê |
|---|---|
| `CANCELADO_POR = ['cliente', 'manfac'] as const` | Os dois valores do banco |
| `rotuloCancelado(por)` | `'Cancelado pelo Cliente'` / `'Cancelado pela Manfac'` — literais do pedido de 10/09 |
| `PODE_CANCELAR: EtapaCiclo[] = ['definir', 'levantamento', 'andamento', 'paralisado']` | Espelho da lista do CHECK de coerência. Corte do 2B = `posCampo` (mockup, seção 1) |
| `cancelada(o)` | `o.etapa === 'cancelado'` |
| `podeCancelar(o)` | `PODE_CANCELAR.includes(o.etapa)` |
| `NOME_CANCELADA = 'Cancelada'` | O nome de tela da etapa |
| `tarefaVisivelNaLista(t, etapaDaObra)` | `false` só quando `t.situacao === 'aberta'` e `etapaDaObra === 'cancelado'`. Usada pela tela Tarefas (seção 8) |

### 4.3 Onde a cancelada precisa de tratamento explícito

| Função (`tipos.ts`) | Hoje | Passa a |
|---|---|---|
| `nomeEtapa` (`:790`) | `ETAPAS[etapa]?.nome ?? etapa` | `cancelado` → `'Cancelada'` |
| `faseDe` (`:411`) | etapa desconhecida → `'campo'` | devolve **`Fase \| null`**; `cancelado` → `null`. Consequências automáticas: `posCampo` e `pedeFoto` → `false`; o Kanban (`_kanban.tsx:90`, `faseDe(o) === f.k`) e o filtro `fase:` (`_regras.ts:183`) a excluem sem mudar código. Etapa realmente desconhecida continua `'campo'` |
| `encerrada` (`:422`) | `etapa === 'faturado'` | `faturado` **ou** `cancelado`. Consequências: `sev` → `'encerrada'` (cinza), `critico`, `semCobertura` e `classeDias` → sem alarme, `semOS`/esteira dos KPIs a excluem, `Parada` da tabela → "—" |
| `estourou`, `travado` | olham só `posCampo`/`definir` | `false` quando `encerrada(o)` (com `posCampo` falso, a cancelada poderia acender "passou muito da duração" ou "travada") |
| `donoDa` (`:444`) | `ETAPAS[o.etapa]` | `cancelado` → `'—'` (coluna "Com quem está") |
| `derivar` | calcula prazo e parada para toda obra fora de `posCampo` | para `cancelada(o)`: `diasAlerta`, `atraso`, `diaDe`, `fracPrazo` e `paradaEtapa` = `null` ("Dias em aberto" = "—", nenhuma caixa de alerta de prazo). `dias` (desde a aprovação) continua calculado |

---

## 5. Servidor — `app/obras/obra/[id]/_actions.ts`

Arquivo `'use server'`: **só funções `async` exportadas** (armadilha 1 de `.claude/rules/obras.md`).
Tipos e mensagens de validação ficam em `_lib/tipos.ts`; as mensagens de erro do servidor são `const`
locais, não exportadas.

### 5.1 `cancelarObraAction(obraId: string, dados: { por: string; obs?: string })`

Receita fixa, com tudo que recusa **antes de qualquer escrita**:

1. `abrirSessao()` (`_actions.ts:79-89`, comparação `!== true`).
2. `dados.por` fora de `CANCELADO_POR` → `{ error: 'Escolha quem cancelou: o Cliente ou a Manfac.' }`.
3. `lerObra`. Obra já `cancelado` → `{ error: 'Esta obra já está cancelada. Recarregue a página.' }`.
4. `!podeCancelar(obra)` → `{ error: 'Esta obra já foi executada em campo e não pode ser cancelada.' }`
   (2B; olha a obra **lida do banco**, não a etapa que a tela acha que ela tem).
5. `obs = nulo(dados.obs)` (vazio vira `null`, nunca `""`).
6. `campos = { etapa: 'cancelado', cancelado_por, cancelado_obs: obs, cancelado_em: <agora ISO>,
   cancelado_quem: sessao.email, cancelado_etapa_anterior: obra.etapa, etapa_por: sessao.email,
   etapa_em: <agora ISO>, atualizacao: hojeISO() }`. **`desde_etapa` não entra.**
7. `linhas = linhasDeAlteracao({ etapa: obra.etapa }, { etapa: 'cancelado' }, 'Cancelamento')` com
   `motivo` da única linha = `rotuloCancelado(por)` + (`obs` ? `` ` — ${obs}` `` : `''`). Resultado:
   `Etapa: Em andamento → Cancelada · Motivo: Cancelado pelo Cliente — Loja informou…`.
8. `gravarComHistorico(supabase, { obraId, campos, linhas })` — **uma chamada, atômica**: a obra e a
   linha de histórico gravam juntas ou nenhuma. A trava de `gravarComHistorico` aceita: `etapa` tem
   linha; as colunas `cancelado_*` não são rastreadas (`COLUNA_PARA_CAMPO`, `historico.ts:171-193`).
   Erro → `{ error: 'Não deu para cancelar a obra. Nada mudou — tente de novo.' }` (verdade em todo
   caso, porque é uma transação só; inclui a recusa da trigger quando outra pessoa mudou a etapa no
   meio-tempo).
9. `revalidatePath` de `/obras/obra/${obraId}`, `/obras/base`, `/obras/diario` e `/obras/tarefas`.
   `{ success: true }`.

### 5.2 `desfazerCancelamentoAction(obraId: string)`

1. `abrirSessao()` → `lerObra`.
2. `!cancelada(obra)` → `{ error: 'Esta obra não está cancelada. Recarregue a página.' }`.
3. `anterior = obra.cancelado_etapa_anterior ?? null`; fora de `PODE_CANCELAR` →
   `{ error: 'Não dá para desfazer: a etapa anterior não está registrada.' }` (o CHECK impede o caso;
   a guarda existe porque é território de sobrescrita de dado de cliente).
4. `campos = { etapa: anterior, cancelado_por: null, cancelado_obs: null, cancelado_em: null,
   cancelado_quem: null, cancelado_etapa_anterior: null, etapa_por, etapa_em, atualizacao }`.
   **`desde_etapa` não entra** (decisão do mockup: os dias cancelada contam).
5. Linha: bloco `Cancelamento`, `Etapa: Cancelada → <nome da anterior>`, `motivo: 'Cancelamento
   desfeito'`.
6. `gravarComHistorico`; erro → `{ error: 'Não deu para desfazer o cancelamento. Nada mudou — tente
   de novo.' }`. Mesmos quatro `revalidatePath`.

### 5.3 O que muda nas actions que já existem

| Action | Mudança | Por quê |
|---|---|---|
| `mudarEtapaAction` (`:350`) | **Destino** `cancelado`: já recusado hoje (`ETAPAS_VALIDAS` vem de `CICLO`, `:56,360`) — só ganha teste que trava isso. **Origem** `cancelado`: logo depois de `lerObra`, `cancelada(obra)` → `{ error: 'Obra cancelada não muda de etapa. Use "Desfazer cancelamento".' }`, sem escrever | Sem a guarda, uma aba antiga com o seletor tiraria a obra do cancelamento pelo `update` direto (`:398`), sem limpar as colunas — o CHECK recusaria, mas com erro genérico |
| `salvarAutorizacaoAction`, `salvarIdentificacaoAction`, `salvarCronogramaAction` | depois de `lerObra`, `cancelada(obra)` → `{ error: 'Obra cancelada é só leitura. Desfaça o cancelamento para editar.' }` | Mockup, seção 3: só leitura. A tela esconde o Editar; o servidor é a fronteira (aba antiga) |
| `corrigirDataFechamentoAction` (`:444`) | nada novo em comportamento: a cancelada já é recusada (`ORDEM_ETAPA[cancelado]` não existe). Só o cast passa a ser `EtapaCiclo` depois de um `cancelada(obra)` explícito | `tsc` |
| `liberarObraAction`, `salvarDadosTriagemAction` | **nada**: já recusam etapa ≠ `definir` (`:596`, `:866`) | — |
| `ORDEM_ETAPA`, `PASSOS_MARCO`, `calcularMarcosDaEsteira`, `ETAPAS_VALIDAS` | tipos passam a `EtapaCiclo` | `tsc` |

---

## 6. A tela — ficha e triagem

### 6.1 A janela de cancelar — novo `app/obras/obra/[id]/_cancelar-obra.tsx`

Client component `FaixaCancelar`. Props: `obraId`, `loja`, `os`, `etapaNome`, `responsavel`
(`obra.pcm`), `variante: 'ficha' | 'triagem'`, `cancelar` (a action **por prop**, padrão da ficha,
`_ficha.tsx:17-22`; o tipo mínimo é declarado neste arquivo, nunca importado de `_actions.ts`).

**A faixa** (texto do mockup):

| Variante | Título | Texto |
|---|---|---|
| `ficha` | **Encerrar sem executar** | *O cliente desistiu, a Manfac não vai executar ou a OS foi aberta por engano? Cancele aqui. Nada é apagado e dá para desfazer.* |
| `triagem` | **Esta OS não vai virar obra?** | *Aberta por engano no Field, duplicada, ou o cliente desistiu antes de começar. Cancele em vez de deixar parada em "Aguardando definição".* |

Botão **"Cancelar obra"** abre a janela (`_ui/dialogo.tsx`, o mesmo componente da remarcação).

**A janela:**
- Título: `Cancelar a obra {loja}`; subtítulo `OS {os} · hoje em "{etapaNome}"`.
- **"Quem cancelou? \*"** — dois rádios: **"Cancelado pelo Cliente"** (*a DPSP desistiu ou suspendeu*)
  e **"Cancelado pela Manfac"** (*não vamos executar, ou OS aberta por engano*).
- **"O que aconteceu (opcional)"** — `<textarea>`.
- Caixa **"O que acontece ao cancelar"**: *A obra sai do diário do dia e das cobranças na hora.* ·
  *Nada é apagado: diário, fotos, tarefas e histórico continuam na ficha.* · *Dá para desfazer na
  própria ficha, e ela volta para "{etapaNome}".* · *No Field nada muda: se a OS também foi cancelada
  lá, é outro passo.*
- Botões: **"Voltar sem cancelar"** (ghost — recebe o foco, contrato do `Dialogo`) e **"Cancelar
  obra"**, **desabilitado até escolher** quem cancelou; enquanto desabilitado, a linha *"Escolha quem
  cancelou para continuar."* aparece acima dos botões.

**Estados** (na faixa — ver divergência 1, seção 10):

| Estado | Tela |
|---|---|
| Cancelando | O botão da faixa vira "Cancelando…" desabilitado |
| Sucesso | A server action revalida a rota; a ficha re-renderiza **já cancelada** (seção 6.3). Na Triagem, a mesma rota passa a mostrar a ficha cancelada (`page.tsx:186` só desvia para a Triagem com `etapa === 'definir'`) |
| Erro | Caixa vermelha na faixa com a mensagem do servidor e o botão **"Tentar de novo"**, que reenvia **a mesma escolha e a mesma observação** (mockup: "Sua escolha foi mantida: é só tentar de novo") |

### 6.2 Onde a faixa aparece

- **Ficha** (`_ficha.tsx`, dentro do `Box` do Ciclo de vida, logo depois do `<SeletorEtapa>` de
  `:621`): `podeCancelar(obra)` → `<FaixaCancelar variante="ficha" …/>`. `posCampo(obra)` → no lugar,
  a linha: *"Esta obra já foi executada em campo e não pode ser cancelada. Ela segue até faturar o que
  foi feito (decisão do cliente, 14/09)."* (ver divergência 2 sobre a frase das Pendências).
- **Triagem** (`_triagem.tsx`, depois do bloco de "Liberar para o diário do dia", `:557`):
  `<FaixaCancelar variante="triagem" cancelar={cancelarObraAction} …/>`. A Triagem já importa as
  actions direto (`_triagem.tsx:52`) — segue o padrão do próprio arquivo.
- A legenda do seletor ganha a frase do mockup: *"Cancelada" não aparece nesta lista — só se chega
  nela pelo botão abaixo, que pede o motivo.* — só quando a faixa aparece.

### 6.3 A ficha de uma obra cancelada

`_ficha.tsx` com `cancelada(obra)`:

| Parte | Comportamento |
|---|---|
| Cabeçalho | Pílula **"Cancelada · Cliente"** / **"Cancelada · Manfac"** (seção 7.2) |
| Selo (novo `_cancelamento.tsx`, client) logo abaixo do cabeçalho | **"Cancelado pelo Cliente"** / **"pela Manfac"** · *em DD/MM/AAAA às HH:MM por {cancelado_quem} · estava em {nome da etapa anterior}* · a observação entre aspas, se houver · botão **"Desfazer cancelamento"**. Data e hora no fuso de São Paulo (`FUSO`, `tipos.ts`) |
| Caixas de alerta e "Sem OS aprovada" | **Nenhuma.** `CaixaAlerta` já some (sem crítica, sem atraso — seção 4.3). A caixa "Sem OS aprovada" (`_ficha.tsx:555`, condição `!obra.os_aprovada && !temAlerta(obra)`) ganha `&& !cancelada(obra)` |
| Ciclo de vida | Cabeçalho extra *"congelado desde o cancelamento"*. "Prazo" mostra *"cancelada"*. `Esteira` recebe `cancelada`: o passo zero ganha o selo **"cancelada aqui"** no lugar de "a obra está aqui", `quando` = data do cancelamento e o texto *"Parou aqui. O diário e as fotos continuam abaixo, só leitura."*; quando `cancelado_etapa_anterior === 'definir'`, o passo zero se chama **"Triagem"**, dono *"Analista Manfac"*, texto *"Nunca foi liberada para o diário: não há registros de campo."*. Os passos da `ESTEIRA` ficam `pulado` com `quando` = *"não se aplica"* |
| Seletor de etapa e faixa de cancelar | **Não aparecem.** No lugar: *"Obra cancelada não muda de etapa. Para voltar a trabalhar nela, use **Desfazer cancelamento**."* |
| Autorização, Identificação, Cronograma | Mesma leitura de hoje, **sem Editar** (prop `somenteLeitura`, seção 6.5) |
| Diário, fotos, tarefas, remarcações, pendências, histórico | Como hoje (já são leitura) |

**"Desfazer cancelamento"** abre `Dialogo`:
- Título **"Desfazer o cancelamento?"**; corpo: *{loja} · OS {os}. A obra volta para **{etapa
  anterior}***, seguido de, conforme a etapa anterior:
  - `definir` → *e abre de novo na Triagem.*
  - `levantamento`/`andamento`/`paralisado` → *, entra de novo no diário de {pcm ou "do responsável"}
    e as tarefas abertas dela voltam a cobrar.*
- *O cancelamento {pelo Cliente | pela Manfac} de {DD/MM/AAAA} continua no histórico, junto com este
  desfazer.*
- Botões **"Manter cancelada"** (ghost, foco) e **"Desfazer cancelamento"**.
- Desfazendo: o botão do selo vira "Desfazendo…" desabilitado. Erro: linha vermelha no selo com a
  mensagem do servidor. Sucesso: a rota revalida e a ficha volta à etapa anterior (ou à Triagem).

### 6.4 Histórico — `_lib/historico.ts` e `_historico.tsx`

- `BlocoHistorico` ganha `'Cancelamento'`.
- `FILTROS` de `_historico.tsx:16` ganha `'Cancelamento'` no fim.
- A linha já aparece com o motivo: `_historico.tsx` mostra `Motivo: {l.motivo}` quando há.
- `formatarValor('etapa', 'cancelado')` passa a dar `'Cancelada'` sozinho (usa `nomeEtapa`).

### 6.5 Blocos só leitura — `_bloco-editavel.tsx` e os três blocos

`BlocoEditavel` (`_bloco-editavel.tsx:224`) ganha `somenteLeitura?: boolean`: com `true`, o botão
**Editar** (`:283-290`) não é desenhado; o corpo em leitura é o de sempre. `BlocoAutorizacao`,
`BlocoIdentificacao` e `BlocoCronograma` recebem e repassam a prop. Ausente = comportamento de hoje.

---

## 7. A Base — `app/obras/base/`

### 7.1 `_regras.ts`

| Ponto | Mudança |
|---|---|
| `COR_ETAPA` (`:40`) | `cancelado: '#64748b'` (`--ink-faint`, a cor de `faturado` e de `encerrada`; obrigatório pelo `Record<Etapa, …>`) |
| `opcoesEtapa` (`:137`) | Grupo novo no **fim**: `{ fase: 'Canceladas', opcoes: [{ v: 'cancelado', t: 'Todas as canceladas' }, { v: 'cancelado:cliente', t: 'Canceladas pelo Cliente' }, { v: 'cancelado:manfac', t: 'Canceladas pela Manfac' }] }` |
| `filtrar` (`:170`) | `etapa === 'todas'` → **exclui** `cancelada(o)`; `'cancelado'` → só canceladas; `'cancelado:cliente'`/`'cancelado:manfac'` → canceladas com aquele `cancelado_por`. `__esteira` e `fase:` já a excluem (seção 4.3) |
| `ordenar` (`:261`) | `ETAPAS[o.etapa]?.nome ?? o.etapa` → `nomeEtapa(o.etapa)` (`tsc`) |
| `kpisDaBase` (`:321`) | `velhas` ganha `!encerrada(o)` (é o único indicador que a cancelada ainda alcançaria: `!posCampo` é verdadeiro para ela e `dias` continua calculado). Os outros já a excluem: `andamento`/`paralisadas`/`aDefinir` por etapa, `estouradas` por `atraso` nulo, `esteira` por `posCampo`, `semOS` e `semCob` por `encerrada` — **cada um coberto por teste** |
| `cancelada`, `canceladasFora(obras, filtros)` | `canceladasFora` = `filtrar(obras, { ...filtros, etapa: 'cancelado' }).length` — o número do aviso é o que o "ver" vai mostrar com os outros filtros ativos |

### 7.2 `_etiquetas.tsx` — `EtiquetaEtapa`

`EtiquetaEtapa` (`:28`) passa a receber `Pick<Obra, 'etapa' | 'cancelado_por'>`: cancelada →
**"Cancelada · Cliente"** / **"Cancelada · Manfac"** na cor de `COR_ETAPA.cancelado`; demais etapas,
como hoje. Aparece na tabela, no cabeçalho da ficha e na Triagem sem mudança nos chamadores (todos
passam a obra inteira).

### 7.3 `_visao.tsx` — o aviso

Abaixo da tabela/Kanban:
- `filtros.etapa === 'todas'` e `canceladasFora > 0` → *"{N} obra(s) cancelada(s) fora desta lista ·
  **ver canceladas**"*; "ver canceladas" troca o filtro de etapa para `'cancelado'`.
- filtro de etapa começando com `'cancelado'` → *"Canceladas não contam dias, não aparecem no Kanban
  e não entram em nenhum indicador acima. Abrir a obra mostra quem cancelou, quando e por quê."*

No Kanban com filtro "Canceladas" as quatro colunas aparecem vazias ("nenhuma obra"), coerente com o
aviso acima — é o comportamento aprovado ("não entra em coluna nenhuma").

---

## 8. Tarefas e diário

- **Diário:** nenhuma mudança. `diario/page.tsx:31,62,135` só busca `levantamento`, `andamento`,
  `paralisado`; as tarefas e respostas do dia vêm das obras da fila (`:96-101`).
- **Tarefas** (`tarefas/page.tsx`, **área do Duda** — seção 11): a consulta de obras (`:54-57`) passa a
  trazer também `etapa`, e a lista entregue a `<Lista>` é filtrada por
  `tarefaVisivelNaLista(t, etapaDaObra[t.obra_id])`. Some só a tarefa **aberta** de obra cancelada
  (mockup, seção 5); a respondida continua, como registro. Ao desfazer, a obra deixa de ser
  `cancelado` e a tarefa volta sozinha, do jeito que estava — nada é apagado nem alterado em
  `obras_tarefa`.

---

## 9. Vai para `docs/DIVIDAS.md`

Bordas improváveis e não pedidas — registradas, **não tratadas**:

1. **Diário respondido numa aba antiga depois do cancelamento.** `salvarDiarioAction` lê a obra sem
   olhar a etapa (`diario/_actions.ts:80-84`) e aceitaria a resposta, podendo abrir tarefa para obra
   cancelada. Exige a aba do diário aberta desde antes do cancelamento.
2. **Tarefa aberta de obra cancelada respondida por aba antiga** de `/obras/tarefas`
   (`tarefas/_actions.ts:41`). Inofensivo: fecha uma cobrança que já não aparecia.
3. **Observação sem limite de tamanho** (`cancelado_obs` é `text`). Âncora: `cancelarObraAction`.
4. **Autoria do cancelamento forjável por quem já tem acesso**, via `update` direto pelo PostgREST
   (`cancelado_quem`/`cancelado_em` vêm do servidor, não do JWT). A trigger garante a transição, não a
   autoria. Mesma classe do M7 do histórico e de `etapa_por` (`sdd-sql-obras-historico.sql:144-148`).
5. **"N obras nesta visão · base completa: M"** (`_visao.tsx`) conta as canceladas em M. Correto
   ("base completa"), mas pode surpreender.
6. **OS cancelada no Field e reaberta como OS nova** (feedback 13, duplicadas) entra como obra nova em
   "Aguardando definição"; quem vê cancela de novo. Depende da verificação do status no Field (3B).

---

## 10. Divergências mockup × código (nenhuma muda o comportamento pedido)

1. **Estados dentro da janela.** O mockup mostra "Cancelando…", o erro e o "✓ Obra cancelada" dentro
   da própria janela. O `Dialogo` do módulo tem contrato fixo — *clicar em qualquer botão FECHA a
   janela e só depois roda o `onClick`* (`_ui/dialogo.tsx:18-22`), o mesmo que a remarcação segue.
   Por isso os estados aparecem **na faixa**: "Cancelando…" no botão, o erro com "Tentar de novo"
   (escolha e observação mantidas) na faixa, e o sucesso é a própria ficha já cancelada — que é o que
   o mockup diz acontecer em seguida ("a janela fecha e a ficha já aparece cancelada"). O mesmo vale
   para o "✓ Cancelamento desfeito…" da seção 3: a ficha volta à etapa anterior e a linha nova aparece
   no histórico, sem a caixa verde.
2. **"Registre isso em Pendências."** A linha da obra executada, no mockup, termina com *"Se o cliente
   cancelou o pedido depois do serviço, registre isso em Pendências."* Não há como: o bloco Pendências
   da ficha é só leitura (`_ficha.tsx:905-915`) e nenhuma tela grava `pendencia` fora da liberação
   (`_actions.ts:591`). **Recomendação: tirar a frase** (a spec já a tira). Se o João preferir outra
   orientação (ex.: "avise o analista de obras"), é trocar uma string.
3. **Selo "novo"** nas faixas do mockup é marcação de mockup, não vai para a tela.
4. **Ficha cancelada na Triagem.** O mockup, para a obra cancelada pela Manfac na triagem, não
   desenha os blocos Autorização/Identificação/Cronograma. A spec mostra os três, só leitura, como em
   qualquer obra cancelada: é a mesma ficha, e os campos preenchidos na triagem (tipo, valor, analista)
   continuam visíveis.
5. **"Parou no dia 16 de 20"** no passo congelado do mockup. Com a cancelada, `derivar` zera
   `diaDe`/`atraso` (seção 4.3), então o texto fica sem o "dia N de M". Guardar o prazo do momento do
   cancelamento exigiria coluna nova; não pedido.

---

## 11. Aviso ao Duda

`app/obras/tarefas/page.tsx` é da sua área. A mudança lá é **só esta**, e mais nada no arquivo:

- o `select` de `obras_obra` (`:55-57`) passa de `'id, os, loja, equipe, pcm'` para
  `'id, os, loja, equipe, pcm, etapa'`;
- a lista entregue ao `<Lista>` passa a ser `tarefas.filter((t) => tarefaVisivelNaLista(t,
  etapaDaObra[t.obra_id]))`, com a regra em `_lib/tipos.ts` (tarefa **aberta** de obra `cancelado` não
  aparece).

Também muda o tipo `Etapa` em `_lib/tipos.ts` (ganha `'cancelado'`; as nove de hoje viram
`EtapaCiclo`), `faseDe` passa a devolver `Fase | null` e `encerrada` passa a incluir `cancelado`.
Se você tiver código em andamento que use `ETAPAS[obra.etapa]`, `Record<Etapa, …>` ou compare
`faseDe(...)`, o `tsc` vai apontar — a correção é tratar a cancelada explicitamente. `diario/` não
muda.

---

## 12. Arquivos

| Arquivo | O que muda | Seção |
|---|---|---|
| `sdd-sql-obras-cancelamento.sql` | **novo** — migration + verificação + teste | 3 |
| `app/obras/_lib/tipos.ts` | `EtapaCiclo`, `'cancelado'`, `ObraRow` opcionais, catálogo e regras | 4 |
| `app/obras/_lib/historico.ts` | `BlocoHistorico` + `'Cancelamento'` | 6.4 |
| `app/obras/obra/[id]/_actions.ts` | + `cancelarObraAction`, `desfazerCancelamentoAction`; guardas em 4 actions; tipos `EtapaCiclo` | 5 |
| `app/obras/obra/[id]/_cancelar-obra.tsx` | **novo** — faixa + janela | 6.1 |
| `app/obras/obra/[id]/_cancelamento.tsx` | **novo** — selo + desfazer | 6.3 |
| `app/obras/obra/[id]/_ficha.tsx` | modo cancelada, faixa, linha da executada, esteira congelada | 6.2, 6.3 |
| `app/obras/obra/[id]/_triagem.tsx` | faixa da triagem | 6.2 |
| `app/obras/obra/[id]/_historico.tsx` | filtro "Cancelamento" | 6.4 |
| `app/obras/obra/[id]/_bloco-editavel.tsx`, `_bloco-autorizacao.tsx`, `_bloco-identificacao.tsx`, `_bloco-cronograma.tsx` | `somenteLeitura` | 6.5 |
| `app/obras/base/_regras.ts` | cor, filtro, opções, ordenação, `velhas`, `canceladasFora` | 7.1 |
| `app/obras/base/_etiquetas.tsx` | pílula "Cancelada · …" | 7.2 |
| `app/obras/base/_visao.tsx` | aviso | 7.3 |
| `app/obras/tarefas/page.tsx` | `etapa` no select + filtro (Duda) | 8, 11 |
| `app/obras/obra/[id]/page.tsx` | **nada** (o desvio da Triagem já é só `definir`) — ganha teste | 6.1 |
| `app/obras/diario/**` | **nada** | 8 |

Testes: plano, tarefa por tarefa.

---

## 13. Riscos

| Risco | O que faz |
|---|---|
| Deploy antes da migration | O botão falha (a RPC recusa `cancelado_por`, a obra não muda — é atômico). **Ordem: migration, verificação 11/11, teste 11/11, depois deploy.** Conferir coluna por coluna antes do deploy (`sql.md`) |
| `export` de tipo/constante em `_actions.ts` derruba a tela (armadilha 1) | Tipos das props ficam nos componentes; regras em `tipos.ts`; o teste `__tests__/use-server-exports-async.test.ts` varre os `use server` |
| O nome do CHECK de etapa em produção ser outro | A seção 0 aborta sem alterar nada; o PASSO 0 diz o nome |
| RPC em produção diferente da do repositório | O PASSO 0 (b) mostra o corpo atual antes do `create or replace` |
| Divisão `Etapa`/`EtapaCiclo` quebrar código fora do plano | O `tsc` aponta cada ponto; a lista conhecida está na seção 4.3 e 5.3. Cada tarefa do plano termina com `npx tsc --noEmit` limpo |
| Cancelar obra com equipe em campo hoje | Permitido de propósito (até `paralisado`, mockup seção 1). O diário do dia some da fila na próxima carga da página |
