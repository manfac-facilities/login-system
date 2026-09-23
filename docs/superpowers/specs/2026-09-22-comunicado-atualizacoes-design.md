# Comunicado de atualizações — spec + plano (22/09/2026)

**Fonte e decisões:** `docs/cliente/2026-09-22-audio-joao-comunicado-de-atualizacoes.md` (áudio literal,
decisões e aprovação do mockup). **Mockup aprovado:**
`docs/cliente/2026-08-31-sistema-controle-de-obras/mockup-comunicado-atualizacoes-2026-09-22.html`.
**Schema:** `sdd-sql-hub-comunicados.sql` (revisado e aprovado; aplicação feita pelo coordenador,
fora desta tarefa).

## Escopo (régua: menor mudança)

Duas peças. Nada de tela de administração, nada de envio de e-mail dentro do app.

### Peça 1 — Faixa "Novidade" no Controle de Obras

- Componente client `app/obras/_ui/faixa-comunicados.tsx`, montado em `app/obras/layout.tsx` entre o
  `<header>` e `{children}`. Visual e textos de interface **iguais ao mockup** (seção 1): ícone,
  título, selo "novidade", texto curto, "ver o que mudou"/"ocultar o que mudou" que expande o
  detalhe, botão "Entendi", chip "+1 novidade" (ou "+N novidades") que abre as demais abaixo.
  Tema em hex literal Tailwind, como o resto do módulo.
- Server Actions em `app/obras/_comunicados-actions.ts` (`'use server'`), usando
  `createClient` de `lib/supabase/server.ts` (sessão do usuário; **a RLS é quem filtra** — não
  replicar filtro de acesso no código e nunca usar o client admin/service role):
  - `listarComunicadosNaoLidos()`: lê `hub_comunicados` com `sistema = 'obras'`, exclui os que o
    usuário já tem em `hub_comunicados_lidos` (user_id = usuário da sessão), ordena por
    `publicado_em desc`. Em erro, devolve lista vazia (a faixa simplesmente não aparece).
  - `marcarComunicadoLido(id: string)`: insere em `hub_comunicados_lidos` (`comunicado_id`,
    `user_id` da sessão). Chave duplicada (23505) conta como sucesso. Outro erro → `{ ok: false }`.
- Comportamento:
  - Sem comunicados → nada renderiza, sem espaço reservado.
  - "Entendi" marca como lidos **todos os não lidos da faixa** (a pessoa confirma a faixa
    inteira). Sucesso → faixa some.
  - Falha ao marcar → faixa continua e mostra o aviso discreto do mockup ("Não deu para salvar sua
    confirmação agora…").
  - O `corpo` do comunicado é texto puro com uma linha por item do detalhe (split em `\n`);
    **renderizar como texto, nunca `dangerouslySetInnerHTML`**. O `titulo` é o título; o texto curto
    é a primeira linha do corpo, e as demais linhas viram a lista do "ver o que mudou".
- Tipos no próprio arquivo de actions (um único uso — sem abstração).

### Peça 2 — Script de envio do e-mail

- `scripts/enviar-comunicado.mjs <comunicado_id> [--enviar]`. Sem `--enviar` é **simulação**:
  imprime destinatários (só a contagem e os e-mails) e o e-mail renderizado; não envia.
- Lê o comunicado e os destinatários pela Management API (PAT em `C:\Users\joao-\.supabase-pat`,
  padrão de `.claude/rules/sql.md`): destinatários = `hub_system_access` com `system_slug` do
  comunicado e `has_access = true`, **mais** usuários com `hub_user_roles.nivel = 'administrador'`,
  e-mails em minúsculas e sem repetição.
- Envia pela API da Resend (`https://api.resend.com/emails`, chave em `C:\Users\joao-\.resend-key`),
  um e-mail por destinatário (não usar CC/BCC coletivo), remetente
  `Controle de Obras <avisos@manfac.com.br>`, assunto = `titulo`, corpo HTML simples igual à seção 2
  do mockup (lista das linhas do corpo + botão "Abrir o Controle de Obras" →
  `https://hub.manfac.com.br/obras`) e versão texto. Escapar HTML de todo texto vindo do banco.
- Nunca imprimir o PAT nem a chave. Ler ambos com `.trim()`.
- Sem Python na máquina; Node 20.

## Fora do escopo (registrar em `docs/DIVIDAS.md` se surgir)

Faixa em outros sistemas do hub, histórico de comunicados, tela de administração, retry automático.

## Testes (jest, `__tests__/` ao lado)

- `app/obras/_ui/__tests__/faixa-comunicados.test.tsx`: sem comunicado não renderiza; 1 comunicado
  mostra título/texto e expande o detalhe; 2 comunicados mostra "+1 novidade" e abre o segundo;
  "Entendi" com sucesso esconde; "Entendi" com falha mantém e mostra o aviso; corpo com `<b>` aparece
  como texto literal.
- `app/obras/__tests__/comunicados-actions.test.ts`: filtra lidos; 23505 conta como sucesso; erro de
  leitura devolve lista vazia.
- Script: função pura de montar destinatários (dedupe/minúsculas) e de renderizar o HTML (escape)
  exportadas e testadas.

## Pronto quando

`npm test` (as 82 suítes do hub) e `npm run lint` e `npm run build` passam; commit em branch próprio.
