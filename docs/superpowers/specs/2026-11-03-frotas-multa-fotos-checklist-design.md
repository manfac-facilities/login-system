# Frotas — terceira bateria, frente "Multa, Pendências, fotos/avaria e histórico do checklist" — design

**Data:** 03/11/2026. **Mockup aprovado (fonte da verdade de telas, textos e fluxo):**
`docs/frotas/mockups/2026-11-03-mockup-multa-fotos-checklist.html` (https://claude.ai/artifact/V1Darj3zA3D811LSkCEwsh).
**Aprovação:** `docs/frotas/2026-11-03-decisoes-terceira-bateria.md` — João, 03/11/2026: "tudo aprovado,prossiga". Todas as
"Decisões em aberto" do mockup estão resolvidas **pela recomendação escrita nele**, inclusive a decisão 3 da multa
(gestor de frotas solicita, **só administrador autoriza**). Schema aprovado na mesma mensagem (lista literal no arquivo de
decisões). Nada aqui reabre decisão.

**Território:** autorização (nova regra de quem autoriza), dinheiro (desconto em salário), RLS/policies novas e escrita que
apaga dado de cliente (fotos e avarias passam a ser imutáveis) — quatro das cinco exceções do `AGENTS.md`. A defesa
redundante abaixo é obrigatória, não excesso. **Revisão independente obrigatória** antes de aplicar o SQL.

**Método:** leitura do código em `master` `b9f4235` e **leitura do banco de produção** (`iyytcavcgukfjnjjrerx`, só
`select`, via PAT, 03/11/2026). Tudo marcado "medido" abaixo veio do banco, não dos `.sql` do repositório.

---

## 0. Resumo

| Item | Hoje (medido) | Depois |
|---|---|---|
| Fluxo da multa | `status` (pendente/validada/descontada, **sem CHECK**) + `autorizacao_status` (CHECK 3 valores), editados por 5 actions soltas | coluna nova `etapa` (10 valores, CHECK); `status` e `autorizacao_status` **derivados** dela por trigger; escrita só pela RPC `sofia_multa_registrar_etapa` |
| Quem autoriza desconto de multa | gestor de frotas **ou** admin (`sofia_pode_gerir()`) | **só admin** (`sofia_is_admin() is true`) — trigger nova + RPC |
| Registro de quem fez cada etapa | não existe | tabela nova `multa_etapas` (só inserção) |
| Motorista aceita termo | não existe; coluna `autorizacao_storage_path` existe mas **nenhum código grava nela** | upload do termo em papel pelo gestor; aceite digital vira **dívida** (motoristas não têm login — §2.3) |
| Pendências de multa | toda multa `status <> 'descontada'` vira "Multa sem tratativa", prazo = data do fato | texto pela etapa; prazo = `prazo_indicacao` (só antes da indicação); multa em desconto vai para "Aguardando terceiros" |
| Fotos do checklist | 4 obrigatórias + Interna, 1 por posição; câmera **e galeria** | + fotos extras ilimitadas na tela, teto 30; **só câmera ao vivo** no checklist |
| Fotos do sinistro | 2 espaços fixos ("Dano 1", "Dano 2") | lista + "Mais fotos", galeria permitida, teto 30 |
| Avaria | `avaria_identificada` + texto | tabela nova `checklist_avarias` (peça, tamanho, reparo/troca, aberta/reparada); baixa só gestor/admin |
| Apagar foto salva | qualquer usuário do Sofia apaga a linha (`sofia access` ALL); excluir checklist/sinistro apaga as linhas em cascata | **ninguém**: privilégio revogado + trigger para qualquer role |
| Bucket `checklist-fotos` e `sofia-anexos` | privados; **leitura e upload liberados a qualquer usuário logado do hub**, mesmo sem Sofia | leitura e upload exigem `sofia_has_access()`; continua sem UPDATE/DELETE; app continua por URL assinada |
| Histórico do checklist | lista dos 50 últimos de todos os carros | página por veículo, comparação lado a lado / sobreposta, diff só dos dados, avarias abertas com baixa |
| Troca de carro | — | painel do último checklist do veículo ao lado da câmera; **trava D1 intocada** |

---

## 1. O que foi conferido no banco (03/11/2026, só leitura)

- `multas` (medido): `id, veiculo_id, motorista_id, data date not null, descricao, valor numeric not null,
  valor_descontado, tipo_desconto text not null default 'nenhum', status text not null default 'pendente',
  autorizacao_assinada bool not null default false, autorizacao_storage_path, ziv_task_id, observacoes, created_at,
  data_recebimento date, tipo_infracao, autorizacao_status text default 'sem_solicitacao', autorizacao_solicitado_em`.
  Constraints: só PK, 2 FKs e `multas_autorizacao_status_check`. **`status` não tem CHECK.**
- Distribuição atual: `pendente/sem_solicitacao` 33, `validada/solicitado` 3, `pendente/autorizado` **2**,
  `validada/autorizado` 1 (este sem `data_recebimento`). Nenhuma `descontada`. As 2 `pendente/autorizado` são
  incoerentes com a derivação nova — tratadas em §3.4.
- Trigger em `multas`: só `trg_bloquear_autorizacao_multas` (BEFORE INSERT/UPDATE/DELETE → `sofia_bloquear_autorizacao_nao_admin()`,
  habilitado). Corpo em produção = o de `sdd-sql-sofia-gestor-frotas.sql` (guarda `sofia_pode_gerir() is not true`, 7 `raise`).
  **Esta spec não altera essa função** (é compartilhada com `sinistros` e `km_excedido_desconto`); acrescenta uma trigger
  própria de `multas` (§3.3).
- `sofia_pode_gerir()` usa `coalesce(..., false)`; `sofia_is_admin()` é `exists(...)` — ambas sempre `true/false`.
  `authenticated` tem EXECUTE nas duas (medido com `has_function_privilege`).
- `checklist` (medido): **não tem coluna de KM**; `created_by uuid` (auth.users). 30 checklists, **todos com foto**.
- `checklist_fotos`: `id, checklist_id (FK ON DELETE CASCADE), storage_path, posicao, latitude, longitude, tirada_em,
  created_at`. Posições existentes: Frente/Traseira/Lateral Esq./Lateral Dir. 30 cada, Interna 6; máximo 5 fotos por checklist.
- `sinistro_fotos`: `id, sinistro_id (FK ON DELETE CASCADE), storage_path, created_at`; 12 linhas.
- RLS: `checklist`, `checklist_fotos`, `multas`, `sinistros`, `sinistro_fotos` têm só a policy `sofia access` (ALL,
  `(select sofia_has_access())`). Grants padrão do Supabase (anon/authenticated com tudo).
- Storage: buckets `checklist-fotos` e `sofia-anexos` **privados**, sem limite de tamanho/mime. Policies:
  `authenticated read checklist` (SELECT, `bucket_id = 'checklist-fotos'`), `authenticated upload checklist` (INSERT),
  `authenticated read anexos`, `authenticated upload anexos` — **nenhuma checa `sofia_has_access()`** e não há UPDATE/DELETE.
  O app lê por URL assinada (`createSignedUrls(paths, 3600)` em `checklist/[id]/page.tsx:31` e `sinistros/[id]/page.tsx:20`).
  Conclusão: a foto só é servida por URL assinada (ok), mas **qualquer usuário logado do hub (Obras, Compras…) pode listar
  o bucket e assinar URL** — corrigido em §3.7.
- Índices: `checklist`, `checklist_fotos` e `multas` só têm a PK.
- `veiculo_responsabilidade_historico`: `veiculo_id, equipe_id, motorista_id, inicio, fim, origem_checklist_id` — base do
  condutor sugerido.

## 2. Decisões de implementação (o que o mockup não decide)

### 2.1 Etapas da multa

Chave gravada → rótulo na tela (textos do mockup, aba 1):

| ordem | `etapa` | Rótulo | Quem registra | `status` derivado | `autorizacao_status` derivado |
|---|---|---|---|---|---|
| 0 | `registrada` | Multa registrada | qualquer usuário do Sofia (insert) | pendente | sem_solicitacao |
| 1 | `condutor` | Confirmar o condutor | gestor/admin | pendente | sem_solicitacao |
| 2 | `termo` | Motorista aceita o termo de responsabilidade | gestor/admin (anexa papel) | pendente | sem_solicitacao |
| 3 | `indicado` | Indicar condutor ao órgão autuador | gestor/admin | pendente | sem_solicitacao |
| 4 | `validada` | Gestor da equipe valida (RH em cópia) | gestor/admin "em nome de" | validada | sem_solicitacao |
| 4 | `contestada` | Contestada pelo gestor da equipe | gestor/admin "em nome de" | pendente | sem_solicitacao |
| 5 | `cobrada` | Boleto da locadora lançado | gestor/admin | validada | sem_solicitacao |
| 6 | `solicitado` | Solicitar desconto | gestor/admin | validada | solicitado |
| 7 | `autorizado` | Autorizar desconto | **só admin** | validada | autorizado |
| 8 | `descontada` | RH desconta no contracheque | gestor/admin | descontada | autorizado |

(É exatamente `STATUS_DE`/`AUTORIZ_DE` do mockup, mais `contestada`, que o mockup cita no texto da etapa 5.)

**Transições** (impostas no banco, §3.3; a tela só oferece a próxima):

- Avançar para qualquer etapa de ordem maior é permitido a gestor/admin, **exceto**:
  - `autorizado` só a partir de `solicitado`, e **só admin**;
  - `descontada` só a partir de `autorizado` (sem isto o gestor contornaria o admin pulando direto para "descontada");
  - `contestada` só a partir de `registrada`/`condutor`/`termo`/`indicado`; é **final** nesta rodada.
- Voltar: só `autorizado → solicitado` (Revogar, **só admin**), `solicitado → cobrada` (Cancelar solicitação,
  gestor/admin), `descontada → autorizado` (Desfazer desconto, gestor/admin; limpa valor/tipo/competência).
- Nenhuma outra transição. Pular etapa para frente é permitido (indicação feita fora do sistema antes de existir o
  fluxo), e a tela registra a etapa pulada como "não registrada".
- `status`, `autorizacao_status`, `valor_descontado`, `tipo_desconto` e `desconto_competencia` **não podem ser escritos
  direto** — só mudam junto com a etapa. Isso força todas as actions antigas a migrar (lista em §4.2).

### 2.2 Prazo de indicação e multa em dobro

- `prazo_indicacao` = `data_recebimento + 30` preenchido pela tela no registro, **editável** (decisão 5): no registro por
  qualquer usuário; depois só gestor/admin.
- Pill do prazo (mockup `prazoPill`): etapa já em `indicado` ou além → "indicado"; vencido → "prazo vencido: paga em
  dobro"; ≤5 dias vermelho; ≤10 dias amarelo; senão neutro.
- Prazo vencido antes da indicação: o cartão "Prazo vencido: a multa será paga em dobro" com o registro
  `pago_em_dobro` + `responsavel_dobro` (`empresa` | `motorista`). **Só registra** (decisão 4); nenhum desconto
  automático. O "valor extra" do mockup = `valor` (o dobro é o mesmo valor de novo) — não há coluna de valor extra no
  schema aprovado, então a tela mostra `valor` como extra.
- Locadora: texto livre com sugestões (`Locafácil`, `Maestro`, `Foco` — as três do documento do Igor). O cartão "Modo de
  indicação por locadora" da etapa `indicado` usa o texto do mockup quando a locadora for uma dessas três; outra
  locadora não mostra o cartão.

### 2.3 Aceite do termo: motoristas NÃO têm login no hub → só upload do papel

Prova (banco, 03/11/2026): a tabela `motoristas` tem só `id, nome, cnh, cnh_vencimento, contato, equipe_id, ativo,
created_at`; **nenhuma tabela `motorista*` tem coluna de e-mail ou de usuário** (consulta em `information_schema.columns`
com `ilike '%email%' or ilike '%user%'` devolveu zero linhas). Não existe ligação motorista ↔ `auth.users`, então o
motorista não tem como abrir a multa "no celular, dentro do hub" e o sistema não teria como saber que quem aceitou é ele.

Pela própria recomendação da decisão 1 ("se não tiverem, começar só com o upload"): a etapa `termo` é registrada pelo
gestor/admin anexando o termo assinado (PDF ou foto, bucket `sofia-anexos`, caminho `multas/<multa_id>/termo-<timestamp>.<ext>`),
o que grava `autorizacao_storage_path` e `autorizacao_assinada = true`. O botão "Simular: motorista aceita no celular"
do mockup **não** é construído. Aceite digital → `docs/DIVIDAS.md` (§7).

### 2.4 Condutor sugerido

Resolvido pelo histórico `veiculo_responsabilidade_historico` na **data da infração** (`multas.data`), reaproveitando
`resolverNaData` de `lib/sofia/bases/responsabilidade.ts` (só leitura, já testado pela frente A da segunda bateria).
Mostra equipe, carro e motorista do dia (cartão do mockup). Confirmar grava `motorista_condutor_id` **e** `motorista_id`
(é `motorista_id` que Descontos, ficha do motorista e e-mail leem); o valor anterior de `motorista_id` fica em
`multa_etapas.dados.motorista_anterior`.

### 2.5 Validação pelo gestor da equipe

Sem login novo (decisão 2): gestor/admin registra "em nome de" (texto, obrigatório), canal (`email`, `whatsapp`,
`telefone`, `presencial`; obrigatório) e observação (obrigatória se contestada). Fica em `multa_etapas`.

### 2.6 Desconto

Etapa `descontada` exige `valor_descontado` (0 ≤ v ≤ `valor`, conferido no banco), `tipo_desconto` (`total`|`parcial`)
e `desconto_competencia` (mês do contracheque, gravado como dia 1). É o que a tela Descontos já pedia, mais a competência.

### 2.7 Fotos

- **Teto:** 30 fotos por checklist (obrigatórias + Interna + extras + fotos de avaria) e 30 por sinistro. Conferido na tela
  (botão "+ Mais fotos" some no 30º, com o texto "Limite de 30 fotos") **e** na action (rejeita > 30). Não vai para o banco
  (menor mudança; o teto protege upload e armazenamento, não é regra de segurança).
- **Compressão:** já existe (`lib/sofia/comprimirImagem.ts`, lado maior 1600 px, JPEG 0,85) e é usada pelo `CameraCapture`
  nos dois caminhos. Nada muda.
- **Câmera ao vivo no checklist, galeria no sinistro (decisão 2):** **colisão com o mockup** — o mockup diz que hoje o
  `CameraCapture` é só câmera ao vivo, mas ele já oferece "ou escolher da galeria" (`components/sofia/CameraCapture.tsx`).
  Implementação: prop nova `permitirGaleria` (default `true`, para não mudar outro uso); o checklist passa `false`, o sinistro
  não passa nada.
- **Fotos extras:** componente novo `components/sofia/FotosAdicionais.tsx` — lista de miniaturas + botão "+ Mais fotos
  (ângulo livre)", cada uma com "x" **só no rascunho** (antes de salvar; decisão 5). Posição gravada: `Extra 1`, `Extra 2`…
- **Nenhuma foto salva pode ser apagada** (decisão 5 + pedido): §3.6. Consequência que o mockup não mostra: **excluir um
  checklist ou um sinistro que tenha foto passa a ser recusado** (o FK é `ON DELETE CASCADE` e a cascata bate na trigger).
  Como os 30 checklists de hoje têm foto, a exclusão de checklist fica, na prática, desativada. A action devolve
  "Este checklist tem fotos salvas. Fotos são prova e não podem ser apagadas, por isso o checklist não pode ser excluído."
  (idem sinistro). Ver §8 — é a colisão mais importante a confirmar com o João.

### 2.8 Avaria

- Campos (mockup aba 3): peça (lista do mockup: Para-choque dianteiro, Para-choque traseiro, Porta esquerda, Porta
  direita, Retrovisor, Farol / lanterna, Pneu / roda, Para-brisa, Outra peça), tamanho (`pequena` "Pequena (até 5 cm)",
  `media` "Média (5 a 20 cm)", `grande` "Grande (acima de 20 cm)"), reparo/troca opcional, descrição opcional.
  Obrigatório para adicionar: peça, tamanho, ≥1 foto da peça, ≥1 foto da avaria (decisão 3) — conferido na tela e na action.
- Fotos de avaria vão em `checklist_fotos` com `tipo_foto = 'avaria_peca' | 'avaria_dano'` e `avaria_id`.
- Ciclo: `aberta` → `reparada` (data + quem), **só gestor/admin**, sem volta. Reparo/troca pode ser definido depois por
  gestor/admin. Nada mais da avaria muda; nada é apagado.
- Não entra em Pendências (decisão 4). A lista de avarias abertas fica no histórico do veículo.
- O checklist continua gravando `avaria_identificada = (avarias.length > 0)` e `avaria_descricao` = peças separadas por
  vírgula, para as telas antigas e o detalhe continuarem coerentes. O par "Avaria identificada? / texto" sai do formulário.
- `avaria_origem_id` (aprovado no schema) é criado e **fica sem uso nesta rodada**: a continuidade da avaria entre
  checklists é calculada pela regra de §2.9, que não precisa dele.

### 2.9 Histórico e comparação

- Rota nova `/sofia/checklist/veiculo/[veiculoId]` (leitura para qualquer usuário do Sofia, decisão 4). Links: cada linha
  da lista de checklists ("Histórico do veículo") e a ficha do veículo (tarefa de integração).
- Tabela: Data, Tipo, Motorista, Avarias (nº registradas no checklist). **Colisões com o mockup:** não há KM no checklist
  (coluna inexistente) e "Feito por" não é legível (é `created_by` uuid de `auth.users`) → a coluna KM e a linha "KM
  rodado entre os dois" saem; "Feito por" vira "Motorista". O 1º checklist do veículo leva a pill "base".
- Comparação: `?a=<id>&b=<id>&modo=lado|sobre`. Padrão: `b` = o mais recente, `a` = o anterior (decisão 1). Atalho
  "Comparar com a entrada (base)" = o mais antigo do veículo. "Antes" é sempre o mais antigo (reordena e avisa, como o
  mockup). Os dois iguais → "Escolha dois checklists diferentes."
- Por posição obrigatória: as duas fotos lado a lado, ou sobrepostas com controle de opacidade (componente client).
  **Colisão:** o mockup mostra a pill "mudou/igual" por posição, calculada da imagem; a decisão 2 proíbe comparar
  imagem → a pill sai. Fotos extras e de avaria aparecem numa faixa "Outras fotos" de cada lado.
- "O que mudou (automático, só dos dados)" — função pura `lib/sofia/checklistHistorico.ts`:
  - item `*_ok`: `true → false` "OK passou para problema"; `false → true` "problema passou para OK" (null não conta);
  - avaria **aberta no momento** de um checklist = registrada num checklist do mesmo veículo com `data ≤` a data dele e
    (`reparada_em` nulo ou `> ` a data dele). Aberta em B e não em A = "Avaria nova"; em A e não em B = "Avaria resolvida";
    nas duas = "Avaria continua".
- Avarias abertas do veículo (abaixo da comparação) com "Marcar como reparada" (data, padrão hoje) para gestor/admin;
  botão desabilitado com o motivo para os demais.

### 2.10 Painel do último checklist na troca

No `checklist/novo`, com tipo `troca` e veículo escolhido, cada posição obrigatória mostra, ao lado da câmera, a foto da
mesma posição do último checklist do veículo ("Último: Frente · dd/mm/aaaa"), via server action que devolve URLs
assinadas. Sem checklist anterior: "Primeiro checklist deste veículo." **Não bloqueia nada e não toca a trava D1**
(decisão 3 do histórico).

### 2.11 Pendências (B8) — `lib/sofia/pendencias.ts`

Texto por etapa (literal do mockup, `textoNovo`), com `<base>` = `<placa>, <tipo da infração em minúsculas>`
(fallbacks: "veículo sem placa", descrição, "sem detalhes adicionais"):

| etapa atual | descrição | grupo | prazo |
|---|---|---|---|
| `registrada` | Confirmar o condutor: <base> | a fazer | `prazo_indicacao` |
| `condutor` | Aguardando aceite do termo pelo motorista: <base> | a fazer | `prazo_indicacao` |
| `termo` | Indicar o condutor ao órgão até dd/mm/aaaa: <base> | a fazer | `prazo_indicacao` |
| `indicado` | Aguardando validação do gestor da equipe: <base> | a fazer | nulo |
| `validada` | Lançar o boleto da locadora: <base> | a fazer | nulo |
| `cobrada` | Solicitar o desconto: <base> | a fazer | nulo |
| `solicitado` | Multa enviada para desconto, aguardando autorização: <base> | aguardando terceiros | nulo |
| `autorizado` | Desconto autorizado, aguardando o RH descontar em folha: <base> | aguardando terceiros | nulo |
| `descontada`, `contestada` | — (não aparece) | — | — |

(Se `prazo_indicacao` for nulo nas três primeiras, prazo nulo e o texto da etapa `termo` vira "Indicar o condutor ao
órgão: <base>".) Na página, "aguardando terceiros" entra com status `em_andamento` (conta no KPI "Aguardando Terceiros",
nunca fica vermelho) e é exibido num bloco separado embaixo da tabela, com o título "Aguardando terceiros (não conta como
atrasada)" e o texto da regra do mockup. Sinistro **não muda** (decisão 3 de pendências).

