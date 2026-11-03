# Frotas — terceira bateria: manutenção (revisão a cada 10 mil km, corretiva) e bases — design

**Data:** 03/11/2026. **Mockup aprovado:** https://claude.ai/artifact/Bwf22ugdZmLvHHAtCUw3j6
(arquivo `docs/frotas/mockups/2026-11-03-mockup-manutencao-e-bases.html`).
**Aprovação:** João, 03/11/2026, no chat: "tudo aprovado,prossiga" — mockup inteiro, todas as "Decisões em aberto"
resolvidas pela recomendação escrita, e o schema listado em `docs/frotas/2026-11-03-decisoes-terceira-bateria.md`.

O mockup é a fonte da verdade de telas, textos, estados e colunas. Esta spec registra o que o mockup não decide, onde
ele colidiu com o código real, e o SQL literal.

## Escopo

1. **Revisão a cada 10 mil km** (tela 1 do mockup) — previsão da próxima por KM, painel "um carro por linha",
   pendência por carro e o bloco de revisões do e-mail diário (que **já existe**: só troca a regra).
2. **Importação da planilha de revisões** (xlsx/csv) — arquivo → colunas → prévia → pronto.
3. **Manutenção corretiva** (tela 2) — tabela nova `manutencoes`, ligada ao "enviar para oficina"/"retornar" que já existem.
4. **Bases em tabela com Exportar Excel** (tela 3) — Revisões (histórico), Manutenção corretiva, Multas, Sinistros,
   Documentos, no motor das 4 bases da segunda bateria (`lib/sofia/bases/*`, `app/(operacoes)/sofia/_base/BaseTabela.tsx`).

**Fora:** tudo da frente paralela "Multa / Pendências B8 / fotos-avaria / histórico do checklist"
(`docs/frotas/mockups/2026-11-03-mockup-multa-fotos-checklist.html`).

## Fatos verificados no código e no banco (03/11/2026, leitura via PAT)

| Fato | Onde |
|---|---|
| `revisoes`: id, veiculo_id, tipo (`preventiva`/`corretiva`, sem CHECK), fornecedor, valor, nota_fiscal_storage_path, data_realizada, km_realizada, proxima_data, proxima_km, status, observacoes, created_at, updated_at, motorista_id, pecas_trocadas. Sem trigger. Policy `sofia access` (ALL, `sofia_has_access()`) | banco |
| **36 revisões em 18 veículos. 20 do tipo `corretiva`** (todas `status = em_dia`, **nenhuma** com `proxima_km` ou `proxima_data`, de 07/08 a 07/10/2026); 16 preventivas (11 com `proxima_km`) | consulta de leitura 03/11 |
| `nota_fiscal_storage_path` existe mas **0 linhas usam** e nenhuma tela grava | banco + grep |
| `veiculos`: … status (`ativo` 20 / `manutencao` 1 / `inativo` 3), equipe_id, previsao_retorno_oficina, substituto_id. Trigger `trg_bloquear_escrita_veiculos` (BEFORE UPDATE, só guarda `valor_locacao_mensal`) | banco |
| `criarRevisaoAction` **não tem guarda** (qualquer um com Sofia registra); `excluirRevisaoAction` usa `podeGerirFrotas` | `revisoes/_actions.ts` |
| `enviarParaOficinaAction`: guarda `podeGerirFrotas`; fecha `veiculo_responsabilidade_historico` aberto (`fim = hoje`), depois `veiculos.status='manutencao', equipe_id=null, previsao_retorno_oficina`; `logAudit`. **Duas escritas soltas** | `veiculos/_actions.ts` |
| `retornarDaOficinaAction`: `status='ativo', previsao_retorno_oficina=null, substituto_id=null` | idem |
| Helpers reais: `requireGestorFrotas(supabase)` → `null` ou mensagem; `podeGerirFrotas(supabase)` → boolean; RPC `sofia_pode_gerir()` | `lib/sofia/permissoes.ts` |
| Classificação de revisão hoje: **a mais recente por `created_at` de cada veículo+tipo**, `classificarRevisao` (atrasada por data/KM; vence em breve = faltam ≤ `MARGEM_AVISO_KM` = 1000) | `lib/sofia/queries.ts` (`classificarRevisoesMaisRecentes`), `lib/sofia/revisaoStatus.ts` |
| A mesma regra é **copiada** no e-mail diário, que **já tem** os blocos "Revisões atrasadas" e "Revisões chegando (faltam até 1.000 km)" | `lib/sofia/alertas/blocos.ts` (l. 127–143, 227–228), `leitura.ts` l. 32 |
| Pendências automáticas **não são gravadas**: são calculadas a cada leitura por `mapAutomaticPendencias`; hoje só entram revisões **atrasadas** | `lib/sofia/pendencias.ts`, `pendencias/page.tsx` |
| `getRevisoesAtrasadas`/`getRevisoesVenceEmBreve` alimentam Pendências, Revisões e a Visão geral | `queries.ts`, `visao-geral-leituras.ts` |
| Auditoria do Sofia: **sem trigger**; app usa `logAudit` (`criou`/`atualizou`/`excluiu`/`desativou`); funções F1–F3 gravam `audit_log.dados` (jsonb com `tipo`, `contexto`, `antes`, `depois`, `autor`) na mesma transação. `audit_log`: sem UPDATE/DELETE para authenticated | `lib/sofia/auditLog.ts`, `sdd-sql-sofia-correcoes-f1-f3.sql` |
| Padrão de tabela com escrita só de gestor: `sofia_extrato_*` — `ler` (SELECT, `sofia_has_access`), `gravar` (INSERT, `sofia_pode_gerir` + carimbo = e-mail do JWT), sem UPDATE/DELETE | `sdd-sql-sofia-extratos.sql` |
| Bucket privado `sofia-anexos` já usado por Documentos (upload no navegador) e Sinistros (URL assinada) | `documentos/novo/_form.tsx`, `documentos/_actions.ts` |
| Motor das bases: `BaseId = 'abast'|'km'|'mot'|'veic'`; leitura com RLS paginada (`buscarTudo`); exportar `.xlsx` com exceljs no navegador; nome `frotas-<arquivo>-AAAA-MM-DD.xlsx` | `lib/sofia/bases/*`, `_base/BaseTabela.tsx` |
| Multas: `MultasTable` com seleção em massa (enviar para desconto, excluir), `AutorizacaoActions` por linha, excluir. Sinistros: lista server-side com `AutorizacaoActions` + excluir | `multas/_table.tsx`, `sinistros/page.tsx` |
| `documentos_veiculo`: **0 linhas**; tipos `seguro`, `licenciamento`, `ipva`, `contrato_locacao`, `outro` | banco, `lib/sofia/enums.ts` |
| Multas no banco: 39 (status `pendente`/`validada`; autorização `sem_solicitacao`/`solicitado`/`autorizado`). Sinistros: 7 | banco |

## Decisões em aberto do mockup — adotadas pela recomendação

| # | Decisão | Adotado |
|---|---|---|
| 1.1 | Intervalo fixo ou por modelo | **10.000 km global, constante no código** (`INTERVALO_REVISAO_KM_PADRAO`, como `MARGEM_AVISO_KM`) + `veiculos.intervalo_revisao_km` opcional, vazio por padrão |
| 1.2 | Cálculo da próxima | **Próxima = KM realizada + intervalo do carro**, preenchida sozinha e editável ("Informar à mão"). Tipo corretiva → "Não prever a próxima" vem marcado |
| 1.3 | Planilha | `.xlsx` ou `.csv`; mínimas Placa, KM da revisão, Data; opcionais Oficina, Valor, Peças, Observações. Todas as linhas viram histórico; a próxima sai só da de maior KM de cada carro. Prévia obrigatória; erros ficam de fora e saem num relatório; repetida (mesma placa e KM) é ignorada; "importar avisos" vem **desmarcado** |
| 1.4 | Aviso | Tela + e-mail diário (já existem) + **uma pendência por carro** quando entra em "vence em breve" ou "atrasada"; some ao registrar a revisão |
| 1.5 | Margem | Mantém 1.000 km; data projetada só informativa |
| 2.1 | Corretiva onde | **Tabela própria `manutencoes`**. As 20 corretivas antigas ficam em `revisoes`, **sem migrar** (recebem `prever_proxima = false`) |
| 2.2 | Registrar tira da equipe? | Sim, caixa **marcada por padrão**, desmarcável (reparo de um dia) |
| 2.3 | Quem registra/muda status | **Só gestor de frotas e admin** (`sofia_pode_gerir`), no app **e no banco** (RLS). Usuário do Frotas consulta e exporta |
| 2.4 | "Quem arca" | Opcional na abertura, **obrigatório para concluir** (CHECK no banco) |
| 2.5 | Custo | Um valor total + **um anexo** (orçamento ou nota) no bucket `sofia-anexos`; itens nas observações |
| 3.1 | Base de Revisões | Histórico inteiro; situação só na vigente de cada carro, as outras "Histórico" |
| 3.2 | Corretivas na base de Revisões | Não; base própria |
| 3.3 | Documentos | Entra agora |
| 3.4 | Multas/Sinistros | Ações em massa e desconto **exatamente como estão**; a tabela só substitui a lista |
| 3.5 | Exportar | Quem vê, exporta. Dinheiro como número, datas como data, **nenhum caminho de arquivo**, autorização como texto |

## Onde o mockup colidiu com o código real — e como ficou

