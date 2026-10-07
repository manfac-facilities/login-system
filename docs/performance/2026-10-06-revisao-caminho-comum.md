# Revisão de performance — caminho comum de toda requisição (06/10/2026)

Escopo: middleware.ts, lib/supabase/**, lib/auth/**, app/obras/layout.tsx, faixa de comunicados, app/(dashboard)/**, e o padrão de auth nas páginas de /obras. Só leitura. Next 16.2.11 (nesta versão `middleware` está deprecado e renomeado para `proxy`; docs: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).

Premissa de custo: servidor↔Supabase é rápido (estimo 5–30 ms por consulta; NÃO medi). O round-trip navegador↔servidor custa ~0,7 s (medido pelo João). Pesam mais o número de idas do navegador e o de consultas SEQUENCIAIS no servidor.

## Mapa do que acontece hoje ao abrir /obras/diario (analista, não admin)

- Middleware (middleware.ts:35-37, 87-92): getUser → hasSystemAccess → isAdmin (hub_user_roles) → hub_system_access. 3–4 chamadas em série.
- Página (diario/page.tsx:43-51): getUser de novo → isAdmin → hasSystemAccess (que chama isAdmin DE NOVO + hub_system_access) → resolverChave. 5 em série.
- Depois: obras_obra → obras_pessoa → (obras_diario + obras_tarefa em paralelo) → [admin] obras_obra de novo para listar responsáveis.
- Depois de hidratar: o navegador dispara a Server Action listarComunicadosNaoLidos (nova ida de ~0,7 s) com getUser de novo + 2 consultas.

Total ≈ 14–15 chamadas ao Supabase por abertura de tela, ~9 só de autenticação/autorização, quase todas em série.

## Achados, por impacto

### 1. Faixa de Comunicados busca no cliente depois de carregar (cascata) — ALTO
- app/obras/_ui/faixa-comunicados.tsx:29-31 (useEffect → Server Action) + app/obras/_comunicados-actions.ts:27-45; montada em app/obras/layout.tsx:81, ou seja, em toda tela de /obras.
- Acontece: só depois de baixar o JS e hidratar o navegador faz um POST de Server Action. Custo: +1 round-trip do Brasil (~0,7–0,9 s) + getUser + 2 consultas, em toda carga completa da página (na troca de aba o layout persiste e não remonta, então o custo é por carga/reload, não por clique). Suspeita: Server Actions são enfileiradas uma por vez pelo Next; se for o caso, a primeira ação do usuário logo após carregar espera a da faixa (não confirmei na doc).
- Escala: custo fixo por carga; a consulta cresce com comunicados e lidos: actions.ts:42-44 baixa TODOS os comunicados publicados e TODOS os lidos do usuário e filtra em memória.
- Correção: faixa como Server Component (ou Client recebendo dados por prop), buscando no servidor em paralelo à página dentro de `<Suspense fallback={null}>`; filtro "não lido" no banco. Só o botão "Entendi" fica no cliente.
- Esforço: M (layout é 'use client' só por causa do usePathname; extrair as abas para um componente cliente pequeno e deixar o layout no servidor).

### 2. Autorização repetida e em série: middleware + página + ação — ALTO
- middleware.ts:35 e :87-92; páginas: base/page.tsx:26-28, diario/page.tsx:43-48, tarefas/page.tsx:35-40, painel/page.tsx:46-49, obra/[id]/page.tsx:106-108; actions: diario/_actions.ts:68-70, :232-234, :262-264 (mesma receita nas demais).
- Acontece: a checagem roda 2x por navegação (middleware e página). `hasSystemAccess` (lib/auth/systemAccess.ts:11) chama `isAdmin` por dentro e as páginas diario, tarefas e painel já chamaram `isAdmin` antes: a consulta a hub_user_roles roda DUAS vezes no mesmo request. A consulta de acesso só começa depois da de roles (série).
- Custo hoje: ~9 chamadas de auth por abertura de tela. A ~10–30 ms cada seriam 90–270 ms de servidor (estimativa).
- Escala: independe do volume de dados; cresce linear com usuários simultâneos (cada entrada gera ~9 consultas só de auth).
- Correção (menor mudança): (a) `cache()` do React para getUser/getNivel por request, compartilhado entre layout, página e faixa; (b) `hasSystemAccess` buscar roles e acesso em `Promise.all`, ou uma RPC única devolvendo `{admin, tem_acesso}`; (c) nas páginas, tirar o `isAdmin` avulso e reaproveitar. NÃO remover o getUser do middleware nem a checagem da página (defesa em profundidade; autorização é exceção da régua do AGENTS.md); Server Actions mantêm checagem própria.
- Esforço: P a M. Território de autorização: exige teste (lib/auth/__tests__ existe).

### 3. loading.tsx só existe no Diário: demais abas ficam "congeladas" — ALTO (percepção)
- Só app/obras/diario/loading.tsx. Faltam em base, tarefas, painel, obra/[id]; não há app/obras/loading.tsx nem app/loading.tsx.
- Acontece: todas as páginas são force-dynamic (base:20, diario:33, tarefas:29, painel:35). Sem loading.tsx, ao clicar numa aba a tela antiga fica parada até chegar a resposta completa (0,7 s de rede + auth + dados). Suspeita (não testei no navegador): em rota dinâmica sem loading.tsx o prefetch dos `<Link>` das abas (layout.tsx:62-77) não traz conteúdo útil.
- Escala: quanto mais dados, mais longa a tela parada.
- Correção: `app/obras/loading.tsx` genérico (serve a todas as abas) e `<Suspense>` em torno das partes pesadas (tabela, gantt) para cabeçalho e KPIs aparecerem antes.
- Esforço: P.

### 4. /obras → redirect → /obras/base: salto extra de ~0,7 s na entrada — MÉDIO
- app/obras/page.tsx:12 (`redirect('/obras/base')`); o card do hub aponta para `/obras` (app/(dashboard)/dashboard/page.tsx:170).
- Acontece: clique no card = /obras (middleware + render) → 307 → /obras/base (middleware + render). Dois round-trips do Brasil e o middleware inteiro duas vezes.
- Correção: card apontar direto para `/obras/base` (manter /obras como atalho). Uma linha.
- Esforço: P.

### 5. Layout 'use client' em todo o módulo — BAIXO/MÉDIO
- app/obras/layout.tsx:1. Não torna as páginas cliente (children seguem Server Components) e o bundle extra é pequeno, mas impede o layout de carregar dados no servidor (causa do achado 1).
- Correção: junto com o achado 1. Esforço: M (embutido).

### 6. Dashboard: isAdmin + 5x hasSystemAccess — MÉDIO
- app/(dashboard)/dashboard/page.tsx:21-30. Para não-admin: 1 (roles) + 5 em paralelo, cada um repetindo isAdmin por dentro = 11 consultas na porta de entrada de todo mundo.
- Correção: uma consulta em hub_system_access (`eq user_email`, lista de slugs) em paralelo com a de roles = 2 consultas.
- Esforço: P.

### 7. Consultas em série nas páginas que poderiam ser paralelas — MÉDIO
- diario/page.tsx: resolverChave (:51) → obras_obra (:62-64) → obras_pessoa (:78) → diario+tarefas (:91) → obras_obra de novo (:135, só admin, para listar `pcm` distintos; dá para derivar de `linhas` quando admin sem filtro). obras_pessoa não depende das obras e pode ir em Promise.all com elas.
- tarefas/page.tsx: obras_pessoa (:72) independe de :44 e :57.
- Custo: 3–5 consultas em série ≈ 30–100 ms (estimativa); pouco contra os 0,7 s de rede, mas piora com o banco mais carregado.
- Esforço: P cada.

### 8. Leitura de tabela inteira / sem limite — MÉDIO hoje, ALTO com 10x (é o centro do pedido do dono)
(A frente de dados é de outro revisor; registro só o que apareceu no caminho comum.)
- base/page.tsx:36 `select('*')` de obras_obra sem filtro nem paginação: 241 linhas hoje. Suspeita (não verifiquei a config do projeto): o PostgREST do Supabase corta em 1000 linhas por padrão; com mais de 1000 obras a Base mostraria MENOS obras sem erro. Seria erro de dado, não só de velocidade.
- painel/page.tsx:62-79 lê obras_obra, obras_diario, obras_tarefa, obras_remarcacao INTEIRAS (páginas de 1000, em série dentro de cada tabela) a cada abertura. Cresce linear; obras_diario cresce todo dia. É o item que mais degrada com o tempo.
- diario/page.tsx:62 `select('*')`; obra/[id]/page.tsx:131 busca equipe/analista_cliente/cliente de TODAS as obras só para montar listas de sugestão, a cada abertura de ficha.
- Correção: colunas explícitas em vez de `*`; agregar no banco (view/RPC para os KPIs do painel); `distinct` nas listas de opções.
- Esforço: M a G.

### 9. Cada Server Action refaz createClient + getUser + hasSystemAccess — BAIXO/MÉDIO
- diario/_actions.ts:65-70 (idem :229-234, :259-264). Cada ação paga a ida do navegador + ~4 consultas de auth; o item 2(b) reduz. Depois, `revalidatePath` (28 usos no módulo) re-renderiza a rota inteira repetindo toda a cascata do item 7 na mesma resposta. Suspeita: não medi o tempo de uma action.

### 10. Verificado e sem problema
- middleware.ts: matcher restrito às rotas necessárias; não roda em estáticos nem em /api/obras; Cockpit/Financeiro ficam fora, como manda o AGENTS.md.
- Fotos: URLs assinadas em lote numa chamada (obra/[id]/page.tsx:224).
- `createClient()` em lib/supabase/server.ts não faz rede; a rede está no getUser().
- next.config.ts só define cabeçalhos; nada que degrade.
- `force-dynamic` é redundante (cookies() já torna dinâmico) mas inofensivo.
- NÃO verificado (suspeita): tamanho do bundle do cliente (não rodei build/análise), compressão/HTTP2 no proxy do EasyPanel, Cache-Control de /_next/static. Medir antes de agir.

## Ordem de ataque sugerida (retorno por esforço)
1. app/obras/loading.tsx (item 3) — P, melhora a percepção na hora.
2. Card do hub direto para /obras/base (item 4) — P, tira 1 round-trip de ~0,7 s.
3. Faixa de comunicados no servidor com Suspense (item 1) — M, tira 1 round-trip de ~0,7 s de toda carga.
4. Dedupe/paralelizar auth com cache() + Promise.all (itens 2 e 6) — P/M, corta mais da metade das consultas de auth.
5. Cascata de consultas nas páginas (item 7) — P.
6. Painel e Base: agregar no banco e limitar colunas (item 8) — M/G; é o que impede a lentidão de crescer com os dados. Verificar já se a Base tropeça no corte de 1000 linhas.

Ganho estimado dos itens 1–5 numa tela comum: ~1,4–1,8 s a menos de espera (dois round-trips de 0,7 s eliminados + 100–250 ms de servidor) e fim da tela parada sem feedback. Estimativa, não medida.
