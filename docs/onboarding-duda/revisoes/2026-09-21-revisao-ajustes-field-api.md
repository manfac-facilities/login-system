# Revisão independente — branch `duda/field-api-client` (21/09/2026)

Escopo: `git diff origin/master...origin/duda/field-api-client` — 18 arquivos, commits `2ee819b` e `42e40d4`.
Mensagem do Duda: `docs/onboarding-duda/entregas/2026-09-21-ajustes-field-api-mensagem-do-duda.md`.
Método: leitura do código (não do relato) + **teste de mutação**: em worktree descartável, cada arquivo-fonte
corrigido foi revertido para `origin/master` e o teste correspondente foi rodado, para provar que o
teste falha sem a correção. Worktree removido ao final; a árvore do repositório principal não foi tocada.

**Veredito: pode mergear. Nenhum bloqueante.** Duas conferências são obrigatórias antes do deploy (seção 3).

---

## 1. Os 7 itens

| # | Item | Implementado | Teste cobre | Falha sem a correção? (mutação) |
|---|---|---|---|---|
| 1 | OS concluída/cancelada que reaparece limpa `field_ausente_desde` e `field_ausente_em` | **Sim** — `app/obras/sincronizar/_sincronizacao.ts:235-246` (limpa só as duas colunas, por `field_id`, sem recarregar loja/descrição) | **Sim** — `sincronizar/__tests__/_sincronizacao.test.ts:457` (done e canceled, com alerta) e `:480` (só suspeita) | Sim — revertendo `_sincronizacao.ts`, 5 testes falham (itens 1 e 3 juntos) |
| 2 | Falha transitória ao ler atividades → execução "falhou", marca d'água mantida | **Sim** — `app/obras/_lib/field/situacao-da-os.ts:91` e `:110` passam a lançar; `cliente.ts` deixa propagar; o `catch` de `_execucao.ts` grava `status: 'falhou'`, `marca_dagua_nova: null` | **Sim** — `_lib/field/__tests__/situacao-da-os.test.ts:84,89`, `cliente.test.ts:492`; `sincronizar/__tests__/_execucao.test.ts:52` confere o registro de falha | Sim — revertendo `situacao-da-os.ts`, 3 testes falham. (O teste de `_execucao.test.ts:52` sozinho não prova a correção — ele mocka o cliente já rejeitando e cobre comportamento que já existia; quem prova são os de `situacao-da-os`/`cliente`.) |
| 3 | Ausência em massa → só suspeita na 1ª passagem; alerta só em nova varredura após o intervalo | **Sim** — `_sincronizacao.ts:388-400` grava só `field_ausente_desde`; na varredura seguinte elas não contam mais como "novas" e caem no fluxo normal, que só alerta com `INTERVALO_MINIMO_PARA_ALERTA_MS` (20 h, `:98`, `:423`) | **Sim** — `_sincronizacao.test.ts:326` (duas passagens: suspeita, depois alerta 24 h depois) e `sincronizar/__tests__/_actions.test.ts:392` | Sim (mesma mutação do item 1) |
| 4 | `Retry-After` excessivo limitado a 30 s | **Sim** — `app/obras/_lib/field/http.ts:25`, `:208-211` (`Math.min(..., 30_000)`, vale também para o backoff próprio) | **Sim** — `_lib/field/__tests__/http.test.ts:176` (`retry-after: 3600` → espera 30 000 ms) | Sim — 1 teste falha |
| 5 | Segunda aba não sobrescreve tarefa já respondida | **Sim** — `app/obras/tarefas/_actions.ts:49` (`.eq('situacao','aberta')`) + `:53` (0 linhas → erro "já foi respondida") | **Sim** — `__tests__/tarefas.test.ts:114` | Sim — 3 testes falham |
| 6 | Desfazer diário + apagar tarefas abertas na mesma transação | **Sim** — `app/obras/diario/_actions.ts:238` chama `obras_desfazer_diario(p_obra_id, p_dia)`; o SQL faz os dois `delete` numa só função PL/pgSQL (uma chamada RPC = uma transação) | **Parcial, e é o limite do que jest consegue** — `__tests__/diario.test.ts:414,422` provam que a ação chama a RPC com os argumentos certos e não recalcula contadores em erro. A atomicidade em si só se prova rodando o SQL no banco | Sim — revertendo `diario/_actions.ts`, 6 testes falham |
| 7 | Foto só JPEG ≤ 5 MiB: navegador, servidor e bucket | **Sim** no navegador (`diario/_foto.tsx:75`, `:80`) e no servidor (`diario/_actions.ts:92` confere o caminho `obra/dia.jpg`; `:95-99` confere `contentType` e `size` via `storage.info`). Bucket: **pendente de aplicação manual** (seção 3) | **Sim** — `__tests__/foto.test.tsx:29,35`; `__tests__/diario.test.ts:196,209` | Sim — `_foto.tsx` revertido: 2 falham; `_actions.ts` revertido: incluídos nos 6 acima |