1. **Intervalo editável na tela e "simular o passar do tempo".** No mockup são controles de demonstração; a decisão 1.1
   manda constante no código. → A tela mostra o intervalo como texto ("10.000 km, padrão; N carros com intervalo
   próprio"); o intervalo próprio se edita na ficha do veículo (gestor). Simulação não existe no app.
2. **"Registrar revisão" só para gestor no mockup** (toast "Só gestor de frotas ou administrador registra revisão").
   Código atual e decisão #1 da segunda bateria (30/10): registrar revisão é aberto a quem tem Sofia. → **Mantido
   aberto** (menor mudança, nenhuma guarda nova). **Importar planilha** e **intervalo próprio** são só gestor/admin
   (carga em massa e regra que muda alertas). *Ponto para o coordenador confirmar com o João; se ele quiser fechar, é
   uma guarda `requireGestorFrotas` em `criarRevisaoAction` + esconder o botão.*
3. **"A pendência automática pode pedir uma coluna para não duplicar por carro."** Conferido: pendências automáticas
   são calculadas na leitura, nada é gravado. → **Sem coluna.** "Uma por carro" sai da regra "revisão vigente por carro".
4. **"Bloco no e-mail diário"** — já existe ("Revisões atrasadas" / "Revisões chegando"). → Não cria bloco; troca a
   regra de cálculo para a nova (tarefa de integração).
5. **Regra "mais recente por `created_at`, por veículo+tipo"** quebra com importação (histórico importado depois fica
   "mais recente"). → Nova regra: **vigente = maior `km_realizada` do carro**, qualquer tipo (empate: `data_realizada`,
   depois `created_at`). Corretiva antiga vigente → "Sem previsão automática" (é o caso da embreagem do mockup).
6. **Modais do mockup** → o app usa o padrão existente: formulário em página (`/nova`) e gaveta nas bases; "Concluir"
   e "Importar" são diálogos client.
7. **"O armazenamento de nota já existe nas revisões"** → a coluna existe mas não há tela (0 usos). A corretiva usa o
   bucket `sofia-anexos` no padrão de Documentos (upload no navegador, URL assinada de 60 s para ver).
8. **2.2 "dias parados alimentam o painel de Disponibilidade"** → o gráfico de dias parados fica na tela de corretiva
   (mês corrente). A página `/sofia/disponibilidade` **não muda** nesta rodada (dívida).
9. **Multas**: `multas/` é território da frente paralela (etapas, desconto só admin). → A base de Multas (colunas,
   filtro, planilha) é feita nesta frente em `lib/sofia/bases/*`; **ligar na página** fica na tarefa de integração,
   depois do merge da outra frente.
10. **"Oficina" como lista fixa no mockup** → texto livre (como `revisoes.fornecedor`). Sem cadastro de oficinas.
11. **Formulário de revisão do mockup omite motorista, observações e próxima data** → mantidos (menor mudança).
    "KM realizada" passa a obrigatório (o mockup marca `*` e a previsão depende dele).
12. **Abrir/concluir corretiva atômicos.** O "enviar para oficina" de hoje são duas escritas soltas. A corretiva faz
    três (manutenção + histórico + veículo) e muda status de veículo → **duas funções `security invoker`**
    (`sofia_abrir_manutencao`, `sofia_concluir_manutencao`), mesmo padrão das F1–F3 (guarda `sofia_pode_gerir() is not
    true`, auditoria em `audit_log.dados` na mesma transação). Não estavam na lista de schema aprovada, mas não criam
    tabela/coluna além dela; são implementação do que o mockup aprova. *Ponto para o coordenador mencionar ao João.*

## 1. Revisão a cada 10 mil km

### 1.1 Regra (funções puras em `lib/sofia/revisaoPrevisao.ts`)

- `INTERVALO_REVISAO_KM_PADRAO = 10000`. `intervaloDoVeiculo(v) = v.intervalo_revisao_km ?? 10000`.
- **Vigente do carro**: entre as revisões do veículo, maior `km_realizada` (nulos por último), empate por
  `data_realizada` (nulos por último), depois `created_at`. Todos os tipos contam.
- **Próxima efetiva** da vigente: se `prever_proxima = false` → nenhuma. Senão `proxima_km` se preenchida; senão
  `km_realizada + intervalo` (se houver KM). `auto = (proxima_km == null || proxima_km === km_realizada + intervalo)`
  → chip "auto".
- **Situação do carro** (veículos `status <> 'inativo'`):
  - `sembase` — nenhuma revisão; `semprev` — vigente com `prever_proxima = false`, ou sem próxima KM e sem próxima data;
  - `atrasada` — `km_atual >= próxima` **ou** `proxima_data < hoje` (mantém a regra por data de hoje);
  - `breve` — faltam ≤ `MARGEM_AVISO_KM` (1.000); `dia` — o resto.
- **Média km/dia**: lançamentos de `km_diario` do carro nos últimos 30 dias (data ≥ hoje−30); com ≥ 2 dias distintos,
  `(maior km − menor km) / dias entre o primeiro e o último`; ≤ 0 ou insuficiente → `null` ("—").
- **Chega em**: só `dia`/`breve` com média: `dias = ceil(falta / média)`, `quando = hoje + dias`.
- Textos e chips: os do mockup (`Atrasada`, `Vence em breve`, `Em dia`, `Sem previsão automática`,
  `Sem revisão registrada`; "passou X km", "~N dias (dd/mm)").

### 1.2 Tela `/sofia/revisoes` (substitui a lista atual)

Conforme tela 1 do mockup: cabeçalho, cartão do intervalo (texto, ver colisão 1), 4 cartões clicáveis (Atrasadas;
Vencem em até 1.000 km; Chegam em até 30 dias; Sem previsão automática = `semprev` + `sembase`) que filtram pela URL
(`?sit=atrasada|breve|d30|sp`), botões "+ Registrar revisão" (todos) e "⇪ Importar planilha" (só gestor), tabela um
carro por linha ordenada do mais urgente (colunas do mockup; "na oficina" quando `status = manutencao`), linha leva a
`/sofia/revisoes/nova?veiculo=<id>`. Bloco 1.1 "O aviso" do mockup: lista das pendências de revisão (atrasada/breve)
com o texto do mockup. Estados vazio (com "Importar planilha" para gestor), erro (`error.tsx` do Sofia) e carregando.

### 1.3 Formulário `/sofia/revisoes/nova`

Mantém os campos atuais e troca "Próxima KM prevista" pelo bloco do mockup: rádio **Calcular sozinha** (KM realizada +
intervalo do carro), **Informar à mão** (KM), **Não prever a próxima**. Tipo `corretiva` seleciona "Não prever".
`?veiculo=<id>` pré-seleciona o carro; ao escolher o carro, KM realizada vem com o `km_atual`. Prévia em texto:
"Próxima revisão em X km — o carro está em Y km e roda ~Z km/dia, então chega em ~N dias" (sem média: só a primeira
frase). Erros do mockup: "Informe o KM da revisão."; "O KM (X) é menor que o da última revisão deste carro (Y). Confira
o número." (só quando a data é ≥ a da vigente); "Informe o KM da próxima revisão ou escolha outra opção.".
`criarRevisaoAction` grava `prever_proxima`, `origem='manual'`, e `proxima_km` = auto/manual/null — **recalcula no
servidor** (lê `km_realizada` + intervalo do veículo), não confia no valor do navegador para o modo "auto".

### 1.4 Intervalo próprio (ficha do veículo)

Componente `revisoes/_intervalo.tsx` (campo + Salvar, só gestor) e `definirIntervaloRevisaoAction` (gestor;
1.000–100.000 ou vazio; `logAudit('veiculos','atualizou',…)`). Montado na ficha `/sofia/veiculos/[id]` na tarefa de
integração.

### 1.5 Pendência e e-mail (tarefa de integração)

- `queries.ts`: `getRevisoesAtrasadas` / `getRevisoesVenceEmBreve` passam a usar a regra 1.1 (mesmo tipo de retorno),
  o que corrige Revisões, Pendências e Visão geral juntos.
- `pendencias.ts`: entram também os carros em `breve`: "Revisão chegando: PLACA — faltam X km para Y" (origem
  `manutencao`, sem `prazoKm` para não contar como urgência alta). Atrasadas mantêm o texto de hoje.
- E-mail: `blocos.ts` troca a escolha "mais recente por created_at/tipo" pela regra 1.1; `leitura.ts` lê também
  `km_realizada, data_realizada, prever_proxima` e `veiculos.intervalo_revisao_km`. Títulos e textos dos blocos
  **não mudam**.

## 2. Importação da planilha

Diálogo de 4 passos do mockup (Arquivo, Colunas, Prévia, Pronto), só gestor.

- **Leitura no navegador**: `.xlsx` (exceljs, import dinâmico, 1ª aba) ou `.csv` (separador `;` ou `,`, detectado pelo
  cabeçalho; UTF-8). Máximo **2.000 linhas** e 2 MB; acima → erro "Arquivo grande demais".
- **Colunas**: sugestão pelo cabeçalho normalizado (sem acento, minúsculo): contém `placa`→Placa; `km`→KM da revisão;
  `data`→Data; `oficina`|`fornecedor`→Oficina; `valor`→Valor; `peca`→Peças trocadas; `obs`→Observações; resto
  "(ignorar)". Placa, KM e Data obrigatórias (mensagem do mockup). Cada campo ligado a no máximo uma coluna.
- **Valores**: placa em maiúsculas sem espaço/hífen; KM aceita `30.050`, `30050`, `30050,0`, número da célula; data
  aceita `dd/mm/aaaa`, `aaaa-mm-dd` e data da célula Excel; valor aceita `1.234,56` e número.
- **Prévia** (função pura, mesma nos dois lados): `erro` — "Placa não cadastrada", "KM inválido ("…")", "Data
  inválida", "Data no futuro"; `dup` — "Já existe (mesma placa e KM): ignorada" (no banco **ou** repetida no próprio
  arquivo); `aviso` — "KM maior que o atual do carro (X): conferir"; `ok`. Contadores do mockup; caixa "Importar também
  as linhas com aviso" **desmarcada**; "Baixar relatório de erros" (`.xlsx` com linha, placa, KM, data, motivo).
  "Baixar modelo" gera `.xlsx` com os cabeçalhos Placa, KM, Data, Oficina, Valor, Peças trocadas, Observações.
