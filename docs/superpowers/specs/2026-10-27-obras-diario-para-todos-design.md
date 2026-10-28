# Spec — Diário do dia liberado para todos (Gestão de Obras)

**Data:** 27/10/2026 · **Fonte:** `docs/cliente/2026-10-27-obras-diario-liberar-para-todos.md` (literal)
**Mockup:** `docs/cliente/2026-08-31-sistema-controle-de-obras/mockup-diario-para-todos-2026-10-27.html`
(publicado em https://claude.ai/artifact/33oQv3XjW7NZZ3fFFufbEv)

## Decisões (João, 27/10/2026, "prossiga" após o mockup e as perguntas)

- D1. "Todos" = **qualquer pessoa com acesso a Gestão de Obras** (`hasSystemAccess(..., 'obras')`) ou admin.
- D2. Migration com **duas colunas novas** em `obras_diario`: `registrado_por_email text` e
  `atualizado_em timestamptz`, ambas nullable, sem default. Respostas antigas ficam sem rótulo.
- D3. "Em nome de" **só no diário**, não na ficha da obra (fica como pergunta ao cliente).
- D4 (minha, declarada no mockup). Filtro padrão: quem é `pcm` de alguma obra da fila abre nas suas;
  quem não é (e o admin) abre em "todos".

## Por quê

Hoje só o responsável (`pcm`) vê e responde o diário das suas obras; o cliente pôs uma pessoa só para
o diário e ela cai na tela "Esta tela é de quem é responsável pelas obras". A RLS (`obras access`) e
`salvarDiarioAction` já aceitam qualquer pessoa com acesso ao módulo — a trava é só de leitura em
`app/obras/diario/page.tsx`.

## O que muda

### 1. Banco — `sdd-sql-obras-diario-autoria.sql` (raiz)

Padrão de `.claude/rules/sql.md`: `begin/commit`, seção 0 que aborta se `obras_diario` não existir,
`add column if not exists` das duas colunas (nullable, sem default, sem índice, sem GRANT novo, RLS e
policy inalteradas), bloco de verificação pós-commit com uma linha `OK`/`*** FALHOU ***` por invariante
(colunas existem com o tipo certo, nullable; RLS ligada; policy `obras access` existe e é a única).
Arquivo de rollback não precisa: o rollback é `drop column` das duas, **só depois** de reverter o código
— escrever isso em comentário no topo.

**Ordem de deploy:** a migration vai ANTES do deploy (código novo grava as colunas; sem elas o upsert falha).

### 2. Gravação — `app/obras/diario/_actions.ts` (`salvarDiarioAction`)

No upsert, gravar também `registrado_por_email: user.email` e `atualizado_em: new Date().toISOString()`.
Corrigir a resposta (upsert de novo) sobrescreve as duas — vale quem salvou por último. Nada mais muda na
action (a checagem de acesso já é `hasSystemAccess`).

### 3. Leitura — `app/obras/diario/page.tsx`

- Porteiro: `admin || hasSystemAccess('obras')` (como hoje). Quem não passa → `SemPermissao` com o texto
  novo do mockup (seção 4c), **sem** o botão "Ver a base de obras".
- Remover a regra "não-admin sem chave → SemPermissao" e "não-admin sem obra → SemPermissao": agora
  liberar é a intenção. A guarda que continua tendo que falhar fechada é a de acesso ao módulo.
- `searchParams.analista`: ausente → padrão da pessoa (D4); `todos` → sem filtro; outro valor → `pcm`
  igual ao valor. Para decidir o padrão de não-admin: se `minhaChave` for `pcm` de alguma obra na fila
  (`ETAPAS_FILA_DIARIO`), filtra por ela; senão, todos. Admin sem parâmetro = todos (como hoje).
- Lista de responsáveis do seletor passa a ser montada **para todos**, não só para admin (mesma fonte de
  hoje: `pcm` distintos das obras na fila).
- Filtro sem obra nenhuma → estado vazio do mockup (4a), não `SemPermissao`.
- Selecionar também `registrado_por_email, atualizado_em, created_at` de `obras_diario` e passar ao
  cliente o rótulo pronto por obra: `{ por: string, emNomeDe: string | null, hora: 'HH:MM' }` ou nada
  (resposta antiga sem e-mail). Nome de quem respondeu: `obras_pessoa.nome` (primeiro nome) pelo e-mail;
  sem cadastro, o local-part do e-mail antes do primeiro `.`, capitalizado. Nome do responsável:
  primeiro nome de `obras_pessoa` pela chave `pcm`, senão a própria chave capitalizada. `emNomeDe` é
  `null` quando quem respondeu é o próprio responsável (compare por chave: `resolverChave` do e-mail ===
  `pcm`, ou e-mail igual ao de `obras_pessoa` do `pcm`). Hora: `atualizado_em ?? created_at`, em BRT.

### 4. Tela — `app/obras/diario/_cartoes.tsx` / `_cartao.tsx`

- Seletor "Diário de quem" visível para todos, com opção "Todos os responsáveis" (`?analista=todos`).
- Para não-admin, a nota abaixo do seletor do mockup: "Você vê as obras de todos os responsáveis e pode
  responder no lugar deles. Fica registrado quem respondeu."
- No cartão já respondido ("Já respondidas"): "Respondido por **X** às HH:MM" ou
  "Respondido por **X** em nome de **Y** às HH:MM" (Y em laranja `#f05a28`), como no mockup seção 3.
- Logo após salvar, o rótulo aparece com o usuário atual (o `revalidatePath` já recarrega).
- Agendar continua restrito a `pcm` ou admin (`podeMexerNoAgendamento`), sem mudança. Se hoje o botão
  aparece para quem não pode, esconda-o para essa pessoa — não deixar botão que só devolve erro.

## Fora do escopo

Ficha da obra, e-mail do relatório diário, Painel, tarefas, agendamento (regra), qualquer outra tabela.

## Testes (obrigatórios)

- `page.test.tsx`: não-pcm com acesso vê todas; pcm abre nas suas; `?analista=todos` mostra todas para
  pcm; sem acesso ao módulo → SemPermissao novo; filtro vazio → estado vazio; rótulo com e sem "em nome
  de"; resposta antiga sem e-mail → sem rótulo.
- Teste da action: upsert inclui `registrado_por_email` e `atualizado_em`.
- `npm test` (as 106 suites do hub), `npm run lint`, `npx tsc --noEmit`, `npm run build`.
