# Revisão de performance — páginas e actions do módulo Obras (06/10/2026)

Escopo: `app/obras/page.tsx`, `base/**`, `obra/[id]/**`, `painel/**`, `diario/**`, `tarefas/**`, `_lib/tipos.ts`.
Fora: middleware/auth/layout e RLS/índices (outras frentes). Só leitura; nada foi alterado.
Premissas medidas: navegador↔servidor ~0,7 s por ida; servidor↔banco rápido. Volume hoje: obras 241, histórico 1108, diário 26, tarefa 24.

Conclusão curta: **nenhuma página está lenta hoje por causa do volume de dados** (tudo é pequeno). A lentidão percebida vem mais do número de idas sequenciais antes de renderizar e do painel refazer tudo a cada clique. Mas há **três pontos que quebram de forma silenciosa ou dura quando o volume cresce**, e esses respondem à promessa "não pode ficar mais lento".

## Achados, por impacto

### 1. Base de obras lê a tabela inteira sem paginação — e o PostgREST corta em 1.000 linhas (silencioso)
- `app/obras/base/page.tsx:36` — `supabase.from('obras_obra').select('*')`, sem `.range`, sem filtro.
- O que acontece: traz todas as colunas (~55) de todas as obras, deriva todas no servidor e serializa todas para o componente client (`_visao.tsx`, `'use client'`), que filtra e ordena em memória.
- Custo hoje: 241 linhas; payload estimado na ordem de 100–150 KB (suspeita, não medi). Tolerável.
- Escala: 10x (2.400 obras) = **a lista é cortada em 1.000 sem erro** — os KPIs (`kpisDaBase`, :44) passam a mentir e obras somem da base sem aviso. Payload de 1 MB+ e render de 2.400 linhas/cards sem virtualização (`base/_table.tsx`, `_kanban.tsx`). 100x: inviável.
- O `painel/page.tsx:132-146` e `sincronizar/_execucao.ts:97-112` já paginam por causa do corte de 1.000; a Base e o Diário não.
- Correção: (a) imediata, `.range` em laço como no painel, para não cortar (P); (b) trocar `*` por lista explícita das ~25 colunas que tabela/kanban usam (M); a justificativa do painel (coluna `cliente` pode não existir) já não vale, `cliente` está em `ObraRow`; (c) estrutural: KPIs calculados no banco (view/RPC com `count ... group by etapa`) e lista filtrada/paginada no servidor via URL (G).
- Esforço: P para o corte, M para colunas, G para a solução definitiva.

### 2. Tarefas: `limit(500)` por `aberta desc` e `.in('id', idsObra)` com até 500 UUIDs
- `app/obras/tarefas/page.tsx:228-233` e `:240-244`.
- O que acontece: pega só as 500 tarefas abertas mais recentemente e filtra "cancelada" em JS (:268). A tarefa **aberta e vencida há mais tempo** é a que cai fora do corte e some da cobrança sem aviso. Depois monta `?id=in.(uuid,...)` na URL: 500 UUIDs ≈ 19 KB de URL, acima do limite típico de linha de requisição (8–16 KB) (**suspeita**: não testei o limite do gateway do Supabase; com ~200–400 obras distintas já tende a estourar).
- Custo hoje: 24 tarefas, zero. Escala: 10x (240) ainda cabe; em ~20–50x quebra por URL ou por truncamento.
- Correção: filtrar `situacao` e ordenar por prazo no banco (é o que a tela mostra: vencida primeiro); trazer a obra por relação embutida (`obras_obra!inner(os,loja,equipe,pcm,etapa)`) numa consulta só, em vez de `.in` de ids; limitar às abertas + respondidas dos últimos N dias. Esforço M.

### 3. Diário do dia: `.in('obra_id', ids)` sem teto, `select('*')`, consultas em série
- `app/obras/diario/page.tsx:62-64` — obras `*` sem `.range` (corte de 1.000 também); `:91-102` — `.in('obra_id', ids)`; para admin sem filtro, `ids` = todas as obras em campo, mesmo risco de URL longa do achado 2 (**suspeita** quanto ao limite); `:135` — admin faz segunda consulta a `obras_obra` só para listar `pcm` distintos.
- Esperas em série antes de renderizar: `getUser` → `isAdmin` → `hasSystemAccess` (:47-48, parte da frente de auth) → `resolverChave` (`_pessoa.ts:54`) → obras → `obras_pessoa` (:78) → diário+tarefas em paralelo → `pcm` distintos (:135). Cada ida servidor↔banco é rápida, então hoje custa pouco; mas `obras_pessoa`, `resolverChave` e a lista de `pcm` não dependem das obras.
- Correção: derivar `responsaveis` do array `linhas` já lido quando admin sem filtro (zero consulta extra) (P); paralelizar `obras_pessoa` e `resolverChave` (P); trocar `.in('obra_id', ids)` por filtro `data=eq.hoje` + junção em memória ou relação embutida (M); paginar a fila só se passar de ~200 obras em campo (G).