### 2.12 E-mail diário

Decisão 5 da multa: alerta de prazo de indicação em 10, 5 e 2 dias no e-mail que já existe. Como o e-mail só sai seg–sex,
"exatamente no dia 10/5/2" perderia o aviso que cai no fim de semana; implementação: o bloco de multas passa a listar só
as multas **antes da indicação** com prazo vencido ou que vence em **até 10 dias**, com "vence em N dias" / "prazo vencido".
Multas sem prazo próximo saem do e-mail (seguem em Pendências). É arquivo compartilhado → tarefa de integração.

---

## 3. Banco de dados

### 3.1 Colunas novas em `multas`

`etapa text not null default 'registrada'` (CHECK 10 valores), `locadora text`, `auto_infracao text`, `orgao_autuador text`,
`pontos integer` (≥ 0), `prazo_indicacao date`, `motorista_condutor_id uuid → motoristas`, `indicado_em date`,
`protocolo_indicacao text`, `boleto_lancado_em date`, `pago_em_dobro boolean not null default false`,
`responsavel_dobro text` (`empresa`|`motorista`, obrigatório se e só se `pago_em_dobro`), `desconto_competencia date` (dia 1).

### 3.2 Tabelas novas

- `multa_etapas` — só inserção: `multa_id`, `etapa`, `etapa_anterior`, `feito_em`, `feito_por` (e-mail do JWT, conferido
  na policy), `em_nome_de`, `canal`, `observacao`, `dados jsonb`. Leitura: `sofia_has_access()`. Inserção:
  `sofia_pode_gerir()` **e** `feito_por` = e-mail do JWT. Sem UPDATE/DELETE para `authenticated`; nada para `anon`.
  Some com a multa (FK `on delete cascade`; excluir multa já é só gestor/admin pela trigger existente).
- `checklist_avarias` — ver §2.8. Leitura/inserção: `sofia_has_access()`; UPDATE: `sofia_pode_gerir()` + trigger que só
  deixa mudar `acao` e dar baixa; DELETE: privilégio revogado + trigger que recusa para qualquer role. FK para
  `checklist` **sem cascade**.
- Em `checklist_fotos`: `avaria_id uuid → checklist_avarias` e `tipo_foto text not null default 'obrigatoria'`
  (`obrigatoria`|`interna`|`extra`|`avaria_peca`|`avaria_dano`), CHECK `avaria_id` presente ⇔ tipo de avaria, e a avaria
  tem de ser do mesmo checklist (trigger). Backfill: `Interna` → `interna`, demais → `obrigatoria`.
- Índice `checklist (veiculo_id, data desc)` (aprovado) e `checklist_avarias (checklist_id)`.

### 3.3 Trigger nova `trg_multas_etapa` (função `sofia_multas_etapa_guarda`)

BEFORE INSERT OR UPDATE em `multas`, **security definer**, `search_path = pg_catalog, public`. Todas as guardas com
`is not true` (falham FECHADAS se a função de autorização devolver NULL). Roda **depois** de
`trg_bloquear_autorizacao_multas` (ordem alfabética do nome) e não depende dela: mesmo se aquela fosse desabilitada pelo
contorno do SQL Editor, esta continua barrando. DELETE continua com a trigger existente (inalterada).

- INSERT: etapa tem de ser `registrada`; `status`/`autorizacao_status` têm de ser os derivados; nenhum campo de etapa
  posterior preenchido (`prazo_indicacao` pode).
- UPDATE sem mudar etapa: proibido mudar `status`/`autorizacao_status` (qualquer role) e o trio do desconto; campos do
  processo (`prazo_indicacao`, condutor, `motorista_id`, indicação, boleto, dobro, termo, `autorizacao_solicitado_em`)
  só gestor/admin.
- UPDATE mudando etapa: só gestor/admin; as transições de §2.1; `autorizado` (vindo de `solicitado`) e a revogação
  (`autorizado → solicitado`) só `sofia_is_admin() is true`; ao entrar em `descontada`, confere valor/tipo/competência;
  ao sair de `descontada`, exige o trio limpo. No fim, **sobrescreve** `status` e `autorizacao_status` com os derivados.
- `postgres`/`service_role` sem JWT: `sofia_pode_gerir()` é false → não avançam etapa (mesma limitação documentada dos
  `trg_bloquear_*`; contorno: `disable trigger`, corrigir, reabilitar).

### 3.4 Backfill e dados legados (escrita sobre dado de cliente — só a coluna nova)

O backfill **só preenche colunas novas** (`etapa`, `prazo_indicacao`, `tipo_foto`) e roda **antes** de as triggers novas
existirem, então não reescreve `status`/`autorizacao_status` de ninguém:

- `etapa`: `descontada` se `status = 'descontada'`; senão `autorizado` se `autorizacao_status = 'autorizado'`; senão
  `solicitado` se `'solicitado'`; senão `validada` se `status = 'validada'`; senão `registrada`.
