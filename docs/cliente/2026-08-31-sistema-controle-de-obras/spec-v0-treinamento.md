# Spec — Controle de Obras, v0 de treinamento

**Entrega: terça 08/09/2026, à tarde.** Escrita em 05/09/2026, depois da aprovação do
mockup v03 (feedback 06) e do corte de escopo (decisão O).

Fontes que esta spec traduz — leia-as se algo aqui parecer arbitrário:

| Arquivo | O que é |
|---|---|
| `mockup-obras.html` | **O mockup aprovado. É lei.** |
| `../../../../scratchpad/modelo-mockup.md` (scratchpad da sessão) | Modelo de dados e regras extraídos do mockup, com linha |
| `../../../../scratchpad/mapa-hub.md` (scratchpad da sessão) | Convenções do hub para criar módulo novo |
| `feedback-06-leitura-e-decisoes.md` | Decisões M, N, O |
| `feedback-05-leitura-e-decisoes.md` | Decisões I–L |
| `decisoes-para-ir-ao-ar.md` | Decisões A–H |

> **Regra que vale para tudo:** o mockup v03 foi aprovado pelo cliente. Cor, tipografia,
> estrutura de telas, nomes de etapa e textos em português **não se reabrem**. Onde esta
> spec calar, o mockup decide.

---

## 1. Escopo

### Entra na v0

1. Módulo `/obras` dentro do hub, com controle de acesso próprio
2. **Base de obras** — tabela + Kanban, filtros, ordenação
3. **Ficha da obra** — ciclo de vida, autorização, identificação, cronograma, linha do tempo
4. **Triagem** — a fila do Yuri, com os 5 campos obrigatórios
5. **Diário do dia** — forma **cartões** (uma obra por vez)
6. **Tarefas** — a falta virando tarefa com dono e prazo
7. ~~**Cadastro manual de obra**~~ — **removido do escopo em 08/09/2026.** Nunca foi
   requisito: a obra vem sempre do Field Control. Ver
   `feedback-07-obra-vem-sempre-do-field.md`
8. **Importação da planilha** para carga inicial
9. **Manual de uso** (artifact + PDF)

### Fica de fora — e o porquê

| O que | Por quê |
|---|---|
| Integração com a API do Field Control | Sem credencial nem documentação; e o Field ainda não tem os dados (decisão N) |
| WhatsApp e agendador 18h/19h | Decisão M em aberto — o canal acabou de ser reaberto pelo cliente |
| Painel do dia | Depende do agendador para ter sentido |
| Diário na forma "lista única" | Decisão B continua válida; só não cabe em 3 dias |
| Dashboard de reunião, Zeev | Camada 4 e standby, decisão do cliente |

---

## 2. Decisões técnicas tomadas nesta spec

Oito pontos ficaram ambíguos no mockup. Resolvidos aqui, com o critério explícito.

| # | Ambiguidade | Decisão | Por quê |
|---|---|---|---|
| 1 | Quem marca as etapas pós-campo (Decisão G, aberta com o cliente) | Qualquer usuário com acesso muda a etapa pela ficha; sem trava por papel | A trava exige a resposta do cliente. Sem ela, travar impede o uso; não travar só permite. Reversível. |
| 2 | O que acontece quando uma tarefa vence (Decisão I, aberta) | Vencida é **calculada** e aparece em vermelho na lista. Nada escala | Escalar depende do agendador, que está fora da v0 |
| 3 | Roteamento de "Documento / ART" e "Outro" (Decisão J, aberta) | Vai para o Yuri, como no mockup | É o default do mockup aprovado |
| 4 | Cálculo do campo `gap` | **Não calcular na v0.** Não exibir | Só existia numa obra de exemplo; é enfeite, não mecanismo |
| 5 | `prioridade` é capturada na triagem e nunca exibida | Capturar (segue obrigatória) e **exibir como pílula** na ficha e como coluna na tabela | Campo obrigatório que não aparece em lugar nenhum é campo que ninguém entende por que preenche |
| 6 | Não existe gatilho para `levantamento → andamento` nem `andamento ↔ paralisado` | **Troca de etapa manual na ficha**, num seletor, com registro de quem mudou e quando | Sem isso o quadro trava no primeiro dia de uso real. É a lacuna mais grave do mockup |
| 7 | O diário só existe para o Yuri (`FILA` fixa) | **Cada usuário vê o diário das obras onde é o `pcm`.** Admin vê todas, com seletor de analista | Terça treina a equipe inteira, não o Yuri sozinho |
| 8 | `""` vs `null` como "vazio" | **`null` em tudo.** String vazia nunca é gravada | Um sentinela só; `""` e `null` convivendo é bug garantido |

