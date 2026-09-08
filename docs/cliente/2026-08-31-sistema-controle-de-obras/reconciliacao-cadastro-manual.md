# Reconciliação — cadastro manual de obra vs. código/banco reais

Levantamento feito lendo o código em `app/obras/` e a migration `sdd-sql-obras-v0.sql`
(estado do repositório em 2026-09-08, migration **não aplicada em produção** —
ver `AGENTS.md`). Todas as afirmações abaixo são verificadas por leitura de código;
onde não deu para verificar, está dito explicitamente.

---

## 1. Inventário de campos de `obras_obra`

Fonte: `sdd-sql-obras-v0.sql:60-135` (tabela) e `app/obras/_lib/tipos.ts:209-256` (tipo
`ObraRow`, que espelha a tabela 1:1). "Obrigatória no banco" = `NOT NULL` sem `DEFAULT`
(isto é, um `insert` que omita a coluna falharia). "Quem preenche hoje" foi confirmado
por grep de todo `app/obras/` procurando cada nome de coluna em contexto de escrita
(`.insert`, `.update`, objeto literal passado ao Supabase).

| Coluna | Tipo | Obrigatória (NOT NULL sem default) | Default | Valores aceitos (check) | Quem preenche hoje | Rótulo na ficha |
|---|---|---|---|---|---|---|
| `id` | uuid | não | `gen_random_uuid()` | — | banco | (não exibido) |
| `os` | text | não | — | — | importador (`_lib/importacao.ts:424,499`) | "Nº OS" (`_ficha.tsx:541`, `_triagem.tsx:164`) |
| `loja` | text | não | — | — | importador (`importacao.ts:425,500`) | "Loja" (`_table.tsx:97,162`; título H1 da ficha `_ficha.tsx:367`) |
| `descricao` | text | não | — | — | importador (`importacao.ts:426,523`) | "Chamado" (`_ficha.tsx:543`, `_triagem.tsx:166`) |
| `tipo` | text | não | — | — | importador (`importacao.ts:427,524`) | "Tipo" (`_ficha.tsx:544`) |
| `valor` | numeric | não | — | — | importador (`importacao.ts:428,525`) | "Valor" (`_ficha.tsx:557`) |
| `origem` | text | não | — | — | importador — só aba Planejamento (`importacao.ts:526`; Pipeline grava `null`, `importacao.ts:429`) | "Origem" (`_ficha.tsx:563`) |
| `analista_cliente` | text | não | — | — | importador (`importacao.ts:430,527`) | "Analista" (`_ficha.tsx:558`) |
| `pcm` | text | não | — | — | importador (só Planejamento, `importacao.ts:528`; Pipeline grava `null`, `importacao.ts:431`) **e** Triagem (`obra/[id]/_actions.ts:144`) | "Responsável da obra" (`_ficha.tsx:559`) |
| `equipe` | text | não | — | — | importador (só Planejamento, `importacao.ts:529`; Pipeline grava `null`, `importacao.ts:432`) **e** Triagem (`_actions.ts:145`) | "Equipe / prestador" (`_ficha.tsx:562`) |
| `os_aprovada` | boolean | sim* | `false` | — | **ninguém** — nenhuma Server Action grava esta coluna (confirmado por grep; só leitura em `_etiquetas.tsx`, `_regras.ts`, `_ficha.tsx`, `_triagem.tsx`) | "OS do cliente" (`_ficha.tsx:492-503`, `EtiquetaOS`) |
| `liberado_por` | text | não | — | — | Triagem, campo opcional (`_actions.ts:151`) | "Liberado por" / "Liberação" (`_ficha.tsx:483-491`) |
| `liberado_em` | date | não | — | — | Triagem, só se `liberado_por` vier preenchido (`_actions.ts:152`) | "Data da liberação" |
| `etapa` | text | sim* | `'definir'` | `definir\|levantamento\|andamento\|paralisado\|relatorio\|aprovarOS\|fecharOS\|pendFat\|faturado` (`sdd-sql-obras-v0.sql:84-86`) | importador (default `'definir'` quando a planilha não traz status, `importacao.ts:653`), Triagem (força `'levantamento'`, `_actions.ts:153`), `mudarEtapaAction` (troca manual na ficha, `_actions.ts:59-93`) | "Etapa atual" (`EtiquetaEtapa`) |
| `bloqueio` | text | não | `'Sem bloqueio'` | validado em app por `BLOQUEIOS` (`tipos.ts:174-182`), não por `check` no banco | importador (`importacao.ts:531`) **e** recalculado a cada resposta do diário (`diario/_actions.ts:275-292`, via `contadoresDoDiario`) | "Bloqueio atual" (`_ficha.tsx:564`) |
| `mau_uso` | boolean | sim* | `false` | — | importador, deduzido do STATUS MANFAC (`importacao.ts:300-305,435`) | "Classificação" → `EtiquetaMauUso` |
| `prioridade` | text | não | — | `Normal\|Urgente` — check no banco (`sdd-sql-obras-v0.sql:91`) | importador (`importacao.ts:533`) **e** Triagem, campo obrigatório (`_actions.ts:146`) | "Prioridade" (`EtiquetaPrioridade`) |
| `aprovacao` | date | não | — | — | importador — só Pipeline (coluna "AUTORIZAÇÃO", `importacao.ts:437`); Planejamento grava `null` (`importacao.ts:534`) | "Aprovada em" (`_triagem.tsx:177`) |
| `inicio_plan` | date | não | — | — | importador (`importacao.ts:535`) **e** Triagem, obrigatório (`_actions.ts:147`) | "Início planejado" (`_ficha.tsx:585`) |
| `inicio_real` | date | não | — | — | importador (`importacao.ts:537`) — **nenhuma tela do app grava isto hoje** | "Início real" (`_ficha.tsx:586`) |
| `duracao` | int | não | — | — | importador (calculado da diferença de datas, `importacao.ts:515-516,536`) **e** Triagem, obrigatório 1–180 (`_actions.ts:130,136,148`) | "Duração" (`_ficha.tsx:587`) |
| `fim_real` | date | não | — | — | importador (`importacao.ts:538`) — **nenhuma tela do app grava isto hoje** | (lido só via `marco_exec_fim`, não `fim_real`, na esteira) |
| `desde_etapa` | date | não | — | — | Triagem (`_actions.ts:154`) **e** `mudarEtapaAction` (`_actions.ts:75`) | não tem rótulo próprio; alimenta "Parada nesta etapa" |
| `marco_exec_fim` | date | não | — | — | **ninguém** — nenhuma Server Action grava (confirmado por grep; só leitura em `_ficha.tsx:139,149,266`) | usado para decidir se "Execução em campo" está `feito` na esteira |
| `marco_relatorio` | date | não | — | — | **ninguém** | marco da etapa "Relatório de entrega" na esteira |
| `marco_os_aprov` | date | não | — | — | **ninguém** | marco de "Pendente fechamento" |
| `marco_fechou_os` | date | não | — | — | **ninguém** | marco de "Fechar OS" |
| `marco_liberou_fat` | date | não | — | — | **ninguém** | marco de "Pendente faturamento" |
| `marco_faturou` | date | não | — | — | **ninguém** | marco de "Faturado" |
| `pendencia` | text | não | — | — | importador (`importacao.ts:539`) **e** Triagem (texto fixo, `_actions.ts:156`) | "Pendência" (`_ficha.tsx:772`) |
| `pend_resp` | text | não | — | — | importador (`importacao.ts:540`) **e** Triagem (`_actions.ts:157`, recebe o `resp` da triagem) | "Responsável" (pendência) |
| `pend_prazo` | date | não | — | — | importador (`importacao.ts:541`) | "Prazo" (pendência) |
| `prox_acao` | text | não | — | — | importador (`importacao.ts:518,542`) **e** Triagem (texto fixo, `_actions.ts:158`) | "Próxima ação" |
| `atualizacao` | date | não | — | — | importador (`importacao.ts:543`) **e** Triagem/`mudarEtapaAction` (`_actions.ts:76,155`) | "Última atualização" (`_ficha.tsx:776`) |
| `nao_andou_seguidos` | int | sim* | `0` | — | **calculado e gravado** pelo diário a cada resposta (`diario/_actions.ts:107,275-292`, função `contadoresDoDiario` em `tipos.ts:679-709`) | alimenta `paradaTxt` |
| `bloqueada_dias` | int | sim* | `0` | — | idem — mesmo recálculo | alimenta o "Xd" ao lado do bloqueio (`_table.tsx:51`) |
| `criado_por` | uuid (FK `auth.users`) | não | — | — | **ninguém** — nenhuma Server Action grava (confirmado por grep) | não exibido em nenhuma tela |
| `created_at` | timestamptz | sim* | `now()` | — | banco | não exibido |
| `updated_at` | timestamptz | não | — | — | trigger `obras_touch_updated_at` (`sdd-sql-obras-v0.sql:262-276`), só em `UPDATE`, nunca no `INSERT` | não exibido |
| `etapa_por` | text | não | — | — | `mudarEtapaAction`, com fallback se a coluna não existir ainda (`_actions.ts:44-48,81,85`) | não exibido na ficha hoje |
| `etapa_em` | timestamptz | não | — | — | idem | não exibido |