- **Gravar**: `importarRevisoesAction(linhas, incluirAvisos)` — guarda `requireGestorFrotas`; **revalida no servidor**
  com dados do banco (veículos, revisões existentes); insere num único `insert([...])` (atômico) com `tipo='preventiva'`,
  `origem='importacao'`, `prever_proxima=true`, `proxima_km = km + intervalo do carro`, `status='em_dia'`;
  `logAudit('revisoes','criou',null,'Importação de planilha: N revisões (A avisos incluídos, E erros e R repetidas fora)')`.
  Devolve contagens; passo 4 mostra "N revisões importadas" e "Ver na tela de revisões".
- Planilha real do Igor ainda não recebida: o mapeamento é a defesa; conferir com a real antes da primeira carga.

## 3. Manutenção corretiva

### 3.1 Telas

- **`/sofia/manutencoes`** (tela 2): 3 cartões (Em aberto + "N com o carro parado"; Custo de corretiva no mês corrente
  — soma de `custo` com `data_entrada` no mês; Carros parados hoje = veículos `manutencao`), a **base corr** (seção 4) e
  o gráfico 2.2 "Impacto na disponibilidade (<mês>)": dias parados por placa no mês corrente, só `tirou_da_equipe`,
  `dias = (saída real ou hoje) − entrada + 1`, recortado ao mês.