- `prazo_indicacao = data_recebimento + 30` onde houver `data_recebimento`.
- As 2 multas `pendente/autorizado` ficam com etapa `autorizado` e o status antigo preservado; a verificação lista
  quantas linhas têm status/autorização diferente do derivado (esperado hoje: 2) como **AVISO**, não falha. Na primeira
  mudança de etapa, a derivação as corrige.
- Consequência a avisar o Igor: as 33 multas `registrada` com recebimento antigo vão aparecer com "prazo vencido" em
  Pendências até ele avançar as que já foram indicadas fora do sistema (pular etapa é permitido para isso).

### 3.5 RPC `sofia_multa_registrar_etapa(p_multa_id uuid, p_etapa text, p_dados jsonb)`

**security invoker** (a RLS `sofia access` continua valendo; padrão das F1–F3). Guarda `sofia_pode_gerir() is not true`
→ erro; trava a multa (`for update`); para `autorizado` e para a revogação, guarda `sofia_is_admin() is not true` → erro
(redundante com a trigger, de propósito); grava os campos da etapa a partir de `p_dados` (lista fechada por etapa);
insere a linha em `multa_etapas` com `feito_por` = e-mail do JWT, na mesma transação. Devolve a etapa gravada.
EXECUTE revogado de `public`/`anon`.

### 3.6 Fotos imutáveis

- `revoke update, delete, truncate on checklist_fotos, sinistro_fotos from anon, authenticated`.
- Trigger `trg_fotos_imutaveis` (BEFORE UPDATE OR DELETE, função `sofia_fotos_imutaveis`) nas duas tabelas: recusa
  **sempre**, para qualquer role (inclusive a cascata vinda de excluir checklist/sinistro, e `postgres`/`service_role`).
  BEFORE INSERT em `checklist_fotos` confere a avaria do mesmo checklist (`if TG_TABLE_NAME` externo, regra do `sql.md`).
- Storage: sem policy de UPDATE/DELETE nos dois buckets (conferido na seção 0 e na verificação) — o arquivo também não
  pode ser sobrescrito nem apagado por usuário.

### 3.7 Storage restrito ao Sofia

`alter policy` nas 4 policies (`authenticated read/upload checklist`, `authenticated read/upload anexos`) acrescentando
`and (select public.sofia_has_access())`. Nenhum código fora do Sofia usa esses buckets (`grep` em `app/`, `lib/`,
`components/`: só `app/(operacoes)/sofia/**`). Precedente de `alter policy` em `storage.objects` pelo PAT: `perf-rls-initplan`.

### 3.8 `sdd-sql-sofia-multa-avaria.sql` (texto completo)