`*` = tem `NOT NULL`, mas também tem `DEFAULT`, então um `insert` que omita a coluna
**não falha** — o banco preenche sozinho.

---

## 2. O mínimo viável para inserir uma obra

**Campos estritamente obrigatórios para o `insert` não falhar: zero.**

Toda coluna `NOT NULL` de `obras_obra` tem `DEFAULT` (tabela acima, coluna
"Obrigatória"): `id`, `os_aprovada`, `etapa`, `mau_uso`, `nao_andou_seguidos`,
`bloqueada_dias`, `created_at`. Não há nenhum `check` que exija um valor não-nulo em
coluna nullable — os dois `check` existentes (`etapa`, `prioridade`) só restringem o
valor *quando* ele existir, e `prioridade` aceita explicitamente `is null`
(`sdd-sql-obras-v0.sql:91`). Logo `insert into obras_obra default values` é uma
instrução válida por si só. **Isto não é um limite útil para desenhar a tela** — é só
o piso técnico do Postgres.

### Campos que aceitam NULL mas quebram, escondem ou distorcem a obra numa tela

| Campo | Consequência de ficar `null` | Onde acontece |
|---|---|---|
| `loja` | Vira `—` como título H1 da ficha/Triagem e como texto do card no Kanban/lista mobile — numa base com muitas obras, a linha fica irreconhecível. | `_ficha.tsx:367`, `_triagem.tsx:129`, `_kanban.tsx:45`, `_table.tsx:97,162` |
| `os` | Vira `—` na coluna "Nº OS" e no card. Sozinho não quebra nada, mas ver abaixo (§4) — é a chave que decide se uma reimportação futura atualiza ou duplica a obra. | `_table.tsx:154-155`, `_kanban.tsx:44` |
| `aprovacao` | `diasDesde(aprovacao)` retorna `null` → `obra.dias` fica `null` para sempre. Duas consequências concretas: (1) `critico()` nunca fica `true`, mesmo que a obra fique parada 300 dias, porque a função testa `o.dias !== null && o.dias >= 100` — a obra NUNCA aciona o alerta vermelho que é a razão de existir do projeto. (2) a ordenação padrão da Base é por `dias` decrescente, e `ordenar()` empurra valor vazio sempre para o fim da lista, nos dois sentidos — a obra afunda para o final de uma base de ~190 linhas e fica de fato invisível na visão padrão. | `tipos.ts:427` (`critico`), `base/_regras.ts:222-239` (`ordenar`, regra de vazio nas linhas 230-235), `base/_regras.ts:209` (`ORDEM_PADRAO`) |
| `pcm` (Responsável) | Enquanto a obra não tem `pcm`, ela nunca aparece na fila de diário de ninguém: `diario/page.tsx:63` filtra `.eq('pcm', filtroPcm)` para todo usuário não-admin. Se a etapa for movida manualmente para `andamento`/`levantamento`/`paralisado` sem passar por Triagem (que sempre define `pcm`), a obra existe mas ninguém tem o dever de responder por ela — só o admin, que por padrão vê a fila sem filtro (`filtroPcm=''`), a enxerga. | `diario/page.tsx:59-63` |
| `etapa` fora de `'definir'` sem `desde_etapa`/`atualizacao` | Se um cadastro manual gravasse etapa diretamente numa etapa pós-campo (`relatorio`…`faturado`) pulando o fluxo normal (Triagem/`mudarEtapaAction`, que sempre setam `desde_etapa`), `paradaEtapa` fica `null` e `encalhada()` nunca fica `true` — a obra não aparece como "presa" mesmo estando de fato presa, e a "Parada nesta etapa" na ficha mostra `—`. Isto só é risco se o cadastro manual permitir escrever etapa diretamente; se ele só cria em `'definir'` e deixa a Triagem mover para `'levantamento'`, o problema não existe. | `tipos.ts:356-361` (`paradaNaEtapa`), `tipos.ts:458` (`encalhada`), `_ficha.tsx:430-437` |
| `duracao` | Sem duração, `diaDe`/`fracPrazo` ficam `null` e a tela escreve "sem prazo definido" em vez de barra de prazo — comportamento **desenhado**, não quebra nada; é o mesmo caminho que uma obra importada sem cronograma já segue. | `tipos.ts:392-401`, `_etiquetas.tsx:91-93` |
| `os_aprovada` (permanece `false`, nunca é escrita por código nenhum) | Combinado com `liberado_por` também nulo, `semCobertura()` fica `true` assim que a etapa sai de `'definir'` — a obra ganha a etiqueta vermelha "Sem cobertura", a mais grave da tela. Isto **não é exclusivo do cadastro manual**: é um gap sistêmico (nenhuma Server Action grava `os_aprovada` hoje, nem a importação nem a Triagem) — mas o cadastro manual herda o mesmo comportamento: se ninguém preencher "Liberado por" na Triagem, toda obra nova nasce "sem cobertura" ao sair de `'definir'`. | `tipos.ts:475-477` (`semCobertura`), confirmado por grep — zero ocorrências de escrita em `os_aprovada` em todo `app/obras/` |