- **`/sofia/manutencoes/nova`** (só gestor; usuário comum é redirecionado à lista): campos do mockup — Veículo* (marca
  "(já na oficina)"), Defeito*, Oficina (texto), Data de entrada* (hoje), Saída prevista (hoje+3), Custo (pode vir
  depois), Quem arca, Status (sem "Concluída"), caixa "Tirar o carro da equipe (enviar para a oficina)" marcada com o
  texto de efeito do mockup, Observações. Erros do mockup ("Escolha o veículo.", "Descreva o defeito.", "A saída
  prevista não pode ser antes da entrada.").
- **Gaveta** (linha da base): detalhe do mockup; para gestor e não concluída: botão do próximo status
  ("Orçamento recebido: aguardando aprovação" / "Aprovado: carro em conserto") e "Concluir e retornar o carro" (diálogo:
  Saída real*, Custo final*, Quem arca*; texto "o veículo volta para Ativo" se tirou). Concluída: texto do mockup.
  "Anexar orçamento ou nota" (gestor, um arquivo, substitui) e "Ver anexo" (todos com Sofia).

### 3.2 Escrita (`app/(operacoes)/sofia/manutencoes/_actions.ts`)

- `abrirManutencaoAction` → RPC `sofia_abrir_manutencao`. `requireGestorFrotas` antes (mensagem amigável); o banco
  garante de novo. Erro `SOF01` → mensagem do banco; outro → "Erro ao registrar manutenção".
- `avancarStatusManutencaoAction(id, para)` → `proximoStatus(atual)` (puro) tem que bater; `update … set status, updated_at
  where id and status = atual` (RLS só deixa gestor); 0 linhas → "A manutenção mudou enquanto você olhava. Recarregue.";
  `logAudit('manutencoes','atualizou',id,'Status: X → Y')`.
- `concluirManutencaoAction` → RPC `sofia_concluir_manutencao`.
- `anexarManutencaoAction(id, path)` → gestor; `path` precisa começar com `manutencoes/<id>/`; `update anexo_storage_path`;
  `logAudit`. Upload no navegador para `sofia-anexos` em `manutencoes/<id>/<timestamp>-<nome-sanitizado>` (padrão de
  `documentos/novo/_form.tsx`, mesmo limite de tamanho/tipos de lá).
- `verAnexoManutencaoAction(id)` → lê o `anexo_storage_path` **do banco** pelo id (nunca do navegador) e devolve URL
  assinada de 60 s.
- `revalidatePath` de `/sofia/manutencoes`, `/sofia/veiculos`, `/sofia/veiculos/<id>`, `/sofia/equipes`,
  `/sofia/disponibilidade`, `/sofia`.

O "Enviar para oficina" / "Retornar da oficina" da ficha do veículo **continuam como estão** (sem criar/fechar
manutenção).

## 4. Bases (motor único)

`BaseId` ganha `'rev' | 'corr' | 'multa' | 'sin' | 'doc'`. Filtros por base (mockup): rev — busca, de, até, placa, tipo,
situação; corr — busca, de, até, placa, status, quem arca; multa — busca, de, até, placa, motorista, situação,
autorização; sin — busca, de, até, placa, motorista, tipo, situação; doc — busca, placa, tipo, situação (sem período).
`FiltrosBase` ganha `tipo`, `status`, `arca`, `aut` (e reaproveita `sit`). Sem filtro na URL: **sem período** (mostra
tudo) nas 5 novas. Colunas da tela, rodapé de totais e colunas da planilha **exatamente as do mockup** (`BASES.*.cols`,
`.total`, `.planilha`), com: dinheiro como número `FMT_MOEDA`, datas `FMT_DATA`, autorização em texto (Sem pedido /
Pedida / Autorizada), sim/não em texto, **nenhum `storage_path`**. Arquivos: `frotas-revisoes-…`,
`frotas-manutencao-corretiva-…`, `frotas-multas-…`, `frotas-sinistros-…`, `frotas-documentos-…`.

| Base | Rota | Linha | Observações |
|---|---|---|---|
| Revisões | `/sofia/revisoes/historico` (nova) | uma por revisão | situação só na vigente ("Histórico" nas outras); "Próxima (KM)" com chip auto; origem manual/importada; gaveta com "Registrar a próxima revisão deste carro" e, para gestor, Excluir (`excluirRevisaoAction`) |
| Corretiva | dentro de `/sofia/manutencoes` | uma por manutenção | "Dias parados" só se tirou; custo nulo = "a definir" |
| Multas | `/sofia/multas` (ligação na integração) | uma por multa | coluna Infração = `tipo_infracao ?? descricao`; seleção em massa, `AutorizacaoActions` e Excluir **como hoje** |
| Sinistros | `/sofia/sinistros` | um por sinistro | `AutorizacaoActions` e Excluir **como hoje**; link para `/sofia/sinistros/[id]` na gaveta |
| Documentos | `/sofia/documentos` | um por documento | situação vencido / vence em 30 dias / em dia; "Ver arquivo" (`VerArquivoButton`) na gaveta |

Para Multas e Sinistros, `BaseTabela` ganha props **opcionais, só client→client**: `selecao` (checkbox por linha; o do
cabeçalho marca/desmarca **só a página visível**), `celula(k, r)` (sobrescreve uma célula — usado para
`AutorizacaoActions`) e `acoesDetalhe(r)` (botões na gaveta). Cliques nesses controles não abrem a gaveta. As 4 bases
existentes não mudam de comportamento (testes atuais continuam passando).

"Registrar…" das bases novas: Revisões → `/sofia/revisoes/nova` (todos); Corretiva → `/sofia/manutencoes/nova` (só
gestor); Multas/Sinistros/Documentos → formulários existentes (comportamento atual de quem pode).

## 5. SQL

### 5.1 `sdd-sql-sofia-manutencao.sql` (literal)

```sql
-- ============================================================
-- *** NÃO APLICADO *** (escrito em 03/11/2026, branch feat/frotas-manutencao)
-- Gestão de Frotas (Sofia) — terceira bateria, frente "Manutenção e bases"
-- Design: docs/superpowers/specs/2026-11-03-frotas-manutencao-e-bases-design.md
-- Schema aprovado pelo João em 03/11/2026: docs/frotas/2026-11-03-decisoes-terceira-bateria.md
--
-- O QUE MUDA
--   1. revisoes.prever_proxima boolean not null default true. Na PRIMEIRA aplicação,
--      as revisões tipo 'corretiva' existentes viram false (03/11: 20 linhas, nenhuma
--      com proxima_km/proxima_data). Reaplicar não mexe de novo.
--   2. revisoes.origem text not null default 'manual' ('manual' | 'importacao').
--   3. veiculos.intervalo_revisao_km integer, opcional (1.000 a 100.000).
--   4. Tabela nova public.manutencoes (corretiva). RLS: ler = sofia_has_access();
--      inserir = sofia_pode_gerir() + carimbo criado_por = e-mail do JWT;
--      atualizar = sofia_pode_gerir(). SEM DELETE (nem policy nem grant).
--   5. Funções SECURITY INVOKER sofia_abrir_manutencao / sofia_concluir_manutencao,
--      guardadas por sofia_pode_gerir() is not true, auditoria em audit_log.dados
--      na mesma transação (padrão das F1–F3).
-- NÃO MUDA: as 18 policies "sofia access", os triggers sofia_bloquear_*,
--   nenhuma função existente.
-- DEPENDE de sdd-sql-sofia-gestor-frotas.sql (aplicado 28/10). A seção 0 aborta sem ele.
-- ORDEM: este (verificação 22/22) -> sdd-sql-sofia-manutencao-teste.sql (30/30)
--   -> deploy do app. (O app novo lê prever_proxima/origem/intervalo_revisao_km e
--   chama as RPCs: sem este SQL, Revisões e Manutenção quebram.)
-- Rodar como postgres, projeto iyytcavcgukfjnjjrerx. Idempotente.
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS — aborta a transação se algo não estiver aplicado
-- ============================================================
do $$
begin
  if to_regprocedure('public.sofia_pode_gerir()') is null then
    raise exception 'ABORTADO: public.sofia_pode_gerir() não existe — aplique sdd-sql-sofia-gestor-frotas.sql antes';
  end if;
  if to_regprocedure('public.sofia_has_access()') is null or to_regprocedure('public.sofia_is_admin()') is null then
    raise exception 'ABORTADO: sofia_has_access()/sofia_is_admin() não existem';
  end if;
  if to_regclass('public.revisoes') is null or to_regclass('public.veiculos') is null
     or to_regclass('public.equipes') is null
     or to_regclass('public.veiculo_responsabilidade_historico') is null then
    raise exception 'ABORTADO: tabelas do Sofia (revisoes/veiculos/equipes/veiculo_responsabilidade_historico) ausentes';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'audit_log' and column_name = 'dados') then
    raise exception 'ABORTADO: audit_log.dados não existe';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'veiculos' and column_name = 'previsao_retorno_oficina') then
    raise exception 'ABORTADO: veiculos.previsao_retorno_oficina não existe';
  end if;
  if to_regclass('public.manutencoes') is not null
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'manutencoes' and column_name = 'tirou_da_equipe') then
    raise exception 'ABORTADO: já existe public.manutencoes com outro formato — conferir antes de seguir';
  end if;
end;
$$;

-- ============================================================
-- 1. revisoes.prever_proxima (+ corretivas existentes = false, só na criação)
-- ============================================================
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'revisoes' and column_name = 'prever_proxima') then
    alter table public.revisoes add column prever_proxima boolean not null default true;
    update public.revisoes set prever_proxima = false where tipo = 'corretiva';
  end if;
end;
$$;
comment on column public.revisoes.prever_proxima is
  'false = não prever a próxima revisão por KM (corretiva, ou "Não prever" no formulário). O carro sai dos alertas por KM até a próxima revisão.';

-- ============================================================
-- 2. revisoes.origem
-- ============================================================
alter table public.revisoes add column if not exists origem text not null default 'manual';
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.revisoes'::regclass and conname = 'revisoes_origem_check') then
    alter table public.revisoes add constraint revisoes_origem_check check (origem in ('manual', 'importacao'));
  end if;
end;
$$;
comment on column public.revisoes.origem is 'manual = formulário; importacao = planilha (importarRevisoesAction).';

-- ============================================================
-- 3. veiculos.intervalo_revisao_km
-- ============================================================
alter table public.veiculos add column if not exists intervalo_revisao_km integer;
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.veiculos'::regclass and conname = 'veiculos_intervalo_revisao_km_check') then
    alter table public.veiculos add constraint veiculos_intervalo_revisao_km_check
      check (intervalo_revisao_km is null or intervalo_revisao_km between 1000 and 100000);
  end if;
end;
$$;
comment on column public.veiculos.intervalo_revisao_km is
  'Intervalo próprio entre revisões (km). NULL = padrão do sistema (10.000 km, constante no código).';

-- ============================================================
-- 4. Tabela manutencoes (manutenção corretiva)
-- ============================================================
create table if not exists public.manutencoes (
  id                 uuid primary key default gen_random_uuid(),
  veiculo_id         uuid not null references public.veiculos(id),
  defeito            text not null,
  oficina            text,
  data_entrada       date not null,
  saida_prevista     date,
  data_saida         date,
  custo              numeric(10,2),
  quem_arca          text,
  status             text not null default 'aguardando_orcamento',
  tirou_da_equipe    boolean not null default true,
  anexo_storage_path text,
  observacoes        text,
  criado_por         text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint manutencoes_defeito_check check (btrim(defeito) <> ''),
  constraint manutencoes_status_check
    check (status in ('aguardando_orcamento', 'aguardando_aprovacao', 'em_conserto', 'concluida')),
  constraint manutencoes_quem_arca_check
    check (quem_arca is null or quem_arca in ('locadora', 'empresa', 'motorista')),
  constraint manutencoes_custo_check check (custo is null or custo >= 0),
  constraint manutencoes_saida_prevista_check check (saida_prevista is null or saida_prevista >= data_entrada),
  constraint manutencoes_data_saida_check check (data_saida is null or data_saida >= data_entrada),
  constraint manutencoes_conclusao_coerente check (
    (status = 'concluida' and data_saida is not null and custo is not null and quem_arca is not null)
    or (status <> 'concluida' and data_saida is null)
  )
);

create index if not exists manutencoes_veiculo_idx on public.manutencoes (veiculo_id);
create index if not exists manutencoes_abertas_idx on public.manutencoes (veiculo_id) where status <> 'concluida';

comment on table public.manutencoes is
  'Manutenção corretiva (conserto que não é revisão). Escrita só por gestor de frotas/admin (RLS + RPCs sofia_abrir_manutencao/sofia_concluir_manutencao). Sem DELETE.';
comment on column public.manutencoes.tirou_da_equipe is
  'true = ao abrir, o veículo foi para "manutencao" e saiu da equipe (igual ao Enviar para oficina). Conta nos dias parados.';
comment on column public.manutencoes.criado_por is 'E-mail (minúsculo) do JWT de quem abriu; a policy de INSERT exige que seja o da sessão.';

alter table public.manutencoes enable row level security;

drop policy if exists manutencoes_ler on public.manutencoes;
create policy manutencoes_ler on public.manutencoes
  for select to authenticated
  using ((select public.sofia_has_access()));

drop policy if exists manutencoes_inserir on public.manutencoes;
create policy manutencoes_inserir on public.manutencoes
  for insert to authenticated
  with check ((select public.sofia_pode_gerir())
              and criado_por = lower(btrim((select auth.jwt()) ->> 'email')));

drop policy if exists manutencoes_atualizar on public.manutencoes;
create policy manutencoes_atualizar on public.manutencoes
  for update to authenticated
  using ((select public.sofia_pode_gerir()))
  with check ((select public.sofia_pode_gerir()));

revoke all on public.manutencoes from anon;
revoke all on public.manutencoes from authenticated;
grant select, insert, update on public.manutencoes to authenticated;

-- ============================================================
-- 5a. sofia_abrir_manutencao — cria a manutenção e, se pedido, tira o carro da equipe
--     (mesmo efeito de enviarParaOficinaAction), tudo numa transação.
-- ============================================================
create or replace function public.sofia_abrir_manutencao(
  p_veiculo_id      uuid,
  p_defeito         text,
  p_oficina         text,
  p_data_entrada    date,
  p_saida_prevista  date,
  p_custo           numeric,
  p_quem_arca       text,
  p_status          text,
  p_tirar_da_equipe boolean,
  p_observacoes     text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_email   text := lower(btrim(auth.jwt() ->> 'email'));
  v_defeito text := nullif(btrim(p_defeito), '');
  v_status  text := coalesce(p_status, 'aguardando_orcamento');
  v_tirou   boolean := coalesce(p_tirar_da_equipe, true);
  v_veic    record;
  v_equipe  text;
  v_id      uuid;
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem registrar manutenção corretiva';
  end if;

  if v_defeito is null then
    raise exception 'Descreva o defeito.' using errcode = 'SOF01';
  end if;
  if p_data_entrada is null then
    raise exception 'Informe a data de entrada.' using errcode = 'SOF01';
  end if;
  if p_saida_prevista is not null and p_saida_prevista < p_data_entrada then
    raise exception 'A saída prevista não pode ser antes da entrada.' using errcode = 'SOF01';
  end if;
  if v_status not in ('aguardando_orcamento', 'aguardando_aprovacao', 'em_conserto') then
    raise exception 'Status inválido para abrir a manutenção.' using errcode = 'SOF01';
  end if;
  if p_quem_arca is not null and p_quem_arca not in ('locadora', 'empresa', 'motorista') then
    raise exception 'Quem arca inválido.' using errcode = 'SOF01';
  end if;
  if p_custo is not null and p_custo < 0 then
    raise exception 'O custo não pode ser negativo.' using errcode = 'SOF01';
  end if;

  -- 1º veículo (mesma ordem de trava de lancar_km_atomico / corrigir_km_atomico).
  select v.id, v.placa, v.status, v.equipe_id into v_veic
  from public.veiculos v
  where v.id = p_veiculo_id
  for update;
  if not found then
    raise exception 'Veículo não encontrado.' using errcode = 'SOF01';
  end if;
  if v_veic.status = 'inativo' then
    raise exception 'Veículo desativado: reative antes de registrar a manutenção.' using errcode = 'SOF01';
  end if;

  insert into public.manutencoes
    (veiculo_id, defeito, oficina, data_entrada, saida_prevista, custo, quem_arca, status,
     tirou_da_equipe, observacoes, criado_por)
  values
    (p_veiculo_id, v_defeito, nullif(btrim(p_oficina), ''), p_data_entrada, p_saida_prevista, p_custo,
     p_quem_arca, v_status, v_tirou, nullif(btrim(p_observacoes), ''), v_email)
  returning id into v_id;

  if v_tirou then
    select e.codigo into v_equipe from public.equipes e where e.id = v_veic.equipe_id;
    -- igual a enviarParaOficinaAction: fecha o histórico aberto e tira a equipe
    update public.veiculo_responsabilidade_historico
       set fim = current_date
     where veiculo_id = p_veiculo_id and fim is null;
    update public.veiculos
       set status = 'manutencao',
           equipe_id = null,
           previsao_retorno_oficina = coalesce(p_saida_prevista, p_data_entrada)
     where id = p_veiculo_id;
  end if;

  insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id, usuario_email, dados)
  values (
    'manutencoes', 'criou', v_id::text,
    format('Manutenção corretiva aberta — %s: %s%s', v_veic.placa, v_defeito,
           case when v_tirou then ' (carro saiu da equipe)' else '' end),
    auth.uid(),
    v_email,
    jsonb_build_object(
      'tipo', 'manutencao_aberta',
      'contexto', jsonb_build_object('placa', v_veic.placa, 'veiculo_id', p_veiculo_id,
                                     'equipe_que_saiu', case when v_tirou then v_equipe end),
      'depois', jsonb_build_object('status', v_status, 'data_entrada', p_data_entrada,
                                   'saida_prevista', p_saida_prevista, 'custo', p_custo,
                                   'quem_arca', p_quem_arca, 'tirou_da_equipe', v_tirou),
      'veiculo', jsonb_build_object('status_antes', v_veic.status,
                                    'status_depois', case when v_tirou then 'manutencao' else v_veic.status end),
      'autor', jsonb_build_object(
        'email', v_email,
        'nome', nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
        'papel', case when public.sofia_is_admin() then 'administrador' else 'gestor de frotas' end)
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'placa', v_veic.placa,
    'equipe_que_saiu', case when v_tirou then v_equipe end,
    'veiculo_status', case when v_tirou then 'manutencao' else v_veic.status end
  );
end;
$$;

-- ============================================================
-- 5b. sofia_concluir_manutencao — fecha com saída real, custo e quem arca; devolve o
--     carro a 'ativo' (igual a retornarDaOficinaAction) se ele tinha saído da equipe e
--     não há outra manutenção aberta que também o tirou.
-- ============================================================
create or replace function public.sofia_concluir_manutencao(
  p_id         uuid,
  p_data_saida date,
  p_custo      numeric,
  p_quem_arca  text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_email   text := lower(btrim(auth.jwt() ->> 'email'));
  v_veiculo uuid;
  v_veic    record;
  v_m       record;
  v_voltou  boolean := false;
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem concluir manutenção corretiva';
  end if;

  if p_data_saida is null then
    raise exception 'Informe a saída real.' using errcode = 'SOF01';
  end if;
  if p_custo is null or p_custo < 0 then
    raise exception 'Informe o custo final (pode ser zero).' using errcode = 'SOF01';
  end if;
  if p_quem_arca is null or p_quem_arca not in ('locadora', 'empresa', 'motorista') then
    raise exception 'Informe quem arca com o custo.' using errcode = 'SOF01';
  end if;

  -- Leitura sem trava só para saber o veículo; conferida de novo depois da trava.
  select m.veiculo_id into v_veiculo from public.manutencoes m where m.id = p_id;
  if not found then
    raise exception 'Manutenção não encontrada.' using errcode = 'SOF01';
  end if;

  -- 1º veículo, 2º manutenção.
  select v.id, v.placa, v.status into v_veic
  from public.veiculos v where v.id = v_veiculo
  for update;

  select * into v_m from public.manutencoes m where m.id = p_id for update;
  if v_m.veiculo_id is distinct from v_veiculo then
    raise exception 'Os dados mudaram enquanto você editava. Recarregue a página e tente de novo.' using errcode = 'SOF01';
  end if;
  if v_m.status = 'concluida' then
    raise exception 'Esta manutenção já foi concluída.' using errcode = 'SOF01';
  end if;
  if p_data_saida < v_m.data_entrada then
    raise exception 'A saída real não pode ser antes da entrada.' using errcode = 'SOF01';
  end if;

  update public.manutencoes
     set status = 'concluida', data_saida = p_data_saida, custo = p_custo,
         quem_arca = p_quem_arca, updated_at = now()
   where id = p_id;

  if v_m.tirou_da_equipe and v_veic.status = 'manutencao'
     and not exists (select 1 from public.manutencoes o
                     where o.veiculo_id = v_veiculo and o.id <> p_id
                       and o.status <> 'concluida' and o.tirou_da_equipe) then
    update public.veiculos
       set status = 'ativo', previsao_retorno_oficina = null, substituto_id = null
     where id = v_veiculo;
    v_voltou := true;
  end if;

  insert into public.audit_log (tabela, operacao, registro_id, descricao, usuario_id, usuario_email, dados)
  values (
    'manutencoes', 'atualizou', p_id::text,
    format('Manutenção corretiva concluída — %s: saída %s, R$ %s%s', v_veic.placa,
           to_char(p_data_saida, 'DD/MM/YYYY'), p_custo,
           case when v_voltou then ' (veículo voltou a Ativo)' else '' end),
    auth.uid(),
    v_email,
    jsonb_build_object(
      'tipo', 'manutencao_concluida',
      'contexto', jsonb_build_object('placa', v_veic.placa, 'veiculo_id', v_veiculo),
      'antes', jsonb_build_object('status', v_m.status, 'custo', v_m.custo, 'quem_arca', v_m.quem_arca),
      'depois', jsonb_build_object('status', 'concluida', 'data_saida', p_data_saida,
                                   'custo', p_custo, 'quem_arca', p_quem_arca),
      'veiculo', jsonb_build_object('voltou_ativo', v_voltou),
      'autor', jsonb_build_object(
        'email', v_email,
        'nome', nullif(btrim(auth.jwt() -> 'user_metadata' ->> 'full_name'), ''),
        'papel', case when public.sofia_is_admin() then 'administrador' else 'gestor de frotas' end)
    )
  );

  return jsonb_build_object('placa', v_veic.placa, 'voltou_ativo', v_voltou);
end;
$$;

revoke all on function public.sofia_abrir_manutencao(uuid, text, text, date, date, numeric, text, text, boolean, text) from public, anon;
revoke all on function public.sofia_concluir_manutencao(uuid, date, numeric, text) from public, anon;
grant execute on function public.sofia_abrir_manutencao(uuid, text, text, date, date, numeric, text, text, boolean, text) to authenticated;
grant execute on function public.sofia_concluir_manutencao(uuid, date, numeric, text) to authenticated;

commit;


-- ============================================================
-- VERIFICAÇÃO (depois do commit) — uma linha por invariante.
-- 22 linhas. Qualquer "*** FALHOU ***" = parar, não deployar.
-- (4, 5 e 6 valem logo depois da 1ª aplicação; depois que o app gravar, podem divergir.)
-- ============================================================
select n as "#", verificacao, esperado, encontrado,
       case when encontrado = esperado then 'OK' else '*** FALHOU ***' end as resultado
from (values
  (1, 'revisoes.prever_proxima boolean NOT NULL default true', 'boolean|NO|true',
      (select data_type || '|' || is_nullable || '|' || column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'revisoes' and column_name = 'prever_proxima')),
  (2, 'revisoes.origem text NOT NULL default manual', 'text|NO|''manual''::text',
      (select data_type || '|' || is_nullable || '|' || column_default from information_schema.columns
       where table_schema = 'public' and table_name = 'revisoes' and column_name = 'origem')),
  (3, 'CHECK revisoes_origem_check existe', 'true',
      (select (count(*) = 1)::text from pg_constraint
       where conrelid = 'public.revisoes'::regclass and conname = 'revisoes_origem_check')),
  (4, 'nenhuma corretiva com prever_proxima = true', '0',
      (select count(*)::text from public.revisoes where tipo = 'corretiva' and prever_proxima)),
  (5, 'nenhuma preventiva com prever_proxima = false', '0',
      (select count(*)::text from public.revisoes where tipo <> 'corretiva' and not prever_proxima)),
  (6, 'todas as revisões existentes com origem manual', '0',
      (select count(*)::text from public.revisoes where origem <> 'manual')),
  (7, 'veiculos.intervalo_revisao_km integer, aceita NULL', 'integer|YES',
      (select data_type || '|' || is_nullable from information_schema.columns
       where table_schema = 'public' and table_name = 'veiculos' and column_name = 'intervalo_revisao_km')),
  (8, 'CHECK veiculos_intervalo_revisao_km_check existe', 'true',
      (select (count(*) = 1)::text from pg_constraint
       where conrelid = 'public.veiculos'::regclass and conname = 'veiculos_intervalo_revisao_km_check')),
  (9, 'manutencoes com RLS ligada', 'true',
      (select relrowsecurity::text from pg_class where oid = to_regclass('public.manutencoes'))),
  (10, 'policies de manutencoes: exatamente ler/inserir/atualizar (sem DELETE/ALL)',
       'manutencoes_atualizar:UPDATE,manutencoes_inserir:INSERT,manutencoes_ler:SELECT',
      (select string_agg(policyname || ':' || cmd, ',' order by policyname) from pg_policies
       where schemaname = 'public' and tablename = 'manutencoes')),
  (11, 'policy ler usa sofia_has_access()', 'true',
      (select (qual like '%sofia_has_access()%')::text from pg_policies
       where schemaname = 'public' and tablename = 'manutencoes' and policyname = 'manutencoes_ler')),
  (12, 'policy inserir: sofia_pode_gerir() + carimbo criado_por = e-mail do JWT', 'true',
      (select (with_check like '%sofia_pode_gerir()%' and with_check like '%criado_por%'
               and with_check like '%auth.jwt()%')::text from pg_policies
       where schemaname = 'public' and tablename = 'manutencoes' and policyname = 'manutencoes_inserir')),
  (13, 'policy atualizar: sofia_pode_gerir() no using e no with check', 'true',
      (select (qual like '%sofia_pode_gerir()%' and with_check like '%sofia_pode_gerir()%')::text from pg_policies
       where schemaname = 'public' and tablename = 'manutencoes' and policyname = 'manutencoes_atualizar')),
  (14, 'anon sem privilégio em manutencoes', 'false',
      (select has_table_privilege('anon', 'public.manutencoes', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')::text)),
  (15, 'authenticated: SELECT/INSERT/UPDATE sim, DELETE/TRUNCATE não', 'true',
      (select (has_table_privilege('authenticated', 'public.manutencoes', 'SELECT')
               and has_table_privilege('authenticated', 'public.manutencoes', 'INSERT')
               and has_table_privilege('authenticated', 'public.manutencoes', 'UPDATE')
               and not has_table_privilege('authenticated', 'public.manutencoes', 'DELETE')
               and not has_table_privilege('authenticated', 'public.manutencoes', 'TRUNCATE'))::text)),
  (16, '7 CHECKs em manutencoes', '7',
      (select count(*)::text from pg_constraint
       where conrelid = to_regclass('public.manutencoes') and contype = 'c')),
  (17, 'FK manutencoes.veiculo_id -> veiculos', 'true',
      (select (count(*) = 1)::text from pg_constraint
       where conrelid = to_regclass('public.manutencoes') and contype = 'f'
         and confrelid = 'public.veiculos'::regclass)),
  (18, 'as 2 funções são SECURITY INVOKER com search_path fixo', '2',
      (select count(*)::text from pg_proc
       where oid in (to_regprocedure('public.sofia_abrir_manutencao(uuid,text,text,date,date,numeric,text,text,boolean,text)'),
                     to_regprocedure('public.sofia_concluir_manutencao(uuid,date,numeric,text)'))
         and not prosecdef
         and exists (select 1 from unnest(proconfig) c where c like 'search_path=%'))),
  (19, 'as 2 funções guardadas por sofia_pode_gerir() is not true', '2',
      (select count(*)::text from pg_proc
       where oid in (to_regprocedure('public.sofia_abrir_manutencao(uuid,text,text,date,date,numeric,text,text,boolean,text)'),
                     to_regprocedure('public.sofia_concluir_manutencao(uuid,date,numeric,text)'))
         and position('sofia_pode_gerir() is not true' in prosrc) > 0)),
  (20, 'execute: anon não, authenticated sim (as 2)', 'true',
      (select (not has_function_privilege('anon', 'public.sofia_abrir_manutencao(uuid,text,text,date,date,numeric,text,text,boolean,text)', 'EXECUTE')
               and not has_function_privilege('anon', 'public.sofia_concluir_manutencao(uuid,date,numeric,text)', 'EXECUTE')
               and has_function_privilege('authenticated', 'public.sofia_abrir_manutencao(uuid,text,text,date,date,numeric,text,text,boolean,text)', 'EXECUTE')
               and has_function_privilege('authenticated', 'public.sofia_concluir_manutencao(uuid,date,numeric,text)', 'EXECUTE'))::text)),
  (21, 'as 18 policies "sofia access" continuam 18', '18',
      (select count(*)::text from pg_policies where schemaname = 'public' and policyname = 'sofia access')),
  (22, 'trigger trg_bloquear_escrita_veiculos continua em veiculos', 'true',
      (select (count(*) = 1)::text from pg_trigger
       where tgrelid = 'public.veiculos'::regclass and tgname = 'trg_bloquear_escrita_veiculos' and not tgisinternal))
) as t(n, verificacao, esperado, encontrado)
order by n;


-- ============================================================
-- ROLLBACK (comentado). Reverter o app ANTES. Apaga as manutenções registradas —
-- exportar a base "Manutenção corretiva" antes. As colunas de revisoes/veiculos
-- podem ficar (o app antigo não as lê).
-- ============================================================
-- begin;
-- drop function if exists public.sofia_concluir_manutencao(uuid, date, numeric, text);
-- drop function if exists public.sofia_abrir_manutencao(uuid, text, text, date, date, numeric, text, text, boolean, text);
-- drop table if exists public.manutencoes;
-- alter table public.veiculos drop constraint if exists veiculos_intervalo_revisao_km_check;
-- alter table public.veiculos drop column if exists intervalo_revisao_km;
-- alter table public.revisoes drop constraint if exists revisoes_origem_check;
-- alter table public.revisoes drop column if exists origem;
-- alter table public.revisoes drop column if exists prever_proxima;
-- commit;
```

### 5.2 `sdd-sql-sofia-manutencao-teste.sql` (literal)

```sql
-- ============================================================
-- *** NUNCA RODOU *** (escrito em 03/11/2026, branch feat/frotas-manutencao)
-- Sofia — Manutenção corretiva + colunas de revisão: TESTE DE COMPORTAMENTO (não altera nada)
-- DEPENDE DE: sdd-sql-sofia-gestor-frotas.sql e sdd-sql-sofia-manutencao.sql, aplicados.
-- Rodar como postgres (SQL Editor ou Management API com o PAT), projeto
-- iyytcavcgukfjnjjrerx. O bloco TERMINA EM ERRO DE PROPÓSITO: o raise final é
-- o relatório e a garantia de rollback. Resultado esperado: "RESUMO: 30/30 OK"
-- (p1, g1–g20, u1–u5, n1–n2, a1, z).
-- Fixture que falhar por coluna NOT NULL fora dos arquivos = deriva de schema:
-- ajustar a fixture, nunca o teste.
-- Depois, como postgres, conferir 0 linhas:
--   select count(*) from public.equipes where codigo like '\_\_TESTE\_MN%';
--   select count(*) from public.veiculos where placa like '\_\_TMN%';
--   select count(*) from auth.users where email like '\_\_teste\_mn\_%';
--   select count(*) from public.manutencoes where defeito like '\_\_teste%';
-- ============================================================

begin;

do $$
declare
  uid_g constant uuid := '00000000-0000-4000-a000-0000000000d1';
  uid_u constant uuid := '00000000-0000-4000-a000-0000000000d2';
  uid_a constant uuid := '00000000-0000-4000-a000-0000000000d3';
  uid_n constant uuid := '00000000-0000-4000-a000-0000000000d4';
  mail_g constant text := '__teste_mn_gestor@manfac.com.br';
  mail_u constant text := '__teste_mn_comum@manfac.com.br';
  mail_a constant text := '__teste_mn_admin@manfac.com.br';
  mail_n constant text := '__teste_mn_semacesso@manfac.com.br';
  e1 uuid := gen_random_uuid();
  v1 uuid := gen_random_uuid();   -- com equipe e1
  v2 uuid := gen_random_uuid();   -- sem equipe
  v3 uuid := gen_random_uuid();   -- inativo
  m1 uuid := gen_random_uuid();
  mg1 uuid; mg2 uuid; mg12 uuid; ma1 uuid; rv uuid := gen_random_uuid();
  r text[] := '{}';
  n_ok int := 0;
  n_total int := 0;
  v_int int;
  v_j jsonb;
begin
  -- ---------- FIXTURES (postgres, acima da RLS) ----------
  insert into auth.users (id, email, aud, role) values
    (uid_g, mail_g, 'authenticated', 'authenticated'),
    (uid_u, mail_u, 'authenticated', 'authenticated'),
    (uid_a, mail_a, 'authenticated', 'authenticated'),
    (uid_n, mail_n, 'authenticated', 'authenticated');
  insert into public.hub_user_roles (user_email, nivel, granted_by) values
    (mail_g, 'analista', 'teste-mn'), (mail_u, 'analista', 'teste-mn'),
    (mail_a, 'administrador', 'teste-mn'), (mail_n, 'analista', 'teste-mn');
  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by) values
    (mail_g, 'sofia', true, 'teste-mn'), (mail_u, 'sofia', true, 'teste-mn');
  insert into public.sofia_gestores (user_email, granted_by) values (mail_g, 'teste-mn');

  insert into public.equipes (id, codigo, ativo) values (e1, '__TESTE_MN_E1', true);
  insert into public.veiculos (id, placa, modelo, km_atual, equipe_id, status) values
    (v1, '__TMN01', 'teste', 1000, e1, 'ativo'),
    (v2, '__TMN02', 'teste', 2000, null, 'ativo'),
    (v3, '__TMN03', 'teste', 3000, null, 'inativo');
  insert into public.motoristas (id, nome, equipe_id, ativo) values (m1, '__teste_mn_m1', e1, true);
  insert into public.veiculo_responsabilidade_historico (veiculo_id, equipe_id, motorista_id, inicio) values
    (v1, e1, m1, date '2000-01-01');

  -- ---------- (p1) postgres sem JWT é barrado pela guarda ----------
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v1, '__teste p1', null, date '2000-02-01', null, null, null, null, true, null);
    r := r || '(p1) postgres sem JWT abrindo manutenção: *** FALHOU *** (passou)'::text;
  exception when raise_exception then
    n_ok := n_ok + 1; r := r || '(p1) postgres sem JWT abrindo manutenção: OK (barrado)'::text;
  end;

  -- ================= GESTOR (G) =================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid_g, 'email', mail_g,
    'role', 'authenticated', 'user_metadata', json_build_object('full_name', 'Gestor Teste'))::text, true);

  -- (g1) abre tirando da equipe: manutenção + veículo em manutenção + histórico fechado + auditoria
  n_total := n_total + 1;
  begin
    v_j := public.sofia_abrir_manutencao(v1, '__teste câmbio', 'Oficina X', date '2000-02-01', date '2000-02-05',
                                         null, null, null, true, null);
    mg1 := (v_j ->> 'id')::uuid;
    if (select status from public.manutencoes where id = mg1) = 'aguardando_orcamento'
       and (select criado_por from public.manutencoes where id = mg1) = mail_g
       and (select status from public.veiculos where id = v1) = 'manutencao'
       and (select equipe_id from public.veiculos where id = v1) is null
       and (select previsao_retorno_oficina from public.veiculos where id = v1) = date '2000-02-05'
       and not exists (select 1 from public.veiculo_responsabilidade_historico where veiculo_id = v1 and fim is null)
       and v_j ->> 'equipe_que_saiu' = '__TESTE_MN_E1'
       and exists (select 1 from public.audit_log l
                   where l.tabela = 'manutencoes' and l.operacao = 'criou' and l.registro_id = mg1::text
                     and l.usuario_id = uid_g and l.dados ->> 'tipo' = 'manutencao_aberta'
                     and l.dados -> 'contexto' ->> 'placa' = '__TMN01'
                     and l.dados -> 'autor' ->> 'papel' = 'gestor de frotas') then
      n_ok := n_ok + 1; r := r || '(g1) G abre tirando da equipe (veículo, histórico, auditoria): OK'::text;
    else r := r || ('(g1) G abre tirando da equipe: *** FALHOU *** (' || v_j::text || ')')::text; end if;
  exception when others then r := r || ('(g1) G abre: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g2) abre SEM tirar: veículo intacto
  n_total := n_total + 1;
  begin
    v_j := public.sofia_abrir_manutencao(v2, '__teste suspensão', null, date '2000-02-01', null,
                                         null, 'empresa', 'aguardando_orcamento', false, null);
    mg2 := (v_j ->> 'id')::uuid;
    if (select status from public.veiculos where id = v2) = 'ativo'
       and (select tirou_da_equipe from public.manutencoes where id = mg2) = false
       and v_j ->> 'veiculo_status' = 'ativo' then
      n_ok := n_ok + 1; r := r || '(g2) G abre sem tirar, veículo continua ativo: OK'::text;
    else r := r || '(g2) G abre sem tirar: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g2) G abre sem tirar: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g3) defeito vazio / (g4) saída prevista antes da entrada / (g5) status concluida na abertura
  -- (g6) veículo inativo / (g7) quem arca inválido: todos SOF01
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '   ', null, date '2000-02-01', null, null, null, null, false, null);
    r := r || '(g3) defeito vazio: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g3) defeito vazio: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '__teste g4', null, date '2000-02-10', date '2000-02-01', null, null, null, false, null);
    r := r || '(g4) saída prevista antes da entrada: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g4) saída prevista antes da entrada: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '__teste g5', null, date '2000-02-01', null, 10, 'empresa', 'concluida', false, null);
    r := r || '(g5) abrir já concluída: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g5) abrir já concluída: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v3, '__teste g6', null, date '2000-02-01', null, null, null, null, true, null);
    r := r || '(g6) veículo inativo: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g6) veículo inativo: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '__teste g7', null, date '2000-02-01', null, null, 'xyz', null, false, null);
    r := r || '(g7) quem arca inválido: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g7) quem arca inválido: OK (recusado)'::text;
  end;

  -- (g8) G muda status por UPDATE direto (RLS deixa)
  n_total := n_total + 1;
  begin
    update public.manutencoes set status = 'em_conserto', updated_at = now()
     where id = mg1 and status = 'aguardando_orcamento';
    get diagnostics v_int = row_count;
    if v_int = 1 then n_ok := n_ok + 1; r := r || '(g8) G avança status por UPDATE: OK'::text;
    else r := r || ('(g8) G avança status: *** FALHOU *** (linhas=' || v_int || ')')::text; end if;
  exception when others then r := r || ('(g8) G avança status: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g9) UPDATE direto para concluida sem saída/custo: CHECK de coerência barra
  n_total := n_total + 1;
  begin
    update public.manutencoes set status = 'concluida' where id = mg1;
    r := r || '(g9) concluída sem saída por UPDATE: *** FALHOU *** (passou)'::text;
  exception when check_violation then
    n_ok := n_ok + 1; r := r || '(g9) concluída sem saída por UPDATE: OK (CHECK barrou)'::text;
  end;

  -- (g10) concluir sem quem arca / (g11) saída antes da entrada: SOF01
  n_total := n_total + 1;
  begin
    perform public.sofia_concluir_manutencao(mg1, date '2000-02-04', 100, null);
    r := r || '(g10) concluir sem quem arca: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g10) concluir sem quem arca: OK (recusado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_concluir_manutencao(mg1, date '2000-01-15', 100, 'locadora');
    r := r || '(g11) saída antes da entrada: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g11) saída antes da entrada: OK (recusado)'::text;
  end;

  -- (g12) segunda manutenção tirando o MESMO carro; concluir a 1ª não devolve o carro
  n_total := n_total + 1;
  begin
    v_j := public.sofia_abrir_manutencao(v1, '__teste pneu', null, date '2000-02-02', date '2000-02-08',
                                         null, null, null, true, null);
    mg12 := (v_j ->> 'id')::uuid;
    v_j := public.sofia_concluir_manutencao(mg1, date '2000-02-04', 1500, 'locadora');
    if (v_j ->> 'voltou_ativo')::boolean = false
       and (select status from public.veiculos where id = v1) = 'manutencao'
       and (select status from public.manutencoes where id = mg1) = 'concluida'
       and (select custo from public.manutencoes where id = mg1) = 1500 then
      n_ok := n_ok + 1; r := r || '(g12) com outra aberta, concluir não devolve o carro: OK'::text;
    else r := r || ('(g12) outra aberta: *** FALHOU *** (' || v_j::text || ')')::text; end if;
  exception when others then r := r || ('(g12) outra aberta: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g13) concluir a última: carro volta a ativo, previsão e substituto limpos
  n_total := n_total + 1;
  begin
    v_j := public.sofia_concluir_manutencao(mg12, date '2000-02-09', 0, 'empresa');
    if (v_j ->> 'voltou_ativo')::boolean
       and (select status from public.veiculos where id = v1) = 'ativo'
       and (select previsao_retorno_oficina from public.veiculos where id = v1) is null
       and (select equipe_id from public.veiculos where id = v1) is null then
      n_ok := n_ok + 1; r := r || '(g13) concluir a última devolve o carro a ativo (sem equipe): OK'::text;
    else r := r || ('(g13) concluir a última: *** FALHOU *** (' || v_j::text || ')')::text; end if;
  exception when others then r := r || ('(g13) concluir a última: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g14) concluir de novo: SOF01
  n_total := n_total + 1;
  begin
    perform public.sofia_concluir_manutencao(mg12, date '2000-02-09', 0, 'empresa');
    r := r || '(g14) concluir duas vezes: *** FALHOU *** (passou)'::text;
  exception when sqlstate 'SOF01' then n_ok := n_ok + 1; r := r || '(g14) concluir duas vezes: OK (recusado)'::text;
  end;

  -- (g15) DELETE direto: sem privilégio nem para gestor
  n_total := n_total + 1;
  begin
    delete from public.manutencoes where id = mg2;
    r := r || '(g15) G apagando manutenção: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g15) G apagando manutenção: OK (sem privilégio)'::text;
  end;

  -- (g16) INSERT direto com carimbo de outra pessoa: RLS barra
  n_total := n_total + 1;
  begin
    insert into public.manutencoes (veiculo_id, defeito, data_entrada, criado_por)
    values (v2, '__teste g16', date '2000-02-01', mail_u);
    r := r || '(g16) INSERT com criado_por de outro: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then
    n_ok := n_ok + 1; r := r || '(g16) INSERT com criado_por de outro: OK (RLS barrou)'::text;
  end;

  -- (g17) INSERT direto com o próprio carimbo: passa
  n_total := n_total + 1;
  begin
    insert into public.manutencoes (veiculo_id, defeito, data_entrada, criado_por, tirou_da_equipe)
    values (v2, '__teste g17', date '2000-02-01', mail_g, false);
    n_ok := n_ok + 1; r := r || '(g17) INSERT com o próprio carimbo: OK'::text;
  exception when others then r := r || ('(g17) INSERT com o próprio carimbo: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g18) revisão nova: prever_proxima = true e origem = manual por padrão
  n_total := n_total + 1;
  begin
    insert into public.revisoes (id, veiculo_id, tipo, km_realizada, data_realizada, status)
    values (rv, v2, 'preventiva', 1900, date '2000-01-20', 'em_dia');
    if (select prever_proxima from public.revisoes where id = rv) = true
       and (select origem from public.revisoes where id = rv) = 'manual' then
      n_ok := n_ok + 1; r := r || '(g18) revisão nova com prever_proxima=true e origem=manual: OK'::text;
    else r := r || '(g18) padrões da revisão: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(g18) revisão nova: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (g19) origem fora da lista: CHECK barra
  n_total := n_total + 1;
  begin
    update public.revisoes set origem = 'planilha' where id = rv;
    r := r || '(g19) origem inválida: *** FALHOU *** (passou)'::text;
  exception when check_violation then n_ok := n_ok + 1; r := r || '(g19) origem inválida: OK (CHECK barrou)'::text;
  end;

  -- (g20) intervalo próprio: 500 barra, 15000 passa
  n_total := n_total + 1;
  begin
    begin
      update public.veiculos set intervalo_revisao_km = 500 where id = v2;
      r := r || '(g20) intervalo 500: *** FALHOU *** (passou)'::text;
    exception when check_violation then
      update public.veiculos set intervalo_revisao_km = 15000 where id = v2;
      if (select intervalo_revisao_km from public.veiculos where id = v2) = 15000 then
        n_ok := n_ok + 1; r := r || '(g20) intervalo 500 barrado, 15000 gravado: OK'::text;
      else r := r || '(g20) intervalo 15000: *** FALHOU ***'::text; end if;
    end;
  exception when others then r := r || ('(g20) intervalo: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- ================= USUÁRIO COMUM DO FROTAS (U) =================
  perform set_config('request.jwt.claims', json_build_object('sub', uid_u, 'email', mail_u,
    'role', 'authenticated')::text, true);

  -- (u1) lê as manutenções (mg1, mg2, mg12, g17)
  n_total := n_total + 1;
  select count(*) into v_int from public.manutencoes where veiculo_id in (v1, v2);
  if v_int = 4 then n_ok := n_ok + 1; r := r || '(u1) U lê as 4 manutenções: OK'::text;
  else r := r || ('(u1) U lê: *** FALHOU *** (viu ' || v_int || ')')::text; end if;

  -- (u2) RPC abrir / (u3) RPC concluir: barrados pela guarda
  n_total := n_total + 1;
  begin
    perform public.sofia_abrir_manutencao(v2, '__teste u2', null, date '2000-02-01', null, null, null, null, false, null);
    r := r || '(u2) U abrindo: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u2) U abrindo: OK (barrado)'::text;
  end;
  n_total := n_total + 1;
  begin
    perform public.sofia_concluir_manutencao(mg2, date '2000-02-03', 10, 'empresa');
    r := r || '(u3) U concluindo: *** FALHOU *** (passou)'::text;
  exception when raise_exception then n_ok := n_ok + 1; r := r || '(u3) U concluindo: OK (barrado)'::text;
  end;

  -- (u4) INSERT direto, mesmo com o próprio carimbo: RLS barra
  n_total := n_total + 1;
  begin
    insert into public.manutencoes (veiculo_id, defeito, data_entrada, criado_por)
    values (v2, '__teste u4', date '2000-02-01', mail_u);
    r := r || '(u4) U INSERT direto: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(u4) U INSERT direto: OK (RLS barrou)'::text;
  end;

  -- (u5) UPDATE direto: 0 linhas, nada muda
  n_total := n_total + 1;
  update public.manutencoes set status = 'em_conserto' where id = mg2;
  get diagnostics v_int = row_count;
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(u5) U UPDATE direto: OK (0 linhas)'::text;
  else r := r || ('(u5) U UPDATE direto: *** FALHOU *** (linhas=' || v_int || ')')::text; end if;

  -- ================= SEM ACESSO AO FROTAS (N) =================
  perform set_config('request.jwt.claims', json_build_object('sub', uid_n, 'email', mail_n,
    'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  select count(*) into v_int from public.manutencoes where veiculo_id in (v1, v2);
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(n1) N não vê manutenções: OK'::text;
  else r := r || ('(n1) N vê: *** FALHOU *** (viu ' || v_int || ')')::text; end if;

  n_total := n_total + 1;
  begin
    insert into public.manutencoes (veiculo_id, defeito, data_entrada, criado_por)
    values (v2, '__teste n2', date '2000-02-01', mail_n);
    r := r || '(n2) N INSERT direto: *** FALHOU *** (passou)'::text;
  exception when insufficient_privilege then n_ok := n_ok + 1; r := r || '(n2) N INSERT direto: OK (RLS barrou)'::text;
  end;

  -- ================= ADMIN DO HUB (A) =================
  perform set_config('request.jwt.claims', json_build_object('sub', uid_a, 'email', mail_a,
    'role', 'authenticated')::text, true);

  n_total := n_total + 1;
  begin
    v_j := public.sofia_abrir_manutencao(v2, '__teste a1', null, date '2000-03-01', null, null, null,
                                         'aguardando_aprovacao', true, '  ');
    ma1 := (v_j ->> 'id')::uuid;
    if (select status from public.veiculos where id = v2) = 'manutencao'
       and (select previsao_retorno_oficina from public.veiculos where id = v2) = date '2000-03-01'
       and (select observacoes from public.manutencoes where id = ma1) is null
       and exists (select 1 from public.audit_log l where l.registro_id = ma1::text
                   and l.dados -> 'autor' ->> 'papel' = 'administrador') then
      n_ok := n_ok + 1; r := r || '(a1) A abre (previsão = entrada sem saída prevista; papel administrador): OK'::text;
    else r := r || '(a1) A abre: *** FALHOU ***'::text; end if;
  exception when others then r := r || ('(a1) A abre: *** FALHOU *** (' || sqlerrm || ')')::text;
  end;

  -- (z) auditoria: 4 'criou' (g1, g2, g12, a1; o INSERT direto do g17 não audita) e 2 'atualizou' (conclusões)
  n_total := n_total + 1;
  if (select count(*) from public.audit_log where tabela = 'manutencoes' and operacao = 'criou'
        and registro_id in (mg1::text, mg2::text, mg12::text, ma1::text)) = 4
     and (select count(*) from public.audit_log where tabela = 'manutencoes' and operacao = 'atualizou'
        and registro_id in (mg1::text, mg2::text, mg12::text, ma1::text)) = 2 then
    n_ok := n_ok + 1; r := r || '(z) 4 aberturas e 2 conclusões auditadas, nenhuma a mais: OK'::text;
  else r := r || '(z) contagem de auditoria: *** FALHOU ***'::text; end if;

  raise exception E'TESTE MANUTENÇÃO (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;
```

### 5.3 Notas do SQL

- **RLS conferida pelo padrão**: leitura igual às 18 tabelas (`sofia_has_access`, embrulhado em `(select …)` como em
  `perf-rls-initplan`); escrita no padrão `sofia_extrato_gravar` (gestor + carimbo), mais UPDATE só gestor porque a
  manutenção muda de status. Nada de policy `ALL`.
- **Grants**: Supabase dá tudo a `anon`/`authenticated` em tabela nova por padrão (conferido em `revisoes`) — daí o
  `revoke all` + `grant select, insert, update`. `service_role` fica com o padrão (não é usado pelo app nesta frente).
- **Auditoria**: as tabelas irmãs não têm trigger de auditoria; segue o padrão F1–F3 (função grava `audit_log.dados`) e
  `logAudit` no app para status e anexo.
- Guardas imperativas com `is not true` (armadilha 1 de `sql.md`); nenhum trigger compartilhado é tocado (armadilha 2).
- `current_date` ao fechar o histórico: mesmo comportamento de `enviarParaOficinaAction` (dia UTC).
- O teste roda **depois** da aplicação, em produção, com rollback forçado (padrão de gestor/F1–F3/extratos).

## 6. Restrições

- Fase "menor mudança". Schema só o aprovado (+ as 2 funções da colisão 12). SQL aplicado só com autorização escrita do
  João, citando os arquivos, **antes** do deploy.
- Leituras das telas com o cliente do usuário (RLS), nunca service role. Escrita restrita: `requireGestorFrotas` no app
  + RLS/guarda no banco. **Nenhum import de `@/lib/auth/requireAdmin` ou `@/lib/auth/roles`** no Sofia
  (`sem-admin-do-hub.test.ts`).
- Mensagem pós-ação pela URL só com id/código fixo (regra do `sofia.md`).
- Tema do hub; telas usáveis a 375px.

## 7. Fora do escopo / dívidas (registrar em `docs/DIVIDAS.md` na integração)

1. Editar ou excluir manutenção corretiva depois de concluída (mockup: "exige gestor e fica no histórico") — sem tela;
   correção hoje só via SQL. Sem DELETE de propósito.
2. "Enviar para oficina"/"Retornar da oficina" da ficha não criam/fecham manutenção; carro devolvido pela ficha com
   manutenção aberta fica com a manutenção aberta até alguém concluir.
3. Página `/sofia/disponibilidade` e Custos/Visão geral não somam corretivas (dias parados e custo ficam na tela de
   corretiva).
4. As 20 corretivas antigas continuam em `revisoes` (sem migrar, decisão 2.1).
5. Re-importação simultânea da mesma planilha por duas pessoas pode duplicar (checagem de repetida é no app, sem índice
   único — improvável, só gestor importa).
6. `criado_por` pode ser alterado por UPDATE de gestor (a policy de UPDATE não congela colunas).
7. `veiculos.intervalo_revisao_km` guardado só no app (`requireGestorFrotas`); o trigger `sofia_bloquear_escrita_nao_admin`
   não foi estendido para não mexer em trigger compartilhado.
8. Base de Multas sem as colunas novas da frente paralela (etapa etc.) até a integração; ajustar colunas/planilha lá.
9. "Registrar revisão" continua aberto a quem tem Sofia (colisão 2) — fechar se o João confirmar o mockup.
10. Média km/dia sem lançamentos recentes = "—" e sem "Chega em".