```sql
-- ============================================================
-- *** NÃO APLICADO *** (escrito em 03/11/2026)
-- Sofia (Gestão de Frotas) — multa por etapa, avaria do checklist,
-- fotos imutáveis, storage restrito ao Sofia.
-- Spec: docs/superpowers/specs/2026-11-03-frotas-multa-fotos-checklist-design.md
-- Projeto iyytcavcgukfjnjjrerx — CONFIRME O REF ANTES DE APLICAR.
-- Depende de sdd-sql-sofia-gestor-frotas.sql (seção 0 aborta sem ele).
-- Território de exceção (autorização, dinheiro, RLS, dado de cliente):
-- revisão independente + autorização escrita do João citando este arquivo.
-- Depois: rodar sdd-sql-sofia-multa-avaria-teste.sql (rollback forçado).
-- SQL ANTES DO DEPLOY DO APP. App antigo depois deste SQL: Descontos/
-- Multas antigos falham ao mudar status direto (por desenho).
-- IDEMPOTENTE: if not exists / create or replace / drop ... if exists.
-- ============================================================

begin;

-- ============================================================
-- 0. PRÉ-REQUISITOS E DERIVA
-- ============================================================
do $$
declare
  v_src text;
begin
  if to_regprocedure('public.sofia_pode_gerir()') is null
     or to_regprocedure('public.sofia_is_admin()') is null
     or to_regprocedure('public.sofia_has_access()') is null then
    raise exception 'sofia_pode_gerir/sofia_is_admin/sofia_has_access ausentes — aplicar sdd-sql-sofia-gestor-frotas.sql antes';
  end if;

  if not exists (
    select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
    where t.tgname = 'trg_bloquear_autorizacao_multas'
      and t.tgrelid = 'public.multas'::regclass
      and t.tgenabled <> 'D'
      and p.proname = 'sofia_bloquear_autorizacao_nao_admin') then
    raise exception 'trg_bloquear_autorizacao_multas ausente ou desabilitado — abortando';
  end if;

  select prosrc into v_src from pg_proc
  where oid = to_regprocedure('public.sofia_bloquear_autorizacao_nao_admin()');
  if position('sofia_pode_gerir() is not true' in v_src) = 0 then
    raise exception 'sofia_bloquear_autorizacao_nao_admin difere do esperado (guarda sofia_pode_gerir) — comparar antes';
  end if;

  if exists (select 1 from public.multas where autorizacao_status is null) then
    raise exception 'multas com autorizacao_status NULL — backfill de etapa não decide; corrigir antes';
  end if;

  if exists (select 1 from public.checklist_fotos
             where posicao is null
                or posicao not in ('Frente','Traseira','Lateral Esq.','Lateral Dir.','Interna')) then
    raise exception 'checklist_fotos com posicao desconhecida — backfill de tipo_foto não decide';
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'multas'
               and column_name = 'etapa' and data_type <> 'text') then
    raise exception 'multas.etapa já existe com outro tipo — abortando';
  end if;

  if to_regclass('public.multa_etapas') is not null
     and (select string_agg(column_name, ',' order by column_name)
          from information_schema.columns
          where table_schema = 'public' and table_name = 'multa_etapas')
         is distinct from 'canal,dados,em_nome_de,etapa,etapa_anterior,feito_em,feito_por,id,multa_id,observacao' then
    raise exception 'multa_etapas já existe com colunas diferentes do arquivo — abortando';
  end if;

  if to_regclass('public.checklist_avarias') is not null
     and (select string_agg(column_name, ',' order by column_name)
          from information_schema.columns
          where table_schema = 'public' and table_name = 'checklist_avarias')
         is distinct from 'acao,avaria_origem_id,checklist_id,created_at,descricao,id,peca,reparada_em,reparada_por,status,tamanho' then
    raise exception 'checklist_avarias já existe com colunas diferentes do arquivo — abortando';
  end if;

  if (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname in ('authenticated read checklist', 'authenticated upload checklist',
                           'authenticated read anexos', 'authenticated upload anexos')) <> 4 then
    raise exception 'policies de storage do Sofia diferentes do esperado (4) — abortando';
  end if;

  if exists (select 1 from pg_policies
             where schemaname = 'storage' and tablename = 'objects'
               and cmd in ('UPDATE', 'DELETE', 'ALL')
               and coalesce(qual, '') || coalesce(with_check, '') ~ '(checklist-fotos|sofia-anexos)') then
    raise exception 'existe policy UPDATE/DELETE/ALL nos buckets do Sofia — fotos não seriam imutáveis; abortando';
  end if;
end;
$$;

-- ============================================================
-- 1. MULTAS: colunas novas (sem default em etapa até o backfill)
-- ============================================================
alter table public.multas
  add column if not exists etapa text,
  add column if not exists locadora text,
  add column if not exists auto_infracao text,
  add column if not exists orgao_autuador text,
  add column if not exists pontos integer,
  add column if not exists prazo_indicacao date,
  add column if not exists motorista_condutor_id uuid references public.motoristas(id),
  add column if not exists indicado_em date,
  add column if not exists protocolo_indicacao text,
  add column if not exists boleto_lancado_em date,
  add column if not exists pago_em_dobro boolean not null default false,
  add column if not exists responsavel_dobro text,
  add column if not exists desconto_competencia date;

-- Backfill só das colunas novas, ANTES da trigger nova existir.
-- (trg_bloquear_autorizacao_multas não barra: status/autorização/valor não mudam.)
update public.multas set etapa = case
    when status = 'descontada' then 'descontada'
    when autorizacao_status = 'autorizado' then 'autorizado'
    when autorizacao_status = 'solicitado' then 'solicitado'
    when status = 'validada' then 'validada'
    else 'registrada'
  end
where etapa is null;

update public.multas set prazo_indicacao = data_recebimento + 30
where prazo_indicacao is null and data_recebimento is not null;

alter table public.multas alter column etapa set default 'registrada';
alter table public.multas alter column etapa set not null;

alter table public.multas drop constraint if exists multas_etapa_check;
alter table public.multas add constraint multas_etapa_check check (etapa in
  ('registrada','condutor','termo','indicado','validada','contestada','cobrada','solicitado','autorizado','descontada'));
alter table public.multas drop constraint if exists multas_pontos_check;
alter table public.multas add constraint multas_pontos_check check (pontos is null or pontos >= 0);
alter table public.multas drop constraint if exists multas_dobro_coerente;
alter table public.multas add constraint multas_dobro_coerente check (
  (pago_em_dobro and responsavel_dobro in ('empresa','motorista'))
  or (not pago_em_dobro and responsavel_dobro is null));
alter table public.multas drop constraint if exists multas_competencia_dia1;
alter table public.multas add constraint multas_competencia_dia1 check (
  desconto_competencia is null or extract(day from desconto_competencia) = 1);

-- ============================================================
-- 2. FUNÇÕES PURAS DA ETAPA
-- ============================================================
create or replace function public.sofia_multa_etapa_ordem(p text)
returns int language sql immutable set search_path = pg_catalog as $$
  select case p
    when 'registrada' then 0 when 'condutor' then 1 when 'termo' then 2 when 'indicado' then 3
    when 'validada' then 4 when 'contestada' then 4 when 'cobrada' then 5 when 'solicitado' then 6
    when 'autorizado' then 7 when 'descontada' then 8 end
$$;

create or replace function public.sofia_multa_status_da_etapa(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case
    when p in ('registrada','condutor','termo','indicado','contestada') then 'pendente'
    when p = 'descontada' then 'descontada'
    else 'validada' end
$$;

create or replace function public.sofia_multa_autorizacao_da_etapa(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select case
    when p = 'solicitado' then 'solicitado'
    when p in ('autorizado','descontada') then 'autorizado'
    else 'sem_solicitacao' end
$$;

-- ============================================================
-- 3. TRIGGER DA ETAPA (autorização + dinheiro)
-- ============================================================
create or replace function public.sofia_multas_etapa_guarda()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gerir boolean := public.sofia_pode_gerir();
  v_admin boolean := public.sofia_is_admin();
  v_old int;
  v_new int;
begin
  if TG_OP = 'INSERT' then
    if new.etapa is distinct from 'registrada' then
      raise exception 'Multa nova sempre começa na etapa "registrada"';
    end if;
    if new.status is distinct from 'pendente'
       or new.autorizacao_status is distinct from 'sem_solicitacao' then
      raise exception 'Status e autorização da multa são derivados da etapa';
    end if;
    if new.motorista_condutor_id is not null or new.indicado_em is not null
       or new.protocolo_indicacao is not null or new.boleto_lancado_em is not null
       or new.pago_em_dobro is distinct from false or new.responsavel_dobro is not null
       or new.desconto_competencia is not null or new.valor_descontado is not null
       or new.tipo_desconto is distinct from 'nenhum'
       or new.autorizacao_solicitado_em is not null then
      raise exception 'Multa nova não pode nascer com dados de etapas posteriores';
    end if;
    return new;
  end if;

  -- ---------- UPDATE sem mudar a etapa ----------
  if new.etapa is not distinct from old.etapa then
    if new.status is distinct from old.status
       or new.autorizacao_status is distinct from old.autorizacao_status then
      raise exception 'Status e autorização da multa são derivados da etapa: registre a etapa';
    end if;
    if new.valor_descontado is distinct from old.valor_descontado
       or new.tipo_desconto is distinct from old.tipo_desconto
       or new.desconto_competencia is distinct from old.desconto_competencia then
      raise exception 'O desconto só muda ao registrar ou desfazer o desconto';
    end if;
    if (new.prazo_indicacao, new.motorista_condutor_id, new.motorista_id, new.indicado_em,
        new.protocolo_indicacao, new.boleto_lancado_em, new.pago_em_dobro, new.responsavel_dobro,
        new.autorizacao_storage_path, new.autorizacao_assinada, new.autorizacao_solicitado_em)
       is distinct from
       (old.prazo_indicacao, old.motorista_condutor_id, old.motorista_id, old.indicado_em,
        old.protocolo_indicacao, old.boleto_lancado_em, old.pago_em_dobro, old.responsavel_dobro,
        old.autorizacao_storage_path, old.autorizacao_assinada, old.autorizacao_solicitado_em)
       and v_gerir is not true then
      raise exception 'Apenas administradores ou gestores de frotas podem alterar o processo da multa';
    end if;
    return new;
  end if;

  -- ---------- UPDATE mudando a etapa ----------
  if v_gerir is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem avançar a etapa da multa';
  end if;

  v_old := public.sofia_multa_etapa_ordem(old.etapa);
  v_new := public.sofia_multa_etapa_ordem(new.etapa);

  if new.etapa = 'autorizado' and old.etapa = 'solicitado' then
    if v_admin is not true then
      raise exception 'Só o administrador autoriza desconto de multa';
    end if;
  elsif new.etapa = 'solicitado' and old.etapa = 'autorizado' then
    if v_admin is not true then
      raise exception 'Só o administrador revoga a autorização de desconto';
    end if;
  elsif new.etapa = 'autorizado' and old.etapa = 'descontada' then
    if new.valor_descontado is not null or new.desconto_competencia is not null
       or new.tipo_desconto is distinct from 'nenhum' then
      raise exception 'Ao desfazer o desconto, valor, tipo e competência voltam a vazio';
    end if;
  elsif new.etapa = 'autorizado' then
    raise exception 'Desconto só pode ser autorizado depois de solicitado';
  elsif new.etapa = 'descontada' then
    if old.etapa is distinct from 'autorizado' then
      raise exception 'Desconto só pode ser registrado depois de autorizado pelo administrador';
    end if;
    if new.valor_descontado is null or new.valor_descontado < 0 or new.valor_descontado > new.valor then
      raise exception 'Valor descontado inválido (entre 0 e o valor da multa)';
    end if;
    if new.tipo_desconto not in ('total','parcial') or new.desconto_competencia is null then
      raise exception 'Informe o tipo de desconto e a competência';
    end if;
  elsif new.etapa = 'cobrada' and old.etapa = 'solicitado' then
    null; -- cancelar solicitação
  elsif new.etapa = 'contestada' then
    if old.etapa not in ('registrada','condutor','termo','indicado') then
      raise exception 'A multa só pode ser contestada antes da validação';
    end if;
  elsif old.etapa in ('contestada','autorizado','descontada') then
    raise exception 'Transição de etapa não permitida: % → %', old.etapa, new.etapa;
  elsif v_new is null or v_old is null or v_new <= v_old then
    raise exception 'A etapa da multa só avança: % → % não é permitido', old.etapa, new.etapa;
  end if;

  -- o trio do desconto só muda entrando ou saindo de "descontada"
  if new.etapa <> 'descontada' and old.etapa <> 'descontada'
     and (new.valor_descontado is distinct from old.valor_descontado
          or new.tipo_desconto is distinct from old.tipo_desconto
          or new.desconto_competencia is distinct from old.desconto_competencia) then
    raise exception 'O desconto só muda ao registrar ou desfazer o desconto';
  end if;

  new.status := public.sofia_multa_status_da_etapa(new.etapa);
  new.autorizacao_status := public.sofia_multa_autorizacao_da_etapa(new.etapa);
  return new;
end;
$$;

drop trigger if exists trg_multas_etapa on public.multas;
create trigger trg_multas_etapa
  before insert or update on public.multas
  for each row execute function public.sofia_multas_etapa_guarda();

-- ============================================================
-- 4. multa_etapas (só inserção)
-- ============================================================
create table if not exists public.multa_etapas (
  id uuid primary key default gen_random_uuid(),
  multa_id uuid not null references public.multas(id) on delete cascade,
  etapa text not null constraint multa_etapas_etapa_check check (etapa in
    ('registrada','condutor','termo','indicado','validada','contestada','cobrada','solicitado','autorizado','descontada')),
  etapa_anterior text,
  feito_em timestamptz not null default now(),
  feito_por text not null constraint multa_etapas_feito_por_normalizado
    check (feito_por = lower(trim(feito_por)) and feito_por <> ''),
  em_nome_de text,
  canal text constraint multa_etapas_canal_check
    check (canal is null or canal in ('email','whatsapp','telefone','presencial')),
  observacao text,
  dados jsonb not null default '{}'::jsonb
);
create index if not exists multa_etapas_multa_idx on public.multa_etapas (multa_id, feito_em);

alter table public.multa_etapas enable row level security;
drop policy if exists multa_etapas_ler on public.multa_etapas;
create policy multa_etapas_ler on public.multa_etapas
  for select to authenticated using ((select public.sofia_has_access()));
drop policy if exists multa_etapas_gravar on public.multa_etapas;
create policy multa_etapas_gravar on public.multa_etapas
  for insert to authenticated
  with check ((select public.sofia_pode_gerir())
              and feito_por = lower(trim((select auth.jwt()) ->> 'email')));
revoke all on public.multa_etapas from anon;
revoke update, delete, truncate on public.multa_etapas from authenticated;

-- ============================================================
-- 5. RPC sofia_multa_registrar_etapa (security INVOKER)
-- ============================================================
create or replace function public.sofia_multa_registrar_etapa(
  p_multa_id uuid, p_etapa text, p_dados jsonb default '{}'::jsonb)
returns text
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_m       public.multas%rowtype;
  v_email   text := lower(trim(auth.jwt() ->> 'email'));
  v_em_nome text := nullif(trim(coalesce(p_dados ->> 'em_nome_de', '')), '');
  v_canal   text := nullif(trim(coalesce(p_dados ->> 'canal', '')), '');
  v_obs     text := nullif(trim(coalesce(p_dados ->> 'observacao', '')), '');
  v_dados   jsonb := coalesce(p_dados, '{}'::jsonb);
  v_path    text;
begin
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem registrar etapas de multa';
  end if;
  if v_email is null or v_email = '' then
    raise exception 'Sessão sem e-mail';
  end if;

  select * into v_m from public.multas where id = p_multa_id for update;
  if not found then
    raise exception 'Multa não encontrada';
  end if;

  if (p_etapa = 'autorizado' and v_m.etapa = 'solicitado')
     or (p_etapa = 'solicitado' and v_m.etapa = 'autorizado') then
    if public.sofia_is_admin() is not true then
      raise exception 'Só o administrador autoriza ou revoga desconto de multa';
    end if;
  end if;

  case p_etapa
    when 'condutor' then
      if nullif(v_dados ->> 'motorista_id', '') is null then
        raise exception 'Informe o condutor';
      end if;
      v_dados := v_dados || jsonb_build_object('motorista_anterior', v_m.motorista_id);
      update public.multas
         set etapa = 'condutor',
             motorista_condutor_id = (v_dados ->> 'motorista_id')::uuid,
             motorista_id = (v_dados ->> 'motorista_id')::uuid
       where id = p_multa_id;
    when 'termo' then
      v_path := nullif(v_dados ->> 'storage_path', '');
      if v_path is null or v_path not like 'multas/' || p_multa_id::text || '/%' then
        raise exception 'Anexe o termo assinado';
      end if;
      update public.multas
         set etapa = 'termo', autorizacao_storage_path = v_path, autorizacao_assinada = true
       where id = p_multa_id;
    when 'indicado' then
      if nullif(v_dados ->> 'indicado_em', '') is null then
        raise exception 'Informe a data da indicação';
      end if;
      update public.multas
         set etapa = 'indicado',
             indicado_em = (v_dados ->> 'indicado_em')::date,
             protocolo_indicacao = nullif(trim(coalesce(v_dados ->> 'protocolo', '')), '')
       where id = p_multa_id;
    when 'validada' then
      if v_em_nome is null or v_canal is null then
        raise exception 'Informe em nome de quem e por qual canal';
      end if;
      update public.multas set etapa = 'validada' where id = p_multa_id;
    when 'contestada' then
      if v_em_nome is null or v_canal is null or v_obs is null then
        raise exception 'Informe em nome de quem, o canal e o motivo da contestação';
      end if;
      update public.multas set etapa = 'contestada' where id = p_multa_id;
    when 'cobrada' then
      if v_m.etapa = 'solicitado' then
        update public.multas set etapa = 'cobrada', autorizacao_solicitado_em = null where id = p_multa_id;
      else
        if nullif(v_dados ->> 'boleto_lancado_em', '') is null then
          raise exception 'Informe a data em que o boleto foi lançado';
        end if;
        update public.multas
           set etapa = 'cobrada', boleto_lancado_em = (v_dados ->> 'boleto_lancado_em')::date
         where id = p_multa_id;
      end if;
    when 'solicitado' then
      update public.multas
         set etapa = 'solicitado',
             autorizacao_solicitado_em = case when v_m.etapa = 'autorizado'
                                              then v_m.autorizacao_solicitado_em else now() end
       where id = p_multa_id;
    when 'autorizado' then
      if v_m.etapa = 'descontada' then
        update public.multas
           set etapa = 'autorizado', valor_descontado = null, tipo_desconto = 'nenhum',
               desconto_competencia = null
         where id = p_multa_id;
      else
        update public.multas set etapa = 'autorizado' where id = p_multa_id;
      end if;
    when 'descontada' then
      if nullif(v_dados ->> 'valor_descontado', '') is null
         or nullif(v_dados ->> 'tipo_desconto', '') is null
         or nullif(v_dados ->> 'competencia', '') is null then
        raise exception 'Informe valor, tipo de desconto e competência';
      end if;
      update public.multas
         set etapa = 'descontada',
             valor_descontado = (v_dados ->> 'valor_descontado')::numeric,
             tipo_desconto = v_dados ->> 'tipo_desconto',
             desconto_competencia = date_trunc('month', (v_dados ->> 'competencia')::date)::date
       where id = p_multa_id;
    else
      raise exception 'Etapa desconhecida: %', p_etapa;
  end case;

  insert into public.multa_etapas (multa_id, etapa, etapa_anterior, feito_por, em_nome_de, canal, observacao, dados)
  values (p_multa_id, p_etapa, v_m.etapa, v_email, v_em_nome, v_canal, v_obs, v_dados);

  return p_etapa;
end;
$$;

revoke all on function public.sofia_multa_registrar_etapa(uuid, text, jsonb) from public, anon;
grant execute on function public.sofia_multa_registrar_etapa(uuid, text, jsonb) to authenticated;

-- ============================================================
-- 6. checklist_avarias
-- ============================================================
create table if not exists public.checklist_avarias (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklist(id),
  peca text not null constraint checklist_avarias_peca_nao_vazia check (btrim(peca) <> ''),
  tamanho text not null constraint checklist_avarias_tamanho_check check (tamanho in ('pequena','media','grande')),
  acao text constraint checklist_avarias_acao_check check (acao is null or acao in ('reparo','troca')),
  descricao text,
  status text not null default 'aberta' constraint checklist_avarias_status_check check (status in ('aberta','reparada')),
  reparada_em timestamptz,
  reparada_por text,
  avaria_origem_id uuid references public.checklist_avarias(id),
  created_at timestamptz not null default now(),
  constraint checklist_avarias_reparo_coerente check (
    (status = 'aberta' and reparada_em is null and reparada_por is null)
    or (status = 'reparada' and reparada_em is not null and reparada_por is not null))
);
create index if not exists checklist_avarias_checklist_idx on public.checklist_avarias (checklist_id);

alter table public.checklist_avarias enable row level security;
drop policy if exists checklist_avarias_ler on public.checklist_avarias;
create policy checklist_avarias_ler on public.checklist_avarias
  for select to authenticated using ((select public.sofia_has_access()));
drop policy if exists checklist_avarias_inserir on public.checklist_avarias;
create policy checklist_avarias_inserir on public.checklist_avarias
  for insert to authenticated with check ((select public.sofia_has_access()));
drop policy if exists checklist_avarias_baixa on public.checklist_avarias;
create policy checklist_avarias_baixa on public.checklist_avarias
  for update to authenticated
  using ((select public.sofia_pode_gerir())) with check ((select public.sofia_pode_gerir()));
revoke all on public.checklist_avarias from anon;
revoke delete, truncate on public.checklist_avarias from authenticated;

create or replace function public.sofia_checklist_avarias_guarda()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'Avaria registrada não pode ser apagada';
  end if;
  if TG_OP = 'INSERT' then
    if new.status is distinct from 'aberta' then
      raise exception 'Avaria nova sempre nasce aberta';
    end if;
    return new;
  end if;
  -- UPDATE
  if public.sofia_pode_gerir() is not true then
    raise exception 'Apenas administradores ou gestores de frotas podem alterar uma avaria';
  end if;
  if (new.checklist_id, new.peca, new.tamanho, new.descricao, new.avaria_origem_id, new.created_at)
     is distinct from
     (old.checklist_id, old.peca, old.tamanho, old.descricao, old.avaria_origem_id, old.created_at) then
    raise exception 'Da avaria só mudam reparo/troca e a baixa';
  end if;
  if old.status = 'reparada' and new.status is distinct from 'reparada' then
    raise exception 'Avaria reparada não volta a aberta';
  end if;
  if old.status = 'aberta' and new.status = 'reparada' then
    new.reparada_por := lower(trim(auth.jwt() ->> 'email'));
    new.reparada_em := coalesce(new.reparada_em, now());
    if new.reparada_por is null or new.reparada_por = '' then
      raise exception 'Sessão sem e-mail';
    end if;
    if new.reparada_em > now() then
      raise exception 'Data do reparo no futuro';
    end if;
  elsif new.reparada_em is distinct from old.reparada_em
        or new.reparada_por is distinct from old.reparada_por then
    raise exception 'Baixa da avaria não pode ser alterada';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_checklist_avarias_guarda on public.checklist_avarias;
create trigger trg_checklist_avarias_guarda
  before insert or update or delete on public.checklist_avarias
  for each row execute function public.sofia_checklist_avarias_guarda();

-- ============================================================
-- 7. checklist_fotos: avaria_id + tipo_foto (backfill ANTES da trigger)
-- ============================================================
alter table public.checklist_fotos
  add column if not exists avaria_id uuid references public.checklist_avarias(id),
  add column if not exists tipo_foto text;

update public.checklist_fotos
   set tipo_foto = case when posicao = 'Interna' then 'interna' else 'obrigatoria' end
 where tipo_foto is null;

alter table public.checklist_fotos alter column tipo_foto set default 'obrigatoria';
alter table public.checklist_fotos alter column tipo_foto set not null;
alter table public.checklist_fotos drop constraint if exists checklist_fotos_tipo_check;
alter table public.checklist_fotos add constraint checklist_fotos_tipo_check
  check (tipo_foto in ('obrigatoria','interna','extra','avaria_peca','avaria_dano'));
alter table public.checklist_fotos drop constraint if exists checklist_fotos_avaria_coerente;
alter table public.checklist_fotos add constraint checklist_fotos_avaria_coerente
  check ((tipo_foto in ('avaria_peca','avaria_dano')) = (avaria_id is not null));

create index if not exists checklist_veiculo_data_idx on public.checklist (veiculo_id, data desc);

-- ============================================================
-- 8. FOTOS IMUTÁVEIS (qualquer role, inclusive cascata)
-- ============================================================
create or replace function public.sofia_fotos_imutaveis()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if TG_OP in ('UPDATE', 'DELETE') then
    raise exception 'Foto salva é prova e não pode ser alterada nem apagada';
  end if;
  -- INSERT
  if TG_TABLE_NAME = 'checklist_fotos' then
    if new.avaria_id is not null then
      if not exists (select 1 from public.checklist_avarias a
                     where a.id = new.avaria_id and a.checklist_id = new.checklist_id) then
        raise exception 'A avaria da foto não pertence a este checklist';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fotos_imutaveis on public.checklist_fotos;
create trigger trg_fotos_imutaveis
  before insert or update or delete on public.checklist_fotos
  for each row execute function public.sofia_fotos_imutaveis();
drop trigger if exists trg_fotos_imutaveis on public.sinistro_fotos;
create trigger trg_fotos_imutaveis
  before update or delete on public.sinistro_fotos
  for each row execute function public.sofia_fotos_imutaveis();

revoke update, delete, truncate on public.checklist_fotos from anon, authenticated;
revoke update, delete, truncate on public.sinistro_fotos from anon, authenticated;

-- ============================================================
-- 9. STORAGE: leitura e upload só para quem tem o Sofia
-- ============================================================
alter policy "authenticated read checklist" on storage.objects
  using (bucket_id = 'checklist-fotos' and (select public.sofia_has_access()));
alter policy "authenticated upload checklist" on storage.objects
  with check (bucket_id = 'checklist-fotos' and (select public.sofia_has_access()));
alter policy "authenticated read anexos" on storage.objects
  using (bucket_id = 'sofia-anexos' and (select public.sofia_has_access()));
alter policy "authenticated upload anexos" on storage.objects
  with check (bucket_id = 'sofia-anexos' and (select public.sofia_has_access()));

commit;

-- ============================================================
-- VERIFICAÇÃO (rodar depois do commit; qualquer FALHOU = parar, não deployar)
-- ============================================================
select * from (values
  ('v01 multas.etapa not null + default registrada',
   (select case when is_nullable = 'NO' and column_default like '%registrada%' then 'OK' else '*** FALHOU ***' end
      from information_schema.columns where table_schema='public' and table_name='multas' and column_name='etapa')),
  ('v02 13 colunas novas em multas',
   (select case when count(*) = 13 then 'OK' else '*** FALHOU *** ' || count(*) end
      from information_schema.columns where table_schema='public' and table_name='multas'
       and column_name in ('etapa','locadora','auto_infracao','orgao_autuador','pontos','prazo_indicacao',
         'motorista_condutor_id','indicado_em','protocolo_indicacao','boleto_lancado_em','pago_em_dobro',
         'responsavel_dobro','desconto_competencia'))),
  ('v03 nenhuma multa sem etapa',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU *** ' || count(*) end from public.multas where etapa is null)),
  ('v04 AVISO legado: status/autorização ≠ derivado (esperado 2 em 03/11)',
   (select 'AVISO ' || count(*) from public.multas
     where status is distinct from public.sofia_multa_status_da_etapa(etapa)
        or autorizacao_status is distinct from public.sofia_multa_autorizacao_da_etapa(etapa))),
  ('v05 trg_multas_etapa habilitado e ligado',
   (select case when count(*) = 1 then 'OK' else '*** FALHOU ***' end from pg_trigger t join pg_proc p on p.oid=t.tgfoid
     where t.tgname='trg_multas_etapa' and t.tgrelid='public.multas'::regclass and t.tgenabled <> 'D'
       and p.proname='sofia_multas_etapa_guarda')),
  ('v06 trg_bloquear_autorizacao_multas intacto e habilitado',
   (select case when count(*) = 1 then 'OK' else '*** FALHOU ***' end from pg_trigger
     where tgname='trg_bloquear_autorizacao_multas' and tgrelid='public.multas'::regclass and tgenabled <> 'D')),
  ('v07 guarda da trigger usa is not true (nunca "if not")',
   (select case when prosrc like '%v_gerir is not true%' and prosrc like '%v_admin is not true%'
                 and prosrc not like '%if not v_%' then 'OK' else '*** FALHOU ***' end
      from pg_proc where oid = to_regprocedure('public.sofia_multas_etapa_guarda()'))),
  ('v08 RPC security invoker + guardas is not true',
   (select case when not prosecdef and prosrc like '%sofia_pode_gerir() is not true%'
                 and prosrc like '%sofia_is_admin() is not true%' then 'OK' else '*** FALHOU ***' end
      from pg_proc where oid = to_regprocedure('public.sofia_multa_registrar_etapa(uuid,text,jsonb)'))),
  ('v09 RPC sem execute para anon',
   (select case when not has_function_privilege('anon','public.sofia_multa_registrar_etapa(uuid,text,jsonb)','execute')
                 and has_function_privilege('authenticated','public.sofia_multa_registrar_etapa(uuid,text,jsonb)','execute')
            then 'OK' else '*** FALHOU ***' end)),
  ('v10 multa_etapas: RLS on, 2 policies (select/insert)',
   (select case when (select relrowsecurity from pg_class where oid='public.multa_etapas'::regclass)
                 and count(*) = 2 and bool_and(cmd in ('SELECT','INSERT')) then 'OK' else '*** FALHOU ***' end
      from pg_policies where schemaname='public' and tablename='multa_etapas')),
  ('v11 multa_etapas sem UPDATE/DELETE para authenticated e nada para anon',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU *** ' || string_agg(grantee||':'||privilege_type, ',') end
      from information_schema.role_table_grants where table_schema='public' and table_name='multa_etapas'
       and ((grantee='authenticated' and privilege_type in ('UPDATE','DELETE','TRUNCATE')) or grantee='anon'))),
  ('v12 checklist_avarias: RLS on, 3 policies, trigger habilitado',
   (select case when (select relrowsecurity from pg_class where oid='public.checklist_avarias'::regclass)
                 and (select count(*) from pg_policies where schemaname='public' and tablename='checklist_avarias') = 3
                 and exists (select 1 from pg_trigger where tgname='trg_checklist_avarias_guarda'
                             and tgrelid='public.checklist_avarias'::regclass and tgenabled <> 'D')
            then 'OK' else '*** FALHOU ***' end)),
  ('v13 checklist_avarias sem DELETE para authenticated e nada para anon',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU ***' end
      from information_schema.role_table_grants where table_schema='public' and table_name='checklist_avarias'
       and ((grantee='authenticated' and privilege_type in ('DELETE','TRUNCATE')) or grantee='anon'))),
  ('v14 checklist_fotos.tipo_foto preenchido (backfill)',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU ***' end from public.checklist_fotos where tipo_foto is null)),
  ('v15 trg_fotos_imutaveis nas 2 tabelas, habilitado',
   (select case when count(*) = 2 then 'OK' else '*** FALHOU *** ' || count(*) end from pg_trigger
     where tgname='trg_fotos_imutaveis' and tgenabled <> 'D'
       and tgrelid in ('public.checklist_fotos'::regclass, 'public.sinistro_fotos'::regclass))),
  ('v16 fotos sem UPDATE/DELETE para anon/authenticated',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU *** ' || string_agg(table_name||'.'||grantee||':'||privilege_type, ',') end
      from information_schema.role_table_grants where table_schema='public'
       and table_name in ('checklist_fotos','sinistro_fotos') and grantee in ('anon','authenticated')
       and privilege_type in ('UPDATE','DELETE','TRUNCATE'))),
  ('v17 storage: 4 policies do Sofia exigem sofia_has_access',
   (select case when count(*) = 4 then 'OK' else '*** FALHOU *** ' || count(*) end from pg_policies
     where schemaname='storage' and tablename='objects'
       and policyname in ('authenticated read checklist','authenticated upload checklist',
                          'authenticated read anexos','authenticated upload anexos')
       and coalesce(qual,'') || coalesce(with_check,'') like '%sofia_has_access%')),
  ('v18 storage: nenhuma policy UPDATE/DELETE/ALL nos buckets do Sofia',
   (select case when count(*) = 0 then 'OK' else '*** FALHOU ***' end from pg_policies
     where schemaname='storage' and tablename='objects' and cmd in ('UPDATE','DELETE','ALL')
       and coalesce(qual,'') || coalesce(with_check,'') ~ '(checklist-fotos|sofia-anexos)')),
  ('v19 índice checklist (veiculo_id, data desc)',
   (select case when count(*) = 1 then 'OK' else '*** FALHOU ***' end from pg_indexes
     where schemaname='public' and indexname='checklist_veiculo_data_idx')),
  ('v20 policies sofia access das 5 tabelas inalteradas',
   (select case when count(*) = 5 then 'OK' else '*** FALHOU *** ' || count(*) end from pg_policies
     where schemaname='public' and policyname='sofia access'
       and tablename in ('multas','checklist','checklist_fotos','sinistros','sinistro_fotos')))
) as v(invariante, resultado);
-- Esperado: 19 linhas OK + v04 "AVISO 2" (ou o número medido na hora — anotar).

-- ============================================================
-- ROLLBACK (só depois de reverter o app; NÃO apaga dado de multa)
-- ============================================================
-- begin;
-- alter policy "authenticated read checklist"   on storage.objects using (bucket_id = 'checklist-fotos');
-- alter policy "authenticated upload checklist" on storage.objects with check (bucket_id = 'checklist-fotos');
-- alter policy "authenticated read anexos"      on storage.objects using (bucket_id = 'sofia-anexos');
-- alter policy "authenticated upload anexos"    on storage.objects with check (bucket_id = 'sofia-anexos');
-- drop trigger if exists trg_fotos_imutaveis on public.checklist_fotos;
-- drop trigger if exists trg_fotos_imutaveis on public.sinistro_fotos;
-- drop function if exists public.sofia_fotos_imutaveis();
-- grant update, delete on public.checklist_fotos, public.sinistro_fotos to authenticated;
-- drop trigger if exists trg_multas_etapa on public.multas;
-- drop function if exists public.sofia_multas_etapa_guarda();
-- drop function if exists public.sofia_multa_registrar_etapa(uuid, text, jsonb);
-- -- colunas, multa_etapas e checklist_avarias FICAM (guardam o que foi registrado); dropar só com export antes.
-- commit;
```