---

## 3. O que a Triagem já resolve

`liberarObraAction` (`obra/[id]/_actions.ts:114-177`) grava, ao clicar "Liberar para o
diário do dia":

`pcm`, `equipe`, `prioridade`, `inicio_plan`, `duracao`, `liberado_por` (opcional),
`liberado_em` (opcional, só junto de `liberado_por`), `etapa` (força `'levantamento'`),
`desde_etapa`, `atualizacao`, `pendencia` (texto fixo), `pend_resp` (= `pcm`),
`prox_acao` (texto fixo).

A ação exige `etapa = 'definir'` no `where` da query (`_actions.ts:161`) — funciona em
**qualquer** obra que esteja em `'definir'`, seja ela vinda da importação ou de um
cadastro manual futuro. Não há dependência de a obra ter sido importada.

**Resposta: o cadastro manual pode ser mínimo para o bloco operacional (responsável,
equipe, prioridade, cronograma, pendência) — a Triagem já resolve esse pedaço inteiro,
sem precisar de nenhuma coluna nova nem de duplicar lógica.** Mas não pode ser mínimo
de verdade (criar só `id` + `etapa='definir'` e nada mais), por dois motivos que o
código deixa claros:

1. **A tela de Triagem não tem onde digitar identificação.** O bloco "O que veio do
   Field" (`_triagem.tsx:160-180`) é só leitura: `os`, `loja`, `descricao`, `tipo`,
   `valor`, `analista_cliente`, `origem`, `aprovacao` — ele assume que esses dados já
   existem, porque hoje só existem via importação. Uma obra sem `loja` chega à Triagem
   com o próprio título da tela em `—` (`_triagem.tsx:129`), e sem `os`/`descricao`/
   `tipo` o bloco inteiro fica em branco. O cadastro manual **precisa** coletar pelo
   menos `loja` (identidade mínima legível) e idealmente todo o conjunto que hoje só o
   importador preenche.