### 4. Painel gerencial: lê as 4 tabelas inteiras a cada clique de filtro/mês/comparação
- `app/obras/painel/page.tsx:148-153` (obras `*`, diário, tarefas, remarcações, cada uma em páginas de 1.000, sequenciais dentro da tabela) e `painel/_painel.tsx:58` (`router.push` a cada mudança → nova leitura completa + `montarPainel`, mais ~0,7 s de ida de rede).
- Hoje: 241 + 26 + 24 + poucas remarcações = 4 consultas rápidas. O **diário** cresce com (obras em campo × dias úteis): ~100 em campo × 22 dias ≈ 2.200 linhas/mês, ≈ 26.000/ano, ou ~27 idas sequenciais de `lerTudo`. Com 10x de dado ≈ vários segundos só de leitura; 100x inviável. O cálculo é barato (`historicoDe`, `_calculos.ts:845-860`, ~24 varreduras de `obras`, O(obras × meses)); o gargalo é a leitura, não a conta.
- Correção: (a) o diário só precisa dos ~13 meses que o painel exibe: `.gte('data', ...)` no banco (P, maior ganho: corta o crescimento histórico); (b) idem tarefas e remarcações por janela de data (P); (c) `select('*')` de obras para colunas usadas (M); (d) evitar nova leitura a cada clique: levar os dados ao cliente e recalcular lá, ou cache com tag invalidada nas escritas (M; conferir a API de cache em `node_modules/next/dist/docs` antes); (e) agregados em view SQL (G).

### 5. Ficha da obra: varre `obras_obra` inteira só para montar listas de opções
- `app/obras/obra/[id]/page.tsx:131` — `select('equipe, analista_cliente, cliente')` sem filtro nem `.range`; depois `unir` (:70-77, :176-192) deduplica em JS. O corte de 1.000 linhas também vale aqui (listas de opções incompletas, silencioso).
- Hoje: 241 linhas × 3 colunas curtas, ~15 KB, em paralelo com as outras 7 consultas, então custo baixo. 10x: ~150 KB lidos por abertura de ficha para gerar ~30 nomes; 100x: truncado e lento.
- Outros itens da mesma página: `:130` `obras_pessoa select('*')` (cresce com as equipes da importação); `:127` diário `select('*')` e `:144-148` histórico sem limite, ambos **por obra**, então só crescem com o tamanho da obra; vão inteiros como prop para o client (`Ficha`), e a linha do tempo renderiza tudo (`_ficha.tsx:932`; `_historico.tsx`). Risco baixo, médio só em obra com centenas de dias.
- Correção: lista de opções via view/RPC `select distinct` (ou tabela de domínio); para analistas, `.eq('cliente', ...)` no banco quando `pisoDoCliente` existe (P/M). Limitar o histórico (ex.: 50 recentes + "ver mais"); o rodapé "Editado por" (`ultimasEdicoes`) só precisa da última linha por bloco (M).

### 6. Fotos (signed URLs) — sem problema
- `obra/[id]/page.tsx:217-230`: só os últimos 8 caminhos, em lote único (`createSignedUrls`). Soma uma ida sequencial depois das 8 consultas, mas é limitado. `diario/_actions.ts:266` assina uma por vez sob demanda.

### 7. `revalidatePath` — amplo, sem custo relevante hoje
- `obra/[id]/_actions.ts:154-159, 410-411, 465-466, 489-492, 712-714`; `diario/_actions.ts:133-134, 248-249`; `tarefas/_actions.ts:55-56`; `sincronizar/_execucao.ts:297-299` (a cada sync incremental de 5 min).
- Todas as páginas do módulo são `force-dynamic`, então não há cache de rota no servidor a invalidar; o efeito é limpar o cache de rotas do cliente. **Suspeita**: não confirmei no doc do Next desta versão se revalidar `/obras/base` força re-render pesado na próxima navegação. Irrelevante enquanto a base for pequena; relevante depois do achado 1.
- Correção: nenhuma agora; revalidar por tag ao resolver o achado 1. Prioridade baixa.

### 8. N+1 e contadores — sem achado nas telas
- `diario/_actions.ts:290-299` (`recalcularContadores`): `limit(60)` e um update por obra, ok. Nenhuma consulta dentro de laço nas páginas do escopo. (`sincronizar/_execucao.ts:244,261` atualiza obra a obra em laço, mas é job de fundo, fora do escopo.)

## Prioridade sugerida
1. P: paginar `base/page.tsx` e `diario/page.tsx` para não cortar em 1.000 (bug latente, não lentidão) e janela de data no painel (diário, tarefas, remarcações).
2. M: tarefas (achado 2): filtro e ordenação no banco, obra embutida.
3. M: lista de opções da ficha sem varrer a tabela.
4. G (decidir com o João): Base com KPIs e paginação no servidor.

Antes de corrigir: medir o tempo real por página (Server-Timing ou log). Os dados atuais são pequenos demais para explicar a lentidão que o dono percebe; a causa provável é o número de idas e o payload RSC a cada navegação/ação, o que cabe às outras frentes (auth/layout/índices) e a esta no que toca ao painel e ao diário.