### 3.9 `sdd-sql-sofia-multa-avaria-teste.sql` (texto completo)

Mesmo padrão de `sdd-sql-sofia-gestor-frotas-teste.sql`: JWT forjado, um `do` que **termina em erro de propósito**
(relatório + rollback garantido). Casos "barrado" só contam como OK se o erro for `P0001` (raise) ou `42501`
(privilégio/RLS) — erro de outra natureza (coluna errada, cast) conta como FALHOU, para o teste não passar por acidente.

```sql
-- ============================================================
-- *** NÃO APLICADO / NUNCA RODOU *** (escrito em 03/11/2026)
-- Sofia — multa por etapa, avaria, fotos imutáveis, storage: TESTE DE COMPORTAMENTO
-- Rodar DEPOIS de sdd-sql-sofia-multa-avaria.sql, como postgres, projeto iyytcavcgukfjnjjrerx.
-- TERMINA EM ERRO DE PROPÓSITO (o raise final é o relatório e o rollback).
-- Esperado: "RESUMO: 42/42 OK".
-- Fixture que falhar por coluna NOT NULL não prevista = deriva de schema:
-- ajustar a fixture, nunca o teste.
-- ============================================================

begin;

do $$
declare
  uid_g constant uuid := '00000000-0000-4000-a000-0000000000b1';
  uid_u constant uuid := '00000000-0000-4000-a000-0000000000b2';
  uid_a constant uuid := '00000000-0000-4000-a000-0000000000b3';
  uid_n constant uuid := '00000000-0000-4000-a000-0000000000b4';
  mail_g constant text := '__teste_ma_gestor@manfac.com.br';
  mail_u constant text := '__teste_ma_comum@manfac.com.br';
  mail_a constant text := '__teste_ma_admin@manfac.com.br';
  mail_n constant text := '__teste_ma_semsofia@manfac.com.br';
  e1  uuid := gen_random_uuid();
  v1  uuid := gen_random_uuid();
  mo1 uuid := gen_random_uuid();
  m1  uuid := gen_random_uuid();   -- percorre o fluxo inteiro
  m2  uuid := gen_random_uuid();   -- tentativas de U; deve ficar intacta
  m3  uuid := gen_random_uuid();   -- revogação
  c1  uuid := gen_random_uuid();   -- checklist com foto e avaria
  c2  uuid := gen_random_uuid();   -- outro checklist (avaria de outro checklist)
  f1  uuid := gen_random_uuid();
  av1 uuid := gen_random_uuid();
  av2 uuid := gen_random_uuid();
  av3 uuid := gen_random_uuid();   -- avaria criada por U
  s1  uuid := gen_random_uuid();
  sf1 uuid := gen_random_uuid();
  r   text[] := '{}';
  n_ok int := 0;
  n_total int := 0;
  v_txt text;
  v_txt2 text;
  v_int int;
begin
  -- ---------- FIXTURES (postgres) ----------
  insert into auth.users (id, email, aud, role) values
    (uid_g, mail_g, 'authenticated', 'authenticated'),
    (uid_u, mail_u, 'authenticated', 'authenticated'),
    (uid_a, mail_a, 'authenticated', 'authenticated'),
    (uid_n, mail_n, 'authenticated', 'authenticated');
  insert into public.hub_user_roles (user_email, nivel, granted_by) values
    (mail_g, 'analista', 'teste-ma'), (mail_u, 'analista', 'teste-ma'),
    (mail_a, 'administrador', 'teste-ma'), (mail_n, 'analista', 'teste-ma');
  insert into public.hub_system_access (user_email, system_slug, has_access, granted_by) values
    (mail_g, 'sofia', true, 'teste-ma'), (mail_u, 'sofia', true, 'teste-ma');
  insert into public.sofia_gestores (user_email, granted_by) values (mail_g, 'teste-ma');

  insert into public.equipes (id, codigo, ativo) values (e1, '__teste_ma_e1', true);
  insert into public.veiculos (id, placa, modelo, km_atual, valor_locacao_mensal, equipe_id)
    values (v1, '__TMA01', 'teste', 1000, 1000, e1);
  insert into public.motoristas (id, nome, equipe_id) values (mo1, '__teste_ma_motorista', e1);
  insert into public.multas (id, veiculo_id, data, data_recebimento, descricao, valor) values
    (m1, v1, current_date - 10, current_date - 5, 'teste-ma', 100),
    (m2, v1, current_date - 10, current_date - 5, 'teste-ma', 100),
    (m3, v1, current_date - 10, current_date - 5, 'teste-ma', 100);
  insert into public.checklist (id, tipo, veiculo_id) values (c1, 'retorno', v1), (c2, 'retorno', v1);
  insert into public.checklist_avarias (id, checklist_id, peca, tamanho) values
    (av1, c1, 'Porta direita', 'media'), (av2, c2, 'Retrovisor', 'pequena');
  insert into public.checklist_fotos (id, checklist_id, storage_path, posicao, tipo_foto) values
    (f1, c1, '__teste_ma/c1/Frente.jpg', 'Frente', 'obrigatoria');
  insert into public.sinistros (id, veiculo_id, data, descricao) values (s1, v1, current_date, 'teste-ma');
  insert into public.sinistro_fotos (id, sinistro_id, storage_path) values (sf1, s1, '__teste_ma/s1/dano.jpg');
  insert into storage.objects (bucket_id, name) values ('checklist-fotos', '__teste_ma/c1/Frente.jpg');

  -- (p1) postgres sem JWT não avança etapa
  n_total := n_total + 1;
  begin
    update public.multas set etapa = 'condutor' where id = m2;
    r := r || '(p1) postgres sem JWT avançando etapa: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(p1) postgres sem JWT avançando etapa: OK (barrado)'::text;
    else r := r || ('(p1) *** FALHOU *** erro inesperado: ' || sqlerrm)::text; end if;
  end;

  -- (p2) postgres apaga foto direto: barrado pela trigger (qualquer role)
  n_total := n_total + 1;
  begin
    delete from public.checklist_fotos where id = f1;
    r := r || '(p2) postgres apagando foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(p2) postgres apagando foto: OK (barrado)'::text;
    else r := r || ('(p2) *** FALHOU *** erro inesperado: ' || sqlerrm)::text; end if;
  end;

  -- ================= USUÁRIO COMUM (U) =================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_u, 'email', mail_u, 'role', 'authenticated')::text, true);

  -- (u1) U registra multa nova (etapa registrada) com prazo
  n_total := n_total + 1;
  begin
    insert into public.multas (veiculo_id, data, data_recebimento, prazo_indicacao, descricao, valor, locadora)
    values (v1, current_date, current_date, current_date + 30, 'teste-ma-u1', 50, 'Maestro');
    n_ok := n_ok + 1; r := r || '(u1) U registra multa: OK'::text;
  exception when others then r := r || ('(u1) U registra multa: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (u2) U insere multa já em etapa posterior
  n_total := n_total + 1;
  begin
    insert into public.multas (veiculo_id, data, descricao, valor, etapa) values (v1, current_date, 'teste-ma-u2', 50, 'indicado');
    r := r || '(u2) U insere multa indicada: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u2) U insere multa indicada: OK (barrado)'::text;
    else r := r || ('(u2) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u3) U avança etapa por UPDATE
  n_total := n_total + 1;
  begin
    update public.multas set etapa = 'condutor' where id = m2;
    r := r || '(u3) U avança etapa: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u3) U avança etapa: OK (barrado)'::text;
    else r := r || ('(u3) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u4) U avança etapa pela RPC
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m2, 'solicitado', '{}'::jsonb);
    r := r || '(u4) U pela RPC: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u4) U pela RPC: OK (barrado)'::text;
    else r := r || ('(u4) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u5) U muda status direto
  n_total := n_total + 1;
  begin
    update public.multas set status = 'validada' where id = m2;
    r := r || '(u5) U muda status direto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u5) U muda status direto: OK (barrado)'::text;
    else r := r || ('(u5) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u6) U muda prazo de indicação de multa existente
  n_total := n_total + 1;
  begin
    update public.multas set prazo_indicacao = current_date + 300 where id = m2;
    r := r || '(u6) U muda prazo: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u6) U muda prazo: OK (barrado)'::text;
    else r := r || ('(u6) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u7) U grava em multa_etapas direto
  n_total := n_total + 1;
  begin
    insert into public.multa_etapas (multa_id, etapa, feito_por) values (m2, 'validada', mail_u);
    r := r || '(u7) U grava multa_etapas: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u7) U grava multa_etapas: OK (barrado)'::text;
    else r := r || ('(u7) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u8) U apaga foto do checklist
  n_total := n_total + 1;
  begin
    delete from public.checklist_fotos where id = f1;
    r := r || '(u8) U apaga foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u8) U apaga foto: OK (barrado)'::text;
    else r := r || ('(u8) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u9) U troca o arquivo de uma foto (UPDATE storage_path)
  n_total := n_total + 1;
  begin
    update public.checklist_fotos set storage_path = 'outro.jpg' where id = f1;
    r := r || '(u9) U troca arquivo da foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u9) U troca arquivo da foto: OK (barrado)'::text;
    else r := r || ('(u9) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u10) U dá baixa em avaria (RLS de UPDATE filtra: 0 linhas; conferir que segue aberta)
  n_total := n_total + 1;
  begin
    update public.checklist_avarias set status = 'reparada', reparada_em = now(), reparada_por = mail_u where id = av1;
    perform set_config('role', 'postgres', true);
    select status into v_txt from public.checklist_avarias where id = av1;
    perform set_config('role', 'authenticated', true);
    if v_txt = 'aberta' then n_ok := n_ok + 1; r := r || '(u10) U dá baixa em avaria: OK (sem efeito)'::text;
    else r := r || '(u10) U dá baixa em avaria: *** FALHOU *** (reparada)'::text; end if;
  exception when others then
    perform set_config('role', 'authenticated', true);
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u10) U dá baixa em avaria: OK (barrado)'::text;
    else r := r || ('(u10) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u11) U apaga avaria
  n_total := n_total + 1;
  begin
    delete from public.checklist_avarias where id = av1;
    r := r || '(u11) U apaga avaria: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(u11) U apaga avaria: OK (barrado)'::text;
    else r := r || ('(u11) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u12) U registra avaria nova e foto dela: OK
  n_total := n_total + 1;
  begin
    -- dois comandos separados (num CTE a trigger da foto não enxergaria a avaria do mesmo comando)
    insert into public.checklist_avarias (id, checklist_id, peca, tamanho) values (av3, c1, 'Farol / lanterna', 'grande');
    insert into public.checklist_fotos (checklist_id, storage_path, posicao, tipo_foto, avaria_id)
      values (c1, '__teste_ma/c1/av-dano.jpg', 'Avaria 1', 'avaria_dano', av3);
    n_ok := n_ok + 1; r := r || '(u12) U registra avaria com foto: OK'::text;
  exception when others then r := r || ('(u12) U registra avaria: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (u13) foto de avaria apontando para avaria de OUTRO checklist
  n_total := n_total + 1;
  begin
    insert into public.checklist_fotos (checklist_id, storage_path, posicao, tipo_foto, avaria_id)
      values (c1, '__teste_ma/c1/x.jpg', 'Avaria x', 'avaria_peca', av2);
    r := r || '(u13) foto com avaria de outro checklist: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(u13) foto com avaria de outro checklist: OK (barrado)'::text;
    else r := r || ('(u13) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (u14) U vê o arquivo do bucket (tem Sofia)
  n_total := n_total + 1;
  select count(*) into v_int from storage.objects where bucket_id = 'checklist-fotos' and name = '__teste_ma/c1/Frente.jpg';
  if v_int = 1 then n_ok := n_ok + 1; r := r || '(u14) U lê objeto do bucket: OK'::text;
  else r := r || '(u14) U lê objeto do bucket: *** FALHOU ***'::text; end if;

  -- ================= SEM SOFIA (N) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_n, 'email', mail_n, 'role', 'authenticated')::text, true);

  -- (n1) N não lista o bucket de fotos do checklist
  n_total := n_total + 1;
  select count(*) into v_int from storage.objects where bucket_id = 'checklist-fotos' and name = '__teste_ma/c1/Frente.jpg';
  if v_int = 0 then n_ok := n_ok + 1; r := r || '(n1) N (sem Sofia) não vê objeto do bucket: OK'::text;
  else r := r || '(n1) N vê objeto do bucket: *** FALHOU ***'::text; end if;

  -- (n2) N não vê multa_etapas nem avarias
  n_total := n_total + 1;
  if (select count(*) from public.checklist_avarias) = 0 and (select count(*) from public.multa_etapas) = 0 then
    n_ok := n_ok + 1; r := r || '(n2) N não lê avarias/etapas: OK'::text;
  else r := r || '(n2) N lê avarias/etapas: *** FALHOU ***'::text; end if;

  -- ================= GESTOR (G) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'email', mail_g, 'role', 'authenticated')::text, true);

  -- (g1) G percorre m1: condutor → termo → indicado → validada → cobrada → solicitado
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'condutor', jsonb_build_object('motorista_id', mo1));
    perform public.sofia_multa_registrar_etapa(m1, 'termo', jsonb_build_object('storage_path', 'multas/' || m1 || '/termo-1.pdf'));
    perform public.sofia_multa_registrar_etapa(m1, 'indicado', jsonb_build_object('indicado_em', current_date, 'protocolo', 'P-1'));
    perform public.sofia_multa_registrar_etapa(m1, 'validada', jsonb_build_object('em_nome_de', 'Gestor EQ', 'canal', 'whatsapp'));
    perform public.sofia_multa_registrar_etapa(m1, 'cobrada', jsonb_build_object('boleto_lancado_em', current_date));
    perform public.sofia_multa_registrar_etapa(m1, 'solicitado', '{}'::jsonb);
    select status || '/' || autorizacao_status || '/' || motorista_id::text into v_txt from public.multas where id = m1;
    select count(*) into v_int from public.multa_etapas where multa_id = m1 and feito_por = mail_g;
    if v_txt = 'validada/solicitado/' || mo1::text and v_int = 6 then
      n_ok := n_ok + 1; r := r || '(g1) G percorre até solicitado, status derivado, 6 etapas registradas: OK'::text;
    else r := r || ('(g1) *** FALHOU *** ' || coalesce(v_txt,'null') || ' etapas=' || v_int)::text; end if;
  exception when others then r := r || ('(g1) G percorre fluxo: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (g2) GESTOR NÃO CONSEGUE AUTORIZAR pela RPC
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'autorizado', '{}'::jsonb);
    r := r || '(g2) G autoriza pela RPC: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g2) G autoriza pela RPC: OK (barrado)'::text;
    else r := r || ('(g2) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g3) GESTOR NÃO CONSEGUE AUTORIZAR por UPDATE direto da etapa
  n_total := n_total + 1;
  begin
    update public.multas set etapa = 'autorizado' where id = m1;
    r := r || '(g3) G autoriza por UPDATE da etapa: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g3) G autoriza por UPDATE da etapa: OK (barrado)'::text;
    else r := r || ('(g3) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g4) GESTOR NÃO CONSEGUE AUTORIZAR mudando autorizacao_status direto
  n_total := n_total + 1;
  begin
    update public.multas set autorizacao_status = 'autorizado' where id = m1;
    r := r || '(g4) G muda autorizacao_status direto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g4) G muda autorizacao_status direto: OK (barrado)'::text;
    else r := r || ('(g4) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g5) G pula de solicitado para descontada (contornando o admin)
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'descontada',
      jsonb_build_object('valor_descontado', 100, 'tipo_desconto', 'total', 'competencia', current_date));
    r := r || '(g5) G desconta sem autorização: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g5) G desconta sem autorização: OK (barrado)'::text;
    else r := r || ('(g5) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g6) G volta etapa (solicitado → registrada)
  n_total := n_total + 1;
  begin
    update public.multas set etapa = 'registrada' where id = m1;
    r := r || '(g6) G volta etapa: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g6) G volta etapa: OK (barrado)'::text;
    else r := r || ('(g6) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g7) G grava etapa com feito_por de outra pessoa
  n_total := n_total + 1;
  begin
    insert into public.multa_etapas (multa_id, etapa, feito_por) values (m1, 'validada', mail_a);
    r := r || '(g7) G grava etapa em nome de outro e-mail: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = '42501' then n_ok := n_ok + 1; r := r || '(g7) G grava etapa com feito_por alheio: OK (barrado)'::text;
    else r := r || ('(g7) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g8) G apaga foto direto
  n_total := n_total + 1;
  begin
    delete from public.checklist_fotos where id = f1;
    r := r || '(g8) G apaga foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(g8) G apaga foto: OK (barrado)'::text;
    else r := r || ('(g8) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g9) G exclui o checklist com foto (cascata não pode levar a foto)
  n_total := n_total + 1;
  begin
    delete from public.checklist where id = c1;
    r := r || '(g9) G exclui checklist com foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','23503') then n_ok := n_ok + 1; r := r || '(g9) G exclui checklist com foto: OK (barrado)'::text;
    else r := r || ('(g9) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g10) G exclui sinistro com foto (gestor pode excluir sinistro, mas a cascata bate na foto)
  n_total := n_total + 1;
  begin
    delete from public.sinistros where id = s1;
    r := r || '(g10) G exclui sinistro com foto: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g10) G exclui sinistro com foto: OK (barrado)'::text;
    else r := r || ('(g10) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g11) G dá baixa na avaria: OK, quem = e-mail do JWT (ignora o informado)
  n_total := n_total + 1;
  begin
    update public.checklist_avarias set status = 'reparada', reparada_em = now(), reparada_por = 'forjado@x' where id = av1;
    select reparada_por into v_txt from public.checklist_avarias where id = av1;
    if v_txt = mail_g then n_ok := n_ok + 1; r := r || '(g11) G dá baixa, reparada_por = JWT: OK'::text;
    else r := r || ('(g11) *** FALHOU *** reparada_por=' || coalesce(v_txt,'null'))::text; end if;
  exception when others then r := r || ('(g11) G dá baixa: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (g12) G reabre avaria reparada
  n_total := n_total + 1;
  begin
    update public.checklist_avarias set status = 'aberta', reparada_em = null, reparada_por = null where id = av1;
    r := r || '(g12) G reabre avaria: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','23514') then n_ok := n_ok + 1; r := r || '(g12) G reabre avaria: OK (barrado)'::text;
    else r := r || ('(g12) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g13) G muda a peça de uma avaria
  n_total := n_total + 1;
  begin
    update public.checklist_avarias set peca = 'Outra peça' where id = av2;
    r := r || '(g13) G muda peça da avaria: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g13) G muda peça da avaria: OK (barrado)'::text;
    else r := r || ('(g13) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g14) G pede m3 (para revogação depois)
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m3, 'solicitado', '{}'::jsonb);  -- pular para frente é permitido
    n_ok := n_ok + 1; r := r || '(g14) G solicita m3 pulando etapas: OK'::text;
  exception when others then r := r || ('(g14) *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- ================= ADMIN (A) =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_a, 'email', mail_a, 'role', 'authenticated')::text, true);

  -- (a1) ADMIN AUTORIZA m1 pela RPC
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'autorizado', '{}'::jsonb);
    select etapa || '/' || status || '/' || autorizacao_status into v_txt from public.multas where id = m1;
    if v_txt = 'autorizado/validada/autorizado' then n_ok := n_ok + 1; r := r || '(a1) A autoriza: OK'::text;
    else r := r || ('(a1) *** FALHOU *** ' || v_txt)::text; end if;
  exception when others then r := r || ('(a1) A autoriza: *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (a2) A autoriza m3 e depois revoga: OK
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m3, 'autorizado', '{}'::jsonb);
    perform public.sofia_multa_registrar_etapa(m3, 'solicitado', '{}'::jsonb);
    select etapa || '/' || autorizacao_status into v_txt from public.multas where id = m3;
    if v_txt = 'solicitado/solicitado' then n_ok := n_ok + 1; r := r || '(a2) A autoriza e revoga: OK'::text;
    else r := r || ('(a2) *** FALHOU *** ' || v_txt)::text; end if;
  exception when others then r := r || ('(a2) *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (a3) A apaga foto
  n_total := n_total + 1;
  begin
    delete from public.sinistro_fotos where id = sf1;
    r := r || '(a3) A apaga foto de sinistro: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate in ('P0001','42501') then n_ok := n_ok + 1; r := r || '(a3) A apaga foto de sinistro: OK (barrado)'::text;
    else r := r || ('(a3) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- ================= GESTOR de novo =================
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid_g, 'email', mail_g, 'role', 'authenticated')::text, true);

  -- (g15) G revoga autorização (m1 autorizado → solicitado)
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'solicitado', '{}'::jsonb);
    r := r || '(g15) G revoga autorização: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g15) G revoga autorização: OK (barrado)'::text;
    else r := r || ('(g15) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g16) G registra desconto acima do valor
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'descontada',
      jsonb_build_object('valor_descontado', 101, 'tipo_desconto', 'total', 'competencia', current_date));
    r := r || '(g16) desconto acima do valor: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g16) desconto acima do valor: OK (barrado)'::text;
    else r := r || ('(g16) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g17) G registra desconto válido depois da autorização do admin
  n_total := n_total + 1;
  begin
    perform public.sofia_multa_registrar_etapa(m1, 'descontada',
      jsonb_build_object('valor_descontado', 100, 'tipo_desconto', 'total', 'competencia', current_date));
    select status || '/' || to_char(desconto_competencia, 'DD') into v_txt from public.multas where id = m1;
    if v_txt = 'descontada/01' then n_ok := n_ok + 1; r := r || '(g17) G registra desconto autorizado: OK'::text;
    else r := r || ('(g17) *** FALHOU *** ' || v_txt)::text; end if;
  exception when others then r := r || ('(g17) *** FALHOU *** ' || sqlerrm)::text;
  end;

  -- (g18) G muda valor descontado sem mudar etapa
  n_total := n_total + 1;
  begin
    update public.multas set valor_descontado = 1 where id = m1;
    r := r || '(g18) G mexe no valor descontado: *** FALHOU *** (passou)'::text;
  exception when others then
    if sqlstate = 'P0001' then n_ok := n_ok + 1; r := r || '(g18) G mexe no valor descontado: OK (barrado)'::text;
    else r := r || ('(g18) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- (g19) G não apaga linha de multa_etapas
  n_total := n_total + 1;
  begin
    delete from public.multa_etapas where multa_id = m1;
    get diagnostics v_int = row_count;
    if v_int = 0 then n_ok := n_ok + 1; r := r || '(g19) G apaga multa_etapas: OK (sem efeito)'::text;
    else r := r || '(g19) G apaga multa_etapas: *** FALHOU *** (apagou)'::text; end if;
  exception when others then
    if sqlstate = '42501' then n_ok := n_ok + 1; r := r || '(g19) G apaga multa_etapas: OK (barrado)'::text;
    else r := r || ('(g19) *** FALHOU *** ' || sqlerrm)::text; end if;
  end;

  -- ================= FIM: invariantes como postgres =================
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- (z1) m2 intacta depois de U
  n_total := n_total + 1;
  if exists (select 1 from public.multas where id = m2 and etapa = 'registrada' and status = 'pendente'
             and autorizacao_status = 'sem_solicitacao' and prazo_indicacao is null) then
    n_ok := n_ok + 1; r := r || '(z1) m2 intacta: OK'::text;
  else r := r || '(z1) m2 intacta: *** FALHOU ***'::text; end if;

  -- (z2) ninguém apagou foto: f1, sf1 e o checklist c1 continuam
  n_total := n_total + 1;
  if exists (select 1 from public.checklist_fotos where id = f1 and storage_path = '__teste_ma/c1/Frente.jpg')
     and exists (select 1 from public.sinistro_fotos where id = sf1)
     and exists (select 1 from public.checklist where id = c1)
     and exists (select 1 from public.sinistros where id = s1) then
    n_ok := n_ok + 1; r := r || '(z2) nenhuma foto apagada nem trocada: OK'::text;
  else r := r || '(z2) fotos intactas: *** FALHOU ***'::text; end if;

  raise exception E'TESTE multa/avaria/fotos (rollback forçado — nada foi gravado)\n%\nRESUMO: %/% %',
    array_to_string(r, E'\n'), n_ok, n_total,
    case when n_ok = n_total then 'OK' else '*** FALHOU ***' end;
end;
$$;

rollback;

-- Depois, como postgres, confirmar que nada ficou (todas = 0):
--   select count(*) from auth.users            where email like '\_\_teste\_ma\_%';
--   select count(*) from public.hub_user_roles where user_email like '\_\_teste\_ma\_%';
--   select count(*) from public.sofia_gestores where user_email like '\_\_teste\_ma\_%';
--   select count(*) from public.multas         where descricao like 'teste-ma%';
--   select count(*) from storage.objects       where name like '\_\_teste\_ma/%';
```