2. **`aprovacao` nunca é preenchido pela Triagem** — não está entre os cinco campos do
   checklist nem no par "Liberado por / Data da liberação". Se o cadastro manual não
   coletar essa data no momento da criação, ela fica `null` para sempre (nenhuma tela
   futura a define), e a obra nunca mais entra na conta de `dias`/`critico()` nem na
   ordenação padrão — ver a linha `aprovacao` da tabela do item 2. Isso é uma diferença
   de comportamento permanente frente às obras importadas, não um problema temporário
   que a Triagem resolve depois.

Em resumo: **a Triagem cobre o "definir a operação" (quem, quando entra em campo, por
quanto tempo) — o cadastro manual só precisa cobrir o "identificar a obra"
(`loja` no mínimo, mais `os`/`descricao`/`tipo`/`valor`/`analista_cliente`/`origem` se
disponíveis, e `aprovacao` para a obra se comportar como as demais nos indicadores de
tempo).**

---

## 4. A chave e a colisão

`os` tem índice único **parcial**: `create unique index ... on obras_obra (os) where os
is not null` (`sdd-sql-obras-v0.sql:242-243`) — várias linhas com `os is null` convivem
sem violar nada; só valores não-nulos precisam ser distintos entre si.

**Como o importador trata obra sem OS.** `normalizarOs` (`importacao.ts:165-170`) só
zera `os` quando o texto literal é `"SEM OS"` ou `"GARANTIA"` (comparado em
maiúsculas) — qualquer outro texto (mesmo truncado ou com dígito a mais) é preservado
como está, sem normalização de formato. Na orquestração (`importacao.ts:603-662`), uma
obra sem `os` só é **inserida** se a base estiver vazia (`baseVazia = idPorOs.size ===
0`, `importar/_actions.ts:129,160-167`); em qualquer reimportação seguinte, uma linha
sem `os` é **descartada** com o motivo explícito "sem Nº OS — só entra na primeira
carga, senão duplicaria a cada importação" (`importar/_actions.ts:161-166`). Ou seja:
**uma obra de cadastro manual sem OS nunca é tocada por reimportações futuras** — nem
atualizada, nem duplicada. É segura por construção.