Assinatura: a chamada `rpc('obras_desfazer_diario', { p_obra_id, p_dia })` bate com
`public.obras_desfazer_diario(p_obra_id uuid, p_dia date)`; `p_dia` vem de `hojeISO()` (`AAAA-MM-DD`), que o
PostgREST converte para `date`.

---

## 2. Bloqueantes

**Nenhum.**

Cenários checados nos territórios rigorosos, e por que não bloqueiam:

- **RPC chamada direto pelo navegador por usuário sem acesso a Obras.** A função é `SECURITY INVOKER`, então
  roda sob a RLS "obras access" (`obras_has_access()`, que é `exists(...)` e nunca devolve NULL). Os dois
  `delete` enxergam 0 linhas, o `if not found` levanta exceção e a transação inteira volta. **Falha fechado.**
- **Usuário COM acesso a Obras chama a RPC com outra data/obra.** Apaga o diário daquele dia e as tarefas
  abertas dele — mas esse usuário já pode fazer exatamente isso hoje com `delete` direto na tabela (a policy é
  `for all`). Não amplia privilégio.
- **Anon.** `revoke all ... from public, anon` + `grant ... to authenticated`; a verificação pós-commit confere.
- **Alerta em massa (item 3).** O freio agora deixa de congelar para sempre: na segunda varredura completa, ≥ 20 h
  depois, as ausências confirmadas viram alerta. Isso só acontece se o Field devolver a lista parcial (sem erro)
  em **duas** varreduras completas seguidas; se a OS reaparecer em qualquer uma, a suspeita é limpa. E "alerta"
  aqui é etiqueta na tela da Base (`base/_etiquetas.tsx`), não notificação. É o comportamento pedido, não
  borda aberta.
- **Item 1 sobrescrevendo ficha.** A limpeza no ramo "não entra na carga" grava só `field_ausente_desde/em = null`
  por `id`, casado por `field_id` (nunca pelo número). Loja/descrição não são tocadas — o teste confere.

---

## 3. SQL e bucket — o que conferir ANTES de aplicar em produção

### `sdd-sql-obras-desfazer-diario-atomico.sql`

| Ponto | Situação |
|---|---|
| `SECURITY INVOKER` | Correto e é a escolha certa: a autorização fica na RLS existente, sem guarda imperativa que possa falhar aberto |
| `search_path` | `set search_path = public` — adequado para invoker (sem risco de sequestro de privilégio) |
| Autorização / NULL | Não há guarda própria; depende de `obras_has_access()` (`exists`, nunca NULL). Falha fechado (ver seção 2) |
| GRANT/REVOKE | `revoke all from public, anon`; `grant execute to authenticated`. `service_role` mantém o default do Supabase — ok |
| Transação única | Sim: função PL/pgSQL chamada numa RPC; o `raise` desfaz o `delete` de tarefas |
| Padrão do projeto | `begin/commit`, seção 0 (aborta sem `obras-v0`) e bloco de verificação com 3 linhas OK/FALHOU — segue `sql.md` |
| Assinatura × código | Bate (seção 1) |