Contagem: p1, p2, u1–u14, n1–n2, g1–g14, a1–a3, g15–g19, z1–z2 = 2 + 14 + 2 + 14 + 3 + 5 + 2 = **42**.

Notas para quem rodar:
- (u10) depende de a RLS de UPDATE filtrar a linha (0 linhas, sem erro) — por isso confere o estado depois.
- (g9) pode vir como `23503` (FK de `checklist_avarias` sem cascade) ou `P0001` (trigger da foto): os dois provam que nada
  foi apagado; (z2) confirma.
- (n1) depende do `insert` direto em `storage.objects` funcionar como `postgres`; se a versão do storage recusar, ajustar a
  fixture (nunca o teste).
- `set_config('role','postgres', true)` dentro do bloco: a sessão é `postgres`, então voltar é permitido.

---

## 4. App

### 4.1 Arquivos novos

| Arquivo | Conteúdo |
|---|---|
| `lib/sofia/multaEtapas.ts` | **puro**: `ETAPAS_MULTA` (chave, rótulo, ator, tag NOVO/AMPLIADO/EXISTE, textos "como é hoje"/"como fica" do mockup), `ordemEtapa`, `statusDaEtapa`, `autorizacaoDaEtapa` (espelho das funções SQL), `proximasAcoes(etapa, perfil)` → ações com `permitida` e `motivo` ("Só administrador pode." / "Só gestor de frotas ou administrador."), `classePrazo(prazo, etapa, hoje)` (indicado / vencido / ≤5 / ≤10 / normal + dias), `prazoPadrao(recebimento)` (+30), `MODO_INDICACAO_POR_LOCADORA`. Tipos `MultaEtapa`, `MultaComEtapa` (interseção com `Multa`, sem mexer em `lib/sofia/types.ts`) |
| `lib/sofia/multaPermissoes.ts` | `podeAutorizarDescontoMulta(supabase)` → RPC `sofia_is_admin`, só `data === true` libera (falha fechada, mesmo padrão de `permissoes.ts`, que **não** é editado) |
| `lib/sofia/checklistHistorico.ts` | **puro**: `ordenarAntesDepois`, `escolhaPadrao(checklists)` (anterior × mais recente), `baseDoVeiculo`, `avariasAbertasEm(avarias, dataISO)`, `diffChecklists(antes, depois, avarias)` → `{tipo:'item_piorou'|'item_melhorou'|'avaria_nova'|'avaria_resolvida'|'avaria_continua', texto}` (textos do mockup) |
| `lib/sofia/fotosChecklist.ts` | **puro**: `TETO_FOTOS = 30`, `contarFotos`, `validarAvariaRascunho` (peça, tamanho, ≥1 peça, ≥1 dano → lista "Falta: …"), `PECAS_AVARIA`, `TAMANHOS_AVARIA`, `posicaoExtra(n)` |
| `components/sofia/FotosAdicionais.tsx` | lista de extras + "+ Mais fotos", "x" só no rascunho, some no teto |
| `components/sofia/RegistrarAvaria.tsx` | aba "Avarias do checklist (n)" / "+ Registrar avaria" do mockup |
| `components/sofia/CompararFotos.tsx` | client: lado a lado / sobrepor com `input range` de opacidade |
| `app/(operacoes)/sofia/multas/[id]/page.tsx` | detalhe da multa: cartão (placa, motorista, auto, órgão, pontos, pill do prazo, recebida em / prazo até), stepper das 10 etapas (contestada aparece só quando for a etapa atual), painel da etapa selecionada (hoje × como fica, quem pode, botões com motivo), cartão de condutor sugerido, cartão de modo por locadora, cartão de prazo vencido/dobro, histórico de `multa_etapas` |
| `app/(operacoes)/sofia/multas/[id]/_fluxo.tsx` | client: formulários de cada etapa (condutor, termo com upload, indicação, validação/contestação em nome de, boleto, solicitar/cancelar, autorizar/revogar, desconto com competência, desfazer) |
| `app/(operacoes)/sofia/checklist/veiculo/[veiculoId]/page.tsx` | histórico + comparação + avarias abertas |
| testes: `lib/sofia/__tests__/{multaEtapas,multaPermissoes,checklistHistorico,fotosChecklist}.test.ts`, `app/(operacoes)/sofia/multas/__tests__/_actions.etapas.test.ts`, `app/(operacoes)/sofia/checklist/__tests__/_actions.avarias.test.ts`, `app/(operacoes)/sofia/checklist/__tests__/_actions.historico.test.ts`, `app/(operacoes)/sofia/sinistros/__tests__/_actions.fotos.test.ts` | ver plano |