**O que acontece se o cadastro manual criar uma obra COM uma OS que a planilha depois
trouxer de novo.** O casamento é por igualdade de texto exata. A cada importação,
`importar/_actions.ts:114-123` lê `select id, os from obras_obra where os is not null`
e monta um mapa `os → id` com **todas** as obras que já têm OS no banco, incluindo as
criadas manualmente — não é um mapa só das obras que vieram de importação. Para cada
linha da planilha, `importar/_actions.ts:131-133`:

```
const idExistente = obra.os ? idPorOs.get(obra.os) : undefined
```

- **Se o texto do `os` bater exatamente** com o que o cadastro manual digitou, a linha
  é tratada como já existente e vira `update` parcial (nunca sobrescreve com `null`,
  nunca reescreve `etapa`/`mau_uso` — `camposParaAtualizar`, `importacao.ts:680-690`).
  Isso preserva a triagem feita manualmente. **Este é o caminho seguro.**
- **Se o texto divergir em qualquer caractere** — espaço, zero à esquerda, hífen no
  lugar diferente, maiúscula/minúscula (`normalizarOs` só faz `.trim()`, não
  normaliza mais nada, `importacao.ts:169`) — `idExistente` fica `undefined`.
  `obra.os` é verdadeiro, então a linha passa direto pelo `if (!obra.os && !baseVazia)`
  (que só filtra os *sem* OS) e cai em `aInserir.push(campos)`
  (`importar/_actions.ts:160-169`). **O resultado é uma segunda linha no banco com o
  mesmo número de OS em formatação diferente — duplicata real, e o índice único não
  impede porque os dois textos são literalmente diferentes.**

**Consequência para o desenho da tela:** se o cadastro manual permitir digitar OS
livremente, o campo precisa reproduzir exatamente a convenção de formatação que a
planilha usa (o dicionário da planilha documentado em `importacao.ts:1-36` — padrão
`NNNN-NNNNNN`), ou orientar o usuário a copiar o texto tal como aparece no Field/no
sistema do cliente. Não há normalização de formato em nenhum dos dois lados que
resolva isso sozinha.

---