**As decisões 6 e 7 acrescentam comportamento que o mockup não tem.** Não contradizem
nada aprovado — preenchem lacunas que só apareceriam no uso real. Devem ser mostradas ao
cliente no treinamento de terça, não escondidas.

---

## 3. Convenções do hub a seguir

Levantadas do código, não supostas. Detalhe em `mapa-hub.md`.

- **Rota:** `app/obras/` com `page.tsx` fino + `_actions.ts` (`'use server'`) +
  `_form.tsx` / `_table.tsx` client. Prefixo `_` não vira rota.
- **Middleware:** `/obras` entra no `matcher` **e** no `isProtected` de `middleware.ts`,
  com `hasSystemAccess(supabase, email, 'obras')`, espelhando o bloco `isCrmPage`
  (`middleware.ts:108-136`). **Rota fora do matcher fica aberta.**
- **Slug de acesso:** `'obras'` é string livre em `hub_system_access.system_slug`.
  Precisa ser concedido por usuário em `/admin/acessos`. **Sem isso ninguém entra.**
- **Card no dashboard:** `app/(dashboard)/dashboard/page.tsx` — adicionar
  `hasSystemAccess(..., 'obras')` e o `<Link>`, senão o módulo existe e ninguém acha.
- **Server Action, receita fixa:** `createClient()` → `auth.getUser()` →
  `hasSystemAccess` → query → `revalidatePath` → retorno `{error?}` / `{success?}`.
  **Nunca `throw`.**
- **Tema:** hex literal em classe Tailwind arbitrária (`bg-[#0d2050]`, `text-[#94a3b8]`,
  laranja `#f05a28`, fundo `#0a1628`, bordas `#1e3a5f`). Não há `tailwind.config`;
  Tailwind v4 vem por `@import "tailwindcss"` em `app/globals.css`.
- **Testes:** mockar `lib/supabase/server`, `next/cache`, `lib/auth/systemAccess`,
  `lib/auth/roles`. Nunca bater em Supabase real. Padrão em
  `app/conversor-os/__tests__/_actions.test.ts`.
- **Migration:** arquivo `sdd-sql-obras-v0.sql` na raiz, rodado à mão no SQL Editor.
  Não existe CLI de migration neste projeto.

---

## 4. Schema

Tabelas em `snake_case`, prefixadas `obras_`. `id uuid default gen_random_uuid()`,
`created_at timestamptz default now()`.

### 4.1 `obras_obra`

Identificação: `os text`, `loja text`, `descricao text`, `tipo text`, `valor numeric`,
`origem text`.

Responsáveis: `analista_cliente text` (quem aprova do lado da DPSP),
`pcm text` (o responsável Manfac — é por ele que o diário é filtrado), `equipe text`.

Autorização — **os dois destravamentos são independentes** (decisão I):
`os_aprovada boolean default false`, `liberado_por text`, `liberado_em date`.

Situação: `etapa text not null default 'definir'` com `check` nos 9 valores do ciclo;
`bloqueio text default 'Sem bloqueio'`; `mau_uso boolean default false` — **classificação,
nunca etapa** (decisão J); `prioridade text` (`Normal` | `Urgente`).

Cronograma: `aprovacao date`, `inicio_plan date`, `inicio_real date`, `duracao int`,
`fim_real date`, `desde_etapa date`.

Marcos (6 colunas de data, não tabela): `marco_exec_fim`, `marco_relatorio`,
`marco_os_aprov`, `marco_fechou_os`, `marco_liberou_fat`, `marco_faturou`.

Pendências: `pendencia text`, `pend_resp text`, `pend_prazo date`, `prox_acao text`.

Controle: `atualizacao date`, `nao_andou_seguidos int default 0`,
`bloqueada_dias int default 0`, `criado_por uuid`, `updated_at timestamptz`.