### 4.2 Arquivos alterados

- `app/(operacoes)/sofia/multas/_actions.ts`: `criarMultaAction` grava `locadora`, `auto_infracao`, `orgao_autuador`,
  `pontos`, `prazo_indicacao` (padrão recebimento+30 se vazio); nova `registrarEtapaMultaAction(id, etapa, formData)` →
  `requireGestorFrotas` + (se `autorizado`/revogação) `podeAutorizarDescontoMulta` → RPC; upload do termo é feito no
  cliente (bucket `sofia-anexos`) e só o caminho chega à action; nova `editarPrazoMultaAction` e `registrarDobroAction`
  e `marcarBoletoContestadaAction` (UPDATE simples, `requireGestorFrotas`; a trigger é a segunda barreira);
  `atualizarAutorizacaoMultaAction` **mantém a assinatura** (é importada por Descontos) e passa a chamar a RPC
  (`solicitado`→`solicitado`, `autorizado`→`autorizado`, `sem_solicitacao`→`cobrada`); **remove**
  `enviarParaDescontoEmMassaAction` (o "validada" antigo não existe mais) e o botão correspondente.
  Toda mensagem de erro da RPC é mapeada para texto fixo (não repassar `error.message` cru para a tela).
- `app/(operacoes)/sofia/multas/_table.tsx` / `page.tsx`: colunas Etapa (rótulo) e Prazo (pill); linha abre
  `/sofia/multas/[id]`; tira "Enviar para desconto" em massa; totais do topo por etapa ("a fazer", "em desconto").