## 5. Estados que a tela vai precisar

Padrões confirmados nas telas existentes de `app/obras`:

| Estado | Como as telas existentes já fazem | Componente/padrão reutilizável |
|---|---|---|
| **Carregando / enviando** | `useTransition` + booleano `pendente`; botão desabilitado e texto trocado para o gerúndio ("Liberando…") enquanto a Server Action roda. | `_triagem.tsx:110,284-285` — sem componente de spinner dedicado em `_ui/primitivos.tsx`; é convenção só de texto+`disabled`. |
| **Erro de validação (client)** | A Triagem não mostra mensagem de erro para checklist incompleto — ela **desabilita o botão** (`disabled={faltam > 0}`) e cada campo tem um indicador visual próprio (círculo numerado cinza → check verde quando preenchido, componente `CampoTri`). Validação de intervalo (duração 1–180) é só `min`/`max` do `<input type="number">`, sem mensagem inline própria. | `_triagem.tsx:54-86` (`CampoTri`), `_triagem.tsx:272-280` (input com `min`/`max`) |
| **Erro de gravação (server)** | Toda Server Action segue a receita fixa do hub: nunca `throw`, sempre devolve `{error?: string}` em português (`obra/[id]/_actions.ts:9-13`, `diario/_actions.ts:6-9`). A tela guarda o erro em `useState` e renderiza uma linha vermelha (`text-[#ff4d6d]`) logo abaixo do botão de ação. | `_triagem.tsx:109,290` (`erro`/`setErro`); mesmo padrão em `diario/_actions.ts` (retorno `EstadoDiario`) |
| **Sem permissão** | Duas variações já existem: (1) genérica, uma linha dentro de `EstadoVazio` — usada na Base (`base/page.tsx:28-34`); (2) uma caixa completa com título, dois parágrafos explicando o motivo e um link de volta — usada no Diário (`diario/page.tsx:189-212`, componente local `SemPermissao`). Para uma tela nova de cadastro, a segunda é o padrão mais informativo e já reutilizável como referência de estrutura (não como componente compartilhado — está duplicada, não extraída). | `_ui/primitivos.tsx:151-157` (`EstadoVazio`) para o caso simples; `diario/page.tsx:189-212` como modelo de caixa completa |
| **Sucesso** | Não existe toast nem tela de sucesso dedicada em nenhuma tela do módulo. A Triagem, ao suceder, simplesmente navega embora (`router.push('/obras/base')`, `_triagem.tsx:121`) — o "sucesso" é implícito na saída da tela. | `_triagem.tsx:116-123` |
| **Lista/consulta vazia** | `EstadoVazio` — caixa com borda tracejada e texto centralizado, cinza. Usada para "nenhuma obra cadastrada", "nenhuma remarcação", "nenhum dia respondido". | `_ui/primitivos.tsx:151-157`; exemplos de uso: `base/page.tsx:66-68`, `_ficha.tsx:605,670` |
| **Erro de carregamento (consulta falhou)** | Mesma ideia do "sem permissão": ou dentro de `EstadoVazio` com texto específico (Base, `base/page.tsx:61-64`), ou uma caixa própria com título + explicação + botão "Tentar de novo" que é um `<a>` puro para forçar reload completo, não um `<Link>` (Diário, `diario/page.tsx:161-185`). | `diario/page.tsx:161-185` como modelo mais completo |

**Não existe hoje** um componente de campo de formulário compartilhado em
`_ui/primitivos.tsx` (não há `Input`/`Select`/`Textarea` genéricos). A Triagem define a
própria classe de input localmente (`INPUT`, `_triagem.tsx:51-52`) e a reaplica em cada
`<select>`/`<input>` manualmente — é o padrão mais próximo de "formulário" que o módulo
tem, e é o que um mockup de cadastro deveria reproduzir, não inventar um novo.

---

## 6. Tokens visuais em uso

Não propor paleta nova — tudo abaixo já está em uso e aprovado.

**Cores base** (`_ui/primitivos.tsx:17-24`, objeto `TEMA`):
- fundo: `#0a1628`
- navy (fundo de caixa): `#0d2050`
- accent (laranja): `#f05a28`
- texto: `#e8eef7`
- secundário: `#94a3b8`
- borda: `#1e3a5f`