> **Nada de campo derivado no banco.** `dias`, `atraso`, `fim_calc`, `critico`,
> `sem_cobertura`, `estourou`, `travado`, `encalhada` são **calculados no código** a cada
> render, exatamente como no mockup. Gravar derivado é garantir que ele fique velho.

### 4.2 `obras_diario`
`obra_id` FK, `data date`, `andou boolean not null`, `motivo text` (obrigatório quando
`andou = false`), `item text not null`, `obs text`, `foto_path text`, `registrado_por uuid`.
**`unique (obra_id, data)`** — um registro por obra por dia.

### 4.3 `obras_tarefa`
`obra_id` FK, `item text`, `dono text`, `aberta date`, `hora_aberta time`, `prazo date`,
`registrou text`, `situacao text` (`aberta` | `respondida`), `resposta_em date`,
`resposta_hora time`, `resumo text`.
**"Vencida" nunca é gravada** — é `situacao <> 'respondida' and prazo < hoje`.

### 4.4 `obras_pessoa`
`chave text primary key` (YURI, ROBERTA, MANFAC-7), `nome`, `iniciais`, `area`
(`Compras` | `Obras` | `Campo`), `funcao`, `fone text`.
O telefone fica **nulo** até o João cadastrar — é pendência de operação conhecida, e não
trava a v0 porque o WhatsApp está fora dela.

### 4.5 `obras_remarcacao`
`obra_id` FK, `data date`, `de date`, `para date`, `motivo text`. Só leitura na v0 —
vem da importação e aparece na ficha.

### 4.6 Storage
Bucket **privado** `obras-fotos`. Upload **antes** do insert do diário (padrão de
`lib/sofia/uploadFotos.ts`). Leitura só por signed URL curta gerada em server action.
Caminho: `obras-fotos/{obra_id}/{data}.jpg`.

### 4.7 RLS
Criar `obras_has_access()` e `obras_is_admin()` espelhando `lib/auth/roles.ts` e
`lib/auth/systemAccess.ts`. Policy `obras access` usando `obras_has_access()` em todas as
tabelas.

**Duas armadilhas de PL/pgSQL que já morderam neste projeto — não repetir:**
1. Teste de tabela em trigger compartilhada tem que ser `if` externo, com o campo
   aninhado dentro. `if TG_TABLE_NAME = 'x' and new.campo ...` levanta `42703` numa tabela
   sem a coluna, porque `and` não protege.
2. Função de autorização **tem que devolver `true`/`false`, nunca `NULL`** — `exists(...)`
   garante; `in (lista)` precisa de `coalesce(..., false)`. Guarda que devolve NULL falha
   **aberta**.

---

## 5. Telas

Cada uma reproduz o mockup. Onde houver dúvida de rótulo ou de ordem de bloco, o mockup
manda — os textos exatos estão listados em `modelo-mockup.md` §5.

### 5.1 Base de obras
KPIs **sempre sobre a base inteira, nunca sobre o filtro**. Visões Tabela e Kanban
(Kanban agrupa por **fase**, não por etapa). Filtros: Responsável da obra, Etapa da obra,
Autorização (Todas / Com OS aprovada / Sem OS aprovada / Liberadas, ainda sem OS /
Sem cobertura), Classificação (Todas / Só mau uso / Sem mau uso). Ordenação por clique no
cabeçalho, default `dias` desc.

### 5.2 Ficha da obra
Ordem dos blocos conforme `modelo-mockup.md` §2.4. Inclui a **troca de etapa manual**
(decisão técnica 6) e a pílula de **prioridade** (decisão 5).

### 5.3 Triagem
Modo da ficha quando `etapa = 'definir'`. Os 5 campos obrigatórios (Responsável, Equipe,
Prioridade, Data de início, Duração) travam o botão "Liberar para o diário do dia".
Liberado por / Data da liberação são **opcionais**, fora do checklist.

### 5.4 Diário do dia
Forma cartões. Fila = obras em campo onde o usuário logado é o `pcm`, ordenadas por `dias`
desc. Perguntas: "Andou hoje?", "Faltou algum item?", "Por que não andou?".
**Única trava: "não andou" exige motivo** (decisão C). Anexar foto nas obras em campo.