- `app/(operacoes)/sofia/multas/nova/_form.tsx`: campos locadora (datalist), auto de infração, órgão autuador, pontos,
  prazo de indicação (preenche recebimento+30 ao escolher o recebimento, editável).
- `lib/sofia/pendencias.ts`: §2.11. `AutomaticInputs.multas` passa a `{ id, etapa, prazo_indicacao, placa, tipo_infracao,
  descricao }`; `PendenciaAutomatica` ganha `grupo?: 'a_fazer' | 'aguardando_terceiros'`.
- `components/sofia/CameraCapture.tsx`: prop `permitirGaleria?: boolean` (default `true`).
- `lib/sofia/uploadFotos.ts`: caminho ganha o índice (`…-${i}-${Date.now()}.jpg`) para fotos tiradas no mesmo ms não
  colidirem; `CapturedPhoto` ganha `tipo_foto?` e `avaria_id?` (opcionais, sinistro não usa).
- `app/(operacoes)/sofia/checklist/_validation.ts`: `fotos` aceita `tipo_foto`/`avaria_id`; `avarias` (JSON) validado;
  teto 30; posições obrigatórias continuam obrigatórias.
- `app/(operacoes)/sofia/checklist/_actions.ts`: insere checklist → avarias → fotos (FK); `avaria_identificada`/
  `avaria_descricao` derivados; `excluirChecklistAction` devolve a mensagem de §2.7 quando o erro vier da trigger/FK;
  novas `marcarAvariaReparadaAction(id, data)` e `definirAcaoAvariaAction(id, acao)` (`requireGestorFrotas`) e
  `ultimoChecklistAction(veiculoId)` (leitura + URLs assinadas, qualquer usuário do Sofia).
- `app/(operacoes)/sofia/checklist/novo/_form.tsx`: câmera sem galeria, extras, avarias, painel do último na troca.
- `app/(operacoes)/sofia/checklist/[id]/page.tsx`: fotos agrupadas por tipo; bloco Avarias (peça, tamanho, ação,
  status, fotos peça/dano).
- `app/(operacoes)/sofia/checklist/page.tsx`: link "Histórico do veículo" por linha.
- `app/(operacoes)/sofia/sinistros/novo/_form.tsx`: lista + "Mais fotos" com galeria, teto 30, "x" no rascunho.
- `app/(operacoes)/sofia/sinistros/_actions.ts`: criar rejeita > 30 fotos; `excluirSinistroAction` com a mensagem de §2.7.

### 4.3 Integração (arquivos compartilhados com a frente Manutenção/bases ou fora das pastas desta frente)

- `app/(operacoes)/sofia/pendencias/page.tsx`: lê `etapa, prazo_indicacao, tipo_infracao, descricao, veiculos(placa)`
  de multas com etapa fora de `descontada`/`contestada`; mapeia grupo → status; bloco "Aguardando terceiros".
- `app/(operacoes)/sofia/descontos/page.tsx` e `_actions.ts`: linhas de multa mostram a etapa e o link "Abrir no fluxo
  da multa"; somem para multa os botões de avançar status / registrar / desfazer (agora no detalhe da multa);
  `atualizarStatusMultaAction`, `registrarDescontoMultaAction`, `desfazerDescontoMultaAction` são removidas (a trigger
  as recusaria) e o teste `descontos/__tests__/_actions.test.ts` perde os casos de multa. Sinistro e KM não mudam.
- `lib/sofia/alertas/leitura.ts` e `blocos.ts` (+ testes): §2.12.
- `app/(operacoes)/sofia/veiculos/[id]/page.tsx`: link "Histórico do checklist" para `/sofia/checklist/veiculo/[id]`.
- `components/sofia/Sidebar.tsx`: **não muda** (nenhum item de menu novo).
- Docs: `.claude/rules/sofia.md` (trigger nova, RPC, fotos imutáveis, storage), `.claude/rules/sql.md` (linha da
  migration, NÃO APLICADO até aplicar), `docs/DIVIDAS.md` (§7).

---

## 5. Restrições

- Fase "menor mudança" do `AGENTS.md`; schema só o aprovado (§3); o resto (teto 30, compressão, textos) no app.
- Leitura respeita RLS do usuário; nada de service role nas telas.
- `lib/sofia/__tests__/sem-admin-do-hub.test.ts` continua passando (nenhum import de `lib/auth/*` no Sofia; admin é
  perguntado por RPC).
- Mensagem pós-ação pela URL só com id + código fixo (regra do `sofia.md`).
- Tema do hub; telas usáveis a 375 px (mockup tem visão celular).
- **SQL antes do deploy**: depois do SQL, o app antigo perde "Enviar para desconto", avançar/registrar/desfazer desconto
  de multa (a trigger recusa escrita direta de status) e a exclusão de checklist/sinistro com foto. Aplicar e deployar
  na mesma janela.

## 6. Ordem de aplicação

Revisão independente do SQL + teste → autorização escrita do João citando os 2 arquivos → aplicar
`sdd-sql-sofia-multa-avaria.sql`, conferir verificação (19 OK + v04 AVISO) → rodar o teste (42/42) → conferir que nada
ficou → merge → build → push → João clica Deploy → conferir chunks.

## 7. Fora do escopo / dívidas (vão para `docs/DIVIDAS.md`)

1. **Aceite digital do termo pelo motorista** (decisão 1 da multa): motoristas não têm login (§2.3). Exige ligar
   `motoristas` a usuário do hub — decisão de cadastro, não de código.
2. **Comprovante da indicação** (mockup: "protocolo e comprovante"): só protocolo e data; arquivo do comprovante não tem
   coluna no schema aprovado.
3. **Multa contestada é final**: reabrir uma contestada não existe nesta rodada; se precisar, gestor/admin pede correção
   por SQL com o contorno documentado.
4. **Valor extra da multa em dobro** não tem coluna; a tela usa `valor`.
5. **Atomicidade do checklist**: checklist → avarias → fotos continuam em escritas separadas (mesmo padrão de hoje para
   as fotos); falha no meio mostra a mensagem "Checklist salvo, mas …". Não é dado de cliente perdido (as fotos já estão
   no storage), por isso não entra nas exceções.
6. **KM e "feito por" no histórico do checklist**: o checklist não tem KM e `created_by` não é legível pelo app.
7. **`avaria_origem_id`** criado sem uso (continuidade calculada por data).
8. **Gestor pode gravar linha avulsa em `multa_etapas`** (não só pela RPC), com o próprio e-mail — é registro, não
   dinheiro; a etapa da multa só muda pela trigger.
9. **Teto de 30 fotos só no app** (não no banco).
10. **Alerta de multa no e-mail** é "≤ 10 dias", não exatamente 10/5/2 (§2.12).
11. **Arquivos órfãos no storage**: 139 objetos em `checklist-fotos` para 126 linhas (uploads de checklist que falharam
    depois). Não apagar — são do mesmo tipo de prova; só registrar.

## 8. Onde o mockup colidiu com o código real

1. **"Hoje o `CameraCapture` é câmera ao vivo"** — falso: ele já oferece "ou escolher da galeria" nos dois usos. Tirar a
   galeria do checklist é mudança de comportamento (aprovada pela decisão 2 de fotos).
2. **"Existe … upload do termo"** — a coluna `multas.autorizacao_storage_path` existe, mas **nenhum código grava nela**;
   o "autorizou sim/não" é só `autorizacao_assinada`, marcado no formulário de registrar desconto.
3. **"Nenhuma foto salva pode ser apagada"** × exclusão de checklist/sinistro: FK em cascata + todos os 30 checklists com
   foto ⇒ **excluir checklist deixa de funcionar na prática**, e excluir sinistro com foto também. A spec entrega o
   bloqueio (é o que o pedido diz); se o João quiser manter a exclusão do registro errado, a alternativa é "excluir"
   virar "arquivar" — decisão dele, não tomada aqui.
4. **KM no histórico** — `checklist` não tem coluna de KM; coluna e "KM rodado entre os dois" saem.
5. **"Feito por"** — só existe `created_by` (uuid de `auth.users`), ilegível pelo app; vira "Motorista".
6. **Pill "mudou/igual" por posição** — calculada da imagem no mockup; a decisão 2 do histórico proíbe diff de imagem;
   sai.
7. **Etapa "solicitado": "hoje o botão aparece e não faz nada"** para quem não pode — no código o `AutorizacaoActions`
   já esconde os botões (`showActions={podeGerir}`). A tela nova mostra o botão desabilitado com o motivo, como o mockup.
8. **"Enviar para desconto" (status `validada`)** — hoje é uma ação em massa de gestor; no fluxo novo `validada` significa
   "gestor da equipe validou". A ação em massa sai.
9. **Bucket "só por URL assinada"** — confirmado no app, mas as policies deixavam **qualquer usuário logado do hub** listar
   e assinar URL dos dois buckets do Sofia; corrigido (§3.7).
10. **Dados legados**: 2 multas `pendente/autorizado` e 1 `validada/autorizado` sem recebimento; a regra de derivação do
    mockup não as descreve — tratadas em §3.4 sem reescrever o que está gravado.

---

## AJUSTE OBRIGATÓRIO pós-spec (decisão do João, 03/11) — prevalece sobre o texto acima

Colisão 3 (fotos × exclusão) resolvida: **foto avulsa** nunca é apagada nem trocada por ninguém (DELETE/UPDATE em
`checklist_fotos`/`sinistro_fotos` e nos objetos do bucket bloqueados para todos). **Excluir o checklist ou o sinistro
inteiro continua permitido, só para admin** (`is_admin() is true`, guarda que falha fechada), registrando no `audit_log`,
e nesse caso a cascata das fotos é permitida. O bloqueio de exclusão do pai que a spec propunha NÃO deve ser
implementado; ajustar SQL (§3.8), teste (§3.9: assert "admin exclui checklist com foto → passa"; "gestor/usuário exclui
→ falha"; "ninguém apaga foto avulsa, nem admin → falha") e a action de exclusão. Fonte: docs/frotas/2026-11-03-decisoes-terceira-bateria.md.