**Nada precisa ser ajustado no arquivo antes de aplicar.** Precisa, sim, ser **rodado e testado de verdade**
(regra do `sql.md`: "SQL só é verificado de verdade rodando"). Sugestão de fumaça, em transação com `rollback`
e com a sessão simulando um usuário `authenticated` com acesso a Obras: criar diário + 1 tarefa aberta + 1 respondida
do dia; chamar a RPC; conferir que sobrou só a respondida. Repetir com um usuário **sem** acesso e conferir que
nada foi apagado e que veio erro. A verificação do arquivo deve devolver 3 linhas `OK`.

Ordem de deploy: **SQL antes do código** (o Duda já sinalizou). Código antigo convive bem com a função criada.
Depois de aplicar, atualizar a tabela de migrations em `.claude/rules/sql.md` no mesmo commit.

### Bucket `obras-fotos` (`docs/obras/2026-09-21-limite-fotos.md`)

A instrução está correta: `file_size_limit = 5242880`, `allowed_mime_types = ['image/jpeg']`, manter privado; o
upload do código declara `contentType: 'image/jpeg'`, então passa no filtro de MIME. Não mexe em objetos nem
policies. As policies de `insert`/`select`/`update` do `obras-v0` já cobrem upload com `upsert` e o `info()`.

**Conferência obrigatória após o deploy (não é bloqueante de merge, mas é de "pronto"):** a validação do
servidor depende de `storage.info()` devolver `contentType` e `size` exatamente como o teste mocka
(`image/jpeg`, número). Isso só foi provado em mock; os tipos do `@supabase/storage-js` 2.108.1 (`FileObjectV2`
camelizado: `contentType?`, `size?`) batem, mas **não foi verificado contra o Storage real**. Se o formato real
diferir, **toda foto é recusada** (o diário com foto não salva; sem foto salva normal) — sem perda de dado, mas
quebra a foto inteira. Fumaça: registrar um diário com foto na tela depois do deploy.

---

## 4. Backlog (não volta ao dev)

1. **Uma OS com `/tasks` quebrado de forma persistente para toda a sincronização** (item 2). Antes a OS era pulada;
   agora qualquer erro persistente numa única OS faz toda varredura (incremental e completa) terminar em `falhou`,
   e nenhuma OS nova entra até resolver. Falha é visível em `obras_sync_execucao`, sem dano de dado. É o preço
   declarado de não avançar a marca d'água — vale só monitorar execuções `falhou` seguidas.
2. **Desfazer em duplo clique/duas abas agora mostra erro.** A RPC levanta exceção quando o diário já não existe;
   antes devolvia sucesso. Cosmético.
3. **Foto HEIC/PNG em aparelho onde a redução por canvas falha agora é recusada** (antes subia o original). Coerente
   com "só JPEG"; a mensagem já diz que dá para salvar sem foto.
4. Foto tirada perto da meia-noite: o caminho vem de `hoje` do cliente e o servidor compara com `hojeISO()`; se
   discordarem, a foto é recusada. Improvável, sem dano.
5. Item 6 não tem teste automatizado da atomicidade (só dá para provar no banco) — coberto pela fumaça da seção 3.

---

## 5. Resultados reais (worktree de `origin/duda/field-api-client` @ `42e40d4`)

- `npx jest app/obras`: **Test Suites: 29 passed, 29 total — Tests: 650 passed, 1 todo, 651 total** (72,8 s).
  Bate com o relato do Duda.
- `npx tsc --noEmit`: **exit 0, sem saída.**
- Mutação (fonte revertido para `origin/master`, teste da branch mantido):
  - `_sincronizacao.ts` → 5 falhas / 74
  - `situacao-da-os.ts` → 3 falhas / 85
  - `http.ts` → 1 falha / 18
  - `tarefas/_actions.ts` → 3 falhas / 12
  - `diario/_actions.ts` → 6 falhas / 37
  - `diario/_foto.tsx` → 2 falhas / 3
- Build e lint não foram rodados nesta revisão (fora do pedido).
