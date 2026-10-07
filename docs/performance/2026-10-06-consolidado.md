# Revisão de performance — consolidado (06/10/2026)

Pedido: `docs/cliente/2026-10-06-pedido-revisao-performance.md`. Relatórios completos nesta pasta:
`revisao-caminho-comum.md`, `revisao-paginas-obras.md`, `revisao-banco.md`.
Os itens marcados ✔ foram conferidos pela sessão principal em produção ou no código.

## Fatos medidos
- Servidor do hub em Boston (Hostinger) e Supabase em us-east-1: servidor↔banco é rápido.
- Navegador no Brasil ↔ servidor: ~0,7 s por ida e volta. Um redirect de `/obras` sem login leva 0,7–0,9 s.
- Volume: obras_obra 241, obras_historico 1.108, obras_sync_execucao 6.031 (+~288/dia).
- ✔ `max_rows` do PostgREST = **1000**: consulta sem paginação é cortada **em silêncio**.

## Achados, por impacto

| # | Achado | Hoje | Com 10x dados | Esforço | Tipo |
|---|---|---|---|---|---|
| 1 | ✔ RLS de `obras_*` (e Sofia) chama `obras_has_access()` sem `(select …)`: a checagem roda por linha | médio | alto | P | migration RLS |
| 2 | ✔ Base (`base/page.tsx:36`) `select('*')` da tabela inteira; ficha (`obra/[id]/page.tsx:131`) varre todas as obras para montar listas; Painel lê 4 tabelas inteiras a cada filtro; Diário sem `.range` | baixo | **dado cortado em 1000 sem erro** + lento | M | código |
| 3 | ✔ Só o Diário tem `loading.tsx`: Base, Tarefas, Painel e Ficha ficam paradas até tudo carregar | alto (percepção) | alto | P | código |
| 4 | ✔ Card do hub aponta para `/obras`, que só redireciona para `/obras/base`: +1 ida (~0,7 s) | alto | alto | P | código |
| 5 | ✔ Faixa de comunicados busca no navegador depois de abrir a tela: +1 ida em toda carga | alto | alto | M | código |
| 6 | Auth repetida em série (getUser + roles + acesso, várias vezes por tela); dashboard faz 11 consultas para não-admin | médio | médio | P/M | código |
| 7 | Tarefas: `limit(500)` ordenado de forma que a tarefa vencida há mais tempo é a que cai fora | baixo | alto | M | código |
| 8 | ✔ Cockpit (app separada, mesmo banco): view `v_sync_health` ~2 s por chamada, 21,6 mil chamadas, 40% do tempo de banco | — | — | ? | outro sistema |
| 9 | `obras_sync_execucao` sem retenção; RPC `obras_iniciar_sync_execucao` média 41 ms, máx. 708 ms | baixo | médio | P | migration |

## Proposta de pacotes
- **Pacote 1, percepção imediata (só código, P):** itens 3, 4, 6 e 5.
- **Pacote 2, o banco (migration de RLS, P, território de exceção):** item 1 em Obras e Sofia, medindo antes e depois.
- **Pacote 3, crescimento (código, M):** itens 2 e 7, com paginação, filtros no banco e janela de data no painel.
- **Pacote 4, Cockpit:** item 8. A decisão é de quem cuida do Cockpit.
- **Pacote 5, retenção:** item 9.

## Execução (07/10/2026)
- **Pacote 3** (leitura paginada, tarefas sem limit): no ar no build de 07/10 03:50 UTC.
- **Pacote 2** (RLS initplan): aplicado em 07/10. Acesso idêntico antes/depois em 4 perfis;
  `select * from obras_historico` como usuário 148 ms → 1,5 ms.
- **Pacote 1** (loading, card, auth deduplicada, faixa no servidor): mergeado, aguardando deploy próprio.
- Fora do escopo: Cockpit (responsável Jose Guilherme), refetch do painel por clique, paginação visível da Base.
