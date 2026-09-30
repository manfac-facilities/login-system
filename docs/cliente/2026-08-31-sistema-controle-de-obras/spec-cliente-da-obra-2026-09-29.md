# Spec — coluna "cliente" na obra, preenchida pela sincronização (29/09/2026)

Decisão: cliente respondeu "2- sim" (`docs/cliente/2026-09-28-dashboard-gerencial-pedido-joao.md`): criar a
coluna, preenchida pela sync a partir do Field, trazendo as OS "Atividade Spot" de TODOS os clientes.
Fatos: `levantamento-criar-os-field-2026-09-28.md` §10 — na conta Field o tipo "Atividade Spot" é usado por
DPSP (85/100 recentes), D1000 (13/100) e 2 pontuais; a sync filtra só por `service_id`, sem `customer`.

## Migration (manual; o coordenador aplica — NÃO aplicar)
Arquivo novo `sdd-sql-obras-cliente.sql` na raiz, idempotente, seguindo `.claude/rules/sql.md`:
- `alter table public.obras_obra add column if not exists cliente text;`
- índice em `cliente` se o painel for filtrar por ele;
- nada de mexer em RLS (coluna nova herda as policies da tabela) — mas confirmar lendo as policies.
- bloco de verificação no fim (select que devolve 'OK' por item), no padrão das outras migrations.

## Código
1. `app/obras/_lib/field/`: resolver o NOME do cliente a partir de `customer.id` da OS (`GET /customers/:id`,
   com cache por id na varredura, respeitando o limitador de 1 req/s de `http.ts`). Expor em `OsNormalizada`
   como `cliente: string | null`. Padrão igual ao resolvedor de loja (`loja.ts`).
2. `app/obras/sincronizar/_sincronizacao.ts`: gravar `cliente` na obra NOVA e **preencher em obra existente
   quando estiver vazio** (mesma regra dos outros campos que vêm do Field — conferir como fazem). Assim a
   próxima varredura completa preenche as 77+ obras já no banco, sem backfill manual.
3. `tipos.ts`: `cliente: string | null` em `ObraRow`.
4. Se o código atual descarta OS de algum cliente (não deveria — confirmar), deixar entrar todos.
5. Testes: normalização com cliente, cache (1 GET por cliente distinto), sync preenche vazio e não sobrescreve.

## Fora de escopo
Painel, ficha, Base (a coluna aparece no painel depois). Filtro por cliente na Base: não.
## Atenção
Com a coluna aplicada ANTES do deploy do código, nada quebra (só acrescenta). Código sem a coluna aplicada
QUEBRA a gravação da sync — ordem obrigatória: migration primeiro, depois deploy.