### 5.5 Tarefas
Falta vira tarefa ao salvar o diário — e **foto que não veio abre uma segunda tarefa**
(`item: "Foto"`, dono = a equipe da obra). Roteamento por `ROTA_FALTA`: Material →
Roberta/Compras; Ferramenta, Equipe, Documento/ART, Outro → Yuri; Foto → equipe.
Prazo padrão: fim do dia; depois das 18h, fim do dia útil seguinte.

---

## 6. Importação da planilha

Carga inicial da base (decisão N). O mapeamento coluna a coluna, os valores de enum reais
e a sujeira a tratar estão em **`dicionario-planilha.md`** (scratchpad da sessão) — não
duplicar aqui.

### A planilha tem DUAS abas, e as duas entram

Descoberto na análise do dump, em 05/09. Isto muda o import:

| Aba | Registros | Papel |
|---|---|---|
| **Pipeline DPSP** | **187 chamados** | O universo. **É a base de obras do sistema** — e é de onde vem o "base completa: 187" do mockup |
| **Planejamento DPSP** | **19 obras** | O recorte do que está em campo agora, com o detalhe operacional (bloqueio, pendência, próxima ação, cronograma) |

18 das 19 obras ativas também estão na Pipeline; a 19ª é a `GARANTIA`, sem OS numérica.

**Importar as duas, casando por `os`:** a Pipeline cria as 187 obras, a Planejamento
enriquece as 19 ativas. Importar só a Planejamento deixaria a base com 10% do tamanho real
e **sem nenhuma obra em fechamento ou faturamento** — justamente as 89 executadas e não
faturadas que o cliente quer enxergar, e que motivaram o projeto.

### Regras que valem independente do dicionário:

- **Avanço físico não vira campo.** A planilha tem `0.9` e `95` querendo dizer a mesma
  coisa; o mockup não usa percentual, usa "prazo consumido" calculado de `duracao`.
  A pergunta 03 do cliente segue sem resposta — **não inventar regra aqui.**
- **`MAU USO - APROVAR OS` na coluna de status vira `mau_uso = true` + a etapa real**,
  nunca uma etapa chamada mau uso.
- Linha sem OS ou sem loja é descartada e **listada no relatório de importação** — importar
  em silêncio é pior que não importar.
- A importação é **idempotente por `os`**: rodar de novo atualiza, não duplica.
- Ao fim, gravar um relatório: quantas linhas lidas, importadas, atualizadas, descartadas
  e por quê.

> **Bloqueio conhecido:** a planilha viva ainda não chegou. O que existe é o dump da
> Rev.02 de 31/08. Se o link não vier até segunda de manhã, a carga sobe com dados de uma
> semana atrás e o treinamento acontece em cima de obra desatualizada.

---

## 7. Frentes de implementação

Independentes por arquivo, para rodarem em paralelo.

| Frente | Entrega | Depende de |
|---|---|---|
| **A — Fundação** | `sdd-sql-obras-v0.sql`, `obras_has_access()`, middleware, card no dashboard, layout de `/obras` | — |
| **B — Base + Ficha + Triagem** | `page.tsx`, `_table.tsx`, `_ficha.tsx`, `_triagem.tsx`, `_actions.ts` | A |
| **C — Diário + Tarefas** | `diario/`, `tarefas/`, upload de foto | A |
| **D — Importação** | script/rota de importação + relatório | A |
| **E — Manual de uso** | artifact + PDF | B e C desenhadas |

**Quem executa e quem confere nunca são o mesmo agente.** Cada frente volta para revisão
independente antes de entrar.

---

## 8. Riscos assumidos

1. **Prazo.** Três dias, dois de fim de semana, para o que foi orçado em 15–17 dias de
   trabalho. O corte é o que torna possível — se algo escorregar, o que cai primeiro é a
   importação (dá para treinar com menos obras) e depois o Kanban (a tabela basta).
2. **Planilha desatualizada** — ver §6.
3. **Decisões G, I e J seguem abertas com o cliente.** Os defaults adotados são reversíveis
   e devem ser mostrados no treinamento, não escondidos.
4. **A v0 não é a v1.** Sem WhatsApp e sem agendador, não existe a cobrança que sustenta o
   hábito de preencher o diário. Terça se ensina a tela; o mecanismo que faz a tela ser
   usada todo dia entra depois. **Isso precisa estar dito no manual e na fala do
   treinamento** — senão o sistema é abandonado na segunda semana, e a conclusão vai ser
   que a ferramenta não presta.