**Cores de severidade** (não estão em `TEMA`, vêm de `COR_SEV`/comentários do mockup em
`tipos.ts:523-533`):
- crítico/erro: `#ff4d6d`
- atenção/warn: `#f4b73f`
- ok: `#35c98a`
- info: `#5aa9f0`
- apagado/encerrado: `#64748b`

**Componentes reutilizáveis** (`_ui/primitivos.tsx`):
- `Box` / `BoxH` / `BoxB` — caixa de conteúdo: `rounded-lg border border-[#1e3a5f]
  bg-[#0d2050] overflow-hidden`; cabeçalho com `border-b`, título 14px semibold,
  slot opcional `extra` à direita; corpo com `px-4 py-3`. (`primitivos.tsx:30-51`)
- `Pill` / `PillEtapa` / `PillSev` — etiqueta arredondada, cor em borda + texto, fundo
  na mesma cor a 18% (`${c}2e`) de opacidade. (`primitivos.tsx:61-90`)
- `Campo` / `Campos` — par rótulo (11px, uppercase, `#94a3b8`) / valor (14px,
  `#e8eef7`, ou `#64748b` + travessão quando vazio); `Campos` é um grid responsivo de
  2/3/4 colunas. (`primitivos.tsx:97-112`)
- `KPI` — cartão de indicador: número grande (20px semibold, cor customizável) + rótulo
  pequeno abaixo, dentro de `Box`-like container próprio. (`primitivos.tsx:124-144`)
- `EstadoVazio` — caixa de borda tracejada, texto centralizado cinza, para listas
  vazias e mensagens de acesso/erro simples. (`primitivos.tsx:151-157`)
- `Placeholder` — retângulo tracejado no lugar de imagem/documento ainda inexistente,
  duas alturas (`h-16` normal, `h-28` com `alto`). (`primitivos.tsx:164-174`)
- `Botao` — dois tipos: `principal` (fundo `#f05a28`, texto branco, hover
  `#d94d20`) e `secundario` (borda `#1e3a5f`, transparente, hover `#132a52`); estado
  `disabled` com opacidade 45%. (`primitivos.tsx:180-199`)
- Classe de input **não formalizada**, usada só pela Triagem: `w-full rounded-md
  border border-[#1e3a5f] bg-[#0a1628] px-2 py-2 text-sm text-[#e8eef7] outline-none
  focus:border-[#f05a28]` (`_triagem.tsx:51-52`).
- `CampoTri` — padrão de campo de formulário com indicador de preenchimento: caixa
  `rounded-md border border-[#1e3a5f] bg-[#0a1628] p-3`, círculo numerado (cinza,
  `#1e3a5f`/`#94a3b8`) que vira check verde (`#35c98a`) quando preenchido, rótulo ao
  lado, dica opcional em 11px cinza abaixo do campo. (`_triagem.tsx:54-86`) — é o
  componente mais próximo de "campo de formulário aprovado" que o módulo tem hoje.

**Espaçamento/layout de página:** container `mx-auto max-w-7xl px-4 py-6 sm:px-6`
(Base, `base/page.tsx:47`) ou `max-w-3xl` para telas de estado único (erro/sem permissão
do Diário, `diario/page.tsx:163,191`); blocos empilhados com `flex flex-col gap-4`;
formulários de duas colunas em telas largas via `grid grid-cols-1 gap-4
lg:grid-cols-2` (Triagem, `_triagem.tsx:158`; Ficha, `_ficha.tsx:475`).

---

## O que não deu para verificar

- Não verifiquei `base/_visao.tsx` nem `base/_filtros.tsx` em detalhe (só os arquivos
  pedidos no escopo) — se houver alguma dependência adicional de campo para a alternância
  Kanban/Tabela funcionar, não está coberta aqui.
- Não testei contra o banco real: a migration `sdd-sql-obras-v0.sql` está confirmada
  como **não aplicada em produção** (nota no topo de `AGENTS.md`), então tudo acima é
  leitura de código/schema-como-arquivo, não comportamento observado ao vivo.
